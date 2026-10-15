#!/usr/bin/env node
/* Stage 3H continuation C4c (M-003) - the server's Level 0, built from the one definition, against the one it replaced (development only).
 *
 *   node dev/stage-3h-modernization/tools/c4c_level0_check.js [--old-ref 00b0c7f] [--out FILE.json] [--level FILE] [--lights FILE] [--mutants 1]
 *
 * Until C4c the server's Level 0 (src/frameworks/lost/server/sim.level0.js) held its own copy of the level: the map, the pits, the pillars,
 * the spawn, the blackout timer and the light table, written as the bundle's minified code (M8's lines, verbatim since C3a). Since C4c it
 * reads them from the one definition, L.O.S.T.'s src/frameworks/lost/shared/level0.json and P.O.C.K.E.T.'s
 * src/frameworks/pocket/shared/lights.json, which the page's compiled client is built with too.  This builds both: the module at
 * --old-ref (default C1, 00b0c7f: the C3a module, proven against B++'s sim by the gate's sim step) and the working tree's, each with its
 * own fresh copy of the server's world.js, and compares everything the level gives the sim:
 *   - the data: the map's size, the rooms, the lamps, the spawn, the blackout state, the walkable grid (cell for cell), the light table,
 *     and the reachability anchor beside the spawn (ANCHOR: new in the level's return at C4c, compared with the literal N.A.N.I.'s
 *     sim.ai.js wrote at --old-ref);
 *   - every function, called with the same arguments on both: zc and Hc on every cell and a ring outside; Bc and sl (three radii) on a
 *     48 px lattice over the whole map; Uc on seeded random rays; fl on seeded random pairs of points; qc for every light kind, on and
 *     off, at seeded random places; the blackout timer (Rc) stepped through 30 minutes with seeded steps, Lc, forceBlackout and
 *     restartBlackout between;
 * Every result must be equal, but one declared difference: the light table's camcorder is labelled as the page labels it ("Camcorder",
 * with nv: true) instead of the server's old "Night Vision Camcorder"; no server code reads a label or nv (the server goldens, which
 * record every byte the server sends, are B++'s).  --level / --lights: other definitions (the checker's own tests).  Exit 0 only when
 * every comparison is equal. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ARG = { 'old-ref': '00b0c7f66985870af44ef5779696eff75502b295' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
/* --mutants 1: the check's own sensitivity: it runs itself on copies of the definitions, each with one edit that changes the level or a
   light (a corridor, a partition, a pit, a pillar, the spawn, the blackouts' gap, a room, the anchor, the lantern's range, the
   flashlight's power),
   and each must be DIFFERENT; then on the unchanged files, SAME */
