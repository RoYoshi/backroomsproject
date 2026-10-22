#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/r9_browser.js - Trial 3 R9-R17 real-page scenes (development tool; checkpoint evidence, not a gate step).
 * Trial 3 and its refinements are not owner-approved.
 *
 *   node dev/trial-3-r9-overhaul/tools/r9_browser.js --scene flankwatch [--dir DIR] [--tries 4] [--secs 20] [--out FILE.json]
 *        [--shots DIR] [--video DIR]
 *
 * One server (`node server.js PORT` in DIR, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader).  Every
 * person is a real page moved by its own keys and its own mouse (facing, torch); the admin panel's own commands set the scene (freeze, the
 * Hounds and Smilers removed); a creature is placed by the test-only qa_server.js where a scene says, as dev/tests place one.  The page's view of the creature is
 * measured ON THE PAGE with the client's own functions: on screen (this frame's camera), inside the sight mask (rays with __api.Uc, the
 * function the mask is built from, to the body's centre and 18 px either side, within 700 px) and readable in the dark (__api.Ul, the
 * client's exposureAt, >= .25).  The creature's plan and reason come from the admin debug the server sends (read only to report).
 *   flankwatch  R9 (the owner's report; repro_r9.js's W in a real page): the page stands in the long lit hall at (5000, 3504), torch on;
 *               a Skin-Stealer is placed 450 px east of it (hunger .6 / .75 / .85 by try; the test-only qa_server.js places it exactly as
 *               the tests do) and the page keeps looking where it last saw it.  Every stealth transit (a flank to its spot, the bait's
 *               back-off, an approach from a flank) is timed against the page's own view: how much of it the page could see.
 * Every name and passcode is synthetic; no address, path or secret is written to the output. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = { scene: 'flankwatch', tries: '4', secs: '20' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), PASS = 'k3-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const VIDEO = ARG.video ? path.resolve(ARG.video) : null; if (VIDEO) fs.mkdirSync(VIDEO, { recursive: true });
const SECS = +ARG.secs, TRIES = +ARG.tries;
const LAUNCH = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
/* before the page's scripts: the game socket kept (the panel's commands), every snapshot's ss list noted, this frame's camera; the page's
 * own view of a body (on screen, in the sight mask, readable) */
const INIT = `(() => {
  const S = window.WebSocket; window.__k3 = { game: null, unlocked: false, ss: null, inputs: [] };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__k3.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data);
      if (m.t === 'admin' && m.ok) window.__k3.unlocked = true;
      if (m.t === 's' && m.e) window.__k3.ss = m.e.ss || null; } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
  let mp = null; Object.defineProperty(window, '__mp', { configurable: true, get: () => mp ? (a => { window.__k3.cam = { x: a.cam.x, y: a.cam.y, sc: a.sc }; return mp(a); }) : mp, set: f => { mp = f; } });
  window.__k3.screen = (x, y) => { const c = window.__k3.cam; return c ? { x: innerWidth / 2 + (x - c.x) * c.sc, y: innerHeight / 2 + (y - c.y) * c.sc } : null; };
  window.__k3.key = (c, down) => { window.__k3.inputs.push([Date.now(), down ? 'down' : 'up', c]); window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c, key: c === 'ShiftLeft' ? 'Shift' : c.slice(3).toLowerCase(), bubbles: true })); };
  /* the audio the page actually makes (observed on the AudioContext, not inferred from state): every oscillator frequency set to 70 or 58 Hz
   * (the dread heartbeat's two thumps, mp.dread.js thump(v, 70 / 58)), every buffer the page builds (a burst's length) - and, once the
   * page's sfx exists, every sting it plays (K.hookSfx) */
  window.__k3.audio = [];
  { const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const oc = AC.prototype.createOscillator, cb = AC.prototype.createBuffer;
      AC.prototype.createOscillator = function () { const o = oc.call(this), f = o.frequency, sv = f.setValueAtTime;
        f.setValueAtTime = function (v, t) { if (v === 70 || v === 58) window.__k3.audio.push([+(performance.now() / 1000).toFixed(3), 'thump', v]); return sv.call(this, v, t); }; return o; };
      AC.prototype.createBuffer = function (ch, len, rate) { const L = len / rate; if (L > .2 && L < 1.5) window.__k3.audio.push([+(performance.now() / 1000).toFixed(3), 'buffer', +L.toFixed(2)]); return cb.call(this, ch, len, rate); }; } }
  window.__k3.hookSfx = () => { const X = window.__sfx; if (!X || X.__k3) return !!X; const f = X.play; X.play = function (n, o) { if (n === 'sting') window.__k3.audio.push([+(performance.now() / 1000).toFixed(3), 'sting', o && o.vol]); return f.call(this, n, o); }; X.__k3 = 1; return true; };
  /* the page's own view of a body at (x, y): {on: on screen, mask: in the sight mask (of 3 rays), leg: readability, vis} */
  window.__k3.view = (x, y) => { const A = window.__api, H = A && A.H, s = window.__k3.screen(x, y); if (!H || !s) return { on: 0, mask: 0, leg: 0, vis: 0 };
    const on = s.x > -20 && s.y > -20 && s.x < innerWidth + 20 && s.y < innerHeight + 20 ? 1 : 0, d = Math.hypot(x - H.x, y - H.y), ux = (x - H.x) / (d || 1), uy = (y - H.y) / (d || 1);
    let mask = 0, leg = 0;
    for (const k of [0, -1, 1]) { const qx = x - uy * 18 * k, qy = y + ux * 18 * k, dq = Math.hypot(qx - H.x, qy - H.y); if (dq > 700) continue;
      if (A.Uc(H.x, H.y, Math.atan2(qy - H.y, qx - H.x), dq + 1) < dq - .5) continue; mask++; leg = Math.max(leg, A.Ul(qx, qy, H, A.lightOn())); }
    return { on, mask, leg: +leg.toFixed(3), vis: on && mask && leg >= .25 ? 1 : 0 }; };
})();`;
/* the server: DIR's own server.js, loaded by the test-only qa_server.js (which keeps each room's sim so that a scene can PLACE a creature
 * exactly, as dev/tests do; it never steers one) */
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, [path.join(__dirname, 'qa_server.js'), DIR, String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: ['pipe', 'pipe', 'ignore'] });
  const waiting = []; let buf = '';
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const w = waiting.shift(); if (w) { try { w(JSON.parse(line)); } catch (e) { w(null); } } } });
  const qa = o => new Promise(r => { waiting.push(r); p.stdin.write(JSON.stringify(o) + '\n'); });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port, qa }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000, every = 50) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } }
