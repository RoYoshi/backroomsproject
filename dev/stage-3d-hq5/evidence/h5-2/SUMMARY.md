# H5-2: the five focused gates

The game under test is the H5-1 commit `1863935`; its game file is the final one.
- Every browser run used SwiftShader (ANGLE, Vulkan, SwiftShader Device), DPR 1, one machine.
- "Levels" are 0-255 screen levels.
- All lab numbers are in `../h5-1/lab_report.json`.

## 1. Source and integrity: PASS

Evidence: `integrity.json` and `secret_scan.json`.
- **Parent.** `79e1461` with tree `9aee1db`, checked. One straight commit; `verify_remote_hq5.py` reports OK, and all 26 other branches are where they were.
- **One game file changed:** `assets/br-role.js`, with 112 lines added and 18 removed. `VERSION` changed from `br-role 1.1-qa2` to `br-role 1.2-candidate`.
- **Unchanged files:**
  - the bundle: the avatar and HQ4 fix A, with no `ellipse(1,5,19,19)`;
  - `gore.js`, which still has the QA1 `g.beginPath().arc(` fix;
  - the server, AI, networking and every other runtime file.
- **HQ4 fix B.** Its guard line is still in `actorShadows()`.
- **Errors.** 0 page errors and 0 BR-RoLE errors in every run: lab, lifecycle, smoke, collision, frame sample and overlay.
- **The A/B.** HQ5 with the contact off (DEV gain 0) is identical to HQ4, pixel for pixel, in every frozen scene. The revert is checked in H5-3.
- **Secret scan.** `dev/stage-3d/secret_scan_3d.py` with the owner's e-mail as an extra string passes its self-test (21/21). It finds nothing in HQ5's files. Its one finding is HQ2's existing film (`h2-5/.../film.mp4`), where raw video bytes happen to look like an address.

## 2. Visual geometry: PASS

Evidence: `../h5-1/sheet_geometry.png`, `../h5-1/sheet_under_lamp.png` and `../h5-1/SUMMARY.md`. One fixture, her own light off, the same camera.

| Check | Result |
|---|---|
| 0, 90, 180, 270 degrees | **Her body:** 0 pixels changed<br>**Edge and floor up to ~26 px:** at most 15 levels<br>**Past 31 px:** 0 changed |
| Hand swing | The contact job is identical at both swing extremes. Its centre is the body's world position, and its direction is the light's (0 at every heading), never her rotation |
| Under the lamp | An even ring |
| The cast | HQ4's cast jobs equal HQ5's. At the cast's root the contact adds about .01 (no double darkening) |

## 3. Light reality and occlusion: PASS

Evidence: `sheet_lights.png`, `sheet_carried.png`, `peers_*.png`.

**Fixtures** (taken just past the body's edge, at 19-20 px):

| Scene | Contact taken | Contacts |
|---|---|---|
| Fixture A alone | .07 | A, with its cast |
| Fixture B alone, farther | .02 | B, with its cast |
| A and B together | .08 | A with its cast, B contact only |
| Every fixture | .13 | four lamps, each taking its own share |

Each light takes only its own share and the other fills it, so two lights are not twice as dark.

**Blackout.** The admin BLACKOUT is on for both variants: the light buffer is 0 round her, there are no contact jobs, and 0 pixels change.

**A peer's flashlight.** No fixture; Bob is 95 px away on the far side, then on the lamp side.
- One contact each time, from his light, with its cast.
- In HQ5's own held frame, contact off against on, the floor round her changes by 23-27 levels.
- A few pixels elsewhere change by 2 levels or less. That is frame noise: his beam angle and position are still being eased by the network.

**Her own light only.** No contact job. 0 pixels change round her (15 pixels at 1 level where Bob's avatar is still settling). HQ4's exclusion is kept.

**Peers.**
- Bob visible 60 px away: her page draws his contact (L2, with his cast).
- Bob behind a wall: no contact and no cast job for him.
- No x-ray. The pixels that change in that frame are her own contact.

## 4. Gameplay and tiers: PASS

**Gameplay smoke.** HQ4's `gameplay_smoke.py` as it is, with two real pages for each variant (`gameplay_smoke/`):
- she walks (671 px for HQ5, 636 px for HQ4);
- the spin takes every quarter;
- F, F turns the light on, then off;
- NEW RUN is approved and opens her run menu;
- Bob's page gets her gibs (6 pieces and both hands, the same seed for both);
- SPAWN brings her back and she walks.

Both variants pass, with 0 page errors.

**Peer collision.** HQ2's `col_browser.py --case head` on the HQ5 game: 5/5 (`col_browser_head_hq5.json`).

**Lifecycle** (`lifecycle/`): Bob alive beside her, then a Hound death previewed on Bob, then Bob's page closed. Her page was sampled every 250 ms:
- **Alive:** his contact (8/8 samples).
- **From the first frame BR-RoLE drew with his death replay:** no contact for anyone but her (38/38 samples). The one earlier sample that already counts the replay was taken before that frame was drawn: its jobs are still the previous frame's. HQ4's cast still falls from the replay avatar and the Hound, unchanged.
- **His corpse, then the disconnect:** none. No ghost.
- Her own contact was present in every sample.

**Tiers** (`sheet_tiers.png`, the same spot): the same rule on every tier.

| Tier | Contact taken at 19 px | Her body |
|---|---|---|
| LOW | .102 | 4 px at 1 level |
| MEDIUM | .106 | 0 changed |
| HIGH | .110 | 0 changed |

Contact off equals HQ4 on every tier.

## 5. Frame cost: no measurable difference

Evidence: `perf.json`. One page, clock running, every fixture, standing still, 8 s each, alternating:

| Run | Page frame (ms) | BR-RoLE (ms) | Contact jobs |
|---|---|---|---|
| HQ4 a | 146.7 | 9.89 | 0 |
| HQ5 a | 151.2 | 10.28 | 4 |
| HQ4 b | 152.5 | 10.76 | 0 |
| HQ5 b | 148.2 | 10.22 | 4 |

The difference is inside the run-to-run noise. This is SwiftShader, about 7 fps; real GPUs were not measured. The two-page smoke gave BR-RoLE 20.6 ms (HQ4) against 19.6 ms (HQ5).

The overlay and its byte checks are in `../h5-3/`.
