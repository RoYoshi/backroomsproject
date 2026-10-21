/* SKIN-STEALER predator refinement scenarios (dev/trial-3-predator-refinement/; Trial 3 is not owner-approved).  Each runs the real server
 * simulation (sim.js + ai.js as built, players moved by the game's own move.js through the harness) over several seeds.  No scenario sets
 * a decision of the creature: they place people, give it a hunger (its spawn option) and, where a scenario says so, its stamina (its body,
 * as a hunger is), move people as players would, and read what it did.  Every scenario that says it perceived something says how: SEEN
 * (e.seenNow), HEARD (a sound it really received: anonymous unless the engine named it), REMEMBERED (its record), GUESSED (its own belief or
 * prediction).  The people's scripts may read where the creature really is (a player's own sight of it); the creature never reads them.
 * R1: PR01-PR05, PR18-PR20 (hunger, eye contact, the hunt, the lost race).  R2: PR08-PR16 (listening, belief, guesses, failed guesses).
 * R3: PR06, PR07, PR17, PR21 (going round a watcher, coming on openly, the tells, fair strikes). */
'use strict';
const { World, DT, LONG, over, rate, AI, floorNear, bystander } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
const HUNTING = new Set(['approach', 'chase', 'flank', 'intercept', 'search', 'lure', 'listen', 'hunt']);
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
const ARENA = { x: 3960, y: 3384 };                     // an open hall (every wall at least 300 px off), dim
/* the long lit hall: a person at (5000, y) facing pa, the creature 450 px east of them facing west; a far, dark bystander keeps the room alive */
function hall(seed, o = {}) {
  const w = World(seed), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(o.px ?? 5000, y, { light: o.light !== false, angle: o.pa ?? 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', o.ex ?? 5450, y, { hunger: o.hunger }); e.tier = 'near'; e.ang = Math.PI;
  if (o.stam !== undefined) { e.stam = o.stam; e.exh = o.stam < AI.SK.stamExh; }
  p.look = o.watch ? () => Math.atan2(e.y - p.y, e.x - p.x) : (o.pa ?? 0);
  return { w, p, e };
}
/* ten times a second: what it did, and what it perceived of p */
function trace(w, e, p) {
  const T = []; let n = 0;
  T.take = t => { if (n++ % 6) return; const H = e.hunt;
    T.push({ t: +t.toFixed(1), plan: planOf(e), pid: e.plan ? e.plan.pid : 0, act: e.act || '-', d: Math.round(Math.hypot(p.x - e.x, p.y - e.y)), v: Math.round(e.speed), seen: e.seenNow.has(p.id) ? 1 : 0,
      hunt: H ? H.pid : 0, conf: H ? +H.conf.toFixed(2) : 0, ev: H ? H.ev : '', h: +e.hunger.toFixed(3), st: Math.round(e.stam), why: e.dbg.why || '' }); };
  return T;
}
const plansOf = T => { const out = []; for (const s of T) if (!out.length || out[out.length - 1] !== s.plan) out.push(s.plan); return out; };
const firstAt = (T, f) => { const s = T.find(f); return s ? s.t : -1; };

add('PR01 satiated, a person passing close by: it notices them (a look at most) and does not hunt them, and no defensive attack follows a single pass', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, p, e } = hall(seed + 2000, { hunger: .1, px: 5150, pa: 0 }); const T = trace(w, e, p);
    p.look = null; p.route([{ x: 5450, y: LONG.y + 80 }, { x: 6400, y: LONG.y + 80 }], 'walk');   // they walk past where it stands, 80 px to its side, and on
    w.run(25, (ww, t) => { T.take(t); return true; });
    const dmin = Math.min(...T.map(s => s.d)), hunted = T.some(s => HUNTING.has(s.plan) && s.pid === p.id) || e.tally.hunt > 0;
    // a warning (B1: somebody walking right up to it) is allowed - it is not an attack
    return { ok: dmin < 220 && T.some(s => s.seen) && !hunted && !e.tally.pounce && !e.tally.defend && !w.kills.length, dmin, hunted, warned: e.tally.warn, seen: T.filter(s => s.seen).length, plans: plansOf(T).join('>') };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/8 passed within ${rs.map(r => r.dmin).join('/')} px (seen ${rs.map(r => r.seen).join('/')} samples; warned ${rs.map(r => r.warned).join('/')}): hunted 0, strikes 0, defences 0, kills 0; plans ${[...new Set(rs.map(r => r.plans))].join(' | ')}`, data: rs };
});

add('PR02 satiated, pressed after a warning it may defend itself (B1-B5 kept); backing off after the warning ends it - nothing follows', () => {
  const press = (seed, back) => {
    const { w, p, e } = hall(seed + 2100, { hunger: 0, px: 5380, pa: 0 }); const T = trace(w, e, p);
    let warnEnd = -1, followed = 0;
    w.run(40, (ww, t) => {
      const d = Math.hypot(p.x - e.x, p.y - e.y), ux = (p.x - e.x) / (d || 1), uy = (p.y - e.y) / (d || 1);
      if (e.tally.warn && warnEnd < 0 && !(e.rx && e.rx.k === 'warn')) warnEnd = t;
      if (back && warnEnd >= 0) { if (!p.going) { p.going = 1; p.look = null; p.pathTo(3300, 3300, 'walk'); } if (t - warnEnd > 4 && d < 300) followed++; }
      else if (!p.dead && !p.caught) { p.path = null; p.mode = 'walk'; p.tx = { x: e.x + ux * 60, y: e.y + uy * 60 }; p.look = Math.atan2(e.y - p.y, e.x - p.x); }
      T.take(t); return true;
    });
    return { warned: e.tally.warn, defended: e.tally.defend + e.tally.withdraw, killed: w.kills.length, followed, hunted: e.tally.hunt, warnEnd: +warnEnd.toFixed(1) };
  };
  const pr = over([1, 2, 3, 4, 5, 6], s => press(s, false)), bk = over([1, 2, 3, 4, 5, 6], s => press(s, true));
  const ok = pr.every(r => r.warned >= 1 && r.hunted === 0) && pr.filter(r => r.defended > 0).length >= 4 && bk.every(r => r.warned >= 1 && r.followed === 0 && r.killed === 0 && r.hunted === 0);
  return { ok, note: `pressing: warned ${pr.map(r => r.warned).join('/')}, defences ${pr.map(r => r.defended).join('/')}, killed ${pr.map(r => r.killed).join('/')}, hunts ${pr.map(r => r.hunted).join('/')} | backing off after the warning: followed within 300 px ${bk.map(r => r.followed).join('/')} samples, killed ${bk.map(r => r.killed).join('/')}`, data: { pr, bk } };
});

add('PR03 starving (.95) and watched in the lit hall: not an automatic departure - it comes on, or goes round them; at .1 the same scene sends it away', () => {
  const runOnce = (seed, h) => {
    const { w, p, e } = hall(seed + 2200, { hunger: h, watch: true }); const T = trace(w, e, p);
    w.run(25, (ww, t) => { T.take(t); return true; });
    const leftAt = firstAt(T, s => s.plan === 'leave'), active = T.filter(s => ['approach', 'flank', 'chase'].includes(s.plan)).length;
    return { leftAt, active, hunted: e.tally.hunt, kills: w.kills.length, first: plansOf(T).filter(k => k !== 'roam')[0] || '-', closest: Math.min(...T.map(s => s.d)) };
  };
  const hi = over([1, 2, 3, 4, 5, 6, 7, 8], s => runOnce(s, .95)), lo = over([1, 2, 3, 4, 5, 6, 7, 8], s => runOnce(s, .1));
  const hiOk = hi.filter(r => (r.leftAt < 0 || r.leftAt > 20) && r.hunted > 0 && r.active > 0).length;
  const ok = hiOk >= 6 && lo.every(r => r.leftAt >= 0 && r.leftAt < 2 && r.hunted === 0);
  return { ok, note: `.95: ${hiOk}/8 hunted without leaving in the first 20 s (first answer ${hi.map(r => r.first).join('/')}; closest ${hi.map(r => r.closest).join('/')} px; kills ${hi.reduce((a, r) => a + r.kills, 0)}) | .1: left in ${lo.map(r => r.leftAt).join('/')} s, hunted ${lo.reduce((a, r) => a + r.hunted, 0)}`, data: { hi, lo } };
});

add('PR04 starving: a person it keeps seeing stays hunted across a long encounter; a person who goes out of sight and stays silent is given up - for that reason', () => {
  // A: a cautious person who keeps 450-700 px from it in the lit hall, looking at it now and then (a sighting renews the evidence)
  const keep = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, p, e } = hall(seed + 2300, { hunger: .9, pa: 0 }); const T = trace(w, e, p);
    w.run(70, (ww, t) => {
      if (!p.dead && !p.caught) { const d = Math.hypot(p.x - e.x, p.y - e.y), ax = Math.sign(p.x - e.x) || -1;
        p.look = Math.floor(t / 3) % 2 ? Math.atan2(e.y - p.y, e.x - p.x) : (ax > 0 ? 0 : Math.PI);
        if (d < 450) p.go(Math.max(3100, Math.min(8700, p.x + ax * 400)), LONG.y, d < 300 ? 'run' : 'walk'); else if (d > 700) p.stop('stand'); }
      T.take(t); return true; });
    const leftAt = firstAt(T, s => s.plan === 'leave'), huntT = T.filter(s => s.hunt === p.id).length / 10;
    return { ok: w.kills.length > 0 || (leftAt < 0 || leftAt > 45) && huntT >= 30, killed: w.kills.length, leftAt, huntT: +huntT.toFixed(1), seen: T.filter(s => s.seen).length };
  });
  // B: seen once (walking north past wall C's gap with a torch), then - once out of its sight - torch off, crouched (quiet), on north out of
  // the room and west along the north passage, where they crouch still: the hunt ends because nothing more came.  Only runs where it saw
  // them on that first walk are judged (a creature that never saw them has nothing to give up)
  const quiet = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 2350); bystander(w, 8400, 900);
    const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .95 }); e.tier = 'near'; e.ang = Math.PI;
    const T = trace(w, e, p); let lastSeen = -1, hideAt = -1, seenHiding = 0;
    w.run(80, (ww, t) => {
      if (e.seenNow.has(p.id)) { lastSeen = t; if (hideAt >= 0) seenHiding++; }
      if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5200 }], 'walk'); }
      if (p.going === 1 && lastSeen >= 0 && t - lastSeen > .6 && p.y < 5450) { p.going = 2; hideAt = t; p.light = false; p.route([{ x: 1300, y: 5150 }, { x: 1250, y: 4870 }, { x: 480, y: 4870 }], 'crouch'); }
      if (p.going === 2 && p.path && !p.path.length) { p.going = 3; p.stop('crouch'); }
      T.take(t); return true; });
    const end = e.dbg.huntEnd, gaveUp = !!end && /no sign|searched|cold|gives up|guessed wrong/.test(end.why), judged = hideAt >= 0 && hideAt < 8;
    return { judged, ok: !w.kills.length && gaveUp && !e.hunt, gaveUp, why: end ? end.why : '-', at: end ? +(end.at - 60).toFixed(1) : -1, hideAt: +hideAt.toFixed(1), seenHiding, killed: w.kills.length, plans: plansOf(T).join('>') };
  });
  const qj = quiet.filter(r => r.judged), qOk = qj.filter(r => r.ok).length;
  const ok = rate(keep) >= 5 / 6 && qj.length >= 6 && qOk >= qj.length - 1;
  return { ok, note: `kept in view: ${keep.filter(r => r.ok).length}/6 (killed ${keep.map(r => r.killed).join('/')}, hunting for ${keep.map(r => r.huntT).join('/')} s of 70, left at ${keep.map(r => r.leftAt).join('/')} s) | out of sight and silent: gave up ${qOk}/${qj.length} judged runs (of 8; out of its sight from ${qj.map(r => r.hideAt).join('/')} s, given up at ${qj.map(r => r.at).join('/')} s): ${[...new Set(qj.map(r => '"' + r.why + '"'))].join(', ')}; killed ${qj.reduce((a, r) => a + r.killed, 0)}`, data: { keep, quiet } };
});

add('PR05 starving, the straight race: a fresh runner still wins (never closer than it started the race, never faster than its run) - then it does not simply go home: it listens, searches or guesses on the evidence', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 2400), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .95 }); e.tier = 'near'; e.ang = 0;
    p.go(8700, y, 'run'); const T = trace(w, e, p);
    let lostAt = -1, dRace = 1e9, vmax = 0, stoppedAt = -1;
    w.run(40, (ww, t) => {
      if (lostAt < 0 && e.tally.chaseLost) lostAt = t; if (stoppedAt < 0 && t > 1 && p.tx === null) stoppedAt = t;
      if (planOf(e) === 'chase') dRace = Math.min(dRace, Math.hypot(p.x - e.x, p.y - e.y));
      if (!e.pounce && !e.trav) vmax = Math.max(vmax, e.speed);                       // (a vault or a squeeze is the engine's traversal, not its stride)
      T.take(t); return true; });
    // the runner stops at the hall's end, facing on, unaware: a kill after that is a stalk on a still person, not speed (reported, allowed)
    const killT = w.kills.length ? w.kills[0].at : -1, killRunning = w.kills.length > 0 && (stoppedAt < 0 || (killT >= 0 && killT < stoppedAt));
    const after = lostAt < 0 ? [] : plansOf(T.filter(s => s.t > lostAt)), evidence = after.some(k => ['listen', 'search', 'intercept', 'approach', 'watch'].includes(k));
    return { ok: lostAt >= 0 && dRace >= 280 && vmax <= e.sp.speeds.run + 1 && !killRunning && evidence && after[0] !== 'leave', lostAt: +lostAt.toFixed(1), dRace: Math.round(dRace), vmax: Math.round(vmax), stoppedAt: +stoppedAt.toFixed(1), killed: w.kills.length, after: after.join('>') };
  });
  return { ok: rate(rs) >= 7 / 8, note: `${rs.filter(r => r.ok).length}/8: lost the race at ${rs.map(r => r.lostAt).join('/')} s, never closer than ${rs.map(r => r.dRace).join('/')} px in it, fastest ${rs.map(r => r.vmax).join('/')} px/s (its run ${AI.SKIN.speeds.run}); the runner stopped at ${rs.map(r => r.stoppedAt).join('/')} s, killed after stopping ${rs.map(r => r.killed).join('/')}; then ${[...new Set(rs.map(r => r.after))].slice(0, 4).join(' | ')}`, data: rs };
});

add('PR18 the same scene, satiated against starving: it senses the same (first sighting at the same moment, the same record) and decides differently - leaving against hunting', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const one = h => { const { w, p, e } = hall(seed + 2500, { hunger: h, pa: Math.PI }); let first = -1, rec0 = null; const T = trace(w, e, p);
      w.run(12, (ww, t) => { if (first < 0 && e.seenNow.has(p.id)) { first = +t.toFixed(3); const r = e.mem.p.get(p.id); rec0 = [r.lkx, r.lky, r.lvx, r.lvy, +r.dist.toFixed(1)].map(v => Math.round(v * 10)).join(','); } T.take(t); return true; });
      return { first, rec0, plans: plansOf(T).filter(k => k !== 'roam'), hunted: e.tally.hunt };
    };
    const a = one(.1), b = one(.95);
    return { ok: a.first >= 0 && a.first === b.first && a.rec0 === b.rec0 && a.hunted === 0 && b.hunted > 0 && a.plans[0] === 'leave', first: a.first, same: a.rec0 === b.rec0, sat: a.plans.join('>'), starving: b.plans.join('>') };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/6: first sighting at ${rs.map(r => r.first).join('/')} s in both, the same record ${rs.filter(r => r.same).length}/6; satiated ${[...new Set(rs.map(r => r.sat))].join(' | ')}; starving ${[...new Set(rs.map(r => r.starving))].slice(0, 3).join(' | ')}`, data: rs };
});

