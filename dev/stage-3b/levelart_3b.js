/* Stage 3B-F3 - before / after evidence for resting the legacy level art under the full-map remaster (development only).
 *
 *   node dev/stage-3b/levelart_3b.js --game PATH --out DIR
 *
 * At each pose: the frame as played (BR-RoLE's light overlay on) and the bare WebGL scene, with the legacy level art drawn
 * under the remaster (QA2 / 3B-F2 behaviour) and resting (3B-F3); pixel differences, and the difference images. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), OUT = path.resolve(opt('out') || '/tmp/levelart3b'), PORT = +(opt('port') || 9494);
const POSES = [['yellow-spawn', 1130, 3420, 2.6, false], ['blackout-table', 1300, 5330, -Math.PI / 2, true], ['red-rooms', 5700, 5470, 0.3, false],
  ['long-pits', 6240, 1200, 0.1, false], ['arch-arches', 7650, 3500, 0, false], ['corridor-west', 1104, 2200, Math.PI / 2, false], ['pillar-hall', 8352, 1632, -0.6, false]];
const HIDE = '#light,.grain,#dread,#mp,header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag';
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
fs.mkdirSync(OUT, { recursive: true });
const raw = async b => { const { data, info } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const diff = (a, b) => { let n = 0, max = 0; const img = Buffer.alloc(a.w * a.h * 3); for (let i = 0; i < a.w * a.h; i++) { let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.data[i * 3 + c] - b.data[i * 3 + c])); if (m > 2) n++; if (m > max) max = m; img[i * 3] = img[i * 3 + 1] = img[i * 3 + 2] = Math.min(255, m * 8); } return { n, frac: n / (a.w * a.h), max, img }; };
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), rows = [];
  try {
    const J = await H.join(browser, PORT, 'la3b' + Date.now() % 1e5, 'QA', { query: '&dev3b=1' }), P = J.P;
    await H.until(() => P.evaluate(() => window.__l0v && __l0v.ready()), 30000); await H.stage(P); await H.setLights(P, 'off');
    const shot = async () => { await frames(P, 6); await sleep(150); const g = await P.screenshot(); await P.evaluate(s => document.querySelectorAll(s).forEach(e => e.style.visibility = 'hidden'), HIDE); await frames(P, 3); const r = await P.screenshot(); await P.evaluate(s => document.querySelectorAll(s).forEach(e => e.style.visibility = ''), HIDE); return { g, r }; };
    for (const [name, x, y, a, light] of POSES) {
      await P.evaluate(() => __clock.thaw()); await H.place(P, x, y, a, { light }); await sleep(1200); await frames(P, 8); await P.evaluate(() => __clock.freeze(true)); await frames(P, 6);
      await P.evaluate(() => __l0v.dev.keepLevelArt(true)); const before = await shot(), stB = await P.evaluate(() => __l0v.stats().levelArtResting);
      await P.evaluate(() => __l0v.dev.keepLevelArt(false)); const after = await shot(), stA = await P.evaluate(() => __l0v.stats().levelArtResting);
      const dg = diff(await raw(before.g), await raw(after.g)), dr = diff(await raw(before.r), await raw(after.r));
      fs.writeFileSync(path.join(OUT, `${name}-kept.png`), before.r); fs.writeFileSync(path.join(OUT, `${name}-resting.png`), after.r);
      await sharp(dr.img, { raw: { width: (await raw(before.r)).w, height: (await raw(before.r)).h, channels: 3 } }).png().toFile(path.join(OUT, `${name}-rawdiff.png`));
      const row = { pose: name, restingBefore: stB, restingAfter: stA, asPlayed: { differing: dg.n, frac: +(dg.frac * 100).toFixed(3), max: dg.max }, bareScene: { differing: dr.n, frac: +(dr.frac * 100).toFixed(3), max: dr.max } };
      rows.push(row); console.log(JSON.stringify(row)); await P.evaluate(() => __clock.freeze(false));
    }
    fs.writeFileSync(path.join(OUT, 'levelart.json'), JSON.stringify({ rows, errors: J.errs }, null, 1));
  } catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 600)); }
  await browser.close(); srv.kill();
})();
