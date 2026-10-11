/* Stage 3H0 - performance A/B of two checkouts on the same machine, interleaved (development only).
 *
 *   node dev/stage-3h0/golden/perf_h0.js --a DIR --b DIR [--rounds 3] [--out FILE.json] [--only server|client]
 *
 * SERVER: `node server.js PORT` from each checkout, driven by Node's built-in WebSocket clients that join and walk small circles near the
 *   spawn point at 20 packets a second (moves the server accepts):
 *     play8    8 players in one room, 20 s measured after 4 s of warm-up;
 *     debug4   4 players + 1 admin with AI debug on (the heaviest snapshot path), 15 s.
 *   Measured: the server process's CPU time per wall second (/proc), the bytes and number of snapshots each client received per second.
 * CLIENT: the real game in Chromium (software rendering), the QA2 boot gate passed with a key: the time mp.js's per-frame hook window.__mp
 *   takes per call and its WebSocket message handler per message, read by a wrapper installed before mp.js (it changes nothing in mp.js):
 *     menu  5 s in the menu;  run  6 s in Level 0, standing.
 * Rounds alternate A, B, A, B ... so drift hits both.  The rule (3H0_H0_1_BASELINE.md) was calibrated at H0-1, before any extraction,
 * by running the parent against itself: with identical code the server's CPU per second differed by up to 10 % between the two sides, the
 * snapshot bytes by up to 10 % (they follow the AI's state, which real timing changes), and the client's per-call means (15-25 frames a
 * phase under software rendering) by up to 40 %.  So on this real stack:
 *   server CPU: tolerance = max(A's own spread, 15 % of A's median); B passes when its median is at most A's median + tolerance;
 *   bytes and the client timings: reported, not gated (exact bytes are proven by the deterministic traces; the precise CPU / time gate is
 *   perf_det.js, on identical deterministic workloads). */
