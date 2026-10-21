/* C7 review: a lead won with no race.  C10 (b) starts the sprinter 380 px off (inside SK.chaseFrom = 420), at .45/.55/.62.  Here the
 * sprinter starts beyond the chase range (gap0 px) at very hungry .65-.85, facing away, runs east down the long hall until winded, then
 * keeps walking (move.js: exhausted walk 148 px/s).  Measured while they keep moving: the largest gap, how far it later shrank, the
 * creature's plan while shrinking.  Usage: node exp_lead.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander } = require(LIB);
const GAPS = (process.env.GAPS || '450,520').split(',').map(Number), HS = (process.env.HS || '.65,.75,.85').split(',').map(Number);
for (const gap0 of GAPS) for (const h of HS) {
  const rows = [];
  for (let seed = 1; seed <= 6; seed++) {
    const w = World(seed + 13500 + Math.round(h * 100) + gap0), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(3300 + gap0, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 3300, y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    let maxGap = 0, shrink = 0, shrinkPlan = '', exAt = -1, caught = false, raced = false, plans = new Map();
    w.run(34, (ww, t) => {
      if (t > .4 && !p.leg) { p.leg = 1; p.go(8700, y, 'run'); }
      if (p.ex && exAt < 0) exAt = t;
      const d = Math.hypot(p.x - e.x, p.y - e.y), moving = p.tx !== null;
      if (e.plan && e.plan.k === 'chase') raced = true;
      if (t > 1.5 && moving && !w.kills.length) { maxGap = Math.max(maxGap, d); if (maxGap - d > shrink) { shrink = maxGap - d; shrinkPlan = (e.plan ? e.plan.k + (e.plan.shadow ? '(trail)' : '') : '-') + '@' + t.toFixed(1) + 's sp' + Math.round(e.speed) + (e.seenNow.has(p.id) ? ' seen' : ' unseen'); } }
      const k = e.plan ? e.plan.k : '-'; plans.set(k, (plans.get(k) || 0) + 1 / 60);
      if (w.kills.length && moving) caught = true; return true; });
    rows.push(`  seed ${seed}: winded at ${exAt.toFixed(1)} s; chase ${raced ? 'yes' : 'no'}; max gap ${Math.round(maxGap)}; shrank by ${Math.round(shrink)} px (${shrinkPlan || '-'}); caught while moving ${caught}; plans ${[...plans].filter(([, v]) => v > .5).map(([k, v]) => k + ' ' + v.toFixed(0) + 's').join(', ')}`);
  }
  console.log(`gap0 ${gap0}, h=${h}\n${rows.join('\n')}`);
}
