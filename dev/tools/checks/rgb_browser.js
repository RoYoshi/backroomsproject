#!/usr/bin/env node
/* dev/tools/checks/rgb_browser.js - Trial 4's red, green and blue sliders (F.R.O.N.T.'s assets/rgb.js), seen from a real Chromium
 * (development only; added by the post-Trial 4 review, which found the sliders never followed their colour picker).
 *
 *   node dev/tools/checks/rgb_browser.js --dir DIR [--out FILE.json] [--shots DIR] [--mutants 1] [--work DIR]
 *
 * DIR: a complete game folder (server.js, public/, generated/, src/), served by its own `node server.js PORT` with a synthetic admin
 * passcode (nothing here logs in).  Headless Chromium draws with SwiftShader.  Each page starts with known saved colours (the game's own
 * keys, set before its scripts run: body #123456, hands #abcdef, beam #4a7bd3; the HUD colour left at Default) and passes the boot gate
 * as a player does.  Nothing is sent to the server beyond loading the page; no run is entered.
 *
 * The cases (each a named check in the report):
 *   mounted      after Customize and Settings -> HUD have been opened, three times each: exactly four slider groups (Body, Hands,
 *                Beam, HUD), three sliders and three number fields each, every slider and field named (aria-label); since the
 *                pre-Trial 3 polish (P4) the numbers are fields you can type in, and the colour pickers are kept out of sight and out of
 *                the Tab order (the game's adapters; rgb.native)
 *   load         the saved body, hands and beam colours are what their sliders show at load, before any panel is opened
 *   body         Customize: the sliders and their numbers show the saved body colour; a swatch: they follow it; Red +5 with the
 *                keyboard: the picker, the saved appearance (wanderer-appearance) and the number move by exactly 5 from the swatch's
 *                red, green and blue untouched; the hands' sliders untouched
 *   beam         Customize -> Loadout: the beam's sliders show the saved beam colour; a swatch: they follow it
 *   hud          Settings -> HUD: at Default the sliders show the Default swatch's colour; a swatch: they follow it; Green -3 with the
 *                keyboard: the HUD setting is the swatch with its green 3 lower; Reset HUD: the setting is Default again and the sliders
 *                show the Default colour again
 *   fit          at 1280x720 the Customize sliders are drawn as sliders (under 30 px tall, no field border) and every number lies
 *                inside its group's box, in Customize and in Settings; at a 390x844 phone (touch) the same, and no group is wider than
 *                its column
 *   typing       (pre-Trial 3 polish P4; at 1280x720) Customize -> Body: the Pale swatch (#f3dcb2), then 5 typed in Red: nothing
 *                changes until Enter, then #05dcb2 (the picker, the sliders, the fields, the saved appearance); the Green slider moved
 *                with the keyboard keeps Red at 5; Red's own arrow key commits one step; 0, 255 and 128 typed; the field cleared and 64
 *                typed, committed by leaving it; -5 -> 0 and 300 -> 255; letters -> the value in effect put back; 77 then Escape -> put
 *                back, nothing applied, Customize still open; Escape again (nothing pending) closes Customize as before; "Custom" goes
 *                to Body's Red field and never clicks the picker (no browser chooser); after a reload the fields show the saved colour.
 *                Settings -> HUD at Default; a swatch, then Reset HUD (Default again, the hidden picker still holding the swatch); the
 *                rainbow swatch goes to HUD's Red field; Green 10 typed: the HUD setting is the Default colour with green 10 (not the
 *                picker's stale swatch); 33 then Escape: put back, Settings still open; Reset HUD: Default again, the fields its colour
 *   replicated   (P4) two pages in one room: A types a body colour in Customize, both enter a run, and the server's player record of A
 *                that B receives carries that colour (the look the game sends, unchanged)
 *   errors       no page error
 * --shots DIR: Customize and Settings -> HUD at both sizes.
 * --mutants 1: the check's own sensitivity: edits of a copy of the game's built rgb.js, ui.js or ui.css, each of which one of the cases
 *   above must fail (the sliders refreshed only once; the HUD's Default ignored; the numbers never written; no refresh at load; the
 *   game's field style back on the sliders; a number field unnamed; and P4's: every keystroke applied at once; no clamping; Escape on
 *   a pending HUD number closing Settings; a typed channel built on the picker instead of the colour in effect - the R4 bug; the
 *   "Custom" label opening the browser's chooser again).  Since P4 a mutant aimed at typing or replicated runs that case alone, and the
   others the original cases: the same test of each mutant, without replaying the slow two-player case twelve times.
 *   --mutant-ids a,b: only those mutants (to finish a run a restart cut short; the record lists which ran).
 * The server is stopped by its PID.  Exit 0 only when every case holds (and, with --mutants, every mutant is caught). */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms)), DIR = path.resolve(ARG.dir || '.');
