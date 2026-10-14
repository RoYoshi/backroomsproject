# Stage 3H1: framework registry (planned ownership, checked against the code)

**What this is.** The framework names are the user's ownership taxonomy. This registry maps each name to the code that exists today at the accepted B++ head `143b63f`, so later work can say who owns a line before moving it.

**What this is not.** It is not a plan to build twenty runtime engines, and it creates no folder, class or file in the game. A name with no code stays a name.

**How it was checked.** Every file, function and global below was found in the source at `143b63f`, by reading it or by `evidence/h1/inventory_bpp.json`. Line numbers are at that commit. The per-file detail is in `3H1_DEPENDENCY_OWNERSHIP_MAP.md`; the verdict words are defined in `3H1_EXTRACTION_CANDIDATES.md`.

## 1. Summary

| Name | Status today | Where the code is | Verdict for Stage 3H |
|---|---|---|---|
| **B++** (networking) | Real code, spread over 7 files | `mp.js`, `server.js`, `server/ws.js`, `server/fields.js`, `server/static.js`, `assets/net-wire.js`, `assets/net-interp.js` | NO-GO on its B+ / B++-0 surfaces; the 3H0 modules are done |
| **BR-RoLE** (lighting) | One real module, accepted at 1.2 | `assets/br-role.js`, with light data from `light.js` | NO-GO |
| **BR-R** (rendering) | Name only; the code is in the bundle and 7 scripts | the bundle, `camera_policy.js`, `ents.js` (drawing), `assets/l0-remaster.js` (with `assets/level0_visuals.js`), `glitch.js` (look), `gore.js` (drawing); `mp.js` draws the other players | NO-GO: the bundle cannot be rebuilt |
| **Spacious Audio** | Name only; audio is in 10 files and 3 real-time `AudioContext`s | the bundle, `sfx.js`, `mp.js` (hum, dread), `ents.js` (voices), `move.js` (`__mvSfx`), `glitch.js`, `camcorder.js`, `hud.js` (volume), `inventory.js` (pickup), `assets/ui.js` (menu theme) | NO-GO: audio is locked until Stage 3F |
| **N.A.N.I.** (AI) | One real module, built from sources | `ai.js` (from `dev/ai_src/`), wired in by `sim.js` | NO-GO |
| **S.P.A.C.E.** (position, collision) | Partly real modules | `world.js`, `move.js`, `server/peers.js`, `timing_policy.js`; its core in `sim.js` and `server.js` | NO-GO on the cores |
| **G.I.B.** (death, gore, bodies) | Partly real modules | `dphys.js`, `gore.js`, `death_srv.js`; its core in `server.js`, `mp.js`, `ents.js` and the bundle | CANDIDATE-LATER for its `server.js` part only (C-2) |
| **L.O.S.T.** (levels) | Name only; one level, in data and code | the bundle and `sim.js` (the map, twice), `assets/level0_visuals.js`, `assets/l0-remaster.js`, `world.js` (props, crawlspaces) | NO-GO in 3H: no level redesign |
| **P.U.L.S.E.** (telemetry) | Name only; scattered counters | `server.js` `room.pf`, BR-RoLE `stats()`, mp.js DEV counters, `ping` / `pong` | Annotate only |
| **OVERSEER** (admin) | Pieces, in 4 files | `server.js` (`passOk`, `adminCommand`), `mp.js` (admin panel), `sim.js` (`admin` API), `ents.js` (debug overlay) | NO-GO: security findings first |
| **E.C.H.O.** (hearing occlusion) | Not implemented | no audio occlusion code exists | Nothing to move |
| **CASHIER** (caches) | Name only; caches in 8 places | `server/static.js` (`gz`), `server.js` (`bodyAt`), `assets/net-interp.js` (`NET.hist`), `sfx.js`, `assets/ui.js`, BR-RoLE, the remaster | Annotate only |
| **LogicZ** | Reserved for Stage 4 | nothing; `world.js` has 2D crawl zones (`lowZone`), not Z | Build nothing |
| P.O.C.K.E.T., F.R.O.N.T., W.A.R.D., A.T.L.A.S., S.T.A.G.E., V.A.U.L.T., H.A.N.D.S. | Proposed names only, not approved | see section 3 | Mapping only, nothing to build |

