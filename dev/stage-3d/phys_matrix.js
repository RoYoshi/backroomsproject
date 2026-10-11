/* Stage 3D - the death physics on the real Level 0 geometry, numerically (development only; no browser).
 *
 *   node dev/stage-3d/phys_matrix.js [--game DIR] [--out FILE.json] [--seeds 6]
 *
 * dphys.js and the level's collision (sim.js blockersAt / clearAt, the same rects the game bundle's Bc gives the client) are loaded from
 * GAME.  Spots of each kind are found on the real map: an open hall, a corridor, a corner, beside a pillar, in front of a wall (the hound's
 * wall slam), near a low obstacle.  At each spot every variant (Hound A-D, Smiler A-D) is run the way death_srv.js runs it (dphys.simulate:
 * the same knock / drag limits and seed rule as the victim's browser), from several attacker sides, each sampled at 30, 60, 120 and 240 Hz.
 *
 * Measured per run (every internal 240 Hz step is inspected through a wrapped walls function and the state after each sample):
 *   finite         no NaN / Infinity anywhere in the state
 *   samplingSame   the end state is identical whatever the sample rate (the 240 Hz integrator is the truth)
 *   bodyPen        deepest overlap of the body circle (r 18) with a blocking rect, in px, over the whole death
 *   handPen        the same for the hands (r 5); gearPen for the dropped light (r 7) and the hat (r 11); attPen for the attacker
 *   crossed        the body's centre moved through a blocking rect between two steps (tunnelling)
 *   maxStep        the largest body move in one 240 Hz step (px)
 *   sleepT         when the death reached SLEEPING (s), or null; moveAfterSleep: how far anything moved once asleep
 *   restAfterDur   whether the body, hands, light and hat were all at rest at the end of the death
 *   end            body x / y / angle, displacement from the victim's spot, light and hat distance from the body
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ARG = { game: path.resolve(__dirname, '..', '..'), seeds: '6' };
for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const G = path.resolve(ARG.game);
const box = { window: {}, console, Math }; vm.runInNewContext(fs.readFileSync(path.join(G, 'dphys.js'), 'utf8'), box, { filename: 'dphys.js' });
const DP = box.window.__dphys;
const sim = require(path.join(G, 'sim.js'))({ seed: 1 });
const hyp = Math.hypot, TAU = Math.PI * 2;
const clear = (x, y, r) => sim.clearAt(x, y, r);
const ray = (x, y, a, max) => { let d = 0; while (d < max && clear(x + Math.cos(a) * d, y + Math.sin(a) * d, .5)) d += 2; return d; };

/* ---- spots on the real map ---- */
function findSpots() {
  const want = { open: 3, corridor: 3, corner: 3, pillar: 2, wall: 3, low: 2 }, got = {}; for (const k in want) got[k] = [];
  const LOW = require(path.join(G, 'world.js')).LOW;
  for (let y = 240; y < 6700; y += 72) for (let x = 240; x < 9000; x += 72) {
    if (!clear(x, y, 26)) continue;
    const r8 = []; for (let k = 0; k < 16; k++) r8.push(ray(x, y, k / 16 * TAU, 300));
    const minR = Math.min(...r8);
    const far = (got.open.concat(got.corridor, got.corner, got.pillar, got.wall, got.low)).every(s => hyp(s.x - x, s.y - y) > 600);
    if (!far) continue;
    if (got.open.length < want.open && minR >= 220) { got.open.push({ x, y, kind: 'open', face: 0 }); continue; }
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU, d = r8[k], back = r8[(k + 8) % 16], l = r8[(k + 4) % 16], rr = r8[(k + 12) % 16];
      if (got.corridor.length < want.corridor && l + rr > 90 && l + rr < 160 && d > 250 && back > 250) { got.corridor.push({ x, y, kind: 'corridor', face: a }); break; }
      if (got.wall.length < want.wall && d > 72 && d < 108 && r8[(k + 1) % 16] > 60 && r8[(k + 15) % 16] > 60 && back > 150 && l > 120 && rr > 120) { got.wall.push({ x, y, kind: 'wall', face: a + Math.PI, wallA: a }); break; }
      if (got.corner.length < want.corner && d > 50 && d < 110 && l > 50 && l < 110 && back > 150 && rr > 150) { got.corner.push({ x, y, kind: 'corner', face: a + Math.PI * 1.25 }); break; }
    }
  }
  // beside a pillar: the pillar hall's square pillars (sim's Pc) - a spot 40-70 px from one, open on the far side
  for (let px = 79.5; px <= 89.5; px += 5) for (let py = 9.5; py <= 19.5; py += 5) {
    if (got.pillar.length >= want.pillar) break; const cx = px * 96, cy = py * 96;
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const x = cx + Math.cos(a) * 80, y = cy + Math.sin(a) * 80; if (clear(x, y, 26) && ray(x, y, a, 300) > 200) { got.pillar.push({ x, y, kind: 'pillar', face: a + Math.PI }); break; } }
  }
  for (const p of LOW) {                                                             // in front of a low obstacle (a vaultable one)
    if (got.low.length >= want.low) break; const r = p.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2, ax = p.cross === 'x';
    for (const s of [-1, 1]) { const x = cx + (ax ? s * (r.w / 2 + 60) : 0), y = cy + (ax ? 0 : s * (r.h / 2 + 60)); if (clear(x, y, 26)) { got.low.push({ x, y, kind: 'low', face: ax ? (s > 0 ? Math.PI : 0) : (s > 0 ? -Math.PI / 2 : Math.PI / 2) }); break; } }
  }
  return Object.values(got).flat();
}

