
/* ---------------------------------------------------------------- entities: personality, movement, traversal, state plumbing */
function personality(sp, rng) {
  const tr = {};
  for (const k of TRAITS) tr[k] = clamp((sp.traits[k] ?? .5) + (rng() * 2 - 1) * (sp.jitter ?? .12), .02, .98);   // same species, different individuals
  return tr;
}
function mkEntity(eng, kind, id, x, y, opts = {}) {
  const sp = SPECIES[kind], tr = personality(sp, eng.rng);
  const e = {
    id, kind, sp, tr, caps: Object.assign({}, sp.caps, opts.caps || {}),
    x, y, ang: eng.rng() * TAU, head: 0, speed: 0, r: sp.radius, rc: sp.clearance || OL,
    state: sp.initial || S.ROAMING, act: '', stateT: 0, actT: 0, t: 0,
    goal: null, path: [], pathAge: 99, goalKey: '', trav: null, mode: 'walk', aim: null, aimT: 0,
    mem: newMemory(), seenNow: new Set(), hear: null, heardCount: 0, deaf: 0,
    mood: { arousal: .1, frustration: 0, excitement: 0, boredom: 0 },
    tier: 'near', thinkT: eng.rng() * .1, target: null, stuck: 0, home: { x, y }, spawn: { x, y },
    cap: null, cool: {}, dbg: {}, fade: 1, vis: 1, pack: null,
    vel: { x: 0, y: 0 }, moved: 0, wake: 0, alpha: 1,
  };
  if (sp.init) sp.init(eng, e, opts);
  return e;
}
function setState(e, st, act = '') {
  if (e.state !== st) { e.prevState = e.state; e.state = st; e.stateT = 0; e.stateChanges = (e.stateChanges || 0) + 1; }
  if (e.act !== act) { e.act = act; e.actT = 0; }
}
function setAct(e, act) { if (e.act !== act) { e.act = act; e.actT = 0; } }

const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
function moveCollide(eng, e, dx, dy) {
  const geo = eng.geo, r = e.rc, ox = e.x, oy = e.y, mode = e.trav ? 'walk' : e.mode;
  if (e.trav) { e.x += dx; e.y += dy; return Math.hypot(dx, dy); }
  for (const ax of [0, 1]) {
    if (ax === 0) e.x += dx; else e.y += dy;
    for (const t of geo.blockers(e.x, e.y, mode)) {
      const nx = Math.max(t.x, Math.min(e.x, t.x + t.w)), ny = Math.max(t.y, Math.min(e.y, t.y + t.h)), ddx = e.x - nx, ddy = e.y - ny, d = Math.hypot(ddx, ddy);
      if (d < r) { if (d > 0) { e.x += ddx / d * (r - d); e.y += ddy / d * (r - d); } else { if (ax === 0) e.x = ox; else e.y = oy; } }
    }
  }
  return Math.hypot(e.x - ox, e.y - oy);
}
/* which prop mode this entity moves in right now (crawling under things / through holes only along a path that asks for it) */
function modeFor(e) {
  let m = 'walk';
  const c0 = e.cellCls | 0;
  let mx = c0;
  for (let i = 0; i < Math.min(2, e.path.length); i++) mx = Math.max(mx, e.path[i].c | 0);
  if (mx === 3 && e.caps.CAN_USE_TIGHT_GAPS) m = 'crawl';
  else if (mx >= 2 && e.caps.CAN_CRAWL) m = mx === 3 && e.caps.CAN_USE_TIGHT_GAPS ? 'crawl' : 'under';
  return m;
}

