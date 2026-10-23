/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer's footwork (Trial 3 R16f): close to a person it sees, it moves like a fighter - facing them, sidestepping, backing, cutting off their way out
 * provides: SKF, skFight, skWayOut
 * uses: angDiff, clamp, lerp, moveCollide, setAct, TAU, turnTo
 * writes: -
 */
/* ---------------------------------------------------------------- ITS FOOTWORK (Trial 3 R16f; dev/trial-3-r9-overhaul/)
 * The owner (October 22, section 5): sidestep, backpedal, contest a doorway sideways, cut off an escape route, correct when the player
 * changes direction, feign a retreat - without mirroring the player's input perfectly: acceleration, turning limits, momentum,
 * collisions, stamina and a fallible prediction stay, and a feint can fool it.  AP_AUDIT.md (C): every move it made went along its facing
 * (the shared steerTo / follow), so circled at 230 px it turned on the spot, nose first, its facing 0.6-1.3 rad behind the person, and
 * never stepped sideways or back.
 *   THE MOVER (skStrafe): a velocity of its own (e.mv), steered toward the one it wants at its own acceleration (e.caps.ACCELERATION);
 *             forward up to the pace it is given, sideways up to SKF.side of it, backward up to SKF.back of it; its facing turned
 *             separately at the species' own turning ability (TURNING_ABILITY, 3.6 rad/s - R16g, the review: R16f turned it at 7).  Not
 *             the shared steering's slower turn at speed: that is a turn of the way it runs, and here the way it goes is its own velocity,
 *             which its acceleration alone may change (momentum); its facing is its body turned over its feet.  Every step through the
 *             shared moveCollide (walls, the swept test).  Never faster than its run
 *             (0.89 x a fresh sprint): a rested runner still wins a straight race; its stamina is spent by the shared rule (skBody).
 *             Its velocity carries over only from the tick before; when the footwork stops, the shared steering goes on with what of it
 *             lies along its facing (R16g: never a sideways step turned forward in one tick).
 *   THE FIGHT (skFight): within SKF.near of a person it sees, on open floor, in an open move (an open approach at the approach's own
 *             pace, a chase at its run, a hungry watch at the watch's own distance - R16g),
 *             it faces them and places itself at SKF.band from where it reckons they will be in SKF.lead seconds - toward their way out:
 *             the open floor round them, the way they are moving, away from it (SKF.cut of the way between straight at them and squarely
 *             in their path).  Closer than the band it backs off, farther it closes in; across, it sidesteps.  What it reckons from is its
 *             own read of their motion, lagging SKF.tau behind it (smarter: less): a sudden reversal takes it a moment to answer - a feint
 *             works.  Its spring (T4: the wind-up, the reach) is unchanged and decides as before when it strikes.
 *   A FEIGNED RETREAT: somebody coming at it is given ground - it backs off facing them to the far edge of its band, its spring ready
 *             (T4 decides as before); R13's bait round a corner is its own plan and unchanged (backing to its spot facing them changed where it
 *             lay in wait, and with it SK21's scene - tried, and left as R13 made it).
 * Cost: per tick a few multiplications; on a think, 12 rays from the person for their way out. */
const SKF = Object.freeze({
  near: 400,                                     // px: within this of a person it sees (and a clear way to them) it moves as a fighter (R18; R16f-R16i 340)
  band: [115, 170],                              // px: the distance it keeps from where it reckons they will be (its spring: 55-185)
  side: .75, back: .55,                          // the share of its pace it can move sideways and backward
  gain: 3.2,                                     // 1/s: how hard it steers toward where it wants to be
  tau: [.32, .18],                               // s its read of their motion lags (dull .. sharp): a reversal fools it for about that long
  lead: [.25, .45],                              // s ahead it reckons where they will be (dull .. sharp)
  cut: .55,                                      // how far toward their way out it places itself (0: straight at them; 1: squarely in their path)
  swing: .9,                                     // rad: the most it swings its place about them at a time
  keep: 1,                                       // s: a break in the fight shorter than this keeps its read of their motion (R18)
  goAway: 60, runIn: 40,                         // px/s away from it (and most of their speed) that is going away; px from where it reckons they will be that it runs in to (R18)
});
/* (R19: factored out of skFight, unchanged) their way out, as it reckons it: of twelve directions from them, the one with open floor, the
 * way it reads them moving (vx, vy) and away from it - a doorway, a corridor.  The level's shape and its own read of them only */
