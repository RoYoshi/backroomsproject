# Stage 3C QA2: main-menu branding, black background, boot asset gate

QA2 makes your QA1 review decisions and your continuation requirement, and nothing else:
1. **Your logo is the main-menu title.** It is your PNG, byte for byte, never redrawn, recoloured, stretched or cropped.
2. **The menu stands on pure black.** No Level 0 shows behind it or behind anything opened from it.
3. **The page is black until everything the menu needs is ready**, your theme included.
4. **The menu starts as one event.** Your logo powers on first, like a fluorescent tube, and the theme's Intro starts in that same step. Then the rest of the menu arrives in order.
   - Where the browser wants a gesture first, a small black "press any key / click / tap to enter" line waits for it.
5. **Returning from a run:** the game's sound and the world fade down to black, the run's own END completes, and the menu returns the same way (logo and Intro first, then the rest).

Everything QA1 built keeps working, and the receipt proves file by file what did not change:
- the pre-run no-Wanderer state, PLAY's entry, the minimal HUD, keybinds, the touch stick, the installable app, Customize, Credits and Pause;
- Level 0, BR-RoLE, the camera, monsters, movement and the network.

- **Branch:** `stage-3c-qa2`, from QA1's final `5f30e28` (tree `374911e`). `stage-3c-qa1`, `stage-3c` and `main` are untouched.
- **Final commit and tree:** in `STAGE_3C_QA2_PACKAGE_RECEIPT.txt`.
- **What to check by hand:** `STAGE_3C_QA2_HUMAN_QA.md`, scenes A to J.

## Checkpoints

| Checkpoint | Commit | Tree |
|---|---|---|
| QA2-0 safety and audit | `839910fc7e4eb775aaec4d8f8c9216bb4e908a1c` | `3e17f5d8b96d8d8f9794c3c3f4804b67f03d773a` |
| QA2-1 the boot gate | `663bc4891d0c475a4cabff439c4e1cf42f3a817c` | `1c66b55077b329b3e4bf20967a651ed88e03fe67` |
| QA2-2 the logo on black | `3af362ec2aa5c2c2c4d3f2c1f849fffa28034d2d` | `4907dd44e29b44d449aaddd5a19b6885d00ef292` |
| QA2-3 the menu and its music together | `a85c51e4606abe491d2855259a39277f333a298c` | `04a055071851d459b2ba5a1c1f7b17f8a083bd3b` |
| QA2-4 preservation (stopped part-way, by request) | `48bcbe265cc25c655d57bab9c19c4798565054ac` | `9ab30d0e30b7c92186a4fb42a7d1bacd47a6db96` |
| R1 the logo-first entrance and the run return | `06d7ae7a4ba08d0abb9b4b2b616647c2e4ad4a3b` | `98536dbc6196efa16291140b63b25dc013a1f083` |
| R3 final validation, documents | in the receipt | in the receipt |

- **Each checkpoint was verified after its push:** the commit, the tree, the parent and every other branch unchanged on GitHub (`dev/stage-3c-qa2/evidence/*/remote_*.json`).
- **The resume check:** when this continuation started, GitHub briefly reported `stage-3c-qa2` as missing. With your approval it was pointed at exactly `48bcbe2` again (an ordinary push, never forced), and it verified as that commit and tree before any work.

## What changed

### QA2-0 to QA2-3
These are detailed in `STAGE_3C_QA2_Q0_AUDIT.md` and `dev/stage-3c-qa2/evidence/q1`-`q3/QA2_*_NOTES.md`.
- **The boot gate:**
  - inline black-first rules and boot states at the top of `index.html`;
  - every required piece awaited as a promise: both stylesheets, the credits, your logo decoded, the menu music downloaded and decoded, the game runtime, and the fonts (capped at 2.5 s);
  - a restrained black error with RETRY that names the failed piece;
  - no fake progress, though a slow first music download states the real megabytes received.
