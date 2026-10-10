/* ADAPTED COPY of dev/stage-3c-qa1/probe_q5.js for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.
 *   - helpers from ui_lib_gate.js: each page passes the QA2 boot and its ready gate (one key press, as a player would) before the probe acts on it
 *   - the same default game folder (the repository root) from the copy's location
 */
/* Stage 3C QA1, Q5 - integration checks the earlier probes do not cover (development only; never served).
 *
 *   node dev/stage-3c-qa1/probe_q5.js [--game DIR] [--port 9751] [--out FILE.json] [--shots DIR]
 *
 * True darkness: in the forced blackout with the light off, the HUD's stamina meter and the LEVEL 0 reveal make no pixel of the
 *   world brighter (the test clock frozen, the film grain held still, the same frame captured with and without them).
 * Hidden UI does no work: on the idle main menu and during calm play with every menu closed, assets/ui.js, hud.js and
 *   inventory.js request no animation frames, and no UI animation runs.
 * The HUD settings reach the QA1 HUD: size, opacity and a custom colour on stamina and the location reveal; Reset HUD restores them.
 * The menu theme goes quiet in a hidden tab and carries on where it was when the tab comes back.
 * Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib_gate.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..', '..')), PORT = +(opt('port') || 9751), OUT = opt('out');
const SHOTS = path.resolve(opt('shots') || path.join(__dirname, 'evidence', 'q5'));
const R = { game: GAME, checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 700) : '')); };
/* who asks for animation frames: each requestAnimationFrame call is attributed to the first script file on its stack (as probe_c5) */
const RAF = () => { const raf = window.requestAnimationFrame.bind(window); window.__rafBy = {}; window.__rafOn = false;
  window.requestAnimationFrame = cb => { if (window.__rafOn) { const st = (new Error().stack || '').split('\n').slice(2); const m = st.map(l => /\/([\w.\-]+\.js)/.exec(l)).find(Boolean); const k = m ? m[1] : '?'; window.__rafBy[k] = (window.__rafBy[k] || 0) + 1; } return raf(cb); }; };
