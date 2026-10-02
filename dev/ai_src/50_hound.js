
/* ---------------------------------------------------------------- HOUND: primal, hears everything, fast in straight lines, poor at turning */
const HACT = { '': 0, listen: 1, sniff: 2, freeze: 3, wind: 4, lunge: 5, recover: 6, feed: 7, vault: 8, circle: 9, stare: 10, drag: 11, growl: 12, rest: 13, pace: 14, back: 15, guard: 16 };
const HOUND = {
  name: 'Hound', kind: 'hound', initial: S.ROAMING, radius: 26, clearance: 21, vTop: 320, turnPenalty: .62, roamSpeed: 92,
  traits: { INTELLIGENCE: .25, SADISM: .12, HUNGER: .72, PATIENCE: .3, CURIOSITY: .45, CAUTION: .3, TERRITORIALITY: .5, AGGRESSION: .82, PERSISTENCE: .72, SOCIAL: .45, HEARING: .86, VISION: .5, LIGHT_SENS: .12, MEMORY: .35 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: 1.2, CAN_CROUCH: true, CAN_CRAWL: true, CAN_SLIDE: false, CAN_OPEN_DOORS: false, CAN_BREAK_DOORS: true, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.4, ACCELERATION: 880 },
  vision: { range: 640, fov: 2.7, dark: false, gain: 3.0, floor: 150 },   // floor: a body this close in front of it is noticed whatever its posture (crouching is not invisibility)
  speeds: { roam: 92, stalk: 84, investigate: 122, search: 134, chase: 292, retreat: 235, frustrated: 150 },
  init(eng, e) { e.roam = { goal: null, until: 0, nextListen: rand(e, 4, 11) }; e.lunge = null; e.recover = 0; e.search = null; e.feed = null; e.chaseBlind = 0; e.growlAt = 0; e.rest = 0; },
};
const hSpeed = (e, k, eng) => (e.sp.speeds[k] || 100) * (k === 'chase' ? 1 + (e.tr.AGGRESSION - .82) * .18 + (eng.pressure || 0) * .04 : 1);

/* 2E: evidence interpretation, not new senses. See dev/HOUND_CANON_LOCK_STAGE_2E.md.
 * Human identification / temporary gaze intimidation: canon. Light investigation, heading prediction,
 * strong hearing and finite branch searches: gameplay inferences. No new random draws or shared knowledge. */
const hDwell = e => 1.8 + e.tr.PERSISTENCE; // Hound continuity, independent of Smiler tuning
function hMaySwitch(e, r, now) {
  const cur = e.mem.p.get(e.target);
  return !cur || r.id === cur.id || cur.conf < .2 || now - (e.tgtSince ?? -99) >= hDwell(e);
}
function hObserve(eng, e) {
  for (const r of e.mem.p.values()) if (r.seen) {
    // Hearing can update the fused record later. Keep the actual last visual observation separate.
    r.hv = r.visual; // one shared sampled sight boundary, never a live between-sense player
    if (r.light) r.aw = Math.max(r.aw, .72); // an identified, illuminated human warrants hostility
  }
  if (e.hEye && eng.now - e.hEye.last > 12 && !e.seenNow.size) e.hEye = null;
}
/* Human-QA amendment (Part 2 final pass): eye contact is PRE-PURSUIT intimidation.
 * It can delay the decision to commit, but once HUNTING begins the Hound does not become
 * safe just because the player turns around and stares at it.  The finite budget is kept:
 * even before commitment, eye contact buys time rather than permanent ownership. */
function hPreGaze(eng, e, r, dt) {
  const p = r && r.seen ? r.hv : null;
  if (!p || e.state === S.HUNTING) { if (e.act === 'stare' && e.state === S.STALKING) setAct(e, ''); return false; }
  const E = e.hEye || (e.hEye = { used: 0, last: eng.now }); E.last = eng.now;
  const budget = 1.15 + e.tr.CAUTION * .9;
  if (E.used < budget && facedBy(eng, e, p, r)) {
    E.used = Math.min(budget, E.used + Math.max(0, dt));
    if (e.state === S.STALKING) setAct(e, 'stare');
    faceToward(e, r.lkx, r.lky, Math.max(0, dt), 3);
    e.head = Math.sin(e.t * 3) * .12; e.dbg.hWhy = 'eye contact delays pursuit commitment; still stalking';
    return true;
  }
  if (e.act === 'stare' && e.state === S.STALKING) setAct(e, '');
  return false;
}
function hPerceived(eng, e, r) {
  if (r.seen && r.hv) return { ...r.hv, sp: Math.hypot(r.hv.vx, r.hv.vy), seen: true };
  const est = estimate(e, r, eng.now, eng.geo);
  return { ...est, vx: r.lvx, vy: r.lvy, sp: Math.hypot(r.lvx, r.lvy), seen: false };
}
function hLightStart(eng, e, heardLead = null) {
  if (![S.ROAMING, S.DORMANT, S.CURIOUS, S.FRUSTRATED].includes(e.state) && !(heardLead && [S.HUNTING, S.SEARCHING, S.STALKING].includes(e.state))) return false;
  const L = heardLead || bestAnonLead(e, eng.now); if (!L || L.c < .25 || eng.now - L.t > 3) return false;
  const checked = e.hChecked || (e.hChecked = []);
  if (checked.some(q => eng.now < q.until && Math.hypot(q.x - L.x, q.y - L.y) < 180)) return false;
  if (e.hLight && e.state === S.CURIOUS) return true; // finish one hypothesis, do not restart its timer each observation
  e.hLight = { lead: L.id, x: L.x, y: L.y, u: L.u, k: L.k, t: eng.now, until: eng.now + 7 + e.tr.CURIOSITY * 5, arrived: 0 };
  e.inv = { lead: L.id, x: L.x, y: L.y, u: L.u, k: L.k, t: eng.now, c: L.c };
  setState(e, S.CURIOUS, 'listen'); e.dbg.hWhy = `investigate anonymous ${L.k}; carrier unidentified`;
  e.dbg.listen = L.k === 'sound' ? 'orienting to anonymous sound' : 'orienting to visible light'; return true;
}
function hLightStep(eng, e, dt) {
  const q = e.hLight, now = eng.now;
  if (now - q.t < .28 || q.arrived) {
    stopMoving(eng, e, dt); faceToward(e, q.x, q.y, dt, 5.5); e.head = Math.sin(e.t * 2) * .3;
    setAct(e, 'listen'); e.dbg.listen = q.arrived ? `${q.k} location checked; listening for a source` : `orienting to ${q.k}`;
  } else {
    setAct(e, ''); e.dbg.listen = ''; goTo(eng, e, q.x, q.y, { every: 1.2 });
    const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), {});
    if (st === 'arrived' || st === 'nopath' || dist(e.x, e.y, q.x, q.y) < 60) q.arrived = now;
  }
  if (now > q.until || (q.arrived && now - q.arrived > .8 + e.tr.PATIENCE)) {
    const L = e.mem.leads.find(l => l.id === q.lead); if (L) L.c *= .65;
    const checked = e.hChecked || (e.hChecked = []); checked.push({ x: q.x, y: q.y, until: now + 8 });
    if (checked.length > 6) checked.shift();
    e.dbg.disengage = `${q.k} hypothesis checked; no human identified`; e.dbg.hWhy = e.dbg.disengage;
    e.hLight = null; e.inv = null; e.dbg.listen = ''; setState(e, S.ROAMING); e.roam.goal = null;
  }
}
function hWhy(e) {
  if (e.state === S.HUNTING || e.state === S.SEARCHING || e.state === S.FRUSTRATED || (e.state === S.CURIOUS && e.hLight)) return e.dbg.hWhy || e.huntWhy || e.dbg.searchWhy || 'following evidence';
  return ({ ROAMING: 'patrol; no active pursuit', DORMANT: 'rest or distant LOD', CURIOUS: 'orient to a heard disturbance', ALERT: 'evaluate a fresh sound', STALKING: 'approach a perceived trail cautiously', CAUTIOUS: 'assess the visible group', FEEDING: 'feed or guard the kill site', EXCITED: 'react to the confirmed kill', RETREATING: 'withdraw from the perceived threat', PLAYING: 'active physical capture' })[e.state] || e.state;
}
function hDebug(eng, e) {
  const r = e.mem.p.get(e.target), v = r && r.hv, s = e.state === S.SEARCHING ? e.search : null, q = e.state === S.CURIOUS ? e.hLight : null;
  return { why: hWhy(e), transition: e.dbg.hTransition || null,
    listen: ['listen', 'sniff', 'freeze', 'stare'].includes(e.act) ? (e.act === 'stare' && e.state === S.STALKING ? 'eye-contact hesitation before pursuit' : e.dbg.listen || 'routine environmental listening') : '',
    dwell: +Math.max(0, hDwell(e) - (eng.now - (e.tgtSince ?? -99))).toFixed(2),
    seen: !!(r && r.seen), visual: v ? [Math.round(v.x), Math.round(v.y), +(eng.now - v.t).toFixed(2), +Math.atan2(v.vy, v.vx).toFixed(3)] : null,
    conf: r ? +r.conf.toFixed(2) : null, branch: s && s.goal ? s.goal.k : '', rejected: s ? s.visited.length : 0,
    prediction: e.state === S.HUNTING ? e.dbg.pursuit || null : null, investigation: q ? [Math.round(q.x), Math.round(q.y), q.k, Math.round(q.u)] : null,
    gaze: e.hEye ? +e.hEye.used.toFixed(2) : 0,
    traits: { persistence: +e.tr.PERSISTENCE.toFixed(2), curiosity: +e.tr.CURIOSITY.toFixed(2), patience: +e.tr.PATIENCE.toFixed(2), caution: +e.tr.CAUTION.toFixed(2) } };
}

