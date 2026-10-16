#!/usr/bin/env node
/* dev/tools/checks/chat_server.js - post-3H Trial 2: the chat's server side, checked (development only; docs/architecture/CHAT.md).
 *
 *   node dev/tools/checks/chat_server.js [--out FILE.json] [--only NAME,NAME] [--mutants 1] [--tree DIR] [--work DIR] [--quiet]
 *
 * Three layers, every case named in the report:
 *   unit_*     in this process: W.A.R.D.'s chat_text.js (the cleaning and its refusals); speech.js on hand-made rooms (the radius at 576 and
 *              577 px, the room, the menu and the dead, the bucket, repeats, a recipient's backlog, a connection that left); lounge.js on
 *              fake sockets (hello first, invalid messages, received bytes, unsent output, hello and idle timeouts, the counts).
 *   sock_*     the real server (`node server.js PORT`, a synthetic admin passcode), driven by raw WebSocket clients written here (masked
 *              frames, exact handshakes): nearby speech between real game connections in real rooms (positions set with the admin
 *              tools, the world frozen so no monster interferes), spoofed fields, menu and dead speakers, rate and repeat, invalid input,
 *              reconnects; the lounge across game rooms, its handshake and Origin rules, hello, limits, no replay, the caps on sockets
 *              and joins; game sockets never get a lounge line and the lounge never a game packet; the game's snapshots keep their pace
 *              while the lounge is busy.
 *   mutants    (--mutants 1) each mutant is a copy of the server (server.js, src/, generated/; public/ linked) with one deliberate fault
 *              (a cross-room leak, the radius ignored, a spoofed position or id trusted, the menu or the dead allowed to speak, the
 *              cleaning bypassed, the rate limit removed, the Origin check removed, a speaker's position added to the event, the lounge
 *              writing to game sockets, hello not required); its own cases must FAIL on it.
 * No real message is used: every text is synthetic.  No text is written to the report (counts, ids, reasons only).  Servers are stopped
 * by their PIDs.  Exit 0 only if every case passes (and, with --mutants, every mutant is caught). */
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), http = require('http'), crypto = require('crypto'), os = require('os');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) ARG[a.slice(2)] = '1'; else { ARG[a.slice(2)] = n; i++; } } }
const REPO = path.resolve(__dirname, '../../..');
const TREE = path.resolve(ARG.tree || REPO);
const ONLY = ARG.only ? new Set(ARG.only.split(',')) : null;
const QUIET = !!ARG.quiet;
const PASS = 't2-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const U = (...c) => String.fromCodePoint(...c);                         // special characters by code point (no escapes in this file's text)
const log = s => { if (!QUIET) console.log(s); };

/* ---------------------------------------------------------------- the cases */
const cases = [];
function check(name, ok, detail) { cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' - ' + detail : ''}`); }
const want = n => !ONLY || ONLY.has(n) || [...ONLY].some(o => n.startsWith(o + '_'));

/* ---------------------------------------------------------------- frames */
function maskFrame(str, op = 1, opts = {}) {
  const b = Buffer.from(str), n = b.length, key = crypto.randomBytes(4);
  const h = n < 126 ? Buffer.from([(opts.fin === false ? 0 : 0x80) | op, 0x80 | n]) : n < 65536 ? Buffer.from([(opts.fin === false ? 0 : 0x80) | op, 0x80 | 126, n >> 8, n & 255]) : null;
  const pl = Buffer.from(b); for (let i = 0; i < n; i++) pl[i] ^= key[i & 3];
  return Buffer.concat([h, key, pl]);
}

/* ---------------------------------------------------------------- a raw WebSocket client */
class Client {
  constructor(sock) { this.sock = sock; this.buf = Buffer.alloc(0); this.msgs = []; this.closed = false; this.waiters = new Set(); this.bytes = 0;
    sock.on('data', d => this.data(d)); sock.on('close', () => { this.closed = true; this.wake(); }); sock.on('error', () => { }); }
  data(d) {
    this.bytes += d.length; this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const op = this.buf[0] & 15; let len = this.buf[1] & 127, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      if (this.buf.length < off + len) return;
      const pl = this.buf.slice(off, off + len); this.buf = this.buf.slice(off + len);
      if (op === 1) { try { this.msgs.push(Object.assign(JSON.parse(pl), { _at: Date.now() })); } catch (e) { } }
      if (op === 8) { this.closed = true; }
    }
    this.wake();
  }
  wake() { for (const w of this.waiters) w(); }
  send(o) { if (!this.sock.destroyed) this.sock.write(maskFrame(typeof o === 'string' ? o : JSON.stringify(o))); }
  raw(b) { if (!this.sock.destroyed) this.sock.write(b); }
  of(t) { return this.msgs.filter(m => m.t === t); }
  async next(pred, ms = 2000, from = 0) {
    const t0 = Date.now();
    for (;;) {
      const m = this.msgs.slice(from).find(pred); if (m) return m;
      if (this.closed || Date.now() - t0 > ms) return null;
      await new Promise(r => { const w = () => { this.waiters.delete(w); r(); }; this.waiters.add(w); setTimeout(w, 50); });
    }
  }
  async gone(ms = 3000) { const t0 = Date.now(); while (!this.closed && Date.now() - t0 < ms) await sleep(25); return this.closed; }
  close() { try { this.sock.destroy(); } catch (e) { } }
}
/* the handshake: resolves { status, client } (client only on 101) */
function open(port, pth, headers = {}, opts = {}) {
  return new Promise(res => {
    const sock = net.connect(port, '127.0.0.1');
    let got = Buffer.alloc(0), done = false;
    const fin = v => { if (!done) { done = true; res(v); } };
    sock.on('error', () => fin({ status: 0 }));
    sock.on('close', () => fin({ status: 0 }));
    sock.setTimeout(4000, () => { fin({ status: -1 }); sock.destroy(); });
    sock.on('connect', () => {
      const h = Object.assign({ Host: `127.0.0.1:${port}`, Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13' }, headers);
      let req = `${opts.method || 'GET'} ${pth} HTTP/1.1\r\n`; for (const [k, v] of Object.entries(h)) if (v !== null) req += `${k}: ${v}\r\n`;
      sock.write(req + '\r\n');
    });
    const onData = d => {
      got = Buffer.concat([got, d]); const i = got.indexOf('\r\n\r\n'); if (i < 0) return;
      sock.removeListener('data', onData); sock.setTimeout(0);
      const status = +(/^HTTP\/1\.1 (\d+)/.exec(got.slice(0, i).toString()) || [0, 0])[1];
      if (status !== 101) { fin({ status }); sock.destroy(); return; }
      const c = new Client(sock); fin({ status, client: c }); const rest = got.slice(i + 4); if (rest.length) c.data(rest);
    };
    sock.on('data', onData);
  });
}

/* ---------------------------------------------------------------- the server */
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const httpGet = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
async function startServer(dir) {
  const port = await freePort(); let out = '';
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }), stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
  for (let i = 0; i < 100; i++) { if (await httpGet(port, '/index.html') === 200) return { port, p, out: () => out }; await sleep(100); }
  try { process.kill(p.pid); } catch (e) { } throw new Error('the server did not start in ' + dir + '\n' + out.slice(-2000));
}
const ORIGIN = port => ({ Origin: `http://127.0.0.1:${port}` });

