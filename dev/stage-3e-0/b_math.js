/* Stage 3E-0 - Option B's easing, checked on the shipped line itself (development only)
 *
 *   node dev/stage-3e-0/b_math.js [--mp FILE] [--out FILE.json]
 *
 * Reads drawPeers' easing line out of mp.js ("const ft = ...aR = ...;") and runs it as it is, for each mode:
 *   1. at 60 fps (dt 1/60) B gives exactly .3 and .35 (A's per-frame values);
 *   2. what is left of a gap after 1 s, at 30 / 60 / 144 / 240 fps and with frame times jittered by +-40 %: B .7^60 and .65^60 at every
 *      rate (the elapsed time, not the frame count, decides); A (per frame) .7^fps;
 *   3. dt 0, negative, NaN, Infinity, 10 s (a paused tab): never NaN, never past the target (0 <= a <= 1), 10 s clamped to 0.25 s;
 *   4. the heading takes the short way round: from +3.0 to -3.0 rad it crosses +-pi (0.28 rad), never the long way (6 rad), at every rate.
 * Exit 0 only if every check holds. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const src = fs.readFileSync(ARG.mp || path.join(__dirname, '..', '..', 'mp.js'), 'utf8');
const line = src.split('\n').find(l => l.trim().startsWith('const ft = Number.isFinite(dt)'));
if (!line) { console.log('easing line not found'); process.exit(1); }
const ease = new Function('dt', 'PEER_MODE', line + '\nreturn [aP, aR];');
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const R = { tool: 'dev/stage-3e-0/b_math.js', line: line.trim(), checks: {} };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
{ const [p, r] = ease(1 / 60, 'b'), [pa, ra] = ease(1 / 60, 'a'); R.checks.at60 = { b: [p, r], a: [pa, ra], ok: Math.abs(p - .3) < 1e-12 && Math.abs(r - .35) < 1e-12 && pa === .3 && ra === .35 }; }
R.checks.oneSecond = {};
for (const fps of [30, 60, 144, 240]) for (const jit of [0, .4]) for (const mode of ['a', 'b']) {
  let gx = 1, gh = 1, t = 0; while (t < 1 - 1e-9) { let dt = 1 / fps * (1 + (jit ? (rnd() * 2 - 1) * jit : 0)); dt = Math.min(dt, 1 - t); t += dt; const [p, r] = ease(dt, mode); gx *= 1 - p; gh *= 1 - r; }   // (the gap left, multiplied out: no cancellation)
  R.checks.oneSecond[`${mode}@${fps}${jit ? '~jitter' : ''}`] = { posLeft: gx, headLeft: gh };
}
const want = [Math.pow(.7, 60), Math.pow(.65, 60)], B = Object.entries(R.checks.oneSecond).filter(([k]) => k.startsWith('b'));
R.checks.oneSecondExpectedB = { pos: want[0], head: want[1] };
R.checks.oneSecondOk = B.every(([, v]) => Math.abs(v.posLeft / want[0] - 1) < 1e-9 && Math.abs(v.headLeft / want[1] - 1) < 1e-9);
R.checks.spikes = {};
for (const dt of [0, -0.5, NaN, Infinity, 10, 0.25, 1e-6]) { const [p, r] = ease(dt, 'b'); R.checks.spikes[String(dt)] = [p, r]; }
R.checks.spikesOk = Object.values(R.checks.spikes).every(([p, r]) => Number.isFinite(p) && Number.isFinite(r) && p >= 0 && p <= 1 && r >= 0 && r <= 1)
  && R.checks.spikes['10'][0] === ease(.25, 'b')[0] && R.checks.spikes['0'][0] === 0 && R.checks.spikes['NaN'][0] === 0;
R.checks.shortArc = {};
for (const fps of [30, 60, 144, 240]) { let ang = 3.0, lo = Infinity, hi = -Infinity, travelled = 0; for (let i = 0; i < fps; i++) { const [, r] = ease(1 / fps, 'b'), d = angDiff(-3.0, ang) * r; travelled += Math.abs(d); ang += d; } R.checks.shortArc[fps] = { travelledRad: +travelled.toFixed(4), endErrRad: +Math.abs(angDiff(-3.0, ang)).toExponential(3) }; }
R.checks.shortArcOk = Object.values(R.checks.shortArc).every(v => v.travelledRad < .29 && v.endErrRad < 1e-6);
R.ok = R.checks.at60.ok && R.checks.oneSecondOk && R.checks.spikesOk && R.checks.shortArcOk;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(JSON.stringify({ ok: R.ok, at60: R.checks.at60, oneSecondOk: R.checks.oneSecondOk, a60left: R.checks.oneSecond['a@60'], a144left: R.checks.oneSecond['a@144'], b144left: R.checks.oneSecond['b@144'], spikesOk: R.checks.spikesOk, shortArc: R.checks.shortArc }));
process.exit(R.ok ? 0 : 1);
