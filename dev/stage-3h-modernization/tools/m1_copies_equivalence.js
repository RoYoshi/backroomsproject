/* Stage 3H engine modernization (H3M-1) - the gate's layout-aware copies agree with their originals on the frozen layout (development only).
 *
 *   node dev/stage-3h-modernization/tools/m1_copies_equivalence.js --work <empty scratch folder> [--parent 22751bb] [--out FILE.json]
 *
 * A detached worktree of the frozen Stage 3H2 parent (old layout) is made under --work, this tree's dev/tools/ (the layout map and the
 * gate's copies) is copied into it, and in that worktree each original tool and its copy are run on the same inputs:
 *   srv_golden (3H0) / golden/srv_golden.js, bpp_golden (3H2) / golden/bpp_golden.js, cli_golden (3H0) / golden/cli_golden.js,
 *   cli_golden_h2 (3H2) / golden/cli_golden_h2.js, bpp_mutants (3H2) / golden/bpp_mutants.js, raw_live_h2 (3H2) / golden/raw_live.js.
 * The copies must give the same results: the same trace hashes (old and new side) for every scenario and scene, the same verdicts, the
 * same mutants caught, the same raw exchanges (the copy asks some more paths; the shared ones must match).  The worktree is removed at the
 * end (git worktree remove).  Exit 0 only when every pair agrees. */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const ARG = { parent: '22751bbc39c91f3e54e3305638b2ef2c9dd12c68' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), WORK = path.resolve(ARG.work), WT = path.join(WORK, 'parent');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be empty'); process.exit(2); }
