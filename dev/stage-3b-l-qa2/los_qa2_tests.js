/* Stage 3B-L QA2 - the darkness clip's face bands: focused tests in node (development only; never served).  A few minutes.
 *
 *   node dev/stage-3b-l-qa2/los_qa2_tests.js [--game PATH] [--parent DIR | --rev SHA] [--out FILE.json]
 *
 * The game's own LOS code (Uc, Vl, Pc, Hl and QA2's Hlq helpers) loaded verbatim from this tree's bundle and from the QA1
 * parent's (d3ec226, read from git), compared.  "Exact visibility" is the game's ray query Uc from the player.
 *   L01 the bundle holds dev/stage-3b-l-qa2/hl_qa2.js exactly, in place of the parent's Hl; nothing else in it changed
 *   L02 the exact ray query and its tables are the parent's (Uc, Hc, zc, Bc; Pc, Vl, the lamp list): AI, light and collision
 *       truth untouched
 *   L03 entity mask (r 0): away from the pillars byte-identical to the parent's; near them every parent ray is still cast, to
 *       the same distance (the pillar corners are added)
 *   L04 a face seen square-on shows exactly what it did: the clip ends 24 px into it, as the parent's
 *   L05 nothing hidden is shown: no floor the player cannot see is inside the clip (the parent showed slivers past wall ends
 *       and pillars); every point of a wall or pillar inside it lies in the band of a face turned to the player, within its
 *       mitred ends (or, at a convex corner both of whose faces are turned to the player, within their 24 px L), over a part
 *       of that face the player sees
 *   L06 a face seen at a slant shows the same 24 px band as square-on (the parent's thinned to a wedge): band coverage
 *   L07 the face around a corner that is turned away from the player stays black (its band is never inside the clip)
 *   L08 a corner seen from the diagonal: both faces' bands meet on the mitre, nothing missing between them
 *   L09 bounded: the clip casts at most 12 more rays per pillar in reach and 10 per face turned to the player in reach
 *   L10 a side face seen along its length (standing close to it, looking toward its convex corner) keeps its band right to
 *       the corner's mitre (the band reached through the front face's band near the corner)
 *   L11 no cracks: no ray of the clip stops short (> 2 px) inside a wall or pillar between two rays within 1e-4 rad that go
 *       on (a thin dark line across a lit band), other than a ray ending on a corner itself (an outline's tip)
 *   L12 a convex corner seen with both its faces (viewers in front of it): the two faces' 24 px bands make the whole L, with
 *       no notch at the joint (the art's mitre runs deeper than 24 px into a wall's 46 px south face) */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execSync } = require('child_process');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), REV = opt('rev') || 'd3ec2269af873dbc381d223ad538a43ba06f5c45';
const BUNDLE = 'assets/index-DKbV5Nv9.js', LIB = require('./los_lib.js');
let PARENT = opt('parent') ? path.resolve(opt('parent')) : null;
if (!PARENT) { PARENT = fs.mkdtempSync(path.join(os.tmpdir(), 'qa2-parent-')); fs.mkdirSync(path.join(PARENT, 'assets'));
  for (const f of [BUNDLE, 'world.js']) fs.writeFileSync(path.join(PARENT, f), execSync(`git -C ${JSON.stringify(GAME)} show ${REV}:${f}`, { maxBuffer: 1 << 26 })); }
