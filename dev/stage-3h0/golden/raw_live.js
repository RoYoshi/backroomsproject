/* Stage 3H0 - the real server over real TCP: the accepted parent's server.js against the working tree's, on the same files (development only).
 *
 *   node dev/stage-3h0/golden/raw_live.js [--old-ref edd2af9] [--aa] [--out FILE.json]
 *
 * Each side is started as `node server.js PORT` (synthetic admin passcode) and spoken to with raw sockets, the same requests in the same order:
 *   - start-up: the console line (the port number is replaced by PORT);
 *   - HTTP: every request below, with and without gzip, raw bytes in, raw bytes out.  The whole response must be byte-identical except the
 *     value of the Date header;
 *   - WebSocket: the 101 response; the first frame ('hi'); a ping (whole, and one byte per TCP write) and its pong; JSON ping / pong;
 *     ignored input (bad JSON, a 1,400-byte text frame, a binary frame); the close frame; a 64-bit length; refused upgrades (wrong path,
 *     no key, the 9th player of a room).  The periodic snapshots carry a randomly seeded world, so their content is not compared:
 *     only which message types arrived.
 * The old side runs the parent's server.js text from a scratch folder that links every other file of the working tree, so only the server
 * code differs.  --aa runs the parent's text on both sides (shows the comparison is stable).  Processes are stopped by their own PID. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net'), crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const ARG = { 'old-ref': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'aa') ARG.aa = true; else ARG[k] = process.argv[++i]; }
const REPO = path.resolve(__dirname, '..', '..', '..');
const PASS = 'h0-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

/* a folder that is the working tree, except that server.js is the parent's text and the extracted server/ folder is absent */
function oldTree() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'h0raw-'));
  for (const n of fs.readdirSync(REPO)) if (!['server.js', 'server', '.git', 'node_modules'].includes(n)) fs.symlinkSync(path.join(REPO, n), path.join(d, n));
  fs.writeFileSync(path.join(d, 'server.js'), execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':server.js']));
  return d;
}
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start(dir) {
  const port = await freePort();
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env });
  p.out = ''; p.stdout.on('data', d => { p.out += d; }); p.stderr.on('data', d => { p.out += 'ERR ' + d; });
  for (let i = 0; i < 200 && !/\n/.test(p.out); i++) await sleep(25);
  p.port = port; return p;
}
const stop = p => new Promise(r => { if (p.exitCode !== null) return r(); p.once('exit', () => r()); process.kill(p.pid, 'SIGTERM'); });

