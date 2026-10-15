/* Stage 3H engine modernization (H3M-6) - the window.__api contract ledger (development only; its output is committed).
 *
 *   node dev/stage-3h-modernization/tools/api_contract.js [--lineage src/core/client/bundle/lineage] [--out <file.json>] [--typescript <dir>]
 *        [--repo <dir>]   (another checkout to read, e.g. M8's files from git archive; then give --out too)
 *        [--check 1]      (continuation C5, the gate's lineage step: writes nothing; fails if the committed contract is not what it gives)
 *
 * window.__api is the compiled bundle's facade: the object it publishes for the classic scripts.  Some of its members are the bundle's
 * minified internal names, so they are a de-facto public API.  For every member this tool records:
 *   - what it is: the property's own text (a shorthand binding, a function, a value) and the bundle's top-level names it refers to;
 *   - who wrote it: the lineage step whose text holds the member ("v11" = the original build, which had no __api at all) and, for every
 *     name it refers to, where that name is declared: an original v11 declaration (with the TypeScript module and unit it compiled from,
 *     from module_map.json) or a later step's text;
 *   - who reads it: every first-party script the page loads (public/, not the bundle and not the PixiJS chunks), by property accesses on
 *     window.__api or on a local name bound to it (const A = window.__api, A = window.__api || {}, const {x} = window.__api), or on a
 *     name a module script's factory imports from the module that binds it (since continuation C3b: entsHound({ head: { API } })), and
 *     the bundle's own reads of window.__api.  Not counted: a read through a function's parameter that its caller fills with the
 *     object (mp.js: softTp(A, x, y), blendStep(A), markKiller(A, by)); the run-time reads are the traces' to compare.
 * The positions come from TypeScript's parser (its own copy of the global TypeScript package, for the parser only).
 * (Continuation C4) The bundle described is the one the lineage records (its "written by" and "is" come from the lineage's blame and
 * module map).  While the bundle's chain is in force (up to C4a) that is the served file; once the ledger marks it superseded (C4b:
 * the served bundle is built from src/core/client/game/), the recorded one is replayed from the ledger (v11's build and the forty
 * steps), and the served bundle must publish the same members, in the same order, and read the same members of window.__api as often:
 * checked here, and the contract says so (builtBundle). */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = ARG.repo ? path.resolve(ARG.repo) : path.resolve(__dirname, '..', '..', '..');
