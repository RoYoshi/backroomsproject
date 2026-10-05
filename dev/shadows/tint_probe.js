/* 2D Lighting & Shadows - how much of a carried-light shadow reaches the screen (development only; never served).
 *
 *   node dev/shadows/tint_probe.js GAME [--quality medium] [--out FILE.json]
 *
 * The darkness overlay (#light, drawLight in the bundle) cuts each light out of the dark and then paints a carried light's
 * own colour tint over its beam (source-over).  The shadow module draws under all of that, on the floor, so in a beam it
 * can only darken the floor's share of the final pixel.  This probe measures that share in the real client: the reception
 * counter in your flashlight (the bench's `props` scene), the frame frozen; it shows only the carried-light prop-shadow
 * layer and measures the screen at five points behind the counter, along the beam:
 *   - with the layer hidden, then at layer alpha 1 / .5 / .25 (screen darkening is linear in what is drawn);
 *   - the same with the overlay canvas hidden (what the module draws, as drawn).
 * Their ratio is the share of a carried-light shadow that survives the overlay's tint.  Observation only: it changes
 * layer visibility in the test page, never a rule of the game. */
'use strict';
const { spawn, execSync } = require('child_process'); const http = require('http'); const path = require('path'); const fs = require('fs');
const H = require('./harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const PORT = 9481, GAME = path.resolve(argv[0]), Q = opt('quality') || 'medium';
const PTS = [[1754, 3312], [1749, 3282], [1743, 3242], [1737, 3203], [1731, 3163]];   // world points behind counter L1, along your beam
function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { quality: Q, points: PTS, runs: {} };
  try {
    const J = await H.join(browser, PORT, 'tint' + Date.now() % 1e5, 'QA', {}), P = J.P;
    await H.stage(P); await H.setLights(P, 'off'); await H.place(P, 1776, 3460, -Math.PI / 2 - 0.15);
    await P.evaluate(q => { document.querySelectorAll('header,.location,.coordinates,#hud').forEach(e => e.style.visibility = 'hidden'); __shadows.setQuality(q); }, Q);
    await sleep(1500); await frames(P, 30); await P.evaluate(() => __clock.freeze()); await frames(P, 20);
    const scr = await P.evaluate(pts => { const w = __api.floor().parent; return pts.map(([x, y]) => [Math.round(x * w.scale.x + w.position.x), Math.round(y * w.scale.y + w.position.y)]); }, PTS);
    const shoot = async () => { await frames(P, 6); await sleep(150); const { data, info } = await sharp(await P.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      return scr.map(([x, y]) => { let s = 0, n = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const k = ((y + j) * info.width + (x + i)) * 3; s += .2126 * data[k] + .7152 * data[k + 1] + .0722 * data[k + 2]; n++; } return +(s / n).toFixed(1); }); };
    const only = (show, alpha) => P.evaluate(([show, alpha]) => { const root = __api.floor().parent.children.find(c => c.label === 'shadows-2d'), cast = root.children.find(c => c.label === 'shadows-cast'), dyn = cast.children.find(c => c.label === 'shadows-cast-props');
      for (const c of root.children) c.visible = show && c === cast; for (const c of cast.children) c.visible = c === dyn; dyn.alpha = alpha; }, [show, alpha]);
    const d = (v, b) => v.map((x, i) => +(1 - x / b[i]).toFixed(3));
    for (const ov of [true, false]) {
      await P.evaluate(v => { document.getElementById('light').style.visibility = v ? 'visible' : 'hidden'; }, ov);
      await only(false, 1); const base = await shoot(), r = { base };
      for (const a of [1, .5, .25]) { await only(true, a); r['alpha' + a] = d(await shoot(), base); }
      R.runs[ov ? 'withOverlay' : 'overlayHidden'] = r;
    }
    R.survives = R.runs.withOverlay.alpha1.map((v, i) => +(v / Math.max(1e-6, R.runs.overlayHidden.alpha1[i])).toFixed(3));
    R.version = await P.evaluate(() => __shadows.version);
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 500); }
  await browser.close(); srv.kill('SIGTERM');
  console.log(JSON.stringify(R, null, 1)); if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(R, null, 1) + '\n');
  process.exit(R.error ? 1 : 0);
})();
