/* BR-RoLE - targeted captures for the eye (development only; never served).
 *
 *   node dev/br-role/look.js --game PATH --out DIR [--poses "name:x:y:aim[:light 0|1];..."] [--modes legacy,low,medium,high] [--gain 3]
 *
 * One staged page (frozen halls, no monsters, god mode, lamps forced on).  For each pose the frame is frozen (exact clock)
 * and captured in each mode: `legacy` (the v23.3.6 lighting, DEV switch) or a BR-RoLE tier.  Writes <pose>-<mode>.png and,
 * with --gain, <pose>-bright.png (the modes side by side, multiplied by the gain for the eye only). */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), OUT = path.resolve(opt('out') || '/tmp/br-look'), PORT = +(opt('port') || 9481), GAIN = +(opt('gain') || 0);
const MODES = (opt('modes') || 'legacy,medium').split(',');
const POSES = (opt('poses') || 'qa01:1130:3420:2.6;qa02:880:3560:-0.8:0;room:1060:3300:-0.25').split(';').filter(Boolean).map(s => { const [n, x, y, a, l] = s.split(':'); return { n, x: +x, y: +y, a: +a, light: l !== '0' }; });
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { shots: [] };
  try {
    const J = await H.join(browser, PORT, 'brlook' + Date.now() % 1e5, 'QA'), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => document.querySelectorAll('header,.location,.coordinates,#hud').forEach(e => e.style.visibility = 'hidden'));
    for (const ps of POSES) {
      await H.place(P, ps.x, ps.y, ps.a, { light: ps.light }); await sleep(1200); await frames(P, 4);
      await P.evaluate(() => __clock.freeze(true)); await frames(P, 4);
      const files = [];
      for (const m of MODES) {
        await P.evaluate(m => { if (m === 'legacy') __brRole.dev.legacy(true); else { __brRole.dev.legacy(false); __brRole.setQuality(m); } }, m); await frames(P, 6); await sleep(150);
        const f = path.join(OUT, `${ps.n}-${m}.png`); await P.screenshot({ path: f }); files.push(f);
        R.shots.push({ pose: ps.n, mode: m, stats: await P.evaluate(() => __brRole.stats()) });
      }
      await P.evaluate(() => { __brRole.dev.legacy(false); __clock.thaw(); });
      if (GAIN > 0) { const b = await Promise.all(files.map(f => sharp(f).linear(GAIN, 0).resize(640).toBuffer())); const h = (await sharp(b[0]).metadata()).height;
        await sharp({ create: { width: 646 * b.length - 6, height: h, channels: 3, background: '#fff' } }).composite(b.map((x, i) => ({ input: x, left: i * 646, top: 0 }))).png().toFile(path.join(OUT, `${ps.n}-bright.png`)); }
      console.log(ps.n, 'ok');
    }
    R.errors = J.errs; R.missing = [...new Set(J.missing)];
  } catch (e) { R.fatal = String(e && e.stack || e).slice(0, 600); console.log('FATAL', R.fatal); }
  fs.writeFileSync(path.join(OUT, 'look.json'), JSON.stringify(R, null, 1));
  await browser.close(); srv.kill(); console.log('errors', JSON.stringify(R.errors)); process.exit(R.fatal ? 1 : 0);
})();
