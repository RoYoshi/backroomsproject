
/* ---------------------------------------------------------------- entities: personality, movement, traversal, state plumbing */
function personality(sp, rng) {
  const tr = {};
  for (const k of TRAITS) tr[k] = clamp((sp.traits[k] ?? .5) + (rng() * 2 - 1) * (sp.jitter ?? .12), .02, .98);   // same species, different individuals
  return tr;
}
function mkEntity(eng, kind, id, x, y, opts = {}) {
  const sp = SPECIES[kind], streams = entityStreams(eng.seed, kind, id), tr = personality(sp, streams.personality);
  const e = {
    id, kind, sp, tr, streams, rng: streams.behavior, rngKey: `${eng.seed}/${kind}/${id}`, caps: Object.assign({}, sp.caps, opts.caps || {}),
    x, y, ang: streams.behavior() * TAU, head: 0, speed: 0, r: sp.radius, rc: sp.clearance || OL,
    state: sp.initial || S.ROAMING, act: '', stateT: 0, actT: 0, t: 0,
    goal: null, path: [], pathAge: 99, goalKey: '', trav: null, mode: 'walk', aim: null, aimT: 0,
    mem: newMemory(), seenNow: new Set(), hear: null, heardCount: 0, deaf: 0,
    mood: { arousal: .1, frustration: 0, excitement: 0, boredom: 0 },
    tier: 'near', thinkT: streams.schedule() * .1, target: null, stuck: 0, home: { x, y }, spawn: { x, y },
    cap: null, cool: {}, dbg: {}, fade: 1, vis: 1, pack: null,
    vel: { x: 0, y: 0 }, moved: 0, wake: 0, alpha: 1,
  };
  if(eng.geo.spatial)initializeSpatialEntity(eng,e,opts);
  if (sp.init) sp.init(eng.geo.spatial?eng.entityContext(e):eng, e, opts);
  return e;
}
function setState(e, st, act = '') {
  if (e.state !== st) { e.prevState = e.state; e.state = st; e.stateT = 0; e.stateChanges = (e.stateChanges || 0) + 1; }
  if (e.act !== act) { e.act = act; e.actT = 0; }
}
function setAct(e, act) { if (e.act !== act) { e.act = act; e.actT = 0; } }

