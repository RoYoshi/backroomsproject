#!/usr/bin/env node
/* dev/tools/checks/chat_browser.js - post-3H Trial 2: the chats in real pages (development only; docs/architecture/CHAT.md).
 *
 *   node dev/tools/checks/chat_browser.js [--out FILE.json] [--shots DIR] [--only NAME,NAME] [--mutants 1] [--work DIR] [--tree DIR] [--quiet]
 *
 * One server (`node server.js PORT` in --tree, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader),
 * several pages, each through the boot gate as a player would (a key or a tap).  Every text is synthetic; the report holds no text.
 *   lounge_*   two menus in two different rooms share the lounge; a line typed and sent with Enter arrives as the same literal text
 *              (a markup payload stays text, nothing runs); typing in the lounge reaches neither the game nor the menu (no held key,
 *              no entry opened); a sender muted from its name disappears and stays silent until unmuted; folding (wide) and turning
 *              the lounge off (its socket closes); on a phone the utility button opens it over the menu and Esc puts it away, focus
 *              back on the button; a page that enters a run closes its lounge socket and receives nothing more of it.
 *   nearby_*   two players in one room (and a third in another room): Enter opens the composer only in the run, every held key is
 *              let go, typing walks nobody, Esc closes it without pausing; a line shows as a bubble over the speaker on both screens,
 *              as literal text (once written out: post-Trial 4 chat polish C3), and is gone within its life (a short line about 3 s); a listener moved off screen (but within 576 px) gets an edge hint pointing
 *              the right way, one moved beyond the radius gets nothing, the other room nothing; hiding speech and muting the
 *              speaker work at once; a speaker who leaves takes its bubble along; the chat icon is shown in the run (and hidden while
 *              the composer is open), and on a phone a tap on it opens the composer (post-Trial 4 chat polish: the icon replaced
 *              Trial 4's Enter hint and Trial 2's SAY button).
 *   mutants    (--mutants 1) copies of the page's chat.js with one fault each (a bubble written as HTML, the composer opening over the
 *              pause screen, held keys kept, the lounge left open in a run, no edge hint, mutes ignored, bubbles that never end):
 *              each must fail its cases.  The server is the tree's own; only public/assets/chat.js differs (a copy of public/).
 * Exit 0 only if every case passes (and every mutant is caught).  Servers are stopped by their PIDs. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) ARG[a.slice(2)] = '1'; else { ARG[a.slice(2)] = n; i++; } } }
const REPO = path.resolve(__dirname, '../../..'), TREE = path.resolve(ARG.tree || REPO), QUIET = !!ARG.quiet;
const ONLY = ARG.only ? new Set(ARG.only.split(',')) : null;
const want = n => !ONLY || ONLY.has(n);
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const PASS = 't2-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => { if (!QUIET) console.log(s); };
const cases = [];
function check(name, ok, detail) { cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' - ' + detail : ''}`); }
let nonce = 0; const synth = k => `synthetic-t2-${k}-${(++nonce).toString(36)}${Date.now() % 1000}`;
const XSS = '<img src=x onerror="window.__xss=1"><b>bold</b></li>';

const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(dir) {
  const port = await freePort();
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server in ' + dir);
}
const TAP = `(() => { const S = window.WebSocket; window.__t2 = { game: null, admin: null, unlocked: false, social: [] };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws\\?/.test(u)) { window.__t2.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.ad) window.__t2.admin = m.ad; if (m.t === 'admin' && m.ok) window.__t2.unlocked = true; } catch (x) { } }); }
    else window.__t2.social.push(ws);
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }); })();`;
async function open(b, port, room, o = {}) {
  const ctx = await b.newContext(o.mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: o.reduced ? 'reduce' : 'no-preference' }
    : { viewport: o.viewport || { width: 1920, height: 1080 }, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const P = await ctx.newPage(), errs = [];
  await P.addInitScript(TAP);
  P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  let st = null; for (let i = 0; i < 600; i++) { st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready' || st === 'menu' || st === 'error') break; await sleep(100); }
  if (st === 'ready') { if (o.mobile) await P.touchscreen.tap(195, 520); else await P.keyboard.press('Space'); }
  for (let i = 0; i < 300; i++) { st = await P.evaluate(() => window.__boot ? __boot.state() : 'menu').catch(() => null); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => !!(window.__api && window.__api.H && window.__chat), null, { timeout: 60000 });
  return { ctx, P, errs, room };
}
const cstate = P => P.evaluate(() => window.__chat.state());
async function until(P, fn, arg, ms = 8000) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(100); } }
async function startRun(s, name) {
  const { P } = s;
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible', timeout: 30000 });
  await P.fill('#name', name);
  if (s.mobile) await P.tap('#enter'); else await P.click('#enter');
  const ok = await until(P, () => !!(window.__api && __api.started() && !document.getElementById('hud').hidden && window.__net && __net.on), null, 20000);
  // at once: the admin tools (a synthetic passcode), the world frozen and this player made unkillable, so no monster ends a test
  await P.evaluate(p => window.__net.testAuth(p), PASS);
  const unlocked = await until(P, () => window.__t2.unlocked, null, 5000);
  await P.evaluate(() => { window.__t2.game.send(JSON.stringify({ t: 'a', c: 'freeze', on: true })); window.__t2.game.send(JSON.stringify({ t: 'a', c: 'god', id: __api.H.id })); });
  await sleep(1200);                                                     // the curtain lifts, the first snapshots arrive
  return !!ok && !!unlocked && !(await P.evaluate(() => !!(__api.G && __api.G.caught) || !document.getElementById('caught').hidden));
}
const pos = P => P.evaluate(() => ({ x: __api.H.x, y: __api.H.y, id: __api.H.id }));

/* ================================================================ the lounge */
async function lounge(b, port, shots) {
  const A = await open(b, port, 't2ra'), B = await open(b, port, 't2rb');
  const on = await until(A.P, () => window.__chat.state().lounge.state === 'online') && await until(B.P, () => window.__chat.state().lounge.state === 'online');
  const ia = (await cstate(A.P)).lounge.id, ib = (await cstate(B.P)).lounge.id;
  check('lounge_online_in_two_rooms', !!on && ia && ib && ia !== ib, `ids ${ia}, ${ib}`);
  // typed with the keyboard, sent with Enter
  const t1 = synth('lounge');
  await A.P.click('#lgText'); await A.P.keyboard.type(t1); await A.P.keyboard.press('Enter');
  const got = await until(B.P, t => [...document.querySelectorAll('#lgLog li.lg-line .lg-text')].some(e => e.textContent === t), t1);
  check('lounge_line_arrives', !!got);
  const ownA = await A.P.evaluate(t => { const li = [...document.querySelectorAll('#lgLog li.lg-own')].find(l => l.querySelector('.lg-text').textContent === t); return !!li && li.querySelector('.lg-who').textContent === 'You'; }, t1);
  check('lounge_own_line_marked', ownA);
  // typing reaches neither the game nor the menu
  const before = await A.P.evaluate(() => ({ st: __ui.state(), entry: __ui.entryOpen(), sheets: document.querySelectorAll('.ui-sheet:not([hidden])').length }));
  await A.P.click('#lgText'); await A.P.keyboard.type('wasd mcnbz'); await A.P.keyboard.down('KeyW'); await sleep(150);
  const during = await A.P.evaluate(() => ({ keys: __api.keys.size, st: __ui.state(), entry: __ui.entryOpen(), sheets: document.querySelectorAll('.ui-sheet:not([hidden])').length, v: document.getElementById('lgText').value }));
  await A.P.keyboard.up('KeyW'); await A.P.keyboard.press('Enter');     // (sends 'wasd mcnbzw')
  const after = await A.P.evaluate(() => ({ st: __ui.state(), entry: __ui.entryOpen() }));
  check('lounge_typing_isolated', during.keys === 0 && during.st === 'menu' && !during.entry && during.sheets === before.sheets && during.v === 'wasd mcnbzw' && after.st === 'menu' && !after.entry, JSON.stringify(during));
  // markup stays text
  await sleep(1800);
  await A.P.fill('#lgText', XSS); await A.P.press('#lgText', 'Enter');
  const x = await until(B.P, t => { const e = [...document.querySelectorAll('#lgLog .lg-text')].find(e => e.textContent === t); return e ? { kids: e.children.length, img: document.querySelectorAll('#lgLog img').length } : null; }, XSS);
  await sleep(300);
  const xss = await B.P.evaluate(() => window.__xss === undefined);
  check('lounge_markup_literal', !!x && x.kids === 0 && x.img === 0 && xss, JSON.stringify(x));
  // mute from the name, unmute everyone
  await B.P.click(`#lgLog button.lg-who[data-mute="${ia}"]`);
  const gone = await B.P.evaluate(id => document.querySelectorAll(`#lgLog li[data-id="${id}"]`).length === 0, ia);
  await sleep(1800); const t2 = synth('muted'); await A.P.fill('#lgText', t2); await A.P.press('#lgText', 'Enter');
  await until(A.P, t => [...document.querySelectorAll('#lgLog .lg-text')].some(e => e.textContent === t), t2);
  await sleep(600);
  const silent = await B.P.evaluate(t => ![...document.querySelectorAll('#lgLog .lg-text')].some(e => e.textContent === t), t2);
  await B.P.click('#lgUnmute');
  await sleep(1800); const t3 = synth('unmuted'); await A.P.fill('#lgText', t3); await A.P.press('#lgText', 'Enter');
  const back = await until(B.P, t => [...document.querySelectorAll('#lgLog .lg-text')].some(e => e.textContent === t), t3);
  check('lounge_mute', gone && silent && !!back, `removed ${gone}, silent ${silent}, back ${!!back}`);
  if (shots) await A.P.screenshot({ path: path.join(shots, 'lounge_1920x1080.png') });
  // fold (wide), remembered
  await B.P.click('#lgFold');
  const folded = await B.P.evaluate(() => ({ f: document.getElementById('lounge').classList.contains('lg-folded'), body: getComputedStyle(document.getElementById('lgBody')).display, saved: JSON.parse(localStorage.getItem('tfb.chat.v1')).fold }));
  await B.P.click('#lgFold');
  check('lounge_fold', folded.f && folded.body === 'none' && folded.saved === true, JSON.stringify(folded));
  // the lounge off: its socket closes; on again
  const n0 = (await cstate(A.P)).lounge.online;
  await B.P.click('#lgOff');
  const off = await until(B.P, () => { const s = window.__chat.state().lounge; return s.state === 'off' && !s.open && window.__t2.social.every(w => w.readyState >= 2); });
  const fewer = await until(A.P, n => window.__chat.state().lounge.online === n - 1, n0, 6000);
  await B.P.click('#lgOn'); const reon = await until(B.P, () => window.__chat.state().lounge.state === 'online');
  check('lounge_off_closes_socket', !!off && !!fewer && !!reon, `off ${!!off}, count ${!!fewer}, on ${!!reon}`);
  // entering a run closes A's lounge; it receives nothing more
  const ok = await startRun(A, 'T2 Lounge A');
  const closed = await until(A.P, () => { const s = window.__chat.state().lounge; return !s.open && window.__t2.social.every(w => w.readyState >= 2); });
  const got0 = (await cstate(A.P)).lounge.got;
  await sleep(1800); const t4 = synth('while-in-run'); await B.P.fill('#lgText', t4); await B.P.press('#lgText', 'Enter');
  await until(B.P, t => [...document.querySelectorAll('#lgLog .lg-text')].some(e => e.textContent === t), t4); await sleep(800);
  const s4 = await cstate(A.P), dom4 = await A.P.evaluate(t => [...document.querySelectorAll('#lgLog .lg-text')].some(e => e.textContent === t), t4);
  check('lounge_closed_in_run', ok && !!closed && s4.lounge.got === got0 && !dom4, `run ${ok}, closed ${!!closed}`);
  check('lounge_no_page_errors', !A.errs.length && !B.errs.length, A.errs.concat(B.errs).slice(0, 2).join(' | '));
  await A.ctx.close(); await B.ctx.close();
}
async function loungePhone(b, port, shots) {
  const M = await open(b, port, 't2rp', { mobile: true }); M.mobile = true;
  const s0 = await M.P.evaluate(() => ({ panel: getComputedStyle(document.getElementById('lounge')).display, btn: getComputedStyle(document.getElementById('mmLounge')).display }));
  await M.P.tap('#mmLounge');
  const s1 = await M.P.evaluate(() => ({ sheet: document.getElementById('lounge').classList.contains('lg-sheet'), panel: getComputedStyle(document.getElementById('lounge')).display, focus: document.activeElement && document.activeElement.id }));
  if (shots) await M.P.screenshot({ path: path.join(shots, 'lounge_phone_390x844.png') });
  await M.P.keyboard.press('Escape');
  const s2 = await M.P.evaluate(() => ({ sheet: document.getElementById('lounge').classList.contains('lg-sheet'), focus: document.activeElement && document.activeElement.id, st: __ui.state() }));
  check('lounge_phone_sheet', s0.panel === 'none' && s0.btn !== 'none' && s1.sheet && s1.panel === 'flex' && (s1.focus === 'lgText' || s1.focus === 'lgFold') && !s2.sheet && s2.focus === 'mmLounge' && s2.st === 'menu', JSON.stringify([s0, s1, s2]));
  check('lounge_phone_no_page_errors', !M.errs.length, M.errs.slice(0, 2).join(' | '));
  await M.ctx.close();
}

