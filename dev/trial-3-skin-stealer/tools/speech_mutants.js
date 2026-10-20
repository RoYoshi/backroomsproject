#!/usr/bin/env node
/* dev/trial-3-skin-stealer/tools/speech_mutants.js - Trial 3 (T6): the entity speech paths' own mutants (development only; the
 * checkpoints' evidence, not a gate step - the gate's chat step keeps its own fourteen).
 *
 *   node dev/trial-3-skin-stealer/tools/speech_mutants.js [--out FILE.json]
 *
 * Each mutant is one deliberate fault in a copy of the three files dev/tools/checks/chat_server.js's unit_entity layer reads (B++'s
 * speech.js, W.A.R.D.'s chat_text.js, the lounge); that layer, run on the copy (--tree), must FAIL on it in the cases named.  First
 * the layer runs on this tree and must pass. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), CHECK = path.join(REPO, 'dev', 'tools', 'checks', 'chat_server.js');
const FILES = ['src/frameworks/bpp/server/speech.js', 'src/frameworks/ward/server/chat_text.js', 'src/frameworks/bpp/server/lounge.js'];
const SP = FILES[0];
const MUTANTS = [
  { name: 'entity line to the dead and the menu', file: SP, from: 'const pl = w.player; if (!pl.active || pl.dead) continue;', to: 'const pl = w.player;', expect: ['unit_entity_say_recipients'] },
  { name: 'entity line beyond the radius', file: SP, from: 'if (ex * ex + ey * ey > HEAR * HEAR) continue;', to: '', expect: ['unit_entity_say_recipients'] },
  { name: 'entity line to every room', file: SP, from: 'for (const w of room.clients.values()) {', to: 'for (const w of [...rooms.values()].flatMap(r => [...r.clients.values()])) {', expect: ['unit_entity_say_recipients', 'unit_entity_say_own_room'] },
  { name: 'entity speaks as a person', file: SP, from: "ev = { t: 'eheard', e: L.e,", to: "ev = { t: 'heard', id: L.e, e: L.e,", expect: ['unit_entity_say_shape'] },
  { name: 'entity text not cleaned', file: SP, from: 'const c = cleanText(L.text); if (!c.ok)', to: 'const c = { ok: L.text !== undefined, text: String(L.text) }; if (!c.ok)', expect: ['unit_entity_say_shape', 'unit_entity_say_text_checked'] },
  { name: 'entity bucket removed', file: SP, from: 'if (b.tokens < 1) { stats.eRefused', to: 'if (false) { stats.eRefused', expect: ['unit_entity_say_bucket'] },
  { name: 'entity voice unchecked', file: SP, from: "v: { h: whole(v.h, -12, 12, 0), s: whole(v.s, 50, 200, 100) }", to: 'v: { h: v.h, s: v.s }', expect: ['unit_entity_say_voice_clamped'] },
  { name: 'entity backlog not skipped', file: SP, from: 'if (w.sock.writableLength > SLOW_BYTES) continue;', to: '', expect: ['unit_entity_say_backlog_skipped'] },
  { name: 'hook before the rules', file: SP, from: '  const { room, me } = st;\n', to: '  const { room, me } = st; if (ON_HEARD) ON_HEARD(room, { id: me.id, x: me.player.x, y: me.player.y, text: String(m.text) });\n', expect: ['unit_entity_hook_refused_never'] },
  { name: 'hook gets the packet', file: SP, from: 'ON_HEARD(room, { id: me.id, x, y, text: c.text });', to: 'ON_HEARD(room, Object.assign({}, m, { id: me.id, x, y, text: c.text }));', expect: ['unit_entity_hook_accepted'] },
];
function run(tree, out) {
  spawnSync(process.execPath, [CHECK, '--tree', tree, '--only', 'unit_entity', '--quiet', '--out', out], { stdio: 'ignore' });
  try { return JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { return null; }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'k3mut-')), R = { tool: 'dev/trial-3-skin-stealer/tools/speech_mutants.js', base: null, mutants: [] };
try {
  const base = run(REPO, path.join(tmp, 'base.json'));
  R.base = base ? { passed: base.passed, cases: base.cases.length, failed: base.failed } : null;
  for (const [i, M] of MUTANTS.entries()) {
    const dir = path.join(tmp, 'm' + i);
    for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(dir, f)); }
    const f = path.join(dir, M.file), src = fs.readFileSync(f, 'utf8'), n = src.split(M.from).length - 1;
    if (n !== 1) { R.mutants.push({ name: M.name, caught: false, why: `its text is found ${n} times` }); continue; }
    fs.writeFileSync(f, src.replace(M.from, M.to));
    const j = run(dir, path.join(dir, 'r.json')), failed = j ? j.cases.filter(c => !c.ok).map(c => c.name) : ['(no report)'];
    R.mutants.push({ name: M.name, caught: M.expect.some(e => failed.includes(e)), failed, expected: M.expect });
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
R.ok = !!R.base && R.base.failed.length === 0 && R.mutants.every(m => m.caught);
for (const m of R.mutants) console.log(`${m.caught ? 'CAUGHT ' : 'MISSED '} ${m.name}${m.why ? ': ' + m.why : ''} (${(m.failed || []).join(', ')})`);
console.log(`SPEECH MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} - the layer ${R.base ? R.base.passed + ' of ' + R.base.cases : 'did not run'} on this tree; ${R.mutants.filter(m => m.caught).length} of ${R.mutants.length} mutants caught`);
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
process.exitCode = R.ok ? 0 : 1;
