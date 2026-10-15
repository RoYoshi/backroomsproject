# P.O.C.K.E.T.: inventory and usable items

`src/frameworks/pocket/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The inventory (TAB), the light-source loadout and its parts, and the cartograph (`client/inventory.js`; on the page's network layer `client/mp.cartograph.js`; on the server `server/sim.items.js`).

## What it must not own

Items a client invents (the server places the cartograph and decides who took it), and level editing.

## Its rule

An inventory or equipment format needs a persistence contract before it grows.

## Its files

<!-- generated: sources:pocket (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/inventory.js`](client/inventory.js) | Inventory (TAB), light-source loadout + part customisation, and the cartograph item. | `public/inventory.js` |
| [`client/mp.cartograph.js`](client/mp.cartograph.js) | P.O.C.K.E.T.: the cartograph, one rare item per world; a module: pocketCartograph | `public/mp.js` (a part) |
| [`server/sim.items.js`](server/sim.items.js) | src/frameworks/pocket/server/sim.items.js - P.O.C.K.E.T. on the server: the cartograph, one rare find per world - where it lies and who | a module of the sim: `src/core/server/sim.js` requires it |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

## How it connects

- The server's side of the cartograph is P.O.C.K.E.T.'s own module of the sim since continuation C3a: `server/sim.items.js` (where it lies, away from the glitched walls; who picks it up, `takeItem`). Until then its lines sat in L.O.S.T.'s and core's parts.
- The light kinds (what each gives) are in the bundle (`Gc`) and read by the server.

## Changing it

Page: edit, `npm run build`, `node dev/tools/checks/parts.js` (and `node dev/tools/checks/modules.js` for `mp.cartograph.js`). Server (`server/sim.items.js`, a module): edit, then `node dev/tools/checks/modules.js`.

## Tests

- The gate's server goldens pick the cartograph up and use the admin's item tools (`dev/stage-3h0/golden/srv_scenarios.js`); its browser checks run real pages.

## Known debt

- `inventory.js` stays whole (one owner; its input could be H.A.N.D.S.'s, a name not yet approved: M-025).
- The cartograph in `mp.js` (`client/mp.cartograph.js`) is a module since continuation C3c: `window.__items` is its own, and the session, N.A.N.I.'s mirror and the per-frame hook ask for its changes (`noItems`, `itemsFrom`, `soloItems`).