function houndTargetScore(e, r, now) {
  const age = memAge(e, r, now), d = Math.hypot(r.lkx - e.x, r.lky - e.y);
  let s = r.aw * .7 + r.conf * .6 - Math.min(1, age / 25) * .35 - d / 6000;
  if (r.seen) s += .55 + (r.light ? .3 : 0); if (now - r.hLoud < 1 || (r.seen && (r.st === 2 || r.st === 5))) s += .3;
  return s;
}
function pickTarget(eng, e, filter) {
  let best = null, bs = -1;
  for (const r of e.mem.p.values()) {
    if (r.conf < .04 && !r.seen) continue;
    if (tgtGone(eng, e, r)) continue;                                            // (v23) only what it saw: not the true state of an unseen player
    if (filter && !filter(r)) continue;
    const s = houndTargetScore(e, r, eng.now); if (s > bs || (s === bs && (!best || r.id < best.id))) { bs = s; best = r; }
  }
  return best;
}
/* how many of the people it can see right now stand together (within ~420 px of the same person) */
function groupSeen(eng, e) {
  const ps = []; for (const id of e.seenNow) { const pv = e.mem.p.get(id)?.visual; if (pv && pv.alive && !pv.caught) ps.push(pv); }
  let best = ps.length ? 1 : 0;
  for (const a of ps) { let n = 0; for (const b of ps) if (dist(a.x, a.y, b.x, b.y) < 420) n++; if (n > best) best = n; }
  return best;
}
function houndGrowl(eng, e, I = .7, type = 'growl') { if (eng.now - e.growlAt < 2.5) return; e.growlAt = eng.now; eng.sound({ x: e.x, y: e.y, r: 980, I, type, src: -e.id, ent: e.id }); }

/* ROAMING: wander a route of far-apart spots, stopping now and then to listen.  ------------------------------------------------ */
function hRoam(eng, e, dt) {
  const R = e.roam;
  if (e.act === 'listen') {                                               // stands still, head up, hearing sharpened
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 1.7) * .5; if (e.actT > R.listenFor) { setAct(e, ''); R.nextListen = eng.now + rand(e, 6, 15); R.goal = null; }
    return;
  }
  if (e.act === 'rest') { stopMoving(eng, e, dt); if (e.actT > e.rest) { setState(e, S.ROAMING, ''); e.rest = 0; } return; }
  if (eng.now > R.nextListen && e.speed < 140) { setAct(e, 'listen'); R.listenFor = rand(e, 1.6, 3.8); return; }
  if (!R.goal || eng.now > R.until || dist(e.x, e.y, R.goal.x, R.goal.y) < 60) {
    if (R.goal && e.rng() < .12 && e.tier !== 'near') { setState(e, S.DORMANT, 'rest'); e.rest = rand(e, 8, 20); R.goal = null; return; }
    R.goal = randomFloor(eng, e, 900, 2800) || randomFloor(eng, e, 400, 1600); R.until = eng.now + 40;
    if (R.goal) plan(eng, e, R.goal.x, R.goal.y);
  }
  if (R.goal) { const st = follow(eng, e, dt, hSpeed(e, 'roam', eng), {}); if (st === 'nopath') R.goal = null; e.head = Math.sin(e.t * .9) * .3; } else stopMoving(eng, e, dt);
}

/* SEARCHING (Part 1C): losing sight starts a search, it does not reset the hound.  It keeps what it knew - where it last saw the prey, which way it
 * was going and how fast, when, the last sound it made, whether it went into a crawlspace - and works outward from it:
 *   lkp       run to where the prey should be now: the last sighting pushed along its heading, stopped short of walls
 *   continue  check the ways out that carry on in that direction (doorways, the rest of a corridor), then the plausible alternatives: the heading
 *             counts for less the longer the search goes on and the less sure it is (INTELLIGENCE reads the heading better)
 *   exits     the other openings of a crawlspace the prey went into - it cannot know which way the prey left, only which ways there are
 *   watch     a patient hound may stop at a crawl exit and listen
 * A loud sound from the prey (running, a slide, a vault) ends the search: the chase is back on.  A quiet one draws it there.
 * How long it keeps at it depends on the evidence (how recent, how sure, sounds) and on the hound (PERSISTENCE, CURIOSITY, PATIENCE); when it gives
 * up it says why (debug).  Nothing here reads where the prey really is. */
