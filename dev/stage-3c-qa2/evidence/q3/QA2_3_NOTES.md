# Stage 3C QA2, QA2-3: the menu and its music start together

## What a player sees
1. **Black, then (if it takes a while) "Loading".** While the page gathers what the menu needs, the screen is black. The quiet "Loading" line appears only after about a second.
2. **A first download says how far it has got.** The menu music is now one of the things the menu waits for. On a first visit it is 22.6 MB of PCM (the user's files, unchanged; served uncached), so on a slow link this is the longest wait.
   - After 3 s of downloading, a second line says how much has arrived: "Downloading the menu music (first visit only): 4.2 of 22.6 MB".
   - These are real bytes, rewritten at most twice a second, with no percentage.
   - "(first visit only)" is shown only where the browser can keep the files: Cache Storage, which needs https or localhost.
3. **Ready.** Everything is there: both stylesheets, the credits, the logo decoded, both music files downloaded and decoded, the game runtime, and the fonts (or 2.5 s of waiting for them).
   - **If the browser lets sound start** (some browsers on a returning visit, or a site the person has interacted with), the menu is revealed and the Intro begins in the same step. There is no gate.
   - **If the browser wants a gesture first** (most first visits), the screen stays black with one small line:
     - "PRESS ANY KEY OR CLICK TO ENTER" on a desktop;
     - "TAP TO ENTER" on a touch-only screen.
4. **The first key, click or tap anywhere** makes the line vanish, starts the Intro and fades the menu in from black, all in that one input's handler.
   - System and browser keys pass the gate by (Escape, Tab, the modifiers, F-keys, Ctrl / Alt / Cmd shortcuts).
   - The key that enters never reaches the menu or the game.
   - A click or tap right where PLAY will be opens nothing: the black layer takes the pointer until it has gone.
5. **ENTER LEVEL 0.** The music fades over 1 s, as in QA1. The screen goes black (the same boot layer, as a curtain that never takes the pointer), the run's first frames are drawn under it, and it fades to the world after two frames and 180 ms.
6. **END.** The black menu comes back, and the music starts again from the Intro.

## How
- **Its own graph, as in QA1.** The theme still has its own small Web Audio graph; the game's audio graph is created only when the run starts.
- **Decoded without a gesture.** The two files are fetched (Cache Storage first) and decoded in an OfflineAudioContext, which needs no gesture, during the black boot. They are decoded once per page and kept for the page's life, so END reuses them.
- **Asking the browser.** At "ready" the real AudioContext is created:
  - `navigator.getAutoplayPolicy` decides where the browser has it;
  - otherwise the context's own state decides (running, or still suspended 150 ms after `resume()`).
  - Chromium logs "The AudioContext was not allowed to start" when this happens without a gesture. That is a console warning, not an error, and it is expected.
- **No race with an early press.** The gate's listeners are armed at "ready", before that question is asked, so a press during the check counts.
- **The fade.** The boot layer's lines are hidden at once, then its black fades.
  - Two inherited button styles had to be switched off on the gate's line: the game's `button { transition: all .2s }`, which kept it visible through the fade, and a backdrop blur.
- **Failures.** A music file missing, a download that stops sending data for 20 s, or a file that arrives short is the boot's error: "the menu music did not load", with RETRY.
- **No Web Audio at all.** The menu comes up silent, without a gate.
- **A run started by a script before the reveal** (older test harnesses click ENTER through code; a player cannot reach it): the boot layer acts as that run's curtain and then leaves for good. No gate appears over the run.

## Measured (`probe_b3.json`, `probe_b1.json`, `boot/boot_starts.json`; SwiftShader, 2 CPUs, localhost)

| Start | Ready (music decoded) | Menu + Intro |
|---|---|---|
| Direct path (sound allowed), cold | 6.0 s | 6.0 s |
| Direct path, warm (Cache Storage) | 1.2 s | 1.2 s |
| Gate path, cold | 8.5 s | the press |
| 4 Mbit/s, cold, gate path | 52.3 s | the press (the gate line was up at 52.7 s) |

- **Cold starts are dominated by the music.** On the cold path, 22.6 MB is read and decoded under the software renderer while the world draws beneath the black layer.
- **Seams** (offline render through the player's scheduling, as in QA1): Intro -> Loop and two Loop seams equal the files sample for sample. Each seam's jump (0.0033 RMS) is half the local sample-to-sample motion (0.0063).
- **The theme's life:**
  - 0.7 x master volume; SOUND OFF -> 0;
  - continuous through Settings, Credits, Help, PLAY's entry and Customize;
  - a hidden tab suspends it and it carries on;
  - ENTER: a 1 s fade, then stopped and suspended;
  - END: a new start from the Intro, with no download.

## Evidence
- `probe_b3.json` / `.log` (21 checks, all pass). Screenshots:
  - `b3_gate_1280x720.png`, `b3_gate_390x844.png`: the ready gate;
  - `b3_slow_first_download.png`: the note on a slow first download;
  - `b3_error_music.png`: the music error;
  - `b3_enter_sheet.jpg`: ENTER LEVEL 0 frame by frame (menu -> black -> world);
  - `b3_after_end_1280x720.png`: the black menu after END.
- `probe_b1.json` / `.log`: the boot gate re-checked with the music required (all pass). It includes `boot/b1_*_sheet.jpg`, `boot/b1_*_frames.json`, and the cold, warm and 4 Mbit/s starts frame by frame.
- `boot/boot_*_sheet.jpg` and `boot/boot_starts.json` (`capture_boot.js`):
  - the gate path on a desktop (cold, warm) and on a phone (tap);
  - the direct path (cold, warm).
  - These times include the screencast's own load and vary by seconds; `perf_start_qa2.js` (QA2-4) measures starts without it.
- `b2/`: `probe_b2` (the logo and the black field, QA2-2) re-run on this build: all pass. Its run screenshot now waits for the curtain to lift.
