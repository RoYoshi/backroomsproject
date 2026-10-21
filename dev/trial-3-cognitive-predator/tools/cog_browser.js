#!/usr/bin/env node
/* dev/trial-3-cognitive-predator/tools/cog_browser.js - the owner's situations in real pages (development only; checkpoint evidence, not
 * a gate step).  Trial 3 and its refinements are not owner-approved.
 *
 *   node dev/trial-3-cognitive-predator/tools/cog_browser.js [--dir DIR] [--scenes watched,circle,crowd] [--tries 2] [--secs 35]
 *        [--out FILE.json] [--shots DIR]
 *
 * One server (`node server.js PORT` in DIR, default this repository - R8 or a later tree; a synthetic admin passcode), headless Chromium
 * (SwiftShader), one fresh room per try.  The page's own input moves the people (keys; the mouse aims the torch and the facing); the
 * admin panel's own commands set the scene (freeze, the Hounds and Smilers removed, one Skin-Stealer put near - its hunger is the admin
 * spawn's own .45-.65, the band the owner meets first).  Recorded ten times a second from the admin debug data the server sends
 * (window.__ents.dbg: its plan, why, hunger; whether it has the person in sight) and the snapshot (where it is, its speed): the
 * creature's state is read only to report it.
 *   watched  a lit page stands 420-480 px in front of it and keeps the mouse on it (a stare), 35 s.
 *   circle   a lit page runs round a pillar in the hall (radius 175 px), lap after lap; the creature put near it, 35 s.
 *   crowd    two pages: a lit watcher in front of it, and a second person 600-700 px off walking slowly, facing away; 35 s.
 * A watcher the creature has not seen 3 s in walks toward it (its keys) to 280 px and stares again (run.walkedIn).
 * Per try: when it first saw each page (a try where it saw none is a labelled setup miss), the plan timeline (when, which, why), the
 * share of time in each plan, the time to its first purposeful movement (moving
 * over 40 px/s in approach, chase, flank, intercept or search) and to the first strike, how long it was out of the watcher's view, the
 * closest it came, whether a page died, page errors; screenshots at 1, 8, 16 and 30 s when --shots is given.  Every name and passcode is
 * synthetic. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = { scenes: 'watched,circle,crowd', tries: '2', secs: '35' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), PASS = 'k3-synthetic-admin', sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = ARG.shots ? path.resolve(ARG.shots) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SECS = +ARG.secs, PILLAR = { x: 4952, y: 3584, R: 175 }, MOVE = ['approach', 'chase', 'flank', 'intercept', 'search'];
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
/* before the page's scripts: the game socket kept (the panel's commands), every snapshot's ss list noted, the camera for screen positions */
const INIT = `(() => {
  const S = window.WebSocket; window.__k3 = { game: null, unlocked: false, ss: null };
  window.WebSocket = function (u, p) { const ws = new S(u, p);
    if (/\\/ws(\\?|$)/.test(u)) { window.__k3.game = ws; ws.addEventListener('message', e => { try { const m = JSON.parse(e.data);
      if (m.t === 'admin' && m.ok) window.__k3.unlocked = true;
      if (m.t === 's' && m.e) window.__k3.ss = m.e.ss || null; } catch (x) { } }); }
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
/* a page walks (o.run: runs) along a list of points by keys, inside the page every 60 ms, looping o.loop times */
const PACE = `(o) => { const K = window.__k3, held = new Set(), key = (c, down) => { if (down === held.has(c)) return; if (down) held.add(c); else held.delete(c);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c, key: c === 'ShiftLeft' ? 'Shift' : c.slice(3).toLowerCase(), bubbles: true })); };
  let i = 0; K.paceDone = false; const t0 = performance.now();
  K.pace = setInterval(() => { const H = __api.H, q = o.pts[i % o.pts.length], dx = q.x - H.x, dy = q.y - H.y, m = Math.hypot(dx, dy);
    if (m < 30) i++;
    if ((performance.now() - t0) / 1000 > o.secs || i >= o.pts.length * (o.loop || 1)) { for (const c of [...held]) key(c, false); clearInterval(K.pace); K.paceDone = true; return; }
    key('KeyD', m > 14 && dx > m * .38); key('KeyA', m > 14 && dx < -m * .38); key('KeyS', m > 14 && dy > m * .38); key('KeyW', m > 14 && dy < -m * .38); key('ShiftLeft', m > 14 && !!o.run); }, 60); }`;
/* ten times a second, in the watcher's page: the Skin-Stealer's admin debug (its plan, why, hunger; whom it sees) and snapshot */
const REC = `() => { const K = window.__k3; K.rec = []; K.recT = setInterval(() => { const k = (K.ss || [])[0]; if (!k) return;
    const d = (window.__ents.dbg || []).find(x => x.i === k.i), q = d && d.sk, H = __api.H, A = __api;
    const dist = Math.hypot(k.x - H.x, k.y - H.y), los = A.Uc(H.x, H.y, Math.atan2(k.y - H.y, k.x - H.x), dist) >= dist - 6;
    K.rec.push({ t: +(performance.now() / 1000).toFixed(2), x: Math.round(k.x), y: Math.round(k.y), v: k.v, ac: k.ac, pl: q ? q.pl : '?', pid: q ? q.pid || 0 : 0, why: q ? (q.why || '').slice(0, 90) : '', hu: q ? q.hu : null,
      ht: q && q.ht && q.ht.pid ? q.ht.pid : 0, sees: d ? [].concat(d.lk && d.lk.seen && d.tg ? [d.tg] : [], (d.ec || []).map(c => c[0]), q && q.aw && q.aw.ago <= .2 ? [q.aw.pid] : [], q && q.dec && q.dec.pid ? [q.dec.pid] : []) : [], d: Math.round(dist), los, dead: !!(A.death() && A.death().active) }); }, 100); }`;
async function stare(P, ms) {                                              // the mouse kept on the creature's drawn position (the facing, the torch)
  const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await P.evaluate(() => { const k = (window.__k3.ss || [])[0]; return k ? window.__k3.screen(k.x, k.y) : null; }).catch(() => null); if (s) await P.mouse.move(s.x, s.y, { steps: 2 }).catch(() => { }); await sleep(150); }
}
function summary(rec, ids, t0) {
  const R = rec.filter(r => r.t >= t0), tl = []; let last = '';
  for (const r of R) { const k = r.pl + (r.pid ? ' P' + r.pid : ''); if (k !== last) { tl.push([+(r.t - t0).toFixed(1), k, r.why]); last = k; } }
  const share = {}; for (const r of R) share[r.pl] = (share[r.pl] || 0) + 1; for (const k in share) share[k] = +(share[k] / Math.max(1, R.length)).toFixed(2);
  const mv = R.find(r => MOVE.includes(r.pl) && r.v > 40), strike = R.find(r => r.ac === 12 || r.ac === 13);
  const hidden = R.filter(r => !r.los).length / 10, dead = R.find(r => r.dead);
  // (C1) when it first had each page in sight (the admin debug's own records: its target in sight, eye contact, the person it is most
  // aware of seen within 0.2 s, the person its last decision was about - decisions are only ever made about somebody seen); a try in which it never saw the watcher
  // measured nothing about it, and is labelled a setup miss rather than counted as gameplay
  const firstSeen = {}; for (const r of R) for (const id of r.sees) if (firstSeen[id] === undefined) firstSeen[id] = +(r.t - t0).toFixed(1);
  const sawW = ids && firstSeen[ids.watcher] !== undefined;
  return { hunger: R.length ? R[0].hu : null, firstSeen, setupMiss: !sawW && !(ids && ids.walker && firstSeen[ids.walker] !== undefined), timeline: tl, share, firstMove: mv ? +(mv.t - t0).toFixed(1) : null, firstStrike: strike ? +(strike.t - t0).toFixed(1) : null,
    outOfViewSecs: +hidden.toFixed(1), closest: R.length ? Math.min(...R.map(r => r.d)) : null, died: dead ? +(dead.t - t0).toFixed(1) : null, huntOf: [...new Set(R.filter(r => r.ht).map(r => r.ht))] };
}
const out = { tool: 'dev/trial-3-cognitive-predator/tools/cog_browser.js', dir: path.basename(DIR), runs: [] };
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  out.chromium = b.version();
  const VP = { width: 640, height: 360 };
  for (const scene of ARG.scenes.split(',')) for (let tr = 1; tr <= +ARG.tries; tr++) {
    const run = { scene, try: tr }; out.runs.push(run); const pages = [];
    try {
      const room = 'cg' + scene.slice(0, 3) + tr + (Date.now() % 1e5);
      const W = await runPage(b, port, room, VP, 'K3Watch'); pages.push(W);
      W.cmd({ c: 'freeze', on: true }); W.cmd({ c: 'hounds', mode: 'remove', n: 10 }); W.cmd({ c: 'smilers', mode: 'remove', n: 10 });
      let B = null; if (scene === 'crowd') { B = await runPage(b, port, room, VP, 'K3Walker'); pages.push(B); }
      W.cmd({ c: 'hounds', mode: 'remove', n: 10 }); W.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
      // where the scene happens: the long lit hall (the circle: beside the pillar)
      const at = scene === 'circle' ? { x: PILLAR.x + PILLAR.R, y: PILLAR.y } : { x: 5000, y: 3504 };
      await W.P.evaluate(s => { if (__api.sl(s.x, s.y, 26)) __api.tp(s.x, s.y); }, at); await sleep(300);
      W.cmd({ c: 'near', k: 'skinstealer' });
      const K0 = await until(W.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0] : null, null, 8000);
      if (!K0) throw new Error('no Skin-Stealer appeared');
      run.ids = { watcher: await W.P.evaluate(() => __api.H.id), walker: B ? await B.P.evaluate(() => __api.H.id) : null };
      // the watcher: in front of it 420-480 px with a clear line (the circle: on the pillar's ring, the creature wherever 'near' put it)
      if (scene !== 'circle') {
        // (C1) in front of it (within 1 rad of its facing, nearest first), 400-520 px off, a clear line - a lamp-lit spot first (the page's
        // own light sample), else any in front, else anywhere clear; R8's C0 runs took the first clear spot and in two tries the creature
        // never saw the page
        const spot = await W.P.evaluate(k => { const A = __api, a0 = +k.a || 0, L = window.__light; let any = null, wide = null;
          for (let i = 0; i < 24; i++) for (const r of [450, 420, 480, 400, 520]) { const da = Math.ceil(i / 2) / 24 * Math.PI * 2, a = a0 + (i % 2 ? 1 : -1) * da, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
            if (!(A.sl(x, y, 30) && A.Uc(k.x, k.y, a, r) >= r - 4)) continue;
            if (da > 1) { if (!wide) wide = { x, y, lit: false, wide: true }; continue; }                    // (outside its field of view: a last resort)
            if (L && L.sample(x, y, false).lamp > .3) return { x, y, lit: true }; if (!any) any = { x, y, lit: false }; }
          return any || wide; }, K0);
        if (!spot) throw new Error('no open floor in front of it');
        await W.P.evaluate(s => __api.tp(s.x, s.y), spot); run.watcherAt = { x: Math.round(spot.x), y: Math.round(spot.y), lit: spot.lit, wide: !!spot.wide };
      }
      if (B) {
        const bs = await B.P.evaluate(k => { const A = __api; for (const r of [650, 600, 700, 560, 750]) for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
          if (A.sl(x, y, 30) && A.Uc(k.x, k.y, a, r) >= r - 4 && A.sl(x + 300, y, 30)) return { x, y }; } return null; }, K0);
        if (bs) { await B.P.evaluate(s => __api.tp(s.x, s.y), bs); run.walkerAt = { x: Math.round(bs.x), y: Math.round(bs.y) }; }
        if (!(await B.P.evaluate(() => __api.lightOn()))) await B.P.keyboard.press('KeyF');
      }
      if (!(await W.P.evaluate(() => __api.lightOn()))) await W.P.keyboard.press('KeyF');
      W.cmd({ c: 'debug', on: true });
      await W.P.evaluate(() => Object.assign(window.__ents.dbgCfg, { on: true, ai: true }));
      await W.P.evaluate(`(${REC})()`);
      await W.P.bringToFront();
      const t0 = await W.P.evaluate(() => performance.now() / 1000);
      W.cmd({ c: 'freeze', on: false });
      if (scene === 'circle') {
        const ring = []; for (let k = 0; k < 12; k++) { const a = -k / 12 * Math.PI * 2; ring.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); }
        await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: ring, run: true, loop: 40, secs: SECS })})`);
      }
      if (B) await B.P.evaluate(`(${PACE})(${JSON.stringify({ pts: [{ x: run.walkerAt.x + 300, y: run.walkerAt.y }, { x: run.walkerAt.x - 300, y: run.walkerAt.y }], loop: 20, secs: SECS })})`);
      const shots = [1, 8, 16, 30].filter(s => s < SECS); let si = 0; const tStart = Date.now();
      while (Date.now() - tStart < SECS * 1000) {
        if (scene !== 'circle') await stare(W.P, 900); else await sleep(900);
        const el = (Date.now() - tStart) / 1000;
        // (C2) as a player would: not seen by it after 3 s, the watcher walks toward where it stands until 280 px off (the page's own keys),
        // then stands and stares again - the tries where it never saw the page measured nothing (C0 / C1: setup misses)
        if (scene !== 'circle' && el > 3 && !run.walkedIn && !(await W.P.evaluate(id => (window.__k3.rec || []).some(r => r.sees.includes(id)), run.ids.watcher))) {
          const to = await W.P.evaluate(() => { const k = (window.__k3.ss || [])[0], H = __api.H; if (!k) return null; const dx = H.x - k.x, dy = H.y - k.y, m = Math.hypot(dx, dy) || 1;
            for (const r of [280, 320, 240, 360]) { const x = k.x + dx / m * r, y = k.y + dy / m * r; if (__api.sl(x, y, 26)) return { x, y }; } return null; });
          if (to) { run.walkedIn = +el.toFixed(1); await W.P.evaluate(`(${PACE})(${JSON.stringify({ pts: [to], loop: 1, secs: 8 })})`); }
        }
        if (SHOTS && si < shots.length && el >= shots[si]) { await W.P.screenshot({ path: path.join(SHOTS, `${scene}_${tr}_${shots[si]}s.png`) }).catch(() => { }); si++; }
      }
      const rec = await W.P.evaluate(() => window.__k3.rec.slice());
      Object.assign(run, summary(rec, run.ids, t0));
      run.trace = rec.filter((r, i) => i % 5 === 0).map(r => [+(r.t - t0).toFixed(1), r.pl, r.pid, r.d, r.los ? 1 : 0, r.v, r.ac, r.hu]);
      run.errors = pages.map(q => q.errs).flat();
    } catch (e) { run.error = String(e && e.stack).split('\n').slice(0, 3).join(' | '); }
    finally { for (const q of pages) await q.ctx.close().catch(() => { }); }
    console.log(`${scene} #${tr}: hunger ${run.hunger}; ${run.error ? 'ERROR ' + run.error : `${run.setupMiss ? 'SETUP MISS (it never saw a page); ' : ''}first saw ${JSON.stringify(run.firstSeen)} s; first purposeful move ${run.firstMove} s, first strike ${run.firstStrike} s, out of the watcher's view ${run.outOfViewSecs} s, closest ${run.closest} px, a page died ${run.died}; shares ${JSON.stringify(run.share)}; hunted ${run.huntOf.join(',') || '-'} (watcher ${run.ids && run.ids.watcher}, walker ${run.ids && run.ids.walker})`}`);
    if (run.timeline) console.log('   ' + run.timeline.map(q => `${q[0]} ${q[1]}`).join(' | ').slice(0, 700));
  }
  await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(out, null, 1) + '\n');
})();
