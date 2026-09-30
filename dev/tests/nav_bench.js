/* Navigation benchmark (Part 1B): measures route quality, steering, locomotion and collision on the real level with the real movement code.
 *   node tests/nav_bench.js [json-out]      (deterministic; prints a table and optionally writes the numbers)
 * Fixtures come from the real geometry: point-to-point routes across rooms, every narrow doorway approached at 0/30/60 degrees, two entities through one
 * doorway, a real-AI hound chasing a runner through 3+ rooms, and a player circling a counter. */
'use strict';
const fs = require('fs');
const { World, DT, geo, avg } = require('./lib.js');
const TAU = Math.PI * 2, angD = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };

/* per-entity tracker: contacts/bonks come from the engine's own nav record; clearance, heading jitter, NaN and distance are measured here */
function track(w, e) {
  const T = { d: 0, maxTurn: 0, flips: 0, lastTurn: 0, bad: 0, nan: 0, px: e.x, py: e.y, pa: e.ang, ticks: 0, stillTicks: 0 };
  T.tick = () => {
    T.ticks++; if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.ang)) T.nan++;
    const step = Math.hypot(e.x - T.px, e.y - T.py); T.d += step;
    const turn = angD(e.ang, T.pa); if (Math.abs(turn) > T.maxTurn && !e.trav) T.maxTurn = Math.abs(turn);
    if (Math.abs(turn) > .02 && Math.abs(T.lastTurn) > .02 && Math.sign(turn) !== Math.sign(T.lastTurn)) T.flips++;    // steering wobble: turning left, then right, then left...
    if (Math.abs(turn) > .005) T.lastTurn = turn;
    if (!e.trav && !w.eng.geo.clear(e.x, e.y, e.rc - 2, e.mode || 'walk')) T.bad++;     // inside the solid margin
    if (step < .2) T.stillTicks++;
    T.px = e.x; T.py = e.y; T.pa = e.ang;
  };
  return T;
}
const navN = e => e.nav || { plans: 0, contacts: 0, bonks: 0, stuckN: 0, recover: 0, emergency: 0 };

/* ------------------------------------------------ fixtures from the level */
function fixtures() {
  const G = geo(), g = G.g, ad = G.ad;
  const floor = G.cells.filter((c, k) => k % 2 === 0).map(c => ({ x: g.cx(c), y: g.cy(c) })).filter(p => ad.clear(p.x, p.y, 26, 'walk'));
  // doorways: a gap in a wall line. Across one axis the walls are close (<= 200 px wide opening), along the other the floor runs on >= 220 px each side
  const doors = [];
  for (const p of G.cells.map(c => ({ x: g.cx(c), y: g.cy(c) }))) {
    if (!ad.clear(p.x, p.y, 22, 'walk')) continue;
    for (const [ax, px] of [[0, Math.PI / 2], [Math.PI / 2, 0]]) {            // ax = travel axis through the door, px = across it
      const w1 = g.ray(p.x, p.y, px, 260), w2 = g.ray(p.x, p.y, px + Math.PI, 260), width = w1 + w2;
      if (width > 200 || width < 70) continue;
      const f1 = g.ray(p.x, p.y, ax, 400), f2 = g.ray(p.x, p.y, ax + Math.PI, 400);
      if (f1 < 300 || f2 < 300) continue;
      // real door, not a corridor: 150 px to either side of the opening, sideways, is open floor
      const side = (s) => { const qx = p.x + Math.cos(ax) * s * 150, qy = p.y + Math.sin(ax) * s * 150; return g.ray(qx, qy, px, 260) + g.ray(qx, qy, px + Math.PI, 260) > width + 120; };
      if (!side(1) || !side(-1)) continue;
      if (doors.some(d => Math.hypot(d.x - p.x, d.y - p.y) < 300)) continue;
      doors.push({ x: p.x + Math.cos(px) * (w1 - w2) / 2, y: p.y + Math.sin(px) * (w1 - w2) / 2, ax, width: Math.round(width) });
    }
  }
  return { G, floor, doors };
}

