/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer's eyes (Trial 3 R16e): its head snaps to what it perceives, movement at the edge of its view, where to look from
 * provides: SKL, skHeadStep, skLookThink, skVantage
 * uses: angDiff, clamp, setAct, TAU, turnTo, visualObservation
 * writes: -
 */
/* ---------------------------------------------------------------- ITS EYES (Trial 3 R16e; dev/trial-3-r9-overhaul/)
 * The owner (October 22, the additional refinement, sections 3, 4 and 6): it should snap its head to a sound or a movement, turn its body
 * when the head cannot reach, and go to where it could see what it heard - and the server's sight must turn with the head the players see.
 * AP_AUDIT.md found: under every plan but roaming its head was held straight; a sound turned it only by B1's look (the body, at 3.2 rad/s)
 * and only with no plan; its head turned at dt x 5 (about 0.6 s to 95 %) and only 1 rad; movement just outside its view was never noticed;
 * after a sound it went to the sound's own fuzzy place.  This part:
 *   STIMULI   a sound it hears (anonymous, or of somebody it does not see now), on the tick it is heard, its head starting SKL.latency
 *             after it; movement at the edge of its view (skPeriph: a person moving outside its field of view but within SKL.periph of
 *             it, near enough to make out there - the same eyes, light, posture, motion and walls as its sight), on its think; a person
 *             newly in its sight who is not its plan's quarry.  A movement gives no identity: only an approximate place.  Nothing reads a
 *             person it does not sense.
 *   THE HEAD  snaps toward the stimulus at SKL.snap rad/s, easing in at the end, up to SKL.headMax either side of its body (R8: 1), and
 *             holds it SKL.hold seconds; then the plan's own head (its gaze, its listening sway) takes over from where it is.  Under a
 *             plan whose quarry it sees, the head never turns so far that the quarry leaves its view.  Never during a strike or a kill.
 *             The engine's sight is centred on e.ang + e.head, the snapshot carries e.head: what the players see is what it sees.
 *   THE BODY  beyond the head's reach, SKL.bodyAfter seconds after the head began, the body turns at SKL.bodyRate where it is free to:
 *             roaming (it stops), a hunt's listening, a search's look round where it arrived; on a listen after a sound it faces the sound at
 *             the same rate.  On the move under a plan the head alone turns: the plan steers the body.
 *   WHERE TO LOOK FROM  after a sound it cannot see the source of, it goes to the nearest point on open floor from which it would make
 *             out somebody standing unlit at that place - its own sight's rules: the light there, the distance, the walls (skVantage) -
 *             not to the place itself, and looks at it from there (SKL.lookFrom); seeing nothing, it goes on to the place itself.
 * Cost: per tick a few multiplications; on a think, one visual test for each person moving outside its view (the shared sight's own
 * rays); a vantage search (70 points at most, a clear-floor test and a sight test each) only when a sound sends it to look. */
const SKL = Object.freeze({
  headMax: 1.25,                                 // rad either side of its body the head turns (R8: 1)
  snap: 13, ease: 25,                            // rad/s a snap turns the head at; the rate (1/s) it eases in over the last SKL.easeIn rad
  free: 8,                                       // rad/s the head turns at most otherwise (its plan's gaze, sway, glance)
  easeIn: .2,
  latency: [.05, .09],                           // seconds from hearing a sound to its head starting to turn (on a think: the think's own phase)
  bodyAfter: .1, bodyRate: 5,                    // seconds after the head starts before the body follows (beyond the head's reach); its turn on the spot
  reach: .85,                                    // the body follows once the stimulus is beyond this share of the head's reach
  hold: { sight: .6, motion: .9, sound: .9 },    // seconds the head holds a stimulus
  prio: { sight: 3, motion: 2, sound: 1 },
  same: .35,                                     // rad: a stimulus within this of the one it holds (and under .4 s old) does not start a new snap
  soundI: .06,                                   // the faintest sound that turns its head
  periph: .9, periphV: 70, periphS: .466,        // rad beyond its view's edge it notices movement; px/s that counts as movement; the sight strength
                                                 //  needed there (.466: within .75 of the distance it would make that person out at)
  periphMax: 600,                                // px: and never farther (the edge of an eye sees movement, not detail, and not far)
  keep: .12,                                     // rad inside its view's edge its plan's quarry is kept
  lookFrom: [.5, .9],                            // seconds it looks at the place from its point to look from, before it goes closer
});
/* a stimulus: where, when the head starts, how long it holds, why */
function skStim(eng, e, k, x, y, go, why) {
  const L = e.look, now = eng.now, b = Math.atan2(y - e.y, x - e.x);
  if (L.k && now < L.until && SKL.prio[L.k] > SKL.prio[k]) return false;                          // (holding something that matters more)
  if (L.k && now < L.until && Math.abs(angDiff(b, Math.atan2(L.y - e.y, L.x - e.x))) < SKL.same && now - L.t0 < .4) return false;   // (the same thing, still)
  Object.assign(L, { k, x, y, t0: now, go, until: go + SKL.hold[k], why, body: -1 });
  if (L.h === undefined || L.h === null) L.h = e.head || 0;
  e.dbg.look = { k, at: +now.toFixed(2), go: +go.toFixed(2), x: Math.round(x), y: Math.round(y), why };
  return true;
}
/* (R16e) movement at the edge of its view: the nearest person moving outside its field of view but within SKL.periph of its edge, whom
 * its eyes turned there would make out within .75 of their range and SKL.periphMax (the shared sight's own light, posture, motion and wall tests); an
 * approximate place, never who.  Near level of detail only (the engine's own candidates for its sight) */
