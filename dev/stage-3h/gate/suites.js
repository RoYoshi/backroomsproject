/* Stage 3H2 (H2-0) - run the game's existing test suites and classify every failure against the B++ record (development only).
 *
 *   node dev/stage-3h/gate/suites.js derive --logs DIR --out known_failures_bpp.json     (from the 3H1 B++ logs: evidence/h1/suites/)
 *   node dev/stage-3h/gate/suites.js run [--known known_failures_bpp.json] [--only a,b] [--out DIR]
 *
 * The suites have failures that predate Stage 3H (3H1 finding F-017: the same names as Stage 3D HQ2's record, plus test_br_role's three
 * from HQ4 / HQ5).  A refactor must leave exactly those failing.  For every suite this tool reads each "PASS <title>" / "FAIL <title>" line
 * (the title is the text up to the first run of two spaces: the measured details after it vary from run to run) and the "N/M passed" line,
 * then classifies:
 *   - a known failure that still fails: expected;
 *   - a failure not in the record: NEW FAILURE (the gate fails);
 *   - a known failure that now passes: CHANGED (the gate fails too: a refactor must not change a result either way), unless the record marks
 *     it flaky (a real-time test whose result depends on a race, e.g. a real Hound's timing);
 *   - a suite that reported no case at all, or no "N/M passed" line: FAIL (a test that runs nothing is not a pass).
 * Suites run with a synthetic admin passcode, never the user's and never the server's built-in default. */
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const MODE = process.argv[2];
const ARG = {}; for (let i = 3; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
const PASS = 'd3-synthetic-admin';
/* the suites 3H1 ran on B++ (evidence/h1/suites/<name>.log), how to run them, and their time limits */
const SUITES = {
  npm_test: { cmd: ['node', 'dev/tests/run.js'], env: { ADMIN_PASSCODE: PASS }, ms: 900000 },
  s_humanqa_hotfix: { cmd: ['node', 'dev/tests/run.js', 's_humanqa_hotfix.js'], env: { ADMIN_PASSCODE: PASS }, ms: 300000 },
  /* s_ir alone (it is part of npm_test too): I1 reads server.js's text, so a refactor of server.js is checked by it in seconds.  3H1 ran
   * it only inside npm_test: its record is npm_test.log's I-cases (derivedFrom below) */
  s_ir: { cmd: ['node', 'dev/tests/run.js', 's_ir.js'], env: { ADMIN_PASSCODE: PASS }, ms: 300000, derivedFrom: { log: 'npm_test', title: /^I\d+ / } },
  test_shadows: { cmd: ['node', 'dev/shadows/test_shadows.js'], ms: 300000 },
  test_br_role: { cmd: ['node', 'dev/br-role/test_br_role.js'], ms: 300000 },
  interp_test: { cmd: ['node', 'dev/tests/interp_test.js'], ms: 120000, noTitles: true },
  test_3bn: { cmd: ['node', 'dev/stage-3b-n/test_3bn.js'], ms: 120000 },
  audit_net: { cmd: ['node', 'dev/tests/audit_net.js'], env: { ADMIN_PASSCODE: PASS }, ms: 600000 },
  audit_net2: { cmd: ['node', 'dev/tests/audit_net2.js'], env: { ADMIN_PASSCODE: PASS }, ms: 900000 },
  ir_net: { cmd: ['node', 'dev/tests/ir_net.js'], env: { ADMIN_PASSCODE: PASS }, ms: 300000 },
};
const title = l => l.replace(/^(PASS|FAIL) /, '').split(/ {2,}/)[0].trim();
function parse(text) {
  const lines = text.split('\n'), pass = [], fail = [];
  for (const l of lines) { if (/^PASS /.test(l)) pass.push(title(l)); else if (/^FAIL /.test(l)) fail.push(title(l)); }
  const m = [...text.matchAll(/^(\d+)\/(\d+) passed/gm)].pop();
  const summary = m ? { passed: +m[1], total: +m[2] } : null;
  const checksPassed = /checks passed|interpolation checks passed/.test(text);
  return { pass, fail, summary, checksPassed };
}
if (MODE === 'derive') {
  const K = { tool: 'dev/stage-3h/gate/suites.js', derivedFrom: ARG.logs, note: 'B++ parent 143b63f; the failing titles of every suite 3H1 ran (3H1 finding F-017)', suites: {} };
  for (const name of Object.keys(SUITES)) {
    const D = SUITES[name].derivedFrom, f = path.join(ARG.logs, (D ? D.log : name) + '.log'); if (!fs.existsSync(f)) { K.suites[name] = { missing: true }; continue; }
    const p = parse(fs.readFileSync(f, 'utf8'));
    if (D) { p.pass = p.pass.filter(t => D.title.test(t)); p.fail = p.fail.filter(t => D.title.test(t)); p.summary = { passed: p.pass.length, total: p.pass.length + p.fail.length }; }
    K.suites[name] = Object.assign({ summary: p.summary, failing: p.fail.sort(), passingCount: p.pass.length, flaky: [] }, D ? { derivedFrom: `${D.log}.log, the cases whose title matches ${D.title}` } : {});
  }
  /* audit_net2's LC1 depends on a real Hound's timing: Stage 3D HQ2 saw it fail once and pass twice on identical code */
  if (K.suites.audit_net2) K.suites.audit_net2.flaky = ['LC1'];
  fs.writeFileSync(ARG.out, JSON.stringify(K, null, 1) + '\n');
  for (const [n, s] of Object.entries(K.suites)) console.log(`${n}: ${s.summary ? s.summary.passed + '/' + s.summary.total : '(no summary)'} failing ${s.failing ? s.failing.length : '?'}`);
} else if (MODE === 'run') {
  const K = JSON.parse(fs.readFileSync(ARG.known || path.join(__dirname, 'known_failures_bpp.json'), 'utf8'));
  const only = ARG.only ? ARG.only.split(',') : Object.keys(SUITES);
  const OUT = ARG.out ? path.resolve(ARG.out) : null; if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const R = { tool: 'dev/stage-3h/gate/suites.js', known: ARG.known || 'dev/stage-3h/gate/known_failures_bpp.json', suites: {}, ok: true };
  for (const name of only) {
    const S = SUITES[name], k = K.suites[name] || { failing: [], flaky: [] }, t0 = Date.now();
    const r = spawnSync(S.cmd[0], S.cmd.slice(1), { cwd: REPO, encoding: 'utf8', timeout: S.ms, env: Object.assign({}, process.env, S.env || {}), maxBuffer: 1 << 28 });
    const text = (r.stdout || '') + (r.stderr || ''), p = parse(text);
    if (OUT) fs.writeFileSync(path.join(OUT, name + '.log'), text);
    const isFlaky = t => (k.flaky || []).some(f => t === f || t.startsWith(f + ' '));
    const newFail = p.fail.filter(t => !k.failing.includes(t) && !isFlaky(t));
    const nowPass = k.failing.filter(t => p.pass.includes(t) && !isFlaky(t));
    const missing = k.failing.filter(t => !p.pass.includes(t) && !p.fail.includes(t));
    const ran = p.pass.length + p.fail.length;
    const empty = S.noTitles ? !(p.checksPassed || ran) : (!ran || !p.summary);
    const timedOut = r.error && /ETIMEDOUT/.test(String(r.error.code || r.error));
    const rec = { ran, summary: p.summary, failing: p.fail, newFailures: newFail, knownFailuresNowPassing: nowPass, knownFailuresNotRun: missing, empty, timedOut: !!timedOut, exit: r.status, ms: Date.now() - t0 };
    rec.ok = !newFail.length && !nowPass.length && !missing.length && !empty && !timedOut;
    R.suites[name] = rec; R.ok = R.ok && rec.ok;
    console.log(`${rec.ok ? 'PASS' : 'FAIL'} ${name}: ${p.summary ? p.summary.passed + '/' + p.summary.total : ran + ' cases'}; known failures ${k.failing.length}${newFail.length ? '; NEW FAILURES: ' + newFail.join(' | ') : ''}${nowPass.length ? '; CHANGED (now passing): ' + nowPass.join(' | ') : ''}${missing.length ? '; known failures not run: ' + missing.length : ''}${empty ? '; RAN NOTHING' : ''}${timedOut ? '; TIMED OUT' : ''} (${Math.round(rec.ms / 1000)} s)`);
  }
  if (OUT) fs.writeFileSync(path.join(OUT, 'suites_report.json'), JSON.stringify(R, null, 1) + '\n');
  console.log('SUITES: ' + (R.ok ? 'PASS (only the known B++ failures)' : 'FAIL'));
  process.exitCode = R.ok ? 0 : 1;
} else { console.error('usage: suites.js derive|run ...'); process.exitCode = 2; }
