#!/usr/bin/env node
/* Stage 3H continuation C4 - the port checks' own sensitivity (development only; needs rolldown: --rolldown DIR or TFB_ROLLDOWN, the
 * client build's install, as c4_alpha_all.mjs does).
 *
 *   node dev/stage-3h-modernization/tools/c4_port_mutants.mjs --rolldown DIR [--out FILE.json]
 *
 * c4_alpha_all.mjs says each ported module is the shipped program "modulo names and a normal form"; c4_css_check.mjs says the readable
 * later stylesheet is the shipped one "modulo what CSS ignores".  Each must still see a real change.  Every mutant below is one small
 * edit of a COPY of one port file, in a scratch folder (the tree is never written), of a kind a port could get wrong: a number, a
 * comparison, && for ||, two statements in the other order, a statement dropped, another variable read, two arguments swapped, a
 * property's name, == for === where the normal form must keep them apart; most of them where the continuation pack asks for care
 * (B02 stamina, B07 the capture sound, B10-B11 the lights, B12 NEW RUN's fall, B28-B30 the walls' receivers).  c4_alpha_all.mjs runs
 * with its config's entries for that file pointed at the copy, and must call them DIFFERENT; before that, the same run on an unchanged
 * copy must call them SAME (the control: else the copying, not the edit, could be what is caught).  The stylesheet's mutants (a value,
 * a declaration dropped, a selector, two rules in the other order, !important dropped, an @media condition, a custom property's value):
 * c4_css_check.mjs --later on the copy must say DIFFERENT, and SAME on an unchanged copy.  Each edit's text must occur exactly once in
 * its file.  Exit 0 only when every control passes and every mutant is caught. */
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawnSync } from 'child_process'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..', '..', '..'), GAME = 'src/core/client/game/';
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const RD = ARG.rolldown || process.env.TFB_ROLLDOWN;
if (!RD) { console.error('PORT MUTANTS: NOT RUN - needs rolldown: --rolldown DIR or TFB_ROLLDOWN'); process.exit(2); }

