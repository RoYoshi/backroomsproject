#!/usr/bin/env node
/* dev/tools/gate/golden/bundle_diff.js - the compiled client, two builds side by side in the real page, frame by frame (development only;
 * Stage 3H continuation C4).
 *
 *   node dev/tools/gate/golden/bundle_diff.js --ref <web root> --cand <web root> [--scenes a,b,...] [--out DIR] [--pixels 1] [--batch 30]
 *        [--cand-assets <folder>]   the candidate is --ref with these files over its assets/ (a staged build: dev/tools/build/client.js --stage)
 *        [--repeat N]               the same side N times (the A/A control: --cand omitted compares --ref with itself)
 *        [--ref-lineage 1]          the reference is --ref (default: the repository's public/) with the bundle and the stylesheet the
 *                                   client lineage records (src/core/client/bundle/lineage/: v11's build and its recorded steps,
 *                                   replayed): the files the game shipped up to continuation C4a, before they were built from the port
 *
 * Each side is a web root (public/ of a game folder) served by the game's own static handler (src/frameworks/ward/server/static.js) on its
 * own port, in its own page of one headless Chromium (SwiftShader: no physical GPU).  bundle_env.js makes each page deterministic (a
 * virtual clock and frames, seeded randomness, I/O handed over at frame boundaries, a fake WebSocket, a recording Web Audio).  Both
 * pages boot until nothing is pending, then step the same frames with the same input (synthetic events at frame boundaries) and the same
 * network (offline unless a scene drives the socket), and after every batch of frames their records are compared field by field:
 * Math.random calls, the game state through window.__api, the document, every 2D canvas call, every audio call, every call through the
 * shared window objects, the socket, the errors and the WebGL canvas's pixels.  At a scene's checkpoints both pages are also captured
 * (PNG) and every element's computed style compared.  The first difference stops the scene and is shown with both sides' full text
 * of the frames around it.  Exit 0 only when every scene is identical on both sides. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ARG = { batch: '30', pixels: '1' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const SCENES = require(ARG.scenesFile ? path.resolve(ARG.scenesFile) : path.join(__dirname, 'bundle_scenes.js'));
const ENV = fs.readFileSync(path.join(__dirname, 'bundle_env.js'), 'utf8');
const STATIC = require(path.join(REPO, 'src', 'frameworks', 'ward', 'server', 'static.js'));
const OUT = path.resolve(ARG.out || path.join(require('os').tmpdir(), 'bundle_diff')); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/* the web roots: --cand-assets makes a copy of --ref with the staged files over its assets/; --ref-lineage a copy of --ref with the
   lineage's recorded bundle and stylesheet */