function skWayOut(geo, e, p, vx, vy) {
  const sp = Math.hypot(vx, vy), mv = Math.atan2(vy, vx), away = Math.atan2(p.y - e.y, p.x - e.x); let best = -1e9, esc = 0;
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * TAU, s = geo.ray(p.x, p.y, a, 420) / 420 + (sp > 60 ? .9 * Math.cos(angDiff(a, mv)) : 0) + .7 * Math.cos(angDiff(a, away));
    if (s > best) { best = s; esc = a; }
  }
  return esc;
}
/* move toward (gx, gy) at up to vmax (forward; SKF.side sideways, SKF.back backward), facing (fx, fy); its own velocity and acceleration */
function skStrafe(eng, e, gx, gy, fx, fy, vmax, dt, gain = SKF.gain) {
  const now = eng.now, M = e.mv && now - e.mv.at <= dt * 1.5 + 1e-6 ? e.mv : (e.mv = { x: Math.cos(e.ang) * e.speed, y: Math.sin(e.ang) * e.speed, at: now });   // (only the tick before's: R16g)
  turnTo(e, Math.atan2(fy - e.y, fx - e.x), e.caps.TURNING_ABILITY, dt);   // (R16g: the species' own turning ability - see the header)
  const hx = Math.cos(e.ang), hy = Math.sin(e.ang);
  let vx = (gx - e.x) * gain, vy = (gy - e.y) * gain;
  let f = vx * hx + vy * hy, l = -vx * hy + vy * hx;                                              // (forward and sideways, as it faces)
  f = clamp(f, -vmax * SKF.back, vmax); l = clamp(l, -vmax * SKF.side, vmax * SKF.side);
  const sp = Math.hypot(f, l); if (sp > vmax) { f *= vmax / sp; l *= vmax / sp; }                // (never faster than the pace it is given, whichever way)
  vx = f * hx - l * hy; vy = f * hy + l * hx;
  const ax = vx - M.x, ay = vy - M.y, a = Math.hypot(ax, ay), amax = (e.caps.ACCELERATION || 500) * dt;
  if (a > amax) { M.x += ax / a * amax; M.y += ay / a * amax; } else { M.x = vx; M.y = vy; }
  M.at = now;
  e.moved = moveCollide(eng, e, M.x * dt, M.y * dt);
  if (e.moved < Math.hypot(M.x, M.y) * dt * .5) { M.x *= .5; M.y *= .5; }                         // (a wall takes its momentum)
  e.speed = Math.hypot(M.x, M.y);
  return { f: M.x * hx + M.y * hy, l: -M.x * hy + M.y * hx };
}
/* within SKF.near of r (seen, a clear way to them): face them and take its place by their way out.  Returns true when it moved so.
 * band: the distance it keeps (SKF.band; a watch its own) */
