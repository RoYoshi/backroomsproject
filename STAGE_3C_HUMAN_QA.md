# Stage 3C: the main menu, the HUD, customize and settings

**Status: `STAGE 3C UI HUMAN-QA CANDIDATE — WAITING FOR USER`**

This is the UI pass on top of the accepted Stage 3B. The world, the lighting, the camera, the monsters, movement and the network are untouched; everything here is the game's menus and on-screen readouts.

- **Branch:** `stage-3c`. It starts from the accepted Stage 3B commit `6e6fa46`, and `main` is untouched. The final commit and every checkpoint are in `STAGE_3C_PACKAGE_RECEIPT.txt`.
- **To start:** run `run_linux.sh` or `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000>. For a second wanderer, open a second window with the same `?room=NAME`.
- **Fonts:** the menus are set in Barlow Condensed and IBM Plex Mono, which the game loads from Google Fonts. The screenshots in `dev/stage-3c/evidence/` were taken where those fonts could not load, so their headings are wider than what you will see. The title is sized so it fits either way.

## What to look at

Each scene lists what to do, then what should happen. Tick it, or note what looks wrong and where.

### A. Boot: the game's main menu
1. Open the game.
   - It lands on the main menu, not on the old floating panel: a flickering fluorescent tube over **THE FAR BACKROOMS**, the list **PLAY / CUSTOMIZE / SETTINGS / CREDITS**, and the Level 0 entry panel beside it.
   - The world is visible, darkened, behind the menu. The entrance runs once: the tube lights, then the title, the list and the panel. After that the only motion is the slow haze and a rare soft dip in the tube. There is no strobe.
2. Hover and use the arrow keys on the list.
   - Each item lifts slightly; the arrows move between items; Enter or Space opens one.
3. Check the bottom corners.
   - The Backrooms Wiki / CC BY-SA line is bottom left. The game's own connection line (SOLO, or ONLINE with the room and the real wanderer count) is bottom right.
   - There is no CONTINUE, no account, no cloud save, no level select and no invented player count.

### B. Play flow
1. Type a name and look at the **Loadout** row.
   - It shows the device you have equipped, drawn by the game's own painter, with a one-line description. **Change** opens Customize on the Loadout tab.
2. Press **ENTER LEVEL 0** (or Enter in the name field).
   - One run starts, with your name on the nameplate. The name is remembered for next time.

### C. HUD in normal Level 0
- **Top left:** the **objective**, and under it the connection line.
- **Bottom left:** name, stance (STANDING / WALKING / RUNNING / CROUCHED...), the stamina bar and number, and the light (FLASHLIGHT ON / OFF; the camcorder shows RAISED / LOWERED). Under that, the key hints, which fade after a while.
- **Top right:** **Pause** (with its Esc key) and Sound; under them THRESHOLD / LEVEL 0 / sector.
- **Bottom right:** the coordinates.
- **Check:** the centre of the screen is clear; run until stamina drops (amber, then red) and toggle the light. The readouts change in place with a short crossfade and never cover the world.

### D. HUD in true darkness
- Walk into the BLACKOUT ZONE with the light off.
- **Check:** the world stays truly black, and every readout stays readable. The blackout warning appears top centre (a red rule, never flashing).

### E. Customize: WANDERER
Open it from the menu's **CUSTOMIZE**, or from the pause screen.
- A live preview of your wanderer (round body, two round hands, no limbs) sits beside **Body colour** and **Hand colour** (swatches plus Custom), **Texture** and **Hat**.
- **Check:** every choice shows in the preview at once and is saved. There is no backpack anywhere.
- **If you had a backpack saved before**, it is simply gone. Nothing else in your look changes.

### F. Customize: LOADOUT
- **The four devices:** Flashlight, Headlamp, Lantern, Night Vision Camcorder. Choosing one shows its close-up, its parts and their colours, and (except for the camcorder) the beam colour.
- **Camcorder wording:** with the camcorder chosen, the note reads "Night Vision Camcorder emits no visible light; its night vision uses infrared."
- **One device per run:** during a run (pause, then Customize, then Loadout) the cards are locked with a note. Your look can still change. After being caught, **CHANGE LOADOUT** opens this tab unlocked, as before.
- **Two windows in one room:** the other wanderer sees your hat, texture, colours, device and beam colour.

### G. Settings
Open it from the menu or from the pause screen.
- **Sound:**
  - the sound switch and master volume.
- **HUD:**
  - colour (swatches or custom), size and opacity, with a live preview line;
  - key hints and their fading, coordinates, and the level / sector title;
  - Reset HUD.
- **Display:**
  - Lighting and shadows: Low / Medium / High, BR-RoLE's own tiers. Every tier lights the same places; higher draws them more finely. Your choice is remembered.
  - Reduced motion: System / On / Off.
- **Controls:**
  - keyboard and touch.
- **Check:**
  - your old HUD colour, size, opacity, toggles and volume from before Stage 3C are all still there;
  - each control does what it says;
  - nothing here changes the camera or what you can see.

### H. Pause, caught, run menu, win
- **Pause** (Esc or the Pause button): CONTINUE EXPLORING, Settings, Customize and NEW RUN on the left, the controls reference on the right, and the wiki credit. Online, the note says the halls do not stop.
- **Caught:** a red rule, the game's own title and advice, RESPAWN and CHANGE LOADOUT.
- **NEW RUN:** after the fade, the run menu offers SPAWN, CUSTOMIZE and END. END returns to the main menu.
- **Win:** LEVEL 1 COMING SOON and RESTART LEVEL 0.
- **Check:** each button does exactly what it did before. Tab moves between a panel's buttons (it no longer opens the inventory behind the pause screen), and Esc closes what is on top.

### I. Credits
- The page is built from `assets/credits_data.js`. Edit that file to add people; sections left empty are not shown.
- **Check:**
  - it lists Created by (RoYoshi), the source material (The Backrooms Wiki, CC BY-SA 3.0, with links), PixiJS and the two typefaces;
  - Close and Esc return to where you were.

### J. Responsive and touch
- **Phone (portrait or landscape):**
  - the menu becomes a two-by-two list above the PLAY panel; on a phone held sideways, PLAY and ENTER stay on the first screen;
  - Settings and Customize fill the screen.
- **During play on touch:**
  - the pad is bottom left; LIGHT, INV, RUN and CROUCH are bottom right, plus NV, IR and ZOOM with the camcorder;
  - PAUSE is top right, and the HUD is compact at the top.
- **Check:** nothing is clipped or overlapping.

### K. Performance
- **Check:** with every menu closed, Level 0 should feel exactly as it did in Stage 3B.
  - The customize preview only draws while Customize is open. Before, it drew all the time.
  - No menu does any work while hidden.
  - The main menu's motion is CSS only.
- **Numbers:** in `STAGE_3C_PERFORMANCE.md`. They come from software rendering, so only the comparison with Stage 3B means anything; please judge the feel on your own hardware.

## Known limits (not changed in this pass)
- **Hidden old text:** the game bundle still has its old hidden one-line device description ("No light at all..."). It is never shown, because the loadout cards replace it.
- **Sound on touch:** on narrow and touch screens the Sound button moves into Settings, to keep the top of the screen clear.
- **A rare pause unpause:** online, a monster that catches you while the pause screen is open still ends the pause to play the death, as before.
