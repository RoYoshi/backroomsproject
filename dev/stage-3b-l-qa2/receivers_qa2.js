/* Stage 3B-L QA2 - wall / pillar face receivers at corners (development only; never served).  (QA1's receivers_qa1.js
 * checks, with QA2's mitred corners, plus the corner checks; the corner checks also run on the QA1 parent for comparison.)
 *
 *   node dev/stage-3b-l-qa2/receivers_qa2.js [--game PATH] [--parent DIR] [--port 9494] [--quality medium] [--lamps 12] [--out FILE.json]
 *
 * QA1's checks (BR-RoLE's own caches and light buffer), a sample counting for a face only inside its own share of a corner
 * (QA2's bands are mitred: the corner square is split on the diagonal the art draws):
 *   F1 ceiling lamps light the faces turned to them (band ~ the floor at its foot x facing); faces turned away get none
 *   F2 pillar faces: the side turned to the light is lit, its far side gets none
 *   F3 a face whose foot the lamp does not reach gets none
 *   C1 / C2 a flashlight lights the face it hits, swept away it darkens; a lantern from beside; nothing with every light off;
 *      nothing through the wall
 * Corner checks (the same world points on both builds):
 *   K1 the mitres: at every corner the two bands meet on one diagonal (the same segment, no overlap, no gap) - QA2 only
 *   K2 an inner corner's block is lit with its two faces (flashlight sweep across it, blackout; and a lamp-lit room corner):
 *      the parent left the block between the two bands dark (a notch at every inner corner)
 *   K3 a convex corner (wall and pillar), flashlight swept across it: each face's share of the corner square carries that
 *      face's own light - the light at the floor at that face's foot x that face's own facing (base + k cos) - (the parent
 *      gave the side face's share to the front face: a block of the other face's light on it)
 *   K4 along a face lit at a grazing angle (a flashlight 28 px from the wall) the face light steps less than the parent's
 *      32 px pieces did: the band / its floor ratio every 2 px, its largest step and the steps over .06 (QA2's pieces adapt to
 *      how fast the facing changes: FACE.da on average; the 8-bit buffers add about .02 of noise to the ratio)
 *   K5 no around-the-corner reveal (the darkness clip the renderer drew, lamps on): floor hidden behind a convex wall or
 *      pillar corner (the game's exact ray query; more than 1.5 px from the clip's outline: its antialiasing) and the band
 *      of the face turned away are outside it; the band of the face turned to the player is inside */
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./qa2_lib.js'); const { H, frames, sleep } = Q;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PARENT = opt('parent') ? path.resolve(opt('parent')) : null;
const PORT = +(opt('port') || 9494), QUAL = opt('quality') || 'medium', OUT = opt('out'), NL = +(opt('lamps') || 12);
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const C = c => c * 96 + 48, D = Math.PI / 180;
const mean = a => { const b = a.filter(v => v != null); return b.length ? b.reduce((s, v) => s + v, 0) / b.length : 0; }, mx = a => Math.max(0, ...a.filter(v => v != null));

/* the corners (world px): convex wall corner (the block x < 1056, y < 5280: its S face 46 deep, E face 27), inner corner
 * (the room corner at 384, 4800: the wall above, S face 46; the wall on the left, E face 27), a PILLAR HALL pillar
 * (8564 .. 8620 x 1364 .. 1420: S 18, E 14), the lamp-lit inner corner (288, 2592) and the lamp-lit convex corner (960, 2976).
 * a corner's square / block in normalised depths: a into the vertical (E) face's band, b into the horizontal (S) face's */
const CV = { x: 1056, y: 5280, dS: 46, dE: 27 }, CC = { x: 384, y: 4800, dS: 46, dE: 27 }, PL = { x: 8620, y: 1420, dS: 18, dE: 14, ref: [2, 12] }, CCL = { x: 288, y: 2592, dS: 46, dE: 27 };
/* points of a convex corner's square on each face's side of the mitre (clear of it by `m` in normalised depth), and for each
 * the floor at the foot of its own face (the strip its light is carried from: 6.5 px out) */
