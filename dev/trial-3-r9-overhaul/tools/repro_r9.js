#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/repro_r9.js - R9: the owner's October 22 report measured on the real simulation (development tool; the
 * checkpoints' evidence, not a gate step).  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-r9-overhaul/tools/repro_r9.js [--repo DIR] [--seeds 1,...,8] [--only W,X,L] [--out FILE.json] [--trace 1]
 *
 * DIR is the tree whose simulation runs (default: this repository): the same command on R8 (f378049) and on a later checkpoint gives the
 * before / after tables.  Each scenario runs that tree's server simulation (dev/harness.js: sim.js + ai.js as built, players moved by the
 * game's own move.js).  The player's view of the creature is the TEST-ONLY oracle qa_sight.js (the client's own sight mask and darkness,
 * on the server's level): it reads where both really are; the creature never does.
 *   W  watched: a lit person stands in the long lit hall facing the creature 450 px east (eye contact), 30 s; hunger .3 .45 .6 .75 .85 .95.
 *   X  watched by a person who also walks: as W, the person strolls west then back (they keep looking at it), 30 s; hunger .75 .95.
 *   U  unaware: as W, but the person faces west, away from it (no eye contact) - the lit hall is still on their screen; hunger .6 .85.
 *   L  seen once, lost: the person walks north past wall C's gap where it sees them, turns the light off and walks on (east / back /
 *      north / north-east), 30 s; hunger .75 .95.
 * For every STEALTH transit - a plan the creature runs to reach a place out of the person's sight: flank (to its spot), intercept (to its
 * waiting place), the bait's back-off, an approach from a flank - it records, ten times a second, whether the person could see it.  The
 * failure modes (R9_AUDIT.md):
 *   F1  hidden destination, exposed transit: its goal was out of the person's sight when chosen, yet >= 96 px of the way there was in it;
 *   F2  across their front: while in their sight, within 75 deg of their facing, its bearing from them swung >= 25 deg;
 *   F3  no re-plan when seen: in their sight for 0.6 s running on the way, the same plan going on;
 *   F4  slow when hidden: out of their sight, more than 300 px to go, at under 200 px/s (it could have run);
 *   OPEN: a plan that comes on in sight on purpose (an open approach, a chase) is not a stealth transit and is reported apart.  An approach
 *   begun because 'P.. is not watching' (R8: no eye contact) creeps under cover believing itself unobserved: it IS a stealth transit
 *   (approach-unwatched) - the person's screen shows everything round them that is in their sight and lit, wherever they face. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = { seeds: '1,2,3,4,5,6,7,8' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(ARG.repo || path.join(__dirname, '..', '..', '..'));
