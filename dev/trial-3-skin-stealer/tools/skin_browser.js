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
 *   t4   its kill in two real pages in one room: the victim plays a death from the SKIN tab's preview (B); on the victim's page our own
 *        death names it (kind SkinStealer, its length), the bundle's attacker view is hidden and this script's own attacker is drawn
 *        where the death's physics has it; the spectator replays it with this script's replay attacker while the mirrored creature is
 *        hidden; both get the corpse (cause SkinStealer) and see the creature again after, feeding; the death's sound and the snap go
 *        through this script (instrumented here); then a second death (A) whose victim's page closes mid-death: the server's own corpse,
 *        exactly one for that player.  Screenshots mid-death on both pages.  No page error.
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
      check('t1_script_loaded', T.script.skin === 'object' && T.script.fns === 'attack,attacker,clear,deathEvent,deathSound,draw,mirror', JSON.stringify(T.script));
      check('t1_p9_keys_without_one', T.keysBefore === 'st,h,m,b,p,gw,it,lf,sn', T.keysBefore);
      check('t1_admin_tabs', T.tabsBefore === 'players,monsters,deaths,world,debug' && T.tabsK === 'players,monsters,deaths,world,debug,skin', `${T.tabsBefore} -> K -> ${T.tabsK}`);
      check('t1_admin_skin_tab', /SKIN-STEALER · 0 IN THE HALLS \(ADMIN MAX 4\)/.test(T.tab.text) && T.tab.buttons.slice(0, 3).join('|') === '+ SKIN-STEALER|+ NEAR ME|− SKIN-STEALER' && /SKIN-STEALER · 1 IN THE HALLS/.test(T.tabAfter.text) && /K#\d+/.test(T.tabAfter.text) && /SKIN-STEALER PLACED NEAR YOU/.test(T.tabAfter.status), JSON.stringify({ before: T.tab, after: T.tabAfter }));
      check('t1_in_snapshot', ss && ss.length === 1 && Number.isFinite(ss[0].x), JSON.stringify(ss));
      check('t1_one_view_in_creatures_layer', T.views.length === 1 && T.views[0].inLayer && T.views[0].masked && ss && T.views[0].id === ss[0].i && Math.hypot(T.views[0].x - ss[0].x, T.views[0].y - ss[0].y) < 6, JSON.stringify(T.views));
      check('t1_shaded_by_light', T.lit.length === 1 && T.lit[0].vis && T.views[0] && T.lit[0].tint > T.views[0].tint, `in the dark ${T.views[0] && T.views[0].tint.toString(16)}, lit ${T.lit[0] && T.lit[0].tint.toString(16)} (light ${T.light})`);
      check('t1_remove_takes_view', T.after.length === 0 && T.keysAfter === 'st,h,m,b,p,gw,it,lf,sn', `${T.after.length} views; keys ${T.keysAfter}`);
      check('t1_world_reset_clears', T.beforeReset === 1 && T.afterReset === 0, `${T.beforeReset} -> ${T.afterReset}`);
      check('t1_no_page_errors', !errs.length, JSON.stringify(errs));
      await ctx.close();
    }
    if (want('t4')) {
      const T = R.sections.t4 = {}, room = 'k3t4' + (Date.now() % 1e6), VP = { width: 1280, height: 720 };
      const V = await runPage(b, port, room, VP, 'K3Victim'), S = await runPage(b, port, room, VP, 'K3Watch');
      const vid = await V.P.evaluate(() => __api.H.id);
      S.cmd({ c: 'goto', id: vid }); await sleep(1500);                                     // (an ordinary living spectator: with nobody alive a room resets its world)
      T.sstand = await S.P.evaluate(() => { const A = __api, H = A.H, x0 = H.x, y0 = H.y;           // two body lengths from the victim, facing them
        for (const r of [190, 150, 230]) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r;
          if (A.sl(x, y, 20) && A.Uc(x, y, a + Math.PI, r) >= r - 4) { A.tp(x, y); A.H.angle = a + Math.PI; return { x: Math.round(x), y: Math.round(y) }; } } return null; });
      await sleep(1200);
      // (instrumentation, here only: count the death's sounds and the snap as they reach this script)
      const inst = () => { const K = window.__skin, o1 = K.deathSound, o2 = K.deathEvent; window.__k3.snd = { death: 0, snap: 0 };
        K.deathSound = O => { window.__k3.snd.death++; return o1(O); }; K.deathEvent = (q, jl, S, pl) => { if (q && q.k === 'snap') window.__k3.snd.snap++; return o2(q, jl, S, pl); }; };
      await V.P.evaluate(inst); await S.P.evaluate(inst);
      // an existing Skin-Stealer for the preview (one made just for a preview is taken away again when its victim respawns: P9's admin
      // rule), placed while the world is frozen so it does nothing before the preview
      V.cmd({ c: 'freeze', on: true }); await sleep(200); V.cmd({ c: 'near', k: 'skinstealer' });
      T.placed = await until(V.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss.map(t => t.i) : null, null, 8000);
      // the victim: the panel, K, the SKIN tab, its death B
      await V.P.keyboard.press('Backquote'); await sleep(300);
      if (await V.P.evaluate(() => !document.getElementById('admLogin').hidden)) { await V.P.fill('#admPass', PASS); await V.P.click('#adminPanel [data-a="unlock"]'); await V.P.waitForSelector('#admMain', { state: 'visible', timeout: 8000 }); }
      await V.P.keyboard.press('KeyK'); await sleep(300); await V.P.click('#adminPanel [data-a="tab"][data-t="skin"]'); await sleep(400);
      T.previews = await V.P.evaluate(() => [...document.querySelectorAll('#admBody button[data-c="preview"]')].map(b => b.dataset.k + ':' + b.dataset.var).join(','));
      await V.P.click('#admBody button[data-c="preview"][data-k="skinstealer"][data-var="B"]');
      const own = await until(V.P, () => { const D = __api.death(); return D && D.active ? { kind: D.kind, v: D.variant, dur: D.duration } : null; }, null, 6000, 20);
      if (await V.P.evaluate(() => !!document.getElementById('adminPanel') && !document.getElementById('adminPanel').hidden)) { await V.P.keyboard.press('Backquote'); }
      await sleep(500);
      T.own = own;
      T.vMid = await V.P.evaluate(() => { const L = __api.layer(), k = L.children.find(c => c.label === 'skinstealer-kill'), D = __api.death();
        return { killView: !!k, visible: !!(k && k.visible), at: k ? [Math.round(k.x), Math.round(k.y)] : null, attacker: D && D.attacker ? [Math.round(D.attacker.x), Math.round(D.attacker.y)] : null, mirroredShown: L.children.filter(c => c.__skin && c.__id && c.visible).length, el: D ? +D.elapsed.toFixed(2) : null }; });
      T.sMid = await S.P.evaluate(v => { const f = (window.__fxs || []).find(x => x.id === v && x.cause === 'SkinStealer'), L = __api.layer();
        return { replay: !!f, att: f && f.att ? f.att.label : null, attVisible: !!(f && f.att && f.att.visible && f.att.parent), posed: !!(f && f.att && f.att.__s), mirroredShown: L.children.filter(c => c.__skin && c.__id && c.visible).length, mirrored: L.children.filter(c => c.__skin && c.__id).length }; }, vid);
      if (SHOTS) await Promise.all([V.P.screenshot({ path: path.join(SHOTS, 't4_own_death_B_1280.png') }), S.P.screenshot({ path: path.join(SHOTS, 't4_replay_B_1280.png') })]);   // (both at once: a software-rendered capture takes seconds)
      // the victim's own death, at its last frame, against the server's corpse (made from the server's own run of the same physics)
      T.vEnd = await until(V.P, () => { const D = __api.death(); return D && D.active && D.elapsed >= D.duration - .08 ? { x: +D.body.x.toFixed(1), y: +D.body.y.toFixed(1), a: +D.body.angle.toFixed(3), el: +D.elapsed.toFixed(2) } : null; }, null, 8000, 10);
      await until(V.P, () => !(__api.death() && __api.death().active), null, 8000);
      V.cmd({ c: 'freeze', on: false });                                                      // the death has played: the world runs again
      T.timeline = [];                                                                       // both pages, twice a second, after the death
      for (let i = 0; i < 9; i++) {
        const st = P => P.evaluate(v => ({ snaps: window.__k3.snaps, ss: window.__k3.ss ? window.__k3.ss.map(t => t.ac) : null, bodies: __api.bodyList().filter(b => b.ownerId === v || b.ownerId === 'r' + v).length, vis: document.visibilityState, d: __api.death() && __api.death().active ? +__api.death().elapsed.toFixed(1) : null }), vid).catch(e => String(e).slice(0, 80));
        T.timeline.push({ t: +(i * .5).toFixed(1), v: await st(V.P), s: await st(S.P) }); await sleep(470);
      }
      const corpse = P => P.evaluate(v => __api.bodyList().filter(b => b.ownerId === v || b.ownerId === 'r' + v).map(b => ({ cause: b.cause, x: Math.round(b.x), y: Math.round(b.y) })), vid);   // (another player's corpse is keyed 'r' + id)
      T.vCorpse = await corpse(V.P); T.sCorpse = await corpse(S.P);
      T.sAfter = await S.P.evaluate(() => ({ shown: __api.layer().children.filter(c => c.__skin && c.__id && c.visible).length, ss: window.__k3.ss }));
      T.snd = { victim: await V.P.evaluate(() => window.__k3.snd), spectator: await S.P.evaluate(() => window.__k3.snd) };
      // the snap's path, called as the death's frame calls it (a software-rendered page can process an event more than 0.25 s late, and
      // every death sound - a wall, the light, the hat, the snap - is then skipped by the same rule: the counts above are as measured)
      T.snapWired = await V.P.evaluate(() => { const n0 = window.__k3.snd.snap, H = __api.H; __ents.deathEvent({ k: 'snap', t: 1, x: H.x, y: H.y }, null, { t: 1 }); return window.__k3.snd.snap - n0; });
      if (SHOTS) await S.P.screenshot({ path: path.join(SHOTS, 't4_after_feeding_1280.png') });
      // a second death (A) whose victim's page closes during it: the server's own corpse, one for that player
      S.cmd({ c: 'revive', id: vid }); await sleep(1500);
      V.cmd({ c: 'preview', k: 'skinstealer', var: 'A' });
      T.second = await until(V.P, () => { const D = __api.death(); return D && D.active ? { kind: D.kind, v: D.variant } : null; }, null, 6000, 20);
      await sleep(500); await V.ctx.close();
      await sleep(5200);
      T.sCorpse2 = await corpse(S.P);
      T.errors = { victim: V.errs, spectator: S.errs };
      check('t4_preview_buttons', T.previews === 'skinstealer:A,skinstealer:B,skinstealer:C', T.previews);
      check('t4_own_death_names_it', own && own.kind === 'SkinStealer' && own.v === 'B' && Math.abs(own.dur - 3.4) < .01, JSON.stringify(own));
      check('t4_own_attacker_drawn', T.vMid.killView && T.vMid.visible && T.vMid.attacker && Math.hypot(T.vMid.at[0] - T.vMid.attacker[0], T.vMid.at[1] - T.vMid.attacker[1]) < 2 && T.vMid.mirroredShown === 0, JSON.stringify(T.vMid));
      check('t4_spectator_replay', T.sMid.replay && T.sMid.att === 'skinstealer-replay' && T.sMid.attVisible && T.sMid.posed && T.sMid.mirroredShown === 0 && T.sMid.mirrored >= 1, JSON.stringify(T.sMid));
      check('t4_victim_frame_is_the_corpse', T.vEnd && T.vCorpse[0] && Math.hypot(T.vEnd.x - T.vCorpse[0].x, T.vEnd.y - T.vCorpse[0].y) < 3, JSON.stringify({ lastFrame: T.vEnd, corpse: T.vCorpse[0] }));
      check('t4_corpse_everywhere', T.vCorpse.length === 1 && T.sCorpse.length === 1 && T.vCorpse[0].cause === 'SkinStealer' && T.sCorpse[0].cause === 'SkinStealer' && T.vCorpse[0].x === T.sCorpse[0].x, JSON.stringify({ v: T.vCorpse, s: T.sCorpse }));
      check('t4_creature_back_after', T.sAfter.shown >= 1 && T.sAfter.ss && T.sAfter.ss.length === 1 && T.placed && T.sAfter.ss[0].i === T.placed[0] && (T.sAfter.ss[0].ac === 15 || T.sAfter.ss[0].ac === 3), JSON.stringify({ placed: T.placed, after: T.sAfter }) + ' (ac 15 feeding; 3 leaving - disturbed at its kill by the spectator two body lengths away)');
      check('t4_sounds_through_this_script', T.snd.victim && T.snd.victim.death >= 1 && T.snd.spectator && T.snd.spectator.death >= 1 && T.snapWired === 1, JSON.stringify(T.snd) + ' snap path wired: ' + T.snapWired);
      check('t4_disconnect_one_corpse', T.second && T.second.kind === 'SkinStealer' && T.sCorpse2.length === 1 && T.sCorpse2[0].cause === 'SkinStealer' && (T.sCorpse2[0].x !== T.sCorpse[0].x || T.sCorpse2[0].y !== T.sCorpse[0].y), JSON.stringify({ second: T.second, after: T.sCorpse2, first: T.sCorpse }));
      check('t4_no_page_errors', !V.errs.length && !S.errs.length, JSON.stringify(T.errors));
      await S.ctx.close();
    }
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
  R.cases = cases; R.ok = cases.length > 0 && cases.every(c => c.ok);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name} - ${c.detail}`);
  console.log(`SKIN BROWSER: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  if (ARG.check && !R.ok) process.exitCode = 1;
})();
