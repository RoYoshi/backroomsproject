/* Stage 3H engine modernization - the gate's scope step: every file outside dev/ is what the accepted B++ game had, moved where the layout
 * says, or a declared change (development only).
 *
 *   node dev/tools/gate/scope_m.js [--base 143b63f] [--declared dev/tools/gate/declared_changes.json] [--out FILE.json]
 *
 * Stage 3H2's scope step (dev/stage-3h/tools/h1_scope_check.py) compares paths; after the modernization moved every runtime file, the same
 * question is asked of content, through the layout map (dev/tools/layout.js):
 *   1. the runtime: every file the game serves or the server loads, by its old name (mp.js, sim.js, server/ws.js, assets/..., sounds/...).
 *      B++'s (its Git tree) against the working tree's (wherever the layout puts each one, Git blob ids).  Each is identical, or a
 *      declared change, addition or removal (declared_changes.json, with its reason).  A declared entry that did not happen fails too;
 *   2. the files outside dev/ that are not runtime (the root reports, README.md, redirect.js, run_*.sh, .github/, audio_source/): identical
 *      at the same path, or declared as moved, and then identical where they went;
 *   3. a new path outside dev/ is runtime (public/), source (src/), a build output (generated/: build:check proves those) or documentation
 *      (docs/); anything else is reported;
 *   4. two files whose copies the layout keeps in two places (world.js, dphys.js: public/ and generated/server/) are identical;
 *   5. the deployment workflow and the admin passcode line of server.js are byte-identical to B++ (compared by hash; nothing is printed).
 * Exit 0 only when every file is accounted for. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ARG = { base: '143b63ff42b88c6780c5043e0f61d64100f81f40' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
const DECL = JSON.parse(fs.readFileSync(ARG.declared || path.join(__dirname, 'declared_changes.json'), 'utf8'));
const blobId = b => crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 1 << 28 });
/* B++'s tree: path -> blob id */
const BASE = new Map(git('ls-tree', '-r', '-z', ARG.base).toString().split('\0').filter(Boolean).map(l => { const [m, p] = l.split('\t'); return [p, m.split(' ')[2]]; }));
const isRuntimeOld = p => !p.startsWith('dev/') && (/^[^/]+\.(js|html|ico)$/.test(p) && p !== 'redirect.js' || /^(assets|sounds|server)\//.test(p) || p === 'package.json');
const R = { tool: 'dev/tools/gate/scope_m.js', base: ARG.base, runtime: { identical: 0, changed: {}, added: {}, removed: {} }, other: { identical: 0, moved: {} }, newPaths: {}, problems: [], ok: true };
const problem = m => { R.problems.push(m); R.ok = false; };

/* 1. the runtime */
const WT = LAYOUT.runtimeOf(REPO), names = new Set([...[...BASE.keys()].filter(isRuntimeOld), ...WT.keys()]);
for (const n of [...names].sort()) {
  const b = BASE.get(n), w = WT.get(n), wb = w ? fs.readFileSync(w) : null;
  if (b && wb && b === blobId(wb)) { R.runtime.identical++; if (DECL.runtime.changed[n]) problem(`declared as changed but identical to B++: ${n}`); continue; }
  const kind = b && wb ? 'changed' : wb ? 'added' : 'removed', why = DECL.runtime[kind][n];
  R.runtime[kind][n] = { declared: !!why, why: why || null, at: w ? path.relative(REPO, w).split(path.sep).join('/') : null };
  if (!why) problem(`runtime file ${kind} and not declared: ${n}${w ? ' (' + path.relative(REPO, w) + ')' : ''}`);
}
for (const kind of ['changed', 'added', 'removed']) for (const n of Object.keys(DECL.runtime[kind])) if (!R.runtime[kind][n]) problem(`declared as ${kind} but not: ${n}`);

/* 2. the other files outside dev/ */
for (const [p, b] of BASE) {
  if (p.startsWith('dev/') || isRuntimeOld(p)) continue;
  const moved = (DECL.other && DECL.other.moved || {})[p], at = moved || p, f = path.join(REPO, at);
  if (!fs.existsSync(f)) { problem(`missing (not runtime): ${p}${moved ? ' -> ' + moved : ''}`); continue; }
  if (blobId(fs.readFileSync(f)) !== b) { problem(`changed (not runtime): ${at}`); continue; }
  if (moved) R.other.moved[p] = moved; else R.other.identical++;
}

/* 3. new paths outside dev/ */
const tracked = execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString().split('\0').filter(Boolean);
const movedTo = new Set(Object.values(DECL.other && DECL.other.moved || {}));
for (const p of tracked) {
  if (p.startsWith('dev/') || BASE.has(p) || movedTo.has(p) || !fs.existsSync(path.join(REPO, p))) continue;
  const top = p.split('/')[0], cat = { public: 'runtime (public/)', src: 'source (src/)', generated: 'build output (generated/)', docs: 'documentation (docs/)' }[top];
  if (cat) R.newPaths[cat] = (R.newPaths[cat] || 0) + 1; else problem(`a new path outside dev/, src/, public/, generated/, docs/: ${p}`);
}

/* 4. the two-place copies */
for (const n of ['world.js', 'dphys.js']) {
  const a = path.join(REPO, 'public', n), b = LAYOUT.at(n);
  if (LAYOUT.modern && (!fs.existsSync(a) || !fs.existsSync(b) || !fs.readFileSync(a).equals(fs.readFileSync(b)))) problem(`${n}: public/ and ${path.relative(REPO, b)} differ`);
}

/* 5. deployment and the passcode line */
for (const p of [...BASE.keys()].filter(p => p.startsWith('.github/'))) if (!fs.existsSync(path.join(REPO, p)) || blobId(fs.readFileSync(path.join(REPO, p))) !== BASE.get(p)) problem(`the deployment file changed: ${p}`);
const passLine = t => (t.split('\n').find(l => /^const ADMIN_PASS = process\.env\.ADMIN_PASSCODE \|\|/.test(l)) || '');
const pb = passLine(git('show', ARG.base + ':server.js').toString()), pw = passLine(fs.readFileSync(path.join(REPO, 'server.js'), 'utf8'));
R.passcodeLine = { present: !!pw, sameAsBase: !!pb && sha(pb) === sha(pw) };
if (!R.passcodeLine.sameAsBase) problem('the admin passcode line of server.js is not byte-identical to B++');

R.counts = { runtimeIdentical: R.runtime.identical, runtimeChanged: Object.keys(R.runtime.changed).length, runtimeAdded: Object.keys(R.runtime.added).length, runtimeRemoved: Object.keys(R.runtime.removed).length,
  otherIdentical: R.other.identical, otherMoved: Object.keys(R.other.moved).length, newPaths: Object.values(R.newPaths).reduce((s, x) => s + x, 0) };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`runtime: ${R.counts.runtimeIdentical} identical to B++, changed ${Object.keys(R.runtime.changed).join(' ') || '-'}, added ${Object.keys(R.runtime.added).join(' ') || '-'}, removed ${Object.keys(R.runtime.removed).join(' ') || '-'}`);
console.log(`other files: ${R.counts.otherIdentical} identical, ${R.counts.otherMoved} moved; new paths: ${JSON.stringify(R.newPaths)}; passcode line ${R.passcodeLine.sameAsBase ? 'unchanged' : 'CHANGED'}`);
for (const p of R.problems.slice(0, 40)) console.log('  PROBLEM ' + p);
console.log('SCOPE: ' + (R.ok ? 'PASS' : 'FAIL'));
process.exitCode = R.ok ? 0 : 1;
