/* Stage 3C QA2, QA2-4 - the QA1 browser probes and the first candidate's, run on QA2 (development only; never served).
 *
 *   node dev/stage-3c-qa2/regress/run.js [--game DIR] [--out DIR] [--only NAME[,NAME]] [--generate-only]
 *
 * 1. Writes adapted copies next to this file from the originals, which stay untouched:
 *      dev/stage-3c-qa1/probe_q1..q5.js and lifecycle.js        -> regress/probe_q1..q5.js, regress/lifecycle.js
 *      dev/stage-3c-qa1/first_candidate/probe_c1..c5.js (QA1's  -> regress/probe_c1..c5.js
 *        adapted copies of dev/stage-3c/probe_c1..c5.js)
 *      dev/tests/lifecycle_mp.py                                 -> regress/lifecycle_mp.py
 *    Every copy takes its helpers from ui_lib_gate.js (the same helpers, but each page passes the QA2 boot and its ready gate by
 *    one key press, as a player would, before the probe acts on it). Any further adaptation is listed below with its reason and
 *    must match the original exactly as many times as stated. No assertion is loosened.
 * 2. Runs the copies one after another and writes DIR/<name>.json / .log.
 * 3. Writes DIR/regression.json: every check of every probe - PASS, or FAIL with the QA2 decision that deliberately changed what
 *    it checks (supersededBy: the QA2 probe check covering the new behaviour; why). The first candidate's checks that QA1 already
 *    superseded keep QA1's reason (read from dev/stage-3c-qa1/evidence/q5/first_candidate/first_candidate_probes.json). A timing-
 *    sensitive check that also fails on QA1 itself under this software renderer is listed with that evidence (ARTIFACTS). A failure
 *    with no listed reason, or a probe that crashed, fails the run. Exit 0 when the run is clean. */
