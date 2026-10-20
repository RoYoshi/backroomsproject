#!/usr/bin/env node
/* dev/pre-trial3-final-polish/tools/version_check.js - pre-Trial 3 polish P5: the game's version has one source, package.json, and the
 * main menu shows what it says (development only).
 *
 *   node dev/pre-trial3-final-polish/tools/version_check.js [--dir DIR] [--out FILE.json] [--work DIR]
 *
 * DIR: a complete game folder (default this repository).  The cases:
 *   one_source        package.json's "version" has a major.minor.patch; display = that major.minor.patch (players see "v" + it)
 *   built_from_it     public/assets/version.js is what dev/tools/build/build.js writes from it (build.js --check PASS) and says both
 *   no_hand_copies    src/ and public/ credits_data.js carry no version of their own; ui.js shows window.TFB_VERSION.display and reads
 *                     no other version; no other served script or index.html holds the displayed version as a quoted string
 *   menu_shows_it     headless Chromium: the main menu's corner (#mmVer) reads "v" + display; the interface controller's own tag
 *                     (window.__ui.version, 'stage-3c-qa2') is a different thing and is reported, not shown
 *   follows_package   in a copy (--work, default the system's temporary folder): package.json's version changed alone ->
 *                     build.js --check FAILS (the stale copy is caught); built -> version.js says the new version and the copy's menu
 *                     reads "v99.1.2"; a version without major.minor.patch -> the build stops
 * Every passcode is synthetic.  Servers are stopped by their PID.  Exit 0 only when every case holds. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net'), os = require('os');
const { spawn, spawnSync, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const REPO = path.resolve(__dirname, '../../..'), DIR = path.resolve(ARG.dir || REPO), sleep = ms => new Promise(r => setTimeout(r, ms));
const cases = [], check = (name, ok, detail) => { cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' - ' + detail : ''}`); };
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const core = v => { const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.+-]*)?$/.exec(String(v || '')); return m ? m.slice(1, 4).join('.') : null; };
const build = (dir, flag) => spawnSync(process.execPath, ['dev/tools/build/build.js'].concat(flag ? [flag] : []), { cwd: dir, encoding: 'utf8' });
async function menuVersion(b, dir) {
  const port = await freePort(), srv = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 'ver-synthetic-admin' }), stdio: 'ignore' });
  try {
    for (let i = 0; i < 150 && await get(port, '/index.html') !== 200; i++) await sleep(100);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }), P = await ctx.newPage(), errs = []; P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await P.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit', timeout: 90000 });
    for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
    await P.waitForFunction(() => window.__ui && document.getElementById('mmVer') && document.getElementById('mmVer').textContent, null, { timeout: 30000 }).catch(() => null);
    const r = await P.evaluate(() => ({ shown: document.getElementById('mmVer').textContent, tfb: window.TFB_VERSION || null, uiTag: window.__ui && window.__ui.version, creditsVersion: window.TFB_CREDITS ? window.TFB_CREDITS.version : undefined }));
    r.errors = errs; await ctx.close(); return r;
  } finally { try { process.kill(srv.pid); } catch (e) { } }
}
(async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(DIR, 'package.json'), 'utf8')), v = pkg.version, display = core(v);
  check('one_source', !!display, `package.json "version": ${JSON.stringify(v)} -> displayed "v${display}"`);
  const vf = path.join(DIR, 'public', 'assets', 'version.js'), vt = fs.existsSync(vf) ? fs.readFileSync(vf, 'utf8') : '', bc = build(DIR, '--check');
  check('built_from_it', bc.status === 0 && /BUILD CHECK: PASS/.test(bc.stdout) && vt.includes(`display: ${JSON.stringify(display)}`) && vt.includes(`package: ${JSON.stringify(v)}`),
    `${(bc.stdout.trim().split('\n').pop() || '').slice(0, 100)}; version.js: ${(vt.match(/window\.TFB_VERSION = [^\n]*/) || [''])[0]}`);
  // hand copies: the credits data's own version, ui.js reading another version, the display version as a quoted string anywhere served
  const rd = p => { const f = path.join(DIR, p); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
  const creditsHas = ['src/frameworks/front/client/credits_data.js', 'public/assets/credits_data.js'].filter(p => /\bversion\s*:/.test(rd(p).replace(/\/\*[\s\S]*?\*\//g, '')));
  const uiSrc = rd('src/frameworks/front/client/ui.js'), uiPub = rd('public/assets/ui.js');
  const uiOk = [uiSrc, uiPub].every(t => /TFB_VERSION\.display/.test(t) && !/TFB_CREDITS\.version/.test(t));
  const served = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(js|html|json)$/.test(e.name)) served.push(f); } };
  walk(path.join(DIR, 'public'));
  const quoted = new RegExp(`['"\`]v?${display.replace(/\./g, '\\.')}['"\`]`), copies = served.filter(f => f !== vf && quoted.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(DIR, f));
  check('no_hand_copies', !creditsHas.length && uiOk && !copies.length, JSON.stringify({ creditsWithAVersion: creditsHas, uiReadsTfbVersion: uiOk, otherServedCopies: copies }));
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const m = await menuVersion(b, DIR);
    check('menu_shows_it', m.shown === 'v' + display && m.tfb && m.tfb.display === display && m.tfb.package === v && m.creditsVersion === undefined && !m.errors.length,
      JSON.stringify(m));
    // a copy: package.json alone changed, then built; then a version with no major.minor.patch
    const work = fs.mkdtempSync(path.join(ARG.work ? path.resolve(ARG.work) : os.tmpdir(), 'vercheck-')), C = path.join(work, 'game');
    try {
      fs.mkdirSync(path.join(C, 'dev', 'tools'), { recursive: true });
      for (const d of ['public', 'src', 'generated']) execFileSync('cp', ['-a', path.join(DIR, d), path.join(C, d)]);
      execFileSync('cp', ['-a', path.join(DIR, 'dev', 'tools', 'build'), path.join(C, 'dev', 'tools', 'build')]);
      for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(DIR, f), path.join(C, f));
      const P2 = Object.assign({}, pkg, { version: '99.1.2-check' }); fs.writeFileSync(path.join(C, 'package.json'), JSON.stringify(P2, null, 2) + '\n');
      const vc = path.join(C, 'public', 'assets', 'version.js'), stale = build(C, '--check'), made = build(C), after = fs.existsSync(vc) ? fs.readFileSync(vc, 'utf8') : '', again = build(C, '--check');
      const cm = await menuVersion(b, C);
      fs.writeFileSync(path.join(C, 'package.json'), JSON.stringify(Object.assign({}, pkg, { version: 'next' }), null, 2) + '\n');
      const bad = build(C);
      check('follows_package', stale.status !== 0 && /public\/assets\/version\.js/.test(stale.stdout) && made.status === 0 && after.includes('display: "99.1.2"') && again.status === 0 && cm.shown === 'v99.1.2'
        && bad.status !== 0 && /no major\.minor\.patch/.test(bad.stderr + bad.stdout),
        JSON.stringify({ versionJs: (after.match(/window\.TFB_VERSION = [^\n]*/) || ['(none)'])[0], staleCheck: (stale.stdout.trim().split('\n').filter(l => /version|FAIL/.test(l)).join(' | ')).slice(0, 200), built: made.status, recheck: again.status, copyMenu: cm.shown, badVersion: (bad.stderr.trim() || bad.stdout.trim()).slice(0, 120) }));
    } finally { fs.rmSync(work, { recursive: true, force: true }); }
  } finally { await b.close(); }
  const R = { tool: 'dev/pre-trial3-final-polish/tools/version_check.js', dir: DIR, version: v, display, cases, ok: cases.length > 0 && cases.every(c => c.ok) };
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  console.log(`VERSION: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  process.exitCode = R.ok ? 0 : 1;
})();
