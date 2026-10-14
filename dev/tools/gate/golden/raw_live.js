/* Stage 3H engine modernization - Stage 3H2's raw live comparison on either layout (development only).  A copy of
 * dev/stage-3h/golden/raw_live_h2.js (left as it is for the frozen layout), with two differences:
 *   - a file a response is about is read from that side's web root (dev/tools/layout.js: public/ on the modern layout), so a file that
 *     moved but kept its bytes is not taken for a changed one;
 *   - the paths asked add the modern layout's folders that must never be served (src/, generated/, public/, docs/, dev/tools/): each must
 *     answer exactly as on B++ (a 404).
 * The original's description follows.
 *
 * Stage 3H2 (H2-0) - the real server over real TCP: the accepted B++ game against the working tree (or another folder), whole game against
 * whole game.  A 3H copy of Stage 3H0's raw_live.js (left unchanged), repaired for B++:
 *   - 3H0's version copied the working tree and swapped in the old server.js, leaving out server/: on B++ the old side could not start, a
 *     WebSocket session never connected, the promise never settled and Node exited 0 with no output (a vacuous pass, 3H1 finding F-021).
 *     Here each side is a complete game folder: the old side is `git archive OLD-REF` (everything outside dev/), the new side the working tree;
 *   - a side whose server does not start, or a WebSocket session that does not connect in 6 s, is an error (exit 2), never a pass;
 *   - the run fails when it compared no HTTP exchange or no WebSocket check;
 *   - files the new side changed on purpose (a client file, a new server module) are compared by name: their HTTP responses may differ only in
 *     the body and Content-Length; every other header, the status and the connection events must match, and every other response must be
 *     byte-identical except its Date header.
 *
 *   node dev/tools/gate/golden/raw_live.js [--old-ref 143b63f] [--new-dir DIR] [--aa] [--out FILE.json]
 *
 * What is exchanged is Stage 3H0's list, plus the paths of 3H's server modules (never served):
 *   - start-up: the console line (the port number is replaced by PORT);
 *   - HTTP: every request below, with and without gzip, raw bytes in, raw bytes out;
 *   - WebSocket: the 101 response; the first frame ('hi'); a ping (whole, and one byte per TCP write) and its pong; JSON ping / pong;
 *     ignored input (bad JSON, a 1,400-byte text frame, a binary frame); the close frame; a 64-bit length; refused upgrades (wrong path,
 *     no key, the 9th player of a room).  The periodic snapshots carry a randomly seeded world, so only their types are compared.
 * --aa runs the old ref on both sides (shows the comparison is stable).  Processes are stopped by their own PID. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net'), crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const ARG = { 'old-ref': '143b63ff42b88c6780c5043e0f61d64100f81f40' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k === 'aa') ARG.aa = true; else ARG[k] = process.argv[++i]; }
const REPO = path.resolve(__dirname, '..', '..', '..', '..'), LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
const PASS = 'h0-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

/* a complete game folder: every file of REF outside dev/ (git archive) */
function exportTree(ref) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'h2raw-'));
  execFileSync('sh', ['-c', `git -C "$1" archive "$2" -- . ':(exclude)dev' | tar -x -C "$3"`, 'sh', REPO, ref, d]);
  if (!fs.existsSync(path.join(d, 'server.js'))) throw new Error('export of ' + ref + ' has no server.js');
  return d;
}
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function start(dir) {
  const port = await freePort();
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env });
  p.out = ''; p.stdout.on('data', d => { p.out += d; }); p.stderr.on('data', d => { p.out += 'ERR ' + d; });
  for (let i = 0; i < 400 && !/\n/.test(p.out) && p.exitCode === null; i++) await sleep(25);
  if (p.exitCode !== null || !/http:\/\/localhost:/.test(p.out)) { try { process.kill(p.pid, 'SIGTERM'); } catch (e) { } throw new Error('the server in ' + dir + ' did not start: ' + p.out.slice(0, 400)); }
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
  '/server', '/server/', '/server/ws.js', '/server/static.js', '/server/fields.js', '/server/peers.js', '/server/newrun.js', '/server/aftermath.js', '/server/movement.js', '/dev/stage-3h0/README.md', '/dev/tests/live.js', '/.git/config',
  '/%', '/%00', '/a%00b', '/..%2fserver.js', '/%2e%2e/server.js', '/assets/../server.js', '/assets/..%2f..%2fserver.js', '//server.js', '/assets//net-wire.js',
  '/sounds', '/sounds/', '/sounds/sting.mp3', '/sounds/sting%20copy.mp3', '/sounds/none.mp3', '/sounds/README.txt', '/sounds/../server.js', '/sounds/..%2fserver.js',
  '/favicon.ico', '/ws', '/nope',
  /* (this copy) the modern layout's folders: never served */
  '/src/', '/src/core/server/sim.glue.js', '/src/frameworks/ward/server/static.js', '/src/build-recipes.json', '/generated/', '/generated/server/sim.js', '/generated/BUILD_MANIFEST.json',
  '/public/', '/public/index.html', '/public/mp.js', '/docs/', '/docs/architecture/ADRS/ADR-001-layout.md', '/dev/tools/layout.js', '/src/core/client/bundle/lineage/ledger.json', '/assets/../../server.js', '/assets/..%2f..%2fsrc/build-recipes.json'];
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
  return new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1'); let buf = Buffer.alloc(0), head = null; const ev = []; let connected = false;
    const guard = setTimeout(() => { if (!connected) { s.destroy(); reject(new Error('WebSocket session ' + pathq + ': no connection in 6 s')); } }, 6000);
    s.on('data', d => { buf = Buffer.concat([buf, d]); if (head === null) { const i = buf.indexOf('\r\n\r\n'); if (i >= 0) { head = buf.slice(0, i + 4).toString('latin1'); buf = buf.slice(i + 4); } } });
    s.on('end', () => ev.push('end')); s.on('close', () => ev.push('close')); s.on('error', e => ev.push('error ' + e.code));
    const api = { s, ev, get head() { return head; },
      take() { const f = frames(buf); buf = buf.slice(buf.length - f.rest); return f.list; },
      async until(pred, ms = 8000) { for (let t = 0; t < ms; t += 20) { if (pred()) return true; await sleep(20); } return false; },
      ready() { return api.until(() => head !== null && frames(buf).list.length > 0 || ev.includes('close')); } };
    s.on('connect', () => { connected = true; clearTimeout(guard); s.write(up(pathq)); resolve(api); });
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
  const h0 = Date.now();
  for (const c of httpCases()) { const r = await exchange(p.port, [c.raw], { wait: 15000 }); const n = normHttp(r.bytes); res.http[c.name] = { head: n.head, dates: n.dates, bodyLen: n.body.length, bodySha: sha(n.body), ev: r.ev.filter(e => e !== 'end') }; }
  res.httpMs = Date.now() - h0;                              // wall time of the HTTP exchanges (reported only, never compared: it includes the first gzip of every file)
  res.ws = await wsCases(p.port);
  await sleep(200); res.consoleAfter = p.out.replace(new RegExp(String(p.port), 'g'), 'PORT');
  await stop(p); res.exit = { code: p.exitCode, signal: p.signalCode };
  return res;
}

