/* Stage 3C QA1, Q4 - the touch stick, the action buttons, safe areas, and the installable app (development only).
 *
 *   node dev/stage-3c-qa1/probe_q4.js [--game DIR] [--port 9741] [--out FILE.json] [--shots DIR]
 *
 * Touch is real: Chromium's touch input (CDP Input.dispatchTouchEvent) on a 390x844 phone. The stick's eight-way reading at 16
 * angles, its dead zone and capped travel, release and cancel; frame for frame (the test clock stepped 1/60 s per frame) the
 * stick walks at exactly the keyboard's speed - straight, diagonal, and sprinting with the RUN button held by a second finger
 * - and LIGHT works while the stick is held. Layouts at 360x640, 390x844 (with a notch and home indicator), 430x932, 768x1024
 * and 844x390 (notch on the side): everything on screen, inside the safe areas, nothing overlapping. The manifest and the
 * page's app metadata, no service worker, the browser tab still the ordinary way to play, and Help's install guidance.
 * Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9741), OUT = opt('out');
const SHOTS = path.resolve(opt('shots') || path.join(__dirname, 'evidence', 'q4'));
const R = { game: GAME, checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 700) : '')); };
const OPEN = () => { const A = __api, ok = (x, y) => A.sl(x, y, 30);
  for (let y = 600; y < 6400; y += 48) for (let x = 600; x < 8600; x += 48) { let good = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, -.7], [.7, .7]]) for (let d = 0; d <= 320 && good; d += 24) if (!ok(x + dx * d, y + dy * d)) good = false;
    if (good) return [x, y]; }
  return null; };
/* walking speed per game tick, measured over n ticks after a warm-up, with the test clock stepped 1/60 s per frame */
const VEL = ([warm, n]) => new Promise(done => { const A = __api; let k = 0, a = null;
  const f = () => { if (k === warm) a = [A.H.x, A.H.y]; if (k === warm + n) { done({ vx: +((A.H.x - a[0]) / n).toFixed(6), vy: +((A.H.y - a[1]) / n).toFixed(6) }); return; } k++; requestAnimationFrame(f); };
  requestAnimationFrame(f); });
