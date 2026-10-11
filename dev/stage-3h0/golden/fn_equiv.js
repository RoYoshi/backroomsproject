/* Stage 3H0 - function-level equivalence of an extracted mp.js helper (development only).
 *
 *   node dev/stage-3h0/golden/fn_equiv.js --target wire|interp|ws|fields [--new FILE] [--old-ref edd2af9] [--cases N] [--out FILE.json]
 *
 * OLD: the functions cut out of the accepted parent's mp.js by their own text (the way dev/tests/interp_test.js already does), evaluated in
 *      a sandbox whose `window` and `performance` are the harness's.
 * NEW: the extracted helper file (assets/net-wire.js / assets/net-interp.js) evaluated in a sandbox with the same `window` and `performance`;
 *      its window.__mpLib entry is used.  Without --new (or before the file exists) NEW is the parent's code again: an A/A run that shows the
 *      harness itself is deterministic.
 * Both are fed the same generated inputs (valid, malformed, missing, wrong types, a missing or partial game API) and their results (or the
 * exception they throw) are compared through a canonical form that tells apart key order, undefined, null, NaN, -0 and prototypes. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..');
const ARG = { 'old-ref': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b', cases: '20000' };
for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const OLDMP = execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':mp.js'], { encoding: 'utf8' });
const canon = v => {
  if (v === undefined) return 'u'; if (v === null) return 'n';
  if (typeof v === 'number') return Object.is(v, -0) ? '#-0' : '#' + String(v);
  if (typeof v === 'string') return JSON.stringify(v); if (typeof v === 'boolean') return String(v); if (typeof v === 'function') return 'fn';
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']' + (Object.keys(v).length !== v.length ? '+' + Object.keys(v).filter(k => !/^\d+$/.test(k)).join('|') : '');
  if (v instanceof Map) return 'Map{' + [...v].map(([k, x]) => canon(k) + '=>' + canon(x)).join(',') + '}';
  if (typeof v === 'object') return (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null ? '' : '~') + '{' + Object.keys(v).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return '?' + String(v);
};
const call = (fn, args) => { try { return 'ok ' + canon(fn(...args)); } catch (e) { return 'throw ' + (e && e.constructor && e.constructor.name) + ': ' + (e && e.message); } };
let seed = 0x3d0f00d; const R = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(R() * a.length)];
const slice = (src, from, to, incl) => { const a = src.indexOf(from); if (a < 0) throw new Error('marker not found: ' + from); const b = src.indexOf(to, a + from.length); if (b < 0) throw new Error('end marker not found: ' + to); return src.slice(a, incl ? b + to.length : b); };

/* ---------- the look / gear / corpse codec ---------- */
function wire() {
  const W = { __api: undefined };
  const oldCode = slice(OLDMP, 'function toRec(b) {', 'function applyBodies()') + '\n' + slice(OLDMP, 'const partList = eq =>', 'function dropAvatar(o)');
  const ctxO = vm.createContext({ window: W, Object, String, Array, Math, Number }); const O = vm.runInContext(oldCode + '\n;({ partList, partObj, parseLook, toRec })', ctxO);
  let N, newFile = null;
  if (ARG.new && fs.existsSync(ARG.new)) { newFile = ARG.new; const ctxN = vm.createContext({ window: W, Object, String, Array, Math, Number }); vm.runInContext(fs.readFileSync(ARG.new, 'utf8'), ctxN, { filename: path.basename(ARG.new) }); N = W.__mpLib.wire; }
  else { const ctxN = vm.createContext({ window: W, Object, String, Array, Math, Number }); N = vm.runInContext(oldCode + "\n;({ partList, partObj, parseLook, toRec, lookStr: L => [L.hat, L.texture, L.hands, L.main, L.backpack].join('|') })", ctxN); }
  const DEFS = { flashlight: [['body'], ['lens'], ['ring']], headlamp: [['strap'], ['lamp'], ['band']], lantern: [['cage'], ['glass'], ['handle'], ['base']], camcorder: [['body'], ['grip'], ['lens']] };
  const DEF = { flashlight: { body: '#ffe7b2', lens: '#333333', ring: '#888888' }, headlamp: { strap: '#222222', lamp: '#ffeecc', band: '#555555' }, lantern: { cage: '#ffaa66', glass: '#222222', handle: '#999999', base: '#444444' }, camcorder: { body: '#202020', grip: '#303030', lens: '#404040' } };
  const APIS = [() => undefined, () => ({}), () => ({ gear: null }), () => ({ gear: { defs: {} } }), () => ({ gear: { defs: DEFS, parts: (eq, k) => Object.assign({}, DEF[k], eq && eq.parts && eq.parts[k]) } }),
    () => ({ gear: { defs: DEFS, parts: (eq, k) => (eq.parts || {})[k] || {} } })];
  const KINDS = ['flashlight', 'headlamp', 'lantern', 'camcorder', 'torch', 'chestlamp', '', undefined, null, 'constructor', '__proto__', 'toString', 42];
  const hex = () => '#' + Array.from({ length: 6 }, () => pick('0123456789abcdefABCDEF')).join('');
  const colour = () => pick([hex, hex, hex, () => '#abc', () => '#12345G', () => 'red', () => '', () => ' ' + hex(), () => hex() + ' ', () => '#1234567'])();
  const partsStr = () => pick([() => Array.from({ length: Math.floor(R() * 7) }, colour).join(','), () => undefined, () => null, () => 7, () => ['#111111', '#222222'], () => '#111111,,#333333', () => ',,'])();
  const LOOKS = ['none|plain|#e6bb76|#ffcc77|none', 'cap|freckles|#e6bb76|#3a6ea5|none', 'hardhat|patched|#e6bb76|#aa3322|utility', 'beanie|stripes|#112233|#445566|canvas', 'crown|plain|x|y|z', '|||', 'a', '', 'a|b', 'a|b|c|d|e|f|g'];
  const look = () => pick([() => pick(LOOKS), () => undefined, () => null, () => 0, () => 1, () => NaN, () => ({}), () => ['cap', 'plain'], () => true, () => pick(LOOKS) + '|extra'])();
  const num = () => pick([() => Math.round(R() * 9000), () => R() * 100 - 50, () => -0, () => NaN, () => 0, () => '12', () => null, () => undefined]);
  const arr = n => Array.from({ length: n }, () => num()());
  const odd = (ok, ...bad) => R() < .88 ? ok() : pick(bad)();          // mostly well-formed (what the server sends), sometimes not
  const body = () => {
    const b = { k: Math.floor(R() * 20), n: pick(['QA', '', undefined, 'N'.repeat(30)]), x: num()(), y: num()(), a: num()(), sx: num()(), sy: num()(), c: pick(['Hound', 'Smiler', 'Vanish', 'x', undefined]), aa: num()(),
      lk: look(), eq: odd(() => ({ kind: pick(KINDS.slice(0, 5)), color: colour(), parts: partsStr() }), () => ({ kind: pick(KINDS), color: colour(), parts: partsStr() }), () => undefined),
      bl: odd(() => pick([[], [arr(3)], [arr(3), arr(3), arr(3)]]), () => undefined, () => [arr(2)]), dr: odd(() => arr(3), () => arr(2), () => undefined), ht: odd(() => arr(3), () => arr(1), () => undefined),
      lo: pick([0, 1, true, undefined]), ph: pick([0, 1, 1, true, undefined]), hd: pick([() => arr(4), () => arr(4), () => arr(3), () => arr(5), () => 0, () => undefined, () => 'abcd'])(), ho: pick([0, 1, undefined]),
      tr: pick([() => [arr(2), arr(2)], () => [], () => 0, () => undefined, () => 'tr'])() };
    if (R() < .05) delete b[pick(Object.keys(b))];
    return b;
  };
  const eqObj = () => pick([() => undefined, () => null, () => ({}), () => ({ kind: pick(KINDS) }), () => ({ kind: pick(KINDS), parts: { [pick(['flashlight', 'lantern', 'headlamp', 'camcorder'])]: { body: colour(), cage: colour(), strap: colour(), lens: colour() } } }), () => ({ kind: 'lantern', color: '#ffaa66', parts: { lantern: { cage: '#ff0000' } } })])();
  /* the look encoder: mp.js wrote the expression inline three times (fxBase, bodyMade, the per-frame p packet); the old side is each of those
   * three expressions cut from the parent's text, the new side lookStr() applied to the same object */
  const expr = (from, to) => slice(OLDMP, from, to, true);
  const site = [['fxBase', 'A', expr('[A.look.hat,', ".join('|')"), A => A.look], ['bodyMade', 't', expr('[t.appearance.hat,', ".join('|')"), t => t.appearance],
    ['p packet', 'w', expr('[window.__api.look.hat,', ".join('|')"), () => W.__api.look]];
  const ctxL = vm.createContext({ window: W });
  const oldSites = site.map(([nm, arg, code]) => [nm, vm.runInContext(`(${arg}) => ${code}`, ctxL)]);
  const lookVal = () => pick([() => 'cap', () => '', () => undefined, () => null, () => 0, () => NaN, () => '#e6bb76', () => ({}), () => [1, 2], () => true, () => 'a|b'])();
  const lookObj = () => R() < .9 ? pick([() => ({ hat: lookVal(), texture: lookVal(), hands: lookVal(), main: lookVal(), backpack: lookVal() }), () => ({ hat: 'cap', texture: 'freckles', hands: '#e6bb76', main: '#3a6ea5', backpack: 'none' }),
    () => ({ main: 'x' }), () => ({ backpack: 'utility', hat: 'hardhat', extra: 1, texture: 'patched', hands: '#e6bb76', main: '#aa3322' })])() : pick([undefined, null, 'string']);
  const res = { target: 'wire', newFile, functions: {}, mismatches: [] };
  const n = +ARG.cases;
  for (const [nm, fn] of oldSites) {
    let same = 0, throws = 0;
    for (let i = 0; i < n; i++) {
      const L = lookObj(), holder = nm === 'fxBase' ? (R() < .9 ? pick([{ look: L }, { look: L, H: {} }]) : {}) : nm === 'bodyMade' ? (R() < .9 ? { appearance: L } : {}) : null;
      W.__api = nm === 'p packet' ? (R() < .9 ? pick([{ look: L }, { look: L, gear: {} }]) : {}) : W.__api;
      const a = call(fn, [holder]), b = call(x => N.lookStr(site.find(q => q[0] === nm)[3](x)), [holder]);
      if (a.startsWith('throw')) throws++;
      if (a === b) same++; else if (res.mismatches.length < 20) res.mismatches.push({ fn: 'lookStr @ ' + nm, args: canon([holder]).slice(0, 300), old: a.slice(0, 300), new: b.slice(0, 300) });
    }
    res.functions['lookStr @ ' + nm] = { cases: n, identical: same, oldThrew: throws };
  }
  for (const [name, gen] of [['parseLook', () => [look()]], ['partObj', () => [pick(KINDS), partsStr()]], ['partList', () => [eqObj()]], ['toRec', () => [body()]]]) {
    let same = 0, throws = 0;
    for (let i = 0; i < n; i++) {
      W.__api = pick(APIS)();
      const args = gen(), a = call(O[name], args), b = call(N[name], args);
      if (a.startsWith('throw')) throws++;
      if (a === b) same++; else if (res.mismatches.length < 20) res.mismatches.push({ fn: name, args: canon(args).slice(0, 300), old: a.slice(0, 300), new: b.slice(0, 300) });
    }
    res.functions[name] = { cases: n, identical: same, oldThrew: throws };
  }
  return res;
}

