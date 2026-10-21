#!/usr/bin/env node
/* dev/trial-3-cognitive-predator/tools/c5_sprint_diag.js - C5: does anything a creature does erode a lead won by sprinting away before any
 * race (pack 04, fairness invariant #1)?  Development only; checkpoint evidence, not a gate step.  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-cognitive-predator/tools/c5_sprint_diag.js [--dir DIR]
 *
 * DIR: a tree whose dev/tests/lib.js (and so its build) is used; default this repository.  40 runs: hunger .5 / .55 / .62 / .7 / .75, four
 * seeds, the person 450 px down the hall from it either facing away or looking at it for 3 s first, then sprinting east and keeping on
 * (winded, walking).  Per run: how far the gap they made shrank while they moved, whether it caught them while they moved, the plans it went
 * through, and a hash of its every position (moving: over 30 px/s - the hall is blocked at about x 7416, where a runner stops) - two builds that print the same hashes moved the creature the same way tick for tick. */
'use strict';
const path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..'));
const { World, LONG, DT, bystander } = require(path.join(DIR, 'dev', 'tests', 'lib.js'));
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
const out = [];
for (const face of [0, 1]) for (const h of [.5, .55, .62, .7, .75]) for (const seed of [1, 2, 3, 4]) {
  const w = World(seed + 13600 + Math.round(h * 100) + face * 7), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(3800, y, { light: true, angle: face ? Math.PI : 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 3350, y, { hunger: h }); e.tier = 'near'; e.ang = 0;
  p.look = face ? () => Math.atan2(e.y - p.y, e.x - p.x) : 0;
  let H = 0, maxGap = 0, shrink = 0, caught = false, lx = p.x, ly = p.y; const t0 = face ? 3 : .4, plans = [];
  w.run(36, (ww, t) => {
    if (t > t0 && !p.leg) { p.leg = 1; p.look = null; p.go(8700, y, 'run'); }
    // moving: really moving (over 30 px/s) - a person held up at the hall's far end is not keeping a lead
    const d = Math.hypot(p.x - e.x, p.y - e.y), moving = p.leg && Math.hypot(p.x - lx, p.y - ly) / DT > 30; lx = p.x; ly = p.y;
    H = (H * 31 + Math.round(e.x) * 7 + Math.round(e.y)) % 1000000007;
    const k = planOf(e); if (plans[plans.length - 1] !== k) plans.push(k);
    if (t > t0 + 1.1 && moving) { maxGap = Math.max(maxGap, d); if (d < maxGap - 40) shrink = Math.max(shrink, maxGap - d); }
    if (w.kills.length && moving) caught = true; return true; });
  out.push({ face, h, seed, hash: H, shrink: Math.round(shrink), caught, plans: plans.join('>').slice(0, 90) });
}
for (const r of out) console.log(`${r.face ? 'looked at it, then ran' : 'ran, facing away'} h ${r.h} seed ${r.seed}: hash ${r.hash}; gap shrank ${r.shrink} px; caught while moving ${r.caught}; ${r.plans}`);
console.log(`runs ${out.length}; gap shrank by over 40 px in ${out.filter(r => r.shrink).length}; caught while moving ${out.filter(r => r.caught).length}`);
