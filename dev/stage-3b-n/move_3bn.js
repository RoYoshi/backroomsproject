/* Stage 3B-N N4 - Shift while crouched -> stand and run, against the real server and client (development only; never served).
 *
 *   node dev/stage-3b-n/move_3bn.js [--game PATH] [--port 9475] [--out FILE.json]      (exit 1 on any failure)
 *
 * Real key presses (Playwright keyboard) into the real client; every fixed movement step is recorded in the page (state, position,
 * speed, stamina, and whether a standing body fits where the player is).
 * M1 open space: C (crouch), then Shift + a direction: you stand and run (run state, run speed) without pressing C again
 * M2 insufficient clearance: crawling under low furniture with Shift + a direction held you stay low the whole way (no frame in
 *    which a standing body would not fit), and stand up and run the moment you are out
 * M3 stamina: exhausted (the run rule's gate), crouched, Shift + a direction: you stay crouched; when stamina is back (Shift still
 *    held) you stand and run
 * M4 repeated Shift presses while crouched and moving: the first stands you up; none ever crouches you again; no stand/crouch flicker
 * M5 C while Shift is already held crouches you (C wins) and moving keeps you crouched, until Shift is pressed again
 * M6 slide rules kept: run + C slides; the slide ends low with its recovery; with Shift still held you run again after it
 * M7 networked, a non-admin player (the server checks every position): crouch -> Shift run; the server accepts every position (no
 *    correction sent back), and a second, observing player receives crouch then run (state and speed) for that player */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9475), OUT = opt('out');
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };

/* in-page recorder: wraps the movement step (one call per fixed tick) */
const PAGE = `(() => {
  const tryHook = () => { const mv = window.__mv; if (!mv || mv.__rec) return !!(mv && mv.__rec); const step = mv.step; mv.__rec = 1; window.__mvLog = [];
    mv.step = function (ix, iy, run, dt) { const r = step.apply(this, arguments), A = __api, Hh = A.H, W = window.WORLD;
      let fits = true; W.setMode('walk'); try { fits = A.Bc(Hh.x, Hh.y).every(t => Math.hypot(Hh.x - Math.max(t.x, Math.min(Hh.x, t.x + t.w)), Hh.y - Math.max(t.y, Math.min(Hh.y, t.y + t.h))) >= W.MOVE.radius - .01); } finally { W.setMode('walk'); }
      const L = window.__mvLog; L.push({ t: performance.now(), s: mv.s, x: +Hh.x.toFixed(1), y: +Hh.y.toFixed(1), sp: Math.round(mv.speed), st: +Hh.stamina.toFixed(1), ex: Hh.exhausted ? 1 : 0, run: run ? 1 : 0, mov: ix || iy ? 1 : 0, crouch: mv.crouch ? 1 : 0, fits, zone: mv.zone ? 1 : 0 });
      if (L.length > 4000) L.splice(0, 1000); return r; };
    return true; };
  const iv = setInterval(() => { if (tryHook()) clearInterval(iv); }, 50);
})();`;
const log = P => P.evaluate(() => { const l = window.__mvLog || []; window.__mvLog = []; return l; });
const states = l => { const out = []; for (const r of l) if (!out.length || out[out.length - 1] !== r.s) out.push(r.s); return out; };
const firstIdx = (l, f) => l.findIndex(f);