const UI_FILES = ['ui.js', 'hud.js', 'inventory.js'];
const uiAnims = () => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#menu,#hud,#hudReveal,.ui-sheet,#touch,#appearancePanel')).map(a => a.animationName || a.transitionProperty || '?');
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    /* ---------- hidden UI does no continuous work */
    { const s = await U.page(b, PORT, { viewport: { width: 1280, height: 720 }, init: RAF }), P = s.P;
      await sleep(4000);
      await P.evaluate(() => { window.__rafBy = {}; window.__rafOn = true; }); await sleep(4000);
      const menu = await P.evaluate(uiAnims);
      const menuRaf = await P.evaluate(() => { window.__rafOn = false; return window.__rafBy; });
      await U.start(P, 'Idle'); await U.admin(P); await H.stage(P); await P.evaluate(() => window.__clock && __clock.thaw());
      await sleep(7000);                                                     // the LEVEL 0 reveal has come and gone
      await P.evaluate(() => { window.__rafBy = {}; window.__rafOn = true; }); await sleep(4000);
      const play = await P.evaluate(uiAnims);
      const playRaf = await P.evaluate(() => { window.__rafOn = false; return window.__rafBy; });
      const ui = o => UI_FILES.reduce((n, f) => n + (o[f] || 0), 0);
      R.notes.rafByFile = { menuIdle: menuRaf, calmPlay: playRaf };
      check('hidden UI does no continuous work: the idle main menu and calm play request no animation frames from ui.js / hud.js / inventory.js, and no UI animation runs',
        ui(menuRaf) === 0 && ui(playRaf) === 0 && !menu.length && !play.length, { menuRaf, playRaf, menuAnims: menu, playAnims: play });
      R.errors.push(...s.errs.map(e => 'idle: ' + e)); await s.ctx.close(); }

    /* ---------- true darkness: the HUD lights nothing */
    { const s = await U.page(b, PORT, { viewport: { width: 1280, height: 720 } }), P = s.P;
      await U.start(P, 'Dark'); await U.admin(P); await H.stage(P);
      await H.setLights(P, 'on');                                           // the blackout, forced
      await H.place(P, 1296, 5136, Math.PI, { light: false, kind: 'flashlight' }); await P.evaluate(() => window.__clock && __clock.thaw()); await sleep(6500);
      await P.addStyleTag({ content: '.grain,#dread{animation:none!important;opacity:0!important} *{transition:none!important}' });
      await P.evaluate(() => __clock.freeze(true)); await H.settle(P);
      const hudOff = await P.screenshot({ type: 'png' });
      await P.evaluate(() => { document.body.classList.add('stam-on'); const r = document.getElementById('hudReveal'); r.className = 'hud-reveal entry in'; r.hidden = false;
        document.getElementById('rvEye').textContent = 'Threshold'; document.getElementById('rvTitle').textContent = 'Level 0'; document.getElementById('rvSub').textContent = 'Find a glitched wall'; document.getElementById('rvKeys').textContent = 'W A S D move'; });
      await U.frames(P, 3); await sleep(300);
      const hudOn = await P.screenshot({ type: 'png' });
      fs.writeFileSync(path.join(SHOTS, 'q5_true_darkness_hud_off.png'), hudOff); fs.writeFileSync(path.join(SHOTS, 'q5_true_darkness_hud_on.png'), hudOn);
      const boxes = await P.evaluate(() => [...document.querySelectorAll('#hud .staminaHud, #hud .staminaHud i, #rvEye, #rvTitle, #rvSub, #rvKeys, #hudPause')].map(e => { const b = e.getBoundingClientRect(); return [b.left - 4, b.top - 4, b.right + 4, b.bottom + 4]; }));
      // compare the two frames pixel by pixel in the page (canvas), outside the HUD's own text and bars
      const cmp = await P.evaluate(async ([a, c, boxes]) => {
        const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + src; });
        const [ia, ic] = await Promise.all([load(a), load(c)]); const W = ia.width, Hh = ia.height, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const g = cv.getContext('2d');
        g.drawImage(ia, 0, 0); const A = g.getImageData(0, 0, W, Hh).data; g.drawImage(ic, 0, 0); const C = g.getImageData(0, 0, W, Hh).data;
        const inBox = (x, y) => boxes.some(([l, t, r, bb]) => x >= l && x <= r && y >= t && y <= bb);
        let brighter = 0, maxUp = 0, darker = 0, n = 0, darkWorld = 0;
        for (let y = 0; y < Hh; y += 2) for (let x = 0; x < W; x += 2) { if (inBox(x, y)) continue; const i = (y * W + x) * 4; n++;
          const la = (A[i] + A[i + 1] + A[i + 2]) / 3, lc = (C[i] + C[i + 1] + C[i + 2]) / 3; if (la < 8) darkWorld++;
          if (lc > la + 2) { brighter++; maxUp = Math.max(maxUp, lc - la); } if (lc < la - 2) darker++; }
        return { sampled: n, brighter, maxUp: +maxUp.toFixed(1), darker, darkWorldShare: +(darkWorld / n).toFixed(3) };
      }, [hudOff.toString('base64'), hudOn.toString('base64'), boxes]);
      R.notes.trueDarkness = cmp;
      check('true darkness: in the blackout with the light off, showing stamina and the LEVEL 0 reveal brightens no pixel of the world outside their own text and bars (it may only darken)',
        cmp.brighter === 0 && cmp.darkWorldShare > .5, cmp);
      await P.evaluate(() => __clock.thaw()); await H.setLights(P, 'off');
      R.errors.push(...s.errs.map(e => 'dark: ' + e)); await s.ctx.close(); }

    /* ---------- the HUD settings (size, opacity, colour) reach what the QA1 HUD shows: stamina and the reveal */
    { const s = await U.page(b, PORT, { viewport: { width: 1280, height: 720 } }), P = s.P;
      await U.start(P, 'Size'); await U.admin(P); await H.stage(P); await P.evaluate(() => window.__clock && __clock.thaw()); await sleep(6500);
      const read = () => P.evaluate(async () => {
        document.body.classList.add('stam-on'); const r = document.getElementById('hudReveal'); r.className = 'hud-reveal entry in'; r.hidden = false; document.getElementById('rvTitle').textContent = 'Level 0';
        await new Promise(f => setTimeout(f, 2200));
        const m = s => { const t = getComputedStyle(s).transform; const v = /matrix\(([^)]+)\)/.exec(t); return v ? +(+v[1].split(',')[0]).toFixed(3) : 1; };
        const hud = document.getElementById('hud'), em = document.querySelector('#hud .staminaHud em'), t = document.getElementById('rvTitle');
        const o = { hudScale: m(hud), hudOpacity: +getComputedStyle(hud).opacity, bar: getComputedStyle(em).backgroundColor, revealScale: m(r), revealOpacity: +(+getComputedStyle(r).opacity).toFixed(2), title: getComputedStyle(t).color,
          titleW: Math.round(t.getBoundingClientRect().width) };
        r.className = 'hud-reveal'; r.hidden = true; return o; });
      const d0 = await read();
      await P.evaluate(() => { __settings.set('s', 1.5); __settings.set('o', .6); __settings.set('c', '#6fe6ff'); });
      const d1 = await read();
      await P.evaluate(() => __settings.set('s', .5)); const d2 = await read();
      await P.evaluate(() => __settings.reset('hud')); const d3 = await read();
      R.notes.hudSettings = { d0, d1, d2, d3 };
      check('the HUD settings still drive what the HUD shows: size scales stamina (and the reveal, within 0.8 to 1.2 so LEVEL 0 fits), opacity fades both, a custom colour tints the stamina bar and the location name; Reset HUD restores the default look',
        d0.hudScale === 1 && d0.revealScale === 1 && d0.hudOpacity === 1 && d0.revealOpacity === 1 && d0.title === 'rgb(239, 227, 180)' &&
        d1.hudScale === 1.5 && d1.revealScale === 1.2 && d1.hudOpacity === .6 && d1.revealOpacity === .6 && d1.bar === 'rgb(111, 230, 255)' && d1.title === 'rgb(111, 230, 255)' &&
        d2.hudScale === .5 && d2.revealScale === .8 && JSON.stringify(d3) === JSON.stringify(d0), { d0, d1, d2, d3 });
      R.errors.push(...s.errs.map(e => 'hud settings: ' + e)); await s.ctx.close(); }

    /* ---------- the menu theme is quiet in a hidden tab */
    { const s = await U.page(b, PORT, { viewport: { width: 1280, height: 720 } }), P = s.P;
      await P.click('#mmPlay'); for (let i = 0; i < 80; i++) { if ((await P.evaluate(() => __ui.theme.info().state)) === 'playing') break; await sleep(250); }
      const a = await P.evaluate(() => __ui.theme.info());
      const hide = h => P.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, h);
      await hide(true); await sleep(800); const hdn = await P.evaluate(() => __ui.theme.info()); await sleep(600); const hdn2 = await P.evaluate(() => __ui.theme.info());
      await hide(false); await sleep(800); const back = await P.evaluate(() => __ui.theme.info());
      check('the menu theme goes quiet in a hidden tab (its clock stops) and carries on from the same place when the tab is visible again (no restart)',
        a.state === 'playing' && hdn.ctx === 'suspended' && hdn2.now === hdn.now && back.ctx === 'running' && back.state === 'playing' && back.plays === a.plays && back.t0 === a.t0, { a: [a.state, a.ctx, a.plays], hidden: [hdn.ctx, hdn.now, hdn2.now], back: [back.state, back.ctx, back.plays] });
      R.errors.push(...s.errs.map(e => 'hidden: ' + e)); await s.ctx.close(); }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
