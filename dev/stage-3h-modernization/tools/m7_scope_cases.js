/* Stage 3H engine modernization (H3M-7) - the scope step's rules for files moved out of the root (development only).
 *
 *   node dev/stage-3h-modernization/tools/m7_scope_cases.js --work <empty scratch folder> [--out FILE.json]
 *
 * dev/tools/gate/scope_m.js runs on the working tree as it is, each time with a changed copy of declared_changes.json (its --declared
 * option), so no file of the working tree is touched.  The real declarations must pass; each changed one must fail:
 *   - the short README.md's entry taken out of other.replaced (a new file stands where a moved one was, undeclared);
 *   - a replacement declared for a moved file whose old path is empty;
 *   - a moved file declared at a destination where it is not;
 *   - a moved file's entry taken out of other.moved (the file is missing from the root and not declared as moved).
 * The working tree is only read. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.work) { console.error('--work <empty scratch folder> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), WORK = path.resolve(ARG.work);
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be empty'); process.exit(2); }
fs.mkdirSync(WORK, { recursive: true });
const REAL = JSON.parse(fs.readFileSync(path.join(REPO, 'dev', 'tools', 'gate', 'declared_changes.json'), 'utf8'));
const ONE = '2D_SHADOWS_REPORT.md';                                     // a report moved from the root to dev/archive/2d-shadows/
if (!REAL.other.moved[ONE]) { console.error(`${ONE} is not declared as moved`); process.exit(2); }
const CASES = {
  real: d => d,
  replacement_undeclared: d => { delete d.other.replaced['README.md']; return d; },
  replacement_not_made: d => { d.other.replaced[ONE] = 'a replacement that was never made'; return d; },
  moved_elsewhere: d => { d.other.moved[ONE] = 'dev/archive/2d-shadows/NOT_HERE.md'; return d; },
  move_undeclared: d => { delete d.other.moved[ONE]; return d; },
};
const R = { tool: 'dev/stage-3h-modernization/tools/m7_scope_cases.js', cases: {}, ok: true };
for (const [name, change] of Object.entries(CASES)) {
  const f = path.join(WORK, name + '.json'), out = path.join(WORK, name + '.scope.json');
  fs.writeFileSync(f, JSON.stringify(change(JSON.parse(JSON.stringify(REAL))), null, 1) + '\n');
  const r = spawnSync(process.execPath, [path.join(REPO, 'dev', 'tools', 'gate', 'scope_m.js'), '--declared', f, '--out', out], { encoding: 'utf8' });
  const j = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null, said = j ? j.problems.join(' | ') : (r.stderr || '').trim();
  const ok = name === 'real' ? r.status === 0 && !!j && j.ok : r.status === 1 && !!j && !j.ok && j.problems.length > 0;
  R.cases[name] = { exit: r.status, ok, problems: j ? j.problems : null }; R.ok = R.ok && ok;
  console.log(`${ok ? 'ok  ' : 'BAD '} ${name.padEnd(23)} exit ${r.status}  ${said.slice(0, 200)}`);
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(R.ok ? 'SCOPE CASES: the real declarations pass; every wrong declaration about the moved root files is refused' : 'SCOPE CASES: NOT EVERY CASE WAS REFUSED');
process.exitCode = R.ok ? 0 : 1;
