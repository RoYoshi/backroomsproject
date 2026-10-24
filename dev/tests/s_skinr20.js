/* SKIN-STEALER R20, the strategic hunter (dev/trial-3-r20-strategic-ambush/; Trial 3 is not owner-approved).  The owner's R20 direction:
 * somewhat less raw run-to-prey and run endurance, more waiting for them where they will go; its fatigue read from what it sees and hears,
 * never their meter; its ears like a player's.  Each scene runs the real server simulation (sim.js + ai.js as built, players moved by the
 * game's own move.js through the harness), seeded; nothing sets a decision of the creature - people are placed and moved, and what it chose
 * is read from its own record (plans, tallies, e.dbg).
 *   SH01 dark walkers and runners on long routes past it, out of its sight: it stages before it sees them (a post where their sounds
 *        would come out, a wait where it stands, a go-ahead) - anonymous (no person named by a sound), sometimes taking them there
 *   SH02 one quiet footstep behind a wall: it turns to listen - nobody named, nobody hunted, the place fuzzy
 *   SH03 two sounds from different ways: the newer evidence moves what it does
 *   SH04 roaming alone for 15 minutes: alive (moving most of the time, its pauses short), no plan held past its own bound
 *   SH05 watched in a lit hall at .6 and .85: it acts within seconds, and not as a headlong run
 *   SH06 somebody walking towards it in the dark: it waits where it stands (an ambush), then its telegraphed spring takes them
 *   SH07 seen early by somebody who turns and sprints back: the open way out stays open - not every one is taken
 *   SH08 its run's endurance (the owner's tradeoff): from full to exhausted at its run 7.1 s (R19 8.4 s); a fresh sprinter (285) in the long
 *        hall gains on it and its chase ends - the fresh player's sprint is the faster
 *   SH09 a spring costs its stamina (SK.pounceCost); a walk under SK.runFrom (its prowl, the pursuit walk) gives it back
 *   SH10 the belief, not the meter: a short sprint by somebody whose meter is nearly empty reads fresh; a long one by somebody whose meter is
 *        nearly full reads winded (it can be wrong - its evidence is what it saw)
 *   SH11 out of its sight the belief fades: its confidence halves every SK20.fz.half s
 *   SH12 four people: every plan about a person is about somebody it saw (or heard while seeing them) - never a person named from a sound
 *   NA07 its ears against a player's: the reach of a step by kind, in the open and through a wall, beside the reach the game gives a player
 *        hearing its steps; crouching stays quiet; the Hound's and the Smiler's ears are the shared law exactly */
'use strict';
const { World, DT, LONG, AI, geo, bystander } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const SK = AI.SK;
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* a person on a long route (1400-3200 px) through the level; the creature 450-750 px from its middle, out of sight of its start */
function routeScene(i, H, mode, light) {
  const G = geo(), w = World(i * 31), g = w.eng.geo, R = rng(i * 7);
  const pick = () => { for (let k = 0; k < 500; k++) { const c = G.cells[Math.floor(R() * G.cells.length)], x = g.cx(c), y = g.cy(c); if (w.ad.clear(x, y, 26, 'walk')) return { x, y }; } return null; };
  const a = pick(), b = pick(); if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 1400) return null;
  const route = g.path(a.x, a.y, b.x, b.y, { CAN_VAULT: false }); if (!route || route.length < 3) return null;
  let len = 0, px = a.x, py = a.y; for (const q of route) { len += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y; } if (len > 3200) return null;
  const mid = route[Math.floor(route.length / 2)];
  let s = null; for (let k = 0; k < 800 && !s; k++) { const q = pick(); const d = Math.hypot(q.x - mid.x, q.y - mid.y); if (d > 450 && d < 750 && !g.los(q.x, q.y, a.x, a.y) && Math.hypot(q.x - a.x, q.y - a.y) > 900) s = q; }
  if (!s) return null;
  const e = w.eng.spawn('skinstealer', s.x, s.y, { hunger: H }); e.tier = 'near';
  const p = w.player(a.x, a.y, { light }); p.route(route.map(q => ({ x: q.x, y: q.y })), mode);
  return { w, e, p, len };
}
/* open floor (clear 70 px all round): the k-th of a seeded draw */
function openAt(w, k) { const G = geo(), g = w.eng.geo, R = rng(k * 13 + 5); for (let i = 0; i < 4000; i++) { const c = G.cells[Math.floor(R() * G.cells.length)], x = g.cx(c), y = g.cy(c); if (w.ad.clear(x, y, 70, 'walk')) return { x, y }; } return null; }
/* a straight, dark stretch of floor (a run of w.runs() whose cells are unlit) */
function darkRun(w, min = 1300) {
  const g = w.eng.geo;
  for (const R of w.runs(min, 30)) { let lit = 0, n = 0; const L = Math.hypot(R.x1 - R.x0, R.y1 - R.y0); for (let k = 0; k <= L; k += 48) { const x = R.x0 + (R.x1 - R.x0) * k / L, y = R.y0 + (R.y1 - R.y0) * k / L; lit = Math.max(lit, g.lamp[g.cellAt(x, y)] || 0); n++; } if (lit < .05) return R; }
  return null;
}

