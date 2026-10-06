/* BR-RoLE BR3 - leak / cache-growth sanity (development only; never served).
 *
 *   node dev/br-role/soak_br.js --game PATH [--cycles 6] [--out FILE.json]
 *
 * One page at MEDIUM walks (teleports) a loop of eight lamp regions across the whole map, flashlight on, again and again,
 * with a quality switch every other cycle.  After each cycle (forced garbage collection through the DevTools protocol):
 * the JS heap, how many canvases BR-RoLE's page has ever created, the lamp-field cache (size vs its cap, evictions), the
 * pooled canvases' sizes, BR-RoLE errors.  Healthy: the cache stays at or under its cap, the heap and the live canvas
 * memory level off instead of growing cycle after cycle. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), CYCLES = +(opt('cycles') || 6), PORT = +(opt('port') || 9489), OUT = opt('out') || '/tmp/br-soak.json';
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
/* counts every canvas the page creates, and the pixels of those still sized (an evicted lamp field is set to 0 x 0) */
const COUNT = `(() => { const mk = Document.prototype.createElement; window.__cv = []; Document.prototype.createElement = function (t, ...a) { const e = mk.call(this, t, ...a); if (String(t).toLowerCase() === 'canvas') window.__cv.push(new WeakRef(e)); return e; }; })();`;
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: [...H.ARGS, '--js-flags=--expose-gc'] }), R = { cycles: [] };
  try {
    const J = await H.join(browser, PORT, 'brsoak' + Date.now() % 1e5, 'SK', { init: COUNT }), P = J.P, cdp = await P.context().newCDPSession(P);
    await H.stage(P); await H.setLights(P, 'off'); await P.evaluate(() => __brRole.setQuality('medium'));
    const spots = [[1130, 3420], [3400, 1250], [7860, 1120], [6100, 3300], [5000, 5500], [1300, 5100], [3500, 5300], [7900, 5450]];
    for (let c = 0; c < CYCLES; c++) {
      if (c % 2 === 1) await P.evaluate(q => __brRole.setQuality(q), ['high', 'low', 'medium'][Math.floor(c / 2) % 3]);
      for (const [x, y] of spots) { await H.place(P, x, y, (x + y) % 6, { light: true }); await sleep(700); await frames(P, 4); }
      await cdp.send('HeapProfiler.collectGarbage'); await sleep(300);
      const m = await P.evaluate(() => { const s = __brRole.stats(), live = (window.__cv || []).map(w => w.deref()).filter(Boolean);
        return { quality: s.quality, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), canvasesCreated: (window.__cv || []).length, canvasesAlive: live.length,
          sizedCanvasMPx: +(live.reduce((a, e) => a + e.width * e.height, 0) / 1e6).toFixed(2), lampCache: s.lamps.cached, lampCacheCap: s.lamps.cacheCap, evictions: s.lamps.evictions, builds: s.lamps.builds, errors: s.errors, disabled: s.disabled, frames: s.frames }; });
      m.cycle = c; R.cycles.push(m); console.log(JSON.stringify(m));
    }
    R.pageErrors = J.errs;
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 600); console.log('ERROR', R.error); }
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); await browser.close(); srv.kill();
})();