- **Your logo on an opaque black menu field.** The world keeps running underneath, covered: presentation only.
- **Ready:** where sound is allowed, the menu and the Intro start together. Otherwise the black ready gate waits for a key, click or tap, which starts both; system keys pass it by, and the press never reaches the menu.
- **The theme's life is QA1's:**
  - the Intro, then the Loop, sample-accurate;
  - continuous through every menu page;
  - SOUND and the master volume control it;
  - a hidden tab is silent;
  - ENTER fades it over 1 s;
  - it restarts from the Intro on the menu.
- **ENTER LEVEL 0 passes through a black curtain** to the world.

### QA2-4 (preserved at `48bcbe2`)
- The title box clips the logo's fully transparent surround, which had given the phone menu 84 px of sideways overflow. No visible pixel of the file lies outside the box.
- The regression harness for the older probes, the performance and packaging tools, and the draft documents.

### R1: your continuation requirement (`dev/stage-3c-qa2/evidence/r1/R1_NOTES.md`)
**The entrance** happens on the first load and on every return:
1. On the black field, the logo powers on first: `mmIgnite`, 0.6 s of opacity only, stuttering on like a tube striking.
2. The theme's Intro starts in the same step, measured within 10 ms of it.
3. Then the rest arrives:

   | Part | Delay |
   |---|---|
   | LEVEL 0 / THRESHOLD | 0.20 s |
   | PLAY | 0.26 s |
   | CUSTOMIZE / SETTINGS / CREDITS | 0.40 s |
   | the left rail | 0.52 s |
   | the right rail | 0.60 s |
   | the footer | 0.72 s |

4. It is settled about 1.2 s after ignition.
- It uses one-shot opacity and translate animations, removed at 1.8 s, so an idle menu runs nothing.
- **Reduced motion keeps the same order** with short plain fades and no flicker.

**The return (END in the run menu):**
1. The press is held back.
2. Over 0.8 s (0.25 s with reduced motion), two things fade together:
   - the black boot layer fades in over the run menu and the world;
   - the game's own local master output (its hum, threats, footsteps and effects) ramps to 0.
3. On full black, the game's own END handler runs, unchanged. The game's audio context stays suspended while you are on the menu.
4. The entrance follows, with the Intro restarted.
5. The next ENTER restores the game's output to its own level (0.14 x the master volume).

Only that local output is touched. AI hearing, reported movement noise, server sound evidence, networking and the run's lifecycle are the game's: during a return only routine position packets were sent.

## Verified on the final source tree

| Check | Result |
|---|---|
| `probe_b1` boot gate: black first paint, cold / warm / 4 Mbit/s frame by frame, states, failures with RETRY, reduced motion, the reveal settling (R1) | 13/13 PASS |
| `probe_b2` logo identity, no alteration, pixel match (mean diff about 1 of 255), black field on every menu page, run boundary, END back to the black menu, layouts at 8 sizes (R1) | 10/10 PASS |
| `probe_b3` the gate, both entrances, END's return, ENTER through black, and the theme's whole life (detailed below) | 28/28 PASS |
| The older probes re-run on QA2 through adapted copies (`regress/`): QA1's five probes and `lifecycle.js`, the first candidate's five probes, the retained `lifecycle_mp.py` | CLEAN: every check passes or is a listed supersession or a timing artifact shown on QA1 (below) |
| Camera (`test_3bn.js`) | 7/7 PASS |
| Camera fairness | 12/12 PASS |
| BR-RoLE unit checks | 32/32 PASS |
| Theme files (SHA-256 as locked, Intro -> Loop and Loop seams) | 8/8 PASS |

`probe_b3` covers:
- **The gate:** key, click and tap; Escape and the modifiers ignored; the press never reaching the menu.
- **Both entrances:** logo first, the theme within 50 ms, the locked order, reduced motion.
- **END's return:** frames before -> dim -> black -> the menu; the game's sound ramped and suspended; nothing about the run sent; the next ENTER restoring the sound.
- **ENTER through black:** frames before -> black -> dim -> lit world.
- **The theme's life:** the direct path, Cache Storage, sample-exact seams, SOUND and volume, a hidden tab, every menu page, the 1 s ENTER fade, the END restart.
- **Failures and edge cases:** a missing or short music file, a slow first download, no Web Audio, a scripted run before the reveal.

