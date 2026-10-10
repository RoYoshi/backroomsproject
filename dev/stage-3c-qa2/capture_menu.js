/* Stage 3C QA2 - main-menu captures with the user's logo on black (development only; never served).
 *
 *   node dev/stage-3c-qa2/capture_menu.js [--game DIR] [--port 9821] [--out DIR] [--tag q2] [--sizes 1920x1080,390x844m,...] [--views menu,entry,settings,customize]
 *
 * For each size (m = a touch phone at 2x; r = reduced motion): the menu once the boot gate has opened it (passed with a key press if
 * the browser needs a gesture), then the PLAY entry, Settings and Customize opened from the menu. Writes TAG_<size>_<view>.jpg and
 * TAG_captures.json with the layout boxes (the logo's sign box, the rails, the LEVEL 0 line, PLAY and its row, the footer) and any
 * overlaps or off-screen parts. Fonts are the fallback faces (no Google Fonts here). */
'use strict';
const path = require('path'), fs = require('fs');
const Q = require('./qa2_lib.js'); const { sleep } = Q;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', path.join(__dirname, '..', '..'))), PORT = +opt('port', 9821), TAG = opt('tag', 'q2');
const OUT = path.resolve(opt('out', path.join(__dirname, 'evidence', 'q2')));
const SIZES = opt('sizes', '1920x1080,1366x768,1280x720,1024x768,768x1024m,430x932m,390x844m,360x640m,844x390m,667x375m,640x360m,1920x1080r').split(',');
const VIEWS = opt('views', 'menu,entry,settings,customize').split(',');
const BOXES = () => {
  const r = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  const box = { logo: r('#mmTitle'), rail: r('#menu .mm-rail'), util: r('#menu .mm-util'), dest: r('#menu .mm-dest'), play: r('#mmPlay'), row: r('#menu .mm-row'), foot: r('#menu .mm-foot'), entry: r('#mmEntry') };
  const hit = (a, b) => a && b && a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;
  const names = Object.keys(box).filter(k => box[k]), over = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = names[i], c = names[j]; if ((a === 'dest' && c === 'play') || (a === 'play' && c === 'row')) continue; if (hit(box[a], box[c])) over.push(a + '/' + c); }
  const off = names.filter(k => { const b = box[k]; return b[0] < -1 || b[1] < -1 || b[2] > innerWidth + 1 || b[3] > innerHeight + 1; });
  return { W: innerWidth, H: innerHeight, box, over, off, tight: document.getElementById('menu').classList.contains('mm-tight') };
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await Q.serve(GAME, PORT), b = await Q.browser(), R = { game: GAME, shots: [], layout: {}, errors: [] };
  const jpg = async (P, name) => { await Q.shot(P, path.join(OUT, name), { type: 'jpeg', quality: 88 }); R.shots.push(name); };
  try {
    for (const z of SIZES) {
      const mobile = /m/.test(z), reduced = /r/.test(z), [w, h] = z.replace(/[mr]/g, '').split('x').map(Number);
      const s = await Q.page(b, PORT, { viewport: { width: w, height: h }, mobile, reduced, gate: mobile ? 'tap' : 'key' }), P = s.P;
      await sleep(1200);
      R.layout[z] = { menu: await P.evaluate(BOXES) };
      if (VIEWS.includes('menu')) await jpg(P, `${TAG}_${z}_menu.jpg`);
      if (VIEWS.includes('entry')) { await P.evaluate(() => __ui.go('play')); await sleep(900); R.layout[z].entry = await P.evaluate(BOXES); await jpg(P, `${TAG}_${z}_entry.jpg`); await P.evaluate(() => __ui.go('home')); await sleep(600); }
      if (VIEWS.includes('settings') && !mobile || VIEWS.includes('settings') && z === '390x844m') { await P.evaluate(() => __ui.go('settings', 'hud')); await sleep(900); await jpg(P, `${TAG}_${z}_settings.jpg`); await P.evaluate(() => __ui.go('home')); await sleep(600); }
      if (VIEWS.includes('customize') && (z === '1920x1080' || z === '390x844m')) { await P.evaluate(() => __ui.go('customize', 'wanderer')); await sleep(1200); await jpg(P, `${TAG}_${z}_customize.jpg`); await P.evaluate(() => __ui.go('home')); await sleep(600); }
      R.errors.push(...s.errs.map(e => z + ': ' + e)); await s.ctx.close();
    }
  } catch (e) { R.errors.push('capture: ' + (e && e.stack || e)); console.log(e); }
  finally { await Q.close(b, srv); }
  fs.writeFileSync(path.join(OUT, `${TAG}_captures.json`), JSON.stringify(R, null, 1) + '\n');
  for (const [z, l] of Object.entries(R.layout)) console.log(z, 'logo', JSON.stringify(l.menu.box.logo), 'over', l.menu.over.join(' '), 'off', l.menu.off.join(' '), l.entry ? 'entry over ' + l.entry.over.join(' ') + (l.entry.tight ? ' (title stepped back)' : '') : '');
  console.log(R.errors.length ? 'ERRORS ' + JSON.stringify(R.errors) : 'done');
})();
