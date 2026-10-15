#!/usr/bin/env node
/* Stage 3H continuation (C3b, M-024) - the page's multi-owner scripts made of modules: one factory per part, given what it uses (development
 * only; needs TypeScript's parser and checker, like dev/tools/checks/parts.js).
 *
 *   node dev/stage-3h-modernization/tools/c3_client_modules.js --apply [--only public/x.js,...]   write each script's modules and its
 *                                                                     composition from M8's parts (read from Git), and the recipes
 *   node dev/stage-3h-modernization/tools/c3_client_modules.js --check [--report FILE.txt]        rebuild them all and compare with the
 *                                                                     working tree
 *
 * At M8 each of these scripts was one closure assembled from owned parts (ADR-004): every part could read any name another part
 * declared.  From C3b every part is a module: its code inside one factory function, given what it uses of the other parts (its
 * parameter, by giver) and returning what they use of it.  A new part at the end of each script, owned by the script's lead owner (the
 * owner of its first part, which opens the wrapper), makes the modules in the order the parts ran and closes the wrapper:
 *   const core = camcorderCore();  const audio = camcorderAudio({ core });  camcorderView({ core, audio });
 * What a part registers on window, or on its script's public object (W, E, mv), it still registers itself, at the same moment.
 *
 * Three couplings across owners were hidden at M8 and are made explicit here, each by listed edits (EDITS below; every other line is
 * M8's):
 *   - camcorder.js: Spacious Audio's module wrote its whine's sound nodes into the camera's state (BR-R's S.whine).  Now BR-R's module
 *     gives a function that sets that slot (setWhine), and the sound module calls it: the same value in the same slot.  It still reads
 *     the slot as before.
 *   - move.js: the movement code (S.P.A.C.E.) called Spacious Audio's movement sounds through the global object, window.__mvSfx.
 *     Now the sound module hands its sounds to the movement module (useSound, the movement module's own function) when it is made,
 *     and the movement code calls what it was handed.  window.__mvSfx is still registered, as before.
 *   - ents.js: GIB's death scene drew the Smiler through the script's public object (E.drawSmiler), which BR-R's Smiler module
 *     registers.  Now the Smiler module also gives drawSmiler by name and the death module imports it: the same function.
 *
 * Before writing anything, for each script, the tool proves from the code (TypeScript's checker on the assembled text):
 *   - the edits change no name's meaning: the names that resolve to no declaration (the globals: window, document, Math ...) are the
 *     same set in M8's text and in the edited text;
 *   - every name a part uses of another part's is declared by an earlier part (no forward use: the factories are made in order);
 *   - no part assigns another part's binding;
 *   - every name a part gives another is a const, a function or a class, or a let/var that is never assigned after its declaration
 *     (a value passed to a factory is a copy: a later assignment would not reach the importer);
 *   - no part-level `this` or `arguments` (inside a factory they would mean something else), and no function declared in a block
 *     outside strict code (its scope would follow the sloppy-mode rules of the enclosing function);
 *   - after the change, the globals are the same set again, every name that resolved to a declaration still does, and no module
 *     uses another module's names: nothing a part used is lost behind another part's factory.
 * Each module's header lists its imports (giver { names }) and exports; dev/tools/checks/modules.js proves them from the code. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..'), M8 = 'c34f0c22bbacc5ac2813d173bc0591b67af7169f';
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) ARG[a.slice(2)] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true; }
if (!ARG.apply === !ARG.check) { console.error('usage: --apply | --check [--report FILE] [--only out,out]'); process.exit(2); }
const ts = (() => { for (const t of [process.env.TYPESCRIPT, 'typescript', path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript')].filter(Boolean)) { try { return require(t); } catch (e) { /* next */ } } return null; })();
if (!ts) { console.error('NOT RUN: TypeScript is not installed'); process.exit(2); }
const F = 'src/frameworks', HEADER = /^\/\*\* @part [\s\S]*?\*\/\r?\n/;
/* the scripts: their parts in order as [file, the module's name in the composition, its factory], the wrapper's opening (the end of the
 * first part's prologue) and closing (the end of the last part), and the composition part (its owner is the first part's) */
