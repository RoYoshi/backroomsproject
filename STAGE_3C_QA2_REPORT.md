# Stage 3C QA2: main-menu branding, black background, boot asset gate

> **DRAFT - QA2-4 work in progress (preservation checkpoint).** This is not the final QA2 report and not a human-QA candidate.
> The QA2-4 final checks were stopped part-way (see `dev/stage-3c-qa2/evidence/q4/PRESERVATION_NOTES.md`). Every `FINAL_*` placeholder below
> is still unmeasured, and the package does not exist yet.

QA2 makes your three QA1 review decisions, and nothing else:
1. **Your logo is the main-menu title.** It is your PNG, byte for byte, never redrawn, recoloured, stretched or cropped.
2. **The menu stands on pure black.** No Level 0 shows behind it or behind anything opened from it.
3. **The page is black until everything the menu needs is ready.** The menu and its theme then start as one event:
   - at once where the browser lets sound start;
   - otherwise on the first key, click or tap at a small black "press any key / tap to enter" line.

Everything QA1 built keeps working, and the receipt proves file by file what did not change:
- the pre-run no-Wanderer state, PLAY's entry, the minimal HUD, keybinds, the touch stick, the installable app, Customize, Credits and Pause;
- Level 0, BR-RoLE, the camera, monsters, movement and the network.

- **Branch:** `stage-3c-qa2`, from QA1's final commit `5f30e28` (tree `374911e`). `stage-3c-qa1`, `stage-3c` and `main` are untouched.
- **Final commit and tree:** in `STAGE_3C_QA2_PACKAGE_RECEIPT.txt`.
- **What to check by hand:** `STAGE_3C_QA2_HUMAN_QA.md`, scenes A to J.

## What changed, by checkpoint

| Checkpoint | Commit | Tree |
|---|---|---|
| QA2-0 safety and audit | `839910fc7e4eb775aaec4d8f8c9216bb4e908a1c` | `3e17f5d8b96d8d8f9794c3c3f4804b67f03d773a` |
| QA2-1 the boot gate | `663bc4891d0c475a4cabff439c4e1cf42f3a817c` | `1c66b55077b329b3e4bf20967a651ed88e03fe67` |
| QA2-2 the logo on black | `3af362ec2aa5c2c2c4d3f2c1f849fffa28034d2d` | `4907dd44e29b44d449aaddd5a19b6885d00ef292` |
| QA2-3 the menu and its music together | `a85c51e4606abe491d2855259a39277f333a298c` | `04a055071851d459b2ba5a1c1f7b17f8a083bd3b` |
| QA2-4 integration, regression, package | in the receipt | in the receipt |

Each checkpoint was pushed and verified on GitHub (commit, tree, parent, every other branch unchanged): `dev/stage-3c-qa2/evidence/q*/remote_qa2_*.json`.

### QA2-0: safety and audit (`STAGE_3C_QA2_Q0_AUDIT.md`)
- **Parent and pack:** the parent and the pack were verified, and the branch was created from exactly `5f30e28`.
- **The logo:** opened and measured. It is transparent around a 1230 x 422 sign, and most of that sign is itself almost fully transparent.
- **QA1's start, recorded frame by frame:**
  - the whole menu painted before the scripts;
  - then QA1's staggered entrance assembling it over about 3 s;
  - the world showing through the translucent scrim;
  - the theme only after a first press.
  - These are the flashes QA2 removes.

### QA2-1: the boot gate
- **A few inline rules and a small script at the top of `index.html`** (before every stylesheet) make the first paint black.
  - Nothing but the black boot layer can show until `assets/ui.js` reveals the menu.
  - The world's layers stay presented underneath. Hiding them made the software renderer pile up work: a reload took 23 s instead of 1.
- **`ui.js` waits for what the menu needs, each as a promise:** both stylesheets, the credits data, the game's runtime, and the fonts (never more than 2.5 s). QA2-2 adds the logo and QA2-3 the music.
  - It then lays the menu out underneath, draws two frames, and reveals the menu whole in one short fade.
  - QA1's staggered entrance is gone.
- **No progress theatre:** no percentage and no timer. A quiet "Loading" appears only after about a second.
- **If a required piece fails, the page stays black** with "The game could not start: *the interface / the credits / the menu artwork / the menu music / the game* did not load. Check your connection, then try again." and a RETRY button.
  - If `ui.js` itself never starts, a 5 s watchdog shows the same message.

