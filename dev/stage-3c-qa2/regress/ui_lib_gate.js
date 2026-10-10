/* Stage 3C QA2, QA2-4 - dev/stage-3c/ui_lib.js for the QA2 build (development only; never served).
 *
 * The older browser probes (QA1's probe_q1..q5 and lifecycle.js, the first candidate's probe_c1..c5) open the game and act on its
 * menu at once. On QA2 the menu is behind the black boot until everything it needs is ready, and where the browser wants a
 * gesture before sound may start, behind the ready gate. This module is ui_lib.js with one difference: every page opened through
 * its browser (U.browser(), then newContext / newPage, U.page()) waits, after each goto() and reload(), for the boot to finish, and
 * passes the ready gate the way a player does - one key press (Space), as real input - before handing the page back. The waiting
 * reads the page through CDP without a user gesture, so it never fakes the gate. On a build without the QA2 boot (no
 * window.__boot once the document has loaded) it returns at once. Nothing else changes: the probes' own steps and checks are theirs.
 *
 *   const U = require('./ui_lib_gate.js');   // instead of require('../stage-3c/ui_lib.js')
 *   U.gateLog: one entry per navigation - { url, state, pressed, ms } */
'use strict';
const U = require('../../stage-3c/ui_lib.js'); const { sleep } = U;
const gateLog = [];
async function passBoot(P) {
  let url = ''; try { url = P.url(); } catch (e) { return; }
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return;
  let cdp = null; try { cdp = await P.context().newCDPSession(P); } catch (e) { return; }
  const ev = expr => cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, userGesture: false }).then(r => r.result && r.result.value).catch(() => null);
  const t0 = Date.now(); let st = null, pressed = false;
  try {
    while (Date.now() - t0 < 120000) {
      st = await ev(`window.__boot ? [__boot.state(), !!(window.__ui && __ui.boot && __ui.boot().gate)] : document.readyState === 'loading' ? 'parsing' : 'none'`);
      if (st === 'none') break;                                            // not the QA2 boot
      if (Array.isArray(st)) {
        if (['menu', 'error', 'run', 'playing'].includes(st[0])) break;
        if (st[0] === 'ready' && st[1] && !pressed) { await P.keyboard.press('Space'); pressed = true; }
      }
      await sleep(100);
    }
  } finally { cdp.detach().catch(() => { }); }
  gateLog.push({ url: url.replace(/^http:\/\/[^/]+/, ''), state: Array.isArray(st) ? st[0] : st, pressed, ms: Date.now() - t0 });
}
function wrapPage(P) {
  for (const k of ['goto', 'reload']) { const f = P[k].bind(P); P[k] = async (...a) => { const r = await f(...a); await passBoot(P); return r; }; }
  return P;
}
function wrapContext(ctx) { const np = ctx.newPage.bind(ctx); ctx.newPage = async (...a) => wrapPage(await np(...a)); return ctx; }
function wrapBrowser(b) {
  const nc = b.newContext.bind(b); b.newContext = async (...a) => wrapContext(await nc(...a));
  const np = b.newPage.bind(b); b.newPage = async (...a) => wrapPage(await np(...a));
  return b;
}
process.on('exit', () => { const by = {}; for (const g of gateLog) { const k = g.state + (g.pressed ? ' (gate passed by a key)' : ''); by[k] = (by[k] || 0) + 1; }
  console.log('[ui_lib_gate] navigations: ' + gateLog.length + ' ' + JSON.stringify(by) + (gateLog.length ? ', longest wait ' + Math.max(...gateLog.map(g => g.ms)) + ' ms' : '')); });
module.exports = Object.assign({}, U, { browser: async (...a) => wrapBrowser(await U.browser(...a)), gateLog, passBoot });
