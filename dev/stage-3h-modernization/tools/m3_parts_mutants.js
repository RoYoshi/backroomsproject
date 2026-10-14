/* Stage 3H engine modernization (H3M-3) - the parts checker refuses every wrong header and every bad split (development only).
 *
 *   node dev/stage-3h-modernization/tools/m3_parts_mutants.js --work <empty scratch folder> [--out FILE.json]
 *
 * For each case, dev/tools/checks/ and src/ are copied into --work, one thing is changed, and dev/tools/checks/parts.js runs there.  The
 * untouched copy must pass; every changed copy must fail:
 *   - a header that leaves out a name it provides, or lists one it does not use, or forgets a name it writes;
 *   - a header that names another output; a part without its header;
 *   - a split that cuts a statement in two (a function's closing brace moved into the next part: the output's bytes are unchanged).
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
  provides_missing: () => edit('src/frameworks/gib/client/mp.bodies.js', /^( \* provides: )applyBodies, /m, '$1'),
  uses_extra: () => edit('src/frameworks/gib/client/mp.bodies.js', /^( \* uses: )/m, '$1room, '),
  writes_missing: () => edit('src/frameworks/overseer/server/sim.admin.js', /^( \* writes: )bmode, /m, '$1'),
  wrong_output: () => edit('src/frameworks/gib/client/mp.bodies.js', /^\/\*\* @part public\/mp\.js /, '/** @part public/ents.js '),
  no_header: () => { const t = rd('src/frameworks/br-r/client/mp.wanderers.js'); wr('src/frameworks/br-r/client/mp.wanderers.js', t.replace(/^\/\*\* @part [\s\S]*?\*\/\r?\n/, '')); },
  statement_cut: () => {                      /* the last line of mp.monsters.js (a function's closing brace) becomes the first line of mp.glitch.js */
    const a = 'src/frameworks/nani/client/mp.monsters.js', b = 'src/frameworks/lost/client/mp.glitch.js', ta = rd(a), tb = rd(b);
    const m = /\n(\}\n)$/.exec(ta); if (!m) throw new Error(a + ' does not end with a closing brace');
    const hb = /^\/\*\* @part [\s\S]*?\*\/\r?\n/.exec(tb)[0];
    wr(a, ta.slice(0, ta.length - m[1].length)); wr(b, hb + m[1] + tb.slice(hb.length));
  },
};
const R = { tool: 'dev/stage-3h-modernization/tools/m3_parts_mutants.js', cases: {}, ok: true };
for (const [name, change] of Object.entries(CASES)) {
  fs.rmSync(W, { recursive: true, force: true });
  for (const d of ['dev/tools/checks', 'src']) fs.cpSync(path.join(REPO, d), path.join(W, d), { recursive: true });
  change();
  const r = spawnSync(process.execPath, [path.join(W, 'dev', 'tools', 'checks', 'parts.js')], { encoding: 'utf8' });
  const said = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => /PROBLEM|: (no @part|its header|provides:|uses:|writes:)|PARTS CHECK/.test(l)).map(l => l.trim()).join(' | ');
  const ok = name === 'untouched' ? r.status === 0 : r.status === 1;
  R.cases[name] = { exit: r.status, ok, said: said.slice(0, 400) }; R.ok = R.ok && ok;
  console.log(`${ok ? 'ok  ' : 'BAD '} ${name.padEnd(17)} exit ${r.status}  ${said.slice(0, 200)}`);
}
fs.rmSync(W, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(R.ok ? 'PARTS CHECKER: the untouched copy passes; every wrong header and the cut statement are refused' : 'PARTS CHECKER: NOT EVERY CASE WAS REFUSED');
process.exitCode = R.ok ? 0 : 1;
