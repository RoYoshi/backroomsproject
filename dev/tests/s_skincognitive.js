/* SKIN-STEALER cognitive refinement scenarios (dev/trial-3-cognitive-predator/; Trial 3 and its refinements are not owner-approved).
 * Each runs the real server simulation (sim.js + ai.js as built; players moved by the game's own move.js through the harness) over
 * several seeds.  As in s_skinpredator.js no scenario sets a decision of the creature: they place people, give it a hunger (its spawn
 * option), move people as players would, and read what it did.  The people's scripts may read where the creature really is (a player's
 * own sight of it); the creature never reads them.  Timings are measured from the first tick at which it really has the evidence.
 * C1: C01 (a new sighting is faced at once; an unseen person changes nothing), C04 (interrupts: a hungry bait is not a blind wait; a
 * listen ends when the sound it waits for comes; a twitch of the eyes is not an interrupt).  Every scenario here fails on R8
 * (dev/trial-3-cognitive-predator/evidence/c1_before_r8.txt).
 * C2: C02 (hungry and watched: it keeps them in view and uses the moments they look away; a watcher who never does is not killed), C03 (very
 * hungry and watched: more than one rational answer over seeds; with no way round, it comes on at once without searching again), C08 (a
 * bait only where somebody following first sees it within its reach), C09 (its route searches stay bounded through failed tactics), C13 (two
 * people: the better chance, no thrash, effort kept; a person only heard is never named).
 * C3: C05 (a heading seen, then out of sight: a grounded guess at once; the same until it senses a difference), C06 (somebody seen going
 * round a pillar: a cut-off; a turn back fools it; only what it saw counts), C10 (the lost race: a fresh runner still wins, and the
 * creature chooses its next step within a second instead of 13 s on their trail).
 * C4: C12 (the hunger gradient: satiated, mild, hungry, very hungry, starving - no single switch from harmless to lethal).
 * C5: C07 (sounds stay anonymous: a second person's noise can mislead it, never names them; silence ends a hunt), C11 (every spring of
 * the new tactics fair: its whole wind-up, a clear line, its stamina paid, contact only; a step aside at the tell makes it miss), C14 (four
 * of them, eight people, every new tactic at once: its new records bounded, its route searches few), C16 (what players are sent is R8's),
 * C17 (no endless hunt: a watcher who never gives it an opening is left within its budget; the effort spent never refills), C15 (in-tree
 * part: no game file but the species' differs from R8's; with no Skin-Stealer none of its code runs), C18 (latency as a person feels it, R8
 * against this build, and a glance where faster would be worse). */
'use strict';
const { World, DT, LONG, AI, over, floorNear, bystander } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
const ang = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
// the requirement, stated here and not read from the creature's constants: hungry, no blind wait round a corner longer than this (s)
const LURE_MAX = 4.5;
// ... and after a lost race, no longer than this on their trail before its next step (s)
const TRAIL_MAX = 3.5;
const q = (a, p) => { const v = a.filter(x => x !== null && x !== undefined).sort((x, y) => x - y); return v.length ? +v[Math.min(v.length - 1, Math.floor(p * v.length))].toFixed(2) : null; };

add('C01 a person who walks into its view is faced at once (the first near thinks), hunger .55 - and where an unsensed person is (in the dark behind it, crouched, still, unlit: two different places) changes nothing it does, tick for tick', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 11000), y = LONG.y; bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: .55 }); e.tier = 'near'; e.ang = Math.PI;
    // the person starts behind it and to its side, in the big lit room above the hall (2.5 rad from its facing: outside its 2.5 rad
    // field), and walks by a real route down into the hall in front of it
    const p = w.player(5700, 3250, { light: true, angle: Math.PI }); p.stop('stand'); p.look = null;
    let seenAt = -1, orientAt = -1, choiceAt = -1, plan0 = null, off0 = 0;
    w.run(6, (ww, t) => {
      if (t > .2 && !p.leg) { p.leg = 1; p.pathTo(4700, y, 'walk'); }
      const b = Math.atan2(p.y - e.y, p.x - e.x), off = Math.abs(ang(e.ang + (e.head || 0), b));
      if (seenAt < 0 && e.seenNow.has(p.id)) { seenAt = t; off0 = off; plan0 = e.plan; }
      if (seenAt >= 0 && orientAt < 0 && (off < .5 || off < off0 - .3)) orientAt = t;
      if (seenAt >= 0 && choiceAt < 0 && (e.plan !== plan0 || e.hunt)) choiceAt = t;
      return true; });
    return { seenAt: +seenAt.toFixed(2), orient: orientAt >= 0 ? +(orientAt - seenAt).toFixed(2) : null, choice: choiceAt >= 0 ? +(choiceAt - seenAt).toFixed(2) : null, plan: planOf(e) };
  });
  // the negative: a person crouched still and unlit in the dark behind it, in two different places 800-1000 px off (near enough to keep
  // it in the engine's near tier - the level of detail is the engine's, not a sense) - the same creature either way, and neither sensed
  const same = over([1, 2, 3, 4], seed => {
    const one = where => { const w = World(seed + 11100), y = LONG.y; bystander(w, 1300, 3300);
      const e = w.eng.spawn('skinstealer', 5450, y, { hunger: .55 }); e.tier = 'near'; e.ang = Math.PI;
      const f = floorNear(w, where.x, where.y), h = w.player(f.x, f.y, { light: false, angle: 0 }); h.stop('crouch');
      const tr = []; w.run(8, () => { tr.push([Math.round(e.x * 10), Math.round(e.y * 10), Math.round(e.ang * 1000), Math.round((e.head || 0) * 1000), planOf(e)].join(',')); return true; });
      return { tr, sensed: e.mem.p.has(h.id) }; };
    const a = one({ x: 5928, y: 2712 }), b = one({ x: 6360, y: 3096 }); let k = 0; while (k < a.tr.length && a.tr[k] === b.tr[k]) k++;
    return { same: k === a.tr.length && !a.sensed && !b.sensed, ticks: a.tr.length, firstDiff: k, sensed: a.sensed || b.sensed };
  });
  // (one seed of eight roams off the other way and never has the walker in view: a scene that gives no evidence measures nothing; at
  // least six of eight must, and every one that does is held to the limits)
  const saw = rs.filter(r => r.seenAt >= 0);
  const ok = saw.length >= 6 && saw.every(r => r.orient !== null && r.orient <= .5 && r.choice !== null && r.choice <= .25) && same.every(r => r.same);
  return { ok, note: `seen at ${rs.map(r => r.seenAt).join('/')} s (${saw.length}/8 had it in view); faced it ${saw.map(r => r.orient).join('/')} s later (p50 ${q(saw.map(r => r.orient), .5)}, worst ${q(saw.map(r => r.orient), 1)}); a new plan ${saw.map(r => r.choice).join('/')} s after the sighting (${[...new Set(rs.map(r => r.plan))].join(', ')}) | an unsensed person in the dark behind it in one place or another: the same creature tick for tick, never sensed ${same.filter(r => r.same).length}/4 (${same.map(r => r.ticks).join('/')} ticks)`, data: { rs, same } };
});