/* ---------- snapshot interpolation ---------- */
function interp() {
  const P = { now: 0 }, perf = { now: () => P.now };
  const oldCode = slice(OLDMP, 'const NET = {', 'window.__netPose');
  const make = (code, isNew) => {
    const W = {}, ctx = vm.createContext({ window: W, performance: perf, Math, Map, Number, Array });
    if (isNew) { vm.runInContext(code, ctx, { filename: path.basename(ARG.new) }); return W.__mpLib.interp; }
    return vm.runInContext(code + '\n;({ NET, netReset, netHist, netPose })', ctx);
  };
  const newFile = ARG.new && fs.existsSync(ARG.new) ? ARG.new : null;
  const res = { target: 'interp', newFile, streams: 0, steps: 0, identicalSteps: 0, mismatches: [] };
  const state = I => canon({ off: I.NET.off, lastSt: I.NET.lastSt, epoch: I.NET.epoch, DELAY: I.NET.DELAY, hist: I.NET.hist });
  const streams = Math.max(40, Math.round(+ARG.cases / 500));
  for (let s = 0; s < streams; s++) {
    const O = make(oldCode, false), N = newFile ? make(fs.readFileSync(newFile, 'utf8'), true) : make(oldCode, false);
    let epochsO = 0, epochsN = 0; O.NET.onEpoch = () => epochsO++; N.NET.onEpoch = () => epochsN++;
    P.now = 1000 + R() * 5000; let st = R() * 300;
    const ids = ['h1', 'h2', 'm3', 'm4', 'h5'], last = {};
    const away = { id: pick(ids), from: 60 + Math.floor(R() * 80), steps: 95 + Math.floor(R() * 40) };     // one entity leaves for 4.75-6.75 s of server clock (pruning at 5 s)
    for (let k = 0; k < 400; k++) {
      const kind = R();
      let line;
      if (kind < .08 || (kind < .1 && !(s % 4))) { P.now += R() * 80; line = ['pose', pick(ids.concat(['h99']))]; }
      else if (kind < .1 && s % 4) { line = ['reset']; }
      else {
        const r = R(), calm = s % 4 === 0;                                  // a quarter of the streams have no new world at all, so pruning (5 s unseen) can happen
        st = !calm && r < .03 ? st - R() * 2 : !calm && r < .05 ? st + 31 + R() * 20 : r < .08 ? st : st + .05 + (R() - .5) * .02;
        const e = { st: R() < .03 ? undefined : +st.toFixed(3), h: [], m: [] };
        for (const id of ids) {
          if (id === away.id && k >= away.from && k < away.from + away.steps) continue;
          if (R() >= .85) continue;
          const j = R(), base = last[id] !== undefined ? last[id] : 1000 + k * 7;
          const x = j < .05 ? R() * 9000 : j < .08 ? base + pick([299.5, 300.5, -299.5, 300, 299.99]) : 1000 + k * 7 + R() * 5;       // big jumps, and steps right at the 300 px line
          last[id] = x;
          const t = { i: +id.slice(1), x, y: 2000 + (j >= .05 && j < .08 ? 0 : R() * 3), a: R() * 7 - 3.5 }; (id[0] === 'h' ? e.h : e.m).push(t);
        }
        if (R() < .02) delete e.h; if (R() < .02) e.m = undefined;
        P.now += 20 + R() * 60; line = ['hist', e, P.now + (R() - .5) * 30];
      }
      let a, b;
      if (line[0] === 'pose') { a = call(O.netPose, [line[1]]); b = call(N.netPose, [line[1]]); }
      else if (line[0] === 'reset') { a = call(O.netReset, []); b = call(N.netReset, []); }
      else { a = call(O.netHist, [JSON.parse(JSON.stringify(line[1]) || 'null') || line[1], line[2]]); b = call(N.netHist, [JSON.parse(JSON.stringify(line[1]) || 'null') || line[1], line[2]]); }
      const pa = ids.map(id => call(O.netPose, [id])).join(';'), pb = ids.map(id => call(N.netPose, [id])).join(';');
      const sa = state(O) + '|' + epochsO, sb = state(N) + '|' + epochsN;
      res.steps++;
      if (a === b && pa === pb && sa === sb) res.identicalSteps++;
      else if (res.mismatches.length < 20) res.mismatches.push({ stream: s, step: k, op: line[0], old: (a + ' / ' + pa).slice(0, 300), new: (b + ' / ' + pb).slice(0, 300), stateOld: sa.slice(0, 200), stateNew: sb.slice(0, 200) });
    }
    res.streams++;
  }
  return res;
}

