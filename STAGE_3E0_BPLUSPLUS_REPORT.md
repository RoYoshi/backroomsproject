# Stage 3E-0: B++ report

**Status: B++ HUMAN QA PENDING.** B+ is accepted (B+ HUMAN QA PASSED) and frozen: `stage-3e-0` is still `1f2deba` and still carries the old placement race.

B++ is a candidate until you decide. Nothing is merged or promoted.

| | |
|---|---|
| Branch | `stage-3e-0-bplusplus`, new, made from the accepted B+ head `1f2deba0fc4a1facd41366fb2da9b88af3bd5a52` (tree `11686a0`) |
| B++-0, the placement race fix | `b8391ef38b21ca562c4b28eb5ce57ec31a070b8a`, tree `98f1d047f228114ef35136a437eaeaf4fe903fc8`, verified on GitHub |
| Optimisation commit | **None**: profiled, nothing measurable to win (below) |
| Game files changed since B+ | **`server.js` only** (+8 / −2 lines). Unchanged: `mp.js`, `index.html`, `favicon.ico`, `server/static.js`, every page file, BR-RoLE 1.2, `sim.js`, `ai.js`, `move.js` |
| Measurements and docs | `d501afe4c065a555de709bb11f438a47a7b643ba` (tree `2a6af22`): no game change. A last commit adds only the overlay receipt and these SHAs |
| Overlay | `BPLUSPLUS_HUMAN_QA_OVERLAY.zip` (34,637 bytes, SHA-256 `668dec4cc5a2420ac6e2e8feae8d5625c122fa9fb26e891a6b2a42c1b753fe13`) goes over the accepted B+ game, with `REVERT_TO_BPLUS`. Validated: over a B+ export, over HQ5 + your B+ overlay, the revert, and two real pages, including the 545 px teleport |

## B++-0: server placements kept against stale movement packets

**The race, from HQ2 and still in HQ5 and B+.**
1. After a server placement (admin BRING / GOTO / teleport tools, world reset, a spawn moved off a crowd), `mvReset` refilled the travel budget to 540 + 28 px. It opened a 900 ms grace that ignored only **refused** moves.
2. A pose the page sent before it knew of the placement, still at the old spot, was **accepted** if that spot was within the budget by a free route.
3. The placement was undone. The page's own new poses were then refused, and about 1 s later it was corrected back to the old spot.

**The fix** (`server.js`): inside that grace, a pose farther from the placed spot than the fastest legal motion could have carried the player since the placement (`VMAX · elapsed + SLACK`, VMAX 360 px/s) is ignored. It is treated like a refused move in the grace.

Every pose sent *after* the page took the placement is within that reach, so it is checked exactly as before: budget, walls and other players. No protocol change was needed, so it protects old and new clients alike. `evidence/p0/NOTE.md` explains why this is enough without a placement acknowledgement.

**Before and after.** Deterministic replay (`place_replay.js`): a BRING and a world reset 545 px from the old spot, 0–150 ms of old poses, B+ and HQ5-style clients, fixed and jittered timing.

| | Placements kept | Corrections back to the old spot | Real pages (`place_race.py`, 545 px) |
|---|---|---|---|
| HQ5 | 3 / 18 | 15 | 2 / 6 |
| Accepted B+ | 2 / 18 | 16 | 0 / 6 |
| **B++** | **18 / 18** | **0** | **6 / 6** |

**What stays the same** (`place_guard_check.js`, B+ against B++):
- join at a spawn spot;
- the immediate correction for a non-spawn first pose;
- a 300 px/s sprint right after a BRING, followed at once, 4 px behind;
- a BRING into a crowd: never closer than 44 px, no correction;
- the burst budget once the grace is over.

**The one intended difference:** a 500 px claim 150 ms after a placement was taken by B+ and is ignored by B++. That is stricter, not looser.

**Caveats:**
- **An admin's own moves are still unchecked**, by design for the debug tools. After GOTO or a world reset an admin can flicker back for a single update, then put right by its next pose, as before.
- **A pose arriving more than 900 ms late** (a stalled connection) is outside the grace, as before.

## Optimisation: profiled, none justified

Load: 7 moving B+ players at 25 ms (the room's maximum with a watching admin), 3 runs per build.

| | HQ5 | B+ | B++ |
|---|---|---|---|
| Server CPU | 2.47 % | 3.62 % | 3.69 % |
| Per player down / up | 25.2 / 2.9 KB/s | 27.8 / 5.7 KB/s | 27.7 / 5.7 KB/s |
| Messages down / up | 20.6 / 15.5 per s | 39.7 / 30.8 per s | 39.9 / 30.9 per s |

B++ is within noise of B+ on every line.

**The CPU profile.** B+'s whole pose path (`poseSend` with its sends) costs **0.07 % of one core**. The two byte-identical serialisation shortcuts that exist would save 0.003 % and 0.007 % of a core, below anything measurable, so **neither was made**.

**Nothing else is left to tune.** `mp.js` is unchanged, so client frame cost is identical. Bytes could only shrink by changing what the packets carry, which this stage forbids.

## Parity with B+ (`evidence/p1/SUMMARY.md`)

| | B+ | B++ |
|---|---|---|
| New poses of a moving friend | 26.0/s | 25.8/s |
| Pose age on arrival, mean | 13.8 ms | 13.7 ms |
| Drawn pose off the truth (60 Hz, eased) | 13.05 px | 13.19 px |
| Stalled frames | 1 % | 1 % |
| Bytes up / down | 6.78 / 8.25 KB/s | 6.76 / 8.26 KB/s |

An HQ5 client on the B++ server still gets exactly HQ5's traffic.

All pass on B++:
- **B+ protocol checks:** caps, `q`, isolation, world reset, death, disconnect, refused jump and refused wall.
- **Two real browsers:** a B+ page, a B+ page at 60 ms each way, and an HQ5 page on the B++ server. Checked: one pose for body, hands, gear, light and BR-RoLE; reconnect; world reset; crafted `q` dropped.
- **HQ2 collision:** head-on and aside, 5/5 each.
- **HQ4 gameplay smoke:** walk, spin, light, NEW RUN, spawn.
- **B math.**
- **Favicon:** 200, your bytes; protected paths still 404.

## Not tested here

- a real GPU (SwiftShader pages, about 4–12 frames/s);
- a real internet path;
- Firefox and Safari;
- more than 7 players plus a watching admin.

How a teleport *feels* is your Human QA.

## Undo

Copy `REVERT_TO_BPLUS` from the overlay (`server.js`) and restart: the game is the accepted B+ byte for byte (checked). Or check out `stage-3e-0`.
