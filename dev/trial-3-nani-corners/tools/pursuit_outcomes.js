#!/usr/bin/env node
/* dev/trial-3-nani-corners/tools/pursuit_outcomes.js - Trial 3 R19 (the owner's addendum of October 23: the movement work must never
 * weaken a monster).  Development tool; evidence, not a gate step.  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-nani-corners/tools/pursuit_outcomes.js --dir TREE [--n 30] [--loopSeeds 1] [--loopStarts 1] [--jitter 0] [--scenes corner,loop,long] [--out FILE.json] [--only hound|skinstealer|smiler]
 *
 * The same seeded scenes on any tree (R18, N, S, the combined tree), run by that tree's own server simulation (its dev/tests/lib.js and
 * built ai.js: the real AI, perception, stamina and attacks - nothing steered but the people, who are moved as players are by the test
 * harness).  What is measured is the game's outcome, not a movement constant: whether the person was caught, when, how close the creature
 * kept (its pressure: the mean and least distance), its attacks begun (a Hound's lunge, a Skin-Stealer's spring, a Smiler's strike) and the
 * catches.  Scenes:
 *   corner   corner pursuits: a runner sent along a route of 1200+ px through rooms and doorways (nav_bench's seeded pairs) and on
 *            along others at each route's end, the creature hunting it from just behind - real stamina (it tires and slows as a player
 *            does) and endless stamina (the pure race round the bends), 40 s
 *   loop     attacks round obstacles: the runner lapping a wall island (s_nav.js's islands, both ways), the creature placed across it, 40 s
 *   long     sustained chases: a runner going from route to route through the level for 60 s, real stamina (walking once winded),
 *            the creature starting farther back
 * Species: the Hound (HUNTING its target, as dev/tests set one), the Skin-Stealer (very hungry, .9, placed in sight of somebody running
 * from it: its own decisions), the Smiler (the level blacked out, the runner carrying a light, in its view: its own wind-up and chase). */
'use strict';
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir', path.join(__dirname, '..', '..', '..'))), N = +arg('n', 30), ONLY = arg('only', ''), LS = +arg('loopSeeds', 1), LM = +arg('loopStarts', 1), JIT = +arg('jitter', 0), SCN = arg('scenes', 'corner,loop,long').split(',');
const L = require(path.join(DIR, 'dev', 'tests', 'lib.js')), { World, DT } = L, NB = require(path.join(DIR, 'dev', 'tests', 'nav_bench.js'));
const F = NB.fixtures(), G = L.geo();