function skPeriph(eng, e) {
  if (e.tier !== 'near') return null;
  const half = e.sp.vision.fov / 2, view = e.ang + (e.head || 0); let best = null;
  for (const p of eng.candidates(e, 1750)) {
    if (!p.alive || e.seenNow.has(p.id) || (p.sp || 0) < SKL.periphV) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), b = Math.atan2(dy, dx), off = Math.abs(angDiff(b, view));
    if (d > SKL.periphMax || off <= half || off > half + SKL.periph) continue;
    const eye = Object.create(e); eye.head = angDiff(b, e.ang);                                   // (the same eyes, turned to it)
    const o = visualObservation(eye, eng, p); if (!o.vis || o.strength < SKL.periphS) continue;
    if (!best || d < best.d) best = { d, x: p.x, y: p.y };
  }
  if (!best) return null;
  const u = 20 + best.d * .08, a = e.lookRng() * TAU, m = Math.sqrt(e.lookRng()) * u;           // (where: roughly - its own stream)
  return { x: best.x + Math.cos(a) * m, y: best.y + Math.sin(a) * m, u };
}
/* on its think: movement at the edge of its view; a person newly in its sight who is not its plan's quarry.  Returns the movement (for
 * the decision: a hungry roamer goes to look, as at a strong sound) */
function skLookThink(eng, e) {
  const L = e.look, now = eng.now, P = e.plan;
  const prev = L.seen || new Set(); L.seen = new Set(e.seenNow);
  if (e.pounce || e.recover > 0 || e.commit || e.cap) return null;
  for (const id of e.seenNow) if (!prev.has(id) && !(P && P.pid === id)) {
    const r = e.mem.p.get(id); if (r && r.visual) { skStim(eng, e, 'sight', r.visual.x, r.visual.y, now, `P${id} came into its sight`); break; }
  }
  const m = skPeriph(eng, e);
  if (m && skStim(eng, e, 'motion', m.x, m.y, now, 'something moved at the edge of its view')) { e.tally.periph = (e.tally.periph || 0) + 1; L.m = Object.assign({ t: now }, m); return m; }
  return null;
}
/* (R16e) where to look from: the nearest point on open floor from which it would make out somebody standing unlit at (x, y) - by its own
 * sight's rules there (the light at that place, the distance, the walls: the shared visualObservation, asked of a person who is not
 * there), and a little beyond it on the far side (u: how roughly it placed the sound) - round the place (four rings) and on the straight
 * way to it; null when it could make them out from where it stands */
