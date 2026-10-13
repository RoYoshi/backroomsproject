# Stage 3D HQ3: human QA (instant NEW RUN gibs, admin panel)

HQ3 changes two things in the accepted HQ2 game:

- **NEW RUN gibs your Wanderer.** When the server approves your NEW RUN, the round body pops at once into 5–7 chunks and both round hands fly off. The light and the hat are thrown clear too. No whole body is left anywhere. The pieces settle and stay as your corpse until your next death or NEW RUN. Every player, including one who joins later, sees the same pieces in the same places.
- **The admin panel is up to date.**
  - DEATHS has a new section, YOUR NEW RUN · INSTANT GIB, with **UNLIMITED NEW RUN**. It lets the admin's own NEW RUN skip the 30 s wait. It is for you only, OFF by default, and OFF again after a reconnect.
  - WORLD's NEW RUN FOR EVERYONE is now clearly labelled as a whole-room reset that blows nobody up.

The automated checks are in `STAGE_3D_HQ3_REPORT.md`. They ran on a software renderer (SwiftShader); a real GPU has not been tested. Only you can judge how it looks and feels, and only you can say **HUMAN QA PASSED**.

## Setting up

1. **Unzip.** Unzip `THE_FAR_BACKROOMS_STAGE_3D_HQ3_ADMIN_GIBBING_HUMAN_QA.zip`. If you have the parts, join them first: `JOIN_INSTRUCTIONS.txt`.
2. **Start the server.** In the unzipped folder run `ADMIN_PASSCODE=<your own passcode> node server.js 8000`.
   - On Windows, run `set ADMIN_PASSCODE=<your own passcode>` first, then `node server.js 8000`.
   - Always set a passcode of your own; do not rely on any built-in default.
   - You need Node 18 or later. There is nothing to install.
3. **Open the windows.** Open http://localhost:8000 in three browser windows: Alice, Bob and Carol. Leave Carol at the name prompt for now.
4. **Find the controls.**
   - **NEW RUN** is in the pause dialog: press **Esc**, then **NEW RUN**.
   - **The admin panel** opens with `` ` `` (backtick); enter the passcode there. To keep monsters out of the way, remove them in MONSTERS, or press GOD beside the players.
5. **Keep Bob in a run.** If Alice is alone, SPAWN after her NEW RUN starts a fresh world, and her pieces go with it (HQ2's rule for an empty room).

## The five checks

| # | Do | Expected |
|---|---|---|
| 1 | **The gibs.**<br>1. Alice stands in a lit place near a papered wall, light ON, and presses NEW RUN once. Bob watches.<br>2. Watch for half a minute.<br>3. Carol presses ENTER. | **At once:** a pop, and Alice's body flies apart. Bob sees 5–7 chunks (rounded outer edge, raw red inner edge) and two round hands bounce, skid and spin to rest within a couple of seconds. The light and the hat tumble away. Blood lands on the carpet; a chunk that hits the wall hard leaves HQ1's wallpaper stain.<br>**Never:** a whole torso, a camera shake, a flash, or anything pushing Bob.<br>**The light:** a dropped flashlight shines for 3–7 s from the blast, flickers out over 1–2 s, and stays completely dark. With the light OFF, nothing ever lights up.<br>**Carol** sees the same pieces in the same places, the stain and the light's state. She gets no blast and no sound |
| 2 | **The ordinary cooldown.** Alice presses SPAWN, then NEW RUN again within 30 s of the first | Refused. The button says `NEW RUN · WAIT n S` for a moment, and nothing else happens anywhere: no pop, no pieces, no ghost. Bob sees her standing there. At 30 s a press is approved again. The new pieces replace her old ones (one corpse per player) |
| 3 | **UNLIMITED NEW RUN.**<br>1. Alice opens the admin panel → DEATHS → YOUR NEW RUN · INSTANT GIB and clicks **UNLIMITED NEW RUN**.<br>2. NEW RUN, SPAWN, NEW RUN, a few times.<br>3. Click it again (OFF) and try another NEW RUN.<br>4. Bob opens the panel without the passcode, and tries NEW RUN twice.<br>5. Alice reloads her page. | **ON:** the button turns **● UNLIMITED NEW RUN ON** only when the server answers. The line under it reads `SERVER SAYS: ON`, and the status line agrees.<br>**Each NEW RUN** gibs her at once with no 30 s wait. Each time the newest pieces replace the previous ones.<br>**After OFF** the 30 s wait is back, counted from her last NEW RUN.<br>**Bob** sees only the passcode prompt, and his own second NEW RUN is still refused.<br>**After the reload** her toggle is OFF; it has to be switched on again |
| 4 | **An ordinary death and the world reset.**<br>1. Alice, gibbed, SPAWNs and dies to a hound (DEATHS → PLAY A DEATH ON ME · HOUND, or let one catch her).<br>2. Then gib her again and, while the pieces fly or after they settle, press WORLD → NEW RUN FOR EVERYONE. | **The hound death** plays as in HQ2, and its corpse replaces her pieces.<br>**After the reset**, on every screen at once, the pieces, blood, wall stain and dying light are gone.<br>**Nobody is blown up** by the reset, and no NEW RUN wait starts.<br>**No** blackout flash, no ghost light, nothing left that blocks |
| 5 | **Collision and feel.** Alice and Bob walk into each other in a narrow hall, then in a wide one; both walk through a pile of pieces | **Narrow hall:** they block each other.<br>**Wide hall:** they slide round each other, as in HQ2.<br>**Pieces** never block or push anyone.<br>Overall it should feel as playable as HQ2 |

**The sound.** The blast's sound is HQ2's. The ten candidate sounds in the pack's `reference_audio` are not in the game. Pick one, if you want one, and it can be wired in later.