add('C04 interrupts: hungry, a bait round a corner is a short wait, then it looks again (no 9 s blind wait, no departure while its hunt is alive); a listen ends when the sound it waits for comes (footsteps behind a wall), not when its time is up; a watcher\'s twitch of the eyes is not an interrupt (no flicker)', () => {
  // (a) the bait: watched in the lit hall at .65-.75 (R8's own bait scene), every lure it begins
  const lures = [];
  over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    for (const h of [.65, .75]) {
      const w = World(seed + 11200 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
      const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
      let L = null;
      w.run(35, (ww, t) => {
        const P = e.plan;
        if (P && P.k === 'lure' && (!L || L.P !== P)) { if (L && L.end < 0) L.end = t; L = { P, t0: t, end: -1, next: '', h: e.hunger, hunt: !!e.hunt }; lures.push(L); }
        else if (L && L.end < 0 && P !== L.P) { L.end = t; L.next = planOf(e); }
        return true; });
      if (L && L.end < 0) { L.end = 35; L.next = 'running'; }
    }
    return {};
  });
  const done = lures.filter(L => L.next !== 'running'), long = done.filter(L => L.end - L.t0 > LURE_MAX * 1.01 + .15), left = done.filter(L => L.next === 'leave' && L.hunt);
  // (b) the listen: footsteps behind a wall, nobody seen (PR12's scene): every listen begun on a sound, and when it ended
  const listens = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 11300); bystander(w, 8400, 900);
    const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .6 }); e.tier = 'near'; e.ang = 0;      // facing east, away from the wall
    const p = w.player(1300, 5900, { light: false, angle: 0 }); p.stop('stand');
    const out = []; let cur = null;
    w.run(12, (ww, t) => {
      if (t > .3 && !p.leg) { p.leg = 1; p.route([{ x: 1300, y: 5300 }, { x: 1300, y: 5900 }, { x: 1300, y: 5300 }], 'run'); }
      const P = e.plan;
      if (P && P.k === 'listen' && P.curious && (!cur || cur.P !== P)) { cur = { P, t0: t, end: -1, until: P.until - P.t0, follow: -1 }; out.push(cur); }
      if (cur && cur.end < 0 && cur.follow < 0 && e.mem.sounds.some(s => s.id > cur.P.curious.id)) cur.follow = t;
      if (cur && cur.end < 0 && e.plan !== cur.P) { cur.end = t; cur.next = planOf(e); }
      return true; });
    return { listens: out.map(L => ({ dur: +((L.end < 0 ? 12 : L.end) - L.t0).toFixed(2), planned: +L.until.toFixed(2), follow: L.follow < 0 ? null : +(L.follow - L.t0).toFixed(2), next: L.next })), seen: e.tally.hunt };
  });
  const all = listens.flatMap(r => r.listens), withFollow = all.filter(L => L.follow !== null && L.follow < L.planned - .25);
  const early = withFollow.filter(L => L.dur <= Math.max(.35, L.follow + .25));
  // (c) the negative: minor, noisy evidence is not an interrupt.  A watcher whose eyes twitch off it for a tenth of a second every 1.2 s
  // (shorter than its beat) at .55 and .75: no choice it records as taken on an opening, and no flicker (a plan dropped and the same kind
  // taken up again within 0.8 s)
  const twitch = over([1, 2, 3, 4, 5, 6], seed => [.55, .75].map(h => {
    const w = World(seed + 11400 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + ((w.t % 1.2) < .1 ? 1.4 : 0);
    let n0 = 0, onOpening = 0, flick = 0; const seq = [];
    w.run(25, (ww, t) => {
      const C = e.cog; if (C && C.n > n0) { for (const L of C.log.slice(-(C.n - n0))) if (L.stim === 'opening' && / -> /.test(L.what)) onOpening++; n0 = C.n; }
      const k = planOf(e); if (!seq.length || seq[seq.length - 1].k !== k) seq.push({ k, t });
      return !w.kills.length; });
    for (let i = 2; i < seq.length; i++) if (seq[i].k === seq[i - 2].k && seq[i].t - seq[i - 1].t < .8 && !['roam', 'feed', 'hunt'].includes(seq[i - 1].k)) flick++;
    return { h, onOpening, flick, plans: seq.map(s => s.k).join('>').slice(0, 120) };
  })).flat();
  const twOpen = twitch.filter(r => r.onOpening > 0), twFlick = twitch.filter(r => r.flick > 0);
  const ok = done.length >= 3 && long.length === 0 && left.length === 0 && withFollow.length >= 3 && early.length === withFollow.length && twOpen.length === 0 && twFlick.length === 0;
  return { ok, note: `(a) ${lures.length} lures at .65/.75 (${done.length} ended): longest ${q(done.map(L => L.end - L.t0), 1)} s (limit ${LURE_MAX} s), over it ${long.length}; then ${[...new Set(done.map(L => L.next))].join('/')}; left while its hunt was alive ${left.length} | (b) ${all.length} listens on a sound; ${withFollow.length} had the next footstep before their time was up - all ended within 0.25 s of it: ${early.length}/${withFollow.length} (durations ${withFollow.map(L => L.dur).join('/')} s against ${withFollow.map(L => L.planned).join('/')} s planned) | (c) a watcher's 0.1 s twitches (12 runs): a choice taken on one ${twOpen.length}, a flicker ${twFlick.length}`, data: { lures: lures.slice(0, 20), listens, twitch } };
});

/* ---- C2 ---- */
const PILLAR = { x: 4952, y: 3584, R: 175 };
/* every route it searches (its own plans and spots: geo.path called inside its tick) - s_skinpredator.js's PR24 counter */
function routeCount() {
  const tk = AI.SKIN.tick, G = new Map(); let inSk = 0;
  const C = { n: 0, undo() { AI.SKIN.tick = tk; for (const [g, p0] of G) g.path = p0; } };
  AI.SKIN.tick = function (eng, ...a) {
    const g = eng.geo; if (!G.has(g)) { const p0 = g.path; G.set(g, p0); g.path = function (...b) { if (inSk) C.n++; return p0.apply(this, b); }; }
    inSk++; try { return tk.call(this, eng, ...a); } finally { inSk--; } };
  return C;
}
/* the lit hall: a person 450 px off keeps facing it, except while look(t) says they look away (their back to it) */
function watched(seed, h, away) {
  const w = World(seed), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + (away && away(w.t) ? Math.PI : 0);
  return { w, p, e };
}

add('C02 hungry, not starving (.5 / .55 / .62), watched from 450 px in the light by somebody who looks away for 2.5 s now and then: it does not just back off or leave (no departure in 12 s; under a fifth of its time backing out of sight - other than as a bait - watching or leaving) and uses each look away - it closes in at once, and stops when their eyes come back; somebody who never looks away is not killed (it has to earn it)', () => {
  const AW = t => t > 6 && (t - 6) % 8 < 2.5;                                     // away 6-8.5, 14-16.5, 22-24.5 s
  const rs = over([1, 2, 3, 4, 5, 6], seed => [.5, .55, .62].map(h => {
    const { w, p, e } = watched(seed + 12000 + Math.round(h * 100), h, AW), g = w.eng.geo;
    let seen = -1, view = 0, all = 0, leftAt = -1, went = false; const wins = []; let W = null;
    w.run(30, (ww, t) => {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (seen < 0 && e.seenNow.has(p.id)) seen = t;
      if (seen >= 0 && !w.kills.length) { all++; const k = planOf(e); if (k === 'leave' || k === 'watch' || (k === 'retreat' && !e.plan.bait)) view++; }   // (a bait - backing round a corner that gives an ambush, C08, and waiting there - is a tactic)
      if (leftAt < 0 && planOf(e) === 'leave') leftAt = t;
      if (e.plan && e.plan.pid === p.id && ['stand', 'approach', 'flank', 'chase', 'cut', 'retreat', 'lure'].includes(e.plan.k)) went = true;
      const away = AW(t);
      if (away && !W && !w.kills.length) { W = { t0: t, d0: d, dmin: d, moveAt: -1, view: g.los(p.x, p.y, e.x, e.y) }; wins.push(W); }
      if (W && away) { W.dmin = Math.min(W.dmin, d); if (W.moveAt < 0 && e.speed > 40 && !e.pounce && Math.cos(Math.atan2(p.y - e.y, p.x - e.x) - e.ang) > .5) W.moveAt = t - W.t0; W.spAtEnd = e.speed; }
      if (W && !away) { if (W.backAt === undefined) { W.backAt = t; W.adv = W.spAtEnd > 40; } if (W.stopAt === undefined && (e.speed < 40 || e.pounce || w.kills.length)) W.stopAt = t - W.backAt; if (t - W.backAt > 1) W = null; }
      return true; });
    const used = wins.filter(x => x.view && x.d0 > 200);
    return { h, went, passive: all ? +(view / all).toFixed(2) : 0, leftAt: +leftAt.toFixed(1), killed: w.kills.length,
      closed: used.map(x => Math.round(x.d0 - x.dmin)), moveAt: used.map(x => x.moveAt < 0 ? null : +x.moveAt.toFixed(2)), stop: used.filter(x => x.adv).map(x => x.stopAt === undefined ? null : +x.stopAt.toFixed(2)) };
  })).flat();
  // the negative: one who never looks away, .5 / .55, 30 s
  const pure = over([1, 2, 3, 4, 5, 6], seed => [.5, .55].map(h => { const { w } = watched(seed + 12100 + Math.round(h * 100), h, null); w.run(30); return w.kills.length; })).flat();
  // (C4: below .55 it takes its chance only sometimes - C12; this scenario is about what it does when it does: at least three in four runs
  // must be such runs, and every one of them is held to all of it)
  const gone = rs.filter(r => r.went), closed = gone.flatMap(r => r.closed), moves = gone.flatMap(r => r.moveAt), stops = gone.flatMap(r => r.stop);
  const okView = gone.length >= rs.length * .75 && gone.filter(r => r.passive <= .2).length >= gone.length * .8 && gone.every(r => r.leftAt < 0 || r.leftAt > 12);
  const okOpen = closed.length >= 12 && q(closed, .5) >= 100 && moves.filter(m => m !== null && m <= .8).length >= moves.length * .7;
  const okStop = stops.length >= 5 && stops.filter(x => x !== null && x <= .4).length >= stops.length * .7;
  const ok = okView && okOpen && okStop && pure.every(k => k === 0);
  return { ok, note: `it went for them in ${gone.length}/${rs.length} (at .5 / .55 / .62: ${[.5, .55, .62].map(h => gone.filter(r => r.h === h).length).join(' / ')}); in those, backing out of sight (not a bait), watching or leaving p50 ${q(gone.map(r => r.passive), .5)} of its time, over a fifth in ${gone.filter(r => r.passive > .2).length}/${gone.length}; a departure in the first 12 s ${gone.filter(r => r.leftAt >= 0 && r.leftAt <= 12).length} | ${closed.length} looks away while it had them in view: closed in p50 ${q(closed, .5)} px (worst ${q(closed, 0)}), moving at them within 0.8 s in ${moves.filter(m => m !== null && m <= .8).length}/${moves.length} | their eyes back while it came on: it stopped within 0.4 s in ${stops.filter(x => x !== null && x <= .4).length}/${stops.length} | killed ${rs.filter(r => r.killed).length}/${rs.length} (at .5 / .55 / .62: ${[.5, .55, .62].map(h => rs.filter(r => r.h === h && r.killed).length).join(' / ')}) | never looking away: killed ${pure.filter(Boolean).length}/${pure.length}`, data: rs };
});

