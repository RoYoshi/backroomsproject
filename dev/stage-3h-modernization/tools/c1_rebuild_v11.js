#!/usr/bin/env node
/* Stage 3H continuation C1 - rebuild the recovered v11 project offline from verified packages, and compare its output with the recovered
 * dist/ byte for byte (development only; Node 18 or later and npm; no network).
 *
 *   node dev/stage-3h-modernization/tools/c1_rebuild_v11.js --packages <folder of .tgz> --work <new, empty folder> [--out FILE.json]
 *
 * 1. c1_verify_packages.js checks the tarballs against the snapshot's own lockfile first (each one's sha512 is the lockfile's integrity,
 *    read by its own package.json; none missing, none extra).  Nothing is installed unless that passes.
 * 2. A copy of src/core/client/bundle/original-v11/ without its dist/ is made in --work/v11 (the snapshot itself is never written to).
 * 3. The verified tarballs go into a private npm cache (--work/npm-cache), and `npm ci --offline --ignore-scripts` installs from it: no
 *    registry is asked, no package runs an install script, the user's npmrc is not read.  Every installed package must have the
 *    lockfile's version.
 * 4. `npm run build` (the project's own script: tsc --noEmit && vite build).
 * 5. Every file of the new dist/ is compared with the recovered dist/: the same list of files, each byte-identical.
 * The report records the toolchain that ran (node, npm, tsc, vite) and every file's SHA-256.  Exit 0 only when all of it holds. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.packages || !ARG.work) { console.error('usage: --packages <folder of .tgz> --work <new, empty folder> [--out FILE.json]'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), V11 = path.join(REPO, 'src', 'core', 'client', 'bundle', 'original-v11');
const WORK = path.resolve(ARG.work), PKG = path.resolve(ARG.packages), PROJ = path.join(WORK, 'v11'), CACHE = path.join(WORK, 'npm-cache');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be a new or empty folder'); process.exit(2); }
if (PROJ.startsWith(REPO + path.sep)) { console.error('--work must be outside the repository'); process.exit(2); }
fs.mkdirSync(WORK, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const R = { tool: 'dev/stage-3h-modernization/tools/c1_rebuild_v11.js', at: new Date().toISOString(), packages: null, toolchain: {}, install: {}, build: {}, dist: {}, ok: false };
const fail = m => { R.problem = m; console.log('FAIL ' + m); finish(); };
function finish() { if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n'); process.exit(R.ok ? 0 : 1); }
/* npm, with nothing from outside: an empty user config, the private cache, no audit, no fund, no update check */
fs.writeFileSync(path.join(WORK, 'npmrc'), '');
const ENV = { ...process.env, npm_config_userconfig: path.join(WORK, 'npmrc'), npm_config_cache: CACHE, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false', npm_config_offline: 'true' };
const run = (cmd, args, cwd) => { const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: 'utf8', maxBuffer: 64 << 20 }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const tail = s => s.trim().split('\n').slice(-12).join('\n');

/* 1. the packages, against the lockfile */
const vr = spawnSync(process.execPath, [path.join(__dirname, 'c1_verify_packages.js'), '--dir', PKG, '--out', path.join(WORK, 'packages_verified.json')], { encoding: 'utf8' });
process.stdout.write(vr.stdout.split('\n').filter(l => !/^ok /.test(l)).join('\n'));
const V = JSON.parse(fs.readFileSync(path.join(WORK, 'packages_verified.json'), 'utf8'));
R.packages = { dir: PKG, verified: V.verified, needed: V.needed, missing: V.missing, extra: V.extra, lockfile: V.lockfile, ok: V.ok };
if (vr.status !== 0 || !V.ok) fail('the packages did not verify; nothing was installed');

/* 2. a copy of the snapshot, without dist/ */
const copy = (from, to) => { for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name);
  if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copy(a, b); } else fs.copyFileSync(a, b); } };
