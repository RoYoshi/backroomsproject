#!/usr/bin/env node
/* dev/trial-3-nani-corners/tools/corner_audit.js - Trial 3 R19, N track (shared N.A.N.I. cornering QoL): how each species' body follows a
 * route round its bends, measured on the server's own locomotion.  Development tool; evidence, not a gate step.  Not owner-approved.
 *
 *   node corner_audit.js [--dir TREE] [--routes 40] [--seed 7] [--out FILE.json] [--trace FILE.json] [--traceRoutes 1,2,3]
 *                        [--only hound|smiler|skinstealer]
 *
 * Why this way: the owner (October 23) asked for corners rounded more naturally by N.A.N.I. in general.  The route follower already exists
 * (ai.entity.js: smoothPath -> carrotOf -> follow -> cornerSpeed -> steerTo -> moveCollide); before anything changes, this measures what it
 * does at bends.  Routes are drawn once, by seed, on Level 0's floor (500-1500 px apart, at least one bend of 45 degrees or more in the
 * Skin-Stealer's own smoothed route, no vault link); each species then walks every route from rest, and again from speed, at the paces
 * its own AI uses - the Hound's roam and chase, the Smiler's roam, approach and chase, the Skin-Stealer's walk, prowl and run.  The body is
 * moved only by the tree's own plan() and follow() (a test-only copy of the built ai.js names them; nothing else of the AI runs: no
 * perception, no plan of its own), at the server's 60 Hz, on the tree's own geometry.
 *
 * Per run: time to arrive against the route's length at that pace; time slow (under half the pace) and stopped (under 20 px/s) away from
 * the start and the end; pivots (turning faster than 1.2 rad/s while under a third of the pace); jumps of the wanted heading over 0.6 rad
 * in one tick (the aim point flicking); turn reversals (its turn changing side at over 0.8 rad/s within 0.3 s); wall contacts and hard
 * bonks; the feeler's brakes; slides round a clipped corner; stuck side-steps and re-routes; the least clearance between its collider and
 * any blocker; how far off its planned route the body ran (wide: the most, per run - a Hound's overshoot at a bend); waypoints dropped as
 * passed on the inside of a bend (R19 N trees: navOf(e).passed).  --trace writes every tick of the first routes for plots. */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir', path.join(__dirname, '..', '..', '..'))), ROUTES = +arg('routes', 40), SEED = +arg('seed', 7), ONLY = arg('only', '');