add('C03 very hungry (.8 / .95), watched without a break: more than one rational answer over the seeds (round them, a stand-off pressing in, coming on, the bait), never stalled in view; and where there is no way round (the narrow north corridor) it comes on at once and does not search for a way round again', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => [.8, .95].map(h => {
    const { w, p, e } = watched(seed + 12200 + Math.round(h * 100), h, null);
    let first = '', idle = 0, idleMax = 0; const kinds = new Set();
    w.run(30, () => {
      const k = planOf(e); if (['flank', 'stand', 'approach', 'retreat', 'lure', 'chase'].includes(k)) { kinds.add(k); if (!first) first = k; }
      const still = e.speed < 15 && !e.pounce && !e.recover && e.seenNow.has(p.id) && !w.kills.length && k !== 'feed';
      idle = still ? idle + DT : 0; idleMax = Math.max(idleMax, idle);
      return !w.kills.length; });
    return { h, first, kinds: [...kinds].join('+'), idleMax: +idleMax.toFixed(2), killed: w.kills.length };
  })).flat();
  const corr = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 12300); bystander(w, 1200, 4500);
    const p = w.player(1170, 4400, { light: true, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1170, 4780, { hunger: .8 }); e.tier = 'near'; e.ang = -Math.PI / 2; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    // (from when it knows they see it - the first decision it makes as watched: before that, somebody facing it who has not made it out in
    // the dark gets R3's freeze, a stalker's answer, not a stall)
    const C = routeCount(); let seenAt = -1, moveAt = -1, n10 = 0;
    try { w.run(12, (ww, t) => { if (seenAt < 0 && e.dbg.decide && e.dbg.decide.watched) seenAt = t; if (seenAt >= 0 && moveAt < 0 && (e.pounce || (e.speed > 40 && Math.cos(Math.atan2(p.y - e.y, p.x - e.x) - e.ang) > .5))) moveAt = t - seenAt; if (t <= 10) n10 = C.n; return !w.kills.length; }); } finally { C.undo(); }
    return { moveAt: moveAt < 0 ? null : +moveAt.toFixed(2), noFlank: e.tally.noFlank, routes10: n10, flanks: e.tally.flank };
  });
  const firsts = new Set(rs.map(r => r.first)), kinds = new Set(rs.flatMap(r => r.kinds.split('+')));
  const ok = firsts.size >= 2 && kinds.size >= 3 && rs.every(r => r.idleMax <= 1.5) && corr.every(r => r.moveAt !== null && r.moveAt <= 1 && r.noFlank <= 1 && r.routes10 <= 15);
  return { ok, note: `first answers ${[...firsts].join('/')} (${rs.map(r => r.first).join(' ')}); answers used ${[...kinds].join('/')}; longest still in their view ${q(rs.map(r => r.idleMax), 1)} s; killed ${rs.filter(r => r.killed).length}/${rs.length} | corridor: moving at them (or springing) ${corr.map(r => r.moveAt).join('/')} s after it knew they saw it, ways round searched ${corr.map(r => r.noFlank).join('/')} (none found), routes in 10 s ${corr.map(r => r.routes10).join('/')}`, data: { rs, corr } };
});

add('C08 a bait only where it gives an ambush: every wait round a corner is first seen by somebody following from within its reach (200 px and a step); where no spot gives one (the south-west gap, close to them) it does not back away into a blind wait - it takes another answer at once', () => {
  const runs = [];
  const one = (seed, scene) => {
    const w = World(seed + 12400 + (scene === 'gap' ? 50 : 0)), g = w.eng.geo, y = LONG.y; bystander(w, scene === 'gap' ? 5000 : 1300, scene === 'gap' ? y : 3300);
    const P0 = scene === 'gap' ? { x: 700, y: 5330 } : { x: 5000, y }, K0 = scene === 'gap' ? { x: 1300, y: 5330 } : { x: 5450, y };
    const p = w.player(P0.x, P0.y, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', K0.x, K0.y, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    let L = null, from = null; const R = { scene, lures: [], noBait: 0, after: [] };
    w.run(40, (ww, t) => {
      const k = planOf(e);
      if (k === 'retreat' && e.plan.from) from = e.plan.from;
      if (k === 'lure' && (!L || L.P !== e.plan)) { L = { P: e.plan, at: { x: e.x, y: e.y }, first: -1 }; R.lures.push(L); if (!p.going) { p.going = 1; p.look = null; p.route([from || K0, L.at], 'walk'); } }
      if (L && L.first < 0 && k === 'lure' && e.plan === L.P && g.los(p.x, p.y, e.x, e.y)) { L.first = Math.round(Math.hypot(p.x - e.x, p.y - e.y)); L.seenFrom = { x: Math.round(p.x), y: Math.round(p.y) }; L.from = from; L.amb = e.dbg.bait; L.seed = seed; }
      return true; });
    R.noBait = e.tally.noBait || 0;
    R.after = (e.cog.log || []).map((x, i, a) => x.stim === 'nobait' ? (a[i + 1] ? a[i + 1].what : '') : null).filter(x => x !== null);
    runs.push(R); return R;
  };
  over(Array.from({ length: 16 }, (_, i) => i + 1), s => { one(s, 'hall'); one(s, 'gap'); return {}; });
  const lures = runs.flatMap(r => r.lures.filter(L => L.first >= 0).map(L => Object.assign({ scene: r.scene }, L))), far = lures.filter(L => L.first > 230);
  const ok = lures.length >= 4 && far.length === 0;
  return { ok, note: `${lures.length} waits round a corner that somebody following came to see (hall ${lures.filter(L => L.scene === 'hall').length}, gap ${lures.filter(L => L.scene === 'gap').length}): first seen from ${lures.map(L => L.first).join('/')} px, over 230 px ${far.length} | no spot that gives an ambush: ${runs.reduce((a, r) => a + r.noBait, 0)} times (hall ${runs.filter(r => r.scene === 'hall').reduce((a, r) => a + r.noBait, 0)}, gap ${runs.filter(r => r.scene === 'gap').reduce((a, r) => a + r.noBait, 0)}), the next answer: ${[...new Set(runs.flatMap(r => r.after))].slice(0, 6).join(' | ') || '-'}`, data: runs.map(r => ({ scene: r.scene, lures: r.lures.map(L => ({ first: L.first, at: L.at, seenFrom: L.seenFrom, from: L.from, amb: L.amb, seed: L.seed })), noBait: r.noBait })) };
});

add('C09 failed tactics, bounded thinking: a stand-off that runs out, a way round that is not there, a bait that has no corner, a group it will not come at - over 30 s each its route searches stay few (mean per second, the busiest second) and each kind of spot is not searched for again at the same place', () => {
  const rs = [];
  const scene = (name, mk) => over([1, 2, 3, 4], seed => {
    const C = routeCount(); const per = []; let last = 0, lastT = 0, S;
    try { S = mk(seed); S.w.run(30, (ww, t) => { if (t - lastT >= 1) { per.push(C.n - last); last = C.n; lastT = t; } return true; }); } finally { C.undo(); }
    const R = { name, mean: +(per.reduce((a, b) => a + b, 0) / Math.max(1, per.length)).toFixed(2), max: Math.max(0, ...per), noFlank: S.e.tally.noFlank, noBait: S.e.tally.noBait || 0 }; rs.push(R); return R;
  });
  scene('watched .55', s => watched(s + 12500, .55, null));
  scene('watched .8', s => watched(s + 12550, .8, null));
  scene('corridor .8', s => { const w = World(s + 12600); bystander(w, 1200, 4500); const p = w.player(1170, 4400, { light: true, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1170, 4780, { hunger: .8 }); e.tier = 'near'; e.ang = -Math.PI / 2; p.look = () => Math.atan2(e.y - p.y, e.x - p.x); return { w, e }; });
  scene('gap .7', s => { const w = World(s + 12650); bystander(w, 5000, LONG.y); const p = w.player(700, 5330, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1300, 5330, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x); return { w, e }; });
  scene('two together .7', s => { const w = World(s + 12700), y = LONG.y; bystander(w, 1300, 3300);
    const a = w.player(5000, y, { light: true, angle: 0 }), b = w.player(5000, y + 120, { light: true, angle: 0 }); a.stop('stand'); b.stop('stand');
    const e = w.eng.spawn('skinstealer', 5600, y, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI; return { w, e }; });
  const ok = rs.every(r => r.mean <= 1.5 && r.max <= 8 && r.noFlank <= 3 && r.noBait <= 3);
  return { ok, note: rs.map(r => `${r.name}: ${r.mean}/s, busiest ${r.max}, no way round ${r.noFlank}, no bait corner ${r.noBait}`).join(' | '), data: rs };
});

add('C13 two people it sees (a watcher 450 px off, and somebody 700 px from them walking off, facing away): it goes for the better chance - the unaware one apart - rather than the nearest, without switching back and forth, and the effort it spent on the first is kept; a third person it only hears (running behind a wall) is never named', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => [.55, .7, .9].map(h => {
    const w = World(seed + 12800 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const a = w.player(5000, y, { light: true, angle: 0 }); a.stop('stand');
    const b = w.player(5600, 3150, { light: true, angle: Math.PI }); b.stop('stand');
    const c = w.player(5112, 3192, { light: false, angle: 0 }); c.stop('stand');            // (north-west of it behind the side room's wall, 460 px off: heard, not seen)
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    a.look = () => Math.atan2(e.y - a.y, e.x - a.x); b.look = 0;
    let lastQ = 0, switches = 0, onB = 0, onA = 0, named = 0, keptBad = 0;
    w.run(25, (ww, t) => {
      if (t > .5 && !b.leg) { b.leg = 1; b.route([{ x: 5800, y: 3150 }, { x: 5800, y: 3700 }, { x: 5400, y: 3700 }], 'walk'); }
      if (t > .3 && !c.leg) { c.leg = 1; c.route([{ x: 5112, y: 2792 }, { x: 5112, y: 3192 }, { x: 5112, y: 2792 }, { x: 5112, y: 3192 }, { x: 5112, y: 2792 }, { x: 5112, y: 3192 }], 'run'); }
      const qid = (e.hunt && e.hunt.pid) || (e.plan && e.plan.pid) || 0;
      if (qid === b.id) onB += DT; else if (qid === a.id) onA += DT;
      if (qid && qid !== lastQ && lastQ && [a.id, b.id].includes(qid)) { switches++; const prev = e.spent.get(lastQ); if (prev !== undefined && prev <= 0) keptBad++; }
      if (qid) lastQ = qid;
      const rc = e.mem.p.get(c.id); if ((qid === c.id || (e.enc && e.enc.pid === c.id)) && !(rc && rc.seenAt > 0)) named++;
      return true; });
    return { h, onA: +onA.toFixed(1), onB: +onB.toFixed(1), switches, named, keptBad, killed: w.kills.map(k => k.pid === b.id ? 'walker' : k.pid === a.id ? 'watcher' : 'other').join('+') };
  })).flat();
  const forB = rs.filter(r => r.onB > 0), ok = forB.length >= rs.length * .6 && rs.every(r => r.switches <= 3 && r.named === 0 && r.keptBad === 0);
  return { ok, note: `went for the unaware one apart in ${forB.length}/${rs.length} (at .55 / .7 / .9: ${[.55, .7, .9].map(h => rs.filter(r => r.h === h && r.onB > 0).length).join(' / ')}); seconds on watcher / walker ${rs.map(r => r.onA + '/' + r.onB).join(' ')}; switches at most ${Math.max(...rs.map(r => r.switches))}; effort lost on a switch ${rs.reduce((x, r) => x + r.keptBad, 0)}; the one only heard named ${rs.reduce((x, r) => x + r.named, 0)}; kills ${rs.map(r => r.killed || '-').join(' ')}`, data: rs };
});

/* ---- C3 ---- */
add('C05 seen walking north, then out of sight round a corner (torch off, crouched, one way or the other): within its grace and its listening time (2.5 s) it makes a grounded guess - an interception ahead on the way it saw them go, or a look on along it - and where they really went changes nothing it does until it senses a difference', () => {
  const ways = { east: [{ x: 1720, y: 4900 }], back: [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }] };
  const one = (seed, way) => {
    const w = World(seed + 13000); bystander(w, 8400, 900);
    const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .75 }); e.tier = 'near'; e.ang = Math.PI;
    const R = { tr: [], ev: [], lostAt: -1, guess: null, guessAt: -1 };
    w.run(10, (ww, t) => {
      if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
      if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.route(ways[way], 'crouch'); }
      if (p.light && p.y < 5440) p.light = false;
      const r = e.mem.p.get(p.id), seen = e.seenNow.has(p.id), P = e.plan;
      if (R.lostAt < 0 && e.hunt && !seen && R.seenOnce) R.lostAt = t; if (seen) R.seenOnce = 1;
      if (R.lostAt >= 0 && !R.guess && P && (P.k === 'intercept' || P.k === 'search')) { R.guess = P.k === 'intercept' ? { k: 'intercept', x: P.g.qx, y: P.g.qy, lead: P.g.lead } : { k: 'search', x: P.goal.x, y: P.goal.y }; R.guessAt = t; }
      R.ev.push([seen ? 1 : 0, r ? [r.heardAt, r.seenAt, r.lkx, r.lky, r.lvx, r.lvy].map(v => Math.round(v * 10)).join(':') : '-', e.mem.sounds.map(q => q.id + ':' + Math.round(q.x) + ':' + Math.round(q.y)).join(';')].join('|'));
      R.tr.push([Math.round(e.x * 10), Math.round(e.y * 10), P ? P.k : '-'].join(','));
      return true; });
    return R;
  };
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const A = one(seed, 'east'), B = one(seed, 'back');
    let k = 0; while (k < A.ev.length && A.ev[k] === B.ev[k]) k++;                     // the first tick its senses differ
    let j = 0; while (j < A.tr.length && A.tr[j] === B.tr[j]) j++;                     // the first tick it acts differently
    const g = A.guess, dd = g ? Math.hypot(g.x - 1300, g.y - 5430) : 0, fwd = g ? -(g.y - 5430) / Math.max(1, dd) : -1;
    return { sameUntilSensed: j >= k, k, j, guessIn: A.guess ? +(A.guessAt - A.lostAt).toFixed(2) : null, g, ahead: !!g && (g.k === 'intercept' ? g.lead >= 200 : dd >= 150 && fwd >= .3) };
  });
  const guessed = rs.filter(r => r.g), ok = rs.every(r => r.sameUntilSensed) && guessed.length >= 6 && guessed.every(r => r.ahead && r.guessIn <= 2.5);
  return { ok, note: `the same until its senses differed ${rs.filter(r => r.sameUntilSensed).length}/8 | a guess ${guessed.map(r => r.guessIn).join('/')} s after it lost them (${guessed.length}/8): ${guessed.map(r => r.g.k + (r.g.lead ? ' ' + r.g.lead + ' px ahead' : '')).join(', ')}; ahead on the way it saw ${guessed.filter(r => r.ahead).length}/${guessed.length}`, data: rs };
});

