/* SKIN-STEALER scenarios (Trial 3; dev/trial-3-skin-stealer/).  Each runs on the real simulation (sim.js + ai.js) with the harness's
 * scripted players (the game's own move.js model); seeded and headless.  T1: the species' identity and plumbing; T2: the animal; T3: lying in wait, prediction, the race, hearing. */
'use strict';
const { World, DT, LONG, over, rate, AI, floorNear } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const SKS = w => w.eng.entities.filter(e => e.kind === 'skinstealer');
const P9_KEYS = 'st,h,m,b,p,gw,it,lf,sn';

add('SK01 species: a third, separate species (its own name, act table, collider, senses and hooks; never a Smiler or a Hound brain)', () => {
  const w = World(11), bad = [];
  if (!AI.SPECIES.skinstealer || AI.SPECIES.skinstealer !== AI.SKIN) bad.push('not registered');
  const e = w.eng.spawn('skinstealer', 5000, LONG.y);
  if (e.sp.name !== 'SkinStealer' || e.kind !== 'skinstealer') bad.push('name ' + e.sp.name);
  if (e.caps.CAN_CRAWL || e.caps.CAN_USE_TIGHT_GAPS) bad.push('it can crawl');
  if (e.sp.vision.dark) bad.push('a dark-seer');
  for (const k of ['tick', 'snap', 'debug', 'onFar', 'onStuck', 'onClear', 'debugHunt', 'summon', 'targetScore', 'dwell']) if (typeof e.sp[k] !== 'function') bad.push('no ' + k);
  if (e.sp.tick === AI.HOUND.tick || e.sp.tick === AI.SMILER.tick) bad.push('borrowed tick');
  if (!(e.hunger >= .45 && e.hunger <= .65) || e.stam !== 100) bad.push(`hunger ${e.hunger} stamina ${e.stam}`);
  const acts = Object.keys(AI.KACT).sort((a, b) => AI.KACT[a] - AI.KACT[b]);
  if (acts.length !== 19 || AI.KACT[''] !== 0) bad.push('act table');
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `SkinStealer: r ${e.r}, clearance ${e.rc}, vision ${e.sp.vision.range} px / ${e.sp.vision.fov} rad, ${acts.length} acts, hunger ${e.hunger.toFixed(3)}` };
});

