
/* ---------------------------------------------------------------- capture and kill selection
 * CAUGHT is not DEAD.  When an attack lands the entity looks at the situation (who else is near, how secure the spot is,
 * what it is like) and either kills quickly or - if it is the playful kind, the victim is alone and nobody is coming - toys
 * with its prey: knocks it down, circles, stares, backs off, drags, lets it crawl, lets it go (false hope) and eventually
 * kills.  Interruptions (a light coming, a loud noise, another entity) change its mind, depending on its personality. */
const pickW = (rng, items) => { let t = 0; for (const it of items) t += Math.max(0, it.w); if (t <= 0) return items[0].k; let r = rng() * t; for (const it of items) { r -= Math.max(0, it.w); if (r <= 0) return it.k; } return items[items.length - 1].k; };

function openArcs(geo, x, y, R = 380, n = 24) {            // how many ways out are there from this spot?
  const open = [];
  for (let i = 0; i < n; i++) open.push(geo.ray(x, y, i / n * TAU, R) >= R - 6);
  let arcs = 0, count = open.filter(Boolean).length;
  for (let i = 0; i < n; i++) if (open[i] && !open[(i + n - 1) % n]) arcs++;
  return { arcs: count === n ? 1 : arcs, frac: count / n, open };
}
function wallBehind(geo, x, y, dirx, diry, maxD = 128) {   // a real wall right behind the victim along the attack direction
  const a = Math.atan2(diry, dirx), d = geo.ray(x, y, a, maxD + 40);
  if (d < 55 || d > maxD) return null;
  const side1 = geo.ray(x, y, a + .5, maxD + 40), side2 = geo.ray(x, y, a - .5, maxD + 40);
  if (side1 < 45 || side2 < 45) return null;                // in a corner: not clean enough
  const hx = x + Math.cos(a) * d, hy = y + Math.sin(a) * d;
  return { x: hx, y: hy, dist: d, nx: -Math.cos(a), ny: -Math.sin(a), ang: a };
}
function assess(eng, e, pv, attack) {
  const cands = eng.candidates(e, 2200), th = threatsAround(e, eng, pv.id, cands);
  const geo = eng.geo, arcs = openArcs(geo, pv.x, pv.y);
  let danger = 0, approaching = 0, seeing = 0;
  for (const t of th) { danger += t.cert * (1 - clamp(t.dist / 1500, 0, 1)); if (t.approaching && t.cert >= .5) approaching++; if (t.seesUs) seeing++; }
  const lit = geo.lightLevel(pv.x, pv.y, null);
  const rel = angDiff(Math.atan2(pv.y - e.y, pv.x - e.x), pv.angle);   // ~0: the victim faces away from the attacker, ~PI: faces it
  return { threats: th, danger, approaching, seeing, iso: clamp(1 - danger * 1.1, 0, 1), deadEnd: arcs.arcs <= 1 && arcs.frac < .34, arcs, lit, rel, facing: Math.abs(rel) > 2.0, behind: Math.abs(rel) < 1.0 };
}
function chooseMode(eng, e, ctx) {
  if (eng.forceCapture) return eng.forceCapture;                        // admin override (DEATHS tab): every catch is a quick kill / every catch is played with
  const sp = e.sp.capture, q = sp.quick(e, ctx);
  return e.rng() < q ? 'quick' : 'play';
}
function pickVariant(eng, e, pv, ctx, attack) {
  const hist = eng.recentKills[e.kind] || (eng.recentKills[e.kind] = []);
  const items = e.sp.capture.variants(eng, e, pv, ctx, attack);
  const n = hist.length, twice = n >= 2 && hist[n - 1] === hist[n - 2] ? hist[n - 1] : null;             // never a third identical death in a row when there is any alternative
  for (const it of items) { const i = hist.lastIndexOf(it.k); if (i >= 0) { const age = n - i; it.w *= age === 1 ? .35 : age === 2 ? .6 : .8; } if (it.k === twice) it.w *= .06; }
  const v = pickW(e.rng, items.filter(i => i.w > 0));
  hist.push(v); if (hist.length > 6) hist.shift();
  return v;
}
function beginCapture(eng, e, pv, attack) {
  if (pv.caught || e.cap || !pv.alive) return null;
  if(eng.geo.spatial&&!eng.geo.physicalContact(e,pv,e.r+12))return null;
  const ctx = assess(eng, e, pv, attack);
  const cap = { id: ++eng.capId, pid: pv.id, eid: e.id, kind: e.sp.name, t: 0, phase: 'grab', ctx, attack, mode: attack && attack.force ? attack.force : chooseMode(eng, e, ctx), variant: null, plan: null, decideAt: 0, plays: 0, released: false, interrupts: 0, log: [], pos: { x: pv.x, y: pv.y } };
  e.cap = cap; pv.caught = cap; eng.caps.push(cap);
  e.dbg.capture = { mode: cap.mode, danger: +ctx.danger.toFixed(2), iso: +ctx.iso.toFixed(2), deadEnd: ctx.deadEnd, approaching: ctx.approaching };
  if (cap.mode === 'quick') { killNow(eng, cap, pv, e, 'quick'); return cap; }
  cap.phase = 'down'; cap.phaseT = 0; cap.down = rand(e, 1.0, 1.9);
  cap.decideAt = rand(e, 5, 15) * (.7 + .5 * e.tr.PATIENCE);          // the tense stretch before the next major decision
  cap.variant = null;
  eng.emit({ t: 'caught', pid: pv.id, eid: e.id, kind: e.sp.name, ph: 'down', from: { x: e.x, y: e.y }, ang: Math.atan2(pv.y - e.y, pv.x - e.x) });
  e.sp.capture.onBegin && e.sp.capture.onBegin(eng, e, cap, pv);
  return cap;
}
const rand = (e, a, b) => a + e.rng() * (b - a);

