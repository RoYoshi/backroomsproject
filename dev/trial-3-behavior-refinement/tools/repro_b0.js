#!/usr/bin/env node
/* dev/trial-3-behavior-refinement/tools/repro_b0.js - B0: the owner's report reproduced on the real simulation (development only).
 *
 *   node dev/trial-3-behavior-refinement/tools/repro_b0.js [--seeds 1,2,3,4,5,6] [--out FILE.json]
 *
 * Runs the server simulation (dev/harness.js: sim.js + ai.js as built, players moved by the game's own move.js) and records, ten times a
 * second, what the Skin-Stealer perceives (e.seenNow, its records, its last sound) next to what it does (plan, state, act, speed, facing).
 * It reads the AI's state only to report it; it changes nothing in the AI.  Every scenario names whether the person was SEEN or HEARD.
 *   A  orbit:  a satiated one (hunger .05) sees a lit person, decides to leave; the person then runs circles round it, 130 px off, for 30 s.
 *   T  tail:   the same, but the person walks right behind it (70 px), for 30 s.
 *   B  behind: a satiated one leaves; a lightless person crouch-walks 170 px behind it (outside its field of view and beyond the 110 px
 *              in which it sees all round) - compared tick for tick with the same seed without that person.  (It turns as it goes: such a
 *              follower is often seen after all - the table says which runs.)
 *   W  wall:   a satiated one roams beside wall A of the dark south-west (x 976..1072); a lightless person crouch-walks up and down on the
 *              far side of it, never in its line of sight - compared tick for tick with the same seed without that person.
 *   C  touch:  hunger 0, a person walks into arm's reach and stays there 8 s: is there any defensive response at all? */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = { seeds: '1,2,3,4,5,6' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const HERE = path.resolve(__dirname, '..', '..', '..');
const { World, DT } = require(path.join(HERE, 'dev', 'harness.js'));
const ARENA = { x: 3960, y: 3384 };                     // an open hall (every wall at least 300 px off), dim (lamp .15)
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
const planOf = e => e.plan ? e.plan.k : 'roam';

function stage(seed, o) {
  const w = World(seed);
  const e = w.eng.spawn('skinstealer', ARENA.x, ARENA.y, { hunger: o.hunger }); e.tier = 'near'; e.ang = 0;
  const p = o.person === false ? null : w.player(ARENA.x + 350, ARENA.y, { light: o.light !== false, angle: Math.PI });
  if (p) { p.stop('stand'); p.look = Math.PI; }
  const anchor = w.player(ARENA.x - 1500, ARENA.y + 900, { light: false }); anchor.stop('crouch');   // far, dark, still: keeps the near tier in every run
  return { w, e, p, anchor };
}
/* one sample: what it perceives of the person, and what it does */
function sample(w, e, p, t) {
  const r = p ? e.mem.p.get(p.id) : null, d = p ? Math.hypot(p.x - e.x, p.y - e.y) : -1, b = p ? Math.atan2(p.y - e.y, p.x - e.x) : 0;
  return { t: +t.toFixed(1), plan: planOf(e), st: e.state, act: e.act || '-', v: Math.round(e.speed), x: Math.round(e.x), y: Math.round(e.y),
    d: Math.round(d), seen: p && e.seenNow.has(p.id) ? 1 : 0, heard: r && w.eng.now - r.heardAt < .15 ? 1 : 0, anon: e.hear && w.eng.now - e.hear.t < .15 && !e.hear.pid ? 1 : 0,
    left: p && e.left.has(p.id) ? 1 : 0, face: p ? +Math.abs(angDiff(b, e.ang)).toFixed(2) : 0, goal: e.plan && e.plan.goal ? `${Math.round(e.plan.goal.x)},${Math.round(e.plan.goal.y)}` : '', why: e.dbg.why };
}
function summarise(S, killed) {
  const close = S.filter(s => s.seen && s.d < 200), inLeave = close.filter(s => s.plan === 'leave'), inRoam = close.filter(s => s.plan === 'roam');
  const ack = close.filter(s => s.v < 15 && s.face < .5).length;                    // it stopped and faced them while they were close and in its sight
  const goals = new Set(S.filter(s => s.plan === 'leave').map(s => s.goal)).size, plans = [...new Set(S.map(s => s.plan))];
  return { samples: S.length, seenClose: close.length, seenCloseInLeave: inLeave.length, seenCloseInRoamFiltered: inRoam.filter(s => s.left).length, stoppedAndFaced: ack,
    leaveGoals: goals, plans, acts: [...new Set(S.map(s => s.act))], killed, whys: [...new Set(S.map(s => s.why))].slice(0, 8) };
}
function orbit(seed, R, tail) {
  const { w, e, p } = stage(seed, { hunger: .05 });
  const S = []; let phi = 0, started = -1;
  w.run(32, (ww, t) => {
    if (started < 0 && planOf(e) === 'leave') started = t;
    if (started >= 0 && t - started > .5) {
      if (tail) { const a = e.ang + Math.PI; p.mode = 'walk'; p.path = null; p.tx = { x: e.x + Math.cos(a) * R, y: e.y + Math.sin(a) * R }; p.look = Math.atan2(e.y - p.y, e.x - p.x); }
      else {
        phi += 2.0 * DT; let tx = e.x + Math.cos(phi) * R, ty = e.y + Math.sin(phi) * R;
        for (let k = 0; k < 8 && !w.ad.clear(tx, ty, 20, 'walk'); k++) { phi += .4; tx = e.x + Math.cos(phi) * R; ty = e.y + Math.sin(phi) * R; }
        p.mode = 'run'; p.path = null; p.tx = { x: tx, y: ty }; p.look = Math.atan2(e.y - p.y, e.x - p.x);
      }
    }
    if (Math.round(t / DT) % 6 === 0) S.push(sample(w, e, p, t));
    return true;
  });
  return { seed, leaveAt: +started.toFixed(1), ...summarise(S, w.kills.length), trace: S };
}
function blind(seed, withPerson) {
  const { w, e, p } = stage(seed, { hunger: .05, light: false, person: withPerson }); e.tierT = 1e9;   // (level of detail held: see wall())
  // the person stands behind it (west, lightless) from the start; it faces east: it never sees them at 350 px... then follows it, crouched
  if (p) { p.x = ARENA.x - 300; p.y = ARENA.y; p.look = 0; }
  const S = [], tr = [];
  // a lit decoy east of it makes it leave (the same in both runs): it sees the decoy, leaves, and the person follows behind it
  const q = w.player(ARENA.x + 420, ARENA.y + 40, { light: true, angle: Math.PI }); q.stop('stand'); q.look = Math.PI;
  w.run(30, (ww, t) => {
    if (p && t > 2) { const a = e.ang + Math.PI; p.mode = 'crouch'; p.path = null; p.tx = { x: e.x + Math.cos(a) * 170, y: e.y + Math.sin(a) * 170 }; }
    tr.push(Math.round(e.x * 100), Math.round(e.y * 100), planOf(e).length, e.state.length);
    if (Math.round(t / DT) % 6 === 0) S.push(sample(w, e, p, t));
    return true;
  });
  return { S, tr, seenEver: p ? S.some(s => s.seen) : false, heardAttributed: p ? S.some(s => s.heard) : false, anonSounds: S.filter(s => s.anon).length };
}
function wall(seed, withPerson) {
  const w = World(seed);
  const e = w.eng.spawn('skinstealer', 1240, 5100, { hunger: .05 }); e.tier = 'near'; e.ang = Math.PI / 2;
  e.tierT = 1e9;            // (the engine's level of detail is held at near in both runs: it reads the true nearest-player distance - P9
                            //  behaviour for every species, DEFERRED.md - and would otherwise tell the two runs apart without any sensing)
  const p = withPerson ? w.player(900, 4960, { light: false }) : null; if (p) p.stop('crouch');
  const anchor = w.player(2600, 5900, { light: false }); anchor.stop('crouch');
  const tr = []; let seen = 0, heard = 0, anon = 0, los = 0;
  w.run(30, (ww, t) => {
    if (p && (!p.path || !p.path.length)) p.route([{ x: 900, y: p.y < 5100 ? 5250 : 4960 }], 'crouch');
    if (p) { if (e.seenNow.has(p.id)) seen++; const r = e.mem.p.get(p.id); if (r && w.eng.now - r.heardAt < DT) heard++; if (w.eng.geo.los(e.x, e.y, p.x, p.y)) los++; }
    if (e.hear && w.eng.now - e.hear.t < DT && !e.hear.pid) anon++;
    tr.push(Math.round(e.x * 100), Math.round(e.y * 100), planOf(e).length, e.state.length);
    return true;
  });
  return { tr, seen, heard, anon, los };
}
function touch(seed) {
  const { w, e, p } = stage(seed, { hunger: 0 });
  const S = []; let grabbed = false;
  w.run(14, (ww, t) => {
    if (t > 1) { p.mode = 'walk'; p.path = null; const a = Math.atan2(p.y - e.y, p.x - e.x); p.tx = { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30 }; p.look = Math.atan2(e.y - p.y, e.x - p.x); }
    if (e.pounce) grabbed = true;
    if (Math.round(t / DT) % 6 === 0) S.push(sample(w, e, p, t));
    return true;
  });
  const reach = S.filter(s => s.d <= 50);
  return { seed, samplesInReach: reach.length, seenInReach: reach.filter(s => s.seen).length, strike: grabbed, kills: w.kills.length, plans: [...new Set(S.map(s => s.plan))], hunger: +e.hunger.toFixed(4) };
}

const seeds = ARG.seeds.split(',').map(Number), out = { tool: 'dev/trial-3-behavior-refinement/tools/repro_b0.js', arena: ARENA, A: [], T: [], B: [], W: [], C: [] };
for (const s of seeds) {
  const a = orbit(s, 130, false); out.A.push(a);
  const t = orbit(s, 70, true); out.T.push(t);
  const b1 = blind(s, true), b0 = blind(s, false); let first = -1; for (let i = 0; i < b1.tr.length; i++) if (b1.tr[i] !== b0.tr[i]) { first = i >> 2; break; }
  out.B.push({ seed: s, seenEver: b1.seenEver, heardAttributed: b1.heardAttributed, anonSounds: b1.anonSounds, firstDifferentTick: first, ticks: b1.tr.length / 4 });
  const w1 = wall(s, true), w0 = wall(s, false); let wf = -1; for (let i = 0; i < w1.tr.length; i++) if (w1.tr[i] !== w0.tr[i]) { wf = i >> 2; break; }
  out.W.push({ seed: s, seenTicks: w1.seen, heardTicks: w1.heard, anonSoundTicks: w1.anon, lineOfSightTicks: w1.los, firstDifferentTick: wf, ticks: w1.tr.length / 4 });
  out.C.push(touch(s));
}
const fmt = r => `seed ${r.seed}: left at ${r.leaveAt}s; ${r.seenClose} samples SEEN within 200 px (${r.seenCloseInLeave} while leaving, ${r.seenCloseInRoamFiltered} while roaming with them on its cooldown list); stopped and faced them ${r.stoppedAndFaced}; ${r.leaveGoals} departure goal(s); plans ${r.plans.join('/')}; acts ${r.acts.join('/')}`;
console.log('A orbit (130 px, running, lit, SEEN):'); for (const r of out.A) console.log('  ' + fmt(r));
console.log('T tail (70 px behind, walking, lit, SEEN all round within 110 px):'); for (const r of out.T) console.log('  ' + fmt(r));
console.log('B blind follower (170 px behind, lightless, crouched):'); for (const r of out.B) console.log(`  seed ${r.seed}: seen ${r.seenEver}, heard by name ${r.heardAttributed}, anonymous sounds ${r.anonSounds}; ${r.firstDifferentTick < 0 ? `identical to the run without them over ${r.ticks} ticks` : 'first different at tick ' + r.firstDifferentTick}`);
console.log('W behind wall A (lightless, crouch-walking on the far side):'); for (const r of out.W) console.log(`  seed ${r.seed}: seen ${r.seenTicks} ticks, heard by name ${r.heardTicks}, anonymous sounds ${r.anonSoundTicks}, line of sight ${r.lineOfSightTicks} ticks; ${r.firstDifferentTick < 0 ? `identical to the run without them over ${r.ticks} ticks` : 'first different at tick ' + r.firstDifferentTick}`);
console.log('C touch at hunger 0 (arm\'s reach, 13 s):'); for (const r of out.C) console.log(`  seed ${r.seed}: ${r.samplesInReach} samples within 50 px (${r.seenInReach} seen); strike ${r.strike}; kills ${r.kills}; plans ${r.plans.join('/')}`);
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(out, (k, v) => k === 'trace' ? v.filter((s, i) => i % 15 === 0) : v, 1) + '\n');
