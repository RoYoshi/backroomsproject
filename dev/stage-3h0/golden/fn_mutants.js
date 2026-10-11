/* Stage 3H0 - does fn_equiv.js notice a wrong extraction?  (development only)
 *
 *   node dev/stage-3h0/golden/fn_mutants.js --target wire|interp --file assets/net-wire.js [--out FILE.json]
 *
 * Copies the extracted helper with one small deliberate change at a time and runs fn_equiv.js against the parent's text: every copy must be
 * reported as different.  The real file is never touched. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const SRC = fs.readFileSync(ARG.file, 'utf8');
const M = {
  wire: [
    ['look fields in another order', 'L => [L.hat, L.texture, L.hands', 'L => [L.texture, L.hat, L.hands'],
    ['3-digit colours accepted', '/^#[0-9a-f]{6}$/i.test(v[i])', '/^#[0-9a-f]{3,6}$/i.test(v[i])'],
    ['another default look', "'none|plain|#e6bb76|#ffcc77|none'", "'none|plain|#e6bb76|#ffcc78|none'"],
    ['older clients\' backpacks kept', "return { hat, texture, hands, main, backpack: 'none' }; };", "return { hat, texture, hands, main, backpack: String(s || '').split('|')[4] || 'none' }; };"],
    ['hands with 3 values', 'b.hd.length === 4 ?', 'b.hd.length >= 3 ?'],
    ['parts joined with ", "', ".map(d => P[d[0]]).join(',');", ".map(d => P[d[0]]).join(', ');"],
    ['light-on flag passed through', 'lo: b.lo ? 1 : 0,', 'lo: b.lo,'],
    ['no part list without equipment kind check', "if (!A || !A.gear || !eq) return '';", "if (!A || !A.gear) return '';"],
  ],
  interp: [
    ['delay 0.11 s', 'DELAY: .1,', 'DELAY: .11,'],
    ['extrapolation 0.2 s', 'Math.min(rt - b.t, .15)', 'Math.min(rt - b.t, .2)'],
    ['jump limit 299 px', '> 300) return rt >= b.t ? b : a;', '> 299) return rt >= b.t ? b : a;'],
    ['step back 0.5 s', 'e.st < NET.lastSt - .25', 'e.st < NET.lastSt - .5'],
    ['history of 9', 'if (h.length > 8) h.shift();', 'if (h.length > 9) h.shift();'],
    ['prune after 6 s', 'if (e.st - h.seen > 5) NET.hist.delete(k);', 'if (e.st - h.seen > 6) NET.hist.delete(k);'],
    ['no epoch callback', 'NET.epoch++; if (NET.onEpoch) NET.onEpoch();', 'NET.epoch++;'],
    ['facing not on the shortest arc', 'a: a.a + angD2(b.a, a.a) * u }', 'a: a.a + (b.a - a.a) * u }'],
  ],
}[ARG.target];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h0fm-')), res = [];
for (const [name, from, to] of M) {
  if (!SRC.includes(from)) { res.push({ name, applied: false }); console.log('SKIP ' + name + ' (pattern not found)'); continue; }
  const f = path.join(tmp, path.basename(ARG.file)); fs.writeFileSync(f, SRC.replace(from, to));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'fn_equiv.js'), '--target', ARG.target, '--new', f, '--cases', '4000'], { encoding: 'utf8' });
  const caught = r.status === 1 && /"mismatches": [1-9]/.test(r.stdout);
  res.push({ name, applied: true, caught }); console.log((caught ? 'CAUGHT ' : 'MISSED ') + name);
}
fs.rmSync(tmp, { recursive: true, force: true });
const rep = { tool: 'dev/stage-3h0/golden/fn_mutants.js', target: ARG.target, file: ARG.file, applied: res.filter(r => r.applied).length, caught: res.filter(r => r.caught).length, results: res };
console.log(`${rep.caught}/${rep.applied} caught`);
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rep, null, 1) + '\n');
process.exitCode = rep.caught === rep.applied && rep.applied === M.length ? 0 : 1;
