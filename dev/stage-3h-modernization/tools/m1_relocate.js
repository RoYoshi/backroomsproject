/* Stage 3H engine modernization, H3M-1 - move every runtime file to its owner (src/), the web root to public/, and the assembled server
 * files to generated/server/ (development only; a one-time migration script, kept as the record of what it did).
 *
 *   node dev/stage-3h-modernization/tools/m1_relocate.js --dry-run     print the plan, change nothing
 *   node dev/stage-3h-modernization/tools/m1_relocate.js --apply       do it (git mv / git rm, the four path edits, the recipes), then build
 *   node dev/stage-3h-modernization/tools/m1_relocate.js --verify      every built output against the parent's file at its old path
 *
 * Idempotent: a move whose source is gone and whose target exists is reported as done.  Every move is a `git mv` (the blob is kept); the
 * only content edits are listed in EDITS, each asserted to match exactly once.  --verify compares each output byte for byte with
 * `git show 22751bb:<old path>` and lists the declared differences (none for public/; the server-side ones are listed). */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..', '..'), PARENT = '22751bbc39c91f3e54e3305638b2ef2c9dd12c68';
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 1 << 30 });
const MODE = process.argv[2] || '--dry-run';
const F = 'src/frameworks';
/* ---------- client sources: [old path, canonical source, built output(s)] ---------- */
const CLIENT = [
  ['camera_policy.js', `${F}/br-r/client/camera_policy.js`, ['public/camera_policy.js']],
  ['timing_policy.js', `${F}/space/shared/timing_policy.js`, ['public/timing_policy.js']],
  ['world.js', `${F}/space/shared/world.js`, ['public/world.js', 'generated/server/world.js']],
  ['move.js', `${F}/space/client/move.js`, ['public/move.js']],
  ['camcorder.js', `${F}/br-r/client/camcorder.js`, ['public/camcorder.js']],
  ['sfx.js', `${F}/spacious-audio/client/sfx.js`, ['public/sfx.js']],
  ['gore.js', `${F}/gib/client/gore.js`, ['public/gore.js']],
  ['dphys.js', `${F}/gib/shared/dphys.js`, ['public/dphys.js', 'generated/server/dphys.js']],
  ['light.js', `${F}/br-role/client/light.js`, ['public/light.js']],
  ['glitch.js', `${F}/lost/client/glitch.js`, ['public/glitch.js']],
  ['mp.js', 'src/core/client/mp.js', ['public/mp.js']],
  ['hud.js', `${F}/front/client/hud.js`, ['public/hud.js']],
  ['inventory.js', `${F}/pocket/client/inventory.js`, ['public/inventory.js']],
  ['assets/net-newrun.js', `${F}/front/client/net-newrun.js`, ['public/assets/net-newrun.js']],
  ['assets/mp-hum.js', `${F}/spacious-audio/client/mp-hum.js`, ['public/assets/mp-hum.js']],
  ['assets/net-wire.js', `${F}/bpp/client/net-wire.js`, ['public/assets/net-wire.js']],
  ['assets/net-interp.js', `${F}/bpp/client/net-interp.js`, ['public/assets/net-interp.js']],
  ['assets/credits_data.js', `${F}/front/client/credits_data.js`, ['public/assets/credits_data.js']],
  ['assets/ui.js', `${F}/front/client/ui.js`, ['public/assets/ui.js']],
  ['assets/br-role.js', `${F}/br-role/client/br-role.js`, ['public/assets/br-role.js']],
  ['assets/level0_visuals.js', `${F}/lost/client/level0_visuals.js`, ['public/assets/level0_visuals.js']],
  ['assets/l0-remaster.js', `${F}/br-r/client/l0-remaster.js`, ['public/assets/l0-remaster.js']],
];
/* ---------- assembled files: their parts move to their owners; the old root output is removed and rebuilt at its new place ---------- */
const ENTS = [['00_head.js', `${F}/br-r/client/ents.head.js`], ['10_hound.js', `${F}/br-r/client/ents.hound.js`], ['20_smiler.js', `${F}/br-r/client/ents.smiler.js`],
  ['25_death.js', `${F}/gib/client/ents.death.js`], ['30_audio.js', `${F}/spacious-audio/client/ents.audio.js`], ['40_debug.js', `${F}/overseer/client/ents.debug.js`]];
const AI = ['00_head', '10_geo', '20_senses', '22_intelligence', '25_light', '30_entity', '40_capture', '50_hound', '60_smiler', '90_engine'].map(n => [n + '.js', `${F}/nani/server/ai.${n.slice(3)}.js`]);
const SIM_HEADER = 'src/core/server/sim.header.js', SIM_LEVEL = `${F}/lost/server/sim.level0.js`, SIM_GLUE = 'src/core/server/sim.glue.js';
/* ---------- server modules, required directly (no build) ---------- */
const SERVER = [['server/newrun.js', `${F}/bpp/server/newrun.js`], ['server/aftermath.js', `${F}/gib/server/aftermath.js`], ['server/peers.js', `${F}/space/server/peers.js`],
  ['server/ws.js', `${F}/bpp/server/ws.js`], ['server/fields.js', `${F}/ward/server/fields.js`], ['server/static.js', `${F}/ward/server/static.js`],
  ['death_srv.js', `${F}/gib/server/death_srv.js`]];