/* a game connection: hello, optionally the admin tools, a join and a position */
async function game(port, room, o = {}) {
  const r = await open(port, '/ws?room=' + room); if (!r.client) throw new Error('no game socket ' + r.status);
  const c = r.client, hi = await c.next(m => m.t === 'hi', 3000); if (!hi) throw new Error('no hi');
  c.id = hi.id; c.room = room;
  if (o.admin !== false) { c.send({ t: 'admin', pass: PASS, quiet: 1 }); const a = await c.next(m => m.t === 'admin', 3000); if (!a || !a.ok) throw new Error('no admin'); }
  if (o.join !== false) { c.send({ t: 'join' }); await sleep(120); }
  if (o.x !== undefined) await place(c, o.x, o.y);
  return c;
}
let poseAt = 0;
async function place(c, x, y) {                                          // an admin's own pose, then wait until its admin snapshot says so
  for (let k = 0; k < 6; k++) {
    const wait = 40 - (Date.now() - poseAt); if (wait > 0) await sleep(wait);
    c.send({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 0, k: 'flashlight', n: 'T2 TEST', c: '#ffe7b2' }); poseAt = Date.now();
    const from = c.msgs.length;
    const s = await c.next(m => m.t === 's' && m.ad && Array.isArray(m.ad.pl) && m.ad.pl.some(q => q.id === c.id && Math.abs(q.x - x) < 1 && Math.abs(q.y - y) < 1), 1200, from);   // (an admin's snapshot lists every player's place: ad.pl)
    if (s) return true;
  }
  throw new Error(`could not place #${c.id} at ${x},${y}`);
}
async function freeze(c) { c.send({ t: 'a', c: 'freeze', on: true }); await c.next(m => m.t === 'ares' && /FROZEN/.test(m.msg), 2000); }
const heardBy = (c, seq) => c.msgs.filter(m => m.t === 'heard' && (seq === undefined || m.seq === seq));
const synth = k => `synthetic-t2-${k}-${crypto.randomBytes(3).toString('hex')}`;

/* ================================================================ unit: chat_text */
function unitText(tree) {
  const T = require(path.join(tree, 'src/frameworks/ward/server/chat_text.js'));
  const C = v => T.cleanText(v);
  const ok = (v, text) => { const r = C(v); return r.ok && (text === undefined || r.text === text); };
  const no = (v, why) => { const r = C(v); return !r.ok && r.why === why; };
  const rows = [
    ['plain', ok('hello there', 'hello there')],
    ['trim and collapse', ok('  a \t\n  b  ', 'a b')],
    ['not a string', no(5, 'bad') && no(null, 'bad') && no({ x: 1 }, 'bad') && no(['a'], 'bad')],
    ['empty', no('', 'empty') && no('   ', 'empty') && no(U(0x200B), 'empty')],
    ['160 code points kept, 161 refused', ok('x'.repeat(160)) && no('x'.repeat(161), 'long')],
    ['600 UTF-8 bytes kept, 601 refused', ok(U(0x1F600).repeat(150)) && no(U(0x1F600).repeat(150) + 'x', 'long')],
    ['long UTF-16 refused before any work', no('x'.repeat(100000), 'long')],
    ['lone surrogate refused', no('a' + String.fromCharCode(0xD800) + 'b', 'bad') && no(String.fromCharCode(0xDC00), 'bad')],
    ['bidi override removed', ok('a' + U(0x202E) + 'b', 'ab') && ok(U(0x2066) + 'x' + U(0x2069), 'x')],
    ['control-heavy refused', no(U(0x202E).repeat(5) + 'abc', 'bad') && no('a' + U(1, 2, 3, 4, 5) + 'b', 'bad')],
    ['zero-width removed, ZWJ kept', ok('a' + U(0x200B) + 'b', 'ab') && C(U(0x1F468, 0x200D, 0x1F469)).text === U(0x1F468, 0x200D, 0x1F469)],
    ['combining run capped at 4 (after NFC)', C('e' + U(0x301).repeat(30)).text === U(0xE9) + U(0x301).repeat(4) && C('a' + U(0x308, 0x30A, 0x323, 0x330, 0x331, 0x332)).text.length === 5],
    ['NFC', C('e' + U(0x301)).text === U(0xE9)],
    ['markup kept as literal text', ok('<img src=x onerror=alert(1)></div><script>x</script>', '<img src=x onerror=alert(1)></div><script>x</script>')],
    ['URL kept as text', ok('https://example.invalid/a?b=c', 'https://example.invalid/a?b=c')],
    ['RTL script kept', ok(U(0x5E9, 0x5DC, 0x5D5, 0x5DD))],
    ['nickname capped and defaulted', T.cleanNick('n'.repeat(40)) === 'wanderer' && T.cleanNick('') === 'wanderer' && T.cleanNick(7) === 'wanderer' && T.cleanNick('Zo' + U(0xEB)) === 'Zo' + U(0xEB) && T.cleanNick('a' + U(0x202E) + 'b') === 'ab'],
  ];
  for (const [n, v] of rows) check('unit_text_' + n.replace(/\W+/g, '_'), v);
}