function pairs(F, n, seed) {
  const out = []; let k = seed * 7919;
  const g = F.G.g;
  while (out.length < n && k < seed * 7919 + 40000) {
    const a = F.floor[(k * 31) % F.floor.length], b = F.floor[(k * 97 + 13) % F.floor.length]; k++;
    const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 900 || d > 3200) continue;
    const p = g.path(a.x, a.y, b.x, b.y, { CAN_VAULT: false }); if (!p) continue;
    let L = 0, q = a; for (const w of p) { L += Math.hypot(w.x - q.x, w.y - q.y); q = w; }
    if (L < d * 1.15) continue;                                                  // only routes that actually turn corners / go through doors
    out.push({ a, b, L });
  }
  return out;
}

function runRoute(kind, a, b, speed, seed, opts = {}) {
  const w = World(seed), P = w.player(20, 20, { light: false }); P.stop('stand'); P.x = 9000; P.y = 60;   // keeps the world running; far away, inside the border
  const e = kind === 'hound' ? w.hound(a.x, a.y) : w.smiler(a.x, a.y); e.ang = Math.atan2(b.y - a.y, b.x - a.x) + (opts.ang0 || 0);
  w.eng.navGo(e, { x: b.x, y: b.y, speed, arrive: 22 }); const T = track(w, e); const t0 = performance.now(); let t = 0;
  const lim = opts.lim || 40;
  while (t < lim && e.navGo) { w.step(); T.tick(); t += DT; }
  const n = navN(e);
  return { ok: !e.navGo, t: +t.toFixed(2), ms: (performance.now() - t0) / Math.max(1, T.ticks), d: T.d, contacts: n.contacts, bonks: n.bonks, stuck: n.stuckN, recover: n.recover, emergency: n.emergency, plans: n.plans, flips: T.flips, bad: T.bad, nan: T.nan, maxTurn: T.maxTurn, e };
}

function doorTrials(F) {
  const res = [];
  let i = 0;
  for (const D of F.doors) {
    for (const side of [1, -1]) for (const off of [0, .52, -.52, 1.05, -1.05]) {          // 0, 30, 60 degrees off the door axis
      const dir = D.ax + (side < 0 ? Math.PI : 0), back = dir + Math.PI + off;
      const a = { x: D.x + Math.cos(back) * 300, y: D.y + Math.sin(back) * 300 }, b = { x: D.x + Math.cos(dir) * 260, y: D.y + Math.sin(dir) * 260 };
      if (!F.G.ad.clear(a.x, a.y, 26, 'walk') || !F.G.ad.clear(b.x, b.y, 26, 'walk')) continue;
      for (const [kind, sp] of [['hound', 292], ['smiler', 108]]) {
        const r = runRoute(kind, a, b, sp, 500 + (i++), { lim: kind === 'smiler' ? 30 : 14 });   // (a smiler may take the long way round a lit doorway: that is its light avoidance)
        const straight = Math.hypot(a.x - D.x, a.y - D.y) + Math.hypot(b.x - D.x, b.y - D.y);
        res.push({ kind, off: Math.round(Math.abs(off) * 57.3), ok: r.ok, t: r.t, contacts: r.contacts, bonks: r.bonks, stuck: r.stuck, flips: r.flips, bad: r.bad, nan: r.nan, detour: r.d / straight, plans: r.plans, recover: r.recover });
      }
    }
  }
  return res;
}

