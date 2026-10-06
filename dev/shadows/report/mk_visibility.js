/* Visibility evidence: before / after comparison images and a measured table (SH5: SH4 -> SH5; SH7: SH6 -> SH7).
 *
 *   node dev/shadows/report/mk_visibility.js BEFORE_DIR AFTER_DIR OUT_DIR [BEFORE_LABEL AFTER_LABEL] [--gain G]
 *
 * Labels default to SH4 / SH5 (the file names keep them in lower case).  --gain G also writes <scene>-bright.jpg: the
 * before / OFF / after full frames multiplied by G (software rendering is very dark: brightened ONLY so a reader can see
 * the shapes; the measurements always use the unbrightened captures).
 *
 * BEFORE_DIR / AFTER_DIR are shots.js folders (same scenes, same staging, same frozen instants) already measured by
 * visibility_metrics.js (metrics.json).  Writes into OUT_DIR, for every scene:
 *   <scene>-sh4-off-sh5.jpg   full frames: SH4 at MEDIUM | OFF (v23.3.6 look) | SH5 at MEDIUM
 *   <scene>-sh5-tiers.jpg     the centre of the frame after the correction: OFF | LOW | MEDIUM | HIGH
 *   <scene>-diff.jpg          what MEDIUM takes away from the OFF picture (lit pixels, unamplified): SH4 | SH5
 * plus visibility.md (the table) and the two metrics.json / shots.json files. */
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const args = process.argv.slice(2), gi = args.indexOf('--gain'), GAIN = gi >= 0 ? +args.splice(gi, 2)[1] : 0;
/* --zoom "scene:left,top,width,height;..." : also <scene>-zoom.jpg, that region (full-frame pixels) of before MEDIUM / OFF /
 * after MEDIUM, enlarged, brightened by --gain when given */
