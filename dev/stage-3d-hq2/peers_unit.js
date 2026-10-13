/* Stage 3D HQ2 - server/peers.js on its own: properties, a fuzz, and the per-packet cost (development only)
 *
 *   node dev/stage-3d-hq2/peers_unit.js --game DIR [--trials 3000] [--out FILE.json]
 *
 * The functions are pure, so every property can be checked exactly (no whole-pixel rounding as on the wire):
 *   U1 legal: the end point is never closer to a peer than min(start distance, D); the straight path never dips more than TOL below
 *      that; a zero-length move and a move from zero distance never produce NaN
 *   U2 fuzz of resolve: 2-8 players in a small box, many of them stacked or overlapping, 400 claims per trial of every size (sub-pixel,
 *      ordinary, lag bursts up to 560 px), aimed at a peer, past one, sideways or anywhere.  After every accepted move, for every peer:
 *        finite; never closer than the floor; the path never through the body (floor - TOL); never further than the claim (no push, no
 *        extra motion); a 'free' answer is the claim exactly; a pair once >= D apart never closer than D again; the peers untouched
 *   U3 no creep: 100 000 claims of 0.01 px, and 2 000 of 1 px, straight at a peer from contact: not 1e-6 px closer
 *   U4 sweepPath: random routes past and through peers: the same invariants leg by leg, and the end of a legal route is accepted
 *   U5 freeSpot: deterministic; its spot is >= D + 8 from every peer and passes clear(); with no free spot, the target itself
 *   B  the cost per packet with seven peers (the gate: <= 5 us at p99), in four regimes: peers far (the usual case: 'free'), a claim
 *      into one peer (a slide), a claim in a tight ring of seven, and the slow path (the slide refused, the bisection) - each call timed
 *      on its own
 * Exit 0 only if every property holds and the cost gate is met. */
'use strict';
const path = require('path'), fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const P = require(path.join(path.resolve(ARG.game || '.'), 'server', 'peers.js'));
const D = P.D_BODY, TOL = P.TOL, EPS = 1e-6, TRIALS = +(ARG.trials || 3000);
let rs = 20261012; const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
const res = { tool: 'dev/stage-3d-hq2/peers_unit.js', D, TOL, checks: [], fails: [] };
const check = (name, ok, info) => res.checks.push({ name, ok: !!ok, info });
const bad = (what, info) => { if (res.fails.length < 40) res.fails.push({ what, info }); };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function closest(x0, y0, x1, y1, qx, qy) { const dx = x1 - x0, dy = y1 - y0, dd = dx * dx + dy * dy; let t = dd ? ((qx - x0) * dx + (qy - y0) * dy) / dd : 0; t = Math.max(0, Math.min(1, t)); return dist(x0 + dx * t, y0 + dy * t, qx, qy); }
function moveOk(x0, y0, x1, y1, r, peers, what) {                         // the invariants of one accepted move from (x0, y0) to r for a claim (x1, y1)
  let ok = true;
  if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) { bad(what + ': not finite', { x0, y0, x1, y1, r }); return false; }
  for (const q of peers) {
    const s0 = dist(x0, y0, q[0], q[1]), fl = Math.min(s0, D), s1 = dist(r.x, r.y, q[0], q[1]);
    if (s1 < fl - EPS) { ok = false; bad(what + ': closer than the floor', { x0, y0, x1, y1, r, q, s0, s1 }); }
    if (fl - TOL > 0 && closest(x0, y0, r.x, r.y, q[0], q[1]) < fl - TOL - EPS) { ok = false; bad(what + ': the path goes through the body', { x0, y0, x1, y1, r, q }); }
  }
  if (dist(x0, y0, r.x, r.y) > dist(x0, y0, x1, y1) + EPS) { ok = false; bad(what + ': moved further than claimed', { x0, y0, x1, y1, r }); }
  if (r.how === 'free' && (r.x !== x1 || r.y !== y1)) { ok = false; bad(what + ': free but not the claim', { x1, y1, r }); }
  return ok;
}

