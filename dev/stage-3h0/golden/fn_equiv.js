/* Stage 3H0 - function-level equivalence of an extracted mp.js helper (development only).
 *
 *   node dev/stage-3h0/golden/fn_equiv.js --target wire|interp [--new FILE] [--old-ref edd2af9] [--cases N] [--out FILE.json]
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
    const ids = ['h1', 'h2', 'm3', 'm4', 'h5'];
    for (let k = 0; k < 400; k++) {
      const kind = R();
      let line;
      if (kind < .08) { P.now += R() * 80; line = ['pose', pick(ids.concat(['h99']))]; }
      else if (kind < .1) { line = ['reset']; }
      else {
        const r = R(); st = r < .03 ? st - R() * 2 : r < .05 ? st + 31 + R() * 20 : r < .08 ? st : st + .05 + (R() - .5) * .02;
        const e = { st: R() < .03 ? undefined : +st.toFixed(3), h: [], m: [] };
        for (const id of ids) if (R() < .85) { const t = { i: +id.slice(1), x: R() < .05 ? R() * 9000 : 1000 + k * 7 + R() * 5, y: 2000 + R() * 3, a: R() * 7 - 3.5 }; (id[0] === 'h' ? e.h : e.m).push(t); }
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

const res = ARG.target === 'interp' ? interp() : wire();
res.tool = 'dev/stage-3h0/golden/fn_equiv.js'; res.oldRef = ARG['old-ref']; res.ok = !res.mismatches.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(Object.assign({}, res, { mismatches: res.mismatches.length }), null, 1));
if (res.mismatches.length) console.log('first mismatch: ' + JSON.stringify(res.mismatches[0]));
process.exitCode = res.ok ? 0 : 1;
