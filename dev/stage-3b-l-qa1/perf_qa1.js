/* Stage 3B-L QA1 (from dev/stage-3b-l/perf_3bl.js) - performance after warm-up, parent vs QA1 on the same scenes
 * (development only; never served).
 *
 *   node dev/stage-3b-l-qa1/perf_qa1.js [--game PATH] [--port 9483] [--tiers medium,high] [--scenes A,I,D,H,E] [--secs 5] [--out FILE.json]
 *
 * 1920x1080 (the accepted 1.25 camera), the lamps on, no monsters.  Per scene and tier: arrive, let every lamp in view be
 * built (its far field and bounce light too), then measure for `secs` standing and `secs` walking across the room (D held):
 * BR-RoLE's own time per frame (its counters: mean / p95 / max), the lamps it drew, and the page's frame interval (rAF).
 * Then the warm-up itself: the build work a fresh arrival costs (lamp fields; far + bounce), and the longest single frame
 * BR-RoLE spent while building.  QA1 scenes: the human-QA scenes A (normal room), I (dense fixtures), D (PILLAR HALL), H (long
 * corridor) and E (BLACKOUT ZONE, flashlight on: the carried light's face receivers).
 * NOTE: this machine renders with SwiftShader (software, 2 CPUs): absolute numbers are far slower than any GPU; compare
 * the two builds against each other on the same scenes, run back to back. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9483), TIERS = (opt('tiers') || 'medium,high').split(','), SECS = +(opt('secs') || 5), OUT = opt('out'), ONLY = opt('scenes') ? opt('scenes').split(',') : null;
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + .5))]; };
const C = c => c * 96 + 48;
const SCENES = [['A normal room (YELLOW HALL)', C(12), C(35), null], ['I dense fixtures (REPEATING ROOMS)', C(34), C(34), null], ['D PILLAR HALL', C(82), C(12), null], ['H long corridor', C(11.5), C(22), null], ['E BLACKOUT ZONE, flashlight on', C(13), C(53), 'flashlight']];
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { game: GAME, rows: [] };
  try {
    const J = await H.join(browser, PORT, 'pf' + Date.now() % 1e5, 'PF', { viewport: { width: 1920, height: 1080 } }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off'); R.version = await P.evaluate(() => __brRole.version);
    const ready = () => P.evaluate(() => { const s = __brRole.stats(); return s.lamps.pending === 0 && (!__brRole.dev.farReady || __brRole.dev.farReady()); });
    const measure = async walk => {
      await P.evaluate(() => { __brRole.resetStats(); window.__pf = []; let last = performance.now(); const f = () => { if (!window.__pf) return; const t = performance.now(); window.__pf.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      if (walk) await P.keyboard.down('KeyD'); await sleep(SECS * 1000); if (walk) await P.keyboard.up('KeyD');
      const r = await P.evaluate(() => { const d = window.__pf; window.__pf = null; return { dt: d.slice(1), s: __brRole.stats() }; });
      return { frames: r.dt.length, pageMs: { mean: +(r.dt.reduce((a, b) => a + b, 0) / Math.max(1, r.dt.length)).toFixed(1), p95: +pct(r.dt, .95).toFixed(1) }, brMs: r.s.frameMs, lamps: r.s.lamps.last,
        builds: r.s.lamps.builds, farBuilds: r.s.far ? r.s.far.builds : null };
    };
    for (const tier of TIERS) {
      await P.evaluate(t => __brRole.setQuality(t), tier);
      for (const [label, x, y, kind] of SCENES) {
        if (ONLY && !ONLY.includes(label.split(' ')[0])) continue;
        await H.place(P, x, y, kind ? Math.PI : 0, { light: !!kind, kind: kind || 'flashlight' }); await P.evaluate(() => __brRole.resetStats());
        const t0 = Date.now(); let ok = false; for (let k = 0; k < 120 && !ok; k++) { await frames(P, 3); ok = await ready(); } await frames(P, 10);
        const warm = await P.evaluate(() => { const s = __brRole.stats(); return { lampBuilds: s.lamps.builds, lampBuildMs: s.lamps.buildMs, lampBuildMaxMs: s.lamps.buildMaxMs, far: s.far ? { builds: s.far.builds, buildMs: s.far.buildMs, frameMaxMs: s.far.frameMaxMs } : null, brMaxMs: s.frameMs.max }; });
        const stand = await measure(false), walkR = await measure(true);
        const row = { tier, scene: label, warmUp: Object.assign(warm, { seconds: +((Date.now() - t0) / 1000).toFixed(1) }), standing: stand, walking: walkR };
        R.rows.push(row);
        console.log(`${tier} | ${label} | standing BR ${stand.brMs.mean}/${stand.brMs.p95} ms, page ${stand.pageMs.mean} ms | walking BR ${walkR.brMs.mean}/${walkR.brMs.p95} ms, page ${walkR.pageMs.mean} ms | warm-up: ${warm.lampBuilds} lamp fields ${warm.lampBuildMs} ms` + (warm.far ? `, far+bounce ${warm.far.builds} (${warm.far.buildMs} ms, <= ${warm.far.frameMaxMs} ms a frame)` : ''));
      }
    }
    R.errs = J.errs;
  } finally { await browser.close(); srv.kill(); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
