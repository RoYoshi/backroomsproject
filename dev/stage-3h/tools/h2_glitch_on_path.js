/* Stage 3H2 - why B++'s place_replay.js can report a placement "not kept" by chance (development only; 3H finding F-036).
 *
 *   node dev/stage-3h/tools/h2_glitch_on_path.js --game DIR [--worlds N] [--tries N] [--out FILE.json]
 *
 * dev/stage-3e-0-bpp/place_replay.js (B++'s own check, left as it is) brings its mover to (1012, 690) and then walks it along y = 690
 * at 280 px/s for 0.6 s, in a fresh room each time.  It judges a placement kept when the last position it recorded for the mover from
 * the server's snapshots is within 8 px of the page's own.  The mover's join is the room's first, so it starts a fresh world (sim.js
 * join: no other active player -> resetWorld), with three glitched walls at random spots (makeGlitches: at least 2,600 px from the
 * start and from each other).  A player who comes within 54 px of one leaves the level at once (sim.js step: p.active = false), and
 * the snapshots stop listing it.
 *   A. offline, with the game's own sim.js: in N draws of the glitched walls (sim.admin.newGlitches: the same makeGlitches(3) a world
 *      reset uses), how many put one within 54 px of that walk, and where;
 *   B. on the game's real server (synthetic admin passcode, never the user's or the built-in default): place_replay.js's case
 *      bring545_old_s0 as it runs there (an HQ5-style mover, a pose every 50 ms, no stale pose), with one step added after the mover's
 *      join and before the BRINGs: a quiet admin redraws the glitched walls (admin GLITCH NEW) until one lies on the walk.  Recorded:
 *      whether the mover is sent 'exit', the server's track, and place_replay.js's own verdict, computed with its own rule.
 * Exit 0 always (a measurement); everything is in the report. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game), WORLDS = +(ARG.worlds || 20000), TRIES = +(ARG.tries || 6000), PASS = 'd3-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const WALK = { x0: 1012, x1: 1012 + 280 * 0.6, y: 690 }, TOUCH = 54;            // place_replay.js's walk after the BRING; sim.js's touch radius
const dWalk = (x, y) => Math.hypot(x - Math.max(WALK.x0, Math.min(WALK.x1, x)), y - WALK.y);
const R = { tool: 'dev/stage-3h/tools/h2_glitch_on_path.js', game: GAME, walk: WALK, touchPx: TOUCH };

/* A. offline */
{
  const createSim = require(path.join(GAME, 'sim.js')), sim = createSim({});
  let on = 0; const spots = {};
  for (let i = 0; i < WORLDS; i++) {
    sim.admin.newGlitches();
    const near = sim.entities().gw.filter(g => dWalk(g[0], g[1]) < TOUCH);
    if (near.length) { on++; for (const g of near) { const k = g.join(','); spots[k] = (spots[k] | 0) + 1; } }
  }
  R.offline = { worlds: WORLDS, withAGlitchedWallOnTheWalk: on, share: +(on / WORLDS).toFixed(5), spots };
  console.log(JSON.stringify({ offline: R.offline }));
}

