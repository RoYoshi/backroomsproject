/* Stage 3B-L QA1 - surface receivers: legitimate lights light the wall and pillar faces they reach (development only; never
 * served).
 *
 *   node dev/stage-3b-l-qa1/receivers_qa1.js [--game PATH] [--port 9492] [--quality medium] [--lamps N] [--out FILE.json]
 *
 * A wall's (or pillar's) visible face is a band inside it along its edge.  Checked from BR-RoLE's own caches and light buffer:
 *   F1 ceiling lamps: for the lamps audited, every face turned towards the lamp whose foot (the floor strip in front of it) the
 *      lamp lights carries that light onto its band (band ~ strip x (base + k cos)); every face turned AWAY gets none
 *   F2 the same for pillar faces: a pillar's lit side brighter than its far side (which gets none of that lamp)
 *   F3 a face's light follows the source: a wall face whose foot the lamp does not reach (blocked) gets none
 *   C1 a carried light: a flashlight aimed at a wall lights that wall's face (rendered light buffer); swept away, the face goes
 *      dark again; a lantern lights the faces around it; nothing is added on the player's body when every light is off
 *   C2 no face light through a blocker: faces on the far side of a wall from the flashlight stay dark */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9492), Q = opt('quality') || 'medium', OUT = opt('out'), NL = +(opt('lamps') || 12);
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const C = c => c * 96 + 48;
/* in the page: one lamp's faces against its core cache */
const AUDIT = `window.__rcv = function (i) {
  const A = __api, R = __brRole, L = A.lamps[i], K = R.dev.constants(), F = K.FACE || null, info = R.dev.cacheInfo(i); if (!info) return null;
  const tube = R.dev.tube(i), sees = (sx, sy, x, y) => { const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy); return d < .5 || A.Uc(sx, sy, Math.atan2(dy, dx), d) >= d - .5; };
  const lit = (x, y) => tube.some((v, k) => k % 2 === 0 && sees(tube[k], tube[k + 1], x, y));
  const out = { i, toward: [], away: [], blocked: [] }, ext = Math.min(info.core.hx, info.core.hy) - 30;
  for (const f of R.dev.bands(L.x - ext, L.y - ext, L.x + ext, L.y + ext)) {
    const [nx, ny] = f.n, hor = ny !== 0, b = f.band, s = f.strip, along0 = hor ? b[0] : b[1], along1 = hor ? b[2] : b[3];
    const turned = (L.x - f.edge[0]) * nx + (L.y - f.edge[1]) * ny > .5;
    const pts = [], deep = hor ? (b[3] - b[1]) : (b[2] - b[0]);
    for (let u = along0 + 6; u < along1 - 6; u += 12) {
      const sp = hor ? [u, (s[1] + s[3]) / 2] : [(s[0] + s[2]) / 2, u], bp = hor ? [u, ny > 0 ? b[3] - 4 : b[1] + 4] : [nx > 0 ? b[2] - 4 : b[0] + 4, u], bdeep = hor ? [u, ny > 0 ? b[1] + 3 : b[3] - 3] : [nx > 0 ? b[0] + 3 : b[2] - 3, u];
      pts.push({ sp, bp, bdeep });
    }
    if (!pts.length) continue;
    const v = R.dev.cache(i, pts.flatMap(p => [p.sp, p.bp, p.bdeep]));
    for (let n = 0; n < pts.length; n++) {
      const st = v[3 * n].core, bd = v[3 * n + 1].core, dp = v[3 * n + 2].core, foot = lit(pts[n].sp[0], pts[n].sp[1]);
      const rec = { j: f.j, pillar: f.pillar, at: pts[n].bp.map(Math.round), strip: +(st * 255).toFixed(1), band: +(bd * 255).toFixed(1), deep: +(dp * 255).toFixed(1), foot };
      if (!turned) out.away.push(rec); else if (foot) out.toward.push(rec); else out.blocked.push(rec);
    }
  }
  return out;
};`;
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { lamps: [] };
  try {
    const J = await H.join(browser, PORT, 'rcv' + Date.now() % 1e5, 'RCV', { viewport: { width: 1920, height: 1080 }, query: '&lighting=' + Q, init: AUDIT }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    /* lamps with faces close by: the ones nearest a wall or pillar side */
    /* (a lamp whose centre is inside a blocker - the parent's PILLAR HALL fixtures sit on pillars - lights its own blocker from
     * inside: it is not a receiver case; those are counted and left out) */
    const sel = await P.evaluate(n => { const A = __api, R = __brRole, out = [], inside = [];
      A.lamps.forEach((L, i) => { if (A.Hc(Math.floor(L.x / 96), Math.floor(L.y / 96)) || (A.Bc(L.x, L.y) || []).some(r => r && r.w === 56 && L.x > r.x && L.x < r.x + r.w && L.y > r.y && L.y < r.y + r.h)) { inside.push(i); return; } const f = R.dev.bands(L.x - 220, L.y - 220, L.x + 220, L.y + 220); if (f.length) out.push([f.length + (f.some(q => q.pillar) ? 40 : 0), i]); });
      out.sort((a, b) => b[0] - a[0] || a[1] - b[1]); return { list: out.slice(0, n).map(q => q[1]), inside }; }, NL);
    const list = sel.list; R.lampsInsideBlockers = sel.inside;
    let toward = [], away = [], blocked = [];
    for (const i of list) {
      const L = await P.evaluate(i => [__api.lamps[i].x, __api.lamps[i].y], i);
      await H.place(P, L[0], L[1] + 60, 0, { light: false });
      for (let k = 0; k < 120; k++) { await frames(P, 3); if (await P.evaluate(i => !!__brRole.dev.cacheInfo(i), i)) break; }
      const r = await P.evaluate(i => window.__rcv(i), i); if (!r) continue;
      /* the same samples with the surface receivers off (DEV switch; every cache rebuilt): what the face light itself adds */
      await P.evaluate(() => __brRole.dev.faces(false)); await frames(P, 3);
      for (let k = 0; k < 120; k++) { await frames(P, 3); if (await P.evaluate(i => !!__brRole.dev.cacheInfo(i), i)) break; }
      const r0 = await P.evaluate(i => window.__rcv(i), i);
      await P.evaluate(() => __brRole.dev.faces(true)); await frames(P, 3);
      for (const key of ['toward', 'away', 'blocked']) r[key].forEach((t, n) => { const o = r0 && r0[key][n]; t.off = o && o.j === t.j ? o.band : null; t.added = t.off == null ? null : +(t.band - t.off).toFixed(1); });
      R.lamps.push(r);
      toward = toward.concat(r.toward); away = away.concat(r.away); blocked = blocked.concat(r.blocked);
    }
    /* F1 / F2: lit faces carry their foot's light; faces turned away get none */
    const lit = toward.filter(t => t.strip >= 6), ratio = lit.map(t => t.band / t.strip), litOk = lit.filter(t => t.band >= .4 * t.strip - 2).length;
    /* a face turned away: the face light adds nothing to it (A/B, the receivers off: the same cache otherwise; > 1/255 = added).
     * Its absolute light is reported too: the core mask's 3 px blur reaches a few px past a lit edge, as in BR-RoLE 1.0 / 1.1 */
    const awayBad = away.filter(t => t.added == null || t.added > 1), awayLeak = away.filter(t => t.band > 3);
    const pT = lit.filter(t => t.pillar), pA = away.filter(t => t.pillar);
    check('F1 ceiling lamps light the wall faces turned to them (band ~ the floor at its foot x facing), and none turned away', lit.length > 40 && litOk >= .95 * lit.length && !awayBad.length,
      `${R.lamps.length} lamps; ${lit.length} lit face samples: band / foot ${(Math.min(...ratio)).toFixed(2)} .. ${(Math.max(...ratio)).toFixed(2)} (${litOk} carry it); faces turned away ${away.length} samples: face light added to them ${awayBad.length}${awayBad.length ? ' e.g. ' + JSON.stringify(awayBad.slice(0, 2)) : ''} (max added ${Math.max(0, ...away.map(t => t.added || 0)).toFixed(1)}/255; ${awayLeak.length} sit within the mask blur of a lit edge, max ${Math.max(0, ...away.map(t => t.band)).toFixed(1)}/255 with or without receivers)`);
    const blkBad = blocked.filter(t => t.added == null || t.added > 1 || t.band > 3);
    check('F3 a face whose foot the lamp does not reach (blocked) receives none of its light', !blkBad.length,
      `${blocked.length} blocked face samples, lit ${blkBad.length}${blkBad.length ? ' e.g. ' + JSON.stringify(blkBad.slice(0, 2)) : ''}`);
    /* C1 / C2: carried lights in the BLACKOUT ZONE (no lamp reaches it): the partition at x 960..1056 (cells 10, rows 51..54) */
    const at = async (x, y, aim, kind, on) => { await H.place(P, x, y, aim, { light: on, kind }); await frames(P, 8); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 4); };
    const read = pts => P.evaluate(p => __brRole.dev.light(p), pts);
    const face = []; for (let y = C(51) + 10; y < C(54); y += 16) face.push([1056 - 6, y]);   // the partition's east face band (turned to the player's side)
    const back = []; for (let y = C(51) + 10; y < C(54); y += 16) back.push([960 + 6, y]);    // its west face band (the far side)
    const floor = []; for (let y = C(51) + 10; y < C(54); y += 16) floor.push([1056 + 8, y]);
    await at(C(13), C(53), Math.PI, 'flashlight', true); const on1 = await read(face), fl1 = await read(floor), bk1 = await read(back); await P.evaluate(() => window.__clock.thaw());
    await at(C(13), C(53), -Math.PI / 2, 'flashlight', true); const off1 = await read(face); await P.evaluate(() => window.__clock.thaw());
    await at(C(12), C(53), 0, 'lantern', true); const lan = await read(face); await P.evaluate(() => window.__clock.thaw());
    await at(C(13), C(53), Math.PI, 'flashlight', false); const none = await read(face.concat(floor)); await P.evaluate(() => window.__clock.thaw());
    const mean = a => a.filter(v => v !== null).reduce((s, v) => s + v, 0) / Math.max(1, a.filter(v => v !== null).length), mx = a => Math.max(0, ...a.filter(v => v !== null));
    R.carried = { on1, off1, lan, none, fl1, bk1 };
    check('C1 carried light lights the wall face it hits; swept away, the face darkens; a lantern lights it from beside; nothing with every light off', mean(on1) > .1 && mean(off1) < .3 * mean(on1) && mean(lan) > .05 && mx(none) < 1 / 255,
      `face light: flashlight on it ${(mean(on1) * 255).toFixed(1)}/255 (floor at its foot ${(mean(fl1) * 255).toFixed(1)}), swept away ${(mean(off1) * 255).toFixed(1)}, lantern ${(mean(lan) * 255).toFixed(1)}, all lights off max ${(mx(none) * 255).toFixed(1)}/255`);
    check('C2 no face light through the wall: its far side stays dark while the flashlight lights the near side', mx(bk1) < 1 / 255, `far-side face max ${(mx(bk1) * 255).toFixed(1)}/255`);
    /* F2 also with a flashlight on a PILLAR HALL pillar, the lamps off (blackout): its near face lit, its far face dark */
    await H.setLights(P, 'on'); for (let k = 0; k < 40 && !(await P.evaluate(() => !!__api.V.blackout)); k++) { await H.setLights(P, 'on'); await sleep(300); }
    R.blackoutForF2 = await P.evaluate(() => !!__api.V.blackout);
    const pil = await P.evaluate(() => { const b = __brRole.dev.bands(7550, 800, 7720, 1000).filter(f => f.pillar); return b.length ? b : null; });
    let pNear = null, pFar = null;
    if (pil) { await H.place(P, C(81), C(9.5), Math.PI, { light: true, kind: 'flashlight' }); await frames(P, 8); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 4);
      const e = pil.find(f => f.n[0] === 1), w = pil.find(f => f.n[0] === -1);
      if (e && w) { const ys = []; for (let y = e.band[1] + 4; y < e.band[3] - 2; y += 6) ys.push(y);
        pNear = await P.evaluate(pts => __brRole.dev.light(pts), ys.map(y => [e.band[2] - 3, y])); pFar = await P.evaluate(pts => __brRole.dev.light(pts), ys.map(y => [w.band[0] + 3, y])); }
      await P.evaluate(() => window.__clock.thaw()); }
    await H.setLights(P, 'off');
    const avg = a => a ? a.reduce((s, v) => s + (v || 0), 0) / Math.max(1, a.length) : 0;
    check('F2 pillar faces: the side turned to the light is lit, its far side gets none of that light', avg(pNear) > .08 && Math.max(0, ...(pFar || [1])) < 1 / 255 && !pA.some(t => t.added == null || t.added > 1),
      `flashlight on a PILLAR HALL pillar (lamps off): near face ${(avg(pNear) * 255).toFixed(1)}/255, far face max ${pFar ? (Math.max(0, ...pFar) * 255).toFixed(1) : '-'}/255; lamp-lit pillar faces ${pT.length} samples, pillar faces turned away from a lamp ${pA.length} (face light added max ${pA.length ? Math.max(...pA.map(t => t.added || 0)) : '-'}/255); lamps sitting inside a blocker (left out) ${R.lampsInsideBlockers.length}`);
    R.errs = J.errs;
  } finally { await browser.close(); srv.kill(); }
  const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ results, R }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
