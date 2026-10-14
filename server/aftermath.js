/* server/aftermath.js - the death aftermath on the server, and the NEW RUN blast's: one event per death or blast, decided and finished here.
 *
 * Stage 3H2 (C-2): moved out of server.js without a change.  Every line between the factory's first line and its return is B++'s own
 * (server.js at 143b63f, lines 116-163, 182-185 and 212-226), comments and column included: nothing is re-indented, so each line can be
 * compared with B++ as it is (dev/stage-3h/tools/h2_move_proof.js does).
 *   aftStart(room, c)           a death the sim has committed (its onDeath; or the tick, for one it finds without an event): open it
 *   aftOf(room, id)             player id's death still playing, if any (an admin revive cancels it; a NEW RUN blast is never one)
 *   aftSend(room)               each open event's replay, once, to every client that has not had it (a late joiner with el)
 *   aftTick(room)               each open event: its physics; at its end the corpse (and a Hound's place); from a world gone: dropped
 *   bodyAt                      a WeakMap: when each corpse was made (server time), for the age the snapshot's 'bodies' gives
 *   putBody(room, id, rec, at)  a corpse into the sim, with its time
 *   boomStart(room, c, de)      the approved NEW RUN's blast, an event like a death's (server/newrun.js is given it)
 * What it uses of the server is given, never required (so loading it changes nothing a golden trace records): deathSrv (death_srv.js,
 * which server.js still requires itself, where it always did), send(c, obj) (server.js's: the WebSocket frame) and HEX (server/fields.js's
 * colour test).  The events are the caller's: they live on the room (room.afts; room.deSeq, the event id NEW RUN shares), so server.js's
 * worldReset and its admin revive still end them in place.  bodyAt is the module's: one per server, as it was.  No timer.  Never served:
 * the server's allowlist does not reach this folder. */