const SPEC = [
  { out: 'public/camcorder.js', open: "(() => {\n  'use strict';\n", close: '})();\n', ind: '  ', compose: [`${F}/br-r/client/camcorder.compose.js`, 'BR-R'], parts: [
    [`${F}/br-r/client/camcorder.js`, 'core', 'camcorderCore'], [`${F}/spacious-audio/client/camcorder.audio.js`, 'audio', 'camcorderAudio'],
    [`${F}/br-r/client/camcorder.view.js`, 'view', 'camcorderView']] },
  { out: 'public/glitch.js', open: '(() => {\n', close: '})();\n', ind: '  ', compose: [`${F}/lost/client/glitch.compose.js`, 'L.O.S.T.'], parts: [
    [`${F}/lost/client/glitch.js`, 'walls', 'glitchWalls'], [`${F}/spacious-audio/client/glitch.audio.js`, 'audio', 'glitchAudio'],
    [`${F}/lost/client/glitch.draw.js`, 'draw', 'glitchDraw']] },
  { out: 'public/move.js', open: "(() => {\n'use strict';\n", close: '})();\n', ind: '', compose: [`${F}/space/client/move.compose.js`, 'S.P.A.C.E.'], parts: [
    [`${F}/space/client/move.js`, 'move', 'moveCore'], [`${F}/br-r/client/move.poses.js`, 'poses', 'movePoses'],
    [`${F}/spacious-audio/client/move.sound.js`, 'sound', 'moveSound']] },
  { out: 'public/ents.js', open: "(() => {\n'use strict';\n", close: '})();\n', ind: '', compose: [`${F}/br-r/client/ents.compose.js`, 'BR-R'], parts: [
    [`${F}/br-r/client/ents.head.js`, 'head', 'entsHead'], [`${F}/br-r/client/ents.hound.js`, 'hound', 'entsHound'],
    [`${F}/br-r/client/ents.smiler.js`, 'smiler', 'entsSmiler'], [`${F}/gib/client/ents.death.js`, 'death', 'entsDeath'],
    [`${F}/spacious-audio/client/ents.audio.js`, 'audio', 'entsAudio'], [`${F}/overseer/client/ents.debug.js`, 'debug', 'entsDebug']] },
  { out: 'public/world.js', also: 'generated/server/world.js', open: "})(typeof self !== 'undefined' ? self : this, function () {\n  'use strict';\n", close: '  return W;\n});\n', ind: '  ',
    closeLines: '  return head.W;\n});\n', compose: [`${F}/space/shared/world.compose.js`, 'S.P.A.C.E.'], parts: [
    [`${F}/space/shared/world.js`, 'head', 'worldHead'], [`${F}/lost/shared/world.lamps.js`, 'lamps', 'worldLamps'],
    [`${F}/space/shared/world.crawl.js`, 'crawl', 'worldCrawl'], [`${F}/lost/shared/world.surfaces.js`, 'surfaces', 'worldSurfaces'],
    [`${F}/space/shared/world.move.js`, 'moves', 'worldMove'], [`${F}/br-r/shared/world.art.js`, 'art', 'worldArt']] },
].filter(s => !ARG.only || ARG.only.split(',').includes(s.out));
/* the edits that make a hidden dependency explicit: [the part's module name, old text (found exactly once in M8's part), new text, why] */
const EDITS = {
  'public/camcorder.js': [
    ['core', '\n  const FX = Object.create(null);\n', '\n  const setWhine = w => { S.whine = w; };            // (C3b) the heat whine\'s sound nodes: Spacious Audio\'s module keeps them in the camera\'s state\n  const FX = Object.create(null);\n',
      'the camera\'s state gets a function that sets its whine slot'],
    ['audio', ' S.whine = { c, o, g, lfo };\n', ' setWhine({ c, o, g, lfo });\n', 'the sound module sets the whine slot of the camera\'s state (BR-R\'s) through that function, not by writing it'],
  ],
  'public/move.js': [
    ['move', 'window.__mv = mv;\n', 'window.__mv = mv;\nlet sfx = null;                         // (C3b) Spacious Audio\'s movement sounds: move.sound.js hands them over when it is made\nconst useSound = s => { sfx = s; };\n',
      'the movement module keeps the sounds the sound module hands it'],
    ['move', '  window.__mvSfx && window.__mvSfx.vaultStart(q);\n', '  sfx && sfx.vaultStart(q);\n', 'it plays them through what it was handed, not through the global object'],
    ['move', '    window.__mvSfx && window.__mvSfx.vaultLand(v.q);\n', '    sfx && sfx.vaultLand(v.q);\n', 'it plays them through what it was handed, not through the global object'],
    ['move', '  window.__mvSfx && window.__mvSfx.slideStart(surf, mv.slide.v);\n', '  sfx && sfx.slideStart(surf, mv.slide.v);\n', 'it plays them through what it was handed, not through the global object'],
    ['move', '  window.__mvSfx && window.__mvSfx.slideEnd();\n', '  sfx && sfx.slideEnd();\n', 'it plays them through what it was handed, not through the global object'],
    ['sound', '\nwindow.__mvSfx = {\n', '\nconst mvSfx = window.__mvSfx = {\n', 'the sound module names its sounds (still registered on window, as before)'],
    ['sound', '\n};\nlet lastBreath = 0, stepDist = 0, lastStepPos = null;\n', '\n};\nuseSound(mvSfx);                        // (C3b) hands them to the movement module, right after registering them\nlet lastBreath = 0, stepDist = 0, lastStepPos = null;\n',
      'and hands them to the movement module the moment they are registered'],
  ],
  'public/ents.js': [
    ['smiler', '\nE.drawSmiler = function (view, sm_, t, dt, vis, o) {\n', '\nconst drawSmiler = E.drawSmiler = function (view, sm_, t, dt, vis, o) {\n', 'the Smiler module names the drawing it registers on E, and gives it'],
    ['death', '  E.drawSmiler(view, { state: \'ATTACKING\'', '  drawSmiler(view, { state: \'ATTACKING\'', 'the death scene draws the Smiler with the function it imports, not through a property of E another module registered'],
  ],
};
const show = p => execFileSync('git', ['-C', REPO, 'show', `${M8}:${p}`]).toString('utf8');
const wrap = (prefix, text, width = 138) => { const out = []; let line = prefix; for (const w of text.split(/ +/)) { if (line.length + w.length + 1 > width && line.trim() !== prefix.trim()) { out.push(line.replace(/\s+$/, '')); line = ' * '; } line += (line.endsWith(' ') ? '' : ' ') + w; } out.push(line.replace(/\s+$/, '')); return out; };

