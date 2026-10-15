/* Stage 3H engine modernization (H3M-7, H3M-8) - the build from nothing gives back every committed output, byte for byte (development only).
 *
 *   node dev/stage-3h-modernization/tools/m7_clean_rebuild.js --work <empty scratch folder> [--ref COMMIT] [--out FILE.json] [--packages DIR]
 *
 * Without --ref: the working tree's files (tracked, and new ones not ignored; never .git) are copied into --work/tree.  With --ref: the
 * repository is cloned into --work/tree and COMMIT checked out (a clean checkout: what anyone who clones the branch gets).  Then, there:
 *   1. `build.js --check` must pass on the files as they are;
 *   2. `build.js --clean` deletes every built output and the manifest: each must be gone, and no other file may change (since
 *      continuation C4b the compiled client's bundle and stylesheet stay: build.js only checks them against client.js's record);
 *   3. `build.js` (npm run build) writes them again;
 *   4. every output and the manifest must be byte-identical to the source's (the working tree's file, or the commit's blob), and with
 *      --ref `git status` must show no change at all;
 *   5. `build.js --check` must pass again;
 *   6. (C4b; with --packages: the 31 locked npm packages) the compiled client from nothing too: its outputs and its record deleted,
 *      `dev/tools/build/client.js --write` builds them again (the packages checked and installed offline, in --work), and each must be
 *      byte-identical to the source's; `build.js --check` passes again.
 * Only Node is used for 1 to 5 (no npm install, no network).  The working tree is only read. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.work) { console.error('--work <empty scratch folder> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), WORK = path.resolve(ARG.work), T = path.join(WORK, 'tree');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be empty'); process.exit(2); }
fs.mkdirSync(WORK, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { maxBuffer: 1 << 28 });
const R = { tool: 'dev/stage-3h-modernization/tools/m7_clean_rebuild.js', source: ARG.ref ? 'clone at ' + ARG.ref : 'working tree copy', node: process.version, steps: {}, ok: true };
const fail = m => { (R.problems = R.problems || []).push(m); R.ok = false; };
if (ARG.ref) {
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', REPO, T]);
  git(T, 'checkout', '--quiet', '--detach', ARG.ref); R.commit = git(T, 'rev-parse', 'HEAD').toString().trim(); R.tree = git(T, 'rev-parse', 'HEAD^{tree}').toString().trim();
} else {
  const files = git(REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').toString().split('\0').filter(f => f && fs.existsSync(path.join(REPO, f)));
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(T, f)); }
  R.files = files.length;
}
const build = (...a) => { const r = spawnSync(process.execPath, [path.join(T, 'dev', 'tools', 'build', 'build.js'), ...a], { cwd: T, encoding: 'utf8' }); return { exit: r.status, text: ((r.stdout || '') + (r.stderr || '')).trim() }; };
const OUTS = JSON.parse(fs.readFileSync(path.join(T, 'src', 'build-recipes.json'), 'utf8')).outputs, recipes = OUTS.map(o => o.out), BUILT = recipes.concat(['generated/BUILD_MANIFEST.json']);
const CLIENT = OUTS.filter(o => o.client).map(o => o.out), CLEANED = BUILT.filter(f => !CLIENT.includes(f));   // (C4b) --clean leaves the compiled client
const original = f => ARG.ref ? git(T, 'show', 'HEAD:' + f) : fs.readFileSync(path.join(REPO, f));
const snapshot = () => { const m = new Map(); const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.git') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else m.set(path.relative(T, p).split(path.sep).join('/'), sha(fs.readFileSync(p))); } }; walk(T); return m; };

let r = build('--check'); R.steps.check_before = r; if (r.exit !== 0 || !/BUILD CHECK: PASS/.test(r.text)) fail('build:check before the clean did not pass');
const before = snapshot();
r = build('--clean'); R.steps.clean = r; if (r.exit !== 0) fail('--clean failed');
const afterClean = snapshot(), gone = CLEANED.filter(f => !afterClean.has(f)), stayed = CLEANED.filter(f => afterClean.has(f));
const otherChanged = [...before.keys()].filter(f => !CLEANED.includes(f) && before.get(f) !== afterClean.get(f));
R.steps.clean.removed = gone.length; R.steps.clean.expected = CLEANED.length; R.steps.clean.kept = CLIENT;
if (stayed.length) fail('still there after --clean: ' + stayed.join(', '));
if (otherChanged.length) fail('--clean touched files it does not build: ' + otherChanged.join(', '));
r = build(); R.steps.build = r; if (r.exit !== 0) fail('the build failed');
const differ = BUILT.filter(f => !fs.existsSync(path.join(T, f)) || !fs.readFileSync(path.join(T, f)).equals(original(f)));
R.steps.compare = { outputs: BUILT.length, identical: BUILT.length - differ.length, differ };
if (differ.length) fail('rebuilt differently from the source: ' + differ.join(', '));
if (ARG.ref) { const s = git(T, 'status', '--porcelain', '--untracked-files=all').toString(); R.steps.git_status = s.trim() ? s.trim().split('\n') : []; if (s.trim()) fail('git status after the rebuild is not clean'); }
r = build('--check'); R.steps.check_after = r; if (r.exit !== 0 || !/BUILD CHECK: PASS/.test(r.text)) fail('build:check after the rebuild did not pass');
/* 6 (C4b) the compiled client from nothing */
const PK = ARG.packages || process.env.TFB_CLIENT_PACKAGES;
if (CLIENT.length && PK) {
  const files = CLIENT.concat(['generated/CLIENT_BUILD.json']); for (const f of files) fs.rmSync(path.join(T, f), { force: true });
  const c = spawnSync(process.execPath, [path.join(T, 'dev', 'tools', 'build', 'client.js'), '--packages', path.resolve(PK), '--write', '--work', path.join(WORK, 'client')], { cwd: T, encoding: 'utf8', maxBuffer: 64 << 20 });
  const cdiffer = files.filter(f => !fs.existsSync(path.join(T, f)) || !fs.readFileSync(path.join(T, f)).equals(original(f)));
  R.steps.client = { exit: c.status, text: ((c.stdout || '') + (c.stderr || '')).trim().split('\n').slice(-4).join('\n'), files: files.length, identical: files.length - cdiffer.length, differ: cdiffer };
  if (c.status !== 0) fail('client.js --write failed'); if (cdiffer.length) fail('the compiled client rebuilt differently from the source: ' + cdiffer.join(', '));
  r = build('--check'); R.steps.check_client = r; if (r.exit !== 0 || !/BUILD CHECK: PASS/.test(r.text)) fail('build:check after the client rebuild did not pass');
  if (ARG.ref) { const s2 = git(T, 'status', '--porcelain', '--untracked-files=all').toString(); if (s2.trim()) fail('git status after the client rebuild is not clean: ' + s2.trim().split('\n').slice(0, 5).join('; ')); }
} else R.steps.client = CLIENT.length ? 'not run: --packages not given' : 'no compiled client output';
fs.rmSync(T, { recursive: true, force: true }); fs.rmSync(path.join(WORK, 'client'), { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`source: ${R.source}${R.commit ? ' (' + R.commit + ', tree ' + R.tree + ')' : ''}; node ${R.node}`);
console.log(`build:check before: ${R.steps.check_before.text.split('\n').pop()}`);
console.log(`--clean: ${gone.length} of ${CLEANED.length} built files removed${CLIENT.length ? ` (the compiled client's ${CLIENT.length} kept)` : ''}; other files touched: ${otherChanged.length}`);
console.log(`build: ${R.steps.build.text.split('\n').pop()}`);
console.log(`compare: ${R.steps.compare.identical} of ${R.steps.compare.outputs} identical to the source${ARG.ref ? '; git status ' + (R.steps.git_status.length ? 'NOT clean' : 'clean') : ''}`);
console.log(`build:check after: ${R.steps.check_after.text.split('\n').pop()}`);
console.log(`the compiled client from nothing: ${typeof R.steps.client === 'string' ? R.steps.client : `${R.steps.client.identical} of ${R.steps.client.files} files identical to the source`}`);
console.log('CLEAN REBUILD: ' + (R.ok ? 'PASS' : 'FAIL: ' + R.problems.join('; ')));
process.exitCode = R.ok ? 0 : 1;
