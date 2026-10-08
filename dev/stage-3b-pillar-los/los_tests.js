/* Stage 3B pillar LOS - focused tests (development only; never served).  Node only, about a minute.
 *
 *   node dev/stage-3b-pillar-los/los_tests.js [--game PATH] [--parent DIR | --rev SHA]
 *
 * The game's own LOS code (Uc, Vl, Pc, Hl) is loaded verbatim from this tree's bundle and from the parent's (by default
 * the QA1 parent d3ec226, read from git), and compared.
 *   T01 the audit's polygon lookup (radial) agrees with an even-odd point test
 *   T02 the bundle differs from the parent only inside Hl; the call sites (entity mask r 0, darkness clip r 24) unchanged
 *   T03 the exact ray query and every table it reads are unchanged (Uc, Hc, Pc, Vl, the lamp list Fc, Bc / Oc) - light, AI,
 *       collision and the server read these, never Hl
 *   T04 walls exactly as before: with no pillar in range, both polygons are byte-identical to the parent's (map-wide)
 *   T05 walls exactly as before in PILLAR HALL: every ray the parent cast is still cast, to the same distance (entity mask),
 *       and the darkness clip's padding is unchanged on every ray that does not stop at a pillar
 *   T06 each pillar corner within reach has its three events (angle - eps, angle, angle + eps); pillars out of reach none
 *   T07 the entity mask matches exact visibility around the pillar (orbit, strafe, close): no leak, no over-hide
 *   T08 the darkness clip never shows floor behind a pillar, and a padded vertex on a pillar ray stays inside that pillar
 *   T09 the pillar faces stay visible: every face-band point the parent's clip showed is still shown, and every band point
 *       within 24 px of its face along the ray is shown (the presentation allowance, as for walls)
 *   T10 an actor behind a pillar is revealed on the very pose its body first truly clears the corner, never before
 *   T11 standing exactly on a pillar face's line (the event angle at +-pi): no leak
 *   T12 the shadow edge follows the exact silhouette corner while strafing in 0.25 px steps (no snapping)
 *   T13 bounded cost: at most 12 extra rays per pillar in reach (14 for the darkness clip: the two rays where a pillar ray's
 *       24 px allowance meets the pillar's side); Hl has no quality input (one polygon for every tier) */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execSync } = require('child_process');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), REV = opt('rev') || 'd3ec2269af873dbc381d223ad538a43ba06f5c45';
const BUNDLE = 'assets/index-DKbV5Nv9.js', LIB = require('./los_lib.js');
let PARENT = opt('parent') ? path.resolve(opt('parent')) : null;
if (!PARENT) { PARENT = fs.mkdtempSync(path.join(os.tmpdir(), 'plos-parent-')); fs.mkdirSync(path.join(PARENT, 'assets'));
  for (const f of [BUNDLE, 'world.js']) fs.writeFileSync(path.join(PARENT, f), execSync(`git -C ${JSON.stringify(GAME)} show ${REV}:${f}`, { maxBuffer: 1 << 26 })); }
