/* Stage 3H engine modernization (H3M-6) - the build refuses every tampering with the compiled bundle's sources (development only).
 *
 *   node dev/stage-3h-modernization/tools/m6a_replay_mutants.js --work <empty scratch folder> [--out FILE.json]
 *
 * The compiled client bundle, its stylesheet and its PixiJS chunks are build outputs (src/build-recipes.json): the original v11 build
 * output, replayed through the client lineage ledger's steps (src/core/client/bundle/lineage/). For each case below, this tool copies
 * dev/tools/build/, src/, public/ and generated/ into --work, makes one change, and runs `build.js --check` there. The untouched copy
 * must pass, and every changed copy must fail:
 *   - a byte of a served output: the bundle, the stylesheet, a PixiJS chunk;
 *   - a byte of the replay's base (the v11 build output);
 *   - a step's patch: its inserted text, or its offset;
 *   - the ledger's step list: a step dropped, two steps swapped;
 *   - the ledger's recorded result;
 *   - a recipe that replays the wrong chain.
 * The working tree is only read. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!ARG.work) { console.error('--work <empty scratch folder> is required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..'), WORK = path.resolve(ARG.work), W = path.join(WORK, 'copy');
if (fs.existsSync(WORK) && fs.readdirSync(WORK).length) { console.error('--work must be empty'); process.exit(2); }
const L = 'src/core/client/bundle/lineage/', BASE = 'src/core/client/bundle/original-v11/dist/assets/index-DKbV5Nv9.js';
const flip = (f, at) => { const p = path.join(W, f), b = fs.readFileSync(p); b[at] ^= 1; fs.writeFileSync(p, b); };
const editJson = (f, fn) => { const p = path.join(W, f), j = JSON.parse(fs.readFileSync(p, 'utf8')); fn(j); fs.writeFileSync(p, JSON.stringify(j)); };
const CASES = {
  untouched: () => {},
  bundle_byte: () => flip('public/assets/index-DKbV5Nv9.js', 200000),
  stylesheet_byte: () => flip('public/assets/index-D7hdwmUU.css', 5000),
  pixi_chunk_byte: () => flip('public/assets/Cache-DDo62lBW.js', 100),
  base_byte: () => flip(BASE, 1000),
  step_text: () => editJson(L + 'bundle/B20.json', j => { j.hunks[0][2] += ' '; }),
  step_offset: () => editJson(L + 'bundle/B05.json', j => { j.hunks[0][0] += 1; }),
  step_dropped: () => editJson(L + 'ledger.json', j => { j.files.bundle.steps.splice(10, 1); }),
  steps_swapped: () => editJson(L + 'ledger.json', j => { const s = j.files.css.steps; [s[2], s[3]] = [s[3], s[2]]; }),
  result_hash: () => editJson(L + 'ledger.json', j => { j.files.bundle.result.sha256 = '0'.repeat(64); }),
  wrong_chain: () => editJson('src/build-recipes.json', j => { j.outputs.find(o => o.out === 'public/assets/index-DKbV5Nv9.js').replay.chain = 'css'; }),
};
const R = { tool: 'dev/stage-3h-modernization/tools/m6a_replay_mutants.js', cases: {}, ok: true };
for (const [name, change] of Object.entries(CASES)) {
  fs.rmSync(W, { recursive: true, force: true });
  for (const d of ['dev/tools/build', 'src', 'public', 'generated']) fs.cpSync(path.join(REPO, d), path.join(W, d), { recursive: true });
  change();
  const r = spawnSync(process.execPath, [path.join(W, 'dev', 'tools', 'build', 'build.js'), '--check'], { encoding: 'utf8' });
  const said = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => /^(NOT BUILT|BUILD CHECK|BUILD ERROR)/.test(l)).join(' | ');
  const ok = name === 'untouched' ? r.status === 0 : r.status === 1;
  R.cases[name] = { exit: r.status, ok, said }; R.ok = R.ok && ok;
  console.log(`${ok ? 'ok  ' : 'BAD '} ${name.padEnd(16)} exit ${r.status}  ${said}`);
}
fs.rmSync(W, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(R.ok ? 'REPLAY BUILD: the untouched copy builds; every tampering is refused' : 'REPLAY BUILD: NOT EVERY TAMPERING WAS REFUSED');
process.exitCode = R.ok ? 0 : 1;
