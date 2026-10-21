#!/usr/bin/env node
/* dev/trial-3-predator-refinement/tools/predator_browser.js - R6: the predator refinement in real pages (development only; the
 * checkpoint's browser evidence, not a gate step).  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-predator-refinement/tools/predator_browser.js [--dir DIR] [--out FILE.json] [--shots DIR]
 *
 * One server (`node server.js PORT` in DIR, default this repository; a synthetic admin passcode), headless Chromium (SwiftShader), two
 * pages in one fresh room (the page setup is dev/trial-3-behavior-refinement/tools/behave_browser.js's).  The world is frozen and emptied
 * of Hounds and Smilers with the panel's own commands; one Skin-Stealer is put near (its spawn hunger is .45-.65: hungry).
 *   1. Heard, not seen (up to 3 attempts, each with a fresh Skin-Stealer put near): page N (K3Noise) is put on open floor 200-360 px
 *      from it with a wall between (no clear line to either point of its pace or the way between), page Q (K3Quiet) 500-900 px away out
 *      of its sight, crouched and still.  The world runs; N runs back and forth by keys (the page's own movement, so its footsteps are
 *      the server's own) for 16 s, Q does nothing.  Recorded every 100 ms from the admin debug data (window.__ents.dbg, the server's):
 *      its plan, the person a plan or a hunt is about, its act, the sound it last heard, and whom it had seen within the last second (its
 *      best record seen now, the people with eye contact, its awareness record, a hunt's own sighting; the person of its last decision,
 *      which it makes only about somebody it sees).  An attempt in which it listened (to nobody) ends the loop.
 *   2. Seen: a fresh Skin-Stealer is put near (the first may have given N up, or fed) and N steps into its view, torch on; it hunts them.
 * Checks: no plan and no hunt named N or Q before the same Skin-Stealer had seen them (a name only by sight; the creature roams and
 * searches, so it may come round and see N - that name is earned); it stopped and listened to N's footsteps as an anonymous sound (whether it then went
 * to look is reported); once it saw N, a hunt of N; the admin overlay drew the HUNT line; the snapshot's Skin-Stealer entries carry only
 * their few public fields (no belief, no guess, no person); no page error.  Whether it hears N depends on where the spot is and how it
 * is turned: a run in which it never reacted says so (the listen check is then not counted).  Every name and passcode is synthetic. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
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
      if (m.t === 's' && m.e) { window.__k3.snaps++; window.__k3.ss = m.e.ss || null; window.__k3.keys = Object.keys(m.e).join(',');
        const wd = (m.e.ss || []).some(t => t.ac === ${KACT.wind}); if (wd && !window.__k3.inWind) (window.__k3.winds = window.__k3.winds || []).push(performance.now()); window.__k3.inWind = wd; } } catch (x) { } }); }   // (every wind-up's start, from every snapshot)
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
/* N walks (o.run: runs) back and forth between two points by keys, inside its own page every 60 ms; Q stays crouched */
const PACE = `(o) => { const K = window.__k3, held = new Set(), key = (c, down) => { if (down === held.has(c)) return; if (down) held.add(c); else held.delete(c);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c, key: c === 'ShiftLeft' ? 'Shift' : c.slice(3).toLowerCase(), bubbles: true })); };
  let leg = 0; K.paceDone = false; const t0 = performance.now();
  K.pace = setInterval(() => { const H = __api.H, q = o.pts[leg % 2], dx = q.x - H.x, dy = q.y - H.y, m = Math.hypot(dx, dy);
    if (m < 24) leg++;
    if ((performance.now() - t0) / 1000 > o.secs) { for (const c of [...held]) key(c, false); clearInterval(K.pace); K.paceDone = true; return; }
    key('KeyD', m > 14 && dx > m * .38); key('KeyA', m > 14 && dx < -m * .38); key('KeyS', m > 14 && dy > m * .38); key('KeyW', m > 14 && dy < -m * .38); key('ShiftLeft', m > 14 && !!o.run); }, 60); }`;
