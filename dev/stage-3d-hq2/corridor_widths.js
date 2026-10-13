/* Stage 3D HQ2 - how wide Level 0's passages are, for the player-collision radius (development only)
 *
 *   node dev/stage-3d-hq2/corridor_widths.js --game DIR --out FILE.json
 *
 * The game's own server-side level (sim.js: its map and collision, `clearAt` = the bundle's sl) in walk mode with the movement radius 15
 * (WORLD.MOVE.radius).  Every walkable point on a 12 px grid: how far a player's centre can move left/right and up/down from it before
 * a wall stops it (its centre span along each axis).  The narrower of the two, where it is under 400 px, is a passage's width as the
 * player's centre feels it; the passage's wall-to-wall width is that + 2 x 15.  Reported: the histogram of those spans (6 px bins) and,
 * for a contact distance D, how many samples a stationary player standing on the centre line would block (span < 2 D) and the band
 * around the centre line in which a stationary player blocks (span - D < offset-from-the-side < D).  And the one-tile corridor fixture
 * at y = 720 with its extent. */
'use strict';
const path = require('path'), fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const S = require(path.join(path.resolve(ARG.game || '.'), 'sim.js'))({ seed: 7 });
const R = 15, STEP = 12, W = 96 * 96, H = 72 * 96;
const ok = (x, y) => S.clearAt(x, y, R);
const span = (x, y, dx, dy, lim = 600) => { let a = 0, b = 0; while (a < lim && ok(x - dx * (a + 2), y - dy * (a + 2))) a += 2; while (b < lim && ok(x + dx * (b + 2), y + dy * (b + 2))) b += 2; return [a, b]; };
const hist = {}; let n = 0;
for (let y = 6; y < H; y += STEP) for (let x = 6; x < W; x += STEP) {
  if (!ok(x, y)) continue; n++;
  const [l, r] = span(x, y, 1, 0), [u, d] = span(x, y, 0, 1), s = Math.min(l + r, u + d);
  if (s >= 400) continue;
  const k = Math.floor(s / 6) * 6; hist[k] = (hist[k] || 0) + 1;
}
const out = { tool: 'dev/stage-3d-hq2/corridor_widths.js', wallRadius: R, grid: STEP, walkableSamples: n, spanHistogram6px: hist, contact: {} };
const minSpan = Math.min(...Object.keys(hist).map(Number));
for (const D of [30, 32, 36, 40]) {
  let c = 0; for (const k in hist) if (+k < 2 * D) c += hist[k];
  out.contact[D] = { samplesBlockedByACentredStill: c, blockingBandAtSpan60: [60 - D, D], halfWidthAtSpan60: Math.max(0, (D - (60 - D)) / 2), halfWidthAtSpan64: Math.max(0, (D - (64 - D)) / 2), halfWidthAtSpan66: Math.max(0, (D - (66 - D)) / 2) };
}
out.narrowestSpanBin = minSpan;
const [cl, cr] = span(1012, 720, 1, 0, 4000), [cu, cd] = span(1012, 720, 0, 1, 200);
out.fixtureCorridor = { y: 720, centreSpanAcross: cu + cd, centreLineFrom: 1012 - cl, centreLineTo: 1012 + cr, wallToWall: cu + cd + 2 * R };
fs.writeFileSync(ARG.out || 'corridor_widths.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ narrowestSpanBin: minSpan, contact: out.contact, fixtureCorridor: out.fixtureCorridor }));
