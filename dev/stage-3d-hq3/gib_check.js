/* Stage 3D HQ3 - the NEW RUN gibs, without a screen: valid, bounded, at rest, and the same at any frame rate (development only)
 *
 *   node dev/stage-3d-hq3/gib_check.js --game DIR [--n 120] [--out FILE.json]
 *
 * The server's own run of N blasts (death_srv.boomBegin on the real level, as server.js does: half on open floor, half hugging a wall,
 * every facing, light kind and hat, seeds and directions from dphys.boomPlan), each to its corpse (death_srv.corpse), checked:
 *   G1 the torso is gone: 5-8 pieces in the record (gb) with the breakup's seed (gs), both hands loose (gh); every number finite;
 *      a record of at most 700 bytes
 *   G2 every piece and both hands rest out of every wall and prop (the centre clear by its collision radius less 2 px)
 *   G3 at rest before the corpse is made (asleep before the blast's 3.2 s), and nothing moves after
 *   G4 the blood: at most 5 pools, each on floor a player could stand on; at most 3 wall marks, each on a face with floor in front
 *   G5 the outlines: gibShapes(gs) rebuilds the same pieces (count, sizes) on every call; at the blast the pieces tile the round body
 *      (every outline point within the body's radius + 1 px of its centre)
 *   G6 one light, one hat: the light is released at the blast (a headlamp rides the biggest piece); no light per piece
 *   F  frame-rate independence: 3 of the blasts (fixed seeds) advanced as a page at 30 FPS, at 144 FPS and on a jittered busy page end
 *      in exactly the server's record (gb, gh, the blood, the light)
 * Reported: how far pieces fly, how many strike a wall, the cost per blast.  Exit 0 only if every check holds for every run. */