module.exports = ({ deathSrv, send, HEX }) => {
/* Death aftermath (Stage 3D: one event, decided and finished by the server).  When the server commits a death (sim -> onDeath) it opens
 * the event: a death id (de), the kill record completed with what the death needs (the victim's speed and exhaustion, rounded as sent),
 * and the replay message for everyone else (fxFor: the same inputs).  The victim's own client plays the same death from the same record
 * (it reads it in the snapshot's 'mk'), so victim, spectators and the server run one physical death.  Each client gets the replay once
 * (aftSend), with how far it has run if they arrive late.  When the death's length has passed the server makes the corpse itself from
 * that simulation's last frame and places the attacker where the death left it; clients report no corpse, death or light record at all
 * (Stage 3D HQ2: the NEW RUN vanish's light record is gone with it).  An admin revive cancels the event; a world reset drops it.  Bodies
 * stay keyed by player id: never two. */
function aftStart(room, c) {
  const p = c.player; c.aftSeq = p.dseq;
  room.afts = (room.afts || []).filter(a => a.id !== c.id);
  const de = room.deSeq = (room.deSeq | 0) + 1;
  const info = { name: c.name, look: c.look, ek: p.equipment.kind, ec: HEX.test(c.color) ? c.color : '#ffe7b2', ep: c.lp || '', vx: Math.round(p.vx || 0), vy: Math.round(p.vy || 0), ex: p.ex || (p.stamina != null && p.stamina < 22) ? 1 : 0, light: p.light };
  const lf = info.light ? deathSrv.DP.lightProfile(room.sim.worldSeq, de, info.ek) : null;      // Stage 3D HQ1: how its light fails (a lit light that is not a camcorder)
  if (p.kill) Object.assign(p.kill, { de, vx: info.vx, vy: info.vy, ex: info.ex }, lf ? { lf } : {});   // the victim's copy of the record ('mk')
  const kill = Object.assign({}, p.kill), fx = Object.assign(deathSrv.fxFor(c.id, kill, info), { de, wn: room.sim.worldSeq, lo: info.light ? 1 : 0 }, lf ? { lf } : {});   // (wn: Stage 3D HQ2, the world it happened in; an fx's w is the Hound C wall)
  let run = null; try { run = deathSrv.begin(kill, info, room.sim); } catch (e) { console.error('[death] begin failed', e && e.message); }
  room.afts.push({ id: c.id, seq: p.dseq, de, at: Date.now(), world: room.sim.worldSeq, kill, fx: true, fxMsg: fx, sent: new Set([c.id]), body: false, info, run });
}
const aftOf = (room, id) => (room.afts || []).find(a => a.id === id && !a.body && !a.boom);       // (a death in progress: an admin revive cancels it; a NEW RUN blast it never touches)
/* the replay to every client that has not had it yet (a late joiner gets it with el: the seconds it has already run) */
function aftSend(room) {
  if (!room.afts || !room.afts.length) return;
  const now = Date.now();
  for (const a of room.afts) {
    if (a.body || !a.fxMsg) continue;
    const el = (now - a.at) / 1000;
    for (const c of room.clients.values()) if (!a.sent.has(c.id)) { a.sent.add(c.id); send(c, el > .25 ? Object.assign({}, a.fxMsg, { el: +el.toFixed(2) }) : a.fxMsg); }
  }
}
function aftTick(room) {
  if (!room.afts || !room.afts.length) return;
  const now = Date.now();
  for (const a of room.afts) {
    if (a.body) continue;
    if (room.sim.worldSeq !== a.world) { a.body = true; a.dropped = 'world reset'; continue; }        // the world it died in is gone
    if (now < a.at + deathSrv.durOf(a.kill) * 1000) { if (a.run) try { deathSrv.step(a.run, (now - a.at) / 1000); } catch (e) { a.run = null; } continue; }   // the death plays: its physics advances with it
    a.body = true;
    try {
      const R = a.run ? deathSrv.corpse(a.id, a.kill, a.info, a.run) : a.boom ? deathSrv.corpse(a.id, a.kill, a.info, deathSrv.boomBegin(a.kill, a.info, room.sim)) : deathSrv.bodyFor(a.id, a.kill, a.info, room.sim); a.run = null;
      R.body.de = a.de;
      putBody(room, a.id, R.body, a.at + deathSrv.durOf(a.kill) * 1000);                          // (Stage 3D HQ1: made at the death's end, its own time)
      if (a.kill.k === 'Hound' && room.sim.killerEnd) room.sim.killerEnd(a.id, R.attacker.x, R.attacker.y, R.attacker.angle);    // (Stage 3D HQ2: only a hound has a killer to place; a NEW RUN blast has none)
      console.log(`[death] room=${room.name} #${a.id} de=${a.de}: ${a.kill.k} ${a.kill.v || ''} corpse placed`);
    } catch (e) { console.error('[death] corpse failed', e && e.message); }
  }
  room.afts = room.afts.filter(a => !a.body || now - a.at < 60000);
}
/* Stage 3D: when each corpse was made (server time, kept beside the record, never sent), so every client can be told its age ('ag' in
 * 'bodies'): blood that has dried on one screen is dry on a late joiner's too */
const bodyAt = new WeakMap();
function putBody(room, id, rec, at) { bodyAt.set(rec, at == null ? Date.now() : Math.min(Date.now(), at)); room.sim.setBody(id, rec); }   // at: Stage 3D HQ1, a death's corpse is as old as its death's end
/* Stage 3D HQ2 (H2-2): the approved NEW RUN's explosion, an aftermath like a death's (aftSend / aftTick): one event, decided here, at the
 * position and facing the server holds for the player, its blast seeded from the world and the event id (dphys.boomPlan), its light's
 * failure chosen once (HQ1's lightProfile) when the light was a lit emitter.  Every client gets the replay once - the player's own
 * page too (its short beat shows the blast) - a late joiner with how far it has run; at its end the server places the corpse (cause
 * 'Boom').  It is no attack: nobody else, no entity and no part of the world is touched, and the AI is told nothing. */
function boomStart(room, c, de) {
  const p = c.player, w = room.sim.worldSeq, plan = deathSrv.DP.boomPlan(w, de);
  const info = { name: c.name, look: c.look, ek: p.equipment.kind, ec: HEX.test(c.color) ? c.color : '#ffe7b2', ep: c.lp || '', vx: Math.round(p.vx || 0), vy: Math.round(p.vy || 0), ex: 0, light: p.light };
  const lf = info.light ? deathSrv.DP.lightProfile(w, de, info.ek) : null;
  const B = Object.assign({ k: 'Boom', x: Math.round(p.x), y: Math.round(p.y), a: +(+p.angle || 0).toFixed(3), d: plan.d, s: plan.s }, lf ? { lf } : {});
  const fx = Object.assign(deathSrv.boomFx(c.id, B, info), { de, wn: w, lo: info.light ? 1 : 0 }, lf ? { lf } : {});
  let run = null; try { run = deathSrv.boomBegin(B, info, room.sim); } catch (e) { console.error('[newrun] begin failed', e && e.message); }
  room.afts = (room.afts || []).filter(a => a.id !== c.id || a.body);
  room.afts.push({ id: c.id, seq: -1, de, at: Date.now(), world: w, kill: B, fx: true, fxMsg: fx, sent: new Set(), body: false, info, run, boom: true });
}

return { aftStart, aftOf, aftSend, aftTick, bodyAt, putBody, boomStart };
};
