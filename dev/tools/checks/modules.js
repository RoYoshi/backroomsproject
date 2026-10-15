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
/* ---------------------------------------------------------------- the page's scripts made of modules (continuation C3b, C3c)
 * A script whose last part is a composition (*.compose.js) is a set of modules inside the script's wrapper: each part but the last is one
 * factory, the last makes them.  The script is checked as the build assembles it (dev/tools/build/build.js: the parts in order, less their
 * headers), so what is checked is what the page runs:
 *   6. wrapper    the wrapper holds nothing but the factories (one per part) and the composition: no state shared outside a factory;
 *   7. closure    a factory uses only its own names, what it is given, and the page's globals: never a name of the wrapper (another
 *                 factory, a module the composition made): no hidden closure dependence;
 *   8. imports    as on the server: a factory never assigns what it is given, and uses all of it;
 *   9. links      the composition makes each module once, in the order of the parts, each from modules made before it, under the keys its
 *                 factory takes, and each imported name is one its giver returns; the part's header lists the same imports and exports;
 *  10. owners     no module writes a property of an object another owner's module made, nor changes it in place (C3c: set, delete,
 *                 clear, add, push, splice, fill ...), except to add its own entry to the script's public object (published on window, or
 *                 returned by the script), and each entry of a public object has one module that writes it; no module calls a function
 *                 that a third module put on another module's object (E.drawSmiler, put on the head's E by the Smiler's module): it
 *                 imports the function from the module that made it.  An object another script made, named from the global object (NET,
 *                 from window.__mpLib.interp), is that script's: each of its properties this script writes has one module that writes it;
 *  11. window     no module reads, through the global object, a name another module of the same script puts there: no global
 *                 back-channel; and (C3c) each name is put there by one module, and what is written through it (window.X.p = ...,
 *                 window.X.add(...)) has one module that writes it - the one that put X there, when this script does;
 *  12. late       (C3c) a module that calls modules made after it is given them late: `let` names declared with no value, assigned only
 *                 by its own wire({ key, ... }), which holds nothing but ({ name, ... } = key) statements; each used, never assigned
 *                 elsewhere, and never while the module is being made (at its top level, or in a function it calls then); the composition
 *                 calls each such module's wire once, after the last module is made, with modules made after it, each name one its giver
 *                 returns; the header's `late:` line lists them; no module imports wire.
 * (A part's owner is its framework folder, src/frameworks/<owner>/.) */