/* s_nav.js's wall islands (a clean lap round each) */
function islands() {
  const a = G.w.ad, C = 96, R = 72, fl = (c, r) => c >= 0 && r >= 0 && c < C && r < R && a.floor(c, r), seen = new Uint8Array(C * R), out = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (fl(c, r) || seen[r * C + c]) continue; const q = [[c, r]]; seen[r * C + c] = 1; const cells = []; let border = false;
    while (q.length) { const [x, y] = q.pop(); cells.push([x, y]); if (x === 0 || y === 0 || x === C - 1 || y === R - 1) border = true; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R || seen[ny * C + nx] || fl(nx, ny)) continue; seen[ny * C + nx] = 1; q.push([nx, ny]); } }
    if (border || cells.length > 12) continue;
    const xs = cells.map(p => p[0]), ys = cells.map(p => p[1]), x0 = Math.min(...xs) * 96, y0 = Math.min(...ys) * 96, x1 = (Math.max(...xs) + 1) * 96, y1 = (Math.max(...ys) + 1) * 96;
    const m = 78, ring = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].map(([x, y]) => ({ x, y }));
    if (!ring.every(p => G.ad.clear(p.x, p.y, 20, 'walk'))) continue;
    let ok = true; for (let k = 0; k < 4 && ok; k++) { const p = ring[k], q2 = ring[(k + 1) % 4]; if (!G.g.lineClear(p.x, p.y, q2.x, q2.y, 16, 'walk')) ok = false; }
    if (ok) out.push({ n: cells.length, ring });
  }
  return out;
}
/* the creature, placed and set going the way dev/tests do for each species */
function creature(w, kind, x, y, p) {
  if (kind === 'hound') { const h = w.hound(x, y); h.state = 'HUNTING'; h.target = p.id; h.ang = Math.atan2(p.y - y, p.x - x); return h; }
  if (kind === 'skinstealer') { const e = w.eng.spawn('skinstealer', x, y, { hunger: .9 }); e.tier = 'near'; e.ang = Math.atan2(p.y - y, p.x - x); return e; }
  const s = w.smiler(x, y); s.ang = Math.atan2(p.y - y, p.x - x); return s;
}
const attacking = (kind, e) => kind === 'hound' ? !!e.lunge : kind === 'skinstealer' ? !!e.pounce : e.state === 'ATTACKING';
/* one run: step until caught or the time is up; the creature's pressure and attacks */
function run(w, kind, e, p, secs, each) {
  let t = 0, caught = false, att = 0, was = false, dSum = 0, dN = 0, dMin = 1e9, firstAtt = -1;
  while (t < secs) {
    if (each) each(t);
    w.step(); t += DT;
    const a = attacking(kind, e); if (a && !was) { att++; if (firstAtt < 0) firstAtt = t; } was = a;
    const d = Math.hypot(e.x - p.x, e.y - p.y); dSum += d; dN++; dMin = Math.min(dMin, d);
    if (p.caught || p.dead) { caught = true; break; }
  }
  return { caught, t: +t.toFixed(2), attacks: att, firstAttack: +firstAtt.toFixed(2), meanD: Math.round(dSum / Math.max(1, dN)), minD: Math.round(dMin), passed: (e.nav && e.nav.passed) || 0 };   // (passed: waypoints dropped by R19 N's hunk)
}
function prep(w, kind, p) { if (kind === 'smiler') { w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true; } }
const OUT = { tool: 'dev/trial-3-nani-corners/tools/pursuit_outcomes.js', tree: path.basename(DIR) + (JIT ? ` (creatures ${JIT} px off)` : ''), n: N, loopSeeds: LS, loopStarts: LM, jitter: JIT, runs: [] };
const SPECIES = ['hound', 'skinstealer', 'smiler'].filter(k => !ONLY || k === ONLY);
const P = NB.pairs(F, N * 4, 41).filter(q => q.L > 1200).slice(0, N);
const I = islands();
for (const kind of SPECIES) {
  // corner pursuits, real and endless stamina; and (corner-far) the creature starting farther back, so the runner is round the first
  // bends out of its sight and it follows its route at speed
  for (const [endless, far] of SCN.includes('corner') ? [[false, false], [true, false], [false, true]] : []) for (const [k, pr] of P.entries()) {
    const w = World(4100 + k); const p = w.player(pr.a.x, pr.a.y, { light: true }); prep(w, kind, p);
    const SC = far ? 'corner-far' : endless ? 'corner-endless' : 'corner';
    if (!p.pathTo(pr.b.x, pr.b.y, 'run')) { OUT.runs.push({ kind, scene: SC, i: k, skipped: 1 }); continue; }
    const f = p.path[Math.min(2, p.path.length - 1)], gap = (kind === 'hound' ? .5 : .9) * (far ? 3 : 1); let x = pr.a.x - (f.x - pr.a.x) * gap, y = pr.a.y - (f.y - pr.a.y) * gap;
    if (!w.ad.clear(x, y, 24, 'walk')) { x = pr.a.x; y = pr.a.y; p.x = f.x; p.y = f.y; }
    const e = creature(w, kind, x, y, p); p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + Math.PI;   // (it runs looking ahead)
    let leg = 0;   // (at a route's end it runs on along another: the chase goes on round the level's bends)
    const R = run(w, kind, e, p, 40, () => { if (endless) p.stamina = 1e9; if (!p.path || !p.path.length) { leg++; const q = P[(k + leg * 5) % P.length]; p.pathTo(q.b.x, q.b.y, 'run'); } });
    OUT.runs.push(Object.assign({ kind, scene: SC, i: k }, R));
  }
  // attacks round obstacles: lapping an island, both ways (--loopSeeds: each lap scene again with other seeds - the creature's own
  // character and its draws differ, the scene does not)
  // (--loopStarts M: the creature starts at M places along the far side, not only its middle - more scenes, the same rule for every
  // tree; --jitter J: every creature starts J px off, the control for how much a lap chase changes from a tiny difference alone)
  for (let ls = 0; ls < (SCN.includes('loop') ? LS : 0); ls++) for (let m = 0; m < LM; m++) for (const [k, isl] of I.entries()) for (const dir of [1, -1]) {
    const w = World(4300 + ls * 1000 + k * 2 + (dir > 0 ? 0 : 1)), ring = isl.ring; let idx = 1, fr = LM === 1 ? .5 : .15 + .7 * m / (LM - 1);
    const p = w.player(ring[0].x, ring[0].y, { light: true }); prep(w, kind, p); p.go(ring[1].x, ring[1].y, 'run');
    const e = creature(w, kind, ring[2].x + (ring[3].x - ring[2].x) * fr + JIT, ring[2].y + (ring[3].y - ring[2].y) * fr, p);
    const R = run(w, kind, e, p, 40, () => { if (!p.tx) { idx = (idx + dir + 4) % 4; const q = ring[idx]; p.go(q.x, q.y, 'run'); } });
    OUT.runs.push(Object.assign({ kind, scene: 'loop', i: ls * 100000 + m * 1000 + k * 2 + (dir > 0 ? 0 : 1), n: isl.n }, R));
  }
  // sustained chases: from route to route for 60 s, real stamina
  for (let k = 0; k < (SCN.includes('long') ? Math.min(N, 12) : 0); k++) {
    const w = World(4500 + k), pr = P[k]; const p = w.player(pr.a.x, pr.a.y, { light: true }); prep(w, kind, p);
    if (!p.pathTo(pr.b.x, pr.b.y, 'run')) { OUT.runs.push({ kind, scene: 'long', i: k, skipped: 1 }); continue; }
    const f = p.path[Math.min(2, p.path.length - 1)]; let x = pr.a.x - (f.x - pr.a.x) * .9, y = pr.a.y - (f.y - pr.a.y) * .9; if (!w.ad.clear(x, y, 24, 'walk')) { x = pr.a.x; y = pr.a.y; p.x = f.x; p.y = f.y; }
    const e = creature(w, kind, x, y, p); let leg = 0;
    const R = run(w, kind, e, p, 60, () => { if (!p.path || !p.path.length) { leg++; const q = P[(k + leg * 7) % P.length]; p.pathTo(q.b.x, q.b.y, p.stamina > 30 ? 'run' : 'walk'); } });
    OUT.runs.push(Object.assign({ kind, scene: 'long', i: k }, R));
  }
}
const sum = {};
for (const r of OUT.runs.filter(r => !r.skipped)) { const k = r.kind + ' ' + r.scene, s = sum[k] || (sum[k] = { runs: 0, caught: 0, tCaught: [], attacks: 0, meanD: [], minD: [] }); s.runs++; if (r.caught) { s.caught++; s.tCaught.push(r.t); } s.attacks += r.attacks; s.meanD.push(r.meanD); s.minD.push(r.minD); }
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
for (const [k, s] of Object.entries(sum)) { OUT[k] = { runs: s.runs, caught: s.caught, medianCatch: med(s.tCaught), attacks: s.attacks, medianMeanD: med(s.meanD), medianMinD: med(s.minD) }; console.log(`${OUT.tree} ${k}: caught ${s.caught}/${s.runs}, median catch ${med(s.tCaught)} s, attacks ${s.attacks}, median distance ${med(s.meanD)} px (least ${med(s.minD)})`); }
if (arg('out')) fs.writeFileSync(path.resolve(arg('out')), JSON.stringify(OUT) + '\n');
