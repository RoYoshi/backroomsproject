/* Stage 3H continuation (C3b) - the page's multi-owner scripts, B++'s against this tree's, each in the same closed page (development only;
 * the gate's page_scripts step).
 *
 *   node dev/tools/gate/golden/page_scripts.js [--old-ref 143b63f] [--only move.js,ents.js] [--out FILE.json] [--tree DIR] [--missed 1]
 *   node dev/tools/gate/golden/page_scripts.js --mutants golden/page_mutants.js [--out FILE.json]   (each seam mutant must be caught)
 *   node dev/tools/gate/golden/page_scripts.js --perf 7 [--out FILE.json]   (the scenes' real time, A/B against B++ and A/A)
 *
 * C3b made world.js, move.js, camcorder.js, glitch.js and ents.js of modules: their outputs changed bytes, so their behaviour is compared
 * instead.  world.js runs in Node (golden/world_diff.js).  Each of the other four is loaded into a real Chromium page twice - B++'s text
 * and this tree's (from its web root) - after the same environment:
 *   - Stage 3H0's cli_env.js: a fake clock and timers, seeded randomness, a recording Web Audio, recorded listeners;
 *   - golden/page_env.js: recording 2D canvases and Graphics, the page's elements, Level 0 from L.O.S.T.'s sim.level0.js;
 *   - B++'s world.js and dphys.js (the death simulation the entities draw);
 *   - the AI debug overlay's input as the server sends it, made here by B++'s own sim (from Git).
 * Then golden/page_scenes.js drives the script the way the bundle and mp.js do and records what it returns and leaves behind.  The two
 * traces (compared by digests of 2,000-line chunks; the first differing lines are shown), the page's elements and the errors must be
 * equal.  And each scene must reach its script: V8's own coverage counts the script's functions that ran.  On B++'s text, at most the
 * functions listed in UNRUN may stay unrun (each is dead code or an event the scene cannot stage), and this tree's text must leave exactly
 * as many unrun: a module's factory and its composition always run, so every function the scene reached on B++ it reaches here too. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..', '..'), HERE = __dirname, H0 = path.join(REPO, 'dev', 'stage-3h0', 'golden');
const ARG = { 'old-ref': '143b63ff42b88c6780c5043e0f61d64100f81f40' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const TREE = ARG.tree ? path.resolve(ARG.tree) : REPO, LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js')).forTree(TREE);
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const SCRIPTS = (ARG.only ? ARG.only.split(',') : ['move.js', 'camcorder.js', 'glitch.js', 'ents.js']);
/* the functions of B++'s scripts the scenes leave unrun, and why */
const UNRUN = {
  'move.js': { max: 1, why: 'sm: declared and never called' },
  'camcorder.js': { max: 2, why: 'snd.deny and snd.warn: declared and never called' },
  'glitch.js': { max: 0, why: '-' },
  'ents.js': { max: 2, why: 'the sound of a dropped light striking something (a death event the scene does not produce) and the Smiler\'s eye-contact line of a selected record' },
};
/* (C5) an old side on the modern layout (M8: --old-ref c34f0c2): the page's files are under public/, the server's built sim under
 * generated/server/; B++ and earlier keep both at the root */
