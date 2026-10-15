#!/usr/bin/env node
/* Stage 3H continuation C3c (M-024) - mp.js's modules against M8's parts, line by line (development only).
 *
 *   node dev/stage-3h-modernization/tools/c3c_mp_provenance.js [--report FILE.txt] [--out FILE.json]
 *
 * C3c turned mp.js's 16 parts (M8 = c34f0c2) into 11 modules and a composition (ADR-005), moving lines to their owners by meaning.  This
 * proves the claim that every line is M8's unless listed: it reads M8's parts from Git and this tree's (src/build-recipes.json's order),
 * compares their lines as two multisets (each line without the white space at its ends: a line moved into a function at another depth keeps
 * its text, not its indentation; blank lines aside), and requires the difference to be exactly what tools/c3c_mp_edits.js lists, group by
 * group, each with its reason: 'old' the M8 lines no longer anywhere in the modules, 'new' the lines nowhere in M8's parts.  A line changed
 * or added without being listed, or listed without being changed, is a FAIL.  The report adds, for each module, how many of its lines are
 * M8's.  Where the lines went, and why each move is safe, is the modules check's and the client scenes' to prove (the gate's modules and
 * cli_golden steps); this tool only proves nothing else changed. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..'), M8 = 'c34f0c22bbacc5ac2813d173bc0591b67af7169f', HEADER = /^\/\*\* @part [\s\S]*?\*\/\r?\n/;
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) ARG[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const EDITS = require('./c3c_mp_edits.js');
const recOf = t => JSON.parse(t).outputs.find(o => o.out === 'public/mp.js').parts;
const oldParts = recOf(execFileSync('git', ['-C', REPO, 'show', `${M8}:src/build-recipes.json`]).toString());
const newParts = recOf(fs.readFileSync(path.join(REPO, 'src/build-recipes.json'), 'utf8'));
const strip = t => t.slice((t.match(HEADER) || [''])[0].length), lines = t => t.split('\n').map(l => l.trim()).filter(l => l);
const old = oldParts.map(p => ({ p, ls: lines(strip(execFileSync('git', ['-C', REPO, 'show', `${M8}:${p}`]).toString())) }));
const neu = newParts.map(p => ({ p, ls: lines(strip(fs.readFileSync(path.join(REPO, p), 'utf8'))) }));
const bag = l => { const m = new Map(); for (const x of l) m.set(x, (m.get(x) || 0) + 1); return m; };
const minus = (a, b) => { const B = bag(b), out = []; for (const x of a) { if (B.get(x) > 0) B.set(x, B.get(x) - 1); else out.push(x); } return out; };
const oldL = old.flatMap(o => o.ls), newL = neu.flatMap(n => n.ls);
const removed = minus(oldL, newL), added = minus(newL, oldL);
const listedOld = EDITS.flatMap(g => g.old), listedNew = EDITS.flatMap(g => g.new);
const R = { tool: 'dev/stage-3h-modernization/tools/c3c_mp_provenance.js', m8: M8, m8Parts: oldParts, parts: newParts, m8Lines: oldL.length, lines: newL.length, m8LinesKept: oldL.length - removed.length,
  groups: EDITS.map(g => ({ id: g.id, why: g.why, old: g.old.length, new: g.new.length })),
  unlistedOld: minus(removed, listedOld), unlistedNew: minus(added, listedNew), listedNotChangedOld: minus(listedOld, removed), listedNotChangedNew: minus(listedNew, added) };
R.ok = !R.unlistedOld.length && !R.unlistedNew.length && !R.listedNotChangedOld.length && !R.listedNotChangedNew.length;
/* for each module: how many of its lines are M8's (in the order the build joins them; a line is M8's while M8 still has a copy left) */
const left = bag(oldL);
R.modules = neu.map(n => { let kept = 0; for (const l of n.ls) if (left.get(l) > 0) { left.set(l, left.get(l) - 1); kept++; } return { part: n.p, lines: n.ls.length, m8: kept, c3c: n.ls.length - kept }; });
const out = [];
out.push(`mp.js: ${oldParts.length} parts at M8 (${R.m8Lines} lines) -> ${newParts.length} parts now, 11 modules and the composition (${R.lines} lines); ${R.m8LinesKept} of M8's ${R.m8Lines} lines are in the modules as they were`);
for (const m of R.modules) out.push(`  ${m.part.padEnd(52)} ${String(m.lines).padStart(4)} lines: ${String(m.m8).padStart(4)} M8's, ${String(m.c3c).padStart(3)} C3c's`);
out.push('the changes, each group with its reason (tools/c3c_mp_edits.js):');
for (const g of EDITS) {
  out.push(`  [${g.id}] ${g.old.length} M8 line(s) gone, ${g.new.length} line(s) new - ${g.why}`);
  if (ARG.report) { for (const l of g.old) out.push('      M8:  ' + l); for (const l of g.new) out.push('      now: ' + l); }
}
if (!R.ok) {
  for (const [k, t] of [['unlistedOld', 'an M8 line gone, not listed'], ['unlistedNew', 'a new line, not listed'], ['listedNotChangedOld', 'listed as gone, still there'], ['listedNotChangedNew', 'listed as new, not there']]) for (const l of R[k]) out.push(`PROBLEM ${t}: ${l}`);
}
out.push(`C3C MP PROVENANCE: ${R.ok ? 'PASS' : 'FAIL'} (${R.m8LinesKept} of ${R.m8Lines} M8 lines kept as they were; ${removed.length} gone and ${added.length} new, every one listed with its reason)`);
if (ARG.report) fs.writeFileSync(ARG.report, out.join('\n') + '\n');
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(ARG.report ? out.filter(l => !/^ {6}(M8|now):/.test(l)).join('\n') : out.join('\n'));
process.exitCode = R.ok ? 0 : 1;
