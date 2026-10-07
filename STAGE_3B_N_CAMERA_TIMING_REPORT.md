# Stage 3B-N — Camera / Timing Policy Report

Branch `stage-3b-n` · parent `69602e7` (accepted Stage 3B) · checkpoint N1 `63a492d`

## Diagnosis

`index.html` loads `./camera_policy.js` and `./timing_policy.js` before the bundle, but `server.js` serves only the
files on its whitelist, and those two were not on it. Both requests returned **404**. The bundle then fell back:

- camera: `baseScale = innerWidth < 700 ? .85 : 1.18`, a fixed zoom for any window size. A bigger window showed more of
  the world: at 2560×1440 the player saw **2169×1220** world px, and on a 3440×1440 ultrawide **2915×1220**, against the
  canonical **1627×915**. 16:10 and 4:3 gained extra height. 1280×720 saw less (1085×610).
- timing: an inline copy (`FIXED_DT 1/60`, 15 catch-up steps, 0.25 s frame cap). The numbers match `timing_policy.js`,
  so the only effect was a 404 on every page load and running on a copy instead of the shared policy.

## Fix

`server.js`: `camera_policy.js` and `timing_policy.js` are added to the static whitelist. That is the whole fix. The
policy files, the bundle's use of them and the camera design are unchanged. Server-only files (`server.js`, `sim.js`,
`ai.js`, `death_srv.js`, `package.json`, `dev/…`) are still refused.

## Verification (the real server and client: `dev/stage-3b-n/camera_3bn.js`)

| viewport | parent: world px seen | Stage 3B-N: world px seen | renderer resolution |
|---|---|---|---|
| 16:9 1920×1080 | 1627×915 | **1627×915** | 1 |
| 16:9 1280×720 | 1085×610 | **1627×915** | 1 |
| 16:9 2560×1440 | 2169×1220 | **1627×915** | 1 |
| 16:10 1920×1200 | 1627×1017 | **1464×915** (width cropped) | 1 |
| 4:3 1600×1200 | 1356×1017 | **1220×915** (width cropped) | 1 |
| 21:9 2560×1080 | 2169×915 | **1627×686** (height cropped) | 1 |
| ultrawide 3440×1440 | 2915×1220 | **1627×681** (height cropped) | 1 |
| 16:9 1280×720, DPR 2 | 1085×610 | **1627×915** (same as DPR 1) | 2 |
| 16:9 1920×1080, DPR 2 | 1627×915 | **1627×915** (same as DPR 1) | 2 |
| ultrawide 3440×1440, DPR 2 | 2915×1220 | **1627×681** (same as DPR 1) | 2 |
| phone 390×844, DPR 2 | 459×993 | **423×915** | 2 |

- C01: both policies are served byte for byte, and server-only files still return 404.
- C02: every viewport loads both policies with no 404. `window.__cameraPolicy` and `window.TFB_TIMING` are the frozen
  policy objects, so the fallbacks are not in use.
- C03: the world container's scale equals the policy's `baseScale` at every viewport. No viewport sees more than the
  1627×915 envelope. Other aspect ratios crop one axis. DPR 2 shows exactly the world DPR 1 shows; it only raises the
  renderer resolution, which gives sharpness and no extra coverage.
- C04: every viewport sends the same message kinds, so the camera is presentation only.
- Results: **parent 1/4, Stage 3B-N 4/4** (N1 evidence; re-run on the final tree in N7). `test_3bn.js` N1 5/5 covers
  serving, privacy, byte identity and the 12-viewport policy math. `s_camera_fairness` 12/12. `s_fps_equality`:
  60/120/240/360 FPS all run exactly 60 gameplay ticks a second.

## What a player will notice

Every window now sees the same canonical slice of the world. A large or high-DPI window is sharper, not wider. An
ultrawide window crops top and bottom instead of revealing more corridor. A small 16:9 window (1280×720) now shows the
full canonical view, where before it showed less.