/* the file an HTTP case is about: its URL path ('/' is index.html), or null */
/* the file a case's response carries: from a request line's path, or for the raw cases that ask for a file another way, named here (so a
 * declared change of that file is an expected content change there too, as on the plain GET) */
const RAW_FILE = { 'two requests on one connection': 'mp.js', 'GET with an absolute URL': 'mp.js' };
const fileOf = name => { if (RAW_FILE[name]) return RAW_FILE[name]; const m = /^(?:GET|HEAD|POST) (\S+)/.exec(name); if (!m) return null; let u; try { u = decodeURIComponent(m[1].split('?')[0]); } catch (e) { return null; } if (u === '/') u = '/index.html'; return u.replace(/^\/+/, ''); };
const fileSha = (dir, f) => { try { const p = path.join(LAYOUT.webRoot(dir), f); return fs.statSync(p).isFile() ? sha(fs.readFileSync(p)) : null; } catch (e) { return null; } };   // (this copy) the side's web root
const noLen = h => String(h).split('\r\n').filter(l => !/^Content-Length: /i.test(l)).join('\r\n');
(async () => {
  const oldDir = exportTree(ARG['old-ref']), newDir = ARG.aa ? exportTree(ARG['old-ref']) : path.resolve(ARG['new-dir'] || REPO);
  const t0 = Date.now();
  const A = await side(oldDir), B = await side(newDir);
  const diffs = [], expected = [];
  const cmp = (where, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) diffs.push({ where, old: x.slice(0, 400), new: y.slice(0, 400) }); };
  cmp('console', A.consoleAfter, B.consoleAfter);
  for (const k of Object.keys(A.http)) {
    const a = A.http[k], b = B.http[k], f = fileOf(k);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const changedFile = f && fileSha(oldDir, f) !== fileSha(newDir, f);
    if (changedFile && b && noLen(a.head) === noLen(b.head) && a.dates === b.dates && JSON.stringify(a.ev) === JSON.stringify(b.ev)) { expected.push({ case: k, file: f, old: { bodyLen: a.bodyLen, bodySha: a.bodySha }, new: { bodyLen: b.bodyLen, bodySha: b.bodySha } }); continue; }
    cmp('http ' + k, a, b);
  }
  for (const k of Object.keys(B.http)) if (!(k in A.http)) diffs.push({ where: 'http ' + k, old: 'missing', new: 'present' });
  for (const k of new Set(Object.keys(A.ws).concat(Object.keys(B.ws)))) cmp('ws ' + k, A.ws[k], B.ws[k]);
  console.log(`HTTP wall time (reported only): old ${A.httpMs} ms, new ${B.httpMs} ms`);
  const httpCases = Object.keys(A.http).length, wsChecks = Object.keys(A.ws).length;
  const rep = { tool: 'dev/tools/gate/golden/raw_live.js', oldRef: ARG['old-ref'], newDir: ARG.aa ? 'export of ' + ARG['old-ref'] : newDir,
    mode: ARG.aa ? 'A/A (the old ref on both sides)' : 'the old ref against ' + (ARG['new-dir'] ? 'a folder' : 'the working tree'), at: new Date().toISOString(), ms: Date.now() - t0,
    httpCases, wsChecks, identical: !diffs.length && !expected.length, expectedContentChanges: expected, diffs, ok: !diffs.length && httpCases > 0 && wsChecks > 0, old: A, new: B };
  for (const d of [oldDir].concat(ARG.aa ? [newDir] : [])) fs.rmSync(d, { recursive: true, force: true });
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
  console.log(`raw live (${rep.mode}): ${httpCases} HTTP exchanges, ${wsChecks} WebSocket checks: ${diffs.length ? diffs.length + ' DIFFERENCES' : expected.length ? 'identical except ' + expected.length + ' responses for changed files (' + [...new Set(expected.map(e => e.file))].join(', ') + ')' : 'identical'}`);
  for (const d of diffs.slice(0, 10)) console.log('  ' + d.where + '\n    old ' + d.old + '\n    new ' + d.new);
  if (!httpCases || !wsChecks) console.log('FAIL: nothing was compared');
  console.log('RAW LIVE: ' + (rep.ok ? 'PASS' : 'FAIL'));
  process.exitCode = rep.ok ? 0 : 1;
})().catch(e => { console.error('RAW LIVE ERROR', e && e.stack || e); console.log('RAW LIVE: ERROR'); process.exitCode = 2; });
