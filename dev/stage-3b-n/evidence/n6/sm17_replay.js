const root = process.argv[2]; const { World, dist } = require(root + '/dev/tests/lib.js');
const w = World(5 + 1000); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
const p = w.player(6072, 3816, { light: false }); p.stop('stand'); const s = w.smiler(6360, 3384); s.ang = Math.atan2(3816 - 3384, 6072 - 6360); p.look = () => Math.atan2(s.y - p.y, s.x - p.x);
if (w.until(6, () => /hold|creep|drift/.test(s.act)) < 0) { console.log('skip'); process.exit(); }
let struck = null, k = 0;
w.run(30, (ww, t) => { const d = dist(s, p), ux = (s.x - p.x) / d, uy = (s.y - p.y) / d;
  if (k++ % 240 === 0) { const sd = (k / 240) % 2 ? 1 : -1; p.go(p.x - uy * 40 * sd, p.y + ux * 40 * sd, 'crouch'); }
  if (s.state === 'ATTACKING' && !struck) struck = { t: +t.toFixed(1), d: Math.round(d), why: s.dbg.why }; if (p.dead || struck) return false; }, 1);
console.log(JSON.stringify(struck));
