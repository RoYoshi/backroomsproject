# Stage 3H1: architecture audit of the accepted B++ game

**Status: BASELINE / AUDIT — no runtime file changed.** This audit describes the game as it is at the accepted B++ head. It is the starting point for any later Stage 3H refactor; it authorizes none.

Every statement here was checked against the source at that head. Machine-made facts are in `evidence/h1/`:
- the file manifest, load order, module graphs and globals: `inventory_bpp.json`, from `tools/h1_inventory.js`;
- the build reproducibility of the generated files: `build_reproducibility.json`, from `tools/h1_build_check.js`.

## 1. The parent

| | |
|---|---|
| Accepted B++ head | `stage-3e-0-bplusplus` `143b63ff42b88c6780c5043e0f61d64100f81f40`, tree `b25c26ec3eedab406a6b93f80a59ba6a1cb7c128` |
| How it was checked | `git ls-remote` and the GitHub REST branch read, before anything was created |
| Branch made | `stage-3h`, from exactly that commit. It did not exist on GitHub or locally |
| Remote branches before 3H1 | 29, none called `stage-3h` (`evidence/h1/remote_heads_before_3h1.json`) |

**Lineage.** The B++ head descends from the accepted Stage 3H0 head `06949a8`:
- Stage 3D (D0–D7, HQ1–HQ5) and Stage 3E-0 (B+, B++) followed it;
- that is 35 commits, which changed 17 runtime files.

The five 3H0 extractions are all present and still used:
- `assets/net-wire.js`;
- `assets/net-interp.js`;
- `server/ws.js`;
- `server/fields.js`;
- `server/static.js`.

## 2. What runs

### Node (the server)

**Start command.** `node server.js [port]`. `package.json` `start`, `run_linux.sh` and `run_windows.bat` all run it; the two scripts use port 8000.

**Environment variables read:**

| Variable | Meaning |
|---|---|
| `ADMIN_PASSCODE` | The admin passcode. The user owns it. |
| `BODY_TTL` | How long a corpse lasts. 0 means until a world reset. |
| `PORT` | Used when no port argument is given. |

**What `server.js` loads** (`require` closure, `inventory_bpp.json` `require`):

| Path | Loads |
|---|---|
| `server.js` | `./sim.js`, `./death_srv.js`, `./server/static.js`, `./server/peers.js`, `./server/ws.js`, `./server/fields.js` |
| `sim.js` | `./world.js`, `./ai.js` |
| `death_srv.js` | Reads `dphys.js` as text and runs it with `new Function`, the same code the browser runs |

Ten files in all are loaded by the server:
- server only: `server.js`, `sim.js`, `ai.js`, `death_srv.js` and the four `server/*.js`;
- shared with the browser: `world.js` (a UMD script) and `dphys.js` (run as text).

**Deployment** (read, not changed):
- `.github/workflows/deploy-bloom.yml` asks the Bloom host to restart on every push to `main`. The host then pulls `main`.
- No `stage-*` branch deploys.
- `redirect.js` is a separate one-file redirect service. It points at the production host; the address is not repeated here.

### The browser

`index.html` holds these tags, in document order (`inventory_bpp.json` `page`):

1. an inline boot script, which sets `window.__boot`;
2. two links: the PWA manifest and the favicon;
3. `camera_policy.js` and `timing_policy.js`;
4. the game bundle `assets/index-DKbV5Nv9.js` as `type="module"`. Module scripts are deferred, so **the bundle runs after every classic script below**;
5. nine `modulepreload` links, one for each PixiJS chunk the bundle imports statically;
6. two stylesheets: `assets/index-D7hdwmUU.css` and `assets/ui.css`;
7. the classic scripts, in this order:
   1. `world.js`
   2. `move.js`
   3. `camcorder.js`
   4. `sfx.js`
   5. `gore.js`
   6. `dphys.js`
   7. `light.js`
   8. `ents.js`
   9. `glitch.js`
   10. `assets/net-wire.js`
   11. `assets/net-interp.js`
   12. `mp.js`
   13. `assets/credits_data.js`
   14. `assets/ui.js`
   15. `hud.js`
   16. `inventory.js`
   17. `assets/br-role.js`
   18. `assets/level0_visuals.js`
   19. `assets/l0-remaster.js`

