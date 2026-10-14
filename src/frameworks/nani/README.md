# N.A.N.I.: entity intelligence

`src/frameworks/nani/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The Hounds and the Smilers: what they perceive, remember and infer, how they decide, move, navigate and attack. All of it on the server:
- `server/ai.*.js`, the ten parts of `ai.js` (senses and memory, intelligence, light as evidence, entities, captures, the Hound, the Smiler, the engine);
- `server/sim.ai.js` and `server/sim.feed.js`, the world's side (the engine's wiring and the level as it sees it; what it reads of the players each step, its events).
On the page, `client/mp.monsters.js` mirrors the server's monsters into the game.

## What it must not own

Player truth it has not perceived (no cheating from positions it cannot know), and anything BR-RoLE draws: its knowledge comes from its own senses on the server.

## Its rule

AI perception is server-side and limited to evidence.

## Its files

<!-- generated: sources:nani (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/mp.monsters.js`](client/mp.monsters.js) | N.A.N.I.: the server's monsters, mirrored into the game | `public/mp.js` (a part) |
| [`server/ai.capture.js`](server/ai.capture.js) | N.A.N.I.: captures and the choice of kill | `generated/server/ai.js` (a part) |
| [`server/ai.engine.js`](server/ai.engine.js) | N.A.N.I.: the engine: species table, sound bus, level of detail, capture loop, snapshots; the factory closes here | `generated/server/ai.js` (a part) |
| [`server/ai.entity.js`](server/ai.entity.js) | N.A.N.I.: entities: personality, movement, traversal, navigation records, state plumbing | `generated/server/ai.js` (a part) |
| [`server/ai.geo.js`](server/ai.geo.js) | N.A.N.I.: geometry, navigation and light, derived once from the level adapter (Geo, the occupancy layer OL) | `generated/server/ai.js` (a part) |
| [`server/ai.head.js`](server/ai.head.js) | N.A.N.I.: the UMD wrapper (the factory opens here), seeded random streams and hashes, species codes, traits, small math | `generated/server/ai.js` (a part) |
| [`server/ai.hound.js`](server/ai.hound.js) | N.A.N.I.: the Hound (primal: hears everything, fast in straight lines, poor at turning) | `generated/server/ai.js` (a part) |
| [`server/ai.intelligence.js`](server/ai.intelligence.js) | N.A.N.I.: shared evidence tools: arbitration, identities, habits (Stage 2F); never a species' action brain | `generated/server/ai.js` (a part) |
| [`server/ai.light.js`](server/ai.light.js) | N.A.N.I.: visible light as evidence (Part 2, stage 2C) | `generated/server/ai.js` (a part) |
| [`server/ai.senses.js`](server/ai.senses.js) | N.A.N.I.: perception, memory, leads and social awareness; the evidence law (Part 2, stage 2C) | `generated/server/ai.js` (a part) |
| [`server/ai.smiler.js`](server/ai.smiler.js) | N.A.N.I.: the canon Smiler (Part 2, stage 2D) | `generated/server/ai.js` (a part) |
| [`server/sim.ai.js`](server/sim.ai.js) | N.A.N.I.: the AI engine's wiring (ai.js, the world's seed, the level as the engine sees it), the director's caps and spawning | `generated/server/sim.js` (a part) |
| [`server/sim.feed.js`](server/sim.feed.js) | N.A.N.I.: what the AI reads of the players every step (feed), its events (processEvents), and a capture as the snapshot sends it | `generated/server/sim.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- It sees the level only through the adapter in `sim.ai.js` (the game's own collision, ray-cast and light code).
- It hears what S.P.A.C.E. accepted (`sim.movement.js`: `hearMove`, `gaitFloor`).
- Its kills start G.I.B.'s aftermath (`onDeath`); the admin tools reach it through OVERSEER's `sim.admin.js`.

## Changing it

Edit the part, `npm run build` (it writes `generated/server/ai.js` and `sim.js`), run `node dev/tools/checks/parts.js`, then the scenario suite. Why a Hound detected someone: its senses (`ai.senses.js`, `ai.light.js`); the admin's DEBUG overlay draws its leads.

## Tests

- `npm test`: `s_percept`, `s_hound`, `s_hound2e`, `s_smiler`, `s_capture`, `s_system`, `s_nav`, `s_chase`, `s_shared2f`, `s_humanqa_hotfix` (13 of 162 cases fail on the accepted build too).
- `node dev/tests/nav_bench.js`, `escape_bench.js`, `live_chase.js`.

## Known debt

- Its parts share `ai.js`'s factory and `sim.js`'s `createSim` (M-024): the engine part uses 60 names of the others.
