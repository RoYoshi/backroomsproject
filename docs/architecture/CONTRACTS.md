# Contracts: what one part of the game may rely on from another

A contract here is anything two owners share that one of them cannot change alone. Stage 3H renamed none of them: the names, message
types and fields below are what the accepted build uses, and the gate compares them with it.

## 1. The network protocol (B++)

JSON over one WebSocket (`/ws?room=NAME`), framed by `src/frameworks/bpp/server/ws.js`. The type is `t`.

| From the page | Handled by | | From the server | Handled on the page by |
|---|---|---|---|---|
| `p`: pose, light, look, movement (in a run every 50 ms, or 25 with the fresher poses; in the menu every 250 ms) | the session: `mvCheck` (S.P.A.C.E.) | | `hi`: your id | the session (`mp.session.js`) |
| `join`, `respawn`, `leave` | the session: the world's lifecycle (S.P.A.C.E.) | | `s`: the snapshot (20 a second) | the session (`mp.session.js`), then the owners' functions it calls |
| `nr`: a NEW RUN press | `nrIntent` (B++) | | `q`: fresher poses (B+) | `peerPoses` (`mp.session.js`), then `resolid` (`mp.peers.js`) |
| `pick` | `sim.takeItem` (P.O.C.K.E.T.) | | `tp`: where you really are | `mp.session.js`, `softTp` (`mp.peers.js`) |
| `admin`: the passcode | `adminLogin` (W.A.R.D., `admin_login.js`) | | `world`: a new world epoch | `worldNew` (`mp.session.js`), then each owner's end of the old world |
| `a`: an admin command | `adminCommand` (OVERSEER) | | `fx`: a death's or a blast's replay, or its end | `fxMsg`, `startFx` (`mp.deaths.js`) |
| `caps`: ask for the fresher poses | the session | | `bodies`: everyone's bodies | `takeBodies` (`mp.deaths.js`) |
| `ping` | the session (`pong`) | | `nra`: NEW RUN's answer; `nrf`: UNLIMITED NEW RUN's state | `nrAnswer` (`mp.session.js`); `nrfAnswer` (`mp.admin.js`) |
| | | | `exit`, `got`: through a glitched wall; the cartograph taken | `mp.glitch.js`, `mp.cartograph.js` |
| | | | `admin`, `ares`, `kick`, `revive`, `msg`, `caps`, `pong` | `mp.session.js`; the admin panel's own (`loginAnswer`, `aresAnswer`, `kickedShow`, `showMsg`, `pong`: `mp.admin.js`) |

The messages' fields are listed in the Stage 3H0 protocol inventory
(`dev/archive/stage-3h0/3H0_PROTOCOL_INVENTORY.md`). The gate's protocol step checks every message of its runs against the accepted
build's (`dev/stage-3h/gate/protocol_v2.js`), and `raw_live` every exchange.

## 2. The page's globals

The classic scripts and the compiled bundle talk through `window`. A name here is a contract between its writer and its readers:
renaming one breaks the others silently.