function killNow(eng, cap, pv, e, why) {
  if (cap.phase === 'done') return;
  const ctx = cap.phase === 'grab' ? cap.ctx : assess(eng, e, pv, cap.attack || {});
  const ang = Math.atan2(pv.y - e.y, pv.x - e.x), forced = cap.attack && cap.attack.preview ? cap.attack.variant : null;
  if (forced) why = 'preview';
  ctx.wall = wallBehind(eng.geo, pv.x, pv.y, Math.cos(ang), Math.sin(ang));       // the wall the victim would be driven into: decided once, used for the choice and the record
  const variant = forced || pickVariant(eng, e, pv, ctx, cap.attack || {});       // a preview (admin) names its variant and leaves the "recent kills" memory alone
  const geo = { ax: e.x, ay: e.y, aa: ang, wall: variant === 'C' ? ctx.wall : null };
  cap.variant = variant; cap.phase = 'done'; cap.why = why;
  pv.alive = false;                                                        // dead from this instant: nothing else gets to capture or kill the same person in this very tick
  e.dbg.capture = Object.assign(e.dbg.capture || {}, { variant, why });
  eng.emit({ t: 'kill', pid: pv.id, eid: e.id, kind: e.sp.name, variant, why, geo, victim: { x: pv.x, y: pv.y, a: pv.angle }, ...(eng.geo.spatial?{physical:{victim:{x:pv.x,y:pv.y,z:pv.z,vx:pv.vx||0,vy:pv.vy||0,vz:pv.vz||0,angle:pv.angle,supportId:pv.supportId,shape:pv.shape},attacker:{x:e.x,y:e.y,z:e.z,vx:e.vx||0,vy:e.vy||0,vz:e.vz||0,angle:e.ang,supportId:e.supportId,shape:e.shape}}}:{}) });
  eng.sites.push({ x: pv.x, y: pv.y, ...(eng.geo.spatial?{z:pv.z,zMin:pv.z,zMax:pv.z,supportCandidates:[e.navSurfaceId],unresolved:false}:{}), t: eng.now, kind: e.kind, pid: pv.id, fed: 0 });
  if (eng.sites.length > 12) eng.sites.shift();
  finishCapture(eng, cap, pv, e);
  if (e.kind === 'hound') { beginCommit(eng, e, pv, variant, ctx); return; }
  e.sp.capture.afterKill && e.sp.capture.afterKill(eng, e, ctx, pv);
}
/* KILL COMMITMENT (v20): a hound that kills stays on its kill for as long as the death takes to play out on every screen (the clients' death lengths,
 * dphys.js DURS), ignoring everyone else; only then does it make its after-kill decision (next victim / guard / feed / leave) - with the situation as it is THEN.
 * The victim's client reports where the attacker ended up in the animation (drag etc.); the hound is set down there if that spot is close and clear. */
