/* C7 review: how often does a person C4's draw PASSED OVER get hunted anyway (a hunt begun by the lost-sight interception / search paths
 * that never consult the draw)?  C12's passer scene and a crossing variant, 24 seeds per hunger.  The draw's chance is computed at the hunger
 * the creature had when it drew.  Usage: node exp_bold2.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, AI } = require(LIB);
const SK = AI.SK, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const chance = h => SK.boldAt[0] + (1 - SK.boldAt[0]) * sm(SK.boldAt[1], SK.boldAt[2], h);
for (const H of [.42, .45, .48]) {
  let passed = 0, huntedAnyway = 0, killedAnyway = 0, engaged = 0; const how = new Map();
  for (let seed = 1; seed <= 24; seed++) {
    const w = World(seed + 24000 + Math.round(H * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(4700, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: H }); e.tier = 'near'; e.ang = Math.PI / 2;
    let draw = null, hAt = null, pass = null, huntPlan = null, huntWhy = '';
    w.run(25, (ww, t) => {
      if (t > .5 && !p.leg) { p.leg = 1; p.go(6500, y, 'walk'); }
      if (draw === null && e.enc && e.enc.pid === p.id && e.enc.bold !== undefined) { draw = e.enc.bold; hAt = e.hunger; pass = !(draw < chance(hAt)) && !e.hunt; }
      if (pass && !huntPlan && e.hunt && e.hunt.pid === p.id) { huntPlan = e.plan ? e.plan.k : '-'; huntWhy = e.plan ? e.plan.why.slice(0, 60) : ''; }
      return !w.kills.length; });
    if (pass === null) continue;
    if (pass) { passed++; if (huntPlan) { huntedAnyway++; how.set(huntPlan, (how.get(huntPlan) || 0) + 1); } if (w.kills.length) killedAnyway++; } else engaged++;
  }
  console.log(`h=${H}: draw said ENGAGE ${engaged}, PASS OVER ${passed}; of those passed over, hunted anyway ${huntedAnyway} (begun in ${[...how].map(([k, n]) => k + ' x' + n).join(', ') || '-'}), killed anyway ${killedAnyway}`);
}
