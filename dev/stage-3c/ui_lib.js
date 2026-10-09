/* Stage 3C - shared browser helpers for the UI work (development only; never served, never loaded by the game).
 *
 *   const U = require('./ui_lib.js');
 *   const srv = await U.serve(GAME, PORT);                     // node server.js PORT in GAME
 *   const b = await U.browser();
 *   const s = await U.page(b, PORT, { viewport, mobile, reduced, room, query });   // the page at boot (the menu), errors collected
 *   await U.start(s.P, 'QA');                                 // into Level 0 by the build's own entry path (parent: #name + #enter)
 *   await U.admin(s.P); await H.stage(s.P);                   // the retained suites' test admin (frozen halls, no monsters, god mode)
 *   await U.shot(s.P, file);  U.close(...)
 *
 * Nothing here changes a game rule: starting a run goes through the same button a player presses; the admin path is the one
 * every retained browser suite already uses (harness_lib.js). */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(GAME, PORT) {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { if (await get(PORT, '/index.html') === 200) break; await sleep(100); }
  return srv;
}
const browser = () => H.pw.chromium.launch({ args: H.ARGS });
async function page(b, PORT, { viewport = { width: 1920, height: 1080 }, mobile = false, dpr = 1, reduced = false, room = 'c3' + Date.now() % 1e6, query = '', init = null, storage = null } = {}) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const P = await ctx.newPage(), errs = [];
  await P.addInitScript(H.INIT);
  if (storage) await P.addInitScript(s => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) { } }, storage);
  for (const s of [].concat(init || [])) await P.addInitScript(s);
  P.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 300)));
  P.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|fonts\.g|ERR_TUNNEL|ERR_CONNECTION/.test(t)) errs.push('console: ' + t.slice(0, 300)); });
  await P.goto(`http://127.0.0.1:${PORT}/?room=${room}${query}`, { timeout: 90000 });
  await P.waitForFunction(() => !!(window.__api && window.__api.H), null, { timeout: 90000 });
  await sleep(1200);
  return { ctx, P, errs };
}
/* into Level 0 through the build's own entry: Stage 3C's PLAY panel if present, else the parent's #name / #enter */
async function start(P, name = 'QA') {
  const v3 = await P.evaluate(() => !!(window.__ui && window.__ui.version));
  if (v3) {
    await P.evaluate(() => window.__ui.go('play'));
    await P.waitForSelector('#name', { state: 'visible', timeout: 30000 });
  }
  await P.fill('#name', name);
  await P.click('#enter');
  for (let i = 0; i < 150; i++) { if (await P.evaluate(() => !!(window.__api && __api.started() && !document.getElementById('hud').hidden))) break; await sleep(100); }
}
async function admin(P) {
  for (let i = 0; i < 100; i++) { if (await P.evaluate(() => !!(window.__ws && __ws.readyState === 1))) break; await sleep(100); }
  await P.evaluate(() => window.__net && __net.testAuth && __net.testAuth('smoor'));
  for (let i = 0; i < 60; i++) { if (await P.evaluate(() => window.__wsTap && window.__wsTap.admin)) break; await sleep(100); }
}
async function shot(P, file, opt = {}) { fs.mkdirSync(path.dirname(file), { recursive: true }); await P.screenshot(Object.assign({ path: file }, opt)); return file; }
async function close(b, srv) { try { await b.close(); } catch (e) { } try { srv.kill(); } catch (e) { } }
module.exports = { H, sleep, frames, serve, browser, page, start, admin, shot, close, get };
