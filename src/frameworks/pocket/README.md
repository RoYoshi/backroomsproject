# P.O.C.K.E.T.: inventory and usable items

`src/frameworks/pocket/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The inventory (TAB), the light-source loadout and its parts, and the cartograph (`client/inventory.js`; on the page's network layer `client/mp.cartograph.js`).

## What it must not own

Items a client invents (the server places the cartograph and decides who took it), and level editing.

## Its rule

An inventory or equipment format needs a persistence contract before it grows.

## Its files

<!-- generated: sources:pocket (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/inventory.js`](client/inventory.js) | Inventory (TAB), light-source loadout + part customisation, and the cartograph item. | `public/inventory.js` |
| [`client/mp.cartograph.js`](client/mp.cartograph.js) | P.O.C.K.E.T.: the cartograph, one rare item per world | `public/mp.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- The server's side of the cartograph is in other owners' parts, where its lines always were: its placement in L.O.S.T.'s `sim.glitches.js`, its pick-up (`takeItem`) in core's `sim.glue.js`.
- The light kinds (what each gives) are in the bundle (`Gc`) and read by the server.

## Changing it

Edit, `npm run build`, `node dev/tools/checks/parts.js`.

## Tests

- The gate's server goldens pick the cartograph up and use the admin's item tools (`dev/stage-3h0/golden/srv_scenarios.js`); its browser checks run real pages.

## Known debt

- `inventory.js` stays whole (one owner; its input could be H.A.N.D.S.'s, a name not yet approved: M-025).
