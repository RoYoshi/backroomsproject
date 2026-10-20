#!/usr/bin/env node
/* dev/pre-trial3-final-polish/tools/spawn_probe.js - pre-Trial 3 polish P2: what is drawn on and around a wanderer while she falls into
 * the level at the start of a run (development only; a measurement for the P2 checkpoint and its check, not a gate step).
 *
 *   node dev/pre-trial3-final-polish/tools/spawn_probe.js --dir DIR [--out FILE.json] [--shots DIR] [--check 1]
 *
 * One server (`node server.js PORT` in DIR, a synthetic admin passcode), headless Chromium (SwiftShader, 960x540), a green wanderer
 * (#2e7d32 body, as in the owner's screenshot) with her flashlight on.  The page's clock is held: performance.now() and the animation
 * frame's timestamp are frozen at a chosen moment of the fall (1.35 s; landing at 62 %), so the game draws that moment again and again
 * and a screenshot can be taken of it (the game's own step does not advance while held; the world is frozen and the player in god mode).
 * She is stood in a lamp's light (about 70 px from the nearest ceiling lamp, on open floor; the clock stays held), as in the owner's
 * screenshot - in the dark nothing lights her and nothing could show on her.
 * For each BR-RoLE tier (low, medium, high), at fall progress .3, .45, .55 (falling: drawn larger), .66, .8, .95 (landed: settling) -
 * all later than the fall is first seen, since PixiJS draws only when its clock moves forward:
 *   - the wanderer's scale and alpha (her avatar, found as BR-RoLE finds it: the world's child with deathPose);
 *   - BR-RoLE's own jobs for her this frame (window.__brRole.actors(): cast strength, self-shading, where the cast starts, the body's
 *     silhouette radius), and the radius her body is actually drawn at (18 px x her scale);
 *   - where the bundle's landing shadow (the arrival's ground ellipse) sits in the stage relative to her: above (drawn after her) or
 *     below (before her);
 *   - a 220 x 220 crop around her, upscaled x2 (screenshots), and the mean darkness over her body's disc (255 - brightness) with BR-RoLE's
 *     actor shadows on and off at the same moment (window.__brRole.dev.actors), and with the arrival's ground layer hidden: what each
 *     paints on her.
 * Verdict per tier: the fall held at all six moments; the arrival's ground drawn below her (before her in the stage: PixiJS paints a
 * later child over an earlier one, so it cannot cover her) and still drawn (the fall's height cue kept) at every moment, and back in the
 * creatures layer at its own index once the fall is over (a Smiler's death shadow is drawn above, as always); BR-RoLE's silhouette for
 * her (cast cut-out and self-shading) as large as she is drawn on both axes (18 px x her scale, within .6 px), and for another
 * wanderer's avatar drawn at 1.7x; no page error.  Reported, not judged: her body's brightness as is, with BR-RoLE's actor shadows off,
 * and with the arrival's ground hidden (a hidden PixiJS object needs a fresh render, which moves the view a little: a measure of the
 * defect where it is large - C5 - not a pass test); BR-RoLE's self-shading darkens her far side on purpose.
 * Every name is synthetic.  The server is stopped by its PID. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(groot, 'sharp')); } })();
const MOMENTS = [.3, .45, .55, .66, .8, .95];   // (later than the fall is ever first seen: PixiJS draws only when its clock moves FORWARD)
const DIR = path.resolve(ARG.dir || '.'), PASS = 'sp-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const INIT = `(() => {
  const S = window.WebSocket; window.__sp = { game: null, unlocked: false, hold: null, last: null };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__sp.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.t === 'admin' && m.ok) window.__sp.unlocked = true; } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
  const now = performance.now.bind(performance), raf = window.requestAnimationFrame.bind(window);
  window.__sp.realNow = now;
  performance.now = () => window.__sp.hold === null ? now() : window.__sp.hold;
  window.requestAnimationFrame = cb => raf(ts => cb(window.__sp.hold === null ? ts : window.__sp.hold));
  // the frame hook's camera, to find her on the screen
  let mp = null; Object.defineProperty(window, '__mp', { configurable: true, get: () => mp ? (a => { window.__sp.last = { cam: a.cam, sc: a.sc, x: a.p.x, y: a.p.y }; return mp(a); }) : mp, set: f => { mp = f; } });
  try { localStorage.setItem('tfb.rgb.v1', localStorage.getItem('tfb.rgb.v1') || ''); } catch (e) { }
})();`;
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000, every = 50) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } }
/* the arrival's ground layer: the bundle draws a wanderer's fall shadow and dust rings into the death sequence's foreground Graphics
 * (window.__api.death().foreground; nothing else draws into it while no death plays), wherever it now sits in the world */