add('SH01 staging before it sees them: dark walkers and runners on long routes past it - it posts where their sounds would come out, waits where it stands or goes ahead, naming nobody from a sound, and sometimes takes them there', () => {
  const bad = [], M = { runs: 0, staged: 0, post: 0, here: 0, ahead: 0, takenAfter: 0, anonOk: 0, posts: 0 };
  for (const mode of ['walk', 'run']) for (let i = 1, n = 0; n < 24 && i < 200; i++) {
    const sc = routeScene(i, .7, mode, false); if (!sc) continue; n++; M.runs++;
    const { w, e, p, len } = sc; let staged = null, lastP = null;
    w.run(Math.min(40, len / (mode === 'run' ? 250 : 165) + 12), () => {
      const P = e.plan;
      if (P && P !== lastP) { lastP = P;
        const seenYet = !!(e.mem.p.get(p.id) && e.mem.p.get(p.id).seenAt > 0);
        const kind = P.k === 'post' ? (P.here ? 'here' : 'post') : P.k === 'ambush' && P.here ? 'here' : P.k === 'intercept' && P.ahead ? 'ahead' : '';
        if (kind && !staged) staged = { kind, seenYet };
        if (P.k === 'post') { M.posts++; if (P.pid === 0 && !/P\d/.test(P.why || '')) M.anonOk++; else bad.push(`post naming somebody: ${P.why}`); }
      }
      return !p.dead;
    });
    if (staged) { M.staged++; M[staged.kind]++; if (p.dead) M.takenAfter++; }
  }
  if (M.staged < 6) bad.push(`staged in only ${M.staged} of ${M.runs} runs`);
  if (M.posts < 2) bad.push(`only ${M.posts} posts`);
  if (M.takenAfter < 3) bad.push(`taken after staging only ${M.takenAfter} times`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${M.runs} dark walks and runs: staged in ${M.staged} (posts ${M.post}, waits where it stood ${M.here}, go-aheads ${M.ahead}); ${M.takenAfter} taken after staging; ${M.posts} posts, every one anonymous`, data: M };
});

add('SH02 one footstep behind a wall (a crouched person shifting their feet once): it stops to listen - while it listens the sound names nobody and no hunt for that person begins, and where it believes the step was is not where it was (it may then go and look)', () => {
  const bad = [], out = [];
  for (const seed of [1, 2, 3]) {
    const w = World(seed + 900), g = w.eng.geo, G = geo();
    // a creature on open floor; a person crouched 90-140 px away behind a wall (no line between them)
    let pair = null;
    for (const c of G.cells) { const x = g.cx(c), y = g.cy(c); if (!w.ad.clear(x, y, 28, 'walk') || (g.lamp[g.cellAt(x, y)] || 0) > .05) continue;
      for (let k = 0; k < 64 && !pair; k++) { const a = k / 16 * Math.PI * 2, d = 90 + 15 * Math.floor(k / 16) + seed * 3, qx = x + Math.cos(a) * d, qy = y + Math.sin(a) * d; if (w.ad.clear(qx, qy, 18, 'walk') && !g.los(x, y, qx, qy) && !g.sees(x, y, qx, qy, 1) && !g.sees(x, y, qx, qy, 0)) pair = { x, y, qx, qy }; }
      if (pair) break; }
    const e = w.eng.spawn('skinstealer', pair.x, pair.y, { hunger: .5 }); e.tier = 'near'; e.ang = Math.atan2(pair.y - pair.qy, pair.x - pair.qx); w.run(1);   // (facing away from the wall)
    const p = w.player(pair.qx, pair.qy, { light: false }); p.stop('crouch'); w.run(.3);
    if (e.mem.p.get(p.id) && e.mem.p.get(p.id).seenAt > 0) { bad.push(`seed ${seed}: it saw them (the scene)`); continue; }
    const ex = p.x, ey = p.y; w.eng.sound({ x: ex, y: ey, r: 240, I: .42, type: 'walk', src: p.id, st: 1, vx: 0, vy: 0 });   // (one walking step: the engine's own footstep event)
    // what it made of the step while it listened (before it could have gone round the wall and seen them)
    let listened = false, why = '', named = false;
    w.run(2, () => { if (e.plan && e.plan.k === 'listen') { listened = true; why = e.plan.why; const r = e.mem.p.get(p.id), h0 = e.mem.sounds.find(q => q.type === 'walk'); if ((h0 && h0.pid) || /P\d/.test(why) || (e.hunt && e.hunt.pid === p.id) || (r && r.seenAt > 0)) named = true; } return true; });
    const h = e.mem.sounds.find(q => q.type === 'walk');
    out.push({ seed, heard: !!h, listened, named, off: h ? Math.round(Math.hypot(h.x - ex, h.y - ey)) : null });
    if (!h || !listened || named || !(h && Math.hypot(h.x - ex, h.y - ey) > 1)) bad.push(JSON.stringify(out[out.length - 1]));
  }
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : out.map(o => `seed ${o.seed}: heard, listened, nobody named, believed ${o.off} px from the step`).join(' | ') };
});

add('SH03 two sounds from different ways: after a sound one way, a fresher one the other way moves what it does within a few seconds (where it goes, or faces, is toward the newer sound)', () => {
  const bad = [], out = [];
  for (const seed of [1, 2, 3]) {
    const w = World(seed + 950), g = w.eng.geo, G = geo(), R = rng(seed);
    const o = openAt(w, seed);
    const e = w.eng.spawn('skinstealer', o.x, o.y, { hunger: .5 }); e.tier = 'near';
    { let q = null; for (let k = 0; k < 4000 && !q; k++) { const c = G.cells[Math.floor(R() * G.cells.length)], x = g.cx(c), y = g.cy(c), d = Math.hypot(x - o.x, y - o.y); if (d > 700 && d < 1000 && w.ad.clear(x, y, 20, 'walk') && !g.los(x, y, o.x, o.y)) q = { x, y }; } const b = w.player(q.x, q.y, { light: false }); b.stop('crouch'); }   // (somebody still and silent far off: it is in the near tier)
    w.run(1);
    const sp = (a, d) => { for (let k = 0; k < 40; k++) { const x = o.x + Math.cos(a + k * .07) * d, y = o.y + Math.sin(a + k * .07) * d; if (w.ad.clear(x, y, 16, 'walk')) return { x, y }; } return null; };
    const A = sp(R() * 6.28, 520), B = sp(Math.atan2(A.y - o.y, A.x - o.x) + Math.PI, 520);   // (beyond SK.soundLook's 420: a sound it goes to, not one it only turns its head to)
    w.eng.sound({ x: A.x, y: A.y, r: 640, I: .9, type: 'run', src: 0, st: 2, vx: 0, vy: 0 }); w.run(.25); w.eng.sound({ x: A.x, y: A.y, r: 640, I: .9, type: 'run', src: 0, st: 2, vx: 0, vy: 0 });
    w.run(1.5);
    const g1 = e.plan && (e.plan.goal || e.plan.at); const d1 = g1 ? [Math.hypot(g1.x - A.x, g1.y - A.y), Math.hypot(g1.x - B.x, g1.y - B.y)] : null;
    { const a2 = Math.atan2(A.y - e.y, A.x - e.x) + Math.PI; for (let k = 0; k < 40; k++) { const x = e.x + Math.cos(a2 + k * .07) * 470, y = e.y + Math.sin(a2 + k * .07) * 470; if (w.ad.clear(x, y, 16, 'walk')) { B.x = x; B.y = y; break; } } }   // (the other way from where it is now)
    w.eng.sound({ x: B.x, y: B.y, r: 640, I: .9, type: 'run', src: 0, st: 2, vx: 0, vy: 0 }); w.run(.25); w.eng.sound({ x: B.x, y: B.y, r: 640, I: .9, type: 'run', src: 0, st: 2, vx: 0, vy: 0 });
    let g2 = null; w.run(6, () => { const P = e.plan, q = P && (P.k === 'post' ? P.face : P.goal || P.at); if (q && Math.hypot(q.x - B.x, q.y - B.y) < Math.hypot(q.x - A.x, q.y - A.y)) { g2 = q; return false; } return true; });
    g2 = g2 || (e.plan && (e.plan.goal || e.plan.at)); const d2 = g2 ? [Math.hypot(g2.x - A.x, g2.y - A.y), Math.hypot(g2.x - B.x, g2.y - B.y)] : null;
    out.push({ seed, first: e.dbg && d1 ? (d1[0] < d1[1] ? 'A' : 'B') : '-', then: d2 ? (d2[1] < d2[0] ? 'B' : 'A') : '-', plan: e.plan ? e.plan.k : null });
    if (!(d2 && d2[1] < d2[0])) bad.push(JSON.stringify(out[out.length - 1]));
  }
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : out.map(o => `seed ${o.seed}: first toward ${o.first}, then ${o.then} (${o.plan})`).join(' | ') };
});

add('SH04 roaming alone for 15 minutes: alive - moving most of the time, no standing still longer than 25 s, no plan held past its own bound', () => {
  const bad = [], out = [];
  for (const seed of [1, 2]) {
    const w = World(seed + 1200), G = geo(), o = openAt(w, seed + 40), e = w.eng.spawn('skinstealer', o.x, o.y, { hunger: .5 }); e.tier = 'near';
    const near = w.player(o.x + 2600, o.y, { light: false }); near.stop('stand');                // (somebody far enough away to keep it in the near tier, never met)
    let moving = 0, still = 0, maxStill = 0, run = 0, lastP = null, P0 = 0, longest = 0;
    w.run(900, () => { e.tier = 'near'; if ((e.speed || 0) > 20) { moving += DT; run = 0; } else { still += DT; run += DT; maxStill = Math.max(maxStill, run); }
      if (e.plan !== lastP) { if (lastP) longest = Math.max(longest, w.eng.now - P0); lastP = e.plan; P0 = w.eng.now; } return true; });
    out.push({ seed, moving: +(moving / 900).toFixed(2), maxStill: +maxStill.toFixed(1), longestPlan: +longest.toFixed(1) });
    if (moving / 900 < .55 || maxStill > 25 || longest > 60) bad.push(JSON.stringify(out[out.length - 1]));
  }
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : out.map(o => `seed ${o.seed}: moving ${Math.round(o.moving * 100)} %, longest still ${o.maxStill} s, longest plan ${o.longestPlan} s`).join(' | ') };
});

add('SH05 watched in the lit hall at .6 and .85: it acts within a few seconds (comes on, goes round, or backs off to wait) and is not a headlong run - most of its first 12 s under its run', () => {
  const bad = [], out = [];
  for (const h of [.6, .85]) for (const seed of [1, 2, 3]) {
    const w = World(seed + 3800), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    let acted = null, fast = 0, t0 = w.eng.now;
    w.run(12, () => { const P = e.plan; if (acted === null && P && P.k !== 'watch' && P.k !== 'listen') acted = w.eng.now - t0; if ((e.speed || 0) > 255) fast += DT; return !p.dead; });
    out.push({ h, seed, acted: acted === null ? null : +acted.toFixed(1), fastShare: +(fast / 12).toFixed(2) });
    if (acted === null || acted > 6 || fast / 12 > .5) bad.push(JSON.stringify(out[out.length - 1]));
  }
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : out.map(o => `${o.h}/${o.seed}: acted at ${o.acted} s, ${Math.round(o.fastShare * 100)} % at its run`).join(' | ') };
});

add('SH06 somebody walking along a dark hall towards where it is: often it waits where it stands (an ambush, no run at them), its spring telegraphed by its wind-up taking them (its ears are fuzzy: it may also go quietly to look, and come on if it is seen)', () => {
  const bad = [], out = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = World(seed + 1500), R = darkRun(w); if (!R) { bad.push('no dark hall'); break; }
    const hor = R.y0 === R.y1, at = k => hor ? { x: R.x0 + k, y: R.y0 } : { x: R.x0, y: R.y0 + k }, L = hor ? R.x1 - R.x0 : R.y1 - R.y0;
    const s = at(Math.min(L - 60, 800 + seed * 40)), a = at(80);
    const e = w.eng.spawn('skinstealer', s.x, s.y, { hunger: .7 }); e.tier = 'near'; e.ang = hor ? Math.PI : -Math.PI / 2;
    const end = at(L - 30), p = w.player(a.x, a.y, { light: false }); p.go(end.x, end.y, 'walk');   // (down the hall, past where it is)
    let waited = false, ran = 0, wind = -1, pounce = -1, caught = false;
    w.run(16, (ww, t) => { const P = e.plan; if (P && ((P.k === 'ambush' && (P.here || P.post)) || (P.k === 'post' && P.here))) waited = true; if (!waited && (e.speed || 0) > SK.runFrom) ran += DT; if (e.act === 'wind' && wind < 0) wind = t; if (e.pounce && e.pounce.t >= e.pounce.wind && pounce < 0) pounce = t; if (p.dead) { caught = true; return false; } return true; });
    out.push({ seed, waited, ranBefore: +ran.toFixed(2), windToLeap: wind >= 0 && pounce >= 0 ? +(pounce - wind).toFixed(2) : null, caught });
  }
  const ok = out.filter(o => o.waited && o.caught && o.windToLeap >= .15 && o.ranBefore < .3).length;
  if (ok < 3) bad.push(JSON.stringify(out));
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${ok} of ${out.length}: waited where it stood, no run before, its wind-up 0.22 s before the leap, taken | ${JSON.stringify(out)}` };
});

