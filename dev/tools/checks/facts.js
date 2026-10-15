#!/usr/bin/env node
/* dev/tools/checks/facts.js - the game's facts that are written in more than one place agree (development tool; zero dependencies).
 *
 *   node dev/tools/checks/facts.js [--out FILE.json]          check every fact of dev/tools/checks/facts.json
 *   node dev/tools/checks/facts.js --mutants 1 [--out FILE]   the check's own sensitivity: each copy changed alone must be caught
 *   (--root DIR: another checkout; --spec FILE: another list)
 *
 * Why (FINDINGS M-028, M-003): some of the game's facts are written by hand in more than one file - on the server and on the page, in
 * the compiled client and in a classic script, or twice on one side - and a change to one copy alone would break the game without a
 * test noticing.  Each copy is B++'s accepted code and stays where it is; Level 0's own map is one file since continuation C4c
 * (src/frameworks/lost/shared/level0.json), and the code that names its rooms is listed here too.  facts.json lists every copy and
 * where it is; this check reads each one and fails when it does not hold the fact's value, so changing a copy alone fails the gate,
 * and changing a fact means changing every copy (and its value here) on purpose.
 *
 * facts.json: { "facts": [ { "id", "finding", "owners", "what", "value"?, "copies": [ copy, ... ] }, ... ] }, where a copy is
 *   { "file": path in the repository,
 *     "find": a regular expression (JavaScript syntax; flags "g" and "flags"), whose group "group" (default 1) is the copy's text, or
 *     "json": a dotted path into a .json file (the value there; "" for the whole file),
 *     "count": how many matches the file holds (default 1; every one must give the value),
 *     "as": how the text becomes a value: "number" (default), "literal" (a JavaScript literal: an array, object, string or number),
 *           "keys" (an object literal's keys, in order), "byIndex" (an object literal's keys ordered by their numbers), "numericKeys"
 *           (an object literal's keys as numbers), "string" (the text itself), "roomName" (a room index: that room's name in
 *           level0.json), "plus:N" (the number plus N), "into:N" (N divided by the number); for a JSON copy "keys", "names" (an
 *           array of objects: their "name"s) or "pairs:K:V" (an array of objects: "K:V" for each),
 *     "groups" and "join": the text is these groups of the match joined by "join" (instead of one group),
 *     "drop": values to leave out of a list (an object literal's "" key),
 *     "source": true when this copy is the fact's one definition: the others must equal its value,
 *     "check": "equal" (default) or "subset" (each element of the copy's list is in the fact's value),
 *     "value": this copy's own value, when the copies differ on purpose (each one recorded),
 *     "mutant": [from, to]: the edit --mutants makes of this copy, when the automatic one would change nothing that matters, "note" }
 * A fact's value is its source copy's, else its "value", else the first copy's (when the copies only have to agree).  Exit 0 only when every copy is found the number of times listed and holds
 * its value.  Matching is on the source text, so a copy that moves or is rewritten must be followed here: the check then fails with
 * "N matches, not 1" rather than passing on nothing. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(ARG.root || path.join(__dirname, '..', '..', '..'));
const SPEC = ARG.spec ? path.resolve(ARG.spec) : path.join(__dirname, 'facts.json');
const LEVEL0 = 'src/frameworks/lost/shared/level0.json';
const J = v => JSON.stringify(v);
const lit = text => JSON.parse(JSON.stringify(vm.runInNewContext('(' + text + ')', Object.create(null), { timeout: 200 })));

/* one run of the check; files: path -> text, for the mutants (otherwise read from REPO) */
function check(spec, files = {}) {
  const textOf = f => (f in files ? files[f] : fs.existsSync(path.join(REPO, f)) ? fs.readFileSync(path.join(REPO, f), 'utf8') : null);
  const level0 = () => JSON.parse(textOf(LEVEL0));
  const AS = {
    number: t => { const n = Number(t); if (!Number.isFinite(n)) throw new Error(`not a number: ${t}`); return n; },
    literal: t => lit(t), string: t => t,
    keys: t => Object.keys(lit(t)), numericKeys: t => Object.keys(lit(t)).map(Number),
    byIndex: t => { const o = lit(t); return Object.keys(o).sort((a, b) => o[a] - o[b]); },
    roomName: t => { const r = level0().rooms[Number(t)]; return r ? r.name : null; },
  };
  const asOf = name => AS[name] || (/^plus:-?[\d.]+$/.test(name) ? t => AS.number(t) + Number(name.slice(5)) : /^into:[\d.]+$/.test(name) ? t => Number(name.slice(5)) / AS.number(t) : null);
  const shape = (v, as) => {
    if (!as || as === 'value') return v;
    if (as === 'keys') return Object.keys(v);
    if (as === 'names') return v.map(x => x.name);
    if (as.startsWith('pairs:')) { const [, k, w] = as.split(':'); return v.map(x => `${x[k]}:${x[w]}`); }
    throw new Error(`unknown "as" for a json copy: ${as}`);
  };
  const read = c => {
    const text = textOf(c.file); if (text === null) return { error: 'no such file' };
    try {
      if (c.json !== undefined) { const v = c.json.split('.').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), JSON.parse(text)); return { values: [shape(v, c.as)], lines: [] }; }
      const ms = [...text.matchAll(new RegExp(c.find, 'g' + (c.flags || '')))], want = c.count || 1;
      if (ms.length !== want) return { error: `${ms.length} matches, not ${want}` };
      const as = asOf(c.as || 'number'); if (!as) return { error: `unknown "as": ${c.as}` };
      const textOfMatch = m => (c.groups ? c.groups.map(g => m[g]).join(c.join || '') : m[c.group || 1]);
      return { values: ms.map(m => { let v = as(textOfMatch(m)); if (c.drop) v = v.filter(x => !c.drop.includes(x)); return v; }), lines: ms.map(m => text.slice(0, m.index).split('\n').length) };
    } catch (e) { return { error: String(e.message || e) }; }
  };
  const out = { facts: [], copies: 0, problems: [] };
  for (const f of spec.facts) {
    const rows = f.copies.map(c => ({ c, r: read(c) })), src = rows.find(x => x.c.source);
    const first = rows.find(x => x.c.value === undefined && !x.r.error);   // no source and no value: every copy must equal the first that has no value of its own
    const value = src ? (src.r.error ? undefined : src.r.values[0]) : f.value !== undefined ? f.value : first ? first.r.values[0] : undefined;
    const F = { id: f.id, finding: f.finding, value, copies: [], ok: true };
    for (const { c, r } of rows) {
      out.copies++;
      const want = c.value !== undefined ? c.value : value, row = { file: c.file, lines: r.lines || [], value: r.values ? (r.values.length === 1 ? r.values[0] : r.values) : undefined, ok: true };
      if (c.value !== undefined) row.own = c.value;
      if (r.error) { row.ok = false; row.why = r.error; }
      else if (want === undefined) { row.ok = false; row.why = 'the fact has no value (its source copy failed)'; }
      else for (const v of r.values) {
        const good = c.check === 'subset' ? Array.isArray(want) && (Array.isArray(v) ? v : [v]).every(x => want.some(w => J(w) === J(x))) : J(v) === J(want);
        if (!good) { row.ok = false; row.why = `holds ${J(v).slice(0, 160)}, not ${c.check === 'subset' ? 'within ' : ''}${J(want).slice(0, 160)}`; break; }
      }
      if (!row.ok) { F.ok = false; out.problems.push(`${f.id}: ${c.file}: ${row.why}`); }
      F.copies.push(row);
    }
    out.facts.push(F);
  }
  out.ok = !out.problems.length;
  return out;
}