**The pattern.** Only B++, BR-RoLE and N.A.N.I. correspond to real modules today. G.I.B. and S.P.A.C.E. have real modules with their cores still inside `server.js`, `mp.js`, `sim.js` and the bundle. Everything else is a label over code that lives in several files.

## 2. Each approved or reserved name

### B++: networking

**What it owns.** The WebSocket and protocol, snapshots, pose replication and compatibility with older clients. The rules about what is legal stay with S.P.A.C.E. and the simulation.

| Part | Where | Entry point / interface |
|---|---|---|
| Server sessions | `server.js` 321–397 | `srv.on('upgrade')` → `onMessage(m)` per connection; `bye` |
| Snapshots and the tick | `server.js` 415–468 | `setInterval` tick: 60 Hz steps, `s` every 2nd 25 ms wake, `q` between |
| B+ fresher poses | `server.js` 398–413 | `poseSend(room)`; `caps` in `onMessage`; `FAST_GAP` (16 ms) |
| Framing | `server/ws.js` | `frame(str)`, `reader(sock, onMessage)` |
| Field checks | `server/fields.js` | `num`, `kindOf`, `cleanParts`, `HEX`, `cleanLook` |
| Delivery | `server/static.js` | the HTTP handler, the `SERVE` allowlist |
| Client transport | `mp.js` 171–244 | `connect()`, `ws.onmessage` (18 message types), `tx()` |
| Client B+ | `mp.js` 108–138, 584–637, 993–1044 | `peerPoses` (`q`), `solidPeers`, `drawPeers` easing, the send cadence in `window.__mp` |
| Codec | `assets/net-wire.js` | `__mpLib.wire` |
| Entity interpolation | `assets/net-interp.js` | `__mpLib.interp` |

- **Consumers.** The bundle calls `window.__mp` every frame and reads `window.__net` 26 times. `move.js` reads `__peerBodies`. BR-RoLE, `light.js` and `camcorder.js` read `__peerLights`.
- **Cycles.** `mp.js` and the bundle call each other through `window` every frame.
- **Risk.** Very high. B+ and B++-0 are the most recently accepted code in the game.
- **Probes.** `srv_golden`, `bpp_golden` (5 scenarios, including NEW RUN), `cli_golden`, `wire_keys.json`, `two_browser.py`, `proto_check.js`, `place_replay.js`, `place_guard_check.js`.
- **Verdict.** NO-GO on every B+ and B++-0 surface (`3H1_DEPENDENCY_OWNERSHIP_MAP.md` §6). The five 3H0 modules are already extracted. Text chat, if it is ever added, belongs here, with no new N.A.N.I. hearing.

### BR-RoLE: lighting and occlusion

| Part | Where | Interface |
|---|---|---|
| The engine | `assets/br-role.js` (136,371 B) | `window.__brRole`: `version`, `on`, `draw`, `quality`, `setQuality`, `stats`, `probe`, `actors`, `dev` |
| Light data for entity visibility | `light.js` | `window.__light` (read by the bundle and `ents.js`) |
| Its inputs | `mp.js` | `__peerLights`, `__deathLight`; the avatars `drawPeers` makes |

- **Consumers.** The bundle draws through it. `assets/l0-remaster.js`, `assets/ui.js` (quality setting) and `camcorder.js` read it.
- **Risk.** Very high. HQ5's ground contact and HQ4's round-body cast are accepted visuals.
- **Probes.** `contact_lab.py` (5 scenes), `test_br_role.js`, `gameplay_smoke.py`, `two_browser.py`.
- **Verdict.** NO-GO.
- **Never** may BR-RoLE decide what an entity knows. N.A.N.I. reads its own light model on the server (`ai.js`), not the screen.
- **A version label lags.** Its `VERSION` string still reads `br-role 1.2-candidate` after acceptance (F-024).

