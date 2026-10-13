# Stage 3D HQ2: human QA (NEW RUN explosion, player collision)

HQ2 adds two things to the accepted HQ1 game:

- **NEW RUN blows you up.** Pressing NEW RUN asks the server. If it agrees, your Wanderer explodes where it stood, every player sees the same blast, and the remains stay as a corpse with HQ1's blood and dying light. If it refuses (within 30 s of your last NEW RUN, say), nothing happens anywhere.
- **Players are solid.** Living Wanderers block each other. In a narrow hall a friend standing still is in your way (MOVE, MAN, MOVE!). In a wide space you slide round each other.

The automated evidence is in `STAGE_3D_HQ2_REPORT.md`, including two films of real pages: `dev/stage-3d-hq2/evidence/h2-5/video/main/film.mp4` and `video/lag/film.mp4`. It was made with a software renderer (SwiftShader); a real GPU has not been tested. Only you can judge how it feels, and only you can say **HUMAN QA PASSED**.

## Setting up

1. **Start the server with your own passcode.** Unzip `THE_FAR_BACKROOMS_STAGE_3D_HQ2_SELF_DESTRUCTION_PLAYER_COLLISION_HUMAN_QA.zip` (or join its parts first: `JOIN_INSTRUCTIONS.txt`). In its folder run:

   ```
   ADMIN_PASSCODE=<your own passcode> node server.js 8000
   ```

   On Windows, run `set ADMIN_PASSCODE=<your own passcode>` first, then `node server.js 8000`. Always set a passcode of your own; do not rely on any built-in default. You need Node 18 or later; there is nothing to install.
