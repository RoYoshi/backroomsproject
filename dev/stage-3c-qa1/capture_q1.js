/* Stage 3C QA1, Q1 - main-menu captures (development only; never served).
 *
 *   node dev/stage-3c-qa1/capture_q1.js [--game DIR] [--port 9711] [--out DIR] [--sizes 1920x1080,390x844m,...] [--tag q1]
 *
 * For each size (a trailing m = a touch phone at 2x): the menu as a visitor first sees it (after its one entrance), then the
 * PLAY entry. "r" after the size = the system asks for reduced motion. Fonts: this machine cannot reach Google Fonts, so the
 * captures show the fallback faces named in ui.css (DejaVu Sans Condensed / Mono), not Barlow Condensed / IBM Plex Mono. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9711), TAG = opt('tag') || 'q1';
const OUT = path.resolve(opt('out') || path.join(__dirname, 'evidence', 'q1'));
const SIZES = (opt('sizes') || '1920x1080,1366x768,1280x720,1024x768,768x1024m,390x844m,360x640m,844x390m,640x360m,1920x1080r').split(',');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await U.serve(GAME, PORT), b = await U.browser(), R = { game: GAME, shots: [], errors: {} };
  try {
    for (const z of SIZES) {
      const mobile = /m/.test(z), reduced = /r/.test(z), [w, h] = z.replace(/[mr]/g, '').split('x').map(Number);
      const s = await U.page(b, PORT, { viewport: { width: w, height: h }, mobile, dpr: mobile ? 2 : 1, reduced });
      await sleep(2800);
      const name = `${TAG}_${z}`;
      await U.shot(s.P, path.join(OUT, name + '_menu.jpg'), { type: 'jpeg', quality: 86 }); R.shots.push(name + '_menu.jpg');
      await s.P.evaluate(() => __ui.go('play')); await sleep(900);
      await U.shot(s.P, path.join(OUT, name + '_entry.jpg'), { type: 'jpeg', quality: 86 }); R.shots.push(name + '_entry.jpg');
      R.errors[z] = s.errs; await s.ctx.close();
      console.log(z, s.errs.length ? s.errs : 'ok');
    }
  } finally { await U.close(b, srv); }
  fs.writeFileSync(path.join(OUT, TAG + '_captures.json'), JSON.stringify(R, null, 1) + '\n');
})();