### BR-R: rendering (a future organisational boundary)

There is no BR-R module. Rendering is:
- **the bundle's PixiJS scene:** the world, the camera, the local hero, `__api.mkAvatar` and the death class;
- **`camera_policy.js`** (`__cameraPolicy`);
- **`ents.js`:** the procedural drawing of Hounds and Smilers;
- **`assets/l0-remaster.js` with `assets/level0_visuals.js`:** the level's look, and the wall surfaces gore stains;
- **`glitch.js`:** the glitched walls' look;
- **`gore.js`:** wounds and stains;
- **`mp.js` `drawPeers`:** other players.

**Verdict.** NO-GO. Its core is the bundle, which has no source in the repository (F-002). Ownership can be annotated; nothing can be moved.

### Spacious Audio: spatial and atmospheric playback

There is no audio module. The audio is in 10 files and three real-time `AudioContext`s: the bundle's, `mp.js`'s and `assets/ui.js`'s.

| Sound | Where | Context and level |
|---|---|---|
| Footsteps, breathing, game sounds | the bundle (`Z.footstep`, …), `move.js` `__mvSfx` | the bundle's; master gain 0.14 × `__vol` |
| Custom sound files | `sfx.js` (`__sfx`) | the bundle's, through `__api.audio()` |
| Fluorescent hum | `mp.js` 887–992 `buildHum` | the bundle's |
| Entity voices | `ents.js` | the bundle's |
| Glitched-wall sound | `glitch.js` `__glitchSound` | the bundle's |
| Night-vision audio | `camcorder.js` | the bundle's |
| Menu theme (two WAVs) | `assets/ui.js` | **its own `AudioContext`** (line 441), decoded in an `OfflineAudioContext`; follows SOUND and `__vol` |
| Dread drone, thumps, capture burst | `mp.js` 363–401 | **mp.js's own `AudioContext`**; follows only the SOUND toggle, not `__vol` (F-008) |

- **Risk.** High. Timing and level are what players hear, and `Math.random()` is drawn in a fixed order.
- **Probes.** `cli_golden` `hum_dread` records the audio calls. No probe hears real output (`3H1_SOURCE_PARITY_BASELINE.md` §4).
- **Verdict.** NO-GO: audio is locked until Stage 3F.
- **Already per surface:** footsteps choose one of three sounds by zone (carpet, wet, hollow). Floor blood does not vary by material (F-022).

### N.A.N.I.: server-side AI

| Part | Where | Interface |
|---|---|---|
| The engine | `ai.js` (206,697 B), built from `dev/ai_src/` (10 parts, one closure) | the UMD `AI` factory: `create`, species, traits, senses, capture |
| Its wiring | `sim.js` (built from `dev/sim_head.js` + `dev/sim_glue.js`) | `eng`: perception, hearing (`hearMove`, `gaitFloor`), memory, navigation, kills (`processEvents`) |
| Its debug view | `ents.js` (`dev/ents_src/40_debug.js`) and `server.js` (`dbg`) | admins only |

- **The rule it keeps.** Perception, confidence and memory come from the AI's own senses: no player-truth cheats. The `npm test` C-series checks it, e.g. C3 "never from where the prey really is". Several C checks are among the known historical failures (`3H_FINDINGS.md` F-017).
- **Risk.** Very high: AI reasoning.
- **Probes.** `srv_golden` `deaths` and `schedule`; `npm test`; `h1_build_check.js`.
- **Verdict.** NO-GO. Any change goes through `dev/ai_src/`, rebuilt and checked.

### S.P.A.C.E.: position and collision

| Part | Where |
|---|---|
| Shared constants, props, movement table | `world.js` (`WORLD.MOVE`, `PROPS`, `CRAWL`, `carve`, `lowZone`), run by both sides |
| Fixed-step timing | `timing_policy.js` (`TFB_TIMING`) |
| Local movement | `move.js` (`__mv`, `__pose`) |
| Player solidity | `server/peers.js` (`resolve`, `sweepPath`, `freeSpot`) |
| Server collision | `sim.js`: `moveOk`, `moveRoute`, `clearAt`, `spawnOk` |
| Movement validation | `server.js` 30–113: `MV`, `mvCheck`, `placeFree`, `mvReset`, `mvAccept`, B++-0's placement guard |

