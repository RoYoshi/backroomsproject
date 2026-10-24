/* dev/trial-3-r19-positioning/tools/s6_server.js - Trial 3 R19, S track: the owner's threat scene S6 (hiding behind a wall, R18's
 * r16g_campaign.js) on the server simulation, seeded, on any tree - the person lit at (5200, 3480) looking at a Skin-Stealer at .7 by
 * (5850, 3504); after 1.3 s the torch off, a run to (5100, 3450), a walk behind the wall to (5150, 3350), a crouch.  The real page's
 * single tries of S6 fail on every tree now and then (the page moves a frame at a time); this is the same scene without the page.
 *   node dev/trial-3-r19-positioning/tools/s6_server.js TREE      (development tool; Trial 3 is not owner-approved) */
const path = require('path'), DIR = process.argv[2];
const { World } = require(path.join(DIR, 'dev/tests/lib.js'));
let tot = { leave: 0, found: 0, toLS: [] };
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
  const w = World(seed + 6100); const p = w.player(5200, 3480, { light: true }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5850, 3504, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  let ph = 0, last = '', lastSeen = -1, atLS = -1, lsx = 0, lsy = 0; const log = [];
  w.run(13, (ww, t) => {
    if (ph === 0 && t > 1.3) { ph = 1; p.light = false; p.look = null; p.go(5100, 3450, 'run'); }
    if (ph === 1 && Math.hypot(p.x - 5100, p.y - 3450) < 25) { ph = 2; p.go(5150, 3350, 'walk'); }
    if (ph === 2 && Math.hypot(p.x - 5150, p.y - 3350) < 25) { ph = 3; p.stop('crouch'); }
    if (e.seenNow && e.seenNow.has(p.id)) { lastSeen = t; lsx = p.x; lsy = p.y; atLS = -1; }
    if (lastSeen >= 0 && atLS < 0 && t > lastSeen && Math.hypot(e.x - 5200, e.y - 3480) < 220) atLS = t;
    const k = e.plan ? e.plan.k : 'roam'; if (k !== last) { log.push(`${t.toFixed(1)} ${k}${e.dbg.pos && Math.abs(e.dbg.pos.at - w.eng.now) < .02 ? '[' + e.dbg.pos.k + ']' : ''}`); last = k; }
    return !p.dead; });
  const plans = log.join(' > '), left = /leave/.test(plans);
  tot.leave += left ? 1 : 0; tot.found += p.dead ? 1 : 0;
  console.log(path.basename(DIR), seed, 'lost at', lastSeen.toFixed(1), 'at the place', atLS >= 0 ? (atLS - lastSeen).toFixed(1) : '-', p.dead ? 'KILLED' : '', '|', plans.slice(0, 170), '|', (e.dbg.why || '').slice(0, 80));
}
console.log(path.basename(DIR), JSON.stringify(tot));
