/* SKIN-STEALER R16 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved): what the independent review found, each fixed narrowly, and
 * its check.  (G14 in s_skinrend.js: the victim's own corpse; V13 in s_skinsight.js: one sting, not two, either way round.)
 *   F01 another person's torch lights it for everybody who can see the spot: its model of a watcher's view counts the torches of the people
 *       it sees now - and nobody's it does not see
 *   F02 a waiting spot hides all of the still body as it is drawn (its hands and head 18-30 px out), not only its centre and 18 px
 *   F03 no ambush point near them a moment ago: it does not search again on every think (the covert search is remembered as a flank's is)
 *   F04 at a few frames a second, one frame's flicker at a wall's edge confirms no sighting (no sting, no heartbeat)
 *   F05 an open interception shows as one: the open run's act, never the hidden run's (pack 03)
 * The server's own functions are reached through a test-only copy of the built ai.js whose return also names them (the module itself is
 * unchanged; the copy is compiled in memory, never written). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), Module = require('module');
const { World, DT, LONG, AI, over, geo: levelGeo, bystander } = require('./lib.js');
const { legibility, LEGIBLE } = require('../trial-3-r9-overhaul/tools/qa_sight.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
/* (test-only truth) can person p make out any part of a still body at (x, y): its centre or 30 px either side across the line, in a clear
 * line within 700 px and readable there by the lights as the screen draws them (qa_sight.js) */
