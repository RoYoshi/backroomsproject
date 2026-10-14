#!/usr/bin/env node
/* dev/tools/checks/parts.js - the parts checker: every part of a built output declares its interface, and the code agrees (development
 * only; it needs TypeScript's parser and checker, found as the package `typescript` or Node's global copy, or at $TYPESCRIPT).
 *
 *   node dev/tools/checks/parts.js                     check every output built from more than one part; exit 1 on any disagreement
 *   node dev/tools/checks/parts.js --suggest <output>  print the interface each part of that output has, ready for its header
 *   node dev/tools/checks/parts.js --out FILE.json     also write the report
 *   node dev/tools/checks/parts.js --fix <output|all>  rewrite the provides / uses / writes lists of every part's header from the code,
 *                                                      keeping its title and notes (after editing a part; then review the diff)
 *
 * An output built from several parts (src/build-recipes.json) is one script whose parts share one closure: an IIFE (mp.js, ents.js, ...),
 * a UMD factory (ai.js) or createSim (sim.js).  Each part file begins with a header that the build removes (dev/tools/build/build.js):
 *
 *   /** @part public/mp.js - G.I.B.: our own death, from the server's kill record
 *    * provides: ownDeath, mkAt
 *    * uses: me, adm
 *    * writes: -
 *    *\/
 *
 * (A part built into two outputs, as world.js's are for the page and the server, names both: "@part public/world.js,generated/server/world.js".)
 *   provides  the names this part declares in the shared closure that other parts use;
 *   uses      the names this part uses that other parts declare in the shared closure ('-' when there are none);
 *   writes    of those, the ones this part assigns (=, +=, ++ ...): another part's binding it changes.
 * The checker assembles the output as the build does, finds the shared closure (the function with the largest body), gives each of its
 * statements to the part it lies in (no statement may straddle two parts), and resolves every name with TypeScript's checker, so a local
 * that shadows a closure name is not counted.  A header must list exactly what the code shows, in any order.  Names on window are the
 * classic scripts' contracts, not a part's interface, and are not listed here. */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..');
const ARG = { _: [] }; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) ARG[a.slice(2)] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true; else ARG._.push(a); }
function loadTs() {
  const tries = [process.env.TYPESCRIPT, 'typescript', path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript'), path.join(path.dirname(process.execPath), 'node_modules', 'typescript')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* the next */ } }
  return null;
}
const ts = loadTs();
if (!ts && require.main === module) { console.error('PARTS CHECK: NOT RUN - TypeScript is not installed (npm i -g typescript, or set TYPESCRIPT=<its folder>)'); process.exit(2); }
const HEADER = /^\/\*\* @part [\s\S]*?\*\/\r?\n/;
const recipes = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'build-recipes.json'), 'utf8'));

/* a part's header: its output, its title, and its provides / uses lists */
function readHeader(text) {
  const m = text.match(HEADER); if (!m) return null;
  const lines = m[0].split(/\r?\n/), first = /^\/\*\* @part (\S+)(?: - (.*))?$/.exec(lines[0]) || [];
  const lists = {}; let key = null;
  for (const l of lines.slice(1)) {
    const k = /^\s*\*\s*(provides|uses|writes):(.*)$/.exec(l);
    if (k) { key = k[1]; lists[key] = (lists[key] || '') + ' ' + k[2]; continue; }
    if (key && /^\s*\*\s{3,}\S/.test(l) && !/^\s*\*\//.test(l)) { lists[key] += ' ' + l.replace(/^\s*\*/, ''); continue; }
    key = null;
  }
  const names = s => s === undefined ? null : s.split(/[\s,]+/).filter(x => x && x !== '-');
  return { out: first[1] || null, outs: first[1] ? first[1].split(',') : [], title: first[2] || '', provides: names(lists.provides), uses: names(lists.uses), writes: names(lists.writes), bytes: Buffer.byteLength(m[0]) };
}

/* is this identifier a binding being assigned: the target of =, +=, ... (through parentheses and destructuring), of ++ / --, or of for-in/of? */
const ASSIGN = new Set(['EqualsToken', 'PlusEqualsToken', 'MinusEqualsToken', 'AsteriskEqualsToken', 'AsteriskAsteriskEqualsToken', 'SlashEqualsToken', 'PercentEqualsToken',
  'LessThanLessThanEqualsToken', 'GreaterThanGreaterThanEqualsToken', 'GreaterThanGreaterThanGreaterThanEqualsToken', 'AmpersandEqualsToken', 'BarEqualsToken', 'CaretEqualsToken',
  'BarBarEqualsToken', 'AmpersandAmpersandEqualsToken', 'QuestionQuestionEqualsToken'].map(k => ts && ts.SyntaxKind[k]));
function isWrite(id) {
  let n = id, p = n.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isArrayLiteralExpression(p) || ts.isObjectLiteralExpression(p) || ts.isShorthandPropertyAssignment(p) || ts.isSpreadElement(p) || ts.isSpreadAssignment(p)
    || (ts.isPropertyAssignment(p) && p.initializer === n))) { n = p; p = p.parent; }
  if (p && ts.isBinaryExpression(p) && p.left === n && ASSIGN.has(p.operatorToken.kind)) return true;
  if (p && (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)) return true;
  if (p && (ts.isForInStatement(p) || ts.isForOfStatement(p)) && p.initializer === n) return true;
  return false;
}

