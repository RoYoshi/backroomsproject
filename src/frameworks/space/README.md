# S.P.A.C.E.: movement, collision and placement

`src/frameworks/space/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

Where bodies may go:
- **Page:** the wanderer's movement (`client/move.js`: states, collision, vaulting, sliding, the per-tick step); the other living players as solid bodies, the soft correction and the world epoch (`client/mp.peers.js`).
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
| [`client/move.js`](client/move.js) | S.P.A.C.E.: the wanderer's survival movement (the IIFE opens here): state, the other living Wanderers, collision, vaulting, sliding, the per-tick step | `public/move.js` (a part) |
| [`client/mp.peers.js`](client/mp.peers.js) | S.P.A.C.E.: the other living Wanderers are solid, the soft correction, the world epoch | `public/mp.js` (a part) |
| [`server/movement.js`](server/movement.js) | src/frameworks/space/server/movement.js - S.P.A.C.E. on the server: the movement authority.  Every pose a client sends is checked | a server module: `server.js` requires it |
| [`server/peers.js`](server/peers.js) | server/peers.js - Stage 3D HQ2: living Wanderers are solid to each other (server side only; never served). | a server module: `server.js` requires it |
| [`server/sim.movement.js`](server/sim.movement.js) | src/frameworks/space/server/sim.movement.js - S.P.A.C.E.: movement as the server checks it (moveRoute, moveOk, spawnOk) and as the AI | a module of the sim: `src/core/server/sim.js` requires it |
| [`server/sim.players.js`](server/sim.players.js) | src/frameworks/space/server/sim.players.js - S.P.A.C.E.: the player lifecycle (join, spawn, respawn, NEW RUN's rules, forfeit, leave) | a module of the sim: `src/core/server/sim.js` requires it |
| [`shared/timing_policy.js`](shared/timing_policy.js) | timing_policy.js - frame-rate independent gameplay scheduling. | `public/timing_policy.js` |
| [`shared/world.crawl.js`](shared/world.crawl.js) | S.P.A.C.E.: props at a point, crawlspaces, concealment | `public/world.js`, `generated/server/world.js` (a part) |
| [`shared/world.js`](shared/world.js) | S.P.A.C.E.: the shared world module (window.WORLD in the page, require on the server; the factory opens here): Level 0's props and how they block movement | `public/world.js`, `generated/server/world.js` (a part) |
| [`shared/world.move.js`](shared/world.move.js) | S.P.A.C.E.: the shared movement and noise constants (the client moves, the server listens) | `public/world.js`, `generated/server/world.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

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
