#!/usr/bin/env node
/* dev/tools/checks/window_contract.js - the compiled client's side of the page's window contracts (development tool; needs TypeScript).
 *
 *   node dev/tools/checks/window_contract.js [--out FILE.json]          check
 *   node dev/tools/checks/window_contract.js --mutants 1 [--out FILE]   the check's own sensitivity: each rule refuses a break
 *   (--root DIR: another checkout.  TypeScript: the package `typescript`, Node's global copy, or $TYPESCRIPT, as parts.js finds it.)
 *
 * The page's classic scripts and the compiled client talk through window (docs/architecture/CONTRACTS.md section 2; FINDINGS M-005).
 * Since continuation C4 the client is TypeScript (src/core/client/game/), and every window member it uses is declared in
 * client/contracts.d.ts: its type, the page script that defines it and the lineage step that started using it, so TypeScript checks
 * every use at every build.  This check holds those declarations to the code on both sides:
 *   1. every window member the client's source reads or writes is declared (TypeScript refuses an undeclared one; this names it), and
 *      window is never cast to escape the declarations ((window as any).x);
 *   2. every declared member is used by the client's source (no declaration outlives its use);
 *   3. every member the client reads is written by the client or by a page script (no read of a name nobody defines);
 *   4. every page script that writes a member the client uses is named in that member's declaration, and the first script the
 *      declaration names writes it (or, when it names the client's own module first, the client does);
 *   5. the built bundle (public/assets/index-DKbV5Nv9.js) reads and writes the same window names as its source.
 * A page script's writes and reads are counted as dev/tools/docs/docs.js counts them for CONTRACTS.md (window.NAME, NAME beginning
 * with __, TFB_ or WORLD; "= ", "||=", "??=" make a write); the client's from its TypeScript (an assignment, ++/-- or delete makes a
 * write).  A declaration without a comment of its own shares the comment above it (one comment for a group).  Exit 0 only when all
 * five hold. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(ARG.root || path.join(__dirname, '..', '..', '..'));
function loadTs() {
  const tries = [process.env.TYPESCRIPT, 'typescript', path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript'), path.join(path.dirname(process.execPath), 'node_modules', 'typescript')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* the next */ } }
  return null;
}
const ts = loadTs();
if (!ts) { console.error('WINDOW CONTRACT: NOT RUN - TypeScript is not installed (npm i -g typescript, or set TYPESCRIPT=<its folder>)'); process.exit(2); }
const GAME = 'src/core/client/game', CONTRACTS = `${GAME}/client/contracts.d.ts`, BUNDLE = 'public/assets/index-DKbV5Nv9.js';
const NAME = /^(?:__[A-Za-z0-9_$]+|WORLD|TFB_[A-Za-z0-9_]+)$/;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rel = f => path.relative(REPO, f).split(path.sep).join('/');

