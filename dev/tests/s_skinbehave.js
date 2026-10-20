/* SKIN-STEALER behaviour refinement scenarios (dev/trial-3-behavior-refinement/; Trial 3 is not owner-approved).  Each runs the real
 * server simulation (sim.js + ai.js as built) with the harness's scripted players (the game's own move.js model), seeded and headless.
 * No scenario sets an AI decision: they place people, move them as a player would, and read what the creature did.  Every scenario
 * that says the creature noticed or ignored somebody also counts whether that person was SEEN (e.seenNow) or HEARD at the time.
 * (The scripts that move a person may use where the creature really is: that is the player's own sight of it, not the creature's.)
 * B1: BR01-BR07, awareness while it roams or leaves.  B2: BR09, BR11-BR14, BR20, provocation, warnings, fading, the very hungry
 * departure. */
'use strict';
const { World, DT, over, rate, AI } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const ARENA = { x: 3960, y: 3384 };                    // an open hall (every wall at least 300 px off), dim (lamp .15)
const WALL_A = { e: { x: 1240, y: 5100 }, far: [{ x: 900, y: 4960 }, { x: 900, y: 5250 }] };   // wall A of the dark south-west (x 976..1072)
const planOf = e => e.plan ? e.plan.k : 'roam';
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
const HUNT = new Set(['watch', 'retreat', 'approach', 'chase', 'lure', 'intercept', 'search', 'mingle']);

/* one Skin-Stealer in the open hall; a lit person 350 px east of it, facing it; a far, still, lightless anchor that keeps the near tier */
function stage(seed, o = {}) {
  const w = World(seed);
  const e = w.eng.spawn('skinstealer', o.ex ?? ARENA.x, o.ey ?? ARENA.y, { hunger: o.hunger ?? 0 }); e.tier = 'near'; e.ang = o.ea ?? 0;
  const p = w.player(o.px ?? ARENA.x + 350, o.py ?? ARENA.y, { light: o.light !== false, angle: Math.PI }); p.stop('stand'); p.look = Math.PI;
  const anchor = w.player(ARENA.x - 1500, ARENA.y + 900, { light: false }); anchor.stop('crouch');
  return { w, e, p, anchor };
}
/* ten times a second: what it perceived of p, and what it did (the record of every scenario) */
function trace(w, e, p) {
  const T = [];
  T.take = t => {
    const r = e.mem.p.get(p.id), A = e.aw && e.aw.get(p.id), d = Math.hypot(p.x - e.x, p.y - e.y);
    T.push({ t: +t.toFixed(1), plan: planOf(e), P: e.plan, ex: Math.round(e.x), ey: Math.round(e.y), act: e.act || '-', rx: e.rx ? e.rx.k + (e.rx.pid ? ':' + e.rx.pid : ':sound') : '', d: Math.round(d), v: Math.round(e.speed),
      seen: e.seenNow.has(p.id) ? 1 : 0, heard: r && w.eng.now - r.heardAt < .12 ? 1 : 0, left: e.left.has(p.id) ? 1 : 0, pr: A ? +A.p.toFixed(2) : 0, tier: A ? A.tier : 0,
      face: +Math.abs(angDiff(Math.atan2(p.y - e.y, p.x - e.x), e.ang)).toFixed(2), head: +(e.head || 0).toFixed(2), goal: e.plan && e.plan.goal ? e.plan.goal : null });
  };
  return T;
}
const every = (fn, n = 6) => (w, t) => { if (Math.round(t / DT) % n === 0) fn(t); return true; };
/* the person runs (or walks) circles round it, R px off, keeping its own sight of the creature; or walks right behind it */
function orbiter(w, e, p, R, mode = 'run', w0 = 2.0) {
  let phi = Math.atan2(p.y - e.y, p.x - e.x);
  return () => {
    phi += w0 * DT; let tx = e.x + Math.cos(phi) * R, ty = e.y + Math.sin(phi) * R;
    for (let k = 0; k < 8 && !w.ad.clear(tx, ty, 20, 'walk'); k++) { phi += .4; tx = e.x + Math.cos(phi) * R; ty = e.y + Math.sin(phi) * R; }
    p.mode = mode; p.path = null; p.tx = { x: tx, y: ty }; p.look = Math.atan2(e.y - p.y, e.x - p.x);
  };
}
/* somebody walking past it once: put ahead of it (where it is going), they walk toward a point `side` px to one side of its way (their
 * own sight of it), and once they are level with it they keep straight on */
