/* scratch: the perf step's deaths scenario, sides interleaved, with heap and wall time (development only) */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const REPO = '/home/claude/backrooms-modern', HARN = path.join(REPO, 'dev/tools/gate/golden/srv_harness.js');
const LAYOUT = require(path.join(REPO, 'dev/tools/layout.js'));
const [,, OUT, ROUNDS = '9', SC = 'deaths', ...SIDES] = process.argv;
const tmp = fs.mkdtempSync(path.join(OUT, 'ab-')), oldSrc = path.join(tmp, 'old_server.js');
fs.writeFileSync(oldSrc, execFileSync('git', ['-C', REPO, 'show', '143b63ff42b88c6780c5043e0f61d64100f81f40:server.js']));
const PROJ = path.join(tmp, 'old_layout'); fs.mkdirSync(PROJ); LAYOUT.projectOld(REPO, PROJ);
const SH = '/home/claude/backrooms-shadows';
const def = { A: [oldSrc, PROJ], B: [path.join(REPO, 'server.js'), REPO], A2: [oldSrc, PROJ], B2: [path.join(REPO, 'server.js'), REPO], C: [path.join(SH, 'server.js'), SH], D: [oldSrc, SH] };
const sides = SIDES.length ? SIDES : ['A', 'B'];
const res = {}; for (const s of sides) res[s] = [];
for (let r = 0; r < +ROUNDS; r++) for (const s of sides) {
  const [src, dir] = def[s], pf = path.join(tmp, 'p.json'), tr = path.join(tmp, 't.jsonl');
  const x = spawnSync(process.execPath, [HARN, '--src', src, '--dir', dir, '--scenario', SC, '--out', tr, '--perf', pf], { encoding: 'utf8', timeout: 600000 });
  if (x.status !== 0) throw new Error(s + ' failed: ' + x.stdout + x.stderr);
  const p = JSON.parse(fs.readFileSync(pf, 'utf8')); res[s].push(p);
}
const med = a => { const v = a.slice().sort((x, y) => x - y), n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; };
const sum = {};
for (const s of sides) { const c = res[s].map(p => p.cpuUserMs + p.cpuSysMs); sum[s] = { cpuMed: +med(c).toFixed(1), cpuMin: +Math.min(...c).toFixed(1), cpuMax: +Math.max(...c).toFixed(1), userMed: +med(res[s].map(p => p.cpuUserMs)).toFixed(1), sysMed: +med(res[s].map(p => p.cpuSysMs)).toFixed(1), wallMed: +med(res[s].map(p => p.wallMs)).toFixed(1), heapMed: med(res[s].map(p => p.heapUsedMB)), rssMed: med(res[s].map(p => p.rssMB)) }; }
if (sides.length === 2) { const a = res[sides[0]].map(p => p.cpuUserMs + p.cpuSysMs), b = res[sides[1]].map(p => p.cpuUserMs + p.cpuSysMs), d = a.map((x, i) => b[i] - x);
  sum.paired = { medianDiffMs: +med(d).toFixed(1), medianRatioPct: +(med(a.map((x, i) => (b[i] / x - 1) * 100))).toFixed(2), secondSlowerRounds: d.filter(x => x > 0).length, rounds: d.length }; }
console.log(SC, JSON.stringify(sum));
fs.writeFileSync(path.join(OUT, `ab_${SC}_${sides.join('')}_${Date.now()}.json`), JSON.stringify({ sides, rounds: +ROUNDS, res, sum }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