/* ---------- server: the raw WebSocket wire (handshake text, outbound frames, the inbound reader) ---------- */
const OLDSRV = () => execFileSync('git', ['-C', REPO, 'show', ARG['old-ref'] + ':server.js'], { encoding: 'utf8' });
function ws() {
  const S = OLDSRV();
  const frameCode = slice(S, 'function frame(str) {', 'const send =');
  const hsExpr = slice(S, "'HTTP/1.1 101 Switching Protocols", "'\\r\\n\\r\\n'", true);
  const readerCode = slice(S, '  let buf = Buffer.alloc(0);\n  sock.on(\'data\'', '  const bye = () =>');
  const mk = () => vm.createContext({ Buffer, crypto: require('crypto'), JSON, Math });
  const O = vm.runInContext(frameCode + `\n;({ frame, handshake: req => ${hsExpr}, register: (sock, onMessage) => { ${readerCode} } })`, mk());
  let N, newFile = null;
  if (ARG.new && fs.existsSync(ARG.new)) { newFile = ARG.new; const m = require(path.resolve(ARG.new)); N = { frame: m.frame, handshake: req => m.handshake(req.headers['sec-websocket-key']), register: (sock, onMessage) => sock.on('data', m.reader(sock, onMessage)) }; }
  else N = vm.runInContext(frameCode + `\n;({ frame, handshake: req => ${hsExpr}, register: (sock, onMessage) => { ${readerCode} } })`, mk());
  const res = { target: 'ws', newFile, functions: {}, mismatches: [] };
  const n = +ARG.cases;
  const str = () => { const L = pick([0, 1, 5, 124, 125, 126, 127, 1000, 65535, 65536, 70000, Math.floor(R() * 300), Math.floor(R() * 66000)]); let t = ''; const al = pick(['ascii', 'utf8', 'mixed']); for (let i = 0; i < L; i++) t += al === 'ascii' ? String.fromCharCode(32 + Math.floor(R() * 90)) : al === 'utf8' ? pick(['é', '✓', '😀', 'a']) : pick(['a', '{', '"', 'é']); return t; };
  { let same = 0; const m = Math.min(n, 3000); for (let i = 0; i < m; i++) { const x = str(), a = call(O.frame, [x]), b = call(N.frame, [x]); if (a === b) same++; else if (res.mismatches.length < 20) res.mismatches.push({ fn: 'frame', len: x.length, old: a.slice(0, 200), new: b.slice(0, 200) }); } res.functions.frame = { cases: m, identical: same }; }
  { let same = 0; for (let i = 0; i < n; i++) { const key = pick([() => 'dGhlIHNhbXBsZSBub25jZQ==', () => require('crypto').randomBytes(16).toString('base64'), () => '', () => undefined, () => 'x'.repeat(Math.floor(R() * 80)), () => 'é✓', () => 42])(); const req = { headers: { 'sec-websocket-key': key } }; const a = call(O.handshake, [req]), b = call(N.handshake, [req]); if (a === b) same++; else if (res.mismatches.length < 20) res.mismatches.push({ fn: 'handshake', key, old: a.slice(0, 200), new: b.slice(0, 200) }); } res.functions.handshake = { cases: n, identical: same }; }
  /* the reader: random byte streams of frames (valid and not), cut into random chunks, fed to both; every effect recorded in order */
  const cfr = (payload, { op = 1, fin = true, mask = true, len16 = false, len64 = false, key } = {}) => {
    const p = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)); const nn = p.length, h = [(fin ? 0x80 : 0) | op], mm = mask ? 0x80 : 0;
    if (len64) h.push(mm | 127, 0, 0, 0, 0, (nn >>> 24) & 255, (nn >> 16) & 255, (nn >> 8) & 255, nn & 255); else if (nn < 126 && !len16) h.push(mm | nn); else h.push(mm | 126, nn >> 8, nn & 255);
    const k = mask ? Buffer.from(key || [Math.floor(R() * 256), Math.floor(R() * 256), Math.floor(R() * 256), Math.floor(R() * 256)]) : Buffer.alloc(0), body = Buffer.from(p);
    if (mask) for (let i = 0; i < nn; i++) body[i] ^= k[i & 3]; return Buffer.concat([Buffer.from(h), k, body]);
  };
  const msg = () => pick([() => JSON.stringify({ t: 'p', x: Math.floor(R() * 9000), y: 3 }), () => JSON.stringify({ t: 'boom' }), () => '{"t":', () => 'null', () => '[1,2]', () => '"s"', () => '42', () => JSON.stringify({ t: 'ping', pad: 'x'.repeat(Math.floor(R() * 1500)) }), () => JSON.stringify({ t: 'x', u: 'é😀' })])();
  const piece = () => pick([() => cfr(msg()), () => cfr(msg()), () => cfr(msg(), { len16: true }), () => cfr('hi', { op: 9 }), () => cfr('', { op: 10 }), () => cfr(Buffer.from([1, 2, 3]), { op: 2 }), () => cfr(msg(), { op: 0 }), () => cfr(msg(), { fin: false }),
    () => cfr(msg(), { mask: false }), () => cfr('', { op: 8 }), () => cfr(msg(), { len64: true }), () => Buffer.from([0x81]), () => cfr('x'.repeat(1399)), () => cfr('x'.repeat(1400))])();
  let same = 0; const runs = Math.max(200, Math.round(n / 20));
  for (let r = 0; r < runs; r++) {
    const parts = []; const k = 1 + Math.floor(R() * 8); for (let i = 0; i < k; i++) { if (R() < .03 && r % 5) break; parts.push(piece()); }
    const all = Buffer.concat(parts), cuts = []; let at = 0; while (at < all.length) { const c = Math.max(1, Math.floor(R() * (R() < .3 ? 4 : 400))); cuts.push(all.slice(at, at + c)); at += c; }
    const effects = impl => { const ev = []; const sock = { on(e, fn) { ev.push('on ' + e); this.h = fn; }, write(b) { ev.push('write ' + Buffer.from(b).toString('hex')); return true; }, end() { ev.push('end'); }, destroy() { ev.push('destroy'); } };
      impl.register(sock, m => { ev.push('msg ' + canon(m)); if (m && m.t === 'boom') throw new Error('handler threw'); });
      for (const c of cuts) { try { const rv = sock.h(Buffer.from(c)); if (rv !== undefined) ev.push('ret ' + typeof rv); } catch (e) { ev.push('threw ' + e.message); } }
      return ev.join('\n'); };
    const a = effects(O), b = effects(N);
    if (a === b) same++; else if (res.mismatches.length < 20) res.mismatches.push({ fn: 'reader', run: r, old: a.slice(0, 300), new: b.slice(0, 300) });
  }
  res.functions.reader = { streams: runs, identical: same };
  return res;
}

