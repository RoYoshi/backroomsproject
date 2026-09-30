
/* ---------------------------------------------------------------- HOUND: primal, hears everything, fast in straight lines, poor at turning */
const HACT = { '': 0, listen: 1, sniff: 2, freeze: 3, wind: 4, lunge: 5, recover: 6, feed: 7, vault: 8, circle: 9, stare: 10, drag: 11, growl: 12, rest: 13, pace: 14, back: 15, guard: 16 };
const HOUND = {
  name: 'Hound', kind: 'hound', initial: S.ROAMING, radius: 26, clearance: 21, vTop: 320, turnPenalty: .62, roamSpeed: 92,
  traits: { INTELLIGENCE: .25, SADISM: .12, HUNGER: .72, PATIENCE: .3, CURIOSITY: .45, CAUTION: .3, TERRITORIALITY: .5, AGGRESSION: .82, PERSISTENCE: .72, SOCIAL: .45, HEARING: .86, VISION: .5, LIGHT_SENS: .12, MEMORY: .35 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: 1.2, CAN_CROUCH: true, CAN_CRAWL: true, CAN_SLIDE: false, CAN_OPEN_DOORS: false, CAN_BREAK_DOORS: true, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.4, ACCELERATION: 880 },
  vision: { range: 640, fov: 2.7, dark: false, gain: 3.0 },
  speeds: { roam: 92, stalk: 84, investigate: 122, search: 134, chase: 292, retreat: 235, frustrated: 150 },
  init(eng, e) { e.roam = { goal: null, until: 0, nextListen: rand(eng, 4, 11) }; e.lunge = null; e.recover = 0; e.search = null; e.feed = null; e.chaseBlind = 0; e.growlAt = 0; e.rest = 0; },
};
const hSpeed = (e, k, eng) => (e.sp.speeds[k] || 100) * (k === 'chase' ? 1 + (e.tr.AGGRESSION - .82) * .18 + (eng.pressure || 0) * .04 : 1);

function houndTargetScore(e, r, now) {
  const age = memAge(e, r, now), d = Math.hypot(r.lkx - e.x, r.lky - e.y);
  let s = r.aw * .7 + r.conf * .6 - Math.min(1, age / 25) * .35 - d / 6000;
  if (r.seen) s += .55; if (r.st === 2 || r.st === 5) s += .3; if (r.ex) s += .25;                    // loud / exhausted prey draws it
  return s;
}
function pickTarget(eng, e, filter) {
  let best = null, bs = -1;
  for (const r of e.mem.p.values()) {
    if (r.conf < .04 && !r.seen) continue;
    const pv = eng.playerById(r.id); if (!pv || !pv.alive || pv.caught) continue;
    if (filter && !filter(r)) continue;
    const s = houndTargetScore(e, r, eng.now); if (s > bs) { bs = s; best = r; }
  }
  return best;
}
/* how many of the people it can see right now stand together (within ~420 px of the same person) */
function groupSeen(eng, e) {
  const ps = []; for (const id of e.seenNow) { const pv = eng.playerById(id); if (pv && pv.alive && !pv.caught) ps.push(pv); }
  let best = ps.length ? 1 : 0;
  for (const a of ps) { let n = 0; for (const b of ps) if (dist(a.x, a.y, b.x, b.y) < 420) n++; if (n > best) best = n; }
  return best;
}
function houndGrowl(eng, e, I = .7, type = 'growl') { if (eng.now - e.growlAt < 2.5) return; e.growlAt = eng.now; eng.sound({ x: e.x, y: e.y, r: 980, I, type, src: -e.id, ent: e.id }); }

/* ROAMING: wander a route of far-apart spots, stopping now and then to listen.  ------------------------------------------------ */
function hRoam(eng, e, dt) {
  const R = e.roam;
  if (e.act === 'listen') {                                               // stands still, head up, hearing sharpened
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 1.7) * .5; if (e.actT > R.listenFor) { setAct(e, ''); R.nextListen = eng.now + rand(eng, 6, 15); R.goal = null; }
    return;
  }
  if (e.act === 'rest') { stopMoving(eng, e, dt); if (e.actT > e.rest) { setState(e, S.ROAMING, ''); e.rest = 0; } return; }
  if (eng.now > R.nextListen && e.speed < 140) { setAct(e, 'listen'); R.listenFor = rand(eng, 1.6, 3.8); return; }
  if (!R.goal || eng.now > R.until || dist(e.x, e.y, R.goal.x, R.goal.y) < 60) {
    if (R.goal && eng.rng() < .12 && e.tier !== 'near') { setState(e, S.DORMANT, 'rest'); e.rest = rand(eng, 8, 20); R.goal = null; return; }
    R.goal = randomFloor(eng, e, 900, 2800) || randomFloor(eng, e, 400, 1600); R.until = eng.now + 40;
    if (R.goal) plan(eng, e, R.goal.x, R.goal.y);
  }
  if (R.goal) { const st = follow(eng, e, dt, hSpeed(e, 'roam', eng), {}); if (st === 'nopath') R.goal = null; e.head = Math.sin(e.t * .9) * .3; } else stopMoving(eng, e, dt);
}

