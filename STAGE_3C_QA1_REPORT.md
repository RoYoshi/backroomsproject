# Stage 3C QA1: main menu, HUD and mobile, corrected after human QA

**Status: human-QA candidate, waiting for you.** Stage 3C is not declared complete, nothing was merged to `main`, and Stage 3D was not started.

- **Branch:** `stage-3c-qa1`, from the first Stage 3C candidate `76bcc4a` (tree `d8f0949`). The accepted Stage 3B commit `6e6fa46` is an ancestor.
- **Package:** `THE_FAR_BACKROOMS_STAGE_3C_QA1_UI_REDESIGN_HUMAN_QA.zip` (the final commit, exactly), with its `.sha256` and `STAGE_3C_QA1_PACKAGE_RECEIPT.txt`.
- **What to check by hand:** `STAGE_3C_QA1_HUMAN_QA.md`, scenes A to N.

## What changed, by checkpoint

| | Commit | Tree | What |
|---|---|---|---|
| Q0 | `96f292675abc19f5cfe5ec359cf56660d70e5182` | `587f5605d79ce365ed1383082d63bf846a9ef562` | Audit and gap map (`STAGE_3C_QA1_Q0_AUDIT.md`), your rough draft kept as the reference |
| Q1 | `0f9c82141a4fc8fd5eaf374c4816b2b25662c884` | `3fba93d7a9b7c7e8ec09ce5c0d436ea941482e0d` | The main menu rebuilt from the rough draft; the main-menu theme |
| Q2 | `80b2aece9533fbfff7245741a63daf8dc7f94906` | `7f85051a5998b7f8515b811346b0f54bafe92f06` | No wanderer in the world before ENTER LEVEL 0 |
| Q3 | `d7691c4d758171b3c6bbf784e70064a114bd8b28` | `ad28c2cc57d9e71f2c8829ed2b48a2a906b94af5` | The minimal HUD, location reveals, Controls with real keybinds |
| Q4 | `6428da3c4ccf95575edcac8de4a179b03324d699` | `6dabdcb9e211a846aa59cab5e535e1598a83261f` | The touch stick, thumb-sized actions, safe areas, the installable app |
| Q5 | this commit | see the receipt | Integration fixes, the full regression on the final tree, the documents |

Each checkpoint was pushed without force and checked on GitHub (ls-remote and the REST API: commit, tree, parent). `stage-3c` and `main` were never touched.

### Q1: the main menu from your rough draft, and your theme
- **The draft's composition, with real systems only.**
  - The title is centred high, and PLAY is the largest control, low in the centre.
  - CUSTOMIZE / SETTINGS / CREDITS sit in one row under PLAY.
  - The left rail holds your identity, your light (the real loadout, drawn by the game) and the connection, counting only *other* wanderers.
  - The right rail holds Settings, Your wanderer, Sound and Help. The version is bottom right, with the wiki credit.
  - Nothing invented: no chat, friends, servers, level select, saves or CONTINUE.
- **PLAY opens the entry:** the brief, your name and light, **ENTER LEVEL 0**, Back.
  - Enter in the name field opens the entry and does not start a run.
  - A double click on PLAY cannot press ENTER.