function passer(w, e, p, side = 150) {
  let st = null;
  return {
    start(seed) {
      for (const [ahead, side] of [[460, 0], [400, 60], [400, -60], [340, 0]]) {
        const h = e.ang, x = e.x + Math.cos(h) * ahead - Math.sin(h) * side, y = e.y + Math.sin(h) * ahead + Math.cos(h) * side;
        if (w.ad.clear(x, y, 22, 'walk') && w.eng.geo.lineClear(e.x, e.y, x, y, 22, 'walk')) { p.x = x; p.y = y; p.look = null; st = { sgn: seed % 2 ? 1 : -1, dir: null }; return { x, y }; }
      }
      return null;
    },
    step() {
      if (!st) return;
      if (!st.dir) {
        const a = Math.atan2(e.y - p.y, e.x - p.x), n = e.ang + Math.PI / 2 * st.sgn, tx = e.x + Math.cos(n) * side, ty = e.y + Math.sin(n) * side;
        const fx = Math.cos(a), fy = Math.sin(a);
        if ((e.x - p.x) * (p.vx || fx) + (e.y - p.y) * (p.vy || fy) < 0 && Math.hypot(p.vx, p.vy) > 40) st.dir = Math.atan2(p.vy, p.vx);   // level with it, or past: straight on
        else { p.mode = 'walk'; p.path = null; p.tx = { x: tx, y: ty }; return; }
      }
      p.mode = 'walk'; p.path = null; p.tx = { x: p.x + Math.cos(st.dir) * 200, y: p.y + Math.sin(st.dir) * 200 };
    },
  };
}
const tailer = (w, e, p, R) => () => { const a = e.ang + Math.PI; p.mode = 'walk'; p.path = null; p.tx = { x: e.x + Math.cos(a) * R, y: e.y + Math.sin(a) * R }; p.look = Math.atan2(e.y - p.y, e.x - p.x); };
/* looks it started (each a reaction to one person, or to a sound) */
function looks(T) { const out = []; for (let i = 0; i < T.length; i++) if (T[i].rx && (!i || T[i - 1].rx !== T[i].rx)) out.push(T[i]); return out; }

add('BR01 passing is safe: at hunger 0, a person who walks past once, close, gets at most a glance - no strike, no warning, no chase, no turn toward hunting', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p);
    let t0 = -1, from = null, strike = false; const go = passer(w, e, p);
    w.run(16, (ww, t) => {
      if (t0 < 0 && planOf(e) === 'leave' && t > 1) { t0 = t; from = go.start(seed); }   // it has left: somebody comes the other way and walks past it once
      if (from) go.step();
      if (e.pounce) strike = true;
      return every(T.take)(ww, t);
    });
    const after = t0 < 0 ? [] : T.filter(s => s.t >= t0), close = after.filter(s => s.seen && s.d < 200), dmin = Math.min(...after.map(s => s.d));
    const hunted = after.some(s => HUNT.has(s.plan) && s.P && s.P.pid === p.id), L = looks(after), Lp = L.filter(s => s.rx.endsWith(':' + p.id));
    return { ok: !!from && dmin < 200 && !strike && !w.kills.length && !hunted && Lp.length <= 1 && L.length <= 2 && after[after.length - 1].d > 400, exercised: !!from && dmin < 200, dmin, seenClose: close.length, looks: Lp.length, sounds: L.length - Lp.length, strike, kills: w.kills.length, hunted, end: after.length ? after[after.length - 1].d : -1 };
  });
  const ex = rs.filter(r => r.exercised);
  return { ok: ex.length >= 6 && ex.every(r => r.ok), note: `${ex.length}/8 passed within 200 px (closest ${ex.map(r => r.dmin).join('/')} px; seen close ${ex.map(r => r.seenClose).join('/')} samples): looks at them ${ex.map(r => r.looks).join('/')} (and at their footsteps after ${ex.map(r => r.sounds).join('/')}), strikes ${ex.filter(r => r.strike).length}, kills ${ex.reduce((a, r) => a + r.kills, 0)}, hunting plans ${ex.filter(r => r.hunted).length}; ${ex.map(r => r.end).join('/')} px apart at the end`, data: rs };
});

