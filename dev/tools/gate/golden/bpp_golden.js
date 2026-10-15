/* Stage 3H engine modernization - the B++ golden traces on either layout (development only; never served).  A copy of Stage 3H1's
 * dev/stage-3h/golden/bpp_golden.js (left as it is for the frozen layout), with two differences:
 *   - the harness is the layout-aware copy (dev/tools/gate/golden/srv_harness.js);
 *   - the old server.js runs against the working tree's runtime written under its old names into a scratch folder (dev/tools/layout.js
 *     projectOld), because a pre-modernization server.js requires ./sim.js; the new server.js runs in the working tree.  As before, only
 *     server.js's text differs between the two sides.
 * The scenarios are still srv_scenarios_bpp.js (dev/stage-3h/golden/), unless --scenarios names another scenario module (continuation C2:
 * dev/tools/gate/golden/srv_scenarios_session.js, the session and the admin login).
 *
 *   node dev/tools/gate/golden/bpp_golden.js [--old-ref 143b63f] [--repeat 1] [--out DIR] [--write-baseline] [--baseline DIR] [--keep DIR]
 *                                            [--scenarios FILE]   (C2: another scenario module; its report is named after the file)
 *
 * The original's description follows.
 *
 *   --old-ref         the commit whose server.js is "old" (default: the accepted B++ head 143b63f)
 *   --repeat          run the new code this many extra times: every repeat must give the same bytes (determinism)
 *   --write-baseline  store every new trace, gzipped, with its SHA-256, under DIR/bpp_traces/ (hashes.json)
 *   --baseline        a stored baseline (DIR/hashes.json): the new traces must equal it byte for byte
 * Both sides run against the working tree's other files (sim.js, ai.js, world.js, death_srv.js, server/*): only server.js differs.
 * Exit 0 only when every comparison holds. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const HERE = __dirname, REPO = path.resolve(HERE, '..', '..', '..', '..'), HARNESS = path.join(HERE, 'srv_harness.js');
const LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
const ARG = { 'old-ref': '143b63ff42b88c6780c5043e0f61d64100f81f40', repeat: '1' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'write-baseline') ARG[k] = true; else ARG[k] = process.argv[++i]; }
const SCEN_FILE = ARG.scenarios ? path.resolve(ARG.scenarios) : path.join(REPO, 'dev', 'stage-3h', 'golden', 'srv_scenarios_bpp.js');   // (C2) --scenarios
const REPORT = ARG.scenarios ? path.basename(SCEN_FILE, '.js') + '_report.json' : 'bpp_golden_report.json';
const SCEN = Object.keys(require(SCEN_FILE));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const tmp = ARG.keep ? path.resolve(ARG.keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'h1bpp-')); fs.mkdirSync(tmp, { recursive: true });
const oldSrc = path.join(tmp, 'old_server.js'); fs.writeFileSync(oldSrc, execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':server.js']));
const PROJ = path.join(tmp, 'old_layout'); fs.mkdirSync(PROJ, { recursive: true }); const PROJECTED = LAYOUT.projectOld(REPO, PROJ);   // (this copy)
const run = (src, scen, tag) => {
  const out = path.join(tmp, `${scen}.${tag}.jsonl`), st = path.join(tmp, `${scen}.${tag}.struct.json`), t0 = Date.now();
  const r = spawnSync(process.execPath, [HARNESS, '--src', src, '--dir', src === oldSrc ? PROJ : REPO, '--scenario', scen, '--out', out, '--struct', st, '--scenarios', SCEN_FILE], { encoding: 'utf8', timeout: 900000 });
  const buf = fs.existsSync(out) ? fs.readFileSync(out) : Buffer.alloc(0);
  return { ok: r.status === 0, status: r.status, stderr: (r.stderr || '').trim().slice(-600), ms: Date.now() - t0, bytes: buf.length, lines: buf.length ? buf.toString('utf8').split('\n').length - 1 : 0, sha256: sha(buf), buf };
};
const base = ARG.baseline ? JSON.parse(fs.readFileSync(path.join(path.resolve(ARG.baseline), 'hashes.json'), 'utf8')) : null;
const R = { tool: 'dev/tools/gate/golden/bpp_golden.js', scenarios: path.relative(REPO, SCEN_FILE).split(path.sep).join('/'), oldRef: ARG['old-ref'], newSide: 'working tree', oldDir: 'the working tree\'s runtime under its old names (' + PROJECTED.length + ' files)', node: process.version, scenarios: [], ok: true };
const outDir = ARG.out ? path.resolve(ARG.out) : null; if (outDir) fs.mkdirSync(outDir, { recursive: true });
const bdir = outDir && ARG['write-baseline'] ? path.join(outDir, 'bpp_traces') : null; if (bdir) fs.mkdirSync(bdir, { recursive: true });
const hashes = {};
for (const sc of SCEN) {
  const o = run(oldSrc, sc, 'old'), n = run(path.join(REPO, 'server.js'), sc, 'new'), reps = [];
  for (let i = 0; i < +ARG.repeat; i++) reps.push(run(path.join(REPO, 'server.js'), sc, 'rep' + i));
  const rec = { scenario: sc, old: { ok: o.ok, lines: o.lines, sha256: o.sha256, ms: o.ms, stderr: o.stderr }, new: { ok: n.ok, lines: n.lines, sha256: n.sha256, ms: n.ms, stderr: n.stderr },
    identical: o.ok && n.ok && o.sha256 === n.sha256, deterministic: reps.every(x => x.ok && x.sha256 === n.sha256), repeats: reps.map(x => x.sha256) };
  if (base) rec.baseline = { expected: base[sc] || null, equal: base[sc] === n.sha256 };
  rec.ok = rec.identical && rec.deterministic && (!base || rec.baseline.equal);
  if (bdir) { fs.writeFileSync(path.join(bdir, sc + '.jsonl.gz'), zlib.gzipSync(n.buf, { level: 9 })); hashes[sc] = n.sha256; }
  R.scenarios.push(rec); R.ok = R.ok && rec.ok;
  console.log(`${rec.ok ? 'PASS' : 'FAIL'} ${sc}: old ${o.lines} lines ${o.sha256.slice(0, 12)} | new ${n.lines} lines ${n.sha256.slice(0, 12)} | ${rec.identical ? 'identical' : 'DIFFERENT'} | repeats ${rec.deterministic ? 'same' : 'DIFFER'}${base ? ' | baseline ' + (rec.baseline.equal ? 'equal' : 'DIFFERENT') : ''}${n.stderr ? ' | stderr: ' + n.stderr.slice(0, 200) : ''}`);
}
if (bdir) fs.writeFileSync(path.join(bdir, 'hashes.json'), JSON.stringify(hashes, null, 1) + '\n');
if (outDir) fs.writeFileSync(path.join(outDir, REPORT), JSON.stringify(R, null, 1) + '\n');
if (!ARG.keep) fs.rmSync(tmp, { recursive: true, force: true });
console.log(`B++ golden traces: ${R.ok ? 'ALL IDENTICAL' : 'NOT IDENTICAL'}`);
process.exit(R.ok ? 0 : 1);
