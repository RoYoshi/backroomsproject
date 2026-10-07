/* Stage 3B-F4 - the whole of Level 0 in one picture (development only; never served).
 *
 *   node dev/stage-3b/overview_3b.js --game PATH --out DIR [--tiers medium] [--scale .5] [--width 2304]
 *
 * The remaster's own DEV view (__l0v.dev.overview): every zone's source art and its fixtures, or the legacy carpet and
 * level art, rendered by the game's renderer into one throwaway texture.  Bare materials: no lighting, no actors, no
 * fog of the dark; the map as a whole, for judging cohesion between rooms and corridors at a glance (not how it looks
 * in play - the game is never seen like this).  Writes overview-<tier>.jpg, overview-legacy.jpg and a side-by-side sheet. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), OUT = path.resolve(opt('out') || '/tmp/overview3b'), PORT = +(opt('port') || 9487);
const TIERS = (opt('tiers') || 'medium').split(','), SCALE = +(opt('scale') || .5), WIDTH = +(opt('width') || 2304);
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), log = { tiers: {}, scale: SCALE, width: WIDTH };
  try {
    const J = await H.join(browser, PORT, 'ov3b' + Date.now() % 1e5, 'QA', { query: '&dev3b=1' }), P = J.P;
    await H.until(() => P.evaluate(() => window.__l0v && __l0v.ready()), 30000); await H.stage(P); await H.setLights(P, 'off');
    const grab = async (which, file) => {
      const t0 = Date.now(), url = await P.evaluate(([k, w]) => __l0v.dev.overview(k, w), [SCALE, which]);
      if (!url) throw Error('overview unavailable (' + which + ')');
      const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      await sharp(buf).resize(WIDTH).jpeg({ quality: 86 }).toFile(path.join(OUT, file));
      return { file, ms: Date.now() - t0, sourcePx: (await sharp(buf).metadata()).width };
    };
    for (const t of TIERS) {
      await P.evaluate(t => __brRole.setQuality(t), t); await frames(P, 4);
      await H.until(() => P.evaluate(t => { const s = __l0v.stats(); return s.tier === t && !s.job; }, t), 120000, 400); await frames(P, 4);
      const s = await P.evaluate(() => { const s = __l0v.stats(); return { tier: s.tier, textures: s.textures, texMPx: s.texMPx, decals: s.decals, chunks: s.chunks, zones: s.rooms.length }; });
      log.tiers[t] = Object.assign(s, await grab('remaster', `overview-${t}.jpg`));
    }
    log.legacy = await grab('legacy', 'overview-legacy.jpg');
    const main = TIERS.includes('medium') ? 'medium' : TIERS[0], half = Math.round(WIDTH / 2);
    const a = await sharp(path.join(OUT, 'overview-legacy.jpg')).resize(half).toBuffer(), b = await sharp(path.join(OUT, `overview-${main}.jpg`)).resize(half).toBuffer();
    const h = (await sharp(a).metadata()).height;
    await sharp({ create: { width: half * 2 + 8, height: h, channels: 3, background: '#fff' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: half + 8, top: 0 }]).jpeg({ quality: 86 }).toFile(path.join(OUT, `overview-legacy-vs-${main}.jpg`));
    log.errors = J.errs;
    console.log(JSON.stringify(log));
  } catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 800)); }
  await browser.close(); srv.kill();
})();
