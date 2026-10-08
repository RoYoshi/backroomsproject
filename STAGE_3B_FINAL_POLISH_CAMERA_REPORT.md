# Stage 3B Final Polish — Camera Report (Phase A, Stage 3B-N: camera correction only)

| | |
|---|---|
| checkpoint | `stage-3b-n-camera` **`b2783b34e1185b30002350f5b482dd8c5e10b000`**, tree `bdef2606b50dc485eac648a70300e33bf7a32723`, parent `69602e7` (accepted Stage 3B) |
| remote | verified after the push: `git ls-remote` and the GitHub REST commit / tree / parent all match (`dev/stage-3b-n/verify_remote_3bn.py`) |
| branch name | the pack asked for `stage-3b-n`, but the remote `stage-3b-n` still holds the superseded broad Stage 3B-N work (`118d45c`). It was **not** force-pushed over; the camera checkpoint went to the new branch `stage-3b-n-camera`. `stage-3b-l` is built on it. |

## Root cause: the runtime never received the camera policy

`index.html` loads `camera_policy.js` and `timing_policy.js`, but `server.js` serves only a whitelist of client files,
and neither was on it. Both returned **404**. The client then silently ran on the bundle's built-in fallback camera
of **1.18**, which shows a **1627 × 915** world at 1920×1080.

The parent run shows it (`dev/stage-3b-n/evidence/a/camera_parent.log`):
`camera_policy.js 404, timing_policy.js 404 … 16:9 1920x1080: policy false, scale 1.18, visible 1627.1 × 915.3`.

## Fix (camera only)

| file | change |
|---|---|
| `server.js` | the whitelist now serves `camera_policy.js` and `timing_policy.js`. Every server-only file is still refused: `server.js`, `sim.js`, `ai.js`, `death_srv.js`, `package.json` and `dev/` all return 404. |
| `camera_policy.js` | `REF_SCALE = 1.25`. 1920×1080 is the canonical maximum world view, **1536 × 864**. |
| `assets/index-DKbV5Nv9.js` | the bundle's own fallback is now 1.25 instead of 1.18. It is dead code now that the policy loads, but it is kept consistent. |
| `assets/l0-remaster.js` | one token: the bake-density fallback is now 1.25 instead of 1.18. It too only applies if the policy were missing. |
| `dev/tests/s_camera_fairness.js` | locks 1.25 and 1536 × 864. |

`timing_policy.js` had the same route problem. It is now served too, unchanged: the timing itself was not redesigned.
The FPS-equality regression (`dev/tests/s_fps_equality.js`) passes: 60 fixed gameplay ticks per second at 15 / 60 /
120 / 240 / 360 FPS and jittered frame rates.

## Universal Camera Fairness on the served runtime

`dev/stage-3b-n/camera_3bn.js` drives the real served client in Chromium at every viewport below: **6 / 6 PASS**
(`dev/stage-3b-n/evidence/a/camera_after.log`).

| viewport | scale | world shown (px) |
|---|---|---|
| 1920×1080 DPR 1 | 1.250 | **1536 × 864** |
| 1920×1080 DPR 2 | 1.250 (renderer resolution 2) | 1536 × 864 |
| 3840×2160 (4K) | 2.500 | 1536 × 864 |
| 1280×720 | 0.833 | 1536 × 864 |
| 1920×1200 (16:10) | 1.389 | 1382 × 864 (crops the sides) |
| 1600×1200 (4:3) | 1.389 | 1152 × 864 |
| 2560×1080 (21:9) | 1.667 | 1536 × 648 (crops top and bottom) |
| 3440×1440 DPR 1 and DPR 2 | 2.240 | 1536 × 643 |
| 1080×1920 portrait | 2.222 | 486 × 864 |
| 390×844 phone, DPR 2 | 0.977 | 399 × 864 |

What each check showed:
- **C01:** both policies are served byte for byte, and the server-only files are still refused.
- **C02:** every viewport loads both policies with no 404 and runs on them.
- **C03:** DPR only sharpens the picture. 4K shows the 1080p world. Other aspect ratios crop one axis and never show more.
- **C04:** the client sends the same message kinds at every viewport.
- **C05:** 1920×1080 runs at exactly 1.25 and shows 1536 × 864.
- **C06:** no dynamic zoom. Across 110 frames the scale stayed at exactly **1.25**: standing in YELLOW HALL, PILLAR HALL, LONG ROOM and DEEP CARPET, while running, with two Hounds in dread range, and in a blackout.

Fast checks also pass: `dev/stage-3b-n/test_3bn.js` 7 / 7 (serving, privacy, byte identity, load order, 12-viewport maths,
the 1.25 lock, the bundle fallback) and `s_camera_fairness.js` 12 / 12.

## Notes

- The death camera (×1.4 while dead) and the camcorder's zoom are the existing zoom-ins. They are not tactical and were not changed.
  If a test page's wanderer was caught before the test made it safe, it shows the death camera, so the harness retries those pages.
- The JSON rows record the Pixi canvas backing size. On some heavy software-rendered pages it reads the default
  300×150 before the renderer's first resize. This happens in both the parent and the new runs and is not used by any check:
  the world scale, the CSS viewport and the overlay size all are.
- The C03 label in `camera_after.log` still says "within 1627 x 915": the run started before that label was corrected.
  The check itself always compared against the policy's 1536 × 864.
