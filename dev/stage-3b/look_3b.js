/* Stage 3B - the few targeted captures of the visual slice (development only; never served).
 *
 *   node dev/stage-3b/look_3b.js --game PATH --out DIR [--tag NAME] [--modes off,on] [--tiers medium] [--raw]
 *
 * One staged page (frozen halls, no monsters, god mode, lamps forced on), frozen clock for every shot, HUD hidden.
 * Views: YELLOW HALL (spawn, east counter), HUMMING ROOMS (counter from the south, west wing), BLACKOUT ZONE (your beam on
 * the table, a corridor).  For each view and each mode (remaster off / on, when the module exists) and tier: the game as
 * the player sees it, and (--raw) the same frame with the darkness overlay hidden - the bare materials, for the art review
 * only.  Writes PNGs plus a contact sheet per view. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; }, flag = k => argv.includes('--' + k);
const GAME = path.resolve(opt('game') || '.'), OUT = path.resolve(opt('out') || '/tmp/look3b'), PORT = +(opt('port') || 9482), TAG = opt('tag') || 'shot';
const MODES = (opt('modes') || 'off,on').split(','), TIERS = (opt('tiers') || 'medium').split(','), RAW = flag('raw'), ONLY = opt('only');
fs.mkdirSync(OUT, { recursive: true });
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
/* x, y, aim (rad), light on */
const VIEWS = [
  ['yellow-spawn', 1130, 3420, 2.6, false], ['yellow-east', 1560, 3560, -0.5, false],
  ['humming-counter', 3400, 1250, -Math.PI / 2, false], ['humming-west', 2700, 1000, 0.3, false],
  ['blackout-table', 1300, 5330, -Math.PI / 2, true], ['blackout-corridor', 760, 5700, -0.4, true],
  ['yellow-hole', 1070, 3020, Math.PI, true], ['humming-hole', 2736, 1430, -Math.PI / 2, true],
  ['pillar-hall', 8352, 1632, -0.6, false], ['pillar-north', 8112, 1150, 1.2, true],
  /* the rest of Level 0 (3B-F): common rooms, special rooms, their props, corridors and transitions */
  ['north-rooms', 1152, 1248, 0.4, false], ['repeating-shelf', 3840, 3460, -Math.PI / 2, false], ['repeating-window', 2930, 3560, 1.2, false],
  ['segmented-bench', 4990, 3500, -1.2, false], ['segmented-lowwall', 6050, 3300, 0, false], ['long-room', 5760, 1150, 0.2, false],
  ['damp-counter', 3456, 5420, -Math.PI / 2, false], ['red-rooms', 5700, 5470, 0.3, false], ['arch-north', 7900, 2990, -1.4, false],
  ['arch-south', 7700, 3950, 1.0, false], ['deep-machine', 7900, 5620, -Math.PI / 2, false], ['corridor-west', 1104, 2200, Math.PI / 2, false],
  ['corridor-hub', 4700, 3400, 0, false], ['corridor-east', 6900, 3420, Math.PI, false], ['long-to-pillar', 7250, 1200, 0, false],
  ['long-door', 5664, 1900, -Math.PI / 2, false], ['long-pits', 6240, 1200, 0.1, false], ['damp-door', 2400, 5520, 0, false], ['damp-west', 2900, 5800, -0.3, false],
  ['red-approach', 4700, 5620, 0, false], ['red-east', 6620, 5700, Math.PI, false], ['arch-arches', 7650, 3500, 0, false], ['arch-rail', 8020, 3200, -Math.PI / 2, false],
  ['deep-door', 7100, 5650, 0, false], ['deep-east', 8500, 5600, Math.PI, false],
];
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), room = 'look3b' + Date.now() % 1e5, log = [];
  try {
    const J = await H.join(browser, PORT, room, 'QA'), P = J.P; await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => document.querySelectorAll('header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint').forEach(e => e.style.visibility = 'hidden'));
    await H.until(() => P.evaluate(() => !window.__l0v || window.__l0v.ready()), 20000);
    const has = await P.evaluate(() => !!window.__l0v && window.__l0v.stats().built);
    log.push({ l0v: await P.evaluate(() => window.__l0v ? window.__l0v.stats() : null) });
    const setMode = async m => { await P.evaluate(m => { if (window.__l0v) window.__l0v.dev.remaster(m === 'on'); }, m); await frames(P, 8); await sleep(250); };
    const setTier = async t => { await P.evaluate(t => __brRole.setQuality(t), t); await frames(P, 8); await sleep(250); };
    const pose = async (x, y, a, light) => { await P.evaluate(() => __clock.thaw()); await H.place(P, x, y, a, { light }); await sleep(1200); await frames(P, 8); await P.evaluate(() => __clock.freeze(false)); await frames(P, 6); };
    for (const [name, x, y, a, light] of VIEWS) {
      if (ONLY && !ONLY.split(',').includes(name)) continue;
      await pose(x, y, a, light); const shots = [];
      for (const t of TIERS) for (const m of MODES) {
        if (m === 'on' && !has) continue;
        await setTier(t); await setMode(m);
        const f = `${TAG}-${name}-${t}-${m}.png`; const b = await P.screenshot(); fs.writeFileSync(path.join(OUT, f), b); shots.push(b);
        if (RAW) { await P.evaluate(() => { document.getElementById('light').style.visibility = 'hidden'; }); await frames(P, 3);
          const r = await P.screenshot(); fs.writeFileSync(path.join(OUT, f.replace('.png', '-raw.png')), r); shots.push(r);
          await P.evaluate(() => { document.getElementById('light').style.visibility = ''; }); await frames(P, 3); }
      }
      if (shots.length > 1) {                                // columns: off | on (per tier); rows: the game as played, the same x2.5 for the eye, (--raw) the bare materials
        const w = 640, per = RAW ? 2 : 1, cols = shots.length / per, rows = [];
        const game = shots.filter((b, i) => i % per === 0), raw = RAW ? shots.filter((b, i) => i % per === 1) : [];
        rows.push(await Promise.all(game.map(b => sharp(b).resize(w).toBuffer())));
        rows.push(await Promise.all(game.map(b => sharp(b).linear(2.5, 0).resize(w).toBuffer())));
        if (RAW) rows.push(await Promise.all(raw.map(b => sharp(b).resize(w).toBuffer())));
        const h = (await sharp(rows[0][0]).metadata()).height, tiles = [];
        rows.forEach((r, j) => r.forEach((x, i) => tiles.push({ input: x, left: i * (w + 6), top: j * (h + 6) })));
        await sharp({ create: { width: (w + 6) * cols - 6, height: (h + 6) * rows.length - 6, channels: 3, background: '#fff' } }).composite(tiles).jpeg({ quality: 84 }).toFile(path.join(OUT, `${TAG}-${name}-sheet.jpg`));
      }
      log.push(name);
    }
    console.log(JSON.stringify({ views: log, remasterModule: has, errors: J.errs, missing: J.missing }));
  } catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 800)); }
  await browser.close(); srv.kill();
})();
