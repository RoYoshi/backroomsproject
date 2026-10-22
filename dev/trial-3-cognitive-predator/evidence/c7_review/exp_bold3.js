/* C7 re-check of F3: after a passed-over person is let go out of view, can they still be killed by another path (an anonymous sound ->
 * listen -> search -> re-sighting -> a grab or a spring)?  C21's passer scene but 60 s, plus a "crossing back" variant (the passer
 * walks east past it, then back west).  Kills are split: while the draw still says "pass over" at the creature's current hunger, or
 * after its hunger rose past the draw.  Usage: node exp_bold3.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, AI } = require(LIB);
const SK = AI.SK, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const chance = h => SK.boldAt[0] + (1 - SK.boldAt[0]) * sm(SK.boldAt[1], SK.boldAt[2], h);
for (const variant of ['oneway', 'back']) {
  let passed = 0, killedPassed = 0, killedRequal = 0, huntPassed = 0; const how = new Map(), plansAfter = new Map();
  for (const H of [.42, .45, .48]) for (let seed = 1; seed <= 24; seed++) {
    const w = World(seed + 24000 + Math.round(H * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(4700, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: H }); e.tier = 'near'; e.ang = Math.PI / 2;
    let draw = null, pass = null, letGo = -1, style = "", hp = false;
    w.run(60, (ww, t) => {
      if (t > .5 && !p.leg) { p.leg = 1; p.go(6500, y, 'walk'); }
      if (variant === 'back' && p.leg === 1 && p.tx === null && t > 3) { p.leg = 2; p.go(4400, y, 'walk'); }
      if (draw === null && e.enc && e.enc.pid === p.id && e.enc.bold !== undefined) { draw = e.enc.bold; pass = !(draw < chance(e.hunger)) && !e.hunt; }
      if (pass && letGo < 0 && /had let them be/.test(e.dbg.why || '')) letGo = t;
      if (pass && letGo >= 0 && e.plan) plansAfter.set(e.plan.k + (e.plan.pid ? '(named)' : '(anon)'), (plansAfter.get(e.plan.k + (e.plan.pid ? '(named)' : '(anon)')) || 0) + 1 / 60);
      if (pass && e.hunt && e.hunt.pid === p.id && draw >= chance(e.hunger) && !hp) { huntPassed++; hp = true; }
      if (e.pounce && !style) style = e.pounce.style;
      return !w.kills.length; });
    if (!pass) continue;
    passed++;
    if (w.kills.length) { if (draw >= chance(e.hunger)) { killedPassed++; how.set(style, (how.get(style) || 0) + 1); } else killedRequal++; }
  }
  console.log(`${variant}: passed over ${passed}; hunted while the draw still said pass ${huntPassed}; killed while the draw still said pass ${killedPassed} (${[...how].map(([k, n]) => k + ' x' + n).join(', ') || '-'}); killed after hunger rose past the draw ${killedRequal}; plans after the let-go: ${[...plansAfter].filter(([, v]) => v > .5).map(([k, v]) => k + ' ' + v.toFixed(0) + 's').join(', ')}`);
}