const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
/* navigation record (debug + tests): counters and the last few repath reasons. Cheap: a few numbers per entity. */
function navOf(e) { return e.nav || (e.nav = { plans: 0, why: [], contacts: 0, bonks: 0, stuckN: 0, recover: 0, emergency: 0, direct: 0, last: '' }); }
function navWhy(e, why, now) { const n = navOf(e); n.plans++; n.last = why; n.why.push([+now.toFixed(2), why]); if (n.why.length > 12) n.why.shift(); }
function moveCollide(eng, e, dx, dy) {
  if(eng.geo.spatial)return spatialMove(eng,e,dx,dy);
  const L = Math.hypot(dx, dy);
  if (L > 10 && !e.trav) {                                                 // swept: a fast move (lunge, skid) is taken in short steps so nothing thin is ever jumped
    const n = Math.ceil(L / 10); let mv = 0;
    for (let k = 0; k < n; k++) { const m = moveStep(eng, e, dx / n, dy / n); mv += m; if (m < L / n * .2) break; }
    return mv;
  }
  return moveStep(eng, e, dx, dy);
}
function moveStep(eng, e, dx, dy) {
  const geo = eng.geo, r = e.rc, ox = e.x, oy = e.y, mode = e.trav ? 'walk' : e.mode; let hit = false;
  if (e.trav) { e.x += dx; e.y += dy; return Math.hypot(dx, dy); }
  for (const ax of [0, 1]) {
    if (ax === 0) e.x += dx; else e.y += dy;
    for (const t of geo.blockers(e.x, e.y, mode)) {
      const nx = Math.max(t.x, Math.min(e.x, t.x + t.w)), ny = Math.max(t.y, Math.min(e.y, t.y + t.h)), ddx = e.x - nx, ddy = e.y - ny, d = Math.hypot(ddx, ddy);
      if (d < r) { hit = true; if (d > 0) { e.x += ddx / d * (r - d); e.y += ddy / d * (r - d); } else { if (ax === 0) e.x = ox; else e.y = oy; } }
    }
  }
  const mv = Math.hypot(e.x - ox, e.y - oy);
  if (hit) { const n = navOf(e); n.contacts++; if (e.speed > 150 && mv < Math.hypot(dx, dy) * .5) n.bonks++; }
  return mv;
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

/* ROUTE --------------------------------------------------------------------------------------------------------------------------------
 * A* over the 48 px grid (Geo.path), then string-pulled: from where the entity stands, each leg goes to the farthest waypoint that can be reached in a
 * straight line with NAV_MARGIN px to spare beyond the collision radius.  Vault links and crawl / tight-gap cells are never smoothed across. */
const NAV_MARGIN = 7;
function smoothPath(geo, e, p) {
  if (!p || p.length < 2) return p;
  const r = e.rc + NAV_MARGIN, out = []; let ax = e.x, ay = e.y, i = 0;
  const plain = k => !p[k].link && (p[k].c | 0) <= 1;
  while (i < p.length) {
    if (!plain(i)) { out.push(p[i]); ax = p[i].x; ay = p[i].y; i++; continue; }
    let j = i;
    for (const rr of [r, e.rc + 3, e.rc + .5]) {                            // as much room as the place allows: a narrow hall still gets straight legs
      let miss = 0;
      for (let k = i + 1; k < p.length && k - i <= 30; k++) {
        if (!plain(k)) break;
        if (geo.lineClear(ax, ay, p[k].x, p[k].y, rr, 'walk')) { j = k; miss = 0; } else if (++miss >= 3) break;
      }
      if (j > i + 1 || j === p.length - 1) break;
    }
    out.push(p[j]); ax = p[j].x; ay = p[j].y; i = j + 1;
  }
  // bends get room: a bend waypoint on a grid cell tight against a wall end is eased (up to 24 px) toward the side with more room, as long as both
  // legs stay clear - so the body rounds the corner instead of clipping it
  const want = e.rc + NAV_MARGIN + 6;
  for (let k = 0; k < out.length - 1; k++) {
    const w = out[k]; if (w.link || (w.c | 0) > 1 || geo.clear(w.x, w.y, want, 'walk')) continue;
    const pv = k ? out[k - 1] : e, nx = out[k + 1]; if (nx.link) continue;
    let best = null, bs = -1;
    for (let q = 0; q < 8; q++) for (const d of [12, 24]) {
      const x = w.x + Math.cos(q * Math.PI / 4) * d, y = w.y + Math.sin(q * Math.PI / 4) * d, room = geo.clear(x, y, want, 'walk') ? 2 : geo.clear(x, y, e.rc + NAV_MARGIN, 'walk') ? 1 : 0;
      if (room > bs && room > 0 && geo.lineClear(pv.x, pv.y, x, y, e.rc + .5, 'walk') && geo.lineClear(x, y, nx.x, nx.y, e.rc + .5, 'walk')) { bs = room; best = { x, y }; if (room === 2 && d === 12) break; }
    }
    if (best) out[k] = Object.assign({}, w, best);
  }
  return out;
}
function plan(eng, e, gx, gy, opts = {}) {
  if(eng.geo.spatial)return spatialPlan(eng,e,gx,gy,opts);
  const key = Math.round(gx / 48) + ',' + Math.round(gy / 48);
  let cost = opts.cost || e.sp.pathCost && e.sp.pathCost(eng, e);
  if (opts.avoid) { const A = opts.avoid, base = cost, geo = eng.geo; cost = j => { const d = Math.hypot(geo.cx(j) - A.x, geo.cy(j) - A.y); return (d < A.r ? 600 : 0) + (base ? base(j) : 0); }; }   // an alternate route: keep off the spot we got stuck at
  navWhy(e, opts.why || 'plan', eng.now); eng.stats.paths = (eng.stats.paths || 0) + 1;
  const p = eng.geo.path(e.x, e.y, gx, gy, e.caps, { cost, maxNodes: opts.maxNodes });
  e.goal = { x: gx, y: gy }; e.goalKey = key; e.pathAge = 0; e.aim = null; e.carrot = null; e.ext = 0;
  if (!p) { e.path = []; e.unreachable = eng.now; return false; }
  e.path = smoothPath(eng.geo, e, p); e.unreachable = 0; return true;
}
/* go straight at a point (the caller has checked the line is walkable) */
function directTo(eng, e, gx, gy, pose) { if(eng.geo.spatial)return spatialDirectTo(eng,e,gx,gy,pose); if (e.goalKey !== 'direct') { navOf(e).direct++; navWhy(e, 'direct', eng.now); navOf(e).plans--; } e.path = [{ x: gx, y: gy }]; e.goal = { x: gx, y: gy }; e.goalKey = 'direct'; e.pathAge = 0; }
/* is a straight run at (tx,ty) safe?  with hysteresis: once running straight it stays straight while the body itself fits; to switch into it the line
 * needs the full margin (so DIRECT -> ROUTE -> DIRECT does not flicker at the edge of a doorframe) */
function directOk(eng, e, tx, ty, maxD = 700, pose) {
  if(eng.geo.spatial)return spatialDirectOk(eng,e,tx,ty,maxD,pose);
  if (Math.hypot(tx - e.x, ty - e.y) > maxD) return false;
  return eng.geo.lineClear(e.x, e.y, tx, ty, e.rc + (e.goalKey === 'direct' ? 1 : NAV_MARGIN), 'walk');
}
/* set a destination.  Route commitment: a moving goal only costs a new route when it moved meaningfully (more than ~12 % of the way, 40 px minimum)
 * or when the last leg can no longer reach it; small moves just slide the end of the route along.  Every new route records why (debug overlay). */
function goTo(eng, e, gx, gy, opts = {}) {
  if(eng.geo.spatial)return spatialGoTo(eng,e,gx,gy,opts);
  if (e.trav) return true;
  const G = e.goal, far = Math.hypot(gx - e.x, gy - e.y);
  if (!G || e.goalKey === 'direct') return plan(eng, e, gx, gy, Object.assign({}, opts, { why: G ? 'from-direct' : 'new-goal' }));
  if (!e.path.length) { if (e.pathAge > .3) return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'no-path' })); return true; }
  const moved = Math.hypot(gx - G.x, gy - G.y);
  if (moved > Math.max(40, far * .12)) return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'goal-moved' }));
  if (moved > 3) {
    const n = e.path.length, last = e.path[n - 1], prev = n > 1 ? e.path[n - 2] : e;
    if (!last.link && eng.geo.lineClear(prev.x, prev.y, gx, gy, e.rc, 'walk')) { last.x = gx; last.y = gy; G.x = gx; G.y = gy; }
    else if (!last.link && (e.ext || 0) < 3 && eng.geo.lineClear(last.x, last.y, gx, gy, e.rc, 'walk')) { e.path.push({ x: gx, y: gy }); G.x = gx; G.y = gy; e.ext = (e.ext || 0) + 1; }   // it slipped round a corner a little: extend the route by one leg
    else return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'goal-behind-corner' }));
  }
  if (e.pathAge > Math.max(3, (opts.every ?? 1.1) * 4)) return plan(eng, e, gx, gy, Object.assign({}, opts, { why: 'refresh' }));     // a slow safety refresh only
  return true;
}
function beginTrav(eng, e, l) {
  if(eng.geo.spatial)return spatialBeginTrav(eng,e,l);
  const dur = clamp(.5 / Math.max(.3, e.caps.VAULT_SPEED || 1), .25, 1.4);
  e.trav = { ax: e.x, ay: e.y, bx: l.bx, by: l.by, t: 0, dur, prop: l.prop, dir: Math.atan2(l.by - e.y, l.bx - e.x) }; e.travCount = (e.travCount || 0) + 1;
}
function stepTrav(eng, e, dt) {
  if(eng.geo.spatial)return spatialStepTrav(eng,e,dt);
  const v = e.trav; v.t += dt; turnTo(e, v.dir, 9, dt); const k = clamp(v.t / v.dur, 0, 1), s = k * k * (3 - 2 * k);
  const px = e.x, py = e.y; e.x = v.ax + (v.bx - v.ax) * s; e.y = v.ay + (v.by - v.ay) * s;
  e.speed = Math.hypot(e.x - px, e.y - py) / dt; e.moved = e.speed * dt;
  if (k >= 1) { e.trav = null; e.speed = Math.min(e.speed, 220); e.path.shift(); e.pathAge = 0; }
}
/* LOCOMOTION ---------------------------------------------------------------------------------------------------------------------------
 * The body moves along its heading; the heading turns toward the wanted direction at the species' rate, which falls with speed (a hound at full chase
 * turns slowly: that is its character).  vcap: an upper speed the steering layer asks for (corner braking). */
