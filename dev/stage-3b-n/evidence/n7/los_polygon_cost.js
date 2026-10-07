// cost of the line-of-sight polygon with and without the pillar corners, using the game's own ray (sim's copy of the bundle's Uc)
const sim = require(require('path').join(__dirname, '..', '..', '..', 'sim_geo.js'))(); const D = sim.debug, { Uc, Hc, Pc, FBW, FBH } = D;
const Vl = []; for (let e = 0; e <= FBH; e++) for (let t = 0; t <= FBW; t++) { const n = Hc(t - 1, e - 1), r = Hc(t, e - 1), i = Hc(t - 1, e), a = Hc(t, e), o = +n + +r + +i + +a; (o === 1 || o === 3 || o === 2 && n === a) && Vl.push({ x: t * 96, y: e * 96 }); }
const VlP = Vl.slice(); for (const e of Pc) VlP.push({ x: e.x, y: e.y }, { x: e.x + e.w, y: e.y }, { x: e.x, y: e.y + e.h }, { x: e.x + e.w, y: e.y + e.h });
const Hl = (V, e, t, n = 700, r = 0) => { const i = []; for (let k = 0; k < 96; k++) i.push(k / 96 * Math.PI * 2 - Math.PI); for (const q of V) { if (Math.hypot(q.x - e, q.y - t) > n + 96) continue; const a = Math.atan2(q.y - t, q.x - e); i.push(a - 2e-5, a, a + 2e-5); } i.sort((a, b) => a - b); const out = []; for (const o of i) { const s = Uc(e, t, o, n), d = Math.min(n, s + (s < n ? r : 0)); out.push(e + Math.cos(o) * d, t + Math.sin(o) * d); } return out; };
const poses = []; for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; poses.push([8112 + Math.cos(a) * 160, 1392 + Math.sin(a) * 160]); }
const far = []; for (let k = 0; k < 64; k++) far.push([1300 + (k % 8) * 20, 3500 + (k >> 3) * 10]);
const bench = (V, P) => { let n = 0; const t0 = process.hrtime.bigint(); for (let rep = 0; rep < 40; rep++) for (const [x, y] of P) { Hl(V, x, y, 700); Hl(V, x, y, 700, 24); n += 2; } return Number(process.hrtime.bigint() - t0) / 1e6 / n; };
for (let w = 0; w < 2; w++) { bench(Vl, poses); bench(VlP, poses); }
const r = { pillarHall: { before: +bench(Vl, poses).toFixed(4), after: +bench(VlP, poses).toFixed(4), raysBefore: Hl(Vl, ...poses[0]).length / 2, raysAfter: Hl(VlP, ...poses[0]).length / 2 },
  elsewhere: { before: +bench(Vl, far).toFixed(4), after: +bench(VlP, far).toFixed(4) } };
console.log(JSON.stringify(r));
