# Runtime flows: what happens, in which file

Paths are under `src/` unless they start with `public/`. A function name in a part file is shared with the other parts of its script
(see each part's header).

## The server starts

`node server.js [port]` (the composition root):
1. requires the sim (`core/server/sim.js`: since continuation C3a the composition of its owners' modules, which requires the built
   `generated/server/world.js` and `ai.js`) and reads its configuration: the port, the web root `public/`, the admin passcode
   (`ADMIN_PASSCODE`), the body lifetime (`BODY_TTL`);
2. creates the HTTP server with the static file server (`frameworks/ward/server/static.js`);
3. wires the modules, each given what it uses: the movement authority (`frameworks/space/server/movement.js`), the death aftermath
   (`frameworks/gib/server/aftermath.js`), NEW RUN's decision (`frameworks/bpp/server/newrun.js`), the rooms
   (`core/server/rooms.js`), the admin commands (`frameworks/overseer/server/admin.js`), the fresher poses
   (`frameworks/bpp/server/poses.js`);
4. wires the admin login (`frameworks/ward/server/admin_login.js`) and the WebSocket session (`frameworks/bpp/server/session.js`, which
   registers the upgrade handler), starts the loop (`core/server/loop.js`, every 25 ms), and listens.

## The page starts

`public/index.html` loads 23 classic scripts in order (the camera and timing policies, `world.js`, `move.js`, the camcorder, the sounds,
`gore.js`, `dphys.js`, `light.js`, `ents.js`, `glitch.js`, the network layer's helpers, `mp.js`, the menus, the HUD, the inventory,
BR-RoLE, the Level 0 visuals and remaster). Each registers what it offers on `window` (`window.__net`, `window.__mp`, `window.__ents`,
`window.__brRole`, ...). The compiled bundle (`public/assets/index-DKbV5Nv9.js`) is an ES module, so it runs once the page is parsed:
it builds the PixiJS scene, the Level 0 map, the camera and the game loop, publishes `window.__api`, and from then on calls the classic
scripts' hooks. `mp.js` connects (`frameworks/bpp/client/mp.transport.js`: `connect()`); without a server the game runs alone.

## One server tick (every 25 ms)

`core/server/loop.js`, `tick()`, for each room:
1. **Steps the world** at 60 Hz: as many 1/60 s steps as the elapsed time asks (at most 15), `room.sim.step()`
   (`core/server/sim.step.js`): the sim's clock and the bodies' pruning (G.I.B.'s `tick`), the spawn protection, the glitched walls'
   exits, then (unless frozen, or nobody is alive) the run's clock, the blackout, the pressure and the director, the AI's feed and
   engine, the captures, the events.
2. On **one tick in two** (`SNAP_EVERY`): plays the deaths' aftermath (`aftStart` for any death without its event, then `aftSend`,
   `aftTick`), and sends each client one **snapshot** (`{t:'s'}`: the other players, the entities, the client's own state, the world
   epoch). With it, when due: the admin's panel data (5 times a second), the AI debug data (to admins who asked), the bodies (when they
   changed), the exit through a glitched wall.
3. On **the other ticks**: the fresher poses (`{t:'q'}`, `frameworks/bpp/server/poses.js`) to the clients that asked for them.

## One message from a client

The session (`frameworks/bpp/server/session.js`, `onMessage`) reads JSON frames (`frameworks/bpp/server/ws.js`) and hands each by type:

| Message | Goes to | What happens |
|---|---|---|
| `p` (the pose: in a run every 50 ms, or 25 with the fresher poses) | `mvCheck` (S.P.A.C.E., `movement.js`); `room.sim.hearMove` | the move is accepted, cut short by another player, or refused and corrected (`{t:'tp'}`); the AI hears how the player moves |
| `join`, `respawn`, `leave` | `room.sim` (S.P.A.C.E.'s `sim.players.js`), then `placeFree` (S.P.A.C.E.'s `movement.js`) | the lifecycle; after a join or a respawn, a placement onto a free spot |
| `nr` | `nrIntent` (B++, `newrun.js`) | NEW RUN, below |
| `pick` | `room.sim.takeItem` | the cartograph, if the player stands on it |
| `admin` | `adminLogin` (W.A.R.D., `admin_login.js`) | unlock, or a wrong guess counted (five: 60 s lockout) |
| `a` | `adminCommand` (OVERSEER, `admin.js`) | only from an unlocked connection |
| `caps`, `ping` | the session | the fresher poses switched on; `pong` |

