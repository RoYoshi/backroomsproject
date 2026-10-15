/* Stage 3H continuation C3c (M-024) - every client scene, B++'s mp.js against this tree's, with what they reach of mp.js (development only).
 *
 *   node dev/tools/gate/golden/cli_golden_c3c.js [--scenes a,b] [--old-ref 143b63f] [--out DIR] [--write-baseline] [--baseline DIR] [--keep DIR]
 *                                              [--missed 1]
 *   node dev/tools/gate/golden/cli_golden_c3c.js --mutants dev/tools/gate/golden/cli_mutants_c3c.js [--only id,id] [--out FILE.json]
 *
 * Each scene - Stage 3H0's 9, 3H2's 3 and C3c's 6 (cli_scenes_c3c.js) - runs in the same closed page (cli_lib_c3c.js) on B++'s mp.js (with
 * the helper scripts B++'s index.html loads before it: none) and on this tree's (with this tree's helpers), and the traces must be equal
 * byte for byte, with no page error and no undeclared global; a C3c scene must record its own steps (c3c.*).  With --baseline, each
 * C3c scene's trace must also equal the stored one (DIR/hashes.json, written by --write-baseline from B++'s side: the C3c scenes only;
 * Stage 3H0's and 3H2's scenes have their own baselines, in their own page, compared by cli_golden.js and cli_golden_h2.js).
 * And the scenes together must reach mp.js: V8's own coverage counts the functions that ran in any scene.  On B++'s text and on this
 * tree's, every function must run but those listed in UNRUN (each with its reason): a module's new function - a getter, an owner's
 * function, the composition - that no scene runs is a FAIL, so every line C3c wrote is run by some scene.  --missed 1 lists the lines no
 * scene runs (V8's block coverage; for review: a line can hold a branch no scene takes).
 * --mutants FILE: each mutant (FILE exports [{ id, find, repl, scenes, why }]) changes this tree's mp.js once (find must occur exactly
 * once); the scenes it names must then give a trace that differs from the unchanged tree's.  Exit 0 only when every comparison holds
 * (or every mutant is caught). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const L = require('./cli_lib_c3c.js');
const ARG = { 'old-ref': L.BPP };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'write-baseline') ARG[k] = true; else ARG[k] = process.argv[++i]; }
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
/* the functions of mp.js no scene runs, and why (matched by V8's function name; an anonymous one by the start of its text) */
const UNRUN = [
  ['connect', 'only its `file:` and constructor-failure branches are unrun; the function itself runs (listed for its old name only)', 0],
];
const UNRUN_NAMES = new Set(UNRUN.filter(u => u[2]).map(u => u[0]));
/* one side's union over scenes: per function (name@offset) whether it ran; per byte the highest count (V8's innermost range wins) */
function union(text) { return { text, fn: new Map(), bytes: new Int32Array(text.length).fill(-1) }; }
function addCov(u, cov) {
  if (!cov) return;
  const here = new Int32Array(u.text.length).fill(0);
  for (const f of cov) {
    const key = (f.functionName || '(anonymous)') + '@' + f.ranges[0].startOffset;
    if (f.functionName !== '' || f.ranges[0].startOffset > 0) u.fn.set(key, (u.fn.get(key) || 0) + (f.ranges[0].count > 0 ? 1 : 0));
    for (const r of f.ranges) for (let i = r.startOffset; i < r.endOffset && i < here.length; i++) here[i] = r.count;
  }
  for (let i = 0; i < here.length; i++) if (here[i] > u.bytes[i]) u.bytes[i] = here[i];
}
const snippet = (text, off) => text.slice(off, off + 70).replace(/\s+/g, ' ');
function unrun(u) { return [...u.fn].filter(([, n]) => !n).map(([k]) => { const at = +k.split('@')[1], name = k.split('@')[0]; return { name, at, text: snippet(u.text, at) }; }); }
function missedLines(u) {
  const lines = u.text.split('\n'), out = []; let off = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], code = l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim(); let zero = 0, any = 0;
    for (let k = 0; k < l.length; k++) { if (/\s/.test(l[k])) continue; any++; if (u.bytes[off + k] === 0) zero++; }
    if (code && zero) out.push(`${String(i + 1).padStart(5)} ${zero === any ? 'none' : 'part'} ${l.trim().slice(0, 140)}`);
    off += l.length + 1;
  }
  return out;
}
async function compare() {
  const scenes = ARG.scenes ? ARG.scenes.split(',') : L.ALL;
  const OLD = L.fromRef(ARG['old-ref']), NEW = L.fromTree(), browser = await L.launch();
  const R = { tool: 'dev/tools/gate/golden/cli_golden_c3c.js', oldRef: ARG['old-ref'], newSide: 'working tree', chromium: browser.version(), helpers: { old: OLD.helpers.map(h => h.f), new: NEW.helpers.map(h => h.f) },
    startedAt: new Date().toISOString(), scenes: [], ok: true };
  const tmp = ARG.keep ? path.resolve(ARG.keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'c3ccli-')); fs.mkdirSync(tmp, { recursive: true });
  const baseline = ARG.baseline ? JSON.parse(fs.readFileSync(path.join(path.resolve(ARG.baseline), 'hashes.json'), 'utf8')) : null;   // (DIR is the folder of hashes.json)
  const uo = union(OLD.mp.toString('utf8')), un = union(NEW.mp.toString('utf8'));
  for (const sc of scenes) {
    const o = await L.runScene(browser, OLD, sc, { coverage: true }), n = await L.runScene(browser, NEW, sc, { coverage: true });
    addCov(uo, o.cov); addCov(un, n.cov);
    fs.writeFileSync(path.join(tmp, sc + '.old.json'), o.trace); fs.writeFileSync(path.join(tmp, sc + '.new.json'), n.trace);
    const A = JSON.parse(o.trace), B = JSON.parse(n.trace);
    const s = { scene: sc, old: { entries: A.length, sha256: sha(o.trace), errors: o.errs }, new: { entries: B.length, sha256: sha(n.trace), errors: n.errs },
      globalsOnlyInNew: n.globals.filter(g => !o.globals.includes(g)), globalsOnlyInOld: o.globals.filter(g => !n.globals.includes(g)) };
    s.equal = s.old.sha256 === s.new.sha256;
    s.undeclaredGlobals = s.globalsOnlyInNew.filter(g => !L.NEWG.includes(g)).concat(s.globalsOnlyInOld);
    s.steps = sc.startsWith('c3c_') ? B.filter(e => /^c3c\./.test(e[1])).length : null;
    s.thrown = B.filter(e => e[1] === 'scene.throw').map(e => e.slice(2).join(' ')).concat(A.filter(e => e[1] === 'scene.throw').map(e => 'B++: ' + e.slice(2).join(' ')));
    if (!s.equal) for (let i = 0; i < Math.max(A.length, B.length); i++) { const a = JSON.stringify(A[i]), b = JSON.stringify(B[i]); if (a !== b) { s.firstDiff = { index: i, old: (a || '').slice(0, 600), new: (b || '').slice(0, 600) }; break; } }
    if (baseline && (sc.startsWith('c3c_') || baseline.scenes[sc])) { const b = baseline.scenes[sc]; s.baseline = { sha256: b ? b.sha256 : null, equal: !!b && b.sha256 === s.new.sha256 }; }
    s.ok = s.equal && !s.undeclaredGlobals.length && !s.new.errors.length && !s.old.errors.length && !s.thrown.length && (s.steps === null || s.steps > 0) && (!s.baseline || s.baseline.equal);
    R.ok = R.ok && s.ok; R.scenes.push(s);
    console.log(`${s.ok ? 'PASS' : 'FAIL'} ${sc}: B++ ${s.old.entries} entries ${s.old.sha256.slice(0, 12)} | this tree ${s.new.entries} entries ${s.new.sha256.slice(0, 12)}${s.steps !== null ? ' | scene steps ' + s.steps : ''}` +
      `${s.equal ? ' | identical' : ' | DIFFERENT'}${s.baseline ? ' | baseline ' + (s.baseline.equal ? 'same' : 'DIFFERENT') : ''}${s.undeclaredGlobals.length ? ' | UNDECLARED: ' + s.undeclaredGlobals.join(' ') : ''}` +
      `${s.old.errors.length || s.new.errors.length ? ' | errors B++ ' + s.old.errors.length + ' this tree ' + s.new.errors.length : ''}${s.thrown.length ? ' | THROWN: ' + s.thrown.join(' | ').slice(0, 300) : ''}`);
    if (s.firstDiff) console.log('   first difference at entry ' + s.firstDiff.index + '\n   B++:       ' + s.firstDiff.old.slice(0, 400) + '\n   this tree: ' + s.firstDiff.new.slice(0, 400));
    if (s.new.errors.length) console.log('   errors: ' + s.new.errors.slice(0, 3).join(' | '));
  }
  await browser.close();
  /* what the scenes reach together, on each side */
  const all = scenes.length === L.ALL.length;
  const reach = u => { const un2 = unrun(u), bad = un2.filter(x => !UNRUN_NAMES.has(x.name)); return { functions: u.fn.size, ran: u.fn.size - un2.length, unrun: un2, notAllowed: bad, missedLines: missedLines(u) }; };
  R.reach = { old: reach(uo), new: reach(un), allowed: UNRUN.filter(u => u[2]).map(u => ({ name: u[0], why: u[1] })), complete: all };
  R.reached = all ? !R.reach.old.notAllowed.length && !R.reach.new.notAllowed.length : null;
  if (all && !R.reached) R.ok = false;
  console.log(`reach (all ${scenes.length} scenes${all ? '' : ': a subset, not judged'}): B++ ${R.reach.old.ran} of ${R.reach.old.functions} functions run, ${R.reach.old.missedLines.length} lines with code not run; this tree ${R.reach.new.ran} of ${R.reach.new.functions}, ${R.reach.new.missedLines.length} lines` +
    (all ? (R.reached ? ' - REACHED' : ' - NOT REACHED: functions no scene runs: ' + R.reach.old.notAllowed.map(x => 'B++ ' + x.name + '@' + x.at + ' [' + x.text + ']').concat(R.reach.new.notAllowed.map(x => 'tree ' + x.name + '@' + x.at + ' [' + x.text + ']')).join('; ')) : ''));
  if (ARG.missed) { console.log('lines not run, B++:\n' + R.reach.old.missedLines.join('\n')); console.log('lines not run, this tree:\n' + R.reach.new.missedLines.join('\n')); }
  R.finishedAt = new Date().toISOString();
  if (ARG.out) {
    const OUT = path.resolve(ARG.out); fs.mkdirSync(OUT, { recursive: true });
    if (ARG['write-baseline']) {
      const TD = path.join(OUT, 'cli_traces'); fs.mkdirSync(TD, { recursive: true });
      const hashes = { oldRef: ARG['old-ref'], chromium: R.chromium, side: 'B++ (the old side)', page: 'cli_lib_c3c.js (3H2\'s page with the C3c scenes)', scenes: {} };
      for (const s of R.scenes.filter(x => x.scene.startsWith('c3c_'))) { const f = s.scene + '.json.gz'; fs.writeFileSync(path.join(TD, f), zlib.gzipSync(fs.readFileSync(path.join(tmp, s.scene + '.old.json')), { level: 9 })); hashes.scenes[s.scene] = { file: f, sha256: s.old.sha256, entries: s.old.entries }; }
      fs.writeFileSync(path.join(TD, 'hashes.json'), JSON.stringify(hashes, null, 1) + '\n');
    }
    fs.writeFileSync(path.join(OUT, 'cli_golden_c3c_report.json'), JSON.stringify(R, null, 1) + '\n');
  }
  if (!ARG.keep) fs.rmSync(tmp, { recursive: true, force: true });
  console.log(R.ok ? 'client scenes (all, C3c): ALL IDENTICAL, mp.js reached' : 'client scenes (all, C3c): FAIL');
  process.exitCode = R.ok ? 0 : 1;
}
async function mutants() {
  const base = L.fromTree(), list0 = require(path.resolve(ARG.mutants)), only = ARG.only ? ARG.only.split(',') : null, list = list0.filter(m => !only || only.includes(m.id));
  const browser = await L.launch(), R = { tool: 'dev/tools/gate/golden/cli_golden_c3c.js --mutants', file: ARG.mutants, reference: {}, mutants: [], ok: true };
  const text = base.mp.toString('utf8');
  for (const sc of new Set(list.flatMap(m => m.scenes))) R.reference[sc] = sha((await L.runScene(browser, base, sc)).trace);
  for (const m of list) {
    const n = text.split(m.find).length - 1, rec = { id: m.id, why: m.why, found: n, scenes: {} };
    if (n !== 1) { rec.caught = false; rec.applicable = false; }
    else {
      const v = { mp: Buffer.from(text.replace(m.find, m.repl)), helpers: base.helpers }; rec.applicable = true;
      for (const sc of m.scenes) { const r = await L.runScene(browser, v, sc); rec.scenes[sc] = { differs: sha(r.trace) !== R.reference[sc], errors: r.errs.length }; }
      rec.caught = Object.values(rec.scenes).some(x => x.differs);
    }
    R.mutants.push(rec); R.ok = R.ok && rec.caught;
    console.log(`${rec.caught ? 'CAUGHT ' : 'MISSED '} ${m.id}${rec.applicable ? '' : ' (its text is found ' + n + ' times: not applied)'} | ${Object.entries(rec.scenes).map(([s, x]) => s + (x.differs ? ' differs' : ' same')).join(', ')} - ${m.why}`);
  }
  await browser.close();
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`C3C CLIENT MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} (${R.mutants.filter(m => m.caught).length} of ${R.mutants.length} seam mutants caught)`);
  process.exitCode = R.ok ? 0 : 1;
}
(ARG.mutants ? mutants() : compare()).catch(e => { console.error('RUNNER ERROR', e && e.stack || e); process.exitCode = 2; });
