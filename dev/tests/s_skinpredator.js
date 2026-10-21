/* SKIN-STEALER predator refinement scenarios (dev/trial-3-predator-refinement/; Trial 3 is not owner-approved).  Each runs the real server
 * simulation (sim.js + ai.js as built, players moved by the game's own move.js through the harness) over several seeds.  No scenario sets
 * a decision of the creature: they place people, give it a hunger (its spawn option) and, where a scenario says so, its stamina (its body,
 * as a hunger is), move people as players would, and read what it did.  Every scenario that says it perceived something says how: SEEN
 * (e.seenNow), HEARD (a sound it really received: anonymous unless the engine named it), REMEMBERED (its record), GUESSED (its own belief or
 * prediction).  The people's scripts may read where the creature really is (a player's own sight of it); the creature never reads them.
 * R1: PR01-PR05, PR18-PR20 (hunger, eye contact, the hunt, the lost race). */
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

module.exports = S;
