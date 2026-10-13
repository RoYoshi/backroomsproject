/* Stage 3D HQ2 - the server's own run of a NEW RUN blast, sampled at given physics times (development only; E06's reference)
 *
 *   node dev/stage-3d-hq2/boom_ref.js --game DIR --in FILE.json --out FILE.json
 *
 * FILE.json: { fx: the blast's replay message as the server sent it (x, y, a, d, s, ek, lk, vx, vy), steps: [240 Hz step counts, ...] }.
 * Runs the blast exactly as server.js does (death_srv.boomBegin on the real level, the 240 Hz dphys steps) and writes, for each time,
 * where the body (x, y, angle), both hands, the light and the hat are after that many steps - to compare with what each browser's replay
 * showed after the same number of steps. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const G = path.resolve(ARG.game || '.'), D = require(path.join(G, 'death_srv.js')), sim = require(path.join(G, 'sim.js'))({ seed: 5 });
const I = JSON.parse(fs.readFileSync(ARG.in, 'utf8')), f = I.fx;
const info = { look: f.lk, ek: f.ek, vx: f.vx || 0, vy: f.vy || 0 };
const R = D.boomBegin({ k: 'Boom', x: f.x, y: f.y, a: f.a, d: f.d, s: f.s }, info, sim), S = R.S;
const out = [];
for (const n of [...new Set(I.steps)].sort((a, b) => a - b)) {
  D.DP.advance(S, n / 240 + 1e-7);                                        // exactly n of the 240 Hz steps (as many as the page had run)
  const r = v => +v.toFixed(2);
  out.push({ n, steps: S.stepN, st: S.t, state: S.state, b: [r(S.b.x), r(S.b.y), +S.b.th.toFixed(4)], h: S.h.map(h => [r(h.x), r(h.y)]), eq: S.eq.has ? [r(S.eq.x), r(S.eq.y), +S.eq.rot.toFixed(4)] : null, hat: S.hat.has ? [r(S.hat.x), r(S.hat.y), +S.hat.rot.toFixed(4)] : null, marks: D.DP.marks(S).length });
}
fs.writeFileSync(ARG.out, JSON.stringify({ tool: 'dev/stage-3d-hq2/boom_ref.js', game: G, fx: f, samples: out }, null, 1) + '\n');
console.log(out.length + ' reference samples');
