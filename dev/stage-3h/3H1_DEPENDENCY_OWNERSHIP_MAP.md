# Stage 3H1: dependency and ownership map (accepted B++ head `143b63f`)

**What this covers.** Every runtime file, mapped from what it is to what should happen to it in Stage 3H:

| Column | Meaning |
|---|---|
| Loaded by | How it is loaded |
| Publishes | The interface it publishes |
| Read by | Who uses it |
| Reads | What it depends on |
| Risk | The risk of touching it |
| Owner | The framework name it belongs to (`3H1_FRAMEWORK_REGISTRY.md`) |
| Probe | The baseline that would catch a change (`3H1_SOURCE_PARITY_BASELINE.md`) |
| Verdict | The 3H verdict for it |

The two composition roots, `server.js` and `mp.js`, are then mapped section by section.

**Sources.** The tables come from `evidence/h1/inventory_bpp.json` (`tools/h1_inventory.js` reads Git at the head). That tool scans text, so every row was then checked by reading the code. The verdict words are defined in `3H1_EXTRACTION_CANDIDATES.md`.

**Risk scale:**

| Risk | Meaning |
|---|---|
| Very high | Accepted most recently, or timing or authority. A change is felt at once. |
| High | Visible presentation, or a hub many files read. |
| Medium | Self-contained, but stateful or audible. |
| Low | Pure, or data only. |

**Probe keys:**

| Key | What it is |
|---|---|
| srv | `srv_golden` traces |
| bpp | `bpp_golden` traces |
| cli | `cli_golden` traces |
| wire | `wire_keys.json` |
| 2b | `two_browser.py` |
| col | HQ2 collision cases |
| lab | `contact_lab.py` |
| smoke | HQ4 gameplay smoke |
| suites | The existing test suites |
| build | `h1_build_check.js` |
| static | `static_check.js` |

## 1. Server side (loaded by `node server.js`)

| File | Loaded by | Publishes | Read by | Reads | Risk | Owner | Probe | Verdict |
|---|---|---|---|---|---|---|---|---|
| `server.js` (41,751 B) | `node server.js` | the HTTP server and WebSocket game server; nothing exported | (entry point) | everything below | Very high | B++ (sessions, snapshots, `q`), S.P.A.C.E. (movement validation), G.I.B. (aftermath), OVERSEER (admin) | srv, bpp, wire, 2b, col, suites | NO-GO as a whole; mapped in §4 |
| `server/ws.js` (2,170 B) | `require` | `frame`, `reader` | `server.js` | Node only | Low | B++ transport | srv (`ws_frames`) | NOT A SEAM: already a module (3H0) |
| `server/fields.js` (1,770 B) | `require` | `num`, `kindOf`, `cleanParts`, `HEX`, `DEFAULT_LOOK`, `cleanLook` | `server.js` | — | Low | B++ input validation | srv (`p_fields`) | NOT A SEAM (3H0) |
| `server/static.js` (4,096 B) | `require` | the request handler factory (the `SERVE` allowlist, MIME types, gzip cache, `/sounds`) | `server.js` | fs, zlib | Medium: security allowlist | B++ delivery; CASHIER (gzip cache); W.A.R.D. concern | srv (`http_base`, `http_h0`), static | NOT A SEAM (3H0); allowlist untouchable without a security stage |
| `server/peers.js` (5,823 B) | `require` | `D_BODY`, `TOL`, `legal`, `resolve`, `sweepPath`, `freeSpot` | `server.js` | — | High: collision feel | S.P.A.C.E. | srv, bpp, col | NOT A SEAM: already a module (HQ2) |
| `sim.js` (29,413 B, **built**) | `require('./sim.js')` | `createSim(opts)`: players, join/respawn/leave/newRun, step, entities, moveOk/moveRoute/spawnOk/clearAt, bodies, admin API, capInfo, hearMove | `server.js`, `death_srv.js` (via the sim passed in) | `world.js`, `ai.js` | Very high: authority | S.P.A.C.E. + N.A.N.I. integration; L.O.S.T. (map copy) | srv, bpp, build, suites | NO-GO; edit only in `dev/sim_head.js` / `dev/sim_glue.js` + rebuild |
| `ai.js` (206,697 B, **built**) | `require` from `sim.js` | the UMD `AI` factory: `create`, species, traits, senses, capture | `sim.js` | `world.js` | Very high: AI reasoning | N.A.N.I. | srv (`deaths`, `schedule`), suites (`npm test`), build | NO-GO; source is `dev/ai_src/` (10 parts, one closure) |
| `death_srv.js` (5,830 B) | `require` | `fxFor`, `bodyFor`, `begin`, `step`, `corpse`, `durOf`, `DP`, `boomFx`, `boomBegin` | `server.js` | `dphys.js` text, run with `new Function` | High: death timing and corpses | G.I.B. (server side) | srv (`deaths`), bpp (`caps_q` death), smoke | NO-GO now (Stage 3D accepted recently) |
| `world.js` (24,622 B, **shared**) | `require` (server) and a classic script (browser) | UMD `WORLD`: props, surfaces, movement constants, `carve` | sim, ai, the bundle, move, mp, dphys, ents, gore, br-role, l0-remaster | — | Very high: both sides | S.P.A.C.E. / L.O.S.T. data | srv, cli, 2b, suites | NO-GO: any byte changes both server and client |
| `dphys.js` (66,180 B, **shared**) | classic script (browser) and text run by `death_srv.js` | `__dphys` (`simulate`, `prepare`, `advance`, `finish`, `lightPower`, `marks`, `releaseOf`, …), `__dcamK` | bundle, mp, ents, gore, `death_srv.js` | `__api`, `WORLD`, `__dlab`, `__ents` | Very high: deaths on both sides | G.I.B. | srv (`deaths`), cli (`fx_bodies`), smoke, lab | NO-GO |

