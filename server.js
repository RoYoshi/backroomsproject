// Static file server + WebSocket game server (zero dependencies).  Run: node server.js [port]
// Each ?room=NAME is an independent world with its own server-side Hounds, Smilers (ai.js, driven by sim.js),
// blackout timer and shared evidence.  sim.js and ai.js are never served to browsers.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const zlib = require('zlib');
const createSim = require('./generated/server/sim.js');   // (built from src/: npm run build)

const PORT = +process.argv[2] || process.env.PORT || 8000, ROOT = path.join(__dirname, 'public'), MAX_ROOM = 8;   // (Stage 3H modernization: the web root is public/; nothing outside it can be served)
// Admin passcode. Override on the host with the ADMIN_PASSCODE environment variable (recommended).
const ADMIN_PASS = process.env.ADMIN_PASSCODE || 'smoor';
// How long (seconds) a dead player's body stays in the halls. 0 (default) = until the world resets or that player dies again. Override with the BODY_TTL environment variable.
const BODY_TTL = Math.max(0, +process.env.BODY_TTL || 0);
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const ADMIN_HASH = sha(ADMIN_PASS);
const passOk = s => crypto.timingSafeEqual(sha(s), ADMIN_HASH);
const fails = new Map();                        // ip -> { n, until }  (5 wrong guesses = 60 s lockout)
const TICK_MS = 25, SNAP_EVERY = 2, ADMIN_EVERY = 4;            // simulate ~40 Hz, broadcast ~20 Hz
/* Stage 3E-0 (B+): a client that asks for it ({t:'caps', fp:1}, answered the same way) also gets, on every tick between two full snapshots,
 * the other players' newly accepted poses alone ('q', poseSend) - 40 Hz of player poses in all, the world still 20 Hz - and may send its
 * own pose every FAST_GAP ms instead of every 30 (about every 33 ms from a 60 Hz screen).  Every pose still goes through mvCheck as it is;
 * a client that never asks (an older one) gets exactly what it got before */
const FAST_GAP = 16;

const srv = http.createServer(require('./src/frameworks/ward/server/static.js')(ROOT));   // Stage 3H0: the static file serving (the SERVE allowlist, MIME types, caching, gzip, /sounds).  fs, path and zlib are still required first, as before, though only server/static.js uses them now

let nextId = 1;
const deathSrv = require('./src/frameworks/gib/server/death_srv.js');

/* Stage 3H engine modernization (H3M-2): server.js is the server's composition root.  It keeps the configuration; the admin passcode, its
 * check and its lockout; the WebSocket session below (the upgrade, each client's messages, its leaving); the requires the server always
 * made, in their order; and the wiring.  Each other part lives with its owner, and is given what it uses (never requiring the server):
 *   src/frameworks/space/server/movement.js   S.P.A.C.E.: the movement authority (the budget, the walls, the other players, placements)
 *   src/core/server/rooms.js                  core: the rooms, and the admin world reset (a new world epoch)
 *   src/frameworks/gib/server/aftermath.js    G.I.B.: the death aftermath and the NEW RUN blast (Stage 3H2 C-2)
 *   src/frameworks/bpp/server/newrun.js       B++: NEW RUN's decision (Stage 3H2 C-1)
 *   src/frameworks/overseer/server/admin.js   OVERSEER: the admin panel's commands
 *   src/frameworks/bpp/server/poses.js        B++: the fresher poses between two snapshots (Stage 3E-0 B+)
 *   src/core/server/loop.js                   core: the loop (the 60 Hz steps, the aftermath, the snapshots)
 * The static files, the WebSocket framing and the checks on what clients send (Stage 3H0), and the players' bodies (peers.js), are
 * required where they always were.  The session stays here because it holds the passcode check and its lockout: security code moves
 * only with the owner's approval (dev/stage-3h-modernization/FINDINGS.md M-023). */
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

