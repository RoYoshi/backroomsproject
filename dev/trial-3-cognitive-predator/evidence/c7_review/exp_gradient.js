/* C7 review: C12's two everyday scenes, kill rates SPLIT by scene (C12 reports them pooled), plus a third scene: an unaware passer-by
 * walking the hall farther off (800 px lane, never facing it).  Same seeds/geometry as C12 for 'passer' and 'watch'.
 * Usage: node exp_gradient.js <lib.js path> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander } = require(LIB);
const HUNT = new Set(['stand', 'approach', 'flank', 'chase', 'cut', 'lure', 'retreat', 'intercept', 'search']);
const one = (kind, seed, h) => {
  const w = World(seed + 14000 + Math.round(h * 100) + (kind === 'watch' ? 500 : kind === 'far' ? 900 : 0)), y = LONG.y; bystander(w, 1300, 3300);
  let p, e;
  if (kind === 'passer') { p = w.player(4700, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0; e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: h }); e.tier = 'near'; e.ang = Math.PI / 2; }
  else if (kind === 'far') { p = w.player(4300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0; e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: h }); e.tier = 'near'; e.ang = Math.PI / 2; }
  else { p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand'); e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; const AW = t => t > 6 && (t - 6) % 9 < 1.5; p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + (AW(w.t) ? Math.PI : 0); }
  let seen = -1, hunted = false, killAt = -1;
  w.run(25, (ww, t) => {
    if ((kind === 'passer' || kind === 'far') && t > .5 && !p.leg) { p.leg = 1; p.go(kind === 'far' ? 7600 : 6500, y, 'walk'); }
    if (seen < 0 && e.seenNow.has(p.id)) seen = t;
    const P = e.plan; if (P && P.pid === p.id && HUNT.has(P.k)) hunted = true;
    if (killAt < 0 && w.kills.length) killAt = t; return true; });
  return { kind, h, seen: seen >= 0, hunted, killed: killAt >= 0 };
};
const HS = (process.env.HS || '.3,.4,.45,.5,.55,.6,.65').split(',').map(Number), KINDS = (process.env.KINDS || 'passer,watch,far').split(',');
const rows = [];
for (const kind of KINDS) for (const h of HS) { let n = 0, hu = 0, k = 0; for (let s = 1; s <= 8; s++) { const r = one(kind, s, h); if (!r.seen) continue; n++; if (r.hunted) hu++; if (r.killed) k++; } rows.push(`${kind} h=${h}: seen ${n}/8, went for them ${hu}/${n}, killed ${k}/${n}`); }
console.log(rows.join('\n'));
