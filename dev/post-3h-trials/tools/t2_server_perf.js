#!/usr/bin/env node
/* dev/post-3h-trials/tools/t2_server_perf.js - post-3H Trial 2: what the chat costs the server (development only; evidence, not a gate).
 *
 *   node dev/post-3h-trials/tools/t2_server_perf.js --old-dir DIR --new-dir DIR --out FILE.json [--secs 30] [--rounds 2]
 *
 * Each scenario runs on its own fresh server (`node server.js PORT`, a synthetic admin passcode), the sides alternating round by round:
 *   idle0      the server alone, nobody connected
 *   play2      2 game connections in one room, in the world, sending poses as a page does (every 25 ms, a small walk), the world frozen
 *   play8      8 such connections (the room's cap)
 *   play8_say  (candidate only) play8, each player saying a line as often as its bucket allows (3 per 5 s), all within 576 px
 *   play8_lounge (candidate only) play8_say, plus 60 lounge sockets on the menu, 20 of them sending at the lounge's own cap (10 lines a
 *              second in all), the other 40 listening
 *   old/new A/A: C5d against itself (play8), for the noise floor
 * For each: the server process's CPU time (user + system, from /proc, ms per second of wall time), its resident memory at the end, and
 * one observing game client's gaps between snapshots ('s', 20 a second): p50, p95, p99, max.  Then:
 *   reconnect  (candidate only) one client opening, saying hello and closing lounge sockets as fast as the lounge lets it for 60 s: how
 *              many were refused (429), the resident memory before and after, and that the lounge holds no socket afterwards.
 * Every text is synthetic; nothing is logged.  Servers are stopped by their PIDs. */
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), http = require('http'), crypto = require('crypto');
const { spawn } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const SECS = +(ARG.secs || 30), ROUNDS = +(ARG.rounds || 2), PASS = 't2-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
function mask(str) { const b = Buffer.from(str), n = b.length, k = crypto.randomBytes(4); const h = n < 126 ? Buffer.from([0x81, 0x80 | n]) : Buffer.from([0x81, 0x80 | 126, n >> 8, n & 255]); const p = Buffer.from(b); for (let i = 0; i < n; i++) p[i] ^= k[i & 3]; return Buffer.concat([h, k, p]); }
function client(port, pth, origin) {
  return new Promise(res => {
    const s = net.connect(port, '127.0.0.1'); let buf = Buffer.alloc(0), hs = false; const c = { s, msgs: 0, snaps: [], on: null, status: 0 };
    s.on('error', () => res(c)); s.on('close', () => { if (!hs) res(c); });
    s.on('connect', () => s.write(`GET ${pth} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n${origin ? `Origin: http://127.0.0.1:${port}\r\n` : ''}\r\n`));
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      if (!hs) { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return; c.status = +buf.slice(9, 12).toString(); hs = true; buf = buf.slice(i + 4); res(c); if (c.status !== 101) { s.destroy(); return; } }
      while (buf.length >= 2) { let len = buf[1] & 127, off = 2; if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } if (buf.length < off + len) return;
        const pl = buf.slice(off, off + len); buf = buf.slice(off + len); c.msgs++;
        if (c.on || c.snaps) { let m = null; try { m = JSON.parse(pl); } catch (e) { } if (m) { if (m.t === 's' && c.snaps) c.snaps.push(performance.now()); if (c.on) c.on(m); } } }
    });
    c.send = o => { if (!s.destroyed) s.write(mask(typeof o === 'string' ? o : JSON.stringify(o))); };
  });
}
const cpu = pid => { const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' '); return (+f[11] + +f[12]) * 1000 / 100; };   // utime + stime, ms (100 Hz ticks)
const rss = pid => { const m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, 'utf8')); return m ? +m[1] : 0; };
async function serve(dir) { const port = await freePort(); const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { if (await get(port, '/index.html') === 200) return { p, port }; await sleep(100); } throw new Error('no server'); }
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(1); };

