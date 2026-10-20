/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer (Trial 3): a patient, deceptive predator with hunger, stamina and its own plans
 * provides: KACT, SK, SKIN
 * uses: S, SCODE, clamp, directOk, directTo, facedBy, faceToward, follow, goTo, lerp, perc, plan, rand, randomFloor, setAct, setState,
 *       setTarget, stopMoving, tgtGone
 * writes: -
 */

/* ---------------------------------------------------------------- SKIN-STEALER (Trial 3)
 * The third species: not a Hound with other numbers, not a Smiler.  An intelligent deceiver - cautious, patient, often choosing NOT to
 * engage - that predicts where people will go from what it has seen and heard (and can be wrong), wears a human look it has earned at a
 * kill, repeats lines of speech it really heard nearby, and kills only on a short committed pounce that physically lands.
 *   Design: dev/trial-3-skin-stealer/DESIGN_DECISIONS.md.  Numbers: SK below, every one PROPOSED, not owner-approved
 *   (dev/trial-3-skin-stealer/BALANCE_TABLE.md).
 * Evidence law (2C), unchanged: it acts on its own sight, hearing, light leads and memory, never on where an unsensed person really is.
 *   The people it considers are the ones it sees now (e.seenNow: their bodies, their facing - eye contact is part of seeing someone) and
 *   the records it keeps (perc(): the body while seen, otherwise its own estimate).  The light on its own body it can feel
 *   (geo.lightLevel at its own position).  Nothing else.
 * THE ANIMAL (every tick, whatever it is doing; no state or plan ever resets either):
 *   hunger   0..1, rises slowly, falls while feeding.  Bands (labels only): satiated < .2 < mild < .4 < hungry < .6 < very hungry < .8 <
 *            starving.  It changes thresholds, effort and risk - never range, accuracy or knowledge.
 *   stamina  0..100, drained by running (and, from T4, by every pounce, hit or miss), regained walking or still; under SK.stamExh it is
 *            exhausted and can only walk until it is back over SK.stamBack.
 * PLANS (one at a time, e.plan; chosen on its 10 Hz think from what it perceives, kept unless something clearly better comes up):
 *   roam      no one in view: it wanders the dark, pausing to listen.
 *   watch     someone in view: it stands where it is and looks.  Long for a patient one; a real pause, often the whole encounter.
 *   retreat   someone has seen it (eye contact) or is coming at it: it backs out of their line of sight.
 *   approach  someone who is not watching it, and it is hungry: it comes closer under cover (darker, unseen cells cost less), creeping
 *             the last stretch; eye contact stops it.
 *   leave     it has decided not to engage: satiated, more than one of them, lit and watched, exhausted, or its time with this person is
 *             spent.  It goes 1200-2200 px away, into the dark and away from everyone it perceives, and leaves that person alone for a
 *             while (SK.cooldown).  Only somebody who walks into arm's reach of a hungry one is not left alone (T4).
 * ENCOUNTER BUDGET: the seconds it has spent on one person (watching, retreating, approaching) add up and are never refilled by a change
 *   of plan; when they run out it leaves.  So it never pins anyone at a doorway for ever.
 * Spawned only by the admin tools (sim.ai.js adminSpawn / sim.admin.js): never by the world reset or the director.
 * T2 (this checkpoint): the animal, its senses as the engine gives them, roam / watch / retreat / approach / leave and the budgets.
 * T3 adds lying in wait, prediction and interception; T4 the pounce and the kill. */