function searchBudget(e, r, now) {
  const fresh = r ? clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / 12, 0, 1) : 0;
  return { dur: lerp(10, 30, e.tr.PERSISTENCE) * (.7 + .5 * fresh) * (.85 + .3 * e.tr.CURIOSITY), legs: 3 + Math.round(e.tr.CURIOSITY * 4 + e.tr.PERSISTENCE * 2) };
}
function beginSearch(eng, e, r, why) {
  e.hLight = null; e.dbg.hWhy = why === 'lost' ? 'lost visual contact; predict from observed heading and openings' : 'investigate heard evidence';
  setState(e, S.SEARCHING, why === 'lost' ? '' : 'freeze');                    // straight on after the prey: no stop to "think" when it has only just vanished
  const B = searchBudget(e, r, eng.now);
  e.search = { rid: r ? r.id : 0, started: eng.now, goal: null, phase: 'lkp', legs: 0, visited: [], why, until: eng.now + B.dur, maxLegs: B.legs, pause: 0, first: why !== 'lost', exitsTried: [], routeStage: 0, lookAng: null };
  e.dbg.searchWhy = why; e.dbg.disengage = '';
  if (r) {
    const est = estimate(e, r, eng.now, eng.geo), sp = Math.hypot(r.lvx, r.lvy), hd = sp > 20 ? Math.atan2(r.lvy, r.lvx) : e.ang;
    e.search.goal = { x: est.x, y: est.y, k: 'lkp' }; e.search.est = est; e.search.hd = hd; e.search.sp = sp;
    e.search.lkp = { x: r.lkx, y: r.lky }; e.search.lookAng = hd;
  }
}
/* the places worth looking, scored.  anchor = where the prey most likely is now (memory), heading = which way it was going.
 * Human-QA AI-01: on the first couple of post-loss hypotheses, observed motion has real inertia.  The Hound checks routes that plausibly
 * continue the last visible heading before it entertains a reversal.  This is a prediction only: left/right branches can still be guessed
 * wrong, failed hypotheses lose confidence, and no hidden player position/velocity is consulted. */
function pickSearchGoal(eng, e, s) {
  const r = e.mem.p.get(s.rid), now = eng.now, geo = eng.geo;
  const baseEst = r ? estimate(e, r, now, geo) : { x: e.x, y: e.y, unc: 500 };
  const hd = s.hd ?? (r ? Math.atan2(r.lvy, r.lvx) : e.ang), moving = (s.sp || 0) > 30;
  const prog = clamp((now - s.started) / Math.max(4, s.until - s.started), 0, 1);
  const earlyRoute = moving && s.why === 'lost' && (s.routeStage || 0) < 2 && prog < .5;
  // Early after a visual loss, reason from the actual last-seen spot. estimate() is useful later as uncertainty grows, but using a projected
  // point as the opening anchor can skip the very corner/doorway where the prey disappeared.
  const base = earlyRoute && s.lkp ? s.lkp : baseEst;
  const wH = moving ? lerp(360, 70, prog) * (.6 + .75 * e.tr.INTELLIGENCE) : 0;
  let best = null, bs = -1e9;
  const consider = (x, y, sc, k, extra) => {
    const c = geo.cellAt(x, y); if (c < 0 || geo.cls[c] !== 1) { const q = geo.snap(x, y, e.caps, 2); if (q < 0) return; x = geo.cx(q); y = geo.cy(q); }
    for (const v of s.visited) if (Math.hypot(v.x - x, v.y - y) < 230) return; // a failed hypothesis is not an endlessly reusable route
    sc -= Math.hypot(x - e.x, y - e.y) * .1 + e.streams.search() * (40 + 90 * (1 - e.tr.INTELLIGENCE));
    sc = habitBias(e, s.rid, x, y, sc);
    if (sc > bs) { bs = sc; best = Object.assign({ x, y, k }, extra || {}); }
  };
  // 1) the ways out from where it should be: openings in 12 directions.  While the visual trail is fresh, don't immediately reverse away
  // from the direction the Hound actually saw the prey travelling unless geometry leaves no forward/side opening at all.
  let continuationCount = 0;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, align = Math.cos(angDiff(a, hd));
    if (earlyRoute && align < -.2) continue;                                 // first hypotheses stay in the forward/side hemisphere
    const L = geo.ray(base.x, base.y, a, 700); if (L < 230) continue;
    continuationCount++;
    const d = Math.min(L - 50, (moving && prog < .35 ? 520 : 260 + 200 * prog) + e.tr.CURIOSITY * 80);
    const momentum = earlyRoute ? 150 * Math.max(0, align) + 55 * Math.max(0, 1 - Math.abs(angDiff(a, hd)) / (Math.PI / 2)) : 0;
    consider(base.x + Math.cos(a) * d, base.y + Math.sin(a) * d, 120 + align * wH + momentum + Math.min(L, 700) * .12, 'continue', { a });
  }
  // A dead-end can legitimately force a reversal.  If the fresh-heading filter found no plausible exit, widen immediately instead of freezing.
  if (earlyRoute && continuationCount === 0) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, L = geo.ray(base.x, base.y, a, 700); if (L < 230) continue;
      const d = Math.min(L - 50, 300 + e.tr.CURIOSITY * 80), align = Math.cos(angDiff(a, hd));
      consider(base.x + Math.cos(a) * d, base.y + Math.sin(a) * d, 90 + align * wH * .45 + Math.min(L, 700) * .1, 'continue', { a, forced: 1 });
    }
  }
  // 2) a crawlspace it saw the prey go into: its exits (the other faces first: the prey went in from this side)
  const cz = r && r.crawl && now - r.crawlAt < 30 ? WORLD.CRAWL.find(c => c.id === r.crawl) : null;
  if (cz) {
    const can = WORLD.canCrawl(e.caps, cz), entry = Math.atan2(r.lky - cz.cy, r.lkx - cz.cx);
    if (can && !s.exitsTried.includes('in')) consider(cz.cx, cz.cy, 520, 'enter', { cz: cz.id });
    for (const x of cz.exits) {
      if (!geo.clear(x.x, x.y, e.rc, 'walk') || s.exitsTried.includes(x.face + ':' + Math.round(x.x) + ',' + Math.round(x.y))) continue;
      const other = Math.cos(angDiff(Math.atan2(x.ny, x.nx), entry)) < .3 ? 1 : 0;
      consider(x.x, x.y, (can ? 200 : 460) + other * 220 + e.tr.PATIENCE * 60, 'exit', { cz: cz.id, face: x.face, key: x.face + ':' + Math.round(x.x) + ',' + Math.round(x.y) });
    }
  }
  // 3) a sound it heard from the prey since it lost it
  if (r && r.heardAt > s.started - 1 && now - r.heardAt < 8) consider(r.hx, r.hy, 480 - (now - r.heardAt) * 30, 'sound');
  return best;
}
function hSearch(eng, e, dt, thinkNow) {
  const s = e.search; if (!s) { setState(e, S.ROAMING); return; }
  const now = eng.now, r = e.mem.p.get(s.rid);
  const giveUp = why => { s.exhausted = true; e.dbg.disengage = why; e.dbg.hWhy = why; e.mood.frustration = Math.min(1, e.mood.frustration + .25); setState(e, S.FRUSTRATED, 'pace'); e.frus = { until: now + rand(e, 2, 4.5) }; };
  e.dbg.search = { ph: s.phase, legs: s.legs + '/' + s.maxLegs, t: +(now - s.started).toFixed(1), left: +(s.until - now).toFixed(1), g: s.goal ? [Math.round(s.goal.x), Math.round(s.goal.y), s.goal.k] : null, unc: r ? Math.round(estimate(e, r, now).unc) : 0, cz: r && r.crawl || '' };
  if (e.act === 'freeze') {                                                // a beat to listen on arrival / first snap decision
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.1) * .55;
    e.dbg.listen = 'uncertain trail; orient before checking it';
    if (e.actT > (s.first ? .25 + e.tr.PATIENCE * .35 : .7 + e.tr.PATIENCE)) { s.first = false; setAct(e, 'sniff'); s.pause = 0; }
    return;
  }
  if (s.phase === 'watch') {                                               // waiting at a crawl exit, listening
    stopMoving(eng, e, dt); setAct(e, 'listen'); e.head = Math.sin(e.t * 1.4) * .5; s.pause += dt;
    if (s.pause > s.watchFor) { s.phase = 'go'; s.goal = null; setAct(e, ''); }
    return;
  }
  if (e.act === 'sniff' && s.phase === 'pause') {
    stopMoving(eng, e, dt); e.head = Math.sin(e.t * 3.2) * .6; s.pause += dt;
    const warm = r ? clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / 8, 0, 1) : 0;
    s.lookAng = (s.sp || 0) > 30 && (s.routeStage || 0) < 2 ? s.hd : null;      // presentation: look where the observed trail most likely continues
    e.dbg.listen = s.lookAng !== null ? 'last-seen spot empty; checking the prey\'s observed direction first' : 'predicted location empty; listen before trying another opening';
    if (s.pause > (.5 + e.tr.PATIENCE * .8) * (1.2 - e.tr.AGGRESSION * .5) * (1 - .7 * warm)) {
      s.phase = 'go'; s.goal = pickSearchGoal(eng, e, s); s.legs++; if (s.goal?.k === 'continue') s.routeStage = (s.routeStage || 0) + 1;
      s.lookAng = s.goal?.a ?? null; setAct(e, ''); e.mood.frustration = Math.min(1, e.mood.frustration + .05);
    }
    return;
  }
  // giving up is a decision with a reason: the evidence has run out, the plausible places are done, or it has simply spent its patience
  const conf = r ? r.conf : 0;
  if (!r) { giveUp('no target'); return; }
  if (conf < .12 && s.legs >= 2) { giveUp('memory faded'); return; }
  if (s.legs > s.maxLegs) { giveUp('searched the likely places'); return; }
  if (now > s.until) { giveUp('search budget exhausted without new evidence'); return; }
  if (!s.goal) { s.goal = pickSearchGoal(eng, e, s); if (!s.goal) { giveUp('nowhere left to look'); return; } }
  goTo(eng, e, s.goal.x, s.goal.y, { every: 1.5 });
  e.dbg.hWhy = `check ${s.goal.k || 'heard position'} from remembered evidence; heading ${s.hd?.toFixed(2) ?? 'unknown'}`;
  const fresh = clamp(1 - (now - Math.max(r.seenAt, r.heardAt)) / (5 + 5 * e.tr.AGGRESSION), 0, 1);     // while the trail is warm it moves like it is still chasing, through the likely routes
  const v = lerp(hSpeed(e, s.why === 'sound' ? 'investigate' : 'search', eng) * (.9 + .3 * e.tr.AGGRESSION), hSpeed(e, 'chase', eng) * .9, s.phase === 'lkp' || s.goal.k === 'continue' || s.goal.k === 'sound' ? fresh : fresh * .5);
  const st = follow(eng, e, dt, v, {});
  e.head = Math.sin(e.t * 1.6) * .35;
  if (st === 'arrived' || st === 'nopath' || dist(e.x, e.y, s.goal.x, s.goal.y) < 50) {
    const c = eng.geo.cellAt(e.x, e.y); if (c >= 0) e.mem.visited.set(c, now); s.visited.push({ x: s.goal.x, y: s.goal.y });
    if (!r.seen && now - Math.max(r.seenAt, r.heardAt) > 1) r.conf = Math.max(0, r.conf - .12);
    if (s.goal.key) s.exitsTried.push(s.goal.key); if (s.goal.k === 'enter') s.exitsTried.push('in');
    const atExit = s.goal.k === 'exit';
    s.phase = atExit && e.rng() < .35 + e.tr.PATIENCE ? 'watch' : 'pause'; s.watchFor = rand(e, 2.5, 7) * (.5 + e.tr.PATIENCE); s.pause = 0; s.goal = null; s.lookAng = (s.sp || 0) > 30 ? s.hd : null;
    setAct(e, s.phase === 'watch' ? 'listen' : 'sniff');
  }
}