/* SEARCHING: check the last known position, listen, then likely paths.  Wrong guesses are allowed. -------------------------------- */
function beginSearch(eng, e, r, why) {
  setState(e, S.SEARCHING, 'freeze');
  e.search = { rid: r ? r.id : 0, started: eng.now, goal: null, phase: 'go', legs: 0, visited: [], why, until: eng.now + lerp(11, 36, e.tr.PERSISTENCE) * (.75 + .5 * (1 - e.tr.PATIENCE)), pause: 0, first: true };
  e.dbg.searchWhy = why;
  if (r) { const est = estimate(e, r, eng.now); e.search.goal = { x: r.lkx, y: r.lky }; e.search.est = est; }
}
function pickSearchGoal(eng, e, s) {
  const r = e.mem.p.get(s.rid), now = eng.now;
  const base = r ? estimate(e, r, now) : { x: e.x, y: e.y, unc: 500 };
  const hd = r ? Math.atan2(r.lvy, r.lvx) : e.ang, sp = r ? Math.hypot(r.lvx, r.lvy) : 0;
  let best = null, bs = -1e9;
  const R = Math.max(260, Math.min(1100, base.unc * .9));
  for (let i = 0; i < 14; i++) {
    const a = eng.rng() * TAU, d = rand(eng, 120, R);
    const gx = base.x + Math.cos(a) * d, gy = base.y + Math.sin(a) * d, cell = eng.geo.cellAt(gx, gy);
    if (cell < 0 || eng.geo.cls[cell] !== 1) continue;
    const p = { x: eng.geo.cx(cell), y: eng.geo.cy(cell) };
    let sc = -Math.hypot(p.x - base.x, p.y - base.y) * .3 + (sp > 30 ? Math.cos(angDiff(Math.atan2(p.y - base.y, p.x - base.x), hd)) * 240 : 0) - Math.hypot(p.x - e.x, p.y - e.y) * .12 + eng.rng() * 110;
    for (const v of s.visited) if (Math.hypot(v.x - p.x, v.y - p.y) < 260) { sc -= 320; break; }
    if (e.mem.visited.has(cell) && now - e.mem.visited.get(cell) < 40) sc -= 200;
    if (sc > bs) { bs = sc; best = p; }
  }
  return best;
}
function hSearch(eng, e, dt, thinkNow) {
  const s = e.search; if (!s) { setState(e, S.ROAMING); return; }
  const now = eng.now;
  if (e.act === 'freeze') {                                                // a beat to listen on arrival / first snap decision
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.1) * .55;
    if (e.actT > (s.first ? rand(eng, .25, .6) : rand(eng, .7, 1.7))) { s.first = false; setAct(e, 'sniff'); s.pause = 0; }
    return;
  }
  if (e.act === 'sniff' && s.phase === 'pause') {
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 3.2) * .6; s.pause += dt;
    if (s.pause > rand(eng, .9, 2.2)) { s.phase = 'go'; s.goal = pickSearchGoal(eng, e, s); s.legs++; setAct(e, ''); e.mood.frustration = Math.min(1, e.mood.frustration + .07); }
    return;
  }
  if (now > s.until || s.legs > 7) { e.mood.frustration = Math.min(1, e.mood.frustration + .25); setState(e, S.FRUSTRATED, 'pace'); e.frus = { until: now + rand(eng, 2, 4.5) }; return; }
  if (!s.goal) { s.goal = pickSearchGoal(eng, e, s); if (!s.goal) { setState(e, S.ROAMING); return; } }
  goTo(eng, e, s.goal.x, s.goal.y, { every: 1.5 });
  const st = follow(eng, e, dt, hSpeed(e, s.why === 'sound' ? 'investigate' : 'search', eng), {});
  e.head = Math.sin(e.t * 1.6) * .35;
  if (st === 'arrived' || st === 'nopath' || dist(e.x, e.y, s.goal.x, s.goal.y) < 50) {
    const c = eng.geo.cellAt(e.x, e.y); if (c >= 0) e.mem.visited.set(c, now); s.visited.push({ x: s.goal.x, y: s.goal.y });
    s.phase = 'pause'; setAct(e, 'sniff'); s.pause = 0; s.goal = null;
  }
}

/* STALKING / HUNTING with the committed lunge. ------------------------------------------------------------------------------- */
function beginHunt(eng, e, r, why) {
  if (e.state !== S.HUNTING) { houndGrowl(eng, e, .75); e.mood.arousal = Math.min(1, e.mood.arousal + .5); }
  setState(e, S.HUNTING, ''); e.target = r.id; e.chaseBlind = 0; e.huntWhy = why; e.huntStart = eng.now;
}
/* a lunge is a commitment of ~0.75 s in a straight line: the hound springs when the prey will still be within reach where it is going
 * to land, judged from how fast the prey is moving away (or toward it).  A hound is not a calculator: how well it judges depends on
 * INTELLIGENCE, so it sometimes goes too early or too late - and a player who changes direction after the wind-up makes it miss. */
