# Contracts: what one part of the game may rely on from another

A contract here is anything two owners share that one of them cannot change alone. Stage 3H renamed none of them: the names, message
types and fields below are what the accepted build uses, and the gate compares them with it.

## 1. The network protocol (B++)

JSON over one WebSocket (`/ws?room=NAME`), framed by `src/frameworks/bpp/server/ws.js`. The type is `t`.

| From the page | Handled by | | From the server | Handled on the page by |
|---|---|---|---|---|
| `p`: pose, light, look, movement (in a run every 50 ms, or 25 with the fresher poses; in the menu every 250 ms) | the session: `mvCheck` (S.P.A.C.E.) | | `hi`: your id | `mp.transport.js` |
| `join`, `respawn`, `leave` | the session: the world's lifecycle (S.P.A.C.E.) | | `s`: the snapshot (20 a second) | `mp.transport.js`, then the parts it names |
| `nr`: a NEW RUN press | `nrIntent` (B++) | | `q`: fresher poses (B+) | `peerPoses` (`mp.peers.js`) |
| `pick` | `sim.takeItem` (P.O.C.K.E.T.) | | `tp`: where you really are | `mp.transport.js`, `softTp` (`mp.peers.js`) |
| `admin`: the passcode | the session's check (W.A.R.D.) | | `world`: a new world epoch | `worldNew` (`mp.peers.js`) |
| `a`: an admin command | `adminCommand` (OVERSEER) | | `fx`: a death's or a blast's replay, or its end | `startFx` (`mp.replays.js`) |
| `caps`: ask for the fresher poses | the session | | `bodies`: everyone's bodies | `mp.bodies.js` |
| `ping` | the session (`pong`) | | `nra`: NEW RUN's answer; `nrf`: UNLIMITED NEW RUN's state | `nrAnswer` (`mp.newrun.js`), the admin menu |
| | | | `exit`, `got`: through a glitched wall; the cartograph taken | `mp.glitch.js`, `mp.cartograph.js` |
| | | | `admin`, `ares`, `kick`, `revive`, `msg`, `caps`, `pong` | `mp.admin.js`, `mp.transport.js` |

The messages' fields are listed in the Stage 3H0 protocol inventory
(`dev/archive/stage-3h0/3H0_PROTOCOL_INVENTORY.md`). The gate's protocol step checks every message of its runs against the accepted
build's (`dev/stage-3h/gate/protocol_v2.js`), and `raw_live` every exchange.

## 2. The page's globals

The classic scripts and the compiled bundle talk through `window`. A name here is a contract between its writer and its readers:
renaming one breaks the others silently.