**Cycles.** There are no `require` cycles. `ai.js`'s UMD branch requires `./world.js`; it names `./ai.js` only in its header comment.

`dphys.js` and `world.js` are the two files whose bytes the server and the browser both execute. Neither can change for one side alone.

## 2. Client globals: who sets each, who reads it

From `inventory_bpp.json`:
- **"Set by"** means a `window.x =`, `globalThis.x =` or UMD `root.X =` assignment.
- **"Read by"** means the code mentions `__name` outside the setting file. Comments are removed before the scan: `glitch.js`'s header comment shows `window.__glitches = [...]` but the file only reads it, and `assets/br-role.js` and `assets/net-interp.js` name `__light`, `__NET` and `__netPose` only in comments.
- The five UMD names (`WORLD`, `AI`, `TFB_TIMING`, `L0_VISUALS`, `TFB_CREDITS`) are read by their bare names or as `window.NAME`. Their readers were found by search and each match was read: string literals such as `'WORLD FROZEN'` (server.js) or `'AI EVENTS'` (ents.js, mp.js) are not reads.

**One global comes from the page itself.** `index.html`'s inline boot script sets `window.__boot`, the boot gate's states. The inventory reads the page's inline scripts as well as the script files.

**Marker properties are not globals.** Mentions such as `__cause`, `__key`, `__hound` and `__smiler` are properties on PixiJS objects. The inventory lists them under "mentioned"; they are left out here.