const SAVED = { main: '#123456', hands: '#abcdef', beam: '#4a7bd3' };
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(dir) {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 'rgb-synthetic-admin' }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server in ' + dir);
}
const stop = s => { if (s) try { process.kill(s.p.pid); } catch (e) { } };
const SEED = `(() => { try { if (!sessionStorage.getItem('rgbSeeded')) { sessionStorage.setItem('rgbSeeded', '1');
  localStorage.setItem('wanderer-appearance', JSON.stringify({ hat: 'none', texture: 'plain', hands: '${SAVED.hands}', main: '${SAVED.main}', backpack: 'none' }));
  localStorage.setItem('wanderer-light', JSON.stringify({ kind: 'flashlight', color: '${SAVED.beam}' })); } } catch (e) { } })();`;
// one group, read from the page: the picker's value, the sliders as a colour, the numbers as a colour
const READ = name => { const t = [...document.querySelectorAll('.rgb-trio')].find(x => (x.getAttribute('aria-label') || '').startsWith(name + ' '));
  if (!t) return null; const h = a => '#' + a.map(v => (+v).toString(16).padStart(2, '0')).join('');
  const picker = { Body: 'avatarMain', Hands: 'avatarHands', Beam: 'lightColor', HUD: 'stColor' }[name];
  return { picker: document.getElementById(picker).value, sliders: h([...t.querySelectorAll('input[type=range]')].map(i => i.value)), outs: h([...t.querySelectorAll('.rgb-num')].map(o => o.value)) }; };   // (P4: the typeable fields)
