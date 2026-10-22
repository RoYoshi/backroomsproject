/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer's cover (Trial 3 R13): a covert way audited point by point against every view it knows of, or no covert way at all
 * provides: SKC, skCaught, skCovertFollow, skCovertWay, skExposedNow, skWatchers
 * uses: angDiff, skExposedTo, skLegible, skObsOf, steerTo
 * writes: -
 */
/* ---------------------------------------------------------------- THE SKIN-STEALER'S COVER (Trial 3 R13; dev/trial-3-r9-overhaul/)
 * The owner's complaint (October 22): it sneaks in front of the player into its hiding place.  R9 found why (R9_AUDIT.md H1-H4): R8 checked
 * only that the END of a flank was out of the person's sight, priced the cells they could see at a small finite cost, refused every route
 * longer than 2.6 x their distance - so the hidden ways round (2.3-3 x as long) were never taken - and never looked again on the way.
 * This part plans a COVERT WAY so that it is one, and refuses one that is not:
 *   - THE VIEWS IT KNOWS OF (skWatchers): every person it sees now, and every person it saw within SKC.recent s (where they stood, as it
 *     saw them - it may have turned its back), by the rules of their own screen (R11's skExposedTo: their sight mask, a clear line,
 *     readable light) - these it is sure of; and, for the person it hunts if it has not seen them lately, their view from its belief (a
 *     place, the facing unknown) - a suspicion.  Never a player's real place for anybody it does not see.
 *   - THE WITHDRAWAL: starting in somebody's view, it first goes straight away from them (their bearing kept within SKC.exitCone, farther
 *     from them all the way), at most SKC.exitMax px, to the first point none of them can see - the way a creature backs off, never across
 *     their front.  With no such point there is no covert way ('no_exit').
 *   - THE HIDDEN WAY: A* on the level's own grid from there, where a cell anybody it is sure of could see (with SKC.margin px to spare across
 *     the line of sight) is IMPASSABLE, and a cell only suspected to be in view costs SKC.suspect more.
 *   - THE AUDIT: the whole way is walked every SKC.sample px and every view it knows of is tested again with the true body rule.  A way is
 *     COVERT only if after the withdrawal no point is in a view it is sure of, at most SKC.suspectMax px lie in a view it only suspects,
 *     and it is no longer than SKC.coverMax; otherwise it is refused with the reason (no_exit, no_cover, route_exposed, route_suspected,
 *     too_long) - the cost is never lowered until an exposed way wins.
 *   - FOLLOWING IT (skCovertFollow): its own steering along the way's points with a short look-ahead (it cuts no corner into a view), and
 *     no re-planning with a softer cost: stuck, it asks for a new covert way or gives up the covert move.
 * Bounded: one A* of at most SKC.nodes nodes per way asked for (a flank asks for at most SKC.tries), each cell's views tested once per way
 * (memo), the audit a few dozen points. */
const SKC = Object.freeze({
  recent: 1.5,                                   // s: a person it saw this recently is still a view it is sure of (where it saw them)
  eyesTurn: 2,                                   // s: a person who met its eyes this recently may turn their torch anywhere
  exitMax: 240,                                  // px: the longest withdrawal it may make in a person's view before its way must be hidden
  exitCone: .4,                                  // rad: a withdrawal keeps its bearing from them within this
  suspect: 260,                                  // A* cost of a cell in a view it only suspects
  suspectMax: 144,                               // px of a covert way it may cross in a view it only suspects
  sample: 24,                                    // px between the audit's points
  margin: 34,                                    // px: the A* keeps this far (across the line of sight) from the edge of a view; the audit tests the true body (18)
  nodes: 3500,                                   // A* nodes for one covert way (only cells a way short enough could pass through are searched: below)
  coverMax: 2200,                                // px: the longest covert way it takes
  tries: 3,                                      // flank spots it asks a covert way for, at most
  look: 40,                                      // px: its look-ahead along a covert way
  sprintFrom: 96,                                // px: this far into the hidden part of a covert way it may run
  settle: 220,                                   // px: this near the end it slows to a stalk (it arrives quietly)
  rush: 360,                                     // px: from cover it breaks out openly at a person this close (an open act, telegraphed)
  moved: 150,                                    // px: they moved this far from where its ambush point was chosen for them: it thinks again
  rushFor: 2.2,                                  // s: a rush from cover goes on this long toward where they were, unseen
  ambushHungry: 2.5,                             // s: very hungry, it waits in ambush this long before it breaks cover (if they are near)
  suspectTtl: 10,                                // s: a belief older than this is no view at all
  heardFresh: 1,                                 // s: somebody heard this recently, from a place that could see it, catches it on its covert way
  glance: [1.4, .4, 1.3],                        // on the hidden part of a covert way it looks back: every [0] s, for [1] s, its head turned up to [2] rad
});
/* the views it knows of: the people it sees or saw within SKC.recent s (sure: where it saw them, facing and light as it saw them), or heard
 * within SKC.heardFresh s since it last saw them (sure: where it heard them, their light able to point anywhere) and, for the person it
 * hunts if it has none of these, a view from its belief (a suspicion) */