/* STALKING / HUNTING with the committed lunge. ------------------------------------------------------------------------------- */
function beginHunt(eng, e, r, why) {
  e.hLight = null; e.dbg.listen = ''; e.dbg.hWhy = why;
  if (e.state !== S.HUNTING) { houndGrowl(eng, e, .75); e.mood.arousal = Math.min(1, e.mood.arousal + .5); }
  setState(e, S.HUNTING, ''); setTarget(e, r.id, eng.now); e.chaseBlind = 0; e.huntWhy = why; e.huntStart = eng.now;
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
  if (e.lungeBias === undefined) e.lungeBias = (e.rng() - .5) * (1.15 - e.tr.INTELLIGENCE) * 96;
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
    const tr = e.mem.p.get(L.tid), t = tr && tr.seen ? tr.hv : null; // sampled visual evidence, never live hidden coordinates between senses
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
  if (k >= 1) { e.lunge = null; e.recover = rand(e, .85, 1.3); setAct(e, 'recover'); e.mood.frustration = Math.min(1, e.mood.frustration + .18); e.cool.lunge = rand(e, 1.2, 2.4); e.dbg.lunge = 'missed'; e.lungesMissed = (e.lungesMissed || 0) + 1; }
  return false;
}

function hHunt(eng, e, dt, thinkNow) {
  const now = eng.now, r = e.mem.p.get(e.target), pvT = r && r.seen ? r.hv : null;
  if (e.recover > 0) {                                                    // after a lunge: overshoot, skid, turn around slowly
    e.recover -= dt; e.speed = approach(e.speed, 40, 620 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt);
    if (r && e.recover < .55) faceToward(e, r.lkx, r.lky, dt, 1.4);
    if (e.recover <= 0) { e.stun = false; setAct(e, ''); }
    return;
  }
  if (e.lunge) { const res = stepLunge(eng, e, dt); if (res && res.pv) return res; return; }
  if (!r || tgtGone(eng, e, r)) { const alt = pickTarget(eng, e); if (alt) { setTarget(e, alt.id, now); return; } e.dbg.disengage = r ? 'saw its prey go down' : 'lost its prey'; setState(e, S.ROAMING); return; }
  const seen = r.seen && !!pvT;
  // Once pursuit is committed, gaze never suppresses the chase.  Clear a stale pre-pursuit pose if needed.
  if (e.act === 'stare') setAct(e, '');
  if (seen) {
    e.dbg.hWhy = r.light ? 'pursue identified human exposed by visible light' : 'pursue visually identified human';
    e.chaseBlind = 0; e.lostSince = 0;
    const tgt = { x: pvT.x, y: pvT.y, vx: pvT.vx, vy: pvT.vy, id: pvT.id };
    if (lungeCheck(eng, e, r, tgt) && e.rng() < 1 - Math.pow(.04, dt * (1 + e.tr.AGGRESSION))) { startLunge(eng, e, tgt); return; }
    // predicted interception point, but never through walls: plan to it, aim straight when the way is clear
    // Advance only the sampled visible velocity between perception updates. This keeps the
    // prediction continuous without reaching into the live player when an old seen flag persists.
    const chaseD = dist(e.x, e.y, tgt.x, tgt.y);
    // Close-range orbit fix: don't lead past somebody who is already beside the Hound.  At this range the job is to reorient physically,
    // not draw a wide interception arc that a walking player can orbit forever.
    const lead = chaseD < 190 ? 0 : clamp(chaseD / 420, 0, .55) * (.5 + e.tr.INTELLIGENCE) + Math.min(.12, Math.max(0, now - pvT.t));
    let LD = Math.hypot(tgt.vx, tgt.vy) * lead; if (LD > 1) LD = Math.max(0, Math.min(LD, eng.geo.ray(tgt.x, tgt.y, Math.atan2(tgt.vy, tgt.vx), LD + 30) - 26));   // the lead stops at walls: a prey pressed against one is not "ahead" of itself
    const sv = Math.hypot(tgt.vx, tgt.vy) || 1, gx = tgt.x + tgt.vx / sv * LD, gy = tgt.y + tgt.vy / sv * LD;
    if (directOk(eng, e, tgt.x, tgt.y, 620) && (Math.hypot(gx - tgt.x, gy - tgt.y) < 8 || directOk(eng, e, gx, gy, 700))) directTo(eng, e, gx, gy);   // straight at it only when the body itself fits the line (it used to test 16 px: it scraped doorframes)
    else goTo(eng, e, gx, gy, { every: .45 });
    e.dbg.pursuit = { x: gx, y: gy };
  } else {
    // out of sight but not out of hearing: fresh loud footsteps (running, sliding, vaulting) keep the hunt going, aimed where they are heading.
    // Only silence lets the blind clock run at full speed - a prey that goes quiet is the one that gets away.
    const byEar = now - r.hLoud < .9 && now - r.heardAt < .9, justNow = now - r.seenAt < .6;
    e.chaseBlind += dt * (byEar ? .12 : 1);
    // for a moment after losing sight it keeps going for where it last saw it (a flicker at the edge of vision must not swap the goal back and forth)
    const est = justNow ? { x: r.lkx, y: r.lky } : byEar ? { x: r.hx + r.hvx * .35, y: r.hy + r.hvy * .35 } : estimate(e, r, now, eng.geo);
    goTo(eng, e, est.x, est.y, { every: .5 });
    e.dbg.pursuit = { x: Math.round(est.x), y: Math.round(est.y), blind: +e.chaseBlind.toFixed(1), ear: byEar ? 1 : 0 };
    e.dbg.hWhy = byEar ? 'fresh running sound; follow heard position and heard heading' : 'visual contact lost; predict from last observation';
    if (e.chaseBlind > lerp(1.4, 4.6, e.tr.PERSISTENCE)) { beginSearch(eng, e, r, 'lost'); e.mood.frustration = Math.min(1, e.mood.frustration + .15); return; }
  }
  let chaseV = hSpeed(e, 'chase', eng), turnMul = 1;
  if (seen) {
    const d = dist(e.x, e.y, pvT.x, pvT.y), err = Math.abs(angDiff(Math.atan2(pvT.y - e.y, pvT.x - e.x), e.ang));
    if (d < 190) {
      // Preserve the Hound's broad, physical turns in normal pursuit.  Only at close range does it plant/pivot harder so walking circles
      // around its shoulder is not an infinite safe strategy.  Large facing errors also bleed speed, giving the body room to turn.
      const q = clamp((190 - d) / 120, 0, 1);
      // First bleed chase speed, then gain the extra pivot authority. This keeps the species' poor high-speed turning intact: it cannot
      // become a turret while still charging at 230+ px/s merely because prey crossed close to its shoulder.
      if (err > .72) chaseV = Math.min(chaseV, lerp(175, 92, q));
      turnMul = e.speed < 190 ? 1 + 2.15 * q : 1;
      e.dbg.closePivot = { d: Math.round(d), err: +err.toFixed(2), mul: +turnMul.toFixed(2) };
    } else e.dbg.closePivot = null;
  } else e.dbg.closePivot = null;
  const st = follow(eng, e, dt, chaseV, { arrive: 10, noSlow: false, turnMul });
  e.head = 0;
  // touching the prey without a lunge still counts (a swipe as it runs past)
  for (const pv of eng.nearPlayers(e.x, e.y, 50)) if (pv.alive && !pv.caught && dist(e.x, e.y, pv.x, pv.y) < e.r + 12) return { pv, dir: e.ang, speed: e.speed };
}

