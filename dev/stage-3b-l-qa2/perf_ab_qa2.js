/* Stage 3B-L QA2 - QA1 parent vs QA2 performance, interleaved (development only; never served).
 *
 *   node dev/stage-3b-l-qa2/perf_ab_qa2.js --parent PATH [--game PATH] [--quality medium] [--scenes A,D,..] [--reps 2] [--secs 4] [--out FILE.json]
 *
 * This machine renders with SwiftShader (software, 2 CPUs) and its speed drifts over an hour, so each scene is measured
 * parent, QA2, parent, QA2 ... (a fresh server and browser each time: perf_qa2.js --scenes X) and the medians compared. */
'use strict';
const { execFileSync } = require('child_process'); const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PARENT = path.resolve(opt('parent'));
const QUAL = opt('quality') || 'medium', SCENES = (opt('scenes') || 'A,D,H,E,K,NA,NB,NP').split(','), REPS = +(opt('reps') || 2), SECS = opt('secs') || '4', OUT = opt('out');
const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(2) : null; };
const R = { parent: PARENT, game: GAME, quality: QUAL, reps: REPS, secs: +SECS, rows: [] };
for (const sc of SCENES) {
  const runs = { parent: [], qa2: [] };
  for (let k = 0; k < REPS; k++) for (const [who, g] of k % 2 ? [['qa2', GAME], ['parent', PARENT]] : [['parent', PARENT], ['qa2', GAME]]) {
    const tmp = path.join(os.tmpdir(), `pab2_${process.pid}_${who}.json`);
    try { execFileSync('node', [path.join(__dirname, 'perf_qa2.js'), '--game', g, '--port', who === 'parent' ? '9487' : '9488', '--quality', QUAL, '--scenes', sc, '--secs', SECS, '--out', tmp], { stdio: 'ignore', timeout: 900000 }); } catch (e) { }
    try { const d = JSON.parse(fs.readFileSync(tmp, 'utf8')); if (d.rows[0]) runs[who].push(d.rows[0]); fs.unlinkSync(tmp); } catch (e) { }
  }
  const agg = rs => rs.length ? { label: rs[0].scene, nv: rs[0].nv, ir: rs[0].ir, runs: rs.length,
    each: rs.map(r => ({ page: [r.standing.pageMs.mean, r.walking.pageMs.mean], drawLight: [r.standing.drawLightMs, r.walking.drawLightMs] })),   // every run (standing, walking): the spread
    stand: { page: med(rs.map(r => r.standing.pageMs.mean)), drawLight: med(rs.map(r => r.standing.drawLightMs)), br: med(rs.map(r => r.standing.brMs.mean)), hl: med(rs.map(r => r.standing.hlMs)), ir: med(rs.map(r => r.standing.irMs)) },
    walk: { page: med(rs.map(r => r.walking.pageMs.mean)), drawLight: med(rs.map(r => r.walking.drawLightMs)), br: med(rs.map(r => r.walking.brMs.mean)), hl: med(rs.map(r => r.walking.hlMs)), ir: med(rs.map(r => r.walking.irMs)) }, lamps: med(rs.map(r => r.standing.lamps)),
    warm: { lampBuildMs: med(rs.map(r => r.warmUp.lampBuildMs)), lampBuildMaxMs: med(rs.map(r => r.warmUp.lampBuildMaxMs)), farFrameMaxMs: med(rs.map(r => r.warmUp.far ? r.warmUp.far.frameMaxMs : null)), facePhaseMaxMs: med(rs.map(r => r.warmUp.far && r.warmUp.far.phaseMaxMs ? r.warmUp.far.phaseMaxMs[3] : null)), brMaxMs: med(rs.map(r => r.warmUp.brMaxMs)) } } : null;
  const row = { scene: sc, parent: agg(runs.parent), qa2: agg(runs.qa2) }; R.rows.push(row);
  const p = row.parent || { stand: {}, walk: {} }, q = row.qa2 || { stand: {}, walk: {} };
  console.log(`${sc} | ${(q.label || p.label || '').padEnd(36)} | standing: page ${p.stand.page} -> ${q.stand.page} ms, drawLight ${p.stand.drawLight} -> ${q.stand.drawLight}, BR ${p.stand.br} -> ${q.stand.br}, Hl ${p.stand.hl} -> ${q.stand.hl}, IR ${p.stand.ir} -> ${q.stand.ir} | walking: page ${p.walk.page} -> ${q.walk.page}, drawLight ${p.walk.drawLight} -> ${q.walk.drawLight}, BR ${p.walk.br} -> ${q.walk.br}, Hl ${p.walk.hl} -> ${q.walk.hl}, IR ${p.walk.ir} -> ${q.walk.ir} | runs ${p.runs}/${q.runs}`);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
