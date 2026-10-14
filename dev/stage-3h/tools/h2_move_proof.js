/* Stage 3H2 - proof that an extraction MOVED code and changed none of it (development only; reads Git and the working tree, writes JSON).
 *
 *   node dev/stage-3h/tools/h2_move_proof.js --base REF --from server.js --to server/newrun.js --lines 204-211,227-244 [--out FILE.json]
 *        (--to / --lines may be given once per module: --to A --lines .. --to B --lines ..; every --lines belongs to the --to before it)
 *        [--relocated 115]   lines of --from that moved within --from (a comment put back beside its code): each must be found in
 *                            --from exactly once, unchanged; they are left out of the order check and listed on their own
 *
 * The goldens prove that the server still behaves byte for byte as B++; this proves how: line numbers refer to --from at --base.
 *   1. every listed line of --from at --base appears in its module, unchanged, in the same order, each listed range as one unbroken block
 *      (the lines keep their own text, indentation included: a move, not a rewrite);
 *   2. --from in the working tree is --from at --base without the listed lines, plus inserted lines only: no other line is deleted or
 *      changed (the inserted lines - the wiring that requires the module - are printed for review);
 *   3. the module's own lines beyond the moved blocks (its header comment and the few lines that wrap them) are printed for review.
 * Exit 0 only when 1 and 2 hold and at least one line was moved. */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..');
const argv = process.argv.slice(2), ARG = { moves: [] };
for (let i = 0; i < argv.length; i += 2) {
  const k = argv[i].replace(/^--/, ''), v = argv[i + 1];
  if (k === 'to') ARG.moves.push({ to: v, lines: [] });
  else if (k === 'lines') ARG.moves[ARG.moves.length - 1].lines = v.split(',').map(r => r.split('-').map(Number));
  else if (k === 'relocated') ARG.relocated = v.split(',').map(Number);
  else ARG[k] = v;
}
const show = (ref, f) => execFileSync('git', ['-C', REPO, 'show', `${ref}:${f}`], { maxBuffer: 1 << 28 }).toString('utf8');
const lines = s => s.split('\n');
const O = lines(show(ARG.base, ARG.from)), N = lines(fs.readFileSync(path.join(REPO, ARG.from), 'utf8'));
const R = { tool: 'dev/stage-3h/tools/h2_move_proof.js', base: ARG.base, from: ARG.from, moves: [], ok: true };
const removed = new Set();
for (const m of ARG.moves) {
  const M = lines(fs.readFileSync(path.join(REPO, m.to), 'utf8')), used = new Set(); let at = 0;
  const rec = { to: m.to, ranges: [], movedLines: 0, moduleLines: M.length, ok: true };
  for (const [a, b] of m.lines) {
    const block = O.slice(a - 1, b);                                         // lines a..b of --from at --base (1-based, inclusive)
    let found = -1;
    for (let i = at; i + block.length <= M.length && found < 0; i++) if (block.every((l, j) => M[i + j] === l)) found = i;
    rec.ranges.push({ lines: `${a}-${b}`, count: block.length, foundAtModuleLine: found < 0 ? null : found + 1 });
    if (found < 0) { rec.ok = false; continue; }
    for (let j = 0; j < block.length; j++) used.add(found + j);
    for (let n = a; n <= b; n++) removed.add(n);
    rec.movedLines += block.length; at = found + block.length;
  }
  rec.moduleOwnLines = M.map((l, i) => [i + 1, l]).filter(([i]) => !used.has(i - 1)).map(([i, l]) => `${i}: ${l}`);
  R.moves.push(rec); R.ok = R.ok && rec.ok;
}
/* --from now: the base without the moved lines, with insertions only (and the relocated lines, each found once, anywhere) */
const reloc = new Set(ARG.relocated || []);
const rest = O.map((l, i) => [i + 1, l]).filter(([n]) => !removed.has(n) && !reloc.has(n));
let k = 0; let inserted = [];
for (let i = 0; i < N.length; i++) { if (k < rest.length && N[i] === rest[k][1]) k++; else inserted.push(`${i + 1}: ${N[i]}`); }
R.relocated = [...reloc].map(n => { const at = N.map((l, i) => l === O[n - 1] ? i + 1 : 0).filter(Boolean); return { line: n, text: O[n - 1].slice(0, 120), nowAt: at, ok: at.length === 1 }; });
for (const r of R.relocated) if (r.ok) inserted = inserted.filter(x => x !== `${r.nowAt[0]}: ${O[r.line - 1]}`);
R.fromLinesBase = O.length; R.fromLinesNow = N.length; R.removedLines = removed.size;
R.keptInOrder = k === rest.length; R.notKept = k === rest.length ? [] : rest.slice(k, k + 5).map(([n, l]) => `${n}: ${l}`);
R.insertedInFrom = inserted;
R.ok = R.ok && R.keptInOrder && removed.size > 0 && R.relocated.every(r => r.ok) && N.length === rest.length + inserted.length + R.relocated.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
for (const m of R.moves) console.log(`${m.to}: ${m.movedLines} lines moved verbatim (${m.ranges.map(r => r.lines + (r.foundAtModuleLine ? ' at line ' + r.foundAtModuleLine : ' NOT FOUND')).join(', ')}); the module's own lines: ${m.moduleOwnLines.length}`);
for (const r of R.relocated) console.log(`${ARG.from}: line ${r.line} relocated within the file: now at ${r.nowAt.join(', ') || 'NOWHERE'}${r.ok ? '' : ' (must be found exactly once)'}`);
console.log(`${ARG.from}: ${R.removedLines} lines moved out, every other line of ${ARG.base.slice(0, 7)} kept in order: ${R.keptInOrder ? 'yes' : 'NO - first not kept: ' + R.notKept.join(' | ')}; inserted ${inserted.length}:`);
for (const l of inserted) console.log('  + ' + l.slice(0, 200));
console.log('MOVE PROOF: ' + (R.ok ? 'PASS' : 'FAIL'));
process.exitCode = R.ok ? 0 : 1;
