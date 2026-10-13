/* Stage 3D HQ2 - the server under many NEW RUN blasts and moving, touching players: does its memory level off? (development only)
 *
 *   node dev/stage-3d-hq2/nr_soak.js --game DIR [--events 32] [--out FILE.json]
 *
 * dev/stage-3d/server_soak.js's measure, for HQ2: the real server.js (synthetic admin passcode), started with the inspector; a quiet admin
 * observer and four ORDINARY players over WebSockets.  The four take turns pressing NEW RUN (each waits out its own 30 s cooldown), so
 * EVENTS blasts in all; between blasts the others walk into each other in the open hall (every packet swept against the peers, soft
 * corrections), and each blasted player joins again.  After every blast's corpse is placed: the server's JS heap after a forced garbage
 * collection (V8 HeapProfiler.collectGarbage, then Runtime.getHeapUsage) and its RSS.  The first eight events warm up; the least-squares
 * slope of the heap over the rest is the leak measure (MB per event).  The gate (STAGE_3D_HQ2_AUDIT.md section 5): <= 0.01 MB per event.
 * Also checked: every press approved, every blast's corpse on the server, one corpse per player at the end (never more), and no
 * per-player collision state left for players who have gone (the server's own counters only). */
'use strict';
const { spawn, execFileSync } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net'), http = require('http');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || '.'), N = +(ARG.events || 32), PASS = 'd3-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const slope = ys => { const n = ys.length, mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; ys.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; }); return den ? num / den : 0; };
const HALL = { x: 4450, y: 3450 };
async function client(port, room, name, admin) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`), c = { ws, id: 0, nra: [], w: null, bodies: [], tp: 0, x: 0, y: 0 };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === 'hi') c.id = m.id; else if (m.t === 's') { c.w = m.w; if (m.ad) c.ad = m.ad; } else if (m.t === 'nra') c.nra.push(m); else if (m.t === 'bodies') c.bodies = m.b || [];
    else if (m.t === 'tp') { c.tp++; c.x = m.x; c.y = m.y; } };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
  c.pos = (x, y) => { c.x = x; c.y = y; c.tx({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 1, st: 100, ex: 0, sp: 150, ev: [] } }); };
  await sleep(150); if (admin) { c.tx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(200); }
  return c;
}
async function inspector(port) {
  const list = await new Promise(res => http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }));
  const ws = new WebSocket(list[0].webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m.result); wait.delete(m.id); } };
  return { send: (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }), close: () => ws.close() };
}
(async () => {
  const port = await freePort(), iport = await freePort();
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL;
  const srv = spawn(process.execPath, [`--inspect=127.0.0.1:${iport}`, 'server.js', String(port)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  await sleep(1500);
  const I = await inspector(iport); await I.send('HeapProfiler.enable'); await I.send('Runtime.enable');
  const room = 'nrsoak' + port, O = await client(port, room, 'OBS', true);
  const clear = async () => { for (let k = 0; k < 6; k++) O.tx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let k = 0; k < 8; k++) O.tx({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(200); };
  const P = []; const home = i => [HALL.x - 90 + i * 60, HALL.y];
  for (let i = 0; i < 4; i++) { const c = await client(port, room, 'P' + i, false); P.push(c); c.tx({ t: 'join' }); await sleep(200); await clear(); const h = home(i); c.pos(h[0], h[1]); await sleep(200); for (let k = 0; k < 3; k++) { c.pos(h[0], h[1]); await sleep(60); } }
  for (const c of P) O.tx({ t: 'a', c: 'god', id: c.id }); await clear();
  let walkOn = true;
  const walker = (async () => {                                           // the players not blasted walk into each other at the hall's centre and back
    let k = 0;
    while (walkOn) { k++; for (let i = 0; i < 4; i++) { const c = P[i], h = home(i), gx = k % 2 ? HALL.x : h[0], gy = k % 2 ? HALL.y : h[1]; for (let s = 0; s < 1; s++) { const dx = gx - c.x, dy = gy - c.y, d = Math.hypot(dx, dy); if (d > 1) c.pos(c.x + dx / d * Math.min(d, 8), c.y + dy / d * Math.min(d, 8)); else c.pos(c.x, c.y); } }
      await sleep(50); if (k % 40 === 0) k++; }
  })();
  const rows = []; let q = 0;
  const lastAt = P.map(() => 0);
  for (let i = 0; i < N; i++) {
    const j = i % 4, c = P[j];
    while (Date.now() - lastAt[j] < 30300) await sleep(100);
    const n0 = c.nra.length; c.tx({ t: 'nr', q: ++q, w: c.w });
    const t0 = Date.now(); while (Date.now() - t0 < 2000 && c.nra.length === n0) await sleep(20);
    const a = c.nra[c.nra.length - 1]; lastAt[j] = Date.now();
    await sleep(3700);                                                     // the blast plays 3.2 s; its corpse is placed
    const corpse = O.bodies.find(b => b.k === c.id && b.c === 'Boom' && a && b.de === a.de);
    c.tx({ t: 'join' }); await sleep(150); const h = home(j); c.pos(h[0], h[1]); await sleep(200); await clear();
    await I.send('HeapProfiler.collectGarbage'); const hu = await I.send('Runtime.getHeapUsage');
    const rss = +execFileSync('ps', ['-o', 'rss=', '-p', String(srv.pid)]).toString().trim() / 1024;
    rows.push({ i, player: j, approved: !!(a && a.ok), de: a && a.de, corpse: !!corpse, corpses: O.bodies.length, heapMB: +(hu.usedSize / 1048576).toFixed(3), rssMB: +rss.toFixed(1) });
    if (i % 4 === 3) console.log(JSON.stringify(rows[rows.length - 1]));
  }
  walkOn = false; await walker;
  const use = rows.slice(8), byPlayer = {}; for (const b of O.bodies) byPlayer[b.k] = (byPlayer[b.k] || 0) + 1;
  const R = { tool: 'dev/stage-3d-hq2/nr_soak.js', game: GAME, events: rows.length, rows,
    heapSlopeMBPerEvent: +slope(use.map(r => r.heapMB)).toFixed(4), rssSlopeMBPerEvent: +slope(use.map(r => r.rssMB)).toFixed(3),
    heapFirstLast: [use[0] && use[0].heapMB, use[use.length - 1] && use[use.length - 1].heapMB], rssFirstLast: [use[0] && use[0].rssMB, use[use.length - 1] && use[use.length - 1].rssMB],
    corpsesAtTheEnd: O.bodies.length, corpsesPerPlayer: byPlayer, correctionsToWalkers: P.map(c => c.tp),
    serverErrors: log.split('\n').filter(l => /Error|failed/.test(l)).slice(0, 5) };
  R.checks = [
    { name: `every press approved and every blast's corpse placed (${N} events)`, ok: rows.every(r => r.approved && r.corpse) },
    { name: 'one corpse per player at the end, never more (4 players, 4 corpses)', ok: O.bodies.length === 4 && Object.values(byPlayer).every(n => n === 1) },
    { name: 'the forced-GC heap does not grow per NEW RUN event (slope over events 9-' + N + ' <= 0.01 MB per event)', ok: R.heapSlopeMBPerEvent <= 0.01 },
    { name: 'no server errors', ok: !R.serverErrors.length } ];
  R.ok = R.checks.every(c => c.ok);
  I.close(); srv.kill(); for (const c of P.concat([O])) try { c.ws.close(); } catch (e) { }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  for (const c of R.checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name);
  console.log(JSON.stringify({ heapSlopeMBPerEvent: R.heapSlopeMBPerEvent, rssSlopeMBPerEvent: R.rssSlopeMBPerEvent, heapFirstLast: R.heapFirstLast, rssFirstLast: R.rssFirstLast }));
  process.exit(R.ok ? 0 : 1);
})();