/* U1 */
{
  let ok = true;
  const q = [[100, 100]];
  ok = ok && P.legal(0, 100, 64, 100, q, D) === true && P.legal(0, 100, 64.01, 100, q, D) === false;               // the end point: 36 from it, not 35.99
  ok = ok && P.legal(0, 100, 200, 100, q, D) === false;                                                              // through the body to a legal end
  ok = ok && P.legal(100, 64, 110, 64, q, D) === true && P.legal(100, 64, 136, 100, q, D) === false;               // from contact: along the tangent yes; a quarter of the way round in one chord (10 px deep) no
  ok = ok && P.legal(100, 100, 100, 100, q, D) === true && P.legal(100, 100, 107, 100, q, D) === true;               // zero distance: any move apart
  ok = ok && P.legal(110, 100, 105, 100, q, D) === false && P.legal(110, 100, 112, 100, q, D) === true;              // overlapping: only apart
  const z = P.resolve(100, 100, 100, 100, q, D), z2 = P.resolve(100, 100, 130, 90, [[100, 100], [100, 100]], D);
  ok = ok && Number.isFinite(z.x) && Number.isFinite(z2.x) && z2.how === 'free';
  const chord = (a, b) => { const r = 36 + 1e-9; return P.legal(100 + Math.cos(a) * r, 100 + Math.sin(a) * r, 100 + Math.cos(b) * r, 100 + Math.sin(b) * r, q, D); };
  ok = ok && chord(0, .6) === true && chord(0, 1.0) === false;                                  // a step round a body: a chord dipping < TOL is allowed (0.6 rad: 1.6 px), a longer one is not
  check('U1 legal: end-point floor exact, no passing through, overlaps only shrink, zero distance / zero length safe, chords round a body within TOL', ok, {});
}

/* U2: the fuzz of resolve */
{
  let moves = 0, frees = 0, slides = 0, clamps = 0, stays = 0, ok = true, pairsSeparated = 0;
  for (let tr = 0; tr < TRIALS; tr++) {
    const n = 2 + Math.floor(rnd() * 7), pts = [];
    for (let i = 0; i < n; i++) { if (i && rnd() < .25) { const o = pts[Math.floor(rnd() * i)]; pts.push([o[0] + (rnd() < .5 ? 0 : (rnd() - .5) * 20), o[1] + (rnd() < .5 ? 0 : (rnd() - .5) * 20)]); } else pts.push([rnd() * 300, rnd() * 300]); }
    const apart = new Set();
    for (let k = 0; k < 400; k++) {
      const i = Math.floor(rnd() * n), me = pts[i], others = pts.filter((_, j) => j !== i), snap = JSON.stringify(others);
      const kind = rnd(), len = kind < .2 ? rnd() : kind < .7 ? 2 + rnd() * 18 : kind < .9 ? 20 + rnd() * 100 : 100 + rnd() * 460;
      let ang = rnd() * Math.PI * 2;
      if (rnd() < .6 && others.length) { const q = others[Math.floor(rnd() * others.length)]; ang = Math.atan2(q[1] - me[1], q[0] - me[0]) + (rnd() < .5 ? 0 : (rnd() - .5) * 1.6); }
      const x1 = me[0] + Math.cos(ang) * len, y1 = me[1] + Math.sin(ang) * len;
      const r = P.resolve(me[0], me[1], x1, y1, others, D);
      moves++; ({ free: () => frees++, slid: () => slides++, clamped: () => clamps++, stay: () => stays++ })[r.how]();
      if (!moveOk(me[0], me[1], x1, y1, r, others, 'resolve')) ok = false;
      if (JSON.stringify(others) !== snap) { ok = false; bad('a peer was moved', {}); }
      me[0] = r.x; me[1] = r.y;
      for (let j = 0; j < n; j++) if (j !== i) {
        const key = Math.min(i, j) + ':' + Math.max(i, j), s = dist(me[0], me[1], pts[j][0], pts[j][1]);
        if (apart.has(key) && s < D - EPS) { ok = false; bad('a pair once apart came closer than D', { s }); }
        if (s >= D) { if (!apart.has(key)) pairsSeparated++; apart.add(key); }
      }
    }
  }
  res.fuzz = { trials: TRIALS, moves, free: frees, slid: slides, clamped: clamps, stay: stays, pairsThatSeparated: pairsSeparated };
  check('U2 resolve fuzz: every accepted move finite, never closer than the floor, never through a body, never further than claimed, free = the claim, a separated pair stays separated, peers untouched', ok && slides > 1000 && clamps + stays > 1000, res.fuzz);
}