const N = LIB.load(GAME), O = LIB.load(PARENT), TAU = 2 * Math.PI, D2R = Math.PI / 180, DEP = 24;
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const F = N.g.HlqFaces();
const solidAt = (x, y) => N.Pc.some(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) || !!N.Hc(Math.floor(x / 96), Math.floor(y / 96));
/* a star-shaped polygon's boundary distance in any direction (as the pillar LOS audit's), and the gap to its nearest ray */
function radial(poly, vx, vy) {
  const n = poly.length / 2, A = new Float64Array(n);
  for (let k = 0; k < n; k++) { let a = Math.atan2(poly[2 * k + 1] - vy, poly[2 * k] - vx); if (k) { while (a - A[k - 1] > Math.PI) a -= TAU; while (a - A[k - 1] <= -Math.PI) a += TAU; } A[k] = a; }
  const find = a => { while (a < A[0]) a += TAU; while (a >= A[0] + TAU) a -= TAU; let lo = 0, hi = n - 1; if (a >= A[n - 1]) lo = n - 1; else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= a) lo = m; else hi = m; } return [a, lo]; };
  const f = a0 => { const [a, i] = find(a0), j = (i + 1) % n, x1 = poly[2 * i] - vx, y1 = poly[2 * i + 1] - vy, x2 = poly[2 * j] - vx, y2 = poly[2 * j + 1] - vy, ux = Math.cos(a), uy = Math.sin(a), ex = x2 - x1, ey = y2 - y1, den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-12) return Math.min(Math.hypot(x1, y1), Math.hypot(x2, y2)); return (x1 * ey - y1 * ex) / den; };
  f.gap = a0 => { const [a, i] = find(a0), j = i + 1; return Math.min(a - A[i], j < n ? A[j] - a : A[0] + TAU - a); };
  return f;
}
const inClip = (R, vx, vy, x, y) => { const a = Math.atan2(y - vy, x - vx); return R.gap(a) < 5e-5 ? null : Math.hypot(x - vx, y - vy) < R(a) - 1e-6; };
const sees = (vx, vy, x, y) => { const d = Math.hypot(x - vx, y - vy); return d < .5 || N.Uc(vx, vy, Math.atan2(y - vy, x - vx), d) >= d - .5; };
/* the faces' geometry at depth DEP (QA2's own quads) and helpers on them */
const visible = (f, vx, vy) => (vx - (f.h ? f.a0 : f.L)) * f.nx + (vy - (f.h ? f.L : f.a0)) * f.ny > 1e-9;
N.Hl(1000, 3000, 700, DEP);                                                   // (sets every face's quad at depth DEP)
const quadAt = (f, D) => N.g.HlqQuad(f, D).q;
const quadOf = f => f.q24 || (f.q24 = quadAt(f, DEP)), fullOf = f => f.qf || (f.qf = quadAt(f, Math.max(DEP, f.d))),   // fullOf: the face's whole band as the art draws it (or the 24 px the parent always showed, where that is deeper)
      near = (x, y) => (F.G.get(Math.floor(y / 96) * 4096 + Math.floor(x / 96)) || []).map(j => F[j]);
/* the 24 px L at a convex corner both of whose faces are turned to the player: the face's 24 px band runs to that end of
 * the face (its rectangle; the two rectangles make the L) */
const rectOf = (f, k) => (f.rq || (f.rq = []))[k] || (f.rq[k] = N.g.HlqQuad({ h: f.h, nx: f.nx, ny: f.ny, L: f.L, a0: f.a0, a1: f.a1, d: f.d, s0: k ? f.s0 : 0, s1: k ? 0 : f.s1 }, DEP).q),
      inL = (f, x, y, vx, vy) => [0, 1].some(k => { const j = k ? f.n1 : f.n0; return j >= 0 && visible(F[j], vx, vy) && inQuad(rectOf(f, k), x, y); });
const inQuad = (q, x, y, tol = 1e-6) => { let s = 0; for (let k = 0; k < 8; k += 2) { const ax = q[k], ay = q[k + 1], bx = q[(k + 2) % 8], by = q[(k + 3) % 8], c = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (Math.abs(c) < tol) continue; if (!s) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } return true; };
/* the foot seen (to 1.5 px along the face: the clip's visible stretch of a face ends on the ray through an occluder's corner,
 * found to its .5 px tolerance; the foot is tested .25 px in front of the face) */
