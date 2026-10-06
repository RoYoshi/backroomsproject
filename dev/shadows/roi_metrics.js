/* 2D Lighting & Shadows - shadow darkening inside a region of a capture (development only; diagnostics, not human QA).
 *
 *   node dev/shadows/roi_metrics.js --out FILE.json  LABEL=DIR:SCENE:TIER:x,y,w,h[:minLuma] ...
 *
 * For each item: the capture <DIR>/<SCENE>-<TIER>.png is compared pixel by pixel with <DIR>/<SCENE>-off.png (the same
 * frozen instant with shadows OFF) inside the rectangle x,y,w,h (capture pixels), over the pixels that are lit at OFF
 * (Rec. 709 luma >= minLuma, default 18, as visibility_metrics.js).  d = 1 - L_tier / L_off, the relative darkening the
 * module adds there.  Reports the mean, p90, p99, the share of lit pixels darkened >= 10 % / 25 %, and how many lit pixels
 * the region has.  SH7 uses it on the human-QA regions: the lamp's edge inside your beam (QA01), the corridor-corner
 * wedges (QA02), the area behind the counter (two wanderers' beams). */
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), oi = argv.indexOf('--out'), OUT = oi >= 0 ? argv.splice(oi, 2)[1] : null;
const luma = (d, i) => .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
(async () => {
  const res = [];
  for (const item of argv) {
    const [label, rest] = item.split('='), [dir, scene, tier, rect, minL] = rest.split(':'), [x, y, w, h] = rect.split(',').map(Number), LIT = +(minL || 18);
    const load = async t => { const { data, info } = await sharp(path.join(dir, `${scene}-${t}.png`)).extract({ left: x, top: y, width: w, height: h }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, ch: info.channels }; };
    const A = await load('off'), B = await load(tier), ds = [];
    for (let i = 0; i < w * h; i++) { const lo = luma(A.data, i * A.ch); if (lo < LIT) continue; ds.push(Math.max(-1, 1 - luma(B.data, i * B.ch) / lo)); }
    ds.sort((a, b) => a - b); const q = f => ds.length ? ds[Math.min(ds.length - 1, Math.floor(f * ds.length))] : 0;
    const r = { label, scene, tier, rect: [x, y, w, h], minLuma: LIT, litPixels: ds.length, mean: +(ds.reduce((s, v) => s + v, 0) / Math.max(1, ds.length)).toFixed(4), p90: +q(.9).toFixed(4), p99: +q(.99).toFixed(4),
      a10: +(ds.filter(v => v >= .1).length / Math.max(1, ds.length)).toFixed(4), a25: +(ds.filter(v => v >= .25).length / Math.max(1, ds.length)).toFixed(4) };
    res.push(r); console.log(JSON.stringify(r));
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
})();