/* one raw exchange: write the given chunks (with a pause between them), collect everything until the server closes or the time is up */
function exchange(port, chunks, { gap = 0, wait = 4000 } = {}) {
  return new Promise(resolve => {
    const s = net.connect(port, '127.0.0.1'), got = []; let done = false, ev = [];
    const fin = why => { if (done) return; done = true; ev.push(why); s.destroy(); resolve({ bytes: Buffer.concat(got), ev }); };
    s.on('data', d => got.push(d)); s.on('end', () => ev.push('end')); s.on('close', () => fin('close')); s.on('error', e => ev.push('error ' + e.code));
    s.on('connect', async () => { for (const c of chunks) { s.write(c); if (gap) await sleep(gap); } });
    setTimeout(() => fin('timeout'), wait);
  });
}
/* the Date header is the only part of a response that may differ: every one in the stream is replaced (a connection can carry two responses) */
const DATE = /\r\nDate: [A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT\r\n/g;
const normHttp = b => { const t = b.toString('latin1').replace(DATE, '\r\nDate: <date>\r\n'), i = t.indexOf('\r\n\r\n'); return { head: i < 0 ? t : t.slice(0, i), body: Buffer.from(i < 0 ? '' : t.slice(i + 4), 'latin1'), dates: (b.toString('latin1').match(DATE) || []).length }; };

/* ---------- HTTP ---------- */
const PATHS = ['/', '/index.html', '/index.html?x=1', '/?room=abc', '/mp.js', '/server.js', '/sim.js', '/ai.js', '/death_srv.js', '/package.json',
  '/assets/net-wire.js', '/assets/net-interp.js', '/assets/index-DKbV5Nv9.js', '/assets/ui.css', '/assets/manifest.webmanifest', '/assets/carpet.png',
  '/assets/MAIN_MENU_LOGO_USER_SUPPLIED.png', '/assets/MainTheme_MenuIntro.wav', '/assets/', '/assets', '/camera_policy.js', '/timing_policy.js',
  '/server', '/server/', '/server/ws.js', '/server/static.js', '/server/fields.js', '/dev/stage-3h0/README.md', '/dev/tests/live.js', '/.git/config',
  '/%', '/%00', '/a%00b', '/..%2fserver.js', '/%2e%2e/server.js', '/assets/../server.js', '/assets/..%2f..%2fserver.js', '//server.js', '/assets//net-wire.js',
  '/sounds', '/sounds/', '/sounds/sting.mp3', '/sounds/sting%20copy.mp3', '/sounds/none.mp3', '/sounds/README.txt', '/sounds/../server.js', '/sounds/..%2fserver.js',
  '/favicon.ico', '/ws', '/nope'];
function httpCases() {
  const L = [];
  for (const p of PATHS) for (const gz of [false, true]) L.push({ name: `GET ${p}${gz ? ' gzip' : ''}`, raw: `GET ${p} HTTP/1.1\r\nHost: h0.test\r\n${gz ? 'Accept-Encoding: gzip, deflate\r\n' : ''}Connection: close\r\n\r\n` });
  L.push({ name: 'GET /index.html gzip (again, from the cache)', raw: 'GET /index.html HTTP/1.1\r\nHost: h0.test\r\nAccept-Encoding: gzip\r\nConnection: close\r\n\r\n' });
  L.push({ name: 'GET /index.html gzip;q=0 (the rule is a word match)', raw: 'GET /index.html HTTP/1.1\r\nHost: h0.test\r\nAccept-Encoding: gzip;q=0\r\nConnection: close\r\n\r\n' });
  L.push({ name: 'GET /index.html Accept-Encoding: xgzip', raw: 'GET /index.html HTTP/1.1\r\nHost: h0.test\r\nAccept-Encoding: xgzip\r\nConnection: close\r\n\r\n' });
  L.push({ name: 'HEAD /index.html', raw: 'HEAD /index.html HTTP/1.1\r\nHost: h0.test\r\nConnection: close\r\n\r\n' });
  L.push({ name: 'POST /index.html', raw: 'POST /index.html HTTP/1.1\r\nHost: h0.test\r\nContent-Length: 2\r\nConnection: close\r\n\r\nhi' });
  L.push({ name: 'GET with an absolute URL', raw: 'GET http://h0.test/mp.js HTTP/1.1\r\nHost: h0.test\r\nConnection: close\r\n\r\n' });
  L.push({ name: 'two requests on one connection', raw: 'GET /mp.js HTTP/1.1\r\nHost: h0.test\r\n\r\nGET /nope HTTP/1.1\r\nHost: h0.test\r\nConnection: close\r\n\r\n' });
  L.push({ name: 'malformed request line', raw: 'GARBAGE\r\n\r\n' });
  return L;
}

/* ---------- WebSocket ---------- */
const KEY = 'dGhlIHNhbXBsZSBub25jZQ==';
const up = (pathq, key = KEY) => `GET ${pathq} HTTP/1.1\r\nHost: h0.test\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\n${key ? 'Sec-WebSocket-Key: ' + key + '\r\n' : ''}\r\n`;
function cframe(payload, { op = 1, len64 = false } = {}) {
  const p = Buffer.isBuffer(payload) ? payload : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const n = p.length, h = [0x80 | op], k = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
  if (len64) h.push(0x80 | 127, 0, 0, 0, 0, 0, 0, (n >> 8) & 255, n & 255); else if (n < 126) h.push(0x80 | n); else h.push(0x80 | 126, n >> 8, n & 255);
  const body = Buffer.from(p); for (let i = 0; i < n; i++) body[i] ^= k[i & 3];
  return Buffer.concat([Buffer.from(h), k, body]);
}
/* split what the server sent after the 101 into frames (server frames are never masked) */
function frames(b) {
  const out = []; let i = 0;
  while (i + 2 <= b.length) { let len = b[i + 1] & 127, off = 2; if (len === 126) { if (i + 4 > b.length) break; len = b.readUInt16BE(i + 2); off = 4; } if (i + off + len > b.length) break; out.push({ b0: b[i], pl: b.slice(i + off, i + off + len) }); i += off + len; }
  return { list: out, rest: b.length - i };
}
/* a connection that stays open: the 101 response, then frames as they come */
function session(port, pathq) {
  return new Promise(resolve => {
    const s = net.connect(port, '127.0.0.1'); let buf = Buffer.alloc(0), head = null; const ev = [];
    s.on('data', d => { buf = Buffer.concat([buf, d]); if (head === null) { const i = buf.indexOf('\r\n\r\n'); if (i >= 0) { head = buf.slice(0, i + 4).toString('latin1'); buf = buf.slice(i + 4); } } });
    s.on('end', () => ev.push('end')); s.on('close', () => ev.push('close')); s.on('error', e => ev.push('error ' + e.code));
    const api = { s, ev, get head() { return head; },
      take() { const f = frames(buf); buf = buf.slice(buf.length - f.rest); return f.list; },
      async until(pred, ms = 8000) { for (let t = 0; t < ms; t += 20) { if (pred()) return true; await sleep(20); } return false; },
      ready() { return api.until(() => head !== null && frames(buf).list.length > 0 || ev.includes('close')); } };
    s.on('connect', () => { s.write(up(pathq)); resolve(api); });
  });
}
const PERIODIC = new Set(['s', 'bodies']);                 // their content carries the randomly seeded world: only their type is compared
const describe = fl => fl.map(f => { const op = f.b0 & 15; if (op !== 1) return { b0: f.b0, len: f.pl.length, hex: f.pl.toString('hex') }; let m = null; try { m = JSON.parse(f.pl.toString('utf8')); } catch (e) { return { b0: f.b0, bad: f.pl.toString('hex').slice(0, 80) }; } return PERIODIC.has(m && m.t) ? { b0: f.b0, t: m.t } : { b0: f.b0, t: m && m.t, msg: f.pl.toString('utf8') }; });
async function wsCases(port) {
  const R = {};
  /* 1. one player through every kind of input.  A step sends its bytes, waits until the replies it expects have come (at most 4 s), then
   *    300 ms more for anything unexpected.  Snapshot types are pooled over the whole connection. */
  { const c = await session(port, '/ws?room=h0raw1'); await c.ready(); const pool = new Set();
    const first = describe(c.take()); first.filter(x => PERIODIC.has(x.t)).forEach(x => pool.add(x.t));
    R.handshake101 = c.head; R.firstFrame = first.length ? first[0].msg || null : null;
    const step = async (name, chunks, expect, { gap = 0, closes = false } = {}) => {
      const got = [];
      for (const ch of chunks) { c.s.write(ch); if (gap) await sleep(gap); }
      const pull = () => { for (const x of describe(c.take())) { if (PERIODIC.has(x.t)) pool.add(x.t); else got.push(x); } };
      await c.until(() => { pull(); return closes ? c.ev.includes('close') : got.length >= expect; }, 4000);
      await sleep(300); pull();
      R[name] = { replies: got, events: c.ev.slice() };
    };
    const sized = (ts, len) => { const m = { t: 'ping', ts, pad: '' }; m.pad = 'x'.repeat(len - Buffer.byteLength(JSON.stringify(m))); return JSON.stringify(m); };
    await step('ping', [cframe('hi', { op: 9 })], 1);
    await step('ping one byte per write', [...cframe('hi', { op: 9 })].map(x => Buffer.from([x])), 1, { gap: 15 });
    await step('two pings in one write', [Buffer.concat([cframe('a', { op: 9 }), cframe('b', { op: 9 })])], 2);
    await step('json ping', [cframe({ t: 'ping', ts: 7 })], 1);
    await sleep(450);
    await step('two json pings in one write (the second within 400 ms is refused)', [Buffer.concat([cframe({ t: 'ping', ts: 8 }), cframe({ t: 'ping', ts: 9 })])], 1);
    await sleep(450);
    await step('bad json, then a json ping', [cframe('{"t":'), cframe({ t: 'ping', ts: 10 })], 1);
    await sleep(450);
    await step('a 1,400-byte json ping (ignored), then a json ping', [cframe(sized(11, 1400)), cframe({ t: 'ping', ts: 12 })], 1);
    await sleep(450);
    await step('a 1,399-byte json ping', [cframe(sized(13, 1399))], 1);
    await step('a binary frame and a pong frame (ignored)', [cframe(Buffer.from([1, 2, 3]), { op: 2 }), cframe('', { op: 10 })], 0);
    R.sizes = [Buffer.byteLength(sized(11, 1400)), Buffer.byteLength(sized(13, 1399))];
    await step('close frame', [cframe('', { op: 8 })], 0, { closes: true });
    R.snapshotTypes = [...pool].sort();
    c.s.destroy(); }
  /* 2. a 64-bit length: the socket is destroyed */
  { const c = await session(port, '/ws?room=h0raw2'); await c.ready(); c.take(); c.s.write(cframe('x', { len64: true })); await c.until(() => c.ev.includes('close'), 4000);
    R.len64 = { events: c.ev.slice(), replies: describe(c.take()).filter(x => !PERIODIC.has(x.t)) }; c.s.destroy(); }
  /* 3. refused upgrades: no response bytes, the socket is closed */
  for (const [name, raw] of [['wrong path', up('/wss?room=h0raw3')], ['no key', up('/ws?room=h0raw3', null)], ['the root path', up('/?room=h0raw3')]]) { const r = await exchange(port, [raw], { wait: 4000 }); R['refused: ' + name] = { bytes: r.bytes.length, text: r.bytes.toString('latin1').slice(0, 200), ev: r.ev }; }
  /* 4. a room holds 8; the 9th is refused; a place frees up when one leaves */
  { const cs = []; for (let i = 0; i < 8; i++) { const c = await session(port, '/ws?room=h0rawcap'); await c.ready(); cs.push(c); }
    R.cap8 = cs.map(c => (c.head || '').split('\r\n')[0]); R.cap8hi = cs.map(c => (describe(c.take())[0] || {}).msg || null);
    const r = await exchange(port, [up('/ws?room=h0rawcap')], { wait: 4000 }); R.cap9 = { bytes: r.bytes.length, ev: r.ev };
    cs[0].s.destroy(); await cs[0].until(() => cs[0].ev.includes('close')); await sleep(200);
    const again = await session(port, '/ws?room=h0rawcap'); await again.ready(); R.capAfterOneLeft = { head: (again.head || '').split('\r\n')[0], hi: (describe(again.take())[0] || {}).msg || null };
    again.s.destroy(); for (const c of cs) c.s.destroy(); await sleep(200); }
  /* 5. room names: cut to 24 characters, odd characters dropped, 'main' by default (each is accepted) */
  for (const q of ['/ws?room=' + 'r'.repeat(40), '/ws?room=%3Cb%3E', '/ws']) { const c = await session(port, q); await c.ready(); R['upgrade ' + q.slice(0, 30)] = { head: (c.head || '').split('\r\n')[0], hi: (describe(c.take())[0] || {}).msg || null }; c.s.destroy(); }
  return R;
}

async function side(dir) {
  const p = await start(dir); const res = { console: p.out.replace(String(p.port), 'PORT'), http: {} };
  for (const c of httpCases()) { const r = await exchange(p.port, [c.raw], { wait: 15000 }); const n = normHttp(r.bytes); res.http[c.name] = { head: n.head, dates: n.dates, bodyLen: n.body.length, bodySha: sha(n.body), ev: r.ev.filter(e => e !== 'end') }; }
  res.ws = await wsCases(p.port);
  await sleep(200); res.consoleAfter = p.out.replace(new RegExp(String(p.port), 'g'), 'PORT');
  await stop(p); res.exit = { code: p.exitCode, signal: p.signalCode };
  return res;
}

(async () => {
  const oldDir = oldTree(), newDir = ARG.aa ? oldTree() : REPO;
  const t0 = Date.now();
  const A = await side(oldDir), B = await side(newDir);
  const diffs = [];
  const cmp = (where, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) diffs.push({ where, old: x.slice(0, 400), new: y.slice(0, 400) }); };
  cmp('console', A.consoleAfter, B.consoleAfter);
  for (const k of Object.keys(A.http)) cmp('http ' + k, A.http[k], B.http[k]);
  for (const k of Object.keys(A.ws)) cmp('ws ' + k, A.ws[k], B.ws[k]);
  const rep = { tool: 'dev/stage-3h0/golden/raw_live.js', oldRef: ARG['old-ref'], mode: ARG.aa ? 'A/A (the parent on both sides)' : 'the parent against the working tree', at: new Date().toISOString(), ms: Date.now() - t0,
    httpCases: Object.keys(A.http).length, wsChecks: Object.keys(A.ws).length, identical: !diffs.length, diffs, old: A, new: B };
  for (const d of [oldDir].concat(ARG.aa ? [newDir] : [])) fs.rmSync(d, { recursive: true, force: true });
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
  console.log(`raw live (${rep.mode}): ${rep.httpCases} HTTP exchanges, ${rep.wsChecks} WebSocket checks: ${diffs.length ? diffs.length + ' DIFFERENCES' : 'identical'}`);
  for (const d of diffs.slice(0, 10)) console.log('  ' + d.where + '\n    old ' + d.old + '\n    new ' + d.new);
  process.exitCode = diffs.length ? 1 : 0;
})().catch(e => { console.error('RAW LIVE ERROR', e && e.stack || e); process.exitCode = 2; });