add('C06 somebody running round the pillar in its view: after it has seen them go a full turn round, it cuts across to where they will come round (not chasing their tail, not leaving) and meets them; a turn back the other way at that moment can fool it - it thinks again once it sees them going the other way; laps it did not see teach it nothing', () => {
  const ring = (dir, laps) => { const out = []; for (let l = 0; l < laps; l++) for (let k = 0; k < 16; k++) { const a = dir * k / 16 * Math.PI * 2; out.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); } return out; };
  const one = (seed, h, rev) => {
    const w = World(seed + 13200 + Math.round(h * 100) + (rev ? 50 : 0)); bystander(w, 1300, 3300);
    const p = w.player(PILLAR.x + PILLAR.R, PILLAR.y, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', rev ? 5700 : 5450, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;   // (the turn-back scene: farther off, so it sees laps before it is close)
    const R = { seenArc: 0, arcAtCirc: -1, cutAt: -1, revAt: -1, rethinkIn: null, killAt: -1, closest: 1e9, killAfterRev: false, plans: new Set() };
    let lastA = null, lastT = -9, revSeen = -1;
    w.run(30, (ww, t) => {
      if (t > .3 && !p.leg) { p.leg = 1; p.route(ring(-1, 14), 'run'); }
      const seen = e.seenNow.has(p.id), A = Math.atan2(p.y - PILLAR.y, p.x - PILLAR.x);
      if (seen && lastA !== null && t - lastT <= .35) R.seenArc += Math.abs(ang(A, lastA)); if (seen) { lastA = A; lastT = t; }
      if (R.arcAtCirc < 0 && e.circ) R.arcAtCirc = +R.seenArc.toFixed(2);
      if (R.cutP && e.plan === R.cutP) R.toGoal = Math.min(R.toGoal, Math.hypot(p.x - R.cutP.goal.x, p.y - R.cutP.goal.y));
      if (R.cutAt < 0 && e.plan && e.plan.k === 'cut') { R.cutAt = t; R.cutP = e.plan; R.toGoal = 1e9; if (rev && R.revAt < 0) { R.revAt = t; const a0 = Math.atan2(p.y - PILLAR.y, p.x - PILLAR.x), back = []; for (let l = 0; l < 6; l++) for (let k = 1; k <= 16; k++) { const a = a0 + k / 16 * Math.PI * 2; back.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); } p.route(back, 'run'); } }
      if (R.revAt >= 0 && revSeen < 0 && seen && t - R.revAt > .3) revSeen = t;
      if (revSeen >= 0 && R.rethinkIn === null && !(e.plan && e.plan.k === 'cut' && e.plan.t0 < R.revAt + .01)) R.rethinkIn = +(t - revSeen).toFixed(2);
      if (e.plan) R.plans.add(e.plan.k);
      R.closest = Math.min(R.closest, Math.hypot(p.x - e.x, p.y - e.y));
      if (R.killAt < 0 && w.kills.length) { R.killAt = t; R.killAfterRev = R.revAt >= 0 && t - R.revAt < 2.5; }
      return !w.kills.length; });
    return { h, rev, cut: R.cutAt >= 0, cutAt: +R.cutAt.toFixed(1), toGoal: R.cutP ? Math.round(R.toGoal) : null, arcAtCirc: R.arcAtCirc, killed: R.killAt >= 0, killAt: +R.killAt.toFixed(1), closest: Math.round(R.closest), rethinkIn: R.rethinkIn, killAfterRev: R.killAfterRev, left: R.plans.has('leave') && R.killAt < 0 };
  };
  const vis = over([1, 2, 3, 4, 5, 6], seed => [.55, .75].map(h => one(seed, h, false))).flat();
  const rev = over([1, 2, 3, 4, 5, 6, 7, 8], seed => one(seed, .55, true));
  // laps it never saw: the same person running round the pillar while it stands far off in the dark, out of sight of the ring (it may hear
  // them) - its guess of a circle, if any, only ever comes after a full turn of arcs it saw
  const hid = over([1, 2, 3, 4], seed => { const w = World(seed + 13300); bystander(w, 1300, 3300);
    const p = w.player(PILLAR.x + PILLAR.R, PILLAR.y, { light: false }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5928, 2712, { hunger: .65 }); e.tier = 'near';
    let arc = 0, lastA = null, lastT = -9, bad = 0;
    w.run(20, (ww, t) => { if (t > .3 && !p.leg) { p.leg = 1; p.route(ring(-1, 10), 'run'); } const seen = e.seenNow.has(p.id), A = Math.atan2(p.y - PILLAR.y, p.x - PILLAR.x);
      if (seen && lastA !== null && t - lastT <= .35) arc += Math.abs(ang(A, lastA)); if (seen) { lastA = A; lastT = t; } if (e.circ && arc < Math.PI * 2 * .9) bad++; return true; });
    return { bad, arc: +arc.toFixed(1), cut: e.tally.cut || 0 };
  });
  const knew = vis.filter(r => r.arcAtCirc >= 0), cuts = knew.filter(r => r.cut), met = vis.filter(r => r.killed || r.closest <= 150), early = vis.filter(r => r.arcAtCirc >= 0 && r.arcAtCirc < Math.PI * 2 * .9);
  const revCut = rev.filter(r => r.cut), fooled = revCut.filter(r => r.toGoal > 150), quick = revCut.filter(r => r.rethinkIn !== null && r.rethinkIn <= 1);
  const ok = knew.length >= vis.length * .5 && cuts.length >= knew.length * .8 && met.length >= vis.length * .8 && vis.every(r => !r.left) && early.length === 0 && revCut.length >= 3 && fooled.length >= 1 && quick.length >= revCut.length * .75 && hid.every(r => r.bad === 0);
  return { ok, note: `in its view (.55 / .75, 12 runs): it took them for going round in ${knew.length} (the rest met before a full turn), a cut-off in ${cuts.length} of those (after ${cuts.map(r => r.cutAt).join('/')} s; first guessed after ${[...new Set(vis.filter(r => r.arcAtCirc >= 0).map(r => r.arcAtCirc))].slice(0, 6).join('/')} rad of arcs seen, under a turn ${early.length}); they came to where it cut across (150 px) ${cuts.filter(r => r.toGoal !== null && r.toGoal <= 150).length}/${cuts.length}; met them ${met.length}/12 (killed ${vis.filter(r => r.killed).length}, at ${vis.filter(r => r.killed).map(r => r.killAt).join('/')} s); left them ${vis.filter(r => r.left).length} | turning back as it cuts across (.55, 8 runs): a cut ${revCut.length}, fooled - they never came within 150 px of where it waited (closest ${revCut.map(r => r.toGoal).join('/')} px) - ${fooled.length}, caught within 2.5 s of the turn all the same ${revCut.filter(r => r.killAfterRev).length}, it thought again within 1 s of seeing them go the other way ${quick.length}/${revCut.length} (${revCut.map(r => r.rethinkIn).join('/')} s) | laps it did not see: a circle guessed early ${hid.reduce((a, r) => a + r.bad, 0)} ticks (arcs seen ${hid.map(r => r.arc).join('/')} rad; cut-offs ${hid.map(r => r.cut).join('/')})`, data: { vis, rev, hid } };
});