const stalkPatience = e => lerp(4, 15, e.tr.PATIENCE) * (1.15 - e.tr.AGGRESSION * .3);
/* STALKING: it shadows the prey - it matches a walker's pace so the prey never simply walks away from it, holds back at a distance
 * while the prey stands still, and creeps a little closer the longer it watches, until it commits (or the prey gives it a reason to). */
function hStalk(eng, e, dt, thinkNow) {
  const r = e.mem.p.get(e.target);
  if (!r || tgtGone(eng, e, r)) { beginSearch(eng, e, r, 'lost'); return; }
  const P = hPerceived(eng, e, r), seen = P.seen, est = P, d = dist(e.x, e.y, est.x, est.y);
  e.stalkFor = (e.stalkFor || 0) + dt;
  const gazed = seen && hPreGaze(eng, e, r, dt);                         // only before pursuit; finite and still physically advancing
  goTo(eng, e, est.x, est.y, { every: .6 });
  const baseHold = lerp(380, 205, clamp(e.stalkFor / stalkPatience(e), 0, 1));
  const hold = gazed ? Math.min(baseHold, 215) : baseHold;               // watched Hound creeps in instead of freezing in place
  const tv = P.sp;                    // how fast it can see the prey going
  let vmax = d > hold ? clamp(tv * 1.12 + (d - hold) * .7, hSpeed(e, 'stalk', eng) * .7, hSpeed(e, 'chase', eng) * .74) : clamp(tv * .7 - (hold - d) * .6, 0, 70);
  if (gazed) vmax = Math.min(vmax, 72);                                  // hesitation changes commitment, not aggression/awareness
  follow(eng, e, dt, vmax, { arrive: 30, turnMul: gazed ? 1.2 : 1 });
  e.head = Math.sin(e.t * 2.4) * .12;
  if (thinkNow) {
    const runner = r.st === 2 || r.st === 5 || r.ex;
    // Running, getting point-blank, or simply exhausting the finite intimidation window commits the chase.  After beginHunt(), gaze is ignored.
    if (seen && (runner || d < 135 || (!gazed && (d < 230 || e.stalkFor > stalkPatience(e))))) { beginHunt(eng, e, r, runner ? 'stalk-run-commit' : d < 135 ? 'stalk-close-commit' : 'stalk-commit'); return; }
    if (!seen && eng.now - Math.max(r.seenAt, r.heardAt) > 3.4) { beginSearch(eng, e, r, 'lost'); }
  }
}