const seenFoot = (f, x, y, vx, vy) => [0, -.75, .75, -1.5, 1.5].some(du => { const [fx, fy] = footOf(f, f.h ? x + du : x, f.h ? y : y + du); return sees(vx, vy, fx, fy); });
const footOf = (f, x, y) => { const u = Math.min(f.a1 - 1.2, Math.max(f.a0 + 1.2, f.h ? x : y)); return f.h ? [u, f.L + f.ny * .25] : [f.L + f.nx * .25, u]; };   // the floor just in front of the face at that point (1.2 px in from its ends: an inner corner's share of the corner block stands on the face's end)
/* poses: rooms with walls and corners of every kind, the BLACKOUT ZONE, PILLAR HALL, a corridor */
const C = c => c * 96 + 48, poses = [];
for (const [x0, y0, x1, y1] of [[3, 27, 20, 43], [4, 50, 21, 61], [77, 7, 91, 20], [26, 26, 43, 44], [10, 45, 13, 49]]) for (let cy = y0; cy <= y1; cy += 2) for (let cx = x0; cx <= x1; cx += 3) {
  const x = C(cx) + (cy % 3) * 17 - 17, y = C(cy) + (cx % 4) * 11 - 16; if (N.zc(Math.floor(x / 96), Math.floor(y / 96)) && !solidAt(x, y) && !N.Pc.some(p => x > p.x - 16 && x < p.x + p.w + 16 && y > p.y - 16 && y < p.y + p.h + 16)) poses.push([x, y]); }
console.log('poses', poses.length);

/* L01 */
{ const A = fs.readFileSync(path.join(GAME, BUNDLE), 'utf8'), B = fs.readFileSync(path.join(PARENT, BUNDLE), 'utf8'), src = fs.readFileSync(path.join(__dirname, 'hl_qa2.js'), 'utf8');
  const a = src.indexOf('// ---- begin (bundle text) ----\n') + 32, b = src.indexOf('// ---- end (bundle text) ----'), txt = src.slice(a, b).replace(/\n/g, '');
  const bi = B.indexOf('function Hl('), bj = B.indexOf('function Ul(', bi), ai = A.indexOf('var HlqD='), aj = A.indexOf('function Ul(', ai);
  const same = A.slice(0, ai) === B.slice(0, bi) && A.slice(aj) === B.slice(bj) && A.slice(ai, aj) === txt;
  check('L01 the bundle = the parent with Hl replaced by hl_qa2.js (nothing else changed)', same && A.split('this.sightPoints=Hl(a.x,a.y,700),this.scenePoints=Hl(a.x,a.y,700,24)').length === 2, `Hl ${bj - bi} -> ${aj - ai} chars; call sites unchanged`); }
/* L02 */
{ const src = (L, f) => L.g[f].toString(), J = v => JSON.stringify(v), fns = ['Uc', 'Hc', 'zc', 'Bc'].filter(f => typeof N.g[f] === 'function');
  const fnSame = fns.every(f => src(N, f) === src(O, f)), tab = J(N.Pc) === J(O.Pc) && J(N.Vl) === J(O.Vl) && J(N.g.Fc) === J(O.g.Fc);
  let ray = true; for (let k = 0; k < 4000 && ray; k++) { const x = Math.random() * 96 * 96, y = Math.random() * 72 * 96, a = Math.random() * TAU - Math.PI; if (N.Uc(x, y, a, 700) !== O.Uc(x, y, a, 700)) ray = false; }
  check('L02 exact ray query and its tables unchanged (AI / light / collision truth)', fnSame && tab && ray, `${fns.join(' ')} identical ${fnSame}; Pc, Vl, lamps identical ${tab}; 4000 random rays equal ${ray}`); }
