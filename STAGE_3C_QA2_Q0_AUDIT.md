# Stage 3C QA2, QA2-0: safety check and boot audit

**Scope:** the menu, the boot and the branding only. Three corrections from your QA1 review:
1. the supplied logo;
2. a black menu field;
3. a black boot gate that reveals the menu and starts its theme as one event.

Nothing else from QA1 is reopened.

## 1. Parent and branches (verified)

- **The pack:** `THE_FAR_BACKROOMS_STAGE_3C_QA2_MENU_BOOT_BRANDING_MASTER_PACK.zip` has SHA-256 `6305b380…bf17`, matching its `.sha256`. Every file matches `PACK_SHA256SUMS.txt`. The master prompt inside the pack is identical to the one attached.
- **QA1 on GitHub:** `stage-3c-qa1` is `5f30e28532200bca52b57a112c6691498a263e92`. The REST API gives tree `374911e01e2a66706a3938fcd2f7495ee4133a49` and parent `561d218`.
  - The QA1 package's SHA-256 is `a9333624…4939b`, as recorded by its receipt.
- **Untouched branches:** `main` is `7781e1a` and `stage-3c` is `76bcc4a`. There was no `stage-3c-qa2` on the remote.
  - Every remote head before QA2 is recorded in `dev/stage-3c-qa2/evidence/q0/remote_heads_before_qa2.json`, 19 branches. `verify_remote_qa2.py` checks them after every push.
- **The new branch:** `stage-3c-qa2` was created locally from exactly `5f30e28`. The first Stage 3C candidate `76bcc4a` and the accepted Stage 3B `6e6fa46` are ancestors.

## 2. The supplied logo (`visual_reference/MAIN_MENU_LOGO_USER_SUPPLIED.png`, opened and inspected)

- **The file:**
  - 2048 x 1152 RGBA, 814,957 bytes, SHA-256 `906e19a8…cb9cb9`, as the authority file states;
  - no colour profile, no gamma chunk.
- **The picture:** a glowing white and yellow fluorescent sign, a pill with a pixel-stepped glowing outline, with grey lettering on two lines, **THE FAR** / **BACKROOMS**.
- **The space around the sign is fully transparent**, not black: alpha 0 and RGB 0 outside the sign.
  - The sign and its glow occupy x 409 to 1638 and y 410 to 831, a 1230 x 422 box, slightly below the image's centre.
  - The glow is semi-transparent: about 400,000 pixels have alpha 1 to 31. Over a black field it reads exactly as in the pack.
- **Consequence for layout:**
  - The PNG is shipped byte-identical.
  - The menu sizes the image by its sign, not by its canvas: the image is placed so the 1230 x 422 sign box fills the title area, and the transparent margin overflows invisibly.
  - Nothing visible is cropped, scaled unevenly, recoloured or filtered.
  - The transparent margins must not catch clicks (`pointer-events: none`).
- **Not an app icon:** the PWA icon gap stays separate.

## 3. What the player sees while QA1 starts (measured: `dev/stage-3c-qa2/boot_capture.js` + `boot_sheet.py`)

Chromium's screencast recorded every composited frame from the moment of navigation, at 1280 x 720 (sheets in `evidence/q0/`).

| | Cold, local | Warm, local (same profile) | Cold, 1.5 Mbps |
|---|---|---|---|
| First paint of the page | 1.32 s | 2.57 s | 1.04 s |
| Scripts done (DOMContentLoaded; the game API is ready at the same moment) | 0.94 s | 2.40 s | 3.04 s |
| What the first paint shows | the **whole QA1 menu, static**, over the dim world | the same | the same, painted **before the scripts arrive** |
| Then | the menu vanishes (the entrance animation starts from zero) and **assembles piece by piece**: the title flickers on, PLAY rises, the rails fade in. It is complete at about 4.1 s | the same, complete at about 3.9 s | it vanishes at 2.3 s (the scripts ran) and assembles until about 8 s; the light's picture (drawn by the game's painter) pops in last |

The first recorded frame (white) belongs to the previous page (`about:blank`): a browser keeps showing the old page until the new one first paints.

**Flash risks found:**

1. **The menu at first paint.** The stylesheets block rendering, so the first paint is styled, but it is the *finished* menu, painted before `ui.js` runs. On a slow link the HTML and CSS arrive well before the scripts, so the player sees a frozen menu for seconds.
2. **The QA1 entrance.** It hides that menu again and builds it up over about 3 s: the "assembling in front of the player" the user rejected.
3. **The world behind the menu.**
   - The menu's scrim is translucent (`#060504a8` to `f7`), so Level 0 and its light show through.
   - The game's root background is `#514521` (the bundle stylesheet), a yellow-brown wash anywhere nothing covers it.
