/* 2D Lighting & Shadows - shared browser-harness helpers (development only; never served, never loaded by the game).
 *
 * Admin actions go straight over the page's own WebSocket as the same admin messages the admin panel sends
 * ({t:'a', c:'freeze', on:1} ...), with EXPLICIT values (the panel's buttons toggle and can lag the server), and each
 * change is confirmed from the server's own snapshots before the harness moves on.  Nothing here changes a game rule:
 * it is the documented admin path (testAuth) every retained browser suite already uses. */
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } })();
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* page init script: a test-only clock that can be frozen (exact, or +1 us per frame so Pixi keeps rendering), and a tap on the
 * page's WebSocket (what it sends, its id from 'hi', the latest admin snapshot) */
const INIT = `(() => { const real = performance.now.bind(performance); let fz = null, step = .001;
  performance.now = () => fz === null ? real() : fz;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => cb(fz === null ? ts : fz));
  const adv = () => { if (fz !== null) fz += step; raf(adv); }; raf(adv);
  window.__clock = { freeze(exact) { fz = real(); step = exact ? 0 : .001; }, thaw() { fz = null; }, get frozen() { return fz !== null; } };
  const S = window.WebSocket; window.__sent = []; window.__wsTap = { id: 0, admin: null };
  window.WebSocket = function (u, p) { const ws = new S(u, p); window.__ws = ws; const send = ws.send.bind(ws);
    ws.send = d => { try { window.__sent.push([performance.now(), String(d)]); } catch (e) { } return send(d); };
    ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.t === 'hi') window.__wsTap.id = m.id; else if (m.t === 'admin') window.__wsTap.admin = m; } catch (x) { } });
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
})();`;

const adm = (P, o) => P.evaluate(o => { const ws = window.__ws; if (ws && ws.readyState === 1) { ws.send(JSON.stringify(Object.assign({ t: 'a' }, o))); return true; } return false; }, o);
const frames = (P, n) => P.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const lightHash = P => P.evaluate(async () => { const c = document.getElementById('light'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const h = await crypto.subtle.digest('SHA-256', d); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); });
const counts = P => P.evaluate(() => ({ h: (window.__hounds || []).filter(Boolean).length, s: __api.q.filter(o => o && !o.off).length }));
const adminInfo = P => P.evaluate(() => window.__wsTap && window.__wsTap.admin);
async function until(fn, ms = 6000, every = 150) { const t = Date.now(); for (; ;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) return v; await sleep(every); } }

/* join a room as `name`; admin pages get the test admin authority (the same testAuth the retained suites use) */
async function join(browser, port, room, name, { admin = true, viewport = { width: 1280, height: 720 }, dpr = 1, mobile = false, query = '' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile }), P = await ctx.newPage(), errs = [], missing = [];
  await P.addInitScript(INIT);
  P.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 240)));
  P.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(t) && !/fonts\.g|ERR_TUNNEL/.test(t)) errs.push('console: ' + t.slice(0, 240)); if (/shadows-2d/.test(t)) errs.push('module: ' + t.slice(0, 240)); });
  P.on('response', r => { if (r.status() === 404) missing.push(new URL(r.url()).pathname); });
  await P.goto(`http://127.0.0.1:${port}/?room=${room}${query}`); await sleep(2000);
  await P.fill('#name', name);
  await P.evaluate(a => { document.getElementById('enter').click(); if (a && window.__net && __net.testAuth) __net.testAuth('smoor'); }, admin);
  await until(() => P.evaluate(() => !!(window.__api && __api.H && window.__ws && __ws.readyState === 1 && document.getElementById('hud') && !document.getElementById('hud').hidden)), 15000);
  if (admin) await until(() => adminInfo(P), 6000);
  return { ctx, P, errs, missing };
}
/* an admin-panel-free, explicit world setup: frozen halls, no monsters, god mode on for this page */
async function stage(P) {
  await adm(P, { c: 'freeze', on: 0 });
  for (let i = 0; i < 12; i++) { const c = await counts(P); if (!c.h && !c.s) break; await adm(P, { c: 'hounds', mode: 'remove', n: 10 }); await adm(P, { c: 'smilers', mode: 'remove', n: 10 }); await sleep(450); }
  const me = await P.evaluate(() => window.__wsTap.id);
  const godOn = async () => { const a = await adminInfo(P); const p = a && a.pl && a.pl.find(q => q.id === me); return p && p.g; };
  if (!(await godOn())) { await adm(P, { c: 'god', id: me }); await until(godOn, 4000); }
  await adm(P, { c: 'freeze', on: 1 }); await sleep(300);
  return counts(P);
}
/* lights: 'off' (forced on), 'on' (forced blackout), 'auto'; applied on a running tick and confirmed from the snapshots */
async function setLights(P, mode) {
  const want = mode === 'on';
  await adm(P, { c: 'freeze', on: 0 }); await adm(P, { c: 'blackout', mode });
  const ok = mode === 'auto' || await until(async () => (await P.evaluate(() => !!__api.V.blackout)) === want, 6000);
  await adm(P, { c: 'freeze', on: 1 }); await sleep(250);
  return !!ok;
}
/* place the wanderer (nearest clear floor), hold an aim (optionally sweeping), light on/off, flashlight */
async function place(P, x, y, aim, { sweep = 0, light = true, kind = 'flashlight' } = {}) {
  const at = await P.evaluate(([x, y]) => { const A = __api; if (A.sl(x, y, 26)) return [x, y]; for (let d = 8; d < 200; d += 8) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d; if (A.sl(X, Y, 26)) return [Math.round(X), Math.round(Y)]; } return [x, y]; }, [x, y]);
  await P.evaluate(([x, y, a, w, kind]) => { __api.gear.eq.kind = kind; __api.tp(x, y); window.__aimA = a; window.__aimW = w; window.__aimT0 = performance.now();
    if (!window.__aimHook) { window.__aimHook = 1; const f = () => { if (window.__aimA !== undefined) __api.H.angle = window.__aimA + (window.__aimW || 0) * (performance.now() - window.__aimT0) / 1000; requestAnimationFrame(f); }; requestAnimationFrame(f); } }, [at[0], at[1], aim, sweep, kind]);
  if ((await P.evaluate(() => __api.lightOn())) !== light) { await P.keyboard.press('KeyF'); await sleep(150); }
  return at;
}
/* add a monster near the wanderer (the admin 'near' command), let it settle, freeze again; returns its client position */
async function near(P, k) {
  const before = await counts(P);
  await adm(P, { c: 'freeze', on: 0 }); await adm(P, { c: 'near', k });
  await until(async () => { const c = await counts(P); return k === 'hound' ? c.h > before.h : c.s > before.s; }, 5000);
  await adm(P, { c: 'freeze', on: 1 }); await sleep(600);
  return P.evaluate(k => { const o = k === 'hound' ? (window.__hounds || []).filter(Boolean).slice(-1)[0] : __api.q.filter(o => o && !o.off).slice(-1)[0]; return o ? [o.x, o.y] : null; }, k);
}
/* wait until the frozen overlay stops changing (a few frames after a freeze) */
async function settle(P) { await frames(P, 4); for (let i = 0, h0 = null; i < 14; i++) { const h = await lightHash(P); if (h === h0) return h; h0 = h; await frames(P, 4); await sleep(120); } return null; }

module.exports = { pw, ARGS, sleep, INIT, adm, frames, lightHash, counts, adminInfo, until, join, stage, setLights, place, near, settle };