const KACT = { '': 0, watch: 1, back: 2, leave: 3, wait: 4, lure: 5, intercept: 6, search: 7, listen: 8, approach: 9, creep: 10, chase: 11, wind: 12, pounce: 13, recover: 14, feed: 15, mimic: 16, rest: 17, pace: 18 };
/* the balance table (proposed; every value is named so it can be tested and tuned) */
const SK = Object.freeze({
  hungerAtSpawn: [.45, .65],                     // an admin spawn: a seeded value in this range (or the spawn's own hunger option)
  hungerRate: .0016,                             // per second (about .1 a minute: satiated to hungry in about 4 minutes)
  band: [.2, .4, .6, .8],                        // satiated | mild | hungry | very hungry | starving
  stamExh: 8, stamBack: 40, stamLow: 25,         // exhausted under 8, itself again over 40; tired (fatigued speed) under 25
  drainRun: 14, runFrom: 150,                    // stamina per second at its run speed (pro rata), counted only over runFrom px/s
  regenWalk: 6, regenStill: 11,                  // stamina per second walking / standing
  roamLeg: [500, 1600], roamPause: [1.5, 5], roamGiveUp: [12, 30],
  watch: [2, 6],                                 // seconds it stands and looks (x .7 .. 1.3 with PATIENCE)
  near: 260,                                     // a person closer than this is too close to just watch
  exposed: .45,                                  // the light on its own body above which it counts itself exposed
  hide: [140, 520],                              // how far it backs off to be out of sight
  leave: [1200, 2200], leaveMax: 45,             // how far it goes when it leaves; the longest a departure lasts
  cooldown: [30, 60], cooldownStarving: 12,      // seconds it then leaves that person alone
  budgetEnc: [25, 45],                           // seconds with one person: 25 + 45 x hunger
  rethink: 1.3,                                  // a new plan must score this much better than the one it has (no dithering)
  retreatHold: 4,                                // seconds it stays where it hid before going about its business (T3: it lies in wait)
  approachStop: 150,                             // T2: it comes no closer than this (the pounce and the kill are T4's)
});
const SKIN = {
  name: 'SkinStealer', kind: 'skinstealer', initial: S.ROAMING, radius: 24, clearance: 21, vTop: 300, turnPenalty: .5, roamSpeed: 105,
  // a patient, cautious, clever animal: intelligence, patience and caution drive its plans; hunger is its own variable (e.hunger), not a trait
  traits: { INTELLIGENCE: .8, SADISM: .1, HUNGER: .6, PATIENCE: .75, CURIOSITY: .55, CAUTION: .7, TERRITORIALITY: .3, AGGRESSION: .45, PERSISTENCE: .45, SOCIAL: .1, HEARING: .7, VISION: .55, LIGHT_SENS: .5, MEMORY: .7 },
  jitter: .12,
  // one collider in every form: it cannot crawl, and a disguise never shrinks it (LogicZ does not exist; see DEFERRED.md)
  caps: { CAN_VAULT: true, VAULT_SPEED: .9, CAN_CROUCH: true, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: false, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.6, ACCELERATION: 760 },
  // not a dark-seer: a lightless person in the dark is seen only from close by, as the Hound sees
  vision: { range: 760, fov: 2.5, dark: false, gain: 2.6, floor: 90 },
  // run: 0.89 x a fresh sprint (285 px/s) - it loses a straight race to a rested runner and gains on a winded one (<= 219 px/s)
  speeds: { roam: 105, creep: 62, stalk: 90, disguise: 150, run: 255, fatigued: 180, follow: 105 },
  evidence: { sight: 3, sound: 1.5, light: 1.6 },               // (ai.intelligence.js evidenceWeights: its own, never the Smiler's)
  init(eng, e, opts) {
    const h = Number.isFinite(opts.hunger) ? opts.hunger : lerp(SK.hungerAtSpawn[0], SK.hungerAtSpawn[1], e.streams.personality());
    e.hunger = clamp(h, 0, 1); e.stam = 100; e.exh = false;
    e.plan = null; e.enc = null; e.left = new Map(); e.pounce = null; e.recover = 0; e.disguise = null; e.heard = []; e.said = 0;
    e.roam = { goal: null, until: 0, pause: 0 }; e.dbg.why = 'roaming'; e.dbg.decide = null;
  },
  /* the engine's hooks (ai.engine.js): it never borrows a Hound's or a Smiler's own functions */
  onFar(eng, e) { e.plan = null; e.pounce = null; e.roam.goal = null; e.roam.pause = 0; setState(e, S.ROAMING, ''); e.dbg.why = 'nobody within reach: it waits where it is'; },
  farTick(eng, e, dt) { skBody(eng, e, dt); },                  // far from everyone it stands still, and is still hungry
  onStuck(eng, e) { e.plan = null; e.roam.goal = null; e.dbg.why = 'stuck: the watchdog cleared its route'; },
  onClear(eng, e) { e.plan = null; e.target = null; e.enc = null; e.roam.goal = null; setState(e, S.ROAMING, ''); },
  debugHunt(eng, e, r) { e.left.delete(r.id); setTarget(e, r.id, eng.now); skBegin(eng, e, 'watch', r, 'admin: it was given a record of you'); return 'WATCHING YOU (real AI)'; },
  /* its own target scoring and commitment (ai.intelligence.js's debug asks for them; never the Smiler's sScore) */
  targetScore(eng, e, r) { const age = eng.now - Math.max(r.seenAt, r.heardAt); return r.aw * .8 + r.conf * .7 - Math.min(1, age / 30) * .3 + (r.seen ? .5 : 0) + (r.id === e.target ? .4 : 0); },
  dwell(e) { return 1.5 + e.tr.PATIENCE; },
  summon(eng, e, r, tx, ty) { e.plan = null; e.roam.goal = { x: tx, y: ty }; plan(eng, e, tx, ty, { why: 'admin summon' }); e.roam.until = eng.now + 40; e.roam.pause = 0; e.dbg.why = 'admin summon: it goes to look'; },
};
const skBand = h => h < SK.band[0] ? 'satiated' : h < SK.band[1] ? 'mild' : h < SK.band[2] ? 'hungry' : h < SK.band[3] ? 'very hungry' : 'starving';

