/* src/core/server/loop.js - the server's loop.  On every tick (TICK_MS, 25 ms) each room's world steps at 60 Hz; on every SNAP_EVERY-th
 * tick the deaths' aftermath plays on and each client gets one snapshot (the admin's panel and debug data with it); on the ticks between,
 * the fresher poses (poses.js).
 *
 * Stage 3H engine modernization (H3M-2): moved out of server.js without a change.  Every line between the factory's first line and its
 * return is server.js's own (at checkpoint M6a, f2db9d8: lines 332-382, the body of its setInterval callback), comments and column
 * included, except tick()'s own first and last lines (the callback was an arrow function), marked (H3M-2): nothing is re-indented, so each
 * line can be compared with server.js as it was (dev/stage-3h/tools/h2_move_proof.js does: dev/stage-3h-modernization/evidence/m2/).
 *   tick()   one tick, as the callback ran it.  server.js still makes the one setInterval, where it always did.
 * What it uses of the server is given by server.js, never required: rooms (core), poseSend (B++), aftStart, aftSend, aftTick and bodyAt
 * (G.I.B.), send(c, obj), SNAP_EVERY and ADMIN_EVERY (server.js's configuration).  Never served. */
module.exports = ({ rooms, poseSend, aftStart, aftSend, aftTick, bodyAt, send, SNAP_EVERY, ADMIN_EVERY }) => {
function tick() {                                                           // (H3M-2: server.js's setInterval(() => {...}, TICK_MS) callback)
  const now = Date.now();
  for (const room of rooms.values()) {
    const dt = Math.min(0.25, (now - room.last) / 1000); room.last = now;
    room.acc += dt;
    let n = 0; const h0 = process.hrtime.bigint();
    while (room.acc >= 1 / 60 && n++ < 15) { room.sim.step(1 / 60); room.acc -= 1 / 60; }
    if (n) { const per = Number(process.hrtime.bigint() - h0) / 1e6 / n; room.pf.ms += (per - room.pf.ms) * .05; room.pf.max = Math.max(per, room.pf.max * .995); }      // milliseconds per 60 Hz step (average / recent worst)
    if (++room.tick % SNAP_EVERY) { poseSend(room); continue; }                 // (Stage 3E-0: between two snapshots, the fresher player poses)

    for (const c of room.clients.values()) if (c.player.dead && c.player.kill && c.aftSeq !== c.player.dseq) aftStart(room, c);
    aftSend(room); aftTick(room);
    const ent = room.sim.entities();
    const peers = [];
    for (const c of room.clients.values()) {
      if (!c.player.active) { c.snap = null; continue; }
      const x = Math.round(c.player.x), y = Math.round(c.player.y), a = +c.angle.toFixed(2);
      c.snap = c.player.dead ? null : [x, y, a];                               // (Stage 3E-0: what this snapshot says of it, for poseSend)
      peers.push({ id: c.id, x, y, a,
        n: c.name, c: c.color, d: c.player.dead ? 1 : 0, r: c.sprint,
        k: c.player.equipment.kind, l: c.raised ?? c.player.light ? 1 : 0, ir: c.ir | 0, lk: c.look, lp: c.lp || '', f: c.fall === undefined ? -1 : c.fall,
        mv: [c.player.st | 0, Math.round(c.player.sp || 0), Math.round(c.player.stamina == null ? 100 : c.player.stamina), c.player.ex | 0] });
    }
    const sendAd = room.tick % (SNAP_EVERY * ADMIN_EVERY) === 0;
    const wantDbg = room.tick % (SNAP_EVERY * 3) === 0 && [...room.clients.values()].some(c => c.admin && c.dbg);
    const dbgList = wantDbg ? room.sim.debugInfo() : null;
    let dbgPerf = null;
    if (wantDbg) {
      const st = room.sim.engStats, nowT = Date.now(), dtp = Math.max(.2, (nowT - room.pf.at) / 1000);
      room.pf.snapB = JSON.stringify({ p: peers, e: ent }).length;
      dbgPerf = { ms: +room.pf.ms.toFixed(3), mx: +room.pf.max.toFixed(2), kb: +(room.pf.snapB / 1024).toFixed(2), se: Math.round((st.sense - room.pf.sense) / dtp), pa: Math.round((st.paths - room.pf.paths) / dtp), pl: peers.length };
      room.pf.sense = st.sense; room.pf.paths = st.paths; room.pf.at = nowT;
    }
    let ad = null;
    if (sendAd) ad = Object.assign(room.sim.admin.info(), { pl: [...room.clients.values()].map(c => ({ id: c.id, n: c.name, a: c.player.active ? 1 : 0, d: c.player.dead, g: c.player.god ? 1 : 0, ad: c.admin ? 1 : 0, st: c.player.st | 0, x: Math.round(c.player.x), y: Math.round(c.player.y) })) });
    const bodyMsg = () => ({ t: 'bodies', v: room.sim.bodyVer, w: room.sim.worldSeq, b: [...room.sim.bodies.values()].map(r => bodyAt.has(r) ? Object.assign({}, r, { ag: Math.min(999, Math.round((now - bodyAt.get(r)) / 100) / 10) }) : r) });
    let bm = null;
    for (const c of room.clients.values()) {
      if (c.player.exitSeq > c.exitSent) { c.exitSent = c.player.exitSeq; send(c, { t: 'exit', secs: Math.round(c.player.exitT || 0) }); }
      if (c.bv !== room.sim.bodyVer) { c.bv = room.sim.bodyVer; send(c, bm || (bm = bodyMsg())); }
      const msg = { t: 's', p: peers.filter(p => p.id !== c.id), e: ent, me: c.player.dead, ms: c.player.dseq, cp: room.sim.capInfo(c.player), w: room.sim.worldSeq };   // (w: Stage 3D HQ2, the world epoch)
      if (c.player.dead && c.player.kill) msg.mk = c.player.kill;
      if (c.fp) msg.k = room.tick;                                            // (Stage 3E-0: this tick, so its 'q' are known to be newer)
      if (c.admin && ad) { msg.ad = ad; msg.you = c.id; msg.nf = c.nrFree ? 1 : 0; }   // (Stage 3D HQ3: nf - this admin's own UNLIMITED NEW RUN, as the server holds it)
      if (c.admin && c.dbg && dbgList) {
        msg.dbg = dbgList;
        const lg = room.sim.logSince(c.dbgSeq | 0); if (lg.length) { c.dbgSeq = lg[lg.length - 1].s; }
        msg.dx = { lg: lg.map(l => [l.s, l.t, l.x]), pf: dbgPerf };                    // event log (only what is new) + server timings
      }
      send(c, msg);
    }
  }
}                                                                             // (H3M-2)

return { tick };
};
