/* SKIN-STEALER scenarios (Trial 3; dev/trial-3-skin-stealer/).  Each runs on the real simulation (sim.js + ai.js) with the harness's
 * scripted players (the game's own move.js model); seeded and headless.  T1: the species' identity and plumbing. */
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

module.exports = S;
