/* Stage 3H engine modernization (H3M-6) - the lineage tool's `record` turns a change to the bundle or the stylesheet into a ledger step
 * that the build reproduces (development only).
 *
 *   node dev/stage-3h-modernization/tools/m6a_record_check.js --work <empty scratch folder> [--out FILE.json]
 *
 * In a copy of dev/tools/, the lineage page generator, src/, public/ and generated/ under --work (the working tree is only read):
 *   1. `record bundle` with nothing changed must record nothing;
 *   2. a change to public/assets/index-DKbV5Nv9.js (a comment inserted here) is recorded: a new step B41, blame.json rewritten;
 *      then `build.js` (the manifest), `build.js --check`, `lineage.js verify` (with blame.json) and the page generator must pass, and
 *      the build must give the changed file;
 *   3. the same for the stylesheet: a new step C09;
 *   4. a hand edit without `record` must fail build:check. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.work) { console.error('--work <empty scratch folder> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), WORK = path.resolve(ARG.work), W = path.join(WORK, 'copy');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be empty'); process.exit(2); }
const R = { tool: 'dev/stage-3h-modernization/tools/m6a_record_check.js', checks: [], ok: true };
const node = (...a) => { const r = spawnSync(process.execPath, a, { cwd: W, encoding: 'utf8' }); return { exit: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const check = (name, ok, said) => { R.checks.push({ name, ok: !!ok, said: (said || '').trim().split('\n').slice(-2).join(' | ').slice(0, 300) }); R.ok = R.ok && !!ok; console.log(`${ok ? 'ok  ' : 'BAD '} ${name}`); };
const fresh = () => {
  fs.rmSync(W, { recursive: true, force: true });
  for (const d of ['dev/tools', 'dev/stage-3h-modernization/tools/lineage_doc.js', 'src', 'public', 'generated']) fs.cpSync(path.join(REPO, d), path.join(W, d), { recursive: true });
};
const edit = (f, from, to) => { const p = path.join(W, f), t = fs.readFileSync(p, 'utf8'); if (!t.includes(from)) throw new Error(`${f}: no "${from}"`); fs.writeFileSync(p, t.replace(from, to)); };
const steps = key => JSON.parse(fs.readFileSync(path.join(W, 'src/core/client/bundle/lineage/ledger.json'), 'utf8')).files[key].steps;
const all = (name, file, changed) => {
  const b = node('dev/tools/build/build.js'); check(`${name}: build.js writes the manifest`, b.exit === 0, b.out);
  const c = node('dev/tools/build/build.js', '--check'); check(`${name}: build.js --check passes`, c.exit === 0, c.out);
  const v = node('dev/tools/lineage/lineage.js', 'verify'); check(`${name}: lineage.js verify passes (blame.json current)`, v.exit === 0 && /PASS blame/.test(v.out), v.out);
  const d = node('dev/stage-3h-modernization/tools/lineage_doc.js'); check(`${name}: the generated pages are written`, d.exit === 0 && /recorded/.test(fs.readFileSync(path.join(W, 'src/core/client/bundle/lineage/STEPS.md'), 'utf8')), d.out);
  fs.rmSync(path.join(W, file)); const r = node('dev/tools/build/build.js'); check(`${name}: the build gives the changed file again`, r.exit === 0 && fs.readFileSync(path.join(W, file)).equals(changed), r.out);
};
try {
  fresh();
  let r = node('dev/tools/lineage/lineage.js', 'record', 'bundle', '--label', 'nothing');
  check('record with nothing changed records nothing', r.exit === 0 && /nothing to record/.test(r.out) && steps('bundle').length === 40, r.out);
  edit('public/assets/index-DKbV5Nv9.js', 'stamina', '/*m6a*/stamina');
  const changed = fs.readFileSync(path.join(W, 'public/assets/index-DKbV5Nv9.js'));
  const h = node('dev/tools/build/build.js', '--check'); check('a hand edit of the bundle fails build:check', h.exit === 1 && /index-DKbV5Nv9\.js: differs/.test(h.out), h.out);
  r = node('dev/tools/lineage/lineage.js', 'record', 'bundle', '--label', 'a test change (m6a_record_check)', '--owner', 'core');
  check('record bundle adds step B41 and rewrites blame.json', r.exit === 0 && steps('bundle').length === 41 && steps('bundle')[40].id === 'B41' && /blame\.json rewritten/.test(r.out), r.out);
  all('bundle', 'public/assets/index-DKbV5Nv9.js', changed);
  fresh();
  edit('public/assets/index-D7hdwmUU.css', '{', '{ ');
  const css = fs.readFileSync(path.join(W, 'public/assets/index-D7hdwmUU.css'));
  r = node('dev/tools/lineage/lineage.js', 'record', 'css', '--label', 'a test change (m6a_record_check)');
  check('record css adds step C09', r.exit === 0 && steps('css').length === 9 && steps('css')[8].id === 'C09', r.out);
  all('css', 'public/assets/index-D7hdwmUU.css', css);
} catch (e) { check('the check ran to its end', false, String(e && e.stack || e)); }
fs.rmSync(W, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(R.ok ? 'RECORD: a recorded change is reproduced by the build and verified; a hand edit is refused' : 'RECORD: FAIL');
process.exitCode = R.ok ? 0 : 1;