<!-- generated: globals (dev/tools/docs/docs.js) -->
| Global | Written by | Read by |
|---|---|---|
| `window.__api` | `assets/index-DKbV5Nv9.js` | `assets/br-role.js`, `assets/l0-remaster.js`, `assets/mp-hum.js`, `assets/net-wire.js`, `assets/shadows-2d.js`, `assets/ui.js`, `camcorder.js`, `dphys.js`, `ents.js`, `glitch.js`, `gore.js`, `hud.js`, `inventory.js`, `light.js`, `move.js`, `mp.js`, `sfx.js` |
| `window.__avatarApp` | `assets/index-DKbV5Nv9.js` | - |
| `window.__boot` | `index.html` | `assets/ui.js` |
| `window.__brRole` | `assets/br-role.js` | `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js`, `assets/ui.js`, `camcorder.js` |
| `window.__c` | `assets/index-DKbV5Nv9.js` | - |
| `window.__cam` | `camcorder.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `light.js`, `mp.js` |
| `window.__cameraPolicy` | `camera_policy.js` | `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js` |
| `window.__dcamK` | `dphys.js` | `assets/index-DKbV5Nv9.js` |
| `window.__deathLight` | `mp.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `light.js` |
| `window.__deathLightNow` | - | `mp.js` |
| `window.__dlab` | `mp.js` | `assets/index-DKbV5Nv9.js`, `dphys.js`, `ents.js` |
| `window.__dphys` | `dphys.js` | `assets/index-DKbV5Nv9.js`, `ents.js`, `gore.js`, `mp.js` |
| `window.__dsndHits` | `ents.js` | `assets/index-DKbV5Nv9.js` |
| `window.__dvic` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__ents` | `ents.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `dphys.js`, `light.js`, `mp.js` |
| `window.__epochDebug` | `mp.js` | - |
| `window.__fxKill` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__fxKillS` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__fxs` | `mp.js` | - |
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
| `window.__keys` | `assets/ui.js` | `inventory.js` |
| `window.__kill` | `assets/index-DKbV5Nv9.js`, `mp.js` | - |
| `window.__killer` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__l0v` | `assets/l0-remaster.js` | `assets/index-DKbV5Nv9.js`, `gore.js` |
| `window.__lastCause` | `assets/index-DKbV5Nv9.js` | - |
| `window.__light` | `light.js` | `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `ents.js` |
| `window.__loadout` | `inventory.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` |
| `window.__mp` | `assets/shadows-2d.js`, `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__mpLib` | `assets/mp-hum.js`, `assets/net-interp.js`, `assets/net-newrun.js`, `assets/net-wire.js` | `mp.js` |
| `window.__mv` | `move.js` | `assets/index-DKbV5Nv9.js`, `ents.js`, `mp.js` |
| `window.__mvSfx` | `move.js` | - |
| `window.__net` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `window.__NET` | `mp.js` | `assets/net-interp.js` |
| `window.__netPose` | `mp.js` | `assets/net-interp.js` |
| `window.__nrDebug` | `mp.js` | - |
| `window.__peerBodies` | `mp.js` | `move.js` |
| `window.__peerLights` | `mp.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js`, `camcorder.js`, `light.js` |
| `window.__peerNet` | `mp.js` | - |
| `window.__PIXI_APP_INIT__` | - | `assets/RenderTargetSystem-CgUxHIsn.js` |
| `window.__PIXI_RENDERER_INIT__` | - | `assets/RenderTargetSystem-CgUxHIsn.js` |
| `window.__pose` | `move.js` | `assets/index-DKbV5Nv9.js` |
| `window.__settings` | `hud.js` | `assets/ui.js` |
| `window.__sfx` | `sfx.js` | `assets/index-DKbV5Nv9.js`, `assets/mp-hum.js`, `mp.js` |
| `window.__shadows` | `assets/shadows-2d.js` | - |
| `window.__ui` | `assets/ui.js` | - |
| `window.__uiCustomizeTab` | `assets/ui.js` | - |
| `window.__vol` | `hud.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` |
| `window.TFB_CREDITS` | `assets/credits_data.js` | `assets/ui.js` |
| `window.TFB_TIMING` | `timing_policy.js` | `assets/index-DKbV5Nv9.js` |
| `window.WORLD` | `world.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js`, `assets/shadows-2d.js`, `dphys.js`, `ents.js`, `gore.js`, `move.js`, `mp.js` |

63 names. Counted: `window.NAME` (and a UMD's `root.NAME`) in the served scripts, the compiled bundle and `index.html`'s own scripts. Not counted: a bare `__name` used without `window.`. A name nobody writes is a hook a test or the console may set.
<!-- end of generated block -->

`window.__api` is the bundle's facade. Its 52 members (some of them minified names) are their own contract, with each member's
TypeScript origin and its readers: [`src/core/client/bundle/API_CONTRACT.md`](../../src/core/client/bundle/API_CONTRACT.md).

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
| `core/server/loop.js` | `rooms`, `poseSend`, `aftStart`, `aftSend`, `aftTick`, `bodyAt`, `send`, `SNAP_EVERY`, `ADMIN_EVERY` | `tick` |

The world itself (`generated/server/sim.js`, `createSim(opts)`) returns the API the server uses: `step`, `entities`, `addPlayer`, `join`,
`respawn`, `leave`, `newRun`, `moveOk`, `moveRoute`, `spawnOk`, `admin`, ... (`src/core/server/sim.glue.js`, its last part).

## 4. The parts of one script

The parts of `mp.js`, `sim.js`, `ai.js`, `ents.js`, `world.js`, `move.js`, `camcorder.js` and `glitch.js` share their script's closure.
Each part's header lists what it provides, uses and writes; `node dev/tools/checks/parts.js` (the gate's `parts` step) proves every list
against the code. Those lists are the contracts between the parts: a name in another part's `uses` cannot be renamed alone.

## 5. Files and URLs

- Every URL the page loads is a contract between `index.html`, the server's allowlist (`frameworks/ward/server/static.js`, `SERVE`) and
  the build's output paths. The bundle's and the stylesheet's names (`index-DKbV5Nv9.js`, `index-D7hdwmUU.css`) are fixed: they are
  content-hash names from the original build, kept although the files changed (FINDINGS M-016).
- `world.js` and `dphys.js` must be the same bytes for the page and the server: the build writes both from the same sources, and the
  gate's scope step checks them.
