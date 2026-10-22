#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/perf_r16.js - R16: what perf_pr.js does not count (development only; checkpoint evidence, not a gate step).
 * Trial 3 and its refinements are not owner-approved.
 *
 *   node dev/trial-3-r9-overhaul/tools/perf_r16.js --base DIR [--rounds 3] [--secs 60] [--players 8] [--seed 7] [--out FILE.json]
 *
 * DIR is a tree of R8 (f378049).  Each run (its own process) is perf_pr.js's: that tree's sim with the director's Hounds and Smilers,
 * N Skin-Stealers added the admin's way, 8 scripted players wandering the level on seeded routes, 5 s of warm-up, then the timed stretch.
 * Configurations, interleaved round by round: one Skin-Stealer (1), four starving ones (4h: hunger .95 at the start, their worst case).
 * Counted besides the 60 Hz step's wall time (mean, p95, p99, worst):
 *   - the Skin-Stealers' own think: wall time inside the species' tick (AI.SKIN.tick, as PR25 wraps it), per second of game;
 *   - route searches: geo.path calls made inside that tick, per second, and their wall time (the expensive ones: over 1 ms, per second);
 *   - lines of sight: geo.los calls inside that tick, per second;
 *   - garbage collection during the stretch: count and total pause (node's perf_hooks 'gc' entries), and the heap's growth;
 *   - the snapshot's entity part (bytes, every 3rd step) - what the wire carries for them.  (There are no retransmissions to count in the
 *     sim: the game's wire is a WebSocket over TCP.) */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = { rounds: '3', secs: '60', players: '8', seed: '7' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const HERE = path.resolve(__dirname, '..', '..', '..');
const mkRng = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const med = a => q(a, .5);
const ms = t0 => Number(process.hrtime.bigint() - t0) / 1e6;
if (ARG.run) {
  const { PerformanceObserver, performance } = require('perf_hooks');
  const H = require(path.join(path.resolve(ARG.repo), 'dev', 'harness.js')), AI = require(path.join(path.resolve(ARG.repo), 'generated', 'server', 'ai.js'));
  const seed = +ARG.seed, ss = +ARG.ss | 0, starving = ARG.press === '2';
  const w = H.World(seed, { director: true }); w.sim.resetWorld();
  for (let k = 0; k < ss; k++) w.sim.admin.addSkinStealer();
  if (starving) for (const e of w.eng.entities) if (e.kind === 'skinstealer') e.hunger = .95;
  const R = mkRng(seed * 31 + 5), floors = [], MODES = ['walk', 'walk', 'run', 'crouch', 'walk', 'run'];
  for (let k = 0; k < 6000 && floors.length < 500; k++) { const x = 300 + R() * 9000, y = 300 + R() * 6000; if (w.ad.clear(x, y, 20, 'walk')) floors.push({ x: Math.round(x), y: Math.round(y) }); }
  const ps = []; for (let i = 0; i < +ARG.players; i++) { const f = floors[(i * 53) % floors.length]; const p = w.player(f.x, f.y, { light: i % 3 !== 2 }); p.stop('stand'); ps.push(p); }
  // the counters: only while measuring, only inside the Skin-Stealer's own tick
  let measure = false, inSk = 0; const C = { think: 0, paths: 0, pathMs: 0, slowPaths: 0, los: 0 };
  const tk = AI.SKIN.tick; AI.SKIN.tick = function (...a) { if (!measure) return tk.apply(this, a); const t0 = process.hrtime.bigint(); inSk++; try { return tk.apply(this, a); } finally { inSk--; C.think += ms(t0); } };
  const geo = w.eng.geo, gp = geo.path, gl = geo.los;
  geo.path = function (...a) { if (!measure || !inSk) return gp.apply(this, a); const t0 = process.hrtime.bigint(); try { return gp.apply(this, a); } finally { const d = ms(t0); C.paths++; C.pathMs += d; if (d > 1) C.slowPaths++; } };
  geo.los = function (...a) { if (measure && inSk) C.los++; return gl.apply(this, a); };
  const gcs = []; let w0 = Infinity, w1 = Infinity; const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) gcs.push([e.startTime, e.duration]); }); obs.observe({ entryTypes: ['gc'] });   // (delivered later: kept with their times)
  const steps = [], bytes = []; let heap0 = 0;
  const orig = w.sim.step; w.sim.step = dt => { const t0 = process.hrtime.bigint(); orig(dt); if (measure) steps.push(ms(t0)); };
  const n = Math.round((5 + +ARG.secs) / H.DT); let pick = 0; const deadAt = new Map();
  for (let i = 0; i < n; i++) {
    const t = i * H.DT; if (!measure && t >= 5) { measure = true; heap0 = process.memoryUsage().heapUsed; w0 = performance.now(); }
    for (const [k, p] of ps.entries()) {
      if (p.dead) { if (!deadAt.has(k)) deadAt.set(k, t); else if (t - deadAt.get(k) > 5 && w.sim.canRespawn(p)) { w.sim.respawn(p); deadAt.delete(k); } continue; }
      if (!p.path || !p.path.length) { const f = floors[Math.floor(R() * floors.length)]; p.pathTo(f.x, f.y, MODES[++pick % MODES.length]); }
    }
    w.step();
    if (measure && i % 3 === 0) bytes.push(JSON.stringify(w.sim.entities()).length);
  }
  const heap1 = process.memoryUsage().heapUsed; measure = false; w1 = performance.now();
  setTimeout(() => {                                                                         // (the observer's last entries arrive asynchronously)
    obs.disconnect(); const G = gcs.filter(g => g[0] >= w0 && g[0] <= w1).map(g => g[1]);
    const secs = +ARG.secs, mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    process.stdout.write(JSON.stringify({ steps: steps.length, mean, p95: q(steps, .95), p99: q(steps, .99), worst: Math.max(...steps), bytes: bytes.reduce((a, b) => a + b, 0) / bytes.length,
      thinkMsPerS: C.think / secs, pathsPerS: C.paths / secs, pathMsPerS: C.pathMs / secs, slowPathsPerS: C.slowPaths / secs, losPerS: C.los / secs,
      gcCount: G.length, gcMs: G.reduce((a, b) => a + b, 0), gcWorst: G.length ? Math.max(...G) : 0, heapGrowthMB: (heap1 - heap0) / 1048576,
      skinstealers: w.eng.entities.filter(e => e.kind === 'skinstealer').length, kills: w.kills.length }) + '\n');
    process.exit(0);
  }, 200);
  return;
}
const one = (repo, ss, press) => {
  const x = spawnSync(process.execPath, ['--expose-gc', __filename, '--run', '1', '--repo', repo, '--ss', String(ss), '--press', String(press), '--secs', ARG.secs, '--players', ARG.players, '--seed', ARG.seed], { encoding: 'utf8', timeout: 7200000, maxBuffer: 1 << 24 });
  if (x.status !== 0) { console.error('run failed', x.stderr.slice(0, 600)); process.exit(1); }
  return JSON.parse(x.stdout.trim().split('\n').pop());
};
if (!ARG.base) { console.error('--base DIR (a tree of R8, f378049) is required'); process.exit(2); }
const BASE = path.resolve(ARG.base), CFG = [['R8-1', BASE, 1, 0], ['R16-1', HERE, 1, 0], ['R8-4h', BASE, 4, 2], ['R16-4h', HERE, 4, 2]];
const runs = Object.fromEntries(CFG.map(c => [c[0], []])), F = ['mean', 'p95', 'p99', 'worst', 'thinkMsPerS', 'pathsPerS', 'pathMsPerS', 'slowPathsPerS', 'losPerS', 'gcCount', 'gcMs', 'gcWorst', 'heapGrowthMB', 'bytes'];
for (let r = 0; r < +ARG.rounds; r++) for (const [name, repo, ss, press] of (r % 2 ? CFG.slice().reverse() : CFG)) {   // (odd rounds in the other order)
  const j = one(repo, ss, press); runs[name].push(j);
  console.log(`round ${r + 1} ${name}: step mean ${j.mean.toFixed(3)} ms p95 ${j.p95.toFixed(3)} p99 ${j.p99.toFixed(3)} worst ${j.worst.toFixed(2)}; its think ${j.thinkMsPerS.toFixed(1)} ms/s; route searches ${j.pathsPerS.toFixed(1)}/s (${j.pathMsPerS.toFixed(1)} ms/s, over 1 ms ${j.slowPathsPerS.toFixed(2)}/s); lines of sight ${Math.round(j.losPerS)}/s; GC ${j.gcCount} (${j.gcMs.toFixed(0)} ms, worst ${j.gcWorst.toFixed(1)}); heap +${j.heapGrowthMB.toFixed(1)} MB; entities ${Math.round(j.bytes)} B; kills ${j.kills}`);
}
const sum = Object.fromEntries(Object.entries(runs).map(([k, a]) => [k, Object.fromEntries(F.map(f => [f, +med(a.map(j => j[f])).toFixed(4)]))]));
for (const n of ['1', '4h']) { const A = sum['R8-' + n], B = sum['R16-' + n];
  console.log(`${n === '1' ? 'one' : 'four starving'} (medians, R8 -> R16): ${F.map(f => `${f} ${A[f]} -> ${B[f]}`).join('; ')}`); }
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify({ tool: 'dev/trial-3-r9-overhaul/tools/perf_r16.js', rounds: +ARG.rounds, secs: +ARG.secs, players: +ARG.players, seed: +ARG.seed, medians: sum, runs }, null, 1) + '\n');
