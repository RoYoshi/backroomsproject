#!/usr/bin/env node
/* dev/trial-3-predator-refinement/tools/scale_lineup.js - R5: the undisguised Skin-Stealer beside a Wanderer and a Hound at the game's own
 * camera, and in a doorway and against a wall (development only; the checkpoints' screenshots, not a gate step).  Trial 3 is not
 * owner-approved.
 *
 *   node dev/trial-3-predator-refinement/tools/scale_lineup.js [--dir DIR] [--tag before|after] [--shots DIR] [--out FILE.json]
 *
 * One server (`node server.js PORT` in DIR, default this repository - the same command on the baseline tree gives the "before"; a
 * synthetic admin passcode), headless Chromium (SwiftShader), two pages in one fresh room: the observer (1280x720, the game's own zoom,
 * its torch on) and a Wanderer.  The world is frozen; the Smilers and Hounds are removed with the admin panel's commands and one Hound is
 * put near (NEAR).  Lineup: the observer stands off the Hound with its light on it, the Wanderer beside the Hound, and in this page only
 * three Skin-Stealer figures are added to the script's mirror (as Trial 3's gallery does: the page's own drawing, sight mask, darkness and
 * light) - standing (act 0), creeping (act creep) and winding up (act wind).  Doorway: the observer in the lit east end of the long hall,
 * one figure standing in the doorway in wall x 8280..8340 facing it, one with its face to that wall, as close as its body (radius 24) lets
 * it stand.  Measured: each figure's drawn size (local bounds x its own scale, world px).  Screenshots, no debug overlay. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = { tag: 'now' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), PASS = 'k3-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const INIT = `(() => {
  const S = window.WebSocket; window.__k3 = { game: null, unlocked: false, ss: null, e: null };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__k3.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data);
      if (m.t === 'admin' && m.ok) window.__k3.unlocked = true;
      if (m.t === 's' && m.e) { window.__k3.ss = m.e.ss || null; window.__k3.e = m.e; } } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
})();`;
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000, every = 50) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } }
async function runPage(b, port, room, vp, name) {
  const ctx = await b.newContext({ viewport: vp }); await ctx.addInitScript(INIT);
  const P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', name);
  await P.bringToFront(); await P.click('#enter');
  await until(P, () => !!(window.__net && __net.on && window.__k3.game && window.__api.started()), null, 30000);
  await sleep(2500);
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__k3.unlocked, null, 5000);
  return { ctx, P, errs, cmd: o => P.evaluate(o => window.__k3.game.send(JSON.stringify(Object.assign({ t: 'a' }, o))), o) };
}
const MEASURE = `(() => { const L = __api.layer(), out = [];
  for (const c of L.children || []) { if (c.visible === false) continue; let lb = null; try { const b = c.getLocalBounds(); lb = { w: +(b.width * Math.abs(c.scale.x)).toFixed(1), h: +(b.height * Math.abs(c.scale.y)).toFixed(1) }; } catch (e) { }
    out.push({ label: String(c.label || ''), x: Math.round(c.x), y: Math.round(c.y), sc: +(c.scale ? c.scale.x : 1).toFixed(3), lb }); }
  return out; })()`;
const FAKE = `(F => { const K = window.__skin; if (!K.__wrapped) { const m = K.mirror; K.mirror = (list, dt) => m((list || []).concat(window.__k3.fake || []), dt); K.__wrapped = 1; } window.__k3.fake = F; })`;
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/trial-3-predator-refinement/tools/scale_lineup.js', dir: path.basename(DIR), tag: ARG.tag, chromium: b.version() };
  try {
    const room = 'lu' + (Date.now() % 1e6);
    const O = await runPage(b, port, room, { width: 1280, height: 720 }, 'K3Look');
    O.cmd({ c: 'freeze', on: true });
    const B = await runPage(b, port, room, { width: 640, height: 360 }, 'K3Wand');
    O.cmd({ c: 'smilers', mode: 'remove', n: 10 }); O.cmd({ c: 'hounds', mode: 'remove', n: 10 }); await sleep(800);
    // the lineup, in the big lit room north of the long hall: a Hound put near and called (the admin's navigation COME, the world running
    // a moment) to where the observer stands at (5600, 3380); then the world frozen again, the observer 300 px north (its torch, aimed by
    // the page's own pointer, shines south on the page), and in a row through the Hound's place the Wanderer and three figures, 100 and 200
    // px either side
    let Hd = null; const L = { sx: 5600, sy: 3080, row: [5400, 5500, 5700, 5800].map(x => ({ x, y: 3380 })) };
    await O.P.evaluate(() => __api.tp(5600, 3380)); await B.P.evaluate(() => __api.tp(5450, 3150));
    O.cmd({ c: 'god', id: await O.P.evaluate(() => __api.H.id) }); O.cmd({ c: 'god', id: await B.P.evaluate(() => __api.H.id) }); O.cmd({ c: 'near', k: 'hound' });   // (nobody can be taken while the Hound walks over)
    const h0 = await until(O.P, () => { const e = window.__k3.e; return e && e.h && e.h.length ? e.h[0] : null; }, null, 8000);
    if (h0) { O.cmd({ c: 'nav', eid: h0.i, cmd: 'come' }); O.cmd({ c: 'freeze', on: false });
      Hd = await until(O.P, () => { const e = window.__k3.e, h = e && e.h && e.h[0], H = __api.H; return h && Math.hypot(h.x - H.x, h.y - H.y) < 70 ? h : null; }, null, 25000, 30);
      O.cmd({ c: 'freeze', on: true }); await sleep(400);
      Hd = await O.P.evaluate(() => { const e = window.__k3.e; return e && e.h && e.h[0] ? e.h[0] : null; }); }
    R.hound = Hd; R.lineup = L;
    {
      await B.P.evaluate(q => __api.tp(q.x, q.y), L.row[1]);
      await O.P.evaluate(s => __api.tp(s.sx, s.sy), L);
      if (!(await O.P.evaluate(() => __api.lightOn()))) await O.P.keyboard.press('KeyF');
      const face = Math.PI / 2;                                                    // the figures face south, as the Hound's and the Wanderer's
      // (and a fourth, in a borrowed skin - the Wanderer's own look, as the server sends a skin: drawn as the page's own avatar - north of the row)
      const look = await B.P.evaluate(() => { const W = window.__mpLib && window.__mpLib.wire, me = window.__api && window.__api.H; try { return W && W.lookStr ? W.lookStr(me.look || {}) : null; } catch (e) { return null; } });
      R.look = look;
      await O.P.evaluate(`${FAKE}([{ i: 9101, x: ${L.row[0].x}, y: ${L.row[0].y}, a: ${face}, s: 1, ac: 0, v: 0, h: 0 }, { i: 9102, x: ${L.row[2].x}, y: ${L.row[2].y}, a: ${face}, s: 5, ac: 10, v: 0, h: 0 }, { i: 9103, x: ${L.row[3].x}, y: ${L.row[3].y}, a: ${face}, s: 17, ac: 12, v: 0, h: 0 }, { i: 9104, x: ${L.row[1].x}, y: ${L.row[1].y - 140}, a: ${face}, s: 1, ac: 0, v: 0, h: 0, dg: ${JSON.stringify((look && /^[a-z]+\|[a-z]+\|#/.test(look) ? look : 'none|plain|#e6bb76|#ffcc77').split('|').slice(0, 4).join('|'))} }])`);
      await sleep(2500);
      R.lineupMeasure = (await O.P.evaluate(MEASURE)).filter(m => m.lb && m.lb.w > 4 && (/^skinstealer(-skin)?#91/.test(m.label) || L.row.concat(Hd ? [Hd] : []).some(q => Math.hypot(m.x - q.x, m.y - q.y) < 6)));
      if (SHOTS) { await O.P.screenshot({ path: path.join(SHOTS, `lineup_${ARG.tag}_1280.png`) }); R.lineupShot = `lineup_${ARG.tag}_1280.png`; }
    }
    // the doorway: the observer in the lit east end of the long hall, facing the doorway in the wall at x 8280..8340 (y 3480..3640)
    await B.P.evaluate(() => __api.tp(7700, 3300));
    await O.P.evaluate(() => { __api.tp(8100, 3560); __api.H.angle = 0; });
    await O.P.evaluate(`${FAKE}([{ i: 9201, x: 8310, y: 3560, a: ${Math.PI}, s: 1, ac: 0, v: 0, h: 0 }, { i: 9202, x: 8255, y: 3380, a: 0, s: 1, ac: 0, v: 0, h: 0 }, { i: 9203, x: 8255, y: 3720, a: 0, s: 5, ac: 10, v: 0, h: 0 }])`);
    await sleep(2500);
    R.doorMeasure = (await O.P.evaluate(MEASURE)).filter(m => /^skinstealer#92/.test(m.label));
    if (SHOTS) { await O.P.screenshot({ path: path.join(SHOTS, `doorway_${ARG.tag}_1280.png`) }); R.doorShot = `doorway_${ARG.tag}_1280.png`; }
    R.errors = { observer: O.errs, wanderer: B.errs };
  } catch (e) { R.error = String(e && e.stack || e).slice(0, 900); }
  finally { await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  for (const m of R.lineupMeasure || []) console.log(`lineup ${m.label || 'unlabelled'} at ${m.x},${m.y}: local ${m.lb.w} x ${m.lb.h} world px (scale ${m.sc})`);
  for (const m of R.doorMeasure || []) console.log(`doorway ${m.label} at ${m.x},${m.y}: local ${m.lb.w} x ${m.lb.h} world px (scale ${m.sc})`);
  console.log(JSON.stringify({ lineup: !!R.lineup, error: R.error || null, errors: R.errors }));
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
