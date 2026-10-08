/* Stage 3B pillar LOS - the same frozen frame drawn by the parent and by the correction: the light is unchanged, only the
 * darkness clip moved (development only; never served).
 *
 *   node dev/stage-3b-pillar-los/ab_los.js --parent DIR [--game PATH] [--ports 9494,9495] [--out DIR]
 *
 * Two servers, two pages (1920 x 1080, MEDIUM, ceiling lamps on, no monsters), the same position, aim and carried light,
 * both frozen clocks set to the same instant.  Per scene, from the light canvas (the darkness overlay the player sees):
 *   - pixels inside BOTH builds' darkness clips (more than 3 px from either outline, where the canvas clip's antialiasing
 *     makes a pixel partly covered): the overlay must be identical there (the ceiling lamps, BR-RoLE's wall / pillar face
 *     receivers, the carried light, light blocked by pillars and walls - all unchanged);
 *   - pixels inside only one clip: the presentation change itself (counted; the correction's clip is drawn on the picture);
 *   - the correction's clip at LOW / MEDIUM / HIGH (BR-RoLE's tier switched in place): identical polygons, so every quality
 *     setting shows the same hidden space.
 * Scenes: PILLAR HALL (QA1 scene D), a flashlight on a pillar's south face, a lantern beside a pillar, a headlamp across the
 * hall's diagonal, the YELLOW HALL partition (QA1 scene C, walls only) and the long corridor (QA1 scene H, walls only). */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const sharp = (() => { try { return require('sharp'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } })();
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PARENT = path.resolve(opt('parent'));
const [PA, PB] = (opt('ports') || '9494,9495').split(',').map(Number), OUT = path.resolve(opt('out') || '/tmp/ablos'); fs.mkdirSync(OUT, { recursive: true });
const C = c => c * 96 + 48, PX = 8592, PY = 1392;
const SCENES = [
  ['D', 'PILLAR HALL (QA1 scene D)', C(82), C(12), 0, null],
  ['FL', 'flashlight on a pillar\'s south face', PX, PY + 110, -Math.PI / 2, 'flashlight'],
  ['LA', 'lantern beside a pillar', PX + 80, PY + 40, Math.PI, 'lantern'],
  ['HD', 'headlamp across PILLAR HALL\'s diagonal', 8330, 1650, -Math.PI / 4, 'headlamp'],
  ['C', 'YELLOW HALL partition (QA1 scene C, walls only)', C(12.5), C(33), Math.PI, null],
  ['H', 'long corridor (QA1 scene H, walls only)', C(11.5), C(22), -Math.PI / 2, null],
];
const CLIPTAP = `(() => { const P = CanvasRenderingContext2D.prototype, mt = P.moveTo, lt = P.lineTo, cl = P.clip, bp = P.beginPath, cr = P.clearRect;
  let path = null; const L = c => c.canvas && c.canvas.id === 'light';
  P.beginPath = function () { if (L(this)) path = []; return bp.apply(this, arguments); };
  P.moveTo = function (x, y) { if (path && L(this)) path.push(x, y); return mt.apply(this, arguments); };
  P.lineTo = function (x, y) { if (path && L(this)) path.push(x, y); return lt.apply(this, arguments); };
  P.clearRect = function () { if (L(this)) this.__first = true; return cr.apply(this, arguments); };
  P.clip = function () { if (L(this) && this.__first) { this.__first = false; window.__sceneClip = path ? path.slice() : null; } return cl.apply(this, arguments); };
})();`;
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const ready = P => P.evaluate(() => { const B = window.__brRole; if (!B || !B.dev || !B.dev.farReady) return true; const s = B.stats(); return B.dev.farReady() && s.lamps.pending === 0 && (!B.dev.mapReady || B.dev.mapReady()); });
const T0 = 400000;                                                                  /* the shared frozen instant (ms) */
async function shot(P, sc) {
  const [, , x, y, aim, kind] = sc;
  /* every scene from a clean state: no monsters, god mode, frozen halls (a director spawn while a slow page was unfrozen
   * could otherwise end the run) - and a page that is not alive is an error, not a picture */
  await H.stage(P);
  if (await P.evaluate(() => !!(__api.death && __api.death() && __api.death().active))) throw Error('the wanderer is dead on ' + P.url());
  await H.place(P, x, y, aim, { light: !!kind, kind: kind || 'flashlight' });
  await P.evaluate(() => window.__clock.thaw());
  for (let k = 0; k < 200; k++) { await frames(P, 4); if (await ready(P)) break; }
  await frames(P, 30); await P.evaluate(t => window.__clock.set(t, 0), T0); await frames(P, 8);
  for (let k = 0; k < 40; k++) { await frames(P, 3); if (await ready(P)) break; } await frames(P, 12); await H.settle(P);
  if (await P.evaluate(() => !!(__api.death && __api.death() && __api.death().active))) throw Error('the wanderer died during the shot on ' + P.url());
  return P.evaluate(() => { const c = document.getElementById('light'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = ''; const CH = 0x8000;
    for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
    return { w: c.width, h: c.height, rgba: btoa(s), clip: window.__sceneClip, at: [__api.H.x, __api.H.y] }; });
}
/* a clip as a pixel mask (inside), and a 3 px band either side of its outline (where the canvas clip's antialiasing makes a
 * pixel partly inside: those pixels are compared separately) */
const mask = async (clip, w, h, edge) => { let pts = ''; for (let i = 0; i < clip.length; i += 2) pts += `${clip[i].toFixed(2)},${clip[i + 1].toFixed(2)} `;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon points="${pts}" ${edge ? 'fill="none" stroke="#fff" stroke-width="6"' : 'fill="#fff"'} shape-rendering="crispEdges"/></svg>`)).extractChannel(0).raw().toBuffer(); };
(async () => {
  for (const p of [PA, PB]) try { execSync(`fuser -k ${p}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const sA = spawn('node', ['server.js', String(PA)], { cwd: PARENT, stdio: 'ignore' }), sB = spawn('node', ['server.js', String(PB)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get(PA, '/index.html') === 200 && await get(PB, '/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { parent: PARENT, game: GAME, scenes: [], tiers: [] };
  try {
    const opts = { viewport: { width: 1920, height: 1080 }, query: '&lighting=medium', init: CLIPTAP };
    const JA = await H.join(browser, PA, 'aba' + Date.now() % 1e5, 'ABA', opts), JB = await H.join(browser, PB, 'abb' + Date.now() % 1e5, 'ABB', opts);
    for (const J of [JA, JB]) { await H.stage(J.P); await H.setLights(J.P, 'off'); }
    for (const sc of SCENES) {
      const a = await shot(JA.P, sc), b = await shot(JB.P, sc);
      const A = Buffer.from(a.rgba, 'base64'), B = Buffer.from(b.rgba, 'base64'), w = a.w, h = a.h;
      const mA = await mask(a.clip, w, h), mB = await mask(b.clip, w, h), eA = await mask(a.clip, w, h, 1), eB = await mask(b.clip, w, h, 1);
      let both = 0, same = 0, maxD = 0, onlyA = 0, onlyB = 0, sumD = 0, edge = 0, edgeDiff = 0;
      for (let i = 0, p = 0; p < w * h; p++, i += 4) { const ia = mA[p] > 127, ib = mB[p] > 127, d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]), Math.abs(A[i + 3] - B[i + 3]));
        if (eA[p] > 0 || eB[p] > 0) { edge++; if (d) edgeDiff++; continue; }
        if (ia && ib) { both++; if (!d) same++; sumD += d; if (d > maxD) maxD = d; }
        else if (ia) onlyA++; else if (ib) onlyB++; }
      const row = { id: sc[0], label: sc[1], at: [a.at, b.at], clipVerts: [a.clip.length / 2, b.clip.length / 2], insideBoth: both, identicalInsideBoth: same, identicalShare: +(same / both).toFixed(6), meanDiff: +(sumD / both).toFixed(4), maxDiff: maxD, onlyParentClip: onlyA, onlyFixClip: onlyB, edgeBand: edge, edgeBandDiffering: edgeDiff };
      R.scenes.push(row); console.log(sc[0], '|', sc[1], '| inside both clips', both, 'px: identical', row.identicalShare, 'max diff', maxD, '| only in parent clip', onlyA, 'px, only in fix clip', onlyB, 'px | within 3 px of either outline', edge, 'px (' + edgeDiff + ' differ)');
      /* the picture: the correction's overlay as an image, its clip outlined, the parent's dashed */
      const pts = c => { let s = ''; for (let i = 0; i < c.length; i += 2) s += `${c[i].toFixed(1)},${c[i + 1].toFixed(1)} `; return s; };
      await sharp(await JB.P.screenshot()).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><polygon points="${pts(a.clip)}" fill="none" stroke="#ffd400" stroke-width="2" stroke-dasharray="8 6"/><polygon points="${pts(b.clip)}" fill="none" stroke="#ff2bd6" stroke-width="2"/></svg>`) }]).jpeg({ quality: 80 }).toFile(path.join(OUT, `ab_${sc[0]}.jpg`));
      await JA.P.evaluate(() => window.__clock.thaw()); await JB.P.evaluate(() => window.__clock.thaw());
    }
    /* tiers: the correction's clip at LOW / MEDIUM / HIGH, same frozen frame */
    for (const sc of [SCENES[0], SCENES[2]]) { await shot(JB.P, sc); const clips = {};
      for (const q of ['low', 'medium', 'high']) { await JB.P.evaluate(q => __brRole.setQuality(q), q); await frames(JB.P, 10); await H.settle(JB.P); clips[q] = await JB.P.evaluate(() => window.__sceneClip); }
      await JB.P.evaluate(() => { __brRole.setQuality('medium'); window.__clock.thaw(); });
      const same = JSON.stringify(clips.low) === JSON.stringify(clips.medium) && JSON.stringify(clips.high) === JSON.stringify(clips.medium);
      R.tiers.push({ id: sc[0], verts: clips.medium.length / 2, identical: same }); console.log('tiers', sc[0], '| LOW / MEDIUM / HIGH darkness clip identical:', same, '(' + clips.medium.length / 2 + ' vertices)'); }
    R.errs = [JA.errs, JB.errs]; if (JA.errs.length || JB.errs.length) console.log('page errors:', JA.errs.concat(JB.errs).slice(0, 5).join(' | '));
  } finally { await browser.close(); sA.kill(); sB.kill(); }
  fs.writeFileSync(path.join(OUT, 'ab.json'), JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
