#!/usr/bin/env node
/* Stage 3H continuation C5 - this tree against M8 directly, wherever a comparison tool can take M8 as its old side (development only).
 *
 *   node dev/stage-3h-modernization/tools/c5_vs_m8.js --out <empty folder> [--only cli,page,sim,perf,raw_live,live_wire,browser_contracts,contact_lab]
 *
 * M8 (c34f0c2) is the gameplay-parity reference and the rollback point.  The gate compares every checkpoint with B++, and M8 passed the
 * same gate; this runs the same comparisons with M8 itself as the old side, where the tool reads M8's files (its public/ and
 * generated/server/, the layout M8 has):
 *   cli         the page traces: cli_golden.js (3H0's 9 scenes), cli_golden_h2.js (3H2's 3), cli_golden_c3c.js (all 18 in one page, with
 *               V8's coverage of both sides' mp.js) - M8's mp.js and helpers against this tree's
 *   page        world_diff.js (world.js, every function; Level 0 built with each) and page_scripts.js (move.js, camcorder.js, glitch.js,
 *               ents.js in the same closed Chromium page)
 *   sim         sim_diff.js: M8's built sim (generated/server/sim.js and its ai.js, world.js) and this tree's modules, on the same 20,050 calls
 *   perf        perf_det.js --only client: mp.js's per-frame hook and message handler, M8's against this tree's, interleaved, 7 rounds
 *               (its server half runs an old server.js on this tree's files, which M8's server.js, needing its own src/, cannot do)
 *   raw_live    raw_live.js: real HTTP and raw TCP against M8's game folder and this tree's: every response and WebSocket check
 *   live_wire   live_wire_h2.js: two real Chromium players through the game's own buttons, on M8's game folder and on this tree's
 *   browser_contracts  dev/tools/gate/checks/browser_contracts.js on M8's folder and this tree's: the facade, refusals, a phone
 *   contact_lab BR-RoLE's contact lab on both folders: the geometry, lights and peers scenes, compared pixel for pixel
 * The server traces have no M8 side to run (srv_golden.js runs an old server.js over this tree's files): M8's and this tree's are each
 * byte-identical to the same stored B++ baselines (M8's evidence/m8/gate_full; this tree's gate), which is the same comparison.
 * Writes <out>/report.json and each tool's report and log.  Exit 0 only when every comparison passes: equal, or (the time) within its rule. */
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.out) { console.error('--out <empty folder> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), OUT = path.resolve(ARG.out), M8 = 'c34f0c22bbacc5ac2813d173bc0591b67af7169f';
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length) { console.error('--out must be empty'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const o = (...p) => path.join(OUT, ...p), G = (...p) => path.join(REPO, 'dev', 'tools', 'gate', 'golden', ...p);
const J = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function run(name, cmd, ms = 3600000) {
  const t0 = Date.now(), r = spawnSync(cmd[0], cmd.slice(1), { cwd: REPO, encoding: 'utf8', timeout: ms, maxBuffer: 1 << 28 });
  fs.writeFileSync(o(name + '.log'), '$ ' + cmd.join(' ') + '\n' + (r.stdout || '') + (r.stderr || ''));
  return { exit: r.status, text: (r.stdout || '') + (r.stderr || ''), s: Math.round((Date.now() - t0) / 1000) };
}
const only = ARG.only ? ARG.only.split(',') : ['cli', 'page', 'sim', 'perf', 'raw_live', 'live_wire', 'browser_contracts', 'contact_lab'];
const R = { tool: 'dev/stage-3h-modernization/tools/c5_vs_m8.js', m8: M8, head: execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD']).toString().trim(),
  runtimeTree: null, startedAt: new Date().toISOString(), comparisons: [], ok: true };
/* what the comparisons are of: the runtime files as on disk (their SHA-256 together), so a report names the tree it ran on */
{
  const crypto = require('crypto'), h = crypto.createHash('sha256');
  const files = execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'server.js', 'package.json', 'public', 'generated', 'src'], { maxBuffer: 1 << 28 }).toString().split('\0').filter(f => f && fs.existsSync(path.join(REPO, f))).sort();
  for (const f of files) h.update(f + '\0' + crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, f))).digest('hex') + '\n');
  R.runtimeTree = { files: files.length, sha256: h.digest('hex') };
}
const add = (id, ok, n, note) => { R.comparisons.push({ id, ok: !!ok, compared: n, note }); if (!ok) R.ok = false; console.log(`${ok ? 'SAME' : 'DIFF'} ${id}: ${n} compared; ${note}`); };
/* two complete game folders: M8's (git archive, without dev/) and this tree's (its files on disk, without dev/) */
let m8Dir = null, wtDir = null;
const m8Game = () => { if (m8Dir) return m8Dir; m8Dir = o('game_m8'); fs.mkdirSync(m8Dir); execFileSync('sh', ['-c', `git -C "$1" archive "$2" -- . ':(exclude)dev' | tar -x -C "$3"`, 'sh', REPO, M8, m8Dir]); return m8Dir; };
const wtGame = () => {
  if (wtDir) return wtDir; wtDir = o('game_candidate'); fs.mkdirSync(wtDir);
  for (const f of execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 1 << 28 }).toString().split('\0').filter(f => f && !f.startsWith('dev/') && fs.existsSync(path.join(REPO, f)))) {
    fs.mkdirSync(path.dirname(path.join(wtDir, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(wtDir, f));
  }
  return wtDir;
};
if (only.includes('cli')) {
  let r = run('cli_golden', ['node', G('cli_golden.js'), '--old-ref', M8, '--out', o('cli')]), j = J(o('cli', 'cli_golden_report.json'));
  add('page traces, 3H0\'s scenes (cli_golden.js)', r.exit === 0 && j && j.ok, j ? j.scenes.length : 0, j ? j.scenes.map(s => s.scene || s.name).join(' ') : 'no report');
  r = run('cli_golden_h2', ['node', G('cli_golden_h2.js'), '--old-ref', M8, '--out', o('cli_h2')]); j = J(o('cli_h2', 'cli_golden_report.json'));
  add('page traces, 3H2\'s scenes (cli_golden_h2.js)', r.exit === 0 && j && j.ok, j ? j.scenes.length : 0, j ? j.scenes.map(s => s.scene || s.name).join(' ') : 'no report');
  r = run('cli_golden_c3c', ['node', G('cli_golden_c3c.js'), '--old-ref', M8, '--out', o('cli_c3c')]); j = J(o('cli_c3c', 'cli_golden_c3c_report.json'));
  const rn = j && j.reach ? `M8's mp.js ${j.reach.old.ran} of ${j.reach.old.functions} functions run, this tree's ${j.reach.new.ran} of ${j.reach.new.functions}` : '';
  add('page traces, all 18 scenes in one page (cli_golden_c3c.js)', r.exit === 0 && j && j.ok && j.reached === true, j ? j.scenes.length : 0, rn);
}
if (only.includes('page')) {
  let r = run('world_diff', ['node', G('world_diff.js'), '--old-ref', M8, '--out', o('world_diff.json')]), j = J(o('world_diff.json'));
  add('world.js, every function (world_diff.js)', r.exit === 0 && j && j.ok, j ? j.comparisons : 0, (r.text.trim().split('\n').pop() || '').slice(0, 160));
  r = run('page_scripts', ['node', G('page_scripts.js'), '--old-ref', M8, '--out', o('page_scripts.json')]); j = J(o('page_scripts.json'));
  add('move.js, camcorder.js, glitch.js, ents.js (page_scripts.js)', r.exit === 0 && j && j.ok, j ? Object.values(j.scripts).reduce((a, x) => a + x.lines[0], 0) : 0, j ? Object.entries(j.scripts).map(([k, v]) => `${k} ${v.lines[0]} lines`).join(', ') : 'no report');
}
if (only.includes('sim')) {
  const r = run('sim_diff', ['node', G('sim_diff.js'), '--old-ref', M8, '--out', o('sim_diff.json')]), j = J(o('sim_diff.json'));
  add('the sim (sim_diff.js)', r.exit === 0 && j && j.ok, j ? j.comparisons : 0, (r.text.trim().split('\n').pop() || '').slice(0, 160));
}
if (only.includes('perf')) {
  const r = run('perf_client', ['node', G('perf_det.js'), '--old-ref', M8, '--only', 'client', '--rounds', '7', '--out', o('perf_client.json')]), j = J(o('perf_client.json'));
  add('mp.js\'s frame hook and message handler, time (perf_det.js --only client)', r.exit === 0 && j && j.ok, j ? Object.keys(j.client).length : 0, j ? Object.entries(j.client).map(([k, v]) => `${k} hook ${v.hookMs.changePct > 0 ? '+' : ''}${v.hookMs.changePct}% handler ${v.handlerMs.changePct > 0 ? '+' : ''}${v.handlerMs.changePct}%`).join('; ') : 'no report');
}
if (only.includes('live_wire')) {
  const go = n => run('live_wire' + n, ['node', 'dev/stage-3h/golden/live_wire_h2.js', '--old-dir', m8Game(), '--new-dir', wtGame(), '--shots', o('live_wire_shots' + n), '--save-raw', o('live_wire_raw' + n), '--out', o(`live_wire${n}.json`)]);
  let r = go(''), j = J(o('live_wire.json')), note = '';
  if (r.exit === 2) { note = 'first run ERROR, run again; '; r = go('_again'); j = J(o('live_wire_again.json')); }
  add('two real players, every WebSocket frame by structure (live_wire_h2.js)', r.exit === 0 && j && j.ok, j && j.phases ? j.phases.length : 0, note + (j && j.ok ? 'structurally identical' : j && j.diffs ? j.diffs.length + ' structural differences' : 'no comparison'));
}
if (only.includes('raw_live')) {
  const r = run('raw_live', ['node', G('raw_live.js'), '--old-ref', M8, '--new-dir', wtGame(), '--out', o('raw_live.json')]), j = J(o('raw_live.json'));
  add('real HTTP and raw TCP, every response and WebSocket check (raw_live.js)', r.exit === 0 && j && j.ok, j ? j.httpCases + j.wsChecks : 0,
    j && j.expectedContentChanges.length ? 'bodies differ, as declared, for: ' + [...new Set(j.expectedContentChanges.map(e => e.file))].join(', ') : 'byte for byte, but the Date header');
}
if (only.includes('browser_contracts')) {
  const r = run('browser_contracts', ['node', 'dev/tools/gate/checks/browser_contracts.js', '--old-dir', m8Game(), '--new-dir', wtGame(), '--out', o('browser_contracts.json')]), j = J(o('browser_contracts.json'));
  const n = j ? j.sides.reduce((a, s) => a + Object.values(s.checks || {}).filter(Boolean).length, 0) : 0;
  add('the facade, unauthorized access refused, a phone, in a real Chromium (browser_contracts.js)', r.exit === 0 && j && j.ok, n, j && j.agree ? 'the sides agree: ' + Object.entries(j.agree).map(([k, v]) => `${k} ${v ? 'yes' : 'NO'}`).join(', ') : 'no report');
}
if (only.includes('contact_lab')) {
  const L = require(path.join(REPO, 'dev', 'tools', 'layout.js')), res = [];
  for (const [label, g] of [['m8', m8Game()], ['cand', wtGame()]]) {
    const r = run('contact_' + label, ['python3', '-I', '-B', 'dev/stage-3d-hq5/contact_lab.py', '--game', g, '--variant', `${label}=${L.forTree(g).at('assets/br-role.js')}`, '--scenes', 'geometry,lights,peers', '--out', o('contact')]), v = J(o('contact', label, 'result.json'));
    res.push(r.exit === 0 && v && Object.keys(v.scenes || {}).length === 3 && v.served === v.servedExpected && v.brRoleErrors === 0 && !(v.pageErrors || []).length);
  }
  const r = run('contact_compare', ['python3', '-I', '-B', 'dev/stage-3h0/golden/compare_captures.py', o('contact', 'm8'), o('contact', 'cand'), '--out', o('contact_compare.json')]), j = J(o('contact_compare.json'));
  const rows = j ? j.rows.filter(x => !x.missing) : [], diff = rows.filter(x => x.changedShare > 0 || x.meanAbs > 0 || x.max > 0);
  add('BR-RoLE\'s contact lab, pixel for pixel (contact_lab.py)', r.exit === 0 && res.every(Boolean) && rows.length > 0 && !diff.length && !(j.rows || []).some(x => x.missing), rows.length, diff.length ? 'DIFFERENT: ' + diff.map(x => x.image).join(', ') : rows.length + ' images identical');
}
for (const d of [m8Dir, wtDir]) if (d && d.startsWith(OUT + path.sep)) fs.rmSync(d, { recursive: true, force: true });   // the game copies (about 150 MB)
for (const d of ['live_wire_raw', 'live_wire_raw_again']) if (fs.existsSync(o(d))) execFileSync('sh', ['-c', 'cd "$1" && for f in *.json; do gzip -9 "$f"; done', 'sh', o(d)]);
R.finishedAt = new Date().toISOString();
fs.writeFileSync(o('report.json'), JSON.stringify(R, null, 1) + '\n');
console.log(`THIS TREE AGAINST M8: ${R.ok ? 'SAME' : 'DIFFERENT'} (${R.comparisons.filter(c => c.ok).length} of ${R.comparisons.length} comparisons pass; runtime files ${R.runtimeTree.files}, sha256 ${R.runtimeTree.sha256.slice(0, 16)})`);
process.exitCode = R.ok ? 0 : 1;