/* ---- the animal: hunger and stamina, every tick, from what its body really did ---- */
function skBody(eng, e, dt) {
  e.hunger = clamp(e.hunger + SK.hungerRate * dt, 0, 1);
  const v = e.speed || 0;
  if (v > SK.runFrom) e.stam -= SK.drainRun * (v / e.sp.speeds.run) * dt;
  else e.stam += (v < 8 ? SK.regenStill : SK.regenWalk) * dt;
  e.stam = clamp(e.stam, 0, 100);
  if (!e.exh && e.stam < SK.stamExh) { e.exh = true; e.dbg.exh = eng.now; }
  else if (e.exh && e.stam >= SK.stamBack) e.exh = false;
}
/* the fastest it may go now: exhausted it walks, tired it runs slower */
const skCap = e => e.exh ? e.sp.speeds.roam : e.stam < SK.stamLow ? e.sp.speeds.fatigued : e.sp.speeds.run;
const skSpeed = (e, k) => Math.min(e.sp.speeds[k] || 100, skCap(e));

/* ---- what it perceives: the people it sees now, and where it believes a remembered one is ---- */
function skSeen(eng, e) {
  const out = [];
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r.seen && r.visual && !tgtGone(eng, e, r)) out.push(r); }
  return out.sort((a, b) => a.dist - b.dist || a.id - b.id);
}
/* eye contact: it sees them, and they are looking at it (their facing is part of seeing them) */
const skWatched = (eng, e, r) => !!(r && r.seen && facedBy(eng, e, eng.playerById(r.id), r));
/* the light on its own body (lamps, local failures and lights that reach it): felt, not seen */
const skLit = (eng, e) => eng.geo.lightLevel(e.x, e.y, eng.lightPlayers());

