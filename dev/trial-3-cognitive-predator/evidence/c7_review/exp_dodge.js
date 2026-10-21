/* C7 review: does a watcher's step aside at the tell still work with a human reaction delay?
 * C11's dodge reacts on the very tick the wind-up starts (0 ms).  Same scene as C11 (watched(seed+15400, h, null)), the player runs
 * 0.6 s sideways 170 px starting `delay` s after e.pounce first appears.  Usage: node exp_dodge.js <lib.js path> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, over } = require(LIB);
function watched(seed, h) {
  const w = World(seed), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  return { w, p, e };
}
const out = {};
for (const h of [.8, .95]) for (const delay of (process.env.DELAYS ? process.env.DELAYS.split(",").map(Number) : [0, .1, .2, .25, .3, .4])) {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], seed => {
    const { w, p, e } = watched(seed + 15400, h); let S = null, t0 = -1, res = null, moved = false, dAtSpring = 0;
    w.run(30, (ww, t) => {
      if (e.pounce && !S) { S = e.pounce; t0 = t; dAtSpring = Math.round(Math.hypot(p.x - e.x, p.y - e.y)); }
      if (S && !moved && t - t0 >= delay - 1e-9) { moved = true; const a = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2; p.look = null; p.go(p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 'run'); }
      if (S && e.pounce !== S && res === null) res = !w.kills.length;
      return res === null; });
    return { sprang: !!S, escaped: res, d: dAtSpring, style: S ? S.style : '' };
  });
  const sp = rs.filter(r => r.sprang);
  out[`h${h} delay${delay}`] = `${sp.filter(r => r.escaped).length}/${sp.length} escaped (spring distances ${sp.map(r => r.d).join('/')}; styles ${[...new Set(sp.map(r => r.style))].join(',')})`;
}
console.log(JSON.stringify(out, null, 1));
