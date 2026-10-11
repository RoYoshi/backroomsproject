# Stage 3H0: what to check by hand

**Status: `STAGE 3H0 SAFE ARCHITECTURE HUMAN-QA CANDIDATE — WAITING FOR USER`**

**What 3H0 did.** It moved code out of the two largest multiplayer files into five small files, without changing what any of it does:
- **from `mp.js`:** the look / light / corpse field codec (`assets/net-wire.js`) and the snapshot interpolation (`assets/net-interp.js`);
- **from `server.js`:** the WebSocket framing (`server/ws.js`), the checks on what clients send (`server/fields.js`) and the static file serving (`server/static.js`).

**So the point of this walkthrough is that nothing has changed.** The game, the menu, the network, the admin tools and the server must look, sound, feel and answer exactly as in Stage 3C QA2, which you accepted. Anything you notice that differs from QA2 is a finding.

**Before you start:**
- **Branch:** `stage-3h0`. It comes from QA2's accepted `edd2af9`; `main` and the Stage 3C branches are untouched. Commits and trees are in `STAGE_3H0_PACKAGE_RECEIPT.txt`.
- **To start:** `node server.js 8000` (or `npm start`, `run_linux.sh`, `run_windows.bat`), then open <http://localhost:8000>.
- **Admin:** set your own passcode when you start the server: `ADMIN_PASSCODE=… node server.js 8000`. The automated tests used a synthetic one.
- **To compare with QA2 side by side (optional):**
  - unpack the QA2 package (or `git worktree add ../qa2 stage-3c-qa2`);
  - run it on another port, `node server.js 8001`;
  - open both.
- **Two players:** two browser windows (one of them private, or two browsers) with the same room: <http://localhost:8000/?room=qa>.

Each scene lists what to do, then what should happen. Tick it, or note what looks wrong and where. "As in QA2" means exactly what `STAGE_3C_QA2_HUMAN_QA.md` describes for that scene.

## A. The server starts as before
- `node server.js 8000` prints exactly one line, `The Far Backrooms → http://localhost:8000  (share  ?room=NAME  to group up)`, and serves the game.
- **New, and worth knowing:** `server.js` now needs the `server/` folder next to it. If a deployment copied only some files, the server would stop at start-up with `Cannot find module './server/static.js'`. It would not run half-broken.

## B. Cold load, the ready gate, the menu (as in QA2)
New private window:
- the page is black from its first frame;
- LOADING, then the ready gate's line, then your logo powers on first with the Intro, then the rest of the menu in order.

Nothing about the menu, its theme or its rails differs from QA2.

## C. The menu idle, watched from a second window
Window 1 stays in the menu. Window 2 enters the same room and walks around.
- Window 2 sees **no** Wanderer standing in the world for window 1 until window 1 presses ENTER.
- Window 1's badge reads ONLINE.

## D. PLAY → ENTER, once
- One ENTER starts exactly one run.
- You spawn with your chosen gear, colours and name.
- Window 2 sees you appear once, with the right look and light.

## E. Two players moving
Walk, sprint, crouch, turn the light on and off, switch light kinds.
- **Each window sees the other:**
  - the same place and facing;
  - the light's colour, beam and on / off;
  - the hat, colours and name on hover.
- **Peer motion:** it steps with each snapshot (about 20 a second). That is QA2's behavior too: other players are not smoothed between snapshots, only monsters are.
- **Monsters move smoothly** in both windows, with no jumps or stalls that QA2 did not have.

## F. Hounds and Smilers, deaths, corpses
Let a monster catch one player.
- **The capture, the death and the death camera** are as in QA2.
- **The other window:**
  - sees the death replay;
  - then the corpse, with its dropped light still lit;
  - and the player shown as dead on hover.
- **RETRY / RESPAWN** works. The corpse stays (one per player).

## G. Moving like before
Stamina, crouch, slide, vault, the DEEP CARPET slowdown.
- The same speeds and sounds.
- The monsters react to sprinting and to noise as before.

