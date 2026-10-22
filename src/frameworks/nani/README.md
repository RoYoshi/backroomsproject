# N.A.N.I.: entity intelligence

`src/frameworks/nani/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The Hounds and the Smilers: what they perceive, remember and infer, how they decide, move, navigate and attack. All of it on the server:
- `server/ai.*.js`, the ten parts of `ai.js` (senses and memory, intelligence, light as evidence, entities, captures, the Hound, the Smiler, the engine);
- `server/sim.ai.js` and `server/sim.feed.js`, the world's side (the engine's wiring and the level as it sees it, spawning, the admin's nav command; what it reads of the players each step, its events): two modules of the sim since continuation C3a.
On the page, `client/mp.monsters.js` (a module of `mp.js` since continuation C3c) mirrors the server's monsters into the game, and owns what goes with them: their slots, the kill record and the killer's slot, and the held state it hands to `move.js`.

## What it must not own

Player truth it has not perceived (no cheating from positions it cannot know), and anything BR-RoLE draws: its knowledge comes from its own senses on the server.

## Its rule

AI perception is server-side and limited to evidence.

## Its files

<!-- generated: sources:nani (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/mp.monsters.js`](client/mp.monsters.js) | N.A.N.I.: the server's monsters, mirrored into the game; a module: naniMonsters | `public/mp.js` (a part) |
| [`client/skin.head.js`](client/skin.head.js) | N.A.N.I.: the Skin-Stealer on the page (Trial 3): the script's head, its code tables and small math; a module: skinHead | `public/assets/skinstealer.js` (a part) |
| [`client/skin.mirror.js`](client/skin.mirror.js) | N.A.N.I.: the server's Skin-Stealers mirrored on the page; a module: skinMirror | `public/assets/skinstealer.js` (a part) |
| [`server/ai.capture.js`](server/ai.capture.js) | N.A.N.I.: captures and the choice of kill | `generated/server/ai.js` (a part) |
| [`server/ai.engine.js`](server/ai.engine.js) | N.A.N.I.: the engine: species table, sound bus, level of detail, capture loop, snapshots; the factory closes here | `generated/server/ai.js` (a part) |
| [`server/ai.entity.js`](server/ai.entity.js) | N.A.N.I.: entities: personality, movement, traversal, navigation records, state plumbing | `generated/server/ai.js` (a part) |
| [`server/ai.geo.js`](server/ai.geo.js) | N.A.N.I.: geometry, navigation and light, derived once from the level adapter (Geo, the occupancy layer OL) | `generated/server/ai.js` (a part) |
| [`server/ai.head.js`](server/ai.head.js) | N.A.N.I.: the UMD wrapper (the factory opens here), seeded random streams and hashes, species codes, traits, small math | `generated/server/ai.js` (a part) |
| [`server/ai.hound.js`](server/ai.hound.js) | N.A.N.I.: the Hound (primal: hears everything, fast in straight lines, poor at turning) | `generated/server/ai.js` (a part) |
| [`server/ai.intelligence.js`](server/ai.intelligence.js) | N.A.N.I.: shared evidence tools: arbitration, identities, habits (Stage 2F); never a species' action brain | `generated/server/ai.js` (a part) |
| [`server/ai.light.js`](server/ai.light.js) | N.A.N.I.: visible light as evidence (Part 2, stage 2C) | `generated/server/ai.js` (a part) |
| [`server/ai.senses.js`](server/ai.senses.js) | N.A.N.I.: perception, memory, leads and social awareness; the evidence law (Part 2, stage 2C) | `generated/server/ai.js` (a part) |
| [`server/ai.skin.cover.js`](server/ai.skin.cover.js) | N.A.N.I.: the Skin-Stealer's cover (Trial 3 R13): a covert way audited point by point against every view it knows of, or no covert way at all | `generated/server/ai.js` (a part) |
| [`server/ai.skin.infer.js`](server/ai.skin.infer.js) | N.A.N.I.: the Skin-Stealer's inference (Trial 3 R12): the ways its quarry could have gone, how likely each, what ruled one out | `generated/server/ai.js` (a part) |
| [`server/ai.skin.look.js`](server/ai.skin.look.js) | N.A.N.I.: the Skin-Stealer's eyes (Trial 3 R16e): its head snaps to what it perceives, movement at the edge of its view, where to look from | `generated/server/ai.js` (a part) |
| [`server/ai.skin.mind.js`](server/ai.skin.mind.js) | N.A.N.I.: the Skin-Stealer's mind (Trial 3 R11): who could see it, what changed since its last think, what it knows of its quarry | `generated/server/ai.js` (a part) |
| [`server/ai.skin.preempt.js`](server/ai.skin.preempt.js) | N.A.N.I.: the Skin-Stealer's plan interruption and preemption (Trial 3 R16d): which plans new evidence may cut, and when | `generated/server/ai.js` (a part) |
| [`server/ai.skinstealer.js`](server/ai.skinstealer.js) | N.A.N.I.: the Skin-Stealer (Trial 3): a patient, deceptive predator with hunger, stamina and its own plans | `generated/server/ai.js` (a part) |
| [`server/ai.smiler.js`](server/ai.smiler.js) | N.A.N.I.: the canon Smiler (Part 2, stage 2D) | `generated/server/ai.js` (a part) |
| [`server/sim.ai.js`](server/sim.ai.js) | src/frameworks/nani/server/sim.ai.js - N.A.N.I.: the AI engine's wiring for one world (the world's seed, the engine, the level as the | a module of the sim: `src/core/server/sim.js` requires it |
| [`server/sim.feed.js`](server/sim.feed.js) | src/frameworks/nani/server/sim.feed.js - N.A.N.I.: what the AI reads of the players every step (feed), its events (processEvents), and | a module of the sim: `src/core/server/sim.js` requires it |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

## How it connects

- It sees the level only through the adapter in `sim.ai.js` (the game's own collision, ray-cast and light code).
- It hears what S.P.A.C.E. accepted (`sim.movement.js`: `hearMove`, `gaitFloor`).
- Its kills start G.I.B.'s aftermath (`onDeath`); the admin tools reach it through OVERSEER's `sim.admin.js`.

## Changing it

`ai.js`: edit the part, `npm run build` (it writes `generated/server/ai.js`), run `node dev/tools/checks/parts.js`. The sim's modules (`sim.ai.js`, `sim.feed.js`) are loaded as they are: edit, then `node dev/tools/checks/modules.js`. Then the scenario suite. Why a Hound detected someone: its senses (`ai.senses.js`, `ai.light.js`); the admin's DEBUG overlay draws its leads.

## Tests

- `npm test`: `s_percept`, `s_hound`, `s_hound2e`, `s_smiler`, `s_capture`, `s_system`, `s_nav`, `s_chase`, `s_evidence`, `s_shared2f` (13 of its 162 cases fail on the accepted build too). `npm run test:humanqa` runs `s_humanqa_hotfix`.
- `node dev/tests/nav_bench.js`, `escape_bench.js`, `live_chase.js`.

## Known debt

- `ai.js`'s ten parts share its factory: the engine part uses 60 names of the others. They are all N.A.N.I.'s, so no state crosses an owner (M-024); they stay one cohesive file. The sim's side is modules since continuation C3a (ADR-005).