### QA2-2: the supplied logo on a black menu
- **The logo:** `assets/MAIN_MENU_LOGO_USER_SUPPLIED.png` is your file, byte for byte (SHA-256 `906e19a8…`).
  - The title box is the sign's own 1230 x 422 box. Every pixel of the file that is not fully transparent lies inside it.
  - The image is placed so the sign fills the box exactly (measured to 0.01 px).
  - On screen it matches the file drawn on black pixel for pixel: mean difference 1.07 of 255, correlation 0.997.
- **The black field:** the menu's scrim is opaque black, and the page behind the menu is black.
  - This covers the menu and everything opened from it: PLAY's entry, Settings, Credits, Help and Customize.
  - Measured: no pixel outside the menu's own parts is brighter than 10 of 255.
  - It is presentation only: Level 0, BR-RoLE and the camera keep running as before, covered.
  - A run, Customize from the pause and the run menu show the world as before.
- **Layout:** the logo is fitted to every QA1 breakpoint (desktop to 640 x 360) without collisions, and QA1's hierarchy is unchanged.

### QA2-3: the menu and its music start together
- **The theme is a required boot piece.** Both files are read from Cache Storage (after the first visit) or downloaded, then decoded once per page in an OfflineAudioContext, which needs no gesture, during the black boot.
  - A first download still running after 3 s shows the real bytes that have arrived.
- **At "ready":**
  - **Where the browser lets sound start,** the menu is revealed and the Intro begins in the same step.
  - **Otherwise there is a black ready gate** with one line: "PRESS ANY KEY OR CLICK TO ENTER", or "TAP TO ENTER" on a touch-only screen.
    - The first key, click or tap anywhere starts the Intro and reveals the menu in that input's own handler.
    - System and browser keys pass the gate by: Escape, Tab, modifiers, F-keys and shortcuts.
    - The entering press never reaches the menu or the game: a click on PLAY's spot opens nothing.
- **Playback is QA1's:**
  - the Intro once, then the Loop sample-accurately, looping;
  - continuous through every menu page;
  - SOUND and the master volume control it;
  - a hidden tab is silent and carries on;
  - ENTER LEVEL 0 fades it out over 1 s;
  - END restarts it from the Intro without downloading again.
- **ENTER LEVEL 0 from the menu passes through black.** The boot layer becomes a curtain that never takes the pointer. The run's first frames are drawn under it, and it fades to the world: no logo over gameplay, and no half-made world frame.

### QA2-4: integration
- **The logo's clipping:** the logo's fully transparent surround is now clipped by the title box. Before, its invisible box gave the menu 84 px of horizontal overflow on a phone. This was found by the first candidate's own phone check.
- **The run-before-reveal case:** a run started by a script before the reveal (older test harnesses do this; a player cannot) is never covered by the boot layer or a gate.
- **Boot timings:** each boot piece's ready time is recorded (`__ui.boot().done`).
- **Final checks:** every check below was run on the final tree (`dev/stage-3c-qa2/run_final_checks.sh`).

## Verified on the final tree
(`dev/stage-3c-qa2/evidence/q4/`)

| Check | Result |
|---|---|
| `probe_b1` the boot gate (black first paint, cold / warm / 4 Mbit/s frame by frame, the states, failures with RETRY, reduced motion) | FINAL_B1 |
| `probe_b2` the logo (identity, no alteration, pixel match), the black field, the run boundary, layouts at 8 sizes | FINAL_B2 |
| `probe_b3` the ready gate, key / click / tap, the direct path, Cache Storage, seams, the theme's life, ENTER frame by frame, END, failures, slow first download, no Web Audio, scripted run | FINAL_B3 |
| QA1's five probes, `lifecycle.js`, the first candidate's five probes and `lifecycle_mp.py`, re-run on QA2 (`regress/`) | FINAL_REG |
| camera (`test_3bn.js`), camera fairness, BR-RoLE unit checks, theme files and seams | FINAL_SUITES |

**The older probes on QA2:**
- **Adapted copies:** they run unchanged, through adapted copies that differ in where their helpers come from. Those helpers pass the boot and its ready gate by one key press, as a player would, before the probe acts.
- **The logo adaptations:** three copies read the title from the logo instead of QA1's text lettering.
- **Superseded checks:** each is listed with the QA2 decision and the QA2 check that covers the new behaviour (`regress/regression.json`). They are QA1's own expectations of the old start:
  - no theme request and no audio context before the first press;
  - nothing loaded when a run starts straight from ENTER.
- The first candidate's checks that QA1 had already superseded keep QA1's reasons.

FINAL_REG_NOTES

