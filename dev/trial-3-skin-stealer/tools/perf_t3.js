#!/usr/bin/env node
/* dev/trial-3-skin-stealer/tools/perf_t3.js - Trial 3 (T7): the server's cost, P9 against Trial 3 (development only; the checkpoints'
 * evidence, not a gate step).
 *
 *   node dev/trial-3-skin-stealer/tools/perf_t3.js --p9 DIR [--rounds 5] [--secs 60] [--players 8] [--seed 7] [--out FILE.json]
 *   (one run: --run 1 --repo DIR --ss N [--secs --players --seed])
 *
 * One run: a world of the given tree's sim (its dev/harness.js), the director on and the world's own Hounds and Smilers (resetWorld),
 * N Skin-Stealers added the admin's way (only on Trial 3), and the given number of scripted players wandering the level on seeded
 * routes (walking, running, crouching; the dead respawned after 5 s), 5 s of warm-up, then the timed stretch: the wall time of every
 * 60 Hz sim.step (process.hrtime, the step alone, not the scripted players) and the snapshot's entity part (sim.entities(), its JSON
 * length) every 3rd step, as the server's loop sends it.  The matrix runs P9 (no Skin-Stealer), Trial 3 with 0, 1 and 4, interleaved
 * round by round (P9, T3-0, T3-1, T3-4, P9, ...), each in its own process, and compares medians.  The rule for "Trial 3 without a
 * Skin-Stealer costs what P9 costs": T3-0's median of the mean step at most P9's median + max(P9's spread across rounds, 5 %).  With
 * Skin-Stealers there is no P9 to compare with: their cost is reported (mean, p95, p99, worst step; bytes) against the 60 Hz step's
 * budget (16.7 ms): with one and with four, the median mean step at most 5 % of it and the median p99 at most 25 % of it.  The single
 * worst step is reported, not judged: on a small shared machine it is a garbage collection or the scheduler (a pilot run of this tool
 * saw 29 ms in a Trial 3 run without any Skin-Stealer, whose world is P9's tick for tick - equiv_p9.js - and 16.5 ms in P9's own).
 * Every run also checks each Skin-Stealer once a second: a finite place, never inside the level's
 * geometry, at most 4 lines kept, no skin without a kill and a meal, hunger and stamina in range (violations: none allowed); and sums
 * their records (kills, skins, lines, pounces ...).  --soak S: one long Trial 3 run with 4 Skin-Stealers and the players, S seconds. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = { rounds: '5', secs: '60', players: '8', seed: '7' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const HERE = path.resolve(__dirname, '..', '..', '..');
const mkRng = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const med = a => q(a, .5);
if (ARG.run) {
  const H = require(path.join(path.resolve(ARG.repo), 'dev', 'harness.js')), seed = +ARG.seed, ss = +ARG.ss | 0;
  const w = H.World(seed, { director: true }); w.sim.resetWorld();
  for (let k = 0; k < ss; k++) w.sim.admin.addSkinStealer();
  const R = mkRng(seed * 31 + 5), floors = [], MODES = ['walk', 'walk', 'run', 'crouch', 'walk', 'run'];
  for (let k = 0; k < 6000 && floors.length < 500; k++) { const x = 300 + R() * 9000, y = 300 + R() * 6000; if (w.ad.clear(x, y, 20, 'walk')) floors.push({ x: Math.round(x), y: Math.round(y) }); }
  const ps = []; for (let i = 0; i < +ARG.players; i++) { const f = floors[(i * 53) % floors.length]; const p = w.player(f.x, f.y, { light: i % 3 !== 2 }); p.stop('stand'); ps.push(p); }
  const deadAt = new Map(), viol = []; let pick = 0;
  const steps = [], bytes = [], ent = []; let measure = false;
  const orig = w.sim.step; w.sim.step = dt => { const t0 = process.hrtime.bigint(); orig(dt); if (measure) steps.push(Number(process.hrtime.bigint() - t0) / 1e6); };
  const n = Math.round((5 + +ARG.secs) / H.DT);
  for (let i = 0; i < n; i++) {
    const t = i * H.DT; measure = t >= 5;
    for (const [k, p] of ps.entries()) {
      if (p.dead) { if (!deadAt.has(k)) deadAt.set(k, t); else if (t - deadAt.get(k) > 5 && w.sim.canRespawn(p)) { w.sim.respawn(p); deadAt.delete(k); } continue; }
      if (!p.path || !p.path.length) { const f = floors[Math.floor(R() * floors.length)]; p.pathTo(f.x, f.y, MODES[++pick % MODES.length]); }
    }
    w.step();
    if (i % 60 === 0) for (const e of w.eng.entities) if (e.kind === 'skinstealer') {            // its invariants, once a second (Trial 3 only)
      const bad = !Number.isFinite(e.x + e.y) ? 'position' : !w.ad.clear(e.x, e.y, Math.max(4, e.rc - 6), 'walk') ? 'inside geometry' : e.heard.length > 4 ? 'heard ' + e.heard.length :
        e.disguise && !(e.tally.kills > 0 && e.tally.skin > 0) ? 'unearned skin' : !(e.hunger >= 0 && e.hunger <= 1) ? 'hunger' : !(e.stam >= 0 && e.stam <= 100) ? 'stamina' : '';
      if (bad) viol.push([+t.toFixed(1), e.id, bad]);
    }
    if (measure && i % 3 === 0) { const t0 = process.hrtime.bigint(), e = w.sim.entities(), s = JSON.stringify(e); ent.push(Number(process.hrtime.bigint() - t0) / 1e6); bytes.push(s.length); }
  }
  const E = w.eng.entities, mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  process.stdout.write(JSON.stringify({ steps: steps.length, mean, p95: q(steps, .95), p99: q(steps, .99), worst: Math.max(...steps), snapMean: ent.reduce((a, b) => a + b, 0) / ent.length, bytes: bytes.reduce((a, b) => a + b, 0) / bytes.length,
    hounds: E.filter(e => e.kind === 'hound').length, smilers: E.filter(e => e.kind === 'smiler').length, skinstealers: E.filter(e => e.kind === 'skinstealer').length, kills: w.kills.length, kinds: [...new Set(w.kills.map(k => k.kind))],
    viol: viol.slice(0, 20), violations: viol.length, tally: E.filter(e => e.kind === 'skinstealer').reduce((a, e) => { for (const k in e.tally) a[k] = (a[k] || 0) + e.tally[k]; return a; }, {}) }) + '\n');
  process.exit(0);
}
if (ARG.soak) {
  const x = spawnSync(process.execPath, [__filename, '--run', '1', '--repo', HERE, '--ss', '4', '--secs', ARG.soak, '--players', ARG.players, '--seed', ARG.seed], { encoding: 'utf8', timeout: 7200000, maxBuffer: 1 << 24 });
  if (x.status !== 0) { console.error('soak failed', x.stderr.slice(0, 600)); process.exit(1); }
  const j = JSON.parse(x.stdout.trim().split('\n').pop()), ok = j.violations === 0 && j.mean <= 16.7 * .05 && j.p99 <= 16.7 * .25 && j.skinstealers === 4;   // (the worst step reported, not judged: see above)
  console.log(`SOAK ${ARG.soak} s, 4 Skin-Stealers, ${ARG.players} players: mean ${j.mean.toFixed(3)} ms, p99 ${j.p99.toFixed(3)}, worst ${j.worst.toFixed(2)} ms; ${j.kills} kills (${j.kinds.join('/')}); violations ${j.violations}; their record ${JSON.stringify(j.tally)}`);
  console.log(`PERF T3 SOAK: ${ok ? 'PASS' : 'FAIL'}`);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(Object.assign({ tool: 'dev/trial-3-skin-stealer/tools/perf_t3.js --soak', secs: +ARG.soak, players: +ARG.players, seed: +ARG.seed, ok }, j), null, 1) + '\n');
  process.exit(ok ? 0 : 1);
}
if (!ARG.p9) { console.error('--p9 DIR (a checkout of P9, 1ff9374) is required'); process.exit(2); }
const CFG = [['P9', path.resolve(ARG.p9), 0], ['T3-0', HERE, 0], ['T3-1', HERE, 1], ['T3-4', HERE, 4]];
const runs = Object.fromEntries(CFG.map(c => [c[0], []]));
for (let r = 0; r < +ARG.rounds; r++) for (const [name, repo, ss] of CFG) {
  const x = spawnSync(process.execPath, [__filename, '--run', '1', '--repo', repo, '--ss', String(ss), '--secs', ARG.secs, '--players', ARG.players, '--seed', ARG.seed], { encoding: 'utf8', timeout: 1800000, maxBuffer: 1 << 24 });
  if (x.status !== 0) { console.error(name, 'failed', x.stderr.slice(0, 600)); process.exit(1); }
  const j = JSON.parse(x.stdout.trim().split('\n').pop()); runs[name].push(j);
  console.log(`round ${r + 1} ${name}: mean ${j.mean.toFixed(3)} ms, p95 ${j.p95.toFixed(3)}, p99 ${j.p99.toFixed(3)}, worst ${j.worst.toFixed(2)}; entities ${Math.round(j.bytes)} B; ${j.hounds}H ${j.smilers}S ${j.skinstealers}K; kills ${j.kills} (${j.kinds.join('/')})`);
}
const sum = Object.fromEntries(Object.entries(runs).map(([k, a]) => [k, { mean: +med(a.map(j => j.mean)).toFixed(4), p95: +med(a.map(j => j.p95)).toFixed(4), p99: +med(a.map(j => j.p99)).toFixed(4), worst: +Math.max(...a.map(j => j.worst)).toFixed(3),
  bytes: Math.round(med(a.map(j => j.bytes))), snapMean: +med(a.map(j => j.snapMean)).toFixed(4), spread: +(Math.max(...a.map(j => j.mean)) - Math.min(...a.map(j => j.mean))).toFixed(4), kills: a.map(j => j.kills) }]));
const P = sum.P9, T0 = sum['T3-0'], tol = Math.max(P.spread, P.mean * .05);
const res = { tool: 'dev/trial-3-skin-stealer/tools/perf_t3.js', node: process.version, rounds: +ARG.rounds, secs: +ARG.secs, players: +ARG.players, seed: +ARG.seed, summary: sum, runs,
  rule: { p9Mean: P.mean, t3Mean: T0.mean, tolerance: +tol.toFixed(4), changePct: +((T0.mean - P.mean) / P.mean * 100).toFixed(2), ok: T0.mean <= P.mean + tol },
  withSkinStealers: { one: { addPct: +((sum['T3-1'].mean - T0.mean) / T0.mean * 100).toFixed(1), bytes: sum['T3-1'].bytes - T0.bytes }, four: { addPct: +((sum['T3-4'].mean - T0.mean) / T0.mean * 100).toFixed(1), bytes: sum['T3-4'].bytes - T0.bytes }, budgetOk: sum['T3-4'].mean <= 16.7 * .05 && sum['T3-4'].p99 <= 16.7 * .25 && sum['T3-1'].mean <= 16.7 * .05 && sum['T3-1'].p99 <= 16.7 * .25 },
  worstSteps: Object.fromEntries(Object.entries(runs).map(([k, a]) => [k, a.map(j => +j.worst.toFixed(2))])) };
res.violations = Object.values(runs).flat().reduce((a, j) => a + (j.violations || 0), 0);
res.ok = res.rule.ok && res.withSkinStealers.budgetOk && res.violations === 0;
console.log(`P9 ${P.mean} ms vs Trial 3 (none) ${T0.mean} ms (${res.rule.changePct > 0 ? '+' : ''}${res.rule.changePct} %, tolerance ${res.rule.tolerance} ms): ${res.rule.ok ? 'SAME COST' : 'MORE'}; one Skin-Stealer +${res.withSkinStealers.one.addPct} % (+${res.withSkinStealers.one.bytes} B a snapshot), four +${res.withSkinStealers.four.addPct} % (+${res.withSkinStealers.four.bytes} B): mean ${sum['T3-4'].mean} ms, p99 ${sum['T3-4'].p99} ms of a 16.7 ms step; worst steps P9 ${res.worstSteps.P9.join('/')}, T3-0 ${res.worstSteps['T3-0'].join('/')}, T3-4 ${res.worstSteps['T3-4'].join('/')} ms; invariant violations ${Object.values(runs).flat().reduce((a, j) => a + (j.violations || 0), 0)}`);
console.log(`PERF T3: ${res.ok ? 'PASS' : 'FAIL'}`);
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(res, null, 1) + '\n');
process.exitCode = res.ok ? 0 : 1;