add('PR19 watched all the time, very hungry (.75): it changes tactic (round them, the bait, coming on) instead of leaving at once; exhausted, backing off or leaving is still its rational answer', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, p, e } = hall(seed + 2600, { hunger: .75, watch: true }); const T = trace(w, e, p);
    w.run(40, (ww, t) => { T.take(t); return true; });
    const kinds = new Set(T.map(s => s.plan).filter(k => ['flank', 'retreat', 'lure', 'approach', 'watch'].includes(k))), first = plansOf(T).filter(k => k !== 'roam')[0];
    return { ok: first !== 'leave' && kinds.size >= 2, first, kinds: [...kinds].join('+'), flanks: e.tally.flank, killed: w.kills.length };
  });
  const tired = over([1, 2, 3, 4], seed => {
    const { w, p, e } = hall(seed + 2650, { hunger: .75, watch: true, stam: 4 }); const T = trace(w, e, p);
    w.run(8, (ww, t) => { T.take(t); return true; });
    const first = plansOf(T).filter(k => k !== 'roam')[0];
    return { ok: ['leave', 'retreat', 'watch'].includes(first) && !T.some(s => ['approach', 'flank', 'chase'].includes(s.plan)), first };
  });
  return { ok: rate(rs) >= 7 / 8 && rate(tired) === 1, note: `watched: ${rs.filter(r => r.ok).length}/8 tried more than one way (${[...new Set(rs.map(r => r.kinds))].join(' | ')}; first ${rs.map(r => r.first).join('/')}; flanks ${rs.map(r => r.flanks).join('/')}; killed ${rs.reduce((a, r) => a + r.killed, 0)}) | exhausted: ${tired.map(r => r.first).join('/')}`, data: { rs, tired } };
});