fs.mkdirSync(WORK, { recursive: true });
execFileSync('git', ['-C', REPO, 'worktree', 'add', '--detach', WT, ARG.parent], { stdio: 'ignore' });
const R = { tool: 'dev/stage-3h-modernization/tools/m1_copies_equivalence.js', parent: ARG.parent, pairs: {}, ok: true };
try {
  fs.cpSync(path.join(REPO, 'dev', 'tools'), path.join(WT, 'dev', 'tools'), { recursive: true });
  const run = (name, args, ms = 1800000) => { const r = spawnSync(args[0], args.slice(1), { cwd: WT, encoding: 'utf8', timeout: ms, maxBuffer: 1 << 28 }); fs.writeFileSync(path.join(WORK, name + '.log'), (r.stdout || '') + (r.stderr || '')); return r.status; };
  const J = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  const BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40', E1 = 'dev/stage-3h/evidence/h1/golden', E2 = 'dev/stage-3h/evidence/h2/golden';
  const pair = (key, a, b, same) => { const ok = !!(a && b) && same(a, b); R.pairs[key] = Object.assign({ ok }, R.pairs[key] || {}); R.ok = R.ok && ok; console.log(`${ok ? 'SAME' : 'DIFFERENT'} ${key}`); };
  /* srv_golden */
  run('srv_orig', ['node', 'dev/stage-3h0/golden/srv_golden.js', '--old-ref', BPP, '--baseline', `${E1}/srv_traces`, '--out', path.join(WORK, 'srv_orig')]);
  run('srv_copy', ['node', 'dev/tools/gate/golden/srv_golden.js', '--old-ref', BPP, '--baseline', `${E1}/srv_traces`, '--out', path.join(WORK, 'srv_copy')]);
  const sv = j => j && j.scenarios.map(s => [s.scenario, s.old.sha256, s.new.sha256, s.ok, s.baseline && s.baseline.equal, (s.baseline && s.baseline.expectedContentChanges || []).length].join(' '));
  pair('srv_golden', J(path.join(WORK, 'srv_orig', 'srv_golden_report.json')), J(path.join(WORK, 'srv_copy', 'srv_golden_report.json')), (a, b) => JSON.stringify(sv(a)) === JSON.stringify(sv(b)) && a.ok === b.ok);
  R.pairs.srv_golden.scenarios = sv(J(path.join(WORK, 'srv_copy', 'srv_golden_report.json')));
  /* bpp_golden */
  run('bpp_orig', ['node', 'dev/stage-3h/golden/bpp_golden.js', '--old-ref', BPP, '--repeat', '0', '--baseline', `${E2}/bpp_traces`, '--out', path.join(WORK, 'bpp_orig')]);
  run('bpp_copy', ['node', 'dev/tools/gate/golden/bpp_golden.js', '--old-ref', BPP, '--repeat', '0', '--baseline', `${E2}/bpp_traces`, '--out', path.join(WORK, 'bpp_copy')]);
  const bv = j => j && j.scenarios.map(s => [s.scenario, s.old.sha256, s.new.sha256, s.ok].join(' '));
  pair('bpp_golden', J(path.join(WORK, 'bpp_orig', 'bpp_golden_report.json')), J(path.join(WORK, 'bpp_copy', 'bpp_golden_report.json')), (a, b) => JSON.stringify(bv(a)) === JSON.stringify(bv(b)) && a.ok === b.ok);
  R.pairs.bpp_golden.scenarios = bv(J(path.join(WORK, 'bpp_copy', 'bpp_golden_report.json')));
  /* cli_golden (3H0) and cli_golden_h2 (3H2) */
  run('cli_orig', ['node', 'dev/stage-3h0/golden/cli_golden.js', '--old-ref', BPP, '--baseline', `${E1}/cli_traces`, '--out', path.join(WORK, 'cli_orig')]);
  run('cli_copy', ['node', 'dev/tools/gate/golden/cli_golden.js', '--old-ref', BPP, '--baseline', `${E1}/cli_traces`, '--out', path.join(WORK, 'cli_copy')]);
  const cv = j => j && j.scenes.map(s => [s.scene, s.old.sha256, s.new.sha256, s.ok].join(' '));
  pair('cli_golden', J(path.join(WORK, 'cli_orig', 'cli_golden_report.json')), J(path.join(WORK, 'cli_copy', 'cli_golden_report.json')), (a, b) => JSON.stringify(cv(a)) === JSON.stringify(cv(b)) && a.ok === b.ok);
  R.pairs.cli_golden.scenes = cv(J(path.join(WORK, 'cli_copy', 'cli_golden_report.json')));
  run('cli2_orig', ['node', 'dev/stage-3h/golden/cli_golden_h2.js', '--old-ref', BPP, '--baseline', `${E2}/cli_traces`, '--out', path.join(WORK, 'cli2_orig')]);
  run('cli2_copy', ['node', 'dev/tools/gate/golden/cli_golden_h2.js', '--old-ref', BPP, '--baseline', `${E2}/cli_traces`, '--out', path.join(WORK, 'cli2_copy')]);
  pair('cli_golden_h2', J(path.join(WORK, 'cli2_orig', 'cli_golden_report.json')), J(path.join(WORK, 'cli2_copy', 'cli_golden_report.json')), (a, b) => JSON.stringify(cv(a)) === JSON.stringify(cv(b)) && a.ok === b.ok);
  R.pairs.cli_golden_h2.scenes = cv(J(path.join(WORK, 'cli2_copy', 'cli_golden_report.json')));
  /* bpp_mutants */
  run('mut_orig', ['node', 'dev/stage-3h/golden/bpp_mutants.js', '--out', path.join(WORK, 'mut_orig.json')]);
  run('mut_copy', ['node', 'dev/tools/gate/golden/bpp_mutants.js', '--out', path.join(WORK, 'mut_copy.json')]);
  const mv = j => j && j.mutants.map(m => [m.id, m.file, m.caught, Object.entries(m.scenarios).map(([s, x]) => s + ':' + x.sha256).join(',')].join(' '));
  const ref = j => j && Object.entries(j.reference).map(([s, x]) => s + ':' + x.sha256).join(' ');
  pair('bpp_mutants', J(path.join(WORK, 'mut_orig.json')), J(path.join(WORK, 'mut_copy.json')), (a, b) => JSON.stringify(mv(a)) === JSON.stringify(mv(b)) && ref(a) === ref(b) && a.ok === b.ok);
  R.pairs.bpp_mutants.caught = (J(path.join(WORK, 'mut_copy.json')) || { mutants: [] }).mutants.filter(m => m.caught).length;
  /* raw_live: the shared exchanges */
  run('raw_orig', ['node', 'dev/stage-3h/golden/raw_live_h2.js', '--old-ref', BPP, '--out', path.join(WORK, 'raw_orig.json')]);
  run('raw_copy', ['node', 'dev/tools/gate/golden/raw_live.js', '--old-ref', BPP, '--out', path.join(WORK, 'raw_copy.json')]);
  const a = J(path.join(WORK, 'raw_orig.json')), b = J(path.join(WORK, 'raw_copy.json'));
  pair('raw_live', a, b, (x, y) => {
    const shared = Object.keys(x.new.http).filter(k => k in y.new.http);
    R.pairs.raw_live = { sharedHttp: shared.length, onlyInCopy: Object.keys(y.new.http).filter(k => !(k in x.new.http)).length, ws: Object.keys(x.new.ws).length };
    return shared.length === Object.keys(x.new.http).length && shared.every(k => JSON.stringify(x.new.http[k]) === JSON.stringify(y.new.http[k]) && JSON.stringify(x.old.http[k]) === JSON.stringify(y.old.http[k]))
      && JSON.stringify(x.new.ws) === JSON.stringify(y.new.ws) && x.ok === y.ok && JSON.stringify(x.expectedContentChanges.map(e => e.file)) === JSON.stringify(y.expectedContentChanges.filter(e => x.expectedContentChanges.some(f => f.case === e.case)).map(e => e.file));
  });
} finally {
  try { execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', WT], { stdio: 'ignore' }); } catch (e) { R.worktreeLeft = WT; }
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log('COPIES ON THE FROZEN LAYOUT: ' + (R.ok ? 'SAME AS THE ORIGINALS' : 'DIFFERENT'));
process.exitCode = R.ok ? 0 : 1;
