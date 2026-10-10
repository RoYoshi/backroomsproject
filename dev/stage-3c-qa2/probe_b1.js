/* Stage 3C QA2, QA2-1 (updated at QA2-3) - the boot gate, checked in a browser (development only; never served).
 *
 *   node dev/stage-3c-qa2/probe_b1.js [--game DIR] [--port 9811] [--out FILE.json] [--shots DIR]
 *
 * Starts are recorded frame by frame (boot_capture.js, every composited frame from navigation) and analysed (boot_sheet.py):
 *  - cold (empty profile), warm (same profile again) and cold on a 4 Mbit/s link: the page's first paint is black, and every frame
 *    from it until the reveal is black but for the small lines of the boot layer ("Loading", the slow first download's note, the
 *    ready gate's line); the boot states run black -> loading -> ready -> menu (this Chromium wants a gesture before sound may
 *    start, so each start passes the ready gate with a key press, as a player would, once its line has been up for a moment);
 *  - the reveal shows the whole menu at once: no part of it is still animating in, nothing is missing;
 *  - no percentage is ever shown (the only figure: the real bytes of a slow first download of the music);
 *  - a required piece that fails (the stylesheet, the credits data, the game's module, ui.js itself) leaves the page black with a
 *    small message naming what failed and RETRY; the menu never shows; RETRY (with the piece back) starts the game normally;
 *  - reduced motion: the reveal is immediate (the boot layer invisible at once; removed a moment later).
 * The page is read through CDP Runtime.evaluate without a user gesture while it boots (Playwright's evaluate would grant one).
 * Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', path.join(__dirname, '..', '..'))), PORT = +opt('port', 9811), OUT = opt('out', null);
const SHOTS = path.resolve(opt('shots', path.join(__dirname, 'evidence', 'q1')));
const FRAMES = fs.mkdtempSync(path.join(require('os').tmpdir(), 'qa2b1-'));
const R = { game: GAME, checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 600) : '')); };
/* one recorded start: boot_capture.js + boot_sheet.py; returns the runs with per-frame non-black shares */
function record(tag, extra) {
  const r = spawnSync('node', [path.join(__dirname, 'boot_capture.js'), '--game', GAME, '--out', FRAMES, '--tag', tag, '--port', String(PORT + 1)].concat(extra), { encoding: 'utf8', timeout: 300000 });
  const s = spawnSync('python3', ['-I', path.join(__dirname, 'boot_sheet.py'), FRAMES, tag], { encoding: 'utf8', timeout: 300000 });
  if (s.status !== 0) R.errors.push(`${tag}: boot_sheet ${s.stderr.slice(0, 300)}`);
  const J = JSON.parse(fs.readFileSync(path.join(FRAMES, tag + '.json'), 'utf8'));
  if (J.errors.length) R.errors.push(...J.errors.map(e => tag + ': ' + e));
  for (const k of ['cold', 'warm']) { const f = path.join(FRAMES, `${tag}_${k}_sheet.jpg`); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(SHOTS, `b1_${tag}_${k}_sheet.jpg`)); }
  fs.copyFileSync(path.join(FRAMES, tag + '.json'), path.join(SHOTS, `b1_${tag}_frames.json`));
  return J;
}
/* the frames between the page's own first paint and the reveal, and what the reveal produced */
function boot(run) {
  const fp = (run.page.paints.find(p => p[0] === 'first-paint') || [, null])[1], T = (run.page.boot || {}).timeline || {};
  const own = run.frames.filter(f => fp !== null && f.t >= fp - 5);
  const before = own.filter(f => T.menu !== undefined && f.t < T.menu), after = own.filter(f => T.menu !== undefined && f.t >= T.menu);
  return { firstPaint: fp, timeline: T, framesBeforeReveal: before.length, maxNonBlackBeforeReveal: before.length ? Math.max(...before.map(f => f.nonBlack)) : null,
    firstOwnFrameNonBlack: own.length ? own[0].nonBlack : null, lastNonBlack: after.length ? after[after.length - 1].nonBlack : null,
    order: ['black', 'loading', 'ready', 'menu'].every((k, i, a) => T[k] !== undefined && (i === 0 || T[k] >= T[a[i - 1]])) && T.error === undefined };
}
const ev = (cdp, expr) => cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, userGesture: false }).then(r => r.result && r.result.value).catch(() => null);
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    /* ---------- cold, warm, slow */
    const A = record('desktop', ['--secs', '16', '--warm', '1', '--gesture', '1', '--gesture-after', '800']), S = record('slow', ['--secs', '80', '--throttle', '4000', '--gesture', '1', '--gesture-after', '1500']);
    const cold = boot(A.runs[0]), warm = boot(A.runs[1]), slow = boot(S.runs[0]);
    R.notes.starts = { cold, warm, slow };
    for (const [name, b] of [['cold', cold], ['warm', warm], ['4 Mbit/s cold', slow]])
      // (a start so quick that everything is ready before the browser's first paint reveals before it: that first frame is still
      //  black, because the reveal's fade starts from the black boot layer)
      check(`${name} start: the page's first paint is black, every frame until the reveal stays black but for the small loading line (under 1 % of the screen), the states run black -> loading -> ready -> menu, and the menu is up after it`,
        b.firstOwnFrameNonBlack !== null && b.firstOwnFrameNonBlack < .01 && (b.framesBeforeReveal === 0 || b.maxNonBlackBeforeReveal < .01) && b.order && b.lastNonBlack > .03,
        { firstPaint: b.firstPaint, timeline: b.timeline, framesBeforeReveal: b.framesBeforeReveal, firstFrameNonBlack: b.firstOwnFrameNonBlack, maxNonBlack: b.maxNonBlackBeforeReveal, lastNonBlack: b.lastNonBlack });
    // the screencast sends a frame only when the picture changes: the last frame before the reveal is what was on screen until then
    const pre = S.runs[0].frames.filter(f => f.t >= slow.firstPaint - 5 && f.t < slow.timeline.menu), lastPre = pre[pre.length - 1];
    const loadingFrames = pre.filter(f => f.t < slow.timeline.ready), lastLoading = loadingFrames[loadingFrames.length - 1];
    check('a slow start shows the quiet "Loading" line once the black has lasted about a second (before ui.js has even run) and, on a first download of the music, the note under it; nothing else until the ready gate\'s line',
      slow.timeline.menu - slow.firstPaint > 2000 ? !!lastLoading && lastLoading.t > slow.firstPaint + 900 && lastLoading.nonBlack > 0 && lastLoading.nonBlack < .01 && pre[0].nonBlack === 0 && !!lastPre && lastPre.nonBlack > 0 && lastPre.nonBlack < .01 : true,
      { blackMs: slow.timeline.menu - slow.firstPaint, firstFrame: pre[0] && [pre[0].t, pre[0].nonBlack], lastWhileLoading: lastLoading && [lastLoading.t, lastLoading.nonBlack], lastBeforeReveal: lastPre && [lastPre.t, lastPre.nonBlack], gate: S.runs[0].page.gate });
    R.notes.slowGate = S.runs[0].page.gate;
  } catch (e) { R.errors.push('record: ' + (e && e.stack || e)); }

  const srv = await U.serve(GAME, PORT), b = await U.browser();
  const fresh = async (opts = {}) => { const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, opts.ctx || {})); const P = await ctx.newPage(), errs = [];
    P.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
    if (opts.route) await ctx.route(opts.route, r => r.abort());
    const cdp = await ctx.newCDPSession(P); return { ctx, P, cdp, errs }; };
  const url = () => `http://127.0.0.1:${PORT}/?room=b1${Date.now() % 1e6}`;
  const until = async (cdp, expr, ms) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await ev(cdp, expr); if (v) return v; await sleep(100); } return v; };
  // up to the menu, passing the ready gate with a key press where this Chromium wants one
  const toMenu = async (s, ms) => { const st = await until(s.cdp, `window.__boot && (__boot.state() === 'menu' || (__boot.state() === 'ready' && __ui.boot().gate)) && __boot.state()`, ms);
    if (st === 'ready') await s.P.keyboard.press('Space');
    return until(s.cdp, `window.__boot && __boot.state() === 'menu' && 'menu'`, 10000); };
  try {
    /* ---------- the reveal shows the whole menu at once; QA1 continues underneath */
    { const s = await fresh(); await s.P.goto(url(), { waitUntil: 'commit' });
      await toMenu(s, 60000); await sleep(500);
      const m = await ev(s.cdp, `(() => { const op = s => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : null; };
        const anims = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#menu')).map(a => a.animationName || a.transitionProperty);
        return { st: __ui.state(), booted: !document.documentElement.classList.contains('tfb-boot'), parts: ['#mmTitle', '.mm-stage', '#mmPlay', '.mm-row', '.mm-rail', '.mm-util', '.mm-foot'].map(op), menuAnims: anims, light: (() => { const c = document.getElementById('mmLight'); try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; } catch (e) { return -1; } })(),
          enterClass: document.getElementById('menu').classList.contains('enter'), bootText: document.getElementById('boot').textContent, note: document.getElementById('bootNote').textContent, theme: __ui.theme.info().state }; })()`);
      check('the reveal shows the whole menu at once: title, LEVEL 0 line and PLAY, the row, both rails and the footer at full opacity, no part animating in, the light already drawn; the QA1 menu underneath, its theme playing',
        m && m.st === 'menu' && m.booted && m.parts.every(x => x === 1) && !m.menuAnims.length && m.light > 50 && !m.enterClass && m.theme === 'playing', m);
      check('no percentage anywhere in the boot layer; the only figure is the real-bytes note of a first download of the music, when it takes a while',
        m && !/%/.test(m.bootText) && !/\d/.test(m.bootText.replace(m.note, '')) && (m.note === '' || /^Downloading the menu music( \(first visit only\))?: \d+\.\d of 22\.6 MB$/.test(m.note)), m && { text: m.bootText, note: m.note });
      await s.ctx.close(); }
    /* ---------- required pieces that fail */
    const FAILS = [['the stylesheet', '**/assets/ui.css', 'the interface', 15000], ['the credits data', '**/assets/credits_data.js', 'the credits', 15000],
      ['the game module', '**/assets/index-DKbV5Nv9.js', 'the game', 30000], ['ui.js itself', '**/assets/ui.js', 'the interface', 20000]];
    for (const [label, route, what, ms] of FAILS) {
      const s = await fresh({ route }); await s.P.goto(url(), { waitUntil: 'commit' });
      await until(s.cdp, `window.__boot && __boot.state() === 'error'`, ms);
      const e = await ev(s.cdp, `(() => ({ st: __boot.state(), info: __boot.info(), boot: !document.getElementById('boot').hidden, err: !document.getElementById('bootErr').hidden,
        msg: document.getElementById('bootErrMsg').textContent, retry: !!document.getElementById('bootRetry').getClientRects().length, focus: document.activeElement && document.activeElement.id,
        hiddenPage: document.documentElement.classList.contains('tfb-boot'), menuVisible: (() => { const m = document.getElementById('menu'); return getComputedStyle(m).visibility; })() }))()`);
      if (label === 'the stylesheet') await s.P.screenshot({ path: path.join(SHOTS, 'b1_error_stylesheet.png') });
      check(`${label} fails to load: the page stays black with "${what} did not load" and RETRY (focused); the menu never shows`,
        e && e.st === 'error' && e.boot && e.err && e.msg.includes(what + ' did not load') && e.retry && e.focus === 'bootRetry' && e.hiddenPage && e.menuVisible === 'hidden', e);
      if (label === 'the credits data') {                        // RETRY with the piece back: the game starts
        await s.ctx.unroute(route); await s.P.click('#bootRetry');
        const st = await toMenu(s, 60000);
        check('RETRY (the failed piece now available) reloads and the menu comes up normally', st === 'menu', st);
      }
      await s.ctx.close();
    }
    /* ---------- reduced motion */
    { const s = await fresh({ ctx: { reducedMotion: 'reduce' } }); await s.P.goto(url(), { waitUntil: 'commit' });
      await toMenu(s, 60000);
      const B = `(() => { const b = document.getElementById('boot'); return { hidden: b.hidden, opacity: getComputedStyle(b).opacity, transition: getComputedStyle(b).transitionDuration }; })()`;
      const r = await ev(s.cdp, B); await sleep(700); const r2 = await ev(s.cdp, B);
      check('reduced motion: at the reveal the boot layer is invisible at once (no fade), and removed a moment later', r && (r.hidden || (r.opacity === '0' && parseFloat(r.transition) <= .01)) && r2 && r2.hidden, { atReveal: r, later: r2 });
      await s.ctx.close(); }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  try { fs.rmSync(FRAMES, { recursive: true, force: true }); } catch (e) { }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
