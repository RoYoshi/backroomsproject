# STAGE 3H ENGINE MODERNIZATION — FINAL HUMAN QA PENDING

**Only the owner can accept this build.** It is a candidate, not a release.

- Nothing is merged, deployed or promoted.
- `main`, the accepted B++ (`143b63f`), the frozen Stage 3H2 (`22751bb`) and M8 (`c34f0c2`) are unchanged.

**What changed since M8, which you said plays the same:**
- **The compiled client** (the game's core: the map, the camera, the local loop, the lights, the deaths, the HUD's game side) is now
  built from readable TypeScript. The 40 edits made to its minified file since v11 are now source, and the page is served that build
  (continuation C4).
- **Level 0's map and the carried lights** are now one definition, as data, read by the server and built into the client (C4c).
- **The server's simulation, the WebSocket session and six of the page's scripts** are now organized as modules, by owner, with explicit
  boundaries (C2, C3).

**What must not change:** anything a player sees, hears or feels.

The machine checks compared this build with B++ and with M8 directly, and found no difference in behaviour:
- the rebuilt client against the shipped program, statement by statement (195 of its 197 top-level statements directly, the other
  2 through every read and write of them), and nine scenes frame by frame in a real Chromium page (the randomness, the game state,
  the document, every canvas and audio call, the pixels, the styles);
- the same messages and server traces;
- the same results from the sim, and the same level, cell by cell;
- the same pixels in 23 contact-lab images;
- two real Chromium players whose every WebSocket frame has the same structure.

Those checks ran headless, with a software renderer (SwiftShader), on a 2-CPU machine. **This page is the part only a person can
judge:** real hardware, a real GPU, real sound, real players. It concentrates on what was rebuilt. `docs/architecture/PARITY_MATRIX.md`
lists what the machines cover.

## Set up an A/B comparison

1. **The candidate.**
   - Get it from the branch `stage-3h-engine-modernization` at the commit named in the delivery, or from the ZIP.
   - Run `ADMIN_PASSCODE=<a test passcode of yours> node server.js 8000` and open `http://localhost:8000`.
2. **M8, beside it.**
   - Run `git worktree add ../m8 c34f0c22bbacc5ac2813d173bc0591b67af7169f` (or download that commit from GitHub).
   - Then `cd ../m8 && ADMIN_PASSCODE=<the same> node server.js 8001`.
   - M8's compiled client is B++'s, byte for byte. B++ (`143b63f`) works the same way, if you prefer the original reference.
   - Never mix files from two folders.
3. **Run each scene twice:** M8 first, then the candidate, on the same machine, browser, window size and graphics setting. Use
   headphones and a real GPU if you can. Settings are saved per address, so set the same options on both ports.
4. **Note** the machine, the browser, the devicePixelRatio, the graphics tier and the number of players.

## Checklist: what was rebuilt, and where a mistake would show

### The compiled client (C4: built from TypeScript since C4b)

- [ ] **The title, the menus and customize.**
  - The title screen and its music; the SOUND ON / SOUND OFF button keeps its frosted look (finding M-031 was about it).
  - The play menu, the name, Enter. Customize: hat, texture, colours and backpack in the preview.
- [ ] **Walking and stamina** (lineage step B02).
  - The pace label (STANDING, WALKING, RUNNING, CROUCHED, CRAWLING, SLIDING, WINDED, DOWN) and the stamina bar: a sprint drains it,
    rest refills it, and WINDED slows you as on M8.
  - The DEEP CARPET is slower underfoot. Footsteps sound like carpet, concrete or wet tile, by the room.
- [ ] **Level 0 itself** (B02; one definition since C4c).
  - Walk through the twelve rooms. The BLACKOUT ZONE, the RED ROOMS, the DEEP CARPET and the DAMP ROOMS are tinted; the ARCH GALLERY
    has its arches, the PILLAR HALL its pillars, the LONG ROOM its pits.
  - The walls, doorways and pits block and let you through where they did. You start where you did.
  - Blackouts come and go on the same rhythm (the first after about 36 s in a world).
  - With the cartograph picked up, the map (M) shows the same plan.
