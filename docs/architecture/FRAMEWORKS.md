# The frameworks: who owns what

The master pack names twenty frameworks. Twelve have code in this repository, in `src/frameworks/<folder>/`, split into `client/`
(the page), `server/` and `shared/` (loaded by both) where they have code there. The other eight are names: their folder holds only a
README that says what they will own and where the related code lives today. No framework has a stub of code it does not run.

One folder is not a framework: `src/core/` holds the composition roots (`server.js`'s helpers in `core/server/`; the page's network
layer's opening and per-frame hook, and the compiled bundle's source and record, in `core/client/`).

<!-- generated: frameworks (dev/tools/docs/docs.js) -->
| Framework | Folder | What it owns | Its files | They go into |
|---|---|---|---|---|
| [B++](../../src/frameworks/bpp/README.md) | `src/frameworks/bpp/` | networking and replication | 3 client, 4 server | page: `assets/net-interp.js`, `assets/net-wire.js`, `mp.js`; 4 server modules |
| [BR-RoLE](../../src/frameworks/br-role/README.md) | `src/frameworks/br-role/` | lighting and shadows | 2 client | page: `assets/br-role.js`, `light.js` |
| [BR-R](../../src/frameworks/br-r/README.md) | `src/frameworks/br-r/` | world and actor rendering | 11 client, 1 shared | page: `assets/l0-remaster.js`, `camcorder.js`, `camera_policy.js`, `ents.js`, `move.js`, `mp.js`, `world.js`; server: `world.js` |
| [Spacious Audio](../../src/frameworks/spacious-audio/README.md) | `src/frameworks/spacious-audio/` | sound presentation | 7 client | page: `assets/mp-hum.js`, `camcorder.js`, `ents.js`, `glitch.js`, `move.js`, `mp.js`, `sfx.js` |
| [N.A.N.I.](../../src/frameworks/nani/README.md) | `src/frameworks/nani/` | entity intelligence | 1 client, 12 server | page: `mp.js`; server: `ai.js`; 2 server modules |
| [S.P.A.C.E.](../../src/frameworks/space/README.md) | `src/frameworks/space/` | movement, collision, placement | 3 client, 4 server, 5 shared | page: `move.js`, `mp.js`, `timing_policy.js`, `world.js`; server: `world.js`; 4 server modules |
| [G.I.B.](../../src/frameworks/gib/README.md) | `src/frameworks/gib/` | deaths, gibs and corpses | 3 client, 3 server, 1 shared | page: `dphys.js`, `ents.js`, `gore.js`, `mp.js`; server: `dphys.js`; 3 server modules |
| [L.O.S.T.](../../src/frameworks/lost/README.md) | `src/frameworks/lost/` | level definition and transitions | 5 client, 2 server, 2 shared | page: `assets/level0_visuals.js`, `glitch.js`, `mp.js`, `world.js`; server: `world.js`; 2 server modules |
| [P.U.L.S.E.](../../src/frameworks/pulse/README.md) | `src/frameworks/pulse/` | diagnostics and performance | none: a README only | - |
| [OVERSEER](../../src/frameworks/overseer/README.md) | `src/frameworks/overseer/` | administration and QA controls | 2 client, 2 server | page: `ents.js`, `mp.js`; 2 server modules |
| [E.C.H.O.](../../src/frameworks/echo/README.md) | `src/frameworks/echo/` | environmental sound occlusion (future) | none: a README only | - |
| [CASHIER](../../src/frameworks/cashier/README.md) | `src/frameworks/cashier/` | cache ownership and budgets | none: a README only | - |
| [LogicZ](../../src/frameworks/logicz/README.md) | `src/frameworks/logicz/` | vertical world rules (future) | none: a README only | - |
| [P.O.C.K.E.T.](../../src/frameworks/pocket/README.md) | `src/frameworks/pocket/` | inventory and usable items | 2 client, 1 server | page: `inventory.js`, `mp.js`; 1 server module |
| [F.R.O.N.T.](../../src/frameworks/front/README.md) | `src/frameworks/front/` | menus and HUD | 4 client | page: `assets/credits_data.js`, `assets/net-newrun.js`, `assets/ui.js`, `hud.js` |
| [W.A.R.D.](../../src/frameworks/ward/README.md) | `src/frameworks/ward/` | trust and deployment security | 3 server | 3 server modules |
| [A.T.L.A.S.](../../src/frameworks/atlas/README.md) | `src/frameworks/atlas/` | asset provenance and packaging | none: a README only | - |
| [S.T.A.G.E.](../../src/frameworks/stage/README.md) | `src/frameworks/stage/` | testing and QA gates | none: a README only | - |
| [V.A.U.L.T.](../../src/frameworks/vault/README.md) | `src/frameworks/vault/` | local settings and future saves | none: a README only | - |
| [H.A.N.D.S.](../../src/frameworks/hands/README.md) | `src/frameworks/hands/` | input and bindings | none: a README only | - |
<!-- end of generated block -->

