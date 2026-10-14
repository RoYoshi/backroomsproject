/* Stage 3H1 - are the three generated runtime files exactly what their development sources build? (development only; reads Git, writes
 * nothing in the repository)
 *
 *   node dev/stage-3h/tools/h1_build_check.js [--ref HEAD] [--out FILE.json]
 *
 * ai.js, ents.js and sim.js are not edited by hand: dev/build_ai.sh, dev/build_ents.sh and dev/build_sim.sh concatenate them from
 * dev/ai_src/*, dev/ents_src/* and dev/sim_head.js + dev/sim_glue.js.  Running those scripts would write over the runtime files, so this
 * tool never runs them: it reads each script's text at REF, takes the part order from its own `cat ... > "$GAME/<file>"` line (and, for
 * sim.js, the header it prints and the `sed` that drops sim_head.js's lines up to its 'use strict'), rebuilds the file in memory from the
 * sources at REF, and compares it byte for byte with the committed runtime file at REF.  If a script's shape is not the one this tool
 * knows, it says so instead of guessing.  Exit 0 only when all three are reproducible. */
'use strict';
const { execFileSync } = require('child_process');
const crypto = require('crypto'), path = require('path'), fs = require('fs');
const ARG = { ref: 'HEAD' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 1 << 30 });
const ref = git('rev-parse', ARG.ref).toString().trim();
const show = p => git('show', `${ref}:${p}`);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const R = { tool: 'dev/stage-3h/tools/h1_build_check.js', ref, files: [], ok: true };
function catBuild(script, srcDir, target) {
  const s = show(script).toString(), m = s.match(new RegExp('^cat ([^>]+) > "\\$GAME/' + target.replace('.', '\\.') + '"$', 'm'));
  if (!m) return { error: `${script}: no 'cat ... > "$GAME/${target}"' line` };
  const parts = m[1].trim().split(/\s+/);
  return { parts: parts.map(p => `${srcDir}/${p}`), built: Buffer.concat(parts.map(p => show(`${srcDir}/${p}`))) };
}
function simBuild() {
  const s = show('dev/build_sim.sh').toString();
  const hm = s.match(/\{ printf '%s\\n' "([\s\S]*?)"; sed -e "1,\/\^'use strict';\/d" sim_head\.js; cat sim_glue\.js; \} > "\$GAME\/sim\.js"/);
  if (!hm) return { error: "dev/build_sim.sh: not the shape this tool knows ({ printf header; sed sim_head.js; cat sim_glue.js; } > sim.js)" };
  const head = show('dev/sim_head.js').toString().split('\n'), i = head.findIndex(l => /^'use strict';/.test(l));
  if (i < 0) return { error: "dev/sim_head.js: no line starting with 'use strict';" };
  const kept = head.slice(i + 1).join('\n');
  return { parts: ['(header printed by build_sim.sh)', 'dev/sim_head.js after its first \'use strict\'; line', 'dev/sim_glue.js'], built: Buffer.concat([Buffer.from(hm[1] + '\n'), Buffer.from(kept), show('dev/sim_glue.js')]) };
}
for (const [target, fn] of [['ai.js', () => catBuild('dev/build_ai.sh', 'dev/ai_src', 'ai.js')], ['ents.js', () => catBuild('dev/build_ents.sh', 'dev/ents_src', 'ents.js')], ['sim.js', simBuild]]) {
  const b = fn(), committed = show(target);
  const rec = { file: target, committedSha256: sha(committed), bytes: committed.length };
  if (b.error) { rec.error = b.error; rec.reproducible = false; }
  else { rec.parts = b.parts; rec.builtSha256 = sha(b.built); rec.reproducible = rec.builtSha256 === rec.committedSha256; }
  R.files.push(rec); R.ok = R.ok && rec.reproducible;
  console.log(`${rec.reproducible ? 'REPRODUCIBLE' : 'NOT REPRODUCIBLE'} ${target}${rec.error ? ': ' + rec.error : ' from ' + rec.parts.length + ' parts'}`);
}
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
process.exit(R.ok ? 0 : 1);
