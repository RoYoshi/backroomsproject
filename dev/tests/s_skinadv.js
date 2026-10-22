/* SKIN-STEALER R16 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved): the pack's adversarial QA (07, X01-X09) on the real server
 * simulation (sim.js + ai.js as built, players moved by the game's own move.js through the harness).  No scenario sets a decision of the
 * creature: they place people, give it a hunger, move and turn people as players would - abruptly, against what it expects - and read what
 * it did.  What a PERSON can see is the test-only oracle dev/trial-3-r9-overhaul/tools/qa_sight.js; where a check reads where a person
 * really is, that is the test's own knowledge (its script) - the creature never reads it.  X10 (low frame rate, latency and a reconnect
 * during the Rend) needs real pages: tools/r9_browser.js --scene rend --stress 1 (evidence/r16/). */
'use strict';
const { World, DT, LONG, AI, over, bystander } = require('./lib.js');
const { sees } = require('../trial-3-r9-overhaul/tools/qa_sight.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const SK = AI.SK, angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const SKS = w => w.eng.entities.filter(e => e.kind === 'skinstealer');

/* the mode a plan runs in (s_skinr9.js's modeOf): from R13 the plan says so (P.mode); on R8 (no such field, for running this suite there)
 * by its kind - a flank on its way, an approach from a flank or believing itself unwatched, an interception on its way are covert */
function modeOf(e) {
  const P = e.plan; if (!P) return '';
  if (P.mode) return P.mode;
  if (P.k === 'flank' && !P.arrived) return 'covert';
  if (P.k === 'approach' && (P.side || /is not watching/.test(P.why || ''))) return 'covert';
  if (P.k === 'intercept' && !P.arrived) return 'covert';
  if (P.k === 'retreat' && P.bait && !P.arrived) return 'feint';
  if (P.k === 'chase' || P.k === 'approach') return 'open';
  return '';
}
/* ten times a second: how far a covert plan moved in the person's sight (a withdrawal straight out of it excepted) - s_skinr9.js's measure */
function exposureWatch(w, p, e) {
  const R = { covert: 0, exposed: 0, exitSeen: 0, badExit: 0, worst: 0, plans: [], compromised: 0 }; let lx = e.x, ly = e.y, ld = Math.hypot(e.x - p.x, e.y - p.y), lastP = null, run = 0, b0 = null;
  R.tick = t => {
    if (Math.round(t * 60) % 6) return;
    const P = e.plan, m = modeOf(e), V = sees(w, p, e.x, e.y), step = Math.hypot(e.x - lx, e.y - ly), d = Math.hypot(e.x - p.x, e.y - p.y);
    if (P !== lastP) { if (P) R.plans.push(P.k + (m ? ':' + m : '')); lastP = P; run = 0; b0 = null; }
    if (/COMPROMISED/i.test(e.dbg.why || '')) R.compromised++;
    if (m === 'covert') {
      R.covert += step;
      if (V.vis) {
        const bear = Math.atan2(e.y - p.y, e.x - p.x); if (b0 === null) b0 = bear;
        if (P.phase === 'exit' && R.exitAt === undefined) R.exitAt = t; if (P.phase !== 'exit') R.exitAt = undefined;
        const brake = P.phase === 'exit' && t - R.exitAt < .3;                        // (it was moving when it was seen: a tenth or three to brake)
        const away = (d >= ld - 1 || brake) && Math.abs(angDiff(bear, b0)) < .45;
        if (P.phase === 'exit' && away) R.exitSeen += step; else { R.exposed += step; run += step; R.worst = Math.max(R.worst, run); }
        if (P.phase === 'exit' && !away) R.badExit++;
      } else run = 0;
    }
    lx = e.x; ly = e.y; ld = d;
  };
  return R;
}
/* the creature's own evidence and decisions this tick (never the person's script): its place, whether it sees them, the sounds it holds,
 * its plan, its ways and its guess - two worlds the same to its senses must give the same lines until it senses a difference.  The last
 * field is the shared engine's level of detail (ai.entity.js tierOf: an entity more than 1900 px from every player thinks every .35 s
 * instead of every .1 s) - decided by distances, it changes WHEN it thinks, never what it knows; a comparison ends there and says so */
const seenAs = (e, p) => { const r = e.seenNow.has(p.id) && e.mem.p.get(p.id); return r ? '1@' + Math.round(r.lkx) + ',' + Math.round(r.lky) : '0'; };   // (what it sees of them: where)
const line = (e, p) => [Math.round(e.x * 10), Math.round(e.y * 10), seenAs(e, p), e.mem.sounds.map(q => q.id + ':' + Math.round(q.x) + ':' + Math.round(q.y)).join(';'),
  e.plan ? e.plan.k + (e.plan.mode || '') : '-', e.hunt && e.hunt.hyp ? e.hunt.hyp.key + '#' + e.hunt.hyp.bet : '-', e.dbg.guess ? JSON.stringify(e.dbg.guess) : '-', e.tier].join('|');
function sameUntilSensed(A, B) {
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const a = A[i].split('|'), b = B[i].split('|');
    if (a[2] !== b[2]) return { sensed: i, diff: -1, by: 'sight' };              // (it sees them in one world, or sees them elsewhere)
    if (a[3] !== b[3]) return { sensed: i, diff: -1, by: 'sound' };
    if (a[7] !== b[7]) return { sensed: i, diff: -1, by: 'level of detail' };
    if (A[i] !== B[i]) return { sensed: -1, diff: i, by: '' };
  }
  return { sensed: n, diff: -1, by: 'the end' };
}
const until = c => c.diff >= 0 ? `DIFFERED UNSENSED at ${(c.diff * DT).toFixed(2)} s` : `the same until ${(c.sensed * DT).toFixed(1)} s (${c.by})`;
/* the glimpse at wall C (s_skinroute.js's scene): a lit person walks north through the gap at (1300, 5420) and is seen by a creature 800 px
 * east; past y 5440 the light goes off; then the script (way) takes over */
