/* Stage 3C - parent vs Stage 3C UI performance, interleaved (development only; never served).
 *
 *   node dev/stage-3c/perf_ab_c3.js --parent DIR --c3 DIR [--rounds 2] [--secs 4] [--out FILE.json]
 *
 * Runs perf_c3.js for the Stage 3B parent and for Stage 3C in turn (A B A B ... on desktop, then once each at 390 x 844 touch)
 * and writes every run plus a per-state summary (means over rounds) to --out. Software rendering: compare, never quote as GPU. */
'use strict';
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const PARENT = path.resolve(opt('parent')), C3 = path.resolve(opt('c3') || path.join(__dirname, '..', '..')), ROUNDS = +(opt('rounds') || 2), SECS = opt('secs') || '4', OUT = opt('out');
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'perfc3-'));
const run = (game, tag, mobile) => { const f = path.join(tmp, tag + '.json'); execFileSync('node', [path.join(__dirname, 'perf_c3.js'), '--game', game, '--secs', SECS, '--out', f, '--port', mobile ? '9632' : '9631'].concat(mobile ? ['--mobile'] : []), { stdio: 'inherit', timeout: 600000 }); return JSON.parse(fs.readFileSync(f, 'utf8')); };
const runs = [];
for (let r = 0; r < ROUNDS; r++) for (const [g, b] of [[PARENT, 'parent'], [C3, 'stage-3c']]) runs.push(Object.assign(run(g, `${b}_d${r}`, false), { round: r, label: b, view: 'desktop' }));
for (const [g, b] of [[PARENT, 'parent'], [C3, 'stage-3c']]) runs.push(Object.assign(run(g, `${b}_m`, true), { round: 0, label: b, view: 'touch 390x844' }));
const summary = {};
for (const x of runs) for (const row of x.rows || []) {
  const k = `${x.view} | ${row.state}`, s = summary[k] || (summary[k] = {}), t = s[x.label] || (s[x.label] = { n: 0, mean: 0, p95: 0, uiJs: 0, js: 0, preview: 0 });
  t.n++; t.mean += row.pageMs.mean; t.p95 += row.pageMs.p95; t.uiJs += row.uiJsMsPerFrame; t.js += row.jsMsPerFrame; t.preview += row.previewDrawsPerSec;
}
for (const s of Object.values(summary)) for (const t of Object.values(s)) for (const k of ['mean', 'p95', 'uiJs', 'js', 'preview']) t[k] = +(t[k] / t.n).toFixed(k === 'uiJs' ? 3 : 2);
const out = { parent: PARENT, c3: C3, rounds: ROUNDS, secs: +SECS, note: 'SwiftShader software rendering on 2 CPUs: only parent vs Stage 3C on the same states means anything.', summary, runs };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(summary, null, 1));