add('C10 the straight race (very hungry, .75 / .95): a fresh runner still wins - never caught while running, the gap never closing once it is lost - and when it loses it chooses at once - a way round that gets ahead of them, or at most 3.5 s on their trail, then listening and its guesses - not 13 s of trailing; and with no race at all (hungry), a sprinter who keeps going keeps the gap they made, winded or not', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => [.75, .95].map(h => {
    const w = World(seed + 13400 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(3600, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 3300, y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    let lostAt = -1, lossD = -1, minAfter = 1e9, nextIn = null, trail = 0, killWhileRun = false, lostPlan = null;
    w.run(30, (ww, t) => {
      if (t > .3 && !p.leg) { p.leg = 1; p.go(8700, y, 'run'); }
      const d = Math.hypot(p.x - e.x, p.y - e.y), running = p.tx !== null;
      if (lostAt < 0 && e.tally.chaseLost) { lostAt = t; lossD = d; lostPlan = e.plan; }
      if (lostAt >= 0 && running) minAfter = Math.min(minAfter, d);
      if (lostAt >= 0 && nextIn === null) nextIn = e.plan ? e.plan.k + (e.plan.shadow ? ' (their trail)' : '') : planOf(e);
      if (lostAt >= 0 && e.plan && e.plan.k === 'approach' && e.plan.shadow) trail += DT;
      if (w.kills.length && running) killWhileRun = true;
      return true; });
    return { h, lostAt: +lostAt.toFixed(1), lossD: Math.round(lossD), minAfter: Math.round(minAfter), nextIn, trail: +trail.toFixed(1), killWhileRun, after: e.tally.raceCut ? 'a way round' : 'trail', kills: w.kills.length };
  })).flat();
  // (b) no race at all: hungry (.45 / .55 / .62), somebody 380 px off sprints away down the hall and keeps going, winded after about 10 s,
  // then walking - whatever it does (a stand-off, an approach, an opening), the gap they made never shrinks while they move
  const nr = over([1, 2, 3, 4], seed => [.45, .55, .62].map(h => {
    const w = World(seed + 13500 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(3700, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 3320, y, { hunger: h }); e.tier = 'near'; e.ang = 0;
    let maxGap = 0, shrink = 0, caught = false;
    w.run(32, (ww, t) => { if (t > .4 && !p.leg) { p.leg = 1; p.go(8700, y, 'run'); } const d = Math.hypot(p.x - e.x, p.y - e.y), moving = p.tx !== null;
      if (t > 1.5 && moving) { maxGap = Math.max(maxGap, d); if (d < maxGap - 40) shrink = Math.max(shrink, maxGap - d); } if (w.kills.length && moving) caught = true; return true; });
    return { h, shrink: Math.round(shrink), caught, plans: '' };
  })).flat();
  const ok = rs.every(r => r.lostAt > 0 && !r.killWhileRun && r.minAfter >= r.lossD - 15 && r.trail <= TRAIL_MAX) && nr.every(r => !r.caught && r.shrink === 0);
  return { ok, note: `lost the race at ${rs.map(r => r.lostAt).join('/')} s; never caught while running ${rs.filter(r => !r.killWhileRun).length}/${rs.length}; the gap after it never under the gap at the loss (- 15 px) ${rs.filter(r => r.minAfter >= r.lossD - 15).length}/${rs.length}; what it did at the loss: ${[...new Set(rs.map(r => r.nextIn))].join(' | ')}; on their trail ${rs.map(r => r.trail).join('/')} s (at most ${TRAIL_MAX}) | no race, hungry, a sprinter who keeps going: the gap they made shrank by more than 40 px in ${nr.filter(r => r.shrink).length}/${nr.length} (most ${Math.max(...nr.map(r => r.shrink))} px), caught while moving ${nr.filter(r => r.caught).length}`, data: rs };
});

/* ---- C4 ---- */
add('C12 the hunger gradient over two everyday scenes (a lit person walking past it unaware; a lit person 450 px off who keeps facing it but looks away 1.5 s every 9 s), 8 seeds each: satiated (.1) and mild (.3) never hunt or strike - they look (and a mild one may watch a while) and go; hungry (.45 / .55) goes for them only sometimes and does not always kill; very hungry (.65 / .75) always goes for them; starving (.85 / .95) is quicker about it - and no single step of hunger turns it from never to always', () => {
  const HUNT = new Set(['stand', 'approach', 'flank', 'chase', 'cut', 'lure', 'retreat', 'intercept', 'search']);
  const one = (kind, seed, h) => {
    const w = World(seed + 14000 + Math.round(h * 100) + (kind === 'watch' ? 500 : 0)), y = LONG.y; bystander(w, 1300, 3300);
    let p, e;
    if (kind === 'passer') { p = w.player(4700, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0; e = w.eng.spawn('skinstealer', 5600, 3150, { hunger: h }); e.tier = 'near'; e.ang = Math.PI / 2; }
    else { p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand'); e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; const AW = t => t > 6 && (t - 6) % 9 < 1.5; p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + (AW(w.t) ? Math.PI : 0); }
    let seen = -1, looked = false, watched = false, hunted = false, strike = false, killAt = -1;
    w.run(25, (ww, t) => {
      if (kind === 'passer' && t > .5 && !p.leg) { p.leg = 1; p.go(6500, y, 'walk'); }
      if (seen < 0 && e.seenNow.has(p.id)) seen = t;
      if (seen >= 0 && Math.abs(ang(e.ang + (e.head || 0), Math.atan2(p.y - e.y, p.x - e.x))) < .5) looked = true;
      const P = e.plan; if (P && P.pid === p.id) { if (P.k === 'watch') watched = true; if (HUNT.has(P.k)) hunted = true; }
      if (e.pounce && e.pounce.tid === p.id) strike = true;
      if (killAt < 0 && w.kills.length) killAt = t; return true; });
    return { kind, h, seen: seen >= 0, looked, watched, hunted, strike, killAt: +killAt.toFixed(1) };
  };
  const HS = [.1, .3, .45, .55, .65, .75, .85, .95], rs = [];
  over([1, 2, 3, 4, 5, 6, 7, 8], seed => { for (const kind of ['passer', 'watch']) for (const h of HS) rs.push(one(kind, seed, h)); return {}; });
  const at = h => rs.filter(r => r.h === h && r.seen), rate = (h, f) => { const a = at(h); return a.length ? a.filter(f).length / a.length : 0; };
  const eng = HS.map(h => +rate(h, r => r.hunted).toFixed(2)), kill = HS.map(h => +rate(h, r => r.killAt >= 0).toFixed(2));
  const med = a => { const v = a.filter(x => x >= 0).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const tk = h => med(at(h).map(r => r.killAt)), veryT = med(at(.65).concat(at(.75)).map(r => r.killAt)), starvT = med(at(.85).concat(at(.95)).map(r => r.killAt));
  const low = [.1, .3].every(h => at(h).every(r => !r.hunted && !r.strike && r.killAt < 0)) && [.1, .3].every(h => rate(h, r => r.looked) >= .75);
  const hungry = [.45, .55].every(h => rate(h, r => r.hunted) > .2 && rate(h, r => r.killAt >= 0) < 1) && rate(.45, r => r.hunted) < .95;
  const very = [.65, .75].every(h => rate(h, r => r.hunted) === 1) && [.65, .75].every(h => rate(h, r => r.killAt >= 0) >= .7);
  const starving = starvT !== null && veryT !== null && starvT <= veryT;
  let step = false; for (let i = 1; i < HS.length; i++) if (eng[i - 1] <= .1 && eng[i] >= .9) step = true;
  const mono = eng.every((v, i) => i === 0 || v >= eng[i - 1] - .15);
  const ok = low && hungry && very && starving && !step && mono;
  return { ok, note: `went for them (both scenes) at ${HS.join(' / ')}: ${eng.join(' / ')}; killed ${kill.join(' / ')}; looked at them (satiated / mild) ${rate(.1, r => r.looked).toFixed(2)} / ${rate(.3, r => r.looked).toFixed(2)}, watched a while (mild) ${rate(.3, r => r.watched).toFixed(2)}; time to a kill p50 ${HS.map(tk).join(' / ')} s (very hungry ${veryT}, starving ${starvT}) | satiated and mild harmless ${low}, hungry only sometimes and not always lethal ${hungry}, very hungry always on them ${very}, starving quicker ${starving}, a single step from never to always ${step}`, data: rs };
});

/* ---- C5 ---- */
add('C07 sounds stay anonymous: it hunts A (seen, then quiet behind the pillar); B, never seen, runs about elsewhere - the noise may draw it (a misdirection that works) but B is never named before it sees them; its hunt of A ends - in silence, or for B once it really sees them', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 15000), y = LONG.y; bystander(w, 1300, 3300);
    const a = w.player(5150, y, { light: true, angle: 0 }); a.stop('stand');
    const b = w.player(5112, 3192, { light: false, angle: 0 }); b.stop('stand');          // (C13's hidden lane, behind the side room's wall)
    const e = w.eng.spawn('skinstealer', 5700, y, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI;
    let huntA = -1, drawn = false, namedB = 0, endAt = -1, bSeen = false, endWhy = '';
    w.run(45, (ww, t) => {
      if (huntA < 0 && e.hunt && e.hunt.pid === a.id) { huntA = t; a.light = false; a.route([{ x: 4952 - 260, y: 3584 }], 'crouch'); }   // (seen: torch off, crouched behind the pillar, still)
      if (huntA >= 0 && a.path && !a.path.length) a.stop('crouch');
      if (huntA >= 0 && t - huntA > 2 && t - huntA < 12 && !b.leg) { b.leg = 1; b.route([{ x: 5112, y: 2792 }, { x: 5112, y: 3192 }, { x: 5112, y: 2792 }, { x: 5112, y: 3192 }], 'run'); }
      if (b.leg && e.plan && (e.plan.k === 'search' || e.plan.k === 'listen' || e.plan.k === 'intercept') && e.plan.goal && Math.hypot(e.plan.goal.x - 5112, e.plan.goal.y - 3000) < 450) drawn = true;
      const rb = e.mem.p.get(b.id); if (rb && rb.seenAt > 0) bSeen = true;
      if (!bSeen && ((e.hunt && e.hunt.pid === b.id) || (e.plan && e.plan.pid === b.id) || (e.enc && e.enc.pid === b.id))) namedB++;
      if (huntA >= 0 && endAt < 0 && !(e.hunt && e.hunt.pid === a.id)) { endAt = t; endWhy = e.hunt ? 'hunts B, seen' : (e.dbg.huntEnd || {}).why || ''; }
      return true; });
    return { hunted: huntA >= 0, drawn, namedB, bSeen, ended: endAt >= 0, endWhy, endAfter: endAt >= 0 ? +(endAt - huntA).toFixed(1) : null, killed: w.kills.map(k => k.pid === a.id ? 'A' : k.pid === b.id ? 'B' : '?').join('') };
  });
  const h = rs.filter(r => r.hunted), ok = h.length >= 6 && rs.every(r => r.namedB === 0) && h.filter(r => r.drawn).length >= 1 && h.filter(r => r.ended || r.killed).length === h.length && h.every(r => !r.ended || r.endAfter <= 40);
  return { ok, note: `hunted A ${h.length}/8; drawn toward B's noise ${h.filter(r => r.drawn).length}/${h.length}; B named before ever seen ${rs.reduce((x, r) => x + r.namedB, 0)} ticks (B seen at all ${rs.filter(r => r.bSeen).length}); its hunt of A ended (or a kill) ${h.filter(r => r.ended || r.killed).length}/${h.length} (after ${h.map(r => r.endAfter).join('/')} s: ${[...new Set(h.map(r => r.endWhy))].join(' | ')}; kills ${h.map(r => r.killed || '-').join(' ')})`, data: rs };
});

add('C11 fair strikes in the new tactics (a stand-off pressing in, an opening, a cut-off): every spring shows its whole wind-up, at somebody it sees (a clear line of sight), its stamina paid, and kills only on contact; a person who steps aside at the tell makes that spring miss', () => {
  const springs = [], kills = [];
  const watch = (w, e, p) => { let S = null, st0 = 0, nk = 0;
    return () => {
      if (e.pounce && e.pounce !== S) { S = e.pounce; st0 = e.stam; springs.push({ plan: e.plan ? e.plan.k : '-', need: S.wind, wind: 0, clear: w.eng.geo.los(e.x, e.y, p.x, p.y) && e.seenNow.has(p.id), stam0: st0, paid: null }); }   // (it sees them: nothing through a wall)
      if (S && e.pounce === S) { const L = springs[springs.length - 1]; L.wind = Math.max(L.wind, Math.min(S.t, S.wind)); if (S.paid && L.paid === null) L.paid = +(L.stam0 - e.stam).toFixed(1); }
      if (S && e.pounce !== S && springs[springs.length - 1].paid === null) springs[springs.length - 1].paid = +(springs[springs.length - 1].stam0 - e.stam).toFixed(1);
      if (w.kills.length > nk) { nk = w.kills.length; kills.push({ d: Math.round(Math.hypot(p.x - e.x, p.y - e.y)) }); }
    }; };
  over([1, 2, 3, 4], seed => {
    for (const h of [.8, .95]) { const { w, p, e } = watched(seed + 15100 + Math.round(h * 100), h, null), f = watch(w, e, p); w.run(25, () => { f(); return !w.kills.length; }); }
    { const { w, p, e } = watched(seed + 15200, .55, t => t > 6 && (t - 6) % 8 < 2.5), f = watch(w, e, p); w.run(30, () => { f(); return !w.kills.length; }); }
    { const w = World(seed + 15300); bystander(w, 1300, 3300); const p = w.player(PILLAR.x + PILLAR.R, PILLAR.y, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, LONG.y, { hunger: .6 }); e.tier = 'near'; e.ang = Math.PI; const f = watch(w, e, p); const ring = [];
      for (let l = 0; l < 14; l++) for (let k = 0; k < 16; k++) { const a = -k / 16 * Math.PI * 2; ring.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); }
      w.run(30, (ww, t) => { if (t > .3 && !p.leg) { p.leg = 1; p.route(ring, 'run'); } f(); return !w.kills.length; }); }
    return {};
  });
  // the step aside: very hungry (.8), pressed in on while they watch; at the first sign of the wind-up they run 0.6 s sideways
  const dodge = over([1, 2, 3, 4, 5, 6], seed => { const { w, p, e } = watched(seed + 15400, .8, null); let S = null, res = null;
    w.run(25, () => { if (e.pounce && !S) { S = e.pounce; const a = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2; p.look = null; p.go(p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 'run'); }
      if (S && e.pounce !== S && res === null) res = !w.kills.length; return res === null; });
    return { sprang: !!S, escaped: res };
  });
  const bad = springs.filter(q => q.wind < q.need - .02 || !q.clear || !(q.paid > 0)), far = kills.filter(k => k.d > 60), dz = dodge.filter(r => r.sprang);
  const ok = springs.length >= 10 && bad.length === 0 && far.length === 0 && dz.length >= 4 && dz.filter(r => r.escaped).length >= dz.length * .6;
  return { ok, note: `${springs.length} springs (from ${[...new Set(springs.map(q => q.plan))].join(', ')}): the whole wind-up, in its sight, stamina paid in all but ${bad.length}${bad.length ? ' ' + JSON.stringify(bad.slice(0, 3)) : ''}; ${kills.length} kills, each with its body against them (over 60 px apart: ${far.length}) | a step aside at the tell: missed ${dz.filter(r => r.escaped).length}/${dz.length}`, data: { springs: springs.slice(0, 30), dodge } };
});