function seenAny(w, p, x, y) {
  const geo = w.eng.geo, d = Math.hypot(x - p.x, y - p.y) || 1, ux = (x - p.x) / d, uy = (y - p.y) / d;
  for (const k of [0, -30, 30]) { const qx = x - uy * k, qy = y + ux * k; if (Math.hypot(qx - p.x, qy - p.y) <= 700 && geo.los(p.x, p.y, qx, qy) && legibility(w, p, qx, qy) >= LEGIBLE) return true; }
  return false;
}
const ROOT = path.join(__dirname, '..', '..');
const INNER = (() => {
  const file = path.join(ROOT, 'generated', 'server', 'ai.js'), src = fs.readFileSync(file, 'utf8'), ret = 'return { create, S, SNAMES,';
  if (src.split(ret).length !== 2) throw new Error('ai.js: its return is not where this test expects it');
  const m = new Module(file + '#r16', module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(src.replace(ret, 'return { skLegible, skExposedTo, skSpotExposed, skBodyInSight, skWatchers, skObsOf, create, S, SNAMES,'), file);
  return m.exports;
})();

add('F01 another person\'s torch lights it for everybody who can see the spot (R16, the independent review): a spot in the dark, A (torch off) 260 px off with a clear line to it, B 220 px off with the torch on it - A cannot make it out by A\'s own light, can with B\'s; in real runs the lights it counts are only those of people it sees now', () => {
  const G = levelGeo(), w = World(16100), eng = w.eng, geo = eng.geo, cases = [];
  for (const b of G.dark) {
    if (cases.length >= 6) break;
    if (!w.ad.clear(b.x, b.y, 26, 'walk') || geo.lamp[geo.cellAt(b.x, b.y)] > .02) continue;
    let A = null, B = null;
    for (let k = 0; k < 24 && !(A && B); k++) {
      const a = k / 24 * Math.PI * 2;
      const ax = b.x + Math.cos(a) * 260, ay = b.y + Math.sin(a) * 260, bx = b.x + Math.cos(a + 1.6) * 220, by = b.y + Math.sin(a + 1.6) * 220;
      if (!A && w.ad.clear(ax, ay, 20, 'walk') && geo.los(ax, ay, b.x, b.y) && geo.lamp[geo.cellAt(ax, ay)] < .02) A = { x: ax, y: ay };
      if (!B && w.ad.clear(bx, by, 20, 'walk') && geo.los(bx, by, b.x, b.y)) B = { x: bx, y: by };
    }
    if (!A || !B) continue;
    const obA = { x: A.x, y: A.y, angle: Math.atan2(b.y - A.y, b.x - A.x), light: false, kind: 'flashlight' };
    const obB = { x: B.x, y: B.y, angle: Math.atan2(b.y - B.y, b.x - B.x), light: true, kind: 'flashlight' };
    const own = INNER.skLegible(eng, obA, b.x, b.y), lit = INNER.skLegible(eng, Object.assign({ lights: [obB] }, obA), b.x, b.y);
    const away = INNER.skLegible(eng, Object.assign({ lights: [Object.assign({}, obB, { angle: obB.angle + Math.PI })] }, obA), b.x, b.y);   // (B's torch turned away)
    cases.push({ own: +own.toFixed(2), lit: +lit.toFixed(2), away: +away.toFixed(2), exp0: INNER.skExposedTo(eng, obA, b.x, b.y), exp1: INNER.skExposedTo(eng, Object.assign({ lights: [obB] }, obA), b.x, b.y) });
  }
  // in real runs (two people, one of them never seen): every light it counts belongs to somebody it sees at that moment
  let checks = 0, bad = 0;
  for (const seed of [1, 2, 3]) {
    const w2 = World(seed + 16150); bystander(w2, 1300, 3300);
    const p = w2.player(5000, LONG.y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const q = w2.player(4960, LONG.y + 36, { light: true, angle: 0 }); q.stop('stand'); q.look = 0;   // (a second lit person beside the first)
    const e = w2.eng.spawn('skinstealer', 5450, LONG.y, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI;
    w2.run(10, (ww, t) => { if (Math.round(t * 60) % 6) return true;
      for (const o of INNER.skWatchers(w2.eng, e, 0)) for (const L of o.lights || []) { checks++; if (!e.seenNow.has(L.pid)) bad++; }
      return true; });
  }
  const ok = cases.length >= 3 && cases.every(c => c.own < .25 && c.lit >= .25 && c.away < .25 && !c.exp0 && c.exp1) && checks > 0 && bad === 0;
  return { ok, note: `${cases.length} dark spots: by A's own light ${cases.map(c => c.own).join('/')}, with B's torch on it ${cases.map(c => c.lit).join('/')}, B's torch turned away ${cases.map(c => c.away).join('/')} (readable from .25); A can see it: without ${cases.map(c => c.exp0 ? 'yes' : 'no').join('/')}, with ${cases.map(c => c.exp1 ? 'yes' : 'no').join('/')} | real runs: ${checks} lights counted, ${bad} of somebody it did not see` };
});

add('F02 a waiting spot hides all of it (R16; the R14 edge test and the independent review): the drawn body when still reaches 18-30 px out - a spot is hidden from someone only if its centre and 30 px either side are; with a still, a watching and a turning watcher in the long hall (hunger .55 / .65 / .75), wherever it waits in hiding (an ambush, an interception, a lure, a flank), the person can make out no part of it (centre or 30 px either side)', () => {
  const G = levelGeo(), w = World(16200), geo = w.eng.geo; let edge = 0, centreOnly = 0, agree = 0;
  for (const b of G.dark.concat(G.lit).slice(0, 400)) for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, ox = b.x + Math.cos(a) * 300, oy = b.y + Math.sin(a) * 300;
    if (!w.ad.clear(ox, oy, 10, 'walk')) continue;
    const c = geo.los(ox, oy, b.x, b.y), d = Math.hypot(b.x - ox, b.y - oy), ux = (b.x - ox) / d, uy = (b.y - oy) / d;
    const e1 = geo.los(ox, oy, b.x - uy * 30, b.y + ux * 30), e2 = geo.los(ox, oy, b.x + uy * 30, b.y - ux * 30), all = INNER.skBodyInSight(geo, ox, oy, b.x, b.y);
    if (!c && (e1 || e2)) { edge++; if (all) centreOnly++; }
    if (all === (c || e1 || e2)) agree++;
  }
  // real runs: whenever it stands waiting (act wait) out of the person's sight by its own reckoning, nothing of it within their line
  const rs = [];
  for (const look of ['still', 'watch', 'turn']) for (const h of [.55, .65, .75]) rs.push(...over([1, 2], seed => {
    const w2 = World(seed * 31 + 16250 + Math.round(h * 100) + (look === 'turn' ? 7 : look === 'still' ? 3 : 0)); bystander(w2, 1300, 3300);
    const p = w2.player(5000, LONG.y, { light: true, angle: 0 }); p.stop('stand');
    const e = w2.eng.spawn('skinstealer', 5000 + (seed % 2 ? 450 : 620), LONG.y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = look === 'still' ? 0 : look === 'watch' ? () => Math.atan2(e.y - p.y, e.x - p.x) : () => (w2.t % 4) > 2.5 ? Math.atan2(e.y - p.y, e.x - p.x) : Math.PI;
    let waited = 0, leak = 0;
    w2.run(20, (ww, t) => { if (Math.round(t * 60) % 6) return true;
      if (e.act === 'wait' && e.plan && /ambush|intercept|lure|flank/.test(e.plan.k) && seenAny(w2, p, e.x, e.y)) leak++;
      if (e.act === 'wait') waited++;
      return true; });
    return { waited, leak };
  }));
  const waits = rs.reduce((a, r) => a + (r.waited || 0), 0), leaks = rs.reduce((a, r) => a + (r.leak || 0), 0);
  return { ok: edge > 0 && centreOnly === edge && agree > 0 && rs.every(r => !r.err) && waits > 0 && leaks === 0,
    note: `level sample: ${edge} spots with the centre hidden but an edge in a line of sight - all ${centreOnly === edge ? '' : 'NOT '}counted as seen; in the halls: ${waits} samples of it waiting, ${leaks} with any part of it made out by the person` };
});

add('F03 no ambush point near them: it does not search again on every think (R16, the independent review; a flank already remembered this, SK.noFlank) - a lit person facing away, a mildly hungry creature (.45 / .55) in the dark 420-650 px off: covert-way searches in 10 s stay few', () => {
  const G = levelGeo(), pairs = [];
  for (const a of G.lit) { if (!G.w.ad.clear(a.x, a.y, 24, 'walk')) continue;
    for (const b of G.dark) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 420 && d < 650 && G.g.los(a.x, a.y, b.x, b.y) && G.w.ad.clear(b.x, b.y, 26, 'walk')) { pairs.push([a, b]); break; } }
    if (pairs.length >= 24) break; }
  const res = [];
  for (const h of [.45, .55]) for (let k = 0; k < pairs.length; k++) {
    const [a, b] = pairs[k], w = World(500 + k); bystander(w);
    const p = w.player(a.x, a.y, { light: true, angle: Math.atan2(a.y - b.y, a.x - b.x) }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', b.x, b.y, { hunger: h }); e.tier = 'near'; e.ang = Math.atan2(a.y - b.y, a.x - b.x);
    w.run(10, () => true); res.push(e.tally.coverQ || 0);
  }
  res.sort((x, y) => y - x);
  return { ok: res.length >= 20 && res[0] <= 4, note: `${res.length} scenes: covert-way searches in 10 s, most first ${res.slice(0, 12).join(' ')} ... (the reviewed tree: up to 26)` };
});

add('F04 at a few frames a second one frame\'s glimpse confirms nothing (R16, the independent review): a body seen in one frame in ten at a wall\'s edge for 4 s - no sting and no heartbeat at 60, 30 or 8 frames a second; a body truly in sight still confirms at 8 frames a second', () => {
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const page = (H, walls) => {
    const ctx = { console, Math, performance: { now: () => 0 }, innerWidth: 1024, innerHeight: 640, document: { getElementById: () => null, querySelector: () => null }, setTimeout: () => 0 };
    ctx.window = ctx; vm.createContext(ctx);
    const Uc = (x, y, a, max) => { const dx = Math.cos(a), dy = Math.sin(a); let best = max; for (const r of walls()) { const t1 = (r.x - x) / dx, t2 = (r.x + r.w - x) / dx, t3 = Math.abs(dy) < 1e-10 ? (y < r.y || y > r.y + r.h ? -1 : -Infinity) : (r.y - y) / dy, t4 = Math.abs(dy) < 1e-10 ? (y < r.y || y > r.y + r.h ? -1 : Infinity) : (r.y + r.h - y) / dy; const near = Math.max(Math.min(t1, t2), Math.min(t3, t4)), far = Math.min(Math.max(t1, t2), Math.max(t3, t4)); if (far >= Math.max(0, near) && near >= 0) best = Math.min(best, near); } return Math.max(0, best); };
    const Ul = (x, y, ob) => { const d = Math.hypot(x - ob.x, y - ob.y), ld = Math.hypot(x - 260, y); const s = Math.max((1 - sm(28, 100, d)) * .5, ld < 380 ? (1 - sm(40, 380, ld)) * .43 : 0); return (1 - sm(420, 670, d)) * Math.min(1, .04 + s * 2.08); };
    ctx.__api = { H, lightOn: () => false, Uc, Ul };
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'skinstealer.js'), 'utf8'), ctx);
    return ctx;
  };
  const out = [];
  for (const [fps, flicker] of [[60, true], [30, true], [8, true], [8, false]]) {
    const H = { x: 0, y: 0, angle: 0, equipment: { kind: 'flashlight' } }; let frame = 0;
    const wall = { x: 100, y: -100, w: 20, h: 200 }, P = page(H, () => (!flicker || frame % 10 === 5 ? [] : [wall]));
    let stings = 0, maxk = 0; const dt = 1 / fps;
    for (frame = 0; frame < fps * 4; frame++) { P.__skin.mirror([{ i: 7, x: 260, y: 0, a: Math.PI, s: 1, ac: 0, v: 0, h: 0 }], dt); const r = P.__skin.sight(dt, { cam: { x: 0, y: 0 }, sc: .9, W: 1024, H: 640, run: true }); if (r.sting) stings++; maxk = Math.max(maxk, r.k); }
    out.push({ fps, flicker, stings, maxk: +maxk.toFixed(2) });
  }
  const ok = out.filter(o => o.flicker).every(o => o.stings === 0 && o.maxk === 0) && out.some(o => !o.flicker && o.stings === 1 && o.maxk > .3);
  return { ok, note: out.map(o => `${o.fps} fps ${o.flicker ? 'one frame in ten' : 'in sight'}: stings ${o.stings}, heartbeat ${o.maxk}`).join(' | ') };
});

