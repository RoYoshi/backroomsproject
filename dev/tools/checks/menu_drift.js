#!/usr/bin/env node
/* dev/tools/checks/menu_drift.js - post-3H Trial 1: the main menu's title drift, seen from a real Chromium (development only).
 *
 *   node dev/tools/checks/menu_drift.js --new-dir DIR --old-dir DIR [--out FILE.json] [--shots DIR] [--mutants 1]
 *
 * DIR: two complete game folders (server.js, public/, generated/, src/), each served by its own `node server.js PORT` with a synthetic
 * admin passcode (ADMIN_PASSCODE; nothing here logs in).  --old-dir is the accepted baseline (C5d), whose title does not drift; --new-dir
 * the candidate.  Chromium is headless and draws with SwiftShader (no physical GPU).  The boot gate is passed as a player passes it (a
 * key, or a tap on a phone), after the page is read without a user gesture.  The page's own code is not replaced; two read-only
 * observers are added before it runs: a count of requestAnimationFrame calls made by assets/ui.js (from the caller's stack), and a
 * count of writes to the title's style attribute (a MutationObserver).  The title's offset is read from its computed transform, minus
 * its centring (-50% of its width) and the pointer's lean (--mx * 6 px, --my * 4 px, ui.css's own formula).
 *
 * The candidate, checked (each a named check in the report):
 *   static      the mouse never moved, 20 s: the title moves (at least 10 distinct offsets in 41 samples), never more than 3 px on an
 *               axis from where it rests, never more than 1.5 px between two samples 0.5 s apart; ui.js asks for at most one frame per
 *               frame (one loop); the pointer's lean is untouched (--mx, --my unset)
 *   hidden      the tab hidden (simulated: document.hidden and visibilityState read as hidden, then visibilitychange, which is what the
 *               page listens to; a hidden tab gets no animation frames anyway, so this proves the loop is cancelled, not merely
 *               starved): no frame asked for and no style written for 2 s; shown again, it resumes where it was (within 0.25 px)
 *   reduced     Settings -> Reduced motion On: the loop stops, the title rests (offset 0) and nothing is written for 3 s; Off again:
 *               it drifts again from rest, one loop; ten quick On/Off switches still leave exactly one loop; System with the device
 *               asking for reduced motion (changed while the page runs): it stops; and back
 *   boot_os     a page that boots with the device asking for reduced motion (Settings at System): the drift never starts
 *   play        ENTER LEVEL 0: in the run, no frame asked for and nothing written for 3 s; back through pause -> NEW RUN -> END, the
 *               menu's title drifts again, one loop
 *   pointer     the mouse moved to the upper right and held still: the lean is C5d's (the same --mx, --my on both sides), the title
 *               keeps drifting around it, never more than 0.6 px between two samples 0.1 s apart (no jump)
 * Both sides, compared (the drift is the only allowed difference):
 *   layout      at 1920x1080, 2560x1080 (ultrawide), 1366x768 at 1.5x and a 390x844 phone at 3x with touch: every visible control's box
 *               in the menu (its hit area) the same on both sides, to 0.5 px; the menu's text the same; the order Tab visits the menu's
 *               controls the same; the title's box at rest (minus the drift) the same; no horizontal scroll; the drift within bounds
 *   logo        the logo's bytes as served, and index.html's, the same on both sides
 *   theme       the menu music's state after the gate, and the sound button's state after one press, the same on both sides
 * --shots DIR: a 1920x1080 and a 390x844 capture of each side's menu, and the candidate's title every 5 s for 20 s (PNG crops).
 * --mutants 1: the check's own sensitivity: eight edits of a copy of the candidate's built ui.js or ui.css, each of which one of the
 *   checks above must fail (the amplitude tripled; reduced motion ignored; a hidden tab ignored; a second loop on each switch; no drift
 *   at all; a control moved; the run ignored; the drift's clock reset on each pause), the unchanged copy having passed above.
 * --only candidate|compare: one of the two halves (while developing; the gate runs both).
 * --work DIR: where the mutants' game copies are made (default: the system's temporary folder); each is removed after its run.
 * Each server is stopped by its PID.  Exit 0 only when every check holds (and, with --mutants, every mutant is caught). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net'), crypto = require('crypto'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG['new-dir'] || !ARG['old-dir']) { console.error('--new-dir DIR and --old-dir DIR are required (two complete game folders)'); process.exit(2); }
const NEW = path.resolve(ARG['new-dir']), OLD = path.resolve(ARG['old-dir']);
const ONLY = (ARG.only || 'candidate,compare').split(',');   // (development: --only candidate | compare)
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PASS = 't1-synthetic-admin';
const BOUND = { x: 3, y: 3, step05: 1.5, step01: .6, resume: .25, rest: .02 };   // px: ui.css's --drx / --dry; the largest steps allowed;
                                                                              // rest: a resting title's offset (sub-pixel rounding at 1.5x and 3x)
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { const b = []; q.on('data', d => b.push(d)); q.on('end', () => r({ status: q.statusCode, body: Buffer.concat(b) })); }).on('error', e => r({ status: 0, error: String(e) })));
async function serve(dir) {
  const port = await freePort();
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { if ((await get(port, '/index.html')).status === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('the server in ' + dir + ' did not start');
}
const stop = async s => { if (!s) return; try { process.kill(s.p.pid); } catch (e) { } for (let i = 0; i < 50 && s.p.exitCode === null && s.p.signalCode === null; i++) await sleep(50); };
/* read-only observers, installed before the page's own scripts */
const OBS = `(() => { const T = window.__t1 = { ui: 0, all: 0, mut: 0, ts: -1, n: 0, max: 0, uiFrames: 0 }; const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { T.all++; let ui = false; try { ui = /\\/assets\\/ui\\.js/.test(new Error().stack || ''); } catch (e) { }
    if (!ui) return raf.call(window, cb);
    T.ui++; return raf.call(window, ts => { if (ts !== T.ts) { T.ts = ts; T.n = 0; T.uiFrames++; } T.n++; if (T.n > T.max) T.max = T.n; return cb(ts); }); };
  const watch = () => { const t = document.getElementById('mmTitle'); if (!t) return setTimeout(watch, 50); new MutationObserver(l => { T.mut += l.length; }).observe(t, { attributes: true, attributeFilter: ['style'] }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch(); })();`;