const FIND = `window.__spFind = () => { const A = window.__api, f = A.floor(), w = f && f.parent, P = w && w.children.find(c => c && c !== f && typeof c.deathPose === 'function');
  const D = A.death && A.death(); return { w, P: P || null, g: D && D.foreground ? D.foreground : null }; };`;
const STATE = `() => { const A = window.__api, F = window.__spFind(), w = F.w, P = F.P, ground = F.g, f = A.floor();
  // the stage order: is the arrival's ground drawn after (above) or before (below) her?  (depth-first index in the world)
  let order = 0, at = {}; const walk = o => { at[o === P ? 'person' : o === ground ? 'ground' : '_'] = at[o === P ? 'person' : o === ground ? 'ground' : '_'] ?? order; order++; for (const c of (o.children || [])) walk(c); }; if (w) walk(w);
  const jobs = window.__brRole ? __brRole.actors().filter(j => j.self) : [];
  const L = window.__sp.last, W = innerWidth, H = innerHeight;
  return { fall: A.fall(), scale: P ? [+P.scale.x.toFixed(3), +P.scale.y.toFixed(3)] : null, alpha: P ? +P.alpha.toFixed(3) : null, bodyR: P ? +(18 * (Math.abs(P.scale.x) + Math.abs(P.scale.y)) / 2).toFixed(2) : null,
    groundFound: !!ground, groundAbove: ground ? at.ground > at.person : null, quality: window.__brRole ? __brRole.quality() : null,
    jobs: jobs.map(j => ({ light: j.light, a: +(j.a || 0).toFixed(3), shade: +(j.shade || 0).toFixed(3), start: +(j.start || 0).toFixed(2), silR: j.sil && j.sil[0] ? +j.sil[0].A.toFixed(2) : null, silB: j.sil && j.sil[0] ? +j.sil[0].B.toFixed(2) : null })),
    wantA: P ? +(18 * Math.abs(P.scale.x)).toFixed(2) : null, wantB: P ? +(18 * Math.abs(P.scale.y)).toFixed(2) : null,
    groundDrawn: ground && ground.getLocalBounds ? +ground.getLocalBounds().width.toFixed(1) : null, groundIn: ground ? (ground.parent === A.layer() ? 'creatures' : ground.parent === w ? 'world' : 'other') : null,
    groundIndex: ground && ground.parent ? ground.parent.getChildIndex(ground) : null,
    screen: L ? { x: W / 2 + (L.x - L.cam.x) * L.sc, y: H / 2 + (L.y - L.cam.y) * L.sc, sc: L.sc } : null };
}`;
async function crop(P, s, tag) {
  const half = 110, x = Math.max(0, Math.round(s.screen.x - half)), y = Math.max(0, Math.round(s.screen.y - half));
  const buf = await P.screenshot({ type: 'png', clip: { x, y, width: half * 2, height: half * 2 } });
  // darkness over her body's disc (radius: her drawn body, at the camera's scale), centred on her
  const r = Math.max(4, Math.round(s.bodyR * s.screen.sc * .9)), cx = Math.round(s.screen.x - x), cy = Math.round(s.screen.y - y);
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { if (i * i + j * j > r * r) continue; const px = cx + i, py = cy + j; if (px < 0 || py < 0 || px >= info.width || py >= info.height) continue; const o = (py * info.width + px) * info.channels; sum += (data[o] + data[o + 1] + data[o + 2]) / 3; n++; }
  if (SHOTS) await sharp(buf).resize(half * 4, half * 4, { kernel: 'nearest' }).png().toFile(path.join(SHOTS, tag + '.png'));
  return { bodyBright: n ? +(sum / n).toFixed(2) : null, r };
}
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/pre-trial3-final-polish/tools/spawn_probe.js', dir: DIR, chromium: b.version(), tiers: {} };
  try {
    for (const tier of ['low', 'medium', 'high']) {
      const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); await ctx.addInitScript(INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('fb_settings_v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('fb_settings_v1') || '{}'), {}))); } catch (e) { } });
      const P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
      await P.goto(`http://127.0.0.1:${port}/?room=sp${tier}${Date.now() % 1e6}`, { waitUntil: 'commit', timeout: 90000 });
      for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
      await P.waitForFunction(() => window.__api && window.__ui && window.__brRole, null, { timeout: 60000 }); await P.evaluate(FIND);
      // a green body, as in the owner's screenshot (the Customize colour field the game reads)
      await P.evaluate(() => { const i = document.getElementById('avatarMain'); if (i) { i.value = '#2e7d32'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } });
      await P.evaluate(t => __brRole.setQuality(t), tier);
      const home = await P.evaluate(() => { const g = __api.death().foreground; return { inCreatures: g.parent === __api.layer(), index: g.parent ? g.parent.getChildIndex(g) : null }; });
      await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', 'Spawn');
      // hold the clock in the page the moment the fall starts (a 4 ms watch), then set up the admin tools (nothing of the fall advances)
      await P.evaluate(() => { const iv = setInterval(() => { const f = window.__api && __api.fall ? __api.fall() : -1; if (f >= 0) { window.__sp.t0 = window.__sp.realNow() - f * 1350; window.__sp.hold = window.__sp.realNow(); window.__sp.seen = f; clearInterval(iv); } }, 4); });
      await P.bringToFront(); await P.click('#enter');
      const seen = await until(P, () => window.__sp.seen === undefined ? null : String(window.__sp.seen), null, 30000, 50).then(v => v === null ? null : +v);
      R.tiers[tier] = { fallSeenAt: seen, quality: await P.evaluate(() => __brRole.quality()), moments: [], errors: errs };
      if (seen === null) continue;
      await until(P, () => !!(window.__net && __net.on && window.__sp.game), null, 30000);
      await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__sp.unlocked, null, 5000);
      await P.evaluate(() => { const g = window.__sp.game; g.send(JSON.stringify({ t: 'a', c: 'freeze', on: true })); g.send(JSON.stringify({ t: 'a', c: 'god', id: __api.H.id })); });
      // stand her in a lamp's light (about 70 px from the nearest ceiling lamp, on open floor), as in the owner's screenshot: in the dark
      // nothing lights her and nothing can show on her.  The clock stays held: she is still at the same moment of her fall.
      R.tiers[tier].litSpot = await P.evaluate(() => { const A = __api, H = A.H, L = (A.lamps || []).slice().sort((a, b) => Math.hypot(a.x - H.x, a.y - H.y) - Math.hypot(b.x - H.x, b.y - H.y));
        for (const l of L.slice(0, 16)) for (const r of [70, 90, 55]) for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * Math.PI, x = l.x + Math.cos(a) * r, y = l.y + Math.sin(a) * r;
          if ([[0, 0], [26, 0], [-26, 0], [0, 26], [0, -26]].every(([dx, dy]) => A.zc(Math.floor((x + dx) / 96), Math.floor((y + dy) / 96)))) { A.tp(x, y); return { x: Math.round(x), y: Math.round(y), lamp: { x: l.x, y: l.y }, r }; } }
        return null; });
      await sleep(3000);
      for (const f of MOMENTS) {
        await P.evaluate(f => { window.__sp.hold = window.__sp.t0 + f * 1350; }, f); await sleep(900);
        const s = await P.evaluate(`(${STATE})()`); if (!s.screen) { R.tiers[tier].moments.push(Object.assign({ f, error: 'no screen position' }, s)); continue; }
        const asIs = await crop(P, s, `${tier}_f${String(Math.round(f * 100)).padStart(2, '0')}_asis`);
        await P.evaluate(() => __brRole.dev.actors(false)); await sleep(700); const noBr = await crop(P, s, `${tier}_f${String(Math.round(f * 100)).padStart(2, '0')}_nobrrole`); await P.evaluate(() => __brRole.dev.actors(true));
        // (PixiJS draws only when its ticker's clock moves: the held clock is nudged by .3 ms - .02 % of the fall - after hiding or showing
        // a PixiJS object, so the screen shows the change; BR-RoLE's own canvas is drawn every frame regardless)
        const gHide = await P.evaluate(() => { const g = window.__spFind().g; if (g) { window.__sp.g = g; g.visible = false; window.__sp.hold += .3; } return !!g; });
        await sleep(700); const noGround = gHide ? await crop(P, s, `${tier}_f${String(Math.round(f * 100)).padStart(2, '0')}_noground`) : null;
        await P.evaluate(() => { if (window.__sp.g) { window.__sp.g.visible = true; window.__sp.g = null; window.__sp.hold += .3; } });
        R.tiers[tier].moments.push(Object.assign({ f }, s, { asIs, noBrRole: noBr, noGround, groundHidable: gHide }));
      }
      await P.evaluate(() => { window.__sp.hold = null; }); await sleep(1500);
      R.tiers[tier].home = home; R.tiers[tier].afterFall = await P.evaluate(`(${STATE})()`);
      // another wanderer falling in is drawn larger too (mp.deaths: up to 2.25x): an avatar of the page's own kind beside her, at 1.7x
      R.tiers[tier].peer = await P.evaluate(async () => { const A = __api, v = A.mkAvatar(); A.layer().addChild(v); v.position.set(A.H.x + 60, A.H.y + 10); v.scale.set(1.7, 1.7);
        let job = null; for (let i = 0; i < 60 && !job; i++) { await new Promise(r => setTimeout(r, 100)); job = __brRole.actors().find(j => !j.self && j.kind === 'player') || null; }
        v.parent.removeChild(v); v.destroy({ children: true });
        return job ? { silA: +job.sil[0].A.toFixed(2), silB: +job.sil[0].B.toFixed(2), want: 30.6, light: job.light } : null; });
      await ctx.close();
    }
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
  /* the verdict: nothing darker than the floor lighting painted on her body (the arrival's shadow below her, BR-RoLE's cut-out as large
   * as her drawn body) - compared with the same moment with each source switched off */
  const cases = [], check = (name, ok, detail) => cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  for (const [tier, T] of Object.entries(R.tiers)) {
    const M = T.moments || [];
    check(`${tier}_fall_held`, T.fallSeenAt !== null && T.fallSeenAt < MOMENTS[0] && M.length === MOMENTS.length && M.every(m => m.screen), `fall seen at ${T.fallSeenAt} (before the first moment, ${MOMENTS[0]}); ${M.length} moments`);
    check(`${tier}_arrival_shadow_below_her`, M.length && M.every(m => m.groundFound && m.groundAbove === false), JSON.stringify(M.map(m => m.groundAbove)));
    check(`${tier}_arrival_shadow_kept`, M.length && M.every(m => m.groundDrawn > 20), JSON.stringify(M.map(m => m.groundDrawn)));
    check(`${tier}_arrival_layer_back_after`, T.home && T.home.inCreatures && T.afterFall && T.afterFall.groundIn === 'creatures' && T.afterFall.groundIndex === T.home.index, JSON.stringify({ home: T.home, after: T.afterFall && [T.afterFall.groundIn, T.afterFall.groundIndex] }));
    check(`${tier}_cutout_follows_her_size`, M.length && M.every(m => m.jobs.length && m.jobs.every(j => Math.abs(j.silR - m.wantA) < .6 && Math.abs(j.silB - m.wantB) < .6)), JSON.stringify(M.map(m => [m.f, m.wantA, m.wantB, m.jobs.map(j => [j.silR, j.silB])])));
    check(`${tier}_peer_cutout_follows_size`, T.peer && Math.abs(T.peer.silA - T.peer.want) < .6 && Math.abs(T.peer.silB - T.peer.want) < .6, JSON.stringify(T.peer));
    // (BR-RoLE's self-shading darkens her far side ON PURPOSE, so its effect on her body is reported - asIs against noBrRole - not judged)
    check(`${tier}_no_page_errors`, !(T.errors || []).length, JSON.stringify(T.errors || []).slice(0, 200));
  }
  R.cases = cases; R.ok = cases.length > 0 && cases.every(c => c.ok);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name} - ${c.detail}`);
  console.log(`SPAWN PROBE: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  if (ARG.check && !R.ok) process.exitCode = 1;
})();
