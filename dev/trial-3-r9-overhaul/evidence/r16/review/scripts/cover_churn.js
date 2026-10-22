// Repro: how many covert-way searches (A*) a Skin-Stealer runs when it wants to approach an unaware player in a lit spot but no covert
// spot near them exists. Usage: node cover_churn.js <export-root>
'use strict';
const path = require('path');
const ROOT = process.argv[2];
const L = require(path.join(ROOT, 'dev', 'tests', 'lib.js'));
const { World, geo, bystander } = L;
const G = geo();
const pairs = [];
for (const a of G.lit) { if (!G.w.ad.clear(a.x, a.y, 24, 'walk')) continue;
  for (const b of G.dark) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 420 && d < 650 && G.g.los(a.x, a.y, b.x, b.y) && G.w.ad.clear(b.x, b.y, 26, 'walk')) { pairs.push([a, b]); break; } }
  if (pairs.length > 40) break; }
console.log('pairs', pairs.length);
const out = [];
for (const h of [.45, .55, .7]) {
  for (let k = 0; k < 8; k++) {
    const [a, b] = pairs[(k * 5) % pairs.length];
    const w = World(400 + k); bystander(w);
    const ang = Math.atan2(a.y - b.y, a.x - b.x);           // player faces away from the creature
    const p = w.player(a.x, a.y, { light: process.env.LIGHT !== '0', angle: ang }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', b.x, b.y, { hunger: h }); e.tier = 'near'; e.ang = Math.atan2(a.y - b.y, a.x - b.x);
    const t0 = process.hrtime.bigint(); const plans = new Map(); let thinks = 0;
    w.run(10, () => { const k2 = e.plan ? e.plan.k + (e.plan.mode ? ':' + e.plan.mode : '') : '-'; plans.set(k2, (plans.get(k2) || 0) + 1); return true; });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    out.push({ h, k, d: Math.round(Math.hypot(a.x - b.x, a.y - b.y)), coverQ: e.tally.coverQ || 0, noFlank: e.tally.noFlank, plans: [...plans].map(([k3, n]) => k3 + ' ' + (n / 60).toFixed(1) + 's').join(', '), ms: Math.round(ms), kills: w.kills.length, cover: e.dbg.cover && e.dbg.cover.why });
  }
}
for (const o of out) console.log(JSON.stringify(o));
