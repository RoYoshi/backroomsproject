#!/usr/bin/env node
/* Stage 3H continuation C4 - is a readable port the same program as the shipped minified code it was written from? (development only;
 * needs the client build's packages installed somewhere: --rolldown <folder of node_modules/rolldown>).
 *
 *   node c4_alpha.mjs --orig <shipped .js text or a file with declarations> --new <the port: .ts or .js>
 *        --pairs a=b,c=d,...   the declarations to compare: a shipped top-level name = the port's name
 *        [--free x=y,...]      module-level names used but not compared (the shipped name = the port's name); others are inferred
 *        [--const N=v,...]     the port's constants the v11 minifier wrote as numbers (TILE=96 ...)
 *        [--pure f,g,...]      module functions (either side's names) known to have no effect: a dead local computed with them is dropped
 *        [--rolldown DIR]      where rolldown is (or TFB_ROLLDOWN): the client build's install (client.js --work DIR: DIR/tree/node_modules/rolldown)
 *
 * The two programs are parsed (oxc, ESTree), the port's TypeScript types removed, and each pair of declarations is put in a normal form
 * and compared node by node, modulo the names of bindings ("alpha-equivalence"):
 *   normal form (each rule keeps the meaning; the minifier and the hand-written minified style use the left forms):
 *     a, b, c;  ->  a; b; c;         a && b;  ->  if (a) b;         a || b;  ->  if (!a) b;        t ? a : b;  ->  if (t) a; else b;
 *     void e;  ->  e;         if (a, b, c) s  ->  a; b; if (c) s         if (a && (b, c)) s  ->  if (a) { b; if (c) s }  (no else)
 *     return a, b;  ->  a; return b;        return t ? a : b;  ->  if (t) return a; else return b;
 *     if (t) { ...; return } rest  ->  if (t) { ...; return } else { rest }        if (a) { if (b) s }  ->  if (a && b) s  (no else)
 *     at a function's end a last `return;` is dropped (a loop body's: `continue;`), so is one ending a last if's branch, and
 *     if (t) return; else { rest }  ->  if (!t) { rest }
 *     let a = 1, b = 2;  ->  let a = 1; let b = 2;   (const = let; var stays var)
 *     for (init-expression; t; u) s  ->  init; for (; t; u) s          for (; t; ) s  ->  while (t) s
 *     a block in a list is merged into the list when it declares no function and no name it declares is used elsewhere in the list;
 *     if bodies are lists;  x => e  ->  x => { return e }
 *     let x = <pure>; ... one read of x ...  ->  ... <pure> ...  (the minifier's inlining of a single-use local: only when x is read once,
 *     outside a nested function, never assigned, and nothing in between has an effect or assigns what the initializer reads); a pure
 *     local nobody reads is dropped.  Pure: literals, names, property reads, arithmetic, comparisons, logic, conditionals, Math's
 *     functions and --pure functions, of pure arguments
 *     !0 -> true, !1 -> false, void 0 -> undefined, 1/0 -> Infinity, `text` -> 'text', (e) -> e, o['name'] -> o.name,
 *     !(a === b) -> a !== b (an equality only: <, >, <=, >= are never inverted, for NaN), typeof x == 's' -> typeof x === 's',
 *     n == m -> n === m when both are numbers (a number literal, or arithmetic with one), t ? 1 : 0 -> +t when t is a comparison or a !
 *     in a test (if, a loop's, a ?:'s): !!a -> a, and a negation pushed into && and || (De Morgan)
 *   names: a binding (a parameter, a variable, a function or class name) on one side must pair with the binding at the same place on
 *   the other side, and every use of it with a use of its pair; a free name (module-level, global) must pair with the same free name
 *   every time (Math = Math, the shipped Hc = the port's blocksSight).  Property names must be equal.  A module's `var X = class` is
 *   the port's `class X`.  The port's named constants equal the numbers the v11 minifier wrote for them (--const: TILE = 96).
 *   rewrites (c4_alpha_all.mjs; each one a reviewed change of structure, listed with its reason in c4_alpha_modules.json): a shipped
 *   module-level variable the port keeps as an object's property (members: FL = arrival.fall), or passes in as a function's last
 *   parameter (params: au = lightOn, with callArgs: the calls of that function pass it).
 * The rules are tested by their mutants (c4_port_mutants.mjs: each of 25 one-place edits of a copy of the port or of the one definition it is built with is caught).
 * The first difference of each pair is printed with its path and both sides' code.  Exit 0 only when every pair is equal. */
import fs from 'fs'; import path from 'path';
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const RD = ARG.rolldown || process.env.TFB_ROLLDOWN;
if (!RD) { console.error('C4 ALPHA: NOT RUN - needs rolldown (the client build\'s packages installed): --rolldown <its folder> or TFB_ROLLDOWN (dev/tools/build/client.js --work DIR leaves it in DIR/tree/node_modules/rolldown)'); process.exit(2); }
const { parseSync, transformSync, minifySync } = await import(path.join(RD, 'dist', 'utils-index.mjs'));

/* (C4c) the build's constants (src/core/client/game/level-data.cjs: each name the build defines as its value) put in place in a parsed
   port: every read of a name in values becomes the value's literal (as the build writes it).  Refused: such a name declared in the
   module, or assigned; a shorthand property of one. */
export function substitute(program, values) {
  const names = new Set(Object.keys(values)), lit = v => parseJs('x=' + JSON.stringify(v), 'value.js').body[0].expression.right;
  let n = 0;
  const visit = (node, parent, key) => {
    if (Array.isArray(node)) { node.forEach((x, i) => visit(x, node, i)); return; }
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    if ((node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && names.has(node.id.name)) || ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id && names.has(node.id.name)))
      throw new Error(`the build constant ${node.id.name} is declared in the port`);
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && names.has(node.left.name)) throw new Error(`the build constant ${node.left.name} is assigned`);
    if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier' && names.has(node.argument.name)) throw new Error(`the build constant ${node.argument.name} is assigned`);
    if (node.type === 'Property' && node.shorthand && node.value.type === 'Identifier' && names.has(node.value.name)) throw new Error(`the build constant ${node.value.name} is a shorthand property`);
    if (node.type === 'Identifier' && names.has(node.name)) { parent[key] = lit(values[node.name]); n++; return; }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'range' || k === 'loc') continue;
      if ((node.type === 'MemberExpression' && k === 'property' && !node.computed) || ((node.type === 'Property' || node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') && k === 'key' && !node.computed)) continue;
      visit(v, node, k);
    }
  };
  visit(program, null, null);
  return n;
}
export function parseJs(code, file = 'x.js') {
  const r = parseSync(file, code); if (r.errors && r.errors.length) throw new Error(file + ': ' + r.errors.map(e => e.message).join('; '));
  return r.program;
}
export function stripTs(code, file = 'x.ts') { const r = transformSync(file, code, { target: 'esnext' }); if (r.errors && r.errors.length) throw new Error(r.errors.map(e => e.message).join('; ')); return r.code; }

/* ------------------------------------------------------------------ the normal form */
const P = n => { while (n && n.type === 'ParenthesizedExpression') n = n.expression; return n; };
const ID = /^[A-Za-z_$][\w$]*$/;
const lit = v => ({ type: 'Literal', value: v });
const INV_EQ = { '===': '!==', '!==': '===', '==': '!=', '!=': '==' };     // an equality's negation (never < > <= >=: NaN)
/* an expression that is a number whenever it gives a value: a number literal, +x, -n and ~n of such, arithmetic with such an operand
   (a BigInt with a number throws), n + n */
