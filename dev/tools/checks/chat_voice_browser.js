#!/usr/bin/env node
/* dev/tools/checks/chat_voice_browser.js - the post-Trial 4 chat polish in real pages (development only; docs/architecture/CHAT.md):
 * the chat icon, the Nearby chat key binding, the typed-out speech bubbles and the wanderers' voices.
 *
 *   node dev/tools/checks/chat_voice_browser.js [--out FILE.json] [--shots DIR] [--only icon,keys,type,voice] [--mutants 1] [--work DIR]
 *                                               [--tree DIR] [--quiet]
 *
 * One server (`node server.js PORT` in --tree, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader),
 * pages through the boot gate as a player passes it (a key, or a tap).  Every text is synthetic.  Each player of a run is given the admin
 * tools at once (the world frozen, nobody killable), as chat_browser.js does.
 *   icon_*    the chat icon: absent on the menu; in a run shown low on the right at 1280x720, 1920x1080, a 390x844 phone and an 844x390
 *             phone on its side, inside the screen, a usable size, clear of the HUD, the pause button, the touch buttons, the
 *             coordinates (when on) and the passing hints; its name says its key; a click (a tap on a phone) opens the composer with
 *             every held key let go, and the icon hides until it closes; hidden while paused and in Customize.
 * (Later sections are added with their checkpoints.)
 * --mutants 1: copies of the tree's public/ with one fault each; each must fail the cases named for it.
 * Exit 0 only if every case passes (and every mutant is caught).  Servers are stopped by their PIDs. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) ARG[a.slice(2)] = '1'; else { ARG[a.slice(2)] = n; i++; } } }
const REPO = path.resolve(__dirname, '../../..'), TREE = path.resolve(ARG.tree || REPO), QUIET = !!ARG.quiet;
const ONLY = ARG.only ? new Set(ARG.only.split(',')) : null, want = n => !ONLY || ONLY.has(n);
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const PASS = 'cv-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms)), log = s => { if (!QUIET) console.log(s); };
const cases = [];
function check(name, ok, detail) { cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' - ' + detail : ''}`); }
let nonce = 0; const synth = k => `synthetic-cv-${k}-${(++nonce).toString(36)}${Date.now() % 1000}`;
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(dir) {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server in ' + dir);
}
const TAP = `(() => { const S = window.WebSocket; window.__cv = { game: null, admin: null, unlocked: false, sent: [] };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__cv.game = ws; const send = ws.send.bind(ws); ws.send = d => { try { const m = JSON.parse(d); if (m && m.t === 'say') window.__cv.sent.push(m); } catch (x) { } return send(d); };
      ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.ad) window.__cv.admin = m.ad; if (m.t === 'admin' && m.ok) window.__cv.unlocked = true; } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }); })();`;
const SIZES = { wide: { viewport: { width: 1280, height: 720 } }, hd: { viewport: { width: 1920, height: 1080 } }, phone: { mobile: true }, side: { mobile: true, landscape: true } };
async function open(b, port, room, o = {}) {
  const vp = o.landscape ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const ctx = await b.newContext(o.mobile ? { viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: o.reduced ? 'reduce' : 'no-preference' }
    : { viewport: o.viewport || { width: 1280, height: 720 }, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (o.init) await ctx.addInitScript(o.init);
  const P = await ctx.newPage(), errs = [];
  await P.addInitScript(TAP); P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  let st = null; for (let i = 0; i < 600; i++) { st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready' || st === 'menu' || st === 'error') break; await sleep(100); }
  if (st === 'ready') { if (o.mobile) await P.touchscreen.tap(vp.width / 2, vp.height * .6); else await P.keyboard.press('Space'); }
  for (let i = 0; i < 300; i++) { st = await P.evaluate(() => window.__boot ? __boot.state() : 'menu').catch(() => null); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => !!(window.__api && window.__api.H && window.__chat), null, { timeout: 60000 });
  return { ctx, P, errs, room, mobile: !!o.mobile };
}
async function until(P, fn, arg, ms = 8000) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(100); } }
async function startRun(s, name) {
  const { P } = s;
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible', timeout: 30000 });
  await P.fill('#name', name);
  if (s.mobile) await P.tap('#enter'); else await P.click('#enter');
  const ok = await until(P, () => !!(window.__api && __api.started() && !document.getElementById('hud').hidden && window.__net && __net.on), null, 20000);
  await P.evaluate(p => window.__net.testAuth(p), PASS);
  const unlocked = await until(P, () => window.__cv.unlocked, null, 5000);
  await P.evaluate(() => { window.__cv.game.send(JSON.stringify({ t: 'a', c: 'freeze', on: true })); window.__cv.game.send(JSON.stringify({ t: 'a', c: 'god', id: __api.H.id })); });
  await sleep(1200);
  return !!ok && !!unlocked && !(await P.evaluate(() => !!(__api.G && __api.G.caught) || !document.getElementById('caught').hidden));
}
const pos = P => P.evaluate(() => ({ x: __api.H.x, y: __api.H.y, id: __api.H.id }));
async function together(L, Sp) {
  const beside = await Sp.P.evaluate(() => { const H = __api.H; for (const [dx, dy] of [[90, 0], [-90, 0], [0, 90], [0, -90], [70, 70], [-70, 70], [70, -70], [-70, -70]]) if (__api.zc(Math.floor((H.x + dx) / 96), Math.floor((H.y + dy) / 96))) return { x: H.x + dx, y: H.y + dy }; return { x: H.x + 1, y: H.y + 1 }; });
  await L.P.evaluate(s => window.__api.tp(s.x, s.y), beside);
  return !!await until(L.P, s => { const a = window.__cv.admin; return a && a.pl && a.pl.some(q => q.id === __api.H.id && Math.hypot(q.x - s.x, q.y - s.y) < 30); }, beside, 5000);
}
const iconState = P => P.evaluate(() => { const e = document.getElementById('chatIcon'); if (!e) return { exists: false, shown: false };
  const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return { exists: true, shown: !e.hidden && cs.display !== 'none' && r.width > 0, label: e.getAttribute('aria-label') || '', key: (e.querySelector('.chat-icon-k') || {}).textContent || '',
    box: [r.left, r.top, r.right, r.bottom].map(v => Math.round(v * 10) / 10), W: innerWidth, H: innerHeight }; });
// what the icon must keep clear of: every visible part of the HUD and the controls around it
const CLEAR = () => {
  const e = document.getElementById('chatIcon'), r = e.getBoundingClientRect(), hit = q => r.left < q.right - .5 && q.left < r.right - .5 && r.top < q.bottom - .5 && q.top < r.bottom - .5;
  const shown = x => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden' && getComputedStyle(x).display !== 'none' && +getComputedStyle(x).opacity > 0 && !x.closest('[hidden]');
  const sel = '#hud .walk > *, #hud .keyline, .hud-obj .objective, header .tools button, #touch > button, .coordinates span, #encounterHint, #blackoutHint, #inventory, .location h1, #camHud .side, #net';
  return [...document.querySelectorAll(sel)].filter(x => x !== e && shown(x) && hit(x.getBoundingClientRect())).map(x => x.id || x.className || x.tagName);
};

/* ================================================================ C1: the chat icon */
async function iconAt(b, port, size, shots) {
  const s = await open(b, port, 'cvi' + size + (Date.now() % 10000), SIZES[size]);
  const menu = await iconState(s.P);
  check(`icon_absent_on_menu_${size}`, !menu.shown, JSON.stringify(menu));
  const ran = await startRun(s, 'CV Icon ' + size);
  const st = await until(s.P, () => { const e = document.getElementById('chatIcon'); return e && !e.hidden; }, null, 6000) ? await iconState(s.P) : await iconState(s.P);
  const [l, t, r, bt] = st.box || [0, 0, 0, 0], w = r - l, h = bt - t;
  const minHit = s.mobile ? 44 : 30;
  check(`icon_shown_low_right_${size}`, ran && st.shown && l > st.W / 2 && t > st.H / 2 && r <= st.W - 8 && bt <= st.H - 8 && w >= minHit && h >= minHit && w <= (s.mobile ? 64 : 140) && h <= (s.mobile ? 64 : 48), JSON.stringify(st));
  check(`icon_named_with_key_${size}`, /^Nearby chat \(.+\)$/.test(st.label) && (s.mobile || st.key.length > 0), `${st.label} / ${st.key}`);
  // clear of the HUD; with the coordinates on; with the passing hints shown (forced into view for the measurement)
  const c0 = await s.P.evaluate(CLEAR);
  await s.P.evaluate(() => __settings.set('coords', true)); await sleep(300);
  const c1 = await s.P.evaluate(CLEAR);
  await s.P.evaluate(() => { for (const id of ['encounterHint', 'blackoutHint']) { const e = document.getElementById(id); if (e) { e.dataset.cvWas = e.hidden ? '1' : ''; e.hidden = false; e.textContent = 'Something is moving in the halls, far down the hall'; } } }); await sleep(300);
  const c2 = await s.P.evaluate(CLEAR);
  if (shots) await s.P.screenshot({ path: path.join(shots, `icon_${size}.png`) });
  await s.P.evaluate(() => { for (const id of ['encounterHint', 'blackoutHint']) { const e = document.getElementById(id); if (e && e.dataset.cvWas === '1') e.hidden = true; } __settings.set('coords', false); });
  check(`icon_clear_of_hud_${size}`, !c0.length && !c1.length && !c2.length, JSON.stringify({ plain: c0, coords: c1, hints: c2 }));
  // a click (a tap) opens the composer, every held key let go; the icon hides until it closes
  if (!s.mobile) { await s.P.keyboard.down('KeyD'); await sleep(250); }
  if (s.mobile) await s.P.tap('#chatIcon'); else await s.P.click('#chatIcon');
  const op = await until(s.P, () => window.__chat.state().nearby.composer ? { f: document.activeElement && document.activeElement.id, keys: __api.keys.size, icon: !document.getElementById('chatIcon').hidden } : null, null, 4000);
  if (!s.mobile) await s.P.keyboard.up('KeyD');
  check(`icon_opens_composer_${size}`, !!op && op.f === 'sayText' && op.keys === 0 && !op.icon, JSON.stringify(op));
  await s.P.keyboard.press('Escape'); await sleep(300);
  const back = await until(s.P, () => !window.__chat.state().nearby.composer && !__api.paused() && !document.getElementById('chatIcon').hidden, null, 4000);
  check(`icon_back_after_escape_${size}`, !!back);
  // hidden while paused and in Customize
  if (!s.mobile) {
    await s.P.keyboard.press('Escape'); const pz = await until(s.P, () => __api.paused(), null, 4000); await sleep(400);
    const hp = await iconState(s.P);
    await s.P.click('#pauseCustomize').catch(() => { }); await sleep(800);
    const hc = await iconState(s.P);
    await s.P.keyboard.press('Escape'); await sleep(500); if (await s.P.evaluate(() => __api.paused())) { await s.P.click('#resume').catch(() => { }); }
    const again = await until(s.P, () => !__api.paused() && !document.getElementById('chatIcon').hidden, null, 6000);
    check(`icon_hidden_paused_and_customize_${size}`, !!pz && !hp.shown && !hc.shown && !!again, JSON.stringify({ pz: !!pz, paused: hp.shown, customize: hc.shown, again: !!again }));
  }
  check(`icon_no_page_errors_${size}`, !s.errs.length, s.errs.slice(0, 2).join(' | '));
  await s.ctx.close();
}
async function icon(b, port, shots) { for (const size of (ARG.sizes || 'wide,hd,phone,side').split(',')) await iconAt(b, port, size, shots); }

