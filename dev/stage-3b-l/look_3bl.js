/* Stage 3B-L (BR-RoLE 1.1) - the visual scenes, captured from the real client (development only; never served).
 *
 *   node dev/stage-3b-l/look_3bl.js [--game PATH] [--port 9476] [--out DIR] [--quality medium] [--scenes A,B,...] [--boost 6]
 *
 * 1920x1080 (the canonical 1.25 camera), the ceiling lamps forced on, no carried light (only the lamps light the scene),
 * monsters removed, the clock frozen.  Per scene: the screenshot with every UI layer hidden (<id>.png), the same image
 * brightened x boost (<id>_boost.png: only to SEE where faint light falls, never what a player sees) and the overlay's
 * alpha along the scene's profile line (scenes.json).  Run it on the parent tree and on BR-RoLE 1.1 for before / after.
 *
 * Scenes (BR_ROLE_1_1_NATURAL_FLUORESCENT_SPEC section 9):
 *   A open fluorescent room (YELLOW HALL)          B corridor out of a lit room, toward the BLACKOUT ZONE
 *   C corner: a corridor mouth, light around jambs  D closed wall vs opening: BLACKOUT ZONE beside the lit DAMP ROOMS
 *   E PILLAR HALL pillars                           F BLACKOUT ZONE (no lamps there)
 *   G several fixtures overlapping (REPEATING ROOMS) */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9476), OUT = path.resolve(opt('out') || '/tmp/look3bl'), Q = opt('quality') || 'medium', BOOST = +(opt('boost') || 6);
const WANT = (opt('scenes') || 'A,B,C,D,E,F,G').split(',');
const SPILL = opt('spill'), FADE = opt('sightfade');                        // DEV A/B (BR-RoLE 1.1 only): --spill 0, --sightfade 0
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const UI = 'header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag,#dread,.grain,#mp,#tip,#brRoleDebug';
const C = c => c * 96 + 48;
/* id, label, player x / y (world px), profile line [x0, y0, x1, y1] (world px; the overlay is sampled along it) */
const SCENES = [
  ['A', 'open fluorescent room (YELLOW HALL)', C(12), C(35), [C(5), 2832, C(5) + 700, 2832]],
  ['B', 'corridor out of YELLOW HALL toward the BLACKOUT ZONE', C(11.5), C(46), [C(11.5), 3792, C(11.5), 3792 + 900]],
  ['C', 'corridor mouth: NORTH ROOMS / corridor / YELLOW HALL', C(11.5), C(22.5), [C(11.5), 1392, C(11.5), 2832]],
  ['D', 'BLACKOUT ZONE beside the DAMP ROOMS: thick wall (closed) and the passage (open)', C(17), C(54), [C(21.5), C(50), C(21.5), C(59)]],
  ['E', 'PILLAR HALL pillars', C(84), C(13), [C(78), C(12), C(91), C(12)]],
  ['F', 'BLACKOUT ZONE', C(13), C(56), [C(5), C(56), C(21), C(56)]],
  ['G', 'several fixtures overlapping (REPEATING ROOMS)', C(34), C(34), [C(26), C(34), C(43), C(34)]],
];
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { game: GAME, quality: Q, scenes: [] };
  try {
    const J = await H.join(browser, PORT, 'look' + Date.now() % 1e5, 'LOOK', { viewport: { width: 1920, height: 1080 }, query: '&lighting=' + Q }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    R.version = await P.evaluate(() => window.__brRole && __brRole.version);
    R.spill = await P.evaluate(v => { const d = window.__brRole && __brRole.dev; return d && d.spill ? d.spill(v === null ? undefined : v !== '0') : null; }, SPILL);
    R.sightFade = await P.evaluate(v => { const d = window.__brRole && __brRole.dev; return d && d.sightFade ? d.sightFade(v === null ? undefined : v !== '0') : null; }, FADE);
    for (const [id, label, x, y, line] of SCENES) {
      if (!WANT.includes(id)) continue;
      await H.place(P, x, y, 0, { light: false });
      await P.evaluate(() => window.__clock.thaw());
      /* BR-RoLE 1.1 builds a lamp's far field and bounce light over a few frames: wait for them (the parent has none) */
      for (let k = 0; k < 120; k++) { await frames(P, 4); const ok = await P.evaluate(() => !(window.__brRole && __brRole.dev && __brRole.dev.farReady) || __brRole.dev.farReady()); if (ok) break; }
      await frames(P, 30); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 6); await H.settle(P);
      await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.dataset.vh = e.style.visibility; e.style.visibility = 'hidden'; }), UI);
      const png = await P.screenshot(); fs.writeFileSync(path.join(OUT, id + '.png'), png);
      await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.style.visibility = e.dataset.vh || ''; }), UI);
      await sharp(png).linear(BOOST, 0).toFile(path.join(OUT, id + '_boost.png'));
      const prof = await P.evaluate(([x0, y0, x1, y1]) => { const c = document.getElementById('light'), k = c.width / innerWidth, w = __api.layer().parent, ctx = c.getContext('2d'), out = [];
        const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 4);
        for (let s = 0; s <= n; s++) { const X = x0 + (x1 - x0) * s / n, Y = y0 + (y1 - y0) * s / n, sx = (w.position.x + X * w.scale.x) * k, sy = (w.position.y + Y * w.scale.y) * k;
          out.push(sx < 0 || sy < 0 || sx >= c.width || sy >= c.height ? null : ctx.getImageData(Math.floor(sx), Math.floor(sy), 1, 1).data[3]); }
        return out; }, line);
      const st = await P.evaluate(() => { const s = __brRole.stats(); return { lamps: s.lamps.last, far: s.far || null, frameMs: s.frameMs }; });
      R.scenes.push({ id, label, at: [x, y], line, step: 4, overlayAlpha: prof, stats: st });
      console.log(id, label, '| lamps', st.lamps, '| far', st.far ? `${st.far.drawn} drawn, ${st.far.bouncePoints} bounce pts` : '-', '| overlay min', Math.min(...prof.filter(v => v !== null)));
      await P.evaluate(() => window.__clock.thaw());
    }
    R.errs = J.errs;
    if (J.errs.length) console.log('page errors:', J.errs.slice(0, 5).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  fs.writeFileSync(path.join(OUT, 'scenes.json'), JSON.stringify(R));
})().catch(e => { console.error(e); process.exit(1); });