(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = {};
  try {
    const J = await H.join(browser, PORT, 'mv' + Date.now() % 1e5, 'MOVER', { init: PAGE }), P = J.P, K = P.keyboard;
    await H.stage(P); await H.setLights(P, 'off'); await P.evaluate(() => __clock.thaw());
    await H.until(() => P.evaluate(() => !!(window.__mv && __mv.__rec)), 10000);
    const spot = await P.evaluate(() => { const A = __api; for (let y = 3000; y < 4300; y += 48) for (let x = 400; x < 2000; x += 48) { if (!A.sl(x, y, 30)) continue; if (A.Uc(x, y, 0, 900) > 800 && A.Uc(x, y, Math.PI, 60) >= 60) return [x, y]; } return null; });
    R.spot = spot;
    const reset = async (x, y, st = 100) => { await K.up('ShiftLeft'); for (const k of ['KeyD', 'KeyA', 'KeyW', 'KeyS', 'KeyC']) await K.up(k);
      await P.evaluate(([x, y, st]) => { __mv.reset(); __api.tp(x, y); __api.H.stamina = st; __api.H.exhausted = false; }, [x, y, st]); await frames(P, 8); await log(P); };
    const crouch = async () => { await K.down('KeyC'); await frames(P, 3); await K.up('KeyC'); await frames(P, 4); return P.evaluate(() => __mv.crouch); };

    /* ---- M1 open space ---- */
    await reset(spot[0], spot[1]); const c1 = await crouch(); await log(P);
    await K.down('ShiftLeft'); await K.down('KeyD'); await sleep(900); await K.up('KeyD'); await K.up('ShiftLeft'); const l1 = await log(P);
    const keysAt = firstIdx(l1, r => r.run && r.mov), runAt = firstIdx(l1, r => r.s === 'run') - keysAt, maxSp = Math.max(...l1.map(r => r.sp));
    R.M1 = { crouchedFirst: c1, states: states(l1), stepsToRun: runAt, maxSpeed: maxSp };
    check('M1 open space: crouched, Shift + a direction stands you up and runs (no second C), at the ordinary run speed', c1 && keysAt >= 0 && l1.slice(0, keysAt).every(r => r.crouch) && runAt >= 0 && runAt <= 2 && maxSp >= 240 && l1.slice(keysAt + runAt).every(r => !r.crouch),
      `crouched ${c1}; states ${states(l1).join(' > ')}; running ${runAt} step(s) after Shift + direction reached the movement step; top speed ${maxSp} px/s (run 285)`);

    /* ---- M2 under low furniture ---- */
    const tbl = await P.evaluate(() => { const A = __api, L = WORLD.PROPS.filter(p => p.type === 'under').map(p => p.rect).filter(r => r.w >= 140 || r.h >= 140);
      for (const r of L) { const horiz = r.w >= r.h, cx = r.x + r.w / 2, cy = r.y + r.h / 2, x0 = horiz ? Math.max(r.x + 24, r.x + r.w - 70) : cx, y0 = horiz ? cy : Math.max(r.y + 24, r.y + r.h - 70), a = horiz ? 0 : Math.PI / 2;
        const ex = horiz ? r.x + r.w + 140 : cx, ey = horiz ? cy : r.y + r.h + 140; if (!A.sl(ex, ey, 24)) continue; return { r, x0, y0, a, key: horiz ? 'KeyD' : 'KeyS' }; } return null; });
    if (!tbl) check('M2 insufficient clearance', false, 'no long table / bench found');
    else {
      await reset(tbl.x0, tbl.y0); await P.evaluate(() => { __mv.crouch = true; }); await frames(P, 6); await log(P);
      await K.down('ShiftLeft'); await K.down(tbl.key); await sleep(2600); await K.up(tbl.key); await K.up('ShiftLeft'); const l2 = await log(P);
      const bad = l2.filter(r => !r.crouch && !r.fits), outAt = firstIdx(l2, r => !r.crouch), inside = l2.slice(0, outAt < 0 ? l2.length : outAt), ranAfter = l2.slice(outAt).some(r => r.s === 'run');
      R.M2 = { table: tbl.r, states: states(l2), standingWithoutRoom: bad.length, lowFrames: inside.length, firstStand: outAt >= 0 ? l2[outAt] : null, ranAfter, under: inside.filter(r => r.zone).length };
      check('M2 insufficient clearance: under low furniture with Shift held you stay low (no frame standing where a standing body does not fit); out from under it you stand and run',
        bad.length === 0 && R.M2.under > 10 && outAt > 0 && ranAfter && !l2[outAt].zone && l2[outAt].fits,
        `states ${states(l2).join(' > ')}; ${R.M2.under} steps under it, ${inside.length} low; standing without room ${bad.length}; stood at ${outAt >= 0 ? `(${l2[outAt].x}, ${l2[outAt].y})` : '-'}; ran after ${ranAfter}`);
    }

    /* ---- M3 stamina ---- */
    await reset(spot[0], spot[1], 0); await crouch(); await P.evaluate(() => { __api.H.stamina = 0; __api.H.exhausted = true; }); await log(P);
    await K.down('ShiftLeft'); await K.down('KeyD'); await sleep(700); const l3a = await log(P);
    await P.evaluate(() => { __api.H.stamina = 100; __api.H.exhausted = false; }); await sleep(500); await K.up('KeyD'); await K.up('ShiftLeft'); const l3b = await log(P);
    R.M3 = { exhausted: states(l3a), refilled: states(l3b), exhaustedMaxSpeed: Math.max(...l3a.map(r => r.sp)) };
    check('M3 stamina: exhausted you stay crouched with Shift held; when stamina is back (Shift still held) you stand and run',
      l3a.length > 20 && l3a.every(r => r.crouch && r.s !== 'run') && l3b.some(r => r.s === 'run'),
      `exhausted: ${R.M3.exhausted.join(' > ')} (top ${R.M3.exhaustedMaxSpeed} px/s); stamina back: ${R.M3.refilled.join(' > ')}`);

    /* ---- M4 repeated presses ---- */
    await reset(spot[0], spot[1]); await crouch(); await log(P); await K.down('KeyD');
    for (let i = 0; i < 6; i++) { await K.down('ShiftLeft'); await sleep(90); await K.up('ShiftLeft'); await sleep(140); }
    await K.up('KeyD'); const l4 = await log(P); const st4 = states(l4), firstUp = firstIdx(l4, r => !r.crouch);
    R.M4 = { states: st4, recrouched: l4.slice(firstUp).filter(r => r.crouch).length };
    check('M4 repeated Shift presses while crouched and moving: the first press stands you up; none crouches you again (no stand/crouch flicker)', firstUp >= 0 && R.M4.recrouched === 0 && st4.filter(s => s === 'crouch').length <= 1,
      `states ${st4.join(' > ')}; crouched again after standing: ${R.M4.recrouched} steps`);

    /* ---- M5 C while Shift held ---- */
    await reset(spot[0], spot[1]); await K.down('ShiftLeft'); await frames(P, 4); const c5 = await crouch(); await log(P);
    await K.down('KeyD'); await sleep(500); const l5a = await log(P);
    await K.up('ShiftLeft'); await frames(P, 3); await K.down('ShiftLeft'); await sleep(500); await K.up('KeyD'); await K.up('ShiftLeft'); const l5b = await log(P);
    R.M5 = { crouched: c5, heldMoving: states(l5a), afterRepress: states(l5b) };
    check('M5 C while Shift is held crouches you and moving keeps you low; pressing Shift again stands you up and runs', c5 && l5a.every(r => r.crouch) && l5b.some(r => r.s === 'run'),
      `C with Shift held: crouched ${c5}; moving with Shift still held: ${R.M5.heldMoving.join(' > ')}; Shift pressed again: ${R.M5.afterRepress.join(' > ')}`);

    /* ---- M6 slide ---- */
    await reset(spot[0], spot[1]); await K.down('ShiftLeft'); await K.down('KeyD'); await sleep(700); await K.down('KeyC'); await frames(P, 3); await K.up('KeyC'); await sleep(1600); await K.up('KeyD'); await K.up('ShiftLeft'); const l6 = await log(P);
    const sl0 = firstIdx(l6, r => r.s === 'slide'), slEnd = sl0 < 0 ? -1 : firstIdx(l6.slice(sl0), r => r.s !== 'slide') + sl0, low = slEnd < 0 ? [] : l6.slice(slEnd, firstIdx(l6.slice(slEnd), r => !r.crouch) + slEnd);
    const lowMs = low.length ? low[low.length - 1].t - low[0].t : 0, after = slEnd < 0 ? [] : l6.slice(slEnd + low.length);
    R.M6 = { states: states(l6), lowAfterSlideMs: Math.round(lowMs), ranAfter: after.some(r => r.s === 'run') };
    check('M6 slide rules kept: run + C slides, the slide ends low for its recovery, and with Shift still held you run again after it', sl0 >= 0 && lowMs >= 250 && R.M6.ranAfter,
      `states ${R.M6.states.join(' > ')}; low after the slide ${R.M6.lowAfterSlideMs} ms (recovery .32 s); ran after: ${R.M6.ranAfter}`);
    R.pageErrors = J.errs; await J.ctx.close();

    /* ---- M7 networked: a non-admin player, an observer ---- */
    const room = 'mvnet' + Date.now() % 1e5, obs = new H.ScriptedPeer(PORT, room, 'OBSERVER'); const snaps = [];
    await obs.ready; obs.start(); obs.send({ t: 'admin', pass: 'smoor' }); await sleep(800);
    const on = obs.ws.onmessage; obs.ws.onmessage = ev => { on(ev); try { const m = JSON.parse(ev.data); if (m.t === 's') snaps.push([Date.now(), m.p]); } catch (e) { } };
    obs.send({ t: 'a', c: 'freeze', on: 0 }); for (let i = 0; i < 4; i++) { obs.send({ t: 'a', c: 'hounds', mode: 'remove', n: 10 }); obs.send({ t: 'a', c: 'smilers', mode: 'remove', n: 10 }); await sleep(300); }
    obs.send({ t: 'a', c: 'freeze', on: 1 });
    const J2 = await H.join(browser, PORT, room, 'NETMOVER', { init: PAGE, admin: false }), Q = J2.P, K2 = Q.keyboard;
    await Q.evaluate(() => { window.__corr = 0; __ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.t === 'tp') window.__corr++; } catch (x) { } }); });
    await H.until(() => Q.evaluate(() => !!(window.__mv && __mv.__rec)), 10000); await sleep(1500);
    const myId = await Q.evaluate(() => window.__wsTap.id);
    const dir = await Q.evaluate(() => { const A = __api, H = A.H; let best = null; for (const [k, a] of [['KeyD', 0], ['KeyS', Math.PI / 2], ['KeyA', Math.PI], ['KeyW', -Math.PI / 2]]) { const L = A.Uc(H.x, H.y, a, 900); if (!best || L > best.L) best = { k, a, L }; } return best; });
    await K2.down('KeyC'); await frames(Q, 3); await K2.up('KeyC'); await sleep(600); await log(Q);
    const t0 = Date.now(); await K2.down('ShiftLeft'); await K2.down(dir.k); await sleep(Math.min(1400, (dir.L - 80) / 285 * 1000)); await K2.up(dir.k); await K2.up('ShiftLeft'); await sleep(700);
    const l7 = await log(Q), corr = await Q.evaluate(() => window.__corr), cli = await Q.evaluate(() => [__api.H.x, __api.H.y]);
    const seen = snaps.map(([t, ps]) => { const me = ps.find(p => p.id === myId); return me ? { t: t - t0, st: me.mv[0], sp: me.mv[1], x: me.x, y: me.y } : null; }).filter(Boolean);
    const seenStates = []; for (const s of seen) if (!seenStates.length || seenStates[seenStates.length - 1] !== s.st) seenStates.push(s.st);
    const lastSeen = seen[seen.length - 1], drift = lastSeen ? Math.hypot(lastSeen.x - cli[0], lastSeen.y - cli[1]) : 1e9;
    R.M7 = { dir, clientStates: states(l7), observedStates: seenStates.map(s => ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'][s]), corrections: corr, observedTopSpeed: Math.max(0, ...seen.map(s => s.sp)), finalDrift: Math.round(drift), errors: J2.errs };
    const ci = R.M7.observedStates.indexOf('crouch'), ri = R.M7.observedStates.indexOf('run');
    check('M7 networked (server-checked player): crouch -> Shift runs; the server accepts every position (no correction) and an observing player sees crouch, then run at run speed, where the player really is',
      states(l7).includes('run') && corr === 0 && ci >= 0 && ri > ci && R.M7.observedTopSpeed >= 230 && drift < 40,
      `client ${states(l7).join(' > ')}; corrections ${corr}; the observer saw ${R.M7.observedStates.join(' > ')} (top ${R.M7.observedTopSpeed} px/s); server vs client position after ${R.M7.finalDrift} px`);
    obs.close(); await J2.ctx.close();
  } catch (e) { check('M00 harness', false, String(e && e.stack || e).slice(0, 700)); }
  await browser.close(); srv.kill();
  R.results = results; if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})();
