/* 2D Lighting & Shadows - how visible are the shadows? (development only; diagnostics, never a substitute for human QA)
 *
 *   node dev/shadows/visibility_metrics.js SHOTS_DIR [--out FILE.json] [--md FILE.md]
 *
 * Reads a shots.js output folder (<scene>-<tier>.png + shots.json). For every scene, each tier's capture is compared
 * pixel by pixel with the OFF capture of the same frozen instant (only the shadow quality differs between them):
 *   d = 1 - L_tier / L_off        relative darkening of a pixel (L = Rec. 709 luma, 0..255)
 * counted only over pixels the player can actually see something on (L_off >= LIT), since the darkness overlay keeps the
 * rest near black whatever is under it.  Reported per scene and tier:
 *   p90 / p99   the 90th / 99th percentile of d over lit pixels (how strong the visible shadows are)
 *   a10 / a25   the share of lit pixels darkened by at least 10 % / 25 % (how much of the lit picture carries a shadow)
 *   max         the strongest darkening of any lit pixel (guards against near-opaque black)
 *   brighter    the share of lit pixels made brighter by more than 2 % (must stay ~0: shadows only remove light)
 * and per scene the largest change of the darkness overlay's mean alpha from the OFF capture: the module never draws on
 * it (browser check B02), but the game can change it between captures (a hound makes nearby lamps fail); above 1/255
 * the scene is flagged as not comparable.
 * Also writes <scene>-<tier>-diff.png: the darkening of lit pixels as a heat image (black = none or unlit, white = 100 %),
 * unamplified. */
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), DIR = path.resolve(argv[0]), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const LIT = 18, OVL = 1;                                                 // overlay mean-alpha change (0..255) above which a scene's captures are not comparable
(async () => {
  const S = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8'));
  const scenes = [...new Set(S.shots.map(s => s.scene))], out = {};
  const raw = async f => { const { data, info } = await sharp(path.join(DIR, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
  for (const sc of scenes) {
    const shots = S.shots.filter(s => s.scene === sc), off = shots.find(s => s.tier === 'off'); if (!off) continue;
    const O = await raw(off.file), n = O.w * O.h, Lo = new Float32Array(n);
    for (let i = 0; i < n; i++) Lo[i] = .2126 * O.data[i * 3] + .7152 * O.data[i * 3 + 1] + .0722 * O.data[i * 3 + 2];
    out[sc] = { overlaySameAsOff: {}, overlayDelta: off.lightMean === undefined ? null : +Math.max(...shots.map(s => Math.abs((s.lightMean ?? off.lightMean) - off.lightMean))).toFixed(3) };
    for (const s of shots) {
      if (s.tier === 'off') continue;
      const T = await raw(s.file), d = [], heat = Buffer.alloc(n);
      let a10 = 0, a25 = 0, br = 0, lit = 0, mx = 0;
      for (let i = 0; i < n; i++) {
        const lo = Lo[i], lt = .2126 * T.data[i * 3] + .7152 * T.data[i * 3 + 1] + .0722 * T.data[i * 3 + 2];
        const v = lo >= LIT ? Math.max(0, 1 - lt / lo) : 0; heat[i] = Math.round(255 * Math.min(1, v));     // unlit pixels stay black: a 1-unit change there is noise
        if (lo < LIT) continue; lit++;
        const r = 1 - lt / lo; if (r < -.02) br++;
        const dv = Math.max(0, r); d.push(dv); if (dv >= .1) a10++; if (dv >= .25) a25++; if (dv > mx) mx = dv;
      }
      d.sort((a, b) => a - b); const q = p => d.length ? d[Math.min(d.length - 1, Math.floor(p * (d.length - 1)))] : 0;
      out[sc][s.tier] = { litPixels: lit, p90: +q(.9).toFixed(3), p99: +q(.99).toFixed(3), a10: +(a10 / Math.max(1, lit)).toFixed(4), a25: +(a25 / Math.max(1, lit)).toFixed(4), max: +mx.toFixed(3), brighter: +(br / Math.max(1, lit)).toFixed(4) };
      out[sc].overlaySameAsOff[s.tier] = s.lightHash === off.lightHash;
      await sharp(heat, { raw: { width: O.w, height: O.h, channels: 1 } }).png().toFile(path.join(DIR, `${sc}-${s.tier}-diff.png`));
    }
  }
  const tiers = ['low', 'medium', 'high'];
  const md = ['| scene | ' + tiers.map(t => `${t.toUpperCase()} p90 / p99 / a10 / a25 / max`).join(' | ') + ' | overlay Δ vs OFF |', '|---|---|---|---|---|'];
  for (const [sc, r] of Object.entries(out)) md.push(`| ${sc} | ` + tiers.map(t => r[t] ? `${r[t].p90} / ${r[t].p99} / ${(100 * r[t].a10).toFixed(1)} % / ${(100 * r[t].a25).toFixed(1)} % / ${r[t].max}` : '—').join(' | ') + ` | ${r.overlayDelta === null ? 'n/a' : r.overlayDelta > OVL ? `**${r.overlayDelta}: the game's own darkness changed between captures, comparison not valid**` : r.overlayDelta} |`);
  if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify({ lit: LIT, scenes: out }, null, 1) + '\n');
  if (opt('md')) fs.writeFileSync(opt('md'), md.join('\n') + '\n');
  console.log(md.join('\n'));
})();