/* ---------- server: inbound field validation ---------- */
function fields() {
  const S = OLDSRV(), code = slice(S, 'const num = (v, lo, hi)', 'function getRoom(');
  const O = vm.runInContext(code + '\n;({ num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook })', vm.createContext({ Math, String, Array }));
  let N, newFile = null;
  if (ARG.new && fs.existsSync(ARG.new)) { newFile = ARG.new; N = require(path.resolve(ARG.new)); }
  else N = vm.runInContext(code + '\n;({ num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook })', vm.createContext({ Math, String, Array }));
  const res = { target: 'fields', newFile, functions: {}, mismatches: [] };
  const n = +ARG.cases;
  const any = () => pick([() => Math.floor(R() * 20000) - 5000, () => R() * 100, () => -0, () => NaN, () => Infinity, () => -Infinity, () => '12', () => '1e3', () => 'abc', () => '', () => null, () => undefined, () => true, () => [], () => [7], () => ({}), () => '0x1f', () => ' 5 '])();
  const hex = () => '#' + Array.from({ length: pick([3, 6, 6, 6, 7]) }, () => pick('0123456789abcdefABCDEFg')).join('');
  const lookStr = () => pick([() => [pick(['none', 'cap', 'beanie', 'hardhat', 'crown', '']), pick(['plain', 'freckles', 'stripes', 'patched', 'x']), hex(), hex(), pick(['none', 'canvas', 'utility', 'bag'])].join('|'),
    () => 'none|plain|#e6bb76|#ffcc77|none', () => 'cap|freckles|#e6bb76|#3a6ea5|none|extra', () => 'cap|freckles', () => any()])();
  const parts = () => pick([() => Array.from({ length: Math.floor(R() * 7) }, hex).join(','), () => any(), () => '#111111,#222222,#333333', () => ',,'])();
  const cases = { num: () => [any(), pick([0, -500, -20, .5]), pick([9216, 6912, 500, 20, 1.6])], kindOf: () => [pick(['flashlight', 'headlamp', 'lantern', 'camcorder', 'chestlamp', 'torch', 'rocket', '', 'constructor', '__proto__', 'toString', undefined, null, 3])],
    cleanParts: () => [parts()], cleanLook: () => [lookStr()], 'HEX.test': () => [pick([hex(), any(), '#e6bb76', '#E6BB76', ' #e6bb76', '#e6bb76 '])] };
  for (const [name, gen] of Object.entries(cases)) {
    let same = 0;
    for (let i = 0; i < n; i++) { const args = gen(); const f = o => name === 'HEX.test' ? (x => o.HEX.test(x)) : o[name]; const a = call(f(O), args), b = call(f(N), args); if (a === b) same++; else if (res.mismatches.length < 20) res.mismatches.push({ fn: name, args: canon(args), old: a, new: b }); }
    res.functions[name] = { cases: n, identical: same };
  }
  const k1 = canon(O.DEFAULT_LOOK), k2 = canon(N.DEFAULT_LOOK); res.functions.DEFAULT_LOOK = { identical: k1 === k2 ? 1 : 0 }; if (k1 !== k2) res.mismatches.push({ fn: 'DEFAULT_LOOK', old: k1, new: k2 });
  res.functions['HEX source'] = { identical: String(O.HEX) === String(N.HEX) ? 1 : 0 }; if (String(O.HEX) !== String(N.HEX)) res.mismatches.push({ fn: 'HEX source', old: String(O.HEX), new: String(N.HEX) });
  return res;
}

const res = ARG.target === 'interp' ? interp() : ARG.target === 'ws' ? ws() : ARG.target === 'fields' ? fields() : wire();
res.tool = 'dev/stage-3h0/golden/fn_equiv.js'; res.oldRef = ARG['old-ref']; res.ok = !res.mismatches.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(Object.assign({}, res, { mismatches: res.mismatches.length }), null, 1));
if (res.mismatches.length) console.log('first mismatch: ' + JSON.stringify(res.mismatches[0]));
process.exitCode = res.ok ? 0 : 1;
