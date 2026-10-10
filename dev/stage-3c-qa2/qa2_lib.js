/* Stage 3C QA2 - browser helpers on top of dev/stage-3c/ui_lib.js (development only; never served).
 *
 *   const Q = require('./qa2_lib.js');
 *   const s = await Q.page(b, PORT, { viewport, mobile, reduced, gate: 'key' | 'click' | 'tap' | false, init, storage, route, before });
 *   // s.P (Playwright page), s.cdp (a CDP session), s.ev(expr) reads the page WITHOUT a user gesture, s.errs
 *   await Q.bootState(s, 'ready' | 'menu' | 'error', ms)
 *
 * Why: Playwright's page.evaluate runs with a user gesture, which unlocks audio and would fake the QA2 gate. While the page boots
 * it is read only through CDP Runtime.evaluate with userGesture: false. Passing the gate is a real input (a key press, a click or
 * a tap), as a player's would be. After the gate, page.evaluate is fine. */
'use strict';
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const ev = (cdp, expr) => cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: false })
  .then(r => r.exceptionDetails ? { __error: r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '') } : r.result && r.result.value).catch(e => ({ __error: String(e) }));
async function bootState(s, want, ms = 30000) {
  const t0 = Date.now(); let st = null;
  while (Date.now() - t0 < ms) { st = await ev(s.cdp, 'window.__boot && __boot.state()'); if ([].concat(want).includes(st) || st === 'error') return st; await sleep(80); }
  return st;
}
/* pass the boot gate the way a player would (a key, a click or a tap), once the page says it is ready; returns the boot state after */
async function passGate(s, how = 'key') {
  const st = await bootState(s, ['ready', 'menu'], 60000);
  if (st === 'ready') {
    const vp = s.P.viewportSize();
    if (how === 'click') await s.P.mouse.click(vp.width / 2, vp.height * .62);
    else if (how === 'tap') await s.P.touchscreen.tap(vp.width / 2, vp.height * .62);
    else await s.P.keyboard.press('Space');
  }
  return bootState(s, 'menu', 30000);
}
/* wait until the menu's entrance (logo first, then the rest; about 1.3 s) is over; returns how long it took, or null */
async function settle(s, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await ev(s.cdp, `(() => { const m = document.getElementById('menu'); return !!m && !m.classList.contains('mm-intro'); })()`); if (v === true) return Date.now() - t0; await sleep(100); }
  return null;
}
async function page(b, PORT, o = {}) {
  const { viewport = { width: 1920, height: 1080 }, mobile = false, dpr = mobile ? 2 : 1, reduced = false, room = 'q2' + Date.now() % 1e6, query = '', init = null, storage = null, gate = 'key', ctxOpts = {} } = o;
  const ctx = await b.newContext(Object.assign({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' }, ctxOpts));
  const P = await ctx.newPage(), errs = [];
  await P.addInitScript(H.INIT);
  if (storage) await P.addInitScript(s => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (e) { } }, storage);
  for (const s of [].concat(init || [])) await P.addInitScript(s);
  P.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 300)));
  P.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|fonts\.g|ERR_TUNNEL|ERR_CONNECTION/.test(t)) errs.push('console: ' + t.slice(0, 300)); });
  const cdp = await ctx.newCDPSession(P);
  const s = { ctx, P, cdp, errs, ev: expr => ev(cdp, expr) };
  if (o.route) for (const [pat, fn] of [].concat([o.route])) await ctx.route(pat, fn);
  if (o.before) await o.before(s);                                        // e.g. network throttling, before the page loads
  await P.goto(`http://127.0.0.1:${PORT}/?room=${room}${query}`, { waitUntil: 'commit', timeout: 90000 });
  if (gate === false) return s;
  s.boot = await passGate(s, gate);
  s.entrance = await settle(s);                                            // (QA2 R1: the menu's entrance has played out)
  await sleep(300);
  return s;
}
const browser = (o = {}) => H.pw.chromium.launch({ args: H.ARGS.concat(o.autoplay ? ['--autoplay-policy=no-user-gesture-required'] : []) });
module.exports = Object.assign({}, U, { ev, bootState, passGate, settle, page, browser, sleep, H });