/* U3: no creep */
{
  let x = 100 - 36, ok = true; const q = [[100, 100]];
  for (let k = 0; k < 100000; k++) { const r = P.resolve(x, 100, x + .01, 100, q, D); x = r.x; }
  const s1 = 100 - x; let x2 = 100 - 36, y2 = 100;
  for (let k = 0; k < 2000; k++) { const a = Math.atan2(100 - y2, 100 - x2) + (k % 2 ? .3 : -.3), r = P.resolve(x2, y2, x2 + Math.cos(a), y2 + Math.sin(a), q, D); x2 = r.x; y2 = r.y; }
  const s2 = dist(x2, y2, 100, 100);
  ok = s1 >= 36 - EPS && s2 >= 36 - EPS;
  res.creep = { after100000steps_of_0_01px: s1, after2000zigzag1pxSteps: s2 };
  check('U3 no creep: 100 000 claims of 0.01 px and 2 000 zig-zag 1 px claims straight at a body from contact end no closer than D', ok, res.creep);
}

/* U4: sweepPath */
{
  let ok = true, routes = 0, frees = 0;
  for (let tr = 0; tr < 4000; tr++) {
    const peers = []; const m = 1 + Math.floor(rnd() * 7); for (let i = 0; i < m; i++) peers.push([rnd() * 400, rnd() * 400]);
    let x0 = rnd() * 400, y0 = rnd() * 400; const legs = 1 + Math.floor(rnd() * 8), pts = []; let px = x0, py = y0;
    for (let i = 0; i < legs; i++) { px += (rnd() - .5) * 120; py += (rnd() - .5) * 120; pts.push([px, py]); }
    const r = P.sweepPath(x0, y0, pts, peers, D); routes++; if (r.how === 'free') frees++;
    if (!Number.isFinite(r.x)) { ok = false; bad('sweepPath: not finite', {}); continue; }
    let ax = x0, ay = y0, reached = false;                                   // walk the route leg by leg up to r: every leg legal from its own start
    for (const q of pts) {
      const onLeg = closest(ax, ay, q[0], q[1], r.x, r.y) < 1e-6;
      const ex = onLeg ? r.x : q[0], ey = onLeg ? r.y : q[1];
      if (!P.legal(ax, ay, ex, ey, peers, D) && !(ex === ax && ey === ay)) { ok = false; bad('sweepPath: an accepted leg is not legal', { ax, ay, ex, ey }); }
      for (const p of peers) if (dist(ex, ey, p[0], p[1]) < Math.min(dist(x0, y0, p[0], p[1]), D) - EPS) { ok = false; bad('sweepPath: closer than the floor', {}); }
      ax = ex; ay = ey; if (onLeg) { reached = true; break; }
    }
    if (r.how === 'free' && (r.x !== pts[pts.length - 1][0] || r.y !== pts[pts.length - 1][1])) { ok = false; bad('sweepPath: free but not the end', {}); }
    if (!reached && r.how !== 'free') { ok = false; bad('sweepPath: its point is not on the route', { r }); }
  }
  res.sweep = { routes, free: frees };
  check('U4 sweepPath: every leg up to the accepted point legal from its own start, never closer than the floor, a fully legal route accepted to its end', ok && frees > 100 && frees < routes, res.sweep);
}

/* U5: freeSpot */
{
  let ok = true, crowded = 0, moved = 0;
  for (let tr = 0; tr < 3000; tr++) {
    const peers = [], m = Math.floor(rnd() * 8); for (let i = 0; i < m; i++) peers.push([200 + (rnd() - .5) * 160, 200 + (rnd() - .5) * 160]);
    const wall = rnd() < .3 ? 200 + (rnd() - .5) * 100 : -1e9, clear = (x, y) => x < wall || x > wall + 40;      // sometimes a wall band to avoid
    const x = 200 + (rnd() - .5) * 60, y = 200 + (rnd() - .5) * 60, a = P.freeSpot(x, y, peers, clear, D), b = P.freeSpot(x, y, peers, clear, D);
    if (JSON.stringify(a) !== JSON.stringify(b)) { ok = false; bad('freeSpot: not deterministic', {}); }
    if (a.crowded) { crowded++; if (a.x !== x || a.y !== y) { ok = false; bad('freeSpot: crowded but not the target', {}); } continue; }
    if (a.moved) moved++;
    if (!clear(a.x, a.y)) { ok = false; bad('freeSpot: not clear', a); }
    for (const q of peers) if (dist(a.x, a.y, q[0], q[1]) < D + 8 - EPS) { ok = false; bad('freeSpot: within D + 8 of a peer', { a, q }); }
  }
  const full = []; for (let r of [0, 44, 88, 132, 176, 220]) for (let k = 0; k < 12; k++) { const t = k / 12 * Math.PI * 2; full.push([200 + Math.cos(t) * r, 200 + Math.sin(t) * r]); }
  const f = P.freeSpot(200, 200, full, () => true, D);
  res.freeSpot = { trials: 3000, moved, crowded, everyCandidateTaken: f };
  check('U5 freeSpot: deterministic, clear, >= D + 8 from every peer; with every candidate taken, the target itself (crowded)', ok && moved > 500 && f.crowded && f.x === 200 && f.y === 200, res.freeSpot);
}

