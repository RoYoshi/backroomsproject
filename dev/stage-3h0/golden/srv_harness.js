/* Stage 3H0 - deterministic server harness (development only; never served, never loaded by the game).
 *
 *   node dev/stage-3h0/golden/srv_harness.js --src SERVER_SOURCE_FILE --dir GAME_DIR --scenario NAME --out TRACE.jsonl [--struct STRUCT.json]
 *                                            [--scenarios FILE] [--seed N]
 *   --scenarios  another scenario module (default srv_scenarios.js);  --seed  another fixed world and random stream (H0-5; absent = as before)
 *
 * Runs the given server.js SOURCE as if it were GAME_DIR/server.js (so the accepted parent's text and the working tree's text can be run
 * against the very same files: sim.js, death_srv.js, assets ...), inside a closed world:
 *   - time:       Date.now() is a fake clock; process.hrtime.bigint() advances 1 ms per call; setTimeout / setInterval are a fake scheduler
 *                 that fires in due order (ties in creation order) and, like Node, fires an overdue interval once, late, after a stall;
 *   - randomness: Math.random is a seeded generator; crypto.randomBytes (sim.js's seed) is a fixed sequence;
 *   - network:    http.createServer / server.on('upgrade') / listen are captured; requests and upgrades use fake req / res / socket objects;
 *                 a socket that was ended or destroyed is closed (an 'error' first if it was written after end) when the network is flushed;
 *   - console:    captured;
 *   - the sim:    the real sim.js, wrapped so every call server.js makes into it (and into sim.admin) is recorded with a compact summary of
 *                 its arguments and result, and sim.step calls are counted per wake.
 * The scenario (srv_scenarios.js) drives it.  Everything observable (socket bytes as decoded frames, HTTP status / headers / body hash,
 * console lines, timers, sim calls, the order of the pre-existing require() calls) goes to the trace, one JSON array per line, prefixed by the
 * fake time in ms.  Requires of modules that did not exist at the accepted parent go to --struct instead, so an extraction is visible there
 * without making the behavior trace differ. */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module'), crypto = require('crypto'), util = require('util'), http = require('http');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const SRC = fs.readFileSync(ARG.src, 'utf8'), DIR = path.resolve(ARG.dir), SERVER_PATH = path.join(DIR, 'server.js'), SIM_PATH = path.join(DIR, 'sim.js');
const EXISTING_REQUIRES = new Set(['http', 'fs', 'path', 'crypto', 'zlib', './sim.js', './death_srv.js']);   // what server.js required at edd2af9
const REAL = { setTimeout, clearTimeout, setImmediate, now: Date.now, hr: process.hrtime.bigint, stdout: process.stdout.write.bind(process.stdout) };

