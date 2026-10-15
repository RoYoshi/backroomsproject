# S.P.A.C.E.: movement, collision and placement

`src/frameworks/space/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

Where bodies may go:
- **Page:** the wanderer's movement (`client/move.js`: states, collision, vaulting, sliding, the per-tick step); the other living players as solid bodies and the soft correction (`client/mp.peers.js`, a module of `mp.js` since continuation C3c; the world epoch and B+'s fresher poses, which sat in its part at M8, are the session's, B++'s, since then).
- **Server:** the movement authority (`server/movement.js`: the distance budget, the walls, the other players, placements); the players' bodies (`server/peers.js`); routes and spawn spots (`server/sim.movement.js`); the player lifecycle and NEW RUN's rules (`server/sim.players.js`: the only code that adds or removes a player; the world reset is core's run since continuation C3a).
- **Both:** the props and how they block, crawlspaces, the shared movement constants (`shared/world*.js`), and frame-rate independent scheduling (`shared/timing_policy.js`).

## What it must not own

Drawing (BR-R) and any future height (LogicZ). Player feel does not change without Human QA.

## Its rule

The server checks every pose at its own rate; no teleport and no overlap loophole; the 2D game is the game.

## Its files

<!-- generated: sources:space (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/move.compose.js`](client/move.compose.js) | S.P.A.C.E.: move.js's composition: it makes each owner's module in the order the parts ran, and closes the wrapper | `public/move.js` (a part) |
| [`client/move.js`](client/move.js) | S.P.A.C.E.: the wanderer's survival movement: state, the other living Wanderers, collision, vaulting, sliding, the per-tick step; a module: moveCore | `public/move.js` (a part) |
| [`client/mp.peers.js`](client/mp.peers.js) | S.P.A.C.E.: the other living Wanderers are solid, the soft correction; a module: spacePeers | `public/mp.js` (a part) |
| [`server/movement.js`](server/movement.js) | src/frameworks/space/server/movement.js - S.P.A.C.E. on the server: the movement authority.  Every pose a client sends is checked | a server module: `server.js` requires it |
| [`server/peers.js`](server/peers.js) | server/peers.js - Stage 3D HQ2: living Wanderers are solid to each other (server side only; never served). | a server module: `server.js` requires it |
| [`server/sim.movement.js`](server/sim.movement.js) | src/frameworks/space/server/sim.movement.js - S.P.A.C.E.: movement as the server checks it (moveRoute, moveOk, spawnOk) and as the AI | a module of the sim: `src/core/server/sim.js` requires it |
| [`server/sim.players.js`](server/sim.players.js) | src/frameworks/space/server/sim.players.js - S.P.A.C.E.: the player lifecycle (join, spawn, respawn, NEW RUN's rules, forfeit, leave) | a module of the sim: `src/core/server/sim.js` requires it |
| [`shared/timing_policy.js`](shared/timing_policy.js) | timing_policy.js - frame-rate independent gameplay scheduling. | `public/timing_policy.js` |
| [`shared/world.compose.js`](shared/world.compose.js) | S.P.A.C.E.: world.js's composition: it makes each owner's module in the order the parts ran, and closes the wrapper | `public/world.js`, `generated/server/world.js` (a part) |
| [`shared/world.crawl.js`](shared/world.crawl.js) | S.P.A.C.E.: props at a point, crawlspaces, concealment; a module: worldCrawl | `public/world.js`, `generated/server/world.js` (a part) |
| [`shared/world.js`](shared/world.js) | S.P.A.C.E.: the shared world module (window.WORLD in the page, require on the server): Level 0's props and how they block movement; a module: worldHead | `public/world.js`, `generated/server/world.js` (a part) |
| [`shared/world.move.js`](shared/world.move.js) | S.P.A.C.E.: the shared movement and noise constants (the client moves, the server listens); a module: worldMove | `public/world.js`, `generated/server/world.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

## How it connects

- The page moves; the server checks (`mvCheck`) and corrects. `server.js` gives `movement.js` the `PEERS` and `send` it uses.
- The AI hears the movement the server accepted (`hearMove`, `gaitFloor`).
- `world.js` is built twice, for the page and the server, from the same parts, so both sides see the same props.

## Changing it

Server: edit `server/*.js` (modules are required directly, the sim's `sim.*.js` too since continuation C3a; `node dev/tools/checks/modules.js` checks their boundaries). Page and shared: edit, `npm run build`, `node dev/tools/checks/parts.js`. A wall collision: the page's `move.js` and the server's `movement.js` and `sim.movement.js` must agree.

## Tests

- `npm run gate`: the B++ goldens (placement guard, world guard, known limits), the mutants (the guard, the grace), `bpp_checks` (place replay, place guard).
- `node dev/tests/phys_test.js`, `dev/tests/s_audit.js`, `dev/tests/play_server.js`.

## Known debt

- `world.js`'s props are L.O.S.T.'s content, declared in S.P.A.C.E.'s part, as they always were.
- `move.js` and `world.js` are modules since continuation C3b (`move.compose.js` and `world.compose.js`, S.P.A.C.E.'s, make them). The movement module plays Spacious Audio's movement sounds through what the sound module hands it (`useSound`), no longer through `window.__mvSfx`. The other living players (`client/mp.peers.js`) are a module of `mp.js` since continuation C3c: it reads the session's values and L.O.S.T.'s exit flag through their readers, and the session asks it for every change (`solidPeers`, `resolid`, `softTp`, `blendTick`, `stopBlend`, `solidOff`).