/* the lounge's place: at five sizes it covers no other part of the menu, and nothing scrolls sideways */
async function loungeLayout(b, port, shots) {
  const SIZES = [['1920x1080', { viewport: { width: 1920, height: 1080 } }], ['1280x720', { viewport: { width: 1280, height: 720 } }], ['1366x768', { viewport: { width: 1366, height: 768 } }],
    ['390x844', { mobile: true }], ['844x390', { viewport: { width: 844, height: 390 } }]];
  for (const [name, o] of SIZES) {
    const s = await open(b, port, 't2l', o);
    await until(s.P, () => window.__chat.state().lounge.state === 'online');
    const r = await s.P.evaluate(() => {
      const shown = e => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' && !e.closest('[hidden]');
      const box = e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
      const hit = (a, c) => a[0] < c[2] - .5 && c[0] < a[2] - .5 && a[1] < c[3] - .5 && c[1] < a[3] - .5;
      const mine = [document.getElementById('lounge'), document.getElementById('mmLounge')].filter(shown);
      const chat = e => !!e.closest('[data-chat], #mmLounge');
      const t = document.getElementById('mmTitle'), tb = box(t), others = [...document.querySelectorAll('#menu button, #menu a[href], #menu input, #menu .mm-stage, #menu .mm-foot p, #menu .mm-rail > *, #menu .mm-util')].filter(e => shown(e) && !chat(e) && !e.contains(document.getElementById('mmLounge')));
      const tbx = [tb[0] - 3, tb[1] - 3, tb[2] + 3, tb[3] + 3];          // the title with its drift
      const clash = []; for (const m of mine) { const mb = box(m); if (hit(mb, tbx)) clash.push(m.id + ' x title'); for (const e of others) if (hit(mb, box(e))) clash.push(m.id + ' x ' + (e.id || e.className)); }
      const L = document.getElementById('lounge');                       // the panel's own parts stay inside it
      if (shown(L)) { const lb = box(L); for (const id of ['lgFold', 'lgCount', 'lgLog', 'lgText']) { const e = document.getElementById(id); if (!shown(e)) continue; const b = box(e); if (b[0] < lb[0] - .5 || b[1] < lb[1] - .5 || b[2] > lb[2] + .5 || b[3] > lb[3] + .5) clash.push(id + ' outside the panel'); } }
      return { mine: mine.map(e => e.id), clash, scroll: document.scrollingElement.scrollWidth <= innerWidth, inView: mine.every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5; }) };
    });
    if (shots) await s.P.screenshot({ path: path.join(shots, `menu_${name}.png`) });
    check('lounge_layout_' + name, r.mine.length === 1 && !r.clash.length && r.scroll && r.inView, JSON.stringify(r));
    await s.ctx.close();
  }
}