/* L03 */
{ let far = 0, diff = 0, near = 0, miss = 0, dd = 0;
  for (let cy = 0; cy < 72; cy++) for (let cx = 0; cx < 96; cx += 2) { const x = C(cx) + (cy % 3) * 11, y = C(cy) - (cx % 5) * 7; if (!N.zc(cx, cy) || solidAt(x, y)) continue;
    const nearP = N.Pc.some(r => Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y) <= 740);
    if (!nearP) { far++; const a = N.Hl(x, y, 700, 0), b = O.Hl(x, y, 700, 0); if (a.length !== b.length || a.some((v, i) => v !== b[i])) diff++; }
    else { near++; const nr = new Map(N.HlRec(x, y, 700, 0).rays.map(r => [r[0], r])); for (const [a, d] of O.HlRec(x, y, 700, 0).rays) { const h = nr.get(a); if (!h) miss++; else if (h[1] !== d) dd++; } } }
  check('L03 entity mask: byte-identical away from pillars; near them every parent ray kept', far > 1000 && diff === 0 && miss === 0 && dd === 0, `${far} positions away from pillars, ${diff} differ; ${near} near pillars: parent rays missing ${miss}, distance changed ${dd}`); }
/* L04: square-on rays (viewer straight in front of long faces, the ray along the face's normal) */
{ let n = 0, bad = 0, worst = 0;
  for (const f of F) { if (f.p || f.a1 - f.a0 < 288) continue; for (const off of [60, 150, 300]) { const u = (f.a0 + f.a1) / 2, vx = f.h ? u : f.L + f.nx * off, vy = f.h ? f.L + f.ny * off : u;
    if (solidAt(vx, vy) || !sees(vx, vy, f.h ? u : f.L + f.nx, f.h ? f.L + f.ny : u)) continue; const a = Math.atan2(-f.ny, -f.nx);
    const r = N.HlRec(vx, vy, 700, 24).rays.find(q => Math.abs(q[0] - a) < 1e-12) || null, p = O.HlRec(vx, vy, 700, 24).rays.find(q => Math.abs(q[0] - a) < 1e-12) || null;
    if (!r || !p) continue; n++; const dn = Math.hypot(r[2] - vx, r[3] - vy), dp = Math.hypot(p[2] - vx, p[3] - vy); worst = Math.max(worst, Math.abs(dn - dp)); if (Math.abs(dn - dp) > 1e-6) bad++; } }
  check('L04 a face seen square-on: the clip ends 24 px into it, exactly as the parent', n > 50 && bad === 0, `${n} square-on rays (base-fan directions straight at long faces); differing ${bad}; worst |new - parent| ${worst.toExponential(1)} px`); }
