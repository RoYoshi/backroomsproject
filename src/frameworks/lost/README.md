# L.O.S.T.: level definition and transitions

`src/frameworks/lost/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

Level 0: its one definition, as data (`shared/level0.json`: the map's size, rooms, corridors, partitions, doorways, pits, pillars, the spawn and the open spot beside it that the server checks reachability from, the blackout timer; since continuation C4c), its collision, ray-cast and light code on the server (`server/sim.level0.js`, the bundle's own code, extracted), its working ceiling fixtures (`shared/world.lamps.js`), its floor surfaces (`shared/world.surfaces.js`), its look's metadata (`client/level0_visuals.js`), and the way out: the glitched walls (`server/sim.glitches.js`; on the page `client/mp.glitch.js`, `client/glitch.js`, `client/glitch.draw.js`).

## What it must not own

Rewriting Level 0, or needing height (LogicZ) to make a level.

## Its rule

Levels should be data, not code, with the server and the page agreeing. Since continuation C4c Level 0's map is (below); the code still
knows Level 0 by name in places.

## Its files

<!-- generated: sources:lost (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/glitch.compose.js`](client/glitch.compose.js) | L.O.S.T.: glitch.js's composition: it makes each owner's module in the order the parts ran, and closes the wrapper | `public/glitch.js` (a part) |
| [`client/glitch.draw.js`](client/glitch.draw.js) | L.O.S.T.: the glitched walls drawn; a module: glitchDraw | `public/glitch.js` (a part) |
| [`client/glitch.js`](client/glitch.js) | L.O.S.T.: the glitched walls on the page: their canvas; a module: glitchWalls | `public/glitch.js` (a part) |
| [`client/level0_visuals.js`](client/level0_visuals.js) | level0_visuals.js - Stage 3B: the Level 0 presentation authority (visual metadata only). | `public/assets/level0_visuals.js` |
| [`client/mp.glitch.js`](client/mp.glitch.js) | L.O.S.T.: the glitched walls: touching one takes you out of Level 0; a module: lostGlitch | `public/mp.js` (a part) |
| [`server/sim.glitches.js`](server/sim.glitches.js) | src/frameworks/lost/server/sim.glitches.js - L.O.S.T.: the glitched walls, the way out of Level 0; a module of the sim | a module of the sim: `src/core/server/sim.js` requires it |
| [`server/sim.level0.js`](server/sim.level0.js) | src/frameworks/lost/server/sim.level0.js - L.O.S.T., with S.P.A.C.E.'s collision: Level 0 as the server builds it for one world - the | a module of the sim: `src/core/server/sim.js` requires it |
| [`shared/level0.json`](shared/level0.json) | Level 0, L.O.S.T.'s level (lineage B02: refinement v3) | the sim: `src/core/server/sim.js` requires it; the compiled client: built in (`core/client/game/level-data.cjs`) |
| [`shared/world.lamps.js`](shared/world.lamps.js) | L.O.S.T.: Level 0's working ceiling fixtures (W.lamps), for the client and the server alike; a module: worldLamps | `public/world.js`, `generated/server/world.js` (a part) |
| [`shared/world.surfaces.js`](shared/world.surfaces.js) | L.O.S.T.: the floor surfaces (carpet, concrete, wet tile); a module: worldSurfaces | `public/world.js`, `generated/server/world.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

## How it connects

- One definition, two readers (continuation C4c, FINDINGS M-003): the server's sim requires `shared/level0.json` (and P.O.C.K.E.T.'s
  `lights.json`) and gives them to `server/sim.level0.js`, which copies them for each world; the compiled client is built with them
  (`src/core/client/game/level-data.cjs`: each value is written into the bundle where `shared/world.ts` names it). The path grid's
  size follows the map's on both sides.
- `world.js` (this framework's and S.P.A.C.E.'s parts, built for both sides) carves the damaged walls and pass-through windows into
  that map and places the lamps from its rooms (`WORLD.carve`, `WORLD.lamps`).
- `world.js`'s props (where the counters, shelves, benches, holes and windows are) are L.O.S.T.'s content, declared in S.P.A.C.E.'s part.

## Changing it

Level 0's map: edit `shared/level0.json` (its `note` says what each field is), then rebuild the compiled client (`node
dev/tools/build/client.js --packages <folder> --write`, then `npm run build`); the server reads the file when it starts. A change of
the map is a gameplay change: the gate's `port`, `sim`, `page` and `bundle` steps report it (they compare with B++).

A new level is still not something to add here: it needs a design first. The map is data now, but the code knows Level 0 by name: the
compiled client finds rooms by their index or name (the deep carpet's slower walk in `shared/movement.ts`; the tints of the blackout
zone, the red rooms, the deep carpet and the damp rooms, and the arch gallery's arches, in `client/render.ts`; the floor's sound by
room in `client/main.ts`), the offline Hound has its own patrol (`shared/entity.ts`), `world.js` holds Level 0's props, openings and
lamp rules, the glitched walls and the cartograph are placed by rules of their own, and other scripts write the world's size (FINDINGS
M-028). A level format would need those as data too, with a schema and a validator. None of that is in Stage 3H.

## Tests

- `npm test`: `s_nav` (navigation over the map); `node dev/chk_world.js`; the contact lab's Level 0 scenes (the full gate).

## Known debt

- The map's definition is one file since continuation C4c (M-003), but the level's code exists twice: the compiled client's
  TypeScript (`src/core/client/game/shared/world.ts`, `navigation.ts`, `vision.ts`) and the server's `sim.level0.js`, minified bundle
  code kept whole (M-025): since C3a a module of the sim, since C4c reading the definition, otherwise its two code lines as extracted.
  Each side is compared with B++'s. It also still builds v11's eight evidence traces, which nothing reads (M-034).
- `glitch.js` (its walls, its drawing; `glitch.compose.js` makes them) and `world.js`'s lamps and surfaces are modules since continuation C3b. The page's glitched walls in `mp.js` (`client/mp.glitch.js`) are a module since continuation C3c: the exit flag and the walls' globals are its own, and the session and N.A.N.I.'s mirror ask for their changes (`resetExit`, `soloOff`, `noGlitches`, `glitchesFrom`).