const { World, DT } = require(path.join(REPO, 'dev', 'harness.js'));
const { sees } = require('./qa_sight.js');
const SEEDS = ARG.seeds.split(',').map(Number), ONLY = ARG.only ? ARG.only.split(',') : null;
const LONG = { y: 3504 };
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function bystander(w, x, y) { const q = w.player(x, y, { light: false }); q.stop('crouch'); return q; }
/* is the plan under way a stealth transit (and where to)?  null if not */
function stealthGoal(e) {
  const P = e.plan; if (!P) return null;
  if (P.k === 'flank' && !P.arrived && P.spot) return { k: 'flank', x: P.spot.x, y: P.spot.y };
  if (P.k === 'intercept' && !P.arrived && P.g) return { k: 'intercept', x: P.g.x, y: P.g.y };
  if (P.k === 'retreat' && !P.arrived && P.spot && P.bait) return { k: 'bait', x: P.spot.x, y: P.spot.y };
  if (P.k === 'approach' && P.side) return { k: 'side-approach', x: e.x, y: e.y };
  if (P.k === 'approach' && !P.shadow && /is not watching/.test(P.why || '')) return { k: 'approach-unwatched', x: e.x, y: e.y };   // (it believes itself unobserved: a creeping approach)
  if (P.mode === 'covert' && P.goal) return { k: P.k + ':covert', x: P.goal.x, y: P.goal.y };   // (R13 on: a plan that says it is covert)
  return null;
}
function runScene(kind, seed, h, sub) {
  let w, p, e;
  if (kind === 'W' || kind === 'X' || kind === 'U') {
    w = World(seed + (kind === 'W' ? 9100 : kind === 'U' ? 9400 : 9200)); bystander(w, 1300, 3300);
    p = w.player(5000, LONG.y, { light: true, angle: 0 }); p.stop('stand');
    e = w.eng.spawn('skinstealer', 5450, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = kind === 'U' ? Math.PI : () => Math.atan2(e.y - p.y, e.x - p.x);   // (U: they face west, away from it - it is still on their screen)
  } else {
    w = World(seed + 9300); bystander(w, 8400, 900);
    p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
    e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  }
  const WAYS = { east: [{ x: 1720, y: 4900 }], back: [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }],
    north: [{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], northEast: [{ x: 1250, y: 4870 }, { x: 2080, y: 4870 }] };
  const R = { kind, seed, h, sub: sub || '', transits: [], open: { n: 0, visT: 0 }, kills: 0, plans: [], first: null, samples: [], time: {}, seenAt: -1, huntAt: -1 };
  const HUNTING = new Set(['approach', 'chase', 'flank', 'intercept', 'search', 'lure', 'listen', 'hunt', 'retreat']);
  let T = null, lastPlan = null, lastK = '';
  const close = (t, why) => { if (!T) return; T.end = +t.toFixed(1); T.endWhy = why; T.hiddenAtEnd = !sees(w, p, e.x, e.y).vis; R.transits.push(T); T = null; };
  w.run(30, (ww, t) => {
    if (kind === 'X') { if (t > 2 && !p.going) { p.going = 1; p.route([{ x: 4700, y: LONG.y }, { x: 5050, y: LONG.y }, { x: 4650, y: LONG.y }], 'walk'); } }
    if (kind === 'L') {
      if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
      if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.route(WAYS[sub], 'walk'); }
      if (p.going === 2 && p.path && !p.path.length) { p.going = 3; p.stop('crouch'); }
      if (p.light && p.y < 5440) p.light = false;
    }
    const k = planOf(e); if (k !== lastK) { R.plans.push([+t.toFixed(1), k, (e.dbg.why || '').slice(0, 100)]); lastK = k; }
    if (!R.first && e.dbg.decide) R.first = e.dbg.decide;
    if (Math.round(t * 60) % 6) return true;                                   // ten times a second
    const V = sees(w, p, e.x, e.y), g = stealthGoal(e), P = e.plan;
    R.time[k] = +((R.time[k] || 0) + .1).toFixed(1);
    if (R.seenAt < 0 && e.seenNow.has(p.id)) R.seenAt = +t.toFixed(1);
    if (R.huntAt < 0 && R.seenAt >= 0 && (e.hunt || (HUNTING.has(k) && P && P.pid === p.id))) R.huntAt = +t.toFixed(1);
    if (ARG.trace) R.samples.push([+t.toFixed(1), k, Math.round(e.x), Math.round(e.y), V.vis ? 1 : 0, Math.round(e.speed), e.act || '-']);
    if (T && (P !== T.P || !g)) close(t, P !== T.P ? 'plan changed to ' + k : 'arrived');
    if (g && !T) {
      T = { k: g.k, P, t0: +t.toFixed(1), goal: { x: Math.round(g.x), y: Math.round(g.y) }, goalHiddenAtStart: !sees(w, p, g.x, g.y).vis, startVisible: V.vis,
        len: 0, visLen: 0, visT: 0, runVis: 0, maxRunVis: 0, kept06: 0, front: 0, slowHidden: 0, hiddenT: 0, b0: null, lx: e.x, ly: e.y, why: (e.dbg.why || '').slice(0, 110) };
    }
    if (T) {
      const step = Math.hypot(e.x - T.lx, e.y - T.ly); T.lx = e.x; T.ly = e.y; T.len += step;
      if (V.vis) {
        T.visLen += step; T.visT += .1; T.runVis += .1; T.maxRunVis = Math.max(T.maxRunVis, T.runVis); if (T.runVis >= .6) T.kept06 = 1;
        const bear = Math.atan2(e.y - p.y, e.x - p.x), inFront = Math.abs(angDiff(bear, p.angle)) < 75 * Math.PI / 180;
        if (inFront) { if (T.b0 === null) T.b0 = bear; else if (Math.abs(angDiff(bear, T.b0)) >= 25 * Math.PI / 180) { T.front = 1; } } else T.b0 = null;
      } else {
        T.runVis = 0; T.b0 = null; T.hiddenT += .1;
        const goal = g ? Math.hypot(g.x - e.x, g.y - e.y) : 0; if (goal > 300 && e.speed < 200 && step > 1) T.slowHidden += .1;
      }
    }
    if (P && (P.k === 'chase' || (P.k === 'approach' && !P.side && !/is not watching/.test(P.why || '')))) { R.open.n++; if (V.vis) R.open.visT += .1; }
    return true;
  });
  close(30, 'time');
  R.kills = w.kills.length; R.tally = { flank: e.tally.flank, intercept: e.tally.intercept, hunt: e.tally.hunt, noFlank: e.tally.noFlank, pounce: e.tally.pounce, wrong: e.tally.wrong };
  for (const t of R.transits) {
    delete t.P; delete t.lx; delete t.ly; delete t.b0; delete t.runVis;
    for (const q of ['len', 'visLen']) t[q] = Math.round(t[q]); for (const q of ['visT', 'maxRunVis', 'slowHidden', 'hiddenT']) t[q] = +t[q].toFixed(1);
    t.F1 = t.goalHiddenAtStart && t.visLen >= 96 ? 1 : 0; t.F2 = t.front; t.F3 = t.kept06; t.F4 = t.slowHidden >= .5 ? 1 : 0;
  }
  return R;
}
const scenes = [];
for (const kind of ['W', 'X', 'U', 'L']) {
  if (ONLY && !ONLY.includes(kind)) continue;
  const hs = kind === 'W' ? [.3, .45, .6, .75, .85, .95] : kind === 'U' ? [.6, .85] : [.75, .95];
  const subs = kind === 'L' ? ['east', 'back', 'north', 'northEast'] : [''];
  for (const h of hs) for (const sub of subs) for (const seed of SEEDS) { if (kind === 'L' && seed > 4) continue; scenes.push(runScene(kind, seed, h, sub)); }
}
/* the table: per scene kind and hunger, the stealth transits and their failure modes */
const rows = [];
const groups = new Map(); for (const s of scenes) { const key = s.kind + ' h' + s.h; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(s); }
for (const [key, ss] of groups) {
  const tr = ss.flatMap(s => s.transits), by = k => tr.filter(t => t.k === k);
  const f = q => tr.filter(t => t[q]).length;
  rows.push({ group: key, runs: ss.length, transits: tr.length, kinds: [...new Set(tr.map(t => t.k))].map(k => k + ':' + by(k).length).join(' '),
    F1: f('F1'), F2: f('F2'), F3: f('F3'), F4: f('F4'), visLen: tr.reduce((a, t) => a + t.visLen, 0), len: tr.reduce((a, t) => a + t.len, 0),
    startVisible: tr.filter(t => t.startVisible).length, openVisT: +ss.reduce((a, s) => a + s.open.visT, 0).toFixed(1), kills: ss.reduce((a, s) => a + s.kills, 0),
    idle: +(ss.reduce((a, s) => a + (s.time.watch || 0) + (s.time.leave || 0) + (s.time.roam || 0), 0) / ss.reduce((a, s) => a + Object.values(s.time).reduce((x, y) => x + y, 0), 0)).toFixed(2),
    huntAt: ss.map(s => s.huntAt).join('/') });
}
/* the same per kind of transit (a flank's way, the bait's back-off, an approach from a flank, an interception) */
const kinds = [];
for (const [key, ss] of groups) {
  const tr = ss.flatMap(s => s.transits);
  for (const k of [...new Set(tr.map(t => t.k))]) {
    const q = tr.filter(t => t.k === k), f = n => q.filter(t => t[n]).length;
    kinds.push({ group: key, k, n: q.length, F1: f('F1'), F2: f('F2'), F3: f('F3'), F4: f('F4'), visLen: q.reduce((a, t) => a + t.visLen, 0), len: q.reduce((a, t) => a + t.len, 0),
      visT: +q.reduce((a, t) => a + t.visT, 0).toFixed(1), startVisible: q.filter(t => t.startVisible).length, goalHidden: q.filter(t => t.goalHiddenAtStart).length });
  }
}
const out = { repo: path.basename(REPO), seeds: SEEDS, at: 'harness t=60+', rows, kinds, scenes };
const txt = ['R9 exposed-ambush reproduction (' + path.basename(REPO) + ')', 'group | runs | stealth transits (kinds) | F1 hidden-goal-exposed-way | F2 across-front | F3 seen>=0.6s-kept | F4 slow-hidden | px in sight / px moved | began in sight | open-plan s in sight | kills | share watch/leave/roam | first hunt step after first sight (s, per run)'];
for (const r of rows) txt.push(`${r.group} | ${r.runs} | ${r.transits} (${r.kinds}) | ${r.F1} | ${r.F2} | ${r.F3} | ${r.F4} | ${r.visLen}/${r.len} | ${r.startVisible} | ${r.openVisT} | ${r.kills} | ${r.idle} | ${r.huntAt}`);
txt.push('', 'by kind: group | kind | n | goal out of sight at start | began in sight | F1 | F2 | F3 | F4 | px in sight / px | s in sight');
for (const r of kinds) txt.push(`${r.group} | ${r.k} | ${r.n} | ${r.goalHidden} | ${r.startVisible} | ${r.F1} | ${r.F2} | ${r.F3} | ${r.F4} | ${r.visLen}/${r.len} | ${r.visT}`);
const worst = scenes.flatMap(s => s.transits.map(t => Object.assign({ scene: s.kind + s.sub + ' h' + s.h + ' s' + s.seed }, t))).filter(t => t.F1 || t.F3).sort((a, b) => b.visLen - a.visLen).slice(0, 8);
txt.push('', 'worst stealth transits (in sight the longest):');
for (const t of worst) txt.push(`  ${t.scene} ${t.k} t${t.t0}-${t.end} goal ${t.goal.x},${t.goal.y} hidden@start ${t.goalHiddenAtStart} | moved ${t.len}px, ${t.visLen}px in sight (${t.visT}s, longest ${t.maxRunVis}s) | across front ${t.F2} | ends: ${t.endWhy} | why: ${t.why}`);
console.log(txt.join('\n'));
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