**Dynamic imports** (`inventory_bpp.json` `esm`):
- The bundle imports `browserAll-B-iwy0YI.js` dynamically, and that chunk imports `init-Cn1_BCi0.js`.
- It also names `webworkerAll-ByhiNG9W.js`, which **is not in the repository**. PixiJS loads it only inside a Web Worker, which the game never uses. See finding F-005.

**What the server serves.** `server/static.js` serves 45 files: the 43 its `SERVE` allowlist matches, plus the 2 audio files directly under `sounds/`. It never serves `dev/`, `server/`, `server.js`, `sim.js`, `ai.js`, `death_srv.js`, `package.json` or the documents. The B++ baseline checks this in the closed-world goldens (`srv_golden` `http_base`, `http_h0`) and on a real server (`static_check.js`). `assets/shadows-2d.js` (retired at BR-RoLE 1.0) is still served by the `assets/` rule but loaded by nothing.

**File roles at the head** (`roleCount`):

| Role | Files |
|---|---|
| Served only | 43 (41 by the allowlist, 2 under `sounds/`) |
| Server only | 8 |
| Both, served and loaded by the server (`world.js`, `dphys.js`) | 2 |
| Neither | 136: documents, sources, scripts, media sources |

Runtime bytes total 26,197,019. 22.6 MB of that is the two menu-theme WAVs.

## 3. The client: one hub, many spokes, joined by `window` globals

The client has no module system of its own:
- **The game bundle** is the hub. It holds PixiJS, the Level 0 map, the camera, the local game loop, the avatar and death classes, the HUD and the menus' game side. The PixiJS chunks are ordinary ES modules.
- **Every other file** is a classic script. Each publishes one or more `window` globals and reads the others' when it is called.

