/* Stage 3H engine modernization (H3M-1) - is a failure of the gate's perf step a slowdown, or this machine's noise? (development only)
 *
 *   node dev/stage-3h-modernization/tools/m1_perf_paired.js --work <empty scratch folder> [--rounds 30] [--scenario deaths] [--out FILE.json]
 *
 * The gate's perf step (dev/tools/gate/golden/perf_det.js, the 3H0 rule) times each server scenario 7 times per side. The new side passes
 * when its median is at most the old median plus max(the old side's spread, 5 % of the old median). This tool runs one scenario through
 * the same harness (dev/tools/gate/golden/srv_harness.js) on four sides, interleaved round by round, so every round sees the same machine:
 *   D  B++'s server.js in the frozen Stage 3H2 tree (22751bb, old layout): the 3H0 and 3H2 tools' old side
 *   C  Stage 3H2's server.js in the frozen Stage 3H2 tree: the 3H2 tools' new side
 *   A  B++'s server.js against this tree's runtime under its old names (dev/tools/layout.js projectOld): the gate's old side
 *   B  this tree's server.js in this tree: the gate's new side
 * It reports each side's median, and for the pairs D/C (what Stage 3H2 changed), A/B (the gate's own comparison) and C/B (what the
 * modern layout changed):
 *   - the median paired difference;
 *   - the number of rounds in which the second side was slower;
 *   - how often the gate's rule fails on 7 consecutive rounds, in both directions.
 * The frozen tree is a detached git worktree of 22751bb made under --work and removed at the end. The pass rule is not changed here;
 * this only measures the noise it has to live with. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const ARG = { rounds: '30', scenario: 'deaths' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), HARN = path.join(REPO, 'dev', 'tools', 'gate', 'golden', 'srv_harness.js');
const BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40', FROZEN = '22751bbc39c91f3e54e3305638b2ef2c9dd12c68';
const LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
if (!ARG.work) { console.error('--work <empty scratch folder> is required'); process.exit(2); }
const WORK = path.resolve(ARG.work), WT = path.join(WORK, 'frozen'), PROJ = path.join(WORK, 'old_layout'), OLD = path.join(WORK, 'old_server.js');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be empty'); process.exit(2); }
fs.mkdirSync(WORK, { recursive: true });
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const rulePasses = (a, b) => { const am = med(a), tol = Math.max(Math.max(...a) - Math.min(...a), am * 0.05); return med(b) <= am + tol; };   // perf_det.js's server rule
const R = { tool: 'dev/stage-3h-modernization/tools/m1_perf_paired.js', scenario: ARG.scenario, rounds: +ARG.rounds, head: execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD']).toString().trim(), node: process.version, cpus: os.cpus().length, startedAt: new Date().toISOString(), sides: {}, pairs: {} };
execFileSync('git', ['-C', REPO, 'worktree', 'add', '--detach', WT, FROZEN], { stdio: 'ignore' });
try {
  fs.writeFileSync(OLD, execFileSync('git', ['-C', REPO, 'show', BPP + ':server.js']));
  fs.mkdirSync(PROJ); LAYOUT.projectOld(REPO, PROJ);
  const SIDES = { D: [OLD, WT], C: [path.join(WT, 'server.js'), WT], A: [OLD, PROJ], B: [path.join(REPO, 'server.js'), REPO] };
  const runs = { D: [], C: [], A: [], B: [] };
  for (let r = 0; r < R.rounds; r++) for (const s of Object.keys(SIDES)) {
    const [src, dir] = SIDES[s], pf = path.join(WORK, 'perf.json'), tr = path.join(WORK, 'trace.jsonl');
    const x = spawnSync(process.execPath, [HARN, '--src', src, '--dir', dir, '--scenario', ARG.scenario, '--out', tr, '--perf', pf], { encoding: 'utf8', timeout: 600000 });
    if (x.status !== 0) throw new Error(`side ${s}, round ${r}: the harness failed: ${x.stdout}${x.stderr}`);
    const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
    runs[s].push({ cpuMs: +(p.cpuUserMs + p.cpuSysMs).toFixed(3), wallMs: +p.wallMs.toFixed(3), heapUsedMB: p.heapUsedMB });
  }
  for (const [s, a] of Object.entries(runs)) {
    const c = a.map(x => x.cpuMs);
    R.sides[s] = { what: { D: "B++'s server.js, frozen 3H2 tree", C: "3H2's server.js, frozen 3H2 tree", A: "B++'s server.js, this tree's runtime under old names (the gate's old side)", B: "this tree's server.js (the gate's new side)" }[s], cpuMsMedian: +med(c).toFixed(1), cpuMsMin: Math.min(...c), cpuMsMax: Math.max(...c), wallMsMedian: +med(a.map(x => x.wallMs)).toFixed(1), heapUsedMBMedian: med(a.map(x => x.heapUsedMB)), cpuMs: c };
  }
  for (const [f, s] of [['D', 'C'], ['A', 'B'], ['C', 'B']]) {
    const a = R.sides[f].cpuMs, b = R.sides[s].cpuMs, d = a.map((x, i) => b[i] - x);
    let fail = 0, failRev = 0, n = 0;
    for (let i = 0; i + 7 <= a.length; i++, n++) { if (!rulePasses(a.slice(i, i + 7), b.slice(i, i + 7))) fail++; if (!rulePasses(b.slice(i, i + 7), a.slice(i, i + 7))) failRev++; }
    R.pairs[f + '/' + s] = { medianPairedDiffMs: +med(d).toFixed(1), medianPairedChangePct: +med(a.map((x, i) => (b[i] / x - 1) * 100)).toFixed(2), secondSlowerRounds: d.filter(x => x > 0).length, rounds: d.length, ruleWindows7: n, ruleFails: fail, ruleFailsReversed: failRev };
    console.log(`${f}/${s}: ${R.sides[f].cpuMsMedian} -> ${R.sides[s].cpuMsMedian} ms (median paired change ${R.pairs[f + '/' + s].medianPairedChangePct} %; second slower in ${R.pairs[f + '/' + s].secondSlowerRounds} of ${d.length} rounds; the 7-round rule fails on ${fail} of ${n} windows, ${failRev} reversed)`);
  }
} finally {
  try { execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', WT], { stdio: 'ignore' }); } catch (e) { R.worktreeLeft = WT; }
  fs.rmSync(PROJ, { recursive: true, force: true }); fs.rmSync(OLD, { force: true });
}
R.finishedAt = new Date().toISOString();
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