/* ---- overlap of a circle with the blocking rects near it ---- */
function pen(x, y, r) {
  let worst = 0;
  for (const q of sim.blockersAt(x, y)) { const cx = Math.max(q.x, Math.min(x, q.x + q.w)), cy = Math.max(q.y, Math.min(y, q.y + q.h)), d = hyp(x - cx, y - cy);
    const inside = x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h; const p = inside ? r + Math.min(x - q.x, q.x + q.w - x, y - q.y, q.y + q.h - y) : r - d; if (p > worst) worst = p; }
  return worst;
}
const inside = (x, y) => sim.blockersAt(x, y).some(q => x > q.x + .5 && x < q.x + q.w - .5 && y > q.y + .5 && y < q.y + q.h - .5);
const finite = o => { for (const k in o) { const v = o[k]; if (typeof v === 'number' && !Number.isFinite(v)) return false; } return true; };

const keyOf = S => JSON.stringify([S.stepN, S.b.x, S.b.y, S.b.th, S.h.map(h => [h.x, h.y]), S.eq.x, S.eq.y, S.eq.rot, S.hat.x, S.hat.y, S.at.x, S.at.y]);
function run(spot, kind, v, side, seedOff, hz) {
  const ang = (kind === 'Hound' && v === 'C' ? spot.wallA + side * .3 : spot.face + side), src = { x: spot.x - Math.cos(ang) * 46, y: spot.y - Math.sin(ang) * 46 };
  let wHit = 0;
  if (kind === 'Hound' && v === 'C') { const d = ray(spot.x, spot.y, ang, 200); wHit = d < 200 ? [Math.round(spot.x + Math.cos(ang) * d), Math.round(spot.y + Math.sin(ang) * d), +ang.toFixed(3)] : 0; }
  const o = { kind, v, w: wHit, victim: { x: spot.x, y: spot.y, angle: spot.face - Math.PI / 2 + seedOff * .37 }, src, vx: 0, vy: 0, exhausted: v === 'D' && kind === 'Hound', eqKind: 'flashlight', hat: 'cap',
    walls: (x, y) => sim.blockersAt(x, y), clear: (x, y, r) => clear(x, y, r) };
  // the same setup as dphys.simulate, but sampled at hz and inspected after every sample
  const P = DP.PLAN(kind, v, wHit ? hyp(wHit[0] - spot.x, wHit[1] - spot.y) : 40), a0 = Math.atan2(spot.y - src.y, spot.x - src.x);
  const safe = (p, a, n) => { let r = 0; for (let i = 4; i <= n && clear(p.x + Math.cos(a) * i, p.y + Math.sin(a) * i, 22); i += 4) r = i; return r; };
  const knock = safe(o.victim, a0, P.kn), i0 = { x: spot.x + Math.cos(a0) * knock, y: spot.y + Math.sin(a0) * knock }, drag = safe(i0, a0 + Math.PI, P.dr);
  const dur = DP.DURS[kind][v];
  const S = DP.create({ kind, v, victim: o.victim, src, dir: a0, hits: P.hits || [.24, .74, 1.2, 1.7], kn: knock, drag, seed: (12345 + seedOff * 7919) >>> 0, exhausted: o.exhausted, eqKind: 'flashlight', hat: 'cap', walls: o.walls, dur });
  const M = { bodyPen: 0, handPen: 0, gearPen: 0, attPen: 0, crossed: 0, maxStep: 0, finite: true, sleepT: null, moveAfterSleep: 0 };
  let prev = [S.b.x, S.b.y], asleep = null;
  const N = Math.ceil((dur + .6) * hz), nDur = Math.floor(dur * hz + 1e-9); let endKey = null;
  for (let i = 1; i <= N; i++) {
    const t = i / hz; const before = S.stepN;
    if (i === nDur + 1 && endKey == null) { DP.advance(S, dur); endKey = keyOf(S); }     // the end of the death, the same instant at every sample rate
    DP.advance(S, t);
    const b = S.b; if (!finite(b) || !finite(S.at) || S.h.some(h => !finite(h)) || !finite(S.eq) || !finite(S.hat)) M.finite = false;
    const st = hyp(b.x - prev[0], b.y - prev[1]) / Math.max(1, S.stepN - before); if (st > M.maxStep) M.maxStep = st;
    // crossing: sample the segment
    const segN = Math.ceil(hyp(b.x - prev[0], b.y - prev[1]) / 3); for (let k = 1; k < segN; k++) { if (inside(prev[0] + (b.x - prev[0]) * k / segN, prev[1] + (b.y - prev[1]) * k / segN)) { M.crossed++; break; } }
    prev = [b.x, b.y];
    M.bodyPen = Math.max(M.bodyPen, pen(b.x, b.y, 18)); for (const h of S.h) M.handPen = Math.max(M.handPen, pen(h.x, h.y, 5));
    if (S.eq.has && !S.eq.held) M.gearPen = Math.max(M.gearPen, pen(S.eq.x, S.eq.y, 7)); if (S.hat.has && !S.hat.on) M.gearPen = Math.max(M.gearPen, pen(S.hat.x, S.hat.y, 11));
    M.attPen = Math.max(M.attPen, pen(S.at.x, S.at.y, kind === 'Hound' ? 18 : 14));
    if (S.state === 'SLEEPING' && !asleep) { asleep = { t, b: [b.x, b.y, b.th], h: S.h.map(h => [h.x, h.y]), e: [S.eq.x, S.eq.y], ht: [S.hat.x, S.hat.y] }; M.sleepT = +t.toFixed(3); }
    if (asleep) M.moveAfterSleep = Math.max(M.moveAfterSleep, hyp(b.x - asleep.b[0], b.y - asleep.b[1]), ...S.h.map((h, k) => hyp(h.x - asleep.h[k][0], h.y - asleep.h[k][1])), hyp(S.eq.x - asleep.e[0], S.eq.y - asleep.e[1]), hyp(S.hat.x - asleep.ht[0], S.hat.y - asleep.ht[1]));
    if (Math.abs(t - dur) < .5 / hz) M.restAfterDur = S.state === 'SLEEPING' || (hyp(b.vx, b.vy) < 6 && Math.abs(b.om) < .25 && (!S.eq.has || S.eq.held || S.eq.st === 'SLEEPING') && (!S.hat.has || S.hat.on || S.hat.st === 'SLEEPING'));
  }
  if (endKey == null) { DP.advance(S, dur); endKey = keyOf(S); }
  const b = S.b, r3 = x => Math.round(x * 1000) / 1000;
  M.end = { x: r3(b.x), y: r3(b.y), th: r3(b.th), disp: Math.round(hyp(b.x - spot.x, b.y - spot.y)), eqD: Math.round(hyp(S.eq.x - b.x, S.eq.y - b.y)), hatD: S.hat.on ? 0 : Math.round(hyp(S.hat.x - b.x, S.hat.y - b.y)),
    hands: S.h.map(h => [r3(h.x - b.x), r3(h.y - b.y)]), events: S.ev.length, wall: !!S.wallHit, state: S.state };
  M.endKey = endKey;
  return M;
}