const LIN = path.resolve(REPO, ARG.lineage || 'src/core/client/bundle/lineage');
/* TypeScript's parser: --typescript DIR, or (C5) where dev/tools/checks/parts.js and modules.js find it: $TYPESCRIPT, the package, Node's global copy */
const ts = (() => { for (const t of [ARG.typescript, process.env.TYPESCRIPT, 'typescript', path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript'), path.join(path.dirname(process.execPath), 'node_modules', 'typescript')].filter(Boolean)) { try { return require(t); } catch (e) { /* the next */ } }
  console.error('API CONTRACT: NOT RUN - TypeScript is not installed (npm i -g typescript, or set TYPESCRIPT=<its folder>)'); process.exit(2); })();
const BUNDLE = path.join(REPO, 'public', 'assets', 'index-DKbV5Nv9.js'), sha = b => require('crypto').createHash('sha256').update(b).digest('hex');
/* the recorded bundle: the ledger's replay when its chain is superseded (C4), else the served file (an older tree: --repo) */
function recorded() {
  const L = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8')), F = L.files.bundle;
  if (!F.superseded) return fs.readFileSync(BUNDLE);
  let cur = fs.readFileSync(path.join(REPO, F.base.path)); if (sha(cur) !== F.base.sha256) throw new Error('the ledger base is not the recorded file');
  for (const st of F.steps) {
    const P = JSON.parse(fs.readFileSync(path.join(LIN, st.patch), 'utf8')), parts = []; let pos = 0;
    if (P.before.sha256 !== sha(cur)) throw new Error(`step ${st.id} was not made on the version before it`);
    for (const [at, del, ins] of P.hunks) { const d = Buffer.from(del, 'utf8'); if (!cur.subarray(at, at + d.length).equals(d)) throw new Error(`step ${st.id}: a hunk does not match`); parts.push(cur.subarray(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length; }
    parts.push(cur.subarray(pos)); cur = Buffer.concat(parts);
  }
  if (sha(cur) !== F.result.sha256) throw new Error('the replay did not end at the recorded result');
  return cur;
}
const buf = recorded(), text = buf.toString('utf8');
const toByte = i => Buffer.byteLength(text.slice(0, i));
const blame = JSON.parse(fs.readFileSync(path.join(LIN, 'blame.json'), 'utf8'));
const mmap = JSON.parse(fs.readFileSync(path.join(LIN, 'module_map.json'), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8'));
const stepById = new Map(ledger.files.bundle.steps.map(s => [s.id, s]));
if (blame.modernBytes !== buf.length) throw new Error('blame.json is for a bundle of ' + blame.modernBytes + ' bytes; this one has ' + buf.length);

/* byte offset in the modern bundle -> who wrote it */
const segStarts = []; { let p = 0; for (const g of blame.segments) { segStarts.push(p); p += g[2]; } }
function origin(byteOff) {
  let lo = 0, hi = blame.segments.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segStarts[m] <= byteOff) lo = m; else hi = m - 1; }
  const [o, s] = blame.segments[lo], inner = s + (byteOff - segStarts[lo]);
  if (o !== 'v11') { const st = stepById.get(o); return { writtenBy: o, source: st.source.kind === 'commit' ? st.source.commit.slice(0, 7) + ' ' + st.source.subject : st.source.package }; }
  let u = mmap.unitsDetail.find(x => inner >= x[0] && inner < x[1]), tsUnit = u ? u[4] : null, module = null;
  if (!u) {                                              // a class's name: its units are its members; name the class and its module
    const i = mmap.unitsDetail.findIndex(x => x[0] > inner); u = mmap.unitsDetail[i];
    if (u) {
      module = u[3];
      const named = mmap.unitsDetail.slice(i, i + 40).find(x => x[3] === module && x[2].startsWith(u[2].split('.')[0] + '.') && x[4] && /\./.test(x[4]));
      tsUnit = named ? named[4].split('.')[0] + ' (class)' : null;
    }
  }
  const r = mmap.regions.find(x => inner >= x.start && inner < x.end);
  return { writtenBy: 'v11', v11Offset: inner, module: module || (r ? r.module : '?'), tsUnit, bundleUnit: u ? u[2] : null };
}

/* the bundle: top-level declarations, the __api literal, the bundle's own reads */
const sf = ts.createSourceFile('bundle.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const decl = new Map();
for (const st of sf.statements) {
  if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) { if (ts.isIdentifier(d.name)) decl.set(d.name.text, d.getStart(sf)); }
  else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) decl.set(st.name.text, st.name.getStart(sf));   // (C4) the name's own bytes: a step may have inserted a function after v11's `function ` (B39's Xwr)
  else if (ts.isImportDeclaration(st) && st.importClause && st.importClause.namedBindings && ts.isNamedImports(st.importClause.namedBindings))
    for (const e of st.importClause.namedBindings.elements) decl.set(e.name.text, -1 - 0);   // imported from a PixiJS chunk
}
const isApi = n => ts.isPropertyAccessExpression(n) && n.name.text === '__api' && ts.isIdentifier(n.expression) && n.expression.text === 'window';
let literal = null; const bundleReads = {};
(function walk(n) {
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && isApi(n.left) && ts.isObjectLiteralExpression(n.right)) literal = n.right;
  if (ts.isPropertyAccessExpression(n) && isApi(n.expression)) bundleReads[n.name.text] = (bundleReads[n.name.text] || 0) + 1;
  ts.forEachChild(n, walk);
})(sf);
if (!literal) throw new Error('window.__api = {...} not found');
function refs(node) {                                    // top-level names a member's value refers to (not its own parameters or locals)
  const local = new Set();
  (function collect(n) {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name)) local.add(n.name.text);
    ts.forEachChild(n, collect);
  })(node);
  const out = new Set();
  (function walk(n) {
    if (ts.isIdentifier(n) && decl.has(n.text) && !local.has(n.text)) {
      const p = n.parent;
      const isPropName = p && ((ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n));
      if (!isPropName) out.add(n.text);
    }
    ts.forEachChild(n, walk);
  })(node);
  return [...out];
}
const members = literal.properties.map(p => {
  const name = p.name.getText(sf), start = p.getStart(sf);
  const kind = ts.isShorthandPropertyAssignment(p) ? 'binding' : (p.initializer && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer)) ? 'function' : 'value');
  const binds = ts.isShorthandPropertyAssignment(p) ? [name] : refs(p.initializer || p);
  return {
    name, kind, text: p.getText(sf).slice(0, 160),
    memberText: origin(toByte(start)),
    binds: binds.map(b => { const d = decl.get(b); return Object.assign({ name: b }, d === -1 ? { declared: 'imported from a PixiJS chunk' } : origin(toByte(d))); }),
    readBy: {},
  };
});