const ARITH = new Set(['-', '*', '/', '%', '**', '<<', '>>', '>>>', '&', '|', '^']);
const isNum = x => { x = P(x); if (!x) return false;
  if (x.type === 'Literal') return typeof x.value === 'number';
  if (x.type === 'UnaryExpression') return x.operator === '+' || ((x.operator === '-' || x.operator === '~') && isNum(x.argument));
  if (x.type === 'BinaryExpression') return ARITH.has(x.operator) ? isNum(x.left) || isNum(x.right) : x.operator === '+' && isNum(x.left) && isNum(x.right);
  return false; };
export function nexpr(e) {
  e = P(e); if (!e || typeof e !== 'object') return e;
  switch (e.type) {
    case 'Identifier': return { type: 'Identifier', name: e.name };
    case 'ThisExpression': return { type: 'ThisExpression' };
    case 'Super': return { type: 'Super' };
    case 'AssignmentExpression': return { type: 'AssignmentExpression', operator: e.operator, left: npat(e.left), right: nexpr(e.right) };
    case 'UnaryExpression': {
      const a = P(e.argument);
      if (e.operator === '!' && a.type === 'Literal' && typeof a.value === 'number' && (a.value === 0 || a.value === 1)) return lit(a.value === 0);
      if (e.operator === 'void' && a.type === 'Literal' && a.value === 0) return { type: 'Identifier', name: 'undefined' };
      if (e.operator === '!' && a.type === 'BinaryExpression' && INV_EQ[a.operator]) return nexpr({ ...a, operator: INV_EQ[a.operator] });   // !(a === b) -> a !== b
      return { type: 'UnaryExpression', operator: e.operator, argument: nexpr(a) };
    }
    case 'TemplateLiteral': if (!e.expressions.length) return lit(e.quasis[0].value.cooked);
      return { type: 'TemplateLiteral', quasis: e.quasis.map(q => q.value.cooked), expressions: e.expressions.map(nexpr) };
    case 'Literal': return e.regex ? { type: 'Literal', regex: e.regex.pattern + '/' + e.regex.flags } : lit(e.value);
    case 'MemberExpression': {
      let prop = P(e.property), computed = e.computed;
      if (computed && prop.type === 'Literal' && typeof prop.value === 'string' && ID.test(prop.value)) { prop = { type: 'Identifier', name: prop.value }; computed = false; }
      if (computed && prop.type === 'TemplateLiteral' && !prop.expressions.length && ID.test(prop.quasis[0].value.cooked)) { prop = { type: 'Identifier', name: prop.quasis[0].value.cooked }; computed = false; }
      return { type: 'MemberExpression', object: nexpr(e.object), property: computed ? nexpr(prop) : { type: 'Prop', name: prop.name }, computed, optional: !!e.optional };
    }
    case 'BinaryExpression': {
      let op = e.operator; const l = P(e.left), r = P(e.right);
      const isTypeof = x => x.type === 'UnaryExpression' && x.operator === 'typeof', isStr = x => (x.type === 'Literal' && typeof x.value === 'string') || (x.type === 'TemplateLiteral' && !x.expressions.length);
      if ((op === '==' || op === '!=') && ((isTypeof(l) && isStr(r)) || (isStr(l) && isTypeof(r)))) op += '=';
      if ((op === '==' || op === '!=') && isNum(l) && isNum(r)) op += '=';                          // e % 3 == 0: two numbers

      if (op === '/' && r.type === 'Literal' && r.value === 0) {                                   // 1/0 is the minifier's Infinity
        if (l.type === 'Literal' && l.value === 1) return { type: 'Identifier', name: 'Infinity' };
        if (l.type === 'UnaryExpression' && l.operator === '-' && P(l.argument).type === 'Literal' && P(l.argument).value === 1) return { type: 'UnaryExpression', operator: '-', argument: { type: 'Identifier', name: 'Infinity' } };
      }
      return { type: 'BinaryExpression', operator: op, left: nexpr(l), right: nexpr(r) };
    }
    case 'ArrowFunctionExpression': return { type: 'Function', arrow: true, async: !!e.async, generator: false, id: null, params: e.params.map(npat), body: e.expression ? earlyExit(returnStmts(e.body)) : tailReturn(nstmts(e.body.body)) };
    case 'FunctionExpression': return nfunc(e);
    case 'ClassExpression': return nclass(e);
    case 'Property': {
      const key = e.computed ? nexpr(e.key) : { type: 'Prop', name: e.key.type === 'Identifier' ? e.key.name : String(e.key.value) };
      return { type: 'Property', kind: e.kind, method: !!e.method, computed: !!e.computed, key, value: e.method || e.kind !== 'init' ? nfunc(e.value) : nexpr(e.value) };
    }
    case 'ChainExpression': return { type: 'ChainExpression', expression: nexpr(e.expression) };
    case 'ConditionalExpression': {                                                               // t ? 1 : 0, t a comparison: +t
      const t = P(e.test), c = P(e.consequent), al = P(e.alternate);
      const boolish = x => (x.type === 'BinaryExpression' && ['<', '>', '<=', '>=', '==', '!=', '===', '!==', 'in', 'instanceof'].includes(x.operator)) || (x.type === 'UnaryExpression' && x.operator === '!');
      if (c.type === 'Literal' && c.value === 1 && al.type === 'Literal' && al.value === 0 && boolish(t)) return { type: 'UnaryExpression', operator: '+', argument: nexpr(t) };
      return { type: 'ConditionalExpression', test: nexpr(t), consequent: nexpr(c), alternate: nexpr(al) };
    }
    default: {
      const o = { type: e.type };
      for (const [k, v] of Object.entries(e)) {
        if (k === 'type' || k === 'start' || k === 'end' || k === 'range' || k === 'loc') continue;
        o[k] = Array.isArray(v) ? v.map(x => (x && typeof x === 'object' ? nexpr(x) : x)) : v && typeof v === 'object' ? nexpr(v) : v;
      }
      return o;
    }
  }
}
/* an expression whose value is only tested for truth (an if, a loop's test, a ?:'s test): !!a -> a, and negations pushed inward
   (De Morgan; a comparison is never inverted, for NaN) */
export function ntest(e) {
  if (!e || typeof e !== 'object') return e;
  if (e.type === 'UnaryExpression' && e.operator === '!') {
    const a = e.argument;
    if (a.type === 'UnaryExpression' && a.operator === '!') return ntest(a.argument);
    if (a.type === 'BinaryExpression' && INV_EQ[a.operator]) return { ...a, operator: INV_EQ[a.operator] };     // !(a !== b) -> a === b
    if (a.type === 'LogicalExpression' && (a.operator === '||' || a.operator === '&&')) return { type: 'LogicalExpression', operator: a.operator === '||' ? '&&' : '||', left: ntest({ type: 'UnaryExpression', operator: '!', argument: a.left }), right: ntest({ type: 'UnaryExpression', operator: '!', argument: a.right }) };
    return e;
  }
  if (e.type === 'LogicalExpression' && (e.operator === '||' || e.operator === '&&')) return { ...e, left: ntest(e.left), right: ntest(e.right) };
  return e;
}
function npat(p) {
  p = P(p); if (!p) return p;
  switch (p.type) {
    case 'Identifier': return { type: 'Identifier', name: p.name };
    case 'AssignmentPattern': return { type: 'AssignmentPattern', left: npat(p.left), right: nexpr(p.right) };
    case 'ArrayPattern': return { type: 'ArrayPattern', elements: p.elements.map(x => (x ? npat(x) : null)) };
    case 'ObjectPattern': return { type: 'ObjectPattern', properties: p.properties.map(q => (q.type === 'RestElement' ? { type: 'RestElement', argument: npat(q.argument) } : { type: 'Property', computed: !!q.computed, key: q.computed ? nexpr(q.key) : { type: 'Prop', name: q.key.type === 'Identifier' ? q.key.name : String(q.key.value) }, value: npat(q.value) })) };
    case 'RestElement': return { type: 'RestElement', argument: npat(p.argument) };
    default: return nexpr(p);                                       // a member expression as an assignment target
  }
}
function nfunc(f) { return { type: 'Function', arrow: false, async: !!f.async, generator: !!f.generator, id: f.id ? { type: 'Identifier', name: f.id.name } : null, params: f.params.map(npat), body: tailReturn(nstmts(f.body.body)) }; }
/* a function body that ends  if (t) return; else { rest }  ->  if (!t) { rest }  (both return undefined after either branch); a loop
   body that ends  if (t) continue; else { rest }  ->  if (!t) { rest }  (both go on to the next turn) */
