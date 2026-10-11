/* Stage 3D - does the blood stay on the floor?  (development only; no browser)
 *
 *   node dev/stage-3d/gore_geo_test.js --game DIR [--out FILE.json] [--strict]
 *
 * GAME's gore.js draws the blood of real deaths into a recording stand-in for the renderer's Graphics: every polygon point, every
 * ellipse (spatter drop) and every stroke end it would draw is kept.  The deaths are the server's own physical runs (GAME/death_srv.js
 * bodyFor, dphys.simulate) at spots found on the real map - open halls, corridors, corners, beside pillars, in front of walls - for all
 * eight variants and several attacker sides.  Two drawings per death: the live death's last frame (gore.fx at its end) and the corpse
 * (gore.corpse on the corpse record).
 *
 * The level's geometry is sim.js's (blockersAt / clearAt: the same rects the game bundle's Bc and sl give the browser).  The tile
 * floor test the game hands gore.js is the tile grid only (a wall tile is a blocker rect of exactly one aligned 96 px tile); the level's
 * ray (Uc) and clear test (sl) are rebuilt from clearAt.  A point drawn more than 1.5 px inside any blocker - a wall, a pillar or a prop
 * - is blood painted on top of something solid, and counted.  --strict: exit 1 if any is found. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'strict') ARG.strict = true; else ARG[k] = process.argv[++i]; }
const G = path.resolve(ARG.game || '.');
const sim = require(path.join(G, 'sim.js'))({ seed: 1 }), D = require(path.join(G, 'death_srv.js'));
const hyp = Math.hypot;
const solidAt = (x, y, m = 1.5) => sim.blockersAt(x, y).some(q => x > q.x + m && x < q.x + q.w - m && y > q.y + m && y < q.y + q.h - m);
const tileWall = (x, y) => sim.blockersAt(x, y).some(q => q.w === 96 && q.h === 96 && q.x % 96 === 0 && q.y % 96 === 0 && x >= q.x && x < q.x + 96 && y >= q.y && y < q.y + 96);
const floor = (x, y) => !tileWall(x, y);
const Uc = (x, y, a, max) => { const c = Math.cos(a), s = Math.sin(a); for (let d = 0; d <= max; d += 1) if (!sim.clearAt(x + c * d, y + s * d, .5)) return d; return max; };
// the browser's globals gore.js reads
global.window = { __api: { Uc, sl: (x, y, r) => sim.clearAt(x, y, r), Bc: (x, y) => sim.blockersAt(x, y) }, devicePixelRatio: 1 };
const timers = []; const realSI = global.setInterval; global.setInterval = (f, ms) => { const h = realSI(f, ms); timers.push(h); return h; };
new Function('window', fs.readFileSync(path.join(G, 'gore.js'), 'utf8'))(global.window);
if (!global.window.__dphys) global.window.__dphys = D.DP;
const GORE = global.window.__gore;

/* a Graphics that records what would be drawn */
function rec() {
  const pts = []; let pen = null;
  const g = {
    pts, destroyed: false,
    clear() { pts.length = 0; return g; },
    poly(p) { for (let i = 0; i < p.length; i += 2) pts.push(['poly', p[i], p[i + 1]]); return g; },
    ellipse(x, y) { pts.push(['drop', x, y]); return g; }, circle(x, y) { pts.push(['drop', x, y]); return g; },
    moveTo(x, y) { pen = [x, y]; pts.push(['line', x, y]); return g; }, lineTo(x, y) { pts.push(['line', x, y]); pen = [x, y]; return g; },
    quadraticCurveTo(cx, cy, x, y) { pts.push(['line', x, y]); pen = [x, y]; return g; },
    fill() { return g; }, stroke() { return g; }, rect() { return g; },
  };
  return g;
}
/* spots on the real map (the same kinds as phys_matrix.js) */
function spots() {
  const out = [], want = { open: 3, corridor: 3, corner: 3, pillar: 3, wall: 4 }, got = {};
  for (let y = 300; y < 6600; y += 61) for (let x = 300; x < 9000; x += 67) {
    if (!sim.clearAt(x, y, 30)) continue;
    const r = []; for (let k = 0; k < 16; k++) r.push(Uc(x, y, k / 16 * Math.PI * 2, 300));
    const open = r.filter(d => d >= 290).length, near = r.filter(d => d < 70).length;
    const pil = sim.blockersAt(x, y).some(q => q.w < 96 && hyp(q.x + q.w / 2 - x, q.y + q.h / 2 - y) < 90);
    let kind = null;
    if (pil) kind = 'pillar'; else if (open >= 15) kind = 'open'; else if (near >= 6 && near <= 9 && open >= 2) kind = 'corridor'; else if (near >= 3 && near <= 5) kind = 'corner'; else if (near === 1 || near === 2) kind = 'wall';
    if (!kind || (got[kind] || 0) >= want[kind]) continue;
    const k = r.indexOf(Math.min(...r)); got[kind] = (got[kind] || 0) + 1; out.push({ kind, x, y, wallA: k / 16 * Math.PI * 2 });
  }
  return out;
}
const info = { name: 'X', look: 'cap|plain|#e6bb76|#ffcc77|none', ek: 'flashlight', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, ex: 0, light: true };
const res = { tool: 'dev/stage-3d/gore_geo_test.js', game: G, deaths: 0, live: { points: 0, onSolid: 0 }, corpse: { points: 0, onSolid: 0 }, byKind: {}, worst: [] };
const count = (g, where, tag) => {
  const R = res[where]; for (const [k, x, y] of g.pts) { R.points++; if (solidAt(x, y)) { R.onSolid++; const b = res.byKind[tag] || (res.byKind[tag] = { live: 0, corpse: 0 }); b[where]++; if (res.worst.length < 12) res.worst.push({ where, tag, k, x: +x.toFixed(1), y: +y.toFixed(1) }); } }
};
for (const sp of spots()) for (const kind of ['Hound', 'Smiler']) for (const v of 'ABCD') for (const side of [0, .8, -.8, Math.PI]) {
  const ang = (kind === 'Hound' && v === 'C' ? sp.wallA : side) + (kind === 'Hound' && v === 'C' ? side * .3 : 0), w = kind === 'Hound' && v === 'C' ? (() => { const d = Uc(sp.x, sp.y, sp.wallA, 200); return d < 200 ? [Math.round(sp.x + Math.cos(sp.wallA) * d), Math.round(sp.y + Math.sin(sp.wallA) * d), +sp.wallA.toFixed(3)] : 0; })() : 0;
  if (kind === 'Hound' && v === 'C' && !w) continue;
  const kill = { k: kind, v, x: sp.x, y: sp.y, a: 0, ax: Math.round(sp.x - Math.cos(ang) * 46), ay: Math.round(sp.y - Math.sin(ang) * 46), w };
  const R = D.bodyFor(1, kill, info, sim); res.deaths++;
  // the live death's last frame: the same object the bundle's death class hands gore.fx
  const S = D.DP.simulate({ kind, v, w, victim: { x: kill.x, y: kill.y, angle: kill.a }, src: { x: kill.ax, y: kill.ay }, eqKind: 'flashlight', hat: 'cap', walls: (x, y) => sim.blockersAt(x, y), clear: (x, y, r) => sim.clearAt(x, y, r) });
  const bursts = S.S.ev.filter(q => q.k === 'hit').map(q => ({ x: q.x != null ? q.x : S.bursts[q.i] && S.bursts[q.i].x, y: q.y != null ? q.y : S.bursts[q.i] && S.bursts[q.i].y, at: q.t, seed: q.i })).filter(b => b.x != null);
  const d = { kind, angle: S.angle, direction: { x: Math.cos(S.angle), y: Math.sin(S.angle) }, bursts: bursts.length ? bursts : S.bursts.map((b, i) => Object.assign({ at: .2 * (i + 1) }, b)), ph: S.S, trail: S.S.trail, body: S.body, dw: null };
  const g1 = rec(); GORE.fx(g1, d, S.dur, floor); count(g1, 'live', sp.kind + ' ' + kind + ' ' + v);
  const b = R.body, record = { id: 'r:1:' + b.x + ':' + b.y, remote: true, cause: b.c, x: b.x, y: b.y, attackAngle: b.aa, blood: b.bl.map(([x, y, seed]) => ({ x, y, seed })), dropped: { x: b.dr[0], y: b.dr[1], angle: b.dr[2] }, hat: { x: b.ht[0], y: b.ht[1], angle: b.ht[2] }, hands: [[b.hd[0], b.hd[1]], [b.hd[2], b.hd[3]]], hatOn: b.ho, trail: b.tr, ph: 1 };
  const g2 = rec(); GORE.corpse(g2, record, floor); count(g2, 'corpse', sp.kind + ' ' + kind + ' ' + v);
}
for (const h of timers) clearInterval(h);
res.ok = res.live.onSolid === 0 && res.corpse.onSolid === 0;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(`deaths ${res.deaths}; live last frame: ${res.live.onSolid} of ${res.live.points} drawn points on something solid; corpse: ${res.corpse.onSolid} of ${res.corpse.points}`);
for (const [k, v] of Object.entries(res.byKind)) console.log('  ', k.padEnd(22), 'live', v.live, 'corpse', v.corpse);
process.exitCode = ARG.strict && !res.ok ? 1 : 0;