/* ---------- trace ---------- */
const T0 = 1767225600000;                       // 2026-01-01T00:00:00Z, fake
let NOW = T0;
const LINES = [];
const rel = () => NOW - T0;
const out = (...e) => { LINES.push(JSON.stringify([rel(), ...e])); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const STRUCT = { requires: [], newRequires: [] };

/* ---------- fake clock, hrtime, randomness ---------- */
Date.now = () => NOW;
let HR = 0n; process.hrtime.bigint = () => (HR += 1000000n);
let rs = ARG.seed ? (0x3d0c0de1 + Math.imul(+ARG.seed, 0x9e3779b1)) | 0 : 0x3d0c0de1;
Math.random = () => { rs |= 0; rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let rbN = ARG.seed ? +ARG.seed * 7919 : 0;
crypto.randomBytes = (n, cb) => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (0x5a + rbN * 31 + i * 17) & 255; rbN++; out('crypto.randomBytes', n, b.toString('hex')); if (cb) { cb(null, b); return undefined; } return b; };

/* ---------- fake timers ---------- */
let tseq = 0; const timers = new Map(); let firing = null;
function addTimer(fn, ms, args, rep) {
  const id = ++tseq; ms = +ms; if (!(ms >= 1 && ms <= 2147483647)) ms = 1;
  timers.set(id, { id, fn, ms, args, rep, due: NOW + ms }); out(rep ? 'setInterval' : 'setTimeout', id, ms);
  return { __id: id, unref() { return this; }, ref() { return this; }, hasRef() { return true; }, refresh() { return this; }, [Symbol.toPrimitive]() { return id; } };
}
global.setTimeout = (fn, ms, ...a) => addTimer(fn, ms, a, false);
global.setInterval = (fn, ms, ...a) => addTimer(fn, ms, a, true);
global.clearTimeout = global.clearInterval = t => { const id = t && t.__id; if (id && timers.delete(id)) out('clearTimer', id); };
let steps = 0;
function advance(ms) {
  const end = NOW + ms;
  for (;;) {
    let nx = null;
    for (const t of timers.values()) if (t.due <= end && (!nx || t.due < nx.due || (t.due === nx.due && t.id < nx.id))) nx = t;
    if (!nx) break;
    NOW = Math.max(NOW, nx.due);
    if (nx.rep) nx.due = NOW + nx.ms; else timers.delete(nx.id);
    steps = 0; firing = nx.id; out('fire', nx.id);
    nx.fn(...nx.args);
    firing = null;
    if (steps) out('steps', nx.id, steps);
    flush();
  }
  NOW = end;
}
function stall(ms) { NOW += ms; out('stall', ms); }

/* ---------- console ---------- */
for (const k of ['log', 'error', 'warn', 'info']) console[k] = (...a) => out('console.' + k, util.format(...a));

/* ---------- http ---------- */
let reqHandler = null, upgradeHandler = null; const listens = [];
http.createServer = h => {
  reqHandler = h; out('http.createServer', typeof h);
  const s = { on(ev, fn) { out('server.on', ev); if (ev === 'upgrade') upgradeHandler = fn; return s; },
    listen(port, cb) { out('server.listen', String(port), typeof port); listens.push(port); if (cb) cb(); return s; } };
  return s;
};

/* ---------- sockets ---------- */
const SOCKS = [];
class FakeSock {
  constructor(cid) { this.cid = cid; this.destroyed = false; this.L = {}; this.ended = false; this.destroyCalled = false; this.closed = false; this.writeAfterEnd = false; this.rx = []; this.rbuf = Buffer.alloc(0); SOCKS.push(this); }
  write(d) {
    if (this.ended || this.closed) { this.writeAfterEnd = true; out('sock.writeAfterEnd', this.cid, Buffer.isBuffer(d) ? d.toString('hex') : String(d)); return false; }
    if (typeof d === 'string') { out('sock.write', this.cid, 'text', d); return true; }
    this.rbuf = Buffer.concat([this.rbuf, d]);
    const frames = [];
    while (this.rbuf.length >= 2) {
      let len = this.rbuf[1] & 127, off = 2;
      if (len === 126) { if (this.rbuf.length < 4) break; len = this.rbuf.readUInt16BE(2); off = 4; } else if (len === 127) break;
      if (this.rbuf.length < off + len) break;
      const b0 = this.rbuf[0], pl = this.rbuf.slice(off, off + len); this.rbuf = this.rbuf.slice(off + len);
      frames.push([b0, len, pl.toString('utf8')]);
      if ((b0 & 15) === 1) { try { this.rx.push(JSON.parse(pl.toString('utf8'))); } catch (e) { this.rx.push({ __bad: pl.toString('hex') }); } }
      else this.rx.push({ __op: b0 & 15, __len: len });
    }
    for (const f of frames) out('sock.frame', this.cid, f[0], f[1], f[2]);
    if (!frames.length || this.rbuf.length) out('sock.bytes', this.cid, d.toString('hex'), this.rbuf.length);
    return true;
  }
  end() { out('sock.end', this.cid); this.ended = true; }
  destroy() { out('sock.destroy', this.cid); this.destroyCalled = true; this.destroyed = true; }
  setNoDelay(v) { out('sock.setNoDelay', this.cid, v); return this; }
  on(ev, fn) { out('sock.on', this.cid, ev); (this.L[ev] = this.L[ev] || []).push(fn); return this; }
  emit(ev, ...a) { for (const fn of (this.L[ev] || []).slice()) fn(...a); }
}
function flush() {
  for (const s of SOCKS) {
    if (s.closed || !(s.ended || s.destroyCalled || s.writeAfterEnd)) continue;
    if (s.writeAfterEnd && !s.errored) { s.errored = true; out('net.error', s.cid); s.emit('error', Object.assign(new Error('write after end'), { code: 'ERR_STREAM_WRITE_AFTER_END' })); }
    s.closed = true; s.destroyed = true; out('net.close', s.cid); s.emit('close', false);
  }
}

/* ---------- client side helpers (what a browser would send) ---------- */
function cframe(payload, { op = 1, fin = true, mask = true, key = [0x37, 0xfa, 0x21, 0x3d], len16 = false, len64 = false } = {}) {
  const p = Buffer.isBuffer(payload) ? payload : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const n = p.length, h = [(fin ? 0x80 : 0) | op], m = mask ? 0x80 : 0;
  if (len64) h.push(m | 127, 0, 0, 0, 0, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  else if (n < 126 && !len16) h.push(m | n); else h.push(m | 126, n >> 8, n & 255);
  const k = mask ? Buffer.from(key) : Buffer.alloc(0), body = Buffer.from(p);
  if (mask) for (let i = 0; i < n; i++) body[i] ^= k[i & 3];
  return Buffer.concat([Buffer.from(h), k, body]);
}
let cidN = 0;
function connect(url, { key = 'dGhlIHNhbXBsZSBub25jZQ==', headers = {}, ip = '203.0.113.10', label } = {}) {
  const cid = label || ('c' + (++cidN)), sock = new FakeSock(cid);
  const hd = Object.assign({ host: 'h0.test', upgrade: 'websocket', connection: 'Upgrade', 'sec-websocket-version': '13' }, key === null ? {} : { 'sec-websocket-key': key }, headers);
  out('upgrade', cid, url, Object.keys(hd));
  upgradeHandler({ url, method: 'GET', headers: hd, socket: { remoteAddress: ip } }, sock);
  flush();
  const c = {
    cid, sock, get rx() { return sock.rx; }, get open() { return !!(sock.L.data && !sock.closed); },
    get id() { const h = sock.rx.find(m => m.t === 'hi'); return h ? h.id : null; },
    send(obj, opts) { const b = cframe(obj, opts); out('client.send', cid, b.length); sock.emit('data', b); flush(); return c; },
    raw(buf, note) { out('client.raw', cid, note || '', buf.length); sock.emit('data', buf); flush(); return c; },
    close() { out('client.close', cid); if (!sock.closed) { sock.closed = true; sock.destroyed = true; out('net.close', cid); sock.emit('close', false); } flush(); return c; },
    last(t) { for (let i = sock.rx.length - 1; i >= 0; i--) if (sock.rx[i].t === t) return sock.rx[i]; return null; },
    all(t) { return sock.rx.filter(m => m.t === t); },
  };
  return c;
}
function httpReq(urlPath, { method = 'GET', headers = {}, ip = '198.51.100.20' } = {}) {
  return new Promise(resolve => {
    let done = false;
    const guard = REAL.setTimeout(() => { if (!done) { done = true; out('http.timeout', urlPath); resolve(null); } }, 30000);
    const req = { url: urlPath, method, headers: Object.assign({ host: 'h0.test' }, headers), socket: { remoteAddress: ip } };
    const res = {
      writeHead(status, h) { this.s = status; out('http.head', method, urlPath, status, h === undefined ? null : Object.entries(h)); return this; },
      end(body) {
        if (done) return; done = true; REAL.clearTimeout(guard);
        const b = body === undefined ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
        out('http.end', method, urlPath, b.length, sha(b), b.length <= 160 ? b.toString('latin1') : null);
        resolve({ status: this.s, body: b });
      },
    };
    out('http.req', method, urlPath, Object.entries(req.headers));
    reqHandler(req, res);
  });
}

/* ---------- the sim, wrapped (calls recorded, steps counted) ---------- */
const SIMS = [];
const summ = (v, d = 0) => {
  if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean') return v === undefined ? '~u' : v;
  if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + '…' : v;
  if (typeof v === 'function') return '~fn';
  if (Array.isArray(v)) return d > 1 ? '~arr' + v.length : v.slice(0, 8).map(x => summ(x, d + 1));
  if (typeof v === 'object') { if ('id' in v && 'equipment' in v && 'active' in v) return '~player' + v.id; if (d > 1) return '~obj'; const o = {}; for (const k of Object.keys(v).slice(0, 14)) o[k] = summ(v[k], d + 1); return o; }
  return String(v);
};
function wrapSim(real) {
  const QUIET = new Set(['step']);
  const wrapFn = (name, fn, self) => function (...a) { if (name === 'step') steps++; const r = fn.apply(self, a); if (!QUIET.has(name)) out('sim.' + name, a.map(x => summ(x)), name === 'entities' ? '~e' : summ(r)); return r; };
  const adminP = new Proxy(real.admin, { get(t, k) { const v = t[k]; return typeof v === 'function' ? wrapFn('admin.' + String(k), v, t) : v; } });
  return new Proxy(real, { get(t, k) { if (k === 'admin') return adminP; const v = t[k]; return typeof v === 'function' ? wrapFn(String(k), v, t) : v; } });
}

/* ---------- module loading: record server.js's requires, wrap ./sim.js ---------- */
const origLoad = Module._load;
let realCreateSim = null;
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === SERVER_PATH) {
    const known = EXISTING_REQUIRES.has(request);
    (known ? STRUCT.requires : STRUCT.newRequires).push(request);
    if (known) out('require', request);
    const resolved = Module._resolveFilename(request, parent, isMain);
    if (resolved === SIM_PATH) {
      realCreateSim = origLoad.apply(this, arguments);
      return opts => { out('createSim', summ(opts)); const s = realCreateSim(opts); SIMS.push(s); return wrapSim(s); };
    }
  }
  return origLoad.apply(this, arguments);
};

