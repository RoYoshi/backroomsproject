/* ADAPTED COPY of dev/stage-3c-qa1/first_candidate/probe_c2.js for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.
 *   - helpers from ui_lib_gate.js: each page passes the QA2 boot and its ready gate (one key press, as a player would) before the probe acts on it
 */
/* ADAPTED COPY of dev/stage-3c/probe_c2.js for Stage 3C QA1 - written by dev/stage-3c-qa1/first_candidate/run.js; do not edit by hand.
 *   (no change besides the helper path)
 */
/* Stage 3C C2 - the HUD, pause, run states and touch controls, checked in a browser (development only; never served).
 *
 *   node dev/stage-3c/probe_c2.js [--game DIR] [--port 9612] [--out FILE.json]
 *
 * Desktop 1920 x 1080: the objective, status line, location, coordinates and connection line are laid out around the
 * edges with nothing in the centre and nothing overlapping; the game still writes every readout (pace, stamina, light,
 * sector, coordinates); the HUD's PAUSE button pauses through the game's own control and CONTINUE resumes; Escape still
 * pauses and resumes; the HUD settings (size, colour, coordinates, key hints, title) still drive the new layout; the caught,
 * won and run panels show their own buttons; the camcorder still hides the location while raised.
 * Touch 390 x 844 and 844 x 390: the pad and the action buttons sit inside the screen without overlapping each other or the
 * HUD; key hints are hidden; PAUSE and INV work by tapping; the connection line shows while paused; with the Night Vision
 * Camcorder its NV / IR / ZOOM buttons join the cluster. Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib_gate.js'); const { sleep } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..', '..')), PORT = +(opt('port') || 9612), OUT = opt('out');
const R = { checks: [], errors: [] };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + (typeof note === 'string' ? note : JSON.stringify(note)) : '')); };
/* the boxes of what is on screen (visible, non-empty), for the overlap and centre checks */
const BOXES = (sels) => {
  const out = {};
  for (const [k, sel] of Object.entries(sels)) {
    const els = [...document.querySelectorAll(sel)].filter(e => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; let p = e; while (p) { if (p.hidden) return false; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; });
    if (els.length) out[k] = els.map(e => { const r = e.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(e); const t = g.getBoundingClientRect();   // the box and its text (text can overflow its box)
      const u = t.width > 0 ? [Math.min(r.left, t.left), Math.min(r.top, t.top), Math.max(r.right, t.right), Math.max(r.bottom, t.bottom)] : [r.left, r.top, r.right, r.bottom]; return u.map(Math.round); });
  }
  return out;
};
const hit = (a, b) => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;
function overlaps(B, skip = []) {
  const ks = Object.keys(B), bad = [];
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    if (skip.some(([x, y]) => (x === ks[i] && y === ks[j]) || (x === ks[j] && y === ks[i]))) continue;
    for (const a of B[ks[i]]) for (const b of B[ks[j]]) if (hit(a, b)) bad.push([ks[i], ks[j], a, b]);
  }
  return bad;
}
const HUD = { objective: '.hud-obj .objective', status: '#hud .walk', keys: '#hud .keyline', location: '.location', coords: '.coordinates', tools: 'header .tools', net: '#net' };
const TOUCH = { dpad: '#touch .dpad', run: '#touch [data-key=ShiftLeft]', crouch: '#touch [data-key=KeyC]', light: '#touchFlash', inv: '#touchInv', nv: '#touchNV', ir: '#touchIR', zoom: '#touchZoom' };
const inView = (B, W, Hh) => Object.entries(B).every(([k, l]) => l.every(r => r[0] >= 0 && r[1] >= 0 && r[2] <= W + 1 && r[3] <= Hh + 1));
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    { const s = await U.page(b, PORT); const P = s.P;
      await U.start(P, 'Probe'); await U.admin(P); await U.H.stage(P);
      await U.H.place(P, 1200, 3408, -0.4, { light: true, kind: 'flashlight' }); await sleep(2500);
      const d = await P.evaluate(([B, HUD]) => { const f = new Function('return ' + B)(); return { box: f(HUD), brand: getComputedStyle(document.querySelector('header .brand')).display,
        obj: document.getElementById('evidenceCount').textContent, pace: document.getElementById('pace').textContent, stam: document.getElementById('staminaText').textContent,
        light: document.getElementById('lightStatus').textContent, sector: document.getElementById('sector').textContent, coords: document.getElementById('coords').textContent,
        pause: !!document.getElementById('hudPause').getClientRects().length, W: innerWidth, H: innerHeight }; }, [BOXES.toString(), HUD]);
      const cx = [d.W * .3, d.H * .3, d.W * .7, d.H * .7], inCentre = Object.entries(d.box).filter(([k, l]) => l.some(r => hit(r, cx))).map(([k]) => k);
      check('desktop: objective, status, key hints, location, coordinates, header and connection line are all on screen', ['objective', 'status', 'keys', 'location', 'coords', 'tools', 'net'].every(k => d.box[k]) && inView(d.box, d.W, d.H), d.box);
      check('desktop: nothing in the centre of the screen (the middle 40 %)', !inCentre.length, inCentre);
      check('desktop: no two HUD blocks overlap', !overlaps(d.box).length, overlaps(d.box));
      check('desktop: the game still writes every readout; the brand gives way to the objective; a PAUSE button is shown', d.brand === 'none' && /GLITCHED WALL/.test(d.obj) && d.pace && /^\d+$/.test(d.stam) && /FLASHLIGHT (ON|OFF)/.test(d.light) && /\//.test(d.sector) && /^X \d{4} \/ Y \d{4}$/.test(d.coords) && d.pause, { obj: d.obj, pace: d.pace, stam: d.stam, light: d.light, sector: d.sector, coords: d.coords });
      // PAUSE button -> the game's pause; CONTINUE -> back; Escape still pauses and resumes
      await P.click('#hudPause'); await sleep(700);
      const p1 = await P.evaluate(() => ({ paused: __api.paused(), st: __ui.state(), keys: !!document.querySelector('.pz-keys').getClientRects().length, focusIn: document.getElementById('dialog').contains(document.activeElement) }));
      await P.click('#resume'); await sleep(600);
      const p2 = await P.evaluate(() => ({ paused: __api.paused(), st: __ui.state() }));
      await P.keyboard.press('Escape'); await sleep(500); const p3 = await P.evaluate(() => __api.paused());
      await P.keyboard.press('Escape'); await sleep(500); const p4 = await P.evaluate(() => __api.paused());
      check('the HUD PAUSE button pauses through the game (controls shown, focus in the dialog); CONTINUE resumes; Escape still pauses and resumes', p1.paused && p1.st === 'paused' && p1.keys && p1.focusIn && !p2.paused && p2.st === 'playing' && p3 && !p4, { p1, p2, p3, p4 });
      // the HUD settings drive the new layout
      const hs = await P.evaluate(async () => {
        const o = document.querySelector('.hud-obj'), r0 = o.getBoundingClientRect().height; __settings.set('s', 1.5); await new Promise(r => setTimeout(r, 300));
        const r1 = o.getBoundingClientRect().height; __settings.set('c', '#6fe6ff'); await new Promise(r => setTimeout(r, 900));
        const col = getComputedStyle(document.querySelector('.hud-obj b')).color; __settings.set('coords', false); __settings.set('keys', false); __settings.set('title', false);
        const hidden = ['.coordinates', '#hud .keyline', '.location'].map(s => getComputedStyle(document.querySelector(s)).display);
        __settings.reset('hud'); await new Promise(r => setTimeout(r, 300));
        return { r0: Math.round(r0), r1: Math.round(r1), col, hidden, back: getComputedStyle(document.querySelector('.coordinates')).display };
      });
      check('HUD size, colour, coordinates, key hints and title settings drive the new HUD (and reset)', hs.r1 > hs.r0 * 1.4 && hs.col === 'rgb(111, 230, 255)' && hs.hidden.every(x => x === 'none') && hs.back !== 'none', hs);
      // run-state panels
      await P.evaluate(() => { document.getElementById('caught').hidden = false; document.body.classList.add('captured'); }); await sleep(700);
      const cg = await P.evaluate(() => ({ retry: !!document.getElementById('retry').getClientRects().length, lo: !!document.getElementById('loadoutBtn') && !!document.getElementById('loadoutBtn').getClientRects().length, line: getComputedStyle(document.querySelector('#caught .panel'), '::before').backgroundColor }));
      await P.evaluate(() => { document.getElementById('caught').hidden = true; document.body.classList.remove('captured'); }); await sleep(300);
      await P.evaluate(() => __api.win()); await sleep(700);
      const wn = await P.evaluate(() => ({ again: !!document.getElementById('playAgain').getClientRects().length, st: __ui.state() }));
      await P.evaluate(() => __api.unwin()); await sleep(300);
      check('caught (RESPAWN, CHANGE LOADOUT, red line) and won (RESTART) panels show their own buttons', cg.retry && cg.lo && cg.line === 'rgb(196, 80, 63)' && wn.again && wn.st === 'won', { cg, wn });
      await P.keyboard.press('Escape'); await sleep(500); await P.click('#reset'); await sleep(4300);
      const rn = await P.evaluate(() => ({ st: __ui.state(), btns: ['runSpawn', 'runCustomize', 'runEnd'].map(i => !!document.getElementById(i).getClientRects().length) }));
      check('NEW RUN reaches the run menu with SPAWN / CUSTOMIZE / END', rn.st === 'run' && rn.btns.every(Boolean), rn);
      await P.click('#runSpawn'); await sleep(2500);
      // the camcorder still hides the location while raised (camcorder.js)
      await U.H.place(P, 1200, 3408, -0.4, { light: true, kind: 'camcorder' }); await sleep(1200);
      const cam = await P.evaluate(() => ({ raised: document.body.classList.contains('cam-raised'), loc: getComputedStyle(document.querySelector('.location')).display, obj: getComputedStyle(document.querySelector('.hud-obj')).display }));
      check('Night Vision Camcorder raised: the viewfinder takes over (location hidden, objective kept)', cam.raised && cam.loc === 'none' && cam.obj !== 'none', cam);
      R.errors.push(...s.errs.map(e => 'desktop: ' + e)); await s.ctx.close();
    }
    for (const [W, Hh, label] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
      const s = await U.page(b, PORT, { viewport: { width: W, height: Hh }, mobile: true, dpr: 2 }); const P = s.P;
      await U.start(P, 'Touch'); await U.admin(P); await U.H.stage(P); await U.H.place(P, 1200, 3408, -0.4, { light: true, kind: 'flashlight' }); await sleep(2000);
      const d = await P.evaluate(([B, HUD, T]) => { const f = new Function('return ' + B)(); return { hud: f(HUD), touch: f(T), keys: getComputedStyle(document.querySelector('#hud .keyline')).display, kbd: getComputedStyle(document.querySelector('#hudPause kbd')).display }; }, [BOXES.toString(), HUD, TOUCH]);
      const all = Object.assign({}, d.hud, d.touch);
      check(`touch ${label}: pad, RUN, CROUCH, LIGHT and INV on screen; key hints and the Esc label hidden`, ['dpad', 'run', 'crouch', 'light', 'inv'].every(k => d.touch[k]) && inView(all, W, Hh) && d.keys === 'none' && d.kbd === 'none', { touch: d.touch, keys: d.keys });
      check(`touch ${label}: nothing overlaps (HUD blocks, header, pad and buttons)`, !overlaps(all).length, overlaps(all));
      await P.tap('#hudPause'); await sleep(800);
      const pz = await P.evaluate(() => ({ paused: __api.paused(), net: getComputedStyle(document.getElementById('net')).display, keys: getComputedStyle(document.querySelector('.pz-keys')).display, over: document.documentElement.scrollWidth - innerWidth }));
      await P.tap('#resume'); await sleep(700);
      const rs = await P.evaluate(() => __api.paused());
      await P.tap('#touchInv'); await sleep(600); const i1 = await P.evaluate(() => !!__inv.open);
      await P.tap('#touchInv'); await sleep(500); const i2 = await P.evaluate(() => !!__inv.open);
      check(`touch ${label}: PAUSE pauses (connection line shown, keyboard reference hidden), CONTINUE resumes, INV opens and closes the inventory`, pz.paused && pz.net !== 'none' && pz.keys === 'none' && pz.over <= 0 && !rs && i1 && !i2, { pz, rs, i1, i2 });
      R.errors.push(...s.errs.map(e => label + ': ' + e)); await s.ctx.close();
    }
    for (const [W, Hh, label] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
      const s = await U.page(b, PORT, { viewport: { width: W, height: Hh }, mobile: true, dpr: 2, storage: { 'wanderer-light': '{"kind":"camcorder"}' } }); const P = s.P;
      await U.start(P, 'Touch'); await U.admin(P); await U.H.stage(P); await U.H.place(P, 1200, 3408, -0.4, { light: true, kind: 'camcorder' }); await sleep(2000);
      const d = await P.evaluate(([B, HUD, T]) => { const f = new Function('return ' + B)(); return { hud: f(HUD), touch: f(T) }; }, [BOXES.toString(), HUD, TOUCH]);
      const all = Object.assign({}, d.hud, d.touch);
      check(`touch ${label}, Night Vision Camcorder: NV, IR and ZOOM join the cluster, all on screen, nothing overlapping`, ['nv', 'ir', 'zoom', 'run', 'light', 'inv'].every(k => d.touch[k]) && inView(all, W, Hh) && !overlaps(all).length, { touch: d.touch, overlaps: overlaps(all) });
      R.errors.push(...s.errs.map(e => label + ' cam: ' + e)); await s.ctx.close();
    }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