/* the readers: the first-party scripts the page loads */
const files = [];
for (const d of ['', 'assets']) for (const f of fs.readdirSync(path.join(REPO, 'public', d)).sort()) {
  const rel = (d ? d + '/' : '') + f;
  if (/\.js$/.test(f) && !/^assets\/index-DKbV5Nv9\.js$/.test(rel) && !/-(?=[A-Za-z0-9_-]*[A-Z0-9_])[A-Za-z0-9_-]{8}\.js$/.test(f)) files.push(rel);   // not a hashed Vite chunk (l0-remaster.js is not one)
}
const html = fs.readFileSync(path.join(REPO, 'public', 'index.html'), 'utf8');
const loaded = new Set([...html.matchAll(/<script\b[^>]*\bsrc="(?:\.\/|\/)?([^"?#]+)"/g)].map(m => m[1]));
/* names are resolved with TypeScript's checker (one program per script), so a local "A" that holds something else is not an alias */
const readers = {};
for (const rel of files) {
  const abs = path.join(REPO, 'public', rel);
  const program = ts.createProgram({ rootNames: [abs], options: { allowJs: true, checkJs: false, noLib: true, noResolve: true, types: [], noEmit: true } });
  const checker = program.getTypeChecker(), s = program.getSourceFile(abs);
  const symOf = id => { const x = checker.getSymbolAtLocation(id); return x || null; };
  const aliases = new Set(), getters = new Set(), aliasNames = new Set(), getterNames = new Set(), counts = {};
  const isApiExpr = n => {                               // window.__api, (window.__api), window.__api || {}, a getter's call: API()
    while (n && ts.isParenthesizedExpression(n)) n = n.expression;
    if (!n) return false;
    if (isApi(n)) return true;
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return isApiExpr(n.left);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && !n.arguments.length) { const y = symOf(n.expression); return !!y && getters.has(y); }
    if (ts.isIdentifier(n)) { const y = symOf(n); return !!y && aliases.has(y); }
    return false;
  };
  const isGetter = f => f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) && !f.parameters.length &&
    (ts.isBlock(f.body) ? f.body.statements.length === 1 && ts.isReturnStatement(f.body.statements[0]) && isApiExpr(f.body.statements[0].expression) : isApiExpr(f.body));
  /* (continuation C3b, C3c) a module script's factories import what an earlier module returns: entsHound({ head: { API } }) is given
   * entsHead's own getter API.  A name a factory imports is the alias or getter its giver returns under that name; which module gives
   * which key is read from the composition (const head = entsHead(); entsHound({ head })).  Without this, a read through an imported
   * getter (API().H) would not be counted. */
  const imports = [];                                    // [the imported binding's symbol, the giver's factory name, the export's name]
  {
    const factories = new Map(), exportsOf = new Map(), modOf = new Map();
    (function find(n) { if (ts.isFunctionDeclaration(n) && n.name && n.body) factories.set(n.name.text, n); ts.forEachChild(n, find); })(s);
    for (const [name, f] of factories) {                 // what each factory returns: its top-level return { a, b: c, d: () => window.__api }
      const ex = new Map();
      for (const st of f.body.statements) if (ts.isReturnStatement(st) && st.expression && ts.isObjectLiteralExpression(st.expression))
        for (const p of st.expression.properties) {
          if (ts.isShorthandPropertyAssignment(p)) ex.set(p.name.text, { sym: checker.getShorthandAssignmentValueSymbol(p) });
          else if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) ex.set(p.name.text, ts.isIdentifier(p.initializer) ? { sym: symOf(p.initializer) } : { node: p.initializer });
        }
      exportsOf.set(name, ex);
    }
    const factoryOf = c => ts.isCallExpression(c) && ts.isIdentifier(c.expression) && factories.has(c.expression.text) ? c.expression.text : null;
    (function find(n) {                                  // the composition: const head = entsHead(), and the keys each factory is given
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && factoryOf(n.initializer)) { const y = symOf(n.name); if (y) modOf.set(y, factoryOf(n.initializer)); }
      ts.forEachChild(n, find);
    })(s);
    (function find(n) {
      const F = factoryOf(n);
      if (F && n.arguments.length === 1 && ts.isObjectLiteralExpression(n.arguments[0])) {
        const given = new Map();
        for (const p of n.arguments[0].properties) {
          const y = ts.isShorthandPropertyAssignment(p) ? checker.getShorthandAssignmentValueSymbol(p) : ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer) ? symOf(p.initializer) : null;
          if (y && modOf.has(y)) given.set(p.name.getText(s), modOf.get(y));
        }
        const par = factories.get(F).parameters[0];
        if (par && ts.isObjectBindingPattern(par.name)) for (const e of par.name.elements) {
          const key = (e.propertyName || e.name).getText(s);
          if (given.has(key) && ts.isObjectBindingPattern(e.name)) for (const i of e.name.elements) if (ts.isIdentifier(i.name)) {
            const y = symOf(i.name); if (y) imports.push([y, given.get(key), (i.propertyName || i.name).getText(s), i.name.text]);
          }
        }
      }
      ts.forEachChild(n, find);
    })(s);
    for (const im of imports) im.push(exportsOf.get(im[1]).get(im[2]) || null);
  }
  const linkImports = () => { for (const [y, , , local, ex] of imports) if (ex) {
    if ((ex.sym && aliases.has(ex.sym)) || (ex.node && isApiExpr(ex.node))) { aliases.add(y); aliasNames.add(local); }
    else if ((ex.sym && getters.has(ex.sym)) || (ex.node && isGetter(ex.node))) { getters.add(y); getterNames.add(local); }
  } };
  for (let pass = 0; pass < 3; pass++, linkImports()) (function find(n) {   // aliases (a name given window.__api) and getters (a function returning it)
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
      const y = symOf(n.name);
      if (y && isApiExpr(n.initializer)) { aliases.add(y); aliasNames.add(n.name.text); }
      else if (y && isGetter(n.initializer)) { getters.add(y); getterNames.add(n.name.text); }
    }
    if (ts.isFunctionDeclaration(n) && n.name && !n.parameters.length && n.body && n.body.statements.length === 1 && ts.isReturnStatement(n.body.statements[0]) && isApiExpr(n.body.statements[0].expression)) { const y = symOf(n.name); if (y) { getters.add(y); getterNames.add(n.name.text); } }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) && isApiExpr(n.right)) { const y = symOf(n.left); if (y) { aliases.add(y); aliasNames.add(n.left.text); } }
    ts.forEachChild(n, find);
  })(s);
  let any = false;
  (function walk(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectBindingPattern(n.name) && isApiExpr(n.initializer)) for (const e of n.name.elements) { const k = (e.propertyName || e.name).getText(s); counts[k] = (counts[k] || 0) + 1; any = true; }
    if (ts.isPropertyAccessExpression(n) && isApiExpr(n.expression)) { counts[n.name.text] = (counts[n.name.text] || 0) + 1; any = true; }
    if (ts.isElementAccessExpression(n) && isApiExpr(n.expression)) { counts['[computed]'] = (counts['[computed]'] || 0) + 1; any = true; }
    if (isApi(n)) any = true;
    ts.forEachChild(n, walk);
  })(s);
  if (any || Object.keys(counts).length) readers[rel] = { aliases: [...aliasNames], getters: [...getterNames], loaded: loaded.has(rel), members: counts };
}
const byName = new Map(members.map(m => [m.name, m]));
const unknown = {};
for (const [rel, r] of Object.entries(readers)) for (const [k, n] of Object.entries(r.members)) {
  const m = byName.get(k); if (m) m.readBy[rel] = n; else (unknown[rel] = unknown[rel] || {})[k] = n;
}
for (const [k, n] of Object.entries(bundleReads)) { const m = byName.get(k); if (m) m.readBy['assets/index-DKbV5Nv9.js (the bundle itself)'] = n; }
/* (C4) the served bundle, when it is not the recorded one: the same members in the same order, the same reads of window.__api */
let builtBundle = null;
{
  const served = fs.readFileSync(BUNDLE);
  if (!served.equals(buf)) {
    const sf2 = ts.createSourceFile('served.js', served.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    let lit = null; const reads = {};
    (function walk(n) {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && isApi(n.left) && ts.isObjectLiteralExpression(n.right)) lit = n.right;
      if (ts.isPropertyAccessExpression(n) && isApi(n.expression)) reads[n.name.text] = (reads[n.name.text] || 0) + 1;
      ts.forEachChild(n, walk);
    })(sf2);
    const names = lit ? lit.properties.map(p => p.name.getText(sf2)) : [];
    const sameMembers = JSON.stringify(names) === JSON.stringify(members.map(m => m.name)), sameReads = JSON.stringify(Object.entries(reads).sort()) === JSON.stringify(Object.entries(bundleReads).sort());
    builtBundle = { file: 'public/assets/index-DKbV5Nv9.js', sha256: sha(served), from: 'src/core/client/game/ (generated/CLIENT_BUILD.json)', members: sameMembers ? `the same ${names.length} members, in the same order` : 'DIFFERENT: ' + names.join(','), readsOfApi: sameReads ? 'the same' : 'DIFFERENT: ' + JSON.stringify(reads) };
    if (!sameMembers || !sameReads) { console.log('API CONTRACT: the served bundle does not publish the recorded facade: ' + JSON.stringify(builtBundle)); process.exitCode = 1; }
  }
}
const out = {
  note: 'The window.__api contract of the compiled bundle (public/assets/index-DKbV5Nv9.js), derived by dev/stage-3h-modernization/tools/api_contract.js from the bundle, the lineage (blame.json, module_map.json) and the scripts in public/. A member read by nobody is still part of the contract until every script is checked by hand (a script may build a member name at run time: "[computed]" lists element accesses).' + (builtBundle ? ' Since continuation C4b the bundle described is the one the lineage records (bundleSha256), and the served one, built from src/core/client/game/, publishes the same members and reads the same ones (builtBundle).' : ''),
  bundleSha256: sha(buf),
  ...(builtBundle ? { builtBundle } : {}),
  memberCount: members.length,
  readers: Object.fromEntries(Object.entries(readers).map(([f, r]) => [f, { loadedByIndexHtml: r.loaded, aliases: r.aliases, getters: r.getters, memberCount: Object.keys(r.members).length }])),
  readsOfNamesNotInTheLiteral: unknown,
  members,
};
const OUT = ARG.out ? path.resolve(ARG.out) : path.join(LIN, '..', 'api_contract.json');
if (ARG.check) {                                         // (C5) --check 1: the committed contract is what the code gives (the gate's lineage step)
  const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === JSON.stringify(out, null, 1) + '\n' && process.exitCode !== 1;
  console.log(`API CONTRACT: ${same ? 'CURRENT' : 'STALE'} (${path.relative(REPO, OUT)}${same ? ' is what the bundle and the readers give' : ': run node dev/stage-3h-modernization/tools/api_contract.js, then lineage_doc.js'})`);
  process.exitCode = same ? 0 : 1;
} else fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`__api: ${members.length} members; ${Object.keys(readers).length} reading scripts (+ the bundle itself); unread members: ${members.filter(m => !Object.keys(m.readBy).length).map(m => m.name).join(', ') || 'none'}; names read but not in the literal: ${JSON.stringify(unknown)}`);