add('PR20 a failed chase, then a reacquisition only on new evidence: a runner who escapes and later stops in its view is hunted again; one who escapes out of sight and stays silent is let go - nobody is pinned', () => {
  // back: the runner stops at the hall's end, in the open, facing on.  gone: from the hall's end they run on round the corner and down the
  // south passage; once out of its sight (or at the passage's foot) torch off, crouched (quiet) west into the dark, and still
  const run = (seed, hide) => {
    const w = World(seed + 2700), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .85 }); e.tier = 'near'; e.ang = 0;
    p.go(8600, y, 'run'); const T = trace(w, e, p);
    let lostAt = -1, reAt = -1, stopAt = -1, lastSeen = 0, ph = 0, end1 = null, killAt = -1, had = false;
    w.run(60, (ww, t) => {
      if (lostAt < 0 && e.tally.chaseLost) lostAt = t;
      if (e.seenNow.has(p.id)) lastSeen = t;
      if (killAt < 0 && w.kills.length) killAt = t;
      if (stopAt < 0 && p.tx === null) stopAt = t;
      if (hide) {
        if (ph === 0 && p.tx === null) { ph = 1; p.look = null; p.route([{ x: 8560, y: 4220 }, { x: 8070, y: 4300 }, { x: 8070, y: 4900 }], 'run'); }
        if (ph === 1 && (t - lastSeen > .5 || (p.path && !p.path.length))) { ph = 2; p.light = false; p.route([{ x: 8070, y: 4900 }, { x: 7500, y: 4950 }], 'crouch'); }
        if (ph === 2 && p.path && !p.path.length) { ph = 3; p.stop('crouch'); }
      } else if (lostAt >= 0 && reAt < 0 && stopAt >= 0 && e.seenNow.has(p.id) && ['approach', 'flank', 'chase'].includes(planOf(e))) reAt = t;
      if (lostAt >= 0 && e.hunt && e.hunt.pid === p.id) had = true;
      if (had && !end1 && !(e.hunt && e.hunt.pid === p.id)) end1 = { why: (e.dbg.huntEnd || {}).why || '', t: +t.toFixed(1) };   // the hunt after the lost race: how it ended
      T.take(t); return true; });
    return { lostAt: +lostAt.toFixed(1), stopAt: +stopAt.toFixed(1), reAt: +reAt.toFixed(1), killed: w.kills.length, killAt: +killAt.toFixed(1), end: end1 ? end1.why : '', endAt: end1 ? end1.t : -1, lastSeen: +lastSeen.toFixed(1), plans: plansOf(T.filter(s => s.t > lostAt)).join('>') };
  };
  const back = over([1, 2, 3, 4, 5, 6], s => run(s, false)), gone = over([1, 2, 3, 4, 5, 6, 7, 8], s => run(s, true));
  const okBack = back.filter(r => r.lostAt >= 0 && (r.reAt >= 0 || r.killed)).length;
  // let go: the hunt that outlived the race ends for want of evidence, with nobody caught during it (a chance meeting later, while it
  // roams, is a new encounter on new evidence - reported, allowed)
  const okGone = gone.filter(r => r.lostAt >= 0 && /no sign|cold|guessed wrong|searched|gives up/.test(r.end) && !(r.killAt >= 0 && r.killAt <= r.endAt)).length;
  return { ok: okBack >= 5 && okGone >= 7, note: `stopped in view: hunted again ${okBack}/6 (stopped at ${back.map(r => r.stopAt).join('/')} s, hunted on sight at ${back.map(r => r.reAt).join('/')} s; killed ${back.map(r => r.killed).join('/')}) | out of sight, silent: let go ${okGone}/8 at ${gone.map(r => r.endAt).join('/')} s (${[...new Set(gone.map(r => '"' + r.end + '"'))].join(', ')}); met again later while roaming and killed ${gone.map(r => r.killed).join('/')}`, data: { back, gone } };
});