const HIDE = `(() => { const D = Document.prototype; window.__t1hidden = (h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }; })();`;
const ev = (cdp, expr) => cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: false }).then(r => r.exceptionDetails ? null : r.result && r.result.value).catch(() => null);
async function open(b, port, { viewport = { width: 1920, height: 1080 }, dpr = 1, mobile = false, reduced = false, room = 't1menu' + Date.now() % 1e6 } = {}) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const P = await ctx.newPage(), errs = [], cdp = await ctx.newCDPSession(P);
  await P.addInitScript(OBS); await P.addInitScript(HIDE);
  P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  let st = null; for (let i = 0; i < 900; i++) { st = await ev(cdp, 'window.__boot ? __boot.state() : null'); if (st === 'ready' || st === 'menu' || st === 'error') break; await sleep(100); }
  if (st === 'ready') { if (mobile) await P.touchscreen.tap(viewport.width / 2, viewport.height * .62); else await P.keyboard.press('Space'); }
  for (let i = 0; i < 300; i++) { st = await ev(cdp, 'window.__boot ? __boot.state() : null'); if (st === 'menu') break; await sleep(100); }
  for (let i = 0; i < 100; i++) { if (await ev(cdp, `(() => { const m = document.getElementById('menu'); return !!m && !m.hidden && !m.classList.contains('mm-intro'); })()`)) break; await sleep(100); }
  await sleep(400);
  return { ctx, P, cdp, errs, boot: st };
}
/* the title's offset from rest: its computed translation minus its centring and the pointer's lean */
const OFFSET = () => { const t = document.getElementById('mmTitle'), m = document.getElementById('menu'), cs = getComputedStyle(t), M = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
  const mx = parseFloat(m.style.getPropertyValue('--mx')) || 0, my = parseFloat(m.style.getPropertyValue('--my')) || 0;
  return { x: +(M.m41 + parseFloat(cs.width) / 2 - mx * 6).toFixed(3), y: +(M.m42 - my * 4).toFixed(3), mx, my, at: performance.now() }; };