/* one output: its parts as the build joins them, each with its range in the assembled text (UTF-16 offsets, as TypeScript counts) */
function analyse(o) {
  const parts = []; let text = '';
  for (const p of o.parts) {
    const raw = fs.readFileSync(path.join(REPO, p)), latin = raw.toString('latin1'), m = latin.match(HEADER);
    const body = (m ? raw.subarray(Buffer.byteLength(m[0], 'latin1')) : raw).toString('utf8');
    parts.push({ path: p, header: readHeader(raw.toString('utf8')), start: text.length, end: text.length + body.length });
    text += body;
  }
  const name = o.out.replace(/\.js$/, '') + '.assembled.js';
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const host = { getSourceFile: f => f === name ? sf : undefined, getDefaultLibFileName: () => 'lib.d.ts', writeFile() {}, getCurrentDirectory: () => '/', getDirectories: () => [],
    fileExists: f => f === name, readFile: () => undefined, getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
  const prog = ts.createProgram([name], { allowJs: true, checkJs: false, noEmit: true, noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022 }, host), checker = prog.getTypeChecker();
  /* the shared closure: the function with the largest block body */
  let closure = null;
  (function walk(n) { if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isFunctionDeclaration(n)) && n.body && ts.isBlock(n.body) && (!closure || n.body.end - n.body.pos > closure.body.end - closure.body.pos)) closure = n; ts.forEachChild(n, walk); })(sf);
  const partAt = pos => parts.findIndex(p => pos >= p.start && pos < p.end);
  const problems = [];
  /* the closure-level declarations, each with the part it lies in; the closure's parameters belong to the part with its head */
  const owner = new Map(), nameOf = new Map();
  const declare = (id, k) => { const s = checker.getSymbolAtLocation(id); if (s) { owner.set(s, k); nameOf.set(s, id.text); } };
  const bind = (b, k) => { if (ts.isIdentifier(b)) declare(b, k); else for (const e of b.elements || []) if (!ts.isOmittedExpression(e)) bind(e.name, k); };
  const headPart = partAt(closure.getStart(sf));
  for (const prm of closure.parameters) bind(prm.name, headPart);
  const stmts = closure.body.statements.map(s => ({ s, k: partAt(s.getStart(sf)) }));
  for (const { s, k } of stmts) {
    if (k < 0 || s.end > parts[k].end) problems.push(`a statement at character ${s.getStart(sf)} straddles two parts`);
    if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) bind(d.name, k);
    else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) declare(s.name, k);
  }
  /* every use of a closure-level name from another part */
  const uses = parts.map(() => new Map()), writes = parts.map(() => new Set());
  for (const { s, k } of stmts) (function walk(n) {
    if (ts.isIdentifier(n)) {
      let sym = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
      if (sym && owner.has(sym) && owner.get(sym) !== k) { uses[k].set(nameOf.get(sym), owner.get(sym)); if (isWrite(n)) writes[k].add(nameOf.get(sym)); }
    }
    ts.forEachChild(n, walk);
  })(s);
  const provides = parts.map(() => new Set());
  uses.forEach((m) => { for (const [n, from] of m) provides[from].add(n); });
  const R = { out: o.out, closure: `${ts.SyntaxKind[closure.kind]} at character ${closure.getStart(sf)}`, closureNames: owner.size, parts: [], problems, ok: !problems.length };
  parts.forEach((p, k) => {
    const pv = [...provides[k]].sort(), us = [...uses[k].keys()].sort(), wr = [...writes[k]].sort(), h = p.header;
    const rec = { path: p.path, statements: stmts.filter(x => x.k === k).length, provides: pv, uses: us, writes: wr, usesFrom: Object.fromEntries([...uses[k]].map(([n, f]) => [n, parts[f].path])), header: !!h };
    if (!h) rec.problem = 'no @part header';
    else {
      const same = (a, b) => a !== null && a.length === b.length && [...a].sort().every((x, i) => x === b[i]);
      const bad = [];
      if (!h.outs.includes(o.out)) bad.push(`its header names ${h.out}, not ${o.out}`);
      if (!same(h.provides, pv)) bad.push(`provides: the header says [${(h.provides || ['(missing)']).join(', ')}], the code [${pv.join(', ')}]`);
      if (!same(h.uses, us)) bad.push(`uses: the header says [${(h.uses || ['(missing)']).join(', ')}], the code [${us.join(', ')}]`);
      if (!same(h.writes, wr)) bad.push(`writes: the header says [${(h.writes || ['(missing)']).join(', ')}], the code [${wr.join(', ')}]`);
      if (bad.length) rec.problem = bad.join('; ');
    }
    if (rec.problem) R.ok = false;
    R.parts.push(rec);
  });
  return R;
}

