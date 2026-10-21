/* C7 review: the dodge where the new build actually kills - C02's look-away scene (.5/.55/.62: away 6-8.5 s, then facing it again).
 * At the wind-up the person (now facing it or not) steps aside after `delay` s.  Spring distance and escapes.  Usage: node exp_dodge2.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, over } = require(LIB);
const AW = t => t > 6 && (t - 6) % 8 < 2.5;
for (const delay of [0, .15, .25, .35, 99]) {
  const all = [];
  for (const h of [.5, .55, .62]) over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 12000 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + (AW(w.t) ? Math.PI : 0);
    let S = null, t0 = -1, moved = false, res = null, d0 = 0, facing = null;
    w.run(30, (ww, t) => {
      if (e.pounce && !S) { S = e.pounce; t0 = t; d0 = Math.round(Math.hypot(p.x - e.x, p.y - e.y)); facing = !AW(t); }
      if (S && !moved && t - t0 >= delay - 1e-9) { moved = true; const a = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2; p.look = null; p.go(p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 'run'); }
      if (S && e.pounce !== S && res === null) res = !w.kills.length;
      return res === null; });
    if (S) all.push({ d0, facing, esc: res, style: S.style });
    return {};
  });
  const f = all.filter(r => r.facing), b = all.filter(r => !r.facing);
  console.log(`delay ${delay}: ${all.length} springs (styles ${[...new Set(all.map(r => r.style))].join(',')}); spring distance p50 ${all.map(r => r.d0).sort((a, b) => a - b)[Math.floor(all.length / 2)]} (min ${Math.min(...all.map(r => r.d0))}); escaped ${all.filter(r => r.esc).length}/${all.length} - while facing it ${f.filter(r => r.esc).length}/${f.length}, back turned ${b.filter(r => r.esc).length}/${b.length}`);
}
