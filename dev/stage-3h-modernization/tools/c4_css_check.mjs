#!/usr/bin/env node
/* Stage 3H continuation C4 - the built stylesheet against the shipped one (development only).
 *
 *   node dev/stage-3h-modernization/tools/c4_css_check.mjs [--built FILE] [--out FILE.json]
 *
 * The shipped stylesheet (public/assets/index-D7hdwmUU.css up to C4a) is rebuilt in memory from the lineage: the v11 build's stylesheet
 * and the eight recorded steps C01..C08, each checked by its SHA-256 (src/core/client/bundle/lineage/). It is v11's 9,899 bytes and then
 * the text the steps added. The maintained build (vite.config.ts) gives v11's part from client/style.css, v11's own source, and appends
 * client/style-after-v11.css, the steps' rules made readable, as it is. Checked:
 *   1. the built stylesheet begins with v11's part, byte for byte;
 *   2. what follows it, client/style-after-v11.css and the shipped later part are the same stylesheet: the same statements in the same
 *      order, each at-rule with the same prelude and the same contents, each rule with the same selector text and the same declarations
 *      (name, value, !important) in the same order. Only what CSS ignores may differ: comments, the whitespace between tokens (runs of it
 *      read as one space; none at all next to { } ; and a declaration's colon), the last declaration's semicolon. A selector's text is
 *      compared as it is (its whitespace is a combinator), so is a custom property's value.
 * --built defaults to public/assets/index-D7hdwmUU.css (--later replaces client/style-after-v11.css: the checker's own tests). Exit 0
 * only when both hold. */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..', '..', '..');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const LIN = path.join(REPO, 'src/core/client/bundle/lineage');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function shipped() {
  const L = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8')), F = L.files.css;
  let cur = fs.readFileSync(path.join(REPO, F.base.path)); if (sha(cur) !== F.base.sha256) throw new Error('the stylesheet lineage base is not the recorded file');
  for (const s of F.steps) {
    const P = JSON.parse(fs.readFileSync(path.join(LIN, s.patch), 'utf8')); if (P.before.sha256 !== sha(cur)) throw new Error(`${s.id} was not made on the version before it`);
    const parts = []; let pos = 0;
    for (const [at, del, ins] of P.hunks) { const d = Buffer.from(del, 'utf8'); if (!cur.subarray(at, at + d.length).equals(d)) throw new Error(`${s.id}: a hunk does not match`); parts.push(cur.subarray(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length; }
    parts.push(cur.subarray(pos)); cur = Buffer.concat(parts); if (sha(cur) !== P.after.sha256) throw new Error(`${s.id} did not give the recorded bytes`);
  }
  if (sha(cur) !== F.result.sha256) throw new Error('the stylesheet replay did not end at the recorded result');
  return { all: cur, v11Bytes: F.base.bytes };
}
/* a stylesheet's statements: { at, prelude, block } or { prelude, decls: [[name, value]] } */
function parse(text) {
  let i = 0;
  const skip = () => { for (;;) { while (i < text.length && /\s/.test(text[i])) i++; if (text.startsWith('/*', i)) { const j = text.indexOf('*/', i + 2); if (j < 0) throw new Error('an unclosed comment'); i = j + 2; } else return; } };
  /* raw text up to one of the stop characters at depth 0 (strings, comments and brackets followed); comments removed */
  const until = stops => { let out = '', depth = 0;
    while (i < text.length) {
      const c = text[i];
      if (text.startsWith('/*', i)) { const j = text.indexOf('*/', i + 2); out += ' '; i = j + 2; continue; }
      if (c === '"' || c === "'") { let j = i + 1; while (text[j] !== c) { if (text[j] === '\\') j++; j++; } out += text.slice(i, j + 1); i = j + 1; continue; }
      if (depth === 0 && stops.includes(c)) break;
      if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
      out += c; i++;
    }
    return out; };
  const ws = s => s.replace(/\s+/g, ' ').trim();
  const block = () => {                                              // after '{': statements until the matching '}'
    const out = [];
    for (;;) {
      skip(); if (i >= text.length) throw new Error('an unclosed block'); if (text[i] === '}') { i++; return out; }
      out.push(statement());
    }
  };
  const decls = () => {                                              // after '{' of a style rule: declarations until '}'
    const out = [];
    for (;;) {
      skip(); if (text[i] === '}') { i++; return out; } if (text[i] === ';') { i++; continue; }
      const d = until(';}'); const k = d.indexOf(':'); if (k < 0) throw new Error('a declaration without a colon: ' + d.slice(0, 60));
      const name = d.slice(0, k).trim(), value = d.slice(k + 1);
      out.push([name, name.startsWith('--') ? value.trim() : ws(value)]);
    }
  };
  const statement = () => {
    skip();
    if (text[i] === '@') {
      const prelude = until('{;'); if (text[i] === ';') { i++; return { at: ws(prelude) }; }
      i++; const name = prelude.match(/^@[\w-]+/)[0];
      return /^@(media|supports|layer|container|document)\b/.test(name) || /^@(-[\w]+-)?keyframes$/.test(name) ? { at: ws(prelude), block: block() } : { at: ws(prelude), decls: decls() };
    }
    const prelude = until('{'); if (text[i] !== '{') throw new Error('a rule without a block: ' + prelude.slice(0, 60)); i++;
    return { prelude: prelude.replace(/\s+/g, ' ').trim(), decls: decls() };
  };
  const out = []; for (;;) { skip(); if (i >= text.length) return out; out.push(statement()); }
}
const firstDiff = (a, b, at = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) { for (let k = 0; k < Math.max(a.length, b.length); k++) { const d = firstDiff(a[k], b[k], `${at}[${k}]`); if (d) return d; } }
  else if (a && b && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], `${at}.${k}`); if (d) return d; } }
  return `${at}: ${JSON.stringify(a)?.slice(0, 200)} vs ${JSON.stringify(b)?.slice(0, 200)}`;
};
const S = shipped(), builtFile = ARG.built || path.join(REPO, 'public/assets/index-D7hdwmUU.css'), built = fs.readFileSync(builtFile);
const later = fs.readFileSync(ARG.later || path.join(REPO, 'src/core/client/game/client/style-after-v11.css'), 'utf8');   // (--later: another file, for the checker's own tests)
const R = { tool: 'dev/stage-3h-modernization/tools/c4_css_check.mjs', shipped: { bytes: S.all.length, sha256: sha(S.all) }, built: { file: path.relative(REPO, builtFile), bytes: built.length, sha256: sha(built) } };
R.v11Part = built.subarray(0, S.v11Bytes).equals(S.all.subarray(0, S.v11Bytes)) ? 'same bytes' : 'DIFFERENT';
const shipLater = parse(S.all.subarray(S.v11Bytes).toString('utf8')), builtLater = parse(built.subarray(S.v11Bytes).toString('utf8')), fileLater = parse(later);
R.laterStatements = shipLater.length;
R.laterVsFile = firstDiff(shipLater, fileLater) || 'the same stylesheet';
R.laterVsBuilt = firstDiff(shipLater, builtLater) || 'the same stylesheet';
R.ok = R.v11Part === 'same bytes' && R.laterVsFile === 'the same stylesheet' && R.laterVsBuilt === 'the same stylesheet';
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`v11's part (${S.v11Bytes} bytes): ${R.v11Part}\nthe later part (${R.laterStatements} statements) against client/style-after-v11.css: ${R.laterVsFile}\nthe later part against the built stylesheet's: ${R.laterVsBuilt}\nCSS CHECK: ${R.ok ? 'SAME' : 'DIFFERENT'}`);
process.exitCode = R.ok ? 0 : 1;
