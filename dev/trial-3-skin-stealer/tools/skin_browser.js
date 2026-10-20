#!/usr/bin/env node
/* dev/trial-3-skin-stealer/tools/skin_browser.js - Trial 3: the Skin-Stealer in real pages (development only; the checkpoints' browser
 * evidence, not a gate step).
 *
 *   node dev/trial-3-skin-stealer/tools/skin_browser.js [--dir DIR] [--out FILE.json] [--shots DIR] [--only a,b] [--check 1]
 *
 * One server (`node server.js PORT` in DIR, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader).  Each
 * section opens its own page(s) in a fresh room, starts a run, unlocks the admin panel through the page's own test hook
 * (window.__net.testAuth) and drives the real server with the panel's own commands ({t:'a', c}) on the game's socket:
 *   t1   the species on the page: the script is loaded and publishes window.__skin; the admin panel keeps its five tabs until K is
 *        pressed with it open; then its SKIN tab shows the count and its
 *        + NEAR ME button puts one near (the server's answer on the status bar, the tab lists it); that Skin-Stealer is in
 *        the snapshot's ss list and drawn as one view in the bundle's creatures layer (the sight-masked layer), at the mirrored place,
 *        shaded by the light where it stands; REMOVE takes the view away; a world reset clears it; P9's keys while there is none;
 *        screenshots at 1280x720 of it lit by the player's light, and of the empty spot after.  No page error.
 * Every name and passcode is synthetic.  The server is stopped by its PID. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), PASS = 'k3-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = ARG.only ? ARG.only.split(',') : null, want = s => !ONLY || ONLY.includes(s);
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
/* before the page's scripts: the game socket is kept (to send the panel's commands), every snapshot's ss list and keys are noted */
const INIT = `(() => {
  const S = window.WebSocket; window.__k3 = { game: null, unlocked: false, ss: null, keys: '', snaps: 0, ares: [] };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__k3.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data);
      if (m.t === 'admin' && m.ok) window.__k3.unlocked = true;
      if (m.t === 'ares') window.__k3.ares.push(m.msg);
      if (m.t === 's' && m.e) { window.__k3.snaps++; window.__k3.ss = m.e.ss || null; window.__k3.keys = Object.keys(m.e).join(','); } } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
  // the frame hook's camera, to find a world point on the screen (aim the mouse - the player's facing - at it)
  let mp = null; Object.defineProperty(window, '__mp', { configurable: true, get: () => mp ? (a => { window.__k3.cam = { x: a.cam.x, y: a.cam.y, sc: a.sc }; return mp(a); }) : mp, set: f => { mp = f; } });
  window.__k3.screen = (x, y) => { const c = window.__k3.cam; return c ? { x: innerWidth / 2 + (x - c.x) * c.sc, y: innerHeight / 2 + (y - c.y) * c.sc } : null; };
})();`;
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000, every = 50) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } }
/* a page in a run: the menu, a name, ENTER; the admin unlocked */
async function runPage(b, port, room, vp, name) {
  const ctx = await b.newContext({ viewport: vp }); await ctx.addInitScript(INIT);
  const P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', name);
  await P.bringToFront(); await P.click('#enter');
  await until(P, () => !!(window.__net && __net.on && window.__k3.game && window.__api.started()), null, 30000);
  await sleep(2500);                                                                     // (the fall into the level)
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__k3.unlocked, null, 5000);
  return { ctx, P, errs, cmd: o => P.evaluate(o => window.__k3.game.send(JSON.stringify(Object.assign({ t: 'a' }, o))), o) };
}
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(groot, 'sharp')); } })();
/* a 3x close-up of the (first) Skin-Stealer's view, as the screen shows it */
async function closeUp(P, tag, half = 70) {
  const s = await P.evaluate(() => { const v = __api.layer().children.find(c => c.__skin); return v ? window.__k3.screen(v.x, v.y) : null; }); if (!s) return null;
  const x = Math.max(0, Math.round(s.x - half)), y = Math.max(0, Math.round(s.y - half));
  const buf = await P.screenshot({ type: 'png', clip: { x, y, width: half * 2, height: half * 2 } });
  await sharp(buf).resize(half * 6, half * 6, { kernel: 'nearest' }).png().toFile(path.join(SHOTS, tag + '.png')); return s;
}
/* aim the player (the mouse: the game's facing) at the Skin-Stealer's view on the screen */
async function aimAt(P) {
  const s = await P.evaluate(() => { const v = __api.layer().children.find(c => c.__skin); return v ? window.__k3.screen(v.x, v.y) : null; });
  if (s) { await P.mouse.move(s.x, s.y, { steps: 4 }); await sleep(300); await P.mouse.move(s.x + 1, s.y, { steps: 2 }); }
  return s;
}
const VIEWS = `() => { const A = window.__api, L = A.layer(); return L.children.filter(v => v.__skin).map(v => ({ id: v.__id, x: Math.round(v.x), y: Math.round(v.y), vis: v.visible, tint: v.tint, inLayer: v.parent === L, masked: !!(L.mask) })); }`;
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/trial-3-skin-stealer/tools/skin_browser.js', dir: DIR, chromium: b.version(), sections: {} };
  const cases = [], check = (name, ok, detail) => cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 600) });
  try {
    if (want('t1')) {
      const T = R.sections.t1 = {};
      const { ctx, P, errs, cmd } = await runPage(b, port, 'k3t1' + (Date.now() % 1e6), { width: 1280, height: 720 }, 'K3One');
      T.script = await P.evaluate(() => ({ skin: typeof window.__skin, fns: window.__skin ? Object.keys(window.__skin).sort().join(',') : '' }));
      T.keysBefore = await P.evaluate(() => window.__k3.keys);
      cmd({ c: 'freeze', on: true }); cmd({ c: 'god', id: await P.evaluate(() => __api.H.id) });
      // the admin panel's SKIN tab (the backquote key opens the panel): its count, then its own button puts one near
      await P.keyboard.press('Backquote'); await sleep(300);
      if (await P.evaluate(() => !document.getElementById('admLogin').hidden)) { await P.fill('#admPass', PASS); await P.click('#adminPanel [data-a="unlock"]'); await P.waitForSelector('#admMain', { state: 'visible', timeout: 8000 }); }
      T.tabsBefore = await P.evaluate(() => [...document.querySelectorAll('#admTabs button')].map(b => b.dataset.t).join(','));
      await P.keyboard.press('KeyK'); await sleep(300);                                     // K, with the panel open: the SKIN tab
      T.tabsK = await P.evaluate(() => [...document.querySelectorAll('#admTabs button')].map(b => b.dataset.t).join(','));
      await P.click('#adminPanel [data-a="tab"][data-t="skin"]'); await sleep(400);
      T.tab = await P.evaluate(() => ({ text: document.getElementById('admBody').textContent.slice(0, 120), buttons: [...document.querySelectorAll('#admBody button[data-c]')].map(b => b.textContent) }));
      await P.click('#admBody button[data-c="near"][data-k="skinstealer"]');
      const ss = await until(P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss : null, null, 8000);
      await sleep(1200); T.tabAfter = await P.evaluate(() => ({ text: document.getElementById('admBody').textContent.slice(0, 160), status: document.getElementById('admStatus').textContent }));
      await P.keyboard.press('Backquote'); await sleep(300);
      T.ss = ss; await sleep(800);
      T.views = await P.evaluate(`(${VIEWS})()`);
      // stand two body lengths from it, facing it, the light on: it is lit by the player's own light
      T.stand = await P.evaluate(() => { const A = __api, v = A.layer().children.find(c => c.__skin); if (!v) return null;
        for (const r of [130, 170, 100, 210]) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = v.x + Math.cos(a) * r, y = v.y + Math.sin(a) * r;
          if (A.sl(x, y, 20) && A.Uc(x, y, a + Math.PI, r) >= r - 4) { A.tp(x, y); A.H.angle = a + Math.PI; return { x: Math.round(x), y: Math.round(y), r }; } }
        return null; });
      await sleep(1500);
      await aimAt(P);                                                                        // the mouse on it: the player faces it, the light on it
      await sleep(1200);
      T.lit = await P.evaluate(`(${VIEWS})()`);
      T.light = await P.evaluate(() => __api.lightOn());
      if (SHOTS) { await P.screenshot({ path: path.join(SHOTS, 't1_skinstealer_lit_1280.png') }); await closeUp(P, 't1_skinstealer_lit_closeup'); }
      const eid = ss && ss[0] && ss[0].i;
      cmd({ c: 'entdel', eid }); await until(P, () => !window.__k3.ss, null, 6000); await sleep(600);
      T.after = await P.evaluate(`(${VIEWS})()`); T.keysAfter = await P.evaluate(() => window.__k3.keys);
      if (SHOTS) await P.screenshot({ path: path.join(SHOTS, 't1_after_remove_1280.png') });
      cmd({ c: 'near', k: 'skinstealer' }); await until(P, () => window.__k3.ss && window.__k3.ss.length, null, 8000); await sleep(500);
      T.beforeReset = (await P.evaluate(`(${VIEWS})()`)).length;
      cmd({ c: 'world' }); await until(P, () => !window.__k3.ss, null, 8000); await sleep(1200);
      T.afterReset = (await P.evaluate(`(${VIEWS})()`)).length;
      T.errors = errs;
      check('t1_script_loaded', T.script.skin === 'object' && T.script.fns === 'clear,draw,mirror', JSON.stringify(T.script));
      check('t1_p9_keys_without_one', T.keysBefore === 'st,h,m,b,p,gw,it,lf,sn', T.keysBefore);
      check('t1_admin_tabs', T.tabsBefore === 'players,monsters,deaths,world,debug' && T.tabsK === 'players,monsters,deaths,world,debug,skin', `${T.tabsBefore} -> K -> ${T.tabsK}`);
      check('t1_admin_skin_tab', /SKIN-STEALER · 0 IN THE HALLS \(ADMIN MAX 4\)/.test(T.tab.text) && T.tab.buttons.join('|') === '+ SKIN-STEALER|+ NEAR ME|− SKIN-STEALER' && /SKIN-STEALER · 1 IN THE HALLS/.test(T.tabAfter.text) && /K#\d+/.test(T.tabAfter.text) && /SKIN-STEALER PLACED NEAR YOU/.test(T.tabAfter.status), JSON.stringify({ before: T.tab, after: T.tabAfter }));
      check('t1_in_snapshot', ss && ss.length === 1 && Number.isFinite(ss[0].x), JSON.stringify(ss));
      check('t1_one_view_in_creatures_layer', T.views.length === 1 && T.views[0].inLayer && T.views[0].masked && ss && T.views[0].id === ss[0].i && Math.hypot(T.views[0].x - ss[0].x, T.views[0].y - ss[0].y) < 6, JSON.stringify(T.views));
      check('t1_shaded_by_light', T.lit.length === 1 && T.lit[0].vis && T.views[0] && T.lit[0].tint > T.views[0].tint, `in the dark ${T.views[0] && T.views[0].tint.toString(16)}, lit ${T.lit[0] && T.lit[0].tint.toString(16)} (light ${T.light})`);
      check('t1_remove_takes_view', T.after.length === 0 && T.keysAfter === 'st,h,m,b,p,gw,it,lf,sn', `${T.after.length} views; keys ${T.keysAfter}`);
      check('t1_world_reset_clears', T.beforeReset === 1 && T.afterReset === 0, `${T.beforeReset} -> ${T.afterReset}`);
      check('t1_no_page_errors', !errs.length, JSON.stringify(errs));
      await ctx.close();
    }
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
  R.cases = cases; R.ok = cases.length > 0 && cases.every(c => c.ok);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name} - ${c.detail}`);
  console.log(`SKIN BROWSER: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  if (ARG.check && !R.ok) process.exitCode = 1;
})();