function lineageRoot(base) {
  const LIN = path.join(REPO, 'src', 'core', 'client', 'bundle', 'lineage'), L = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8'));
  const sha = b => crypto.createHash('sha256').update(b).digest('hex'), dst = path.join(OUT, 'ref_lineage_root');
  fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(base, dst, { recursive: true });
  for (const key of ['bundle', 'css']) {
    const F = L.files[key]; let cur = fs.readFileSync(path.join(REPO, F.base.path)); if (sha(cur) !== F.base.sha256) throw new Error(`the ${key} lineage base is not the recorded file`);
    for (const st of F.steps) {
      const P = JSON.parse(fs.readFileSync(path.join(LIN, st.patch), 'utf8')), parts = []; let pos = 0;
      if (P.before.sha256 !== sha(cur)) throw new Error(`${st.id} was not made on the version before it`);
      for (const [at, del, ins] of P.hunks) { const d = Buffer.from(del, 'utf8'); if (!cur.subarray(at, at + d.length).equals(d)) throw new Error(`${st.id}: a hunk does not match`); parts.push(cur.subarray(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length; }
      parts.push(cur.subarray(pos)); cur = Buffer.concat(parts);
    }
    if (sha(cur) !== F.result.sha256) throw new Error(`the ${key} replay did not end at the recorded result`);
    fs.writeFileSync(path.join(dst, F.file.replace(/^public\//, '')), cur);
  }
  return dst;
}
function candRoot() {
  if (ARG.cand) return path.resolve(ARG.cand);
  if (!ARG['cand-assets']) return null;
  const dst = path.join(OUT, 'cand_root'); fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(path.resolve(ARG.ref), dst, { recursive: true });
  for (const f of fs.readdirSync(path.resolve(ARG['cand-assets']))) fs.copyFileSync(path.join(path.resolve(ARG['cand-assets']), f), path.join(dst, 'assets', f));
  return dst;
}
async function serve(root) {
  const handler = STATIC(root), s = http.createServer((q, r) => handler(q, r));
  await new Promise(ok => s.listen(0, '127.0.0.1', ok)); return { server: s, port: s.address().port };
}

/* one side: a context, a page, the environment, the boot */
async function open(browser, label, port, scene) {
  const [vw, vh] = (ARG.viewport || '1280x720').split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const P = await ctx.newPage(); const side = { label, ctx, P, pageErrors: [], requests: 0, done: 0 };
  P.on('pageerror', e => side.pageErrors.push(String(e).slice(0, 300)));
  P.on('request', () => side.requests++); P.on('requestfinished', () => side.done++); P.on('requestfailed', () => side.done++);
  await P.addInitScript({ content: (scene.seed ? `window.__BD_SEED=${+scene.seed};\n` : '') + ENV });
  if (scene.strip) await P.route(u => /\/(index\.html)?(\?.*)?$/.test(new URL(u).pathname + new URL(u).search), async route => {   // the page without its classic scripts: the bundle on its own
    const r = await route.fetch(), html = await r.text();
    const out = html.replace(/<script(?![^>]*type="module")[^>]*\ssrc="[^"]+"[^>]*><\/script>\s*/g, m => (scene.strip === 'classic' || !new RegExp(scene.strip).test(m) ? '' : m));
    side.stripped = (html.match(/<script(?![^>]*type="module")[^>]*\ssrc=/g) || []).length - (out.match(/<script(?![^>]*type="module")[^>]*\ssrc=/g) || []).length;
    await route.fulfill({ response: r, body: out });
  });
  await P.goto(`http://127.0.0.1:${port}/${scene.query || ''}`, { waitUntil: 'load', timeout: 120000 });
  await quiet(side);
  return side;
}

/* nothing pending outside the page: every request answered, no font loading, no worker busy (twice in a row, 15 ms apart) */
async function quiet(side, maxMs = 60000) {
  const t0 = Date.now(); let ok = 0;
  while (ok < 2 && Date.now() - t0 < maxMs) {
    await sleep(15);
    const st = await side.P.evaluate(() => [document.readyState, document.fonts ? document.fonts.status : 'loaded', __BD.workersBusy() ? 1 : 0, __BD.pending().filter(p => !p[2]).length].join(','));
    ok = st === 'complete,loaded,0,0' && side.requests === side.done ? ok + 1 : 0;
  }
  if (ok < 2) side.notQuiet = (side.notQuiet || 0) + 1;
}

/* the scene's actions, done the same way on both sides */
const ACT = {
  frames: async (s, n, opts = {}) => {
    if (!opts.careful) return s.P.evaluate(([n, o]) => __BD.step(n, o), [n, opts]);
    const out = [];                                                       // one frame at a time, the page quiet before each
    for (let i = 0; i < n; i++) { await quiet(s); const r = await s.P.evaluate(o => __BD.step(1, o), opts); out.push(...r); if (r.length < 1 || (opts.until && await s.P.evaluate(u => !!(0, eval)(u), opts.until))) break; }
    return out;
  },
  eval: async (s, code) => s.P.evaluate(c => { try { return String((0, eval)(c)); } catch (e) { return 'THROW ' + e.message; } }, code),
  key: async (s, code, how, key) => s.P.evaluate(([code, how, key]) => { const init = { code, key: key || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? ' ' : code) };
    if (how !== 'up') __BD.input('keydown', init); if (how !== 'down') __BD.input('keyup', init); return true; }, [code, how, key]),
  mouse: async (s, x, y) => s.P.evaluate(([x, y]) => __BD.input('pointermove', { clientX: x, clientY: y, pointerType: 'mouse', pointerId: 1, isPrimary: true }), [x, y]),
  click: async (s, sel) => s.P.evaluate(sel => { const e = document.querySelector(sel); if (!e) return 'no ' + sel; if (e.focus) e.focus(); e.click(); return 'ok'; }, sel),   // (a real click focuses what it clicks)
  fill: async (s, sel, v) => s.P.evaluate(([sel, v]) => { const e = document.querySelector(sel); if (!e) return 'no ' + sel; e.focus(); e.value = v; const ev = new Event('input', { bubbles: true }); ev.__bd = 1; e.dispatchEvent(ev); return 'ok'; }, [sel, v]),
  trustedKey: async (s, key) => s.P.keyboard.press(key),
  ws: async (s, op, arg) => s.P.evaluate(([op, arg]) => (op === 'open' ? __BD.wsOpen() : op === 'close' ? __BD.wsClose() : op === 'mode' ? (__BD.netMode = arg, true) : __BD.wsMsg(arg)), [op, arg]),
};

function firstDiff(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i]; if (!x || !y) return { i, field: 'length', a: x, b: y };
    for (const k of Object.keys(x)) if (k !== 'err' && x[k] !== y[k]) return { i, field: k, a: x, b: y };
    if (x.err !== y.err) return { i, field: 'err', a: x, b: y };
  }
  return null;
}

async function runScene(browser, scene, roots) {
  const R = { scene: scene.name, frames: 0, steps: 0, checkpoints: [], ok: true };
  const servers = await Promise.all(roots.map(serve));
  const sides = [];
  try {
    for (let k = 0; k < roots.length; k++) sides.push(await open(browser, k === 0 ? 'ref' : 'cand', servers[k].port, scene));
    const both = fn => Promise.all(sides.map(fn));
    const batch = +ARG.batch, pixels = +ARG.pixels || 0;                    // the WebGL canvas's pixels every Nth frame (0: never)
    for (const st of scene.steps) {
      R.steps++;
      const [op, ...a] = st;
      if (op === 'frames') {
        let left = a[0];
        while (left > 0) {
          const n = Math.min(batch, left); left -= n;
          const recs = await both(s => ACT.frames(s, n, Object.assign({ pixels }, a[1] || {})));
          R.frames += recs[0].length;
          for (let k = 1; k < recs.length; k++) {
            const d = firstDiff(recs[0], recs[k]);
            if (d) {
              R.ok = false; R.diff = { frame: d.a ? d.a.f : d.b && d.b.f, field: d.field, ref: d.a, cand: d.b, step: st };
              const f0 = R.diff.frame; R.ring = await both(s => s.P.evaluate(f0 => __BD.ring.filter(r => r.f >= f0 - 1 && r.f <= f0), f0));
              R.errors = await both(s => s.P.evaluate(() => __BD.errors.slice(-20)));
              return R;
            }
          }
          if (recs[0].length < n) left = 0;                                 // stopped early by its condition, on both sides alike
        }
      } else if (op === 'shot') {
        const name = a[0], cssL = await both(s => s.P.evaluate(() => __BD.cssList())), css = cssL.map(L => crypto.createHash('sha256').update(JSON.stringify(L)).digest('hex').slice(0, 16)), shots = await both(async s => { await s.P.evaluate(() => __BD.pinAnimations()); return s.P.screenshot({ type: 'png', animations: 'allow' }); });
        const h = shots.map(b => crypto.createHash('sha256').update(b).digest('hex'));
        shots.forEach((b, k) => fs.writeFileSync(path.join(OUT, `${scene.name}_${name}_${sides[k].label}.png`), b));
        const cp = { name, frame: R.frames, png: h, css, same: h.every(x => x === h[0]) && css.every(x => x === css[0]) }; R.checkpoints.push(cp);
        if (!cp.same) {
          R.ok = false; R.diff = { checkpoint: name, png: h, css };
          if (css.some(x => x !== css[0])) { const L = cssL; const d = [];
            for (let i = 0; i < Math.max(L[0].length, L[1].length) && d.length < 12; i++) { const a = L[0][i], b = L[1][i]; if (!a || !b || a[0] !== b[0]) { d.push({ i, a: a && a[0], b: b && b[0] }); continue; }
              const ks = new Set([...Object.keys(a[1]), ...Object.keys(b[1])]); for (const k of ks) if (a[1][k] !== b[1][k]) d.push({ el: a[0], prop: k, ref: a[1][k], cand: b[1][k] }); }
            R.diff.cssDiff = d; }
          return R;
        }
      } else {
        const res = await both(s => ACT[op](s, ...a));
        if (op === 'eval') (R.evals = R.evals || []).push([a[0].slice(0, 80), String(res[0]).slice(0, 2000)]);
        if (res.some(x => String(x) !== String(res[0]))) { R.ok = false; R.diff = { step: st, results: res }; return R; }
      }
    }
    R.errors = await both(s => s.P.evaluate(() => __BD.errors.slice(-20)));
    R.pageErrors = sides.map(s => s.pageErrors);
    R.fr = await both(s => s.P.evaluate(() => __BD.FR.length));
    return R;
  } finally {
    for (const s of sides) await s.ctx.close().catch(() => { });
    for (const s of servers) s.server.close();
  }
}

(async () => {
  const base = path.resolve(ARG.ref || path.join(REPO, 'public')), ref = ARG['ref-lineage'] ? lineageRoot(base) : base; ARG.ref = base;
  if (ARG['ref-lineage'] && !ARG.cand && !ARG['cand-assets']) ARG.cand = base;                          // the served files against the recorded ones
  const cand = candRoot();
  const roots = cand ? [ref, cand] : Array.from({ length: +(ARG.repeat || 2) }, () => ref);
  const names = (ARG.scenes || Object.keys(SCENES).join(',')).split(',');
  const browser = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const REP = { tool: 'dev/tools/gate/golden/bundle_diff.js', chromium: browser.version(), ref, cand: cand || '(the same root: A/A)', scenes: [] };
  try {
    for (const n of names) {
      const sc = SCENES[n]; if (!sc) { log('no scene ' + n); REP.scenes.push({ scene: n, ok: false, problem: 'no such scene' }); continue; }
      const t0 = Date.now(); const r = await runScene(browser, Object.assign({ name: n }, sc), roots); r.seconds = Math.round((Date.now() - t0) / 1000);
      REP.scenes.push(r);
      log(`${r.ok ? 'SAME' : 'DIFFERENT'}  ${n}: ${r.frames} frames, ${r.checkpoints.length} checkpoints${r.diff ? '; first difference: ' + JSON.stringify(r.diff.field ? { frame: r.diff.frame, field: r.diff.field } : r.diff).slice(0, 300) : ''} (${r.seconds} s)`);
      if (r.errors && r.errors.some(e => e.length)) log('   errors: ' + JSON.stringify(r.errors).slice(0, 400));
    }
  } finally { await browser.close(); }
  REP.ok = REP.scenes.every(s => s.ok);
  fs.writeFileSync(path.join(OUT, 'bundle_diff.json'), JSON.stringify(REP, null, 1) + '\n');
  log(`BUNDLE DIFF: ${REP.ok ? 'SAME' : 'DIFFERENT'} (${REP.scenes.filter(s => s.ok).length} of ${REP.scenes.length} scenes identical)`);
  process.exitCode = REP.ok ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 2; });