function skWatchers(eng, e, pid, at) {
  const out = [], now = eng.now;
  for (const r of e.mem.p.values()) {
    if (!eng.byId.has(r.id) || (r.visual && (!r.visual.alive || r.visual.caught))) continue;
    if (!e.seenNow.has(r.id) && r.heardAt > r.seenAt && now - r.heardAt <= SKC.heardFresh) {   // (heard since it last saw them: there, facing unknown)
      const ob = skObsOf(eng, e, Object.assign({}, r, { seen: false }), { x: r.hx, y: r.hy }); ob.pid = r.id; ob.seen = true; out.push(ob); continue;
    }
    if (!r.visual || !(e.seenNow.has(r.id) || now - r.seenAt <= SKC.recent)) continue;
    const ob = skObsOf(eng, e, Object.assign({}, r, { seen: true })); ob.pid = r.id;
    const mo = e.mind && e.mind.obs.get(r.id); if (mo && now - mo.eyesAt < SKC.eyesTurn) ob.angle = null;   // (somebody watching it will turn their light on it: their torch may point anywhere)
    out.push(ob);
  }
  // (footsteps it cannot put a name to, just now: somebody is there - their view counts, their light able to point anywhere)
  for (const q of e.mem.sounds) if (q.src === 0 && now - q.t <= SKC.heardFresh && !out.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 120)) out.push({ x: q.x, y: q.y, angle: null, light: true, kind: 'flashlight', seen: true, pid: 0 });
  if (pid && !out.some(o => o.pid === pid)) {
    const r = e.mem.p.get(pid), H = e.hunt && e.hunt.pid === pid ? e.hunt : null;
    const place = at || (H && now - H.bt < SKC.suspectTtl ? { x: H.x, y: H.y } : r && now - Math.max(r.seenAt, r.heardAt) < SKC.suspectTtl ? { x: r.lkx, y: r.lky } : null);
    if (place) { const ob = skObsOf(eng, e, r, place); ob.pid = pid; ob.seen = false; out.push(ob); }
  }
  return out;
}
/* the people it is sure of who could see it where it stands now (by their screen's rules) */
function skExposedNow(eng, e) { return skWatchers(eng, e, 0).filter(ob => skExposedTo(eng, ob, e.x, e.y)).map(ob => ob.pid); }
/* on a covert way, is it caught?  Anybody it is sure of who can see it now - seen, seen a moment ago, or HEARD since from a place that
 * could see it (skWatchers: footsteps at the mouth of its passage tell it it is watched, though it cannot see behind it).  Never a
 * player's real place */
