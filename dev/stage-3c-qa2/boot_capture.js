/* Stage 3C QA2 - what a player sees while the page starts, frame by frame (development only; never served).
 *
 *   node dev/stage-3c-qa2/boot_capture.js --game DIR --out DIR [--tag NAME] [--port 9801] [--size 1280x720 | 390x844m]
 *        [--throttle KBPS] [--secs 10] [--warm 1] [--autoplay 1] [--gesture 1] [--gesture-at MS]
 *
 * Records every frame the compositor produces from the moment of navigation (Chromium's screencast, before the first paint), with
 * its time since navigation, for a cold start (a new browser profile: empty caches) and, with --warm, a second start in the same
 * profile (Cache Storage and the HTTP cache kept). --throttle limits the download rate (CDP network emulation). --gesture presses a
 * key as soon as the QA2 boot gate says it is ready (or at --gesture-at ms for a build without one). --autoplay starts Chromium with
 * --autoplay-policy=no-user-gesture-required (the "browser allows sound" path). Also records the page's own marks: DOMContentLoaded,
 * load, the game API, first paint, and the QA2 boot timeline when the build has one (window.__boot). Frames are analysed by
 * boot_sheet.py (what share of each frame is not black, and a contact sheet). */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', path.join(__dirname, '..', '..'))), OUT = path.resolve(opt('out', path.join(__dirname, 'evidence', 'boot'))), TAG = opt('tag', 'boot');
const PORT = +opt('port', 9801), SIZE = opt('size', '1280x720'), THROTTLE = +opt('throttle', 0), SECS = +opt('secs', 10), WARM = opt('warm', '0') === '1';
const AUTOPLAY = opt('autoplay', '0') === '1', GESTURE = opt('gesture', '0') === '1', GESTURE_AT = opt('gesture-at', null);
const mobile = /m$/.test(SIZE), [W, Hh] = SIZE.replace(/m$/, '').split('x').map(Number);
const MARKS = () => { const T = window.__bootMarks = {}; const mark = k => { if (!(k in T)) T[k] = Math.round(performance.now()); };
  document.addEventListener('DOMContentLoaded', () => mark('domContentLoaded')); addEventListener('load', () => mark('load'));
  const iv = setInterval(() => { if (window.__api && window.__api.H) { mark('gameApi'); clearInterval(iv); } }, 25); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await U.serve(GAME, PORT);
  const b = await H.pw.chromium.launch({ args: H.ARGS.concat(AUTOPLAY ? ['--autoplay-policy=no-user-gesture-required'] : []) });
  const R = { game: GAME, tag: TAG, size: SIZE, throttleKbps: THROTTLE, secs: SECS, autoplayFlag: AUTOPLAY, gesture: GESTURE || !!GESTURE_AT, runs: [], errors: [] };
  try {
    const ctx = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const P = await ctx.newPage(); await P.addInitScript(MARKS);
    P.on('pageerror', e => R.errors.push('pageerror: ' + String(e).slice(0, 200)));
    P.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fonts\.g|ERR_TUNNEL|ERR_CONNECTION/.test(m.text())) R.errors.push('console: ' + m.text().slice(0, 200)); });
    const cdp = await ctx.newCDPSession(P);
    await cdp.send('Network.enable');
    // read the page without giving it a user gesture (Playwright's page.evaluate counts as one, which would unlock audio)
    const ev = expr => cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, userGesture: false }).then(r => r.result && r.result.value).catch(() => null);
    if (THROTTLE) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: THROTTLE * 1000 / 8, uploadThroughput: THROTTLE * 1000 / 8 });
    let frames = null, t0 = 0, n = 0;
    cdp.on('Page.screencastFrame', async f => {
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) { }
      if (!frames) return;
      const t = Math.round(f.metadata.timestamp * 1000 - t0), file = `${TAG}_${frames.kind}_${String(n++).padStart(4, '0')}.jpg`;
      fs.writeFileSync(path.join(OUT, file), Buffer.from(f.data, 'base64')); frames.list.push({ file, t });
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: W * (mobile ? 2 : 1), maxHeight: Hh * (mobile ? 2 : 1), everyNthFrame: 1 });
    for (const kind of WARM ? ['cold', 'warm'] : ['cold']) {
      frames = { kind, list: [] }; n = 0;
      t0 = Date.now();
      await P.goto(`http://127.0.0.1:${PORT}/?room=boot${Date.now() % 1e6}`, { waitUntil: 'commit', timeout: 120000 });
      let gestureAt = null; const end = t0 + SECS * 1000;
      while (Date.now() < end) {
        if (GESTURE && gestureAt === null) {
          const st = await ev('window.__boot && __boot.state && __boot.state()');
          if (st === 'ready') { gestureAt = Date.now() - t0; await P.keyboard.press('Space'); }
        } else if (GESTURE_AT && gestureAt === null && Date.now() - t0 >= +GESTURE_AT) { gestureAt = Date.now() - t0; await P.mouse.click(W / 2, Hh * .2); }
        await sleep(100);
      }
      const page = (await ev(`(() => ({ marks: window.__bootMarks || {}, paints: performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]),
        nav: (() => { const e = performance.getEntriesByType('navigation')[0]; return e ? { responseEnd: Math.round(e.responseEnd), domInteractive: Math.round(e.domInteractive), loadEventEnd: Math.round(e.loadEventEnd) } : null; })(),
        boot: window.__boot && __boot.info ? __boot.info() : null, theme: window.__ui && __ui.theme && __ui.theme.info ? (({ state, plays, t0, ctx, fetched, cacheHits }) => ({ state, plays, t0, ctx, fetched, cacheHits }))(__ui.theme.info()) : null,
        uiState: window.__ui && __ui.state ? __ui.state() : null, activated: navigator.userActivation ? navigator.userActivation.hasBeenActive : null }))()`)) || { error: 'no page info' };
      R.runs.push({ kind, navigationAt: t0, gestureAt, frames: frames.list, page });
      frames = null;
    }
    await cdp.send('Page.stopScreencast').catch(() => { });
  } catch (e) { R.errors.push('capture: ' + (e && e.stack || e)); }
  finally { await U.close(b, srv); }
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R.runs.map(r => ({ kind: r.kind, frames: r.frames.length, gestureAt: r.gestureAt, marks: r.page.marks, paints: r.page.paints, boot: r.page.boot && r.page.boot.timeline }))));
  process.exit(R.errors.length ? 1 : 0);
})();
