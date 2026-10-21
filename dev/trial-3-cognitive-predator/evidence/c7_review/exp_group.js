/* C7 review: "people together are never come at" (C2) - but 'stand' was added to SK_STRIKE.  Two lit people side by side (90 px apart)
 * stand in the hall facing it (SK17's set-up, hungrier), then after 4 s walk together slowly toward the creature and stop 120 px short of
 * where it was.  Does it spring at one of them while its plan is a group stand-off?  Usage: node exp_group.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander } = require(LIB);
for (const h of [.55, .7, .9]) {
  const rows = [];
  for (let seed = 1; seed <= 8; seed++) {
    const w = World(seed + 22000 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const a = w.player(5000, y - 45, { light: true, angle: 0 }), b = w.player(5000, y + 45, { light: true, angle: 0 }); a.stop('stand'); b.stop('stand');
    const e = w.eng.spawn('skinstealer', 5600, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    for (const q of [a, b]) q.look = () => Math.atan2(e.y - q.y, e.x - q.x);
    let spring = null, groupHoldAtSpring = null, plans = new Set(), killed = '';
    w.run(25, (ww, t) => {
      if (t > 4 && !a.leg) { a.leg = b.leg = 1; const tx = e.x - 120; a.go(tx, y - 45, 'walk'); b.go(tx, y + 45, 'walk'); }
      if (e.plan) plans.add(e.plan.k + (e.plan.groupHold ? '(group)' : ''));
      if (e.pounce && !spring) { spring = { t: +t.toFixed(1), style: e.pounce.style, plan: e.plan ? e.plan.k : '-', dAB: Math.round(Math.hypot(a.x - b.x, a.y - b.y)) }; groupHoldAtSpring = e.plan ? !!e.plan.groupHold : null; }
      if (w.kills.length && !killed) killed = w.kills.map(k => k.pid === a.id ? 'A' : 'B').join('');
      return !w.kills.length; });
    rows.push(`  s${seed}: ${spring ? `SPRANG (${spring.style}) at ${spring.t} s from plan ${spring.plan}, groupHold=${groupHoldAtSpring}, the two ${spring.dAB} px apart` : 'no spring'}; killed ${killed || '-'}; plans ${[...plans].join(' ')}`);
  }
  console.log(`h=${h}\n${rows.join('\n')}`);
}