/* ================================================================ nearby speech */
/* one line said through the composer: Enter, then (a software-rendered page can be slow) wait until the composer is open, type, Enter */
async function composer(S) { await S.P.keyboard.press('Enter'); return until(S.P, () => window.__chat.state().nearby.composer, null, 4000); }
async function speak(S, text) {
  if (!await composer(S)) return false;
  await S.P.keyboard.type(text); await S.P.keyboard.press('Enter'); return true;
}
/* the listener is placed beside the speaker with the admin tools (players of one room can spawn far apart) */
async function together(L, Sp) {                                       // (both already have the admin tools, the world frozen: startRun)
  const beside = await Sp.P.evaluate(() => { const H = __api.H; for (const [dx, dy] of [[90, 0], [-90, 0], [0, 90], [0, -90], [70, 70], [-70, 70], [70, -70], [-70, -70]]) if (__api.zc(Math.floor((H.x + dx) / 96), Math.floor((H.y + dy) / 96))) return { x: H.x + dx, y: H.y + dy }; return { x: H.x + 1, y: H.y + 1 }; });
  await L.P.evaluate(s => window.__api.tp(s.x, s.y), beside);
  return !!await until(L.P, s => { const a = window.__t2.admin; return a && a.pl && a.pl.some(q => q.id === __api.H.id && Math.hypot(q.x - s.x, q.y - s.y) < 30); }, beside, 5000);
}
async function nearby(b, port, shots) {
  const room = 't2n' + (Date.now() % 100000);
  const A = await open(b, port, room, { viewport: { width: 1280, height: 720 } }), B = await open(b, port, room, { viewport: { width: 960, height: 540 } });
  const C = await open(b, port, room + 'x', { viewport: { width: 960, height: 540 } });
  const runs = (await startRun(A, 'T2 Speaker')) && (await startRun(B, 'T2 Listener')) && (await startRun(C, 'T2 Elsewhere'));
  check('nearby_runs_started', runs);
  const pa0 = await pos(A.P), pb = await pos(B.P);
  check('nearby_spawned_in_one_world', pa0.id && pb.id && pa0.id !== pb.id, `${Math.round(Math.hypot(pa0.x - pb.x, pa0.y - pb.y))} px apart at spawn`);
  // the listener is brought beside the speaker with the admin tools (players of one room can spawn far apart)
  check('nearby_listener_placed', await together(B, A));
  const pa = await pos(A.P);
  // the chat icon (post-Trial 4 chat polish; it replaced Trial 4's Enter hint) is shown while nearby speech can open, named with its key
  const iconVisible = await until(A.P, () => { const el = document.getElementById('chatIcon'); return !!el && !el.hidden && getComputedStyle(el).display !== 'none' && /^Nearby chat \(.+\)$/.test(el.getAttribute('aria-label') || ''); }, null, 4000);
  check('nearby_icon_visible', !!iconVisible);
  // Enter opens the composer; held keys are let go; typing walks nobody; Esc closes without pausing
  await A.P.keyboard.down('KeyD'); await sleep(250);
  await A.P.keyboard.press('Enter');
  await until(A.P, () => window.__chat.state().nearby.composer, null, 4000);
  const op = await A.P.evaluate(() => ({ c: window.__chat.state().nearby.composer, keys: __api.keys.size, f: document.activeElement && document.activeElement.id,
    why: { started: __api.started(), paused: __api.paused(), caught: !!(__api.G && __api.G.caught), on: __net.on, sheets: document.querySelectorAll('.ui-sheet:not([hidden])').length, shown: ['dialog', 'caught', 'won', 'runMenu', 'appearancePanel', 'menu'].filter(id => { const e = document.getElementById(id); return e && !e.hidden; }) } }));
  await sleep(500);                                                      // (the walk that was under way slows to a stop)
  const l0 = await A.P.evaluate(() => __api.lightOn());
  const p0 = await pos(A.P); await A.P.keyboard.type('wwwwssssaaaa fff'); await A.P.keyboard.down('KeyA'); await sleep(600); await A.P.keyboard.up('KeyA'); const p1 = await pos(A.P);
  const l1 = await A.P.evaluate(() => __api.lightOn());
  await A.P.keyboard.up('KeyD');
  check('nearby_composer_opens', op.c && op.keys === 0 && op.f === 'sayText', JSON.stringify(op));
  const iconDuringChat = await A.P.evaluate(() => { const el = document.getElementById('chatIcon'); return !el || el.hidden; });
  check('nearby_icon_hides_while_typing', iconDuringChat);
  check('nearby_typing_walks_nobody', Math.hypot(p1.x - p0.x, p1.y - p0.y) < 2 && l1 === l0, `${Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y))} px; the light ${l0 ? 'on' : 'off'} -> ${l1 ? 'on' : 'off'} after typing F three times`);
  await A.P.keyboard.press('Escape'); await sleep(200);
  const esc = await A.P.evaluate(() => ({ c: window.__chat.state().nearby.composer, paused: __api.paused(), dialog: !document.getElementById('dialog').hidden }));
  check('nearby_escape_closes_only', !esc.c && !esc.paused && !esc.dialog, JSON.stringify(esc));
  // over the pause screen Enter keeps its old meaning: the composer does not open (Esc pauses, Enter, Esc resumes)
  await A.P.keyboard.press('Escape'); const pz = await until(A.P, () => __api.paused() && !document.getElementById('dialog').hidden, null, 4000);
  await A.P.evaluate(() => { const r = document.getElementById('resume'); if (r) r.blur(); document.body.focus(); });
  await A.P.keyboard.press('Enter'); await sleep(400);
  const overPause = await A.P.evaluate(() => window.__chat.state().nearby.composer);
  if (await A.P.evaluate(() => __api.paused())) await A.P.keyboard.press('Escape');
  const resumed = await until(A.P, () => !__api.paused(), null, 4000);
  check('nearby_not_over_pause', !!pz && !overPause && !!resumed, `paused ${!!pz}, composer over it ${overPause}, resumed ${!!resumed}`);
  // the keys work again after the composer
  const q0 = await pos(A.P); await A.P.keyboard.down('KeyS'); await sleep(500); await A.P.keyboard.up('KeyS'); const q1 = await pos(A.P);
  await A.P.keyboard.down('KeyW'); await sleep(500); await A.P.keyboard.up('KeyW');
  check('nearby_keys_back_after', Math.hypot(q1.x - q0.x, q1.y - q0.y) > 20, `${Math.round(Math.hypot(q1.x - q0.x, q1.y - q0.y))} px`);
  // a line: a bubble over the speaker on both screens, literal text, gone within 5 s
  // Trial 4: the listener must see the speaker's HUD color rather than the listener's.
  await A.P.evaluate(() => __settings.set('c', '#8dff9f'));
  await B.P.evaluate(() => __settings.set('c', '#ffb347'));
  const t1 = synth('near');
  await speak(A, t1);
  const bb = await until(B.P, ([t, id]) => { const s = window.__chat.state().nearby.bubbles.find(x => x.id === id); const e = [...document.querySelectorAll('#chatLayer .bb .bb-text')].find(e => e.textContent === t); return s && e && s.w ? s : null; }, [t1, pa.id], 12000);
  const own = await until(A.P, ([t, id]) => { const s = window.__chat.state().nearby.bubbles.find(x => x.id === id); return s && s.mode === 'bb-on' && [...document.querySelectorAll('#chatLayer .bb-text')].some(e => e.textContent === t); }, [t1, pa.id]);
  check('nearby_bubble_both_screens', !!bb && bb.mode === 'bb-on' && !!own, JSON.stringify(bb));
  const speakerAccent = await B.P.evaluate(() => {
    const el = document.querySelector('#chatLayer .bb');
    return el && el.style.getPropertyValue('--bb-accent');
  });
  check('t4_sender_hud_color_not_recipient', speakerAccent === '#8dff9f', String(speakerAccent));
  if (shots) { await B.P.bringToFront(); await sleep(1200); await B.P.screenshot({ path: path.join(shots, 'nearby_bubble_listener.png') }); await A.P.bringToFront(); await sleep(800); await A.P.screenshot({ path: path.join(shots, 'nearby_bubble_speaker.png') }); }   // (a software-rendered page paints late)
  await sleep(600);
  const cNone = await C.P.evaluate(() => window.__chat.state().nearby.heard === 0 && !document.querySelector('#chatLayer .bb'));
  check('nearby_other_room_nothing', cNone);
  const gone = await until(B.P, id => !window.__chat.state().nearby.bubbles.some(x => x.id === id), pa.id, 9000);
  const goneA = await until(A.P, id => !window.__chat.state().nearby.bubbles.some(x => x.id === id), pa.id, 3000);
  check('nearby_bubble_bounded', !!gone && !!goneA, `listener ${!!gone}, speaker ${!!goneA} (a short line lives 3 s or a little more; a long one at most 10.5 s)`);
  // markup stays text
  await speak(A, XSS);
  const xb = await until(B.P, t => { const e = [...document.querySelectorAll('#chatLayer .bb-text')].find(e => e.textContent === t); return e ? { kids: e.children.length, img: document.querySelectorAll('#chatLayer img').length } : null; }, XSS);
  await sleep(300);
  check('nearby_markup_literal', !!xb && xb.kids === 0 && xb.img === 0 && await B.P.evaluate(() => window.__xss === undefined), JSON.stringify(xb));
  // the listener moves off screen (within the radius): an edge hint pointing at the speaker
  const spot = await A.P.evaluate(() => {
    const H = __api.H, c = (x, y) => [Math.floor(x / 96), Math.floor(y / 96)], fl = (x, y) => { const [i, j] = c(x, y); return __api.zc(i, j); };
    for (const [dx, dy] of [[0, 520], [0, -520], [160, 500], [-160, 500], [160, -500], [-160, -500], [300, 420], [-300, 420], [300, -420], [-300, -420]])
      if (fl(H.x + dx, H.y + dy) && fl(H.x + dx * .5, H.y + dy * .5)) return { x: H.x + dx, y: H.y + dy, dx, dy };
    return null; });
  let hintOk = false, hintDetail = 'no open spot';
  if (spot) {
    await B.P.evaluate(s => window.__api.tp(s.x, s.y), spot);
    await until(B.P, s => { const a = window.__t2.admin; return a && a.pl && a.pl.some(q => q.id === __api.H.id && Math.hypot(q.x - s.x, q.y - s.y) < 30); }, spot, 5000);
    await sleep(1800);
    const t2 = synth('hint'); await speak(A, t2);
    const h = await until(B.P, id => { const s = window.__chat.state().nearby.bubbles.find(x => x.id === id); return s && s.w && s.mode ? s : null; }, pa.id);
    const want = Math.atan2(-spot.dy, -spot.dx);                         // from the listener toward the speaker
    const d = h && h.a !== null ? Math.abs(Math.atan2(Math.sin(h.a - want), Math.cos(h.a - want))) : 9;
    hintOk = !!h && h.mode === 'bb-hint' && d < .5;
    hintDetail = h ? `${h.mode}, angle off by ${d.toFixed(2)} rad, at ${h.x},${h.y}` : 'no bubble';
    if (shots) { await B.P.bringToFront(); await sleep(1200); await B.P.screenshot({ path: path.join(shots, 'nearby_edge_hint_listener.png') }); }
  }
  check('nearby_offscreen_hint', hintOk, hintDetail);
  // beyond the radius: nothing
  await sleep(5200);
  const far = await A.P.evaluate(() => ({ x: __api.H.x, y: __api.H.y }));
  const farSpot = await A.P.evaluate(() => { const H = __api.H; for (const [dx, dy] of [[0, 900], [0, -900], [900, 0], [-900, 0], [700, 700], [-700, 700], [700, -700], [-700, -700]]) { const i = Math.floor((H.x + dx) / 96), j = Math.floor((H.y + dy) / 96); if (__api.zc(i, j)) return { x: H.x + dx, y: H.y + dy }; } return null; });
  let farOk = false, farWhy = '';
  if (farSpot) {
    await B.P.evaluate(s => window.__api.tp(s.x, s.y), farSpot);
    await until(B.P, s => { const a = window.__t2.admin; return a && a.pl && a.pl.some(q => q.id === __api.H.id && Math.hypot(q.x - s.x, q.y - s.y) < 30); }, farSpot, 5000);
    await sleep(400);
    const h0 = (await cstate(B.P)).nearby.heard;
    const t3 = synth('far'); await speak(A, t3);
    const ownFar = await until(A.P, t => [...document.querySelectorAll('#chatLayer .bb-text')].some(e => e.textContent === t), t3);
    await sleep(800);
    const h1 = (await cstate(B.P)).nearby.heard;
    farOk = !!ownFar && h1 === h0; farWhy = `own bubble ${!!ownFar}, listener heard ${h1 - h0} more`;
  }
  check('nearby_beyond_radius_nothing', farOk, farSpot ? farWhy : 'no open spot');
  // back near; hide speech; mute the speaker
  await B.P.evaluate(s => window.__api.tp(s.x, s.y), { x: far.x + 60, y: far.y }); await sleep(1500);
  await composer(B); await B.P.click('#sayBox .say-more'); await B.P.click('#sayOpts [data-opt="bubbles"]');
  await B.P.keyboard.press('Escape');
  const hb0 = (await cstate(B.P)).nearby.shown, hh0 = (await cstate(B.P)).nearby.heard;
  await sleep(1800); const t5 = synth('hidden'); await speak(A, t5);
  const arrived = await until(B.P, h => window.__chat.state().nearby.heard > h, hh0, 3000); await sleep(600);
  const hid = await B.P.evaluate(() => ({ shown: window.__chat.state().nearby.shown, any: !!document.querySelector('#chatLayer .bb') }));
  await composer(B); await B.P.click('#sayBox .say-more'); await B.P.click('#sayOpts [data-opt="bubbles"]');
  const muteBtn = await B.P.$(`#sayOpts [data-mute="${pa.id}"]`); if (muteBtn) await muteBtn.click();
  await B.P.keyboard.press('Escape');
  await sleep(1800); const t6 = synth('muted'); await speak(A, t6);
  await sleep(1200);
  const mu = await B.P.evaluate(t => ({ any: [...document.querySelectorAll('#chatLayer .bb-text')].some(e => e.textContent === t), muted: window.__chat.state().nearby.muted }), t6);
  check('nearby_hide_and_mute', !!arrived && hid.shown === hb0 && !hid.any && !!muteBtn && mu.muted === 1 && !mu.any, JSON.stringify([hid, mu, !!muteBtn]));
  // unmute, then the speaker leaves: its bubble goes with it
  await composer(B); await B.P.click('#sayBox .say-more'); const um = await B.P.$(`#sayOpts [data-mute="${pa.id}"]`); if (um) await um.click(); await B.P.keyboard.press('Escape');
  await sleep(1800); const t7 = synth('leaving'); await speak(A, t7);
  const seen7 = await until(B.P, t => [...document.querySelectorAll('#chatLayer .bb-text')].some(e => e.textContent === t), t7);
  await A.ctx.close();
  const left = await until(B.P, id => !window.__chat.state().nearby.bubbles.some(x => x.id === id), pa.id, 3000);
  check('nearby_leaver_bubble_goes', !!seen7 && !!left);
  check('nearby_no_page_errors', !A.errs.length && !B.errs.length && !C.errs.length, A.errs.concat(B.errs, C.errs).slice(0, 2).join(' | '));
  await B.ctx.close(); await C.ctx.close();
}
async function nearbyPhone(b, port, shots) {
  const room = 't2m' + (Date.now() % 100000);
  const M = await open(b, port, room, { mobile: true }); M.mobile = true;
  const D = await open(b, port, room, { viewport: { width: 1280, height: 720 } });
  const ok = (await startRun(M, 'T2 Phone')) && (await startRun(D, 'T2 Desk')) && (await together(D, M));
  const say = await until(M.P, () => { const e = document.getElementById('chatIcon'); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; });
  if (say) { await M.P.tap('#chatIcon'); await until(M.P, () => window.__chat.state().nearby.composer, null, 4000); }
  const c = await M.P.evaluate(() => ({ c: window.__chat.state().nearby.composer, f: document.activeElement && document.activeElement.id, keys: __api.keys.size, top: document.getElementById('sayBox').getBoundingClientRect().top }));
  if (shots) await M.P.screenshot({ path: path.join(shots, 'nearby_phone_composer.png') });
  const t = synth('phone'); await M.P.keyboard.type(t); await M.P.keyboard.press('Enter');
  const heard = await until(D.P, t => [...document.querySelectorAll('#chatLayer .bb-text')].some(e => e.textContent === t), t);
  check('nearby_phone_icon_opens', ok && !!say && c.c && c.f === 'sayText' && c.keys === 0 && c.top < 120 && !!heard, JSON.stringify(c));
  check('nearby_phone_no_page_errors', !M.errs.length && !D.errs.length, M.errs.concat(D.errs).slice(0, 2).join(' | '));
  await M.ctx.close(); await D.ctx.close();
}
async function reducedMotion(b, port) {
  const room = 't2r' + (Date.now() % 100000);
  const A = await open(b, port, room, { viewport: { width: 1280, height: 720 }, reduced: true }), B = await open(b, port, room, { viewport: { width: 1280, height: 720 }, reduced: true });
  const ok = (await startRun(A, 'T2 Calm A')) && (await startRun(B, 'T2 Calm B')) && (await together(B, A));
  const t = synth('calm'), said = await speak(A, t);
  const st = await until(B.P, t => { const e = [...document.querySelectorAll('#chatLayer .bb')].find(b => b.querySelector('.bb-text').textContent === t); if (!e) return null; const cs = getComputedStyle(e); return { rm: document.documentElement.classList.contains('rm'), tr: cs.transitionDuration, an: cs.animationName }; }, t);
  const why = st ? '' : JSON.stringify({ ok, said, a: await A.P.evaluate(() => window.__chat.state().nearby), b: await B.P.evaluate(() => window.__chat.state().nearby), d: Math.round(Math.hypot((await pos(A.P)).x - (await pos(B.P)).x, (await pos(A.P)).y - (await pos(B.P)).y)) });
  check('nearby_reduced_motion', ok && !!st && st.rm && parseFloat(st.tr) <= .01 && st.an === 'none', st ? JSON.stringify(st) : why);   // (html.rm's own rule: every transition 0.01 s)
  await A.ctx.close(); await B.ctx.close();
}