/* ---- plans ---- */
function skBegin(eng, e, k, r, why, extra) {
  const p = Object.assign({ k, pid: r ? r.id : 0, t0: eng.now, why }, extra || {});
  e.plan = p; e.dbg.why = why; e.path = []; e.goalKey = '';
  if (r) setTarget(e, r.id, eng.now);
  if (k === 'watch') { p.until = eng.now + rand(e, SK.watch[0], SK.watch[1]) * (.7 + .6 * e.tr.PATIENCE); setState(e, S.WATCHING, 'watch'); }
  else if (k === 'retreat') setState(e, S.RETREATING, 'back');
  else if (k === 'approach') setState(e, S.STALKING, 'approach');
  else if (k === 'leave') setState(e, S.DISAPPEARING, 'leave');
  return p;
}
/* the person's encounter: its spent seconds (real time, counted on its thinks; never refilled by a change of plan) */
function skEnc(eng, e, r, count) {
  if (!e.enc || e.enc.pid !== r.id) e.enc = { pid: r.id, t0: eng.now, at: eng.now, spent: 0 };
  if (count) e.enc.spent += Math.min(.5, eng.now - e.enc.at);
  e.enc.at = eng.now;
  return e.enc;
}
const skBudget = e => SK.budgetEnc[0] + SK.budgetEnc[1] * e.hunger;
/* leave them alone: a goal far away, in the dark, away from everyone it perceives; and a cooldown on that person */
function skLeave(eng, e, r, why) {
  const pos = [...e.mem.p.values()].filter(q => !tgtGone(eng, e, q) && eng.now - Math.max(q.seenAt, q.heardAt) < 20).map(q => perc(eng, e, q));
  let best = null, bs = -1e9;
  for (let k = 0; k < 8; k++) {
    const g = randomFloor(eng, e, SK.leave[0], SK.leave[1]); if (!g) continue;
    const dmin = pos.length ? Math.min(...pos.map(q => Math.hypot(q.x - g.x, q.y - g.y))) : 2000;
    const s = Math.min(dmin, 2200) - (eng.geo.lamp[eng.geo.cellAt(g.x, g.y)] || 0) * 600 + e.streams.search() * 120;
    if (s > bs) { bs = s; best = g; }
  }
  const P = skBegin(eng, e, 'leave', null, why, { until: eng.now + SK.leaveMax, goal: best });
  if (best) plan(eng, e, best.x, best.y, { why: 'leave' });
  if (r) e.left.set(r.id, eng.now + (e.hunger >= SK.band[3] ? SK.cooldownStarving : rand(e, SK.cooldown[0], SK.cooldown[1])));
  e.target = null; e.enc = null;
  return P;
}
/* a spot a short way off that the person (where it perceives them) cannot see: it backs out of their line of sight */
function skHideSpot(eng, e, from) {
  const geo = eng.geo; let best = null, bs = -1e9;
  for (let i = 0; i < 20; i++) {
    const a = e.ang + Math.PI + (i / 20 - .5) * Math.PI * 1.6 + (e.streams.search() - .5) * .2, want = lerp(SK.hide[0], SK.hide[1], e.streams.search());
    const d = Math.min(want, geo.ray(e.x, e.y, a, want + 30) - 30); if (d < 60) continue;
    const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
    if (!geo.clear(x, y, e.rc + 2, 'walk')) continue;
    const hidden = !geo.los(from.x, from.y, x, y), far = Math.hypot(x - from.x, y - from.y);
    const s = (hidden ? 1000 : 0) + Math.min(far, 900) * .4 - (geo.lamp[geo.cellAt(x, y)] || 0) * 300;
    if (s > bs) { bs = s; best = { x, y, hidden }; }
  }
  return best;
}
/* a route under cover: cells the person (as it perceives them) can see, and lit cells, cost more */
function skCover(eng, from) {
  const geo = eng.geo, memo = new Map();
  return j => {
    let c = memo.get(j); if (c !== undefined) return c;
    const x = geo.cx(j), y = geo.cy(j), d = Math.hypot(x - from.x, y - from.y);
    c = (geo.lamp[j] || 0) * 140 + (d < 700 && geo.los(from.x, from.y, x, y) ? 70 : 0);
    memo.set(j, c); return c;
  };
}