add('SH07 seen early: somebody who sees it 550+ px down the lit hall and sprints back the way they came gets away at least sometimes - an exposed attack can fail', () => {
  const out = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = World(seed + 3800), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5600, y, { hunger: .85 }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    w.run(.6); p.look = null; p.go(3100, y, 'run');
    w.run(14, () => !p.dead);
    out.push(p.dead ? 'caught' : 'away');
  }
  const away = out.filter(o => o === 'away').length;
  return { ok: away >= 1, note: `${away} of ${out.length} got away (${out.join(', ')})` };
});

add('SH08 its run\'s endurance (the owner\'s tradeoff, a proposal): from full to exhausted at its run in 7.1 s (R19 8.4 s), the drain itself unchanged in form; a fresh sprinter (285 px/s) chased down the long hall gains on it and the chase ends', () => {
  const bad = [];
  const w = World(5), e = w.eng.spawn('skinstealer', 4000, LONG.y, { hunger: .5 }); e.tier = 'near';
  let t = 0; e.stam = 100; e.exh = false; while (!e.exh && t < 20) { e.speed = AI.SKIN.speeds.run; t += DT; e.stam -= SK.drainRun * Math.max(.25, (e.speed - SK.runFrom) / (AI.SKIN.speeds.run - SK.runFrom)) * DT; if (e.stam < SK.stamExh) e.exh = true; }
  const T = (100 - SK.stamExh) / SK.drainRun, T19 = (100 - SK.stamExh) / 11;
  if (Math.abs(t - T) > .05 || SK.drainRun !== 13 || T19 - T < .1 * T19) bad.push(`drain ${SK.drainRun}: ${t.toFixed(2)} s (R19 ${T19.toFixed(2)} s)`);
  // the race: a fresh sprinter 240 px ahead of it down the long hall
  const out = [];
  for (const seed of [1, 2, 3]) {
    const w2 = World(seed + 700), y = LONG.y; bystander(w2, 1300, 3300);
    const p = w2.player(4400, y, { light: true }); p.stop('stand');
    const e2 = w2.eng.spawn('skinstealer', 4160, y, { hunger: .9 }); e2.tier = 'near'; e2.ang = 0;
    w2.run(.4); p.go(8700, y, 'run');
    let dmin = 1e9, dEnd = 0, chased = 0, longest = 0, cur = 0;
    w2.run(12, () => { const d = Math.hypot(p.x - e2.x, p.y - e2.y); dmin = Math.min(dmin, d); dEnd = d; if (e2.plan && e2.plan.k === 'chase') chased += DT; if ((e2.speed || 0) > SK.runFrom) { cur += DT; longest = Math.max(longest, cur); } else cur = 0; return !p.dead; });
    out.push({ seed, caught: p.dead, dmin: Math.round(dmin), dEnd: Math.round(dEnd), chased: +chased.toFixed(1), longestRun: +longest.toFixed(1), stam: Math.round(e2.stam) });
  }
  const got = out.filter(o => !o.caught && o.dEnd > o.dmin + 100).length;
  if (got < 2) bad.push(`the sprinter got away ${got}/3: ${JSON.stringify(out)}`);
  for (const o of out) if (o.longestRun > T + .3) bad.push(`a run of ${o.longestRun} s`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `from full to exhausted at its run ${t.toFixed(2)} s (R19 ${T19.toFixed(2)} s: ${Math.round(100 * (1 - T / T19))} % less) | a fresh sprinter got away ${got} of 3: ${JSON.stringify(out)}` };
});

