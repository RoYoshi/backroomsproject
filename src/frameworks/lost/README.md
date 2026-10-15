# L.O.S.T.: level definition and transitions

`src/frameworks/lost/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

Level 0: its map, collision, ray-cast and light code (`server/sim.level0.js`, the bundle's own code, extracted), its working ceiling fixtures (`shared/world.lamps.js`), its floor surfaces (`shared/world.surfaces.js`), its look's metadata (`client/level0_visuals.js`), and the way out: the glitched walls (`server/sim.glitches.js`; on the page `client/mp.glitch.js`, `client/glitch.js`, `client/glitch.draw.js`).

## What it must not own

Rewriting Level 0, or needing height (LogicZ) to make a level.

## Its rule

Levels should be data, not code, with the server and the page agreeing. Today that is not so (below).

## Its files

<!-- generated: sources:lost (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/glitch.draw.js`](client/glitch.draw.js) | L.O.S.T.: the glitched walls drawn; the IIFE closes here | `public/glitch.js` (a part) |
| [`client/glitch.js`](client/glitch.js) | L.O.S.T.: the glitched walls on the page (the IIFE opens here): their canvas | `public/glitch.js` (a part) |
| [`client/level0_visuals.js`](client/level0_visuals.js) | level0_visuals.js - Stage 3B: the Level 0 presentation authority (visual metadata only). | `public/assets/level0_visuals.js` |
| [`client/mp.glitch.js`](client/mp.glitch.js) | L.O.S.T.: the glitched walls: touching one takes you out of Level 0 | `public/mp.js` (a part) |
| [`server/sim.glitches.js`](server/sim.glitches.js) | src/frameworks/lost/server/sim.glitches.js - L.O.S.T.: the glitched walls, the way out of Level 0; a module of the sim | a module of the sim: `src/core/server/sim.js` requires it |
| [`server/sim.level0.js`](server/sim.level0.js) | src/frameworks/lost/server/sim.level0.js - L.O.S.T., with S.P.A.C.E.'s collision: Level 0 as the server builds it for one world - the | a module of the sim: `src/core/server/sim.js` requires it |
| [`shared/world.lamps.js`](shared/world.lamps.js) | L.O.S.T.: Level 0's working ceiling fixtures (W.lamps), for the client and the server alike | `public/world.js`, `generated/server/world.js` (a part) |
| [`shared/world.surfaces.js`](shared/world.surfaces.js) | L.O.S.T.: the floor surfaces (carpet, concrete, wet tile) | `public/world.js`, `generated/server/world.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- The page's copy of the map is inside the compiled bundle; the server's is `sim.level0.js`. They are the same code twice (FINDINGS M-003).
- `world.js`'s props (where the counters, shelves, benches, holes and windows are) are L.O.S.T.'s content, declared in S.P.A.C.E.'s part.

## Changing it

There is no level format yet, so a new level is not something to add here: it needs a design first. What it would take: one level definition both sides load (the map, the props, the fixtures, the surfaces), a schema and a validator, and Level 0 rewritten as data with both sides proven identical. None of that is in Stage 3H.

## Tests

- `npm test`: `s_nav` (navigation over the map); `node dev/chk_world.js`; the contact lab's Level 0 scenes (the full gate).

## Known debt

- The map exists twice (M-003). `sim.level0.js` is minified bundle code, kept whole (M-025): since continuation C3a a module of the sim, its two code lines unchanged.