/* the assembled text's analysis: the closure, each closure-level name's part, kind and writes, the uses across parts, part-level this */
function program(text, name) {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const host = { getSourceFile: f => f === name ? sf : undefined, getDefaultLibFileName: () => 'lib.d.ts', writeFile() {}, getCurrentDirectory: () => '/', getDirectories: () => [],
    fileExists: f => f === name, readFile: () => undefined, getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
  const p = ts.createProgram([name], { allowJs: true, checkJs: false, noEmit: true, noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022 }, host);
  return { sf, checker: p.getTypeChecker() };
}
const ASSIGN = new Set(['EqualsToken', 'PlusEqualsToken', 'MinusEqualsToken', 'AsteriskEqualsToken', 'AsteriskAsteriskEqualsToken', 'SlashEqualsToken', 'PercentEqualsToken',
  'LessThanLessThanEqualsToken', 'GreaterThanGreaterThanEqualsToken', 'GreaterThanGreaterThanGreaterThanEqualsToken', 'AmpersandEqualsToken', 'BarEqualsToken', 'CaretEqualsToken',
  'BarBarEqualsToken', 'AmpersandAmpersandEqualsToken', 'QuestionQuestionEqualsToken'].map(k => ts.SyntaxKind[k]));
function isWrite(id) {
  let n = id, p = n.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isArrayLiteralExpression(p) || ts.isObjectLiteralExpression(p) || ts.isShorthandPropertyAssignment(p) || ts.isSpreadElement(p) || ts.isSpreadAssignment(p)
    || (ts.isPropertyAssignment(p) && p.initializer === n))) { n = p; p = p.parent; }
  if (p && ts.isBinaryExpression(p) && p.left === n && ASSIGN.has(p.operatorToken.kind)) return true;
  if (p && (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)) return true;
  if (p && (ts.isForInStatement(p) || ts.isForOfStatement(p)) && p.initializer === n) return true;
  return false;
}
const isFn = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n);
const isPropertyName = n => (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) || (ts.isPropertyAssignment(n.parent) && n.parent.name === n) || (ts.isMethodDeclaration(n.parent) && n.parent.name === n)
  || (ts.isPropertyDeclaration(n.parent) && n.parent.name === n) || (ts.isGetAccessor(n.parent) && n.parent.name === n) || (ts.isSetAccessor(n.parent) && n.parent.name === n)
  || (ts.isBindingElement(n.parent) && n.parent.propertyName === n) || ts.isLabeledStatement(n.parent) || ts.isBreakOrContinueStatement(n.parent);