- [ ] **The carried lights** (B10, B11).
  - Flashlight, headlamp (on the head, under a cap, a beanie or a hard hat), lantern (all around) and camcorder (night vision, no
    light): each lights and looks as on M8, in your hand and in another player's.
  - The loadout screen (TAB): the parts and colours of each light.
- [ ] **Captures, from the victim's side** (B07, B14 to B18).
  - A Hound's capture and a Smiler's: the sounds, the struggle, the death sequence, the camera, the body left behind.
  - RETRY's fall back into the world.
- [ ] **NEW RUN's vanish and fall** (B12).
  - The light left on the floor where you vanished, the run menu, the fall into a new run and the landing.
- [ ] **Shadows at wall corners** (B28 to B30: BR-RoLE's corner receivers).
  - Walk along walls and round corners near a lamp, with and without your light: the shadows meet the corners as on M8.
- [ ] **The camera** (B22, B26).
  - How much of the world a screen shows, at two or three window sizes and on a phone.
- [ ] **Its speed.** The client is the same program, minified again: the frame rate on your machines matches M8's (the machine
  measurement, `bundle_perf.js`, is in the report).

### What was rebuilt before (C2, C3), checked again on this build

- [ ] **Joining, the session and the admin login** (moved out of `server.js`, C2).
  - Open two or three tabs in one room, close one, and reopen it. Each player appears, leaves and comes back as on M8.
  - The menu says Online and the room. Pause a run (Esc): the status line at the top says ONLINE · ROOM …, the count of wanderers and
    SHARED MONSTERS (and ADMIN once unlocked).
  - Restart the server while a tab is open. The menu says Reconnecting (the paused status line, SOLO · RECONNECTING), then Online again.
  - In the admin panel (the backquote key), a wrong passcode says WRONG PASSCODE. Repeated wrong ones end in TOO MANY TRIES · WAIT …S,
    which refuses even the right passcode until the wait is over. After the wait, the right passcode unlocks it.
