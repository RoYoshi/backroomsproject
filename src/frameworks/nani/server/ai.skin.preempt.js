/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer's plan interruption and preemption (Trial 3 R16d): which plans new evidence may cut, and when
 * provides: skLeftFor, skPreempt, skRefractory
 * uses: -
 * writes: -
 */
/* ---------------------------------------------------------------- PLAN INTERRUPTION AND PREEMPTION (Trial 3 R16d; dev/trial-3-r9-overhaul/)
 * The owner (October 22, the additional refinement): a Skin-Stealer kept walking to where it was going after it had plainly seen a
 * player; it must reassess at once when something important happens, without dropping a tactic that still makes sense and without
 * replanning on every flicker.  AP_AUDIT.md found why: a person it had left was hidden from its hunting for 30-60 s whatever its hunger,
 * and a departure went on past new prey.  This part is the policy, read on every think (10 Hz near) whatever the route's progress:
 *   CLASSES   committed - its wind-up, leap and recovery, a capture, a kill playing: never cut (they are physics and fairness);
 *             low - no plan (roaming, a roam's pause), a departure (not a fast one after a missed defence, not one after a lost race - it
 *             is tired - nor while exhausted), a search or a listen about nobody it has named: cut by any significant event;
 *             tactical - approach, flank, intercept, lure, ambush, chase, retreat, watch, a hunt's search or listen, a walk in a skin: kept
 *             while they still make sense (skDecide's own weighing, with its hysteresis SK.rethink), and given up when they no longer do.
 *   EVENTS    a VIABLE person newly seen (first seen, or seen again after SKP.regain seconds out of sight) - viable: one it may hunt now
 *             (skMayHunt, hunger-dependent below; R16e: and only from the hunger it hunts at, SK.band[1] - a sated departure is not cut by
 *             a passer-by: s_skinbehave BR01); and the quarry of a lure or an ambush seen going away from it, not coming, for
 *             SKP.awayFor seconds (the wait has lost its point).
 *   ANSWER    a low-priority plan is ended on the think the event is perceived and the decision runs at once (no dwell, no once-a-second);
 *             a tactical plan that has lost its point is flagged for skDecide to weigh afresh (its hysteresis does not keep a plan that
 *             no longer makes sense).  Each person forces at most one reassessment every SKP.again seconds: evidence that keeps arriving
 *             (a person flickering at the edge of its view) cannot make it replan in a loop.  Nothing here touches its memory, its
 *             hunt or its beliefs: only which plan runs.  Every interruption is logged (its mind's events, e.dbg.preempt): what it
 *             perceived, which plan it cut or kept, and why.
 *   WHO       a person it left (skLeave) is left for skLeftFor(hunger) seconds - the hungrier, the shorter (selective when fed, single-
 *             minded when starving) - and may be taken up again on fresh sight once skRefractory(hunger) has passed since it left them,
 *             within the effort it has left for them (skMayHunt).  Never on hunger alone: it must see them. */
const SKP = Object.freeze({
  regain: 1.2,                                   // seconds out of sight after which seeing a person again is a new sighting
  again: .6,                                     // seconds between two forced reassessments about the same person
  awayFor: 1.5,                                  // seconds a lure's or an ambush's quarry is seen going away before the wait is given up
  awayV: 60,                                     // px/s away from it that counts as going away (not coming)
  left: [[.6, 15], [.8, 8], [1.01, 4]],          // from hunger .4 (skLeave; fed, R8's SK.cooldown): hunger under -> seconds it leaves a person alone (R8: 30-60, starving 12)
  refr: [[.4, 1e9], [.6, 10], [.8, 6], [1.01, 3]],            // hunger under -> seconds after leaving before fresh sight may take them up
});
const SKP_LOW = new Set(['leave']), SKP_TACT = new Set(['approach', 'flank', 'intercept', 'lure', 'ambush', 'chase', 'retreat', 'watch', 'mingle']);
const skStep = (T, h) => { for (const [lim, v] of T) if (h < lim) return v; return T[T.length - 1][1]; };
const skLeftFor = h => skStep(SKP.left, h);
const skRefractory = h => skStep(SKP.refr, h);
/* the class of what it is doing now */
function skPlanClass(e) {
  if (e.pounce || e.recover > 0 || e.cap || e.commit) return 'committed';
  const P = e.plan; if (!P) return 'low';
  if (P.k === 'leave') return P.fast || P.race || e.exh ? 'tactical' : 'low';   // (a fast or tired departure goes on: it has a reason that sight does not change)
  if (P.k === 'feed') return 'feed';                                            // (its meal: disturbed by what skDecide already weighs)
  if ((P.k === 'search' || P.k === 'listen') && !P.pid) return 'low';          // (about a sound nobody was named for)
  return SKP_TACT.has(P.k) || P.k === 'search' || P.k === 'listen' ? 'tactical' : 'low';
}
/* on its think, before the decision: did anything happen that cuts or questions the plan?  mayHunt: skMayHunt (who it may hunt now).
 * Returns the reason when the decision must weigh afresh (e.pre.force), or '' */
