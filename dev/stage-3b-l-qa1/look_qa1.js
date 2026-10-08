/* Stage 3B-L QA1 (lighting reality correction) - the human-QA scenes, captured from the real client (development only;
 * never served).
 *
 *   node dev/stage-3b-l-qa1/look_qa1.js [--game PATH] [--port 9490] [--out DIR] [--quality medium] [--scenes A,B,...] [--boost 4]
 *
 * 1920x1080 (the accepted 1.25 camera), ceiling lamps on, monsters removed, the clock frozen per shot.  Per shot: the
 * screenshot with every UI layer hidden (<id>.png), the same brightened x boost (<id>_boost.png: only to SEE faint light),
 * and what the overlay shows on the floor the player can actually see (scenes.json): visible floor points on a 24 px grid
 * (the game's own ray query from the player), each one's light = 1 - overlay alpha, summarised as the share that is
 * bright (>= .35), mid (.12 - .35), dim (.04 - .12) and black (< .04).  Run on the parent and on the correction.
 *
 * Scenes (STAGE_3B_LIGHTING_QA_CORRECTION_MASTER_PROMPT, required human-QA scenes):
 *   A normal Level 0 room (YELLOW HALL), lights working          B between fixtures (REPEATING ROOMS)
 *   C wall receiver: the partition beside a YELLOW HALL lamp     D pillar receiver (PILLAR HALL)
 *   E1/E2 flashlight on a BLACKOUT ZONE wall, then swept away    F lantern by the same wall (broad carried light)
 *   G BLACKOUT ZONE, carried light off (true black)              H long corridor (YELLOW HALL -> NORTH ROOMS)
 *   I a dense-fixture room (REPEATING ROOMS centre)               K headlamp walking down the dark corridor */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9490), OUT = path.resolve(opt('out') || '/tmp/lookqa1'), Q = opt('quality') || 'medium', BOOST = +(opt('boost') || 4);
const WANT = (opt('scenes') || 'A,B,C,D,E1,E2,F,G,H,I,K').split(',');
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const UI = 'header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag,#dread,.grain,#mp,#tip,#brRoleDebug';
const C = c => c * 96 + 48;
/* id, label, player x / y (world px), aim (rad), carried light: null (off) or its kind */
const SCENES = [
  ['A', 'normal Level 0 room, lights working (YELLOW HALL)', C(12), C(35), 0, null],
  ['B', 'between fixtures (REPEATING ROOMS)', C(30), C(31), 0, null],
  ['C', 'wall receiver: the partition beside a YELLOW HALL lamp', C(12.5), C(33), Math.PI, null],
  ['D', 'pillar receiver (PILLAR HALL)', C(82), C(12), 0, null],
  ['E1', 'flashlight aimed at a BLACKOUT ZONE wall', C(13), C(53), Math.PI, 'flashlight'],
  ['E2', 'the same flashlight swept away from that wall', C(13), C(53), -Math.PI / 2, 'flashlight'],
  ['F', 'lantern beside the same wall (broad carried light)', C(12), C(53), 0, 'lantern'],
  ['G', 'BLACKOUT ZONE, carried light off (true black)', C(7), C(52), 0, null],
  ['H', 'long corridor from YELLOW HALL toward NORTH ROOMS', C(11.5), C(22), -Math.PI / 2, null],
  ['I', 'dense-fixture room (REPEATING ROOMS centre)', C(34), C(34), 0, null],
  ['K', 'headlamp in the dark corridor below YELLOW HALL', C(11.5), C(47), Math.PI / 2, 'headlamp'],
];
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { game: GAME, quality: Q, scenes: [] };
  try {
    const J = await H.join(browser, PORT, 'lqa' + Date.now() % 1e5, 'LQA', { viewport: { width: 1920, height: 1080 }, query: '&lighting=' + Q }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    R.version = await P.evaluate(() => window.__brRole && __brRole.version);
    R.lamps = await P.evaluate(() => __api.lamps.length);
    for (const [id, label, x, y, aim, kind] of SCENES) {
      if (!WANT.includes(id)) continue;
      await H.place(P, x, y, aim, { light: !!kind, kind: kind || 'flashlight' });
      await P.evaluate(() => window.__clock.thaw());
      for (let k = 0; k < 150; k++) { await frames(P, 4); const ok = await P.evaluate(() => { const B = window.__brRole; if (!B || !B.dev || !B.dev.farReady) return true; const s = B.stats(); return B.dev.farReady() && s.lamps.pending === 0 && (!B.dev.mapReady || B.dev.mapReady()); }); if (ok) break; }
      await frames(P, 24); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 6); await H.settle(P);
      await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.dataset.vh = e.style.visibility; e.style.visibility = 'hidden'; }), UI);
      const png = await P.screenshot(); fs.writeFileSync(path.join(OUT, id + '.png'), png);
      await P.evaluate(ui => document.querySelectorAll(ui).forEach(e => { e.style.visibility = e.dataset.vh || ''; }), UI);
      await sharp(png).linear(BOOST, 0).toFile(path.join(OUT, id + '_boost.png'));
      /* the floor the player can see: overlay alpha there */
      const vis = await P.evaluate(() => { const A = __api, Hh = A.H, c = document.getElementById('light'), k = c.width / innerWidth, w = __api.layer().parent, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, out = [];
        const x0 = (-w.position.x) / w.scale.x, y0 = (-w.position.y) / w.scale.y, x1 = (innerWidth - w.position.x) / w.scale.x, y1 = (innerHeight - w.position.y) / w.scale.y;
        for (let y = Math.ceil(y0 / 24) * 24; y < y1; y += 24) for (let x = Math.ceil(x0 / 24) * 24; x < x1; x += 24) {
          const dx = x - Hh.x, dy = y - Hh.y, dd = Math.hypot(dx, dy); if (dd > 640 || !A.sl(x, y, 6)) continue;
          if (dd > 4 && A.Uc(Hh.x, Hh.y, Math.atan2(dy, dx), dd) < dd - 1) continue;      // not in sight
          const sx = Math.floor((w.position.x + x * w.scale.x) * k), sy = Math.floor((w.position.y + y * w.scale.y) * k); if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) continue;
          out.push(1 - d[(sy * c.width + sx) * 4 + 3] / 255); }
        return out; });
      const n = vis.length || 1, share = f => +(vis.filter(f).length / n).toFixed(3), mean = vis.reduce((s, v) => s + v, 0) / n;
      const st = await P.evaluate(() => { const s = __brRole.stats(); return { lamps: s.lamps.last, far: s.far || null, map: s.map || null, frameMs: s.frameMs, faceDraws: s.faces || null }; });
      const row = { id, label, at: [x, y], aim, kind, floorPoints: vis.length, light: { mean: +mean.toFixed(3), bright: share(v => v >= .35), mid: share(v => v >= .12 && v < .35), dim: share(v => v >= .04 && v < .12), black: share(v => v < .04) }, stats: st };
      R.scenes.push(row); console.log(id, '|', label, '| floor in sight', vis.length, '| mean light', row.light.mean, '| bright/mid/dim/black', row.light.bright, row.light.mid, row.light.dim, row.light.black);
      await P.evaluate(() => window.__clock.thaw());
    }
    R.errs = J.errs; if (J.errs.length) console.log('page errors:', J.errs.slice(0, 5).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  fs.writeFileSync(path.join(OUT, 'scenes.json'), JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
