/* Stage 3C QA2 - how long the start takes, QA1 against QA2, and what the black ready gate costs (development only; never served).
 *
 *   node dev/stage-3c-qa2/perf_start_qa2.js --qa1 DIR [--qa2 DIR] [--rounds 2] [--secs 4] [--out FILE.json] [--port 9861]
 *
 * 1. Starts, desktop 1280 x 720, in Chromium told sound may start (so neither build waits on a person): for each round, a cold
 *    start (a new profile: empty HTTP cache and Cache Storage) and a warm one (the same profile, reloaded 4 s later), QA1 and QA2 in
 *    turn; medians and ranges over the rounds.
 *    Read without a user gesture (CDP), every 50 ms: the first paint; QA2's boot timeline (ready, menu), when each part the boot
 *    waits for was ready, and when its music was decoded; when the menu is settled (on screen and nothing in it still animating in: QA1's staggered entrance, QA2's reveal
 *    fade), and when the menu music is playing. QA1 starts its music only on the first press: the probe presses a key as soon as
 *    the menu is settled and times the download and decoding that follows.
 * 2. The ready gate (QA2, Chromium as installed: it wants a gesture): the page's frame interval and the JavaScript time per frame
 *    (DevTools sampling profiler, 100 us) for SECS seconds while the gate waits, then the same on the menu once it is passed.
 * SwiftShader software rendering on 2 CPUs, localhost: only the two builds against each other mean anything. */
'use strict';
const path = require('path'), fs = require('fs');
const Q = require('./qa2_lib.js'); const { sleep, H } = Q;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const QA1 = path.resolve(opt('qa1')), QA2 = path.resolve(opt('qa2', path.join(__dirname, '..', '..'))), ROUNDS = +opt('rounds', 2), SECS = +opt('secs', 4), OUT = opt('out', null), PORT = +opt('port', 9861);
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + .5))]; };
const POLL = `(() => { const m = document.getElementById('menu'), b = document.getElementById('boot'), html = document.documentElement;
  const shown = !!m && !m.hidden && getComputedStyle(m).visibility !== 'hidden' && !html.classList.contains('tfb-boot') && (!b || b.hidden);
  const anims = shown ? document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#menu') && !/mmHum/.test(a.animationName || '')).length : -1;
  const th = window.__ui && __ui.theme && __ui.theme.info ? __ui.theme.info() : null;
  return { now: Math.round(performance.now()), fp: (performance.getEntriesByType('paint').find(p => p.name === 'first-paint') || {}).startTime, boot: window.__boot ? __boot.info().timeline : null,
    shown, anims, done: window.__ui && __ui.boot ? __ui.boot().done : null, theme: th && { state: th.state, ctx: th.ctx, preparedAt: th.preparedAt === undefined ? null : th.preparedAt, fetched: th.fetched, cacheHits: th.cacheHits } }; })()`;