/* ---------- static files: the web root ---------- */
const tracked = git('ls-tree', '-r', '--name-only', PARENT).toString().trim().split('\n');
const movedJs = new Set(CLIENT.map(c => c[0]));
const STATIC = ['index.html', 'favicon.ico', ...tracked.filter(p => (p.startsWith('assets/') && !movedJs.has(p)) || p.startsWith('sounds/'))].map(p => [p, 'public/' + p]);
const REMOVE = ['ai.js', 'ents.js', 'sim.js', 'dev/build_ai.sh', 'dev/build_ents.sh', 'dev/build_sim.sh'];
/* ---------- the only content edits, each must match exactly once ---------- */
const EDITS = [
  ['server.js', "const PORT = +process.argv[2] || process.env.PORT || 8000, ROOT = __dirname, MAX_ROOM = 8;",
    "const PORT = +process.argv[2] || process.env.PORT || 8000, ROOT = path.join(__dirname, 'public'), MAX_ROOM = 8;   // (Stage 3H modernization: the web root is public/; nothing outside it can be served)"],
  ['server.js', "const createSim = require('./sim.js');", "const createSim = require('./generated/server/sim.js');   // (built from src/: npm run build)"],
  ['server.js', "require('./server/static.js')(ROOT)", "require('./src/frameworks/ward/server/static.js')(ROOT)"],
  ['server.js', "const deathSrv = require('./death_srv.js');", "const deathSrv = require('./src/frameworks/gib/server/death_srv.js');"],
  ['server.js', "require('./server/peers.js')", "require('./src/frameworks/space/server/peers.js')"],
  ['server.js', "require('./server/ws.js')", "require('./src/frameworks/bpp/server/ws.js')"],
  ['server.js', "require('./server/fields.js')", "require('./src/frameworks/ward/server/fields.js')"],
  ['server.js', "require('./server/aftermath.js')", "require('./src/frameworks/gib/server/aftermath.js')"],
  ['server.js', "require('./server/newrun.js')", "require('./src/frameworks/bpp/server/newrun.js')"],
  [`${F}/gib/server/death_srv.js`, "fs.readFileSync(path.join(__dirname, 'dphys.js'), 'utf8')",
    "fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'generated', 'server', 'dphys.js'), 'utf8')"],
  [`${F}/ward/server/static.js`, " * ROOT is the folder server.js lives in, passed in because this file lives one level below it.",
    " * ROOT is the web root, public/ next to server.js (Stage 3H modernization; it was the folder server.js lives in), passed in by server.js."],
];
const SIM_PRINTED_HEADER = "/* sim.js - server-side Level 0 simulation.\n * The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).\n * The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the admin tools. */\n'use strict';\n";