const CODE = [
  { id: 'B02-drain', file: 'shared/movement.ts', old: 'player.stamina-23*dt', now: 'player.stamina-23.5*dt', what: 'a number: a sprint drains 23.5 stamina a second, not 23' },
  { id: 'B02-recover', file: 'shared/movement.ts', old: 'player.stamina>=32', now: 'player.stamina>32', what: 'a comparison: >= became >' },
  { id: 'B02-and-or', file: 'shared/movement.ts', old: 'if(player.exhausted&&player.stamina>=32)', now: 'if(player.exhausted||player.stamina>=32)', what: '&& became ||' },
  { id: 'B02-order', file: 'shared/movement.ts', old: ' if(player.exhausted&&player.stamina>=32)player.exhausted=false;\n let sprinting=!!(sprint&&moving&&!player.exhausted&&player.stamina>.1);',
    now: ' let sprinting=!!(sprint&&moving&&!player.exhausted&&player.stamina>.1);\n if(player.exhausted&&player.stamina>=32)player.exhausted=false;', what: 'two statements in the other order: the sprint test before the recovery' },
  { id: 'B07-hits', file: 'client/death.ts', old: 'Hound:[.24,.74,1.2,1.7]', now: 'Hound:[.24,.74,1.25,1.7]', what: "a time in the Hound's capture: its third hit 50 ms later" },
  { id: 'B07-compressor', file: 'client/audio.ts', old: 'bus.ratio.value=5;', now: 'bus.ratio.value=6;', what: "the capture sound's compressor ratio" },
  { id: 'B10-B11-headlamp', file: 'shared/equipment.ts', old: "headlamp:{label:'Headlamp',range:262,", now: "headlamp:{label:'Headlamp',range:263,", what: "the headlamp's range" },
  { id: 'B12-landing', file: 'client/arrival.ts', old: 'landing=.62', now: 'landing=.63', what: "the moment a fall lands" },
  { id: 'B12-dropped', file: 'client/arrival.ts', old: 'person.gear.visible=false;', now: '', what: "a statement dropped: a vanishing wanderer's light would stay drawn" },
  { id: 'B12-binding', file: 'client/arrival.ts', old: 'const u=(p-landing)/(1-landing),b=', now: 'const u=(t-landing)/(1-landing),b=', what: 'another variable in scope read (t for p)' },
  { id: 'B12-arguments', file: 'client/arrival.ts', old: "noiseBurst([250,1400],'bandpass',.8,.07,.8)", now: "noiseBurst([1400,250],'bandpass',.8,.07,.8)", what: "two values swapped: the fall's whoosh sweeps down, not up" },
  { id: 'B12-member', file: 'client/arrival.ts', old: 'person.hat.alpha=1;', now: 'person.hat.visible=1;', what: "a property's name" },
  { id: 'B30-mitre', file: 'shared/vision.ts', old: 'if(f.n1>=0&&seenToEnd(seen.get(f.n1),f.c1))v+=2;', now: 'if(f.n1>=0&&seenToEnd(seen.get(f.n1),f.c1))v+=1;', what: "a convex corner's choice of band ends" },
  { id: 'hud-label', file: 'client/main.ts', old: "'SPRINTING'", now: "'SPRINTlNG'", what: 'a string: the pace label' },
  { id: 'loose-equality', file: 'client/main.ts', old: "if(customizing){if(e.code==='Escape')", now: "if(customizing){if(e.code=='Escape')", what: "=== became == with a string: the normal form makes them one only when an operand is a number" },
  { id: 'corpse-owner', file: 'client/render.ts', old: 'addCorpse({ownerId:player.id,', now: 'addCorpse({ownerId:player.name,', what: "a corpse recorded under the wanderer's name, not its id" },
];
const LATER = 'client/style-after-v11.css';
const CSS = [
  { id: 'css-value', old: '.staminaHud {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;', now: '.staminaHud {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;', what: 'a value' },
  { id: 'css-dropped', old: '  min-width: 22px;\n', now: '', what: 'a declaration dropped' },
  { id: 'css-selector', old: '.staminaHud>b {\n  min-width: 22px;', now: '.staminaHud b {\n  min-width: 22px;', what: 'a selector: a child became a descendant' },
  { id: 'css-order', old: '.staminaHud>b {\n  min-width: 22px;\n  color: #f3e7a7;\n  font-weight: 500;\n}\n.staminaHud i {\n  width: 72px;\n  height: 5px;\n  background: #201b10;\n  border: 1px solid #9b895155;\n  display: inline-block;\n  overflow: hidden;\n}',
    now: '.staminaHud i {\n  width: 72px;\n  height: 5px;\n  background: #201b10;\n  border: 1px solid #9b895155;\n  display: inline-block;\n  overflow: hidden;\n}\n.staminaHud>b {\n  min-width: 22px;\n  color: #f3e7a7;\n  font-weight: 500;\n}', what: 'two rules in the other order' },
  { id: 'css-important', old: '  opacity: 1!important;', now: '  opacity: 1;', what: '!important dropped' },
  { id: 'css-media', old: '@media (prefers-reduced-motion:reduce) {', now: '@media (prefers-reduced-motion:no-preference) {', what: "an @media rule's condition" },
  { id: 'css-custom-property', old: '  --hv:#f3e7a7;', now: '  --hv:#f3e7a8;', what: "a custom property's value" },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'c4-port-mutants-'));
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'c4_alpha_modules.json'), 'utf8'));
const node = (args) => { const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 }); return { code: r.status, text: (r.stdout || '') + (r.stderr || '') }; };
const once = (text, old, where) => { const n = text.split(old).length - 1; if (n !== 1) throw new Error(`${where}: the edit's text occurs ${n} times, not once: ${JSON.stringify(old.slice(0, 80))}`); };
/* the alpha check on a copy of one port file (its text given): the config's rows for that file */
let runs = 0;
function alpha(file, text, tag) {
  const dir = path.join(TMP, tag); fs.mkdirSync(dir, { recursive: true });
  const copy = path.join(dir, path.basename(file)); fs.writeFileSync(copy, text);
  const cfg = { ...CFG, modules: CFG.modules.filter(m => m.port === GAME + file).map(m => ({ ...m, port: copy })) };
  if (!cfg.modules.length) throw new Error(`${file}: no entry of c4_alpha_modules.json`);
  const cf = path.join(dir, 'config.json'), out = path.join(dir, 'alpha.json'); fs.writeFileSync(cf, JSON.stringify(cfg));
  const r = node([path.join(HERE, 'c4_alpha_all.mjs'), '--config', cf, '--only', copy, '--rolldown', RD, '--out', out]); runs++;
  const j = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null, rows = j ? j.modules.filter(m => m.port === copy) : [];
  return { rows: rows.length, same: rows.length > 0 && rows.every(m => m.ok), problem: (rows.find(m => !m.ok) || { problems: [] }).problems[0] || (j ? null : r.text.slice(-300)) };
}
function css(text, tag) {
  const dir = path.join(TMP, tag); fs.mkdirSync(dir, { recursive: true });
  const copy = path.join(dir, 'later.css'), out = path.join(dir, 'css.json'); fs.writeFileSync(copy, text);
  node([path.join(HERE, 'c4_css_check.mjs'), '--later', copy, '--out', out]); runs++;
  const j = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
  return { same: !!j && j.laterVsFile === 'the same stylesheet', problem: j ? j.laterVsFile : 'no report' };
}

