/* 2D Lighting & Shadows - 2D-canvas calls per canvas and per method in the real client (development only).
 *
 *   node dev/shadows/canvas_calls_probe.js GAME
 *
 * Mobile-like viewport (390x844, DPR 3, touch), PILLAR HALL, flashlight on: counts every 2D-canvas drawing call over 10
 * frames by canvas id (or size) and method - for the parent once, for the candidate at OFF / LOW / MEDIUM / HIGH.  The
 * shadow module draws nothing on a 2D canvas (it only builds its light textures once, at first use), so every row must
 * match the parent's.  SH3 used it to explain a scene-state difference in the bench (evidence/sh3/SH3_PERF.md). */
'use strict';
const { spawn, execSync } = require('child_process'); const http = require('http'); const H = require('./harness_lib.js'); const { sleep } = H;
const PORT = 9468, GAME = process.argv[2];
function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }
const COUNT = `(() => { const T = window.__c2d = { on: false, by: {} }; const P = CanvasRenderingContext2D.prototype;
  for (const m of ['fill', 'stroke', 'fillRect', 'clearRect', 'strokeRect', 'clip', 'drawImage', 'putImageData', 'fillText']) { const f = P[m]; P[m] = function () { if (T.on) { const k = m + ':' + (this.canvas && (this.canvas.id || this.canvas.width + 'x' + this.canvas.height)); T.by[k] = (T.by[k] || 0) + 1; } return f.apply(this, arguments); }; } })();`;
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS });
  const J = await H.join(browser, PORT, 'c2d' + Date.now() % 1e5, 'C', { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, init: COUNT }), P = J.P;
  await H.stage(P); await H.setLights(P, 'off'); await H.place(P, 7860, 1150, 0.65);
  for (const q of (GAME.includes('parent') ? ['-'] : ['off', 'low', 'medium', 'high'])) {
    await P.evaluate(q => window.__shadows && __shadows.setQuality(q), q); await sleep(3000);
    await P.evaluate(() => { __c2d.by = {}; __c2d.on = true; }); await H.frames(P, 10); await P.evaluate(() => { __c2d.on = false; });
    const by = await P.evaluate(() => __c2d.by); console.log(GAME.includes('parent') ? 'PARENT' : 'CANDIDATE ' + q, JSON.stringify(Object.entries(by).sort()));
  }
  console.log('lamps in overlay view:', await P.evaluate(() => { const A = __api, w = A.floor().parent; return [w.scale.x, w.position.x, w.position.y, innerWidth, innerHeight]; }));
  await browser.close(); srv.kill('SIGTERM');
})();
