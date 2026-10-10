/* Stage 3C QA1 - the first Stage 3C candidate vs QA1, interleaved (development only; never served).
 *
 *   node dev/stage-3c-qa1/perf_ab_qa1.js --first DIR --qa1 DIR [--rounds 2] [--secs 4] [--mobile 1] [--out FILE.json]
 *
 * Runs dev/stage-3c/perf_c3.js (menu idle, Settings over the menu, Customize over the menu, Level 0 lit standing / walking and
 * dark with the flashlight, monsters removed and frozen) for the first candidate (76bcc4a) and for QA1 in turn, A B A B on
 * desktop 1920x1080, then once each at 390x844 touch, and writes every run and a per-state summary (means over rounds).
 * SwiftShader software rendering on 2 CPUs: only the two builds against each other on the same states mean anything. */
'use strict';
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const FIRST = path.resolve(opt('first')), QA1 = path.resolve(opt('qa1') || path.join(__dirname, '..', '..')), ROUNDS = +(opt('rounds') || 2), SECS = opt('secs') || '4', OUT = opt('out'), MOBILE = opt('mobile') !== '0';
const PERF = path.join(__dirname, '..', 'stage-3c', 'perf_c3.js');
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'perfqa1-'));
const run = (game, tag, mobile) => { const f = path.join(tmp, tag + '.json'); execFileSync('node', [PERF, '--game', game, '--secs', SECS, '--out', f, '--port', mobile ? '9642' : '9641'].concat(mobile ? ['--mobile'] : []), { stdio: 'inherit', timeout: 900000 }); return JSON.parse(fs.readFileSync(f, 'utf8')); };
const runs = [];
for (let r = 0; r < ROUNDS; r++) for (const [g, b] of [[FIRST, 'first-candidate'], [QA1, 'qa1']]) runs.push(Object.assign(run(g, `${b}_d${r}`, false), { round: r, label: b, view: 'desktop 1920x1080' }));
if (MOBILE) for (const [g, b] of [[FIRST, 'first-candidate'], [QA1, 'qa1']]) runs.push(Object.assign(run(g, `${b}_m`, true), { round: 0, label: b, view: 'touch 390x844' }));
const summary = {};
for (const x of runs) for (const row of x.rows || []) {
  const k = `${x.view} | ${row.state}`, s = summary[k] || (summary[k] = {}), t = s[x.label] || (s[x.label] = { n: 0, mean: 0, p95: 0, uiJs: 0, js: 0, preview: 0 });
  t.n++; t.mean += row.pageMs.mean; t.p95 += row.pageMs.p95; t.uiJs += row.uiJsMsPerFrame; t.js += row.jsMsPerFrame; t.preview += row.previewDrawsPerSec;
}
for (const s of Object.values(summary)) {
  for (const t of Object.values(s)) for (const k of ['mean', 'p95', 'uiJs', 'js', 'preview']) t[k] = +(t[k] / t.n).toFixed(k === 'uiJs' ? 3 : 2);
  if (s['first-candidate'] && s.qa1) s.qa1VsFirstMeanPct = +((s.qa1.mean / s['first-candidate'].mean - 1) * 100).toFixed(1);
}
const out = { first: FIRST, qa1: QA1, rounds: ROUNDS, secs: +SECS, note: 'SwiftShader software rendering on 2 CPUs: only the first candidate vs QA1 on the same states means anything; never quote as GPU performance.', summary, runs, errors: runs.map(x => [x.label, x.view, x.error || null, (x.errors || []).length]) };
if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n'); }
console.log(JSON.stringify(summary, null, 1));
