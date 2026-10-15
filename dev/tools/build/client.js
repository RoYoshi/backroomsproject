#!/usr/bin/env node
/* dev/tools/build/client.js - the compiled client's build: src/core/client/game/ (TypeScript, PixiJS, Vite) to the files the page loads
 * (development tool; Node 18 or later and npm; no network).  Stage 3H continuation C4 (docs/architecture/ADRS/ADR-002-client-bundle-source.md).
 *
 *   node dev/tools/build/client.js --packages <folder of .tgz> --stage <new folder>   build into a staging folder (never public/)
 *   node dev/tools/build/client.js --packages <folder of .tgz> --check                build, and compare with public/assets/ and the record
 *   node dev/tools/build/client.js --packages <folder of .tgz> --write                build into public/assets/ and write the record
 *   node dev/tools/build/client.js --record-check                                      no build, no packages: the record against the tree
 *   options: --work <folder> (keep the install there and reuse it while the lockfile and the packages are the same), --out FILE.json
 *
 * A build:
 *   1. checks the packages against the tree's lockfile (dev/tools/build/packages.js: each tarball by the package.json inside it, its
 *      SHA-512 the lockfile's integrity; exactly what Linux x64 needs).  The tree's lockfile must be the recovered v11 project's,
 *      byte for byte (ORIGINAL_V11_PROVENANCE.json): a change of dependency is its own, separately approved step, never a side effect;
 *   2. copies the tree (without node_modules/ and dist/) into the work folder and installs the packages there, offline
 *      (`npm ci --offline --ignore-scripts`, a private cache, an empty npmrc);
 *   3. runs the tree's own `npm run build` (tsc --noEmit && vite build);
 *   4. takes dist/assets/*.js and *.css: the bundle (assets/index-DKbV5Nv9.js), its stylesheet (assets/index-D7hdwmUU.css) and the
 *      PixiJS chunks, but PixiJS's web-worker entry, which the page has never been served (NOT_SHIPPED).  Never a source map, never an
 *      HTML page (public/index.html is the page's own source), never a texture.
 * The record, generated/CLIENT_BUILD.json, lists every file of the tree with its SHA-256 and every output with its size and SHA-256 (and
 * nothing machine-specific).  --record-check needs no packages: every file of the tree must be the one recorded (a source edited and not
 * built fails) and every output in public/assets/ the one recorded (an output edited by hand fails).  --write removes an output of the
 * previous record that the new build no longer makes. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), { spawnSync } = require('child_process');
const P = require('./packages.js');
const REPO = path.resolve(__dirname, '..', '..', '..');
const TREE = 'src/core/client/game', RECORD = 'generated/CLIENT_BUILD.json', ASSETS = 'public/assets';
const V11 = 'src/core/client/bundle/original-v11';
/* a file the build makes that the page has never been served: PixiJS's entry for a web worker (the game runs PixiJS on the page only;
   v11's deployed folder and every later one have no such file, though v11's dist/ has it). It is left out of the outputs. */
const NOT_SHIPPED = { 'webworkerAll-ByhiNG9W.js': "PixiJS's web-worker entry: never loaded by the page, never in the shipped assets" };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (['check', 'write', 'record-check'].includes(k)) ARG[k] = true; else ARG[k] = process.argv[++i]; }

