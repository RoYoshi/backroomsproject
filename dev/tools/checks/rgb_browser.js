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
 *                Beam, HUD), three sliders each, every slider named (aria-label) and its number hidden from screen readers (the
 *                slider announces its own value)
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
 *   errors       no page error
 * --shots DIR: Customize and Settings -> HUD at both sizes.
 * --mutants 1: the check's own sensitivity: edits of a copy of the game's built rgb.js or ui.css, each of which one of the cases above
 *   must fail (the sliders refreshed only once; the HUD's Default ignored; the numbers never written; no refresh at load; the game's
 *   field style back on the sliders; the numbers announced to screen readers as well as the sliders).
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
  return { picker: document.getElementById(picker).value, sliders: h([...t.querySelectorAll('input[type=range]')].map(i => i.value)), outs: h([...t.querySelectorAll('output')].map(o => o.value)) }; };
async function open(b, port, phone) {
  const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const P = await ctx.newPage(); P.errs = []; P.on('pageerror', e => P.errs.push(String(e).slice(0, 300)));
  await P.addInitScript(SEED);
  await P.goto(`http://127.0.0.1:${port}/?room=rgbcheck${phone ? 'p' : 'd'}`, { waitUntil: 'commit', timeout: 90000 });
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
  const outs = [...t.querySelectorAll('output')].map(o => { const q = o.getBoundingClientRect(); return { right: q.right, left: q.left }; });
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
        && [...x.querySelectorAll('input[type=range]')].every(i => (i.getAttribute('aria-label') || '').length > 0) && [...x.querySelectorAll('output')].every(o => o.getAttribute('aria-hidden') === 'true')); }),
      groups: await P.evaluate(() => document.querySelectorAll('.rgb-trio').length) };
    C.errors = { ok: P.errs.length === 0, errors: P.errs };
  } finally { await ctx.close(); }
  return C;
}
// a pass that hangs (a page that stops answering) fails instead of stalling the gate
const within = (p, ms, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(what + ' did not finish in ' + ms / 1000 + ' s')), ms).unref())]);
async function checks(b, port, shots) {
  const R = {};
  for (const phone of [false, true]) { const c = await side(b, port, phone, shots); for (const [k, v] of Object.entries(c)) R[`${k}_${phone ? 'phone' : 'wide'}`] = v; }
  return R;
}
const MUTANTS = [
  ['refresh_once', 'assets/rgb.js', '  function sync(g) {\n    if (!g) return;', '  function sync(g) {\n    if (!g || g.done) return; g.done = 1;', 'body'],
  ['hud_default_ignored', 'assets/rgb.js', "    if (g.picker.id === 'stColor' && window.__settings && __settings.get) {", '    if (false) {', 'hud'],
  ['numbers_frozen', 'assets/rgb.js', " if (g.outs[n].value !== String(v)) g.outs[n].value = String(v);", '', 'body'],
  ['no_load_refresh', 'assets/rgb.js', "  addEventListener('load', syncAll);", '', 'load'],
  ['field_style_back', 'assets/ui.css', '.rgb-channel input[type=range]{height:auto;margin:0;padding:0;border:0;background:none}', '', 'fit'],
  ['numbers_announced', 'assets/rgb.js', " val.setAttribute('aria-hidden', 'true');", '', 'mounted'],
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
        for (const [id, file, from, to, check] of MUTANTS) {
          const dir = path.join(work, id); copyGame(DIR, dir); const f = path.join(dir, 'public', file), t = fs.readFileSync(f, 'utf8');
          if (t.split(from).length !== 2) { R.mutants.push({ id, check, applied: false, caught: false }); console.log(`mutant ${id}: NOT APPLIED`); fs.rmSync(dir, { recursive: true, force: true }); continue; }
          fs.writeFileSync(f, t.replace(from, to));
          const sm = await serve(dir); let failed = [];
          try { const mc = await within(checks(b, sm.port, null), 900000, 'mutant ' + id); failed = Object.entries(mc).filter(([, v]) => !v.ok).map(([k]) => k); }
          catch (e) { failed = ['error: ' + String(e).slice(0, 120)]; }
          finally { stop(sm); fs.rmSync(dir, { recursive: true, force: true }); }
          const caught = failed.some(x => x.startsWith(check + '_'));
          R.mutants.push({ id, file, check, applied: true, failed, caught });
          console.log(`mutant ${id}: ${caught ? 'caught' : 'MISSED'} (failed: ${failed.join(', ') || 'none'})`);
        }
      } finally { fs.rmSync(work, { recursive: true, force: true }); }
      R.mutantsCaught = R.mutants.filter(m => m.caught).length;
      if (R.mutantsCaught !== MUTANTS.length) R.ok = false;
    }
  } catch (e) { R.error = String(e && e.stack || e); R.ok = false; }
  finally { stop(s); await b.close(); }
  for (const [k, v] of Object.entries(R.checks)) { if (!v.ok) R.ok = false; console.log(`${v.ok ? 'ok  ' : 'FAIL'} ${k}`); }
  if (R.error) console.log(R.error);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  console.log(`RGB SLIDERS: ${R.ok ? 'PASS' : 'FAIL'} (${Object.values(R.checks).filter(c => c.ok).length} of ${Object.keys(R.checks).length} checks${R.mutants ? `; mutants ${R.mutantsCaught} of ${MUTANTS.length} caught` : ''})`);
  process.exitCode = R.ok ? 0 : 1;
})();