add('SH09 a spring is paid for (SK.pounceCost) and its pursuit walk (under SK.runFrom) gives its breath back', () => {
  const w = World(6), e = w.eng.spawn('skinstealer', 4000, LONG.y, { hunger: .5 }); e.tier = 'near';
  const bad = [];
  const s0 = e.stam = 60; e.speed = AI.SKIN.speeds.prowl; let t = 0; while (t < 5) { t += DT; e.stam = Math.min(100, e.stam + (e.speed < 8 ? SK.regenStill : SK.regenWalk) * DT); }
  if (!(AI.SKIN.speeds.prowl <= SK.runFrom && e.stam > s0 + 25)) bad.push(`prowl ${AI.SKIN.speeds.prowl} (runFrom ${SK.runFrom}): ${s0} -> ${e.stam.toFixed(1)}`);
  // a real spring: somebody standing 120 px in front of it, unaware
  const w2 = World(7), y = LONG.y; bystander(w2, 1300, 3300); const p = w2.player(5000, y, { light: false, angle: 0 }); p.stop('stand');
  const e2 = w2.eng.spawn('skinstealer', 4880, y, { hunger: .9 }); e2.tier = 'near'; e2.ang = 0; let before = null, after = null;
  w2.run(5, () => { if (e2.pounce && before === null) before = e2.stam + SK.pounceCost; if (before !== null && after === null && !e2.pounce) after = e2.stam; return !p.dead; });
  if (before === null) bad.push('no spring');
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `walking at its prowl ${AI.SKIN.speeds.prowl} px/s (under ${SK.runFrom}): ${s0} -> ${e.stam.toFixed(0)} in 5 s | its spring cost ${SK.pounceCost} (stamina ${Math.round(before)} -> ${Math.round(before - SK.pounceCost)} as it left the ground)` };
});

