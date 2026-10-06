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
 * K06 a Smiler in view: no blob drawn for it, its face still drawn by the game, no error
 * K07 BR2A prop shadow + flashlight fill (counter L4, read from the overlay's pixels): behind the counter the lamps add
 *     nothing (lamp + beam = beam alone; lamp alone = ambient), while your beam from the open side lights the floor
 * K08 BR2A the same counter blocks lamp AND flashlight: behind it, from the lamps' side, lamp + beam = ambient, while the
 *     same beam lights the floor before the counter */
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
    /* the overlay at the picked points in four states: lamps + beam, lamp alone, ambient alone (blackout), beam alone */
    const states = async read => { const L = {}; L.lampBeam = await read();
      await P.keyboard.press('KeyF'); await frames(P, 4); L.lamp = await read();
      await H.setLights(P, 'on'); await frames(P, 6); L.amb = await read();
      await P.keyboard.press('KeyF'); await frames(P, 4); L.beam = await read();
      await H.setLights(P, 'off'); await frames(P, 4); return L; };
    const reader = pts => () => P.evaluate(pts => { const c = document.getElementById('light'), x = c.getContext('2d'), M = __brRole.lastFrame();
      return pts.map(([wx, wy]) => { const sx = Math.round(wx * M.r + M.ox), sy = Math.round(wy * M.r + M.oy), d = x.getImageData(sx - 1, sy - 1, 3, 3).data; let a = 0; for (let k = 3; k < d.length; k += 4) a += d[k]; return 1 - a / 9 / 255; }); }, pts);
    const read = () => P.evaluate(pts => { const c = document.getElementById('light'), x = c.getContext('2d'), M = __brRole.lastFrame();
      return pts.map(([wx, wy]) => { const sx = Math.round(wx * M.r + M.ox), sy = Math.round(wy * M.r + M.oy), d = x.getImageData(sx - 1, sy - 1, 3, 3).data; let a = 0; for (let k = 3; k < d.length; k += 4) a += d[k]; return 1 - a / 9 / 255; }); }, [pick.blocked, pick.both].map(p => [p[0], p[1]]));
    const L = await states(read);
    const [bl, bo] = [0, 1], tol = 3 / 255;
    const blockedOk = Math.abs(L.lampBeam[bl] - L.beam[bl]) <= tol && L.lampBeam[bl] > L.lamp[bl] + .1;
    const addOk = L.lampBeam[bo] > L.beam[bo] + tol && Math.abs(L.lampBeam[bo] - (L.beam[bo] + L.lamp[bo] - L.amb[bo])) <= 2 * tol;
    check('K02 mixed light by composition: where the lamp is blocked your beam alone lights the floor; where both reach they add', blockedOk && addOk,
      `blocked spot ${pick.blocked.slice(0, 2).map(Math.round)}: lamp+beam ${L.lampBeam[bl].toFixed(3)} = beam alone ${L.beam[bl].toFixed(3)} (lamp alone ${L.lamp[bl].toFixed(3)}, ambient ${L.amb[bl].toFixed(3)}); both spot ${pick.both.slice(0, 2).map(Math.round)}: lamp+beam ${L.lampBeam[bo].toFixed(3)} vs beam + lamp - ambient ${(L.beam[bo] + L.lamp[bo] - L.amb[bo]).toFixed(3)}`);
    await P.evaluate(() => __clock.thaw());

    /* K07 / K08: counter L4 (3272..3544 x 984..1032), lamps 31 (3600, 912) and 29 (3120, 912) above it */
    await H.place(P, 3400, 1250, -Math.PI / 2, { light: true }); await sleep(900); await frames(P, 6);
    await P.evaluate(() => __clock.freeze(true)); await frames(P, 4);
    const k7 = await P.evaluate(() => { const ok = (x, y) => { const r = __brRole.probe(x, y); return r.lamps.some(l => l.i === 31) && r.lamps.every(l => l.light === 0) && r.carried[0] && r.carried[0].light > .2; };
      for (let y = 1046; y < 1100; y += 3) for (let x = 3330; x < 3520; x += 4) if ([[0, 0], [10, 0], [-10, 0], [0, 10], [0, -10], [7, 7], [-7, 7], [7, -7], [-7, -7]].every(([u, v]) => ok(x + u, y + v))) return [x, y]; return null; });
    const L7 = await states(reader([k7]));
    const k7ok = !!k7 && Math.abs(L7.lampBeam[0] - L7.beam[0]) <= 3 / 255 && Math.abs(L7.lamp[0] - L7.amb[0]) <= 3 / 255 && L7.beam[0] > L7.amb[0] + .1;
    check('K07 BR2A the counter shadows the lamps; your flashlight from the open side fills that shadow (pixels)', k7ok,
      `spot ${k7}: lamp+beam ${L7.lampBeam[0].toFixed(3)} = beam alone ${L7.beam[0].toFixed(3)}; lamp alone ${L7.lamp[0].toFixed(3)} = ambient ${L7.amb[0].toFixed(3)}`);
    await P.evaluate(() => __clock.thaw());
    const aim8 = Math.atan2(k7[1] - 880, k7[0] - 3430);
    await H.place(P, 3430, 880, aim8, { light: true }); await sleep(900); await frames(P, 6);
    await P.evaluate(() => __clock.freeze(true)); await frames(P, 4);
    const k8 = await P.evaluate(([X, Y]) => { const H = __api.H, b = __api.beam && __api.beam() || H, pr = __brRole.probe(X, Y), a = Math.atan2(Y - b.y, X - b.x), ref = [b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70];
      return { blocked: pr.carried[0] && pr.carried[0].light === 0 && pr.lamps.every(l => l.light === 0), ref, refLight: __brRole.probe(ref[0], ref[1]).carried[0].light }; }, k7);
    const L8 = await states(reader([k7, k8.ref]));
    const k8ok = k8.blocked && Math.abs(L8.lampBeam[0] - L8.amb[0]) <= 3 / 255 && Math.abs(L8.beam[0] - L8.amb[0]) <= 3 / 255 && L8.beam[1] > L8.amb[1] + .1;
    check('K08 BR2A the same counter blocks the lamps AND your flashlight from their side: behind it nothing adds (pixels)', k8ok,
      `spot ${k7}: lamp+beam ${L8.lampBeam[0].toFixed(3)}, beam alone ${L8.beam[0].toFixed(3)}, ambient ${L8.amb[0].toFixed(3)}; the beam before the counter ${L8.beam[1].toFixed(3)} (ambient ${L8.amb[1].toFixed(3)})`);
    await P.evaluate(() => __clock.thaw());

    /* K09: your own shadow under the spawn lamp (flashlight off, then on into the shadow) */
    await H.place(P, 1060, 3300, -0.2, { light: false }); await sleep(900); await frames(P, 8);
    await P.evaluate(() => __clock.freeze(true)); await frames(P, 4);
    const me = await P.evaluate(() => __brRole.actors().find(j => j.self && j.dominant));
    const pts9 = me ? [[me.x + Math.cos(me.ang) * 36, me.y + Math.sin(me.ang) * 36], [me.x - Math.cos(me.ang) * 36, me.y - Math.sin(me.ang) * 36]] : [[0, 0], [0, 0]];
    const lampThere = await P.evaluate(([x, y]) => __brRole.probe(x, y).lamps.reduce((s, l) => s + l.light, 0), pts9[0]);
    const ab = async () => { await P.evaluate(() => __brRole.dev.actors(true)); await frames(P, 3); const on = await reader(pts9)(); await P.evaluate(() => __brRole.dev.actors(false)); await frames(P, 3); const off = await reader(pts9)(); await P.evaluate(() => __brRole.dev.actors(true)); await frames(P, 3); return { on, off }; };
    const noBeam = await ab();
    await P.evaluate(() => __clock.thaw()); await P.evaluate(a => { window.__aimA = a; }, me ? me.ang : 0); await P.keyboard.press('KeyF'); await sleep(500); await frames(P, 6); await P.evaluate(() => __clock.freeze(true)); await frames(P, 4);
    const withBeam = await ab(); await P.keyboard.press('KeyF');
    const removed = noBeam.off[0] - noBeam.on[0], removedB = withBeam.off[0] - withBeam.on[0];      // light lost behind you
    const k9ok = !!me && me.light === 'L4' && removed > .02 && removed <= lampThere + 2 / 255 && Math.abs(noBeam.on[1] - noBeam.off[1]) <= 2 / 255 && Math.abs(removedB - removed) <= 3 / 255 && withBeam.on[0] > noBeam.on[0] + .05;
    check('K09 BR2B your shadow takes away only your dominant lamp\'s light behind you; your beam still fills it (pixels)', k9ok,
      `dominant ${me && me.light}; behind you the light drops by ${removed.toFixed(3)} (that lamp gives ${lampThere.toFixed(3)} there), in front ${(noBeam.on[1] - noBeam.off[1]).toFixed(3)}; with your beam into it: drops by ${removedB.toFixed(3)}, light there ${noBeam.on[0].toFixed(3)} -> ${withBeam.on[0].toFixed(3)}`);
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
    const k6 = await P.evaluate(() => { const ents = __api.layer().children.filter(v => v.__smiler && v.visible), jobs = __brRole.actors();
      return { smilers: ents.length, nearSmiler: jobs.filter(j => ents.some(v => Math.hypot(j.x - v.x, j.y - v.y) < 40)).length, actors: jobs.length, on: __brRole.on() }; });
    check('K06 a Smiler in view: no shadow of any kind for it (BR2B), BR-RoLE still on, no error', k6.smilers > 0 && k6.nearSmiler === 0 && k6.on && J.errs.length === 0, `smilers ${k6.smilers}, actor shadows ${k6.actors}, at a Smiler ${k6.nearSmiler}, errors ${JSON.stringify(J.errs)}`);

    /* K10: a Hound let loose (god mode keeps you alive); its dominant light, sampled every frame for 40 frames */
    await H.near(P, 'hound');
    await P.evaluate(() => { window.__k10 = []; window.__k10s = []; const f = () => { if (!window.__k10) return;
      const V = __api.H, hs = __api.layer().children.filter(v => v.__hound && v.visible && v.alpha > .01).filter(v => { const d = Math.hypot(v.x - V.x, v.y - V.y); return d < 600 && __api.Uc(V.x, V.y, Math.atan2(v.y - V.y, v.x - V.x), d) >= d - 20; });
      const j = __brRole.actors().filter(a => a.kind === 'hound' && a.dominant), pr = hs.length ? __brRole.probe(hs[0].x, hs[0].y) : null;
      if (hs.length && pr && pr.total > .08) window.__k10.push(j.length ? j[0].light : '-');    // a Hound you can see, lit: does it have its shadow?
      for (const q of j) if (q.switched) window.__k10s.push(q.switched); if (window.__k10.length < 400) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await H.adm(P, { c: 'freeze', on: 0 }); for (let i = 0; i < 300 && (await P.evaluate(() => window.__k10.length)) < 30; i++) await sleep(100); await H.adm(P, { c: 'freeze', on: 1 });   // up to 30 frames with a lit Hound in sight (it hunts where it likes; the hysteresis itself is unit-checked, U20)
    const [seq, sws] = await P.evaluate(() => { const s = [window.__k10, window.__k10s]; window.__k10 = null; return s; });
    const lit = seq.filter(x => x !== '-').length, bad = sws.filter(w => w.from && w.sFrom !== null && !(w.sTo >= w.sFrom * 1.35 + .02 - 1e-3));   // a switch while the old light still counted needs a 35 % (+ .02) better one
    check('K10 BR2B a Hound on the move: a shadow from its dominant light; it changes light only when another clearly dominates (hysteresis)', seq.length >= 5 && lit >= seq.length * .8 && bad.length === 0,
      `frames with a lit Hound in sight ${seq.length}, with its shadow ${lit}, lights ${JSON.stringify([...new Set(seq)])}, changes ${sws.length} (${sws.map(w => `${w.from}->${w.to} ${w.sFrom}->${w.sTo}`).join(', ')}), without a clear winner ${bad.length}`);
  } catch (e) { check('harness', false, String(e && e.stack || e).slice(0, 500)); }
  await browser.close(); srv.kill();
  const pass = res.filter(r => r.ok).length; console.log(`\n${pass}/${res.length} passed`); process.exit(pass === res.length ? 0 : 1);
})();