const N = LIB.load(GAME), O = LIB.load(PARENT), D2R = Math.PI / 180, TAU = 2 * Math.PI;
const AUD = require('./los_audit.js'), radial = AUD.radial;
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const P = N.Pc.find(p => p.x === 8564 && p.y === 1364), cx = P.x + P.w / 2, cy = P.y + P.h / 2;
const inRect = (r, x, y, e = 1e-6) => x >= r.x - e && x <= r.x + r.w + e && y >= r.y - e && y <= r.y + r.h + e;
const pillarAt = (x, y) => N.Pc.find(r => inRect(r, x, y, 1e-3));
const rays = (L, vx, vy, pad) => { const p = L.Hl(vx, vy, 700, pad), out = []; for (let i = 0; i < p.length; i += 2) out.push([Math.atan2(p[i + 1] - vy, p[i] - vx), Math.hypot(p[i] - vx, p[i + 1] - vy), p[i], p[i + 1]]); return out; };
const walkable = (x, y) => N.zc(Math.floor(x / 96), Math.floor(y / 96)) && !N.Pc.some(p => x > p.x - 15 && x < p.x + p.w + 15 && y > p.y - 15 && y < p.y + p.h + 15);
const poses = [];                                             /* orbit (3 radii, 3 degree steps), two strafes (2 px), close */
for (const rad of [45, 90, 160]) for (let d = 0; d < 360; d += 3) poses.push([cx + Math.cos(d * D2R) * rad, cy + Math.sin(d * D2R) * rad]);
for (const dy of [30, 200]) for (let x = P.x - 120; x <= P.x + P.w + 120; x += 2) poses.push([x, P.y + P.h + dy]);
for (const [x, y] of [[cx, P.y - 16], [cx, P.y + P.h + 16], [P.x - 16, cy], [P.x + P.w + 16, cy], [P.x - 12, P.y - 12], [P.x + P.w + 12, P.y - 12], [P.x - 12, P.y + P.h + 12], [P.x + P.w + 12, P.y + P.h + 12]]) poses.push([x, y]);

/* T01 */
{ let bad = 0, n = 0; for (const [vx, vy] of [[cx + 50, cy], [cx - 60, cy + 5], [P.x - 20, P.y + P.h + 30], [900, 2984], [8112, 1392 - 70]]) for (const pad of [0, 24]) {
    const p = N.Hl(vx, vy, 700, pad), R = radial(p, vx, vy); for (let k = 0; k < 6000; k++) { const a = Math.random() * TAU - Math.PI, d = Math.random() * 700, x = vx + Math.cos(a) * d, y = vy + Math.sin(a) * d; n++; if (N.inPoly(p, x, y) !== (d < R(a)) && Math.abs(d - R(a)) > .01) bad++; } }
  check('T01 polygon lookup = even-odd point test', bad === 0, `${bad} / ${n} points differ`); }
/* T02 */
{ const A = fs.readFileSync(path.join(GAME, BUNDLE), 'utf8'), B = fs.readFileSync(path.join(PARENT, BUNDLE), 'utf8'), h = s => s.indexOf('function Hl('), e = (s, i) => s.indexOf('function Ul(', i);
  const ai = h(A), bi = h(B), aj = e(A, ai), bj = e(B, bi);
  const same = A.slice(0, ai) === B.slice(0, bi) && A.slice(aj) === B.slice(bj), calls = s => (s.match(/this\.sightPoints=Hl\(a\.x,a\.y,700\),this\.scenePoints=Hl\(a\.x,a\.y,700,24\)/g) || []).length;
  check('T02 only Hl changed; its two call sites unchanged', same && calls(A) === 1 && calls(B) === 1 && (A.match(/Hl\(/g) || []).length === 3, `prefix+suffix identical: ${same}; Hl ${bj - bi} -> ${aj - ai} chars`); }
/* T03 */
{ const src = (L, f) => L.g[f].toString(), J = v => JSON.stringify(v);
  const fns = ['Uc', 'Hc', 'zc', 'Bc', 'Oc'].filter(f => typeof N.g[f] === 'function'), fnSame = fns.every(f => src(N, f) === src(O, f));
  const tabSame = J(N.Pc) === J(O.Pc) && J(N.Vl) === J(O.Vl) && J(N.g.Fc) === J(O.g.Fc);
  let raySame = true; for (let k = 0; k < 4000 && raySame; k++) { const x = 7400 + Math.random() * 1500, y = 700 + Math.random() * 1400, a = Math.random() * TAU - Math.PI; if (N.Uc(x, y, a, 700) !== O.Uc(x, y, a, 700)) raySame = false; }
  check('T03 exact ray query and its tables unchanged', fnSame && tabSame && raySame, `functions ${fns.join(' ')} identical: ${fnSame}; Pc/Vl/Fc identical: ${tabSame}; 4000 random Uc rays equal: ${raySame}`); }
/* T04 */
{ let n = 0, diff = 0; for (let cyc = 0; cyc < N.g.FBH; cyc += 1) for (let cxc = 0; cxc < N.g.FBW; cxc += 2) { const x = cxc * 96 + 48 + (cyc % 3) * 11, y = cyc * 96 + 48 - (cxc % 5) * 7;
    if (!N.zc(cxc, cyc) || N.Pc.some(r => Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y) <= 700 + 40)) continue; n++;
    for (const pad of [0, 24]) { const a = N.Hl(x, y, 700, pad), b = O.Hl(x, y, 700, pad); if (a.length !== b.length || a.some((v, i) => v !== b[i])) diff++; } }
  check('T04 walls: away from pillars both polygons byte-identical to the parent', n > 200 && diff === 0, `${n} positions map-wide, ${diff} differ`); }
