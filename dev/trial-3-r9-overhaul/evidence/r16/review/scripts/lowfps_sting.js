// skin.sight.js: at a low frame rate a single frame in which a body flickers into view (e.g. at a wall edge) confirms a sighting and
// stings, because CONFIRM (.12 s) is measured in accumulated dt and one long frame already exceeds it.
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), ROOT = process.argv[2];
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function page(H, walls) {
  const ctx = { console, Math, performance: { now: () => 0 }, innerWidth: 1024, innerHeight: 640, document: { getElementById: () => null, querySelector: () => null }, setTimeout: () => 0 };
  ctx.window = ctx; vm.createContext(ctx);
  const Uc = (x, y, a, max) => { const dx = Math.cos(a), dy = Math.sin(a); let best = max; for (const r of walls()) { const t1 = (r.x - x) / dx, t2 = (r.x + r.w - x) / dx, t3 = Math.abs(dy) < 1e-10 ? (y < r.y || y > r.y + r.h ? -1 : -Infinity) : (r.y - y) / dy, t4 = Math.abs(dy) < 1e-10 ? (y < r.y || y > r.y + r.h ? -1 : Infinity) : (r.y + r.h - y) / dy; const near = Math.max(Math.min(t1, t2), Math.min(t3, t4)), far = Math.min(Math.max(t1, t2), Math.max(t3, t4)); if (far >= Math.max(0, near) && near >= 0) best = Math.min(best, near); } return Math.max(0, best); };
  const Ul = (x, y, ob) => { const d = Math.hypot(x - ob.x, y - ob.y); const ld = Math.hypot(x - 260, y); const s = Math.max((1 - sm(28, 100, d)) * .5, ld < 380 ? (1 - sm(40, 380, ld)) * .43 : 0); return (1 - sm(420, 670, d)) * Math.min(1, .04 + s * 2.08); };
  ctx.__api = { H, lightOn: () => false, Uc, Ul };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'skinstealer.js'), 'utf8'), ctx);
  return ctx;
}
for (const fps of [60, 30, 8]) {
  const H = { x: 0, y: 0, angle: 0, equipment: { kind: 'flashlight' } }; let frame = 0;
  const wall = { x: 100, y: -100, w: 20, h: 200 };
  const P = page(H, () => (frame % 10 === 5 ? [] : [wall]));        // visible in exactly one frame out of ten (a flicker at an edge)
  let stings = 0, maxk = 0; const dt = 1 / fps;
  for (frame = 0; frame < fps * 4; frame++) { P.__skin.mirror([{ i: 7, x: 260, y: 0, a: Math.PI, s: 1, ac: 0, v: 0, h: 0 }], dt); const r = P.__skin.sight(dt, { cam: { x: 0, y: 0 }, sc: .9, W: 1024, H: 640, run: true }); if (r.sting) stings++; maxk = Math.max(maxk, r.k); }
  console.log(`${fps} fps, seen 1 frame in 10 for 4 s: stings ${stings}, heartbeat level max ${maxk.toFixed(2)}`);
}
