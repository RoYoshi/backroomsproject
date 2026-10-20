#!/usr/bin/env node
/* dev/pre-trial3-final-polish/tools/ui_audio_check.js - pre-Trial 3 polish P7 / P8: the interface's sounds and Settings -> Sound's
 * Music and UI volume, in the real page (development only).
 *
 *   node dev/pre-trial3-final-polish/tools/ui_audio_check.js [--dir DIR] [--only p7|p8] [--out FILE.json]
 *
 * DIR: a complete game folder (default this repository).  Headless Chromium (sound allowed to start without a gesture, so the menu's
 * music plays as in a browser that lets it), the main menu after the boot gate.  What is counted: the page's own record
 * (__ui.theme.info(): the gains, the sounds decoded, started and skipped; __ui.uiSound.info(): the cues asked for) and every
 * AudioContext the page makes (counted by a wrapper installed before any script runs).  Presses are Playwright's real input.
 * P7 - the sounds
 *   files        the seven assets/ui_*.mp3 are served (200) and decode in Chromium: mono, 44.1 kHz, the inventory's length, peak below
 *                -6 dBFS, quiet first and last samples
 *   loaded       after the menu's reveal all seven are decoded in the menu's own context, with no error
 *   one_each     Settings (open), its Sound switch off and on (off is silent: SOUND is off; on sounds), Close (back), the Account button
 *                (unavailable), Escape on its panel (back), PLAY (open), Escape (back), Credits then Escape (open, back), the Master
 *                volume slider let go (none): each press one sound, the one it should be; nothing doubled
 *   hover        the mouse onto three controls in turn: three ticks; six Tab presses at once (the focus moving six times within a few
 *                milliseconds): at most one tick per 70 ms; the mouse moving about on one control: none
 *   quiet        a script's click(), typing in the lounge's field, the sliders dragged, a hidden tab: no sound started
 *   one_context  the menu's one AudioContext (ui.js's, made at the boot gate) is the only one ui.js makes, however many presses; any
 *                other is another owner's and is named (the game's own, mp.js's initAudio on the first press, as on C5)
 * P8 - the volumes
 *   sliders      Music volume and UI volume under Master volume: range 0-100, step 5, named, the arrow keys move them, the value shown;
 *                the UI volume slider let go plays one click (at the level chosen), the Music one none
 *   routing      Music 0: the music's gain 0, a click still sounds; UI 0: clicks skipped, the music's gain as it was; Master 50: the
 *                master gain 0.5, the others unchanged; SOUND off (the menu's icon): the master 0, the voices told off (gameMuted),
 *                clicks skipped; Voice volume 0: no gain here changes
 *   smooth       a slider moved while the music plays: no restart (same start, same sources), the gain glides (not a step)
 *   persist      the values saved (fb_settings_v1: music, ui), shown and applied after a reload; one context, one music start
 *   old_saves    a save without them reads 1 and 1; damaged values ('x', -3, 7) read 1, 0, 1
 * --mutants 1 [--work DIR]: the check's own sensitivity - each mutant is a copy of the game (less dev/) with one edit to its served
 * assets/ui.js or hud.js, checked by this tool (the part the edit belongs to: --only p7 or p8) in a child process; it is caught when
 * the case named for it fails:
 *   untrusted_counted   a script's click() makes a sound                         -> quiet
 *   doubled             every press handled twice, and nothing stops the second   -> one_each
 *   hover_unthrottled   the 70 ms spacing gone                                    -> hover
 *   hidden_plays        a hidden tab still sounds                                 -> quiet
 *   muted_plays         SOUND off still sounds                                    -> one_each
 *   escape_silent       Escape that closes something says nothing                 -> one_each
 *   music_ignored       Music volume not applied                                  -> routing
 *   not_saved           music / ui not settings (set() refuses them)              -> sliders
 * --mutant-ids a,b: only those mutants.
 * Every passcode is synthetic.  Servers are stopped by their PID.  Exit 0 only when every case holds (and every mutant is caught). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const REPO = path.resolve(__dirname, '../../..'), DIR = path.resolve(ARG.dir || REPO), ONLY = ARG.only || null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cases = [], check = (name, ok, detail) => { cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' - ' + String(detail).slice(0, 700) : ''}`); };
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { const b = []; q.on('data', d => b.push(d)); q.on('end', () => r({ status: q.statusCode, body: Buffer.concat(b) })); }).on('error', () => r({ status: 0, body: Buffer.alloc(0) })));
const FILES = ['ui_hover', 'ui_click', 'ui_back', 'ui_toggle_on', 'ui_toggle_off', 'ui_open', 'ui_unavailable'];
const COUNT = () => {                                                       // every AudioContext the page makes (not the offline ones)
  window.__acMade = 0; window.__acWho = [];
  for (const k of ['AudioContext', 'webkitAudioContext']) { const A = window[k]; if (!A) continue; window[k] = class extends A { constructor(...a) { super(...a); window.__acMade++;
    window.__acWho.push(String(new Error().stack || '').split('\n').slice(2, 4).map(l => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ')); } }; }
};
async function serve(dir) {
  const port = await freePort(), srv = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 'uiaudio-synthetic-admin' }), stdio: 'ignore' });
  for (let i = 0; i < 150 && (await get(port, '/index.html')).status !== 200; i++) await sleep(100);
  return { port, stop: () => { try { process.kill(srv.pid); } catch (e) { } } };
}
async function menu(ctx, port, P) {
  P = P || await ctx.newPage(); const errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__ui && __ui.theme && __ui.theme.info().state === 'playing' && (__ui.theme.info().ui || { loaded: [] }).loaded.length === 7, null, { timeout: 30000 }).catch(() => null);
  await sleep(500);
  return { P, errs };
}
// (a page without the interface's sounds - C5 - reads as nothing loaded, nothing played, no gains)
const near = (a, b, e) => Math.abs(a - b) < (e || .02);
const info = P => P.evaluate(() => { const th = __ui.theme.info(); th.ui = th.ui || { loaded: [], errors: ['this page has no interface sounds'], plays: {}, skipped: 0, live: 0 }; th.bus = th.bus || null;
  return { th, cues: __ui.uiSound ? __ui.uiSound.info() : { cues: {}, dropped: 0 }, made: window.__acMade, who: window.__acWho, s: __settings.get(), voice: window.__voice ? __voice.prefs() : null }; });
const delta = (a, b) => { const o = {}; for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) { const d = (b[k] || 0) - (a[k] || 0); if (d) o[k] = d; } return o; };
// one press: the sounds it started (plays: all but the hover tick; hovers: the ticks - a Playwright click moves the pointer onto the
// control in the same instant, so its tick comes with the press, which a hand on a mouse does not do), and what was skipped
async function press(P, what, fn) {
  const a = await info(P), t0 = Date.now(); await fn(); const ms = Date.now() - t0; await sleep(260); const b = await info(P);
  const d = delta(a.th.ui.plays, b.th.ui.plays), hovers = d.hover || 0; delete d.hover;
  return { what, plays: d, hovers, ms, skipped: b.th.ui.skipped - a.th.ui.skipped, cues: delta(a.cues.cues, b.cues.cues), dropped: b.cues.dropped - a.cues.dropped };
}
const same = (o, want) => JSON.stringify(Object.entries(o).sort()) === JSON.stringify(Object.entries(want).sort());

const MUTANTS = [
  ['untrusted_counted', 'p7', 'quiet', [['assets/ui.js', "document.addEventListener('click', e => { if (!e.isTrusted) return; const c = control(e.target);", "document.addEventListener('click', e => { const c = control(e.target);"]]],
  ['doubled', 'p7', 'one_each', [['assets/ui.js', "if (now - lastAt < 90 && RANK[k] <= lastRank && !(k === 'hover' && lastRank === 0))", "if (false)"],
    ['assets/ui.js', "    document.addEventListener('click', e => { if (!e.isTrusted) return;", "    document.addEventListener('click', e => { if (!e.isTrusted) return; const c = control(e.target); if (!c) return; const k = kind(c); setTimeout(() => cue(k, true), 0); }, true);\n    document.addEventListener('click', e => { if (!e.isTrusted) return;"]]],
  ['hover_unthrottled', 'p7', 'hover', [['assets/ui.js', "if (now - hoverAt < 70) return; hoverAt = now;", "hoverAt = now;", 'all']]],
  ['hidden_plays', 'p7', 'quiet', [['assets/ui.js', "if (document.hidden || masterLevel() <= 0 ||", "if (masterLevel() <= 0 ||"]]],
  ['muted_plays', 'p7', 'one_each', [['assets/ui.js', "if (document.hidden || masterLevel() <= 0 ||", "if (document.hidden ||"]]],
  ['escape_silent', 'p7', 'one_each', [['assets/ui.js', "addEventListener('keydown', e => { if (e.key === 'Escape' && e.isTrusted) uiSound.escape(); }, true);", ""]]],
  ['music_ignored', 'p8', 'routing', [['assets/ui.js', "const musicLevel = () => THEME.gain * setting('music', 1);", "const musicLevel = () => THEME.gain * 1;"]]],
  ['not_saved', 'p8', 'sliders', [['hud.js', "vol: 1, music: 1, ui: 1, rm: 'auto'", "vol: 1, rm: 'auto'"]]],
];
async function mutants(R) {
  const work = fs.mkdtempSync(path.join(ARG.work ? path.resolve(ARG.work) : require('os').tmpdir(), 'uiaudio-mutants-')); R.mutants = [];
  try {
    const pick = ARG['mutant-ids'] ? new Set(ARG['mutant-ids'].split(',')) : null, RUN = pick ? MUTANTS.filter(m => pick.has(m[0])) : MUTANTS;
    if (pick && RUN.length !== pick.size) throw new Error('--mutant-ids names a mutant this check does not have');
    R.mutantIds = RUN.map(m => m[0]);
    for (const [id, part, want, edits] of RUN) {
      const dir = path.join(work, id); fs.mkdirSync(dir);
      for (const e of fs.readdirSync(DIR)) if (e !== 'dev' && e !== '.git' && e !== 'node_modules') execFileSync('cp', ['-a', path.join(DIR, e), dir]);
      fs.mkdirSync(path.join(dir, 'dev', 'pre-trial3-final-polish'), { recursive: true });
      fs.copyFileSync(path.join(DIR, 'dev', 'pre-trial3-final-polish', 'SOUND_ASSETS.json'), path.join(dir, 'dev', 'pre-trial3-final-polish', 'SOUND_ASSETS.json'));
      let applied = true;
      for (const [file, from, to, all] of edits) {                          // (all: every occurrence; otherwise exactly one)
        const f = path.join(dir, 'public', file), t = fs.readFileSync(f, 'utf8'), n = t.split(from).length - 1;
        if (all ? n < 1 : n !== 1) { applied = false; break; } fs.writeFileSync(f, t.split(from).join(to)); }
      let failed = [];
      if (applied) {
        const out = path.join(work, id + '.json');
        try { execFileSync(process.execPath, [__filename, '--dir', dir, '--only', part, '--out', out], { stdio: 'ignore', timeout: 900000 }); } catch (e) { }
        try { failed = JSON.parse(fs.readFileSync(out, 'utf8')).cases.filter(c => !c.ok).map(c => c.name); } catch (e) { failed = ['no report']; }
      }
      const caught = applied && failed.includes(want);
      R.mutants.push({ id, part, want, applied, failed, caught });
      console.log(`mutant ${id}: ${!applied ? 'NOT APPLIED' : caught ? 'caught' : 'MISSED'} (failed: ${failed.join(', ') || 'none'})`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
  R.mutantsCaught = R.mutants.filter(m => m.caught).length;
}
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const R = { tool: 'dev/pre-trial3-final-polish/tools/ui_audio_check.js', dir: DIR, chromium: b.version(), cases };
  const s = await serve(DIR);
  try {
    if (!ONLY || ONLY === 'p7') {
      // files: served, decoded by Chromium itself
      { const ctx = await b.newContext(), P = await ctx.newPage();
        try {
          await P.goto(`http://127.0.0.1:${s.port}/favicon.ico`).catch(() => null);
          const invF = path.join(DIR, 'dev', 'pre-trial3-final-polish', 'SOUND_ASSETS.json'), inv = fs.existsSync(invF) ? JSON.parse(fs.readFileSync(invF, 'utf8')) : { sounds: [] };
          const rows = [];
          for (const f of FILES) {
            const r = await get(s.port, `/assets/${f}.mp3`), want = inv.sounds.find(x => x.file === `public/assets/${f}.mp3`);
            const d = await P.evaluate(async b64 => { const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const c = new OfflineAudioContext(1, 44100, 44100);
              try { const a = await c.decodeAudioData(u8.buffer); const x = a.getChannelData(0); let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
                return { ch: a.numberOfChannels, rate: a.sampleRate, n: a.length, peakDb: +(20 * Math.log10(pk || 1e-9)).toFixed(2), first: +Math.abs(x[0]).toFixed(5), last: +Math.abs(x[x.length - 1]).toFixed(5) }; }
              catch (e) { return { error: String(e) }; } }, r.body.toString('base64'));
            d.file = f; d.status = r.status; d.bytes = r.body.length; d.inventory = want ? want.bytes : null;
            d.ok = r.status === 200 && !d.error && d.ch === 1 && d.rate === 44100 && want && Math.abs(d.n - want.renderSamples) <= 1152 && d.peakDb < -6 && d.first < .01 && d.last < .01 && d.bytes === want.bytes;
            rows.push(d);
          }
          check('files', rows.every(r => r.ok), JSON.stringify(rows));
        } finally { await ctx.close(); } }
      // the presses
      { const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } }); await ctx.addInitScript(COUNT);
        try {
          const { P, errs } = await menu(ctx, s.port), i0 = await info(P);
          R.contextsAtMenu = { made: i0.made, who: i0.who };
          check('loaded', i0.th.ui.loaded.length === 7 && !i0.th.ui.errors.length && i0.th.state === 'playing', JSON.stringify({ loaded: i0.th.ui.loaded, errors: i0.th.ui.errors, music: i0.th.state, ctx: i0.th.ctx }));
          const rows = [];
          rows.push([await press(P, 'Settings', () => P.click('#menu [data-go=settings]')), { open: 1 }]);
          rows.push([await press(P, 'Sound switch off', () => P.click('#stSound')), {}]);
          rows.push([await press(P, 'Sound switch on', () => P.click('#stSound')), { toggleOn: 1 }]);
          rows.push([await press(P, 'Close', () => P.click('#uiSettings .us-close')), { back: 1 }]);
          await sleep(500);
          rows.push([await press(P, 'Account', () => P.click('#mmAccount')), { unavailable: 1 }]);
          rows.push([await press(P, 'Escape (Account panel)', () => P.keyboard.press('Escape')), { back: 1 }]);
          rows.push([await press(P, 'PLAY', () => P.click('#mmPlay')), { open: 1 }]);
          rows.push([await press(P, 'Escape (entry)', () => P.keyboard.press('Escape')), { back: 1 }]);
          rows.push([await press(P, 'Credits', () => P.click('#menu [data-go=credits]')), { open: 1 }]);
          rows.push([await press(P, 'Escape (Credits)', () => P.keyboard.press('Escape')), { back: 1 }]);
          await sleep(500);
          await P.click('#menu [data-go=settings]'); await sleep(400);
          rows.push([await press(P, 'Master volume let go', async () => { const r = await P.$('#stVol'), bb = await r.boundingBox(); await P.mouse.click(bb.x + bb.width * .9, bb.y + bb.height / 2); }), {}]);
          await P.keyboard.press('Escape'); await sleep(500);
          const bad = rows.filter(([r, want]) => !same(r.plays, want));
          check('one_each', !bad.length, JSON.stringify(rows.map(([r, want]) => ({ what: r.what, started: r.plays, want, skipped: r.skipped, dropped: r.dropped }))));
          // hover: three controls in turn, then back and forth fast, then a touch
          const boxes = []; for (const sel of ['#menu [data-go=customize]', '#menu [data-go=settings]', '#menu [data-go=credits]']) { const bb = await (await P.$(sel)).boundingBox(); boxes.push([bb.x + bb.width / 2, bb.y + bb.height / 2]); }
          await P.mouse.move(5, 5); await sleep(200);
          const h1 = await press(P, 'mouse onto three controls', async () => { for (const [x, y] of boxes) { await P.mouse.move(x, y); await sleep(140); } });
          // the spacing: six real Tab presses sent at once (CDP) move the focus six times within a few milliseconds (pointer moves that
          // fast are merged by the browser into one per frame, so they cannot test it)
          const cdp = await P.context().newCDPSession(P);
          await P.evaluate(() => document.querySelector('#menu [data-go=customize]').focus()); await sleep(200);
          const tab = { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, tabUp = Object.assign({}, tab, { type: 'keyUp' });
          const h2 = await press(P, 'six Tab presses at once', () => Promise.all([0, 1, 2, 3, 4, 5].map(() => cdp.send('Input.dispatchKeyEvent', tab).then(() => cdp.send('Input.dispatchKeyEvent', tabUp)))));
          h2.focusMoves = await P.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.className || document.activeElement.tagName));
          await P.evaluate(() => document.activeElement && document.activeElement.blur());
          await P.mouse.move(boxes[2][0], boxes[2][1]); await sleep(300);
          const h3 = await press(P, 'moving on one control', async () => { for (let k = 1; k < 6; k++) { await P.mouse.move(boxes[2][0] + 3 * k, boxes[2][1]); await sleep(100); } });
          check('hover', h1.hovers === 3 && same(h1.plays, {}) && h2.hovers >= 1 && h2.hovers <= 1 + Math.floor(h2.ms / 70) && h2.hovers <= 2 && h3.hovers === 0 && same(h3.plays, {}), JSON.stringify([h1, h2, h3]));
          // quiet: a script's click, typing, a hidden tab
          const q1 = await press(P, "a script's click()", () => P.evaluate(() => { document.querySelector('#menu [data-go=credits]').click(); }));
          await P.evaluate(() => __ui.close && __ui.closeAll()); await sleep(400);
          const field = await P.$('#mmLounge input, [data-chat] input');
          const q2 = field ? await press(P, 'typing in the lounge', async () => { await field.click(); await P.keyboard.type('hello'); }) : { what: 'typing in the lounge (no field)', plays: { missing: 1 } };
          if (field) { await P.evaluate(() => document.activeElement && document.activeElement.blur()); }
          const q3 = await press(P, 'hidden tab', async () => { await P.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })); await P.click('#menu [data-go=credits]'); });
          await P.evaluate(() => { delete document.hidden; }); await P.keyboard.press('Escape'); await sleep(400);
          check('quiet', same(q1.plays, {}) && same(q2.plays, {}) && !q2.hovers && same(q3.plays, {}) && !q3.hovers && q3.skipped >= 1, JSON.stringify([q1, q2, q3]));
          const iz = await info(P);
          // the menu's own context (ui.js, made at the boot gate) carries every interface sound: no press makes another.  Other owners'
          // contexts are reported (mp.js's initAudio makes the game's own on the first press - C5 does the same)
          const uiMade = w => /assets\/ui\.js/.test(w);
          check('one_context', i0.who.filter(uiMade).length === 1 && iz.who.filter(uiMade).length === 1 && iz.who.every(w => uiMade(w) || /^initAudio \(mp\.js/.test(w) || /assets\/voice\.js/.test(w)) && !errs.length,
            JSON.stringify({ atMenu: i0.who, afterEveryPress: iz.who, errors: errs }));
        } finally { await ctx.close(); } }
    }
    if (!ONLY || ONLY === 'p8') {
      const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } }); await ctx.addInitScript(COUNT);
      try {
        const { P, errs } = await menu(ctx, s.port);
        await P.click('#menu [data-go=settings]'); await sleep(500);
        const sl = await P.evaluate(() => ['stVol', 'stMusic', 'stUi', 'stVoiceVol'].map(id => { const r = document.getElementById(id); return r && { id, label: r.getAttribute('aria-label'), min: r.min, max: r.max, step: r.step, value: r.value, shown: document.getElementById(id + 'V') && document.getElementById(id + 'V').textContent, top: Math.round(r.getBoundingClientRect().top) }; }));
        await P.focus('#stMusic'); await P.keyboard.press('ArrowLeft'); await P.keyboard.press('ArrowLeft'); await sleep(200);
        const kb = await P.evaluate(() => ({ music: __settings.get().music, shown: document.getElementById('stMusicV').textContent }));
        const letGo = async (id, at) => press(P, id + ' let go', async () => { const r = await P.$('#' + id), bb = await r.boundingBox(); await P.mouse.click(bb.x + bb.width * at, bb.y + bb.height / 2); });
        const pu = await letGo('stUi', .8), pm = await letGo('stMusic', .9);
        const order = sl.every(Boolean) && sl[0].top < sl[1].top && sl[1].top < sl[2].top && sl[2].top < sl[3].top;
        check('sliders', order && sl[1].label === 'Music volume' && sl[2].label === 'UI volume' && sl.slice(1, 3).every(r => r.min === '0' && r.max === '100' && r.step === '5' && r.value === '100' && r.shown === '100%') && Math.abs(kb.music - .9) < 1e-9 && kb.shown === '90%'
          && same(pu.plays, { click: 1 }) && same(pm.plays, {}),
          JSON.stringify({ sliders: sl, afterTwoLeftArrows: kb, uiLetGo: pu, musicLetGo: pm }));
        const setv = (k, v) => P.evaluate(([k, v]) => __settings.set(k, v), [k, v]);
        const settle = async () => { await sleep(450); return info(P); };
        const clickPlays = async () => { const r = await press(P, 'a click', () => P.click('#stTab_hud')); await P.click('#stTab_sound'); await sleep(200); return r; };
        // a click, and the gains read 60 ms into it (the ui gain node is processed only while something plays through it)
        const clickRead = async () => { const a = await info(P); await P.click('#stTab_hud'); await sleep(60); const m = await info(P); await sleep(300); await P.click('#stTab_sound'); await sleep(200);
          const d = delta(a.th.ui.plays, m.th.ui.plays); delete d.hover; return { plays: d, bus: m.th.bus }; };
        await setv('music', 1); await setv('ui', 1); await setv('vol', 1); const base = await settle(); const baseClick = await clickRead();
        await setv('ui', .3); await settle(); const u3 = await clickRead(); await setv('ui', 1);
        await setv('music', 0); const m0 = await settle(); const m0c = await clickPlays(); await setv('music', 1);
        await setv('ui', 0); const u0 = await settle(); const u0c = await clickPlays(); await setv('ui', 1);
        await setv('vol', .5); const v5 = await settle(); await setv('vol', 1);
        await settle(); await P.keyboard.press('Escape'); await sleep(400);
        await P.click('#mmSound'); const mu = await settle(); const muVoice = await P.evaluate(() => { try { return !!(__api.audio() && __api.audio().muted); } catch (e) { return null; } });
        const muc = await press(P, 'Account while muted', () => P.click('#mmAccount')); await P.keyboard.press('Escape'); await sleep(300);
        await P.click('#mmSound'); await settle();
        const vWas = await P.evaluate(() => __voice ? __voice.prefs().vol : null);
        await P.evaluate(() => __voice && __voice.set({ vol: 0 })); const vz = await settle(); await P.evaluate(v => __voice && __voice.set({ vol: v }), vWas);
        const g = x => x.th.bus;
        const rows = {
          base: g(base), baseClick, ui30: u3, music0: { bus: g(m0), click: m0c.plays }, ui0: { bus: g(u0), click: u0c.plays, skipped: u0c.skipped }, master50: g(v5),
          muted: { bus: g(mu), gameMuted: muVoice, account: muc.plays, skipped: muc.skipped }, voice0: { bus: g(vz), voice: vz.voice },
        };
        const ok = near(g(base).master, 1) && near(g(base).music, .7) && near(g(base).ui, 1) && same(baseClick.plays, { click: 1 }) && near(baseClick.bus.ui, 1)
          && same(u3.plays, { click: 1 }) && near(u3.bus.ui, .3, .005) && near(u3.bus.music, .7) && near(u3.bus.master, 1)
          && near(g(m0).music, 0) && near(g(m0).master, 1) && near(g(m0).ui, 1) && same(m0c.plays, { click: 1 })
          && near(g(u0).ui, 0) && near(g(u0).music, .7) && same(u0c.plays, {}) && !u0c.hovers && u0c.skipped >= 1
          && near(g(v5).master, .5) && near(g(v5).music, .7) && near(g(v5).ui, 1)
          && near(g(mu).master, 0) && muVoice === true && same(muc.plays, {}) && !muc.hovers && muc.skipped >= 1
          && near(g(vz).master, 1) && near(g(vz).music, .7) && near(g(vz).ui, 1) && vz.voice && vz.voice.vol === 0;
        check('routing', ok, JSON.stringify(rows));
        // smooth: a slider moved while the music plays
        const a = await info(P);
        const ramp = await P.evaluate(async () => { const S = []; __settings.set('music', .2); for (let k = 0; k < 8; k++) { S.push(+__ui.theme.info().bus.music.toFixed(4)); await new Promise(r => setTimeout(r, 40)); } return S; });
        const z = await settle();
        const glides = ramp.some(v => v < .699 && v > .1405) && ramp[ramp.length - 1] <= ramp[0] && near(g(z).music, .14);
        check('smooth', a.th.t0 === z.th.t0 && a.th.plays === z.th.plays && z.th.sources === 2 && glides, JSON.stringify({ t0: [a.th.t0, z.th.t0], plays: [a.th.plays, z.th.plays], sources: z.th.sources, musicGainSampled: ramp, settled: g(z).music }));
        // persist: real sliders, then a reload
        await P.click('#menu [data-go=settings]'); await sleep(400);
        await P.evaluate(() => { __settings.set('music', 1); __settings.set('ui', 1); }); await sleep(100);   // a known point; then real keys
        await P.focus('#stMusic'); for (let k = 0; k < 12; k++) await P.keyboard.press('ArrowLeft');   // 100 -> 40
        await P.focus('#stUi'); for (let k = 0; k < 8; k++) await P.keyboard.press('ArrowLeft');      // 100 -> 60
        await sleep(300);
        const saved = await P.evaluate(() => JSON.parse(localStorage.getItem('fb_settings_v1') || '{}'));
        const P2 = await ctx.newPage(); await P.close();
        const m2 = await menu(ctx, s.port, P2); const r2 = await info(m2.P);
        await m2.P.click('#menu [data-go=settings]'); await sleep(400);
        const shown = await m2.P.evaluate(() => ({ music: [document.getElementById('stMusic').value, document.getElementById('stMusicV').textContent], ui: [document.getElementById('stUi').value, document.getElementById('stUiV').textContent] }));
        check('persist', near(saved.music, .4) && near(saved.ui, .6) && near(r2.s.music, .4) && near(r2.s.ui, .6) && near(g(r2).music, .28) && near(g(r2).uiLevel, .6, 1e-9) && r2.made <= 2 && r2.th.plays === 1
          && shown.music[0] === '40' && shown.music[1] === '40%' && shown.ui[0] === '60' && shown.ui[1] === '60%' && !m2.errs.length && !errs.length,
          JSON.stringify({ saved: { music: saved.music, ui: saved.ui, vol: saved.vol }, afterReload: { settings: { music: r2.s.music, ui: r2.s.ui }, bus: g(r2), audioContextsMade: r2.made, musicStarts: r2.th.plays, shown } }));
      } finally { await ctx.close(); }
      // old saves
      const rows = [];
      for (const [label, saved, want] of [['a save from before P8', { c: '', s: 1, o: 1, vol: .8, rm: 'auto', v: 2 }, [1, 1]], ['damaged values', { vol: 1, music: 'x', ui: -3, rm: 'auto', v: 2 }, [1, 0]], ['too loud', { vol: 1, music: 7, ui: 2, rm: 'auto', v: 2 }, [1, 1]]]) {
        const c2 = await b.newContext({ viewport: { width: 1280, height: 720 } });
        try {
          await c2.addInitScript(o => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('fb_settings_v1', JSON.stringify(o)); sessionStorage.setItem('seeded', '1'); } } catch (e) { } }, saved);
          const { P } = await menu(c2, s.port), r = await info(P);
          rows.push({ label, saved, read: [r.s.music, r.s.ui], bus: r.th.bus, ok: r.s.music === want[0] && r.s.ui === want[1] && near(r.th.bus.music, .7 * want[0]) && r.th.bus.uiLevel === want[1] && (label !== 'a save from before P8' || near(r.th.bus.master, .8)) });
        } finally { await c2.close(); }
      }
      check('old_saves', rows.every(r => r.ok), JSON.stringify(rows));
    }
  } catch (e) { check('error', false, String(e && e.stack || e).slice(0, 600)); }
  finally { s.stop(); await b.close(); }
  R.ok = cases.length > 0 && cases.every(c => c.ok);
  if (ARG.mutants === '1') { await mutants(R); if (R.mutantsCaught !== R.mutantIds.length) R.ok = false; }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  console.log(`UI AUDIO: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases${R.mutants ? `; mutants ${R.mutantsCaught} of ${R.mutantIds.length} caught` : ''}`);
  process.exitCode = R.ok ? 0 : 1;
})();
