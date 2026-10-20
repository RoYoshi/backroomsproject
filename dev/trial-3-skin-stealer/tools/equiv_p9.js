#!/usr/bin/env node
/* dev/trial-3-skin-stealer/tools/equiv_p9.js - Trial 3 (T7): the Hound and the Smiler are P9's (development only; the checkpoints'
 * evidence, not a gate step).
 *
 *   node dev/trial-3-skin-stealer/tools/equiv_p9.js --p9 DIR [--seeds 1,2,3,4,5,6] [--secs 120] [--out FILE.json]
 *
 * DIR is a checkout of P9 (pre-trial3-final-polish, 1ff9374), e.g. a detached `git worktree add --detach DIR 1ff9374` outside this
 * repository.  Each seed builds the same world twice in one process - P9's sim (its dev/harness.js, its generated ai.js and world.js)
 * and this tree's - with the director on and the world's own Hounds and Smilers (resetWorld), and drives four scripted players the same
 * way in both (the same seeded routes across the level, running, walking, crouching, the light on and off; a dead one respawned after
 * 5 s).  Every 6th tick (the snapshot's rate) the two must be identical: the snapshot's entities (sim.entities(): every Hound and Smiler,
 * its state, act, place), every player's place, life, stamina and capture, the kills and the bodies.  On this tree, every 2 s a line
 * of speech is also handed to the engine's new hearing hook (eng.hearSpeech, as B++'s speech.js does for an accepted line) - with no
 * Skin-Stealer in the world it must change nothing.  The first difference, if any, is reported with its tick.
 *   --selftest 1   moves one Hound 1 px on this tree at tick 600: every seed must then differ (the comparison sees a Hound). */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = { seeds: '1,2,3,4,5,6', secs: '120' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.p9) { console.error('--p9 DIR (a checkout of P9, 1ff9374) is required'); process.exit(2); }
const HERE = path.resolve(__dirname, '..', '..', '..'), P9 = path.resolve(ARG.p9);
const HT = require(path.join(HERE, 'dev', 'harness.js')), HP = require(path.join(P9, 'dev', 'harness.js'));
const mkRng = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const MODES = ['walk', 'walk', 'run', 'crouch', 'walk', 'run'];
function scene(H, seed) {
  const w = H.World(seed, { director: true }); w.sim.resetWorld();
  const R = mkRng(seed * 7919 + 13), floors = [];
  const g = w.eng.geo; for (let k = 0; k < 4000 && floors.length < 400; k++) { const x = 300 + R() * 9000, y = 300 + R() * 6000; if (w.ad.clear(x, y, 20, 'walk')) floors.push({ x: Math.round(x), y: Math.round(y) }); }
  const ps = []; for (let i = 0; i < 4; i++) { const f = floors[(i * 37) % floors.length]; const p = w.player(f.x, f.y, { light: i % 2 === 0 }); p.stop('stand'); ps.push(p); }
  return { w, R, floors, ps, deadAt: new Map() };
}
function drive(S, t) {                                     // the same decisions in both worlds: from the tool's own seeded stream, never the world's
  for (const [i, p] of S.ps.entries()) {
    if (p.dead) { if (!S.deadAt.has(i)) S.deadAt.set(i, t); else if (t - S.deadAt.get(i) > 5 && S.w.sim.canRespawn && S.w.sim.canRespawn(p)) { S.w.sim.respawn(p); S.deadAt.delete(i); } continue; }
    if (!p.path || !p.path.length) { const f = S.floors[Math.floor(S.R() * S.floors.length)]; S.pick = (S.pick || 0) + 1; p.pathTo(f.x, f.y, MODES[S.pick % MODES.length]); }
    if (S.R() < .004) p.light = !p.light;
  }
}
const snap = S => JSON.stringify({ e: S.w.sim.entities(), p: S.ps.map(p => [Math.round(p.x * 10), Math.round(p.y * 10), p.dead || 0, Math.round(p.stamina), p.caught ? 1 : 0, p.light ? 1 : 0]), k: S.w.kills.map(k => [k.pid, k.kind, k.variant]), b: S.w.sim.bodies ? S.w.sim.bodies.size : -1 });
const res = { tool: 'dev/trial-3-skin-stealer/tools/equiv_p9.js', p9: ARG.p9 ? 'P9 checkout' : null, secs: +ARG.secs, seeds: [], ok: true };
for (const seed of ARG.seeds.split(',').map(Number)) {
  const A = scene(HP, seed), B = scene(HT, seed), n = Math.round(+ARG.secs / HT.DT);
  const r = { seed, ticks: 0, compared: 0, first: null, hounds: 0, smilers: 0, kills: 0, deaths: 0, heard: 0 };
  for (let i = 0; i < n && !r.first; i++) {
    const t = i * HT.DT; drive(A, t); drive(B, t);
    if (i % 120 === 60 && B.w.eng.hearSpeech) { const p = B.ps.find(q => !q.dead); if (p) { r.heard += B.w.eng.hearSpeech({ id: p.id, x: p.x, y: p.y, text: 'a synthetic line ' + i }); } }
    if (ARG.selftest && i === 600) { const h = B.w.eng.entities.find(e => e.kind === 'hound'); if (h) { h.x += 1; r.perturbed = h.id; } }   // (the self-test: one Hound moved 1 px on this tree)
    A.w.step(); B.w.step(); r.ticks++;
    if (i % 6 === 0) { const a = snap(A), b = snap(B); r.compared++; if (a !== b) { let k = 0; while (k < a.length && a[k] === b[k]) k++; r.first = { tick: i, t: +t.toFixed(2), at: k, p9: a.slice(Math.max(0, k - 80), k + 80), t3: b.slice(Math.max(0, k - 80), k + 80) }; } }
  }
  const E = B.w.eng.entities; r.hounds = E.filter(e => e.kind === 'hound').length; r.smilers = E.filter(e => e.kind === 'smiler').length; r.kills = B.w.kills.length;
  r.skinstealers = E.filter(e => e.kind === 'skinstealer').length; r.ok = ARG.selftest ? !!r.first && r.first.tick >= 600 : !r.first && r.skinstealers === 0 && r.heard === 0;
  if (!r.ok) res.ok = false; res.seeds.push(r);
  console.log(`${r.first ? 'DIFF' : 'SAME'}${r.ok ? '' : ' (FAIL)'} seed ${seed}: ${r.ticks} ticks, ${r.compared} snapshots compared; ${r.hounds} Hounds, ${r.smilers} Smilers at the end; ${r.kills} kills; speech lines kept by an entity: ${r.heard}${r.first ? ' | first difference at tick ' + r.first.tick : ''}`);
}
console.log(ARG.selftest ? `P9 EQUIVALENCE SELF-TEST: ${res.ok ? 'PASS' : 'FAIL'} - ${res.seeds.filter(s => s.ok).length} of ${res.seeds.length} seeds told the moved Hound apart` : `P9 EQUIVALENCE: ${res.ok ? 'PASS' : 'FAIL'} - ${res.seeds.filter(s => s.ok).length} of ${res.seeds.length} seeds identical tick for tick (${res.seeds.reduce((a, s) => a + s.compared, 0)} snapshots)`);
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(res, null, 1) + '\n');
process.exitCode = res.ok ? 0 : 1;