srv.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || !req.headers['sec-websocket-key']) return sock.destroy();
  const name = (url.searchParams.get('room') || 'main').slice(0, 24).replace(/[^\w-]/g, '') || 'main';
  const room = getRoom(name);
  if (room.clients.size >= MAX_ROOM) return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
    crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\n\r\n');
  sock.setNoDelay(true);

  const id = nextId++;
  const player = room.sim.addPlayer(id);
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const me = { sock, id, player, exitSent: 0, bv: 0, last: 0, name: 'WANDERER', color: '#ffe7b2', angle: 0, sprint: 0, look: DEFAULT_LOOK, admin: false };
  room.clients.set(id, me);
  send(me, { t: 'hi', id, sim: 1 });

  function onMessage(m) {
    if (m.t === 'p') {
      const now = Date.now();
      if (m.mv && room.sim.hearMove(player, m.mv)) me.mvAt = now;           // state / stamina / vault + slide noises: processed even if the position is throttled
      if (now - me.last < (me.fp ? FAST_GAP : 30) || !isFinite(m.x) || !isFinite(m.y)) { room.sim.gaitFloor(player, now - (me.mvAt || 0) < 500); return; }   // (Stage 3E-0: FAST_GAP once it asked for fresher poses)
      me.last = now;
      const p = player;
      if (!p.dead) {                       // a caught player's body stays where it fell
        const x = num(m.x, 0, 96 * 96), y = num(m.y, 0, 72 * 96);
        let ok = true;
        if (me.admin) { if (!me.mv) mvReset(me, false); adminMove(room, me, x, y); me.mv.bud = MV.VMAX * MV.BURST; }     // admin debug tools move the admin from its own client (Stage 3D HQ2: never into another player)
        else if (!p.active) { p.x = x; p.y = y; }                              // in the menu: not in the world, nothing to check
        else if (me.spawnNext) {                                              // the first position after a join / respawn: where the client chose to spawn
          me.spawnNext = false;
          const f = room.sim.spawnOk(x, y) ? PEERS.freeSpot(x, y, blockers(room, me), (a, b) => room.sim.spawnOk(a, b), PD) : null;   // (Stage 3D HQ2: that spot if nobody is within D + 8 of it, else the nearest free spawn spot around it)
          if (f && !f.crowded) { p.x = f.x; p.y = f.y; mvReset(me, f.moved); if (f.moved) { me.spawnMoved = (me.spawnMoved | 0) + 1; send(me, { t: 'tp', x: f.x, y: f.y }); } }
          else { me.mv.grace = 0; ok = mvCheck(room, me, x, y); }               // not a spawn spot: an ordinary move from the server's spawn point (corrected at once if it is not one)
        }
        else ok = mvCheck(room, me, x, y);                                     // refused: the position stays; the rest of the packet still counts
        if (ok) { p.vx = num(m.vx, -500, 500); p.vy = num(m.vy, -500, 500); }
      }
      room.sim.gaitFloor(p, now - (me.mvAt || 0) < 500);                     // what the AI hears can never be quieter than the accepted movement, report or not
      p.angle = +m.a || 0; p.sprinting = !!m.r; me.raised = m.l !== 0; p.light = me.raised; me.ir = me.raised && kindOf(m.k) === 'camcorder' ? Math.max(0, Math.min(2, m.ir | 0)) : 0;   // infrared lives on the CONNECTION, never on the player the simulation / AI sees (Part 2 2C-IR)      // light: what the AI may perceive (sim.js keeps only VISIBLE light); raised: presentation for the other players
      p.equipment.kind = kindOf(m.k);
      me.name = String(m.n || 'WANDERER').slice(0, 20);
      if (HEX.test(m.c)) me.color = m.c;
      me.look = cleanLook(m.lk) || me.look; me.lp = cleanParts(m.lp);
      me.angle = p.angle; me.sprint = m.r ? 1 : 0; me.fall = m.f >= 0 && m.f <= 1 ? +m.f : -1;
    } else if (m.t === 'join') { if (room.sim.join(player)) { placeFree(room, me); mvReset(me); me.spawnNext = true; } else send(me, { t: 'tp', x: Math.round(player.x), y: Math.round(player.y) }); }
    else if (m.t === 'respawn') {                                          // only from a death (or an admin revive): see sim.respawn
      if (room.sim.respawn(player)) { placeFree(room, me); mvReset(me); me.spawnNext = true; }
      else { me.respawnRefused = (me.respawnRefused | 0) + 1; send(me, { t: 'tp', x: Math.round(player.x), y: Math.round(player.y) }); }
    }
    else if (m.t === 'leave') { if (!room.sim.leave(player)) me.leaveRefused = (me.leaveRefused | 0) + 1; }      // to the menu: only from death, never while alive or held (sim.js lifecycle)
    else if (m.t === 'nr') nrIntent(room, me, m);                            // Stage 3D HQ2: NEW RUN, the server's decision (nrIntent)
    // (Stage 3D HQ2: a client's 'fx' - the old NEW RUN vanish, or a death - is no longer read at all: every replay is the server's own)
    else if (m.t === 'pick') { if (player.active && !player.dead) { const it = room.sim.takeItem(player); if (it) send(me, { t: 'got', item: it }); } }
    else if (m.t === 'admin') {
      const now = Date.now(), f = fails.get(ip) || { n: 0, until: 0 };
      if (now < f.until) return send(me, { t: 'admin', ok: false, wait: Math.ceil((f.until - now) / 1000) });
      if (passOk(m.pass)) { me.admin = true; fails.delete(ip); console.log(`[admin] ${me.name}#${id} unlocked admin (room ${name})`); send(me, { t: 'admin', ok: true, q: m.quiet ? 1 : 0 }); }
      else { if (++f.n >= 5) { f.until = now + 60000; f.n = 0; } fails.set(ip, f); console.log(`[admin] ${me.name}#${id} wrong admin passcode (room ${name})`); send(me, { t: 'admin', ok: false, wait: f.until > now ? 60 : 0 }); }
    }
    else if (m.t === 'a') { if (me.admin) adminCommand(room, me, m); }
    else if (m.t === 'caps') { me.fp = m.fp === 1; send(me, { t: 'caps', fp: me.fp ? 1 : 0 }); }   // Stage 3E-0 (B+): fresher player poses, only when asked (see FAST_GAP)
    else if (m.t === 'ping') { const t = Date.now(); if (t - (me.pingAt || 0) > 400) { me.pingAt = t; send(me, { t: 'pong', ts: +m.ts || 0 }); } }
    // (Stage 3D HQ2: a client's 'b' - the old NEW RUN vanish's light record - is no longer read: corpses and their lights are the server's)
  }

  sock.on('data', reader(sock, onMessage));                                // Stage 3H0: server/ws.js (frames in, pong, close; text under 1,400 bytes to onMessage)
  const bye = () => {
    if (!room.clients.has(id)) return;
    if (player.caught && !player.dead) room.sim.forfeit(player);          // walking out of a capture is a death (its aftermath is recorded before we go), not an escape
    room.clients.delete(id);
    room.sim.removePlayer(player);
    if (!room.clients.size) rooms.delete(name);       // empty world is thrown away
  };
  sock.on('close', bye); sock.on('error', bye);
});

const { poseSend } = require('./src/frameworks/bpp/server/poses.js')({ send });   // H3M-2: B++, the fresher poses between two snapshots
setInterval(require('./src/core/server/loop.js')({ rooms, poseSend, aftStart, aftSend, aftTick, bodyAt, send, SNAP_EVERY, ADMIN_EVERY }).tick, TICK_MS);   // H3M-2: core, the loop

srv.listen(PORT, () => console.log(`The Far Backrooms → http://localhost:${PORT}  (share  ?room=NAME  to group up)`));