| Global | Set by | Read by (code mentions, comments excluded) |
|---|---|---|
| `AI` | `ai.js` | `sim.js` (`require`, server only); never in the browser |
| `__api` | `assets/index-DKbV5Nv9.js` | `assets/br-role.js`, `assets/l0-remaster.js`, `assets/net-wire.js`, `assets/shadows-2d.js` (not loaded), `assets/ui.js`, `camcorder.js`, `dphys.js`, `ents.js`, `glitch.js`, `gore.js`, `hud.js`, `inventory.js`, `light.js`, `move.js`, `mp.js`, `sfx.js` |
| `__avatarApp` | `assets/index-DKbV5Nv9.js` | `assets/ui.js` |
| `__boot` | `index.html` (its inline boot script, line 16) | `assets/ui.js` |
| `__brRole` | `assets/br-role.js` | `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js`, `assets/ui.js`, `camcorder.js` |
| `__c` | `assets/index-DKbV5Nv9.js` | - |
| `__cam` | `camcorder.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js` (not loaded), `light.js`, `mp.js` |
| `__cameraPolicy` | `camera_policy.js` | `assets/index-DKbV5Nv9.js`, `assets/l0-remaster.js` |
| `__dcamK` | `dphys.js` | `assets/index-DKbV5Nv9.js` |
| `__deathLight` | `mp.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `light.js` |
| `__dlab` | `mp.js` | `assets/index-DKbV5Nv9.js`, `dphys.js`, `ents.js` |
| `__dphys` | `dphys.js` | `assets/index-DKbV5Nv9.js`, `death_srv.js`, `ents.js`, `gore.js`, `mp.js` |
| `__dsndHits` | `ents.js` | `assets/index-DKbV5Nv9.js` |
| `__dvic` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `__ents` | `ents.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js` (not loaded), `dphys.js`, `light.js`, `mp.js` |
| `__epochDebug` | `mp.js` | - |
| `__fxKill` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `__fxKillS` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `__fxs` | `mp.js` | - |
| `__glitches` | `mp.js` | `glitch.js` |
| `__glitchFrame` | `glitch.js` | `mp.js` |
| `__glitchSolo` | `mp.js` | - |
| `__glitchSound` | `glitch.js` | `mp.js` |
| `__gore` | `gore.js` | `assets/index-DKbV5Nv9.js`, `ents.js`, `mp.js` |
| `__hideBodies` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `__hideSelf` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` | - |
| `__hounds` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `__hud` | `hud.js` | - |
| `__inv` | `inventory.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js`, `mp.js` |
| `__items` | `mp.js` | `glitch.js` |
| `__itemSolo` | `mp.js` | - |
| `__keys` | `assets/ui.js` | `inventory.js` |
| `__kill` | `assets/index-DKbV5Nv9.js`, `mp.js` | - |
| `__killer` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `L0_VISUALS` | `assets/level0_visuals.js` | `assets/l0-remaster.js` |
| `__l0v` | `assets/l0-remaster.js` | `assets/index-DKbV5Nv9.js`, `gore.js` |
| `__lastCause` | `assets/index-DKbV5Nv9.js` | - |
| `__light` | `light.js` | `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js` (not loaded), `ents.js` |
| `__loadout` | `inventory.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` |
| `__mp` | `assets/shadows-2d.js` (not loaded), `mp.js` | `assets/index-DKbV5Nv9.js` |
| `__mpLib` | `assets/net-interp.js`, `assets/net-wire.js` | `mp.js` |
| `__mv` | `move.js` | `assets/index-DKbV5Nv9.js`, `ents.js`, `mp.js` |
| `__mvSfx` | `move.js` | - |
| `__NET` | `mp.js` | - |
| `__net` | `mp.js` | `assets/index-DKbV5Nv9.js` |
| `__netPose` | `mp.js` | - |
| `__nrDebug` | `mp.js` | - |
| `__peerBodies` | `mp.js` | `move.js` |
| `__peerLights` | `mp.js` | `assets/br-role.js`, `assets/index-DKbV5Nv9.js`, `assets/shadows-2d.js` (not loaded), `camcorder.js`, `light.js` |
| `__peerNet` | `mp.js` | - |
| `__pose` | `move.js` | `assets/index-DKbV5Nv9.js` |
| `__settings` | `hud.js` | `assets/ui.js` |
| `__sfx` | `sfx.js` | `assets/index-DKbV5Nv9.js`, `mp.js` |
| `__shadows` | `assets/shadows-2d.js` (not loaded) | - |
| `TFB_CREDITS` | `assets/credits_data.js` | `assets/ui.js` |
| `TFB_TIMING` | `timing_policy.js` | `assets/index-DKbV5Nv9.js` |
| `__ui` | `assets/ui.js` | - |
| `__uiCustomizeTab` | `assets/ui.js` | - |
| `__vol` | `hud.js` | `assets/index-DKbV5Nv9.js`, `assets/ui.js` |
| `WORLD` | `world.js` | `ai.js` and `sim.js` (`require`, server), `assets/index-DKbV5Nv9.js`, `assets/br-role.js`, `assets/l0-remaster.js`, `dphys.js`, `ents.js`, `gore.js`, `move.js`, `mp.js` (all `window.WORLD`); `assets/shadows-2d.js` (not loaded) |

