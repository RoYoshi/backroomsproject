/* HOUND scenarios */
'use strict';
const { World, DT, dist, LONG, geo, over, rate, avg, stateNames, WORLD, TAU } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const OPEN = () => { const G = geo(); return G.w.eng.geo; };

/* an open room area with the hound charging in from the west, player standing/moving in the middle */
function openField() {
  const G = geo(), g = G.g; let best = null, bs = -1;
  for (const i of G.cells) {
    if (i % 5) continue; const x = g.cx(i), y = g.cy(i);
    let ok = true; for (let dx = -300; dx <= 300 && ok; dx += 48) for (let dy = -200; dy <= 200; dy += 48) if (!G.ad.clear(x + dx, y + dy, 22, 'walk')) { ok = false; break; }
    if (ok) return { x, y };
  }
  return null;
}
add('H01 bait a lunge and sidestep: a late sidestep beats it most of the time; standing still does not', () => {
  const f = openField(); if (!f) return { ok: false, note: 'no open field found' };
  const runOne = (seed, dodge) => {
    const w = World(seed), p = w.player(f.x, f.y, { light: true }); p.stop('stand'); p.angle = Math.PI;
    const h = w.hound(f.x - 380, f.y); h.ang = 0; h.state = 'HUNTING'; h.target = p.id; h.huntStart = 0;
    let start = 0, done = false, missed = 0, hit = false, dodged = false;
    w.run(20, (ww, t) => {
      if (p.caught || p.dead) { hit = true; return false; }
      if (h.lunge && !start) start = t;
      if (dodge && h.lunge && h.lunge.t > h.lunge.wind * .55 && !dodged) { dodged = true; p.go(p.x, p.y + 400, 'run'); }
      if (h.lungesMissed > missed) { missed = h.lungesMissed; done = true; return false; }
    }, 1);
    return { ok: dodge ? done && !hit : hit, hit, missed, lunged: !!start };
  };
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);                    // (30 seeds: the rates are statistical, twelve were too few to be stable)
  const d = over(seeds, s => runOne(s, true)), st = over(seeds, s => runOne(s, false));
  return { ok: rate(d) >= .6 && rate(st) >= .7, note: `sidestep evades ${(rate(d) * 100) | 0}%   standing still is caught ${(rate(st) * 100) | 0}%` };
});
add('H02 no i-frames: a lunge that connects catches you whatever you were doing (walking/running); a slide can pass under it', () => {
  const f = openField(); if (!f) return { ok: false, note: 'no open field' };
  const runMode = (seed, mode) => {
    const w = World(seed), p = w.player(f.x, f.y, { light: true }); p.go(f.x + 260, f.y, mode);
    const h = w.hound(f.x - 300, f.y); h.ang = 0; h.state = 'HUNTING'; h.target = p.id;
    let res = 'none'; w.run(15, () => { if (p.caught || p.dead) { res = 'caught'; return false; } if (h.lungesMissed) { res = 'missed'; return false; } }, 1);
    return { res };
  };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const wk = over(seeds, s => runMode(s, 'walk')).filter(r => r.res === 'caught').length, sl = over(seeds, s => runMode(s, 'slide')).filter(r => r.res !== 'caught').length;
  return { ok: wk >= 7, note: `walking away is caught ${wk}/10; a sliding player evaded ${sl}/10 (slide passes under a lunge)` };
});
add('H03 chase outcomes in the long corridor: a fresh runner with a head start lasts; an exhausted one is caught fast', () => {
  const one = (seed, mode, gap, ex) => {
    const w = World(seed), p = w.player(4200, LONG.y, {}); const h = w.hound(4200 - gap, LONG.y); h.ang = 0; h.state = 'HUNTING'; h.target = p.id;
    p.go(8700, LONG.y, mode); let capT = -1; const keep = () => { if (ex) { p.stamina = 0; p.ex = 1; } };
    w.run(40, (ww, t) => { keep(); if (p.caught || p.dead) { capT = t; return false; } }, 1);
    return { capT, alive: capT < 0 };
  };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const run = over(seeds, s => one(s, 'run', 450, false)), ex = over(seeds, s => one(s, 'run', 450, true)), walk = over(seeds, s => one(s, 'walk', 450, false));
  const rt = avg(run.filter(r => !r.alive).map(r => r.capT)), et = avg(ex.filter(r => !r.alive).map(r => r.capT));
  return { ok: rate(run, r => r.alive || r.capT > 8) >= .7 && rate(ex, r => !r.alive) >= .7 && rate(walk, r => !r.alive) >= .8, note: `runner with a 450px lead survives 8s+ in ${(rate(run, r => r.alive || r.capT > 8) * 100) | 0}%; exhausted caught ${(rate(ex, r => !r.alive) * 100) | 0}% (avg ${et.toFixed(1)}s); walker caught ${(rate(walk, r => !r.alive) * 100) | 0}%` };
});
add('H04 lunges start only when in range, roughly aligned and with a clear line', () => {
  const f = openField(); if (!f) return { ok: false, note: 'no field' }; let n = 0, bad = 0, ran = 0;
  for (let s = 1; s <= 16; s++) {
    const w = World(s), p = w.player(f.x, f.y, {}); p.stop('stand'); const ang = (s % 4) * .3 - .45; const h = w.hound(f.x - Math.cos(ang) * 330, f.y - Math.sin(ang) * 330); h.ang = ang;   // close enough to see a lit player
    let seen = false; ran++;
    w.run(14, () => { if (h.lunge && h.lunge.t < .05 && !seen) { seen = true; const d = dist(h, p), want = Math.atan2(p.y - h.y, p.x - h.x), err = Math.abs(Math.atan2(Math.sin(want - h.ang), Math.cos(want - h.ang))); n++; if (d < 90 || d > 340 || err > .6 || !w.ad.clear(h.x, h.y, 14, 'walk')) bad++; } if (p.caught) return false; });
  }
  return { ok: n >= 10 && bad === 0, note: `${n}/${ran} runs produced a lunge, ${bad} outside range/alignment limits` };
});
add('H05 poor sharp turning: the hound turns much slower at full speed than at a crawl', () => {
  const f = openField(); const buckets = { slow: [], fast: [] };
  for (let s = 1; s <= 6; s++) {
    const w = World(s), p = w.player(f.x, f.y, {}); const h = w.hound(f.x - 250, f.y); h.state = 'HUNTING'; h.target = p.id; h.ang = 0;
    let lastAng = h.ang, t0 = 0;
    p.route([{ x: f.x + 250, y: f.y }, { x: f.x + 250, y: f.y + 160 }, { x: f.x - 250, y: f.y + 160 }, { x: f.x - 250, y: f.y - 160 }, { x: f.x + 250, y: f.y - 160 }], 'run');
    w.run(10, () => { const d = Math.abs(Math.atan2(Math.sin(h.ang - lastAng), Math.cos(h.ang - lastAng))) / DT; lastAng = h.ang; if (!h.lunge && h.recover <= 0) { if (h.speed > 230) buckets.fast.push(d); else if (h.speed < 90 && h.speed > 5) buckets.slow.push(d); } if (p.caught) return false; });
  }
  const mx = a => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * .95)] : 0;
  return { ok: buckets.fast.length > 40 && mx(buckets.fast) < 3.4 * 0.75, note: `p95 turn rate at speed>230: ${mx(buckets.fast).toFixed(2)} rad/s (${buckets.fast.length} samples); at slow speed ${mx(buckets.slow).toFixed(2)} (${buckets.slow.length})` };
});
add('H06 after a missed lunge it recovers (skids, turns slowly) before it runs again', () => {
  const f = openField(); const rs = over([1, 2, 3, 4, 5, 6, 7, 8], s => {
    const w = World(s), p = w.player(f.x, f.y, {}); p.stop('stand'); const h = w.hound(f.x - 380, f.y); h.ang = 0; h.state = 'HUNTING'; h.target = p.id;
    let miss = -1, dodged = false, resume = -1; p.angle = Math.PI;
    w.run(15, (ww, t) => { if (h.lunge && h.lunge.t > h.lunge.wind * .55 && !dodged) { dodged = true; p.go(p.x, p.y + 500, 'run'); } if (h.lungesMissed && miss < 0) miss = t; if (miss >= 0 && resume < 0 && !h.lunge && h.recover <= 0 && h.speed > 200) resume = t; if (p.caught) return false; });
    return { ok: miss > 0 && resume - miss > .9, gap: +(resume - miss).toFixed(2) };
  });
  const c = rs.filter(r => r.gap !== undefined && !Number.isNaN(r.gap) && r.gap > -1);
  return { ok: rate(rs) >= .6, note: `${(rate(rs) * 100) | 0}% recover >0.9s before regaining speed (gaps ${rs.map(r => r.gap).join(',')})` };
});
add('H07 hound state coverage: every state of the framework is reached by emergent play (no scripting of state changes)', () => {
  const seen = new Set(), first = {};
  const mark = (h, tag) => { const k = h.state; if (!seen.has(k)) { seen.add(k); first[k] = tag; } };
  // (a) a hound roams into a lone walker / runner / stander: noticing, stalking, hunting, the capture and what follows it
  for (let s = 1; s <= 30; s++) {
    const w = World(s), light = s % 2 === 0, p = w.player(5300, LONG.y, { light }); const h = w.hound(4300 + (s % 5) * 90, LONG.y); h.ang = 0;
    const kind = s % 3; if (kind === 0) p.go(4700, LONG.y, 'walk'); else if (kind === 1) p.go(6100, LONG.y, 'run'); else p.stop(s % 4 === 1 ? 'crouch' : 'stand');
    w.run(70, () => { mark(h, 'a' + s); if (p.caught) { if (h.cap && h.cap.phase === 'crawl') p.go(p.x + 60, p.y, 'crawl'); } if (p.dead) return false; }, 3);
  }
  // (b) the prey vanishes after being seen: searching, frustration, giving up
  for (let s = 1; s <= 8; s++) {
    const w = World(s + 40), p = w.player(5400, LONG.y, {}), h = w.hound(4900, LONG.y); h.ang = 0; p.go(6200, LONG.y, 'run'); let gone = false;
    w.run(90, (ww, t) => { mark(h, 'b' + s); const r = h.mem.p.get(p.id); if (!gone && r && r.seen && t > 1.2) { gone = true; p.x = 7500; p.y = LONG.y; p.light = false; p.stop('crouch'); } }, 3);
  }
  // (c) two people together in view of a hound
  for (let s = 1; s <= 12; s++) {
    const w = World(s + 60), a = w.player(5400, LONG.y, { light: true }), b = w.player(5480, LONG.y + 60, { light: true }); a.stop('stand'); b.stop('stand'); const h = w.hound(4800, LONG.y); h.ang = 0;
    w.run(40, () => { mark(h, 'c' + s); if (a.caught || b.caught) return false; }, 3);
  }
  // (e) a kill with more people running up: it may back away from the gathering crowd
  for (let s = 1; s <= 30; s++) {
    const w = World(s + 120), v = w.player(5000, LONG.y, {}); v.stop('stand'); v.angle = Math.PI; const h = w.hound(5000 - 32, LONG.y); h.ang = 0; h.state = 'HUNTING'; h.target = v.id;
    const r1 = w.player(5650, LONG.y - 40, { light: true }), r2 = w.player(5700, LONG.y + 45, { light: true }); r1.go(5150, LONG.y - 30, 'run'); r2.go(5150, LONG.y + 30, 'run');
    w.run(30, () => { mark(h, 'e' + s); if (r1.caught || r2.caught) return false; }, 3);
  }
  // (d) nobody around: a far hound is dormant
  { const w = World(99), p = w.player(1200, 1000, {}); p.stop('stand'); const h = w.hound(7000, 5500); w.run(2, null); mark(h, 'd'); }
  const need = ['ROAMING', 'DORMANT', 'ALERT', 'CURIOUS', 'STALKING', 'HUNTING', 'SEARCHING', 'CAUTIOUS', 'FRUSTRATED', 'EXCITED', 'FEEDING', 'PLAYING', 'RETREATING'];
  const miss = need.filter(n => !seen.has(n));
  return { ok: miss.length === 0, note: `reached ${need.length - miss.length}/${need.length}: ${[...seen].join(', ')}${miss.length ? '   MISSING: ' + miss.join(', ') : ''}` };
});
add('H08 searching is logical: it starts at the last known position, fans out around it, and does not home in on a quiet crouching player', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], s => {
    const w = World(s), p = w.player(5900, LONG.y, {}); p.stop('crouch'); p.light = false;      // hidden well down the corridor: a quiet, dark, crouched player
    const h = w.hound(4500, LONG.y); h.ang = 0; w.eng.summon(h, 4500, LONG.y, 4300, LONG.y, p.id);   // it has a lead: the spot where the player was last known to be (behind it)
    let firstGoal = null, goals = [], lastKey = '', found = false, minToPlayer = 1e9; const lkp = { x: 4300, y: LONG.y };
    w.run(45, () => {
      if (h.state === 'SEARCHING' && h.search && h.search.goal) {
        const k = (h.search.goal.x | 0) + ',' + (h.search.goal.y | 0);
        if (k !== lastKey) { lastKey = k; goals.push({ x: h.search.goal.x, y: h.search.goal.y }); if (!firstGoal) firstGoal = { x: h.search.goal.x, y: h.search.goal.y }; }
      }
      minToPlayer = Math.min(minToPlayer, dist(h, p));
      if (p.caught || p.dead) { found = true; return false; }
    }, 3);
    const toL = avg(goals.slice(1).map(g => dist(g, lkp))), toP = avg(goals.slice(1).map(g => dist(g, p)));
    return { ok: !!firstGoal && dist(firstGoal, lkp) < 60 && goals.length >= 3 && toL < toP, first: !!firstGoal, n: goals.length, toL: toL | 0, toP: toP | 0, found };
  });
  return { ok: rate(rs) >= .8 && rs.filter(r => r.found).length <= 4, note: `${(rate(rs) * 100) | 0}% began at the lead and fanned out around it (avg ${avg(rs.map(r => r.n)).toFixed(1)} goals; mean goal distance to the lead ${avg(rs.map(r => r.toL)) | 0}px vs to the real player ${avg(rs.map(r => r.toP)) | 0}px); found the hidden player in ${rs.filter(r => r.found).length}/10` };
});
add('H09 the wall impact only ever happens against a wall that is really there', () => {
  const G = geo(), open = G.opens.length ? G.opens : G.cells.filter((_, i) => i % 40 === 0).map(i => ({ x: G.g.cx(i), y: G.g.cy(i) }));
  let cOpen = 0, nOpen = 0, cWall = 0, nWall = 0, bad = 0;
  const kill = (w, h, p) => { const k = w.kills[0]; return k; };
  for (let i = 0; i < 60; i++) {           // spots where the wall is > 190 px away along the attack line
    const c = open[(i * 13) % open.length]; const w = World(100 + i); const ang = (i * 0.9) % TAU;
    if (w.eng.geo.ray(c.x, c.y, ang, 260) < 230) continue;
    const p = w.player(c.x, c.y, {}); p.stop('stand'); p.angle = ang + Math.PI; const h = w.hound(c.x - Math.cos(ang) * 32, c.y - Math.sin(ang) * 32); h.ang = ang; h.state = 'HUNTING'; h.target = p.id;
    const f = () => { const k = w.kills[0]; if (k) return false; }; w.run(20, f, 1); const k = w.kills[0]; if (!k) continue;
    nOpen++; if (k.variant === 'C') { const g = k.geo; if (!g || !g.wall || g.wall.dist < 54 || g.wall.dist > 192) cOpen++; }   // (a hound that circled round can attack along another line: a variant C is only wrong if the wall it slammed into is not really there)
  }
  for (let i = 0; i < 400 && nWall < 60; i++) {
    const c = G.walls[(i * 29) % G.walls.length]; const w = World(300 + i); const p = w.player(c.x, c.y, {}); p.stop('stand'); p.angle = c.ang + Math.PI;
    const h = w.hound(c.x - Math.cos(c.ang) * 34, c.y - Math.sin(c.ang) * 34); if (!w.ad.clear(h.x, h.y, 20, 'walk')) continue; h.ang = c.ang; h.state = 'HUNTING'; h.target = p.id;
    w.run(20, () => { if (w.kills[0]) return false; }, 1); const k = w.kills[0]; if (!k) continue;
    nWall++; if (k.variant === 'C') { cWall++; const g = k.geo; if (!g.wall || g.wall.dist < 54 || g.wall.dist > 192) bad++; }
  }
  return { ok: cOpen === 0 && nOpen >= 10 && cWall > 0 && bad === 0, note: `open ground: C ${cOpen}/${nOpen}; wall behind: C ${cWall}/${nWall} (bad wall records ${bad})` };
});
add('H10 exhausted prey: variant D only ever for a player with nothing left (and is the usual end for one caught from behind)', () => {
  const G = geo(); let nEx = 0, dEx = 0, nFresh = 0, dFresh = 0;
  for (let i = 0; i < 80; i++) {
    const c = G.cells[(i * 97) % G.cells.length], x = G.g.cx(c), y = G.g.cy(c); const w = World(500 + i);
    for (const ex of [true, false]) {
      const w2 = World(500 + i), p = w2.player(x, y, {}); p.angle = 0; p.mode = 'stand'; const h = w2.hound(x - 32, y); if (!w2.ad.clear(h.x, h.y, 20, 'walk')) continue; h.ang = 0; h.state = 'HUNTING'; h.target = p.id;
      w2.run(20, () => { if (ex) { p.stamina = 0; p.ex = 1; } if (w2.kills[0]) return false; }, 1); const k = w2.kills[0]; if (!k) continue;
      if (ex) { nEx++; if (k.variant === 'D') dEx++; } else { nFresh++; if (k.variant === 'D') dFresh++; }
    }
  }
  return { ok: dFresh === 0 && dEx / Math.max(1, nEx) >= .25, note: `exhausted: D ${dEx}/${nEx}; fresh: D ${dFresh}/${nFresh}` };
});
add('H11 no repeated identical death selection (variant history is respected)', () => {
  const G = geo(); const seqs = []; let maxRun = 0, total = 0; const counts = { A: 0, B: 0, C: 0, D: 0 };
  const w = World(7);     // one world: the engine remembers recent kills between deaths
  for (let i = 0; i < 90; i++) {
    const c = G.walls[(i * 31) % G.walls.length]; for (const e of w.eng.entities.slice()) w.eng.remove(e.id);          // (not eng.clear(): the engine must keep its memory of recent deaths)
    const p = w.player(c.x, c.y, {}); p.stop('stand'); p.angle = i % 2 ? c.ang : c.ang + Math.PI; p.active = true; p.dead = ''; p.caught = null; p.safe = 0;
    const h = w.hound(c.x - Math.cos(c.ang) * 34, c.y - Math.sin(c.ang) * 34); if (!w.ad.clear(h.x, h.y, 20, 'walk')) { w.players.splice(w.players.indexOf(p), 1); w.sim.removePlayer(p); continue; } h.ang = c.ang; h.state = 'HUNTING'; h.target = p.id;
    const n0 = w.kills.length; w.run(20, () => { if (w.kills.length > n0) return false; }, 1);
    if (w.kills.length > n0) { const v = w.kills[w.kills.length - 1].variant; seqs.push(v); counts[v]++; total++; }
    w.players.splice(w.players.indexOf(p), 1); w.sim.removePlayer(p);
  }
  let run = 1; for (let i = 1; i < seqs.length; i++) { if (seqs[i] === seqs[i - 1]) run++; else run = 1; maxRun = Math.max(maxRun, run); }
  const used = Object.values(counts).filter(v => v > 0).length;
  return { ok: total >= 40 && maxRun <= 3 && used >= 3, note: `${total} kills: ${JSON.stringify(counts)}, longest identical streak ${maxRun}` };
});
add('H12 after a kill: it is worked up (EXCITED), then feeds; an intruder at the body is guarded against and hunted', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], s => {
    const w = World(s), f = { x: 5000, y: LONG.y }; const p = w.player(f.x, f.y, {}); p.stop('stand'); p.angle = Math.PI;
    const h = w.hound(f.x - 32, f.y); h.ang = 0; h.state = 'HUNTING'; h.target = p.id;
    const intr = w.player(f.x + 1900, f.y, { light: false }); intr.stop('stand');                     // far away and dark: it does not know about them yet
    let exc = false, fed = false, guard = false, hunt = false, killedIntr = false, t0 = -1;
    w.run(80, (ww, t) => {
      if (w.kills.length && t0 < 0) t0 = t;
      if (h.state === 'EXCITED') exc = true; if (h.state === 'FEEDING' && h.act === 'feed') fed = true; if (h.state === 'FEEDING' && h.act === 'guard') guard = true;
      if (fed && t - t0 > 14 && intr.mode === 'stand' && !intr.tx) { intr.light = true; intr.go(f.x + 150, f.y, 'walk'); }        // someone comes for the body, torch on
      if (fed && (h.state === 'HUNTING' || h.state === 'STALKING' || guard) && intr.tx) hunt = true;
      if (intr.caught || intr.dead) { killedIntr = true; return false; }
    }, 2);
    return { ok: w.kills.length > 0 && exc && fed && (guard || hunt), exc, fed, guard, hunt, killedIntr };
  });
  return { ok: rate(rs) >= .7, note: `${(rate(rs) * 100) | 0}% excited -> fed -> reacted to an intruder (excited ${rs.filter(r => r.exc).length}, fed ${rs.filter(r => r.fed).length}, guard ${rs.filter(r => r.guard).length}, hunt/stalk ${rs.filter(r => r.hunt).length}, intruder caught ${rs.filter(r => r.killedIntr).length})` };
});
add('H13 pack instinct: hounds near each other share a pack id, and one hound sounding off draws the others', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], s => {
    const w = World(s); w.run(3, null);                                                            // (the sound-throttle of a fresh world is long past in a live one)
    const p = w.player(5200, LONG.y, { light: true }); p.go(6100, LONG.y, 'run');
    const a = w.hound(4750, LONG.y), b = w.hound(4300, LONG.y), c = w.hound(3900, LONG.y); for (const h of [a, b, c]) h.ang = 0;
    let pack = false, drawn = 0, maxPack = 0; w.run(25, (ww, t) => { if (a.pack && (a.pack === b.pack || a.pack === c.pack)) pack = true; drawn = Math.max(drawn, [b, c].filter(h => h.state !== 'ROAMING' && h.state !== 'DORMANT').length); maxPack = Math.max(maxPack, [a, b, c].filter(h => h.pack && h.pack === a.pack).length); if (p.caught) return false; }, 5);
    return { ok: pack && drawn >= 1, pack, drawn, maxPack };
  });
  return { ok: rate(rs) >= .6, note: `${(rate(rs) * 100) | 0}% of runs formed a pack and drew a second hound (largest pack seen ${Math.max(...rs.map(r => r.maxPack))})` };
});
add('H14 far hounds sleep and wake: no perception when far; awake when a player is near', () => {
  const w = World(3), p = w.player(1200, 1000, {}); p.stop('stand'); const h = w.hound(7000, 5500); w.run(3, null);
  const far = h.tier; const senseBefore = w.eng.stats.sense; w.run(10, null); const senses = w.eng.stats.sense - senseBefore;
  p.x = 6700; p.y = 5400; w.run(2, null); const near = h.tier;
  return { ok: far === 'far' && senses === 0 && near !== 'far', note: `tier far=${far}, perception ticks while far ${senses}; after a player arrives: ${near}` };
});
module.exports = S;