## H. Items, glitched walls, the exit
- **The cartograph:** picked up once.
- **Glitched walls:** they crackle with static as you near them. Touching one ends the run with "YOU NO-CLIPPED OUT OF LEVEL 0" and your time in Level 0.

## I. NEW RUN, including the 30-second cooldown
- **NEW RUN:** your vanish plays for the other window, and you start a fresh run.
- **A second NEW RUN within 30 s:** the known QA2 mismatch is still there, unchanged. The other window can keep a ghost of you until you move. 3H0 records this; it does not fix it.

## J. Pause, END, back to the menu (as in QA2)
- Pause and resume.
- END fades the run and the game's sound to black. Then the menu returns, logo first.

## K. Losing the server, and getting it back
- **Stop the server while playing:**
  - the badge turns SOLO;
  - the other player disappears;
  - offline, the glitched walls and the cartograph still work.
- **Start the server again:**
  - the badge returns to ONLINE by itself within a few seconds;
  - you are back in the world;
  - no ghost of a player is left behind.

## L. Admin (your own passcode)
Press the backquote key to open the panel.
- **A wrong passcode is refused.** After 5 wrong ones, the panel says to wait 60 s.
- **The right passcode unlocks the panel.** Its tabs and buttons work as in QA2 (spawn near you, death lab, world reset, message to everyone).
- **The other window gets nothing** it should not see.

## M. Phone and keys (as in QA2)
- **On a phone, or with touch emulation:** the stick, the buttons and the layout are as in QA2. The stick walks no faster than the keys.
- **Keyboard remaps:** they still apply.

## N. Rooms
- **Isolation:** two different `?room=` names never see each other.
- **The room cap (optional):** a ninth window in a full room cannot join; the room holds 8.
- **Cleanup:** closing every window of a room throws that world away. The next visitor gets a fresh one.

## O. What the server serves, and what it never serves
In a terminal, with the server running:

    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/assets/net-wire.js     → 200
    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/assets/net-interp.js   → 200
    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/server/ws.js          → 404
    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/server/static.js      → 404
    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/server/fields.js      → 404
    curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/server.js             → 404

The page works as before; DevTools > Network shows the two new scripts loaded just before `mp.js`.

## P. Camera, lighting (BR-RoLE), performance
- **The look:** the camera, the light and shadow, and the Level 0 look are as in QA2.
- **The feel:** the frame rate in the menu and in a run feels the same.
  - **On your real GPU:** please note the frame rate; the automated tests ran in software rendering only.

## What the automated checks already cover, and what only you can judge

**Covered by the evidence** (`3H0_EQUIVALENCE_REPORT.md`, `STAGE_3H0_REPORT.md`):
- **Every message both sides send and receive is byte-identical to QA2's for the same inputs.** This was checked at every checkpoint on deterministic traces.
- **Live, two real players** gave structurally identical wire traffic in every phase (boot, menu, entering, NEW RUN, death, respawn, END, server restart) at every extraction checkpoint. On the final tree, two of three runs differed only while the server was down and restarting, through reconnect timing and offline play. The third run was identical.
- **Over real sockets,** 108 HTTP requests and 25 WebSocket checks gave identical bytes, apart from the `Date` header's value.
- **QA2's own regression probes** were run again (menu, boot, keys, touch, lifecycle, camera, BR-RoLE, theme files), and **the performance** was compared with QA2's code.

**Only you can judge:**
- how it looks and sounds on your screen, speakers and real GPU;
- a phone in your hand;
- anything you remember from QA2 that is not written down.

**Caveats:**
- The automated browser runs used software rendering (SwiftShader), not a GPU.
- Screenshots use fallback fonts, because the test machine cannot reach Google Fonts.
- `dev/tests/live.js` waits at most 70 s for an AI kill, and can run out by chance on any version (QA2 included). This happened once during 3H0; `3H0_EQUIVALENCE_REPORT.md` (H0-4c) has the 46 repeats.