function skPreempt(eng, e, mayHunt) {
  const now = eng.now, P = e.plan, cls = skPlanClass(e), M = e.pre || (e.pre = { seen: new Map(), forced: new Map(), force: '', n: 0 });
  M.force = '';
  // who it sees now, and who is new to its eyes (first seen, or seen again after a while out of sight)
  let fresh = null;
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id), last = M.seen.get(id); M.seen.set(id, now);
    if (!r || !r.visual || r.visual.caught || !r.visual.alive) continue;
    const isNew = last === undefined || now - last > SKP.regain;
    if (isNew && mayHunt(r) && (!fresh || r.dist < fresh.dist)) fresh = r;
  }
  for (const [id, t] of M.seen) if (now - t > 30 || !eng.byId.has(id)) M.seen.delete(id);
  const may = !!fresh && now - (M.forced.get(fresh.id) ?? -99) >= SKP.again;
  // kept, and said so: a committed action (physics and fairness), and a departure with a reason sight does not change
  if (cls === 'committed' || (P && P.k === 'leave' && cls === 'tactical')) {
    if (may) {
      M.forced.set(fresh.id, now); M.kept = (M.kept || 0) + 1;
      const what = cls === 'committed' ? (e.commit ? 'kill' : e.cap ? 'capture' : e.recover > 0 ? 'recovery' : e.pounce && e.pounce.t < e.pounce.wind ? 'wind-up' : 'leap') : 'departure';
      e.dbg.preempt = { at: +now.toFixed(2), from: cls === 'committed' ? what : 'leave', cls, kept: 1, why: `P${fresh.id} seen: its ${what} goes on (${cls === 'committed' ? 'committed' : P.fast ? 'its defence missed' : P.race ? 'it lost a race' : 'exhausted'})` };
    }
    return '';
  }
  let why = '';
  if (may) {
    if (cls === 'low') why = `P${fresh.id} seen: ${P ? 'its ' + P.k : 'its roaming'} gives way`;
    else if (P && P.pid !== fresh.id) why = `P${fresh.id} seen: it weighs them against its ${P.k} about ${P.pid ? 'P' + P.pid : 'nobody'}`;
    if (why) M.forced.set(fresh.id, now);
  }
  // a lure's or an ambush's quarry, seen going away from it (not coming) for a while: the wait has lost its point
  if (!why && P && (P.k === 'lure' || P.k === 'ambush') && P.pid && e.seenNow.has(P.pid)) {
    const r = e.mem.p.get(P.pid), v = r && r.visual;
    const away = v ? ((v.x - e.x) * v.vx + (v.y - e.y) * v.vy) / Math.max(1, r.dist) : 0;
    const gap = now - (P.awayAt ?? now);                                            // (only the time it watched them go counts: a spell out of its sight adds nothing)
    if (away > SKP.awayV) P.awayT = (P.awayT || 0) + (gap <= .5 ? gap : 0); else P.awayT = 0;
    P.awayAt = now;
    if (P.awayT >= SKP.awayFor && now - (M.forced.get(P.pid) ?? -99) >= SKP.again) { why = `P${P.pid} is going away from its ${P.k}: the wait has lost its point`; M.forced.set(P.pid, now); }
  }
  for (const [id, t] of M.forced) if (now - t > 30) M.forced.delete(id);
  if (!why) return '';
  M.force = why; M.n++;
  e.dbg.preempt = { at: +now.toFixed(2), from: P ? P.k : 'roam', cls, why };
  if (e.mind) { e.mind.ev.push({ t: +now.toFixed(2), k: 'preempt', pid: fresh ? fresh.id : P ? P.pid : 0, x: why.slice(0, 60), resp: -1, how: '', plan: P ? P.k : '' }); while (e.mind.ev.length > 24) e.mind.ev.shift(); e.mind.evN.preempt = (e.mind.evN.preempt || 0) + 1; }
  if (cls === 'low') {                                                              // cut now: the decision runs on this think with nothing to keep
    if (P) { if (P.k === 'leave') e.tally.reconsider++; e.plan = null; e.path = []; }
    e.roam.pause = 0; e.rx = null;
  }
  return why;
}
