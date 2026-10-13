/* Stage 3D HQ2 - what seven moving players (a full room with its observer) cost the server (development only)
 *
 *   node dev/stage-3d-hq2/srv_load.js --game DIR --layout spread|crowd [--secs 45] [--out FILE.json]
 *
 * The real server.js (synthetic admin passcode) and seven ordinary WebSocket players in one room (no test passcode: every position they
 * send goes through the server's movement checks), each sending its state 20 times a second as a browser does and taking the server's
 * corrections (`tp`) as a browser does.  A quiet admin connection (never joined) removes the monsters, turns the server's timing report
 * on and pings the server every 100 ms; with it the room holds eight connections, its cap (MAX_ROOM).
 *   spread  each player walks its own small loop (radius 20-30 px) around a point of a circle of 200 px, ~180 px from the next (nobody
 *           touches anybody: the everyday case)
 *   crowd   the seven start on a circle of 220 px and all walk to its centre, then keep trying to stand on it (the worst contact case)
 * The circle's centre is an open spot of the real level (the game's own sim.js, clearAt): every point within 260 px of it is clear by
 * 24 px, so no position any player sends is ever inside a wall.
 * Recorded over the window: the server process's CPU seconds and RSS (/proc), its 60 Hz step time (the admin timing report: mean and
 * recent worst), the admin's ping round trips (median, p95, p99: what a message waits behind the server's work), the corrections each
 * player got, and at the end the server's own positions and the smallest distance between any two players. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || path.join(__dirname, '..', '..')), PASS = 'd3-synthetic-admin', SECS = +(ARG.secs || 45), LAYOUT = ARG.layout || 'spread';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const q = (a, f) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(3); };
let CX = 0, CY = 0;
function openCentre() {                                                   // an open hall: the whole disc of 260 px clear by 24 px
  const S = require(path.join(GAME, 'sim.js'))({ seed: 7 });
  for (let y = 3400; y < 6800; y += 48) for (let x = 3000; x < 9000; x += 48) {
    let ok = true;
    for (const r of [0, 70, 140, 200, 260]) { for (let k = 0; k < 24 && ok; k++) { const a = k / 24 * Math.PI * 2; if (!S.clearAt(x + Math.cos(a) * r, y + Math.sin(a) * r, 24)) ok = false; } if (!ok) break; }
    if (ok) return [x, y];
  }
  throw new Error('no open centre');
}
(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  await sleep(1200);
  [CX, CY] = openCentre();
  const room = 'load' + PORT, out = { tool: 'dev/stage-3d-hq2/srv_load.js', game: GAME, layout: LAYOUT, secs: SECS, centre: null, server: {}, players: [] };
  const P = [];
  const conn = () => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`); ws.onopen = () => res(ws); ws.onerror = rej; });
  try {
    const adm = { ws: await conn(), pf: [], rtt: [], ad: null };
    adm.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 's') { if (m.dx && m.dx.pf) adm.pf.push(m.dx.pf); if (m.ad) adm.ad = m.ad; }
      else if (m.t === 'pong') adm.rtt.push(Date.now() - m.ts); };
    const atx = o => adm.ws.send(JSON.stringify(o));
    atx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);
    for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });
    atx({ t: 'a', c: 'debug', on: 1 });
    for (let i = 0; i < 7; i++) {
      const c = { i, ws: await conn(), id: 0, tp: 0, t: 0, x: 0, y: 0 };
      c.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'hi') c.id = m.id; else if (m.t === 'tp') { c.tp++; c.x = m.x; c.y = m.y; } };
      c.tx = o => c.ws.readyState === 1 && c.ws.send(JSON.stringify(o)); P.push(c);
    }
    await sleep(300);
    for (const c of P) {
      const a = c.i / 7 * Math.PI * 2; c.a0 = a;
      if (LAYOUT === 'crowd') { c.x = CX + Math.cos(a) * 220; c.y = CY + Math.sin(a) * 220; } else { c.x = CX + Math.cos(a) * 200 + 30; c.y = CY + Math.sin(a) * 200; }
      c.tx({ t: 'join' }); await sleep(80);
    }
    for (const c of P) atx({ t: 'a', c: 'god', id: c.id });
    for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });   // (again: the first join made a new world, with new monsters - and a spawn spot near one is refused)
    await sleep(300);
    const send = c => c.tx({ t: 'p', x: Math.round(c.x), y: Math.round(c.y), vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'L' + c.i, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 1, st: 100, ex: 0, sp: 170, ev: [] } });
    for (let k = 0; k < 4; k++) { for (const c of P) send(c); await sleep(60); }         // first positions: where each spawns (the server checks it as a spawn spot)
    const step = c => {
      c.t += .05;
      if (LAYOUT === 'crowd') { const dx = CX - c.x, dy = CY - c.y, d = Math.hypot(dx, dy); if (d > 1) { const s = Math.min(d, 170 * .05); c.x += dx / d * s; c.y += dy / d * s; } }
      else { const a = c.t * .9 + c.i; c.x = CX + Math.cos(c.a0) * 200 + Math.cos(a) * 30; c.y = CY + Math.sin(c.a0) * 200 + Math.sin(a) * 20; }
      send(c);
    };
    const tick = setInterval(() => { for (const c of P) step(c); }, 50);
    const ping = setInterval(() => atx({ t: 'ping', ts: Date.now() }), 100);
    await sleep(2500);
    adm.pf.length = 0; adm.rtt.length = 0; for (const c of P) c.tp = 0;
    const stat = () => { try { const st = fs.readFileSync(`/proc/${srv.pid}/stat`, 'utf8').split(' '); return (+st[13] + +st[14]) / 100; } catch (e) { return null; } };
    const cpu0 = stat(), t0 = Date.now();
    await sleep(SECS * 1000);
    const cpu1 = stat(), secs = (Date.now() - t0) / 1000;
    clearInterval(tick); clearInterval(ping);
    let rss = null; try { const sm = fs.readFileSync(`/proc/${srv.pid}/status`, 'utf8'); rss = +((/VmRSS:\s+(\d+)/.exec(sm) || [0, 0])[1] / 1024).toFixed(1); } catch (e) { }
    await sleep(300);
    const pl = (adm.ad && adm.ad.pl || []).filter(p => P.some(c => c.id === p.id));
    let minSep = 1e9; for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) minSep = Math.min(minSep, Math.hypot(pl[i].x - pl[j].x, pl[i].y - pl[j].y));
    out.centre = [CX, CY];
    out.server = { cpuSec: cpu1 != null && cpu0 != null ? +(cpu1 - cpu0).toFixed(2) : null, cpuPct: cpu1 != null ? +((cpu1 - cpu0) / secs * 100).toFixed(1) : null, rssMB: rss,
      stepMsMean: q(adm.pf.map(f => f.ms), .5), stepMsWorstRecent: q(adm.pf.map(f => f.mx), 1), pingMs: { n: adm.rtt.length, p50: q(adm.rtt, .5), p95: q(adm.rtt, .95), p99: q(adm.rtt, .99), max: q(adm.rtt, 1) },
      errors: log.split('\n').filter(l => /Error|failed/.test(l)).slice(0, 5) };
    out.players = P.map(c => ({ i: c.i, id: c.id, corrections: c.tp }));
    out.final = { positions: pl.map(p => [p.id, p.x, p.y, p.a]), minSeparation: pl.length > 1 ? +minSep.toFixed(1) : null };
    for (const c of P) try { c.ws.close(); } catch (e) { }
    try { adm.ws.close(); } catch (e) { }
  } finally { srv.kill(); }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ layout: LAYOUT, server: out.server, corrections: out.players.map(p => p.corrections), final: out.final.minSeparation }));
  process.exit(0);
})();