async function runPage(b, port, room, VP, name, video) {
  const ctx = await b.newContext(Object.assign({ viewport: VP }, video ? { recordVideo: { dir: video, size: { width: VP.width / 2, height: VP.height / 2 } } } : {}));
  await ctx.addInitScript(INIT);
  const t0 = Date.now(), P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', name);
  await P.bringToFront(); await P.click('#enter');
  await until(P, () => !!(window.__net && __net.on && window.__k3.game && window.__api.started()), null, 30000);
  await sleep(2500);
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__k3.unlocked, null, 5000);
  return { ctx, P, errs, t0, cmd: o => P.evaluate(o => window.__k3.game.send(JSON.stringify(Object.assign({ t: 'a' }, o))), o) };
}
async function aimAt(P, x, y) { const s = await P.evaluate(q => window.__k3.screen(q.x, q.y), { x, y }).catch(() => null); if (s) await P.mouse.move(s.x, s.y, { steps: 2 }).catch(() => { }); }
async function alive(pg, admin, id) { if (await pg.P.evaluate(() => !!(__api.death() && __api.death().active) || !!__api.H.dead)) { admin.cmd({ c: 'revive', id }); await sleep(1800); } }
/* the stealth transits in a run's samples: a flank on its way (before 'at P..'s side'), the bait's back-off, an approach from a flank */
function transitsOf(rec) {
  const out = []; let T = null;
  // (R13: the server says a move's mode - covert, open, feint - and a covert move's phase: its withdrawal out of their view ('exit', meant
  // to be seen, straight away from them) and its hidden way; R8 had no modes, so its kinds are read from its reasons)
  const kindOf = r => r.mode === 'covert' ? r.pl + ':covert' + (r.phase === 'exit' ? ':withdrawal' : '') : r.mode === 'open' ? r.pl + ':open' : r.mode === 'feint' ? 'bait:feint'
    : r.pl === 'flank' && !/^at P\d+'s side/.test(r.why) ? 'flank' : r.pl === 'retreat' && /round a corner/.test(r.why) && !/^round the corner/.test(r.why) ? 'bait'
    : r.pl === 'approach' && /at their side: it comes at them/.test(r.why) ? 'side-approach' : '';
  for (const r of rec) {
    const k = kindOf(r);
    if (T && k !== T.k) { out.push(T); T = null; }
    if (k && !T) T = { k, t0: r.t, n: 0, vis: 0, on: 0, mask: 0, first: r.why.slice(0, 90), moved: 0, visMoved: 0, lx: r.K[0], ly: r.K[1] };
    if (T) { const st = Math.hypot(r.K[0] - T.lx, r.K[1] - T.ly); T.lx = r.K[0]; T.ly = r.K[1]; T.n++; T.moved += st; if (r.v.vis) { T.vis++; T.visMoved += st; } if (r.v.on) T.on++; if (r.v.mask) T.mask++; T.t1 = r.t; }
  }
  if (T) out.push(T);
  return out.map(t => ({ k: t.k, t0: t.t0, t1: t.t1, samples: t.n, visible: t.vis, share: +(t.vis / Math.max(1, t.n)).toFixed(2), moved: Math.round(t.moved), visMoved: Math.round(t.visMoved), why: t.first }));
}
async function flankwatch(b, port, R, qa) {
  const room = 'r9fw' + (Date.now() % 1e6), VP = { width: +(ARG.w || 1024), height: +(ARG.h || 640) };
  const W = await runPage(b, port, room, VP, 'K3Watch', VIDEO);
  W.cmd({ c: 'freeze', on: true }); W.cmd({ c: 'hounds', mode: 'remove', n: 10 }); W.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
  W.cmd({ c: 'hounds', mode: 'remove', n: 10 }); W.cmd({ c: 'smilers', mode: 'remove', n: 10 });
  const wid = await W.P.evaluate(() => __api.H.id); W.cmd({ c: 'debug', on: true });
  await W.P.evaluate(() => { Object.assign(window.__ents.dbgCfg, { on: false, ai: true }); });   // the debug data, the overlay itself off (a player's view)
  R.tries = [];
  // the owner's scene, as repro_r9.js's W: the person in the long lit hall, the creature 450 px east of them, hungry; they keep looking
  // where they last saw it (the page's mouse)
  const HUNGER = [.6, .75, .85, .75, .6, .85];
  for (let tr = 1; tr <= TRIES; tr++) {
    W.cmd({ c: 'freeze', on: true }); W.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); await sleep(500); await alive(W, W, wid);
    await W.P.evaluate(() => { __api.tp(5000, 3504); window.__k3.ss = null; }); await sleep(400);
    const placed = await qa({ op: 'spawn', kind: 'skinstealer', x: 5450, y: 3504, hunger: HUNGER[(tr - 1) % HUNGER.length], ang: Math.PI });
    const K0 = await until(W.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0] : null, null, 8000);
    const T = { tr, at: { x: 5000, y: 3504 }, placed, creature: K0 }; R.tries.push(T); if (!K0) { T.skipped = 'no creature'; continue; }
    if (!(await W.P.evaluate(() => __api.lightOn()))) await W.P.keyboard.press('KeyF');
    await sleep(300); await aimAt(W.P, K0.x, K0.y);
    const t0 = Date.now(); T.videoAt = +((t0 - W.t0) / 1000).toFixed(1);
    W.cmd({ c: 'freeze', on: false });
    // ten times a second, inside the page (so that the page's own pace sets nothing): what the server's debug says it does, where it
    // is drawn, the page's own view of it; and the page's mouse (a pointer move, as the game reads it) on where it last saw it
    await W.P.evaluate(k0 => { const K = window.__k3; K.rec = []; K.last = { x: k0.x, y: k0.y }; const t0 = performance.now(); K.frames = 0; const fr = () => { K.frames++; K.raf = requestAnimationFrame(fr); }; fr();
      K.watchT = setInterval(() => { const k = (K.ss || [])[0], H = __api.H; if (!k) return; const d = (window.__ents.dbg || []).find(x => x.i === k.i), q = d && d.sk, v = K.view(k.x, k.y);
        K.rec.push({ t: +((performance.now() - t0) / 1000).toFixed(2), K: [k.x, k.y, +(+k.a).toFixed(2), k.ac], pl: q ? q.pl : '?', why: q ? q.why : '', mode: q && q.cv ? q.cv.mode : '', phase: q && q.cv ? q.cv.phase : '', hu: q ? q.hu : -1, v, H: [Math.round(H.x), Math.round(H.y), +H.angle.toFixed(2)], dead: !!H.dead });
        if (v.vis) K.last = { x: k.x, y: k.y };
        const s = K.screen(K.last.x, K.last.y); if (s) window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: s.x, clientY: s.y, bubbles: true })); }, 100); }, K0);
    let shots = 0;
    while (Date.now() - t0 < SECS * 1000) {
      await sleep(250);
      const s = await W.P.evaluate(() => { const r = window.__k3.rec; return r.length ? r[r.length - 1] : null; }).catch(() => null);
      if (s && SHOTS && !ARG.noshots && shots < 8 && s.v.vis && ['flank', 'retreat', 'approach'].includes(s.pl) && s.t > .7 * shots) { shots++; await W.P.screenshot({ path: path.join(SHOTS, `flankwatch_try${tr}_${String(shots).padStart(2, '0')}_${s.pl}_t${s.t}.png`) }).catch(() => { }); }
      if (s && s.dead) break;
    }
    const rec = await W.P.evaluate(() => { clearInterval(window.__k3.watchT); cancelAnimationFrame(window.__k3.raf); return window.__k3.rec.slice(); });
    T.fps = +(await W.P.evaluate(() => window.__k3.frames) / Math.max(1, (Date.now() - t0) / 1000)).toFixed(1);
    T.samples = rec.length; T.plans = [...new Set(rec.map(r => r.pl))]; T.hunger = rec.length ? rec[0].hu : -1; T.killed = rec.some(r => r.dead);
    T.transits = transitsOf(rec); T.trace = rec.map(r => [r.t, r.pl, r.K[0], r.K[1], r.v.on, r.v.mask, r.v.leg, r.v.vis, r.why.slice(0, 70)]);
  }
  R.errors = W.errs;
  await W.ctx.close();                                                    // (writes the video)
  if (VIDEO) { const v = W.P.video && W.P.video(); if (v) R.videoFile = path.basename(await v.path()); }
}
/* audio: what the page plays (the AudioContext, observed) and its dread vignette (#dread's opacity, k's visual) in a few placed scenes, each
 * with the world frozen so that nothing moves: R9 runs it on R8 (the baseline: no Skin-Stealer contribution at all), R10 on the new build */
