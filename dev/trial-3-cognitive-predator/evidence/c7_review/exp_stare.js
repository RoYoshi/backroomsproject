/* C7 review: C17's scene (lit hall, a watcher 450 px off who never looks away and never moves), 120 s: what does it look like from the
 * player's chair?  Time it spends standing still in their view, distance over time, plan segments, how it ends.
 * Usage: node exp_stare.js <lib.js> [hungers] */
'use strict';
const LIB = process.argv[2] || '<this repository>/dev/tests/lib.js';
const { World, LONG, bystander, DT } = require(LIB);
const HS = (process.argv[3] || '.5,.55').split(',').map(Number);
for (const h of HS) for (let seed = 1; seed <= 6; seed++) {
  const w = World(seed + 15800 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  let still = 0, inView = 0, segs = [], last = '', dmin = 1e9, endAt = -1, end = '', samples = [];
  w.run(120, (ww, t) => {
    const d = Math.hypot(p.x - e.x, p.y - e.y), vis = w.eng.geo.los(p.x, p.y, e.x, e.y) && d < 900;
    if (vis && !w.kills.length) { inView += DT; if (e.speed < 15 && !e.pounce) still += DT; }
    dmin = Math.min(dmin, d);
    const k = e.plan ? e.plan.k : (e.hunt ? 'hunt' : 'roam');
    if (k !== last) { segs.push(`${t.toFixed(1)}:${k}`); last = k; }
    if (Math.abs(t % 10) < DT) samples.push(Math.round(d));
    if (endAt < 0 && (w.kills.length || k === 'leave')) { endAt = t; end = w.kills.length ? 'KILL' : 'leave'; }
    return !w.kills.length; });
  console.log(`h=${h} seed ${seed}: ${end || 'still there'} at ${endAt.toFixed(1)} s | in their view ${inView.toFixed(1)} s, of which standing still ${still.toFixed(1)} s (${(still / Math.max(1, inView) * 100).toFixed(0)} %) | distance every 10 s ${samples.join(' ')} | closest ${Math.round(dmin)} | ${segs.length} plan segments: ${segs.slice(0, 12).join(' ')}${segs.length > 12 ? ' ...' : ''}`);
}
