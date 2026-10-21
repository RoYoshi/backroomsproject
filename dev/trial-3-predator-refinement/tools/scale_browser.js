#!/usr/bin/env node
/* dev/trial-3-predator-refinement/tools/scale_browser.js - the undisguised Skin-Stealer's size on the page against a Wanderer and a Hound
 * (development only; the checkpoints' evidence, not a gate step).  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-predator-refinement/tools/scale_browser.js [--dir DIR] [--out FILE.json] [--shots DIR] [--tag before|after]
 *
 * One server (`node server.js PORT` in DIR, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader), two
 * pages in one fresh room: the observer (1280x720, its camera - the game's own zoom) and a Wanderer.  The world is frozen and emptied of
 * Smilers and Hounds with the admin panel's own commands; then one Hound and one Skin-Stealer are put near the observer (the panel's
 * NEAR), the Wanderer is moved beside the Skin-Stealer, and the observer stands a little off with its light on them.  Measured, with no
 * debug overlay: each figure's drawn size in the creatures layer - its local bounds (orientation-free, in world px: the drawing itself
 * times its own scale) and its bounds on the screen - for the Skin-Stealer's view, the Wanderer's avatar and the Hound's view; and the
 * server's colliders for comparison (the Skin-Stealer's radius 24, a player's).  Screenshots: the whole page and a crop round the three.
 * Nothing here changes what the game does; it reads the page's display objects. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = { tag: 'now' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), PASS = 'k3-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const INIT = `(() => {
  const S = window.WebSocket; window.__k3 = { game: null, unlocked: false, ss: null, e: null };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__k3.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data);
      if (m.t === 'admin' && m.ok) window.__k3.unlocked = true;
      if (m.t === 's' && m.e) { window.__k3.ss = m.e.ss || null; window.__k3.e = m.e; } } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
})();`;
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000, every = 50) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } }
async function runPage(b, port, room, vp, name) {
  const ctx = await b.newContext({ viewport: vp }); await ctx.addInitScript(INIT);
  const P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', name);
  await P.bringToFront(); await P.click('#enter');
  await until(P, () => !!(window.__net && __net.on && window.__k3.game && window.__api.started()), null, 30000);
  await sleep(2500);
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__k3.unlocked, null, 5000);
  return { ctx, P, errs, cmd: o => P.evaluate(o => window.__k3.game.send(JSON.stringify(Object.assign({ t: 'a' }, o))), o) };
}
/* every display object of the creatures layer: label, its local bounds x its own scale (world px), its bounds on the screen */
const MEASURE = `(() => { const L = __api.layer(), out = [];
  const walk = (o, depth) => { if (!o || depth > 2) return; for (const c of o.children || []) {
    if (c.visible === false) continue;
    let lb = null, gb = null; try { const b = c.getLocalBounds(); lb = { w: +(b.width * Math.abs(c.scale.x)).toFixed(1), h: +(b.height * Math.abs(c.scale.y)).toFixed(1) }; } catch (e) { }
    try { const b = c.getBounds(); gb = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; } catch (e) { }
    out.push({ label: String(c.label || c.name || ''), depth, x: Math.round(c.x), y: Math.round(c.y), rot: +(c.rotation || 0).toFixed(2), sc: +(c.scale ? c.scale.x : 1).toFixed(3), lb, gb, n: (c.children || []).length });
    if (depth < 1 && !c.label) walk(c, depth + 1);
  } };
  walk(L, 0); return out; })()`;
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/trial-3-predator-refinement/tools/scale_browser.js', dir: path.basename(DIR), tag: ARG.tag, chromium: b.version() };
  try {
    const room = 'sc' + (Date.now() % 1e6);
    const O = await runPage(b, port, room, { width: 1280, height: 720 }, 'K3Look');
    O.cmd({ c: 'freeze', on: true }); O.cmd({ c: 'smilers', mode: 'remove', n: 10 }); O.cmd({ c: 'hounds', mode: 'remove', n: 10 });
    const B = await runPage(b, port, room, { width: 640, height: 360 }, 'K3Walk');
    O.cmd({ c: 'smilers', mode: 'remove', n: 10 }); O.cmd({ c: 'hounds', mode: 'remove', n: 10 }); await sleep(600);
    O.cmd({ c: 'near', k: 'skinstealer' }); await sleep(400); O.cmd({ c: 'near', k: 'hound' });
    const K = await until(O.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0] : null, null, 8000);
    const Hd = await until(O.P, () => { const e = window.__k3.e; return e && e.h && e.h.length ? e.h[0] : null; }, null, 8000);
    R.keys = await O.P.evaluate(() => Object.keys(window.__k3.e || {}));
    R.creature = K; R.houndRaw = Hd;
    // the Wanderer 150 px beside the Skin-Stealer, the observer 330 px off with its light on them; both facing the same way as it does
    // (the observer first goes near it: the page draws only what is within reach of its camera)
    await O.P.evaluate(k => { const A = __api; for (const r of [300, 360, 420, 240]) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r; if (A.sl(x, y, 26) && A.Uc(k.x, k.y, a, r) >= r - 4) { A.tp(x, y); return; } } }, K);
    await sleep(800);
    const spot = await O.P.evaluate(k => { const A = __api;
      for (const r of [330, 300, 380, 260]) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, ox = Math.cos(a), oy = Math.sin(a), sx = k.x + ox * r, sy = k.y + oy * r;
        if (!(A.sl(sx, sy, 26) && A.Uc(k.x, k.y, a, r) >= r - 4)) continue;
        for (const side of [1, -1]) { const wx = k.x - oy * 150 * side, wy = k.y + ox * 150 * side, wa = Math.atan2(wy - k.y, wx - k.x);
          if (A.sl(wx, wy, 26) && A.Uc(k.x, k.y, wa, 150) >= 146) return { wx, wy, sx, sy, ox, oy }; } }
      return null; }, K);
    R.spot = spot;
    if (spot) {
      await B.P.evaluate(s => { __api.tp(s.wx, s.wy); }, spot);
      await O.P.evaluate(s => { __api.tp(s.sx, s.sy); __api.H.angle = Math.atan2(-s.oy, -s.ox); }, spot);
      if (!(await O.P.evaluate(() => __api.lightOn()))) await O.P.keyboard.press('KeyF');
    }
    await sleep(2500);
    R.measure = await O.P.evaluate(MEASURE);
    // which object is which: the Skin-Stealer's view is labelled; the Wanderer's avatar and the Hound's view stand where the server has them
    const hNow = await O.P.evaluate(() => { const e = window.__k3.e; return e && e.h && e.h.length ? e.h[0] : null; });
    const at = (x, y) => R.measure.filter(m => m.depth === 0 && Math.hypot(m.x - x, m.y - y) < 4).sort((a, b) => (b.lb ? b.lb.w * b.lb.h : 0) - (a.lb ? a.lb.w * a.lb.h : 0))[0] || null;
    const ksv = R.measure.find(m => /^skinstealer#/.test(m.label));
    R.figures = { skinstealer: ksv || null, wanderer: R.spot ? at(R.spot.wx, R.spot.wy) : null, hound: hNow ? at(hNow.x, hNow.y) : null };
    R.camera = await O.P.evaluate(() => { const A = __api; return { H: { x: Math.round(A.H.x), y: Math.round(A.H.y), a: +A.H.angle.toFixed(2) }, dpr: devicePixelRatio, w: innerWidth, h: innerHeight }; });
    if (SHOTS) {
      const f = path.join(SHOTS, `scale_${ARG.tag}_1280.png`); await O.P.screenshot({ path: f }); R.shot = path.basename(f);
      const ks = R.measure.find(m => /^skinstealer#/.test(m.label));
      if (ks && ks.gb) { const cx = ks.gb.x + ks.gb.w / 2, cy = ks.gb.y + ks.gb.h / 2, clip = { x: Math.max(0, Math.round(cx - 260)), y: Math.max(0, Math.round(cy - 200)), width: 520, height: 400 };
        clip.width = Math.min(clip.width, 1280 - clip.x); clip.height = Math.min(clip.height, 720 - clip.y);
        const f2 = path.join(SHOTS, `scale_${ARG.tag}_crop.png`); await O.P.screenshot({ path: f2, clip }); R.crop = path.basename(f2); }
    }
    R.errors = { observer: O.errs, wanderer: B.errs };
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 900); }
  finally { await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  console.log(JSON.stringify({ creature: R.creature, spot: R.spot, camera: R.camera, error: R.error }));
  if (R.figures) for (const [k, m] of Object.entries(R.figures)) console.log(`${k}: ${m ? `local ${m.lb.w} x ${m.lb.h} world px (its own scale ${m.sc}); on the screen ${m.gb.w} x ${m.gb.h} px at rotation ${m.rot}` : 'not drawn'}`);
  for (const m of R.measure || []) if (m.lb && m.lb.w > 4 && m.gb && m.gb.x > -200 && m.gb.x < 1500 && m.gb.y > -200 && m.gb.y < 900) console.log(JSON.stringify(m));
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