const R = { tool: 'dev/stage-3h-modernization/tools/c4_port_mutants.mjs', controls: [], mutants: [], ok: true };
try {
  for (const file of [...new Set(CODE.map(m => m.file))]) {
    const text = fs.readFileSync(path.join(REPO, GAME, file), 'utf8'), c = alpha(file, text, 'control-' + file.replace(/\W/g, '_'));
    R.controls.push({ check: 'c4_alpha_all.mjs', file: GAME + file, rows: c.rows, same: c.same }); if (!c.same) R.ok = false;
    console.log(`${c.same ? 'SAME     ' : 'DIFFERENT'} control: an unchanged copy of ${GAME + file} (${c.rows} config entries)${c.same ? '' : ': ' + c.problem}`);
    for (const m of CODE.filter(x => x.file === file)) {
      once(text, m.old, m.id);
      const r = alpha(file, text.replace(m.old, () => m.now), m.id), caught = r.rows > 0 && !r.same;
      R.mutants.push({ id: m.id, check: 'c4_alpha_all.mjs', file: GAME + file, what: m.what, caught, first: r.problem ? String(r.problem).slice(0, 300) : null }); if (!caught) R.ok = false;
      console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${m.id}: ${m.what}${caught && r.problem ? '\n           ' + String(r.problem).slice(0, 200) : ''}`);
    }
  }
  const later = fs.readFileSync(path.join(REPO, GAME, LATER), 'utf8'), c = css(later, 'control-css');
  R.controls.push({ check: 'c4_css_check.mjs', file: GAME + LATER, same: c.same }); if (!c.same) R.ok = false;
  console.log(`${c.same ? 'SAME     ' : 'DIFFERENT'} control: an unchanged copy of ${GAME + LATER}${c.same ? '' : ': ' + c.problem}`);
  for (const m of CSS) {
    once(later, m.old, m.id);
    const r = css(later.replace(m.old, () => m.now), m.id), caught = !r.same;
    R.mutants.push({ id: m.id, check: 'c4_css_check.mjs', file: GAME + LATER, what: m.what, caught, first: caught ? String(r.problem).slice(0, 300) : null }); if (!caught) R.ok = false;
    console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${m.id}: ${m.what}${caught ? '\n           ' + String(r.problem).slice(0, 200) : ''}`);
  }
} catch (e) { R.ok = false; R.error = String(e && e.message || e); console.log('PORT MUTANTS ERROR: ' + R.error); }
fs.rmSync(TMP, { recursive: true, force: true });
R.runs = runs;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`PORT MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} (${R.mutants.filter(m => m.caught).length} of ${R.mutants.length} caught; ${R.controls.filter(c => c.same).length} of ${R.controls.length} controls SAME)`);
process.exitCode = R.ok ? 0 : 1;