**R1 and R2 ran on the final source:**
- `probe_b1`, `probe_b2` and `probe_b3` (`evidence/r1`); after them only the reduced-motion entrance delays were retuned, and `probe_b3` was re-run on that.
- The adapted logo-layout probe (QA1 `probe_q1` 24/26) and the phone-overflow probe (first candidate `probe_c1` 22/23) (`evidence/r2`).

**R3 ran everything else once, with time limits** (`dev/stage-3c-qa2/run_final_checks.sh`, `evidence/r3`). The source has not changed since R1.

**The older probes on QA2** (`evidence/r3/regress/regression.json`):
- **Results:** QA1 `probe_q1` 24/26, `probe_q2` 9/9, `probe_q3` 15/15, `probe_q4` 7/8, `probe_q5` 5/5, `lifecycle.js` 1/1; first candidate `probe_c1` 22/23, `probe_c2` 13/18, `probe_c3` 13/13, `probe_c4` 10/11, `probe_c5` 7/7; `lifecycle_mp.py` 1/1.
- **How they run:** the copies differ from the unchanged originals only where QA2 moved something:
  - the helpers pass the boot and its gate by one key press, as a player would, and let the entrance play out;
  - two probes read your logo instead of QA1's text title;
  - the first candidate's END check waits for the new return instead of a fixed 0.9 s.
  - Every assertion is unchanged.
- **Superseded by QA2 decisions** (each with the QA2 check that covers it):
  - `probe_q1`'s "no audio context and no theme request before any press";
  - "a run straight from ENTER loads no theme".
  - The first candidate's 7 checks that QA1 had superseded keep QA1's reasons.
- **Two timing-sensitive QA1 assertions fail on QA1 too** under this software renderer. They were compared directly; each is listed with its evidence, and neither is a QA2 change:
  - **`probe_q3`: "the LEVEL 0 reveal is gone after about 6 s".** QA1's own probe failed it 2 of 3 times on QA1, and the QA2 copy 2 of 3 (`evidence/q4/q3_timing/`). It passed in R3.
  - **`probe_q4`: "the stick walks at exactly the keyboard's speed, and no attempt faster".** QA1's own probe failed it in both comparison runs on QA1. Run 2 failed on a left-stick reading of 3.009143 against the key's 2.865811: the very reading the QA2 copy failed on in R3. The QA2 copy passed in its comparison run (`evidence/r3/q4_compare/`). QA1 Q5 had already added retries for this artifact.
  - Movement, input and the stick are unchanged.

## Performance
`STAGE_3C_QA2_PERFORMANCE.md` has the details. All of it is a software renderer on 2 CPUs; only QA1 against QA2 means anything.
- **Menu and play:** QA2 is QA1's cost within noise, over four desktop and two phone rounds, interleaved.
  - Desktop play: +3.3 %, +4.3 % and -2.5 % (lit standing, walking, dark). Phone play: -20.7 %, -12.2 % and +2.8 %.
  - The UI scripts' JavaScript stays at 0.01-0.12 ms per frame.
  - The menu idles as cheaply as QA1's or more so, and runs no UI animation once its entrance is over.
- **The black ready gate is virtually free:** 0.013 ms of UI JavaScript per frame, and no animation of its own.
- **Starts:** QA2 paints black first (0.5-0.9 s). Its menu and music start together at a median of 8.4 s cold here (6.7-10.0) and 4.0 s warm (1.3-6.6).
  - The cold time is almost all the 22.6 MB theme download and decode.
  - QA1 painted its menu sooner, but played no music until a press, plus another 5.5-6.3 s.

## Scope: what did not change
- **Edited:** the shipped changes are only `assets/ui.js`, `assets/ui.css`, the accounted `index.html` edit and the new logo file.
- **`index.html`:** the receipt proves it is QA1's file plus exactly:
  - the boot block;
  - the root element's boot classes;
  - the boot layer;
  - the title's lettering replaced by your logo.