async function open(b, port, phone, extra, room) {
  const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const P = await ctx.newPage(); P.errs = []; P.on('pageerror', e => P.errs.push(String(e).slice(0, 300)));
  await P.addInitScript(SEED); if (extra) await P.addInitScript(extra);
  await P.goto(`http://127.0.0.1:${port}/?room=${room || 'rgbcheck' + (phone ? 'p' : 'd')}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') { if (phone) await P.touchscreen.tap(195, 520); else await P.keyboard.press('Space'); } if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__ui && window.__settings && document.querySelectorAll('.rgb-trio').length >= 3, null, { timeout: 60000 }); await sleep(800);
  return { ctx, P };
}
const closeAll = async P => { await P.keyboard.press('Escape'); await sleep(400); await P.evaluate(() => window.__ui.go('home')); await sleep(400); };
async function keys(P, sel, key, n) { const el = await P.$(sel); await el.scrollIntoViewIfNeeded(); await el.focus(); for (let i = 0; i < n; i++) await P.keyboard.press(key); await sleep(400); }
const shift = (hex, ch, d) => '#' + [0, 1, 2].map(i => Math.max(0, Math.min(255, parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) + (i === ch ? d : 0))).toString(16).padStart(2, '0')).join('');
// the boxes: sliders drawn as sliders, every number inside its group
const FIT = () => [...document.querySelectorAll('.rgb-trio')].filter(t => t.getClientRects().length).map(t => { const r = t.getBoundingClientRect(), cs = getComputedStyle(t);
  const right = r.right - parseFloat(cs.borderRightWidth), host = t.parentElement.getBoundingClientRect();
  const sl = [...t.querySelectorAll('input[type=range]')].map(i => { const s = getComputedStyle(i); return { h: i.getBoundingClientRect().height, border: parseFloat(s.borderTopWidth) }; });
  const outs = [...t.querySelectorAll('.rgb-num')].map(o => { const q = o.getBoundingClientRect(); return { right: q.right, left: q.left }; });
  return { name: t.getAttribute('aria-label'), sliders: sl, outsInside: outs.every(o => o.right <= right + .5 && o.left >= r.left), wider: r.right > host.right + .5 || r.left < host.left - .5 }; });
async function side(b, port, phone, shots) {
  const { ctx, P } = await open(b, port, phone), C = {}, tag = phone ? 'phone' : 'wide';
  try {
    const at = await P.evaluate(READ, 'Body'), ah = await P.evaluate(READ, 'Hands'), ab = await P.evaluate(READ, 'Beam');
    C.load = { ok: [at, ah, ab].every(x => x && x.picker === x.sliders && x.sliders === x.outs) && at.picker === SAVED.main && ah.picker === SAVED.hands && ab.picker === SAVED.beam, body: at, hands: ah, beam: ab };
    // body
    for (let i = 0; i < 3; i++) { await P.evaluate(() => window.__ui.go('customize', 'wanderer')); await sleep(900); if (i < 2) await closeAll(P); }
    const b0 = await P.evaluate(READ, 'Body');
    const sw = await P.$('[data-for="avatarMain"] [data-v]:nth-child(3)'), swv = (await sw.getAttribute('data-v')).toLowerCase(); await sw.scrollIntoViewIfNeeded(); await sw.click(); await sleep(700);
    const b1 = await P.evaluate(READ, 'Body');
    await keys(P, '.rgb-trio[aria-label^="Body"] input[data-channel="0"]', 'ArrowRight', 5);
    const b2 = await P.evaluate(READ, 'Body'), saved = await P.evaluate(() => { try { return JSON.parse(localStorage.getItem('wanderer-appearance')).main; } catch (e) { return null; } });
    const h2 = await P.evaluate(READ, 'Hands'), want = shift(swv, 0, 5);
    C.body = { ok: b0.sliders === SAVED.main && b0.outs === SAVED.main && b1.sliders === swv && b1.outs === swv && b2.picker === want && b2.sliders === want && b2.outs === want && saved === want && h2.sliders === SAVED.hands,
      opened: b0, swatch: swv, afterSwatch: b1, afterKeys: b2, saved, want, hands: h2 };
    if (shots) { await (await P.$('.rgb-trio[aria-label^="Body"]')).scrollIntoViewIfNeeded(); await sleep(600); await P.screenshot({ path: path.join(shots, `customize_${tag}.png`) }); }
    const fitC = await P.evaluate(FIT);
    // beam
    await P.evaluate(() => window.__ui.go('customize', 'loadout')); await sleep(900);
    const e0 = await P.evaluate(READ, 'Beam');
    const bsw = await P.$('[data-for="lightColor"] [data-v]:nth-child(4)'), bv = (await bsw.getAttribute('data-v')).toLowerCase(); await bsw.scrollIntoViewIfNeeded(); await bsw.click(); await sleep(700);
    const e1 = await P.evaluate(READ, 'Beam');
    C.beam = { ok: e0.sliders === SAVED.beam && e0.outs === SAVED.beam && e1.sliders === bv && e1.outs === bv, opened: e0, swatch: bv, afterSwatch: e1 };
    fitC.push(...await P.evaluate(FIT));
    await closeAll(P);
    // the HUD
    for (let i = 0; i < 3; i++) { await P.evaluate(() => window.__ui.go('settings', 'hud')); await sleep(900); if (i < 2) await closeAll(P); }
    const def = await P.evaluate(() => __settings.swatches().find(x => !x[0])[2].toLowerCase());
    const u0 = await P.evaluate(READ, 'HUD'), c0 = await P.evaluate(() => __settings.get().c);
    const hsw = await P.$('#stSw [data-c="#6fe6ff"]'); await hsw.scrollIntoViewIfNeeded(); await hsw.click(); await sleep(700);
    const u1 = await P.evaluate(READ, 'HUD');
    await keys(P, '.rgb-trio[aria-label^="HUD"] input[data-channel="1"]', 'ArrowLeft', 3);
    const c2 = await P.evaluate(() => __settings.get().c), u2 = await P.evaluate(READ, 'HUD');
    await (await P.$('#stHudReset')).click(); await sleep(700);
    const c3 = await P.evaluate(() => __settings.get().c), u3 = await P.evaluate(READ, 'HUD');
    const hw = shift('#6fe6ff', 1, -3);
    C.hud = { ok: c0 === '' && u0.sliders === def && u0.outs === def && u1.sliders === '#6fe6ff' && u1.outs === '#6fe6ff' && c2 === hw && u2.sliders === hw && u2.outs === hw && c3 === '' && u3.sliders === def && u3.outs === def,
      defaultColour: def, atDefault: u0, afterSwatch: u1, afterKeys: { c: c2, read: u2, want: hw }, afterReset: { c: c3, read: u3 } };
    if (shots) { await (await P.$('.rgb-trio[aria-label^="HUD"]')).scrollIntoViewIfNeeded(); await sleep(600); await P.screenshot({ path: path.join(shots, `settings_hud_${tag}.png`) }); }
    const fitS = await P.evaluate(FIT);
    const allFit = fitC.concat(fitS);
    C.fit = { ok: allFit.length >= 3 && allFit.every(f => f.outsInside && !f.wider) && fitC.every(f => f.sliders.every(s => s.h < 30 && s.border === 0)), groups: allFit };
    C.mounted = { ok: await P.evaluate(() => { const t = [...document.querySelectorAll('.rgb-trio')]; const names = t.map(x => x.getAttribute('aria-label')).sort().join();
      return t.length === 4 && names === 'Beam RGB channels,Body RGB channels,HUD RGB channels,Hands RGB channels' && t.every(x => x.querySelectorAll('input[type=range]').length === 3
        && [...x.querySelectorAll('input[type=range]')].every(i => (i.getAttribute('aria-label') || '').length > 0)
        && x.querySelectorAll('input.rgb-num[type=number]').length === 3 && [...x.querySelectorAll('.rgb-num')].every(o => (o.getAttribute('aria-label') || '').length > 0))
        && ['avatarMain', 'avatarHands', 'lightColor', 'stColor'].every(id => { const p = document.getElementById(id); return p && p.classList.contains('rgb-native') && p.tabIndex === -1 && getComputedStyle(p).pointerEvents === 'none'; }); }),
      groups: await P.evaluate(() => document.querySelectorAll('.rgb-trio').length) };
    C.errors = { ok: P.errs.length === 0, errors: P.errs };
  } finally { await ctx.close(); }
  return C;
}
/* pre-Trial 3 polish P4: the typed numbers (see the header: typing, replicated) */
const NUM = (name, ch) => `.rgb-trio[aria-label^="${name}"] .rgb-num[data-channel="${ch}"]`;
const setCh = (hex, ch, v) => '#' + [0, 1, 2].map(i => (i === ch ? v : parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)).toString(16).padStart(2, '0')).join('');
async function typeIn(P, sel, text, end) { await P.click(sel, { clickCount: 3 }); await P.keyboard.type(text); if (end) await P.keyboard.press(end); await sleep(400); }
const all3 = (r, hex) => !!r && r.picker === hex && r.sliders === hex && r.outs === hex;
async function typing(b, port, shots) {
  const { ctx, P } = await open(b, port, false, null, 'rgbtype' + Date.now() % 1e6), T = {};
  const rd = () => P.evaluate(READ, 'Body'), saved = () => P.evaluate(() => { try { return JSON.parse(localStorage.getItem('wanderer-appearance')).main; } catch (e) { return null; } });
  try {
    await P.evaluate(() => { window.__pk = 0; document.getElementById('avatarMain').addEventListener('click', () => window.__pk++); });
    await P.evaluate(() => window.__ui.go('customize', 'wanderer')); await sleep(1000);
    const sw = await P.$('[data-for="avatarMain"] [data-v="#f3dcb2"]'); await sw.scrollIntoViewIfNeeded(); await sw.click(); await sleep(700);
    T.pale = await rd();
    await (await P.$(NUM('Body', 0))).scrollIntoViewIfNeeded();
    await P.click(NUM('Body', 0), { clickCount: 3 }); await P.keyboard.type('5'); await sleep(300); T.pending = await rd(); T.pendingSaved = await saved();
    await P.keyboard.press('Enter'); await sleep(500); T.five = await rd(); T.fiveSaved = await saved();
    await keys(P, '.rgb-trio[aria-label^="Body"] input[type=range][data-channel="1"]', 'ArrowRight', 2); T.green = await rd();
    await P.focus(NUM('Body', 0)); await P.keyboard.press('ArrowUp'); await sleep(400); T.arrow = await rd();
    for (const v of ['0', '255', '128']) { await typeIn(P, NUM('Body', 0), v, 'Enter'); T['t' + v] = await rd(); }
    await P.click(NUM('Body', 0), { clickCount: 3 }); await P.keyboard.press('Backspace'); await sleep(300); T.cleared = await rd();
    await P.keyboard.type('64'); await P.keyboard.press('Tab'); await sleep(500); T.t64 = await rd();
    await typeIn(P, NUM('Body', 0), '-5', 'Enter'); T.neg = await rd();
    await typeIn(P, NUM('Body', 0), '300', 'Enter'); T.big = await rd();
    await typeIn(P, NUM('Body', 0), 'abc', 'Enter'); T.letters = await rd();
    await typeIn(P, NUM('Body', 0), '77', 'Escape'); T.esc = await rd(); T.escOpen = await P.evaluate(() => !document.getElementById('appearancePanel').hidden);
    await P.click('#appearancePanel .cz-pick'); await sleep(400);
    T.custom = await P.evaluate(() => ({ focus: document.activeElement && document.activeElement.getAttribute('aria-label'), pickerClicks: window.__pk }));
    if (shots) { await (await P.$('.rgb-trio[aria-label^="Body"]')).scrollIntoViewIfNeeded(); await sleep(500); await P.screenshot({ path: path.join(shots, 'typing_customize_wide.png') }); }
    await P.keyboard.press('Escape'); await sleep(800); T.escClosed = await P.evaluate(() => document.getElementById('appearancePanel').hidden);
    // a reload: what was committed is what is saved and shown
    await P.reload({ waitUntil: 'commit' });
    for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
    await P.waitForFunction(() => window.__ui && document.querySelectorAll('.rgb-trio').length >= 3, null, { timeout: 60000 }); await sleep(1000);
    T.reload = await rd(); T.reloadSaved = await saved();
    // the HUD
    await P.evaluate(() => window.__ui.go('settings', 'hud')); await sleep(1000);
    const def = await P.evaluate(() => __settings.swatches().find(x => !x[0])[2].toLowerCase());
    T.hudDefault = { c: await P.evaluate(() => __settings.get().c), read: await P.evaluate(READ, 'HUD'), def };
    // a swatch, then Reset HUD: the setting is Default again while the (hidden) picker keeps the swatch - the review's stale case
    const hs = await P.$('#stSw [data-c="#6fe6ff"]'); await hs.scrollIntoViewIfNeeded(); await hs.click(); await sleep(600);
    await (await P.$('#stHudReset')).click(); await sleep(700);
    T.hudAfterSwatchReset = { c: await P.evaluate(() => __settings.get().c), picker: await P.evaluate(() => document.getElementById('stColor').value), read: await P.evaluate(READ, 'HUD') };
    await (await P.$('#stSw .pick')).scrollIntoViewIfNeeded(); await P.click('#stSw .pick'); await sleep(400);
    T.rainbow = await P.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
    await (await P.$(NUM('HUD', 1))).scrollIntoViewIfNeeded(); await typeIn(P, NUM('HUD', 1), '10', 'Enter'); T.hud10 = { c: await P.evaluate(() => __settings.get().c), read: await P.evaluate(READ, 'HUD') };
    await typeIn(P, NUM('HUD', 1), '33', 'Escape'); T.hudEsc = { c: await P.evaluate(() => __settings.get().c), open: await P.evaluate(() => !document.getElementById('uiSettings').hidden), read: await P.evaluate(READ, 'HUD') };
    await (await P.$('#stHudReset')).click(); await sleep(700); T.hudReset = { c: await P.evaluate(() => __settings.get().c), read: await P.evaluate(READ, 'HUD') };
    const W = '#05dcb2', g2 = setCh(W, 1, 0xde), last = setCh(g2, 0, 255), h10 = setCh(def, 1, 10);
    T.want = { five: W, green: g2, last, hud: h10 };
    T.ok = all3(T.pale, '#f3dcb2') && T.pending.picker === '#f3dcb2' && T.pending.sliders === '#f3dcb2' && T.pendingSaved === '#f3dcb2'
      && all3(T.five, W) && T.fiveSaved === W && all3(T.green, g2) && all3(T.arrow, setCh(g2, 0, 6))
      && all3(T.t0, setCh(g2, 0, 0)) && all3(T.t255, setCh(g2, 0, 255)) && all3(T.t128, setCh(g2, 0, 128))
      && T.cleared.picker === setCh(g2, 0, 128) && T.cleared.sliders === setCh(g2, 0, 128) && all3(T.t64, setCh(g2, 0, 64))
      && all3(T.neg, setCh(g2, 0, 0)) && all3(T.big, last) && all3(T.letters, last) && all3(T.esc, last) && T.escOpen
      && T.custom.focus === 'Body Red, 0 to 255' && T.custom.pickerClicks === 0 && T.escClosed
      && all3(T.reload, last) && T.reloadSaved === last
      && T.hudDefault.c === '' && T.hudDefault.read.sliders === def && T.hudDefault.read.outs === def
      && T.hudAfterSwatchReset.c === '' && T.hudAfterSwatchReset.read.outs === def && T.rainbow === 'HUD Red, 0 to 255'
      && T.hud10.c === h10 && T.hud10.read.sliders === h10 && T.hud10.read.outs === h10 && T.hudEsc.c === h10 && T.hudEsc.open && T.hudEsc.read.outs === h10
      && T.hudReset.c === '' && T.hudReset.read.sliders === def && T.hudReset.read.outs === def;
    T.errors = P.errs.slice();
    if (P.errs.length) T.ok = false;
  } catch (e) { T.ok = false; T.error = String(e).slice(0, 300); } finally { await ctx.close(); }
  return T;
}
// two players in one room: the typed body colour is what the other one receives
const TAPS = `(() => { const S = window.WebSocket; window.__rg = { lk: {}, sent: null };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { const send = ws.send.bind(ws); ws.send = d => { try { const m = JSON.parse(d); if (m && m.t === 'p' && m.lk) window.__rg.sent = m.lk; } catch (x) { } return send(d); };
      ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.t === 's' && m.p) for (const q of m.p) if (q.lk) window.__rg.lk[q.id] = q.lk; } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }); })();`;
async function replicated(b, port) {
  const room = 'rgbrep' + Date.now() % 1e6, A = await open(b, port, false, TAPS, room), B = await open(b, port, false, TAPS, room), T = {};
  try {
    await A.P.evaluate(() => window.__ui.go('customize', 'wanderer')); await sleep(1000);
    await (await A.P.$(NUM('Body', 0))).scrollIntoViewIfNeeded();
    await typeIn(A.P, NUM('Body', 0), '17', 'Enter'); await typeIn(A.P, NUM('Body', 2), '201', 'Enter');
    T.typed = await A.P.evaluate(READ, 'Body'); await A.P.keyboard.press('Escape'); await sleep(700);
    for (const [s, n] of [[A, 'Typer'], [B, 'Watcher']]) { await s.P.evaluate(() => window.__ui.go('play')); await s.P.waitForSelector('#name', { state: 'visible' }); await s.P.fill('#name', n); await s.P.click('#enter'); }
    const aid = await (async () => { for (let i = 0; i < 300; i++) { const v = await A.P.evaluate(() => window.__api && __api.started() && __api.H && __api.H.id).catch(() => null); if (v) return v; await sleep(100); } return null; })();
    let seen = null; for (let i = 0; i < 200 && aid; i++) { seen = await B.P.evaluate(id => window.__rg.lk[id] || null, aid); if (seen && seen.split('|')[3] === T.typed.picker) break; await sleep(100); }
    T.aId = aid; T.aSent = await A.P.evaluate(() => window.__rg.sent); T.bSees = seen;
    T.ok = !!aid && !!T.typed && T.typed.picker === T.typed.outs && T.typed.picker !== SAVED.main && !!T.aSent && T.aSent.split('|')[3] === T.typed.picker && !!seen && seen.split('|')[3] === T.typed.picker;
    T.errors = A.P.errs.concat(B.P.errs); if (T.errors.length) T.ok = false;
  } catch (e) { T.ok = false; T.error = String(e).slice(0, 300); } finally { await A.ctx.close(); await B.ctx.close(); }
  return T;
}
// a pass that hangs (a page that stops answering) fails instead of stalling the gate
const within = (p, ms, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(what + ' did not finish in ' + ms / 1000 + ' s')), ms).unref())]);
// only: a mutant's own case (P4: a mutant aimed at typing or replicated runs that case alone, the others the original cases - the same
// sensitivity in a fraction of the time); the unmutated pass runs everything
async function checks(b, port, shots, only) {
  const R = {};
  if (!only || !['typing', 'replicated'].includes(only)) for (const phone of [false, true]) { const c = await side(b, port, phone, shots); for (const [k, v] of Object.entries(c)) R[`${k}_${phone ? 'phone' : 'wide'}`] = v; }
  if (!only || only === 'typing') R.typing_wide = await typing(b, port, shots);   // (pre-Trial 3 polish P4)
  if (!only || only === 'replicated') R.replicated_wide = await replicated(b, port);
  return R;
}
const MUTANTS = [
  ['refresh_once', 'assets/rgb.js', '  function sync(g) {\n    if (!g) return;', '  function sync(g) {\n    if (!g || g.done) return; g.done = 1;', 'body'],
  ['hud_default_ignored', 'assets/rgb.js', "    if (g.picker.id === 'stColor' && window.__settings && __settings.get) {", '    if (false) {', 'hud'],
  ['numbers_frozen', 'assets/rgb.js', "      if (!editing(f) && f.value !== String(v)) f.value = String(v);", '', 'body'],
  ['no_load_refresh', 'assets/rgb.js', "  addEventListener('load', syncAll);", '', 'load'],
  ['field_style_back', 'assets/ui.css', '.rgb-channel input[type=range]{height:auto;margin:0;padding:0;border:0;background:none}', '', 'fit'],
  ['number_unnamed', 'assets/rgb.js', " num.setAttribute('aria-label', name + ' ' + title + ', 0 to 255');", '', 'mounted'],
  // pre-Trial 3 polish P4
  ['keystrokes_applied', 'assets/rgb.js', "        num.dataset.rgbEditing = '1';", "        commit(g, n); return;", 'typing'],
  ['no_clamp', 'assets/rgb.js', "? Math.max(0, Math.min(255, parseInt(t, 10))) : null;", "? parseInt(t, 10) : null;", 'typing'],
  ['escape_closes_settings', 'assets/ui.js', "    if (e.key === 'Escape' && document.activeElement && document.activeElement.dataset && document.activeElement.dataset.rgbEditing === '1') return;", '', 'typing'],
  ['stale_channel', 'assets/rgb.js', "  function set(g, n, v) {\n    const base = current(g);", "  function set(g, n, v) {\n    const base = hex(g.picker.value);", 'typing'],
  ['chooser_back', 'assets/rgb.js', "if (!e.isTrusted) return; e.preventDefault(); e.stopPropagation(); g.nums[0].focus();", "if (!e.isTrusted || true) return; e.preventDefault(); e.stopPropagation(); g.nums[0].focus();", 'typing'],
];
function copyGame(src, dst) { fs.mkdirSync(dst, { recursive: true }); execFileSync('cp', ['-a', src + path.sep + '.', dst]); }
(async () => {
  const R = { tool: 'dev/tools/checks/rgb_browser.js', dir: DIR, chromium: null, checks: {}, ok: true };
  const shots = ARG.shots ? path.resolve(ARG.shots) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); R.chromium = b.version();
  let s = null;
  try {
    s = await serve(DIR); R.checks = await within(checks(b, s.port, shots), 900000, 'the checks'); stop(s); s = null;
    if (ARG.mutants === '1') {
      const work = fs.mkdtempSync(path.join(ARG.work ? path.resolve(ARG.work) : os.tmpdir(), 'rgb-mutants-')); R.mutants = [];
      try {
        const pick = ARG['mutant-ids'] ? new Set(ARG['mutant-ids'].split(',')) : null, RUN = pick ? MUTANTS.filter(m => pick.has(m[0])) : MUTANTS;
        if (pick && RUN.length !== pick.size) throw new Error('--mutant-ids names a mutant this check does not have');
        R.mutantIds = RUN.map(m => m[0]);
        for (const [id, file, from, to, check] of RUN) {
          const dir = path.join(work, id); copyGame(DIR, dir); const f = path.join(dir, 'public', file), t = fs.readFileSync(f, 'utf8');
          if (t.split(from).length !== 2) { R.mutants.push({ id, check, applied: false, caught: false }); console.log(`mutant ${id}: NOT APPLIED`); fs.rmSync(dir, { recursive: true, force: true }); continue; }
          fs.writeFileSync(f, t.replace(from, to));
          const sm = await serve(dir); let failed = [];
          try { const mc = await within(checks(b, sm.port, null, check), 900000, 'mutant ' + id); failed = Object.entries(mc).filter(([, v]) => !v.ok).map(([k]) => k); }
          catch (e) { failed = ['error: ' + String(e).slice(0, 120)]; }
          finally { stop(sm); fs.rmSync(dir, { recursive: true, force: true }); }
          const caught = failed.some(x => x.startsWith(check + '_'));
          R.mutants.push({ id, file, check, applied: true, failed, caught });
          console.log(`mutant ${id}: ${caught ? 'caught' : 'MISSED'} (failed: ${failed.join(', ') || 'none'})`);
        }
      } finally { fs.rmSync(work, { recursive: true, force: true }); }
      R.mutantsCaught = R.mutants.filter(m => m.caught).length;
      if (R.mutantsCaught !== R.mutantIds.length) R.ok = false;
    }
  } catch (e) { R.error = String(e && e.stack || e); R.ok = false; }
  finally { stop(s); await b.close(); }
  for (const [k, v] of Object.entries(R.checks)) { if (!v.ok) R.ok = false; console.log(`${v.ok ? 'ok  ' : 'FAIL'} ${k}`); }
  if (R.error) console.log(R.error);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  console.log(`RGB SLIDERS: ${R.ok ? 'PASS' : 'FAIL'} (${Object.values(R.checks).filter(c => c.ok).length} of ${Object.keys(R.checks).length} checks${R.mutants ? `; mutants ${R.mutantsCaught} of ${R.mutantIds ? R.mutantIds.length : MUTANTS.length} caught` : ''})`);
  process.exitCode = R.ok ? 0 : 1;
})();