/* L05 / L06 / L07 / L08 over the poses */
{ let floorLeak = 0, floorLeakP = 0, solidBad = 0, solidIn = 0, nPose = 0, cov = [0, 0], covP = [0, 0], back = 0, backN = 0, corner = [0, 0], cornerP = [0, 0];
  const badAt = [];
  for (const [vx, vy] of poses) {
    const clip = N.Hl(vx, vy, 700, 24), R = radial(clip, vx, vy), RP = radial(O.Hl(vx, vy, 700, 24), vx, vy); nPose++;
    /* L05: sample directions (0.5 degree), distances (2 px) out to 640 px */
    for (let a = -Math.PI; a < Math.PI; a += .5 * D2R) { const U = N.Uc(vx, vy, a, 700); if (U >= 690) continue; const ux = Math.cos(a), uy = Math.sin(a);
      for (let d = Math.max(4, U - 40); d < Math.min(640, U + 80); d += 2) { const x = vx + ux * d, y = vy + uy * d, ins = inClip(R, vx, vy, x, y), insP = inClip(RP, vx, vy, x, y); if (ins === null) continue;
        if (!solidAt(x, y)) { const ex = sees(vx, vy, x, y); if (ins && !ex) { floorLeak++; if (badAt.length < 6) badAt.push(['floor', Math.round(vx), Math.round(vy), Math.round(x), Math.round(y)]); } if (insP && !ex) floorLeakP++; continue; }
        if (!ins) continue; solidIn++;
        /* inside a wall / pillar: within a visible face's quad, its foot seen */
        let ok = false; for (const f of near(x, y)) { if (!visible(f, vx, vy)) continue; if (!inQuad(fullOf(f), x, y) && !inL(f, x, y, vx, vy)) continue; if (seenFoot(f, x, y, vx, vy)) { ok = true; break; } }
        if (!ok) { solidBad++; if (badAt.length < 12) badAt.push(['solid', Math.round(vx), Math.round(vy), Math.round(x), Math.round(y)]); } } }
    /* L06 / L07 / L08: sample the bands of faces within 400 px */
    for (const f of F) { const mid = f.h ? [(f.a0 + f.a1) / 2, f.L] : [f.L, (f.a0 + f.a1) / 2]; if (Math.hypot(mid[0] - vx, mid[1] - vy) > 400 + (f.a1 - f.a0) / 2) continue;
      const q = quadOf(f), vis = visible(f, vx, vy);
      for (let u = f.a0 + 2; u < f.a1 - 2; u += 6) for (const t of [6, 14, 21]) {
        const x = f.h ? u : f.L - f.nx * t, y = f.h ? f.L - f.ny * t : u; if (Math.hypot(x - vx, y - vy) > 600 || !inQuad(q, x, y)) continue;
        const [fx, fy] = footOf(f, x, y); const ins = inClip(R, vx, vy, x, y), insP = inClip(RP, vx, vy, x, y); if (ins === null || insP === null) continue;
        if (vis) { if (!sees(vx, vy, fx, fy)) continue; cov[1]++; covP[1]++; if (ins) cov[0]++; if (insP) covP[0]++;
          const nearEnd = Math.min(u - f.a0, f.a1 - u) < 30; if (nearEnd) { corner[1]++; cornerP[1]++; if (ins) corner[0]++; if (insP) cornerP[0]++; } }
        else { if (near(x, y).some(g => g !== f && visible(g, vx, vy) && inQuad(quadOf(g), x, y))) continue; backN++; if (ins) back++; } } } }
  check('L05 nothing hidden is shown: no unseen floor in the clip; every wall / pillar point in it is in a seen face\'s band', floorLeak === 0 && solidBad === 0,
    `${nPose} poses; unseen floor inside the clip: ${floorLeak} samples (parent ${floorLeakP}); wall / pillar samples inside: ${solidIn}, outside any seen face's band: ${solidBad}` + (badAt.length ? ' e.g. ' + JSON.stringify(badAt.slice(0, 4)) : ''));
  check('L06 a face seen at a slant shows its 24 px band like a face seen square-on', cov[0] / cov[1] > .995, `band points (depth 6 / 14 / 21 px) of seen faces inside the clip: ${(100 * cov[0] / cov[1]).toFixed(2)} % of ${cov[1]} (parent ${(100 * covP[0] / covP[1]).toFixed(2)} %)`);
  check('L07 a face turned away from the player stays black', back === 0, `band points of faces turned away (and in no seen face's band): ${back} of ${backN} inside the clip`);
  check('L08 corners: band points within 30 px of a face\'s end inside the clip', corner[0] / corner[1] > .99, `${(100 * corner[0] / corner[1]).toFixed(2)} % of ${corner[1]} (parent ${(100 * cornerP[0] / cornerP[1]).toFixed(2)} %)`); }
/* L09 */
{ let worst = -Infinity; for (const [vx, vy] of poses.filter((_, i) => i % 7 === 0)) { const k = N.Pc.filter(r => Math.hypot(r.x + r.w / 2 - vx, r.y + r.h / 2 - vy) <= 700 + Math.hypot(r.w, r.h) / 2).length, nf = F.filter(f => visible(f, vx, vy)).length;
    worst = Math.max(worst, N.Hl(vx, vy, 700, 24).length / 2 - O.Hl(vx, vy, 700, 24).length / 2 - 12 * k - 10 * nf); }
  check('L09 bounded: at most 12 rays per pillar in reach + 10 per face turned to the player', worst <= 0, `rays beyond that bound: ${worst}`); }