if (ARG.mutants) {
  const os = require('os'), { spawnSync } = require('child_process'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c4c-level0-'));
  const LV = path.join(REPO, 'src/frameworks/lost/shared/level0.json'), LI = path.join(REPO, 'src/frameworks/pocket/shared/lights.json');
  const M = [['corridor', LV, '[43,34,7,4]', '[43,34,7,5]'], ['partition', LV, '[9,38,1,6]', '[9,38,1,5]'], ['pit', LV, '{"x":53,"y":9}', '{"x":53,"y":10}'],
    ['pillar', LV, '"half": 28', '"half": 27'], ['spawn', LV, '"spawn": {"x": 10', '"spawn": {"x": 11'], ['blackout gap', LV, '"gapStep": 10', '"gapStep": 11'],
    ['room', LV, '"x": 49, "y": 28', '"x": 49, "y": 29'], ['anchor', LV, '"anchor": {"x": 11', '"anchor": {"x": 12'],
    ['lantern range', LI, '"range": 228', '"range": 229'], ['flashlight power', LI, '"power": 0.58', '"power": 0.59']];
  const run = (lv, li) => { const r = spawnSync(process.execPath, [__filename, '--old-ref', ARG['old-ref'], '--level', lv, '--lights', li], { encoding: 'utf8', maxBuffer: 1 << 26 }); return /LEVEL 0 CHECK: SAME/.test(r.stdout) ? 'SAME' : /LEVEL 0 CHECK: DIFFERENT/.test(r.stdout) ? 'DIFFERENT' : 'ERROR'; };
  const out = { tool: 'dev/stage-3h-modernization/tools/c4c_level0_check.js --mutants', control: run(LV, LI), mutants: [], ok: true };
  if (out.control !== 'SAME') out.ok = false;
  console.log(`${out.control.padEnd(9)} control: the definitions as they are`);
  for (const [id, file, from, to] of M) {
    const text = fs.readFileSync(file, 'utf8'); if (text.split(from).length !== 2) { out.mutants.push({ id, caught: false, why: 'its text is not found once' }); out.ok = false; continue; }
    const copy = path.join(tmp, id.replace(/\W/g, '_') + '.json'); fs.writeFileSync(copy, text.replace(from, to));
    const v = file === LV ? run(copy, LI) : run(LV, copy), caught = v === 'DIFFERENT'; out.mutants.push({ id, file: path.relative(REPO, file), from, to, caught }); if (!caught) out.ok = false;
    console.log(`${caught ? 'CAUGHT ' : 'MISSED '}  ${id}: ${from} -> ${to}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(`LEVEL 0 MUTANTS: ${out.ok ? 'PASS' : 'FAIL'} (${out.mutants.filter(m => m.caught).length} of ${out.mutants.length} caught; the control ${out.control})`);
  process.exit(out.ok ? 0 : 1);
}
const load = text => { const m = { exports: {} }; new Function('module', 'exports', 'require', 'self', text)(m, m.exports, require, undefined); return m.exports; };   // (as world_diff.js loads them)
const worldText = fs.readFileSync(path.join(REPO, 'generated', 'server', 'world.js'), 'utf8');
const oldText = execFileSync('git', ['-C', REPO, 'show', `${ARG['old-ref']}:src/frameworks/lost/server/sim.level0.js`]).toString('utf8');
const newText = fs.readFileSync(path.join(REPO, 'src', 'frameworks', 'lost', 'server', 'sim.level0.js'), 'utf8');
const DEFS = { level0: JSON.parse(fs.readFileSync(ARG.level || path.join(REPO, 'src/frameworks/lost/shared/level0.json'), 'utf8')), lights: JSON.parse(fs.readFileSync(ARG.lights || path.join(REPO, 'src/frameworks/pocket/shared/lights.json'), 'utf8')) };
const A = load(oldText)(load(worldText)), B = load(newText)(load(worldText), DEFS);
const R = { tool: 'dev/stage-3h-modernization/tools/c4c_level0_check.js', oldRef: ARG['old-ref'], comparisons: 0, counts: {}, declared: [], differences: [], ok: true };
const J = v => JSON.stringify(v, (k, x) => (x instanceof Uint8Array || x instanceof Int32Array ? Array.from(x).join('') : typeof x === 'number' && !Number.isFinite(x) ? String(x) : x));
const same = (what, a, b) => { R.comparisons++; R.counts[what] = (R.counts[what] || 0) + 1; const x = J(a), y = J(b); if (x !== y && R.differences.length < 20) R.differences.push({ what, old: String(x).slice(0, 300), new: String(y).slice(0, 300) }); if (x !== y) R.ok = false; };
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
/* the returned names: the old ones, and since C4c the reachability anchor, which sim.ai.js wrote until then */
same('names', [...Object.keys(A), 'ANCHOR'].sort(), Object.keys(B).sort());
{ const ai = execFileSync('git', ['-C', REPO, 'show', `${ARG['old-ref']}:src/frameworks/nani/server/sim.ai.js`]).toString('utf8'), m = /\nconst ANCHOR=(\{x:\d+,y:\d+\});/.exec(ai);
  if (!m) { R.ok = false; R.differences.push({ what: 'ANCHOR', old: 'not found in sim.ai.js at ' + ARG['old-ref'], new: JSON.stringify(B.ANCHOR) }); }
  else { R.declared.push(`ANCHOR: the level's since C4c (level0.json's anchor cell); until then sim.ai.js's ${m[1]}`); same('data ANCHOR', new Function('return ' + m[1])(), B.ANCHOR); } }
/* the data */
for (const k of ['FBW', 'FBH', 'W', 'al', 'il', 'Ic', 'Oc', 'Fc', 'V', 'll']) same('data ' + k, A[k], B[k]);
{ // the light table: equal but the camcorder's label and nv
  const ga = JSON.parse(JSON.stringify(A.Gc)), gb = JSON.parse(JSON.stringify(B.Gc));
  if (ga.camcorder && gb.camcorder && ga.camcorder.label === 'Night Vision Camcorder' && gb.camcorder.label === 'Camcorder' && gb.camcorder.nv === true && ga.camcorder.nv === undefined) {
    R.declared.push('Gc.camcorder: label "Night Vision Camcorder" -> "Camcorder", nv: true (the page\'s; no server code reads either)');
    delete ga.camcorder.label; delete gb.camcorder.label; delete gb.camcorder.nv;
  }
  same('data Gc', ga, gb);
}
const FW = A.FBW, FH = A.FBH, T = 96;
/* zc and Hc on every cell, and a ring of cells outside */
for (let y = -2; y < FH + 2; y++) for (let x = -2; x < FW + 2; x++) { same('zc', A.zc(x, y), B.zc(x, y)); same('Hc', A.Hc(x, y), B.Hc(x, y)); }
/* Bc and sl on a 48 px lattice */
for (let y = 24; y < FH * T; y += 48) for (let x = 24; x < FW * T; x += 48) {
  same('Bc', A.Bc(x, y), B.Bc(x, y));
  for (const r of [undefined, 1, 30]) same('sl', A.sl(x, y, r), B.sl(x, y, r));
}
/* Uc on seeded random rays */
for (let i = 0; i < 6000; i++) { const x = rnd() * FW * T, y = rnd() * FH * T, a = (rnd() - .5) * 7, m = 200 + rnd() * 2400; same('Uc', A.Uc(x, y, a, m), B.Uc(x, y, a, m)); }
/* fl between seeded random floor points */
const floor = []; for (let i = 0; i < A.ll.length; i++) if (A.ll[i]) floor.push(A.ul(i));
for (let i = 0; i < 400; i++) { const p = floor[(rnd() * floor.length) | 0], q = floor[(rnd() * floor.length) | 0], j = { x: p.x + (rnd() - .5) * 20, y: p.y + (rnd() - .5) * 20 }; same('fl', A.fl({ ...j }, { ...q }), B.fl({ ...j }, { ...q })); }
/* qc: every light kind, on and off, at seeded random places */
for (let i = 0; i < 3000; i++) {
  const kind = ['flashlight', 'headlamp', 'lantern', 'camcorder', undefined][i % 5], src = { x: rnd() * 2000, y: rnd() * 2000, angle: (rnd() - .5) * 7, equipment: kind ? { kind } : undefined }, pt = { x: src.x + (rnd() - .5) * 900, y: src.y + (rnd() - .5) * 900 };
  same('qc', A.qc(src, pt, i % 7 !== 0), B.qc(src, pt, i % 7 !== 0));
}
/* the blackout timer through 30 minutes, with the resets and the admin's controls between */
for (let t = 0, n = 0; t < 1800; n++) {
  const dt = n % 97 === 0 ? 1.5 : 1 / 60 + rnd() * .05; t += dt;
  same('Rc', A.Rc(dt), B.Rc(dt)); same('V', A.V, B.V);
  if (n === 5000) { A.Lc(); B.Lc(); same('V after Lc', A.V, B.V); }
  if (n === 9000) { A.forceBlackout(true); B.forceBlackout(true); same('V forced', A.V, B.V); }
  if (n === 9500) { A.forceBlackout(false); B.forceBlackout(false); A.restartBlackout(); B.restartBlackout(); same('V restarted', A.V, B.V); }
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`compared ${R.comparisons}: ${Object.entries(R.counts).map(([k, n]) => `${k} ${n}`).join(', ')}`);
for (const d of R.declared) console.log('declared: ' + d);
for (const d of R.differences) console.log(`DIFFERENT ${d.what}: ${d.old} vs ${d.new}`);
console.log(`LEVEL 0 CHECK: ${R.ok ? 'SAME' : 'DIFFERENT'} (the server's Level 0 from the one definition against the one it replaced, ${ARG['old-ref'].slice(0, 7)})`);
process.exitCode = R.ok ? 0 : 1;
