# Stage 3C QA1: what to check by hand

**Status: `STAGE 3C UI QA1 HUMAN-QA CANDIDATE — WAITING FOR USER`**

QA1 corrects the first Stage 3C candidate from your review:
- the main menu rebuilt from your rough draft, with your main-menu theme;
- no wanderer in the world before ENTER LEVEL 0;
- a HUD that leaves the screen to the world;
- Controls with real keybinds;
- a touch stick and an installable app.

The world, lighting (BR-RoLE), camera, monsters, movement, collision and the network are unchanged; the receipt proves it file by file.

- **Branch:** `stage-3c-qa1`, from the first candidate `76bcc4a`. `stage-3c` and `main` are untouched. Commits and trees are in `STAGE_3C_QA1_PACKAGE_RECEIPT.txt`.
- **To start:** run `run_linux.sh` or `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000>. For a second wanderer, open a second window with the same `?room=NAME`.
- **On a phone:** open the game from your computer's address on the same network, or from your hosted address. Installing it as an app (scene K) needs the hosted HTTPS address; Android will not install from a plain `http://` LAN address.
- **Fonts:** the screenshots in `dev/stage-3c-qa1/evidence/` use fallback fonts, because the machine that took them cannot reach Google Fonts. Your browser loads Barlow Condensed and IBM Plex Mono, so headings will look narrower and crisper than in the captures.
- **Theme download:** the theme is 22.6 MB of WAV. The first visit downloads it after your first press on the menu; later visits play it from the browser's cache.

Each scene lists what to do, then what should happen. Tick it, or note what looks wrong and where.

