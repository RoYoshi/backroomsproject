/* src/frameworks/bpp/server/session.js - B++ on the server: the WebSocket session.  It answers the HTTP server's upgrades on /ws
 * (the handshake, the room, the room cap), keeps each connection's state, reads each message the client sends and hands it to its owner,
 * and ends the connection.  It is the protocol's intake; every decision it calls for is made by the module that owns it:
 *   p        the pose: the movement authority (S.P.A.C.E., movement.js), the AI's hearing (room.sim), the presentation fields (fields.js)
 *   join, respawn, leave   the world's lifecycle (room.sim), then a placement onto a free spot (movement.js)
 *   nr       NEW RUN's decision (B++, newrun.js);  pick  the cartograph (room.sim)
 *   admin    the admin login (W.A.R.D., admin_login.js);  a  an admin command, only from a connection that login unlocked (OVERSEER)
 *   caps     the fresher poses (B+);  ping  pong, at most every 400 ms
 *
 * Stage 3H continuation (C2): moved out of server.js without a change, with the owner's approval to relocate this code (not to change
 * it).  Every line between the factory's first line and its end is server.js's own at M8 (c34f0c2: lines 26, 61-115 and 120-136),
 * comments and indentation included, except the one line marked (C2), which calls adminLogin where the admin branch's body was;
 * dev/stage-3h/tools/h2_move_proof.js checks it (dev/stage-3h-modernization/evidence/c2/).  The factory registers the upgrade handler
 * on the server it is given, at the point of server.js where the handler was registered before; it returns nothing.
 * Given by server.js: srv (the HTTP server), crypto (Node's), MAX_ROOM, FAST_GAP, the rooms (getRoom, rooms), the framing (send,
 * reader), the field checks (num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook), the movement authority (PEERS, MV, PD, blockers,
 * placeFree, mvReset, mvCheck, adminMove), nrIntent, adminCommand and adminLogin.  No timer.  Never served: the server's allowlist
 * reaches only public/. */
module.exports = ({ srv, crypto, MAX_ROOM, FAST_GAP, getRoom, rooms, send, reader, PEERS, num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook, MV, PD, blockers, placeFree, mvReset, mvCheck, adminMove, nrIntent, adminCommand, adminLogin }) => {
let nextId = 1;

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
      adminLogin(me, m, ip, name, id);                                     // (C2) W.A.R.D.: the passcode check and the lockout (admin_login.js)
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
};