- [ ] **Monsters and the world** (the server's simulation, C3a; its level from the one definition since C4c).
  - Hounds hunt, chase, lose you and capture as on M8. Smilers do the same.
  - The cartograph item and its pick-up work.
  - The glitched walls (the exit) work, and so do the blackout and lamp failures.
  - From the admin panel, try freeze, speed, blackout, summon and spawn monsters, bring, goto and god mode, and a world reset. Each
    does what it does on M8.
- [ ] **Movement and the camcorder** (C3b).
  - Walk, run, crouch, crawl, slide and vault. Stamina, winded and resting feel the same.
  - Other players block you head-on and slide past at the shoulder.
  - The camcorder's night vision, infrared LOW and HIGH, overheating and its lockout, and zoom look and sound the same.
- [ ] **Hounds, Smilers and deaths on screen** (C3b).
  - Their look, glow, attack poses and voices are as on M8.
  - Each death variant plays as on M8: Hound A THROAT, B DRAGGED, C WALL SLAM and D EXHAUSTED; Smiler A RUSH, B CORNERED, C LIGHT
    FAILURE and D PLAYED WITH (the admin's death lab plays each one on you).
  - The AI debug overlay (admin, debug tab) shows the same panels.
- [ ] **Other players** (`mp.js`, C3c).
  - Poses are smooth, with lights, looks and gear.
  - The name appears when you hover a player with the mouse, with · DEAD for a dead one.
  - A player who reloads, or whose connection drops, comes back cleanly.
- [ ] **NEW RUN** (C3c).
  - One press gives one approved, instant gib: the fragments, the corpse, the blood, the gear and the dying light match on both
    screens.
  - A second press within 30 s is refused, with its words.
  - The run menu's words are right.
  - The admin's UNLIMITED NEW RUN still works.
- [ ] **Deaths and bodies** (C3c).
  - A normal death plays as horror, not as a NEW RUN.
  - Your own corpse, the replays on other screens, the dying lights and the wall stains are as on M8.
  - A third player who joins late sees the earlier bodies.
  - An admin world reset during a death clears the replays and lights everywhere.
  - Respawn follows the usual rules.
- [ ] **The admin panel** (C3c).
  - Every tab works: the player list, the debug tab, the deaths tab (LAST NEW RUN), the death lab and its replay.
  - PLACE ME FIRST (OPEN ROOM, NEAR A WALL, IN A CORNER) and the debug tab's ME → DOORWAY, PILLAR, CORNER, OPEN ROOM and CRAWLSPACE
    move you to such a spot, away from glitched walls and lamps (CRAWLSPACE: to the nearest crawlspace's way in). GLITCHED WALLS · GO TO
    NEAREST takes you to a glitched wall.
  - COPY REPORT says REPORT COPIED TO THE CLIPBOARD, or COULD NOT COPY: CLIPBOARD BLOCKED when the browser refuses.
  - Messages to players arrive.
- [ ] **Solo.** With the server stopped (or the page opened offline), the cartograph, the glitched walls, the hum and the dread work as
      on M8.
- [ ] **Sound, on headphones.**
  - The hum's position and distance, the crackles of a flickering fixture, and the blackout's silence and return are as on M8.
  - The dread, the heartbeat, the deaths, the steps and the voices are as on M8.
- [ ] **A phone.**
  - The touch stick, the RUN, CROUCH, LIGHT and INV buttons, and the camcorder's buttons work.
  - The installed app (PWA) opens the game.
- [ ] **Performance.** The frame rate on your machines matches M8's, alone and with three or more players.
- [ ] **Developers (optional).**
  - Follow `docs/development/QUICKSTART.md` on a fresh clone: `npm run build:check` passes, and `node dev/tools/checks/dev_workflow.js`
    passes.
  - With the 31 locked packages (`TFB_V11_LINUX_X64_PACKAGES.zip`, extracted): `node dev/tools/build/client.js --packages <folder>
    --check` builds the compiled client from its TypeScript and compares it with the served files and their record.
  - Using `docs/architecture/FRAMEWORKS.md`, find in a few minutes where a Hound is drawn, where NEW RUN is approved, where the admin
    login is checked, and how Level 0's map is changed.

## Verdict (the owner's only)

- **PASS / ACCEPT.** Name the commit and tree you accept. Nothing is merged automatically.
- **NEEDS CHANGES.** Record the scene, the player, the browser, the time, your sound equipment, and what differs from M8. The fix is
  made on this branch, never over an accepted checkpoint.
- **ROLL BACK.** Use M8 `c34f0c22bbacc5ac2813d173bc0591b67af7169f`, the frozen 3H2 `22751bbc39c91f3e54e3305638b2ef2c9dd12c68` or
  B++ `143b63ff42b88c6780c5043e0f61d64100f81f40`. All are untouched. Nothing is done on `main`. Within the continuation, C4a
  (`323f292`) is the last checkpoint whose page was served B++'s compiled client; `CHECKPOINTS.md` has each one's rollback.

## Known, and not a reason to fail this QA

These are recorded limits, as on B++. None changes what players get.
- Some game facts are written in more than one file, on the server and the page (FINDINGS M-028). Each copy is B++'s, and since C4d
  the gate fails if one changes alone; making each one source is a separate change. Two pairs disagree, as on B++:
  - the spawn protection is 3 s on the server and 4 s in the page's threat display;
  - the server's movement floors for a state the page does not claim leave out a sprint at low stamina (the page claims its state in
    every pose during a run).
- The level's code still exists twice: the compiled client's TypeScript and the server's extracted copy (M-025). Its data is one file.
- A Hound's eye-contact slowdown, added in B02, has never applied (M-029): kept exactly, since changing it changes the chase.
- The carpet texture is still the placeholder (M-013).
- Eight frameworks are names with a README only.