function lungeStats(e) { const agg = e.tr.AGGRESSION, speed = 500 + agg * 45, wind = .3 - agg * .05, dur = .44; return { speed, wind, dur, reach: speed * dur * .825 + 26, T: wind + dur * .8 }; }
function lungeCheck(eng, e, r, tgt) {
  if (e.lunge || e.recover > 0 || e.cool.lunge > 0 || e.trav) return false;
  const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy), err = Math.abs(angDiff(Math.atan2(dy, dx), e.ang));
  if (d < 96 || d > 330 || err > .42) return false;
  const L = lungeStats(e), vr = d > 1 ? (tgt.vx * dx + tgt.vy * dy) / d : 0;         // > 0: the prey is moving away along the line of the lunge
  if (e.lungeBias === undefined) e.lungeBias = (eng.rng() - .5) * (1.15 - e.tr.INTELLIGENCE) * 96;
  const need = d + vr * L.T + e.lungeBias;                                            // how far the hound must travel to land on it
  if (need < 70 || need > L.reach + 34) return false;
  if (!eng.geo.lineClear(e.x, e.y, tgt.x, tgt.y, 14, 'walk')) return false;
  return true;
}
function startLunge(eng, e, tgt) {
  const lead = .2 + .08 * e.tr.INTELLIGENCE, px = tgt.x + tgt.vx * lead, py = tgt.y + tgt.vy * lead, L = lungeStats(e);
  e.lunge = { t: 0, wind: L.wind, dur: L.dur, dir: Math.atan2(py - e.y, px - e.x), speed: L.speed, aim: { x: px, y: py }, hit: false, tid: tgt.id };
  e.lungeBias = undefined;
  setAct(e, 'wind'); houndGrowl(eng, e, .9, 'lungecue');
}
function stepLunge(eng, e, dt) {
  const L = e.lunge; L.t += dt;
  if (L.t < L.wind) {                                                   // wind-up: crouch, a last small correction of aim
    const t = eng.playerById(L.tid);
    if (t) { const want = Math.atan2(t.y + t.vy * .18 - e.y, t.x + t.vx * .18 - e.x); L.dir += clamp(angDiff(want, L.dir), -1.6 * dt, 1.6 * dt) * clamp(1 - L.t / L.wind, 0, 1); }
    turnTo(e, L.dir, 10, dt); e.speed = approach(e.speed, 60, 1500 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt);
    return false;
  }
  if (e.act !== 'lunge') setAct(e, 'lunge');
  const k = (L.t - L.wind) / L.dur;
  turnTo(e, L.dir, 12, dt); e.speed = L.speed * (1 - .35 * k);            // committed: straight line along the aimed direction, no steering (the body has turned to it during the wind-up)
  const before = { x: e.x, y: e.y };
  e.moved = moveCollide(eng, e, Math.cos(L.dir) * e.speed * dt, Math.sin(L.dir) * e.speed * dt);
  if (e.moved < e.speed * dt * .4) { e.lunge = null; e.recover = 1.25; e.stun = true; setAct(e, 'recover'); e.dbg.lunge = 'wall'; return true; }   // ran into a wall
  // contact
  for (const pv of eng.nearPlayers(e.x, e.y, 60)) {
    if (!pv.alive || pv.caught) continue;
    const d = dist(e.x, e.y, pv.x, pv.y);
    const air = k > .05 && k < .8;                                        // in the air the hound passes over anything low
    if (d < e.r + 14 && !(air && pv.prof < .55 && pv.st === 5)) { L.hit = pv; break; }
    if (d < e.r + 14 && air && pv.st === 5) e.dbg.lunge = 'slid under';
  }
  if (L.hit) { const pv = L.hit; e.lunge = null; e.recover = .5; setAct(e, 'recover'); return { pv, dir: L.dir, speed: e.speed }; }
  if (k >= 1) { e.lunge = null; e.recover = rand(eng, .85, 1.3); setAct(e, 'recover'); e.mood.frustration = Math.min(1, e.mood.frustration + .18); e.cool.lunge = rand(eng, 1.2, 2.4); e.dbg.lunge = 'missed'; e.lungesMissed = (e.lungesMissed || 0) + 1; }
  return false;
}

function hHunt(eng, e, dt, thinkNow) {
  const now = eng.now, r = e.mem.p.get(e.target), pvT = r && eng.playerById(r.id);
  if (e.recover > 0) {                                                    // after a lunge: overshoot, skid, turn around slowly
    e.recover -= dt; e.speed = approach(e.speed, 40, 620 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt);
    if (r && e.recover < .55) faceToward(e, r.lkx, r.lky, dt, 1.4);
    if (e.recover <= 0) { e.stun = false; setAct(e, ''); }
    return;
  }
  if (e.lunge) { const res = stepLunge(eng, e, dt); if (res && res.pv) return res; return; }
  if (!r || !pvT || !pvT.alive || pvT.caught) { const alt = pickTarget(eng, e); if (alt) { e.target = alt.id; return; } setState(e, S.ROAMING); return; }
  const seen = r.seen;
  if (seen) {
    e.chaseBlind = 0; e.lostSince = 0;
    const tgt = { x: pvT.x, y: pvT.y, vx: pvT.vx, vy: pvT.vy, id: pvT.id };
    if (lungeCheck(eng, e, r, tgt) && eng.rng() < 1 - Math.pow(.04, dt * (1 + e.tr.AGGRESSION))) { startLunge(eng, e, tgt); return; }
    // predicted interception point, but never through walls: plan to it, aim straight when the way is clear
    const lead = clamp(dist(e.x, e.y, tgt.x, tgt.y) / 420, 0, .55) * (.5 + e.tr.INTELLIGENCE);
    const gx = tgt.x + tgt.vx * lead, gy = tgt.y + tgt.vy * lead;
    if (eng.geo.lineClear(e.x, e.y, tgt.x, tgt.y, 16, 'walk') && dist(e.x, e.y, tgt.x, tgt.y) < 620) { e.path = [{ x: gx, y: gy }]; e.goal = { x: gx, y: gy }; e.goalKey = 'direct'; e.pathAge = 0; }
    else goTo(eng, e, gx, gy, { every: .45 });
    e.dbg.pursuit = { x: gx, y: gy };
  } else {
    e.chaseBlind += dt;
    const est = estimate(e, r, now);
    goTo(eng, e, est.x, est.y, { every: .5 });
    e.dbg.pursuit = { x: est.x, y: est.y, blind: +e.chaseBlind.toFixed(1) };
    if (e.chaseBlind > lerp(1.4, 4.6, e.tr.PERSISTENCE)) { beginSearch(eng, e, r, 'lost'); e.mood.frustration = Math.min(1, e.mood.frustration + .15); return; }
  }
  const st = follow(eng, e, dt, hSpeed(e, 'chase', eng), { arrive: 10, noSlow: false });
  e.head = 0;
  // touching the prey without a lunge still counts (a swipe as it runs past)
  for (const pv of eng.nearPlayers(e.x, e.y, 50)) if (pv.alive && !pv.caught && dist(e.x, e.y, pv.x, pv.y) < e.r + 12) return { pv, dir: e.ang, speed: e.speed };
}

