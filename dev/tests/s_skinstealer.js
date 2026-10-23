/* SKIN-STEALER scenarios (Trial 3; dev/trial-3-skin-stealer/).  Each runs on the real simulation (sim.js + ai.js) with the harness's
 * scripted players (the game's own move.js model); seeded and headless.  T1: the species' identity and plumbing; T2: the animal; T3: lying in wait, prediction, the race, hearing; T4: the strike and the kill; T6: what it hears and says, the skin it earns. */
'use strict';
const { World, DT, LONG, over, rate, AI, floorNear, bystander } = require('./lib.js');
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

add('SK06 level of detail: far from everyone, fed it waits where it is; hungry it prowls coarsely - to where it last knew somebody, or across the level, never toward anybody it has not perceived (R18, the owner: "a planning state that keeps the creature stationary despite an available opportunity"; R8-R16i: it waited, whatever its hunger); never the Smiler\'s hiding; near again it moves', () => {
  const run = (h, at = [1300, 3300]) => {
    const w = World(41), p = w.player(at[0], at[1]); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 8600, 6100, { hunger: h }); e.tier = 'near'; e.tierT = 0;
    const states = new Set(), tr = []; let moved = 0, px = e.x, py = e.y;
    w.run(8, () => { states.add(e.state); moved += Math.hypot(e.x - px, e.y - py); px = e.x; py = e.y; tr.push(Math.round(e.x * 10) + ',' + Math.round(e.y * 10)); return true; });
    const farTier = e.tier, farMoved = moved, knew = e.mem.p.has(p.id);
    p.x = e.x - 900; p.y = e.y; w.sim.step(DT);
    moved = 0; px = e.x; py = e.y; w.run(25, () => { states.add(e.state); moved += Math.hypot(e.x - px, e.y - py); px = e.x; py = e.y; return true; });
    return { h, farTier, farMoved, knew, states: [...states], tier: e.tier, moved, tr };
  };
  const fed = run(.1), hungry = run(.7), elsewhere = run(.7, [1300, 900]);
  // (where the person it never perceived is makes no difference to its prowl: the same world with them elsewhere, far away too, gives the
  // same prowl tick for tick)
  let first = -1; for (let i = 0; i < hungry.tr.length; i++) if (hungry.tr[i] !== elsewhere.tr[i]) { first = i; break; }
  const ok = [fed, hungry, elsewhere].every(r => r.farTier === 'far' && !r.states.includes('HIDDEN') && !r.states.includes('DORMANT') && r.tier !== 'far' && r.moved > 150 && !r.knew)
    && fed.farMoved < 1 && hungry.farMoved > 100 && first < 0;
  return { ok, note: [fed, hungry].map(r => `hunger ${r.h} - far: tier ${r.farTier}, moved ${r.farMoved.toFixed(1)} px (${r.knew ? 'KNEW the person' : 'no record of the person'}); near: tier ${r.tier}, moved ${Math.round(r.moved)} px; states ${r.states.join(', ')}`).join(' | ') + ` | the person elsewhere: its far prowl ${first < 0 ? 'identical tick for tick' : 'DIFFERS from tick ' + first}` };
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
  const r2 = w.eng.navCmd(e, 'clear', p), st2 = e.state, tg2 = e.target;
  const ok3 = w.eng.summon(e, 5600, LONG.y, 5000, LONG.y, p.id), st3 = e.state, goal = e.roam.goal;
  w.run(3); const st4 = e.state, own4 = e.plan && ['approach', 'flank', 'intercept'].includes(e.plan.k);
  // (predator refinement R1) a hungry one (an admin spawn starts at .45-.65) may now begin its own approach or flank within those 3 s;
  // STALKING is then its own plan's state (SK_STATE), not the Smiler's stalk - which is what this scenario guards against
  const bad = ['STALKING', 'HIDDEN', 'FOLLOWING', 'WATCHING'].filter(s => [st1, st2, st3, st4].includes(s) && s !== 'WATCHING' && !(s === 'STALKING' && [st1, st2, st3].every(q => q !== s) && st4 === s && own4));
  const ok = /WATCHING|RECORD/.test(r1) && tg === p.id && /CLEARED/.test(r2) && tg2 === null && ok3 && goal && goal.x === 5000 && !bad.length;   // (R1: the target is judged right after the clear - 3 s later a hungry one may have chosen them again)
  return { ok, note: `hunt: "${r1}" (${st1}, target ${tg}); clear: "${r2}" (${st2}); summon: ${ok3} -> goal ${goal && goal.x},${goal && goal.y} (${st3}); 3 s later ${st4}${own4 ? ' (its own ' + e.plan.k + ')' : ''}` };
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
    // (R18: exhausted, its cap is its spent walk - speeds.spent, 120; R8-R16i its roam, 105 then, 160 in R18)
    let free = false; const tick = () => { if (Math.abs(e.stam - prev) > lim) jumps.push([+w.t.toFixed(2), +prev.toFixed(2), +e.stam.toFixed(2)]); prev = e.stam; if (free && e.exh && e.speed > e.sp.speeds.spent + 25) overCap++; return true; };
    // its body told it ran at its run speed for 4 s (the body reads the speed it moved at): SK.drainRun a second (R18 11; R8-R16i 14)
    const s0 = e.stam; for (let i = 0; i < 240; i++) { e.speed = e.sp.speeds.run; w.step(); tick(); }
    const drained = s0 - e.stam;
    // (R18: on until it is exhausted, 12 s at most - at R18's 11 a second from full that is 9.1 s; R8-R16i's 14 a second took 7.1, and the
    // test ran 8 s in all)
    for (let i = 0; i < 720 && !e.exh; i++) { e.speed = e.sp.speeds.run; w.step(); tick(); }
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

add('SK16 the encounter budget: nobody is pinned for ever - someone who keeps an eye on it is not taken while it is under very hungry (.6) and is left alone or taken later, within its time on them; someone who stands unaware is taken or left, within its time on them', () => {
  const runOnce = (seed, watcher) => {
    const { w, p, e } = duel(seed + 170, { hunger: .55, ex: 5650, pa: watcher ? 0 : Math.PI, light: true });
    bystander(w);                                                                 // (the world keeps running after a death)
    if (watcher) p.look = () => Math.atan2(e.y - p.y, e.x - p.x);                  // they keep turning to face it
    let leftAt = -1, span = 0, longest = 0, hAtKill = -1;
    w.run(150, () => { if (e.plan && e.plan.pid === p.id) { span += DT; longest = Math.max(longest, span); } else span = 0; if (leftAt < 0 && planOf(e) === 'leave') leftAt = w.t; if (hAtKill < 0 && w.kills.length) hAtKill = e.hunger; return true; });
    const budget = AI.SK.budgetEnc[0] + AI.SK.budgetEnc[1] * .8, killed = w.kills.some(k => k.pid === p.id);
    // (Predator refinement R3: hunger rises through the 150 s, .55 to about .8.  The owner's instruction is that a very hungry one is not
    // kept off by being watched; so the watcher is never taken while it is merely hungry - under SK.band[2] - and a kill after its hunger
    // has passed that is reported, not counted against it.  Left alone first, and never pinned, as before.)
    const lateKill = killed && hAtKill >= AI.SK.band[2];
    return { ok: longest <= budget + 2 && (watcher ? (!killed || lateKill) && leftAt >= 0 : killed || leftAt >= 0), watcher, killed, hAtKill: +hAtKill.toFixed(2), leftAt: +leftAt.toFixed(1), engaged: +longest.toFixed(1), budget: Math.round(budget) };
  };
  const rs = [1, 2, 3, 4].flatMap(seed => [runOnce(seed, true), runOnce(seed, false)]);
  return { ok: rate(rs) === 1, note: rs.map(r => `${r.watcher ? 'watching it' : 'unaware'}: ${r.killed ? (r.watcher ? `left alone at ${r.leftAt} s, taken later at hunger ${r.hAtKill}` : 'taken') : r.leftAt >= 0 ? 'left alone at ' + r.leftAt + ' s' : 'neither'}, longest engagement ${r.engaged} s (budget about ${r.budget})`).join(' | '), data: rs };
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
/* (R13) where the bait is judged it must be the answer to being SEEN: from 600 px in this dark gap the person cannot make it out (the
 * client's rule: legibility .23 at 300 px even in their torch beam), and since R13 it goes round under cover to an ambush point instead of
 * creeping into their beam as R8 did until it met their eyes; so it starts 265 px from them, in their beam, met by their eyes (R8's eye
 * contact) - and beyond SK.near, where a very hungry one's answer to being seen may be the bait (closer, it would only back out of sight) */
const SW_K = { x: SW.gapP.x + 265, y: SW.gapK.y };
function baitRun(seed, follow) {
  const w = World(seed + 400), g = w.eng.geo;
  const p = w.player(SW.gapP.x, SW.gapP.y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
  const e = w.eng.spawn('skinstealer', SW_K.x, SW_K.y, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI;
  const R = { lureAt: -1, moved: 0, lureD: 1e9, d0: 0, endAt: -1, why: '', after: '' }; let LP = null;
  w.run(40, () => {
    const k = planOf(e);
    if (k === 'lure' && R.lureAt < 0) { R.lureAt = w.t; LP = e.plan; R.pos = { x: e.x, y: e.y }; R.hidden = !g.los(p.x, p.y, e.x, e.y); R.d0 = Math.hypot(p.x - e.x, p.y - e.y); }
    // (that wait: predator refinement R1-R2 - the hunt can go on afterwards, and a later wait elsewhere is another one)
    if (k === 'lure' && e.plan === LP) { R.moved = Math.max(R.moved, Math.hypot(e.x - R.pos.x, e.y - R.pos.y)); R.lureD = Math.min(R.lureD, Math.hypot(p.x - e.x, p.y - e.y)); }
    if (R.lureAt >= 0 && R.endAt < 0 && k !== 'lure') { R.endAt = w.t; R.why = e.dbg.why; R.after = k; R.huntOn = !!(e.hunt && e.hunt.pid === p.id && e.hunt.baitFailed); }
    if (follow && R.lureAt >= 0 && !p.going && w.t - R.lureAt > 1) { p.going = 1; p.look = null; p.route([{ x: 1020, y: SW.gapP.y }, { x: SW.gapK.x, y: SW.gapK.y }], 'walk'); }
    return true;
  });
  R.came = e.tally.lureCame; R.dur = R.endAt < 0 ? -1 : +(R.endAt - R.lureAt).toFixed(1); return R;
}
add('SK21 the bait: seen, a hungry one backs round a corner and waits there, still; nobody follows - it gives up and leaves; somebody follows - they come round that corner close to it', () => {
  // (Predator refinement R3: a hungry one watched now more often goes round the person to cover - R1's flank, which since R3 reaches its
  // spot - than backs off as bait (about one hunt in three at .7); the bait is one of its answers.  So the scene runs 24 seeds and judges
  // the runs where it lay in wait, as SK41 does: at least 6 of them, each still held to T3's rules)
  const S16 = Array.from({ length: 24 }, (_, i) => i + 1);
  const stay = over(S16, s => baitRun(s, false)), fol = over(S16, s => baitRun(s, true));
  const lured = stay.filter(r => r.lureAt >= 0), lf = fol.filter(r => r.lureAt >= 0);
  // (Predator refinement R1, the owner's instruction for a very hungry one - .7 here: a bait nobody followed is one failed tactic, not the end
  // of the hunt.  What T3 protected stays - it lies in wait hidden and still, nobody follows, the wait ends within SK.lureMax and the bait is
  // recorded as failed; then it leaves, or (R1) goes on with the same hunt - listening, going after them - instead of a departure.)
  const okStay = lured.length >= 6 && lured.every(r => r.hidden && r.moved < 30 && r.lureD >= r.d0 - 30 && ((r.after === 'leave' && /did not follow/.test(r.why)) || r.huntOn) && r.dur <= AI.SK.lureMax + .5);
  const came = lf.filter(r => r.came > 0 && r.lureD < 320);
  return { ok: okStay && lf.length >= 6 && came.length >= lf.length - 1, note: `stays put: ${lured.length}/24 lay in wait, hidden ${lured.filter(r => r.hidden).length}, moved at most ${Math.max(...lured.map(r => Math.round(r.moved)))} px, gave up the wait after ${lured.map(r => r.dur).join('/')} s (then ${lured.map(r => r.huntOn ? 'hunted on' : r.after).join('/')}) ("${lured[0] && lured[0].why}") | follows: ${lf.length}/24 lay in wait, they came round the corner within ${lf.map(r => Math.round(r.lureD)).join('/')} px of it (${came.length} within 320)`, data: { stay, fol } };
});

add('SK22 the straight race: a fresh runner on a straight wins - it gives chase, falls behind and gives up for that reason; a winded one does not - it closes to striking distance', () => {
  const race = (seed, winded) => {
    const w = World(seed + 300), y = LONG.y;
    const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0; if (winded) p.exhaust();
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
    p.go(8700, y, 'run');
    let chased = false, dmin = 1e9, why = '', lossD = -1, runD = 1e9;
    w.run(14, () => { const d = Math.hypot(p.x - e.x, p.y - e.y); if (planOf(e) === 'chase') chased = true; else if (chased && !why) { why = e.dbg.why; lossD = d; } if (w.t > .5) dmin = Math.min(dmin, d);
      if (lossD >= 0 && p.tx !== null) runD = Math.min(runD, d); return true; });
    return { chased, dmin: Math.round(dmin), why, lossD: Math.round(lossD), runD: Math.round(runD), end: Math.round(Math.hypot(p.x - e.x, p.y - e.y)), lost: e.tally.chaseLost };
  };
  const fresh = over([1, 2, 3, 4], s => race(s, false)), tired = over([1, 2, 3, 4], s => race(s, true));
  // (Predator refinement R1: a hungry one that loses the race no longer leaves - it keeps to the runner's trail at its free walking pace.
  // T3's "1500 px apart after 14 s" measured the departure; what it protected - the fresh runner wins - is asserted directly instead: once
  // the race is lost, the gap never closes while they keep running - over these 14 s, a sprint; PR27 (R7) runs on until the runner is
  // winded and walking, and asserts the lead they won does not shrink then either.)
  // (R18: its run is 270, 15 px/s under the sprint: the gap grows by its chaseLose (170 px) in 11 s, and its breath (11 a second at its run)
  // gives out first, at about 7 s - "out of breath" is the chase's own end too, the same lost race; R8-R16i ran at 255 and lost the race
  // by distance first.  The invariant - the fresh runner wins, the gap never closes while they run on - is unchanged)
  // (R18: a winded runner it may also run down in an open approach at its press - R8-R16i always by a chase; what is held is that it closes)
  const ok = fresh.every(r => r.chased && /losing the race|out of breath/.test(r.why) && r.dmin >= 280 && r.runD >= r.lossD - 15) && tired.every(r => r.dmin <= 185);
  return { ok, note: `fresh: never closer than ${fresh.map(r => r.dmin).join('/')} px, gave up the chase ("${fresh[0].why}") ${fresh.map(r => r.lossD).join('/')} px behind, never closer than ${fresh.map(r => r.runD).join('/')} px while they ran on, ${fresh.map(r => r.end).join('/')} px apart after 14 s | winded: it closed to ${tired.map(r => r.dmin).join('/')} px (by a chase: ${tired.map(r => r.chased ? 'yes' : 'no').join('/')}) (striking distance ${AI.SK.approachStop}..185; the pounce is T4's)`, data: { fresh, tired } };
});

/* interception: a person with a torch walks north past wall C's gap, where it sees them; past the gap they switch the torch off and walk on.
 * A: they go the way their heading suggested (east along wall B, then north); B: they double back to wall A's gap (west).  Both runs are
 * the same until the person's routes part. */
const ROUTE = { A: { x: 1720, y: 4900 }, B: { x: 700, y: 5330 } };          // after (1300, 5150): on, round wall B's east end, or back west
function interceptRun(seed, v, X0) {
  const w = World(seed + 500);
  const p = w.player(1300, 5950, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', X0, 5570, { hunger: .6 }); e.tier = 'near'; e.ang = Math.PI;      // (T4: it sees the lit person through the gap ~1000 px off)
  const R = { tr: [], plan: null, at: -1, endAt: -1, why: '', waitD: 1e9, minD: 1e9, parted: -1 };
  w.run(35, (ww, i) => {
    if (w.t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5400 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; R.parted = R.tr.length; p.pathTo(ROUTE[v].x, ROUTE[v].y, 'walk'); }   // the routes part here
    if (p.light && p.y < 5440) p.light = false;
    const r = e.mem.p.get(p.id);
    // its position, then everything it has sensed of the person (sighting, record, the last sound and the leads): the evidence
    const H = e.hear, L = e.mem.leads.map(q => `${q.id}:${Math.round(q.x)}:${Math.round(q.y)}`).join(';');
    // (and the engine's level of detail, which N.A.N.I. sets for every species from the nearest player's distance: it changes how often
    //  a creature thinks, not what it knows - the comparison stops where it differs too)
    R.tr.push([Math.round(e.x * 10), Math.round(e.y * 10), [e.seenNow.has(p.id) ? 1 : 0, r ? [r.heardAt, r.seenAt, r.hx, r.hy, r.lkx, r.lky, r.lvx, r.lvy].map(v => Math.round(v * 10)).join(':') : '-', H ? `${H.id}:${Math.round(H.x)}:${Math.round(H.y)}` : '-', L, e.tier].join('|')].join(','));
    const P = e.plan;
    if (P && P.k === 'intercept' && R.at < 0) { R.at = w.t; R.plan = P; R.pred = e.dbg.predict; }
    if (R.plan && e.plan === R.plan) { const d = Math.hypot(p.x - e.x, p.y - e.y); R.minD = Math.min(R.minD, d); if (R.plan.arrived) R.waitD = Math.min(R.waitD, d); }
    if (R.plan && e.plan !== R.plan && R.endAt < 0) { R.endAt = w.t; R.why = e.dbg.why; R.next = e.plan ? e.plan.k : 'roam'; }
    return true;
  });
  return R;
}
add('SK23 interception: when it loses someone it goes round to where it guesses they will be and waits there out of sight; right when they keep to their way, wrong when they double back - and the two runs are the same Skin-Stealer until it senses the difference', () => {
  // (R18: twenty seeds - R18's quicker way to its spot sights them again on the way in most doubled-back runs (an interception that took
  // them up again: neither right nor wrong, below), so eight seeds gave one that waited in vain; R8-R16i: eight)
  const rs = Array.from({ length: 20 }, (_, i) => i + 1).map(seed => { const A = interceptRun(seed, 'A', 2300), B = interceptRun(seed, 'B', 2300); return { seed, A, B }; });
  // the evidence law: identical until either run's Skin-Stealer senses the person differently (a sighting or a sound only one has), or
  // the engine's level of detail differs
  let lawOk = 0;
  for (const { A, B } of rs) {
    let i = 0; const n = Math.min(A.tr.length, B.tr.length);
    for (; i < n; i++) { const a = A.tr[i].split(','), b = B.tr[i].split(','); if (a[2] !== b[2]) break; if (a[0] !== b[0] || a[1] !== b[1]) { i = -1; break; } }
    if (i < 0) continue; if (i >= Math.min(A.parted, B.parted)) lawOk++;
  }
  // A: the guess was right - it met them (they came within 300 px of it, on its way or where it waited) and it did not give up as wrong
  // (what it did then - stalk, spring, retreat - is its ordinary decision).  B: wherever it got to wait, nobody came within 300 px and it
  // said it guessed wrong (an interception that sighted them again on the way, and took them, is neither)
  const ia = rs.filter(r => r.A.plan), ib = rs.filter(r => r.B.plan), ibw = ib.filter(r => r.B.plan.arrived);
  const right = ia.filter(r => r.A.minD < 300 && !/guessed wrong/.test(r.A.why)), wrong = ibw.filter(r => r.B.waitD >= 300 && /guessed wrong/.test(r.B.why));
  const bounded = rs.every(r => [r.A, r.B].every(R => !R.plan || (R.endAt > 0 && R.endAt - R.at <= AI.SK.interceptMax + 8.5)));
  return { ok: lawOk === rs.length && ia.length >= 3 && ibw.length >= 3 && right.length >= Math.ceil(ia.length * .6) && wrong.length === ibw.length && bounded,
    note: `identical until it senses a difference (or its level of detail differs): ${lawOk}/${rs.length} | A (kept to their way): ${ia.length} interceptions, it met them within ${ia.map(r => Math.round(r.A.minD)).join('/')} px (${right.length} within 300; then ${ia.map(r => r.A.next).join('/')}) | B (doubled back): ${ibw.length} waited in vain, nearest ${ibw.map(r => Math.round(r.B.waitD)).join('/')} px, ${wrong.length} "guessed wrong" | every interception ended (${bounded})`,
    data: rs.map(r => ({ seed: r.seed, A: { at: r.A.at, minD: Math.round(r.A.minD), waitD: Math.round(r.A.waitD), why: r.A.why, next: r.A.next, pred: r.A.pred }, B: { at: r.B.at, waitD: Math.round(r.B.waitD), why: r.B.why, next: r.B.next } })) };
});

add('SK24 hearing: footsteps it really hears (a runner behind a wall) send a hungry one to look where it heard them; a quiet person in the same place sends it nowhere', () => {
  const runOnce = (seed, mode) => {
    const w = World(seed + 600);
    const p = w.player(780, 4950, { light: false, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1300, 5180, { hunger: .65 }); e.tier = 'near'; e.ang = 0;
    const R = { first: null, goal: null, there: null, sawFirst: false, dur: -1 };
    let P0 = null, LP = null;
    w.run(30, () => {
      if (w.t > 1 && !p.going) { p.going = 1; p.route([{ x: 780, y: 5300 }], mode); }
      if (e.seenNow.has(p.id) && !R.first) R.sawFirst = true;
      // (Predator refinement R2: roaming, a sound first makes it stop and listen - turned to it - and what it hears next sends it to look;
      // that listen is recorded, and the first plan judged is the one after it)
      if (!R.first && e.plan && e.plan.k === 'listen' && e.plan.curious) { R.listened = (R.listened || 0) + (e.plan === LP ? 0 : 1); LP = e.plan; }
      if (!R.first && e.plan && e.plan.k !== 'leave' && !(e.plan.k === 'listen' && e.plan.curious)) { R.first = e.plan.k; R.why = e.dbg.why; if (e.plan.k === 'search') { P0 = e.plan; R.goal = e.plan.goal; R.there = { x: p.x, y: p.y }; R.t0 = w.t; } }
      if (P0 && e.plan !== P0 && R.dur < 0) R.dur = +(w.t - R.t0).toFixed(1);
      return true;
    });
    R.off = R.goal ? Math.round(Math.hypot(R.goal.x - R.there.x, R.goal.y - R.there.y)) : -1; return R;
  };
  const run = over([1, 2, 3, 4, 5, 6], s => runOnce(s, 'run')), quiet = over([1, 2, 3, 4, 5, 6], s => runOnce(s, 'crouch'));
  const went = run.filter(r => r.first === 'search' && /heard/.test(r.why) && !r.sawFirst);
  const ok = went.length >= 3 && went.every(r => r.off < 250 && r.dur > 0 && r.dur <= AI.SK.searchMax + AI.SK.searchLook[1] + .5) && quiet.every(r => !(r.first === 'search' && /heard/.test(r.why)));
  return { ok, note: `running: ${went.length}/6 went to look, after listening ${went.map(r => r.listened || 0).join('/')} time(s) (goal ${went.map(r => r.off).join('/')} px from where the runner was; each search over in ${went.map(r => r.dur).join('/')} s) | crouching: ${quiet.filter(r => r.first === 'search').length}/6 went to look`, data: { run, quiet } };
});

add('SK25 every plan ends and no encounter outlasts its budget: an hour-like stretch of a person wandering, running, hiding and switching the torch, against a hungry one', () => {
  const MAX = { watch: AI.SK.watch[1] * 1.3 + .5, lure: AI.SK.lureMax + .5, intercept: AI.SK.interceptMax + 8.5, chase: AI.SK.chaseMax + .5, search: AI.SK.searchMax + AI.SK.searchLook[1] + .5, leave: AI.SK.leaveMax + .5 };
  const rs = over([1, 2, 3, 4], seed => {
    const w = World(seed + 700), pts = [{ x: 700, y: 5330 }, { x: 1300, y: 5900 }, { x: 1720, y: 4900 }, { x: 1900, y: 5560 }, { x: 600, y: 5900 }, { x: 1300, y: 5150 }];
    const p = w.player(700, 5900, { light: true }); p.stop('stand'); bystander(w);            // (the world keeps running after a death)
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

/* ---------------------------------------------------------------- T4: the strike and the kill */
const LAYOUT = require('../tools/layout.js');
/* every kill an entity made, checked: the killer's body had reached the victim's (contact), with nothing solid between them */
const contactOk = (w, k, e) => Math.hypot(k.geo.ax - k.victim.x, k.geo.ay - k.victim.y) < e.r + 18 + 1 && w.ad.clear(k.victim.x, k.victim.y, 4, 'walk') && w.eng.geo.lineClear(k.geo.ax, k.geo.ay, k.victim.x, k.victim.y, 3, 'walk');
/* a strike scenario: a hungry one at (5000, LONG.y); a person px away, standing (or doing what `drive` says), facing away */
function strike(seed, o) {
  const w = World(seed), y = LONG.y; bystander(w);
  const p = w.player(o.px, y, { light: true, angle: o.pa ?? 0 }); p.look = o.pa ?? 0; p.stop('stand'); if (o.winded) p.exhaust();
  const e = w.eng.spawn('skinstealer', 5000, y, { hunger: o.hunger ?? .7 }); e.tier = 'near'; e.ang = 0;
  const R = { windAt: -1, leapAt: -1, endAt: -1, x0: 0, stam0: 0, moved: 0, wind: 0, kills: [], ok: true };
  w.run(o.secs || 12, () => {
    if (o.drive) o.drive(w, p, e, R);
    if (e.pounce && R.windAt < 0) { R.windAt = w.t; R.x0 = e.x; R.y0 = e.y; R.stam0 = e.stam; }
    if (e.pounce && e.act === 'pounce' && R.leapAt < 0) { R.leapAt = w.t; R.wind = +(w.t - R.windAt).toFixed(2); R.wx = e.x; R.wy = e.y; }
    if (R.leapAt >= 0 && !e.pounce && R.endAt < 0) { R.endAt = w.t; R.moved = Math.round(Math.hypot(e.x - R.wx, e.y - R.wy)); R.stam1 = e.stam; R.how = e.dbg.pounce; R.recover = e.recover; R.cool = +(e.pounceCool - w.eng.now).toFixed(2); }
    return true;
  });
  R.kills = w.kills.filter(k => k.kind === 'SkinStealer'); R.contact = R.kills.every(k => contactOk(w, k, e)); R.w = w; R.p = p; R.e = e;
  return R;
}
add('SK30 the strike: a hungry one springs at someone unaware within reach - a crouched wind-up, a committed leap that costs stamina - and a body it reaches is killed: the kill and the victim\'s record name it', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const R = strike(seed + 900, { px: 5160 }), K = R.kills[0], pk = R.p.kill;
    return { ok: !!K && R.wind >= AI.SK.pounceWind - .02 && R.moved <= AI.SK.pounceSpeed * AI.SK.pounceDur + 5 && R.stam0 - R.stam1 >= AI.SK.pounceCost - 1 && R.contact &&
      pk && pk.k === 'SkinStealer' && pk.e === R.e.id && /^[ABC]$/.test(pk.v) && R.p.dead === 'SkinStealer', v: K && K.variant, wind: R.wind, moved: R.moved, cost: Math.round(R.stam0 - R.stam1), at: K && +K.at.toFixed(2) };
  });
  return { ok: rate(rs) === 1, note: rs.map(r => `${r.v || 'no kill'} at ${r.at} s (wind-up ${r.wind} s, leap ${r.moved} px, stamina -${r.cost})`).join(' | '), data: rs.map(r => ({ ...r, w: undefined })) };
});

add('SK31 counterplay: someone who sees the wind-up and steps aside makes it miss; it then stands recovering, cannot spring again at once, and has paid the stamina - a fresh runner is not taken while they run (one who stops later may be)', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const R = strike(seed + 920, { px: 5170, secs: 14, drive: (w, p, e, R) => {
      if (e.pounce && e.act === 'wind' && !p.dodged) { p.dodged = 1; p.look = null; p.route([{ x: p.x + 20, y: p.y - 150 }, { x: p.x + 1600, y: p.y - 150 }], 'run'); }   // the tell: it crouches - they break sideways, then run
      if (p.dodged && p.stoppedAt === undefined && p.mode === 'stand') p.stoppedAt = w.t;   // (R1) where their run ended
    } });
    // (predator refinement R1) "a fresh runner gets away" is judged while they run: a very hungry one no longer gives up the hunt when it
    // misses, so somebody who then stops in the open, facing away, may be hunted again later - reported, not counted as caught in the run
    const k0 = R.kills[0], stopAt = R.p.stoppedAt ?? 1e9, during = !!k0 && k0.at < stopAt;
    return { ok: R.how === 'missed' && R.recover >= AI.SK.recoverMiss[0] - .05 && R.cool >= AI.SK.pounceCool[0] - .05 && !during && R.stam0 - R.stam1 >= AI.SK.pounceCost - 1, how: R.how, recover: +(R.recover || 0).toFixed(2), cool: R.cool, kills: R.kills.length, during, later: !!k0 && !during, stopAt: stopAt < 1e9 ? +stopAt.toFixed(1) : -1, killAt: k0 ? +k0.at.toFixed(1) : -1 };
  });
  return { ok: rate(rs) >= 5 / 6, note: rs.map(r => `${r.how}, recovering ${r.recover} s, ${r.cool} s before another, ${r.during ? 'KILLED while running' : r.later ? `got away; hunted again after they stopped (${r.stopAt} s) and taken at ${r.killAt} s` : 'got away'}`).join(' | '), data: rs };
});

add('SK32 lethal only on contact: every kill it makes has its body against the victim\'s with nothing solid between; someone behind a wall within reach of its leap is never taken through it', () => {
  // wall A of the dark south-west (x 976..1072, y 4898..5282): a person crouched on one side, a hungry one on the other, 190 px apart
  const through = over([1, 2, 3, 4], seed => {
    const w = World(seed + 940); bystander(w);
    const p = w.player(925, 5100, { light: false, angle: 0 }); p.stop('crouch');
    const e = w.eng.spawn('skinstealer', 1120, 5100, { hunger: .8 }); e.tier = 'near'; e.ang = Math.PI;
    let springs = 0; const walls = [];
    w.run(20, () => { if (e.pounce && e.act === 'pounce' && !e.__c) { e.__c = 1; springs++; } if (!e.pounce) e.__c = 0; return true; });
    const ks = w.kills.filter(k => k.kind === 'SkinStealer');
    return { ok: ks.every(k => contactOk(w, k, e)), springs, kills: ks.length, contact: ks.every(k => contactOk(w, k, e)) };
  });
  // and every kill of the other T4 scenarios
  const others = [1, 2, 3].map(seed => strike(seed + 960, { px: 5150 })).concat([1, 2, 3].map(seed => strike(seed + 970, { px: 5250, winded: true, drive: (w, p) => { if (!p.go2) { p.go2 = 1; p.go(8000, LONG.y, 'run'); } } })));
  const allK = others.flatMap(R => R.kills), allOk = others.every(R => R.contact);
  return { ok: rate(through) === 1 && allOk && allK.length >= 5, note: `behind wall A: ${through.map(r => `${r.kills} kill(s) after ${r.springs} spring(s), contact ${r.contact}`).join(' / ')} | ${allK.length} kills elsewhere, every one at contact with a clear line: ${allOk}` };
});

add('SK33 its three deaths: it weighs a landed pounce toward B (carried down, the neck), a grab toward A (the neck), a winded, cornered or starving kill toward C (held, bitten); every real kill is one of A-C (R15: or D, the Rend, and that only from a grab); an admin "play" setting never makes it play with its prey', () => {
  const V = AI.SKIN.capture.variants, w0 = World(1099), e0 = w0.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .6 });
  const top = items => items.slice().sort((a, b) => b.w - a.w)[0].k, ctx = { deadEnd: false }, pv = { ex: 0, stamina: 100 };
  const weights = {
    pounce: top(V(w0.eng, e0, pv, ctx, { style: 'pounce', speed: 400 })), grab: top(V(w0.eng, e0, pv, ctx, { style: 'grab', speed: 190 })),
    winded: top(V(w0.eng, e0, { ex: 1, stamina: 5 }, ctx, { style: 'grab', speed: 190 })),
    cornered: top(V(w0.eng, e0, pv, { deadEnd: true }, { style: 'grab', speed: 190 })) + '/' + V(w0.eng, e0, pv, { deadEnd: true }, { style: 'grab' }).find(x => x.k === 'C').w.toFixed(2),
  };
  e0.hunger = .85; weights.starving = top(V(w0.eng, e0, { ex: 1, stamina: 5 }, ctx, { style: 'pounce', speed: 400 }));
  const real = {}, bad = [];
  for (let seed = 1; seed <= 6; seed++) for (const R of [strike(seed + 1000, { px: 5160 }), strike(seed + 1020, { px: 5040 }), strike(seed + 1040, { px: 5250, winded: true, drive: (w, p) => { if (!p.go2) { p.go2 = 1; p.go(8000, LONG.y, 'run'); } } })])
    for (const k of R.kills) { real[k.variant] = (real[k.variant] || 0) + 1; if (!/^[ABCD]$/.test(k.variant) || (k.variant === 'D' && Math.hypot(k.geo.ax - k.victim.x, k.geo.ay - k.victim.y) > AI.SK.grabReach + 6)) bad.push(k.variant); }   // (R15: D, the Rend, from a grab only - s_skinrend G08)
  // the admin's "every catch is played with" (DEATHS tab): the Skin-Stealer still kills at once
  const w = World(1100); bystander(w); w.sim.admin.captureMode('play');
  const p = w.player(5160, LONG.y, { light: true, angle: 0 }); p.look = 0; p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
  let caughtLong = 0; w.run(8, () => { if (p.caught) caughtLong += DT; return true; });
  const quick = w.kills.some(k => k.kind === 'SkinStealer') && caughtLong < .1;
  const ok = weights.pounce === 'B' && weights.grab === 'A' && weights.winded === 'C' && weights.starving === 'C' && !bad.length && Object.keys(real).length >= 2 && quick;
  return { ok, note: `heaviest: a landed pounce ${weights.pounce}, a grab ${weights.grab}, a winded victim ${weights.winded}, cornered (C weight) ${weights.cornered}, starving + winded ${weights.starving} | ${Object.values(real).reduce((a, b) => a + b, 0)} real kills ${JSON.stringify(real)} | with the admin's "play": killed at once ${quick}` };
});

add('SK34 its deaths in G.I.B.\'s physics: each of A-C, in the open, against walls, in a corner, moving, exhausted - no jumps, no wall clipping, everything at rest, the neck snaps once (A, B) and the fight ends there; the Hound\'s and the Smiler\'s 144 deaths are bit for bit P9\'s', () => {
  const fs = require('fs'), crypto = require('crypto'), box = {};
  new Function('window', fs.readFileSync(LAYOUT.at('dphys.js'), 'utf8'))(box);
  const DP = box.__dphys, hyp = Math.hypot, bad = [];
  const SC = { open: [], wallBehind: [{ x: 96, y: -2000, w: 900, h: 4000 }], wallSide: [{ x: -2000, y: 34, w: 4000, h: 900 }], corner: [{ x: 84, y: -2000, w: 900, h: 4000 }, { x: -2000, y: 50, w: 4000, h: 900 }] };
  let n = 0, worst = 0, closest = 99;
  for (const v of ['A', 'B', 'C']) for (const [sn, rects] of Object.entries(SC)) for (const mv of [0, 160]) for (const exh of [false, true]) for (let seed = 0; seed < 3; seed++) {
    const P = DP.PLAN('SkinStealer', v, 40), dur = DP.DURS.SkinStealer[v];
    const S = DP.create({ kind: 'SkinStealer', v, victim: { x: 0, y: 0, angle: 0, vx: mv, vy: 0 }, src: { x: -46, y: 0 }, dir: 0, hits: P.hits, kn: rects.length ? 30 : P.kn, drag: 0, seed: 777 + seed, exhausted: exh, eqKind: 'flashlight', hat: 'cap', walls: () => rects, dur });
    let prev = null, res0 = 0;
    for (let i = 0; i <= 60 * (dur + .4); i++) {
      DP.advance(S, i / 60); const b = S.b;
      if (prev) worst = Math.max(worst, hyp(b.x - prev.x, b.y - prev.y));
      for (const q of rects) { const cx = Math.max(q.x, Math.min(b.x, q.x + q.w)), cy = Math.max(q.y, Math.min(b.y, q.y + q.h)); closest = Math.min(closest, hyp(b.x - cx, b.y - cy)); }
      if (S.snapped !== undefined && S.t > S.snapped + .05) res0 = Math.max(res0, S.res);
      prev = { x: b.x, y: b.y };
    }
    n++;
    const snaps = S.ev.filter(q => q.k === 'snap').length, want = v === 'C' ? 0 : 1, rest = S.state !== 'ACTIVE' || hyp(S.b.vx, S.b.vy) < 12;
    if (snaps !== want || res0 > 0 || !rest || !isFinite(S.b.x) || (want && Math.abs(S.snapped - DP.CFG.SkinStealer[v].snap) > .01)) bad.push(`${v} ${sn} mv${mv} ex${exh} #${seed}: snaps ${snaps} res after ${res0} rest ${rest}`);
  }
  const golden = require('crypto').createHash('sha256').update(JSON.stringify(P9_DEATHS(DP))).digest('hex');
  const P9_HASH = '0db6347882071867d2f8bd9a078b2eee060b2355da8a3a55451fd0004f3dfc3b';   // P9's own generated/server/dphys.js (1ff9374), the same 144 deaths
  return { ok: !bad.length && worst <= 16 && closest >= 15 && golden === P9_HASH, note: `${n} Skin-Stealer deaths: worst body step ${worst.toFixed(1)} px/frame, closest to a wall ${closest.toFixed(1)} px (radius 18)${bad.length ? '; ' + bad.slice(0, 3).join('; ') : ''} | Hound + Smiler: ${golden === P9_HASH ? 'identical to P9' : 'DIFFERENT from P9'} (sha256 ${golden.slice(0, 12)})` };
});
/* the Hound's and the Smiler's deaths (both P9 killers), every number dphys.simulate gives, over a grid of variants, motions, exhaustion
 * and lights (the hash of the same grid run on P9's own dphys.js is the test's constant) */
function P9_DEATHS(DP) {
  const out = [], walls = (x, y) => [{ x: 380, y: -400, w: 60, h: 900 }, { x: -500, y: 210, w: 1000, h: 40 }];
  const clear = (x, y, r) => !(x + r > 380 && x - r < 440 && y + r > -400 && y - r < 500) && !(y + r > 210 && y - r < 250);
  let n = 0;
  for (const kind of ['Hound', 'Smiler']) for (const v of ['A', 'B', 'C', 'D']) for (const [vx, vy, ang, sx, sy] of [[0, 0, 0, -46, 0], [120, 30, 1.2, 40, -30], [-60, 80, 3.0, 20, 44]]) for (const exh of [false, true]) for (const eq of ['flashlight', 'lantern', 'headlamp']) {
    const o = { kind, v, victim: { x: 300, y: 120, angle: ang }, src: { x: 300 + sx, y: 120 + sy }, vx, vy, exhausted: exh, eqKind: eq, hat: n % 2 ? 'hardhat' : 'none', w: kind === 'Hound' && v === 'C' ? [380, 120, 0] : 0, walls, clear };
    const R = DP.simulate(o), m = R.remains;
    out.push({ kind, v, n: n++, dur: R.dur, body: R.body, attacker: R.attacker, bursts: R.bursts, dropped: m.dropped, hat: m.hat, hands: m.hands, ev: R.S.ev.map(q => [q.t, q.k]), state: R.S.state, steps: R.S.stepN });
  }
  return out;
}

add('SK35 G.I.B. carries the killer: the replay message, the death\'s length, the server\'s own corpse (cause SkinStealer, one per player) and the killer placed where the death left it', () => {
  const D = require(LAYOUT.at('death_srv.js')), info = { name: 'k', look: 'none|a', ek: 'flashlight', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, light: true };
  const w = World(1200); bystander(w);
  const p = w.player(5160, LONG.y, { light: true, angle: 0 }); p.look = 0; p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5000, LONG.y, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
  w.run(3, () => !w.kills.length || true);
  const kill = Object.assign({}, p.kill), fx = D.fxFor(p.id, kill, info), dur = D.durOf(kill), R = D.bodyFor(p.id, kill, info, w.sim);
  // the server's aftermath places the killer where the death left it (aftermath.js: killerEnd for a Skin-Stealer, as for a Hound)
  const before = { x: e.x, y: e.y }, placed = w.sim.killerEnd(p.id, R.attacker.x, R.attacker.y, R.attacker.angle);
  w.sim.setBody(p.id, R.body); w.sim.setBody(p.id, D.bodyFor(p.id, kill, info, w.sim).body);       // a second record for the same player replaces the first
  const mine = [...w.sim.bodies ? w.sim.bodies.values() : []].filter(b => b.k === p.id);
  const ok = kill.k === 'SkinStealer' && fx.c === 'SkinStealer' && fx.v === kill.v && Math.abs(dur - { A: 3.2, B: 3.4, C: 3.5 }[kill.v]) < 1e-9 && R.body.c === 'SkinStealer' && R.dur === dur &&
    placed === true && Math.hypot(e.x - R.attacker.x, e.y - R.attacker.y) < 1 && (!w.sim.bodies || mine.length === 1);
  return { ok, note: `kill ${kill.k} ${kill.v}: replay c=${fx.c}, ${dur} s; the server's corpse c=${R.body.c}; killer placed ${placed} (${Math.round(Math.hypot(before.x - e.x, before.y - e.y))} px from where it stood)${w.sim.bodies ? `; bodies for the player: ${mine.length}` : ''}` };
});

/* ---- T6: deception: what it hears, what it says, the skin it earns, how it behaves in it ---- */
const LOOK = 'cap|freckles|#aabbcc|#112233|none';
/* a kill it makes (the strike's own scene), the death's end as the server's aftermath ends it (killerEnd, then the look of the person it
 * killed), then its meal: undisturbed, or (o.watcher) somebody walks up and watches it a few seconds into the meal */
function skinRun(seed, o = {}) {
  const w = World(seed), y = LONG.y; bystander(w);
  const p = w.player(5160, y, { light: true, angle: 0 }); p.look = 0; p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
  const R = { feedAt: -1, donAt: -1, skinAt: -1, seen: [], fedFor: 0 };
  let q = null;
  w.run(o.secs || 60, () => {
    if (R.skinAt < 0 && p.kill && !e.commit && planOf(e) === 'feed') {            // the death has played: the aftermath's two calls
      w.sim.killerEnd(p.id, e.x, e.y, e.ang); R.took = w.eng.skinFrom(e.id, p.id, o.look || LOOK); R.skinAt = w.t; R.feedAt = w.t;
    }
    if (o.watcher && !q && R.feedAt >= 0 && w.t - R.feedAt > o.watcher) {          // somebody walks up and watches it at its meal
      const s = floorNear(w, e.x + 330, e.y); q = w.player(s.x, s.y, { light: true, angle: Math.PI }); q.stop('stand'); q.look = Math.PI; R.watchAt = w.t;   // (beyond the body, in front of it)
    }
    if (planOf(e) === 'feed' && e.plan.fed) R.fedFor = e.plan.fed;
    if (e.disguise && R.donAt < 0) R.donAt = w.t;
    return true;
  });
  R.w = w; R.p = p; R.e = e; R.q = q; return R;
}
add('SK40 its ears: a line a person says reaches a Skin-Stealer only from within 576 px; it keeps at most 4 for at most 90 s, none of a person who has left; a Hound or a Smiler gets nothing; the words never reach the admin overlay; a voice is also a sound it can go after', () => {
  const w = World(4001), y = LONG.y; bystander(w);
  const a = w.player(5000, y, { light: false }); a.stop('stand');
  const b = w.player(7000, y, { light: false }); b.stop('stand');
  const k1 = w.eng.spawn('skinstealer', 5500, y, { hunger: .3 }), k2 = w.eng.spawn('skinstealer', 5000, y + 700, { hunger: .3 }), h = w.eng.spawn('hound', 5300, y);
  for (const e of [k1, k2, h]) e.tier = 'near';
  w.run(.5);
  const said = (p, text) => w.eng.hearSpeech({ id: p.id, x: p.x, y: p.y, text });
  const n1 = said(a, 'Wait For Me!');                                             // k1 is 500 px away; k2 700 px; the Hound has no ears for it
  const kept1 = k1.heard.length, kept2 = k2.heard.length, houndHeard = !!h.heard;
  const heardType = k1.hear && k1.hear.type;
  for (const t of ['two', 'three', 'four', 'five']) said(a, t);
  const max = k1.heard.length, oldest = k1.heard[0].text;
  const dbg = JSON.stringify(w.sim.debugInfo());
  said(b, 'far away');                                                            // 1500 px from k1
  const far = k1.heard.some(q => q.text === 'far away');
  w.sim.removePlayer(a); w.run(1);
  const gone = k1.heard.filter(q => q.pid === a.id).length;
  const k3 = w.eng.spawn('skinstealer', 6600, y, { hunger: .3 }); k3.tier = 'near'; w.run(.2);
  said(b, 'old words'); const fresh = k3.heard.length; w.run(AI.SK.heardTtl + 1); const expired = k3.heard.length;
  const ok = n1 === 1 && kept1 === 1 && kept2 === 0 && !houndHeard && heardType === 'voice' && max === 4 && oldest === 'two' && !/Wait For Me|three|four|five/.test(dbg) && !far && gone === 0 && fresh === 1 && expired === 0;
  return { ok, note: `500 px: kept (${kept1}), 700 px: not (${kept2}), the Hound: ${houndHeard ? 'heard!' : 'nothing'}; heard as a ${heardType} sound; at most ${max} kept (oldest now "${oldest}"); 1500 px: ${far ? 'kept!' : 'not kept'}; the admin overlay holds no word; after its speaker left: ${gone}; after ${AI.SK.heardTtl + 1} s: ${expired} of ${fresh}` };
});
add('SK41 its lines from hiding: lying in wait, hungry and unseen, it calls out once - the opening words of a line somebody else said nearby (lower case, at most 6 words), or with nothing heard one of a few generic calls; never while it is seen, never two lines closer than the gap, never more than 3 an encounter', () => {
  const out = [];
  const run = (seed, heard) => {
    const w = World(seed + 400), g = w.eng.geo, lines = [];
    const p = w.player(SW.gapP.x, SW.gapP.y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const o = w.player(SW_K.x - 450, SW.gapP.y + 40, { light: false }); o.stop('crouch');   // (in the dark, crouched, 450 px from it: it hears them, does not see them)
    const e = w.eng.spawn('skinstealer', SW_K.x, SW_K.y, { hunger: .7 }); e.tier = 'near'; e.ang = Math.PI;   // (R13: as SK21, it starts met by their eyes)
    w.eng.voiceOut = L => lines.push(Object.assign({ at: w.t, plan: planOf(e), seenNow: g.los(p.x, p.y, e.x, e.y) && e.seenNow.has(p.id) }, L));
    w.run(.3); if (heard) w.eng.hearSpeech({ id: o.id, x: o.x, y: o.y, text: 'Is Anybody Over There? I lost my light near the stairs' });
    w.run(40);
    return { lines, tally: e.tally, w };
  };
  // (predator refinement R1) a very hungry one now answers being seen by going round them as often as by the bait (its hunt's own
  // seeded choice), so not every run lies in wait: the runs that did (sixteen seeds) are judged - each called out from hiding - and
  // enough of them must have
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], s => {
    const A = run(s, true), B = run(s, false), bad = [];
    const la = A.lines, lb = B.lines, wa = A.tally.lure > 0, wb = B.tally.lure > 0;
    if (!wa && !wb) return { ok: true, waited: 0, a: [], b: [] };
    if ((wa && !la.length) || (wb && !lb.length)) bad.push(`no line (${la.length}/${lb.length}, lay in wait ${wa ? 1 : 0}/${wb ? 1 : 0})`);
    for (const L of la.concat(lb)) { if (L.plan !== 'lure') bad.push('said in ' + L.plan); if (L.seenNow) bad.push('said while seen'); }
    if (la[0] && !(la[0].o > 0 && /^is anybody over there\? i lost(\.\.\. lost)?$/.test(la[0].text) && la[0].text.split(' ').length <= 7 && la[0].text === la[0].text.toLowerCase())) bad.push('heard line ' + JSON.stringify(la[0].text));
    if (lb[0] && !(lb[0].o === 0 && ['hello?', 'is someone there?', 'over here', 'wait for me', 'can you help me?', "i'm lost", 'this way'].includes(lb[0].text))) bad.push('bait ' + JSON.stringify(lb[0].text));
    for (const L of [la, lb]) for (let i = 1; i < L.length; i++) if (L[i].at - L[i - 1].at < AI.SK.sayGap[0] - .05) bad.push('too close');
    if (la.length > AI.SK.sayEnc || lb.length > AI.SK.sayEnc) bad.push('too many');
    out.push(la[0] && la[0].text, lb[0] && lb[0].text);
    return { ok: !bad.length, bad, waited: (wa ? 1 : 0) + (wb ? 1 : 0), a: la.map(L => L.text), b: lb.map(L => L.text) };
  });
  const waited = rs.filter(r => r.waited), n = rs.reduce((q, r) => q + (r.waited || 0), 0);
  return { ok: n >= 6 && rate(waited) >= 5 / 6, note: `lay in wait in ${n} of 32 runs; ${waited.filter(r => r.ok).length}/${waited.length} seeds right; said: ${[...new Set(out.filter(Boolean))].map(t => JSON.stringify(t)).join(', ')}${rs.some(r => !r.ok) ? ' | ' + rs.filter(r => !r.ok).map(r => r.bad ? r.bad.join(';') : r.err).join(' | ') : ''}`, data: rs };
});
add('SK42 the skin is earned: only at a kill it made, only if it then feeds 8 s; it wears exactly the look\'s four drawn fields (never a name, light or id) and the snapshot shows it as a wanderer\'s look; disturbed at its meal sooner, it leaves the skin; a bad look is refused; one that never killed never wears one', () => {
  const rs = over([1, 2, 3, 4], s => {
    const A = skinRun(4200 + s), B = skinRun(4200 + s, { watcher: 3 });
    const ss = A.w.sim.entities().ss || [], me = ss.find(t => t.i === A.e.id), bad = [];
    if (!A.took || !A.e.disguise || A.e.disguise.look !== 'cap|freckles|#aabbcc|#112233' || A.e.disguise.from !== A.p.id) bad.push('no skin: ' + JSON.stringify(A.e.disguise));
    if (A.fedFor < AI.SK.skinFeed) bad.push('fed only ' + A.fedFor);
    if (!me || me.dg !== 'cap|freckles|#aabbcc|#112233' || Object.keys(me).join() !== 'i,x,y,a,s,ac,v,h,dg') bad.push('snapshot ' + JSON.stringify(me));
    if (B.e.disguise || B.e.tally.skinLost !== 1) bad.push(`disturbed: ${JSON.stringify(B.e.disguise)} lost ${B.e.tally.skinLost}`);
    return { ok: !bad.length, bad, don: A.donAt >= 0 ? +(A.donAt - A.feedAt).toFixed(1) : -1, fed: +A.fedFor.toFixed(1), bfed: +B.fedFor.toFixed(1) };
  });
  const w = World(4290), y = LONG.y; bystander(w); const e = w.eng.spawn('skinstealer', 5000, y), h = w.eng.spawn('hound', 6000, y);
  const refused = ['', 'none', 'cap|freckles|#aabbcc', '<b>|freckles|#aabbcc|#112233', 'cap|freckles|red|#112233', 'cap|freckles|#aabbcc|#112233|none|extra|x'].every(l => !w.eng.skinFrom(e.id, 7, l)) && !w.eng.skinFrom(h.id, 7, LOOK) && !w.eng.skinFrom(9999, 7, LOOK);
  // a long stretch of SK25's sort without a kill: never a skin
  const p = w.player(5300, y, { light: true }); let worn = 0; w.run(60, () => { if (e.disguise) worn++; return true; });
  return { ok: rate(rs) === 1 && refused && worn === 0, note: `${rs.filter(r => r.ok).length}/4: worn after feeding ${rs.map(r => r.don).join('/')} s of its meal (fed ${rs.map(r => r.fed).join('/')} s); disturbed after ${rs.map(r => r.bfed).join('/')} s: no skin | bad looks and other killers refused: ${refused} | 60 s without a kill: worn ${worn} ticks${rs.some(r => !r.ok) ? ' | ' + rs.filter(r => !r.ok).map(r => r.bad ? r.bad.join(';') : r.err).join(' | ') : ''}`, data: rs };
});
/* a Skin-Stealer in the skin of P (skinRun), its meal over; then a newcomer: stands in its way (o.stand), or walks up to it */
function inSkin(seed, o = {}) {
  const A = skinRun(seed); const w = A.w, e = A.e, R = { lines: [], vmax: 0, plans: new Set(), springAt: -1, springD: -1, stareAt: -1, revealAt: -1, wasMingle: false, retreat: false };
  if (!e.disguise) return { ok: false, why: 'no skin' };
  e.hunger = o.hunger; w.eng.voiceOut = L => R.lines.push(Object.assign({ at: w.t }, L));
  const s = floorNear(w, e.x + (o.dx || 560), e.y); const q = w.player(s.x, s.y, { light: true, angle: Math.PI }); q.stop('stand'); q.look = Math.PI;
  const t0 = w.t; let last = { x: e.x, y: e.y };
  w.run(o.secs || 30, () => {
    const k = planOf(e); R.plans.add(k); if (k === 'mingle') R.wasMingle = true; if (k === 'retreat') R.retreat = true;
    if (e.disguise) { R.vmax = Math.max(R.vmax, Math.hypot(e.x - last.x, e.y - last.y) / DT); }
    last = { x: e.x, y: e.y };
    if (k === 'mingle' && e.plan.ph === 'stare' && R.stareAt < 0) { R.stareAt = w.t; R.stareD = Math.hypot(q.x - e.x, q.y - e.y); }
    if (e.pounce && R.springAt < 0) { R.springAt = w.t; R.springD = Math.hypot(q.x - e.x, q.y - e.y); R.skinAtSpring = !!e.disguise; }
    if (!e.disguise && R.revealAt < 0) R.revealAt = w.t;
    if (o.walk && w.t - t0 > o.walk && !q.going) { q.going = 1; q.route([{ x: e.x + 20, y: e.y }], 'walk'); }
    return true;
  });
  R.e = e; R.q = q; R.w = w; R.kills = w.kills.filter(k => k.kind === 'SkinStealer' && k.pid === q.id); R.left = planOf(e) === 'leave' || R.plans.has('leave');
  return R;
}
add('SK43 in its skin: it does not hide when seen - it walks up openly no faster than 150 px/s, stops some way off and stares, says a line; hungry, it closes in and springs only from 120 px, the wind-up dropping the skin; not hungry, it looks them over and walks on, still in the skin', () => {
  const H = over([1, 2, 3, 4], s => inSkin(4300 + s, { hunger: .55 })), L = over([1, 2, 3, 4], s => inSkin(4300 + s, { hunger: .12, secs: 25 }));
  const okH = H.filter(r => r.wasMingle && !r.retreat && r.vmax <= AI.SKIN.speeds.disguise + 3 && r.stareAt >= 0 && r.lines.length >= 1 && r.springAt >= 0 && r.springD <= AI.SK.mingleStrike + 25 && r.skinAtSpring === false && r.revealAt >= 0 && r.revealAt <= r.springAt + .05);
  const okL = L.filter(r => r.wasMingle && !r.retreat && r.stareAt >= 0 && r.springAt < 0 && r.left && r.e.disguise);
  return { ok: okH.length >= 3 && okL.length >= 3, note: `hungry: ${okH.length}/4 walked up (top ${H.map(r => Math.round(r.vmax || 0)).join('/')} px/s), stared from ${H.map(r => Math.round(r.stareD || 0)).join('/')} px, spoke ${H.map(r => r.lines ? r.lines.length : 0).join('/')}x, sprang from ${H.map(r => Math.round(r.springD)).join('/')} px (skin off at the wind-up), kills ${H.map(r => r.kills ? r.kills.length : 0).join('/')} | not hungry: ${okL.length}/4 stared then walked on in the skin, never sprang`, data: { H: H.map(r => ({ ...r, e: undefined, q: undefined, w: undefined, plans: r.plans && [...r.plans] })), L: L.map(r => ({ ...r, e: undefined, q: undefined, w: undefined, plans: r.plans && [...r.plans] })) } };
});
add('SK44 the skin ends: when its time is up, when it breaks into a run after somebody who flees (hungry), and with the entity (removed, or a world reset); the snapshot then shows no look', () => {
  const A = skinRun(4401), e = A.e, w = A.w, bad = [];
  if (!e.disguise) return { ok: false, note: 'no skin' };
  e.disguise.until = w.eng.now + 1; w.run(2); if (e.disguise || e.tally.reveal !== 1) bad.push('time: ' + JSON.stringify(e.disguise));
  if ((w.sim.entities().ss || []).some(t => t.dg)) bad.push('snapshot still dg');
  const B = skinRun(4402), f = B.e; f.hunger = .7; let chased = false, skinInChase = false;
  const s = floorNear(B.w, f.x + 300, f.y), q = B.w.player(s.x, s.y, { light: true, angle: Math.PI }); q.stop('stand'); q.look = Math.PI;
  B.w.run(1.5); q.look = null; q.route([{ x: q.x + 2000, y: q.y }], 'run');
  B.w.run(6, () => { if (planOf(f) === 'chase') { chased = true; if (f.disguise) skinInChase = true; } return true; });
  if (!chased || skinInChase) bad.push(`chase ${chased}, in skin ${skinInChase}`);
  const C = skinRun(4403); const id = C.e.id; C.w.sim.admin.removeSkinStealer(); const goneC = !C.w.eng.entities.some(x => x.id === id) && !(C.w.sim.entities().ss || []).length;
  const D = skinRun(4404); D.w.sim.resetWorld(); const goneD = !D.w.eng.entities.some(x => x.kind === 'skinstealer' && x.disguise);
  if (!goneC || !goneD) bad.push(`removed ${goneC}, reset ${goneD}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `time up: dropped (reveals ${e.tally.reveal}); a runner: it dropped the skin to give chase; removed and world reset: gone` };
});

module.exports = S;