const TRACE = arg('traceRoutes', '1,2,3,4,5,6').split(',').map(Number);   // (the routes whose every tick --trace keeps)
const L = require(path.join(DIR, 'dev', 'tests', 'lib.js')), { World, DT } = L;
const INNER = (() => {
  const file = path.join(DIR, 'generated', 'server', 'ai.js'), src = fs.readFileSync(file, 'utf8'), ret = 'return { create, S, SNAMES,';
  if (src.split(ret).length !== 2) throw new Error('ai.js: its return is not where this tool expects it');
  const m = new Module(file + '#corner', module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(src.replace(ret, 'return { plan, follow, navOf, create, S, SNAMES,'), file);
  return m.exports;
})();
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const PROFILES = { hound: [['roam', 92], ['chase', 292]], smiler: [['roam', 80], ['approach', 92], ['chase', 255]], skinstealer: [['walk', 160], ['prowl', 205], ['run', 270]] };

const w = World(SEED), eng = w.eng, geo = eng.geo, G = L.geo();
/* routes: start and goal on open floor, 500-1500 px apart, a bend of 45 degrees or more, no vault link (in the Skin-Stealer's own route) */
function routes() {
  const R = rng(SEED), out = [], probe = eng.spawn('skinstealer', 0, 0, { hunger: .1 }); eng.entities.splice(eng.entities.indexOf(probe), 1);
  for (let tries = 0; out.length < ROUTES && tries < 20000; tries++) {
    const a = G.cells[Math.floor(R() * G.cells.length)], b = G.cells[Math.floor(R() * G.cells.length)];
    const ax = geo.cx(a), ay = geo.cy(a), bx = geo.cx(b), by = geo.cy(b), d = Math.hypot(bx - ax, by - ay);
    if (d < 500 || d > 1500 || !w.ad.clear(ax, ay, 26, 'walk') || !w.ad.clear(bx, by, 26, 'walk')) continue;
    probe.x = ax; probe.y = ay; probe.path = [];
    if (!INNER.plan(eng, probe, bx, by) || probe.path.some(q => q.link)) continue;
    const P = [{ x: ax, y: ay }, ...probe.path]; let len = 0, bend = 0;
    for (let k = 1; k < P.length; k++) { len += Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y); if (k < P.length - 1) bend = Math.max(bend, Math.abs(angDiff(Math.atan2(P[k + 1].y - P[k].y, P[k + 1].x - P[k].x), Math.atan2(P[k].y - P[k - 1].y, P[k].x - P[k - 1].x)))); }
    if (bend < Math.PI / 4 || len > 2400) continue;
    out.push({ id: out.length + 1, ax, ay, bx, by, len: Math.round(len), bend: +bend.toFixed(2), wps: P.length - 1 });
  }
  return out;
}
function clearance(e) {                                                    // the least distance between its collider and any blocker near it
  if ((e.cellCls | 0) > 1 || (e.mode && e.mode !== 'walk') || e.trav) return 99;   // (under a table or through a gap: another mode's blockers - not measured)
  let m = 1e9; for (const t of geo.blockers(e.x, e.y, 'walk')) { const nx = Math.max(t.x, Math.min(e.x, t.x + t.w)), ny = Math.max(t.y, Math.min(e.y, t.y + t.h)); m = Math.min(m, Math.hypot(e.x - nx, e.y - ny)); }
  return m === 1e9 ? 99 : m - e.rc;
}
function walk(kind, R, v, moving, keep) {
  const e = eng.spawn(kind, R.ax, R.ay, kind === 'skinstealer' ? { hunger: .1 } : {}); eng.entities.splice(eng.entities.indexOf(e), 1);   // (driven here only: the engine does not tick it)
  e.tier = 'near'; e.path = [];
  INNER.plan(eng, e, R.bx, R.by);
  if (!e.path.length) return null;
  const plan0 = e.path.map(q => [Math.round(q.x), Math.round(q.y)]), P0 = e.path[0]; e.ang = Math.atan2(P0.y - e.y, P0.x - e.x); e.speed = moving ? v : 0;
  const n0 = Object.assign({}, INNER.navOf(e)), M = { t: 0, slow: 0, stop: 0, pivots: 0, jumps: 0, reversals: 0, minClear: 99, maxTurn: 0, dist: 0, wide: 0, arrived: false, plans0: n0.plans };
  const poly = [{ x: R.ax, y: R.ay }, ...e.path.map(q => ({ x: q.x, y: q.y }))];   // (its planned route: how far off it the body goes - running wide at a bend)
  const off = (x, y) => { let m = 1e9; for (let i = 1; i < poly.length; i++) { const a = poly[i - 1], b = poly[i], lx = b.x - a.x, ly = b.y - a.y, L2 = lx * lx + ly * ly || 1, t = Math.max(0, Math.min(1, ((x - a.x) * lx + (y - a.y) * ly) / L2)); m = Math.min(m, Math.hypot(x - a.x - lx * t, y - a.y - ly * t)); } return m; };
  let pw = null, pang = e.ang, lastTurn = [], ex = e.x, ey = e.y, tr = keep ? [] : null;
  const t0 = eng.now; walk.pf = null;
  for (let k = 0; k < 25 * 60; k++) {
    eng.now += DT; geo.now = eng.now;
    const st = INNER.follow(eng, e, DT, v, {});
    M.t += DT; const step = Math.hypot(e.x - ex, e.y - ey); M.dist += step; ex = e.x; ey = e.y;
    const turn = angDiff(e.ang, pang) / DT; pang = e.ang; M.maxTurn = Math.max(M.maxTurn, Math.abs(turn));
    const toEnd = Math.hypot(R.bx - e.x, R.by - e.y), mid = M.t > (moving ? .2 : 1.2) && toEnd > 80;
    if (mid && e.speed < v * .5) M.slow += DT;
    if (mid && e.speed < 20) M.stop += DT;
    if (mid && e.speed < v / 3 && Math.abs(turn) > 1.2) M.pivots += DT;
    if (e.want !== undefined && pw !== null && Math.abs(angDiff(e.want, pw)) > .6) M.jumps++;
    if (e.want !== undefined) pw = e.want;
    if (Math.abs(turn) > .8) { const s = Math.sign(turn); lastTurn = lastTurn.filter(q => M.t - q[0] < .3); if (lastTurn.length && lastTurn[lastTurn.length - 1][1] !== s) M.reversals++; lastTurn.push([M.t, s]); }
    M.minClear = Math.min(M.minClear, clearance(e)); M.wide = Math.max(M.wide, off(e.x, e.y));
    const nv = INNER.navOf(e), fl = [nv.slide || 0, nv.contacts, nv.feel || 0, nv.recover]; const flags = tr ? fl.map((v, i) => v - (walk.pf ? walk.pf[i] : v)) : null; walk.pf = fl;
    if (tr) tr.push([+M.t.toFixed(3), Math.round(e.x * 10) / 10, Math.round(e.y * 10) / 10, +e.ang.toFixed(3), Math.round(e.speed), e.want !== undefined ? +e.want.toFixed(3) : null, e.carrot ? [Math.round(e.carrot.x), Math.round(e.carrot.y)] : null, e.path.length, flags]);
    if (st === 'arrived' || (toEnd < 20 && e.speed < 5)) { M.arrived = true; break; }
  }
  const n = INNER.navOf(e);
  Object.assign(M, { passed: (n.passed || 0) - (n0.passed || 0), contacts: n.contacts - (n0.contacts || 0), bonks: n.bonks - (n0.bonks || 0), feel: (n.feel || 0) - (n0.feel || 0), slide: (n.slide || 0) - (n0.slide || 0), recover: n.recover - (n0.recover || 0), stuck: n.stuckN - (n0.stuckN || 0), replans: n.plans - M.plans0, why: n.why.map(q => q[1]).slice(1) });
  for (const k of ['t', 'slow', 'stop', 'pivots', 'minClear', 'maxTurn', 'dist', 'wide']) M[k] = +M[k].toFixed(k === 'minClear' || k === 'maxTurn' ? 2 : 2);
  M.ideal = +(R.len / v).toFixed(2); M.ratio = +(M.t / Math.max(.01, M.ideal)).toFixed(2); delete M.plans0;
  eng.now = t0;
  return { M, tr, plan0 };
}
const RS = routes(), out = { tool: 'corner_audit.js', tree: path.basename(DIR), seed: SEED, routes: RS, runs: [] }, traces = [];
for (const [kind, profs] of Object.entries(PROFILES)) {
  if (ONLY && ONLY !== kind) continue;
  for (const [pk, v] of profs) for (const moving of [false, true]) for (const R of RS) {
    const r = walk(kind, R, v, moving, TRACE.includes(R.id));
    if (!r) { out.runs.push({ kind, pace: pk, v, moving, route: R.id, none: 1 }); continue; }
    out.runs.push(Object.assign({ kind, pace: pk, v, moving, route: R.id }, r.M));
    if (r.tr) { const seen = new Map(); for (const q of r.tr) for (const t of geo.blockers(q[1], q[2], 'walk')) seen.set(t.x + ',' + t.y + ',' + t.w + ',' + t.h, [t.x, t.y, t.w, t.h]);
      traces.push({ kind, pace: pk, moving, route: R.id, R, plan: r.plan0, rc: 21, walls: [...seen.values()], tr: r.tr }); }
  }
}
// in all, per species and pace
const S = {};
for (const r of out.runs) { if (r.none) continue; const k = `${r.kind} ${r.pace}${r.moving ? ' (from speed)' : ''}`, s = S[k] || (S[k] = { n: 0, arrived: 0, ratio: [], slow: 0, stop: 0, pivots: 0, jumps: 0, reversals: 0, contacts: 0, bonks: 0, feel: 0, slide: 0, recover: 0, stuck: 0, replans: 0, passed: 0, wide: [], minClear: 99, under1: 0 });
  s.n++; if (r.arrived) s.arrived++; s.ratio.push(r.ratio); s.wide.push(r.wide); for (const f of ['slow', 'stop', 'pivots', 'jumps', 'reversals', 'contacts', 'bonks', 'feel', 'slide', 'recover', 'stuck', 'replans', 'passed']) s[f] += r[f] || 0; s.minClear = Math.min(s.minClear, r.minClear); if (r.minClear < 1) s.under1++; }
