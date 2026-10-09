/* Stage 3C - screenshots of every UI surface of one build (development only; never served).
 *
 *   node dev/stage-3c/capture_ui.js --game DIR --out DIR [--port 9601] [--only boot,hud,...] [--tag parent]
 *
 * Surfaces: boot (the page as it lands), play (Stage 3C's PLAY panel; the parent's entry), hud (Level 0, lit), dark (a
 * blackout, flashlight off: true darkness), darklight (blackout, flashlight on), customize, settings (each tab or page),
 * inventory (TAB), pause, caught, won, run (the run menu after NEW RUN), credits (Stage 3C), mobile (390 x 844 touch: boot, hud),
 * narrow (700 x 900 desktop), reduced (prefers-reduced-motion: boot).
 * Static panels the run state normally reaches by death or a win are shown through the game's own API where one exists
 * (__api.win) and otherwise by un-hiding the panel: what is captured is its presentation, nothing it does. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib.js'); const { H, sleep, frames } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), OUT = path.resolve(opt('out') || '/tmp/c3cap'), PORT = +(opt('port') || 9601), TAG = opt('tag') || path.basename(GAME);
const ONLY = opt('only') ? opt('only').split(',') : null, want = k => !ONLY || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });
const f = n => path.join(OUT, `${TAG}_${n}.png`), log = [];
const v3 = P => P.evaluate(() => !!(window.__ui && window.__ui.version));
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    { const s = await U.page(b, PORT);
      const P = s.P, is3 = await v3(P);
      if (want('boot')) { await sleep(2500); log.push(await U.shot(P, f('boot'))); }
      if (want('credits') && is3) { await P.evaluate(() => __ui.go('credits')); await sleep(1200); log.push(await U.shot(P, f('credits'))); await P.evaluate(() => __ui.go('home')); await sleep(600); }
      if (want('settings')) {
        if (is3) { for (const t of await P.evaluate(() => __ui.settingsPages())) { await P.evaluate(t => __ui.go('settings', t), t); await sleep(900); log.push(await U.shot(P, f('settings_' + t))); } await P.evaluate(() => __ui.go('home')); await sleep(600); }
        else { await P.click('#settingsBtn'); await sleep(500); for (const t of ['controls', 'custom', 'audio']) { await P.click(`#settings [data-tab="${t}"]`); await sleep(400); log.push(await U.shot(P, f('settings_' + t))); } await P.click('#settingsBtn'); await sleep(400); }
      }
      if (want('customize')) {
        if (is3) { for (const t of ['wanderer', 'loadout']) { await P.evaluate(t => __ui.go('customize', t), t); await sleep(1400); log.push(await U.shot(P, f('customize_' + t))); } await P.evaluate(() => __ui.go('home')); await sleep(600); }
        else { await P.evaluate(() => document.getElementById('customize').click()); await sleep(1500); log.push(await U.shot(P, f('customize'))); await P.evaluate(() => document.getElementById('doneAppearance').click()); await sleep(500); }
      }
      if (want('play')) { if (is3) { await P.evaluate(() => __ui.go('play')); await sleep(1200); } log.push(await U.shot(P, f('play'))); }
      await U.start(P, 'WANDERER'); await U.admin(P); await H.stage(P);
      await H.place(P, 1200, 3408, -0.4, { light: true, kind: 'flashlight' });
      await sleep(2500);
      if (want('hud')) log.push(await U.shot(P, f('hud')));
      if (want('inventory')) { await P.keyboard.press('Tab'); await sleep(900); log.push(await U.shot(P, f('inventory'))); await P.keyboard.press('Tab'); await sleep(400); }
      if (want('pause')) { await P.keyboard.press('Escape'); await sleep(900); log.push(await U.shot(P, f('pause'))); await P.keyboard.press('Escape'); await sleep(600); }
      if (want('dark') || want('darklight')) {
        await H.setLights(P, 'on'); await H.place(P, 1296, 5136, Math.PI, { light: false, kind: 'flashlight' }); await sleep(2500);
        if (want('dark')) log.push(await U.shot(P, f('dark')));
        if (want('darklight')) { await P.keyboard.press('KeyF'); await sleep(1500); log.push(await U.shot(P, f('darklight'))); }
        await H.setLights(P, 'off');
      }
      if (want('won')) { await P.evaluate(() => __api.win()); await sleep(1200); log.push(await U.shot(P, f('won'))); await P.evaluate(() => __api.unwin()); await sleep(400); }
      if (want('caught')) { await P.evaluate(() => { document.getElementById('caught').hidden = false; document.body.classList.add('captured'); }); await sleep(1200); log.push(await U.shot(P, f('caught'))); await P.evaluate(() => { document.getElementById('caught').hidden = true; document.body.classList.remove('captured'); }); await sleep(400); }
      if (want('run')) { await P.keyboard.press('Escape'); await sleep(600); await P.click('#reset'); await sleep(4200); log.push(await U.shot(P, f('run'))); }
      if (s.errs.length) log.push('errors: ' + s.errs.join(' | '));
      await s.ctx.close(); }
    if (want('mobile')) { const s = await U.page(b, PORT, { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2 }); await sleep(2500); log.push(await U.shot(s.P, f('mobile_boot')));
      if (await v3(s.P)) { await s.P.evaluate(() => __ui.go('play')); await sleep(1000); log.push(await U.shot(s.P, f('mobile_play'))); }
      await U.start(s.P, 'PHONE'); await sleep(3000); log.push(await U.shot(s.P, f('mobile_hud'))); if (s.errs.length) log.push('mobile errors: ' + s.errs.join(' | ')); await s.ctx.close(); }
    if (want('narrow')) { const s = await U.page(b, PORT, { viewport: { width: 700, height: 900 } }); await sleep(2500); log.push(await U.shot(s.P, f('narrow_boot'))); await s.ctx.close(); }
    if (want('reduced')) { const s = await U.page(b, PORT, { reduced: true }); await sleep(2500); log.push(await U.shot(s.P, f('reduced_boot'))); await s.ctx.close(); }
  } finally { await U.close(b, srv); }
  fs.writeFileSync(path.join(OUT, TAG + '_captures.txt'), log.join('\n') + '\n'); console.log(log.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
