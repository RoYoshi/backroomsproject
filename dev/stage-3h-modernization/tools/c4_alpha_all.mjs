#!/usr/bin/env node
/* Stage 3H continuation C4 - every ported module against the shipped bundle it was ported from (development only).
 *
 *   node dev/stage-3h-modernization/tools/c4_alpha_all.mjs [--config FILE] [--only port-substring] [--out FILE.json] [--rolldown DIR]
 *
 * The shipped bundle is rebuilt in memory from the lineage (src/core/client/bundle/lineage/: the v11 output and the 40 recorded steps,
 * each checked by its SHA-256), so the reference is the same before and after the served file is replaced by the build of the port.
 * Each module of tools/c4_alpha_modules.json is compared with tools/c4_alpha.mjs (seq: statement by statement; pairs: declaration by
 * declaration).  (C4c) A module whose entry names "data" (src/core/client/game/level-data.cjs) reads the build's constants (the one
 * definition of Level 0 and of the lights): their values are put in place of their names first, as the build does.  Exit 0 only when
 * every module is the same program. */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..', '..', '..');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const A = await import(path.join(HERE, 'c4_alpha.mjs'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
/* the shipped bundle, from the ledger */
function shipped() {
  const L = JSON.parse(fs.readFileSync(path.join(REPO, 'src/core/client/bundle/lineage/ledger.json'), 'utf8')), F = L.files.bundle;
  let cur = fs.readFileSync(path.join(REPO, F.base.path));
  if (sha(cur) !== F.base.sha256) throw new Error('the lineage base is not the recorded file');
  for (const s of F.steps) {
    const P = JSON.parse(fs.readFileSync(path.join(REPO, 'src/core/client/bundle/lineage', s.patch), 'utf8'));
    if (P.before.sha256 !== sha(cur)) throw new Error(`step ${s.id} was not made on the version before it`);
    const parts = []; let pos = 0;
    for (const [at, del, ins] of P.hunks) { const d = Buffer.from(del, 'utf8'); if (!cur.subarray(at, at + d.length).equals(d)) throw new Error(`step ${s.id}: a hunk does not match`); parts.push(cur.subarray(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length; }
    parts.push(cur.subarray(pos)); cur = Buffer.concat(parts);
    if (sha(cur) !== P.after.sha256) throw new Error(`step ${s.id} did not give the recorded bytes`);
  }
  if (sha(cur) !== F.result.sha256) throw new Error('the replay did not end at the recorded result');
  return cur;
}
const ref = shipped(), refProgram = A.parseJs(ref.toString('utf8')), refStatements = A.shippedStatements(refProgram), covered = new Set();
const CFG = JSON.parse(fs.readFileSync(ARG.config || path.join(HERE, 'c4_alpha_modules.json'), 'utf8'));
/* (C4c) the values the client's build defines (src/core/client/game/level-data.cjs), read from the repository's definitions or, for the
   checker's own tests, from other files ({ module, files }) */
const requireCjs = (await import('module')).createRequire(import.meta.url);
function buildConstants(spec) {
  const s = typeof spec === 'string' ? { module: spec } : spec, files = s.files || {}, mod = requireCjs(path.resolve(REPO, s.module));
  return mod.constants(p => JSON.parse(fs.readFileSync(path.resolve(REPO, files[p] || p), 'utf8')));
}
const R = { tool: 'dev/stage-3h-modernization/tools/c4_alpha_all.mjs', shipped: { bytes: ref.length, sha256: sha(ref) }, modules: [] };
for (const m of CFG.modules) {
  if (ARG.only && !m.port.includes(ARG.only)) continue;
  A.PURE_FNS.clear(); for (const f of m.pure || []) A.PURE_FNS.add(f);
  const raw = fs.readFileSync(path.resolve(REPO, m.port), 'utf8'), code = m.port.endsWith('.ts') ? A.stripTs(raw, path.basename(m.port)) : raw;
  const prog = A.parseJs(code, 'port.js');
  /* (C4c) the build's constants: the values the build puts in place of their names (m.data: level-data.cjs, or { module, files: { path: another file } }) */
  const substituted = m.data ? A.substitute(prog, buildConstants(m.data)) : 0;
  const alpha = new A.Alpha(Object.entries(m.free || {}).concat(Object.entries(m.pairs || {})), m.const || {}, { members: m.members, params: m.params, callArgs: m.callArgs });
  const row = { port: m.port, sha256: sha(raw), ...(m.data ? { buildConstants: substituted } : {}) };
  if (m.from) {
    const r = A.compareSeq(alpha, refProgram, prog, m.from, m.to, m.skipOrig || [], m.skipNew || []);   // to: '$end', the program's last statement
    (r.covered || []).forEach(k => covered.add(k));
    row.mode = 'seq'; row.statements = r.shipped; row.ok = r.ok && r.shipped === r.port; row.problems = r.msg ? [r.msg] : (r.results || []).map((x, i) => (x ? `#${i}: ${x}` : null)).filter(Boolean);
    if (r.shipped !== r.port) row.problems.push(`${r.shipped} shipped statements, ${r.port} in the port`);
  } else {
    const D0 = A.declarations(refProgram), D1 = A.declarations(prog); row.mode = 'pairs'; row.problems = [];
    for (const [x, y] of Object.entries(m.pairs)) { alpha.diffs = []; const k = A.statementDeclaring(refStatements, x); if (k >= 0) covered.add(k); if (!D0.has(x) || !D1.has(y)) { row.problems.push(`${x} / ${y} missing`); continue; } if (!A.compareDecl(alpha, D0.get(x), D1.get(y), `${x}=${y}`)) row.problems.push(`${x}=${y}: ${alpha.diffs[0].where}: ${alpha.diffs[0].msg}`); }
    row.declarations = Object.keys(m.pairs).length; row.ok = !row.problems.length;
  }
  row.inferred = alpha.inferred;
  R.modules.push(row);
  console.log(`${row.ok ? 'SAME     ' : 'DIFFERENT'} ${m.port} (${row.mode}: ${row.statements ?? row.declarations})${row.ok ? '' : '\n   ' + row.problems.slice(0, 3).join('\n   ').slice(0, 900)}`);
}
/* coverage: every top-level statement of the shipped app code (from the world module's first one, FBW; before it: PixiJS and the Vite
   preamble) compared with the port, or listed in the config's "reviewed" (a statement the port keeps another way, said how) */
const first = A.statementDeclaring(refStatements, CFG.appStart || 'FBW'), reviewed = CFG.reviewed || {};
const missing = [];
for (let k = first; k < refStatements.length; k++) if (!covered.has(k)) { const st = refStatements[k], n = st.type === 'Var' && st.id.type === 'Identifier' ? st.id.name : st.type === 'FunctionDeclaration' ? st.fn.id.name : st.type === 'ClassDeclaration' ? st.cls.id.name : null; if (!(n && reviewed[n])) missing.push(`#${k} ${A.describe(st)}`); }
R.coverage = { appStatements: refStatements.length - first, compared: [...covered].filter(k => k >= first).length, reviewed: Object.keys(reviewed).length, missing };
console.log(`coverage: ${R.coverage.compared} of the shipped app's ${R.coverage.appStatements} top-level statements compared, ${R.coverage.reviewed} reviewed${missing.length ? '; NOT COVERED: ' + missing.join(', ') : ''}`);
R.ok = R.modules.length > 0 && R.modules.every(m => m.ok) && !missing.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`C4 ALPHA: ${R.ok ? 'SAME' : 'DIFFERENT'} (${R.modules.filter(m => m.ok).length} of ${R.modules.length} ported modules are the shipped program, modulo names and the normal form)`);
process.exitCode = R.ok ? 0 : 1;
