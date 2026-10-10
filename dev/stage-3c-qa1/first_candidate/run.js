/* Stage 3C QA1, Q5 - the first candidate's five browser probes (dev/stage-3c/probe_c1..c5.js), run on QA1 (development only; never served).
 *
 *   node dev/stage-3c-qa1/first_candidate/run.js [--game DIR] [--out DIR] [--generate-only]
 *
 * 1. Writes adapted copies next to this file (probe_c1..c5.js) from the originals in dev/stage-3c/, which stay untouched. An adaptation
 *    only changes how a probe reaches something QA1 moved: a selector, or the extra press QA1's entry needs before ENTER LEVEL 0.
 *    Every adaptation is listed below with its reason, must match the original exactly as many times as stated, and is recorded in
 *    the output. No assertion is loosened, except one regular expression that accepts the stick's touch wording besides the pad's.
 * 2. Runs the five copies on the game (one after another) and writes DIR/probe_cN.json / .log.
 * 3. Writes DIR/first_candidate_probes.json: every check of every probe, PASS, or FAIL with the QA1 decision that deliberately
 *    changed what it checks (supersededBy: the QA1 probe check that covers the new behaviour; why: what changed). A failure with no
 *    listed supersession, or a probe that crashed, fails the run. Exit 0 when the run is clean. */
'use strict';
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const HERE = __dirname, ORIG = path.join(HERE, '..', '..', 'stage-3c');
const GAME = path.resolve(opt('game') || path.join(HERE, '..', '..', '..')), OUT = path.resolve(opt('out') || path.join(HERE, 'out'));
const HUM = "(t => (t.classList.add('hum'), getComputedStyle(t.querySelector('span')).animationName))(document.getElementById('mmTitle'))";
const COMMON = [
  { from: "const U = require('./ui_lib.js');", to: "const U = require('../../stage-3c/ui_lib.js');", n: 1, why: 'the copy lives in dev/stage-3c-qa1/first_candidate/; it uses the first candidate\'s own helpers' },
  { from: "path.join(__dirname, '..', '..')", to: "path.join(__dirname, '..', '..', '..')", n: 1, why: 'the same default game folder (the repository root) from the copy\'s location' }];
