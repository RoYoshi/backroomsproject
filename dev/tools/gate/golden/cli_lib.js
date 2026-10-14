/* Stage 3H engine modernization - the client golden harness's page runner on either layout (development only).  A copy of Stage 3H0's
 * dev/stage-3h0/golden/cli_lib.js (left as it is for the frozen layout).  The differences are where files are read:
 *   - a commit's files are read from its web root: public/ when the commit has public/index.html, its root otherwise;
 *   - the working tree's files are read from its web root (dev/tools/layout.js), and so is world.js;
 *   - the page's own scripts (env, stubs, scenes) and declared_new_globals.json are still Stage 3H0's.
 * A variant is { mp: Buffer (mp.js text), helpers: [{ f: 'assets/x.js', body: Buffer }] } loaded as: env, stubs, world.js, helpers, mp.js, scenes. */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..', '..'), HERE = path.join(REPO, 'dev', 'stage-3h0', 'golden');   // (this copy) HERE: 3H0's own files
const LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js')), WEB = LAYOUT.webRoot(REPO);
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const SCENES = ['load', 'menu_online', 'run_online', 'interp', 'fx_bodies', 'facade', 'admin', 'reconnect_solo', 'hum_dread'];
const NEWG = JSON.parse(fs.readFileSync(path.join(HERE, 'declared_new_globals.json'), 'utf8')).globals;
const git = (...a) => execFileSync('git', ['-C', REPO, ...a]);
/* the scripts an index.html loads between glitch.js and mp.js (the place for extracted mp.js helpers) */
function helpers(html) {
  const s = [...html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map(m => m[1]);
  const a = s.indexOf('glitch.js'), b = s.indexOf('mp.js');
  if (a < 0 || b < 0 || b < a) throw new Error('index.html: glitch.js / mp.js not found in order');
  return s.slice(a + 1, b);
}
/* (this copy) a commit's web root: public/ on the modern layout */
const refRoot = ref => { try { execFileSync('git', ['-C', REPO, 'cat-file', '-e', ref + ':public/index.html'], { stdio: 'ignore' }); return 'public/'; } catch (e) { return ''; } };
const fromRef = ref => { const r = refRoot(ref); return { mp: git('show', ref + ':' + r + 'mp.js'), helpers: helpers(git('show', ref + ':' + r + 'index.html').toString()).map(f => ({ f, body: git('show', ref + ':' + r + f) })) }; };
const fromTree = () => ({ mp: fs.readFileSync(path.join(WEB, 'mp.js')), helpers: helpers(fs.readFileSync(path.join(WEB, 'index.html'), 'utf8')).map(f => ({ f, body: fs.readFileSync(path.join(WEB, f)) })) });
const WORLD = fs.readFileSync(path.join(WEB, 'world.js'));
const FILES = { 'h0/env.js': fs.readFileSync(path.join(HERE, 'cli_env.js')), 'h0/stubs.js': fs.readFileSync(path.join(HERE, 'cli_stubs.js')), 'h0/scenes.js': fs.readFileSync(path.join(HERE, 'cli_scenes.js')) };
function page(v) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>h0</title></head><body><canvas id="mp"></canvas><div id="dread"></div><div id="game"></div><div id="light"></div>` +
    `<div id="dialog"><p class="lore-credit">credit line</p></div><div id="sound">SOUND: ON</div><div id="nameplate">QA-PLAYER</div><div id="wonStats"></div>` +
    `<script>window.__H0_NEW_GLOBALS = ${JSON.stringify(NEWG)};</script><script src="./h0/env.js"></script><script src="./h0/stubs.js"></script><script src="./world.js"></script>` +
    v.helpers.map(h => `<script src="./${h.f}"></script>`).join('') + `<script src="./mp.js"></script><script src="./h0/scenes.js"></script></body></html>`;
}
const launch = () => pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function runScene(browser, v, scene) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e && e.message || e).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  const map = Object.assign({ 'h.html': Buffer.from(page(v)), 'mp.js': v.mp, 'world.js': WORLD }, FILES, Object.fromEntries(v.helpers.map(h => [h.f, h.body])));
  await p.route('http://h0.test/**', route => {
    const f = new URL(route.request().url()).pathname.replace(/^\//, '');
    if (!(f in map)) return route.fulfill({ status: 404, body: 'no' });
    route.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : 'text/javascript', body: map[f] });
  });
  await p.goto('http://h0.test/h.html?room=h0%20room', { waitUntil: 'load' });
  const globals = await p.evaluate(() => Object.keys(window).filter(k => k.startsWith('__')).sort());
  const trace = await p.evaluate(s => window.__RUN(s), scene);
  const perf = await p.evaluate(() => Object.assign({}, window.__H.perf));       // real time inside mp.js's hook and handler (cli_perf.js); not part of the trace
  await ctx.close();
  return { trace, errs, globals, perf };
}
module.exports = { SCENES, NEWG, REPO, WEB, WORLD, git, helpers, fromRef, fromTree, launch, runScene };
