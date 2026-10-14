/* Stage 3H engine modernization - Stage 3H2's NEW RUN / hum page runner on either layout (development only; never served).  A copy of
 * dev/stage-3h/golden/cli_lib_h2.js (left as it is for the frozen layout) built on the layout-aware cli_lib.js here; the scenes are still
 * Stage 3H2's (dev/stage-3h/golden/cli_scenes_nr.js, cli_scenes_hum.js).  The original's description follows.
 *
 * Stage 3H2 (before C-3) - the client golden harness's page runner for NEW RUN's client side.
 *
 * Stage 3H0's cli_lib.js runs mp.js in a page whose pause dialog has no NEW RUN button and which has no run menu: mp.js's NEW RUN words
 * (nrButton, runMenuWords) find no element there and do nothing, so no 3H0 scene can see them.  This page is 3H0's, with two things
 * added, both copied from the accepted B++ index.html (143b63f) when the harness starts: the dialog's NEW RUN button (#reset) and the
 * run menu (#runMenu, its eyebrow, title, intro and buttons).  It loads, in order: 3H0's env, stubs, world.js, the helper scripts the
 * variant's index.html loads between glitch.js and mp.js, mp.js, 3H0's scenes (their runner and page record), then cli_scenes_nr.js
 * and cli_scenes_hum.js (Stage 3H2, before C-4: the fluorescent hum's fixtures and crackles).
 * A variant is 3H0's { mp, helpers } (fromRef / fromTree), optionally with mp or one helper's text replaced (mutants). */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./cli_lib.js');                                                     // (this copy) the layout-aware runner
const H0 = path.join(L.REPO, 'dev', 'stage-3h0', 'golden');
const SCENES = ['nr_answers', 'nr_reconnect', 'hum_fixtures'];
const BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40';
/* the B++ markup the page needs, taken from the accepted index.html itself (so the page cannot drift from it) */
function bppMarkup() {
  const html = L.git('show', BPP + ':index.html').toString('utf8');
  const btn = (html.match(/<button class="secondary" id="reset">NEW RUN<\/button>/) || [])[0];
  const rm = (html.match(/<div id="runMenu" hidden>\n[^\n]*\n<\/div>/) || [])[0];
  if (!btn || !rm) throw new Error('cli_lib_h2: the NEW RUN button or the run menu was not found in B++ index.html');
  return { btn, rm };
}
const MARK = bppMarkup();
const NEWG = L.NEWG;
const WORLD = L.WORLD;                                                                  // (this copy) from the web root
const FILES = { 'h0/env.js': fs.readFileSync(path.join(H0, 'cli_env.js')), 'h0/stubs.js': fs.readFileSync(path.join(H0, 'cli_stubs.js')), 'h0/scenes.js': fs.readFileSync(path.join(H0, 'cli_scenes.js')),
  'h2/scenes_nr.js': fs.readFileSync(path.join(L.REPO, 'dev', 'stage-3h', 'golden', 'cli_scenes_nr.js')), 'h2/scenes_hum.js': fs.readFileSync(path.join(L.REPO, 'dev', 'stage-3h', 'golden', 'cli_scenes_hum.js')) };
function page(v) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>h0</title></head><body><canvas id="mp"></canvas><div id="dread"></div><div id="game"></div><div id="light"></div>` +
    `<div id="dialog"><p class="lore-credit">credit line</p>${MARK.btn}</div>${MARK.rm}<div id="sound">SOUND: ON</div><div id="nameplate">QA-PLAYER</div><div id="wonStats"></div>` +
    `<script>window.__H0_NEW_GLOBALS = ${JSON.stringify(NEWG)};</script><script src="./h0/env.js"></script><script src="./h0/stubs.js"></script><script src="./world.js"></script>` +
    v.helpers.map(h => `<script src="./${h.f}"></script>`).join('') + `<script src="./mp.js"></script><script src="./h0/scenes.js"></script><script src="./h2/scenes_nr.js"></script><script src="./h2/scenes_hum.js"></script></body></html>`;
}
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
  await ctx.close();
  return { trace, errs, globals };
}
module.exports = { SCENES, BPP, NEWG, MARK, page, runScene, fromRef: L.fromRef, fromTree: L.fromTree, launch: L.launch, git: L.git, REPO: L.REPO };