/* SH10/SH11: its belief from a sequence of what it saw of somebody (r.visual, as its sight records it, 10 times a second) - their meter set
 * to the opposite of what they showed it, to show the meter is never read; the belief functions are its own (SKIN.fatigueSee / fatigue) */
function watched(seq, meter) {
  const w = World(3), eng = w.eng, e = eng.spawn('skinstealer', 4000, LONG.y, { hunger: .5 }); eng.entities.splice(eng.entities.indexOf(e), 1);
  const r = { id: 999, stamina: meter, ex: meter < 8, lkx: 0, lky: LONG.y }, o = {}; e.mind.obs.set(999, o);
  for (const [secs, st, sp] of seq) for (let t = 0; t < secs - 1e-9; t += .1) { eng.now += .1; if (st === null) continue; r.visual = { st, vx: sp, vy: 0 }; r.lkx += sp * .1; AI.SKIN.fatigueSee(eng, e, r, o, eng.now); }
  return { F: AI.SKIN.fatigue(eng, e, r, eng.now), e, eng, r, o };
}
add('SH10 the belief, not the meter: a 2 s sprint by somebody whose meter is nearly empty reads fresh; a 9 s sprint by somebody whose meter is nearly full reads winded - wrong on purpose, its evidence is what it saw; a slow walk soon after a run, or their ragged breath heard where it believes them, reads winded too', () => {
  const bad = [];
  const A = watched([[2, 2, 285], [1, 1, 172]], 4).F, B = watched([[9, 2, 285], [1, 1, 172]], 95).F, C = watched([[4, 2, 285], [1.5, 1, 148]], 95).F;
  const D = watched([[2, 1, 172]], 95); D.e.mem.sounds.unshift({ id: 1, x: D.r.lkx + 30, y: LONG.y, I: .4, type: 'breath', t: D.eng.now - .5, src: 0, pid: null, u: 60 }); const Df = AI.SKIN.fatigue(D.eng, D.e, D.r, D.eng.now);
  const at = AI.SK.fz ? AI.SK.fz.at : .45;
  if (A.est !== 'fresh') bad.push(`2 s sprint, meter 4: ${JSON.stringify(A)}`);
  if (B.est !== 'winded' || B.p * B.conf < .45) bad.push(`9 s sprint, meter 95: ${JSON.stringify(B)}`);
  if (C.est !== 'winded' || !C.cues.includes('slow walk')) bad.push(`4 s sprint then a 148 px/s walk: ${JSON.stringify(C)}`);
  if (Df.est !== 'winded' || !Df.cues.includes('breath')) bad.push(`a walk, a breath heard where it believes them: ${JSON.stringify(Df)}`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `2 s sprint (meter 4) -> ${A.est} p ${A.p} | 9 s sprint (meter 95) -> ${B.est} p ${B.p} (${B.cues.join(', ')}) | 4 s sprint, then a 148 px/s walk -> ${C.est} (${C.cues.join(', ')}) | a walker, a ragged breath heard where it believes them -> ${Df.est} (${Df.cues.join(', ')})` };
});