/* every file of the tree, but what a build or an install leaves there */
function treeFiles() {
  const out = [], walk = rel => { for (const e of fs.readdirSync(path.join(REPO, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel + '/' + e.name; if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(r); } else out.push(r); } };
  walk(TREE); return out;
}
const record = (outputs) => ({
  note: 'Written by dev/tools/build/client.js. The compiled client: every file of its source tree and every file the build gives, with SHA-256. Do not edit: build with dev/tools/build/client.js --write.',
  tree: TREE, tool: 'dev/tools/build/client.js',
  sources: treeFiles().map(p => ({ path: p, sha256: sha(fs.readFileSync(path.join(REPO, p))) })),
  outputs,
});

function recordCheck() {
  const f = path.join(REPO, RECORD); if (!fs.existsSync(f)) return { ok: false, problems: [`${RECORD} does not exist`] };
  const R = JSON.parse(fs.readFileSync(f, 'utf8')), problems = [];
  const now = new Map(treeFiles().map(p => [p, sha(fs.readFileSync(path.join(REPO, p)))])), was = new Map(R.sources.map(s => [s.path, s.sha256]));
  for (const [p, h] of now) if (!was.has(p)) problems.push(`${p}: a source the record does not list (built?)`); else if (was.get(p) !== h) problems.push(`${p}: changed since the build`);
  for (const p of was.keys()) if (!now.has(p)) problems.push(`${p}: listed in the record, no longer in the tree`);
  for (const o of R.outputs) { const g = path.join(REPO, o.path); if (!fs.existsSync(g)) problems.push(`${o.path}: missing`); else if (sha(fs.readFileSync(g)) !== o.sha256) problems.push(`${o.path}: not the file the build gave`); }
  return { ok: !problems.length, problems, sources: now.size, outputs: R.outputs.length };
}

function build() {
  if (!ARG.packages) throw new Error('--packages <folder of .tgz> is required');
  const R = { tool: 'dev/tools/build/client.js', tree: TREE };
  /* 1. the packages, and the tree's lockfile against v11's */
  const lockGame = fs.readFileSync(path.join(REPO, TREE, 'package-lock.json')), lockV11 = fs.readFileSync(path.join(REPO, V11, 'package-lock.json'));
  if (!lockGame.equals(lockV11)) throw new Error(`${TREE}/package-lock.json is not the recovered v11 lockfile: a dependency change is its own, separately approved step`);
  const pj = JSON.parse(fs.readFileSync(path.join(REPO, TREE, 'package.json'), 'utf8')), pjV11 = JSON.parse(fs.readFileSync(path.join(REPO, V11, 'package.json'), 'utf8'));
  if (JSON.stringify([pj.dependencies, pj.devDependencies]) !== JSON.stringify([pjV11.dependencies, pjV11.devDependencies])) throw new Error(`${TREE}/package.json's dependencies are not v11's`);
  const V = P.verify({ dir: ARG.packages, lockfile: path.join(REPO, TREE, 'package-lock.json') });
  R.packages = { verified: V.verified, needed: V.needed, missing: V.missing, extra: V.extra, problems: V.problems, lockfileIsV11: V.lockfile.v11Snapshot, ok: V.ok };
  if (!V.ok || !V.lockfile.v11Snapshot) throw new Error('the packages did not verify against the lockfile: ' + V.problems.slice(0, 5).join('; '));
  /* 2. the work folder: the tree copied; the install kept and reused while the lockfile and the packages are the same */
  const work = ARG.work ? path.resolve(ARG.work) : fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-client-'));
  if ((work + path.sep).startsWith(REPO + path.sep)) throw new Error('--work must be outside the repository');
  const proj = path.join(work, 'tree'), stamp = path.join(work, 'install.stamp'), want = sha(lockGame) + ' ' + V.packages.map(p => p.sha256).join(',');
  const reuse = fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === want && fs.existsSync(path.join(proj, 'node_modules'));
  if (fs.existsSync(proj)) for (const e of fs.readdirSync(proj)) if (e !== 'node_modules' || !reuse) fs.rmSync(path.join(proj, e), { recursive: true, force: true });
  fs.mkdirSync(proj, { recursive: true });
  for (const p of treeFiles()) { const to = path.join(proj, path.relative(TREE, p)); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(REPO, p), to); }
  let env = process.env;
  if (!reuse) { const I = P.install({ project: proj, dir: ARG.packages, work, verified: V }); env = I.env; fs.writeFileSync(stamp, want); R.install = { packages: I.packages, log: I.log }; }
  else { R.install = { reused: true }; env = { ...process.env, npm_config_userconfig: path.join(work, 'npmrc'), npm_config_offline: 'true', npm_config_update_notifier: 'false' }; }
  /* 3. the tree's own build */
  const b = spawnSync('npm', ['run', 'build'], { cwd: proj, env, encoding: 'utf8', maxBuffer: 64 << 20 });
  R.build = { command: 'npm run build (' + pj.scripts.build + ')', code: b.status, log: (b.stdout + b.stderr).trim().split('\n').slice(-30).join('\n') };
  if (b.status !== 0) throw Object.assign(new Error('the build failed:\n' + R.build.log), { report: R });
  const tool = n => { const r = spawnSync(path.join(proj, 'node_modules', '.bin', n), ['--version'], { encoding: 'utf8' }); return (r.stdout || '').trim(); };
  R.toolchain = { node: process.version, typescript: tool('tsc'), vite: tool('vite') };
  /* 4. the outputs */
  const dist = path.join(proj, 'dist', 'assets');
  const made = fs.readdirSync(dist).filter(f => /\.(js|css)$/.test(f)).sort();
  R.notShipped = made.filter(f => NOT_SHIPPED[f]).map(f => ({ file: f, why: NOT_SHIPPED[f] }));
  R.outputs = made.filter(f => !NOT_SHIPPED[f]).map(f => { const buf = fs.readFileSync(path.join(dist, f)); return { path: ASSETS + '/' + f, bytes: buf.length, sha256: sha(buf), buf }; });
  if (!R.outputs.some(o => o.path === ASSETS + '/index-DKbV5Nv9.js') || !R.outputs.some(o => o.path === ASSETS + '/index-D7hdwmUU.css')) throw new Error('the build did not give assets/index-DKbV5Nv9.js and assets/index-D7hdwmUU.css');
  if (!ARG.work) fs.rmSync(work, { recursive: true, force: true });
  return R;
}

