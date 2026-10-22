/* C7 re-check: classify every stretch of 20 s or more standing still in the watcher's view (exp_stare3's scenes, seeds and hungers) by
 * the plan that held it, and whether the plan's own reason claims it is out of their sight.  Usage: node exp_stare5.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, DT } = require(LIB);
const SCENES = { hall450: { p: [5000, LONG.y], k: [5450, LONG.y] }, hall300: { p: [5150, LONG.y], k: [5450, LONG.y] }, sw: { p: [700, 5330], k: [1300, 5330] } };
const by = new Map(); let n = 0, runs = 0;
for (const [name, S] of Object.entries(SCENES)) for (const h of [.45, .5, .6, .62, .65, .7]) for (let seed = 1; seed <= 6; seed++) {
  const w = World(seed + 31000 + Math.round(h * 100)); bystander(w, name === 'sw' ? 5000 : 1300, name === 'sw' ? LONG.y : 3300);
  const p = w.player(S.p[0], S.p[1], { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', S.k[0], S.k[1], { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  let run = 0, plan = '', best = 0, bestPlan = '';
  w.run(120, () => {
    const d = Math.hypot(p.x - e.x, p.y - e.y), vis = w.eng.geo.los(p.x, p.y, e.x, e.y) && d < 900, still = vis && e.speed < 15 && !e.pounce;
    if (still) { run += DT; if (run > best) { best = run; bestPlan = (e.plan ? e.plan.k + (e.plan.arrived ? '(arrived)' : '') : '-') + ' "' + (e.dbg.why || '').slice(0, 45) + '"'; } } else run = 0;
    return !w.kills.length; });
  runs++;
  if (best >= 20) { n++; const k = bestPlan; by.set(k, (by.get(k) || []).concat(`${name}/${h}/s${seed}:${best.toFixed(0)}s`)); }
}
console.log(`runs ${runs}; with a stretch of 20 s or more standing still in their view: ${n}`);
for (const [k, v] of by) console.log(`  ${v.length} x ${k}: ${v.join(' ')}`);
