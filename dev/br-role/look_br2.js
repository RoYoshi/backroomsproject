/* BR-RoLE BR2 - the few targeted captures for human QA (development only; never served).
 *
 *   node dev/br-role/look_br2.js --game PATH --out DIR        (writes a handful of side-by-side JPEGs, brightened x3 for the eye)
 *
 * One staged page (frozen halls, god mode, lamps forced on), frozen clock for every shot:
 *   props       counter L4: legacy | MEDIUM (lamps only) | MEDIUM + your beam from the open side | MEDIUM, beam from the lamps' side
 *   player      your shadow under the lamps, actor shadows off | on (MEDIUM, crop around you)
 *   hound       a Hound in your flashlight beam, actor shadows off | on (MEDIUM, crop around it)
 *   crossing    your beam and another wanderer's (a scripted peer, blue light): legacy | LOW | MEDIUM | HIGH
 *   penumbra    a fluorescent tube's shadow past the spawn partition: LOW | MEDIUM | HIGH */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), OUT = path.resolve(opt('out') || '/tmp/br2-look'), PORT = +(opt('port') || 9486), GAIN = 3;
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const strip = async (name, shots, crop, w) => {                       // shots: PNG buffers; crop {left, top, width, height}; each resized to width w
  const bufs = await Promise.all(shots.map(b => sharp(b).extract(crop).linear(GAIN, 0).resize(w).toBuffer())); const h = (await sharp(bufs[0]).metadata()).height;
  await sharp({ create: { width: (w + 6) * bufs.length - 6, height: h, channels: 3, background: '#fff' } }).composite(bufs.map((x, i) => ({ input: x, left: i * (w + 6), top: 0 }))).jpeg({ quality: 84 }).toFile(path.join(OUT, name + '.jpg'));
};
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), room = 'br2look' + Date.now() % 1e5, log = [];
  try {
    const J = await H.join(browser, PORT, room, 'QA'), P = J.P; await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => document.querySelectorAll('header,.location,.coordinates,#hud').forEach(e => e.style.visibility = 'hidden'));
    const mode = async m => { await P.evaluate(m => { if (m === 'legacy') __brRole.dev.legacy(true); else { __brRole.dev.legacy(false); __brRole.setQuality(m); } }, m); await frames(P, 10); await sleep(200); };
    const shot = () => P.screenshot();
    const pose = async (x, y, a, light) => { await P.evaluate(() => __clock.thaw()); await H.place(P, x, y, a, { light }); await sleep(1000); await frames(P, 8); await P.evaluate(() => __clock.freeze(true)); await frames(P, 6); };
    /* props */
    const ps = [];
    await pose(3400, 1250, -Math.PI / 2, false); await mode('legacy'); ps.push(await shot()); await mode('medium'); ps.push(await shot());
    await pose(3400, 1250, -Math.PI / 2, true); await mode('medium'); ps.push(await shot());
    await pose(3430, 880, 2.0, true); await mode('medium'); ps.push(await shot());
    await strip('br2-props-counter', ps, { left: 160, top: 0, width: 960, height: 720 }, 480); log.push('props');
    /* player */
    await pose(930, 3470, 0, false); await mode('medium');
    await P.evaluate(() => __brRole.dev.actors(false)); await frames(P, 6); const p0 = await shot(); await P.evaluate(() => __brRole.dev.actors(true)); await frames(P, 6); const p1 = await shot();
    await strip('br2-player-shadow-off-on', [p0, p1], { left: 470, top: 190, width: 340, height: 340 }, 510); log.push('player');
    /* hound */
    await P.evaluate(() => __clock.thaw()); await H.place(P, 1060, 3420, -1.2, { light: false }); await sleep(600);
    const at = await H.near(P, 'hound');
    if (at) {
      await pose(at[0] + 170, at[1] - 40, Math.atan2(40, -170), true);     // your flashlight on it: its shadow is cut out of your beam
      const hj = await P.evaluate(() => { const j = __brRole.actors().find(a => a.kind === 'hound'), M = __brRole.lastFrame(); return j ? [j.x * M.r + M.ox, j.y * M.r + M.oy, j.light] : null; });
      if (hj) { await P.evaluate(() => __brRole.dev.actors(false)); await frames(P, 6); const h0 = await shot(); await P.evaluate(() => __brRole.dev.actors(true)); await frames(P, 6); const h1 = await shot();
        await strip('br2-hound-shadow-off-on', [h0, h1], { left: Math.round(Math.min(1280 - 400, Math.max(0, hj[0] - 200))), top: Math.round(Math.min(720 - 360, Math.max(0, hj[1] - 180))), width: 400, height: 360 }, 500); log.push('hound ' + hj[2]); }
      else log.push('hound: not in sight / unlit');
      await P.evaluate(() => __clock.thaw()); await H.stage(P); await H.setLights(P, 'off');
    }
    /* crossing beams with a scripted peer */
    const peer = new H.ScriptedPeer(PORT, room, 'PEER', 'flashlight', '#9fd4ff'); await peer.standAt('QA', 880, 3600, -0.5);
    await pose(1180, 3470, 2.95, true); const cs = [];
    for (const m of ['legacy', 'low', 'medium', 'high']) { await mode(m); cs.push(await shot()); }
    await strip('br2-crossing-legacy-low-medium-high', cs, { left: 240, top: 120, width: 560, height: 420 }, 420); log.push('crossing'); peer.close();
    /* penumbra */
    await pose(1130, 3420, 2.6, false); const pn = [];
    for (const m of ['low', 'medium', 'high']) { await mode(m); pn.push(await shot()); }
    await strip('br2-penumbra-low-medium-high', pn, { left: 150, top: 240, width: 420, height: 420 }, 420); log.push('penumbra');
    await mode('medium');
    console.log(JSON.stringify({ shots: log, errors: J.errs }));
  } catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 600)); }
  await browser.close(); srv.kill();
})();
