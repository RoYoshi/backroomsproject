/* BR-RoLE - quick browser smoke against the real client (development only; never served).  A few minutes, not a matrix.
 *
 *   node dev/br-role/smoke.js [--game PATH]        (exit code 1 on any failure)
 *
 * K01 the page loads, BR-RoLE owns the light (frames drawn by it, not by the legacy path), no page / console error
 * K02 mixed light, read from the darkness overlay's own pixels at the QA01 spot (frozen clock): where the spawn lamp is
 *     blocked, your beam alone lights the floor (the blackout changes nothing there); where both reach, their light ADDS:
 *     L(lamp+beam) = L(beam) + L(lamp) - L(ambient), within 8-bit rounding
 * K03 tiers: the light buffer follows the CSS viewport (x .5 / .75 / 1.0), the same on a DPR-2 page
 * K04 gameplay untouched: the client sends the same kinds of messages with BR-RoLE and with the legacy lighting
 * K05 DEV switch: the legacy lighting still draws when asked (comparison only), and BR-RoLE takes back over
 * K06 a Smiler in view: no blob drawn for it, its face still drawn by the game, no error */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9483);
const res = []; const check = (n, ok, note) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (note ? '   ' + note : '')); };
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS });
  try {
    const room = 'brsmoke' + Date.now() % 1e5, J = await H.join(browser, PORT, room, 'K'), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    await P.evaluate(() => document.querySelectorAll('header,.location,.coordinates,#hud').forEach(e => e.style.visibility = 'hidden'));
    await frames(P, 30);
    const s1 = await P.evaluate(() => __brRole.stats()), s1b = (await frames(P, 20), await P.evaluate(() => __brRole.stats()));
    check('K01 the page loads and BR-RoLE draws the light every frame; no page or console error', s1.on && s1b.frames > s1.frames + 10 && !s1.disabled && J.errs.length === 0,
      `version ${s1.version}, quality ${s1.quality}, frames ${s1.frames} -> ${s1b.frames}, lamps ${s1b.lamps.last}, errors ${JSON.stringify(J.errs)}, 404s ${JSON.stringify([...new Set(J.missing)])}`);

    /* K02: the QA01 geometry - beam aimed along the spawn lamp's shadow edge at the partition corner */
    const X = 1060, Y = 3440, AIM = Math.atan2(3400 - 3440, 930 - 1060);
    await H.place(P, X, Y, AIM, { light: true }); await sleep(900); await frames(P, 6);
    await P.evaluate(() => __clock.freeze(true)); await frames(P, 4);
    const pick = await P.evaluate(([X, Y]) => { let blocked = null, both = null;
      for (let d = 70; d < 300; d += 6) for (let o = -40; o <= 40; o += 4) { const a = Math.atan2(3400 - Y, 930 - X), x = X + Math.cos(a) * d - Math.sin(a) * o, y = Y + Math.sin(a) * d + Math.cos(a) * o, pr = __brRole.probe(x, y);
        const lamp = pr.lamps.reduce((s, l) => s + l.light, 0), beam = pr.carried.reduce((s, c) => s + c.light, 0);
        const clear = [[12, 0], [-12, 0], [0, 12], [0, -12], [9, 9], [-9, -9], [9, -9], [-9, 9]].every(([u, v]) => __brRole.probe(x + u, y + v).lamps.every(l => l.light === 0));   // well inside the lamp's shadow (the buffer is soft at its edges)
        if (!blocked && lamp === 0 && clear && beam > .2 && pr.lamps.some(l => l.i === 4) && Math.hypot(x - 1008, y - 3312) < 330) blocked = [x, y, beam];
        if (!both && lamp > .06 && beam > .15 && beam + lamp < .65) both = [x, y, beam, lamp];   /* mid-range: well below where the 8-bit overlay and the vignette compress */ }
      return { blocked, both }; }, [X, Y]);
    /* read the overlay at those world points (screen = world * scale + offset, the scale / offset the game used this frame) */
    const read = () => P.evaluate(pts => { const c = document.getElementById('light'), x = c.getContext('2d'), M = __brRole.lastFrame();
      return pts.map(([wx, wy]) => { const sx = Math.round(wx * M.r + M.ox), sy = Math.round(wy * M.r + M.oy), d = x.getImageData(sx - 1, sy - 1, 3, 3).data; let a = 0; for (let k = 3; k < d.length; k += 4) a += d[k]; return 1 - a / 9 / 255; }); }, [pick.blocked, pick.both].map(p => [p[0], p[1]]));
    const L = {};
    L.lampBeam = await read();
    await P.keyboard.press('KeyF'); await frames(P, 4); L.lamp = await read();
    await H.setLights(P, 'on'); await frames(P, 6); L.amb = await read();
    await P.keyboard.press('KeyF'); await frames(P, 4); L.beam = await read();
    await H.setLights(P, 'off'); await frames(P, 4);
    const [bl, bo] = [0, 1], tol = 3 / 255;
    const blockedOk = Math.abs(L.lampBeam[bl] - L.beam[bl]) <= tol && L.lampBeam[bl] > L.lamp[bl] + .1;
    const addOk = L.lampBeam[bo] > L.beam[bo] + tol && Math.abs(L.lampBeam[bo] - (L.beam[bo] + L.lamp[bo] - L.amb[bo])) <= 2 * tol;
    check('K02 mixed light by composition: where the lamp is blocked your beam alone lights the floor; where both reach they add', blockedOk && addOk,
      `blocked spot ${pick.blocked.slice(0, 2).map(Math.round)}: lamp+beam ${L.lampBeam[bl].toFixed(3)} = beam alone ${L.beam[bl].toFixed(3)} (lamp alone ${L.lamp[bl].toFixed(3)}, ambient ${L.amb[bl].toFixed(3)}); both spot ${pick.both.slice(0, 2).map(Math.round)}: lamp+beam ${L.lampBeam[bo].toFixed(3)} vs beam + lamp - ambient ${(L.beam[bo] + L.lamp[bo] - L.amb[bo]).toFixed(3)}`);
    await P.evaluate(() => __clock.thaw());

    const tiers = {};
    for (const q of ['low', 'medium', 'high']) { await P.evaluate(q => __brRole.setQuality(q), q); await frames(P, 6); const s = await P.evaluate(() => [__brRole.stats().buffer, innerWidth, innerHeight]); tiers[q] = s; }
    const J2 = await H.join(browser, PORT, room, 'K2', { admin: false, dpr: 2 }); await frames(J2.P, 20); await J2.P.evaluate(() => __brRole.setQuality('medium')); await frames(J2.P, 6);
    const d2 = await J2.P.evaluate(() => [__brRole.stats().buffer, innerWidth, innerHeight, devicePixelRatio]); await J2.ctx.close();
    const tOk = Object.entries({ low: .5, medium: .75, high: 1 }).every(([q, k]) => tiers[q][0][0] === Math.ceil(tiers[q][1] * k) && tiers[q][0][1] === Math.ceil(tiers[q][2] * k)) && d2[0][0] === Math.ceil(d2[1] * .75) && d2[3] === 2;
    check('K03 the light buffer is the CSS viewport x .5 / .75 / 1.0, the same on a DPR-2 page', tOk, `${JSON.stringify(tiers)}; DPR ${d2[3]} page at MEDIUM: buffer ${d2[0].join('x')} for ${d2[1]}x${d2[2]} CSS px`);
    await P.evaluate(() => __brRole.setQuality('medium'));

    const sent = async legacy => { await P.evaluate(l => { __brRole.dev.legacy(l); window.__sent.length = 0; }, legacy); await sleep(2500); return P.evaluate(() => [...new Set(window.__sent.map(m => { try { return JSON.parse(m[1]).t; } catch (e) { return '?'; } }))].sort()); };
    const a = await sent(false), b = await sent(true);
    check('K04 gameplay untouched: the client sends the same kinds of messages with BR-RoLE and with the legacy lighting', JSON.stringify(a) === JSON.stringify(b) && a.length > 0, `BR-RoLE ${JSON.stringify(a)}, legacy ${JSON.stringify(b)}`);
    const f0 = await P.evaluate(() => __brRole.stats().frames); await frames(P, 20); const f1 = await P.evaluate(() => __brRole.stats().frames);
    await P.evaluate(() => __brRole.dev.legacy(false)); await frames(P, 20); const f2 = await P.evaluate(() => __brRole.stats().frames);
    check('K05 DEV switch: with the legacy lighting on, BR-RoLE draws nothing (the game draws v23.3.6); switched back, BR-RoLE draws again', f1 === f0 && f2 > f1 + 10, `BR-RoLE frames while legacy: +${f1 - f0}; after switching back: +${f2 - f1}`);

    await H.place(P, 1060, 3300, -0.25); await sleep(500);
    const sm = await H.near(P, 'smiler'); await frames(P, 30);
    const k6 = await P.evaluate(sm => { const ents = __api.layer().children.filter(v => v.__smiler && v.visible); const root = __api.floor().parent.children.find(c => c.label === 'br-role'); const blobs = root ? root.children.find(c => c.label === 'br-role-ents').children.filter(g => g.visible) : [];
      return { smilers: ents.length, nearSmiler: blobs.filter(g => ents.some(v => Math.hypot(g.x - v.x, g.y - v.y) < 60)).length, on: __brRole.on() }; }, sm);
    check('K06 a Smiler in view: no blob for it, BR-RoLE still on, no error', k6.nearSmiler === 0 && k6.on && J.errs.length === 0, `smilers ${k6.smilers}, blobs near one ${k6.nearSmiler}, errors ${JSON.stringify(J.errs)}`);
  } catch (e) { check('harness', false, String(e && e.stack || e).slice(0, 500)); }
  await browser.close(); srv.kill();
  const pass = res.filter(r => r.ok).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
})();