const zi = args.indexOf('--zoom'), ZOOM = Object.fromEntries((zi >= 0 ? args.splice(zi, 2)[1] : '').split(';').filter(Boolean).map(z => { const [n, r] = z.split(':'); const [left, top, width, height] = r.split(',').map(Number); return [n, { left, top, width, height }]; }));
const [B, A, O] = args.slice(0, 3).map(p => path.resolve(p)), LB = args[3] || 'SH4', LA = args[4] || 'SH5', lb = LB.toLowerCase(), la = LA.toLowerCase();
fs.mkdirSync(O, { recursive: true });
const MB = JSON.parse(fs.readFileSync(path.join(B, 'metrics.json'), 'utf8')).scenes, MA = JSON.parse(fs.readFileSync(path.join(A, 'metrics.json'), 'utf8')).scenes;
const strip = async (files, out, { crop = null, w = 520, gap = 8, label = [] } = {}) => {
  const bufs = await Promise.all(files.map(f => { let s = sharp(f); if (crop) s = s.extract(crop); return s.resize(w).toBuffer(); }));
  const h = (await sharp(bufs[0]).metadata()).height;
  const svg = (t) => Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="#000" fill-opacity=".55"/><text x="8" y="16" font-family="monospace" font-size="13" fill="#fff">${t}</text></svg>`);
  const comp = []; bufs.forEach((b, i) => { comp.push({ input: b, left: i * (w + gap), top: 0 }); if (label[i]) comp.push({ input: svg(label[i]), left: i * (w + gap), top: 0 }); });
  await sharp({ create: { width: w * files.length + gap * (files.length - 1), height: h, channels: 3, background: '#ffffff' } }).composite(comp).jpeg({ quality: 82 }).toFile(out);
};
(async () => {
  for (const sc of Object.keys(MA)) {
    if (!MB[sc]) continue;
    await strip([path.join(B, `${sc}-medium.png`), path.join(A, `${sc}-off.png`), path.join(A, `${sc}-medium.png`)], path.join(O, `${sc}-${lb}-off-${la}.jpg`), { label: [`${LB} MEDIUM`, 'OFF', `${LA} MEDIUM`] });
    await strip(['off', 'low', 'medium', 'high'].map(t => path.join(A, `${sc}-${t}.png`)), path.join(O, `${sc}-${la}-tiers.jpg`), { crop: { left: 320, top: 120, width: 640, height: 480 }, w: 400, label: ['OFF', 'LOW', 'MEDIUM', 'HIGH'] });
    await strip([path.join(B, `${sc}-medium-diff.png`), path.join(A, `${sc}-medium-diff.png`)], path.join(O, `${sc}-diff.jpg`), { label: [`${LB} MEDIUM takes away`, `${LA} MEDIUM takes away`] });
    if (ZOOM[sc]) {
      const tmp = []; for (const [d, t] of [[B, 'medium'], [A, 'off'], [A, 'medium']]) { const f = path.join(O, `.tmp-z${tmp.length}.png`); let im = sharp(path.join(d, `${sc}-${t}.png`)).extract(ZOOM[sc]); if (GAIN > 0) im = im.linear(GAIN, 0); await im.toFile(f); tmp.push(f); }
      await strip(tmp, path.join(O, `${sc}-zoom.jpg`), { w: Math.min(520, ZOOM[sc].width * 2), label: [`${LB} MEDIUM`, 'OFF', `${LA} MEDIUM`].map(x => GAIN > 0 ? `${x} ×${GAIN}` : x) }); for (const f of tmp) fs.unlinkSync(f);
    }
    if (GAIN > 0) {                                                         // brightened copies, for the eye only
      const tmp = []; for (const [d, t] of [[B, 'medium'], [A, 'off'], [A, 'medium']]) { const f = path.join(O, `.tmp-${tmp.length}.png`); await sharp(path.join(d, `${sc}-${t}.png`)).linear(GAIN, 0).toFile(f); tmp.push(f); }
      await strip(tmp, path.join(O, `${sc}-bright.jpg`), { label: [`${LB} MEDIUM ×${GAIN}`, `OFF ×${GAIN}`, `${LA} MEDIUM ×${GAIN}`] }); for (const f of tmp) fs.unlinkSync(f);
      const tt = []; for (const t of ['off', 'low', 'medium', 'high']) { const f = path.join(O, `.tmp-t${t}.png`); await sharp(path.join(A, `${sc}-${t}.png`)).linear(GAIN, 0).toFile(f); tt.push(f); }
      await strip(tt, path.join(O, `${sc}-${la}-tiers-bright.jpg`), { crop: { left: 320, top: 120, width: 640, height: 480 }, w: 400, label: ['OFF', 'LOW', 'MEDIUM', 'HIGH'].map(x => `${x} ×${GAIN}`) }); for (const f of tt) fs.unlinkSync(f);
    }
  }
  const f = r => r ? `${r.p90.toFixed(2)} / ${r.p99.toFixed(2)} / ${(100 * r.a10).toFixed(1)} % / ${(100 * r.a25).toFixed(1)} %` : '—';
  const md = [`| scene | ${LB} MEDIUM | ${LA} LOW | **${LA} MEDIUM** | ${LA} HIGH | ${LA} strongest pixel (MEDIUM) | darkness overlay across tiers (Δ mean alpha) |`, '|---|---|---|---|---|---|---|'];
  for (const sc of Object.keys(MA)) md.push(`| ${sc} | ${f(MB[sc] && MB[sc].medium)} | ${f(MA[sc].low)} | **${f(MA[sc].medium)}** | ${f(MA[sc].high)} | ${MA[sc].medium ? MA[sc].medium.max.toFixed(2) : '—'} | ${MA[sc].overlayDelta === 0 && (!MB[sc] || MB[sc].overlayDelta === 0) ? 'unchanged' : 'changed (' + MA[sc].overlayDelta + ')'} |`);
  fs.writeFileSync(path.join(O, 'visibility.md'), md.join('\n') + '\n');
  for (const [d, n] of [[B, lb], [A, la]]) for (const k of ['metrics.json', 'shots.json', 'metrics.md']) if (fs.existsSync(path.join(d, k))) {
    let t = fs.readFileSync(path.join(d, k), 'utf8'); t = t.split(path.resolve(__dirname, '..', '..', '..')).join('<worktree>').split(path.dirname(path.dirname(d))).join('<scratch>');
    fs.writeFileSync(path.join(O, `${n}-${k}`), t);
  }
  console.log(md.join('\n'));
})();
