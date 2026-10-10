/* ADAPTED COPY of dev/stage-3c/perf_c3.js for Stage 3C QA2 - written by dev/stage-3c-qa2/perf_ab_qa2.js; do not edit by hand.
 *   - helpers from ui_lib_gate.js: a QA2 page is measured once its boot is over and its ready gate passed (one key press)
 */
/* Stage 3C - UI performance for one build (development only; never served).  perf_ab_c3.js runs it for the Stage 3B parent
 * and for Stage 3C in turn and compares.
 *
 *   node dev/stage-3c/perf_c3.js --game DIR [--port 9631] [--secs 4] [--out FILE.json] [--mobile]
 *
 * States (desktop 1920 x 1080, or 390 x 844 touch at DPR 2 with --mobile): the main menu idle; Settings open over the menu
 * (Stage 3C: the Settings sheet; parent: the SETTINGS dropdown); Customize open over the menu; Level 0 with every menu closed,
 * lit (YELLOW HALL, flashlight) standing and walking, and dark (the BLACKOUT ZONE, flashlight). Monsters removed and frozen.
 * Per state: the page's frame interval (rAF: mean, p95), the time per frame the DevTools sampling profiler (100 us) finds in the
 * UI scripts (ui.js, hud.js, inventory.js) and in the whole page's JavaScript, and the draw calls per second made into the
 * Customize preview canvas (a second renderer: it should draw only while Customize is open).
 * NOTE: software rendering (SwiftShader, 2 CPUs): far slower than any GPU; only the two builds against each other mean anything,
 * on the same states, interleaved. */
'use strict';
const fs = require('fs'), path = require('path');
const U = require('./ui_lib_gate.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..', '..')), PORT = +(opt('port') || 9631), SECS = +(opt('secs') || 4), OUT = opt('out'), MOBILE = argv.includes('--mobile');
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + .5))]; };
/* count draw calls per canvas: the preview is the canvas inside #avatarPreview */
const DRAWS = () => { window.__pv = 0; for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { if (!C) continue; for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const f = C.prototype[m]; if (!f) continue;
  C.prototype[m] = function () { try { const c = this.canvas; if (c && c.parentElement && c.parentElement.id === 'avatarPreview') window.__pv++; } catch (e) { } return f.apply(this, arguments); }; } } };
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  const R = { game: GAME, mobile: MOBILE, secs: SECS, rows: [] };
  try {
    const s = await U.page(b, PORT, Object.assign({ init: DRAWS }, MOBILE ? { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2 } : {})); const P = s.P;
    const is3 = await P.evaluate(() => !!(window.__ui && window.__ui.version)); R.build = is3 ? 'stage-3c' : 'parent';
    const cdp = await P.context().newCDPSession(P); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
    const measure = async (state, walk) => {
      await sleep(600);
      await P.evaluate(() => { window.__pv = 0; window.__pf = []; let last = performance.now(); const f = () => { if (!window.__pf) return; const t = performance.now(); window.__pf.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await cdp.send('Profiler.start'); if (walk) await P.keyboard.down('KeyD'); const t0 = Date.now(); await sleep(SECS * 1000); if (walk) await P.keyboard.up('KeyD');
      const { profile } = await cdp.send('Profiler.stop'); const el = (Date.now() - t0) / 1000;
      const r = await P.evaluate(() => { const d = window.__pf; window.__pf = null; return { dt: d.slice(1), pv: window.__pv }; });
      const byId = new Map(profile.nodes.map(n => [n.id, n])); let ui = 0, js = 0; const dts = profile.timeDeltas;
      for (let i = 0; i < profile.samples.length; i++) { const nd = byId.get(profile.samples[i]), f = nd.callFrame, dt = (dts[i + 1] || 0) / 1000;
        if (/\/(assets\/ui|hud|inventory)\.js/.test(f.url)) ui += dt; if (f.url) js += dt; }
      const fr = Math.max(1, r.dt.length);
      const row = { state, frames: r.dt.length, pageMs: { mean: +(r.dt.reduce((a, c) => a + c, 0) / fr).toFixed(1), p95: +pct(r.dt, .95).toFixed(1) }, uiJsMsPerFrame: +(ui / fr).toFixed(3), jsMsPerFrame: +(js / fr).toFixed(2), previewDrawsPerSec: +(r.pv / el).toFixed(1) };
      R.rows.push(row); console.log(JSON.stringify(row));
    };
    await sleep(2500);
    await measure('menu idle');
    if (is3) await P.evaluate(() => __ui.go('settings', 'hud')); else await P.evaluate(() => document.getElementById('settingsBtn').click());
    await measure('settings open (over the menu)');
    if (is3) await P.evaluate(() => __ui.go('home')); else await P.evaluate(() => document.getElementById('settingsBtn').click());
    await sleep(500);
    if (is3) await P.evaluate(() => __ui.go('customize', 'wanderer')); else await P.evaluate(() => document.getElementById('customize').click());
    await measure('customize open (over the menu)');
    if (is3) await P.evaluate(() => __ui.go('home')); else await P.evaluate(() => document.getElementById('doneAppearance').click());
    await sleep(500);
    await U.start(P, 'Perf'); await U.admin(P); await H.stage(P);
    await H.place(P, 1200, 3408, -0.4, { light: true, kind: 'flashlight' }); await P.evaluate(() => window.__clock && __clock.thaw()); await sleep(2500);
    await measure('Level 0 lit, standing (menus closed)');
    await measure('Level 0 lit, walking (menus closed)', true);
    await H.setLights(P, 'on'); await H.place(P, 1296, 5136, Math.PI, { light: true, kind: 'flashlight' }); await P.evaluate(() => window.__clock && __clock.thaw()); await sleep(2500);
    await measure('Level 0 dark, flashlight (menus closed)');
    await H.setLights(P, 'off');
    R.errors = s.errs;
  } catch (e) { R.error = String(e && e.stack || e); console.log(e); }
  finally { await U.close(b, srv); }
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
})();
