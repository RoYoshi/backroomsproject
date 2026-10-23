#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/scene_probe.js - Trial 3 R18: two of the owner's section 11 scenes headless, at the players' true speeds
 * (the real-page threat scenes S1 and S3 move a page at 70-140 px/s under SwiftShader).  Development tool; evidence, not a gate step.
 *
 *   node scene_probe.js --scene walkaway|dither [--hunger .7] [--dir TREE] [--seeds 1,2,3,4,5,6] [--secs 20] [--trace 1]
 *
 * walkaway (S1): a lit person in the long hall looks at a hungry one 600 px off for 1.8 s, then walks away west (172 px/s).
 * dither   (S3): a lit person in the long hall faces a hungry one 650 px off and dithers - 0.45 s of walking north or south, then 0.65 s
 *               standing and looking about, the other way next.
 * Per seed: when it first came within 200 px of them, when it took them, and its plans in order (plan@time).  --trace 1 prints each change
 * of its reason (WHY) with the distance and its hunt's confidence.  Nothing here moves the creature or tells it anything. */
'use strict';
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir', path.join(__dirname, '..', '..', '..'))), SCENE = arg('scene', 'dither'), H = +arg('hunger', .7);
const SECS = +arg('secs', 20), TRACE = !!+arg('trace', 0), SEEDS = arg('seeds', '1,2,3,4,5,6').split(',').map(Number);
const { World, LONG, bystander } = require(path.join(DIR, 'dev', 'tests', 'lib.js'));
console.log(`${SCENE} at hunger ${H} on ${path.basename(DIR)}`);
for (const seed of SEEDS) {
  const walk = SCENE === 'walkaway', w = World(seed * 17 + (walk ? 31000 : 33000)); bystander(w, 1300, 3300);
  const p = w.player(walk ? 4700 : 5000, LONG.y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', walk ? 5300 : 5650, LONG.y, { hunger: H }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  const plans = []; let last = '', close = -1, walkAt = -1, dir = 1, ph = 0, phT = 0, lastWhy = '';
  w.run(SECS, (ww, t) => {
    if (walk) { if (t >= 1.8 && walkAt < 0) { walkAt = t; p.look = null; p.go(3100, LONG.y, 'walk'); } }
    else if (t >= phT) {
      if (ph === 0) { p.go(p.x, p.y + dir * 120, 'walk'); phT = t + .45; ph = 1; }
      else { p.stop('stand'); const tx = 5000 + dir * 300, ty = LONG.y - 300 * dir; p.look = () => Math.atan2(ty - p.y, tx - p.x); phT = t + .65; ph = 0; dir = -dir; }
    }
    const k = e.plan ? e.plan.k + (e.plan.mode ? ':' + e.plan.mode : '') : '-'; if (k !== last) { plans.push(k + '@' + t.toFixed(1)); last = k; }
    if (TRACE && e.dbg.why !== lastWhy) { lastWhy = e.dbg.why; console.log('   ', t.toFixed(2), Math.round(Math.hypot(p.x - e.x, p.y - e.y)) + ' px', k, '|', e.dbg.why, e.hunt ? `(conf ${e.hunt.conf.toFixed(2)})` : ''); }
    if (close < 0 && Math.hypot(p.x - e.x, p.y - e.y) < 200) close = t;
    return !w.kills.length; });
  console.log(`seed ${seed}: within 200 px ${close < 0 ? 'never' : close.toFixed(1) + ' s'}${walk && close >= 0 ? ` (${(close - 1.8).toFixed(1)} s after the walk began)` : ''}, taken ${w.kills.length ? 'at ' + w.kills[0].at.toFixed(1) + ' s' : 'no'} | ${plans.join(' ')}`);
}