/* what a hound makes of a fresh sound, and of being seen ------------------------------------------------------------------------ */
function hReact(eng, e) {
  const now = eng.now;
  hObserve(eng, e);
  // seen prey
  let seen = null, sd = 1e9, score = -Infinity;
  const current = e.mem.p.get(e.target);
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id), pv = r?.visual; if (!pv || !pv.alive || pv.caught) continue;
    if (!hMaySwitch(e, r, now)) continue;
    const value = houndTargetScore(e, r, now) + (id === e.target ? .65 : 0);
    if (value > score) { score = value; seen = r; sd = Math.hypot(r.lkx - e.x, r.lky - e.y); }
  }
  // Seeing both prey is no reason to flicker between them. Finish the current pursuit.
  if (current && current.seen && !tgtGone(eng, e, current)) { seen = current; sd = Math.hypot(current.lkx - e.x, current.lky - e.y); }
  if (seen && seen.aw > .45) {
    const runner = seen.st === 2 || seen.st === 5 || seen.ex, near = sd < 480, hungry = e.tr.HUNGER > .55;
    const gazed = e.state !== S.HUNTING && !runner && hPreGaze(eng, e, seen, 0);  // fresh eye contact can delay the initial commitment only
    const grp = groupSeen(eng, e), fresh = grp > (e.grpN || 0); e.grpN = grp;                       // somebody else has just come into view: it takes stock of the group once
    if (fresh && grp >= 2 && !runner && !seen.light && e.state !== S.HUNTING && e.state !== S.CAUTIOUS && e.rng() < (.16 + e.tr.CAUTION * 1.5) * (e.pack ? .45 : 1) * (sd < 300 ? .35 : 1)) { beginCautious(eng, e, seen); return; }
    if (e.state !== S.HUNTING && e.state !== S.STALKING && e.state !== S.CAUTIOUS) {
      if (!gazed && (seen.light || runner || near || (hungry && e.tr.AGGRESSION > .7 && seen.aw > .8 && sd < 700))) { beginHunt(eng, e, seen, seen.light ? 'identified human with visible light' : runner ? 'saw-run' : 'saw-near'); return; }
      setState(e, S.STALKING, gazed ? 'stare' : ''); setTarget(e, seen.id, now); e.stalkFor = 0; e.mood.excitement = Math.min(1, e.mood.excitement + .3); return;
    }
    if (e.state === S.STALKING && (seen.light || runner || near) && (runner || !gazed || sd < 135)) { beginHunt(eng, e, seen, runner ? 'stalk-run-commit' : 'stalk-spot'); return; }
    if (e.state === S.HUNTING && e.target !== seen.id) { const cur = e.mem.p.get(e.target); if ((!cur || !cur.seen) && hMaySwitch(e, seen, now)) { setTarget(e, seen.id, now); e.dbg.retarget = 'current prey lost; another human directly identified'; } }
    return;
  }
  if (!e.seenNow.size) e.grpN = 0;
  // heard something new
  const h = e.hear;
  if (h && h.t > (e.lastHearT || -1)) {
    e.lastHearT = h.t;
    const isEnt = h.src < 0;
    if (isEnt && h.type === 'growl' && e.state !== S.HUNTING && e.state !== S.FEEDING && e.state !== S.PLAYING) {           // existing audible growl response only: no target/memory transfer
      if (e.rng() < .55 + e.tr.SOCIAL * .4) { beginSearch(eng, e, null, 'sound'); e.search.goal = { x: h.x, y: h.y, k: 'sound' }; e.search.first = false; setAct(e, ''); }
      return;
    }
    if (isEnt) return;
    if (h.attribution === 'anonymous') {
      const L = bestAnonLead(e, now, 'sound'), cur = e.mem.p.get(e.target);
      const weak = h.I <= .12, recentSight = cur && (cur.seen || now - cur.seenAt < 1.2);
      if (!weak && !recentSight && L) hLightStart(eng, e, L);
      e.dbg.retarget = recentSight ? 'keep visual prey; unrelated anonymous sound' : 'heard anonymous sound; no person identified';
      return;
    }
    const r = e.mem.p.get(h.src); if (!r) return;
    const loud = h.I > .5 || h.type === 'run' || h.type === 'slide' || h.type === 'vault';
    if (e.state === S.ROAMING || e.state === S.DORMANT || e.state === S.CURIOUS) {
      e.hLight = null;
      e.wake = 1; if (e.state === S.DORMANT) setState(e, S.ROAMING, ''); else setAct(e, '');
      if (loud && e.rng() < .55 + e.tr.AGGRESSION * .35) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(e, .35, .85) * (1.2 - e.tr.AGGRESSION * .5), rid: h.src, toward: { x: h.x, y: h.y } }; }
      else if (h.I > .12) { setState(e, S.CURIOUS, 'freeze'); e.cur = { until: now + rand(e, .6, 1.5), toward: { x: h.x, y: h.y }, n: 0, rid: h.src }; }
    } else if ((e.state === S.SEARCHING || e.state === S.FRUSTRATED) && loud && r.conf > .2 && dist(e.x, e.y, h.x, h.y) < 1000 && (!e.search || !e.search.rid || e.search.rid === r.id || !e.mem.p.get(e.search.rid)?.conf)) {
      beginHunt(eng, e, r, 'heard-run'); e.dbg.reacquired = (e.dbg.reacquired || 0) + 1;                       // it heard the prey running: no new detection needed
    } else if (e.state === S.SEARCHING || e.state === S.FRUSTRATED) {
      if (h.I > .1) { const s = e.search; if (e.state === S.FRUSTRATED) beginSearch(eng, e, r, 'sound'); else { e.search.why = 'sound'; } e.search.goal = { x: h.x, y: h.y }; e.search.phase = 'go'; e.search.until = Math.max(e.search.until, now + 10); setAct(e, ''); if (loud && r.st === 2) beginHunt(eng, e, r, 'heard-run'); }
    } else if (e.state === S.STALKING && h.type === 'run' && (!current?.seen || r.id === e.target) && hMaySwitch(e, r, now)) { beginHunt(eng, e, r, 'stalk-heard-run'); }
    else if (e.state === S.HUNTING && !e.mem.p.get(e.target)?.seen) { if (r.id !== e.target && r.conf > .35 && loud && hMaySwitch(e, r, now) && (!current || now - current.hLoud > 1.2)) { setTarget(e, r.id, now); e.dbg.retarget = 'prey lost and its trail quiet; fresh loud sound elsewhere'; } }
  }
  if (!e.cap && !e.commit) hLightStart(eng, e);
}

