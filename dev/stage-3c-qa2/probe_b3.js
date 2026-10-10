/* Stage 3C QA2, QA2-3 - the menu and its music start together; a run starts behind a black curtain (development only; never served).
 *
 *   node dev/stage-3c-qa2/probe_b3.js [--game DIR] [--port 9831] [--out FILE.json] [--shots DIR]
 *
 * Chromium as installed (its autoplay policy wants a gesture before sound) and Chromium told sound may start
 * (--autoplay-policy=no-user-gesture-required) stand for the two kinds of browser. The page is read through CDP Runtime.evaluate
 * without a user gesture until the gate is passed (Playwright's own evaluate would grant one); the gate is passed only by real
 * input (a key, a mouse click, a touch tap), as a player would.
 *  - the ready gate: everything is ready (the music downloaded and decoded) but the browser wants a gesture: the screen is black
 *    but for one line, the menu is hidden, nothing plays, the game's own audio graph does not exist; system keys pass it by;
 *  - the first key / click / tap starts the music and reveals the menu in the same step; the press never reaches the menu or the
 *    game (a click or tap where PLAY is does not open PLAY's entry), with reduced motion too;
 *  - where sound may start, the menu and the music start together with no gate at all; a second visit reads the music from Cache
 *    Storage;
 *  - Intro -> Loop is sample-accurate (offline render through the player's own scheduling, as in QA1);
 *  - the menu's pages do not restart it; SOUND and the master volume control it; a hidden tab is silent and carries on;
 *  - ENTER LEVEL 0: a 1 s fade of the music; the screen goes from the menu to black to the world (recorded frame by frame), the
 *    game's audio graph starts only now; END: the black menu and the Intro again;
 *  - the music failing (missing, or arriving short) is the boot's error with RETRY; a slow first download says how much has
 *    arrived (real bytes); a browser without Web Audio gets the menu at once, silent;
 *  - a run started by a script before the reveal (as older test harnesses do) is not covered by the boot layer or a gate.
 * Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { spawnSync } = require('child_process');
const Q = require('./qa2_lib.js'); const { sleep } = Q;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', path.join(__dirname, '..', '..'))), PORT = +opt('port', 9831), OUT = opt('out', null);
const SHOTS = path.resolve(opt('shots', path.join(__dirname, 'evidence', 'q3')));
const FR = fs.mkdtempSync(path.join(os.tmpdir(), 'qa2b3-'));
const INTRO = 1357824, LOOP = 2416640, SR = 44100;
const R = { game: GAME, checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 700) : '')); };
const py = (script, args) => { const r = spawnSync('python3', ['-I', path.join(__dirname, script)].concat(args), { encoding: 'utf8', timeout: 180000 }); try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { return { error: (r.stderr || r.stdout || '').slice(0, 400) }; } };
const errs = (s, tag) => R.errors.push(...s.errs.map(e => tag + ': ' + e));
const TH = `(() => { const i = __ui.theme.info(); delete i.files; return i; })()`;
const KEYS = () => { window.__keysSeen = []; document.addEventListener('keydown', e => window.__keysSeen.push(e.key)); };
const SNAP = `(() => { const b = document.getElementById('boot'), g = document.getElementById('bootGo'), m = document.getElementById('menu'), gr = g.getBoundingClientRect(), A = window.__api;
  return { st: __boot.state(), tl: __boot.info().timeline, boot: __ui.boot(), th: ${TH}, html: document.documentElement.className, bootCls: b.className, bootShown: !b.hidden,
    bootOpacity: getComputedStyle(b).opacity, bootTransition: getComputedStyle(b).transitionDuration, bootPointer: getComputedStyle(b).pointerEvents,
    go: g.hidden ? null : g.textContent, goVis: getComputedStyle(g).visibility, goBox: [gr.left, gr.top, gr.right, gr.bottom], msgShown: getComputedStyle(document.getElementById('bootMsg')).display !== 'none',
    menuVis: getComputedStyle(m).visibility, menuHidden: m.hidden, ui: __ui.state(), entry: __ui.entryOpen(), started: !!(A && A.started && A.started()),
    gameAudio: !!(A && A.audio && A.audio() && A.audio().context), keysSeen: (window.__keysSeen || []).slice() }; })()`;
const PLAY_AT = `(() => { const r = document.getElementById('mmPlay').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`;
const PARTS = () => {
  const out = []; const add = (sel, m = 6) => document.querySelectorAll(sel).forEach(e => { if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return; const b = e.getBoundingClientRect(); out.push([b.left - m, b.top - m, b.right + m, b.bottom + m]); });
  ['#mmTitle', '#menu .mm-rail', '#menu .mm-util', '#menu .mm-stage', '#menu .mm-foot', '#mmEntry'].forEach(s => add(s));
  return out;
};
const schedOk = th => th.t0 !== null && Math.abs((th.loopAt - th.t0) * th.sampleRate - INTRO) < 1e-6 && Math.abs(th.t0 * th.sampleRate - Math.round(th.t0 * th.sampleRate)) < 1e-6;
async function waitGate(s, ms = 90000) {
  await Q.bootState(s, ['ready', 'menu'], ms);
  const t0 = Date.now(); let g = null;
  while (Date.now() - t0 < 15000) { g = await s.ev(SNAP); if (g && g.boot && (g.boot.gate || g.st !== 'ready')) break; await sleep(100); }
  return g;
}
/* the screen, frame by frame, around one action (Chromium's screencast); classified by transition_sheet.py */
async function recordAround(s, tag, title, act, ms) {
  const frames = []; let t0 = 0, n = 0, on = true;
  const h = async f => { try { await s.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) { } if (!on) return;
    const t = t0 ? Math.round(f.metadata.timestamp * 1000 - t0) : -1, file = `${tag}_${String(n++).padStart(4, '0')}.jpg`;
    fs.writeFileSync(path.join(FR, file), Buffer.from(f.data, 'base64')); frames.push({ file, t }); };
  s.cdp.on('Page.screencastFrame', h);
  const vp = s.P.viewportSize();
  await s.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
  await sleep(700);
  t0 = Date.now(); await act(); await sleep(ms);
  on = false; await s.cdp.send('Page.stopScreencast').catch(() => { }); s.cdp.off('Page.screencastFrame', h);
  fs.writeFileSync(path.join(FR, tag + '.json'), JSON.stringify({ frames }));
  const sum = py('transition_sheet.py', [FR, tag, '--title', title]);
  const f = path.join(FR, tag + '_sheet.jpg'); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(SHOTS, `b3_${tag}_sheet.jpg`));
  return sum;
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await Q.serve(GAME, PORT), bG = await Q.browser(), bA = await Q.browser({ autoplay: true });
  try {
    /* ---------- A. the ready gate (a browser that wants a gesture), passed by a key; then the whole menu-music life */
    { const wav = [];
      const s = await Q.page(bG, PORT, { viewport: { width: 1280, height: 720 }, gate: false, init: KEYS, route: ['**/MainTheme_*', r => { wav.push([Date.now(), new URL(r.request().url()).pathname + new URL(r.request().url()).search]); r.continue(); }] });
      const P = s.P;
      const g = await waitGate(s);
      const shot = path.join(SHOTS, 'b3_gate_1280x720.png'); await P.screenshot({ path: shot, timeout: 90000 });
      const field = py('black_field.py', [shot, JSON.stringify([[g.goBox[0] - 12, g.goBox[1] - 12, g.goBox[2] + 12, g.goBox[3] + 12]]), '--limit', '10']);
      const whole = py('black_field.py', [shot, '[]', '--limit', '24']);
      const wavAtGate = wav.length;
      check('a browser that wants a gesture: the ready gate is black but for one line ("Press any key or click to enter"); the menu is still hidden; the music is already downloaded and decoded (Intro 1357824 + Loop 2416640 frames, 44.1 kHz, both requested once, before the gate) but has not begun, its context suspended; the game\'s own audio graph does not exist',
        g && g.st === 'ready' && g.boot.gate && g.go === 'Press any key or click to enter' && !g.msgShown && /tfb-boot/.test(g.html) && g.menuVis === 'hidden' && g.th.state === 'ready'
        && g.th.introFrames === INTRO && g.th.loopFrames === LOOP && g.th.introRate === SR && !g.th.begun && g.th.ctx === 'suspended' && g.th.plays === 0 && g.th.sources === 0
        && g.th.preparedAt <= g.tl.ready && !g.gameAudio && field.shareAboveLimit === 0 && whole.shareAboveLimit < .01 && wavAtGate === 2 && wav.every(([, u]) => /MainTheme_Menu(Intro|Loop)\.wav\?v=/.test(u)),
        g && { st: g.st, gate: g.boot.gate, go: g.go, menuVis: g.menuVis, theme: { state: g.th.state, ctx: g.th.ctx, begun: g.th.begun, preparedAt: g.th.preparedAt, fetched: g.th.fetched }, timeline: g.tl, gameAudio: g.gameAudio, field, whole, wav: wav.map(w => w[1]) });
      R.notes.gate = g && { timeline: g.tl, boot: g.boot, theme: g.th };
      for (const k of ['Escape', 'Shift', 'Tab', 'Control']) { await P.keyboard.press(k); await sleep(200); }
      const g2 = await s.ev(SNAP);
      check('Escape, Shift, Tab and Control do not pass the gate (system and browser keys pass by)', g2 && g2.st === 'ready' && !g2.th.begun && !g2.boot.passedBy && g2.bootShown, g2 && { st: g2.st, passedBy: g2.boot.passedBy, keys: g2.keysSeen });
      await P.keyboard.press('KeyA'); await Q.bootState(s, 'menu', 8000); await sleep(1500);
      const p = await s.ev(SNAP);
      check('the first real key (A) starts the music and reveals the menu in the same step: the reveal, the music\'s start and the key are one moment; the Intro is scheduled 60 ms into its context and the Loop exactly one Intro later (on a sample frame, looping its whole buffer); the key never reaches the menu or the game',
        p && p.st === 'menu' && p.boot.passedBy === 'keydown:a' && p.tl.menu - p.boot.passedAt >= 0 && p.tl.menu - p.boot.passedAt <= 50 && p.th.beganAt - p.boot.passedAt >= 0 && p.th.beganAt <= p.tl.menu && p.th.state === 'playing' && p.th.ctx === 'running'
        && p.th.plays === 1 && p.th.sources === 2 && schedOk(p.th) && p.th.loopSourceLoops === true && p.th.loopSourceLoopStart === 0 && p.th.loopSourceLoopEnd === 0 && p.th.now > p.th.t0
        && !p.keysSeen.includes('a') && p.keysSeen.includes('Escape') && p.ui === 'menu' && !p.entry && !p.started && !p.gameAudio && !p.bootShown && !/tfb-boot/.test(p.html),
        p && { st: p.st, passedBy: p.boot.passedBy, passedAt: p.boot.passedAt, menuAt: p.tl.menu, beganAt: p.th.beganAt, t0: p.th.t0, loopAt: p.th.loopAt, now: p.th.now, ctx: p.th.ctx, keys: p.keysSeen, entry: p.entry, gameAudio: p.gameAudio });
      R.notes.afterKey = p && { timeline: p.tl, boot: p.boot, theme: p.th };
      // SOUND and the master volume (the game's own flag, from the rail); the menu's pages do not restart it
      await sleep(300); const g0 = (await s.ev(TH)).gain;
      await P.evaluate(() => __settings.set('vol', .5)); await sleep(500); const g1 = (await s.ev(TH)).gain;
      await P.click('#mmSound'); await sleep(500); const g2s = await P.evaluate(() => ({ g: __ui.theme.info().gain, muted: __api.audio().muted }));
      await P.click('#mmSound'); await sleep(500); const g3 = (await s.ev(TH)).gain;
      await P.evaluate(() => __settings.set('vol', 1)); await sleep(500); const g4 = (await s.ev(TH)).gain;
      check('SOUND and the master volume control it: 0.7 x volume, SOUND OFF -> 0, back on -> the level again',
        Math.abs(g0 - .7) < .01 && Math.abs(g1 - .35) < .01 && g2s.g < .005 && g2s.muted === true && Math.abs(g3 - .35) < .01 && Math.abs(g4 - .7) < .01, { g0, g1, g2: g2s, g3, g4 });
      const c0 = await s.ev(TH);
      for (const sel of ['.mm-row [data-go="settings"]', '.mm-row [data-go="credits"]', '.mm-util [data-go="help"]']) { await P.click(sel); await sleep(700); await P.keyboard.press('Escape'); await sleep(500); }
      await P.click('#mmPlay'); await sleep(400); await P.keyboard.press('Escape'); await sleep(300);
      await P.click('.mm-row [data-go="customize"]'); await sleep(1200); const inCz = await P.evaluate(() => __ui.state()); await P.keyboard.press('Escape'); await sleep(800);
      const c1 = await s.ev(TH);
      check('the music plays on through Settings, Credits, Help, PLAY\'s entry and Customize (the same start, no restart, its clock running)',
        inCz === 'customize' && c1.state === 'playing' && c1.plays === c0.plays && c1.t0 === c0.t0 && c1.ctx === 'running' && c1.now > c0.now + 3, { inCz, c0: [c0.plays, c0.t0, c0.now], c1: [c1.plays, c1.t0, c1.now, c1.state] });
      // a hidden tab (document.hidden and its event, simulated in the page): silent, then it carries on where it was
      const hv = await P.evaluate(async () => { const c = () => { const i = __ui.theme.info(); return [i.ctx, i.t0, i.plays]; }; const a = c();
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 500)); const h = c();
        delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 700)); return { a, h, v: c() }; });
      check('a hidden tab is silent (its context suspended) and the music carries on where it was when the tab shows again (no restart)',
        hv.h[0] === 'suspended' && hv.v[0] === 'running' && hv.v[1] === hv.a[1] && hv.v[2] === hv.a[2], hv);
      // ENTER LEVEL 0: the music fades over 1 s; menu -> black -> world, frame by frame; the game's audio graph starts now
      await P.click('#mmPlay'); await sleep(700);
      const before = await s.ev(SNAP);
      let states = null;
      const tr = await recordAround(s, 'enter', 'ENTER LEVEL 0: frames where the picture changed (ms since the click, class, share not black)', async () => {
        await P.click('#enter');
        // the boot layer's state, sampled until the curtain has lifted (at most 20 s)
        states = []; const w0 = Date.now(); while (Date.now() - w0 < 20000) { const v = await s.ev(`[__boot.state(), document.getElementById('boot').className, !document.getElementById('boot').hidden, getComputedStyle(document.getElementById('boot')).pointerEvents, document.getElementById('menu').hidden]`); states.push([Date.now() - w0].concat(v || [])); if (v && v[0] === 'playing' && !v[2]) break; await sleep(60); }
      }, 1500);
      await sleep(600);
      const e1 = await s.ev(SNAP);
      const seq = (tr.sequence || []).map(x => x.cls), firstOther = seq.find(c => c !== 'before');
      const afterBlack = seq.slice(seq.indexOf('black') + 1);
      check('ENTER LEVEL 0 from the menu passes through black: on screen the menu, then black (the curtain: no logo, no menu, no half-made frame), then the world fading in; the curtain never takes the pointer',
        tr.sequence && firstOther === 'black' && seq.includes('black') && !afterBlack.includes('before') && seq[seq.length - 1] === 'lit' && states && states.some(x => x[1] === 'run' && /curtain/.test(x[2]) && x[3] && x[4] === 'none' && x[5] === true)
        && e1.st === 'playing' && !e1.bootShown && e1.started && e1.menuHidden,
        { sequence: tr.sequence, states: states && states.filter((x, i, a) => i === 0 || x[1] !== a[i - 1][1] || x[2] !== a[i - 1][2]), after: e1 && { st: e1.st, bootShown: e1.bootShown, started: e1.started } });
      R.notes.enterFrames = tr;
      check('the music fades out over 1 s at ENTER (a linear ramp from its level, then its sources stop and its context is suspended); the game\'s own audio graph exists only now (no menu music and halls together)',
        before.th.state === 'playing' && !before.gameAudio && e1.th.state === 'stopped' && e1.th.sources === 0 && e1.th.ctx === 'suspended' && Math.abs(e1.th.fadeEnd - e1.th.fadeAt - 1) < 1e-6 && e1.gameAudio,
        { before: [before.th.state, before.gameAudio], after: { state: e1.th.state, ctx: e1.th.ctx, sources: e1.th.sources, fade: [e1.th.fadeAt, e1.th.fadeEnd], gameAudio: e1.gameAudio } });
      // END: the black menu, and the music from the Intro again
      await P.keyboard.press('Escape'); await sleep(500); await P.click('#reset'); await P.waitForFunction(() => __ui.state() === 'run', null, { timeout: 15000 }).catch(() => { });
      const mid = await s.ev(TH);
      await P.click('#runEnd'); await sleep(1500);
      const back = await s.ev(SNAP);
      const endShot = path.join(SHOTS, 'b3_after_end_1280x720.png'); await P.screenshot({ path: endShot, timeout: 90000 });
      const endField = py('black_field.py', [endShot, JSON.stringify(await P.evaluate(PARTS)), '--limit', '10']);
      check('END: the black menu comes back (no world behind it) and the music starts again from the Intro (a new start, both sources, no download)',
        mid.state === 'stopped' && back.st === 'menu' && back.ui === 'menu' && /tfb-black/.test(back.html) && endField.shareAboveLimit === 0 && back.th.state === 'playing' && back.th.plays === 2 && back.th.t0 > e1.th.fadeAt
        && back.th.sources === 2 && back.th.ctx === 'running' && schedOk(back.th) && back.th.fetched === 2 && wav.length === 2,
        { mid: mid.state, st: back.st, html: back.html, endField, theme: { state: back.th.state, plays: back.th.plays, t0: back.th.t0, ctx: back.th.ctx, fetched: back.th.fetched }, wav: wav.length });
      errs(s, 'gate-key'); await s.ctx.close(); }

    /* ---------- B. the gate passed by a mouse click where PLAY is: the click enters, nothing else (normal and reduced motion) */
    for (const reduced of [false, true]) {
      const s = await Q.page(bG, PORT, { viewport: { width: 1366, height: 768 }, gate: false, reduced });
      const g = await waitGate(s); const at = await s.ev(PLAY_AT);
      await sleep(900); const goOpacity = await s.ev(`getComputedStyle(document.getElementById('bootGo')).opacity`);
      await s.P.mouse.click(at[0], at[1]);
      await sleep(40); const right = await s.ev(SNAP);
      await sleep(1600); const p = await s.ev(SNAP);
      check(`${reduced ? 'reduced motion: ' : ''}the gate's line is shown (fully opaque); a mouse click on the gate, right where PLAY is, starts the music and reveals the menu together - the line goes at once and the black fades - and does nothing else (PLAY\'s entry stays closed${reduced ? '; the boot layer is gone at once, no fade' : ''})`,
        g && g.boot.gate && goOpacity === '1' && p && p.st === 'menu' && p.boot.passedBy === 'pointerdown:mouse' && p.th.beganAt >= p.boot.passedAt && p.th.beganAt <= p.tl.menu && p.tl.menu - p.boot.passedAt <= 50 && p.th.state === 'playing' && p.th.ctx === 'running' && !p.entry && !p.started && !p.bootShown
        && right && (right.goVis === 'hidden' || right.go === null) && (!reduced || (right.bootOpacity === '0' && parseFloat(right.bootTransition) <= .01)),
        p && { goOpacity, passedBy: p.boot.passedBy, theme: [p.th.state, p.th.ctx], entry: p.entry, right: right && [right.st, right.goVis, right.bootOpacity, right.bootTransition, right.bootShown] });
      errs(s, 'gate-click' + (reduced ? '-reduced' : '')); await s.ctx.close();
    }

    /* ---------- C. a phone: the gate says "Tap to enter"; a tap where PLAY is starts the music and reveals the menu, nothing else */
    { const s = await Q.page(bG, PORT, { viewport: { width: 390, height: 844 }, mobile: true, gate: false });
      const g = await waitGate(s);
      const shot = path.join(SHOTS, 'b3_gate_390x844.png'); await s.P.screenshot({ path: shot, timeout: 90000 });
      const field = py('black_field.py', [shot, JSON.stringify([[g.goBox[0] - 12, g.goBox[1] - 12, g.goBox[2] + 12, g.goBox[3] + 12]]), '--limit', '10', '--dpr', '2']);
      const at = await s.ev(PLAY_AT); await s.P.touchscreen.tap(at[0], at[1]); await sleep(1600);
      const p = await s.ev(SNAP);
      check('a phone (390 x 844, touch): the gate reads "Tap to enter" on black; a tap anywhere - here right where PLAY is - starts the music and reveals the menu together, and does nothing else',
        g && g.go === 'Tap to enter' && field.shareAboveLimit === 0 && p && p.st === 'menu' && p.boot.passedBy === 'pointerup:touch' && p.th.state === 'playing' && p.th.ctx === 'running' && !p.entry && !p.started,
        { go: g && g.go, field, passedBy: p && p.boot.passedBy, theme: p && [p.th.state, p.th.ctx], entry: p && p.entry });
      errs(s, 'gate-tap'); await s.ctx.close(); }

    /* ---------- D. a browser that lets sound start: no gate; the menu and the Intro start together; a second visit reads Cache Storage */
    { const wav = [];
      const s = await Q.page(bA, PORT, { viewport: { width: 1280, height: 720 }, gate: false, route: ['**/MainTheme_*', r => { wav.push(r.request().url()); r.continue(); }] });
      await Q.bootState(s, 'menu', 90000); await sleep(1200);
      const p = await s.ev(SNAP);
      check('a browser that lets sound start: no gate at all; at the ready moment the menu is revealed and the Intro begins in the same step (the music decoded before it)',
        p && p.st === 'menu' && p.boot.passedBy === 'allowed' && !p.boot.gate && p.boot.gateShownAt === null && p.boot.allowed === true && p.th.beganAt >= p.boot.passedAt && p.th.beganAt <= p.tl.menu && p.tl.menu - p.boot.passedAt <= 50 && p.th.preparedAt <= p.tl.ready
        && p.th.state === 'playing' && p.th.ctx === 'running' && p.th.plays === 1 && schedOk(p.th) && p.th.fetched === 2 && wav.length === 2,
        p && { timeline: p.tl, boot: p.boot, theme: { state: p.th.state, beganAt: p.th.beganAt, preparedAt: p.th.preparedAt, fetched: p.th.fetched } });
      const cold = p && { ready: p.tl.ready, menu: p.tl.menu, preparedAt: p.th.preparedAt };
      wav.length = 0;
      await s.P.reload({ waitUntil: 'commit' }); await Q.bootState(s, 'menu', 90000); await sleep(1000);
      const w = await s.ev(SNAP);
      check('a second visit reads the music from Cache Storage (no download) and is ready sooner; it still starts with the menu',
        w && w.st === 'menu' && w.th.cacheHits === 2 && w.th.fetched === 0 && !wav.length && w.th.state === 'playing' && w.boot.passedBy === 'allowed' && cold && w.tl.ready < cold.ready,
        { cold, warm: w && { ready: w.tl.ready, menu: w.tl.menu, preparedAt: w.th.preparedAt, cacheHits: w.th.cacheHits, fetched: w.th.fetched }, wav: wav.length });
      R.notes.startTimes = { cold, warm: w && { ready: w.tl.ready, menu: w.tl.menu, preparedAt: w.th.preparedAt } };
      // the seam: an offline render through the player's own scheduling equals Intro then Loop then Loop, sample for sample
      const OFF = await s.P.evaluate(async ({ INTRO, LOOP, SR }) => {
        const get = async u => (await fetch(u)).arrayBuffer();
        const N = INTRO + 2 * LOOP + 6000, oc = new OfflineAudioContext(2, N, SR);
        const [ib, lb] = await Promise.all([oc.decodeAudioData(await get('assets/MainTheme_MenuIntro.wav')), oc.decodeAudioData(await get('assets/MainTheme_MenuLoop.wav'))]);
        __ui.theme._schedule(oc, oc.destination, 0, ib, lb);
        const out = await oc.startRendering(), res = { frames: { intro: ib.length, loop: lb.length }, windows: [] };
        for (const [name, at] of [['intro->loop', INTRO], ['loop seam 1', INTRO + LOOP], ['loop seam 2', INTRO + 2 * LOOP]]) {
          let max = 0, jumpSeam = 0, jumpLocal = 0, n = 0;
          for (let c = 0; c < 2; c++) {
            const o = out.getChannelData(c), I = ib.getChannelData(c), L = lb.getChannelData(c);
            const exp = k => k < INTRO ? I[k] : L[(k - INTRO) % LOOP];
            for (let k = at - 4410; k < at + 4410; k++) max = Math.max(max, Math.abs(o[k] - exp(k)));
            jumpSeam += (o[at] - o[at - 1]) ** 2;
            for (let k = at - 4410; k < at + 4410; k++) { if (k === at) continue; jumpLocal += (o[k] - o[k - 1]) ** 2; n++; }
          }
          res.windows.push({ name, at, maxAbsDiffVsFiles: max, seamJumpRms: Math.sqrt(jumpSeam / 2), localAdjacentRms: Math.sqrt(jumpLocal / n) });
        }
        let maxAll = 0; for (let c = 0; c < 2; c++) { const o = out.getChannelData(c), I = ib.getChannelData(c), L = lb.getChannelData(c); for (let k = 0; k < INTRO + 2 * LOOP; k += 997) maxAll = Math.max(maxAll, Math.abs(o[k] - (k < INTRO ? I[k] : L[(k - INTRO) % LOOP]))); }
        res.sampledWholeRenderMaxDiff = maxAll;
        return res;
      }, { INTRO, LOOP, SR });
      R.notes.offline = OFF;
      check('Intro -> Loop is seamless: an offline render through the player\'s own scheduling equals Intro then Loop then Loop sample for sample (the handoff and two loop seams); each seam\'s jump is no bigger than the local sample-to-sample motion',
        OFF.frames.intro === INTRO && OFF.frames.loop === LOOP && OFF.windows.every(w => w.maxAbsDiffVsFiles === 0 && w.seamJumpRms <= w.localAdjacentRms) && OFF.sampledWholeRenderMaxDiff === 0, OFF);
      errs(s, 'autoplay'); await s.ctx.close(); }

    /* ---------- E. the music failing: the boot's error with RETRY, never a silent or half menu */
    for (const [label, route, fn, detail] of [
      ['the Loop file is missing', '**/MainTheme_MenuLoop.wav*', r => r.abort(), /HTTP|Failed to fetch|network/i],
      ['the Intro arrives short (1000 bytes)', '**/MainTheme_MenuIntro.wav*', r => r.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(1000) }), /incomplete download/]]) {
      const warns = [];
      const s = await Q.page(bG, PORT, { viewport: { width: 1280, height: 720 }, gate: false, route: [route, fn] });
      s.P.on('console', m => { if (m.type() === 'warning' && /\[boot\]/.test(m.text())) warns.push(m.text().slice(0, 200)); });
      await Q.bootState(s, 'error', 60000);
      const e = await s.ev(`({ st: __boot.state(), info: __boot.info(), msg: document.getElementById('bootErrMsg').textContent, retry: !!document.getElementById('bootRetry').getClientRects().length, focus: document.activeElement && document.activeElement.id,
        menuVis: getComputedStyle(document.getElementById('menu')).visibility, theme: __ui.theme.info().state, go: document.getElementById('bootGo').hidden })`);
      check(`${label}: the page stays black with "the menu music did not load" and RETRY (focused); the menu never shows; the reason goes to the console only`,
        e && e.st === 'error' && e.info.failed === 'the menu music' && /the menu music did not load/.test(e.msg) && e.retry && e.focus === 'bootRetry' && e.menuVis === 'hidden' && e.theme === 'error' && e.go && warns.some(w => detail.test(w)),
        { e, warns });
      if (label.startsWith('the Loop')) await s.P.screenshot({ path: path.join(SHOTS, 'b3_error_music.png'), timeout: 90000 });
      R.errors.push(...s.errs.filter(x => !/MainTheme/.test(x)).map(x => 'fail: ' + x)); await s.ctx.close();
    }

    /* ---------- F. a slow first download says how much of the music has arrived (real bytes, no percentage) */
    { const s = await Q.page(bG, PORT, { viewport: { width: 1280, height: 720 }, gate: false,
        before: async s => { await s.cdp.send('Network.enable'); await s.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 8000 * 1000 / 8, uploadThroughput: 8000 * 1000 / 8 }); } });
      await sleep(7000);
      const n1 = await s.ev(`({ st: __boot.state(), note: document.getElementById('bootNote').hidden ? null : document.getElementById('bootNote').textContent, msg: getComputedStyle(document.getElementById('bootMsg')).opacity })`);
      const shot = path.join(SHOTS, 'b3_slow_first_download.png'); await s.P.screenshot({ path: shot, timeout: 90000 });
      const whole = py('black_field.py', [shot, '[]', '--limit', '24']);
      await sleep(2500);
      const n2 = await s.ev(`document.getElementById('bootNote').textContent`);
      const num = t => { const m = /: (\d+\.\d) of 22\.6 MB$/.exec(t || ''); return m ? +m[1] : null; };
      check('a slow first download (8 Mbit/s): still black, the quiet "Loading" line and under it how much of the music has arrived ("Downloading the menu music (first visit only): x of 22.6 MB", real bytes, rising), no percentage',
        n1 && n1.st === 'loading' && /^Downloading the menu music \(first visit only\): \d+\.\d of 22\.6 MB$/.test(n1.note) && num(n2) > num(n1.note) && !/%/.test(n1.note + n2) && whole.shareAboveLimit < .01,
        { n1, n2, whole });
      errs(s, 'slow'); await s.ctx.close(); }

    /* ---------- G. no Web Audio at all: the menu comes up at once, silent (nothing to wait for) */
    { const s = await Q.page(bG, PORT, { viewport: { width: 1280, height: 720 }, gate: false,
        init: () => { for (const k of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'webkitOfflineAudioContext']) try { delete window[k]; } catch (e) { } } });
      await Q.bootState(s, 'menu', 60000); await sleep(800);
      const p = await s.ev(SNAP);
      check('a browser without Web Audio: no gate, the menu is revealed as soon as the rest is ready, and the theme reports itself unsupported',
        p && p.st === 'menu' && p.boot.music === false && !p.boot.gate && p.th.state === 'unsupported' && p.ui === 'menu', p && { st: p.st, boot: p.boot, theme: p.th.state });
      errs(s, 'no-webaudio'); await s.ctx.close(); }

    /* ---------- H. automation that starts a run before the reveal (a scripted ENTER while the music still loads; a player cannot) */
    { const s = await Q.page(bG, PORT, { viewport: { width: 1280, height: 720 }, gate: false, init: KEYS });
      let st = null; const w0 = Date.now();
      while (Date.now() - w0 < 60000) { st = await s.ev(`window.__boot && __boot.state() === 'loading' && !!(window.__api && __api.gear && typeof document.getElementById('enter').onclick === 'function') ? 'loading+runtime' : window.__boot && __boot.state()`); if (['loading+runtime', 'ready', 'menu', 'error'].includes(st)) break; await sleep(100); }
      await s.ev(`document.getElementById('enter').click()`);
      await sleep(2000); const a = await s.ev(SNAP);
      const w1 = Date.now(); while (Date.now() - w1 < 90000) { if (await s.ev(`__boot.info().timeline.ready !== undefined`)) break; await sleep(200); }
      await sleep(1000); const b2 = await s.ev(SNAP);
      await s.P.keyboard.press('KeyZ'); await sleep(300); const keys = await s.ev('window.__keysSeen');
      check('automation that starts a run before the reveal (a scripted ENTER while the music is still loading): the boot layer serves as the curtain and then leaves for good; when loading ends no gate appears over the run, keys reach the game, and the menu music does not start',
        st === 'loading+runtime' && a && a.started && !a.bootShown && !/tfb-boot/.test(a.html) && b2 && b2.st === 'playing' && !b2.boot.gate && !b2.bootShown && !/tfb-boot/.test(b2.html) && Array.isArray(keys) && keys.includes('z') && !b2.th.begun && b2.th.state === 'ready',
        { st, during: a && { st: a.st, started: a.started, bootShown: a.bootShown, html: a.html }, after: b2 && { st: b2.st, gate: b2.boot.gate, bootShown: b2.bootShown, theme: [b2.th.state, b2.th.begun], timeline: b2.tl }, keys });
      errs(s, 'scripted-run'); await s.ctx.close(); }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await bG.close().catch(() => { }); await Q.close(bA, srv); }
  try { fs.rmSync(FR, { recursive: true, force: true }); } catch (e) { }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
