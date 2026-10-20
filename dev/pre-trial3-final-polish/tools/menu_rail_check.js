#!/usr/bin/env node
/* dev/pre-trial3-final-polish/tools/menu_rail_check.js - pre-Trial 3 polish P3: the main menu's utility rail in a real page (development
 * only): the Account button and its "Accounts Coming Soon..." panel, and the redrawn Settings gear.
 *
 *   node dev/pre-trial3-final-polish/tools/menu_rail_check.js [--dir DIR] [--out FILE.json] [--shots DIR] [--mutants 1] [--work DIR]
 *
 * One server (`node server.js PORT` in --dir, default this repository; a synthetic admin passcode, nothing logs in), headless Chromium
 * (SwiftShader).  The boot gate is passed as a player passes it (a key, or a tap on a touch screen).  At 1920x1080, 1280x720, a 390x844
 * phone and an 844x390 phone on its side (touch, 2x):
 *   rail_*           the rail's four cells shown, the same size, in a column (a row on the short screen); the gear's drawing centred in its
 *                    cell (within .3 of the 24-unit box's centre), square (width and height within 5 %) and as large as the info
 *                    circle's (within 10 %)
 *   account_*_opens  a click (a tap) on the Account button opens the panel: shown, exactly "Accounts Coming Soon...", a dialog named by
 *                    that text, aria-expanded true, focus on Close; Customize NOT opened and the menu still the menu; the panel inside
 *                    the screen and clear of the rail's cells
 *   account_*_close  Close shuts it, focus back on the Account button, aria-expanded false
 * At 1280x720 also: account_keyboard_escape (Tab to the Account button, Enter opens it, Escape shuts it, focus back, still the menu - the
 * entry, a sheet and the pause screen untouched); account_press_elsewhere (a press on the title shuts it, focus not pulled back);
 * account_tab_away (Tab past Close shuts it); account_toggle (the button again shuts it); customize_still_there (the menu's own
 * Customize button opens Customize); gear_opens_settings (the gear opens Settings); no_page_errors.
 * --mutants 1: five edits of a copy of the served files, each of which a case above must catch (the button wired to Customize again;
 * Escape ignored; focus not given back; the panel's words changed; the gear's top tooth moved).
 * Exit 0 only when every case holds (and, with --mutants, every mutant is caught).  The server is stopped by its PID. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const REPO = path.resolve(__dirname, '../../..'), DIR = path.resolve(ARG.dir || REPO), PASS = 'rail-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function serve(dir) {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server in ' + dir);
}
const SIZES = [['hd', { viewport: { width: 1920, height: 1080 } }], ['wide', { viewport: { width: 1280, height: 720 } }],
  ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['side', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]];
async function open(b, port, o) {
  const ctx = await b.newContext(Object.assign({ reducedMotion: 'reduce' }, o)), P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') { if (o.hasTouch) await P.touchscreen.tap(20, (o.viewport.height * .6) | 0); else await P.keyboard.press('Space'); } if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__ui && document.getElementById('mmAccount'), null, { timeout: 60000 });
  // the menu's arrival (the rail fades in) is over: the rail is fully shown
  await P.waitForFunction(() => { const u = document.querySelector('.mm-util'); return !!u && +getComputedStyle(u).opacity > .99; }, null, { timeout: 30000 }).catch(() => null); await sleep(500);
  return { ctx, P, errs, touch: !!o.hasTouch };
}
// a press that cannot happen (its element not shown) is reported by the case that needed it, never thrown: a broken page fails cases
const press = (s, sel) => (s.touch ? s.P.tap(sel, { timeout: 10000 }) : s.P.click(sel, { timeout: 10000 })).then(() => true, () => false);
const click = (P, sel) => P.click(sel, { timeout: 10000 }).then(() => true, () => false);
const RAIL = () => { const cells = [...document.querySelectorAll('.mm-util > button')].map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.go || '', l: r.left, t: r.top, w: r.width, h: r.height, shown: r.width > 0 && getComputedStyle(e).visibility !== 'hidden' }; });
  const bb = sel => { const g = document.querySelector(sel); if (!g) return null; const b = g.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  return { cells, gear: bb('.mm-util [data-go="settings"] svg'), info: bb('.mm-util [data-go="help"] svg') }; };
const PANEL = () => { const p = document.getElementById('mmAccountPop'), a = document.getElementById('mmAccount'), r = p.getBoundingClientRect(), lab = p.getAttribute('aria-labelledby'), le = lab && document.getElementById(lab);
  const cells = [...document.querySelectorAll('.mm-util > button')].map(e => e.getBoundingClientRect()), hit = cells.some(c => !(r.right <= c.left + .5 || r.left >= c.right - .5 || r.bottom <= c.top + .5 || r.top >= c.bottom - .5));
  return { shown: !p.hidden && r.width > 0, text: (p.querySelector('.mm-pop-t') || {}).textContent || '', role: p.getAttribute('role'), name: le ? le.textContent : null, expanded: a.getAttribute('aria-expanded'),
    focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null, customize: !document.getElementById('appearancePanel').hidden, state: window.__ui.state(),
    inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, overRail: hit, box: [r.left, r.top, r.right, r.bottom].map(v => Math.round(v)) }; };

async function run(dir, shots, quiet) {
  const cases = [], check = (name, ok, detail) => { cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); if (!quiet) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' - ' + detail : ''}`); };
  const { p: srv, port } = await serve(dir), b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), errs = [];
  try {
    for (const [tag, o] of SIZES) {
      const s = await open(b, port, o);
      try {
        const R = await s.P.evaluate(RAIL), c = R.cells, side = tag === 'side';
        const same = c.length === 4 && c.every(x => x.shown && Math.abs(x.w - c[0].w) < .5 && Math.abs(x.h - c[0].h) < .5);
        const lined = c.length === 4 && c.every((x, i) => !i || (side ? Math.abs(x.t - c[0].t) < .5 && x.l > c[i - 1].l : Math.abs(x.l - c[0].l) < .5 && x.t > c[i - 1].t));
        check(`rail_${tag}_four_cells`, same && lined, JSON.stringify(c.map(x => [x.id, Math.round(x.l), Math.round(x.t), Math.round(x.w), Math.round(x.h)])));
        const g = R.gear, inf = R.info, gc = g && [g.x + g.w / 2, g.y + g.h / 2];
        check(`rail_${tag}_gear_centred`, g && inf && Math.abs(gc[0] - 12) < .3 && Math.abs(gc[1] - 12) < .3 && Math.abs(g.w / g.h - 1) < .05 && Math.abs(g.w / inf.w - 1) < .1, JSON.stringify({ gear: g, info: inf }));
        await press(s, '#mmAccount'); await sleep(400);
        const A = await s.P.evaluate(PANEL);
        check(`account_${tag}_opens`, A.shown && A.text === 'Accounts Coming Soon...' && A.role === 'dialog' && A.name === 'Accounts Coming Soon...' && A.expanded === 'true' && A.focus === 'mmAccountClose' && !A.customize && A.state === 'menu' && A.inside && !A.overRail, JSON.stringify(A));
        if (shots) await s.P.screenshot({ path: path.join(shots, `account_${tag}.png`) });
        await press(s, '#mmAccountClose'); await sleep(300);
        const C = await s.P.evaluate(PANEL);
        check(`account_${tag}_close`, !C.shown && C.focus === 'mmAccount' && C.expanded === 'false' && !C.customize && C.state === 'menu', JSON.stringify(C));
        if (tag === 'wide') {
          // the keyboard: Tab to the Account button (from PLAY), Enter, Escape
          await s.P.evaluate(() => document.getElementById('mmAccount').blur());
          await s.P.evaluate(() => document.getElementById('mmPlay').focus()); let at = null;
          for (let i = 0; i < 20 && at !== 'mmAccount'; i++) { await s.P.keyboard.press('Tab'); at = await s.P.evaluate(() => document.activeElement && document.activeElement.id); }
          await s.P.keyboard.press('Enter'); await sleep(300); const K1 = await s.P.evaluate(PANEL);
          await s.P.keyboard.press('Escape'); await sleep(300); const K2 = await s.P.evaluate(PANEL);
          const quietAfter = await s.P.evaluate(() => ({ entry: !document.getElementById('mmEntry').hidden, sheet: document.body.classList.contains('ui-sheet-open'), paused: !!(window.__api && __api.paused && __api.paused()) }));
          check('account_keyboard_escape', at === 'mmAccount' && K1.shown && K1.focus === 'mmAccountClose' && !K2.shown && K2.focus === 'mmAccount' && K2.expanded === 'false' && K2.state === 'menu' && !quietAfter.entry && !quietAfter.sheet && !quietAfter.paused,
            JSON.stringify({ reached: at, open: K1, after: K2, quietAfter }));
          // a press elsewhere
          await click(s.P, '#mmAccount'); await sleep(300); const t = await s.P.evaluate(() => { const r = document.getElementById('mmTitle').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
          await s.P.mouse.click(t[0], t[1]); await sleep(300); const E = await s.P.evaluate(PANEL);
          check('account_press_elsewhere', !E.shown && E.expanded === 'false' && E.focus !== 'mmAccountClose' && E.state === 'menu', JSON.stringify(E));
          // Tab past Close
          await click(s.P, '#mmAccount'); await sleep(300); await s.P.keyboard.press('Tab'); await sleep(300); const T = await s.P.evaluate(PANEL);
          check('account_tab_away', !T.shown && T.expanded === 'false', JSON.stringify(T));
          // the button again
          await click(s.P, '#mmAccount'); await sleep(300); const G1 = await s.P.evaluate(PANEL); await click(s.P, '#mmAccount'); await sleep(300); const G2 = await s.P.evaluate(PANEL);
          check('account_toggle', G1.shown && !G2.shown && G2.focus === 'mmAccount', JSON.stringify({ first: G1.shown, second: G2.shown, focus: G2.focus }));
          // Customize is still the menu's own button's
          await click(s.P, '.mm-row [data-go="customize"]'); const cz = await (async () => { for (let i = 0; i < 40; i++) { if (await s.P.evaluate(() => !document.getElementById('appearancePanel').hidden)) return true; await sleep(100); } return false; })();
          check('customize_still_there', cz, `Customize opened by the menu's Customize button: ${cz}`);
          if (cz) { await s.P.evaluate(() => { const d = document.getElementById('doneAppearance'); if (d) d.click(); }); await sleep(600); }
          // the gear opens Settings
          await click(s.P, '.mm-util [data-go="settings"]'); const st = await (async () => { for (let i = 0; i < 40; i++) { if (await s.P.evaluate(() => { const e = document.getElementById('uiSettings'); return !!e && !e.hidden; })) return true; await sleep(100); } return false; })();
          check('gear_opens_settings', st, `Settings opened by the gear: ${st}`);
        }
      } finally { errs.push(...s.errs); await s.ctx.close(); }
    }
    check('no_page_errors', !errs.length, JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); try { process.kill(srv.pid); } catch (e) { } }
  return cases;
}
/* the check's own sensitivity: each edit of a copy of the served files must make the named cases fail */
const MUTANTS = [
  { name: 'the button wired to Customize again', file: 'index.html', from: '<button type="button" id="mmAccount" aria-label="Account"', to: '<button type="button" id="mmAccount" data-go="customize" data-sub="wanderer" aria-label="Account"', expect: ['account_wide_opens'] },
  { name: 'Escape ignored', file: 'assets/ui.js', from: "    if (e.key === 'Escape' && accountOpen()) { e.preventDefault(); e.stopImmediatePropagation(); closeAccount(true); return; }", to: '', expect: ['account_keyboard_escape'] },
  { name: 'focus not given back', file: 'assets/ui.js', from: '    if (back) acct.focus({ preventScroll: true });', to: '', expect: ['account_wide_close'] },
  { name: 'the panel\'s words changed', file: 'index.html', from: '<p class="mm-pop-t" id="mmAccountT">Accounts Coming Soon...</p>', to: '<p class="mm-pop-t" id="mmAccountT">Accounts</p>', expect: ['account_wide_opens'] },
  { name: 'the gear\'s top tooth moved', file: 'index.html', from: 'M10.64 5.34L10.84 3.18L13.16 3.18L13.36 5.34', to: 'M10.64 5.34L10.84 1.5L13.16 1.5L13.36 5.34', expect: ['rail_wide_gear_centred'] },
];
(async () => {
  const shots = ARG.shots ? path.resolve(ARG.shots) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
  const t0 = Date.now(), cases = await run(DIR, shots, false), R = { tool: 'dev/pre-trial3-final-polish/tools/menu_rail_check.js', dir: DIR, cases, passed: cases.filter(c => c.ok).length, failed: cases.filter(c => !c.ok).map(c => c.name) };
  R.ok = cases.length > 0 && !R.failed.length;
  console.log(`MENU RAIL: ${R.ok ? 'PASS' : 'FAIL'} - ${R.passed} of ${cases.length} cases (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (ARG.mutants === '1') {
    R.mutants = []; const work = ARG.work ? path.resolve(ARG.work) : fs.mkdtempSync(path.join(os.tmpdir(), 'railmut-'));
    for (const M of MUTANTS) {
      const d = path.join(work, 'm' + MUTANTS.indexOf(M)); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
      for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(DIR, f), path.join(d, f));
      for (const f of ['src', 'generated']) fs.symlinkSync(path.join(DIR, f), path.join(d, f));
      execFileSync('cp', ['-a', path.join(DIR, 'public'), path.join(d, 'public')]);
      const fp = path.join(d, 'public', M.file), txt = fs.readFileSync(fp, 'utf8'), n = txt.split(M.from).length - 1;
      if (n !== 1) { R.mutants.push({ name: M.name, applied: false, count: n, caught: false }); console.log(`MUTANT ${M.name}: NOT APPLIED (${n})`); continue; }
      fs.writeFileSync(fp, txt.replace(M.from, M.to));
      let mc = []; try { mc = await run(d, null, true); } catch (e) { mc = [{ name: 'error: ' + String(e).slice(0, 120), ok: false }]; }
      const failed = mc.filter(c => !c.ok).map(c => c.name), caught = M.expect.every(e => failed.includes(e));
      R.mutants.push({ name: M.name, applied: true, expect: M.expect, failed, caught }); console.log(`MUTANT ${M.name}: ${caught ? 'caught' : 'ESCAPED'} (${failed.join(', ') || 'nothing failed'})`);
      fs.rmSync(d, { recursive: true, force: true });
    }
    R.mutantsCaught = R.mutants.filter(m => m.caught).length; R.ok = R.ok && R.mutantsCaught === MUTANTS.length;
    console.log(`MENU RAIL MUTANTS: ${R.mutantsCaught} of ${MUTANTS.length} caught`);
  }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  process.exitCode = R.ok ? 0 : 1;
})();