add('C14 four of them, eight people, every new tactic at once (watchers who look away, a circler, two together, a runner, walkers), 90 s: what it keeps of each person stays bounded (its sightings, its QA record, its remembered places), nothing in a wall, and its route searches stay few', () => {
  const w = World(15500), y = LONG.y, P = [];
  const add2 = (x, yy, o) => { const p = w.player(x, yy, { light: true, angle: 0 }); p.stop('stand'); Object.assign(p, o || {}); P.push(p); return p; };
  const ring = []; for (let l = 0; l < 30; l++) for (let k = 0; k < 16; k++) { const a = -k / 16 * Math.PI * 2; ring.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); }
  const circ = add2(PILLAR.x + PILLAR.R, PILLAR.y), w1 = add2(3600, y), w2 = add2(7600, y), t1 = add2(6900, 3150), t2 = add2(6950, 3200), run = add2(3200, 3300), k1 = add2(1300, 5600), k2 = add2(700, 5330);
  const E = [[5450, y], [4200, y], [7000, y + 150], [1900, 5560]].map(([x, yy], i) => { const f = floorNear(w, x, yy, 26), e = w.eng.spawn('skinstealer', f.x, f.y, { hunger: [.55, .7, .85, .95][i] }); e.tier = 'near'; return e; });   // (on open floor: the test never puts one in a wall)
  const near = (p) => E.reduce((b, e) => !b || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? e : b, null);
  for (const p of [w1, w2]) p.look = () => { const e = near(p); return Math.atan2(e.y - p.y, e.x - p.x) + ((w.t % 9) < 1.5 ? Math.PI : 0); };
  const C = routeCount(); const per = []; let last = 0, lastT = 0, inWall = 0, maxObs = 0, maxCog = 0, maxSounds = 0, err = '';
  try { w.run(90, (ww, t) => {
    if (t > .3 && !circ.leg) { circ.leg = 1; circ.route(ring, 'run'); }
    if (t > 2 && !run.leg) { run.leg = 1; run.route([{ x: 8600, y }, { x: 3200, y }, { x: 8600, y }], 'run'); }
    for (const p of [k1, k2]) if (!p.dead && (!p.path || !p.path.length) && p.tx === null) { p.leg = (p.leg || 0) + 1; p.pathTo(p.leg % 2 ? 1720 : 700, p.leg % 2 ? 4900 : 5330, p.leg % 3 ? 'walk' : 'crouch'); }
    for (const p of P) if (p.dead && !p.back) p.back = t; else if (p.dead && t - p.back > 5 && w.sim.respawn) { w.sim.respawn(p); p.back = 0; }
    if (t - lastT >= 1) { per.push((C.n - last) / E.length); last = C.n; lastT = t; }
    for (const e of E) { maxObs = Math.max(maxObs, e.obs ? e.obs.s.length / 3 : 0); maxCog = Math.max(maxCog, e.cog ? e.cog.log.length : 0); maxSounds = Math.max(maxSounds, e.mem.sounds.length);
      if (!e.trav && !e.commit && !e.cap && !w.eng.geo.clear(e.x, e.y, e.rc - 6, 'walk')) inWall++; }
    return true; }); } catch (x) { err = String(x.stack).split('\n').slice(0, 2).join(' | '); } finally { C.undo(); }
  const ps = per.slice().sort((a, b) => a - b), mean = per.reduce((a, b) => a + b, 0) / Math.max(1, per.length);
  const tal = k => E.reduce((a, e) => a + (e.tally[k] || 0), 0);
  const ok = !err && maxObs <= AI.SK.circWin * 10 + 2 && maxCog <= AI.SK.cogLog && inWall === 0 && mean <= 1.5 && ps[ps.length - 1] <= 10;
  return { ok, note: `${err ? 'ERROR ' + err + ' | ' : ''}sightings kept at most ${maxObs} (bound ${AI.SK.circWin * 10 + 2}), QA record at most ${maxCog} (${AI.SK.cogLog}), sounds at most ${maxSounds}; in a wall ${inWall} ticks | route searches per creature per second: mean ${mean.toFixed(2)}, p95 ${ps[Math.floor(ps.length * .95)]}, busiest ${ps[ps.length - 1]} | cut-offs ${tal('cut')}, no-bait corners ${tal('noBait')}, no way round ${tal('noFlank')}, kills ${w.kills.length}`, data: { per } };
});