<!-- generated: globals (dev/tools/docs/docs.js) -->
| Global | Written by | Read by |
|---|---|---|
| `window.__api` | `assets/index-DKbV5Nv9.js` | `assets/br-role.js`, `assets/chat.js`, `assets/l0-remaster.js`, `assets/mp-hum.js`, `assets/net-wire.js`, `assets/shadows-2d.js`, `assets/skinstealer.js`, `assets/ui.js`, `assets/voice.js`, `camcorder.js`, `dphys.js`, `ents.js`, `glitch.js`, `gore.js`, `hud.js`, `inventory.js`, `light.js`, `move.js`, `mp.js`, `sfx.js` |
| `window.__avatarApp` | `assets/index-DKbV5Nv9.js` | - |
| `window.__boot` | `index.html` | `assets/ui.js` |
| `window.__brRole` | `assets/br-role.js` | `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js`, `assets/ui.js`, `camcorder.js` |
| `window.__c` | `assets/index-DKbV5Nv9.js` | - |
| `window.__cam` | `camcorder.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `light.js`, `mp.js` |
| `window.__cameraPolicy` | `camera_policy.js` | `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js` |
| `window.__chat` | `assets/chat.js` | `assets/ui.js`, `assets/voice.js`, `mp.js` |
| `window.__chatFrame` | `assets/chat.js` | `mp.js` |
| `window.__dcamK` | `dphys.js` | `assets/index-DKbV5Nv9.js` |
| `window.__deathLight` | `mp.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `light.js` |
| `window.__deathLightNow` | - | `mp.js` |
| `window.__dlab` | `mp.js` | `assets/index-DKbV5Nv9.js`, `dphys.js`, `ents.js` |
| `window.__dphys` | `dphys.js` | `assets/index-DKbV5Nv9.js`, `assets/skinstealer.js`, `ents.js`, `gore.js`, `mp.js` |
| `window.__dsndHits` | `ents.js` | `assets/index-DKbV5Nv9.js` |
| `window.__dvic` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__ents` | `ents.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `dphys.js`, `light.js`, `mp.js` |
| `window.__epochDebug` | `mp.js` | `assets/chat.js` |
| `window.__fxKill` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__fxKillS` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__fxs` | `mp.js` | `assets/skinstealer.js` |
| `window.__glitches` | `glitch.js`, `mp.js` | - |
| `window.__glitchFrame` | `glitch.js` | `mp.js` |
| `window.__glitchSolo` | `mp.js` | - |
| `window.__glitchSound` | `glitch.js` | `mp.js` |
| `window.__gore` | `gore.js` | `assets/index-DKbV5Nv9.js`, `ents.js`, `mp.js` |
| `window.__goreCache` | - | `gore.js` |
| `window.__goreNow` | - | `gore.js` |
| `window.__hideBodies` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__hideSelf` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` | - |
| `window.__hounds` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__hud` | `hud.js` | - |
| `window.__inv` | `inventory.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js`, `mp.js` |
| `window.__items` | `mp.js` | `glitch.js` |
| `window.__itemSolo` | `mp.js` | - |
| `window.__keys` | `assets/ui.js` | `assets/chat.js`, `inventory.js` |
| `window.__kill` | `assets/index-DKbV5Nv9.js`, `mp.js` | - |
| `window.__killer` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__l0v` | `assets/l0-remaster.js` | `assets/index-DKbV5Nv9.js`, `gore.js` |
| `window.__lastCause` | `assets/index-DKbV5Nv9.js` | `sfx.js` |
| `window.__light` | `light.js` | `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `assets/skinstealer.js`, `ents.js` |
| `window.__loadout` | `inventory.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` |
| `window.__mp` | `assets/shadows-2d.js`, `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__mpLib` | `assets/mp-hum.js`, `assets/net-interp.js`, `assets/net-newrun.js`, `assets/net-wire.js` | `mp.js` |
| `window.__mv` | `move.js` | `assets/index-DKbV5Nv9.js`, `ents.js`, `mp.js` |
| `window.__mvSfx` | `move.js` | - |
| `window.__net` | `mp.js` | `assets/chat.js`, `assets/index-DKbV5Nv9.js` |
| `window.__NET` | `mp.js` | `assets/net-interp.js` |
| `window.__netPose` | `mp.js` | `assets/net-interp.js`, `assets/skinstealer.js` |
| `window.__nrDebug` | `mp.js` | - |
| `window.__peerBodies` | `mp.js` | `move.js` |
| `window.__peerLights` | `mp.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `camcorder.js`, `light.js` |
| `window.__peerNet` | `mp.js` | `assets/chat.js` |
| `window.__PIXI_APP_INIT__` | - | `assets/RenderTargetSystem-CgUxHIsn.js` |
| `window.__PIXI_RENDERER_INIT__` | - | `assets/RenderTargetSystem-CgUxHIsn.js` |
| `window.__pose` | `move.js` | `assets/index-DKbV5Nv9.js` |
| `window.__settings` | `hud.js` | `assets/chat.js`, `assets/rgb.js`, `assets/ui.js`, `assets/voice.js` |
| `window.__sfx` | `sfx.js` | `assets/index-DKbV5Nv9.js`, `assets/mp-hum.js`, `mp.js` |
| `window.__shadows` | `assets/shadows-2d.js` | - |
| `window.__skin` | `assets/skinstealer.js` | `ents.js`, `mp.js`, `sfx.js` |
| `window.__ui` | `assets/ui.js` | `assets/chat.js` |
| `window.__uiCustomizeTab` | `assets/ui.js` | - |
| `window.__voice` | `assets/voice.js` | `assets/chat.js`, `assets/ui.js` |
| `window.__vol` | `hud.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` |
| `window.TFB_CREDITS` | `assets/credits_data.js` | `assets/ui.js` |
| `window.TFB_TIMING` | `timing_policy.js` | `assets/index-DKbV5Nv9.js` |
| `window.TFB_VERSION` | `assets/version.js` | `assets/ui.js` |
| `window.WORLD` | `world.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js`, `assets/shadows-2d.js`, `dphys.js`, `ents.js`, `gore.js`, `move.js`, `mp.js` |

