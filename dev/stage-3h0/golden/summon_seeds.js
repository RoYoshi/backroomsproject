/* Stage 3H0 - the summoned-Hound sequence in the closed world, many seeds, the parent's server.js against the working tree's (development only).
 *
 *   node dev/stage-3h0/golden/summon_seeds.js [--seeds 30] [--out FILE.json]
 *
 * For each seed (a different fixed world and random stream), srv_harness.js runs the 'summon' scenario of srv_scenarios_summon.js on the
 * parent's server.js and on the working tree's, against the same game files.  The two traces must be byte-identical: every message out,
 * every call into the simulation, every monster position in every snapshot.  The closest approach of any monster to the admin's spot is
 * read from each trace too, so the distribution the live tools sample can be seen per seed, old and new side by side. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const ARG = { seeds: '30', 'old-ref': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b' };
for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), HARNESS = path.join(__dirname, 'srv_harness.js'), SCEN = path.join(__dirname, 'srv_scenarios_summon.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h0ss-')), oldSrc = path.join(tmp, 'old_server.js');
fs.writeFileSync(oldSrc, execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':server.js']));
const run = (src, seed, tag) => { const f = path.join(tmp, `${tag}_${seed}.jsonl`);
  const r = spawnSync(process.execPath, [HARNESS, '--src', src, '--dir', REPO, '--scenario', 'summon', '--scenarios', SCEN, '--seed', String(seed), '--out', f], { encoding: 'utf8', timeout: 300000 });
  const t = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; const m = /summon minD (\d+|Infinity)/.exec(t);
  return { ok: r.status === 0, text: t, minD: m ? +m[1] : null, lines: t.split('\n').length - 1, err: r.status === 0 ? null : (r.stdout || '').slice(-300) }; };
const rows = []; let same = 0;
for (let s = 1; s <= +ARG.seeds; s++) {
  const o = run(oldSrc, s, 'old'), n = run(path.join(REPO, 'server.js'), s, 'new'), eq = o.ok && n.ok && o.text === n.text;
  if (eq) same++; rows.push({ seed: s, identical: eq, lines: o.lines, minDOld: o.minD, minDNew: n.minD, err: o.err || n.err });
  console.log(`seed ${s}: ${eq ? 'identical' : 'DIFFERENT'} (${o.lines} lines); closest monster ${o.minD} px old, ${n.minD} px new`);
}
fs.rmSync(tmp, { recursive: true, force: true });
const d = rows.filter(r => r.minDOld !== null).map(r => r.minDOld);
const rep = { tool: 'dev/stage-3h0/golden/summon_seeds.js', seeds: +ARG.seeds, identical: same, allIdentical: same === rows.length,
  closestApproach: { under620: d.filter(x => x < 620).length, of: d.length, values: d }, rows };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
console.log(`${same}/${rows.length} seeds byte-identical old against new; a monster came within 620 px in ${rep.closestApproach.under620} of ${d.length} seeded worlds`);
process.exitCode = rep.allIdentical ? 0 : 1;