/* the main per-tick behaviour */
function houndTick(eng, e, dt, thinkNow) {
  const now = eng.now, before = e.state;
  e.cool.lunge = Math.max(0, (e.cool.lunge || 0) - dt);
  if (e.commit && commitTick(eng, e, dt)) return null;               // committed to a kill: nothing else happens until it is over
  if (thinkNow) hReact(eng, e);
  let res = null;
  switch (e.state) {
    case S.ROAMING: case S.DORMANT: hRoam(eng, e, dt); break;
    case S.CURIOUS: {
      if (e.hLight) { hLightStep(eng, e, dt); break; }
      stopMoving(eng, e, dt); const c = e.cur; if (!c) { setState(e, S.ROAMING); break; }
      faceToward(e, c.toward.x, c.toward.y, dt, 3.5); e.head = Math.sin(e.t * 5) * .15;
      if (e.hear && e.hear.t > c.until - 1.5 && e.hear.t > (c.seenT || 0) && e.hear.src >= 0) { c.seenT = e.hear.t; c.n++; if (c.n >= 1 && e.hear.I > .2) { setState(e, S.ALERT, 'freeze'); e.alert = { until: now + rand(e, .3, .7), rid: e.hear.src, toward: { x: e.hear.x, y: e.hear.y } }; break; } }
      if (now > c.until) { const r = e.mem.p.get(c.rid); if (r && e.rng() < .45 + e.tr.CURIOSITY * .5) beginSearch(eng, e, r, 'sound'); else { setState(e, S.ROAMING); e.roam.goal = null; } }
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
        if (lastRun && e.rng() < .35 + e.tr.AGGRESSION * .55) { beginHunt(eng, e, r, 'alert-run'); break; }
        if (e.rng() < .35 + e.tr.PATIENCE * .3 && !noisy) { setState(e, S.STALKING, ''); setTarget(e, r.id, now); e.stalkFor = 0; break; }
        beginSearch(eng, e, r, 'sound'); e.search.goal = { x: a.toward.x, y: a.toward.y }; e.search.first = false; setAct(e, '');
      }
      break;
    }
    case S.STALKING: hStalk(eng, e, dt, thinkNow); break;
    case S.HUNTING: res = hHunt(eng, e, dt, thinkNow); break;
    case S.SEARCHING: hSearch(eng, e, dt, thinkNow); break;
    case S.FRUSTRATED: {                                                  // snarls and paces, then sweeps a wider area or gives up
      const f = e.frus || { until: now }; e.speed = approach(e.speed, 0, 1200 * dt);
      e.ang += Math.sin(e.t * 3.1) * dt * 2.2; e.head = Math.sin(e.t * 6) * .45; if (e.rng() < dt * .35) houndGrowl(eng, e, .5, 'snarl');
      if (now > f.until) { const r = e.mem.p.get(e.search && e.search.rid); if (r && !e.search.exhausted && r.conf > .1 && e.rng() < e.tr.PERSISTENCE * .55) { beginSearch(eng, e, r, 'lost'); e.search.until += 8; } else { setState(e, S.ROAMING); setTarget(e, 0, now); e.roam.goal = null; } }
      break;
    }
    case S.FEEDING: res = hFeed(eng, e, dt, thinkNow); break;
    case S.CAUTIOUS: hCautious(eng, e, dt, thinkNow); break;
    case S.EXCITED: hExcited(eng, e, dt, thinkNow); break;
    case S.RETREATING: hRetreat(eng, e, dt); break;
    case S.PLAYING: hPlay(eng, e, dt); break;
    default: setState(e, S.ROAMING);
  }
  if (e.hLight && e.state !== S.CURIOUS) { e.hLight = null; e.inv = null; }
  if (before !== e.state) e.dbg.hTransition = { from: before, to: e.state, at: +now.toFixed(2), why: hWhy(e) };
  return res;
}

