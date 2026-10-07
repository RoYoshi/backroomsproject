/* Stage 3B-F4 - readability with entities, wanderers, items and crawl passages (development only; never served).
 *
 *   node dev/stage-3b/readability_3b.js --game PATH --out DIR [--only a,b]
 *
 * One staged page (god mode, monsters added near you by the admin 'near' command, then frozen), a scripted second wanderer
 * with its light; at each pose the frame as played with the remaster ON and OFF (?remaster live toggle), side by side, so a
 * human can judge that Hounds, Smilers, other wanderers, items and crawl holes read at least as well as before.
 * Items: the game has one, the cartograph, drawn by glitch.js on its own overlay from window.__items. The server drops it at a
 * random spot, so for these poses the harness pins window.__items to a spot beside you (staged position; the game's own drawing).
 * Near a monster mp.js flickers the darkness overlay (#light opacity drops at random frames) and shakes #game by a random few
 * px every frame. Both are random per frame, so during the A/B shots they are pinned (#light at full darkness, the most
 * conservative case for readability; no shake); otherwise one shot of a pair can be brighter for reasons unrelated to the remaster. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), OUT = path.resolve(opt('out') || '/tmp/read3b'), PORT = +(opt('port') || 9488), ONLY = opt('only');
/* name, x, y, aim, light, monsters, peer offset, item (side of your aim, radians; null = no item) */
const POSES = [
  ['yellow-hall', 1300, 3500, 0, true, ['hound', 'smiler'], [180, 60], 1.6], ['blackout-flashlight', 1300, 5330, -Math.PI / 2, true, ['hound'], null, -1.6],
  ['red-rooms', 5700, 5470, 0.3, true, ['smiler', 'hound'], [160, -40], 1.6], ['deep-carpet', 7900, 5620, -Math.PI / 2, true, ['hound'], null, 1.6],
  ['long-room-pits', 6240, 1200, 0.1, true, ['hound'], [200, 0], -1.6], ['damp-rooms', 3456, 5420, -Math.PI / 2, true, ['smiler'], null, 1.6],
  ['crawl-hole-yellow', 1070, 3020, Math.PI, true, [], null, null], ['crawl-hole-arch', 8150, 3216, 0, true, [], null, null],
  ['crawl-hole-damp', 3366, 5136, Math.PI, true, [], null, null], ['corridor', 1104, 2200, Math.PI / 2, true, ['hound'], null, null],
];
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), room = 'rd3b' + Date.now() % 1e5, log = [];
  let peer = null;
  try {
    const J = await H.join(browser, PORT, room, 'QA', { query: '&dev3b=1' }), P = J.P;
    await H.until(() => P.evaluate(() => window.__l0v && __l0v.ready()), 30000); await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => document.querySelectorAll('header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag').forEach(e => e.style.visibility = 'hidden'));
    peer = new H.ScriptedPeer(PORT, room, 'PEER', 'lantern', '#c9e7ff');
    for (const [name, x, y, a, light, mons, poff, iside] of POSES) {
      if (ONLY && !ONLY.split(',').includes(name)) continue;
      await H.stage(P); await P.evaluate(() => __clock.thaw()); const at = await H.place(P, x, y, a, { light }); await sleep(900);
      if (name.startsWith('blackout')) await H.setLights(P, 'on');
      let aim = a, stand = at, first = null; for (const k of mons) { const m = await H.near(P, k); if (m && !first) first = m; }
      if (first) {                                        // the admin places monsters ~500-800 px away: stand 170 px from the first one, facing it, in its light
        const d = Math.hypot(at[0] - first[0], at[1] - first[1]) || 1; stand = [first[0] + (at[0] - first[0]) / d * 170, first[1] + (at[1] - first[1]) / d * 170];
        stand = await H.place(P, stand[0], stand[1], 0, { light }); aim = Math.atan2(first[1] - stand[1], first[0] - stand[0]); }
      if (poff) { if (!peer.timer) await peer.standAt('QA', stand[0] + poff[0], stand[1] + poff[1], Math.PI); else { await peer.walkTo(stand[0] + poff[0], stand[1] + poff[1]); peer.angle = Math.PI; } await sleep(600); }
      await H.place(P, stand[0], stand[1], aim, { light }); await sleep(900);
      let item = null;
      if (iside !== null) {                               // the cartograph ~120 px to one side of your aim, on clear floor in plain sight
        item = await P.evaluate(([x, y, a0]) => { const A = __api; for (let k = 0; k < 16; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8, X = x + Math.cos(a) * 120, Y = y + Math.sin(a) * 120;
          if (!A.sl(X, Y, 30)) continue; let ok = true; for (let t = .2; t < 1; t += .2) if (!A.sl(x + (X - x) * t, y + (Y - y) * t, 8)) { ok = false; break; }
          if (ok) { const mine = [[Math.round(X), Math.round(Y), 'cartograph']]; Object.defineProperty(window, '__items', { configurable: true, get: () => mine, set: () => { } }); return mine[0].slice(0, 2); } } return null; }, [stand[0], stand[1], aim + iside]);
      }
      await frames(P, 8); await P.evaluate(() => __clock.freeze(false)); await frames(P, 6);
      const shots = [];
      await P.evaluate(() => { const st = document.createElement('style'); st.id = 'rd3bPin'; st.textContent = '#light{opacity:1!important}#game{transform:none!important}'; document.head.appendChild(st); });
      for (const on of [true, false]) { await P.evaluate(v => __l0v.dev.remaster(v), on); await frames(P, 6); await sleep(150); shots.push(await P.screenshot()); }
      await P.evaluate(() => { __l0v.dev.remaster(true); const st = document.getElementById('rd3bPin'); if (st) st.remove(); });
      const w = 640, tiles = await Promise.all(shots.flatMap(b => [sharp(b).resize(w).toBuffer(), sharp(b).linear(2.2, 0).resize(w).toBuffer()]));
      const h = (await sharp(tiles[0]).metadata()).height;
      await sharp({ create: { width: w * 2 + 6, height: h * 2 + 6, channels: 3, background: '#fff' } })
        .composite([{ input: tiles[0], left: 0, top: 0 }, { input: tiles[2], left: w + 6, top: 0 }, { input: tiles[1], left: 0, top: h + 6 }, { input: tiles[3], left: w + 6, top: h + 6 }]).jpeg({ quality: 84 }).toFile(path.join(OUT, `read-${name}.jpg`));
      const c = await H.counts(P), mons2 = await P.evaluate(([x, y]) => [...(window.__hounds || []).filter(Boolean).map(o => ['hound', Math.round(Math.hypot(o.x - x, o.y - y))]), ...__api.q.filter(o => o && !o.off).map(o => ['smiler', Math.round(Math.hypot(o.x - x, o.y - y))])], stand);
      const where = await P.evaluate(([x, y]) => { const o = __api.Oc.find(o => x >= o.x * 96 && x < (o.x + o.w) * 96 && y >= o.y * 96 && y < (o.y + o.h) * 96); return o ? o.name : 'corridor'; }, stand);
      const itemWhere = item && await P.evaluate(([x, y]) => { const o = __api.Oc.find(o => x >= o.x * 96 && x < (o.x + o.w) * 96 && y >= o.y * 96 && y < (o.y + o.h) * 96); return o ? o.name : 'corridor'; }, item);
      if (item) await P.evaluate(() => { delete window.__items; window.__items = []; });
      log.push({ pose: name, stand: stand.map(Math.round), where, hounds: c.h, smilers: c.s, distances: mons2, peer: !!poff, item: item ? { at: item, where: itemWhere, staged: true } : null });
      if (name.startsWith('blackout')) await H.setLights(P, 'off');
    }
    console.log(JSON.stringify({ poses: log, errors: J.errs }));
  } catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 800)); }
  if (peer) peer.close(); await browser.close(); srv.kill();
})();
