/* C7 review: is C4's once-per-encounter "boldness" draw (SK.boldAt) actually what decides whether a hungry (.4-.55) creature goes for a
 * person?  Trace C12's passer scene: the draw, whether it was "engaged" by it, and every plan change with its reason.
 * Usage: node exp_bold.js <lib.js> [hunger] */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js', H = +(process.argv[3] || .45);
const { World, LONG, bystander, AI } = require(LIB);
const SK = AI.SK, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
for (let seed = 1; seed <= 8; seed++) {
  const w = World(seed + 14000 + Math.round(H * 100)), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(4700, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
  const e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: H }); e.tier = 'near'; e.ang = Math.PI / 2;
  let last = '', log = [], bold = null, firstSeen = -1, firstHunt = null;
  w.run(25, (ww, t) => {
    if (p.leg === undefined && t > .5) { p.leg = 1; p.go(6500, y, 'walk'); }
    if (firstSeen < 0 && e.seenNow.has(p.id)) firstSeen = +t.toFixed(2);
    if (e.enc && e.enc.bold !== undefined && bold === null) bold = +e.enc.bold.toFixed(3);
    if (e.hunt && !firstHunt) firstHunt = { t: +t.toFixed(2), plan: e.plan ? e.plan.k : '-', why: e.plan ? e.plan.why : '' };
    const k = (e.plan ? e.plan.k : '-') + (e.hunt ? '*' : '');
    if (k !== last) { log.push(`${t.toFixed(2)} ${k} ${e.plan ? '"' + (e.plan.why || '').slice(0, 70) + '"' : ''}`); last = k; }
    return !w.kills.length; });
  const thr = SK.boldAt ? SK.boldAt[0] + (1 - SK.boldAt[0]) * sm(SK.boldAt[1], SK.boldAt[2], H) : null;
  console.log(`seed ${seed}: first seen ${firstSeen}s; bold draw ${bold} vs chance ${thr && thr.toFixed(3)} -> ${bold !== null && thr !== null ? (bold < thr ? 'ENGAGED by the draw' : 'PASSED OVER by the draw') : 'n/a'}; hunt begun ${firstHunt ? firstHunt.t + 's in ' + firstHunt.plan + ' ("' + firstHunt.why.slice(0, 80) + '")' : 'never'}; killed ${w.kills.length}`);
  console.log('   ' + log.slice(0, 14).join('\n   '));
}
