# Stage 3D HQ3: admin refinement and instant NEW RUN gibbing, report

**Status: HUMAN-QA CANDIDATE — WAITING FOR USER.** Only the user can say HUMAN QA PASSED.

## Human-QA correction 1: the white streaks on the gibs

**Reported in human QA.** Small white lines sometimes ran from the flying pieces to a hand.

**The cause, confirmed.** The white highlight `arc` on each detached hand continued the previous path. In this Pixi version, every fill or stroke starts the next path at the last point drawn, and an `arc` joins its start to that point. The result was a white line at 25 % opacity from the core lump to the hand, in flight and on the corpse.

**The fix.** One line of `gore.js`: `g.beginPath()` before that arc.
- Switching the highlight off is not a fix: the dark-red stump arc then inherits the join and draws thick red lines.

**The checks** (`dev/stage-3d-hq3/evidence/h3-qa1/`):
- `gib_streaks.py`: eight explosions drawn by the real `gibs()`.
  - Stray pixels: 3,699 shipped, **0 fixed**.
  - Every pixel that changed lies on those lines; the pieces, hands, highlight, stumps, colours, sizes and blood are unchanged.
- `gib_browser.py`, one real blast on two screens and a late joiner: 5/5.
- Nothing else was re-run.

The checkpoint `486564d` described below is kept as it was; the fix is the next commit on `stage-3d-hq3`.

## Source and branch

| | |
|---|---|
| Accepted parent | `stage-3d-hq2` `f542b7cbd90f95148e644e6cba513cf55ddd52c9`, tree `6730834df06b36917ec9f3b7e56f56c8ee5487de` (checked live before any change: `dev/stage-3d-hq3/evidence/h3-0/`) |
| Branch | `stage-3d-hq3`, new from exactly `f542b7c`, normal pushes only |
| H3-1 | `3692bf7` (tree `b915a95`): the gibs |
| H3-2 | `c5602aa` (tree `f77100d`): the admin panel and UNLIMITED NEW RUN |
| H3-3 | the focused checks, these documents, the packaging tool (no game change). Its own commit and tree are in `STAGE_3D_HQ3_PACKAGE_RECEIPT.txt`, because a commit cannot contain its own hash |
| Other branches | `main`, `stage-3d`, `stage-3d-hq1`, `stage-3d-hq2`, `stage-3h0` and every other branch are where they were before HQ3. `verify_remote_hq3.py` checks this after every push |

## A. NEW RUN gibs the Wanderer

When the server approves a NEW RUN, the round body pops at once into pieces.

**The breakup** (`dphys.js` `gibShapes`). A seeded breakup gives one core lump and 4–6 rim chunks, 5–7 pieces in all. The cuts are uneven, each with a notch, and every rim chunk keeps a stretch of the round outer edge. Both round hands come off too.

**The motion** (`stepBoom`, `gibBody`). From the first physics step every piece and hand is a free body:
- it flies outward and along the blast;
- it hops off the floor and bounces once or twice;
- it spins and skids to rest within about 3 s.

**What is kept from HQ1 and HQ2:**
- The light and the hat are torn away, as in HQ2, with HQ1's timeline: ON holds 3–7 s, then fails over 1–2 s to exactly zero; OFF or the IR camcorder gives no light.
- A headlamp rides the biggest piece.
- There are four blood bursts at the blast and one where the biggest piece first lands. A hard wall strike stamps HQ1's wallpaper stain.
- There is no flash and no camera shake. Nothing touches other players or entities, and the pieces never block anyone.

