/* C7 review: does a seen person's exact stamina number (not their motion, posture or any sound) change what it decides?  Two worlds
 * identical except the person's stamina (15 vs 100; neither exhausted, so the same body, speed and state on the wire).  The person stands
 * still facing away 330 px off in the lit hall, then walks slowly away.  Usage: node exp_stamina.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander } = require(LIB);
for (const h of [.45, .5, .55, .65]) {
  const rows = [];
  for (let seed = 1; seed <= 6; seed++) {
    const one = st => {
      const w = World(seed + 26000 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
      const p = w.player(5120, y, { light: true, angle: Math.PI }); p.stop('stand'); p.look = Math.PI; p.stamina = st;
      const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
      const seq = []; let last = '', firstWhy = '', breath = 0;
      w.run(6, (ww, t) => {
        if (t > 2 && !p.leg) { p.leg = 1; p.go(3400, y, 'crouch'); }
        const k = e.plan ? e.plan.k : '-'; if (k !== last) { seq.push(`${t.toFixed(2)} ${k}${e.plan && e.plan.why ? ' "' + e.plan.why.slice(0, 40) + '"' : ''}`); last = k; }
        if (e.mem.sounds.some(s => s.type === 'breath')) breath = 1;
        return !w.kills.length; });
      return { seq, kills: w.kills.length, breath };
    };
    const A = one(15), B = one(100);
    const same = A.seq.join('|') === B.seq.join('|');
    rows.push(`  s${seed}: ${same ? 'same' : 'DIFFERENT'} | stamina 15: ${A.seq.slice(0, 4).join(' > ')} (kills ${A.kills}, breath heard ${A.breath}) | stamina 100: ${B.seq.slice(0, 4).join(' > ')} (kills ${B.kills}, breath heard ${B.breath})`);
  }
  console.log(`h=${h}\n${rows.join('\n')}`);
}