'use strict';
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const HERE = __dirname, ROOT = path.join(HERE, '..', '..', '..');
const GAME = path.resolve(opt('game') || ROOT), OUT = path.resolve(opt('out') || path.join(HERE, '..', 'evidence', 'q4', 'regress'));
const ONLY = opt('only') ? opt('only').split(',') : null;
const SHIM = { from: "require('../stage-3c/ui_lib.js')", to: "require('./ui_lib_gate.js')", n: 1, why: 'helpers from ui_lib_gate.js: each page passes the QA2 boot and its ready gate (one key press, as a player would) before the probe acts on it' };
const SHIM_C = { from: "require('../../stage-3c/ui_lib.js')", to: "require('./ui_lib_gate.js')", n: 1, why: SHIM.why };
const GAMEDIR = { from: "path.join(__dirname, '..', '..')", to: "path.join(__dirname, '..', '..', '..')", n: 1, why: 'the same default game folder (the repository root) from the copy\'s location' };
const LOGO_WHY = 'QA2-2: the title is the user\'s logo (an image, #mmLogo) instead of QA1\'s two lines of lettering; ';
const SOURCES = {
  probe_q1: { src: 'dev/stage-3c-qa1/probe_q1.js', adapt: [SHIM, GAMEDIR,
    { from: "const ttl = glyphs('#mmTitle .b'), ttlA = glyphs('#mmTitle .a')",
      to: "const lg = (() => { const b = document.getElementById('mmLogo').getBoundingClientRect(), k = b.width / 2048; return { x: b.left + 569 * k, y: b.top + 460 * k, w: 912 * k, h: 205 * k, r: b.left + 1481 * k, b: b.top + 665 * k }; })(), ttl = lg, ttlA = lg", n: 1,
      why: LOGO_WHY + 'the lettering\'s own box - the opaque glyphs of the PNG, x 569-1480 and y 460-664 of its 2048 x 1152 - is measured in place of QA1\'s two text lines\' glyph boxes. The composition checks themselves are unchanged' },
    { from: "const all = [...document.querySelectorAll('#menu *')]", to: "const all = [...document.querySelectorAll('#menu *:not(#mmLogo)')]", n: 1,
      why: LOGO_WHY + 'the image\'s own box includes the PNG\'s fully transparent surround, which the title box clips (it is invisible, takes no pointer and adds no overflow); the visible sign - the title box - stays in the off-screen and overlap checks, and the page still may not scroll sideways' }], port: 9910 },
  probe_q2: { src: 'dev/stage-3c-qa1/probe_q2.js', adapt: [SHIM, GAMEDIR], port: 9920 },
  probe_q3: { src: 'dev/stage-3c-qa1/probe_q3.js', adapt: [SHIM, GAMEDIR], port: 9930 },
  probe_q4: { src: 'dev/stage-3c-qa1/probe_q4.js', adapt: [SHIM, GAMEDIR], port: 9940, shots: true },
  probe_q5: { src: 'dev/stage-3c-qa1/probe_q5.js', adapt: [SHIM, GAMEDIR], port: 9950, shots: true },
  lifecycle: { src: 'dev/stage-3c-qa1/lifecycle.js', adapt: [SHIM, GAMEDIR], port: 9960 },
  probe_c1: { src: 'dev/stage-3c-qa1/first_candidate/probe_c1.js', adapt: [SHIM_C,
    { from: "getComputedStyle(t.querySelector('span')).animationName", to: "getComputedStyle(t.querySelector('.mm-logo')).animationName", n: 1,
      why: LOGO_WHY + 'the title\'s occasional hum (the same mmHum keyframes) now dims the image, so the forced hum is read from it' },
    { from: "document.querySelector('#mmTitle .b').getBoundingClientRect()", to: "document.querySelector('#mmTitle').getBoundingClientRect()", n: 1,
      why: LOGO_WHY + 'the title\'s right edge is the logo\'s sign box' }], port: 9970, qa1: true },
  probe_c2: { src: 'dev/stage-3c-qa1/first_candidate/probe_c2.js', adapt: [SHIM_C], port: 9972, qa1: true },
  probe_c3: { src: 'dev/stage-3c-qa1/first_candidate/probe_c3.js', adapt: [SHIM_C], port: 9974, qa1: true },
  probe_c4: { src: 'dev/stage-3c-qa1/first_candidate/probe_c4.js', adapt: [SHIM_C,
    { from: "getComputedStyle(t.querySelector('span')).animationName", to: "getComputedStyle(t.querySelector('.mm-logo')).animationName", n: 3,
      why: LOGO_WHY + 'the title\'s occasional hum (the same mmHum keyframes) now dims the image, so the forced hum is read from it' }], port: 9976, qa1: true },
  probe_c5: { src: 'dev/stage-3c-qa1/first_candidate/probe_c5.js', adapt: [SHIM_C], port: 9978, qa1: true, shots: true },
  lifecycle_mp: { src: 'dev/tests/lifecycle_mp.py', py: true, port: 9988, adapt: [
    { from: "ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))",
      to: "ROOT=os.environ.get('GAME') or os.path.join(_HERE,'..','..','..')", n: 1, why: 'the game folder from the copy\'s location (or GAME)' },
    { from: "async def main():", to: "async def pass_boot(P):\n    # QA2: wait for the boot; pass the ready gate with one key press where the browser wants a gesture (as a player would)\n" +
        "    for _ in range(1200):\n        st=await P.evaluate(\"()=>window.__boot?[__boot.state(),!!(window.__ui&&__ui.boot&&__ui.boot().gate)]:'none'\")\n" +
        "        if st=='none' or st[0] in ('menu','error','run','playing'): return st\n        if st[0]=='ready' and st[1]: await P.keyboard.press('Space')\n        await P.wait_for_timeout(100)\n" +
        "async def main():", n: 1, why: 'a helper that waits for the QA2 boot and passes its ready gate' },
    { from: "await P.goto(f'http://localhost:{PORT}/?room=life'); await P.wait_for_timeout(2200);", to: "await P.goto(f'http://localhost:{PORT}/?room=life'); await pass_boot(P); await P.wait_for_timeout(2200);", n: 1,
      why: 'QA2: the menu (and the name field) is shown only once the boot has finished and the ready gate is passed' }] }
};
/* QA2 decisions that deliberately change what an older check measures: the QA2 check that covers the new behaviour, and why */
const SUPERSEDED = {
  probe_q1: {
    'before any press: no audio context, no theme request, the theme waits': {
      supersededBy: 'probe_b3: "a browser that wants a gesture: the ready gate is black but for one line ... the music is already downloaded and decoded ... but has not begun, its context suspended" and "the first real key (A) starts the music and reveals the menu in the same step"',
      why: 'QA2 decision 3-5 (the menu and the theme start together): the theme is downloaded and decoded during the black boot and begins with the menu\'s reveal, so by the time the menu is up there is an audio context, the two requests were made, and the theme plays. QA1 fetched nothing until the first press on an already visible menu' },
    'a run started straight from ENTER (the press that starts the run) loads and plays no theme': {
      supersededBy: 'probe_b3: "the music fades out over 1 s at ENTER (a linear ramp from its level, then its sources stop and its context is suspended); the game\'s own audio graph exists only now"',
      why: 'QA2 decision 5: the theme plays from the moment the menu shows, so a run started straight away (PLAY, then ENTER LEVEL 0) fades it out like any ENTER. Its downloads happened during the boot. QA1 had loaded nothing before that first press' } }
};
/* timing-sensitive checks that fail on QA1 itself too, under this machine's software renderer (the original probe, unchanged, on the
   QA1 tree): listed with the evidence; such a check failing is not a QA2 change. They pass on other runs, on both builds. */
