# BR-RoLE: lighting and shadows

`src/frameworks/br-role/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The light the players see: each source's light field, what blocks it, the shadows it casts, and how the surviving light adds up (`client/br-role.js`, BR-RoLE 1.2, presentation only). The shared light query the other scripts ask (`client/light.js`).

## What it must not own

What the AI can sense: N.A.N.I. decides that on the server, from evidence; BR-RoLE never tells it anything and never changes server truth.

## Its rule

Light field, then blockers, then cast shadows, then the sum of the surviving lights. Its look is accepted: no retuning in a refactor.

## Its files

<!-- generated: sources:br-role (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/br-role.js`](client/br-role.js) | br-role.js - BR-RoLE 1.2, the Backrooms Rendering of Lighting Engine (presentation only, client only). | `public/assets/br-role.js` |
| [`client/light.js`](client/light.js) | light.js - the shared lighting query (v20, Part 1A). | `public/light.js` |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- `window.__brRole` is its API (`on`, `draw`, `quality`, `stats`, `probe`, `actors`, ...); the game bundle, `ui.js` (the quality setting), `l0-remaster.js` and the camcorder call it.
- `window.__light` (from `light.js`) answers "how lit is this point" for the page's scripts.
- Parts of BR-RoLE's work live in the compiled bundle as recorded edits (lineage steps B28 to B30: the corner receivers).

## Changing it

Edit `client/br-role.js` or `client/light.js`, `npm run build`, and look: the contact lab's scenes (the full gate) compare pixels with the accepted build.

## Tests

- `node dev/br-role/test_br_role.js` (29 of 32 pass on the accepted build too; the 3 known failures are listed in `dev/stage-3h/gate/known_failures_bpp.json`).
- The full gate's contact lab: 23 scenes, identical in pixels.

## Known debt

- The corner receivers' code is patches on the minified bundle (lineage B28 to B30; FINDINGS M-019) until the TypeScript port (ADR-002).
