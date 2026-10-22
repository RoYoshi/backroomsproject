/* C7 re-check: does F2's fix (no pounce at anybody with company, any plan, any hunger) make two people who keep together - or merely
 * within 450 px of each other - immune to springs?  C12's passer scene, two unaware walkers in file down the hall (backs to the creature's
 * side room), `gap` px apart, hunger .7 / .95, 8 seeds; a single walker as control.  Usage: node exp_pairs.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander } = require(LIB);
for (const gap of [0, 100, 400]) for (const h of [.7, .95]) {
  let pounce = 0, grab = 0, kills = 0, runs = 0; const plans = new Map();
  for (let seed = 1; seed <= 8; seed++) {
    const w = World(seed + 28000 + Math.round(h * 100) + gap), y = LONG.y; bystander(w, 1300, 3300);
    const a = w.player(4700, y, { light: true, angle: 0 }); a.stop('stand'); a.look = 0;
    const b = gap ? w.player(4700 - gap, y, { light: true, angle: 0 }) : null; if (b) { b.stop('stand'); b.look = 0; }
    const e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: h }); e.tier = 'near'; e.ang = Math.PI / 2;
    let P0 = null;
    w.run(25, (ww, t) => {
      if (t > .5 && !a.leg) { a.leg = 1; a.go(7800, y, 'walk'); if (b) { b.leg = 1; b.go(7800 - gap, y, 'walk'); } }
      if (e.pounce && e.pounce !== P0) { P0 = e.pounce; if (P0.style === 'pounce') pounce++; else if (P0.style === 'grab') grab++; }
      if (e.plan) plans.set(e.plan.k, (plans.get(e.plan.k) || 0) + 1 / 60);
      return !w.kills.length; });
    runs++; if (w.kills.length) kills++;
  }
  console.log(`${gap ? 'two walkers ' + gap + ' px apart' : 'one walker (control)'} h=${h}: runs with a kill ${kills}/${runs}; pounces ${pounce}, grabs ${grab}; plan seconds ${[...plans].filter(([, v]) => v > 1).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', ')}`);
}
