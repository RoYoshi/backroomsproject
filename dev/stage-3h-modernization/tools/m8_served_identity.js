/* Stage 3H engine modernization (H3M-8) - every file the game runs, against the frozen Stage 3H2 and the accepted B++ (development only).
 *
 *   node dev/stage-3h-modernization/tools/m8_served_identity.js [--out FILE.json]
 *
 * Before the modernization the web root was the repository root, so a file served as /X was the file X of the tree.  Now it is public/X.
 * For every file under public/ (built or static), this compares public/X with X in 3H2's tree and in B++'s tree.  It does the same for
 * the four files the build writes for the server: generated/server/sim.js, ai.js, world.js and dphys.js against sim.js, ai.js, world.js
 * and dphys.js at the root of each tree.  The server's own code (server.js and the modules) is not compared here: the goldens compare
 * what it does.  (Continuation C3a: the sim is no longer built - it is modules, src/core/server/sim.js and its owners' - so only the
 * built server files that exist are compared; the gate's sim step compares the sim's behaviour with B++'s.)
 * Exit 0 when every file is byte-identical to 3H2's, except the outputs made of modules (continuation C3b: camcorder.js, ents.js,
 * glitch.js, move.js, world.js and the server's copy of world.js; C3c: mp.js), whose bytes changed on purpose and whose behaviour the
 * gate's page step (C3b's five) and cli_golden step (mp.js) compare with B++'s.  The differences from B++ are listed: each must be declared
 * in dev/tools/gate/declared_changes.json (Stage 3H2's index.html, mp.js, assets/net-newrun.js, assets/mp-hum.js, and C3b's and C3c's). */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), H2 = '22751bbc39c91f3e54e3305638b2ef2c9dd12c68', BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40';
const blob = b => crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
const tree = ref => new Map(execFileSync('git', ['-C', REPO, 'ls-tree', '-r', '-z', ref]).toString().split('\0').filter(Boolean).map(l => { const [m, p] = l.split('\t'); return [p, m.split(' ')[2]]; }));
const T2 = tree(H2), TB = tree(BPP);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const pub = walk(path.join(REPO, 'public')).map(f => path.relative(REPO, f).split(path.sep).join('/')).sort();
const SERVER_BUILT = ['sim.js', 'ai.js', 'world.js', 'dphys.js'].filter(n => fs.existsSync(path.join(REPO, 'generated', 'server', n)));   // (C3a) the sim is not built
const pairs = pub.map(f => [f, f.slice('public/'.length)]).concat(SERVER_BUILT.map(n => ['generated/server/' + n, n]));
const OUTS = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'build-recipes.json'), 'utf8')).outputs, recipes = new Set(OUTS.map(o => o.out));
/* (C3b) the outputs made of modules: their last part is a composition; their bytes changed on purpose, so their behaviour is compared
 * instead (the gate's page step) */
const modular = new Set(OUTS.filter(o => Array.isArray(o.parts) && o.parts.length > 1 && o.parts[o.parts.length - 1].endsWith('.compose.js')).map(o => o.out));
const R = { tool: 'dev/stage-3h-modernization/tools/m8_served_identity.js', frozen3H2: H2, acceptedBpp: BPP, files: [], ok: true };
for (const [now, old] of pairs) {
  const b = blob(fs.readFileSync(path.join(REPO, now)));
  R.files.push({ file: now, oldPath: old, built: recipes.has(now), modules: modular.has(now), same3H2: T2.get(old) === b, sameBpp: TB.get(old) === b, inBpp: TB.has(old) });
}
const notSame3H2 = R.files.filter(f => !f.same3H2 && !f.modules), rebuilt = R.files.filter(f => !f.same3H2 && f.modules), notBpp = R.files.filter(f => !f.sameBpp);
const decl = JSON.parse(fs.readFileSync(path.join(REPO, 'dev', 'tools', 'gate', 'declared_changes.json'), 'utf8')).runtime;
const undeclared = notBpp.filter(f => !(f.inBpp ? decl.changed[f.oldPath] : decl.added[f.oldPath]));
R.counts = { public: pub.length, publicBuilt: pub.filter(f => recipes.has(f)).length, publicStatic: pub.filter(f => !recipes.has(f)).length, serverBuilt: SERVER_BUILT.length,
  identicalTo3H2: R.files.length - notSame3H2.length - rebuilt.length, of: R.files.length, rebuiltAsModules: rebuilt.map(f => f.file), differFromBpp: notBpp.map(f => f.oldPath + (f.inBpp ? ' (changed)' : ' (added)')) };
R.ok = !notSame3H2.length && !undeclared.length;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`public/: ${R.counts.public} files (${R.counts.publicBuilt} built, ${R.counts.publicStatic} static), and the server's ${R.counts.serverBuilt} built files`);
console.log(`identical to the frozen 3H2 (${H2.slice(0, 7)}): ${R.counts.identicalTo3H2} of ${R.counts.of}${rebuilt.length ? `; rebuilt as modules (continuation C3b, C3c; their behaviour is compared instead: the gate's page step, and its cli_golden step for mp.js): ${rebuilt.map(f => f.file).join(', ')}` : ''}${notSame3H2.length ? '; DIFFERENT: ' + notSame3H2.map(f => f.file).join(', ') : ''}`);
console.log(`different from B++ (${BPP.slice(0, 7)}): ${R.counts.differFromBpp.join(', ') || 'none'}${undeclared.length ? '; NOT DECLARED: ' + undeclared.map(f => f.oldPath).join(', ') : ' (each declared in dev/tools/gate/declared_changes.json)'}`);
console.log('SERVED IDENTITY: ' + (R.ok ? 'PASS' : 'FAIL'));
process.exitCode = R.ok ? 0 : 1;