function skFight(eng, e, r, p, d, dt, thinkNow, vmax, band = SKF.band) {
  if (!r.seen || d > SKF.near || e.disguise || e.exh) return false;
  const geo = eng.geo, now = eng.now, T = e.tr.INTELLIGENCE, tau = lerp(SKF.tau[0], SKF.tau[1], T), lead = lerp(SKF.lead[0], SKF.lead[1], T);
  const fresh = e.fight && e.fight.pid === r.id && now - e.fight.at < .5;
  // (R18) its read of their motion goes on across a short break (a blocked line, a strike): a fight taken up again starts from it, caught
  // up by the time between at its own lag - R16f-R16i started every fight from their true motion, so a reversal during a break was read at once
  const rd = e.fight && e.fight.pid === r.id && e.fight.rd && now - e.fight.rd.at < SKF.keep ? e.fight.rd : null;
  if (fresh && e.fight.blocked && !thinkNow) return false;                                       // (R16g: no clear way to them - tested again on its next think, not every tick)
  if (thinkNow || !fresh) {
    if (!geo.lineClear(e.x, e.y, p.x, p.y, e.rc * .6, 'walk')) { e.fight = { pid: r.id, at: now, blocked: 1, rd }; return false; }
    const k0 = rd ? 1 - Math.exp(-(now - rd.at) / tau) : 1;
    const F = fresh && !e.fight.blocked ? e.fight : (e.fight = { pid: r.id, vx: rd ? rd.vx + (p.vx - rd.vx) * k0 : p.vx, vy: rd ? rd.vy + (p.vy - rd.vy) * k0 : p.vy, esc: null, t0: now });
    F.esc = skWayOut(geo, e, p, F.vx, F.vy);                                                     // their way out (R19: the same reckoning, shared)
    F.at = now;
  }
  const F = e.fight;
  const k = 1 - Math.exp(-dt / tau); F.vx += (p.vx - F.vx) * k; F.vy += (p.vy - F.vy) * k;          // (its read of their motion: it lags)
  const R = F.rd || (F.rd = {}); R.vx = F.vx; R.vy = F.vy; R.at = now;                              // (R18: kept across a short break)
  const qx = p.x + F.vx * lead, qy = p.y + F.vy * lead;
  // where it wants to be: SKF.band from where it reckons they will be, round them toward their way out - it swings its place about them
  // (at most SKF.swing at a time), so that it steps into their path the way they lean, never through them
  const ux = e.x - qx, uy = e.y - qy, L = Math.hypot(ux, uy) || 1, u0 = Math.atan2(uy, ux);
  let dA = angDiff(F.esc, u0);
  if (Math.abs(dA) > 2.6) { const lean = ux * F.vy - uy * F.vx; dA = (lean >= 0 ? 1 : -1) * 2.6; }    // (straight away from it: round the way they are moving - R18: the side they lean to; R16f-R16i took the other)
  const closing = ((e.x - p.x) * p.vx + (e.y - p.y) * p.vy) / Math.max(1, d) > 40;                  // (they come at it: it gives ground)
  // (R18) it reckons they go away from it - mostly away (within 45 degrees of straight away, over SKF.goAway; its own lagging read of their
  // motion, so a reversal fools this too): it runs straight in on where it reckons they will be (SKF.runIn from it, no swing round them) -
  // a band held behind a runner only lets them go, and a place swung beside them made its spring cross their path (two misses by 1-2 px
  // of a walker); somebody going round it keeps its band and its swing.  (R16f-R16i closed on a runner because the straight-away case
  // swung its place to the wrong side and back, tick by tick: see the lean above)
  const relR = ((e.x - p.x) * F.vx + (e.y - p.y) * F.vy) / Math.max(1, d), going = relR < -Math.max(SKF.goAway, .7 * Math.hypot(F.vx, F.vy));
  const g = going ? u0 : u0 + clamp(dA * SKF.cut, -SKF.swing, SKF.swing);
  const D = closing ? band[1] : going ? Math.min(L, SKF.runIn) : clamp(L, band[0], band[1]);
  const m = skStrafe(eng, e, qx + Math.cos(g) * D, qy + Math.sin(g) * D, p.x, p.y, vmax, dt);
  setAct(e, m.f < -30 ? 'back' : e.speed > 150 ? 'chase' : 'pace');
  F.side = (F.side || 0) + (Math.abs(m.l) > 40 && Math.abs(m.l) > Math.abs(m.f) ? dt : 0); F.backT = (F.backT || 0) + (m.f < -30 ? dt : 0);
  return true;
}