for (const s of Object.values(S)) { const a = s.ratio.sort((x, y) => x - y); s.ratioMed = a[Math.floor(a.length / 2)]; s.ratioP90 = a[Math.floor(a.length * .9)]; delete s.ratio; const wd = s.wide.sort((x, y) => x - y); s.wideMed = wd[Math.floor(wd.length / 2)]; s.wideMax = wd[wd.length - 1]; delete s.wide; for (const f of ['slow', 'stop', 'pivots']) s[f] = +s[f].toFixed(2); }
out.summary = S;
console.log(`routes ${RS.length} (seed ${SEED}) on ${path.basename(DIR)}`);
console.log('species pace | arrived | time/ideal med p90 | slow s | stopped s | pivot s | aim jumps | turn reversals | contacts bonks | feeler | slides | side-steps | stuck | re-routes | least clearance (runs under 1 px)');
for (const [k, s] of Object.entries(S)) console.log(`${k} | ${s.arrived}/${s.n} | ${s.ratioMed} ${s.ratioP90} | ${s.slow} | ${s.stop} | ${s.pivots} | ${s.jumps} | ${s.reversals} | ${s.contacts} ${s.bonks} | ${s.feel} | ${s.slide} | ${s.recover} | ${s.stuck} | ${s.replans} | ${s.minClear.toFixed(2)} (${s.under1})`);
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(out, null, 1) + '\n');
if (arg('trace')) fs.writeFileSync(arg('trace'), JSON.stringify(traces) + '\n');
