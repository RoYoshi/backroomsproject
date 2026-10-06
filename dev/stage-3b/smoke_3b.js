/* Stage 3B - quick browser smoke against the real client (development only; never served).  A few minutes, not a matrix.
 *
 *   node dev/stage-3b/smoke_3b.js [--game PATH]        (exit code 1 on any failure)
 *
 * Staged pages (frozen halls, no monsters, lamps forced on, god mode), each in its own room so no page sees another.
 * Scene pixels are read with every DOM overlay hidden (BR-RoLE's #light, grain, dread, HUD): the WebGL scene alone.
 *
 * S01 the page loads with BR-RoLE drawing and the remaster built; its layers sit right above the level art / lampTop
 * S02 remaster OFF is exactly the legacy look: a live-toggled-off frame equals a ?remaster=off page at the same pose
 * S03 BR-RoLE never sees the remaster: its light overlay is byte-identical with the remaster on and off; same blockers
 * S04 gameplay untouched: the client sends the same kinds of messages with the remaster on and off
 * S05 the remaster changes the slice rooms only: big pixel change in YELLOW HALL; none in a non-slice room
 * S06 quality tiers: BR-RoLE LOW / HIGH rebuilds the remaster at that tier, no error
 * S07 DEV toggles: wall-depth cue and decals change the picture; with ?dev3b, F8 toggles the remaster live
 * S08 short performance sanity in the slice: frame interval and BR-RoLE time with the remaster on vs off */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9475);
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const HIDE = '#light,.grain,#dread,#mp,header,.location,.coordinates,#hud,#net,#encounterHint,#blackoutHint,#l0vTag';
async function page(browser, query) {
  const J = await H.join(browser, PORT, 'sm3b' + Math.floor(Math.random() * 1e6), 'QA', { query });
  await H.until(() => J.P.evaluate(() => !window.__l0v || window.__l0v.ready()), 30000);
  await H.stage(J.P); await H.setLights(J.P, 'off'); return J;
}
async function pose(P, x, y, a, light) { await P.evaluate(() => __clock.thaw()); await H.place(P, x, y, a, { light }); await sleep(1300); await frames(P, 8); await P.evaluate(() => __clock.freeze(false)); await frames(P, 8); await sleep(200); }
async function scene(P) {                                   // the WebGL scene alone, as raw RGB
  await P.evaluate(s => document.querySelectorAll(s).forEach(e => e.style.visibility = 'hidden'), HIDE); await frames(P, 4); await sleep(120);
  const png = await P.screenshot(); await P.evaluate(s => document.querySelectorAll(s).forEach(e => e.style.visibility = ''), HIDE);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height };
}
function diff(a, b, mask) {                                 // differing pixels (any channel > 2) outside an optional mask rect
  let n = 0, tot = 0, max = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { if (mask && x >= mask[0] && x < mask[2] && y >= mask[1] && y < mask[3]) continue; tot++; const i = (y * a.w + x) * 3;
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])); if (d > max) max = d; if (d > 2) n++; }
  return { n, frac: n / tot, max };
}
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }); let A = null, B = null, C = null;
  const PLAYER = [560, 280, 720, 440];                      // the wanderer at the screen centre (it breathes): left out of exact comparisons
  try {
    A = await page(browser, ''); const P = A.P;
    /* S01 */
    const s1 = await P.evaluate(() => ({ l: __l0v.stats(), lay: __l0v.dev.layers(), br: __brRole.stats(), on: __brRole.on() }));
    await frames(P, 10); const brFrames = await P.evaluate(() => __brRole.stats().frames);
    check('S01 the page loads: BR-RoLE draws, the remaster is built for the slice, its layer sits right above the level art and its ceiling right above lampTop, no page error',
      s1.l.built && !s1.l.disabled && s1.on && brFrames > s1.br.frames - 1 && s1.lay.root === s1.lay.level + 1 && s1.lay.ceil === s1.lay.lampTop + 1 && !A.errs.length,
      `remaster ${s1.l.version} rev ${s1.l.revision}, tier ${s1.l.tier}, rooms ${s1.l.rooms.map(r => r.id).join(',')}, build ${s1.l.buildMs} ms (textures ${s1.l.texMs} ms, ${s1.l.textures} textures ${s1.l.texMPx} MPx); layers ${JSON.stringify(s1.lay)}; BR-RoLE ${s1.br.version} on ${s1.on}; errors ${JSON.stringify(A.errs)}`);
    /* S02 */
    B = await page(browser, '&remaster=off');
    const view = [1130, 3420, 2.6, false];
    await pose(P, ...view); await P.evaluate(() => __l0v.dev.remaster(false)); await frames(P, 6); const offLive = await scene(P);
    await pose(B.P, ...view); const offPage = await scene(B.P);
    let d2 = diff(offLive, offPage, PLAYER), retried = false;
    if (d2.frac > .01) {                                   // a whole-frame mismatch is a staging hiccup (one page not yet at the pose): pose both again, once
      retried = true; await pose(P, ...view); await P.evaluate(() => __l0v.dev.remaster(false)); await frames(P, 6); const a2 = await scene(P); await pose(B.P, ...view); d2 = diff(a2, await scene(B.P), PLAYER);
    }
    const bOff = await B.P.evaluate(() => ({ s: __l0v.stats(), lay: __l0v.dev.layers() }));
    check('S02 remaster OFF is exactly v23.3.6 / BR-RoLE 1.0: the live-toggled-off scene equals a ?remaster=off page at the same pose (the page with ?remaster=off has no remaster layer at all)',
      d2.frac < .0005 && !bOff.lay && bOff.s.ownLamps.length === 0, `YELLOW HALL spawn: ${d2.n} differing pixels (${(d2.frac * 100).toFixed(3)} %, max ${d2.max}) outside the wanderer${retried ? ' (after one re-pose)' : ''}; ?remaster=off layers ${JSON.stringify(bOff.lay)}, redirected lamps ${bOff.s.ownLamps.length}`);
    /* S03 */
    await P.evaluate(() => __clock.freeze(true)); await frames(P, 6);
    const hOn = await (async () => { await P.evaluate(() => __l0v.dev.remaster(true)); await frames(P, 6); return H.lightHash(P); })();
    const hOff = await (async () => { await P.evaluate(() => __l0v.dev.remaster(false)); await frames(P, 6); return H.lightHash(P); })();
    const hOn2 = await (async () => { await P.evaluate(() => __l0v.dev.remaster(true)); await frames(P, 6); return H.lightHash(P); })();
    const blk = await P.evaluate(() => JSON.stringify(__brRole.stats().blockers)), blkB = await B.P.evaluate(() => JSON.stringify(__brRole.stats().blockers));
    await P.evaluate(() => __clock.freeze(false));
    check('S03 BR-RoLE never sees the remaster: its light overlay is byte-identical with the remaster on, off and on again (frozen clock), and it has the same blockers as a ?remaster=off page',
      hOn === hOff && hOff === hOn2 && blk === blkB, `overlay sha-256 on ${hOn.slice(0, 12)} off ${hOff.slice(0, 12)} on ${hOn2.slice(0, 12)}; blockers ${blk}`);
    /* S04 */
    await P.evaluate(() => __clock.thaw());
    const kinds = async () => { await P.evaluate(() => { window.__sent.length = 0; }); await sleep(2500); return P.evaluate(() => [...new Set(window.__sent.map(m => { try { return JSON.parse(m[1]).t; } catch (e) { return '?'; } }))].sort()); };
    await P.evaluate(() => __l0v.dev.remaster(true)); const kOn = await kinds(); await P.evaluate(() => __l0v.dev.remaster(false)); const kOff = await kinds(); await P.evaluate(() => __l0v.dev.remaster(true));
    check('S04 gameplay untouched: the client sends the same kinds of messages with the remaster on and off', JSON.stringify(kOn) === JSON.stringify(kOff), `on ${JSON.stringify(kOn)}, off ${JSON.stringify(kOff)}`);
    /* S05 */
    await pose(P, ...view); const yOn = await scene(P); await P.evaluate(() => __l0v.dev.remaster(false)); await frames(P, 6); const yOff = await scene(P); await P.evaluate(() => __l0v.dev.remaster(true));
    const dy = diff(yOn, yOff, PLAYER);
    await pose(P, 3400, 3400, 0, false); const nOn = await scene(P); await P.evaluate(() => __l0v.dev.remaster(false)); await frames(P, 6); const nOff = await scene(P); await P.evaluate(() => __l0v.dev.remaster(true));
    const dn = diff(nOn, nOff, PLAYER), rep = await P.evaluate(() => __l0v.stats().rooms.map(r => r.id + ':' + r.visible).join(' '));
    check('S05 the remaster changes the slice rooms only: YELLOW HALL\'s picture changes; REPEATING ROOMS (not in the slice) stays as it was - the legacy carpet there is the same texture redrawn, so a few pixels (well under 0.1 %) may round differently by a few levels of 255 (sampler precision), invisible',
      dy.frac > .3 && dn.max <= 6 && dn.frac < .001,
      `YELLOW HALL ${(dy.frac * 100).toFixed(1)} % of pixels changed; REPEATING ROOMS: ${dn.n} pixels (${(dn.frac * 100).toFixed(3)} %) differ by more than 2 levels, the largest by ${dn.max} of 255; culled rooms there: ${rep}`);
    /* S06 */
    const tier = async q => { await P.evaluate(q => __brRole.setQuality(q), q); return H.until(() => P.evaluate(q => __l0v.stats().tier === q && __l0v.stats().built, q), 15000); };
    const lowOk = await tier('low'), sLow = await P.evaluate(() => __l0v.stats()); const highOk = await tier('high'), sHigh = await P.evaluate(() => __l0v.stats()); const medOk = await tier('medium');
    check('S06 quality tiers: switching BR-RoLE to LOW / HIGH / MEDIUM rebuilds the remaster at that tier (LOW: smaller textures, fewer decals), with no error',
      lowOk && highOk && medOk && sLow.texMPx < sHigh.texMPx && sLow.decals < sHigh.decals && !sHigh.disabled && !A.errs.length,
      `LOW ${sLow.texMPx} MPx / ${sLow.decals} decals / ${sLow.buildMs} ms; HIGH ${sHigh.texMPx} MPx / ${sHigh.decals} decals / ${sHigh.buildMs} ms; builds ${sHigh.builds}`);
    /* S07 */
    await pose(P, 1070, 3020, Math.PI, true); const base = await scene(P);
    await P.evaluate(() => __l0v.dev.depth(true)); await frames(P, 6); const dep = await scene(P); await P.evaluate(() => __l0v.dev.depth(false));
    await P.evaluate(() => __l0v.dev.decals(false)); await frames(P, 6); const nod = await scene(P); await P.evaluate(() => __l0v.dev.decals(true));
    const ddep = diff(base, dep, PLAYER), ddec = diff(base, nod, PLAYER);
    C = await page(browser, '&dev3b=1'); const before = await C.P.evaluate(() => __l0v.stats().on); await C.P.keyboard.press('F8'); await frames(C.P, 4);
    const after = await C.P.evaluate(() => __l0v.stats().on), tag = await C.P.evaluate(() => (document.getElementById('l0vTag') || {}).textContent || ''); await C.P.keyboard.press('F8');
    check('S07 DEV toggles: the wall-depth cue and the decals change the picture; with ?dev3b, F8 toggles the remaster live and the tag shows it',
      ddep.n > 50 && ddec.n > 50 && before && !after && /REMASTER OFF/.test(tag), `depth cue ${ddep.n} px, decals ${ddec.n} px; F8: on ${before} -> ${after}; tag "${tag.slice(0, 60)}"`);
    /* S08 */
    for (const J of [B, C]) { try { await J.ctx.close(); } catch (e) { } }      // one rendering page only while timing
    await pose(P, 1130, 3420, 2.6, true); await P.evaluate(() => __clock.thaw());
    const sample = async on => { await P.evaluate(on => __l0v.dev.remaster(on), on); await sleep(800);
      await P.evaluate(() => { __brRole.resetStats(); window.__pf = []; let last = performance.now(); const f = () => { if (!window.__pf) return; const t = performance.now(); window.__pf.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await sleep(9000); return P.evaluate(() => { const d = window.__pf.slice(1); window.__pf = null; const s = __brRole.stats().frameMs; return { mean: +(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length)).toFixed(1), n: d.length, br: s.mean }; }); };
    const pOff = await sample(false), pOn = await sample(true);
    check('S08 short performance sanity in YELLOW HALL (SwiftShader software rendering here, where every full-screen layer costs tens of ms: relative only): the frame interval with the remaster on stays within 35 % of off, BR-RoLE\'s own time unchanged',
      pOn.mean < pOff.mean * 1.35 + 5 && pOn.br < pOff.br * 1.3 + 2, `remaster off: ${pOff.mean} ms / frame (${pOff.n} frames), BR-RoLE ${pOff.br} ms; on: ${pOn.mean} ms (${pOn.n} frames), BR-RoLE ${pOn.br} ms`);
    const errs = [...A.errs, ...B.errs, ...C.errs]; if (errs.length) console.log('page errors: ' + JSON.stringify(errs).slice(0, 400));
  } catch (e) { check('harness', false, String(e && e.stack || e).slice(0, 600)); }
  await browser.close(); srv.kill();
  const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})();