2. **Open the windows.** Open http://localhost:8000 in three browser windows: Alice, Bob and Carol. Keep Carol at the name prompt for the late-join checks.
3. **NEW RUN** is in the pause dialog: press **Esc**, then **NEW RUN**.
4. **The admin panel.** Press `` ` `` (backtick) and enter the passcode. Its tabs are PLAYERS (GOD, BRING, GO TO, REVIVE), MONSTERS, DEATHS (the Death Lab) and WORLD (BLACKOUT; RUN: NEW RUN FOR EVERYONE).
5. **Keep the test quiet.** In MONSTERS, remove the monsters, or press GOD next to the players who only watch. God mode does not stop NEW RUN.
6. **Choose a light.** CUSTOMIZE → Loadout. **F** switches the light on or off.
7. **A narrow hall.** Level 0's narrow passages are one wall panel wide. The wide halls are three to six times that. Walk into one with Alice, then BRING Bob from the admin panel. He lands at the nearest free spot beside her.
8. **Lag (optional, a development tool).** Run `node dev/stage-3d-hq2/lag_proxy.js --listen 8001 --to 8000 --ms 150` and open one window at http://localhost:8001. That window then talks to the server 150 ms late each way.

## A. NEW RUN, two or three windows

| # | Do | Expected |
|---|---|---|
| A1 | Alice stands near a papered wall in a lit place, flashlight **on**, and presses NEW RUN once. Bob watches | Alice's Wanderer vanishes at once. Bob sees **one sudden blast** where she stood: the round body thrown and spinning, both hands flying, the flashlight and the hat tumbling. Then blood on the carpet and, if the body hits the wall, the HQ1 wallpaper stain on that face. Alice's own screen shows the blast during a short beat, then her run menu says **YOU BLEW YOURSELF UP**. Bob is not moved, not hurt and not stopped |
| A2 | Watch the corpse for a minute | The body, hands, light and hat come to rest and stay. The dropped flashlight shines normally for **3–7 s** from the blast, flickers and dims for **1–2 s**, and then stays **completely dark** |
| A3 | Carol presses ENTER a few seconds after the blast, and again from a fresh page 30 s or more after it | Carol sees the same corpse in the same place, with its stain. Within the light's life she sees it fail at the **same moment** as Bob; after it she sees it already dark. It never lights up again |
| A4 | Alice presses SPAWN | A new run starts normally, with Bob still in the room. Alice's corpse stays (see Known limitations for a lone player) |
| A5 | Alice turns her light **off**, then NEW RUN (after the 30 s) | The same blast, and nothing lights up at any time. With the **camcorder**: no light and no glow |
| A6 | Lantern; headlamp | **Lantern:** the same, an all-round glow. **Headlamp:** it stays on the head of the thrown body (the hat flies off), and its light holds and fails on the same schedule, counted from the blast |
| A7 | Alice presses NEW RUN, then again 1 s, 10 s and about 29 s later (Carol can try too) | Each press within 30 s is **refused on both screens alike**. The button says `NEW RUN · WAIT n S` (the seconds left) for a moment, and nothing else happens: no blast, no fade, no ghost, no stray light, no new run. Bob sees Alice standing there, unchanged |
| A8 | Press again at 30 s or later | Approved: one blast, as A1. Its corpse replaces her previous one |
| A9 | Two players press NEW RUN at the same moment | Two blasts, each where its player stood, and two corpses. Nobody else is touched |
| A10 | Alice opens the pause dialog (Esc) and presses NEW RUN while a hound holds her, or while she is dead (if the dialog can be reached there) | Refused (`NOT NOW`). The capture or the death goes on as before |
| A11 | During a blast, close Bob's window (or switch his Wi-Fi off and on), then reopen it | One consistent aftermath: Bob, back in, sees the blast's end or the corpse, never a second blast |
| A12 | END from the run menu, an ordinary death and RESPAWN, and the admin's NEW RUN FOR EVERYONE | **No blast** in any of them, and no NEW RUN cooldown started |
| A13 | WORLD → BLACKOUT, every light off, and a NEW RUN in front of a spectator | No flash: the blast has no light of its own. No camera jump on anyone's screen |

## B. Players are solid

| # | Do | Expected |
|---|---|---|
| B1 | A narrow hall: Bob stands still, and Alice walks, then runs, then sprints at him | She **stops at his body** every time and never phases through. Nobody is pushed. She can back away freely |
| B2 | Bob steps aside | She squeezes past his shoulder and goes on |
| B3 | A wide hall: walk and run past each other slightly off-line, then walk head-on | Off-line, you **slide round** each other with no jitter. Head-on, you stop, and nobody is shoved sideways. Far apart, movement feels exactly as before |
| B4 | Into a standing player: crouch-walk, crawl, slide (running, then C), and a vault with him standing on the far side | Crouch and crawl stop at his body. A slide into him ends at contact. The vault does not start while he is on its landing, and works once he moves. You never end up inside a wall or a prop |
| B5 | Both run at each other, then both push into each other | You stop at contact. With lag (setup step 8) the bodies may overlap on one screen for a moment while running, then settle apart. While both keep pushing, the lagged window gets small, smooth corrections; they stop when either lets go |
| B6 | Bob dies, presses NEW RUN, goes to the menu (END), or closes his window | From that moment he no longer blocks anyone: Alice walks through where he was. **A held player** (caught by a hound) does not block either, so the hound's drag is never stopped. **Corpses never block** |
| B7 | Bob stands on the spawn point while Alice respawns or enters, and BRING Bob onto Alice from the admin panel | Nobody lands inside anybody: the new arrival appears on a free spot beside |
| B8 | Three players, then as many as you can (eight is the room's limit), crowd into one narrow spot, then walk away | No flicker, no teleport loop, nobody stuck. Everyone can walk out |
| B9 | Two windows in different rooms (`?room=a`, `?room=b`) at the same spot | They never block each other |

## C. An admin world reset during a death (HQ1's known limitation, now fixed)

| # | Do | Expected |
|---|---|---|
| C1 | Bob and Carol watch. Alice, flashlight on and near a papered wall, plays DEATHS → HOUND → C · WALL SLAM. While she is still dying, Bob (admin) presses WORLD → NEW RUN FOR EVERYONE | On **every** screen, the old death **stops at once**: its replay, the wall stain, the corpse and the dying light all go. Alice is back in the new world, alive, where the server put her. Nobody explodes, and nobody's NEW RUN cooldown starts. No invisible blocker is left anywhere |
| C2 | The same with a NEW RUN blast in progress | The blast and its corpse go everywhere. Alice stays in her run menu; SPAWN then starts her new run |
| C3 | Carol enters after the reset | She sees nothing of the old world |
| C4 | The same as C1 with Bob's Death Lab paused (DEATHS → DEATH LAB · WATCH IT SLOWLY → ❚❚ PAUSE) and Carol's at 0.25× | The old death goes on their screens too, paused or slow, and does not come back when the clock is restored. The next death in the new world plays, leaves its corpse and stain, and its light holds and fails as HQ1 accepted |

## D. Everything else as before

- Level 0's walls stay solid. Shadows, lighting and blackouts are as in HQ1.
- Hounds and Smilers have their eight deaths exactly as before. A blast hurts, pushes and alerts no one.
- The menu, music, keybinds and customize are unchanged.
- On your real machine, how fast does it run, and how does it feel with two or more players?

## Known limitations (judge them)

- **A brief on-screen overlap with lag.** Each window draws the others where their last update put them. Two players running at each other can overlap on one screen for a moment: about 0.2 s at 60 ms of lag, about 0.5 s at 150 ms. The server never lets them overlap, and both screens settle apart within about half a second.
- **Small corrections while pushing with lag.** About one every 0.3 s, blended in over 0.12 s, and only while both keep pushing.
- **A 2 px tolerance.** Standing bodies may sit 2–3 px into each other on one screen, never on the server.
- **A reloaded page is a new player.** There are no accounts, so a reload gives a fresh NEW RUN cooldown.
- **A lone player's corpse.** After a lone player's NEW RUN, SPAWN enters an empty room, and the game's existing rule starts a new world there, so the corpse is not in the new run. With anyone else in a run, it stays (A4).
- **Held players are not solid** (B6), so a capture is never blocked.
- **No reduced-motion setting.** The game has none. The blast adds no camera motion for anyone.
- **Offline** (no server at all), NEW RUN is the old local fade. Nobody else is involved.

## Reporting

For anything that looks or feels wrong, note:
- what you did;
- which window;
- the light kind;
- roughly when it happened.

A screenshot helps. If either feature fails or feels wrong, report it; HQ2 is not accepted until you say so. When you are satisfied, reply **HUMAN QA PASSED** (only you can).
