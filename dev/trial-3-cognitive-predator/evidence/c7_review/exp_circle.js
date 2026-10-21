/* C7 review: the circling inference after a contradiction that is not a reversal.  C06's pillar scene (the creature farther off, 5700,
 * as C06's turn-back runs), the person runs round the pillar; as soon as the creature first takes them for going round (e.circ set), they
 * STOP on the ring and stand still (variant 'stop'), or step off the ring and walk away in a straight line (variant 'leave').  How long does
 * e.circ stay set while it watches them standing / walking straight, and how many cut-offs does it begin after the contradiction?
 * Usage: node exp_circle.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander } = require(LIB);
const PILLAR = { x: 4952, y: 3584, R: 175 };
const ring = (dir, laps) => { const out = []; for (let l = 0; l < laps; l++) for (let k = 0; k < 16; k++) { const a = dir * k / 16 * Math.PI * 2; out.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); } return out; };
for (const variant of ['stop', 'leave']) for (const h of [.55, .75]) for (let seed = 1; seed <= 6; seed++) {
  const w = World(seed + 13200 + Math.round(h * 100) + 50); bystander(w, 1300, 3300);
  const p = w.player(PILLAR.x + PILLAR.R, PILLAR.y, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5700, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  let stopAt = -1, circAfter = 0, seenAfter = 0, cutsAfter = 0, lastPlan = null, killAt = -1, cutP = null, waitAtCut = 0, killD = -1;
  w.run(25, (ww, t) => {
    if (t > .3 && !p.leg) { p.leg = 1; p.route(ring(-1, 14), 'run'); }
    if (stopAt < 0 && e.circ) { stopAt = t; if (variant === 'stop') { p.stop('stand'); p.look = Math.atan2(p.y - PILLAR.y, p.x - PILLAR.x); } else { p.look = null; p.go(3100, LONG.y - 120, 'walk'); } }
    if (stopAt >= 0 && !w.kills.length) {
      if (e.seenNow.has(p.id)) seenAfter += 1 / 60;
      if (e.circ && e.circ.pid === p.id && e.seenNow.has(p.id)) circAfter += 1 / 60;
      if (e.plan && e.plan.k === 'cut' && e.plan !== lastPlan && e.plan.t0 > stopAt + .05) cutsAfter++;
      if (e.plan && e.plan.k === 'cut' && e.plan.arrived && e.seenNow.has(p.id)) waitAtCut += 1 / 60;
    }
    if (e.plan) lastPlan = e.plan;
    if (killAt < 0 && w.kills.length) { killAt = t; }
    return !w.kills.length; });
  console.log(`${variant} h=${h} seed ${seed}: took them for circling at ${stopAt.toFixed(1)} s; after the contradiction, seen ${seenAfter.toFixed(1)} s, still believed circling while seeing them ${circAfter.toFixed(1)} s; new cut-offs begun ${cutsAfter}; crouched waiting at a cut point while they were in view ${waitAtCut.toFixed(1)} s; killed at ${killAt.toFixed(1)}`);
}