add('SK02 no organic spawn: the world reset, the director and the admin\'s RESPAWN ALL never make a Skin-Stealer', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed, { director: true }); let seen = 0;
    w.sim.resetWorld(); seen += SKS(w).length;
    const p = w.player(1300, 3300); p.stop('stand');
    w.run(90, () => { seen += SKS(w).length; return true; }, 30);
    w.sim.admin.resetMonsters(); seen += SKS(w).length;
    w.sim.resetWorld(); seen += SKS(w).length;
    const kinds = new Set(w.eng.entities.map(e => e.kind));
    return { ok: seen === 0, seen, kinds: [...kinds].join('+') };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/${rs.length} seeds with none (world reset, 90 s of the director with a player in the halls, RESPAWN ALL, a second reset); kinds made: ${[...new Set(rs.map(r => r.kinds))].join(', ')}`, data: rs };
});

add('SK03 admin spawn: capped at 4, in the dark, far from every living player, on reachable floor; remove takes them away', () => {
  const rs = over([1, 2, 3], seed => {
    const w = World(seed), A = w.sim.admin, p = w.player(5000, LONG.y), q = w.player(2000, 3300); p.stop('stand'); q.stop('stand');
    w.sim.step(DT);
    const adds = [1, 2, 3, 4, 5, 6].map(() => A.addSkinStealer());
    const ks = SKS(w), g = w.eng.geo, bad = [];
    for (const e of ks) {
      const dmin = Math.min(...w.players.map(pl => Math.hypot(pl.x - e.x, pl.y - e.y)));
      if (dmin < 1100) bad.push(`#${e.id} ${Math.round(dmin)} px from a player`);
      if (g.lamp[g.cellAt(e.x, e.y)] > .12) bad.push(`#${e.id} lit`);
      if (!w.ad.clear(e.x, e.y, e.rc, 'walk')) bad.push(`#${e.id} embedded`);
    }
    const inf = A.info(), near = A.addNear('skinstealer', p.x, p.y);
    const removed = [1, 2, 3, 4, 5].map(() => A.removeSkinStealer());
    return { ok: adds.join() === 'true,true,true,true,false,false' && ks.length === 4 && inf.kn === 4 && inf.mk === 4 && !near && !bad.length && removed.join() === 'true,true,true,true,false' && SKS(w).length === 0, adds: adds.join(), bad, kn: inf.kn };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/${rs.length}: 4 placed then refused (and NEAR refused at the cap), each >= 1100 px from both players, unlit, clear; all removed`, data: rs };
});

add('SK04 the snapshot: no ss key while there is none (P9\'s keys and order); a bounded ss list while there is one; gone again after', () => {
  const w = World(21), A = w.sim.admin, p = w.player(5000, LONG.y); p.stop('stand');
  const k0 = Object.keys(w.sim.entities()).join(',');
  A.addSkinStealer(); A.addSkinStealer(); w.run(2);
  const en = w.sim.entities(), k1 = Object.keys(en).join(','), ss = en.ss || [];
  const bytes = ss.map(t => JSON.stringify(t).length), fields = ss.every(t => ['i', 'x', 'y', 'a', 's', 'ac', 'v', 'h'].every(f => f in t) && Object.keys(t).length <= 10);
  A.removeSkinStealer(); A.removeSkinStealer(); w.run(.2);
  const k2 = Object.keys(w.sim.entities()).join(',');
  const hm = (en.h || []).length + (en.m || []).length;
  const ok = k0 === P9_KEYS && k1 === P9_KEYS + ',ss' && ss.length === 2 && fields && Math.max(...bytes) < 120 && k2 === P9_KEYS && hm === 0;
  return { ok, note: `none: ${k0}; two: ${k1} (${bytes.join(', ')} bytes each; h + m hold ${hm}); after: ${k2}` };
});

add('SK05 a new world (world reset) and the admin\'s RESPAWN ALL take every Skin-Stealer away; none comes back by itself', () => {
  const w = World(31), A = w.sim.admin, p = w.player(5000, LONG.y); p.stop('stand');
  A.addSkinStealer(); A.addSkinStealer(); const n0 = SKS(w).length;
  w.sim.resetWorld(); const n1 = SKS(w).length, k1 = 'ss' in w.sim.entities();
  A.addSkinStealer(); A.resetMonsters(); const n2 = SKS(w).length;
  w.run(20); const n3 = SKS(w).length;
  return { ok: n0 === 2 && n1 === 0 && !k1 && n2 === 0 && n3 === 0, note: `two -> world reset ${n1} (ss key ${k1}) -> one more -> RESPAWN ALL ${n2} -> 20 s later ${n3}` };
});

add('SK06 level of detail: far from everyone it waits where it is (its own hook: never the Smiler\'s hiding); near again it moves', () => {
  const w = World(41), A = w.sim.admin, p = w.player(1300, 3300); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 8600, 6100); e.tier = 'near'; e.tierT = 0;
  const states = new Set(); let moved = 0, px = e.x, py = e.y;
  w.run(8, () => { states.add(e.state); moved += Math.hypot(e.x - px, e.y - py); px = e.x; py = e.y; return true; });
  const farTier = e.tier, farMoved = moved;
  p.x = e.x - 900; p.y = e.y; w.sim.step(DT);
  moved = 0; px = e.x; py = e.y; w.run(25, () => { states.add(e.state); moved += Math.hypot(e.x - px, e.y - py); px = e.x; py = e.y; return true; });
  const ok = farTier === 'far' && farMoved < 1 && !states.has('HIDDEN') && !states.has('DORMANT') && e.tier !== 'far' && moved > 150;
  return { ok, note: `far: tier ${farTier}, moved ${farMoved.toFixed(1)} px; near: tier ${e.tier}, moved ${Math.round(moved)} px; states ${[...states].join(', ')}` };
});

add('SK07 admin data: the entity list marks it 2 (K on the panel); kn / mk only while one exists; the debug block is its own (no line of speech in it)', () => {
  const w = World(51), A = w.sim.admin, p = w.player(5000, LONG.y); p.stop('stand');
  const i0 = A.info(); A.addSkinStealer(); A.addHound(); A.addSmiler(); w.run(1);
  const i1 = A.info(), codes = i1.es.map(r => r[1]).sort().join(''), d = w.sim.debugInfo().find(x => x.k === 'skinstealer');
  const ok = !('kn' in i0) && !('mk' in i0) && i1.kn === 1 && i1.mk === 4 && codes === '012' && d && d.sk && !d.sm && !d.hm && typeof d.sk.hu === 'number' && !JSON.stringify(d.sk).includes('text');
  return { ok, note: `before: kn ${'kn' in i0}; after: kn ${i1.kn}/${i1.mk}, codes ${codes}, debug ${d ? JSON.stringify(d.sk) : 'none'}` };
});

add('SK08 admin navigation and summon reach its own hooks (never the Smiler\'s stalk, hide or drawn behaviours)', () => {
  const w = World(61), p = w.player(5000, LONG.y); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5600, LONG.y); e.tier = 'near';
  const r1 = w.eng.navCmd(e, 'hunt', p), st1 = e.state, tg = e.target;
  const r2 = w.eng.navCmd(e, 'clear', p), st2 = e.state;
  const ok3 = w.eng.summon(e, 5600, LONG.y, 5000, LONG.y, p.id), st3 = e.state, goal = e.roam.goal;
  w.run(3); const st4 = e.state;
  const bad = ['STALKING', 'HIDDEN', 'FOLLOWING', 'WATCHING'].filter(s => [st1, st2, st3, st4].includes(s) && s !== 'WATCHING');
  const ok = /WATCHING|RECORD/.test(r1) && tg === p.id && /CLEARED/.test(r2) && e.target === null && ok3 && goal && goal.x === 5000 && !bad.length;
  return { ok, note: `hunt: "${r1}" (${st1}, target ${tg}); clear: "${r2}" (${st2}); summon: ${ok3} -> goal ${goal && goal.x},${goal && goal.y} (${st3}); 3 s later ${st4}` };
});

/* ---------------------------------------------------------------- T2: the animal, its senses, non-engagement, budgets */
/* a stage: one Skin-Stealer of a given hunger at (ex, ey), facing (ea); a player at (px, py) facing (pa), light on or off */
function duel(seed, o) {
  const w = World(seed), y = LONG.y;
  const p = w.player(o.px ?? 5000, o.py ?? y, { light: o.light !== false, angle: o.pa ?? 0 }); p.stop(o.mode || 'stand'); p.look = o.pa ?? 0;
  const e = w.eng.spawn('skinstealer', o.ex ?? 5600, o.ey ?? y, { hunger: o.hunger }); e.tier = 'near'; e.ang = o.ea ?? Math.PI;
  return { w, p, e };
}
const planOf = e => e.plan ? e.plan.k : 'roam';

add('SK10 hunger: one continuous variable, rising slowly with time near or far (never a jump), falling only by feeding', () => {
  const w = World(71), p = w.player(1300, 3300); p.stop('crouch');
  const near = w.eng.spawn('skinstealer', 1900, 3300, { hunger: .3 }), far = w.eng.spawn('skinstealer', 8600, 6100, { hunger: .3 }); near.tier = 'near';
  let maxStep = 0, last = [near.hunger, far.hunger];
  w.run(60, () => { const h = [near.hunger, far.hunger]; maxStep = Math.max(maxStep, Math.abs(h[0] - last[0]), Math.abs(h[1] - last[1])); last = h; return true; });
  const rate = (near.hunger - .3) / 60, rateFar = (far.hunger - .3) / 60;
  const ok = Math.abs(rate - AI.SK.hungerRate) < 2e-4 && Math.abs(rateFar - AI.SK.hungerRate) < 2e-4 && maxStep < .002 && far.tier === 'far';
  return { ok, note: `60 s: near ${near.hunger.toFixed(4)} (${(rate * 60).toFixed(3)}/min), far ${far.hunger.toFixed(4)} (${(rateFar * 60).toFixed(3)}/min); largest single step ${maxStep.toFixed(5)}` };
});

add('SK11 stamina: running drains it at its rate, walking and standing give it back, exhaustion caps its speed; no change of plan or state ever resets it', () => {
  const rs = over([1, 2, 3], seed => {
    const w = World(seed + 80), p = w.player(1300, 3300, { light: false }); p.stop('crouch');
    const e = w.eng.spawn('skinstealer', 2300, 3300, { hunger: .5 }); e.tier = 'near';
    const lim = Math.max(AI.SK.drainRun, AI.SK.regenStill) * 1.3 / 60, jumps = []; let prev = e.stam, overCap = 0;
    let free = false; const tick = () => { if (Math.abs(e.stam - prev) > lim) jumps.push([+w.t.toFixed(2), +prev.toFixed(2), +e.stam.toFixed(2)]); prev = e.stam; if (free && e.exh && e.speed > e.sp.speeds.roam + 25) overCap++; return true; };
    // its body told it ran at its run speed for 4 s (the body reads the speed it moved at): 14 a second
    const s0 = e.stam; for (let i = 0; i < 240; i++) { e.speed = e.sp.speeds.run; w.step(); tick(); }
    const drained = s0 - e.stam;
    for (let i = 0; i < 240; i++) { e.speed = e.sp.speeds.run; w.step(); tick(); }
    const exh = e.exh, low = e.stam;
    w.run(.5, tick); free = true; w.run(11.5, tick); const back = e.stam, exhAfter = e.exh;               // (after half a second to brake: it moves as it chooses, exhausted, never faster than a walk)
    // plans and states changed over and over (the admin's hunt and clear, a summon): the stamina never jumps
    for (let k = 0; k < 20; k++) { w.eng.navCmd(e, k % 2 ? 'clear' : 'hunt', p); w.run(.25, tick); }
    return { ok: Math.abs(drained - AI.SK.drainRun * 4) < 2.5 && exh && low < AI.SK.stamExh && back > low + 40 && !overCap && !jumps.length, drained: +drained.toFixed(1), exh, low: +low.toFixed(1), back: +back.toFixed(1), exhAfter, overCap, jumps: jumps.slice(0, 3) };
  });
  return { ok: rate(rs) === 1, note: rs.map(r => `${r.ok ? 'ok' : 'FAIL'}: 4 s running -${r.drained} (rate ${AI.SK.drainRun}/s), exhausted ${r.exh} at ${r.low}, 12 s later ${r.back} (exhausted ${r.exhAfter}), over the walking cap ${r.overCap} ticks, jumps ${r.jumps.length}`).join(' | '), data: rs };
});

add('SK12 real non-engagement: a satiated Skin-Stealer that sees someone (even close, even unwatched) leaves them alone and goes away', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, p, e } = duel(seed + 100, { hunger: .1, ex: 5000 + 380, pa: seed % 2 ? 0 : Math.PI, light: true });
    let closest = 1e9, left = false;
    w.run(25, () => { closest = Math.min(closest, Math.hypot(p.x - e.x, p.y - e.y)); if (planOf(e) === 'leave') left = true; return true; });
    const end = Math.hypot(p.x - e.x, p.y - e.y);
    return { ok: left && closest > 300 && end > 900, left, closest: Math.round(closest), end: Math.round(end), why: e.dbg.why };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/${rs.length} left (never closer than ${Math.min(...rs.map(r => r.closest))} px; after 25 s ${Math.min(...rs.map(r => r.end))}..${Math.max(...rs.map(r => r.end))} px away)`, data: rs };
});

