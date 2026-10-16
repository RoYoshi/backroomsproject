#!/usr/bin/env node
/* dev/post-3h-trials/tools/t2_capture.js - post-3H Trial 2: pictures of the chats for the owner's Human QA (development only; evidence,
 * not a check).
 *
 *   node dev/post-3h-trials/tools/t2_capture.js --dir GAME_DIR --out DIR
 *
 * One server (`node server.js PORT`, a synthetic admin passcode) and headless Chromium (SwiftShader).  Two players enter a run in one room
 * (each given the admin tools at once: the world frozen, nobody killable), the listener is placed beside the speaker, and the speaker says
 * synthetic lines.  Captures, each page brought to the front first (a page behind another is not painted here):
 *   lounge_wide.png       two menus in different rooms sharing the lounge (1280 x 720)
 *   bubble_speaker.png    the speaker's own bubble          bubble_listener.png   the same line over the speaker, on the listener's screen
 *   edge_hint.png         the listener moved off screen within the radius: the hint at the edge, pointing to the speaker
 *   composer.png          the Nearby composer open, with its options
 *   phone_lounge.png      a 390 x 844 phone: the lounge opened over the menu
 * Every text is synthetic.  Servers are stopped by their PIDs. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms)), PASS = 't2-synthetic-admin', OUT = path.resolve(ARG.out), DIR = path.resolve(ARG.dir);
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const TAP = `(() => { const S = window.WebSocket; window.__t2 = { game: null, admin: null, unlocked: false };
  window.WebSocket = function (u, p) { const ws = new S(u, p); if (/\\/ws\\?/.test(u)) { window.__t2.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.ad) window.__t2.admin = m.ad; if (m.t === 'admin' && m.ok) window.__t2.unlocked = true; } catch (x) { } }); } return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }); })();`;
async function until(P, fn, arg, ms = 8000) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(100); } }
async function open(b, port, room, o = {}) {
  const ctx = await b.newContext(o.mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: o.viewport || { width: 1280, height: 720 } });
  const P = await ctx.newPage(); await P.addInitScript(TAP);
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 600; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') { if (o.mobile) await P.touchscreen.tap(195, 520); else await P.keyboard.press('Space'); } if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__chat, null, { timeout: 60000 }); await sleep(800);
  return { ctx, P };
}
async function run(s, name) {
  const { P } = s; await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', name); await P.click('#enter');
  await until(P, () => __api.started() && window.__net && __net.on, null, 30000);
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__t2.unlocked, null, 5000);
  await P.evaluate(() => { window.__t2.game.send(JSON.stringify({ t: 'a', c: 'freeze', on: true })); window.__t2.game.send(JSON.stringify({ t: 'a', c: 'god', id: __api.H.id })); });
  await sleep(2500);
}
async function shot(s, f, wait = 1500) { await s.P.bringToFront(); await sleep(wait); await s.P.screenshot({ path: path.join(OUT, f) }); console.log('wrote', f); }
async function say(s, t) { await s.P.keyboard.press('Enter'); await until(s.P, () => window.__chat.state().nearby.composer, null, 4000); await s.P.keyboard.type(t); await s.P.keyboard.press('Enter'); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort(), srv = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 100 && await get(port, '/index.html') !== 200; i++) await sleep(100);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    // the lounge: two menus, two rooms
    const L1 = await open(b, port, 'roomone'), L2 = await open(b, port, 'roomtwo');
    await until(L1.P, () => window.__chat.state().lounge.state === 'online'); await until(L2.P, () => window.__chat.state().lounge.state === 'online');
    await L2.P.fill('#lgText', 'synthetic: anyone near the yellow rooms?'); await L2.P.press('#lgText', 'Enter'); await sleep(1800);
    await L1.P.fill('#lgText', 'synthetic: I am in room one, come find me'); await L1.P.press('#lgText', 'Enter'); await sleep(1500);
    await shot(L1, 'lounge_wide.png'); await L1.ctx.close(); await L2.ctx.close();
    const M = await open(b, port, 'roomthree', { mobile: true }); await until(M.P, () => window.__chat.state().lounge.state === 'online');
    await M.P.tap('#mmLounge'); await shot(M, 'phone_lounge.png'); await M.ctx.close();
    // nearby speech
    const A = await open(b, port, 'roomnear'), B = await open(b, port, 'roomnear', { viewport: { width: 960, height: 540 } });
    await run(A, 'Speaker'); await run(B, 'Listener');
    const beside = await A.P.evaluate(() => { const H = __api.H; for (const [dx, dy] of [[90, 0], [-90, 0], [0, 90], [0, -90]]) if (__api.zc(Math.floor((H.x + dx) / 96), Math.floor((H.y + dy) / 96))) return { x: H.x + dx, y: H.y + dy }; return { x: H.x + 1, y: H.y }; });
    await B.P.evaluate(s => __api.tp(s.x, s.y), beside); await sleep(2000);
    // (a software-rendered page here draws about one frame a second: the lines are long enough to live 5 s, and each picture is taken
    // the moment its bubble is there, its page already in front)
    await B.P.bringToFront();
    await say(A, 'synthetic: did you hear that hum? it is louder over here, near the wet patch of carpet - come and listen before it stops'); await until(B.P, () => window.__chat.state().nearby.bubbles.length > 0);
    await shot(B, 'bubble_listener.png', 0); await shot(A, 'bubble_speaker.png', 0);
    await sleep(5500);
    const spot = await A.P.evaluate(() => { const H = __api.H; for (const [dx, dy] of [[0, 520], [0, -520], [160, 500], [-160, 500], [160, -500], [-160, -500]]) if (__api.zc(Math.floor((H.x + dx) / 96), Math.floor((H.y + dy) / 96))) return { x: H.x + dx, y: H.y + dy }; return null; });
    if (spot) { await B.P.evaluate(s => __api.tp(s.x, s.y), spot); await sleep(2500); await B.P.bringToFront(); await say(A, 'synthetic: over here, follow my voice - I am just past the pillar, keep walking toward the light and you will see me'); await until(B.P, () => window.__chat.state().nearby.bubbles.some(x => x.mode === 'bb-hint')); await shot(B, 'edge_hint.png', 0); }
    await sleep(2000);
    await A.P.keyboard.press('Enter'); await until(A.P, () => window.__chat.state().nearby.composer, null, 4000); await A.P.click('#sayBox .say-more'); await A.P.keyboard.type(''); await shot(A, 'composer.png'); await A.P.keyboard.press('Escape');
    await A.ctx.close(); await B.ctx.close();
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
})();