const stepClock = P => P.evaluate(() => { __clock.freeze(true); __clock.set(__clock.get(), 1000 / 60); });
const thaw = P => P.evaluate(() => __clock.thaw());
const keyFire = (P, type, codes) => P.evaluate(([t, cs]) => cs.forEach(c => document.body.dispatchEvent(new KeyboardEvent(t, { code: c, key: c, bubbles: true, cancelable: true }))), [type, codes]);
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    /* ---------- the stick, on a phone */
    { const s = await U.page(b, PORT, { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2 }), P = s.P;
      const cdp = await P.context().newCDPSession(P);
      const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2] })) });
      await U.start(P, 'Thumb'); await U.admin(P); await H.stage(P); await thaw(P); await sleep(5500);
      const lay = await P.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        return { zone: r('#stickZone'), run: r('#touch [data-key=ShiftLeft]'), light: r('#touchFlash'), dpad: getComputedStyle(document.querySelector('#touch .dpad')).display }; });
      const O = [Math.round(lay.zone.l + 100), Math.round(lay.zone.b - 160)];
      // eight ways from the angle
      await T('touchStart', [[O[0], O[1], 1]]); await sleep(120);
      const rows = [], want = a => { const c = Math.cos(a), sn = Math.sin(a), w = []; if (c > .383) w.push('KeyD'); else if (c < -.383) w.push('KeyA'); if (sn > .383) w.push('KeyS'); else if (sn < -.383) w.push('KeyW'); return w.sort().join(); };
      for (let k = 0; k < 16; k++) { const a = (11.25 + k * 22.5) * Math.PI / 180; await T('touchMove', [[O[0] + 40 * Math.cos(a), O[1] + 40 * Math.sin(a), 1]]); await sleep(60);
        const st = await P.evaluate(() => ({ want: __ui.stick().want.join(), keys: [...__api.keys].sort().join() })); rows.push([+(a * 180 / Math.PI).toFixed(2), want(a), st.want, st.keys]); }
      for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) { const a = deg * Math.PI / 180; await T('touchMove', [[O[0] + 40 * Math.cos(a), O[1] + 40 * Math.sin(a), 1]]); await sleep(60);
        const st = await P.evaluate(() => ({ want: __ui.stick().want.join(), keys: [...__api.keys].sort().join() })); rows.push([deg, want(a), st.want, st.keys]); }
      await T('touchMove', [[O[0] + 8, O[1], 1]]); await sleep(60); const dead = await P.evaluate(() => [...__api.keys].join());
      await T('touchMove', [[O[0] + 200, O[1], 1]]); await sleep(60); const cap = await P.evaluate(() => ({ keys: [...__api.keys].join(), knob: document.getElementById('stickKnob').style.transform, on: document.getElementById('stickZone').classList.contains('on') }));
      await T('touchEnd', []); await sleep(100); const rel = await P.evaluate(() => ({ keys: [...__api.keys].join(), held: __ui.stick().held, on: document.getElementById('stickZone').classList.contains('on') }));
      await T('touchStart', [[O[0], O[1], 2]]); await sleep(60); await T('touchMove', [[O[0] - 40, O[1] - 40, 2]]); await sleep(60); const pre = await P.evaluate(() => [...__api.keys].sort().join());
      await T('touchCancel', []); await sleep(100); const can = await P.evaluate(() => ({ keys: [...__api.keys].join(), held: __ui.stick().held }));
      R.notes.stickAngles = rows;
      check('the stick reads eight ways from the full angle (16 in-between angles and the 8 exact ones), drives the game\'s own direction keys, and the old pad is hidden',
        rows.every(r => r[1] === r[2] && r[2] === r[3]) && lay.dpad === 'none', { mismatches: rows.filter(r => !(r[1] === r[2] && r[2] === r[3])), dpad: lay.dpad });
      check('a dead zone at the centre; travel capped at the ring; lifting the thumb clears the move at once, and so does a cancelled touch',
        dead === '' && cap.keys === 'KeyD' && /translate3d\(52(\.0)?px, ?0(\.0)?px/.test(cap.knob) && cap.on && rel.keys === '' && !rel.held && !rel.on && pre === 'KeyA,KeyW' && can.keys === '' && !can.held, { dead, cap, rel, pre, can });
      // the same speed as the keyboard, frame for frame
      const at = await P.evaluate(OPEN);
      const place = async () => { await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await thaw(P); await sleep(300); };
      const keyVel = async codes => { await place(); await stepClock(P); await keyFire(P, 'keydown', codes); const v = await P.evaluate(VEL, [20, 20]); await keyFire(P, 'keyup', codes.slice().reverse()); await thaw(P); return v; };
      const stickVel = async (dx, dy, extra) => { await place(); await stepClock(P);
        const pts = [[O[0], O[1], 3]].concat(extra ? [[extra[0], extra[1], 4]] : []);
        await T('touchStart', pts); await T('touchMove', [[O[0] + dx, O[1] + dy, 3]].concat(extra ? [[extra[0], extra[1], 4]] : []));
        const v = await P.evaluate(VEL, [20, 20]); const keys = await P.evaluate(() => [...__api.keys].sort().join()); await T('touchEnd', []); await thaw(P); return Object.assign(v, { keys }); };
      const kD = await keyVel(['KeyD']), sD = await stickVel(44, 0);
      const kWD = await keyVel(['KeyW', 'KeyD']), sWD = await stickVel(31, -31);
      const kA = await keyVel(['KeyA']), sA = await stickVel(-44, 0);
      const kRun = await keyVel(['ShiftLeft', 'KeyD']), sRun = await stickVel(44, 0, [lay.run.x, lay.run.y]);
      const eq = (a, c) => Math.abs(a.vx - c.vx) < 1e-6 && Math.abs(a.vy - c.vy) < 1e-6;
      R.notes.speeds = { kD, sD, kWD, sWD, kA, sA, kRun, sRun };
      check('frame for frame the stick walks at exactly the keyboard\'s speed: right, diagonal (normalised by the game: no analog advantage), left, and sprinting with RUN held by a second finger at the same time',
        eq(kD, sD) && eq(kWD, sWD) && eq(kA, sA) && eq(kRun, sRun) && sRun.keys === 'KeyD,ShiftLeft' && kD.vx > 2 && Math.abs(Math.hypot(sWD.vx, sWD.vy) - kD.vx) < 1e-3 && kRun.vx > kD.vx * 1.4,
        { perTick: { key: [kD.vx, kWD, kA.vx, kRun.vx], stick: [sD.vx, sWD, sA.vx, sRun.vx], keysWithRun: sRun.keys } });
      // LIGHT while the stick is held
      await place(); const l0 = await P.evaluate(() => __api.lightOn());
      await T('touchStart', [[O[0], O[1], 5]]); await T('touchMove', [[O[0] + 40, O[1], 5]]); await sleep(150);
      await T('touchStart', [[O[0] + 40, O[1], 5], [lay.light.x, lay.light.y, 6]]); await sleep(150);
      const during = await P.evaluate(() => [...__api.keys].join());
      await T('touchEnd', []); await sleep(300); const l1 = await P.evaluate(() => ({ light: __api.lightOn(), keys: [...__api.keys].join() }));
      // a lone tap on LIGHT acts once (on the press; the click that follows is not a second toggle)
      await T('touchStart', [[lay.light.x, lay.light.y, 8]]); await sleep(80); await T('touchEnd', []); await sleep(400);
      const l2 = await P.evaluate(() => __api.lightOn());
      check('a second finger works LIGHT while the first holds the stick (the move held throughout), both lifting clears everything, and a lone tap on LIGHT toggles it exactly once',
        during === 'KeyD' && l1.light === !l0 && l1.keys === '' && l2 === !l1.light, { l0, during, l1, l2 });
      await U.shot(P, path.join(SHOTS, 'q4_390x844_stick_idle.jpg'), { type: 'jpeg', quality: 86 });
      await T('touchStart', [[O[0], O[1], 7]]); await T('touchMove', [[O[0] + 34, O[1] - 30, 7]]); await sleep(250);
      await U.shot(P, path.join(SHOTS, 'q4_390x844_stick_held.jpg'), { type: 'jpeg', quality: 86 }); await T('touchEnd', []);
      R.errors.push(...s.errs.map(e => 'stick: ' + e)); await s.ctx.close(); }

    /* ---------- layouts, with safe areas */
    const SIZES = [[360, 640, null], [390, 844, { top: 47, bottom: 34, left: 0, right: 0 }], [430, 932, { top: 59, bottom: 34, left: 0, right: 0 }], [768, 1024, { top: 24, bottom: 20, left: 0, right: 0 }], [844, 390, { top: 0, bottom: 21, left: 47, right: 47 }]];
    const bad = [];
    for (const [W, Hh, ins] of SIZES) {
      const tag = `${W}x${Hh}` + (ins ? ' (safe areas ' + [ins.top, ins.right, ins.bottom, ins.left].join('/') + ')' : '');
      const s = await U.page(b, PORT, { viewport: { width: W, height: Hh }, mobile: true, dpr: 2 }), P = s.P;
      const cdp = await P.context().newCDPSession(P);
      if (ins) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: ins });
      await U.start(P, 'Layout'); await U.admin(P); await H.stage(P); await thaw(P); await sleep(5600);
      await P.evaluate(() => { document.body.classList.add('stam-on'); const r = document.getElementById('hudReveal'); r.className = 'hud-reveal entry in'; r.hidden = false; document.getElementById('rvTitle').textContent = 'Level 0'; document.getElementById('rvEye').textContent = 'Threshold'; document.getElementById('rvSub').textContent = 'Find a glitched wall'; });
      await sleep(400);
      const L = await P.evaluate(i => { const W = innerWidth, Hh = innerHeight, ins = i || { top: 0, bottom: 0, left: 0, right: 0 };
        const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        const btns = [...document.querySelectorAll('#touch > button')].filter(e => e.getClientRects().length).map(e => Object.assign(r(e), { id: e.id || e.dataset.key }));
        const zone = r(document.getElementById('stickZone')), pause = r(document.getElementById('hudPause')), stam = r(document.querySelector('#hud .staminaHud')), rev = r(document.getElementById('hudReveal'));
        const hit = (a, c) => a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1;
        const inside = (a, pad) => a.l >= (pad ? ins.left : 0) - .5 && a.t >= (pad ? ins.top : 0) - .5 && a.r <= W - (pad ? ins.right : 0) + .5 && a.b <= Hh - (pad ? ins.bottom : 0) + .5;
        const prob = [];
        for (const x of btns) { if (!inside(x, true)) prob.push(['button outside the safe area', x.id]); if (hit(x, zone)) prob.push(['button under the stick zone', x.id]); if (hit(x, stam)) prob.push(['button under stamina', x.id]); if (hit(x, rev)) prob.push(['button under the reveal', x.id]); }
        if (!inside(pause, true)) prob.push(['pause outside the safe area']); if (hit(pause, zone)) prob.push(['pause under the stick zone']); if (!inside(stam, true)) prob.push(['stamina outside the safe area']);
        if (!inside(zone, false)) prob.push(['stick zone off screen']); if (hit(stam, rev)) prob.push(['stamina under the reveal']); if (document.documentElement.scrollWidth > W) prob.push(['horizontal scroll']);
        return { W, Hh, prob, zone, pause, stam, buttons: btns.length };
      }, ins);
      if (L.prob.length) bad.push([tag, L.prob]);
      R.notes['layout ' + tag] = { buttons: L.buttons, zone: L.zone, pause: L.pause };
      await P.evaluate(() => { document.body.classList.remove('stam-on'); const r = document.getElementById('hudReveal'); r.classList.remove('in'); r.hidden = true; });
      await sleep(600);
      await U.shot(P, path.join(SHOTS, `q4_${W}x${Hh}_touch_play.jpg`), { type: 'jpeg', quality: 86 });
      R.errors.push(...s.errs.map(e => tag + ': ' + e)); await s.ctx.close();
    }
    check('touch layouts at 360x640, 390x844 and 430x932 (notch and home indicator), 768x1024 tablet and 844x390 on its side (notch at the side): buttons, PAUSE and stamina inside the safe areas; nothing under the stick zone, the status or the reveal; no sideways scroll',
      !bad.length, bad);

    /* ---------- the installable app */
    { const s = await U.page(b, PORT, { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2 }), P = s.P;
      const cdp = await P.context().newCDPSession(P);
      const man = await cdp.send('Page.getAppManifest'); let inst = null; try { inst = await cdp.send('Page.getInstallabilityErrors'); } catch (e) { inst = { error: e.message }; }
      const M = JSON.parse(man.data || '{}');
      const head = await P.evaluate(() => ({ manifest: (document.querySelector('link[rel=manifest]') || {}).href, viewport: document.querySelector('meta[name=viewport]').content, theme: document.querySelector('meta[name=theme-color]').content,
        apple: (document.querySelector('meta[name=apple-mobile-web-app-capable]') || {}).content, bar: (document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]') || {}).content }));
      const fetched = await P.evaluate(async () => { const r = await fetch('assets/manifest.webmanifest'); return { status: r.status, type: r.headers.get('content-type'), cache: r.headers.get('cache-control') }; });
      await sleep(2500); const sw = await P.evaluate(async () => navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0);
      R.notes.manifest = { url: man.url, errors: man.errors, data: M, installabilityErrors: inst, head, fetched, serviceWorkers: sw };
      check('a valid manifest (Chromium parses it without errors): name, standalone display, start URL and scope at the game itself, dark theme and background; the page links it with viewport-fit=cover and the app metadata; no service worker (no offline mode, no stale builds)',
        man.errors.length === 0 && M.display === 'standalone' && M.start_url === '/' && M.scope === '/' && M.name === 'The Far Backrooms' && /^#/.test(M.theme_color) && /^#/.test(M.background_color)
        && /manifest\.webmanifest$/.test(head.manifest) && /viewport-fit=cover/.test(head.viewport) && head.apple === 'yes' && head.bar === 'black-translucent' && fetched.status === 200 && sw === 0,
        { errors: man.errors, installabilityErrors: inst, display: M.display, start: M.start_url, icons: M.icons, fetched, sw });
      // the browser tab is still the ordinary way to play; Help explains installing, once, without a banner
      const tab = await P.evaluate(() => ({ standalone: __ui.standalone(), banner: !!document.querySelector('[data-install-banner]') }));
      await P.evaluate(() => __ui.go('help')); await sleep(700);
      const help = await P.evaluate(() => document.querySelector('#uiHelp [data-help-app]').textContent);
      await U.start(P, 'Tab'); const ran = await P.evaluate(() => __api.started());
      R.errors.push(...s.errs.map(e => 'app: ' + e)); await s.ctx.close();
      const s2 = await U.page(b, PORT, { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2, init: () => { try { Object.defineProperty(navigator, 'standalone', { get: () => true }); } catch (e) { } } }), P2 = s2.P;
      await P2.evaluate(() => __ui.go('help')); await sleep(700);
      const help2 = await P2.evaluate(() => ({ standalone: __ui.standalone(), text: document.querySelector('#uiHelp [data-help-app]').textContent }));
      R.errors.push(...s2.errs.map(e => 'app2: ' + e)); await s2.ctx.close();
      check('in a browser tab the game plays as always, with no install banner; Help explains Add to Home Screen for iPhone / iPad and Android; launched as an app, Help says so instead',
        !tab.standalone && !tab.banner && ran && /Add to Home Screen/.test(help) && /Android/.test(help) && help2.standalone && /installed app/.test(help2.text), { tab, ran, help: help.slice(0, 160), help2 });
    }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
