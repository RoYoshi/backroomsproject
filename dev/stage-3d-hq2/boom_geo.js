/* Stage 3D HQ2 - NEW RUN blasts all over Level 0: world-valid, finite, at rest (development only)
 *
 *   node dev/stage-3d-hq2/boom_geo.js --game DIR [--n 400] [--out FILE.json]
 *
 * The server's own run of a blast (death_srv.boomBegin, the real level) from N places: half on open floor, half hugging a wall (a
 * player can press NEW RUN with its back to one), every facing, every light kind and hat, seeds and directions from dphys.boomPlan.
 * Each run goes to its end (dphys.finish, as the corpse is made) and is checked:
 *   G1 every number of the corpse record is finite
 *   G2 the blood (the four bursts) lies on floor the player could stand on - never inside a wall, a pillar or a prop
 *   G3 the body, both hands, the light and the hat came to rest out of every wall (the body's circle within 4 px of its 18 px radius)
 *   G4 at rest: the physics sleeps before the corpse is made (the blast's 2.6 s)
 *   G5 wall marks only where the body struck a wall face with clear floor in front (dphys.marks' own rule), at most three
 *   G6 the light: released at the blast (headlamps never held: 0)
 * Reported: how far bodies fly, how many blasts strike a wall, the cost per blast. Exit 0 only if every check holds for every run. */
'use strict';
const path = require('path'), fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const G = path.resolve(ARG.game || '.'), D = require(path.join(G, 'death_srv.js')), sim = require(path.join(G, 'sim.js'))({ seed: 9 }), N = +(ARG.n || 400);
const solid = (x, y) => sim.blockersAt(x, y).some(q => x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);
const kinds = ['flashlight', 'lantern', 'headlamp', 'camcorder'], hats = ['none', 'cap', 'beanie', 'hardhat'];
const places = [];
let rs = 12345; const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
while (places.length < N / 2) { const x = 300 + rnd() * 8600, y = 300 + rnd() * 6300; if (sim.clearAt(x, y, 30)) places.push({ x, y, wall: false }); }
while (places.length < N) {                                                      // hugging a wall: 16-24 px from one (the player's own radius is 15)
  const x = 300 + rnd() * 8600, y = 300 + rnd() * 6300; if (!sim.clearAt(x, y, 15) || sim.clearAt(x, y, 25)) continue; places.push({ x, y, wall: true });
}
const res = { tool: 'dev/stage-3d-hq2/boom_geo.js', game: G, runs: 0, fails: [], flight: [], wallStruck: 0, marks: 0, ms: 0 };
const bad = (i, what, info) => { if (res.fails.length < 30) res.fails.push({ i, what, info }); };
const t0 = process.hrtime.bigint();
places.forEach((p, i) => {
  const pl = D.DP.boomPlan(1 + (i % 5), 1 + i), info = { look: hats[i % 4] + '|plain|#e6bb76|#ffcc77|none', ek: kinds[i % 4], vx: 0, vy: 0, light: true };
  const B = { k: 'Boom', x: Math.round(p.x), y: Math.round(p.y), a: +(i * .7 % 6.28).toFixed(3), d: pl.d, s: pl.s };
  const R = D.boomBegin(B, info, sim), F = D.DP.finish(R), c = D.corpse(i, B, info, R).body, S = F.S; res.runs++;
  const nums = [c.x, c.y, c.a, c.sx, c.sy, ...c.dr, ...c.ht, ...c.hd, ...c.bl.flat(), ...(c.tr || []).flat()];
  if (!nums.every(Number.isFinite)) bad(i, 'G1 a number is not finite', c);
  for (const q of S.ev.filter(e => e.k === 'hit')) if (solid(q.x, q.y) || !sim.clearAt(q.x, q.y, 1)) bad(i, 'G2 blood inside a solid', [q.x, q.y]);
  if (!sim.clearAt(S.b.x, S.b.y, 14)) bad(i, 'G3 the body rests in a wall', [S.b.x, S.b.y]);
  for (const h of S.h) if (solid(h.x, h.y)) bad(i, 'G3 a hand rests in a wall', [h.x, h.y]);
  if (S.eq.has && solid(S.eq.x, S.eq.y)) bad(i, 'G3 the light rests in a wall', [S.eq.x, S.eq.y]);
  if (S.hat.has && solid(S.hat.x, S.hat.y)) bad(i, 'G3 the hat rests in a wall', [S.hat.x, S.hat.y]);
  if (S.state !== 'SLEEPING' || !(S.sleepAt <= F.dur)) bad(i, 'G4 not at rest when the corpse is made', { state: S.state, sleepAt: S.sleepAt });
  const mk = D.DP.marks(S); res.marks += mk.length; if (mk.length > 3) bad(i, 'G5 more than three wall marks', mk.length);
  for (const m of mk) if (solid(m.x + m.nx * 4, m.y + m.ny * 4)) bad(i, 'G5 a wall mark with no floor in front', m);
  if (S.ev.some(e => e.k === 'wall' && e.sp > 80)) res.wallStruck++;
  const rel = D.DP.releaseOf(S); if (info.ek === 'headlamp' ? rel !== 0 : rel !== 0) bad(i, 'G6 the light is not released at the blast', rel);
  res.flight.push(Math.round(Math.hypot(S.b.x - p.x, S.b.y - p.y)));
});
res.ms = +(Number(process.hrtime.bigint() - t0) / 1e6 / res.runs).toFixed(2);
const fl = res.flight.slice().sort((a, b) => a - b);
res.summary = { runs: res.runs, onOpenFloor: N / 2, huggingAWall: N / 2, failures: res.fails.length, bodyFlightPx: { min: fl[0], median: fl[fl.length >> 1], max: fl[fl.length - 1] }, wallStruck: res.wallStruck, wallMarks: res.marks, msPerBlast: res.ms };
delete res.flight;
res.ok = res.runs === N && !res.fails.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(res.summary), res.fails.slice(0, 5));
process.exit(res.ok ? 0 : 1);