function twoThroughOne(F) {
  const out = [];
  for (const [k, D] of F.doors.slice(0, 10).entries()) {
    const dir = D.ax, back = dir + Math.PI, per = D.ax + Math.PI / 2;
    const a1 = { x: D.x + Math.cos(back) * 280 + Math.cos(per) * 60, y: D.y + Math.sin(back) * 280 + Math.sin(per) * 60 }, a2 = { x: D.x + Math.cos(back) * 300 - Math.cos(per) * 60, y: D.y + Math.sin(back) * 300 - Math.sin(per) * 60 };
    const b = { x: D.x + Math.cos(dir) * 300, y: D.y + Math.sin(dir) * 300 };
    if (![a1, a2, b].every(p => F.G.ad.clear(p.x, p.y, 26, 'walk'))) continue;
    const w = World(700 + k), P = w.player(9000, 60, { light: false }); P.stop('stand');
    const h1 = w.hound(a1.x, a1.y), h2 = w.hound(a2.x, a2.y); h1.ang = h2.ang = dir;
    w.eng.navGo(h1, { x: b.x, y: b.y, speed: 292, arrive: 40 }); w.eng.navGo(h2, { x: b.x + Math.cos(per) * 30, y: b.y + Math.sin(per) * 30, speed: 292, arrive: 40 });
    let t = 0, overlap = 0, worst = 1e9; while (t < 12 && (h1.navGo || h2.navGo)) { w.step(); t += DT; const d = Math.hypot(h1.x - h2.x, h1.y - h2.y); worst = Math.min(worst, d); if (d < 20) overlap += DT; }
    out.push({ ok: !h1.navGo && !h2.navGo, t: +t.toFixed(2), overlap: +overlap.toFixed(2), closest: Math.round(worst), c1: navN(h1).contacts, c2: navN(h2).contacts });
  }
  return out;
}

/* real AI: a runner goes through 3+ rooms along a real route, the hound hunts it */
function pursuit(F, n) {
  const out = []; const P = pairs(F, n * 3, 91).filter(p => p.L > 1800).slice(0, n);
  for (const [k, pr] of P.entries()) {
    const w = World(800 + k), p = w.player(pr.a.x, pr.a.y, { light: true }); if (!p.pathTo(pr.b.x, pr.b.y, 'run')) continue; p.stamina = 1e9;
    const route = p.path.slice(); const first = route[Math.min(3, route.length - 1)];
    const h = w.hound(pr.a.x, pr.a.y); h.x = pr.a.x - (first.x - pr.a.x) * .5; h.y = pr.a.y - (first.y - pr.a.y) * .5;
    if (!w.ad.clear(h.x, h.y, 24, 'walk')) { h.x = pr.a.x; h.y = pr.a.y; p.x = first.x; p.y = first.y; }
    const r = w.eng.geo; h.state = 'HUNTING'; h.target = p.id; const rr = h.mem.p.get(p.id) || null;
    const T = track(w, h); let t = 0, caught = false, maxGap = 0; const t0 = performance.now();
    while (t < 30) { p.stamina = 1e9; w.step(); T.tick(); t += DT; maxGap = Math.max(maxGap, Math.hypot(h.x - p.x, h.y - p.y)); if (p.caught || p.dead) { caught = true; break; } if (!p.path || !p.path.length) { /* reached the end: keep standing */ } }
    const nv = navN(h);
    out.push({ caught, t: +t.toFixed(1), contacts: nv.contacts, bonks: nv.bonks, stuck: nv.stuckN, plans: nv.plans, plansPerS: +(nv.plans / t).toFixed(2), flips: T.flips, bad: T.bad, nan: T.nan, ms: (performance.now() - t0) / T.ticks });
  }
  return out;
}

