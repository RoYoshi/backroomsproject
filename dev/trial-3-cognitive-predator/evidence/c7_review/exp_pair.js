/* C7 review: paired invisible worlds over the NEW tactics.  Two worlds identical except where an unsensed person B is (crouched, still,
 * unlit, in the dark), while the creature runs C02's stand-off with look-aways (stand / opening / press) or C06's pillar circler (cut).
 * The creature's trace (position, facing, head, plan, target, its QA record length) must be identical tick for tick as long as B is never
 * in its records.  Usage: node exp_pair.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, floorNear } = require(LIB);
const PILLAR = { x: 4952, y: 3584, R: 175 };
const ring = (dir, laps) => { const out = []; for (let l = 0; l < laps; l++) for (let k = 0; k < 16; k++) { const a = dir * k / 16 * Math.PI * 2; out.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); } return out; };
const B_AT = [{ x: 5928, y: 2712 }, { x: 6360, y: 3096 }, { x: 6100, y: 2900 }];
function one(scene, seed, h, bAt) {
  const w = World(seed + 21000 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
  let p, e;
  if (scene === 'stand') {
    p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
    e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    const AW = t => t > 6 && (t - 6) % 8 < 2.5; p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + (AW(w.t) ? Math.PI : 0);
  } else {
    p = w.player(PILLAR.x + PILLAR.R, PILLAR.y, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
    e = w.eng.spawn('skinstealer', 5700, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  }
  const f = floorNear(w, bAt.x, bAt.y), b = w.player(f.x, f.y, { light: false, angle: 0 }); b.stop('crouch');
  const tr = [], plans = new Set();
  w.run(25, (ww, t) => {
    if (scene === 'cut' && t > .3 && !p.leg) { p.leg = 1; p.route(ring(-1, 14), 'run'); }
    tr.push([Math.round(e.x * 100), Math.round(e.y * 100), Math.round(e.ang * 1e4), Math.round((e.head || 0) * 1e4), e.plan ? e.plan.k : '-', e.target || 0, e.cog ? e.cog.n : 0, e.hunt ? e.hunt.pid : 0].join(','));
    if (e.plan) plans.add(e.plan.k);
    return true; });
  return { tr, sensedB: e.mem.p.has(b.id), plans: [...plans].join('+'), kills: w.kills.length, b: { x: Math.round(f.x), y: Math.round(f.y) } };
}
for (const scene of ['stand', 'cut']) for (const h of [.55, .7, .9]) {
  const res = [];
  for (let seed = 1; seed <= 4; seed++) {
    const R = B_AT.map(q => one(scene, seed, h, q));
    if (R.some(r => r.sensedB)) { res.push(`s${seed}: B sensed in some world (not comparable)`); continue; }
    let k = 0; const A = R[0].tr; let same = true, first = -1;
    for (const r of R.slice(1)) { let j = 0; while (j < A.length && A[j] === r.tr[j]) j++; if (j < A.length) { same = false; first = first < 0 ? j : Math.min(first, j); } }
    res.push(`s${seed}: ${same ? 'IDENTICAL' : 'DIVERGED at tick ' + first} (${A.length} ticks; plans ${R[0].plans}; kills ${R[0].kills})`);
  }
  console.log(`${scene} h=${h}: ${res.join(' | ')}`);
}
