/* Stage 3C QA2 - QA1 vs QA2 on the menu and in play, interleaved (development only; never served).
 *
 *   node dev/stage-3c-qa2/perf_ab_qa2.js --qa1 DIR [--qa2 DIR] [--rounds 2] [--secs 4] [--mobile 1] [--out FILE.json]
 *
 * Writes an adapted copy of dev/stage-3c/perf_c3.js (menu idle, Settings over the menu, Customize over the menu, Level 0 lit
 * standing / walking and dark with the flashlight, monsters removed and frozen) as regress/perf_c3.js - its helpers from
 * regress/ui_lib_gate.js, so a QA2 page is measured only once its boot is over and its ready gate passed (a QA1 page has neither) -
 * and runs it for QA1 and QA2 in turn, A B A B on desktop 1920 x 1080, then once each at 390 x 844 touch; writes every run and a
 * per-state summary (means over rounds). On QA2 the menu music plays from the moment the menu shows; on QA1 it starts with the
 * probe's first press on the menu (its Settings step). SwiftShader software rendering on 2 CPUs: only the two builds against each
 * other on the same states mean anything. */
'use strict';
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const QA1 = path.resolve(opt('qa1')), QA2 = path.resolve(opt('qa2') || path.join(__dirname, '..', '..')), ROUNDS = +(opt('rounds') || 2), SECS = opt('secs') || '4', OUT = opt('out'), MOBILE = opt('mobile') !== '0';
const ORIG = path.join(__dirname, '..', 'stage-3c', 'perf_c3.js'), COPY = path.join(__dirname, 'regress', 'perf_c3.js');
let src = fs.readFileSync(ORIG, 'utf8');
for (const [from, to] of [["require('./ui_lib.js')", "require('./ui_lib_gate.js')"], ["path.join(__dirname, '..', '..')", "path.join(__dirname, '..', '..', '..')"]]) {
  if (src.split(from).length !== 2) throw new Error('perf_c3.js: "' + from + '" is not there exactly once'); src = src.split(from).join(to); }
fs.writeFileSync(COPY, '/* ADAPTED COPY of dev/stage-3c/perf_c3.js for Stage 3C QA2 - written by dev/stage-3c-qa2/perf_ab_qa2.js; do not edit by hand.\n *   - helpers from ui_lib_gate.js: a QA2 page is measured once its boot is over and its ready gate passed (one key press)\n */\n' + src);
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'perfqa2-'));
const run = (game, tag, mobile) => { const f = path.join(tmp, tag + '.json'); execFileSync('node', [COPY, '--game', game, '--secs', SECS, '--out', f, '--port', mobile ? '9872' : '9871'].concat(mobile ? ['--mobile'] : []), { stdio: 'inherit', timeout: 900000 }); return JSON.parse(fs.readFileSync(f, 'utf8')); };
const runs = [];
for (let r = 0; r < ROUNDS; r++) for (const [g, b] of [[QA1, 'qa1'], [QA2, 'qa2']]) runs.push(Object.assign(run(g, `${b}_d${r}`, false), { round: r, label: b, view: 'desktop 1920x1080' }));
if (MOBILE) for (const [g, b] of [[QA1, 'qa1'], [QA2, 'qa2']]) runs.push(Object.assign(run(g, `${b}_m`, true), { round: 0, label: b, view: 'touch 390x844' }));
const summary = {};
for (const x of runs) for (const row of x.rows || []) {
  const k = `${x.view} | ${row.state}`, s = summary[k] || (summary[k] = {}), t = s[x.label] || (s[x.label] = { n: 0, mean: 0, p95: 0, uiJs: 0, js: 0, preview: 0 });
  t.n++; t.mean += row.pageMs.mean; t.p95 += row.pageMs.p95; t.uiJs += row.uiJsMsPerFrame; t.js += row.jsMsPerFrame; t.preview += row.previewDrawsPerSec;
}
for (const s of Object.values(summary)) {
  for (const t of Object.values(s)) for (const k of ['mean', 'p95', 'uiJs', 'js', 'preview']) t[k] = +(t[k] / t.n).toFixed(k === 'uiJs' ? 3 : 2);
  if (s.qa1 && s.qa2) s.qa2VsQa1MeanPct = +((s.qa2.mean / s.qa1.mean - 1) * 100).toFixed(1);
}
const out = { qa1: QA1, qa2: QA2, rounds: ROUNDS, secs: +SECS, note: 'SwiftShader software rendering on 2 CPUs: only QA1 vs QA2 on the same states means anything; never quote as GPU performance.', summary, runs, errors: runs.map(x => [x.label, x.view, x.error || null, (x.errors || []).length]) };
if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n'); }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }
console.log(JSON.stringify(summary, null, 1));