add('SK13 a departure is real: once it has left someone it does not come back for them during its cooldown (the person stays where they were)', () => {
  const rs = over([1, 2, 3, 4], seed => {
    const { w, p, e } = duel(seed + 120, { hunger: .1, ex: 5400, pa: 0, light: true });
    let leftAt = -1, back = 1e9;
    w.run(70, () => { if (leftAt < 0 && planOf(e) === 'leave') leftAt = w.t; if (leftAt >= 0 && w.t - leftAt > 8) back = Math.min(back, Math.hypot(p.x - e.x, p.y - e.y)); return true; });
    return { ok: leftAt >= 0 && back > 700, leftAt: +leftAt.toFixed(1), back: Math.round(back), cooldown: [...e.left.values()].map(u => +(u - w.eng.now).toFixed(1)) };
  });
  return { ok: rate(rs) === 1, note: rs.map(r => `left at ${r.leftAt} s, never back within ${r.back} px`).join(' | '), data: rs };
});

add('SK14 engagement exists: a hungry one comes closer to somebody who is not watching it, under cover; eye contact stops it', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, p, e } = duel(seed + 140, { hunger: .62, ex: 5700, ea: Math.PI, pa: Math.PI, light: true });   // the person (lit) faces away, west; it is 700 px east of them, facing them
    const r0 = Math.hypot(p.x - e.x, p.y - e.y); let closest = r0, approached = false;
    w.run(30, () => { const d = Math.hypot(p.x - e.x, p.y - e.y); closest = Math.min(closest, d); if (planOf(e) === 'approach') approached = true; return true; });
    // now the person turns round to face it: it stops coming
    p.look = Math.atan2(e.y - p.y, e.x - p.x); w.run(4); const d0 = Math.hypot(p.x - e.x, p.y - e.y); w.run(4); const d1 = Math.hypot(p.x - e.x, p.y - e.y);
    return { ok: approached && closest < r0 - 200, approached, closest: Math.round(closest), r0: Math.round(r0), watchedThen: planOf(e), held: d1 >= d0 - 30 };
  });
  const held = rs.filter(r => r.approached).every(r => r.held);
  return { ok: rate(rs) >= .75 && held, note: `${rs.filter(r => r.ok).length}/${rs.length} came closer (from ${rs[0].r0} px to ${rs.map(r => r.closest).join(', ')}); eye contact then: ${rs.map(r => r.watchedThen).join(', ')} (stopped coming: ${held})`, data: rs };
});

