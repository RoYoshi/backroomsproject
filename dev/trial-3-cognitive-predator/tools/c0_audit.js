#!/usr/bin/env node
/* dev/trial-3-cognitive-predator/tools/c0_audit.js - C0: the owner's "passive, slow, not smart" measured on the real simulation
 * (development only; checkpoint evidence, not a gate step).  Trial 3 and its refinements are not owner-approved.
 *
 *   node dev/trial-3-cognitive-predator/tools/c0_audit.js [--repo DIR] [--seeds 1,2,3,4,5,6] [--only W,X,C,L,U,R,M,F] [--out FILE.json]
 *
 * DIR is the tree whose simulation runs (default: this repository): the same command on R8 (f378049) and on a later checkpoint gives the
 * before / after tables.  Each scene runs that tree's server simulation (dev/harness.js: sim.js + ai.js as built, players moved by the
 * game's own move.js).  The tool reads the creature's state and the people's real positions ONLY TO MEASURE (what it perceived - e.seenNow,
 * its sounds - and what it did); it never feeds anything back.
 *
 * Measured against each STIMULUS - a moment something the creature can legitimately sense changes (first sighting, a seen person turning
 * back, a person it left being alone in view, the person it waits for walking away audibly...):
 *   obs     the first tick at or after the change at which it really has the evidence (seen now; a sound received)
 *   orient  obs -> its facing (body + head) is within 0.5 rad of the stimulus, or has turned 0.3 rad toward it
 *   choice  obs -> its plan changes (a new plan object, or a hunt begun)
 *   move    obs -> it moves with purpose (over 40 px/s in a hunting plan - approach, chase, flank, intercept, search, a bait retreat) or springs
 * and over a whole run: the longest stretch it stood still while it saw a person and was hungry (>= .4) with no strike under way
 * ("idle while seen"), the plan timeline (each change: when, which, why), the closest approach, kills.
 *   W  watched: a lit person 450 px off in the long hall stares at it, standing; hunger .5 .65 .8 .95; 45 s.
 *   X  crossing runner: it stands in the big lit room facing the hall; a lit person runs along the hall across its view, turns back at
 *      the far side, runs back; hunger .5 .65; 30 s.
 *   C  circling: a lit person runs round a pillar 500 px from it, lap after lap; hunger .55 .75 .95; 40 s.
 *   L  a departure kept: two lit people together (a lone ambusher leaves); 2 s into its departure one of them leaves the game, the other
 *      stays, unaware, in view; hunger .5 .7; 25 s.  When does it take up the one left alone?
 *   U  a lure kept: watched at .5 it backs out of sight and waits; 3 s after it is hidden the person walks away east, audibly; 25 s.
 *   R  the straight race (R7's PR27 setting): after the race is lost, how long does it trail behind, and does it ever choose anything else?
 *   M  two people: a watcher 450 px off in the light, and an unaware walker 650 px off; hunger .7; 30 s.  Whom does it consider?
 *   F  a glimpse at a fork (the south-west scene): a lit person walks north past wall C's gap, torch off, and goes east round wall B; .75.
 *   P  a passer-by: it stands in the big lit room; a lit person walks along the hall below it, unaware (facing on); hunger .45 .55; 25 s.
 *   O  the owner's own test: a lit person runs circles round the creature itself, 170 px off; hunger .5; 30 s.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = { seeds: '1,2,3,4,5,6' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(ARG.repo || path.join(__dirname, '..', '..', '..'));
const { World, DT } = require(path.join(REPO, 'dev', 'harness.js'));
const SEEDS = ARG.seeds.split(',').map(Number), ONLY = ARG.only ? ARG.only.split(',') : null;
const LONG_Y = 3504, PILLAR = { x: 4952, y: 3584, R: 175 };
const MOVE = new Set(['approach', 'chase', 'flank', 'intercept', 'search']);
const ang = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
function bystander(w, x, y) { const q = w.player(x, y, { light: false }); q.stop('crouch'); return q; }

/* the recorder: every tick, what it perceives of the tracked people and what it does */
function recorder(w, e, people) {
  const R = { ticks: [], tl: [], kills: 0, closest: 1e9, planN: 0 }; let lastPlan = null, lastK = '';
  R.take = t => {
    const P = e.plan; if (P !== lastPlan) { R.planN++; lastPlan = P; }
    const k = planOf(e);
    if (k !== lastK) { R.tl.push([+t.toFixed(2), k, (e.dbg.why || '').slice(0, 80)]); lastK = k; }
    const seen = people.map(p => e.seenNow.has(p.id) ? 1 : 0);
    R.ticks.push({ t, k, pn: R.planN, hunt: e.hunt ? e.hunt.pid : 0, sp: e.speed || 0, x: e.x, y: e.y, f: e.ang + (e.head || 0), seen, ps: people.map(p => ({ x: p.x, y: p.y, dead: !!p.dead || !p.alive })),
      wind: !!e.pounce || e.recover > 0, h: e.hunger, snd: e.mem.sounds.length ? e.mem.sounds[0].id : 0 });
    for (const p of people) if (!p.dead) R.closest = Math.min(R.closest, Math.hypot(p.x - e.x, p.y - e.y));
  };
  R.done = () => { R.kills = w.kills.length; R.closest = Math.round(R.closest); return R; };
  return R;
}
/* a stimulus at time ts about person index i (where: their real position, measuring only): obs, orient, choice, move */
function measure(R, ts, i, o = {}) {
  const T = R.ticks; let k0 = T.findIndex(q => q.t >= ts - 1e-9); if (k0 < 0) return null;
  const evid = o.sound ? (q => q.snd !== T[Math.max(0, k0 - 1)].snd) : (q => q.seen[i]);
  let ko = -1; for (let k = k0; k < T.length; k++) if (evid(T[k])) { ko = k; break; }
  if (ko < 0) return { obs: null };
  const o0 = T[ko], pre = T[Math.max(0, ko - 1)], bearing = q => Math.atan2(q.ps[i].y - q.y, q.ps[i].x - q.x), off0 = Math.abs(ang(pre.f, bearing(o0)));
  let orient = null, choice = null, move = null;
  for (let k = ko; k < T.length; k++) {
    const q = T[k], off = Math.abs(ang(q.f, bearing(q)));
    if (orient === null && (off < .5 || off < off0 - .3)) orient = q.t - o0.t;
    if (choice === null && (q.pn !== pre.pn || (q.hunt && !pre.hunt))) choice = q.t - o0.t;      // (the plan before the evidence arrived: a decision in the same think counts 0)
    if (move === null && (q.wind || (q.sp > 40 && (MOVE.has(q.k) || (q.k === 'retreat' && o.retreatCounts))))) move = q.t - o0.t;
    if (orient !== null && choice !== null && move !== null) break;
  }
  const r2 = v => v === null ? null : +v.toFixed(2);
  return { obs: +(o0.t - ts).toFixed(2), orient: r2(orient), choice: r2(choice), move: r2(move), planAtObs: o0.k };
}
/* the longest stretch it stood still, hungry, seeing a living person, with no strike under way (and the plan it was in) */
function idleSeen(R) {
  let best = 0, bestK = '', run = 0, runK = '', at = 0, bestAt = 0;
  for (const q of R.ticks) {
    const idle = q.h >= .4 && q.sp < 15 && !q.wind && q.k !== 'feed' && q.seen.some((s, i) => s && !q.ps[i].dead);
    if (idle) { if (!run) { at = q.t; runK = q.k; } run += DT; if (run > best) { best = run; bestK = runK; bestAt = at; } } else run = 0;
  }
  return { secs: +best.toFixed(2), plan: bestK, at: +bestAt.toFixed(1) };
}
const share = R => { const s = {}; for (const q of R.ticks) s[q.k] = (s[q.k] || 0) + DT; for (const k in s) s[k] = +(s[k] / (R.ticks.length * DT)).toFixed(2); return s; };
function run(seed, secs, setup, each) {
  const w = World(seed); const S = setup(w); const R = recorder(w, S.e, S.people);
  w.run(secs, (ww, t) => { if (each) each(t, S, R); R.take(t); return true; });
  return Object.assign(R.done(), { S });
}
const SCENES = {
  W(seed, h) {
    const R = run(seed + 9100, 45, w => { bystander(w, 1300, 3300); const p = w.player(5000, LONG_Y, { light: true, angle: 0 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, LONG_Y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x); return { e, people: [p] }; });
    return { first: measure(R, 0, 0), idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills, closest: R.closest };
  },
  X(seed, h) {
    let turned = -1;
    const R = run(seed + 9200, 30, w => { bystander(w, 1300, 3300); const p = w.player(4700, LONG_Y, { light: true, angle: 0 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5600, 3020, { hunger: h }); e.tier = 'near'; e.ang = Math.PI / 2; return { e, people: [p] }; },
    (t, S) => { const p = S.people[0]; if (t > .5 && !p.leg) { p.leg = 1; p.go(6400, LONG_Y, 'run'); } if (p.leg === 1 && p.x > 6100) { p.leg = 2; turned = t; p.go(4300, LONG_Y, 'run'); } });
    return { first: measure(R, 0, 0), turn: turned >= 0 ? measure(R, turned, 0) : null, idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills, closest: R.closest };
  },
  C(seed, h) {
    const ring = []; for (let lap = 0; lap < 14; lap++) for (let k = 0; k < 16; k++) { const a = -k / 16 * Math.PI * 2; ring.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); }
    const R = run(seed + 9300, 40, w => { bystander(w, 1300, 3300); const p = w.player(PILLAR.x + PILLAR.R, PILLAR.y, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, LONG_Y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; return { e, people: [p] }; },
    (t, S) => { const p = S.people[0]; if (t > .3 && !p.leg) { p.leg = 1; p.route(ring, 'run'); } });
    const plans = [...new Set(R.tl.map(q => q[1]))];
    return { first: measure(R, 0, 0), idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills, closest: R.closest, plans, planChanges: R.tl.length };
  },
  L(seed, h) {
    let goneAt = -1;
    const R = run(seed + 9400, 25, w => { bystander(w, 1300, 3300);
      const a = w.player(5000, LONG_Y - 30, { light: true, angle: Math.PI }), b = w.player(5040, LONG_Y + 30, { light: true, angle: Math.PI });
      for (const q of [a, b]) { q.stop('stand'); q.look = Math.PI; }                    // facing away: unaware
      const e = w.eng.spawn('skinstealer', 5420, LONG_Y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; return { e, people: [a, b], w }; },
    (t, S) => { const e = S.e; if (goneAt < 0 && e.plan && e.plan.k === 'leave' && S.lt === undefined) S.lt = t;
      if (goneAt < 0 && S.lt !== undefined && t - S.lt >= 2) { goneAt = t; S.w.sim.removePlayer(S.people[1]); S.people[1].dead = true; } });
    return { left: R.S.lt !== undefined ? +R.S.lt.toFixed(2) : null, alone: goneAt >= 0 ? measure(R, goneAt, 0) : null, idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills, closest: R.closest };
  },
  U(seed, h) {
    let hidAt = -1, walkAt = -1;
    const R = run(seed + 9500, 25, w => { bystander(w, 1300, 3300); const p = w.player(5000, LONG_Y, { light: true, angle: 0 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, LONG_Y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x); return { e, people: [p] }; },
    (t, S) => { const e = S.e, p = S.people[0];
      if (hidAt < 0 && t > 1 && !e.seenNow.has(p.id) && e.plan && (e.plan.k === 'lure' || e.plan.k === 'retreat')) hidAt = t;
      if (hidAt >= 0 && walkAt < 0 && t - hidAt >= 3) { walkAt = t; p.look = 0; p.go(3200, LONG_Y, 'run'); } });   // (running: footsteps it can hear)
    return { hidden: hidAt >= 0 ? +hidAt.toFixed(2) : null, walkAway: walkAt >= 0 ? measure(R, walkAt, 0, { sound: true }) : null, idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills };
  },
  R(seed, h) {
    let lost = -1;
    const R = run(seed + 9600, 30, w => { bystander(w, 1300, 3300); const p = w.player(3600, LONG_Y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
      const e = w.eng.spawn('skinstealer', 3300, LONG_Y, { hunger: h }); e.tier = 'near'; e.ang = 0; return { e, people: [p] }; },
    (t, S) => { const p = S.people[0]; if (t > .3 && !p.leg) { p.leg = 1; p.go(8700, LONG_Y, 'run'); } if (lost < 0 && S.e.tally.chaseLost) lost = t; });
    const after = lost < 0 ? [] : R.tl.filter(q => q[0] >= lost - .05);
    const trail = R.ticks.filter(q => q.t >= lost && q.k === 'approach').length * DT;
    return { lostAt: lost >= 0 ? +lost.toFixed(2) : null, trailingSecs: +trail.toFixed(1), after: after.map(q => q[1]).join('>'), tl: R.tl, kills: R.kills };
  },
  M(seed, h) {
    const R = run(seed + 9700, 30, w => { bystander(w, 1300, 3300);
      const a = w.player(5000, LONG_Y, { light: true, angle: 0 }); a.stop('stand');
      const b = w.player(5600, 3150, { light: true, angle: Math.PI }); b.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, LONG_Y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
      a.look = () => Math.atan2(e.y - a.y, e.x - a.x); b.look = 0; return { e, people: [a, b] }; },
    (t, S) => { const b = S.people[1]; if (t > .5 && !b.leg) { b.leg = 1; b.route([{ x: 5800, y: 3150 }, { x: 5800, y: 3700 }, { x: 5400, y: 3700 }], 'walk'); } });
    const about = {}; for (const q of R.ticks) if (q.hunt) about[q.hunt] = (about[q.hunt] || 0) + DT;
    const ids = R.S.people.map(p => p.id);
    return { huntedSecs: { watcher: +(about[ids[0]] || 0).toFixed(1), walker: +(about[ids[1]] || 0).toFixed(1) }, idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills };
  },
  F(seed, h) {
    let lostAt = -1;
    const R = run(seed + 9800, 30, w => { bystander(w, 8400, 900); const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; return { e, people: [p] }; },
    (t, S) => { const p = S.people[0], e = S.e;
      if (t > .5 && !p.leg) { p.leg = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
      if (p.leg === 1 && p.path && !p.path.length) { p.leg = 2; p.route([{ x: 1720, y: 4900 }], 'walk'); }
      if (p.light && p.y < 5440) p.light = false;
      if (lostAt < 0 && t > 1 && S.sawOnce && !e.seenNow.has(p.id)) lostAt = t; if (e.seenNow.has(p.id)) S.sawOnce = 1; });
    let lostDecide = null; if (lostAt >= 0) { const T = R.ticks, k0 = T.findIndex(q => q.t >= lostAt), pn = T[k0].pn; const k1 = T.findIndex((q, k) => k > k0 && q.pn !== pn); const k2 = T.findIndex((q, k) => k > k0 && q.sp > 40 && MOVE.has(q.k)); lostDecide = { choice: k1 > 0 ? +(T[k1].t - lostAt).toFixed(2) : null, move: k2 > 0 ? +(T[k2].t - lostAt).toFixed(2) : null }; }
    return { lostAt: lostAt >= 0 ? +lostAt.toFixed(2) : null, afterLoss: lostDecide, tl: R.tl, kills: R.kills, share: share(R) };
  },
};
SCENES.P = function (seed, h) {
  const R = run(seed + 9900, 25, w => { bystander(w, 1300, 3300); const p = w.player(4700, LONG_Y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: h }); e.tier = 'near'; e.ang = Math.PI / 2; return { e, people: [p] }; },
  (t, S) => { const p = S.people[0]; if (t > .5 && !p.leg) { p.leg = 1; p.go(6500, LONG_Y, 'walk'); } });
  return { first: measure(R, 0, 0), idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills, closest: R.closest };
};
SCENES.O = function (seed, h) {
  const ring = []; for (let lap = 0; lap < 12; lap++) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; ring.push({ x: 5450 + Math.cos(a) * 170, y: LONG_Y + Math.sin(a) * 170 }); }
  const R = run(seed + 9950, 30, w => { bystander(w, 1300, 3300); const p = w.player(5620, LONG_Y, { light: true, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5450, LONG_Y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; return { e, people: [p] }; },
  (t, S) => { const p = S.people[0]; if (t > .3 && !p.leg) { p.leg = 1; p.route(ring, 'run'); } });
  return { first: measure(R, 0, 0), idle: idleSeen(R), share: share(R), tl: R.tl, kills: R.kills, closest: R.closest };
};
const HUNGER = { W: [.45, .5, .55, .65, .8, .95], X: [.5, .65], C: [.55, .75, .95], L: [.5, .7], U: [.5, .55], R: [.75, .95], M: [.55, .7, .9], F: [.75], P: [.45, .55], O: [.5] };
const out = { tool: 'dev/trial-3-cognitive-predator/tools/c0_audit.js', repo: path.basename(REPO), node: process.version, seeds: SEEDS, runs: {} };
const q = (a, p) => { const v = a.filter(x => x !== null && x !== undefined).sort((x, y) => x - y); return v.length ? +v[Math.min(v.length - 1, Math.floor(p * v.length))].toFixed(2) : null; };
for (const k of Object.keys(SCENES)) {
  if (ONLY && !ONLY.includes(k)) continue;
  for (const h of HUNGER[k]) {
    const rs = SEEDS.map(s => { try { return SCENES[k](s, h); } catch (err) { return { err: String(err.stack).split('\n').slice(0, 3).join(' | ') }; } });
    out.runs[`${k} h=${h}`] = rs;
    const pick = f => rs.map(f).filter(v => v !== undefined);
    let line = `${k} h=${h}:`;
    const lat = (name, f) => { const a = pick(r => { const m = f(r); return m ? m : null; }).filter(Boolean); if (!a.length) return; const miss = n => a.filter(m => m[n] === null).length;
      line += ` ${name}[n=${a.length}] orient p50 ${q(a.map(m => m.orient), .5)} worst ${q(a.map(m => m.orient), 1)} (none ${miss('orient')}); choice p50 ${q(a.map(m => m.choice), .5)} worst ${q(a.map(m => m.choice), 1)} (none ${miss('choice')}); move p50 ${q(a.map(m => m.move), .5)} worst ${q(a.map(m => m.move), 1)} (none ${miss('move')});`; };
    lat('first', r => r.first); lat('turn', r => r.turn); lat('alone', r => r.alone); lat('walkAway', r => r.walkAway);
    if (rs[0] && rs[0].idle) line += ` idle-while-seen worst ${Math.max(...pick(r => r.idle ? r.idle.secs : 0))} s (${pick(r => r.idle ? r.idle.plan + '@' + r.idle.at : '').join(' ')});`;
    if (k === 'R') line += ` lost ${pick(r => r.lostAt).join('/')} s; trailing ${pick(r => r.trailingSecs).join('/')} s; then ${[...new Set(pick(r => r.after))].join(' | ')};`;
    if (k === 'M') line += ` hunted watcher/walker ${pick(r => r.huntedSecs.watcher + '/' + r.huntedSecs.walker).join(' ')} s;`;
    if (k === 'F') line += ` lost sight at ${pick(r => r.lostAt).join('/')} s; then choice ${pick(r => r.afterLoss ? r.afterLoss.choice : null).join('/')} s, move ${pick(r => r.afterLoss ? r.afterLoss.move : null).join('/')} s;`;
    if (k === 'C') line += ` plans ${[...new Set(pick(r => (r.plans || []).join('>')))].slice(0, 4).join(' | ')}; plan changes ${pick(r => r.planChanges).join('/')};`;
    if (k === 'L') line += ` left at ${pick(r => r.left).join('/')} s;`;
    line += ` kills ${pick(r => r.kills).join('/')}; plans ${[...new Set(pick(r => r.tl ? r.tl.map(x => x[1]).join('>') : ''))].slice(0, 3).join(' | ').slice(0, 260)}`;
    const errs = rs.filter(r => r.err); if (errs.length) line += ` ERRORS ${errs.length}: ${errs[0].err}`;
    console.log(line);
  }
}
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(out) + '\n');