const stalkPatience = e => lerp(4, 15, e.tr.PATIENCE) * (1.15 - e.tr.AGGRESSION * .3);
/* STALKING: it shadows the prey - it matches a walker's pace so the prey never simply walks away from it, holds back at a distance
 * while the prey stands still, and creeps a little closer the longer it watches, until it commits (or the prey gives it a reason to). */
function hStalk(eng, e, dt, thinkNow) {
  const r = e.mem.p.get(e.target), pv = r && eng.playerById(r.id);
  if (!r || !pv || !pv.alive || pv.caught) { beginSearch(eng, e, r, 'lost'); return; }
  const seen = r.seen, est = seen ? { x: pv.x, y: pv.y } : estimate(e, r, eng.now), d = dist(e.x, e.y, est.x, est.y);
  e.stalkFor = (e.stalkFor || 0) + dt;
  goTo(eng, e, est.x, est.y, { every: .6 });
  const hold = lerp(380, 205, clamp(e.stalkFor / stalkPatience(e), 0, 1));
  const tv = seen ? Math.hypot(pv.vx, pv.vy) : Math.hypot(r.lvx, r.lvy);                    // how fast it can see the prey going
  const vmax = d > hold ? clamp(tv * 1.12 + (d - hold) * .7, hSpeed(e, 'stalk', eng) * .7, hSpeed(e, 'chase', eng) * .74) : clamp(tv * .7 - (hold - d) * .6, 0, 70);
  follow(eng, e, dt, vmax, { arrive: 30 });
  e.head = Math.sin(e.t * 2.4) * .12;
  if (thinkNow) {
    const runner = r.st === 2 || r.st === 5 || r.ex;
    if (seen && (d < 230 || runner || e.stalkFor > stalkPatience(e))) { beginHunt(eng, e, r, 'stalk-commit'); return; }
    if (!seen && eng.now - Math.max(r.seenAt, r.heardAt) > 3.4) { beginSearch(eng, e, r, 'lost'); }
  }
}

/* what a hound makes of a fresh sound, and of being seen ------------------------------------------------------------------------ */
function hReact(eng, e) {
  const now = eng.now;
  // seen prey
  let seen = null, sd = 1e9;
  for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = eng.playerById(id); if (!pv || !pv.alive || pv.caught) continue; const d = r.dist || 0; if (d < sd) { sd = d; seen = r; } }
  if (seen && seen.aw > .45) {
    const runner = seen.st === 2 || seen.st === 5 || seen.ex, near = sd < 480, hungry = e.tr.HUNGER > .55;
    const grp = groupSeen(eng, e), fresh = grp > (e.grpN || 0); e.grpN = grp;                       // somebody else has just come into view: it takes stock of the group once
    if (fresh && grp >= 2 && !runner && e.state !== S.HUNTING && e.state !== S.CAUTIOUS && eng.rng() < (.16 + e.tr.CAUTION * 1.5) * (e.pack ? .45 : 1) * (sd < 300 ? .35 : 1)) { beginCautious(eng, e, seen); return; }
    if (e.state !== S.HUNTING && e.state !== S.STALKING && e.state !== S.CAUTIOUS) {
      if (runner || near || (hungry && e.tr.AGGRESSION > .7 && seen.aw > .8 && sd < 700)) { beginHunt(eng, e, seen, runner ? 'saw-run' : 'saw-near'); return; }
      setState(e, S.STALKING, ''); e.target = seen.id; e.stalkFor = 0; e.mood.excitement = Math.min(1, e.mood.excitement + .3); return;
    }
    if (e.state === S.STALKING && (runner || near)) { beginHunt(eng, e, seen, 'stalk-spot'); return; }
    if (e.state === S.HUNTING && e.target !== seen.id) { const cur = e.mem.p.get(e.target); if (!cur || !cur.seen) e.target = seen.id; }
    return;
  }
  if (!e.seenNow.size) e.grpN = 0;
  // heard something new
  const h = e.hear;
  if (h && h.t > (e.lastHearT || -1)) {
    e.lastHearT = h.t;
    const isEnt = h.src < 0;
    if (isEnt && h.type === 'growl' && e.state !== S.HUNTING && e.state !== S.FEEDING && e.state !== S.PLAYING) {           // another hound is on to something: pack instinct
      if (eng.rng() < .55 + e.tr.SOCIAL * .4) { beginSearch(eng, e, null, 'sound'); e.search.goal = { x: h.ox, y: h.oy }; e.search.first = false; setAct(e, ''); }
      return;
    }
    if (isEnt) return;
    const r = e.mem.p.get(h.src); if (!r) return;
    const loud = h.I > .5 || h.type === 'run' || h.type === 'slide' || h.type === 'vault';
    if (e.state === S.ROAMING || e.state === S.DORMANT || e.state === S.CURIOUS || e.act === 'listen') {
      e.wake = 1; if (e.state === S.DORMANT) setState(e, S.ROAMING, ''); else setAct(e, '');
      if (loud && eng.rng() < .55 + e.tr.AGGRESSION * .35) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(eng, .35, .85) * (1.2 - e.tr.AGGRESSION * .5), rid: h.src, toward: { x: h.x, y: h.y } }; }
      else if (h.I > .12) { setState(e, S.CURIOUS, 'freeze'); e.cur = { until: now + rand(eng, .6, 1.5), toward: { x: h.x, y: h.y }, n: 0, rid: h.src }; }
    } else if (e.state === S.SEARCHING || e.state === S.FRUSTRATED) {
      if (h.I > .1) { const s = e.search; if (e.state === S.FRUSTRATED) beginSearch(eng, e, r, 'sound'); else { e.search.why = 'sound'; } e.search.goal = { x: h.x, y: h.y }; e.search.phase = 'go'; e.search.until = Math.max(e.search.until, now + 10); setAct(e, ''); if (loud && r.st === 2) beginHunt(eng, e, r, 'heard-run'); }
    } else if (e.state === S.STALKING && (h.type === 'run')) { beginHunt(eng, e, r, 'stalk-heard-run'); }
    else if (e.state === S.HUNTING && !e.mem.p.get(e.target)?.seen) { if (r.id !== e.target && r.conf > .35 && loud) e.target = r.id; }
  }
}