add('C16 what players are sent is what R8 sent: in a stand-off, a cut-off, pressing in, the snapshot entry has the same eight fields and only acts and states from R8\'s tables, and nothing it now keeps (its sightings, its circles, its QA record) appears in the snapshot', () => {
  const bad = [], seenK = new Set();
  const scan = (w, label) => { const S = w.sim.entities(), j = JSON.stringify(S);
    if (/"cog"|"obs"|"circ"|"bold"|"noBait"|stand|"cut"/.test(j)) bad.push(label + ': ' + (j.match(/"cog"|"obs"|"circ"|"bold"|"noBait"|stand|"cut"/) || [])[0]);
    for (const t of S.ss || []) { const keys = Object.keys(t).join(); if (keys !== 'i,x,y,a,s,ac,v,h' && keys !== 'i,x,y,a,s,ac,v,h,dg') bad.push(label + ' keys ' + keys);
      if (!Object.values(AI.KACT).includes(t.ac) || !Object.values(AI.SCODE).includes(t.s)) bad.push(label + ' codes ' + t.ac + '/' + t.s); } };
  over([1, 2], seed => {
    { const { w, e } = watched(seed + 15600, .55, t => t > 6 && (t - 6) % 8 < 2.5); w.run(20, () => { if (e.plan) seenK.add(e.plan.k); scan(w, 'stand'); return !w.kills.length; }); }
    { const { w, e } = watched(seed + 15650, .85, null); w.run(15, () => { if (e.plan) seenK.add(e.plan.k); scan(w, 'press'); return !w.kills.length; }); }
    { const w = World(seed + 15700); bystander(w, 1300, 3300); const p = w.player(PILLAR.x + PILLAR.R, PILLAR.y, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, LONG.y, { hunger: .6 }); e.tier = 'near'; e.ang = Math.PI; const ring = [];
      for (let l = 0; l < 14; l++) for (let k = 0; k < 16; k++) { const a = -k / 16 * Math.PI * 2; ring.push({ x: PILLAR.x + Math.cos(a) * PILLAR.R, y: PILLAR.y + Math.sin(a) * PILLAR.R }); }
      w.run(30, (ww, t) => { if (t > .3 && !p.leg) { p.leg = 1; p.route(ring, 'run'); } if (e.plan) seenK.add(e.plan.k); scan(w, 'cut'); return !w.kills.length; }); }
    return {};
  });
  const ok = bad.length === 0 && seenK.has('stand') && seenK.has('cut');
  return { ok, note: `${bad.length ? bad.slice(0, 4).join(' | ') : 'every snapshot entry: i,x,y,a,s,ac,v,h (dg only in a skin), R8\'s act and state codes, nothing of its new records'}; plans gone through ${[...seenK].join(', ')}` };
});

add('C17 no endless hunt: a hungry one (.5 / .55) facing somebody who never gives it an opening, alone, 120 s - the stand-offs, renewals and repositionings end within its effort budget for them, the effort it spent never goes down (not across a departure, not across somebody else), and a hunt with no new evidence ends', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => [.5, .55].map(h => {
    const { w, p, e } = watched(seed + 15800 + Math.round(h * 100), h, null);
    let leftAt = -1, dropped = 0, lastSpent = 0, budget = AI.SK.budgetEnc[0] + AI.SK.budgetEnc[1] * h;
    w.run(120, (ww, t) => {
      const sp = (e.enc && e.enc.pid === p.id ? e.enc.spent : 0) || (e.spent.get(p.id) || 0);
      if (sp + 1e-6 < lastSpent - .5 && !(e.enc && e.enc.pid === p.id)) { /* (between encounters the carried effort halves over 90 s - that is not a refill) */ } else if (sp + 1e-6 < lastSpent - .01) dropped++;
      if (e.enc && e.enc.pid === p.id) lastSpent = Math.max(lastSpent, sp);
      if (leftAt < 0 && planOf(e) === 'leave') leftAt = t; return true; });
    return { h, leftAt: +leftAt.toFixed(1), budget: Math.round(budget), dropped, killed: w.kills.length, again: (e.cog.log || []).filter(x => x.stim === 'again').length };
  })).flat();
  const ok = rs.every(r => r.killed || (r.leftAt >= 0 && r.leftAt <= r.budget + 12)) && rs.every(r => r.dropped === 0);
  return { ok, note: `left them at ${rs.map(r => r.leftAt).join('/')} s (budgets ${[...new Set(rs.map(r => r.budget))].join('/')} s + 12); stand-offs renewed (in its last 24 decisions) up to ${Math.max(...rs.map(r => r.again))}; killed ${rs.filter(r => r.killed).length}; effort that went down ${rs.reduce((a, r) => a + r.dropped, 0)}`, data: rs };
});

