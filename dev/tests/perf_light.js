/* PART 2 / 2C worst case for the new light evidence: every supported player (8) carrying a VISIBLE light (torches, headlamps, lanterns),
 * all of them around the monsters so every entity is in the near tier, beams sweeping and switching on and off (fresh / moving light), for
 * the whole run.  Measures the server simulation step (AI + glue) - average, p99 and worst - and the monster snapshot size.
 *   node dev/tests/perf_light.js            (this build)       GAMEDIR=/path/to/other/build node dev/tests/perf_light.js   (compare)
 * Guardrails (Stage 2B): average < 0.25 ms, p99 < 2 ms per 1/60 s step in this case.  Exit code 1 if exceeded. */
'use strict';
const path = require('path');
const GAME = process.env.GAMEDIR || require('../paths.js');
const createSim = require(path.join(GAME, 'sim.js'));
const KINDS = ['flashlight', 'flashlight', 'headlamp', 'lantern', 'flashlight', 'headlamp', 'flashlight', 'lantern'];

function run(seed, secs = 90, warm = 5) {
  const sim = createSim({ seed }); let r = seed * 7919 + 13; const R = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const ps = []; for (let i = 0; i < 8; i++) { const p = sim.addPlayer(100 + i); sim.join(p, 1000); ps.push(p); }
  for (let k = 0; k < 4; k++) sim.admin.addHound(); for (let k = 0; k < 6; k++) sim.admin.addSmiler();
  sim.admin.blackout('off');
  const place = () => {                                                       // every player a few hundred px from some monster, in the open
    const E = sim.entities(), all = [...E.h, ...E.m];
    ps.forEach((p, i) => { const e = all[i % all.length]; for (let t = 0; t < 60; t++) { const a = R() * 6.283, d = 260 + R() * 520, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d; if (sim.clearAt(x, y, 24)) { p.x = x; p.y = y; p.aim = e; break; } } });
  };
  const T = []; let snapB = 0, snaps = 0, near = 0, nearN = 0; const dt = 1 / 60;
  for (let k = 0; k < (secs + warm) * 60; k++) {
    if (k % (60 * 6) === 0) place();
    for (const p of ps) {
      if (p.exited || !p.active) { p.exited = false; sim.join(p, 2000 + k); } else if (p.dead) sim.respawn(p);
      p.equipment.kind = KINDS[ps.indexOf(p)];
      p.light = !(k % 240 < 20 && ps.indexOf(p) % 3 === 0);                  // some lights snap off and on again: fresh light
      const E = sim.entities(), all = [...E.h, ...E.m]; let tgt = null, bd = 1e9; for (const e of all) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tgt = e; } }
      const base = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : 0; p.angle = base + Math.sin(k / 23 + p.id) * .7;   // sweeping round the monster
      const v = 110, nx = p.x + Math.cos(p.angle + 1.2) * v * dt, ny = p.y + Math.sin(p.angle + 1.2) * v * dt;
      if (sim.clearAt(nx, ny, 22)) { p.vx = Math.cos(p.angle + 1.2) * v; p.vy = Math.sin(p.angle + 1.2) * v; p.x = nx; p.y = ny; p.st = 1; p.sp = v; } else { p.vx = p.vy = 0; p.st = 0; p.sp = 0; }
    }
    const t0 = process.hrtime.bigint(); sim.step(dt); const t1 = process.hrtime.bigint();
    if (k >= warm * 60) {
      T.push(Number(t1 - t0) / 1e6);
      if (k % 3 === 0) { snapB += JSON.stringify(sim.entities()).length; snaps++; }
      if (k % 30 === 0) { const eng = sim.engine; near += eng.entities.filter(e => e.tier === 'near').length; nearN++; }
    }
  }
  T.sort((a, b) => a - b);
  const avg = T.reduce((a, b) => a + b, 0) / T.length, p99 = T[Math.floor(T.length * .99)], max = T[T.length - 1];
  const eng = sim.engine, leads = eng.entities.reduce((n, e) => n + (e.mem && e.mem.leads ? e.mem.leads.length : 0), 0);
  return { seed, avg, p99, max, snap: Math.round(snapB / snaps), near: +(near / nearN).toFixed(1), ents: eng.entities.length, leads };
}
const out = [1, 2, 3].map(s => run(s));
for (const o of out) console.log(`seed ${o.seed}: 8 lit players, ${o.ents} monsters (avg ${o.near} in the near tier)  step avg ${o.avg.toFixed(3)} ms  p99 ${o.p99.toFixed(3)} ms  max ${o.max.toFixed(2)} ms  snapshot ${o.snap} B  (leads held at the end: ${o.leads})`);
const A = out.reduce((a, o) => a + o.avg, 0) / out.length, P = Math.max(...out.map(o => o.p99));
const ok = A < .25 && P < 2;
console.log(`${ok ? 'PASS' : 'FAIL'} worst-case light load: average ${A.toFixed(3)} ms (limit 0.25), worst p99 ${P.toFixed(3)} ms (limit 2)`);
process.exitCode = ok ? 0 : 1;
