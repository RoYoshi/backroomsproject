/* Stage 3C QA2, QA2-2 - the user's logo on a black menu, checked in a browser (development only; never served).
 *
 *   node dev/stage-3c-qa2/probe_b2.js [--game DIR] [--port 9831] [--out FILE.json] [--shots DIR]
 *
 *  - the logo is the user's file, unaltered: the served bytes' SHA-256, its natural size, its aspect ratio on screen, no filter,
 *    blend or opacity change, the sign box mapped exactly; and pixel by pixel the sign on screen equals the file drawn on black;
 *  - the field around the menu is black on the menu, the PLAY entry, Settings, Credits, Help and Customize opened from the menu (every
 *    pixel outside the menu's own parts at most 10 of 255), and the world's layers are not drawn to the screen there;
 *  - a run shows the world again (and no logo); NEW RUN -> END brings the black menu back; Customize from the pause shows the world;
 *  - the layouts at 1920x1080, 1366x768, 1280x720, 390x844, 844x390, 360x640, 667x375 and 640x360: logo centred and high, the LEVEL 0
 *    line right above PLAY, PLAY the largest control, the row under it, both rails, nothing overlapping or off screen, and the logo
 *    never drawn above its own resolution (sharp);
 *  - the logo's request failing leaves the boot black with "the menu artwork did not load" and RETRY;
 *  - its fluorescent dip is the only motion on it, and reduced motion stops it.
 * Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const Q = require('./qa2_lib.js'); const { sleep } = Q;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', path.join(__dirname, '..', '..'))), PORT = +opt('port', 9831), OUT = opt('out', null);
const SHOTS = path.resolve(opt('shots', path.join(__dirname, 'evidence', 'q2')));
const LOGO = path.join(GAME, 'assets', 'MAIN_MENU_LOGO_USER_SUPPLIED.png'), LOGO_SHA = '906e19a8f4423bc7b2a7bf924a05201b3b2ba2c13753df3eec6eb6abc9cb9cb9';
const R = { game: GAME, checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 700) : '')); };
const py = (script, args) => { const r = spawnSync('python3', ['-I', path.join(__dirname, script)].concat(args), { encoding: 'utf8', timeout: 120000 }); try { return JSON.parse(r.stdout); } catch (e) { return { error: (r.stderr || r.stdout || '').slice(0, 300) }; } };
/* the menu's own parts (with a small margin for their own glows): everything else on screen is the field */
const PARTS = () => {
  const out = []; const add = (sel, m = 6) => document.querySelectorAll(sel).forEach(e => { if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return; const b = e.getBoundingClientRect(); out.push([b.left - m, b.top - m, b.right + m, b.bottom + m]); });
  ['#mmTitle', '#menu .mm-rail', '#menu .mm-util', '#menu .mm-stage', '#menu .mm-foot', '#mmEntry', '.ui-sheet:not([hidden]) .us-card', '#appearancePanel:not([hidden]) .appearance-card'].forEach(s => add(s));
  return out;
};
const LAYOUT = () => {
  const r = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const box = { logo: r('#mmTitle'), rail: r('#menu .mm-rail'), util: r('#menu .mm-util'), dest: r('#menu .mm-dest'), play: r('#mmPlay'), row: r('#menu .mm-row'), foot: r('#menu .mm-foot') };
  const hit = (a, c) => a && c && a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1, names = Object.keys(box).filter(k => box[k]), over = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = names[i], c = names[j]; if ((a === 'dest' && c === 'play') || (a === 'play' && c === 'row')) continue; if (hit(box[a], box[c])) over.push(a + '/' + c); }
  const off = names.filter(k => { const c = box[k]; return c.l < -1 || c.t < -1 || c.r > innerWidth + 1 || c.b > innerHeight + 1; });
  const ctrls = [...document.querySelectorAll('#menu button, #menu input')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => { const b = e.getBoundingClientRect(); return [e.id || e.className, Math.round(b.width * b.height)]; });
  const biggest = ctrls.sort((a, c) => c[1] - a[1])[0];
  const img = document.getElementById('mmLogo'), ib = img.getBoundingClientRect();
  return { W: innerWidth, H: innerHeight, dpr: devicePixelRatio, box, over, off, biggest: biggest && biggest[0],
    centred: box.logo && Math.abs((box.logo.l + box.logo.r) / 2 - innerWidth / 2) < 2, playCentred: box.play && Math.abs((box.play.l + box.play.r) / 2 - innerWidth / 2) < 2,
    order: box.logo && box.dest && box.play && box.row && box.logo.b <= box.dest.t && box.dest.b <= box.play.t + 1 && box.play.b <= box.row.t + 2,
    destRightAbovePlay: box.dest && box.play && box.play.t - box.dest.b < 20,
    deviceSignWidth: box.logo && Math.round(box.logo.w * devicePixelRatio), imgRatio: +(ib.width / ib.height).toFixed(4) };
};
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await Q.serve(GAME, PORT), b = await Q.browser();
  try {
    /* ---------- the logo is the user's file, unaltered */
    { const s = await Q.page(b, PORT, { viewport: { width: 1920, height: 1080 } }), P = s.P;
      await sleep(800);
      const L = await P.evaluate(async () => {
        const buf = await (await fetch('./assets/MAIN_MENU_LOGO_USER_SUPPLIED.png', { cache: 'no-store' })).arrayBuffer();
        const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(x => x.toString(16).padStart(2, '0')).join('');
        const img = document.getElementById('mmLogo'), t = document.getElementById('mmTitle'), ib = img.getBoundingClientRect(), tb = t.getBoundingClientRect();
        const chain = []; for (let e = img; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); chain.push({ el: e.id || e.className, filter: c.filter, blend: c.mixBlendMode, opacity: c.opacity }); }
        const tr = getComputedStyle(t).transform, m = /matrix\(([^)]+)\)/.exec(tr), mv = m ? m[1].split(',').map(Number) : [1, 0, 0, 1];
        return { sha, bytes: buf.byteLength, natural: [img.naturalWidth, img.naturalHeight], src: img.getAttribute('src'), alt: img.alt, inH1: img.parentElement.tagName === 'H1',
          ratio: +(ib.width / ib.height).toFixed(4), signLeft: +(ib.left + ib.width * 409 / 2048 - tb.left).toFixed(2), signTop: +(ib.top + ib.height * 410 / 1152 - tb.top).toFixed(2),
          signW: +(ib.width * 1230 / 2048 - tb.width).toFixed(2), signH: +(ib.height * 422 / 1152 - tb.height).toFixed(2), chain, scale: [mv[0], mv[3]],
          box: [tb.left, tb.top, tb.width, tb.height], hum: t.classList.contains('hum'), animations: img.getAnimations().length };
      });
      check('the logo is the user\'s file: the served bytes have the supplied SHA-256 (906e19a8...), 2048 x 1152, in the menu\'s H1 with alt text',
        L.sha === LOGO_SHA && L.natural[0] === 2048 && L.natural[1] === 1152 && L.inH1 && L.alt === 'The Far Backrooms', { sha: L.sha.slice(0, 16), bytes: L.bytes, natural: L.natural, src: L.src });
      check('drawn as supplied: its aspect ratio kept (no stretch), no filter, blend or opacity change on it or above it, no uneven scaling, and its sign box mapped exactly onto the title box (no crop of the sign)',
        Math.abs(L.ratio - 2048 / 1152) < .005 && L.chain.every(c => c.filter === 'none' && c.blend === 'normal' && +c.opacity === 1) && Math.abs(L.scale[0] - L.scale[1]) < 1e-6
          && Math.abs(L.signLeft) < .6 && Math.abs(L.signTop) < .6 && Math.abs(L.signW) < .6 && Math.abs(L.signH) < .6, { ratio: L.ratio, signOffset: [L.signLeft, L.signTop, L.signW, L.signH], chain: L.chain.slice(0, 4), scale: L.scale });
      let tries = 0; while ((await P.evaluate(() => document.getElementById('mmTitle').classList.contains('hum'))) && tries++ < 20) await sleep(200);   // not during a fluorescent dip
      const shot = path.join(SHOTS, 'b2_1920x1080_menu.png'); await P.screenshot({ path: shot });
      const M = py('logo_match.py', [shot, LOGO].concat(L.box.map(String)));
      R.notes.logoMatch = M;
      check('pixel by pixel the sign on screen is the file drawn on black: mean difference under 2 of 255, the same mean colour (no recolour), correlation above 0.99',
        M.meanAbsDiff < 2 && M.correlation > .99 && M.meanColourOnScreen.every((c, i) => Math.abs(c - M.meanColourOfFile[i]) < 1.5), M);
      R.errors.push(...s.errs.map(e => 'logo: ' + e)); await s.ctx.close(); }

    /* ---------- the black field, and the world only in a run */
    { const s = await Q.page(b, PORT, { viewport: { width: 1920, height: 1080 } }), P = s.P;
      const world = () => P.evaluate(() => ({ black: document.documentElement.classList.contains('tfb-black'), scrim: getComputedStyle(document.querySelector('.mm-scrim')).backgroundColor, menu: !document.getElementById('menu').hidden }));
      const field = async (tag) => { const f = path.join(SHOTS, `b2_field_${tag}.png`); await P.screenshot({ path: f, timeout: 90000 }); return Object.assign(py('black_field.py', [f, JSON.stringify(await P.evaluate(PARTS)), '--limit', '10']), { world: await world() }); };
      const views = {};
      views.menu = await field('menu');
      await P.evaluate(() => __ui.go('play')); await sleep(900); views.entry = await field('entry'); await P.evaluate(() => __ui.go('home')); await sleep(500);
      for (const v of ['settings', 'credits', 'help']) { await P.evaluate(v => __ui.go(v), v); await sleep(900); views[v] = await field(v); await P.evaluate(() => __ui.go('home')); await sleep(500); }
      await P.evaluate(() => __ui.go('customize', 'wanderer')); await sleep(1200); views.customize = await field('customize'); await P.evaluate(() => __ui.go('home')); await sleep(600);
      R.notes.field = views;
      check('the field is black on the menu, the PLAY entry, Settings, Credits, Help and Customize opened from the menu: no pixel outside the menu\'s own parts above 10 of 255 (the scrim opaque black, the page behind black)',
        Object.values(views).every(v => v.shareAboveLimit === 0 && v.world.black && v.world.scrim === 'rgb(0, 0, 0)'), Object.fromEntries(Object.entries(views).map(([k, v]) => [k, [v.shareAboveLimit, v.brightest, v.world.black]])));
      // into a run: the world, not the logo
      // (QA2-3: a run starts behind the black curtain; the world is looked at once it has lifted)
      await Q.start(P, 'Black'); await P.waitForFunction(() => window.__boot && __boot.state() === 'playing' && document.getElementById('boot').hidden, null, { timeout: 30000 }).catch(() => { }); await sleep(1500);
      const run = await world(), runShot = path.join(SHOTS, 'b2_run.png'); await P.screenshot({ path: runShot });
      const runField = py('black_field.py', [runShot, '[]', '--limit', '10']);
      await P.keyboard.press('Escape'); await sleep(600); await P.click('#pauseCustomize'); await sleep(1200); const pc = await world(); await P.keyboard.press('Escape'); await sleep(600); await P.keyboard.press('Escape'); await sleep(600);
      await P.keyboard.press('Escape'); await sleep(500); await P.click('#reset'); await P.waitForFunction(() => __ui.state() === 'run', null, { timeout: 15000 }).catch(() => { });
      const rm = await world(); await P.click('#runEnd'); await sleep(1200); const back = await world();
      check('a run shows the world (the black field and the logo gone); Customize from the pause shows the world behind it; the run menu (NEW RUN) as before; END brings the black menu back',
        !run.black && !run.menu && runField.shareAboveLimit > .2 && !pc.black && !rm.black && back.black && back.menu, { run, litShare: runField.shareAboveLimit, pauseCustomize: pc, runMenu: rm, back });
      R.errors.push(...s.errs.map(e => 'field: ' + e)); await s.ctx.close(); }

    /* ---------- layouts */
    const SIZES = [[1920, 1080, 0], [1366, 768, 0], [1280, 720, 0], [390, 844, 1], [844, 390, 1], [360, 640, 1], [667, 375, 1], [640, 360, 1]];
    const lay = {}, bad = [];
    for (const [w, h, m] of SIZES) {
      const s = await Q.page(b, PORT, { viewport: { width: w, height: h }, mobile: !!m, gate: m ? 'tap' : 'key' }), P = s.P; await sleep(800);
      const L = await P.evaluate(LAYOUT); const tag = `${w}x${h}${m ? 'm' : ''}`; lay[tag] = L;
      await P.screenshot({ path: path.join(SHOTS, `b2_${tag}_menu.jpg`), type: 'jpeg', quality: 88 });
      if (!(L.box.logo && L.box.rail && L.box.util && !L.over.length && !L.off.length && L.centred && L.playCentred && L.order && L.destRightAbovePlay && /mmPlay|mm-play/.test(L.biggest || '') && L.deviceSignWidth <= 1230 * 1.1 && Math.abs(L.imgRatio - 2048 / 1152) < .005)) bad.push(tag);
      R.errors.push(...s.errs.map(e => tag + ': ' + e)); await s.ctx.close();
    }
    R.notes.layouts = lay;
    check('layouts at 1920x1080, 1366x768, 1280x720, 390x844, 844x390, 360x640, 667x375 and 640x360: the logo centred and high, then the LEVEL 0 line right above PLAY, PLAY the largest control and centred, the row under it, both rails; nothing overlapping or off screen; the logo never drawn above its own resolution',
      !bad.length, { bad, logo: Object.fromEntries(Object.entries(lay).map(([k, v]) => [k, v.box.logo && [Math.round(v.box.logo.l), Math.round(v.box.logo.t), Math.round(v.box.logo.w), Math.round(v.box.logo.h), v.deviceSignWidth]])) });

    /* ---------- the logo failing to load */
    { const s = await Q.page(b, PORT, { viewport: { width: 1280, height: 720 }, gate: false, route: ['**/MAIN_MENU_LOGO_USER_SUPPLIED.png', r => r.abort()] });
      const st = await Q.bootState(s, ['menu', 'error'], 30000);
      const e = await s.ev(`({ st: __boot.state(), msg: document.getElementById('bootErrMsg').textContent, hidden: document.documentElement.classList.contains('tfb-boot') })`);
      check('the logo failing to load: the boot stays black with "the menu artwork did not load" and RETRY; the menu never shows without its logo', st === 'error' && e.msg.includes('the menu artwork did not load') && e.hidden, e);
      await s.ctx.close(); }

    /* ---------- the fluorescent dip; reduced motion */
    for (const reduced of [false, true]) {
      const s = await Q.page(b, PORT, { viewport: { width: 1280, height: 720 }, reduced }), P = s.P;
      const a = await P.evaluate(() => { const t = document.getElementById('mmTitle'); t.classList.add('hum'); const n = getComputedStyle(document.getElementById('mmLogo')).animationName; t.classList.remove('hum'); return n; });
      R.notes['hum' + (reduced ? 'Reduced' : '')] = a;
      check(reduced ? 'reduced motion: the logo never dips' : 'the logo\'s only motion is its rare fluorescent dip (an opacity flicker of the whole image, under a second)', reduced ? a === 'none' : a === 'mmHum', a);
      await s.ctx.close();
    }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await Q.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
