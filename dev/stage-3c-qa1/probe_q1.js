/* Stage 3C QA1, Q1 - the main menu (rough-draft composition, PLAY entry flow) and the main-menu theme (development only).
 *
 *   node dev/stage-3c-qa1/probe_q1.js [--game DIR] [--port 9712] [--out FILE.json]
 *
 * Composition (1920x1080, 1366x768, 390x844 touch, 844x390 touch, 360x640 touch): the title is centred in the upper part, PLAY is
 * centred low and is the biggest control, CUSTOMIZE / SETTINGS / CREDITS sit directly under it, a tall rail on the left (wide
 * screens), the utility rail on the right, the version in the corner; nothing leaves the screen and the blocks do not overlap;
 * the menu offers no fake system (chat, friends, accounts, servers, saves, levels, timers).
 * Flow: PLAY opens the entry (ENTER LEVEL 0 focused); a double click on PLAY does not start a run; Escape and Back close the
 * entry; Enter in the name field opens the entry instead of starting; only ENTER LEVEL 0 starts, with exactly one join.
 * Theme: nothing is fetched or created before the first press; after it the Intro (1357824 frames) and the Loop (2416640 frames)
 * are decoded at 44.1 kHz, the Loop is scheduled exactly one Intro-length after the Intro and loops its whole buffer; gain
 * follows SOUND ON/OFF and the master volume; it keeps playing (same start, no restart) through Settings, Credits, Help and
 * Customize; ENTER LEVEL 0 fades it out over 1 s and suspends it; END brings the menu back and the theme restarts from the
 * Intro; a second visit reads the files from Cache Storage. An offline render through the player's own scheduling function
 * reproduces Intro + Loop + Loop sample for sample across the Intro->Loop handoff and two loop seams.
 * Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9712), OUT = opt('out');
const R = { checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 900) : '')); };
const INTRO = 1357824, LOOP = 2416640, SR = 44100;
const info = P => P.evaluate(() => __ui.theme.info());
const joins = P => P.evaluate(() => (window.__sent || []).filter(x => /"t":"join"/.test(x[1])).length);
async function waitTheme(P, st, ms = 20000) { const t = Date.now(); for (; ;) { const i = await info(P); if (i.state === st || Date.now() - t > ms) return i; await sleep(150); } }
const LAYOUT = () => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom } : null; };
  const W = innerWidth, Hh = innerHeight;
  const glyphs = sel => { const rg = document.createRange(); rg.selectNodeContents(document.querySelector(sel)); const b = rg.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
  const ttl = glyphs('#mmTitle .b'), ttlA = glyphs('#mmTitle .a'), play = r('#mmPlay'), row = [...document.querySelectorAll('.mm-row .mm-item')].map(e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom, go: e.dataset.go, text: e.textContent.trim() }; });
  const rail = r('.mm-rail'), util = r('.mm-util'), ver = r('#mmVer'), id = r('.mm-id');
  const utilBtns = [...document.querySelectorAll('.mm-util button')].map(b => b.getAttribute('aria-label'));
  const all = [...document.querySelectorAll('#menu *')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => e.getBoundingClientRect());
  const outside = all.filter(b => b.width && (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > Hh + 1)).length;
  const hit = (a, b) => a && b && a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
  const stage = r('#mmStage'), title = r('#mmTitle');
  const overlaps = { titleStage: hit(title, stage), railTitle: hit(rail, ttl) || hit(rail, ttlA), railStage: hit(rail, stage), utilTitle: hit(util, ttl) || hit(util, ttlA), utilStage: hit(util, stage), railUtil: hit(rail, util) };
  const text = document.getElementById('menu').innerText;
  return { W, H: Hh, ttl, play, row, rail, util, ver, id, utilBtns, outside, overlaps, scrollW: document.documentElement.scrollWidth, text,
    nav: ['play', 'customize', 'settings', 'credits'].map(g => !!document.querySelector(`#menu [data-go="${g}"]`)), version: document.getElementById('mmVer').textContent };
};
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser();
  try {
    /* ---------- composition at five sizes */
    for (const [W, Hh, m] of [[1920, 1080, 0], [1366, 768, 0], [390, 844, 1], [844, 390, 1], [360, 640, 1]]) {
      const tag = `${W}x${Hh}${m ? ' touch' : ''}`;
      const s = await U.page(b, PORT, Object.assign({ viewport: { width: W, height: Hh } }, m ? { mobile: true, dpr: 2 } : {}));
      await sleep(2200);
      const L = await s.P.evaluate(LAYOUT);
      const cx = v => v.x + v.w / 2, near = (a, c, tol) => Math.abs(a - c) <= tol;
      const wide = W >= 1180 && Hh >= 620;
      const playBiggest = L.row.every(x => L.play.w * L.play.h > 1.8 * x.w * x.h);
      const rowUnder = L.row.length === 3 && L.row.every(x => near(x.y, L.play.b, 2)) && near(L.row[0].x, L.play.x, 2) && near(L.row[2].r, L.play.r, 2);
      const ok = L.nav.every(Boolean) && near(cx(L.ttl), W / 2, W * .02) && L.ttl.b < Hh * .5 && near(cx(L.play), W / 2, W * .02) && L.play.y > Hh * .45 && playBiggest && rowUnder
        && L.row.map(x => x.go).join() === 'customize,settings,credits' && L.utilBtns.length === 4 && L.util.r > W * .9 && L.util.y < Hh * .2
        && L.rail.x < W * .1 && L.rail.y < Hh * .2 && (!wide || L.rail.h > Hh * .8) && L.ver.r > W * .85 && L.ver.b > Hh * .85
        && !L.outside && L.scrollW <= W && !Object.values(L.overlaps).some(Boolean) && /^v\d+\.\d+\.\d+$/.test(L.version);
      check(`composition ${tag}: title centred high, PLAY centred low and biggest, CUSTOMIZE / SETTINGS / CREDITS under it, left rail${wide ? ' (tall)' : ''}, right utility rail (4), version bottom right; nothing off screen, no overlaps`, ok,
        { ttl: L.ttl, play: L.play, row: L.row.map(x => [x.go, Math.round(x.x), Math.round(x.y), Math.round(x.w), Math.round(x.h)]), rail: L.rail, util: L.util, ver: L.ver, utilBtns: L.utilBtns, outside: L.outside, overlaps: L.overlaps, version: L.version });
      if (W === 1920) {
        const fake = /\b(chat|friends?|account|sign in|log ?in|servers\b|server list|server browser|levels\b|level select|save slot|continue|cloud|release|coming soon)\b/i.exec(L.text);
        check('the menu offers only real systems: no chat, friends, accounts, servers, level select, saves, CONTINUE, cloud or timers', !fake, fake && fake[0]);
      }
      // the entry fits too (ENTER LEVEL 0 and Back on screen, the title stepping back only where they would overlap)
      await s.P.evaluate(() => __ui.go('play')); await sleep(700);
      const E = await s.P.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width }; };
        const t = document.getElementById('mmTitle'), tv = getComputedStyle(t).visibility !== 'hidden'; const tb = t.getBoundingClientRect(), eb = document.getElementById('mmEntry').getBoundingClientRect();
        return { enter: r('#enter'), back: r('#mmBack'), entry: r('#mmEntry'), titleShown: tv, overlap: tv && eb.top < tb.bottom - 1, W: innerWidth, H: innerHeight, focus: document.activeElement && document.activeElement.id }; });
      const inside = v => v.w > 0 && v.x >= 0 && v.y >= 0 && v.r <= E.W + 1 && v.b <= E.H + 1;
      check(`entry ${tag}: ENTER LEVEL 0 and Back on screen, focus on ENTER, the title never under the entry`, inside(E.enter) && inside(E.back) && inside(E.entry) && !E.overlap && E.focus === 'enter', E);
      R.errors.push(...s.errs.map(e => tag + ': ' + e)); await s.ctx.close();
    }

    /* ---------- flow + theme (desktop, mouse) */
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const mk = async () => { const P = await ctx.newPage(), errs = [], wav = [];
      await P.addInitScript(H.INIT);
      P.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 300)));
      P.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|fonts\.g|ERR_TUNNEL|ERR_CONNECTION/.test(t)) errs.push('console: ' + t.slice(0, 300)); });
      P.on('request', q => { if (/MainTheme/.test(q.url())) wav.push(new URL(q.url()).pathname + new URL(q.url()).search); });
      await P.goto(`http://127.0.0.1:${PORT}/?room=q1t${Date.now() % 1e6}`, { timeout: 90000 });
      await P.waitForFunction(() => !!(window.__api && window.__api.H && window.__ui), null, { timeout: 90000 }); await sleep(1500);
      return { P, errs, wav }; };
    const A = await mk(), P = A.P;
    await sleep(2500);
    const i0 = await info(P);
    check('before any press: no audio context, no theme request, the theme waits', i0.ctx === null && !A.wav.length && i0.state === 'waiting' && i0.want === true, { i0, wav: A.wav });
    // PLAY by a real click; a double click must not start a run
    await P.dblclick('#mmPlay'); await sleep(900);
    const f0 = await P.evaluate(() => ({ entry: __ui.entryOpen(), started: __api.started(), joins: (window.__sent || []).filter(x => /"t":"join"/.test(x[1])).length }));
    await P.keyboard.press('Escape'); await sleep(300); await P.click('#mmPlay'); await sleep(400);
    const f1 = await P.evaluate(() => ({ entry: __ui.entryOpen(), started: __api.started(), focus: document.activeElement.id, stageHidden: document.getElementById('mmStage').hidden }));
    check('PLAY opens the entry with ENTER LEVEL 0 focused; a double click on PLAY (its second click lands where ENTER now is) does not start the run',
      f0.entry && !f0.started && !f0.joins && f1.entry && !f1.started && f1.focus === 'enter' && f1.stageHidden, { f0, f1 });
    await P.keyboard.press('Escape'); await sleep(300);
    const f2 = await P.evaluate(() => ({ entry: __ui.entryOpen(), focus: document.activeElement.id, started: __api.started() }));
    await P.click('#mmPlay'); await sleep(500); await P.click('#mmBack'); await sleep(300);
    const f3 = await P.evaluate(() => ({ entry: __ui.entryOpen(), focus: document.activeElement.id }));
    await P.click('#name'); await P.keyboard.type('Probe'); await P.keyboard.press('Enter'); await sleep(400);
    const f4 = await P.evaluate(() => ({ entry: __ui.entryOpen(), started: __api.started(), focus: document.activeElement.id, shown: document.getElementById('mmEntryName').textContent }));
    check('Escape and Back close the entry (focus back on PLAY); Enter in the name field opens the entry and does not start the run',
      !f2.entry && f2.focus === 'mmPlay' && !f2.started && !f3.entry && f3.focus === 'mmPlay' && f4.entry && !f4.started && f4.focus === 'enter' && /Probe/i.test(f4.shown), { f2, f3, f4 });
    // the theme after the first presses
    const i1 = await waitTheme(P, 'playing');
    const sched = i1.t0 !== null && Math.abs((i1.loopAt - i1.t0) * i1.sampleRate - INTRO) < 1e-6 && Math.abs(i1.t0 * i1.sampleRate - Math.round(i1.t0 * i1.sampleRate)) < 1e-6;
    check('after the first press the theme plays: 44.1 kHz context, Intro 1357824 + Loop 2416640 frames, the Loop starts exactly one Intro after it (on a sample frame) and loops its whole buffer; only the two derivatives are fetched',
      i1.state === 'playing' && i1.ctx === 'running' && i1.sampleRate === SR && i1.introFrames === INTRO && i1.loopFrames === LOOP && sched && i1.loopSourceLoops === true && i1.loopSourceLoopStart === 0 && i1.loopSourceLoopEnd === 0
      && A.wav.length === 2 && A.wav.every(u => /MainTheme_Menu(Intro|Loop)\.wav\?v=/.test(u)) && i1.plays === 1, { i1, wav: A.wav });
    R.notes.firstPlay = i1;
    // gain: the master volume and SOUND ON/OFF (the game's own flag, from the rail)
    await sleep(400); const g0 = (await info(P)).gain;
    await P.evaluate(() => __settings.set('vol', .5)); await sleep(500); const g1 = (await info(P)).gain;
    await P.click('#mmSound'); await sleep(500); const g2 = await P.evaluate(() => ({ g: __ui.theme.info().gain, muted: __api.audio().muted, pressed: document.getElementById('mmSound').getAttribute('aria-pressed'), header: document.getElementById('sound').textContent }));
    await P.click('#mmSound'); await sleep(500); const g3 = (await info(P)).gain;
    await P.evaluate(() => __settings.set('vol', 1)); await sleep(500); const g4 = (await info(P)).gain;
    check('gain follows the master volume (0.7 x volume) and SOUND ON/OFF (the game\'s own flag: muted -> 0, the rail and the header agree)',
      Math.abs(g0 - .7) < .01 && Math.abs(g1 - .35) < .01 && g2.g < .005 && g2.muted === true && g2.pressed === 'false' && /OFF/.test(g2.header) && Math.abs(g3 - .35) < .01 && Math.abs(g4 - .7) < .01, { g0, g1, g2, g3, g4 });
    // continuous through the sheets and Customize
    await P.keyboard.press('Escape'); await sleep(300);                    // (the entry, open from the name-field check)
    const c0 = await info(P);
    for (const s of ['.mm-row [data-go="settings"]', '.mm-row [data-go="credits"]', '.mm-util [data-go="help"]']) { await P.click(s); await sleep(700); await P.keyboard.press('Escape'); await sleep(500); }
    await P.click('#mmPlay'); await sleep(300); await P.keyboard.press('Escape'); await sleep(200);
    await P.click('.mm-row [data-go="customize"]'); await sleep(1200); const inCz = await P.evaluate(() => __ui.state()); await P.keyboard.press('Escape'); await sleep(800);
    const c1 = await info(P);
    check('the theme plays on through Settings, Credits, Help, the entry and Customize (same start, no restart, the clock running)',
      inCz === 'customize' && c1.state === 'playing' && c1.plays === c0.plays && c1.t0 === c0.t0 && c1.ctx === 'running' && c1.now > c0.now + 3, { inCz, c0: { t0: c0.t0, now: c0.now, plays: c0.plays }, c1: { t0: c1.t0, now: c1.now, plays: c1.plays, state: c1.state } });
    // ENTER LEVEL 0: one join, the theme fades out over 1 s and stops
    const j0 = await joins(P);
    await P.click('#mmPlay'); await sleep(600);
    await P.evaluate(() => { const S = window.__fadeS = []; const f = () => { const i = __ui.theme.info(); if (i.fadeAt !== null) S.push([+(i.now - i.fadeAt).toFixed(3), +(+i.gain).toFixed(3)]); if (S.length < 200 && (!S.length || S[S.length - 1][0] < 1.3)) setTimeout(f, 25); }; f(); });
    await P.click('#enter');
    await sleep(2200);
    const fade = await P.evaluate(() => window.__fadeS);
    const e1 = await P.evaluate(() => ({ th: __ui.theme.info(), started: __api.started(), menu: !document.getElementById('menu').hidden, st: __ui.state() }));
    const j1 = await joins(P) - j0;
    check('ENTER LEVEL 0 starts the run with exactly one join; at that moment the theme begins a 1 s fade from its playing level, then its sources stop and its context is suspended',
      e1.started && !e1.menu && j1 === 1 && e1.th.state === 'stopped' && e1.th.sources === 0 && e1.th.ctx === 'suspended' && Math.abs(e1.th.fadeEnd - e1.th.fadeAt - 1) < 1e-6 && fade.length > 0 && fade[fade.length - 1][1] === 0,
      { fadeSamples: fade.length, first: fade.slice(0, 4), last: fade.slice(-2), e1: { state: e1.th.state, ctx: e1.th.ctx, sources: e1.th.sources, fadeAt: e1.th.fadeAt, fadeEnd: e1.th.fadeEnd }, j1 });
    R.notes.enterFadeSamples = fade;
    // END -> the true main menu: the theme restarts from the Intro
    await P.keyboard.press('Escape'); await sleep(500); await P.click('#reset'); await P.waitForFunction(() => __ui.state() === 'run', null, { timeout: 15000 }).catch(() => { });
    const midRun = await info(P);
    await P.click('#runEnd'); await sleep(900);
    const back0 = await info(P);
    await P.mouse.click(700, 300); await sleep(1200);
    const back1 = await info(P);
    check('the run menu stays silent; END brings back the true main menu and the theme starts again from the Intro (a new start, both sources, no fetch)',
      midRun.state === 'stopped' && (back1.state === 'playing' && back1.plays === 2 && back1.t0 > e1.th.fadeAt && back1.sources === 2 && back1.ctx === 'running' && A.wav.length === 2), { midRun: midRun.state, back0: { state: back0.state, ctx: back0.ctx, plays: back0.plays }, back1: { state: back1.state, plays: back1.plays, t0: back1.t0, ctx: back1.ctx } });
    // the entry is closed and fresh after END; then ENTER again: exactly one join, faded out
    const ent = await P.evaluate(() => __ui.entryOpen());
    const j2 = await joins(P); await P.click('#mmPlay'); await sleep(500); await P.click('#enter'); await sleep(1700);
    const e2 = await P.evaluate(() => ({ th: __ui.theme.info(), started: __api.started() }));
    check('after END the menu is fresh (entry closed); ENTER again starts exactly one run and the theme stops again', !ent && e2.started && (await joins(P)) - j2 === 1 && e2.th.state === 'stopped', { ent, th: e2.th.state });
    R.errors.push(...A.errs.map(e => 'flow: ' + e)); await P.close();

    /* ---------- a second visit reads the files from Cache Storage; a press on ENTER alone loads nothing */
    const B2 = await mk();
    await B2.P.click('#mmPlay'); const k1 = await waitTheme(B2.P, 'playing');
    check('a second visit plays from Cache Storage (no network fetch of the theme)', k1.state === 'playing' && k1.cacheHits === 2 && k1.fetched === 0 && !B2.wav.length, { k1: { state: k1.state, cacheHits: k1.cacheHits, fetched: k1.fetched }, wav: B2.wav });
    // the fade's shape, sampled on the audio clock without a run start in the way: linear from the playing level to 0 in 1 s
    await sleep(800);
    // (a tight synchronous loop: the audio clock and the gain are read from the audio thread, so the busy main thread - the world
    //  keeps rendering under software GL - cannot thin the samples out)
    const curve = await B2.P.evaluate(() => { const S = []; __ui.theme.want(false); const w0 = performance.now(); let lastT = -1;
      for (; ;) { const i = __ui.theme.info(), t = +(i.now - i.fadeAt).toFixed(4); if (t !== lastT) { S.push([t, +(+i.gain).toFixed(4)]); lastT = t; } if (t > 1.15 || performance.now() - w0 > 4000) return { S }; } });
    const inRamp = curve.S.filter(([t]) => t > .05 && t < .95), dev = Math.max(...inRamp.map(([t, g]) => Math.abs(g - .7 * (1 - t))));
    R.notes.fadeCurve = curve.S;
    check('the fade is a 1 s linear ramp from 0.7 to 0 (every sample within 0.02 of the line), and the theme then stops', inRamp.length >= 6 && dev < .02 && curve.S[curve.S.length - 1][1] < .01, { samples: inRamp.length, maxDeviation: +dev.toFixed(4) });
    await B2.P.evaluate(() => __ui.theme.want(true)); await sleep(500);
    // offline render through the player's own scheduling: Intro + Loop + Loop, sample for sample
    const OFF = await B2.P.evaluate(async ({ INTRO, LOOP, SR }) => {
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
    check('offline render through the player\'s scheduling equals Intro then Loop then Loop sample for sample (handoff and two loop seams); each seam\'s jump is no bigger than the local sample-to-sample motion',
      OFF.frames.intro === INTRO && OFF.frames.loop === LOOP && OFF.windows.every(w => w.maxAbsDiffVsFiles === 0 && w.seamJumpRms <= w.localAdjacentRms) && OFF.sampledWholeRenderMaxDiff === 0, OFF);
    R.errors.push(...B2.errs.map(e => 'cache: ' + e)); await B2.P.close(); await ctx.close();

    { const s = await U.page(b, PORT, { viewport: { width: 1280, height: 720 } }), wav = []; s.P.on('request', q => { if (/MainTheme/.test(q.url())) wav.push(q.url()); });
      await U.start(s.P, 'Direct'); await sleep(1500);
      const i = await info(s.P);
      check('a run started straight from ENTER (the press that starts the run) loads and plays no theme', !wav.length && i.ctx === null && i.state !== 'playing' && (await s.P.evaluate(() => __api.started())), { wav, i: { state: i.state, ctx: i.ctx } });
      R.errors.push(...s.errs.map(e => 'direct: ' + e)); await s.ctx.close(); }

    /* ---------- reduced motion: no entrance, no hum; and nothing animates on an idle menu */
    { const s = await U.page(b, PORT, { viewport: { width: 1920, height: 1080 }, reduced: true }); await sleep(800);
      const rm = await s.P.evaluate(() => ({ rm: document.documentElement.classList.contains('rm'), enter: document.getElementById('menu').classList.contains('enter') }));
      R.errors.push(...s.errs.map(e => 'reduced: ' + e)); await s.ctx.close();
      // (software rendering at 1920x1080 can run the document timeline slowly: wait for the entrance to finish on that timeline,
      //  then look again a few seconds later; nothing in the menu may be infinite)
      const s2 = await U.page(b, PORT, { viewport: { width: 1920, height: 1080 } });
      const MENU_ANIMS = () => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#menu'))
        .map(a => ({ name: a.animationName || String(a.id), state: a.playState, infinite: a.effect.getComputedTiming().activeDuration === Infinity }));
      let waited = 0; for (; waited < 20000; waited += 250) { if (!(await s2.P.evaluate(MENU_ANIMS)).some(x => x.state === 'running')) break; await sleep(250); }
      const first = await s2.P.evaluate(MENU_ANIMS); await sleep(3000);
      const later = await s2.P.evaluate(MENU_ANIMS);
      const idle = later.filter(x => x.state === 'running').map(x => x.name).concat(first.filter(x => x.infinite).map(x => x.name + ' (infinite)'));
      R.notes.entranceFinishedAfterMs = waited;
      R.errors.push(...s2.errs.map(e => 'idle: ' + e)); await s2.ctx.close();
      check('reduced motion: no entrance animation; an idle menu (after its entrance) runs no animation at all', rm.rm && !rm.enter && !idle.length, { rm, idle }); }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