add('SK15 the evidence law: an unsensed person changes nothing it does (the same seed with the person hidden in two different places gives the same Skin-Stealer, tick for tick)', () => {
  const runOnce = (hx, hy) => {
    const w = World(161), q = w.player(hx, hy, { light: false }); q.stop('crouch');
    const watcher = w.player(1300, 3300, { light: false }); watcher.stop('crouch');   // keeps the near tier going, far from both
    const e = w.eng.spawn('skinstealer', 2100, 3300, { hunger: .7 }); e.tier = 'near';
    const tr = []; w.run(30, () => { tr.push(Math.round(e.x * 100), Math.round(e.y * 100), e.state.length, e.plan ? e.plan.k.length : 0); return true; });
    return { tr, seen: e.mem.p.has(q.id) };
  };
  const a = runOnce(8400, 900), b = runOnce(600, 6400);
  let first = -1; for (let i = 0; i < a.tr.length; i++) if (a.tr[i] !== b.tr[i]) { first = i; break; }
  return { ok: first < 0 && !a.seen && !b.seen, note: first < 0 ? `identical over ${a.tr.length / 4} ticks; it never sensed either hidden person` : `diverged at tick ${first >> 2}` };
});

add('SK16 the encounter budget: it never pins somebody for ever - with a person standing in view, its time on them runs out and it leaves', () => {
  const rs = over([1, 2, 3, 4], seed => {
    const { w, p, e } = duel(seed + 170, { hunger: .55, ex: 5650, pa: Math.PI, light: true });
    let leftAt = -1, span = 0, longest = 0;
    w.run(150, () => { if (e.plan && e.plan.pid === p.id) { span += DT; longest = Math.max(longest, span); } else if (planOf(e) === 'leave') span = 0; if (leftAt < 0 && planOf(e) === 'leave') leftAt = w.t; return true; });
    const budget = AI.SK.budgetEnc[0] + AI.SK.budgetEnc[1] * .7;   // (its hunger rises a little over the run)
    return { ok: leftAt >= 0 && longest <= budget + 5, leftAt: +leftAt.toFixed(1), engaged: +longest.toFixed(1), budget: Math.round(budget) };
  });
  return { ok: rate(rs) === 1, note: rs.map(r => `longest engagement ${r.engaged} s (budget about ${r.budget}), first left at ${r.leftAt} s`).join(' | '), data: rs };
});