function convexPts(K, m = .18) {
  const E = [], S = [], Ef = [], Sf = [];
  for (let a = .12; a < .95; a += .1) for (let b = .12; b < .95; b += .1) { const x = K.x - a * K.dE, y = K.y - b * K.dS;
    if (b - a > m) { E.push([x, y]); Ef.push([K.x + 6.5, y]); } else if (a - b > m) { S.push([x, y]); Sf.push([x, K.y + 6.5]); } }
  return { E, S, Ef, Sf };
}
/* a face's facing factor for a light at (lx, ly) (BR-RoLE's receivers: base + k cos, at most 1) */
const facing = (lx, ly, fx, fy, nx, ny) => { const dx = lx - fx, dy = ly - fy, d = Math.hypot(dx, dy) || 1, c = (dx * nx + dy * ny) / d; return c > 0 ? Math.min(1, .45 + .55 * c) : 0; };
/* point in polygon (screen px pairs), and its distance to the outline */
const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) { const xi = P[i], yi = P[i + 1], xj = P[j], yj = P[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const toEdge = (P, x, y) => { let m = Infinity; for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) { const ax = P[j], ay = P[j + 1], bx = P[i], by = P[i + 1], vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L)); m = Math.min(m, Math.hypot(ax + vx * t - x, ay + vy * t - y)); } return m; };
const CLIPTAP = `(() => { const P = CanvasRenderingContext2D.prototype, mt = P.moveTo, lt = P.lineTo, cl = P.clip, bp = P.beginPath, cr = P.clearRect;
  let path = null; const L = c => c.canvas && c.canvas.id === 'light';
  P.beginPath = function () { if (L(this)) path = []; return bp.apply(this, arguments); };
  P.moveTo = function (x, y) { if (path && L(this)) path.push(x, y); return mt.apply(this, arguments); };
  P.lineTo = function (x, y) { if (path && L(this)) path.push(x, y); return lt.apply(this, arguments); };
  P.clearRect = function () { if (L(this)) this.__first = true; return cr.apply(this, arguments); };
  P.clip = function () { if (L(this) && this.__first) { this.__first = false; window.__sceneClip = path ? path.slice() : null; } return cl.apply(this, arguments); };
})();`;
/* an inner corner's block (x in [cx - dE, cx], y in [cy - dS, cy]) and the two bands next to it */
function innerPts(K) {
  const B = [], Sr = [], Er = [];
  for (let a = .1; a < .95; a += .1) for (let b = .1; b < .95; b += .1) B.push([K.x - a * K.dE, K.y - b * K.dS]);
  for (let b = .1; b < .95; b += .1) for (let u = 4; u <= 24; u += 4) Sr.push([K.x + u, K.y - b * K.dS]);   // the S face right of the block
  for (let a = .1; a < .95; a += .1) for (let u = 4; u <= 24; u += 4) Er.push([K.x - a * K.dE, K.y + u]);   // the E face below it
  return { B, Sr, Er };
}
const light = (P, pts) => P.evaluate(p => __brRole.dev.light(p), pts);

