/* Stage 3B-F4 - moving through the map: bake / upload work per frame while you cross rooms and doorways (development only;
 * never served).  Bounded: two routes, once per tier and mode.
 *
 *   node dev/stage-3b/walk_3b.js --game PATH [--out FILE.json] [--tiers low,medium,high] [--speed 380] [--port 9494]
 *
 * One staged page (god mode, frozen halls, lamps on), a Hound and a Smiler placed near the start (frozen: drawn, not moving).
 * In the page, every frame moves the wanderer along a route of floor cells at a fixed speed (px per real second; 380 is
 * about a run) and records the frame interval and what the remaster baked in that frame.  Remaster OFF (the old look) then ON,
 * per tier.  Route A: YELLOW HALL > REPEATING > SEGMENTED > ARCH GALLERY (carpet, five doorways); route B: BLACKOUT ZONE >
 * DAMP ROOMS > RED ROOMS > DEEP CARPET (carpet, tile, the red approach, deep pile).
 * NOTE: this container renders in software (frames ~250-350 ms), so the wanderer moves ~20x farther per frame than at 60 fps:
 * more chunks come into view in one frame than they ever would in play.  The per-frame bake counts here are an upper bound. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9494), OUT = opt('out') || '/tmp/walk_3b.json';
const TIERS = (opt('tiers') || 'low,medium,high').split(','), SPEED = +(opt('speed') || 380);
const ROUTES = {   /* cell centres on floor (checked against the map: no wall, prop, pillar or pit on the way) */
  A: [[1296, 3504], [2832, 3504], [2832, 3312], [3408, 3312], [3408, 3504], [4560, 3504], [6384, 3504], [7776, 3504]],
  B: [[1200, 5616], [2640, 5616], [2640, 5424], [3792, 5424], [3792, 5616], [5424, 5616], [5424, 5424], [6000, 5424], [6000, 5712], [7536, 5712]],
};
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { speed: SPEED, tiers: TIERS, routes: ROUTES, walks: [], when: new Date().toISOString() };
  try {
    const J = await H.join(browser, PORT, 'wk3b' + Date.now() % 1e5, 'WK', { query: '&dev3b=1' }), P = J.P;
    await H.until(() => P.evaluate(() => window.__l0v && __l0v.ready()), 30000); await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => Object.defineProperty(window, '__glitches', { configurable: true, get: () => [], set: () => { } }));   // no random exit walls on the routes
    R.blocked = await P.evaluate(routes => { const out = []; for (const [k, pts] of Object.entries(routes)) for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 24);
      for (let j = 0; j <= n; j++) { const x = x0 + (x1 - x0) * j / n, y = y0 + (y1 - y0) * j / n; if (!__api.sl(x, y, 8)) out.push([k, Math.round(x), Math.round(y)]); } } return out.slice(0, 12); }, ROUTES);
    await P.evaluate(() => __clock.thaw());
    for (const [rk, pts] of Object.entries(ROUTES)) {
      await H.place(P, pts[0][0], pts[0][1], 0, { light: true }); await sleep(600);
      for (const k of ['hound', 'smiler']) await H.near(P, k);                                     // entities in the scene (frozen)
      await P.evaluate(() => __clock.thaw());
      for (const tier of TIERS) for (const on of [false, true]) {
        await P.evaluate(([t, on]) => { __brRole.setQuality(t); __l0v.dev.remaster(on); }, [tier, on]);
        const was = await P.evaluate(() => __l0v.stats().tier);
        await H.until(() => P.evaluate(t => { const s = __l0v.stats(); return s.tier === t && !s.job; }, tier), 120000, 400);
        const rebuild = was !== tier ? await P.evaluate(() => __l0v.stats().rebuild || null) : null;   // the background rebuild this tier change caused
        await H.place(P, pts[0][0], pts[0][1], 0, { light: true }); await sleep(800); await frames(P, 4);
        const rows = await P.evaluate(([pts, speed]) => new Promise(res => {
          let i = 0, x = pts[0][0], y = pts[0][1], last = performance.now(), b0 = __l0v.stats().bake; const rows = [];
          const f = () => {
            const t = performance.now(), dt = t - last; last = t; let step = speed * dt / 1000, ang = 0;
            const off = Math.hypot(__api.H.x - x, __api.H.y - y);   // where the wanderer really is vs where the last frame put it (held by a monster = not moving)
            while (step > 0 && i < pts.length - 1) { const [tx, ty] = pts[i + 1], dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy); ang = Math.atan2(dy, dx);
              if (d <= step) { x = tx; y = ty; step -= d; i++; } else { x += dx / d * step; y += dy / d * step; step = 0; } }
            __api.tp(x, y); window.__aimA = ang;
            const b = __l0v.stats().bake; rows.push([+dt.toFixed(1), b.bakes - b0.bakes, +(b.bakeMs - b0.bakeMs).toFixed(2), b.visible, b.resident, Math.round(off)]); b0 = b;
            if (i >= pts.length - 1) return res(rows); requestAnimationFrame(f); };
          requestAnimationFrame(f); }), [pts, SPEED]);
        const dts = rows.slice(1).map(r => r[0]), bakes = rows.map(r => r[1]), bms = rows.map(r => r[2]);
        const w = { route: rk, tier, remaster: on ? 'on' : 'off', frames: rows.length, frameMs: { med: pct(dts, .5), p95: pct(dts, .95), max: Math.max(...dts) },
          bakes: bakes.reduce((a, b) => a + b, 0), maxBakesInFrame: Math.max(...bakes), framesWithBake: bakes.filter(b => b > 0).length,
          bakeMsInFrame: { p95: +pct(bms, .95).toFixed(2), max: +Math.max(...bms).toFixed(2) }, residentMax: Math.max(...rows.map(r => r[4])), visibleMax: Math.max(...rows.map(r => r[3])),
          offRouteMaxPx: Math.max(...rows.slice(2).map(r => r[5])), rebuild };
        R.walks.push(w); console.log(JSON.stringify(w));
      }
      await P.evaluate(() => { __brRole.setQuality('medium'); __l0v.dev.remaster(true); });
      await H.stage(P);                                                                             // monsters removed before the next route
    }
    R.errors = J.errs;
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 800); console.log('ERROR', R.error); }
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); await browser.close(); srv.kill();
})();