function tailJump(body, kind) {
  const last = body[body.length - 1];
  const jump = s => (kind === 'return' ? s.type === 'ReturnStatement' && s.argument === null : s.type === 'ContinueStatement' && !s.label);
  if (last && jump(last)) return tailJump(body.slice(0, -1), kind);                  // a last `return;` (`continue;`) does nothing
  if (last && last.type === 'If' && last.alt && last.cons.length === 1 && jump(last.cons[0]))
    return [...body.slice(0, -1), { type: 'If', test: ntest({ type: 'UnaryExpression', operator: '!', argument: last.test }), cons: tailJump(last.alt, kind), alt: null }];
  if (last && last.type === 'If' && (last.cons.length || last.alt)) {             // both branches of a last if are in tail position
    const alt = last.alt ? tailJump(last.alt, kind) : null;
    return [...body.slice(0, -1), { ...last, cons: tailJump(last.cons, kind), alt: alt && alt.length ? alt : null }];
  }
  return body;
}
const tailReturn = body => tailJump(body, 'return').map(mergeIf);
const loopBody = body => tailJump(body, 'continue').map(mergeIf);
function nclass(c) {
  return { type: 'Class', id: c.id ? { type: 'Identifier', name: c.id.name } : null, superClass: c.superClass ? nexpr(c.superClass) : null,
    body: c.body.body.filter(m => !(m.type === 'PropertyDefinition' && m.declare)).map(m => ({ type: m.type, kind: m.kind || null, static: !!m.static, computed: !!m.computed,
      key: m.computed ? nexpr(m.key) : { type: 'Prop', name: m.key.type === 'Identifier' || m.key.type === 'PrivateIdentifier' ? (m.key.type === 'PrivateIdentifier' ? '#' : '') + m.key.name : String(m.key.value) },
      value: m.type === 'MethodDefinition' ? nfunc(m.value) : m.value ? nexpr(m.value) : null })) };
}
const lexical = s => (s.type === 'VariableDeclaration' && s.kind !== 'var') || s.type === 'ClassDeclaration' || s.type === 'FunctionDeclaration';
function asList(s) { return !s ? [] : s.type === 'BlockStatement' ? s.body : [s]; }
export function nstmts(list) {
  const out = [];
  const push = s => { for (const x of nstmt(s)) out.push(x); };
  for (const s of list) push(s);
  return earlyExit(inlinePure(mergeBlocks(out.map(mergeIf))));
}
/* if (a) { if (b) s }  ->  if (a && b) s  (neither with an else) */
function mergeIf(s) {
  if (!s || s.type !== 'If') return s;
  const cons = s.cons.map(mergeIf), alt = s.alt ? s.alt.map(mergeIf) : null;
  if (!alt && cons.length === 1 && cons[0].type === 'If' && !cons[0].alt) return { type: 'If', test: { type: 'LogicalExpression', operator: '&&', left: s.test, right: cons[0].test }, cons: cons[0].cons, alt: null };
  return { ...s, cons, alt };
}
/* { let x ...; } inside a list  ->  its statements in the list, when no name it declares is used or declared anywhere else in the list
   (and it declares no function: a block's function declarations have their own rules) */
function mergeBlocks(list) {
  for (let i = 0; i < list.length; i++) {
    const b = list[i]; if (b.type !== 'Block' || b.body.some(x => x.type === 'FunctionDeclaration')) continue;
    const own = declsOf(b.body, false), elsewhere = names([...list.slice(0, i), ...list.slice(i + 1)]);
    if (own.some(n => elsewhere.has(n))) continue;
    return mergeBlocks([...list.slice(0, i), ...b.body, ...list.slice(i + 1)]);
  }
  return list;
}
/* let x = <pure>; ... one use of x  ->  ... <pure> in its place (the minifier's inlining of a single-use local).  Pure: literals, names,
   property reads, arithmetic, comparisons, logic, conditionals and Math's functions of pure arguments.  Only when x is read exactly
   once in the rest of the list, outside any nested function, never assigned, and nothing between the declaration and that statement
   assigns a name the initializer reads. */
const PURE_OPS = new Set(['UnaryExpression', 'BinaryExpression', 'LogicalExpression', 'ConditionalExpression', 'MemberExpression', 'Literal', 'Identifier', 'TemplateLiteral', 'Prop']);
/* (C4c) Math's constants, read-only properties of the global Math: Math.PI * 2 in the shipped code is the number a JSON file holds */
const MATH_CONSTANTS = { PI: Math.PI, E: Math.E, LN2: Math.LN2, LN10: Math.LN10, LOG2E: Math.LOG2E, LOG10E: Math.LOG10E, SQRT2: Math.SQRT2, SQRT1_2: Math.SQRT1_2 };
export const PURE_FNS = new Set();                               // module functions known to have no effect (--pure): angleDelta ...
function pure(e) {
  if (!e || typeof e !== 'object') return true;
  if (Array.isArray(e)) return e.every(pure);
  if (e.type === 'CallExpression') return ((e.callee.type === 'MemberExpression' && !e.callee.computed && e.callee.object.type === 'Identifier' && e.callee.object.name === 'Math') || (e.callee.type === 'Identifier' && PURE_FNS.has(e.callee.name))) && e.arguments.every(pure);
  if (e.type === 'UnaryExpression' && e.operator === 'delete') return false;
  if (!PURE_OPS.has(e.type)) return false;
  for (const [k, v] of Object.entries(e)) if (k !== 'type' && v && typeof v === 'object' && !pure(v)) return false;
  return true;
}
function names(e, out = new Set()) { if (!e || typeof e !== 'object') return out; if (Array.isArray(e)) { e.forEach(x => names(x, out)); return out; } if (e.type === 'Identifier') out.add(e.name); else if (e.type !== 'Prop') for (const [k, v] of Object.entries(e)) if (k !== 'type' && v && typeof v === 'object') names(v, out); return out; }
const loopDeclares = (node, n) => (node.type === 'For' && Array.isArray(node.init) && node.init.some(x => x.type === 'Var' && x.kind !== 'var' && patHas(x.id, n))) ||
  ((node.type === 'ForOfStatement' || node.type === 'ForInStatement') && Array.isArray(node.left) && node.left.some(x => x.type === 'Var' && x.kind !== 'var' && patHas(x.id, n)));
