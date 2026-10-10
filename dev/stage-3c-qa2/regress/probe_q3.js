/* ADAPTED COPY of dev/stage-3c-qa1/probe_q3.js for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.
 *   - helpers from ui_lib_gate.js: each page passes the QA2 boot and its ready gate (one key press, as a player would) before the probe acts on it
 *   - the same default game folder (the repository root) from the copy's location
 */
/* Stage 3C QA1, Q3 - the minimal HUD, the location reveals, the settings migration and the keybinds (development only).
 *
 *   node dev/stage-3c-qa1/probe_q3.js [--game DIR] [--first DIR] [--port 9731] [--out FILE.json]
 *
 * --first is the first Stage 3C candidate (76bcc4a) checked out in a folder: the default-bindings checks run the same key
 * sequence and the same walk there and compare. Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib_gate.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..', '..')), FIRST = opt('first') && path.resolve(opt('first')), PORT = +(opt('port') || 9731), OUT = opt('out');
const R = { game: GAME, first: FIRST, checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 700) : '')); };
const adm = (P, o) => P.evaluate(o => { const ws = window.__ws; if (ws && ws.readyState === 1) { ws.send(JSON.stringify(Object.assign({ t: 'a' }, o))); return true; } return false; }, o);
/* every key event, at the window's capture phase before any page script (installed first) and at the document's capture phase
   (after every window listener: an event held back at the window never gets there) */
const LOG = () => { window.__kA = []; window.__kB = [];
  addEventListener('keydown', e => __kA.push('d:' + e.code + (e.isTrusted ? '' : ':synthetic')), true); addEventListener('keyup', e => __kA.push('u:' + e.code + (e.isTrusted ? '' : ':synthetic')), true);
  document.addEventListener('keydown', e => __kB.push('d:' + e.code + (e.isTrusted ? '' : ':synthetic')), true); document.addEventListener('keyup', e => __kB.push('u:' + e.code + (e.isTrusted ? '' : ':synthetic')), true); };
/* a clear stretch of floor: room to walk 260 px each way from it */
const OPEN = () => { const A = __api, ok = (x, y) => A.sl(x, y, 30);
  for (let y = 600; y < 6400; y += 48) for (let x = 600; x < 8600; x += 48) { let good = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, -.7], [.7, .7]]) for (let d = 0; d <= 300 && good; d += 24) if (!ok(x + dx * d, y + dy * d)) good = false;
    if (good) return [x, y]; }
  return null; };
async function playing(P, name) { await U.start(P, name); await U.admin(P); await H.stage(P); await P.evaluate(() => window.__clock && __clock.thaw()); await sleep(600); }
async function walk(P, codes, ms) {                                       // hold keys, return the displacement and the stamina spent
  await P.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  const a = await P.evaluate(() => [__api.H.x, __api.H.y, __api.H.stamina]);
  for (const c of codes) await P.keyboard.down(c); await sleep(ms); for (const c of codes.slice().reverse()) await P.keyboard.up(c); await sleep(250);
  const b = await P.evaluate(() => [__api.H.x, __api.H.y, __api.H.stamina]);
  const dx = b[0] - a[0], dy = b[1] - a[1]; return { dx: Math.round(dx), dy: Math.round(dy), dist: Math.round(Math.hypot(dx, dy)), ang: +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1), stamina: +(a[2] - b[2]).toFixed(1) };
}
/* the same walk, frame for frame: the test clock is frozen and stepped 1/60 s per frame (so every frame is one game tick, however
   slow the software renderer is), and the keys go down on frame 0 and up on frame n from inside the page */
