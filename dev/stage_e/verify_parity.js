'use strict';
// New captures are disposable diagnostics. Frozen references and the original
// zero-tolerance comparator are never rewritten or relaxed.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {spawnSync} = require('node:child_process'), assert = require('node:assert/strict');
const {hash} = require('../stage_a/trace_io');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || path.join(__dirname, 'evidence/final-parity'));
fs.mkdirSync(out, {recursive:true});
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stage E fresh traces '));
const frozen = path.join(root, 'dev/stage_a/traces');
const manifest = () => Object.fromEntries(fs.readdirSync(frozen).sort().map(f => [f, hash(fs.readFileSync(path.join(frozen, f)))]));
const before = manifest();
const result = {runtime:process.version, referenceRuntime:'v24.19.0', tolerance:0, groups:[], traces:[], records:0};
function run(file, args) {
  const p = spawnSync(process.execPath, [path.join(root, file), ...args], {cwd:root, encoding:'utf8', timeout:240000, maxBuffer:16*1024*1024});
  assert.ifError(p.error); return p;
}
try {
  for (const group of ['motor','ai','death','navigation','network']) {
    console.log('Capture ' + group);
    const p = run('dev/stage_a/capture_' + group + '.js', [temp]);
    fs.writeFileSync(path.join(out, 'capture-' + group + '.log'), p.stdout + p.stderr);
    assert.equal(p.status, 0, p.stdout + p.stderr);
    result.groups.push({group, exitCode:p.status});
    const index = JSON.parse(fs.readFileSync(path.join(frozen, group + '-index.json')));
    for (const item of index) {
      const name = item.name + '.json.gz';
      const q = run('dev/stage_a/diff_traces.js', [path.join(frozen,name), path.join(temp,name)]);
      assert.equal(q.status, 0, name + ': ' + q.stdout + q.stderr);
      const detail = JSON.parse(q.stdout);
      result.traces.push({name:item.name, ...detail}); result.records += detail.records;
    }
  }
  const map = path.join(temp, 'map.json.gz');
  const p = run('dev/stage_b/export_world.js', [root, map]);
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert(fs.readFileSync(map).equals(fs.readFileSync(path.join(root,'dev/stage_b/level0-baseline.json.gz'))));
  result.mapExport = 'BYTE IDENTICAL';
  assert.equal(result.traces.length, 46); assert.equal(result.records, 35098);
  assert.deepEqual(manifest(), before);
  result.frozenReferencesUnchanged = true;
  result.status = 'IDENTICAL RECORDS; HISTORICAL METADATA DIFFERENCES REPORTED';
  fs.writeFileSync(path.join(out,'parity.json'), JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,traces:result.traces.length,records:result.records,mapExport:result.mapExport}));
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
