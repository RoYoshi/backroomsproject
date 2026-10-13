/* Stage 3D HQ2 - 3H0's read-only protocol contract, with Stage 3D's death fields and HQ2's wire changes, against HQ2's traces
 * (development only).
 *
 *   node dev/stage-3d-hq2/contract_hq2.js --srv DIR --cli DIR [--raw FILE.jsonl] [--out FILE.json]
 *
 * DIR: golden_hq2.js --keep and cli_golden_hq2.js --keep folders; only the working tree's traces (*.new.*) are read.  The 3H0 scenarios
 * never press NEW RUN, so --raw adds wire_capture.js's messages (both ways, from a real server: nr, nra, the blast, world, fx end, tp pc).  Every message the
 * server sends and every message mp.js sends is checked as dev/stage-3d/contract_check3d.js checks it (type listed, required fields
 * present, no field the contract does not list, the contract's field order; a snapshot's player and entity fields exactly), against
 * dev/stage-3h0/protocol_contract.json (not changed) plus:
 *   Stage 3D's additions, as contract_check3d.js lists them: fx de, lo, lf, el; the fx 'end' message (t, k, id, de);
 *   HQ2's (STAGE_3D_HQ2_AUDIT.md D5, with H2-5's correction - the world's number on an fx is `wn`: the fx's `w` was already the Hound
 *   C wall in the 3H0 contract):
 *     server -> client  fx (a death): wn (the world's number, after 3D's de), optional; fx 'boom' (new): a death replay's fields without
 *                       the attacker's (no c, sx, sy, v, w, ex), plus d and s (the blast's direction and seed), de, wn, lo, lf?, el?;
 *                       fx 'end': wn;  s: w (after cp);  bodies: w (after v);  tp: pc (a soft peer correction), optional;
 *                       new types: nra {t, q, ok, why?, wait?, de?, w?} and world {t, w, x?, y?}
 *     client -> server  new type: nr {t, q, w};  removed: fx and b (the old NEW RUN vanish; the server ignores both) - mp.js must not
 *                       send either
 * Exit 0 when nothing violates the contract with these additions and the client sends no fx or b. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const C = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'stage-3h0', 'protocol_contract.json'), 'utf8'));
const S = C.serverToClient, K = C.clientToServer, opt = (k, what) => [k, what, 'optional'];
const after = (fields, key, add) => { const i = fields.findIndex(f => f[0] === key); return fields.slice(0, i + 1).concat(add, fields.slice(i + 1)); };
const ADD = {
  fx3d: [opt('de', 'death id'), opt('lo', 'the light was on'), opt('lf', 'HQ1: how the light fails'), opt('el', 'seconds already run (late joiner)')],
  fxWorld: [opt('wn', 'HQ2: the world\'s number')],
  s: [opt('w', 'HQ2: the world\'s number')], bodies: [opt('w', 'HQ2: the world\'s number')], tp: [opt('pc', 'HQ2: a soft peer correction')]
};
S.fx.fields = after(S.fx.fields.concat(ADD.fx3d), 'de', ADD.fxWorld);
S.s.fields = after(S.s.fields, 'cp', ADD.s); S.bodies.fields = after(S.bodies.fields, 'v', ADD.bodies); S.tp.fields = S.tp.fields.concat(ADD.tp);
const END = { fields: [['t', 'type'], ['k', 'end'], ['id', 'victim id'], ['de', 'death id'], opt('wn', 'HQ2: the world\'s number')] };
const BOOM = { fields: [['t'], ['k', 'boom'], ['id'], ['x'], ['y'], ['a'], ['d', 'direction'], ['s', 'seed'], ['lk'], ['ek'], ['ec'], ['ep'], ['vx'], ['vy'], ['srv'], ['de'], ['wn'], ['lo'], opt('lf'), opt('el')] };   // HQ2 (D5): a death replay's fields without the attacker's, plus the blast's direction and seed
S.nra = { fields: [['t'], ['q'], ['ok'], opt('why'), opt('wait'), opt('de'), opt('w')] };
S.world = { fields: [['t'], ['w'], opt('x'), opt('y')] };
K.nr = { fields: [['t'], ['q'], ['w']] };
const REMOVED = new Set(['fx', 'b']);                                    // client -> server: still in the 3H0 file, never sent by HQ2's mp.js
const stats = { serverToClient: {}, clientToServer: {} }, bad = [];
function check(dir, m, where) {
  const spec = dir === 'serverToClient' && m.t === 'fx' && m.k === 'end' ? END : dir === 'serverToClient' && m.t === 'fx' && m.k === 'boom' ? BOOM : C[dir][m.t];
  const key = m.t === 'fx' ? 'fx:' + m.k : m.t; stats[dir][key] = (stats[dir][key] || 0) + 1;
  if (dir === 'clientToServer' && REMOVED.has(m.t)) { bad.push({ where, why: 'HQ2 removed this client message (the old NEW RUN vanish)', t: m.t, k: m.k, c: m.c }); return; }
  if (!spec) { bad.push({ where, why: 'type not in the contract', t: m.t }); return; }
  const order = spec.fields.map(f => f[0]), req = spec.fields.filter(f => f[2] !== 'optional').map(f => f[0]), ks = Object.keys(m);
  for (const k of ks) if (!order.includes(k)) bad.push({ where, why: 'field not in the contract', t: m.t, k });
  for (const k of req) if (!ks.includes(k)) bad.push({ where, why: 'required field missing', t: m.t, k });
  const pos = ks.filter(k => order.includes(k)).map(k => order.indexOf(k));
  if (pos.some((p, i) => i && p < pos[i - 1])) bad.push({ where, why: 'field order differs from the contract', t: m.t, keys: ks.join(',') });
  if (m.t === 'fx' && m.k === 'death' && !(m.w === 0 || (Array.isArray(m.w) && m.w.length === 3))) bad.push({ where, why: 'a death replay whose w is not its wall (0, or [x, y, angle] for Hound C: death_srv.fxFor)', w: m.w });
  if (m.t === 's' && spec.peer) {
    const po = spec.peer.map(f => f[0]), eo = spec.e.map(f => f[0]);
    for (const p of m.p || []) if (Object.keys(p).join(',') !== po.join(',')) bad.push({ where, why: 'peer fields differ from the contract', keys: Object.keys(p).join(',') });
    if (m.e && Object.keys(m.e).join(',') !== eo.join(',')) bad.push({ where, why: 'entity block fields differ from the contract', keys: Object.keys(m.e).join(',') });
  }
}
const files = (d, re) => fs.readdirSync(d).filter(f => re.test(f)).map(f => path.join(d, f));
if (ARG.srv) for (const f of files(ARG.srv, /\.new\.jsonl$/)) for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!line.startsWith('[')) continue; const e = JSON.parse(line);
  if (e[1] === 'sock.frame' && (e[3] & 15) === 1) { let m; try { m = JSON.parse(e[5]); } catch (x) { bad.push({ where: path.basename(f), why: 'not JSON' }); continue; } check('serverToClient', m, path.basename(f) + ' @' + e[0]); }
}
if (ARG.cli) for (const f of files(ARG.cli, /\.new\.json$/)) for (const e of JSON.parse(fs.readFileSync(f, 'utf8'))) if (e[1] === 'ws.send') { let m; try { m = JSON.parse(e[3]); } catch (x) { bad.push({ where: path.basename(f), why: 'not JSON' }); continue; } check('clientToServer', m, path.basename(f) + ' @' + e[0]); }
if (ARG.raw) for (const line of fs.readFileSync(ARG.raw, 'utf8').split('\n')) { if (!line.trim()) continue; const l = JSON.parse(line);
  if (l.d === 'c2s' && l.m.t !== 'nr') continue;                          // (the harness's own p, a, join ...: what mp.js sends is the cli traces'; nr is sent as mp.js sends it)
  check(l.d === 's2c' ? 'serverToClient' : 'clientToServer', l.m, 'raw ' + l.who); }
const rep = { tool: 'dev/stage-3d-hq2/contract_hq2.js', fieldOrder: { fx: S.fx.fields.map(f => f[0]), s: S.s.fields.map(f => f[0]), bodies: S.bodies.fields.map(f => f[0]) }, additions: { fx: ADD.fx3d.concat(ADD.fxWorld), 'fx:boom': BOOM.fields, 'fx:end': END.fields, s: ADD.s, bodies: ADD.bodies, tp: ADD.tp, nra: S.nra.fields, world: S.world.fields, nr: K.nr.fields }, removedClientMessages: [...REMOVED],
  counts: stats, violations: bad.length, firstViolations: bad.slice(0, 40), ok: !bad.length };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
console.log(`messages checked: server->client ${Object.values(stats.serverToClient).reduce((a, b) => a + b, 0)}, client->server ${Object.values(stats.clientToServer).reduce((a, b) => a + b, 0)}`);
console.log('by type: ' + JSON.stringify(stats));
console.log(bad.length ? `VIOLATIONS: ${bad.length}\n` + bad.slice(0, 12).map(b => '  ' + JSON.stringify(b)).join('\n') : 'every message matches the contract with the 3D and HQ2 additions');
process.exitCode = bad.length ? 1 : 0;
