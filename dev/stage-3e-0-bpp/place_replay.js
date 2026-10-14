/* Stage 3E-0 B++-0 - stale movement packets against a server placement, replayed deterministically (development only)
 *
 *   node dev/stage-3e-0-bpp/place_replay.js --game DIR --out FILE.json [--only NAME]
 *
 * The real server.js (synthetic admin passcode) and ordinary players over WebSockets that speak what mp.js speaks.  A quiet admin
 * connection (never joined) places players and records the server's position of each from every snapshot ('s', 20 Hz).
 *
 * The race: the server moves a player (admin BRING, world reset) and tells its page ('tp'); a pose the page sent before it learnt of
 * the move - still at the old spot - arrives after it.  Here the mover, once its page gets the placement 'tp', goes on sending its
 * OLD spot for STALE ms (the poses that were in flight / sent before it knew), then takes the new spot and at once walks on
 * (280 px/s, +x, 0.6 s): legitimate movement right after the placement must be taken at once.
 *
 * Scenarios (each in its own room of one server):
 *   bring545_*   BRING from (504, 888) to (1012, 690): 545 px, a free straight line (the case HQ2's col_browser.py set-up hit)
 *   world545_*   a world reset from (1454, 3494), 545 px from the reset spot (960, 3264), a free straight line
 *   bring60_*    BRING 60 px (a stale pose within what a legal move could cover: must end at the new spot all the same)
 *   bringFar_*   BRING from 1400+ px away (beyond any budget: kept before and after - the control)
 *   *_bp*        a B+ client: asks 'caps', sends every 25 ms;  *_old*  an HQ5 client: never asks, sends every 50 ms
 *   *_jit*       send times jittered +-30 %, STALE drawn from 10..150 ms
 * Per scenario: kept (the server ends where the page is, the new spot plus its walk, within 8 px, and was never back within 40 px
 * of the old spot after the placement), the corrections ('tp' after the placement's own), the server's track, and walkFollow (the
 * largest distance between the server and where the page had been 100 ms earlier while it walked, counting only the page's poses since it
 * took the new spot: the walk taken at once).
 * Exit 0 always (a measurement); the verdicts are in FILE.json. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game), PASS = 'd3-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const SC = [];
for (const [tag, fast] of [['bp', true], ['old', false]]) {
  for (const st of [0, 30, 80, 150]) SC.push({ name: `bring545_${tag}_s${st}`, kind: 'bring', fast, stale: st, old: [504, 888], dest: [1012, 690] });
  for (let i = 0; i < 3; i++) SC.push({ name: `bring545_${tag}_jit${i}`, kind: 'bring', fast, stale: 'rnd', jit: true, old: [504, 888], dest: [1012, 690] });
  for (const st of [30, 80]) SC.push({ name: `world545_${tag}_s${st}`, kind: 'world', fast, stale: st, old: [1454, 3494] });
  SC.push({ name: `bring60_${tag}_s80`, kind: 'bring', fast, stale: 80, old: [952, 690], dest: [1012, 690] });
  SC.push({ name: `bringFar_${tag}_s80`, kind: 'bring', fast, stale: 80, old: [348, 2652], dest: [1012, 690] });
}

(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.PORT; delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const conn = room => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`); ws.onopen = () => res(ws); ws.onerror = rej; });
  const R = { tool: 'dev/stage-3e-0-bpp/place_replay.js', game: GAME, scenarios: [] };
  try {
    for (const S of SC) {
      if (ARG.only && !S.name.startsWith(ARG.only)) continue;
      const room = 'pr' + PORT + '_' + S.name, stale = S.stale === 'rnd' ? Math.round(10 + rnd() * 140) : S.stale;
      /* the quiet admin: places, resets, and records the server's positions */
      const adm = await conn(room), track = []; let moverId = 0;
      const atx = o => adm.readyState === 1 && adm.send(JSON.stringify(o));
      adm.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 's' && moverId) { const q = m.p.find(p => p.id === moverId); if (q) track.push([Date.now(), q.x, q.y]); } };
      atx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(250);
      atx({ t: 'p', x: 3000, y: 3000, a: 0, l: 0, k: 'flashlight', n: 'PLACER' });
      /* the mover: an ordinary player */
      const ws = await conn(room), M = { pos: S.old.slice(), sent: [], tps: [], armed: false, walk: 0, mode: 'setup' };
      const send = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
      const pose = () => { const [x, y] = M.pos; M.sent.push([Date.now(), Math.round(x), Math.round(y), M.mode]); send({ t: 'p', x: Math.round(x), y: Math.round(y), vx: M.mode === 'walk' ? 280 : 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'Mover', c: '#ffe7b2', f: -1, lk: 'none|plain|#e6bb76|#ffcc77|none' }); };
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'hi') { moverId = m.id; M.id = m.id; }
        if (m.t !== 'tp') return;
        const at = Date.now(); M.tps.push([at, m.x, m.y, m.pc | 0, M.armed ? 'after' : 'setup']);
        if (!M.armed || M.placeAt) { if (!M.armed) M.pos = [m.x, m.y]; else if (M.mode !== 'stale') M.pos = [m.x, m.y]; return; }   // (setup: take it; after the placement: an ordinary page takes every tp)
        M.placeAt = at; M.placed = [m.x, m.y]; M.mode = 'stale';                   // the placement's own tp: keep sending the OLD spot for STALE ms
        setTimeout(() => { M.pos = [m.x, m.y]; M.mode = 'walk'; M.walkFrom = Date.now(); }, stale);
      };
      if (S.fast) send({ t: 'caps', fp: 1 });
      send({ t: 'join' }); await sleep(80);
      const cad = S.fast ? 25 : 50; let stop = false;
      (async () => { while (!stop) { pose(); if (M.mode === 'walk') { const el = (Date.now() - M.walkFrom) / 1000; if (el < .6) M.pos = [M.placed[0] + 280 * el, M.placed[1]]; else M.mode = 'done'; } await sleep(S.jit ? cad * (0.7 + 0.6 * rnd()) : cad); } })();
      await sleep(400);
      for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });
      atx({ t: 'a', c: 'god', id: moverId });
      atx({ t: 'p', x: S.old[0], y: S.old[1], a: 0, l: 0, k: 'flashlight', n: 'PLACER' }); await sleep(80); atx({ t: 'a', c: 'bring', id: moverId });   // (set-up: brought to the old spot)
      await sleep(1600);                                                           // settled at the old spot, the budget full again, the grace over
      const oldSrv = track.length ? track[track.length - 1].slice(1) : null;
      if (S.kind === 'bring') { atx({ t: 'p', x: S.dest[0], y: S.dest[1], a: 0, l: 0, k: 'flashlight', n: 'PLACER' }); await sleep(80); }
      M.armed = true; const cmdAt = Date.now();
      atx(S.kind === 'bring' ? { t: 'a', c: 'bring', id: moverId } : { t: 'a', c: 'world' });
      await sleep(2600); stop = true; await sleep(60);
      const end = track.length ? track[track.length - 1] : null, cEnd = M.pos.map(Math.round);
      const after = track.filter(r => r[0] > cmdAt + 20), oldPt = S.old;
      const far = M.placed && Math.hypot(M.placed[0] - oldPt[0], M.placed[1] - oldPt[1]) > 80;   // (a 60 px placement: 'back at the old spot' cannot be told from the walk)
      const backAtOld = !M.placed ? null : far ? after.filter(r => Math.hypot(r[1] - oldPt[0], r[2] - oldPt[1]) < 40).length : 0;
      const walkSent = M.sent.filter(s => s[3] === 'walk');
      let follow = 0;
      for (const r of after) { if (!M.walkFrom || r[0] < M.walkFrom + 100 || r[0] > M.walkFrom + 600) continue; const ref = [...M.sent].reverse().find(s => s[0] <= r[0] - 100 && (s[3] === 'walk' || s[3] === 'done')); if (ref) follow = Math.max(follow, Math.hypot(r[1] - ref[1], r[2] - ref[2])); }
      const corr = M.tps.filter(t => t[4] === 'after' && t[0] > (M.placeAt || 0));
      const kept = !!(end && M.placed && Math.hypot(end[1] - cEnd[0], end[2] - cEnd[1]) <= 8 && backAtOld === 0 && corr.length === 0);
      const row = { name: S.name, client: S.fast ? 'B+ (caps, 25 ms)' : 'HQ5 (50 ms)', jitter: !!S.jit, staleMs: stale, oldSpot: oldPt, oldOnServer: oldSrv, placed: M.placed || null,
        placedDistance: M.placed ? Math.round(Math.hypot(M.placed[0] - oldPt[0], M.placed[1] - oldPt[1])) : null, staleSent: M.sent.filter(s => s[3] === 'stale').length,
        serverEnd: end && end.slice(1), pageEnd: cEnd, backAtOldSamples: backAtOld, correctionsAfter: corr.map(t => [t[0] - (M.placeAt || cmdAt), t[1], t[2], t[3]]),
        walkPoses: walkSent.length, walkFollowPx: Math.round(follow * 10) / 10, kept,
        track: after.map(r => [r[0] - cmdAt, r[1], r[2]]).filter((r, i, a) => i === 0 || i === a.length - 1 || r[1] !== a[i - 1][1] || r[2] !== a[i - 1][2]).slice(0, 60) };
      R.scenarios.push(row);
      console.log(JSON.stringify({ name: row.name, staleMs: stale, placedDistance: row.placedDistance, staleSent: row.staleSent, kept, backAtOld, corrections: row.correctionsAfter.length, walkFollowPx: row.walkFollowPx, serverEnd: row.serverEnd, pageEnd: cEnd }));
      try { ws.close(); adm.close(); } catch (e) { }
      await sleep(150);
    }
  } finally { srv.kill(); }
  R.serverErrors = log.split('\n').filter(l => /Error|TypeError|failed/.test(l)).slice(0, 5);
  const by = k => R.scenarios.filter(s => s.name.startsWith(k));
  R.summary = {};
  for (const k of ['bring545_bp', 'bring545_old', 'world545_bp', 'world545_old', 'bring60_bp', 'bring60_old', 'bringFar_bp', 'bringFar_old']) { const s = by(k); if (s.length) R.summary[k] = { kept: s.filter(x => x.kept).length, of: s.length, maxWalkFollowPx: Math.max(...s.map(x => x.walkFollowPx)) }; }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify({ summary: R.summary, serverErrors: R.serverErrors }));
})();