/* ---------------------------------------------------------------- R2: listening, belief, guesses */
/* the dark south-west (wall A x 976..1072 with a gap at y 5300..5460; wall B y 5018..5066; wall C x 1552..1648 with a gap at y
 * 5498..5642): a person with a torch at (1300, 5600) walks north past wall C's gap, where a hungry one at (2100, 5560), 800 px east, sees
 * them at once; past y 5440 the torch goes off; at (1300, 5150), just short of wall B, their way parts (WAYS[way], at `mode`); at its end
 * they crouch, still.  o.on(t, p, e, R) adds a scene's own moves.  Ten times a second the trace keeps where it is and what plan it has,
 * next to everything it has sensed (its sight of them, its record, every sound and lead it holds, its level of detail): the evidence. */
const WAYS = { east: [{ x: 1720, y: 4900 }], back: [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }],
  north: [{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], northEast: [{ x: 1250, y: 4870 }, { x: 2080, y: 4870 }] };
function sw(seed, h, way, mode, T, o = {}) {
  const w = World(seed + 3000); bystander(w, 8400, 900);
  const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  const R = { tr: [], parted: 1e9, partedT: -1, lostAt: -1, guesses: [], killT: -1, firstSeen: -1, maxTries: 0, heardBeforeLoss: 0 };
  let lastP = null;
  w.run(T, (ww, t) => {
    if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; R.parted = R.tr.length; R.partedT = +t.toFixed(2); p.route((o.ways || WAYS)[way], mode); }
    if (p.going === 2 && p.path && !p.path.length) { p.going = 3; if (o.then) o.then(p); else p.stop('crouch'); }
    if (p.light && p.y < 5440) p.light = false;
    if (o.on) o.on(t, p, e, R);
    const r = e.mem.p.get(p.id), H = e.hunt, P = e.plan, seen = e.seenNow.has(p.id);
    if (seen && R.firstSeen < 0) R.firstSeen = t;
    if (R.lostAt < 0 && H && !seen) R.lostAt = +t.toFixed(2);
    if (H) { R.maxTries = Math.max(R.maxTries, H.tries); R.had = 1; } else if (R.had === 1 && e.dbg.huntEnd) { R.had = 2; R.firstEnd = { why: e.dbg.huntEnd.why, at: +t.toFixed(1) }; }   // (its first hunt, and how that ended)
    const ev = [seen ? 1 : 0, r ? [r.heardAt, r.seenAt, r.hx, r.hy, r.lkx, r.lky, r.lvx, r.lvy].map(v => Math.round(v * 10)).join(':') : '-',
      e.mem.sounds.map(q => `${q.id}:${Math.round(q.x)}:${Math.round(q.y)}`).join(';'), e.mem.leads.map(q => `${q.id}:${Math.round(q.x)}:${Math.round(q.y)}`).join(';'), e.tier].join('|');
    R.tr.push([Math.round(e.x * 10), Math.round(e.y * 10), ev, P ? P.k : '-'].join(','));
    if (P && P !== lastP && (P.k === 'intercept' || P.k === 'search')) {
      const g = P.k === 'intercept' ? { x: P.g.qx, y: P.g.qy } : P.goal;
      R.guesses.push({ t: +t.toFixed(1), k: P.k, x: Math.round(g.x), y: Math.round(g.y), lead: P.k === 'intercept' ? P.g.lead : null, why: e.dbg.why, guess: e.dbg.guess ? e.dbg.guess.k : '', heard: e.tally.heardQ, conf: H ? +H.conf.toFixed(2) : 0 });
    }
    if (P && lastP && P.k !== lastP.k && lastP.k === 'intercept' && R.guesses.length) R.guesses[R.guesses.length - 1].after = { k: P.k, why: e.dbg.why, conf: H ? +H.conf.toFixed(2) : 0 };
    lastP = P;
    if (R.killT < 0 && w.kills.length) R.killT = +t.toFixed(1);
    return true;
  });
  Object.assign(R, { e, p, w, end: e.dbg.huntEnd ? { why: e.dbg.huntEnd.why, at: +(e.dbg.huntEnd.at - 60).toFixed(1) } : null, tally: e.tally });
  return R;
}
/* the evidence law between two runs of one seed: the same position and plan at every tick until either one's evidence differs.  The tick
 * the evidence first differed, or -1 if what it did differed first */
function sameUntilSensed(A, B) {
  const n = Math.min(A.tr.length, B.tr.length);
  for (let i = 0; i < n; i++) { const a = A.tr[i].split(','), b = B.tr[i].split(','); if (a[2] !== b[2]) return i; if (a[0] !== b[0] || a[1] !== b[1] || a[3] !== b[3]) return -1; }
  return n;
}
const lawOk = (A, B) => { const i = sameUntilSensed(A, B); return i >= 0 && i >= Math.min(A.parted, B.parted); };

