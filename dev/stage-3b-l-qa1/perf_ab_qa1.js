/* Stage 3B-L QA1 - parent vs QA1 performance, interleaved (development only; never served).
 *
 *   node dev/stage-3b-l-qa1/perf_ab_qa1.js --parent PATH [--game PATH] [--tiers medium,high] [--scenes A,I,D,H,E] [--reps 2] [--secs 4] [--out FILE.json]
 *
 * This machine renders with SwiftShader (software, 2 CPUs), and its speed drifts by tens of percent over an hour, so two
 * whole runs back to back are not a fair comparison.  Here every scene and tier is measured parent, QA1, parent, QA1 ...
 * (a fresh browser and server each time, perf_qa1.js --scenes X), and the medians are compared.  BR-RoLE's own time per
 * frame (its counters) standing and walking, the lamps it drew, and the page's frame interval. */
'use strict';
const { execFileSync } = require('child_process'); const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PARENT = path.resolve(opt('parent'));
const TIERS = (opt('tiers') || 'medium,high').split(','), SCENES = (opt('scenes') || 'A,I,D,H,E').split(','), REPS = +(opt('reps') || 2), SECS = opt('secs') || '4', OUT = opt('out');
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(1) : null; };
const R = { parent: PARENT, game: GAME, reps: REPS, secs: +SECS, rows: [] };
for (const tier of TIERS) for (const sc of SCENES) {
  const runs = { parent: [], qa1: [] };
  for (let k = 0; k < REPS; k++) for (const [who, g] of [['parent', PARENT], ['qa1', GAME]]) {
    const tmp = path.join(os.tmpdir(), `pab_${process.pid}_${who}.json`);
    try { execFileSync('node', [path.join(__dirname, 'perf_qa1.js'), '--game', g, '--port', who === 'parent' ? '9487' : '9488', '--tiers', tier, '--scenes', sc, '--secs', SECS, '--out', tmp], { stdio: 'ignore', timeout: 900000 }); } catch (e) { }
    try { const d = JSON.parse(fs.readFileSync(tmp, 'utf8')); if (d.rows[0]) runs[who].push(d.rows[0]); fs.unlinkSync(tmp); } catch (e) { }
  }
  const agg = rs => rs.length ? { label: rs[0].scene, standBR: med(rs.map(r => r.standing.brMs.mean)), walkBR: med(rs.map(r => r.walking.brMs.mean)), standP95: med(rs.map(r => r.standing.brMs.p95)),
    lamps: med(rs.map(r => r.standing.lamps)), standPage: med(rs.map(r => r.standing.pageMs.mean)), walkPage: med(rs.map(r => r.walking.pageMs.mean)), runs: rs.length,
    warm: { lampBuilds: med(rs.map(r => r.warmUp.lampBuilds)), lampBuildMs: med(rs.map(r => r.warmUp.lampBuildMs)), farFrameMaxMs: med(rs.map(r => r.warmUp.far ? r.warmUp.far.frameMaxMs : 0)), brMaxMs: med(rs.map(r => r.warmUp.brMaxMs)) } } : null;
  const row = { tier, scene: sc, parent: agg(runs.parent), qa1: agg(runs.qa1) };
  R.rows.push(row);
  const p = row.parent || {}, q = row.qa1 || {};
  console.log(`${tier} | ${(q.label || p.label || sc).padEnd(32)} | BR standing ${p.standBR} -> ${q.standBR} ms, walking ${p.walkBR} -> ${q.walkBR} ms | lamps ${p.lamps} -> ${q.lamps} | page ${p.standPage} -> ${q.standPage} ms | runs ${p.runs}/${q.runs}`);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
