/* shared helpers for the scenario suite */
'use strict';
const H = require('../harness.js');
const { World, DT, WORLD, AI, stateNames } = H;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;
const LONG = { y: 3504, x0: 3024, x1: 8784 };

/* geometry finders (run once per process on a scratch world) */
let cache = null;
function geo() {
  if (cache) return cache;
  const w = World(1), g = w.eng.geo, ad = w.ad;
  const cells = [];
  for (let i = 0; i < g.N; i++) if (g.cls[i] === 1) cells.push(i);
  const arcs = (x, y, R = 380, n = 24) => { let open = []; for (let k = 0; k < n; k++) open.push(g.ray(x, y, k / n * TAU, R) >= R - 6); const cnt = open.filter(Boolean).length; let a = 0; for (let k = 0; k < n; k++) if (open[k] && !open[(k + n - 1) % n]) a++; return { arcs: cnt === n ? 1 : a, frac: cnt / n, open }; };
  const out = { w, g, ad, cells, arcs };
  out.deadEnds = [];
  out.walls = [];
  out.opens = [];
  out.dark = [];
  out.lit = [];
  for (const i of cells) {
    const x = g.cx(i), y = g.cy(i);
    if (i % 3) continue;
    const a = arcs(x, y);
    if (a.arcs <= 1 && a.frac < .3 && ad.clear(x, y, 22, 'walk')) out.deadEnds.push({ x, y, frac: a.frac });
    if (a.frac > .97 && ad.clear(x, y, 22, 'walk')) out.opens.push({ x, y });
    if (g.lamp[i] < .02) out.dark.push({ x, y }); else if (g.lamp[i] > .3) out.lit.push({ x, y });
    for (let k = 0; k < 16; k++) { const ang = k / 16 * TAU, d = g.ray(x, y, ang, 130); if (d > 60 && d < 90 && g.ray(x, y, ang + .5, 170) > 50 && g.ray(x, y, ang - .5, 170) > 50 && g.ray(x, y, ang + Math.PI, 130) > 100) { out.walls.push({ x, y, ang, d }); break; } }
  }
  cache = out; return out;
}
/* the nearest open floor cell (clear for a walker) to a point: scenarios place things with it so nothing is ever put inside a wall by the test itself */
function floorNear(w, x, y, r = 22) {
  const G = geo();
  if (w.ad.clear(x, y, r, 'walk')) return { x, y };
  let best = null, bd = 1e9;
  for (const c of G.cells) { const cx = G.g.cx(c), cy = G.g.cy(c), d = Math.hypot(cx - x, cy - y); if (d < bd && w.ad.clear(cx, cy, r, 'walk')) { bd = d; best = { x: cx, y: cy }; } }
  return best;
}
/* run a scenario over seeds, count passes */
function over(seeds, fn) { const res = []; for (const s of seeds) { try { res.push(fn(s)); } catch (e) { res.push({ ok: false, err: e.stack.split('\n').slice(0, 3).join(' | ') }); } } return res; }
const rate = (rs, f = r => r.ok) => rs.filter(f).length / rs.length;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
/* nearest-to-a-band pick from a list of {x,y}: the i-th candidate whose distance from (x,y) lies in [lo,hi] */
function pick(list, x, y, lo, hi, i = 0) { const ok = list.filter(c => { const d = Math.hypot(c.x - x, c.y - y); return d >= lo && d <= hi; }); return ok.length ? ok[(i * 7919) % ok.length] : null; }
/* run a world with a per-tick tracker of one entity: state set, biggest single-tick jump, time spent lit */
function tracker(w, e) {
  const T = { states: new Set(), jump: 0, jumpAt: null, litRun: 0, litMax: 0, litTime: 0, litStill: 0, litStillRun: 0, litStillMax: 0, t: 0, px: e.x, py: e.y, minD: 1e9 };
  T.tick = () => {
    T.states.add(e.state); const j = Math.hypot(e.x - T.px, e.y - T.py); if (j > T.jump && !e.trav) { T.jump = j; T.jumpAt = { t: +w.t.toFixed(2), s: e.state, x: e.x | 0, y: e.y | 0 }; } T.px = e.x; T.py = e.y;
    const lit = w.eng.geo.lightLevel(e.x, e.y, w.eng.lightPlayers()); T.lit = lit;                        // measured from the level itself, not from what the entity believes
    if (lit > .62) { T.litRun += DT; T.litTime += DT; T.litMax = Math.max(T.litMax, T.litRun); } else T.litRun = 0;
    if (lit > .62 && e.state !== 'DISAPPEARING' && e.speed < 40 && !e.cap) { T.litStillRun += DT; T.litStill += DT; T.litStillMax = Math.max(T.litStillMax, T.litStillRun); } else T.litStillRun = 0;
    T.t += DT;
  };
  return T;
}
module.exports = { floorNear, pick, tracker, H, World, DT, WORLD, AI, stateNames, dist, TAU, LONG, geo, over, rate, avg };
