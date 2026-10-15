/* Stage 3H engine modernization - THE gate: the working tree against the accepted B++ game, on the modern layout (development only).
 *
 *   node dev/tools/gate/gate.js [--tier fast|full] [--only step,step] [--out DIR] [--keep-heavy 1]
 *
 * A copy of Stage 3H2's gate (dev/stage-3h/gate/h2_gate.js, left as it is for the frozen layout), with the same steps, the same B++
 * baselines (dev/stage-3h/evidence/h1/golden, h2/golden) and the same rule (a step passes only on its own positive evidence; a step that
 * compared nothing is a FAIL).  What differs:
 *   - build: dev/tools/build/build.js --check (every built output is what src/ builds; it replaces the three .sh builds);
 *   - lineage (added at H3M-6): dev/tools/lineage/lineage.js verify and tree-id (the client lineage replays, blame.json is current, and
 *     src/core/client/bundle/original-v11/ is the recovered v11 snapshot); since continuation C5 also api_contract.js --check and
 *     lineage_doc.js --check (the window.__api contract, its 52 members and who reads each, and its two pages are current);
 *   - parts (added at H3M-3): dev/tools/checks/parts.js (every part of a built output declares its interface; the code agrees);
 *   - modules (added at continuation C3): dev/tools/checks/modules.js (the module boundaries, from the code: every name a server file uses
 *     is given to it or its own; no import assigned; every import used; no global object; a world's state inside its factory; the sim's
 *     wiring in order, each imported name returned by its giver; from C3b the page's module scripts too: nothing in a script's wrapper
 *     but the factories and the composition, no hidden closure dependence, no write into another owner's state, no global back-channel);
 *   - docs (added at H3M-7): dev/tools/docs/docs.js --check (the documentation's generated tables are what the repository gives today);
 *   - session (added at continuation C2): the session scenarios (golden/srv_scenarios_session.js) on B++'s server.js and this one, both
 *     equal to the B++ traces stored at C2 (dev/stage-3h-modernization/evidence/c2/golden/session_traces), and 15 session mutants;
 *   - sim (added at continuation C3a): golden/sim_diff.js, this tree's sim (its modules) and B++'s sim.js given the same calls, every
 *     result equal; and the seam mutants (golden/sim_mutants.js), each caught by 3H0's server scenarios or by that differential run;
 *   - page (added at continuation C3b): the page's scripts made of modules against B++'s: golden/world_diff.js (world.js in Node, every
 *     function on both sides; the server's copy byte for byte the page's) and golden/page_scripts.js (move.js, camcorder.js, glitch.js,
 *     ents.js, each in the same closed Chromium page, driven by golden/page_scenes.js: equal traces, each scene reaching its script by
 *     V8's coverage); and the seam mutants (golden/page_mutants.js), each caught;
 *   - cli_golden (continuation C3c): also golden/cli_golden_c3c.js - every client scene (3H0's 9, 3H2's 3 and C3c's 6, golden/
 *     cli_scenes_c3c.js) in one page, B++'s mp.js against this tree's, byte for byte, the C3c scenes against their stored traces
 *     (evidence/c3c/golden/cli_traces), and together they must run every function of mp.js (V8's coverage); cli_mutants also runs the
 *     C3c seam mutants (golden/cli_mutants_c3c.js), each caught;
 *   - scope: dev/tools/gate/scope_m.js (every file outside dev/ is B++'s, moved where the layout says, or a declared change listed in
 *     dev/tools/gate/declared_changes.json; it replaces --allow-prod);
 *   - the harnesses that read runtime files by path are the layout-aware copies in dev/tools/gate/golden/ and checks/ (srv_harness,
 *     srv_golden, bpp_golden, bpp_mutants, cli_lib, cli_golden, cli_lib_h2, cli_golden_h2, cli_lib_c3c, cli_golden_c3c, raw_live, perf_det, proto_check); each says
 *     what it changed from its original;
 *   - the browser checks are given the candidate's files where its layout keeps them (public/assets/...); gameplay_smoke is run once more
 *     when its first run's player was killed before the check's admin removed the monsters (its world is random: that run proves
 *     nothing either way; added at continuation C3b);
 *   - workflow (added at continuation C5, full tier): dev/tools/checks/dev_workflow.js (a developer's round trip on a scratch copy: edit,
 *     build, see it served and shown in a real page, undo, rebuild byte for byte, clean rebuild) and dev/tools/gate/checks/
 *     browser_contracts.js (on B++ and on this tree, in a real Chromium with a synthetic passcode: the 52-member window.__api facade at
 *     the menu and in a run, unauthorized access refused - a visitor's admin command, a wrong passcode, the lockout - and a phone with
 *     touch: the stick walks, the manifest); the two sides must agree;
 * The tools that never read a runtime file by path (protocol_v2, suites, static_check, live_wire_h2, place_replay, place_guard_check,
 * two_browser, col_browser, gameplay_smoke, contact_lab, compare_captures) are used where they are.
 *
 *   --tier fast   (default, a few minutes) build, lineage, parts, modules, docs, scope, srv_golden, bpp_golden, session, sim, page, cli_golden,
 *                 protocol, mutants, static, raw_live, quick_suites
 *   --tier full   (the final candidate; about 50 minutes on 2 CPUs) the fast tier, then cli_mutants, live_wire, bpp_checks, browsers, workflow,
 *                 contact_lab, suites, perf
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
const E3 = path.join(REPO, 'dev', 'stage-3h-modernization', 'evidence', 'c3c', 'golden');                                     // (C3c) the C3c client scenes' stored traces
const EC2 = path.join(REPO, 'dev', 'stage-3h-modernization', 'evidence', 'c2', 'golden');                 // (C2) the session scenarios' B++ traces
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
    /* (C5) the window.__api contract (52 members, who reads each) is what the bundle and the reading scripts give, and its pages are current */
    const a = run('api_contract', ['node', 'dev/stage-3h-modernization/tools/api_contract.js', '--check', '1']), p = run('lineage_pages', ['node', 'dev/stage-3h-modernization/tools/lineage_doc.js', '--check']);
    const api = a.exit === 0 && /API CONTRACT: CURRENT/.test(a.text) && /__api: 52 members/.test(a.text), pages = p.exit === 0 && /LINEAGE PAGES: CURRENT/.test(p.text);
    return { ok: r.exit === 0 && !!j && j.ok && proven && api && pages, cases: n, note: `steps replayed (bundle, stylesheet, page); blame.json ${j ? j.blame : '?'}; the v11 snapshot's tree ${proven ? 'proven' : 'NOT PROVEN'}; the __api contract (52 members) ${api ? 'current' : 'NOT CURRENT'}; its pages ${pages ? 'current' : 'NOT CURRENT'}`, r }; },
  parts: () => {                                                          // (H3M-3) every part's interface header agrees with the code
    const r = run('parts', ['node', 'dev/tools/checks/parts.js', '--out', o('parts.json')]), j = J(o('parts.json'));
    const n = j ? j.outputs.reduce((a, x) => a + x.parts.length, 0) : 0;
    return { ok: r.exit === 0 && !!j && j.ok, cases: n, note: j ? `${j.outputs.length} outputs built from parts; every header agrees with the code (TypeScript ${j.typescript})` : (r.text.trim().split('\n').pop() || '').slice(0, 160), r }; },
  modules: () => {                                                        // (C3) the module boundaries hold, from the code
    const r = run('modules', ['node', 'dev/tools/checks/modules.js', '--quiet', '--out', o('modules.json')]), j = J(o('modules.json'));
    const files = j ? Object.keys(j.files).length : 0, fac = j ? Object.values(j.files).filter(x => x.factory).length : 0;
    const pages = j && j.page ? Object.values(j.page) : [], pm = pages.reduce((a, x) => a + x.modules.length, 0);
    return { ok: r.exit === 0 && !!j && j.ok, cases: files + pm, note: j ? `${files} server files, ${fac} factories; the sim: ${j.sim ? j.sim.modules.length + ' modules, wired in order' : 'not modules'}; the page: ${pages.length} scripts, ${pm} modules (TypeScript ${j.typescript})` : (r.text.trim().split('\n').pop() || '').slice(0, 160), r }; },
  docs: () => {                                                           // (H3M-7) the documentation's generated tables are current
    const r = run('docs', ['node', 'dev/tools/docs/docs.js', '--check']), m = /\((\d+) generated blocks in (\d+) documents/.exec(r.text);
    return { ok: r.exit === 0 && /DOCS CHECK: PASS/.test(r.text), cases: m ? +m[1] : 0, note: (r.text.trim().split('\n').pop() || '').slice(0, 160), r }; },
  scope: () => { const r = run('scope', ['node', G('scope_m.js'), '--out', o('scope.json')]); const j = J(o('scope.json'));
    return { ok: r.exit === 0 && j && j.ok, cases: j ? j.counts.runtimeIdentical + j.counts.runtimeChanged + j.counts.runtimeAdded + j.counts.otherIdentical + (j.counts.otherMoved || 0) : 0, note: j ? `runtime changed (declared): ${Object.keys(j.runtime.changed).join(', ')}; added: ${Object.keys(j.runtime.added).join(', ')}; other files: ${j.counts.otherIdentical} identical, ${j.counts.otherMoved || 0} moved, ${j.counts.otherReplaced || 0} replaced (declared)` : '', r }; },
  srv_golden: () => { const r = run('srv_golden', ['node', G('golden', 'srv_golden.js'), '--old-ref', BPP, '--baseline', path.join(E1, 'srv_traces'), '--out', o('srv'), '--keep', o('srv_keep')]); const j = J(o('srv', 'srv_golden_report.json'));
    const n = j ? j.scenarios.length : 0, exp = j ? j.scenarios.flatMap(s => (s.baseline && s.baseline.expectedContentChanges || []).map(x => x.file)) : [];
    return { ok: r.exit === 0 && j && j.ok && n === 11, cases: n, note: exp.length ? 'HTTP lines about changed files: ' + [...new Set(exp)].join(', ') : 'identical to the baseline', r }; },
  bpp_golden: () => { const r = run('bpp_golden', ['node', G('golden', 'bpp_golden.js'), '--old-ref', BPP, '--repeat', '0', '--baseline', path.join(E2, 'bpp_traces'), '--out', o('bpp'), '--keep', o('bpp_keep')]); const j = J(o('bpp', 'bpp_golden_report.json'));
    const n = j ? j.scenarios.length : 0; return { ok: r.exit === 0 && j && j.ok && n === 7 && j.scenarios.every(s => s.baseline && s.baseline.equal), cases: n, r }; },
  session: () => {                                                         // (C2) the WebSocket session and the admin login: B++'s server.js and this one on the session scenarios, both equal to the stored B++ traces; and the session mutants, each caught
    const r = run('session_golden', ['node', G('golden', 'bpp_golden.js'), '--old-ref', BPP, '--repeat', '0', '--scenarios', G('golden', 'srv_scenarios_session.js'), '--baseline', path.join(EC2, 'session_traces'), '--out', o('session')]), j = J(o('session', 'srv_scenarios_session_report.json'));
    const m = run('session_mutants', ['node', G('golden', 'bpp_mutants.js'), '--scenarios', G('golden', 'srv_scenarios_session.js'), '--mutants', G('golden', 'session_mutants.js'), '--out', o('session_mutants.json')]), jm = J(o('session_mutants.json'));
    const n = j ? j.scenarios.length : 0, caught = jm ? jm.mutants.filter(x => x.caught).length : 0, of = jm ? jm.mutants.length : 0;
    return { ok: r.exit === 0 && !!j && j.ok && n === 3 && j.scenarios.every(s => s.baseline && s.baseline.equal) && m.exit === 0 && !!jm && jm.ok && caught === of && of > 0, cases: n + caught, note: `${n} session scenarios identical to B++'s traces; ${caught} of ${of} session mutants caught`, r }; },
  sim: () => {                                                            // (C3a) the sim's modules against B++'s sim.js: the same calls, the same results; every seam mutant caught
    const d = run('sim_diff', ['node', G('golden', 'sim_diff.js'), '--out', o('sim_diff.json')]), jd = J(o('sim_diff.json'));
    const g = run('sim_mutants', ['node', G('golden', 'bpp_mutants.js'), '--scenarios', path.join(REPO, 'dev', 'stage-3h0', 'golden', 'srv_scenarios.js'), '--mutants', G('golden', 'sim_mutants.js'), '--out', o('sim_mutants.json')]), jg = J(o('sim_mutants.json'));
    const m = run('sim_diff_mutants', ['node', G('golden', 'sim_diff.js'), '--mutants', G('golden', 'sim_mutants.js'), '--seeds', '1,7', '--ops', '800', '--out', o('sim_diff_mutants.json')]), jm = J(o('sim_diff_mutants.json'));
    const refOk = !!jg && Object.values(jg.reference || {}).length > 0 && Object.values(jg.reference).every(x => x.ok);
    const ids = jm ? jm.mutants.map(x => x.id) : [], byG = new Set(refOk ? jg.mutants.filter(x => x.caught).map(x => x.id) : []), byD = new Set(jm ? jm.mutants.filter(x => x.caught).map(x => x.id) : []);
    const caught = ids.filter(i => byG.has(i) || byD.has(i)).length, n = jd ? jd.comparisons : 0;
    return { ok: d.exit === 0 && !!jd && jd.ok && refOk && ids.length > 0 && caught === ids.length, cases: n + caught, note: `${n} calls give B++'s results; ${caught} of ${ids.length} seam mutants caught (by the server scenarios ${byG.size}, by the differential run ${byD.size})`, r: d }; },
  page: () => {                                                           // (C3b) the page's module scripts against B++'s: world.js in Node, the other four in Chromium; every seam mutant caught
    const w = run('world_diff', ['node', G('golden', 'world_diff.js'), '--out', o('world_diff.json')]), jw = J(o('world_diff.json'));
    const p = run('page_scripts', ['node', G('golden', 'page_scripts.js'), '--out', o('page_scripts.json')]), jp = J(o('page_scripts.json'));
    const m = run('page_mutants', ['node', G('golden', 'page_scripts.js'), '--mutants', G('golden', 'page_mutants.js'), '--out', o('page_mutants.json')]), jm = J(o('page_mutants.json'));
    const scripts = jp ? Object.keys(jp.scripts).length : 0, caught = jm ? jm.mutants.filter(x => x.caught).length : 0, of = jm ? jm.mutants.length : 0;
    const lines = jp ? Object.values(jp.scripts).reduce((a, x) => a + x.lines[0], 0) : 0, nw = jw ? jw.comparisons : 0;
    return { ok: w.exit === 0 && !!jw && jw.ok && nw > 0 && p.exit === 0 && !!jp && jp.ok && scripts === 4 && m.exit === 0 && !!jm && jm.ok && of > 0 && caught === of,
      cases: nw + lines + caught, note: `world.js: ${nw} comparisons equal; move, camcorder, glitch, ents: ${lines} trace lines equal, each scene reaching its script; ${caught} of ${of} seam mutants caught`, r: p }; },
  cli_golden: () => { const r = run('cli_golden', ['node', G('golden', 'cli_golden.js'), '--old-ref', BPP, '--baseline', path.join(E1, 'cli_traces'), '--out', o('cli'), '--keep', o('cli_keep')]); const j = J(o('cli', 'cli_golden_report.json'));
    const n = j ? j.scenes.length : 0; let ok = r.exit === 0 && j && j.ok && n === 9, cases = n, note = '';
    {                                                                                      // the B++ client scenes (Stage 3H2's)
      const r2 = run('cli_golden_h2', ['node', G('golden', 'cli_golden_h2.js'), '--old-ref', BPP, '--baseline', path.join(E2, 'cli_traces'), '--out', o('cli_h2'), '--keep', o('cli_h2_keep')]); const j2 = J(o('cli_h2', 'cli_golden_report.json'));
      const n2 = j2 ? j2.scenes.length : 0; ok = ok && r2.exit === 0 && j2 && j2.ok && n2 > 0; cases += n2; note = `B++ client scenes ${n2}`;
    }
    {                                                                                      // (C3c) every client scene in one page, and what they reach of mp.js
      const r3 = run('cli_golden_c3c', ['node', G('golden', 'cli_golden_c3c.js'), '--old-ref', BPP, '--baseline', path.join(E3, 'cli_traces'), '--out', o('cli_c3c'), '--keep', o('cli_c3c_keep')]); const j3 = J(o('cli_c3c', 'cli_golden_c3c_report.json'));
      const n3 = j3 ? j3.scenes.length : 0, rn = j3 && j3.reach ? j3.reach.new : null;
      ok = ok && r3.exit === 0 && !!j3 && j3.ok && j3.reached === true && n3 === 18; cases += n3;
      note += `; all ${n3} scenes in one page${rn ? `, running ${rn.ran} of mp.js's ${rn.functions} functions` : ''}`;
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
    const n = j ? j.mutants.length : 0;
    const r2 = run('cli_mutants_c3c', ['node', G('golden', 'cli_golden_c3c.js'), '--mutants', G('golden', 'cli_mutants_c3c.js'), '--out', o('cli_mutants_c3c.json')]), j2 = J(o('cli_mutants_c3c.json'));   // (C3c) mp.js's module seams
    const n2 = j2 ? j2.mutants.length : 0, c2 = j2 ? j2.mutants.filter(m => m.caught).length : 0;
    return { ok: r.exit === 0 && j && j.ok && n >= 22 && r2.exit === 0 && !!j2 && j2.ok && n2 > 0 && c2 === n2, cases: n + c2,
      note: (j ? j.mutants.filter(m => m.file && m.file !== 'mp.js').map(m => m.file).filter((f, i, a) => a.indexOf(f) === i).map(f => `${j.mutants.filter(m => m.file === f).length} in ${f}`).join(', ') || 'all in mp.js' : '') + `; mp.js's module seams: ${c2} of ${n2} caught`, r }; },
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
    /* (C3b) gameplay_smoke's world is random, and a monster can kill its player before the check's admin connection removes the monsters
     * (C3a and C3b each saw it once). That run proves nothing either way, like a live-wire phase that times out: when the server's log
     * shows a death before the admin's first command, the check is run once more, and the step says so. A second failure fails it. */
    const Lg = LAYOUT.forTree(g), smoke = dir => { const x = run('gameplay_smoke' + (dir === 'smoke' ? '' : '_again'), ['python3', '-I', '-B', 'dev/stage-3d-hq4/gameplay_smoke.py', '--game', g, '--variant', `cand=${Lg.at('assets/index-DKbV5Nv9.js')},${Lg.at('assets/br-role.js')}`, '--out', o(dir)]), y = J(o(dir, 'cand.json'));
      let early = null; try { const lines = fs.readFileSync(o(dir, 'cand.server.log'), 'utf8').split('\n'), a = lines.findIndex(l => l.startsWith('[admin]')), d = lines.findIndex(l => l.startsWith('[death]')); if (d >= 0 && (a < 0 || d < a)) early = lines[d].slice(0, 120); } catch (e) { /* no log */ }
      return { ok: x.exit === 0 && y && y.ok === true && !(y.pageErrors || []).length, checks: y && y.checks ? Object.keys(y.checks).length : 0, early }; };
    let sm = smoke('smoke'), smNote = '';
    if (!sm.ok && sm.early) { smNote = ` (re-run: the first run's player died before the monsters were removed: ${sm.early})`; sm = smoke('smoke_again'); }
    res.push(['gameplay_smoke', sm.ok, sm.checks, smNote]);
    return { ok: res.every(x => x[1]), cases: res.every(x => x[2] > 0) ? res.reduce((s, x) => s + x[2], 0) : 0, note: res.map(([n, k, c, w]) => `${n} ${k ? 'ok' : 'FAIL'} (${c})${w || ''}`).join(', ') };
  },
  /* (C5) a developer's round trip on a scratch copy of the working tree (dev/tools/checks/dev_workflow.js: edit a page module, build,
   * see it served and shown, edit a server module, undo both, rebuild, clean rebuild), and three contracts seen from a real Chromium on
   * B++ and on this tree (dev/tools/gate/checks/browser_contracts.js: the 52-member window.__api facade, unauthorized access refused, a
   * phone with touch) */
  workflow: () => {
    const d = run('dev_workflow', ['node', 'dev/tools/checks/dev_workflow.js', '--out', o('dev_workflow.json')]), jd = J(o('dev_workflow.json'));
    const b = run('browser_contracts', ['node', 'dev/tools/gate/checks/browser_contracts.js', '--old-dir', bppGame(), '--new-dir', wtGame(), '--out', o('browser_contracts.json')]), jb = J(o('browser_contracts.json'));
    const nd = jd ? jd.steps.filter(s => s.ok).length : 0, nb = jb ? jb.sides.reduce((a, s) => a + Object.values(s.checks || {}).filter(Boolean).length, 0) : 0;
    const agree = jb && jb.agree ? Object.values(jb.agree).filter(Boolean).length : 0;
    return { ok: d.exit === 0 && !!jd && jd.ok && b.exit === 0 && !!jb && jb.ok, cases: nd + nb,
      note: `dev workflow ${jd ? `${nd} of ${jd.steps.length} steps` : 'no report'}; browser contracts ${jb && jb.ok ? 'PASS' : 'FAIL'}: ${nb} checks on B++ and this tree (the 52-member facade, unauthorized access refused, a phone), the two sides agree on ${agree} of 3`, r: b };
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
const FAST = ['build', 'lineage', 'parts', 'modules', 'docs', 'scope', 'srv_golden', 'bpp_golden', 'session', 'sim', 'page', 'cli_golden', 'protocol', 'mutants', 'static', 'raw_live', 'quick_suites'];
const FULL = FAST.concat(['cli_mutants', 'live_wire', 'bpp_checks', 'browsers', 'workflow', 'contact_lab', 'suites', 'perf']);
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
if (!ARG['keep-heavy']) { R.removed = []; for (const d of ['game_bpp', 'game_candidate', 'srv_keep', 'bpp_keep', 'cli_keep', 'cli_h2_keep', 'cli_c3c_keep']) { const p = o(d); if (p.startsWith(OUT + path.sep) && fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); R.removed.push(d); } } }
fs.writeFileSync(o('gate_report.json'), JSON.stringify(R, null, 1) + '\n');
console.log(`MODERNIZATION GATE (${ARG.tier}${ARG.only ? ': ' + ARG.only : ''}): ${R.ok ? 'PASS' : 'FAIL'}  - report ${o('gate_report.json')}`);
process.exitCode = R.ok ? 0 : 1;