const PART_HEADER = /^\/\*\* @part [\s\S]*?\*\/\r?\n/;
const RECIPES_FILE = path.join(TREE, 'src', 'build-recipes.json');
const MUTATORS = new Set(['set', 'delete', 'clear', 'add', 'push', 'pop', 'shift', 'unshift', 'splice', 'fill', 'sort', 'reverse', 'copyWithin']);
R.page = {};
if (LAYOUT.modern && fs.existsSync(RECIPES_FILE)) {
  const seen = new Set();
  for (const o of JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8')).outputs) {
    if (!Array.isArray(o.parts) || o.parts.length < 2 || !o.parts[o.parts.length - 1].endsWith('.compose.js') || seen.has(o.parts.join('|'))) continue;
    seen.add(o.parts.join('|'));
    R.page[o.out] = pageScript(o);
  }
}
function pageScript(o) {
  const out = o.out, P = [], prob = m => problem(out, m);
  let text = '';
  for (const p of o.parts) {
    const raw = fs.readFileSync(path.join(TREE, p), 'utf8'), h = (raw.match(PART_HEADER) || [''])[0], body = raw.slice(h.length);
    /* a header line, with its continuation lines (indented further) joined (C3c) */
    const line = k => { const ls = h.split('\n'), i = ls.findIndex(l => l.startsWith(' * ' + k + ': ')); if (i < 0) return null; let v = ls[i].slice((' * ' + k + ': ').length);
      for (let j = i + 1; j < ls.length && /^ \*\s{3,}\S/.test(ls[j]); j++) v += ' ' + ls[j].replace(/^ \*\s+/, ''); return v.trim(); };
    P.push({ path: p, owner: (/^src\/frameworks\/([^/]+)\//.exec(p) || [, 'core'])[1], start: text.length, end: text.length + body.length, imports: line('imports'), exports: line('exports'), late: line('late') });
    text += body;
  }
  const name = out.replace(/[^\w.]/g, '_'), sf = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const host = { getSourceFile: f => f === name ? sf : undefined, getDefaultLibFileName: () => 'lib.d.ts', writeFile() {}, getCurrentDirectory: () => '/', getDirectories: () => [],
    fileExists: f => f === name, readFile: () => undefined, getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
  const checker = ts.createProgram([name], { allowJs: true, checkJs: false, noEmit: true, noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022 }, host).getTypeChecker();
  const partAt = pos => P.findIndex(p => pos >= p.start && pos < p.end), last = P.length - 1;
  const isName = n => (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) || (ts.isPropertyAssignment(n.parent) && n.parent.name === n) || (ts.isMethodDeclaration(n.parent) && n.parent.name === n)
    || (ts.isPropertyDeclaration(n.parent) && n.parent.name === n) || (ts.isGetAccessor(n.parent) && n.parent.name === n) || (ts.isSetAccessor(n.parent) && n.parent.name === n)
    || (ts.isBindingElement(n.parent) && n.parent.propertyName === n) || ts.isLabeledStatement(n.parent) || ts.isBreakOrContinueStatement(n.parent);
  const symOf = n => ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
  const declOf = n => { const s = symOf(n); return s && s.declarations && s.declarations.length ? s.declarations[0] : null; };
  const isGlobal = n => ts.isIdentifier(n) && !declOf(n);
  const isFnNode = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isConstructorDeclaration(n);
  const GLOBAL_ROOTS = ['window', 'self', 'globalThis'];
  /* an expression made only of property accesses from a global name (window.__mpLib.interp; no call): another script's object */
  const globalRooted = e => { while (e && (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isParenthesizedExpression(e))) e = e.expression; return !!e && isGlobal(e); };
  /* the wrapper: the function with the largest block body (as the parts check finds it) */
  let wrap = null;
  (function walk(n) { if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isFunctionDeclaration(n)) && n.body && ts.isBlock(n.body) && (!wrap || n.body.end - n.body.pos > wrap.body.end - wrap.body.pos)) wrap = n; ts.forEachChild(n, walk); })(sf);
  /* 6. the wrapper's own statements: a factory per module part; the composition's calls, consts and the script's return */
  const M = P.slice(0, last).map(p => ({ path: p.path, owner: p.owner, fn: null, part: p })), first = l => l.getText(sf).split('\n')[0].slice(0, 70);
  for (const s of wrap.body.statements) {
    const k = partAt(s.getStart(sf));
    if (k < 0) { prob(`a statement outside every part: ${first(s)}`); continue; }
    if (k < last) {
      if (ts.isFunctionDeclaration(s) && s.name && !M[k].fn) M[k].fn = s;
      else if (!(k === 0 && ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use strict')) prob(`${P[k].path}: code outside its factory, in the script's wrapper: ${first(s)}`);
    }
  }
  M.forEach(m => { if (!m.fn) prob(`${m.path}: no factory`); else m.factory = m.fn.name.text; });
  const byFactory = new Map(M.filter(m => m.fn).map(m => [m.factory, m]));
  /* 7. closure, 8. imports: every name a factory uses is its own, given to it, or a global */
  for (const m of M.filter(x => x.fn)) {
    const fn = m.fn, inside = d => d.getSourceFile() === sf && d.pos >= fn.pos && d.end <= fn.end;
    if (fn.parameters.length > 1) prob(`${m.path}: ${m.factory} takes more than one parameter`);
    const B = fn.parameters.length ? bindings(fn.parameters[0]) : [], syms = new Map(B.map(([n, k, id]) => [checker.getSymbolAtLocation(id), { n, k, reads: 0, writes: 0 }]));
    m.imports = {}; for (const [n, k] of B) (m.imports[k] = m.imports[k] || []).push(n);
    m.globals = new Set(); m.paramSyms = syms;
    (function walk(n) {
      if (ts.isIdentifier(n) && !isName(n)) {
        const s = symOf(n), d = s && s.declarations && s.declarations.length ? s.declarations[0] : null;
        if (!d) m.globals.add(n.text);
        else if (!inside(d)) prob(`${m.path}: ${m.factory} uses ${n.text}, declared outside its factory (${partAt(d.getStart(sf)) >= 0 ? P[partAt(d.getStart(sf))].path : 'the wrapper'}): a hidden closure dependence`);
        const b = s && syms.get(s); if (b && !B.some(x => x[2] === n)) { if (isWrite(n)) b.writes++; else b.reads++; }
      }
      ts.forEachChild(n, walk);
    })(fn);
    const written = [...syms.values()].filter(b => b.writes).map(b => b.n), unused = [...syms.values()].filter(b => !b.reads && !b.writes).map(b => b.n);
    if (written.length) prob(`${m.path}: ${m.factory} assigns names it was given: ${written.join(', ')}`);
    if (unused.length) prob(`${m.path}: ${m.factory} is given names it never uses: ${unused.join(', ')}`);
    if (B.some(([n]) => n === 'wire')) prob(`${m.path}: ${m.factory} imports wire: only the composition calls a module's wire`);
    m.exports = exportsOf(fn) || [];
    m.locals = new Map(); m.extLocals = new Map();
    for (const st of fn.body.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) { if (d.initializer && globalRooted(d.initializer)) m.extLocals.set(d.name.text, d); else m.locals.set(d.name.text, d); }
      else if (d.initializer && globalRooted(d.initializer)) for (const [n2, , id2] of bindings({ name: d.name })) m.extLocals.set(n2, id2.parent);   // named from another script's object
    }
    m.external = new Set([...m.extLocals.keys()].filter(n2 => m.exports.includes(n2)));
    /* 12. late: the module's wire, the names it is given late, and that none is used while the module is being made */
    const wireFn = fn.body.statements.find(s => ts.isFunctionDeclaration(s) && s.name && s.name.text === 'wire');
    if (!wireFn) { if (m.part.late !== null) prob(`${m.path}: its header lists names given late, and ${m.factory} has no wire`); continue; }
    const L = { keys: [], names: new Map(), syms: new Map() };
    const prm = wireFn.parameters;
    if (prm.length !== 1 || !ts.isObjectBindingPattern(prm[0].name) || prm[0].name.elements.some(e => e.propertyName || !ts.isIdentifier(e.name) || e.initializer || e.dotDotDotToken)) prob(`${m.path}: ${m.factory}'s wire takes something other than one object of modules ({ key, ... })`);
    else L.keys = prm[0].name.elements.map(e => e.name.text);
    for (const s of wireFn.body.statements) {
      const e = ts.isExpressionStatement(s) && ts.isParenthesizedExpression(s.expression) ? s.expression.expression : null;
      if (!e || !ts.isBinaryExpression(e) || e.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isObjectLiteralExpression(e.left) || !ts.isIdentifier(e.right) || !L.keys.includes(e.right.text) || e.left.properties.some(p => !ts.isShorthandPropertyAssignment(p))) { prob(`${m.path}: ${m.factory}'s wire holds something other than ({ name, ... } = key): ${first(s)}`); continue; }
      if (L.names.has(e.right.text)) prob(`${m.path}: ${m.factory}'s wire takes from ${e.right.text} twice`);
      L.names.set(e.right.text, e.left.properties.map(p => p.name.text));
      for (const p of e.left.properties) {
        const sym = checker.getShorthandAssignmentValueSymbol(p), d = sym && sym.declarations && sym.declarations[0];
        if (!d || !ts.isVariableDeclaration(d) || d.initializer || !(d.parent.flags & ts.NodeFlags.Let) || d.parent.parent.parent !== fn.body) prob(`${m.path}: ${m.factory}'s wire assigns ${p.name.text}, not a name the factory declares with let and no value`);
        else if (L.syms.has(sym)) prob(`${m.path}: ${m.factory}'s wire assigns ${p.name.text} twice`);
        else L.syms.set(sym, p.name.text);
      }
    }
    for (const k of L.keys) if (!L.names.has(k)) prob(`${m.path}: ${m.factory}'s wire is given ${k} and takes nothing from it`);
    /* what runs while the module is being made: its top level, the functions it calls then (to a fixed point), and functions called in place */
    const localFns = new Map(fn.body.statements.filter(s => ts.isFunctionDeclaration(s) && s.name).map(s => [s.name.text, s]));
    const atMake = new Set([fn]);
    const callsIn = (root, add) => (function walk(n) { if (n !== root && isFnNode(n)) { if (ts.isCallExpression(n.parent) && n.parent.expression === n || (ts.isParenthesizedExpression(n.parent) && ts.isCallExpression(n.parent.parent) && n.parent.parent.expression === n.parent)) add(n); return; }
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && localFns.has(n.expression.text) && declOf(n.expression) === localFns.get(n.expression.text)) add(localFns.get(n.expression.text)); ts.forEachChild(n, walk); })(root);
    for (let grew = true; grew;) { grew = false; for (const f of [...atMake]) callsIn(f, g => { if (!atMake.has(g)) { atMake.add(g); grew = true; } }); }
    const used = new Set();
    (function walk(n, owner) {
      if (ts.isIdentifier(n) && !isName(n)) {
        const nm = !(ts.isVariableDeclaration(n.parent) && n.parent.name === n) && L.syms.get(symOf(n));
        if (nm && !(n.pos >= wireFn.pos && n.end <= wireFn.end)) {
          used.add(nm);
          if (isWrite(n)) prob(`${m.path}: ${m.factory} assigns ${nm}, a name wire gives it late`);
          if (atMake.has(owner)) prob(`${m.path}: ${m.factory} uses ${nm}, given late, while it is being made`);
        }
      }
      ts.forEachChild(n, c => walk(c, isFnNode(c) ? c : owner));
    })(fn.body, fn);
    for (const nm of L.syms.values()) if (!used.has(nm)) prob(`${m.path}: ${m.factory} is given ${nm} late and never uses it`);
    const want = [...L.names].map(([k, ns]) => `${k} { ${[...ns].sort().join(' ')} }`).sort().join(', ') || '-';
    const said = (m.part.late || '').split(/,\s*(?=[\w$]+ \{)/).map(x => x.replace(/\{\s*([^}]*)\}/, (a, ns) => '{ ' + ns.trim().split(/\s+/).sort().join(' ') + ' }').trim()).sort().join(', ') || '-';
    if (m.part.late === null || said !== want) prob(`${m.path}: its header's late names (${m.part.late}) are not what its wire takes (${want})`);
    if (!m.exports.includes('wire')) prob(`${m.path}: ${m.factory} has a wire it does not return`);
    m.late = L;
  }
  /* 9. links: the composition (12: and its late wiring, after the last module is made) */
  const C = { made: [], wired: [], ok: true }, consts = new Map();
  const callOf = e => e && ts.isCallExpression(e) && ts.isIdentifier(e.expression) && byFactory.has(e.expression.text) ? e : null;
  const wires = [];
  for (const s of wrap.body.statements.filter(x => partAt(x.getStart(sf)) === last)) {
    let call = null, as = null;
    if (ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && ts.isPropertyAccessExpression(s.expression.expression) && s.expression.expression.name.text === 'wire'
      && ts.isIdentifier(s.expression.expression.expression) && consts.has(s.expression.expression.expression.text)) { wires.push({ s, at: C.made.length, g: consts.get(s.expression.expression.expression.text), as: s.expression.expression.expression.text, call: s.expression }); continue; }
    if (ts.isVariableStatement(s) && s.declarationList.declarations.length === 1 && (s.declarationList.flags & ts.NodeFlags.Const) && ts.isIdentifier(s.declarationList.declarations[0].name)) { call = callOf(s.declarationList.declarations[0].initializer); as = s.declarationList.declarations[0].name.text; }
    else if (ts.isExpressionStatement(s)) call = callOf(s.expression);
    else if (ts.isReturnStatement(s) && s.expression && ts.isPropertyAccessExpression(s.expression) && ts.isIdentifier(s.expression.expression) && consts.has(s.expression.expression.text)) {
      const g = consts.get(s.expression.expression.text), nm = s.expression.name.text;
      if (!g.exports.includes(nm)) prob(`the composition returns ${s.expression.getText(sf)}, which ${g.factory} does not return`);
      g.returned = nm; C.returns = s.expression.getText(sf); continue;
    }
    if (!call) { prob(`the composition holds something other than the modules' making: ${first(s)}`); continue; }
    if (wires.length) prob(`${call.expression.text} is made after a module's wire: every module is made before the late wiring`);
    const m = byFactory.get(call.expression.text), given = {};
    if (m.made) prob(`${m.factory} is made twice`); m.made = true; m.order = C.made.length;
    const arg = call.arguments[0];
    if (call.arguments.length > 1 || (arg && !ts.isObjectLiteralExpression(arg))) prob(`${m.factory} is not given one object of modules`);
    else if (arg) for (const p of arg.properties) {
      const key = p.name && p.name.getText(sf), val = ts.isShorthandPropertyAssignment(p) ? p.name.text : ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer) ? p.initializer.text : null;
      if (!val || !consts.has(val)) { prob(`${m.factory} is given ${key}: ${val ? val + ', not a module made before it' : 'not a module'}`); continue; }
      given[key] = consts.get(val);
    }
    const takes = Object.keys(m.imports || {}), keys = Object.keys(given);
    for (const k of takes) if (!given[k]) prob(`${m.factory} takes ${k}, which the composition does not give`);
    for (const k of keys) if (!takes.includes(k)) prob(`${m.factory} is given ${k}, which it does not take`);
    for (const [k, g] of Object.entries(given)) { const missing = (m.imports[k] || []).filter(x => !g.exports.includes(x)); if (missing.length) prob(`${m.factory} imports from ${k} (${g.factory}) names it does not return: ${missing.join(', ')}`); }
    m.givers = given;
    if (as) consts.set(as, m);
    C.made.push({ module: as || '-', factory: m.factory, from: Object.entries(given).map(([k, g]) => `${k}=${g.factory}`) });
  }
  const order = C.made.map(x => x.factory), expected = M.filter(m => m.fn).map(m => m.factory);
  if (order.join() !== expected.join()) prob(`the composition makes ${order.join(', ')}; the parts run ${expected.join(', ')}`);
  /* 12. each module with names given late is wired once, with the modules made after it under the keys its wire takes */
  const wiredBy = new Map();
  for (const w of wires) {
    if (!w.g.late) { prob(`the composition calls ${w.as}.wire, and ${w.g.factory} has no wire`); continue; }
    if (wiredBy.has(w.g)) prob(`${w.g.factory} is wired twice`); wiredBy.set(w.g, w);
    const arg = w.call.arguments[0], given = {};
    if (w.call.arguments.length !== 1 || !ts.isObjectLiteralExpression(arg)) { prob(`${w.as}.wire is not given one object of modules`); continue; }
    for (const p of arg.properties) {
      const key = p.name && p.name.getText(sf), val = ts.isShorthandPropertyAssignment(p) ? p.name.text : ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer) ? p.initializer.text : null, g = val && consts.get(val);
      if (!g) { prob(`${w.as}.wire is given ${key}: not a module`); continue; }
      if (!(g.order > w.g.order)) prob(`${w.as}.wire is given ${key} (${g.factory}), made before ${w.g.factory}: a module made before is an import, not a late name`);
      given[key] = g;
    }
    for (const k of w.g.late.keys) if (!given[k]) prob(`${w.g.factory}'s wire takes ${k}, which the composition does not give`);
    for (const k of Object.keys(given)) if (!w.g.late.keys.includes(k)) prob(`${w.as}.wire is given ${k}, which its wire does not take`);
    for (const [k, ns] of w.g.late.names) { const g = given[k]; const missing = g ? ns.filter(x => !g.exports.includes(x)) : []; if (missing.length) prob(`${w.g.factory} takes late from ${k} (${g.factory}) names it does not return: ${missing.join(', ')}`); }
    C.wired.push({ module: w.as, factory: w.g.factory, from: Object.entries(given).map(([k, g]) => `${k}=${g.factory}`) });
  }
  for (const m of M.filter(x => x.late)) if (!wiredBy.has(m)) prob(`${m.factory} has names given late, and the composition never calls its wire`);
  for (const m of M.filter(x => x.fn)) {                                                     // the header says what the code says
    const want = Object.entries(m.imports || {}).map(([k, ns]) => `${k} { ${[...ns].sort().join(' ')} }`).sort().join(', ') || '-';
    const said = (P[M.indexOf(m)].imports || '').split(/,\s*(?=[\w$]+ \{)/).map(x => x.replace(/\{\s*([^}]*)\}/, (a, ns) => '{ ' + ns.trim().split(/\s+/).sort().join(' ') + ' }').trim()).sort().join(', ') || '-';
    if (P[M.indexOf(m)].imports === null || said !== want) prob(`${m.path}: its header's imports (${P[M.indexOf(m)].imports}) are not what its factory takes (${want})`);
    const ex = [...m.exports].sort().join(', ') || '-', hx = (P[M.indexOf(m)].exports || '').split(/,\s*/).filter(x => x && x !== '-').sort().join(', ') || '-';
    if (P[M.indexOf(m)].exports === null || hx !== ex) prob(`${m.path}: its header's exports (${P[M.indexOf(m)].exports}) are not what its factory returns (${ex})`);
  }
  /* 10. owners, 11. window: the objects modules share, and what they put on, and write through, the global object */
  const objOf = (m, id) => {                                                                   // the shared object an identifier names: the module that made it (or named it, ext: another script's), its name
    const s = symOf(id), b = s && m.paramSyms.get(s);
    if (b) { const g = m.givers && m.givers[b.k]; return g ? { mod: g, name: b.n, ext: g.external.has(b.n) } : null; }
    const d = s && s.declarations && s.declarations[0];
    if (d && m.locals.get(id.text) === d && m.exports.includes(id.text)) return { mod: m, name: id.text, ext: false };
    if (d && m.extLocals.has(id.text) && (m.extLocals.get(id.text) === d || m.extLocals.get(id.text) === d.parent)) return { mod: m, name: id.text, ext: true };
    return null;
  };
  const publicObj = new Set(), entries = new Map(), win = new Map(), calls = [], winReads = [], winW = new Map(), extW = new Map();
  const key = (g, n) => g.factory + '.' + n, addTo = (map, k, m) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(m); };
  for (const m of M.filter(x => x.fn)) {
    for (const [n, d] of m.locals) {                                                        // a module's export published on window, or returned by the script
      let e = d.initializer; while (e && ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken) { if (ts.isPropertyAccessExpression(e.left) && isGlobal(e.left.expression) && e.left.expression.text === 'window' && m.exports.includes(n)) publicObj.add(key(m, n)); e = e.right; }
      if (e && ts.isObjectLiteralExpression(e) && m.exports.includes(n)) for (const p of e.properties) if (p.name) addTo(entries, key(m, n) + '|' + p.name.getText(sf), m);
    }
    if (m.returned) publicObj.add(key(m, m.returned));
    (function walk(n) {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && isGlobal(n.left.expression) && GLOBAL_ROOTS.includes(n.left.expression.text)) {
        addTo(win, n.left.name.text, m);
        if (ts.isIdentifier(n.right) && objOf(m, n.right) && objOf(m, n.right).mod === m && !objOf(m, n.right).ext) publicObj.add(key(m, n.right.text));
      }
      /* what is written through the global object: window.X.p = ..., delete window.X.p, window.X.add(...) (C3c) */
      if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && ts.isPropertyAccessExpression(n.expression) && isGlobal(n.expression.expression) && GLOBAL_ROOTS.includes(n.expression.expression.text)) {
        const X = n.expression.name.text, p = ts.isPropertyAccessExpression(n) ? n.name.text : '[' + n.argumentExpression.getText(sf) + ']';
        const del = n.parent && ts.isDeleteExpression(n.parent), mut = ts.isCallExpression(n.parent) && n.parent.expression === n && MUTATORS.has(p);
        if (isWrite(n) || del) addTo(winW, X + '|.' + p, m); else if (mut) addTo(winW, X + '|, in place (' + p + ')', m);
      }
      if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && ts.isIdentifier(n.expression)) {
        if (isGlobal(n.expression) && GLOBAL_ROOTS.includes(n.expression.text) && ts.isPropertyAccessExpression(n) && !(isWrite(n) && ts.isBinaryExpression(n.parent))) winReads.push([m, n.name.text]);
        const ob = objOf(m, n.expression);
        if (ob) {
          const p = ts.isPropertyAccessExpression(n) ? n.name.text : '[' + n.argumentExpression.getText(sf) + ']', k = key(ob.mod, ob.name) + '|' + p;
          const del = n.parent && ts.isDeleteExpression(n.parent), isCall = ts.isCallExpression(n.parent) && n.parent.expression === n;
          if (ob.ext) { if (isWrite(n) || del) addTo(extW, k, m); else if (isCall && MUTATORS.has(p)) addTo(extW, key(ob.mod, ob.name) + '|, in place (' + p + ')', m); }
          else if (isWrite(n) || del) { addTo(entries, k, m); if (ob.mod.owner !== m.owner) (m.crossWrites = m.crossWrites || []).push([ob, p]); }
          else if (isCall && MUTATORS.has(p)) { if (ob.mod.owner !== m.owner) (m.crossMut = m.crossMut || []).push([ob, p]); }
          else if (isCall) calls.push([m, ob, p]);
        }
      }
      if (ts.isIdentifier(n) && !isName(n) && isGlobal(n)) winReads.push([m, n.text]);
      ts.forEachChild(n, walk);
    })(m.fn.body);
  }
  for (const m of M.filter(x => x.fn)) for (const [ob, p] of m.crossWrites || []) if (!publicObj.has(key(ob.mod, ob.name))) prob(`${m.path}: ${m.factory} (${m.owner}) writes ${ob.name}.${p}, state of ${ob.mod.factory} (${ob.mod.owner}): another owner's state changes only through a function its owner gives`);
  for (const m of M.filter(x => x.fn)) for (const [ob, p] of m.crossMut || []) prob(`${m.path}: ${m.factory} (${m.owner}) changes ${ob.name} in place (${p}), state of ${ob.mod.factory} (${ob.mod.owner}): another owner's state changes only through a function its owner gives`);
  for (const [k, ms] of entries) if (publicObj.has(k.split('|')[0]) && ms.size > 1) prob(`${k.replace('|', ': the entry ')} is written by ${[...ms].map(x => x.factory).join(' and ')}: an entry of a public object has one module that writes it`);
  for (const [k, ms] of extW) if (ms.size > 1) prob(`${k.replace('|', ' ')} (another script's object) is written by ${[...ms].map(x => x.factory).join(' and ')}: what this script writes of it has one module that writes it`);
  for (const [m, ob, p] of calls) { const w = entries.get(key(ob.mod, ob.name) + '|' + p); if (w && w.size === 1 && !w.has(m) && !w.has(ob.mod)) prob(`${m.path}: ${m.factory} calls ${ob.name}.${p} (${ob.mod.factory}'s object), which ${[...w][0].factory} puts there: a dependence on ${[...w][0].factory} its imports do not show; it imports the function from that module instead`); }
  for (const [m, nm] of winReads) { const w = win.get(nm); if (w && !w.has(m)) prob(`${m.path}: ${m.factory} reads ${nm} through the global object, which ${[...w].map(x => x.factory).join(', ')} of the same script put there: a global back-channel`); }
  for (const [nm, ms] of win) if (ms.size > 1) prob(`window.${nm} is put there by ${[...ms].map(x => x.factory).join(' and ')}: one module puts each name on the global object`);
  for (const [k, ms] of winW) { const X = k.split('|')[0], w = win.get(X), what = 'window.' + X + k.split('|')[1];
    if (ms.size > 1) prob(`${what} is written by ${[...ms].map(x => x.factory).join(' and ')}: what is written through the global object has one module that writes it`);
    else if (w && !w.has([...ms][0])) prob(`${[...ms][0].path}: ${[...ms][0].factory} writes ${what}, which ${[...w].map(x => x.factory).join(', ')} put there: another owner's state, through the global object`); }
  return { modules: M.filter(x => x.fn).map(m => ({ path: m.path, owner: m.owner, factory: m.factory, imports: m.imports, exports: m.exports, late: m.late ? Object.fromEntries(m.late.names) : null, globals: [...m.globals].sort() })),
    composition: C.made, wired: C.wired, returns: C.returns || null, publicObjects: [...publicObj].sort(), windowNames: Object.fromEntries([...win].map(([k, v]) => [k, [...v].map(x => x.factory)])),
    writtenThroughWindow: Object.fromEntries([...winW].map(([k, v]) => ['window.' + k.split('|')[0] + k.split('|')[1], [...v].map(x => x.factory)])) };
}

