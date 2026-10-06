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

/* page init script: a test-only clock that can be frozen (exact, or +1 us per frame so Pixi keeps rendering; get / set let a
 * capture run the frozen clock forward and rewind it to the same instant), and a tap on the
 * page's WebSocket (what it sends, its id from 'hi', the latest admin snapshot) */
const INIT = `(() => { const real = performance.now.bind(performance); let fz = null, step = .001;
  performance.now = () => fz === null ? real() : fz;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => cb(fz === null ? ts : fz));
  const adv = () => { if (fz !== null) fz += step; raf(adv); }; raf(adv);
  window.__clock = { freeze(exact) { fz = real(); step = exact ? 0 : .001; }, thaw() { fz = null; }, get frozen() { return fz !== null; },
    get() { return fz; }, set(v, s) { fz = v; if (s !== undefined) step = s; } };   // set: jump the frozen clock (and its per-frame step), e.g. run 1 s forward then rewind to the same instant
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

/* join a room as `name`; admin pages get the test admin authority (the same testAuth the retained suites use).
 * `init`: extra page init script(s) that run after the harness's own (e.g. the bench's frame accounting) */
async function join(browser, port, room, name, { admin = true, viewport = { width: 1280, height: 720 }, dpr = 1, mobile = false, query = '', init = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile }), P = await ctx.newPage(), errs = [], missing = [];
  await P.addInitScript(INIT);
  for (const s of [].concat(init || [])) await P.addInitScript(s);
  P.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 240)));
  P.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(t) && !/fonts\.g|ERR_TUNNEL/.test(t)) errs.push('console: ' + t.slice(0, 240)); if (/shadows-2d/.test(t)) errs.push('module: ' + t.slice(0, 240)); });
  P.on('response', r => { if (r.status() === 404) missing.push(new URL(r.url()).pathname); });
  await P.goto(`http://127.0.0.1:${port}/?room=${room}${query}`, { timeout: 60000 }); await sleep(2000);
  /* a slow software-rendered box with other clients already drawing can take well over the default 30 s to show the lobby */
  await P.waitForSelector('#name', { state: 'visible', timeout: 60000 });
  await P.fill('#name', name, { timeout: 60000 });
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

/* a scripted wanderer over the real WebSocket protocol (scene_bench.js's Peer, the live.js client format), with real admin
 * rights to join the harness page and stand where a scene wants it, its light on, aimed: another wanderer for the overlay
 * (its light) and for the module (its shadows), without a second rendering page */
class ScriptedPeer {
  constructor(port, room, name, kind = 'flashlight', color = '#ffe7b2') {
    Object.assign(this, { name, kind, color, id: 0, admin: null, pos: { x: 0, y: 0 }, angle: 0, timer: null });
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`);
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'hi') this.id = m.id; else if (m.t === 'admin') this.admin = m; else if (m.t === 'tp') this.pos = { x: m.x, y: m.y }; };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  start() { this.send({ t: 'join' }); this.timer = setInterval(() => this.send({ t: 'p', x: Math.round(this.pos.x), y: Math.round(this.pos.y), vx: 0, vy: 0, a: +this.angle.toFixed(2), r: 0, l: 1, k: this.kind, n: this.name, c: this.color, mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } }), 50); }
  async walkTo(x, y, speed = 220) { for (let i = 0; i < 400; i++) { const dx = x - this.pos.x, dy = y - this.pos.y, d = Math.hypot(dx, dy); if (d < 2) break; const s = Math.min(d, speed / 20); this.pos = { x: this.pos.x + dx / d * s, y: this.pos.y + dy / d * s }; await sleep(50); } }
  /* join, go to the harness wanderer named `host` (admin goto), then walk to (x, y) and aim */
  async standAt(host, x, y, angle) {
    await this.ready; this.start(); this.send({ t: 'admin', pass: 'smoor' }); await sleep(1200);
    const me = this.admin && this.admin.pl && this.admin.pl.find(q => q.n === host); if (me) this.send({ t: 'a', c: 'goto', id: me.id });
    await sleep(700); await this.walkTo(x, y); this.angle = angle; await sleep(800);
  }
  close() { clearInterval(this.timer); try { this.ws.close(); } catch (e) { } }
}

module.exports = { pw, ARGS, sleep, INIT, adm, frames, lightHash, counts, adminInfo, until, join, stage, setLights, place, near, settle, ScriptedPeer };
