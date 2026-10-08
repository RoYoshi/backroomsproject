/* Stage 3B-L QA2 - the night-vision camcorder's infrared as a BR-RoLE light (development only; never served).
 *
 *   node dev/stage-3b-l-qa2/nv_qa2.js [--game PATH] [--parent DIR] [--port 9496] [--quality medium] [--tiers low,medium,high] [--out FILE.json]
 *
 * The halls' fluorescents forced off (only the infrared lights anything), the camcorder raised, night vision on, the
 * emitter LOW (or HIGH), the clock frozen.  Read back: BR-RoLE's light buffer (dev.light: QA2's infrared is in it) and the
 * darkness overlay the player sees (#light: both builds).  The QA1 parent's infrared (the bundle's stacked fans) is measured
 * the same way, on the overlay, for comparison.
 *   N1 (D) a wall face in the infrared is lit like the floor at its foot (faces receive it), its far side gets none;
 *          swept away, the face goes dark                                   (parent: the fans stopped 1 px short of walls)
 *   N2 (E) a pillar casts a real infrared shadow: the floor behind it gets none, the floor beside it in the cone is lit; its
 *          face turned to the lens is lit, its far face gets none
 *   N3 (F) a wall between the lens and the floor beyond it: nothing beyond it is lit or shown
 *   N4 (G) range and falloff: along the beam the light falls smoothly (no step) to a tail that ends at the emitter's range;
 *          across it the core eases into the outer field and that fades to nothing (no stepped cone, no rim)
 *   N5 no body glow: night vision on with the emitter OFF adds no light anywhere; with it on, nothing behind the camcorder
 *          past the lens spill (70 px)
 *   N6 the sensor only: NV off (camcorder raised) draws no infrared at all, and BR-RoLE computes none (stats)
 *   N7 LOW / MEDIUM / HIGH draw the same infrared (light at the same points)                                       */
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./qa2_lib.js'); const { H, frames } = Q;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PARENT = opt('parent') ? path.resolve(opt('parent')) : null;
const PORT = +(opt('port') || 9496), QUAL = opt('quality') || 'medium', TIERS = (opt('tiers') || 'low,medium,high').split(','), OUT = opt('out');
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const C = c => c * 96 + 48;
const mean = a => { const b = a.filter(v => v != null); return b.length ? b.reduce((s, v) => s + v, 0) / b.length : 0; }, mx = a => Math.max(0, ...a.filter(v => v != null)), mn = a => Math.min(1, ...a.filter(v => v != null));
const f1 = v => (v * 255).toFixed(1);

/* the scenes: positions in the BLACKOUT ZONE (the partition x 960 .. 1056, rows 51 .. 54) and PILLAR HALL (the pillar
 * 8564 .. 8620 x 1364 .. 1420); an open run for the falloff (from (2352, 5424) bearing 2.749 rad the cone is clear 700 px,
 * and HIGH's whole reach stays on screen) */