**The record.** The server's corpse record carries the breakup: `gs` (the seed), `gb` (each piece's resting x, y and turn, at most 8) and `gh` (both hands).
- It is the only corpse of that player (HQ2's one-corpse-per-owner rule).
- Every screen and every late joiner draws it the same.
- An ordinary death, the next NEW RUN, or a world reset replaces or clears it.
- Records are 505–639 bytes (median 564), bounded at 700 by `gib_check`.

**On screen:**
- The replay (`mp.js`) and the corpse (`gore.js`) draw the pieces and never show the whole avatar.
- The replay draws from its own physics with the server's seed, so it ends on the record.
- The bundle is unchanged.

**Only Boom gibs.** The eight Hound/Smiler deaths are identical to HQ2's, number for number.

## B. The admin panel and UNLIMITED NEW RUN

**The audit** (`evidence/h3-0/AUDIT.md`) found three stale points:
- there was no personal NEW RUN in the panel;
- WORLD's NEW RUN FOR EVERYONE did not say it blows nobody up;
- nothing explained HQ2's solid players.

Everything else worked as labelled and is unchanged.

**UNLIMITED NEW RUN.** The authority lives in `server.js`:
- **The flag.** `me.nrFree` belongs to the admin's own connection. It is OFF by default and is gone with the connection.
- **Who can set it.** Only `{t:'a', c:'nrfree', on}` sets it, and the server reads `t:'a'` only from a connection that has unlocked admin (`if (me.admin) adminCommand(...)`). An `id` sent with the command is ignored, so it can never be another player's.
- **What the server says.** It answers `{t:'nrf', on}` plus a status line, and every admin snapshot carries `nf`.
- **The panel** (`mp.js`, DEATHS → YOUR NEW RUN · INSTANT GIB) shows only what the server says. A click alone never changes the label. The client clears it when the connection closes.
- **What it skips.** `nrIntent` passes `free = me.admin && me.nrFree` to `sim.nrWhy`/`newRun` (`dev/sim_glue.js` → `sim.js`). `free` skips only the 30 s cooldown. The world epoch, being in a run, dead, held, the duplicate press number and a press while out of the world are all still refused.

**Also updated:**
- WORLD's NEW RUN FOR EVERYONE sits under "RUN · THE WHOLE ROOM". Its confirmation says what goes and that nobody is blown up, and the server answers `WORLD RESET FOR EVERYONE · NOBODY BLOWN UP · NO COOLDOWNS`.
- PLAYERS has a help line on solid wanderers (BRING and GO TO land beside the player), MENU and the dead.

## The wire

| Direction | Added | Removed |
|---|---|---|
| corpse records (`bodies`) | `gs`, `gb`, `gh` on `c:'Boom'` records only (`death_srv.js`; passed and validated by `assets/net-wire.js` `toRec`) | — |
| client → server | `{t:'a', c:'nrfree', on}`, admin only | — |
| server → client | `{t:'nrf', on}` (the answer to it); `nf` in that admin's snapshots | — |

`nr`/`nra`, the blast `fx` and the world epoch are unchanged.

## The files

`STAGE_3D_HQ3_CHANGED_FILES.txt` lists each with its reason. In short:
- **Production:** `dphys.js`, `death_srv.js`, `assets/net-wire.js`, `gore.js`, `mp.js`, `server.js` and the built `sim.js` (from `dev/sim_glue.js`).
- **Unchanged since HQ2** (byte-identical; the receipt checks this): the bundle, `index.html`, `move.js`, the lighting, the AI, the sounds.

## The focused checks (12)

The game code under test was always an exported commit (or the staged tree), never a live working tree. Browser checks ran on SwiftShader.

| # | Check (pack item) | Tool | Result |
|--:|---|---|---|
| 1 | Parent and branch integrity (1) | `verify_remote_hq3.py` after each push | PASS: H3-1, H3-2, H3-3 |
| 2 | The gibs without a screen (2, 3; frame-rate determinism) | `gib_check.js`, 120 blasts plus 3 fixed seeds at 30 FPS, 144 FPS and a jittered page | PASS. 5/6/7 pieces in 30/43/47 blasts. Pieces and hands rest out of walls. At rest before 3.2 s. At most 5 pools, all on floor. At most 3 wall marks. The light released at the blast. 9/9 frame-rate runs end in the server's record |
| 3 | Two screens and a late joiner (2, 3) | `gib_browser.py` on H3-1 and again on the final game code | PASS 5/5 both times. No whole torso on any screen. The pieces are apart in the first frame. One blast. The same record on three pages; replays end within 1 px of it. The late joiner gets no blast and no sound. The H3-1 run first scored 4/5 because of the test itself (below) |
| 4 | NEW RUN denied: 30 s, no phantom (4) | HQ2's `proto_lab.js nr_e02` | PASS 7/7 |
| 5 | UNLIMITED NEW RUN ON / OFF / forged / another player / reconnect / world reset (5, 6, 10) | `admin_nr.js` | PASS 8/8 |
| 6 | The same in the real panel (5, 6) | `admin_browser.py` | PASS 4/4 on the second run. The first run (3/4) was a fault in the test, below |
| 7 | It skips only the cooldown (state, dead, held, epoch); replacement by an ordinary death (5, 7) | `nr_free_unit.js` | PASS 4/4 |
| 8 | World reset during a gibbing (7) | HQ2's `reset_epoch.py --case boom` | PASS 10/10 |
| 9 | Blood and equipment light: ON holds then fades to exactly 0; OFF / camcorder never lit; wall stain; sound (8) | HQ2's `boom_browser.py` (flashlight ON; camcorder OFF) | PASS 7/7 and 7/7. Hold 3.1 s, fade 1.5 s, pages within 0.013 s |
| 10 | The eight Hound/Smiler deaths unchanged (9: monster-death smoke) | HQ2's `death_equiv.js`, against an HQ2 export | PASS 384/384 runs and 800 light profiles identical |
| 11 | Collision smoke: head-on in a hall (9) | HQ2's `col_browser.py --case head` | PASS 5/5 |
| 12 | No secrets in the changes | 3D's `secret_scan_3d.py` over every file changed since 3H0 (4,459, HQ3's included), with the owner's address as an extra literal kept outside the repository | No finding in any HQ3 file; self-test 21/21. The tool exits 1 on its one finding, HQ2's documented false positive in `h2-5/video/main/film.mp4` (compressed picture data; HQ3 does not touch it): `evidence/h3-3/secret_scan_note.txt` |

