/* Stage 3D HQ2 - E06 at different render rates: a NEW RUN blast's replay is the same physics at any frame rate (development only)
 *
 *   node dev/stage-3d-hq2/boom_fps.js --game DIR [--n 64] [--out FILE.json]
 *
 * A page plays a blast by advancing its physics to the clock time of each frame it draws (dphys.advance: fixed 240 Hz steps up to that
 * time; mp.js startFx -> the bundle's death class -> dphys.frame).  How many frames it draws, and when, depends on the screen and the
 * machine.  This runs the server's own blast (death_srv.boomBegin on the real level, as server.js does) N times - half on open floor,
 * half hugging a wall, every facing, light kind and hat - and advances each copy to the end (3.2 s) in the pieces a page would:
 *   30, 60, 120, 144, 240 and 360 frames a second; a jittered 20-200 FPS schedule with stalls of up to 0.1 s (a busy page); and the
 *   Death Lab's clock (0.25x, then paused for 2 s, then single frames, then 1x: dphys.clock's own arithmetic, presentation only)
 * and compares every state a frame shows with the one-step-at-a-time reference after the same number of 240 Hz steps:
 *   F1 body (x, y, angle), both hands, the light and the hat: bit for bit
 *   F2 the end state (where the corpse is made) and the wall marks: bit for bit
 *   F3 the light's release (dphys.releaseOf): the same
 * Exit 0 only if every schedule matches for every blast. */
'use strict';
const path = require('path'), fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const G = path.resolve(ARG.game || '.'), D = require(path.join(G, 'death_srv.js')), sim = require(path.join(G, 'sim.js'))({ seed: 9 }), N = +(ARG.n || 64);
const DP = D.DP, END = 3.2, DT = 1 / 240;
const kinds = ['flashlight', 'lantern', 'headlamp', 'camcorder'], hats = ['none', 'cap', 'beanie', 'hardhat'];
let rs = 777; const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
const places = [];
while (places.length < N / 2) { const x = 300 + rnd() * 8600, y = 300 + rnd() * 6300; if (sim.clearAt(x, y, 30)) places.push({ x, y, wall: false }); }
while (places.length < N) { const x = 300 + rnd() * 8600, y = 300 + rnd() * 6300; if (!sim.clearAt(x, y, 15) || sim.clearAt(x, y, 25)) continue; places.push({ x, y, wall: true }); }
const snap = S => [S.stepN, S.b.x, S.b.y, S.b.th, S.h[0].x, S.h[0].y, S.h[1].x, S.h[1].y, S.eq.has ? S.eq.x : null, S.eq.has ? S.eq.y : null, S.eq.has ? S.eq.rot : null, S.hat.has ? S.hat.x : null, S.hat.has ? S.hat.y : null, S.hat.has ? S.hat.rot : null];
const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
// the frame times of each schedule (seconds of the replay's own clock, ending at the blast's end)
function times(fps) { const t = []; for (let k = 1; k * (1 / fps) < END + 1 / fps; k++) t.push(Math.min(END, k / fps)); return t; }
function jittered() { const t = []; let c = 0, r = 4242; const rj = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  while (c < END) { c += rj() < .05 ? .03 + rj() * .07 : 1 / (20 + rj() * 180); t.push(Math.min(END, c)); } return t; }
function lab() {                                                                  // dphys.clock with the Death Lab on: dt clamped to 0.1 s, then x speed, paused, or stepped
  const t = []; let c = 0, real = 0; const tick = (dt, speed, paused, step) => { real += dt; if (step) c += step / 60; else if (!paused) c += Math.min(.1, dt) * speed; t.push(Math.min(END, c)); };
  for (let i = 0; i < 120; i++) tick(1 / 60, .25, false, 0);                    // 2 s at 0.25x
  for (let i = 0; i < 120; i++) tick(1 / 60, 1, true, 0);                       // paused 2 s
  for (let i = 0; i < 12; i++) tick(1 / 60, 1, true, 1);                        // STEP 1 FRAME, twelve times
  tick(1 / 60, 1, true, 6);                                                      // STEP 6
  while (c < END) tick(1 / 60, 1, false, 0);                                     // RESET CLOCK: 1x to the end
  return t;
}
const SCHED = { fps30: times(30), fps60: times(60), fps120: times(120), fps144: times(144), fps240: times(240), fps360: times(360), jitter20to200: jittered(), deathLab: lab() };
const res = { tool: 'dev/stage-3d-hq2/boom_fps.js', game: G, blasts: N, schedules: Object.fromEntries(Object.entries(SCHED).map(([k, v]) => [k, v.length])), compared: 0, fails: [] };
const bad = (i, sch, what, info) => { if (res.fails.length < 30) res.fails.push({ i, schedule: sch, what, info }); };
const t0 = process.hrtime.bigint();
places.forEach((p, i) => {
  const pl = DP.boomPlan(1 + (i % 5), 1 + i), info = { look: hats[i % 4] + '|plain|#e6bb76|#ffcc77|none', ek: kinds[i % 4], vx: 0, vy: 0, light: true };
  const B = { k: 'Boom', x: Math.round(p.x), y: Math.round(p.y), a: +(i * .7 % 6.28).toFixed(3), d: pl.d, s: pl.s };
  const ref = D.boomBegin(B, info, sim).S, steps = [snap(ref)];                // the reference: one 240 Hz step at a time
  while (ref.t + DT <= END + 1e-9) { DP.advance(ref, ref.t + DT); steps.push(snap(ref)); }
  const refEnd = snap(ref), refMarks = JSON.stringify(DP.marks(ref)), refRel = DP.releaseOf(ref);
  for (const [name, T] of Object.entries(SCHED)) {
    const S = D.boomBegin(B, info, sim).S;
    for (const t of T) {
      DP.advance(S, t); const s = snap(S), r = steps[S.stepN]; res.compared++;
      if (!r || !same(s, r)) { bad(i, name, 'F1 a frame differs from the reference after the same number of steps', { t, stepN: S.stepN, frame: s.slice(0, 4), ref: r && r.slice(0, 4) }); break; }
    }
    if (!same(snap(S), refEnd)) bad(i, name, 'F2 the end state differs', { end: snap(S).slice(0, 4), ref: refEnd.slice(0, 4) });
    if (JSON.stringify(DP.marks(S)) !== refMarks) bad(i, name, 'F2 the wall marks differ', {});
    if (!Object.is(DP.releaseOf(S), refRel)) bad(i, name, 'F3 the light\'s release differs', { rel: DP.releaseOf(S), ref: refRel });
  }
});
res.ms = +(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0);
res.ok = !res.fails.length && res.compared > 0;
res.summary = { blasts: N, schedules: Object.keys(SCHED).length, framesCompared: res.compared, failures: res.fails.length };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(res.summary), res.fails.slice(0, 3));
process.exit(res.ok ? 0 : 1);