'use strict';
const path = require('path'), fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const G = path.resolve(ARG.game || '.'), D = require(path.join(G, 'death_srv.js')), sim = require(path.join(G, 'sim.js'))({ seed: 9 }), N = +(ARG.n || 120), DP = D.DP;
const solid = (x, y) => sim.blockersAt(x, y).some(q => x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);
const kinds = ['flashlight', 'lantern', 'headlamp', 'camcorder'], hats = ['none', 'cap', 'beanie', 'hardhat'];
let rs = 4242; const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
const places = [];
while (places.length < N / 2) { const x = 300 + rnd() * 8600, y = 300 + rnd() * 6300; if (sim.clearAt(x, y, 30)) places.push({ x, y, wall: false }); }
while (places.length < N) { const x = 300 + rnd() * 8600, y = 300 + rnd() * 6300; if (!sim.clearAt(x, y, 15) || sim.clearAt(x, y, 25)) continue; places.push({ x, y, wall: true }); }
const res = { tool: 'dev/stage-3d-hq3/gib_check.js', game: G, runs: 0, fails: [], flight: [], pieces: {}, wallStruck: 0, marks: 0, bytes: [], ms: 0, frameRates: [] };
const bad = (i, what, info) => { if (res.fails.length < 40) res.fails.push({ i, what, info }); };
const fin = a => a.every(Number.isFinite);
const blasts = places.map((p, i) => {
  const pl = DP.boomPlan(1 + (i % 5), 1 + i), info = { name: 'W', look: hats[i % 4] + '|plain|#e6bb76|#ffcc77|none', ek: kinds[i % 4], ec: '#ffe7b2', ep: '', vx: 0, vy: 0, light: true };
  return { p, info, B: { k: 'Boom', x: Math.round(p.x), y: Math.round(p.y), a: +(i * .7 % 6.28).toFixed(3), d: pl.d, s: pl.s } };
});
const t0 = process.hrtime.bigint();
blasts.forEach(({ p, info, B }, i) => {
  const R = D.boomBegin(B, info, sim), c = D.corpse(i, B, info, R).body, S = R.S; res.runs++;
  // G1
  const n = (c.gb || []).length; res.pieces[n] = (res.pieces[n] || 0) + 1;
  if (!(n >= 5 && n <= 8) || !Number.isFinite(c.gs) || !Array.isArray(c.gh) || c.gh.length !== 4) bad(i, 'G1 not 5-8 pieces with a seed and two loose hands', { n, gs: c.gs, gh: c.gh });
  const nums = [c.x, c.y, c.a, ...c.dr, ...c.ht, ...c.bl.flat(), ...(c.gb || []).flat(), ...(c.gh || [])];
  if (!fin(nums)) bad(i, 'G1 a number is not finite', c);
  const bytes = JSON.stringify(c).length; res.bytes.push(bytes); if (bytes > 700) bad(i, 'G1 the record is over 700 bytes', bytes);
  // G2
  S.gib.forEach((g, k) => { if (solid(g.x, g.y) || !sim.clearAt(g.x, g.y, Math.max(1, g.r - 2))) bad(i, 'G2 a piece rests in a wall', { k, x: g.x, y: g.y, r: g.r }); });
  S.h.forEach((h, k) => { if (solid(h.x, h.y) || !sim.clearAt(h.x, h.y, 3)) bad(i, 'G2 a hand rests in a wall', { k, x: h.x, y: h.y }); });
  // G3
  if (S.state !== 'SLEEPING' || !(S.sleepAt <= DP.DURS.Boom.A)) bad(i, 'G3 not at rest when the corpse is made', { state: S.state, sleepAt: S.sleepAt });
  const before = JSON.stringify(DP.gibRecord(S)); DP.advance(S, S.t + 1); if (JSON.stringify(DP.gibRecord(S)) !== before) bad(i, 'G3 something moves after rest', {});
  // G4
  const pools = c.bl.filter(q => q[2] < 512), mk = DP.marks(S); res.marks += mk.length;
  if (pools.length > 5) bad(i, 'G4 more than 5 pools', pools.length);
  for (const q of pools) if (solid(q[0], q[1]) || !sim.clearAt(q[0], q[1], 1)) bad(i, 'G4 a pool inside a solid', q);
  if (mk.length > 3) bad(i, 'G4 more than three wall marks', mk.length);
  for (const m of mk) if (solid(m.x + m.nx * 4, m.y + m.ny * 4)) bad(i, 'G4 a wall mark with no floor in front', m);
  if (S.ev.some(e => e.k === 'wall')) res.wallStruck++;
  // G5
  const sh1 = DP.gibShapes(c.gs), sh2 = DP.gibShapes(c.gs);
  if (JSON.stringify(sh1) !== JSON.stringify(sh2) || sh1.length !== n) bad(i, 'G5 the outlines are not rebuilt the same', { n, shapes: sh1.length });
  for (const s of sh1) for (const q of s.poly) if (Math.hypot(q[0] + s.cx, q[1] + s.cy - 1) > 18 + 1) { bad(i, 'G5 an outline point outside the body', { q, cx: s.cx, cy: s.cy }); break; }
  // G6
  if (DP.releaseOf(S) !== 0) bad(i, 'G6 the light is not released at the blast', DP.releaseOf(S));
  if (info.ek === 'headlamp' && (c.dr[0] !== c.gb[0][0] || c.dr[1] !== c.gb[0][1])) bad(i, 'G6 the headlamp is not on the biggest piece', { dr: c.dr, g0: c.gb[0] });
  for (const g of S.gib) res.flight.push(Math.round(Math.hypot(g.x - B.x, g.y - B.y)));
});
res.ms = +(Number(process.hrtime.bigint() - t0) / 1e6 / res.runs).toFixed(2);
// F: the same blast advanced as a page would, at three frame rates
const DT = 1 / 240;
for (const k of [0, 1, N - 1]) {
  const { info, B } = blasts[k], ref = D.corpse(k, B, info, D.boomBegin(B, info, sim)).body;
  for (const [name, step] of [['30 FPS', () => 1 / 30], ['144 FPS', () => 1 / 144], ['jittered 20-200 FPS', (r => () => 1 / (20 + r() * 180))((() => { let s = 77; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })())]]) {
    const R = D.boomBegin(B, info, sim); let t = 0;
    while (t < R.dur) { t = Math.min(R.dur, t + step()); DP.advance(R.S, t); }
    const c = D.corpse(k, B, info, R).body, same = ['gs', 'gb', 'gh', 'bl', 'dr', 'ht', 'lf'].every(f => JSON.stringify(c[f]) === JSON.stringify(ref[f]));
    res.frameRates.push({ blast: k, schedule: name, same });
    if (!same) bad(k, 'F the record differs at ' + name, { gb: c.gb, ref: ref.gb });
  }
}
const fl = res.flight.slice().sort((a, b) => a - b), by = res.bytes.slice().sort((a, b) => a - b);
res.summary = { runs: res.runs, piecesPerBlast: res.pieces, failures: res.fails.length, pieceFlightPx: { min: fl[0], median: fl[fl.length >> 1], max: fl[fl.length - 1] }, blastsStrikingAWall: res.wallStruck, wallMarks: res.marks,
  recordBytes: { min: by[0], median: by[by.length >> 1], max: by[by.length - 1] }, msPerBlast: res.ms, frameRatesSame: res.frameRates.filter(f => f.same).length + '/' + res.frameRates.length };
delete res.flight; delete res.bytes;
res.ok = res.runs === N && !res.fails.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(res.summary), res.fails.slice(0, 5));
process.exit(res.ok ? 0 : 1);