/* T05 */
{ let n = 0, miss = 0, padDiff = 0, distDiff = 0; const hall = []; for (let y = 780; y <= 2000; y += 37) for (let x = 7330; x <= 8800; x += 41) if (walkable(x, y)) hall.push([x, y]);
  for (const [vx, vy] of hall.concat(poses.filter((_, i) => i % 5 === 0))) {
    for (const pad of [0, 24]) { const nr = new Map(N.HlRec(vx, vy, 700, pad).rays.map(r => [r[0], r])), or = O.HlRec(vx, vy, 700, pad).rays; n++;
      /* each parent ray (the same angle, to the bit) is still cast, to the same exact-hit distance and - unless it stops at a
       * pillar - to the same vertex */
      for (const [a, d, x, y] of or) { const h = nr.get(a); if (!h) { miss++; continue; } if (h[1] !== d) distDiff++;
        const onPillar = d < 700 && pillarAt(vx + Math.cos(a) * d, vy + Math.sin(a) * d); if (!onPillar && (h[2] !== x || h[3] !== y)) padDiff++; } } }
  check('T05 walls in PILLAR HALL: every parent ray kept, same distance; wall padding unchanged', miss === 0 && distDiff === 0 && padDiff === 0, `${n} polygons; parent rays missing ${miss}; distance changed ${distDiff}; vertex changed on a ray not stopping at a pillar ${padDiff}`); }