const PUB = ['a', 'ac', 'dg', 'h', 'i', 's', 'v', 'x', 'y'];
const ANCHORS = [{ x: 1300, y: 5600 }, { x: 7536, y: 5235 }, { x: 600, y: 5331 }];
(async () => {
  const { p: srv, port } = await serve();
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/trial-3-predator-refinement/tools/predator_browser.js', chromium: b.version() }, cases = [];
  const check = (name, ok, detail) => cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 900) });
  try {
    const room = 'pr' + (Date.now() % 1e6), VP = { width: 640, height: 360 };
    const N = await runPage(b, port, room, VP, 'K3Noise');
    N.cmd({ c: 'freeze', on: true }); N.cmd({ c: 'hounds', mode: 'remove', n: 10 }); N.cmd({ c: 'smilers', mode: 'remove', n: 10 });
    const Q = await runPage(b, port, room, VP, 'K3Quiet');
    N.cmd({ c: 'hounds', mode: 'remove', n: 10 }); N.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
    const nid = await N.P.evaluate(() => __api.H.id), qid = await Q.P.evaluate(() => __api.H.id); R.ids = { noise: nid, quiet: qid };
    N.cmd({ c: 'debug', on: true });
    await N.P.evaluate(() => { window.__k3.lines = []; const f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) { const s = String(t); if (/^(HUNT|HUNGER|WHY)/.test(s) && window.__k3.lines.length < 600 && !window.__k3.lines.includes(s)) window.__k3.lines.push(s); return f.call(this, t, x, y, w); };
      Object.assign(window.__ents.dbgCfg, { on: true, ai: true });
      window.__k3.rec = []; window.__k3.extra = new Set(); window.__k3.att = 0;
      // every 100 ms: the admin debug data of the Skin-Stealer (the server's), and whom it had seen within the last second (its own
      // records: the best record seen now, the people with eye contact, its awareness record, a hunt's own sighting) and the person of
      // its last decision (made only about somebody it saw: a fresh one has none) - a name is legitimate only after a sighting
      window.__k3.recT = setInterval(() => { const k = (window.__k3.ss || [])[0]; if (!k) return; for (const f of Object.keys(k)) window.__k3.extra.add(f);
        const d = (window.__ents.dbg || []).find(x => x.i === k.i), q = d && d.sk; if (!q) return;
        const sees = [...new Set([].concat(d.lk && d.lk.seen && d.tg ? [d.tg] : [], (d.ec || []).map(c => c[0]), q.aw && q.aw.ago < 1 ? [q.aw.pid] : [], q.ht && q.ht.pid && q.ht.ev === 'seen' && q.ht.ago < 1 ? [q.ht.pid] : []))];
        window.__k3.rec.push({ t: +(performance.now() / 1000).toFixed(2), att: window.__k3.att, pl: q.pl, pid: q.pid || 0, ht: q.ht && q.ht.pid ? q.ht.pid : 0, hu: q.hu, ac: k.ac, why: q.why,
          lkSeen: d.lk ? d.lk.seen : 0, sees, dec: q.dec ? q.dec.pid : 0, hr: d.hr ? [d.hr.t, d.hr.I, d.hr.ty] : null, heardQ: q.tally ? q.tally.heardQ : 0, curious: q.tally ? q.tally.curious : 0, H: [Math.round(__api.H.x), Math.round(__api.H.y)], K: [k.x, k.y] }); }, 100); });
    // 1. heard, not seen (up to 3 attempts, each with a fresh Skin-Stealer): N runs back and forth behind a wall (the page's own keys, so
    // its footsteps are the server's own), Q crouches still out of its sight
    const attempts = [];
    for (let att = 1; att <= 3; att++) {
      N.cmd({ c: 'freeze', on: true }); N.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); await sleep(500);
      if (await N.P.evaluate(() => !!(__api.death() && __api.death().active) || !!__api.H.dead)) { N.cmd({ c: 'revive', id: nid }); await sleep(1800); }
      if (await Q.P.evaluate(() => !!(__api.death() && __api.death().active) || !!__api.H.dead)) { N.cmd({ c: 'revive', id: qid }); await sleep(1800); }
      await N.P.evaluate(a => { window.__k3.att = a; window.__k3.ss = null; }, att);
      // (each attempt from its own corner of the level, where walls are close: the dark south-west, the east, the north-west)
      await N.P.evaluate(q => { if (__api.sl(q.x, q.y, 30)) __api.tp(q.x, q.y); }, ANCHORS[att - 1]); await sleep(300);
      N.cmd({ c: 'near', k: 'skinstealer' });
      const K0 = await until(N.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0] : null, null, 8000);
      // N: open floor 200-360 px off with a wall in between, a second point 160 px along, the way between out of its sight too; Q: 500-900 px off, out of its sight
      // (hidden: no clear line from where it stands nor from open floor 140 px round it - it turns and takes a step or two as it listens)
      const spots = K0 && await N.P.evaluate(k => { const A = __api, out = {}, eyes = [{ x: k.x, y: k.y }];
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = k.x + Math.cos(a) * 140, y = k.y + Math.sin(a) * 140; if (A.sl(x, y, 26) && A.Uc(k.x, k.y, a, 140) >= 136) eyes.push({ x, y }); }
        const hid = (x, y) => eyes.every(o => { const d = Math.hypot(x - o.x, y - o.y); return A.Uc(o.x, o.y, Math.atan2(y - o.y, x - o.x), d) < d - 40; });
        for (const r of [240, 280, 200, 320, 360]) { for (let i = 0; i < 48 && !out.n; i++) { const a = i / 48 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
          if (!A.sl(x, y, 30) || !hid(x, y)) continue;
          for (let j = 0; j < 8; j++) { const b = j / 8 * Math.PI * 2, x2 = x + Math.cos(b) * 160, y2 = y + Math.sin(b) * 160;
            if (!A.sl(x2, y2, 30) || A.Uc(x, y, b, 160) < 156) continue;
            let ok = true; for (let s = 0; s <= 8 && ok; s++) ok = hid(x + (x2 - x) * s / 8, y + (y2 - y) * s / 8);
            if (ok) { out.n = [{ x, y }, { x: x2, y: y2 }]; break; } } } }
        for (const r of [700, 600, 800, 900, 520]) for (let i = 0; i < 32 && !out.q; i++) { const a = i / 32 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
          if (A.sl(x, y, 30) && hid(x, y)) out.q = { x, y }; }
        return out; }, K0);
      const A1 = { att, creature: K0, spots };
      attempts.push(A1);
      if (!spots || !spots.n || !spots.q) { A1.skipped = 'no hidden spots round the creature'; continue; }
      await N.P.evaluate(s => { __api.tp(s.x, s.y); }, spots.n[0]); await Q.P.evaluate(s => { __api.tp(s.x, s.y); }, spots.q);
      if (await N.P.evaluate(() => __api.lightOn())) await N.P.keyboard.press('KeyF');
      if (await Q.P.evaluate(() => __api.lightOn())) await Q.P.keyboard.press('KeyF');
      if (att === 1) { await Q.P.bringToFront(); await Q.P.keyboard.press('KeyC'); }                 // (Q crouches: the page's own crouch key)
      await N.P.bringToFront(); await sleep(300);
      N.cmd({ c: 'freeze', on: false });
      await N.P.evaluate(`(${PACE})(${JSON.stringify({ pts: spots.n, secs: 16, run: true })})`);
      await until(N.P, () => window.__k3.paceDone, null, 30000, 500);
      await sleep(4000);                                                                            // (what it does after the last sound)
      const rs = await N.P.evaluate(a => window.__k3.rec.filter(r => r.att === a), att);
      A1.reacted = rs.some(r => (r.pl === 'listen' || r.pl === 'search') && !r.pid);
      A1.sawN = rs.some(r => r.sees.includes(nid));
      A1.plans = [...new Set(rs.map(r => r.pl))]; A1.heardSounds = rs.filter(r => r.hr && r.hr[0] < .5).length; A1.samples = rs.length;
      if (A1.reacted) break;
    }
    R.attempts = attempts.map(a => ({ att: a.att, creature: a.creature, spots: a.spots, skipped: a.skipped, reacted: a.reacted, sawN: a.sawN, plans: a.plans, heardSounds: a.heardSounds, samples: a.samples }));
    const rec1 = await N.P.evaluate(() => window.__k3.rec.slice()); R.heardPhase = rec1.length;
    // 2. seen: a fresh Skin-Stealer (the first may have left N, or fed), and N (alive) steps into its view, torch on
    N.cmd({ c: 'freeze', on: true }); N.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); await sleep(500);
    for (const [pg, id] of [[N, nid], [Q, qid]]) if (await pg.P.evaluate(() => !!(__api.death() && __api.death().active) || !!__api.H.dead)) { N.cmd({ c: 'revive', id }); await sleep(1800); }
    await N.P.evaluate(() => { window.__k3.att = 9; window.__k3.ss = null; });
    N.cmd({ c: 'near', k: 'skinstealer' });
    const K1 = await until(N.P, () => window.__k3.ss && window.__k3.ss.length ? window.__k3.ss[0] : null, null, 8000);
    const view = K1 && await N.P.evaluate(k => { const A = __api; for (const r of [300, 260, 360]) for (let i = 0; i < 24; i++) { const a = (+k.a || 0) + (i % 2 ? 1 : -1) * Math.ceil(i / 2) / 24 * Math.PI * 2, x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
      if (A.sl(x, y, 30) && A.Uc(k.x, k.y, a, r) >= r - 4) return { x, y }; } return null; }, K1);
    R.view = view;
    if (view) { await N.P.evaluate(s => __api.tp(s.x, s.y), view); if (!(await N.P.evaluate(() => __api.lightOn()))) await N.P.keyboard.press('KeyF'); }
    N.cmd({ c: 'freeze', on: false });
    await until(N.P, ([nid, n0]) => (window.__k3.rec || []).slice(n0).some(r => r.ht === nid), [nid, rec1.length], 12000, 200);
    if (SHOTS) { await sleep(400); await N.P.screenshot({ path: path.join(SHOTS, 'r6_hunt_overlay_640.png') }); }    // (the hunt live, its HUNT line drawn)
    await sleep(2500);
    const rec = await N.P.evaluate(() => window.__k3.rec.slice()), lines = await N.P.evaluate(() => window.__k3.lines.slice()), extra = await N.P.evaluate(() => [...window.__k3.extra]);
    R.trace = rec.map(r => [r.t, r.att, r.pl, r.pid, r.ht, r.hu, r.ac, r.sees.join('/'), r.hr ? r.hr.join('/') : '', r.H.join(','), r.K.join(','), r.why.slice(0, 60)]);
    // a name only by sight: every sample that names somebody (a plan or a hunt about them) has an earlier sample, with the same
    // Skin-Stealer (the same attempt), in which it had seen them
    const unearnedOf = id => rec.filter(r => (r.pid === id || r.ht === id) && !rec.some(o => o.att === r.att && o.t <= r.t && (o.sees.includes(id) || o.dec === id)));
    const unearned = unearnedOf(nid);
    const firstName = rec.findIndex(r => r.pid === nid || r.ht === nid);
    const before = rec.slice(0, rec1.length), listened = before.some(r => r.pl === 'listen' && !r.pid), looked = before.some(r => r.pl === 'search' && !r.pid);
    const quietNamed = unearnedOf(qid).length, quietSeen = rec.filter(r => r.sees.includes(qid)).length, seenAt = rec.findIndex(r => r.ht === nid);
    R.heard = { listened, looked, unearnedNames: unearned.length, firstUnearned: unearned[0] || null, firstNameSample: firstName >= 0 ? rec[firstName] : null, quietNamed, quietSeen, attempts: R.attempts.length };
    check('pr_heard_not_named', unearned.length === 0, JSON.stringify(R.heard).slice(0, 900));
    check('pr_listened_then_looked', listened, listened ? `it stopped and listened to the footsteps (an anonymous sound) ${looked ? 'and went to look' : 'and let them go'}: ` + JSON.stringify(R.attempts.map(a => a.plans))
      : 'it did not react to the footsteps in this run (where the spot fell, how it was turned): ' + JSON.stringify(R.attempts.map(a => [a.plans, a.heardSounds])));
    check('pr_quiet_never_named', quietNamed === 0, `plans or hunts about the quiet page without a sighting before: ${quietNamed} (samples in which it saw the quiet page: ${quietSeen})`);
    check('pr_hunt_on_sight', seenAt >= 0, seenAt >= 0 ? JSON.stringify(rec[seenAt]) : 'no hunt of N after it came into view: ' + JSON.stringify(rec.slice(-5)));
    const hl = lines.filter(l => /^HUNT /.test(l));
    check('pr_overlay_hunt_line', hl.length > 0, JSON.stringify(hl.slice(0, 3)));
    check('pr_snapshot_public_fields_only', extra.every(f => PUB.includes(f)), JSON.stringify(extra));
    R.errors = { noise: N.errs, quiet: Q.errs };
    check('pr_no_page_errors', !N.errs.length && !Q.errs.length, JSON.stringify(R.errors));
  } catch (e) { check('pr_run', false, e && e.stack); }
  finally { await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  // a run in which it never reacted to the footsteps does not count the listen check (it says so)
  const counted = cases.filter(c => !(c.name === 'pr_listened_then_looked' && /did not react/.test(c.detail)));
  R.cases = cases; R.ok = counted.length > 0 && counted.every(c => c.ok);
  for (const c of cases) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + '\n       ' + c.detail);
  console.log(`PREDATOR BROWSER: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases${counted.length < cases.length ? ' (one not exercised in this run)' : ''}`);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  process.exitCode = R.ok ? 0 : 1;
})();