/* B. on the real server */
(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.PORT; delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = '';
  srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const conn = room => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`); ws.onopen = () => res(ws); ws.onerror = rej; });
  try {
    /* place_replay.js's set-up, as there */
    const room = 'glitch' + PORT, adm = await conn(room), track = []; let moverId = 0, gw = null, snaps = 0;
    const atx = o => adm.readyState === 1 && adm.send(JSON.stringify(o));
    adm.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t !== 's') return; snaps++; if (m.e && m.e.gw) gw = m.e.gw;
      if (moverId) { const q = m.p.find(p => p.id === moverId); if (q) track.push([Date.now(), q.x, q.y]); } };
    atx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(250);
    atx({ t: 'p', x: 3000, y: 3000, a: 0, l: 0, k: 'flashlight', n: 'PLACER' });
    const S = { old: [504, 888], dest: [1012, 690] }, stale = 0;
    const ws = await conn(room), M = { pos: S.old.slice(), sent: [], tps: [], armed: false, walk: 0, mode: 'setup' }; let exitMsg = null;
    const send = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
    const pose = () => { const [x, y] = M.pos; M.sent.push([Date.now(), Math.round(x), Math.round(y), M.mode]); send({ t: 'p', x: Math.round(x), y: Math.round(y), vx: M.mode === 'walk' ? 280 : 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'Mover', c: '#ffe7b2', f: -1, lk: 'none|plain|#e6bb76|#ffcc77|none' }); };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hi') { moverId = m.id; M.id = m.id; }
      if (m.t === 'exit') exitMsg = { at: Date.now(), secs: m.secs, pagePos: M.pos.map(Math.round) };
      if (m.t !== 'tp') return;
      const at = Date.now(); M.tps.push([at, m.x, m.y, m.pc | 0, M.armed ? 'after' : 'setup']);
      if (!M.armed || M.placeAt) { if (!M.armed) M.pos = [m.x, m.y]; else if (M.mode !== 'stale') M.pos = [m.x, m.y]; return; }
      M.placeAt = at; M.placed = [m.x, m.y]; M.mode = 'stale';
      setTimeout(() => { M.pos = [m.x, m.y]; M.mode = 'walk'; M.walkFrom = Date.now(); }, stale);
    };
    send({ t: 'join' }); await sleep(80);
    const cad = 50; let stop = false;
    (async () => { while (!stop) { pose(); if (M.mode === 'walk') { const el = (Date.now() - M.walkFrom) / 1000; if (el < .6) M.pos = [M.placed[0] + 280 * el, M.placed[1]]; else M.mode = 'done'; } await sleep(cad); } })();
    await sleep(400);
    for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });
    atx({ t: 'a', c: 'god', id: moverId });
    /* the one added step: redraw the glitched walls of the world the join started until one lies on the walk */
    const after2 = async () => { const n0 = snaps; for (let i = 0; i < 100 && snaps < n0 + 2; i++) await sleep(10); };
    await after2();
    const onWalk = () => (gw || []).find(g => dWalk(g[0], g[1]) < TOUCH - 4);
    let tries = 0, hit = onWalk(); const firstWorld = gw;
    while (!hit && tries < TRIES) { atx({ t: 'a', c: 'glitch', mode: 'new' }); tries++; await after2(); hit = onWalk(); }
    R.live = { worldTheJoinStarted: firstWorld, redraws: tries, glitchedWallOnTheWalk: hit || null };
    if (!hit) { stop = true; console.log(JSON.stringify({ live: R.live })); return; }
    /* place_replay.js's bring545_old_s0 from here, as there */
    atx({ t: 'p', x: S.old[0], y: S.old[1], a: 0, l: 0, k: 'flashlight', n: 'PLACER' }); await sleep(80); atx({ t: 'a', c: 'bring', id: moverId });
    await sleep(1600);
    atx({ t: 'p', x: S.dest[0], y: S.dest[1], a: 0, l: 0, k: 'flashlight', n: 'PLACER' }); await sleep(80);
    M.armed = true; const cmdAt = Date.now();
    atx({ t: 'a', c: 'bring', id: moverId });
    await sleep(2600); stop = true; await sleep(60);
    /* place_replay.js's own verdict, its own rule */
    const end = track.length ? track[track.length - 1] : null, cEnd = M.pos.map(Math.round);
    const after = track.filter(r => r[0] > cmdAt + 20), oldPt = S.old;
    const far = M.placed && Math.hypot(M.placed[0] - oldPt[0], M.placed[1] - oldPt[1]) > 80;
    const backAtOld = !M.placed ? null : far ? after.filter(r => Math.hypot(r[1] - oldPt[0], r[2] - oldPt[1]) < 40).length : 0;
    const corr = M.tps.filter(t => t[4] === 'after' && t[0] > (M.placeAt || 0));
    const kept = !!(end && M.placed && Math.hypot(end[1] - cEnd[0], end[2] - cEnd[1]) <= 8 && backAtOld === 0 && corr.length === 0);
    Object.assign(R.live, { scenario: 'bring545_old_s0 (as in place_replay.js)', placed: M.placed || null, staleSent: M.sent.filter(s => s[3] === 'stale').length,
      walkPoses: M.sent.filter(s => s[3] === 'walk').length, serverEnd: end && end.slice(1), pageEnd: cEnd, backAtOldSamples: backAtOld,
      correctionsAfter: corr.length, keptByPlaceReplaysRule: kept,
      exit: exitMsg && { msAfterBring: exitMsg.at - cmdAt, pagePos: exitMsg.pagePos, distanceToTheGlitchedWall: Math.round(Math.hypot(exitMsg.pagePos[0] - hit[0], exitMsg.pagePos[1] - hit[1])) },
      lastTrackMsAfterBring: end ? end[0] - cmdAt : null,
      track: after.map(r => [r[0] - cmdAt, r[1], r[2]]).filter((r, i, a) => i === 0 || i === a.length - 1 || r[1] !== a[i - 1][1] || r[2] !== a[i - 1][2]).slice(0, 60) });
    console.log(JSON.stringify({ live: R.live }));
    try { ws.close(); adm.close(); } catch (e) { }
  } finally {
    srv.kill(); R.serverErrors = log.split('\n').filter(l => /Error|TypeError|failed/.test(l)).slice(0, 5);
    if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
    setTimeout(() => process.exit(0), 200);                                         // (the offline sim of part A may hold timers)
  }
})();
