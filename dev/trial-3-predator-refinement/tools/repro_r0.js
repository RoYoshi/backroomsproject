#!/usr/bin/env node
/* dev/trial-3-predator-refinement/tools/repro_r0.js - R0: the owner's report measured on the real simulation (development only; the
 * checkpoints' evidence, not a gate step).  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-predator-refinement/tools/repro_r0.js [--repo DIR] [--seeds 1,2,3,4,5,6,7,8] [--only W,U,C,L,R,F] [--samples 1] [--out FILE.json]
 * (--samples 1 also keeps a sample of every run twice a second: time, plan, act, distance, seen, confidence, hunger, stamina)
 *
 * DIR is the tree whose simulation runs (default: this repository); the same command on the baseline (4518f93) and on a later checkpoint
 * gives the before / after tables.  Each scenario runs that tree's server simulation (dev/harness.js: sim.js + ai.js as built, players
 * moved by the game's own move.js) and records ten times a second what the Skin-Stealer perceives of the person (seen now; a sound it
 * heard, named or anonymous) next to what it does (plan, state, act, why).  It reads the AI's state only to report it.
 *   W  watched:   a lit person 450 px off in the long hall keeps facing it (eye contact), standing, for 45 s; hunger .05 .2 .5 .75 .95 1.0.
 *   U  unwatched: the same with the person facing away (the contrast).
 *   C  continuous watcher, starving (.95): 120 s; does any plan ever end in a kill other than by walking into its reach?
 *   L  seen once, lost, footsteps: in the dark south-west a lit person walks north past wall C's gap where it sees them, switches the
 *      light off and RUNS on round wall B (audible, out of its sight); hunger .95.  What does it do with the footsteps it hears?
 *   R  the straight race: a fresh runner on the long hall; hunger .95.  After the race is lost, what does it do in the next 30 s?
 *   F  a failed guess: as L but the person doubles back west (as SK23's B) walking, then runs back east past it unseen 10 s later.
 * For each run: the plan timeline (each change: when, which, why), the share of time per plan, the first decision's scores, the
 * closest approach, kills, and for L / F the sounds heard after the last sighting (anonymous or named) and whether any plan changed then. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = { seeds: '1,2,3,4,5,6,7,8' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(ARG.repo || path.join(__dirname, '..', '..', '..'));
const { World, DT } = require(path.join(REPO, 'dev', 'harness.js'));
const SEEDS = ARG.seeds.split(',').map(Number), ONLY = ARG.only ? ARG.only.split(',') : null;
const LONG = { y: 3504 };
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';   // ('hunt': between two steps of a hunt - from R1 on)
/* a far, hidden, crouched bystander: keeps the room alive after a death (the server pauses a room with nobody alive) */
function bystander(w, x, y) { const q = w.player(x, y, { light: false }); q.stop('crouch'); return q; }
/* the record of one run: plan changes, time per plan, sounds after the last sighting */
function recorder(w, e, p) {
  const R = { changes: [], time: {}, closest: 1e9, firstDecide: null, soundsAfterLost: { named: 0, anon: 0 }, changesOnSound: 0, lastSeen: -1, kills: 0, samples: [] };
  let cur = undefined, lastHear = 0, lastPlanObj = null;
  R.take = t => {
    const k = planOf(e), seen = e.seenNow.has(p.id), r = e.mem.p.get(p.id);
    if (seen) R.lastSeen = t;
    if (k !== cur || e.plan !== lastPlanObj) { if (k !== cur) R.changes.push([+t.toFixed(1), k, (e.dbg.why || '').slice(0, 110)]); cur = k; lastPlanObj = e.plan; }
    R.time[k] = (R.time[k] || 0) + DT;
    if (!R.firstDecide && e.dbg.decide) R.firstDecide = e.dbg.decide;
    R.closest = Math.min(R.closest, Math.hypot(p.x - e.x, p.y - e.y));
    const H = e.hear;
    if (H && H.id !== lastHear) {
      lastHear = H.id;
      if (R.lastSeen >= 0 && !seen && t - R.lastSeen > .3) { if (H.pid) R.soundsAfterLost.named++; else if (H.src === 0) R.soundsAfterLost.anon++; R.lastSoundT = t; }
    }
    if (R.lastSoundT !== undefined && t - R.lastSoundT < .25 && R.changes.length && R.changes[R.changes.length - 1][0] >= t - .05) R.changesOnSound++;
    if (ARG.samples && Math.round(t * 10) % 5 === 0) R.samples.push([+t.toFixed(1), k, e.act || '-', Math.round(Math.hypot(p.x - e.x, p.y - e.y)), seen ? 1 : 0, r ? +r.conf.toFixed(2) : 0, +e.hunger.toFixed(2), Math.round(e.stam)]);
  };
  R.done = () => { for (const k in R.time) R.time[k] = +R.time[k].toFixed(1); R.closest = Math.round(R.closest); R.kills = w.kills.filter(q => q.pid === p.id).length; delete R.take; delete R.done; return R; };
  return R;
}
const out = { tool: 'dev/trial-3-predator-refinement/tools/repro_r0.js', repo: path.basename(REPO),   // (its folder's name only: no machine path in the evidence) node: process.version, seeds: SEEDS, runs: {} };
const want = k => !ONLY || ONLY.includes(k);
/* W / U: a lit person in the long hall, the creature 450 px east of them, facing each other (W) or the person facing away (U) */
function hall(seed, h, watched, secs) {
  const w = World(seed + 900), y = LONG.y;
  bystander(w, 1300, 3300);
  const p = w.player(5000, y, { light: true, angle: watched ? 0 : Math.PI }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = watched ? () => Math.atan2(e.y - p.y, e.x - p.x) : Math.PI;
  const R = recorder(w, e, p);
  w.run(secs, (ww, t) => { R.take(t); return true; });
  const r = R.done();
  r.leaveAt = (r.changes.find(c => c[1] === 'leave') || [-1])[0]; r.retreatAt = (r.changes.find(c => c[1] === 'retreat') || [-1])[0];
  r.endD = Math.round(Math.hypot(p.x - e.x, p.y - e.y)); r.tally = e.tally;
  return r;
}
const HUNGERS = [.05, .2, .5, .75, .95, 1];
for (const [K, watched] of [['W', true], ['U', false]]) if (want(K)) {
  out.runs[K] = {};
  for (const h of HUNGERS) out.runs[K][h] = SEEDS.map(s => hall(s, h, watched, 45));
}
if (want('C')) out.runs.C = SEEDS.map(s => hall(s, .95, true, 120));
/* L / F: the dark south-west (wall A x 976..1072, gap y 5300..5460; wall B y 5018..5066; wall C x 1552..1648, gap y 5498..5642) */
function lost(seed, mode) {
  const w = World(seed + 950);
  bystander(w, 8400, 900);
  const p = w.player(1300, 5950, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 2300, 5570, { hunger: .95 }); e.tier = 'near'; e.ang = Math.PI;
  const R = recorder(w, e, p);
  w.run(mode === 'F' ? 50 : 40, (ww, t) => {
    if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5400 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; if (mode === 'L') p.pathTo(1720, 4300, 'run'); else p.pathTo(700, 5330, 'walk'); }
    if (mode === 'F' && p.going === 2 && t > 22) { p.going = 3; p.pathTo(1900, 5900, 'run'); }   // ten seconds or so after it reached its guess: back east, running, unseen
    if (p.light && p.y < 5440) p.light = false;
    R.take(t); return true;
  });
  const r = R.done(); r.tally = e.tally; r.predict = e.dbg.predict ? { x: Math.round(e.dbg.predict.x), y: Math.round(e.dbg.predict.y), turns: e.dbg.predict.turns.length } : null;
  return r;
}
if (want('L')) out.runs.L = SEEDS.map(s => lost(s, 'L'));
if (want('F')) out.runs.F = SEEDS.map(s => lost(s, 'F'));
/* R: the straight race at .95, then 30 s more */
function race(seed) {
  const w = World(seed + 980), y = LONG.y;
  bystander(w, 1300, 3300);
  const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
  const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .95 }); e.tier = 'near'; e.ang = 0;
  p.go(8700, y, 'run');
  const R = recorder(w, e, p);
  let lostAt = -1;
  w.run(44, (ww, t) => { R.take(t); if (lostAt < 0 && e.tally.chaseLost) lostAt = t; if (p.tx === null && !p.stopped) { p.stopped = 1; p.stop('crouch'); } return true; });
  const r = R.done(); r.lostAt = +lostAt.toFixed(1); r.after = r.changes.filter(c => lostAt >= 0 && c[0] >= lostAt).map(c => c[1]); r.tally = e.tally;
  return r;
}
if (want('R')) out.runs.R = SEEDS.map(race);
/* the summary */
const S = {};
for (const K of ['W', 'U']) if (out.runs[K]) {
  S[K] = {};
  for (const h of HUNGERS) {
    const rs = out.runs[K][h], n = rs.length, frac = k => +(rs.reduce((a, r) => a + (r.time[k] || 0), 0) / (45 * n)).toFixed(2);
    S[K][h] = { leftWithin45: rs.filter(r => r.leaveAt >= 0).length + '/' + n, firstLeave: rs.map(r => r.leaveAt), retreated: rs.filter(r => r.retreatAt >= 0).length + '/' + n,
      share: { watch: frac('watch'), retreat: frac('retreat'), lure: frac('lure'), approach: frac('approach'), chase: frac('chase'), leave: frac('leave'), roam: frac('roam'), search: frac('search'), intercept: frac('intercept') },
      closest: rs.map(r => r.closest), kills: rs.reduce((a, r) => a + r.kills, 0), first: [...new Set(rs.map(r => r.changes[0] ? r.changes[0][1] : '-'))] };
  }
}
if (out.runs.C) S.C = { kills: out.runs.C.map(r => r.kills), leaves: out.runs.C.map(r => r.changes.filter(c => c[1] === 'leave').length), closest: out.runs.C.map(r => r.closest), approachShare: out.runs.C.map(r => +((r.time.approach || 0) / 120).toFixed(2)) };
for (const K of ['L', 'F']) if (out.runs[K]) S[K] = { plans: out.runs[K].map(r => r.changes.map(c => c[1]).join('>')), soundsAfterLost: out.runs[K].map(r => `${r.soundsAfterLost.anon}a/${r.soundsAfterLost.named}n`), changesOnSound: out.runs[K].map(r => r.changesOnSound), endWhy: out.runs[K].map(r => (r.changes[r.changes.length - 1] || [])[2]), kills: out.runs[K].reduce((a, r) => a + r.kills, 0) };
if (out.runs.R) S.R = { lostAt: out.runs.R.map(r => r.lostAt), after: out.runs.R.map(r => r.after.join('>')), closest: out.runs.R.map(r => r.closest), kills: out.runs.R.reduce((a, r) => a + r.kills, 0) };
out.summary = S;
for (const K of ['W', 'U']) if (S[K]) for (const h of HUNGERS) { const q = S[K][h]; console.log(`${K} h=${h}: left within 45 s ${q.leftWithin45} (at ${q.firstLeave.join('/')} s), retreated ${q.retreated}, share ${Object.entries(q.share).filter(([, v]) => v).map(([k, v]) => k + ' ' + v).join(', ')}; closest ${q.closest.join('/')} px; kills ${q.kills}`); }
if (S.C) console.log(`C (watched 120 s at .95): kills ${S.C.kills.join('/')}; departures ${S.C.leaves.join('/')}; closest ${S.C.closest.join('/')} px; share of time approaching ${S.C.approachShare.join('/')}`);
for (const K of ['L', 'F']) if (S[K]) { console.log(`${K}: kills ${S[K].kills}`); S[K].plans.forEach((pl, i) => console.log(`  seed ${SEEDS[i]}: ${pl}  | sounds after the last sighting ${S[K].soundsAfterLost[i]}, plan changes on a sound ${S[K].changesOnSound[i]} | ends: ${S[K].endWhy[i]}`)); }
if (S.R) { console.log(`R: kills ${S.R.kills}`); S.R.after.forEach((a, i) => console.log(`  seed ${SEEDS[i]}: lost the race at ${S.R.lostAt[i]} s; then ${a || '-'}; closest ${S.R.closest[i]} px`)); }
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(out, null, 1) + '\n');