/* L10: grazing views along side faces toward their convex corners */
{ let n = 0, inN = 0, inP = 0, views = 0;
  for (const f of F) { if (f.p) continue;
    for (const end of [0, 1]) { const sE = end ? f.s1 : f.s0; if (!(sE > 0) || f.a1 - f.a0 < 200) continue;
      for (const g of [120, 240]) for (const o of [12, 30]) { const u = end ? f.a1 - g : f.a0 + g, vx = f.h ? u : f.L + f.nx * o, vy = f.h ? f.L + f.ny * o : u;
        if (solidAt(vx, vy) || N.Pc.some(p => vx > p.x - 16 && vx < p.x + p.w + 16 && vy > p.y - 16 && vy < p.y + p.h + 16)) continue;
        const R = radial(N.Hl(vx, vy, 700, 24), vx, vy), RP = radial(O.Hl(vx, vy, 700, 24), vx, vy); views++;
        for (let w = 1; w <= 40; w += 3) for (const t of [4, 10, 16, 22]) { const uu = end ? f.a1 - w : f.a0 + w; if (w < sE * t / f.d + 1) continue;   // (in this face's own share of the corner)
          const x = f.h ? uu : f.L - f.nx * t, y = f.h ? f.L - f.ny * t : uu, [fx, fy] = footOf(f, x, y); if (!sees(vx, vy, fx, fy)) continue;
          const a = inClip(R, vx, vy, x, y), b = inClip(RP, vx, vy, x, y); if (a === null || b === null) continue; n++; if (a) inN++; if (b) inP++; } } } }
  check('L10 a side face seen along its length keeps its band right to its convex corner\'s mitre', n > 1000 && inN / n > .98, `${views} views along side faces; band points within 40 px of the corner, in the face's own share, foot seen: ${(100 * inN / n).toFixed(2)} % of ${n} inside the clip (parent ${(100 * inP / n).toFixed(2)} %)`); }


/* L12: a convex corner seen with both its faces: the two bands make the whole 24 px L (no notch where the art's mitre runs
 * deeper than 24 px), from viewers in front of the corner */
{ let n = 0, inN = 0, inP = 0, views = 0, corners = 0;
  for (let i = 0; i < F.length; i++) { const f = F[i];
    for (const k of [0, 1]) { const j = k ? f.n1 : f.n0; if (!(j > i)) continue; const g = F[j], c = k ? f.c1 : f.c0, u = k ? f.a1 : f.a0, px = f.h ? u : f.L, py = f.h ? f.L : u;
      const qx = f.h ? (k ? -1 : 1) : -f.nx, qy = f.h ? -f.ny : (k ? -1 : 1); corners++;
      for (const [a, b] of [[60, 60], [130, 50], [50, 130], [220, 100], [100, 220]]) { const vx = px - qx * a, vy = py - qy * b;
        if (solidAt(vx, vy) || N.Pc.some(p => vx > p.x - 16 && vx < p.x + p.w + 16 && vy > p.y - 16 && vy < p.y + p.h + 16)) continue;
        if (!visible(f, vx, vy) || !visible(g, vx, vy) || !sees(vx, vy, px - qx * .3, py - qy * .3)) continue;
        const R = radial(N.Hl(vx, vy, 700, 24), vx, vy), RP = radial(O.Hl(vx, vy, 700, 24), vx, vy); views++;
        for (const [h, e] of [[f, k], [g, c]]) for (let w = 1; w <= Math.min(40, (h.a1 - h.a0) / 2 - 1); w += 3) for (const t of [2, 8, 14, 20, 23]) {
          const base = h.h ? px : py, along = base + (e ? -w : w), x = h.h ? along : h.L - h.nx * t, y = h.h ? h.L - h.ny * t : along;
          /* the face seen from the corner to past this point (not a stretch an occluder cuts short) */
          if (![1, w / 3, 2 * w / 3, w, w + 4].every(z => { const [fx, fy] = footOf(h, h.h ? base + (e ? -z : z) : x, h.h ? y : base + (e ? -z : z)); return sees(vx, vy, fx, fy); })) continue;
          const A = inClip(R, vx, vy, x, y), B = inClip(RP, vx, vy, x, y); if (A === null || B === null) continue;
          n++; if (A) inN++; if (B) inP++; } } } }
  check('L12 a convex corner seen with both its faces: the two 24 px bands make the whole L (no notch at the joint)', n > 1000 && inN / n > .995,
    `${corners} convex corners, ${views} views in front of them; band points within 40 px of the corner on either face (half a pillar's), the face seen from the corner to past them: ${(100 * inN / n).toFixed(2)} % of ${n} inside the clip (parent ${(100 * inP / n).toFixed(2)} %)`); }