## Performance
`STAGE_3C_QA2_PERFORMANCE.md` has the details. All of it is a software renderer on 2 CPUs, so only QA1 against QA2 means anything.
- **On the menu and in play:** QA2 is QA1's cost, within measurement noise, interleaved over the same states. This covers the menu idle, Settings, Customize, and Level 0 lit (standing and walking) and dark.
- **The ready gate costs what the menu does:** the world drawing beneath, and no UI script work or animation of its own.
- **Starts:** FINAL_PERF_STARTS

## Scope: what did not change
- **Edited:** only `assets/ui.js` and `assets/ui.css`, the accounted `index.html` edit and the new logo file are shipped changes.
- **`index.html`:** the receipt proves it is QA1's file plus exactly four edits:
  - the boot block;
  - the root element's boot classes;
  - the boot layer;
  - the title's lettering replaced by the logo.
- **Byte-identical to QA1:**
  - the game bundle, `mp.js` and `server.js`;
  - `hud.js` (the settings model) and `inventory.js`;
  - the credits data and the manifest;
  - the theme audio;
  - every gameplay, AI, movement, collision, network, camera, lighting (BR-RoLE), night-vision and remaster file;
  - every earlier `dev/` folder.

## Known gaps and notes
- **The logo is transparent where a preview may show a plate.**
  - About three quarters of the sign's box has alpha 1 to 31. A browser therefore draws the lettering with a faint warm haze, not the bright pill some image viewers show when they ignore transparency (`dev/stage-3c-qa2/evidence/q2/logo_alpha_comparison.png`).
  - The rules forbid recolouring, so the menu shows the file as it is. A plate would have to be in the image itself.
- **The first visit waits for 22.6 MB of WAV.** Your decision 3 made the theme part of the boot, and the theme files are locked.
  - At 4 Mbit/s that was about 52 s of black (with the real-bytes line). At 10 Mbit/s it would be about 18 s, and at 50 Mbit/s about 4 s.
  - Later visits read it from Cache Storage, which needs https or localhost.
  - **A compressed playback copy** (your WAVs kept as masters) would cut the wait about tenfold. That is your call.
  - **Gzip does not help:** `server.js` (protected) already serves the WAVs gzipped, which saves only about 3 %.
- **The warm start is dominated here by reading and decoding the music** (FINAL_WARM_RANGE, varying with how busy the software renderer is). On a GPU machine it should be well under that.
- **Chrome's console warning** "The AudioContext was not allowed to start" appears when the gate is needed. It is how the page learns that the browser wants a gesture; it is not an error.
- **The curtain at ENTER** is two frames and 180 ms of black plus a 0.42 s fade, about 0.6 s on a GPU. Under the software renderer the first run frames are slow, so the black lasts several seconds in the evidence.
- **Out of scope, unchanged:** the server's 30 s NEW RUN cooldown (as in QA1).
- **No app icon yet:** the supplied logo is a menu logo, not an icon.
- **Fonts in the captures:** this machine cannot reach Google Fonts, so every screenshot shows fallback faces.

## Deliverables
- `THE_FAR_BACKROOMS_STAGE_3C_QA2_MENU_BOOT_BRANDING_HUMAN_QA.zip` and `.zip.sha256`, and `STAGE_3C_QA2_PACKAGE_RECEIPT.txt`.
- In the repository and the ZIP:
  - `STAGE_3C_QA2_REPORT.md` (this file), `STAGE_3C_QA2_HUMAN_QA.md`, `STAGE_3C_QA2_PERFORMANCE.md`, `STAGE_3C_QA2_CHANGED_FILES.txt`, `STAGE_3C_QA2_Q0_AUDIT.md`;
  - `STAGE_3C_QA2_MENU_COMPARISON.jpg` (QA1 and QA2, desktop and phones).
- **Evidence** (`dev/stage-3c-qa2/evidence/`):
  - `q0/` QA1's start recorded;
  - `q1/` the boot gate;
  - `q2/` the logo and the black field;
  - `q3/` the gate, the music and the run curtain;
  - `q4/` the final checks.
- **Screenshots and frame sheets:**
  - **cold start:** `q4/boot/boot_*_cold_sheet.jpg`, `q4/b1/b1_*_sheet.jpg`;
  - **ready gate:** `q4/b3/b3_gate_1280x720.png`, `q4/b3/b3_gate_390x844.png`;
  - **menus:** `q4/captures/q4_1920x1080_menu.jpg`, `q4_390x844m_menu.jpg`, `q4_844x390m_menu.jpg` and nine more sizes;
  - **run transition:** `q4/b3/b3_enter_sheet.jpg`;
  - **theme start and seams:** `q4/probe_b3.json` (notes `afterKey`, `offline`).

_(Draft: the closing status line is written only when QA2-4 is complete.)_