fs.mkdirSync(PROJ, { recursive: true });
for (const e of fs.readdirSync(V11, { withFileTypes: true })) if (e.name !== 'dist' && e.name !== 'node_modules') {
  const a = path.join(V11, e.name), b = path.join(PROJ, e.name); if (e.isDirectory()) { fs.mkdirSync(b); copy(a, b); } else fs.copyFileSync(a, b); }

/* 3. the private cache, then the offline install */
R.toolchain.node = process.version; R.toolchain.npm = run('npm', ['--version'], WORK).out.trim();
for (const p of V.packages) { const r = run('npm', ['cache', 'add', path.join(PKG, p.file)], WORK); if (r.code !== 0) fail(`npm cache add ${p.file}: ${tail(r.out)}`); }
const ci = run('npm', ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], PROJ);
R.install = { command: 'npm ci --offline --ignore-scripts --no-audit --no-fund', code: ci.code, log: tail(ci.out) };
console.log(ci.out.trim().split('\n').filter(Boolean).slice(-2).join('\n'));
if (ci.code !== 0) fail('npm ci failed');
const lock = JSON.parse(fs.readFileSync(path.join(PROJ, 'package-lock.json'), 'utf8')), inst = JSON.parse(fs.readFileSync(path.join(PROJ, 'node_modules', '.package-lock.json'), 'utf8'));
const wrong = Object.entries(inst.packages).filter(([k, v]) => k && (!lock.packages[k] || lock.packages[k].version !== v.version)).map(([k]) => k);
R.install.packages = Object.keys(inst.packages).filter(Boolean).length; R.install.notTheLockfiles = wrong;
if (wrong.length) fail('installed packages differ from the lockfile: ' + wrong.join(', '));
const bin = n => path.join(PROJ, 'node_modules', '.bin', n);
R.toolchain.tsc = run(bin('tsc'), ['--version'], PROJ).out.trim(); R.toolchain.vite = run(bin('vite'), ['--version'], PROJ).out.trim();

/* 4. the project's own build */
const b = run('npm', ['run', 'build'], PROJ);
R.build = { command: 'npm run build (' + JSON.parse(fs.readFileSync(path.join(PROJ, 'package.json'), 'utf8')).scripts.build + ')', code: b.code, log: tail(b.out) };
if (b.code !== 0) fail('the build failed:\n' + tail(b.out));

/* 5. the new dist/ against the recovered one */
const list = d => { const o = []; const walk = (x, rel) => { for (const e of fs.readdirSync(x, { withFileTypes: true }).sort((p, q) => p.name < q.name ? -1 : 1)) {
  const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(path.join(x, e.name), r); else o.push(r); } }; walk(d, ''); return o; };
const want = list(path.join(V11, 'dist')), got = list(path.join(PROJ, 'dist'));
R.dist.files = want.map(f => { const a = fs.readFileSync(path.join(V11, 'dist', f)), g = fs.existsSync(path.join(PROJ, 'dist', f)) ? fs.readFileSync(path.join(PROJ, 'dist', f)) : null;
  return { file: f, bytes: a.length, sha256: sha(a), rebuiltSha256: g && sha(g), identical: !!g && a.equals(g) }; });
R.dist.extra = got.filter(f => !want.includes(f)); R.dist.recovered = want.length; R.dist.identical = R.dist.files.filter(f => f.identical).length;
for (const f of R.dist.files) console.log(`${f.identical ? 'identical' : 'DIFFERENT'}  ${f.file}  ${f.bytes} bytes`);
R.ok = R.packages.ok && R.dist.identical === want.length && !R.dist.extra.length;
console.log(`toolchain: Node ${R.toolchain.node}, npm ${R.toolchain.npm}, ${R.toolchain.tsc}, ${R.toolchain.vite}`);
console.log(`C1 REBUILD: ${R.ok ? 'PASS' : 'FAIL'} (${R.dist.identical} of ${want.length} dist files byte-identical to the recovered dist/${R.dist.extra.length ? '; extra: ' + R.dist.extra.join(', ') : ''})`);
finish();