## A. Main menu, desktop
Open `STAGE_3C_QA1_MENU_COMPARISON.jpg` beside the game: your rough draft, the first candidate and QA1.
- **Title:** **THE FAR / BACKROOMS** is centred high, lit like the fixtures. About every 25 to 55 s it dips for under a second.
- **PLAY:** the biggest control on the screen, low in the centre, under `LEVEL 0  THRESHOLD`. **CUSTOMIZE / SETTINGS / CREDITS** sit in one row under it.
- **Left rail** (your draft's tall rail):
  - your name on a small glyph in your wanderer's colours;
  - **Your light**: the device you have equipped, drawn by the game, with **Change light**;
  - the connection: the room, ONLINE / CONNECTING / SOLO, and how many *other* wanderers are inside.
- **Right rail:** Settings, Your wanderer, Sound, Help. On a wide screen each shows its name on hover.
- **Bottom:** the Backrooms Wiki / CC BY-SA credit, and the version bottom right.
- **Check:** there is no chat, friends list, server browser, level select, saves, CONTINUE, account or timer. Nothing moves on an idle menu after the entrance, apart from the title's rare dip.

## B. Main menu, phone
Portrait (around 390 x 844), on its side, and a small phone (360 x 640) if you have one.
- **Portrait:** identity top left, the four rail buttons top right, the title, then PLAY low with the row under it.
- **On its side:** the rail buttons run along the top, and the title moves under your name so nothing collides.
- **Check:** nothing is cut off, nothing scrolls sideways, every button is thumb-sized, and it reads as a phone layout, not a squeezed desktop.

## C. Menu idle: you are not in the world yet
1. Open window A and stay on the menu.
2. Open window B with the same `?room=`, and enter Level 0 there.
- **Window B:** shows **1 WANDERER** and draws no one at the spawn.
- **Window A:** its menu says one other wanderer is in the halls. Behind the menu, the spawn is dark: no wanderer and no flashlight. The faint disc of the renderer's line of sight may still show under the darkening.
- **Check:** hold W / D / Shift on menu A. Nothing moves and no stamina is spent. A monster in B's halls cannot catch window A.

## D. ENTER LEVEL 0
1. Press **PLAY**. The entry replaces it: Level 0's brief, your name (Rename), your light (Change), **ENTER LEVEL 0**, Back, and one line of advice.
   - **Escape** or **Back** close the entry. **Enter in the name field** opens it; it does not start a run.
   - A double click on PLAY does not fall through onto ENTER.
2. Press **ENTER LEVEL 0**.
   - One run starts. Window B now shows 2 wanderers and draws you with your light.
   - The music fades out over a second.
   - **THRESHOLD / LEVEL 0** rises high in the frame with the objective and one line of your keys, then fades after about 4 s.
   - **Check:** the centre stays clear.

## E. Normal walking
- **Check:** the screen is almost only the world, with **PAUSE** quiet in the top right. There is no frame of readouts round the edges:
  - no name, pace or light state;
  - no key strip, objective, LEVEL 0 corner or connection line;
  - no Sound button and no coordinates.
- **Walk into another part of the level:**
  - its name (for example `01 / YELLOW HALL`) shows small and high, then fades;
  - walking along a border does not make it flicker;
  - connecting passages are not announced.

## F. Sprint and recovery
1. Hold Shift and run.
   - **STAMINA** and a thin bar appear bottom left (top left on a phone) as soon as stamina is spent.
   - Below a quarter, the bar turns the danger colour and thickens.
2. Stop.
   - The bar refills. About 1.8 s after it is full it fades away.

## G. True darkness
Walk into the BLACKOUT ZONE and switch your light off. Then sprint so stamina shows, and start a new run to see LEVEL 0 again in the dark if you like.
- **Check:** the world stays truly black, and stamina and the reveal stay readable.
- **No glow:** neither adds a halo or glow around itself; only a soft darkening behind the words. This was measured pixel by pixel (`probe_q5`).

## H. Objective and events
- **Where the objective is now:**
  - **As a run begins:** in the reveal (scene D).
  - **On the pause screen:** under **Objective**, with the connection line.
- **Check:** it is never on screen as permanent prose during play.
- **Unchanged from the first candidate:** picking something up still shows the game's FOUND toast, which names your own keys, and the encounter and blackout hints still appear when they should.

## I. Settings and keybinds
Open **Settings > Controls** (also from the pause screen's **Change keys**).
1. **Rebind:** click a slot, press a key.
   - The slot says "Press a key" first, and Esc cancels.
   - Esc, F1 to F12, Ctrl, Alt, Meta and other system keys are refused, with a reason.
2. **Conflict:** pick a key another action already uses.
   - The conflict is named and nothing changes until you choose **Swap** or Cancel.
3. **Labels:** with Move up on another key, every place that names it shows the new key:
   - the pause list;
   - the menu entry's line;
   - Help;
   - the run-begins key line;
   - the camcorder's viewfinder line and Customize's camcorder note;
   - the inventory.
4. **Play with it:** the new key walks exactly as W did, and W no longer moves you. The arrows still work, since they are the second key.
5. **Persistence:** reload. The bindings stay.
6. **Reset:** **Reset controls to defaults** brings everything back.
7. **Typing:** type your name on the menu with WASD letters. Nobody moves.
- **Settings > HUD:**
  - Location reveals, Key reminder, and Coordinates (off by default);
  - colour, size and opacity, which now reach stamina and the location name.
- **An old save:** your previous HUD choices are kept, except coordinates, which are switched off once.

## J. Phone stick
Start a run on a phone.
1. Put a thumb down anywhere low on the left. The stick appears under it.
2. Drag. You move in eight directions, at exactly the keyboard's speed; diagonals are not faster.
3. Lift. You stop at once.
4. **Two thumbs:**
   - hold the stick and tap **LIGHT** with the other thumb. The light toggles once and you keep moving;
   - hold **RUN** while steering: you sprint.
- **Buttons:**
  - RUN, CROUCH, LIGHT and INV sit on the right;
  - NV, IR and ZOOM join them with the camcorder.
- **Check:** nothing overlaps.

## K. Phone as an app
- **iPhone / iPad (Safari):** Share > Add to Home Screen.
- **Android (Chrome):** menu > Install app, or Add to Home screen. Where Chrome offers it, Help shows an **Install** button.
- **Launch from the home screen:**
  - it opens without the browser bar (standalone);
  - nothing hides under the notch, the rounded corners or the home indicator, in portrait or on its side;
  - Help (the "i" on the menu) says it is running as an app.
- **In an ordinary browser tab:** everything still works, with no banner and no nagging. Help explains how to install.
- **Known gap: no icon yet.** iOS shows a picture of the page and Android a lettered tile. To add the real icon:
  1. Put `assets/icon-192.png` and `assets/icon-512.png` in the project.
  2. List them in `assets/manifest.webmanifest` `icons`.
  3. Add `<link rel="apple-touch-icon" href="./assets/icon-192.png">` to `index.html`.

## L. Customize, loadout, credits, pause
This is the first candidate's behaviour, kept.
- **Customize (WANDERER):**
  - body and hand colours, texture and hat, previewed live and saved;
  - no backpack anywhere;
  - it fills a phone screen.
- **LOADOUT:**
  - Flashlight, Headlamp, Lantern and Night Vision Camcorder;
  - the camcorder note: "emits no visible light; its night vision uses infrared";
  - during a run the device is locked, but your look can change;
  - after being caught, **CHANGE LOADOUT** unlocks it as before.
- **A second window** sees your look and light.
- **Credits:** built from `assets/credits_data.js`; nothing is invented.
- **Pause:** CONTINUE, Settings, Customize, NEW RUN (run menu: SPAWN / CUSTOMIZE / END), and the objective and connection.
  - Escape works in order: it closes a sheet, then customize, then resumes.
- **Known, unchanged from the first candidate:** the server allows one NEW RUN every 30 s.
  - A second NEW RUN sooner still looks like it worked, but the server keeps your wanderer standing in the halls (others see it) until you enter again.
  - The report explains this, and the small fix you can choose.

## M. Performance
- **Idle main menu:** after the entrance there is no animation and no UI frame loop. The view of Level 0 behind it is the game's own renderer, as in the first candidate.
- **Calm play with every menu closed:** the UI asks for no frames.
- **Phone play:** the stick works from pointer events and runs no loop.
- **Check:** on your own hardware, the menu and play should feel as smooth as the first candidate. The measured numbers come from a software renderer and only compare the two builds (`STAGE_3C_QA1_PERFORMANCE.md`).

## N. Main menu music
Use headphones.
1. Load the page. The music does not start by itself (the browser's autoplay rule).
2. Make your first press on the menu (PLAY, a row item, a rail button). The **Intro** starts. On a first visit over a slow connection it waits for the download to finish.
3. When the Intro ends, the **Loop** takes over.
   - **Check:** no gap, no click, no restart. Let the loop come round at least twice: there is no silent tail and no hard cut.
4. **Sound** on the menu's rail (or Settings > Sound) mutes and unmutes it.
5. Master volume changes its level.
6. Settings, Credits, Help, PLAY's entry and Customize keep it playing without a restart.
7. Switching to another tab silences it; coming back carries on where it was.
8. **ENTER LEVEL 0** fades it out over a second. The run and the run menu are silent of it.
9. **END** from the run menu brings back the main menu, and the Intro starts again.
