'use strict';
const path = require('path'), ROOT = process.argv[2];
const { World, geo, bystander } = require(path.join(ROOT, 'dev', 'tests', 'lib.js'));
const G = geo(); const pairs = [];
for (const a of G.lit) { if (!G.w.ad.clear(a.x, a.y, 24, 'walk')) continue;
  for (const b of G.dark) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 420 && d < 650 && G.g.los(a.x, a.y, b.x, b.y) && G.w.ad.clear(b.x, b.y, 26, 'walk')) { pairs.push([a, b]); break; } }
  if (pairs.length > 40) break; }
// warm up the JIT on another world first
{ const [a, b] = pairs[5]; const w = World(7); bystander(w); const p = w.player(a.x, a.y, { light: true }); p.stop('stand'); const e = w.eng.spawn('skinstealer', b.x, b.y, { hunger: .45 }); e.tier = 'near'; w.run(6, () => true); }
const [a, b] = pairs[30];
const w = World(406); bystander(w);
const p = w.player(a.x, a.y, { light: true, angle: Math.atan2(a.y - b.y, a.x - b.x) }); p.stop('stand');
const e = w.eng.spawn('skinstealer', b.x, b.y, { hunger: .45 }); e.tier = 'near'; e.ang = Math.atan2(a.y - b.y, a.x - b.x);
let last = process.hrtime.bigint(), q0 = 0; const withQ = [], without = [];
w.run(10, (ww, t) => { const now = process.hrtime.bigint(), dt = Number(now - last) / 1e6; last = now; const q = e.tally.coverQ || 0; (q > q0 ? withQ : without).push([dt, q - q0, +t.toFixed(2), e.plan && e.plan.k]); q0 = q; return true; });
const s = a2 => a2.map(x => x[0]).sort((x, y) => x - y);
const W = s(withQ), O = s(without);
console.log('ticks with a covert search:', W.length, 'searches', withQ.reduce((n, x) => n + x[1], 0), 'median ms', W[W.length >> 1]?.toFixed(2), 'max', W[W.length - 1]?.toFixed(2));
console.log('ticks without:', O.length, 'median ms', O[O.length >> 1].toFixed(3), 'p99', O[Math.floor(O.length * .99)].toFixed(2));
console.log('first/last search at t =', withQ[0] && withQ[0][2], withQ.length && withQ[withQ.length - 1][2], 'plans during:', [...new Set(withQ.map(x => x[3]))].join(','));
console.log('slowest:', JSON.stringify(withQ.slice().sort((x,y)=>y[0]-x[0]).slice(0,6).map(x=>[+x[0].toFixed(1),x[2]])));console.log('cover why:', e.dbg.cover && e.dbg.cover.why);