const spots = findSpots(), rows = [], seeds = +ARG.seeds;
for (const spot of spots) for (const kind of ['Hound', 'Smiler']) for (const v of 'ABCD') {
  if (kind === 'Hound' && v === 'C' && spot.kind !== 'wall') continue;      // the wall slam needs a wall behind the victim: it is driven into it
  for (let s = 0; s < seeds; s++) {
    const side = [0, .6, -.6, Math.PI, 1.3, -1.3][s % 6];
    const R = {}; for (const hz of [30, 60, 120, 240]) R[hz] = run(spot, kind, v, side, s, hz);
    const keys = new Set(Object.values(R).map(r => r.endKey));
    const m = R[60];
    rows.push({ spot: spot.kind, at: [spot.x, spot.y], kind, v, seed: s, samplingSame: keys.size === 1, finite: Object.values(R).every(r => r.finite),
      bodyPen: +m.bodyPen.toFixed(2), handPen: +m.handPen.toFixed(2), gearPen: +m.gearPen.toFixed(2), attPen: +m.attPen.toFixed(2), crossed: m.crossed, maxStep: +m.maxStep.toFixed(2),
      sleepT: m.sleepT, moveAfterSleep: +m.moveAfterSleep.toFixed(3), restAfterDur: !!m.restAfterDur, end: m.end });
  }
}
const agg = (f, k) => rows.filter(f).reduce((a, r) => Math.max(a, r[k]), 0);
const byVar = {};
for (const kind of ['Hound', 'Smiler']) for (const v of 'ABCD') {
  const rs = rows.filter(r => r.kind === kind && r.v === v), q = k => rs.map(r => r[k]);
  const sl = rs.map(r => r.sleepT).filter(x => x != null).sort((a, b) => a - b);
  byVar[kind + ' ' + v] = { runs: rs.length, samplingSame: rs.every(r => r.samplingSame), finite: rs.every(r => r.finite), maxBodyPen: Math.max(...q('bodyPen')), maxHandPen: Math.max(...q('handPen')),
    maxGearPen: Math.max(...q('gearPen')), maxAttPen: Math.max(...q('attPen')), crossed: rs.filter(r => r.crossed).length, maxStep: Math.max(...q('maxStep')),
    asleepByEnd: rs.filter(r => r.restAfterDur).length, sleepMedian: sl.length ? sl[sl.length >> 1] : null, neverSlept: rs.filter(r => r.sleepT == null).length,
    moveAfterSleep: Math.max(...q('moveAfterSleep')), dispMedian: rs.map(r => r.end.disp).sort((a, b) => a - b)[rs.length >> 1], wallHits: rs.filter(r => r.end.wall).length };
}
const out = { tool: 'dev/stage-3d/phys_matrix.js', game: G, spots: spots.map(s => ({ kind: s.kind, x: s.x, y: s.y })), runs: rows.length, byVariant: byVar, rows };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
console.log('spots', spots.map(s => s.kind).join(' '), '; runs', rows.length);
console.log('variant      runs  same  fin  bodyPen handPen gearPen attPen crossed maxStep asleepByEnd sleepMed never afterSleep dispMed walls');
for (const [k, s] of Object.entries(byVar)) console.log(k.padEnd(11), String(s.runs).padStart(5), String(s.samplingSame).padStart(5), String(s.finite).padStart(5), String(s.maxBodyPen.toFixed(1)).padStart(7), String(s.maxHandPen.toFixed(1)).padStart(7), String(s.maxGearPen.toFixed(1)).padStart(7), String(s.maxAttPen.toFixed(1)).padStart(6), String(s.crossed).padStart(7), String(s.maxStep.toFixed(2)).padStart(7), String(s.asleepByEnd).padStart(11), String(s.sleepMedian).padStart(8), String(s.neverSlept).padStart(5), String(s.moveAfterSleep.toFixed(2)).padStart(10), String(s.dispMedian).padStart(7), String(s.wallHits).padStart(5));
