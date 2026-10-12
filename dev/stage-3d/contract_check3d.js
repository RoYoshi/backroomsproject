/* Stage 3D - 3H0's read-only protocol contract with Stage 3D's death fields, against the new traces (development only).
 *
 *   node dev/stage-3d/contract_check3d.js --srv DIR --cli DIR [--out FILE.json]
 *
 * DIR: golden3d.js --keep and cli_golden3d.js --keep folders; only the working tree's traces (*.new.*) are read.  Every message the server
 * sends and every message mp.js sends is checked as dev/stage-3h0/golden/contract_check.js checks it (type listed, required fields present,
 * no field the contract does not list, the contract's field order), against dev/stage-3h0/protocol_contract.json plus these additions,
 * all of them death-domain and documented in STAGE_3D_DEATH_AUTHORITY_AND_PROTOCOL.md:
 *   server -> client 'fx':  de (death id), lo (the light was on), lf (Stage 3D HQ1: how the light fails), el (seconds already run, late joiners),
 *                           after the existing fields, optional
 *   server -> client 'fx' with k 'end' (an admin revive undid a death): t, k, id, de
 * The contract file itself is not changed.  Exit 0 when nothing violates the contract with the additions. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const C = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'stage-3h0', 'protocol_contract.json'), 'utf8'));
const ADD = { fx: [['de', 'death id', 'optional'], ['lo', 'the light was on', 'optional'], ['lf', 'HQ1: how the light fails [hold, fade, seed]', 'optional'], ['el', 'seconds already run (late joiner)', 'optional']] };
C.serverToClient.fx.fields = C.serverToClient.fx.fields.concat(ADD.fx);
const END = { fields: [['t', 'type'], ['k', 'end'], ['id', 'victim id'], ['de', 'death id']] };
const stats = { serverToClient: {}, clientToServer: {} }, bad = [];
function check(dir, m, where) {
  const spec = dir === 'serverToClient' && m.t === 'fx' && m.k === 'end' ? END : C[dir][m.t];
  const key = m.t === 'fx' && m.k === 'end' ? 'fx:end' : m.t; stats[dir][key] = (stats[dir][key] || 0) + 1;
  if (!spec) { bad.push({ where, why: 'type not in the contract', t: m.t }); return; }
  const order = spec.fields.map(f => f[0]), req = spec.fields.filter(f => f[2] !== 'optional').map(f => f[0]), ks = Object.keys(m);
  for (const k of ks) if (!order.includes(k)) bad.push({ where, why: 'field not in the contract', t: m.t, k });
  for (const k of req) if (!ks.includes(k)) bad.push({ where, why: 'required field missing', t: m.t, k });
  const pos = ks.filter(k => order.includes(k)).map(k => order.indexOf(k));
  if (pos.some((p, i) => i && p < pos[i - 1])) bad.push({ where, why: 'field order differs from the contract', t: m.t, keys: ks.join(',') });
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
const rep = { tool: 'dev/stage-3d/contract_check3d.js', additions: { fx: ADD.fx, 'fx:end': END.fields }, counts: stats, violations: bad.length, firstViolations: bad.slice(0, 40), ok: !bad.length };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
console.log(`messages checked: server->client ${Object.values(stats.serverToClient).reduce((a, b) => a + b, 0)}, client->server ${Object.values(stats.clientToServer).reduce((a, b) => a + b, 0)}`);
console.log(bad.length ? `VIOLATIONS: ${bad.length}\n` + bad.slice(0, 10).map(b => '  ' + JSON.stringify(b)).join('\n') : 'every message matches the contract with the 3D death additions');
process.exitCode = bad.length ? 1 : 0;