68 names. Counted: `window.NAME` (and a UMD's `root.NAME`) in the served scripts, the compiled bundle and `index.html`'s own scripts. Not counted: a bare `__name` used without `window.`. A name nobody writes is a hook a test or the console may set.
<!-- end of generated block -->

`window.__api` is the bundle's facade. Its 52 members (some of them minified names) are their own contract, with each member's
TypeScript origin and its readers: [`src/core/client/bundle/API_CONTRACT.md`](../../src/core/client/bundle/API_CONTRACT.md).

**The compiled client's side** (continuation C4d, FINDINGS M-005): every window member the client uses is declared in
`src/core/client/game/client/contracts.d.ts`, with its type, the script that defines it and the lineage step that started using it, so
TypeScript checks every use at every build. `node dev/tools/checks/window_contract.js` (the gate's `contracts` step) holds those
declarations to the code: every member the client reads or writes is declared, and every declaration used; window is never cast to
escape them; no member the client reads is left undefined by the page; every script that writes a member is named in its declaration,
the first one named writing it; and the built bundle reaches the same names as its source.

## 3. The server's modules

Each module is a factory: `server.js` calls it with what it uses, and it returns what it provides. None requires `server.js` or another
module of the server (so the order of the server's own requires, which the goldens record, cannot change).

| Module | Given | Returns |
|---|---|---|
| `frameworks/ward/server/static.js` | the web root | the HTTP handler |
| `frameworks/bpp/server/ws.js` | (nothing: a plain module) | `frame`, `reader` |
| `frameworks/ward/server/fields.js` | (nothing) | `num`, `kindOf`, `cleanParts`, `HEX`, `DEFAULT_LOOK`, `cleanLook` |
| `frameworks/space/server/peers.js` | (nothing) | `D_BODY`, `TOL`, `legal`, `resolve`, `sweepPath`, `freeSpot` |
| `frameworks/gib/server/death_srv.js` | (nothing; it loads `generated/server/dphys.js` itself) | `fxFor`, `bodyFor`, `begin`, `step`, `corpse`, `durOf`, `DP`, `boomFx`, `boomBegin` |
| `frameworks/space/server/movement.js` | `PEERS`, `send` | `MV`, `PD`, `blockers`, `placeFree`, `mvReset`, `mvCheck`, `moveTo`, `adminMove` |
| `frameworks/gib/server/aftermath.js` | `deathSrv`, `send`, `HEX` | `aftStart`, `aftOf`, `aftSend`, `aftTick`, `bodyAt`, `putBody`, `boomStart` |
| `frameworks/bpp/server/newrun.js` | `send`, `boomStart` | `NR_GAP`, `nrIntent` |
| `core/server/rooms.js` | `createSim`, `BODY_TTL`, `aftStart`, `placeFree`, `mvReset`, `send` | `rooms`, `getRoom`, `worldReset` |
| `frameworks/overseer/server/admin.js` | `send`, `aftOf`, `moveTo`, `worldReset` | `adminCommand` |
| `frameworks/bpp/server/poses.js` | `send` | `poseSend` |
| `frameworks/ward/server/admin_login.js` | `crypto`, `ADMIN_PASS`, `send` | `adminLogin` |
| `frameworks/bpp/server/session.js` | `srv` and what the session hands messages to (`getRoom`, `rooms`, `send`, `reader`, the field checks, the movement authority, `nrIntent`, `adminCommand`, `adminLogin`), `crypto`, `MAX_ROOM`, `FAST_GAP` | nothing: it registers the upgrade handler on `srv` |
| `core/server/loop.js` | `rooms`, `poseSend`, `aftStart`, `aftSend`, `aftTick`, `bodyAt`, `send`, `SNAP_EVERY`, `ADMIN_EVERY` | `tick` |

The world itself (`core/server/sim.js`, `createSim(opts)`, one per room) returns the API the server uses: `step`, `entities`,
`addPlayer`, `join`, `respawn`, `leave`, `newRun`, `moveOk`, `moveRoute`, `spawnOk`, `admin`, ..., the same object, key for key, as the
built `sim.js` returned until continuation C3a. Since C3a the sim is modules, each a factory given what it uses, by owner, and returning
what it gives. `core/server/sim.js` makes them in this order (the order the one function ran) and wires them:

| Module (its name in `sim.js`) | Owner | Given | Returns |
|---|---|---|---|
| `frameworks/lost/server/sim.level0.js` (`level`) | L.O.S.T. | `WORLD`, and (C4c) the definitions `{ level0, lights }`: `frameworks/lost/shared/level0.json` and `frameworks/pocket/shared/lights.json`, which the composition requires | the map, collision, ray cast and light primitives (`FBW`, `FBH`, `Oc`, `Ic`, `ANCHOR` (since C4c), `Fc`, `W`, `al`, `il`, `ll`, `ul`, `zc`, `Hc`, `Bc`, `sl`, `Uc`, `fl`, `Gc`, `qc`), the blackout `V` with `Lc`, `Rc`, and its controls `forceBlackout`, `restartBlackout` |
| `frameworks/nani/server/sim.ai.js` (`ai`) | N.A.N.I. | `AI`, `WORLD`, `opts`, `players`, `level` | the seed's stream `RND`, `rnd`, the engine `eng` and its `adapter`, the caps, `alive`, `isAlive`, `ents`, `randomSpot`, `newHound`, `spawnMonsters`, `adminSpawn`, `adminCap`, `ANCHOR`, `SNn`, `navCmd`, `killerEnd` |
| `frameworks/lost/server/sim.glitches.js` (`walls`) | L.O.S.T. | `ai`, `level` | `glitches()` (the current walls), `placeGlitches()` |
| `frameworks/pocket/server/sim.items.js` (`items`) | P.O.C.K.E.T. | `ai`, `walls` | `items()` (the current cartograph), `placeItems()`, `takeItem(p)` |
| `frameworks/gib/server/sim.bodies.js` (`bodies`) | G.I.B. | `opts`, `ai` | `bodies` (a Map), `setBody`, `tick(dt)` (the sim's clock and the bodies' pruning), `clearBodies()`, `clock()`, `bodyVer()` |
| `frameworks/nani/server/sim.feed.js` (`feed`) | N.A.N.I. | `WORLD`, `opts`, `players`, `level`, `ai` | `feed`, `processEvents`, `capInfo` |
| `core/server/sim.step.js` (`run`) | core | `opts`, `players`, `level`, `ai`, `feed`, `walls`, `items`, `bodies` | `resetWorld`, `step`, `entities`, `ofKind`, `runT()`, `worldSeq()`, and `controls`: the admin's way into the run (`freeze`, `setSpeed`, `setBlackout`, `capRunTime`; `frozen`, `speed`, `bmode` to read) |
| `frameworks/space/server/sim.players.js` (`life`) | S.P.A.C.E. | `players`, `level`, `ai`, `feed`, `run` | the lifecycle (`addPlayer`, `removePlayer`, `spawn`, `join`, `respawn`, `canRespawn`, `leave`, `newRun`, `nrWhy`, `nrWait`, `NR_CD`, `forfeit`, `lifeOf`) |
| `frameworks/space/server/sim.movement.js` (`move`) | S.P.A.C.E. | `WORLD`, `level`, `ai` | `moveRoute`, `moveOk`, `spawnOk`, `hearMove`, `gaitFloor` |
| `frameworks/overseer/server/sim.admin.js` (`over`) | OVERSEER | `players`, `level`, `ai`, `feed`, `walls`, `items`, `run`, `life` | `admin` (the object the server calls) and `debugOn()` |

A factory's parameter names what it takes from each giver (`ai: { eng, randomSpot }`). A value that changes (the walls, the run's clock,
the world count, the bodies' version, the debug switch) is read through a function, never copied. State has one owner: another module
changes it only by calling a function its owner returns (the run's `controls`, `placeGlitches`, `clearBodies` ...). `players`, the
roster, is made by `sim.js`; only S.P.A.C.E.'s `sim.players.js` adds and removes players. `node dev/tools/checks/modules.js` (the gate's
`modules` step) proves these boundaries from the code, and the gate's `sim` step proves the behaviour against B++'s `sim.js`.

## 4. The page's scripts made of modules

Since continuation C3b, `world.js`, `move.js`, `camcorder.js`, `glitch.js` and `ents.js` are modules, and since C3c `mp.js`. Each owner's part is one factory
inside the script's wrapper (the browser still loads one classic script, so the load order and timing are as before). The factory is
given what it uses of the modules made before it, by giver, and returns what later modules use of it. A last part, the composition
(`*.compose.js`, owned by the script's lead owner), makes them in the order the parts ran:

| Script | The composition | Public object |
|---|---|---|
| `world.js` (also the server's copy) | `head = worldHead()`; `worldLamps({ head })`, `worldCrawl({ head })`, `worldSurfaces({ head })`, `worldMove({ head })`, `worldArt({ head })`; returns `head.W` | `W` (`window.WORLD`; `require` on the server) |
| `move.js` | `move = moveCore()`; `movePoses({ move })`; `moveSound({ move })` | `mv` (`window.__mv`) |
| `camcorder.js` | `core = camcorderCore()`; `audio = camcorderAudio({ core })`; `camcorderView({ core, audio })` | (`window.__cam` is the view's own object) |
| `glitch.js` | `walls = glitchWalls()`; `audio = glitchAudio()`; `glitchDraw({ walls, audio })` | - |
| `ents.js` | `head = entsHead()`; `entsHound({ head })`; `smiler = entsSmiler({ head })`; `entsDeath({ head, smiler })`; `entsAudio({ head })`; `entsDebug({ head })` | `E` (`window.__ents`) |
| `mp.js` (C3c) | `core = mpCore()`; `session = bppSession({ core })`; `glitch = lostGlitch({ session })`; `cartograph = pocketCartograph({ session })`; `monsters = naniMonsters({ core, session, glitch, cartograph })`; `space = spacePeers({ session, glitch })`; `audio = audioDread()`; `wanderers = brrWanderers({ session })`; `deaths = gibDeaths({ core, session, monsters, wanderers })`; `admin = overseerAdmin({ core, session, glitch, cartograph })`; `mpFrame({ ... })`; then `session.wire({ glitch, cartograph, monsters, space, wanderers, deaths, admin })` | `N` (`window.__net`, the session's) |

Each part's header lists its `imports` (giver { names }) and `exports`; the code agrees (the gate's `modules` step checks it). The
rules, proved from the code by `node dev/tools/checks/modules.js`:
- the script's wrapper holds the factories and the composition, nothing else: no state outside a factory;
- a factory uses its own names, what it is given, and the page's globals (`window`, `document`, `Math` ...): never another factory or a
  module the composition made (no hidden closure dependence); it never assigns what it is given, and it uses all of it;
- the composition makes each module once, in the order of the parts, each from modules made before it;
- a module writes another owner's state only through a function that owner gives. It may add its own entries to the script's public
  object (`W`, `E`, `mv`), and each entry has exactly one module that writes it. A module does not call a function that a third module
  put on another module's object: it imports the function from the module that made it;
- a module never reads, through the global object, a name another module of the same script puts there.

And since C3c (`mp.js`), also:
- a module changes another owner's object in place (`set`, `delete`, `clear`, `add`, `push`, `splice`, `fill` ...) only through a function
  that owner gives, as for its properties;
- each name is put on the global object by one module, and what is written through it (`window.X.p = ...`, `window.X.add(...)`) has one
  module that writes it: the one that put `X` there, when this script does (`window.__mv`'s held state, which `move.js` reads, is
  N.A.N.I.'s `unhold`); what this script writes of another script's object (`NET.onEpoch`, net-interp.js's) has one module that writes it;
- a module that calls modules made after it is given them late: names it declares with `let` and no value, assigned only by its own
  `wire({ key, ... })` (nothing but `({ name, ... } = key)` statements), used only in its functions, never while it is being made; the
  composition calls each `wire` once, after the last module is made, with modules made after it. Only the session (B++) has a `wire`:
  it handles every message the server sends and calls the owners' functions, and they use it. Its header's `late:` line lists them.

`mp.js`'s state, owner by owner (each changes only its own; the others call its functions or read it through a reader such as `me()`):
- B++'s session (`mp.session.js`): the WebSocket and the connection, the snapshot, our id, the kill counters and the spawn grace, NEW
  RUN's state, the world epoch, B+'s counters, the other players' map (`peers`), the status line, `window.__net`;
- L.O.S.T. (`mp.glitch.js`): the exit flag, `window.__glitches`, `window.__glitchSolo`; P.O.C.K.E.T. (`mp.cartograph.js`):
  `window.__items`, `window.__itemSolo`;
- N.A.N.I. (`mp.monsters.js`): the entity slots (`window.__hounds`), the kill record and the killer's slot (`window.__kill`,
  `window.__killer`), the held state handed to `move.js`, the hit flash, `NET.onEpoch`;
- S.P.A.C.E. (`mp.peers.js`): the solid peers (`window.__peerBodies`), the soft correction;
- G.I.B. (`mp.deaths.js`): our own death's record (`window.__dvic`), the bodies, the replays (`window.__fxs`, `window.__fxKill`,
  `window.__fxKillS`), the corpses hidden (`window.__hideBodies`), the light timeline (`window.__deathLight`), `window.__peerLights`,
  the wall stains' clock, the last view;
- OVERSEER (`mp.admin.js`): the admin panel's state (`adm`, with the passcode, in memory only), the death lab (`window.__dlab`);
- Spacious Audio (`mp.dread.js`): the dread's audio and the online note; BR-R (`mp.wanderers.js`): the hover tip and the mouse;
- core (`mp.frame.js`): the dread's level, its heartbeat and sting timers, `window.__mp`.
The other players' records in the session's `peers` map are the page's shared data model, as at M8 (like the server's players): the
session writes the server's fields and the fresher poses' targets, G.I.B.'s drawing eases the drawn position and keeps the avatar,
BR-R drops an avatar.

Three couplings that M8 hid are explicit since C3b, each by a listed edit (`dev/stage-3h-modernization/tools/c3_client_modules.js`):
- `move.js`: S.P.A.C.E.'s movement code called Spacious Audio's movement sounds through `window.__mvSfx`. The sound module now hands
  them to the movement module (`useSound`, the movement module's own function) when it is made. `window.__mvSfx` is still registered.
- `ents.js`: G.I.B.'s death scene drew the Smiler through `E.drawSmiler`, which BR-R's Smiler module puts on `E`. It now imports
  `drawSmiler` from the Smiler module: the same function.
- `camcorder.js`: Spacious Audio's module wrote the heat whine's sound nodes into the camera's state (`S.whine`, BR-R's). BR-R's module now
  gives `setWhine`, and the sound module calls it: the same value in the same slot.

`window.__name` contracts between scripts (section 2) are unchanged: what a module registers on window it still registers itself, at the
same moment. The gate's `page` step runs B++'s scripts and these side by side, and its `cli_golden` step B++'s `mp.js` and this one
([`PARITY_MATRIX.md`](PARITY_MATRIX.md), the page scripts' proof).

## 5. The parts of one script

The parts of `ai.js` still share its closure (`sim.js` was built from parts too until continuation C3a, the five scripts of section 4
until C3b, and `mp.js` until C3c). `ai.js` has one owner, N.A.N.I., and no part uses another's name across owners: it stays one
cohesive file. Each part's header lists what it provides, uses and writes; `node dev/tools/checks/parts.js` (the gate's `parts` step)
proves every list against the code. Those lists are the contracts between the parts: a name in another part's `uses` cannot be renamed
alone. (For the module scripts the lists are short: a module provides its factory, and only the composition uses factories.)

## 6. Facts written in more than one place

Some of the game's facts are written by hand in several files: on the server and on the page, in the compiled client and a classic
script (the entity codes the wire sends as indexes, the distance between players, the light kinds a client may send, a lamp's reach,
the fixed step, the world's size ...; FINDINGS M-028). Each copy is B++'s code and stays where it is. `dev/tools/checks/facts.json`
lists every copy (file and pattern) and the fact's value, and `node dev/tools/checks/facts.js` (the gate's `contracts` step) fails
unless each copy holds it. Where the copies differ on purpose (the spawn protection: 3 s on the server, 4 s on the page), each copy's
value is recorded. Level 0's own map is one file (`frameworks/lost/shared/level0.json`, continuation C4c); the code that names its
rooms by index or by name, and the world's size outside it, are listed there too. To change a fact, change every copy and its value
in `facts.json`; to move a copy, follow it there (the check fails with "N matches, not 1" until then).

## 7. Files and URLs

- Every URL the page loads is a contract between `index.html`, the server's allowlist (`frameworks/ward/server/static.js`, `SERVE`) and
  the build's output paths. The bundle's and the stylesheet's names (`index-DKbV5Nv9.js`, `index-D7hdwmUU.css`) are fixed: they are
  content-hash names from the original build, kept although the files changed (FINDINGS M-016).
- `world.js` and `dphys.js` must be the same bytes for the page and the server: the build writes both from the same sources, and the
  gate's scope step checks them.
