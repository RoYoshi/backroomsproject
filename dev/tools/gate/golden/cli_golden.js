/* Stage 3H engine modernization - client golden traces on either layout (development only).  A copy of Stage 3H0's
 * dev/stage-3h0/golden/cli_golden.js (left as it is for the frozen layout) that uses the layout-aware page runner (cli_lib.js here: each
 * side's files are read from its web root).  The default --old-ref is the accepted B++ head 143b63f.  Otherwise the original:
 *
 * Client golden traces: run every scene on the accepted parent's mp.js and on the working tree's mp.js (with whatever helper
 * scripts the working tree's index.html loads between glitch.js and mp.js), in the same fake-clock page, and compare byte for byte.
 *
 *   node dev/tools/gate/golden/cli_golden.js [--scenes a,b] [--old-ref 143b63f] [--new-ref REF] [--repeat 1] [--out DIR] [--write-baseline] [--baseline DIR] [--keep DIR]
 *
 *   --new-ref     take the "new" side from a commit instead of the working tree (e.g. to rebuild a baseline from the parent's own code)
 *
 * Globals that the working tree adds on purpose are listed in declared_new_globals.json: they are left out of the strict trace and reported
 * on their own (like the server harness's new requires), so the new namespace is visible without hiding any other change.
 * Exit status 0 only when every comparison holds. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const L = require('./cli_lib.js');
const ARG = { 'old-ref': '143b63ff42b88c6780c5043e0f61d64100f81f40', repeat: '0' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'write-baseline') ARG[k] = true; else ARG[k] = process.argv[++i]; }
const SCENES = ARG.scenes ? ARG.scenes.split(',') : L.SCENES;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const AX = require('./approved_ext.js');   // (R20 B++ killer identity) the one approved B++ extension, e, taken out again before a comparison with B++
(async () => {
  const OLD = L.fromRef(ARG['old-ref']), NEW = ARG['new-ref'] ? L.fromRef(ARG['new-ref']) : L.fromTree();
  const browser = await L.launch();
  const report = { tool: 'dev/tools/gate/golden/cli_golden.js', oldRef: ARG['old-ref'], newSide: ARG['new-ref'] ? 'ref ' + ARG['new-ref'] : 'working tree', chromium: browser.version(), helpers: { old: OLD.helpers.map(h => h.f), new: NEW.helpers.map(h => h.f) },
    declaredNewGlobals: L.NEWG, startedAt: new Date().toISOString(), scenes: [], ok: true };
  const tmp = ARG.keep ? path.resolve(ARG.keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'h0cli-')); fs.mkdirSync(tmp, { recursive: true });
  let baseline = null; if (ARG.baseline) baseline = JSON.parse(fs.readFileSync(path.join(path.resolve(ARG.baseline), 'hashes.json'), 'utf8'));
  for (const sc of SCENES) {
    const t0 = Date.now(); const o = await L.runScene(browser, OLD, sc); const t1 = Date.now(); const n = await L.runScene(browser, NEW, sc); const t2 = Date.now();
    fs.writeFileSync(path.join(tmp, sc + '.old.json'), o.trace); fs.writeFileSync(path.join(tmp, sc + '.new.json'), n.trace);
    const rec = { scene: sc, old: { entries: JSON.parse(o.trace).length, bytes: o.trace.length, sha256: sha(o.trace), ms: t1 - t0, errors: o.errs },
      new: { entries: JSON.parse(n.trace).length, bytes: n.trace.length, sha256: sha(n.trace), ms: t2 - t1, errors: n.errs },
      globalsOnlyInNew: n.globals.filter(g => !o.globals.includes(g)), globalsOnlyInOld: o.globals.filter(g => !n.globals.includes(g)) };
    rec.equal = rec.old.sha256 === rec.new.sha256;
    if (!rec.equal) { rec.approved = AX.cliCompare(o.trace, n.trace); rec.equalExceptApproved = rec.approved.equal; }   // (R20 B++) what e changes on a page, and nothing else
    rec.undeclaredGlobals = rec.globalsOnlyInNew.filter(g => !L.NEWG.includes(g)).concat(rec.globalsOnlyInOld);
    if (!rec.equal) { const A = JSON.parse(o.trace), B = JSON.parse(n.trace); for (let i = 0; i < Math.max(A.length, B.length); i++) { const a = JSON.stringify(A[i]), b = JSON.stringify(B[i]); if (a !== b) { rec.firstDiff = { index: i, old: (a || '').slice(0, 500), new: (b || '').slice(0, 500) }; break; } } }
    rec.repeats = [];
    for (let k = 0; k < +ARG.repeat; k++) { const r = await L.runScene(browser, NEW, sc); rec.repeats.push({ sha256: sha(r.trace), equal: sha(r.trace) === rec.new.sha256 }); }
    if (baseline) { const b = baseline.scenes[sc]; rec.baseline = { sha256: b ? b.sha256 : null, equal: !!b && b.sha256 === rec.new.sha256 };
      if (b && !rec.baseline.equal) { const bf = path.join(path.resolve(ARG.baseline), b.file), bt = fs.existsSync(bf) ? zlib.gunzipSync(fs.readFileSync(bf)) : null; const c = bt && sha(bt) === b.sha256 ? AX.cliCompare(bt.toString('utf8'), n.trace) : { equal: false, why: ['the stored trace is missing or is not the one its hash names'] }; rec.baseline.approved = c; rec.baseline.equalExceptApproved = c.equal; } }
    rec.ok = (rec.equal || rec.equalExceptApproved === true) && !rec.undeclaredGlobals.length && !rec.new.errors.length && !rec.old.errors.length && rec.repeats.every(x => x.equal) && (!baseline || rec.baseline.equal || rec.baseline.equalExceptApproved === true);
    report.ok = report.ok && rec.ok; report.scenes.push(rec);
    console.log(`${rec.ok ? 'PASS' : 'FAIL'} ${sc}: old ${rec.old.entries} entries ${rec.old.sha256.slice(0, 12)} (${rec.old.ms} ms) | new ${rec.new.entries} entries ${rec.new.sha256.slice(0, 12)} (${rec.new.ms} ms)` +
      `${rec.equal ? ' | identical' : rec.equalExceptApproved ? ' | identical except the approved e (' + rec.approved.differing + ' moments hide fewer)' : ' | DIFFERENT'}${rec.repeats.length ? ' | repeats ' + rec.repeats.map(x => x.equal ? 'same' : 'DIFF').join(',') : ''}${baseline ? ' | baseline ' + (rec.baseline.equal ? 'same' : rec.baseline.equalExceptApproved ? 'same except the approved e' : 'DIFFERENT') : ''}` +
      `${rec.globalsOnlyInNew.length ? ' | new globals: ' + rec.globalsOnlyInNew.join(' ') : ''}${rec.undeclaredGlobals.length ? ' | UNDECLARED: ' + rec.undeclaredGlobals.join(' ') : ''}` +
      `${rec.old.errors.length || rec.new.errors.length ? ' | errors old ' + rec.old.errors.length + ' new ' + rec.new.errors.length : ''}`);
    if (rec.approved && !rec.approved.equal) console.log('   not the approved extension: ' + rec.approved.why.slice(0, 3).join(' / ').slice(0, 600));
    if (rec.baseline && rec.baseline.approved && !rec.baseline.approved.equal) console.log('   baseline, not the approved extension: ' + rec.baseline.approved.why.slice(0, 3).join(' / ').slice(0, 600));
    if (rec.firstDiff && !rec.equalExceptApproved) console.log('   first difference at entry ' + rec.firstDiff.index + '\n   old: ' + rec.firstDiff.old.slice(0, 300) + '\n   new: ' + rec.firstDiff.new.slice(0, 300));
    if (rec.new.errors.length) console.log('   new errors: ' + rec.new.errors.slice(0, 3).join(' | '));
  }
  await browser.close();
  report.finishedAt = new Date().toISOString();
  if (ARG.out) {
    const OUT = path.resolve(ARG.out); fs.mkdirSync(OUT, { recursive: true });
    if (ARG['write-baseline']) {
      const TD = path.join(OUT, 'cli_traces'); fs.mkdirSync(TD, { recursive: true });
      const hashes = { oldRef: ARG['old-ref'], chromium: report.chromium, scenes: {} };
      for (const r of report.scenes) { const f = r.scene + '.json.gz'; fs.writeFileSync(path.join(TD, f), zlib.gzipSync(fs.readFileSync(path.join(tmp, r.scene + '.new.json')), { level: 9 })); hashes.scenes[r.scene] = { file: f, sha256: r.new.sha256, entries: r.new.entries, bytes: r.new.bytes }; }
      fs.writeFileSync(path.join(TD, 'hashes.json'), JSON.stringify(hashes, null, 1) + '\n');
    }
    fs.writeFileSync(path.join(OUT, 'cli_golden_report.json'), JSON.stringify(report, null, 1) + '\n');
  }
  if (!ARG.keep) fs.rmSync(tmp, { recursive: true, force: true });
  console.log(report.ok ? 'client golden traces: ALL IDENTICAL' + (report.scenes.some(s => s.equalExceptApproved || (s.baseline && s.baseline.equalExceptApproved)) ? ' EXCEPT THE APPROVED e' : '') : 'client golden traces: DIFFERENCES FOUND');
  process.exitCode = report.ok ? 0 : 1;
})().catch(e => { console.error('RUNNER ERROR', e && e.stack || e); process.exitCode = 2; });
