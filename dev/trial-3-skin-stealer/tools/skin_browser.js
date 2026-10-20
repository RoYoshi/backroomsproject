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
 *   t5   its presentation: every act it shows and its three deaths mid-way, laid out round a lamp-lit spot in the real page (synthetic
 *        entries are added to the server's list in this page only, by wrapping the script's mirror here), at BR-RoLE's three quality
 *        tiers and at 1280x720, 1920x1080 and a phone held sideways; its shadow as a BR-RoLE actor; then a real one near with the admin
 *        DEBUG overlay on: its own block (hunger, stamina, plan, why); its living sounds counted (none while every figure stands still,
 *        footfalls while one walks, the wind-up's tell and the leap).  No page error.
 *   t5d  the victim's own view of its death against a Hound's, at the same lamp-lit spot and the same moments (0.5, 1, 2, 3 s), measured
 *        in the page frame by frame: the darkness overlay's cover, the black fade, the end shade, the dying light - before the end shade
 *        that every death has from 3.12 s, never darker than the Hound's (+0.1 cover).  No page error.
 *   t6   deception in three real pages: a victim killed through the SKIN tab's preview while the others are far off, the world at x2 while
 *        it feeds - the snapshot then carries the look it wears; a speaker hidden behind a wall near it says a line through the chat's
 *        composer (the admin overlay shows a count, never the words); the listener steps into its sight: in the skin it walks up, stares
 *        and repeats the line as an entity (a bubble keyed e + id, "A voice nearby says: ..."); the skin drawn as a wanderer with nothing
 *        in its hands, no name, in no list of players; the mute rules in the page (a muted person's echo is silent; the unknown voice
 *        has its own entry).  No page error.
 *   t7   integration: a room with the skin AND the world's own Hound and Smiler; a desktop page and a phone held sideways (touch) with
 *        different chat and voice settings; a page in another room; its line reaches both pages of its room each as set (the phone:
 *        voices off, written at once), the other room nothing; the phone disconnects mid-encounter and the rest goes on; the admin's
 *        world reset leaves no creature, skin, bubble or ss list, and the SKIN tab counts 0.  No page error.
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
      if (m.t === 'eheard') window.__k3.eh = (window.__k3.eh | 0) + 1;   // (an entity's line as it arrives, before chat.js sees it)
      if (m.t === 's' && m.e) { window.__k3.snaps++; window.__k3.ss = m.e.ss || null; window.__k3.keys = Object.keys(m.e).join(','); window.__k3.hm = [Array.isArray(m.e.h) ? m.e.h.length : 0, Array.isArray(m.e.m) ? m.e.m.length : 0]; } } catch (x) { } }); }
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
async function runPage(b, port, room, vp, name, extra) {
  const ctx = await b.newContext(Object.assign({ viewport: vp }, extra || {})); await ctx.addInitScript(INIT);   // (extra: a phone's isMobile / hasTouch)
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
      check('t1_script_loaded', T.script.skin === 'object' && T.script.fns === 'attack,attacker,clear,deathEvent,deathSound,draw,mirror,where', JSON.stringify(T.script));
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
    if (want('t5')) {
      // its presentation: every act it can show, and its three deaths mid-way, laid out round a lamp-lit spot (the page's own drawing,
      // light and sight mask: synthetic entries are added to the server's list here only, by wrapping the script's mirror in this page);
      // at 1280x720, 1920x1080 and a phone held sideways; BR-RoLE's three quality tiers; its shadow as a BR-RoLE actor
      const T = R.sections.t5 = {}, shots = [];
      const { ctx, P, errs, cmd } = await runPage(b, port, 'k3t5' + (Date.now() % 1e6), { width: 1280, height: 720 }, 'K3Gallery');
      cmd({ c: 'freeze', on: true }); cmd({ c: 'god', id: await P.evaluate(() => __api.H.id) }); await sleep(500);
      // a lit, open spot: the brightest open floor near a lamp (the level's own lamps), the player in the middle of it
      T.spot = await P.evaluate(() => { const A = __api, L = A.lamps || [], H = A.H; let best = null, bd = 1e9;
        for (const l of L) for (const oy of [120, -120]) { const x = l.x, y = l.y + oy, d = Math.hypot(x - H.x, y - H.y); if (d < bd && A.sl(x, y, 150) && A.sl(x - 240, y, 30) && A.sl(x + 240, y, 30) && A.sl(x, y + 210, 30)) { bd = d; best = { x, y }; } }
        if (best) { A.tp(best.x, best.y); A.H.angle = -Math.PI / 2; } return best; });
      await sleep(1500);
      const ACTS = ['', 'watch', 'back', 'leave', 'wait', 'lure', 'intercept', 'search', 'listen', 'approach', 'creep', 'chase', 'wind', 'pounce', 'recover', 'feed'];
      const GAL = ['', 'watch', 'creep', 'chase', 'wind', 'pounce', 'recover', 'feed'];   // (8: the page mirrors at most 8 - skin.mirror.js MAX; lure and listen are watch's pose)
      await P.evaluate(({ GAL, ACTS }) => {
        const K = window.__skin, m = K.mirror, H = __api.H; window.__k3.fake = [];
        GAL.forEach((ac, k) => { const col = k % 4, row = Math.floor(k / 4); window.__k3.fake.push({ i: 9000 + k, x: H.x + [-270, -140, 140, 270][col], y: H.y - 90 + row * 150, a: -Math.PI / 2, s: ac === 'feed' ? 11 : 1, ac: ACTS.indexOf(ac), v: 0, h: 0 }); });
        K.mirror = (list, dt) => m((list || []).concat(window.__k3.fake), dt);
        // its kill's attacker, the three deaths at the snap (A, B) and at the second bite (C)
        const L = __api.layer(); window.__k3.kills = [];
        for (const [i, v, t] of [[0, 'A', .62], [1, 'B', .95], [2, 'C', 1.0]]) {
          const a = K.attacker(), x = H.x - 120 + i * 120, y = H.y + 210, jl = { variant: v, elapsed: t, impact: 1, ph: { snapped: v === 'C' ? undefined : t - .04 }, attacker: { x, y } };
          L.addChild(a); a.position.set(x, y); a.rotation = 0; a.attackPose(1, 1, v, jl); window.__k3.kills.push(a);
        }
      }, { GAL, ACTS });
      await sleep(1200);
      T.views = await P.evaluate(() => __api.layer().children.filter(c => c.__skin && c.visible).length);
      T.actors = await P.evaluate(() => { const B = window.__brRole; const a = B && B.actors ? B.actors() : null; return a ? a.filter(j => j.kind === 'skin').length : null; });
      for (const q of ['low', 'medium', 'high']) {
        await P.evaluate(q => window.__brRole && window.__brRole.setQuality(q), q); await sleep(900);
        if (SHOTS) { const f = `t5_gallery_${q}_1280.png`; await P.screenshot({ path: path.join(SHOTS, f) }); shots.push(f); }
      }
      await P.evaluate(() => window.__brRole && window.__brRole.setQuality('medium'));
      for (const [w, h, tag] of [[1920, 1080, '1920'], [844, 390, 'phone']]) {
        await P.setViewportSize({ width: w, height: h }); await sleep(1200);
        if (SHOTS) { const f = `t5_gallery_medium_${tag}.png`; await P.screenshot({ path: path.join(SHOTS, f) }); shots.push(f); }
      }
      // its living sounds (skin.audio.js, lent to the body's draw): the noise sources it starts (its one-second mono noise buffer) while
      // every figure stands still, then while one walks past at 150 px/s and springs (wind-up, leap): footfalls and cues, none when still
      T.sound = await P.evaluate(async () => { const st = AudioBufferSourceNode.prototype.start; let n = 0;
        AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.numberOfChannels === 1 && this.buffer.length === this.context.sampleRate) n++; return st.apply(this, a); };
        const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
        const fe = window.__k3.fake.find(q => q.s === 11); fe.ac = 1;                       // (the feeding figure is heard eating: it watches for this count)
        await wait(600); n = 0; await wait(3000); out.still = n; n = 0;
        const f = window.__k3.fake[3], x0 = f.x, t0 = performance.now(), iv = setInterval(() => { f.x = x0 + .15 * (performance.now() - t0); }, 30); await wait(3000); clearInterval(iv); out.walk = n; out.walked = Math.round(f.x - x0); n = 0; f.x = x0;
        await wait(400); n = 0; f.ac = 12; await wait(700); f.ac = 13; await wait(700); out.spring = n;
        AudioBufferSourceNode.prototype.start = st; fe.ac = 15; return out; });
      // the admin DEBUG overlay with a real Skin-Stealer near: its own block (hunger, stamina, plan and why), drawn by ents.js's overlay
      await P.setViewportSize({ width: 1280, height: 720 }); await P.evaluate(() => { window.__k3.fake = []; window.__k3.kills.forEach(a => a.parent && a.parent.removeChild(a)); });
      cmd({ c: 'near', k: 'skinstealer' }); await until(P, () => window.__k3.ss && window.__k3.ss.length, null, 8000);
      cmd({ c: 'debug', on: true });
      await P.evaluate(() => { const E = window.__ents; window.__k3.dbg = []; const f = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) { if (/^(HUNGER|WHY|with P|GUESS|record)/.test(String(t)) && window.__k3.dbg.length < 40) window.__k3.dbg.push(String(t)); return f.call(this, t, x, y, w); };
        Object.assign(E.dbgCfg, { on: true, ai: true }); });
      await sleep(2000);
      T.debug = await P.evaluate(() => [...new Set(window.__k3.dbg)].slice(0, 8));
      if (SHOTS) { await P.screenshot({ path: path.join(SHOTS, 't5_debug_overlay_1280.png') }); shots.push('t5_debug_overlay_1280.png'); }
      T.shots = shots; T.errors = errs;
      check('t5_debug_block', T.debug.some(l => /^HUNGER [\d.]+ [a-z ]+  STAMINA \d+/.test(l)) && T.debug.some(l => /^WHY /.test(l)), JSON.stringify(T.debug));
      check('t5_living_sounds', T.sound && T.sound.still === 0 && T.sound.walk >= 8 && T.sound.spring >= 3, JSON.stringify(T.sound) + ' (noise sources started: all standing still, one walking 3 s at 150 px/s, its wind-up and leap; two per footfall)');
      check('t5_gallery_drawn', T.views >= 11, `${T.views} Skin-Stealer views on screen (8 acts, 3 kill attackers)`);
      check('t5_brrole_actor', T.actors === null || T.actors >= 1, `BR-RoLE actor jobs of kind skin: ${T.actors}`);
      check('t5_no_page_errors', !errs.length, JSON.stringify(errs));
      await ctx.close();
    }
    if (want('t5d')) {
      // the victim's own view of its death, against a Hound's at the same lamp-lit spot, in the same page, at the same moments (1 s and
      // 2.5 s in): its death must not hide the screen any more than the Hound's does (only the Smiler's deaths black out)
      const T = R.sections.t5d = {}, room = 'k3t5d' + (Date.now() % 1e6), VP = { width: 1280, height: 720 };
      const V = await runPage(b, port, room, VP, 'K3Seen'), S = await runPage(b, port, room, VP, 'K3Keep');
      const vid = await V.P.evaluate(() => __api.H.id);
      V.cmd({ c: 'freeze', on: true }); await sleep(300);
      const SPOT = () => { const A = __api, L = A.lamps || [], H = A.H; let best = window.__k3.spot || null, bd = 1e9;
        if (!best) for (const l of L) for (const oy of [120, -120]) { const x = l.x, y = l.y + oy, d = Math.hypot(x - H.x, y - H.y); if (d < bd && A.sl(x, y, 150)) { bd = d; best = { x, y }; } }
        if (best) { window.__k3.spot = best; A.tp(best.x, best.y); A.H.angle = -Math.PI / 2; } return best; };
      T.spot = await V.P.evaluate(SPOT); await sleep(1200);
      S.cmd({ c: 'goto', id: vid }); await sleep(1500);                                     // (a living spectator keeps the room's world)
      await S.P.evaluate(() => { const A = __api, H = A.H, x0 = H.x, y0 = H.y;
        for (const r of [260, 220, 300]) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r; if (A.sl(x, y, 20)) { A.tp(x, y); return; } } });
      await sleep(800);
      // measured inside the page, frame by frame, at the same moments of each death (a software-rendered screenshot takes seconds, so
      // screenshots cannot be taken at a given moment): how much of the screen the darkness overlay (#light) covers, the death plan's
      // black fade, the death's end shade, the dying light's power
      const SAMPLE = () => new Promise(res => { const out = [], marks = [.5, 1, 2, 3], c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d', { willReadFrequently: true });
        const step = () => { const D = __api.death(); if (!D || !D.active) return res(out);
          while (marks.length && D.elapsed >= marks[0]) { const at = marks.shift(); x.clearRect(0, 0, 64, 36); x.drawImage(document.getElementById('light'), 0, 0, 64, 36); const d = x.getImageData(0, 0, 64, 36).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i];
            out.push({ at, el: +D.elapsed.toFixed(2), dark: +(a / (d.length / 4) / 255).toFixed(3), black: +(+D.black || 0).toFixed(3), shade: +(+D.shade || 0).toFixed(3), light: window.__deathLight ? +window.__deathLight.own().toFixed(2) : null }); }
          if (!marks.length) return res(out); requestAnimationFrame(step); };
        step(); });
      for (const k of ['hound', 'skinstealer']) {
        const r = T[k] = {};
        V.cmd({ c: 'preview', k, var: 'B' });
        r.own = await until(V.P, () => { const D = __api.death(); return D && D.active ? { kind: D.kind, v: D.variant, dur: D.duration } : null; }, null, 6000, 10);
        r.at = await V.P.evaluate(`(${SAMPLE})()`);
        await until(V.P, () => !(__api.death() && __api.death().active), null, 9000);
        S.cmd({ c: 'revive', id: vid }); await sleep(1800);
        await V.P.evaluate(SPOT); await sleep(1200);
      }
      T.errors = { victim: V.errs, spectator: S.errs };
      const H = T.hound, Ks = T.skinstealer, ok = H.own && Ks.own && H.at.length === 4 && Ks.at.length === 4 && Ks.at.slice(0, 3).every((q, i) => q.dark <= H.at[i].dark + .1 && q.black <= H.at[i].black + .01);   // (3 s: past the start of every death's end shade, 3.12 s - the Skin-Stealer's deaths are shorter)
      check('t5_own_death_view', ok && Ks.own.kind === 'SkinStealer' && H.own.kind === 'Hound', JSON.stringify({ hound: H, skinstealer: Ks }));
      check('t5d_no_page_errors', !V.errs.length && !S.errs.length, JSON.stringify(T.errors));
      await V.ctx.close(); await S.ctx.close();
    }
    if (want('t6')) {
      // deception in real pages, the real server and its real AI.  A victim is killed (the SKIN tab's preview) while the two others are
      // far off; the world runs at x2 while it feeds, so its meal is short; the skin it then wears reaches the pages as a wanderer's look.
      // With the world frozen, a speaker hidden behind a wall within 576 px of it says a line (the chat's own composer) - it keeps it
      // (the admin overlay's counts, never the words); the listener beside the speaker hears the speaker too.  The speaker leaves; the
      // listener steps into its sight, light on; the world runs: in the skin it walks up, stares and repeats that line as an entity
      // ({t:'eheard'}): on the listener's page a bubble where it is drawn, the entity voice, "A voice nearby says: ..."; the skin drawn as
      // a wanderer with nothing in its hands, no name, in no list of players.  The mute rules, in the page: the echo of a muted person's
      // words is silent; the unknown voice has its own entry.
      const T = R.sections.t6 = {}, room = 'k3t6' + (Date.now() % 1e6), VP = { width: 1280, height: 720 };
      // (the world frozen and emptied of Hounds and Smilers as soon as the first page is in: they would take somebody meanwhile)
      const V = await runPage(b, port, room, VP, 'K3Prey');
      V.cmd({ c: 'freeze', on: true }); V.cmd({ c: 'hounds', mode: 'remove', n: 10 }); V.cmd({ c: 'smilers', mode: 'remove', n: 10 });
      const S = await runPage(b, port, room, VP, 'K3Speaker'), L = await runPage(b, port, room, VP, 'K3Listener');
      const ids = { v: await V.P.evaluate(() => __api.H.id), s: await S.P.evaluate(() => __api.H.id), l: await L.P.evaluate(() => __api.H.id) };
      const AWAY = (from, r0, k) => { const A = __api; for (const r of [r0, r0 - 400, r0 + 400]) for (let i = 0; i < 32; i++) { const a = (i + k * .5) / 32 * Math.PI * 2, x = from.x + Math.cos(a) * r, y = from.y + Math.sin(a) * r; if (A.sl(x, y, 30)) { A.tp(x, y); return { x: Math.round(x), y: Math.round(y) }; } } return null; };
      const ssOf = P => P.evaluate(() => (window.__k3.ss || [])[0] || null);
      // the two others in god mode (no creature perceives them) until the listener's moment
      V.cmd({ c: 'hounds', mode: 'remove', n: 10 }); V.cmd({ c: 'smilers', mode: 'remove', n: 10 }); V.cmd({ c: 'god', id: ids.s }); V.cmd({ c: 'god', id: ids.l }); await sleep(300);
      T.alive = await V.P.evaluate(() => !(__api.death() && __api.death().active));
      const vpos = await V.P.evaluate(() => ({ x: __api.H.x, y: __api.H.y }));
      T.away = [await S.P.evaluate(`(${AWAY})(${JSON.stringify(vpos)}, 2600, 0)`), await L.P.evaluate(`(${AWAY})(${JSON.stringify(vpos)}, 2600, 1)`)];
      await sleep(1200);
      V.cmd({ c: 'near', k: 'skinstealer' });
      T.eid = await until(L.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0].i : null, null, 8000);
      V.cmd({ c: 'preview', k: 'skinstealer', var: 'B' });
      T.kill = await until(V.P, () => { const D = __api.death(); return D && D.active ? { kind: D.kind, v: D.variant } : null; }, null, 6000, 20);
      V.cmd({ c: 'freeze', on: false }); V.cmd({ c: 'speed', v: 2 });
      T.dg = await until(L.P, () => { const t = (window.__k3.ss || [])[0]; return t && t.dg ? t.dg : null; }, null, 45000, 100);
      V.cmd({ c: 'speed', v: 1 }); V.cmd({ c: 'freeze', on: true }); await sleep(600);
      // the speaker: hidden behind a wall 250-540 px from it (speech goes through walls: the radius is the rule); the listener beside them
      const K0 = await ssOf(L.P); T.k0 = K0 && { x: Math.round(K0.x), y: Math.round(K0.y), a: +(+K0.a || 0).toFixed(3) };
      T.sAt = await S.P.evaluate(k => { const A = __api; for (const r of [420, 340, 500, 260, 540]) for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
        if (A.sl(x, y, 26) && A.Uc(k.x, k.y, a, r) < r - 40) { A.tp(x, y); return { x: Math.round(x), y: Math.round(y), r }; } } return null; }, T.k0);
      await sleep(400);
      T.lAt = T.sAt && await L.P.evaluate(([s, k]) => { const A = __api; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, x = s.x + Math.cos(a) * 90, y = s.y + Math.sin(a) * 90, d = Math.hypot(x - k.x, y - k.y);
        if (A.sl(x, y, 26) && A.Uc(k.x, k.y, Math.atan2(y - k.y, x - k.x), d) < d - 40) { A.tp(x, y); return { x: Math.round(x), y: Math.round(y) }; } } return null; }, [T.sAt, T.k0]);
      await sleep(1500);
      T.sState = await S.P.evaluate(() => { const A = __api, vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden); }; return { started: A.started(), paused: A.paused(), caught: !!(A.G && A.G.caught), on: !!(window.__net && __net.on), dlg: ['dialog', 'caught', 'won', 'runMenu', 'appearancePanel', 'menu', 'adminPanel'].filter(vis), sheets: [...document.getElementsByClassName('ui-sheet')].filter(e => !e.hidden).map(e => e.id), open: window.__chat.open() }; });
      await S.P.fill('#sayText', 'The Exit Is This Way'); await S.P.keyboard.press('Enter');
      T.lHeardSpeaker = !!(await until(L.P, () => window.__chat.state().nearby.heard > 0, null, 6000));
      S.cmd({ c: 'debug', on: true });
      T.dbg = await until(S.P, eid => { const d = (window.__ents.dbg || []).find(x => x.i === eid && x.sk); return d ? { hd: d.sk.hd, dg: d.sk.dg, words: /exit/i.test(JSON.stringify(d)) } : null; }, T.eid, 10000, 200);
      S.cmd({ c: 'debug', on: false });
      // the speaker leaves; the listener steps into its sight - 260-500 px off (380 first), within 1.18 rad of where it looks (its field of view is 2.5 rad), facing it, light on
      await S.P.evaluate(`(${AWAY})(${JSON.stringify(T.k0)}, 2600, 2)`);
      T.lAt2 = await L.P.evaluate(k => { const A = __api; for (const r of [380, 320, 440, 260, 500]) for (let i = 0; i < 19; i++) { const a = (+k.a || 0) + (i % 2 ? 1 : -1) * Math.ceil(i / 2) / 48 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
        if (A.sl(x, y, 26) && A.Uc(k.x, k.y, a, r) >= r - 4) { A.tp(x, y); A.H.angle = Math.atan2(k.y - y, k.x - x); return { x: Math.round(x), y: Math.round(y), r, off: +(a - (+k.a || 0)).toFixed(2) }; } } return null; }, T.k0);
      V.cmd({ c: 'god', id: ids.l }); await sleep(800);                                       // (the listener is a person again: it can be seen)
      await aimAt(L.P); if (!(await L.P.evaluate(() => __api.lightOn()))) await L.P.keyboard.press('KeyF');
      await L.P.evaluate(() => { window.__k3.live = []; window.__k3.liveObs = setInterval(() => { const r = document.getElementById('chatLive'); if (r && r.textContent && window.__k3.live[window.__k3.live.length - 1] !== r.textContent) window.__k3.live.push(r.textContent); }, 50); });
      V.cmd({ c: 'freeze', on: false });
      L.cmd({ c: 'debug', on: true }); T.trace = [];   // (its decisions once a second, from the admin overlay data: distance, act, plan, why, its last line, hunger - kept in the report)
      const tr = setInterval(async () => { try { T.trace.push(await L.P.evaluate(eid => { const d = (window.__ents.dbg || []).find(x => x.i === eid), H = __api.H; return d ? [Math.round(Math.hypot(d.x - H.x, d.y - H.y)), d.ac, d.sk && d.sk.pl, d.sk && d.sk.why, d.sk && d.sk.sd, d.sk && d.sk.hu] : null; }, T.eid)); } catch (e) { } }, 1000);
      T.eheard = await until(L.P, () => { const N = window.__chat.state().nearby, x = N.bubbles.find(q => typeof q.id === 'string' && q.id[0] === 'e'); return x ? { id: x.id, mode: x.mode, of: x.of } : null; }, null, 30000, 100);
      clearInterval(tr); L.cmd({ c: 'debug', on: false });
      await sleep(400);
      T.drawn = await L.P.evaluate(() => { const L0 = __api.layer(), av = L0.children.find(c => /^skinstealer-skin#/.test(c.label || '')), v = L0.children.find(c => c.__skin && c.__id);
        return { avatar: !!av, avVisible: !!(av && av.visible), gear: av && av.gear ? av.gear.visible : null, hands: av && av.hands ? av.hands.map(h => [Math.round(h.x), Math.round(h.y)]) : null, creatureVisible: !!(v && v.visible), peers: window.__net && __net.peerScreen ? __net.peerScreen().map(q => q.n).sort().join(',') : null }; });
      if (SHOTS) await L.P.screenshot({ path: path.join(SHOTS, 't6_disguise_speaks_1280.png') });
      T.live = await L.P.evaluate(() => { clearInterval(window.__k3.liveObs); return window.__k3.live.slice(-4); });
      T.voice = await L.P.evaluate(() => window.__voice && window.__voice.stats ? window.__voice.stats() : null);
      V.cmd({ c: 'freeze', on: true });
      // the mute rules, in the page (the server's side: chat_server.js unit_entity)
      T.mute = await L.P.evaluate(([sid, eid]) => {
        const C = window.__chat, shown = () => C.state().nearby.shown, n0 = shown();
        C.open(); const more = document.querySelector('#sayBox .say-more'); if (more && more.getAttribute('aria-expanded') !== 'true') more.click();
        const sb = document.querySelector(`#sayBox [data-mute="${sid}"]`); if (sb) sb.click();
        C.net({ t: 'eheard', e: eid, text: 'echo of a muted person', seq: 1e9, v: { h: 0, s: 90 }, o: sid }); const n1 = shown();
        C.net({ t: 'eheard', e: eid, text: 'a generic call', seq: 1e9 + 1, v: { h: 0, s: 90 }, o: 0 }); const n2 = shown();
        const eb = document.querySelector(`#sayBox [data-mute="e${eid}"]`), label = eb ? eb.textContent : null; if (eb) eb.click();
        C.net({ t: 'eheard', e: eid, text: 'after its own mute', seq: 1e9 + 2, v: { h: 0, s: 90 }, o: 0 }); const n3 = shown();
        for (const k of [String(sid), 'e' + eid]) { const x = document.querySelector(`#sayBox [data-mute="${k}"]`); if (x && x.getAttribute('aria-pressed') === 'true') x.click(); }
        return { speakerButton: !!sb, echoOfMutedSilent: n1 === n0, genericShown: n2 === n1 + 1, entityLabel: label, entityMuteSilent: n3 === n2 };
      }, [ids.s, T.eid]);
      T.errors = { victim: V.errs, speaker: S.errs, listener: L.errs };
      check('t6_skin_earned', T.kill && T.kill.kind === 'SkinStealer' && typeof T.dg === 'string' && /^[a-z]+\|[a-z]+\|#[0-9a-fA-F]{6}\|#[0-9a-fA-F]{6}$/.test(T.dg), JSON.stringify({ kill: T.kill, dg: T.dg }));
      check('t6_heard_counts_only', T.sAt && T.lHeardSpeaker && T.dbg && Array.isArray(T.dbg.hd) && T.dbg.hd.length >= 1 && !T.dbg.words && T.dbg.dg && T.dbg.dg.from === ids.v, JSON.stringify({ sAt: T.sAt, lAt: T.lAt, lHeard: T.lHeardSpeaker, dbg: T.dbg }));
      check('t6_entity_line', T.eheard && T.eheard.id === 'e' + T.eid && T.live.some(l => /^A voice nearby says: the exit is this/.test(l)), JSON.stringify({ eheard: T.eheard, live: T.live, voice: T.voice }));
      check('t6_disguise_drawn', T.drawn.avatar && T.drawn.avVisible && T.drawn.gear === false && !T.drawn.creatureVisible && T.drawn.peers === 'K3Prey,K3Speaker', JSON.stringify(T.drawn));
      check('t6_mutes', T.mute.speakerButton && T.mute.echoOfMutedSilent && T.mute.genericShown && /unknown voice/i.test(T.mute.entityLabel || '') && T.mute.entityMuteSilent, JSON.stringify(T.mute));
      check('t6_no_page_errors', !V.errs.length && !S.errs.length && !L.errs.length, JSON.stringify(T.errors));
      await V.ctx.close(); await S.ctx.close(); await L.ctx.close();
    }
    if (want('t7')) {
      // integration: one room with a Skin-Stealer in a borrowed skin AND the world's own Hound and Smiler; a desktop page and a phone held
      // sideways (touch) with different chat and voice settings (the phone: voices off, speech written out at once); a page in another
      // room; the Skin-Stealer earns its skin (the SKIN tab's preview on a third page, the world at x2 while it feeds), the desktop
      // player steps into its sight and it speaks: both pages in its room get its line, each as its settings say, the other room
      // nothing; the phone page disconnects mid-encounter; an admin world reset ends everything (no creature, no skin, no bubble, no ss
      // list) and the SKIN tab counts 0.  No page error anywhere.
      const T = R.sections.t7 = {}, room = 'k3t7' + (Date.now() % 1e6), room2 = 'k3t7x' + (Date.now() % 1e6), VP = { width: 1280, height: 720 };
      const V = await runPage(b, port, room, VP, 'K3Prey7');
      V.cmd({ c: 'freeze', on: true });
      const A = await runPage(b, port, room, VP, 'K3Desk'), M = await runPage(b, port, room, { width: 844, height: 390 }, 'K3Phone', { isMobile: true, hasTouch: true }), X = await runPage(b, port, room2, VP, 'K3Elsewhere');
      const ids = { v: await V.P.evaluate(() => __api.H.id), a: await A.P.evaluate(() => __api.H.id), m: await M.P.evaluate(() => __api.H.id) };
      V.cmd({ c: 'god', id: ids.a }); V.cmd({ c: 'god', id: ids.m }); await sleep(300);
      // the world's own monsters stay; at least one Hound and one Smiler
      const inf0 = await until(V.P, () => { const k = window.__k3; return k.snaps > 3 ? { keys: k.keys } : null; }, null, 8000);
      V.cmd({ c: 'hounds', n: 1 }); V.cmd({ c: 'smilers', n: 1 }); await sleep(800);
      const AWAY = (from, r0, k) => { const Z = __api; for (const r of [r0, r0 - 400, r0 + 400]) for (let i = 0; i < 32; i++) { const a = (i + k * .5) / 32 * Math.PI * 2, x = from.x + Math.cos(a) * r, y = from.y + Math.sin(a) * r; if (Z.sl(x, y, 30)) { Z.tp(x, y); return { x: Math.round(x), y: Math.round(y) }; } } return null; };
      const vpos = await V.P.evaluate(() => ({ x: __api.H.x, y: __api.H.y }));
      await A.P.evaluate(`(${AWAY})(${JSON.stringify(vpos)}, 2600, 0)`); await M.P.evaluate(`(${AWAY})(${JSON.stringify(vpos)}, 2600, 1)`);
      await M.P.evaluate(() => { if (window.__voice) window.__voice.set({ on: false }); window.__chat.pref('type', false); });
      await sleep(1000);
      V.cmd({ c: 'near', k: 'skinstealer' });
      T.eid = await until(A.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0].i : null, null, 8000);
      V.cmd({ c: 'preview', k: 'skinstealer', var: 'A' });
      T.kill = await until(V.P, () => { const D = __api.death(); return D && D.active ? { kind: D.kind, v: D.variant } : null; }, null, 6000, 20);
      V.cmd({ c: 'freeze', on: false }); V.cmd({ c: 'speed', v: 2 });
      T.dg = await until(A.P, () => { const t = (window.__k3.ss || [])[0]; return t && t.dg ? t.dg : null; }, null, 45000, 100);
      V.cmd({ c: 'speed', v: 1 }); V.cmd({ c: 'freeze', on: true }); await sleep(600);
      T.lists = await A.P.evaluate(() => { const k = window.__k3; return { keys: k.keys, ss: (k.ss || []).length, hounds: k.hm[0], smilers: k.hm[1] }; });
      T.monsters = await V.P.evaluate(() => { const s = window.__k3; return s.keys; });
      // the desktop: into its sight - 260-500 px off, within 1.18 rad of where it looks - light on, a person again (after the phone is placed beside it)
      const K0 = await A.P.evaluate(() => (window.__k3.ss || [])[0]);
      T.aAt = await A.P.evaluate(k => { const Z = __api; for (const r of [380, 320, 440, 260, 500]) for (let i = 0; i < 19; i++) { const a = (+k.a || 0) + (i % 2 ? 1 : -1) * Math.ceil(i / 2) / 48 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r; if (Z.sl(x, y, 26) && Z.Uc(k.x, k.y, a, r) >= r - 4) { Z.tp(x, y); Z.H.angle = Math.atan2(k.y - y, k.x - x); return { x: Math.round(x), y: Math.round(y), r, off: +(a - (+k.a || 0)).toFixed(2) }; } } return null; }, K0);
      // the phone beside the desktop player (god: unperceived), 110-200 px off, so both are within 576 px wherever it stops to stare
      T.mAt = await M.P.evaluate(([a, k]) => { const Z = __api; for (const r of [140, 110, 170, 200]) for (let i = 0; i < 32; i++) { const t = i / 32 * Math.PI * 2, x = a.x + Math.cos(t) * r, y = a.y + Math.sin(t) * r; if (Z.sl(x, y, 26) && Math.hypot(x - k.x, y - k.y) <= 520) { Z.tp(x, y); Z.H.angle = Math.atan2(k.y - y, k.x - x); return { x: Math.round(x), y: Math.round(y) }; } } return null; }, [T.aAt, K0]);
      V.cmd({ c: 'god', id: ids.a }); await sleep(800);
      T.k1 = await A.P.evaluate(() => { const t = (window.__k3.ss || [])[0]; return t ? [Math.round(t.x), Math.round(t.y), Math.round(Math.hypot(t.x - __api.H.x, t.y - __api.H.y))] : null; });
      if (!(await A.P.evaluate(() => __api.lightOn()))) await A.P.keyboard.press('KeyF');
      const v0 = { a: await A.P.evaluate(() => window.__voice.stats().said), m: await M.P.evaluate(() => window.__voice.stats().said) };
      V.cmd({ c: 'freeze', on: false });
      A.cmd({ c: 'debug', on: true }); T.trace = [];   // (its decisions once a second from the admin overlay data, and whether the desktop player is alive - kept in the report)
      const tr7 = setInterval(async () => { try { T.trace.push(await A.P.evaluate(eid => { const d = (window.__ents.dbg || []).find(x => x.i === eid), H = __api.H, D = __api.death(); return [d ? Math.round(Math.hypot(d.x - H.x, d.y - H.y)) : null, [Math.round(H.x), Math.round(H.y)], d ? [d.x, d.y] : null, d && d.ac, d && d.sk && d.sk.pl, d && d.sk && d.sk.why, d && d.sk && d.sk.hu, D && D.active ? 'dead:' + D.kind : 'alive']; }, T.eid)); } catch (e) { } }, 1000);
      T.aLine = await until(A.P, () => { const N = window.__chat.state().nearby, x = N.bubbles.find(q => typeof q.id === 'string' && q.id[0] === 'e'); return x ? { id: x.id, shown: x.shown, of: x.of } : null; }, null, 30000, 100);
      T.mLine = await until(M.P, () => { const N = window.__chat.state().nearby, x = N.bubbles.find(q => typeof q.id === 'string' && q.id[0] === 'e'); return x ? { id: x.id, shown: x.shown, of: x.of } : null; }, null, 5000, 100);   // (the phone's page gets the same packet; its own page may handle it a moment later)
      T.eh = { a: await A.P.evaluate(() => window.__k3.eh | 0), m: await M.P.evaluate(() => window.__k3.eh | 0) }; clearInterval(tr7); A.cmd({ c: 'debug', on: false });
      T.voices = { a: (await A.P.evaluate(() => window.__voice.stats().said)) - v0.a, m: (await M.P.evaluate(() => window.__voice.stats().said)) - v0.m };
      T.mSkin = await M.P.evaluate(() => { const L0 = __api.layer(); return L0.children.some(c => /^skinstealer-skin#/.test(c.label || '') && c.visible) || L0.children.some(c => /^skinstealer-skin#/.test(c.label || '')); });
      if (SHOTS) await Promise.all([A.P.screenshot({ path: path.join(SHOTS, 't7_desktop_1280.png') }), M.P.screenshot({ path: path.join(SHOTS, 't7_phone_844x390.png') })]);
      T.other = await X.P.evaluate(() => ({ heard: window.__chat.state().nearby.heard, ss: window.__k3.ss, keys: window.__k3.keys, views: __api.layer().children.filter(c => c.__skin).length }));
      // the phone disconnects mid-encounter; the encounter and the other pages go on
      await M.ctx.close(); await sleep(2500);
      T.afterPhone = await A.P.evaluate(() => ({ ss: (window.__k3.ss || []).length, snaps: window.__k3.snaps }));
      // the admin's world reset: nothing of it is left on the desktop page
      V.cmd({ c: 'world' }); await until(A.P, () => !window.__k3.ss, null, 8000); await sleep(1500);
      T.afterReset = await A.P.evaluate(() => { const L0 = __api.layer(); return { ss: window.__k3.ss, skinViews: L0.children.filter(c => c.__skin).length, skins: L0.children.filter(c => /^skinstealer-skin#/.test(c.label || '')).length, bubbles: window.__chat.state().nearby.bubbles.filter(q => typeof q.id === 'string').length, keys: window.__k3.keys }; });
      await V.P.keyboard.press('Backquote'); await sleep(300);
      if (await V.P.evaluate(() => !document.getElementById('admLogin').hidden)) { await V.P.fill('#admPass', PASS); await V.P.click('#adminPanel [data-a="unlock"]'); await V.P.waitForSelector('#admMain', { state: 'visible', timeout: 8000 }); }
      await V.P.keyboard.press('KeyK'); await sleep(300); await V.P.click('#adminPanel [data-a="tab"][data-t="skin"]'); await sleep(1500);
      T.tab = await V.P.evaluate(() => document.getElementById('admBody').textContent.slice(0, 60));
      T.errors = { victim: V.errs, desktop: A.errs, phone: M.errs, other: X.errs };
      check('t7_world_has_all_three', T.dg && T.lists.hounds >= 1 && T.lists.smilers >= 1 && T.lists.ss === 1, JSON.stringify({ dg: T.dg, lists: T.lists, kill: T.kill }));   // (the snapshot's own Hound and Smiler lists, not only their keys)
      check('t7_line_each_as_set', T.aLine && T.aLine.id === 'e' + T.eid && T.mLine && T.mLine.id === T.aLine.id && T.mLine.shown === T.mLine.of && T.voices.a >= 1 && T.voices.m === 0, JSON.stringify({ a: T.aLine, m: T.mLine, voices: T.voices, eheard: T.eh, mAt: T.mAt, aAt: T.aAt, k0: K0 && [Math.round(K0.x), Math.round(K0.y), +(+K0.a || 0).toFixed(2)], k1: T.k1, trace: T.trace.slice(0, 8) }));
      check('t7_phone_draws_the_skin', T.mSkin, String(T.mSkin));
      check('t7_other_room_nothing', T.other.heard === 0 && !T.other.ss && T.other.views === 0 && !/(^|,)ss(,|$)/.test(T.other.keys), JSON.stringify(T.other));
      check('t7_disconnect_goes_on', T.afterPhone.ss === 1, JSON.stringify(T.afterPhone));
      check('t7_world_reset_clears', !T.afterReset.ss && T.afterReset.skinViews === 0 && T.afterReset.skins === 0 && T.afterReset.bubbles === 0 && /SKIN-STEALER · 0 IN THE HALLS/.test(T.tab), JSON.stringify({ reset: T.afterReset, tab: T.tab }));
      check('t7_no_page_errors', !V.errs.length && !A.errs.length && !M.errs.length && !X.errs.length, JSON.stringify(T.errors));
      await V.ctx.close(); await A.ctx.close(); await X.ctx.close();
    }
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
  R.cases = cases; R.ok = cases.length > 0 && cases.every(c => c.ok);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name} - ${c.detail}`);
  console.log(`SKIN BROWSER: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  if (ARG.check && !R.ok) process.exitCode = 1;
})();
