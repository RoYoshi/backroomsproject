#!/usr/bin/env node
/* dev/trial-3-behavior-refinement/tools/behave_browser.js - the behaviour refinement in real pages (development only; the checkpoints'
 * browser evidence, not a gate step).  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-behavior-refinement/tools/behave_browser.js [--dir DIR] [--out FILE.json] [--shots DIR] [--secs 90]
 *
 * One server (`node server.js PORT` in DIR, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader), two
 * pages in one fresh room.  The world is frozen and emptied of Hounds and Smilers while it is set up (the panel's own commands on the
 * game's socket, as dev/trial-3-skin-stealer/tools/skin_browser.js does).
 *   1. A satiated Skin-Stealer, by the game's own means: one is put near the first page (K3Prey), which plays a death from the SKIN tab's
 *      preview through the real kill path; it feeds about 5 s; then the second page (K3Pest, the person under test, out of its sight in
 *      god mode until then) comes into its view and disturbs it: it leaves its meal (too soon to wear a skin), its hunger down by the kill.
 *   2. The person runs circles round it, 130 px off (15 s), then presses in on it, 65 px off, facing it, for up to --secs.  They are
 *      moved by keys (W A S D, Shift to run) and face it with the mouse, as key and mouse events in their own page (the game's own handlers
 *      take them): the page's own movement and its own velocities on the wire (the server's AI reads those; a teleport would report a
 *      person standing still).  The steering runs inside the page every 60 ms (a round trip from here takes too long in a software-
 *      rendered page to keep up with it).
 *   Recorded on the person's page: the server's admin debug data for it (window.__ents.dbg: its awareness of them, its reaction, its last
 *   defence), the snapshot's state and act codes for it, the lines the admin overlay draws (AWARE, DEFENCE), the creature's noise sources
 *   started (its wind-up's tell), and their own death if it comes (the page's death: its kind).
 * Checks: it noticed them (an awareness record, a look); it warned them (state PROVOKED, act creep, on the wire); it defended itself
 * (a decision: strike or withdraw); a strike showed its wind-up on the wire (act wind) with its sound; a death, if any, is the
 * Skin-Stealer's on the victim's own page; the overlay drew the new lines; no page error.  A strike is the creature's own seeded choice:
 * a run with only withdrawals passes the defence check and reports that no strike came.  Every name and passcode is synthetic. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = { secs: '90' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), PASS = 'k3-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const AI = require(path.join(DIR, 'generated', 'server', 'ai.js'));
const SCODE = AI.SCODE, KACT = AI.KACT;
/* before the page's scripts: the game socket kept (the panel's commands), every snapshot's ss list noted (as skin_browser.js) */
const INIT = `(() => {
  const S = window.WebSocket; window.__k3 = { game: null, unlocked: false, ss: null, keys: '', snaps: 0 };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__k3.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data);
      if (m.t === 'admin' && m.ok) window.__k3.unlocked = true;
      if (m.t === 's' && m.e) { window.__k3.snaps++; window.__k3.ss = m.e.ss || null; window.__k3.keys = Object.keys(m.e).join(','); } } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
  let mp = null; Object.defineProperty(window, '__mp', { configurable: true, get: () => mp ? (a => { window.__k3.cam = { x: a.cam.x, y: a.cam.y, sc: a.sc }; return mp(a); }) : mp, set: f => { mp = f; } });
  window.__k3.screen = (x, y) => { const c = window.__k3.cam; return c ? { x: innerWidth / 2 + (x - c.x) * c.sc, y: innerHeight / 2 + (y - c.y) * c.sc } : null; };
})();`;
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000, every = 50) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } }
async function runPage(b, port, room, vp, name) {
  const ctx = await b.newContext({ viewport: vp }); await ctx.addInitScript(INIT);
  const P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', name);
  await P.bringToFront(); await P.click('#enter');
  await until(P, () => !!(window.__net && __net.on && window.__k3.game && window.__api.started()), null, 30000);
  await sleep(2500);
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__k3.unlocked, null, 5000);
  return { ctx, P, errs, cmd: o => P.evaluate(o => window.__k3.game.send(JSON.stringify(Object.assign({ t: 'a' }, o))), o) };
}
/* the person, inside their own page every 60 ms (no round trip to this script, so it keeps up): W A S D toward a point and Shift to run,
 * as key events on the window (the game's own movement handler reads them), the mouse on the creature (the game's facing); first circling
 * it 130 px off, then pressing in 65 px off.  It records, twice a second, what the page has: the snapshot's entry for it, the admin debug
 * data for it, its own death. */