- **Your theme.** The supplied Intro and Loop are byte-identical, and the source is kept in `audio_source/`.
  - **Playback:** the Intro once, then the Loop scheduled sample-exactly after it and looped whole, on one Web Audio clock. An offline render equals Intro + Loop + Loop sample for sample.
  - **When it starts:** only after a real press (the browser's autoplay rule). It follows SOUND ON/OFF and the master volume.
  - **When it stops:** it fades over 1 s when a run starts, and starts again from the Intro when END returns to the menu. It is silent in a hidden tab.
  - **Caching:** it is kept in Cache Storage under the files' content hashes.

### Q2: the menu is not a run
- **What was wrong:** the first candidate's first menu drew your own wanderer at the spawn with its flashlight on, behind the menu.
  - The server already kept a menu visitor out of the world: not joined, inactive, and invisible to the AI.
- **The fix:** one line in `assets/ui.js` sets the game's own hide-self state (the state END leaves you in) before the game's module runs. The game's start clears it as before.
- **What the probe shows:** before ENTER, nothing is drawn, nothing is lit, no join is sent, nothing moves, and a Hound summoned onto the spot cannot catch you. ENTER sends exactly one join. NEW RUN, END and RESPAWN behave as before.
- No gameplay, network or server file changed.

### Q3: a HUD that leaves the screen to the world
- **Calm play** shows only the world and a quiet PAUSE.
- **Stamina** appears as it is spent, turns urgent below 25, and fades 1.8 s after it is full.
- **Health:** a dormant, hidden slot with a hook for a future health system. There is no fake health.
- **The run begins with a reveal:** THRESHOLD / LEVEL 0, the objective and one line of your keys, high in the frame, fading after about 4 s.
  - New parts of the level announce their names briefly, debounced and without repeats.
  - The objective and the connection line are on the pause screen.
  - Coordinates are an option, off by default. Old saves keep everything else.
- **Settings > Controls:** real actions only, two keys each.
  - **Capture:** refused keys, conflicts with Swap, reset, and saving in `tfb.keys.v1`. Every place that names a key follows your bindings.
  - **The adapter:** it sits at the window's capture phase and is idle with the default bindings.
  - **Proof:** the same key events as the first candidate, and frame for frame the same walk, sprint (with its stamina) and crouch-walk.

### Q4: the phone
- **A floating stick replaces the D-pad.**
  - Put a thumb down anywhere low on the left; the stick reads eight ways from the game's own direction keys.
  - It has a dead zone and capped travel, and release or cancel clears the move at once.
  - Frame for frame it walks at exactly the keyboard's speed, straight, diagonal and sprinting, so there is no analog advantage.
- **The buttons:** LIGHT, INV and the camcorder buttons act on the press, so they work with a second finger while the stick is held.
- **Safe areas:** with `viewport-fit=cover` and safe-area insets, PAUSE, the buttons, the status, dialogs, sheets and the drawer stay clear of notches and home indicators.
- **An installable app:**
  - a manifest (standalone, start and scope at the game) and the iOS / Android metadata;
  - Help explains installing; no banner;
  - no service worker and no offline mode.

### Q5: integration
Running everything again, and the first candidate's own five probes, found four things, all fixed in the UI:
1. **Customize no longer filled a phone screen.**
   - **Cause:** Q4's safe-area padding on dialogs also padded the customize panel, overriding the first candidate's full-screen rule.
   - **Fix:** the customize panel now has its own safe-area rules: inset padding and a full-height card on phones, and the margin on larger touch screens.
   - The first candidate's `probe_c3` passes again.
2. **The LEVEL 0 reveal's warm glow lit the black around it.** In the blackout with the light off, it raised pixels next to the letters by up to 5 levels out of 255.
   - **Fix:** the glow is replaced by a dark shadow.
   - `probe_q5` now finds no pixel of the world brighter with the HUD shown than without it.
3. **A lone tap could act twice on a slow device.** The touch buttons swallowed the click that follows a tap only within 900 ms. Under a slow renderer that click arrived later and toggled the light or inventory back.
   - **Fix:** each touch press now arms its button for exactly one following touch click, with no timer. Clicks from a key or a mouse are never swallowed.
4. **The HUD settings preview promised more than the reveal did.** It showed LEVEL 0 in the HUD colour and size; the reveal ignored both.
   - **Fix:** the reveal now follows HUD size (within 0.8 to 1.2, so LEVEL 0 fits a phone), opacity, and a custom colour. The default look is unchanged.

## Verified on the final tree
Every check below was run on the final tree, one after another (`dev/stage-3c-qa1/evidence/q5/`).

- `probe_q1`: 26/26 pass
- `probe_q2`: 9/9 pass
- `probe_q3`: 16/16 pass
- `probe_q4`: 8/8 pass
- `probe_q5`: 5/5 pass
- `lifecycle.js` (two pages: a visitor on the menu for 8 s, a player inside, then ENTER LEVEL 0): before ENTER the visitor is not drawn, unlit, has sent 0 joins and is inactive on the server, and the player inside draws 0 avatars for it; after ENTER: 1 join, drawn and lit, active, and the player inside draws 1. As expected.
- `theme_assets_check.py`: the theme files as locked, Intro -> Loop and Loop -> Loop seams: OK

The Q5 regression list, item by item:

| Q5 regression | Result | Where (final tree) | What |
|---|---|---|---|
| First candidate: menu, customize, settings, credits, pause, run states | PASS | probe_c1 (22/23 pass, 1 superseded), probe_c2 (3 checks), probe_c3 (13/13 pass), probe_c4 (6 checks), probe_c5 (7/7 pass) | every first-candidate check passes or is a named QA1 supersession (below) |
| Exact start lifecycle | PASS | probe_q1 (2 checks), probe_q2 (4 checks) | one join per start; NEW RUN / SPAWN, END / ENTER, RESPAWN; lifecycle.js and lifecycle_mp.py below |
| No player before ENTER LEVEL 0 | PASS | probe_q2 (4 checks) | not drawn, unlit, no join, inactive on the server, cannot be caught, cannot move |
| Default keybinds are the first candidate's input | PASS | probe_q3 (2 checks) | the same events, and frame for frame the same walk, sprint and crouch-walk |
| Keybind persistence, reset, conflicts | PASS | probe_q3 (6 checks) | capture, refusal, Swap, labels, play, reload, reset, damaged save |
| Touch thumbstick | PASS | probe_q4 (3 checks) | eight ways, dead zone, cap, release / cancel, exactly the keyboard's speed |
| Simultaneous movement and action | PASS | probe_q4 (2 checks) | RUN held while steering; LIGHT tapped while steering; a lone tap acts once |
| Portrait, landscape, safe areas | PASS | probe_q4 (1 check), probe_q1 (6 checks), probe_c3 (1 check), probe_c5 (1 check) | notch and home indicator emulated; customize full-screen on phones |
| Standalone manifest | PASS | probe_q4 (2 checks) | parsed with no errors, no installability errors; browser tab unchanged |
| True-darkness HUD | PASS | probe_q5 (1 check) | stamina and the LEVEL 0 reveal brighten no pixel of the world |
| Reduced motion | PASS | probe_q1 (1 check), probe_c1 (1 check), probe_c4 (3 checks) | no entrance, no hum, no HUD fades |
| Loadout lock, peer appearance (multiplayer) | PASS | probe_c3 (3 checks) | one device per run; a second window sees your look and light |
| Multiplayer, menu and run | PASS | probe_q2 (3 checks) | a player inside counts and draws a visitor only after ENTER |
| Menu music: Intro -> Loop handoff, repeated Loop seam | PASS | probe_q1 (2 checks) | sample-exact; plus theme_assets_check.py on the files |
| Menu music: mute and master volume | PASS | probe_q1 (1 check) | 0.7 x volume; SOUND OFF -> 0 |
| Menu music: fades and stops when play begins; restarts on the menu | PASS | probe_q1 (5 checks), probe_q5 (1 check) | 1 s linear fade, sources stopped, context suspended; Intro again after END; silent in a hidden tab |
| Hidden UI does no continuous work | PASS | probe_q5 (1 check), probe_c5 (1 check), probe_q1 (1 check) | no UI animation frames on the idle menu or in calm play |
| HUD settings reach the QA1 HUD | PASS | probe_q5 (1 check) | size, opacity, colour; Reset HUD |
| Camera | PASS | dev/stage-3b-n/test_3bn.js 7/7 passed; dev/tests/s_camera_fairness.js 12/12 | camera and timing policies byte-identical |
| BR-RoLE | PASS | dev/br-role/test_br_role.js 32/32 | assets/br-role.js byte-identical; warm-up untouched |
| Retained lifecycle suite | PASS | dev/tests/lifecycle_mp.py | NEW RUN, start from the title, death -> RETRY |

## The first candidate's own probes, run on QA1
The first candidate's five browser probes (`dev/stage-3c/probe_c1..c5.js`, unchanged) were run on the final tree through adapted copies (`dev/stage-3c-qa1/first_candidate/`).
An adaptation only changes how a probe reaches something QA1 moved: PLAY is `#mmPlay`, ENTER LEVEL 0 sits in the entry PLAY opens, "Change light" is in the rail, and the title's hum replaces the fixture.

- `probe_c1`: 22/23 pass, 1 superseded by QA1 decisions
- `probe_c2`: 13/18 pass, 5 superseded by QA1 decisions
- `probe_c3`: 13/13 pass
- `probe_c4`: 10/11 pass, 1 superseded by QA1 decisions
- `probe_c5`: 7/7 pass

Each superseded check, and what QA1 decided instead:

- **probe_c1: "a HUD setting changes the model, the body class and fb_settings_v1, and switches back"** QA1 Q3: coordinates are off by default (settings v2), so the first click turns them on. The probe's own readings show the switch still drives the model, fb_settings_v1, aria-checked and the body class, and switches back. Covered by probe_q3: "fb_settings_v1 migration: ... no save: coordinates off" and "calm play shows almost only the world: ... coordinates ...".
- **probe_c2: "desktop: objective, status, key hints, location, coordinates, header and connection line are all on screen"** QA1 Q3 (the minimal HUD): calm play shows the world, stamina only while it changes, and PAUSE. The objective, LEVEL 0 and the keys are shown as a run begins and on the pause screen; the connection line on the pause screen; coordinates are an option, off by default. Covered by probe_q3: "calm play shows almost only the world ...", "as a run begins: THRESHOLD / LEVEL 0, the objective and a line of the player's keys appear, then fade away", "the pause screen keeps what left the HUD: the objective and the connection line".
- **probe_c2: "HUD size, colour, coordinates, key hints and title settings drive the new HUD (and reset)"** QA1 Q3: the probe measures the permanent objective block (gone: its height reads 0) and expects coordinates back on after Reset HUD (now off by default). The colour and the hidden switches pass in its own readings; size, opacity and colour on the QA1 HUD are checked by probe_q5. Covered by probe_q3: "fb_settings_v1 migration ..." and probe_q5: "the HUD settings still drive what the HUD shows ...".
- **probe_c2: "Night Vision Camcorder raised: the viewfinder takes over (location hidden, objective kept)"** QA1 Q3: no permanent objective in play with any device; the location stays hidden while the camcorder is raised (passes in the probe's readings), and the objective is on the pause screen and in the run-begins reveal. Covered by probe_q3: "calm play shows almost only the world ..." and "the pause screen keeps what left the HUD: the objective ...".
- **probe_c2: "touch portrait: pad, RUN, CROUCH, LIGHT and INV on screen; key hints and the Esc label hidden"** QA1 Q4: the D-pad is replaced by the floating stick (the pad is hidden, not removed). RUN, CROUCH, LIGHT and INV are on screen and the key hints hidden in the probe's readings. Covered by probe_q4: "the stick reads eight ways ... and the old pad is hidden" and "touch layouts at 360x640, 390x844 ...: buttons, PAUSE and stamina inside the safe areas ...".
- **probe_c2: "touch landscape: pad, RUN, CROUCH, LIGHT and INV on screen; key hints and the Esc label hidden"** QA1 Q4: the D-pad is replaced by the floating stick. RUN, CROUCH, LIGHT and INV are on screen and the key hints hidden in the probe's readings. Covered by probe_q4: "the stick reads eight ways ... and the old pad is hidden" and "touch layouts ... 844x390 on its side ...".
- **probe_c4: "a pre-3C fb_settings_v1 save loads unchanged, gains rm = "auto", and is written back complete"** QA1 Q3: an old save has coordinates switched off once (the old default was on) and is written back with v: 2. In the probe's readings every other field is kept, rm = "auto" is added and the save is written back. Covered by probe_q3: "fb_settings_v1 migration: an old save keeps its choices ... but loses the old coordinates default and is written back as v2".

## Performance
See `STAGE_3C_QA1_PERFORMANCE.md`. The first candidate vs QA1 on this software renderer, by mean frame interval: on desktop (two interleaved rounds, six states) -14.4 % to +5.8 %. On touch (390 x 844, measured again over three rounds with the order alternating) -7.6 % to +5.3 %. Both are within this machine's run-to-run noise.
No UI script asks for animation frames on the idle menu or during calm play.
BR-RoLE's warm-up and every graphics setting are untouched. These are not real-GPU numbers.

## Scope: what did not change
- **Byte-identical to the first candidate** (checked in the receipt, file by file):
  - the game bundle and its stylesheet, `mp.js`, `server.js`, `sim.js`, `ai.js`, `move.js`;
  - lighting (`light.js`, `assets/br-role.js`, BR-RoLE's warm-up), the camera and timing policies, the remaster;
  - `camcorder.js`, `ents.js`, `world.js` and every other gameplay file;
  - `sounds/`, and every earlier `dev/` folder.
- **Edits to existing files, each accounted for exactly in the receipt:**
  - `index.html`: markup, the manifest link and app metadata. Every first-candidate element id is kept.
  - `hud.js`: the settings model at v2, contextual stamina, the health hook.
  - `inventory.js`: three key-label hooks, text only.
  - `assets/credits_data.js`: one version field.
- **The full list:** `STAGE_3C_QA1_CHANGED_FILES.txt`.

## Known gaps and notes
- **A NEW RUN rule from before Stage 3C, found and left unchanged: the server allows one NEW RUN every 30 s.** The rule is `VANISH_CD` in `sim.js`, protected and unchanged since Stage 2.
  - **What goes wrong:** the client does not know about the limit.
    - A second NEW RUN within 30 s still plays the vanish and shows the run menu, and END shows the main menu.
    - But the server refused that vanish, and with it the leave. Your wanderer stays active in the halls while you are on the menu, until you enter again. Others see it, and the server still counts it as in the world, so the monsters can still reach it.
  - **Measured the same on the first candidate and QA1:** `dev/stage-3c-qa1/newrun_cooldown.js`, results in `evidence/q5/newrun_cooldown_*.json`.
  - **Why it is not changed:** it is a gameplay and network rule, so QA1 leaves it for your decision. `probe_q2` waits out the 30 s before its second NEW RUN; its first run on the final tree hit the rule.
  - **A UI-only fix, if you want it:** keep NEW RUN unavailable on the pause screen until the 30 s have passed, showing the seconds left. No server change is needed.
- **No app icon:** the project has no official game icon and none was drawn. iOS shows a page snapshot and Android a lettered tile. To add one:
  1. Add `assets/icon-192.png` and `assets/icon-512.png`.
  2. List them in `assets/manifest.webmanifest` `icons`.
  3. Add `<link rel="apple-touch-icon" href="./assets/icon-192.png">` to `index.html`.
- **Theme download:** 22.6 MB of WAV on the first visit after the first press. `server.js` (protected) serves them without cache headers. The player's Cache Storage keeps them for later visits.
  - A later stage could add audio cache headers, or a compressed format once gapless playback is verified with it.
- **Installing on Android** needs HTTPS (your hosted address), as Chrome requires. A plain `http://` LAN address opens as an ordinary tab.
- **Fonts in the captures:** this machine cannot reach Google Fonts, so every screenshot shows fallback faces.
- **Performance numbers** come from a software renderer and only compare QA1 with the first candidate; please judge the feel on your hardware (scene M).
- **The renderer's line-of-sight disc** may still be faintly visible behind the menu's darkening at the spawn. It is a presentation of the camera's view, not a wanderer (Q2).

## Deliverables
- `THE_FAR_BACKROOMS_STAGE_3C_QA1_UI_REDESIGN_HUMAN_QA.zip` and `.zip.sha256`, and `STAGE_3C_QA1_PACKAGE_RECEIPT.txt`.
- In the repository and the ZIP:
  - `STAGE_3C_QA1_REPORT.md` (this file), `STAGE_3C_QA1_HUMAN_QA.md`, `STAGE_3C_QA1_PERFORMANCE.md`, `STAGE_3C_QA1_CHANGED_FILES.txt`, `STAGE_3C_QA1_Q0_AUDIT.md`;
  - `STAGE_3C_QA1_MENU_COMPARISON.jpg` (rough draft, first candidate and QA1 side by side).
- **Evidence:** `dev/stage-3c-qa1/evidence/q0` to `q5`.
  - **Final checks:** `q5/` (probe JSON and logs, the first candidate's probes, lifecycle, camera, BR-RoLE, theme files, performance).
  - **Captures:** `q5/captures/`: menu and entry at ten sizes, the HUD on desktop and phones, touch play in portrait and on its side, and true darkness.
  - **PWA evidence:** `probe_q4` (manifest parsed with no errors and no installability errors).

**STAGE 3C UI QA1 HUMAN-QA CANDIDATE — WAITING FOR USER**