/* a player circles a counter-sized obstacle (the level's counters / pillars) forever; the hound hunts (real AI) */
function obstacleLoop(F) {
  const out = []; const W = require('../../g/world.js');
  const props = (W.PROPS || []).filter(p => p.type === 'low' && (p.kind === 'counter' || p.kind === 'machine' || p.kind === 'shelf'));
  for (const [k, pr] of props.entries()) {
    const cx = (pr.tx + pr.tw / 2) * 96, cy = (pr.ty + pr.th / 2) * 96, rx = pr.tw * 48 + 70, ry = pr.th * 48 + 70;
    const ring = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ring.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); }
    if (!ring.every(q => F.G.ad.clear(q.x, q.y, 16, 'walk'))) { out.push({ prop: pr.id, skipped: 'ring not clear' }); continue; }
    for (const dirSign of [1, -1]) {
      const w = World(900 + k * 2 + (dirSign > 0 ? 0 : 1)), p = w.player(ring[0].x, ring[0].y, { light: true }); p.stamina = 1e9;
      let idx = 0; const next = () => { idx = (idx + dirSign + 16) % 16; return ring[idx]; };
      const h = w.hound(cx + Math.cos(Math.PI) * (rx + 60), cy); if (!w.ad.clear(h.x, h.y, 24, 'walk')) { h.x = ring[8].x; h.y = ring[8].y; }
      h.state = 'HUNTING'; h.target = p.id; h.tr.CAN_VAULT = false;
      let t = 0, caught = false; p.go(ring[0].x, ring[0].y, 'run');
      while (t < 45) { p.stamina = 1e9; if (!p.tx) { const q = next(); p.go(q.x, q.y, 'run'); } w.step(); t += DT; if (p.caught || p.dead) { caught = true; break; } }
      out.push({ prop: pr.id, kind: pr.kind, dir: dirSign, caught, t: +t.toFixed(1), plans: navN(h).plans, contacts: navN(h).contacts, vaults: h.travCount | 0 });
    }
  }
  return out;
}

function summary(name, rs, keys) {
  const s = { name, n: rs.length };
  for (const k of keys) { const v = rs.map(r => r[k]).filter(x => typeof x === 'number' || typeof x === 'boolean'); s[k] = typeof v[0] === 'boolean' ? +(v.filter(Boolean).length / v.length).toFixed(2) : +avg(v).toFixed(3); }
  return s;
}

if (require.main === module) {
  const F = fixtures(); const R = { doors: F.doors.length };
  const T0 = Date.now();
  const P = pairs(F, 40, 3);
  R.routesHound = P.map((p, i) => runRoute('hound', p.a, p.b, 292, 100 + i)).map(({ e, ...r }) => r);
  R.routesSmiler = P.slice(0, 20).map((p, i) => runRoute('smiler', p.a, p.b, 108, 300 + i, { lim: 60 })).map(({ e, ...r }) => r);
  R.doors = doorTrials(F); R.two = twoThroughOne(F); R.pursuit = pursuit(F, 10); R.loop = obstacleLoop(F);
  const K = ['ok', 't', 'contacts', 'bonks', 'stuck', 'recover', 'emergency', 'plans', 'flips', 'bad', 'nan', 'ms'];
  const S = [summary('routes hound 292px/s', R.routesHound, K), summary('routes smiler 108px/s', R.routesSmiler, K),
    summary('doors hound', R.doors.filter(r => r.kind === 'hound'), ['ok', 'contacts', 'bonks', 'stuck', 'flips', 'bad', 'detour', 'plans']),
    summary('doors hound 60deg', R.doors.filter(r => r.kind === 'hound' && r.off > 50), ['ok', 'contacts', 'bonks', 'stuck', 'flips', 'detour']),
    summary('doors smiler', R.doors.filter(r => r.kind === 'smiler'), ['ok', 'contacts', 'bonks', 'stuck', 'flips', 'bad', 'detour', 'plans']),
    summary('two hounds one door', R.two, ['ok', 't', 'overlap', 'closest', 'c1', 'c2']),
    summary('pursuit (real AI)', R.pursuit, ['caught', 't', 'contacts', 'bonks', 'stuck', 'plansPerS', 'flips', 'bad', 'nan', 'ms']),
    summary('obstacle loop (real AI)', R.loop.filter(r => !r.skipped), ['caught', 't', 'plans', 'contacts', 'vaults'])];
  for (const s of S) console.log(JSON.stringify(s));
  console.log('doorways found:', F.doors.length, ' loop props:', R.loop.map(r => r.prop + (r.skipped ? '(skip)' : '')).join(','), ' secs:', ((Date.now() - T0) / 1e3).toFixed(1));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ S, R }, null, 1));
}
module.exports = { fixtures, pairs, runRoute, doorTrials, twoThroughOne, pursuit, obstacleLoop, track };