/* a satiated one decides to leave; then the person runs circles round it (130 px) or walks right behind it (70 px) */
function harass(seed, kind, secs = 22) {
  const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p);
  let go = null, t0 = -1, strike = false;
  w.run(secs, (ww, t) => {
    if (t0 < 0 && planOf(e) === 'leave') { t0 = t; go = kind === 'orbit' ? orbiter(w, e, p, 130) : tailer(w, e, p, 70); }
    if (go && t - t0 > .5) go();
    if (e.pounce) strike = true;
    return every(T.take)(ww, t);
  });
  return { w, e, p, T, t0, strike };
}
add('BR02 circles are noticed: somebody who runs circles round a satiated one, in its sight, is acknowledged within a few seconds - it stops, faces them, keeps its head on them - and only a bounded number of times', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const R = harass(seed, 'orbit'), T = R.T.filter(s => s.t >= R.t0 + .5);
    const firstClose = T.find(s => s.seen && s.d < 200), L = looks(T).filter(s => s.rx.endsWith(':' + R.p.id)), first = L[0];
    const faced = T.filter(s => s.rx && s.face < .6).length, head = T.filter(s => !s.rx && s.v > 20 && Math.abs(s.head) > .2).length;
    const lag = firstClose && first ? +(first.t - firstClose.t).toFixed(1) : -1, maxLooks = Math.ceil((T.length / 10) / AI.SK.ackGap[0]) + 1;
    return { ok: !!firstClose && !!first && lag <= 3 && faced > 0 && L.length <= maxLooks && !R.strike && !R.w.kills.length, seenClose: T.filter(s => s.seen && s.d < 200).length, lag, looks: L.length, maxLooks, faced, head, plans: [...new Set(T.map(s => s.plan))].join('/') };
  });
  return { ok: rate(rs) >= 7 / 8, note: `${rs.filter(r => r.ok).length}/8: seen close ${rs.map(r => r.seenClose).join('/')} samples; first look ${rs.map(r => r.lag).join('/')} s after it first saw them close; looks ${rs.map(r => r.looks).join('/')} (at most ${rs[0].maxLooks}); facing them while looking ${rs.map(r => r.faced).join('/')} samples; head turned toward them while walking ${rs.map(r => r.head).join('/')} samples; plans ${[...new Set(rs.map(r => r.plans))].join(', ')}`, data: rs };
});
add('BR03 a departure is not blind: while it is leaving, a person circling it or walking right behind it is looked at - and the same departure goes on afterwards (same goal, the creature on its way again)', () => {
  const rs = [];
  for (const kind of ['orbit', 'tail']) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const R = harass(seed, kind), T = R.T.filter(s => s.t >= R.t0);
    const L = looks(T).filter((s, i, all) => s.plan === 'leave' && s.rx.endsWith(':' + R.p.id) && T.some(q => q.t > s.t && !q.rx));   // (a look still going on when the run ends is not counted)
    let kept = 0, onWay = 0, ended = 0;
    for (const l of L) {
      const i = T.indexOf(l), j = T.findIndex((s, k) => k > i && !s.rx);
      if (j > 0 && T[j].P === l.P) { kept++; const k2 = T.slice(j, j + 30).find(s => s.v > 40 && s.P === l.P); if (k2) onWay++; }
      else if (j > 0) { const last = T[j - 1], P = l.P; if (P.goal && (Math.hypot(P.goal.x - last.ex, P.goal.y - last.ey) < 90 || last.t + R.w.eng.now - R.w.t >= P.until - .2)) { kept++; ended++; } }   // it ended by itself: arrived, or its own time
    }
    rs.push({ kind, seed, ok: L.length >= 1 && kept === L.length && onWay >= 1, seenInLeave: T.filter(s => s.seen && s.plan === 'leave').length, looks: L.length, kept, ended, onWay });
  }
  const o = rs.filter(r => r.kind === 'orbit'), t = rs.filter(r => r.kind === 'tail');
  return { ok: rate(o) >= 5 / 6 && rate(t) >= 5 / 6, note: `circling: ${o.filter(r => r.ok).length}/6 (seen while it left ${o.map(r => r.seenInLeave).join('/')}; looks while leaving ${o.map(r => r.looks).join('/')}, the same departure after each ${o.map(r => r.kept).join('/')}, of which it then ended by itself ${o.map(r => r.ended).join('/')}) | right behind it: ${t.filter(r => r.ok).length}/6 (seen ${t.map(r => r.seenInLeave).join('/')}; looks ${t.map(r => r.looks).join('/')}, kept ${t.map(r => r.kept).join('/')}, ended by itself ${t.map(r => r.ended).join('/')})`, data: rs };
});
add('BR04 a departure stays a choice: somebody in view far off changes nothing; one close pass costs at most one look; no flip-flopping of plans', () => {
  const far = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, e, p } = stage(seed, { hunger: 0, px: ARENA.x + 520 }); const T = trace(w, e, p);
    w.run(20, every(T.take));
    const lv = T.filter(s => s.plan === 'leave'), P0 = lv.length ? lv[0].P : null, plans = new Set(T.filter(s => s.P).map(s => s.P));
    return { ok: !!P0 && !T.some(s => s.rx) && plans.size === 1, seenFar: T.filter(s => s.seen).length, minD: Math.min(...T.map(s => s.d)), looks: looks(T).length, plans: plans.size };
  });
  const pass = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p); let t0 = -1, from = null; const go = passer(w, e, p);
    w.run(16, (ww, t) => {
      if (t0 < 0 && planOf(e) === 'leave' && t > 1) { t0 = t; from = go.start(seed + 1); }
      if (from) go.step();
      return every(T.take)(ww, t);
    });
    const after = T.filter(s => s.t >= t0), plansDuring = new Set(after.filter(s => s.P && s.plan === 'leave').map(s => s.P)), L = looks(after), Lp = L.filter(s => s.rx.endsWith(':' + p.id));
    let flips = 0; for (let i = 1; i < after.length; i++) if (after[i].P !== after[i - 1].P) flips++;
    return { ok: !!from && Lp.length <= 1 && L.length <= 2 && plansDuring.size <= 1 && flips <= 1, dmin: Math.min(...after.map(s => s.d)), looks: Lp.length, sounds: L.length - Lp.length, plans: plansDuring.size, flips };
  });
  return { ok: rate(far) === 1 && rate(pass) === 1, note: `far (seen ${far.map(r => r.seenFar).join('/')} samples, never closer than ${far.map(r => r.minD).join('/')} px): looks ${far.map(r => r.looks).join('/')}, departures ${far.map(r => r.plans).join('/')} | one pass (closest ${pass.map(r => r.dmin).join('/')} px): looks at them ${pass.map(r => r.looks).join('/')} (at their footsteps ${pass.map(r => r.sounds).join('/')}), departures ${pass.map(r => r.plans).join('/')}, plan changes ${pass.map(r => r.flips).join('/')}`, data: { far, pass } };
});
add('BR05 its hunt cooldown is not blindness: somebody it has decided to leave alone, who then follows it closely, is still noticed - and is still not hunted', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, e, p } = stage(seed, { hunger: .3 }); const T = trace(w, e, p); let go = null;
    w.run(50, (ww, t) => { if (!go && planOf(e) === 'leave') go = tailer(w, e, p, 90); if (go) go(); return every(T.take)(ww, t); });
    const cool = T.filter(s => s.left), L = looks(cool).filter(s => s.rx.endsWith(':' + p.id)), roamL = L.filter(s => s.plan === 'roam');
    const hunted = cool.filter(s => HUNT.has(s.plan) && s.P && s.P.pid === p.id).length;
    return { ok: cool.length > 0 && L.length >= 1 && hunted === 0 && !w.kills.length, seenOnCooldown: cool.filter(s => s.seen).length, looks: L.length, inRoam: roamL.length, hunted, roamSeen: cool.filter(s => s.seen && s.plan === 'roam').length };
  });
  return { ok: rate(rs) >= 5 / 6, note: `${rs.filter(r => r.ok).length}/6: seen while on its cooldown list ${rs.map(r => r.seenOnCooldown).join('/')} samples (${rs.map(r => r.roamSeen).join('/')} of them after the departure, roaming): looked at them ${rs.map(r => r.looks).join('/')} times (${rs.map(r => r.inRoam).join('/')} while roaming); hunting plans for them ${rs.map(r => r.hunted).join('/')}`, data: rs };
});
/* somebody it cannot perceive: on the far side of wall A, crouch-walking (or standing still in the dark behind it) - against nobody */
function blind(seed, hunger, who) {
  const w = World(seed);
  const e = w.eng.spawn('skinstealer', WALL_A.e.x, WALL_A.e.y, { hunger }); e.tier = 'near'; e.ang = Math.PI / 2; e.tierT = 1e9;   // (level of detail held: it reads the true nearest player, P9 behaviour - AUDIT.md §4)
  const anchor = w.player(2600, 5900, { light: false }); anchor.stop('crouch');
  const p = who === 'wall' ? w.player(WALL_A.far[0].x, WALL_A.far[0].y, { light: false }) : who === 'behind' ? w.player(WALL_A.e.x, WALL_A.e.y - 260, { light: false }) : null;
  if (p) p.stop(who === 'wall' ? 'crouch' : 'stand');
  const tr = []; let seen = 0, heard = 0, rec = 0;
  w.run(30, () => {
    if (p && who === 'wall' && (!p.path || !p.path.length)) p.route([p.y < 5100 ? WALL_A.far[1] : WALL_A.far[0]], 'crouch');
    if (p) { if (e.seenNow.has(p.id)) seen++; const r = e.mem.p.get(p.id); if (r && w.eng.now - r.heardAt < DT) heard++; if (r) rec = 1; }
    tr.push(Math.round(e.x * 100), Math.round(e.y * 100), Math.round(e.ang * 1000), Math.round((e.head || 0) * 1000), planOf(e).length, e.act.length, e.rx ? 1 : 0);
    return true;
  });
  return { tr, seen, heard, rec, aw: e.aw.size, looks: e.tally.look + e.tally.lookSound };
}
add('BR06 the blind flank: somebody behind a wall, or still and lightless out of its sight, changes nothing it does - the same seed without them gives the same creature, tick for tick', () => {
  const rs = [];
  for (const who of ['wall', 'behind']) for (const hunger of [0, .5]) for (const seed of [1, 2, 3, 4]) {
    const a = blind(seed, hunger, who), b = blind(seed, hunger, null); let first = -1;
    for (let i = 0; i < a.tr.length; i++) if (a.tr[i] !== b.tr[i]) { first = Math.floor(i / 7); break; }
    rs.push({ who, hunger, seed, sensed: a.seen + a.heard > 0 || a.rec, seen: a.seen, heard: a.heard, first, ok: a.seen + a.heard === 0 && !a.rec ? first < 0 : true });
  }
  const unsensed = rs.filter(r => !r.sensed);
  return { ok: rs.every(r => r.ok) && unsensed.length >= 12, note: `${unsensed.length}/16 runs never sensed them (seen 0, heard 0, no record): identical to nobody there in ${unsensed.filter(r => r.first < 0).length}/${unsensed.length}${rs.some(r => r.sensed) ? ` | sensed (not a blind case, reported only): ${rs.filter(r => r.sensed).map(r => `${r.who} h${r.hunger} #${r.seed} seen ${r.seen} heard ${r.heard}`).join('; ')}` : ''}`, data: rs };
});
add('BR07 an uncertain sound: footsteps it hears from behind a wall turn it to look toward the sound (its fuzzy place, no name) - never a record, a reaction to the person, a strike or a hunt for them', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 30);
    const e = w.eng.spawn('skinstealer', WALL_A.e.x, WALL_A.e.y, { hunger: 0 }); e.tier = 'near'; e.ang = Math.PI / 2;
    const anchor = w.player(2600, 5900, { light: false }); anchor.stop('crouch');
    const p = w.player(WALL_A.far[0].x, WALL_A.far[0].y, { light: false }); p.stop('stand');
    let seen = 0, off = [], strike = false;
    w.run(15, (ww, t) => {
      if (t > 1 && (!p.path || !p.path.length)) p.route([{ x: 900, y: p.y < 5050 ? 5170 : 4940 }], 'run');   // (up and down the middle of the wall: its gap, below, would show them)
      if (e.seenNow.has(p.id)) seen++;
      if (e.rx && e.rx.at && !e.rx.seenOff) { e.rx.seenOff = 1; off.push(Math.round(Math.hypot(e.rx.at.x - p.x, e.rx.at.y - p.y))); }
      if (e.pounce) strike = true;
      return true;
    });
    const rec = e.mem.p.get(p.id), aware = e.aw.has(p.id), hunted = !!(e.plan && e.plan.pid === p.id);
    return { ok: !aware && !rec && !strike && !w.kills.length && !hunted, unseen: !seen, seen, heardLooks: e.tally.lookSound, personLooks: e.tally.look, off, rec: !!rec, aware, strike };
  });
  const U = rs.filter(r => r.unseen), looked = U.filter(r => r.heardLooks > 0);
  return { ok: U.length >= 4 && U.every(r => r.ok) && looked.length >= 3 && rs.every(r => !r.strike), note: `${U.length}/6 never saw them (the others saw them over the wall's end: not this case, excluded): ${U.filter(r => r.ok).length}/${U.length} kept no record, never reacted to them as a person, never struck; ${looked.length}/${U.length} turned to look at the sound (${U.map(r => r.heardLooks).join('/')} times; aimed ${[].concat(...U.map(r => r.off)).join('/')} px from where they really were)`, data: rs };
});