const counters = P => P.evaluate(() => Object.assign({}, window.__t1, { drift: window.__ui && __ui.drift ? __ui.drift() : null }));
async function samples(P, n, every) { const out = []; for (let i = 0; i < n; i++) { out.push(await P.evaluate(OFFSET)); if (i < n - 1) await sleep(every); } return out; }
const frameCount = (P, ms) => P.evaluate(ms => new Promise(r => { const t0 = performance.now(); let k = 0; const f = () => { k++; if (performance.now() - t0 >= ms) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), ms);
/* how many frames ui.js asks for, per frame, over ms (one loop: about 1) */
async function loopRatio(P, ms = 2000) { await P.evaluate(() => { window.__t1.max = 0; }); const a = await counters(P); const f = await frameCount(P, ms); const b = await counters(P);
  return { uiCalls: b.ui - a.ui, uiFrames: b.uiFrames - a.uiFrames, frames: f, maxPerFrame: b.max, one: b.max === 1 && b.uiFrames - a.uiFrames > 0 }; }
async function quiet(P, ms) { const a = await counters(P); const s = await samples(P, Math.max(2, Math.round(ms / 500) + 1), 500); const b = await counters(P);
  return { uiCalls: b.ui - a.ui, writes: b.mut - a.mut, still: s.every(o => Math.abs(o.x - s[0].x) < .001 && Math.abs(o.y - s[0].y) < .001), first: s[0], running: b.drift && b.drift.running }; }
const stats = s => { const d = []; for (let i = 1; i < s.length; i++) d.push(Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
  return { n: s.length, distinct: new Set(s.map(o => o.x + ',' + o.y)).size, maxX: Math.max(...s.map(o => Math.abs(o.x))), maxY: Math.max(...s.map(o => Math.abs(o.y))), maxStep: d.length ? Math.max(...d) : 0 }; };
const setRm = (P, v) => P.evaluate(v => window.__settings.set('rm', v), v);
async function waitRunning(P, want, ms = 3000) { for (let t = 0; t < ms; t += 100) { const c = await counters(P); if (c.drift && c.drift.running === want) return true; await sleep(100); } return false; }

/* ---------------------------------------------------------------- the candidate's own checks */
async function candidateChecks(b, port, shots, quick) {
  const C = {}, s = await open(b, port), { P } = s;
  try {
    C.boot = { state: s.boot, ok: s.boot === 'menu' };
    // static: no pointer at all
    const c0 = await counters(P), st = await samples(P, quick ? 13 : 41, 500), S1 = stats(st), lr = await loopRatio(P);
    const mxSet = await P.evaluate(() => [document.getElementById('menu').style.getPropertyValue('--mx'), document.getElementById('menu').style.getPropertyValue('--my')]);
    C.static = { samples: S1, loop: lr, drift: c0.drift, pointerVars: mxSet,
      ok: S1.distinct >= (quick ? 4 : 10) && S1.maxX <= BOUND.x + .01 && S1.maxY <= BOUND.y + .01 && S1.maxStep <= BOUND.step05 && lr.one && !mxSet[0] && !mxSet[1] && !!(c0.drift && c0.drift.running) };
    if (shots) {                                         // the title every 5 s, in a fixed frame around its resting box (it never holds still)
      const r = await P.evaluate(() => { const b = document.getElementById('mmTitle').getBoundingClientRect(); return { x: b.left - 12, y: b.top - 12, width: b.width + 24, height: b.height + 24 }; });
      for (let i = 0; i < 5; i++) { await P.screenshot({ path: path.join(shots, `title_drift_${i * 5}s.png`), clip: r }); if (i < 4) await sleep(5000); }
    }
    // hidden (simulated), resumed where it was: hide when the title is well away from rest, so a reset would show
    for (let i = 0; i < 80; i++) { const o = await P.evaluate(OFFSET); if (Math.hypot(o.x, o.y) > 1) break; await sleep(250); }
    const before = await P.evaluate(OFFSET);
    await P.evaluate(() => window.__t1hidden(true)); await sleep(150);
    const hq = await quiet(P, 2000);
    await P.evaluate(() => window.__t1hidden(false)); await sleep(60);
    const after = await P.evaluate(OFFSET), hl = await loopRatio(P, 1500);
    C.hidden = { quiet: hq, before, after, resumeJump: +Math.hypot(after.x - before.x, after.y - before.y).toFixed(3), loop: hl, simulated: true,
      ok: hq.uiCalls === 0 && hq.writes === 0 && hq.still && !hq.running && Math.hypot(after.x - before.x, after.y - before.y) <= BOUND.resume && hl.one };
    // reduced motion: Settings On / Off, quick switches, System with the device's preference changed while the page runs
    await setRm(P, 'on'); await frameCount(P, 1); await frameCount(P, 1); await sleep(200);   // (html.rm: a 10 ms transition to rest, over by the next frame)
    const rq = await quiet(P, 3000), rest = await P.evaluate(OFFSET), vars = await P.evaluate(() => [document.getElementById('mmTitle').style.getPropertyValue('--dx'), document.getElementById('mmTitle').style.getPropertyValue('--dy')]);
    const k0 = await counters(P); await setRm(P, 'off'); const back = await waitRunning(P, true); await sleep(300); const k1 = await counters(P), ro = await loopRatio(P, 1500);
    for (let i = 0; i < 10; i++) { await setRm(P, i % 2 ? 'off' : 'on'); await sleep(20); }
    await setRm(P, 'off'); await sleep(400); const rs = await loopRatio(P, 2000);
    await P.emulateMedia({ reducedMotion: 'reduce' }); await setRm(P, 'auto'); await frameCount(P, 1); await frameCount(P, 1); await sleep(200); const oq = await quiet(P, 2000);
    await P.emulateMedia({ reducedMotion: 'no-preference' }); const oback = await waitRunning(P, true); await sleep(300); const ol = await loopRatio(P, 1500);
    C.reduced = { on: rq, rest, vars, restartedAfterOff: back, startsAdded: k1.drift.starts - k0.drift.starts, afterOff: ro, afterSwitches: rs, systemReduce: oq, systemBack: oback, afterSystem: ol,
      ok: rq.uiCalls === 0 && rq.writes === 0 && rq.still && !rq.running && Math.abs(rest.x) < BOUND.rest && Math.abs(rest.y) < BOUND.rest && !vars[0] && !vars[1]
        && back && k1.drift.starts - k0.drift.starts === 1 && ro.one && rs.one
        && oq.uiCalls === 0 && oq.writes === 0 && oq.still && !oq.running && oback && ol.one };
    // play: into a run, then back through pause, NEW RUN and END
    await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible', timeout: 30000 });
    await P.fill('#name', 'T1'); await P.click('#enter');
    let inRun = false; for (let i = 0; i < 150; i++) { if (await P.evaluate(() => !!(window.__api && __api.started() && !document.getElementById('hud').hidden))) { inRun = true; break; } await sleep(100); }
    await sleep(1000); const pq = await quiet(P, 3000);
    await P.keyboard.press('Escape'); await P.waitForSelector('#dialog:not([hidden])', { timeout: 15000 }).catch(() => { });
    await P.click('#reset').catch(() => { }); await P.waitForSelector('#runMenu:not([hidden])', { timeout: 20000 }).catch(() => { });
    await P.click('#runEnd').catch(() => { });
    let menuBack = false; for (let i = 0; i < 150; i++) { if (await P.evaluate(() => { const m = document.getElementById('menu'); return !!m && !m.hidden; })) { menuBack = true; break; } await sleep(100); }
    const pb = await waitRunning(P, true, 6000); await sleep(1500); const pl = await loopRatio(P, 1500), ps = stats(await samples(P, 7, 500));
    C.play = { inRun, inRunQuiet: pq, menuBack, driftBack: pb, loop: pl, samples: ps,
      ok: inRun && pq.uiCalls === 0 && pq.writes === 0 && !pq.running && menuBack && pb && pl.one && ps.distinct >= 3 && ps.maxX <= BOUND.x + .01 && ps.maxY <= BOUND.y + .01 };
    // pointer: the lean, then held still
    const vp = P.viewportSize(); await P.mouse.move(vp.width * .5, vp.height * .5);
    for (let i = 1; i <= 10; i++) { await P.mouse.move(vp.width * (.5 + .035 * i), vp.height * (.5 - .025 * i)); await sleep(30); }
    await sleep(200); const ptr = await samples(P, 41, 100), PS = stats(ptr), lean = ptr[ptr.length - 1];
    C.pointer = { lean: { mx: lean.mx, my: lean.my }, samples: PS,
      ok: Math.abs(lean.mx - .7) < .02 && Math.abs(lean.my + .5) < .02 && PS.maxStep <= BOUND.step01 && PS.distinct >= 3 && PS.maxX <= BOUND.x + .01 && PS.maxY <= BOUND.y + .01 };
    C.pageErrors = { list: s.errs.slice(0, 5), ok: !s.errs.length };
  } finally { await s.ctx.close(); }
  // boot with the device asking for reduced motion (Settings at System, the default)
  const r = await open(b, port, { reduced: true });
  try { const q = await quiet(r.P, 3000), c = await counters(r.P);
    C.boot_os = { quiet: q, drift: c.drift, ok: r.boot === 'menu' && q.uiCalls === 0 && q.writes === 0 && q.still && c.drift && c.drift.starts === 0 && c.drift.frames === 0 && Math.abs(q.first.x) < BOUND.rest && Math.abs(q.first.y) < BOUND.rest };
  } finally { await r.ctx.close(); }
  return C;
}

/* ---------------------------------------------------------------- both sides, compared */
const VIEWS = [['1920x1080', { viewport: { width: 1920, height: 1080 } }], ['2560x1080', { viewport: { width: 2560, height: 1080 } }],
  ['1366x768@1.5', { viewport: { width: 1366, height: 768 }, dpr: 1.5 }], ['390x844@3 touch', { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true }]];
const LAYOUT = () => { const m = document.getElementById('menu'), q = '#menu button, #menu a[href], #menu input, #menu select, #menu [tabindex]';
  const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
  const box = e => { const r = e.getBoundingClientRect(); return [+r.left.toFixed(2), +r.top.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2)]; };
  const ctl = [...document.querySelectorAll(q)].filter(vis).map(e => [e.id || e.className || e.tagName, box(e)]);
  const t = document.getElementById('mmTitle'), tb = box(t), dx = parseFloat(t.style.getPropertyValue('--dx')) || 0, dy = parseFloat(t.style.getPropertyValue('--dy')) || 0;
  const c = m.cloneNode(true); for (const id of ['mmRoom', 'mmLink', 'mmInside', 'mmShared', 'mmVer']) { const e = c.querySelector('#' + id); if (e) e.textContent = '(' + id + ')'; }
  return { controls: ctl, text: c.textContent.replace(/\s+/g, ' ').trim(), titleRest: [+(tb[0] - dx * 3).toFixed(1), +(tb[1] - dy * 3).toFixed(1), tb[2], tb[3]],
    scroll: { w: document.scrollingElement.scrollWidth, iw: innerWidth }, drift: window.__ui.drift ? __ui.drift() : null }; };
async function tabOrder(P, n = 14) { await P.evaluate(() => { const p = document.getElementById('mmPlay'); if (p) p.focus(); }); const ids = [];
  for (let i = 0; i < n; i++) { ids.push(await P.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('aria-label') || a.className || a.tagName) : null; })); await P.keyboard.press('Tab'); }
  await P.evaluate(() => document.activeElement && document.activeElement.blur()); return ids; }