async function audio(b, port, R, qa) {
  const room = 'r9au' + (Date.now() % 1e6), VP = { width: +(ARG.w || 1024), height: +(ARG.h || 640) };
  const A = await runPage(b, port, room, VP, 'K3Ears', VIDEO);
  A.cmd({ c: 'freeze', on: true }); A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
  A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 });
  await A.P.keyboard.press('KeyW'); await sleep(200);                   // (a key: the page's audio context starts on a key or a click)
  R.sfxHooked = await until(A.P, () => window.__k3.hookSfx(), null, 5000);
  const at = { x: 5000, y: 3504 }; R.cases = [];
  const clear = async () => { A.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(700); };
  const listen = async (name, secs, extra) => {
    const t0 = await A.P.evaluate(() => performance.now() / 1000); const op = []; const tEnd = Date.now() + secs * 1000;
    while (Date.now() < tEnd) { op.push(await A.P.evaluate(() => +(document.getElementById('dread').style.opacity || 0))); await sleep(200); }
    const au = await A.P.evaluate(t => window.__k3.audio.filter(a => a[0] >= t), t0), sl = await A.P.evaluate(() => window.__skin && window.__skin.sightLog ? window.__skin.sightLog.slice(-40) : null);
    const C = Object.assign({ name, secs, thumps: au.filter(a => a[1] === 'thump' && a[2] === 70).length, stings: au.filter(a => a[1] === 'sting').length, bursts: au.filter(a => a[1] === 'buffer').length,
      dreadMax: +Math.max(0, ...op).toFixed(3), sightLog: sl }, extra || {});
    R.cases.push(C); return C;
  };
  await A.P.evaluate(q => __api.tp(q.x, q.y), at); if (!(await A.P.evaluate(() => __api.lightOn()))) await A.P.keyboard.press('KeyF');
  await clear(); await listen('none', 5);
  // a satiated Skin-Stealer, frozen, 260 px east in the lit hall (on screen, in the sight mask, readable)
  await clear(); let k = await qa({ op: 'spawn', kind: 'skinstealer', x: at.x + 260, y: at.y, hunger: .05, ang: Math.PI }); await sleep(600);
  await listen('skin-visible', 6, { placed: k, view: await A.P.evaluate(q => window.__k3.view(q.x, q.y), { x: at.x + 260, y: at.y }) });
  // one 1-2 cells away behind a wall (no clear line from the page; the page's own level functions)
  await clear();
  const hid = await A.P.evaluate(h => { const A = __api; for (const r of [110, 140, 170, 200, 230, 260, 290, 320]) for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
    if (A.sl(x, y, 26) && A.Uc(h.x, h.y, a, r) < r - 30 && window.__k3.view(x, y).mask === 0) return { x: Math.round(x), y: Math.round(y), d: r }; } return null; }, at);
  if (hid) { k = await qa({ op: 'spawn', kind: 'skinstealer', x: hid.x, y: hid.y, hunger: .05 }); await sleep(600); await listen('skin-behind-wall', 6, { placed: k, at: hid, view: await A.P.evaluate(q => window.__k3.view(q.x, q.y), hid) }); }
  // the Hound, the same 260 px east (the established dread: its proximity k)
  await clear(); k = await qa({ op: 'spawn', kind: 'hound', x: at.x + 260, y: at.y }); await sleep(600);
  await listen('hound-visible', 6, { placed: k });
  await clear();
  R.errors = A.errs; await A.ctx.close();
  if (VIDEO) { const v = A.P.video && A.P.video(); if (v) R.videoFile = path.basename(await v.path()); }
}
/* gallery (R9 before / R14 after / R15 D): the undisguised body as the page draws it.  Figures are added to THIS page's mirror only (as
 * Trial 3's gallery and R5's lineup did: the page's own drawing, sight mask, darkness and light; the server knows nothing of them): eight
 * headings (0, 45 ... 315 deg) for each act, moving at the act's own pace where the act moves; beside them the page's own Wanderer.  Then
 * the real deaths A-C (and D where the tree has it) through the admin DEATHS preview: the victim's own screen and a second page's. */
