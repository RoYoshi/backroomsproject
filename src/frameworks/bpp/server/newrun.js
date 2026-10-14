/* server/newrun.js - NEW RUN's decision on the server.
 *
 * Stage 3H2 (C-1): moved out of server.js without a change.  Every line between the factory's first line and its return is B++'s own
 * (server.js at 143b63f, lines 204-211 and 227-244), comments and column included: nothing is re-indented, so each line can be
 * compared with B++ as it is (dev/stage-3h/tools/h2_move_proof.js does).
 *   NR_GAP                  250 ms: an intent that close to the last one is dropped (and counted)
 *   nrIntent(room, me, m)   one press's intent {t:'nr', q, w}: one answer {t:'nra', ...} per press number, or none (a flood, an older or a
 *                           malformed press); on approval the player leaves the world at once (sim.newRun) and the one explosion starts
 * What it uses of the server is given, never required (so loading it changes nothing a golden trace records):
 *   send(c, obj)            one message to one client: server.js's send (the WebSocket frame)
 *   boomStart(room, c, de)  the approved NEW RUN's explosion, an aftermath like a death's
 * What it reads and writes is the caller's: the room (room.sim, room.name, room.deSeq - the event id deaths share), the client record
 * (me.id, me.player, me.admin, me.nrFree, me.nrT, me.nrDropped, me.nr, me.spawnNext) and the sim's NEW RUN rules (sim.nrWhy, sim.newRun,
 * sim.nrWait, sim.worldSeq).  No state of its own, no timer.  Never served: the server's allowlist does not reach this folder. */
module.exports = ({ send, boomStart }) => {
/* Stage 3D HQ2: NEW RUN is the server's decision, not the client's.  The client sends only its intent, {t:'nr', q: its press number,
 * w: the world it is in}, and changes nothing until the answer: {t:'nra', q, ok:1, de, w} - approved: the player is out of the world at
 * once (sim.newRun: to the menu, so its next join starts the new run) - or {t:'nra', q, ok:0, why, wait?} - refused, nothing changed
 * ('state': not in a run; 'dead'; 'held': in a capture; 'cooldown': wait seconds left of the 30 s; 'epoch': the press was made in a world
 * an admin has since reset).  One answer per press: the same q again gets the same answer (no second event); an older q, a malformed one
 * or an intent within 250 ms of the last gets none (a flood is dropped and counted).  A world reset, a death, END and RESPAWN never come
 * through here, so none of them explodes anyone or starts anyone's cooldown. */
const NR_GAP = 250;
function nrIntent(room, me, m) {
  const now = Date.now(); if (now - (me.nrT || 0) < NR_GAP) { me.nrDropped = (me.nrDropped | 0) + 1; return; }
  const q = Number.isSafeInteger(m.q) && m.q > 0 && m.q < 2147483648 ? m.q : 0; if (!q) return;
  me.nrT = now;
  if (me.nr) { if (q === me.nr.q) return send(me, me.nr.ans); if (q < me.nr.q) return; }
  const sim = room.sim, p = me.player, t = now / 1000, free = !!(me.admin && me.nrFree);    // Stage 3D HQ3: an admin's own UNLIMITED NEW RUN (this connection only) skips the 30 s, nothing else
  let why = m.w !== sim.worldSeq ? 'epoch' : sim.nrWhy(p, t, free), ans;
  if (!why) why = sim.newRun(p, t, free);
  if (why) { ans = { t: 'nra', q, ok: 0, why }; if (why === 'cooldown') ans.wait = Math.ceil(sim.nrWait(p, t) * 10) / 10; }
  else {
    const de = room.deSeq = (room.deSeq | 0) + 1;
    ans = { t: 'nra', q, ok: 1, de, w: sim.worldSeq };
    me.spawnNext = false;
    boomStart(room, me, de);                                                    // H2-2: the one explosion of this decision
    console.log(`[newrun] room=${room.name} #${me.id} de=${de}: approved${free ? ' (unlimited: admin)' : ''}`);
  }
  me.nr = { q, ans }; send(me, ans);
}

return { NR_GAP, nrIntent };
};