/* the main per-tick behaviour */
function houndTick(eng, e, dt, thinkNow) {
  const now = eng.now;
  e.cool.lunge = Math.max(0, (e.cool.lunge || 0) - dt);
  if (thinkNow) hReact(eng, e);
  let res = null;
  switch (e.state) {
    case S.ROAMING: case S.DORMANT: hRoam(eng, e, dt); break;
    case S.CURIOUS: {
      stopMoving(eng, e, dt); const c = e.cur; if (!c) { setState(e, S.ROAMING); break; }
      faceToward(e, c.toward.x, c.toward.y, dt, 3.5); e.head = Math.sin(e.t * 5) * .15;
      if (e.hear && e.hear.t > c.until - 1.5 && e.hear.t > (c.seenT || 0) && e.hear.src >= 0) { c.seenT = e.hear.t; c.n++; if (c.n >= 1 && e.hear.I > .2) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(eng, .3, .7), rid: e.hear.src, toward: { x: e.hear.x, y: e.hear.y } }; break; } }
      if (now > c.until) { const r = e.mem.p.get(c.rid); if (r && eng.rng() < .45 + e.tr.CURIOSITY * .5) beginSearch(eng, e, r, 'sound'); else { setState(e, S.ROAMING); e.roam.goal = null; } }
      break;
    }
    case S.ALERT: {
      stopMoving(eng, e, dt); const a = e.alert; if (!a) { setState(e, S.ROAMING); break; }
      faceToward(e, a.toward.x, a.toward.y, dt, 5.5); e.head = Math.sin(e.t * 9) * .08;
      if (now > a.until) {
        const r = e.mem.p.get(a.rid);
        if (!r) { setState(e, S.ROAMING); break; }
        if (r.seen) { beginHunt(eng, e, r, 'alert-see'); break; }
        const lastRun = r.st === 2 || r.st === 5, noisy = (e.hear && e.hear.I > .55);
        if (lastRun && eng.rng() < .35 + e.tr.AGGRESSION * .55) { beginHunt(eng, e, r, 'alert-run'); break; }
        if (eng.rng() < .35 + e.tr.PATIENCE * .3 && !noisy) { setState(e, S.STALKING, ''); e.target = r.id; e.stalkFor = 0; break; }
        beginSearch(eng, e, r, 'sound'); e.search.goal = { x: a.toward.x, y: a.toward.y }; e.search.first = false; setAct(e, '');
      }
      break;
    }
    case S.STALKING: hStalk(eng, e, dt, thinkNow); break;
    case S.HUNTING: res = hHunt(eng, e, dt, thinkNow); break;
    case S.SEARCHING: hSearch(eng, e, dt, thinkNow); break;
    case S.FRUSTRATED: {                                                  // snarls and paces, then sweeps a wider area or gives up
      const f = e.frus || { until: now }; e.speed = approach(e.speed, 0, 1200 * dt);
      e.ang += Math.sin(e.t * 3.1) * dt * 2.2; e.head = Math.sin(e.t * 6) * .45; if (eng.rng() < dt * .35) houndGrowl(eng, e, .5, 'snarl');
      if (now > f.until) { const r = e.mem.p.get(e.search && e.search.rid); if (r && r.conf > .1 && eng.rng() < e.tr.PERSISTENCE * .55) { beginSearch(eng, e, r, 'lost'); e.search.until += 8; } else { setState(e, S.ROAMING); e.roam.goal = null; } }
      break;
    }
    case S.FEEDING: res = hFeed(eng, e, dt, thinkNow); break;
    case S.CAUTIOUS: hCautious(eng, e, dt, thinkNow); break;
    case S.EXCITED: hExcited(eng, e, dt, thinkNow); break;
    case S.RETREATING: hRetreat(eng, e, dt); break;
    case S.PLAYING: hPlay(eng, e, dt); break;
    default: setState(e, S.ROAMING);
  }
  return res;
}

