# Stage 3C QA2, QA2-2: the supplied logo on a black menu

## The logo
- **The file:** `assets/MAIN_MENU_LOGO_USER_SUPPLIED.png` is the supplied file, byte for byte (SHA-256 `906e19a8…cb9cb9`, 2048 x 1152). It sits in the menu's `<h1 id="mmTitle">` with alt text "The Far Backrooms".
- **What it replaces:** QA1's CSS lettering and its soft halo behind the title are gone.
- **How it is laid out:** the image is mostly transparent, and its sign occupies a 1230 x 422 box. The title box is that sign box, centred, and the image is placed so its sign fills the box exactly.
  - The transparent surround overflows, invisible.
  - Nothing is cropped, stretched, filtered, blended or recoloured.
  - The glow is the image's own.
- **Measured** (`probe_b2`):
  - the served bytes' SHA-256;
  - the natural size;
  - the aspect ratio on screen;
  - no filter, blend or opacity change on it or any parent;
  - the sign box mapped to within 0.01 px.
- **Pixel by pixel:** the sign on screen against the file drawn on black gives a mean difference of 1.07 of 255, the same mean colour, and correlation 0.997.
- **Its sizes** keep the QA1 places: high and centred, sized by the space between the rails and above PLAY.

| Screen | Sign box on screen (CSS px) | Drawn at (device px; the sign is 1230 px in the file) |
|---|---|---|
| 1920 x 1080 | 845 x 290 | 845 |
| 1366 x 768 | 601 x 206 | 601 |
| 1280 x 720 | 563 x 193 | 563 |
| 390 x 844 phone (2x) | 335 x 115 | 671 |
| 844 x 390 phone on its side (2x) | 306 x 105 | 612 |
| 360 x 640 phone (2x) | 310 x 106 | 619 |
| 667 x 375, 640 x 360 on their side (2x) | 349 x 120, 307 x 105 | 697, 615 |

- **Sharp:** it is never drawn above its own resolution.
- **Small phones on their side:** the logo sits under the identity block, and PLAY's block narrows so the version keeps its corner.
- **Its only motion:** QA1's rare fluorescent dip, an opacity flicker of the whole image under a second, every 25 to 55 s. Reduced motion stops it.

**Note on the file itself** (`logo_alpha_comparison.png`):
- About three quarters of the sign box is almost fully transparent (alpha 1 to 31 of 255). Only the lettering is opaque.
- A browser draws it correctly, so on black the logo is the lettering with a faint warm haze.
- The bright pill-shaped sign appears only in previews that ignore transparency.
- **The user was told mid-stage.** Following the rules (exactly as supplied, no recolouring), the menu shows the browser's rendering.

## The black field
- **The scrim is opaque black and covers the whole screen.** While the main menu or anything opened from it is up (PLAY's entry, Settings, Credits, Help, Customize), the page behind is black too (`html.tfb-black`).
  - This is presentation only. The renderer, BR-RoLE, the camera and the world keep running, untouched, under the cover, as they did under QA1's translucent scrim.
- **Tried and rejected:** hiding the world's layers outright as well.
  - Under this software GPU, the browser then stops presenting the game's canvas while the game keeps drawing into it. That work piles up: a screenshot timed out, and a reload took 23 s instead of 1 s.
  - So the layers stay presented and covered.
  - The boot layer likewise leaves them presented beneath its black.
- **Measured:** on the menu, the entry, Settings, Credits, Help and Customize opened from the menu, no pixel outside the menu's own parts is brighter than 10 of 255.
- **A run** shows the world again. So does Customize opened from the pause, and the NEW RUN run menu, as before. END brings the black menu back.

## Failure
If the logo does not load, the boot stays black with "the menu artwork did not load" and RETRY. The menu never shows without its logo.

## Evidence
- `probe_b2.json` / `.log`, and `b2_*` (the screens measured).
- `captures/q2_<size>_<view>.jpg`: the menu, PLAY's entry, Settings and Customize at twelve sizes.
- `probe_b1.json` with its `boot/` sheets: the boot gate re-checked with the logo required.