/* K2 - K5 on one build */
async function corners(GAMEDIR, port) {
  const s = await Q.open(GAMEDIR, port, { quality: QUAL, init: CLIPTAP }), P = s.P, out = { version: await P.evaluate(() => __brRole.version) };
  try {
    /* K2: the inner corner, flashlight swept across it (blackout) */
    out.K2 = []; const ip = innerPts(CC);
    for (const aim of [-2.6, -2.45, -2.33, -2.2, -2.05]) {
      await Q.scene(s, { x: 470, y: 4890, aim, kind: 'flashlight', blackout: true });
      const [b, sr, er] = [await light(P, ip.B), await light(P, ip.Sr), await light(P, ip.Er)];
      out.K2.push({ aim, block: mean(b), bandS: mean(sr), bandE: mean(er) });
    }
    /* K2 (lamps): the lamp-lit room corner */
    { const lp = innerPts(CCL); await Q.scene(s, { x: 380, y: 2690, aim: -2.3, kind: 'flashlight', light: false, blackout: false });
      out.K2lamp = { block: mean(await light(P, lp.B)), bandS: mean(await light(P, lp.Sr)), bandE: mean(await light(P, lp.Er)) }; }
    /* K3: the convex wall corner and a pillar corner, flashlight swept across (blackout) */
    out.K3 = [];
    /* (the light 120+ px from the corner, so the floor at the faces' feet is the beam's light, not the hand glow's: the glow
     * is not carried onto faces) */
    for (const [nm, K, x, y, aims] of [['wall', CV, 1156, 5380, [-2.75, -2.55, -2.356, -2.2, -1.95]], ['wall-side', CV, 1250, 5300, [-3.08, -3.0, -2.9]], ['pillar', PL, 8720, 1520, [-2.6, -2.36, -2.1]]]) {
      const cp = convexPts(K);
      for (const aim of aims) { await Q.scene(s, { x, y, aim, kind: 'flashlight', blackout: true });
        const src = await P.evaluate(() => { const b = __api.beam() || __api.H; return [b.x, b.y]; });
        const [e, ef, sh, sf] = [await light(P, cp.E), await light(P, cp.Ef), await light(P, cp.S), await light(P, cp.Sf)];
        /* each sample: its light / the light at its own face's foot, against its own face's facing factor */
        const feet = nx => nx ? cp.Ef : cp.Sf, far = (p) => Math.hypot(p[0] - src[0], p[1] - src[1]) > 64;   // (past the hand glow)
        const rows = (L, F, pts, nx, ny) => L.map((v, i) => F[i] != null && F[i] >= 10 / 255 && v != null && far(feet(nx)[i]) ? { r: v / F[i], want: facing(src[0], src[1], nx ? K.x : pts[i][0], nx ? pts[i][1] : K.y, nx, ny) } : null).filter(Boolean);
        out.K3.push({ corner: nm, aim, src, E: rows(e, ef, cp.E, 1, 0), S: rows(sh, sf, cp.S, 0, 1) }); }
    }
    /* K4: a flashlight grazing the E face of x = 1056 (y 4896 .. 5280): the band (10 px deep) over the floor at its foot */
    { await Q.scene(s, { x: 1084, y: 5160, aim: -Math.PI / 2 - .12, kind: 'flashlight', blackout: true });
      const ys = []; for (let y = 4950; y <= 5140; y += 2) ys.push(y);
      const band = await light(P, ys.map(y => [1056 - 10, y])), strip = await light(P, ys.map(y => [1056 + 6.5, y]));
      const r = ys.map((y, k) => strip[k] >= 20 / 255 && band[k] != null ? band[k] / strip[k] : null); let worst = 0, steps = 0, n = 0;
      for (let k = 1; k < r.length; k++) if (r[k] != null && r[k - 1] != null) { n++; const d = Math.abs(r[k] - r[k - 1]); worst = Math.max(worst, d); if (d > .06) steps++; }
      out.K4 = { samples: n, worstStep: +worst.toFixed(3), stepsOver06: steps, ratio: r.map(v => v == null ? null : +v.toFixed(3)) }; }
    /* K5: around-the-corner reveal, lamps on, the real darkness overlay; hidden = the game's exact ray query from the player */
    out.K5 = [];
    /* (the turned-away face's band: its own share, a - b > .12 in the corner square's normalised depths a (into the seen face)
     * and b (into the turned-away one), and on along it) */
    for (const [nm, x, y, hidFloor, awayBox, awayShare, seenBand] of [
      ['convex wall corner (960, 2976)', 1000, 2900, [928, 2978, 958, 3004], [900, 2932, 958, 2975], (X, Y) => (960 - X) / 27 - (2976 - Y) / 46 > .12, [937, 2890, 958, 2928]],
      ['pillar corner (8620, 1364)', 8640, 1392, [8586, 1338, 8618, 1362], [8578, 1365, 8618, 1375], (X, Y) => (8620 - X) / 14 - (Y - 1364) / 12 > .12, [8607, 1378, 8619, 1400]]]) {
      await Q.scene(s, { x, y, aim: 0, kind: 'flashlight', light: false, blackout: false });
      const grid = b => { const g = []; for (let gx = b[0]; gx <= b[2]; gx += 2) for (let gy = b[1]; gy <= b[3]; gy += 2) g.push([gx, gy]); return g; };
      const awayBand = grid(awayBox).filter(([X, Y]) => awayShare(X, Y));
      const st = await P.evaluate(() => { const w = __api.layer().parent; return { wx: w.position.x, wy: w.position.y, s: w.scale.x }; }), clip = await P.evaluate(() => window.__sceneClip);
      const hid = await P.evaluate(([px, py, pts]) => pts.filter(([X, Y]) => { const d = Math.hypot(X - px, Y - py); return __api.Uc(px, py, Math.atan2(Y - py, X - px), d) < d - .5 && !__api.Hc(Math.floor(X / 96), Math.floor(Y / 96)) && !(__api.Bc(X, Y) || []).some(r => r && r.w === 56 && X > r.x && X < r.x + r.w && Y > r.y && Y < r.y + r.h); }), [x, y, grid(hidFloor)]);
      const aw = awayBand, sn = grid(seenBand), scr = ([X, Y]) => [st.wx + X * st.s, st.wy + Y * st.s];
      const shown = (pts, margin) => pts.filter(p => { const [sx, sy] = scr(p); return inPoly(clip, sx, sy) && toEdge(clip, sx, sy) > margin; }).length;
      const lit = await light(P, hid);
      out.K5.push({ scene: nm, hiddenFloor: hid.length, hiddenFloorLit: lit.filter(v => v > 20 / 255).length, hiddenFloorInClip: shown(hid, 1.5), hiddenFloorInClipAny: shown(hid, 0),
        awayBand: aw.length, awayBandInClip: shown(aw, 1.5), seenBand: sn.length, seenBandInClip: shown(sn, -1) });
    }
    out.errs = s.J.errs;
  } finally { await Q.close(s); }
  return out;
}

