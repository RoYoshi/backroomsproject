# OVERSEER: administration and QA controls

`src/frameworks/overseer/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The admin's tools: the panel's commands on the server (`server/admin.js`: kick, revive, god, bring, freeze, the monster and world tools, the death previews, ...), their world side (`server/sim.admin.js`), the admin menu and the death lab (`client/mp.admin.js`, one module of `mp.js` since continuation C3c: M8's `mp.admin.js` and `mp.deathlab.js`; it also binds the backquote key that opens the menu) and the AI debug overlay (`client/ents.debug.js`).

## What it must not own

Who is an admin: the passcode check and its lockout are W.A.R.D.'s (`ward/server/admin_login.js`), and a page can never grant itself powers. Changing them needs the owner's separate approval.

## Its rule

Every privileged action is checked on the server: a command reaches `adminCommand` only from a connection the passcode unlocked.

## Its files

<!-- generated: sources:overseer (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/ents.debug.js`](client/ents.debug.js) | OVERSEER: the admin-only DEBUG overlay (never drawn for ordinary players); a module: entsDebug | `public/ents.js` (a part) |
| [`client/mp.admin.js`](client/mp.admin.js) | OVERSEER: the admin menu (press `) and the death lab; a module: overseerAdmin | `public/mp.js` (a part) |
| [`server/admin.js`](server/admin.js) | src/frameworks/overseer/server/admin.js - OVERSEER on the server: the admin panel's commands ({t:'a', c}), each answered on the panel's | a server module: `server.js` requires it |
| [`server/sim.admin.js`](server/sim.admin.js) | src/frameworks/overseer/server/sim.admin.js - OVERSEER: the world side of the admin tools (placeNear, the admin API); a module of the | a module of the sim: `src/core/server/sim.js` requires it |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

## How it connects

- `server.js` gives `admin.js` `send`, `aftOf` (G.I.B.), `moveTo` (S.P.A.C.E.) and `worldReset` (core).
- `sim.admin.js` is a module of the sim (continuation C3a). It changes the world through its owners' functions: the run's `controls` (freeze, speed, blackout mode, the run's clock), L.O.S.T.'s `restartBlackout` and `placeGlitches`, P.O.C.K.E.T.'s `placeItems`. Its own state is the debug switch.

## Changing it

A new command: its case in `server/admin.js`, its world side in `sim.admin.js` if it needs one (through the owner's functions: a module never assigns another's state), its button in `client/mp.admin.js`. Then `npm run build` (for the page) and the checks (`node dev/tools/checks/modules.js` for the server).

## Tests

- `npm test`: `s_admin`. The gate's `live_wire` drives the admin through the real page. `audit_net`'s A1 is a known failure on the accepted build.

## Known debt

- The admin panel (`client/mp.admin.js`) is a module of `mp.js` since continuation C3c: its state, `adm`, is made there (B++'s part declared it at M8); the session hands it each admin message (the login's answer, the command answers, UNLIMITED NEW RUN, the debug data, a closed connection) and asks it to send the passcode again on a new connection (`relogin`: the passcode stays in the panel, in memory only, as before). No auth semantics changed. The AI debug overlay (`client/ents.debug.js`) is a module of `ents.js` since continuation C3b: it adds its own entries to `window.__ents`; `mp.js` still sets two of them (`navSel`, `onFail`), a contract between scripts.
