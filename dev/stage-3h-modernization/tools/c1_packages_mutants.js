#!/usr/bin/env node
/* Stage 3H continuation C1 - prove that c1_verify_packages.js refuses what it must (development only; Node 18 or later; no network).
 *
 *   node dev/stage-3h-modernization/tools/c1_packages_mutants.js --dir <the verified folder of .tgz> --work <new, empty folder> [--out FILE.json]
 *
 * Each case copies the verified folder into --work, breaks one thing, runs the verifier on the copy and expects the verdict and the
 * problem named below.  The verified folder itself is only read.  The last case checks the verifier's own anchor: a lockfile that is not
 * the snapshot's (one byte changed, in a copy of the files the verifier reads) is refused even with every tarball intact. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.dir || !ARG.work) { console.error('usage: --dir <verified folder> --work <new, empty folder> [--out FILE.json]'); process.exit(2); }
const SRC = path.resolve(ARG.dir), WORK = path.resolve(ARG.work), VERIFY = path.join(__dirname, 'c1_verify_packages.js');
const REPO = path.resolve(__dirname, '..', '..', '..');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be a new or empty folder'); process.exit(2); }
fs.mkdirSync(WORK, { recursive: true });
const tgz = fs.readdirSync(SRC).filter(f => f.endsWith('.tgz')).sort();
/* a tarball whose package.json text is changed, the same length, so the tar headers stay valid; gzip'd again */
function edit(buf, from, to) {
  if (from.length !== to.length) throw new Error('same length only');
  const tar = zlib.gunzipSync(buf), s = tar.toString('latin1'), i = s.indexOf(from);
  if (i < 0) throw new Error('not found: ' + from);
  return zlib.gzipSync(Buffer.from(s.slice(0, i) + to + s.slice(i + from.length), 'latin1'));
}
const CASES = [
  { id: 'P1', what: 'one package missing (vite)', make: d => fs.rmSync(path.join(d, 'vite-8.3.1.tgz')), expect: /missing: vite@8\.3\.1/ },
  { id: 'P2', what: 'one byte of a tarball changed (gzip no longer valid)', make: d => { const f = path.join(d, 'picocolors-1.1.1.tgz'), b = fs.readFileSync(f); b[Math.floor(b.length / 2)] ^= 0xff; fs.writeFileSync(f, b); }, expect: /picocolors-1\.1\.1\.tgz: (no package\/package\.json inside|.*sha512)/ },
  { id: 'P3', what: 'the same files packed again (a valid tarball, other bytes)', make: d => { const f = path.join(d, 'nanoid-3.3.19.tgz'); fs.writeFileSync(f, zlib.gzipSync(zlib.gunzipSync(fs.readFileSync(f)), { level: 1 })); }, expect: /nanoid@3\.3\.19: its sha512 is not the lockfile's integrity/ },
  { id: 'P4', what: 'another version inside (package.json says 1.1.9)', make: d => { const f = path.join(d, 'picocolors-1.1.1.tgz'); fs.writeFileSync(f, edit(fs.readFileSync(f), '"version": "1.1.1"', '"version": "1.1.9"')); }, expect: /picocolors@1\.1\.9, the lockfile has 1\.1\.1/ },
  { id: 'P5', what: 'a package the lockfile does not have (renamed inside)', make: d => { const f = path.join(d, 'picocolors-1.1.1.tgz'); fs.writeFileSync(f, edit(fs.readFileSync(f), '"name": "picocolors"', '"name": "picocolorz"')); }, expect: /picocolorz is not in the lockfile/ },
  { id: 'P6', what: 'the same package twice (a second file name)', make: d => fs.copyFileSync(path.join(d, 'earcut-3.2.4.tgz'), path.join(d, 'zz-earcut-copy.tgz')), expect: /earcut given twice/ },
  { id: 'P7', what: 'a file renamed to another package\'s name (the verifier reads the package inside, not the name)', make: d => { fs.renameSync(path.join(d, 'earcut-3.2.4.tgz'), path.join(d, 'fdir-6.5.0.tgz.tmp')); fs.renameSync(path.join(d, 'fdir-6.5.0.tgz'), path.join(d, 'earcut-3.2.4.tgz')); fs.renameSync(path.join(d, 'fdir-6.5.0.tgz.tmp'), path.join(d, 'fdir-6.5.0.tgz')); }, expect: null },
  { id: 'P8', what: 'a forged MANIFEST.json (the manifest is reported, never trusted)', make: d => { const m = path.join(d, 'MANIFEST.json'); const j = fs.existsSync(m) ? JSON.parse(fs.readFileSync(m, 'utf8')) : { packages: [] }; for (const p of j.packages) p.sha256 = '0'.repeat(64); fs.writeFileSync(m, JSON.stringify(j)); }, expect: null, manifest: 'DISAGREES' },
];
const R = { tool: 'dev/stage-3h-modernization/tools/c1_packages_mutants.js', dir: SRC, cases: [], ok: false };
function runCase(c, verifier) {
  const d = path.join(WORK, c.id); fs.mkdirSync(d);
  for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(d, f));
  c.make(d);
  const r = spawnSync(process.execPath, [verifier, '--dir', d], { encoding: 'utf8' }), out = r.stdout + r.stderr;
  const verdict = /C1 PACKAGES: VERIFIED/.test(out) ? 'VERIFIED' : 'FAIL';
  const manifest = (out.match(/MANIFEST\.json: (agrees|DISAGREES)/) || [])[1];
  const pass = c.expect ? (verdict === 'FAIL' && r.status !== 0 && c.expect.test(out)) : (verdict === 'VERIFIED' && r.status === 0 && (!c.manifest || manifest === c.manifest));
  R.cases.push({ id: c.id, what: c.what, expected: c.expect ? 'FAIL, ' + c.expect.source : 'VERIFIED' + (c.manifest ? ', manifest ' + c.manifest : ''), verdict, exit: r.status, problems: out.split('\n').filter(l => l.startsWith('PROBLEM ')).map(l => l.slice(8)), manifest, pass });
  console.log(`${pass ? 'as expected' : 'NOT AS EXPECTED'}  ${c.id} ${c.what}: ${verdict}${manifest ? ' (manifest ' + manifest + ')' : ''}`);
  fs.rmSync(d, { recursive: true });
}
for (const c of CASES) runCase(c, VERIFY);
/* P9: the verifier's anchor; a copy of the three files it reads, the lockfile with one byte changed */
{
  const fake = path.join(WORK, 'P9-repo'), lockRel = 'src/core/client/bundle/original-v11/package-lock.json', provRel = 'src/core/client/bundle/ORIGINAL_V11_PROVENANCE.json';
  const toolRel = 'dev/stage-3h-modernization/tools/c1_verify_packages.js';
  for (const rel of [lockRel, provRel, toolRel]) { fs.mkdirSync(path.dirname(path.join(fake, rel)), { recursive: true }); fs.copyFileSync(path.join(REPO, rel), path.join(fake, rel)); }
  const lp = path.join(fake, lockRel), s = fs.readFileSync(lp, 'utf8'); fs.writeFileSync(lp, s.replace('"lockfileVersion": 3', '"lockfileVersion": 3 '));
  runCase({ id: 'P9', what: 'the lockfile is not the snapshot\'s (one byte added), every tarball intact', make: () => {}, expect: /the lockfile is not the one the snapshot's provenance records/ }, path.join(fake, toolRel));
  fs.rmSync(fake, { recursive: true });
}
R.ok = R.cases.every(c => c.pass);
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`C1 PACKAGE MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} (${R.cases.filter(c => c.pass).length} of ${R.cases.length} as expected)`);
process.exitCode = R.ok ? 0 : 1;
