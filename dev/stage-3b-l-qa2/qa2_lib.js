/* Stage 3B-L QA2 - shared browser-capture helpers for the final visual polish (development only; never served).
 *
 *   const Q = require('./qa2_lib.js');
 *   const s = await Q.open(GAME, PORT, { quality: 'medium' });          // server + page, monsters removed, god mode, halls frozen
 *   await Q.scene(s.P, { x, y, aim, kind, light, blackout, nv, ir });   // stand there, settle, freeze the clock
 *   const png = await Q.shot(s.P, { crop: [wx, wy, ww, wh] });          // screenshot (UI hidden), cropped to a world box
 *   await Q.close(s);
 *
 * A scene: kind 'flashlight' | 'headlamp' | 'lantern' | 'camcorder' (light: on / raised); blackout true = the halls'
 * fluorescents forced off (only carried / IR light), false = forced on; nv: the camcorder's night vision on / off; ir: its
 * illuminator 0 off / 1 LOW / 2 HIGH.  The clock is frozen at the same instant for every scene (T0), so two builds draw the
 * same frame. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const UI = 'header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag,#dread,.grain,#mp,#tip,#brRoleDebug,#camHud,#camGrain,#camTear,#glitchFx,#glitchTear';   // (the glitched exit walls are placed per server: hidden so two builds compare)
const T0 = 400000;
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function open(GAME, PORT, { quality = 'medium', viewport = { width: 1920, height: 1080 }, init = null, browser = null } = {}) {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get(PORT, '/index.html') === 200) break; await sleep(100); }
  const own = !browser; browser = browser || await H.pw.chromium.launch({ args: H.ARGS });
  const J = await H.join(browser, PORT, 'q2' + Date.now() % 1e6, 'QA2', { viewport, query: '&lighting=' + quality, init });
  await H.stage(J.P);
  return { srv, browser, own, J, P: J.P, blackout: null, port: PORT, game: GAME };
}
async function close(s) { try { if (s.own) await s.browser.close(); else await s.J.ctx.close(); } catch (e) { } try { s.srv.kill(); } catch (e) { } }
const ready = P => P.evaluate(() => { const B = window.__brRole; if (!B || !B.dev || !B.dev.farReady) return true; if (__api.V && __api.V.blackout) return true;   // (in a blackout no lamp is drawn: its build queues wait)
  const s = B.stats(); return B.dev.farReady() && s.lamps.pending === 0 && (!B.dev.mapReady || B.dev.mapReady()); });
async function settleLight(P) { for (let k = 0; k < 200; k++) { await frames(P, 4); if (await ready(P)) break; } }
/* stand at a scene: exact position (no nearest-clear-floor search), aim, the light, NV / IR, blackout; then settle and freeze */
async function scene(s, sc) {
  const P = s.P, bo = !!sc.blackout;
  if (s.blackout !== bo) { await H.stage(P); await H.setLights(P, bo ? 'on' : 'off'); s.blackout = bo; }
  if (await P.evaluate(() => !!(__api.death && __api.death() && __api.death().active))) throw Error('the wanderer is dead');
  const kind = sc.kind || 'flashlight', light = sc.light !== undefined ? !!sc.light : !!sc.kind;
  await P.evaluate(() => window.__clock.thaw());
  await H.place(P, sc.x, sc.y, sc.aim || 0, { light, kind });
  await P.evaluate(([x, y, a]) => { __api.tp(x, y); window.__aimA = a; window.__aimW = 0; }, [sc.x, sc.y, sc.aim || 0]);
  if (kind === 'camcorder') await P.evaluate(([nv, ir]) => { const c = window.__cam; if (!c) return; c.S.nvOn = nv !== false; c.S.ir = ir ?? 1; c.S.heat = 0; c.S.locked = false; }, [sc.nv, sc.ir]);
  await settleLight(P); await frames(P, 20);
  await P.evaluate(t => window.__clock.set(t, 0), T0); await frames(P, 8); await settleLight(P); await frames(P, 10); await H.settle(P);
  return P.evaluate(() => { const w = __api.layer().parent; return { x: __api.H.x, y: __api.H.y, wx: w.position.x, wy: w.position.y, s: w.scale.x, nv: !!(window.__cam && __cam.nv), ir: window.__cam ? __cam.ir : 0, blackout: !!__api.V.blackout, lamps: window.__brRole ? __brRole.stats().lamps.last : null }; });
}
/* screenshot with the UI hidden; crop: a world box [x, y, w, h] (or null for the full frame) */
async function shot(s, st, { crop = null, ui = false } = {}) {
  const P = s.P;
  if (!ui) await P.evaluate(u => document.querySelectorAll(u).forEach(e => { e.dataset.vh = e.style.visibility; e.style.visibility = 'hidden'; }), UI);
  const png = await P.screenshot();
  if (!ui) await P.evaluate(u => document.querySelectorAll(u).forEach(e => { e.style.visibility = e.dataset.vh || ''; }), UI);
  if (!crop) return png;
  const L = Math.round(st.wx + crop[0] * st.s), T = Math.round(st.wy + crop[1] * st.s), W = Math.round(crop[2] * st.s), Hh = Math.round(crop[3] * st.s);
  const l = Math.max(0, Math.min(1920 - 1, L)), t = Math.max(0, Math.min(1080 - 1, T));
  return sharp(png).extract({ left: l, top: t, width: Math.min(W, 1920 - l), height: Math.min(Hh, 1080 - t) }).png().toBuffer();
}
/* the darkness overlay's opacity (0 = fully lit, 1 = black) at world points, read from the light canvas */
const overlayAt = (P, pts) => P.evaluate(pts => { const c = document.getElementById('light'), x = c.getContext('2d'), w = __api.layer().parent, k = c.width / innerWidth;
  return pts.map(([X, Y]) => { const px = Math.floor((w.position.x + X * w.scale.x) * k), py = Math.floor((w.position.y + Y * w.scale.y) * k); if (px < 0 || py < 0 || px >= c.width || py >= c.height) return null; return x.getImageData(px, py, 1, 1).data[3] / 255; }); }, pts);
/* the whole light canvas alpha (Uint8Array, w x h) and its world transform */
const overlay = P => P.evaluate(() => { const c = document.getElementById('light'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w = __api.layer().parent; const a = new Uint8Array(c.width * c.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  let s = ''; const CH = 0x8000; for (let i = 0; i < a.length; i += CH) s += String.fromCharCode.apply(null, a.subarray(i, i + CH)); return { w: c.width, h: c.height, k: c.width / innerWidth, wx: w.position.x, wy: w.position.y, s: w.scale.x, a: btoa(s) }; })
  .then(o => Object.assign(o, { a: Uint8Array.from(Buffer.from(o.a, 'base64')) }));
module.exports = { H, sharp, open, close, scene, shot, overlayAt, overlay, settleLight, ready, T0, frames, sleep };