- **Risk.** Very high. It decides what moves are legal.
- **Probes.** `srv_golden`, `bpp_golden`, `col_browser.py` (head, aside), `two_browser.py`, `npm test` movement checks.
- **Verdict.** NO-GO on the cores. Both known limits of the placement guard are pinned by `bpp_known_limits` (F-019, F-020).

### LogicZ: reserved for Stage 4

Nothing exists. `world.js`'s `lowZone` (crawlspaces) and `move.js`'s vault and crawl states are 2D rules, not a Z framework. 3H builds no Z mechanics.

### G.I.B.: death, impact and bodies

| Part | Where |
|---|---|
| Death physics, both sides | `dphys.js` (`__dphys`); the server runs its text (`death_srv.js`) |
| Server aftermath | `server.js` 116–163 (`aftStart`, `aftOf`, `aftSend`, `aftTick`) and NEW RUN's blast (`boomStart`, 204–245) |
| Corpses | `server.js` `bodyAt`, `putBody`; `sim.js` `setBody`, `MAX_BODIES` 24 |
| Wounds and stains | `gore.js` (`__gore`) |
| Choreography and death sounds | `ents.js` (`dev/ents_src/25_death.js`, `__dsndHits`) and the bundle's death class |
| Replays, dying lights, wall stains | `mp.js` 411–583 |

- **Risk.** High. Stage 3D was accepted recently, and death timing is what players see.
- **Probes.** `srv_golden` `deaths`, `bpp_golden` `bpp_new_run` and `bpp_caps_q`, `gameplay_smoke.py`, `contact_lab.py` `lifecycle`.
- **Verdict.** CANDIDATE-LATER for the server aftermath and NEW RUN decision only (C-1, C-2). NO-GO elsewhere.
- **Future.** Dropped equipment would join G.I.B. with BR-RoLE.

### L.O.S.T.: levels, rooms, transitions

There is one level, Level 0, and no level format:
- **the map:** in the bundle (client) and again in `sim.js` (server) (F-007);
- **its look:** `assets/level0_visuals.js` and `assets/l0-remaster.js`;
- **props and crawlspaces:** `world.js`;
- **glitched-wall exits:** `sim.js` on the server, `glitch.js` and `mp.js` on the client.

**Verdict.** NO-GO in 3H: no Level 0 redesign. `3H0_FUTURE_LEVEL_AUTHORING_SEAMS.md` still describes the seams a level format would use. Static props would belong here, with their look in BR-R; physical props in S.P.A.C.E.

### P.U.L.S.E.: performance, uptime, latency, events

It exists only as counters, each owned by the code it measures:
- **`server.js` `room.pf`:** step time, worst step, snapshot bytes, sense and path counts. Admins see it with AI DEBUG on.
- **BR-RoLE `stats()`:** frame cost and buffer use.
- **mp.js DEV hooks:** `__peerNet` (B+ counters), `__epochDebug`, `__nrDebug`.
- **`ping` / `pong`:** server.js answers at most every 400 ms.

**Verdict.** Annotate only. A player-facing FPS or network overlay would be a new feature, outside a behaviour-preserving 3H (R-011).

### OVERSEER: administration

| Part | Where |
|---|---|
| Authentication | `server.js` `passOk` (a hash of `ADMIN_PASSCODE`), `fails` (lock-out per IP) |
| Commands | `server.js` 256–320 `adminCommand` (24 commands) |
| World tools | `sim.js` `admin` API |
| Panel and death lab | `mp.js` 638–886 |
| AI debug overlay | `ents.js` (`dev/ents_src/40_debug.js`), fed by `s.dbg` |