function analyse(bodies, name, strict) {
  const starts = []; let text = '';
  for (const b of bodies) { starts.push(text.length); text += b; }
  const partAt = pos => { let k = -1; for (let i = 0; i < starts.length; i++) if (pos >= starts[i]) k = i; return k; };
  const { sf, checker } = program(text, name);
  let closure = null;
  (function walk(n) { if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isFunctionDeclaration(n)) && n.body && ts.isBlock(n.body) && (!closure || n.body.end - n.body.pos > closure.body.end - closure.body.pos)) closure = n; ts.forEachChild(n, walk); })(sf);
  const decl = new Map();                                   // symbol -> { name, part, kind, writes }
  const add = (id, kind) => { const s = checker.getSymbolAtLocation(id); if (s && !decl.has(s)) decl.set(s, { name: id.text, part: partAt(id.getStart(sf)), kind, writes: 0 }); };
  const bind = (b, kind) => { if (ts.isIdentifier(b)) add(b, kind); else for (const e of b.elements || []) if (!ts.isOmittedExpression(e)) bind(e.name, kind); };
  const problems = [];
  /* a function declared in a block in sloppy code (anywhere in the script): its scope follows Annex B's rules, which a move into a
   * factory could change */
  if (!strict) (function walk(n) { if (ts.isFunctionDeclaration(n) && n.parent && ts.isBlock(n.parent) && !(n.parent.parent && (isFn(n.parent.parent) || ts.isArrowFunction(n.parent.parent)))) problems.push(`${name}: a function declared in a block in sloppy code (${n.name ? n.name.text : '?'}) at character ${n.getStart(sf)}`); ts.forEachChild(n, walk); })(sf);
  /* closure-level declarations: the closure's own statements, and any var whose function scope is the closure */
  (function walk(n) {
    if (isFn(n) || ts.isArrowFunction(n)) { if (ts.isFunctionDeclaration(n) && n.name && n.parent === closure.body) add(n.name, 'function'); return; }
    if (ts.isVariableDeclarationList(n)) { const k = n.flags & ts.NodeFlags.Const ? 'const' : n.flags & ts.NodeFlags.Let ? 'let' : 'var'; if (k === 'var' || (ts.isVariableStatement(n.parent) && n.parent.parent === closure.body)) for (const d of n.declarations) bind(d.name, k); }
    if (ts.isClassDeclaration(n) && n.name && n.parent === closure.body) add(n.name, 'class');
    ts.forEachChild(n, walk);
  })(closure.body);
  for (const p of closure.parameters) bind(p.name, 'param');
  const uses = bodies.map(() => new Map()), free = new Set();
  (function walk(n) {
    if (ts.isIdentifier(n) && !isPropertyName(n)) {
      const s = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
      const d = s && decl.get(s), here = partAt(n.getStart(sf));
      if (d) { if (isWrite(n) && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) d.writes++; if (d.part !== here && here >= 0) { uses[here].set(d.name, d.part); if (isWrite(n)) problems.push(`${name}: part ${here} assigns ${d.name}, part ${d.part}'s`); } }
      if (!s || !s.declarations || !s.declarations.length) free.add(n.text);
    }
    if (n.kind === ts.SyntaxKind.ThisKeyword || (ts.isIdentifier(n) && n.text === 'arguments' && !isPropertyName(n))) {
      let p = n.parent; while (p && p !== closure && !isFn(p)) p = p.parent;
      if (p === closure && partAt(n.getStart(sf)) >= 0) problems.push(`${name}: part ${partAt(n.getStart(sf))} uses ${n.kind === ts.SyntaxKind.ThisKeyword ? 'this' : 'arguments'} at its own level`);
    }
    ts.forEachChild(n, walk);
  })(closure.body);
  return { text, sf, decl, uses, problems, free, starts };
}
const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

