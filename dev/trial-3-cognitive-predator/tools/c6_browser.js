#!/usr/bin/env node
/* dev/trial-3-cognitive-predator/tools/c6_browser.js - the pack's real-page scenes, R8 against the new build (development only; checkpoint
 * evidence, not a gate step).  Trial 3 and its refinements are not owner-approved.
 *
 *   node dev/trial-3-cognitive-predator/tools/c6_browser.js [--dir DIR] [--scenes lookaway,fork,decoy,pillar,escape] [--tries 2]
 *        [--secs 40] [--out FILE.json] [--shots DIR]
 *
 * One server (`node server.js PORT` in DIR, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader), one fresh
 * room per try.  Every person is a real page moved by its own keys (W A S D, Shift to run, C to crouch, F for the torch) and its mouse
 * (the facing and the torch); the admin panel's own commands set the scene (freeze, the Hounds and Smilers removed, one Skin-Stealer put
 * near - its hunger is the admin spawn's own .45-.65).  Every key and mouse aim a page is given is logged with its wall-clock time
 * (run.inputs); ten times a second the watcher's page records the creature from the admin debug the server sends (its plan, reason,
 * hunt, prediction, whom it sees) and the snapshot (where it is), and each page records where it is: the creature is read only to report.
 *   lookaway  B-C1: a page 400-520 px in front of it stares at it; at 8 s and 18 s it turns its back for 2.5 s.
 *   fork      B-C2: a page with its torch walks north in the dark south-west, torch off past y 5440, crouches at the fork short of wall B
 *             and doubles back west, crouched and silent; where does the creature look for it?
 *   decoy     B-C3: two pages - A is seen, then crouches torchless behind the pillar; B, out of its sight, runs up and down a lane.
 *   pillar    B-C4: a page runs round the pillar looking where it runs; when the creature cuts across (or after 16 s) it turns back the
 *             other way for 8 s, then runs off east down the hall.
 *   escape    the fresh runner: a page stares at it until it has been seen for 1.5 s (or the creature is within 350 px), then sprints
 *             away from it (the level's own route, away from where it is) to the hall's far end and round the corner, and crouches.
 * A page that has to get somewhere round walls (the escape, A's way behind the pillar) follows a route the tree's own level gives
 * (dev/harness.js: geo.path, as the harness's players do); its keys still move it - nothing is put anywhere.
 * Every name and passcode is synthetic. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = { scenes: 'lookaway,fork,decoy,pillar,escape', tries: '2', secs: '40' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), PASS = 'k3-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SECS = +ARG.secs, PILLAR = { x: 4952, y: 3584, R: 200 }, HALL = 3504;
const HAR = require(path.join(DIR, 'dev', 'harness.js')), GW = HAR.World(1);
/* the level's route from a to b (every third step of it, and the end), or null */
function route(a, b) { const r = GW.eng.geo.path(a.x, a.y, b.x, b.y, { CAN_VAULT: false }); if (!r || !r.length) return null; const o = r.filter((q, i) => i % 3 === 2 || i === r.length - 1).map(q => ({ x: Math.round(q.x), y: Math.round(q.y) })); return o; }
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const INIT = `(() => {
  const S = window.WebSocket; window.__k3 = { game: null, unlocked: false, ss: null, inputs: [] };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__k3.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data);
      if (m.t === 'admin' && m.ok) window.__k3.unlocked = true;
      if (m.t === 's' && m.e) window.__k3.ss = m.e.ss || null; } catch (x) { } }); }
    return ws; };
  window.WebSocket.prototype = S.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
  let mp = null; Object.defineProperty(window, '__mp', { configurable: true, get: () => mp ? (a => { window.__k3.cam = { x: a.cam.x, y: a.cam.y, sc: a.sc }; return mp(a); }) : mp, set: f => { mp = f; } });
  window.__k3.screen = (x, y) => { const c = window.__k3.cam; return c ? { x: innerWidth / 2 + (x - c.x) * c.sc, y: innerHeight / 2 + (y - c.y) * c.sc } : null; };
  window.__k3.key = (c, down) => { window.__k3.inputs.push([Date.now(), down ? 'down' : 'up', c]); window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c, key: c === 'ShiftLeft' ? 'Shift' : c.slice(3).toLowerCase(), bubbles: true })); };
})();`;
async function serve() {
  const port = await freePort(), p = spawn(process.execPath, ['server.js', String(port)], { cwd: DIR, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('no server');
}
async function until(P, fn, arg, ms = 8000, every = 50) { const t0 = Date.now(); for (;;) { const v = await P.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } }
async function runPage(b, port, room, VP, name) {
  const ctx = await b.newContext({ viewport: VP }); await ctx.addInitScript(INIT);
  const P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await P.goto(`http://127.0.0.1:${port}/?room=${room}`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__api && window.__ui, null, { timeout: 60000 });
  await P.evaluate(() => window.__ui.go('play')); await P.waitForSelector('#name', { state: 'visible' }); await P.fill('#name', name);
  await P.bringToFront(); await P.click('#enter');
  await until(P, () => !!(window.__net && __net.on && window.__k3.game && window.__api.started()), null, 30000);
  await sleep(2500);
  await P.evaluate(p => __net.testAuth(p), PASS); await until(P, () => window.__k3.unlocked, null, 5000);
  const pg = { ctx, P, errs, cmd: o => P.evaluate(o => window.__k3.game.send(JSON.stringify(Object.assign({ t: 'a' }, o))), o) };
  // where this page is, ten times a second (wall-clock time, to line the pages up)
  await P.evaluate(() => { const K = window.__k3; K.me = []; K.meT = setInterval(() => { const H = __api.H; K.me.push([Date.now(), Math.round(H.x), Math.round(H.y), __api.lightOn() ? 1 : 0, +H.angle.toFixed(2)]); }, 100); });
  return pg;
}
/* a page walks along points by its keys (o.run: Shift held; looping o.loop times); o.gaze: it also looks where it is going (its mouse) */
const PACE = `(o) => { const K = window.__k3, held = new Set(), key = (c, down) => { if (down === held.has(c)) return; if (down) held.add(c); else held.delete(c); K.key(c, down); };
  let i = 0, st = null; K.paceDone = false; const t0 = performance.now(); if (K.pace) clearInterval(K.pace); K.inputs.push([Date.now(), 'pace', JSON.stringify(o.pts.slice(0, 3)) + (o.pts.length > 3 ? '...' : '') + (o.run ? ' run' : '')]);
  K.pace = setInterval(() => { const H = __api.H, q = o.pts[i % o.pts.length], dx = q.x - H.x, dy = q.y - H.y, m = Math.hypot(dx, dy);
    if (m < (o.reach || 30)) { i++; st = null; }   // (o.reach: a running page steers at a point at least this far ahead - its keys are set only a few times a second)
    // held up against something (under 12 px in 1.2 s): on to the next point, logged (a page that cannot get somewhere is not left pushing a wall)
    const now = performance.now(); if (!st) st = { t: now, x: H.x, y: H.y }; else if (now - st.t > 1200) { if (Math.hypot(H.x - st.x, H.y - st.y) < 12 && m >= (o.reach || 30)) { K.inputs.push([Date.now(), 'skip', Math.round(q.x) + ',' + Math.round(q.y)]); i++; } st = { t: now, x: H.x, y: H.y }; }
    if ((performance.now() - t0) / 1000 > o.secs || i >= o.pts.length * (o.loop || 1)) { for (const c of [...held]) key(c, false); clearInterval(K.pace); K.pace = null; K.paceDone = true; return; }
    if (o.gaze && m > 14) { const s = K.screen(H.x + dx / m * 200, H.y + dy / m * 200); if (s) window.dispatchEvent(new PointerEvent('pointermove', { clientX: s.x, clientY: s.y, pointerType: 'mouse', bubbles: true })); }
    key('KeyD', m > 14 && dx > m * .38); key('KeyA', m > 14 && dx < -m * .38); key('KeyS', m > 14 && dy > m * .38); key('KeyW', m > 14 && dy < -m * .38); key('ShiftLeft', m > 14 && !!o.run); }, 60); }`;
const STOP = `() => { const K = window.__k3; if (K.pace) { clearInterval(K.pace); K.pace = null; } for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) K.key(c, false); }`;
/* ten times a second, in the watcher's page: the Skin-Stealer from the admin debug the server sends, and the snapshot */
const REC = `() => { const K = window.__k3; K.rec = []; K.recT = setInterval(() => { const k = (K.ss || [])[0]; if (!k) return;
    const d = (window.__ents.dbg || []).find(x => x.i === k.i), q = d && d.sk, H = __api.H, A = __api;
    const dist = Math.hypot(k.x - H.x, k.y - H.y), los = A.Uc(H.x, H.y, Math.atan2(k.y - H.y, k.x - H.x), dist) >= dist - 6;
    K.rec.push({ wt: Date.now(), x: Math.round(k.x), y: Math.round(k.y), v: k.v, ac: k.ac, a: k.a, pl: q ? q.pl : '?', pid: q ? q.pid || 0 : 0, why: q ? (q.why || '').slice(0, 110) : '', hu: q ? q.hu : null,
      ht: q && q.ht && q.ht.pid ? q.ht.pid : 0, pr: q && q.pr ? [q.pr.x, q.pr.y] : null, guess: q && q.ht && q.ht.guess ? q.ht.guess : '',
      sees: d ? [].concat(d.lk && d.lk.seen && d.tg ? [d.tg] : [], (d.ec || []).map(c => c[0]), q && q.aw && q.aw.ago <= .2 ? [q.aw.pid] : [], q && q.dec && q.dec.pid ? [q.dec.pid] : []) : [],
      d: Math.round(dist), los, dead: !!(A.death() && A.death().active) }); }, 100); }`;
const lastRec = P => P.evaluate(() => { const r = window.__k3.rec; return r && r.length ? r[r.length - 1] : null; });
const seenBy = (P, id) => P.evaluate(id => (window.__k3.rec || []).some(r => r.sees.includes(id)), id);
async function aimAt(P, x, y) { const s = await P.evaluate(q => window.__k3.screen(q.x, q.y), { x, y }).catch(() => null); if (s) { await P.mouse.move(s.x, s.y, { steps: 2 }).catch(() => { }); await P.evaluate(q => window.__k3.inputs.push([Date.now(), 'aim', q.x + ',' + q.y]), { x: Math.round(x), y: Math.round(y) }).catch(() => { }); } }
async function stareFor(P, ms, away) {                               // the mouse kept on the creature (or, away(), on the other side of the page)
  const t0 = Date.now(); while (Date.now() - t0 < ms) { const k = await P.evaluate(() => { const k = (window.__k3.ss || [])[0], H = __api.H; return k ? { x: k.x, y: k.y, hx: H.x, hy: H.y } : null; }).catch(() => null);
    if (k) { const aw = away && away(); await aimAt(P, aw ? 2 * k.hx - k.x : k.x, aw ? 2 * k.hy - k.y : k.y); } await sleep(150); }
}
async function torch(P, on) { if (!!(await P.evaluate(() => __api.lightOn())) !== on) { await P.evaluate(() => window.__k3.inputs.push([Date.now(), 'press', 'KeyF'])); await P.keyboard.press('KeyF'); } }
async function crouchKey(P) { await P.evaluate(() => { window.__k3.key('KeyC', true); setTimeout(() => window.__k3.key('KeyC', false), 80); }); }
async function inFront(P, K0, rs = [450, 420, 480, 400, 520]) {
  return P.evaluate(([k, rs]) => { const A = __api, a0 = +k.a || 0, L = window.__light; let any = null, wide = null;
    for (let i = 0; i < 24; i++) for (const r of rs) { const da = Math.ceil(i / 2) / 24 * Math.PI * 2, a = a0 + (i % 2 ? 1 : -1) * da, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
      if (!(A.sl(x, y, 30) && A.Uc(k.x, k.y, a, r) >= r - 4)) continue;
      if (da > 1) { if (!wide) wide = { x, y, wide: true }; continue; }
      if (L && L.sample(x, y, false).lamp > .3) return { x, y, lit: true }; if (!any) any = { x, y }; }
    return any || wide; }, [K0, rs]);
}
const out = { tool: 'dev/trial-3-cognitive-predator/tools/c6_browser.js', dir: path.basename(DIR), runs: [] };
function summary(run, rec, t0w, ids) {
  const R = rec.filter(r => r.wt >= t0w), tl = []; let last = '';
  for (const r of R) { const k = r.pl + (r.pid ? ' P' + r.pid : ''); if (k !== last) { tl.push([+((r.wt - t0w) / 1000).toFixed(1), k, r.why]); last = k; } }
  const firstSeen = {}; for (const r of R) for (const id of r.sees) if (firstSeen[id] === undefined) firstSeen[id] = +((r.wt - t0w) / 1000).toFixed(1);
  const strike = R.find(r => r.ac === 12 || r.ac === 13), dead = R.find(r => r.dead);
  Object.assign(run, { hunger: (R.find(r => r.hu !== null && r.hu !== undefined) || { hu: null }).hu,   // (after C6's runs: the first record can come before the debug block)
    firstSeen, timeline: tl, firstStrike: strike ? +((strike.wt - t0w) / 1000).toFixed(1) : null, watcherDied: dead ? +((dead.wt - t0w) / 1000).toFixed(1) : null,
    closest: R.length ? Math.min(...R.map(r => r.d)) : null, huntOf: [...new Set(R.filter(r => r.ht).map(r => r.ht))], cutAt: (R.find(r => r.pl === 'cut') || {}).wt ? +((R.find(r => r.pl === 'cut').wt - t0w) / 1000).toFixed(1) : null,
    setupMiss: !Object.keys(firstSeen).length });
  run.trace = R.filter((r, i) => i % 3 === 0).map(r => [+((r.wt - t0w) / 1000).toFixed(1), r.x, r.y, r.pl, r.pid, r.ht, r.v, r.ac, r.d, r.los ? 1 : 0, r.pr]);
}
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  out.chromium = b.version();
  const VP = { width: 640, height: 360 };
  for (const scene of ARG.scenes.split(',')) for (let tr = 1; tr <= +ARG.tries; tr++) {
    const run = { scene, try: tr }; out.runs.push(run); const pages = [];
    try {
      const room = 'c6' + scene.slice(0, 3) + tr + (Date.now() % 1e5);
      const W = await runPage(b, port, room, VP, 'K3A'); pages.push(W);
      W.cmd({ c: 'freeze', on: true }); W.cmd({ c: 'hounds', mode: 'remove', n: 10 }); W.cmd({ c: 'smilers', mode: 'remove', n: 10 });
      let B = null; if (scene === 'decoy') { B = await runPage(b, port, room, VP, 'K3B'); pages.push(B); }
      W.cmd({ c: 'hounds', mode: 'remove', n: 10 }); W.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
      const at = scene === 'pillar' ? { x: PILLAR.x + PILLAR.R, y: PILLAR.y } : scene === 'fork' ? { x: 1300, y: 5600 } : { x: 5000, y: HALL };
      await W.P.evaluate(s => { if (__api.sl(s.x, s.y, 26)) __api.tp(s.x, s.y); }, at); await sleep(300);
      W.cmd({ c: 'near', k: 'skinstealer' });
      const K0 = await until(W.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0] : null, null, 8000);
      if (!K0) throw new Error('no Skin-Stealer appeared');
      run.ids = { A: await W.P.evaluate(() => __api.H.id), B: B ? await B.P.evaluate(() => __api.H.id) : null }; run.spawn = { x: Math.round(K0.x), y: Math.round(K0.y) };
      if (scene === 'lookaway' || scene === 'decoy' || scene === 'escape') { const s = await inFront(W.P, K0); if (s) { await W.P.evaluate(q => __api.tp(q.x, q.y), s); run.Aat = { x: Math.round(s.x), y: Math.round(s.y) }; } }
      if (B) { await B.P.evaluate(() => __api.tp(5112, 3192)); await torch(B.P, false); }
      await torch(W.P, true);
      W.cmd({ c: 'debug', on: true }); await W.P.evaluate(() => Object.assign(window.__ents.dbgCfg, { on: true, ai: true }));
      await W.P.evaluate(`(${REC})()`); await W.P.bringToFront();
      const t0w = Date.now(); W.cmd({ c: 'freeze', on: false });
      const el = () => (Date.now() - t0w) / 1000, shots = [1, 10, 20, 30].filter(s => s < SECS); let si = 0;
      const shot = async () => { if (SHOTS && si < shots.length && el() >= shots[si]) { await W.P.screenshot({ path: path.join(SHOTS, `${scene}_${tr}_${shots[si]}s.png`) }).catch(() => { }); si++; } };
      const ev = (k, v) => { (run.events || (run.events = [])).push([+el().toFixed(1), k, v]); };
      if (scene === 'lookaway' || scene === 'escape') {
        let seenAt = -1, phase = 0;
        while (el() < SECS) {
          if (seenAt < 0 && await seenBy(W.P, run.ids.A)) { seenAt = el(); ev('seen', ''); }
          if (scene === 'lookaway') { const t = el(), away = (t > 8 && t < 10.5) || (t > 18 && t < 20.5); if (away !== !!run._aw) { run._aw = away; ev(away ? 'looks away' : 'looks back', ''); } await stareFor(W.P, 300, () => away); }
          else if (phase === 0) { await stareFor(W.P, 300); const k0 = await lastRec(W.P);
            if ((seenAt >= 0 && el() - seenAt > 1.5) || (k0 && seenAt >= 0 && k0.d < 350) || (el() > 6 && seenAt < 0)) { phase = 1;
            // away from it: of the hall's two far ends, the one whose route first takes the page further from it (then round that corner)
            const k = await lastRec(W.P), me = await W.P.evaluate(() => ({ x: Math.round(__api.H.x), y: Math.round(__api.H.y) }));
            const ends = [[{ x: 8600, y: HALL }, { x: 8600, y: 4250 }], [{ x: 3100, y: HALL }, { x: 3100, y: 3000 }]].map(e => { const r = route(me, e[0]); if (!r) return null;
              const q = r[Math.min(r.length - 1, 3)], gain = k ? Math.hypot(q.x - k.x, q.y - k.y) - Math.hypot(me.x - k.x, me.y - k.y) : 0; return { pts: r.concat(e.slice(1)), gain, east: e[0].x > 5000 }; }).filter(Boolean).sort((a, b) => b.gain - a.gain);
            const way = ends[0]; run.runFrom = { d: k ? k.d : null, me };
            ev('runs', (way.east ? 'east' : 'west') + (seenAt < 0 ? ' (never seen)' : `, fresh, ${k ? k.d : '?'} px from it`)); await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: way.pts, run: true, gaze: true, secs: 32, reach: 60 })})`); } }
          else { if (phase === 1 && await W.P.evaluate(() => window.__k3.paceDone)) { phase = 2; ev('hides', 'crouched, torch off'); await torch(W.P, false); await crouchKey(W.P); } await sleep(300); }
          await shot();
        }
      } else if (scene === 'fork') {
        let leg = 0, seen = false;
        while (el() < SECS) {
          if (!seen && await seenBy(W.P, run.ids.A)) { seen = true; ev('seen', ''); }
          const me = await W.P.evaluate(() => ({ x: __api.H.x, y: __api.H.y, done: window.__k3.paceDone }));
          if (leg === 0 && el() > .5) { leg = 1; ev('walks', 'north'); await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: [{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], gaze: true, secs: 20 })})`); }
          if (leg === 1 && me.y < 5440 && await W.P.evaluate(() => __api.lightOn())) { ev('torch off', ''); await torch(W.P, false); }
          if (leg === 1 && me.done) { leg = 2; await crouchKey(W.P); ev('doubles back', 'west, crouched'); await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }], gaze: true, secs: 25 })})`); }
          if (leg === 2 && me.done) { leg = 3; ev('still', 'crouched at the west gap'); }
          await sleep(200); await shot();
        }
      } else if (scene === 'decoy') {
        let ph = 0, seenAt = -1;
        while (el() < SECS) {
          if (seenAt < 0 && await seenBy(W.P, run.ids.A)) { seenAt = el(); ev('A seen', ''); }
          if (ph === 0) { await stareFor(W.P, 300); if ((seenAt >= 0 && el() - seenAt > 2) || el() > 10) { ph = 1; ev('A hides', 'torch off, behind the pillar, crouched'); await torch(W.P, false); await crouchKey(W.P);
            const me = await W.P.evaluate(() => ({ x: Math.round(__api.H.x), y: Math.round(__api.H.y) })), r = route(me, { x: PILLAR.x - 260, y: PILLAR.y }) || [{ x: PILLAR.x - 260, y: PILLAR.y }];
            await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: r, secs: 14 })})`); } }
          else if (ph === 1 && el() - seenAt > 4) { ph = 2; ev('B runs', 'up and down its lane, out of its sight'); await B.P.evaluate(`(${PACE})(${JSON.stringify({ pts: [{ x: 5112, y: 2792 }, { x: 5112, y: 3192 }], run: true, loop: 6, secs: 16 })})`); }
          else await sleep(300);
          await shot();
        }
        run.Bme = await B.P.evaluate(() => window.__k3.me.filter((q, i) => i % 5 === 0)); run.Binputs = await B.P.evaluate(() => window.__k3.inputs);
      } else if (scene === 'pillar') {
        // a ring 200 px round it, 24 points a lap, the level's own clear points only (a page cuts no corner into the pillar)
        const onRing = a => ({ x: Math.round(PILLAR.x + Math.cos(a) * PILLAR.R), y: Math.round(PILLAR.y + Math.sin(a) * PILLAR.R) }), clear = q => GW.ad.clear(q.x, q.y, 26, 'walk');
        const ring = (d, a0 = 0, laps = 1) => { const o = []; for (let k = 1; k <= 24 * laps; k++) { const q = onRing(a0 + d * k / 24 * Math.PI * 2); if (clear(q)) o.push(q); } return o; };
        await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: ring(-1), run: true, gaze: true, loop: 40, secs: SECS, reach: 90 })})`); ev('circles', 'anticlockwise, looking where it runs');
        let ph = 0, tRev = -1;
        while (el() < SECS) {
          const r = await lastRec(W.P);
          if (ph === 0 && ((r && r.pl === 'cut') || el() > 16)) { ph = 1; tRev = el(); ev('turns back', r && r.pl === 'cut' ? 'as it cuts across' : 'after 16 s'); const H = await W.P.evaluate(() => ({ x: __api.H.x, y: __api.H.y })), a0 = Math.atan2(H.y - PILLAR.y, H.x - PILLAR.x), back = [];
            back.push(...ring(1, a0, 2));
            await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: back, run: true, gaze: true, secs: 8, reach: 90 })})`); }
          if (ph === 1 && el() - tRev > 8) { ph = 2; ev('runs off', 'east down the hall'); const me = await W.P.evaluate(() => ({ x: Math.round(__api.H.x), y: Math.round(__api.H.y) }));
            await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: route(me, { x: 8600, y: HALL }) || [{ x: 8600, y: HALL }], run: true, gaze: true, secs: 25, reach: 60 })})`); }
          await sleep(200); await shot();
        }
      }
      await W.P.evaluate(`(${STOP})()`).catch(() => { });
      const rec = await W.P.evaluate(() => window.__k3.rec.slice());
      summary(run, rec, t0w, run.ids);
      run.inputs = (await W.P.evaluate(() => window.__k3.inputs)).filter(q => q[0] >= t0w - 2000).map(q => [+((q[0] - t0w) / 1000).toFixed(2), q[1], q[2]]);
      run.Ame = (await W.P.evaluate(() => window.__k3.me)).filter(q => q[0] >= t0w).filter((q, i) => i % 5 === 0).map(q => [+((q[0] - t0w) / 1000).toFixed(1), q[1], q[2], q[3]]);
      if (run.Bme) run.Bme = run.Bme.filter(q => q[0] >= t0w).map(q => [+((q[0] - t0w) / 1000).toFixed(1), q[1], q[2]]);
      if (run.Binputs) run.Binputs = run.Binputs.filter(q => q[0] >= t0w - 2000).map(q => [+((q[0] - t0w) / 1000).toFixed(2), q[1], q[2]]);
      run.errors = pages.map(q => q.errs).flat(); delete run._aw;
    } catch (e) { run.error = String(e && e.stack).split('\n').slice(0, 3).join(' | '); }
    finally { for (const q of pages) await q.ctx.close().catch(() => { }); }
    console.log(`${scene} #${tr}: hunger ${run.hunger}; ${run.error ? 'ERROR ' + run.error : `${run.setupMiss ? 'SETUP MISS (it never saw a page); ' : ''}first saw ${JSON.stringify(run.firstSeen)}; events ${(run.events || []).map(q => q[0] + ' ' + q[1]).join(', ')}; first strike ${run.firstStrike} s, A died ${run.watcherDied} s, closest ${run.closest} px, cut-off ${run.cutAt} s; hunted ${run.huntOf.join(',') || '-'} (A ${run.ids.A}, B ${run.ids.B})`}`);
    if (run.timeline) console.log('   ' + run.timeline.map(q => `${q[0]} ${q[1]}`).join(' | ').slice(0, 900));
  }
  await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(out, null, 1) + '\n');
})();