function recipes() {
  const outs = [];
  for (const [, src, o] of CLIENT) for (const out of o) outs.push({ out, parts: [src] });
  outs.push({ out: 'public/ents.js', parts: ENTS.map(e => e[1]) });
  outs.push({ out: 'generated/server/ai.js', parts: AI.map(a => a[1]) });
  outs.push({ out: 'generated/server/sim.js', parts: [SIM_HEADER, SIM_LEVEL, SIM_GLUE] });
  const order = o => (o.out.startsWith('public/') ? 0 : 1);
  outs.sort((a, b) => order(a) - order(b) || a.out.localeCompare(b.out));
  return { note: 'Every built output and its parts, in order (dev/tools/build/build.js). public/ is the web root; generated/server/ holds what the server loads that is assembled from parts. Parts are concatenated as they are, less a leading "/** @part" header.', outputs: outs };
}
const exists = p => fs.existsSync(path.join(REPO, p));
function mv(a, b, plan) {
  if (!exists(a) && exists(b)) return plan.push(['done', a, b]);
  if (!exists(a)) throw new Error('missing source ' + a);
  if (exists(b)) throw new Error('target exists ' + b);
  plan.push(['mv', a, b]);
  if (MODE === '--apply') { fs.mkdirSync(path.dirname(path.join(REPO, b)), { recursive: true }); git('mv', a, b); }
}
function main() {
  if (MODE === '--verify') return verify();
  const plan = [];
  for (const [a, b] of STATIC) mv(a, b, plan);
  for (const [a, b] of CLIENT) mv(a, b, plan);
  for (const [a, b] of ENTS) mv('dev/ents_src/' + a, b, plan);
  for (const [a, b] of AI) mv('dev/ai_src/' + a, b, plan);
  for (const [a, b] of SERVER) mv(a, b, plan);
  mv('dev/sim_glue.js', SIM_GLUE, plan);
  /* sim_head.js: its lines up to its first 'use strict' were dropped by build_sim.sh; they become the part's (stripped) header */
  if (exists('dev/sim_head.js')) {
    const t = fs.readFileSync(path.join(REPO, 'dev/sim_head.js'), 'utf8'), lines = t.split('\n'), i = lines.findIndex(l => /^'use strict';/.test(l));
    if (i < 0) throw new Error("dev/sim_head.js: no 'use strict' line");
    const dropped = lines.slice(0, i + 1).join('\n'), kept = lines.slice(i + 1).join('\n');
    if (dropped.includes('*/') && !/\*\/\n'use strict';$/.test(dropped)) throw new Error('dev/sim_head.js: unexpected header shape');
    const header = "/** @part generated/server/sim.js (after src/core/server/sim.header.js)\n * L.O.S.T. / S.P.A.C.E.: Level 0's map, collision, ray-cast and light code, extracted from the production bundle (3H F-007: the map\n * exists in the bundle too).  This header is not built; it keeps the comment dev/sim_head.js carried above the code:\n" +
      dropped.replace(/\*\//g, '* /').split('\n').map(l => ' * | ' + l).join('\n') + '\n */\n';
    plan.push(['part', 'dev/sim_head.js', SIM_LEVEL]);
    if (MODE === '--apply') { fs.mkdirSync(path.dirname(path.join(REPO, SIM_LEVEL)), { recursive: true }); git('mv', 'dev/sim_head.js', SIM_LEVEL); fs.writeFileSync(path.join(REPO, SIM_LEVEL), header + kept); }
  } else plan.push(['done', 'dev/sim_head.js', SIM_LEVEL]);
  if (!exists(SIM_HEADER)) { plan.push(['new', SIM_HEADER, 'the header build_sim.sh printed']); if (MODE === '--apply') fs.writeFileSync(path.join(REPO, SIM_HEADER), SIM_PRINTED_HEADER); }
  for (const r of REMOVE) if (exists(r)) { plan.push(['rm', r]); if (MODE === '--apply') git('rm', '-q', r); }
  for (const [f, a, b] of EDITS) {
    const p = path.join(REPO, f); if (!fs.existsSync(p)) { plan.push(['edit-pending', f]); continue; }
    const t = fs.readFileSync(p, 'utf8'), n = t.split(a).length - 1;
    if (n === 0 && t.includes(b)) { plan.push(['edit-done', f, b.slice(0, 60)]); continue; }
    if (n !== 1) throw new Error(`${f}: expected one "${a.slice(0, 60)}", found ${n}`);
    plan.push(['edit', f, a.slice(0, 60) + ' -> ' + b.slice(0, 60)]);
    if (MODE === '--apply') fs.writeFileSync(p, t.replace(a, b));
  }
  plan.push(['write', 'src/build-recipes.json']);
  if (MODE === '--apply') fs.writeFileSync(path.join(REPO, 'src/build-recipes.json'), JSON.stringify(recipes(), null, 1) + '\n');
  const count = {}; for (const p of plan) count[p[0]] = (count[p[0]] || 0) + 1;
  for (const p of plan) if (MODE === '--dry-run') console.log(p.join('  '));
  console.log(MODE, JSON.stringify(count));
}
function verify() {
  /* every built output against the parent's file at its old path */
  const r = JSON.parse(fs.readFileSync(path.join(REPO, 'src/build-recipes.json'), 'utf8'));
  const oldOf = { 'public/ents.js': 'ents.js', 'generated/server/ai.js': 'ai.js', 'generated/server/sim.js': 'sim.js', 'generated/server/world.js': 'world.js', 'generated/server/dphys.js': 'dphys.js' };
  for (const [a, , o] of CLIENT) for (const out of o) if (out.startsWith('public/')) oldOf[out] = a;
  const sha = b => crypto.createHash('sha256').update(b).digest('hex'), res = [];
  for (const o of r.outputs) {
    const old = oldOf[o.out] || (o.out.startsWith('public/') ? o.out.slice(7) : null), now = fs.readFileSync(path.join(REPO, o.out)), was = git('show', `${PARENT}:${old}`);   // (a recipe added later, e.g. H3M-6's: its URL path is its old path)
    res.push({ out: o.out, parentFile: old, identical: now.equals(was), sha256: sha(now), parentSha256: sha(was) });
  }
  /* static files: moved, so their blobs must be the parent's */
  const stat = STATIC.map(([a, b]) => ({ from: a, to: b, identical: fs.readFileSync(path.join(REPO, b)).equals(git('show', `${PARENT}:${a}`)) }));
  const ok = res.every(x => x.identical) && stat.every(x => x.identical);
  console.log(JSON.stringify({ parent: PARENT, outputs: res.length, outputsIdentical: res.filter(x => x.identical).length, staticFiles: stat.length, staticIdentical: stat.filter(x => x.identical).length, differing: res.filter(x => !x.identical).concat(stat.filter(x => !x.identical)), ok }, null, 1));
  process.exitCode = ok ? 0 : 1;
}
main();