function main() {
  if (ARG['record-check']) {
    const r = recordCheck(); for (const p of r.problems) console.log('NOT BUILT: ' + p);
    console.log(r.ok ? `CLIENT RECORD: PASS (${r.sources} sources and ${r.outputs} outputs are the recorded build's)` : `CLIENT RECORD: FAIL (${r.problems.length})`);
    if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(r, null, 1) + '\n'); return r.ok ? 0 : 1;
  }
  const modes = ['stage', 'check', 'write'].filter(m => ARG[m]); if (modes.length !== 1) { console.error('choose one of --stage <folder>, --check, --write (or --record-check)'); return 2; }
  const R = build(), outs = R.outputs.map(({ buf, ...o }) => o), rec = record(outs);
  let ok = true;
  if (ARG.stage) {
    const st = path.resolve(ARG.stage); if ((st + path.sep).startsWith(path.join(REPO, 'public') + path.sep)) throw new Error('--stage must not be public/');
    fs.mkdirSync(path.join(st, 'assets'), { recursive: true });
    for (const o of R.outputs) fs.writeFileSync(path.join(st, 'assets', path.basename(o.path)), o.buf);
    fs.writeFileSync(path.join(st, 'CLIENT_BUILD.json'), JSON.stringify(rec, null, 1) + '\n');
    console.log(`staged ${R.outputs.length} files in ${st}/assets`);
  } else if (ARG.check) {
    const bad = []; for (const o of R.outputs) { const f = path.join(REPO, o.path); if (!fs.existsSync(f)) bad.push(`${o.path}: missing`); else if (!fs.readFileSync(f).equals(o.buf)) bad.push(`${o.path}: differs from what the tree builds`); }
    const f = path.join(REPO, RECORD); if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== JSON.stringify(rec, null, 1) + '\n') bad.push(`${RECORD}: not the record of this build`);
    for (const b of bad) console.log('NOT BUILT: ' + b); ok = !bad.length; R.check = { problems: bad };
    console.log(ok ? `CLIENT BUILD CHECK: PASS (${R.outputs.length} outputs and the record are what ${TREE} builds)` : `CLIENT BUILD CHECK: FAIL (${bad.length})`);
  } else {
    const f = path.join(REPO, RECORD), old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).outputs.map(o => o.path) : [];
    for (const o of R.outputs) { const g = path.join(REPO, o.path); if (!fs.existsSync(g) || !fs.readFileSync(g).equals(o.buf)) { fs.writeFileSync(g, o.buf); console.log('wrote ' + o.path); } }
    for (const p of old) if (!outs.some(o => o.path === p) && fs.existsSync(path.join(REPO, p))) { fs.unlinkSync(path.join(REPO, p)); console.log('removed ' + p + ' (the build no longer makes it)'); }
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(rec, null, 1) + '\n'); console.log('wrote ' + RECORD);
  }
  console.log(`toolchain: Node ${R.toolchain.node}, ${R.toolchain.typescript}, ${R.toolchain.vite}; ${R.install.reused ? 'the install reused' : R.install.log}`);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify({ ...R, outputs: outs }, null, 1) + '\n');
  return ok ? 0 : 1;
}
try { process.exitCode = main(); } catch (e) { console.error('CLIENT BUILD ERROR: ' + e.message); if (ARG.out && e.report) fs.writeFileSync(ARG.out, JSON.stringify(e.report, null, 1) + '\n'); console.log('CLIENT BUILD: FAIL'); process.exitCode = 1; }
