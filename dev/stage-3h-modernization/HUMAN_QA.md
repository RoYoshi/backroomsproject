# STAGE 3H ENGINE MODERNIZATION — FINAL HUMAN QA PENDING

> **This page is the C5b candidate's.** C1 and C4 resumed on 2026-10-15 (`CHECKPOINTS.md`); a new candidate and its page will replace
> it.

**Only the owner can accept this build.** It is a candidate, not a release.

- Nothing is merged, deployed or promoted.
- `main`, the accepted B++ (`143b63f`), the frozen Stage 3H2 (`22751bb`) and M8 (`c34f0c2`) are unchanged.

**What changed since M8, which you said plays the same:** the code of the server's simulation, the WebSocket session and six of the
page's scripts was reorganized into modules, one per owner. **What must not change:** anything a player sees, hears or feels.

The machine checks compared this build with B++ and with M8 directly, and found no difference in behaviour:
- the same messages;
- the same traces of every client scene;
- the same results from the sim;
- the same pixels in 23 contact-lab images;
- two real Chromium players whose every WebSocket frame has the same structure.

Those checks ran headless, with a software renderer. **This page is the part only a person can judge:** real hardware, real sound,
real players. It concentrates on what was rebuilt. `docs/architecture/PARITY_MATRIX.md` lists what the machines cover.

## Set up an A/B comparison

1. **The candidate.**
   - Get it from the branch `stage-3h-engine-modernization` at the commit named in the delivery, or from the ZIP.
   - Run `ADMIN_PASSCODE=<a test passcode of yours> node server.js 8000` and open `http://localhost:8000`.
2. **M8, beside it.**
   - Run `git worktree add ../m8 c34f0c22bbacc5ac2813d173bc0591b67af7169f` (or download that commit from GitHub).
   - Then `cd ../m8 && ADMIN_PASSCODE=<the same> node server.js 8001`.
   - B++ (`143b63f`) works the same way, if you prefer the original reference.
   - Never mix files from two folders.
3. **Run each scene twice:** M8 first, then the candidate, on the same machine, browser, window size and graphics setting. Use
   headphones and a real GPU if you can. Settings are saved per address, so set the same options on both ports.
4. **Note** the machine, the browser, the devicePixelRatio, the graphics tier and the number of players.

## Checklist: what was rebuilt, and where a mistake would show

- [ ] **Joining, the session and the admin login** (moved out of `server.js`, C2).
  - Open two or three tabs in one room, close one, and reopen it. Each player appears, leaves and comes back as on M8.
  - The menu says Online and the room. Pause a run (Esc): the status line at the top says ONLINE · ROOM …, the count of wanderers and
    SHARED MONSTERS (and ADMIN once unlocked).
  - Restart the server while a tab is open. The menu says Reconnecting (the paused status line, SOLO · RECONNECTING), then Online again.
  - In the admin panel (the backquote key), a wrong passcode says WRONG PASSCODE. Repeated wrong ones end in TOO MANY TRIES · WAIT …S,
    which refuses even the right passcode until the wait is over. After the wait, the right passcode unlocks it.
- [ ] **Monsters and the world** (the server's simulation, C3a).
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
  - Each death variant plays as on M8: Hound A, B, C (at a wall) and D; Smiler A, B and C.
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
    move you to such a spot, away from glitched walls and lamps. GLITCHED WALLS · GO TO NEAREST takes you to a glitched wall.
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
  - Using `docs/architecture/FRAMEWORKS.md`, find in a few minutes where a Hound is drawn, where NEW RUN is approved, and where the
    admin login is checked.

## Verdict (the owner's only)

- **PASS / ACCEPT.** Name the commit and tree you accept. Nothing is merged automatically.
- **NEEDS CHANGES.** Record the scene, the player, the browser, the time, your sound equipment, and what differs from M8. The fix is
  made on this branch, never over an accepted checkpoint.
- **ROLL BACK.** Use M8 `c34f0c22bbacc5ac2813d173bc0591b67af7169f`, the frozen 3H2 `22751bbc39c91f3e54e3305638b2ef2c9dd12c68` or
  B++ `143b63ff42b88c6780c5043e0f61d64100f81f40`. All are untouched. Nothing is done on `main`.

## Known, and not a reason to fail this QA

These are the stage's unfinished items or recorded limits. None changes what players get.
- **Not done here** (the npm registry cannot be reached from this environment):
  - the v11 toolchain rebuild (C1, M-017);
  - the bundle's 40 post-v11 edits as readable TypeScript (C4);
  - one Level 0 definition instead of two (M-003).
- Some smaller game facts are also written on both the server and the page (M-028). Two pairs disagree, as on B++:
  - the spawn protection is 3 s on the server and 4 s in the page's threat display;
  - the server's movement floors for a state the page does not claim leave out a sprint at low stamina (the page claims its state in
    every pose during a run).
- The carpet texture is still the placeholder (M-013).
- Eight frameworks are names with a README only.
