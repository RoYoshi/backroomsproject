#!/usr/bin/env node
/* dev/trial-3-behavior-refinement/tools/perf_br.js - BR18: the server's cost, the unapproved Trial 3 head against this refinement, with
 * 0, 1 and 4 Skin-Stealers (development only; the checkpoint's evidence, not a gate step).
 *
 *   node dev/trial-3-behavior-refinement/tools/perf_br.js --t3 DIR [--rounds 5] [--secs 60] [--players 8] [--seed 7] [--out FILE.json]
 *   node dev/trial-3-behavior-refinement/tools/perf_br.js --soak 600 [--players 8] [--seed 7] [--out FILE.json]
 *   (one run: --run 1 --repo DIR --ss N --press 0|1 [--secs --players --seed])
 *
 * DIR is a checkout of Trial 3 (020b5b5; e.g. a detached `git worktree add --detach DIR 020b5b5` outside this repository).  One run is
 * dev/trial-3-skin-stealer/tools/perf_t3.js's: the given tree's sim (its dev/harness.js), the director on and the world's own Hounds
 * and Smilers, N Skin-Stealers added the admin's way, the given number of scripted players, 5 s of warm-up, then the timed stretch: the
 * wall time of every 60 Hz sim.step (the step alone) and the snapshot's entity part every 3rd step.  Two kinds of players:
 *   press 0  they wander the level on seeded routes (walking, running, crouching), as perf_t3.js's do;
 *   press 1  the worst case for this refinement: every player keeps within 65 px of the nearest Skin-Stealer, running to catch up, for
 *            the whole run - the awareness, provocation and defence work of every Skin-Stealer runs on every think.
 * The players' scripts are the same on both trees (they read where the creatures are, as players see them); what the creatures do
 * differs by design.  The matrix runs T3-n and BR-n (n = 0, 1, 4; and the pressing runs T3-4p, BR-4p) interleaved round by round, each in
 * its own process, and compares medians: BR-0 at most T3-0's median + max(T3-0's spread, 5 %) (without a Skin-Stealer the step is the
 * same work); with Skin-Stealers, BR-n against T3-n is reported, and BR-1 and BR-4 must keep the 60 Hz step's budget as perf_t3.js
 * judges it (mean at most 5 % of 16.7 ms, p99 at most 25 %).  The pressing runs have no earlier budget: Trial 3's own step went over
 * the p99 part of it there in the first run of this tool (8 players crowded round 4 creatures, the Hounds and Smilers drawn in too), so
 * BR-4p is judged against T3-4p instead: its median mean and median p99 each at most Trial 3's + max(Trial 3's spread across rounds,
 * 5 %); the absolute budget is still reported.  The worst single step is reported, not judged.  Every run checks each Skin-Stealer
 * once a second: perf_t3.js's invariants (its "never inside the level's geometry" not counted while it vaults a low obstacle, Trial 3's
 * own CAN_VAULT: the creature is then above it, as the engine's traversal e.trav says; the samples are counted), and (this tree) at most SK.awMax awareness records, each of a person in the game, pressure
 * finite and at most 1.25, no reaction while in a skin.  --soak S: one long run of this tree, 4 Skin-Stealers, pressing players. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = { rounds: '5', secs: '60', players: '8', seed: '7', press: '0' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const HERE = path.resolve(__dirname, '..', '..', '..');
const mkRng = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const med = a => q(a, .5);
if (ARG.run) {
  const H = require(path.join(path.resolve(ARG.repo), 'dev', 'harness.js')), seed = +ARG.seed, ss = +ARG.ss | 0, press = ARG.press === '1';
  const w = H.World(seed, { director: true }); w.sim.resetWorld();
  const SKC = require(path.join(path.resolve(ARG.repo), 'generated', 'server', 'ai.js')).SK;
  for (let k = 0; k < ss; k++) w.sim.admin.addSkinStealer();
  const R = mkRng(seed * 31 + 5), floors = [], MODES = ['walk', 'walk', 'run', 'crouch', 'walk', 'run'];
  for (let k = 0; k < 6000 && floors.length < 500; k++) { const x = 300 + R() * 9000, y = 300 + R() * 6000; if (w.ad.clear(x, y, 20, 'walk')) floors.push({ x: Math.round(x), y: Math.round(y) }); }
  const ps = []; for (let i = 0; i < +ARG.players; i++) { const f = floors[(i * 53) % floors.length]; const p = w.player(f.x, f.y, { light: i % 3 !== 2 }); p.stop('stand'); ps.push(p); }
  const deadAt = new Map(), viol = []; let pick = 0, maxAw = 0, maxP = 0, vaults = 0;
  const steps = [], bytes = []; let measure = false;
  const orig = w.sim.step; w.sim.step = dt => { const t0 = process.hrtime.bigint(); orig(dt); if (measure) steps.push(Number(process.hrtime.bigint() - t0) / 1e6); };
  const n = Math.round((5 + +ARG.secs) / H.DT), SK = w.eng.entities.filter(e => e.kind === 'skinstealer');
  for (let i = 0; i < n; i++) {
    const t = i * H.DT; measure = t >= 5;
    for (const [k, p] of ps.entries()) {
      if (p.dead) { if (!deadAt.has(k)) deadAt.set(k, t); else if (t - deadAt.get(k) > 5 && w.sim.canRespawn(p)) { w.sim.respawn(p); deadAt.delete(k); } continue; }
      if (press && SK.length) {                                                           // the nearest Skin-Stealer, as the player sees it
        let e = SK[0], bd = 1e9; for (const s of SK) { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; e = s; } }
        if (bd > 900) { if (!p.path || !p.path.length || p.goE !== e.id || i % 120 === 0) { p.goE = e.id; p.pathTo(e.x, e.y, 'run'); } }
        else { const ux = (p.x - e.x) / (bd || 1), uy = (p.y - e.y) / (bd || 1); p.path = null; p.mode = bd > 160 ? 'run' : 'walk'; p.tx = { x: e.x + ux * 65, y: e.y + uy * 65 }; p.look = Math.atan2(e.y - p.y, e.x - p.x); }
        continue;
      }
      if (!p.path || !p.path.length) { const f = floors[Math.floor(R() * floors.length)]; p.pathTo(f.x, f.y, MODES[++pick % MODES.length]); }
    }
    w.step();
    if (i % 60 === 0) for (const e of w.eng.entities) if (e.kind === 'skinstealer') {             // its invariants, once a second
      if (e.trav) vaults++;                                                                       // (mid-vault over a low obstacle - Trial 3's CAN_VAULT - it is above it, not inside it)
      const bad = !Number.isFinite(e.x + e.y) ? 'position' : !e.trav && !w.ad.clear(e.x, e.y, Math.max(4, e.rc - 6), 'walk') ? 'inside geometry' : e.heard.length > 4 ? 'heard ' + e.heard.length :
        e.disguise && !(e.tally.kills > 0 && e.tally.skin > 0) ? 'unearned skin' : !(e.hunger >= 0 && e.hunger <= 1) ? 'hunger' : !(e.stam >= 0 && e.stam <= 100) ? 'stamina' : '';
      let bad2 = '';
      if (e.aw) {                                                                                 // (this refinement's own)
        maxAw = Math.max(maxAw, e.aw.size); for (const A of e.aw.values()) maxP = Math.max(maxP, A.p);
        bad2 = e.aw.size > SKC.awMax ? 'records ' + e.aw.size : [...e.aw.values()].some(A => !w.eng.byId.has(A.pid)) ? 'record of somebody gone' : [...e.aw.values()].some(A => !(A.p >= 0 && A.p <= 1.25)) ? 'pressure' : e.disguise && e.rx ? 'a reaction in a skin' : '';
      }
      if (bad || bad2) viol.push([+t.toFixed(1), e.id, bad || bad2]);
    }
    if (measure && i % 3 === 0) bytes.push(JSON.stringify(w.sim.entities()).length);
  }
  const E = w.eng.entities, mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  process.stdout.write(JSON.stringify({ steps: steps.length, mean, p95: q(steps, .95), p99: q(steps, .99), worst: Math.max(...steps), bytes: bytes.reduce((a, b) => a + b, 0) / bytes.length,
    hounds: E.filter(e => e.kind === 'hound').length, smilers: E.filter(e => e.kind === 'smiler').length, skinstealers: E.filter(e => e.kind === 'skinstealer').length, kills: w.kills.length, kinds: [...new Set(w.kills.map(k => k.kind))],
    viol: viol.slice(0, 20), violations: viol.length, maxAw, maxP: +maxP.toFixed(3), vaultSamples: vaults,
    tally: E.filter(e => e.kind === 'skinstealer').reduce((a, e) => { for (const k in e.tally) a[k] = (a[k] || 0) + e.tally[k]; return a; }, {}) }) + '\n');
  process.exit(0);
}
const one = (repo, ss, press, secs) => {
  const x = spawnSync(process.execPath, [__filename, '--run', '1', '--repo', repo, '--ss', String(ss), '--press', press ? '1' : '0', '--secs', String(secs), '--players', ARG.players, '--seed', ARG.seed], { encoding: 'utf8', timeout: 7200000, maxBuffer: 1 << 24 });
  if (x.status !== 0) { console.error('run failed', x.stderr.slice(0, 600)); process.exit(1); }
  return JSON.parse(x.stdout.trim().split('\n').pop());
};
if (ARG.soak) {
  const j = one(HERE, 4, true, +ARG.soak), ok = j.violations === 0 && j.mean <= 16.7 * .05 && j.p99 <= 16.7 * .25 && j.skinstealers === 4;
  console.log(`SOAK ${ARG.soak} s, 4 Skin-Stealers, ${ARG.players} players pressing them: mean ${j.mean.toFixed(3)} ms, p99 ${j.p99.toFixed(3)}, worst ${j.worst.toFixed(2)} ms; ${j.kills} kills (${j.kinds.join('/')}); records at most ${j.maxAw}, pressure at most ${j.maxP}; violations ${j.violations}; their record ${JSON.stringify(j.tally)}`);
  console.log(`PERF BR SOAK: ${ok ? 'PASS' : 'FAIL'}`);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(Object.assign({ tool: 'dev/trial-3-behavior-refinement/tools/perf_br.js --soak', secs: +ARG.soak, players: +ARG.players, seed: +ARG.seed, ok }, j), null, 1) + '\n');
  process.exit(ok ? 0 : 1);
}
if (!ARG.t3) { console.error('--t3 DIR (a checkout of Trial 3, 020b5b5) is required'); process.exit(2); }
const T3 = path.resolve(ARG.t3), CFG = [['T3-0', T3, 0, false], ['BR-0', HERE, 0, false], ['T3-1', T3, 1, false], ['BR-1', HERE, 1, false], ['T3-4', T3, 4, false], ['BR-4', HERE, 4, false], ['T3-4p', T3, 4, true], ['BR-4p', HERE, 4, true]];
const runs = Object.fromEntries(CFG.map(c => [c[0], []]));
for (let r = 0; r < +ARG.rounds; r++) for (const [name, repo, ss, press] of CFG) {
  const j = one(repo, ss, press, +ARG.secs); runs[name].push(j);
  console.log(`round ${r + 1} ${name}: mean ${j.mean.toFixed(3)} ms, p95 ${j.p95.toFixed(3)}, p99 ${j.p99.toFixed(3)}, worst ${j.worst.toFixed(2)}; entities ${Math.round(j.bytes)} B; ${j.hounds}H ${j.smilers}S ${j.skinstealers}K; kills ${j.kills}; violations ${j.violations}`);
}
const sum = Object.fromEntries(Object.entries(runs).map(([k, a]) => [k, { mean: +med(a.map(j => j.mean)).toFixed(4), p95: +med(a.map(j => j.p95)).toFixed(4), p99: +med(a.map(j => j.p99)).toFixed(4), worst: +Math.max(...a.map(j => j.worst)).toFixed(2),
  bytes: Math.round(med(a.map(j => j.bytes))), spread: +(Math.max(...a.map(j => j.mean)) - Math.min(...a.map(j => j.mean))).toFixed(4), p99spread: +(Math.max(...a.map(j => j.p99)) - Math.min(...a.map(j => j.p99))).toFixed(4), kills: a.map(j => j.kills), maxAw: Math.max(...a.map(j => j.maxAw || 0)), tally: a[0].tally }]));
const A0 = sum['T3-0'], B0 = sum['BR-0'], tol = Math.max(A0.spread, A0.mean * .05), pct = (b, a) => +((b - a) / a * 100).toFixed(1);
const budget = k => sum[k].mean <= 16.7 * .05 && sum[k].p99 <= 16.7 * .25;
const rel = n => { const a = sum['T3-' + n], b = sum['BR-' + n]; return b.mean <= a.mean + Math.max(a.spread, a.mean * .05) && b.p99 <= a.p99 + Math.max(a.p99spread, a.p99 * .05); };
const res = { tool: 'dev/trial-3-behavior-refinement/tools/perf_br.js', node: process.version, rounds: +ARG.rounds, secs: +ARG.secs, players: +ARG.players, seed: +ARG.seed, summary: sum, runs,
  zero: { t3: A0.mean, br: B0.mean, tolerance: +tol.toFixed(4), changePct: pct(B0.mean, A0.mean), ok: B0.mean <= A0.mean + tol },
  against: Object.fromEntries(['1', '4', '4p'].map(n => [n, { meanPct: pct(sum['BR-' + n].mean, sum['T3-' + n].mean), p99Pct: pct(sum['BR-' + n].p99, sum['T3-' + n].p99), bytes: sum['BR-' + n].bytes - sum['T3-' + n].bytes, budgetOk: budget('BR-' + n), againstT3Ok: rel(n), judged: n === '4p' ? 'against Trial 3' : 'the 60 Hz budget' }])),
  worstSteps: Object.fromEntries(Object.entries(runs).map(([k, a]) => [k, a.map(j => +j.worst.toFixed(2))])) };
res.violations = Object.values(runs).flat().reduce((a, j) => a + (j.violations || 0), 0);
res.ok = res.zero.ok && res.against['1'].budgetOk && res.against['4'].budgetOk && res.against['4p'].againstT3Ok && res.violations === 0;
console.log(`without a Skin-Stealer: Trial 3 ${A0.mean} ms, refinement ${B0.mean} ms (${res.zero.changePct > 0 ? '+' : ''}${res.zero.changePct} %, tolerance ${res.zero.tolerance} ms): ${res.zero.ok ? 'SAME COST' : 'MORE'}`);
for (const n of ['1', '4', '4p']) console.log(`${n === '4p' ? 'four, every player pressing one' : n === '1' ? 'one' : 'four'}: Trial 3 ${sum['T3-' + n].mean} ms (p99 ${sum['T3-' + n].p99}), refinement ${sum['BR-' + n].mean} ms (p99 ${sum['BR-' + n].p99}): ${res.against[n].meanPct > 0 ? '+' : ''}${res.against[n].meanPct} % mean, ${res.against[n].p99Pct > 0 ? '+' : ''}${res.against[n].p99Pct} % p99; entities ${res.against[n].bytes >= 0 ? '+' : ''}${res.against[n].bytes} B; within the 60 Hz budget ${res.against[n].budgetOk}; no worse than Trial 3 ${res.against[n].againstT3Ok} (judged: ${res.against[n].judged})`);
console.log(`PERF BR: ${res.ok ? 'PASS' : 'FAIL'} (violations ${res.violations})`);
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(res, null, 1) + '\n');
process.exitCode = res.ok ? 0 : 1;