/* QA1's audit of one lamp's faces against its core cache, samples only inside a face's own share */
const AUDIT = `window.__rcv = function (i) {
  const A = __api, R = __brRole, L = A.lamps[i], info = R.dev.cacheInfo(i); if (!info) return null;
  const tube = R.dev.tube(i), sees = (sx, sy, x, y) => { const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy); return d < .5 || A.Uc(sx, sy, Math.atan2(dy, dx), d) >= d - .5; };
  const lit = (x, y) => tube.some((v, k) => k % 2 === 0 && sees(tube[k], tube[k + 1], x, y));
  const out = { i, toward: [], away: [], blocked: [], skipped: 0 }, ext = Math.min(info.core.hx, info.core.hy) - 30;
  for (const f of R.dev.bands(L.x - ext, L.y - ext, L.x + ext, L.y + ext)) {
    const [nx, ny] = f.n, hor = ny !== 0, b = f.band, s = f.strip, along0 = hor ? b[0] : b[1], along1 = hor ? b[2] : b[3];
    const turned = (L.x - f.edge[0]) * nx + (L.y - f.edge[1]) * ny > .5;
    const pts = [];
    for (let u = along0 + 6; u < along1 - 6; u += 12) {
      const sp = hor ? [u, (s[1] + s[3]) / 2] : [(s[0] + s[2]) / 2, u], bp = hor ? [u, ny > 0 ? b[3] - 4 : b[1] + 4] : [nx > 0 ? b[2] - 4 : b[0] + 4, u], bdeep = hor ? [u, ny > 0 ? b[1] + 3 : b[3] - 3] : [nx > 0 ? b[0] + 3 : b[2] - 3, u];
      if (!(window.__inShare(f.poly, bp[0], bp[1], 1.5) && window.__inShare(f.poly, bdeep[0], bdeep[1], 1.5))) { out.skipped++; continue; }   // (the neighbouring face's share of a corner)
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
};
/* inside a convex outline w (x, y pairs), at least m px from every edge */
window.__inShare = function (w, x, y, m) { if (!w) return true; let ar = 0; for (let k = 0; k < 8; k += 2) ar += w[k] * w[(k + 3) % 8] - w[(k + 2) % 8] * w[k + 1]; const sg = ar >= 0 ? 1 : -1;
  for (let k = 0; k < 8; k += 2) { const ax = w[k], ay = w[k + 1], bx = w[(k + 2) % 8], by = w[(k + 3) % 8], L = Math.hypot(bx - ax, by - ay); if (L < 1e-9) continue; if (sg * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / L < m) return false; } return true; };`;

