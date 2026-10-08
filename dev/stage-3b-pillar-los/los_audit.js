/* Stage 3B pillar LOS - how the player's sight polygon follows a pillar, measured against the exact ray query
 * (development only; never served).  Node only: the game's own Hl / Uc / Vl / Pc, run verbatim from a bundle.
 *
 *   node dev/stage-3b-pillar-los/los_audit.js [--game PATH] [--out FILE.json] [--quick]
 *
 * The renderer builds two polygons from the player every frame with Hl:
 *   - the ENTITY mask  Hl(x, y, 700):      creatures are drawn only inside it;
 *   - the SCENE clip   Hl(x, y, 700, 24):  the darkness overlay is cut only inside it (outside, the screen stays black).
 * Truth is the exact ray query Uc from the player along each direction (walls, then the exact 56 x 56 pillar rectangles):
 * a floor point at distance d along direction th is in view exactly when d < Uc(x, y, th, 700).
 *
 * Per pose, over directions (0.1 degree) and distances (2 px), floor points only, each sample weighted by its area:
 *   entity LEAK       inside the entity mask but really hidden    (a creature standing there would be drawn)
 *   entity OVER-HIDE  outside the entity mask but really in view  (the black wedge cut too wide)
 *   scene  LEAK       inside the scene clip but really hidden     (hidden floor lit up)
 * each split by what the exact ray hits first in that direction (a pillar or a wall).  And the shadow edges: on a ring
 * 120 px past the pillar, walking out from the pillar's centre direction, where the entity mask's hidden wedge ends on
 * each side against the exact silhouette corner (degrees), and how far that edge moves between neighbouring poses beyond
 * how far the exact silhouette moves (the "snap").
 *
 * Sets: a full circle around an open PILLAR HALL pillar at three radii (1 degree steps: 0.9 - 2.8 px, a frame of walking);
 * a strafe past its south-west corner (1 px steps) at two distances; standing close to each face and corner; a diagonal
 * walk through the hall past three pillars (whole view, 0.2 degree); and walls: a strafe past a YELLOW HALL partition end
 * (the same measures, the partition as the occluder). */
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), OUT = opt('out'), QUICK = argv.includes('--quick');
const L = require('./los_lib.js').load(GAME), D2R = Math.PI / 180, TAU = 2 * Math.PI;
/* the audited pillar: PILLAR HALL's east-middle pillar, open floor on every side (the centre pillar has wall stubs 20 px west) */
const P = L.Pc.find(p => p.x === 8564 && p.y === 1364), cx = P.x + P.w / 2, cy = P.y + P.h / 2;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a <= -Math.PI) a += TAU; return a; };
/* exact silhouette of a rect seen from (vx, vy): the two extreme corner angles relative to the centre direction */
function silhouette(vx, vy, r) {
  const C = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]], c0 = Math.atan2(r.y + r.h / 2 - vy, r.x + r.w / 2 - vx);
  const as = C.map(([x, y]) => wrap(Math.atan2(y - vy, x - vx) - c0));
  return { c0, lo: Math.min(...as), hi: Math.max(...as), near: Math.min(...C.map(([x, y]) => Math.hypot(x - vx, y - vy))), dc: Math.hypot(r.x + r.w / 2 - vx, r.y + r.h / 2 - vy) };
}
/* a sight polygon is star-shaped about its viewer (one vertex per ray, in angle order): its boundary distance at any
 * direction, by binary search - the same answer as an even-odd point test (checked: los_tests.js) */