const REPORT = [], OUTF = {};
for (const S of SPEC) {
  const n = S.parts.length, strict = S.open.includes("'use strict'");
  const raw = S.parts.map(([p]) => show(p));
  const head = raw.map(t => (t.match(HEADER) || [''])[0]), m8 = raw.map((t, i) => t.slice(head[i].length)), body = m8.slice();
  /* the listed edits, each found exactly once in its part */
  const edits = EDITS[S.out] || [];
  for (const [key, oldT, newT] of edits) {
    const i = S.parts.findIndex(x => x[1] === key), at = body[i].indexOf(oldT);
    if (at < 0 || body[i].indexOf(oldT, at + 1) >= 0) { console.error(`${S.out}: the edit of ${key} is not found exactly once: ${JSON.stringify(oldT.slice(0, 80))}`); process.exit(1); }
    body[i] = body[i].slice(0, at) + newT + body[i].slice(at + oldT.length);
  }
  const A0 = analyse(m8, S.out.replace(/\.js$/, '.m8.js'), strict), A = analyse(body, S.out, strict);
  if (A0.problems.length || A.problems.length) { console.error(A0.problems.concat(A.problems).join('\n')); process.exit(1); }
  if (!sameSet(A0.free, A.free)) { console.error(`${S.out}: the edits change what resolves to no declaration: before ${[...A0.free].filter(x => !A.free.has(x)).join(', ') || '-'}; after ${[...A.free].filter(x => !A0.free.has(x)).join(', ') || '-'}`); process.exit(1); }
  const problems = [];
  /* what each part gives the later ones, and what it takes, by giver */
  const gives = S.parts.map(() => new Set()), takes = S.parts.map(() => new Map());
  A.uses.forEach((m, i) => { for (const [nm, from] of m) { if (from > i) problems.push(`${S.out}: part ${i} uses ${nm} of part ${from}, which comes later`); gives[from].add(nm); if (!takes[i].has(from)) takes[i].set(from, new Set()); takes[i].get(from).add(nm); } });
  for (const d of A.decl.values()) if (d.part >= 0 && gives[d.part].has(d.name) && (d.kind === 'let' || d.kind === 'var') && d.writes > 0) problems.push(`${S.out}: ${d.name} (part ${d.part}, ${d.kind}) is given to another part and assigned ${d.writes} time(s): a copy would go stale`);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  /* the wrapper: the first part's prologue ends with S.open; the last part ends with S.close */
  const o = body[0].indexOf(S.open); if (o < 0 || body[0].indexOf(S.open, o + 1) >= 0) { console.error(`${S.out}: the opening is not found exactly once in the first part`); process.exit(1); }
  const prologue = body[0].slice(0, o + S.open.length); body[0] = body[0].slice(o + S.open.length);
  if (!body[n - 1].endsWith(S.close)) { console.error(`${S.out}: the last part does not end with its closing`); process.exit(1); }
  body[n - 1] = body[n - 1].slice(0, body[n - 1].length - S.close.length);
  const ind = S.ind, keyOf = i => S.parts[i][1], names = ns => [...ns].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : 1));
  const params = i => { const t = [...takes[i]].sort((a, b) => a[0] - b[0]); return t.length ? `{ ${t.map(([from, ns]) => `${keyOf(from)}: { ${names(ns).join(', ')} }`).join(', ')} }` : ''; };
  const outsOf = o2 => [o2].concat(S.also ? [S.also] : []).join(',');
  const composeName = S.compose[0].split('/').pop();
  S.parts.forEach(([p, key, fac], i) => {
    const title = (head[i].match(/^\/\*\* @part \S+ - (.*)$/m) || [])[1].replace(/ \(the IIFE opens here\)|; the IIFE opens here|; the factory opens here|; the IIFE closes here|; the factory closes here/g, '');
    const notes = head[i].split('\n').slice(1).filter(l => /^ \* /.test(l) && !/^ \*\s*(provides|uses|writes):/.test(l) && !/^ \*\s{3,}\S/.test(l));
    const imp = [...takes[i]].sort((a, b) => a[0] - b[0]).map(([from, ns]) => `${keyOf(from)} { ${names(ns).join(' ')} }`);
    const mine = edits.filter(e => e[0] === key);
    const what = `A module (continuation C3b, M-024): M8's part inside its factory, ${fac}${i === 0 ? ', after the opening of the script\'s wrapper, which this part keeps' : ''}. `
      + `Its parameter is what it takes from the modules made before it, by giver; its return is what later modules take from it. ${composeName} makes it. `
      + (mine.length ? `Every line is M8's except ${mine.length} listed edit${mine.length > 1 ? 's' : ''} (dev/stage-3h-modernization/tools/c3_client_modules.js): ${[...new Set(mine.map(e => e[3]))].join('; ')}.` : 'Every line is M8\'s.');
    const H = [`/** @part ${outsOf(S.out)} - ${title}; a module: ${fac}`, ...notes, ...wrap(' * ', what),
      ` * imports: ${imp.join(', ') || '-'}`, ` * exports: ${names(gives[i]).join(', ') || '-'}`,
      ` * provides: ${fac}`, ' * uses: -', ' * writes: -', ' */', ''].join('\n');
    const prm = params(i), ret = gives[i].size ? `\n${ind}return { ${names(gives[i]).join(', ')} };\n` : '';
    OUTF[p] = H + (i === 0 ? prologue : '') + `${ind}function ${fac}(${prm}) {\n` + body[i] + ret + `${ind}}\n`;
  });
  /* the composition */
  const made = S.parts.map(([, key, fac], i) => { const used = [...Array(n).keys()].some(j => takes[j].has(i)) || (i === 0 && S.closeLines); const from = [...takes[i].keys()].sort((a, b) => a - b); return `${ind}${used ? `const ${key} = ` : ''}${fac}(${from.length ? `{ ${from.map(keyOf).join(', ')} }` : ''});`; });
  const leadTitle = S.compose[1];
  OUTF[S.compose[0]] = [`/** @part ${outsOf(S.out)} - ${leadTitle}: ${path.basename(S.out)}'s composition: it makes each owner's module in the order the parts ran, and closes the wrapper`,
    ...wrap(' * ', `Continuation C3b (M-024). Each module is given what it uses of the modules made before it (the arguments below) and nothing else; what it registers on window or on the script's public object it registers itself, at the same moment as before. dev/stage-3h-modernization/tools/c3_client_modules.js wrote this composition and proved, from the code, that nothing else changed.`),
    ` * provides: -`, ` * uses: ${S.parts.map(x => x[2]).join(', ')}`, ' * writes: -', ' */', ''].join('\n')
    + `${ind}/* (C3b) the modules, in the order the parts ran */\n` + made.join('\n') + '\n' + (S.closeLines || S.close);
  /* the proof: the new assembled text resolves every name as the old one did (the same globals; nothing bound became free) */
  const newBodies = S.parts.map(([p]) => OUTF[p].slice((OUTF[p].match(HEADER) || [''])[0].length)).concat([OUTF[S.compose[0]].slice(OUTF[S.compose[0]].match(HEADER)[0].length)]);
  if (ARG.dump) { fs.mkdirSync(ARG.dump, { recursive: true }); fs.writeFileSync(path.join(ARG.dump, path.basename(S.out)), newBodies.join('')); }
  const B = analyse(newBodies, S.out.replace(/\.js$/, '.modules.js'), strict);
  const lost = [...B.free].filter(x => !A.free.has(x)), gained = [...A.free].filter(x => !B.free.has(x));
  if (B.problems.length || lost.length || gained.length) { console.error(`${S.out}: after the change ${B.problems.join('; ')}${lost.length ? ' names now unresolved: ' + lost.join(', ') : ''}${gained.length ? ' names now resolved: ' + gained.join(', ') : ''}`); process.exit(1); }
  if (B.uses.slice(0, n).some(m => m.size)) { console.error(`${S.out}: a module uses another part's name: ${B.uses.slice(0, n).map((m, i) => [...m.keys()].map(x => `${keyOf(i)} uses ${x}`).join(', ')).filter(Boolean).join('; ')}`); process.exit(1); }
  REPORT.push(`${S.out}${S.also ? ' (and ' + S.also + ')' : ''}: ${n} modules and the composition ${S.compose[0]}`);
  S.parts.forEach(([p, key, fac], i) => REPORT.push(`  ${key} = ${fac}(${params(i)})  ${p}${gives[i].size ? '  ->  ' + names(gives[i]).join(', ') : ''}`));
  for (const [key, oldT, newT, why] of edits) REPORT.push(`  edit (${key}): ${why}\n      M8:  ${oldT.trim().split('\n').join('\n           ')}\n      now: ${newT.trim().split('\n').join('\n           ')}`);
  REPORT.push(`  every other line of each part is M8's, verbatim; names unresolved (globals) in M8's text, the edited text and the modules: ${A0.free.size} = ${A.free.size} = ${B.free.size}, the same set`);
  S.newParts = S.parts.map(x => x[0]).concat([S.compose[0]]);
}
/* the recipes: each script gains its composition part, last */
const RECIPES = path.join(REPO, 'src', 'build-recipes.json'), rec = JSON.parse(fs.readFileSync(RECIPES, 'utf8'));
for (const S of SPEC) for (const o of rec.outputs) if (o.out === S.out || o.out === S.also) o.parts = S.newParts;
const recText = JSON.stringify(rec, null, 1) + '\n';
if (ARG.apply) {
  for (const [p, t] of Object.entries(OUTF)) fs.writeFileSync(path.join(REPO, p), t);
  fs.writeFileSync(RECIPES, recText);
  console.log(`C3b: ${Object.keys(OUTF).length} files written (${SPEC.map(s => s.out).join(', ')}); src/build-recipes.json: each script's composition added`);
} else {
  const bad = Object.entries(OUTF).filter(([p, t]) => !fs.existsSync(path.join(REPO, p)) || fs.readFileSync(path.join(REPO, p), 'utf8') !== t).map(([p]) => p);
  if (fs.readFileSync(RECIPES, 'utf8') !== recText) bad.push('src/build-recipes.json');
  if (ARG.report) fs.writeFileSync(ARG.report, REPORT.join('\n') + '\n');
  console.log('C3b CLIENT MODULES CHECK: ' + (bad.length ? 'FAIL: ' + bad.join(', ') : `PASS (${SPEC.length} scripts: every module is M8's part in its factory with only the listed edits, every composition as written; the recipes)`));
  process.exitCode = bad.length ? 1 : 0;
}
console.log(REPORT.join('\n'));