async function suite(tree, shots) {
  const S = await serve(tree);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [n, f] of [['lounge', lounge], ['lounge_layout', loungeLayout], ['lounge_phone', loungePhone], ['nearby', nearby], ['nearby_phone', nearbyPhone], ['reduced', reducedMotion]]) {
      if (!want(n)) continue;
      try { await f(b, S.port, shots); } catch (e) { check(n + '_ran', false, String(e && e.message || e).split('\n')[0].slice(0, 200)); }
      for (const c of b.contexts()) await c.close().catch(() => { });   // a scenario that threw leaves no page running
    }
  } finally { await b.close(); try { process.kill(S.p.pid); } catch (e) { } }
}

const MUTANTS = [
  { name: 'bubble as HTML', from: "b.txt.textContent = b.text.slice(0, cut);", to: "b.txt.innerHTML = b.text.slice(0, cut);", only: 'nearby', expect: ['nearby_markup_literal'] },   // (post-Trial 4 chat polish C3: the written part of a typed-out line)
  { name: 'the composer opens over the pause screen', from: "A.started && A.started() && !A.paused() && !(A.G && A.G.caught) && !overlayOpen());", to: "A.started && A.started() && !(A.G && A.G.caught));", only: 'nearby', expect: ['nearby_not_over_pause'] },
  { name: 'held keys kept', from: "if (A && A.keys && A.keys.clear) A.keys.clear();", to: "", only: 'nearby', expect: ['nearby_composer_opens', 'nearby_typing_walks_nobody'] },
  { name: 'lounge left open in a run', from: "  const inMenu = () => vis('menu') && !(API() && API().started && API().started());", to: "  const inMenu = () => true;", only: 'lounge', expect: ['lounge_closed_in_run'] },
  { name: 'no edge hint', from: "const on = sx > M && sx < W - M && sy > M && sy < H - M;", to: "const on = true;", only: 'nearby', expect: ['nearby_offscreen_hint'] },
  { name: 'mutes ignored', from: "if (muted.has(m.id) || !S.bubbles) return;", to: "if (!S.bubbles) return;", only: 'nearby', expect: ['nearby_hide_and_mute'] },
  { name: 'bubbles never end', from: "if (now >= b.until) { b.el.remove(); B.delete(id); continue; }", to: "", only: 'nearby', expect: ['nearby_bubble_bounded'] },
];
async function mutants(work) {
  const res = [];
  for (const M of MUTANTS) {
    const dir = path.join(work, 'b' + MUTANTS.indexOf(M)); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(TREE, f), path.join(dir, f));
    for (const d of ['src', 'generated']) fs.symlinkSync(path.join(TREE, d), path.join(dir, d));
    fs.cpSync(path.join(TREE, 'public') + path.sep + '.', path.join(dir, 'public'), { recursive: true });
    const f = path.join(dir, 'public/assets/chat.js'), src = fs.readFileSync(f, 'utf8');
    if (!src.includes(M.from)) { res.push({ name: M.name, caught: false, why: 'does not apply' }); log(`MUTANT ${M.name}: does not apply`); continue; }
    fs.writeFileSync(f, src.replace(M.from, M.to));
    const r = await new Promise(done => { const p = spawn(process.execPath, [__filename, '--tree', dir, '--only', M.only, '--quiet', '--out', path.join(dir, 'r.json')], { stdio: 'ignore' }); p.on('exit', code => { let j = null; try { j = JSON.parse(fs.readFileSync(path.join(dir, 'r.json'), 'utf8')); } catch (e) { } done({ code, j }); }); });
    const failed = r.j ? r.j.cases.filter(c => !c.ok).map(c => c.name) : ['(no report)'];
    const caught = r.code !== 0 && M.expect.some(e => failed.includes(e));
    res.push({ name: M.name, caught, failed, expected: M.expect }); log(`MUTANT ${M.name}: ${caught ? 'caught' : 'NOT CAUGHT'} (${failed.join(', ')})`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return res;
}

(async () => {
  const t0 = Date.now(), shots = ARG.shots ? path.resolve(ARG.shots) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
  await suite(TREE, shots);
  const mut = ARG.mutants === '1' ? await mutants(path.resolve(ARG.work || fs.mkdtempSync(path.join(os.tmpdir(), 'chatb-')))) : null;
  const ok = cases.length > 0 && cases.every(c => c.ok) && (!mut || mut.every(m => m.caught));
  const rep = { tool: 'dev/tools/checks/chat_browser.js', tree: TREE === REPO ? 'this repository' : TREE, browser: pw.chromium.name(), seconds: Math.round((Date.now() - t0) / 1000), ok, cases, passed: cases.filter(c => c.ok).length, failed: cases.filter(c => !c.ok).map(c => c.name), mutants: mut };
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
  console.log(`CHAT BROWSER: ${ok ? 'PASS' : 'FAIL'} - ${rep.passed} of ${cases.length} cases${mut ? `; mutants ${mut.filter(m => m.caught).length} of ${mut.length} caught` : ''} (${rep.seconds} s)`);
  process.exit(ok ? 0 : 1);
})();
