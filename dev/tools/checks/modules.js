#!/usr/bin/env node
/* dev/tools/checks/modules.js - the module-boundary audit (development only; it needs TypeScript's parser and checker, found as the
 * package `typescript` or Node's global copy, or at $TYPESCRIPT, like dev/tools/checks/parts.js).
 *
 *   node dev/tools/checks/modules.js [--out FILE.json] [--quiet] [--dir TREE]   (--dir: another copy of the game; default this repository)
 *
 * Stage 3H continuation C3 (M-024): code that used to share one closure is modules, and this audit proves from the code what that means.
 * The server: server.js and every module the server loads from src/ (dev/tools/layout.js serverFiles: the built files in generated/ are
 * checked by the build and the parts check instead):
 *   1. names      every name a file uses is declared in it, a parameter of its factory, or the host's (require, console, the timers ...)
 *                 or the language's (Math, Map ...): nothing reaches a module except what it is given; and no file reaches the global
 *                 object (globalThis, global), the back-channel a module could use to pass state around its interface;
 *   2. imports    a factory's parameters - the names it is given, destructured or not - are never assigned: a module cannot write a
 *                 binding of another; it changes another owner's state only by calling a function that owner gave it;
 *   3. used       every name a factory is given is used (its parameter list is its real interface, not more);
 *   4. per world  a module of the sim (layout.simFiles) keeps no state outside its factory: its top level is 'use strict' and
 *                 module.exports = function (the composition, src/core/server/sim.js, also its requires): anything kept outside would be
 *                 shared by every room's world;
 *   5. links      in the sim's composition, each module is made from modules made before it (no cycle), and every name a module imports
 *                 from another (a destructured parameter such as ai: { eng }) is a key of the object that module's factory returns.
 * Exit 0 only when every rule holds for every file.  The report lists, per file, its imports by giver, its exports and its host names. */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..');
