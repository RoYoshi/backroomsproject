/* Stage 3D HQ1 - eight players' network traffic through deaths, against the D7 parent (development only)
 *
 *   node dev/stage-3d-hq1/traffic8.js --game DIR [--out FILE.json] [--secs 60] [--baseline 1]      (--baseline: a tree without the light profile)
 *
 * The real server.js (synthetic admin passcode), eight WebSocket clients in one room, each moving along its own little loop and sending
 * its state 20 times a second as a browser does, lights on (two with lanterns, one with a headlamp, one with a camcorder, one with its
 * light off), all in god mode.  The monsters are removed; every 8 s one of them dies through the admin death preview (Hound A, B, D and
 * Smiler A, B, C in turn; it works through god mode), so six deaths, six corpses.  Recorded per client: every message the server sends, by type, with its bytes; the server's own
 * tick time (its admin timing) and the process's CPU time and memory.  Checks:
 *   T1 every client gets every death exactly once (one replay each, the victim none), and every corpse; the deaths with a lit light carry
 *      the same light profile to everybody, the others none
 *   T2 no server errors; nobody dropped
 * Reported (for the A/B against D7, run the same tool with --game on the parent): bytes per second per client by message type, the
 * snapshot's mean size, death-message sizes, the server's tick time and CPU. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || path.join(__dirname, '..', '..')), PASS = 'd3-synthetic-admin', SECS = +(ARG.secs || 60);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const KINDS = ['flashlight', 'lantern', 'flashlight', 'headlamp', 'lantern', 'camcorder', 'flashlight', 'flashlight'];
const LIGHT = [1, 1, 1, 1, 1, 1, 0, 1];
(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  await sleep(1200);
  const room = 't8' + PORT, C = [], out = { tool: 'dev/stage-3d-hq1/traffic8.js', game: GAME, secs: SECS, clients: [], deaths: [], server: {} };
  try {
    for (let i = 0; i < 8; i++) {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`), c = { i, ws, id: 0, kind: KINDS[i], l: LIGHT[i], bytes: {}, count: {}, fx: [], bodies: null, sMean: 0, sN: 0, dropped: false, t: 0 };
      ws.onmessage = ev => { const n = Buffer.byteLength(ev.data); let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        c.bytes[m.t] = (c.bytes[m.t] || 0) + n; c.count[m.t] = (c.count[m.t] || 0) + 1;
        if (m.t === 'hi') c.id = m.id; else if (m.t === 's') { c.sN++; c.sMean += (n - c.sMean) / c.sN; if (m.dx && m.dx.pf) c.pf = m.dx.pf; }
        else if (m.t === 'fx' && m.k === 'death') c.fx.push({ id: m.id, de: m.de, lf: m.lf || null, bytes: n }); else if (m.t === 'bodies') c.bodies = m.b; else if (m.t === 'ares') c.ares = m.msg; };
      ws.onclose = () => { c.dropped = true; };
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      c.tx = o => ws.readyState === 1 && ws.send(JSON.stringify(o)); C.push(c);
    }
    const x0 = 4250, y0 = 3504;
    for (const c of C) { c.tx({ t: 'join' }); }
    await sleep(400);
    const A = C[0]; A.tx({ t: 'admin', pass: PASS }); C[1].tx({ t: 'admin', pass: PASS }); await sleep(300);
    const clear = () => { A.tx({ t: 'a', c: 'hounds', mode: 'remove', n: 10 }); A.tx({ t: 'a', c: 'smilers', mode: 'remove', n: 10 }); }; clear();
    for (const c of C) A.tx({ t: 'a', c: 'god', id: c.id });                 // nobody is killed by a real monster: the admin preview works through god mode
    A.tx({ t: 'a', c: 'debug', on: 1 });
    const pos = c => { c.t += .05; const a = c.t * .9 + c.i, x = x0 + c.i * 150 + Math.cos(a) * 30, y = y0 + Math.sin(a) * 20;
      c.tx({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: +(a % 6.28).toFixed(2), r: 0, l: c.l, k: c.kind, n: 'P' + c.i, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } }); };
    const tick = setInterval(() => { for (const c of C) if (!c.dead) pos(c); }, 50);
    await sleep(2000);
    for (const c of C) for (const k of Object.keys(c.bytes)) { c.bytes[k] = 0; c.count[k] = 0; }
    const cpu0 = process.cpuUsage(), t0 = Date.now(), plan = [['hound', 'A'], ['hound', 'B'], ['hound', 'D'], ['smiler', 'A'], ['smiler', 'B'], ['smiler', 'C']];   // (Hound C needs a wall behind the victim: not in this open hall)
    for (let d = 0; d < plan.length && (Date.now() - t0) / 1000 < SECS - 8; d++) {
      const v = C[2 + d];                                                   // players 2-7 die in turn (lantern, headlamp, lantern, camcorder, off, flashlight)
      clear();
      v.tx({ t: 'admin', pass: PASS }); await sleep(200);
      v.tx({ t: 'a', c: 'preview', k: plan[d][0], var: plan[d][1] }); out.deaths.push({ victim: v.i, id: v.id, kind: v.kind, light: !!v.l, what: plan[d].join(' '), at: (Date.now() - t0) / 1000 });
      await sleep(1500); out.deaths[out.deaths.length - 1].answer = v.ares || null; await sleep(6500);
    }
    while ((Date.now() - t0) / 1000 < SECS) await sleep(200);
    clearInterval(tick);
    const secs = (Date.now() - t0) / 1000;
    out.server.pf = A.pf || null; out.server.clientCpuMs = Math.round((process.cpuUsage(cpu0).user + process.cpuUsage(cpu0).system) / 1000);
    try { const st = fs.readFileSync(`/proc/${srv.pid}/stat`, 'utf8').split(' '); out.server.cpuSec = (+st[13] + +st[14]) / 100; const sm = fs.readFileSync(`/proc/${srv.pid}/status`, 'utf8'); out.server.rssMB = +((/VmRSS:\s+(\d+)/.exec(sm) || [0, 0])[1] / 1024).toFixed(1); } catch (e) { }
    for (const c of C) out.clients.push({ i: c.i, kind: c.kind, light: c.l, bytesPerSec: Object.fromEntries(Object.entries(c.bytes).map(([k, v]) => [k, Math.round(v / secs)])), count: c.count, snapshotMeanBytes: Math.round(c.sMean), fx: c.fx, corpses: (c.bodies || []).map(b => ({ k: b.k, de: b.de, lf: b.lf || null, lo: b.lo })), dropped: c.dropped });
    // T1
    const bad = [];
    for (const d of out.deaths) {
      for (const c of out.clients) {
        const got = c.fx.filter(f => f.id === d.id);
        if (c.i === d.victim ? got.length !== 0 : got.length !== 1) bad.push(['replays', d.what, c.i, got.length]);
        const b = c.corpses.find(b => b.k === d.id); if (!b) bad.push(['corpse', d.what, c.i]);
        const wantLf = d.light && d.kind !== 'camcorder';
        if (ARG.baseline) continue;                                           // (the D7 parent has no light profile: only the deliveries are checked)
        if (b && !!b.lf !== wantLf) bad.push(['corpse lf', d.what, c.i, b.lf]); if (got[0] && !!got[0].lf !== wantLf) bad.push(['replay lf', d.what, c.i]);
      }
      const lfs = new Set(out.clients.map(c => JSON.stringify((c.corpses.find(b => b.k === d.id) || {}).lf || null))); if (lfs.size !== 1) bad.push(['same lf', d.what, [...lfs]]);
    }
    out.T1 = { ok: !bad.length && out.deaths.length === 6, bad: bad.slice(0, 12) };
    const errs = log.split('\n').filter(l => /Error|failed/.test(l));
    out.T2 = { ok: !errs.length && out.clients.every(c => !c.dropped), errors: errs.slice(0, 5) };
    const per = out.clients.map(c => Object.values(c.bytesPerSec).reduce((a, b) => a + b, 0));
    out.summary = { deaths: out.deaths.length, bytesPerSecPerClient: { min: Math.min(...per), max: Math.max(...per), mean: Math.round(per.reduce((a, b) => a + b, 0) / per.length) },
      snapshotMeanBytes: Math.round(out.clients.reduce((a, c) => a + c.snapshotMeanBytes, 0) / 8), fxBytes: [...new Set(out.clients.flatMap(c => c.fx.map(f => f.bytes)))].sort((a, b) => a - b),
      serverTickMs: out.server.pf ? out.server.pf.ms : null, serverTickMaxMs: out.server.pf ? out.server.pf.mx : null, serverCpuSec: out.server.cpuSec, serverRssMB: out.server.rssMB };
    for (const c of C) try { c.ws.close(); } catch (e) { }
  } finally { srv.kill(); }
  out.ok = out.T1 && out.T1.ok && out.T2 && out.T2.ok;
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ T1: out.T1, T2: out.T2, summary: out.summary }, null, 1)); console.log(out.ok ? 'TRAFFIC8 OK' : 'TRAFFIC8 NOT OK'); process.exit(out.ok ? 0 : 1);
})();