const wrapList = (key, names) => { const out = []; let line = ` * ${key}: `; const pad = ' *' + ' '.repeat(key.length + 3); if (!names.length) return [line + '-'];
  names.forEach((n, i) => { const w = n + (i < names.length - 1 ? ',' : ''); if (line.length + w.length + 1 > 138 && line.trim() !== `* ${key}:`) { out.push(line.replace(/\s+$/, '')); line = pad; } line += (line.endsWith(' ') ? '' : ' ') + w; }); out.push(line); return out; };
module.exports = { analyse, readHeader, HEADER, wrapList };
if (require.main !== module) return;
const multi = recipes.outputs.filter(o => Array.isArray(o.parts) && o.parts.length > 1);
if (ARG.fix) {
  const outs = ARG.fix === true || ARG.fix === 'all' ? multi : multi.filter(o => o.out === ARG.fix); let bad = 0;
  if (!outs.length) { console.error('no output of several parts named ' + ARG.fix); process.exit(2); }
  for (const o of outs) {
    const R = analyse(o); if (R.problems.length) { console.log(`${o.out}: not rewritten: ${R.problems.join('; ')}`); bad++; continue; }
    for (const r of R.parts) {
      const f = path.join(REPO, r.path), raw = fs.readFileSync(f), m = raw.toString('latin1').match(HEADER);
      if (!m) { console.log(`${r.path}: no @part header (give it one with a title first)`); bad++; continue; }
      const lines = raw.subarray(0, Buffer.byteLength(m[0], 'latin1')).toString('utf8').replace(/\r?\n$/, '').split(/\r?\n/); let inList = false;
      const keep = [lines[0]].concat(lines.slice(1).filter(l => { if (/^\s*\*\//.test(l)) return false; if (/^\s*\*\s*(provides|uses|writes):/.test(l)) { inList = true; return false; } if (inList && /^\s*\*\s{3,}\S/.test(l)) return false; inList = false; return true; }));
      const head = keep.concat(wrapList('provides', r.provides), wrapList('uses', r.uses), wrapList('writes', r.writes), [' */']).join('\n') + '\n';
      fs.writeFileSync(f, Buffer.concat([Buffer.from(head), raw.subarray(Buffer.byteLength(m[0], 'latin1'))]));
    }
    console.log(`${o.out}: ${R.parts.length} headers rewritten from the code`);
  }
  process.exit(bad ? 1 : 0);
}
if (ARG.suggest) {
  const o = multi.find(x => x.out === ARG.suggest); if (!o) { console.error('no output of several parts named ' + ARG.suggest); process.exit(2); }
  const R = analyse(o);
  for (const p of R.parts) console.log(`${p.path}  (${p.statements} statements)\n` + wrapList('provides', p.provides).join('\n') + '\n' + wrapList('uses', p.uses).join('\n') + '\n' + wrapList('writes', p.writes).join('\n') + '\n');
  for (const x of R.problems) console.log('PROBLEM ' + x);
  process.exit(R.problems.length ? 1 : 0);
}
const report = { tool: 'dev/tools/checks/parts.js', typescript: ts.version, outputs: multi.map(analyse) };
report.ok = report.outputs.every(r => r.ok);
for (const r of report.outputs) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.out}: ${r.parts.length} parts, ${r.closureNames} names in the shared closure`);
  for (const x of r.problems) console.log('  PROBLEM ' + x);
  for (const p of r.parts) if (p.problem) console.log(`  ${p.path}: ${p.problem}`);
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(report, null, 1) + '\n');
console.log(`PARTS CHECK: ${report.ok ? 'PASS' : 'FAIL'} (${report.outputs.length} outputs, ${report.outputs.reduce((n, r) => n + r.parts.length, 0)} parts)`);
process.exitCode = report.ok ? 0 : 1;
