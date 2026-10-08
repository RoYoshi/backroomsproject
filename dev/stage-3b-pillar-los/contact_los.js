/* Stage 3B pillar LOS - before / after contact sheets from two look_los.js runs (development only; never served).
 *
 *   node dev/stage-3b-pillar-los/contact_los.js BEFORE_DIR AFTER_DIR OUT_DIR
 *
 * One sheet per set (orbit, strafe, close, diag): the parent's frames on top, the correction's below, each frame the
 * annotated crop (magenta: the darkness clip that frame; cyan dashes: the exact silhouette lines through the pillar's
 * extreme corners; the hidden wedge should start exactly on them). */
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const [B, A, OUT] = process.argv.slice(2).map(p => path.resolve(p)); fs.mkdirSync(OUT, { recursive: true });
const TW = 480, TH = 320, BAR = 44;
const label = (t, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BAR}"><rect width="${w}" height="${BAR}" fill="#111"/><text x="14" y="30" font-family="DejaVu Sans, sans-serif" font-size="22" fill="#fff">${t}</text></svg>`);
(async () => {
  for (const set of ['orbit', 'strafe', 'close', 'diag']) {
    const n = fs.readdirSync(B).filter(f => new RegExp(`^${set}_\\d+_a\\.png$`).test(f)).length; if (!n) continue;
    const cols = Math.min(4, n), rows = Math.ceil(n / cols), W = cols * TW, blockH = BAR + rows * TH, tiles = [];
    for (const [bi, [dir, name]] of [[B, 'BEFORE - parent d3ec226 (QA1)'], [A, 'AFTER - stage-3b-pillar-los']].entries()) {
      const y0 = bi * blockH; tiles.push({ input: label(name, W), left: 0, top: y0 });
      for (let k = 0; k < n; k++) tiles.push({ input: await sharp(path.join(dir, `${set}_${k}_a.png`)).resize(TW, TH).toBuffer(), left: (k % cols) * TW, top: y0 + BAR + Math.floor(k / cols) * TH });
    }
    const file = path.join(OUT, `contact_${set}.jpg`);
    await sharp({ create: { width: W, height: 2 * blockH, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 82 }).toFile(file);
    console.log(file);
  }
})().catch(e => { console.error(e); process.exit(1); });