const FAKE = `(F => { const K = window.__skin; if (!K.__k3wrap) { const m = K.mirror; K.mirror = (list, dt) => m((list || []).concat(window.__k3.fake || []), dt); K.__k3wrap = 1; } window.__k3.fake = F; })`;
async function gallery(b, port, R, qa) {
  const room = 'r9ga' + (Date.now() % 1e6), VP = { width: +(ARG.w || 1280), height: +(ARG.h || 720) }, tag = ARG.tag || 'now';
  const O = await runPage(b, port, room, VP, 'K3Eye');
  O.cmd({ c: 'freeze', on: true }); O.cmd({ c: 'hounds', mode: 'remove', n: 10 }); O.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
  O.cmd({ c: 'hounds', mode: 'remove', n: 10 }); O.cmd({ c: 'smilers', mode: 'remove', n: 10 }); O.cmd({ c: 'skinstealers', mode: 'remove', n: 4 });
  const C = { x: 6700, y: 3440 }, OB = { x: C.x - 420, y: C.y }; await O.P.evaluate(q => __api.tp(q.x, q.y), OB); await sleep(4500);   // (lamp-lit open hall; the room's title fades first)
  if (!(await O.P.evaluate(() => __api.lightOn()))) await O.P.keyboard.press('KeyF');
  await O.P.mouse.move(VP.width / 2 + 300, VP.height / 2);                 // (its torch on the figures)
  const ACTS = await O.P.evaluate(() => window.__skin && null);           // (the codes: the tree's own KACT, from its built ai.js below)
  void ACTS;
  const KACT = require(path.join(DIR, 'generated', 'server', 'ai.js')).KACT, SCODE = require(path.join(DIR, 'generated', 'server', 'ai.js')).SCODE;
  const SETS = [['stand', '', 0, 'ROAMING'], ['watch', 'watch', 0, 'WATCHING'], ['listen-head', 'listen', 0, 'ALERT', .8], ['creep', 'creep', 62, 'STALKING'], ['approach', 'approach', 90, 'STALKING'],
    ['run (chase)', 'chase', 255, 'HUNTING'], ['run (intercept)', 'intercept', 230, 'STALKING'], ['wind-up', 'wind', 0, 'ATTACKING'], ['pounce', 'pounce', 380, 'ATTACKING'], ['recover', 'recover', 0, 'ATTACKING'], ['wait (coiled)', 'wait', 0, 'STALKING'], ['feed', 'feed', 0, 'FEEDING']];
  R.gallery = [];
  for (const [label, act, v, st, head] of ARG.only === 'places' ? [] : SETS) {
    const F = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = C.x + ((i % 4) - 1.5) * 110, y = C.y - 70 + Math.floor(i / 4) * 150; F.push({ i: 900 + i, x, y, a, s: SCODE[st] | 0, ac: KACT[act] | 0, v, h: head || 0, x0: x, y0: y }); }
    await O.P.evaluate(`(${FAKE})(${JSON.stringify(F)})`);
    // moving acts move, along their heading, at their pace (every frame), back to the start every 3 s (a jump the body's pose resets on)
    await O.P.evaluate(() => { const K = window.__k3; if (K.galT) cancelAnimationFrame(K.galT); const t0 = performance.now();
      const f = () => { const t = ((performance.now() - t0) / 1000) % 3; for (const o of K.fake) if (o.v) { o.x = o.x0 + Math.cos(o.a) * o.v * t * (o.v > 300 ? .25 : 1); o.y = o.y0 + Math.sin(o.a) * o.v * t * (o.v > 300 ? .25 : 1); } K.galT = requestAnimationFrame(f); }; f(); });
    await sleep(v > 150 ? 650 : 1600);                                  // (fast ones are shot early in their stretch, still on screen)
    const file = `gallery_${tag}_${label.replace(/[^a-z]+/gi, '_')}.png`;
    if (SHOTS) await O.P.screenshot({ path: path.join(SHOTS, file), clip: { x: VP.width / 2 - 60, y: VP.height / 2 - 170, width: 700, height: 340 } }).catch(() => { });
    const sz = await O.P.evaluate(() => { const L = __api.layer(); const v = L.children.find(c => c.label === 'skinstealer#900'); if (!v) return null; const b = v.getLocalBounds(); return { w: +(b.width * v.scale.x).toFixed(1), h: +(b.height * v.scale.y).toFixed(1), scale: v.scale.x }; });
    R.gallery.push({ label, act, v, file: SHOTS ? file : '', size0: sz });
  }
  await O.P.evaluate(() => { const K = window.__k3; if (K.galT) cancelAnimationFrame(K.galT); K.fake = []; });
  if (ARG.places !== '0') { await places(O, R, VP, tag, KACT, SCODE, C); await drawCost(O, R, KACT, SCODE, C); }
  // the deaths: the admin's DEATHS preview on this page (the victim), a second page beside it (a spectator)
  const Sp = await runPage(b, port, room, VP, 'K3Witness'); const oid = await O.P.evaluate(() => __api.H.id);
  O.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); await sleep(400);
  await Sp.P.evaluate(q => __api.tp(q.x + 200, q.y), OB); if (!(await Sp.P.evaluate(() => __api.lightOn()))) await Sp.P.keyboard.press('KeyF');
  R.deaths = [];
  for (const v of ARG.only === 'places' ? [] : (ARG.vars || 'A,B,C').split(',')) {
    await alive(O, O, oid); await O.P.evaluate(q => __api.tp(q.x, q.y), OB); await sleep(500);
    O.cmd({ c: 'preview', k: 'skinstealer', var: v }); const t0 = Date.now(), D = { v, shots: [] };
    for (const at of [.3, .8, 1.5, 2.6, 4.5]) { const wait = t0 + at * 1000 - Date.now(); if (wait > 0) await sleep(wait);
      if (SHOTS) { const f1 = `death_${tag}_${v}_victim_${at}s.png`, f2 = `death_${tag}_${v}_spectator_${at}s.png`;
        await O.P.screenshot({ path: path.join(SHOTS, f1) }).catch(() => { }); await Sp.P.screenshot({ path: path.join(SHOTS, f2) }).catch(() => { }); D.shots.push(f1, f2); } }
    D.res = await O.P.evaluate(() => { const d = __api.death(); return d ? { active: !!d.active, kind: d.kind, variant: d.variant } : null; });
    R.deaths.push(D); await sleep(2500);
  }
  R.errors = { O: O.errs, S: Sp.errs };
}
/* (R14) places: the body where the level puts it, each found on THIS page with BR-RoLE's own ray and light sample - against a wall (and
 * just behind one: nothing of it may show), in a narrow passage, in the dark with the torch off then on it, at a lamp's edge, in a borrowed
 * skin beside the undisguised body; the page's view of each figure (on screen / in the sight mask / readable) is recorded with its shot */