async function walkExact(P, codes, n) {
  await P.evaluate(() => { __clock.freeze(true); __clock.set(__clock.get(), 1000 / 60); });
  const r = await P.evaluate(([codes, n]) => new Promise(done => {
    const A = __api, x0 = A.H.x, y0 = A.H.y, s0 = A.H.stamina, fire = (t, c) => document.body.dispatchEvent(new KeyboardEvent(t, { code: c, key: c, bubbles: true, cancelable: true }));
    let k = 0; const step = () => { if (k === 0) codes.forEach(c => fire('keydown', c)); if (k === n) codes.slice().reverse().forEach(c => fire('keyup', c));
      if (k === n + 8) { const dx = A.H.x - x0, dy = A.H.y - y0; done({ dx: +dx.toFixed(3), dy: +dy.toFixed(3), dist: +Math.hypot(dx, dy).toFixed(3), ang: +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(3), stamina: +(s0 - A.H.stamina).toFixed(3) }); return; }
      k++; requestAnimationFrame(step); };
    requestAnimationFrame(step); }), [codes, n]);
  await P.evaluate(() => __clock.thaw());
  return r;
}
const SEQ = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyC', 'KeyF', 'KeyF', 'KeyN', 'KeyB', 'KeyZ', 'KeyM', 'Tab', 'Tab'];
async function keySequence(P) {
  await P.evaluate(() => { __kA.length = 0; __kB.length = 0; const a = document.activeElement; if (a && a.blur) a.blur(); });
  const st0 = await P.evaluate(() => ({ light: __api.lightOn(), inv: !!(window.__inv && __inv.open) }));
  const mid = [];
  // each key is held for three frames, so a game tick always sees it (a press shorter than a frame can fall between ticks)
  for (const c of SEQ) { await P.keyboard.down(c); await U.frames(P, 3); await P.keyboard.up(c); await sleep(80); if (c === 'Tab') mid.push(await P.evaluate(() => !!(window.__inv && __inv.open))); }
  const st1 = await P.evaluate(() => ({ light: __api.lightOn(), inv: !!(window.__inv && __inv.open), started: __api.started(), paused: __api.paused() }));
  return { A: await P.evaluate(() => __kA.slice()), B: await P.evaluate(() => __kB.slice()), st0, st1, invAfterEachTab: mid };
}
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    /* ---------- A. the settings migration */
    const OLD = JSON.stringify({ c: '', s: 1, o: 1, keys: true, coords: true, title: true, auto: true, vol: .8, rm: 'auto' });
    const cases = [['a save from before QA1 (coordinates on, the old default)', OLD], ['a QA1 save with coordinates switched on', JSON.stringify({ c: '', s: 1, o: 1, keys: true, coords: true, title: false, auto: true, vol: 1, rm: 'auto', v: 2 })], ['no save', null]];
    const mig = [];
    for (const [name, v] of cases) {
      const s = await U.page(b, PORT, { viewport: { width: 800, height: 600 }, storage: v ? { fb_settings_v1: v } : null });
      mig.push(Object.assign({ name }, await s.P.evaluate(() => ({ get: __settings.get(), stored: JSON.parse(localStorage.getItem('fb_settings_v1') || 'null'), nocoords: document.body.classList.contains('hud-nocoords') }))));
      R.errors.push(...s.errs.map(e => 'migration: ' + e)); await s.ctx.close();
    }
    R.notes.migration = mig;
    check('fb_settings_v1 migration: an old save keeps its choices (volume 0.8, title, keys) but loses the old coordinates default and is written back as v2; a v2 save with coordinates on keeps them (and its title off); no save: coordinates off',
      mig[0].get.coords === false && mig[0].get.vol === .8 && mig[0].get.title === true && mig[0].get.keys === true && mig[0].stored && mig[0].stored.v === 2 && mig[0].stored.coords === false && mig[0].nocoords
      && mig[1].get.coords === true && mig[1].get.title === false && !mig[1].nocoords && mig[2].get.coords === false && mig[2].nocoords, mig.map(m => [m.name, m.get.coords, m.get.title, m.get.vol, m.stored && m.stored.v]));

    /* ---------- B. the HUD in play */
    { const s = await U.page(b, PORT, { viewport: { width: 1280, height: 720 } }), P = s.P;
      await playing(P, 'Probe');
      const at = await P.evaluate(OPEN); await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' });
      // the run-start reveal: replay it exactly as a run begins (the HUD appears), then read it
      await P.evaluate(() => { document.getElementById('hud').hidden = true; }); await sleep(200); await P.evaluate(() => { document.getElementById('hud').hidden = false; }); await sleep(1300);
      const rv1 = await P.evaluate(() => __ui.reveal());
      await sleep(6000); const rv2 = await P.evaluate(() => __ui.reveal());
      check('as a run begins: THRESHOLD / LEVEL 0, the objective and a line of the player\'s keys appear, then fade away (gone after about 6 s)',
        rv1.shown && /entry/.test(rv1.kind) && rv1.eye === 'Threshold' && rv1.title === 'Level 0' && /glitched wall/i.test(rv1.sub) && /W A S D move/.test(rv1.keys) && !rv2.shown, { rv1, rv2 });
      // calm play: almost only the world
      const calm = await P.evaluate(() => { const shownEl = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); let o = 1; for (let x = e; x && x !== document.body; x = x.parentElement) o *= +getComputedStyle(x).opacity; return e.getClientRects().length > 0 && cs.visibility !== 'hidden' && o > .05; };
        const r = {}; for (const s of ['#nameplate', '#pace', '#lightStatus', '#hud .keyline', '.hud-obj', '.location', '#net', '#sound', '.coordinates', '#hud .staminaHud', '#hudHealth', '#hudReveal', '#hudPause']) r[s] = shownEl(s); return r; });
      check('calm play shows almost only the world: no name, pace, light state, controls strip, objective, LEVEL 0 / sector, connection line, sound button, coordinates, stamina or health; PAUSE stays',
        Object.entries(calm).every(([k, v]) => k === '#hudPause' ? v === true : v === false), calm);
      // stamina: appears while it changes, fades once full
      await P.keyboard.down('ShiftLeft'); await P.keyboard.down('KeyD'); await sleep(900);
      const st1 = await P.evaluate(() => ({ on: document.body.classList.contains('stam-on'), stamina: Math.round(__api.H.stamina) }));
      await P.keyboard.up('KeyD'); await P.keyboard.up('ShiftLeft');
      let st2 = null; for (let i = 0; i < 80; i++) { st2 = await P.evaluate(() => ({ on: document.body.classList.contains('stam-on'), stamina: Math.round(__api.H.stamina) })); if (st2.stamina >= 100 && !st2.on) break; await sleep(250); }
      check('stamina appears as soon as it is spent and stays while it recovers; once full it fades (the game\'s own value)', st1.on && st1.stamina < 100 && st2.stamina >= 100 && !st2.on, { st1, st2 });
      // a sector reveal on a real change of sector (the game's own names); none for where the run started
      const tgt = await P.evaluate(() => { const A = __api, here = document.getElementById('sector').textContent.trim();
        for (const e of A.Oc) { const name = `${e.code} / ${e.name}`; if (name === here) continue; for (let k = 0; k < 40; k++) { const x = (e.x + .5 + (k % 7) / 7 * (e.w - 1)) * 96, y = (e.y + .5 + Math.floor(k / 7) / 6 * (e.h - 1)) * 96; if (A.sl(x, y, 26)) return { x, y, name }; } } return null; });
      await P.evaluate(([x, y]) => __api.tp(x, y), [tgt.x, tgt.y]); await sleep(600);
      const sv0 = await P.evaluate(() => __ui.reveal()); await sleep(1700);
      const sv1 = await P.evaluate(() => __ui.reveal()); await sleep(5200);
      const sv2 = await P.evaluate(() => __ui.reveal());
      check('walking into another part of the level reveals its own name ("code / name"), only after it has held for a moment, then fades',
        !sv0.shown && sv1.shown && /sector/.test(sv1.kind) && sv1.title === tgt.name && sv1.eye === 'Level 0' && !sv2.shown, { target: tgt.name, sv0: sv0.shown, sv1: [sv1.kind, sv1.title], sv2: sv2.shown });
      // the dormant health slot: hidden through a run; the hook shows it only for a real value
      const hp = await P.evaluate(() => { const e = document.getElementById('hudHealth'), r = [e.hidden]; __hud.health(40); r.push(e.hidden, e.dataset.lv, document.getElementById('hudHealthFill').style.width); __hud.health(null); r.push(e.hidden); return r; });
      check('the health slot is dormant (hidden; the game has no health); its hook shows a real value and hides again on null', hp[0] === true && hp[1] === false && hp[2] === 'mid' && hp[3] === '40%' && hp[4] === true, hp);
      // the pause keeps the objective; its controls list follows the bindings
      await P.keyboard.press('Escape'); await sleep(700);
      const pz = await P.evaluate(() => ({ st: __ui.state(), obj: document.getElementById('pzObjective').textContent, move: document.querySelector('#dialog .controlRows p b').textContent, net: getComputedStyle(document.getElementById('net')).display }));
      check('the pause screen keeps what left the HUD: the objective and the connection line; its controls list names the player\'s keys', pz.st === 'paused' && /GLITCHED WALL/i.test(pz.obj) && /^W A S D/.test(pz.move) && pz.net !== 'none', pz);
      await P.keyboard.press('Escape'); await sleep(400);
      R.errors.push(...s.errs.map(e => 'hud: ' + e)); await s.ctx.close(); }

    /* ---------- C. default bindings: exactly the first candidate's input */
    const runDefaults = async (game, port, label) => {
      const srv2 = game === GAME ? null : await U.serve(game, port), p = game === GAME ? PORT : port;
      const s = await U.page(b, p, { viewport: { width: 640, height: 360 }, init: LOG }), P = s.P;
      await playing(P, label);
      const at = await P.evaluate(OPEN);
      await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(400);
      const w1 = await walkExact(P, ['KeyD'], 54);
      await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(400);
      const w2 = await walkExact(P, ['ShiftLeft', 'KeyW', 'KeyD'], 54);
      await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(400);
      const w3 = await walkExact(P, ['KeyC', 'KeyA'], 40);
      await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(400);
      const seq = await keySequence(P);
      const errs = s.errs.slice(); await s.ctx.close(); if (srv2) srv2.kill();
      return { seq, w1, w2, w3, errs, isQa1: game === GAME };
    };
    const dq = await runDefaults(GAME, PORT, 'Defaults');
    R.notes.defaultsQa1 = dq;
    const trusted = l => l.every(x => !/synthetic/.test(x));
    check('QA1 with the default bindings: every key press reaches the page untouched (trusted, once, the same code), nothing is held back at the window; light, inventory and the rest respond',
      trusted(dq.seq.A) && trusted(dq.seq.B) && dq.seq.A.length === SEQ.length * 2 && dq.seq.B.join() === dq.seq.A.filter(x => x !== 'd:Tab').join() && dq.seq.st1.light === dq.seq.st0.light && dq.seq.invAfterEachTab.join() === 'true,false' && dq.seq.st1.started && !dq.seq.st1.paused,
      { windowEvents: dq.seq.A.length, documentEvents: dq.seq.B.length, st0: dq.seq.st0, st1: dq.seq.st1, inv: dq.seq.invAfterEachTab });
    if (FIRST) {
      const df = await runDefaults(FIRST, PORT + 1, 'First');
      R.notes.defaultsFirst = df;
      const near = (a, c, t) => Math.abs(a - c) <= t;
      const same = (x, y) => Math.abs(x.dx - y.dx) <= .5 && Math.abs(x.dy - y.dy) <= .5 && Math.abs(x.stamina - y.stamina) <= .01;
      check('default bindings against the first candidate: the same key events at the window and at the document, the same light / inventory results, and frame for frame the same walk, sprint (with its stamina) and crouch-walk (54 / 54 / 40 game ticks)',
        df.seq.A.join() === dq.seq.A.join() && df.seq.B.join() === dq.seq.B.join() && df.seq.invAfterEachTab.join() === dq.seq.invAfterEachTab.join() && df.seq.st1.light === dq.seq.st1.light
        && same(dq.w1, df.w1) && same(dq.w2, df.w2) && same(dq.w3, df.w3) && dq.w1.dist > 60 && dq.w2.stamina > 0,
        { qa1: { w1: dq.w1, w2: dq.w2, w3: dq.w3 }, first: { w1: df.w1, w2: df.w2, w3: df.w3 }, sameEvents: df.seq.A.join() === dq.seq.A.join() && df.seq.B.join() === dq.seq.B.join() });
      R.errors.push(...df.errs.map(e => 'first: ' + e));
    }
    R.errors.push(...dq.errs.map(e => 'defaults: ' + e));

    /* ---------- D. rebinding through Settings > Controls */
    { const s = await U.page(b, PORT, { viewport: { width: 1280, height: 720 }, init: LOG }), P = s.P;
      await playing(P, 'Rebind');
      const at = await P.evaluate(OPEN); await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(300);
      const wW0 = await walkExact(P, ['KeyW'], 40);
      await P.keyboard.press('Escape'); await sleep(500); await P.click('#pzKeys'); await sleep(800);
      const slot = (a, i) => `.kb-slot[data-a="${a}"][data-i="${i}"]`;
      // move up -> I; W then held while capturing never moves the wanderer
      await P.click(slot('up', 0)); await sleep(150);
      const cap = await P.evaluate(() => document.querySelector('.kb-slot.cap') && document.querySelector('.kb-slot.cap').textContent);
      await P.keyboard.press('KeyI'); await sleep(200);
      const b1 = await P.evaluate(() => ({ up: __keys.bindings().up, stored: JSON.parse(localStorage.getItem('tfb.keys.v1') || 'null'), msg: document.getElementById('kbMsg').textContent }));
      // refused keys: the admin key; Esc cancels a capture
      await P.click(slot('light', 1)); await sleep(150); await P.keyboard.press('Backquote'); await sleep(150);
      const ref = await P.evaluate(() => ({ msg: document.getElementById('kbMsg').textContent, capturing: !!document.querySelector('.kb-slot.cap') }));
      await P.keyboard.press('Escape'); await sleep(200);
      const esc1 = await P.evaluate(() => ({ capturing: !!document.querySelector('.kb-slot.cap'), sheet: !!document.querySelector('#uiSettings.in'), light: __keys.bindings().light }));
      check('Settings > Controls: a slot waits for a key ("Press a key"), takes it (Move up = I, saved), refuses a key kept for the game or the browser, and Esc cancels a capture without closing Settings',
        cap === 'Press a key' && b1.up[0] === 'KeyI' && b1.stored && b1.stored.b.up[0] === 'KeyI' && /Move up: I/.test(b1.msg) && /kept for/.test(ref.msg) && ref.capturing && !esc1.capturing && esc1.sheet && esc1.light[1] === null, { cap, b1, ref, esc1 });
      // a conflict: light first key -> I (already Move up): nothing changes until Swap
      await P.click(slot('light', 0)); await sleep(150); await P.keyboard.press('KeyI'); await sleep(200);
      const c1 = await P.evaluate(() => ({ msg: document.getElementById('kbMsg').textContent, swap: !!document.querySelector('#kbMsg [data-kb=swap]'), up: __keys.bindings().up[0], light: __keys.bindings().light[0] }));
      await P.click('#kbMsg [data-kb=swap]'); await sleep(200);
      const c2 = await P.evaluate(() => ({ up: __keys.bindings().up[0], light: __keys.bindings().light[0] }));
      check('a key already used elsewhere is shown as a conflict and nothing changes until it is resolved; Swap exchanges the two keys',
        /already used for Move up/.test(c1.msg) && c1.swap && c1.up === 'KeyI' && c1.light === 'KeyF' && c2.up === 'KeyF' && c2.light === 'KeyI', { c1, c2 });
      // inventory -> Q
      await P.click(slot('inventory', 0)); await sleep(150); await P.keyboard.press('KeyQ'); await sleep(200);
      // the labels follow everywhere
      const lab = await P.evaluate(() => ({ pause: [...document.querySelectorAll('#dialog .controlRows p b')].map(x => x.textContent).slice(0, 1).concat([...document.querySelectorAll('#dialog .controlRows p')].filter(p => /Inventory|Toggle light/.test(p.textContent)).map(p => p.textContent)),
        note: document.getElementById('mmNote').textContent, cam: document.getElementById('camHint').textContent, inv: __keys.label('inventory') }));
      check('every key label follows the bindings: the pause list, the menu\'s entry note, the camcorder\'s viewfinder line',
        /^F A S D/.test(lab.pause[0]) && lab.pause.some(x => /Inventory\s*Q/.test(x)) && lab.pause.some(x => /Toggle light.*I/.test(x)) && /Move with F A S D/.test(lab.note) && /I · LOWER/.test(lab.cam) && lab.inv === 'Q', lab);
      // play with the new keys
      await P.keyboard.press('Escape'); await sleep(400); await P.keyboard.press('Escape'); await sleep(600);
      const live = await P.evaluate(() => __ui.state());
      await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(300);
      const wF = await walkExact(P, ['KeyF'], 40);
      await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(300);
      const wW = await walkExact(P, ['KeyW'], 40);
      await H.place(P, at[0], at[1], 0, { light: true, kind: 'flashlight' }); await sleep(300);
      const wArrow = await walkExact(P, ['ArrowUp'], 40);
      const l0 = await P.evaluate(() => __api.lightOn()); await P.keyboard.press('KeyI'); await sleep(250); const l1 = await P.evaluate(() => __api.lightOn());
      await P.keyboard.press('KeyQ'); await sleep(300); const inv1 = await P.evaluate(() => !!__inv.open);
      await P.keyboard.press('KeyQ'); await sleep(300);
      await P.evaluate(() => { __kA.length = 0; __kB.length = 0; }); await P.keyboard.press('Tab'); await sleep(300);
      const tab = await P.evaluate(() => ({ inv: !!__inv.open, focus: document.activeElement && document.activeElement.tagName, B: __kB.slice() }));
      await P.keyboard.press('Escape'); await sleep(500); const paused = await P.evaluate(() => __api.paused());
      check('in play with the new keys (40 game ticks each, frame for frame): F (now Move up) walks up exactly as W did, W does nothing, the arrow still walks up; I toggles the light; Q opens and closes the inventory; Tab is held back (no inventory, no focus jump); Esc still pauses',
        live === 'playing' && wF.dy < -60 && Math.abs(wF.dx - wW0.dx) <= .5 && Math.abs(wF.dy - wW0.dy) <= .5 && wW.dist < .5 && Math.abs(wArrow.dy - wW0.dy) <= .5 && l1 === !l0 && inv1 === true && tab.inv === false && !tab.B.length && paused,
        { wW0, wF, wW, wArrow, light: [l0, l1], inv1, tab, paused });
      // persistence across a reload, then reset to defaults
      await P.reload(); await P.waitForFunction(() => !!(window.__api && window.__api.H && window.__keys), null, { timeout: 90000 }); await sleep(1200);
      const kept = await P.evaluate(() => __keys.bindings());
      await P.evaluate(() => __ui.go('controls')); await sleep(700); await P.click('#kbReset'); await sleep(300);
      const reset = await P.evaluate(() => ({ b: __keys.bindings(), def: __keys.isDefault(), stored: localStorage.getItem('tfb.keys.v1'), cam: document.getElementById('camHint').textContent }));
      check('the bindings survive a reload; Reset controls to defaults restores every default (and clears the save)',
        kept.up[0] === 'KeyF' && kept.light[0] === 'KeyI' && kept.inventory[0] === 'KeyQ' && reset.def && reset.stored === null && reset.b.up[0] === 'KeyW' && reset.b.light[0] === 'KeyF' && reset.b.inventory[0] === 'Tab' && /^N · NIGHT VISION/.test(reset.cam), { kept, reset });
      R.errors.push(...s.errs.map(e => 'rebind: ' + e)); await s.ctx.close(); }
    // a damaged save never double-binds a key
    { const s = await U.page(b, PORT, { viewport: { width: 800, height: 600 }, storage: { 'tfb.keys.v1': JSON.stringify({ v: 1, b: { up: ['KeyF', 'ArrowUp'], light: ['KeyF', null] } }) } });
      const d = await s.P.evaluate(() => ({ def: __keys.isDefault(), up: __keys.bindings().up, light: __keys.bindings().light }));
      check('a save that would put one key on two actions is not trusted: the defaults are used', d.def && d.up[0] === 'KeyW' && d.light[0] === 'KeyF', d);
      R.errors.push(...s.errs.map(e => 'damaged: ' + e)); await s.ctx.close(); }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
