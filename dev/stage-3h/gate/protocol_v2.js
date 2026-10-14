/* Stage 3H2 (H2-0) - the B++ protocol contract, version 2: derived from the B++ golden traces, then used to check any set of traces
 * (development only; reads traces, writes JSON).
 *
 *   node dev/stage-3h/gate/protocol_v2.js derive --srv DIR[,DIR] --cli DIR[,DIR] --out protocol_bpp.json
 *   node dev/stage-3h/gate/protocol_v2.js check  --srv DIR[,DIR] --cli DIR[,DIR] [--contract protocol_bpp.json] [--out REPORT.json]
 *
 * Stage 3H0's contract (dev/stage-3h0/protocol_contract.json) describes the QA2 parent and reports 12,483 differences on B++ (3H1 F-003).
 * This one is written from what the accepted B++ code actually sends, in both directions, and is exact: for every message type, every JSON
 * path inside it ("s.p[].lk", "q.p[][1]", ...) with the kinds of value it carries (number, string, boolean, null, array, object) and, for
 * objects, the exact key orders seen.  A message passes when every path in it is in the contract for its type, with an allowed kind and an
 * allowed key order.  Server messages are read from the server harness's decoded frames ('sock.frame'), client messages from the client
 * harness's recorded sends ('ws.send').  The check fails when it read no message at all (a check that tests nothing is a FAIL).
 * Objects whose keys are data rather than names (none on the B++ wire as derived; the derive step lists any path with more than 40 key
 * orders so a reviewer can see it) would make the contract brittle; there are none. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const MODE = process.argv[2];
const ARG = {}; for (let i = 3; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const read = f => { const b = fs.readFileSync(f); return (f.endsWith('.gz') ? zlib.gunzipSync(b) : b).toString('utf8'); };
const files = (d, re) => fs.readdirSync(d).filter(f => re.test(f) && !/hashes\.json$/.test(f)).map(f => path.join(d, f)).sort();
const kindOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
function* messages() {
  for (const d of String(ARG.srv || '').split(',').filter(Boolean)) for (const f of files(d, /\.jsonl(\.gz)?$/))
    for (const line of read(f).split('\n')) { if (!line.startsWith('[')) continue; const e = JSON.parse(line); if (e[1] === 'sock.frame' && (e[3] & 15) === 1) { let m; try { m = JSON.parse(e[5]); } catch (x) { continue; } yield ['serverToClient', m, path.basename(f)]; } }
  for (const d of String(ARG.cli || '').split(',').filter(Boolean)) for (const f of files(d, /\.json(\.gz)?$/))
    for (const e of JSON.parse(read(f))) if (e[1] === 'ws.send') { let m; try { m = JSON.parse(e[3]); } catch (x) { continue; } yield ['clientToServer', m, path.basename(f)]; }
}
/* every path of a message: [path, kind, keyOrder|null] */
function walk(v, p, out) {
  const k = kindOf(v);
  if (k === 'object') { const ks = Object.keys(v); out.push([p, k, ks.join(',')]); for (const key of ks) walk(v[key], p + '.' + key, out); }
  else if (k === 'array') { out.push([p, k, null]); for (const x of v) walk(x, p + '[]', out); }
  else out.push([p, k, null]);
  return out;
}
if (MODE === 'derive') {
  const C = { tool: 'dev/stage-3h/gate/protocol_v2.js', version: 2, derivedFrom: { srv: ARG.srv, cli: ARG.cli }, serverToClient: {}, clientToServer: {} };
  let n = 0;
  for (const [dir, m] of messages()) {
    n++; const t = m.t === undefined ? '(no t)' : String(m.t), T = C[dir][t] = C[dir][t] || { seen: 0, paths: {} }; T.seen++;
    for (const [p, k, ko] of walk(m, '', [])) {
      const P = T.paths[p || '.'] = T.paths[p || '.'] || { kinds: [], keyOrders: [] };
      if (!P.kinds.includes(k)) P.kinds.push(k);
      if (ko !== null && !P.keyOrders.includes(ko)) P.keyOrders.push(ko);
    }
  }
  const wide = [];
  for (const dir of ['serverToClient', 'clientToServer']) for (const [t, T] of Object.entries(C[dir])) for (const [p, P] of Object.entries(T.paths)) { P.kinds.sort(); P.keyOrders.sort(); if (P.keyOrders.length > 40) wide.push(`${dir} ${t} ${p}: ${P.keyOrders.length} key orders`); }
  C.messagesRead = n; C.wideObjects = wide;
  fs.writeFileSync(ARG.out, JSON.stringify(C, null, 1) + '\n');
  const sum = d => Object.entries(C[d]).map(([t, T]) => `${t}(${Object.keys(T.paths).length} paths)`).join(' ');
  console.log(`derived from ${n} messages\nserver->client ${sum('serverToClient')}\nclient->server ${sum('clientToServer')}${wide.length ? '\nWIDE: ' + wide.join('; ') : ''}`);
} else if (MODE === 'check') {
  const C = JSON.parse(fs.readFileSync(ARG.contract || path.join(__dirname, 'protocol_bpp.json'), 'utf8'));
  const R = { tool: 'dev/stage-3h/gate/protocol_v2.js', contract: ARG.contract || 'dev/stage-3h/gate/protocol_bpp.json', read: { serverToClient: 0, clientToServer: 0 }, violations: [], violationCount: 0, typesSeen: { serverToClient: {}, clientToServer: {} } };
  const add = v => { R.violationCount++; if (R.violations.length < 200) R.violations.push(v); };
  for (const [dir, m, src] of messages()) {
    R.read[dir]++;
    const t = m.t === undefined ? '(no t)' : String(m.t), T = C[dir][t];
    R.typesSeen[dir][t] = (R.typesSeen[dir][t] || 0) + 1;
    if (!T) { add({ dir, t, src, why: 'type not in the contract' }); continue; }
    for (const [p, k, ko] of walk(m, '', [])) {
      const P = T.paths[p || '.'];
      if (!P) { add({ dir, t, src, path: p, why: 'path not in the contract' }); continue; }
      if (!P.kinds.includes(k)) add({ dir, t, src, path: p, why: `kind ${k} not in [${P.kinds}]` });
      if (ko !== null && !P.keyOrders.includes(ko)) add({ dir, t, src, path: p || '.', why: `key order "${ko}" not in the contract` });
    }
  }
  const total = R.read.serverToClient + R.read.clientToServer;
  R.ok = total > 0 && R.violationCount === 0;
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`read ${R.read.serverToClient} server and ${R.read.clientToServer} client messages; violations ${R.violationCount}`);
  for (const v of R.violations.slice(0, 8)) console.log('  ' + JSON.stringify(v));
  if (!total) console.log('FAIL: no message was read');
  console.log('PROTOCOL V2: ' + (R.ok ? 'PASS' : 'FAIL'));
  process.exitCode = R.ok ? 0 : 1;
} else if (MODE === 'selftest') {
  /* the checker must catch what it is for: a known message with one key too many is 2 violations (its key order, and the extra path), a
   * type the contract does not have is 1; the same known message without the extra key is none */
  const os = require('os'), d = fs.mkdtempSync(path.join(os.tmpdir(), 'h2pv-')), C = path.resolve(ARG.contract || path.join(__dirname, 'protocol_bpp.json'));
  const fr = m => JSON.stringify([0, 'sock.frame', 'c1', 129, 0, JSON.stringify(m)]);
  fs.writeFileSync(path.join(d, 'good.jsonl'), [fr({ t: 'hi', id: 1, sim: 1 })].join('\n') + '\n');
  fs.writeFileSync(path.join(d, 'bad.jsonl'), [fr({ t: 'hi', id: 1, sim: 1, x: 2 }), fr({ t: 'zz' })].join('\n') + '\n');
  const { spawnSync } = require('child_process');
  const run = f => { const t = fs.mkdtempSync(path.join(os.tmpdir(), 'h2pv-')); fs.copyFileSync(path.join(d, f), path.join(t, f)); const o = path.join(t, 'r.json');
    spawnSync(process.execPath, [__filename, 'check', '--srv', t, '--contract', C, '--out', o]); const r = JSON.parse(fs.readFileSync(o, 'utf8')); fs.rmSync(t, { recursive: true, force: true }); return r; };
  const good = run('good.jsonl'), bad = run('bad.jsonl');
  fs.rmSync(d, { recursive: true, force: true });
  const ok = good.ok && good.violationCount === 0 && !bad.ok && bad.violationCount === 3;
  console.log(`selftest: a valid 'hi' gives ${good.violationCount} violations; 'hi' with an extra key and an unknown type give ${bad.violationCount}`);
  console.log('PROTOCOL V2 SELFTEST: ' + (ok ? 'PASS' : 'FAIL'));
  process.exitCode = ok ? 0 : 1;
} else { console.error('usage: protocol_v2.js derive|check|selftest --srv DIRS --cli DIR ...'); process.exitCode = 2; }