/* ================================================================ unit: speech on hand-made rooms */
function unitSpeech(tree) {
  const sent = [];
  const send = (c, o) => sent.push([c.id, o]);
  const rooms = new Map();
  const mkRoom = name => { const r = { name, clients: new Map() }; rooms.set(name, r); return r; };
  const mkClient = (room, id, x, y, st = {}) => { const sock = { destroyed: false, writableLength: 0 }; const me = { id, sock, player: Object.assign({ active: true, dead: '', x, y }, st) }; room.clients.set(id, me); return me; };
  const { cleanText } = require(path.join(tree, 'src/frameworks/ward/server/chat_text.js'));
  const S = require(path.join(tree, 'src/frameworks/bpp/server/speech.js'))({ rooms, send, cleanText });
  const say = (me, m) => { let h; S.readerFor((sock, f) => { h = f; return () => { }; })(me.sock, () => { }); h(m); };
  const A = mkRoom('a'), B = mkRoom('b');
  const sp = mkClient(A, 1, 1000, 1000), near = mkClient(A, 2, 1100, 1000), edge = mkClient(A, 3, 1000, 1576), out = mkClient(A, 4, 1000, 1577),
    diag = mkClient(A, 5, 1000 + 407, 1000 + 407), menu = mkClient(A, 6, 1000, 1000, { active: false }), dead = mkClient(A, 7, 1000, 1010, { dead: 'hound' }),
    other = mkClient(B, 8, 1000, 1000);
  say(sp, { t: 'say', text: 'unit line one', x: 1000, y: 1577, id: 4, room: 'b' });
  const to = new Set(sent.filter(s => s[1].t === 'heard').map(s => s[0]));
  check('unit_speech_recipients', to.has(1) && to.has(2) && to.has(3) && to.has(5) && !to.has(4) && !to.has(6) && !to.has(7) && !to.has(8), [...to].sort().join(','));
  check('unit_speech_event_shape', sent.filter(s => s[1].t === 'heard').every(s => Object.keys(s[1]).sort().join() === 'id,seq,t,text' && s[1].id === 1 && s[1].text === 'unit line one'));
  check('unit_speech_hear_constant', S.HEAR === 576, S.HEAR);
  sent.length = 0; say(menu, { t: 'say', text: 'from the menu' });
  check('unit_speech_menu_refused', sent.length === 1 && sent[0][0] === 6 && sent[0][1].t === 'said' && sent[0][1].why === 'menu');
  sent.length = 0; say(dead, { t: 'say', text: 'from the dead' });
  check('unit_speech_dead_refused', sent.length === 1 && sent[0][1].why === 'dead');
  sent.length = 0; say(near, { t: 'say', text: 'r1' }); say(near, { t: 'say', text: 'r1' });
  check('unit_speech_repeat_refused', sent.filter(s => s[1].t === 'said' && s[1].why === 'repeat').length === 1);
  sent.length = 0; for (let i = 0; i < 6; i++) say(edge, { t: 'say', text: 'burst ' + i });
  const heardN = new Set(sent.filter(s => s[1].t === 'heard').map(s => s[1].seq)).size, slow = sent.filter(s => s[1].t === 'said' && s[1].why === 'slow');
  check('unit_speech_bucket', heardN === 3 && slow.length === 1 && slow[0][1].wait >= 1, `${heardN} lines, ${slow.length} slow`);
  sent.length = 0; near.sock.writableLength = 300 * 1024; say(diag, { t: 'say', text: 'backlog' }); near.sock.writableLength = 0;
  check('unit_speech_backlog_skipped', !sent.some(s => s[0] === 2) && sent.some(s => s[0] === 1));
  sent.length = 0; A.clients.delete(5); say(diag, { t: 'say', text: 'after leaving' });
  check('unit_speech_left_silent', sent.length === 0);
  const fresh = mkClient(A, 9, 1000, 1100);
  sent.length = 0; say(fresh, { t: 'say', text: 123 }); say(fresh, { t: 'say' }); say(fresh, { t: 'say', text: 'x'.repeat(200) });
  check('unit_speech_invalid_refused', sent.length === 3 && sent.every(s => s[1].t === 'said' && /bad|long/.test(s[1].why)), sent.map(s => s[1].why).join(','));
  // the reader wrapper: everything but say goes to the session as it was
  const seen = []; let h; S.readerFor((sock, f) => { h = f; })(sp.sock, m => seen.push(m)); h({ t: 'p', x: 1 }); h(null); h('str'); h({ t: 'say', text: 'q' });
  check('unit_speech_reader_passthrough', seen.length === 3 && seen[0].t === 'p' && seen[1] === null && seen[2] === 'str');
  check('unit_speech_inert_hook', S.ON_HEARD === null);
}

