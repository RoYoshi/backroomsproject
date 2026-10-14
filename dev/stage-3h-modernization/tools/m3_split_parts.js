/* Stage 3H engine modernization (H3M-3 to H3M-5) - give a built output's parts their owners: split a part by line ranges into owned
 * parts, and write every part's interface header (development only; the output stays byte-identical by construction).
 *
 *   node dev/stage-3h-modernization/tools/m3_split_parts.js --spec <spec.json> [--apply]
 *
 *   { "output": "generated/server/sim.js",
 *     "split": { "from": "src/core/server/sim.glue.js",                         (optional: a part to split)
 *                "parts": [ { "lines": "1-88", "to": "src/frameworks/nani/server/sim.ai.js" }, ... ] },
 *     "titles": { "<part path>": "<OWNER: what it is>", ... },                   (every part of the output)
 *     "notes":  { "<part path>": ["a line of the header", ...], ... } }          (optional)
 *
 * The ranges must cover every line of the part being split, in order, with no gap and no overlap.  Without --apply the tool checks the
 * spec and prints the plan.  With --apply it:
 *   1. writes each new part (the old part's lines, unchanged) and puts them in the output's recipe in place of the old part, which is
 *      removed unless a new part keeps its path;
 *   2. writes every part's header: "/** @part <output> - <title>", the notes, then provides, uses and writes as dev/tools/checks/parts.js finds
 *      them in the code (the build removes the header, so the output's bytes do not change);
 *   3. runs the build (only its manifest may change) and checks: build.js --check, and parts.js for this output.
 * Nothing else is touched.  The working tree is the input; commit or stash before, so that git shows exactly what changed. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a === '--apply') ARG.apply = true; else if (a.startsWith('--')) ARG[a.slice(2)] = process.argv[++i]; }
const REPO = path.resolve(__dirname, '..', '..', '..'), RECIPES = path.join(REPO, 'src', 'build-recipes.json');
const PARTS = require(path.join(REPO, 'dev', 'tools', 'checks', 'parts.js'));
const spec = JSON.parse(fs.readFileSync(path.resolve(ARG.spec), 'utf8'));
const recipesText = fs.readFileSync(RECIPES, 'utf8'), recipes = JSON.parse(recipesText);
if (JSON.stringify(recipes, null, 1) + '\n' !== recipesText) throw new Error('src/build-recipes.json is not in its usual form');
const o = recipes.outputs.find(x => x.out === spec.output); if (!o || !o.parts) throw new Error('no parts recipe for ' + spec.output);
/* an output built from the very same parts as this one (world.js: for the page and for the server) is changed with it, and named in the headers */
const twins = recipes.outputs.filter(x => x !== o && Array.isArray(x.parts) && JSON.stringify(x.parts) === JSON.stringify(o.parts)), OUTS = [o.out, ...twins.map(x => x.out)].join(',');
const body = p => { const raw = fs.readFileSync(path.join(REPO, p)), m = raw.toString('latin1').match(PARTS.HEADER); return m ? raw.subarray(Buffer.byteLength(m[0], 'latin1')) : raw; };
let newParts = o.parts.slice(), writes = [];
if (spec.split) {
  const S = spec.split, at = o.parts.indexOf(S.from); if (at < 0) throw new Error(`${S.from} is not a part of ${spec.output}`);
  const text = body(S.from).toString('utf8'), lines = text.split(/(?<=\n)/);                        // each line with its own newline
  let next = 1;
  const pieces = S.parts.map(q => { const [a, b] = q.lines.split('-').map(Number); if (a !== next || b < a || b > lines.length) throw new Error(`${q.to}: lines ${q.lines} do not follow on from line ${next - 1}`); next = b + 1; return { to: q.to, text: lines.slice(a - 1, b).join('') }; });
  if (next !== lines.length + 1) throw new Error(`the ranges end at line ${next - 1}; ${S.from} has ${lines.length}`);
  if (pieces.map(x => x.text).join('') !== text) throw new Error('the pieces do not give the part back');
  for (const x of pieces) if (x.to !== S.from && fs.existsSync(path.join(REPO, x.to))) throw new Error(`${x.to} exists already`);
  newParts.splice(at, 1, ...pieces.map(x => x.to)); writes = pieces;
  console.log(`${S.from} (${lines.length} lines) -> ` + S.parts.map(q => `${q.to} (${q.lines})`).join(', '));
}
for (const p of newParts) if (!spec.titles || !spec.titles[p]) throw new Error('no title for ' + p);
if (!ARG.apply) { console.log('plan only: --apply to write it'); process.exit(0); }
/* 1. the new parts, without headers yet, and the recipe */
const removed = spec.split && !writes.some(x => x.to === spec.split.from) ? spec.split.from : null;
for (const x of writes) { fs.mkdirSync(path.dirname(path.join(REPO, x.to)), { recursive: true }); fs.writeFileSync(path.join(REPO, x.to), x.text); }
if (removed) fs.unlinkSync(path.join(REPO, removed));
o.parts = newParts; for (const t of twins) t.parts = newParts.slice(); fs.writeFileSync(RECIPES, JSON.stringify(recipes, null, 1) + '\n');
/* 2. every part's header, from what the code shows */
const write = (p, h) => fs.writeFileSync(path.join(REPO, p), Buffer.concat([Buffer.from(h), body(p)]));
for (const p of newParts) write(p, `/** @part ${OUTS} - ${spec.titles[p]}\n */\n`);
const R = PARTS.analyse(o);
if (R.problems.length) throw new Error('the parts checker: ' + R.problems.join('; '));
for (const r of R.parts) {
  const notes = (spec.notes && spec.notes[r.path] || []).map(l => ' * ' + l);
  write(r.path, [`/** @part ${OUTS} - ${spec.titles[r.path]}`, ...notes, ...PARTS.wrapList('provides', r.provides), ...PARTS.wrapList('uses', r.uses), ...PARTS.wrapList('writes', r.writes), ' */', ''].join('\n'));
}
/* 3. the build and the checks */
const run = (...a) => spawnSync(process.execPath, a, { cwd: REPO, encoding: 'utf8' });
const b = run('dev/tools/build/build.js'), c = run('dev/tools/build/build.js', '--check'), k = PARTS.analyse(o), kt = twins.map(t => PARTS.analyse(t));
if (kt.some(x => !x.ok)) k.ok = false;
console.log((b.stdout || '').trim().split('\n').pop());
console.log((c.stdout || '').trim().split('\n').pop());
console.log(`parts check of ${spec.output}: ${k.ok ? 'PASS' : 'FAIL'}` + k.parts.filter(p => p.problem).map(p => `\n  ${p.path}: ${p.problem}`).join(''));
process.exitCode = c.status === 0 && k.ok && /\((0|1) files written/.test(b.stdout) ? 0 : 1;          // (only the manifest may have been written)