Field values are checked first (`frameworks/ward/server/fields.js`). Anything else is ignored.

## One frame on the page

The bundle's game loop runs the player's movement (`move.js`'s per-tick step, through `window.__api`), calls `window.__net.tick()` from its
fixed-step loop (`frameworks/bpp/client/mp.net.js`: starts our death when the server made one), and once per frame calls `window.__mp(...)`
(`core/client/mp.frame.js`). That hook: applies the server's state (the monsters, `mp.monsters.js`), plays the entities' sounds, the hum and
the glitched walls; sends our pose (every 50 ms, or 25 with the fresher poses: `{t:'p', x, y, ...}`); draws the other wanderers; drives
the dread (the vignette, the drone, the heartbeat).

## How a Hound comes to know where you are

On the server, every step (`core/server/sim.step.js`): `feed()` (N.A.N.I., `sim.feed.js`) gives the AI each player's position, light and
gait as the server accepted them; the engine (`ai.engine.js`) runs each entity's senses (`ai.senses.js`: sight through the level's own
ray-cast, hearing on a sound bus; `ai.light.js`: visible light as evidence), its memory and leads, its decisions (`ai.hound.js`,
`ai.smiler.js`) and its movement. The page never tells the AI anything but its own movement; the AI reads the level only through the
adapter in `sim.ai.js`. The admin's DEBUG overlay (`frameworks/overseer/client/ents.debug.js`) draws what each entity believes.

## A death

1. **The server decides it.** A capture ends in a kill (`ai.capture.js`); the world commits the death and calls `onDeath`
   (`core/server/rooms.js`), which opens one aftermath event (`aftStart`, G.I.B.'s `aftermath.js`): a death id, the kill record, the
   replay message.
2. **The victim's page plays it** from the kill record the snapshot carries (`mk`), through `window.__dvic`
   (`frameworks/gib/client/mp.owndeath.js`) and the bundle's death class.
3. **Every other page replays it** once (`aftSend` sends `{t:'fx'}`; `frameworks/gib/client/mp.replays.js`), in line of sight.
4. **The server finishes it**: its own physics run (`death_srv.js` on `dphys.js`, the same file the pages run), and at the end the body
   (`aftTick` puts it in the world: `sim.setBody`); every page gets the bodies (`{t:'bodies'}`, `mp.bodies.js`). A body stays until the
   world resets or its player dies again (or `BODY_TTL` seconds).

## NEW RUN

1. The pause dialog's button calls `window.__net.nr(ok)` (`mp.net.js`): online, it only sends an intent, `{t:'nr', q, w}`.
2. The server decides (`nrIntent`, `frameworks/bpp/server/newrun.js`): a flood is dropped (250 ms); each press number gets one answer;
   the rules are the world's (`nrWhy` in `frameworks/space/server/sim.players.js`: not in the menu, not dead, not held, the 30 s wait
   unless the admin's own UNLIMITED NEW RUN).
3. Approved: the player leaves the world (`sim.newRun`) and the blast starts, an aftermath like a death (`boomStart`). The answer
   (`{t:'nra'}`) reaches the page (`nrAnswer`, `mp.newrun.js`): the bundle's short beat, then the run menu. Refused: the button says why
   (`net-newrun.js`'s words), and nothing else happens.

## The files the page loads

The server serves only `public/`, through its allowlist (`frameworks/ward/server/static.js`): the page, the scripts, `assets/` (images,
the menu's music, the bundle and its PixiJS chunks), and `sounds/` (with `/sounds` listing them for `sfx.js`). Code is never cached;
images for a day; everything but PNG is gzipped when the browser accepts it. `src/`, `dev/`, `generated/`, `docs/` and `server.js`
answer 404.