function steerTo(eng, e, tx, ty, vmax, dt, o = {}) {
  const want = Math.atan2(ty - e.y, tx - e.x), err = angDiff(want, e.ang), sp = e.sp;
  const ratio = clamp(e.speed / (sp.vTop || 300), 0, 1);
  const turn = e.caps.TURNING_ABILITY * (o.turnMul || 1) * (1 - (sp.turnPenalty || .55) * ratio) * (e.mood.frustration > .6 ? 1.12 : 1);
  e.ang = (e.ang + clamp(err, -turn * dt, turn * dt) + TAU) % TAU;
  const align = Math.cos(Math.min(Math.abs(err), 1.5));
  let target = o.hold ? 0 : vmax * (o.noSlow ? 1 : clamp(align, .1, 1));
  if (o.vcap !== undefined) target = Math.min(target, o.vcap);
  const acc = (e.caps.ACCELERATION || 500) * (o.accMul || 1);
  // feeler: what is straight ahead of the body (centre and both shoulders).  A wall inside the stopping distance brakes it - and a slower body turns
  // tighter - instead of the body driving on at 3/4 speed and scraping along the wall while its heading comes round.  (Not for a wanted wall stop.)
  if (e.speed > 30 && !o.noFeel) {
    const g = eng.geo, px = -Math.sin(e.ang) * e.rc * .85, py = Math.cos(e.ang) * e.rc * .85, reach = Math.min(160, e.rc + 16 + e.speed * e.speed / (2 * acc * 2.2));
    const free = Math.min(g.ray(e.x, e.y, e.ang, reach), g.ray(e.x + px, e.y + py, e.ang, reach), g.ray(e.x - px, e.y - py, e.ang, reach));
    if (free < reach - 1) { const room = free - e.rc - 6, vf = room > 4 ? Math.sqrt(2 * acc * 2.2 * room) + 28 : 0; /* nose to the wall: stop and turn on the spot, do not push on */ if (vf < target) { target = vf; navOf(e).feel = (navOf(e).feel || 0) + 1; } }
  }
  e.speed = approach(e.speed, target, (target > e.speed ? acc : acc * 2.2) * dt);
  const step = e.speed * dt;
  e.moved = moveCollide(eng, e, Math.cos(e.ang) * step, Math.sin(e.ang) * step);
  const intent = Math.max(step, (o.hold ? 0 : vmax) * dt * .5);                 // stuck = it wants to move and does not (measured against intent, not the speed it was braked to)
  if (intent > .5 && e.moved < intent * .3) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt * 1.5);
  e.vel.x = Math.cos(e.ang) * e.speed; e.vel.y = Math.sin(e.ang) * e.speed; e.want = want;
}
/* the fastest this species can take a bend of `theta` rad in about `R` px of room: from its own turn rate, which falls with speed */
function cornerSpeed(e, theta, R) {
  const sp = e.sp, T = e.caps.TURNING_ABILITY, pen = sp.turnPenalty || .55, top = sp.vTop || 300;
  const vR = R * T / (1 + R * T * pen / top);                            // the speed whose turning circle is R (solves v = R * T * (1 - pen * v / top))
  if (theta < .2) return 1e4;                                            // a gentle bend: no braking at all
  if (theta <= Math.PI / 2) return vR / Math.pow(Math.sin(theta), .8);   // 90 deg -> vR; 60 deg -> 1.12 vR; 30 deg -> 1.74 vR
  return vR * (1 - .35 * (theta - Math.PI / 2) / (Math.PI / 2));          // sharper than a right angle: slower still
}
/* LOCAL STEERING -----------------------------------------------------------------------------------------------------------------------
 * follow(): the route is followed through a "carrot" a short way ahead along it (farther at speed), pulled back until the straight line to it has room,
 * so bends are rounded instead of reached-stopped-turned.  Before a bend the entity brakes to the speed its turn rate allows (competence); it still
 * carries momentum and may run a little wide (character).  Returns 'arrived' | 'moving' | 'nopath'. */
