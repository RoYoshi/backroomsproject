/* dev/trial-3-nani-corners/tools/s5_server.js - Trial 3 R19 (the owner's "never weaker"): the owner's threat scene S5 (reversing,
 * R18's r16g_campaign.js) on the server simulation, seeded, on any tree: node s5_server.js TREE [seeds 24].  The real page's single tries
 * of S5 failed on N and passed on R18; here, without the page's frame-limited timing: */
// a lit person runs round a hungry (.9) Skin-Stealer at 280 px, steered
// every 50 ms as the page's own circling is, and reverses after 2.2 s; its answer judged as r16g_campaign.js judges it (a sideways step the
// new way, or a spring, within 50-1200 ms; a kill within 0.3 s of the reversal counts)
const path = require('path'), DIR = process.argv[2], LONG = 3504;
const { World } = require(path.join(DIR, 'dev/tests/lib.js'));
const res = []; let drops = 0;
for (let seed = 1; seed <= +(process.argv[3] || 24); seed++) {
  const w = World(seed + 7700); const p = w.player(5240, LONG, { light: true }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5000, LONG, { hunger: .9 }); e.tier = 'near'; e.ang = 0;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  let dir = 1, flipT = null, next = 0; const tr = [];
  w.run(9, (ww, t) => {
    if (t >= next) { next += .05; const a = Math.atan2(p.y - e.y, p.x - e.x), tx = e.x + Math.cos(a + dir * .5) * 280, ty = e.y + Math.sin(a + dir * .5) * 280; p.go(tx, ty, 'run'); tr.push([t, e.x, e.y, e.ang, e.act === 'strike' || !!e.pounce]); }
    if (flipT === null && t > 2.2) { dir = -1; flipT = t; }
    return !p.dead; });
  drops += (e.nav && e.nav.passed) || 0;
  const i0 = tr.findIndex(s => s[0] >= flipT); let s0 = 0, ans = null;
  for (let i = Math.max(1, i0 - 20); i < i0; i++) { const s = tr[i], q = tr[i - 1]; s0 += Math.sign(-((s[1] - q[1]) * Math.sin(s[3])) + (s[2] - q[2]) * Math.cos(s[3])); }
  const sg = Math.sign(s0);
  for (let i = i0 + 1; i0 > 0 && i < tr.length && i < i0 + 30; i++) { const s = tr[i], q = tr[i - 1], l = -((s[1] - q[1]) * Math.sin(s[3])) + (s[2] - q[2]) * Math.cos(s[3]);
    if (s[4] && !q[4]) { ans = (i - i0) * 50; break; } if (Math.sign(l) === -sg && Math.abs(l / .05) > 30) { ans = (i - i0) * 50; break; } }
  const ok = ans !== null && ans >= 50 && ans <= 1200;
  res.push({ seed, ans, ok, dead: p.dead });
}
console.log(path.basename(DIR), 'answered within 1.2 s', res.filter(r => r.ok).length + '/' + res.length, 'answers', res.map(r => r.ans === null ? '-' : r.ans).join(' '), 'killed', res.filter(r => r.dead).length, 'drops', drops);