function skCaught(eng, e) { return skExposedNow(eng, e); }
/* a covert way from where it is to (gx, gy): { ok, why, pts, len, exit, susp } - see the part's head */
function skCovertWay(eng, e, gx, gy, obs, maxLen) {
  const geo = eng.geo, sx = e.x, sy = e.y, sure = obs.filter(o => o.seen), guess = obs.filter(o => !o.seen);
  e.tally.coverQ = (e.tally.coverQ || 0) + 1;
  // (the A*'s test of a cell: the body's own three points across the line of sight and two wider, so that a way between cell centres keeps
  // clear of the edge of a view; the audit then tests the true body)
  const sees = (o, x, y) => {
    const d = Math.hypot(x - o.x, y - o.y); if (d > 700 + SKC.margin) return false;
    const ux = (x - o.x) / (d || 1), uy = (y - o.y) / (d || 1);
    for (const k of [0, -18, 18, -SKC.margin, SKC.margin]) { const qx = x - uy * k, qy = y + ux * k; if (Math.hypot(qx - o.x, qy - o.y) <= 700 && geo.los(o.x, o.y, qx, qy) && skLegible(eng, o, qx, qy) >= .25) return true; }   // (the line first: most cells it tests are behind a wall)
    return false;
  };
  // the withdrawal: straight away from everybody who can see it now, to the first point none of them can (and one step more)
  const by = sure.filter(o => skExposedTo(eng, o, sx, sy));
  let ex = sx, ey = sy, exit = 0;
  if (by.length) {
    let ux = 0, uy = 0; for (const o of by) { const d = Math.hypot(sx - o.x, sy - o.y) || 1; ux += (sx - o.x) / d; uy += (sy - o.y) / d; }
    const a0 = Math.atan2(uy, ux); let got = null;
    for (const da of [0, .2, -.2, .35, -.35]) {
      const a = a0 + da, cx = Math.cos(a), cy = Math.sin(a);
      if (by.some(o => Math.abs(angDiff(a, Math.atan2(sy - o.y, sx - o.x))) > Math.PI / 2 - .2)) continue;   // (never toward or across anybody)
      for (let m = SKC.sample; m <= SKC.exitMax; m += SKC.sample) {
        const x = sx + cx * m, y = sy + cy * m;
        if (!geo.lineClear(sx, sy, x, y, e.rc + 2, 'walk')) break;
        if (!by.every(o => Math.hypot(x - o.x, y - o.y) >= Math.hypot(sx - o.x, sy - o.y) + .5 * m - 4 && Math.abs(angDiff(Math.atan2(y - o.y, x - o.x), Math.atan2(sy - o.y, sx - o.x))) < SKC.exitCone)) break;
        if (!sure.some(o => sees(o, x, y))) { const m2 = Math.min(SKC.exitMax, m + SKC.sample), x2 = sx + cx * m2, y2 = sy + cy * m2; got = geo.lineClear(sx, sy, x2, y2, e.rc + 2, 'walk') ? { x: x2, y: y2, m: m2 } : { x, y, m }; break; }
      }
      if (got) break;
    }
    if (!got) return { ok: false, why: 'no_exit' };
    ex = got.x; ey = got.y; exit = got.m;
  }
  // (R13 perf) a cell no way short enough could pass through (its straight distances from the start of the search and to the goal already
  // longer than the longest way it would take) is never searched: a way it would take is found exactly as before, and a search for a way it
  // could not have taken ends early - without it, a search that found nothing cost 30-100 ms in one step
  const lim = Math.min(SKC.coverMax, maxLen || Infinity) - exit + 1;
  const memo = obs.memo || (obs.memo = new Map());                               // (a cell's cost depends only on the views: one memo for every way to the same views)
  const cost = j => {
    const x = geo.cx(j), y = geo.cy(j);
    if (Math.hypot(x - ex, y - ey) + Math.hypot(gx - x, gy - y) > lim) return Infinity;
    let c = memo.get(j); if (c !== undefined) return c;
    c = (geo.lamp[j] || 0) * 60;
    for (const o of sure) if (sees(o, x, y)) { c = Infinity; break; }
    if (c !== Infinity) for (const o of guess) if (sees(o, x, y)) c += SKC.suspect;
    memo.set(j, c); return c;
  };
  const m0 = memo.size, raw = geo.path(ex, ey, gx, gy, e.caps, { cost, maxNodes: SKC.nodes });
  if (!raw) return { ok: false, why: 'no_cover', exit, grew: memo.size - m0 };   // (grew: the cells it had to test - near SKC.nodes, the search ran out)
  if (raw.some(q => q.link)) return { ok: false, why: 'no_cover', exit };     // (a vault is a long exposed act of its own: not on a covert way)
  const pts = (exit ? [{ x: ex, y: ey, exit: 1 }] : []).concat(raw.map(q => ({ x: q.x, y: q.y })));
  // the audit, along the whole way
  let len = 0, exposed = 0, susp = 0, px = sx, py = sy, seenAt = null;
  for (const q of pts) {
    const L = Math.hypot(q.x - px, q.y - py), n = Math.max(1, Math.ceil(L / SKC.sample));
    for (let k = 1; k <= n; k++) {
      const x = px + (q.x - px) * k / n, y = py + (q.y - py) * k / n; len += L / n;
      if (len > exit + 1 && sure.some(o => skExposedTo(eng, o, x, y))) { exposed += L / n; if (!seenAt) seenAt = [Math.round(x), Math.round(y), Math.round(len)]; }
      for (const o of guess) if (skExposedTo(eng, o, x, y)) susp += L / n;
    }
    px = q.x; py = q.y;
  }
  const why = exposed ? 'route_exposed' : susp > SKC.suspectMax ? 'route_suspected' : len > Math.min(SKC.coverMax, maxLen || Infinity) ? 'too_long' : '';
  return { ok: !why, why, pts, len: Math.round(len), exit: Math.round(exit), exposed: Math.round(exposed), susp: Math.round(susp), seenAt, cells: memo.size };
}
/* along a covert way: its own steering toward a point SKC.look px ahead on the way (no corner cut into a view), no re-planning.  Returns
 * 'moving' | 'arrived' | 'stuck' */
function skCovertFollow(eng, e, P, vmax, dt) {
  const W = P.way, pts = W.pts; if (P.wi === undefined) P.wi = 0;
  while (P.wi < pts.length - 1 && Math.hypot(pts[P.wi].x - e.x, pts[P.wi].y - e.y) < 26) P.wi++;
  const end = pts[pts.length - 1]; if (P.wi >= pts.length - 1 && Math.hypot(end.x - e.x, end.y - e.y) < 30) { e.speed = 0; return 'arrived'; }
  let left = SKC.look, ax = e.x, ay = e.y, tx = pts[P.wi].x, ty = pts[P.wi].y;
  for (let k = P.wi; k < pts.length; k++) { const q = pts[k], d = Math.hypot(q.x - ax, q.y - ay); if (d >= left) { tx = ax + (q.x - ax) * left / d; ty = ay + (q.y - ay) * left / d; break; } left -= d; ax = tx = q.x; ay = ty = q.y; }
  if (P.pwi !== P.wi) { e.path = pts.slice(P.wi); P.pwi = P.wi; } e.carrot = { x: tx, y: ty };   // (its route, for the overlay; nothing else follows it)
  steerTo(eng, e, tx, ty, vmax, dt, { turnMul: 1.6 });
  return e.stuck > .9 ? 'stuck' : 'moving';
}