/* ================================================================ unit: the lounge on fake sockets */
function unitLounge(tree) {
  const { frame, reader } = require(path.join(tree, 'src/frameworks/bpp/server/ws.js'));
  const { cleanText, cleanNick } = require(path.join(tree, 'src/frameworks/ward/server/chat_text.js'));
  const mk = limits => require(path.join(tree, 'src/frameworks/bpp/server/lounge.js'))({ crypto, frame, reader, cleanText, cleanNick, limits });
  class Sock extends EventEmitter {
    constructor() { super(); this.out = []; this.destroyed = false; this.writableLength = 0; this.ended = false; }
    write(b) { this.out.push(Buffer.isBuffer(b) ? b : Buffer.from(b)); return true; }
    end(b) { if (b) this.write(b); this.ended = true; }
    destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('close'); } }
    setNoDelay() { }
    msgs() { const r = []; for (const b of this.out) { if (b[0] !== 0x81) continue; let len = b[1] & 127, off = 2; if (len === 126) { len = b.readUInt16BE(2); off = 4; } try { r.push(JSON.parse(b.slice(off, off + len))); } catch (e) { } } return r; }
    in(o) { this.emit('data', maskFrame(typeof o === 'string' ? o : JSON.stringify(o))); }
  }
  const req = (o = {}) => ({ method: 'GET', url: '/social', headers: Object.assign({ host: 'h.example:1', origin: 'http://h.example:1', upgrade: 'websocket', 'sec-websocket-key': crypto.randomBytes(16).toString('base64'), 'sec-websocket-version': '13' }, o) });
  const L = mk({ COUNT_MS: 0 });
  const a = new Sock(), b = new Sock(); L.upgrade(req(), a); L.upgrade(req(), b);
  check('unit_lounge_handshake', a.out[0].toString().startsWith('HTTP/1.1 101') && b.out[0].toString().startsWith('HTTP/1.1 101'));
  a.in({ t: 'social_send', text: 'before hello' });
  check('unit_lounge_hello_first', a.msgs().length === 0 && L.stats().members === 0);
  a.in({ t: 'social_hello', nick: 'Unit ' + U(0x202E) + 'A' }); b.in({ t: 'social_hello', nick: 'UnitB' });
  const wa = a.msgs().find(m => m.t === 'social_welcome');
  check('unit_lounge_welcome', !!wa && wa.v === 1 && wa.nick === 'Unit A' && typeof wa.id === 'number' && L.stats().members === 2);
  a.in({ t: 'social_send', text: 'unit lounge line', id: 99, nick: 'spoof' });
  const lb = b.msgs().find(m => m.t === 'social_message');
  check('unit_lounge_line', !!lb && lb.id === wa.id && lb.nick === 'Unit A' && lb.text === 'unit lounge line' && Object.keys(lb).sort().join() === 'id,nick,seq,t,text');
  // backpressure: a socket with a backlog is skipped, then destroyed
  b.writableLength = 70 * 1024; const nb = b.out.length; a.in({ t: 'social_send', text: 'second line' });
  check('unit_lounge_soft_skip', b.out.length === nb && !b.destroyed && L.stats().skipped >= 1);
  b.writableLength = 300 * 1024; a.in({ t: 'social_send', text: 'third line' });
  check('unit_lounge_hard_destroy', b.destroyed && L.stats().members === 1);
  // invalid messages: the socket goes after BAD of them
  const c = new Sock(); L.upgrade(req(), c); c.in({ t: 'social_hello', nick: 'c' });
  for (let i = 0; i < 9; i++) c.in(i % 3 === 0 ? '[1,2]' : i % 3 === 1 ? { t: 'p', x: 1 } : 7);   // (unparseable frames never reach the lounge: the reader drops them; the byte budget bounds them)
  check('unit_lounge_invalid_destroy', c.destroyed);
  // received bytes
  const d = new Sock(); L.upgrade(req(), d); d.in({ t: 'social_hello', nick: 'd' });
  for (let i = 0; i < 14 && !d.destroyed; i++) d.in('x'.repeat(1300));
  check('unit_lounge_bytes_destroy', d.destroyed);
  // handshake refusals
  const bad = (o, code) => { const s = new Sock(); L.upgrade(req(o), s); return s.out.length > 0 && s.out[0].toString().startsWith('HTTP/1.1 ' + code); };
  check('unit_lounge_origin', bad({ origin: 'http://evil.example' }, 403) && bad({ origin: null }, 403) && bad({ origin: 'file://' }, 403) && bad({ origin: 'http://h.example:2' }, 403)
    && !bad({ host: 'internal:8000', 'x-forwarded-host': 'h.example:1' }, 403));
  check('unit_lounge_handshake_refused', bad({ 'sec-websocket-version': '8' }, 400) && bad({ 'sec-websocket-key': 'short' }, 400) && bad({ upgrade: 'h2c' }, 400));
  // timeouts and counts (short limits)
  const L2 = mk({ HELLO_MS: 50, IDLE_MS: 150, SWEEP_MS: 20, COUNT_MS: 0 });
  const e = new Sock(), f = new Sock(); L2.upgrade(req(), e); L2.upgrade(req(), f); f.in({ t: 'social_hello', nick: 'f' });
  return new Promise(res => setTimeout(() => {
    check('unit_lounge_hello_timeout', e.destroyed && !f.destroyed);
    setTimeout(() => { check('unit_lounge_idle_timeout', f.destroyed && L2.stats().sockets === 0); res(); }, 200);
  }, 80));
}