const ADAPT = {
  probe_c1: [
    { from: "items: [...document.querySelectorAll('#menu .mm-item')].map(b => b.dataset.go)", to: "items: [...document.querySelectorAll('#menu #mmPlay, #menu .mm-item')].map(b => b.dataset.go)", n: 1,
      why: 'QA1 Q1: PLAY is the menu\'s own large button (#mmPlay) above the CUSTOMIZE / SETTINGS / CREDITS row; the four entries are the same' },
    { from: "await P.click('#menu .mm-loadout [data-go=\"customize\"]');", to: "await P.click('#menu .mm-kit [data-go=\"customize\"]');", n: 1,
      why: 'QA1 Q1: the loadout row\'s Change is now "Change light" under "Your light" in the left rail (data-sub="loadout")' },
    { from: "await P.fill('#name', 'Probe'); await P.focus('#name'); await P.keyboard.press('Enter');", to: "await P.fill('#name', 'Probe'); await P.focus('#name'); await P.keyboard.press('Enter'); await sleep(800); await P.keyboard.press('Enter');", n: 1,
      why: 'QA1 Q1: Enter in the name field opens the entry with ENTER LEVEL 0 focused (one press no longer starts a run); the second Enter presses ENTER LEVEL 0. The check still requires exactly one join' },
    { from: "getComputedStyle(document.querySelector('.mm-fixture i')).animationName", to: HUM, n: 1,
      why: 'QA1 Q1: the first candidate\'s flickering fixture is now the title\'s occasional hum; the copy forces a hum and reads its animation (none under reduced motion)' },
    { from: "items: [...document.querySelectorAll('#menu .mm-item')].map(b => { const r", to: "items: [...document.querySelectorAll('#menu #mmPlay, #menu .mm-item')].map(b => { const r", n: 1,
      why: 'QA1 Q1: the four menu entries are #mmPlay and the row' },
    { from: "document.querySelector('.mm-title h1 .b')", to: "document.querySelector('#mmTitle .b')", n: 1, why: 'QA1 Q1: the title is the h1 itself (#mmTitle)' },
    { from: "const m = await P.evaluate(() => { const mm = document.getElementById('menu');", to: "await P.click('#mmPlay'); await sleep(900); await P.evaluate(() => { window.__enterH = document.getElementById('enter').getBoundingClientRect().height; }); await P.keyboard.press('Escape'); await sleep(900);\n      const m = await P.evaluate(() => { const mm = document.getElementById('menu');", n: 1,
      why: 'QA1 Q1: ENTER LEVEL 0 is shown by PLAY (the entry); its height is measured there, then Escape closes the entry' },
    { from: "enterH: document.getElementById('enter').getBoundingClientRect().height", to: "enterH: window.__enterH", n: 1, why: 'the height measured with the entry open (above)' },
    { from: "/on-screen/.test(m.note)", to: "/on-screen|Touch low on the left and drag/.test(m.note)", n: 1,
      why: 'QA1 Q4: the touch wording names the stick ("Touch low on the left and drag to move") instead of the on-screen pad' }],
  probe_c2: [],
  probe_c3: [],
  probe_c4: [
    { from: "getComputedStyle(document.querySelector('.mm-fixture i')).animationName", to: HUM, n: 3,
      why: 'QA1 Q1: the fixture\'s flicker is now the title\'s occasional hum (the same mmHum keyframes); the copy forces a hum and reads its animation' }],
  probe_c5: [
    { from: "await P.click('#enter'); await sleep(2000);", to: "await P.click('#mmPlay'); await sleep(900); await P.click('#enter'); await sleep(2000);", n: 1,
      why: 'QA1 Q1: after END, ENTER LEVEL 0 is in the entry that PLAY opens. The check still requires exactly one join' },
    { from: "const menu = await vis('#enter'), play = await vis('#menu .mm-item[data-go=\"play\"]');", to: "const play = await vis('#mmPlay'); await P.click('#mmPlay'); await sleep(900); const menu = await vis('#enter'); await P.keyboard.press('Escape'); await sleep(900);", n: 1,
      why: 'QA1 Q1: PLAY is #mmPlay; ENTER LEVEL 0 is measured in the entry PLAY opens (then Escape closes it)' }]
};
/* first-candidate checks that QA1 deliberately changed: the QA1 decision, and the QA1 probe check that covers the new behaviour */
const SUPERSEDED = {
  probe_c1: {
    'a HUD setting changes the model, the body class and fb_settings_v1, and switches back': {
      supersededBy: 'probe_q3: "fb_settings_v1 migration: ... no save: coordinates off" and "calm play shows almost only the world: ... coordinates ..."',
      why: 'QA1 Q3: coordinates are off by default (settings v2), so the first click turns them on. The probe\'s own readings show the switch still drives the model, fb_settings_v1, aria-checked and the body class, and switches back' } },
  probe_c2: {
    'desktop: objective, status, key hints, location, coordinates, header and connection line are all on screen': {
      supersededBy: 'probe_q3: "calm play shows almost only the world ...", "as a run begins: THRESHOLD / LEVEL 0, the objective and a line of the player\'s keys appear, then fade away", "the pause screen keeps what left the HUD: the objective and the connection line"',
      why: 'QA1 Q3 (the minimal HUD): calm play shows the world, stamina only while it changes, and PAUSE. The objective, LEVEL 0 and the keys are shown as a run begins and on the pause screen; the connection line on the pause screen; coordinates are an option, off by default' },
    'HUD size, colour, coordinates, key hints and title settings drive the new HUD (and reset)': {
      supersededBy: 'probe_q3: "fb_settings_v1 migration ..." and probe_q5: "the HUD settings still drive what the HUD shows ..."',
      why: 'QA1 Q3: the probe measures the permanent objective block (gone: its height reads 0) and expects coordinates back on after Reset HUD (now off by default). The colour and the hidden switches pass in its own readings; size, opacity and colour on the QA1 HUD are checked by probe_q5' },
    'Night Vision Camcorder raised: the viewfinder takes over (location hidden, objective kept)': {
      supersededBy: 'probe_q3: "calm play shows almost only the world ..." and "the pause screen keeps what left the HUD: the objective ..."',
      why: 'QA1 Q3: no permanent objective in play with any device; the location stays hidden while the camcorder is raised (passes in the probe\'s readings), and the objective is on the pause screen and in the run-begins reveal' },
    'touch portrait: pad, RUN, CROUCH, LIGHT and INV on screen; key hints and the Esc label hidden': {
      supersededBy: 'probe_q4: "the stick reads eight ways ... and the old pad is hidden" and "touch layouts at 360x640, 390x844 ...: buttons, PAUSE and stamina inside the safe areas ..."',
      why: 'QA1 Q4: the D-pad is replaced by the floating stick (the pad is hidden, not removed). RUN, CROUCH, LIGHT and INV are on screen and the key hints hidden in the probe\'s readings' },
    'touch landscape: pad, RUN, CROUCH, LIGHT and INV on screen; key hints and the Esc label hidden': {
      supersededBy: 'probe_q4: "the stick reads eight ways ... and the old pad is hidden" and "touch layouts ... 844x390 on its side ..."',
      why: 'QA1 Q4: the D-pad is replaced by the floating stick. RUN, CROUCH, LIGHT and INV are on screen and the key hints hidden in the probe\'s readings' } },
  probe_c4: {
    'a pre-3C fb_settings_v1 save loads unchanged, gains rm = "auto", and is written back complete': {
      supersededBy: 'probe_q3: "fb_settings_v1 migration: an old save keeps its choices ... but loses the old coordinates default and is written back as v2"',
      why: 'QA1 Q3: an old save has coordinates switched off once (the old default was on) and is written back with v: 2. In the probe\'s readings every other field is kept, rm = "auto" is added and the save is written back' } }
};
const NAMES = ['probe_c1', 'probe_c2', 'probe_c3', 'probe_c4', 'probe_c5'];
const adapted = {};
for (const p of NAMES) {
  let src = fs.readFileSync(path.join(ORIG, p + '.js'), 'utf8'); const list = COMMON.concat(ADAPT[p]);
  for (const a of list) { const n = src.split(a.from).length - 1; if (n !== a.n) throw new Error(`${p}: "${a.from.slice(0, 70)}" matched ${n} times, expected ${a.n}`); src = src.split(a.from).join(a.to); }
  const head = `/* ADAPTED COPY of dev/stage-3c/${p}.js for Stage 3C QA1 - written by dev/stage-3c-qa1/first_candidate/run.js; do not edit by hand.\n` +
    ADAPT[p].map(a => ` *   - ${a.why}\n`).join('') + (ADAPT[p].length ? '' : ' *   (no change besides the helper path)\n') + ' */\n';
  fs.writeFileSync(path.join(HERE, p + '.js'), head + src);
  adapted[p] = ADAPT[p].map(a => a.why);
}
if (argv.includes('--generate-only')) { console.log('adapted copies written'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const probes = {}; let clean = true;
NAMES.forEach((p, i) => {
  const out = path.join(OUT, p + '.json'); try { fs.unlinkSync(out); } catch (e) { }
  const r = spawnSync('node', [path.join(HERE, p + '.js'), '--game', GAME, '--port', String(9661 + i), '--out', out], { encoding: 'utf8', timeout: 1500000, maxBuffer: 64 << 20 });
  fs.writeFileSync(path.join(OUT, p + '.log'), (r.stdout || '') + (r.stderr || ''));
  let R = null; try { R = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { }
  const crashed = !R || (R.errors || []).some(e => /^probe: /.test(e));
  const checks = (R ? R.checks : []).map(c => { const s = !c.ok && (SUPERSEDED[p] || {})[c.name]; return Object.assign({ name: c.name, ok: c.ok }, s ? s : {}, { note: c.note }); });
  const unexplained = checks.filter(c => !c.ok && !c.supersededBy).map(c => c.name);
  if (crashed || unexplained.length) clean = false;
  probes[p] = { checks, crashed, unexplained, adaptations: adapted[p], exit: r.status };
  console.log(`${p}: ${checks.filter(c => c.ok).length}/${checks.length} pass, ${checks.filter(c => !c.ok && c.supersededBy).length} superseded, ${unexplained.length} unexplained${crashed ? ', CRASHED' : ''}`);
  for (const n of unexplained) console.log('   UNEXPLAINED FAIL ' + n);
});
const res = { game: GAME, original: 'dev/stage-3c/probe_c1..c5.js (unchanged)', copies: 'dev/stage-3c-qa1/first_candidate/probe_c1..c5.js', ok: clean, probes, written: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, 'first_candidate_probes.json'), JSON.stringify(res, null, 1) + '\n');
console.log(clean ? 'FIRST CANDIDATE PROBES: CLEAN (every check passes or is a listed QA1 supersession)' : 'FIRST CANDIDATE PROBES: PROBLEMS');
process.exit(clean ? 0 : 1);