const ARG0 = process.argv.indexOf('--dir'), TREE = ARG0 > 0 ? path.resolve(process.argv[ARG0 + 1]) : REPO;
const LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js')).forTree(TREE);
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) ARG[a.slice(2)] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true; }
function loadTs() {
  const tries = [process.env.TYPESCRIPT, 'typescript', path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript'), path.join(path.dirname(process.execPath), 'node_modules', 'typescript')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* the next */ } }
  return null;
}
const ts = loadTs();
if (!ts) { console.error('MODULES CHECK: NOT RUN - TypeScript is not installed (npm i -g typescript, or set TYPESCRIPT=<its folder>)'); process.exit(2); }
const HOST = new Set(['require', 'module', 'exports', 'process', 'Buffer', '__dirname', '__filename', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'URL']);
const GLOBAL_OBJECT = new Set(['globalThis', 'global']);                     // the global object: never used by the server's code
const LANG = new Set(['Math', 'Date', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Error', 'TypeError', 'RangeError', 'isFinite', 'isNaN', 'Promise', 'Symbol', 'RegExp', 'Infinity', 'NaN', 'undefined',
  'parseInt', 'parseFloat', 'BigInt', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView', 'Proxy', 'Reflect', 'Function', 'encodeURIComponent', 'decodeURIComponent']);
const BUILTIN = new Set(['http', 'fs', 'path', 'crypto', 'zlib']);              // TypeScript names these in require('http') when it has no Node types
const ASSIGN = new Set(['EqualsToken', 'PlusEqualsToken', 'MinusEqualsToken', 'AsteriskEqualsToken', 'AsteriskAsteriskEqualsToken', 'SlashEqualsToken', 'PercentEqualsToken',
  'LessThanLessThanEqualsToken', 'GreaterThanGreaterThanEqualsToken', 'GreaterThanGreaterThanGreaterThanEqualsToken', 'AmpersandEqualsToken', 'BarEqualsToken', 'CaretEqualsToken',
  'BarBarEqualsToken', 'AmpersandAmpersandEqualsToken', 'QuestionQuestionEqualsToken'].map(k => ts.SyntaxKind[k]));
function isWrite(id) {                                                         // the target of =, += ..., ++ / --, or for-in / for-of (as parts.js)
  let n = id, p = n.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isArrayLiteralExpression(p) || ts.isObjectLiteralExpression(p) || ts.isShorthandPropertyAssignment(p) || ts.isSpreadElement(p) || ts.isSpreadAssignment(p)
    || (ts.isPropertyAssignment(p) && p.initializer === n))) { n = p; p = p.parent; }
  if (p && ts.isBinaryExpression(p) && p.left === n && ASSIGN.has(p.operatorToken.kind)) return true;
  if (p && (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)) return true;
  if (p && (ts.isForInStatement(p) || ts.isForOfStatement(p)) && p.initializer === n) return true;
  return false;
}
function program(text) {
  const name = 'm.js', sf = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const host = { getSourceFile: f => f === name ? sf : undefined, getDefaultLibFileName: () => 'lib.d.ts', writeFile() {}, getCurrentDirectory: () => '/', getDirectories: () => [],
    fileExists: f => f === name, readFile: () => undefined, getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
  const p = ts.createProgram([name], { allowJs: true, checkJs: true, noEmit: true, noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022 }, host);
  return { sf, p, checker: p.getTypeChecker() };
}
/* the factory: module.exports = <function> at the top level (an arrow or a function expression); null for a module exporting an object */
function factoryOf(sf) {
  for (const s of sf.statements) if (ts.isExpressionStatement(s) && ts.isBinaryExpression(s.expression) && s.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && s.expression.left.getText(sf) === 'module.exports' && (ts.isArrowFunction(s.expression.right) || ts.isFunctionExpression(s.expression.right))) return s.expression.right;
  return null;
}
/* a parameter's bindings: [name, the key it was given under (for { ai: { eng } }: 'ai'), its identifier]; a plain parameter is its own key */
function bindings(prm) {
  const out = [];
  const walk = (b, key) => {
    if (ts.isIdentifier(b)) { out.push([b.text, key, b]); return; }
    for (const e of b.elements || []) { if (ts.isOmittedExpression(e)) continue; const k = key || (e.propertyName ? e.propertyName.getText() : (ts.isIdentifier(e.name) ? e.name.text : null)); walk(e.name, k); }
  };
  if (ts.isIdentifier(prm.name)) out.push([prm.name.text, prm.name.text, prm.name]); else walk(prm.name, null);
  return out;
}
/* the keys of the object a factory returns (its last top-level return of an object literal) */
function exportsOf(fn) {
  if (!fn || !fn.body || !ts.isBlock(fn.body)) return fn && fn.body && ts.isObjectLiteralExpression(fn.body) ? fn.body.properties.map(p => p.name && p.name.getText()).filter(Boolean) : null;
  const rets = fn.body.statements.filter(s => ts.isReturnStatement(s) && s.expression && ts.isObjectLiteralExpression(s.expression));
  if (!rets.length) return null;
  return rets[rets.length - 1].expression.properties.map(p => p.name ? p.name.getText() : null).filter(Boolean);
}
const R = { tool: 'dev/tools/checks/modules.js', typescript: ts.version, tree: TREE === REPO ? 'this repository' : TREE, files: {}, sim: null, problems: [], ok: true };
const problem = (f, m) => { R.problems.push(`${f}: ${m}`); R.ok = false; };
const SERVER = LAYOUT.serverFiles().filter(f => !f.startsWith('generated/'));
const SIM = new Set(LAYOUT.simFiles()), SIM_ROOT = LAYOUT.rel('sim.js');
const factories = {};
for (const f of SERVER) {
  const text = fs.readFileSync(path.join(TREE, f), 'utf8'), { sf, p, checker } = program(text), rec = { factory: false };
  /* 1. names */
  const names = new Set();
  for (const d of p.getSemanticDiagnostics(sf)) if ([2304, 2552, 2580, 2591, 2582, 2583, 2584, 2585].includes(d.code)) { const m = /'([^']+)'/.exec(ts.flattenDiagnosticMessageText(d.messageText, ' ')); if (m) names.add(m[1]); }
  const all = [...names].sort();
  rec.host = all.filter(n => HOST.has(n)); rec.language = all.filter(n => LANG.has(n)); rec.undeclared = all.filter(n => !HOST.has(n) && !LANG.has(n) && !BUILTIN.has(n));
  if (rec.undeclared.length) problem(f, `names used and declared nowhere: ${rec.undeclared.join(', ')}`);
  const globals = new Set();
  const declaredHere = id => { const s = checker.getSymbolAtLocation(id); return !!(s && s.valueDeclaration && s.valueDeclaration.getSourceFile() === sf); };
  (function walk(n) { if (ts.isIdentifier(n) && GLOBAL_OBJECT.has(n.text) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !declaredHere(n)) globals.add(n.text); ts.forEachChild(n, walk); })(sf);
  if (globals.size) problem(f, `reaches the global object: ${[...globals].join(', ')}`);
  const fn = factoryOf(sf);
  if (fn) {
    rec.factory = true; factories[f] = fn;
    const B = fn.parameters.flatMap(bindings), syms = new Map(B.map(([n, k, id]) => [checker.getSymbolAtLocation(id), { n, k, reads: 0, writes: 0 }]));
    (function walk(n) {
      if (ts.isIdentifier(n)) {
        const s = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
        const b = s && syms.get(s);
        if (b && !B.some(x => x[2] === n)) { if (isWrite(n)) b.writes++; else b.reads++; }
      }
      ts.forEachChild(n, walk);
    })(fn.body);
    rec.imports = {}; for (const b of syms.values()) (rec.imports[b.k] = rec.imports[b.k] || []).push(b.n);
    /* 2. imports are read only; 3. every import is used */
    const written = [...syms.values()].filter(b => b.writes).map(b => b.n), unused = [...syms.values()].filter(b => !b.reads && !b.writes).map(b => b.n);
    if (written.length) problem(f, `assigns names it was given: ${written.join(', ')}`);
    if (unused.length) problem(f, `is given names it never uses: ${unused.join(', ')}`);
    rec.exports = exportsOf(fn);
  }
  /* 4. a module of the sim keeps no state outside its factory */
  if (SIM.has(f)) {
    const extra = sf.statements.filter(s => !(ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use strict')
      && !(ts.isExpressionStatement(s) && ts.isBinaryExpression(s.expression) && s.expression.left.getText(sf) === 'module.exports' && s.expression.right === fn)
      && !(f === SIM_ROOT && ts.isVariableStatement(s) && s.declarationList.flags & ts.NodeFlags.Const && s.declarationList.declarations.every(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(sf) === 'require')));
    if (!fn) problem(f, 'a module of the sim without a factory (module.exports = function)');
    if (extra.length) problem(f, `a module of the sim with code outside its factory: ${extra.map(s => s.getText(sf).split('\n')[0].slice(0, 60)).join(' | ')}`);
    rec.sim = f === SIM_ROOT ? 'the composition' : 'a module';
  }
  R.files[f] = rec;
}
/* 5. the sim's composition: each module made from modules made before it; each imported name is an export of its giver */
if (LAYOUT.modern && fs.existsSync(path.join(TREE, SIM_ROOT))) {
  const text = fs.readFileSync(path.join(TREE, SIM_ROOT), 'utf8'), { sf } = program(text), req = new Map(), made = new Map(), order = [];
  for (const s of sf.statements) if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations)
    if (d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(sf) === 'require') req.set(d.name.getText(sf), path.posix.normalize(path.posix.join(path.posix.dirname(SIM_ROOT), d.initializer.arguments[0].text)));
  const root = factoryOf(sf), S = { modules: [], ok: true }, instances = new Set();
  (function find(n) { if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression) && req.has(n.initializer.expression.text) && ts.isIdentifier(n.name)) instances.add(n.name.text); ts.forEachChild(n, find); })(root || sf);
  (function walk(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression) && req.has(n.initializer.expression.text) && ts.isIdentifier(n.name)) {
      const file = req.get(n.initializer.expression.text), fn = factories[file], given = {};
      const arg = n.initializer.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) for (const p of arg.properties) { const k = p.name.getText(sf), v = ts.isShorthandPropertyAssignment(p) ? p.name.text : p.initializer.getText(sf); given[k] = v; }
      else if (arg && ts.isIdentifier(arg)) given['(positional)'] = arg.text;
      const rec = R.files[file], uses = [];
      if (!fn) problem(SIM_ROOT, `${n.name.text}: ${file} has no factory`);
      else for (const [k, names] of Object.entries(rec.imports || {})) {
        const v = given[k] !== undefined ? given[k] : given['(positional)'];
        if (v === undefined) { problem(SIM_ROOT, `${n.name.text} = ${n.initializer.expression.text}(...): its factory takes ${k}, which the composition does not give`); continue; }
        if (made.has(v)) {                                                          // a module made before: every name imported from it is one of its exports
          const giver = made.get(v), ex = R.files[giver.file].exports || [];
          const missing = names.filter(x => x !== k && !ex.includes(x));
          if (missing.length) problem(SIM_ROOT, `${n.name.text} imports from ${v} names it does not return: ${missing.join(', ')}`);
          uses.push(v);
        }
        else if (instances.has(v)) problem(SIM_ROOT, `${n.name.text} uses ${v}, made after it`);
      }
      made.set(n.name.text, { file }); order.push({ name: n.name.text, file, uses: [...new Set(uses)] });
      S.modules.push({ name: n.name.text, file, given: Object.keys(given), uses: [...new Set(uses)] });
    }
    ts.forEachChild(n, walk);
  })(root || sf);
  R.sim = S;
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
if (!ARG.quiet) for (const [f, r] of Object.entries(R.files)) console.log(`${R.problems.some(p => p.startsWith(f + ':')) ? 'FAIL' : 'ok  '} ${f}${r.factory ? `: given ${Object.entries(r.imports).map(([k, v]) => k === v[0] && v.length === 1 ? k : `${k} {${v.join(' ')}}`).join(', ') || 'nothing'}` : ''}${r.exports ? `; returns ${r.exports.join(' ')}` : ''}`);
if (R.sim && !ARG.quiet) console.log('the sim: ' + R.sim.modules.map(m => `${m.name}${m.uses.length ? ' <- ' + m.uses.join(' ') : ''}`).join('; '));
for (const p of R.problems) console.log('PROBLEM ' + p);
console.log(`MODULES CHECK: ${R.ok ? 'PASS' : 'FAIL'} (${Object.keys(R.files).length} server files, ${Object.values(R.files).filter(r => r.factory).length} factories${R.sim ? `; the sim: ${R.sim.modules.length} modules, wired in order` : ''})`);
process.exitCode = R.ok ? 0 : 1;