const BOT = `(o) => { const K = window.__k3, held = new Set(), key = (c, down) => { if (down === held.has(c)) return; if (down) held.add(c); else held.delete(c);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c, key: c === 'ShiftLeft' ? 'Shift' : c.slice(3).toLowerCase(), bubbles: true })); };
  const cv = document.querySelector('canvas'); let phi = null, last = -1; K.rec = []; K.botDone = false; const t0 = performance.now();
  K.bot = setInterval(() => {
    const t = (performance.now() - t0) / 1000, k = (K.ss || [])[0], A = __api, H = A.H, D = A.death && A.death();
    if (D && D.active) { K.death = K.death || { t: +t.toFixed(1), kind: D.kind, v: D.variant }; }
    if (!k || (D && D.active) || t > o.orbit + o.press) { for (const c of [...held]) key(c, false); clearInterval(K.bot); K.botDone = true; return; }
    const ph = t < o.orbit ? 'orbit' : 'press', d = Math.hypot(H.x - k.x, H.y - k.y) || 1; let tx, ty, run;
    if (ph === 'orbit') { if (phi === null) phi = Math.atan2(H.y - k.y, H.x - k.x); phi += .16; tx = k.x + Math.cos(phi) * 130; ty = k.y + Math.sin(phi) * 130; run = true; }
    else { tx = k.x + (H.x - k.x) / d * 65; ty = k.y + (H.y - k.y) / d * 65; run = d > 160; }
    const dx = tx - H.x, dy = ty - H.y, m = Math.hypot(dx, dy);
    key('KeyD', m > 14 && dx > m * .38); key('KeyA', m > 14 && dx < -m * .38); key('KeyS', m > 14 && dy > m * .38); key('KeyW', m > 14 && dy < -m * .38); key('ShiftLeft', m > 14 && run);
    const s = K.screen(k.x, k.y); if (s && cv) { const ev = { clientX: s.x, clientY: s.y, bubbles: true }; cv.dispatchEvent(new MouseEvent('mousemove', ev)); window.dispatchEvent(new MouseEvent('mousemove', ev)); }
    if (Math.floor(t * 2) !== last) { last = Math.floor(t * 2); const g = (window.__ents.dbg || []).find(x => x.i === k.i), q = g && g.sk;
      K.rec.push({ t: +t.toFixed(1), ph, d: Math.round(d), s: k.s, ac: k.ac, h: +(+k.h || 0).toFixed(2), pl: q ? q.pl : '', aw: q && q.aw ? q.aw : null, rx: q && q.rx ? q.rx.k : '', df: q && q.df ? q.df : null, hu: q ? q.hu : null, vx: Math.round(H.vx || 0), vy: Math.round(H.vy || 0), at: performance.now() }); }
  }, 60); }`;
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const R = { tool: 'dev/trial-3-behavior-refinement/tools/behave_browser.js', chromium: b.version(), secs: +ARG.secs }, cases = [];
  const check = (name, ok, detail) => cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 900) });
  try {
    const room = 'br' + (Date.now() % 1e6), VP = { width: 640, height: 360 };   // (a small page: software rendering at 1280x720 gives the page about 1-2 frames a second, too few for its own steering)
    const V = await runPage(b, port, room, VP, 'K3Prey');
    V.cmd({ c: 'freeze', on: true }); V.cmd({ c: 'hounds', mode: 'remove', n: 10 }); V.cmd({ c: 'smilers', mode: 'remove', n: 10 });
    const A = await runPage(b, port, room, VP, 'K3Pest');
    V.cmd({ c: 'hounds', mode: 'remove', n: 10 }); V.cmd({ c: 'smilers', mode: 'remove', n: 10 });
    const aid = await A.P.evaluate(() => __api.H.id); V.cmd({ c: 'god', id: aid }); await sleep(300);
    // the person far off (god mode: unperceived) while the creature kills and feeds
    const vpos = await V.P.evaluate(() => ({ x: __api.H.x, y: __api.H.y }));
    R.away = await A.P.evaluate(from => { const A = __api; for (const r of [2600, 2200, 3000]) for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, x = from.x + Math.cos(a) * r, y = from.y + Math.sin(a) * r; if (A.sl(x, y, 30)) { A.tp(x, y); return { x: Math.round(x), y: Math.round(y) }; } } return null; }, vpos);
    await sleep(1200);
    V.cmd({ c: 'near', k: 'skinstealer' });
    R.eid = await until(A.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0].i : null, null, 8000);
    V.cmd({ c: 'preview', k: 'skinstealer', var: 'A' });
    R.preyDeath = await until(V.P, () => { const D = __api.death(); return D && D.active ? { kind: D.kind, v: D.variant } : null; }, null, 6000, 20);
    V.cmd({ c: 'freeze', on: false });
    A.cmd({ c: 'debug', on: true });
    const dbg = () => A.P.evaluate(eid => { const d = (window.__ents.dbg || []).find(x => x.i === eid); return d && d.sk ? { x: d.x, y: d.y, sk: d.sk } : null; }, R.eid);
    await until(A.P, eid => { const d = (window.__ents.dbg || []).find(x => x.i === eid); return d && d.sk && d.sk.pl === 'feed' ? 1 : 0; }, R.eid, 15000, 100);
    await sleep(3000);                                                                         // it feeds about 3 s (the skin needs 8: it must not wear one)
    R.atMeal = await dbg();
    // the person comes into its view, 380 px off, where it looks; a person again (no longer god)
    const K0 = await A.P.evaluate(() => (window.__k3.ss || [])[0] || null);
    R.come = await A.P.evaluate(k => { const Z = __api; for (const r of [380, 320, 440]) for (let i = 0; i < 19; i++) { const a = (+k.a || 0) + (i % 2 ? 1 : -1) * Math.ceil(i / 2) / 48 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r; if (Z.sl(x, y, 26) && Z.Uc(k.x, k.y, a, r) >= r - 4) { Z.tp(x, y); return { x: Math.round(x), y: Math.round(y) }; } } return null; }, K0);
    V.cmd({ c: 'god', id: aid }); await sleep(400);
    if (!(await A.P.evaluate(() => __api.lightOn()))) await A.P.keyboard.press('KeyF');
    // the page's overlay lines, and the creature's noise sources (its sounds), counted from now
    await A.P.evaluate(() => { window.__k3.lines = []; const f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) { const s = String(t); if (/^(AWARE|DEFENCE|HUNGER|WHY)/.test(s) && window.__k3.lines.length < 600 && !window.__k3.lines.includes(s)) window.__k3.lines.push(s); return f.call(this, t, x, y, w); };
      Object.assign(window.__ents.dbgCfg, { on: true, ai: true });                       // (the DEBUG tab's own overlay switch, as an admin turns it on)
      window.__k3.src = []; const st = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.numberOfChannels === 1 && this.buffer.length === this.context.sampleRate) window.__k3.src.push(performance.now()); return st.apply(this, a); }; });
    await A.P.bringToFront();
    await A.P.evaluate(`(${BOT})(${JSON.stringify({ orbit: 15, press: +ARG.secs })})`);
    if (SHOTS) {                                                                               // the warning and the wind-up as the person's page draws them
      const shot = { warn: 0, wind: 0 }, end = Date.now() + (15 + +ARG.secs + 20) * 1000;
      while (Date.now() < end && !(await A.P.evaluate(() => !!window.__k3.botDone))) {
        const k = await A.P.evaluate(() => (window.__k3.ss || [])[0] || null);
        if (k && !shot.warn && k.s === SCODE.PROVOKED && k.ac === KACT.creep) { shot.warn = 1; await A.P.screenshot({ path: path.join(SHOTS, 'b4_warning_640.png') }); }
        else if (k && !shot.wind && k.ac === KACT.wind) { shot.wind = 1; await A.P.screenshot({ path: path.join(SHOTS, 'b4_windup_640.png') }); }
        await sleep(120);
      }
    }
    await until(A.P, () => window.__k3.botDone, null, (15 + +ARG.secs + 20) * 1000, 500);
    const rec = await A.P.evaluate(() => window.__k3.rec), death = await A.P.evaluate(() => window.__k3.death || null);
    R.trace = rec.map(r => [r.t, r.ph, r.d, r.s, r.ac, r.h, r.pl, r.aw ? r.aw.p : 0, r.rx, r.hu, r.vx, r.vy]);
    const seen = { look: -1, warn: -1, provoked: -1, creep: -1, def: null, wind: -1, death, aware: null, orbitLooks: 0, headTurn: 0, moving: rec.filter(r => Math.hypot(r.vx, r.vy) > 60).length };
    let lastRx = '';
    for (const r of rec) {
      if (r.aw && r.aw.pid === aid && !seen.aware) seen.aware = { t: r.t, tier: r.aw.tier, why: r.aw.why };
      if (r.rx === 'look' && lastRx !== 'look') { if (seen.look < 0) seen.look = r.t; if (r.ph === 'orbit') seen.orbitLooks++; }
      if (r.rx === 'warn' && seen.warn < 0) seen.warn = r.t;
      lastRx = r.rx;
      if (r.df && r.df.pid === aid && !seen.def) seen.def = { t: r.t, k: r.df.k, odds: r.df.odds, cornered: r.df.cornered };
      if (r.s === SCODE.PROVOKED && seen.provoked < 0) seen.provoked = r.t;
      if (r.ac === KACT.creep && r.s === SCODE.PROVOKED && seen.creep < 0) seen.creep = r.t;
      if (r.ac === KACT.wind && seen.wind < 0) { seen.wind = r.t; seen.windAt = r.at; }
      if (Math.abs(r.h) > .2 && r.ph === 'orbit') seen.headTurn++;
    }
    if (SHOTS) await A.P.screenshot({ path: path.join(SHOTS, 'b4_end_640.png') });
    R.seen = seen;
    R.lines = await A.P.evaluate(() => window.__k3.lines.slice());
    R.windSounds = seen.windAt ? await A.P.evaluate(w => window.__k3.src.filter(s => s >= w - 400 && s <= w + 900).length, seen.windAt) : null;
    R.errors = { prey: V.errs, pest: A.errs };
    check('b4_moved_by_keys', seen.moving >= 10, `${seen.moving} of ${rec.length} samples with the page's own velocity over 60 px/s`);
    check('b4_noticed', seen.aware && seen.look >= 0, JSON.stringify({ aware: seen.aware, firstLook: seen.look, looksWhileCircling: seen.orbitLooks, headTurnedSamples: seen.headTurn }));
    check('b4_warned_on_the_wire', seen.warn >= 0 && seen.provoked >= 0 && seen.creep >= 0, JSON.stringify({ warn: seen.warn, provokedState: seen.provoked, creepAct: seen.creep }));
    check('b4_defence_decision', !!seen.def, JSON.stringify(seen.def));
    check('b4_strike_shows_its_tell', !seen.def || seen.def.k !== 'strike' || (seen.wind >= 0 && R.windSounds >= 3), JSON.stringify({ decision: seen.def && seen.def.k, windAct: seen.wind, soundsAroundIt: R.windSounds }));
    check('b4_death_is_its', !seen.death || seen.death.kind === 'SkinStealer', JSON.stringify(seen.death));
    const aw = R.lines.filter(l => /^AWARE P\d+ /.test(l)), df = R.lines.filter(l => /^DEFENCE P\d+ (struck|withdrew)/.test(l));
    check('b4_overlay_lines', aw.length && (!seen.def || df.length), JSON.stringify({ unique: R.lines.length, aware: aw.slice(0, 3), warned: aw.filter(l => /warned \d+x|REACT warn/.test(l)).slice(0, 2), defence: df.slice(0, 2) }));
    check('b4_prey_died_by_it', R.preyDeath && R.preyDeath.kind === 'SkinStealer', JSON.stringify(R.preyDeath));
    check('b4_no_page_errors', !V.errs.length && !A.errs.length, JSON.stringify(R.errors));
  } catch (e) { check('b4_run', false, e && e.stack); }
  finally { await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  R.cases = cases; R.ok = cases.length > 0 && cases.every(c => c.ok);
  for (const c of cases) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + '\n       ' + c.detail);
  console.log(`BEHAVIOUR BROWSER: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  process.exitCode = R.ok ? 0 : 1;
})();