/* a copy changed alone, as a developer might: its "mutant" edit when it has one ([from, to], the first occurrence); else the first digit of
   its text one higher (a number), a letter added to its text (a string), a letter put into its first key (an object literal's keys),
   or into its first string; for a JSON copy, its value changed */
function mutate(spec, f, c) {
  const file = path.join(REPO, c.file), text = fs.readFileSync(file, 'utf8');
  if (c.mutant) { const [from, to] = c.mutant, i = text.indexOf(from); return i < 0 ? null : { [c.file]: text.slice(0, i) + to + text.slice(i + from.length) }; }
  const digit = s => { const i = s.search(/\d/); return i < 0 ? null : s.slice(0, i) + ((+s[i] + 1) % 10) + s.slice(i + 1); };
  const quote = s => { const q = s.search(/['"`]/); return q < 0 ? null : s.slice(0, q + 1) + 'Q' + s.slice(q + 1); };
  const key = s => { const m = /[{,]\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*))\s*:/.exec(s); if (!m) return null; const k = m[1] ?? m[2] ?? m[3], at = m.index + m[0].indexOf(k, m[0].search(/['"A-Za-z_$]/) + (m[3] === undefined ? 1 : 0)); return s.slice(0, at) + k + 'Q' + s.slice(at + k.length); };
  const as = c.as || 'number';
  const bump = s => (as === 'string' ? s + 'Q' : as === 'keys' || as === 'byIndex' ? key(s) : digit(s) ?? quote(s));
  if (c.json !== undefined) {
    const data = JSON.parse(text), keys = c.json.split('.').filter(Boolean), parent = keys.slice(0, -1).reduce((o, k) => o[k], data), last = keys[keys.length - 1];
    const v = keys.length ? parent[last] : data;
    let nv;
    if (typeof v === 'number') nv = v + 1;
    else if (Array.isArray(v)) { nv = JSON.parse(JSON.stringify(v)); const x = nv[0]; nv[0] = typeof x === 'number' ? x + 1 : typeof x === 'string' ? x + 'Q' : (x && typeof x === 'object' && 'name' in x) ? { ...x, name: x.name + 'Q' } : null; }
    else if (v && typeof v === 'object') { const k0 = Object.keys(v)[0]; nv = {}; for (const k of Object.keys(v)) nv[k === k0 ? k + 'Q' : k] = v[k]; }
    if (nv === undefined || nv === null) return null;
    if (keys.length) parent[last] = nv;
    return { [c.file]: JSON.stringify(keys.length ? data : nv, null, 1) };
  }
  const m = new RegExp(c.find, 'gd' + (c.flags || '')).exec(text); if (!m) return null;
  const [a, b] = m.indices[c.groups ? c.groups[c.groups.length - 1] : c.group || 1], s = bump(text.slice(a, b)); if (s === null) return null;
  return { [c.file]: text.slice(0, a) + s + text.slice(b) };
}

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
if (ARG.mutants) {
  const R = { tool: 'dev/tools/checks/facts.js --mutants', control: null, mutants: [], ok: true };
  const base = check(spec); R.control = base.ok ? 'PASS' : 'FAIL'; if (!base.ok) R.ok = false;
  console.log(`${R.control.padEnd(7)} control: every fact as it is (${base.facts.length} facts, ${base.copies} copies)`);
  for (const f of spec.facts) for (const c of f.copies) {
    const files = mutate(spec, f, c), id = `${f.id} @ ${c.file}`;
    if (!files) { R.mutants.push({ id, caught: false, why: 'could not be changed' }); R.ok = false; console.log(`MISSED  ${id}: could not be changed`); continue; }
    const r = check(spec, files), caught = r.problems.some(p => p.startsWith(f.id + ': '));
    R.mutants.push({ id, caught, problems: r.problems.slice(0, 3) }); if (!caught) R.ok = false;
    if (!caught) console.log(`MISSED  ${id}`);
  }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`FACTS MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} (${R.mutants.filter(m => m.caught).length} of ${R.mutants.length} copies, each changed alone, caught; the control ${R.control})`);
  process.exit(R.ok ? 0 : 1);
}
const R = Object.assign({ tool: 'dev/tools/checks/facts.js', spec: path.relative(REPO, SPEC) }, check(spec));
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
for (const f of R.facts) console.log(`${f.ok ? 'ok  ' : 'FAIL'} ${f.id}: ${f.value === undefined ? "each copy its own value" : J(f.value).slice(0, 70)} (${f.copies.length} copies${f.copies.some(c => c.own !== undefined) ? ', recorded differences' : ''})`);
for (const p of R.problems) console.log('  ' + p);
console.log(`FACTS CHECK: ${R.ok ? 'PASS' : 'FAIL'} (${R.facts.length} facts, ${R.copies} copies${R.ok ? ', each where it is listed and holding its value' : `; ${R.problems.length} problems`})`);
process.exitCode = R.ok ? 0 : 1;
