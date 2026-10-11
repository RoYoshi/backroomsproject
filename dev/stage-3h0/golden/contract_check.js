/* Stage 3H0 - check the read-only protocol contract (dev/stage-3h0/protocol_contract.json) against the golden traces (development only).
 *
 *   node dev/stage-3h0/golden/contract_check.js --srv DIR --cli DIR [--out FILE.json]
 *
 * DIR holds traces (*.jsonl / *.json, or the gzipped baseline copies).  Every message the server sent (decoded text frames in the server
 * traces) and every message mp.js sent (ws.send in the client traces) must: have a type the contract lists; carry every non-optional field;
 * carry no field the contract does not list; and keep the contract's field order.  Snapshot peers and the entity block are checked too.
 * Messages the scenarios send to the server on purpose malformed are inputs, not checked here.  Exit 0 when nothing violates the contract. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const C = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'protocol_contract.json'), 'utf8'));
const read = f => { const b = fs.readFileSync(f); return (f.endsWith('.gz') ? zlib.gunzipSync(b) : b).toString('utf8'); };
const files = (d, re) => fs.readdirSync(d).filter(f => re.test(f)).map(f => path.join(d, f));
const stats = { serverToClient: {}, clientToServer: {} }, bad = [];
function check(dir, m, where) {
  const spec = C[dir][m.t];
  stats[dir][m.t] = (stats[dir][m.t] || 0) + 1;
  if (!spec) { bad.push({ where, why: 'type not in the contract', t: m.t }); return; }
  const order = spec.fields.map(f => f[0]), req = spec.fields.filter(f => f[2] !== 'optional').map(f => f[0]);
  const ks = Object.keys(m);
  for (const k of ks) if (!order.includes(k)) bad.push({ where, why: 'field not in the contract', t: m.t, k });
  for (const k of req) if (!ks.includes(k)) bad.push({ where, why: 'required field missing', t: m.t, k });
  const pos = ks.filter(k => order.includes(k)).map(k => order.indexOf(k));
  if (pos.some((p, i) => i && p < pos[i - 1])) bad.push({ where, why: 'field order differs from the contract', t: m.t, keys: ks.join(',') });
  if (m.t === 's') {
    const po = spec.peer.map(f => f[0]), eo = spec.e.map(f => f[0]);
    for (const p of m.p || []) if (Object.keys(p).join(',') !== po.join(',')) bad.push({ where, why: 'peer fields differ from the contract', keys: Object.keys(p).join(',') });
    if (m.e && Object.keys(m.e).join(',') !== eo.join(',')) bad.push({ where, why: 'entity block fields differ from the contract', keys: Object.keys(m.e).join(',') });
  }
}
if (ARG.srv) for (const f of files(ARG.srv, /\.jsonl(\.gz)?$/)) {
  for (const line of read(f).split('\n')) {
    if (!line.startsWith('[')) continue; const e = JSON.parse(line);
    if (e[1] === 'sock.frame' && (e[3] & 15) === 1) { let m; try { m = JSON.parse(e[5]); } catch (x) { bad.push({ where: path.basename(f), why: 'server sent text that is not JSON' }); continue; } check('serverToClient', m, path.basename(f) + ' @' + e[0]); }
  }
}
if (ARG.cli) for (const f of files(ARG.cli, /\.json(\.gz)?$/).filter(f => !/hashes\.json$/.test(f))) {
  for (const e of JSON.parse(read(f))) if (e[1] === 'ws.send') { let m; try { m = JSON.parse(e[3]); } catch (x) { bad.push({ where: path.basename(f), why: 'mp.js sent text that is not JSON' }); continue; } check('clientToServer', m, path.basename(f) + ' @' + e[0]); }
}
const contractTypes = { serverToClient: Object.keys(C.serverToClient), clientToServer: Object.keys(C.clientToServer) };
const unseen = { serverToClient: contractTypes.serverToClient.filter(t => !stats.serverToClient[t]), clientToServer: contractTypes.clientToServer.filter(t => !stats.clientToServer[t]) };
const rep = { tool: 'dev/stage-3h0/golden/contract_check.js', counts: stats, unseenContractTypes: unseen, violations: bad.length, firstViolations: bad.slice(0, 40), ok: !bad.length };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
console.log(`messages checked: server->client ${Object.values(stats.serverToClient).reduce((a, b) => a + b, 0)} (${Object.keys(stats.serverToClient).length} types), client->server ${Object.values(stats.clientToServer).reduce((a, b) => a + b, 0)} (${Object.keys(stats.clientToServer).length} types)`);
console.log(`contract types never seen: server->client ${unseen.serverToClient.join(' ') || 'none'}; client->server ${unseen.clientToServer.join(' ') || 'none'}`);
console.log(bad.length ? `VIOLATIONS: ${bad.length}\n` + bad.slice(0, 10).map(b => '  ' + JSON.stringify(b)).join('\n') : 'every message matches the contract');
process.exitCode = bad.length ? 1 : 0;
