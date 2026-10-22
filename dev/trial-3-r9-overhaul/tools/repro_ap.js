#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/repro_ap.js - the owner's additional refinement (October 22: active perception, reactive aggression,
 * path interruption, interception), measured on a tree's real server simulation (development only; checkpoint evidence, not a gate step).
 * Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-r9-overhaul/tools/repro_ap.js [--dir TREE] [--out FILE.json] [--only A,B,...]
 *
 * TREE defaults to this repository (R8's tree for the before).  Nothing sets a decision of the creature: people are placed and moved as
 * players move (the game's own move.js through the harness); a creature is given a hunger, and in A, B and G a long route of its own
 * (a roam goal far down the hall, as its own roaming would choose); E and F begin from the states the owner saw it in (a person it has
 * left; a departure under way).  What it did is read back.
 *   A  seen while roaming: a lit person walks across its view (520 px ahead; 900 px ahead; 450 px off at 55 and 420 px at 85 degrees from
 *      its way, in its periphery) -
 *      how soon it sees them, how soon it acts, how far it walks on along its old route after seeing them
 *   B  heard, not seen: a person sprints behind it (outside its view), on open floor 350 px off, then stands still in the dark - how soon
 *      its head and its body turn, how soon it sees them, whether it moves to see
 *   C  circled: a person runs round it at 230 px (just out of its spring), either way - how far off its facing is, whether it ever steps sideways or back
 *   E  someone it gave up on, seen again plainly while hungry - whether it takes them up again
 *   F  a departure under way, a new person crossing close in front - whether it reconsiders
 *   G  roaming, nobody about - how often and how long it stands still
 *   H  an interception made obsolete: seen at the gap, the person goes one way, then turns back in its view - how soon it drops the
 *      interception
 *   V  how far it sees a person: lit or dark, standing, walking, running, crouched, in the open hall
 *   P  (R16e) its periphery, in a side corridor: roaming east down the long hall past the mouth of the corridor north at x 5600, a person
 *      420 px up it, 75-85 degrees off its way, walks across the corridor (lit, unlit) or stands lit - whether and when it notices, when
 *      its head turns, when it sees them.  (A's 85-degree row was meant to be this; there the person is stopped by a wall at once and
 *      stands - kept as it was, for the comparison with R8) */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const ROOT = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..'));
const { World, LONG, AI, bystander, floorNear } = require(path.join(ROOT, 'dev', 'tests', 'lib.js'));
const ARENA = { x: 3960, y: 3384 };                                       // (an open hall: every wall at least 300 px off)
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const R = { tree: ARG.dir ? 'given' : 'this', A: [], B: [], C: [], E: [], F: [], G: [], H: [], V: [], P: [] };
const ONLY = ARG.only ? new Set(ARG.only.split(',')) : null, run = k => !ONLY || ONLY.has(k);   // (R16e: a subset of the probes)
const route = (w, e, x, y) => { if (e.roam) { e.roam.goal = { x, y }; e.roam.until = w.eng.now + 60; e.roam.pause = 0; } };

// A
if (run('A')) for (const [where, dx, dy, vx, vy, arena] of [['ahead 520', 520, 60, 0, -1], ['ahead 900', 900, 60, 0, -1], ['periphery 55deg 450 (open hall)', 258, 369, 1, 0, 1], ['periphery 85deg 420 (open hall)', 37, 418, 1, 0, 1]]) for (const h of [.3, .55, .75, .95]) for (const seed of [1, 2]) {
  const w = World(seed * 13 + Math.round(h * 100) + dx); bystander(w, 1300, 3300);
  const O = arena ? { x: ARENA.x - 250, y: ARENA.y - 120 } : { x: 3600, y: LONG.y };
  const e = w.eng.spawn('skinstealer', O.x, O.y, { hunger: h }); e.tier = 'near'; e.ang = 0; route(w, e, arena ? ARENA.x + 900 : 8400, O.y);
  let p = null, seenAt = -1, actAt = -1, first = '', onRoute = 0, lx = e.x, ly = e.y;
  w.run(14, (ww, t) => {
    // (placed relative to its way, east - not to where its body happens to turn)
    if (t > 2 && !p) { const f = floorNear(w, e.x + dx, e.y + dy) || { x: e.x + dx, y: e.y + dy }; p = w.player(f.x, f.y, { light: true, angle: 0 }); p.go(f.x + vx * 900, f.y + vy * 900, 'walk'); }
    if (p && seenAt < 0 && e.seenNow.has(p.id)) seenAt = t;
    if (seenAt >= 0 && actAt < 0 && (e.plan || e.rx || e.hunt)) { actAt = t; first = e.plan ? e.plan.k : e.rx ? 'look' : 'hunt'; }
    if (seenAt >= 0 && actAt < 0) onRoute += Math.hypot(e.x - lx, e.y - ly);
    lx = e.x; ly = e.y; return true; });
  R.A.push({ where, h, seed, seenAfter: seenAt < 0 ? null : +(seenAt - 2).toFixed(2), actAfterSight: actAt < 0 ? null : +(actAt - seenAt).toFixed(2), first, walkedOnAfterSight: Math.round(onRoute), endPlan: e.plan ? e.plan.k : '-' });
}
// B
if (run('B')) for (const h of [.3, .55, .8, .95]) for (const seed of [1, 2, 3]) {
  const w = World(seed * 17 + Math.round(h * 100) + 500); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 6000, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0; route(w, e, 8400, LONG.y);
  const p = w.player(5650, LONG.y, { light: false, angle: 0 }); p.stop('stand');
  let heardAt = -1, headAt = -1, bodyAt = -1, sawAt = -1, a0 = null, toward = 0, lx = e.x, ly = e.y, still = 0;
  w.run(12, (ww, t) => {
    if (t > 1 && t < 2.2) { if (!p.r) { p.r = 1; p.go(5500, LONG.y, 'run'); } } else if (t >= 2.2 && p.r === 1) { p.r = 2; p.stop('stand'); }
    if (a0 === null) a0 = e.ang;
    const bear = Math.atan2(p.y - e.y, p.x - e.x), base = Math.abs(angDiff(a0, bear));
    if (heardAt < 0 && t > 1 && e.mem.sounds.length) heardAt = t;
    if (heardAt >= 0 && headAt < 0 && Math.abs(angDiff(e.ang + (e.head || 0), bear)) < base - .5) headAt = t;
    if (heardAt >= 0 && bodyAt < 0 && Math.abs(angDiff(e.ang, bear)) < base - .5) bodyAt = t;
    if (sawAt < 0 && e.seenNow.has(p.id)) sawAt = t;
    if (heardAt >= 0 && sawAt < 0) { toward += ((p.x - e.x) * (e.x - lx) + (p.y - e.y) * (e.y - ly)) / (Math.hypot(p.x - e.x, p.y - e.y) || 1); if (e.speed < 5) still += 1 / 60; }
    lx = e.x; ly = e.y; return true; });
  R.B.push({ h, seed, heard: heardAt >= 0, headTurned: headAt < 0 ? null : +(headAt - heardAt).toFixed(2), bodyTurned: bodyAt < 0 ? null : +(bodyAt - heardAt).toFixed(2), sawAfter: sawAt < 0 ? null : +(sawAt - heardAt).toFixed(2), movedTowardBeforeSight: Math.round(toward), stillBeforeSight: +still.toFixed(1), endPlan: e.plan ? e.plan.k : '-' });
}
// C
if (run('C')) for (const h of [.75, .95]) for (const dir of [1, -1]) for (const seed of [1, 2]) {
  const w = World(Math.round(h * 100) + (dir > 0 ? 700 : 800) + seed * 3); bystander(w, 1300, 3300);
  const cx = 5000, cy = LONG.y, e = w.eng.spawn('skinstealer', cx, cy, { hunger: h }); e.tier = 'near'; e.ang = 0;
  const p = w.player(cx + 240, cy, { light: true, angle: Math.PI }); p.stop('stand');   // (just out of its spring: 230 px round it)
  let err = 0, n = 0, side = 0, back = 0, strikes = 0, killed = -1, pp = false, px = e.x, py = e.y;
  w.run(8, (ww, t) => {
    const a = Math.atan2(p.y - e.y, p.x - e.x); p.go(e.x + Math.cos(a + dir * .5) * 230, e.y + Math.sin(a + dir * .5) * 230, 'run'); p.look = Math.atan2(e.y - p.y, e.x - p.x);
    const bear = Math.atan2(p.y - e.y, p.x - e.x); err += Math.abs(angDiff(e.ang + (e.head || 0), bear)); n++;
    const mvx = e.x - px, mvy = e.y - py, f = mvx * Math.cos(e.ang) + mvy * Math.sin(e.ang), l = Math.abs(-mvx * Math.sin(e.ang) + mvy * Math.cos(e.ang)); px = e.x; py = e.y;
    if (f < -.4) back++; if (l > .8 && l > Math.abs(f)) side++;
    if (e.pounce && !pp) strikes++; pp = !!e.pounce; if (killed < 0 && w.kills.length) killed = t;
    return killed < 0; });
  R.C.push({ h, dir, seed, meanFacingErr: +(err / n).toFixed(2), sideTicks: side, backTicks: back, strikes, killedAt: killed < 0 ? null : +killed.toFixed(1) });
}
// E
if (run('E')) for (const h of [.45, .65, .75]) for (const seed of [1, 2, 3]) {
  const w = World(seed * 7 + Math.round(h * 100) + 900); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
  const p = w.player(5600, LONG.y, { light: true, angle: Math.PI }); p.stop('stand'); p.look = Math.PI;
  w.run(.5); e.left.set(p.id, w.eng.now + 45); (e.leftAt || (e.leftAt = new Map())).set(p.id, w.eng.now); e.plan = null; e.hunt = null;   // (as after a hunt it gave up)
  let inSight = 0, took = -1;
  w.run(20, (ww, t) => { if (!p.path || !p.path.length) p.route([{ x: p.x > 5500 ? 5450 : 5650, y: LONG.y }], 'walk'); if (e.seenNow.has(p.id)) inSight += 1 / 60; if (took < 0 && (e.hunt || (e.plan && e.plan.pid === p.id && e.plan.k !== 'leave'))) took = t; return true; });
  R.E.push({ h, seed, secondsInSight: +inSight.toFixed(1), tookUpAt: took < 0 ? null : +took.toFixed(1), endPlan: e.plan ? e.plan.k : '-' });
}
// F
if (run('F')) for (const h of [.45, .55, .65]) for (const seed of [1, 2, 3]) {
  const w = World(seed * 11 + Math.round(h * 100) + 1200); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 4200, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0;
  const q = w.player(3900, LONG.y + 30, { light: true }); q.stop('stand'); w.run(.3);
  e.plan = { k: 'leave', pid: q.id, t0: w.eng.now, until: w.eng.now + 20, goal: { x: 8400, y: LONG.y }, why: 'a departure (test)' }; e.left.set(q.id, w.eng.now + 45);
  let p = null, seenAt = -1, reAt = -1;
  w.run(12, (ww, t) => { if (t > 1 && !p) { p = w.player(e.x + Math.cos(e.ang) * 420, e.y + Math.sin(e.ang) * 420, { light: true, angle: Math.PI }); p.go(p.x - Math.sin(e.ang) * 400, p.y + Math.cos(e.ang) * 400, 'walk'); }
    if (p && seenAt < 0 && e.seenNow.has(p.id)) seenAt = t; if (seenAt >= 0 && reAt < 0 && !(e.plan && e.plan.k === 'leave')) reAt = t; return true; });
  R.F.push({ h, seed, seen: seenAt >= 0, reconsideredAfter: reAt < 0 ? null : +(reAt - seenAt).toFixed(2), endPlan: e.plan ? e.plan.k : '-' });
}
// G
if (run('G')) for (const h of [.3, .7, .95]) for (const seed of [1, 2]) {
  const w = World(seed + 1500 + Math.round(h * 100)); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: h }); e.tier = 'near';
  let stops = 0, still = 0, moving = true;
  // (kept at the engine's near level of detail, as with players about: in an empty level the far tier would stop it - the engine's, not it)
  w.run(60, () => { e.tier = 'near'; e.tierT = 99; const m = e.speed > 10; if (!m && moving) stops++; if (!m) still += 1 / 60; moving = m; return true; });
  R.G.push({ h, seed, stops, secondsStill: +still.toFixed(1) });
}
// H
if (run('H')) for (const seed of [1, 2, 3, 4, 5, 6]) {
  const w = World(seed + 16000); bystander(w, 8400, 900);
  const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .85 }); e.tier = 'near'; e.ang = Math.PI;
  let icAt = -1, sightIc = -1, dropAt = -1;
  w.run(18, (ww, t) => {
    if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.route([{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], 'walk'); }
    if (p.going === 2 && icAt >= 0 && t - icAt > 1.2) { p.going = 3; p.route([{ x: 1250, y: 4870 }, { x: 1300, y: 5150 }, { x: 1300, y: 5420 }, { x: 1700, y: 5560 }], 'run'); }   // it turns back, toward it
    if (p.light && p.y < 5440) p.light = false;
    const P = e.plan;
    if (icAt < 0 && P && P.k === 'intercept') icAt = t;
    if (p.going === 3 && sightIc < 0 && P && P.k === 'intercept' && e.seenNow.has(p.id)) sightIc = t;
    if (sightIc >= 0 && dropAt < 0 && !(P && P.k === 'intercept')) dropAt = t;
    return true; });
  R.H.push({ seed, intercepted: icAt >= 0, seenOnItsWay: sightIc >= 0, droppedAfter: dropAt < 0 ? null : +(dropAt - sightIc).toFixed(2), endPlan: e.plan ? e.plan.k : '-' });
}
// V
if (run('V')) for (const [label, light, mode] of [['lit, standing', true, 'stand'], ['lit, walking', true, 'walk'], ['lit, running', true, 'run'], ['dark, standing', false, 'stand'], ['dark, walking', false, 'walk'], ['dark, crouched', false, 'crouch']]) {
  let lo = 40, hi = 2000;
  for (let k = 0; k < 9; k++) {
    const d = (lo + hi) / 2, w = World(31 + k); const e = w.eng.spawn('skinstealer', 3700, LONG.y, { hunger: .5 }); e.tier = 'near'; e.ang = 0; e.plan = { k: 'watch', until: 1e9 };
    const p = w.player(3700 + d, LONG.y, { light, angle: Math.PI }); if (mode === 'stand' || mode === 'crouch') p.stop(mode); else p.go(3700 + d, LONG.y - 2000, mode);
    let seen = false; w.run(.6, () => { if (e.seenNow.has(p.id)) seen = true; e.ang = 0; e.head = 0; return !seen; });
    if (seen) lo = d; else hi = d;
  }
  R.V.push({ label, seesFrom: Math.round(lo) });
}
// P
if (run('P')) for (const [label, light, walk] of [['lit, walking across', true, true], ['unlit, walking across', false, true], ['lit, standing', true, false]]) for (const h of [.3, .7]) for (const seed of [1, 2]) {
  const w = World(seed * 19 + Math.round(h * 100) + (light ? 0 : 7) + (walk ? 0 : 3) + 2600); bystander(w, 1300, 3300);
  const e = w.eng.spawn('skinstealer', 5250, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = 0; route(w, e, 8400, LONG.y);
  let p = null, at = -1, head = -1, seen = -1, a0 = 0;
  w.run(8, (ww, t) => {
    if (!p && e.x >= 5520) { at = t; a0 = e.ang + (e.head || 0); p = w.player(walk ? 5420 : 5600, LONG.y - 420, { light, angle: 0 }); if (walk) p.go(5800, LONG.y - 420, 'walk'); else p.stop('stand'); }
    if (p) { const b = Math.atan2(p.y - e.y, p.x - e.x); if (head < 0 && Math.abs(angDiff(e.ang + (e.head || 0), b)) < Math.abs(angDiff(a0, b)) - .4) head = t; if (seen < 0 && e.seenNow.has(p.id)) seen = t; }
    return seen < 0 || t - seen < .5; });
  R.P.push({ label, h, seed, placed: at >= 0, offWay: p ? Math.round(Math.abs(angDiff(Math.atan2(LONG.y - 420 - LONG.y, (walk ? 5420 : 5600) - 5520), 0)) * 180 / Math.PI) : null, turnedAfter: head < 0 ? null : +(head - at).toFixed(2), seenAfter: seen < 0 ? null : +(seen - at).toFixed(2), noticed: e.tally.periph || 0, endPlan: e.plan ? e.plan.k : '-' });
}
const txt = [];
for (const k of ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'V', 'P']) for (const r of R[k]) txt.push(k + ' ' + JSON.stringify(r));
console.log(txt.join('\n'));
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