/* ================================================================ sockets: nearby speech */
async function sockSpeech(port) {
  const RA = 't2a' + crypto.randomBytes(2).toString('hex'), RB = 't2b' + crypto.randomBytes(2).toString('hex');
  const X = 3000, Y = 3000;
  const sp = await game(port, RA, { x: X, y: Y });
  await freeze(sp);
  const near = await game(port, RA, { x: X + 100, y: Y });
  const mid = await game(port, RA, { x: X - 500, y: Y });
  const edge = await game(port, RA, { x: X, y: Y + 576 });
  const out = await game(port, RA, { x: X, y: Y - 577 });
  const far = await game(port, RA, { x: X + 1500, y: Y });
  const menu = await game(port, RA, { join: false });                  // in the room, on its menu
  const ob = await game(port, RB, { x: X + 100, y: Y });               // another room, the same place
  await freeze(ob);
  const all = [sp, near, mid, edge, out, far, menu, ob];
  const text = synth('near');
  sp.send({ t: 'say', text });
  await sleep(600);
  const got = c => c.msgs.filter(m => m.t === 'heard' && m.text === text);
  const yes = [sp, near, mid, edge], no = [out, far, menu, ob];
  check('sock_speech_eligible_once', yes.every(c => got(c).length === 1 && got(c)[0].id === sp.id), yes.map(c => got(c).length).join(','));
  check('sock_speech_outside_none', no.every(c => got(c).length === 0 && heardBy(c).length === 0), no.map(c => heardBy(c).length).join(','));
  check('sock_speech_other_room_none', heardBy(ob).length === 0);
  check('sock_speech_menu_none', heardBy(menu).length === 0);
  check('sock_speech_event_shape', yes.every(c => got(c).every(m => Object.keys(m).filter(k => k !== '_at').sort().join() === 'id,seq,t,text')));
  // spoofed fields: a position next to the far player, another's id, another room, a name, admin
  const t2 = synth('spoof');
  near.send({ t: 'say', text: t2, x: X + 1500, y: Y, id: far.id, room: RB, n: 'SOMEONE ELSE', name: 'x', admin: true, a: 1 });
  await sleep(600);
  const g2 = c => c.msgs.filter(m => m.t === 'heard' && m.text === t2);
  check('sock_speech_spoof_ignored', g2(sp).length === 1 && g2(sp)[0].id === near.id && g2(far).length === 0 && g2(ob).length === 0 && g2(near).length === 1, `far ${g2(far).length}, other room ${g2(ob).length}`);
  // the menu speaker
  menu.send({ t: 'say', text: synth('menu') }); const r1 = await menu.next(m => m.t === 'said', 1500);
  await sleep(300);
  check('sock_speech_menu_refused', !!r1 && r1.ok === 0 && r1.why === 'menu' && all.every(c => c.msgs.filter(m => m.t === 'heard' && m.id === menu.id).length === 0));
  // rate and repeat
  const before = heardBy(sp).length;                                     // (mid is 500 px from the speaker: sp hears it, near does not)
  for (let i = 0; i < 5; i++) mid.send({ t: 'say', text: synth('burst' + i) });
  const slow = await mid.next(m => m.t === 'said' && m.why === 'slow', 1500);
  await sleep(400);
  check('sock_speech_rate', heardBy(sp).length - before === 3 && !!slow && slow.wait >= 1, `${heardBy(sp).length - before} heard`);
  await sleep(1800);                                                     // one token back (5 s / 3)
  const t3 = synth('after');
  mid.send({ t: 'say', text: t3 }); const back = await sp.next(m => m.t === 'heard' && m.text === t3, 1500);
  check('sock_speech_rate_refills', !!back);
  edge.send({ t: 'say', text: 'synthetic repeat' }); edge.send({ t: 'say', text: 'synthetic repeat' });
  const rep = await edge.next(m => m.t === 'said' && m.why === 'repeat', 1500);
  check('sock_speech_repeat', !!rep);
  // invalid input
  const inv = [{ t: 'say' }, { t: 'say', text: 5 }, { t: 'say', text: '' }];
  await sleep(1700); for (const m of inv) sp.send(m);
  const reasons = []; for (let i = 0; i < 40 && reasons.length < 3; i++) { await sleep(50); reasons.splice(0, 9, ...sp.msgs.filter(m => m.t === 'said').map(m => m.why)); }
  check('sock_speech_invalid', reasons.includes('bad') && reasons.includes('empty'), reasons.join(','));
  await sleep(1700);
  const lone = '{"t":"say","text":"a\\ud800b"}'; sp.raw(maskFrame(lone));   // a lone surrogate through a JSON escape
  const rl = await sp.next(m => m.t === 'said' && m.why === 'bad', 1500, sp.msgs.length);
  check('sock_speech_lone_surrogate', !!rl);
  await sleep(1700);
  const big = synth('x') + 'y'.repeat(200); sp.send({ t: 'say', text: big });
  const rb = await sp.next(m => m.t === 'said' && m.why === 'long', 1500);
  check('sock_speech_oversized', !!rb && !near.msgs.some(m => m.t === 'heard' && m.text === big));
  // a frame of 1,400 bytes or more is not read at all (the reader's cap), and the socket lives on
  sp.raw(maskFrame(JSON.stringify({ t: 'say', text: 'z'.repeat(1500) })));
  await sleep(300); sp.send({ t: 'ping', ts: 1 }); const pong = await sp.next(m => m.t === 'pong', 1500);
  check('sock_speech_big_frame_ignored', !!pong && !near.msgs.some(m => m.t === 'heard' && m.text && m.text.length > 1000));
  // the markup payload arrives as the same literal text
  await sleep(1700);
  const html = '<img src=x onerror=alert(1)></div>' + synth('html');
  sp.send({ t: 'say', text: html }); const hh = await near.next(m => m.t === 'heard' && m.id === sp.id && m.text === html, 1500);
  check('sock_speech_markup_literal', !!hh);
  // a dead speaker and a dead listener (room D, the world running: the admin's own preview death)
  const RD = 't2d' + crypto.randomBytes(2).toString('hex');
  const dv = await game(port, RD, { x: 3000, y: 3000 }), dl = await game(port, RD, { x: 3100, y: 3000 });
  dv.send({ t: 'a', c: 'preview', k: 'hound', var: 'A' });
  const dead = await dl.next(m => m.t === 's' && Array.isArray(m.p) && m.p.some(q => q.id === dv.id && q.d === 1), 20000);   // (a snapshot lists the others: the listener sees the speaker dead)
  if (!dead) check('sock_speech_dead_refused', false, 'the preview death never came');
  else {
    dv.send({ t: 'say', text: synth('dead') }); const rd = await dv.next(m => m.t === 'said', 1500);
    const t4 = synth('to-dead'); dl.send({ t: 'say', text: t4 }); const own = await dl.next(m => m.t === 'heard' && m.text === t4, 1500);
    await sleep(400);
    check('sock_speech_dead_refused', !!rd && rd.why === 'dead' && !dl.msgs.some(m => m.t === 'heard' && m.id === dv.id));
    check('sock_speech_dead_hears_nothing', !!own && !dv.msgs.some(m => m.t === 'heard' && m.text === t4));
  }
  // a reconnect: a new id, no duplicate delivery
  const seqs = near.msgs.filter(m => m.t === 'heard').map(m => m.seq);
  check('sock_speech_no_duplicates', new Set(seqs).size === seqs.length, `${seqs.length} lines`);
  near.close(); await sleep(200);
  const near2 = await game(port, RA, { x: X + 120, y: Y });
  await sleep(1700); const t5 = synth('reconnect'); sp.send({ t: 'say', text: t5 });
  const g5 = await near2.next(m => m.t === 'heard' && m.text === t5, 1500);
  check('sock_speech_reconnect', !!g5 && near2.id !== near.id && near2.msgs.filter(m => m.t === 'heard').length === 1);
  // the game socket still speaks the game: a lounge packet there does nothing
  sp.send({ t: 'social_hello', nick: 'x' }); sp.send({ t: 'social_send', text: synth('wrong-socket') });
  await sleep(400);
  check('sock_speech_no_lounge_on_game', !all.concat(near2).some(c => c.msgs.some(m => /^social_/.test(m.t))));
  for (const c of all.concat(near2, dv, dl)) c.close();
}