function patHas(p, n) { const out = []; patNames(p, out); return out.includes(n); }
function countUses(node, n, st = { reads: 0, writes: 0, inFn: false }, top = true) {
  if (!node || typeof node !== 'object') return st;
  if (!Array.isArray(node) && loopDeclares(node, n)) return st;      // a loop with its own n: what it holds is not about our n
  if (Array.isArray(node)) {
    // a nested statement list that declares its own n (let/const) shadows ours: what it holds is not about our n
    if (!top && node.some(x => x && x.type === 'Var' && x.kind !== 'var' && x.id.type === 'Identifier' && x.id.name === n)) return st;
    node.forEach(x => countUses(x, n, st, false)); return st;
  }
  if (node.type === 'Function' || node.type === 'Class') { const before = st.reads + st.writes; const inner = countUses(node.type === 'Function' ? [node.params, node.body] : node.body, n, { reads: 0, writes: 0 }); if (inner.reads || inner.writes) st.inFn = true; void before; return st; }
  if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && node.left.name === n) { st.writes++; countUses(node.right, n, st); return st; }
  if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier' && node.argument.name === n) { st.writes++; return st; }
  if (node.type === 'Var' && node.id.type === 'Identifier' && node.id.name === n) { st.writes++; countUses(node.init, n, st); return st; }   // a redeclaration (shadow): give up
  if (node.type === 'Identifier' && node.name === n) { st.reads++; return st; }
  for (const [k, v] of Object.entries(node)) if (k !== 'type' && v && typeof v === 'object') countUses(v, n, st, false);
  return st;
}
function assigns(node, set) {                                     // does node assign any of these names (or call something that might)?
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(x => assigns(x, set));
  if (node.type === 'Function' || node.type === 'Class') return false;
  if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && set.has(node.left.name)) return true;
  if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier' && set.has(node.argument.name)) return true;
  if (node.type === 'Var' && node.id.type === 'Identifier' && set.has(node.id.name)) return true;
  return Object.entries(node).some(([k, v]) => k !== 'type' && v && typeof v === 'object' && assigns(v, set));
}
function effects(node) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(effects);
  if (node.type === 'Function' || node.type === 'Class') return false;
  if (node.type === 'CallExpression' && !(node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Math')) return true;
  if (node.type === 'NewExpression' || node.type === 'TaggedTemplateExpression') return true;
  if ((node.type === 'AssignmentExpression' && node.left.type !== 'Identifier') || (node.type === 'UpdateExpression' && node.argument.type !== 'Identifier') || (node.type === 'UnaryExpression' && node.operator === 'delete')) return true;
  return Object.entries(node).some(([k, v]) => k !== 'type' && v && typeof v === 'object' && effects(v));
}
/* what is evaluated before the use of n inside a statement, in evaluation order: the parts that could run first and change what the
   initializer reads (null when the use is in a loop - evaluated again each time - or in a form not followed here) */
function beforeUse(st, n) {
  const has = x => countUses(x, n).reads > 0;
  const expr = (e, out) => {                                          // e holds the use: push what runs before it, return true when found
    if (!e || typeof e !== 'object') return false;
    if (e.type === 'Identifier') return e.name === n;
    const seq = parts => { for (const p of parts) { if (p && has(p)) return expr(p, out); if (p) out.push(p); } return false; };
    switch (e.type) {
      case 'CallExpression': case 'NewExpression': return seq([e.callee.type === 'MemberExpression' ? e.callee.object : e.callee, ...(e.callee.type === 'MemberExpression' && e.callee.computed ? [e.callee.property] : []), ...e.arguments]);
      case 'MemberExpression': return seq([e.object, e.computed ? e.property : null]);
      case 'BinaryExpression': case 'LogicalExpression': return seq([e.left, e.right]);
      case 'UnaryExpression': return seq([e.argument]);
      case 'ConditionalExpression': return seq([e.test, e.consequent, e.alternate]);
      case 'AssignmentExpression': return seq([e.left.type === 'MemberExpression' ? e.left.object : null, e.left.type === 'MemberExpression' && e.left.computed ? e.left.property : null, e.right]);
      case 'ArrayExpression': return seq(e.elements);
      case 'ObjectExpression': return seq(e.properties.map(p => (p.type === 'Property' ? p.value : p)));
      case 'TemplateLiteral': return seq(e.expressions);
      case 'SpreadElement': return seq([e.argument]);
      default: return null;
    }
  };
  const out = [];
  if (st.type === 'ExpressionStatement') return expr(st.expression, out) ? out : null;
  if (st.type === 'Var') return expr(st.init, out) ? out : null;
  if (st.type === 'ReturnStatement') return expr(st.argument, out) ? out : null;
  if (st.type === 'If') {
    if (has(st.test)) return expr(st.test, out) ? out : null;
    out.push(st.test);
    for (const list of [st.cons, st.alt || []]) {
      const k = list.findIndex(has); if (k < 0) continue;
      out.push(...list.slice(0, k)); const inner = beforeUse(list[k], n); return inner ? [...out, ...inner] : null;
    }
  }
  return null;
}
function replaceUse(node, n, withExpr, top = true) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    if (!top && node.some(x => x && x.type === 'Var' && x.kind !== 'var' && x.id.type === 'Identifier' && x.id.name === n)) return node;   // a list with its own n
    return node.map(x => replaceUse(x, n, withExpr, false));
  }
  if (node.type === 'Identifier' && node.name === n) return withExpr;
  if (node.type === 'Function' || node.type === 'Class' || loopDeclares(node, n)) return node;
  const o = {}; for (const [k, v] of Object.entries(node)) o[k] = v && typeof v === 'object' ? replaceUse(v, n, withExpr, false) : v; return o;
}
function inlinePure(list) {
  for (let i = 0; i < list.length; i++) {                         // a pure local nobody reads or writes again is dead: dropped
    const d = list[i];
    if (d.type !== 'Var' || d.kind === 'var' || d.id.type !== 'Identifier' || (d.init && !pure(d.init))) continue;
    const st = countUses(list.slice(i + 1), d.id.name);
    if (!st.reads && !st.writes && !st.inFn) return inlinePure([...list.slice(0, i), ...list.slice(i + 1)]);
  }
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    if (d.type !== 'Var' || d.kind === 'var' || d.id.type !== 'Identifier' || !d.init || !pure(d.init)) continue;
    const n = d.id.name, rest = list.slice(i + 1), st = countUses(rest, n);
    if (st.reads !== 1 || st.writes || st.inFn) continue;
    const j = rest.findIndex(x => countUses(x, n).reads === 1), deps = names(d.init);
    if (deps.has(n) || assigns(rest.slice(0, j), deps)) continue;
    /* the use must be reached before anything in its own statement assigns a name the initializer reads: only inline into a statement
       that assigns none of them; and nothing between (nor that statement) may call a function or write a property, which could change
       a name the initializer reads (a module-level one) or what it reads through a property */
    const pre = beforeUse(rest[j], n);                            // what runs before the use, in its statement (null: a loop, or unknown)
    if (!pre || effects(rest.slice(0, j)) || effects(pre) || assigns(pre, deps)) continue;
    const next = [...list.slice(0, i), ...rest.slice(0, j), replaceUse(rest[j], n, d.init), ...rest.slice(j + 1)];
    return inlinePure(next);
  }
  return list;
}
/* if (t) { ...; return } rest  ->  if (t) { ...; return } else { rest }  (the minifier writes the first as `return t ? a : b`) */
const jumps = s => s && (s.type === 'ReturnStatement' || s.type === 'ThrowStatement' || s.type === 'BreakStatement' || s.type === 'ContinueStatement' || (s.type === 'If' && s.alt && ends(s.cons) && ends(s.alt)));
const ends = list => !!list && list.length > 0 && jumps(list[list.length - 1]);
function earlyExit(list) {
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.type === 'If' && !s.alt && ends(s.cons) && i < list.length - 1) { const rest = earlyExit(list.slice(i + 1)); return [...list.slice(0, i), { ...s, alt: rest }]; }
  }
  return list;
}
function exprStmts(e) {                                             // an expression evaluated for its effect, as statements
  e = P(e);
  if (e.type === 'SequenceExpression') return e.expressions.flatMap(exprStmts);
  if (e.type === 'UnaryExpression' && e.operator === 'void') return exprStmts(e.argument);          // void e;  ->  e;
  if (e.type === 'LogicalExpression' && e.operator === '&&') return [{ type: 'If', test: ntest(nexpr(e.left)), cons: exprStmts(e.right), alt: null }];
  if (e.type === 'LogicalExpression' && e.operator === '||') return [{ type: 'If', test: ntest(nexpr({ type: 'UnaryExpression', operator: '!', argument: e.left })), cons: exprStmts(e.right), alt: null }];
  if (e.type === 'ConditionalExpression') return [{ type: 'If', test: ntest(nexpr(e.test)), cons: exprStmts(e.consequent), alt: exprStmts(e.alternate) }];
  return [{ type: 'ExpressionStatement', expression: nexpr(e) }];
}
function returnStmts(a) {
  a = P(a);
  if (a && a.type === 'SequenceExpression') return [...a.expressions.slice(0, -1).flatMap(exprStmts), ...returnStmts(a.expressions[a.expressions.length - 1])];
  if (a && a.type === 'ConditionalExpression') return [{ type: 'If', test: ntest(nexpr(a.test)), cons: returnStmts(a.consequent), alt: returnStmts(a.alternate) }];
  return [{ type: 'ReturnStatement', argument: a ? nexpr(a) : null }];
}
function nstmt(s) {
  switch (s.type) {
    case 'EmptyStatement': return [];
    case 'ExpressionStatement': return exprStmts(s.expression);
    case 'IfStatement': {
      const t = P(s.test);
      if (t.type === 'SequenceExpression') return [...t.expressions.slice(0, -1).flatMap(exprStmts), ...nstmt({ ...s, test: t.expressions[t.expressions.length - 1] })];   // if (a, b, c) s -> a; b; if (c) s
      if (!s.alternate && t.type === 'LogicalExpression' && t.operator === '&&' && P(t.right).type === 'SequenceExpression') {          // if (a && (b, c)) s -> if (a) { b; if (c) s }
        const seq = P(t.right).expressions;
        return [{ type: 'If', test: ntest(nexpr(t.left)), cons: nstmts([...seq.slice(0, -1).map(x => ({ type: 'ExpressionStatement', expression: x })), { ...s, test: seq[seq.length - 1] }]), alt: null }];
      }
      const cons = nstmts(asList(s.consequent)), alt = s.alternate ? nstmts(asList(s.alternate)) : null;
      return [{ type: 'If', test: ntest(nexpr(t)), cons, alt: alt && alt.length ? alt : null }];
    }
    case 'ReturnStatement': return returnStmts(s.argument);
    case 'ThrowStatement': { const a = P(s.argument); if (a.type === 'SequenceExpression') return [...a.expressions.slice(0, -1).flatMap(exprStmts), { type: 'ThrowStatement', argument: nexpr(a.expressions[a.expressions.length - 1]) }]; return [{ type: 'ThrowStatement', argument: nexpr(a) }]; }
    case 'VariableDeclaration': return s.declarations.map(d => ({ type: 'Var', kind: s.kind === 'var' ? 'var' : 'let', id: npat(d.id), init: d.init ? nexpr(d.init) : null }));
    case 'FunctionDeclaration': return [{ type: 'FunctionDeclaration', fn: nfunc(s) }];
    case 'ClassDeclaration': return [{ type: 'ClassDeclaration', cls: nclass(s) }];
    case 'BlockStatement': { const b = nstmts(s.body); return b.some(lexicalN) ? [{ type: 'Block', body: b }] : b; }
    case 'ForStatement': {
      const pre = s.init && s.init.type !== 'VariableDeclaration' ? exprStmts(s.init) : [];
      const body = loopBody(nstmts(asList(s.body)));
      if (!s.init || s.init.type !== 'VariableDeclaration') { if (!s.update) return [...pre, { type: 'While', test: s.test ? ntest(nexpr(s.test)) : lit(true), body }]; return [...pre, { type: 'For', init: null, test: s.test ? ntest(nexpr(s.test)) : null, update: s.update ? exprList(s.update) : null, body }]; }
      return [{ type: 'For', init: nstmt(s.init), test: s.test ? ntest(nexpr(s.test)) : null, update: s.update ? exprList(s.update) : null, body }];
    }
    case 'WhileStatement': return [{ type: 'While', test: ntest(nexpr(s.test)), body: loopBody(nstmts(asList(s.body))) }];
    case 'DoWhileStatement': return [{ type: 'DoWhile', test: nexpr(s.test), body: nstmts(asList(s.body)) }];
    case 'ForOfStatement': case 'ForInStatement': return [{ type: s.type, left: s.left.type === 'VariableDeclaration' ? nstmt(s.left) : npat(s.left), right: nexpr(s.right), body: loopBody(nstmts(asList(s.body))), await: !!s.await }];
    case 'TryStatement': return [{ type: 'Try', block: nstmts(s.block.body), param: s.handler && s.handler.param ? npat(s.handler.param) : null, handler: s.handler ? nstmts(s.handler.body.body) : null, finalizer: s.finalizer ? nstmts(s.finalizer.body) : null }];
    case 'SwitchStatement': return [{ type: 'Switch', disc: nexpr(s.discriminant), cases: s.cases.map(c => ({ test: c.test ? nexpr(c.test) : null, body: nstmts(c.consequent) })) }];
    case 'BreakStatement': case 'ContinueStatement': return [{ type: s.type, label: s.label ? s.label.name : null }];
    case 'LabeledStatement': return [{ type: 'Labeled', label: s.label.name, body: nstmt(s.body) }];
    case 'ExportNamedDeclaration': return s.declaration ? nstmt(s.declaration) : [];
    case 'ExportDefaultDeclaration': return [];
    case 'ImportDeclaration': return [];
    default: return [{ type: 'Raw', node: nexpr(s) }];
  }
}
const lexicalN = s => (s.type === 'Var' && s.kind !== 'var') || s.type === 'ClassDeclaration' || s.type === 'FunctionDeclaration';
function exprList(e) { e = P(e); return e.type === 'SequenceExpression' ? e.expressions.map(nexpr) : [nexpr(e)]; }

