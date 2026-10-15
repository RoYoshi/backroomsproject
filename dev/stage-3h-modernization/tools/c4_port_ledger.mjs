#!/usr/bin/env node
/* Stage 3H continuation C4 - the port ledger: where each of the 40 recorded bundle steps (B01..B40) lives in the readable source.
 *
 *   node dev/stage-3h-modernization/tools/c4_port_ledger.mjs --write 1     src/core/client/game/PORT_LEDGER.md and tools/c4_port_ledger.json
 *   node dev/stage-3h-modernization/tools/c4_port_ledger.mjs --check 1     (the gate) both are what the lineage and the port map give
 *   [--json FILE] [--md FILE]                                                 write them elsewhere
 *
 * For every byte of the shipped bundle the lineage's blame (src/core/client/bundle/lineage/blame.json) says who wrote it: the v11 build or
 * one of the steps. The shipped bundle's app code is cut into units: each top-level declaration, each method of a top-level class, and
 * each other top-level statement. A unit's port is found from tools/c4_alpha_modules.json, the same map tools/c4_alpha_all.mjs proves
 * statement by statement: the module whose compared range holds the unit (or which compares the declaration as a pair) and the port's name
 * for it. A step's row lists every unit holding bytes it wrote (whitespace aside) that are still in the shipped bundle: a step whose text
 * a later step replaced entirely (B13, B17) has none. The steps' descriptions and owners are the lineage's (descriptions.json). */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..', '..', '..');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const A = await import(path.join(HERE, 'c4_alpha.mjs'));
