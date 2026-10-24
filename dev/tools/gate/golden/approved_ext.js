/* Trial 3 R20, the B++ killer-identity branch (development only; never served): the one approved extension of the B++ protocol, as the
 * golden comparators allow it.  Historical B++ evidence (the stored traces and hashes) is never rewritten: a trace of this tree is compared
 * with it after the extension, and only the extension, is taken out again.
 *
 * The extension (dev/stage-3h/gate/protocol_bpp.json, approvedExtensions): a Hound's or a Smiler's death replay message
 * {t:'fx', k:'death', id, c, ...} carries e, the server's entity id of its killer, as a positive safe integer placed right after c.
 * Nothing else changes on the wire: no other field, no other order, no other message, no other time.
 *
 *   srvLine(line)            a server trace line (srv_harness.js): when it is a socket frame whose payload is that message with e, the
 *                            line as B++ would have written it (e removed, the frame's length field less the bytes removed) and how many
 *                            e fields were removed (0 or 1); any other line is returned as it is, with 0.
 *   srvCompare(base, now)    two server traces (text): equal line for line once srvLine has been applied to `now`; the lines it changed
 *   cliCompare(old, now)     two client traces (JSON text: B++'s page and this tree's, or a stored B++ baseline and this tree's): what the
 *                            extension changes on a page, and nothing else.  B++'s page hid the Hound (or Smiler) nearest the attacker's
 *                            place while a replay played; this tree's hides only the killer the message names, and none when the message
 *                            names none.  The B++ scenes' messages name none (they are B++'s), so this tree's page hides fewer:
 *                              - with the hidden-slot lists (state fk / fs; fxstate's 5th and 6th items) replaced by a marker when they
 *                                are lists of distinct slots, and B++'s state entries that then repeat the one before dropped (B++'s page
 *                                logged them because only its hidden slots changed; this tree's side is not thinned), the traces must be
 *                                equal entry for entry, times included;
 *                              - at every entry either trace sets the slots, in trace order, this tree's Hound slots and Smiler slots in
 *                                force must equal B++'s, or be none where B++ hid some, a Hound (for fk) or Smiler (for fs) death replay
 *                                without a valid e having been received in the 6 s before (a replay hides only while it plays: 4.7 s).
 *                            Anything else - another field, more hidden, a difference with no such message - is a difference.
 *   selfTest()               the allowance against mutants of itself: e misplaced, e on another message or species, e not a positive
 *                            integer, a wrong frame length, a second field, another field changed; and the client rules likewise.
 *                            Run: node dev/tools/gate/golden/approved_ext.js --self-test [--baseline-dirs DIR,DIR] */