/* T06 */
{ let bad = 0, n = 0; for (const [vx, vy] of [[cx, cy + 90], [8112, 1392 + 80], [7300 + 50, 1392], [7000, 1100], [6400, 1300]]) { const nr = rays(N, vx, vy, 0), or = rays(O, vx, vy, 0), ang = nr.map(r => r[0]);
    let want = 0; for (const r of N.Pc) { const inReach = Math.hypot(r.x + r.w / 2 - vx, r.y + r.h / 2 - vy) <= 700 + Math.hypot(r.w, r.h) / 2; if (!inReach) continue; want += 12;
      for (const [X, Y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) { const a = Math.atan2(Y - vy, X - vx); n++;
        for (const e of [-2e-5, 0, 2e-5]) { const t = Math.atan2(Math.sin(a + e), Math.cos(a + e)); if (!ang.some(v => Math.abs(Math.atan2(Math.sin(v - t), Math.cos(v - t))) < 1e-9)) bad++; } } }
    if (nr.length !== or.length + want) bad++; }
  check('T06 three events per corner of each pillar in reach, none for pillars out of reach', bad === 0, `${n} corners checked, ${bad} problems`); }
/* T07 / T08 */
{ let leak = 0, over = 0, sLeak = 0, outside = 0, n = 0; for (const [vx, vy] of poses) { const m = AUD.measure(vx, vy, P, false); n++;
    leak = Math.max(leak, m.leak.pillar + m.leak.wall); over = Math.max(over, m.over.pillar + m.over.wall); sLeak = Math.max(sLeak, m.sLeak.pillar);
    for (const [a, U, x, y] of N.HlRec(vx, vy, 700, 24).rays) { const r = U < 700 && pillarAt(vx + Math.cos(a) * U, vy + Math.sin(a) * U); if (r && !inRect(r, x, y, 1e-6)) outside++; } }
  check('T07 entity mask = exact visibility around the pillar', leak === 0 && over < 2, `${n} poses; worst leak ${leak.toFixed(1)} px2, worst over-hide ${over.toFixed(1)} px2`);
  check('T08 darkness clip: no floor behind a pillar; pillar-ray padding stays inside the pillar', sLeak === 0 && outside === 0, `${n} poses; worst floor shown behind the pillar ${sLeak.toFixed(1)} px2; padded vertices outside their pillar ${outside}`); }
/* T09 */
{ let lost = 0, missing = 0, beyond = 0, gained = 0, n = 0; const FACE = { pN: 12, pS: 18, pE: 14, pW: 14 };
  for (const [vx, vy] of poses.filter((_, i) => i % 2 === 0)) { const cN = N.Hl(vx, vy, 700, 24), cO = O.Hl(vx, vy, 700, 24), RN = radial(cN, vx, vy), RO = radial(cO, vx, vy);
    for (let u = 1; u < P.w; u += 2) for (let t = .5; t < 18; t += 1.5) for (const [x, y, deep] of [[P.x + u, P.y + t, FACE.pN], [P.x + u, P.y + P.h - t, FACE.pS], [P.x + t, P.y + u, FACE.pW], [P.x + P.w - t, P.y + u, FACE.pE]]) {
      if (t > deep) continue; const a = Math.atan2(y - vy, x - vx), d = Math.hypot(x - vx, y - vy), U = N.Uc(vx, vy, a, 700);
      if (!(U < 700 && pillarAt(vx + Math.cos(a) * U, vy + Math.sin(a) * U) === P) || d - U < 0) continue;   /* this band point's ray enters this pillar first */
      if (RN.gap(a) < 5e-5) continue; n++;
      const within = d - U <= 24, was = d < RO(a), now = d < RN(a) + .05;   /* .05 px: a chord between two padded rays */
      if (within && was && !now) lost++;                                     /* shown before, hidden now */
      if (within && !now) missing++;                                         /* within the allowance but hidden */
      if (!within && was && !(d < RN(a))) beyond++;                          /* deeper than the allowance: the parent's chords only */
      if (!was && now) gained++; } }
  check('T09 pillar face bands: nothing within the allowance lost; the 24 px allowance kept everywhere', lost === 0 && missing === 0, `${n} band points in sight; lost ${lost}; inside the allowance but hidden ${missing}; (deeper than 24 px along the ray, shown before only by a chord across the pillar's side: ${beyond}; now shown, hidden before: ${gained})`); }
/* T10 */
{ const ACT = 14, ax = P.x - 40, ay = P.y - 60, res = []; let early = 0, late = 0, first = null;   /* an actor north-west of the pillar; the viewer strafes east to west below it */
  const disc = []; for (let r = 1; r <= ACT; r += 1.5) for (let k = 0; k < 24; k++) disc.push([ax + Math.cos(k / 24 * TAU) * r, ay + Math.sin(k / 24 * TAU) * r]); disc.push([ax, ay]);
  for (let vx = P.x + P.w + 60; vx >= P.x - 80; vx -= .25) { const vy = P.y + P.h + 70, s = N.Hl(vx, vy, 700), R = radial(s, vx, vy);
    let shown = false, truly = false; for (const [x, y] of disc) { const a = Math.atan2(y - vy, x - vx), d = Math.hypot(x - vx, y - vy); if (R.gap(a) < 5e-5) continue; if (d < R(a)) shown = true; if (N.exactSees(vx, vy, x, y)) truly = true; }
    if (shown && !truly) early++; if (truly && !shown) late++; if (truly && first === null) first = vx; res.push([vx, shown, truly]); }
  check('T10 actor behind a pillar: shown exactly when its body truly clears the corner', early === 0 && late === 0 && first !== null, `${res.length} poses (0.25 px); shown early ${early}, late ${late}; first truly visible at x ${first}`); }
/* T11 */
{ let worst = 0, n = 0; for (const [vx, vy] of [[P.x + P.w + 30, P.y], [P.x + P.w + 30, P.y + P.h], [P.x + P.w + 200, P.y + P.h], [P.x - 30, P.y], [P.x - 200, P.y + P.h], [P.x, P.y - 30], [P.x + P.w, P.y + P.h + 30], [P.x + P.w, P.y - 200]]) {
    const m = AUD.measure(vx, vy, P, false); n++; worst = Math.max(worst, m.leak.pillar + m.leak.wall, m.sLeak.pillar); }
  check('T11 on a pillar face line (event angle at +-pi / +-pi/2): no leak', worst === 0, `${n} poses; worst ${worst}`); }
/* T12 */
{ let worst = 0, prev = null, n = 0; const sil = (vx, vy) => { const c0 = Math.atan2(cy - vy, cx - vx); return [[P.x, P.y], [P.x + P.w, P.y], [P.x, P.y + P.h], [P.x + P.w, P.y + P.h]].map(([X, Y]) => Math.atan2(Y - vy, X - vx) - c0).map(a => Math.atan2(Math.sin(a), Math.cos(a))); };
  for (let vx = P.x - 100; vx <= P.x + P.w + 100; vx += .25) { const vy = P.y + P.h + 120, s = N.Hl(vx, vy, 700), R = radial(s, vx, vy), c0 = Math.atan2(cy - vy, cx - vx), S = sil(vx, vy), lo = Math.min(...S), hi = Math.max(...S), far = Math.hypot(cx - vx, cy - vy) + 120;
    let e0 = null, e1 = null; for (let a = 0; a >= lo - 5 * D2R; a -= .005 * D2R) { if (R(c0 + a) >= far) { e0 = a; break; } } for (let a = 0; a <= hi + 5 * D2R; a += .005 * D2R) { if (R(c0 + a) >= far) { e1 = a; break; } }
    if (e0 === null || e1 === null) continue; n++; worst = Math.max(worst, Math.abs(e0 - lo) / D2R, Math.abs(e1 - hi) / D2R); }
  check('T12 shadow edges on the exact silhouette corners while strafing (0.25 px)', worst < .02, `${n} poses; worst edge offset ${worst.toFixed(4)} deg`); }
/* T13 */
{ const hl = N.src.slice(N.src.indexOf('function Hl('), N.src.indexOf('}return a}', N.src.indexOf('function Hl(')));
  const noTier = !/quality|tier|lighting|__brRole|window/.test(hl);
  let worst = 0, worstC = 0; for (const [vx, vy] of [[8112, 1392 + 80], [7700, 1200], [cx, cy + 50], [P.x - 16, cy], [7400, 1900]]) { const k = N.Pc.filter(r => Math.hypot(r.x + r.w / 2 - vx, r.y + r.h / 2 - vy) <= 700 + Math.hypot(r.w, r.h) / 2).length;
    worst = Math.max(worst, N.Hl(vx, vy).length / 2 - O.Hl(vx, vy).length / 2 - 12 * k); worstC = Math.max(worstC, N.Hl(vx, vy, 700, 24).length / 2 - O.Hl(vx, vy, 700, 24).length / 2 - 14 * k); }
  check('T13 bounded: 12 extra rays per pillar in reach (entity mask), 14 (darkness clip); no quality input', worst <= 0 && worstC <= 0 && noTier, `beyond 12 per pillar: ${worst}; beyond 14: ${worstC}; Hl reads no tier / quality state: ${noTier}`); }
const fails = results.filter(r => !r.ok).length;
console.log(`\nPILLAR LOS TESTS: ${results.length - fails}/${results.length} PASS`);
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify({ game: GAME, parent: opt('parent') || REV, results }, null, 1));
process.exit(fails ? 1 : 0);
