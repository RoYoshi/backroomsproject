#!/usr/bin/env node
/* dev/tools/gate/checks/browser_contracts.js - three contracts of the game seen from a real Chromium, on two complete game folders (the
 * accepted B++ and the candidate), each served by its own `node server.js PORT` (development only; added at Stage 3H continuation C5;
 * the gate's workflow step runs it beside dev/tools/checks/dev_workflow.js).
 *
 *   node dev/tools/gate/checks/browser_contracts.js --old-dir DIR --new-dir DIR [--out FILE.json]
 *
 * Chromium is headless and draws with its software renderer (SwiftShader): no physical GPU, no real phone.  Both servers get the same
 * synthetic admin passcode (ADMIN_PASSCODE); nothing here uses or prints any other.  On each side, the same steps, through the page's
 * own buttons and keys:
 *   1. the facade: window.__api at the menu and in a run - every member's name in order, its type, a function's arity and an object's
 *      own keys.  Both sides must give the same; and the names must be the 52 of src/core/client/bundle/api_contract.json;
 *   2. unauthorized access, refused: a page that never logged in sends an admin command over its own WebSocket (freeze the room) and
 *      gets no answer; a wrong passcode in the admin panel (opened with the backquote at the menu, typed and sent with Enter, as a
 *      keyboard player does) gets WRONG PASSCODE; the right one unlocks it, and the admin's own view of
 *      the room shows the visitor's command changed nothing (not frozen), while the admin's own freeze works and is undone (the positive
 *      control); a third page's five wrong passcodes are answered, then the lockout (TOO MANY TRIES), which refuses even the right
 *      passcode.  Both sides must give the same answers (the seconds left are compared as a number of digits, not a value);
 *   3. a phone: 390 x 844 with touch (Chromium's touch input): the boot gate passed by a tap, the menu, a run started by taps, the touch
 *      stick shown, a thumb drag on it walks the player (the game's own direction keys held while the thumb is down), and the web app
 *      manifest the page links answers with the same bytes on both sides.
 * Each server is stopped by its PID.  Exit 0 only when every check holds on both sides and the sides agree. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG['old-dir'] || !ARG['new-dir']) { console.error('--old-dir DIR and --new-dir DIR are required (two complete game folders)'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PASS = 'c5-synthetic-admin', WRONG = 'c5-wrong-passcode';
const CONTRACT = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'core', 'client', 'bundle', 'api_contract.json'), 'utf8')).members.map(m => m.name);
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { const b = []; q.on('data', d => b.push(d)); q.on('end', () => r({ status: q.statusCode, headers: q.headers, body: Buffer.concat(b) })); }).on('error', e => r({ status: 0, error: String(e) })));
async function serve(dir, port) {
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { if ((await get(port, '/index.html')).status === 200) return p; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('the server in ' + dir + ' did not start');
}
const stop = async p => { if (!p) return; try { process.kill(p.pid); } catch (e) { } for (let i = 0; i < 50 && p.exitCode === null && p.signalCode === null; i++) await sleep(50); };
/* a tap on the page's WebSocket: what it receives (types; the latest admin snapshot) - the page's own socket, nothing replaced */
const TAP = `(() => { const S = window.WebSocket; window.__c5 = { types: [], admin: null, ares: [], logins: [], ads: 0 };
  window.WebSocket = function (u, p) { const ws = new S(u, p); if (!/\\/ws(\\?|$)/.test(String(u))) return ws;   // (post-3H Trial 2: only the game's socket, not the lounge's /social)
    window.__c5.ws = ws;
    ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); window.__c5.types.push(m.t);
      if (m.ad) { window.__c5.admin = m.ad; window.__c5.ads++; }                  // the admin's view of the room rides in the snapshots
      if (m.t === 'admin') window.__c5.logins.push({ ok: !!m.ok, waiting: !!m.wait });   // the login's answer (waiting: it says to wait)
      if (m.t === 'ares') window.__c5.ares.push(!!m.ok); } catch (x) { } });
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }); })();`;
const ev = (cdp, expr) => cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: false }).then(r => r.exceptionDetails ? null : r.result && r.result.value).catch(() => null);
async function open(b, port, room, { mobile = false } = {}) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const P = await ctx.newPage(), errs = [], cdp = await ctx.newCDPSession(P);
  await P.addInitScript(TAP);
  P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  /* the boot gate: read without a user gesture until the page is ready, then a real key press or tap, as a player would */
  let st = null; for (let i = 0; i < 600; i++) { st = await ev(cdp, 'window.__boot ? __boot.state() : (window.__api && window.__api.H ? "menu" : null)'); if (st === 'ready' || st === 'menu' || st === 'error') break; await sleep(100); }
  if (st === 'ready') { if (mobile) await P.touchscreen.tap(195, 520); else await P.keyboard.press('Space'); }
  for (let i = 0; i < 300; i++) { st = await ev(cdp, 'window.__boot ? __boot.state() : "menu"'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => !!(window.__api && window.__api.H), null, { timeout: 60000 });
  for (let i = 0; i < 100; i++) { if (await P.evaluate(() => !!(window.__c5.ws && window.__c5.ws.readyState === 1))) break; await sleep(100); }
  await sleep(500);
  return { ctx, P, cdp, errs, boot: st };
}
async function startRun(s, name, tap) {                                         // the build's own entry: Stage 3C's PLAY panel, then #name and #enter
  const { P } = s;
  if (await P.evaluate(() => !!(window.__ui && window.__ui.version))) { await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible', timeout: 30000 }); }
  await P.fill('#name', name);
  if (tap) await P.tap('#enter'); else await P.click('#enter');
  for (let i = 0; i < 150; i++) { if (await P.evaluate(() => !!(window.__api && __api.started() && !document.getElementById('hud').hidden))) return true; await sleep(100); }
  return false;
}
const facade = P => P.evaluate(() => { const A = window.__api; return Object.keys(A).map(k => { const v = A[k], t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  return [k, t, t === 'function' ? v.length : (t === 'object' ? (v instanceof Set ? 'Set' : v instanceof Map ? 'Map' : Object.keys(v).sort().join(' ')) : null)]; }); });
async function panel(s, pass) {                                                  // the admin panel: open it (the backquote), type, UNLOCK; the answer it shows
  const { P } = s;
  const shown = await P.evaluate(() => { const p = document.getElementById('adminPanel'); return !!p && getComputedStyle(p).display !== 'none' && !p.hidden; });
  if (!shown) await P.keyboard.press('Backquote');
  await P.waitForSelector('#admPass', { state: 'visible', timeout: 10000 });
  const n0 = await P.evaluate(() => window.__c5.logins.length);
  await P.fill('#admPass', pass); await P.press('#admPass', 'Enter');          // Enter in the passcode field is UNLOCK (a keyboard player's way; the menu lies over the panel's button)
  for (let i = 0; i < 100 && (await P.evaluate(() => window.__c5.logins.length)) === n0; i++) await sleep(50);   // the server's answer to this try
  await sleep(150);
  return P.evaluate(n => ({ answer: window.__c5.logins[n] || null, err: (document.getElementById('admErr') || {}).textContent || '' }), n0);
}
const norm = t => String(t || '').replace(/\d+/g, n => '#'.repeat(n.length));
async function side(label, dir, b) {
  const port = await freePort(), room = 'c5' + port, out = { label, dir, checks: {}, obs: {} };
  const t0 = Date.now(), log = (...a) => { if (ARG.verbose) console.error(`  [${label} ${((Date.now() - t0) / 1000).toFixed(1)} s]`, ...a); };
  const srv = await serve(dir, port); out.port = port;
  try {
    /* 1. the facade */
    log('the facade'); const a = await open(b, port, room); out.obs.boot = a.boot;
    const menu = await facade(a.P); const started = await startRun(a, 'C5 VISITOR'); await sleep(600);
    const run = await facade(a.P);
    out.obs.facade = { menu, run, started };
    out.checks.facade = started && JSON.stringify(menu.map(x => x[0])) === JSON.stringify(CONTRACT) && JSON.stringify(run.map(x => x[0])) === JSON.stringify(CONTRACT);
    /* 2. unauthorized access */
    log('a visitor\'s admin command'); await a.P.evaluate(() => { window.__c5.types.length = 0; window.__c5.ws.send(JSON.stringify({ t: 'a', c: 'freeze', on: 1 })); });
    await sleep(1500);
    const visitor = await a.P.evaluate(() => ({ answers: window.__c5.types.filter(t => t === 'ares' || t === 'admin').length, adminViews: window.__c5.ads }));
    const errs = a.errs.slice(); await a.ctx.close();                            // one game page at a time (the software renderer shares two CPUs)
    log('the admin page'); const bP = await open(b, port, room);                 // (at the menu: no monster can reach it)          // (in a run: at the menu the menu lies over the panel)
    const wrong = await panel(bP, WRONG), right = await panel(bP, PASS);
    for (let i = 0; i < 60 && !(await bP.P.evaluate(() => !!window.__c5.admin)); i++) await sleep(100);
    right.admin = await bP.P.evaluate(() => !!window.__c5.admin);
    const fzAfterVisitor = await bP.P.evaluate(() => window.__c5.admin ? window.__c5.admin.fz : null);
    await bP.P.evaluate(() => { window.__c5.admin = null; window.__c5.ws.send(JSON.stringify({ t: 'a', c: 'freeze', on: 1 })); });
    let fzOn = null; for (let i = 0; i < 60; i++) { fzOn = await bP.P.evaluate(() => window.__c5.admin ? window.__c5.admin.fz : null); if (fzOn) break; await sleep(100); }
    await bP.P.evaluate(() => { window.__c5.admin = null; window.__c5.ws.send(JSON.stringify({ t: 'a', c: 'freeze', on: 0 })); });
    let fzOff = null; for (let i = 0; i < 60; i++) { fzOff = await bP.P.evaluate(() => window.__c5.admin ? window.__c5.admin.fz : null); if (fzOff === 0) break; await sleep(100); }
    const status = await bP.P.evaluate(() => (document.getElementById('net') || {}).textContent || '');
    errs.push(...bP.errs); await bP.ctx.close();
    log('the lockout page'); const cP = await open(b, port, room), tries = [];
    for (let i = 0; i < 5; i++) tries.push(await panel(cP, WRONG));
    const locked = await panel(cP, PASS); await sleep(1500); locked.admin = await cP.P.evaluate(() => !!window.__c5.admin);
    errs.push(...cP.errs); await cP.ctx.close();
    out.obs.unauthorized = { visitor, wrong: { answer: wrong.answer, err: wrong.err }, right: { answer: right.answer, admin: right.admin }, fzAfterVisitor, fzOn, fzOff, status: status.replace(/ROOM \S+/, 'ROOM #').replace(/\d+ WANDERER/, '# WANDERER'),
      tries: tries.map(t => ({ answer: t.answer, err: norm(t.err) })), locked: { answer: locked.answer, err: norm(locked.err), admin: locked.admin } };
    out.checks.unauthorized = visitor.answers === 0 && visitor.adminViews === 0 && wrong.answer && !wrong.answer.ok && wrong.err === 'WRONG PASSCODE' && right.answer && right.answer.ok && right.admin === true
      && fzAfterVisitor === 0 && fzOn === 1 && fzOff === 0 && /ADMIN/.test(status)
      && tries.every(t => t.answer && !t.answer.ok) && tries.some(t => /TOO MANY TRIES/.test(t.err)) && locked.answer && !locked.answer.ok && /TOO MANY TRIES/.test(locked.err) && !locked.admin;
    out.obs.errors = errs;
    /* 3. a phone */
    log('the phone'); const m = await open(b, port, room + 'm', { mobile: true }); out.obs.phoneBoot = m.boot; log('booted:', m.boot);
    const mStarted = await startRun(m, 'C5 THUMB', true); await sleep(800); log('in a run:', mStarted);
    const zone = await m.P.evaluate(() => { const z = document.getElementById('stickZone'); if (!z) return null; const r = z.getBoundingClientRect(), cs = getComputedStyle(z); return { l: r.left, t: r.top, r: r.right, b: r.bottom, display: cs.display, visibility: cs.visibility }; });
    const walks = [];
    if (zone && zone.display !== 'none') {
      const O = [Math.round(zone.l + Math.min(100, (zone.r - zone.l) / 2)), Math.round(zone.b - Math.min(160, (zone.b - zone.t) / 2))];
      const T = (type, pts) => m.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2] })) });
      for (const [dx, dy, key] of [[44, 0, 'KeyD'], [-44, 0, 'KeyA'], [0, 44, 'KeyS'], [0, -44, 'KeyW']]) {
        const p0 = await m.P.evaluate(() => [__api.H.x, __api.H.y]);
        await T('touchStart', [[O[0], O[1], 1]]); await sleep(80); await T('touchMove', [[O[0] + dx, O[1] + dy, 1]]); await sleep(150);
        const held = await m.P.evaluate(() => [...__api.keys].sort().join(','));
        await sleep(1100); await T('touchEnd', []); await sleep(200);
        const p1 = await m.P.evaluate(() => [__api.H.x, __api.H.y]), after = await m.P.evaluate(() => [...__api.keys].join(','));
        walks.push({ key, held, moved: Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])), after });
        if (walks[walks.length - 1].moved > 30) break;                       // one open direction is enough (the spawn spot is random; a wall may be close)
      }
    }
    const link = await m.P.evaluate(() => { const l = document.querySelector('link[rel="manifest"]'); return l ? l.getAttribute('href') : null; });
    const mf = link ? await get(port, '/' + link.replace(/^\.?\//, '')) : { status: 0 };
    let manifest = null; try { manifest = JSON.parse(mf.body.toString('utf8')); } catch (e) { }
    out.obs.phone = { started: mStarted, zone, walks, manifest: { href: link, status: mf.status, bytes: mf.body ? mf.body.length : 0, sha256: mf.body ? require('crypto').createHash('sha256').update(mf.body).digest('hex') : null, name: manifest && manifest.name, display: manifest && manifest.display, icons: manifest && manifest.icons ? manifest.icons.length : 0 } };
    out.checks.phone = mStarted && !!zone && zone.display !== 'none' && walks.some(w => w.moved > 30 && w.held === w.key && w.after === '') && mf.status === 200 && !!manifest && !!manifest.name;
    out.obs.errors = (out.obs.errors || []).concat(m.errs); await m.ctx.close();
    out.checks.noPageErrors = !out.obs.errors.length;
  } finally { await stop(srv); }
  return out;
}
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/tools/gate/checks/browser_contracts.js', chromium: b.version(), renderer: 'headless Chromium, SwiftShader (software); no physical GPU, no real phone', contractMembers: CONTRACT.length, sides: [] };
  try {
    for (const [label, dir] of [['old', path.resolve(ARG['old-dir'])], ['new', path.resolve(ARG['new-dir'])]].filter(([l]) => !ARG.sides || ARG.sides.split(',').includes(l))) {
      try { R.sides.push(await side(label, dir, b)); } catch (e) { R.sides.push({ label, dir, error: String(e && e.stack || e).slice(0, 500), checks: {} }); }
    }
  } finally { await b.close().catch(() => { }); }
  const [o, n] = R.sides;
  const same = (f) => { try { return JSON.stringify(f(o.obs)) === JSON.stringify(f(n.obs)); } catch (e) { return false; } };
  R.agree = {
    facade: same(x => [x.facade.menu, x.facade.run]),
    unauthorized: same(x => x.unauthorized),
    phone: same(x => [!!x.phone.started, x.phone.manifest.status, x.phone.manifest.sha256, x.phone.walks.some(w => w.moved > 30)]),
  };
  R.ok = R.sides.every(s => !s.error && Object.values(s.checks).length === 4 && Object.values(s.checks).every(Boolean)) && Object.values(R.agree).every(Boolean);
  for (const s of R.sides) console.log(`${s.label} (${path.basename(s.dir)}): ${s.error ? 'ERROR ' + s.error.split('\n')[0] : Object.entries(s.checks).map(([k, v]) => `${k} ${v ? 'ok' : 'FAIL'}`).join(', ')}`);
  console.log(`the two sides agree: ${Object.entries(R.agree).map(([k, v]) => `${k} ${v ? 'yes' : 'NO'}`).join(', ')}`);
  if (n && n.obs && n.obs.unauthorized) { const u = n.obs.unauthorized; console.log(`  answers: a wrong passcode "${u.wrong.err}"; a third page's five wrong: ${u.tries.map(t => '"' + t.err + '"').join(', ')}; then the right one: "${u.locked.err}" (admin: ${u.locked.admin}); a visitor's admin command: ${u.visitor.answers} answers, the room not frozen (fz ${u.fzAfterVisitor}); the admin's own: fz ${u.fzOn} then ${u.fzOff}`); }
  if (n && n.obs && n.obs.phone) console.log(`  phone: stick ${n.obs.phone.zone ? 'shown' : 'missing'}; walks ${JSON.stringify(n.obs.phone.walks)}; manifest ${n.obs.phone.manifest.status} ${n.obs.phone.manifest.bytes} bytes, ${n.obs.phone.manifest.icons} icons, display ${n.obs.phone.manifest.display}`);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`BROWSER CONTRACTS: ${R.ok ? 'PASS' : 'FAIL'} (the facade of ${CONTRACT.length} members, unauthorized access refused, a phone; ${R.renderer})`);
  process.exitCode = R.ok ? 0 : 1;
})();