add('F05 an open interception shows as one (R16, the independent review; pack 03: the act marks an open commitment): over the gap\'s ways, walked and run, every tick of an interception it runs to in the open is the open run\'s act (chase, upright), never the hidden run\'s (intercept); a covert one keeps its own acts', () => {
  const FORK = { west: [{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], east: [{ x: 1250, y: 4870 }, { x: 2080, y: 4870 }] };
  const ways = [FORK.west, FORK.east, [{ x: 1720, y: 4900 }], [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }]];
  const tally = { open: {}, covert: {} };
  for (let seed = 1; seed <= 12; seed++) {
    const w = World(seed + 16540); bystander(w, 8400, 900);
    const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .85 }); e.tier = 'near'; e.ang = Math.PI;
    w.run(20, (ww, t) => {
      if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
      if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.route(ways[seed % 4].slice(), seed % 2 ? 'run' : 'walk'); }
      if (p.light && p.y < 5440) p.light = false;
      const P = e.plan; if (P && P.k === 'intercept' && !P.arrived && !e.pounce && !e.recover) { const T = tally[P.mode === 'covert' ? 'covert' : 'open']; T[e.act] = (T[e.act] || 0) + 1; }
      return true; });
  }
  const n = o => Object.values(o).reduce((a, b) => a + b, 0), badOpen = Object.keys(tally.open).filter(k => k !== 'chase'), badCovert = Object.keys(tally.covert).filter(k => k === 'chase' || k === 'pace');
  return { ok: n(tally.open) > 0 && !badOpen.length && !badCovert.length, note: `open interceptions' ticks by act ${JSON.stringify(tally.open)}; covert ones ${JSON.stringify(tally.covert)}` };
});

module.exports = S;
