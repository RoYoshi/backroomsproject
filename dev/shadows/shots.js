/* 2D Lighting & Shadows - visual QA captures: the same frozen scene at several shadow qualities, side by side.
 *
 *   node dev/shadows/shots.js --game PATH --out DIR [--scenes room,props,...] [--tiers off,low,medium,high] [--crop 560]
 *        [--viewport 1280x720] [--debug 1]
 *
 * For each scene: a staged room (frozen halls, no monsters unless the scene adds one, god mode), the wanderer placed and
 * the light aimed, then the frame is frozen (test-only clock: the same instant is redrawn, Pixi keeps rendering) and
 * captured at each quality WITHOUT moving anything; only __shadows.setQuality changes between captures.  Writes
 * <scene>-<tier>.png, <scene>-compare.png (centre crops side by side, in tier order) and shots.json (positions, stats,
 * a hash of the darkness overlay per capture, which must not depend on the quality).  Observation only. */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const H = require('./harness_lib.js');
const { sleep, frames, lightHash } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { try { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } catch (x) { return null; } } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..'));
const OUT = path.resolve(opt('out') || '/tmp/shots');
const PORT = +(opt('port') || 9471);
const [VW, VH] = (opt('viewport') || '1280x720').split('x').map(Number);
const CROP = +(opt('crop') || 560);
const tiers = (opt('tiers') || 'off,low,medium,high').split(',');
fs.mkdirSync(OUT, { recursive: true });

/* scene: where the wanderer stands, where the light points, lights mode, extras */
const SCENES = {
  room: { at: [1060, 3300], aim: -0.25 },                                  // YELLOW HALL spawn lamp, partition at arm's length
  props: { at: [1776, 3460], aim: -Math.PI / 2 - 0.15 },                  // reception counter L1 in the flashlight
  counter: { at: [1700, 3470], aim: -Math.PI / 2 + 0.35 },
  pillars: { at: [7990, 1270], aim: 0.75 },                               // PILLAR HALL
  doorway: { at: [7860, 1150], aim: 0.05 },
  corridor: { at: [3600, 3504], aim: 0 },
  lampwall: { at: [1180, 2830], aim: 2.4 },
  lampedge: { at: [1150, 3650], aim: Math.PI / 2, light: false },          // lamp light only
  shelf: { at: [3984, 3470], aim: -Math.PI / 2 },                          // toppled shelf L2 between two lamps, flashlight on it
  shelfdark: { at: [3984, 3470], aim: -Math.PI / 2, light: false },        // the same, lamps only
  machine: { at: [7920, 5560], aim: -Math.PI / 2 - .2 },
  bench: { at: [4944, 3740], aim: -Math.PI / 2 },
  blackout: { at: [1060, 3300], aim: -0.25, lights: 'on' },
  flicker: { at: [600, 2930], aim: -2.2 },                                 // beside dim fixture #0
  dark: { at: [1060, 3300], aim: -0.25, light: false },
  hound: { at: [1060, 3300], aim: -0.25, hound: true },                    // a hound ~210 px away in the beam
  pillarlit: { at: [8400, 1300], aim: 0.45 },                               // the flashlight on a pillar (8564,1364) from ~180 px
  partition: { at: [1000, 3560], aim: -1.75 },                              // the flashlight up the YELLOW HALL partition stubs
};
const scenes = (opt('scenes') || 'room,props,shelf,shelfdark,lampedge,doorway,blackout,hound').split(',');
function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }

(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS });
  const R = { game: GAME, viewport: [VW, VH], shots: [], errors: [] };
  try {
    const J = await H.join(browser, PORT, 'shots' + (Date.now() % 100000), 'QA', { viewport: { width: VW, height: VH } }), P = J.P;
    await H.stage(P);
    if (opt('debug')) {
      await P.keyboard.press('Backquote'); await P.fill('#admPass', 'smoor'); await P.keyboard.press('Enter'); await sleep(900);
      await P.evaluate(() => { const t = document.querySelector('[data-a=tab][data-t=debug]'); t && t.click(); }); await sleep(300);
      await P.evaluate(() => { const b = document.querySelector('[data-a="dbg"]'); b && b.click(); }); await H.until(() => P.evaluate(() => !!document.getElementById('shadowDebugBtn')), 4000);
      await P.evaluate(() => { document.getElementById('shadowDebugBtn').click(); const p = document.getElementById('adminPanel'); if (p) p.hidden = true; });
    }
    await P.evaluate(() => { document.querySelectorAll('header,.location,.coordinates,#hud').forEach(e => e.style.visibility = 'hidden'); });
    for (const sc of scenes) {
      const D = SCENES[sc]; if (!D) { console.log('unknown scene', sc); continue; }
      await H.setLights(P, D.lights || 'off');
      const at = await H.place(P, D.at[0], D.at[1], D.aim, { light: D.light !== false });
      if (D.hound) {
        const h = await H.near(P, 'hound');
        const spot = h && await P.evaluate(([hx, hy]) => { const A = __api; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = hx + Math.cos(a) * 210, y = hy + Math.sin(a) * 210; if (A.sl(x, y, 26) && A.Uc(x, y, Math.atan2(hy - y, hx - x), 210) >= 190) return [Math.round(x), Math.round(y), Math.atan2(hy - y, hx - x)]; } return null; }, h);
        if (spot) await H.place(P, spot[0], spot[1], spot[2]);
        R.hound = { hound: h, wanderer: spot };
      }
      await sleep(1600); await frames(P, 4);
      await P.evaluate(() => __clock.freeze()); await H.settle(P);
      const files = [];
      for (const t of tiers) {
        await P.evaluate(q => window.__shadows && __shadows.setQuality(q), t); await frames(P, 24); await sleep(250);   // lamp caches rebuild one per frame and ease in
        const f = `${sc}-${t}.png`; await P.screenshot({ path: path.join(OUT, f) }); files.push(f);
        R.shots.push({ scene: sc, tier: t, file: f, lightHash: await lightHash(P), state: await P.evaluate(() => ({ x: Math.round(__api.H.x), y: Math.round(__api.H.y), angle: +__api.H.angle.toFixed(3), light: __api.lightOn(), blackout: !!__api.V.blackout })),
          stats: await P.evaluate(() => window.__shadows ? __shadows.stats() : null), snap: await P.evaluate(() => window.__shadows ? __shadows.snapshot() : null) });
      }
      await P.evaluate(() => __clock.thaw());
      if (D.hound) await H.stage(P);
      if (sharp) {
        const cx = Math.round(VW / 2 - CROP / 2), cy = Math.round(VH / 2 - CROP / 2), w = Math.min(CROP, VW), h = Math.min(CROP, VH);
        const crops = await Promise.all(files.map(f => sharp(path.join(OUT, f)).extract({ left: Math.max(0, cx), top: Math.max(0, cy), width: w, height: h }).toBuffer()));
        await sharp({ create: { width: w * crops.length + 8 * (crops.length - 1), height: h, channels: 3, background: '#ffffff' } })
          .composite(crops.map((b, i) => ({ input: b, left: i * (w + 8), top: 0 }))).png().toFile(path.join(OUT, `${sc}-compare.png`));
      }
      console.log(sc, 'ok', at);
    }
    R.errors = J.errs; R.missing = [...new Set(J.missing)];
  } catch (e) { R.fatal = String(e && e.stack || e).slice(0, 800); console.log('FATAL', R.fatal); }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(R, null, 1));
  await browser.close(); srv.kill('SIGTERM'); console.log('errors', JSON.stringify(R.errors)); process.exit(R.fatal ? 1 : 0);
})();
