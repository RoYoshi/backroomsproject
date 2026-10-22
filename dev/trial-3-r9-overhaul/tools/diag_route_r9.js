#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/diag_route_r9.js - R9: WHY a flank's way is in the person's sight (development tool; R9_AUDIT.md H1-H3).
 *
 *   node dev/trial-3-r9-overhaul/tools/diag_route_r9.js [--repo DIR] [--seeds 1,...,8] [--h .75] [--out FILE.json]
 *
 * W scene of repro_r9.js (a lit person watching it in the long hall).  At the moment the first flank begins it freezes the picture and
 * measures, from where the person really stands (the TEST-ONLY oracle qa_sight.js; the creature never reads it):
 *   - the route R8 planned (its plan() with skCover): length, length in the person's sight, the share of its cells skCover penalised;
 *   - the same spot by a route that may not enter the person's sight at all except on the way OUT of it: the shortest way to the nearest
 *     place out of their sight that leads AWAY from them (not across), then a route whose every cell is out of their sight (A* with those
 *     cells forbidden).  Whether such a route exists, how long, how long its first (exit) leg is in sight.
 *   - skCover's own price for the R8 route against the covered one (why the cheaper exposed way won).
 * It reads the creature's plan only to report it. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = { seeds: '1,2,3,4,5,6,7,8', h: '.75' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(ARG.repo || path.join(__dirname, '..', '..', '..'));
const { World } = require(path.join(REPO, 'dev', 'harness.js'));
const { sees } = require('./qa_sight.js');
const LONG = { y: 3504 };
const len = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; };
/* metres of a polyline in the person's sight (sampled every 12 px) */
function inSight(w, p, pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 12));
    for (let k = 0; k < n; k++) { const t = (k + .5) / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; if (sees(w, p, x, y).vis) L += d / n; }
  }
  return L;
}
const rows = [];
for (const seed of ARG.seeds.split(',').map(Number)) {
  const w = World(seed + 9100), g = w.eng.geo; w.player(1300, 3300, { light: false }).stop('crouch');
  const p = w.player(5000, LONG.y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, LONG.y, { hunger: +ARG.h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  let F = null; w.run(8, () => { if (e.plan && e.plan.k === 'flank') { F = e.plan; return false; } return true; });
  if (!F) { rows.push({ seed, flank: false, plan: e.plan ? e.plan.k : '-' }); continue; }
  const start = { x: e.x, y: e.y }, route = [start].concat(e.path.map(q => ({ x: q.x, y: q.y })));
  const L8 = len(route), V8 = inSight(w, p, route);
  // skCover's price of that route vs its length (its cells: the 48 px grid it was searched on)
  const cover = j => (g.lamp[j] || 0) * 140 + (Math.hypot(g.cx(j) - p.x, g.cy(j) - p.y) < 700 && g.los(p.x, p.y, g.cx(j), g.cy(j)) ? 70 : 0);
  const cellsOf = pts => { const S = new Set(); for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 24)); for (let k = 0; k <= n; k++) S.add(g.cellAt(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n)); } return [...S]; };
  const c8 = cellsOf(route), price8 = c8.reduce((a, j) => a + cover(j), 0), seen8 = c8.filter(j => sees(w, p, g.cx(j), g.cy(j)).vis).length;
  // a covered alternative: out of sight first, AWAY from them (the exit point farther from them than it stands), then hidden cells only
  const hidden = j => !sees(w, p, g.cx(j), g.cy(j)).vis;
  let exit = null;
  for (let R = 48; R <= 900 && !exit; R += 48) for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R;
    if (!g.clear(x, y, e.rc + 2, 'walk') || sees(w, p, x, y).vis) continue;
    if (Math.hypot(x - p.x, y - p.y) < Math.hypot(e.x - p.x, e.y - p.y)) continue;   // never toward them: an exit is a withdrawal
    const leg = g.path(e.x, e.y, x, y, e.caps, { maxNodes: 3000 }); if (!leg) continue;
    const pts = [start].concat(leg.map(q => ({ x: q.x, y: q.y }))); if (len(pts) > R * 2.2) continue;
    exit = { x, y, pts }; break;
  }
  let alt = null;
  if (exit) {
    const way = g.path(exit.x, exit.y, F.spot.x, F.spot.y, e.caps, { maxNodes: 6000, cost: j => hidden(j) ? 0 : Infinity });
    if (way) { const pts = [{ x: exit.x, y: exit.y }].concat(way.map(q => ({ x: q.x, y: q.y }))); alt = { exitLen: Math.round(len(exit.pts)), exitSeen: Math.round(inSight(w, p, exit.pts)), coverLen: Math.round(len(pts)), coverSeen: Math.round(inSight(w, p, pts)) }; }
  }
  rows.push({ seed, flank: true, t: +(w.t).toFixed(1), from: [Math.round(start.x), Math.round(start.y)], spot: [Math.round(F.spot.x), Math.round(F.spot.y)], spotHidden: !sees(w, p, F.spot.x, F.spot.y).vis,
    r8: { len: Math.round(L8), seen: Math.round(V8), cells: c8.length, cellsSeen: seen8, coverPrice: Math.round(price8) },
    exit: exit ? { at: [Math.round(exit.x), Math.round(exit.y)] } : null, alt });
}
const txt = [`R9 flank route diagnosis (${path.basename(REPO)}), hunger ${ARG.h}`, 'seed | spot (out of their sight) | R8 route: length, in sight, cells seen/cells, skCover price | covered alternative: exit leg (in sight), hidden leg (in sight) | total vs R8'];
for (const r of rows) {
  if (!r.flank) { txt.push(`${r.seed} | no flank in 8 s (plan ${r.plan})`); continue; }
  const a = r.alt; txt.push(`${r.seed} | ${r.spot} ${r.spotHidden ? 'hidden' : 'SEEN'} | ${r.r8.len} px, ${r.r8.seen} px in sight, ${r.r8.cellsSeen}/${r.r8.cells} cells, price ${r.r8.coverPrice} | ` +
    (a ? `exit ${a.exitLen} px (${a.exitSeen} in sight) + hidden ${a.coverLen} px (${a.coverSeen} in sight) = ${a.exitLen + a.coverLen} px (${((a.exitLen + a.coverLen) / r.r8.len).toFixed(2)}x)` : r.exit ? 'exit found, NO covered route to the spot' : 'no exit away from them'));
}
console.log(txt.join('\n'));
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(rows, null, 1) + '\n');