The table is written by `node dev/tools/docs/docs.js` from the folders and `src/build-recipes.json`; the gate's `docs` step fails when it
is out of date. Each framework's README lists its files the same way, with what it owns, what it must not own, and its tests.

## Who to ask

| Question | Where to look |
|---|---|
| Why did a Hound detect me? | N.A.N.I.: `nani/server/ai.senses.js` (perception, memory, leads), `ai.light.js` (light as evidence), `ai.hound.js`. The admin's DEBUG overlay (OVERSEER, `overseer/client/ents.debug.js`) draws what each entity knows |
| How do I change how a Hound looks? | BR-R: `br-r/client/ents.hound.js` (drawn procedurally); then `npm run build` |
| How does a flashlight cast a shadow? | BR-RoLE: `br-role/client/br-role.js` (the light field, occlusion, shadows) and `light.js` (the shared light query) |
| Where is NEW RUN approved? | B++ on the server: `bpp/server/newrun.js` (`nrIntent`), with the rules in `space/server/sim.players.js` (`nrWhy`, `newRun`) and the blast in `gib/server/aftermath.js` (`boomStart`) |
| Where is the admin login checked? | W.A.R.D.: `ward/server/admin_login.js` (the passcode's check and the lockout). The session (B++, `bpp/server/session.js`) hands it each `{t:'admin'}`; `server.js` holds only the passcode's source |
| Why does a corpse stay? | G.I.B.: `gib/server/aftermath.js` (one event per death, finished by the server), `gib/server/sim.bodies.js` (one body per player; `BODY_TTL`), `gib/client/mp.deaths.js` (the page's copy) |
| Where is the headlamp? | Carried: BR-RoLE (`br-role.js`, the `CARRY` heights) and the bundle's light gear (lineage steps B10 and B11). On a dead body: G.I.B. (`gib/shared/dphys.js`, the dying light) |
| How do I fix a wall collision? | S.P.A.C.E.: the page's `space/client/move.js` (collision), the server's `space/server/movement.js` (`mvCheck`) and `sim.movement.js` (`moveRoute`, `moveOk`), the props in `space/shared/world.js` |
| How do I add a level? | Not yet possible: Level 0 is code (L.O.S.T.'s `lost/server/sim.level0.js`, and the bundle). `lost/README.md` says what a level format would need |
| How will verticality work? | It does not: `logicz/README.md` |
| How do I change a key binding? | F.R.O.N.T.: `front/client/ui.js`, its keybinds section. H.A.N.D.S. is a name only |
| Where are the settings kept? | In the browser's storage, written by F.R.O.N.T. (`front/client/ui.js`: settings, keybinds, name; `hud.js`), BR-RoLE (`br-role.js`: the lighting quality), OVERSEER (`overseer/client/mp.admin.js`) and the compiled bundle (the appearance and the light). V.A.U.L.T. is a name only: `vault/README.md` |
| Where do the sounds live? | Spacious Audio's README: the synthesised sounds are code; the recorded ones are `public/sounds/` and `public/assets/*.wav` |
| Where is old QA evidence? | `dev/archive/INDEX.md`, by old root name |
| How do I ship safely? | [`docs/development/QUICKSTART.md`](../development/QUICKSTART.md), [`BUILD_PIPELINE.md`](BUILD_PIPELINE.md), and W.A.R.D.'s README: the server serves only `public/`, through an allowlist |
