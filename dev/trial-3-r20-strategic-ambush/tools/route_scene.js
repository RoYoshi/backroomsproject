// dev/trial-3-r20-strategic-ambush/tools/route_scene.js - Trial 3 R20, S track: a person on a long route past a hidden, hungry Skin-Stealer (walk/run; LIGHT=0 for no torch), per run: staged or not, caught.  node route_scene.js TREE N HUNGER walk|run [1: each run]  (development tool)
// R20 C probe: a person walks (or runs) a long route through the level; a hungry Skin-Stealer is placed 450-750 px from the route's middle,
// out of sight of the person's start.  Per run: whether it posted / intercepted / searched / approached / chased, caught, how it started.
const path = require('path'), DIR = path.resolve(process.argv[2]), L = require(path.join(DIR, 'dev/tests/lib.js')), { World, DT, geo } = L;
const N = +(process.argv[3] || 20), H = +(process.argv[4] || .7), mode = process.argv[5] || 'walk';
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const out = []; const G = geo();
for (let i = 1; out.length < N && i < N * 6; i++) {
  const w = World(i * 31), g = w.eng.geo, R = rng(i * 7);
  const pick = () => { for (let k = 0; k < 500; k++) { const c = G.cells[Math.floor(R() * G.cells.length)], x = g.cx(c), y = g.cy(c); if (w.ad.clear(x, y, 26, 'walk')) return { x, y }; } return null; };
  const a = pick(), b = pick(); if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 1400) continue;
  const route = g.path(a.x, a.y, b.x, b.y, { CAN_VAULT: false }); if (!route || route.length < 3) continue;
  let len = 0, px = a.x, py = a.y; for (const q of route) { len += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y; } if (len > 3200) continue;
  const mid = route[Math.floor(route.length / 2)];
  let s = null; for (let k = 0; k < 800 && !s; k++) { const q = pick(); const d = Math.hypot(q.x - mid.x, q.y - mid.y); if (d > 450 && d < 750 && !g.los(q.x, q.y, a.x, a.y) && Math.hypot(q.x - a.x, q.y - a.y) > 900) s = q; }
  if (!s) continue;
  const e = w.eng.spawn('skinstealer', s.x, s.y, { hunger: H }); e.tier = 'near';
  const p = w.player(a.x, a.y, { light: process.env.LIGHT !== '0' }); p.route(route.map(q => ({ x: q.x, y: q.y })), mode);
  const ks = []; let last = '', caught = null, minD = 1e9, runT = 0;
  w.run(Math.min(40, len / (mode === 'run' ? 250 : 165) + 12), (ww, t) => {
    const k = e.plan ? e.plan.k : 'roam'; if (k !== last) { ks.push(k); last = k; } minD = Math.min(minD, Math.hypot(p.x - e.x, p.y - e.y)); if ((e.speed || 0) > 215) runT += DT;
    if (p.dead) { caught = +t.toFixed(1); return false; } return true; });
  const T = e.tally; out.push({ i, len: Math.round(len), caught, minD: Math.round(minD), runT: +runT.toFixed(1), seq: ks.join('>'), post: T.post || 0, postAt: T.postAt || 0, postSeen: T.postSeen || 0, postCame: T.postCame || 0, ahead: T.ahead || 0, here: T.waitHere || 0, icpt: T.intercept, stam: Math.round(e.stam) });
}
const n = out.length, c = out.filter(r => r.caught !== null).length;
console.log(JSON.stringify({ tree: path.basename(DIR), H, mode, n, caught: c, posted: out.filter(r => r.post).length, ahead: out.filter(r => r.ahead).length, caughtAfterAhead: out.filter(r => r.ahead && r.caught !== null).length, here: out.filter(r => r.here).length, caughtAfterHere: out.filter(r => r.here && r.caught !== null).length, postSeen: out.filter(r => r.postSeen).length, caughtAfterPost: out.filter(r => r.caught !== null && /post/.test(r.seq)).length, runT: +out.reduce((a, r) => a + r.runT, 0).toFixed(1), meanMinD: Math.round(out.reduce((a, r) => a + r.minD, 0) / n) }));
if (process.argv[6]) for (const r of out) console.log(JSON.stringify(r));