/* ------------------------------------------------------------------ alpha-equivalence */
export class Alpha {
  /* free: [shipped name, port name] pairs; consts: { name: value } for the port's free constants that the v11 minifier wrote as numbers
     (TILE = 96 ...): a constant expression (literals, those names, + - * / % and unary -) equals another of the same value */
  /* rewrites (each one a declared, reviewed change of structure; tools/c4_alpha_modules.json says why):
       members   { shipped: 'object.property' }  a module-level variable of the shipped code that the port keeps as a property of an
                 object it owns (FL -> arrival.fall): every read and write of it, as the same read and write of the property
       params    { shipped: 'param' }  a module-level variable the shipped function reads, which the port passes in as its last
                 parameter(s) (au -> lightOn)
       callArgs  { method: ['shipped', ...] }  the calls of that method pass those variables as their last arguments */
  constructor(free, consts, rewrites = {}) { this.free = new Map(free || []); this.rev = new Map([...this.free].map(([a, b]) => [b, a])); this.diffs = []; this.inferred = []; this.consts = consts || {};
    const own = o => Object.assign(Object.create(null), o || {});     // (no inherited keys: a name like constructor is not a rewrite)
    this.members = own(Object.fromEntries(Object.entries(rewrites.members || {}).map(([k, v]) => [k, v.split('.')]))); this.params = own(rewrites.params); this.callArgs = own(rewrites.callArgs); }
  member(a, b, sa, sb) {                                               // the shipped free name a and the port's object.property b
    const path = this.members[a.name]; if (!path || resolve(a.name, sa)) return false;
    let x = b;
    for (let i = path.length - 1; i > 0; i--) { if (!x || x.type !== 'MemberExpression' || x.computed || x.optional || x.property.name !== path[i]) return false; x = x.object; }
    return !!x && x.type === 'Identifier' && x.name === path[0] && !resolve(path[0], sb);
  }
  cval(n, chain, side) {
    if (!n || typeof n !== 'object') return undefined;
    if (n.type === 'Literal') return typeof n.value === 'number' ? n.value : undefined;
    if (n.type === 'Identifier') return side === 1 && !resolve(n.name, chain) && Object.prototype.hasOwnProperty.call(this.consts, n.name) ? this.consts[n.name] : undefined;
    if (n.type === 'MemberExpression' && !n.computed && n.object && n.object.type === 'Identifier' && n.object.name === 'Math' && !resolve('Math', chain) && n.property && Object.prototype.hasOwnProperty.call(MATH_CONSTANTS, n.property.name)) return MATH_CONSTANTS[n.property.name];   // (C4c) Math.PI ...
    if (n.type === 'UnaryExpression' && n.operator === '-') { const v = this.cval(n.argument, chain, side); return v === undefined ? undefined : -v; }
    if (n.type === 'BinaryExpression' && '+-*/%'.includes(n.operator) && n.operator.length === 1) { const l = this.cval(n.left, chain, side), r = this.cval(n.right, chain, side); if (l === undefined || r === undefined) return undefined;
      return n.operator === '+' ? l + r : n.operator === '-' ? l - r : n.operator === '*' ? l * r : n.operator === '/' ? l / r : l % r; }
    return undefined;
  }
  pairFree(a, b, where) {
    if (this.free.has(a) || this.rev.has(b)) { if (this.free.get(a) === b) return true; this.fail(where, `the free name ${a} is paired with ${this.free.get(a) || '(none)'}, and ${b} with ${this.rev.get(b) || '(none)'}`); return false; }
    this.free.set(a, b); this.rev.set(b, a); if (a !== b) this.inferred.push(a + '=' + b); return true;
  }
  fail(where, msg) { if (!this.diffs.length) this.diffs.push({ where, msg }); throw new Error('DIFF'); }
  /* compare two normalized nodes; sa / sb: scope chains (arrays of Map name -> binding id) */
  eq(a, b, where, sa, sb) {
    if (a === b) return;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (Object.is(a, b) || (typeof a === 'number' && typeof b === 'number' && a === b)) return; this.fail(where, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`); }
    if (!Array.isArray(a) && a.type === 'Identifier' && this.members[a.name] && !resolve(a.name, sa)) { if (this.member(a, b, sa, sb)) return; this.fail(where, `${a.name} is ${this.members[a.name].join('.')} in the port, not ${short(b)}`); }
    if (!Array.isArray(a) && a.type === 'CallExpression' && b.type === 'CallExpression' && a.callee.type === 'MemberExpression' && !a.callee.computed && this.callArgs[a.callee.property.name] && !a.__args)
      a = { ...a, __args: true, arguments: [...a.arguments, ...this.callArgs[a.callee.property.name].map(n => ({ type: 'Identifier', name: n }))] };
    if (!Array.isArray(a) && !Array.isArray(b) && (a.type !== b.type || a.type === 'BinaryExpression' || a.type === 'Identifier' || a.type === 'UnaryExpression')) {
      const ca = this.cval(a, sa, 0), cb = this.cval(b, sb, 1);
      if (ca !== undefined && cb !== undefined) { if (Object.is(ca, cb) || ca === cb) return; this.fail(where, `the constant ${ca} vs ${cb}`); }
    }
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) this.fail(where, 'a list vs not a list');
      if (a.length !== b.length) this.fail(where, `${a.length} items vs ${b.length}: ${short(a)} | ${short(b)}`);
      for (let i = 0; i < a.length; i++) this.eq(a[i], b[i], where + '[' + i + ']', sa, sb);
      return;
    }
    if (a.type !== b.type) this.fail(where, `${a.type} vs ${b.type}: ${short(a)} | ${short(b)}`);
    if (a.type === 'Identifier') return this.ident(a.name, b.name, where, sa, sb);
    if (a.type === 'Function') return this.func(a, b, where, sa, sb);
    if (a.type === 'Class') return this.cls(a, b, where, sa, sb);
    if (a.type === 'Block') { const [na, nb] = this.scope(a.body, b.body, sa, sb, where); return this.eq(a.body, b.body, where + '.block', na, nb); }
    if (a.type === 'For' || a.type === 'ForOfStatement' || a.type === 'ForInStatement') {        // the loop's own declarations
      const ia = a.type === 'For' ? a.init : a.left, ib = b.type === 'For' ? b.init : b.left;
      const da = Array.isArray(ia) ? ia : [], db = Array.isArray(ib) ? ib : [];
      const [na, nb] = this.scope(da, db, sa, sb, where);
      for (const k of Object.keys(a)) if (k !== 'type' && k !== 'body') this.eq(a[k], b[k], where + '.' + k, k === 'right' ? sa : na, k === 'right' ? sb : nb);
      const [ba, bb] = this.scope(a.body, b.body, na, nb, where);
      return this.eq(a.body, b.body, where + '.body', ba, bb);
    }
    if (a.type === 'Try') {
      this.blockEq(a.block, b.block, where + '.try', sa, sb);
      if (a.handler || b.handler) { const na = [...sa, new Map()], nb = [...sb, new Map()]; if (a.param || b.param) this.bindPat(a.param, b.param, na, nb, where); this.blockEq(a.handler, b.handler, where + '.catch', na, nb); }
      if (a.finalizer || b.finalizer) this.blockEq(a.finalizer, b.finalizer, where + '.finally', sa, sb);
      return;
    }
    if (a.type === 'If') { this.eq(a.test, b.test, where + '.if', sa, sb); this.blockEq(a.cons, b.cons, where + '.then', sa, sb); if (a.alt || b.alt) this.blockEq(a.alt, b.alt, where + '.else', sa, sb); return; }
    if (a.type === 'While' || a.type === 'DoWhile') { this.eq(a.test, b.test, where + '.test', sa, sb); return this.blockEq(a.body, b.body, where + '.body', sa, sb); }
    if (a.type === 'Switch') { this.eq(a.disc, b.disc, where + '.switch', sa, sb); const all = (x) => x.cases.flatMap(c => c.body); const [na, nb] = this.scope(all(a), all(b), sa, sb, where); this.eq(a.cases, b.cases, where + '.cases', na, nb); return; }
    const ka = Object.keys(a).filter(k => a[k] !== undefined && k !== '__args'), kb = Object.keys(b).filter(k => b[k] !== undefined);
    for (const k of new Set([...ka, ...kb])) { if (k === 'type') continue; this.eq(a[k], b[k], where + '.' + k, sa, sb); }
  }
  blockEq(a, b, where, sa, sb) { if (!a || !b) { if (a !== b && !(Array.isArray(a) && !a.length && !b) && !(Array.isArray(b) && !b.length && !a)) this.fail(where, 'one side has no block'); return; } const [na, nb] = this.scope(a, b, sa, sb, where); this.eq(a, b, where, na, nb); }
  /* a new scope with the statements' declarations (let/const/class/function here; var hoists to the function, handled in func) */
  scope(la, lb, sa, sb, where) {
    const ma = new Map(), mb = new Map(); const da = declsOf(la, false), db = declsOf(lb, false);
    if (da.length !== db.length) this.fail(where, `${da.length} declarations vs ${db.length}: ${da.join(',')} | ${db.join(',')}`);
    for (let i = 0; i < da.length; i++) { const id = Symbol(da[i] + '~' + db[i]); ma.set(da[i], id); mb.set(db[i], id); }
    return [[...sa, ma], [...sb, mb]];
  }
  func(a, b, where, sa, sb) {
    for (const k of ['arrow', 'async', 'generator']) if (a[k] !== b[k]) this.fail(where, `function ${k} differs`);
    const ma = new Map(), mb = new Map();
    if (a.id || b.id) { if (!a.id || !b.id) this.fail(where, 'a named function vs an anonymous one'); const id = Symbol('fn'); ma.set(a.id.name, id); mb.set(b.id.name, id); }
    // (params) the port's extra last parameters, each one a shipped module-level variable the function read
    const byParam = Object.assign(Object.create(null), Object.fromEntries(Object.entries(this.params).map(([k, v]) => [v, k])));
    let extra = 0; while (b.params.length - extra > a.params.length && b.params[b.params.length - 1 - extra].type === 'Identifier' && byParam[b.params[b.params.length - 1 - extra].name]) extra++;
    const pa = [], pb = []; a.params.forEach(p => patNames(p, pa)); b.params.slice(0, b.params.length - extra).forEach(p => patNames(p, pb));
    if (pa.length !== pb.length) this.fail(where, `${pa.length} parameters vs ${pb.length}`);
    pa.forEach((n, i) => { const id = Symbol(n + '~' + pb[i]); ma.set(n, id); mb.set(pb[i], id); });
    for (const p of b.params.slice(b.params.length - extra)) { const id = Symbol('param ' + p.name); ma.set(byParam[p.name], id); mb.set(p.name, id); }
    if (extra) b = { ...b, params: b.params.slice(0, b.params.length - extra) };
    const va = declsOf(a.body, true), vb = declsOf(b.body, true);                              // var, hoisted to the function
    const vva = va.filter(n => !ma.has(n)), vvb = vb.filter(n => !mb.has(n));
    if (vva.length !== vvb.length) this.fail(where, `${vva.length} var declarations vs ${vvb.length}`);
    vva.forEach((n, i) => { const id = Symbol(n); ma.set(n, id); mb.set(vvb[i], id); });
    const na = [...sa, ma], nb = [...sb, mb];
    this.eq(a.params, b.params, where + '.params', na, nb);
    const [ba, bb] = this.scope(a.body, b.body, na, nb, where);
    this.eq(a.body, b.body, where + '.body', ba, bb);
  }
  cls(a, b, where, sa, sb) {
    const ma = new Map(), mb = new Map(); if (a.id && b.id) { const id = Symbol('cls'); ma.set(a.id.name, id); mb.set(b.id.name, id); } else if (a.id || b.id) this.fail(where, 'a named class vs an anonymous one');
    if (a.superClass || b.superClass) this.eq(a.superClass, b.superClass, where + '.extends', sa, sb);
    this.eq(a.body, b.body, where + '.body', [...sa, ma], [...sb, mb]);
  }
  bindPat(a, b, sa, sb, where) { const pa = [], pb = []; patNames(a, pa); patNames(b, pb); pa.forEach((n, i) => { const id = Symbol(n); sa[sa.length - 1].set(n, id); sb[sb.length - 1].set(pb[i], id); }); }
  ident(na, nb, where, sa, sb) {
    const ra = resolve(na, sa), rb = resolve(nb, sb);
    if (ra && rb) { if (ra !== rb) this.fail(where, `${na} and ${nb} are different bindings here`); return; }
    if (ra || rb) this.fail(where, `${na} is ${ra ? 'a local' : 'free'} and ${nb} is ${rb ? 'a local' : 'free'}`);
    this.pairFree(na, nb, where);
  }
}
const resolve = (n, chain) => { for (let i = chain.length - 1; i >= 0; i--) if (chain[i].has(n)) return chain[i].get(n); return null; };
function patNames(p, out) {
  if (!p) return;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'AssignmentPattern') patNames(p.left, out);
  else if (p.type === 'ArrayPattern') p.elements.forEach(e => patNames(e, out));
  else if (p.type === 'ObjectPattern') p.properties.forEach(q => patNames(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'RestElement') patNames(p.argument, out);
}
/* the names a list declares: lexical ones (this block) or, with vars, the var names anywhere in it outside nested functions */
function declsOf(list, vars) {
  const out = [];
  const walk = (s, top) => {
    if (!s || typeof s !== 'object') return;
    if (Array.isArray(s)) { s.forEach(x => walk(x, top)); return; }
    if (s.type === 'Var') { if (vars ? s.kind === 'var' : (s.kind !== 'var' && top)) patNames(s.id, out); return; }
    if (s.type === 'FunctionDeclaration') { if (!vars && top) out.push(s.fn.id.name); return; }
    if (s.type === 'ClassDeclaration') { if (!vars && top) out.push(s.cls.id.name); return; }
    if (s.type === 'Function' || s.type === 'Class') return;
    if (!vars) return;
    for (const v of Object.values(s)) if (v && typeof v === 'object') walk(v, false);
  };
  for (const s of list) walk(s, true);
  return out;
}
const short = x => { const s = JSON.stringify(x, (k, v) => (k === 'start' || k === 'end' ? undefined : v)); return s && s.length > 260 ? s.slice(0, 260) + '…' : s; };

/* ------------------------------------------------------------------ the declarations of a program, by name */
export function declarations(program) {
  const out = new Map();
  for (const st of nstmts(program.body)) {
    if (st.type === 'Var' && st.id.type === 'Identifier') out.set(st.id.name, st);
    else if (st.type === 'FunctionDeclaration') out.set(st.fn.id.name, st);
    else if (st.type === 'ClassDeclaration') out.set(st.cls.id.name, st);
  }
  return out;
}
export function compareDecl(alpha, a, b, label) {
  try {
    const s0 = [new Map()], s1 = [new Map()];
    if (a.type === 'Var' && b.type === 'Var') alpha.eq(a.init, b.init, label, s0, s1);   // (a module's top level: the bundle writes var for const and let)
    else if (a.type === 'FunctionDeclaration') { if (b.type !== 'FunctionDeclaration') alpha.fail(label, 'a function vs ' + b.type); alpha.func({ ...a.fn, id: null }, { ...b.fn, id: null }, label, s0, s1); }
    else if (a.type === 'ClassDeclaration') { if (b.type !== 'ClassDeclaration') alpha.fail(label, 'a class vs ' + b.type); alpha.cls({ ...a.cls, id: null }, { ...b.cls, id: null }, label, s0, s1); }
    if (a.type === 'Var' && b.type === 'ClassDeclaration' && a.init && a.init.type === 'Class') alpha.cls({ ...a.init, id: null }, { ...b.cls, id: null }, label, s0, s1);   // var X = class ... vs class X ...
    else if (a.type === 'Var' && b.type !== 'Var') alpha.fail(label, `a ${a.kind} vs ${b.type}`);
    return true;
  } catch (e) { if (e.message !== 'DIFF') throw e; return false; }
}

/* a whole module, statement by statement: the shipped top-level statements from the one that declares `from` to the one that declares
   `to` (both included), against the port's top-level statements (imports and type declarations are not statements) */
export function compareSeq(alpha, origProgram, newProgram, from, to, skipOrig = [], skipNew = []) {
  const named = (st, list) => (st.type === 'Var' && st.id.type === 'Identifier' && list.includes(st.id.name)) || (st.type === 'FunctionDeclaration' && list.includes(st.fn.id.name)) || (st.type === 'ClassDeclaration' && list.includes(st.cls.id.name));
  const A0 = nstmts(origProgram.body), B = nstmts(newProgram.body).filter(st => !named(st, skipNew));
  const declares = (st, n) => (st.type === 'Var' && st.id.type === 'Identifier' && st.id.name === n) || (st.type === 'FunctionDeclaration' && st.fn.id.name === n) || (st.type === 'ClassDeclaration' && st.cls.id.name === n);
  const i0 = A0.findIndex(st => declares(st, from)), i1 = to === '$end' ? A0.length - 1 : A0.findIndex(st => declares(st, to));
  if (i0 < 0 || i1 < 0 || i1 < i0) return { ok: false, msg: `cannot find the range ${from} .. ${to}` };
  const range = A0.slice(i0, i1 + 1).map((st, k) => [st, i0 + k]).filter(([st]) => !named(st, skipOrig)), a = range.map(([st]) => st), out = [];
  if (a.length !== B.length) out.push(`${a.length} shipped statements vs ${B.length} in the port`);
  const s0 = [new Map()], s1 = [new Map()];
  for (let i = 0; i < Math.min(a.length, B.length); i++) {
    alpha.diffs = [];
    try {
      const x = a[i], y = B[i], label = `#${i} ${stmtName(x)} = ${stmtName(y)}`;
      if (x.type === 'Var' && y.type === 'Var') { alpha.eq(x.id, y.id, label + '.id', s0, s1); alpha.eq(x.init, y.init, label, s0, s1); }
      else if (x.type === 'FunctionDeclaration' && y.type === 'FunctionDeclaration') { alpha.eq(x.fn.id, y.fn.id, label + '.id', s0, s1); alpha.func({ ...x.fn, id: null }, { ...y.fn, id: null }, label, s0, s1); }
      else if (x.type === 'ClassDeclaration' && y.type === 'ClassDeclaration') { alpha.eq(x.cls.id, y.cls.id, label + '.id', s0, s1); alpha.cls({ ...x.cls, id: null }, { ...y.cls, id: null }, label, s0, s1); }
      // the v11 minifier writes a module's `class X ...` as `var X = class ...` (an anonymous class takes the binding's name, as X's does)
      else if (x.type === 'Var' && y.type === 'ClassDeclaration' && x.init && x.init.type === 'Class' && !x.init.id) { alpha.eq(x.id, y.cls.id, label + '.id', s0, s1); alpha.cls({ ...x.init, id: null }, { ...y.cls, id: null }, label, s0, s1); }
      else alpha.eq(x, y, label, s0, s1);
      out.push(null);
    } catch (e) { if (e.message !== 'DIFF') throw e; out.push(`${alpha.diffs[0].where}: ${alpha.diffs[0].msg}`); }
  }
  return { ok: out.every(x => x === null), results: out, shipped: a.length, port: B.length, covered: range.map(([, k]) => k) };
}
/* the shipped program's top-level statements, normalized as compareSeq sees them, and the index of the one that declares a name */
export function shippedStatements(program) { return nstmts(program.body); }
export function statementDeclaring(list, n) { return list.findIndex(st => (st.type === 'Var' && st.id.type === 'Identifier' && st.id.name === n) || (st.type === 'FunctionDeclaration' && st.fn.id.name === n) || (st.type === 'ClassDeclaration' && st.cls.id.name === n)); }
export const describe = st => stmtName(st);
const stmtName = st => (st.type === 'Var' ? 'var ' + (st.id.name || '{…}') : st.type === 'FunctionDeclaration' ? 'function ' + st.fn.id.name : st.type === 'ClassDeclaration' ? 'class ' + st.cls.id.name : st.type);