function gap(seed, h, script, T, on) {
  const w = World(seed + 16000); bystander(w, 8400, 900);
  const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  const tr = [];
  w.run(T, (ww, t) => {
    if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.t2 = t; }
    if (p.light && p.y < 5440) p.light = false;
    if (p.going >= 2) script(t, p, e, w);
    if (on) on(t, p, e, w, tr);
    tr.push(line(e, p)); return true;
  });
  return { w, p, e, tr };
}

add('X01 the still watcher in a lit hall: a person standing still, torch on, gazing down the long hall (not following it), the creature 450 or 620 px down the hall, hunger .55 / .8 / .95 - it never moves in their sight while on a covert way; a hungry one does not stand in their light for long doing nothing', () => {
  const rs = [];
  for (const h of [.55, .8, .95]) for (const d of [450, 620]) rs.push(...over([1, 2], seed => {
    const w = World(seed * 31 + Math.round(h * 100) + d); bystander(w, 1300, 3300);
    const p = w.player(5000, LONG.y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5000 + d, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    const X = exposureWatch(w, p, e); let idleSeen = 0, idleRun = 0, lx = e.x, ly = e.y, gone = 0, kills = 0;
    w.run(25, (ww, t) => { X.tick(t);
      if (Math.round(t * 60) % 6 === 0) { const V = sees(w, p, e.x, e.y), mv = Math.hypot(e.x - lx, e.y - ly); lx = e.x; ly = e.y;
        if (V.vis && mv < .5 && !e.pounce && !e.cap) { idleRun += .1; idleSeen = Math.max(idleSeen, idleRun); } else idleRun = 0; if (!V.vis) gone += .1; }
      if (w.kills.length) kills = w.kills.length; return true; });
    return { h, d, seed, exposed: Math.round(X.exposed), badExit: X.badExit, idleSeen: +idleSeen.toFixed(1), gone: +gone.toFixed(1), kills, plans: [...new Set(X.plans)].join(' '), hunts: e.tally.hunt, saw: e.mem.p.has(p.id) ? 1 : 0 };
  }));
  const hungry = rs.filter(r => r.h >= .8);
  return { ok: rs.every(r => !r.err && r.exposed < 48 && !r.badExit) && hungry.every(r => r.idleSeen < 3 && r.plans),
    note: `${rs.length} runs: moved in their sight on a covert way ${rs.map(r => r.exposed).join('/')} px (a withdrawal that came closer or crossed their front: ${rs.reduce((a, r) => a + r.badExit, 0)}); longest stand-still in their sight ${rs.map(r => r.idleSeen).join('/')} s; plans (hungry): ${hungry.map(r => r.plans || 'none').join(' | ')}; kills ${rs.map(r => r.kills).join('/')}`,
    data: rs.map(r => ({ h: r.h, d: r.d, seed: r.seed, exposed: r.exposed, idle: r.idleSeen, plans: r.plans, err: r.err })) };
});

/* the forks north of wall C at y 4870: west to (480, 4870), east to (2080, 4870) */
const FORK = { west: [{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], east: [{ x: 1250, y: 4870 }, { x: 2080, y: 4870 }] };
add('X02 one glimpse, then the silent opposite fork: seen once at the gap, the person goes dark and crouches up to the fork and away - west in one world, east in the other; until it senses a difference its every decision is the same in both (it cannot know which), so its first guess is wrong in one of them', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const h = seed % 2 ? .7 : .9, go = way => (t, p) => { if (p.going === 2) { p.going = 3; p.route(FORK[way].slice(), 'crouch'); } };
    const A = gap(seed, h, go('west'), 14), B = gap(seed, h, go('east'), 14), c = sameUntilSensed(A.tr, B.tr);
    const firstGuess = R => { const L = R.tr.find(x => /intercept|search/.test(x.split('|')[4])); return L ? L.split('|')[4] : '-'; };
    return { seed, h, sensed: c.sensed, diff: c.diff, u: until(c), saw: A.e.tally.hunt > 0 || B.e.tally.hunt > 0, g: firstGuess(A), killsA: A.w.kills.length, killsB: B.w.kills.length };
  });
  return { ok: rs.every(r => !r.err && r.diff === -1) && rs.filter(r => r.saw).length >= 3,
    note: rs.map(r => r.err ? 'ERR ' + r.err : `seed ${r.seed}: ${r.u}, first guess ${r.g}, kills ${r.killsA}/${r.killsB}`).join(' | ') };
});
add('X03 the person abruptly doubles back: seen at the gap, they creep east toward the fork, then turn and run back the way they came - until it senses that, it does exactly what it does when they keep creeping on; once it hears or sees them its belief follows the evidence within seconds (no stale guess held against new evidence)', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const h = seed % 2 ? .75 : .9;
    const keep = (t, p) => { if (p.going === 2) { p.going = 3; p.route([{ x: 1720, y: 4900 }], 'crouch'); } };
    const back = (t, p) => { if (p.going === 2) { p.going = 3; p.route([{ x: 1720, y: 4900 }], 'crouch'); p.tb = t + 2.5; } if (p.going === 3 && t >= p.tb) { p.going = 4; p.route([{ x: 1300, y: 5150 }, { x: 1300, y: 5420 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }], 'run'); } };
    const pos = [];
    const A = gap(seed, h, keep, 14), B = gap(seed, h, back, 14, (t, p, e) => pos.push({ px: p.x, py: p.y, H: e.hunt ? { x: e.hunt.x, y: e.hunt.y } : null, seen: e.seenNow.has(p.id) }));
    const c = sameUntilSensed(A.tr, B.tr);
    let reacted = -1; if (c.sensed >= 0 && c.sensed < pos.length) for (let i = c.sensed; i < Math.min(pos.length, c.sensed + Math.round(4 / DT)); i++) { const q = pos[i]; if (q.seen || (q.H && Math.hypot(q.H.x - q.px, q.H.y - q.py) < 350)) { reacted = +((i - c.sensed) * DT).toFixed(2); break; } }
    return { seed, sensed: c.sensed, diff: c.diff, u: until(c), reacted, hunted: B.e.tally.hunt > 0 };
  });
  const tried = rs.filter(r => r.hunted && r.sensed < Math.round(14 / DT) - 10);
  return { ok: rs.every(r => !r.err && r.diff === -1) && tried.length >= 3 && tried.every(r => r.reacted >= 0 && r.reacted <= 3),
    note: rs.map(r => r.err ? 'ERR ' + r.err : `seed ${r.seed}: ${r.u}; ${r.hunted ? 'its belief within 350 px of them (or sight) ' + (r.reacted >= 0 ? r.reacted + ' s after it sensed the turn' : 'NOT within 4 s') : 'no hunt'}`).join(' | ') };
});
add('X04 the course changed while it is behind a wall: seen at the gap, the person creeps up to the fork and west, and once (a second on) it has had no line of sight to them for .3 s, either keeps on west or turns back east; its decisions are the same in both worlds until it senses which', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const h = seed % 2 ? .6 : .75; let losAtTurn = null;
    const mk = turn => (t, p, e, w) => { if (p.going === 2) { p.going = 3; p.route(FORK.west.slice(), 'crouch'); p.tt = t + 1; }
      if (p.going === 3) p.nolos = w.eng.geo.los(e.x, e.y, p.x, p.y) ? 0 : (p.nolos || 0) + DT;
      if (p.going === 3 && t >= p.tt && p.nolos >= .3) { p.going = 4; if (turn) losAtTurn = false; if (turn) p.route([{ x: 2080, y: 4870 }], 'crouch'); } };   // (out of its line of sight for .3 s: keeps on west, or turns back east)
    const A = gap(seed, h, mk(false), 20), B = gap(seed, h, mk(true), 20), c = sameUntilSensed(A.tr, B.tr);
    return { seed, sensed: c.sensed, diff: c.diff, u: until(c), los: losAtTurn };
  });
  return { ok: rs.every(r => !r.err && r.diff === -1) && rs.filter(r => r.los === false).length >= 3,
    note: rs.map(r => r.err ? 'ERR ' + r.err : `seed ${r.seed}: ${r.los === null ? 'no turn' : r.los ? 'it had a line of sight at the turn' : 'behind a wall at the turn'}; ${r.u}`).join(' | ') };
});
add('X05 two people in different corridors: it hunts A in the long hall; B, never seen, walks and runs in another corridor within earshot - B is never named before it sees B, its hunt never passes to B on footsteps alone, and it does not thrash between them', () => {
  const rs = over([1, 2, 3, 4], seed => {
    const w = World(seed + 16500); bystander(w, 1300, 3300);
    const A = w.player(5000, LONG.y, { light: true, angle: 0 }); A.stop('stand'); A.look = 0;
    const runs = w.runs(500).filter(q => q.y0 === q.y1 && Math.abs(q.y0 - LONG.y) > 250 && Math.abs(q.y0 - LONG.y) < 900 && q.x0 < 5600 && q.x1 > 4600);
    const lane = runs[0]; if (!lane) return { err: 'no second corridor found' };
    const yB = lane.y0, xa = Math.max(lane.x0 + 40, 4500), xb = Math.min(lane.x1 - 40, 5900);
    const B = w.player(xa, yB, { light: false, angle: 0 }); B.lane = [{ x: xb, y: yB }, { x: xa, y: yB }];
    const e = w.eng.spawn('skinstealer', 5450, LONG.y, { hunger: .8 }); e.tier = 'near'; e.ang = Math.PI;
    let namedB = 0, toB = 0, sawB = false, last = 0, switches = 0, i = 0;
    w.run(24, (ww, t) => {
      if (!B.path || !B.path.length) { B.route(B.lane.slice(), (i++ % 2) ? 'run' : 'walk'); B.lane.reverse(); }
      if (e.seenNow.has(B.id)) sawB = true;
      if (!sawB && (e.mem.p.has(B.id) || (e.hunt && e.hunt.pid === B.id) || (e.plan && e.plan.pid === B.id))) namedB++;
      const pid = e.hunt ? e.hunt.pid : 0; if (pid && pid !== last) { if (last) switches++; last = pid; if (pid === B.id && !sawB) toB++; }
      return true; });
    return { seed, laneDy: Math.round(yB - LONG.y), namedB, toB, sawB, switches, heard: e.mind.ev.filter(v => v.k === 'sound').length, kills: w.kills.map(k => k.pid === A.id ? 'A' : 'B').join('') };
  });
  return { ok: rs.every(r => !r.err && r.namedB === 0 && r.toB === 0 && r.switches <= 2) && rs.some(r => r.heard > 0),
    note: rs.map(r => r.err ? 'ERR ' + r.err : `seed ${r.seed} (B's corridor ${r.laneDy} px off the hall): B named unseen ${r.namedB}, hunt passed to unseen B ${r.toB}, hunt switches ${r.switches}, sounds heard ${r.heard}, kills ${r.kills || 'none'}`).join(' | ') };
});
add('X06 the target crouches silently and turns the light off: seen at the gap, the person crouches a few steps into the dark and stays still - here, or 250 px further on; it acts the same in both until it senses them, never walks up to the hidden person without having sensed them, and gives the hunt up (or finds them by sensing) within its forgetting time', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const h = seed % 2 ? .7 : .9;
    const mk = far => (t, p) => { if (p.going === 2) { p.going = 3; p.route(far ? [{ x: 1250, y: 4950 }, { x: 1000, y: 4900 }] : [{ x: 1250, y: 4950 }], 'crouch'); } if (p.going === 3 && p.path && !p.path.length) { p.going = 4; p.stop('crouch'); } };
    let sensedAt = -1, closeUnsensed = 0, endAt = -1;
    const watch = (t, p, e) => { if (t > 3 && sensedAt < 0 && (e.seenNow.has(p.id) || e.mind.ev.some(v => v.k === 'sound' && v.t > 60 + t - .1))) sensedAt = t;
      if (p.going === 4 && sensedAt < 0 && Math.hypot(e.x - p.x, e.y - p.y) < 60) closeUnsensed++; if (endAt < 0 && e.dbg.huntEnd && e.dbg.huntEnd.pid === p.id && !e.hunt) endAt = t; };
    const A = gap(seed, h, mk(false), 50, watch); const sA = sensedAt, cA = closeUnsensed, eA = endAt; sensedAt = -1; closeUnsensed = 0; endAt = -1;
    const B = gap(seed, h, mk(true), 50, watch), c = sameUntilSensed(A.tr, B.tr);
    return { seed, diff: c.diff, u: until(c), hunted: A.e.tally.hunt > 0, ends: [eA, endAt].map(v => +v.toFixed(1)), sensed: [sA, sensedAt].map(v => +v.toFixed(1)), close: cA + closeUnsensed, kills: A.w.kills.length + '/' + B.w.kills.length };
  });
  const tried = rs.filter(r => r.hunted);
  return { ok: rs.every(r => !r.err && r.diff === -1 && r.close === 0) && tried.length >= 3 && tried.every(r => r.ends.every((v, i) => v > 0 || r.sensed[i] > 0)),
    note: rs.map(r => r.err ? 'ERR ' + r.err : `seed ${r.seed}: ${r.u}; hunt ended at ${r.ends.join('/')} s, sensed them again at ${r.sensed.join('/')} s; within 60 px of them unsensed ${r.close}; kills ${r.kills}`).join(' | ') };
});
add('X07 the person turns to catch it crossing cover: they look away down the hall and every four seconds turn to face it for a second and a half - whenever it is on a covert way it never moves in their sight but to withdraw straight out of it (it is caught, and answers that)', () => {
  const rs = [];
  for (const h of [.75, .9]) rs.push(...over([1, 2, 3, 4], seed => {
    const w = World(seed + 16700 + Math.round(h * 100)); bystander(w, 1300, 3300);
    const p = w.player(5000, LONG.y, { light: true, angle: Math.PI }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5450, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = () => (w.t % 4) > 2.5 ? Math.atan2(e.y - p.y, e.x - p.x) : Math.PI;   // (a person turning round to look where it was - the test's own knowledge)
    const X = exposureWatch(w, p, e); w.run(24, (ww, t) => { X.tick(t); return true; });
    return { h, seed, exposed: Math.round(X.exposed), badExit: X.badExit, covert: Math.round(X.covert), plans: [...new Set(X.plans)].join(' '), kills: w.kills.length };
  }));
  return { ok: rs.every(r => !r.err && r.exposed < 48 && !r.badExit) && rs.some(r => r.covert > 0),
    note: `${rs.length} runs: covert movement ${rs.map(r => r.covert).join('/')} px, of it in their sight ${rs.map(r => r.exposed).join('/')} px; withdrawals that came closer or crossed their front ${rs.reduce((a, r) => a + r.badExit, 0)}; plans: ${[...new Set(rs.flatMap(r => r.plans.split(' ')))].join(' ')}` };
});
add('X08 no interception it cannot make: over the gap\'s ways, walked and run (16 runs), every interception it begins is to a spot on its own floor that its own route reaches (its caps: no crawling, no tight gaps), with the time to spare it reckoned (slack >= 0) - never into a place it cannot enter', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], seed => {
    const ways = [FORK.west, FORK.east, [{ x: 1720, y: 4900 }], [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }]], way = ways[seed % 4], mode = seed % 2 ? 'run' : 'walk';
    const out = []; let lastP = null;
    gap(seed + 40, .85, (t, p) => { if (p.going === 2) { p.going = 3; p.route(way.slice(), mode); } }, 20, (t, p, e, w) => {
      const P = e.plan; if (P && P !== lastP && P.k === 'intercept') { const g = P.g, geo = w.eng.geo;
        out.push({ slack: g.slack, floor: geo.clear(g.x, g.y, e.rc, 'walk'), reach: !!geo.path(e.x, e.y, g.qx, g.qy, e.caps, { maxNodes: 6000 }), spot: !!geo.path(e.x, e.y, g.x, g.y, e.caps, { maxNodes: 6000 }) }); }
      lastP = P; });
    return { seed, out };
  });
  const all = rs.flatMap(r => r.out || []), bad = all.filter(g => !(g.slack >= 0) || !g.floor || !g.reach || !g.spot);
  return { ok: rs.every(r => !r.err) && all.length >= 4 && !bad.length, note: `${all.length} interceptions begun: slack ${all.map(g => g.slack).join('/')} s; on its floor ${all.filter(g => g.floor).length}, the point reachable by its own route ${all.filter(g => g.reach).length}, its spot reachable ${all.filter(g => g.spot).length}${bad.length ? ' | BAD ' + JSON.stringify(bad.slice(0, 3)) : ''}` };
});
add('X09 four of them, hungers .3 / .6 / .8 / .95, and three people whose input changes every second and a half (walk, run, crouch, stand; this way and that; torch on and off; looking about): nothing breaks - no NaN, never in a wall, never over its speed, every kill after its wind-up and a strike, plans not thrashing, memory bounded, the cap of four kept', () => {
  const rs = over([1, 2, 3], seed => {
    const w = World(seed + 16900); w.sim.admin.captureMode && 0;
    const ys = LONG.y, P = [4200, 5600, 7000].map((x, i) => { const p = w.player(x, ys, { light: true, angle: i * 2 }); p.stop('stand'); return p; });
    const E = [[3600, .3], [5000, .6], [6300, .8], [8000, .95]].map(([x, h]) => { const e = w.eng.spawn('skinstealer', x, ys, { hunger: h }); e.tier = 'near'; return e; });
    const geo = w.eng.geo, bad = [], strikeAt = new Map(), planN = new Map(); let maxSnd = 0, maxEv = 0, steps = 0, ms = 0, worst = 0, lastK = 0, n = 0;
    const modes = ['walk', 'run', 'crouch', 'stand', 'run', 'walk'];
    const t0 = process.hrtime.bigint();
    w.run(40, (ww, t) => {
      if (Math.round(t * 60) % 90 === 0) for (const [i, p] of P.entries()) { if (!p.alive) continue; const k = (Math.floor(t / 1.5) + i * 2 + seed) % modes.length, m = modes[k];
        if (m === 'stand') p.stop(k % 2 ? 'crouch' : 'stand'); else p.go(p.x + ((k + i) % 2 ? 900 : -900), ys, m); if (k % 3 === 0) p.light = !p.light; p.look = (k * 1.3 + i) % (Math.PI * 2); }
      for (const e of SKS(w)) {
        if (![e.x, e.y, e.speed, e.ang].every(Number.isFinite)) bad.push('NaN e' + e.id);
        if (!e.trav && !geo.clear(e.x, e.y, e.rc * .7, 'walk')) bad.push('wall e' + e.id + ' @' + Math.round(e.x) + ',' + Math.round(e.y));
        const cap = e.pounce ? (e.pounce.speed || SK.pounceSpeed) : e.trav ? 1e9 : AI.SKIN.vTop; if (e.speed > cap * 1.02 + 1) bad.push('speed e' + e.id + ' ' + Math.round(e.speed));
        if (e.pounce && !strikeAt.has(e.pounce)) strikeAt.set(e.pounce, { t: w.t, L: e.pounce, eid: e.id });   // (the strike's own clock: L.t, its wind-up L.wind)
        const pk = e.plan ? e.plan : null; if (pk !== (planN.get(e.id) || {}).p) planN.set(e.id, { p: pk, n: ((planN.get(e.id) || {}).n || 0) + 1 });
        maxSnd = Math.max(maxSnd, e.mem.sounds.length); maxEv = Math.max(maxEv, e.mind.ev.length);
      }
      for (const k of w.kills.slice(lastK)) { const S0 = [...strikeAt.values()].filter(s => s.eid === k.eid && s.t <= k.at + 1e-6).pop(); if (!S0 || !(S0.L.t >= S0.L.wind - 1e-9)) bad.push('kill without its wind-up e' + k.eid); }
      lastK = w.kills.length;
      if (SKS(w).length > 4) bad.push('more than four');
      n++; return true; });
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    const churn = Math.max(...[...planN.values()].map(q => q.n)) / 40;
    return { seed, bad: [...new Set(bad)].slice(0, 6), kills: w.kills.length, churn: +churn.toFixed(2), maxSnd, maxEv, msPerTick: +(secs * 1000 / n).toFixed(3) };
  });
  return { ok: rs.every(r => !r.err && !r.bad.length && r.churn < 2 && r.maxSnd <= 8 && r.maxEv <= 200),
    note: rs.map(r => r.err ? 'ERR ' + r.err : `seed ${r.seed}: ${r.bad.length ? 'BROKE ' + r.bad.join(', ') : 'nothing broke'}; kills ${r.kills}; most plans begun by one of them ${r.churn}/s; sounds held at most ${r.maxSnd}, mind events ${r.maxEv}; ${r.msPerTick} ms a tick (the whole world, this machine)`).join(' | ') };
});

module.exports = S;
