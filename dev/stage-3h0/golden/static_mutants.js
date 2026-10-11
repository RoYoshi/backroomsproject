/* Stage 3H0 - does the server gate notice a wrong server/static.js?  (development only)
 *
 *   node dev/stage-3h0/golden/static_mutants.js --file server/static.js [--server-src FILE] [--out FILE.json]
 *
 * The start-up and HTTP scenarios of the server golden traces (boot, http_base, http_h0) are run once with the working tree as it is (the
 * reference), then once per deliberate small change to the given static.js.  Each run uses a scratch folder that links every file of the
 * working tree except server/, which holds copies of the real server/ files with the changed static.js; server.js is the working tree's, or
 * --server-src (a candidate server.js, to check a draft before the real one is edited).  Every changed copy must give a different trace.  A
 * control run with an unchanged copy must give the same traces as the reference: before the extraction is applied, that control run is
 * the draft's equivalence check.  The real files are never touched. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), HARNESS = path.join(__dirname, 'srv_harness.js');
const SRC = fs.readFileSync(path.resolve(REPO, ARG.file), 'utf8'), BASE = path.basename(ARG.file);
const SCEN = ['boot', 'http_base', 'http_h0'];
const SERVER_SRC = ARG['server-src'] ? path.resolve(ARG['server-src']) : path.join(REPO, 'server.js');
const M = [
  ['control: no change', null, null],
  ['the server/ folder served', "|assets\\/[\\w.\\-]+)$/;", "|assets\\/[\\w.\\-]+|server\\/[\\w.\\-]+)$/;"],
  ['a malformed escape gives 404', "catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }", "catch (e) { res.writeHead(404); return res.end('Not found'); }"],
  ['a NUL not refused', "if (u.includes('\\0')) {", "if (u.includes('\\0\\0')) {"],
  ['/ is not index.html', "if (u === '/') u = '/index.html';", "if (u === '/') u = '/index.htm';"],
  ['the query string kept', ".split('?')[0]", ".split('#')[0]"],
  ['the sounds list keeps every file', ".filter(n => AUDIO[path.extname(n).toLowerCase()])", ".filter(n => n)"],
  ['sounds cached for an hour', "'public, max-age=300'", "'public, max-age=3600'"],
  ['PNG cached for an hour', "'public, max-age=86400'", "'public, max-age=3600'"],
  ['unknown types served as text', "types[ext] || 'application/octet-stream'", "types[ext] || 'text/plain'"],
  ['no Vary header', ", 'Vary': 'Accept-Encoding' };", " };"],
  ['gzip matched without regard to case', "/\\bgzip\\b/.test(", "/\\bgzip\\b/i.test("],
  ['PNG gzipped too', "if (ext !== '.png' && /\\bgzip", "if (ext !== '.pngx' && /\\bgzip"],
];
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'h0sm-'));
function tree(text) {
  const d = fs.mkdtempSync(path.join(tmpRoot, 't-'));
  for (const n of fs.readdirSync(REPO)) if (!['server', '.git', 'node_modules'].includes(n)) fs.symlinkSync(path.join(REPO, n), path.join(d, n));
  fs.mkdirSync(path.join(d, 'server'));
  for (const n of fs.readdirSync(path.join(REPO, 'server'))) fs.copyFileSync(path.join(REPO, 'server', n), path.join(d, 'server', n));
  fs.writeFileSync(path.join(d, 'server', BASE), text);
  return d;
}
function traces(dir, src) {
  const out = {};
  for (const sc of SCEN) {
    const f = path.join(tmpRoot, 'trace-' + Math.random().toString(36).slice(2) + '.jsonl');
    const r = spawnSync(process.execPath, [HARNESS, '--src', src, '--dir', dir, '--scenario', sc, '--out', f], { encoding: 'utf8', timeout: 300000 });
    out[sc] = r.status === 0 ? fs.readFileSync(f, 'utf8') : 'HARNESS FAILED ' + r.status + ' ' + (r.stdout || '').slice(-300);
  }
  return out;
}
const ref = traces(REPO, path.join(REPO, 'server.js')), res = [];
for (const [name, from, to] of M) {
  if (from !== null && !SRC.includes(from)) { res.push({ name, applied: false }); console.log('SKIP ' + name + ' (pattern not found)'); continue; }
  const t = traces(tree(from === null ? SRC : SRC.replace(from, to)), SERVER_SRC);
  const differs = SCEN.filter(sc => t[sc] !== ref[sc]);
  if (from === null) { res.push({ name, control: true, same: !differs.length }); console.log((differs.length ? 'CONTROL DIFFERS ' : 'CONTROL SAME ') + differs.join(',')); continue; }
  res.push({ name, applied: true, caught: differs.length > 0, by: differs }); console.log((differs.length ? 'CAUGHT ' : 'MISSED ') + name + (differs.length ? ' (' + differs.join(', ') + ')' : ''));
}
fs.rmSync(tmpRoot, { recursive: true, force: true });
const muts = res.filter(r => !r.control), ctl = res.find(r => r.control);
const rep = { tool: 'dev/stage-3h0/golden/static_mutants.js', file: ARG.file, serverSrc: ARG['server-src'] || 'server.js (working tree)', scenarios: SCEN, control: ctl, applied: muts.filter(r => r.applied).length, caught: muts.filter(r => r.caught).length, results: res };
console.log(`${rep.caught}/${rep.applied} caught; control ${ctl && ctl.same ? 'same' : 'DIFFERS'}`);
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
process.exitCode = ctl && ctl.same && rep.caught === rep.applied && rep.applied === M.length - 1 ? 0 : 1;