4. **Late pieces.**
   - The light's picture in the rail is drawn only once the game's gear exists.
   - The fonts come from Google Fonts with `display=swap`, so preferred faces can replace the fallback after the first paint.
   - QA2 adds the logo image (815 KB PNG). Without a gate it would pop in after the controls.
5. **Theme timing.**
   - QA1 creates nothing and fetches nothing until the first press on the menu. The 22.6 MB of WAV is then fetched (served `no-store`; QA1 keeps it in Cache Storage on secure origins) and decoded, and the Intro starts.
   - So the music always begins seconds *after* the menu appeared, and only after a press.

## 4. The audio graph and the browser's rule

- **QA1's theme graph:**
  - its own `AudioContext` (44.1 kHz, `latencyHint: playback`) and gain (0.7 x master volume, 0 when the game's SOUND is off);
  - the Intro at t0 and the Loop at t0 + Intro length, looping its whole buffer, sample-exact.
  - The game's own audio graph exists only once a run starts. QA2 keeps both as they are.
- **The game's SOUND state is not saved:** every load starts with sound on (the bundle keeps `muted` in memory only).
- **The browser's rule, measured in headless Chromium:**
  - **Default policy:** an `AudioContext` created by page script with no user gesture starts `suspended`. `resume()` waits for a gesture, and Chromium logs a console *warning* ("The AudioContext was not allowed to start").
  - **With `--autoplay-policy=no-user-gesture-required`** (standing in for a browser that allows sound, such as a site with high media engagement): it starts `running`.
  - **Decoding** needs no gesture: `OfflineAudioContext.decodeAudioData` decodes during preload with no warning, and the decoded buffers play in the real context.
- **A testing trap:** Playwright's `page.evaluate` runs with a user gesture, so it grants the page user activation and unlocks audio. QA2 probes must read the page before the gate through CDP `Runtime.evaluate` with `userGesture: false`, as `boot_capture.js` does.

## 5. The smallest safe implementation

**QA2-1, the boot gate:**
- `index.html`:
  - a few lines of inline CSS in `<head>`, before the external stylesheets: black page, and a full-screen black `#boot` layer above everything;
  - `<html class="tfb-boot">`, so nothing else in the page is visible while it is set;
  - `#boot` is the body's first child.
- **A tiny inline boot script:**
  - the state names;
  - a watchdog, so a missing `ui.js` still ends in a restrained error with RETRY, not an endless black screen.
- **`assets/ui.js` gathers the required pieces as promises:**
  - both stylesheets present;
  - the credits data;
  - the game API, so PLAY can enter its flow;
  - the fonts, waited for but capped, so a dead font server cannot hang the game;
  - later the logo decoded and the theme decoded.
- **Then, and only then:** it lays the menu out underneath, waits two frames, and reveals the whole menu in one short fade.
- **No timers pretending to load and no percentages.** A quiet "Loading" appears only if loading takes more than a moment.
- **Any required failure:** a black screen naming what failed, with RETRY.

**QA2-2, the logo and the black menu:**
- The PNG is shipped byte-identical as `assets/MAIN_MENU_LOGO_USER_SUPPLIED.png` and placed in `#mmTitle` (an `<img>` with alt text), sized by its sign box.
- `.mm-scrim` becomes solid black.
- While the main menu (or anything opened from it) is up, the world's canvases are hidden. This is presentation only: the renderer, BR-RoLE, the camera and the world are untouched.
- The QA1 rails, PLAY row, LEVEL 0 line and footer keep their places.

**QA2-3, music and menu as one event:**
- The theme's Intro and Loop are fetched (Cache Storage first) and decoded during the preload.
- At READY: if the browser lets sound start, the menu is revealed and the Intro starts in the same step.
- If the browser needs a gesture, a small "click or press any key" (on touch, "tap to enter") waits on black. The first key, click or tap starts the Intro and reveals the menu together.
- **ENTER LEVEL 0:**
  - the theme fades over 1 s, as in QA1;
  - a black curtain covers the switch from the menu to the world;
  - the curtain lifts only after the run's first frames have been drawn.
- **END** returns to the black menu, and the Intro starts again.

**Untouched:**
- the bundle, `mp.js`, `server.js` and every gameplay, lighting, camera, AI and movement file;
- the theme files' bytes;
- every QA1 system (the no-wanderer gate, the HUD, keybinds, stick, PWA, Customize, Credits, Pause).
- The server's NEW RUN cooldown recorded in QA1 is out of scope and stays as it is.

## Evidence (`dev/stage-3c-qa2/evidence/q0/`)
- `qa1_desktop_cold_sheet.jpg`, `qa1_desktop_warm_sheet.jpg`, `qa1_slow_cold_sheet.jpg`: the frames where the picture changed.
- The matching `.json` files hold every frame's time and non-black share, and the page's marks. The individual frames are not kept.
- `remote_heads_before_qa2.json`.
