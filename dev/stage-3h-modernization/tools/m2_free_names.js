/* Stage 3H engine modernization (H3M-2) - the names each server file uses without declaring them (development only; needs TypeScript's
 * checker: the package `typescript`, Node's global copy, or $TYPESCRIPT).
 *
 *   node dev/stage-3h-modernization/tools/m2_free_names.js [--base f2db9d8] [--out FILE.json]
 *
 * For server.js at --base (before the split) and for server.js and the five modules split out of it, TypeScript's checker lists every
 * name a file uses that nothing in it declares.  A module split out of server.js must use nothing but its factory's parameters and the
 * host's globals (require, process, console, the timers, Buffer, URL ...): a name it used from server.js and was not given would be a
 * ReferenceError only when that code runs.  Its "Cannot find name" diagnostics are the measure; the host globals are listed apart (no
 * Node types are loaded, so the checker does not know them), and so are the names of the modules server.js requires itself (TypeScript
 * reports those under the same code).  A self-test runs first: poses.js with its one parameter taken away must be reported. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ARG = { base: 'f2db9d8070661f810820d79f430429d24b6707ad' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
const ts = [process.env.TYPESCRIPT, 'typescript', path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript')].filter(Boolean).reduce((t, p) => { if (t) return t; try { return require(p); } catch (e) { return null; } }, null);
if (!ts) { console.error('NOT RUN: TypeScript is not installed'); process.exit(2); }
const HOST = new Set(['require', 'module', 'exports', 'process', 'Buffer', '__dirname', '__filename', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'URL', 'global']);
const BUILTIN = new Set(['http', 'fs', 'path', 'crypto', 'zlib']);                 // TypeScript names these in require('http') when it has no Node types
const files = [['server.js (at the base)', execFileSync('git', ['-C', REPO, 'show', ARG.base + ':server.js']).toString('utf8')]].concat(
  ['server.js', 'src/frameworks/space/server/movement.js', 'src/core/server/rooms.js', 'src/frameworks/overseer/server/admin.js', 'src/frameworks/bpp/server/poses.js', 'src/core/server/loop.js']
    .map(f => [f, fs.readFileSync(path.join(REPO, f), 'utf8')]));
const R = { tool: 'dev/stage-3h-modernization/tools/m2_free_names.js', base: ARG.base, typescript: ts.version, files: {}, ok: true };
/* a self-test first: poses.js without its one parameter must be reported (send undeclared) */
files.unshift(['self-test: poses.js without its parameter', fs.readFileSync(path.join(REPO, 'src/frameworks/bpp/server/poses.js'), 'utf8').replace('module.exports = ({ send }) => {', 'module.exports = ({ }) => {')]);
for (const [label, text] of files) {
  const name = 'f.js', sf = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const host = { getSourceFile: f => f === name ? sf : undefined, getDefaultLibFileName: () => 'lib.d.ts', writeFile() {}, getCurrentDirectory: () => '/', getDirectories: () => [], fileExists: f => f === name, readFile: () => undefined, getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
  const p = ts.createProgram([name], { allowJs: true, checkJs: true, noEmit: true, noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022 }, host);
  const names = new Set();
  for (const d of p.getSemanticDiagnostics(sf)) if ([2304, 2552, 2580, 2591, 2582, 2583, 2584, 2585].includes(d.code)) { const m = /'([^']+)'/.exec(ts.flattenDiagnosticMessageText(d.messageText, ' ')); if (m) names.add(m[1]); }
  const all = [...names].sort(), host_ = all.filter(n => HOST.has(n)), builtin = all.filter(n => BUILTIN.has(n)), other = all.filter(n => !HOST.has(n) && !BUILTIN.has(n));
  /* the base lib's own globals (Math, Date, JSON, Map ...) are unknown with noLib too: they are the language's, listed apart */
  const LANG = new Set(['Math', 'Date', 'JSON', 'Map', 'Set', 'WeakMap', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Error', 'isFinite', 'Promise', 'Symbol', 'RegExp', 'Infinity', 'NaN', 'undefined', 'parseInt', 'parseFloat', 'BigInt']);
  const lang = other.filter(n => LANG.has(n)), rest = other.filter(n => !LANG.has(n));
  R.files[label] = { undeclared: rest, hostGlobals: host_, language: lang, requiredModules: builtin };
  if (label.startsWith('self-test')) { const ok = rest.length === 1 && rest[0] === 'send'; R.selfTest = ok; if (!ok) R.ok = false; console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: undeclared ${rest.join(', ') || 'none'} (must be: send)`); continue; }
  if (rest.length) R.ok = false;
  console.log(`${rest.length ? 'FAIL' : 'ok  '} ${label}: undeclared ${rest.join(', ') || 'none'}; host ${host_.join(', ') || '-'}; language ${lang.join(', ') || '-'}`);
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log('FREE NAMES: ' + (R.ok ? 'every name is declared, a factory parameter, or the host\'s or the language\'s' : 'UNDECLARED NAMES'));
process.exitCode = R.ok ? 0 : 1;
