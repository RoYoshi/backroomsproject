# BR-R: world and actor rendering

`src/frameworks/br-r/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

What the world and its actors look like: the Hound and the Smiler (`client/ents.*.js`), the avatar poses (`client/move.poses.js`), the other wanderers on the page (`client/mp.wanderers.js`), the night-vision camcorder (`client/camcorder*.js`), the fair camera (`client/camera_policy.js`), the Level 0 remaster (`client/l0-remaster.js`) and the props' art (`shared/world.art.js`).

## What it must not own

Collision and the AI (S.P.A.C.E., N.A.N.I.); the light itself (BR-RoLE). BR-R draws what they decide, and honours BR-RoLE's light and the rules of sight.

## Its rule

Presentation only. Its look is accepted: the contact lab and the browser checks compare it with the accepted build.

## Its files

<!-- generated: sources:br-r (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/camcorder.js`](client/camcorder.js) | BR-R: the night-vision camcorder (the IIFE opens here): its rules and its state | `public/camcorder.js` (a part) |
| [`client/camcorder.view.js`](client/camcorder.view.js) | BR-R: the camcorder's page elements, drawing, public API and input; the IIFE closes here | `public/camcorder.js` (a part) |
| [`client/camera_policy.js`](client/camera_policy.js) | The Far Backrooms — fair gameplay camera policy | `public/camera_policy.js` |
| [`client/ents.head.js`](client/ents.head.js) | BR-R: the entities' client head (the IIFE opens here): the API, the entity table, small math | `public/ents.js` (a part) |
| [`client/ents.hound.js`](client/ents.hound.js) | BR-R: the Hound, drawn procedurally (a distorted humanoid on all fours) | `public/ents.js` (a part) |
| [`client/ents.smiler.js`](client/ents.smiler.js) | BR-R: the Smiler (darkness with a face) | `public/ents.js` (a part) |
| [`client/l0-remaster.js`](client/l0-remaster.js) | l0-remaster.js - Stage 3B: the Level 0 visual remaster (presentation only, client only).  3B-F: the whole of Level 0. | `public/assets/l0-remaster.js` |
| [`client/move.poses.js`](client/move.poses.js) | BR-R: the avatar poses (window.__pose), for the local player and everybody else | `public/move.js` (a part) |
| [`client/mp.wanderers.js`](client/mp.wanderers.js) | BR-R: the other Wanderers: their hover names and avatars' clean-up | `public/mp.js` (a part) |
| [`shared/world.art.js`](shared/world.art.js) | BR-R: the props' art (drawProp, into the game's static Graphics); the factory closes here | `public/world.js`, `generated/server/world.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- The game's renderer is the compiled bundle (`src/core/client/bundle/`): PixiJS, the camera, the scene. BR-R's scripts draw into it through `window.__api` and their own canvases.
- `ents.js` is fed by `mp.js` (N.A.N.I.'s mirror); its sound is Spacious Audio's part, its deaths G.I.B.'s, its debug overlay OVERSEER's.

## Changing it

Edit the source, `npm run build`, run `node dev/tools/checks/parts.js`, and look at it in a browser. The Hound's look: `client/ents.hound.js`.

## Tests

- `npm run test:camera` (`dev/tests/s_camera_fairness.js`), `node dev/stage-3b-n/test_3bn.js`, `npm run test:fps`.
- The full gate: the contact lab (pixels), the browser checks, the gameplay smoke.

## Known debt

- The core renderer is the v11 bundle plus recorded patches (FINDINGS M-012, M-019); a TypeScript port is planned (ADR-002).
- The camcorder and the entities share their scripts' closures with Spacious Audio's parts (M-024).
