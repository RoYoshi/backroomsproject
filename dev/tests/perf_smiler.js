/* PART 2 / 2D performance of the canon Smiler.  Measures the server simulation step (AI + glue): average, p99 and worst, per 1/60 s step.
 *   (a) standard  - the shipped population (3 hounds, 5 smilers, 4 players, two of them with a light), smilers kept near the players
 *   (b) worst-case smiler population - 10 smilers (twice the cap of 5), 8 players with visible lights, each one in front of a smiler and
 *       facing it (eye contact, attention, agitation, target choice all running), blackout on so every smiler is out and working
 *   (c) evidence contention - the same 10 smilers packed round one spot, all 8 lit players there too with beams sweeping and snapping on and
 *       off: every smiler sees every beam and every person (light observations, leads, attention maps, multiplayer scoring at their worst)
 *   node dev/tests/perf_smiler.js        GAMEDIR=/path/to/other/build node dev/tests/perf_smiler.js   (the same load on another build)
 * Guardrails (Stage 2B budget, 16.7 ms frame): (a) avg < 0.5 ms; (b) and (c) avg < 1.5 ms, p99 < 4 ms.  Exit code 1 if exceeded. */
'use strict';
const path = require('path');
const GAME = process.env.GAMEDIR || require('../paths.js');
const createSim = require(path.join(GAME, 'sim.js'));
const KINDS = ['flashlight', 'flashlight', 'headlamp', 'lantern', 'flashlight', 'headlamp', 'flashlight', 'lantern'];

function run(mode, seed, secs = 60, warm = 4) {
  const sim = createSim({ seed, director: false }); let r = seed * 7919 + 13; const R = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const nP = mode === 'standard' ? 4 : 8, nS = mode === 'standard' ? 5 : 10, nH = mode === 'standard' ? 3 : 0;
  const ps = []; for (let i = 0; i < nP; i++) { const p = sim.addPlayer(100 + i); sim.join(p, 1000); p.safe = 0; ps.push(p); }
  sim.engine.clear();                                                         // (joining populates the level: start from exactly the population under test)
  for (let k = 0; k < nH; k++) sim.admin.addHound(); for (let k = 0; k < nS; k++) if (!sim.admin.addSmiler()) { const q = ps[k % nP]; sim.engine.spawn('smiler', q.x + 900, q.y); }   // past the cap of 5: spawned directly (then placed below)
  sim.admin.blackout(mode === 'standard' ? 'off' : 'on');
  const eng = sim.engine, sms = () => eng.entities.filter(e => e.kind === 'smiler');
  const freeNear = (x, y, lo, hi) => { for (let t = 0; t < 80; t++) { const a = R() * 6.283, d = lo + R() * (hi - lo), X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d; if (sim.clearAt(X, Y, 26)) return { x: X, y: Y }; } return null; };
  const place = () => {
    const S = sms();
    if (mode === 'contention') {                                               // everybody round the first player
      const c = ps[0]; for (const e of S) { const q = freeNear(c.x, c.y, 200, 520); if (q) { e.x = q.x; e.y = q.y; e.path = []; } }
      for (const p of ps.slice(1)) { const q = freeNear(c.x, c.y, 60, 360); if (q) { p.x = q.x; p.y = q.y; } }
    } else ps.forEach((p, i) => { const e = S[i % S.length]; if (!e) return; const q = freeNear(p.x, p.y, 280, 560); if (q) { e.x = q.x; e.y = q.y; e.path = []; } });
  };
  const T = []; const dt = 1 / 60; let cap = 0;
  for (let k = 0; k < (secs + warm) * 60; k++) {
    if (k % (60 * 8) === 0) place();
    const S = sms();
    for (const [i, p] of ps.entries()) {
      if (p.exited || !p.active) { p.exited = false; sim.join(p, 2000 + k); p.safe = 0; } else if (p.dead) { sim.respawn(p); p.safe = 0; }
      p.equipment.kind = KINDS[i];
      p.light = mode === 'standard' ? i < 2 : !(k % 240 < 20 && i % 3 === 0);   // lights snapping off and on again: fresh light
      let tgt = null, bd = 1e9; for (const e of S) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tgt = e; } }
      const base = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : 0;
      p.angle = mode === 'worst' ? base : base + Math.sin(k / 23 + p.id) * .7;  // worst: eyes on it; otherwise beams sweeping round it
      const mv = mode === 'worst' ? (k % 300 < 150 ? -40 : 0) : 90, dir = mode === 'worst' ? base : p.angle + 1.2;
      const nx = p.x + Math.cos(dir) * mv * dt, ny = p.y + Math.sin(dir) * mv * dt;
      if (mv && sim.clearAt(nx, ny, 22)) { p.vx = Math.cos(dir) * mv; p.vy = Math.sin(dir) * mv; p.x = nx; p.y = ny; p.st = mode === 'worst' ? 3 : 1; p.sp = Math.abs(mv); } else { p.vx = p.vy = 0; p.st = 0; p.sp = 0; }
    }
    const t0 = process.hrtime.bigint(); sim.step(dt); const t1 = process.hrtime.bigint();
    if (k >= warm * 60) { T.push(Number(t1 - t0) / 1e6); if (k % 30 === 0) cap += S.filter(e => e.tier === 'near' && e.state !== 'HIDDEN').length; }
  }
  T.sort((a, b) => a - b);
  const avg = T.reduce((a, b) => a + b, 0) / T.length;
  return { mode, seed, avg, p99: T[Math.floor(T.length * .99)], max: T[T.length - 1], active: +(cap / (secs * 2)).toFixed(1), n: sms().length };
}
let ok = true;
for (const [mode, lim] of [['standard', { avg: .5, p99: 4 }], ['worst', { avg: 1.5, p99: 4 }], ['contention', { avg: 1.5, p99: 4 }]]) {
  const out = [1, 2, 3].map(s => run(mode, s));
  for (const o of out) console.log(`${mode.padEnd(10)} seed ${o.seed}: ${o.n} smilers (at the end; avg ${o.active} out and working)  step avg ${o.avg.toFixed(3)} ms  p99 ${o.p99.toFixed(3)} ms  max ${o.max.toFixed(2)} ms`);
  const A = out.reduce((a, o) => a + o.avg, 0) / out.length, P = Math.max(...out.map(o => o.p99)), good = A < lim.avg && P < lim.p99; ok = ok && good;
  console.log(`${good ? 'PASS' : 'FAIL'} ${mode}: average ${A.toFixed(3)} ms (limit ${lim.avg}), worst p99 ${P.toFixed(3)} ms (limit ${lim.p99})`);
}
process.exitCode = ok ? 0 : 1;