function check(files = {}) {
  const text = f => (f in files ? files[f] : fs.readFileSync(path.join(REPO, f), 'utf8'));
  const list = d => { const own = walk(path.join(REPO, d)).map(rel); return [...new Set([...own, ...Object.keys(files).filter(f => f.startsWith(d + '/'))])].sort(); };
  const R = { members: {}, problems: [] };
  const use = (n, how, where) => { const m = R.members[n] || (R.members[n] = { declared: false, comment: '', named: [], client: { reads: [], writes: [] }, scripts: { writes: [], reads: [] }, bundle: { reads: false, writes: false } }); if (how) m.client[how].push(where); return m; };
  /* the client's source: every window.NAME, read or written (and the bare global the declarations name) */
  const sources = list(GAME).filter(f => /\.ts$/.test(f) && !/\.d\.ts$/.test(f) && !/(^|\/)(node_modules|dist)\//.test(f) && !/vite\.config\.ts$/.test(f));
  const bare = new Set();
  { // the declarations
    const t = text(CONTRACTS), sf = ts.createSourceFile(CONTRACTS, t, ts.ScriptTarget.Latest, true);
    let group = '';
    const commentOf = node => (ts.getLeadingCommentRanges(t, node.pos) || []).map(r => t.slice(r.pos, r.end)).join('\n');
    sf.forEachChild(st => {
      if (ts.isInterfaceDeclaration(st) && st.name.text === 'Window') {
        for (const m of st.members) {
          if (!m.name || !ts.isIdentifier(m.name)) continue;
          const c = commentOf(m); if (c.trim()) group = c;
          const M = use(m.name.text); M.declared = true; M.comment = group;
        }
      } else if (ts.isVariableStatement(st) && st.modifiers && st.modifiers.some(x => x.kind === ts.SyntaxKind.DeclareKeyword)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && NAME.test(d.name.text)) { const M = use(d.name.text); M.declared = true; M.bare = true; M.comment = commentOf(st); bare.add(d.name.text); }
      }
    });
  }
  const WRITE_OPS = new Set([ts.SyntaxKind.EqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken]);
  for (const f of sources) {
    const t = text(f), sf = ts.createSourceFile(f, t, ts.ScriptTarget.Latest, true);
    const visit = node => {
      let n = null;
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'window') n = node.name.text;
      else if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'window' && ts.isStringLiteral(node.argumentExpression)) n = node.argumentExpression.text;
      else if (ts.isIdentifier(node) && bare.has(node.text) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) n = node.text;
      if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && ts.isIdentifier(node.expression) && node.expression.text === 'window')
        R.problems.push(`rule 1: window: an untyped use at ${f}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} (a cast of window escapes the declarations)`);
      if (n && NAME.test(n)) {   // the page's contracts (as docs.js counts them); the DOM's own members (window.addEventListener ...) are the browser's
        const p = node.parent, write = (ts.isBinaryExpression(p) && p.left === node && WRITE_OPS.has(p.operatorToken.kind)) || ts.isDeleteExpression(p) ||
          ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken));
        use(n, write ? 'writes' : 'reads', `${f}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  /* the served scripts, as docs.js counts them; the built bundle apart */
  const served = list('public').filter(f => /\.(js|html)$/.test(f));
  for (const f of served) {
    const t = text(f);
    for (const m of t.matchAll(/\b(?:window|root|self|globalThis)\.(__[A-Za-z0-9_$]+|WORLD|TFB_[A-Za-z0-9_]+)\b(\s*(?:=(?!=)|\|\|=|\?\?=))?/g)) {
      const M = R.members[m[1]]; if (!M && f !== BUNDLE) continue;
      const N = M || use(m[1]);
      if (f === BUNDLE) N.bundle[m[2] ? 'writes' : 'reads'] = true;
      else { const s = f.replace(/^public\//, ''); if (!N.scripts[m[2] ? 'writes' : 'reads'].includes(s)) N.scripts[m[2] ? 'writes' : 'reads'].push(s); }
    }
  }
  /* the rules */
  const problem = (rule, n, why) => R.problems.push(`rule ${rule}: ${n}: ${why}`);
  for (const [n, M] of Object.entries(R.members).sort()) {
    const cr = M.client.reads.length, cw = M.client.writes.length, used = cr + cw > 0;
    M.named = [...new Set((M.comment.match(/(?:assets\/)?[\w-]+\.(?:js|ts)\b/g) || []))];
    const firstNamed = M.named[0], clientNamesFirst = firstNamed && /\.ts$/.test(firstNamed);
    if (used && !M.declared) problem(1, n, `used by the client (${[...M.client.reads, ...M.client.writes].slice(0, 3).join(', ')}) and not declared in ${CONTRACTS}`);
    if (M.declared && !used) problem(2, n, 'declared and never used by the client');
    if (!used && !M.declared) {   // a name only the built bundle has
      if (M.bundle.reads || M.bundle.writes) problem(5, n, `the built bundle ${M.bundle.writes ? 'writes' : 'reads'} it and its source does not`);
      continue;
    }
    if (cr && !cw && !M.scripts.writes.length) problem(3, n, 'the client reads it and no page script writes it');
    if (M.declared) {
      for (const s of M.scripts.writes) if (!M.named.some(x => x === s || x === s.replace(/^assets\//, ''))) problem(4, n, `${s} writes it and its declaration does not name it`);
      if (!firstNamed) problem(4, n, 'its declaration names no script');
      else if (clientNamesFirst ? !cw : !M.scripts.writes.some(s => s === firstNamed || s.replace(/^assets\//, '') === firstNamed)) problem(4, n, `its declaration names ${firstNamed} first, which does not write it`);
    }
    if (!M.bare && (!!cw !== M.bundle.writes || (!!cr && !M.bundle.reads && !M.bundle.writes))) problem(5, n, `the source ${cw ? 'writes' : ''}${cw && cr ? ' and ' : ''}${cr ? 'reads' : ''} it; the built bundle ${M.bundle.writes ? 'writes' : ''}${M.bundle.writes && M.bundle.reads ? ' and ' : ''}${M.bundle.reads ? 'reads' : ''}${!M.bundle.writes && !M.bundle.reads ? 'does neither' : ''}`);
  }
  R.ok = !R.problems.length;
  return R;
}

if (ARG.mutants) {
  const T = f => fs.readFileSync(path.join(REPO, f), 'utf8'), MAIN = `${GAME}/client/main.ts`;
  const swap = (f, from, to) => { const t = T(f); if (t.split(from).length !== 2) throw new Error(`${f}: "${from}" is not there once`); return { [f]: t.replace(from, to) }; };
  const M = [
    ['1: an undeclared member read', 1, { [MAIN]: T(MAIN) + '\nexport const mutantRead=window.__mutantUndeclared;\n' }],
    ['2: a declaration nobody uses', 2, swap(CONTRACTS, '  __hideSelf?: boolean;', '  __hideSelf?: boolean;\n  __mutantUnused?: number;')],
    ['3: a read of a name no page script writes', 3, Object.assign(swap(CONTRACTS, '  __hideSelf?: boolean;', '  __hideSelf?: boolean;\n  /* mutant.js: nothing */\n  __mutantOrphan?: number;'), { [MAIN]: T(MAIN) + '\nexport const mutantOrphan=window.__mutantOrphan;\n' })],
    ['4: a declaration that loses its script', 4, swap(CONTRACTS, '/* camcorder.js (owner BR-R; B11, B20)', '/* (owner BR-R; B11, B20)')],
    ['4: a page script that starts writing a member the client reads', 4, { 'public/hud.js': T('public/hud.js') + '\nwindow.__mv = window.__mv;\n' }],
    ['5: the built bundle reaches a name its source does not', 5, { [BUNDLE]: T(BUNDLE) + '\nwindow.__mutantBuilt=1;\n' }],
    ['5: the built bundle stops writing a member its source writes', 5, (() => { const t = T(BUNDLE), from = 'window.__lastCause='; if (t.split(from).length < 2) throw new Error('no window.__lastCause= in the bundle'); return { [BUNDLE]: t.split(from).join('window.x__lastCause=') }; })()],
    ['1: an untyped use of window', 1, { [MAIN]: T(MAIN) + '\nexport const mutantAny=(window as any).__mutantAny;\n' }],
  ];
  const base = check(), out = { tool: 'dev/tools/checks/window_contract.js --mutants', control: base.ok ? 'PASS' : 'FAIL', mutants: [] };
  console.log(`${out.control.padEnd(7)} control: as it is`);
  for (const [id, rule, files] of M) {
    const r = check(files), caught = r.problems.some(p => p.startsWith(`rule ${rule}:`) && !base.problems.includes(p));   // a problem the break made
    out.mutants.push({ id, rule, caught, problems: r.problems.slice(0, 4) });
    console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${id}${caught ? '' : ' - ' + (r.problems[0] || 'no problem reported')}`);
  }
  out.ok = out.control === 'PASS' && out.mutants.every(m => m.caught);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(`WINDOW CONTRACT MUTANTS: ${out.ok ? 'PASS' : 'FAIL'} (${out.mutants.filter(m => m.caught).length} of ${out.mutants.length} breaks refused; the control ${out.control})`);
  process.exit(out.ok ? 0 : 1);
}
const R = Object.assign({ tool: 'dev/tools/checks/window_contract.js', typescript: ts.version }, check());
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
const mem = Object.entries(R.members).filter(([, M]) => M.declared);
for (const [n, M] of mem) console.log(`${n.padEnd(16)} ${M.client.writes.length ? 'written' : '       '}${M.client.reads.length ? ' read' : '     '} by the client; written by ${M.scripts.writes.join(', ') || (M.client.writes.length ? 'the client' : '-')}; declared: ${M.named.join(', ')}`);
for (const p of R.problems) console.log('  ' + p);
console.log(`WINDOW CONTRACT: ${R.ok ? 'PASS' : 'FAIL'} (${mem.length} window members declared for the compiled client and used by it; ${R.problems.length} problems; TypeScript ${ts.version})`);
process.exitCode = R.ok ? 0 : 1;
