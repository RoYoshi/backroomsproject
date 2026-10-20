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
| [`client/camcorder.compose.js`](client/camcorder.compose.js) | BR-R: camcorder.js's composition: it makes each owner's module in the order the parts ran, and closes the wrapper | `public/camcorder.js` (a part) |
| [`client/camcorder.js`](client/camcorder.js) | BR-R: the night-vision camcorder: its rules and its state; a module: camcorderCore | `public/camcorder.js` (a part) |
| [`client/camcorder.view.js`](client/camcorder.view.js) | BR-R: the camcorder's page elements, drawing, public API and input; a module: camcorderView | `public/camcorder.js` (a part) |
| [`client/camera_policy.js`](client/camera_policy.js) | The Far Backrooms — fair gameplay camera policy | `public/camera_policy.js` |
| [`client/ents.compose.js`](client/ents.compose.js) | BR-R: ents.js's composition: it makes each owner's module in the order the parts ran, and closes the wrapper | `public/ents.js` (a part) |
| [`client/ents.head.js`](client/ents.head.js) | BR-R: the entities' client head: the API, the entity table, small math; a module: entsHead | `public/ents.js` (a part) |
| [`client/ents.hound.js`](client/ents.hound.js) | BR-R: the Hound, drawn procedurally (a distorted humanoid on all fours); a module: entsHound | `public/ents.js` (a part) |
| [`client/ents.smiler.js`](client/ents.smiler.js) | BR-R: the Smiler (darkness with a face); a module: entsSmiler | `public/ents.js` (a part) |
| [`client/l0-remaster.js`](client/l0-remaster.js) | l0-remaster.js - Stage 3B: the Level 0 visual remaster (presentation only, client only).  3B-F: the whole of Level 0. | `public/assets/l0-remaster.js` |
| [`client/move.poses.js`](client/move.poses.js) | BR-R: the avatar poses (window.__pose), for the local player and everybody else; a module: movePoses | `public/move.js` (a part) |
| [`client/mp.wanderers.js`](client/mp.wanderers.js) | BR-R: the other Wanderers: their hover names and avatars' clean-up; a module: brrWanderers | `public/mp.js` (a part) |
| [`client/skin.body.js`](client/skin.body.js) | BR-R: the Skin-Stealer drawn (a tall, thin, wrong figure, procedural and articulated); a module: skinBody | `public/assets/skinstealer.js` (a part) |
| [`client/skin.compose.js`](client/skin.compose.js) | BR-R: skinstealer.js's composition: it makes each owner's module in order, and closes the wrapper | `public/assets/skinstealer.js` (a part) |
| [`shared/world.art.js`](shared/world.art.js) | BR-R: the props' art (drawProp, into the game's static Graphics); a module: worldArt | `public/world.js`, `generated/server/world.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

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
- Since continuation C3b the camcorder, the entities, the avatar poses and the props' art are modules of their scripts (M-024): the camera's state `S` is BR-R's, and Spacious Audio's sound module sets its whine slot only through `setWhine`; the Smiler module gives `drawSmiler` to G.I.B.'s death scene; `ents.compose.js` and `camcorder.compose.js` (BR-R's) make the modules. The wanderers on the page (`client/mp.wanderers.js`) are a module of `mp.js` since continuation C3c: G.I.B.'s drawing reads the mouse through `mx()` and `my()`, and BR-R shows the hover name (`hoverTip`).
