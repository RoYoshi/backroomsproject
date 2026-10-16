# B++: networking and replication

`src/frameworks/bpp/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The game's network: the WebSocket on both sides, every message's handling, and what each client is sent.
- **Server:** the framing (`server/ws.js`: `frame`, `reader`), NEW RUN's decision (`server/newrun.js`: `nrIntent`, one answer per press), the fresher poses between snapshots (`server/poses.js`, Stage 3E-0 B+). The session itself (`server/session.js`, continuation C2): the upgrade, each connection's state, every message the client sends and to whom it goes, the leaving; moved out of `server.js` as it was, with the admin login handed to W.A.R.D. (`admin_login.js`).
- **Page:** the session (`client/mp.session.js`, a module of `mp.js` since continuation C3c): the WebSocket and every server message, `window.__net` (what the game bundle calls), NEW RUN's state on the page, the world epoch and B+'s fresher poses, and the network send of each frame; the field codec (`client/net-wire.js`) and the snapshot interpolation (`client/net-interp.js`).

## What it must not own

What the AI knows (N.A.N.I.), what is visible (BR-R, BR-RoLE), whether a move is legal (S.P.A.C.E.), how a death plays out (G.I.B.). B++ carries their decisions; it does not make them.

## Its rule

The network boundary. A message's name and fields are a contract (`docs/architecture/CONTRACTS.md`); a handler moves only with a trace that proves it unchanged.

## Its files

<!-- generated: sources:bpp (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/mp.session.js`](client/mp.session.js) | B++: the session: the WebSocket, window.__net (what the game bundle calls), NEW RUN, the world epoch, the other players' poses; a module: bppSession | `public/mp.js` (a part) |
| [`client/net-interp.js`](client/net-interp.js) | net-interp.js - the snapshot interpolation of the multiplayer layer (mp.js). | `public/assets/net-interp.js` |
| [`client/net-wire.js`](client/net-wire.js) | net-wire.js - the look / light / corpse field codec of the multiplayer layer (mp.js). | `public/assets/net-wire.js` |
| [`server/lounge.js`](server/lounge.js) | src/frameworks/bpp/server/lounge.js - B++ on the server: the main menu's lounge (post-3H Trial 2; docs/architecture/CHAT.md). | a server module: `server.js` requires it |
| [`server/newrun.js`](server/newrun.js) | server/newrun.js - NEW RUN's decision on the server. | a server module: `server.js` requires it |
| [`server/poses.js`](server/poses.js) | src/frameworks/bpp/server/poses.js - B++ on the server: the fresher player poses ('q') between two snapshots (Stage 3E-0 B+), for the | a server module: `server.js` requires it |
| [`server/session.js`](server/session.js) | src/frameworks/bpp/server/session.js - B++ on the server: the WebSocket session.  It answers the HTTP server's upgrades on /ws | a server module: `server.js` requires it |
| [`server/speech.js`](server/speech.js) | src/frameworks/bpp/server/speech.js - B++ on the server: nearby speech in a run (post-3H Trial 2; docs/architecture/CHAT.md). | a server module: `server.js` requires it |
| [`server/ws.js`](server/ws.js) | server/ws.js - the WebSocket framing of server.js. | a server module: `server.js` requires it |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

## How it connects

- `server.js` gives the server modules what they use (`send`, `boomStart`, ...); the session calls S.P.A.C.E. (`mvCheck`, `placeFree`), W.A.R.D. (`adminLogin`), OVERSEER (`adminCommand`) and B++'s own `nrIntent`.
- On the page, the session (`mp.session.js`) hands every server message to the module that owns the state it changes, through that owner's own function - the narrow contract: L.O.S.T.'s exit and walls, P.O.C.K.E.T.'s cartograph, N.A.N.I.'s kill record, slots and held state, S.P.A.C.E.'s solid peers and soft correction, BR-R's avatars, G.I.B.'s replays, bodies, lights and corpse hiding, OVERSEER's admin panel (whose state, `adm`, is OVERSEER's: the session never reads the passcode). Those modules are made after it and use it, so `mp.compose.js` hands them over once, through the session's `wire()`: its header's `late:` line is that map. The others read the session's values through its readers (`me()`, `myId()`, `snap()` ...).

## Changing it

Server: edit `src/frameworks/bpp/server/*.js` (required directly, no build). Page: edit the module, `npm run build`, then `node dev/tools/checks/parts.js` and `node dev/tools/checks/modules.js`; `node dev/tools/gate/golden/cli_golden_c3c.js` runs every client scene against B++'s `mp.js`. A new message needs the server's handler, the page's, and a line in `docs/architecture/CONTRACTS.md`.

## Tests

- `npm run gate`: the protocol step (every message of the golden runs checked against the accepted build's), `raw_live` (every HTTP and WebSocket exchange), the server goldens.
- `node dev/tests/audit_net.js`, `audit_net2.js`, `ir_net.js` (real server, real sockets); `dev/tests/interp_test.js` (interpolation).

## Known debt

- The other players' records in the session's `peers` map are the page's shared data model, as at M8 (like the server's players, ADR-005): the session writes the server's fields and moves the targets (B+'s fresher poses), G.I.B.'s drawing eases the drawn position and keeps the avatar, BR-R drops an avatar. `mp.js`'s modules no longer share a closure (M-024 is done for `mp.js` at C3c).
