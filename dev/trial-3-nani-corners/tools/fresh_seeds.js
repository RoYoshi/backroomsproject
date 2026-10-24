/* (Trial 3 R19, the N track; Trial 3 is not owner-approved) the independent review's probe, kept: R18's follower (the built ai.js with the
 * hunk of dev/tests/r19n_patch.js taken back out) and this tree's, on the same fresh seeded routes (s_nanicorner.js's route maker), every
 * species and pace, from rest and from speed - wall contacts, bonks, stuck recoveries, slides, feeler brakes, off-route re-plans, time,
 * least clearance; every waypoint dropped, classified by the side of the bend the body was on (inside / outside); and every run with a drop
 * in which anything got worse.
 *   node dev/trial-3-nani-corners/tools/fresh_seeds.js [seeds 11,29,41] [routes per seed 30]      (from the repository root) */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = path.resolve(__dirname, '../../..');
const { World, DT } = require(ROOT + '/dev/tests/lib.js'), RN = require(ROOT + '/dev/tests/r19n_patch.js');
const NC = require(ROOT + '/dev/tests/s_nanicorner.js');
const AIFILE = path.join(ROOT, 'generated', 'server', 'ai.js');
const src = fs.readFileSync(AIFILE, 'utf8'), ret = 'return { create, S, SNAMES,';
const HOOK_OLD = 'e.path.shift(); navOf(e).passed = (navOf(e).passed || 0) + 1; return follow(';
const HOOK_NEW = '(navOf(e).drops || (navOf(e).drops = [])).push({ wp, n1, x: e.x, y: e.y, ang: e.ang, sp: e.speed, path: e.path.slice() }); e.path.shift(); navOf(e).passed = (navOf(e).passed || 0) + 1; return follow(';
if (src.split(HOOK_OLD).length !== 2) throw new Error('hook text');
const load = (text, tag) => { const m = new Module(AIFILE + '#' + tag, module); m.filename = AIFILE; m.paths = Module._nodeModulePaths(path.dirname(AIFILE)); m._compile(text.replace(ret, 'return { plan, follow, navOf, create, S, SNAMES,'), AIFILE); return m.exports; };
const NOW = load(src.replace(HOOK_OLD, HOOK_NEW), 'probe-now'), R18 = load(RN.remove(src), 'probe-r18');
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function walk(w, I, kind, R, v, moving, opts = {}) {
  const eng = w.eng, geo = eng.geo, e = eng.spawn(kind, R.ax, R.ay, kind === 'skinstealer' ? { hunger: .1 } : {}); eng.entities.splice(eng.entities.indexOf(e), 1);
  e.tier = 'near'; e.path = []; I.plan(eng, e, R.bx, R.by);
  if (!e.path.length) return null;
  e.ang = Math.atan2(e.path[0].y - e.y, e.path[0].x - e.x); e.speed = moving ? v : 0;
  const prev = new Map(); let arr = null;
  const note = () => { if (e.path !== arr) { arr = e.path; let px = e.x, py = e.y; for (const q of arr) { if (!prev.has(q)) prev.set(q, { x: px, y: py }); px = q.x; py = q.y; } } };
  note();
  const M = { minClear: 99, t: 0, arrived: false, trav: 0, modes: '', drops: [], trace: [] };
  let lastMode = '', wasTrav = false; const t0 = eng.now;
  for (let k = 0; k < 25 * 60; k++) {
    eng.now += DT; geo.now = eng.now;
    note();
    const nd = (I.navOf(e).drops || []).length;
    const st = I.follow(eng, e, DT, v, opts);
    const ds = I.navOf(e).drops || [];
    for (let j = nd; j < ds.length; j++) {
      const D = ds[j], pv = prev.get(D.wp) || { x: D.x, y: D.y }, ax = D.wp.x - pv.x, ay = D.wp.y - pv.y, ux = D.n1.x - D.wp.x, uy = D.n1.y - D.wp.y, vx = D.x - D.wp.x, vy = D.y - D.wp.y;
      const turn = Math.sign(ax * uy - ay * ux), side = Math.sign(ux * vy - uy * vx), bend = Math.abs(angDiff(Math.atan2(uy, ux), Math.atan2(ay, ax)));
      M.drops.push({ tick: k, inside: turn === side, bend: +bend.toFixed(2), d: +Math.hypot(vx, vy).toFixed(1), lat: +((ux * vy - uy * vx) / (Math.hypot(ux, uy) || 1)).toFixed(1), sp: Math.round(D.sp), leg: Math.round(Math.hypot(ux, uy)), n2c: (D.path[2] && (D.path[2].c | 0)) || 0, n2link: !!(D.path[2] && D.path[2].link), modeAfter: e.mode });
    }
    M.t += DT; if (!e.trav) { const mode = e.mode || 'walk'; let m = 1e9; for (const b of geo.blockers(e.x, e.y, mode)) { const nx = Math.max(b.x, Math.min(e.x, b.x + b.w)), ny = Math.max(b.y, Math.min(e.y, b.y + b.h)); m = Math.min(m, Math.hypot(e.x - nx, e.y - ny)); } M.minClear = Math.min(M.minClear, m === 1e9 ? 99 : m - e.rc); }
    if (e.trav && !wasTrav) M.trav++; wasTrav = !!e.trav;
    if (e.mode !== lastMode) { M.modes += (M.modes ? '>' : '') + e.mode; lastMode = e.mode; }
    if (opts.trace) M.trace.push([k, +e.x.toFixed(1), +e.y.toFixed(1), +e.ang.toFixed(2), Math.round(e.speed), e.path.length, I.navOf(e).contacts, I.navOf(e).slide || 0]);
    const toEnd = Math.hypot(R.bx - e.x, R.by - e.y);
    if (st === 'arrived' || (toEnd < 20 && e.speed < 5)) { M.arrived = true; break; }
  }
  const n = I.navOf(e);
  Object.assign(M, { contacts: n.contacts, bonks: n.bonks, stuck: n.stuckN, recover: n.recover, slide: n.slide || 0, feel: n.feel || 0, plans: n.plans, offRoute: n.why.filter(x => x[1] === 'off-route').length, passed: n.passed || 0 });
  eng.now = t0;
  return M;
}
module.exports = { walk, NOW, R18 };
if (require.main === module) {
  const seeds = (process.argv[2] || '11,29,41').split(',').map(Number), nR = +(process.argv[3] || 30);
  const PACES = [['hound', 292], ['hound', 92], ['smiler', 255], ['skinstealer', 270], ['skinstealer', 205]];
  const agg = {}; const worse = []; const dropsAll = [];
  for (const seed of seeds) {
    const w = World(seed), RS = NC.helpers.routes(w, nR, seed, false, 'skinstealer');
    for (const [kind, v] of PACES) for (const moving of [false, true]) for (const [i, R] of RS.entries()) {
      const a = walk(w, R18, kind, R, v, moving), b = walk(w, NOW, kind, R, v, moving); if (!a || !b) continue;
      const key = kind + v; const G = agg[key] || (agg[key] = { runs: 0, withDrop: 0, drops: 0, outside: 0, identicalNoDrop: 0, noDrop: 0 });
      G.runs++; for (const f of ['contacts', 'bonks', 'stuck', 'recover', 'slide', 'feel', 'offRoute', 't']) { G[f] = G[f] || [0, 0]; G[f][0] += a[f]; G[f][1] += b[f]; }
      if (b.drops.length) { G.clr = G.clr || []; G.clr.push([+a.minClear.toFixed(2), +b.minClear.toFixed(2), seed, i + 1, moving]); G.withDrop++; G.drops += b.drops.length; G.outside += b.drops.filter(d => !d.inside).length; for (const d of b.drops) dropsAll.push(Object.assign({ seed, route: i + 1, kind, v, moving }, d)); }
      else { G.noDrop++; if (a.contacts === b.contacts && Math.abs(a.t - b.t) < 1e-9 && a.slide === b.slide) G.identicalNoDrop++; }
      if (b.drops.length && (b.contacts > a.contacts || b.bonks > a.bonks || b.stuck > a.stuck || b.slide > a.slide + 5 || b.offRoute > a.offRoute || b.t > a.t + 2 * DT || (a.arrived && !b.arrived)))
        worse.push({ seed, route: i + 1, kind, v, moving, r18: { c: a.contacts, b: a.bonks, st: a.stuck, sl: a.slide, f: a.feel, or: a.offRoute, t: +a.t.toFixed(2), arr: a.arrived }, now: { c: b.contacts, b: b.bonks, st: b.stuck, sl: b.slide, f: b.feel, or: b.offRoute, t: +b.t.toFixed(2), arr: b.arrived }, drops: b.drops });
    }
  }
  for (const [k, G] of Object.entries(agg)) for (const f of ['t']) G[f] = G[f].map(x => +x.toFixed(2));
  console.log(JSON.stringify({ agg }, null, 0));
  console.log('drops:', dropsAll.length, 'outside:', dropsAll.filter(d => !d.inside).length);
  for (const d of dropsAll) console.log(JSON.stringify(d));
  console.log('runs with a drop and something worse:', worse.length);
  for (const x of worse) console.log(JSON.stringify(x));
}
