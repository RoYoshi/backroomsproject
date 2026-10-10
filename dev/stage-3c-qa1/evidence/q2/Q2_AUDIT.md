# Stage 3C QA1, Q2: the menu / run boundary

## What a menu visitor was, and is (measured)

Both builds were measured with the same instrument, `dev/stage-3c-qa1/lifecycle.js`:
- **Page B** is a player inside Level 0.
- **Page A** loads the game, stays on the main menu for 8 s, then presses ENTER LEVEL 0.

Outputs: `lifecycle_first_candidate.json` and `lifecycle_qa1.json`.

| On the menu, before ENTER | First candidate (76bcc4a) | QA1 |
|---|---|---|
| run started | no | no |
| the game's hide-self state | unset | **on** |
| the visitor's light counts as shining (`__api.lightOn()`, what BR-RoLE draws) | **yes** | no |
| the visitor's own wanderer drawn in the world (its person object and every container above it) | **yes**: it stood at the spawn with its flashlight on, behind the menu (see the Q1 captures) | no |
| `join` packets sent | 0 | 0 |
| what the server says about the visitor (admin data on its snapshots) | listed, **not active** (in the menu) | listed, **not active** |
| what the player inside sees | "1 WANDERER", no avatar | "1 WANDERER", no avatar |
| what the visitor's own menu says about the room | "2 WANDERERS" (the game's line counts the visitor itself) | "One other wanderer is in the halls right now." (the same line, minus the visitor) |

| After ENTER LEVEL 0 | First candidate | QA1 |
|---|---|---|
| joins | exactly 1 | exactly 1 |
| hide-self, light, drawn | off, shining, drawn | off, shining, drawn |
| server / the player inside | active; "2 WANDERERS", 1 avatar | active; "2 WANDERERS", 1 avatar |

## Where each part of a run begins (from the source)

- **The local wanderer object** (`H`, its person sprite) is created when the game's module loads, so it exists on the menu. It is drawn every frame, with the person's visibility set from the game's own hide-self flag (`Ff()` in the bundle: `person.visible = !__hideSelf`).
  - The flashlight passed to the lighting is `light && !__hideSelf`, and so is `__api.lightOn()`.
- **Movement, collision, stamina, the solo AI and the camcorder's heat and battery** only run while the game's `started` flag is set (the bundle's frame: `$ && !paused && !caught`; the camcorder ticks with 0 s while not started).
  - Movement keys are ignored until then. Held D + Shift on the menu moved nothing and spent no stamina.
- **Network:**
  - The socket opens on load.
  - The menu sends position packets at the game's menu cadence (4 a second).
  - `join` is sent only by the game's start (`Su()` -> `__net.join()`).
  - The server keeps a client that has not joined **inactive**: it stores the position ("in the menu: not in the world, nothing to check"), never broadcasts it to others, and the simulation's `isAlive` requires `active`.
- **AI:** every perception, sound, touch and target path in `ai.js` reads only `alive` players.
  - A Hound summoned to the visitor's spot (within 605 px of it, inside a Hound's 620 px sight) and a Smiler nearby, let loose for 10 s, never caught it.
- **END** (the bundle's `Nend()`): sets hide-self on, clears `started`, sends `leave`, and shows the run menu; END there shows the main menu.

So the server side of the boundary already held. The visible breach was local: the first menu after page load drew the visitor standing at the spawn with its light on, which the game itself only hid after an END.

## The fix (the smallest gate)

`assets/ui.js`, first line of its body: `window.__hideSelf = true;`
- This is the game's own state, the one END leaves you in, set before the game's module runs (`ui.js` is a classic script; the bundle is a deferred module).
- The game's start (`Su()`: ENTER LEVEL 0, SPAWN, RESTART LEVEL 0) clears it exactly as before.

Nothing in the bundle, `mp.js`, `server.js`, `sim.js`, `ai.js`, `move.js` or BR-RoLE changed.

## Proven (`probe_q2.json` / `.log`, all pass)

- **After 8 s on the menu:** not started, hide-self on, light not shining, wanderer not drawn, no join.
  - The server lists the visitor as not in the world.
  - The player inside counts only itself and draws nothing for it.
  - The visitor's menu counts the one wanderer inside.
- **Held D + Shift on the menu:** no movement, no stamina spent.
- **A Hound summoned to the visitor's spot and a Smiler nearby, loose for 10 s:** never caught.
- **ENTER LEVEL 0:** exactly one join; drawn, lit, counted and drawn by the player inside; it walks.
- **NEW RUN:** the run menu hides it and the player inside stops counting it. SPAWN: exactly one new join, drawn.
- **NEW RUN -> END:** a clean menu (not started, hidden, unlit, not counted). ENTER again: exactly one join.
- **Caught by a Hound -> RESPAWN:** back in the run by a `respawn` (no extra join), drawn and lit.

## Left as it is, on purpose

- **The menu's position packets** still carry the game's light bit. The server stores it for a client that has not joined but never uses it: not broadcast, and the AI reads lights only from alive players. Changing it would mean editing the network layer for no behaviour.
- **The menu's view of Level 0** is the game's own camera at the spawn, offset left as the parent does. Without the visitor's light the halls there are dark: the draft's black negative space. The fog's small near-reveal disc around that point of view is still faintly visible under the scrim. It is the renderer's line-of-sight presentation, not a wanderer.
- **Correction to Q0:** Q0's "avatar drawn" field followed `__api.beam()`, a plain object with no parent chain, so it always read "drawn". `lifecycle.js` reads the person object itself. Q0's conclusion stands; the Q1 captures show the parent's visitor at the spawn. `q0_lifecycle.js` and its output are kept unchanged.