(async () => {
  const R = { game: GAME, parent: PARENT, quality: QUAL };
  /* ---- F1 F2 F3 C1 C2 K1 (this build) ---- */
  if (!argv.includes('--konly')) { const s = await Q.open(GAME, PORT, { quality: QUAL, init: AUDIT }), P = s.P;
  try {
    await H.setLights(P, 'off');
    /* K1: the mitres */
    R.K1 = await P.evaluate(() => { const B = __brRole.dev.bands(-1e9, -1e9, 1e9, 1e9), polys = new Map(), ends = new Map(); let corners = 0, bad = [], overlap = 0;
      const key = (x, y) => Math.round(x * 8) + ',' + Math.round(y * 8);
      for (const f of B) { if (!f.poly) return { noPoly: true }; const w = f.poly; polys.set(f.j, w);
        for (const [ox, oy, ix, iy] of [[w[0], w[1], w[6], w[7]], [w[2], w[3], w[4], w[5]]]) { const k = key(ox, oy); const l = ends.get(k) || []; l.push({ j: f.j, ox, oy, ix, iy, n: f.n }); ends.set(k, l); } }
      for (const [k, l] of ends) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const a = l[i], b = l[j];
        /* two perpendicular faces whose bands turn into the same corner square from this point: one corner (two blocks touching
         * only at a vertex turn into opposite squares: not a joint) */
        if (a.n[0] * b.n[0] + a.n[1] * b.n[1] !== 0 || Math.sign(a.ix - a.ox) !== Math.sign(b.ix - b.ox) || Math.sign(a.iy - a.oy) !== Math.sign(b.iy - b.oy)) continue;
        corners++; if (Math.hypot(a.ix - b.ix, a.iy - b.iy) > 1e-3) { bad.push([k, a.j, b.j, [a.ix, a.iy], [b.ix, b.iy]]); continue; }
        /* no overlap: the two outlines' centroids on opposite sides of the shared mitre */
        const side = q => { const w = polys.get(q), cx = (w[0] + w[2] + w[4] + w[6]) / 4, cy = (w[1] + w[3] + w[5] + w[7]) / 4; return Math.sign((a.ix - a.ox) * (cy - a.oy) - (a.iy - a.oy) * (cx - a.ox)); };
        if (side(a.j) === side(b.j)) overlap++; }
      return { bands: B.length, corners, mismatched: bad.length, overlap, e: bad.slice(0, 4) }; });
    check('K1 at every corner the two faces\' bands meet on one mitre (the same diagonal, no overlap, no gap)', !R.K1.noPoly && R.K1.corners > 100 && R.K1.mismatched === 0 && R.K1.overlap === 0,
      `${R.K1.bands} bands; ${R.K1.corners} corners where two perpendicular faces meet: mitre segments that differ ${R.K1.mismatched}, outlines overlapping ${R.K1.overlap}` + (R.K1.e && R.K1.e.length ? ' e.g. ' + JSON.stringify(R.K1.e) : ''));
    /* F1 / F3: the lamps nearest wall / pillar faces (not those inside a blocker) */
    const sel = await P.evaluate(n => { const A = __api, Rr = __brRole, out = [], inside = [];
      A.lamps.forEach((L, i) => { if (A.Hc(Math.floor(L.x / 96), Math.floor(L.y / 96)) || (A.Bc(L.x, L.y) || []).some(r => r && r.w === 56 && L.x > r.x && L.x < r.x + r.w && L.y > r.y && L.y < r.y + r.h)) { inside.push(i); return; } const f = Rr.dev.bands(L.x - 220, L.y - 220, L.x + 220, L.y + 220); if (f.length) out.push([f.length + (f.some(q => q.pillar) ? 40 : 0), i]); });
      out.sort((a, b) => b[0] - a[0] || a[1] - b[1]); return { list: out.slice(0, n).map(q => q[1]), inside }; }, NL);
    R.lampsInsideBlockers = sel.inside; R.lamps = [];
    let toward = [], away = [], blocked = [], skipped = 0;
    for (const i of sel.list) {
      const L = await P.evaluate(i => [__api.lamps[i].x, __api.lamps[i].y], i);
      await H.place(P, L[0], L[1] + 60, 0, { light: false });
      for (let k = 0; k < 120; k++) { await frames(P, 3); if (await P.evaluate(i => !!__brRole.dev.cacheInfo(i), i)) break; }
      const r = await P.evaluate(i => window.__rcv(i), i); if (!r) continue;
      await P.evaluate(() => __brRole.dev.faces(false)); await frames(P, 3);
      for (let k = 0; k < 120; k++) { await frames(P, 3); if (await P.evaluate(i => !!__brRole.dev.cacheInfo(i), i)) break; }
      const r0 = await P.evaluate(i => window.__rcv(i), i);
      await P.evaluate(() => __brRole.dev.faces(true)); await frames(P, 3);
      for (const key of ['toward', 'away', 'blocked']) r[key].forEach((t, n) => { const o = r0 && r0[key][n]; t.off = o && o.j === t.j ? o.band : null; t.added = t.off == null ? null : +(t.band - t.off).toFixed(1); });
      R.lamps.push(r); toward = toward.concat(r.toward); away = away.concat(r.away); blocked = blocked.concat(r.blocked); skipped += r.skipped;
    }
    const lit = toward.filter(t => t.strip >= 6), ratio = lit.map(t => t.band / t.strip), litOk = lit.filter(t => t.band >= .4 * t.strip - 2).length;
    const awayBad = away.filter(t => t.added == null || t.added > 1), pA = away.filter(t => t.pillar), pT = lit.filter(t => t.pillar);
    check('F1 ceiling lamps light the faces turned to them (band ~ the floor at its foot x facing), and none turned away', lit.length > 40 && litOk >= .95 * lit.length && !awayBad.length,
      `${R.lamps.length} lamps; ${lit.length} lit face samples: band / foot ${Math.min(...ratio).toFixed(2)} .. ${Math.max(...ratio).toFixed(2)} (${litOk} carry it); faces turned away ${away.length} samples: face light added to them ${awayBad.length}${awayBad.length ? ' e.g. ' + JSON.stringify(awayBad.slice(0, 2)) : ''}; samples in a neighbour's corner share (left out) ${skipped}`);
    const blkBad = blocked.filter(t => t.added == null || t.added > 1 || t.band > 3);
    check('F3 a face whose foot the lamp does not reach (blocked) receives none of its light', !blkBad.length, `${blocked.length} blocked face samples, lit ${blkBad.length}${blkBad.length ? ' e.g. ' + JSON.stringify(blkBad.slice(0, 2)) : ''}`);
    /* C1 / C2 (BLACKOUT ZONE: the partition at x 960 .. 1056, rows 51 .. 54) */
    const at = async (x, y, aim, kind, on) => { await H.place(P, x, y, aim, { light: on, kind }); await frames(P, 8); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 4); };
    const face = [], back = [], floor = []; for (let y = C(51) + 10; y < C(54); y += 16) { face.push([1056 - 6, y]); back.push([960 + 6, y]); floor.push([1056 + 8, y]); }
    await at(C(13), C(53), Math.PI, 'flashlight', true); const on1 = await light(P, face), fl1 = await light(P, floor), bk1 = await light(P, back); await P.evaluate(() => window.__clock.thaw());
    await at(C(13), C(53), -Math.PI / 2, 'flashlight', true); const off1 = await light(P, face); await P.evaluate(() => window.__clock.thaw());
    await at(C(12), C(53), 0, 'lantern', true); const lan = await light(P, face); await P.evaluate(() => window.__clock.thaw());
    await at(C(13), C(53), Math.PI, 'flashlight', false); const none = await light(P, face.concat(floor)); await P.evaluate(() => window.__clock.thaw());
    R.carried = { on1, off1, lan, none, fl1, bk1 };
    check('C1 a flashlight lights the face it hits; swept away the face darkens; a lantern lights it from beside; nothing with every light off', mean(on1) > .1 && mean(off1) < .3 * mean(on1) && mean(lan) > .05 && mx(none) < 1 / 255,
      `face light: flashlight on it ${(mean(on1) * 255).toFixed(1)}/255 (floor at its foot ${(mean(fl1) * 255).toFixed(1)}), swept away ${(mean(off1) * 255).toFixed(1)}, lantern ${(mean(lan) * 255).toFixed(1)}, all lights off max ${(mx(none) * 255).toFixed(1)}/255`);
    check('C2 no face light through the wall: its far side stays dark while the flashlight lights the near side', mx(bk1) < 1 / 255, `far-side face max ${(mx(bk1) * 255).toFixed(1)}/255`);
    /* F2: a flashlight on a PILLAR HALL pillar (blackout): its near face lit, its far face (its own share) dark */
    await H.setLights(P, 'on'); for (let k = 0; k < 40 && !(await P.evaluate(() => !!__api.V.blackout)); k++) { await H.setLights(P, 'on'); await sleep(300); }
    const pil = await P.evaluate(() => __brRole.dev.bands(7550, 800, 7720, 1000).filter(f => f.pillar));
    await H.place(P, C(81), C(9.5), Math.PI, { light: true, kind: 'flashlight' }); await frames(P, 8); await P.evaluate(() => window.__clock.freeze(true)); await frames(P, 4);
    const e = pil.find(f => f.n[0] === 1), w = pil.find(f => f.n[0] === -1); let pNear = [], pFar = [], nFar = 0;
    if (e && w) { const ys = []; for (let y = e.band[1] + 4; y < e.band[3] - 2; y += 3) ys.push(y);
      const near = ys.map(y => [e.band[2] - 3, y]).filter(([x, y]) => 1), far = await P.evaluate(([w, pts]) => pts.filter(([x, y]) => window.__inShare(w.poly, x, y, 1.5)), [w, ys.map(y => [w.band[0] + 3, y])]);
      nFar = far.length; pNear = await light(P, near); pFar = await light(P, far); }
    await P.evaluate(() => window.__clock.thaw()); await H.setLights(P, 'off');
    check('F2 pillar faces: the side turned to the light is lit, its far side (its own share) gets none of it; lamp-lit pillar faces turned away get none', mean(pNear) > .08 && nFar > 5 && mx(pFar) < 1 / 255 && !pA.some(t => t.added == null || t.added > 1),
      `flashlight on a PILLAR HALL pillar (lamps off): near face ${(mean(pNear) * 255).toFixed(1)}/255, far face (${nFar} samples in its own share) max ${(mx(pFar) * 255).toFixed(1)}/255; lamp-lit pillar faces ${pT.length} samples, turned away from a lamp ${pA.length} (added max ${pA.length ? Math.max(...pA.map(t => t.added || 0)) : '-'}/255)`);
    R.errs = s.J.errs;
  } finally { await Q.close(s); } }

  /* ---- K2 - K5 on this build (and the parent) ---- */
  R.qa2 = await corners(GAME, PORT + 1);
  if (PARENT) R.parentK = await corners(PARENT, PORT + 2);
  const k2 = (o, f) => o ? o.K2.map(r => r.block / Math.max(1e-6, (r.bandS + r.bandE) / 2)) : [], q2 = k2(R.qa2), p2 = k2(R.parentK);
  const k2l = o => o ? o.K2lamp.block / Math.max(1e-6, (o.K2lamp.bandS + o.K2lamp.bandE) / 2) : null;
  const lit2 = R.qa2.K2.filter(r => (r.bandS + r.bandE) / 2 > 8 / 255);
  check('K2 an inner corner\'s block is lit with its two faces (flashlight swept across it; a lamp-lit room corner)', lit2.length >= 3 && lit2.every(r => r.block >= .5 * (r.bandS + r.bandE) / 2) && k2l(R.qa2) >= .5,
    `block / its two bands' light, flashlight sweep: ${q2.map(v => v.toFixed(2)).join(' ')}` + (PARENT ? ` (parent ${p2.map(v => v.toFixed(2)).join(' ')})` : '') + `; lamp-lit room corner ${k2l(R.qa2).toFixed(2)}` + (PARENT ? ` (parent ${k2l(R.parentK).toFixed(2)})` : ''));
  /* K3: a sample follows its own face when |light / own foot - own facing| <= .15 */
  const k3 = o => { if (!o) return null; let n = 0, ok = 0, worst = 0; const per = [];
    for (const r of o.K3) { let pn = 0, po = 0; for (const f of ['E', 'S']) for (const q of r[f]) { const d = Math.abs(q.r - q.want); n++; pn++; if (d <= .15) { ok++; po++; } worst = Math.max(worst, d); } per.push(`${r.corner}@${r.aim}: ${po}/${pn}`); }
    return { n, ok, worst, per }; };
  const q3 = k3(R.qa2), p3 = k3(R.parentK);
  check('K3 a convex corner (wall, pillar), flashlight swept across: each face\'s share of the corner carries that face\'s own light', q3.n > 100 && q3.ok >= .95 * q3.n,
    `share samples whose light / the floor at their own face's foot is within .15 of their own face's facing: ${q3.ok}/${q3.n} (${q3.per.join(', ')})` + (p3 ? ` || parent ${p3.ok}/${p3.n} (${p3.per.join(', ')})` : ''));
  check('K4 along a face lit at a grazing angle the face light steps less than the parent\'s 32 px pieces', R.qa2.K4.samples > 30 && R.qa2.K4.worstStep <= .08 && (!PARENT || (R.qa2.K4.worstStep < R.parentK.K4.worstStep && R.qa2.K4.stepsOver06 <= R.parentK.K4.stepsOver06)),
    `band / floor-at-its-foot ratio every 2 px over ${R.qa2.K4.samples} pairs: worst step ${R.qa2.K4.worstStep}, steps over .06: ${R.qa2.K4.stepsOver06}` + (PARENT ? ` (parent: worst ${R.parentK.K4.worstStep}, over .06: ${R.parentK.K4.stepsOver06})` : ''));
  const k5 = o => o ? o.K5.map(r => `${r.scene}: hidden floor in the clip ${r.hiddenFloorInClip}/${r.hiddenFloor} (${r.hiddenFloorLit} of it lamp-lit; ${r.hiddenFloorInClipAny} counting the outline's 1.5 px), turned-away band in it ${r.awayBandInClip}/${r.awayBand}, seen band in it ${r.seenBandInClip}/${r.seenBand}`).join('; ') : '';
  check('K5 no around-the-corner reveal: floor hidden behind a convex corner and the band of the face turned away are outside the clip; the seen face\'s band is inside', R.qa2.K5.every(r => r.hiddenFloor > 20 && r.hiddenFloorLit > 10 && r.hiddenFloorInClip === 0 && r.awayBandInClip === 0 && r.seenBandInClip >= .95 * r.seenBand),
    k5(R.qa2) + (PARENT ? ` || parent ${k5(R.parentK)}` : ''));
  const ok = results.every(r => r.ok); console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ results, R }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
