/* Stage 3D - the server under many deaths: does its memory level off? (development only)
 *
 *   node dev/stage-3d/server_soak.js --game DIR [--deaths 60] [--out FILE.json] [--nogc 1]
 *
 * The real server.js (synthetic admin passcode) with an observer and a victim over WebSockets; the victim dies again and again through
 * the admin death preview, all eight variants in turn (Hound C where it is chosen), respawning each time; the observer just listens.
 * After every death: the server process's resident memory (RSS) and, through the inspector the server is started with, its JS heap after
 * a forced garbage collection (V8 HeapProfiler.collectGarbage, then Runtime.getHeapUsage).  The first eight deaths warm up; the
 * least-squares slope of the heap over the rest is the leak measure (MB per death).
 * --nogc 1: no forced garbage collection - the server collects when V8 decides, as in play.  Then the heap is read as it stands
 * (used and committed) next to RSS: what the process really holds between collections, and whether that levels off. */
'use strict';
const { spawn, execFileSync } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net'), http = require('http');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || path.join(__dirname, '..', '..')), N = +(ARG.deaths || 60), PASS = 'd3-synthetic-admin', NOGC = !!+(ARG.nogc || 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const slope = ys => { const n = ys.length, mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; ys.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; }); return den ? num / den : 0; };
async function client(port, room, name, admin) {
  const ws = new WebSocket(`ws://localhost:${port}/ws?room=${room}`), c = { ws, id: 0, mks: 0, dead: false };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.t === 'hi') c.id = m.id; else if (m.t === 's') { if (m.mk && m.ms !== c.ms) { c.ms = m.ms; c.mks++; } c.dead = !!m.me; } };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o => ws.readyState === 1 && ws.send(JSON.stringify(o));
  c.pos = (x, y) => c.tx({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } });
  await sleep(150); c.tx({ t: 'join' }); await sleep(250); if (admin) { c.tx({ t: 'admin', pass: PASS }); await sleep(200); }
  return c;
}
async function inspector(port) {   // a minimal CDP client over the inspector's WebSocket
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
  const room = 'soak' + port, O = await client(port, room, 'OBS', true); O.tx({ t: 'a', c: 'god', id: O.id });
  const V = await client(port, room, 'VIC', true); V.tx({ t: 'a', c: 'god', id: V.id });
  V.pos(5000, 3504); await sleep(150); V.pos(5000, 3504); await sleep(300);
  const order = [['hound', 'A'], ['hound', 'B'], ['hound', 'D'], ['smiler', 'A'], ['smiler', 'B'], ['smiler', 'C'], ['smiler', 'D'], ['hound', 'A']], rows = [];
  for (let i = 0; i < N; i++) {
    const [k, v] = order[i % order.length], n0 = V.mks;
    V.tx({ t: 'a', c: 'preview', k, var: v });
    const t0 = Date.now(); while (Date.now() - t0 < 6000 && V.mks === n0) await sleep(50);
    await sleep(5600); V.tx({ t: 'respawn' }); await sleep(400); V.pos(5000, 3504); await sleep(150); V.pos(5000, 3504); await sleep(200);
    if (!NOGC) await I.send('HeapProfiler.collectGarbage'); const h = await I.send('Runtime.getHeapUsage');
    const rss = +execFileSync('ps', ['-o', 'rss=', '-p', String(srv.pid)]).toString().trim() / 1024;
    rows.push({ i, death: k + '-' + v, died: V.mks > n0, heapMB: +(h.usedSize / 1048576).toFixed(2), heapTotalMB: +(h.totalSize / 1048576).toFixed(2), rssMB: +rss.toFixed(1) });
    if (i % 8 === 7) console.log(JSON.stringify(rows[rows.length - 1]));
  }
  I.close(); srv.kill();
  const use = rows.slice(8), R = { tool: 'dev/stage-3d/server_soak.js', game: GAME, forcedGC: !NOGC, deaths: rows.length, died: rows.filter(r => r.died).length, rows,
    heapSlopeMBPerDeath: +slope(use.map(r => r.heapMB)).toFixed(4), rssSlopeMBPerDeath: +slope(use.map(r => r.rssMB)).toFixed(3),
    heapFirstLast: [use[0] && use[0].heapMB, use[use.length - 1] && use[use.length - 1].heapMB], rssFirstLast: [use[0] && use[0].rssMB, use[use.length - 1] && use[use.length - 1].rssMB],
    serverErrors: log.split('\n').filter(l => /Error|failed/.test(l)).slice(0, 5) };
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify({ died: R.died, heapSlopeMBPerDeath: R.heapSlopeMBPerDeath, rssSlopeMBPerDeath: R.rssSlopeMBPerDeath, heapFirstLast: R.heapFirstLast, rssFirstLast: R.rssFirstLast, serverErrors: R.serverErrors }));
  process.exit(0);
})();