const LIN = path.join(REPO, 'src/core/client/bundle/lineage');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const L = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8')), F = L.files.bundle;
/* the shipped bundle, replayed from the lineage (v11's build and the forty steps, each checked): the file is built from the port from C4b on */
let ship = fs.readFileSync(path.join(REPO, F.base.path)); if (sha(ship) !== F.base.sha256) throw new Error('the lineage base is not the recorded file');
for (const s of F.steps) {
  const P = JSON.parse(fs.readFileSync(path.join(LIN, s.patch), 'utf8')), parts = []; let pos = 0;
  if (P.before.sha256 !== sha(ship)) throw new Error(`step ${s.id} was not made on the version before it`);
  for (const [at, del, ins] of P.hunks) { const d = Buffer.from(del, 'utf8'); if (!ship.subarray(at, at + d.length).equals(d)) throw new Error(`step ${s.id}: a hunk does not match`); parts.push(ship.subarray(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length; }
  parts.push(ship.subarray(pos)); ship = Buffer.concat(parts);
}
if (sha(ship) !== F.result.sha256) throw new Error('the replay did not end at the recorded result');
/* who wrote each byte */
const blame = JSON.parse(fs.readFileSync(path.join(LIN, 'blame.json'), 'utf8')), who = new Array(ship.length);
let pos = 0; for (const [origin, , len] of blame.segments) { for (let k = 0; k < len; k++) who[pos + k] = origin; pos += len; }
if (pos !== ship.length) throw new Error('the blame does not cover the bundle');
const DESC = JSON.parse(fs.readFileSync(path.join(LIN, 'descriptions.json'), 'utf8')).bundle;
/* the units of the shipped app code (latin1: a character is a byte) */
const code = ship.toString('latin1'), prog = A.parseJs(code);
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'c4_alpha_modules.json'), 'utf8'));
const top = [];                                                     // [name or null, start, end, the class body or null]
for (const st of prog.body) {
  if (st.type === 'VariableDeclaration') for (const d of st.declarations) top.push([d.id.name || null, d.start, d.end, d.init && d.init.type === 'ClassExpression' ? d.init : null]);
  else if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') top.push([st.id.name, st.start, st.end, st.type === 'ClassDeclaration' ? st : null]);
  else top.push([null, st.start, st.end, null]);
}
const firstApp = top.findIndex(t => t[0] === (CFG.appStart || 'FBW'));
/* which module compares each unit: a pair, or the range of a seq entry (its from .. to, in the shipped order) */
const owner = new Map();                                            // top index -> { port, name }
const idx = n => top.findIndex(t => t[0] === n);
for (const m of CFG.modules) {
  const names = { ...(m.free || {}), ...(m.pairs || {}) };
  if (m.pairs) { for (const [x, y] of Object.entries(m.pairs)) { const k = idx(x); if (k >= 0) owner.set(k, { port: m.port, name: y }); } continue; }
  const i0 = idx(m.from), i1 = m.to === '$end' ? top.length - 1 : idx(m.to);
  for (let k = i0; k <= i1; k++) { if ((m.skipOrig || []).includes(top[k][0])) continue; if (!owner.has(k)) owner.set(k, { port: m.port, name: top[k][0] ? names[top[k][0]] || top[k][0] : null }); }
}
for (const [n, why] of Object.entries(CFG.reviewed || {})) { const k = idx(n); if (k >= 0 && !owner.has(k)) owner.set(k, { port: 'src/core/client/game/client/arrival.ts', name: 'arrival (' + n + ')', reviewed: why }); }
/* the steps' bytes in each unit */
const rows = new Map();                                             // step -> Map(unit label -> bytes)
const note = (step, label, n) => { if (!rows.has(step)) rows.set(step, new Map()); const r = rows.get(step); r.set(label, (r.get(label) || 0) + n); };
const count = (a, b) => { const c = {}; for (let k = a; k < b; k++) { const o = who[k]; if (o === 'v11' || /\s/.test(code[k])) continue; c[o] = (c[o] || 0) + 1; } return c; };
const unlisted = [];
for (let k = firstApp; k < top.length; k++) {
  const [name, s, e, cls] = top[k], own = owner.get(k);
  if (!own) { unlisted.push(name || `#${k}`); continue; }
  const file = path.relative('src/core/client/game', own.port), base = own.name || 'top-level code';
  if (cls) {
    let covered = s;
    for (const m of cls.body.body) {
      const label = `${file}: ${base}.${m.key.name || m.key.value || '[computed]'}`;
      for (const [st, n] of Object.entries(count(covered, m.end))) note(st, label, n);
      covered = m.end;
    }
    for (const [st, n] of Object.entries(count(covered, e))) note(st, `${file}: ${base}`, n);
  } else for (const [st, n] of Object.entries(count(s, e))) note(st, `${file}: ${base}`, n);
}
/* between top-level units (the separators of a var statement, semicolons): ignored, as is whitespace */
/* what each step reached of the page's scripts (the window members its text names) and whose text it changed (blame.json) */
const reach = id => { const P = JSON.parse(fs.readFileSync(path.join(LIN, F.steps.find(s => s.id === id).patch), 'utf8')), names = new Set();
  for (const [, , ins] of P.hunks) for (const m of ins.matchAll(/\bwindow\.(__[A-Za-z]\w*|TFB_TIMING|WORLD)\b|(?<![\w.$])(__l0v)\b/g)) names.add(m[1] || m[2]);
  return [...names].sort(); };