async function scenario(dir, kind) {
  const S = await serve(dir), port = S.port, room = 'perf' + crypto.randomBytes(2).toString('hex'), conns = [], timers = [];
  const players = kind === 'idle0' ? 0 : kind === 'play2' ? 2 : 8;
  try {
    for (let i = 0; i < players; i++) {
      const c = await client(port, '/ws?room=' + room); c.snaps = i === 0 ? [] : null; conns.push(c);
      c.send({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(60); c.send({ t: 'join' }); await sleep(60);
      if (i === 0) c.send({ t: 'a', c: 'freeze', on: true });
      const x0 = 3000 + (i % 4) * 90, y0 = 3000 + Math.floor(i / 4) * 90; let k = 0;
      timers.push(setInterval(() => { k++; c.send({ t: 'p', x: x0 + Math.round(20 * Math.sin(k / 20)), y: y0, vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'PERF ' + i, c: '#ffe7b2' }); }, 25));
    }
    if (kind === 'play8_say' || kind === 'play8_lounge') conns.forEach((c, i) => { let n = 0; timers.push(setInterval(() => c.send({ t: 'say', text: `synthetic-perf-${i}-${n++}` }), 1700)); });
    const lounge = [];
    if (kind === 'play8_lounge') {
      for (let i = 0; i < 60; i++) { const c = await client(port, '/social', true); c.snaps = null; if (c.status === 101) { c.send({ t: 'social_hello', nick: 'Perf ' + i }); lounge.push(c); } if (i % 25 === 24) await sleep(10500); }
      lounge.slice(0, 20).forEach((c, i) => { let n = 0; timers.push(setInterval(() => c.send({ t: 'social_send', text: `synthetic-lounge-${i}-${n++}` }), 2000)); });
      timers.push(setInterval(() => lounge.forEach(c => c.send({ t: 'social_ping' })), 25000));
    }
    await sleep(2000);
    const c0 = cpu(S.p.pid), t0 = performance.now(), from = conns[0] ? conns[0].snaps.length : 0;
    await sleep(SECS * 1000);
    const c1 = cpu(S.p.pid), t1 = performance.now(), mem = rss(S.p.pid);
    const sn = conns[0] ? conns[0].snaps.slice(from) : [], gaps = []; for (let i = 1; i < sn.length; i++) gaps.push(sn[i] - sn[i - 1]);
    const r = { kind, cpuMsPerS: +((c1 - c0) / ((t1 - t0) / 1000)).toFixed(1), rssKB: mem, snaps: sn.length, gap: { p50: pct(gaps, .5), p95: pct(gaps, .95), p99: pct(gaps, .99), max: +(Math.max(0, ...gaps)).toFixed(1) },
      lounge: lounge.length || undefined, loungeMsgsPerSocket: lounge.length ? Math.round(lounge.slice(20).reduce((a, c) => a + c.msgs, 0) / Math.max(1, lounge.length - 20)) : undefined };
    for (const t of timers) clearInterval(t); for (const c of conns.concat(lounge)) c.s.destroy();
    return r;
  } finally { for (const t of timers) clearInterval(t); try { process.kill(S.p.pid); } catch (e) { } await sleep(300); }
}
async function reconnect(dir) {
  const S = await serve(dir), port = S.port;
  try {
    await sleep(500); const m0 = rss(S.p.pid); let ok = 0, refused = 0; const t0 = Date.now();
    while (Date.now() - t0 < 60000) { const c = await client(port, '/social', true); if (c.status === 101) { ok++; c.send({ t: 'social_hello', nick: 'Again' }); await sleep(20); c.s.destroy(); } else { refused++; await sleep(50); } }
    await sleep(1500); const m1 = rss(S.p.pid);
    const probe = await client(port, '/social', true); let welcome = null; probe.on = m => { if (m.t === 'social_welcome') welcome = m; }; probe.send({ t: 'social_hello', nick: 'Probe' }); await sleep(500); probe.s.destroy();
    return { opened: ok, refused429: refused, rssKBBefore: m0, rssKBAfter: m1, onlineAfter: welcome ? welcome.online : null };
  } finally { try { process.kill(S.p.pid); } catch (e) { } }
}
(async () => {
  const OLD = path.resolve(ARG['old-dir']), NEW = path.resolve(ARG['new-dir']), R = { tool: 'dev/post-3h-trials/tools/t2_server_perf.js', secs: SECS, rounds: ROUNDS, runs: [] };
  for (let r = 0; r < ROUNDS; r++) {
    const order = r % 2 ? [['new', NEW], ['old', OLD]] : [['old', OLD], ['new', NEW]];
    for (const kind of ['idle0', 'play2', 'play8']) for (const [side, dir] of order) { const x = await scenario(dir, kind); x.side = side; x.round = r; R.runs.push(x); console.log(JSON.stringify(x)); }
    for (const kind of ['play8_say', 'play8_lounge']) { const x = await scenario(NEW, kind); x.side = 'new'; x.round = r; R.runs.push(x); console.log(JSON.stringify(x)); }
    const aa = await scenario(OLD, 'play8'); aa.side = 'old-again'; aa.round = r; R.runs.push(aa); console.log(JSON.stringify(aa));
  }
  R.reconnect = await reconnect(NEW); console.log('reconnect', JSON.stringify(R.reconnect));
  fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
})();