add('SK17 more than one of them: two people in view make it leave (it is a lone ambusher)', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, p, e } = duel(seed + 190, { hunger: .55, ex: 5600, pa: Math.PI, light: true });
    const q = w.player(5000, LONG.y + 120, { light: true, angle: 0 }); q.stop('stand');
    let left = false; w.run(15, () => { if (planOf(e) === 'leave') left = true; return true; });
    return { ok: left, why: e.dbg.why };
  });
  return { ok: rate(rs) >= .8, note: `${rs.filter(r => r.ok).length}/${rs.length} left; ${[...new Set(rs.map(r => r.why))].join(' / ')}`, data: rs };
});

add('SK18 navigation: its routes never use crawl or tight-gap cells, and over long runs it never stands inside solid geometry', () => {
  const w = World(181), p = w.player(1300, 3300); p.stop('crouch');
  const ks = [w.eng.spawn('skinstealer', 2400, 3300, { hunger: .5 }), w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .2 })]; ks.forEach(e => { e.tier = 'near'; });
  const g = w.eng.geo; let badCell = 0, inside = 0, samples = 0;
  w.run(120, () => { for (const e of ks) { for (const wp of e.path) if ((wp.c | 0) > 1) badCell++; if (!e.trav) { samples++; if (!w.ad.clear(e.x, e.y, 12, 'walk')) inside++; } } return true; }, 4);
  const p2 = g.path(1200, 3300, 8500, 6000, ks[0].caps), crawlOnRoute = p2 ? p2.filter(q => (q.c | 0) > 1).length : -1;
  return { ok: !badCell && !inside && crawlOnRoute === 0, note: `${samples} samples: ${inside} inside geometry, ${badCell} crawl / tight waypoints; a cross-map route has ${crawlOnRoute} such cells` };
});

/* ---------------------------------------------------------------- T3: lying in wait, prediction, interception, the race, hearing */
/* the dark south-west of Level 0: wall A (x 976..1072) with a gap at y 5300..5460, wall B (y 5018..5066), wall C (x 1552..1648) with
 * a gap at y 5498..5642.  Every scenario places people and the Skin-Stealer on open floor there. */
const SW = { gapP: { x: 700, y: 5330 }, gapK: { x: 1300, y: 5330 } };

add('SK20 route prediction is its own guess from a record: the real person (unsensed, or absent) changes nothing; at a fork the guess varies with the seed (it can be wrong) yet one way is preferred', () => {
  const rec = eng => ({ id: 0, lkx: 1300, lky: 5800, lvx: 0, lvy: -150, seenAt: eng.now, heardAt: -99 });   // walking north toward the low wall at y 5036
  const once = (seed, where) => {
    const w = World(seed); if (where) { const q = w.player(where.x, where.y, { light: false }); q.stop('crouch'); }
    const e = w.eng.spawn('skinstealer', 2000, 5600, { hunger: .6 }); e.tier = 'near';
    return JSON.stringify(AI.SKIN.predict(w.eng, e, rec(w.eng)));
  };
  let same = 0; const guesses = new Map();
  for (let seed = 1; seed <= 16; seed++) {
    const a = once(seed, { x: 700, y: 5330 }), b = once(seed, { x: 1720, y: 4900 }), c = once(seed, null);
    if (a === b && b === c) same++;
    const g = JSON.parse(a), k = g ? g.turns.map(t => t.a).join('/') || 'straight' : 'none';
    guesses.set(k, (guesses.get(k) || 0) + 1);
  }
  const counts = [...guesses.values()].sort((x, y) => y - x);
  return { ok: same === 16 && guesses.size >= 2 && counts[0] >= 8 && !guesses.has('none'), note: `${same}/16 identical wherever the real person is (or with nobody there); guesses ${[...guesses].map(([k, n]) => `${k} x${n}`).join(', ')}` };
});

