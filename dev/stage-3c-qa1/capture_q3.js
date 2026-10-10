/* Stage 3C QA1, Q3 - captures of the minimal HUD (development only; never served).
 *
 *   node dev/stage-3c-qa1/capture_q3.js [--game DIR] [--port 9733] [--out DIR] [--sizes 1920x1080,390x844m]
 *
 * For each size: a run begins (the LEVEL 0 reveal), calm play a few seconds later (almost only the world), sprinting (stamina
 * shows; desktop), the pause screen (the objective and the player's keys), Settings > Controls and Settings > HUD. Monsters
 * removed and frozen (the retained suites' test admin). Fonts are the fallback faces (no Google Fonts here). */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9733);
const OUT = path.resolve(opt('out') || path.join(__dirname, 'evidence', 'q3')), SIZES = (opt('sizes') || '1920x1080,390x844m').split(',');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await U.serve(GAME, PORT), b = await U.browser(), shots = [];
  const jpg = async (P, name) => { await U.shot(P, path.join(OUT, name), { type: 'jpeg', quality: 86 }); shots.push(name); };
  try {
    for (const z of SIZES) {
      const m = /m/.test(z), [W, Hh] = z.replace(/m/g, '').split('x').map(Number), tag = `q3_${z}`;
      const s = await U.page(b, PORT, { viewport: { width: W, height: Hh }, mobile: m, dpr: m ? 2 : 1 }), P = s.P;
      await U.start(P, 'Elias'); await U.admin(P); await H.stage(P);
      await H.place(P, 1200, 3408, -0.4, { light: true, kind: 'flashlight' }); await P.evaluate(() => window.__clock && __clock.thaw());
      await P.evaluate(() => { document.getElementById('hud').hidden = true; }); await sleep(300); await P.evaluate(() => { document.getElementById('hud').hidden = false; });
      await sleep(1400); await jpg(P, `${tag}_run_begins.jpg`);
      await sleep(6000); await jpg(P, `${tag}_calm.jpg`);
      if (!m) { await P.keyboard.down('ShiftLeft'); await P.keyboard.down('KeyD'); await sleep(1400); await jpg(P, `${tag}_sprinting.jpg`); await P.keyboard.up('KeyD'); await P.keyboard.up('ShiftLeft'); }
      await sleep(500); await P.evaluate(() => { const h = document.getElementById('help'); if (h) h.click(); }); await sleep(900); await jpg(P, `${tag}_pause.jpg`);
      await P.evaluate(() => __ui.go('controls')); await sleep(900); await jpg(P, `${tag}_settings_controls.jpg`);
      await P.evaluate(() => __ui.go('settings', 'hud')); await sleep(900); await jpg(P, `${tag}_settings_hud.jpg`);
      console.log(z, s.errs.length ? s.errs : 'ok'); await s.ctx.close();
    }
  } finally { await U.close(b, srv); }
  fs.writeFileSync(path.join(OUT, 'q3_captures.json'), JSON.stringify({ game: GAME, shots }, null, 1) + '\n');
})();
