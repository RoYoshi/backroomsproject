/* SKIN-STEALER behaviour refinement scenarios (dev/trial-3-behavior-refinement/; Trial 3 is not owner-approved).  Each runs the real
 * server simulation (sim.js + ai.js as built) with the harness's scripted players (the game's own move.js model), seeded and headless.
 * No scenario sets an AI decision: they place people, move them as a player would, and read what the creature did.  Every scenario
 * that says the creature noticed or ignored somebody also counts whether that person was SEEN (e.seenNow) or HEARD at the time.
 * (The scripts that move a person may use where the creature really is: that is the player's own sight of it, not the creature's.)
 * B1: BR01-BR07, awareness while it roams or leaves.  B2: BR09, BR11-BR14, BR20, provocation, warnings, fading, the very hungry
 * departure.  B3: BR08, BR10, BR15-BR17, BR19, defence.  (From B3 on, BR02 and BR05 - long harassment - allow a kill, but only a defence
 * after a warning.) */
'use strict';
const { World, DT, over, rate, AI, floorNear, bystander } = require('./lib.js');
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
    const kills = R.w.kills.filter(k => k.pid === R.p.id).length, warned = R.e.tally.warn > 0, defended = kills <= R.e.tally.defendHit;   // (B3: a kill, if any, only by a defence after a warning)
    return { ok: !!firstClose && !!first && lag <= 3 && faced > 0 && L.length <= maxLooks && (!kills || (warned && defended)) && R.w.kills.length === kills, seenClose: T.filter(s => s.seen && s.d < 200).length, lag, looks: L.length, maxLooks, faced, head, kills, warns: R.e.tally.warn, plans: [...new Set(T.map(s => s.plan))].join('/') };
  });
  return { ok: rate(rs) >= 7 / 8, note: `${rs.filter(r => r.ok).length}/8: seen close ${rs.map(r => r.seenClose).join('/')} samples; first look ${rs.map(r => r.lag).join('/')} s after it first saw them close; looks ${rs.map(r => r.looks).join('/')} (at most ${rs[0].maxLooks}); facing them while looking ${rs.map(r => r.faced).join('/')} samples; head turned toward them while walking ${rs.map(r => r.head).join('/')} samples; warnings ${rs.map(r => r.warns).join('/')}, killed in defence ${rs.map(r => r.kills).join('/')} (from B3: 22 s of circling it after its warnings can end so)`, data: rs };
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
    const kills = w.kills.filter(k => k.pid === p.id).length, defended = kills <= e.tally.defendHit && e.tally.warn > 0;   // (B3: a kill, if any, only by a defence after a warning)
    return { ok: cool.length > 0 && L.length >= 1 && hunted === 0 && (!kills || defended) && w.kills.length === kills, seenOnCooldown: cool.filter(s => s.seen).length, looks: L.length, inRoam: roamL.length, hunted, kills, warns: e.tally.warn, roamSeen: cool.filter(s => s.seen && s.plan === 'roam').length };
  });
  return { ok: rate(rs) >= 5 / 6, note: `${rs.filter(r => r.ok).length}/6: seen while on its cooldown list ${rs.map(r => r.seenOnCooldown).join('/')} samples (${rs.map(r => r.roamSeen).join('/')} of them after the departure, roaming): looked at them ${rs.map(r => r.looks).join('/')} times (${rs.map(r => r.inRoam).join('/')} while roaming); hunting plans for them ${rs.map(r => r.hunted).join('/')}; warnings ${rs.map(r => r.warns).join('/')}, killed in defence ${rs.map(r => r.kills).join('/')} (from B3: following it 90 px behind for 50 s, after its warnings, can end so)`, data: rs };
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
add('BR13 a long harassment: three minutes of somebody pressing in on it, coming back after every death - its warnings stay spaced, its records stay few, it is never pinned in one place, and every defence is a fresh incident after a fresh warning, never closer than its own gaps', () => {
  const rs = over([1, 2, 3], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const T = trace(w, e, p); const go = presser(w, e, p, 80), SP = springs(w, e, p);
    let maxAw = 0, react = 0, n = 0, deadAt = -1, deaths = 0; const cells = new Set();
    w.run(180, (ww, t) => {
      if (p.dead) { if (deadAt < 0) { deadAt = t; deaths++; } else if (t - deadAt > 5 && w.sim.canRespawn && w.sim.canRespawn(p)) { w.sim.respawn(p); p.safe = 0; deadAt = -1; } }   // they come back
      else if (t > .5) go();
      maxAw = Math.max(maxAw, e.aw.size); n++; if (e.rx) react++; cells.add(Math.round(e.x / 200) + ',' + Math.round(e.y / 200)); SP.take(t);
      return every(T.take)(ww, t);
    });
    const W = warnsOf(T, p.id), gaps = W.slice(1).map((s, i) => +(s.t - W[i].t).toFixed(1)), minGap = gaps.length ? Math.min(...gaps) : 99, D = SP.out;
    const dg = D.slice(1).map((s, i) => +(s.t - D[i].t).toFixed(1)), fresh = D.every(s => s.warns >= 1 && s.sinceWarn >= AI.SK.defAfterWarn - .05 && s.sinceWarn <= AI.SK.pressFor + .05);
    return { ok: maxAw <= AI.SK.awMax && minGap >= AI.SK.warnTime[0] + AI.SK.warnGap - .15 && react / n < .6 && cells.size >= 4 && fresh && (!dg.length || Math.min(...dg) >= AI.SK.defGapAll - .05) && w.kills.length <= deaths,
      warns: W.length, minGap, maxAw, reacting: +(react / n).toFixed(2), places: cells.size, defences: D.length, gaps: dg, kills: w.kills.length, deaths, withdrew: e.tally.withdraw };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/3: warnings ${rs.map(r => r.warns).join('/')} (never closer than ${rs.map(r => r.minGap).join('/')} s apart), awareness records at most ${rs.map(r => r.maxAw).join('/')}, reacting ${rs.map(r => r.reacting).join('/')} of the time, ${rs.map(r => r.places).join('/')} 200-px places visited; defensive strikes ${rs.map(r => r.defences).join('/')} (apart ${rs.map(r => r.gaps.join(', ') || '-').join(' / ')} s; each after a fresh warning), withdrawals ${rs.map(r => r.withdrew).join('/')}, kills ${rs.map(r => r.kills).join('/')} in ${rs.map(r => r.deaths).join('/')} deaths`, data: rs };
});
add('BR14 a very hungry departure: thought over only on fresh sight of somebody it may hunt, after a few seconds, at most once a second - never because hunger rose, never for the person it left; and (R1) a lost race is no departure but never a new chase for a while', () => {
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
  // C: it loses a straight race (SK22's).  (Predator refinement R1, the owner's instruction for a very hungry one: a lost race is no longer
  // a departure - it keeps to the runner's trail.  What B2 protected stays: it does not become a chaser because the runner stays in view -
  // no new chase for SK.chaseRest after the lost race and never faster in that time than its free walking pace (SK.runFrom); and
  // somebody new coming into view does not send it after them either while that holds.)
  const race = over([1, 2, 3, 4], seed => {
    const w = World(seed + 300), y = 3504; const p = w.player(5300, y, { light: true, angle: 0 }); p.stop('stand'); p.look = 0;
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .7 }); e.tier = 'near'; e.ang = 0; p.go(8700, y, 'run');
    let lostAt = -1, c = null, seenC = 0, chaseAgain = -1, vmax = 0, plans = new Set(), left = false;
    w.run(26, (ww, t) => {
      if (lostAt < 0 && e.tally.chaseLost) lostAt = t;
      if (lostAt >= 0 && !c && t - lostAt > 5) { const s0 = ahead(w, e); if (s0) { c = w.player(s0.x, s0.y, { light: true, angle: s0.a }); c.stop('stand'); c.look = s0.a; } }
      if (c && e.seenNow.has(c.id)) seenC++;
      if (lostAt >= 0 && t - lostAt < AI.SK.chaseRest - .2) { if (planOf(e) === 'chase' && chaseAgain < 0) chaseAgain = +(t - lostAt).toFixed(1); if (!e.pounce && !e.recover && !e.trav && t - lostAt > .5) vmax = Math.max(vmax, e.speed); plans.add(planOf(e)); }   // (after half a second: it slows from the race; a vault on the way is the engine's traversal, not its stride)
      if (lostAt >= 0 && planOf(e) === 'leave') left = true;
      return true;
    });
    return { ok: lostAt >= 0 && chaseAgain < 0 && vmax <= AI.SK.runFrom + 1, lostAt: +lostAt.toFixed(1), chaseAgain, vmax: Math.round(vmax), plans: [...plans].join('/'), left, seenC };
  });
  const fr = fresh.filter(r => r.changedAt >= 0);
  return { ok: rate(fresh) === 1 && rate(stale) === 1 && rate(race) === 1,
    note: `newcomer: ${fresh.map(r => `left at ${r.leftAt} s, newcomer seen at ${r.seenC} s, ${r.changedAt < 0 ? 'kept its departure' : r.reconsider ? 'gave up its departure at ' + r.changedAt + ' s' : 'its departure ended at ' + r.changedAt + ' s (kept it when it thought again)'}`).join(' | ')} | hidden, hunger past 0.8 during the departure: changed ${stale.filter(r => r.changed).length}/4 (${stale.map(r => r.ended).join(', ')}; hunger at the end ${stale.map(r => r.hunger).join('/')}) | after a lost race (R1: no departure for a very hungry one): chase again within ${AI.SK.chaseRest} s ${race.filter(r => r.chaseAgain >= 0).length}/4, fastest then ${race.map(r => r.vmax).join('/')} px/s (its free pace ${AI.SK.runFrom}), plans ${race.map(r => r.plans).join(' | ')}; it later left ${race.filter(r => r.left).length}/4; the newcomer seen ${race.map(r => r.seenC).join('/')} ticks`, data: { fresh, stale, race } };
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

/* ---------------------------------------------------------------- B3: defence */
/* somebody who will not let it be: they keep R px from it, facing it, walking - running when it gets away (their own sight of it) */
const persist = (w, e, p, R = 60) => () => { const d = Math.hypot(p.x - e.x, p.y - e.y), ux = (p.x - e.x) / (d || 1), uy = (p.y - e.y) / (d || 1); p.mode = d > 160 ? 'run' : 'walk'; p.path = null; p.tx = { x: e.x + ux * R, y: e.y + uy * R }; p.look = Math.atan2(e.y - p.y, e.x - p.x); };
/* a kill made at contact: the killer's body against the victim's, nothing solid between (SK32's rule) */
const contactOk = (w, k, e) => Math.hypot(k.geo.ax - k.victim.x, k.geo.ay - k.victim.y) < e.r + 18 + 1 && w.eng.geo.lineClear(k.geo.ax, k.geo.ay, k.victim.x, k.victim.y, 3, 'walk');
/* every defensive spring: what it knew and how it stood at that instant */
function springs(w, e, p) {
  const out = []; let on = false;
  return { out, take(t) {
    if (e.pounce && e.pounce.style === 'defend' && !on) {
      on = true; const A = e.aw.get(p.id) || {}, d = Math.hypot(p.x - e.x, p.y - e.y);
      out.push({ t: +t.toFixed(2), h: +e.hunger.toFixed(4), d: Math.round(d), line: w.eng.geo.lineClear(e.x, e.y, p.x, p.y, 3, 'walk'), seen: e.seenNow.has(p.id), warns: A.warns || 0,
        sinceWarn: +(w.eng.now - (A.warnEnd ?? -99)).toFixed(2), p: +(A.p || 0).toFixed(2), odds: e.dbg.def && e.dbg.def.odds, cornered: !!(e.dbg.def && e.dbg.def.cornered), wind: e.pounce.wind, tid: e.pounce.tid,
        aimOff: +Math.abs(angDiff(e.pounce.dir, Math.atan2(p.y - e.y, p.x - e.x))).toFixed(2), closing: Math.round(-((p.x - e.x) * (p.vx || 0) + (p.y - e.y) * (p.vy || 0)) / Math.max(1, d)) });   // (B5: the lunge's aim against where they are, and how fast they come at it)
    }
    if (!e.pounce) on = false;
  } };
}
add('BR08 a satiated one defends itself: at hunger 0, somebody who keeps pressing in on it after it has warned them can be killed - by a defensive strike after a warning, that lands on their body - and its hunger is never changed for it', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const h0 = e.hunger, go = persist(w, e, p), SP = springs(w, e, p);
    let prevH = null, drift = 0, killAt = -1;
    w.run(60, (ww, t) => {
      if (!p.dead && !p.caught) go();
      if (killAt < 0 && prevH !== null) { drift = Math.max(drift, Math.abs(e.hunger - prevH - AI.SK.hungerRate * DT)); if (w.kills.length) killAt = t; }   // (each step: exactly its rate; until the kill, then it feeds)
      prevH = e.hunger; SP.take(t);
      return true;
    });
    const K = w.kills.filter(k => k.pid === p.id), others = w.kills.length - K.length, S0 = SP.out;
    const fair = S0.every(s => s.warns >= 1 && s.sinceWarn >= AI.SK.defAfterWarn - .05 && s.h < AI.SK.band[0] && s.line && s.seen && s.d <= AI.SK.defReach + 2 && s.wind === AI.SK.defWind && s.tid === p.id && s.aimOff < 1.3);   // (B5: never aimed away from them - a right lead for somebody moving fast sideways is up to about 1 rad; the B4 aim was 1.55-3.13 rad off somebody walking at it)
    const killedOk = K.length <= 1 && (!K.length || (S0.length >= 1 && contactOk(w, K[0], e) && p.kill && p.kill.k === 'SkinStealer' && p.dead === 'SkinStealer'));
    return { ok: h0 === 0 && drift < 1e-9 && fair && killedOk && !others && e.tally.warn >= 1, killed: K.length > 0, at: K.length ? +K[0].at.toFixed(1) : -1, v: K.length ? K[0].variant : '', springs: S0, warns: e.tally.warn, withdrew: e.tally.withdraw, h0, drift };
  });
  const killed = rs.filter(r => r.killed), first = rs.map(r => r.springs[0]).filter(Boolean);
  return { ok: rate(rs) === 1 && killed.length >= 3, note: `${rs.filter(r => r.ok).length}/8 fair (hunger began at exactly 0 and only rose with time; every defence came after a warning, at least ${AI.SK.defAfterWarn} s after it ended, within reach, seen, with a clear way, wind-up ${AI.SK.defWind} s); killed in defence ${killed.length}/8 (at ${killed.map(r => r.at).join('/')} s, variants ${killed.map(r => r.v).join('/')}); hunger at the first defence ${first.map(s => s.h).join('/')}; its odds then ${first.map(s => s.odds + (s.cornered ? ' cornered' : '')).join('/')}; warnings ${rs.map(r => r.warns).join('/')}; withdrawals ${rs.map(r => r.withdrew).join('/')}; every lunge aimed within ${Math.max(0, ...rs.flatMap(r => r.springs.map(s => s.aimOff)))} rad of them (closing at up to ${Math.max(0, ...rs.flatMap(r => r.springs.map(s => s.closing)))} px/s)`, data: rs.map(r => ({ ...r, springs: r.springs.slice(0, 3) })) };
});
add('BR10 nothing through anything solid: somebody it is ready to defend against, seen within reach across a corner or a low obstacle it cannot pass, is never sprung at; every defensive kill is at contact with a clear way', () => {
  const rs = [];
  for (const [cx, cy] of [[5600, 900], [3384, 900], [5150, 940]]) for (const seed of [1, 2, 3]) {
    const w = World(seed), s0 = floorNear(w, cx, cy, 24), e = w.eng.spawn('skinstealer', s0.x, s0.y, { hunger: 0 }); e.tier = 'near'; e.ang = Math.PI / 2;
    const s1 = floorNear(w, s0.x, s0.y + 150, 20), p = w.player(s1.x, s1.y, { light: true }); p.stop('stand');
    const anchor = w.player(s0.x - 1500, s0.y + 900, { light: false }); anchor.stop('crouch');
    const go = persist(w, e, p); let blocked = 0, springBlocked = 0, on = false, springs = 0;
    w.run(60, () => {
      if (!p.dead && !p.caught) go();
      const A = e.aw.get(p.id), d = Math.hypot(p.x - e.x, p.y - e.y), line = w.eng.geo.lineClear(e.x, e.y, p.x, p.y, e.rc * .6, 'walk');
      const ready = A && A.p >= AI.SK.pDefend && A.warns && e.seenNow.has(p.id) && d <= AI.SK.defReach;
      if (ready && !line) blocked++;
      if (e.pounce && e.pounce.style === 'defend' && !on) { on = true; springs++; if (!line) springBlocked++; } if (!e.pounce) on = false;
      return true;
    });
    const K = w.kills.filter(k => k.kind === 'SkinStealer');
    rs.push({ at: `${cx},${cy}#${seed}`, blocked, springs, springBlocked, kills: K.length, contact: K.every(k => contactOk(w, k, e)) });
  }
  const ex = rs.filter(r => r.blocked > 0);
  return { ok: ex.length >= 3 && rs.every(r => !r.springBlocked && r.contact), note: `${ex.length}/9 runs had it ready to defend against somebody it saw within reach with no way to them (${ex.map(r => r.blocked).join('/')} ticks): sprung at then ${rs.reduce((a, r) => a + r.springBlocked, 0)} times; defensive springs in all ${rs.reduce((a, r) => a + r.springs, 0)}, kills ${rs.reduce((a, r) => a + r.kills, 0)}, every one at contact with a clear way: ${rs.every(r => r.contact)}`, data: rs };
});
add('BR15 counterplay against the defence: somebody who sees its wind-up and gets out of the way makes it miss - it stands recovering, cannot spring again for seconds, does not defend against them again for a while even when they come back, and goes', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); const go = persist(w, e, p); let dodge = 0, missAt = -1, rec = 0, cool = 0, back = -1, after = 0, plan = '', fast = false, recEnd = -1, fleeLook = 0, fleeT = 0;
    w.run(90, (ww, t) => {
      if (e.plan && e.plan.k === 'leave' && e.plan.fast) { fleeT++; if (e.rx && e.rx.k === 'look') fleeLook++; }   // (B5: fleeing, it does not stop to look)
      if (!dodge && e.pounce && e.pounce.style === 'defend' && e.act === 'wind') { dodge = t; const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2; p.look = null; p.route([{ x: p.x + Math.cos(a) * 160, y: p.y + Math.sin(a) * 160 }, { x: p.x + Math.cos(a) * 160 + Math.cos(a - Math.PI / 2) * 900, y: p.y + Math.sin(a) * 160 + Math.sin(a - Math.PI / 2) * 900 }], 'run'); }   // the tell: they break sideways, then run
      if (dodge && missAt < 0 && e.tally.defendMiss) { missAt = t; rec = e.recover; cool = +(e.pounceCool - w.eng.now).toFixed(2); }
      if (missAt >= 0 && back < 0 && t - missAt > 6) back = t;                     // they come back and press in again
      if (back >= 0 && !p.dead && !p.caught) go();
      else if (!dodge && !p.dead && !p.caught) go();
      if (missAt >= 0 && recEnd < 0 && !e.pounce && e.recover <= 0) recEnd = t;
      if (recEnd >= 0 && !plan && t - recEnd > .3) { plan = e.plan ? e.plan.k : 'roam'; fast = !!(e.plan && e.plan.fast); }   // (its decision once it has recovered)
      if (missAt >= 0 && t - dodge < AI.SK.defCool - .1 && e.pounce && e.pounce.style === 'defend' && e.tally.defend > 1) after++;   // (its cooldown runs from that defence's start)
      return true;
    });
    return { ok: !dodge || (missAt < 0 ? !!w.kills.length : rec >= AI.SK.recoverMiss[0] - .05 && cool >= AI.SK.pounceCool[0] - .05 && !after && plan === 'leave' && fast && !fleeLook), dodged: !!dodge, missed: missAt >= 0, rec: +rec.toFixed(2), cool, again: after, plan, fast, fleeT, fleeLook, killed: w.kills.length };
  });
  const missed = rs.filter(r => r.missed);
  return { ok: rate(rs) === 1 && missed.length >= 3, note: `${rs.filter(r => r.dodged).length}/8 saw its wind-up and broke away; it missed ${missed.length} (caught ${rs.filter(r => r.dodged && !r.missed).length}): recovering ${missed.map(r => r.rec).join('/')} s, ${missed.map(r => r.cool).join('/')} s before another spring, then ${missed.map(r => r.plan + (r.fast ? ' (fast)' : '')).join('/')}; defended against them again within ${AI.SK.defCool} s of that defence although they came back and pressed in: ${missed.reduce((a, r) => a + r.again, 0)} ticks; stopped to look while fleeing: ${missed.reduce((a, r) => a + r.fleeLook, 0)} of ${missed.reduce((a, r) => a + r.fleeT, 0)} ticks`, data: rs };
});
add('BR16 one death, one corpse: a defensive kill names the Skin-Stealer as the killer everywhere; the victim leaving the game during it changes nothing - one kill, the server\'s one corpse, the creature on its kill and then at its meal', () => {
  const D = require(require('../tools/layout.js').at('death_srv.js'));
  const rs = over([2, 3, 4, 5, 6], seed => {
    const { w, e, p } = stage(seed, { hunger: 0 }); bystander(w); const go = persist(w, e, p); let gone = -1, kill = null, body = null, fed = false, caps = 0, info = { name: 'k', look: 'none|a', ek: 'flashlight', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, light: true };
    w.run(60, (ww, t) => {
      if (gone >= 0 && planOf(e) === 'feed') fed = true; if (e.cap) caps++;
      if (!p.dead && !p.caught && gone < 0) go();
      if (gone < 0 && p.dead) { gone = t; kill = Object.assign({}, p.kill); body = D.bodyFor(p.id, kill, info, w.sim); w.sim.removePlayer(p); }   // they close the game the moment they die
      if (gone >= 0 && body && !body.put && t - gone >= D.durOf(kill)) { body.put = 1; w.sim.setBody(p.id, body.body); }   // the death plays out on the server; its corpse
      return true;
    });
    const K = w.kills.filter(k => k.pid === p.id), mine = w.sim.bodies ? [...w.sim.bodies.values()].filter(b => b.k === p.id) : [];
    return { ok: gone < 0 || (K.length === 1 && kill.k === 'SkinStealer' && body.body.c === 'SkinStealer' && mine.length === 1 && !e.cap && !caps && e.tally.kills === 1 && fed && e.tally.defendHit === 1), died: gone >= 0, kills: K.length, cause: kill && kill.k, corpse: body && body.body.c, bodies: mine.length, fed, plan: e.plan ? e.plan.k : 'roam' };
  });
  const died = rs.filter(r => r.died);
  return { ok: rate(rs) === 1 && died.length >= 2, note: `${died.length}/${rs.length} killed in defence and left the game at once: kill events ${died.map(r => r.kills).join('/')}, cause ${died.map(r => r.cause).join('/')}, the server's corpse ${died.map(r => r.corpse).join('/')} (${died.map(r => r.bodies).join('/')} for that player); it fed at its kill ${died.map(r => r.fed).join('/')}, then ${died.map(r => r.plan).join('/')} at 60 s`, data: rs };
});
add('BR17 its skin and its words are as they were: in a borrowed skin it never looks, warns or defends - it walks up openly as before - and its lines are still its own entity packets', () => {
  const LOOK = 'cap|freckles|#aabbcc|#112233|none';
  const rs = over([1, 2, 3, 4], seed => {
    const w = World(4300 + seed), y = 3504; bystander(w);
    const v = w.player(5160, y, { light: true, angle: 0 }); v.look = 0; v.stop('stand');
    const e = w.eng.spawn('skinstealer', 5000, y, { hunger: .7 }); e.tier = 'near'; e.ang = 0; let took = false;
    w.run(60, () => { if (!took && v.kill && !e.commit && planOf(e) === 'feed') { w.sim.killerEnd(v.id, e.x, e.y, e.ang); took = w.eng.skinFrom(e.id, v.id, LOOK); } return !e.disguise; });
    if (!e.disguise) return { ok: false, why: 'no skin' };
    e.hunger = .12; const lines = []; w.eng.voiceOut = L => lines.push(L);
    const s = floorNear(w, e.x + 300, e.y), q = w.player(s.x, s.y, { light: true, angle: Math.PI }); q.stop('stand');
    const go = orbiter(w, e, q, 110, 'run'); let rx = 0, mingle = false, strike = false, inSkin = 0;
    w.run(15, (ww, t) => { if (t > 1.5) go(); if (e.disguise) { inSkin++; if (e.rx) rx++; } if (planOf(e) === 'mingle') mingle = true; if (e.pounce) strike = true; return true; });
    return { ok: !rx && mingle && !strike && lines.every(L => L.e === e.id && Number.isSafeInteger(L.o)), rx, mingle, strike, inSkin, lines: lines.length };
  });
  return { ok: rate(rs) >= 3 / 4, note: `${rs.filter(r => r.ok).length}/4: circled at 110 px while it wore a skin (${rs.map(r => r.inSkin).join('/')} ticks): reactions ${rs.map(r => r.rx).join('/')}, walked up openly ${rs.map(r => r.mingle).join('/')}, struck ${rs.map(r => r.strike).join('/')}; lines ${rs.map(r => r.lines).join('/')}, every one its own (entity id, never a person's session id as speaker) - SK40-SK44 are unchanged`, data: rs };
});
add('BR19 its streams are its own: provoking a Skin-Stealer (looks, warnings, a defence) does not move a single Hound or Smiler elsewhere in the world - the same seed with it left alone gives the same Hounds and Smilers, tick for tick', () => {
  const run = (press) => {
    const w = World(19), { x, y } = ARENA;
    const e = w.eng.spawn('skinstealer', x, y, { hunger: 0 }); e.tier = 'near'; e.ang = 0;
    const p = w.player(x + 350, y, { light: true, angle: Math.PI }); p.stop('stand'); p.look = Math.PI;
    const others = [w.hound(8600, 700), w.hound(8500, 6300), w.smiler(700, 6300), w.smiler(8600, 3500)].map(o => (o.tierT = 1e9, o));   // (far from anywhere it goes; their level of detail held)
    const go = persist(w, e, p); const tr = []; let near = 1e9;
    w.run(30, () => { if (press && !p.dead && !p.caught) go(); for (const o of others) { tr.push(Math.round(o.x * 100), Math.round(o.y * 100), o.state.length); near = Math.min(near, Math.hypot(o.x - e.x, o.y - e.y)); } return true; });
    return { tr, warns: e.tally.warn, defend: e.tally.defend + e.tally.withdraw, looks: e.tally.look, near: Math.round(near), seenBy: others.map(o => o.mem.p.has(p.id) ? 1 : 0).join('') };
  };
  const a = run(true), b = run(false); let first = -1; for (let i = 0; i < a.tr.length; i++) if (a.tr[i] !== b.tr[i]) { first = i; break; }
  return { ok: first < 0 && a.warns >= 1 && a.defend >= 1 && a.seenBy === '0000' && b.seenBy === '0000' && Math.min(a.near, b.near) > 1500, note: `provoked (looks ${a.looks}, warnings ${a.warns}, defences or withdrawals ${a.defend}) against left alone: two Hounds and two Smilers ${first < 0 ? 'identical over ' + a.tr.length / 12 + ' ticks' : 'DIFFERENT from tick ' + Math.floor(first / 12)}; none of them ever sensed the person (${a.seenBy}/${b.seenBy}); the Skin-Stealer never came within ${Math.min(a.near, b.near)} px of them` };
});

S.helpers = { stage, persist, springs, contactOk };              // (for dev/trial-3-behavior-refinement/tools/br_dump.js: the same drivers, more seeds)
module.exports = S;
