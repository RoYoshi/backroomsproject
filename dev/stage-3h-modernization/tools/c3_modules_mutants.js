/* Stage 3H continuation (C3) - the module-boundary audit refuses every broken boundary (development only; needs TypeScript, like the audit).
 * The server's cases came with C3a; the page's (page_*) with C3b.
 *
 *   node dev/stage-3h-modernization/tools/c3_modules_mutants.js [--out FILE.json]
 *
 * dev/tools/checks/modules.js says what a module boundary is (names, read-only imports, every import used, a world's state inside its
 * factory, the sim's wiring; the page's modules, their composition, their owners' state and the global object).  This proves that it
 * notices when one is broken: for each tampering below it copies the game's code (server.js, src/, generated/) into a scratch folder,
 * changes one thing, runs the audit on the copy with --dir, and expects it to FAIL and to name the rule that was broken.  The unchanged
 * copy must PASS first.  Nothing in this repository is touched. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..'), CHECK = path.join(REPO, 'dev', 'tools', 'checks', 'modules.js');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const F = 'src/frameworks';
const CASES = [
  { id: 'state_outside_factory', file: `${F}/gib/server/sim.bodies.js`, find: "'use strict';\n", repl: "'use strict';\nlet shared=0;\n", expect: /code outside its factory/, why: "a sim module keeps a value at its top level (every room's world would share it)" },
  { id: 'import_assigned', file: `${F}/nani/server/sim.feed.js`, find: 'function processEvents(){', repl: 'function processEvents(){eng=null;', expect: /assigns names it was given: eng/, why: 'a module assigns a name it was given' },
  { id: 'name_not_given', file: `${F}/nani/server/sim.feed.js`, find: 'ai: { SNn, eng, isAlive } })', repl: 'ai: { SNn, eng } })', expect: /names used and declared nowhere: isAlive/, why: 'a module uses a name nobody gave it' },
  { id: 'import_unused', file: `${F}/nani/server/sim.feed.js`, find: 'ai: { SNn, eng, isAlive } })', repl: 'ai: { SNn, eng, isAlive, rnd } })', expect: /never uses: rnd/, why: 'a module is given a name it never uses' },
  { id: 'import_not_exported', file: `${F}/pocket/server/sim.items.js`, find: 'ai: { eng, randomSpot }', repl: 'ai: { eng, randomSpot, players }', expect: /imports from ai names it does not return: players/, why: 'a module imports a name its giver does not return' },
  { id: 'made_after', file: 'src/core/server/sim.js', find: '  const run=simStep({opts,players,level,ai,feed,walls,items,bodies});\n  const life=simPlayers({players,level,ai,feed,run}),move=simMovement({WORLD,level,ai});',
    repl: '  const life=simPlayers({players,level,ai,feed,run}),move=simMovement({WORLD,level,ai});\n  const run=simStep({opts,players,level,ai,feed,walls,items,bodies});', expect: /life uses run, made after it/, why: 'a module is made from one made after it (a cycle, or the wrong order)' },
  { id: 'key_not_given', file: 'src/core/server/sim.js', find: 'items=simItems({ai,walls})', repl: 'items=simItems({ai})', expect: /takes walls, which the composition does not give/, why: 'the composition does not give a module what its factory takes' },
  { id: 'global_backchannel', file: `${F}/overseer/server/sim.admin.js`, find: 'debug(on){debugOn=!!on;return debugOn},', repl: 'debug(on){debugOn=!!on;globalThis.simDebug=debugOn;return debugOn},', expect: /reaches the global object: globalThis/, why: 'a module reaches a global back-channel' },
  /* the page's scripts (continuation C3b) */
  { id: 'page_state_outside_factory', file: `${F}/spacious-audio/client/glitch.audio.js`, find: '  function glitchAudio() {\n', repl: '  let shared = 0;\n  function glitchAudio() {\n', expect: /glitch\.audio\.js: code outside its factory/, why: "a page module keeps a value in the script's wrapper, outside its factory" },
  { id: 'page_hidden_closure', file: `${F}/br-r/client/camcorder.view.js`, find: 'audio: { snd, whine } }) {\n', repl: 'audio: { snd, whine } }) {\n  const peek = () => camcorderAudio;\n', expect: /camcorderView uses camcorderAudio, declared outside its factory/, why: 'a page module uses a name of the wrapper (another factory): a hidden closure dependence' },
  { id: 'page_import_assigned', file: `${F}/lost/client/glitch.draw.js`, find: 'audio: { updateSnd } }) {\n', repl: 'audio: { updateSnd } }) {\n  rnd = Math.random;\n', expect: /glitchDraw assigns names it was given: rnd/, why: 'a page module assigns a name it was given' },
  { id: 'page_import_unused', file: `${F}/overseer/client/ents.debug.js`, find: 'function entsDebug({ head: { clamp, E, sm, TAU } }) {', repl: 'function entsDebug({ head: { clamp, E, lerp, sm, TAU } }) {', expect: /entsDebug is given names it never uses: lerp/, why: 'a page module is given a name it never uses' },
  { id: 'page_not_exported', file: `${F}/gib/client/ents.death.js`, find: 'smiler: { drawSmiler } }) {', repl: 'smiler: { drawSmiler, initSmiler } }) {', expect: /entsDeath imports from smiler \(entsSmiler\) names it does not return: initSmiler/, why: 'a page module imports a name its giver does not return' },
  { id: 'page_made_after', file: `${F}/br-r/client/ents.compose.js`, find: 'const smiler = entsSmiler({ head });\nentsDeath({ head, smiler });\n', repl: 'entsDeath({ head, smiler });\nconst smiler = entsSmiler({ head });\n', expect: /entsDeath is given smiler: smiler, not a module made before it/, why: 'the composition makes a page module from one made after it' },
  { id: 'page_key_not_given', file: `${F}/br-r/client/camcorder.compose.js`, find: '  camcorderView({ core, audio });', repl: '  camcorderView({ core });', expect: /camcorderView takes audio, which the composition does not give/, why: 'the composition does not give a page module what its factory takes' },
  { id: 'page_cross_owner_write', file: `${F}/spacious-audio/client/camcorder.audio.js`, find: ' setWhine({ c, o, g, lfo });\n', repl: ' S.whine = { c, o, g, lfo };\n', expect: /camcorderAudio \(spacious-audio\) writes S\.whine, state of camcorderCore \(br-r\)/, why: "a page module writes another owner's state (M8's S.whine, before C3b gave it a setter)" },
  { id: 'page_hidden_call', file: `${F}/gib/client/ents.death.js`, find: "  drawSmiler(view, { state: 'ATTACKING'", repl: "  E.drawSmiler(view, { state: 'ATTACKING'", expect: /entsDeath calls E\.drawSmiler \(entsHead's object\), which entsSmiler puts there/, why: "a page module calls a function a third module put on the public object (M8's E.drawSmiler)" },
  { id: 'page_global_backchannel', file: `${F}/space/client/move.js`, find: '  sfx && sfx.slideEnd();\n', repl: '  window.__mvSfx && window.__mvSfx.slideEnd();\n', expect: /moveCore reads __mvSfx through the global object, which moveSound of the same script put there/, why: "a page module reads through the global object what another module of its script put there (M8's window.__mvSfx)" },
  { id: 'page_entry_twice', file: `${F}/br-r/client/ents.hound.js`, find: 'E.attackHound = function (view, grip, impact, variant, jl) {', repl: 'E.smilerGlow = null;\nE.attackHound = function (view, grip, impact, variant, jl) {', expect: /entry smilerGlow is written by/, why: 'two page modules write the same entry of the public object' },
  { id: 'page_header_lies', file: `${F}/spacious-audio/client/camcorder.audio.js`, find: ' * imports: core { S setWhine }\n', repl: ' * imports: core { S }\n', expect: /camcorder\.audio\.js: its header's imports/, why: "a page module's header does not list what its factory takes" },
];
const copyTree = dst => {
  for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(REPO, f), path.join(dst, f));
  for (const d of ['src', 'generated']) fs.cpSync(path.join(REPO, d), path.join(dst, d), { recursive: true });
};
const run = dir => { const r = spawnSync(process.execPath, [CHECK, '--dir', dir, '--quiet'], { encoding: 'utf8' }); return { exit: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c3mod-')), R = { tool: 'dev/stage-3h-modernization/tools/c3_modules_mutants.js', cases: [], ok: true };
try {
  const base = path.join(tmp, 'base'); fs.mkdirSync(base); copyTree(base);
  const b = run(base); R.unchanged = { exit: b.exit, pass: b.exit === 0 && /MODULES CHECK: PASS/.test(b.out) };
  console.log(`${R.unchanged.pass ? 'ok  ' : 'FAIL'} the unchanged copy passes`); if (!R.unchanged.pass) { R.ok = false; console.log(b.out); }
  for (const c of CASES) {
    const d = path.join(tmp, c.id); fs.mkdirSync(d); copyTree(d);
    const f = path.join(d, c.file), t = fs.readFileSync(f, 'utf8');
    if (t.split(c.find).length !== 2) { R.ok = false; R.cases.push({ id: c.id, error: 'its text is not found exactly once' }); console.log(`FAIL ${c.id}: its text is not found exactly once`); continue; }
    fs.writeFileSync(f, t.replace(c.find, c.repl));
    const r = run(d), refused = r.exit === 1 && /MODULES CHECK: FAIL/.test(r.out), named = c.expect.test(r.out);
    R.cases.push({ id: c.id, file: c.file, why: c.why, refused, named, problems: r.out.split('\n').filter(l => l.startsWith('PROBLEM')) });
    if (!refused || !named) R.ok = false;
    console.log(`${refused && named ? 'ok  ' : 'FAIL'} ${c.id}: ${c.why}${refused ? '' : ' - NOT REFUSED'}${refused && !named ? ' - refused for another reason' : ''}`);
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`MODULES CHECK MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} (${R.cases.filter(c => c.refused && c.named).length} of ${CASES.length} broken boundaries refused, each for its own reason)`);
process.exitCode = R.ok ? 0 : 1;