/* FEEDING and guarding a body ------------------------------------------------------------------------------------------------- */
function beginFeed(eng, e, site) { setState(e, S.FEEDING, ''); e.feed = { site, until: eng.now + rand(eng, 22, 48), at: false, guard: null }; }
function hFeed(eng, e, dt, thinkNow) {
  const F = e.feed; if (!F || eng.now > F.until) { if (F && F.site) F.site.fed++; setState(e, S.ROAMING); e.roam.goal = null; e.feed = null; return; }
  const s = F.site;
  if (F.guard) {                                                          // someone came for the body: hunt them, but stay near it
    const r = e.mem.p.get(F.guard);
    if (!r || (!r.seen && eng.now - r.seenAt > 3) || dist(e.x, e.y, s.x, s.y) > 520 + e.tr.TERRITORIALITY * 500) { F.guard = null; setAct(e, ''); return; }
    const pv = eng.playerById(F.guard);
    if (pv && pv.alive && !pv.caught) { goTo(eng, e, pv.x, pv.y, { every: .4 }); follow(eng, e, dt, hSpeed(e, 'chase', eng) * .9, { arrive: 10 }); for (const p of eng.nearPlayers(e.x, e.y, 50)) if (p.alive && !p.caught && dist(e.x, e.y, p.x, p.y) < e.r + 12) return { pv: p, dir: e.ang, speed: e.speed }; }
    else F.guard = null;
    return;
  }
  if (!F.at) { goTo(eng, e, s.x, s.y, { every: 1.4 }); const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), { arrive: 34 }); if (dist(e.x, e.y, s.x, s.y) < 60 || st === 'arrived') { F.at = true; setAct(e, 'feed'); } return; }
  if (e.act !== 'feed') setAct(e, 'feed');
  stopMoving(eng, e, dt); faceToward(e, s.x, s.y, dt, 2); e.head = Math.sin(e.t * 7) * .18;
  if (thinkNow) for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = eng.playerById(id); if (pv && pv.alive && !pv.caught && r.dist < 620 && r.aw > .5) { F.guard = id; e.target = id; houndGrowl(eng, e, .8, 'guard'); setAct(e, 'guard'); break; } }
  if (thinkNow && !F.guard && e.hear && e.hear.I > .5 && e.hear.src > 0 && eng.now - e.hear.t < .3 && dist(e.hear.x, e.hear.y, s.x, s.y) < 900) { const r = e.mem.p.get(e.hear.src); if (r) { F.guard = r.id; e.target = r.id; setAct(e, 'guard'); } }
}
/* EXCITED: right after a kill, when nobody else is close: worked up, pacing around the body, snarling - then it settles down to feed */
function beginExcited(eng, e, site) { setState(e, S.EXCITED, 'pace'); e.exc = { site, until: eng.now + rand(eng, 1.6, 3.6), dir: eng.rng() < .5 ? 1 : -1, r: rand(eng, 62, 96) }; }
function hExcited(eng, e, dt, thinkNow) {
  const X = e.exc; if (!X || eng.now > X.until) { setState(e, S.ROAMING); if (X && X.site && e.tr.HUNGER > .3) beginFeed(eng, e, X.site); else e.roam.goal = null; return; }
  const a = Math.atan2(e.y - X.site.y, e.x - X.site.x) + X.dir * dt * 1.15, tx = X.site.x + Math.cos(a) * X.r, ty = X.site.y + Math.sin(a) * X.r;
  if (eng.geo.clear(tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, 100, dt, { turnMul: 1.7, noSlow: true }); else stopMoving(eng, e, dt);
  e.head = Math.sin(e.t * 6.5) * .5; if (eng.rng() < dt * .45) houndGrowl(eng, e, .55, 'snarl');
}

/* CAUTIOUS: several people together are more than a hound wants to take on.  It holds off at a distance, watching and circling, and
 * waits for one of them to be alone, to run, or to fall behind - or gives up and drifts away. */
function beginCautious(eng, e, r) { setState(e, S.CAUTIOUS, 'stare'); e.caut = { until: eng.now + rand(eng, 5, 11), rid: r.id, dir: eng.rng() < .5 ? 1 : -1, last: { x: r.lkx, y: r.lky }, lostT: 0 }; e.target = r.id; }
function hCautious(eng, e, dt, thinkNow) {
  const C = e.caut;
  if (!C || eng.now > C.until) {                                                                                                // it has watched long enough: commit, or withdraw
    e.caut = null; const r = C && e.mem.p.get(C.rid);
    if (r && r.conf > .3 && eng.rng() < clamp(e.tr.AGGRESSION * .6 + e.tr.HUNGER * .3 - e.tr.CAUTION * .5, .2, .85)) { beginHunt(eng, e, r, 'caut-timeout'); return; }
    if (C) { beginRetreat(eng, e, C.last, rand(eng, 8, 14)); return; }
    setState(e, S.ROAMING); e.roam.goal = null; return;
  }
  const seen = []; for (const id of e.seenNow) { const pv = eng.playerById(id); if (pv && pv.alive && !pv.caught) seen.push(pv); }
  if (seen.length) {
    let cx = 0, cy = 0; for (const p of seen) { cx += p.x; cy += p.y; } C.last = { x: cx / seen.length, y: cy / seen.length }; C.lostT = 0;
    if (thinkNow) {
      const runner = seen.find(p => p.st === 2 || p.st === 5 || p.ex), alone = seen.length === 1 || seen.every(p => dist(p.x, p.y, seen[0].x, seen[0].y) > 460);
      if (runner && eng.rng() < .25 + e.tr.AGGRESSION * .5) { const r = rec(e, runner.id); beginHunt(eng, e, r, 'caut-run'); return; }
      if (alone && dist(e.x, e.y, seen[0].x, seen[0].y) < 720) { const r = rec(e, seen[0].id); if (eng.rng() < .5 + e.tr.AGGRESSION * .4) { beginHunt(eng, e, r, 'caut-alone'); return; } }
    }
  } else { C.lostT += dt; if (C.lostT > 3) { const r = e.mem.p.get(C.rid); if (r) beginSearch(eng, e, r, 'lost'); else setState(e, S.ROAMING); return; } }
  const d = dist(e.x, e.y, C.last.x, C.last.y), away = Math.atan2(e.y - C.last.y, e.x - C.last.x);
  let tx, ty, v = 0;
  if (d < 470) { tx = e.x + Math.cos(away) * 90; ty = e.y + Math.sin(away) * 90; v = 110; }                                   // too close: back off
  else if (d > 680) { tx = e.x - Math.cos(away) * 90; ty = e.y - Math.sin(away) * 90; v = 96; }                                // drifted away: close up
  else { const a = away + C.dir * .5; tx = C.last.x + Math.cos(a) * d; ty = C.last.y + Math.sin(a) * d; v = 66; }             // circle at a distance
  if (eng.geo.clear(tx, ty, 21, 'walk') && eng.geo.lineClear(e.x, e.y, tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, v, dt, { turnMul: 1.4, noSlow: true }); else { stopMoving(eng, e, dt); if (eng.rng() < dt * .6) C.dir = -C.dir; }
  if (seen.length) faceToward(e, C.last.x, C.last.y, dt, 2.2);
  e.head = Math.sin(e.t * 1.9) * .3;
}
function hRetreat(eng, e, dt) {
  const R = e.retreat; if (!R || eng.now > R.until || dist(e.x, e.y, R.goal.x, R.goal.y) < 70) { setState(e, S.ROAMING); e.roam.goal = null; return; }
  goTo(eng, e, R.goal.x, R.goal.y, { every: 1.2 }); follow(eng, e, dt, hSpeed(e, 'retreat', eng), {}); e.head = Math.sin(e.t * 6) * .3;
}
function beginRetreat(eng, e, awayFrom, secs) {
  let goal = null;
  for (let i = 0; i < 16 && !goal; i++) { const g = randomFloor(eng, e, 900, 1700); if (g && dist(g.x, g.y, awayFrom.x, awayFrom.y) > dist(e.x, e.y, awayFrom.x, awayFrom.y) + 300) goal = g; }
  setState(e, S.RETREATING, ''); e.retreat = { goal: goal || randomFloor(eng, e, 800, 1500) || { x: e.x, y: e.y }, until: eng.now + secs };
}

/* PLAYING (rare for a hound): hover around a downed victim ------------------------------------------------------------------- */
function hPlay(eng, e, dt) {                                             // (the capture loop moves it while a victim is held)
  if (!e.cap) setState(e, S.ROAMING);
}
function hPlayTick(eng, e, cap, pv, dt) {
  if (!pv) return;
  const P = cap.plan;
  if (!P || eng.now > P.until) {
    const act = pickW(eng.rng, [{ k: 'circle', w: 1.2 }, { k: 'stare', w: 1 + e.tr.SADISM }, { k: 'drag', w: cap.phase === 'crawl' ? .5 : 0 }, { k: 'back', w: .7 }]);
    cap.plan = { act, until: eng.now + rand(eng, 1.3, 3.2), dir: eng.rng() < .5 ? 1 : -1, r: rand(eng, 95, 135) }; cap.plays++; setAct(e, act === 'back' ? 'back' : act === 'drag' ? 'drag' : act);
  }
  const p = cap.plan;
  cap.drag = null;
  if (p.act === 'circle') {
    const a = Math.atan2(e.y - pv.y, e.x - pv.x) + p.dir * dt * (120 / p.r), tx = pv.x + Math.cos(a) * p.r, ty = pv.y + Math.sin(a) * p.r;
    steerTo(eng, e, tx, ty, 130, dt, { turnMul: 2, noSlow: true }); faceToward(e, pv.x, pv.y, dt, 3);
  } else if (p.act === 'back') {
    const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 80, ty = e.y + Math.sin(away) * 80;
    if (eng.geo.clear(tx, ty, 21, 'walk') && dist(e.x, e.y, pv.x, pv.y) < 330) { e.moved = moveCollide(eng, e, Math.cos(away) * 90 * dt, Math.sin(away) * 90 * dt); e.speed = 90; } else stopMoving(eng, e, dt);
    faceToward(e, pv.x, pv.y, dt, 3);
  } else if (p.act === 'drag') {
    const away = Math.atan2(e.y - pv.y, e.x - pv.x); const step = 70 * dt, nx = Math.cos(away) * step, ny = Math.sin(away) * step;
    if (eng.geo.clear(e.x + nx * 5, e.y + ny * 5, 21, 'walk')) { e.moved = moveCollide(eng, e, nx, ny); e.speed = 70; } else stopMoving(eng, e, dt);
    turnTo(e, away + Math.PI, 6, dt); cap.drag = { x: e.x - Math.cos(away) * 46, y: e.y - Math.sin(away) * 46 };
  } else { stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 3); e.head = Math.sin(e.t * 4) * .3; }
}

/* how a hound captures ---------------------------------------------------------------------------------------------------- */
HOUND.capture = {
  quick(e, ctx) {
    let q = .74 + e.tr.AGGRESSION * .12 + e.tr.HUNGER * .08 - e.tr.SADISM * .55 * ctx.iso;
    if (ctx.danger > .3) q += .22; if (ctx.approaching) q = Math.max(q, .96);
    return clamp(q, .5, .98);
  },
  variants(eng, e, pv, ctx, attack) {
    const exhausted = pv.stamina < 22 || pv.ex, wall = ctx.wall;                       // the wall behind the victim along the attack line (computed once, at the kill)
    return [
      { k: 'A', w: 1.0 * (ctx.facing ? 1.5 : .55) },                          // lunge at the throat: it comes at you head-on
      { k: 'B', w: .95 * (ctx.behind ? 1.25 : 1) * (pv.st === 2 ? 1.25 : 1) },  // dragged down from the side / behind as you run
      { k: 'C', w: wall ? 1.7 : 0 },                                           // slammed into a wall: only where a wall really is
      { k: 'D', w: exhausted ? 3.2 * (ctx.behind ? 1.3 : .6) : 0 },            // you had nothing left
    ];
  },
  onBegin(eng, e, cap, pv) { setState(e, S.PLAYING, 'circle'); },
  playTick(eng, e, cap, pv, dt) { hPlayTick(eng, e, cap, pv, dt); },
  decide(eng, e, cap, pv) {
    const r = eng.rng(), pk = .5 + e.tr.HUNGER * .3 + e.mood.frustration * .2, pr = .24 * (e.tr.SADISM + .35) * (cap.plays > 2 ? 1 : .4);
    return r < pk ? 'kill' : r < pk + pr ? 'release' : 'continue';
  },
  onInterrupt(eng, e, cap, pv, ctx, x) {
    const r = eng.rng();
    if (ctx.danger > 1.1 && e.tr.CAUTION > .35 && r < e.tr.CAUTION * .7) return 'release';
    if (r < .55 + e.tr.AGGRESSION * .4) return 'kill';
    return 'continue';
  },
  onRelease(eng, e, cap, pv) { setState(e, S.PLAYING, 'back'); },
  releaseTick(eng, e, cap, pv, dt) {                                        // false hope: it backs off and watches, head low
    const d = dist(e.x, e.y, pv.x, pv.y);
    if (d < 340) { const away = Math.atan2(e.y - pv.y, e.x - pv.x); e.moved = moveCollide(eng, e, Math.cos(away) * 80 * dt, Math.sin(away) * 80 * dt); e.speed = 80; setAct(e, 'back'); } else { stopMoving(eng, e, dt); setAct(e, 'stare'); }
    faceToward(e, pv.x, pv.y, dt, 3);
  },
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; setState(e, S.HUNTING, ''); e.target = pv.id; e.chaseBlind = 0; e.cool.lunge = .3; e.dbg.resumed = (e.dbg.resumed || 0) + 1; houndGrowl(eng, e, .8); },
  onLetGo(eng, e, cap, pv) { setState(e, S.RETREATING, ''); beginRetreat(eng, e, { x: pv.x, y: pv.y }, rand(eng, 8, 16)); },
  afterKill(eng, e, ctx, pv) {
    const th = ctx.threats.filter(t => t.cert >= .5), near = th.filter(t => t.approaching || t.dist < 600);
    e.mood.excitement = 1; houndGrowl(eng, e, .9, 'kill');
    const site = eng.sites[eng.sites.length - 1];
    if (near.length >= 2 && e.tr.CAUTION + (1 - e.tr.AGGRESSION) > .55) { beginRetreat(eng, e, { x: near[0].x, y: near[0].y }, rand(eng, 6, 12)); return; }       // overwhelmed
    if (near.length) {                                                                                      // attack the next one, or defend the kill
      const t = near.slice().sort((a, b) => a.dist - b.dist)[0], r = rec(e, t.id); r.aw = 1; r.lkx = t.x; r.lky = t.y; r.conf = 1; r.seenAt = eng.now;
      if (e.tr.AGGRESSION > .55) { beginHunt(eng, e, r, 'next-victim'); return; }
      beginFeed(eng, e, site); e.feed.guard = t.id; e.target = t.id; setAct(e, 'guard'); return;
    }
    if (e.tr.HUNGER > .35) { if (eng.rng() < .8) beginExcited(eng, e, site); else beginFeed(eng, e, site); } else { setState(e, S.STALKING, ''); const r = pickTarget(eng, e); if (r) { e.target = r.id; e.stalkFor = 0; } else setState(e, S.ROAMING); }
  },
};
HOUND.tick = houndTick;
HOUND.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: HACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2), l: e.lunge ? +clamp((e.lunge.t - e.lunge.wind) / e.lunge.dur, -1, 1).toFixed(2) : -1, tg: e.target > 0 && (e.state === S.HUNTING || e.state === S.STALKING) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, k: e.pack || 0 });
