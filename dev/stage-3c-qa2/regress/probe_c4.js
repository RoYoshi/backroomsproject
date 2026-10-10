/* ADAPTED COPY of dev/stage-3c-qa1/first_candidate/probe_c4.js for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.
 *   - helpers from ui_lib_gate.js: each page passes the QA2 boot and its ready gate (one key press, as a player would) before the probe acts on it
 *   - QA2-2: the title is the user's logo (an image, #mmLogo) instead of QA1's two lines of lettering; the title's occasional hum (the same mmHum keyframes) now dims the image, so the forced hum is read from it
 */
/* ADAPTED COPY of dev/stage-3c/probe_c4.js for Stage 3C QA1 - written by dev/stage-3c-qa1/first_candidate/run.js; do not edit by hand.
 *   - QA1 Q1: the fixture's flicker is now the title's occasional hum (the same mmHum keyframes); the copy forces a hum and reads its animation
 */
/* Stage 3C C4 - settings, migration and accessibility, checked in a browser (development only; never served).
 *
 *   node dev/stage-3c/probe_c4.js [--game DIR] [--port 9614] [--out FILE.json]
 *
 * A pre-3C fb_settings_v1 save loads unchanged (colour, size, opacity, toggles, volume), gains rm = 'auto' and is written back
 * complete; damaged values fall back to their defaults; the Settings page shows the saved values. Reduced motion: System follows
 * the device, On and Off override it, the choice survives a reload from the first frame. Keyboard: the page list and every radio
 * group move with the arrow keys, Tab stays in the sheet, Escape closes it. Only real controls: no zoom or awareness setting. Text
 * tokens meet 4.5:1 on the panels. Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib_gate.js'); const { sleep } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..', '..')), PORT = +(opt('port') || 9614), OUT = opt('out');
const R = { checks: [], errors: [] };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + (typeof note === 'string' ? note : JSON.stringify(note)) : '')); };
const OLD = { c: '#ff6b5e', s: 1.3, o: 0.7, keys: false, coords: true, title: false, auto: true, vol: 0.4 };
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    { const s = await U.page(b, PORT, { storage: { fb_settings_v1: JSON.stringify(OLD) } }); const P = s.P;
      const m = await P.evaluate(() => ({ model: __settings.get(), stored: JSON.parse(localStorage.getItem('fb_settings_v1')), hs: getComputedStyle(document.documentElement).getPropertyValue('--hs').trim(),
        cls: ['hud-nokeys', 'hud-notitle', 'hud-nocoords', 'hudc'].filter(c => document.body.classList.contains(c)) }));
      const same = Object.entries({ c: '#ff6b5e', s: 1.3, o: 0.7, keys: false, coords: true, title: false, auto: true, vol: 0.4 }).every(([k, v]) => m.model[k] === v && m.stored[k] === v);
      check('a pre-3C fb_settings_v1 save loads unchanged, gains rm = "auto", and is written back complete', same && m.model.rm === 'auto' && m.stored.rm === 'auto' && m.hs === '1.3' && m.cls.join() === 'hud-nokeys,hud-notitle,hudc', m);
      await P.evaluate(() => __ui.go('settings', 'hud')); await sleep(700);
      const ui = await P.evaluate(() => ({ size: document.getElementById('stSizeV').textContent, op: document.getElementById('stOpV').textContent, keys: document.querySelector('#uiSettings [data-k="keys"]').getAttribute('aria-checked'),
        title: document.querySelector('#uiSettings [data-k="title"]').getAttribute('aria-checked'), red: document.querySelector('#stSw [data-c="#ff6b5e"]').getAttribute('aria-checked') }));
      await P.evaluate(() => __ui.go('settings', 'sound')); await sleep(400);
      const vol = await P.evaluate(() => document.getElementById('stVolV').textContent);
      check('the Settings page shows the saved values', ui.size === '130%' && ui.op === '70%' && ui.keys === 'false' && ui.title === 'false' && ui.red === 'true' && vol === '40%', { ui, vol });
      // keyboard: page list with arrows; a radio group with arrows; Tab stays inside; Escape closes
      await P.focus('#stTab_sound'); await P.keyboard.press('ArrowDown'); await P.keyboard.press('ArrowDown'); await sleep(300);
      const pg = await P.evaluate(() => ({ focus: document.activeElement.id, shown: [...document.querySelectorAll('#uiSettings .us-page')].filter(x => !x.hidden).map(x => x.id) }));
      await P.focus('#stRm [aria-checked="true"]'); const r0 = await P.evaluate(() => __settings.get().rm);
      await P.keyboard.press('ArrowRight'); await sleep(200);
      const r1 = await P.evaluate(() => ({ rm: __settings.get().rm, focus: document.activeElement.dataset.rm, rmCls: document.documentElement.classList.contains('rm') }));
      await P.keyboard.press('ArrowLeft'); await sleep(200);
      const r2 = await P.evaluate(() => __settings.get().rm);
      let inside = true; for (let i = 0; i < 30; i++) { await P.keyboard.press('Tab'); if (!await P.evaluate(() => document.getElementById('uiSettings').contains(document.activeElement))) { inside = false; break; } }
      check('keyboard: arrows move through the pages and a radio group (choosing as they go); Tab stays in Settings', pg.focus === 'stTab_graphics' && pg.shown.join() === 'stPage_graphics' && r0 === 'auto' && r1.rm === 'on' && r1.focus === 'on' && r1.rmCls && r2 === 'auto' && inside, { pg, r0, r1, r2, inside });
      // only real controls
      const fake = await P.evaluate(() => [...document.querySelectorAll('#uiSettings .us-page:not(#stPage_controls) button, #uiSettings .us-page:not(#stPage_controls) input, #uiSettings .us-page:not(#stPage_controls) .us-row > span')]
        .map(e => (e.getAttribute('aria-label') || '') + ' ' + e.textContent).filter(t => /zoom|awareness|field of view|fov|radar|minimap/i.test(t)));
      check('only real controls: no zoom, awareness, field-of-view or radar setting', !fake.length, fake);
      // contrast of the text tokens on the panels
      const con = await P.evaluate(() => {
        const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
        const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
        const cr = (a, b2) => { const x = lum(a), y = lum(b2); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        const out = {}; for (const f of ['--u-cream', '--u-text', '--u-mute', '--u-moss', '--u-moss-dim', '--u-sick-hi', '--u-danger-hi']) for (const g of ['--u-void', '--u-panel', '--u-panel2']) out[f + ' on ' + g] = +cr(v(f), v(g)).toFixed(2);
        out['--u-on-sick on --u-sick'] = +cr(v('--u-on-sick'), v('--u-sick')).toFixed(2); return out; });
      check('text tokens meet 4.5:1 on every panel (and dark text on the yellow buttons)', Object.values(con).every(x => x >= 4.5), con);
      await P.keyboard.press('Escape'); await sleep(100);
      const es = await P.waitForFunction(() => document.getElementById('uiSettings').hidden, null, { timeout: 8000 }).then(() => true, () => false);
      check('Escape closes Settings', es);
      R.errors.push(...s.errs.map(e => 'migration: ' + e)); await s.ctx.close(); }
    { const s = await U.page(b, PORT, { storage: { fb_settings_v1: JSON.stringify({ c: 'red', s: 9, o: -1, vol: 'x', rm: 'sideways', keys: true }) } }); const P = s.P;
      const d = await P.evaluate(() => __settings.get());
      check('damaged values fall back: colour to default, size and opacity clamped, volume to its default, reduced motion to System', d.c === '' && d.s === 2 && d.o === 0.3 && d.vol === 1 && d.rm === 'auto', d);
      R.errors.push(...s.errs.map(e => 'damaged: ' + e)); await s.ctx.close(); }
    // reduced motion: System follows the device; On / Off override; the choice holds from the first frame after a reload
    { const s = await U.page(b, PORT, { reduced: true }); const P = s.P;
      const a1 = await P.evaluate(() => ({ rm: document.documentElement.classList.contains('rm'), anim: (t => (t.classList.add('hum'), getComputedStyle(t.querySelector('.mm-logo')).animationName))(document.getElementById('mmTitle')) }));
      await P.evaluate(() => { __ui.go('settings', 'graphics'); }); await sleep(600); await P.click('#stRm [data-rm="off"]'); await sleep(300);
      const a2 = await P.evaluate(() => ({ rm: document.documentElement.classList.contains('rm'), anim: (t => (t.classList.add('hum'), getComputedStyle(t.querySelector('.mm-logo')).animationName))(document.getElementById('mmTitle')), note: document.getElementById('stRmNow').textContent }));
      check('System follows a device that asks for reduced motion; Off overrides it (the fixture hums again)', a1.rm && a1.anim === 'none' && !a2.rm && /mmHum/.test(a2.anim), { a1, a2 });
      R.errors.push(...s.errs.map(e => 'reduced: ' + e)); await s.ctx.close(); }
    { const s = await U.page(b, PORT, { reduced: false, storage: { fb_settings_v1: JSON.stringify({ rm: 'on' }) }, init: () => { window.__rmAtStart = null; document.addEventListener('DOMContentLoaded', () => { window.__rmAtStart = document.documentElement.classList.contains('rm'); }); } }); const P = s.P;
      const a3 = await P.evaluate(() => ({ atStart: window.__rmAtStart, rm: document.documentElement.classList.contains('rm'), enter: document.getElementById('menu').classList.contains('enter'), anim: (t => (t.classList.add('hum'), getComputedStyle(t.querySelector('.mm-logo')).animationName))(document.getElementById('mmTitle')) }));
      check('a saved "On" holds from the first frame on a device that does not ask (no entrance, no flicker)', a3.atStart === true && a3.rm && !a3.enter && a3.anim === 'none', a3);
      await U.start(P, 'Still'); await sleep(1200);
      const a4 = await P.evaluate(() => ({ walk: getComputedStyle(document.querySelector('#hud .walk')).animationName, obj: getComputedStyle(document.querySelector('.hud-obj .objective')).animationName }));
      check('reduced motion also stills the HUD entrance', a4.walk === 'none' && a4.obj === 'none', a4);
      R.errors.push(...s.errs.map(e => 'saved-on: ' + e)); await s.ctx.close(); }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