if (import.meta.url === 'file://' + process.argv[1] && ARG.from) {
  const origCode = fs.readFileSync(ARG.orig, 'utf8'), newRaw = fs.readFileSync(ARG.new, 'utf8');
  const newCode = /\.ts$/.test(ARG.new) ? stripTs(newRaw, path.basename(ARG.new)) : newRaw;
  const consts = Object.fromEntries((ARG.const ? ARG.const.split(',') : []).map(p => { const [k, v] = p.split('='); return [k, +v]; }));
  for (const f of (ARG.pure ? ARG.pure.split(',') : [])) PURE_FNS.add(f);
  const alpha = new Alpha((ARG.free ? ARG.free.split(',') : []).map(p => p.split('=')), consts);
  const r = compareSeq(alpha, parseJs(origCode), parseJs(newCode, 'new.js'), ARG.from, ARG.to, ARG['skip-orig'] ? ARG['skip-orig'].split(',') : [], ARG['skip-new'] ? ARG['skip-new'].split(',') : []);
  if (r.msg) console.log(r.msg); else r.results.forEach((x, i) => console.log(`${x === null ? 'SAME     ' : 'DIFFERENT'} #${i}${x ? ': ' + x : ''}`));
  if (r.shipped !== r.port) console.log(`(${r.shipped} shipped statements, ${r.port} in the port)`);
  if (alpha.inferred.length) console.log('free names paired: ' + alpha.inferred.join(', '));
  console.log(`ALPHA SEQ: ${r.ok && r.shipped === r.port ? 'SAME' : 'DIFFERENT'}`);
  process.exitCode = r.ok && r.shipped === r.port ? 0 : 1;
} else if (import.meta.url === 'file://' + process.argv[1]) {
  if (!ARG.orig || !ARG.new || !ARG.pairs) { console.error('usage: --orig FILE --new FILE --pairs a=b,... [--free x=y,...] | --from NAME --to NAME'); process.exit(2); }
  const origCode = fs.readFileSync(ARG.orig, 'utf8'), newRaw = fs.readFileSync(ARG.new, 'utf8');
  const newCode = /\.ts$/.test(ARG.new) ? stripTs(newRaw, path.basename(ARG.new)) : newRaw;
  const A = declarations(parseJs(origCode)), B = declarations(parseJs(newCode, 'new.js'));
  const pairs = ARG.pairs.split(',').map(p => p.split('='));
  const consts = Object.fromEntries((ARG.const ? ARG.const.split(',') : []).map(p => { const [k, v] = p.split('='); return [k, +v]; }));
  for (const f of (ARG.pure ? ARG.pure.split(',') : [])) PURE_FNS.add(f);
  const alpha = new Alpha((ARG.free ? ARG.free.split(',') : []).map(p => p.split('=')).concat(pairs), consts);
  let ok = 0;
  for (const [x, y] of pairs) {
    if (!A.has(x)) { console.log(`MISSING  ${x} is not a top-level declaration of --orig`); continue; }
    if (!B.has(y)) { console.log(`MISSING  ${y} is not a top-level declaration of --new`); continue; }
    alpha.diffs = [];
    const same = compareDecl(alpha, A.get(x), B.get(y), `${x}=${y}`);
    if (same) { ok++; console.log(`SAME     ${x} = ${y}`); } else console.log(`DIFFERENT ${x} = ${y}: at ${alpha.diffs[0].where}: ${alpha.diffs[0].msg}`);
  }
  if (alpha.inferred.length) console.log('free names paired on the way: ' + alpha.inferred.join(', '));
  console.log(`ALPHA: ${ok === pairs.length ? 'SAME' : 'DIFFERENT'} (${ok} of ${pairs.length} declarations)`);
  process.exitCode = ok === pairs.length ? 0 : 1;
}
