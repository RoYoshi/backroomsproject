# B++-0: server placements kept against stale movement packets

## The race (inherited from HQ2, in HQ5 and in accepted B+)

Every server-side placement resets the player's movement check with `mvReset`. The placements are:
- admin BRING, GOTO, GLITCH, ITEM and ENTITY go-to, through `moveTo`;
- the admin world reset, through `worldReset`;
- a spawn moved off a crowd.

`mvReset` refills the travel budget to 540 px plus 28 px of slack and opens a 900 ms grace. In the grace, **refused** moves are ignored instead of corrected. But a pose the page sent *before* it learnt of the placement, still at the old spot, was **accepted** whenever the old spot lay within the full budget by a free route (up to about 570 px). The placement was undone. The page's own fresh poses at the new spot were then refused (the budget was spent), and after the grace it was corrected back to the old spot: a rubber band.

**Not affected:** join, respawn and NEW RUN spawns. The client's `join` / `respawn` message and its next poses travel on one ordered connection, so no pose from before them can arrive after them.

## Reproduced (`replay/*_before.json`, `dev/stage-3e-0-bpp/place_replay.js`)

Two placements, each 545 px from the old spot along a free line:
- a BRING from (504, 888) to (1012, 690);
- a world reset from (1454, 3494) to the reset spot (960, 3264).

The page keeps sending its old spot for 0–150 ms after it gets the placement's `tp`, then walks on at 280 px/s. Clients:
- B+: asks `caps`, sends every 25 ms;
- HQ5-style: sends every 50 ms;
- each with fixed and jittered timings.

| Server | Placements kept (545 px, 18 runs) | Corrections back to the old spot |
|---|---|---|
| HQ5 `ad98475` | 3 / 18 (only runs with no old pose in flight) | 15 |
| B+ `004b43f` | 2 / 18 | 16 |
| **B++-0** | **18 / 18** | **0** |

Real pages (`place_race.py --near 504:888`, SwiftShader):
- HQ5: 2 / 6 kept;
- B+: 0 / 6 kept (`dev/stage-3e-0/evidence/e0-1/placement/`);
- **B++-0: 6 / 6 kept** (`browser/place_race_near_bpp0.json`), with one `tp` each and no correction.

## The fix (`server.js`, 8 lines including comments)

1. `mvReset` records where and when the server put the player: `place: [x, y, t]`, only for a placement (`grace = true`).
2. `mvCheck` applies a new rule inside that placement's grace. A claimed pose farther from the placed spot than `VMAX · (now − t) + SLACK` is ignored, as a refused move in the grace is: no correction, and the rest of the packet still counts. VMAX is 360 px/s, the fastest legal motion plus 20 %, and SLACK is 28 px.

**Why this is enough.** A pose sent *after* the page took the placement lies within that reach: no legal motion is faster than VMAX, and the page started from the placed spot no earlier than `t`. Fresh, legitimate moves are therefore checked exactly as before, with the same budget, walls and peers.

A stale pose from a spot inside that reach is within a legal move of the new spot (at most about 60 px at typical delays). It is still checked as an ordinary move. The page's next fresh pose brings the player back to the new spot within the same budget, as `bring60_*` shows: kept, no correction.

**Why no protocol change.** A placement acknowledgement (a placement number in `tp`, echoed in `p`) would only remove that small, self-healing case. It would need a new field on both sides, and old clients would still need this guard. The guard needs no client change and protects old and new clients alike.

## What does not change (`guard/bplus.json` vs `guard/bpp0.json`, `proto_bpp0.json`)

| Check | B+ | B++-0 |
|---|---|---|
| Join, first pose at a spawn spot, then sprint | taken, followed | the same |
| Join, first pose at a non-spawn spot | corrected at once | the same (that path closes the grace, so the guard is off) |
| BRING, then sprint 300 px/s at once | followed, 4 px behind, no correction | the same |
| BRING into a crowd: free spot, old poses, walk away | never closer than 44 px to the other player, ends where the page is | the same |
| The same 500 px claim 1.5 s after a placement (grace over) | taken (burst budget) | taken: unchanged |
| **A 500 px claim 150 ms after a placement** | **taken** | **ignored**: no legal motion covers it (stricter, by design) |

`proto_check.js` (B+'s protocol) passes on B++-0 in full:
- caps, `q`, isolation, world reset, death and disconnect;
- a fast client's 500 px jump and its move through a wall are refused.

**Real pages on B++-0** (`browser/`):
- `two_browser.py` B+ passes: one pose for avatar, jobs and light; bodies at the server target; never inside; one avatar after reconnect and after a world reset; the crafted `q` dropped; 0 page errors.
- HQ2's collision cases pass: head-on 5/5 and aside 5/5, no correction.

## Caveats

- **Admins' own moves are not checked** (`adminMove`, for their debug tools), and this is unchanged. An admin's own stale pose after GOTO or a world reset can still put the admin back for one update. The admin's next pose puts it right at once, because admins are not budget-checked, so there is no rubber band.
- **A stale pose arriving more than 900 ms late** (a TCP stall) is outside the grace, as before.