if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
if (!ARG.quiet) for (const [f, r] of Object.entries(R.files)) console.log(`${R.problems.some(p => p.startsWith(f + ':')) ? 'FAIL' : 'ok  '} ${f}${r.factory ? `: given ${Object.entries(r.imports).map(([k, v]) => k === v[0] && v.length === 1 ? k : `${k} {${v.join(' ')}}`).join(', ') || 'nothing'}` : ''}${r.exports ? `; returns ${r.exports.join(' ')}` : ''}`);
if (R.sim && !ARG.quiet) console.log('the sim: ' + R.sim.modules.map(m => `${m.name}${m.uses.length ? ' <- ' + m.uses.join(' ') : ''}`).join('; '));
if (!ARG.quiet) for (const [out, s] of Object.entries(R.page)) console.log(`${R.problems.some(p => p.startsWith(out + ':')) ? 'FAIL' : 'ok  '} ${out}: ${s.composition.map(c => `${c.module === '-' ? '' : c.module + ' = '}${c.factory}${c.from.length ? '(' + c.from.join(' ') + ')' : ''}`).join('; ')}${s.publicObjects.length ? '; public objects ' + s.publicObjects.join(' ') : ''}${(s.wired || []).map(w => `; then ${w.module}.wire(${w.from.join(' ')})`).join('')}${Object.keys(s.writtenThroughWindow || {}).length ? '; written through window: ' + Object.entries(s.writtenThroughWindow).map(([k, v]) => `${k} by ${v.join(' and ')}`).join(', ') : ''}`);
for (const p of R.problems) console.log('PROBLEM ' + p);
const pageModules = Object.values(R.page).reduce((a, s) => a + s.modules.length, 0);
console.log(`MODULES CHECK: ${R.ok ? 'PASS' : 'FAIL'} (${Object.keys(R.files).length} server files, ${Object.values(R.files).filter(r => r.factory).length} factories${R.sim ? `; the sim: ${R.sim.modules.length} modules, wired in order` : ''}; the page: ${Object.keys(R.page).length} scripts, ${pageModules} modules)`);
process.exitCode = R.ok ? 0 : 1;