/* ================================================================ sockets: an ordinary pair (no admin tools) */
async function sockPlain(port) {
  const R = 't2p' + crypto.randomBytes(2).toString('hex');
  const a = await game(port, R, { admin: false }), b = await game(port, R, { admin: false });
  await sleep(400);
  const t = synth('plain'); a.send({ t: 'say', text: t });
  const ga = await a.next(m => m.t === 'heard' && m.text === t, 1500), gb = await b.next(m => m.t === 'heard' && m.text === t, 1500);
  check('sock_plain_spawned_pair_hears', !!ga && !!gb && gb.id === a.id);
  a.close(); b.close();
}

/* ================================================================ sockets: the lounge */
async function sockLounge(port) {
  const lounge = async (room, nick, o = {}) => {
    const r = await open(port, '/social' + (room ? '?room=' + room : ''), Object.assign(ORIGIN(port), o.headers || {}));
    if (!r.client) return r;
    if (nick !== null) { r.client.send({ t: 'social_hello', nick }); r.client.welcome = await r.client.next(m => m.t === 'social_welcome', 2000); }
    return r.client;
  };
  const a = await lounge('roomone', 'Synth A'), b = await lounge('roomtwo', 'Synth B');
  const g = await game(port, 'roomone', { join: false });               // a game socket on the menu of roomone
  const g2 = await game(port, 'roomtwo', { x: 3000, y: 3000 });         // and one in a run
  check('sock_lounge_welcome', !!a.welcome && !!b.welcome && a.welcome.id !== b.welcome.id && a.welcome.nick === 'Synth A');
  const t = synth('lounge'); a.send({ t: 'social_send', text: t });
  const ab = await b.next(m => m.t === 'social_message' && m.text === t, 1500), aa = await a.next(m => m.t === 'social_message' && m.text === t, 1500);
  check('sock_lounge_across_rooms', !!ab && !!aa && ab.id === a.welcome.id && ab.nick === 'Synth A' && ab.seq === aa.seq);
  await sleep(400);
  check('sock_lounge_not_on_game', ![g, g2].some(c => c.msgs.some(m => /^social_/.test(m.t) || (m.text && m.text === t))));
  // a game packet on the lounge is just invalid; nothing comes of it
  a.send({ t: 'join' }); a.send({ t: 'say', text: synth('x') }); a.send({ t: 'admin', pass: PASS }); a.send({ t: 'p', x: 1, y: 1 });
  await sleep(300);
  check('sock_lounge_no_game_protocol', !a.closed && !a.msgs.some(m => ['hi', 'admin', 's', 'heard', 'said', 'tp'].includes(m.t)));
  // no replay to a newcomer
  const c = await lounge('', 'Synth C');
  await sleep(300);
  check('sock_lounge_no_replay', !!c.welcome && !c.msgs.some(m => m.t === 'social_message'));
  // limits
  for (let i = 0; i < 4; i++) b.send({ t: 'social_send', text: synth('b' + i) });
  const sl = await b.next(m => m.t === 'social_error' && m.why === 'slow', 1500);
  check('sock_lounge_rate', !!sl && sl.wait >= 1);
  await sleep(1800);
  c.send({ t: 'social_send', text: 'synthetic again' }); c.send({ t: 'social_send', text: 'synthetic again' });
  check('sock_lounge_repeat', !!await c.next(m => m.t === 'social_error' && m.why === 'repeat', 1500));
  await sleep(1800);
  c.send({ t: 'social_send', text: 'q'.repeat(161) }); c.send({ t: 'social_send', text: U(0x202E).repeat(6) + 'x' });
  const e1 = await c.next(m => m.t === 'social_error' && m.why === 'long', 1500), e2 = await c.next(m => m.t === 'social_error' && m.why === 'bad', 1500);
  check('sock_lounge_invalid_text', !!e1 && !!e2);
  // the nickname: cleaned, and lines carry the new one
  await sleep(1800);
  c.send({ t: 'social_nick', nick: 'N' + U(0x200B) + 'ew' + U(0x202E) });
  const nn = await c.next(m => m.t === 'social_nick', 1500);
  check('sock_lounge_nick', !!nn && nn.nick === 'New');
  // hello first; invalid messages close it
  const d = await lounge('', null);
  d.send({ t: 'social_send', text: synth('early') }); await sleep(200);
  check('sock_lounge_hello_required', !d.msgs.some(m => m.t === 'social_message') && !a.msgs.some(m => m.t === 'social_message' && /early/.test(m.text || '')));
  for (let i = 0; i < 9; i++) d.send(i % 2 ? '"text"' : { t: 'nothing' });
  check('sock_lounge_invalid_closes', await d.gone(2000));
  // the handshake rules
  const st = async (h, o) => (await open(port, '/social', h, o)).status;
  const s1 = await st({ Origin: 'http://evil.example' }), s2 = await st({}), s3 = await st(Object.assign(ORIGIN(port), { 'Sec-WebSocket-Version': '8' })),
    s4 = await st(Object.assign(ORIGIN(port), { 'Sec-WebSocket-Key': 'abc' })), s5 = await st(ORIGIN(port), { method: 'POST' }),
    s6 = await st({ Host: 'internal.invalid:1', 'X-Forwarded-Host': 'game.example', Origin: 'https://game.example' }),
    s7 = await st({ Origin: `http://127.0.0.1:${port}.evil.example` });
  check('sock_lounge_origin', s1 === 403 && s2 === 403 && s7 === 403 && s6 === 101, `${s1},${s2},${s7},${s6}`);
  check('sock_lounge_handshake', s3 === 400 && s4 === 400 && s5 === 400, `${s3},${s4},${s5}`);
  const p0 = await st(ORIGIN(port), {}), w = await httpGet(port, '/social');
  check('sock_lounge_plain_http_404', w === 404 && p0 === 101);
  // the game's /ws is as before: an unknown path is dropped, the room cap holds
  const un = await open(port, '/nothing', ORIGIN(port));
  check('sock_game_unknown_path_dropped', un.status === 0);
  for (const x of [a, b, c, g, g2]) x.close();
}

