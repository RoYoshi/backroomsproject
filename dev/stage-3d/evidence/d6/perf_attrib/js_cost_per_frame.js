'use strict';
const fs = require('fs'), path = require('path');
const G = path.resolve(process.argv[2]), KV = process.argv[3] || 'Hound A';
const sim = require(path.join(G, 'sim.js'))({ seed: 1 });
const Uc = (x, y, a, max) => { const c = Math.cos(a), s = Math.sin(a); for (let d = 0; d <= max; d += 1) if (!sim.clearAt(x + c * d, y + s * d, .5)) return d; return max; };
const tileWall = (x, y) => sim.blockersAt(x, y).some(q => q.w === 96 && q.h === 96 && q.x % 96 === 0 && q.y % 96 === 0 && x >= q.x && x < q.x + 96 && y >= q.y && y < q.y + 96);
const floor = (x, y) => !tileWall(x, y);
global.window = { __api: { Uc, sl: (x, y, r) => sim.clearAt(x, y, r), Bc: (x, y) => sim.blockersAt(x, y) }, devicePixelRatio: 1 };
const realSI = global.setInterval, timers = []; global.setInterval = (f, ms) => { const h = realSI(f, ms); timers.push(h); return h; };
new Function('window', fs.readFileSync(path.join(G, 'dphys.js'), 'utf8'))(global.window);
new Function('window', fs.readFileSync(path.join(G, 'gore.js'), 'utf8'))(global.window);
const DP = global.window.__dphys, GORE = global.window.__gore;
let ops = 0; const g = new Proxy({}, { get: (o, k) => k === 'destroyed' ? false : (...a) => { ops++; return g; } });
const [kind, v] = KV.split(' ');
const spots = []; for (let y = 400; y < 6600 && spots.length < 12; y += 233) for (let x = 400; x < 9000 && spots.length < 12; x += 377) if (sim.clearAt(x, y, 60)) spots.push([x, y]);
const ms = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
function one([x, y], rep) {
  const vic = { x, y, angle: 0 }, src = { x: x - 46, y }, ang = 0, P = DP.PLAN(kind, v, 40);
  const safe = (p, a, n) => { let r = 0; for (let i = 4; i <= n && sim.clearAt(p.x + Math.cos(a) * i, p.y + Math.sin(a) * i, 22); i += 4) r = i; return r; };
  const knock = safe(vic, ang, P.kn), i0 = { x: vic.x + knock, y: vic.y }, drag = safe(i0, ang + Math.PI, P.dr), dur = DP.DURS[kind][v];
  const S = DP.create({ kind, v, victim: { x, y, angle: 0, vx: 0, vy: 0 }, src, dir: ang, hits: P.hits || [.24, .74, 1.2, 1.7], kn: knock, drag, seed: 12345, exhausted: false, eqKind: 'flashlight', hat: 'cap', walls: (a, b) => sim.blockersAt(a, b), dur });
  const bursts = []; let evi = 0, phys = 0, draw = 0;
  const d = { kind, angle: ang, direction: { x: 1, y: 0 }, bursts, ph: S, trail: S.trail, body: { x, y, angle: 0, scaleX: 1, scaleY: 1 }, dw: null };
  for (let t = 0; t <= dur + 1e-9; t += 1 / 60) {
    phys += ms(() => { DP.advance(S, t); while (evi < S.ev.length) { const q = S.ev[evi++]; if (q.k === 'hit') bursts.push({ x: S.b.x + 9, y: S.b.y, at: q.t, seed: q.i }); } });
    d.body = { x: S.b.x, y: S.b.y, angle: S.b.th, scaleX: 1, scaleY: 1 }; d.trail = S.trail;
    draw += ms(() => GORE.fx(g, d, t, floor));
  }
  return { phys, draw, frames: Math.ceil(dur * 60) };
}
for (const sp of spots.slice(0, 3)) one(sp, 0);   // warm-up
const R = spots.map(sp => one(sp, 1));
const sum = k => R.reduce((a, r) => a + r[k], 0), fr = sum('frames');
console.log(JSON.stringify({ game: path.basename(G), kv: KV, msPerFramePhys: +(sum('phys') / fr).toFixed(4), msPerFrameDraw: +(sum('draw') / fr).toFixed(4), drawOps: ops }));
for (const h of timers) clearInterval(h); process.exit(0);
