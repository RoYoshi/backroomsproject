/* Stage 3D - what a death costs the server (development only).
 *
 *   node dev/stage-3d/perf_death_srv.js --game DIR [--reps 15] [--out FILE.json]
 *
 *  1. death_srv.bodyFor: the whole physical death run to its end (the fallback corpse), per variant, on the real geometry - median and
 *     worst milliseconds over REPS runs at different spots.  The server runs it once per death whose victim never reported a corpse,
 *     inside its 25 ms wake, so this is the stall a fallback adds to that room's tick.
 *  2. The 60 Hz step and the snapshot with 24 corpses in the room (MAX_BODIES) against none: sim.step time, and the bytes of the
 *     'bodies' message every client receives when the corpse list changes (and each joiner receives once).
 *  3. Process memory before and after 500 fallback corpses (setBody keeps at most 24).
 *  4. Where death_srv has begin / step / corpse (Stage 3D's server since the D6 review): the death as the server runs it, spread over its
 *     ticks - begin at the kill, step every 50 ms (aftTick runs on every second 25 ms wake) to the death's current time, corpse at its
 *     end.  Per variant: the largest single tick (begin, a step or the corpse), median and worst over the spots, and the total.
 *     The parent has none of this (its fallback is section 1, all in one tick).
 * GAME's own files are loaded (the parent export or the working tree). */
'use strict';
const path = require('path'), fs = require('fs');
const ARG = { reps: '15' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const G = path.resolve(ARG.game), REPS = +ARG.reps;
const D = require(path.join(G, 'death_srv.js')), sim = require(path.join(G, 'sim.js'))({ seed: 1 });
const ms = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const spots = []; for (let y = 400; y < 6600 && spots.length < REPS; y += 233) for (let x = 400; x < 9000 && spots.length < REPS; x += 377) if (sim.clearAt(x, y, 40)) spots.push([x, y]);
const info = { name: 'X', look: 'cap|plain|#e6bb76|#ffcc77|none', ek: 'flashlight', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, ex: 0, light: true };
const out = { tool: 'dev/stage-3d/perf_death_srv.js', game: G, node: process.version, reps: REPS, bodyFor: {}, step: {}, bodiesMsg: {}, memory: {} };
for (const k of ['Hound', 'Smiler']) for (const v of 'ABCD') {
  const t = [];
  for (const [x, y] of spots) { const kill = { k, v, x, y, a: 0, ax: x - 46, ay: y, w: 0 }; t.push(ms(() => D.bodyFor(1, kill, info, sim))); }
  out.bodyFor[k + ' ' + v] = { medianMs: +med(t).toFixed(3), maxMs: +Math.max(...t).toFixed(3) };
}
const stepT = (n) => { const t = []; for (let i = 0; i < n; i++) t.push(ms(() => sim.step(1 / 60))); return t; };
stepT(120);
const s0 = stepT(600); out.step.noCorpses = { medianMs: +med(s0).toFixed(4), p95Ms: +s0.sort((a, b) => a - b)[Math.floor(s0.length * .95)].toFixed(4) };
const kill0 = { k: 'Hound', v: 'A', x: spots[0][0], y: spots[0][1], a: 0, ax: spots[0][0] - 46, ay: spots[0][1], w: 0 };
for (let i = 0; i < 24; i++) { const sp = spots[i % spots.length]; const R = D.bodyFor(100 + i, Object.assign({}, kill0, { x: sp[0] + i, y: sp[1], ax: sp[0] - 46 + i, ay: sp[1], k: i % 2 ? 'Smiler' : 'Hound', v: 'ABCD'[i % 4] }), info, sim); sim.setBody(100 + i, R.body); }
const s1 = stepT(600); out.step.corpses24 = { medianMs: +med(s1).toFixed(4), p95Ms: +s1.sort((a, b) => a - b)[Math.floor(s1.length * .95)].toFixed(4) };
const msg = JSON.stringify({ t: 'bodies', v: sim.bodyVer, b: [...sim.bodies.values()] });
out.bodiesMsg = { corpses: sim.bodies.size, bytes: Buffer.byteLength(msg), bytesPerCorpse: Math.round(Buffer.byteLength(msg) / sim.bodies.size) };
if (global.gc) global.gc(); const m0 = process.memoryUsage().heapUsed;
for (let i = 0; i < 500; i++) { const sp = spots[i % spots.length]; sim.setBody(1000 + i, D.bodyFor(1000 + i, Object.assign({}, kill0, { x: sp[0], y: sp[1], ax: sp[0] - 46, ay: sp[1] }), info, sim).body); }
if (global.gc) global.gc(); const m1 = process.memoryUsage().heapUsed;
out.memory = { heapBeforeMB: +(m0 / 1048576).toFixed(2), heapAfter500MB: +(m1 / 1048576).toFixed(2), bodiesKept: sim.bodies.size, gcExposed: !!global.gc };
if (D.begin && D.step && D.corpse) {
  out.incremental = {};
  for (const k of ['Hound', 'Smiler']) for (const v of 'ABCD') {
    const big = [], tot = [];
    for (const [x, y] of spots) {
      const kill = { k, v, x, y, a: 0, ax: x - 46, ay: y, w: 0 }, dur = D.durOf(kill); let P, worst = 0, sum = 0;
      const tk = f => { const t = ms(f); worst = Math.max(worst, t); sum += t; };
      tk(() => { P = D.begin(kill, info, sim); });
      for (let t = .05; t < dur; t += .05) tk(() => D.step(P, t));
      tk(() => D.corpse(1, kill, info, P));
      big.push(worst); tot.push(sum);
    }
    out.incremental[k + ' ' + v] = { largestTickMedianMs: +med(big).toFixed(3), largestTickMaxMs: +Math.max(...big).toFixed(3), totalMedianMs: +med(tot).toFixed(3) };
  }
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
