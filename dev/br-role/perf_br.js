/* BR-RoLE BR3 - one focused performance pass (development only; never served).  Not a matrix: a handful of scenes, once.
 *
 *   node dev/br-role/perf_br.js --game PATH --profile desktop|mobile [--out FILE.json] [--secs 6]
 *
 * desktop: 1280x720, DPR 1, MEDIUM and HIGH, each scene also with the v23.3.6 lighting (DEV switch) as the reference.
 * mobile:  412x915, DPR 2.625, touch, Chrome's CPU throttling x4, LOW (and MEDIUM for comparison), with the reference.
 * Scenes: lamps (spawn hall, light off), beam (flashlight + the spawn lamps), hound (a Hound in your beam: actor shadows),
 *         props (the HUMMING ROOMS counter, lamps + beam: prop shadows), peers (a scripted second player crossing beams),
 *         travel (teleporting into four new lamp regions: lamp-field builds), switch (LOW -> HIGH -> MEDIUM: rebuilds).
 * Per scene: BR-RoLE's own time per frame (mean / p95 / max, from its counters), the page's frame interval (rAF), the
 * lamp-field builds (count, total, longest), the actor / prop counters.
 * NOTE: this machine renders with SwiftShader (software): absolute numbers are far slower than any real GPU; what matters
 * is BR-RoLE's own share and how the scenes compare. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PROFILE = opt('profile') || 'desktop', SECS = +(opt('secs') || 6), PORT = +(opt('port') || (PROFILE === 'mobile' ? 9488 : 9487));
const OUT = opt('out') || `/tmp/br-perf-${PROFILE}.json`;
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + .5))]; };
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const mobile = PROFILE === 'mobile', browser = await H.pw.chromium.launch({ args: H.ARGS }), room = 'brperf' + Date.now() % 1e5, R = { profile: PROFILE, secs: SECS, scenes: [], when: new Date().toISOString() };
  try {
    const J = await H.join(browser, PORT, room, 'PF', mobile ? { viewport: { width: 412, height: 915 }, dpr: 2.625, mobile: true } : {}), P = J.P;
    if (mobile) { const cdp = await P.context().newCDPSession(P); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await H.stage(P); await H.setLights(P, 'off');
    R.page = await P.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent.slice(0, 120) }));
    const tiers = mobile ? ['low', 'medium'] : ['medium', 'high'];
    /* sample the page for SECS: rAF intervals + BR-RoLE's own counters */
    const sample = async (label, tier, extra) => {
      await P.evaluate(t => { if (t === 'legacy') __brRole.dev.legacy(true); else { __brRole.dev.legacy(false); __brRole.setQuality(t); } }, tier);
      await sleep(1500); await P.evaluate(() => { __brRole.resetStats(); window.__pf = []; let last = performance.now(); const f = () => { if (!window.__pf) return; const t = performance.now(); window.__pf.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await sleep(SECS * 1000);
      const r = await P.evaluate(() => { const d = window.__pf; window.__pf = null; return { dt: d, s: __brRole.stats() }; });
      const dt = r.dt.slice(1), s = r.s;
      const row = { scene: label, tier, frames: dt.length, frameMs: { mean: +(dt.reduce((a, b) => a + b, 0) / Math.max(1, dt.length)).toFixed(1), p95: +pct(dt, .95).toFixed(1), max: +Math.max(0, ...dt).toFixed(1) },
        brMs: tier === 'legacy' ? null : s.frameMs, lamps: tier === 'legacy' ? null : { drawn: s.lamps.last, cached: s.lamps.cached, builds: s.lamps.builds, buildMs: s.lamps.buildMs, buildMaxMs: s.lamps.buildMaxMs, evictions: s.lamps.evictions },
        carried: tier === 'legacy' ? null : s.carried.last, props: tier === 'legacy' ? null : s.props.last, actors: tier === 'legacy' ? null : s.actorShadows, ...(extra || {}) };
      R.scenes.push(row); console.log(JSON.stringify(row));
    };
    const place = async (x, y, a, light) => { await H.place(P, x, y, a, { light }); await sleep(800); await frames(P, 4); };
    /* scenes */
    await place(1130, 3420, 2.6, false); for (const t of ['legacy', ...tiers]) await sample('lamps', t);
    await place(1060, 3440, Math.atan2(3400 - 3440, 930 - 1060), true); for (const t of ['legacy', ...tiers]) await sample('beam', t);
    await place(3400, 1250, -Math.PI / 2, true); for (const t of ['legacy', ...tiers]) await sample('props', t);
    const at = await H.near(P, 'hound');
    if (at) { await place(at[0] + 170, at[1] - 40, Math.atan2(40, -170), true); for (const t of ['legacy', ...tiers]) await sample('hound', t); }
    await H.stage(P); await H.setLights(P, 'off');
    const peer = new H.ScriptedPeer(PORT, room, 'PEER', 'flashlight', '#9fd4ff'); await peer.standAt('PF', 880, 3600, -0.5);
    await place(1180, 3470, 2.95, true); for (const t of ['legacy', ...tiers]) await sample('peers', t); peer.close();
    /* travel: four new lamp regions, the worst BR frame right after each arrival */
    for (const t of tiers) {
      await P.evaluate(t => { __brRole.dev.legacy(false); __brRole.setQuality(t); }, t); await sleep(800);
      await P.evaluate(() => __brRole.resetStats()); const worst = [];
      for (const [x, y] of [[3400, 1250], [7860, 1120], [5000, 5500], [1300, 5100]]) { await P.evaluate(() => __brRole.resetStats()); await place(x, y, 0, true); await sleep(1500); const s = await P.evaluate(() => __brRole.stats()); worst.push({ at: [x, y], brMaxMs: s.frameMs.max, brP95: s.frameMs.p95, builds: s.lamps.builds, buildMaxMs: s.lamps.buildMaxMs, cached: s.lamps.cached }); }
      const row = { scene: 'travel', tier: t, arrivals: worst }; R.scenes.push(row); console.log(JSON.stringify(row));
    }
    /* switch: LOW -> HIGH -> MEDIUM at the spawn, the rebuild burst after each switch */
    await place(1130, 3420, 2.6, false); const sw = [];
    for (const t of ['low', 'high', 'medium']) { await P.evaluate(() => __brRole.resetStats()); await P.evaluate(t => __brRole.setQuality(t), t); await sleep(2500); const s = await P.evaluate(() => __brRole.stats()); sw.push({ to: t, brMaxMs: s.frameMs.max, brP95: s.frameMs.p95, builds: s.lamps.builds, buildMaxMs: s.lamps.buildMaxMs, drawn: s.lamps.last, pending: s.lamps.pending }); }
    R.scenes.push({ scene: 'switch', steps: sw }); console.log(JSON.stringify({ scene: 'switch', steps: sw }));
    R.errors = J.errs;
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 600); console.log('ERROR', R.error); }
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); await browser.close(); srv.kill();
})();