/* B: the cost per packet, seven peers */
{
  let wc = 0; const wallNo = () => (wc++ & 1) === 1;                        // the worst path: the slid point refused (as by a wall), so the bisection runs and its point is checked again
  const time = (n, mk, w) => { const ts = new Float64Array(n); let sink = 0; for (let i = 0; i < n; i++) { const a = mk(i); wc = 0; const t0 = process.hrtime.bigint(); const r = P.resolve(a[0], a[1], a[2], a[3], a[4], D, w); ts[i] = Number(process.hrtime.bigint() - t0); sink += r.x; } ts.sort(); return { p50ns: ts[n >> 1], p99ns: ts[Math.floor(n * .99)], maxns: ts[n - 1], sink: sink > 0 }; };
  const far = [], one = [], crowd = [];
  for (let i = 0; i < 64; i++) {
    const c = [500 + rnd() * 100, 500 + rnd() * 100], f = [], o = [], cr = [];
    for (let k = 0; k < 7; k++) { const a = rnd() * 6.28, r = 150 + rnd() * 400; f.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    const a0 = rnd() * 6.28; o.push([c[0] + Math.cos(a0) * 37, c[1] + Math.sin(a0) * 37]); for (let k = 1; k < 7; k++) { const a = rnd() * 6.28, r = 150 + rnd() * 400; o.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + rnd() * .3; cr.push([c[0] + Math.cos(a) * (36.5 + rnd() * 6), c[1] + Math.sin(a) * (36.5 + rnd() * 6)]); }
    const step = 6 + rnd() * 14, sa = rnd() * 6.28;
    far.push([c[0], c[1], c[0] + Math.cos(sa) * step, c[1] + Math.sin(sa) * step, f]);
    one.push([c[0], c[1], c[0] + Math.cos(a0 + (rnd() - .5) * .8) * step, c[1] + Math.sin(a0 + (rnd() - .5) * .8) * step, o]);
    crowd.push([c[0], c[1], c[0] + Math.cos(sa) * step, c[1] + Math.sin(sa) * step, cr]);
  }
  for (let w = 0; w < 3; w++) { time(20000, i => far[i & 63]); time(20000, i => one[i & 63]); time(20000, i => crowd[i & 63]); time(20000, i => one[i & 63], wallNo); }      // warm up (JIT)
  const N = 200000, bf = time(N, i => far[i & 63]), bo = time(N, i => one[i & 63]), bc = time(N, i => crowd[i & 63]), bw = time(N, i => one[i & 63], wallNo);
  const kinds = { far: [], one: [], crowd: [], worst: [] }; for (const [k, arr] of Object.entries({ far, one, crowd })) for (const a of arr) kinds[k].push(P.resolve(a[0], a[1], a[2], a[3], a[4], D).how);
  for (const a of one) { wc = 0; kinds.worst.push(P.resolve(a[0], a[1], a[2], a[3], a[4], D, wallNo).how); }
  const count = l => l.reduce((m, h) => (m[h] = (m[h] || 0) + 1, m), {});
  res.bench = { callsPerRegime: N, sevenPeers: true, far: Object.assign(bf, { how: count(kinds.far) }), intoOne: Object.assign(bo, { how: count(kinds.one) }), crowdOfSeven: Object.assign(bc, { how: count(kinds.crowd) }),
    slideRefusedBisection: Object.assign(bw, { how: count(kinds.worst), note: 'the wall check is a stub here: its own cost (sim.moveOk) is the walls\' and was paid per packet before HQ2' }), node: process.version };
  check('B the peer sweep costs <= 5 us per packet with seven peers at p99, in every regime (far, into one, a crowd of seven, the slide refused and the bisection)', Math.max(bf.p99ns, bo.p99ns, bc.p99ns, bw.p99ns) <= 5000, { far: bf.p99ns, intoOne: bo.p99ns, crowd: bc.p99ns, bisection: bw.p99ns });
}

res.ok = res.checks.every(c => c.ok) && !res.fails.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
for (const c of res.checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + '  ' + JSON.stringify(c.info).slice(0, 260));
if (res.fails.length) console.log('first failures:', JSON.stringify(res.fails.slice(0, 3)).slice(0, 800));
process.exit(res.ok ? 0 : 1);