async function places(O, R, VP, tag, KACT, SCODE, C) {
  const P = O.P; R.places = [];
  const shot = async (name, at) => { await P.evaluate(q => __api.tp(q.x, q.y), at); await sleep(900);
    const file = `place_${tag}_${name}.png`; if (SHOTS) await P.screenshot({ path: path.join(SHOTS, file) }).catch(() => { }); return file; };
  const put = F => P.evaluate(`(${FAKE})(${JSON.stringify(F)})`);
  const ent = (i, x, y, a, act, st, o = {}) => Object.assign({ i, x, y, a, s: SCODE[st] | 0, ac: KACT[act] | 0, v: 0, h: 0 }, o);
  const views = ids => P.evaluate(ids => ids.map(i => { const o = (window.__k3.fake || []).find(f => f.i === i); return o ? Object.assign({ i }, window.__k3.view(o.x, o.y)) : null; }), ids);
  const torch = async on => { if ((await P.evaluate(() => __api.lightOn())) !== on) await P.keyboard.press('KeyF'); };
  // a wall: the nearest of four rays from the hall's centre
  const W = await P.evaluate(c => { let best = null; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, d = __light.ray(c.x, c.y, a, 600); if (d < 590 && (!best || d < best.d)) best = { a, d }; } return best; }, C);
  if (W) {
    const ux = Math.cos(W.a), uy = Math.sin(W.a), px = -uy, py = ux, f = { x: C.x + ux * (W.d - 30), y: C.y + uy * (W.d - 30) };
    // beyond it: the first open floor past the wall's far face
    const far = await P.evaluate(q => { for (let t = q.d + 8; t < q.d + 400; t += 8) { const x = q.x + Math.cos(q.a) * t, y = q.y + Math.sin(q.a) * t; if (__light.ray(x, y, q.a + Math.PI, 60) > 30 && __light.ray(x, y, q.a + Math.PI, t) < t - q.d + 4) return t; } return null; }, { x: C.x, y: C.y, a: W.a, d: W.d });
    const F = [ent(950, f.x, f.y, W.a, 'watch', 'WATCHING'), ent(951, f.x + px * 110, f.y + py * 110, W.a + Math.PI / 2, 'creep', 'STALKING'), ent(952, f.x - px * 110, f.y - py * 110, W.a, 'wind', 'ATTACKING')];
    if (far) F.push(ent(953, C.x + ux * (far + 30), C.y + uy * (far + 30), W.a + Math.PI, 'pounce', 'ATTACKING'), ent(954, C.x + ux * (far + 30) + px * 90, C.y + uy * (far + 30) + py * 90, W.a + Math.PI, 'wait', 'STALKING'));
    await put(F); await torch(true); const at = { x: C.x - ux * 120, y: C.y - uy * 120 }; await P.mouse.move(VP.width / 2 + ux * 250, VP.height / 2 + uy * 250);
    const file = await shot('wall', at); R.places.push({ name: 'wall (and behind it)', file, wall: Math.round(W.d), behind: far ? Math.round(far + 30) : null, views: await views(F.map(e => e.i)) });
  }
  // a narrow passage: walls within 70 px either side, open 200 px along it, lit enough to see
  const D = await P.evaluate(c => { for (let r = 200; r < 1600; r += 48) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    for (const ax of [0, Math.PI / 2]) { const s1 = __light.ray(x, y, ax + Math.PI / 2, 200), s2 = __light.ray(x, y, ax - Math.PI / 2, 200), f1 = __light.ray(x, y, ax, 300), f2 = __light.ray(x, y, ax + Math.PI, 300);
      if (s1 > 22 && s2 > 22 && s1 + s2 < 140 && f1 > 220 && f2 > 220) return { x, y, ax, w: Math.round(s1 + s2) }; } } return null; }, C);
  if (D) {
    const ux = Math.cos(D.ax), uy = Math.sin(D.ax);
    await put([ent(960, D.x, D.y, D.ax + Math.PI, 'creep', 'STALKING', { v: 0 }), ent(961, D.x + ux * 120, D.y + uy * 120, D.ax + Math.PI, 'wait', 'STALKING')]);
    const at = { x: D.x - ux * 200, y: D.y - uy * 200 }; await P.mouse.move(VP.width / 2 + ux * 250, VP.height / 2 + uy * 250); await torch(true);
    const file = await shot('passage', at); R.places.push({ name: `a passage ${D.w} px wide`, file, views: await views([960, 961]) });
  }
  // the dark: open floor where nothing lights it, the torch off and then on it
  const K = await P.evaluate(c => { for (let r = 300; r < 2400; r += 64) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    let open = true; for (let j = 0; j < 8; j++) if (__light.ray(x, y, j * Math.PI / 4, 70) < 66) open = false; if (!open) continue;
    const s = __light.sample(x, y, false); if (s.total > .1) continue;
    for (let j = 0; j < 8; j++) { const b = j * Math.PI / 4, ox = x + Math.cos(b) * 220, oy = y + Math.sin(b) * 220; if (__light.ray(ox, oy, b + Math.PI, 230) > 218) return { x, y, ox, oy, b, total: +s.total.toFixed(3) }; } } return null; }, C);
  if (K) {
    await put([ent(970, K.x, K.y, K.b, 'watch', 'WATCHING'), ent(971, K.x + Math.cos(K.b + Math.PI / 2) * 70, K.y + Math.sin(K.b + Math.PI / 2) * 70, K.b, 'creep', 'STALKING')]);
    const ux = -Math.cos(K.b), uy = -Math.sin(K.b); await P.mouse.move(VP.width / 2 + ux * 220, VP.height / 2 + uy * 220);
    await torch(false); const f1 = await shot('dark_torch_off', { x: K.ox, y: K.oy }); const v1 = await views([970, 971]);
    await torch(true); await sleep(400); const f2 = await shot('dark_torch_on', { x: K.ox, y: K.oy }); const v2 = await views([970, 971]);
    R.places.push({ name: `the dark (light ${K.total})`, file: f1, views: v1 }, { name: 'the dark, the torch on it', file: f2, views: v2 });
  }
  // a lamp's edge: the light falling off across a few figures
  const E = await P.evaluate(c => { for (let r = 0; r < 1400; r += 32) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
    const s0 = __light.sample(x, y, false).total, s1 = __light.sample(x + 120, y, false).total; if (s0 > .55 && s1 < .2 && __light.ray(x, y, 0, 180) > 170) return { x, y, s0: +s0.toFixed(2), s1: +s1.toFixed(2) }; } return null; }, C);
  if (E) {
    await put([0, 1, 2, 3].map(k => ent(980 + k, E.x + k * 40, E.y + (k % 2) * 30, -Math.PI / 2, 'watch', 'WATCHING')));
    await torch(false); await P.mouse.move(VP.width / 2, VP.height / 2 - 200); const file = await shot('lamp_edge', { x: E.x + 60, y: E.y + 190 });
    R.places.push({ name: `a lamp's edge (light ${E.s0} to ${E.s1})`, file, views: await views([980, 981, 982, 983]) }); await torch(true);
  }
  // the edge of the view: a corner of the page's sight mask found by its own rays (a near wall in one direction, open floor a little to the
  // side); a figure waiting coiled, facing the open side, its centre 12 / 24 / 36 / 48 px behind the edge - each shot twice, with it and
  // without it (the same clip; the difference is counted afterwards: dev/trial-3-r9-overhaul R14 report), and the page's own view of it
  {
    let G = null, Q = null;
    for (const [dx, dy] of [[0, 0], [300, 0], [-300, 0], [0, 300], [0, -300], [600, 0], [-600, 0]]) {
      Q = { x: C.x + dx, y: C.y + dy }; if (!(await P.evaluate(q => __light.ray(q.x, q.y, 0, 30) > 25 && __light.ray(q.x, q.y, Math.PI, 30) > 25, Q))) continue;
      await P.evaluate(q => __api.tp(q.x, q.y), Q); await sleep(700);
      G = await P.evaluate(q => { const N = 720; let prev = __light.ray(q.x, q.y, 0, 700);
        for (let k = 1; k <= N; k++) { const a = k / N * Math.PI * 2, d = __light.ray(q.x, q.y, a, 700), a0 = (k - 1) / N * Math.PI * 2;
          if (prev < 450 && prev > 100 && d > prev + 120) {                      // a corner: the ray at a0 hits a wall, the next one passes it
            const u = { x: Math.cos(a), y: Math.sin(a) }, n = { x: Math.cos(a0) - u.x, y: Math.sin(a0) - u.y }, nn = Math.hypot(n.x, n.y); n.x /= nn; n.y /= nn;
            const pts = [12, 24, 36, 48].map(dl => ({ dl, x: q.x + u.x * (prev + 60) + n.x * dl, y: q.y + u.y * (prev + 60) + n.y * dl }));
            const ok = pts.every(t => { for (let j = 0; j < 8; j++) if (__light.ray(t.x, t.y, j * Math.PI / 4, 28) < 25) return false; return true; });
            if (ok) return { a, face: Math.atan2(-n.y, -n.x), pts, edge: Math.round(prev) }; }
          prev = d; } return null; }, Q);
      if (G) break;
    }
    if (G) {
      await P.mouse.move(VP.width / 2 + Math.cos(G.a) * 200, VP.height / 2 + Math.sin(G.a) * 200); await torch(true); await sleep(300);
      const sc = await P.evaluate(t => window.__k3.screen(t.x, t.y), G.pts[1]), clip = sc ? { x: Math.max(0, Math.round(sc.x - 90)), y: Math.max(0, Math.round(sc.y - 90)), width: 180, height: 180 } : null;
      R.edge = { edge: G.edge, clip, cases: [] };
      for (const t of G.pts) {
        const c = { dl: t.dl, files: [] };
        for (const [k, with1] of [['without', 0], ['with', 1], ['without2', 0]]) {
          await put(with1 ? [ent(995, t.x, t.y, G.face, 'wait', 'STALKING')] : []); await sleep(700);
          if (with1) c.view = (await views([995]))[0];
          const file = `edge_${tag}_${t.dl}_${k}.png`; if (SHOTS && clip) await P.screenshot({ path: path.join(SHOTS, file), clip }).catch(() => { }); c.files.push(file);
        }
        R.edge.cases.push(c);
      }
    }
  }
  // a borrowed skin: the page's own wanderer, beside the undisguised body and the page's player
  await put([ent(990, C.x + 90, C.y, Math.PI, 'watch', 'WATCHING', { dg: 'beanie|stripes|#d2a37c|#6b8f5e' }), ent(991, C.x + 90, C.y + 110, Math.PI, 'watch', 'WATCHING')]);
  await P.mouse.move(VP.width / 2 + 300, VP.height / 2); const file = await shot('skin', { x: C.x, y: C.y + 40 });
  R.places.push({ name: 'in a borrowed skin (top) and not (below)', file, views: await views([990, 991]) });
  await P.evaluate(() => { window.__k3.fake = []; });
}
/* (R14) the body's cost on this page: four figures moving and posing for 6 s - the time skinstealer.js's own draw() takes a frame (the page's
 * clock), and the page's frames a second (SwiftShader: a CPU renderer, so the absolute numbers are the slow case) */