const MODERN = (() => { try { execFileSync('git', ['-C', REPO, 'cat-file', '-e', `${ARG['old-ref']}:public/index.html`], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
const git = (p, server) => execFileSync('git', ['-C', REPO, 'show', `${ARG['old-ref']}:${MODERN ? (server ? 'generated/server/' : 'public/') : ''}${p}`]);
/* --mutants FILE: each seam mutant (golden/page_mutants.js) in a scratch copy of this tree's scripts; the differential of its script (this
 * tool with --tree and --only, or world_diff.js for world.js) must FAIL on it */
if (ARG.mutants) {
  const { spawnSync } = require('child_process'), list = require(path.resolve(ARG.mutants)), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c3b-mut-'));
  const R = { tool: 'dev/tools/gate/golden/page_scripts.js --mutants', mutants: [], ok: true };
  try {
    for (const m of list) {
      const d = path.join(tmp, m.id); fs.mkdirSync(path.join(d, 'public'), { recursive: true }); fs.mkdirSync(path.join(d, 'generated', 'server'), { recursive: true });
      for (const f of ['move.js', 'camcorder.js', 'glitch.js', 'ents.js', 'world.js', 'index.html']) fs.copyFileSync(path.join(LAYOUT.webRoot(), f), path.join(d, 'public', f));
      fs.copyFileSync(LAYOUT.at('world.js'), path.join(d, 'generated', 'server', 'world.js'));
      const f = path.join(d, 'public', m.file), t = fs.readFileSync(f, 'utf8');
      if (t.split(m.find).length !== 2) { R.ok = false; R.mutants.push({ id: m.id, error: 'its text is not found exactly once' }); console.log(`FAIL ${m.id}: its text is not found exactly once`); continue; }
      fs.writeFileSync(f, t.replace(m.find, m.repl));
      if (m.file === 'world.js') fs.copyFileSync(f, path.join(d, 'generated', 'server', 'world.js'));      // the build writes both copies from the same parts
      const args = m.file === 'world.js' ? [path.join(HERE, 'world_diff.js'), '--tree', d, '--old-ref', ARG['old-ref']] : [__filename, '--tree', d, '--only', m.file, '--old-ref', ARG['old-ref']];
      const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 600000 }), outText = (r.stdout || '') + (r.stderr || '');
      const caught = r.status === 1 && /(PAGE SCRIPTS|WORLD DIFF): (FAIL|DIFFERENT)/.test(outText);
      const first = outText.split('\n').find(l => /^(FAIL|DIFFERENT) /.test(l)) || '';
      R.mutants.push({ id: m.id, file: m.file, why: m.why, caught, exit: r.status, by: first.slice(0, 300) });
      if (!caught) R.ok = false;
      console.log(`${caught ? 'caught ' : 'MISSED '} ${m.id}: ${m.why}${caught ? '' : ' (exit ' + r.status + ')'}`);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`PAGE MUTANTS: ${R.ok ? 'PASS' : 'FAIL'} (${R.mutants.filter(x => x.caught).length} of ${list.length} seam mutants caught)`);
  process.exitCode = R.ok ? 0 : 1;
  return;
}
const level0 = fs.readFileSync(path.join(REPO, 'src', 'frameworks', 'lost', 'server', 'sim.level0.js'), 'utf8');
/* the AI debug overlay's input, as the server sends it: B++'s own sim (from Git; world seed 11, where the monsters hunt, search and
 * kill) with three wandering players for 180 s of sim time, its debug records and new log lines every 6 s.  Eye contact is rare in a
 * scripted run, so the last frame's first Smiler record is given some (marked fx: 1).  The same fixture serves both sides. */
function debugFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c3b-dbg-'));
  try {
    for (const f of ['sim', 'ai', 'world']) fs.writeFileSync(path.join(tmp, f + '.js'), git(f + '.js', true));
    const s = require(path.join(tmp, 'sim.js'))({ seed: 11 }), ps = [1, 2, 3].map(i => s.addPlayer(i)), frames = [];
    ps.forEach(p => s.join(p));
    ps.forEach((p, j) => { for (let k = 0; k < 60; k++) { const x = 960 + j * 60 + (k % 8) * 48, y = 3264 + Math.floor(k / 8) * 48; if (s.spawnOk(x, y)) { p.x = x; p.y = y; break; } } });
    let seq = 0, r = 11 * 13 + 5; const rand = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    for (let i = 1; i <= 180 * 60; i++) {
      for (const p of ps) if (!p.dead && p.active) { p.angle += .03; if (i % 20 === 0) { const g = rand() * Math.PI * 2, nx = p.x + Math.cos(g) * 40, ny = p.y + Math.sin(g) * 40; if (s.moveOk(p.x, p.y, nx, ny, 60)) { p.x = nx; p.y = ny; p.obsV = 150; s.gaitFloor(p, false); } } }
      s.step(1 / 60);
      if (i % 360 === 0) { const lg = s.logSince(seq); if (lg.length) seq = lg[lg.length - 1].s; frames.push({ dbg: s.debugInfo(), lg: lg.map(l => [l.s, l.t, l.x]), pf: { ms: .8 + frames.length / 10, mx: 2.5, kb: 3.1, se: 120, pa: 6, pl: 3 } }); }
    }
    const last = frames[frames.length - 1], sm = last.dbg.find(d => d.k === 'smiler');
    if (sm) { sm.fx = 1; sm.ec = [[1, 2.5], [2, .4]]; if (sm.sm) sm.sm.ec = [[1, 1.2]]; }
    return { frames };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
const FIX = debugFixture();
const LEVEL0_DEFS = { level0: JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'frameworks', 'lost', 'shared', 'level0.json'), 'utf8')), lights: JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'frameworks', 'pocket', 'shared', 'lights.json'), 'utf8')) };
const FILES = {
  'env.js': fs.readFileSync(path.join(H0, 'cli_env.js')), 'page_env.js': fs.readFileSync(path.join(HERE, 'page_env.js')), 'scenes.js': fs.readFileSync(path.join(HERE, 'page_scenes.js')),
  'world.js': git('world.js'), 'dphys.js': git('dphys.js'), 'fix.js': Buffer.from('window.__FIX = ' + JSON.stringify(FIX) + ';\n'),
  'level0.js': Buffer.from(`window.__level0 = (function () { const module = { exports: {} };\n${level0}\nreturn module.exports; })();\n` +
    `window.__level0Defs = ${JSON.stringify(LEVEL0_DEFS)};\n`),   // (C4c, M-003) the level's one definition, which the server's level module is given
};
const page = name => `<!doctype html><html><head><meta charset="utf-8"><title>c3b</title></head><body><canvas id="mp"></canvas><div id="dread"></div><div id="game"></div>` +
  `<div id="light"></div><div id="dialog"><p class="lore-credit">credit line</p></div><div id="sound">SOUND: ON</div><div id="touch"></div>` +
  `<script src="./env.js"></script><script src="./world.js"></script><script src="./level0.js"></script><script src="./page_env.js"></script>` +
  `<script src="./dphys.js"></script><script src="./fix.js"></script><script src="./${name}"></script><script src="./scenes.js"></script></body></html>`;