const ARTIFACTS = {
  probe_q3: {
    'as a run begins: THRESHOLD / LEVEL 0, the objective and a line of the player\'s keys appear, then fade away (gone after about 6 s)': {
      artifact: 'dev/stage-3c-qa2/evidence/q4/q3_timing/: QA1\'s own dev/stage-3c-qa1/probe_q3.js on the QA1 tree (5f30e28) and the QA2 copy, three runs each, interleaved',
      why: 'The reveal is three chained timers (0.45 s + 3.8 s + 1.3 s = 5.55 s); the probe looks once, 7.3 s after the HUD appears. Under the software renderer each timer fires up to a frame late (300-700 ms frames), so the reveal is sometimes still fading at 7.3 s - on QA1 as on QA2 (measured in play: the reveal gone at 7.7-7.8 s on QA1, 6.7-6.9 s on QA2). QA2 changes no HUD or reveal code (hud.js unchanged; the reveal code in ui.js is QA1\'s)' } }
};
const qa1Sup = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/stage-3c-qa1/evidence/q5/first_candidate/first_candidate_probes.json'), 'utf8')).probes; } catch (e) { return {}; } })();
const names = Object.keys(SOURCES).filter(n => !ONLY || ONLY.includes(n));
const adapted = {};
for (const n of names) {
  const S = SOURCES[n]; let src = fs.readFileSync(path.join(ROOT, S.src), 'utf8');
  for (const a of S.adapt) { const k = src.split(a.from).length - 1; if (k !== a.n) throw new Error(`${n}: "${a.from.slice(0, 70)}" matched ${k} times, expected ${a.n}`); src = src.split(a.from).join(a.to); }
  const why = S.adapt.map(a => a.why);
  const head = S.py ? `# ADAPTED COPY of ${S.src} for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.\n` + why.map(w => `#   - ${w}\n`).join('')
    : `/* ADAPTED COPY of ${S.src} for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.\n` + why.map(w => ` *   - ${w}\n`).join('') + ' */\n';
  fs.writeFileSync(path.join(HERE, n + (S.py ? '.py' : '.js')), head + src);
  adapted[n] = why;
}
if (argv.includes('--generate-only')) { console.log('adapted copies written'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const probes = {}; let clean = true;
for (const n of names) {
  const S = SOURCES[n], out = path.join(OUT, n + '.json'); try { fs.unlinkSync(out); } catch (e) { }
  const t0 = Date.now();
  const r = S.py ? spawnSync('python3', [path.join(HERE, n + '.py'), path.join(OUT, n + '_out')], { encoding: 'utf8', timeout: 1800000, maxBuffer: 64 << 20, env: Object.assign({}, process.env, { PORT: String(S.port), GAME }) })
    : spawnSync('node', [path.join(HERE, n + '.js'), '--game', GAME, '--port', String(S.port), '--out', out].concat(S.shots ? ['--shots', path.join(OUT, n + '_shots')] : []), { encoding: 'utf8', timeout: 2400000, maxBuffer: 64 << 20 });
  const log = (r.stdout || '') + (r.stderr || ''); fs.writeFileSync(path.join(OUT, n + '.log'), log + `\nEXIT ${r.status}\n`);
  let R = null;
  if (S.py) { try { const j = JSON.parse(log.trim().split('\n').filter(l => l.startsWith('{')).pop()); R = { checks: [{ name: 'lifecycle_mp: NEW RUN, the start from the title, death -> RETRY (its own verdict)', ok: j.ok === true && r.status === 0, note: j }], errors: j.errors || [] }; fs.writeFileSync(out, JSON.stringify(j, null, 1) + '\n'); } catch (e) { } }
  else { try { R = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { } }
  if (R && n === 'lifecycle' && !R.checks) {                 // lifecycle.js records what it saw; its verdict, as QA1 read it (Q2)
    const m = R.menuVisitor || {}, sm = R.serverWhileVisitorInMenu || {}, a = R.afterEnter || {}, sa = R.serverAfterEnter || {};
    R.checks = [{ name: 'lifecycle.js: a visitor on the menu is not in the world (not started, hidden, no light, not drawn, no join; the server lists it inactive; the other player draws no one); ENTER LEVEL 0 puts it in with exactly one join (drawn, lit, active, seen)',
      ok: m.started === false && m.hideSelf === true && m.lightOn === false && m.avatarDrawn === false && m.joinsSent === 0 && sm.active === false && sm.observerPeerAvatars === 0
        && a.started === true && a.hideSelf === false && a.lightOn === true && a.avatarDrawn === true && a.joinsSent === 1 && sa.active === true && sa.observerPeerAvatars === 1 && !(R.errors || []).length,
      note: { menuVisitor: m, serverWhileVisitorInMenu: sm, afterEnter: a, serverAfterEnter: sa } }];
  }
  if (R && !Array.isArray(R.checks)) R = null;
  const crashed = !R || (R.errors || []).some(e => /^probe: |^record: /.test(e));
  const checks = (R ? R.checks : []).map(c => {
    if (c.ok) return { name: c.name, ok: true, note: c.note };
    const q2 = (SUPERSEDED[n] || {})[c.name] || (ARTIFACTS[n] || {})[c.name];
    const q1 = S.qa1 && ((qa1Sup[n] || {}).checks || []).find(x => x.name === c.name && x.supersededBy);
    return Object.assign({ name: c.name, ok: false }, q2 ? q2 : q1 ? { supersededBy: q1.supersededBy, why: q1.why, by: 'QA1' } : {}, { note: c.note });
  });
  const unexplained = checks.filter(c => !c.ok && !c.supersededBy && !c.artifact).map(c => c.name);
  if (crashed || unexplained.length) clean = false;
  const gate = (log.match(/\[ui_lib_gate\] navigations: .*/) || [null])[0];
  probes[n] = { source: S.src, checks, crashed, unexplained, adaptations: adapted[n], exit: r.status, seconds: Math.round((Date.now() - t0) / 1000), gate };
  console.log(`${n}: ${checks.filter(c => c.ok).length}/${checks.length} pass, ${checks.filter(c => !c.ok && c.supersededBy).length} superseded, ${checks.filter(c => !c.ok && c.artifact).length} timing (also on QA1), ${unexplained.length} unexplained${crashed ? ', CRASHED' : ''}  (${probes[n].seconds} s)${gate ? '  ' + gate : ''}`);
  for (const u of unexplained) console.log('   UNEXPLAINED FAIL ' + u);
}
const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, 'regression.json'), 'utf8')).probes; } catch (e) { return {}; } })();
const all = ONLY ? Object.assign({}, prev, probes) : probes;
const ok = Object.values(all).every(p => !p.crashed && !p.unexplained.length);
fs.writeFileSync(path.join(OUT, 'regression.json'), JSON.stringify({ game: GAME, originals: 'unchanged (dev/stage-3c-qa1/, dev/stage-3c-qa1/first_candidate/, dev/tests/)', copies: 'dev/stage-3c-qa2/regress/', ok, probes: all, written: new Date().toISOString() }, null, 1) + '\n');
console.log(ok ? 'REGRESSION: CLEAN (every check passes or is a listed supersession)' : 'REGRESSION: PROBLEMS');
process.exit(ok && clean ? 0 : 1);