- **Byte-identical to QA1:**
  - the game bundle, `mp.js` and `server.js`;
  - `hud.js` and `inventory.js`;
  - the credits data and the manifest;
  - the theme audio;
  - every gameplay, AI, movement, collision, network, camera, lighting (BR-RoLE), night-vision and remaster file;
  - every earlier `dev/` folder.

## Known gaps and notes
- **Your logo is transparent where a preview may show a plate.**
  - About three quarters of the sign's box has alpha 1 to 31. A browser therefore draws the lettering with a faint warm haze, not the bright pill some image viewers show when they ignore transparency (`dev/stage-3c-qa2/evidence/q2/logo_alpha_comparison.png`).
  - The rules forbid recolouring, so a plate would have to be in the image itself.
- **The first visit waits for 22.6 MB of WAV:** about 4 s at 50 Mbit/s, 18 s at 10 Mbit/s, and 52 s measured at 4 Mbit/s. A line with the real megabytes shows during the wait.
  - Later visits read it from Cache Storage (https or localhost).
  - **A compressed playback copy** (your WAVs kept as masters) would cut the wait about tenfold. The theme files were locked for QA2, so that is your decision.
- **Warm starts vary here** (1.2-6.6 s): reading and decoding the music competes with the software renderer. A GPU machine should be far quicker.
- **Chrome's console warning** "The AudioContext was not allowed to start" appears when the gate is needed. It is the page asking the browser, not an error.
- **The black stays longer in the evidence:** the ENTER curtain and END's fade are well under a second on a GPU; the software renderer's lagging frames stretch them to several seconds in the screencasts.
- **Out of scope, unchanged:** the server's 30 s NEW RUN cooldown.
- **No app icon yet:** the supplied logo is a menu logo, not an icon.
- **Fonts in the captures:** this machine cannot reach Google Fonts, so every capture shows fallback faces.

## Deliverables
- `THE_FAR_BACKROOMS_STAGE_3C_QA2_MENU_BOOT_BRANDING_HUMAN_QA.zip` and `.zip.sha256`, and `STAGE_3C_QA2_PACKAGE_RECEIPT.txt`.
- In the repository and the ZIP:
  - `STAGE_3C_QA2_REPORT.md` (this file), `STAGE_3C_QA2_HUMAN_QA.md`, `STAGE_3C_QA2_PERFORMANCE.md`, `STAGE_3C_QA2_CHANGED_FILES.txt`, `STAGE_3C_QA2_Q0_AUDIT.md`;
  - `STAGE_3C_QA2_MENU_COMPARISON.jpg` (QA1 and QA2: desktop, phone, phone on its side).
- **Screenshots and evidence** (`dev/stage-3c-qa2/evidence/`):
  - **cold start and the ready gate:** `r3/boot/boot_*_sheet.jpg` (the gate path on desktop and phone, the direct path, cold and warm, frame by frame), `r1/b3/b3_gate_1280x720.png`, `r1/b3/b3_gate_390x844.png`, `r1/b1/`;
  - **menus:** `r3/captures/r3_1920x1080_menu.jpg`, `r3_390x844m_menu.jpg`, `r3_844x390m_menu.jpg` and nine more sizes, with PLAY's entry, Settings and Customize;
  - **the run transition and the return:** `r1/b3/b3_enter_sheet.jpg` (ENTER: menu -> black -> world) and `r1/b3/b3_end_sheet.jpg` (END: the run menu fading -> black -> logo first -> the rest);
  - **the theme's start and seams:** `r1/probe_b3.json` (`firstEntrance`, `returnEntrance`, `afterKey`, `offline`), `r3/theme_assets.json`;
  - **history:** `q4/PRESERVATION_NOTES.md` (the stopped QA2-4 run) and `q4/q3_timing/`.

**STAGE 3C UI QA2 HUMAN-QA CANDIDATE — WAITING FOR USER**