async function oneStart(s, url, label, kind, reload) {
  const t0 = Date.now();
  if (reload) await s.P.reload({ waitUntil: 'commit' }); else await s.P.goto(url, { waitUntil: 'commit', timeout: 120000 });
  const r = { build: label, kind, firstPaint: null, settledAt: null, musicAt: null, pressAt: null, boot: null, preparedAt: null, fetched: null, cacheHits: null, done: null };
  let pressed = false, sawAnim = false;
  while (Date.now() - t0 < 120000) {
    const v = await Q.ev(s.cdp, POLL);
    if (v && !v.__error) {
      if (v.fp !== undefined && r.firstPaint === null) r.firstPaint = Math.round(v.fp);
      if (v.anims > 0) sawAnim = true;
      // settled: on screen, painted, nothing in it animating in (QA1: once its staggered entrance has run; QA2 has none)
      if (r.settledAt === null && v.shown && r.firstPaint !== null && v.anims === 0 && (v.boot || sawAnim || v.now > r.firstPaint + 6000)) r.settledAt = v.now;
      r.done = v.done;
      if (v.theme && v.theme.state === 'playing' && v.theme.ctx === 'running' && r.musicAt === null) r.musicAt = v.now;
      r.boot = v.boot; if (v.theme) { r.preparedAt = v.theme.preparedAt; r.fetched = v.theme.fetched; r.cacheHits = v.theme.cacheHits; }
      if (r.settledAt !== null && r.musicAt === null && !pressed && !v.boot) { r.pressAt = v.now; await s.P.keyboard.press('KeyM'); pressed = true; }
      if (r.settledAt !== null && r.musicAt !== null) break;
    }
    await sleep(50);
  }
  if (r.pressAt !== null && r.musicAt !== null) r.musicAfterPressMs = r.musicAt - r.pressAt;
  console.log(JSON.stringify(r));
  return r;
}
async function frameCost(s, state) {
  const cdp = s.cdp; await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await sleep(600);
  await s.P.evaluate(() => { window.__pf = []; let last = performance.now(); const f = () => { if (!window.__pf) return; const t = performance.now(); window.__pf.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await cdp.send('Profiler.start'); await sleep(SECS * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const dt = await s.P.evaluate(() => { const d = window.__pf; window.__pf = null; return d.slice(1); });
  const byId = new Map(profile.nodes.map(n => [n.id, n])); let ui = 0, js = 0; const dts = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) { const f = byId.get(profile.samples[i]).callFrame, d = (dts[i + 1] || 0) / 1000; if (/\/(assets\/ui|hud|inventory)\.js/.test(f.url)) ui += d; if (f.url) js += d; }
  const fr = Math.max(1, dt.length);
  const row = { state, frames: dt.length, pageMs: { mean: +(dt.reduce((a, c) => a + c, 0) / fr).toFixed(1), p95: +pct(dt, .95).toFixed(1) }, uiJsMsPerFrame: +(ui / fr).toFixed(3), jsMsPerFrame: +(js / fr).toFixed(2),
    menuAnimations: await s.P.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || a.transitionProperty || 'anim')) };
  console.log(JSON.stringify(row));
  return row;
}
(async () => {
  const R = { qa1: QA1, qa2: QA2, rounds: ROUNDS, secs: SECS, note: 'SwiftShader software rendering on 2 CPUs, localhost: only QA1 against QA2 on the same machine means anything; never quote as GPU or network performance.', starts: [], gate: [], errors: [] };
  const sA = await Q.serve(QA1, PORT), sB = await Q.serve(QA2, PORT + 1);
  try {
    const bA = await Q.browser({ autoplay: true });
    for (let round = 0; round < ROUNDS; round++) for (const [label, port] of [['qa1', PORT], ['qa2', PORT + 1]]) {
      const ctx = await bA.newContext({ viewport: { width: 1280, height: 720 } }), P = await ctx.newPage(), errs = [];   // a new profile: nothing cached
      P.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 300)));
      const s = { ctx, P, errs, cdp: await ctx.newCDPSession(P) };
      const url = `http://127.0.0.1:${port}/?room=perf${Date.now() % 1e6}`;
      R.starts.push(Object.assign(await oneStart(s, url, label, 'cold'), { round }));
      await sleep(4000);                                     // (the first visit's music is written to Cache Storage in the background)
      R.starts.push(Object.assign(await oneStart(s, url, label, 'warm', true), { round }));
      R.errors.push(...s.errs.map(e => label + ': ' + e)); await s.ctx.close();
    }
    await bA.close();
    const bG = await Q.browser();
    { const s = await Q.page(bG, PORT + 1, { viewport: { width: 1280, height: 720 }, gate: false });
      await Q.bootState(s, ['ready'], 120000);
      for (let i = 0; i < 100; i++) { if (await Q.ev(s.cdp, '__ui.boot().gate')) break; await sleep(100); }
      R.gate.push(await frameCost(s, 'QA2 ready gate (black, waiting for a key, click or tap)'));
      await s.P.keyboard.press('Space'); await Q.bootState(s, 'menu', 20000); await sleep(1500);
      R.gate.push(await frameCost(s, 'QA2 menu idle (after the gate, music playing)'));
      R.errors.push(...s.errs.map(e => 'gate: ' + e)); await s.ctx.close(); }
    await bG.close();
  } catch (e) { R.errors.push('perf: ' + (e && e.stack || e)); console.log(e); }
  finally { try { sA.kill(); } catch (e) { } try { sB.kill(); } catch (e) { } }
  const sum = {};
  for (const x of R.starts) { const k = `${x.build} ${x.kind}`, s = sum[k] || (sum[k] = { n: 0, firstPaint: [], settledAt: [], musicAt: [], musicAfterPressMs: [] }); s.n++;
    for (const f of ['firstPaint', 'settledAt', 'musicAt', 'musicAfterPressMs']) if (x[f] !== null && x[f] !== undefined) s[f].push(x[f]); }
  const med = a => { if (!a.length) return null; const b = a.slice().sort((p, q) => p - q); return b.length % 2 ? b[(b.length - 1) / 2] : Math.round((b[b.length / 2 - 1] + b[b.length / 2]) / 2); };
  for (const s of Object.values(sum)) for (const f of ['firstPaint', 'settledAt', 'musicAt', 'musicAfterPressMs']) s[f] = { median: med(s[f]), min: s[f].length ? Math.min(...s[f]) : null, max: s[f].length ? Math.max(...s[f]) : null, n: s[f].length };
  R.summary = sum;
  console.log(JSON.stringify(sum, null, 1));
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  process.exit(R.errors.some(e => /^perf: /.test(e)) ? 1 : 0);
})();