add('PR08 seen once walking north, then out of sight: it guesses a way on through the level, ahead of where it saw them; where they really went (unsensed) changes nothing it does until it senses a difference', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    // its first guess: on open floor, and either an interception at least 200 px ahead along the way it predicts them to walk (the route
    // may turn back on itself round a wall), or a look at least 150 px on, northward, from where it last saw them
    const A = sw(seed, .8, 'east', 'crouch', 14), B = sw(seed, .8, 'back', 'crouch', 14), g = A.guesses[0];
    const fwd = g ? -(g.y - 5430) / Math.max(1, Math.hypot(g.x - 1300, g.y - 5430)) : -1, dd = g ? Math.round(Math.hypot(g.x - 1300, g.y - 5430)) : 0;
    const on = !!g && (g.k === 'intercept' ? g.lead >= 200 : dd >= 150 && fwd >= .3);
    return { law: lawOk(A, B), diverged: sameUntilSensed(A, B), parted: Math.min(A.parted, B.parted), g, ok: !!g && A.w.eng.geo.clear(g.x, g.y, 24, 'walk') && on, fwd: +fwd.toFixed(2), dd };
  });
  const guessed = rs.filter(r => r.g);
  return { ok: rs.every(r => r.law) && guessed.length >= 6 && guessed.filter(r => r.ok).length === guessed.length,
    note: `the same until it sensed a difference: ${rs.filter(r => r.law).length}/8 (ticks ${rs.map(r => r.diverged + '/' + r.parted).join(' ')}, evidence first differing / the ways parting) | first guess ${guessed.map(r => r.g.k + ' (' + r.g.x + ', ' + r.g.y + ')').join(', ')}: on open floor and ahead (an interception 200 px or more along its predicted way: ${guessed.filter(r => r.g.k === 'intercept').map(r => r.g.lead).join('/')} px; a look 150 px or more on) ${guessed.filter(r => r.ok).length}/${guessed.length}`, data: rs.map(r => ({ law: r.law, g: r.g, fwd: r.fwd, dd: r.dd })) };
});

add('PR09 the fork at wall B: its first guess (east round wall B, or north-west) is the same whichever way they really take, and differs between seeds - so it is sometimes wrong either way', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], seed => {
    const A = sw(seed, .8, 'east', 'walk', 5), B = sw(seed, .8, 'back', 'walk', 5), a = A.guesses[0], b = B.guesses[0];
    return { a, b, same: !!a && !!b && a.x === b.x && a.y === b.y && a.t === b.t, east: a ? a.x > 1450 : null };
  });
  const g = rs.filter(r => r.a), east = g.filter(r => r.east).length;
  return { ok: g.length >= 9 && g.every(r => r.same) && east >= 1 && east <= g.length - 1,
    note: `${g.length}/12 guessed at once; the same guess whichever way they went ${g.filter(r => r.same).length}/${g.length}; east ${east}, other ${g.length - east} - wrong for somebody going east in ${g.length - east}, for somebody doubling back in all ${g.length} (${g.map(r => r.a.x + ',' + r.a.y).join(' ')})`, data: rs };
});

add('PR10 a wrong interception with nothing more to go on: it remembers the place, its confidence falls, its next guesses go elsewhere, and the hunt ends for that reason - never the same empty corner again', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], seed => {
    const R = sw(seed, .8, 'back', 'crouch', 60), G = R.guesses, iw = G.findIndex(q => q.after && /guessed wrong/.test(q.after.why));
    const later = iw < 0 ? [] : G.slice(iw + 1), repeat = later.some(q => G.slice(0, G.indexOf(q)).some(f => Math.hypot(f.x - q.x, f.y - q.y) < 150));
    return { judged: iw >= 0, repeat, confBefore: iw >= 0 ? G[iw].conf : -1, confAfter: iw >= 0 ? G[iw].after.conf : -1, n: G.length, tries: R.maxTries, end: R.end ? R.end.why : '-', endAt: R.end ? R.end.at : -1, killed: R.w.kills.length, hunting: !!R.e.hunt, heard: R.tally.heardQ };
  });
  const j = rs.filter(r => r.judged), ok = j.filter(r => !r.repeat && r.confAfter < r.confBefore && !r.hunting && r.tries <= 4 && (r.killed || /gives up/.test(r.end)));
  return { ok: j.length >= 5 && ok.length === j.length,
    note: `${j.length}/12 guessed wrong with nothing heard after (${j.map(r => r.heard).join('/')} sounds taken for theirs): no place guessed twice ${j.filter(r => !r.repeat).length}/${j.length}, confidence ${j.map(r => r.confBefore + '>' + r.confAfter).join(' ')}, guesses ${j.map(r => r.n).join('/')}, the hunt over at ${j.map(r => r.endAt).join('/')} s (${[...new Set(j.map(r => '"' + r.end + '"'))].join(', ')}); killed ${j.reduce((a, r) => a + r.killed, 0)}`, data: rs };
});

add('PR11 doubling back: footsteps it really hears on the other way turn its guess toward them; the same doubling back made silently turns nothing - and the two runs are the same creature until the first sound', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const L = sw(seed, .8, 'back', 'run', 30), Q = sw(seed, .8, 'back', 'crouch', 30);
    const turned = L.guesses.some(q => q.heard > 0 && q.x < 1250) || L.tally.revise > 0;
    return { law: lawOk(L, Q), heard: L.tally.heardQ, revise: L.tally.revise, turned, qHeard: Q.tally.heardQ, qRevise: Q.tally.revise, killed: L.w.kills.length + '/' + Q.w.kills.length, lg: L.guesses.map(q => q.k + '@' + q.x + ',' + q.y).join(' '), qg: Q.guesses.map(q => q.k + '@' + q.x + ',' + q.y).join(' ') };
  });
  const heard = rs.filter(r => r.heard > 0);
  return { ok: rs.every(r => r.law) && heard.length >= 5 && heard.filter(r => r.turned).length >= 4 && rs.every(r => r.qHeard === 0 && r.qRevise === 0),
    note: `the same until a sound differed: ${rs.filter(r => r.law).length}/8 | running back: heard and took for theirs in ${heard.length}/8 (${rs.map(r => r.heard).join('/')} sounds), turned its guess toward them in ${heard.filter(r => r.turned).length} (revisions ${rs.map(r => r.revise).join('/')}) | crouching back: sounds taken ${rs.map(r => r.qHeard).join('/')}, revisions ${rs.map(r => r.qRevise).join('/')}; killed ${rs.map(r => r.killed).join(' ')}`, data: rs };
});

