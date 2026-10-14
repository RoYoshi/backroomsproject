/* Stage 3H1 - the wire as the accepted B++ code actually speaks it, read from golden traces (development only; reads traces, writes JSON).
 *
 *   node dev/stage-3h/tools/h1_wire_keys.js --srv DIR[,DIR] --cli DIR [--out FILE.json]
 *
 * DIR holds traces from Stage 3H0's harnesses (server: *.jsonl or *.jsonl.gz, decoded frames as 'sock.frame'; client: *.json or *.json.gz,
 * mp.js's sends as 'ws.send'), e.g. the H1 baselines.  For every message type in each direction it records how often it was seen and every
 * distinct key order (with counts); for 's' also the peer entries' and the entity block's key orders, and for 'q' the shape of its entries.
 * It then sets that beside Stage 3H0's frozen contract (dev/stage-3h0/protocol_contract.json, written for the QA2 parent): the types and
 * keys the B++ code sends that the contract does not list, and the contract's types never seen.  It describes; it does not judge - the
 * 3H0 contract predates Stage 3D and 3E-0, so differences are expected and are listed for a B++ contract to be written on purpose. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const C = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'stage-3h0', 'protocol_contract.json'), 'utf8'));
const read = f => { const b = fs.readFileSync(f); return (f.endsWith('.gz') ? zlib.gunzipSync(b) : b).toString('utf8'); };
const files = (d, re) => fs.readdirSync(d).filter(f => re.test(f) && !/hashes\.json$/.test(f)).map(f => path.join(d, f)).sort();
const W = { serverToClient: {}, clientToServer: {} };
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
function note(dir, m) {
  const t = m.t === undefined ? '(no t)' : m.t, T = W[dir][t] || (W[dir][t] = { n: 0, keyOrders: {} });
  T.n++; bump(T.keyOrders, Object.keys(m).join(','));
  if (t === 's') {
    T.peerKeyOrders = T.peerKeyOrders || {}; for (const p of m.p || []) bump(T.peerKeyOrders, Object.keys(p).join(','));
    T.entityKeyOrders = T.entityKeyOrders || {}; if (m.e) bump(T.entityKeyOrders, Object.keys(m.e).join(','));
  }
  if (t === 'q') { T.entryShapes = T.entryShapes || {}; for (const q of m.p || []) bump(T.entryShapes, Array.isArray(q) ? 'array' + q.length + ':' + q.map(v => typeof v).join('/') : typeof q); }
}
for (const d of String(ARG.srv || '').split(',').filter(Boolean)) for (const f of files(d, /\.jsonl(\.gz)?$/))
  for (const line of read(f).split('\n')) { if (!line.startsWith('[')) continue; const e = JSON.parse(line); if (e[1] === 'sock.frame' && (e[3] & 15) === 1) { try { note('serverToClient', JSON.parse(e[5])); } catch (x) { } } }
if (ARG.cli) for (const f of files(ARG.cli, /\.json(\.gz)?$/))
  for (const e of JSON.parse(read(f))) if (e[1] === 'ws.send') { try { note('clientToServer', JSON.parse(e[3])); } catch (x) { } }
const vsContract = {};
for (const dir of ['serverToClient', 'clientToServer']) {
  const seen = W[dir], spec = C[dir], o = vsContract[dir] = { typesNotInContract: [], keysNotInContract: {}, contractTypesNotSeen: Object.keys(spec).filter(t => !seen[t]) };
  for (const [t, T] of Object.entries(seen)) {
    if (!spec[t]) { o.typesNotInContract.push(t); continue; }
    const known = new Set(spec[t].fields.map(f => f[0])), extra = new Set();
    for (const ko of Object.keys(T.keyOrders)) for (const k of ko.split(',')) if (k && !known.has(k)) extra.add(k);
    if (extra.size) o.keysNotInContract[t] = [...extra];
  }
}
const R = { tool: 'dev/stage-3h/tools/h1_wire_keys.js', sources: { srv: ARG.srv || null, cli: ARG.cli || null }, wire: W, vsContract3H0: vsContract };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
const sum = d => Object.entries(W[d]).map(([t, T]) => `${t}:${T.n}`).join(' ');
console.log('server->client ' + sum('serverToClient')); console.log('client->server ' + sum('clientToServer'));
console.log('not in the 3H0 contract: ' + JSON.stringify(vsContract));