The full table of 60 globals, who sets each and who reads it, is in `3H1_DEPENDENCY_OWNERSHIP_MAP.md` §2. 58 of them are set by the page and the files it loads (one, `__boot`, by `index.html`'s inline script); the other two belong to `ai.js` (server only) and the retired `shadows-2d.js`. Three facts shape every refactor:

- **`window.__api` is the bundle's facade, and part of it is minified.**
  - Its 52 top-level members include named ones such as `death()`, `bodies()`, `mkAvatar()`, `tp()`, `fall()` and `started()`, and single letters such as `H` (the hero) and `G` (game state).
  - They also include the bundle's **minified internal identifiers** (`Bc`, `Uc`, `Oc`, `Fc`, `ll`, `ul`, `qc`, `Gc`, `Ic`, …).
  - 15 of the loaded files read `__api` (16 with the retired `shadows-2d.js`), so those one- and two-letter names are a de-facto public API. Rebuilding or re-minifying the bundle would break the game. See F-002.
- **The bundle calls out through globals every frame.**
  - It calls `window.__mp(...)` (mp.js's per-frame hook, which sends `p`).
  - It also refers to `window.__ents` 30 times, `__net` 26, `__cam` 24, `__mv` 12 and `__gore` 12, and to `__sfx`, `__brRole`, `__peerLights`, `__dphys`, `__pose`, `__light` and more.
- **Two globals have two writers in the loaded page,** as deliberate hand-offs:
  - `__kill`: mp.js sets it from the server's kill record, and the bundle's `beginDeath` takes it and clears it;
  - `__hideSelf`: `assets/ui.js` sets it before the bundle runs; the bundle clears it at every start and sets it again when a NEW RUN is approved and at END.

  The order of those writes is part of the behavior. A third, `__mp`, would also be set by `assets/shadows-2d.js` if that retired file were ever loaded again. Recorded, not changed (F-006).

**Audio has no single owner.** There are three real-time `AudioContext`s:
- **the bundle's,** shared through `__api.audio()` with `sfx.js`, `ents.js`, `move.js`, `glitch.js`, `camcorder.js`, `hud.js`, `inventory.js`, `assets/ui.js`, and `mp.js`'s fluorescent hum (`mp.js` line 947);
- **mp.js's own,** for the dread drone, thumps and capture burst (`initAudio`, line 369);
- **`assets/ui.js`'s own,** for the menu theme (line 441). The theme also decodes in an `OfflineAudioContext`.

The game's graph only exists once a run starts, which is why the menu has its own.

## 4. The server: one composition root

`server.js` (41,751 bytes, 469 lines) holds:
- the configuration;
- movement validation, including B++-0's placement guard;
- player solidity, using `server/peers.js`;
- the death and NEW RUN aftermath, using `death_srv.js`;
- the world reset;
- the admin commands and authentication;
- the WebSocket sessions (`upgrade` and `onMessage`);
- the tick: 25 ms wakes, 60 Hz simulation steps, 20 Hz `s` snapshots, B+'s `q` on the ticks between snapshots, admin and debug cadences.

The section map with line numbers is in `3H1_DEPENDENCY_OWNERSHIP_MAP.md` §4.

**`sim.js` and `ai.js` are the server's authority:**
- `sim.js` holds the Level 0 map, collision, rays and light, extracted from the bundle, plus the "multiplayer glue": players, NEW RUN, bodies, glitched walls, items and the admin tools.
- `ai.js` is N.A.N.I.: the Hounds' and Smilers' perception, memory, traits, navigation and capture.
- Neither file is served.

## 5. Source provenance: three runtime files are build outputs

**`ai.js`, `ents.js` and `sim.js` are not edited by hand.** They are concatenations made by build scripts:

| Runtime file | Built by | From |
|---|---|---|
| `ai.js` | `dev/build_ai.sh` | `dev/ai_src/` (10 parts) |
| `ents.js` | `dev/build_ents.sh` | `dev/ents_src/` (6 parts) |
| `sim.js` | `dev/build_sim.sh` | `dev/sim_head.js` + `dev/sim_glue.js` |

`tools/h1_build_check.js` rebuilt each one in memory from the sources at the B++ head, without running the scripts (they would write over the runtime files). **All three are byte-identical** (`build_reproducibility.json`).

- **Any change to these three must be made in their sources and rebuilt**, with this check run afterwards. A hand edit would be lost at the next build.
- **The parts share one closure.** `ents_src/00_head.js` opens the IIFE and `40_debug.js` closes it; `ai_src` is one UMD factory. The source split is real ownership, but the parts cannot become separate runtime scripts without a redesign.
- **The game bundle has no source in the repository.** It is the original Vite build, patched in place since: 38 commits have touched it, its first version included. `dev/sim_head.js` holds the map, collision and ray code extracted from it. So **the Level 0 map exists twice**, in the bundle and in `sim.js` (3H0 finding, still true).
- `assets/br-role.js`, `assets/l0-remaster.js`, `assets/level0_visuals.js`, `assets/ui.js` and the other classic scripts are hand-maintained in place.

## 6. Two paths end to end

### A pose (B++)

1. **Local movement.** `move.js` steps the Wanderer at fixed 60 Hz steps (the bundle's loop, `timing_policy.js`). It steers round the other players' server positions, `window.__peerBodies`.
2. **Send.** The bundle calls `window.__mp` every frame. mp.js sends `p` (position, velocity, heading, light, gear, look, movement state `mv`):
   - every 25 ms once the server has answered `caps`;
   - otherwise every 50 ms;
   - every 250 ms outside a run.
3. **Server intake.** `onMessage` first gives every `p`'s movement state to `sim.hearMove` (what N.A.N.I. may hear), throttled or not. It then throttles positions: 16 ms for clients that asked, 30 ms otherwise. Then:
   - `mvCheck`: the budget, walls (`sim.moveOk` / `moveRoute`), other players (`server/peers.js`) and B++-0's placement guard;
   - `mvAccept`.
4. **Server output.** The tick steps the simulation at 60 Hz. Every 2nd 25 ms tick it sends each client `s`, with the other players, entities, own state, world epoch `w`, and `k` for fast clients. On the ticks between, it sends fast clients `q`: the other players whose accepted pose changed.
5. **Client intake.**
   - `s` sets each peer's target and rebuilds `__peerBodies` from the server positions.
   - `q` updates the targets of known, living players in this world (`w`) if newer (`k`).
   - Every frame, `drawPeers` eases the drawn pose by elapsed time (Option B), drives the avatar made by `__api.mkAvatar`, and publishes the peers' lights in `window.__peerLights`.
   - BR-RoLE (`assets/br-role.js`) lights from those lights and casts each avatar's shadow and ground contact.
6. **Entities** come in `s.e`. `assets/net-interp.js` keeps their history and returns a delayed pose each frame; `ents.js` draws and voices them.

### A kill (N.A.N.I. → S.P.A.C.E. → B++ → BR-R / Spacious Audio / BR-RoLE → G.I.B.)

1. **The decision.** `ai_src/40_capture.js` `killNow` picks the variant and emits a `kill` event. N.A.N.I. decides from its own perception; it does not read the player directly as truth.
2. **The commit.** `sim_glue.js` `processEvents` commits the death: `p.dead`, `p.dseq++`, and the kill record `p.kill` (variant, attacker, wall). It then calls `onDeath`.
3. **The aftermath.** `server.js` `aftStart` opens it: the death id `de`, the light-failure profile, the replay message (`death_srv.fxFor`), and the server's own run of the same `dphys.js` physics (`death_srv.begin`).
4. **The messages:**
   - the victim's snapshots carry `me` and `mk` (the kill record);
   - every other client gets `fx` once (`aftSend`);
   - when the death's time has passed, `aftTick` makes the corpse from the last physics frame (`death_srv.corpse`) and shares it in `bodies`.
5. **The clients:**
   - The victim's bundle plays the death with `dphys.js` (`window.__dphys`):
     - `ents.js` (`ents_src/25_death.js`) gives its choreography for the server's variant;
     - `gore.js` draws the wounds;
     - the bundle makes the death sound, with `ents.js`'s `__dsndHits` timings;
     - mp.js keeps the dying light's timeline (`window.__deathLight`) for BR-RoLE.
   - Spectators replay `fx` the same way (mp.js `startFx`).
   - mp.js `wallStains` hands wall impacts to `gore.js`, which stamps them into the remaster's wall art (`window.__l0v.surfaces`).

## 7. What changed since the 3H0 maps

The 3H0 documents describe the QA2 parent. Since then:
- **`mp.js` grew** from 68,139 to 96,283 bytes:
  - Stage 3D's replays, death lights, wall stains and NEW RUN state;
  - HQ2's soft corrections and world epoch;
  - B+'s caps, `q` and easing.
- **`server.js` grew** from 26,506 to 41,751 bytes:
  - the server-made aftermath and NEW RUN blast;
  - player solidity;
  - the world reset;
  - B+'s `poseSend`;
  - B++-0's placement guard.
- **A fourth module in `server/`**, `peers.js` (HQ2), sits beside 3H0's three.
- **The client sends neither `fx` nor `b` any more.** Deaths and corpses are the server's. The client sends two new message types, `caps` and `nr`. The server sends:
  - five new message types: `world`, `caps`, `q`, `nra` and `nrf`;
  - 11 new keys: `w`, `k` and `nf` in `s`; `w` in `bodies`; `pc` in `tp`; `de`, `wn`, `lo`, `lf`, `d` and `s` in `fx`.

  3H0's frozen protocol contract therefore no longer matches B++ (`evidence/h1/wire_keys.json`, F-003).

Three of 3H0's harnesses still run unchanged on B++: `srv_golden`, `cli_golden` and `perf_det`. They are the comparison base here, re-recorded on B++ (`3H1_SOURCE_PARITY_BASELINE.md`). Its contract checker runs but reports its contract's age (F-003), and `raw_live.js` and `live_wire.js` do not run on B++ (F-021).

## 8. Which framework names are real code today

**Real code:**
- **B++** is real code spread over `mp.js`, `server.js` and five small modules (3H0's three in `server/`, and `assets/net-wire.js`, `assets/net-interp.js`).
- **BR-RoLE** is one real module.
- **N.A.N.I.** is one real (built) module.
- **G.I.B.** and **S.P.A.C.E.** are partly real modules (`dphys.js`, `gore.js`, `death_srv.js`; `server/peers.js`, `world.js`, `move.js`). Their cores sit inside `server.js`, `mp.js`, `sim.js` and the bundle.
- **OVERSEER** exists in pieces.

**Organisational names only, with no module:**
- BR-R;
- Spacious Audio;
- L.O.S.T.;
- P.U.L.S.E.;
- CASHIER.

**Not implemented at all:**
- **E.C.H.O.:** there is no audio occlusion code.
- **LogicZ:** reserved.
- **P.O.C.K.E.T.** and the other proposed names: proposals only.

`3H1_FRAMEWORK_REGISTRY.md` maps each name to the actual files and functions.
