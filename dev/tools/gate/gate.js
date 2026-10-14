/* Stage 3H engine modernization - THE gate: the working tree against the accepted B++ game, on the modern layout (development only).
 *
 *   node dev/tools/gate/gate.js [--tier fast|full] [--only step,step] [--out DIR] [--keep-heavy 1]
 *
 * A copy of Stage 3H2's gate (dev/stage-3h/gate/h2_gate.js, left as it is for the frozen layout), with the same steps, the same B++
 * baselines (dev/stage-3h/evidence/h1/golden, h2/golden) and the same rule (a step passes only on its own positive evidence; a step that
 * compared nothing is a FAIL).  What differs:
 *   - build: dev/tools/build/build.js --check (every built output is what src/ builds; it replaces the three .sh builds);
 *   - lineage (added at H3M-6): dev/tools/lineage/lineage.js verify and tree-id (the client lineage replays, blame.json is current, and
 *     src/core/client/bundle/original-v11/ is the recovered v11 snapshot);
 *   - scope: dev/tools/gate/scope_m.js (every file outside dev/ is B++'s, moved where the layout says, or a declared change listed in
 *     dev/tools/gate/declared_changes.json; it replaces --allow-prod);
 *   - the harnesses that read runtime files by path are the layout-aware copies in dev/tools/gate/golden/ and checks/ (srv_harness,
 *     srv_golden, bpp_golden, bpp_mutants, cli_lib, cli_golden, cli_lib_h2, cli_golden_h2, raw_live, perf_det, proto_check); each says
 *     what it changed from its original;
 *   - the browser checks are given the candidate's files where its layout keeps them (public/assets/...).
 * The tools that never read a runtime file by path (protocol_v2, suites, static_check, live_wire_h2, place_replay, place_guard_check,
 * two_browser, col_browser, gameplay_smoke, contact_lab, compare_captures) are used where they are.
 *
 *   --tier fast   (default, a few minutes) build, lineage, scope, srv_golden, bpp_golden, cli_golden, protocol, mutants, static, raw_live,
 *                 quick_suites
 *   --tier full   (the final candidate; about 40 minutes) the fast tier, then cli_mutants, live_wire, bpp_checks, browsers, contact_lab,
 *                 suites, perf
 * Everything is written under --out (default: a scratch folder): gate_report.json plus each tool's log and report.
 *
 * The original's description follows.
 *
 * Stage 3H2 (H2-0) - ONE gate for every Stage 3H runtime checkpoint: the working tree against the accepted B++ game (development only).
 *
 *   node dev/stage-3h/gate/h2_gate.js [--tier fast|full] [--allow-prod P1,P2] [--only step,step] [--out DIR] [--keep-heavy 1]
 *
 *   --allow-prod  the production files (outside dev/) this checkpoint changes or adds on purpose, cumulative since B++ (e.g.
 *                 server.js,server/newrun.js).  Every other production file must be byte-identical to B++.
 *   --tier fast   (default, a few minutes) every deterministic comparison:
 *       build        ai.js, ents.js, sim.js rebuild byte for byte from their sources (tools/h1_build_check.js --worktree)
 *       scope        only dev/stage-3h/, dev/devlog4dev/ and the allowed production files differ from B++ (tools/h1_scope_check.py)
 *       srv_golden   Stage 3H0's 11 server scenarios: B++'s server.js and the working tree's, byte for byte, and both against the B++
 *                    baseline (evidence/h1/golden/srv_traces); HTTP lines about files the stage changed on purpose are listed
 *       bpp_golden   the 7 B++ scenarios (caps/q, placement guard, its caveats, NEW RUN, NEW RUN while held, the death aftermath), the
 *                    same way, against evidence/h2/golden/bpp_traces
 *       cli_golden   Stage 3H0's 9 client scenes (mp.js in a real Chromium, fake clock): B++'s client against the working tree's, and
 *                    against evidence/h1/golden/cli_traces (plus, once C-3 is prepared, the B++ client scenes of cli_golden_h2.js)
 *       protocol     every message in those traces against the B++ protocol contract v2 (protocol_bpp.json), and the checker's selftest
 *       mutants      18 one-line server mutants, each must change a B++ golden (bpp_mutants.js): the goldens still see the code where it lives
 *       static       real HTTP on a copy of the working tree's game: allowlist, blocked paths, favicon bytes (dev/stage-3e-0/static_check.js)
 *       raw_live     the B++ game and the working tree's, each a real server over raw TCP: every HTTP response and WebSocket check
 *                    (raw_live_h2.js)
 *       quick_suites the suites that read server.js's or mp.js's text (s_humanqa_hotfix, s_ir, interp_test) and the quick ones, every
 *                    failure classified against the B++ record (suites.js --only)
 *   --tier full   (the final candidate; about 35 minutes) the fast tier, then the client mutants and the real-time and browser checks:
 *       cli_mutants  22 one-line client mutants (NEW RUN's client code, the fluorescent hum), each must change a client golden
 *       live_wire    two real Chromium players through the game's own buttons on each game, compared by structure (live_wire_h2.js)
 *       bpp_checks   B++'s own checks: proto_check.js, place_replay.js, place_guard_check.js
 *       browsers     two_browser.py (B+), col_browser.py head and aside, gameplay_smoke.py
 *       contact_lab  BR-RoLE's contact lab on each game; the pixel-stable scenes (geometry, lights, peers) must be byte-identical images
 *       suites       the existing suites, every failure classified against the B++ record (suites.js)
 *       perf         perf_det.js: B++'s server.js against the working tree's, interleaved, with 3H0's A/A rule
 * A step passes only on its own positive evidence (a count of cases compared that is above zero, a PASS line, a report that says ok): a
 * step that compared nothing is a FAIL.  Exit 0 only when every step passes.  Everything is written under --out (default: a scratch folder). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const ARG = { tier: 'fast' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
const G = (...p) => path.join('dev', 'tools', 'gate', ...p);                                       // this gate's own tools
const BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40';
const OUT = path.resolve(ARG.out || fs.mkdtempSync(path.join(os.tmpdir(), 'mgate-'))); fs.mkdirSync(OUT, { recursive: true });
const E1 = path.join(REPO, 'dev', 'stage-3h', 'evidence', 'h1', 'golden'), E2 = path.join(REPO, 'dev', 'stage-3h', 'evidence', 'h2', 'golden');
const o = (...p) => path.join(OUT, ...p);
const J = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function run(name, cmd, { ms = 1800000, env = {} } = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: REPO, encoding: 'utf8', timeout: ms, maxBuffer: 1 << 28, env: Object.assign({}, process.env, env) });
  const text = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(o(name + '.log'), '$ ' + cmd.join(' ') + '\n' + text);
  return { exit: r.status, text, ms: Date.now() - t0, timedOut: !!(r.error && /ETIMEDOUT/.test(String(r.error.code))) };
}
/* a complete game folder: the B++ export (git archive), or a copy of the working tree's production files (tracked and untracked) */
let bppDir = null, wtDir = null;
function bppGame() { if (bppDir) return bppDir; bppDir = o('game_bpp'); fs.mkdirSync(bppDir, { recursive: true }); execFileSync('sh', ['-c', `git -C "$1" archive "$2" -- . ':(exclude)dev' | tar -x -C "$3"`, 'sh', REPO, BPP, bppDir]); return bppDir; }
function wtGame() {
  if (wtDir) return wtDir; wtDir = o('game_candidate'); fs.mkdirSync(wtDir, { recursive: true });
  const files = execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 1 << 28 }).toString().split('\0').filter(f => f && !f.startsWith('dev/') && fs.existsSync(path.join(REPO, f)));
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(wtDir, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(wtDir, f)); }
  return wtDir;
}
const STEPS = {
  build: () => { const r = run('build', ['node', 'dev/tools/build/build.js', '--check']); const m = /(\d+) outputs/.exec(r.text);
    return { ok: r.exit === 0 && /BUILD CHECK: PASS/.test(r.text), cases: m ? +m[1] : 0, note: (r.text.trim().split('\n').pop() || '').slice(0, 160), r }; },
  lineage: () => {                                                        // (H3M-6) the bundle's lineage replays, blame.json is current, the v11 snapshot is authentic
    const r = run('lineage', ['node', 'dev/tools/lineage/lineage.js', 'verify', '--out', o('lineage.json')]), t = run('lineage_tree', ['node', 'dev/tools/lineage/lineage.js', 'tree-id']), j = J(o('lineage.json'));
    const n = j ? Object.values(j.files).reduce((a, f) => a + (f.replayed ? f.steps : 0), 0) : 0, proven = t.exit === 0 && /ORIGINAL V11 TREE: PROVEN/.test(t.text);
    return { ok: r.exit === 0 && !!j && j.ok && proven, cases: n, note: `steps replayed (bundle, stylesheet, page); blame.json ${j ? j.blame : '?'}; the v11 snapshot's tree ${proven ? 'proven' : 'NOT PROVEN'}`, r }; },
  scope: () => { const r = run('scope', ['node', G('scope_m.js'), '--out', o('scope.json')]); const j = J(o('scope.json'));
    return { ok: r.exit === 0 && j && j.ok, cases: j ? j.counts.runtimeIdentical + j.counts.runtimeChanged + j.counts.runtimeAdded + j.counts.otherIdentical : 0, note: j ? `runtime changed (declared): ${Object.keys(j.runtime.changed).join(', ')}; added: ${Object.keys(j.runtime.added).join(', ')}` : '', r }; },
  srv_golden: () => { const r = run('srv_golden', ['node', G('golden', 'srv_golden.js'), '--old-ref', BPP, '--baseline', path.join(E1, 'srv_traces'), '--out', o('srv'), '--keep', o('srv_keep')]); const j = J(o('srv', 'srv_golden_report.json'));
    const n = j ? j.scenarios.length : 0, exp = j ? j.scenarios.flatMap(s => (s.baseline && s.baseline.expectedContentChanges || []).map(x => x.file)) : [];
    return { ok: r.exit === 0 && j && j.ok && n === 11, cases: n, note: exp.length ? 'HTTP lines about changed files: ' + [...new Set(exp)].join(', ') : 'identical to the baseline', r }; },
  bpp_golden: () => { const r = run('bpp_golden', ['node', G('golden', 'bpp_golden.js'), '--old-ref', BPP, '--repeat', '0', '--baseline', path.join(E2, 'bpp_traces'), '--out', o('bpp'), '--keep', o('bpp_keep')]); const j = J(o('bpp', 'bpp_golden_report.json'));
    const n = j ? j.scenarios.length : 0; return { ok: r.exit === 0 && j && j.ok && n === 7 && j.scenarios.every(s => s.baseline && s.baseline.equal), cases: n, r }; },
  cli_golden: () => { const r = run('cli_golden', ['node', G('golden', 'cli_golden.js'), '--old-ref', BPP, '--baseline', path.join(E1, 'cli_traces'), '--out', o('cli'), '--keep', o('cli_keep')]); const j = J(o('cli', 'cli_golden_report.json'));
    const n = j ? j.scenes.length : 0; let ok = r.exit === 0 && j && j.ok && n === 9, cases = n, note = '';
    {                                                                                      // the B++ client scenes (Stage 3H2's)
      const r2 = run('cli_golden_h2', ['node', G('golden', 'cli_golden_h2.js'), '--old-ref', BPP, '--baseline', path.join(E2, 'cli_traces'), '--out', o('cli_h2'), '--keep', o('cli_h2_keep')]); const j2 = J(o('cli_h2', 'cli_golden_report.json'));
      const n2 = j2 ? j2.scenes.length : 0; ok = ok && r2.exit === 0 && j2 && j2.ok && n2 > 0; cases += n2; note = `B++ client scenes ${n2}`;
    }
    return { ok, cases, note, r }; },
  protocol: () => {
    const self = run('protocol_selftest', ['node', 'dev/stage-3h/gate/protocol_v2.js', 'selftest']);
    const dirs = ['srv_keep', 'bpp_keep'].map(d => o(d)).filter(d => fs.existsSync(d)).join(','), cli = [o('cli_keep'), o('cli_h2_keep')].filter(d => fs.existsSync(d));
    let ok = self.exit === 0, read = 0;
    for (const [i, c] of (cli.length ? cli : [null]).entries()) {
      const args = ['node', 'dev/stage-3h/gate/protocol_v2.js', 'check', '--srv', i === 0 ? dirs : '', '--out', o(`protocol_${i}.json`)]; if (c) args.push('--cli', c);
      const r = run('protocol_' + i, args); const j = J(o(`protocol_${i}.json`)); ok = ok && r.exit === 0 && j && j.ok; read += j ? j.read.serverToClient + j.read.clientToServer : 0;
    }
    return { ok: ok && read > 0, cases: read, note: 'messages checked; selftest ' + (self.exit === 0 ? 'PASS' : 'FAIL') };
  },
  mutants: () => { const r = run('mutants', ['node', G('golden', 'bpp_mutants.js'), '--out', o('mutants.json')]); const j = J(o('mutants.json'));
    const n = j ? j.mutants.length : 0; return { ok: r.exit === 0 && j && j.ok && n >= 18, cases: n, note: j ? j.mutants.map(m => m.id + '@' + (m.file || '?')).filter(x => !/@server\.js$/.test(x)).join(' ') : '', r }; },
  /* the client goldens' own sensitivity: 22 one-line changes of NEW RUN's client code and of the fluorescent hum, wherever their text now
   * lives (mp.js or a helper script); each must change a client trace */
  cli_mutants: () => { const r = run('cli_mutants', ['node', G('golden', 'cli_golden_h2.js'), '--mutants', '1', '--out', o('cli_mutants.json')]); const j = J(o('cli_mutants.json'));
    const n = j ? j.mutants.length : 0; return { ok: r.exit === 0 && j && j.ok && n >= 22, cases: n, note: j ? j.mutants.filter(m => m.file && m.file !== 'mp.js').map(m => m.file).filter((f, i, a) => a.indexOf(f) === i).map(f => `${j.mutants.filter(m => m.file === f).length} in ${f}`).join(', ') || 'all in mp.js' : '', r }; },
  static: () => { const g = wtGame(); const r = run('static', ['node', 'dev/stage-3e-0/static_check.js', '--game', g, '--ico', path.join(bppGame(), 'favicon.ico'), '--out', o('static.json')]); const j = J(o('static.json'));
    return { ok: r.exit === 0 && j && j.ok, cases: j && j.checks ? Object.keys(j.checks).length : 0, r }; },
  raw_live: () => { const r = run('raw_live', ['node', G('golden', 'raw_live.js'), '--old-ref', BPP, '--new-dir', wtGame(), '--out', o('raw_live.json')]); const j = J(o('raw_live.json'));
    return { ok: r.exit === 0 && j && j.ok, cases: j ? j.httpCases + j.wsChecks : 0, note: j && j.expectedContentChanges.length ? 'responses for changed files: ' + [...new Set(j.expectedContentChanges.map(e => e.file))].join(', ') : 'identical', r }; },
  /* real time: a phase that does not finish in 30 s is an ERROR (exit 2: the run proves nothing either way), which is run once more and
   * reported; a structural difference (exit 1) is a FAIL at once */
  live_wire: () => {
    const go = n => run('live_wire' + n, ['node', 'dev/stage-3h/golden/live_wire_h2.js', '--old-dir', bppGame(), '--new-dir', wtGame(), '--shots', o('live_wire_shots' + n), '--save-raw', o('live_wire_raw' + n), '--out', o(`live_wire${n}.json`)]);
    let r = go(''), j = J(o('live_wire.json')), note = '';
    if (r.exit === 2) { note = 'first run ERROR (' + ((j && j.error) || 'see live_wire.log').slice(0, 120) + '), run again; '; r = go('_again'); j = J(o('live_wire_again.json')); }
    return { ok: r.exit === 0 && j && j.ok, cases: j && j.phases ? j.phases.length : 0, note: note + (j && j.ok ? 'structurally identical, ui ' + JSON.stringify(j.new.ui) : j && j.diffs ? j.diffs.length + ' structural differences' : 'no comparison'), r };
  },
  /* B++'s own real-server checks.  place_replay.js and place_guard_check.js always exit 0 (they measure; they do not judge), so their
   * reports are judged here against what the same tools measured on the B++ export in 3H1 (evidence/h1/bpp_checks): every placement
   * kept or undone as on B++, every check's ok and tookTheJump as on B++, no server error */
  bpp_checks: () => {
    const g = wtGame(), REF = path.join(REPO, 'dev', 'stage-3h', 'evidence', 'h1', 'bpp_checks'), res = [];
    let r = run('proto_check', ['node', G('checks', 'proto_check.js'), '--game', g, '--out', o('proto_check.json')]); let j = J(o('proto_check.json'));
    const pc = j && j.checks ? Object.keys(j.checks).length : 0; res.push(['proto_check', r.exit === 0 && j && j.ok === true && pc >= 8, pc]);
    r = run('place_replay', ['node', 'dev/stage-3e-0-bpp/place_replay.js', '--game', g, '--out', o('place_replay.json')]); j = J(o('place_replay.json'));
    const pr = J(path.join(REF, 'place_replay.json')), keys = pr ? Object.keys(pr.summary) : [];
    const prOk = r.exit === 0 && j && j.summary && keys.length > 0 && keys.every(k => j.summary[k] && j.summary[k].kept === pr.summary[k].kept && j.summary[k].of === pr.summary[k].of) && !(j.serverErrors || []).length;
    res.push(['place_replay', prOk, j && j.scenarios ? j.scenarios.length : 0]);
    r = run('place_guard', ['node', 'dev/stage-3e-0-bpp/place_guard_check.js', '--game', g, '--out', o('place_guard.json')]); j = J(o('place_guard.json'));
    const pg = J(path.join(REF, 'place_guard.json')), names = pg ? Object.keys(pg.checks) : [];
    const pgOk = r.exit === 0 && j && j.checks && names.length > 0 && names.every(k => j.checks[k] && j.checks[k].ok === pg.checks[k].ok && j.checks[k].tookTheJump === pg.checks[k].tookTheJump) && !(j.serverErrors || []).length;
    res.push(['place_guard', pgOk, j && j.checks ? Object.keys(j.checks).length : 0]);
    return { ok: res.every(x => x[1]), cases: res.every(x => x[2] > 0) ? res.reduce((s, x) => s + x[2], 0) : 0, note: res.map(([n, k, c]) => `${n} ${k ? 'as on B++' : 'FAIL'} (${c})`).join(', ') };
  },
  /* the browser checks: two_browser.py always exits 0 (its verdict is the report's ok); the others exit 1 on a failed check */
  browsers: () => {
    const g = wtGame(), res = [];
    let r = run('two_browser', ['python3', '-I', '-B', 'dev/stage-3e-0/two_browser.py', '--game', g, '--mode', 'bplus', '--out', o('two_browser.json')]); let j = J(o('two_browser.json'));
    res.push(['two_browser', r.exit === 0 && j && j.ok === true && j.frames > 0, j ? j.frames || 0 : 0]);
    for (const c of ['head', 'aside']) {
      r = run('col_' + c, ['python3', '-I', '-B', 'dev/stage-3d-hq2/col_browser.py', '--game', g, '--case', c, '--out', o(`col_${c}.json`)]); j = J(o(`col_${c}.json`));
      res.push(['col_' + c, r.exit === 0 && j && j.ok === true && j.total > 0 && j.passed === j.total, j ? j.total || 0 : 0]);
    }
    const Lg = LAYOUT.forTree(g); r = run('gameplay_smoke', ['python3', '-I', '-B', 'dev/stage-3d-hq4/gameplay_smoke.py', '--game', g, '--variant', `cand=${Lg.at('assets/index-DKbV5Nv9.js')},${Lg.at('assets/br-role.js')}`, '--out', o('smoke')]); j = J(o('smoke', 'cand.json'));
    res.push(['gameplay_smoke', r.exit === 0 && j && j.ok === true && !(j.pageErrors || []).length, j && j.checks ? Object.keys(j.checks).length : 0]);
    return { ok: res.every(x => x[1]), cases: res.every(x => x[2] > 0) ? res.reduce((s, x) => s + x[2], 0) : 0, note: res.map(([n, k, c]) => `${n} ${k ? 'ok' : 'FAIL'} (${c})`).join(', ') };
  },
  contact_lab: () => {
    const scenes = 'geometry,lights,peers', res = [];
    for (const [label, g] of [['bpp', bppGame()], ['cand', wtGame()]]) {
      const r = run('contact_' + label, ['python3', '-I', '-B', 'dev/stage-3d-hq5/contact_lab.py', '--game', g, '--variant', `${label}=${LAYOUT.forTree(g).at('assets/br-role.js')}`, '--scenes', scenes, '--out', o('contact')]), v = J(o('contact', label, 'result.json'));
      res.push(r.exit === 0 && v && Object.keys(v.scenes || {}).length === 3 && v.served === v.servedExpected && v.brRoleErrors === 0 && !(v.pageErrors || []).length);
    }
    const r = run('contact_compare', ['python3', '-I', '-B', 'dev/stage-3h0/golden/compare_captures.py', o('contact', 'bpp'), o('contact', 'cand'), '--out', o('contact_compare.json')]); const j = J(o('contact_compare.json'));
    const rows = j ? j.rows.filter(x => !x.missing) : [], diff = rows.filter(x => x.changedShare > 0 || x.meanAbs > 0 || x.max > 0);
    return { ok: res.every(Boolean) && rows.length > 0 && !diff.length && !(j.rows || []).some(x => x.missing), cases: rows.length, note: diff.length ? 'DIFFERENT images: ' + diff.map(x => x.image).join(', ') : rows.length + ' images byte-identical in pixels' };
  },
  suites: () => { const r = run('suites', ['node', 'dev/stage-3h/gate/suites.js', 'run', '--out', o('suites')], { ms: 3600000 }); const j = J(o('suites', 'suites_report.json'));
    return { ok: r.exit === 0 && j && j.ok, cases: j ? Object.values(j.suites).reduce((s, x) => s + x.ran, 0) : 0, note: j ? suiteNote(j) : '', r }; },
  /* the fast tier's share of the suites: the ones that read server.js's or mp.js's own text (s_humanqa_hotfix X02/X03, s_ir I1, interp_test)
   * and the quick ones; seconds in all.  The full tier runs every suite */
  quick_suites: () => { const r = run('quick_suites', ['node', 'dev/stage-3h/gate/suites.js', 'run', '--only', QUICK.join(','), '--out', o('quick_suites')]); const j = J(o('quick_suites', 'suites_report.json'));
    return { ok: r.exit === 0 && j && j.ok && Object.keys(j.suites).length === QUICK.length, cases: j ? Object.values(j.suites).reduce((s, x) => s + x.ran, 0) : 0, note: j ? suiteNote(j) : '', r }; },
  perf: () => { const r = run('perf', ['node', G('golden', 'perf_det.js'), '--old-ref', BPP, '--rounds', '7', '--out', o('perf_det.json')]); const j = J(o('perf_det.json'));
    return { ok: r.exit === 0 && j && j.ok, cases: j ? Object.keys(j.server).length + Object.keys(j.client).length : 0, note: j ? Object.entries(j.server).map(([k, v]) => `${k} ${v.changePct > 0 ? '+' : ''}${v.changePct}%`).join(', ') : '', r }; },
};
const QUICK = ['s_humanqa_hotfix', 's_ir', 'interp_test', 'test_3bn', 'ir_net'];
function suiteNote(j) { return Object.entries(j.suites).map(([n, x]) => `${n} ${x.summary ? x.summary.passed + '/' + x.summary.total : x.ran}${x.ok ? '' : ' FAIL'}`).join(', ') + ' (only the known B++ failures fail)'; }
const FAST = ['build', 'lineage', 'scope', 'srv_golden', 'bpp_golden', 'cli_golden', 'protocol', 'mutants', 'static', 'raw_live', 'quick_suites'];
const FULL = FAST.concat(['cli_mutants', 'live_wire', 'bpp_checks', 'browsers', 'contact_lab', 'suites', 'perf']);
const steps = ARG.only ? ARG.only.split(',') : ARG.tier === 'full' ? FULL : FAST;
const R = { tool: 'dev/tools/gate/gate.js', tier: ARG.tier, declared: 'dev/tools/gate/declared_changes.json', base: BPP, head: execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD']).toString().trim(), startedAt: new Date().toISOString(), out: OUT, steps: {}, ok: true };
for (const s of steps) {
  const t0 = Date.now(); let res;
  try { res = STEPS[s](); } catch (e) { res = { ok: false, cases: 0, note: 'ERROR ' + String(e && e.message || e).slice(0, 300) }; }
  if (!(res.cases > 0)) res.ok = false;                                  // a step that compared nothing is a FAIL
  R.steps[s] = { ok: res.ok, cases: res.cases, note: res.note || '', exit: res.r ? res.r.exit : null, seconds: Math.round((Date.now() - t0) / 1000) };
  R.ok = R.ok && res.ok;
  console.log(`${res.ok ? 'PASS' : 'FAIL'} ${s}: ${res.cases} compared${res.note ? '; ' + res.note : ''} (${R.steps[s].seconds} s)`);
}
R.finishedAt = new Date().toISOString();
/* the bulky intermediates (two game copies, the kept traces: about 350 MB a run) are removed once every step has used them, unless
 * --keep-heavy 1; the reports and logs stay */
if (!ARG['keep-heavy']) { R.removed = []; for (const d of ['game_bpp', 'game_candidate', 'srv_keep', 'bpp_keep', 'cli_keep', 'cli_h2_keep']) { const p = o(d); if (p.startsWith(OUT + path.sep) && fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); R.removed.push(d); } } }
fs.writeFileSync(o('gate_report.json'), JSON.stringify(R, null, 1) + '\n');
console.log(`MODERNIZATION GATE (${ARG.tier}${ARG.only ? ': ' + ARG.only : ''}): ${R.ok ? 'PASS' : 'FAIL'}  - report ${o('gate_report.json')}`);
process.exitCode = R.ok ? 0 : 1;