async function drawCost(O, R, KACT, SCODE, C) {
  const P = O.P, F = [['chase', 255], ['creep', 62], ['watch', 0], ['wait', 0]].map(([act, v], k) => ({ i: 940 + k, x: C.x + 60 + k * 70, y: C.y - 80, a: Math.PI / 2, s: SCODE[act === 'chase' ? 'HUNTING' : 'STALKING'] | 0, ac: KACT[act] | 0, v, h: 0, x0: C.x + 60 + k * 70, y0: C.y - 80 }));
  await P.evaluate(q => __api.tp(q.x, q.y), { x: C.x, y: C.y }); await sleep(600);
  await P.evaluate(`(${FAKE})(${JSON.stringify(F)})`);
  R.drawCost = {};
  for (const n of [0, 4]) {
    R.drawCost[n] = await P.evaluate(async n => { const K = window.__k3, S = window.__skin, all = K.fake.slice(); K.fake = all.slice(0, n);
      const d0 = S.draw; let t = 0, calls = 0; S.draw = dt => { const a = performance.now(); d0(dt); t += performance.now() - a; calls++; };
      let frames = 0; const t0 = performance.now(), T1 = t0 + 6000; await new Promise(r => { const f = () => { frames++; const now = performance.now();
        for (const o of K.fake) if (o.v) { const s = ((now - t0) / 1000) % 1.5; o.y = o.y0 + o.v * s * .5; } if (now < T1) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
      S.draw = d0; K.fake = all; return { figures: n, drawMs: +(t / Math.max(1, calls)).toFixed(3), fps: +(frames / 6).toFixed(1) }; }, n);
  }
  await P.evaluate(() => { window.__k3.fake = []; });
}
/* sight (R10): the Skin-Stealer's heartbeat and sting on two real pages - V01-V05, V07, V09-V12 - observed on each page's AudioContext (the
 * 70 Hz thumps it makes, the stings it plays and the master gain then), its #dread vignette and the Skin-Stealer script's own sightLog.
 * The world is frozen: placed creatures stand still; each page keeps its own view. */
async function sightScene(b, port, R, qa) {
  const room = 'r9si' + (Date.now() % 1e6), VP = { width: 1024, height: 640 };
  // (each page in its own browser: each is its browser's front page, so neither is ever throttled as a background tab)
  const b2 = await pw.chromium.launch({ args: LAUNCH }); R.closers = [() => b2.close()];
  const A = await runPage(b, port, room, VP, 'K3SeeA', VIDEO), B = await runPage(b2, port, room, VP, 'K3SeeB');
  A.cmd({ c: 'freeze', on: true }); A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
  A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 });
  for (const pg of [A, B]) { await pg.P.keyboard.press('KeyW'); await until(pg.P, () => window.__k3.hookSfx(), null, 5000);
    await pg.P.evaluate(() => { const K = window.__k3, X = window.__sfx; const f = X.play; X.play = function (n, o) { if (n === 'sting') { const z = __api.audio && __api.audio(); K.audio.push([+(performance.now() / 1000).toFixed(3), 'stinggain', z && z.gain ? +z.gain.gain.value.toFixed(3) : -1]); } return f.call(this, n, o); }; }); }
  const at = { x: 5000, y: 3504 }; R.cases = [];
  const place = async (pg, q) => { await pg.P.evaluate(s => __api.tp(s.x, s.y), q); await sleep(250); };
  const torch = async (pg, on) => { if ((await pg.P.evaluate(() => __api.lightOn())) !== on) await pg.P.keyboard.press('KeyF'); };
  const clear = async () => { A.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(800); };
  // one case: what each page plays over secs (thumps at 70 Hz, stings, the master gain at each sting, the vignette's top), its sightLog
  // events, and each page's own view of every given point
  const mark = () => Promise.all([A, B].map(pg => pg.P.evaluate(() => performance.now() / 1000)));
  const listen = async (name, secs, pts, extra, from) => {
    const t0 = from || await mark();
    const vg = [[], []], tEnd = Date.now() + secs * 1000;
    while (Date.now() < tEnd) { for (const [i, pg] of [A, B].entries()) vg[i].push(await pg.P.evaluate(() => +(document.getElementById('dread').style.opacity || 0))); await sleep(200); }
    const C = { name, secs, pages: [] };
    for (const [i, pg] of [A, B].entries()) {
      const au = await pg.P.evaluate(t => window.__k3.audio.filter(a => a[0] >= t), t0[i]);
      const lg = await pg.P.evaluate(t => (window.__skin.sightLog || []).slice(), 0);
      const views = await pg.P.evaluate(ps => ps.map(q => window.__k3.view(q.x, q.y)), pts || []);
      C.pages.push({ page: i ? 'B' : 'A', thumps: au.filter(a => a[1] === 'thump' && a[2] === 70).length, stings: au.filter(a => a[1] === 'sting').length, stingGain: au.filter(a => a[1] === 'stinggain').map(a => a[2]),
        bursts: au.filter(a => a[1] === 'buffer').length, vignette: +Math.max(0, ...vg[i]).toFixed(3), log: lg.slice(-8), views });
    }
    Object.assign(C, extra || {}); R.cases.push(C); return C;
  };
  // A in the lit hall facing east; B somewhere 250-600 px from the creature's spot with a wall between (the page's own ray)
  await place(A, at); await torch(A, true); await A.P.mouse.move(VP.width / 2 + 200, VP.height / 2);
  const K = { x: at.x + 260, y: at.y };
  const bSpot = await A.P.evaluate(k => { const X = __api; for (const r of [300, 360, 420, 480, 540, 600, 250]) for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
    if (!X.sl(x, y, 26)) continue; let hid = true; for (const s of [-18, 0, 18]) { const qx = k.x - Math.sin(a) * s, qy = k.y + Math.cos(a) * s, d = Math.hypot(qx - x, qy - y); if (X.Uc(x, y, Math.atan2(qy - y, qx - x), d + 1) >= d - 30) hid = false; }
    if (hid) return { x: Math.round(x), y: Math.round(y) }; } return null; }, K);
  R.bSpot = bSpot; if (bSpot) { await place(B, bSpot); await torch(B, true); }
  await clear(); await listen('V12 none', 5, [K]);
  // V02 / V07: one undisguised, lit, 260 px east of A: A hears it, B (a wall between) does not
  let m0 = await mark(), k = await qa({ op: 'spawn', kind: 'skinstealer', x: K.x, y: K.y, hunger: .05, ang: Math.PI });
  await listen('V02 V07 in A\'s sight, not in B\'s', 6, [K], { placed: k }, m0);
  // V01: the same creature moved behind a wall right beside A (the page's own search: no ray reaches it)
  await clear();
  const W1 = await A.P.evaluate(h => { const X = __api; for (const r of [110, 140, 170, 200, 230, 260, 290, 320]) for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
    if (X.sl(x, y, 26) && window.__k3.view(x, y).mask === 0) return { x: Math.round(x), y: Math.round(y), d: r }; } return null; }, at);
  if (W1) { m0 = await mark(); k = await qa({ op: 'spawn', kind: 'skinstealer', x: W1.x, y: W1.y, hunger: .05 }); await listen('V01 behind a wall beside A', 5, [W1], { placed: k, at: W1 }, m0); }
  // V03 / V04: a dark spot in A's sight (no lamp there; A in the dark south-west): torch off - nothing; torch on and aimed - the cue;
  // torch off - it fades
  await clear(); const dark = { x: 1300, y: 5600 }; await place(A, dark);
  const DK = await A.P.evaluate(h => { const X = __api; for (const r of [260, 300, 340, 220, 200, 380]) for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
    if (!X.sl(x, y, 26) || window.__k3.view(x, y).mask < 3) continue; if (X.Ul(x, y, X.H, false) < .1 && X.Ul(x, y, Object.assign({}, X.H, { angle: Math.atan2(y - X.H.y, x - X.H.x) }), true) >= .3) return { x: Math.round(x), y: Math.round(y) }; } return null; }, dark);
  R.darkSpot = DK;
  if (DK) {
    await torch(A, false); m0 = await mark(); k = await qa({ op: 'spawn', kind: 'skinstealer', x: DK.x, y: DK.y, hunger: .05 });
    await listen('V03 in sight, in the dark, torch off', 4, [DK], { placed: k }, m0);
    const s = await A.P.evaluate(q => window.__k3.screen(q.x, q.y), DK); await A.P.mouse.move(s.x, s.y); m0 = await mark(); await torch(A, true);
    await listen('V04 the torch on it', 4, [DK], {}, m0);
    m0 = await mark(); await torch(A, false); await listen('V04 the torch off again', 3, [DK], {}, m0);
  }
  await torch(A, true); await place(A, at); await A.P.mouse.move(VP.width / 2 + 200, VP.height / 2);
  // V05: lit, in the sight mask, but off A's screen (a narrow window: 640x360 shows 355 px either side at the game's zoom)
  await clear(); await A.P.setViewportSize({ width: 640, height: 360 }); await sleep(600);
  const OF = { x: at.x + 460, y: at.y }; m0 = await mark(); k = await qa({ op: 'spawn', kind: 'skinstealer', x: OF.x, y: OF.y, hunger: .05 });
  await listen('V05 off screen (in the mask, lit)', 4, [OF], { placed: k }, m0);
  m0 = await mark(); await A.P.setViewportSize(VP); await listen('V05 the window widened: on screen', 4, [OF], {}, m0);
  // V09: in a borrowed skin, lit and in sight - nothing; the skin taken off - the cue
  await clear(); m0 = await mark(); k = await qa({ op: 'spawn', kind: 'skinstealer', x: K.x, y: K.y, hunger: .05, ang: Math.PI }); const dz = await qa({ op: 'disguise', id: k.id });
  await listen('V09 disguised in sight', 5, [K], { placed: k, disguise: dz, mirror: await A.P.evaluate(() => (window.__k3.ss || []).map(t => t.dg || '')) }, m0);
  m0 = await mark(); const uz = await qa({ op: 'undress', id: k.id }); await listen('V09 the skin dropped', 4, [K], { undress: uz }, m0);
  // V10: SOUND OFF (the page's own button): nothing is heard (after the stings' gap, so that a sting is due)
  await clear(); await sleep(8500); await A.P.evaluate(() => { const b = document.getElementById('sound'); if (b && /ON/.test(b.textContent)) b.click(); });
  R.soundText = await A.P.evaluate(() => (document.getElementById('sound') || {}).textContent || '');
  m0 = await mark(); k = await qa({ op: 'spawn', kind: 'skinstealer', x: K.x, y: K.y, hunger: .05, ang: Math.PI });
  await listen('V10 sound off, in sight', 5, [K], { placed: k, sound: R.soundText }, m0);
  await A.P.evaluate(() => { const b = document.getElementById('sound'); if (b && /OFF/.test(b.textContent)) b.click(); });
  // V11: three in sight
  await clear(); await sleep(8500); m0 = await mark(); for (const dx of [220, 290, 360]) await qa({ op: 'spawn', kind: 'skinstealer', x: at.x + dx, y: at.y + (dx === 290 ? 40 : 0), hunger: .05, ang: Math.PI });
  await listen('V11 three in sight', 6, [{ x: at.x + 220, y: at.y }], {}, m0);
  // V12: the Hound alone (its proximity dread, as R8's)
  await clear(); m0 = await mark(); k = await qa({ op: 'spawn', kind: 'hound', x: K.x, y: K.y });
  await listen('V12 the Hound 260 px east', 6, [K], { placed: k }, m0);
  await clear();
  R.errors = { A: A.errs, B: B.errs }; await A.ctx.close(); await B.ctx.close();
  if (VIDEO) { const v = A.P.video && A.P.video(); if (v) R.videoFile = path.basename(await v.path()); }
  // the verdicts (R10): each from what the pages played
  const c = n => R.cases.find(x => x.name.startsWith(n)), pg = (n, i) => (c(n) || { pages: [{}, {}] }).pages[i] || {};
  const V = R.checks = [];
  const chk = (id, ok, why) => V.push({ id, ok: !!ok, why });
  chk('V12 no Skin-Stealer: silent', pg('V12 none', 0).thumps === 0 && pg('V12 none', 0).stings === 0 && pg('V12 none', 1).thumps === 0, `A ${pg('V12 none', 0).thumps}/${pg('V12 none', 0).stings}, B ${pg('V12 none', 1).thumps}/${pg('V12 none', 1).stings}`);
  chk('V02 in sight: heartbeat and one sting', pg('V02', 0).thumps >= 5 && pg('V02', 0).stings === 1, `A thumps ${pg('V02', 0).thumps}, stings ${pg('V02', 0).stings}`);
  chk('V07 the other page (a wall between): nothing', pg('V02', 1).thumps === 0 && pg('V02', 1).stings === 0, `B thumps ${pg('V02', 1).thumps}, stings ${pg('V02', 1).stings}`);
  chk('V01 behind a wall beside the page: nothing', c('V01') && pg('V01', 0).thumps === 0 && pg('V01', 0).stings === 0, c('V01') ? `A thumps ${pg('V01', 0).thumps}, stings ${pg('V01', 0).stings} (B, which sees it: ${pg('V01', 1).thumps}/${pg('V01', 1).stings})` : 'no such spot found');
  chk('V03 in sight in the dark: nothing', c('V03') && pg('V03', 0).thumps === 0 && pg('V03', 0).stings === 0, c('V03') ? `A ${pg('V03', 0).thumps}/${pg('V03', 0).stings}` : 'no dark spot found');
  chk('V04 the torch reveals it, and its loss releases it', c('V04 the torch on') && pg('V04 the torch on', 0).thumps >= 3 && pg('V04 the torch off', 0).thumps <= 2, c('V04 the torch on') ? `on: ${pg('V04 the torch on', 0).thumps} thumps, ${pg('V04 the torch on', 0).stings} sting; off: ${pg('V04 the torch off', 0).thumps} thumps in 3 s` : 'no dark spot found');
  chk('V05 off screen: nothing; on screen: the cue', pg('V05 off', 0).thumps === 0 && pg('V05 off', 0).stings === 0 && pg('V05 the window', 0).thumps >= 3, `off: ${pg('V05 off', 0).thumps}/${pg('V05 off', 0).stings}; widened: ${pg('V05 the window', 0).thumps} thumps`);
  chk('V09 disguised: nothing; the skin dropped: the cue and a sting', pg('V09 disguised', 0).thumps === 0 && pg('V09 disguised', 0).stings === 0 && pg('V09 the skin', 0).thumps >= 3 && pg('V09 the skin', 0).stings === 1, `disguised ${pg('V09 disguised', 0).thumps}/${pg('V09 disguised', 0).stings}; dropped ${pg('V09 the skin', 0).thumps}/${pg('V09 the skin', 0).stings}`);
  chk('V10 SOUND OFF: no thump, any sting at master gain 0', pg('V10', 0).thumps === 0 && (pg('V10', 0).stingGain || []).every(g => g === 0), `thumps ${pg('V10', 0).thumps}, sting gains ${JSON.stringify(pg('V10', 0).stingGain)} (button: ${R.soundText})`);
  chk('V11 three in sight: one heartbeat, at most one sting', pg('V11', 0).thumps >= 4 && pg('V11', 0).thumps <= 14 && pg('V11', 0).stings <= 1, `thumps ${pg('V11', 0).thumps} in 6 s, stings ${pg('V11', 0).stings}`);
  chk('V12 the Hound\'s dread as before', pg('V12 the Hound', 0).thumps >= 3 && pg('V12 the Hound', 0).vignette > .3, `thumps ${pg('V12 the Hound', 0).thumps}, vignette ${pg('V12 the Hound', 0).vignette}`);
  chk('no page error', !A.errs.length && !B.errs.length, JSON.stringify(R.errors));
}
/* probe (development): one page, placed at --at x,y, evaluates --expr (a function of window) and prints it */
async function probe(b, port, R) {
  const P = await runPage(b, port, 'r9pr' + (Date.now() % 1e6), { width: 1024, height: 640 }, 'K3Probe');
  P.cmd({ c: 'freeze', on: true }); const at = (ARG.at || '5000,3504').split(',').map(Number);
  await P.P.evaluate(q => __api.tp(q[0], q[1]), at); await sleep(1500);
  R.value = await P.P.evaluate(ARG.expr || '(() => null)()').catch(e => 'ERR ' + e.message); R.errors = P.errs; console.log(JSON.stringify(R.value).slice(0, 4000));
}
(async () => {
  const { p: srv, port, qa } = await serve();
  const b = await pw.chromium.launch({ args: LAUNCH });
  const R = { tool: 'dev/trial-3-r9-overhaul/tools/r9_browser.js', scene: ARG.scene, chromium: b.version(), tree: path.basename(DIR) };
  try { if (ARG.scene === 'flankwatch') await flankwatch(b, port, R, qa); else if (ARG.scene === 'audio') await audio(b, port, R, qa); else if (ARG.scene === 'gallery') await gallery(b, port, R, qa); else if (ARG.scene === 'sight') await sightScene(b, port, R, qa); else if (ARG.scene === 'probe') await probe(b, port, R); else throw new Error('unknown scene ' + ARG.scene); }
  catch (e) { R.error = e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ').replace(/\/[^\s|:]*\//g, '') : String(e); }
  finally { for (const f of R.closers || []) await f().catch(() => { }); delete R.closers; await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  if (R.tries) for (const T of R.tries) console.log(`try ${T.tr}: ${T.skipped || `hunger ${T.hunger}, plans ${T.plans.join('>')}${T.killed ? ', killed' : ''}, ${T.samples} samples, ${T.fps} fps`}` +
    (T.transits || []).map(t => `\n   ${t.k} ${t.t0}-${t.t1}s: on the page's view ${t.visible}/${t.samples} samples (${Math.round(t.share * 100)} %), moved ${t.moved} px, ${t.visMoved} px of it in view | ${t.why}`).join(''));
  if (R.checks) { for (const k of R.checks) console.log((k.ok ? 'PASS ' : 'FAIL ') + k.id + '  ' + k.why); console.log(`SIGHT: ${R.checks.every(k => k.ok) ? 'PASS' : 'FAIL'} - ${R.checks.filter(k => k.ok).length} of ${R.checks.length}`); }
  if (R.scene === 'sight' && R.cases) for (const C of R.cases) console.log(`${C.name}: ` + C.pages.map(P => `${P.page} thumps ${P.thumps} stings ${P.stings}${P.stingGain.length ? ' (master gain ' + P.stingGain.join('/') + ')' : ''} vignette ${P.vignette} views ${JSON.stringify(P.views.map(v => [v.on, v.mask, v.leg, v.vis]))}`).join(' | '));
  if (R.scene === 'audio' && R.cases) for (const C of R.cases) console.log(`${C.name}: thumps ${C.thumps}, stings ${C.stings}, bursts ${C.bursts}, dread vignette max ${C.dreadMax}${C.view ? ', the page sees it ' + JSON.stringify(C.view) : ''}${C.sightLog ? ', sight log ' + JSON.stringify(C.sightLog).slice(0, 300) : ''}`);
  if (R.scene === 'gallery') { for (const G of R.gallery || []) console.log(`gallery ${G.label}: ${G.file} size ${JSON.stringify(G.size0)}`); for (const Q of R.places || []) console.log(`place ${Q.name}: ${Q.file} views ${JSON.stringify(Q.views)}`); if (R.edge) console.log(`edge ${JSON.stringify(R.edge)}`); if (R.drawCost) console.log(`draw cost ${JSON.stringify(R.drawCost)}`); for (const D of R.deaths || []) console.log(`death ${D.v}: ${JSON.stringify(D.res)} ${D.shots.length} shots`); }
  if (R.error) console.log('ERROR ' + R.error);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
