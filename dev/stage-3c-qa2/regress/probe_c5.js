/* ADAPTED COPY of dev/stage-3c-qa1/first_candidate/probe_c5.js for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.
 *   - helpers from ui_lib_gate.js: each page passes the QA2 boot and its ready gate (one key press, as a player would) before the probe acts on it
 */
/* ADAPTED COPY of dev/stage-3c/probe_c5.js for Stage 3C QA1 - written by dev/stage-3c-qa1/first_candidate/run.js; do not edit by hand.
 *   - QA1 Q1: after END, ENTER LEVEL 0 is in the entry that PLAY opens. The check still requires exactly one join
 *   - QA1 Q1: PLAY is #mmPlay; ENTER LEVEL 0 is measured in the entry PLAY opens (then Escape closes it)
 */
/* Stage 3C C5 - integration: credits, keys, Escape, idle UI work, responsive layout (development only; never served).
 *
 *   node dev/stage-3c/probe_c5.js [--game DIR] [--port 9615] [--out FILE.json] [--shots DIR]
 *
 * Credits: the page is built from window.TFB_CREDITS (assets/credits_data.js): a section added there appears, an empty one does
 * not, the Backrooms Wiki / CC BY-SA attribution is there. Keys: arrows on a Settings slider and W held while the sheet is open
 * (over the paused run) change the setting and never move the wanderer, and no key is stuck afterwards. Escape: the menu
 * ignores it, a sheet closes, the pause resumes, customize closes, the inventory closes. Idle work: during play with every
 * menu closed no UI script schedules animation frames, and the customize preview does not draw. Responsive: the menu, Settings,
 * Credits and Customize at eight sizes from 360 x 640 touch to 1920 x 1080 without horizontal overflow, with PLAY / ENTER, the
 * sheet's Close and customize's Done on screen. Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib_gate.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..', '..')), PORT = +(opt('port') || 9615), OUT = opt('out'), SHOTS = opt('shots') && path.resolve(opt('shots'));
const R = { checks: [], errors: [] };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + (typeof note === 'string' ? note : JSON.stringify(note)) : '')); };
/* who asks for animation frames: each requestAnimationFrame call is attributed to the first script file on its stack */
const RAF = () => { const raf = window.requestAnimationFrame.bind(window); window.__rafBy = {}; window.__rafOn = false;
  window.requestAnimationFrame = cb => { if (window.__rafOn) { const st = (new Error().stack || '').split('\n').slice(2); const m = st.map(l => /\/([\w.\-]+\.js)/.exec(l)).find(Boolean); const k = m ? m[1] : '?'; window.__rafBy[k] = (window.__rafBy[k] || 0) + 1; } return raf(cb); }; };
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    { const s = await U.page(b, PORT, { init: RAF }); const P = s.P;
      // credits from the data file
      await P.evaluate(() => { TFB_CREDITS.sections.splice(1, 0, { heading: 'Playtesting (probe)', entries: [{ name: 'Probe Tester', note: 'added through credits_data' }] }, { heading: 'Empty (probe)', entries: [] }); });
      await P.click('#menu .mm-item[data-go="credits"]'); await sleep(700);
      const cr = await P.evaluate(() => { const el = document.getElementById('uiCredits'); return { heads: [...el.querySelectorAll('.cr-sec h3')].map(h => h.textContent), text: el.textContent, links: [...el.querySelectorAll('a')].map(a => a.href) }; });
      check('Credits are built from credits_data.js: an added section appears, an empty one does not; the wiki and CC BY-SA attribution and the software are there',
        cr.heads.includes('Playtesting (probe)') && /Probe Tester/.test(cr.text) && !cr.heads.includes('Empty (probe)') && !cr.heads.includes('Design') && cr.links.some(h => /backrooms-wiki\.wikidot\.com\/level-0/.test(h)) && cr.links.some(h => /creativecommons\.org\/licenses\/by-sa\/3\.0/.test(h)) && /PixiJS/.test(cr.text), cr.heads);
      await P.keyboard.press('Escape'); await P.waitForFunction(() => document.getElementById('uiCredits').hidden, null, { timeout: 8000 }).catch(() => { });
      // Escape on the menu does nothing
      await P.keyboard.press('Escape'); await sleep(300);
      const e0 = await P.evaluate(() => ({ st: __ui.state(), started: __api.started(), sheets: document.querySelectorAll('.ui-sheet:not([hidden])').length }));
      // the run
      await U.start(P, 'Keys'); await U.admin(P); await H.stage(P); await H.place(P, 1200, 3408, 0, { light: true, kind: 'flashlight' }); await sleep(800);
      await P.keyboard.press('Escape'); await sleep(500); await P.click('#pauseSettings'); await sleep(600);
      await P.evaluate(() => __ui.go('settings', 'sound')); await sleep(400);
      const v0 = await P.evaluate(() => __settings.get().vol), p0 = await P.evaluate(() => [Math.round(__api.H.x), Math.round(__api.H.y)]);
      await P.focus('#stVol'); await P.keyboard.press('ArrowLeft'); await P.keyboard.press('ArrowLeft');
      await P.keyboard.down('KeyW'); await P.keyboard.down('KeyD'); await sleep(500); await P.keyboard.up('KeyW'); await P.keyboard.up('KeyD');
      const v1 = await P.evaluate(() => __settings.get().vol);
      await P.keyboard.press('Escape'); await P.waitForFunction(() => document.getElementById('uiSettings').hidden, null, { timeout: 8000 }).catch(() => { });
      const e1 = await P.evaluate(() => __ui.state());
      await P.keyboard.press('Escape'); await sleep(900);
      const p1 = await P.evaluate(() => ({ pos: [Math.round(__api.H.x), Math.round(__api.H.y)], keys: [...__api.keys], st: __ui.state() }));
      check('arrows on a Settings slider change it; W / D held in Settings (over the paused run) never move the wanderer and no key is left held', v1 < v0 && p1.pos[0] === p0[0] && p1.pos[1] === p0[1] && !p1.keys.length && p1.st === 'playing', { v0, v1, p0, p1 });
      // idle UI work during play
      await P.evaluate(() => { window.__rafBy = {}; window.__rafOn = true; }); await sleep(2500);
      const idle = await P.evaluate(() => { window.__rafOn = false; return { by: window.__rafBy, preview: window.__avatarApp && __avatarApp.ticker.started }; });
      const uiRaf = Object.keys(idle.by).filter(k => /^(ui|hud|inventory|credits_data)\.js$/.test(k));
      check('during play with every menu closed no UI script asks for animation frames and the customize preview is stopped', !uiRaf.length && idle.preview === false, idle);
      // Escape: customize closes (back to the pause), the pause resumes, the inventory closes
      await P.keyboard.press('Escape'); await sleep(400); await P.click('#pauseCustomize'); await sleep(700);
      const c0 = await P.evaluate(() => __ui.state()); await P.keyboard.press('Escape'); await sleep(600);
      const c1 = await P.evaluate(() => __ui.state()); await P.keyboard.press('Escape'); await sleep(500);
      const c2 = await P.evaluate(() => __ui.state()); await P.keyboard.press('Tab'); await sleep(500);
      const i0 = await P.evaluate(() => __inv.open); await P.keyboard.press('Escape'); await sleep(500);
      const i1 = await P.evaluate(() => ({ open: __inv.open, paused: __api.paused() }));
      check('Escape is consistent: ignored on the menu, closes a sheet, closes customize back to the pause, resumes from the pause, closes the inventory (without pausing)',
        e0.st === 'menu' && !e0.started && !e0.sheets && e1 === 'paused' && c0 === 'customize' && c1 === 'paused' && c2 === 'playing' && i0 === true && !i1.open && !i1.paused, { e0, e1, c0, c1, c2, i0, i1 });
      // win -> RESTART LEVEL 0; NEW RUN -> the run menu -> END -> the main menu -> ENTER LEVEL 0 again (one join)
      await P.evaluate(() => __api.win()); await sleep(600); await P.click('#playAgain'); await sleep(1500);
      const w1 = await P.evaluate(() => ({ st: __ui.state(), started: __api.started() }));
      await P.keyboard.press('Escape'); await sleep(500); await P.click('#reset'); await P.waitForFunction(() => __ui.state() === 'run', null, { timeout: 15000 }).catch(() => { });
      await P.click('#runEnd'); await sleep(900);
      const m1 = await P.evaluate(() => ({ st: __ui.state(), cls: document.body.classList.contains('ui-menu'), focus: document.activeElement && document.activeElement.dataset.go, header: getComputedStyle(document.querySelector('body > header')).visibility }));
      await P.evaluate(() => { window.__j0 = (window.__sent || []).filter(x => /"t":"join"/.test(x[1])).length; });
      await P.click('#mmPlay'); await sleep(900); await P.click('#enter'); await sleep(2000);
      const m2 = await P.evaluate(() => ({ st: __ui.state(), joins: (window.__sent || []).filter(x => /"t":"join"/.test(x[1])).length - window.__j0 }));
      check('win -> RESTART LEVEL 0 plays on; NEW RUN -> run menu -> END returns to the main menu (focus on PLAY, HUD hidden); ENTER LEVEL 0 starts exactly one new run',
        w1.st === 'playing' && w1.started && m1.st === 'menu' && m1.cls && m1.focus === 'play' && m1.header === 'hidden' && m2.st === 'playing' && m2.joins === 1, { w1, m1, m2 });
      R.errors.push(...s.errs.map(e => 'desktop: ' + e)); await s.ctx.close(); }
    // responsive matrix
    const SIZES = [[1920, 1080, 0], [1366, 768, 0], [1280, 720, 0], [1024, 768, 0], [768, 1024, 1], [390, 844, 1], [844, 390, 1], [360, 640, 1]];
    const bad = [];
    for (const [W, Hh, m] of SIZES) {
      const tag = `${W}x${Hh}${m ? ' touch' : ''}`;
      const s = await U.page(b, PORT, Object.assign({ viewport: { width: W, height: Hh } }, m ? { mobile: true, dpr: 2 } : {})); const P = s.P;
      const vis = sel => P.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), over: document.documentElement.scrollWidth - innerWidth }; }, sel);
      const inside = (r, needBottom) => r && r.x >= 0 && r.r <= W + 1 && r.over <= 0 && (!needBottom || r.b <= Hh + 1);
      const play = await vis('#mmPlay'); await P.click('#mmPlay'); await sleep(900); const menu = await vis('#enter'); await P.keyboard.press('Escape'); await sleep(900);
      const menuOver = await P.evaluate(() => { const m = document.getElementById('menu'); return m.scrollWidth - m.clientWidth; });
      if (!inside(menu) || !inside(play, true) || menuOver > 0) bad.push([tag, 'menu', menu, play, menuOver]);
      if (SHOTS) await U.shot(P, path.join(SHOTS, `c5_resp_${W}x${Hh}_menu.png`));
      await P.evaluate(() => __ui.go('settings', 'hud')); await sleep(700);
      const st = await vis('#uiSettings .us-close'); if (!inside(st, true)) bad.push([tag, 'settings', st]);
      if (SHOTS && (m || W === 1366)) await U.shot(P, path.join(SHOTS, `c5_resp_${W}x${Hh}_settings.png`));
      await P.evaluate(() => __ui.go('credits')); await sleep(700);
      const cr = await vis('#uiCredits .us-close'); if (!inside(cr, true)) bad.push([tag, 'credits', cr]);
      await P.evaluate(() => __ui.go('customize', 'loadout')); await sleep(900);
      const cz = await vis('#doneAppearance'); if (!inside(cz, true)) bad.push([tag, 'customize', cz]);
      if (SHOTS && (m || W === 1366)) await U.shot(P, path.join(SHOTS, `c5_resp_${W}x${Hh}_customize.png`));
      R.errors.push(...s.errs.map(e => tag + ': ' + e)); await s.ctx.close();
    }
    check('responsive: menu (PLAY and ENTER), Settings, Credits and Customize fit 1920x1080, 1366x768, 1280x720, 1024x768 and 768x1024, 390x844, 844x390, 360x640 touch without horizontal overflow', !bad.length, bad);
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