add('PR12 footsteps behind a wall, nobody seen: it stops, turns to the sound and listens, then goes quietly to look - and nobody is named: no record, no plan about a person, until it sees them', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 3200);
    const p = w.player(780, 4950, { light: false, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1300, 5180, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
    const R = { heard: 0, listen: 0, look: 0, named: 0, seenAt: -1, ks: [] };
    w.run(16, (ww, t) => {
      if (t > 1 && !p.going) { p.going = 1; p.route([{ x: 780, y: 5300 }, { x: 600, y: 5900 }], 'run'); }
      if (e.seenNow.has(p.id) && R.seenAt < 0) R.seenAt = t;
      if (R.seenAt < 0) {
        if (e.mem.sounds.length) R.heard = e.mem.sounds.length;
        if (e.mem.p.has(p.id) || (e.plan && e.plan.pid === p.id) || (e.hunt && e.hunt.pid === p.id)) R.named++;   // a name before a sighting: never
        const P = e.plan; if (P && (!R.ks.length || R.ks[R.ks.length - 1] !== P.k)) R.ks.push(P.k);
        if (P && P.k === 'listen' && P.curious) R.listen = 1; if (P && P.k === 'search' && !P.pid && R.listen) R.look = 1;
      }
      return true; });
    return R;
  });
  const h = rs.filter(r => r.heard);
  return { ok: rs.every(r => r.named === 0) && h.length >= 5 && h.filter(r => r.listen).length >= 5 && h.filter(r => r.look).length >= 4,
    note: `heard footsteps before seeing anybody in ${h.length}/8: it stopped and listened ${h.filter(r => r.listen).length}, then went to look ${h.filter(r => r.look).length} (${[...new Set(h.map(r => r.ks.join('>')))].join(' | ')}); a person named before it saw them: ${rs.reduce((a, r) => a + r.named, 0)} ticks; saw them at ${rs.map(r => r.seenAt < 0 ? '-' : r.seenAt.toFixed(1)).join('/')} s`, data: rs };
});

add('PR13 a silent croucher in the dark beyond its sight escapes its guesses: two hiding places it never senses (either end of the north passage, off the way it saw them going) give the same creature, and in both it gives up for a stated reason', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const A = sw(seed, .95, 'north', 'crouch', 70), B = sw(seed, .95, 'northEast', 'crouch', 70);
    // its first hunt of them (begun on the sighting) ends for want of evidence, nobody caught during it; a later chance meeting while it
    // roams is a new encounter on new evidence (reported).  Runs where it never saw them are not judged
    const gave = R => !!R.firstEnd && /gives up/.test(R.firstEnd.why) && !(R.killT >= 0 && R.killT <= R.firstEnd.at);
    return { judged: A.lostAt >= 0 && B.lostAt >= 0, law: lawOk(A, B), a: gave(A), b: gave(B), why: [A.firstEnd ? A.firstEnd.why : '-', B.firstEnd ? B.firstEnd.why : '-'], at: [A.firstEnd ? A.firstEnd.at : -1, B.firstEnd ? B.firstEnd.at : -1], killed: [A.w.kills.length, B.w.kills.length], heard: [A.tally.heardQ, B.tally.heardQ] };
  });
  const j = rs.filter(r => r.judged);
  return { ok: rs.every(r => r.law) && j.length >= 6 && j.filter(r => r.a).length >= j.length - 1 && j.filter(r => r.b).length >= j.length - 1,
    note: `the same until it sensed a difference: ${rs.filter(r => r.law).length}/8 | ${j.length}/8 hunted them; gave up: the north passage's west end ${j.filter(r => r.a).length}/${j.length}, its east end ${j.filter(r => r.b).length}/${j.length}, at ${j.map(r => r.at.join('|')).join(' ')} s (${[...new Set(j.flatMap(r => r.why).map(w => '"' + w + '"'))].slice(0, 4).join(', ')}); killed in the run (in that hunt, or met again later) ${j.map(r => r.killed.join('|')).join(' ')}; sounds taken ${j.map(r => r.heard.join('|')).join(' ')}`, data: rs };
});

add('PR14 a misleading sound: they run on east (it hears it), then crouch back west in silence - it follows what it heard and can be fooled; it does not always find the one who doubled back', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const R = sw(seed, .9, 'feint', 'run', 60, { ways: Object.assign({ feint: [{ x: 1480, y: 5120 }] }, WAYS), then: p => { p.going = 4; p.route(WAYS.back, 'crouch'); }, on: (t, p) => { if (p.going === 4 && p.path && !p.path.length) { p.going = 5; p.stop('crouch'); } } });
    const fooled = !R.w.kills.length && R.end && /gives up/.test(R.end.why), east = R.guesses.filter(q => q.heard > 0 && q.x > 1350).length;
    return { fooled, heard: R.tally.heardQ, east, killed: R.w.kills.length, end: R.end ? R.end.why : '-', at: R.end ? R.end.at : -1, g: R.guesses.map(q => q.k + '@' + q.x + ',' + q.y).join(' ') };
  });
  const f = rs.filter(r => r.fooled).length, k = rs.filter(r => r.killed).length;
  return { ok: rs.filter(r => r.heard > 0).length >= 5 && f >= 3 && k < 8,
    note: `took the running for theirs in ${rs.filter(r => r.heard > 0).length}/8 (guessed east after hearing in ${rs.filter(r => r.east > 0).length}) | fooled (gave up, nobody caught) ${f}/8, found the one who doubled back ${k}/8 (${[...new Set(rs.map(r => '"' + r.end + '"'))].slice(0, 3).join(', ')})`, data: rs };
});

add('PR15 a run of footsteps it hears out of sight keeps its belief near them (closer than with silence); with nothing heard its belief only carries on from the last sighting - silent steps and old sounds steer nothing', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const err = (mode) => { let sum = 0, n = 0, listen = 0; const R = sw(seed, .8, 'east', mode, 14, { on: (t, p, e) => {
      const H = e.hunt; if (H && H.pid === p.id && !e.seenNow.has(p.id) && p.going >= 2) { sum += Math.hypot(H.x - p.x, H.y - p.y); n++; }   // (H.x, H.y: the place its evidence puts them)
      if (e.plan && e.plan.k === 'listen') listen = 1; } });
      return { mean: n ? Math.round(sum / n) : -1, n, heard: R.tally.heardQ, killed: R.w.kills.length, listen }; };
    return { run: err('run'), quiet: err('crouch') };
  });
  const both = rs.filter(r => r.run.n > 20 && r.quiet.n > 20), closer = both.filter(r => r.run.mean < r.quiet.mean);
  return { ok: both.length >= 5 && closer.length >= Math.ceil(both.length * .7) && rs.every(r => r.quiet.heard === 0) && rs.filter(r => r.run.heard >= 2).length >= 5,
    note: `sounds taken for theirs: running ${rs.map(r => r.run.heard).join('/')}, crouching ${rs.map(r => r.quiet.heard).join('/')} | its belief's mean distance from them while unseen: running ${both.map(r => r.run.mean).join('/')} px, crouching ${both.map(r => r.quiet.mean).join('/')} px - closer with the sounds in ${closer.length}/${both.length}`, data: rs };
});