/* the bait: a person with a torch sees it 600 px off through wall A's gap; it backs away round a corner and waits */
function baitRun(seed, follow) {
  const w = World(seed + 400), g = w.eng.geo;
  const p = w.player(SW.gapP.x, SW.gapP.y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
  const e = w.eng.spawn('skinstealer', SW.gapK.x, SW.gapK.y, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI;
  const R = { lureAt: -1, moved: 0, lureD: 1e9, d0: 0, endAt: -1, why: '', after: '' };
  w.run(40, () => {
    const k = planOf(e);
    if (k === 'lure' && R.lureAt < 0) { R.lureAt = w.t; R.pos = { x: e.x, y: e.y }; R.hidden = !g.los(p.x, p.y, e.x, e.y); R.d0 = Math.hypot(p.x - e.x, p.y - e.y); }
    if (k === 'lure') { R.moved = Math.max(R.moved, Math.hypot(e.x - R.pos.x, e.y - R.pos.y)); R.lureD = Math.min(R.lureD, Math.hypot(p.x - e.x, p.y - e.y)); }
    if (R.lureAt >= 0 && R.endAt < 0 && k !== 'lure') { R.endAt = w.t; R.why = e.dbg.why; R.after = k; }
    if (follow && R.lureAt >= 0 && !p.going && w.t - R.lureAt > 1) { p.going = 1; p.look = null; p.route([{ x: 1020, y: SW.gapP.y }, { x: SW.gapK.x, y: SW.gapK.y }], 'walk'); }
    return true;
  });
  R.came = e.tally.lureCame; R.dur = R.endAt < 0 ? -1 : +(R.endAt - R.lureAt).toFixed(1); return R;
}
add('SK21 the bait: seen, a hungry one backs round a corner and waits there, still; nobody follows - it gives up and leaves; somebody follows - they come round that corner close to it', () => {
  const stay = over([1, 2, 3, 4, 5, 6, 7, 8], s => baitRun(s, false)), fol = over([1, 2, 3, 4, 5, 6, 7, 8], s => baitRun(s, true));
  const lured = stay.filter(r => r.lureAt >= 0), lf = fol.filter(r => r.lureAt >= 0);
  const okStay = lured.length >= 6 && lured.every(r => r.hidden && r.moved < 30 && r.lureD >= r.d0 - 30 && r.after === 'leave' && /did not follow/.test(r.why) && r.dur <= AI.SK.lureMax + .5);
  const came = lf.filter(r => r.came > 0 && r.lureD < 320);
  return { ok: okStay && lf.length >= 6 && came.length >= 5, note: `stays put: ${lured.length}/8 lay in wait, hidden ${lured.filter(r => r.hidden).length}, moved at most ${Math.max(...lured.map(r => Math.round(r.moved)))} px, gave up after ${lured.map(r => r.dur).join('/')} s ("${lured[0] && lured[0].why}") | follows: ${lf.length}/8 lay in wait, they came round the corner within ${lf.map(r => Math.round(r.lureD)).join('/')} px of it (${came.length} within 320)`, data: { stay, fol } };
});

add('SK22 the straight race: a fresh runner on a straight wins - it gives chase, falls behind and gives up for that reason; a winded one does not - it closes to striking distance', () => {
  const race = (seed, winded) => {
    const w = World(seed + 300), y = LONG.y;
    const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0; if (winded) p.exhaust();
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
    p.go(8700, y, 'run');
    let chased = false, dmin = 1e9, why = '';
    w.run(14, () => { if (planOf(e) === 'chase') chased = true; else if (chased && !why) why = e.dbg.why; if (w.t > .5) dmin = Math.min(dmin, Math.hypot(p.x - e.x, p.y - e.y)); return true; });
    return { chased, dmin: Math.round(dmin), why, end: Math.round(Math.hypot(p.x - e.x, p.y - e.y)), lost: e.tally.chaseLost };
  };
  const fresh = over([1, 2, 3, 4], s => race(s, false)), tired = over([1, 2, 3, 4], s => race(s, true));
  const ok = fresh.every(r => r.chased && /losing the race/.test(r.why) && r.dmin >= 280 && r.end > 1500) && tired.every(r => r.chased && r.dmin <= 185);
  return { ok, note: `fresh: never closer than ${fresh.map(r => r.dmin).join('/')} px, gave up ("${fresh[0].why}"), ${fresh.map(r => r.end).join('/')} px apart after 14 s | winded: it closed to ${tired.map(r => r.dmin).join('/')} px (striking distance ${AI.SK.approachStop}..185; the pounce is T4's)`, data: { fresh, tired } };
});

/* interception: a person with a torch walks north past wall C's gap, where it sees them; past the gap they switch the torch off and walk on.
 * A: they go the way their heading suggested (east along wall B, then north); B: they double back to wall A's gap (west).  Both runs are
 * the same until the person's routes part. */
const ROUTE = { A: { x: 1720, y: 4900 }, B: { x: 700, y: 5330 } };          // after (1300, 5150): on, round wall B's east end, or back west
function interceptRun(seed, v) {
  const w = World(seed + 500);
  const p = w.player(1300, 5950, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 1850, 5570, { hunger: .6 }); e.tier = 'near'; e.ang = Math.PI;
  const R = { tr: [], plan: null, at: -1, endAt: -1, why: '', waitD: 1e9, minD: 1e9, parted: -1 };
  w.run(35, (ww, i) => {
    if (w.t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5400 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; R.parted = R.tr.length; p.pathTo(ROUTE[v].x, ROUTE[v].y, 'walk'); }   // the routes part here
    if (p.light && p.y < 5440) p.light = false;
    const r = e.mem.p.get(p.id);
    // its position, then everything it has sensed of the person (sighting, record, the last sound and the leads): the evidence
    const H = e.hear, L = e.mem.leads.map(q => `${q.id}:${Math.round(q.x)}:${Math.round(q.y)}`).join(';');
    R.tr.push([Math.round(e.x * 10), Math.round(e.y * 10), [e.seenNow.has(p.id) ? 1 : 0, r ? [r.heardAt, r.seenAt, r.hx, r.hy, r.lkx, r.lky, r.lvx, r.lvy].map(v => Math.round(v * 10)).join(':') : '-', H ? `${H.id}:${Math.round(H.x)}:${Math.round(H.y)}` : '-', L].join('|')].join(','));
    const P = e.plan;
    if (P && P.k === 'intercept' && R.at < 0) { R.at = w.t; R.plan = P; R.pred = e.dbg.predict; }
    if (R.plan && e.plan === R.plan) { const d = Math.hypot(p.x - e.x, p.y - e.y); R.minD = Math.min(R.minD, d); if (R.plan.arrived) R.waitD = Math.min(R.waitD, d); }
    if (R.plan && e.plan !== R.plan && R.endAt < 0) { R.endAt = w.t; R.why = e.dbg.why; R.next = e.plan ? e.plan.k : 'roam'; }
    return true;
  });
  return R;
}
add('SK23 interception: when it loses someone it goes round to where it guesses they will be and waits there out of sight; right when they keep to their way, wrong when they double back - and the two runs are the same Skin-Stealer until it senses the difference', () => {
  const rs = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => { const A = interceptRun(seed, 'A'), B = interceptRun(seed, 'B'); return { seed, A, B }; });
  // the evidence law: identical until either run's Skin-Stealer senses the person differently (a sighting or a sound only one has)
  let lawOk = 0;
  for (const { A, B } of rs) {
    let i = 0; const n = Math.min(A.tr.length, B.tr.length);
    for (; i < n; i++) { const a = A.tr[i].split(','), b = B.tr[i].split(','); if (a[2] !== b[2]) break; if (a[0] !== b[0] || a[1] !== b[1]) { i = -1; break; } }
    if (i < 0) continue; if (i >= Math.min(A.parted, B.parted)) lawOk++;
  }
  // A: the guess was right - it met them (they came within 250 px of it, on its way or where it waited) and it noticed (by sight, or
  // by ear in the dark): the interception ended in a stalk, a chase or following the sound, not "guessed wrong".  B: wherever it got
  // to wait, nobody came, and it said so (an interception that sighted them again on the way is neither)
  const ia = rs.filter(r => r.A.plan), ib = rs.filter(r => r.B.plan), ibw = ib.filter(r => r.B.plan.arrived);
  const right = ia.filter(r => r.A.minD < 250 && !/guessed wrong/.test(r.A.why) && /approach|chase|search|watch|retreat/.test(r.A.next)), wrong = ibw.filter(r => r.B.waitD >= 250 && /guessed wrong/.test(r.B.why));
  const bounded = rs.every(r => [r.A, r.B].every(R => !R.plan || (R.endAt > 0 && R.endAt - R.at <= AI.SK.interceptMax + 8.5)));
  return { ok: lawOk === 8 && ia.length >= 3 && ibw.length >= 3 && right.length >= Math.ceil(ia.length * .6) && wrong.length === ibw.length && bounded,
    note: `identical until it senses a difference: ${lawOk}/8 | A (kept to their way): ${ia.length} interceptions, it met them within ${ia.map(r => Math.round(r.A.minD)).join('/')} px, noticed in ${right.length} (then ${ia.map(r => r.A.next).join('/')}: "${(right[0] || ia[0] || { A: {} }).A.why}") | B (doubled back): ${ibw.length} waited in vain, nearest ${ibw.map(r => Math.round(r.B.waitD)).join('/')} px, ${wrong.length} "guessed wrong" | every interception ended (${bounded})`,
    data: rs.map(r => ({ seed: r.seed, A: { at: r.A.at, minD: Math.round(r.A.minD), waitD: Math.round(r.A.waitD), why: r.A.why, next: r.A.next, pred: r.A.pred }, B: { at: r.B.at, waitD: Math.round(r.B.waitD), why: r.B.why, next: r.B.next } })) };
});

add('SK24 hearing: footsteps it really hears (a runner behind a wall) send a hungry one to look where it heard them; a quiet person in the same place sends it nowhere', () => {
  const runOnce = (seed, mode) => {
    const w = World(seed + 600);
    const p = w.player(780, 4950, { light: false, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1300, 5180, { hunger: .65 }); e.tier = 'near'; e.ang = 0;
    const R = { first: null, goal: null, there: null, sawFirst: false, dur: -1 };
    let P0 = null;
    w.run(30, () => {
      if (w.t > 1 && !p.going) { p.going = 1; p.route([{ x: 780, y: 5300 }], mode); }
      if (e.seenNow.has(p.id) && !R.first) R.sawFirst = true;
      if (!R.first && e.plan && e.plan.k !== 'leave') { R.first = e.plan.k; R.why = e.dbg.why; if (e.plan.k === 'search') { P0 = e.plan; R.goal = e.plan.goal; R.there = { x: p.x, y: p.y }; R.t0 = w.t; } }
      if (P0 && e.plan !== P0 && R.dur < 0) R.dur = +(w.t - R.t0).toFixed(1);
      return true;
    });
    R.off = R.goal ? Math.round(Math.hypot(R.goal.x - R.there.x, R.goal.y - R.there.y)) : -1; return R;
  };
  const run = over([1, 2, 3, 4, 5, 6], s => runOnce(s, 'run')), quiet = over([1, 2, 3, 4, 5, 6], s => runOnce(s, 'crouch'));
  const went = run.filter(r => r.first === 'search' && /heard/.test(r.why) && !r.sawFirst);
  const ok = went.length >= 3 && went.every(r => r.off < 250 && r.dur > 0 && r.dur <= AI.SK.searchMax + AI.SK.searchLook[1] + .5) && quiet.every(r => !(r.first === 'search' && /heard/.test(r.why)));
  return { ok, note: `running: ${went.length}/6 went to look (goal ${went.map(r => r.off).join('/')} px from where the runner was; each search over in ${went.map(r => r.dur).join('/')} s) | crouching: ${quiet.filter(r => r.first === 'search').length}/6 went to look`, data: { run, quiet } };
});

add('SK25 every plan ends and no encounter outlasts its budget: an hour-like stretch of a person wandering, running, hiding and switching the torch, against a hungry one', () => {
  const MAX = { watch: AI.SK.watch[1] * 1.3 + .5, lure: AI.SK.lureMax + .5, intercept: AI.SK.interceptMax + 8.5, chase: AI.SK.chaseMax + .5, search: AI.SK.searchMax + AI.SK.searchLook[1] + .5, leave: AI.SK.leaveMax + .5 };
  const rs = over([1, 2, 3, 4], seed => {
    const w = World(seed + 700), pts = [{ x: 700, y: 5330 }, { x: 1300, y: 5900 }, { x: 1720, y: 4900 }, { x: 1900, y: 5560 }, { x: 600, y: 5900 }, { x: 1300, y: 5150 }];
    const p = w.player(700, 5900, { light: true }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1850, 5570, { hunger: .75 }); e.tier = 'near';
    let cur = null, t0 = 0, over_ = [], longest = {}, engaged = 0, engMax = 0, budget = 0, leg = 0;
    w.run(150, () => {
      if ((!p.path || !p.path.length) && !p.tx) { const q = pts[(leg * 7 + seed) % pts.length]; leg++; p.light = leg % 3 !== 0; p.pathTo(q.x, q.y, leg % 4 === 1 ? 'run' : leg % 5 === 2 ? 'crouch' : 'walk'); }
      if (e.plan !== cur) { if (cur && MAX[cur.k] && w.t - t0 > MAX[cur.k]) over_.push([cur.k, +(w.t - t0).toFixed(1)]); if (cur) longest[cur.k] = Math.max(longest[cur.k] || 0, +(w.t - t0).toFixed(1)); cur = e.plan; t0 = w.t; }
      if (e.plan && e.plan.pid === p.id) { engaged += DT; engMax = Math.max(engMax, engaged); } else engaged = 0;
      budget = Math.max(budget, AI.SK.budgetEnc[0] + AI.SK.budgetEnc[1] * e.hunger);
      return true;
    });
    return { ok: !over_.length && engMax <= budget + 2, over: over_, longest, engMax: +engMax.toFixed(1), budget: Math.round(budget), tally: e.tally };
  });
  return { ok: rate(rs) === 1, note: rs.map(r => `longest plans ${JSON.stringify(r.longest)}; longest engagement ${r.engMax} s (budget ${r.budget})${r.over.length ? '; OVER ' + JSON.stringify(r.over) : ''}`).join(' | '), data: rs };
});

module.exports = S;
