/* SKIN-STEALER scenarios (Trial 3; dev/trial-3-skin-stealer/).  Each runs on the real simulation (sim.js + ai.js) with the harness's
 * scripted players (the game's own move.js model); seeded and headless.  T1: the species' identity and plumbing. */
'use strict';
const { World, DT, LONG, over, rate, AI } = require('./lib.js');
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
  const ok = /RECORD/.test(r1) && tg === p.id && /CLEARED/.test(r2) && e.target === null && ok3 && goal && goal.x === 5000 && !bad.length;
  return { ok, note: `hunt: "${r1}" (${st1}, target ${tg}); clear: "${r2}" (${st2}); summon: ${ok3} -> goal ${goal && goal.x},${goal && goal.y} (${st3}); 3 s later ${st4}` };
});

module.exports = S;
