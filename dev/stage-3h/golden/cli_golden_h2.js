/* Stage 3H2 (before C-3) - client golden traces of NEW RUN's client side: B++'s mp.js (with its helper scripts) against the working
 * tree's, in Stage 3H0's fake-clock page with B++'s NEW RUN button and run menu added (cli_lib_h2.js), scenes cli_scenes_nr.js
 * (development only).
 *
 *   node dev/stage-3h/golden/cli_golden_h2.js [--scenes a,b] [--old-ref 143b63f] [--new-ref REF] [--repeat 1] [--out DIR] [--write-baseline]
 *                                             [--baseline DIR] [--keep DIR]
 *   node dev/stage-3h/golden/cli_golden_h2.js --mutants 1 [--out FILE.json]
 *
 * The comparison is Stage 3H0's cli_golden.js's, byte for byte, with the same report (cli_golden_report.json) and baseline layout
 * (DIR/cli_traces/hashes.json).  --mutants: one small change at a time to the working tree's NEW RUN client code, found in mp.js or in
 * whichever helper script now holds its text (so the mutants follow the code into a helper), each run through both scenes; every mutant
 * must change a trace.  Exit 0 only when every comparison holds (or every mutant is caught). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const L = require('./cli_lib_h2.js');
const ARG = { 'old-ref': L.BPP, repeat: '0' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'write-baseline') ARG[k] = true; else ARG[k] = process.argv[++i]; }
const SCENES = ARG.scenes ? ARG.scenes.split(',') : L.SCENES;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const MUTANTS = [
  ['the waiting mark is three dots', "nrButton('…'); tx({ t: 'nr', q, w: worldW });", "nrButton('...'); tx({ t: 'nr', q, w: worldW });"],
  ['the cooldown wait rounded, not rounded up', "'WAIT ' + Math.ceil(+m.wait || 0) + ' S'", "'WAIT ' + Math.round(+m.wait || 0) + ' S'"],
  ['a refusal shows for 2 s', "if (text && text !== '…') nrTold = setTimeout(() => nrButton(''), 2500);", "if (text && text !== '…') nrTold = setTimeout(() => nrButton(''), 2000);"],
  ['the button stays enabled while waiting', "b.disabled = text === '…';", 'b.disabled = false;'],
  ['a double press within 200 ms', 't - nrBusyAt < 300) return true;', 't - nrBusyAt < 200) return true;'],
  ['no answer for 3 s before the button comes back', "if (nrBusy === 1) { nrBusy = 0; nrButton(''); } }, 2500);", "if (nrBusy === 1) { nrBusy = 0; nrButton(''); } }, 3000);"],
  ['the run menu says something else after a blast', "e.textContent = boom ? 'YOU BLEW YOURSELF UP' : e.dataset.fade;", "e.textContent = boom ? 'YOU BLEW UP' : e.dataset.fade;"],
  ['join keeps the blast words', 'join() { nrBusy = 0; runMenuWords(false);', 'join() { nrBusy = 0;'],
  ['the approval does not call the beat', 'runMenuWords(true); if (ok) ok(m); }', 'runMenuWords(true); }'],
  ['a refused press keeps the client busy', "else { nrBusy = 0; nrButton(m.why === 'cooldown'", "else { nrButton(m.why === 'cooldown'"],
  ['a closed connection keeps the press', "nrSent.clear(); nrBusy = 0; worldW = null; clearTimeout(nrWaitT); nrButton('');", "nrBusy = 0; worldW = null; clearTimeout(nrWaitT); nrButton('');"],
];
async function compare() {
  const OLD = L.fromRef(ARG['old-ref']), NEW = ARG['new-ref'] ? L.fromRef(ARG['new-ref']) : L.fromTree();
  const browser = await L.launch();
  const report = { tool: 'dev/stage-3h/golden/cli_golden_h2.js', oldRef: ARG['old-ref'], newSide: ARG['new-ref'] ? 'ref ' + ARG['new-ref'] : 'working tree', chromium: browser.version(),
    helpers: { old: OLD.helpers.map(h => h.f), new: NEW.helpers.map(h => h.f) }, declaredNewGlobals: L.NEWG, startedAt: new Date().toISOString(), scenes: [], ok: true };
  const tmp = ARG.keep ? path.resolve(ARG.keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'h2cli-')); fs.mkdirSync(tmp, { recursive: true });
  let baseline = null; if (ARG.baseline) baseline = JSON.parse(fs.readFileSync(path.join(path.resolve(ARG.baseline), 'hashes.json'), 'utf8'));
  for (const sc of SCENES) {
    const t0 = Date.now(); const o = await L.runScene(browser, OLD, sc); const t1 = Date.now(); const n = await L.runScene(browser, NEW, sc); const t2 = Date.now();
    fs.writeFileSync(path.join(tmp, sc + '.old.json'), o.trace); fs.writeFileSync(path.join(tmp, sc + '.new.json'), n.trace);
    const rec = { scene: sc, old: { entries: JSON.parse(o.trace).length, bytes: o.trace.length, sha256: sha(o.trace), ms: t1 - t0, errors: o.errs },
      new: { entries: JSON.parse(n.trace).length, bytes: n.trace.length, sha256: sha(n.trace), ms: t2 - t1, errors: n.errs },
      globalsOnlyInNew: n.globals.filter(g => !o.globals.includes(g)), globalsOnlyInOld: o.globals.filter(g => !n.globals.includes(g)) };
    rec.equal = rec.old.sha256 === rec.new.sha256;
    rec.undeclaredGlobals = rec.globalsOnlyInNew.filter(g => !L.NEWG.includes(g)).concat(rec.globalsOnlyInOld);
    rec.nrSteps = JSON.parse(n.trace).filter(e => e[1] === 'nr.ui').length;                     // the scene's own records: a scene that recorded none is a FAIL
    if (!rec.equal) { const A = JSON.parse(o.trace), B = JSON.parse(n.trace); for (let i = 0; i < Math.max(A.length, B.length); i++) { const a = JSON.stringify(A[i]), b = JSON.stringify(B[i]); if (a !== b) { rec.firstDiff = { index: i, old: (a || '').slice(0, 500), new: (b || '').slice(0, 500) }; break; } } }
    rec.repeats = [];
    for (let k = 0; k < +ARG.repeat; k++) { const r = await L.runScene(browser, NEW, sc); rec.repeats.push({ sha256: sha(r.trace), equal: sha(r.trace) === rec.new.sha256 }); }
    if (baseline) { const b = baseline.scenes[sc]; rec.baseline = { sha256: b ? b.sha256 : null, equal: !!b && b.sha256 === rec.new.sha256 }; }
    rec.ok = rec.equal && rec.nrSteps > 0 && !rec.undeclaredGlobals.length && !rec.new.errors.length && !rec.old.errors.length && rec.repeats.every(x => x.equal) && (!baseline || rec.baseline.equal);
    report.ok = report.ok && rec.ok; report.scenes.push(rec);
    console.log(`${rec.ok ? 'PASS' : 'FAIL'} ${sc}: old ${rec.old.entries} entries ${rec.old.sha256.slice(0, 12)} | new ${rec.new.entries} entries ${rec.new.sha256.slice(0, 12)} | NEW RUN steps ${rec.nrSteps}` +
      `${rec.equal ? ' | identical' : ' | DIFFERENT'}${rec.repeats.length ? ' | repeats ' + rec.repeats.map(x => x.equal ? 'same' : 'DIFF').join(',') : ''}${baseline ? ' | baseline ' + (rec.baseline.equal ? 'same' : 'DIFFERENT') : ''}` +
      `${rec.undeclaredGlobals.length ? ' | UNDECLARED: ' + rec.undeclaredGlobals.join(' ') : ''}${rec.old.errors.length || rec.new.errors.length ? ' | errors old ' + rec.old.errors.length + ' new ' + rec.new.errors.length : ''}`);
    if (rec.firstDiff) console.log('   first difference at entry ' + rec.firstDiff.index + '\n   old: ' + rec.firstDiff.old.slice(0, 300) + '\n   new: ' + rec.firstDiff.new.slice(0, 300));
    if (rec.new.errors.length) console.log('   new errors: ' + rec.new.errors.slice(0, 3).join(' | '));
  }
  await browser.close();
  report.finishedAt = new Date().toISOString();
  if (ARG.out) {
    const OUT = path.resolve(ARG.out); fs.mkdirSync(OUT, { recursive: true });
    if (ARG['write-baseline']) {
      const TD = path.join(OUT, 'cli_traces'); fs.mkdirSync(TD, { recursive: true });
      const hashes = { oldRef: ARG['old-ref'], chromium: report.chromium, scenes: {} };
      for (const r of report.scenes) { const f = r.scene + '.json.gz'; fs.writeFileSync(path.join(TD, f), zlib.gzipSync(fs.readFileSync(path.join(tmp, r.scene + '.new.json')), { level: 9 })); hashes.scenes[r.scene] = { file: f, sha256: r.new.sha256, entries: r.new.entries }; }
      fs.writeFileSync(path.join(TD, 'hashes.json'), JSON.stringify(hashes, null, 1) + '\n');
    }
    fs.writeFileSync(path.join(OUT, 'cli_golden_report.json'), JSON.stringify(report, null, 1) + '\n');
  }
  if (!ARG.keep) fs.rmSync(tmp, { recursive: true, force: true });
  console.log(report.ok ? 'NEW RUN client golden traces: ALL IDENTICAL' : 'NEW RUN client golden traces: DIFFERENCES FOUND');
  process.exitCode = report.ok ? 0 : 1;
}
async function mutants() {
  const base = L.fromTree(), browser = await L.launch(), R = { tool: 'dev/stage-3h/golden/cli_golden_h2.js --mutants', source: 'working tree', reference: {}, mutants: [], ok: true };
  for (const sc of SCENES) R.reference[sc] = sha((await L.runScene(browser, base, sc)).trace);
  for (const [why, find, repl] of MUTANTS) {
    const files = [['mp.js', base.mp]].concat(base.helpers.map(h => [h.f, h.body])), where = files.filter(([, b]) => b.toString('utf8').split(find).length === 2), all = files.filter(([, b]) => b.toString('utf8').includes(find));
    const rec = { why, find, repl, foundIn: all.map(([f]) => f), scenes: {} };
    if (where.length !== 1 || all.length !== 1) { rec.applicable = false; rec.caught = false; }
    else {
      const f = where[0][0], text = where[0][1].toString('utf8').replace(find, repl);
      const v = f === 'mp.js' ? { mp: Buffer.from(text), helpers: base.helpers } : { mp: base.mp, helpers: base.helpers.map(h => h.f === f ? { f, body: Buffer.from(text) } : h) };
      rec.applicable = true; rec.file = f;
      for (const sc of SCENES) { const r = await L.runScene(browser, v, sc); rec.scenes[sc] = { differs: sha(r.trace) !== R.reference[sc], errors: r.errs.length }; }
      rec.caught = Object.values(rec.scenes).some(x => x.differs);
    }
    R.mutants.push(rec); R.ok = R.ok && rec.caught;
    console.log(`${rec.caught ? 'CAUGHT ' : 'MISSED '} ${why}${rec.file ? ' (' + rec.file + ')' : ' (text found in ' + (rec.foundIn.join(', ') || 'no file') + ': not applied)'} | ${Object.entries(rec.scenes).map(([s, x]) => s + (x.differs ? ' differs' : ' same')).join(', ')}`);
  }
  await browser.close();
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`NEW RUN client mutants: ${R.mutants.filter(m => m.caught).length}/${R.mutants.length} caught`);
  process.exitCode = R.ok ? 0 : 1;
}
(ARG.mutants ? mutants() : compare()).catch(e => { console.error('RUNNER ERROR', e && e.stack || e); process.exitCode = 2; });