const KILL_DUR = { A: 4.5, B: 4.7, C: 4.3, D: 4.5 };
function beginCommit(eng, e, pv, variant, ctx) {
  e.commit = { pid: pv.id, v: variant, x: e.x, y: e.y, until: eng.now + (KILL_DUR[variant] || 4.5) + .25, ctx, body: false };
  e.path = []; e.trav = null; e.lunge = null; e.aim = null; e.speed = 0; e.target = null; setAct(e, 'feed');
  e.dbg.commit = variant;
}
function commitTick(eng, e, dt) {                                            // true while committed (the species tick does nothing else)
  const c = e.commit; if (!c) return false;
  stopMoving(eng, e, dt); if (e.act !== 'feed') setAct(e, 'feed');
  if (eng.now < c.until || (!c.body && eng.now < c.until + 1.5)) return true;   // (waits a moment for the victim's report of where the animation left it)
  e.commit = null; e.dbg.commit = null; setAct(e, '');
  const pv = eng.playerById(c.pid);
  let ctx = c.ctx; try { if (pv) ctx = assess(eng, e, pv, {}); } catch (_) { }
  e.sp.capture.afterKill && e.sp.capture.afterKill(eng, e, ctx, pv || { id: c.pid, x: c.x, y: c.y });
  return false;
}
function commitEnd(eng, pid, x, y, a) {                                      // the victim's client: "the animation left the attacker here"
  for (const e of eng.entities) {
    const c = e.commit; if (!c || c.pid !== pid || c.body) continue;
    c.body = true;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x - c.x, y - c.y) > 320 || !eng.geo.clear(x, y, e.rc, 'walk')) return false;
    e.x = x; e.y = y; if (Number.isFinite(a)) e.ang = a; e.wd = { x, y, t: 0 }; return true;
  }
  return false;
}
/* admin aid (DEATHS tab): play ONE chosen death on a player through the real capture / kill path.  The entity is set down a step away, on the side that makes that
 * variant honest (for the hound's C: a real wall behind the victim), then the ordinary quick capture runs - so the kill record, the events, what the entity does
 * afterwards and everything the clients replay are exactly what a natural death produces. */
function previewKill(eng, e, variant, pv) {
  const geo = eng.geo, V = /^[ABCD]$/.test(variant) ? variant : 'A', hound = e.kind === 'hound';
  if (!pv || !pv.alive || pv.caught || e.cap) return { ok: false, why: 'busy: already caught or dead' };
  const fwd = pv.angle, wantC = hound && V === 'C';
  const base = hound ? { A: fwd, B: fwd + Math.PI - .7, C: fwd, D: fwd + Math.PI }[V] : fwd;     // where the attacker stands, as an angle seen from the victim
  const offs = [0, .3, -.3, .6, -.6, .9, -.9, 1.25, -1.25, 1.6, -1.6, 2.0, -2.0, 2.5, -2.5, Math.PI];
  for (const off of offs) for (const r of hound ? [54, 44, 34] : [50, 42, 34]) {
    const a = base + off, ax = pv.x + Math.cos(a) * r, ay = pv.y + Math.sin(a) * r;
    if (!geo.clear(ax, ay, e.rc, 'walk') || !geo.los(ax, ay, pv.x, pv.y)) continue;
    if(geo.spatial&&!geo.physicalContact({...e,x:ax,y:ay},pv,e.r+12))continue;
    if (wantC && !wallBehind(geo, pv.x, pv.y, Math.cos(a + Math.PI), Math.sin(a + Math.PI))) continue;
    e.x = ax; e.y = ay; e.ang = a + Math.PI; e.path = []; e.trav = null; e.lunge = null; e.aim = null; e.speed = 0; e.tier = 'near'; e.tierT = 1; e.wd = { x: ax, y: ay, t: 0 };
    if (e.kind === 'smiler' && V === 'C') eng.lightFail(pv.x, pv.y, 560, 1.4);             // the lamps flicker out around the victim, as in a real light failure
    const cap = beginCapture(eng, e, pv, { force: 'quick', preview: true, variant: V, dir: e.ang, speed: 0, style: 'preview' });
    return cap ? { ok: true, v: V, eid: e.id } : { ok: false, why: 'the capture did not start' };
  }
  return { ok: false, why: wantC ? 'no wall about 1-2 body lengths from you: stand near a wall first' : 'no room to attack from here' };
}
function finishCapture(eng, cap, pv, e) { cap.phase = 'done'; if (e && e.cap === cap) e.cap = null; if (pv && pv.caught === cap) pv.caught = null; const i = eng.caps.indexOf(cap); if (i >= 0) eng.caps.splice(i, 1); }
function releaseVictim(eng, cap, pv, e, why) {
  cap.released = true; cap.phase = 'release'; cap.phaseT = 0; cap.releaseWhy = why;
  if (pv && pv.caught === cap) pv.caught = null;
  eng.emit({ t: 'release', pid: cap.pid, eid: cap.eid, why });
  e.dbg.capture = Object.assign(e.dbg.capture || {}, { released: why });
}