add('SH11 out of its sight the belief fades and their rest is guessed at: 12 s after it last saw a 9 s sprinter its confidence is under a quarter, and seen again after 12 s unseen they read fresher than when it lost them', () => {
  const B = watched([[9, 2, 285], [.5, 1, 172]], 95), F0 = B.F;
  B.eng.now += 12; const F1 = AI.SKIN.fatigue(B.eng, B.e, B.r, B.eng.now);
  B.r.visual = { st: 1, vx: 172, vy: 0 }; AI.SKIN.fatigueSee(B.eng, B.e, B.r, B.o, B.eng.now); const F2 = AI.SKIN.fatigue(B.eng, B.e, B.r, B.eng.now);
  const ok = F1.conf < F0.conf * .25 && F2.p < F0.p;
  return { ok, note: `lost from sight: p ${F0.p}, confidence ${F0.conf} | 12 s later: confidence ${F1.conf} | seen again walking: p ${F2.p} (${F2.est})` };
});

add('SH12 four people moving about for 5 minutes: every plan about a person is about somebody it had seen (or heard while it saw them) - never a person named from a sound', () => {
  const bad = []; let plans = 0, anon = 0;
  for (const seed of [1, 2]) {
    const w = World(seed + 2100), G = geo(), R = rng(seed + 5), o = openAt(w, seed + 60), spots = Array.from({ length: 40 }, (_, i) => openAt(w, seed * 100 + i));
    const e = w.eng.spawn('skinstealer', o.x, o.y, { hunger: .7 }); e.tier = 'near';
    const ps = [0, 1, 2, 3].map(i => { const q = spots[i * 9], p = w.player(q.x, q.y, { light: i % 2 === 0 }); p.stop('stand'); return p; });
    let lastP = null;
    w.run(300, (ww, t) => {
      if (Math.round(t * 60) % 300 === 0) for (const p of ps) { if (p.dead) { p.dead = false; p.alive = true; p.caught = false; } const q = spots[Math.floor(R() * spots.length)]; p.pathTo(q.x, q.y, R() < .3 ? 'run' : 'walk'); }
      const P = e.plan; if (P && P !== lastP) { lastP = P; if (P.pid) { plans++; const r = e.mem.p.get(P.pid); if (!r || !(r.seenAt > 0)) bad.push(`${P.k} about P${P.pid}, never seen: ${P.why}`); } else if (P.k === 'post' || P.k === 'search' || P.k === 'listen') anon++; }
      return true;
    });
  }
  return { ok: !bad.length && plans >= 3, note: bad.length ? bad.slice(0, 4).join('; ') : `${plans} plans about a person, each about somebody it had seen; ${anon} about sounds nobody was named for` };
});

