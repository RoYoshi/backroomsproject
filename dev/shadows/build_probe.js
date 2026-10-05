/* 2D Lighting & Shadows - one-time shadow build costs in the real client (development only; never served).
 *
 *   node dev/shadows/build_probe.js GAME [--out FILE.json]
 *
 * For each case (viewport profile x quality tier) it starts the shipped `node server.js`, joins a staged room (frozen
 * halls, no monsters, lamps forced on, flashlight on), sets the tier and then tours the map: it teleports next to the
 * nearest ceiling lamp whose cached shadow has not been shown yet, waits until the lamp caches stop building, and
 * repeats until every lamp of the map has been built at least once (or the case's deadline). It records:
 *   - the static grounding build (once at load), ms;
 *   - lamp-cache builds during the tour: count, total, mean and slowest single build, ms;
 *   - the module's per-frame time over the tour, including the frames that built lamps (mean / p95 / max).
 * The bench measures steady state (caches warm); this measures the one-time cost of walking into new rooms.
 * Profiles are the bench's: 16x9 (1280x720, DPR 1) and mobile-like (390x844, DPR 3, touch, main thread slowed 4x).
 * Software rendering (SwiftShader) on a small container: evidence, not hardware certification. */
'use strict';
const { spawn, execSync } = require('child_process'); const http = require('http'); const fs = require('fs');
const H = require('./harness_lib.js'); const { sleep, frames } = H;
const PORT = 9471, GAME = process.argv[2], OUT = (process.argv.indexOf('--out') > 0) ? process.argv[process.argv.indexOf('--out') + 1] : null;
const CASES = [
  { profile: '16x9', tier: 'medium', viewport: { width: 1280, height: 720 }, dpr: 1, mobile: false, throttle: 1, deadline: 420 },
  { profile: '16x9', tier: 'high', viewport: { width: 1280, height: 720 }, dpr: 1, mobile: false, throttle: 1, deadline: 420 },
  { profile: 'mobile', tier: 'low', viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, throttle: 4, deadline: 600 },
  { profile: 'mobile', tier: 'high', viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, throttle: 4, deadline: 600 },
];
function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }
const stats = P => P.evaluate(() => __shadows.stats());
async function settleBuilds(P, maxFrames = 40) {        // until the lamp caches stop building for two reads in a row
  let last = -1, same = 0;
  for (let f = 0; f < maxFrames; f += 2) { await frames(P, 2); const b = (await stats(P)).cache.lampBuilds; if (b === last) { if (++same >= 2) return; } else same = 0; last = b; }
}
(async () => {
  if (!GAME) { console.error('usage: node dev/shadows/build_probe.js GAME [--out FILE.json]'); process.exit(2); }
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), results = [];
  try {
    for (const C of CASES) {
      const J = await H.join(browser, PORT, 'build' + Date.now() % 1e5, 'B', { viewport: C.viewport, dpr: C.dpr, mobile: C.mobile }), P = J.P;
      await H.stage(P); await H.setLights(P, 'off');
      if (C.throttle > 1) { const cdp = await J.ctx.newCDPSession(P); await cdp.send('Emulation.setCPUThrottlingRate', { rate: C.throttle }); }
      let at = await H.place(P, 1060, 3300, 0);
      await P.evaluate(t => __shadows.setQuality(t), C.tier); await settleBuilds(P);
      const lamps = await P.evaluate(() => (__api.lamps || []).map((l, i) => ({ i, x: l.x, y: l.y })));
      const base = (await stats(P)).cache; await P.evaluate(() => __shadows.resetStats());
      const shown = new Set((await P.evaluate(() => __shadows.snapshot().lamps.map(l => l.i))));
      const t0 = Date.now(); let stops = 0;
      for (; ;) {
        const todo = lamps.filter(l => !shown.has(l.i)); if (!todo.length || (Date.now() - t0) / 1000 > C.deadline) break;
        todo.sort((a, b) => Math.hypot(a.x - at[0], a.y - at[1]) - Math.hypot(b.x - at[0], b.y - at[1]));
        at = await H.place(P, todo[0].x, todo[0].y + 48, 0); stops++;
        await settleBuilds(P);
        for (const i of await P.evaluate(() => __shadows.snapshot().lamps.map(l => l.i))) shown.add(i);
        shown.add(todo[0].i);                                                   // a lamp the tier never shows here still counts as visited
      }
      const s = await stats(P), c = s.cache, n = c.lampBuilds - base.lampBuilds, tot = +(c.lampBuildMsTotal - base.lampBuildMsTotal).toFixed(2);
      const r = { profile: C.profile, tier: C.tier, throttle: C.throttle, lamps: lamps.length, lampsShown: shown.size, stops, seconds: Math.round((Date.now() - t0) / 1000),
        staticBuildMs: c.staticBuildMs, lampBuilds: n, lampBuildMsTotal: tot, lampBuildMsMean: n ? +(tot / n).toFixed(2) : 0, lampBuildMsMax: c.lampBuildMsMax,
        moduleMsPerFrame: s.buildMs, cacheSize: c.lamps, errors: s.errors, pageErrors: J.errs.slice(0, 5) };
      results.push(r); console.log(JSON.stringify(r));
      await J.ctx.close();
    }
  } catch (e) { console.log('FAIL harness ' + String(e && e.stack || e).slice(0, 400)); results.push({ error: String(e).slice(0, 400) }); }
  await browser.close(); srv.kill('SIGTERM');
  console.log('\n| profile | tier | lamps built / map | grounding build (once) ms | lamp builds | mean ms | slowest ms | module ms per frame during the tour (mean / p95 / max) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of results.filter(r => !r.error)) console.log(`| ${r.profile}${r.throttle > 1 ? ` (CPU ÷${r.throttle})` : ''} | ${r.tier.toUpperCase()} | ${r.lampsShown} / ${r.lamps} | ${r.staticBuildMs} | ${r.lampBuilds} | ${r.lampBuildMsMean} | ${r.lampBuildMsMax} | ${r.moduleMsPerFrame.mean} / ${r.moduleMsPerFrame.p95} / ${r.moduleMsPerFrame.max} |`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ schema: 'tfb-shadows-build/1', started: new Date().toISOString(), results }, null, 1) + '\n');
  process.exit(results.some(r => r.error) ? 1 : 0);
})();