function plan(eng, e, gx, gy, opts = {}) {
  const key = Math.round(gx / 48) + ',' + Math.round(gy / 48);
  const cost = opts.cost || e.sp.pathCost && e.sp.pathCost(eng, e);
  const p = eng.geo.path(e.x, e.y, gx, gy, e.caps, { cost, maxNodes: opts.maxNodes });
  e.goal = { x: gx, y: gy }; e.goalKey = key; e.pathAge = 0; e.aim = null;
  if (!p) { e.path = []; e.unreachable = eng.now; return false; }
  e.path = p; e.unreachable = 0; return true;
}
/* set a destination.  re-plans if the goal moved, the path is old, or we have none */
function goTo(eng, e, gx, gy, opts = {}) {
  const key = Math.round(gx / 48) + ',' + Math.round(gy / 48);
  const stale = e.pathAge > (opts.every ?? 1.1);
  if (key !== e.goalKey || (stale && !e.trav) || (!e.path.length && !e.trav && e.pathAge > .3)) return plan(eng, e, gx, gy, opts);
  return true;
}
function beginTrav(eng, e, l) {
  const dur = clamp(.5 / Math.max(.3, e.caps.VAULT_SPEED || 1), .25, 1.4);
  e.trav = { ax: e.x, ay: e.y, bx: l.bx, by: l.by, t: 0, dur, prop: l.prop, dir: Math.atan2(l.by - e.y, l.bx - e.x) }; e.travCount = (e.travCount || 0) + 1;
}
function stepTrav(eng, e, dt) {
  const v = e.trav; v.t += dt; turnTo(e, v.dir, 9, dt); const k = clamp(v.t / v.dur, 0, 1), s = k * k * (3 - 2 * k);
  const px = e.x, py = e.y; e.x = v.ax + (v.bx - v.ax) * s; e.y = v.ay + (v.by - v.ay) * s;
  e.speed = Math.hypot(e.x - px, e.y - py) / dt; e.moved = e.speed * dt;
  if (k >= 1) { e.trav = null; e.speed = Math.min(e.speed, 220); e.path.shift(); e.pathAge = 0; }
}
function steerTo(eng, e, tx, ty, vmax, dt, o = {}) {
  const want = Math.atan2(ty - e.y, tx - e.x), err = angDiff(want, e.ang), sp = e.sp;
  const ratio = clamp(e.speed / (sp.vTop || 300), 0, 1);
  const turn = e.caps.TURNING_ABILITY * (o.turnMul || 1) * (1 - (sp.turnPenalty || .55) * ratio) * (e.mood.frustration > .6 ? 1.12 : 1);
  e.ang = (e.ang + clamp(err, -turn * dt, turn * dt) + TAU) % TAU;
  const align = Math.cos(Math.min(Math.abs(err), 1.5));
  const target = o.hold ? 0 : vmax * (o.noSlow ? 1 : clamp(align, .1, 1));
  const acc = (e.caps.ACCELERATION || 500) * (o.accMul || 1);
  e.speed = approach(e.speed, target, (target > e.speed ? acc : acc * 2.2) * dt);
  const step = e.speed * dt;
  e.moved = moveCollide(eng, e, Math.cos(e.ang) * step, Math.sin(e.ang) * step);
  if (step > 1 && e.moved < step * .3) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt * 1.5);
}
/* walk the planned path; returns 'arrived' | 'moving' | 'nopath' */
function follow(eng, e, dt, vmax, o = {}) {
  const geo = eng.geo;
  e.cellCls = geo.cls[geo.cellAt(e.x, e.y)] | 0;
  e.mode = modeFor(e);
  if (e.trav) { stepTrav(eng, e, dt); return 'moving'; }
  const arrive = o.arrive ?? 18;
  while (e.path.length) {
    const wp = e.path[0], last = e.path.length === 1, d = Math.hypot(wp.x - e.x, wp.y - e.y);
    if (d < (last ? arrive : 22) && !wp.link) { e.path.shift(); continue; }
    if (wp.link) {                                    // a vault: walk to its start, then go over
      const L = wp.link;
      if (Math.hypot(L.ax - e.x, L.ay - e.y) < 28) { beginTrav(eng, e, L); return 'moving'; }
      break;
    }
    break;
  }
  const wp = e.path[0];
  if (!wp) { e.speed = approach(e.speed, 0, (e.caps.ACCELERATION || 500) * 2.2 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); return e.goal && Math.hypot(e.goal.x - e.x, e.goal.y - e.y) > (o.arrive ?? 18) + 30 ? 'nopath' : 'arrived'; }
  let tx = wp.x, ty = wp.y;
  if (wp.link) { tx = wp.link.ax; ty = wp.link.ay; }
  else {                                              // cut corners where the way is clear
    e.aimT -= dt;
    if (e.aimT <= 0 || !e.aim) {
      e.aimT = .14; e.aim = null;
      for (let i = Math.min(e.path.length - 1, 5); i > 0; i--) {
        let bad = false; for (let k = 0; k <= i; k++) if (e.path[k].link) { bad = true; break; }
        if (bad) continue;
        if (geo.lineClear(e.x, e.y, e.path[i].x, e.path[i].y, e.rc, e.mode)) { e.aim = e.path[i]; break; }
      }
    }
    if (e.aim && e.path.includes(e.aim)) { tx = e.aim.x; ty = e.aim.y; }
  }
  steerTo(eng, e, tx, ty, vmax, dt, o);
  if (e.stuck > .9) { e.stuck = 0; e.pathAge = 99; e.aim = null; if (e.goal) plan(eng, e, e.goal.x, e.goal.y); e.nudge = (e.nudge || 0) + 1; if (e.nudge > 3) { e.nudge = 0; e.path = []; } }
  return 'moving';
}
function stopMoving(eng, e, dt) {
  e.speed = approach(e.speed, 0, (e.caps.ACCELERATION || 500) * 2.4 * dt);
  if (e.speed > 1) e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); else e.moved = 0;
}
function turnTo(e, dir, rate, dt) { e.ang = (e.ang + clamp(angDiff(dir, e.ang), -rate * dt, rate * dt) + TAU) % TAU; }
function faceToward(e, tx, ty, dt, rate = 4) {
  const err = angDiff(Math.atan2(ty - e.y, tx - e.x), e.ang);
  e.ang = (e.ang + clamp(err, -rate * dt, rate * dt) + TAU) % TAU;
  return Math.abs(err);
}
function moodTick(e, dt) {
  const m = e.mood;
  m.arousal = Math.max(0, m.arousal - dt * .12); m.excitement = Math.max(0, m.excitement - dt * .1); m.frustration = Math.max(0, m.frustration - dt * (.03 + .03 * (1 - e.tr.AGGRESSION)));
  if (e.state === S.ROAMING || e.state === S.HIDDEN || e.state === S.DORMANT) m.boredom = Math.min(1, m.boredom + dt * .01); else m.boredom = Math.max(0, m.boredom - dt * .1);
}
function tierOf(e, eng) {
  if (e.cap || e.commit) return 'near';                                  // a capture or a kill still playing out is always fully simulated (it has a clock to finish)
  const near = eng.nearestPlayerDist(e.x, e.y);
  return near < 1900 ? 'near' : near < 3800 ? 'mid' : 'far';
}
/* far-away entities do not run perception or steering: they drift along cached routes on a slow clock */
function coarseMove(eng, e, dt) {
  if (!e.path.length) { e.speed = 0; return false; }
  let left = (e.sp.roamSpeed || 90) * dt, moved = 0;
  while (left > 0 && e.path.length) {
    const wp = e.path[0], d = Math.hypot(wp.x - e.x, wp.y - e.y);
    if (d <= left) { e.x = wp.x; e.y = wp.y; left -= d; moved += d; e.path.shift(); }
    else { e.ang = Math.atan2(wp.y - e.y, wp.x - e.x); e.x += Math.cos(e.ang) * left; e.y += Math.sin(e.ang) * left; moved += left; left = 0; }
  }
  e.speed = moved / dt; return true;
}
function randomFloor(eng, e, minD, maxD, tries = 40) {
  const geo = eng.geo;
  for (let i = 0; i < tries; i++) {
    const a = eng.rng() * TAU, d = lerp(minD, maxD, eng.rng()), x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
    if (x < 100 || y < 100 || x > geo.W - 100 || y > geo.H - 100) continue;
    const c = geo.cellAt(x, y); if (c < 0 || geo.cls[c] !== 1) continue;
    return { x: geo.cx(c), y: geo.cy(c) };
  }
  return null;
}
