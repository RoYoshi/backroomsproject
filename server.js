// Static file server + WebSocket game server (zero dependencies).  Run: node server.js [port]
// Each ?room=NAME is an independent world with its own server-side Hounds, Smilers (ai.js, driven by sim.js),
// blackout timer and shared evidence.  sim.js and ai.js are never served to browsers.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const zlib = require('zlib');
const createSim = require('./src/core/server/sim.js');     // (continuation C3) the sim: its owners' modules, made by src/core/server/sim.js

const PORT = +process.argv[2] || process.env.PORT || 8000, ROOT = path.join(__dirname, 'public'), MAX_ROOM = 8;   // (Stage 3H modernization: the web root is public/; nothing outside it can be served)
// Admin passcode. Override on the host with the ADMIN_PASSCODE environment variable (recommended).
const ADMIN_PASS = process.env.ADMIN_PASSCODE || 'smoor';
// How long (seconds) a dead player's body stays in the halls. 0 (default) = until the world resets or that player dies again. Override with the BODY_TTL environment variable.
const BODY_TTL = Math.max(0, +process.env.BODY_TTL || 0);
const TICK_MS = 25, SNAP_EVERY = 2, ADMIN_EVERY = 4;            // simulate ~40 Hz, broadcast ~20 Hz
/* Stage 3E-0 (B+): a client that asks for it ({t:'caps', fp:1}, answered the same way) also gets, on every tick between two full snapshots,
 * the other players' newly accepted poses alone ('q', poseSend) - 40 Hz of player poses in all, the world still 20 Hz - and may send its
 * own pose every FAST_GAP ms instead of every 30 (about every 33 ms from a 60 Hz screen).  Every pose still goes through mvCheck as it is;
 * a client that never asks (an older one) gets exactly what it got before */
const FAST_GAP = 16;

const srv = http.createServer(require('./src/frameworks/ward/server/static.js')(ROOT));   // Stage 3H0: the static file serving (the SERVE allowlist, MIME types, caching, gzip, /sounds).  fs, path and zlib are still required first, as before, though only server/static.js uses them now

const deathSrv = require('./src/frameworks/gib/server/death_srv.js');

/* Stage 3H engine modernization (H3M-2, continuation C2): server.js is the server's composition root.  It keeps the configuration,
 * with the admin passcode's source; the requires the server always made, in their order; and the wiring.  Each other part lives with its
 * owner, and is given what it uses (never requiring the server):
 *   src/frameworks/space/server/movement.js   S.P.A.C.E.: the movement authority (the budget, the walls, the other players, placements)
 *   src/core/server/rooms.js                  core: the rooms, and the admin world reset (a new world epoch)
 *   src/frameworks/gib/server/aftermath.js    G.I.B.: the death aftermath and the NEW RUN blast (Stage 3H2 C-2)
 *   src/frameworks/bpp/server/newrun.js       B++: NEW RUN's decision (Stage 3H2 C-1)
 *   src/frameworks/overseer/server/admin.js   OVERSEER: the admin panel's commands
 *   src/frameworks/ward/server/admin_login.js W.A.R.D.: the admin login (the passcode check and its lockout), moved as it was (C2)
 *   src/frameworks/bpp/server/session.js      B++: the WebSocket session (the upgrade, each client's messages, its leaving), moved as
 *                                             it was (C2)
 *   src/frameworks/bpp/server/poses.js        B++: the fresher poses between two snapshots (Stage 3E-0 B+)
 *   src/core/server/loop.js                   core: the loop (the 60 Hz steps, the aftermath, the snapshots)
 * The static files, the WebSocket framing and the checks on what clients send (Stage 3H0), and the players' bodies (peers.js), are
 * required where they always were.  The owner approved the session's move as a relocation (2026-10-14): its semantics are unchanged
 * (dev/stage-3h-modernization/FINDINGS.md M-023). */
const PEERS = require('./src/frameworks/space/server/peers.js');                     // (H3M-2: its PD and NONE are movement.js's)
/* Stage 3H2 (C-2): the death aftermath - aftStart, aftOf, aftSend, aftTick (Stage 3D: one event per death, decided and finished by the
 * server), bodyAt and putBody (a corpse's age) - and the approved NEW RUN's blast (boomStart, Stage 3D HQ2) are server/aftermath.js, moved
 * there as they were.  It is required below, beside the other server modules, once send and HEX exist, and given deathSrv, send and HEX.
 * The events stay on the room (room.afts), so worldReset (src/core/server/rooms.js) and the admin revive (admin.js) still end them in place. */
/* Stage 3H2 (C-1): NEW RUN's decision - nrIntent (the intent {t:'nr'} and its one answer {t:'nra'}) and NR_GAP (its 250 ms flood gap),
 * Stage 3D HQ2's, with HQ3's UNLIMITED NEW RUN - is server/newrun.js, moved there as it was.  It is required below, beside the other
 * server modules, once send exists, and given send and boomStart (the approved NEW RUN's explosion: server/aftermath.js). */

const { frame, reader } = require('./src/frameworks/bpp/server/ws.js');   // Stage 3H0: the WebSocket framing (frame: what send() writes; reader: each socket's 'data' handler)
const send = (c, obj) => { const f = frame(JSON.stringify(obj)); if (f && !c.sock.destroyed) c.sock.write(f); };
const { num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook } = require('./src/frameworks/ward/server/fields.js');   // Stage 3H0: the checks applied to what clients send
const { MV, PD, blockers, placeFree, mvReset, mvCheck, moveTo, adminMove } = require('./src/frameworks/space/server/movement.js')({ PEERS, send });   // H3M-2: S.P.A.C.E., the movement authority
const { aftStart, aftOf, aftSend, aftTick, bodyAt, boomStart } = require('./src/frameworks/gib/server/aftermath.js')({ deathSrv, send, HEX });   // Stage 3H2 (C-2): the death aftermath and the NEW RUN blast (see its note above)
const { nrIntent } = require('./src/frameworks/bpp/server/newrun.js')({ send, boomStart });   // Stage 3H2 (C-1): NEW RUN's decision (see its note above)

const { rooms, getRoom, worldReset } = require('./src/core/server/rooms.js')({ createSim, BODY_TTL, aftStart, placeFree, mvReset, send });   // H3M-2: core, the rooms
const { adminCommand } = require('./src/frameworks/overseer/server/admin.js')({ send, aftOf, moveTo, worldReset });   // H3M-2: OVERSEER, the admin panel's commands

const { adminLogin } = require('./src/frameworks/ward/server/admin_login.js')({ crypto, ADMIN_PASS, send });   // (C2) W.A.R.D.: the admin login
require('./src/frameworks/bpp/server/session.js')({ srv, crypto, MAX_ROOM, FAST_GAP, getRoom, rooms, send, reader, PEERS, num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook, MV, PD, blockers, placeFree, mvReset, mvCheck, adminMove, nrIntent, adminCommand, adminLogin });   // (C2) B++: the WebSocket session

const { poseSend } = require('./src/frameworks/bpp/server/poses.js')({ send });   // H3M-2: B++, the fresher poses between two snapshots
setInterval(require('./src/core/server/loop.js')({ rooms, poseSend, aftStart, aftSend, aftTick, bodyAt, send, SNAP_EVERY, ADMIN_EVERY }).tick, TICK_MS);   // H3M-2: core, the loop

srv.listen(PORT, () => console.log(`The Far Backrooms → http://localhost:${PORT}  (share  ?room=NAME  to group up)`));
