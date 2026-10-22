// Per-tick cost while the Skin-Stealer repeatedly asks for a covert way that does not exist (k=6 of cover_churn.js)
'use strict';
const path = require('path'), ROOT = process.argv[2];
const { World, geo, bystander } = require(path.join(ROOT, 'dev', 'tests', 'lib.js'));
const G = geo(); const pairs = [];
for (const a of G.lit) { if (!G.w.ad.clear(a.x, a.y, 24, 'walk')) continue;
  for (const b of G.dark) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 420 && d < 650 && G.g.los(a.x, a.y, b.x, b.y) && G.w.ad.clear(b.x, b.y, 26, 'walk')) { pairs.push([a, b]); break; } }
  if (pairs.length > 40) break; }
const n = +(process.argv[3] || 1);
const [a, b] = pairs[30];
const w = World(406); bystander(w);
const p = w.player(a.x, a.y, { light: true, angle: Math.atan2(a.y - b.y, a.x - b.x) }); p.stop('stand');
const es = [];
for (let i = 0; i < n; i++) { const e = w.eng.spawn('skinstealer', b.x + i * 6, b.y, { hunger: .45 }); e.tier = 'near'; e.ang = Math.atan2(a.y - b.y, a.x - b.x); es.push(e); }
let last = process.hrtime.bigint(); const dts = [];
w.run(10, () => { const now = process.hrtime.bigint(); dts.push(Number(now - last) / 1e6); last = now; return true; });
dts.sort((x, y) => x - y);
console.log(JSON.stringify({ n, coverQ: es.map(e => e.tally.coverQ || 0), plans: es.map(e => e.plan && e.plan.k), p50: dts[dts.length >> 1].toFixed(2), p99: dts[Math.floor(dts.length * .99)].toFixed(2), max: dts[dts.length - 1].toFixed(2), total: dts.reduce((s, x) => s + x, 0).toFixed(0) }));
