/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer (Trial 3): a patient, deceptive predator with hunger, stamina and its own plans
 * provides: KACT, SK, SKIN
 * uses: S, SCODE, clamp, follow, lerp, plan, rand, randomFloor, setAct, setState, setTarget, stopMoving
 * writes: -
 */

/* ---------------------------------------------------------------- SKIN-STEALER (Trial 3)
 * The third species: not a Hound with other numbers, not a Smiler.  An intelligent deceiver - cautious, patient, often choosing NOT to
 * engage - that predicts where people will go from what it has seen and heard (and can be wrong), wears a human look it has earned at a
 * kill, repeats lines of speech it really heard nearby, and kills only on a short committed pounce that physically lands.
 *   Design: dev/trial-3-skin-stealer/DESIGN_DECISIONS.md.  Numbers: SK below, every one PROPOSED, not owner-approved
 *   (dev/trial-3-skin-stealer/BALANCE_TABLE.md).
 * Evidence law (2C), unchanged: it acts on its own sight, hearing, light leads and memory, never on where an unsensed person really is.
 * Its hunger and stamina belong to the animal: no change of state or plan ever resets them.
 * Spawned only by the admin tools (sim.ai.js adminSpawn / sim.admin.js): never by the world reset or the director.
 * T1 (this checkpoint): the species, its numbers and its plumbing; it roams.  The decision brain arrives at T2/T3, the pounce at T4. */
const KACT = { '': 0, watch: 1, back: 2, leave: 3, wait: 4, lure: 5, intercept: 6, search: 7, listen: 8, approach: 9, creep: 10, chase: 11, wind: 12, pounce: 13, recover: 14, feed: 15, mimic: 16, rest: 17, pace: 18 };
/* the balance table (proposed; every value is named so it can be tested and tuned) */
const SK = Object.freeze({
  hungerAtSpawn: [.45, .65],                     // an admin spawn: a seeded value in this range (or the spawn's own hunger option)
  roamLeg: [500, 1600], roamPause: [1.5, 5], roamGiveUp: [12, 30],
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
    e.plan = null; e.enc = null; e.pounce = null; e.recover = 0; e.disguise = null; e.heard = []; e.said = 0;
    e.roam = { goal: null, until: 0, pause: 0 }; e.dbg.why = 'roaming';
  },
  /* the engine's hooks (ai.engine.js): it never borrows a Hound's or a Smiler's own functions */
  onFar(eng, e) { e.plan = null; e.pounce = null; e.roam.goal = null; e.roam.pause = 0; setState(e, S.ROAMING, ''); e.dbg.why = 'nobody within reach: it waits where it is'; },
  onStuck(eng, e) { e.plan = null; e.roam.goal = null; e.dbg.why = 'stuck: the watchdog cleared its route'; },
  onClear(eng, e) { e.plan = null; e.target = null; e.roam.goal = null; setState(e, S.ROAMING, ''); },
  debugHunt(eng, e, r) { setTarget(e, r.id, eng.now); e.dbg.why = 'admin: it was given a record of you'; return 'GIVEN A RECORD OF YOU (real AI)'; },
  /* its own target scoring and commitment (ai.intelligence.js's debug asks for them; never the Smiler's sScore) */
  targetScore(eng, e, r) { const age = eng.now - Math.max(r.seenAt, r.heardAt); return r.aw * .8 + r.conf * .7 - Math.min(1, age / 30) * .3 + (r.seen ? .5 : 0) + (r.id === e.target ? .4 : 0); },
  dwell(e) { return 1.5 + e.tr.PATIENCE; },
  summon(eng, e, r, tx, ty) { e.roam.goal = { x: tx, y: ty }; plan(eng, e, tx, ty, { why: 'admin summon' }); e.roam.until = eng.now + 40; e.dbg.why = 'admin summon: it goes to look'; },
};
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
  follow(eng, e, dt, e.sp.speeds.roam, { arrive: 40 });
  if (Math.hypot(R.goal.x - e.x, R.goal.y - e.y) < 60) { R.goal = null; R.pause = rand(e, SK.roamPause[0], SK.roamPause[1]); }
  else if ((!e.path.length && e.pathAge > 2) || eng.now > R.until) R.goal = null;
}
function skinTick(eng, e, dt, thinkNow) {
  if (e.cap) { stopMoving(eng, e, dt); return null; }
  skRoam(eng, e, dt, thinkNow);
  return null;
}
/* the admin overlay's block (never a line of speech: only counts) */
function skDebug(eng, e) {
  return { hu: +e.hunger.toFixed(3), st: Math.round(e.stam), ex: e.exh ? 1 : 0, pl: e.plan ? e.plan.k : '', why: e.dbg.why || '', dg: e.disguise ? 1 : 0, hd: e.heard.length,
    rg: e.roam.goal ? [Math.round(e.roam.goal.x), Math.round(e.roam.goal.y)] : null };
}
SKIN.tick = skinTick;
SKIN.debug = skDebug;
SKIN.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: KACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2) });