'use strict';
const SPECIES = 'Hound|Smiler';
// the payload as srv_harness.js writes it: a JSON string inside the JSON line, so its quotes are escaped (\")
const FRAME = /^(\[[^,\[\]]+,"sock\.frame","[^"\\]*",\d+,)(\d+)(,")(.*)("\])$/;
const HEAD = new RegExp('^(\\{\\\\"t\\\\":\\\\"fx\\\\",\\\\"k\\\\":\\\\"death\\\\",\\\\"id\\\\":-?\\d+,\\\\"c\\\\":\\\\"(?:' + SPECIES + ')\\\\"),\\\\"e\\\\":([1-9]\\d{0,15})(,\\\\"x\\\\":)');
function srvLine(line) {
  const m = FRAME.exec(line); if (!m) return { line, n: 0 };
  const h = HEAD.exec(m[4]); if (!h) return { line, n: 0 };
  const e = Number(h[2]); if (!Number.isSafeInteger(e)) return { line, n: 0 };
  const rest = m[4].slice(h[0].length);
  if (/\\"e\\":/.test(rest)) return { line, n: 0 };                              // (a second e anywhere: not the extension)
  const removed = Buffer.byteLength(',"e":' + h[2]);                              // (the frame's length counts the payload's own bytes)
  return { line: m[1] + (Number(m[2]) - removed) + m[3] + h[1] + h[3] + rest + m[5], n: 1 };
}
function srvCompare(base, now) {
  const B = String(base).split('\n'), N = String(now).split('\n'), applied = [], unexpected = [];
  if (B.length !== N.length) return { equal: false, applied, unexpected: [{ line: 0, why: `${B.length} lines against ${N.length}` }] };
  for (let i = 0; i < N.length; i++) {
    if (B[i] === N[i]) continue;
    const r = srvLine(N[i]);
    if (r.n && r.line === B[i]) applied.push(i + 1);
    else { unexpected.push({ line: i + 1, baseline: B[i].slice(0, 400), now: N[i].slice(0, 400) }); if (unexpected.length > 5) break; }
  }
  return { equal: !unexpected.length, applied, unexpected };
}
/* ---------- the client ---------- */
const validE = e => Number.isSafeInteger(e) && e > 0;
const slots = v => Array.isArray(v) && v.every(x => Number.isSafeInteger(x) && x >= 0) && new Set(v).size === v.length;   // a list of distinct slot numbers
const isState = x => x[1] === 'state' && x[2] && typeof x[2] === 'object' && !Array.isArray(x[2]);
/* an entry with its hidden-slot lists replaced by a marker - kept only when they are well formed, so a missing key, a null, a number or a
 * repeated slot stays a difference */
function strip(x) {
  if (isState(x)) { const o = Object.assign({}, x[2]); for (const k of ['fk', 'fs']) if (k in o && slots(o[k])) o[k] = '<slots>'; return [x[0], x[1], o].concat(x.slice(3)); }
  if (x[1] === 'fxstate') { const y = x.slice(); for (const k of [4, 5]) if (slots(y[k])) y[k] = '<slots>'; return y; }
  return x;
}
const vals = x => isState(x) ? [x[2].fk, x[2].fs] : x[1] === 'fxstate' ? [x[4], x[5]] : null;   // [Hound slots, Smiler slots], or null
function noIdReplays(A) {                                                         // [t, species] for each Hound / Smiler replay received without a valid e
  const out = [];
  for (const x of A) {
    if (x[1] !== 'ws.recv' || typeof x[3] !== 'string' || x[3].indexOf('"death"') < 0) continue;
    let m; try { m = JSON.parse(x[3]); } catch (e) { continue; }
    if (m && m.t === 'fx' && m.k === 'death' && (m.c === 'Hound' || m.c === 'Smiler') && !validE(m.e)) out.push([x[0], m.c]);
  }
  return out;
}
function cliCompare(oldText, nowText) {
  const A = JSON.parse(oldText), B = JSON.parse(nowText), why = [];
  // the two traces side by side.  An entry of B++'s may be passed over only when it is a state entry that repeats B++'s state before it
  // but for its hidden slots (B++'s page logged it because only those changed; this tree's page, hiding none, logs nothing then).  No
  // entry of this tree's may be passed over: one B++ did not log is a difference
  const pairs = []; let lastA = null;
  let i = 0, j = 0;
  for (; j < A.length && why.length < 4; j++) {
    const a = strip(A[j]), ka = isState(A[j]) ? JSON.stringify(a.slice(2)) : null;
    if (i < B.length && JSON.stringify(a) === JSON.stringify(strip(B[i]))) { pairs.push([j, i]); i++; }
    else if (ka !== null && ka === lastA) pairs.push([j, -1]);
    else why.push(`B++ entry ${j} / this tree's ${i}: ${JSON.stringify(A[j]).slice(0, 240)} | ${JSON.stringify(B[i] || null).slice(0, 240)}`);
    if (ka !== null) lastA = ka;
  }
  if (!why.length && i !== B.length) why.push(`this tree has ${B.length - i} entries more, from entry ${i}: ${JSON.stringify(B[i]).slice(0, 240)}`);
  const replays = noIdReplays(B);
  if (JSON.stringify(replays) !== JSON.stringify(noIdReplays(A))) why.push('the replay messages received differ');
  let differing = 0;
  if (!why.length) {
    // every entry either page sets its hidden slots, in trace order: this tree's value in force against B++'s.  Equal, or this tree hides
    // none where B++ hid its guess, a Hound (Smiler) replay without an id having been received in the 6 s before
    const judge = (o, n, t, where) => {
      for (const [k, sp] of [[0, 'Hound'], [1, 'Smiler']]) {
        const ov = slots(o[k]) ? o[k] : [], nv = n[k];
        if (!slots(nv)) { why.push(`${where} at ${t}: ${sp} slots not a list of distinct slots: ${JSON.stringify(nv)}`); continue; }
        if (nv.length === ov.length && nv.every(x => ov.includes(x))) continue;
        differing++;
        if (nv.length) why.push(`${where} at ${t}: this tree hides ${sp} slots ${JSON.stringify(nv)}, B++ ${JSON.stringify(ov)} (an id-less replay hides none)`);
        else if (!replays.some(r => r[1] === sp && r[0] <= t && t - r[0] <= 6000)) why.push(`${where} at ${t}: ${sp} slots none against B++'s ${JSON.stringify(ov)}, with no ${sp} replay without an id received in the 6 s before`);
      }
    };
    const nowAt = { state: [[], []], fxstate: [[], []] };
    for (const [ja, ib] of pairs) {
      const a = A[ja], va = vals(a); if (!va) continue;
      const kind = isState(a) ? 'state' : 'fxstate';
      if (ib >= 0) nowAt[kind] = vals(B[ib]);
      judge(va, nowAt[kind], a[0], ib >= 0 ? kind : kind + ' (B++ only)');
      if (why.length > 8) break;
    }
  }
  return { equal: !why.length, differing, replaysWithoutId: replays.length, why };
}
/* ---------- the self-test ---------- */
function selfTest(dirs) {
  const fs = require('fs'), path = require('path'), zlib = require('zlib'), res = [];
  const ok = (name, cond, note) => { res.push({ name, ok: !!cond, note: note || '' }); };
  // server: every B++ death replay line, with e put in as the server now writes it, must come back to B++'s line; each mutant must not
  const lines = [];
  for (const d of dirs) for (const f of fs.readdirSync(d).filter(x => x.endsWith('.jsonl.gz'))) for (const l of zlib.gunzipSync(fs.readFileSync(path.join(d, f))).toString('utf8').split('\n')) if (/"sock\.frame"/.test(l) && /\\"k\\":\\"death\\"/.test(l) && /\\"t\\":\\"fx\\"/.test(l)) lines.push(l);
  const withE = (l, e, at) => { const m = FRAME.exec(l), p = m[4], i = at === 'c' ? p.indexOf(',\\"x\\":') : p.indexOf(',\\"y\\":'); return m[1] + (Number(m[2]) + Buffer.byteLength(',"e":' + e)) + m[3] + p.slice(0, i) + ',\\"e\\":' + e + p.slice(i) + m[5]; };
  ok('server: the baselines hold death replay lines', lines.length > 0, lines.length + ' lines');
  let back = 0; for (const l of lines) if (srvCompare(l, withE(l, 6, 'c')).equal && srvLine(withE(l, 6, 'c')).n === 1) back++;
  ok('server: each B++ replay line with e after c (the approved extension) compares equal', back === lines.length, `${back} of ${lines.length}`);
  ok('server: a line without e is left as it is', lines.every(l => srvLine(l).line === l && srvLine(l).n === 0));
  const l0 = lines.find(l => /\\"c\\":\\"Hound\\"/.test(l)) || lines[0];
  const M = [
    ['e after x (another place)', withE(l0, 6, 'x')],
    ['e = 0', withE(l0, 6, 'c').replace(',\\"e\\":6', ',\\"e\\":0')],
    ['e a string', withE(l0, 6, 'c').replace(',\\"e\\":6', ',\\"e\\":\\"6\\"')],
    ['e negative', withE(l0, 6, 'c').replace(',\\"e\\":6', ',\\"e\\":-6')],
    ['e fractional', withE(l0, 6, 'c').replace(',\\"e\\":6', ',\\"e\\":6.5')],
    ['the frame length not changed with it', (() => { const m = FRAME.exec(withE(l0, 6, 'c')); return m[1] + (Number(m[2]) - 6) + m[3] + m[4] + m[5]; })()],
    ['a second field beside e', withE(l0, 6, 'c').replace(',\\"e\\":6', ',\\"e\\":6,\\"q\\":1')],
    ['e twice', withE(l0, 6, 'c').replace(',\\"e\\":6', ',\\"e\\":6,\\"e\\":6')],
    ['another field changed (x)', withE(l0, 6, 'c').replace(/\\"x\\":(\d+)/, (s, v) => '\\"x\\":' + (Number(v) + 1))],
    ['another species (c: SkinStealer, not in the B++ traces)', withE(l0, 6, 'c').replace('\\"c\\":\\"Hound\\"', '\\"c\\":\\"SkinStealer\\"')],
    ['e on another message (k: end)', withE(l0, 6, 'c').replace('\\"k\\":\\"death\\"', '\\"k\\":\\"end\\"')],
  ];
  for (const [name, l] of M) ok('server mutant caught: ' + name, !srvCompare(l0, l).equal);
  ok('server mutant caught: a line added', !srvCompare(l0, l0 + '\n' + l0).equal);
  // client: a page trace where a Hound replay without an id plays; B++ hides slot 0, this tree none
  const msg = id => JSON.stringify({ t: 'fx', k: 'death', id, c: 'Hound', x: 1, y: 1, sx: 2, sy: 2 });
  const T = (fk, extra) => JSON.stringify([[0, 'loaded', {}], [10, 'ws.recv', 1, msg(8)], [20, 'state', { on: true, fk: [], fs: [] }], [30, 'state', { on: true, fk, fs: [] }], [40, 'fxstate', [[8, 'death']], [], fk, [], 8], [50, 'set', 'x', 1]].concat(extra || []));
  const B0 = T([0]);
  ok('client: B++ hides the nearest slot 0, this tree none (the approved policy)', cliCompare(B0, T([])).equal);
  ok('client: identical traces', cliCompare(B0, B0).equal);
  ok('client mutant caught: this tree hides another slot', !cliCompare(B0, T([1])).equal);
  ok('client mutant caught: this tree hides more', !cliCompare(B0, T([0, 1])).equal);
  ok('client mutant caught: another entry changed', !cliCompare(B0, T([], [[60, 'set', 'y', 2]])).equal);
  ok('client mutant caught: another state field changed', !cliCompare(B0, B0.replace('"on":true,"fk":[0]', '"on":false,"fk":[0]')).equal);
  const noMsg = s => JSON.stringify(JSON.parse(s).map(x => x[1] === 'ws.recv' ? [x[0], 'ws.recv', 1, '{"t":"x"}'] : x));
  ok('client mutant caught: fewer hidden with no replay without an id to explain it', !cliCompare(noMsg(B0), noMsg(T([]))).equal);
  const withId = s => JSON.stringify(JSON.parse(s).map(x => x[1] === 'ws.recv' ? [x[0], 'ws.recv', 1, JSON.stringify(Object.assign(JSON.parse(x[3]), { e: 31 }))] : x));
  ok('client mutant caught: fewer hidden although the replay names its killer', !cliCompare(withId(B0), withId(T([]))).equal);
  ok('client mutant caught: the received messages differ', !cliCompare(B0, withId(T([0]))).equal);
  const P = s => JSON.parse(s), S = v => JSON.stringify(v);
  const N0 = P(T([])).filter((x, i, L) => !(x[1] === 'state' && i > 0 && JSON.stringify(x.slice(2)) === JSON.stringify(L.slice(0, i).filter(y => y[1] === 'state').slice(-1)[0] ? L.slice(0, i).filter(y => y[1] === 'state').slice(-1)[0].slice(2) : null)));
  ok('client: this tree logging no state for a slot-only change (as the page does)', cliCompare(B0, S(N0)).equal);
  ok('client mutant caught: an extra state entry, a copy of the one before, later', !cliCompare(B0, S(P(T([])).concat([[90, 'state', { on: true, fk: [], fs: [] }]]))).equal);
  ok('client mutant caught: an extra state entry right after the first', !cliCompare(B0, S((L => { L.splice(3, 0, [21, 'state', { on: true, fk: [], fs: [] }]); return L; })(P(T([]))))).equal);
  ok('client mutant caught: another slot hidden, overwritten at the same moment', !cliCompare(B0, S((L => { L.splice(2, 0, [20, 'state', { on: true, fk: [5], fs: [] }]); return L; })(P(T([]))))).equal);
  ok('client mutant caught: the slot lists left out', !cliCompare(B0, S(P(T([])).map(x => x[1] === 'state' ? [x[0], 'state', { on: true }] : x))).equal);
  ok('client mutant caught: the slot lists null / false', !cliCompare(B0, S(P(T([])).map(x => x[1] === 'state' ? [x[0], 'state', { on: true, fk: null, fs: false }] : x))).equal);
  ok('client mutant caught: fxstate slot items 0 / null', !cliCompare(B0, S(P(T([])).map(x => x[1] === 'fxstate' ? x.slice(0, 4).concat([0, null], x.slice(6)) : x))).equal);
  ok('client mutant caught: a repeated slot', !cliCompare(B0, B0.replace(/"fk":\[0\]/g, '"fk":[0,0]')).equal);
  ok('client mutant caught: a slot list of the wrong type (an object)', !cliCompare(B0, S(P(T([])).map(x => x[1] === 'state' ? [x[0], 'state', { on: true, fk: {}, fs: [] }] : x))).equal);
  ok('client mutant caught: some of B++\'s hidden slots kept (an id-less replay hides none)', !cliCompare(T([0, 1]), T([1])).equal);
  return { ok: res.every(r => r.ok), checks: res };
}
module.exports = { srvLine, srvCompare, cliCompare, selfTest };
if (require.main === module && process.argv.includes('--self-test')) {
  const path = require('path'), REPO = path.resolve(__dirname, '..', '..', '..', '..');
  const i = process.argv.indexOf('--baseline-dirs');
  const dirs = i > 0 ? process.argv[i + 1].split(',') : [path.join(REPO, 'dev', 'stage-3h', 'evidence', 'h1', 'golden', 'srv_traces'), path.join(REPO, 'dev', 'stage-3h', 'evidence', 'h2', 'golden', 'bpp_traces')];
  const R = selfTest(dirs);
  for (const c of R.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.note ? ' (' + c.note + ')' : ''}`);
  console.log(`approved extension (e), self-test: ${R.ok ? 'PASS' : 'FAIL'} (${R.checks.filter(c => c.ok).length}/${R.checks.length})`);
  process.exitCode = R.ok ? 0 : 1;
}