'use strict';
const fs = require('fs'), path = require('path');
const { spawn, execSync } = require('child_process');
const ARG = { rounds: '3' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const PASS = 'h0-synthetic-admin', TICKS = 100;   // clock ticks per second for /proc/PID/stat
function cpuMs(pid) { const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'), r = f.slice(f.lastIndexOf(')') + 2).split(' '); return (+r[11] + +r[12]) * 1000 / TICKS; }
function serve(dir, port) {
  try { execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  return spawn('node', ['server.js', String(port)], { cwd: dir, stdio: 'ignore', env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }) });
}
async function up(port) { for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.status === 200) return; } catch (e) { } await sleep(100); } throw new Error('server did not start'); }
async function serverRun(dir, port, cfg) {
  const srv = serve(dir, port); await up(port);
  const clients = [];
  for (let i = 0; i < cfg.players + (cfg.admin ? 1 : 0); i++) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=perf`); const c = { ws, bytes: 0, snaps: 0, i, admin: cfg.admin && i === cfg.players };
    ws.onmessage = e => { c.bytes += e.data.length; if (e.data.startsWith('{"t":"s"')) c.snaps++; };
    await new Promise(r => ws.onopen = r); clients.push(c);
  }
  for (const c of clients) { if (c.admin) { c.ws.send(JSON.stringify({ t: 'admin', pass: PASS })); c.ws.send(JSON.stringify({ t: 'a', c: 'debug', on: 1 })); } else c.ws.send(JSON.stringify({ t: 'join' })); }
  await sleep(300);
  let k = 0; const cx = 960, cy = 3264;
  const timer = setInterval(() => { k++; for (const c of clients) { if (c.admin) continue; const a = k * .05 + c.i, r = 18 + c.i * 3; c.ws.send(JSON.stringify({ t: 'p', x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r), vx: 0, vy: 0, a: +a.toFixed(2), r: 0, l: 1, ir: 0, k: 'flashlight', lp: '', n: 'P' + c.i, c: '#ffe7b2', f: -1, lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 1, sp: 60, st: 100, ex: 0 } })); } }, 50);
  await sleep(cfg.warm);
  for (const c of clients) { c.bytes = 0; c.snaps = 0; }
  const c0 = cpuMs(srv.pid), t0 = Date.now();
  await sleep(cfg.secs * 1000);
  const c1 = cpuMs(srv.pid), t1 = Date.now();
  clearInterval(timer); for (const c of clients) try { c.ws.close(); } catch (e) { }
  srv.kill('SIGTERM'); await sleep(300);
  const wall = (t1 - t0) / 1000, pl = clients.filter(c => !c.admin);
  return { cpuMsPerSec: +((c1 - c0) / wall).toFixed(2), bytesPerClientSec: Math.round(pl.reduce((a, c) => a + c.bytes, 0) / pl.length / wall), snapsPerClientSec: +(pl.reduce((a, c) => a + c.snaps, 0) / pl.length / wall).toFixed(2),
    adminBytesPerSec: cfg.admin ? Math.round(clients[clients.length - 1].bytes / wall) : null };
}
const WRAP = `(() => { let real = null, wrapped = null; const T = window.__h0perf = { mp: [], msg: [] };
  Object.defineProperty(window, '__mp', { configurable: true, set(f) { real = f; wrapped = f && (o => { const t = performance.now(); try { return real(o); } finally { T.mp.push(performance.now() - t); } }); }, get() { return wrapped; } });
  const d = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
  Object.defineProperty(WebSocket.prototype, 'onmessage', { configurable: true, get() { return d.get.call(this); }, set(fn) { d.set.call(this, fn && (e => { const t = performance.now(); try { return fn.call(this, e); } finally { T.msg.push(performance.now() - t); } })); } });
})();`;
async function clientRun(dir, port) {
  const Q = require('../../stage-3c-qa2/qa2_lib.js');
  const srv = serve(dir, port); await up(port);
  const b = await Q.browser(); const s = await Q.page(b, port, { viewport: { width: 1280, height: 720 }, init: WRAP });
  const grab = async secs => { await s.P.evaluate(() => { window.__h0perf.mp.length = 0; window.__h0perf.msg.length = 0; }); await sleep(secs * 1000); return s.P.evaluate(() => ({ mp: window.__h0perf.mp.slice(), msg: window.__h0perf.msg.slice() })); };
  const stat = a => { const s2 = a.slice().sort((x, y) => x - y); return { n: a.length, mean: a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(4) : null, p95: a.length ? +s2[Math.floor(a.length * .95)].toFixed(4) : null }; };
  await sleep(1500); const menu = await grab(5);
  await Q.start(s.P, 'PERF'); await sleep(2000); const run = await grab(6);
  await b.close(); srv.kill('SIGTERM'); await sleep(300);
  return { menu: { mp: stat(menu.mp), msg: stat(menu.msg) }, run: { mp: stat(run.mp), msg: stat(run.msg) } };
}
function rule(a, b, kind) {
  const am = med(a), bm = med(b), spread = Math.max(...a) - Math.min(...a);
  const gated = kind === 'server', tol = gated ? Math.max(spread, Math.abs(am) * .15) : null;
  const ok = gated ? bm <= am + tol : true;
  return { a: a, b: b, aMedian: +am.toFixed(4), bMedian: +bm.toFixed(4), tolerance: tol === null ? 'reported only' : +tol.toFixed(4), changePct: +(((bm - am) / am) * 100).toFixed(2), gated, ok };
}
(async () => {
  const A = path.resolve(ARG.a), B = path.resolve(ARG.b), R = +ARG.rounds;
  const res = { tool: 'dev/stage-3h0/golden/perf_h0.js', a: A, b: B, rounds: R, node: process.version, cpus: require('os').cpus().length, startedAt: new Date().toISOString(), server: {}, client: {} };
  const CFG = { play8: { players: 8, admin: false, warm: 4000, secs: 20 }, debug4: { players: 4, admin: true, warm: 4000, secs: 15 } };
  if (ARG.only !== 'client') for (const [name, cfg] of Object.entries(CFG)) {
    const ra = [], rb = [];
    for (let r = 0; r < R; r++) { ra.push(await serverRun(A, 8711, cfg)); rb.push(await serverRun(B, 8712, cfg)); console.log(`server ${name} round ${r + 1}: A ${JSON.stringify(ra[r])} B ${JSON.stringify(rb[r])}`); }
    res.server[name] = { rounds: { a: ra, b: rb }, cpuMsPerSec: rule(ra.map(x => x.cpuMsPerSec), rb.map(x => x.cpuMsPerSec), 'server'), bytesPerClientSec: rule(ra.map(x => x.bytesPerClientSec), rb.map(x => x.bytesPerClientSec), 'bytes'),
      snapsPerClientSec: { a: ra.map(x => x.snapsPerClientSec), b: rb.map(x => x.snapsPerClientSec) } };
  }
  if (ARG.only !== 'server') {
    const ra = [], rb = [];
    for (let r = 0; r < R; r++) { ra.push(await clientRun(A, 8713)); rb.push(await clientRun(B, 8714)); console.log(`client round ${r + 1}: A ${JSON.stringify(ra[r])}\n                B ${JSON.stringify(rb[r])}`); }
    for (const st of ['menu', 'run']) for (const m of ['mp', 'msg']) res.client[st + '.' + m + 'MeanMs'] = rule(ra.map(x => x[st][m].mean), rb.map(x => x[st][m].mean), 'client');
    res.client.rounds = { a: ra, b: rb };
  }
  const all = [...Object.values(res.server).flatMap(s => [s.cpuMsPerSec, s.bytesPerClientSec]), ...Object.entries(res.client).filter(([k]) => k !== 'rounds').map(([, v]) => v)];
  res.ok = all.every(x => x.ok); res.finishedAt = new Date().toISOString();
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
  for (const [n, s] of Object.entries(res.server)) console.log(`server ${n}: cpu ms/s A ${s.cpuMsPerSec.aMedian} B ${s.cpuMsPerSec.bMedian} (${s.cpuMsPerSec.changePct} %, tol ${s.cpuMsPerSec.tolerance}) ${s.cpuMsPerSec.ok ? 'ok' : 'OVER'}; bytes/client/s A ${s.bytesPerClientSec.aMedian} B ${s.bytesPerClientSec.bMedian} ${s.bytesPerClientSec.ok ? 'ok' : 'DIFF'}`);
  for (const [k, v] of Object.entries(res.client)) if (k !== 'rounds') console.log(`client ${k}: A ${v.aMedian} B ${v.bMedian} (${v.changePct} %, tol ${v.tolerance}) ${v.ok ? 'ok' : 'OVER'}`);
  console.log(res.ok ? 'performance: within the predeclared tolerance' : 'performance: OUTSIDE the predeclared tolerance');
  process.exitCode = res.ok ? 0 : 1;
})().catch(e => { console.error('ERROR', e && e.stack || e); process.exitCode = 2; });