async function sideLayout(b, port, label, shots) {
  const out = {};
  for (const [name, o] of VIEWS) {
    const s = await open(b, port, o);
    try { out[name] = await s.P.evaluate(LAYOUT); out[name].tab = o.mobile ? null : await tabOrder(s.P); out[name].offset = await s.P.evaluate(OFFSET); out[name].errors = s.errs.slice(0, 3);
      if (shots && (name === '1920x1080' || name.startsWith('390x844'))) await s.P.screenshot({ path: path.join(shots, `${label}_menu_${name.split('@')[0]}.png`) });
    } finally { await s.ctx.close(); }
  }
  return out;
}
async function sideMisc(b, port) {
  const s = await open(b, port);
  try {
    const theme = await s.P.evaluate(() => { const i = window.__ui.theme.info(); return { state: i.state, want: i.want, begun: i.begun, ctx: i.ctx, muted: i.muted, sources: i.sources, plays: i.plays, loads: i.loads, error: i.error || null }; });
    const press = async () => { await s.P.click('#mmSound'); await sleep(300); return s.P.evaluate(() => document.getElementById('mmSound').getAttribute('aria-pressed')); };
    const before = await s.P.evaluate(() => document.getElementById('mmSound').getAttribute('aria-pressed')), after = await press(); await press();
    const logo = await get(port, '/assets/MAIN_MENU_LOGO_USER_SUPPLIED.png'), html = await get(port, '/index.html');
    return { theme, sound: [before, after], logo: crypto.createHash('sha256').update(logo.body).digest('hex'), logoStatus: logo.status, html: crypto.createHash('sha256').update(html.body).digest('hex') };
  } finally { await s.ctx.close(); }
}
function compare(oldL, newL, oldM, newM) {
  const C = {};
  for (const [name] of VIEWS) {
    const o = oldL[name], n = newL[name], diffs = [];
    if (o.controls.length !== n.controls.length) diffs.push(`controls: ${o.controls.length} against ${n.controls.length}`);
    else o.controls.forEach((c, i) => { const d = n.controls[i]; if (c[0] !== d[0] || c[1].some((v, k) => Math.abs(v - d[1][k]) > .5)) diffs.push(`${c[0]} ${JSON.stringify(c[1])} against ${d[0]} ${JSON.stringify(d[1])}`); });
    if (o.text !== n.text) { let i = 0; while (i < o.text.length && o.text[i] === n.text[i]) i++; diffs.push('the menu text differs at ' + i + ': ' + JSON.stringify(o.text.slice(i, i + 60)) + ' against ' + JSON.stringify(n.text.slice(i, i + 60))); }
    if (JSON.stringify(o.tab) !== JSON.stringify(n.tab)) diffs.push('the Tab order differs: ' + JSON.stringify(o.tab) + ' against ' + JSON.stringify(n.tab));
    if (o.titleRest.some((v, k) => Math.abs(v - n.titleRest[k]) > .5)) diffs.push('the title at rest: ' + JSON.stringify(o.titleRest) + ' against ' + JSON.stringify(n.titleRest));
    const scroll = n.scroll.w <= n.scroll.iw, bound = Math.abs(n.offset.x) <= BOUND.x + .01 && Math.abs(n.offset.y) <= BOUND.y + .01, oldStill = !o.drift && Math.abs(o.offset.x) < BOUND.rest && Math.abs(o.offset.y) < BOUND.rest;
    C[name] = { controls: n.controls.length, tab: n.tab, diffs, scroll, newDrifting: !!(n.drift && n.drift.running), newOffset: n.offset, oldOffset: o.offset, oldStill, errors: [].concat(o.errors, n.errors),
      ok: !diffs.length && scroll && bound && !!(n.drift && n.drift.running) && oldStill && !o.errors.length && !n.errors.length };
  }
  C.logo = { old: oldM.logo, new: newM.logo, html: oldM.html === newM.html, ok: oldM.logoStatus === 200 && oldM.logo === newM.logo && oldM.html === newM.html };
  C.theme = { old: oldM.theme, new: newM.theme, sound: [oldM.sound, newM.sound], ok: JSON.stringify(oldM.theme) === JSON.stringify(newM.theme) && JSON.stringify(oldM.sound) === JSON.stringify(newM.sound) && newM.sound[0] !== newM.sound[1] };
  return C;
}

