// Over many lit-player / dark-creature pairs: covert-way searches in 10 s for a mildly hungry Skin-Stealer (hunger in the band where a
// failed covert approach spot is not remembered: SK.band[1] <= h < SK.band[2]).  Usage: node cover_churn2.js <export-root> <hunger>
'use strict';
const path = require('path'), ROOT = process.argv[2], h = +(process.argv[3] || .5);
const { World, geo, bystander } = require(path.join(ROOT, 'dev', 'tests', 'lib.js'));
const G = geo(); const pairs = [];
for (const a of G.lit) { if (!G.w.ad.clear(a.x, a.y, 24, 'walk')) continue;
  for (const b of G.dark) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 420 && d < 650 && G.g.los(a.x, a.y, b.x, b.y) && G.w.ad.clear(b.x, b.y, 26, 'walk')) { pairs.push([a, b]); break; } }
  if (pairs.length >= 40) break; }
const res = [];
for (let k = 0; k < pairs.length; k++) {
  const [a, b] = pairs[k]; const w = World(500 + k); bystander(w);
  const p = w.player(a.x, a.y, { light: true, angle: Math.atan2(a.y - b.y, a.x - b.x) }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', b.x, b.y, { hunger: h }); e.tier = 'near'; e.ang = Math.atan2(a.y - b.y, a.x - b.x);
  let thinks = 0, lastNow = -1; w.run(10, () => true);
  res.push(e.tally.coverQ || 0);
}
res.sort((x, y) => y - x);
console.log(`hunger ${h}: ${pairs.length} scenes; covert-way searches in 10 s, most first: ${res.join(' ')}; scenes with >= 10: ${res.filter(x => x >= 10).length}`);
