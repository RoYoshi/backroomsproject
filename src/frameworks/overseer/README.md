# OVERSEER: administration and QA controls

`src/frameworks/overseer/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The admin's tools: the panel's commands on the server (`server/admin.js`: kick, revive, god, bring, freeze, the monster and world tools, the death previews, ...), their world side (`server/sim.admin.js`), the admin menu (`client/mp.admin.js`, the backquote key), the death lab (`client/mp.deathlab.js`) and the AI debug overlay (`client/ents.debug.js`).

## What it must not own

Who is an admin: the passcode check and its lockout stay in `server.js` (W.A.R.D.'s concern), and a page can never grant itself powers. Its hardening needs the owner's approval.

## Its rule

Every privileged action is checked on the server: a command reaches `adminCommand` only from a connection the passcode unlocked.

## Its files

<!-- generated: sources:overseer (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/ents.debug.js`](client/ents.debug.js) | OVERSEER: the admin-only DEBUG overlay (never drawn for ordinary players); the IIFE closes here | `public/ents.js` (a part) |
| [`client/mp.admin.js`](client/mp.admin.js) | OVERSEER: the admin menu (press `) | `public/mp.js` (a part) |
| [`client/mp.deathlab.js`](client/mp.deathlab.js) | OVERSEER: the death lab (window.__dlab: the clock, the x-ray, the overlay) | `public/mp.js` (a part) |
| [`server/admin.js`](server/admin.js) | src/frameworks/overseer/server/admin.js - OVERSEER on the server: the admin panel's commands ({t:'a', c}), each answered on the panel's | a server module: `server.js` requires it |
| [`server/sim.admin.js`](server/sim.admin.js) | OVERSEER: the world side of the admin tools (placeNear, the admin API) | `generated/server/sim.js` (a part) |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- `server.js` gives `admin.js` `send`, `aftOf` (G.I.B.), `moveTo` (S.P.A.C.E.) and `worldReset` (core).
- `sim.admin.js` writes the world's state (frozen, speed, blackout mode, glitches, items, ...): its header lists them.

## Changing it

A new command: its case in `server/admin.js`, its world side in `sim.admin.js` if it needs one, its button in `client/mp.admin.js`. Then `npm run build` and the checks.

## Tests

- `npm test`: `s_admin`. The gate's `live_wire` drives the admin through the real page. `audit_net`'s A1 is a known failure on the accepted build.

## Known debt

- The admin panel's page code shares `mp.js`'s closure (M-024).