/* ---------------------------------------------------------------- the check's own mutants */
const MUTANTS = [
  ['amplitude', 'assets/ui.css', '--drx:3px;--dry:3px;', '--drx:9px;--dry:9px;', 'static'],
  ['reduced_ignored', 'assets/ui.js', '&& !document.hidden && !reduced());', '&& !document.hidden);', 'reduced'],
  ['hidden_ignored', 'assets/ui.js', '&& vis(\'menu\') && !document.hidden && !reduced());', '&& vis(\'menu\') && !reduced());', 'hidden'],
  ['second_loop', 'assets/ui.js', '    if (drift.raf) return;\n    menu.classList.add(\'mm-drift\')', '    menu.classList.add(\'mm-drift\')', 'reduced'],
  ['no_drift', 'assets/ui.js', '  driftHook = driftSync;\n', '  driftHook = null;\n', 'static'],
  ['control_moved', 'assets/ui.css', '#menu.mm-drift .mm-title{will-change:transform}', '#menu.mm-drift .mm-title{will-change:transform}\n#menu .mm-play{translate:0 2px}', 'layout'],
  ['run_ignored', 'assets/ui.js', '!!(menu && titleEl && revealed && vis(\'menu\') && ', '!!(menu && titleEl && revealed && ', 'play'],
  ['clock_reset', 'assets/ui.js', '    drift.last = 0;\n    if (rest && ', '    drift.last = 0; drift.t = 0;\n    if (rest && ', 'hidden'],
];
function copyGame(src, dst) { fs.mkdirSync(dst, { recursive: true }); execFileSync('cp', ['-a', src + path.sep + '.', dst]); }   // (src/. : its contents)