const edits = Object.fromEntries(blame.steps.map(s => [s.id, s.editsTextOfSteps]));
const out = { tool: 'dev/stage-3h-modernization/tools/c4_port_ledger.mjs', bundle: { file: F.file, sha256: F.result.sha256 }, steps: [] };
for (const s of F.steps) {
  const r = rows.get(s.id) || new Map(), d = DESC[s.id] || [], later = F.steps.filter(x => (edits[x.id] || []).includes(s.id)).map(x => x.id);
  out.steps.push({ id: s.id, what: d[0] || '', owners: d[1] || '', inserted: s.inserted, deleted: s.deleted, editsTextOf: edits[s.id] || [], textChangedBy: later, reaches: reach(s.id),
    units: [...r].sort((a, b) => b[1] - a[1]).map(([unit, bytes]) => ({ unit, bytes })) });
}
out.unlisted = unlisted;
const json = JSON.stringify(out, null, 1) + '\n';
const md = ['# The port ledger: each bundle step in the readable source', '',
  '> Generated by `dev/stage-3h-modernization/tools/c4_port_ledger.mjs` from the lineage (`src/core/client/bundle/lineage/`) and the',
  '> port map that `dev/stage-3h-modernization/tools/c4_alpha_all.mjs` proves (`c4_alpha_modules.json`). Do not edit by hand.', '',
  'The compiled client is built from this folder from Stage 3H continuation C4b on. Up to then it was the v11 build output with forty',
  'recorded edits (`src/core/client/bundle/lineage/STEPS.md`). For each edit: what it did, its owners today, the page scripts its text',
  'reaches (the window members it names: their types and owners are in `client/contracts.d.ts`), the earlier steps whose text it changed,',
  'and where its text is now: each readable declaration (a method as `Class.method`) that holds bytes the step wrote in the shipped',
  'bundle, with how many. The source comments name the step at each change.', '',
  'How it is proven the same: every top-level statement of the shipped app code is compared with the port, modulo names and a normal',
  'form (`c4_alpha_all.mjs`: the alpha check); the stylesheet\'s later part with `client/style-after-v11.css` (`c4_css_check.mjs`); and',
  'the built client against the shipped one in Chromium, frame by frame (`dev/tools/gate/golden/bundle_diff.js`: the scenes in',
  '`bundle_scenes.js`). The deliberate changes of structure (none of behaviour) are declared in `c4_alpha_modules.json`: NEW RUN\'s fall',
  'and vanish state is `client/arrival.ts`\'s object, not two variables of the main module; the renderer is passed whether the light was',
  'on when a death completes, instead of reading the main module\'s variable; the page\'s one ambience is made in `client/audio.ts`.', '',
  '| Step | What it did | Owners | Reaches | Changed the text of | Where it is now (bytes of the step) |', '|---|---|---|---|---|---|'];
for (const s of out.steps) {
  const where = s.units.length ? s.units.map(u => `\`${u.unit}\` (${u.bytes})`).join('; ')
    : s.inserted === 0 ? `(it only deleted v11 code, ${s.deleted} bytes: the port has none of it)`
    : `(none: ${s.textChangedBy.length ? s.textChangedBy.join(', ') + ' replaced all of its text' : 'a later step replaced all of its text'})`;
  md.push(`| ${s.id} | ${s.what.replace(/\|/g, '\\|')} | ${s.owners} | ${s.reaches.map(x => '`' + x + '`').join(', ') || '-'} | ${s.editsTextOf.join(', ') || '-'} | ${where} |`);
}
const mdText = md.join('\n') + '\n';
const MD = path.join(REPO, 'src/core/client/game/PORT_LEDGER.md'), JS = path.join(HERE, 'c4_port_ledger.json');
if (ARG.check) {
  const stale = [[MD, mdText], [JS, json]].filter(([f, t]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== t).map(([f]) => path.relative(REPO, f));
  console.log(`PORT LEDGER: ${stale.length ? 'STALE: ' + stale.join(', ') + ' (run node dev/stage-3h-modernization/tools/c4_port_ledger.mjs --write 1)' : 'CURRENT'}${unlisted.length ? '; NOT MAPPED: ' + unlisted.join(', ') : ''}`);
  process.exitCode = stale.length || unlisted.length ? 1 : 0;
} else {
  if (ARG.write) { fs.writeFileSync(MD, mdText); fs.writeFileSync(JS, json); }
  if (ARG.json) fs.writeFileSync(ARG.json, json);
  if (ARG.md) fs.writeFileSync(ARG.md, mdText);
  console.log(`${out.steps.filter(s => s.units.length).length} of ${out.steps.length} steps have text in the port; ${unlisted.length ? 'NOT MAPPED: ' + unlisted.join(', ') : 'every app unit mapped'}`);
  for (const s of out.steps) console.log(`${s.id}  ${s.units.slice(0, 4).map(u => u.unit + ' ' + u.bytes).join('; ')}${s.units.length > 4 ? '; ...' + s.units.length : ''}`);
  process.exitCode = unlisted.length ? 1 : 0;
}