**What the table shows:**
- **Hub and spokes.** The bundle reads 29 of these globals and sets 6. `__api` is read by 15 loaded files (16 with the retired `shadows-2d.js`). Its 52 members expose the bundle's internals, some under minified names. **No spoke can be moved, renamed or loaded later without checking every name it publishes and reads.**
- **Globals with more than one writer.** Each is a deliberate hand-off, so the order of the writes is part of the behavior (F-006):
  - `__kill`: mp.js sets it from the server's kill record (`announceKill`) and clears it at join, respawn, a new world and a closed connection; the bundle's `beginDeath` takes it (if under 9 s old) and sets it to `null`;
  - `__hideSelf`: `assets/ui.js` sets it to `true` while it loads, before the module bundle runs, so the visitor's own wanderer is not drawn in the menu; the bundle clears it at every start (`Su()`) and sets it again at END;
  - `__mp`: only mp.js in the page; the retired `shadows-2d.js` would also set it but is not loaded.
  - `__mpLib` is one namespace shared on purpose: `net-wire.js` adds `.wire` and `net-interp.js` adds `.interp`.
- **DEV-only globals are part of the surface the tests read:** `__peerNet`, `__epochDebug`, `__nrDebug`, `__fxs`, `__glitchSolo`, `__itemSolo` and `__dlab`. Removing one breaks tools, not the game.

**Cycles.** Every spoke reads `__api`, and the bundle reads the spokes' globals, so the client is one cycle through `window`.
- **It works because nothing reads a global at load time:** each script reads the others when called. The rule in `3H0_ARCHITECTURE_MAP.md` §2 still holds for every file checked here.
- **The ES-module chunks have one cycle:** `browserAll-B-iwy0YI.js` imports `index-DKbV5Nv9.js`, which imports `browserAll` dynamically. That is PixiJS's own structure.

## 3. Client files

