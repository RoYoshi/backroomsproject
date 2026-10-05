/* 2D Lighting & Shadows - CPU profile of the shadow module in the real client (development only).
 *
 *   node dev/shadows/profile_probe.js GAME [tier=low] [cpuThrottle=4] [dpr=3]
 *
 * Joins a staged room on a 390x844 touch viewport (the bench's mobile-like profile), stands in the YELLOW HALL spawn
 * room with the flashlight on, sets the shadow quality, slows the main thread through CDP, records a 20 s sampling CPU
 * profile and prints the module's own per-frame time plus the self time per function (all, then shadows-2d.js only).
 * SH3 used it to find a forced synchronous layout (innerWidth read inside the frame) - see evidence/sh3/SH3_PERF.md. */
'use strict';
const { spawn, execSync } = require('child_process'); const http = require('http'); const H = require('./harness_lib.js'); const { sleep } = H;
const PORT = 9467, GAME = process.argv[2], TIER = process.argv[3] || 'low', THR = +(process.argv[4] || 4), DPR = +(process.argv[5] || 3);
function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS });
  const J = await H.join(browser, PORT, 'warm' + Date.now() % 1e5, 'W', { viewport: { width: 390, height: 844 }, dpr: DPR, mobile: true }), P = J.P;
  await H.stage(P); await H.setLights(P, 'off'); await H.place(P, 1060, 3300, -0.25);
  const cdp = await J.ctx.newCDPSession(P); if (THR > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THR });
  await P.evaluate(t => __shadows.setQuality(t), TIER); await sleep(3000);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  await P.evaluate(() => __shadows.resetStats()); await sleep(20000);
  const { profile } = await cdp.send('Profiler.stop'); const s = await P.evaluate(() => __shadows.stats());
  console.log(`frames ${s.buildMs.n} mean ${s.buildMs.mean} p95 ${s.buildMs.p95} max ${s.buildMs.max}`);
  const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(); const dt = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame, key = (f.functionName || '(anon)') + ' ' + (f.url.split('/').pop() || f.url) + ':' + f.lineNumber; self.set(key, (self.get(key) || 0) + (dt[i] || 0)); total += dt[i] || 0; });
  const rows = [...self].sort((a, b) => b[1] - a[1]); console.log('total ms', (total / 1000).toFixed(0));
  for (const [k, v] of rows.slice(0, 25)) console.log((v / 1000).toFixed(1).padStart(8), k);
  console.log('--- shadows-2d.js only'); for (const [k, v] of rows.filter(r => r[0].includes('shadows-2d')).slice(0, 25)) console.log((v / 1000).toFixed(1).padStart(8), k);
  await browser.close(); srv.kill('SIGTERM');
})();