add('C15 (in-tree part) no Skin-Stealer, nothing changed: against R8 (f378049) the only game files that differ are the species file and what it builds into (generated/server/ai.js, the build manifest) - the shared engine, the Hound, the Smiler, G.I.B., the snapshot, the client and the server byte for byte R8\'s - and with no Skin-Stealer in a world none of its code runs (the six-seed, tick-for-tick P9 equivalence is dev/trial-3-skin-stealer/tools/equiv_p9.js, run at each checkpoint)', () => {
  const { execFileSync } = require('child_process'), path = require('path'), root = path.join(__dirname, '..', '..');
  const R8 = 'f378049a825e53eafc626a637b8c43397e4072f0', git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 1 << 26 }).toString().split('\n').filter(Boolean);
  const MAY = ['src/frameworks/nani/server/ai.skinstealer.js', 'generated/server/ai.js', 'generated/BUILD_MANIFEST.json'];
  let files = null; try { files = git('diff', '--name-only', R8, '--').concat(git('ls-files', '--others', '--exclude-standard')); } catch (e) { }
  const game = files ? [...new Set(files.filter(f => !f.startsWith('dev/')))].sort() : null, other = game ? game.filter(f => !MAY.includes(f)) : null;
  // a world with the director's own Hounds and Smilers and four players, no Skin-Stealer: the species' tick never runs
  const w = World(15000, { director: true }); w.sim.resetWorld(); for (const [x, y] of [[1300, 5900], [5000, LONG.y], [700, 5330], [8000, 3504]]) { const p = w.player(x, y, { light: true }); p.go(x + 300, y, 'walk'); }
  let calls = 0; const tk = AI.SKIN.tick; AI.SKIN.tick = function (...a) { calls++; return tk.apply(this, a); };
  try { w.run(20); } finally { AI.SKIN.tick = tk; }
  const kinds = [...new Set(w.eng.entities.map(e => e.kind))].sort();
  return { ok: !!game && other.length === 0 && calls === 0 && !kinds.includes('skinstealer') && kinds.includes('hound'),
    note: `game files changed since R8 (outside dev/): ${game ? game.join(', ') || 'none' : 'git unavailable'}${other && other.length ? ' - NOT the species: ' + other.join(', ') : ''} | 20 s with the director's ${kinds.join(' and ')} and four players: the Skin-Stealer's tick ran ${calls} times` };
});

// the requirement, stated here (not read from the creature): what a person would feel as prompt, and how often a twitch may be taken
const LAT = { face: .5, choose: .5, moveIn: 1, next: 2.5, twitch: .1 };
add('C18 latency as a person feels it (p50 / p95 / worst over seeds, from the tick the evidence is there): (a) somebody walks into its view: it faces them, then chooses; (b) watched, they turn their back for 2.5 s: it moves in on them; (c) lost round a corner: its next step; and (d) where faster is worse - a glance away shorter than its beat: it holds what it is doing (it waits)', () => {
  const N = (a) => `p50 ${q(a, .5)} / p95 ${q(a, .95)} / worst ${a.some(x => x === null) ? 'never' : q(a, 1)}`;
  // (a) C01's walk-in at .55 and .8: faced (its view turned onto them), a choice (a new plan or a hunt), moving (its first 10 px)
  const A = over([1, 2, 3, 4, 5, 6], seed => [.55, .8].map(h => {
    const w = World(seed + 18000 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    const p = w.player(5700, 3250, { light: true, angle: Math.PI }); p.stop('stand'); p.look = null;
    let seenAt = -1, faceAt = -1, choiceAt = -1, moveAt = -1, plan0 = null, off0 = 0, x0 = 0, y0 = 0;
    w.run(6, (ww, t) => {
      if (t > .2 && !p.leg) { p.leg = 1; p.pathTo(4700, y, 'walk'); }
      const off = Math.abs(ang(e.ang + (e.head || 0), Math.atan2(p.y - e.y, p.x - e.x)));
      if (seenAt < 0 && e.seenNow.has(p.id)) { seenAt = t; off0 = off; plan0 = e.plan; x0 = e.x; y0 = e.y; }
      if (seenAt >= 0 && faceAt < 0 && (off < .5 || off < off0 - .3)) faceAt = t;
      if (seenAt >= 0 && choiceAt < 0 && (e.plan !== plan0 || e.hunt)) choiceAt = t;
      if (seenAt >= 0 && moveAt < 0 && Math.hypot(e.x - x0, e.y - y0) > 10) moveAt = t;
      return true; });
    const r = v => v >= 0 ? +(v - seenAt).toFixed(2) : null;
    return seenAt < 0 ? null : { h, seenAt: +seenAt.toFixed(2), face: r(faceAt), choose: r(choiceAt), move: r(moveAt) };
  })).flat().filter(Boolean);
  // (b) C02's watcher at .55 and .62, who turns their back at 6 s for 2.5 s: from that tick to its first step in on them (closing 40 px)
  const B = over([1, 2, 3, 4, 5, 6], seed => [.55, .62].map(h => {
    const { w, p, e } = watched(seed + 18100 + Math.round(h * 100), h, t => t > 6 && t < 8.5);
    let d0 = -1, inAt = -1, seen = false, early = false;
    w.run(8.5, (ww, t) => {
      const d = Math.hypot(p.x - e.x, p.y - e.y); if (e.seenNow.has(p.id)) seen = true; if (t <= 6 && w.kills.length) early = true;
      if (t > 6 && d0 < 0) d0 = d;
      if (d0 >= 0 && inAt < 0 && d < d0 - 40) inAt = t - 6;
      return !w.kills.length || t <= 6; });
    return seen && d0 > 200 && !early ? { h, moveIn: inAt >= 0 ? +inAt.toFixed(2) : null } : null;
  })).flat().filter(Boolean);
  // (c) C05's corner at .75: seen walking north, then out of sight (torch off, crouched, east): from the tick it lost them to its next plan
  const C = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 18200); bystander(w, 8400, 900);
    const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .75 }); e.tier = 'near'; e.ang = Math.PI;
    let lostAt = -1, P0 = null, nextAt = -1, once = false, nk = '';
    w.run(10, (ww, t) => {
      if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
      if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.route([{ x: 1720, y: 4900 }], 'crouch'); }
      if (p.light && p.y < 5440) p.light = false;
      const seen = e.seenNow.has(p.id); if (seen) once = true;
      if (lostAt < 0 && once && !seen && (e.hunt || e.plan)) { lostAt = t; P0 = e.plan; }
      if (lostAt >= 0 && nextAt < 0 && e.plan !== P0) { nextAt = t; nk = planOf(e); }
      if (seen && lostAt >= 0 && nextAt < 0) { lostAt = -1; }
      return !w.kills.length; });
    return lostAt < 0 ? null : { next: nextAt >= 0 ? +(nextAt - lostAt).toFixed(2) : null, k: nk };
  }).filter(Boolean);
  // (d) faster is worse: a watcher who glances off it for 0.15 s every 2 s (shorter than any beat it takes before using a look away), at
  // .62 and .75: how often it drops what it was doing within 0.5 s of a glance - a plan dropped on a twitch, taken up again or not
  const D = over([1, 2, 3, 4, 5, 6], seed => [.62, .75].map(h => {
    const gl = t => t > 4 && (t - 4) % 2 < .15;
    const { w, p, e } = watched(seed + 18300 + Math.round(h * 100), h, gl);
    let n = 0, hit = 0, cur = null;
    w.run(20, (ww, t) => {
      if (gl(t) && (!cur || t - cur.t0 > 1)) { cur = { t0: t, P: e.plan, took: false }; n++; }
      if (cur && !cur.took && t - cur.t0 <= .5 && e.plan !== cur.P && e.seenNow.has(p.id)) { cur.took = true; hit++; cur.lat = +(t - cur.t0).toFixed(2); }
      return !w.kills.length; });
    return { h, n, hit };
  })).flat();
  const dn = D.reduce((s, r) => s + r.n, 0), dh = D.reduce((s, r) => s + r.hit, 0);
  const face = A.map(r => r.face), choose = A.map(r => r.choose), move = A.map(r => r.move), moveIn = B.map(r => r.moveIn), next = C.map(r => r.next);
  const okA = A.length >= 9 && face.every(v => v !== null) && q(face, .95) <= LAT.face && choose.every(v => v !== null) && q(choose, .95) <= LAT.choose;
  const okB = B.length >= 8 && moveIn.filter(v => v !== null && v <= LAT.moveIn).length >= B.length * .75;
  const okC = C.length >= 4 && next.every(v => v !== null) && q(next, .95) <= LAT.next;
  const okD = dn >= 40 && dh <= dn * LAT.twitch;
  return { ok: okA && okB && okC && okD,
    note: `(a) walked into its view (${A.length} runs at .55/.8): faced ${N(face)} s; chose ${N(choose)} s; moving ${N(move)} s | (b) a back turned for 2.5 s (${B.length} runs at .55/.62): moved in ${N(moveIn)} s (within ${LAT.moveIn} s: ${moveIn.filter(v => v !== null && v <= LAT.moveIn).length}/${B.length}) | (c) lost round a corner (${C.length} runs at .75): its next step ${N(next)} s (${[...new Set(C.map(r => r.k))].join(', ')}) | (d) faster is worse - 0.15 s glances away (${dn} at .62/.75): it dropped what it was doing within 0.5 s of ${dh} (${(dh / Math.max(1, dn) * 100).toFixed(0)} %; at most ${LAT.twitch * 100} %)`,
    data: { A, B, C, D } };
});
module.exports = S;