/* ---------- run ---------- */
async function main() {
  process.env.ADMIN_PASSCODE = 'h0-synthetic-admin';        // synthetic credential: the real default is never used or recorded
  delete process.env.BODY_TTL; delete process.env.PORT;
  if (ARG.bodyttl) process.env.BODY_TTL = ARG.bodyttl;
  process.argv = [process.argv[0], SERVER_PATH, '8123'];
  const scen = require(ARG.scenarios ? path.resolve(ARG.scenarios) : './srv_scenarios.js')[ARG.scenario];
  if (!scen) throw new Error('no scenario ' + ARG.scenario);
  out('load.begin', ARG.scenario);
  const m = new Module(SERVER_PATH, null); m.filename = SERVER_PATH; m.paths = Module._nodeModulePaths(DIR);
  m._compile(SRC, SERVER_PATH);
  out('load.end', Object.keys(m.exports || {}).length);
  const c0 = process.cpuUsage(), w0 = REAL.hr();                                          // --perf: real CPU and wall time of the scenario (kept out of the trace)
  await scen({ out, advance, stall, flush, connect, http: httpReq, cframe, sims: SIMS, note: s => out('note', s), get now() { return rel(); } });
  const c1 = process.cpuUsage(c0), w1 = REAL.hr();
  if (ARG.perf) { const mu = process.memoryUsage(); fs.writeFileSync(ARG.perf, JSON.stringify({ cpuUserMs: c1.user / 1000, cpuSysMs: c1.system / 1000, wallMs: Number(w1 - w0) / 1e6, heapUsedMB: +(mu.heapUsed / 1048576).toFixed(2), rssMB: +(mu.rss / 1048576).toFixed(2) }) + '\n'); }
  out('scenario.end', [...timers.values()].map(t => [t.id, t.ms, t.rep, t.due - T0]));
  fs.writeFileSync(ARG.out, LINES.join('\n') + '\n');
  if (ARG.struct) fs.writeFileSync(ARG.struct, JSON.stringify(STRUCT, null, 1) + '\n');
  REAL.stdout(`ok ${ARG.scenario} ${LINES.length} lines\n`);
  process.exit(0);
}
main().catch(e => { REAL.stdout('HARNESS ERROR ' + (e && e.stack || e) + '\n'); try { fs.writeFileSync(ARG.out, LINES.join('\n') + '\nHARNESS ERROR ' + String(e && e.stack || e) + '\n'); } catch (x) { } process.exit(2); });
