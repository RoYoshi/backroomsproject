/* C7 re-check of F4: C22's measure (longest continuous stretch standing still in the watcher's view; total time in view) at hungers C22
 * does not cover, and in two other spots (the lit hall at 300 px; the dark south-west).  Usage: node exp_stare3.js <lib.js> */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, DT } = require(LIB);
const SCENES = { hall450: { p: [5000, LONG.y], k: [5450, LONG.y] }, hall300: { p: [5150, LONG.y], k: [5450, LONG.y] }, sw: { p: [700, 5330], k: [1300, 5330] } };
for (const [name, S] of Object.entries(SCENES)) for (const h of [.45, .5, .6, .62, .65, .7]) {
  const rows = [];
  for (let seed = 1; seed <= 6; seed++) {
    const w = World(seed + 31000 + Math.round(h * 100)); bystander(w, name === 'sw' ? 5000 : 1300, name === 'sw' ? LONG.y : 3300);
    const p = w.player(S.p[0], S.p[1], { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', S.k[0], S.k[1], { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    let run = 0, longest = 0, inView = 0, end = '';
    w.run(120, (ww, t) => {
      const d = Math.hypot(p.x - e.x, p.y - e.y), vis = w.eng.geo.los(p.x, p.y, e.x, e.y) && d < 900, still = vis && e.speed < 15 && !e.pounce;
      run = still ? run + DT : 0; longest = Math.max(longest, run); if (vis && !w.kills.length) inView += DT;
      if (!end && (w.kills.length || (e.plan && e.plan.k === 'leave'))) end = (w.kills.length ? 'kill' : 'leave') + '@' + t.toFixed(0);
      return !w.kills.length; });
    rows.push(`${longest.toFixed(1)}/${inView.toFixed(0)}/${end || '-'}`);
  }
  console.log(`${name} h=${h}: longest still / in view s / end: ${rows.join('  ')}`);
}