| File (bytes) | Loaded by (order) | Publishes | Read by | Reads | Risk | Owner | Probe | Verdict |
|---|---|---|---|---|---|---|---|---|
| `index.html` (24,478) | the page | load order, DOM ids, inline boot script, `<link>`s | everything | — | Very high: load order | F.R.O.N.T. (proposed) / BR-R | cli (`load`), static, smoke | NO-GO: a reorder changes every global's writer |
| `camera_policy.js` (2,064) | classic 1 | `__cameraPolicy` | bundle, l0-remaster | — | High: camera fairness | BR-R (camera) | `test_3bn.js`, suites | NOT A SEAM (already a module) |
| `timing_policy.js` (1,634) | classic 2 | `TFB_TIMING` | bundle | — | Very high: 60 Hz stepping | P.U.L.S.E. / S.P.A.C.E. timing | suites (`s_fps_equality`), 2b | NOT A SEAM |
| `assets/index-DKbV5Nv9.js` (340,823) | module (runs last) | `__api`, `__avatarApp`, `__hideSelf`, `__kill`, `__lastCause`, `__c` | everyone | every spoke | Very high: no source in the repo; minified API | BR-R core + game loop | cli, 2b, smoke, lab | **NO-GO**: cannot be rebuilt (F-002) |
| PixiJS chunks (11 files, 327,322 B: 9 preloaded, plus `browserAll` and `init` imported on demand) | `modulepreload` + imports | ES exports | bundle | each other | Very high: vendor build | (vendor) | smoke | NO-GO: vendor output |
| `world.js` (24,622) | classic 3 (also server) | `WORLD` | see §1 | — | Very high | S.P.A.C.E. / L.O.S.T. | §1 | NO-GO |
| `move.js` (25,061) | classic 4 | `__mv`, `__pose`, `__mvSfx` | bundle, ents, mp | `__api`, `__peerBodies`, `WORLD` | Very high: local movement feel | S.P.A.C.E. (client) + Spacious Audio (`__mvSfx`) | 2b, col, suites (`movement_parity2f`), smoke | NO-GO |
| `camcorder.js` (32,494) | classic 5 | `__cam` | bundle, br-role, light, mp | `__api`, `__brRole`, `__peerLights` | High: NV look and audio | BR-R + Spacious Audio | suites (`ir_net`), lab | NOT A SEAM; NO-GO for changes |
| `sfx.js` (3,677) | classic 6 | `__sfx` | bundle, mp | `__api.audio()`, `/sounds` listing | Medium: audio | Spacious Audio | cli (`hum_dread` records audio calls) | NOT A SEAM; audio locked |
| `gore.js` (39,845) | classic 7 | `__gore` | bundle, ents, mp | `__api`, `__dphys`, `__l0v.surfaces`, `WORLD` | High: visible gore | G.I.B. | smoke, lab (`lifecycle`) | NO-GO (Stage 3D) |
| `dphys.js` (66,180) | classic 8 (also server) | `__dphys`, `__dcamK` | see §1 | see §1 | Very high | G.I.B. | §1 | NO-GO |
| `light.js` (5,984) | classic 9 | `__light` | bundle, ents | `__api`, `__cam`, `__peerLights`, `__deathLight`, `__ents` | High: entity visibility in the dark | BR-RoLE / BR-R light data | suites (`light_test`), lab | NOT A SEAM; NO-GO for changes |
| `ents.js` (79,335, **built**) | classic 10 | `__ents`, `__dsndHits` | bundle, br-role, dphys, light, mp | `__api`, `__gore`, `__dphys`, `__mv`, `__dlab`, `WORLD`, `__light` | High: entity look and voice | BR-R (drawing) + Spacious Audio (voices) + G.I.B. (death plans) + OVERSEER (debug overlay) | cli, smoke, build | NO-GO; source `dev/ents_src/` |
| `glitch.js` (9,829) | classic 11 | `__glitchFrame`, `__glitchSound` | mp | `__api`, `__glitches`, `__items` (both written by mp.js) | Medium: visual and audio | BR-R + Spacious Audio; L.O.S.T. (exits) | cli (`run_online`), suites | NOT A SEAM |
| `assets/net-wire.js` (3,717) | classic 12 | `__mpLib.wire` | mp | `__api` (when called) | Low: pure | B++ codec | cli, wire, `fn_equiv` | NOT A SEAM (3H0) |
| `assets/net-interp.js` (4,163) | classic 13 | `__mpLib.interp` (mp.js republishes its `NET` and `netPose` as the DEV hooks `__NET`, `__netPose`) | mp | no global | Medium: entity smoothing | B++ interpolation | cli (`interp`), `interp_test` | NOT A SEAM (3H0) |
| `mp.js` (96,283) | classic 14 | `__net`, `__mp`, `__peerBodies`, `__peerLights`, `__deathLight`, … (23 globals) | bundle, move, br-role, light, camcorder, glitch, dphys and ents (`__dlab`) | almost everything | Very high: B++ client, freshly accepted | B++ (client) + G.I.B. (replays) + OVERSEER (admin panel) + Spacious Audio (hum, dread) | cli, 2b, wire, smoke, lab | NO-GO as a whole; mapped in §5 |
| `assets/credits_data.js` (2,170) | classic 15 | `TFB_CREDITS` | `assets/ui.js` | — | Low: data | F.R.O.N.T. (proposed) | — | NOT A SEAM (data the user edits) |
| `assets/ui.js` (97,475) | classic 16 | `__ui`, `__keys`, `__hideSelf`, `__uiCustomizeTab` | inventory | `__api`, `__avatarApp`, `__boot`, `__settings`, `__vol`, `__loadout`, `__inv`, `__brRole`, `TFB_CREDITS` | High: menus, boot, theme music | F.R.O.N.T. (proposed); Spacious Audio (menu theme) | cli (`load`, `menu_online`), smoke | NOT A SEAM; NO-GO for changes (Stage 3C QA2 accepted) |
| `hud.js` (7,692) | classic 17 | `__hud`, `__settings`, `__vol` | ui.js, bundle | `__api` | Medium: saved settings (`localStorage` `fb_settings_v1`) | F.R.O.N.T. / V.A.U.L.T. (proposed) | cli, smoke | NOT A SEAM |
| `inventory.js` (20,901) | classic 18 | `__inv`, `__loadout` | bundle, ui.js, mp | `__api`, `__keys` | Medium: items | P.O.C.K.E.T. (proposed) | smoke | NOT A SEAM; items locked for 3H |
| `assets/br-role.js` (136,371) | classic 19 | `__brRole` | bundle, l0-remaster, ui.js, camcorder | `__api`, `__peerLights`, `__ents`, `__cam`, `__deathLight`, `WORLD` | Very high: BR-RoLE 1.2 (HQ5) | BR-RoLE | lab, `test_br_role`, 2b, smoke | NO-GO |
| `assets/level0_visuals.js` (30,303) | classic 20 | `L0_VISUALS` | l0-remaster | — | High: visual data | L.O.S.T. + BR-R | suites (`dev/stage-3b`) | NOT A SEAM |
| `assets/l0-remaster.js` (189,557) | classic 21 | `__l0v` (incl. `surfaces` for wall stains) | bundle, gore | `__api`, `L0_VISUALS`, `__brRole`, `__cameraPolicy`, `WORLD` | High: the whole level's look | BR-R / L.O.S.T. | smoke, lab | NO-GO for changes |
| `assets/index-D7hdwmUU.css`, `assets/ui.css` | `<link>` | styles | the DOM | — | High: look | F.R.O.N.T. | menu captures (QA2 tools) | NO-GO |
| media (logo PNG, `carpet.png`, menu WAVs, `sounds/*.mp3`, `favicon.ico`) | fetched | bytes | the bundle (`carpet.png`); `index.html`, `assets/ui.js` and `assets/ui.css` (the logo); `assets/ui.js` (the WAVs); `sfx.js` (`sounds/`); the browser (`favicon.ico`) | — | Very high: user-supplied assets | A.T.L.A.S. (proposed) | static, scope check | NO-GO: byte-locked |
| `assets/shadows-2d.js` (74,094) | **not loaded** (served only) | would set `__mp`, `__shadows` | — | — | Low: unused | — | — | Leave as is (F-004) |

