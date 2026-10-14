/* Stage 3E-0 B++ - where the server's time goes with N moving players (development only)
 *
 *   node dev/stage-3e-0-bpp/net_profile.js --game DIR --out FILE.json [--players 7] [--secs 15] [--caps 1] [--prof DIR] [--sample FILE]
 *
 * The real server.js (synthetic admin passcode; with --prof run as node --cpu-prof, its profile written into DIR) and N ordinary players
 * over WebSockets, in the open hall proto_check.js uses: each joins (asking 'caps' with --caps 1), and walks its own circle (R 60-200 px,
 * 200 px/s), sending its pose as mp.js does (every 25 ms once answered, else every 50 ms; the full pose packet).  A quiet admin removes
 * the monsters and makes everyone immortal.  Measured over the last --secs: the server process's CPU time (/proc), the bytes and messages
 * every player received and sent (WebSocket payload, from the client side: payload bytes, not frames), and, with --prof, the profile's
 * self time per function (top 25) and the time under the tick's snapshot and pose paths.  --sample: the last 's' and 'q' player 0 got,
 * as received (for net_bench.js).  At most 7 players: the server takes 8 connections a room (MAX_ROOM), the quiet admin is one. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game), PASS = 'd3-synthetic-admin', N = +(ARG.players || 7), SECS = +(ARG.secs || 15), CAPS = ARG.caps !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const cpuOf = pid => { try { const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' '); return (+f[11] + +f[12]) / 100; } catch (e) { return null; } };
function openCentre(S) {
  for (let y = 3400; y < 6800; y += 48) for (let x = 3000; x < 9000; x += 48) {
    let ok = true;
    for (const r of [0, 70, 140, 200, 260]) { for (let k = 0; k < 24 && ok; k++) { const a = k / 24 * Math.PI * 2; if (!S.clearAt(x + Math.cos(a) * r, y + Math.sin(a) * r, 24)) ok = false; } if (!ok) break; }
    if (ok) return [x, y];
  }
  throw new Error('no open centre');
}
(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.PORT; delete env.BODY_TTL;
  const args = ARG.prof ? ['-r', path.join(__dirname, 'exit_on_signal.js'), '--cpu-prof', '--cpu-prof-dir', path.resolve(ARG.prof), 'server.js', String(PORT)] : ['server.js', String(PORT)];
  const srv = spawn('node', args, { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const S = require(path.join(GAME, 'sim.js'))({ seed: 7 }), [CX, CY] = openCentre(S), room = 'prof' + PORT;
  const conn = () => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`); ws.onopen = () => res(ws); ws.onerror = rej; });
  const adm = await conn(); adm.onmessage = () => { }; const atx = o => adm.send(JSON.stringify(o)); atx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(250);
  const P = [];
  for (let i = 0; i < N; i++) {
    const ws = await conn(), c = { ws, id: 0, fast: false, n: {}, inB: 0, inM: 0, outB: 0, outM: 0, R: 60 + (i * 140 / Math.max(1, N - 1)), ph: i * 1.7, dir: i % 2 ? 1 : -1, on: false };
    ws.onmessage = ev => { const s = typeof ev.data === 'string' ? ev.data : ''; if (c.on) { c.inB += Buffer.byteLength(s); c.inM++; } let m; try { m = JSON.parse(s); } catch (e) { return; } if (c.on && (m.t === 's' || m.t === 'q')) c['last_' + m.t] = s; c.n[m.t] = (c.n[m.t] || 0) + (c.on ? 1 : 0); if (m.t === 'hi') c.id = m.id; if (m.t === 'caps' && m.fp === 1) c.fast = true; };
    c.tx = o => { const s = JSON.stringify(o); if (c.on) { c.outB += Buffer.byteLength(s); c.outM++; } ws.send(s); };
    if (CAPS) c.tx({ t: 'caps', fp: 1 });
    c.tx({ t: 'join' }); P.push(c); await sleep(30);
  }
  for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });
  await sleep(200); for (const c of P) atx({ t: 'a', c: 'god', id: c.id });
  let stop = false; const t0 = Date.now();
  for (const c of P) (async () => {
    let last = 0;
    while (!stop) {
      const now = Date.now(), t = (now - t0) / 1000, a = c.ph + c.dir * 200 / c.R * t;
      if (now - last > (c.fast ? 25 : 50)) { last = now;
        c.tx({ t: 'p', x: Math.round(CX + c.R * Math.cos(a)), y: Math.round(CY + c.R * Math.sin(a)), vx: Math.round(-200 * Math.sin(a) * c.dir), vy: Math.round(200 * Math.cos(a) * c.dir), a: +(a + c.dir * Math.PI / 2).toFixed(3), r: 0, l: 1, k: 'flashlight', n: 'Load' + c.id, c: '#ffe7b2', f: -1, lk: 'none|plain|#e6bb76|#ffcc77|none', lp: '', mv: [1, 200, 100, 0] }); }
      await sleep(1000 / 60);
    }
  })();
  await sleep(2500);                                                                // (settled: everyone walking)
  for (const c of P) c.on = true; const c0 = cpuOf(srv.pid), w0 = Date.now();
  await sleep(SECS * 1000);
  const c1 = cpuOf(srv.pid), w1 = Date.now(); for (const c of P) c.on = false; stop = true;
  const el = (w1 - w0) / 1000, per = k => +(P.reduce((s, c) => s + c[k], 0) / P.length / el).toFixed(1);
  const R = { tool: 'dev/stage-3e-0-bpp/net_profile.js', game: GAME, players: N, caps: CAPS, fastAnswered: P.filter(c => c.fast).length, secs: +el.toFixed(2),
    serverCpuPct: c0 != null && c1 != null ? +((c1 - c0) / el * 100).toFixed(2) : null, perPlayer: { inBytesPerSec: per('inB'), inMsgsPerSec: per('inM'), outBytesPerSec: per('outB'), outMsgsPerSec: per('outM') },
    msgTypesPerSecOfPlayer0: Object.fromEntries(Object.entries(P[0].n).map(([k, v]) => [k, +(v / el).toFixed(1)])) };
  for (const c of P) try { c.ws.close(); } catch (e) { } try { adm.close(); } catch (e) { }
  await sleep(200); srv.kill('SIGTERM'); await new Promise(r => srv.on('exit', r));
  R.serverErrors = log.split('\n').filter(l => /Error|TypeError|failed/.test(l)).slice(0, 5);
  if (ARG.prof) {
    const f = fs.readdirSync(ARG.prof).filter(n => n.endsWith('.cpuprofile')).map(n => path.join(ARG.prof, n)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    if (f) {
      const pr = JSON.parse(fs.readFileSync(f, 'utf8')), byId = new Map(pr.nodes.map(n => [n.id, n])), self = new Map(), dt = pr.timeDeltas, smp = pr.samples;
      const tick = new Map(); for (let i = 0; i < smp.length; i++) tick.set(smp[i], (tick.get(smp[i]) || 0) + (dt[i] || 0));
      const parent = new Map(); for (const n of pr.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
      const key = n => `${n.callFrame.functionName || '(anon)'} ${path.basename(n.callFrame.url || '')}:${n.callFrame.lineNumber + 1}`;
      let total = 0, under = { poseSend: 0, snapshotSend: 0, send: 0, stringify: 0, mvCheck: 0, simStep: 0, reader: 0 };
      for (const [id, us] of tick) {
        const n = byId.get(id); total += us; const k = key(n); self.set(k, (self.get(k) || 0) + us);
        const seen = new Set(); let x = id;
        while (x != null) { const m = byId.get(x), fn = m.callFrame.functionName, u = path.basename(m.callFrame.url || '');
          if (fn === 'poseSend' && u === 'server.js') seen.add('poseSend'); if (fn === 'send' && u === 'server.js') seen.add('send'); if (fn === 'stringify') seen.add('stringify');
          if (fn === 'mvCheck') seen.add('mvCheck'); if (fn === 'step' && u === 'sim.js') seen.add('simStep'); if (/reader|onData|ondata/i.test(fn) && u === 'ws.js') seen.add('reader');
          x = parent.get(x); }
        for (const s of seen) under[s] += us;
      }
      const idle = [...self.entries()].filter(([k]) => /^\(idle\)|^\(program\)|^\(garbage collector\)/.test(k)).reduce((s, [, v]) => s + v, 0);
      R.profile = { file: path.basename(f), sampledMs: +(total / 1000).toFixed(1), idleProgramGcMs: +(idle / 1000).toFixed(1),
        underMs: Object.fromEntries(Object.entries(under).map(([k, v]) => [k, +(v / 1000).toFixed(1)])),
        topSelf: [...self.entries()].filter(([k]) => !/^\(idle\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +(v / 1000).toFixed(1)]) };
    }
  }
  if (ARG.sample) fs.writeFileSync(ARG.sample, JSON.stringify({ s: P[0].last_s || null, q: P[0].last_q || null }) + '\n');
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R));
  process.exit(0);
})();
