/* Stage 3C C1 - the main menu, the sheets and the run entry, checked in a browser (development only; never served).
 *
 *   node dev/stage-3c/probe_c1.js [--game DIR] [--port 9611] [--out FILE.json]
 *
 * Boot lands on the menu (PLAY panel open, #name visible, header and HUD hidden); SETTINGS / CREDITS sheets open from the
 * menu with real clicks, trap Tab, close on Escape and give focus back to the button that opened them; Space presses a
 * focused menu button; CUSTOMIZE opens and closes the game's own panel; a settings change persists; ENTER (Enter in the
 * name field) starts exactly one run (one 'join' on the socket); pause traps Tab without opening the inventory; pause ->
 * Settings opens over the paused game and Escape closes only the sheet; reduced motion; 390 x 844 touch without horizontal
 * overflow. Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib.js'); const { sleep } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9611), OUT = opt('out');
const R = { checks: [], errors: [] };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + (typeof note === 'string' ? note : JSON.stringify(note)) : '')); };
const COUNT_JOINS = () => { const s = WebSocket.prototype.send; window.__joins = 0; WebSocket.prototype.send = function (d) { try { if (typeof d === 'string' && d.includes('"t":"join"')) window.__joins++; } catch (e) { } return s.call(this, d); }; };
const st = P => P.evaluate(() => __ui.state());
const act = P => P.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : null; });
const hiddenSoon = (P, id) => P.waitForFunction(i => document.getElementById(i).hidden, id, { timeout: 8000 }).then(() => true, () => false);   // the sheet hides after its fade (slow frames under software rendering)
const inside = (P, sel) => P.evaluate(s => { const a = document.activeElement, r = document.querySelector(s); return !!(a && r && r.contains(a)); }, sel);
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    { const s = await U.page(b, PORT, { init: COUNT_JOINS }); const P = s.P;
      const boot = await P.evaluate(() => ({ st: __ui.state(), menuCls: document.body.classList.contains('ui-menu'), nameVis: !!document.getElementById('name').getClientRects().length,
        items: [...document.querySelectorAll('#menu .mm-item')].map(b => b.dataset.go), header: getComputedStyle(document.querySelector('header')).visibility, hud: document.getElementById('hud').hidden,
        kind: document.getElementById('mmKind').textContent, fixture: !!document.querySelector('.mm-fixture i') }));
      check('boot lands on the main menu with the PLAY panel (name field visible), header and HUD hidden', boot.st === 'menu' && boot.menuCls && boot.nameVis && boot.header === 'hidden' && boot.hud && boot.items.join() === 'play,customize,settings,credits', boot);
      check('the PLAY panel shows the real equipped light', /flashlight|headlamp|lantern|camcorder/i.test(boot.kind), boot.kind);

      // SETTINGS with a real click; Tab stays inside; Escape closes and focus returns to the opener
      await P.click('#menu .mm-item[data-go="settings"]'); await sleep(600);
      const so = await P.evaluate(() => ({ vis: !document.getElementById('uiSettings').hidden, nav: document.querySelector('#menu .mm-item.on').dataset.go }));
      let trapped = true; for (let i = 0; i < 40; i++) { await P.keyboard.press('Tab'); if (!await inside(P, '#uiSettings')) { trapped = false; break; } }
      let trappedBack = true; for (let i = 0; i < 12; i++) { await P.keyboard.press('Shift+Tab'); if (!await inside(P, '#uiSettings')) { trappedBack = false; break; } }
      await P.keyboard.press('Escape'); await hiddenSoon(P, 'uiSettings');
      const sc = await P.evaluate(() => ({ hidden: document.getElementById('uiSettings').hidden, st: __ui.state(), focus: document.activeElement && document.activeElement.dataset.go, started: __api.started() }));
      check('Settings opens from the menu, Tab and Shift+Tab stay inside it', so.vis && so.nav === 'settings' && trapped && trappedBack, { so, trapped, trappedBack });
      check('Escape closes Settings, focus returns to SETTINGS, the game did not start or pause', sc.hidden && sc.st === 'menu' && sc.focus === 'settings' && !sc.started, sc);

      // a real setting persists (coordinates off, then back on); lighting quality goes to BR-RoLE and is remembered
      await P.evaluate(() => __ui.go('settings', 'hud')); await sleep(500);
      await P.click('#uiSettings [data-k="coords"]'); await sleep(200);
      const c1 = await P.evaluate(() => ({ model: __settings.get().coords, saved: JSON.parse(localStorage.getItem('fb_settings_v1') || '{}').coords, cls: document.body.classList.contains('hud-nocoords'), aria: document.querySelector('#uiSettings [data-k="coords"]').getAttribute('aria-checked') }));
      await P.click('#uiSettings [data-k="coords"]'); await sleep(200);
      const c2 = await P.evaluate(() => __settings.get().coords);
      check('a HUD setting changes the model, the body class and fb_settings_v1, and switches back', c1.model === false && c1.saved === false && c1.cls && c1.aria === 'false' && c2 === true, { c1, c2 });
      const q0 = await P.evaluate(() => window.__brRole && __brRole.quality());
      await P.evaluate(() => __ui.go('settings', 'graphics')); await sleep(400);
      await P.click('#uiSettings [data-lq="low"]'); await sleep(300);
      const ql = await P.evaluate(() => ({ q: __brRole.quality(), saved: localStorage.getItem('tfb.lighting.quality'), aria: document.querySelector('#uiSettings [data-lq="low"]').getAttribute('aria-checked') }));
      await P.click(`#uiSettings [data-lq="${q0 || 'high'}"]`); await sleep(300);
      const qb = await P.evaluate(() => __brRole.quality());
      check('Lighting and shadows quality drives BR-RoLE and is remembered', ql.q === 'low' && ql.saved === 'low' && ql.aria === 'true' && qb === (q0 || 'high'), { q0, ql, qb });
      await P.keyboard.press('Escape'); await sleep(500);

      // CREDITS by keyboard: focus the nav item, Space presses it
      await P.focus('#menu .mm-item[data-go="credits"]'); await P.keyboard.press('Space'); await sleep(600);
      const cr = await P.evaluate(() => { const el = document.getElementById('uiCredits'); return el && { vis: !el.hidden, heads: [...el.querySelectorAll('.cr-sec h3')].map(h => h.textContent), text: el.textContent }; });
      check('Space on a focused menu item presses it (CREDITS opens)', cr && cr.vis, cr && cr.heads);
      check('Credits come from credits_data.js: empty sections hidden, the wiki attribution and PixiJS present', cr && !cr.heads.includes('Design') && !cr.heads.includes('Art') && cr.heads.includes('Created by') && /RoYoshi/.test(cr.text) && /CC BY-SA 3\.0/.test(cr.text) && /PixiJS/.test(cr.text), cr && cr.heads);
      await P.keyboard.press('Escape'); await hiddenSoon(P, 'uiCredits');
      check('Escape closes Credits and focus returns to CREDITS', await P.evaluate(() => document.getElementById('uiCredits').hidden && document.activeElement && document.activeElement.dataset.go === 'credits'));

      // CUSTOMIZE: the game's own panel opens over the menu and closes with Escape
      await P.click('#menu .mm-item[data-go="customize"]'); await sleep(700);
      const cu = await P.evaluate(() => ({ st: __ui.state(), vis: !document.getElementById('appearancePanel').hidden, tab: window.__uiCustomizeTab }));
      await P.keyboard.press('Escape'); await sleep(500);
      const cc = await P.evaluate(() => ({ st: __ui.state(), started: __api.started(), paused: __api.paused(), dialog: document.getElementById('dialog').hidden }));
      check('CUSTOMIZE opens the game\'s customize panel; Escape returns to the menu (not started, not paused)', cu.st === 'customize' && cu.vis && cc.st === 'menu' && !cc.started && !cc.paused && cc.dialog, { cu, cc });
      await P.click('#menu .mm-loadout [data-go="customize"]'); await sleep(600);
      const cl = await P.evaluate(() => ({ st: __ui.state(), tab: window.__uiCustomizeTab }));
      await P.evaluate(() => __ui.go('customize', 'wanderer')); await sleep(300);    // switching tabs while customize is open
      await P.evaluate(() => __ui.go('home')); await sleep(500);
      const ch = await P.evaluate(() => ({ st: __ui.state(), paused: __api.paused(), dialog: document.getElementById('dialog').hidden, panel: document.getElementById('appearancePanel').hidden }));
      check('the loadout row\'s Change opens customize on the loadout tab', cl.st === 'customize' && cl.tab === 'loadout', cl);
      check('switching customize tabs and going home leaves the menu unpaused (no pause dialog over the menu)', ch.st === 'menu' && !ch.paused && ch.dialog && ch.panel, ch);

      // ENTER: Enter in the name field starts exactly one run
      await P.fill('#name', 'Probe'); await P.focus('#name'); await P.keyboard.press('Enter');
      for (let i = 0; i < 100; i++) { if (await P.evaluate(() => __api.started())) break; await sleep(100); }
      await sleep(1500);
      const run = await P.evaluate(() => ({ started: __api.started(), st: __ui.state(), joins: window.__joins, menuCls: document.body.classList.contains('ui-menu'), name: document.getElementById('nameplate').textContent, saved: localStorage.getItem('tfb.wanderer.name'), header: getComputedStyle(document.querySelector('header')).visibility }));
      check('Enter in the name field starts exactly one run; the menu is gone and the HUD is up', run.started && run.st === 'playing' && run.joins === 1 && !run.menuCls && run.header === 'visible', run);
      check('the wanderer name reaches the nameplate and is remembered for next time', /PROBE/i.test(run.name) && run.saved === 'Probe', { name: run.name, saved: run.saved });
      // from here on the monsters are frozen (the retained suites' test admin): online, the halls do not stop for the pause screen, and a
      // kill while paused would legitimately unpause into the death sequence
      await U.admin(P); await U.H.stage(P);

      // pause: Tab is trapped in the dialog and does not open the inventory
      await P.keyboard.press('Escape'); await sleep(500);
      const pz = await P.evaluate(() => ({ st: __ui.state(), paused: __api.paused(), more: !!document.getElementById('pauseSettings').getClientRects().length }));
      let ptrap = true; for (let i = 0; i < 16; i++) { await P.keyboard.press('Tab'); if (!await inside(P, '#dialog')) { ptrap = false; break; } }
      const inv = await P.evaluate(() => !!(window.__inv && __inv.open) || !(document.getElementById('inventory') || { hidden: true }).hidden);
      check('Escape pauses; Tab moves focus inside the pause dialog and does not open the inventory', pz.st === 'paused' && pz.paused && pz.more && ptrap && !inv, { pz, ptrap, inv, active: await act(P) });

      // pause -> Settings: over the paused game; Escape closes only the sheet; Escape again resumes
      await P.click('#pauseSettings'); await sleep(600);
      const ps = await P.evaluate(() => ({ sheet: !document.getElementById('uiSettings').hidden, paused: __api.paused(), dialog: !document.getElementById('dialog').hidden }));
      await P.keyboard.press('Escape'); await hiddenSoon(P, 'uiSettings');
      const ps2 = await P.evaluate(() => ({ sheet: !document.getElementById('uiSettings').hidden, paused: __api.paused(), st: __ui.state(), focus: document.activeElement && document.activeElement.id }));
      await P.keyboard.press('Escape'); await sleep(500);
      const ps3 = await P.evaluate(() => ({ paused: __api.paused(), st: __ui.state() }));
      check('pause -> Settings opens over the paused game; Escape closes the sheet (still paused, focus back on Settings); Escape again resumes', ps.sheet && ps.paused && ps.dialog && !ps2.sheet && ps2.paused && ps2.st === 'paused' && ps2.focus === 'pauseSettings' && !ps3.paused && ps3.st === 'playing', { ps, ps2, ps3 });

      // the inventory still opens with Tab during play
      await P.keyboard.press('Tab'); await sleep(400);
      const invOpen = await P.evaluate(() => !!(window.__inv && __inv.open));
      await P.keyboard.press('Tab'); await sleep(300);
      check('Tab still opens the inventory during play', invOpen);
      R.errors.push(...s.errs.map(e => 'desktop: ' + e));
      await s.ctx.close();
    }
    { const s = await U.page(b, PORT, { reduced: true }); const P = s.P;
      const r = await P.evaluate(() => ({ rm: document.documentElement.classList.contains('rm'), enter: document.getElementById('menu').classList.contains('enter'), anim: getComputedStyle(document.querySelector('.mm-fixture i')).animationName }));
      check('prefers-reduced-motion: html.rm, no entrance replay, the fixture does not flicker', r.rm && !r.enter && r.anim === 'none', r);
      R.errors.push(...s.errs.map(e => 'reduced: ' + e)); await s.ctx.close();
    }
    { const s = await U.page(b, PORT, { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2 }); const P = s.P;
      const m = await P.evaluate(() => { const mm = document.getElementById('menu'); const nav = document.querySelector('.mm-nav'); return { docOver: document.documentElement.scrollWidth - innerWidth, menuOver: mm.scrollWidth - mm.clientWidth, items: [...document.querySelectorAll('#menu .mm-item')].map(b => { const r = b.getBoundingClientRect(); return r.width > 40 && r.left >= 0 && r.right <= innerWidth + .5 && b.scrollWidth <= b.clientWidth + 1; }), title: (() => { const r = document.querySelector('.mm-title h1 .b').getBoundingClientRect(); return Math.round(r.right); })(), panel: Math.round(document.getElementById('mmPlay').getBoundingClientRect().right), enterH: document.getElementById('enter').getBoundingClientRect().height, note: document.getElementById('mmNote').textContent }; });
      check('390 x 844 touch: no horizontal overflow, all four menu items and the PLAY panel inside the screen, touch-sized ENTER, touch wording', m.docOver <= 0 && m.menuOver <= 0 && m.items.every(Boolean) && m.panel <= 390 && m.title <= 390 && m.enterH >= 44 && /on-screen/.test(m.note), m);
      await P.click('#menu .mm-item[data-go="settings"]'); await sleep(600);
      const ms = await P.evaluate(() => { const c = document.querySelector('#uiSettings .us-card').getBoundingClientRect(); return { w: c.width, x: c.x, over: document.documentElement.scrollWidth - innerWidth }; });
      check('390 x 844: Settings fills the screen without overflow', Math.abs(ms.w - 390) < 2 && ms.x >= -1 && ms.over <= 0, ms);
      await P.click('#uiSettings .us-close'); const mc = await hiddenSoon(P, 'uiSettings');
      check('390 x 844: the sheet\'s Close button closes it', mc);
      await U.start(P, 'Touch');
      const mt = await P.evaluate(() => ({ started: __api.started(), st: __ui.state() }));
      check('390 x 844 touch: ENTER starts the run', mt.started && mt.st === 'playing', mt);
      R.errors.push(...s.errs.map(e => 'mobile: ' + e)); await s.ctx.close();
    }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
