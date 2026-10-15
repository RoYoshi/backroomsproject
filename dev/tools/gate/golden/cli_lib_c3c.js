/* Stage 3H continuation C3c (M-024) - the client harness page for every client scene, with V8's coverage of mp.js (development only;
 * never served).
 *
 * The page is Stage 3H2's (cli_lib_h2.js: Stage 3H0's page with B++'s NEW RUN button and run menu, copied from B++'s index.html), with
 * C3c's scenes (cli_scenes_c3c.js) loaded after 3H0's and 3H2's: env, stubs, world.js, the helper scripts the variant's index.html loads
 * between glitch.js and mp.js, mp.js, then the scenes.  Every client scene runs in it - Stage 3H0's 9, 3H2's 3 and C3c's - so one run
 * gives each scene's trace and, with V8's own coverage, what all of them together run of mp.js.  A scene may ask for a page address of
 * its own (QUERY: ?peers=a, ?peers=b).  A variant is 3H0's { mp, helpers } (fromRef / fromTree). */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./cli_lib.js'), L2 = require('./cli_lib_h2.js');
const H0 = path.join(L.REPO, 'dev', 'stage-3h0', 'golden'), H2 = path.join(L.REPO, 'dev', 'stage-3h', 'golden');
const SCENES = ['c3c_poses', 'c3c_epoch', 'c3c_deathlight', 'c3c_misc', 'c3c_mode_a', 'c3c_mode_b'];
const ALL = L.SCENES.concat(L2.SCENES, SCENES);
const QUERY = { c3c_mode_a: '&peers=a', c3c_mode_b: '&peers=b' };
const FILES = { 'h0/env.js': fs.readFileSync(path.join(H0, 'cli_env.js')), 'h0/stubs.js': fs.readFileSync(path.join(H0, 'cli_stubs.js')), 'h0/scenes.js': fs.readFileSync(path.join(H0, 'cli_scenes.js')),
  'h2/scenes_nr.js': fs.readFileSync(path.join(H2, 'cli_scenes_nr.js')), 'h2/scenes_hum.js': fs.readFileSync(path.join(H2, 'cli_scenes_hum.js')),
  'c3c/scenes.js': fs.readFileSync(path.join(__dirname, 'cli_scenes_c3c.js')) };
function page(v) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>h0</title></head><body><canvas id="mp"></canvas><div id="dread"></div><div id="game"></div><div id="light"></div>` +
    `<div id="dialog"><p class="lore-credit">credit line</p>${L2.MARK.btn}</div>${L2.MARK.rm}<div id="sound">SOUND: ON</div><div id="nameplate">QA-PLAYER</div><div id="wonStats"></div>` +
    `<script>window.__H0_NEW_GLOBALS = ${JSON.stringify(L.NEWG)};</script><script src="./h0/env.js"></script><script src="./h0/stubs.js"></script><script src="./world.js"></script>` +
    v.helpers.map(h => `<script src="./${h.f}"></script>`).join('') + `<script src="./mp.js"></script><script src="./h0/scenes.js"></script><script src="./h2/scenes_nr.js"></script>` +
    `<script src="./h2/scenes_hum.js"></script><script src="./c3c/scenes.js"></script></body></html>`;
}
/* one scene in a fresh page: its trace, the page's errors, its globals, and (coverage) mp.js's functions and blocks as V8 counted them */
async function runScene(browser, v, scene, { coverage = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e && e.message || e).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  const map = Object.assign({ 'h.html': Buffer.from(page(v)), 'mp.js': v.mp, 'world.js': L.WORLD }, FILES, Object.fromEntries(v.helpers.map(h => [h.f, h.body])));
  await p.route('http://h0.test/**', route => {
    const f = new URL(route.request().url()).pathname.replace(/^\//, '');
    if (!(f in map)) return route.fulfill({ status: 404, body: 'no' });
    route.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : 'text/javascript', body: map[f] });
  });
  if (coverage) await p.coverage.startJSCoverage({ resetOnNavigation: false });
  await p.goto('http://h0.test/h.html?room=h0%20room' + (QUERY[scene] || ''), { waitUntil: 'load' });
  const globals = await p.evaluate(() => Object.keys(window).filter(k => k.startsWith('__')).sort());
  const trace = await p.evaluate(s => window.__RUN(s), scene);
  let cov = null;
  if (coverage) { const c = (await p.coverage.stopJSCoverage()).find(e => e.url.endsWith('/mp.js')); cov = c ? c.functions : []; }
  await ctx.close();
  return { trace, errs, globals, cov };
}
module.exports = { SCENES, ALL, QUERY, page, runScene, fromRef: L.fromRef, fromTree: L.fromTree, launch: L.launch, git: L.git, REPO: L.REPO, NEWG: L.NEWG, BPP: L2.BPP };