/* the caps: joins per 10 s, then sockets at once (run last: it spends the join budget) */
async function sockCaps(port) {
  await sleep(10500);                                                    // a full join budget
  const opened = []; let refusedAt = -1, code = 0;
  for (let i = 0; i < 32; i++) { const r = await open(port, '/social', ORIGIN(port)); if (r.client) opened.push(r.client); else { refusedAt = i; code = r.status; break; } }
  check('sock_lounge_join_rate', refusedAt >= 25 && refusedAt <= 31 && code === 429, `refused at ${refusedAt} with ${code}`);
  const hello = c => { c.send({ t: 'social_hello', nick: 'Cap' }); };   // said at once: a socket without hello is closed after 10 s
  for (const c of opened) hello(c);
  for (let k = 0; k < 4 && opened.length < 64; k++) { await sleep(10500); for (let i = 0; i < 30 && opened.length < 64; i++) { const r = await open(port, '/social', ORIGIN(port)); if (r.client) { hello(r.client); opened.push(r.client); } } }
  for (const c of opened) c.send({ t: 'social_ping' });
  await sleep(10500);                                                    // the join budget back, so only the socket cap can refuse
  const alive = opened.filter(c => !c.closed).length;
  const over = await open(port, '/social', ORIGIN(port));
  check('sock_lounge_socket_cap', opened.length === 64 && alive === 64 && over.status === 503, `${opened.length} opened, ${alive} still open, then ${over.status}`);
  for (const c of opened) c.close();
}

/* the game's pace while the lounge is busy: snapshot gaps of a game client, quiet and busy */
async function sockPace(port) {
  const R = 't2s' + crypto.randomBytes(2).toString('hex');
  const g = await game(port, R, { x: 3000, y: 3000 });
  const gaps = async ms => { const from = g.msgs.length; await sleep(ms); const s = g.msgs.slice(from).filter(m => m.t === 's').map(m => m._at); const d = []; for (let i = 1; i < s.length; i++) d.push(s[i] - s[i - 1]); d.sort((x, y) => x - y); return { n: s.length, p50: d[Math.floor(d.length / 2)] || 0, p95: d[Math.floor(d.length * .95)] || 0 }; };
  const quiet = await gaps(3000);
  const ls = []; for (let i = 0; i < 20; i++) { const r = await open(port, '/social', ORIGIN(port)); if (r.client) { r.client.send({ t: 'social_hello', nick: 'Load ' + i }); ls.push(r.client); } }
  let stop = false; const loop = (async () => { let i = 0; while (!stop) { ls[i % ls.length].send({ t: 'social_send', text: synth('load' + i) }); i++; await sleep(15); } })();
  const busy = await gaps(3000); stop = true; await loop;
  check('sock_game_pace_with_lounge_load', quiet.n >= 40 && busy.n >= 40 && busy.p50 <= quiet.p50 + 10 && busy.p95 <= quiet.p95 + 40, `quiet ${quiet.n} snapshots p50 ${quiet.p50} p95 ${quiet.p95} ms; busy ${busy.n} p50 ${busy.p50} p95 ${busy.p95} ms`);
  for (const c of ls) c.close(); g.close();
}

async function suite(tree, label) {
  const layer = async (n, f) => { if (!want(n)) return; try { await f(tree); } catch (e) { check(n + '_ran', false, String(e && e.message || e).slice(0, 200)); } };   // a layer that throws is a failed case, not a lost report
  await layer('unit_text', unitText);
  await layer('unit_speech', unitSpeech);
  await layer('unit_lounge', unitLounge);
  const needSock = !ONLY || [...ONLY].some(o => o.startsWith('sock'));
  if (!needSock) return;
  const S = await startServer(tree);
  try {
    if (want('sock_speech')) await sockSpeech(S.port);
    if (want('sock_plain')) await sockPlain(S.port);
    if (want('sock_lounge')) await sockLounge(S.port);
    if (want('sock_pace')) await sockPace(S.port);
    if (want('sock_caps')) await sockCaps(S.port);
  } catch (e) { check('sock_' + label + '_ran', false, String(e && e.message || e).slice(0, 200)); }
  finally {
    const out = S.out();
    try { process.kill(S.p.pid); } catch (e) { }
    // the server's own output never holds a chat text (only the admin tool's log lines appear)
    check('sock_server_log_no_text', !/synthetic-t2|Synth [ABC]|unit lounge/.test(out), `${out.split('\n').filter(Boolean).length} log lines`);
  }
}

