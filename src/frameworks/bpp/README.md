# B++: networking and replication

`src/frameworks/bpp/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The game's network: the WebSocket on both sides, every message's handling, and what each client is sent.
- **Server:** the framing (`server/ws.js`: `frame`, `reader`), NEW RUN's decision (`server/newrun.js`: `nrIntent`, one answer per press), the fresher poses between snapshots (`server/poses.js`, Stage 3E-0 B+). The session itself (`server/session.js`, continuation C2): the upgrade, each connection's state, every message the client sends and to whom it goes, the leaving; moved out of `server.js` as it was, with the admin login handed to W.A.R.D. (`admin_login.js`).
- **Page:** `window.__net`, what the game bundle calls (`client/mp.net.js`); the WebSocket and every server message (`client/mp.transport.js`); NEW RUN's state on the page (`client/mp.newrun.js`); the field codec (`client/net-wire.js`) and the snapshot interpolation (`client/net-interp.js`).

## What it must not own

What the AI knows (N.A.N.I.), what is visible (BR-R, BR-RoLE), whether a move is legal (S.P.A.C.E.), how a death plays out (G.I.B.). B++ carries their decisions; it does not make them.

## Its rule

The network boundary. A message's name and fields are a contract (`docs/architecture/CONTRACTS.md`); a handler moves only with a trace that proves it unchanged.

## Its files

<!-- generated: sources:bpp (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/mp.net.js`](client/mp.net.js) | B++: window.__net, what the game bundle calls (the fixed-step tick, join, respawn, leave, NEW RUN's press) | `public/mp.js` (a part) |
| [`client/mp.newrun.js`](client/mp.newrun.js) | B++: NEW RUN's state on this page, and the server's answers (nrAnswer) | `public/mp.js` (a part) |
| [`client/mp.transport.js`](client/mp.transport.js) | B++: the WebSocket: sending (tx), connecting, and every message the server sends | `public/mp.js` (a part) |
| [`client/net-interp.js`](client/net-interp.js) | net-interp.js - the snapshot interpolation of the multiplayer layer (mp.js). | `public/assets/net-interp.js` |
| [`client/net-wire.js`](client/net-wire.js) | net-wire.js - the look / light / corpse field codec of the multiplayer layer (mp.js). | `public/assets/net-wire.js` |
| [`server/newrun.js`](server/newrun.js) | server/newrun.js - NEW RUN's decision on the server. | a server module: `server.js` requires it |
| [`server/poses.js`](server/poses.js) | src/frameworks/bpp/server/poses.js - B++ on the server: the fresher player poses ('q') between two snapshots (Stage 3E-0 B+), for the | a server module: `server.js` requires it |
| [`server/session.js`](server/session.js) | src/frameworks/bpp/server/session.js - B++ on the server: the WebSocket session.  It answers the HTTP server's upgrades on /ws | a server module: `server.js` requires it |
| [`server/ws.js`](server/ws.js) | server/ws.js - the WebSocket framing of server.js. | a server module: `server.js` requires it |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- `server.js` gives the server modules what they use (`send`, `boomStart`, ...); the session calls S.P.A.C.E. (`mvCheck`, `placeFree`), W.A.R.D. (`adminLogin`), OVERSEER (`adminCommand`) and B++'s own `nrIntent`.
- On the page, `mp.transport.js` hands every server message to the part that owns it: its header's uses list is that map (59 names of other parts).

## Changing it

Server: edit `src/frameworks/bpp/server/*.js` (required directly, no build). Page: edit the part, `npm run build`, then `node dev/tools/checks/parts.js`. A new message needs the server's handler, the page's, and a line in `docs/architecture/CONTRACTS.md`.

## Tests

- `npm run gate`: the protocol step (every message of the golden runs checked against the accepted build's), `raw_live` (every HTTP and WebSocket exchange), the server goldens.
- `node dev/tests/audit_net.js`, `audit_net2.js`, `ir_net.js` (real server, real sockets); `dev/tests/interp_test.js` (interpolation).

## Known debt

- The page's parts share `mp.js`'s closure; `mp.transport.js` writes 20 bindings of other parts (M-024).