/* L11: cracks, over the poses and L10's views */
{ const views = poses.slice();
  for (const f of F) { if (f.p) continue; for (const end of [0, 1]) { const sE = end ? f.s1 : f.s0; if (!(sE > 0) || f.a1 - f.a0 < 200) continue;
    for (const g of [120, 240]) for (const o of [12, 30]) { const u = end ? f.a1 - g : f.a0 + g, vx = f.h ? u : f.L + f.nx * o, vy = f.h ? f.L + f.ny * o : u;
      if (solidAt(vx, vy) || N.Pc.some(p => vx > p.x - 16 && vx < p.x + p.w + 16 && vy > p.y - 16 && vy < p.y + p.h + 16)) continue; views.push([vx, vy]); } } }
  const tips = N.Vl.map(v => [v.x, v.y]).concat(...N.Pc.map(p => [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]]));
  let cracks = 0, cracksP = 0; const ex = [];
  const count = (P, vx, vy, out) => { const m = P.length / 2, A = [], Z = []; let c = 0;
    for (let k = 0; k < m; k++) { A.push(Math.atan2(P[2 * k + 1] - vy, P[2 * k] - vx)); Z.push(Math.hypot(P[2 * k] - vx, P[2 * k + 1] - vy)); }
    for (let k = 1; k < m - 1; k++) { if (A[k] - A[k - 1] > 1e-4 || A[k + 1] - A[k] > 1e-4 || !(Z[k] < Math.min(Z[k - 1], Z[k + 1]) - 2)) continue;
      const x = P[2 * k], y = P[2 * k + 1], ux = Math.cos(A[k]) * .05, uy = Math.sin(A[k]) * .05; if (!solidAt(x - ux, y - uy) && !solidAt(x + ux, y + uy)) continue;
      if (tips.some(([tx, ty]) => Math.abs(tx - x) < .05 && Math.abs(ty - y) < .05)) continue; c++; if (out && ex.length < 4) ex.push([Math.round(vx), Math.round(vy), +A[k].toFixed(6), +Z[k].toFixed(1)]); } return c; };
  for (const [vx, vy] of views) { cracks += count(N.Hl(vx, vy, 700, 24), vx, vy, true); cracksP += count(O.Hl(vx, vy, 700, 24), vx, vy, false); }
  check('L11 no cracks: no ray stops short inside a wall or pillar between close rays that go on (other than at an outline\'s tip)', cracks === 0, `${views.length} views: ${cracks} (parent ${cracksP})` + (ex.length ? ' e.g. ' + JSON.stringify(ex) : '')); }

const fails = results.filter(r => !r.ok).length;
console.log(`\nQA2 LOS TESTS: ${results.length - fails}/${results.length} PASS`);
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify({ game: GAME, parent: opt('parent') || REV, results }, null, 1));
process.exit(fails ? 1 : 0);