function radial(poly, vx, vy) {
  const n = poly.length / 2, A = new Float64Array(n);
  for (let k = 0; k < n; k++) { let a = Math.atan2(poly[2 * k + 1] - vy, poly[2 * k] - vx); if (k) { while (a - A[k - 1] > Math.PI) a -= TAU; while (a - A[k - 1] <= -Math.PI) a += TAU; } A[k] = a; }
  const find = a => { while (a < A[0]) a += TAU; while (a >= A[0] + TAU) a -= TAU;
    let lo = 0, hi = n - 1; if (a >= A[n - 1]) lo = n - 1; else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= a) lo = m; else hi = m; }
    return [a, lo]; };
  const f = a0 => {
    const [a, i] = find(a0), j = (i + 1) % n, x1 = poly[2 * i] - vx, y1 = poly[2 * i + 1] - vy, x2 = poly[2 * j] - vx, y2 = poly[2 * j + 1] - vy;
    const ux = Math.cos(a), uy = Math.sin(a), ex = x2 - x1, ey = y2 - y1, den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-12) return Math.min(Math.hypot(x1, y1), Math.hypot(x2, y2));
    return (x1 * ey - y1 * ex) / den;
  };
  /* angular distance to the nearest polygon vertex (its ray) */
  f.gap = a0 => { const [a, i] = find(a0), j = i + 1; return Math.min(a - A[i], j < n ? A[j] - a : A[0] + TAU - a); };
  return f;
}
/* the area measures over directions [a0, a1] (absolute), distances [d0, d1] */
function areas(vx, vy, sR, cR, a0, a1, dA, d0, d1) {
  const o = { leak: { pillar: 0, wall: 0 }, over: { pillar: 0, wall: 0 }, sLeak: { pillar: 0, wall: 0 }, sOver: { pillar: 0, wall: 0 }, skipped: 0 }, dR = 2;
  for (let th = a0; th <= a1; th += dA) {
    const ux = Math.cos(th), uy = Math.sin(th), U = L.Uc(vx, vy, th, 700), rs = sR(th), rc = cR(th);
    if (U >= 699.9) continue;                                                /* nothing within sight range in this direction */
    /* a direction within 5e-5 rad of one of the polygon's rays: inside the 2e-5 rad slivers either side of a corner event
     * (walls' and pillars' alike: 0.01 px wide at 500 px), which one 0.1 degree sample would weigh 87 times over */
    if (Math.min(sR.gap(th), cR.gap(th)) < 5e-5) { o.skipped++; continue; }
    const by = L.blockerAt(vx + ux * (U + .6), vy + uy * (U + .6)) === 'pillar' ? 'pillar' : 'wall';
    for (let d = d0; d <= d1; d += dR) {
      const x = vx + ux * d, y = vy + uy * d; if (L.blockerAt(x, y) !== 'floor') continue;
      const ex = U >= d - .5, area = dA * d * dR, inS = d < rs, inC = d < rc;
      if (inS && !ex) o.leak[by] += area; else if (!inS && ex) o.over[by] += area;
      if (inC && !ex) o.sLeak[by] += area; else if (!inC && ex) o.sOver[by] += area;
    }
  }
  return o;
}
function measure(vx, vy, r, whole) {
  const sight = L.Hl(vx, vy, 700), scene = L.Hl(vx, vy, 700, 24), sR = radial(sight, vx, vy), cR = radial(scene, vx, vy);
  const S = silhouette(vx, vy, r), far = S.dc + 120;
  const o = whole ? areas(vx, vy, sR, cR, -Math.PI, Math.PI - 1e-9, .2 * D2R, 4, 690)
    : areas(vx, vy, sR, cR, S.c0 + S.lo - 6 * D2R, S.c0 + S.hi + 6 * D2R, .1 * D2R, Math.max(4, S.near - 8), Math.min(690, far + 260));
  /* the entity mask's hidden wedge on the ring 120 px past the occluder: from the centre direction outwards to the first
   * direction the mask shows (non-floor ring points are skipped) */
  let e0 = null, e1 = null;
  if (far < 690) {
    const hid = a => { const th = S.c0 + a, x = vx + Math.cos(th) * far, y = vy + Math.sin(th) * far; return L.blockerAt(x, y) !== 'floor' ? null : sR(th) < far; };
    for (let a = 0, last = 0; a >= S.lo - 10 * D2R; a -= .01 * D2R) { const h = hid(a); if (h === null) continue; if (!h) { e0 = last; break; } last = a; }
    for (let a = 0, last = 0; a <= S.hi + 10 * D2R; a += .01 * D2R) { const h = hid(a); if (h === null) continue; if (!h) { e1 = last; break; } last = a; }
  }
  return Object.assign(o, { edgeLo: e0 === null ? null : (e0 - S.lo) / D2R, edgeHi: e1 === null ? null : (e1 - S.hi) / D2R, lo: S.lo, hi: S.hi, c0: S.c0, verts: sight.length / 2, sceneVerts: scene.length / 2 });
}
const r1 = v => +v.toFixed(1), r3 = v => +v.toFixed(3);
function stats(rows) {
  const k = f => rows.map(f).filter(v => v !== null && Number.isFinite(v)), mx = a => a.length ? Math.max(...a) : 0, mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const block = (key, by) => { const v = k(r => r[key][by]); return { mean: r1(mean(v)), max: r1(mx(v)), poses: v.filter(x => x > 4).length }; };
  const eAll = k(r => r.edgeLo === null ? null : Math.abs(r.edgeLo)).concat(k(r => r.edgeHi === null ? null : Math.abs(r.edgeHi)));
  /* snap: the measured edge's move between neighbouring poses beyond the exact silhouette corner's move */
  let snap = 0; const snaps = [];
  for (let i = 1; i < rows.length; i++) { const a = rows[i - 1], b = rows[i];
    for (const [E, X] of [['edgeLo', 'lo'], ['edgeHi', 'hi']]) { if (a[E] === null || b[E] === null) continue;
      const exact = Math.abs(wrap((b[X] + b.c0) - (a[X] + a.c0))) / D2R, meas = Math.abs(wrap((b[X] + b.c0 + b[E] * D2R) - (a[X] + a.c0 + a[E] * D2R))) / D2R;
      if (exact < 5) { snaps.push(Math.max(0, meas - exact)); snap = Math.max(snap, meas - exact); } } }
  return { poses: rows.length,
    entityLeak: { pillar: block('leak', 'pillar'), wall: block('leak', 'wall') }, entityOverHide: { pillar: block('over', 'pillar'), wall: block('over', 'wall') },
    sceneLeak: { pillar: block('sLeak', 'pillar'), wall: block('sLeak', 'wall') }, sceneOverHide: { pillar: block('sOver', 'pillar'), wall: block('sOver', 'wall') },
    edgeErrorDeg: { mean: r3(mean(eAll)), max: r3(mx(eAll)) }, edgeSnapDeg: { max: r3(snap), over05: snaps.filter(s => s > .5).length },
    skippedRays: k(r => r.skipped).reduce((s, v) => s + v, 0), vertsMean: Math.round(mean(k(r => r.verts))), sceneVertsMean: Math.round(mean(k(r => r.sceneVerts))) };
}
const walkable = (x, y) => L.zc(Math.floor(x / 96), Math.floor(y / 96)) && !L.Pc.some(p => x > p.x - 15 && x < p.x + p.w + 15 && y > p.y - 15 && y < p.y + p.h + 15);
if (require.main === module) {
  const R = { game: GAME, pillar: P, sets: {}, poses: {} }, step = QUICK ? 3 : 1;
  const run = (name, poses, rect, whole) => { const rows = poses.filter(([x, y]) => whole ? walkable(x, y) : L.zc(Math.floor(x / 96), Math.floor(y / 96))).map(([x, y]) => measure(x, y, rect, whole)); R.sets[name] = stats(rows); R.poses[name] = rows.map(r => [r.edgeLo === null ? null : r3(r.edgeLo), r.edgeHi === null ? null : r3(r.edgeHi), r1(r.leak.pillar), r1(r.over.pillar), r1(r.sLeak.pillar)]); };
  for (const rad of [50, 90, 160]) { const ps = []; for (let deg = 0; deg < 360; deg += step) ps.push([cx + Math.cos(deg * D2R) * rad, cy + Math.sin(deg * D2R) * rad]); run('orbit r' + rad, ps, P); }
  for (const dy of [70, 200]) { const ps = []; for (let x = P.x - 120; x <= P.x + 60; x += step) ps.push([x, P.y + P.h + dy]); run('strafe y+' + dy, ps, P); }
  run('close faces + corners', [[cx, P.y - 16], [cx, P.y + P.h + 16], [P.x - 16, cy], [P.x + P.w + 16, cy], [P.x - 12, P.y - 12], [P.x + P.w + 12, P.y - 12], [P.x - 12, P.y + P.h + 12], [P.x + P.w + 12, P.y + P.h + 12]], P);
  { const ps = []; for (let t = 0; t <= 1; t += (QUICK ? 12 : 4) / 1300) ps.push([7560 + t * 1100, 912 + 60 + t * 1100]); run('diagonal walk (whole view)', ps, P, true); }
  /* walls: strafe north-south past the top end of the YELLOW HALL partition (column 9, rows 28 - 30: x 864 - 960,
   * y 2688 - 2976), 164 px west of it */
  { const W = { x: 864, y: 2688, w: 96, h: 288 }, ps = []; for (let y = 2600; y <= 2900; y += step) ps.push([700, y]); run('wall end strafe (regression)', ps, W); }
  for (const [k, v] of Object.entries(R.sets)) console.log(k.padEnd(28), JSON.stringify(v));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
}
module.exports = { radial, silhouette, measure, stats, L };