add('PR16 a sound that no person made (a thud in the dark): it listens and goes to look, the look ends by itself, and nobody is invented - no record, no hunt, no strike', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 3600), far = w.player(600, 3900, { light: false }); far.stop('crouch');   // somebody 1700 px off, behind walls, still (the creature stays fully awake)
    const e = w.eng.spawn('skinstealer', 1500, 5300, { hunger: .7 }); e.tier = 'near';
    const R = { listen: -1, look: -1, lookEnd: -1, recs: 0, hunts: 0, strikes: 0, n: 0 }; let P0 = null;
    w.run(30, (ww, t) => {
      if ((R.n === 0 && t >= 2) || (R.n === 1 && t >= 2.8)) { R.n++; w.eng.sound({ x: 1100 + R.n * 20, y: 5650, r: 1100, I: .8, type: 'thud', src: -1 }); }   // (twice, the same place: a door banging)
      const P = e.plan;
      if (P && P.k === 'listen' && P.curious && R.listen < 0 && t > 2) R.listen = +t.toFixed(1);
      if (P && P.k === 'search' && !P.pid && R.look < 0 && t > 2) { R.look = +t.toFixed(1); P0 = P; }
      if (P0 && e.plan !== P0 && R.lookEnd < 0) R.lookEnd = +t.toFixed(1);
      R.recs = Math.max(R.recs, [...e.mem.p.keys()].filter(id => id !== far.id).length); if (e.hunt) R.hunts++; if (e.pounce) R.strikes++;
      return true; });
    R.dur = R.lookEnd > 0 ? +(R.lookEnd - R.look).toFixed(1) : -1; return R;
  });
  const went = rs.filter(r => r.listen > 0 && r.look > 0);
  return { ok: went.length >= 4 && went.every(r => r.dur > 0 && r.dur <= AI.SK.searchMax + AI.SK.searchLook[1] + .5) && rs.every(r => r.recs === 0 && r.hunts === 0 && r.strikes === 0),
    note: `listened ${rs.filter(r => r.listen > 0).length}/6, went to look ${went.length}/6 (looks over in ${went.map(r => r.dur).join('/')} s) | records of a person 0, hunts 0, strikes 0: ${rs.every(r => r.recs === 0 && r.hunts === 0 && r.strikes === 0)}`, data: rs };
});

/* ---------------------------------------------------------------- R3: stalking, going round, coming on, the tells */
add('PR06 watched while hungry (.7) in the lit hall: when it goes round them it moves under cover to a spot at their side they cannot see - reached by a real route on open floor, never through a wall', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, p, e } = hall(seed + 3800, { hunger: .7, watch: true }), g = w.eng.geo;
    // a flank ends when it is out of their sight (it comes at them from there: R1), at its spot, or when it thinks again; what counts is
    // where it is then - out of their sight, from where they really stand
    const R = { flanks: 0, ended: 0, hidden: 0, inWall: 0, jump: 0, seenShare: 0, n: 0, spotHidden: 0 }; let F = null, px = e.x, py = e.y;
    w.run(25, (ww, t) => {
      const P = e.plan;
      if (F && P !== F) { R.ended++; if (!g.los(p.x, p.y, e.x, e.y)) R.hidden++; F = null; }
      if (P && P.k === 'flank') {
        if (P !== F) { F = P; R.flanks++; if (!g.los(p.x, p.y, P.spot.x, P.spot.y)) R.spotHidden++; }
        R.n++; if (g.los(p.x, p.y, e.x, e.y)) R.seenShare++;
        if (P.arrived && !P.counted) { P.counted = 1; R.ended++; if (!g.los(p.x, p.y, e.x, e.y)) R.hidden++; F = null; }
      }
      if (!g.clear(e.x, e.y, e.rc - 6, 'walk')) R.inWall++;
      if (!e.trav && !e.pounce && Math.hypot(e.x - px, e.y - py) > AI.SKIN.speeds.run * DT * 1.5 + 2) R.jump++;
      px = e.x; py = e.y; return true; });
    R.seenShare = R.n ? +(R.seenShare / R.n).toFixed(2) : -1; R.killed = w.kills.length; return R;
  });
  const fl = rs.filter(r => r.flanks), n = fl.reduce((a, r) => a + r.flanks, 0), end = fl.reduce((a, r) => a + r.ended, 0), hid = fl.reduce((a, r) => a + r.hidden, 0), sh = fl.reduce((a, r) => a + r.spotHidden, 0);
  return { ok: fl.length >= 4 && sh === n && end >= 4 && hid >= Math.ceil(end * .8) && rs.every(r => r.inWall === 0 && r.jump === 0),
    note: `went round them in ${fl.length}/8 (${rs.map(r => r.flanks).join('/')} flanks), every spot out of their sight ${sh}/${n}; the flank over with it out of their sight ${hid}/${end}; in their sight on the way ${fl.map(r => r.seenShare).join('/')} of the flank's time (it starts in the open); inside a wall ${rs.reduce((a, r) => a + r.inWall, 0)} ticks, jumps ${rs.reduce((a, r) => a + r.jump, 0)}; killed ${rs.reduce((a, r) => a + r.killed, 0)}`, data: rs };
});

add('PR07 the narrow north corridor, no way round the watcher: a very hungry one (.8) comes on openly while watched - and every spring shows its wind-up to the watcher first, so one who breaks away at the tell gets away from that spring', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 3700); bystander(w, 1200, 4500);
    const p = w.player(1170, 4400, { light: true, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1170, 4780, { hunger: .8 }); e.tier = 'near'; e.ang = -Math.PI / 2;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    const R = { open: -1, strikes: [], flank: 0 }; let S = null;
    w.run(30, (ww, t) => {
      const P = e.plan; if (P && P.k === 'flank') R.flank++;
      if (R.open < 0 && P && P.k === 'approach' && e.dbg.decide && e.dbg.decide.watched) R.open = +t.toFixed(1);
      if (e.pounce && e.pounce !== S) { S = e.pounce; S.need = S.wind; const off = Math.abs(Math.atan2(e.y - p.y, e.x - p.x) - p.angle); R.strikes.push({ t: +t.toFixed(2), style: S.style, need: S.wind, watching: !p.fled, facing: +Math.min(off, Math.PI * 2 - off).toFixed(2), los: w.eng.geo.los(p.x, p.y, e.x, e.y), wind: 0, hit: false });
        if (!p.fled) { p.fled = 1; p.look = null; p.route([{ x: p.x, y: 4200 }, { x: 700, y: 4250 }, { x: 700, y: 3500 }, { x: 2600, y: 3500 }], 'run'); } }   // the tell: they break away, up and out of the corridor, and run on
      if (S && e.pounce === S && S.t < S.wind) R.strikes[R.strikes.length - 1].wind = +S.t.toFixed(2);
      if (S && e.tally.hit && !R.strikes[R.strikes.length - 1].hit && e.pounce !== S) R.strikes[R.strikes.length - 1].hit = true;
      if (p.fled && R.stopAt === undefined && p.path && !p.path.length) R.stopAt = +t.toFixed(1);
      if (R.killAt === undefined && w.kills.length) R.killAt = +t.toFixed(1);
      return true; });
    R.first = R.strikes[0] || null; R.killed = w.kills.length; R.noFlank = e.tally.noFlank; R.whileRunning = R.killed && (R.stopAt === undefined || R.killAt < R.stopAt); return R;
  });
  // (the springs at a watcher: in their sight, facing it, the whole wind-up first; every later spring - at somebody running off - with its
  // whole wind-up too.  What happens to them after the first spring - it may give chase - is reported, not judged here: PR05 / PR21)
  const op = rs.filter(r => r.open >= 0), st = rs.flatMap(r => r.strikes), atW = st.filter(q => q.watching), shown = atW.filter(q => q.los && q.facing < .6 && q.wind >= q.need - .02);
  const full = st.filter(q => q.wind >= (q.style === 'grab' ? AI.SK.grabWind : AI.SK.pounceWind) - .02), esc = rs.filter(r => r.first && !r.first.hit);
  return { ok: op.length >= 5 && rs.every(r => r.flank === 0) && atW.length >= 5 && shown.length === atW.length && full.length === st.length && esc.length >= Math.ceil(rs.filter(r => r.first).length * .6),
    note: `no way round them (none found ${rs.map(r => r.noFlank).join('/')}; flanks 0): came on openly while watched in ${op.length}/8 (from ${op.map(r => r.open).join('/')} s) | springs at the watcher ${atW.length}, each in their sight with its whole wind-up shown first ${shown.length}/${atW.length}; every spring with its whole wind-up ${full.length}/${st.length} | broke away at the first tell and got away from it ${esc.length}/${rs.filter(r => r.first).length}; caught later while still running ${rs.filter(r => r.whileRunning).length}/8, after their run ended ${rs.filter(r => r.killed && !r.whileRunning).length}/8`, data: rs };
});