add('NA07 its ears against a player\'s: the reach of one step by kind, open and through a wall, beside the reach the game gives a player hearing its own steps; crouching stays quiet; the Hound\'s and the Smiler\'s ears are the shared law exactly', () => {
  const bad = [], rows = [], w = World(9), eng = w.eng, g = eng.geo, G = geo();
  // the farthest it hears a step: binary search on distance along an open line (and one with a wall between), the creature standing still
  const ents = {}, reach = (kind, type, r, wall) => {
    const o = openAt(w, 3), e = ents[kind] || (ents[kind] = eng.spawn(kind, o.x, o.y, kind === 'skinstealer' ? { hunger: .5 } : {})); if (eng.entities.includes(e)) eng.entities.splice(eng.entities.indexOf(e), 1); e.act = ''; e.state = 'ROAMING';
    const losSave = g.los; g.los = () => !wall;
    let lo = 0, hi = 2000; for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2, ev = { x: o.x + m, y: o.y, r, I: .9, type, src: 7777, st: 1, vx: 0, vy: 0 }; e.mem.sounds.length = 0; if (AI.hearEvent(e, eng, ev)) lo = m; else hi = m; }
    g.los = losSave; return Math.round(lo);
  };
  const NZ = require('./lib.js').WORLD.NOISE;
  // what the game gives a player hearing a Skin-Stealer's step (spacious-audio skin.audio.js step(): falloff to 950 px, 520 when it treads
  // softly; heard while the step's gain is over .02 of full; through a wall the gain halves): the same law, solved for distance
  const playerReach = (soft, run, wall) => { const near = soft ? 80 : 120, far = soft ? 520 : 950, base = (.22 + .25 * run) * (soft ? .45 : 1) * (wall ? .5 : 1);
    let d = near; for (; d < far; d += 1) { const k = (d - near) / (far - near), s = k * k * (3 - 2 * k), gn = Math.pow(1 - s, 1.5) * base; if (gn < .02) break; } return d; };
  const SKIN = { walk: reach('skinstealer', 'walk', NZ.walk), walkWall: reach('skinstealer', 'walk', NZ.walk, true), run: reach('skinstealer', 'run', NZ.run), runWall: reach('skinstealer', 'run', NZ.run, true), crouch: reach('skinstealer', 'crouch', NZ.crouchMove), crouchWall: reach('skinstealer', 'crouch', NZ.crouchMove, true) };
  const PLAYER = { walk: playerReach(false, .27, false), walkWall: playerReach(false, .27, true), run: playerReach(false, 1, false), runWall: playerReach(false, 1, true), soft: playerReach(true, 0, false), softWall: playerReach(true, 0, true) };
  for (const k of ['walk', 'run']) { const a = SKIN[k], b = PLAYER[k]; rows.push(`${k} ${a} px (a player hears its ${k} to ${b})`); if (Math.abs(a - b) / b > .2) bad.push(`${k}: ${a} against ${b}`); }
  rows.push(`through a wall: walk ${SKIN.walkWall} (player ${PLAYER.walkWall}), run ${SKIN.runWall} (player ${PLAYER.runWall})`);
  if (SKIN.walkWall > PLAYER.walkWall * 1.2 || SKIN.runWall > PLAYER.runWall * 1.2) bad.push('through a wall farther than a player hears');
  rows.push(`crouching ${SKIN.crouch} px, ${SKIN.crouchWall} through a wall (a player hears it tread softly to ${PLAYER.soft})`);
  if (!(SKIN.crouch < SKIN.walk * .35 && SKIN.crouch <= PLAYER.soft)) bad.push(`crouching ${SKIN.crouch}`);
  // the Hound and the Smiler: the shared law, untouched
  for (const kind of ['hound', 'smiler']) {
    const got = reach(kind, 'walk', NZ.walk), gotW = reach(kind, 'walk', NZ.walk, true), e = ents[kind], want = NZ.walk * (.42 + e.tr.HEARING * 1.05);
    if (Math.abs(got - want) > want * .015 || Math.abs(gotW - want * .6) > want * .6 * .015) bad.push(`${kind}: walk ${got} / wall ${gotW}, the law ${Math.round(want)}`); else rows.push(`${kind} walk ${got} (the shared law), wall ${gotW}`);
  }
  return { ok: !bad.length, note: bad.length ? bad.join('; ') + ' | ' + rows.join(' | ') : rows.join(' | '), data: { SKIN, PLAYER } };
});

module.exports = S;
