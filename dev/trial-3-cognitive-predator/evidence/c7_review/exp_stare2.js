/* C7 review: during the stand-off renewals of exp_stare.js, does it ever shift its ground ("another dark spot")?  Path length moved while in
 * 'stand', renewals counted from its QA record, vantage spots chosen.  Usage: node exp_stare2.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander } = require(LIB);
for (const h of [.5, .55]) for (let seed = 1; seed <= 6; seed++) {
  const w = World(seed + 15800 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  let px = e.x, py = e.y, moved = 0, standT = 0, again = 0, spots = new Set(), lastN = 0;
  w.run(120, (ww, t) => {
    const k = e.plan ? e.plan.k : '';
    if (k === 'stand') { moved += Math.hypot(e.x - px, e.y - py); standT += 1 / 60; if (e.plan.spot) spots.add(Math.round(e.plan.spot.x) + ',' + Math.round(e.plan.spot.y)); }
    px = e.x; py = e.y;
    if (e.cog && e.cog.n > lastN) { for (const L of e.cog.log.slice(-(e.cog.n - lastN))) if (L.stim === 'again') again++; lastN = e.cog.n; }
    return !w.kills.length && k !== 'leave'; });
  console.log(`h=${h} seed ${seed}: in 'stand' ${standT.toFixed(1)} s, moved ${Math.round(moved)} px in it; renewals ('again') ${again}; vantage spots used ${spots.size}; hunger at end ${e.hunger.toFixed(2)}`);
}