(async () => {
  const R = { tool: 'dev/tools/checks/menu_drift.js', new: NEW, old: OLD, bounds: BOUND, chromium: null, checks: {}, ok: true };
  const shots = ARG.shots ? path.resolve(ARG.shots) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); R.chromium = b.version();
  let sn = null, so = null;
  try {
    sn = await serve(NEW); so = await serve(OLD);
    if (ONLY.includes('candidate')) { const cand = await candidateChecks(b, sn.port, shots, false); for (const [k, v] of Object.entries(cand)) R.checks[k] = v; }
    let ol = null, om = null;
    if (ONLY.includes('compare') || ARG.mutants === '1') {
      const nl = await sideLayout(b, sn.port, 'new', shots), nm = await sideMisc(b, sn.port); ol = await sideLayout(b, so.port, 'old', shots); om = await sideMisc(b, so.port);
      const cmp = compare(ol, nl, om, nm);
      R.checks.layout = { views: Object.fromEntries(VIEWS.map(([n]) => [n, cmp[n]])), ok: VIEWS.every(([n]) => cmp[n].ok) };
      R.checks.logo = cmp.logo; R.checks.theme = cmp.theme;
    }
    if (ARG.mutants === '1') {
      await stop(sn); sn = null;
      const work = fs.mkdtempSync(path.join(ARG.work ? path.resolve(ARG.work) : os.tmpdir(), 't1-mutants-')); R.mutants = [];
      try {
        for (const [id, file, from, to, check] of MUTANTS) {
          const dir = path.join(work, id); copyGame(NEW, dir); const f = path.join(dir, 'public', file), t = fs.readFileSync(f, 'utf8');
          if (t.split(from).length !== 2) { R.mutants.push({ id, check, applied: false, caught: false }); continue; }
          fs.writeFileSync(f, t.replace(from, to));
          const sm = await serve(dir); let caught = false, failed = [];
          try {
            if (check === 'layout') { const ml = await sideLayout(b, sm.port, 'mutant', null), mc = compare(ol, ml, om, om); failed = VIEWS.filter(([n]) => !mc[n].ok).map(([n]) => 'layout ' + n); }
            else { const mc = await candidateChecks(b, sm.port, null, true); failed = Object.entries(mc).filter(([, v]) => !v.ok).map(([k]) => k); }
            caught = failed.some(x => x.startsWith(check));
          } finally { await stop(sm); fs.rmSync(dir, { recursive: true, force: true }); }
          R.mutants.push({ id, file, check, applied: true, failed, caught });
          console.log(`mutant ${id}: ${caught ? 'caught' : 'MISSED'} (failed: ${failed.join(', ') || 'none'})`);
        }
      } finally { fs.rmSync(work, { recursive: true, force: true }); }
      R.mutantsCaught = R.mutants.filter(m => m.caught).length;
      if (R.mutantsCaught !== MUTANTS.length) R.ok = false;
    }
  } catch (e) { R.error = String(e && e.stack || e); R.ok = false; }
  finally { await stop(sn); await stop(so); await b.close(); }
  for (const [k, v] of Object.entries(R.checks)) { if (!v.ok) R.ok = false; console.log(`${v.ok ? 'ok  ' : 'FAIL'} ${k}`); }
  if (R.error) console.log(R.error);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  console.log(`MENU DRIFT: ${R.ok ? 'PASS' : 'FAIL'} (${Object.values(R.checks).filter(c => c.ok).length} of ${Object.keys(R.checks).length} checks${R.mutants ? `; mutants ${R.mutantsCaught} of ${MUTANTS.length} caught` : ''})`);
  process.exitCode = R.ok ? 0 : 1;
})();
