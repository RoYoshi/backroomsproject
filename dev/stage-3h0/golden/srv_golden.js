/* Stage 3H0 - server golden traces: run every scenario on the accepted parent's server.js and on the working tree's server.js, against the
 * same game files, and compare the traces byte for byte (development only).
 *
 *   node dev/stage-3h0/golden/srv_golden.js [--scenarios a,b] [--old-ref edd2af9] [--repeat 1] [--out DIR] [--write-baseline]
 *                                           [--baseline DIR] [--keep DIR]
 *
 *   --old-ref     the commit whose server.js is "old" (default: the accepted QA2 parent edd2af9)
 *   --repeat      run the new code this many extra times and require identical traces (determinism)
 *   --out         where to write the report (srv_golden_report.json)
 *   --write-baseline  also store every trace, gzipped, with its SHA-256, under --out/srv_traces/ (H0-1 baseline)
 *   --baseline    a stored baseline (srv_traces/hashes.json): the new traces must equal it, except HTTP lines about files whose content the
 *                 stage itself changed (those are listed, and their new body hashes are checked against the files on disk)
 *   --keep        keep the raw traces here (default: a temporary directory that is removed)
 * Exit status 0 only when every comparison holds. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const HERE = __dirname, REPO = path.resolve(HERE, '..', '..', '..');
const ARG = { 'old-ref': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b', repeat: '0' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (['write-baseline'].includes(k)) ARG[k] = true; else ARG[k] = process.argv[++i]; }
const ALL = Object.keys(require('./srv_scenarios.js'));
const SCEN = ARG.scenarios ? ARG.scenarios.split(',') : ALL;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const tmp = ARG.keep ? path.resolve(ARG.keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'h0srv-'));
fs.mkdirSync(tmp, { recursive: true });
const oldSrc = path.join(tmp, 'old_server.js');
fs.writeFileSync(oldSrc, execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':server.js']));
const newSrc = path.join(REPO, 'server.js');

function run(src, scen, tag) {
  const out = path.join(tmp, `${scen}.${tag}.jsonl`), st = path.join(tmp, `${scen}.${tag}.struct.json`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(HERE, 'srv_harness.js'), '--src', src, '--dir', REPO, '--scenario', scen, '--out', out, '--struct', st], { encoding: 'utf8', timeout: 900000 });
  const ms = Date.now() - t0;
  const buf = fs.existsSync(out) ? fs.readFileSync(out) : Buffer.alloc(0);
  return { ok: r.status === 0, status: r.status, stdout: (r.stdout || '').trim().slice(-400), stderr: (r.stderr || '').trim().slice(-800), ms, file: out, bytes: buf.length,
    lines: buf.length ? buf.toString('utf8').split('\n').length - 1 : 0, sha256: sha(buf), struct: fs.existsSync(st) ? JSON.parse(fs.readFileSync(st, 'utf8')) : null, buf };
}
function firstDiff(a, b) {
  const A = a.toString('utf8').split('\n'), B = b.toString('utf8').split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) return { line: i + 1, old: (A[i] || '').slice(0, 600), new: (B[i] || '').slice(0, 600) };
  return null;
}
/* files the stage changed (relative to the old ref), for the baseline comparison of HTTP lines */
function changedFiles() {
  const a = execFileSync('git', ['-C', REPO, 'diff', '--name-only', ARG['old-ref']], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const u = execFileSync('git', ['-C', REPO, 'ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  return new Set(a.concat(u));
}
/* a trace line is "about" a changed file when it is an HTTP line whose URL path maps to one */
function httpFileOf(line) {
  try { const e = JSON.parse(line); if (!/^http\./.test(e[1])) return null; let u = e[1] === 'http.req' ? e[3] : e[3]; u = decodeURIComponent(String(u).split('?')[0]); if (u === '/') u = '/index.html'; return u.replace(/^\/+/, ''); } catch (x) { return null; }
}

const report = { tool: 'dev/stage-3h0/golden/srv_golden.js', oldRef: ARG['old-ref'], newSrc: 'server.js (working tree)', dir: REPO, node: process.version,
  startedAt: new Date().toISOString(), scenarios: [], ok: true };
let baseline = null;
if (ARG.baseline) baseline = JSON.parse(fs.readFileSync(path.join(path.resolve(ARG.baseline), 'hashes.json'), 'utf8'));
const changed = baseline ? changedFiles() : null;
for (const s of SCEN) {
  const o = run(oldSrc, s, 'old'), n = run(newSrc, s, 'new');
  const rec = { scenario: s, old: { ok: o.ok, lines: o.lines, bytes: o.bytes, sha256: o.sha256, ms: o.ms }, new: { ok: n.ok, lines: n.lines, bytes: n.bytes, sha256: n.sha256, ms: n.ms },
    equal: o.ok && n.ok && o.sha256 === n.sha256, structNew: n.struct, structOld: o.struct };
  if (!o.ok || !n.ok) rec.errors = { old: o.ok ? null : o.stdout + ' ' + o.stderr, new: n.ok ? null : n.stdout + ' ' + n.stderr };
  if (!rec.equal && o.ok && n.ok) rec.firstDiff = firstDiff(o.buf, n.buf);
  rec.repeats = [];
  for (let k = 0; k < +ARG.repeat; k++) { const r = run(newSrc, s, 'rep' + k); rec.repeats.push({ sha256: r.sha256, equal: r.sha256 === n.sha256 }); if (r.sha256 !== n.sha256) rec.repeatDiff = firstDiff(n.buf, r.buf); }
  if (baseline) {
    const b = baseline.scenarios[s];
    rec.baseline = { sha256: b ? b.sha256 : null, equal: !!b && b.sha256 === n.sha256 };
    if (b && !rec.baseline.equal) {
      const bl = zlib.gunzipSync(fs.readFileSync(path.join(path.resolve(ARG.baseline), b.file))).toString('utf8').split('\n'), nl = n.buf.toString('utf8').split('\n');
      const exp = [], unexp = [];
      for (let i = 0; i < Math.max(bl.length, nl.length); i++) {
        if (bl[i] === nl[i]) continue;
        const f = httpFileOf(bl[i] || '') || httpFileOf(nl[i] || '');
        if (f && changed.has(f) && bl.length === nl.length) exp.push({ line: i + 1, file: f }); else { unexp.push({ line: i + 1, baseline: (bl[i] || '').slice(0, 400), now: (nl[i] || '').slice(0, 400) }); if (unexp.length > 5) break; }
      }
      rec.baseline.expectedContentChanges = exp; rec.baseline.unexpected = unexp; rec.baseline.equalExceptChangedFiles = !unexp.length && bl.length === nl.length;
    }
  }
  rec.ok = rec.equal && rec.repeats.every(r => r.equal) && (!baseline || rec.baseline.equal || rec.baseline.equalExceptChangedFiles);
  report.ok = report.ok && rec.ok;
  report.scenarios.push(rec);
  console.log(`${rec.ok ? 'PASS' : 'FAIL'} ${s}: old ${o.lines} lines ${o.sha256.slice(0, 12)} (${o.ms} ms) | new ${n.lines} lines ${n.sha256.slice(0, 12)} (${n.ms} ms)` +
    `${rec.equal ? ' | identical' : ' | DIFFERENT'}${rec.repeats.length ? ' | repeats ' + rec.repeats.map(r => r.equal ? 'same' : 'DIFF').join(',') : ''}` +
    `${baseline ? ' | baseline ' + (rec.baseline.equal ? 'same' : rec.baseline.equalExceptChangedFiles ? 'same except ' + rec.baseline.expectedContentChanges.length + ' lines about changed files' : 'DIFFERENT') : ''}` +
    `${n.struct && n.struct.newRequires.length ? ' | new requires: ' + n.struct.newRequires.join(' ') : ''}`);
  if (!rec.ok && rec.firstDiff) console.log('   first difference at line ' + rec.firstDiff.line + '\n   old: ' + rec.firstDiff.old.slice(0, 300) + '\n   new: ' + rec.firstDiff.new.slice(0, 300));
  if (rec.errors) console.log('   errors: ' + JSON.stringify(rec.errors).slice(0, 800));
}
report.finishedAt = new Date().toISOString();
if (ARG.out) {
  const OUT = path.resolve(ARG.out); fs.mkdirSync(OUT, { recursive: true });
  if (ARG['write-baseline']) {
    const TD = path.join(OUT, 'srv_traces'); fs.mkdirSync(TD, { recursive: true });
    const hashes = { oldRef: ARG['old-ref'], node: process.version, scenarios: {} };
    for (const r of report.scenarios) {
      const f = `${r.scenario}.jsonl.gz`, raw = fs.readFileSync(path.join(tmp, `${r.scenario}.new.jsonl`));
      fs.writeFileSync(path.join(TD, f), zlib.gzipSync(raw, { level: 9 }));
      hashes.scenarios[r.scenario] = { file: f, sha256: r.new.sha256, lines: r.new.lines, bytes: r.new.bytes };
    }
    fs.writeFileSync(path.join(TD, 'hashes.json'), JSON.stringify(hashes, null, 1) + '\n');
  }
  fs.writeFileSync(path.join(OUT, 'srv_golden_report.json'), JSON.stringify(report, null, 1) + '\n');
}
if (!ARG.keep) fs.rmSync(tmp, { recursive: true, force: true });
console.log(report.ok ? 'server golden traces: ALL IDENTICAL' : 'server golden traces: DIFFERENCES FOUND');
process.exitCode = report.ok ? 0 : 1;