/* ================================================================ mutants */
const MUTANTS = [
  { name: 'cross-room leak', file: 'src/frameworks/bpp/server/speech.js', from: 'for (const o of room.clients.values()) {', to: 'for (const o of [...rooms.values()].flatMap(r => [...r.clients.values()])) {', only: 'sock_speech,unit_speech', expect: ['sock_speech_other_room_none', 'unit_speech_recipients'] },
  { name: 'radius ignored', file: 'src/frameworks/bpp/server/speech.js', from: 'if (dx * dx + dy * dy > HEAR * HEAR) continue;', to: '', only: 'sock_speech,unit_speech', expect: ['sock_speech_outside_none', 'unit_speech_recipients'] },
  { name: 'spoofed position trusted', file: 'src/frameworks/bpp/server/speech.js', from: 'const x = p.x, y = p.y;', to: 'const x = isFinite(m.x) ? +m.x : p.x, y = isFinite(m.y) ? +m.y : p.y;', only: 'sock_speech,unit_speech', expect: ['sock_speech_spoof_ignored'] },
  { name: 'spoofed id trusted', file: 'src/frameworks/bpp/server/speech.js', from: "const ev = { t: 'heard', id: me.id,", to: "const ev = { t: 'heard', id: m.id || me.id,", only: 'sock_speech,unit_speech', expect: ['sock_speech_spoof_ignored'] },
  { name: 'menu and dead may speak', file: 'src/frameworks/bpp/server/speech.js', from: "  if (!p.active) return refuse(st, 'menu');\n  if (p.dead) return refuse(st, 'dead');\n", to: '', only: 'sock_speech,unit_speech', expect: ['sock_speech_menu_refused', 'unit_speech_menu_refused'] },
  { name: 'dead recipients hear', file: 'src/frameworks/bpp/server/speech.js', from: 'if (!q.active || q.dead) continue;', to: 'if (!q.active) continue;', only: 'sock_speech,unit_speech', expect: ['unit_speech_recipients'] },
  { name: 'cleaning bypassed', file: 'src/frameworks/ward/server/chat_text.js', from: "  if (LONE.test(v)) return { ok: false, why: 'bad' };", to: "  return v.length ? { ok: true, text: v } : { ok: false, why: 'empty' };", only: 'unit_text,sock_speech,sock_lounge', expect: ['unit_text_bidi_override_removed', 'sock_speech_lone_surrogate', 'sock_lounge_invalid_text'] },
  { name: 'speech rate limit removed', file: 'src/frameworks/bpp/server/speech.js', from: 'if (st.tokens < 1) {', to: 'if (false) {', only: 'sock_speech,unit_speech', expect: ['sock_speech_rate', 'unit_speech_bucket'] },
  { name: 'lounge rate limit removed', file: 'src/frameworks/bpp/server/lounge.js', from: 'if (s.tokens >= 1) { s.tokens -= 1; return true; }', to: 'return true;', only: 'sock_lounge', expect: ['sock_lounge_rate'] },
  { name: 'Origin check removed', file: 'src/frameworks/bpp/server/lounge.js', from: "if (!sameOrigin(req)) return deny(sock, 403, 'Forbidden', 'origin');", to: '', only: 'sock_lounge,unit_lounge', expect: ['sock_lounge_origin', 'unit_lounge_origin'] },
  { name: 'speaker position sent', file: 'src/frameworks/bpp/server/speech.js', from: "const ev = { t: 'heard', id: me.id, text: c.text, seq: ++seq };", to: "const ev = { t: 'heard', id: me.id, text: c.text, seq: ++seq, x: Math.round(p.x), y: Math.round(p.y) };", only: 'sock_speech,unit_speech', expect: ['sock_speech_event_shape', 'unit_speech_event_shape'] },
  { name: 'lounge lines to game sockets', file: 'server.js', from: 'gameUpgrade(req, sock, head);\n});', to: "gameUpgrade(req, sock, head);\n});\n{ const u0 = lounge.upgrade; lounge.upgrade = (req, sock, head) => { const w = sock.write.bind(sock); sock.write = b => { if (Buffer.isBuffer(b) && b[0] === 0x81) for (const r of rooms.values()) for (const c of r.clients.values()) c.sock.write(b); return w(b); }; return u0(req, sock, head); }; }", only: 'sock_lounge', expect: ['sock_lounge_not_on_game'] },
  { name: 'hello not required', file: 'src/frameworks/bpp/server/lounge.js', from: "    if (s.nick === null) return bad();                                   // nothing before hello", to: "    if (s.nick === null) { s.nick = 'x'; members.add(s); }", only: 'sock_lounge,unit_lounge', expect: ['sock_lounge_hello_required', 'unit_lounge_hello_first'] },
];
function copyTree(dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(TREE, f), path.join(dst, f));
  for (const d of ['src', 'generated']) fs.cpSync(path.join(TREE, d), path.join(dst, d), { recursive: true });
  fs.symlinkSync(path.join(TREE, 'public'), path.join(dst, 'public'));
}
async function runMutants(work) {
  const res = [];
  for (const M of MUTANTS) {
    const dir = path.join(work, 'm' + MUTANTS.indexOf(M)); fs.rmSync(dir, { recursive: true, force: true }); copyTree(dir);
    const f = path.join(dir, M.file), src = fs.readFileSync(f, 'utf8');
    if (!src.includes(M.from)) { res.push({ name: M.name, caught: false, why: 'the mutation does not apply' }); log(`MUTANT ${M.name}: does not apply`); continue; }
    fs.writeFileSync(f, src.replace(M.from, M.to));
    const r = await new Promise(done => {
      const p = spawn(process.execPath, [__filename, '--tree', dir, '--only', M.only, '--quiet', '--out', path.join(dir, 'report.json')], { stdio: 'ignore' });
      p.on('exit', code => { let j = null; try { j = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')); } catch (e) { } done({ code, j }); });
    });
    const failed = r.j ? r.j.cases.filter(c => !c.ok).map(c => c.name) : ['(no report)'];
    const caught = r.code !== 0 && M.expect.some(e => failed.includes(e));
    res.push({ name: M.name, file: M.file, caught, failed, expected: M.expect });
    log(`MUTANT ${M.name}: ${caught ? 'caught' : 'NOT CAUGHT'} (${failed.slice(0, 6).join(', ')})`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return res;
}

(async () => {
  const t0 = Date.now();
  if (!ARG.mutants || ONLY) await suite(TREE, 'run');
  else await suite(TREE, 'run');
  let mut = null;
  if (ARG.mutants === '1') {
    const work = path.resolve(ARG.work || fs.mkdtempSync(path.join(os.tmpdir(), 'chat-mut-')));
    mut = await runMutants(work);
  }
  const ok = cases.length > 0 && cases.every(c => c.ok) && (!mut || mut.every(m => m.caught));
  const rep = { tool: 'dev/tools/checks/chat_server.js', tree: TREE === REPO ? 'this repository' : TREE, seconds: Math.round((Date.now() - t0) / 1000), ok,
    cases, passed: cases.filter(c => c.ok).length, failed: cases.filter(c => !c.ok).map(c => c.name), mutants: mut };
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
  console.log(`CHAT SERVER: ${ok ? 'PASS' : 'FAIL'} - ${rep.passed} of ${cases.length} cases${mut ? `; mutants ${mut.filter(m => m.caught).length} of ${mut.length} caught` : ''} (${rep.seconds} s)`);
  process.exit(ok ? 0 : 1);
})();
