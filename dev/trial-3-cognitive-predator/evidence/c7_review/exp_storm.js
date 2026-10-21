/* C7 review: route-search storms.  The new 'stand' executor (closing in on an opening; pressing under their eyes) searches a route when
 * no straight line is clear, "at most once a second - or whenever it has no route" (skAct 'stand').  A failed search leaves no route, so
 * the next think searches again.  Probe: watcher positions it can SEE but not walk straight to (geo.los true, lineClear 'walk' false),
 * 250-700 px off, the creature very hungry (.75, so it also presses under their eyes) and the watcher looking away 2.5 s every 5 s.
 * Counts every geo.path the species makes (s_skincognitive.js's routeCount), per second, worst second.  Usage: node exp_storm.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, AI, geo, bystander } = require(LIB);
function routeCount() {
  const tk = AI.SKIN.tick, G = new Map(); let inSk = 0;
  const C = { n: 0, fail: 0, undo() { AI.SKIN.tick = tk; for (const [g, p0] of G) g.path = p0; } };
  AI.SKIN.tick = function (eng, ...a) {
    const g = eng.geo; if (!G.has(g)) { const p0 = g.path; G.set(g, p0); g.path = function (...b) { if (inSk) C.n++; const r = p0.apply(this, b); if (inSk && !r) C.fail++; return r; }; }
    inSk++; try { return tk.call(this, eng, ...a); } finally { inSk--; } };
  return C;
}
const G = geo(), g0 = G.g, ad = G.w.ad;
let rnd = 12345; const R = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pairs = [];
for (let tries = 0; tries < 200000 && pairs.length < 24; tries++) {
  const a = G.cells[Math.floor(R() * G.cells.length)], b = G.cells[Math.floor(R() * G.cells.length)];
  const ax = g0.cx(a), ay = g0.cy(a), bx = g0.cx(b), by = g0.cy(b), d = Math.hypot(ax - bx, ay - by);
  if (d < 250 || d > 700 || !ad.clear(ax, ay, 26, 'walk') || !ad.clear(bx, by, 22, 'walk')) continue;
  if (!g0.los(ax, ay, bx, by) || g0.lineClear(ax, ay, bx, by, 20, 'walk')) continue;
  pairs.push({ k: { x: ax, y: ay }, p: { x: bx, y: by }, d: Math.round(d) });
}
let worstAll = 0; const rows = [];
for (const [i, P] of pairs.entries()) {
  const w = World(30000 + i); bystander(w, P.p.x, P.p.y);
  const p = w.player(P.p.x, P.p.y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', P.k.x, P.k.y, { hunger: .75 }); e.tier = 'near'; e.ang = Math.atan2(P.p.y - P.k.y, P.p.x - P.k.x);
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + (w.t > 3 && (w.t - 3) % 5 < 2.5 ? Math.PI : 0);
  const C = routeCount(); const per = []; let last = 0, lastT = 0, standT = 0;
  try { w.run(20, (ww, t) => { if (e.plan && e.plan.k === 'stand') standT += 1 / 60; if (t - lastT >= 1) { per.push(C.n - last); last = C.n; lastT = t; } return !w.kills.length; }); } finally { C.undo(); }
  const worst = Math.max(0, ...per); worstAll = Math.max(worstAll, worst);
  rows.push(`pair ${i} (${P.d} px): routes ${C.n} (failed ${C.fail}) in ${per.length} s, worst second ${worst}; in stand ${standT.toFixed(1)} s; kills ${w.kills.length}`);
}
console.log(rows.join('\n') + `\nworst second over all pairs: ${worstAll}`);
