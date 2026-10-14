/* Stage 3H engine modernization (H3M-7) - the documentation check refuses every stale generated table (development only).
 *
 *   node dev/stage-3h-modernization/tools/m7_docs_mutants.js --work <empty scratch folder> [--out FILE.json]
 *
 * For each case, dev/tools/docs/, src/, docs/ and public/ are copied into --work, one thing is changed, and
 * `dev/tools/docs/docs.js --check` runs there.  The untouched copy must pass; every changed copy must fail:
 *   - the repository changes and the documents do not: a new recipe, a new file in a framework's folder, a new window global in a served
 *     script, a part's new title;
 *   - the documents change and the repository does not: a row taken out of a generated table, a hand edit inside a generated block, a
 *     block renamed, a framework's README deleted, a block removed with its markers, a block copied into another document.
 * The working tree is only read. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.work) { console.error('--work <empty scratch folder> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), WORK = path.resolve(ARG.work), W = path.join(WORK, 'copy');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be empty'); process.exit(2); }
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, t) => fs.writeFileSync(path.join(W, f), t);
const edit = (f, re, to) => { const t = rd(f); if (!re.test(t)) throw new Error(`${f}: ${re} not found`); wr(f, t.replace(re, to)); };
const CASES = {
  untouched: () => {},
  new_recipe: () => { const j = JSON.parse(rd('src/build-recipes.json')); j.outputs.push({ out: 'public/mutant.js', parts: ['src/frameworks/front/client/hud.js'] }); wr('src/build-recipes.json', JSON.stringify(j, null, 2) + '\n'); },
  new_framework_file: () => wr('src/frameworks/ward/server/mutant.js', '/* a file the documents do not list */\nmodule.exports = () => ({});\n'),
  new_global: () => { const t = rd('public/hud.js'); wr('public/hud.js', t + '\nwindow.__docsMutant = 1;\n'); },
  part_title: () => edit('src/frameworks/gib/client/mp.bodies.js', /^(\/\*\* @part public\/mp\.js - )/, '$1(retitled) '),
  row_removed: () => edit('docs/architecture/BUILD_PIPELINE.md', /^\| `public\/hud\.js` \|.*\n/m, ''),
  hand_edit_in_block: () => edit('docs/architecture/FRAMEWORKS.md', /\| movement, collision, placement \|/, '| movement and collision |'),
  block_renamed: () => edit('docs/architecture/BUILD_PIPELINE.md', /<!-- generated: outputs /, '<!-- generated: outputz '),
  readme_deleted: () => fs.rmSync(path.join(W, 'src/frameworks/echo/README.md')),
  block_removed: () => edit('docs/architecture/CONTRACTS.md', /<!-- generated: globals [\s\S]*?<!-- end of generated block -->\n/, ''),
  block_elsewhere: () => { const m = /<!-- generated: sources:gib [\s\S]*?<!-- end of generated block -->\n/.exec(rd('src/frameworks/gib/README.md')); wr('src/frameworks/ward/README.md', rd('src/frameworks/ward/README.md') + '\n' + m[0]); },
};
const R = { tool: 'dev/stage-3h-modernization/tools/m7_docs_mutants.js', cases: {}, ok: true };
for (const [name, change] of Object.entries(CASES)) {
  fs.rmSync(W, { recursive: true, force: true });
  for (const d of ['dev/tools/docs', 'src', 'docs', 'public']) fs.cpSync(path.join(REPO, d), path.join(W, d), { recursive: true });
  change();
  const r = spawnSync(process.execPath, [path.join(W, 'dev', 'tools', 'docs', 'docs.js'), '--check'], { encoding: 'utf8' });
  const said = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => l.trim()).map(l => l.trim()).join(' | ');
  const ok = name === 'untouched' ? r.status === 0 && /DOCS CHECK: PASS/.test(said) : r.status === 1 && /DOCS CHECK: FAIL/.test(said);
  R.cases[name] = { exit: r.status, ok, said: said.slice(0, 400) }; R.ok = R.ok && ok;
  console.log(`${ok ? 'ok  ' : 'BAD '} ${name.padEnd(19)} exit ${r.status}  ${said.slice(0, 200)}`);
}
fs.rmSync(W, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(R.ok ? 'DOCS CHECK: the untouched copy passes; every stale table, edited, renamed, removed or misplaced block and missing document is refused' : 'DOCS CHECK: NOT EVERY CASE WAS REFUSED');
process.exitCode = R.ok ? 0 : 1;