function carrotOf(eng, e, look) {
  if(eng.geo.spatial)return spatialCarrot(eng,e,look);
  const geo = eng.geo; let px = e.x, py = e.y, left = look, cx = e.path[0].x, cy = e.path[0].y;
  for (let k = 0; k < e.path.length; k++) {
    const w = e.path[k]; if (w.link) { cx = w.link.ax; cy = w.link.ay; break; }
    const d = Math.hypot(w.x - px, w.y - py);
    if (d >= left) { cx = px + (w.x - px) * left / d; cy = py + (w.y - py) * left / d; break; }
    left -= d; px = w.x; py = w.y; cx = w.x; cy = w.y;
  }
  let ok = geo.lineClear(e.x, e.y, cx, cy, e.rc + .5, e.mode);
  for (let t = 0; t < 3 && !ok; t++) { cx = (cx + e.path[0].x) / 2; cy = (cy + e.path[0].y) / 2; ok = geo.lineClear(e.x, e.y, cx, cy, e.rc + .5, e.mode); }   // never aim through a corner
  return { x: cx, y: cy, ok };
}
function follow(eng, e, dt, vmax, o = {}) {
  const geo = eng.geo;
  e.cellCls = geo.cls[geo.cellAt(e.x, e.y)] | 0;
  e.mode = geo.spatial&&e.trav?.link.kind==='crawl'?'crawl':modeFor(e);
  if(geo.spatial){const shape=actorShape(e,e.mode);if(geo.geometry.clearance(shape,e).fits)e.shape=shape;e.traverseSpeed=vmax;}
  if (e.trav) { stepTrav(eng, e, dt); return 'moving'; }
  const arrive = o.arrive ?? 18;
  while (e.path.length) {
    const wp = e.path[0], last = e.path.length === 1, d = geo.spatial?Math.hypot(wp.x-e.x,wp.y-e.y,wp.z-e.z):Math.hypot(wp.x - e.x, wp.y - e.y);
    if (wp.link) { const L = wp.link; if (Math.hypot(L.ax - e.x, L.ay - e.y) < (geo.spatial?3.5:28)) { beginTrav(eng, e, L); return 'moving'; } break; }
    if (d < (geo.spatial&&e.path[1]?.link?3.5:last?arrive:26) && (!geo.spatial||wp.navSurfaceId===e.navSurfaceId)) { e.path.shift(); continue; }
    // passed it already (the next leg is now straight from here): drop it rather than turning back for it
    if (!last && (!geo.spatial||wp.navSurfaceId===e.navSurfaceId) && !e.path[1].link && (e.path[1].c | 0) <= 1 && d < 110 && geo.lineClear(e.x, e.y, e.path[1].x, e.path[1].y, e.rc + 2, e.mode)) { e.path.shift(); continue; }
    break;
  }
  const wp = e.path[0];
  if (!wp) { e.speed = approach(e.speed, 0, (e.caps.ACCELERATION || 500) * 2.2 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); e.carrot = null; return e.goal && (geo.spatial?Math.hypot(e.goal.x-e.x,e.goal.y-e.y,e.goal.z-e.z):Math.hypot(e.goal.x - e.x, e.goal.y - e.y)) > (o.arrive ?? 18) + 30 ? 'nopath' : 'arrived'; }
  // the carrot
  let tx, ty;
  if (e.unst && eng.now < e.unst.until) { tx = e.x + Math.cos(e.unst.dir) * 60; ty = e.y + Math.sin(e.unst.dir) * 60; }       // stuck recovery, step 1: a short side-step
  else if (wp.link) { e.unst = null; tx = wp.link.ax; ty = wp.link.ay; }
  else {
    e.unst = null; const c = carrotOf(eng, e, clamp(e.speed * .42, 64, 150)); tx = c.x; ty = c.y;
    if (!c.ok) {
      // the straight line to the next point clips a corner (it came in at an angle, or was pushed off its leg): slide round it - the nearest heading on
      // either side of the wanted one that has a short clear run.  Only if there is none is the route itself no longer valid from here.
      const a0 = Math.atan2(ty - e.y, tx - e.x); let got = false;
      const pref = e.slideSide && eng.now - e.slideSide.t < .6 ? e.slideSide.s : 1;      // keep sliding round the same side for a moment (no left-right-left dithering)
      for (let k = 1; k <= 8 && !got; k++) for (const sgn of [pref, -pref]) {
        const a = a0 + sgn * k * .16, qx = e.x + Math.cos(a) * 44, qy = e.y + Math.sin(a) * 44;
        if (geo.lineClear(e.x, e.y, qx, qy, e.rc + .5, e.mode)) { tx = e.x + Math.cos(a) * 70; ty = e.y + Math.sin(a) * 70; got = true; e.slideSide = { s: sgn, t: eng.now }; navOf(e).slide = (navOf(e).slide || 0) + 1; break; }
      }
      if (!got && e.goal && e.goalKey !== 'direct' && eng.now - (e.legT || 0) > .5) { e.legT = eng.now; plan(eng, e, e.goal.x, e.goal.y, { why: 'off-route' }); if (e.path[0]) { const c2 = carrotOf(eng, e, 64); tx = c2.x; ty = c2.y; } }
    }
  }
  // the aim point is low-passed (~70 ms): when it flicks between "full look-ahead" and "pulled back at a door jamb" the heading does not dither
  if (e.carrot && !e.unst && Math.hypot(tx - e.carrot.x, ty - e.carrot.y) < 160) { const k = 1 - Math.exp(-dt * 14); tx = e.carrot.x + (tx - e.carrot.x) * k; ty = e.carrot.y + (ty - e.carrot.y) * k; }
  e.carrot = { x: tx, y: ty };
  // corner braking: the bend at the next waypoint, and the speed that bend allows
  let vcap;
  if(geo.spatial&&(wp.link||e.path[1]?.link)){const x=wp.link?wp.link.ax:wp.x,y=wp.link?wp.link.ay:wp.y;vcap=Math.min(vmax,Math.hypot(x-e.x,y-e.y)/dt);}
  if (e.path.length > 1 && !wp.link) {
    const n1 = e.path[1], nx = n1.link ? n1.link.ax : n1.x, ny = n1.link ? n1.link.ay : n1.y, a0 = Math.atan2(wp.y - e.y, wp.x - e.x), a1 = Math.atan2(ny - wp.y, nx - wp.x);
    const theta = Math.abs(angDiff(a1, a0)), dC = Math.hypot(wp.x - e.x, wp.y - e.y);
    const vC = cornerSpeed(e, theta, e.kind === 'hound' ? 115 : 80), dec = (e.caps.ACCELERATION || 500) * 2.2;
    vcap = Math.min(vcap??Infinity,Math.sqrt(vC * vC + 2 * dec * Math.max(0, dC - 40)));
  } else if (e.path.length === 1 && (o.arrive ?? 18) < 40) {                 // the last waypoint: arrive without ramming whatever is behind it
    const dL = Math.hypot(wp.x - e.x, wp.y - e.y), dec = (e.caps.ACCELERATION || 500) * 2.2;
    if (!geo.lineClear(wp.x, wp.y, wp.x + Math.cos(e.ang) * 60, wp.y + Math.sin(e.ang) * 60, e.rc, e.mode)) vcap = Math.sqrt(90 * 90 + 2 * dec * Math.max(0, dL - 20));
  }
  steerTo(eng, e, tx, ty, vmax, dt, Object.assign({}, o, { vcap }));
  // stuck recovery ladder: 1 side-step (at .35 s), 2 new route (.9 s), 3 an alternate route that keeps off this spot (2nd time), 4 drop the route (4th)
  if (e.stuck > .35 && !e.unst) {
    const want = e.want ?? e.ang; let best = null, bs = -1e9;
    for (let k = 0; k < 12; k++) { const a = want + (k - 6) / 12 * TAU, free = geo.ray(e.x, e.y, a, 90), sc = free - Math.abs(angDiff(a, want)) * 25; if (free > e.rc + 20 && sc > bs) { bs = sc; best = a; } }
    if (best !== null) { e.unst = { dir: best, until: eng.now + .45 }; navOf(e).recover++; }
  }
  if (e.stuck > .9) {
    const nv = navOf(e); nv.stuckN++; e.stuck = 0; e.pathAge = 99; e.aim = null; e.unst = null; e.nudge = (e.nudge || 0) + 1;
    if (e.goal) plan(eng, e, e.goal.x, e.goal.y, e.nudge >= 2 ? { why: 'stuck-alternate', avoid: { x: e.x, y: e.y, r: 70 } } : { why: 'stuck' });
    if (e.nudge > 3) { e.nudge = 0; e.path = []; }
  } else if (e.moved > 2 && e.nudge) e.nudgeOk = (e.nudgeOk || 0) + dt;
  if (e.nudgeOk > 3) { e.nudge = 0; e.nudgeOk = 0; }
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
  if(eng.geo.spatial){if(e.trav||e.step||e.motionMode!=='grounded'||e.cap||e.commit)return 'near';let latest=0;for(const r of e.mem.p.values())latest=Math.max(latest,r.seenAt,r.heardAt);for(const L of e.mem.leads)latest=Math.max(latest,L.t);const idle=eng.now-latest;return idle<10?'near':idle<30?'mid':'far';}
  if (e.cap || e.commit) return 'near';                                  // a capture or a kill still playing out is always fully simulated (it has a clock to finish)
  const near = eng.nearestPlayerDist(e.x, e.y);
  return near < 1900 ? 'near' : near < 3800 ? 'mid' : 'far';
}
/* far-away entities do not run perception or steering: they drift along cached routes on a slow clock */
function coarseMove(eng, e, dt) {
  if(eng.geo.spatial)return follow(eng,e,dt,e.sp.roamSpeed||90);
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
    const a = e.streams.search() * TAU, d = lerp(minD, maxD, e.streams.search()), x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
    if (x < 100 || y < 100 || x > geo.W - 100 || y > geo.H - 100) continue;
    const c = geo.cellAt(x, y); if (c < 0 || geo.cls[c] !== 1) continue;
    return geo.spatial?geo.nodePose(c):{ x: geo.cx(c), y: geo.cy(c) };
  }
  return null;
}