/* ---------------------------------------------------------------- B2: provocation, warning, fading, the very hungry departure */
/* somebody pressing in on it: they keep `R` px from it, facing it (their own sight of it), walking after it when it backs away */
const presser = (w, e, p, R = 70) => () => { const d = Math.hypot(p.x - e.x, p.y - e.y), ux = (p.x - e.x) / (d || 1), uy = (p.y - e.y) / (d || 1); p.mode = 'walk'; p.path = null; p.tx = { x: e.x + ux * R, y: e.y + uy * R }; p.look = Math.atan2(e.y - p.y, e.x - p.x); };
/* a spot beside its way ahead (180 px off it), 250-500 px from it, in its line of sight - somebody it will come upon without walking into
 * them (a hungry one grabs whoever is within its reach) - facing it */
function ahead(w, e) {
  const pts = e.path.concat([{ x: e.x + Math.cos(e.ang) * 400, y: e.y + Math.sin(e.ang) * 400 }]);
  for (const q0 of pts) for (const sd of [1, -1]) {
    const a0 = Math.atan2(q0.y - e.y, q0.x - e.x), q = { x: q0.x - Math.sin(a0) * 180 * sd, y: q0.y + Math.cos(a0) * 180 * sd }, d = Math.hypot(q.x - e.x, q.y - e.y);
    if (d >= 250 && d <= 500 && w.ad.clear(q.x, q.y, 22, 'walk') && w.eng.geo.lineClear(e.x, e.y, q.x, q.y, 6, 'walk')) return { x: q.x, y: q.y, a: Math.atan2(e.y - q.y, e.x - q.x) };
  }
  return null;
}
const warnsOf = (T, pid) => looks(T).filter(s => s.rx === 'warn:' + pid);
add('BR09 counterplay: somebody who presses in on a satiated one until it warns them, then backs off, is let go - the pressure fades, nothing follows them, it goes its way', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p); let go = presser(w, e, p), warnAt = -1, away = null;
    w.run(40, (ww, t) => {
      if (warnAt < 0 && e.rx && e.rx.k === 'warn') { warnAt = t; const a = Math.atan2(p.y - e.y, p.x - e.x); away = { x: p.x + Math.cos(a) * 700, y: p.y + Math.sin(a) * 700 }; go = null; p.look = null; p.pathTo(away.x, away.y, 'walk') || p.go(away.x, away.y, 'walk'); }
      if (go && t > .5) go();
      return every(T.take)(ww, t);
    });
    const after = warnAt < 0 ? [] : T.filter(s => s.t >= warnAt + 3), A = e.aw.get(p.id), peak = Math.max(...T.map(s => s.pr));
    const p15 = (T.find(s => s.t >= warnAt + 15) || {}).pr, closest = after.length ? Math.min(...after.map(s => s.d)) : -1;
    const followed = after.some(s => HUNT.has(s.plan) && s.P && s.P.pid === p.id), warns = warnsOf(T, p.id).length;
    return { ok: warnAt >= 0 && p15 !== undefined && p15 < AI.SK.pAware && !followed && closest > 300 && !w.kills.length && warns === 1, warnAt: +warnAt.toFixed(1), peak, p15, closest, followed, warns, end: T[T.length - 1].d };
  });
  return { ok: rate(rs) >= 5 / 6, note: `${rs.filter(r => r.ok).length}/6: warned them after ${rs.map(r => r.warnAt).join('/')} s of pressing (peak pressure ${rs.map(r => r.peak).join('/')}); 15 s after the warning ${rs.map(r => r.p15).join('/')}; nearest after they backed off ${rs.map(r => r.closest).join('/')} px; followed ${rs.filter(r => r.followed).length}; warnings ${rs.map(r => r.warns).join('/')}; apart at the end ${rs.map(r => r.end).join('/')} px`, data: rs };
});
add('BR11 a brief accidental bump: somebody who walks straight into a satiated one once and on - no attack of any kind; at most unease (a look, a warning)', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p); let t0 = -1, from = null, strike = false; const go = passer(w, e, p, 25);   // (aimed 25 px to its side: they brush it and walk on)
    w.run(16, (ww, t) => { if (t0 < 0 && planOf(e) === 'leave' && t > 1) { t0 = t; from = go.start(seed); } if (from) go.step(); if (e.pounce) strike = true; return every(T.take)(ww, t); });
    const after = T.filter(s => s.t >= t0), dmin = Math.min(...after.map(s => s.d)), peak = Math.max(...after.map(s => s.pr));
    return { ok: !!from && !strike && !w.kills.length && peak < (AI.SK.pDefend ?? .8), exercised: !!from && dmin < 70, dmin, peak, warns: warnsOf(after, p.id).length, looks: looks(after).filter(s => s.rx === 'look:' + p.id).length, strike };
  });
  const ex = rs.filter(r => r.exercised);
  return { ok: ex.length >= 6 && ex.every(r => r.ok), note: `${ex.length}/8 bumped into it (closest ${ex.map(r => r.dmin).join('/')} px): strikes ${ex.filter(r => r.strike).length}, kills 0; peak pressure ${ex.map(r => r.peak).join('/')} (it may defend only from ${(AI.SK.pDefend ?? .8)}); looks ${ex.map(r => r.looks).join('/')}, warnings ${ex.map(r => r.warns).join('/')}`, data: rs };
});
add('BR12 two people: one presses in on it, the other stands by in its view - the provocation stays the presser\'s; the bystander is never warned, and gets no pressure beyond their own presence', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p);
    const q = w.player(ARENA.x - 40, ARENA.y + 260, { light: true, angle: -Math.PI / 2 }); q.stop('stand'); q.look = () => Math.atan2(e.y - q.y, e.x - q.x);
    const go = presser(w, e, p); let qMax = 0, qWarn = 0, qSeen = 0, strikeQ = false;
    w.run(30, (ww, t) => {
      if (t > .5) go();
      const B = e.aw.get(q.id); if (B) qMax = Math.max(qMax, B.p); if (e.rx && e.rx.k === 'warn' && e.rx.pid === q.id) qWarn++; if (e.seenNow.has(q.id)) qSeen++;
      if (e.pounce && e.pounce.tid === q.id) strikeQ = true;
      return every(T.take)(ww, t);
    });
    const pw = warnsOf(T, p.id).length, killedQ = w.kills.some(k => k.pid === q.id);
    return { ok: qWarn === 0 && qMax <= AI.SK.capNear + 1e-9 && !strikeQ && !killedQ, pw, qMax: +qMax.toFixed(2), qSeen, qWarn, pMax: Math.max(...T.map(s => s.pr)) };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/6: the presser warned ${rs.map(r => r.pw).join('/')} times (peak ${rs.map(r => r.pMax).join('/')}); the bystander (seen ${rs.map(r => r.qSeen).join('/')} ticks) peaked at ${rs.map(r => r.qMax).join('/')} (presence alone stops at ${AI.SK.capNear}), warned 0, struck at 0, killed 0`, data: rs };
});
add('BR13 a long harassment: three minutes of somebody pressing in on it - its warnings stay spaced, its records stay few, it is never pinned in one place', () => {
  const rs = over([1, 2, 3], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p); const go = presser(w, e, p, 80);
    let maxAw = 0, react = 0, n = 0, maxHeard = 0; const cells = new Set();
    w.run(180, (ww, t) => {
      if (t > .5 && !p.dead) go();
      maxAw = Math.max(maxAw, e.aw.size); maxHeard = Math.max(maxHeard, e.heard.length); n++; if (e.rx) react++; cells.add(Math.round(e.x / 200) + ',' + Math.round(e.y / 200));
      return every(T.take)(ww, t);
    });
    const W = warnsOf(T, p.id), gaps = W.slice(1).map((s, i) => +(s.t - W[i].t).toFixed(1)), minGap = gaps.length ? Math.min(...gaps) : 99;
    return { ok: maxAw <= AI.SK.awMax && minGap >= AI.SK.warnTime[0] + AI.SK.warnGap - .15 && react / n < .6 && cells.size >= 4, warns: W.length, minGap, maxAw, reacting: +(react / n).toFixed(2), places: cells.size, kills: w.kills.length };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/3: warnings ${rs.map(r => r.warns).join('/')} (never closer than ${rs.map(r => r.minGap).join('/')} s apart), awareness records at most ${rs.map(r => r.maxAw).join('/')}, reacting ${rs.map(r => r.reacting).join('/')} of the time, ${rs.map(r => r.places).join('/')} 200-px places visited; kills ${rs.map(r => r.kills).join('/')}`, data: rs };
});
add('BR14 a very hungry departure: thought over only on fresh sight of somebody it may hunt, after a few seconds, at most once a second - never because hunger rose, never for the person it left, never after a lost race', () => {
  // A: it leaves two people (A, B); B walks off out of sight, A stays (on its cooldown); later a newcomer C comes into view alone
  const fresh = over([1, 2, 3, 4], seed => {
    const { w, e, p } = stage(seed, { hunger: .7 }); const b = w.player(ARENA.x + 330, ARENA.y + 90, { light: true, angle: Math.PI }); b.stop('stand'); b.look = Math.PI;
    let leftAt = -1, cAt = -1, c = null, changedAt = -1, P0 = null, seenC = -1;
    w.run(30, (ww, t) => {
      if (leftAt < 0 && planOf(e) === 'leave') { leftAt = t; P0 = e.plan; b.light = false; b.pathTo(ARENA.x + 1400, ARENA.y + 900, 'walk'); }
      if (leftAt >= 0 && !c && t - leftAt > 6) { const s0 = ahead(w, e); if (s0) { c = w.player(s0.x, s0.y, { light: true, angle: s0.a }); c.stop('stand'); c.look = s0.a; cAt = t; } }
      if (c && seenC < 0 && e.seenNow.has(c.id)) seenC = t;
      if (P0 && changedAt < 0 && e.plan !== P0) changedAt = t;
      return true;
    });
    return { leftAt: +leftAt.toFixed(1), cAt: +cAt.toFixed(1), seenC: +seenC.toFixed(1), changedAt: +changedAt.toFixed(1), why: e.dbg.lv || '', reconsider: e.tally.reconsider, ok: leftAt >= 0 && (changedAt < 0 || (seenC >= 0 && changedAt >= seenC && changedAt - leftAt >= AI.SK.leaveDwell)) };
  });
  // B: it leaves the one person; they hide; its hunger crosses into starving during the departure: nothing changes
  const stale = over([1, 2, 3, 4], seed => {
    const { w, e, p } = stage(seed, { hunger: .79 }); const q = w.player(ARENA.x + 330, ARENA.y + 90, { light: true, angle: Math.PI }); q.stop('stand'); q.look = Math.PI;
    let leftAt = -1, P0 = null, changed = false, ended = '', seenAfter = 0;
    w.run(25, (ww, t) => {
      if (leftAt < 0 && planOf(e) === 'leave') { leftAt = t; P0 = e.plan; for (const x of [p, q]) { x.light = false; x.x = ARENA.x - 1200; x.y = ARENA.y + 1100; x.stop('crouch'); } }
      if (P0 && !ended && e.plan !== P0) { ended = P0.goal && Math.hypot(P0.goal.x - e.x, P0.goal.y - e.y) < 90 ? 'arrived' : w.eng.now >= P0.until - .2 ? 'its time' : 'changed'; changed = ended === 'changed'; }
      if (P0 && (e.seenNow.has(p.id) || e.seenNow.has(q.id))) seenAfter++;
      return true;
    });
    return { ok: leftAt >= 0 && !changed && e.hunger >= .8, leftAt: +leftAt.toFixed(1), hunger: +e.hunger.toFixed(3), changed, ended: ended || 'still leaving', seenAfter, reconsider: e.tally.reconsider };
  });
  // C: it loses a straight race (SK22's), then somebody new comes into view during that departure: it keeps going
  const race = over([1, 2, 3, 4], seed => {
    const w = World(seed + 300), y = 3504; const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .7 }); e.tier = 'near'; e.ang = 0; p.go(8700, y, 'run');
    let P0 = null, c = null, changed = false, ended = '', seenC = 0;
    w.run(26, (ww, t) => {
      if (!P0 && planOf(e) === 'leave') P0 = e.plan;
      if (P0 && !c && w.eng.now - P0.t0 > 5) { const s0 = ahead(w, e); if (s0) { c = w.player(s0.x, s0.y, { light: true, angle: s0.a }); c.stop('stand'); c.look = s0.a; } }
      if (c && e.seenNow.has(c.id)) seenC++;
      if (P0 && !ended && e.pounce) ended = 'its arm\'s-reach grab (Trial 3: a hungry one grabs whoever is in its reach)';
      if (P0 && !ended && e.plan !== P0) { ended = P0.goal && Math.hypot(P0.goal.x - e.x, P0.goal.y - e.y) < 90 ? 'arrived' : w.eng.now >= P0.until - .2 ? 'its time' : 'changed'; changed = ended === 'changed'; }
      return true;
    });
    return { ok: !!P0 && P0.race === true && !changed, race: !!(P0 && P0.race), seenC, changed, ended: ended || 'still leaving' };
  });
  const fr = fresh.filter(r => r.changedAt >= 0);
  return { ok: rate(fresh) === 1 && rate(stale) === 1 && race.filter(r => r.seenC > 0).length >= 2 && rate(race) === 1,
    note: `newcomer: ${fresh.map(r => `left at ${r.leftAt} s, newcomer seen at ${r.seenC} s, ${r.changedAt < 0 ? 'kept its departure' : r.reconsider ? 'gave up its departure at ' + r.changedAt + ' s' : 'its departure ended at ' + r.changedAt + ' s (kept it when it thought again)'}`).join(' | ')} | hidden, hunger past 0.8 during the departure: changed ${stale.filter(r => r.changed).length}/4 (${stale.map(r => r.ended).join(', ')}; hunger at the end ${stale.map(r => r.hunger).join('/')}) | after a lost race: a lost-race departure ${race.filter(r => r.race).length}/4, the newcomer seen ${race.map(r => r.seenC).join('/')} ticks, changed ${race.filter(r => r.changed).length}/4 (${race.map(r => r.ended).join(', ')})`, data: { fresh, stale, race } };
});
add('BR20 nothing stale survives: a person who leaves the game, goes far away for a minute, or an admin clear, a removal or a world reset - their pressure goes with it', () => {
  const press = (seed) => { const { w, e, p, anchor } = stage(seed, { hunger: 0 }); const go = presser(w, e, p); w.run(5, (ww, t) => { if (t > .5) go(); return true; }); return { w, e, p, anchor, p0: e.aw.get(p.id) ? +e.aw.get(p.id).p.toFixed(2) : 0 }; };
  const out = {};
  { const { w, e, p, p0 } = press(1); w.sim.removePlayer(p); w.run(.5); out.disconnect = { p0, kept: e.aw.has(p.id), rx: !!(e.rx && e.rx.pid === p.id) }; }
  { const { w, e, p, anchor, p0 } = press(2); p.x = 8600; p.y = 6100; p.stop('crouch'); p.light = false; anchor.x = 8500; anchor.y = 6200; w.run(60); const farTier = e.tier;   // (everybody far away: its level of detail goes far)
    p.x = e.x + 350; p.y = e.y; p.light = true; p.stop('stand'); p.look = Math.PI; anchor.x = e.x - 1500; anchor.y = e.y; w.run(.8); const A = e.aw.get(p.id), back = A ? +A.p.toFixed(3) : 0, tierBack = e.tier;
    let warns = 0; w.run(8, () => { if (e.rx && e.rx.k === 'warn') warns++; return true; });
    out.far = { p0, farTier, tierBack, back, warns }; }
  { const { w, e, p, p0 } = press(3); w.eng.navCmd(e, 'clear', p); out.clear = { p0, n: e.aw.size, rx: !!e.rx }; }
  { const { w, e, p0 } = press(4); const id = e.id; w.sim.admin.removeSkinStealer(); out.removed = { p0, gone: !w.eng.entities.some(x => x.id === id) }; }
  { const { w, p0 } = press(5); w.sim.resetWorld(); out.reset = { p0, none: !w.eng.entities.some(x => x.kind === 'skinstealer') }; }
  const ok = Object.values(out).every(o => o.p0 >= AI.SK.pAware) && !out.disconnect.kept && !out.disconnect.rx && out.far.farTier === 'far' && out.far.tierBack === 'near' && out.far.back < .05 && !out.far.warns && out.clear.n === 0 && !out.clear.rx && out.removed.gone && out.reset.none;
  return { ok, note: `pressure built first (${Object.values(out).map(o => o.p0).join('/')}); left the game: record ${out.disconnect.kept ? 'KEPT' : 'dropped'}; a minute far away (tier ${out.far.farTier}, then ${out.far.tierBack}): their pressure when it is near again ${out.far.back}, warnings in the next 8 s ${out.far.warns}; admin clear: ${out.clear.n} records; removed: gone ${out.removed.gone}; world reset: none ${out.reset.none}`, data: out };
});

module.exports = S;