/* FEEDING and guarding a body ------------------------------------------------------------------------------------------------- */
function beginFeed(eng, e, site) { setState(e, S.FEEDING, ''); e.feed = { site, until: eng.now + rand(e, 22, 48), at: false, guard: null }; }
function hFeed(eng, e, dt, thinkNow) {
  const F = e.feed; if (!F || eng.now > F.until) { if (F && F.site) F.site.fed++; setState(e, S.ROAMING); e.roam.goal = null; e.feed = null; return; }
  const s = F.site;
  if (F.guard) {                                                          // someone came for the body: hunt them, but stay near it
    const r = e.mem.p.get(F.guard);
    if (!r || (!r.seen && eng.now - r.seenAt > 3) || dist(e.x, e.y, s.x, s.y) > 520 + e.tr.TERRITORIALITY * 500) { F.guard = null; setAct(e, ''); return; }
    if (!tgtGone(eng, e, r)) { const P = hPerceived(eng, e, r); goTo(eng, e, P.x, P.y, { every: .4 }); /* (v23) where it believes the intruder is */ follow(eng, e, dt, hSpeed(e, 'chase', eng) * .9, { arrive: 10 }); for (const p of eng.nearPlayers(e.x, e.y, 50)) if (p.alive && !p.caught && dist(e.x, e.y, p.x, p.y) < e.r + 12) return { pv: p, dir: e.ang, speed: e.speed }; }
    else F.guard = null;
    return;
  }
  if (!F.at) { goTo(eng, e, s.x, s.y, { every: 1.4 }); const st = follow(eng, e, dt, hSpeed(e, 'investigate', eng), { arrive: 34 }); if (dist(e.x, e.y, s.x, s.y) < 60 || st === 'arrived') { F.at = true; setAct(e, 'feed'); } return; }
  if (e.act !== 'feed') setAct(e, 'feed');
  stopMoving(eng, e, dt); faceToward(e, s.x, s.y, dt, 2); e.head = Math.sin(e.t * 7) * .18;
  if (thinkNow) for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = r?.visual; if (pv && pv.alive && !pv.caught && r.dist < 620 && r.aw > .5) { F.guard = id; setTarget(e, id, eng.now); houndGrowl(eng, e, .8, 'guard'); setAct(e, 'guard'); break; } }
  if (thinkNow && !F.guard && e.hear && e.hear.I > .5 && e.hear.src > 0 && eng.now - e.hear.t < .3 && dist(e.hear.x, e.hear.y, s.x, s.y) < 900) { const r = e.mem.p.get(e.hear.src); if (r) { F.guard = r.id; e.target = r.id; setAct(e, 'guard'); } }
}
/* EXCITED: right after a kill, when nobody else is close: worked up, pacing around the body, snarling - then it settles down to feed */
function beginExcited(eng, e, site) { setState(e, S.EXCITED, 'pace'); e.exc = { site, until: eng.now + rand(e, 1.6, 3.6), dir: e.rng() < .5 ? 1 : -1, r: rand(e, 62, 96) }; }
function hExcited(eng, e, dt, thinkNow) {
  const X = e.exc; if (!X || eng.now > X.until) { setState(e, S.ROAMING); if (X && X.site && e.tr.HUNGER > .3) beginFeed(eng, e, X.site); else e.roam.goal = null; return; }
  const a = Math.atan2(e.y - X.site.y, e.x - X.site.x) + X.dir * dt * 1.15, tx = X.site.x + Math.cos(a) * X.r, ty = X.site.y + Math.sin(a) * X.r;
  if (eng.geo.clear(tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, 100, dt, { turnMul: 1.7, noSlow: true }); else stopMoving(eng, e, dt);
  e.head = Math.sin(e.t * 6.5) * .5; if (e.rng() < dt * .45) houndGrowl(eng, e, .55, 'snarl');
}

/* CAUTIOUS: several people together are more than a hound wants to take on.  It holds off at a distance, watching and circling, and
 * waits for one of them to be alone, to run, or to fall behind - or gives up and drifts away. */
function beginCautious(eng, e, r) { setState(e, S.CAUTIOUS, 'stare'); e.caut = { until: eng.now + rand(e, 5, 11), rid: r.id, dir: e.rng() < .5 ? 1 : -1, last: { x: r.lkx, y: r.lky }, lostT: 0 }; e.target = r.id; }
function hCautious(eng, e, dt, thinkNow) {
  const C = e.caut;
  if (!C || eng.now > C.until) {                                                                                                // it has watched long enough: commit, or withdraw
    e.caut = null; const r = C && e.mem.p.get(C.rid);
    if (r && r.conf > .3 && e.rng() < clamp(e.tr.AGGRESSION * .6 + e.tr.HUNGER * .3 - e.tr.CAUTION * .5, .2, .85)) { beginHunt(eng, e, r, 'caut-timeout'); return; }
    if (C) { beginRetreat(eng, e, C.last, rand(e, 8, 14)); return; }
    setState(e, S.ROAMING); e.roam.goal = null; return;
  }
  const seen = []; for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r.seen && r.hv) seen.push(r.hv); }
  if (seen.length) {
    let cx = 0, cy = 0; for (const p of seen) { cx += p.x; cy += p.y; } C.last = { x: cx / seen.length, y: cy / seen.length }; C.lostT = 0;
    if (thinkNow) {
      const runner = seen.find(p => p.st === 2 || p.st === 5 || p.ex), alone = seen.length === 1 || seen.every(p => dist(p.x, p.y, seen[0].x, seen[0].y) > 460);
      if (runner && e.rng() < .25 + e.tr.AGGRESSION * .5) { const r = rec(e, runner.id); beginHunt(eng, e, r, 'caut-run'); return; }
      if (alone && dist(e.x, e.y, seen[0].x, seen[0].y) < 720) { const r = rec(e, seen[0].id); if (e.rng() < .5 + e.tr.AGGRESSION * .4) { beginHunt(eng, e, r, 'caut-alone'); return; } }
    }
  } else { C.lostT += dt; if (C.lostT > 3) { const r = e.mem.p.get(C.rid); if (r) beginSearch(eng, e, r, 'lost'); else setState(e, S.ROAMING); return; } }
  const d = dist(e.x, e.y, C.last.x, C.last.y), away = Math.atan2(e.y - C.last.y, e.x - C.last.x);
  let tx, ty, v = 0;
  if (d < 470) { tx = e.x + Math.cos(away) * 90; ty = e.y + Math.sin(away) * 90; v = 110; }                                   // too close: back off
  else if (d > 680) { tx = e.x - Math.cos(away) * 90; ty = e.y - Math.sin(away) * 90; v = 96; }                                // drifted away: close up
  else { const a = away + C.dir * .5; tx = C.last.x + Math.cos(a) * d; ty = C.last.y + Math.sin(a) * d; v = 66; }             // circle at a distance
  if (eng.geo.clear(tx, ty, 21, 'walk') && eng.geo.lineClear(e.x, e.y, tx, ty, 21, 'walk')) steerTo(eng, e, tx, ty, v, dt, { turnMul: 1.4, noSlow: true }); else { stopMoving(eng, e, dt); if (e.rng() < dt * .6) C.dir = -C.dir; }
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
    const act = pickW(e.rng, [{ k: 'circle', w: 1.2 }, { k: 'stare', w: 1 + e.tr.SADISM }, { k: 'drag', w: cap.phase === 'crawl' ? .5 : 0 }, { k: 'back', w: .7 }]);
    cap.plan = { act, until: eng.now + rand(e, 1.3, 3.2), dir: e.rng() < .5 ? 1 : -1, r: rand(e, 95, 135) }; cap.plays++; setAct(e, act === 'back' ? 'back' : act === 'drag' ? 'drag' : act);
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
    const r = e.rng(), pk = .5 + e.tr.HUNGER * .3 + e.mood.frustration * .2, pr = .24 * (e.tr.SADISM + .35) * (cap.plays > 2 ? 1 : .4);
    return r < pk ? 'kill' : r < pk + pr ? 'release' : 'continue';
  },
  onInterrupt(eng, e, cap, pv, ctx, x) {
    const r = e.rng();
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
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; setState(e, S.HUNTING, ''); setTarget(e, pv.id, eng.now); e.chaseBlind = 0; e.cool.lunge = .3; e.dbg.resumed = (e.dbg.resumed || 0) + 1; houndGrowl(eng, e, .8); },
  onLetGo(eng, e, cap, pv) { setState(e, S.RETREATING, ''); beginRetreat(eng, e, { x: pv.x, y: pv.y }, rand(e, 8, 16)); },
  afterKill(eng, e, ctx, pv) {
    e.hEye = null; // a physically confirmed death ends this encounter's intimidation budget
    const th = ctx.threats.filter(t => t.cert >= .5), near = th.filter(t => t.approaching || t.dist < 600);
    e.mood.excitement = 1; houndGrowl(eng, e, .9, 'kill');
    const site = eng.sites[eng.sites.length - 1];
    if (near.length >= 2 && e.tr.CAUTION + (1 - e.tr.AGGRESSION) > .55) { beginRetreat(eng, e, { x: near[0].x, y: near[0].y }, rand(e, 6, 12)); return; }       // overwhelmed
    if (near.length) {                                                                                      // attack the next one, or defend the kill
      const t = near.slice().sort((a, b) => a.dist - b.dist)[0], r = rec(e, t.id); r.aw = 1; r.lkx = t.x; r.lky = t.y; r.conf = 1; r.seenAt = eng.now;
      if (e.tr.AGGRESSION > .55) { beginHunt(eng, e, r, 'next-victim'); return; }
      beginFeed(eng, e, site); e.feed.guard = t.id; setTarget(e, t.id, eng.now); setAct(e, 'guard'); return;
    }
    if (e.tr.HUNGER > .35) { if (e.rng() < .8) beginExcited(eng, e, site); else beginFeed(eng, e, site); } else { setState(e, S.STALKING, ''); const r = pickTarget(eng, e); if (r) { setTarget(e, r.id, eng.now); e.stalkFor = 0; } else setState(e, S.ROAMING); }
  },
};
/* Presentation-only look direction.  Keep it separate from e.head: e.head is part of the Hound's sensory FOV, while this value exists only so the
 * rendered skull can behave like an animal's head without changing what the AI can actually perceive.  Every source below is already legitimate
 * evidence owned by this Hound (current sampled sight, remembered location, anonymous lead, or fresh heard position). */
function hVisualLook(e) {
  let x = null, y = null;
  // During a lost-target search, the visible skull should reveal the current hypothesis: goal first, then the last observed heading while it
  // pauses/listens.  This is presentation-only and deliberately separate from e.head, which remains the sensory FOV.
  if (e.search && e.search.goal && Number.isFinite(e.search.goal.x)) { x = e.search.goal.x; y = e.search.goal.y; }
  else if (e.search && Number.isFinite(e.search.lookAng)) return clamp(angDiff(e.search.lookAng, e.ang), -1.18, 1.18);
  const r = e.target > 0 ? e.mem.p.get(e.target) : null;
  if (x === null && r) {
    if (r.seen && r.hv) { x = r.hv.x; y = r.hv.y; }
    else if (r.conf > .12 && Number.isFinite(r.lkx) && Number.isFinite(r.lky)) { x = r.lkx; y = r.lky; }
  }
  if (x === null && e.hLight && Number.isFinite(e.hLight.x)) { x = e.hLight.x; y = e.hLight.y; }
  if (x === null) return clamp(e.head || 0, -1.1, 1.1);
  return clamp(angDiff(Math.atan2(y - e.y, x - e.x), e.ang), -1.18, 1.18);
}
HOUND.tick = houndTick;
HOUND.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: HACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2), lh: +hVisualLook(e).toFixed(2), l: e.lunge ? +clamp((e.lunge.t - e.lunge.wind) / e.lunge.dur, -1, 1).toFixed(2) : -1, tg: e.target > 0 && (e.state === S.HUNTING || e.state === S.STALKING) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, k: e.pack || 0 });