async function run(browser, name, body, lines) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e && e.message || e).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  const map = Object.assign({ 'h.html': Buffer.from(page(name)), [name]: body }, FILES);
  await p.route('http://c3b.test/**', route => { const f = new URL(route.request().url()).pathname.replace(/^\//, ''); if (!(f in map)) return route.fulfill({ status: 404, body: 'no' }); route.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : 'text/javascript', body: map[f] }); });
  await p.coverage.startJSCoverage({ resetOnNavigation: false });
  await p.goto('http://c3b.test/h.html', { waitUntil: 'load' });
  const r = await p.evaluate(([s, l]) => window.__RUN(s, l ? { lines: l } : null), [name.replace(/\.js$/, ''), lines || null]);
  /* what the scene reached of the script under test: its functions (by V8's own coverage) that ran at least once */
  const cov = (await p.coverage.stopJSCoverage()).find(e => e.url.endsWith('/' + name));
  const fns = cov ? cov.functions.filter(f => f.functionName !== '' || f.ranges[0].startOffset > 0) : [];
  r.fns = fns.length; r.ran = fns.filter(f => f.ranges[0].count > 0).length;
  r.missed = fns.filter(f => f.ranges[0].count === 0).map(f => (f.functionName || '(anonymous)') + '@' + f.ranges[0].startOffset);
  r.errs = r.errs.concat(errs); r.dom = JSON.stringify(r.dom);
  await ctx.close();
  return r;
}
/* --perf ROUNDS: the real time each scene takes in its page (trace recording included, the same on both sides), B++'s script against this
 * tree's (A/B) and B++'s against itself (A/A, the noise), interleaved, the order alternating each round; medians and the A/B and A/A
 * differences.  Not a gate rule: a measure for the checkpoint's evidence (M-021's paired runs). */
if (ARG.perf) {
  (async () => {
    const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const P = { tool: 'dev/tools/gate/golden/page_scripts.js --perf', rounds: +ARG.perf, scripts: {} }, med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
    try {
      for (const name of SCRIPTS) {
        const oldBody = git(name), newBody = fs.readFileSync(LAYOUT.at(name)), A = [], B = [], A2 = [];
        for (let k = 0; k < +ARG.perf; k++) {
          const order = k % 2 ? [['b', newBody], ['a', oldBody], ['a2', oldBody]] : [['a', oldBody], ['a2', oldBody], ['b', newBody]];
          for (const [w, body] of order) { const r = await run(browser, name, body); (w === 'a' ? A : w === 'a2' ? A2 : B).push(+r.ms.toFixed(1)); }
        }
        const s = { bpp: A, bpp2: A2, tree: B, medianBpp: med(A), medianBpp2: med(A2), medianTree: med(B) };
        s.abPct = +((s.medianTree / s.medianBpp - 1) * 100).toFixed(2); s.aaPct = +((s.medianBpp2 / s.medianBpp - 1) * 100).toFixed(2);
        P.scripts[name] = s;
        console.log(`${name}: B++ ${s.medianBpp} ms, B++ again ${s.medianBpp2} ms (A/A ${s.aaPct >= 0 ? '+' : ''}${s.aaPct} %), this tree ${s.medianTree} ms (A/B ${s.abPct >= 0 ? '+' : ''}${s.abPct} %); rounds ${JSON.stringify({ bpp: A, bpp2: A2, tree: B })}`);
      }
    } finally { await browser.close(); }
    if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(P, null, 1) + '\n');
  })().catch(e => { console.error(e); process.exit(2); });
  return;
}
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const R = { tool: 'dev/tools/gate/golden/page_scripts.js', old: ARG['old-ref'].slice(0, 7), new: TREE === REPO ? 'this tree' : TREE, debugFixture: { frames: FIX.frames.length, records: FIX.frames.reduce((a, f) => a + f.dbg.length, 0) }, scripts: {}, ok: true };
  try {
    for (const name of SCRIPTS) {
      const oldBody = git(name), newBody = fs.readFileSync(LAYOUT.at(name));
      const o = await run(browser, name, oldBody), n = await run(browser, name, newBody);
      const k = o.chunks.findIndex((c, i) => c !== n.chunks[i]), chunksEqual = o.n === n.n && k < 0;
      const s = { equal: chunksEqual && o.dom === n.dom && JSON.stringify(o.errs) === JSON.stringify(n.errs), lines: [o.n, n.n], kinds: [o.kinds, n.kinds], errors: [o.errs, n.errs],
        functions: { old: [o.ran, o.fns], new: [n.ran, n.fns], unrunOld: o.missed, unrunNew: n.missed, allowed: UNRUN[name] } };
      s.reached = !o.errs.length && (o.fns - o.ran) <= (UNRUN[name] ? UNRUN[name].max : 0) && (n.fns - n.ran) === (o.fns - o.ran);
      if (!chunksEqual) {                                                       // run both again for the lines around the first difference
        const at = k < 0 ? Math.min(o.chunks.length, n.chunks.length) * 2000 : k * 2000, lo = await run(browser, name, oldBody, [at, at + 2000]), ln = await run(browser, name, newBody, [at, at + 2000]);
        const j = Math.max(0, lo.lines.findIndex((x, i) => x !== ln.lines[i]));
        s.firstDifference = { line: at + j, old: (lo.lines[j] || '(none)').slice(0, 400), new: (ln.lines[j] || '(none)').slice(0, 400) };
      }
      s.ok = s.equal && s.reached; if (!s.ok) R.ok = false;
      R.scripts[name] = s;
      console.log(`${s.ok ? 'SAME' : 'FAIL'} ${name}: ${o.n} trace lines (${o.kinds} kinds) ${chunksEqual ? 'equal' : 'DIFFERENT'}, the page's elements ${o.dom === n.dom ? 'equal' : 'DIFFERENT'}, errors ${o.errs.length}/${n.errs.length}; functions run: B++ ${o.ran} of ${o.fns}, this tree ${n.ran} of ${n.fns}${s.reached ? '' : ' - NOT REACHED: the scene must run every function but ' + (UNRUN[name] ? UNRUN[name].max : 0) + ' (' + (UNRUN[name] ? UNRUN[name].why : '-') + ') without errors'}`);
      if (ARG.missed || !s.reached) console.log('  not run (B++): ' + (o.missed.join(', ') || '-') + '\n  not run (this tree): ' + (n.missed.join(', ') || '-'));
      if (o.errs.length || n.errs.length) console.log('  errors: B++ ' + (o.errs.slice(0, 2).join(' | ') || '-') + '; this tree ' + (n.errs.slice(0, 2).join(' | ') || '-'));
      if (s.firstDifference) console.log(`  first different line ${s.firstDifference.line}:\n  old ${s.firstDifference.old}\n  new ${s.firstDifference.new}`);
    }
  } finally { await browser.close(); }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(`PAGE SCRIPTS: ${R.ok ? 'SAME' : 'FAIL'} (${Object.keys(R.scripts).length} scripts, B++'s against this tree's; the debug fixture: ${R.debugFixture.frames} frames, ${R.debugFixture.records} records)`);
  process.exitCode = R.ok ? 0 : 1;
})().catch(e => { console.error(e); process.exit(2); });