## 4. `server.js` section by section

Line numbers are at `143b63f`.

| Lines | What | Owner | Coupled to | Verdict |
|---|---|---|---|---|
| 1–28 | requires (`death_srv.js` at line 28); config: port, room cap 8, admin passcode → hash, `BODY_TTL`, tick constants, `FAST_GAP`; `srv`; rooms; `nextId` | B++ / OVERSEER | everything | NO-GO (config is the contract) |
| 30–58 | `MV` (movement constants), the solidity notes, `PEERS`, `solidP`, `blockers` | S.P.A.C.E. | `mvCheck`, peers | NO-GO |
| 59–64 | `peerCorrect` (soft `tp pc:1`) | S.P.A.C.E. / B++ | `mvCheck`, `send` | NO-GO |
| 65–78 | `placeFree`, `mvReset` (B++-0 `place`), `mvAccept` | S.P.A.C.E. | every placement | **NO-GO: B++-0 surface** |
| 79–113 | `mvCheck` with B++-0's placement guard | S.P.A.C.E. (anti-cheat) | `onMessage`, `room.sim` | **NO-GO: highest risk** |
| 116–163 | death aftermath: `aftStart`, `aftOf`, `aftSend`, `aftTick` | G.I.B. (server) | tick, `death_srv`, `send`, `room.afts`, `putBody` | NO-GO now; CANDIDATE-LATER (`3H1_EXTRACTION_CANDIDATES.md` C-2) |
| 164–181 | `worldReset` | B++ (epoch) + S.P.A.C.E. (placement) | aftermath, `placeFree`, `mvReset` | NO-GO |
| 182–188 | `bodyAt`, `putBody`, `moveTo` | G.I.B. / S.P.A.C.E. | snapshot `bodies` (ages), admin tools | NO-GO |
| 189–203 | `adminMove` (admins unchecked) | OVERSEER / S.P.A.C.E. | `onMessage` | NO-GO |
| 204–245 | NEW RUN authority: `NR_GAP`, `boomStart`, `nrIntent` | G.I.B. + game rules | aftermath, `sim.newRun`, `send` | `nrIntent` and `NR_GAP`: RECOMMENDED (C-1); `boomStart` goes with the aftermath (C-2) |
| 246–249 | `{ frame, reader }`, `send`, the field checks | B++ | 3H0 modules | — (already the seam) |
| 250–255 | `getRoom` | B++ sessions | tick, upgrade | NO-GO (S4) |
| 256–320 | `adminCommand` | OVERSEER | sim admin API, `moveTo`, `worldReset`, aftermath | NO-GO (S5b; private findings first) |
| 321–397 | `upgrade` → `onMessage` (`p`, `join`, `respawn`, `leave`, `pick`, `nr`, `admin`, `a`, `caps`, `ping`), `bye` | B++ sessions + S.P.A.C.E. intake | everything | **NO-GO (S4; B+ `caps` / `FAST_GAP`)** |
| 398–413 | `poseSend` (B+ `q`) | B++ | tick, `c.snap` | **NO-GO: highest risk** |
| 415–468 | the tick: 25 ms wake, 60 Hz steps, `pf` statistics, aftermath, `bodies`, `s` (with `k`), admin and debug cadences | B++ (S5) + P.U.L.S.E. (`pf`) | everything | **NO-GO (S5: timing authority)** |
| 469 | `listen` | B++ | — | NO-GO |