/* the caught-phase loop, called every engine tick for each live capture */
function capStep(eng, cap, dt) {
  const e = eng.entities.find(x => x.id === cap.eid), pv = eng.playerById(cap.pid);
  if(eng.geo.spatial&&e)eng=eng.entityContext(e);
  if (!e || !pv || !pv.alive) { finishCapture(eng, cap, pv, e); return; }
  cap.t += dt; cap.phaseT = (cap.phaseT || 0) + dt;
  const spc = e.sp.capture;
  if (cap.phase === 'release') {                                       // false hope: the prey is free, is it going to run?
    const r=e.mem.p.get(cap.pid),known=eng.geo.spatial?(r?.seen?r.visual:r?{id:r.id,...estimate(e,r,eng.now,eng.geo)}:{id:cap.pid,x:e.x,y:e.y}):pv;
    const running = (!eng.geo.spatial||r?.seen)&&(known.st === 2 || ((eng.geo.spatial?Math.hypot(known.vx||0,known.vy||0):known.sp) > 110 && beliefDistance(e,known) > 200));
    const d = beliefDistance(e,known);
    cap.watch = (cap.watch || 0) + dt;
    if (running && !cap.triggered) { cap.triggered = eng.now + rand(e, .35, 1.1) * (1.2 - e.tr.AGGRESSION * .5); }
    if (cap.triggered && eng.now >= cap.triggered) { spc.onResume && spc.onResume(eng, e, cap, known); finishCapture(eng, cap, pv, e); return; }
    if (!cap.triggered && (cap.watch > cap.holdFor || d > 1500)) { spc.onLetGo && spc.onLetGo(eng, e, cap, known); finishCapture(eng, cap, pv, e); return; }
    spc.releaseTick && spc.releaseTick(eng, e, cap, known, dt);
    return;
  }
  if (cap.phase === 'down') {
    if (cap.phaseT >= cap.down) { cap.phase = 'crawl'; cap.phaseT = 0; eng.emit({ t: 'phase', pid: pv.id, eid: e.id, ph: 'crawl' }); }
    spc.playTick(eng, e, cap, pv, dt);
  } else if (cap.phase === 'crawl') spc.playTick(eng, e, cap, pv, dt);
  /* interruption: another player closing in with a light, a loud noise, another entity */
  cap.checkT = (cap.checkT || 0) - dt;
  if (cap.checkT <= 0) {
    cap.checkT = .25;
    const ctx = assess(eng, e, pv, cap.attack || {});
    const noisy = e.hear && eng.now - e.hear.t < .8 && e.hear.I > .4 && e.hear.src !== pv.id;
    const others = eng.entities.some(o => o !== e && !o.cap && Math.hypot(o.x - e.x, o.y - e.y) < 500&&(!eng.geo.spatial||(eng.geo.distance(o,e)<500&&eng.geo.clearRay(eng.geo.eye(e),eng.geo.eye(o)))));
    if (ctx.approaching > 0 || ctx.seeing > 0 && ctx.danger > .5 || noisy || (others && e.kind === 'hound')) {
      cap.interrupts++;
      const choice = spc.onInterrupt(eng, e, cap, pv, ctx, { noisy, others });
      e.dbg.capture = Object.assign(e.dbg.capture || {}, { interrupt: choice, danger: +ctx.danger.toFixed(2) });
      if (choice === 'kill') { killNow(eng, cap, pv, e, 'interrupted'); return; }
      if (choice === 'release') { cap.holdFor = rand(e, 2.5, 6); releaseVictim(eng, cap, pv, e, 'interrupted'); spc.onRelease && spc.onRelease(eng, e, cap, pv); return; }
    }
  }
  /* the next major decision */
  if (cap.t >= cap.decideAt) {
    const c = spc.decide(eng, e, cap, pv);
    e.dbg.capture = Object.assign(e.dbg.capture || {}, { decision: c });
    if (c === 'kill') { killNow(eng, cap, pv, e, 'decided'); return; }
    if (c === 'release') { cap.holdFor = rand(e, 3, 9); releaseVictim(eng, cap, pv, e, 'false hope'); spc.onRelease && spc.onRelease(eng, e, cap, pv); return; }
    cap.decideAt = cap.t + rand(e, 4, 11) * (.7 + .5 * e.tr.PATIENCE);
  }
}