add('PR17 one person with a torch, seen, then out of sight: the phases show - listening (still, its head turning) is not approaching (moving, crouched) - and what the page is sent (state, act, head) is what it is doing, without flicker', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const R = { listen: 0, listenOk: 0, appr: 0, apprOk: 0, mism: 0, flick: 0, head: 0, moveInListen: 0 }; let lastAc = -1, lastT = 0;
    sw(seed, .8, 'back', 'crouch', 24, { on: (t, p, e) => {
      const sn = AI.SKIN.snap(e), P = e.plan;
      if (sn.ac !== AI.KACT[e.act] || sn.s !== AI.SCODE[e.state] || Math.abs(sn.h - (e.head || 0)) > .006) R.mism++;
      if (sn.ac !== lastAc) { if (t - lastT < .1 && lastAc !== -1 && !e.pounce && !e.recover) R.flick++; lastAc = sn.ac; lastT = t; }
      if (P && P.k === 'listen' && t - (P.seenT ?? (P.seenT = t)) > .3) { R.listen++; if (e.act === 'listen') R.listenOk++; if (e.speed > 5) R.moveInListen++; if (Math.abs(e.head || 0) > .1) R.head++; }   // (after 0.3 s: it stops from a walk, it does not teleport to a halt)
      if (P && P.k === 'approach' && !e.pounce && !e.recover && e.act !== 'look') { R.appr++; if (e.act === 'approach' || e.act === 'creep') R.apprOk++; }
    } });
    return R;
  });
  const both = rs.filter(r => r.listen > 10 && r.appr > 10);
  return { ok: both.length >= 5 && rs.every(r => r.mism === 0 && r.listenOk === r.listen && r.apprOk === r.appr && r.moveInListen === 0 && r.flick <= 2) && both.every(r => r.head > r.listen * .5),
    note: `both phases in ${both.length}/8: listening ${rs.map(r => r.listen).join('/')} ticks (act listen ${rs.every(r => r.listenOk === r.listen)}, still ${rs.every(r => r.moveInListen === 0)}, head turned ${both.map(r => Math.round(100 * r.head / r.listen) + '%').join('/')}), approaching ${rs.map(r => r.appr).join('/')} ticks (act approach or creep ${rs.every(r => r.apprOk === r.appr)}) | the page's state / act / head equal to what it does: mismatches ${rs.reduce((a, r) => a + r.mism, 0)}; an act shown under 0.1 s ${rs.map(r => r.flick).join('/')}`, data: rs };
});

add('PR21 fair strikes: every spring in these hunts is shown first (a wind-up from where it is, in the open), every kill is body against body with nothing solid between - none through a wall, none without a tell; those who break away at the tell survive that spring more often than not', () => {
  const scenes = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const dodge of [true, false]) scenes.push({ seed, dodge });
  const rs = scenes.map(({ seed, dodge }) => {
    const { w, p, e } = hall(seed + 3900, { hunger: .95, watch: true }), g = w.eng.geo;
    const R = { dodge, strikes: [], kills: [] }; let S = null, hits = 0;
    w.run(30, (ww, t) => {
      if (e.pounce && e.pounce !== S) { S = e.pounce; R.strikes.push({ style: S.style, wind: 0, need: S.wind, hit: false });
        if (dodge && !p.fled) { p.fled = 1; p.look = null; const sx = p.x - Math.sign(e.x - p.x || 1) * 60; p.route([{ x: sx, y: p.y - 140 }, { x: sx - 900, y: p.y - 140 }], 'run'); } }
      if (S && e.pounce === S) R.strikes[R.strikes.length - 1].wind = Math.max(R.strikes[R.strikes.length - 1].wind, +Math.min(S.t, S.wind).toFixed(3));
      if (e.tally.hit > hits) { hits = e.tally.hit; const q = R.strikes[R.strikes.length - 1]; if (q) q.hit = true;
        R.kills.push({ d: +Math.hypot(p.x - e.x, p.y - e.y).toFixed(1), lim: e.r + 20, clear: g.lineClear(e.x, e.y, p.x, p.y, 3, 'walk'), wind: q ? q.wind : -1, need: q ? q.need : -1 }); }
      return true; });
    return R;
  });
  const st = rs.flatMap(r => r.strikes), told = st.filter(q => q.wind >= q.need - .02), ks = rs.flatMap(r => r.kills), fair = ks.filter(k => k.clear && k.d <= k.lim && k.wind >= k.need - .02);   // (contact: within its body's reach of theirs, e.r + 18, at the hit)
  const dFirst = rs.filter(r => r.dodge && r.strikes.length), dEsc = dFirst.filter(r => !r.strikes[0].hit);
  return { ok: st.length >= 6 && told.length === st.length && ks.length >= 3 && fair.length === ks.length && dEsc.length > dFirst.length / 2,
    note: `${st.length} springs, each with its full wind-up first ${told.length}/${st.length} | ${ks.length} kills, body against body (${ks.map(k => k.d).join('/')} px) with a clear line ${fair.length}/${ks.length} | broke away at the tell and survived that spring ${dEsc.length}/${dFirst.length}; stood watching and survived it ${rs.filter(r => !r.dodge && r.strikes.length && !r.strikes[0].hit).length}/${rs.filter(r => !r.dodge && r.strikes.length).length}`, data: rs };
});

module.exports = S;