## 5. `mp.js` section by section

Line numbers are at `143b63f`.

| Lines | What | Owner | Coupled to | Verdict |
|---|---|---|---|---|
| 1–37 | bootstrap: `#net` badge, `?room=`, B+ `PEER_MODE` / `PEER_SNAP` / `fastAck` / `lastK` / `PN`, session variables, entity slots, `adm` | B++ | everything | **NO-GO** |
| 38–72 | the `window.__net` facade and packet builders | B++ | the bundle (26 references) | NO-GO (C4) |
| 73–80 | own death record (`__dvic`, `ownDeath`, `mkAt`) | G.I.B. | transport, bundle | NO-GO |
| 81–103 | NEW RUN state and words (`nrButton`, `nrAnswer`, `runMenuWords`, `__nrDebug`) | F.R.O.N.T. / game rules | `__net.nr`, transport, bundle | NO-GO now; its button and words are C-3 (CANDIDATE-LATER) |
| 104–138 | B+: `solidPeers`, `peerPoses` (`q`), `__peerNet` | B++ / S.P.A.C.E. (`__peerBodies`) | transport, move.js | **NO-GO: highest risk** |
| 139–170 | HQ2 soft correction (`softTp`, `blendStep`), world epoch (`worldNew`, `oldWorld`, `__epochDebug`) | B++ / S.P.A.C.E. | transport, game hero | **NO-GO** |
| 171–244 | transport: `connect` and its `onopen` / `onmessage` / `onclose` | B++ | every section | **NO-GO (C4)** |
| 245–306 | entity mirroring (`applyServerState`, `netHist` / `netPose`), kill announcement, capture (`applyCaught`) | B++ + N.A.N.I. presentation | net-interp, ents.js, bundle | NO-GO |
| 307–333 | glitched-wall exit (`doExit`, `soloGlitches`) | L.O.S.T. / game rules | glitch.js, bundle | NO-GO |
| 334–358 | the cartograph item | P.O.C.K.E.T. (proposed) | inventory.js | NO-GO: items locked |
| 359–362 | `applyBodies` | G.I.B. | bundle | NO-GO |
| 363–401 | dread audio (its own `AudioContext`), thumps, bursts | Spacious Audio | transport events | NO-GO: audio locked (3F) |
| 402–410 | other wanderers: avatar sweep | B++ presentation | `drawPeers` | NO-GO |
| 411–499 | replays (`startFx`, `updateFx`, `gibFrame`, `killFx`), `peerMv` | G.I.B. | dphys, gore, bundle, transport | NO-GO (C5b) |
| 500–583 | dying lights (`bodyLights`, `relOf`, `powerAt`, `corpsePower`, `ownPower`, `__deathLight`), wall stains, `replayLights` | G.I.B. + BR-RoLE input | replays, `NET`, dphys, gore | NO-GO (C5b) |
| 584–637 | `drawPeers`: Option B easing, avatars, hover, `__peerLights` | B++ presentation + BR-R | B+, HQ5 contact (BR-RoLE reads avatars) | **NO-GO: highest risk (C5c)** |
| 638–886 | admin panel, death lab, `findSpot` | OVERSEER | transport (`adm`), `tx`, `giveItem` | NO-GO (C5a; private findings first) |
| 887–992 | fluorescent hum | Spacious Audio | blackout state, `__api` | NO-GO: audio locked (3F) |
| 993–1044 | per-frame hook `window.__mp`: frame work, the `p` send (B+ cadence 25 / 50 / 250 ms) | B++ | the bundle calls it every frame | **NO-GO: highest risk** |

## 6. The highest-risk no-touch surfaces

These may not be touched by any 3H step without a separately authorized B++ correction:

| Surface | Where |
|---|---|
| B++-0's placement guard | `server.js` `mvReset` `place` and the guard in `mvCheck` |
| B+'s server side | `caps` handling, `FAST_GAP`, `c.snap`, `k`, `poseSend` |
| B+'s client side | `PEER_MODE`, `fastAck`, `lastK`, `peerPoses`, `solidPeers`, the `s` handler's target and snap rule, `drawPeers` easing, the send cadence in `window.__mp` |
| HQ5's ground contact and HQ4's round-body cast | `assets/br-role.js` `actorShadows`, `contactJob`, `castActors` |

The ground contact and the cast are judged from the avatars mp.js draws, so they are coupled to `drawPeers`.
