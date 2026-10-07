/* Stage 3B-L (BR-RoLE 1.1) - one lamp's light as a map (development only; never served).
 *
 *   node dev/stage-3b-l/fieldmap_3bl.js [--game PATH] [--port 9481] [--quality medium] --lamps 4,12 [--out DIR] [--gamma 0.5]
 *
 * For each lamp: its cached light alone (core + far field + bounce light, P0 scale), and the same with the bounce light
 * off, drawn over the level's walls (grey) and pillars, in world space around the lamp (1 px = 4 world px):
 *   <i>_light.png   the lamp's light (brightness = light ^ gamma, so faint light shows)
 *   <i>_bounce.png  the bounce light alone (light minus the same lamp without bounce), x 8
 * Evidence for the closed-wall / corner / pillar scenes: the light of ONE lamp, nothing else adding to it. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9481), Q = opt('quality') || 'medium', OUT = path.resolve(opt('out') || '/tmp/fieldmap3bl'), GAMMA = +(opt('gamma') || .5);
const LAMPS = (opt('lamps') || '4').split(',').map(Number), S = 4, HALF = 680;
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), out = [];
  try {
    const J = await H.join(browser, PORT, 'fmap' + Date.now() % 1e5, 'FMAP', { viewport: { width: 1280, height: 720 }, query: '&lighting=' + Q }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    const read = async i => P.evaluate(([i, HALF, S]) => { const L = __api.lamps[i], pts = []; for (let y = -HALF; y < HALF; y += S) for (let x = -HALF; x < HALF; x += S) pts.push([L.x + x + S / 2, L.y + y + S / 2]);
      const v = __brRole.dev.cache(i, pts), A = __api, geo = pts.map(([x, y]) => A.Hc(Math.floor(x / 96), Math.floor(y / 96)) ? 2 : (A.sl(x, y, 1) ? 0 : 1));
      return { L: [L.x, L.y], light: v.map(c => c.core + (c.far || 0)), geo }; }, [i, HALF, S]);
    const ready = i => P.evaluate(i => { const c = __brRole.dev.cacheInfo(i); return !!(c && c.far); }, i);
    for (const i of LAMPS) {
      const L = await P.evaluate(i => [__api.lamps[i].x, __api.lamps[i].y], i);
      await H.place(P, L[0], L[1] + 60, 0, { light: false });
      await P.evaluate(() => __brRole.dev.spill(true)); for (let k = 0; k < 150 && !(await ready(i)); k++) await frames(P, 3);
      const on = await read(i);
      await P.evaluate(() => __brRole.dev.spill(false)); for (let k = 0; k < 150 && !(await ready(i)); k++) await frames(P, 3);
      const off = await read(i); await P.evaluate(() => __brRole.dev.spill(true));
      const W = 2 * HALF / S, img = Buffer.alloc(W * W * 3), bimg = Buffer.alloc(W * W * 3); let bmax = 0, bsum = 0;
      for (let n = 0; n < W * W; n++) {
        const l = on.light[n], b = Math.max(0, l - off.light[n]), g = on.geo[n]; bmax = Math.max(bmax, b); bsum += b;
        const v = Math.round(255 * Math.pow(Math.min(1, l / .9), GAMMA)), w = Math.round(Math.min(255, b * 255 * 8));
        if (g === 2) { img[n * 3] = img[n * 3 + 1] = img[n * 3 + 2] = 70; bimg[n * 3] = bimg[n * 3 + 1] = bimg[n * 3 + 2] = 70; }
        else if (g === 1) { img[n * 3] = 40; img[n * 3 + 1] = 40; img[n * 3 + 2] = 90; bimg[n * 3] = 40; bimg[n * 3 + 1] = 40; bimg[n * 3 + 2] = 90; }   // a pillar / blocker (not walkable, not a wall cell)
        else { img[n * 3] = v; img[n * 3 + 1] = Math.round(v * .93); img[n * 3 + 2] = Math.round(v * .6); bimg[n * 3] = w; bimg[n * 3 + 1] = Math.round(w * .9); bimg[n * 3 + 2] = Math.round(w * .5); }
      }
      await sharp(img, { raw: { width: W, height: W, channels: 3 } }).png().toFile(path.join(OUT, `${i}_light.png`));
      await sharp(bimg, { raw: { width: W, height: W, channels: 3 } }).png().toFile(path.join(OUT, `${i}_bounce.png`));
      out.push({ i, at: on.L, bounceMax: +(bmax * 255).toFixed(2), bounceShare: +(bsum / on.light.reduce((s, x) => s + x, 0)).toFixed(4) });
      console.log(`lamp ${i} at ${on.L}: bounce max ${(bmax * 255).toFixed(2)}/255 (P0 scale), bounce share of its light ${(100 * bsum / on.light.reduce((s, x) => s + x, 0)).toFixed(1)} %`);
    }
  } finally { await browser.close(); srv.kill(); }
  fs.writeFileSync(path.join(OUT, 'fieldmap.json'), JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