- **The rule it keeps.** Authentication stays separate from the admin UI and from debugging.
- **Verdict.** NO-GO. Security items were reported privately, and the user decides on them before any move.

### E.C.H.O.: environmental cues and hearing occlusion

**Not implemented.** No audio code attenuates or filters a sound by the walls between it and the listener. The only "occluder" code is visual (`ai.js` bodies under tables; `ents.js` crawlspace drawing). A future E.C.H.O. must never overwrite N.A.N.I.'s hearing, which is server-side (`sim.js` `hearMove`).

### CASHIER: caches

There is no cache manager. These caches exist, each private to its owner:

| Cache | Where | Lifetime |
|---|---|---|
| Gzipped copies of served files | `server/static.js` `gz` | process lifetime, one per non-PNG file the allowlist serves (41 at most) |
| HTTP caching | `server/static.js` | PNG 1 day, `/sounds/*` 5 min, everything else `no-store` |
| Corpse ages | `server.js` `bodyAt` (`WeakMap`) | with the record |
| Entity pose history | `assets/net-interp.js` `NET.hist` | 8 samples per entity; cleared on a new timeline |
| Decoded custom sounds | `sfx.js` `files` | page lifetime |
| Decoded menu theme | `assets/ui.js` | page lifetime |
| Lighting and level drawing | `assets/br-role.js`, `assets/l0-remaster.js` | internal |

**Verdict.** Annotate only. Organise the existing caches before any abstraction, and never cache authoritative state.

## 3. Proposed names (not approved, not built)

These were discussed, not approved. The mapping below is only to say where the code would come from.

| Name | Would own | Code today |
|---|---|---|
| P.O.C.K.E.T. | items and inventory | `inventory.js` (`__inv`, `__loadout`); `sim.js` items (`takeItem`); `mp.js` cartograph (334–358). Items are locked for 3H |
| F.R.O.N.T. | menus, HUD, boot | `index.html`, `assets/ui.js`, `hud.js`, `assets/credits_data.js`, the two stylesheets |
| W.A.R.D. | security policy | `server/static.js` allowlist, `server/fields.js`, `server.js` admin authentication and upgrade checks |
| A.T.L.A.S. | the asset pipeline | `assets/` media, `sounds/`, `favicon.ico`; no pipeline exists (F-002) |
| S.T.A.G.E. | QA tools | `dev/`: the 3H0 harnesses, the stage tools, `dev/stage-3h/` |
| V.A.U.L.T. | saved state | browser `localStorage`: `fb_settings_v1` (`hud.js`, `assets/ui.js`), `tfb.lighting.quality`, `tfb.wanderer.name`, `tfb.keys.v1`, `wanderer-appearance`, `wanderer-light`, and the admin panel's `adm.*` options (`mp.js` line 644); the menu theme in Cache Storage |
| H.A.N.D.S. | input | the bundle's key handling, `assets/ui.js` key bindings (`__keys`), `inventory.js` |

## 4. Creature ownership today (pack file 11)

| Concern | Hound and Smiler code today | Owner |
|---|---|---|
| Behaviour, perception, decisions | `ai.js` (`dev/ai_src/`) | N.A.N.I. |
| Spawning, collision, rays, kill commit | `sim.js` (`dev/sim_glue.js`) | S.P.A.C.E. + N.A.N.I. |
| Replication | `server.js` snapshot `e`; `mp.js` 245–306; `assets/net-interp.js` | B++ |
| Look and animation | `ents.js` (`dev/ents_src/10_hound.js`, smiler parts) | BR-R |
| Voices | `ents.js` | Spacious Audio |
| Death choreography | `ents.js` (`dev/ents_src/25_death.js`), `dphys.js`, `gore.js` | G.I.B. |

`ents.js` couples look, voice, death plans and the debug overlay in one built closure.

The future layout in pack file 11 (`src/server/nani/…`, `src/client/br-r/…`) does not exist. It would be a redesign, not a move, and is not proposed for 3H.

How a kill and a pose cross these owners is traced in `3H1_ARCHITECTURE_AUDIT.md` §6.