/* ---- the decision: what it does about the people it perceives (on its think, 10 Hz near) ---- */
function skDecide(eng, e) {
  const now = eng.now, P = e.plan;
  for (const [id, until] of e.left) if (until <= now || !eng.byId.has(id)) e.left.delete(id);
  if (P && P.k === 'leave' && now < P.until && !(P.goal && Math.hypot(P.goal.x - e.x, P.goal.y - e.y) < 80)) return;   // a departure is carried through
  if (P && P.k === 'leave') { e.plan = null; e.dbg.why = 'it left; it roams again'; }
  const all = skSeen(eng, e), seen = all.filter(r => !e.left.has(r.id));
  if (!seen.length) {
    const L = e.plan;
    if (L && L.pid && !all.some(r => r.id === L.pid)) {
      if (L.k === 'retreat' && (!L.arrived || now - L.arrived < SK.retreatHold)) return;                 // out of their sight, as it wanted: it waits a moment
      e.plan = null; e.target = null; e.dbg.why = L.k === 'retreat' ? 'out of sight: it goes about its business' : 'it lost sight of them';
    }
    return;
  }
  const r = seen[0], h = e.hunger, p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
  const enc = skEnc(eng, e, r, true), watched = skWatched(eng, e, r), lit = skLit(eng, e) > SK.exposed, crowd = seen.length;
  const spent = enc.spent / skBudget(e), T = e.tr, cur = e.plan && e.plan.pid === r.id ? e.plan.k : null;
  if (spent >= 1) { skLeave(eng, e, r, `its time with P${r.id} is spent (${Math.round(enc.spent)} s)`); return; }
  // what each option is worth now (seeded draws break near-ties: two Skin-Stealers in the same spot do not act alike)
  const W = {
    leave: (1 - h) * 1.1 + (crowd - 1) * .6 + (lit && watched ? .5 : 0) + (e.exh ? .7 : 0) + T.CAUTION * .2 + spent * 1.2 + (h < SK.band[0] ? .8 : 0),
    watch: cur === 'watch' && now > e.plan.until ? 0 : (d > SK.near ? .62 : .22) + T.PATIENCE * .3 - h * .4,
    retreat: watched && h >= SK.band[1] ? .45 + h * .6 + T.INTELLIGENCE * .2 : watched && d < SK.near ? .9 : 0,
    approach: h < .35 || e.exh ? 0 : (watched ? (h >= SK.band[3] ? .35 : 0) : 1) * (h * 1.6 - T.CAUTION * .25 + (lit ? -.1 : .25)),
  };
  if (cur === 'retreat' && e.plan.arrived && !watched) W.retreat = 0;                       // out of sight now: decide afresh
  for (const k in W) W[k] = Math.max(0, W[k] * (.92 + .16 * e.rng()));
  const best = Object.keys(W).sort((a, b) => W[b] - W[a] || a.localeCompare(b))[0];
  e.dbg.decide = { pid: r.id, d: Math.round(d), watched, lit, crowd, h: +h.toFixed(2), spent: +spent.toFixed(2), W: Object.fromEntries(Object.entries(W).map(([k, v]) => [k, +v.toFixed(2)])), best };
  if (cur && best !== cur && W[best] < (W[cur] || 0) * SK.rethink && !(cur === 'watch' && now > e.plan.until)) return;   // keep the plan unless something is clearly better
  if (best === cur) return;
  if (best === 'leave') skLeave(eng, e, r, h < SK.band[0] ? `not hungry: it leaves P${r.id} alone` : crowd > 1 ? `more than one of them (${crowd})` : e.exh ? 'exhausted' : lit && watched ? 'seen in the light' : `it decides against P${r.id}`);
  else if (best === 'watch') skBegin(eng, e, 'watch', r, `it watches P${r.id}`);
  else if (best === 'retreat') { const s = skHideSpot(eng, e, p); skBegin(eng, e, 'retreat', r, `seen by P${r.id}: it backs out of sight`, { spot: s }); if (s) plan(eng, e, s.x, s.y, { why: 'retreat' }); }
  else if (best === 'approach') skBegin(eng, e, 'approach', r, `P${r.id} is not watching: it comes closer`);
}
/* ---- carrying a plan out (every tick) ---- */
function skAct(eng, e, dt, thinkNow) {
  const P = e.plan, now = eng.now;
  if (!P) { skRoam(eng, e, dt, thinkNow); return; }
  const r = P.pid ? e.mem.p.get(P.pid) : null;
  switch (P.k) {
    case 'watch': {
      stopMoving(eng, e, dt);
      if (r) { const p = perc(eng, e, r); faceToward(e, p.x, p.y, dt, 2.2); }
      if (e.act !== 'watch') setAct(e, 'watch');
      return;
    }
    case 'retreat': {
      const s = P.spot;
      if (!s || P.arrived) { stopMoving(eng, e, dt); if (r) { const p = perc(eng, e, r); faceToward(e, p.x, p.y, dt, 1.8); } return; }
      follow(eng, e, dt, skSpeed(e, r && r.seen && r.dist < SK.near ? 'run' : 'stalk'), { arrive: 30 });
      if (Math.hypot(s.x - e.x, s.y - e.y) < 40 || (!e.path.length && e.pathAge > 1)) { P.arrived = now; e.dbg.why = 'out of sight: it waits and listens'; setAct(e, 'listen'); }
      return;
    }
    case 'approach': {
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < SK.approachStop) { stopMoving(eng, e, dt); faceToward(e, p.x, p.y, dt, 3); if (e.act !== 'creep') setAct(e, 'creep'); return; }
      if (thinkNow && (now - (P.planT || -9) > 1.5 || !e.path.length)) {
        P.planT = now;
        if (directOk(eng, e, p.x, p.y, 420)) directTo(eng, e, p.x, p.y);
        else plan(eng, e, p.x, p.y, { why: 'approach under cover', cost: skCover(eng, p), maxNodes: 3000 });
      }
      const creep = d < 420;
      setAct(e, creep ? 'creep' : 'approach');
      follow(eng, e, dt, skSpeed(e, creep ? 'creep' : 'stalk'), { arrive: SK.approachStop - 10 });
      return;
    }
    case 'leave': {
      if (!P.goal) { e.plan = null; return; }
      if (thinkNow && !e.path.length && e.pathAge > 2) plan(eng, e, P.goal.x, P.goal.y, { why: 'leave' });
      follow(eng, e, dt, skSpeed(e, 'roam'), { arrive: 60 });
      return;
    }
  }
  e.plan = null;
}
/* where it wanders to: open floor some way off, the darker of a few candidates (the level's own lamp field: static knowledge, no person in it) */
function skDarkFloor(eng, e) {
  let best = null, bl = 2;
  for (let k = 0; k < 6; k++) {
    const g = randomFloor(eng, e, SK.roamLeg[0], SK.roamLeg[1]); if (!g) continue;
    const l = eng.geo.lamp[eng.geo.cellAt(g.x, g.y)] || 0; if (l < bl) { bl = l; best = g; }
  }
  return best;
}
function skRoam(eng, e, dt, thinkNow) {
  const R = e.roam;
  if (e.state !== S.ROAMING) setState(e, S.ROAMING, '');
  if (R.pause > 0) { R.pause -= dt; stopMoving(eng, e, dt); if (e.act !== 'listen') setAct(e, 'listen'); return; }
  if (e.act) setAct(e, '');
  if (!R.goal && thinkNow) { const g = skDarkFloor(eng, e); if (g) { R.goal = g; plan(eng, e, g.x, g.y, { why: 'roam' }); R.until = eng.now + rand(e, SK.roamGiveUp[0], SK.roamGiveUp[1]); e.dbg.why = 'roaming the dark'; } }
  if (!R.goal) { stopMoving(eng, e, dt); return; }
  if (thinkNow && !e.path.length && e.pathAge > 2) goTo(eng, e, R.goal.x, R.goal.y);
  follow(eng, e, dt, skSpeed(e, 'roam'), { arrive: 40 });
  if (Math.hypot(R.goal.x - e.x, R.goal.y - e.y) < 60) { R.goal = null; R.pause = rand(e, SK.roamPause[0], SK.roamPause[1]); }
  else if (eng.now > R.until) R.goal = null;
}
function skinTick(eng, e, dt, thinkNow) {
  skBody(eng, e, dt);
  if (e.cap) { stopMoving(eng, e, dt); return null; }
  if (thinkNow) skDecide(eng, e);
  skAct(eng, e, dt, thinkNow);
  return null;
}
/* the admin overlay's block (never a line of speech: only counts) */
function skDebug(eng, e) {
  const P = e.plan;
  return { hu: +e.hunger.toFixed(3), band: skBand(e.hunger), st: Math.round(e.stam), ex: e.exh ? 1 : 0, pl: P ? P.k : 'roam', pid: P ? P.pid : 0, why: e.dbg.why || '',
    enc: e.enc ? { pid: e.enc.pid, spent: +e.enc.spent.toFixed(1), budget: Math.round(skBudget(e)) } : null, left: [...e.left].map(([id, u]) => [id, +(u - eng.now).toFixed(1)]),
    dec: e.dbg.decide || null, dg: e.disguise ? 1 : 0, hd: e.heard.length, rg: e.roam.goal ? [Math.round(e.roam.goal.x), Math.round(e.roam.goal.y)] : null };
}
SKIN.tick = skinTick;
SKIN.debug = skDebug;
SKIN.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: KACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2) });