**Ordinary admin controls (pack item 10):**
- MONSTERS remove and GOD worked during these runs (server logs, `admin_browser`, `admin_nr`).
- The WORLD reset worked (`admin_nr` A8, `reset_epoch`).
- The status text of an existing control was not asserted separately. The new control's status text was (`admin_browser`).

Evidence: `dev/stage-3d-hq3/evidence/h3-1/`, `h3-2/`, `h3-3/`, each with `steps.txt` and `SUMMARY.md`.

### Found and fixed during HQ3

- **`mp.js` in the H3-1 commit.** H3-1's file was made by applying only the gib changes. Its source came out with `gibFrame` declared inside `updateFx`, and the attacker lines outside an empty `if (f.att)`.
  - It was valid and behaved the same: every death replay has an attacker, and every NEW RUN blast takes the gib branch.
  - H3-2 restored the intended layout, and `gib_browser` passed again on it.
- **Two test faults, not game faults** (both kept in `attempts/`):
  - `gib_browser` check 4 asked that the spectator's last replay sample be at rest, but his Death Lab clock had been stepped for the photographs. The check now asks it of Alice's page only, and the same run was reanalysed.
  - `admin_browser` hid the panel by DOM, so the game still thought it was open, and the next backtick closed it. The OFF click reached the server (refusal followed) but the closed panel was not redrawn. The test now uses the panel's own close button and checks the panel is open before reading it.

### Baseline exceptions (inherited, not re-run)

HQ2's known failing legacy suites were not re-run, as the pack asks: `npm test` 149/162, `audit_net` 13/17, `audit_net2` 8/11, `s_audit` 8/9, `death_net` 15/16, `live` 14/17, `test_shadows` 43/48 and `s_humanqa_hotfix` 5/6. Their failing names and reasons are listed in `STAGE_3D_HQ2_REPORT.md`. They are the known baseline, not a claim that everything is green.

## Known limitations (judge them)

1. **SwiftShader only.** A real GPU has not been tested, and there is no frame-rate claim.
2. **A lone player.** After a lone player's NEW RUN, SPAWN enters an empty room. HQ2's rule then starts a fresh world, so the pieces are not there in the new run. With anyone else in a run they stay.
3. **The size of the pieces.** Each piece is a part of the Wanderer's round body, so at the default zoom they are small. Whether they read well enough is for you to judge.
4. **UNLIMITED NEW RUN** still needs SPAWN between NEW RUNs: being out of the world is refused, as specified.
5. **A reload or reconnect** is a new player, as in HQ2. UNLIMITED NEW RUN is OFF again, and after a reload the passcode has to be typed again.
6. **The Death Lab's stepped clock.** When a spectator's clock is held, the wall stain from the corpse record can appear before the stepped replay reaches the wall. This is HQ1's accepted Death Lab behaviour.
7. **The offline NEW RUN** (no server) keeps the old local fade, as in HQ2. Gibs come only from a server-approved NEW RUN.
8. HQ2's other residual issues stand, for example bodies overlapping for a moment under lag (`STAGE_3D_HQ2_REPORT.md`, Known limitations).

## Sound

The blast's sound is HQ2's, and a hard wall strike uses the existing wall-thud sound. The pack's ten `reference_audio` candidates are **not** shipped: the package receipt checks every one by content. Choosing one is the user's call.

## Running it

```
ADMIN_PASSCODE=<your own passcode> node server.js 8000      # then open http://localhost:8000 in two or three windows
```

Node 18 or later; nothing to install. The steps to try are in `STAGE_3D_HQ3_HUMAN_QA.md`. Every tool that starts a server (`dev/stage-3d-hq3/README.md`) uses a synthetic test passcode.