const ys = []; for (let y = C(51) + 10; y < C(54); y += 16) ys.push(y);
async function measure(GAMEDIR, port, quality, isQA2) {
  const s = await Q.open(GAMEDIR, port, { quality }), P = s.P, R = { version: await P.evaluate(() => __brRole.version) };
  const L = pts => isQA2 ? P.evaluate(p => __brRole.dev.light(p), pts) : Promise.resolve(pts.map(() => null)), O = pts => Q.overlayAt(P, pts);
  const cam = (x, y, aim, ir = 1, nv = true) => Q.scene(s, { x, y, aim, kind: 'camcorder', light: true, blackout: true, nv, ir });
  try {
    /* N1: the partition's east face (x 1056), 240 px from the lens */
    { const st = await cam(1296, 5136, Math.PI); const face = ys.map(y => [1050, y]), foot = ys.map(y => [1063, y]), far = ys.map(y => [966, y]);
      R.N1 = { st, faceL: await L(face), footL: await L(foot), farL: await L(far), faceO: await O(face), footO: await O(foot), farO: await O(far) };
      await cam(1296, 5136, -Math.PI / 2); R.N1.awayL = await L(face); R.N1.awayO = await O(face);
      R.N1.ir = await P.evaluate(() => __brRole.stats().ir || null); }
    /* N2: the pillar, its east face 140 px from the lens */
    { await cam(8760, 1392, Math.PI); const fe = [], fw = [], behind = [], beside = [];
      for (let y = 1370; y <= 1414; y += 4) { fe.push([8614, y]); fw.push([8570, y]); }
      for (let x = 8380; x <= 8540; x += 10) for (let y = 1376; y <= 1408; y += 8) behind.push([x, y]);
      for (let x = 8480; x <= 8540; x += 10) for (const y of [1290, 1300, 1484, 1494]) beside.push([x, y]);
      const lens = await P.evaluate(() => { const b = __api.beam() || __api.H; return [b.x, b.y]; });
      const hid = await P.evaluate(([lx, ly, pts]) => pts.map(([x, y]) => { const d = Math.hypot(x - lx, y - ly); return __api.Uc(lx, ly, Math.atan2(y - ly, x - lx), d) < d - .5; }), [lens[0], lens[1], behind.concat(beside)]);
      R.N2 = { lens, feL: await L(fe), fwL: await L(fw), behindL: await L(behind), besideL: await L(beside), feO: await O(fe), fwO: await O(fw), behindO: await O(behind), besideO: await O(beside), behindHidden: hid.slice(0, behind.length).filter(Boolean).length, behindN: behind.length, besideSeen: hid.slice(behind.length).filter(v => !v).length, besideN: beside.length }; }
    /* N3: the partition 94 px in front of the lens: the floor beyond it */
    { await cam(1150, 5136, Math.PI); const beyond = []; for (let x = 880; x <= 950; x += 10) for (let y = 4930; y <= 5260; y += 30) beyond.push([x, y]);
      R.N3 = { beyondL: await L(beyond), beyondO: await O(beyond), n: beyond.length }; }
    /* N4: along and across the beam, LOW and HIGH */
    R.N4 = {};
    for (const ir of [1, 2]) { await cam(2352, 5424, 2.749, ir);
      const g = await P.evaluate(() => { const b = __api.beam() || __api.H; return { x: b.x, y: b.y, a: b.angle ?? __api.H.angle, range: __cam.CFG.IR[__cam.ir].range }; });
      const along = [], across = []; for (let d = 4; d <= g.range + 60; d += 4) along.push([g.x + Math.cos(g.a) * d, g.y + Math.sin(g.a) * d]);
      const dA = .45 * g.range; for (let p = -.62; p <= .62 + 1e-9; p += .01) across.push([g.x + Math.cos(g.a + p) * dA, g.y + Math.sin(g.a + p) * dA]);
      R.N4[ir] = { g, alongL: await L(along), alongO: await O(along), acrossL: await L(across), acrossO: await O(across) }; }
    /* N5: no body glow - NV on, emitter OFF (everything); emitter on, behind the camcorder */
    { await cam(1776, 5136, 1.178, 0); const ring = []; for (let k = 0; k < 24; k++) for (const d of [10, 30, 60, 120, 240]) ring.push([1776 + Math.cos(k * Math.PI / 12) * d, 5136 + Math.sin(k * Math.PI / 12) * d]);
      R.N5 = { offL: await L(ring), offO: await O(ring) };
      await cam(1776, 5136, 1.178, 1); const b = await P.evaluate(() => { const b = __api.beam() || __api.H; return [b.x, b.y, b.angle ?? __api.H.angle]; }); const back = [];
      for (let p = -1.2; p <= 1.2; p += .2) for (const d of [80, 120, 200]) back.push([b[0] + Math.cos(b[2] + Math.PI + p) * d, b[1] + Math.sin(b[2] + Math.PI + p) * d]);
      R.N5.backL = await L(back); R.N5.backO = await O(back); }
    /* N6: NV off (raised): no infrared */
    { await cam(1296, 5136, Math.PI, 1, false); const face = ys.map(y => [1050, y]), floor = []; for (let d = 30; d <= 230; d += 20) floor.push([1296 - d, 5136]);
      R.N6 = { nv: await P.evaluate(() => __cam.nv), faceL: await L(face.concat(floor)), faceO: await O(face.concat(floor)), stats: await P.evaluate(() => (__brRole.stats().ir) || null) }; }
    R.errs = s.J.errs;
  } finally { await Q.close(s); }
  return R;
}
(async () => {
  const OUTR = { game: GAME, parent: PARENT, quality: QUAL };
  OUTR.qa2 = await measure(GAME, PORT, QUAL, true);
  if (PARENT) OUTR.parent = await measure(PARENT, PORT + 1, QUAL, false);
  const q = OUTR.qa2, p = OUTR.parent;
  /* N1 */
  { const r = q.N1, lit = r.faceL.map((v, i) => [v, r.footL[i]]).filter(([v, f]) => f > 8 / 255), ok = lit.filter(([v, f]) => v >= .35 * f - 2 / 255).length;
    check('N1 (D) a wall face in the infrared is lit like the floor at its foot, its far side gets none; swept away it goes dark', lit.length >= 10 && ok === lit.length && mx(r.farL) < 1 / 255 && mn(r.farO) > .99 && mean(r.awayL) < .3 * mean(r.faceL),
      `face ${f1(mean(r.faceL))}/255 (floor at its foot ${f1(mean(r.footL))}; ${ok}/${lit.length} lit samples carry it), shown ${f1(1 - mean(r.faceO))}/255 on the overlay` + (p ? ` (parent ${f1(1 - mean(p.N1.faceO))})` : '') + `; far side ${f1(mx(r.farL))}/255, overlay min ${mn(r.farO).toFixed(3)}; swept away ${f1(mean(r.awayL))}/255`); }
  /* N2 */
  { const r = q.N2, hidL = r.behindL.filter((v, i) => true);
    check('N2 (E) a pillar casts a real infrared shadow; its face turned to the lens is lit, its far face gets none', r.behindHidden === r.behindN && mx(r.behindL) < 1 / 255 && mn(r.behindO) > .99 && r.besideSeen >= .9 * r.besideN && mean(r.besideL) > 4 / 255 && mean(r.feL) > 8 / 255 && mx(r.fwL) < 1 / 255 && mn(r.fwO) > .99,
      `floor behind the pillar (${r.behindHidden}/${r.behindN} hidden from the lens): max ${f1(mx(r.behindL))}/255, overlay min ${mn(r.behindO).toFixed(3)}` + (p ? ` (parent overlay min ${mn(p.N2.behindO).toFixed(3)})` : '') + `; beside it in the cone ${f1(mean(r.besideL))}/255; face to the lens ${f1(mean(r.feL))}/255 (overlay shows ${f1(1 - mean(r.feO))}` + (p ? `, parent ${f1(1 - mean(p.N2.feO))}` : '') + `), far face max ${f1(mx(r.fwL))}/255`); }
  /* N3 */
  { const r = q.N3; check('N3 (F) a wall between the lens and the floor beyond: nothing beyond it is lit or shown', mx(r.beyondL) < 1 / 255 && mn(r.beyondO) > .99,
      `${r.n} points beyond the partition: light max ${f1(mx(r.beyondL))}/255, overlay min ${mn(r.beyondO).toFixed(3)}` + (p ? ` (parent overlay min ${mn(p.N3.beyondO).toFixed(3)})` : '')); }
  /* N4: smoothness - the largest step between neighbouring samples (4 px along, .01 rad across), past the lens spill */
  { const stepOf = (a, from = 0) => { let m = 0; for (let i = from + 1; i < a.length; i++) if (a[i] != null && a[i - 1] != null) m = Math.max(m, Math.abs(a[i] - a[i - 1])); return m; };
    const lightO = a => a.map(v => v == null ? null : 1 - v), rows = [];
    let ok = true;
    for (const ir of [1, 2]) { const r = q.N4[ir], g = r.g, i0 = Math.ceil(80 / 4) - 1, alongL = r.alongL, peak = mx(alongL.slice(i0)), at = u => alongL[Math.round(u * g.range / 4) - 1];
      const tail = at(.9), end = alongL.findIndex((v, i) => i > i0 && v != null && v < 1 / 255) * 4 + 4, onScreen = alongL.every(v => v != null);
      const sAL = stepOf(alongL, i0), sAO = stepOf(lightO(r.alongO), i0), sXL = stepOf(r.acrossL), sXO = stepOf(lightO(r.acrossO));
      const pr = p ? p.N4[ir] : null, pAO = pr ? stepOf(lightO(pr.alongO), i0) : null, pXO = pr ? stepOf(lightO(pr.acrossO)) : null;
      const pend = pr ? (() => { const a = lightO(pr.alongO); let last = 0; for (let i = i0; i < a.length; i++) if (a[i] > 2 / 255) last = (i + 1) * 4; return last; })() : null;
      const relX = sXL / Math.max(1e-6, mx(r.acrossL)), relPX = pr ? stepOf(lightO(pr.acrossO)) / Math.max(1e-6, mx(lightO(pr.acrossO))) : null;
      if (!(onScreen && sAL < .03 && relX < .1 && (relPX == null || relX < .5 * relPX) && tail > 0 && tail < .25 * peak && end > .9 * g.range && end <= g.range + 8)) ok = false;
      rows.push(`${ir === 1 ? 'LOW' : 'HIGH'} (range ${g.range}): along the beam largest 4 px step ${f1(sAL)}/255 in the light (${f1(sAO)} on the overlay` + (pr ? `; parent ${f1(pAO)}` : '') + `), at 90 % of the range ${f1(tail)}/255 of a ${f1(peak)} peak, light ends at ${end} px` + (pr ? ` (parent's last light at ${pend} px)` : '') + `; across it largest .01 rad step ${f1(sXL)}/255 = ${(100 * relX).toFixed(1)} % of its peak (overlay ${f1(sXO)}` + (pr ? `; parent ${f1(pXO)} = ${(100 * relPX).toFixed(1)} %` : '') + `)`);
    }
    check('N4 (G) range and falloff: smooth along and across the beam, a tail that ends at the emitter\'s range (no stepped cone, no rim)', ok, rows.join(' | ')); }
  /* N5 */
  { const r = q.N5; check('N5 no body glow: NV on with the emitter OFF adds no light; with it on, none behind the camcorder past the lens spill', mx(r.offL) < 1 / 255 && mn(r.offO) > .99 && mx(r.backL) < 1 / 255,
      `emitter off: light max ${f1(mx(r.offL))}/255 at ${r.offL.length} points round the player (overlay min ${mn(r.offO).toFixed(3)}); emitter on, behind it (80 .. 200 px): max ${f1(mx(r.backL))}/255`); }
  /* N6 */
  { const r = q.N6; check('N6 the sensor only: NV off (camcorder raised) draws no infrared and BR-RoLE computes none', !r.nv && mx(r.faceL) < 1 / 255 && mn(r.faceO) > .99 && (!r.stats || r.stats.last === 0),
      `NV ${r.nv ? 'on' : 'off'}: light max ${f1(mx(r.faceL))}/255, overlay min ${mn(r.faceO).toFixed(3)}; BR-RoLE infrared lights drawn ${r.stats ? r.stats.last : '-'}`); }
  /* N7: tiers */
  if (TIERS.length > 1) {
    const T = {}; for (const t of TIERS) T[t] = t === QUAL ? q : await measure(GAME, PORT + 3, t, true);
    const pts = t => T[t].N1.faceL.concat(T[t].N1.footL, T[t].N2.feL, T[t].N2.besideL, T[t].N4[1].alongL, T[t].N4[1].acrossL);
    const diff = (a, b) => { const A = pts(a), B = pts(b), d = A.map((v, i) => v == null || B[i] == null ? null : Math.abs(v - B[i])).filter(v => v != null); d.sort((x, y) => x - y); return { mean: mean(d) * 255, p95: d[Math.floor(.95 * (d.length - 1))] * 255, n: d.length }; };
    const rows = TIERS.filter(t => t !== 'medium').map(t => { const r = diff(t, 'medium'); OUTR['tier_' + t] = r; return `|${t.toUpperCase()} - MEDIUM| mean ${r.mean.toFixed(2)} / p95 ${r.p95.toFixed(1)} /255 over ${r.n} points`; });
    const ok = TIERS.filter(t => t !== 'medium').every(t => OUTR['tier_' + t].mean < 4 && OUTR['tier_' + t].p95 < 10);
    OUTR.tiers = Object.fromEntries(TIERS.map(t => [t, { faceMean: mean(T[t].N1.faceL) * 255, alongMean: mean(T[t].N4[1].alongL) * 255 }]));
    check('N7 LOW / MEDIUM / HIGH draw the same infrared (the light at the same points)', ok, rows.join('; ') + ' (tiers differ in buffer resolution and source points only)');
  }
  const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ results, R: OUTR }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