async function suite(tree, shots) {
  const S = await serve(tree);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const [n, f] of [['icon', icon]]) {
      if (!want(n)) continue;
      try { await f(b, S.port, shots); } catch (e) { check(n + '_ran', false, String(e && e.message || e).split('\n')[0].slice(0, 200)); }
      for (const c of b.contexts()) await c.close().catch(() => { });
    }
  } finally { await b.close(); try { process.kill(S.p.pid); } catch (e) { } }
}

// each mutant: one fault in a copy of public/; it must fail at least one of the cases named for it
const MUTANTS = [
  { name: 'icon shown over the pause screen', file: 'assets/chat.js', from: 'const showIcon = can && (!comp || comp.form.hidden);', to: 'const showIcon = !!(API() && API().started && API().started()) && (!comp || comp.form.hidden);', only: 'icon', expect: ['icon_hidden_paused_and_customize_wide', 'icon_absent_on_menu_wide'] },
  { name: 'icon in the middle of the screen', file: 'assets/ui.css', from: '.chat-icon{position:fixed;z-index:6;right:35px;bottom:25px;', to: '.chat-icon{position:fixed;z-index:6;right:45%;bottom:45%;', only: 'icon', expect: ['icon_shown_low_right_wide'] },
  { name: 'icon click does nothing', file: 'assets/chat.js', from: "iconEl.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openComposer(); });", to: "iconEl.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });", only: 'icon', expect: ['icon_opens_composer_wide'] },
  { name: 'icon on the touch buttons', file: 'assets/ui.css', from: 'bottom:calc(max(16px,env(safe-area-inset-bottom)) + var(--touch-h,0px) + 12px);\n    justify-content:center;', to: 'bottom:calc(max(16px,env(safe-area-inset-bottom)) + 30px);\n    justify-content:center;', only: 'icon', expect: ['icon_clear_of_hud_phone', 'icon_clear_of_hud_side'] },
];
async function mutants(work) {
  const res = [];
  for (const M of MUTANTS) {
    const dir = path.join(work, 'm' + MUTANTS.indexOf(M)); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(TREE, f), path.join(dir, f));
    for (const d of ['src', 'generated']) fs.symlinkSync(path.join(TREE, d), path.join(dir, d));
    fs.cpSync(path.join(TREE, 'public') + path.sep + '.', path.join(dir, 'public'), { recursive: true });
    const f = path.join(dir, 'public', M.file), src = fs.readFileSync(f, 'utf8');
    if (src.split(M.from).length !== 2) { res.push({ name: M.name, caught: false, why: 'does not apply' }); log(`MUTANT ${M.name}: does not apply`); fs.rmSync(dir, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, src.replace(M.from, M.to));
    const r = await new Promise(done => { const p = spawn(process.execPath, [__filename, '--tree', dir, '--only', M.only, '--quiet', '--out', path.join(dir, 'r.json')], { stdio: 'ignore' });
      const kill = setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) { } }, 1800000); p.on('exit', code => { clearTimeout(kill); let j = null; try { j = JSON.parse(fs.readFileSync(path.join(dir, 'r.json'), 'utf8')); } catch (e) { } done({ code, j }); }); });
    const failed = r.j ? r.j.cases.filter(c => !c.ok).map(c => c.name) : ['(no report)'];
    const caught = r.code !== 0 && M.expect.some(e => failed.includes(e));
    res.push({ name: M.name, caught, failed, expected: M.expect }); log(`MUTANT ${M.name}: ${caught ? 'caught' : 'NOT CAUGHT'} (${failed.join(', ')})`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return res;
}
(async () => {
  const t0 = Date.now(), shots = ARG.shots ? path.resolve(ARG.shots) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
  await suite(TREE, shots);
  const mut = ARG.mutants === '1' ? await mutants(path.resolve(ARG.work || fs.mkdtempSync(path.join(os.tmpdir(), 'chatv-')))) : null;
  const ok = cases.length > 0 && cases.every(c => c.ok) && (!mut || mut.every(m => m.caught));
  const rep = { tool: 'dev/tools/checks/chat_voice_browser.js', tree: TREE === REPO ? 'this repository' : TREE, browser: pw.chromium.name(), seconds: Math.round((Date.now() - t0) / 1000), ok, cases, passed: cases.filter(c => c.ok).length, failed: cases.filter(c => !c.ok).map(c => c.name), mutants: mut };
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
  console.log(`CHAT VOICE BROWSER: ${ok ? 'PASS' : 'FAIL'} - ${rep.passed} of ${cases.length} cases${mut ? `; mutants ${mut.filter(m => m.caught).length} of ${mut.length} caught` : ''} (${rep.seconds} s)`);
  process.exit(ok ? 0 : 1);
})();