function skVantage(eng, e, x, y, u = 0) {
  const geo = eng.geo, m = Math.min(u * .6, 120);
  const sees = (px, py) => {                                                                     // (and a little beyond it: where it heard them is only roughly where they are)
    const d = Math.hypot(x - px, y - py) || 1, fx = x + (x - px) / d * m, fy = y + (y - py) / d * m, far = m > 0 && geo.clear(fx, fy, 14, 'walk');
    const who = { id: -1, x: far ? fx : x, y: far ? fy : y, alive: true, st: 0, sp: 0, light: false, prof: 1 };
    const eye = Object.create(e); eye.x = px; eye.y = py; eye.act = 'search'; eye.head = angDiff(Math.atan2(who.y - py, who.x - px), e.ang);
    return visualObservation(eye, eng, who).vis;
  };
  if (sees(e.x, e.y)) return null;
  let best = null, bs = 1e9;
  const at = (px, py) => { const d = Math.hypot(px - e.x, py - e.y); if (d >= bs || !geo.clear(px, py, e.rc + 2, 'walk') || !sees(px, py)) return; bs = d; best = { x: px, y: py }; };
  for (const R of [90, 150, 220, 300]) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; at(x + Math.cos(a) * R, y + Math.sin(a) * R); }
  for (let k = 1; k <= 6; k++) at(e.x + (x - e.x) * k / 7, e.y + (y - e.y) * k / 7);
  return best;
}
/* every tick, after its plan has moved it: a sound just heard; the head's snap; the body where it is free to turn.  Whoever moved the head
 * this tick (a snap, or its plan's own sway, gaze or glance), it never turns faster than SKL.snap in a snap and SKL.free otherwise */
function skHeadStep(eng, e, dt) {
  const L = e.look, prev = L.prev ?? (e.head || 0);
  skSnap(eng, e, dt);
  const lim = L.k && eng.now >= L.go && eng.now < L.until ? SKL.snap : SKL.free;
  e.head = clamp(e.head || 0, prev - lim * dt, prev + lim * dt); L.prev = e.head;
}
function skSnap(eng, e, dt) {
  const L = e.look, now = eng.now, P = e.plan;
  const q = e.mem.sounds[0];
  if (q && q.id > (L.sid || 0)) {
    L.sid = q.id;
    if (q.src !== -1 && q.I >= SKL.soundI && now - q.t < .3 && !(q.pid && e.seenNow.has(q.pid)) && !(e.pounce || e.recover > 0 || e.commit || e.cap))
      skStim(eng, e, 'sound', q.x, q.y, q.t + SKL.latency[0] + (SKL.latency[1] - SKL.latency[0]) * e.lookRng(), `it heard ${q.type || 'something'}`);
  }
  if (!L.k || now >= L.until || e.pounce || e.recover > 0 || e.commit || e.cap) { if (L.k && now >= L.until) { L.k = ''; L.h = null; } return; }
  if (now < L.go) { L.h = e.head || 0; return; }                                                  // (its reaction time: the plan's head until then)
  const b = Math.atan2(L.y - e.y, L.x - e.x);
  // the body first: beyond the head's reach, where it is free to turn (roaming it stops to; a search's look round turns its way)
  const free = !e.rx && !e.disguise && (!P || (P.k === 'listen' && !P.curious) || (P.k === 'search' && P.looked));
  if (free && Math.abs(angDiff(b, e.ang)) > SKL.headMax * SKL.reach && now - L.go >= SKL.bodyAfter) {
    if (L.body < 0) { L.body = now; e.dbg.look.body = +now.toFixed(2); }
    if (!P) { if (e.roam && e.roam.goal) { e.roam.pause = Math.max(e.roam.pause, L.until - now); setAct(e, 'watch'); } turnTo(e, b, SKL.bodyRate, dt); }
    else if (P.k === 'search') P.look0 = (P.look0 + clamp(angDiff(b, P.look0), -SKL.bodyRate * dt, SKL.bodyRate * dt) + TAU) % TAU;
    else turnTo(e, b, SKL.bodyRate, dt);
  }
  // the head: toward it, within its reach - and, under a plan whose quarry it sees, never so far that the quarry leaves its view
  const rel = angDiff(b, e.ang); let lo = -SKL.headMax, hi = SKL.headMax;
  if (P && P.pid && e.seenNow.has(P.pid)) {
    const r = e.mem.p.get(P.pid); if (r && r.visual) { const qb = angDiff(Math.atan2(r.visual.y - e.y, r.visual.x - e.x), e.ang), w = e.sp.vision.fov / 2 - SKL.keep; lo = Math.max(lo, qb - w); hi = Math.min(hi, qb + w); }
  }
  const want = lo <= hi ? clamp(rel, lo, hi) : 0, err = want - L.h;
  L.h += Math.abs(err) > SKL.easeIn ? clamp(err, -SKL.snap * dt, SKL.snap * dt) : err * (1 - Math.exp(-SKL.ease * dt));
  e.head = L.h;
}
