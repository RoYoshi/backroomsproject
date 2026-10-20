/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer (Trial 3): a patient, deceptive predator with hunger, stamina and its own plans
 * provides: KACT, SK, SKIN
 * uses: S, SCODE, TAU, approach, clamp, commitTick, deriveSeed, directOk, directTo, facedBy, faceToward, follow, goTo, hearEvent, lerp,
 *       mkRng, moveCollide, perc, plan, rand, randomFloor, setAct, setState, setTarget, stopMoving, tgtGone
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
 *   the records it keeps (perc(): the body while seen, otherwise its own estimate; r.lkx / r.lvx: the last place and heading it saw or
 *   heard).  The light on its own body it can feel (geo.lightLevel at its own position).  The level's static shape (walls, junctions,
 *   lamps) it knows, as every creature here knows its home.  Nothing else.
 * THE ANIMAL (every tick, whatever it is doing; no state or plan ever resets either):
 *   hunger   0..1, rises slowly, falls while feeding.  Bands (labels only): satiated < .2 < mild < .4 < hungry < .6 < very hungry < .8 <
 *            starving.  It changes thresholds, effort and risk - never range, accuracy or knowledge.
 *   stamina  0..100, drained by running (and, from T4, by every pounce, hit or miss), regained walking or still; under SK.stamExh it is
 *            exhausted and can only walk until it is back over SK.stamBack.
 * PLANS (one at a time, e.plan; chosen on its 10 Hz think from what it perceives, kept unless something clearly better comes up):
 *   roam      no one in view: it wanders the dark, pausing to listen.
 *   watch     someone in view: it stands where it is and looks.  Long for a patient one; a real pause, often the whole encounter.
 *   retreat   someone has seen it (eye contact) or is coming at it: it backs out of their line of sight.  A hungry one backs off slowly,
 *             in view, toward a corner (the bait: it invites them to follow).
 *   approach  someone who is not watching it, and it is hungry: it comes closer under cover (darker, unseen cells cost less), creeping
 *             the last stretch; eye contact stops it.
 *   chase     a hungry one, close, whose person runs from it (or is exhausted): a short run, never long.  It gives up when the gap grows
 *             (a fresh runner on a straight wins), when its stamina runs low, or after SK.chaseMax.
 *   lure      out of their sight after a retreat: it waits beside the corner, facing the way they would come; footsteps coming nearer
 *             keep it there a little longer.  Nobody comes: the bait failed, it leaves.
 *   intercept they went out of its sight moving: from the last place and heading it has for them, along the level, it picks the
 *             junction they will reach and the way they will most likely take (a seeded error that INTELLIGENCE shrinks and starvation
 *             grows), goes round by a way that keeps off their trail, and waits beside that exit.  It can be wrong: it never looks at
 *             where they really went.  Footsteps heard on the way can correct it once.
 *   search    it goes quietly to where it last knew someone (or heard something), listens, and gives up.
 *   leave     it has decided not to engage: satiated, more than one of them, lit and watched, exhausted, it lost a race, a guess or a
 *             bait failed, or its time with this person is spent.  It goes 1200-2200 px away, into the dark and away from everyone it
 *             perceives, and leaves that person alone for a while (SK.cooldown).  Only somebody who walks into arm's reach of a hungry
 *             one is not left alone (T4).
 * ENCOUNTER BUDGET: the seconds it has spent on one person (watching, retreating, approaching, chasing, luring, intercepting, searching)
 *   add up and are never refilled by a change of plan; when they run out it leaves.  So it never pins anyone at a doorway for ever.
 * Spawned only by the admin tools (sim.ai.js adminSpawn / sim.admin.js): never by the world reset or the director.
 * T2: the animal, its senses as the engine gives them, roam / watch / retreat / approach / leave and the budgets.
 * T3: lying in wait (the bait), prediction and interception, a short chase, searching, hearing.
 * T4 (this checkpoint): THE STRIKE.  From approach, chase, lure, interception or search, with the person in sight 55-185 px away, a
 *   clear line and the stamina for it, it springs: a crouched wind-up (SK.pounceWind) aimed where it believes they will be when it
 *   lands (their seen motion, a seeded error that INTELLIGENCE shrinks), then a committed straight leap it cannot steer.  Every leap
 *   costs stamina, hit or miss.  It is lethal only on physical contact: a body its own body has reached, with nothing solid between
 *   (the one place it looks at where a person really is - contact is physics, not perception).  A miss leaves it standing, recovering,
 *   for about a second, and it cannot spring again for 2-3 s; a leap into a wall stuns it.  Anybody who walks into arm's reach of a
 *   hungry one is taken with a short grab.  The capture is always quick (it never plays with its prey); the kill is one of three
 *   (A a grip and a neck break; B the pounce carries them down and breaks the neck; C a hold and a bite at the neck), it stays on its
 *   kill for as long as the death plays on every screen (the shared commitment), then feeds beside the body.
 * T6: DECEPTION (DESIGN_DECISIONS.md D8, D9).
 *   Its ears for speech: a line a person says in a run reaches it only as the players' own nearby speech reaches a player - accepted by
 *     B++'s speech.js and W.A.R.D.'s text check, in its room, from a speaker within SK.hearSpeech (576 px) at that moment (the server's
 *     positions); never the menu lounge.  It keeps at most SK.heardMax lines for SK.heardTtl seconds (and none of a person who has left the
 *     room); it never logs them and the admin overlay shows only how many and how old.  A voice is also a sound: where it came from goes
 *     through the engine's own hearing (walls muffle it; it names nobody it has not seen) - talking near it can draw it.
 *   Its lines: from hiding while it lies in wait (very hungry), and when it stands staring in a borrowed skin - the opening words of a line it
 *     heard (lower case, sometimes its last word again: the echo is a little wrong), preferring the words of the person whose skin it
 *     wears, then anybody else's, then the person's own; with nothing heard, one of a few generic calls that claim no knowledge
 *     (SK_BAIT).  At most one every SK.sayGap seconds and SK.sayEnc an encounter; the server's own bucket limits it again.  It is said
 *     by the entity: B++'s speech.entitySay sends {t:'eheard', e, ...}, never a person's session id (server.js wires eng.voiceOut).
 *   Its skin: only at a kill it has made - G.I.B.'s aftermath hands the engine the victim's validated look (hat, texture, hands, main;
 *     never a name, a light, an item or an id) when that death ends - and only if it then feeds for SK.skinFeed seconds (disturbed
 *     sooner, the skin is left behind).  It wears it for SK.disguiseTime: on screen an ordinary wanderer with nothing in its hands, no
 *     name, stiff arms, a slightly slow walk (150 px/s) and long stares.  In it, it does not hide when seen: it walks up openly, stands
 *     and stares, may speak, then walks on - or, hungry, comes closer and springs from SK.mingleStrike.  The skin drops at its
 *     wind-up, when it breaks into a run, when its time is up; it is gone with the entity and with a world reset.  The same collider in
 *     every form (no crawlspace; LogicZ does not exist).  No light, no item, no corpse is ever touched (CAPABILITY_MATRIX.md §6). */
const KACT = { '': 0, watch: 1, back: 2, leave: 3, wait: 4, lure: 5, intercept: 6, search: 7, listen: 8, approach: 9, creep: 10, chase: 11, wind: 12, pounce: 13, recover: 14, feed: 15, mimic: 16, rest: 17, pace: 18 };
/* the balance table (proposed; every value is named so it can be tested and tuned) */
const SK = Object.freeze({
  hungerAtSpawn: [.45, .65],                     // an admin spawn: a seeded value in this range (or the spawn's own hunger option)
  hungerRate: .0016,                             // per second (about .1 a minute: satiated to hungry in about 4 minutes)
  band: [.2, .4, .6, .8],                        // satiated | mild | hungry | very hungry | starving
  stamExh: 8, stamBack: 40, stamLow: 25,         // exhausted under 8, itself again over 40; tired (fatigued speed) under 25
  drainRun: 14, runFrom: 200,                    // stamina per second at its run speed (pro rata), counted only over runFrom px/s (a long-legged
                                                 //  walk - shadowing somebody - is free; T3 had 150)
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
  retreatHold: 1,                                // seconds out of sight before it decides what next (lure, or go about its business)
  approachStop: 150,                             // T3: it comes no closer than this (the pounce and the kill are T4's)
  lure: [4, 12], lureMax: 22,                    // waiting round the corner: 4 + 12 x hunger x PATIENCE s; never longer than lureMax
  predictLook: 1500, predictTurns: 2,            // how far along their way it thinks ahead; how many turns it guesses
  predictMargin: .8,                             // seconds it wants to be there before them
  interceptMax: 26, interceptWait: [4, 9],       // the longest an interception lasts; how long it waits at the spot (x PATIENCE)
  searchMax: 16, searchLook: [2, 4],             // the longest a search lasts; how long it listens where it arrives
  heardFresh: 2.5, heardMin: .12,                // a sound this recent and this strong is worth going to look at
  chaseFrom: 420, chaseMax: 7, chaseLose: 140,   // it gives chase only from closer than this; for at most this long; it gives up when the gap
                                                 //  has grown this much beyond the closest it got
  pounceRange: [55, 185], pounceWind: .22,       // it springs from this close; the crouched wind-up before the leap (s)
  pounceSpeed: 430, pounceDur: .36,              // the leap: 1.5 x a fresh sprint, below the Hound's lunge; about 150 px
  pounceCost: 22, pounceCool: [2, 3],            // stamina per leap, hit or miss; seconds before it can spring again after a miss
  recoverMiss: [.9, 1.3], recoverWall: 1.1,      // seconds it stands recovering after a miss; after a leap into a wall
  grabReach: 46, grabWind: .12,                  // arm's reach (centre to centre) and the grab's wind-up
  killMeal: .35, feedRate: .03, feedTime: [18, 35],   // hunger a kill takes away; while feeding, per second; how long it feeds
  // T6: deception
  skinFeed: 8,                                   // seconds it must feed on its kill before it can wear that person's skin (disturbed sooner: none)
  disguiseTime: [240, 420],                      // how long a skin lasts on it (s)
  mingleStop: 170, mingleStrike: 120,            // in a skin it walks up openly to this far and stares; it springs only from this close
  stare: [3, 7],                                 // seconds it stands and stares (x .7 .. 1.3 with PATIENCE): the tell
  hearSpeech: 576,                               // it keeps a line only from a speaker this close (the players' own nearby-speech radius)
  heardMax: 4, heardTtl: 90, heardUses: 2,       // lines kept; seconds kept; times each may be repeated
  sayGap: [10, 18], sayEnc: 3, sayLure: 1.5,     // seconds between its lines; lines in one encounter; seconds into a wait before it calls
  sayWords: 6, echo: .35,                        // the most words it repeats; how often it repeats its last word again
});
/* (T6) the generic calls, used only when it has heard nothing it may repeat: none of them claims to know anything about anybody */
const SK_BAIT = Object.freeze(['hello?', 'is someone there?', 'over here', 'wait for me', 'can you help me?', "i'm lost", 'this way']);
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
  /* its kills (ai.capture.js): always quick, committed for its own death lengths (dphys.js DURS.SkinStealer), one of three */
  capture: {
    noPlay: true, commit: true, commitDur: { A: 3.2, B: 3.4, C: 3.5 },
    quick: () => 1,
    variants(eng, e, pv, ctx, attack) {
      const pounce = attack && attack.style === 'pounce' && (attack.speed || 0) > 250, winded = pv.ex || (pv.stamina != null && pv.stamina < 22);
      return [
        { k: 'A', w: pounce ? .5 : 1.6 },                                                     // a grip from close by, the neck broken
        { k: 'B', w: pounce ? 2.6 : .15 },                                                    // the leap carries them down, then the neck
        { k: 'C', w: .35 + (winded ? 1.9 : 0) + (ctx.deadEnd ? 1.4 : 0) + (e.hunger >= SK.band[3] ? 1.4 : 0) },   // held, a bite at the neck: a winded or cornered victim, a starving one
      ];
    },
    afterKill(eng, e, ctx, pv) { skFeedBegin(eng, e, pv); },
  },
  init(eng, e, opts) {
    const h = Number.isFinite(opts.hunger) ? opts.hunger : lerp(SK.hungerAtSpawn[0], SK.hungerAtSpawn[1], e.streams.personality());
    e.hunger = clamp(h, 0, 1); e.stam = 100; e.exh = false;
    e.plan = null; e.enc = null; e.left = new Map(); e.still = false; e.pounce = null; e.recover = 0; e.disguise = null; e.heard = []; e.said = 0;
    e.skin = null; e.sayNext = 0; e.mimicT = 0;                                                // (T6) a skin waiting for its meal; its next line
    e.sayRng = mkRng(deriveSeed(eng.seed, 'skinstealer-say', e.id));                           // (T6) its own stream: its words never move its other choices
    e.voice = { h: Math.round(lerp(-4, 2, e.sayRng())), s: Math.round(lerp(78, 92, e.sayRng())) };   // its voice (pitch, pace): slow and a little low
    e.roam = { goal: null, until: 0, pause: 0 }; e.dbg.why = 'roaming'; e.dbg.decide = null; e.dbg.predict = null; e.dbg.soundSeen = 0;
    e.tally = { lure: 0, lureCame: 0, intercept: 0, interceptCame: 0, chase: 0, chaseLost: 0, search: 0, searchFound: 0, pounce: 0, grab: 0, hit: 0, miss: 0, wall: 0, kills: 0,
      mingle: 0, say: 0, sayHeard: 0, sayBait: 0, skin: 0, skinLost: 0, reveal: 0 };   // its record (debug, tests, the balance report)
    e.pounceCool = 0;
  },
  /* the engine's hooks (ai.engine.js): it never borrows a Hound's or a Smiler's own functions */
  onFar(eng, e) {
    e.pounce = null; e.recover = 0; if (e.plan && e.plan.k === 'feed') return;                // feeding at its kill it carries on, alone
    e.plan = null; e.roam.goal = null; e.roam.pause = 0; setState(e, S.ROAMING, ''); e.dbg.why = 'nobody within reach: it waits where it is';
  },
  farTick(eng, e, dt) {                                           // far from everyone it stands still, and is still hungry (or still feeding)
    skBody(eng, e, dt);
    const P = e.plan; if (P && P.k === 'feed') { e.hunger = clamp(e.hunger - SK.feedRate * dt, 0, 1); P.fed = (P.fed || 0) + dt; if (eng.now > P.until || (e.hunger < .02 && P.fed >= SK.skinFeed)) { skDon(eng, e, P); e.plan = null; setState(e, S.ROAMING, ''); e.dbg.why = 'fed: it waits where it is'; } }
  },
  still(e) { return e.still; },                                  // (the engine's stuck watchdog: it held still this tick on purpose)
  onStuck(eng, e) { if (e.plan && e.plan.k !== 'lure') e.plan.stuck = (e.plan.stuck || 0) + 1; e.roam.goal = null; e.dbg.why = 'stuck: the watchdog cleared its route'; },
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
  if (e.pounce) { /* a leap is paid for at once (SK.pounceCost), not as running */ }
  else if (v > SK.runFrom) e.stam -= SK.drainRun * (v / e.sp.speeds.run) * dt;
  else e.stam += (v < 8 ? SK.regenStill : SK.regenWalk) * dt;
  e.stam = clamp(e.stam, 0, 100);
  if (!e.exh && e.stam < SK.stamExh) { e.exh = true; e.dbg.exh = eng.now; }
  else if (e.exh && e.stam >= SK.stamBack) e.exh = false;
  if (e.disguise && eng.now > e.disguise.until) skUndress(eng, e, 'its borrowed skin wore out');   // (T6)
}
/* it holds still on purpose: no route left behind (the engine's stuck watchdog would take a deliberate stop for being stuck) */
function skHold(eng, e, dt) { if (e.path.length) e.path = []; stopMoving(eng, e, dt); e.still = true; }
/* the fastest it may go now: exhausted it walks, tired it runs slower */
const skCap = e => e.exh ? e.sp.speeds.roam : e.stam < SK.stamLow ? e.sp.speeds.fatigued : e.sp.speeds.run;
const skSpeed = (e, k) => Math.min(e.sp.speeds[k] || 100, skCap(e), e.disguise ? e.sp.speeds.disguise : 1e9);   // (T6: in a skin, never faster than its walk)

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
/* each plan's state and act (the shared framework's states: what the client and the admin overlay read) */
const SK_STATE = { watch: [S.WATCHING, 'watch'], retreat: [S.RETREATING, 'back'], approach: [S.STALKING, 'approach'], chase: [S.HUNTING, 'chase'],
  lure: [S.CAUTIOUS, 'lure'], intercept: [S.STALKING, 'intercept'], search: [S.SEARCHING, 'search'], leave: [S.DISAPPEARING, 'leave'], feed: [S.FEEDING, 'feed'],
  mingle: [S.STALKING, 'pace'] };                                                              // (T6) in a borrowed skin, walking up openly
function skBegin(eng, e, k, r, why, extra) {
  const p = Object.assign({ k, pid: r ? r.id : 0, t0: eng.now, why }, extra || {});
  e.plan = p; e.dbg.why = why; e.path = []; e.goalKey = '';
  if (r) setTarget(e, r.id, eng.now);
  if (k === 'watch') p.until = eng.now + rand(e, SK.watch[0], SK.watch[1]) * (.7 + .6 * e.tr.PATIENCE);
  if (e.tally[k] !== undefined) e.tally[k]++;
  setState(e, SK_STATE[k][0], SK_STATE[k][1]);
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
/* a spot a short way off that the person (where it perceives them) cannot see: it backs out of their line of sight.  bait: a spot round
 * a corner - hidden from the person, from the way they would come after it, and from where it stands now - so that somebody who follows
 * comes round that corner close by; the nearest such spot.  Otherwise the farther the better. */
function skHideSpot(eng, e, from, bait) {
  const geo = eng.geo, line = bait ? [0, .5, .8, 1].map(k => ({ x: from.x + (e.x - from.x) * k, y: from.y + (e.y - from.y) * k })) : [from];
  let best = null, bs = -1e9;
  for (let i = 0; i < (bait ? 32 : 20); i++) {
    const a = e.ang + Math.PI + (i / (bait ? 32 : 20) - .5) * Math.PI * (bait ? 2 : 1.6) + (e.streams.search() - .5) * .2, want = lerp(SK.hide[0], SK.hide[1], e.streams.search());
    const d = Math.min(want, geo.ray(e.x, e.y, a, want + 30) - 30); if (d < 60) continue;
    const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
    if (!geo.clear(x, y, e.rc + 2, 'walk')) continue;
    const unseen = line.filter(q => !geo.los(q.x, q.y, x, y)).length, hidden = !geo.los(from.x, from.y, x, y), far = Math.hypot(x - from.x, y - from.y);
    const s = (hidden ? 1000 : 0) + (bait ? unseen * 300 - d * .8 : Math.min(far, 900) * .4) - (geo.lamp[geo.cellAt(x, y)] || 0) * 300;
    if (s > bs) { bs = s; best = { x, y, hidden, corner: bait && unseen === line.length }; }
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

/* ---- T3: lying in wait, prediction, interception, a short chase, searching; all from its own evidence ---- */
/* where it believes they are going, and where it can be first: from the last record (place and heading, seen or heard) it walks their
 * heading through the level; where something blocks the way it guesses which side they take (the turn that best keeps the heading, plus
 * a seeded error that INTELLIGENCE shrinks and starvation grows; at most SK.predictTurns guesses).  On that route it takes the first point
 * it can reach before them (their speed from the record, its own run speed, a rough path factor) and, beside it, a spot out of sight of
 * anybody coming along the route.  It can be wrong: it never looks at where they really went. */
function skPredict(eng, e, r) {
  const geo = eng.geo, sp = Math.hypot(r.lvx, r.lvy); if (sp < 40) return null;
  const walk = (x, y, a, d) => geo.lineClear(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, 16, 'walk');   // where a person can walk (sight passes over low walls; feet do not)
  let th = Math.atan2(r.lvy, r.lvx), x = r.lkx, y = r.lky, s = 0;
  const pts = [{ x, y, s: 0 }], turns = [];
  while (s < SK.predictLook) {
    if (!walk(x, y, th, 100)) {                                                  // something in the way: which side would they take?
      if (turns.length >= SK.predictTurns) break;
      let best = null, bs = -1e9, n = 0;
      for (let k = -4; k <= 4; k++) {
        if (!k) continue;
        const a = th + k * Math.PI / 8; if (!walk(x, y, a, 210)) continue;
        n++; const sc = Math.cos(k * Math.PI / 8) + (e.streams.search() - .5) * (1.35 - e.tr.INTELLIGENCE) * 1.6 * (e.hunger >= SK.band[3] ? 1.6 : 1);
        if (sc > bs) { bs = sc; best = a; }
      }
      if (best === null) break;                                                  // a dead end: they will have to come back this way
      turns.push({ x: Math.round(x), y: Math.round(y), a: +(((best % TAU) + TAU) % TAU).toFixed(2), n }); th = best;
    }
    x += Math.cos(th) * 48; y += Math.sin(th) * 48; s += 48; pts.push({ x, y, s });
  }
  if (pts.length < 5) return null;
  // the first point of that route it can be at before them: a quick estimate, then its own route there (at most four routes worked out)
  const age = eng.now - Math.max(r.seenAt, r.heardAt), v = clamp(sp, 90, 300), run = skSpeed(e, 'run');
  let q = null, tries = 0;
  for (const c of pts) {
    if (c.s < 160) continue;
    const left = c.s / v - age - SK.predictMargin;                               // the seconds before they are there
    if (Math.hypot(c.x - e.x, c.y - e.y) * 1.15 / run >= left) continue;
    if (++tries > 4) break;
    const way = geo.path(e.x, e.y, c.x, c.y, e.caps, { maxNodes: 3000 }); if (!way) continue;
    let L = 0, ax = e.x, ay = e.y; for (const w of way) { L += Math.hypot(w.x - ax, w.y - ay); ax = w.x; ay = w.y; }
    if (L / run < left) { q = c; break; }
  }
  if (!q) return null;                                                           // it cannot get ahead of them
  const back = pts[Math.max(0, pts.indexOf(q) - 4)];                             // where somebody coming along the route is just before
  let S0 = null, bs = -1e9;
  for (let k = 0; k < 16; k++) {                                                 // a spot beside that point, out of sight of the way they come
    const a = e.streams.search() * TAU, d = 40 + e.streams.search() * 140, sx = q.x + Math.cos(a) * d, sy = q.y + Math.sin(a) * d;
    if (!geo.clear(sx, sy, e.rc + 2, 'walk') || !geo.lineClear(q.x, q.y, sx, sy, e.rc, 'walk')) continue;
    const hidden = !geo.los(back.x, back.y, sx, sy), sc = (hidden ? 500 : 0) - d * .6 - (geo.lamp[geo.cellAt(sx, sy)] || 0) * 250;
    if (sc > bs) { bs = sc; S0 = { x: sx, y: sy, hidden }; }
  }
  if (!S0) { if (!geo.clear(q.x, q.y, e.rc + 2, 'walk')) return null; S0 = { x: q.x, y: q.y, hidden: false }; }
  return { x: S0.x, y: S0.y, hidden: S0.hidden, qx: q.x, qy: q.y, jx: back.x, jy: back.y, end: s < SK.predictLook && pts.length > 1, from: { x: r.lkx, y: r.lky },
    heading: +Math.atan2(r.lvy, r.lvx).toFixed(3), turns, options: turns.length ? turns[0].n : 1, lead: Math.round(q.s) };
}
/* a route that keeps off their own trail (from where it last knew them to the junction) when there is another way round */
function skAround(eng, from, to) {
  const geo = eng.geo, dx = to.x - from.x, dy = to.y - from.y, L2 = dx * dx + dy * dy || 1;
  return j => { const x = geo.cx(j), y = geo.cy(j), t = clamp(((x - from.x) * dx + (y - from.y) * dy) / L2, 0, 1), q = Math.hypot(x - from.x - dx * t, y - from.y - dy * t); return q < 110 ? 130 : 0; };
}
/* is somebody coming toward where it waits?  footsteps getting nearer, a lead closing in, a sighting - its own evidence only */
function skComing(eng, e, P) {
  const now = eng.now, r = P.pid ? e.mem.p.get(P.pid) : null;
  let near = 1e9;
  if (r && now - r.heardAt < 2.5) near = Math.min(near, Math.hypot(r.hx - e.x, r.hy - e.y));
  if (r && r.seen) near = Math.min(near, r.dist);
  for (const L of e.mem.leads) if (now - L.t < 2.5) near = Math.min(near, Math.hypot(L.x - e.x, L.y - e.y));
  if (e.hear && now - e.hear.t < 2.5) near = Math.min(near, Math.hypot(e.hear.x - e.x, e.hear.y - e.y));
  const was = P.near ?? 1e9; P.near = near;
  return near < 700 && near < was - 15;
}
/* somebody close by, heard (fresh footsteps or a noise: theirs, or a person's it cannot put a name to - another creature's never): where */
function skHeardNear(eng, e, r, within) {
  let best = null;
  if (r && eng.now - r.heardAt < .6) { const d = Math.hypot(r.hx - e.x, r.hy - e.y); if (d < within) best = { x: r.hx, y: r.hy, d }; }
  const H = e.hear;
  if (H && H.src !== -1 && eng.now - H.t < .6) { const d = Math.hypot(H.x - e.x, H.y - e.y); if (d < within && (!best || d < best.d)) best = { x: H.x, y: H.y, d }; }
  return best;
}
function skLure(eng, e, r, R) {
  const P = skBegin(eng, e, 'lure', r, `out of P${r.id}'s sight: it waits round the corner for them to follow`, { until: eng.now + SK.lure[0] + SK.lure[1] * e.hunger * e.tr.PATIENCE, bait: !!R.bait });
  P.face = R.from || { x: r.lkx, y: r.lky };                                                     // the corner it came round: where they would come from
}
function skIntercept(eng, e, r, g) {
  const P = skBegin(eng, e, 'intercept', r, `lost P${r.id}: it guesses their way (${g.turns.length ? g.turns.length + ' turn' + (g.turns.length > 1 ? 's' : '') : 'straight on'}) and goes round to meet them ${g.lead} px ahead`, { g, until: eng.now + SK.interceptMax, re: 0 });
  P.hAt = r.heardAt;
  plan(eng, e, g.x, g.y, { why: 'intercept', cost: skAround(eng, g.from, { x: g.qx, y: g.qy }), maxNodes: 4000 });
  e.dbg.predict = Object.assign({ at: +eng.now.toFixed(2), pid: r.id }, g);
}
function skSearch(eng, e, r, why, goal) {
  const G = goal || { x: r.lkx, y: r.lky };
  skBegin(eng, e, 'search', r, why, { goal: G, until: eng.now + SK.searchMax, hAt: r ? r.heardAt : 0 });
  plan(eng, e, G.x, G.y, { why: 'search' });
}
/* the plan's person is out of its sight */
function skLost(eng, e, P, r) {
  const now = eng.now, h = e.hunger;
  if (P.k === 'retreat' && (!P.arrived || now - P.arrived < SK.retreatHold)) return;          // still getting out of their sight
  if (P.k === 'retreat') {
    if (h >= SK.band[1] && !e.exh) { skLure(eng, e, r, P); return; }                     // out of their sight, as it wanted: it lies in wait
    e.plan = null; e.target = null; e.dbg.why = 'out of sight: it goes about its business'; return;
  }
  // they went out of sight moving: predict where they are going and try to be there first
  const moving = Math.hypot(r.lvx, r.lvy) > 60, fresh = now - Math.max(r.seenAt, r.heardAt) < 2.5;
  if (h >= SK.band[1] && !e.exh && moving && fresh) { const g = skPredict(eng, e, r); if (g) { skIntercept(eng, e, r, g); return; } }
  // otherwise a hungry one goes to look where it last knew them, briefly (stale evidence ends it); a less hungry one lets it go
  if (h >= SK.band[2] && !e.exh && r.conf > .3) { skSearch(eng, e, r, `lost P${r.id}: it goes to look where it last knew them`); return; }
  if (P.k === 'chase') { skLeave(eng, e, r, `lost P${r.id} in the chase; not worth a search`); return; }
  e.plan = null; e.target = null; e.dbg.why = 'it lost sight of them';
}
/* nobody in view: a fresh, real sound (footsteps, a door, a fall), or a light glimpsed, that it has not gone after yet */
function skListen(eng, e) {
  const now = eng.now, H = e.hear;
  if (H && now - H.t < SK.heardFresh && H.I >= SK.heardMin && H.id > e.dbg.soundSeen && !(H.pid && e.left.has(H.pid))) {
    e.dbg.soundSeen = H.id;
    const r = H.pid ? e.mem.p.get(H.pid) : null;
    skSearch(eng, e, r, `it heard ${H.type || 'something'}${r ? ' (P' + r.id + ')' : ''}: it goes quietly to look`, { x: H.x, y: H.y });
    return true;
  }
  return false;
}

/* ---- T4: the strike ---- */
const SK_STRIKE = { approach: 1, chase: 1, lure: 1, intercept: 1, search: 1, mingle: 1 };    // the plans it springs from (never while watching, retreating, leaving or feeding)
/* on its think: somebody in arm's reach of a hungry one is grabbed; somebody its plan is about, in sight 55-185 px away, it springs at */
function skStrike(eng, e) {
  if (e.exh || e.hunger < SK.band[1] || eng.now < e.pounceCool || e.commit || e.cap) return false;
  const geo = eng.geo;
  for (const pv of eng.nearPlayers(e.x, e.y, SK.grabReach)) {                    // arm's reach: contact is physics, not perception
    if (!pv.alive || pv.caught || !geo.lineClear(e.x, e.y, pv.x, pv.y, 3, 'walk')) continue;
    if (e.plan && e.plan.k === 'feed' && e.hunger < SK.band[2]) break;             // (a feeding one that has eaten does not)
    skSpring(eng, e, Math.atan2(pv.y - e.y, pv.x - e.x), pv.id, 'grab', `P${pv.id} came within its reach: it grabs`); return true;
  }
  const P = e.plan; if (!P || !P.pid || !SK_STRIKE[P.k] || e.stam < SK.pounceCost) return false;
  const r = e.mem.p.get(P.pid); if (!r || !r.seen || !r.visual || tgtGone(eng, e, r)) return false;
  const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d < SK.pounceRange[0] || d > (e.disguise ? SK.mingleStrike : SK.pounceRange[1])) return false;   // (T6: in a skin it waits until they are close)
  // only a leap that can reach them (from what it sees of their motion: moving away they get further during the wind-up and the leap),
  // aimed where it believes they will be at the moment it reaches them, with a seeded error that INTELLIGENCE shrinks
  const leapV = SK.pounceSpeed * .85, touch = e.r + 16, vr = d > 1 ? clamp(((p.x - e.x) * p.vx + (p.y - e.y) * p.vy) / d, -200, 300) : 0;
  if (d + vr * (SK.pounceWind + SK.pounceDur) - touch > leapV * SK.pounceDur) return false;
  const tc = SK.pounceWind + clamp((d + vr * SK.pounceWind - touch) / Math.max(60, leapV - vr), 0, SK.pounceDur), ax = p.x + p.vx * tc, ay = p.y + p.vy * tc;
  const err = (e.rng() - .5) * (1.2 - e.tr.INTELLIGENCE) * .5;
  if (!geo.lineClear(e.x, e.y, ax, ay, e.rc * .6, 'walk')) return false;          // never a leap into a wall it can see
  skSpring(eng, e, Math.atan2(ay - e.y, ax - e.x) + err, r.id, 'pounce', `it springs at P${r.id} (${Math.round(d)} px)`);
  return true;
}
function skSpring(eng, e, dir, tid, style, why) {
  const grab = style === 'grab';
  e.pounce = { t: 0, wind: grab ? SK.grabWind : SK.pounceWind, dur: grab ? .16 : SK.pounceDur, speed: grab ? 200 : SK.pounceSpeed, dir, tid, style, paid: false };
  e.tally[grab ? 'grab' : 'pounce']++; e.path = []; e.dbg.why = why; e.dbg.pounce = style;
  if (e.disguise) skUndress(eng, e, 'it drops the skin to spring');                      // (T6) the wind-up shows what it is
  setState(e, S.ATTACKING, 'wind');
}
/* the wind-up, the committed leap, the recovery; a hit returns the capture to the engine (ai.engine.js begins it) */
function skStrikeStep(eng, e, dt) {
  e.still = true;
  if (!e.pounce) {                                                                // recovering: it skids to a stop, then stands
    e.recover -= dt; e.speed = approach(e.speed, 0, 900 * dt); e.moved = e.speed > 1 ? moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt) : 0;
    if (e.recover <= 0) { e.recover = 0; const P = e.plan; if (P && SK_STATE[P.k]) setState(e, SK_STATE[P.k][0], SK_STATE[P.k][1]); else setState(e, S.ROAMING, ''); }
    return null;
  }
  const L = e.pounce; L.t += dt;
  if (L.t < L.wind) {                                                             // crouched, aimed: the tell
    const da = ((L.dir - e.ang + Math.PI * 3) % TAU) - Math.PI; e.ang = (e.ang + clamp(da, -12 * dt, 12 * dt) + TAU) % TAU;
    e.speed = approach(e.speed, 0, 1600 * dt); return null;
  }
  if (!L.paid) { L.paid = true; e.stam = Math.max(0, e.stam - SK.pounceCost); setAct(e, 'pounce'); }   // every leap costs, hit or miss
  const k = (L.t - L.wind) / L.dur, want = L.speed * (1 - .3 * k) * dt;
  e.ang = (L.dir + TAU) % TAU; e.speed = L.speed * (1 - .3 * k);
  e.moved = moveCollide(eng, e, Math.cos(L.dir) * want, Math.sin(L.dir) * want);
  for (const pv of eng.nearPlayers(e.x, e.y, e.r + 22)) {                         // contact: a body its own body has reached, nothing solid between
    if (!pv.alive || pv.caught || Math.hypot(pv.x - e.x, pv.y - e.y) >= e.r + 18 || !eng.geo.lineClear(e.x, e.y, pv.x, pv.y, 3, 'walk')) continue;
    e.pounce = null; e.recover = 0; e.tally.hit++; e.dbg.pounce = L.style + ': hit';
    e.plan = null; e.target = null; e.enc = null; e.dbg.why = `it has P${pv.id}`;           // its plan is over: the kill (the engine's capture) takes it from here
    return { pv, dir: L.dir, speed: e.speed, style: L.style };
  }
  if (e.moved < want * .4) { e.pounce = null; e.recover = SK.recoverWall; e.pounceCool = eng.now + rand(e, SK.pounceCool[0], SK.pounceCool[1]); setAct(e, 'recover'); e.tally.wall++; e.dbg.pounce = 'into a wall'; e.dbg.why = 'it leapt into a wall: stunned'; return null; }
  if (k >= 1) { e.pounce = null; e.recover = rand(e, SK.recoverMiss[0], SK.recoverMiss[1]); e.pounceCool = eng.now + rand(e, SK.pounceCool[0], SK.pounceCool[1]); setAct(e, 'recover'); e.tally.miss++; e.dbg.pounce = 'missed'; e.dbg.why = 'it missed: it recovers'; }
  return null;
}
/* after its kill (the commitment over): the meal, then it feeds beside the body for a while - it never moves the body */
function skFeedBegin(eng, e, pv) {
  e.hunger = clamp(e.hunger - SK.killMeal, 0, 1); e.tally.kills++;
  skBegin(eng, e, 'feed', null, 'it feeds at its kill', { until: eng.now + rand(e, SK.feedTime[0], SK.feedTime[1]), at: { x: pv.x, y: pv.y } });
  e.target = null; e.enc = null;
}

/* ---- T6: what it hears, what it says, the skin it earns ---- */
/* a line a person said near it (B++'s speech.js, accepted, through the engine's hearSpeech): kept for a while, and heard as a sound */
function skHearSpeech(eng, e, L) {
  if (!L || typeof L.text !== 'string' || !Number.isSafeInteger(L.id) || !Number.isFinite(L.x) || !Number.isFinite(L.y)) return false;
  if (Math.hypot(L.x - e.x, L.y - e.y) > SK.hearSpeech || e.commit) return false;
  const now = eng.now;
  e.heard = e.heard.filter(q => now - q.at < SK.heardTtl && !(q.pid === L.id && q.text === L.text));
  e.heard.push({ pid: L.id, text: L.text, at: now, uses: 0 }); while (e.heard.length > SK.heardMax) e.heard.shift();
  e.dbg.heardN = (e.dbg.heardN || 0) + 1;
  if (e.tier !== 'far') hearEvent(e, eng, { x: L.x, y: L.y, r: SK.hearSpeech, I: .6, type: 'voice', src: L.id, st: 1, vx: 0, vy: 0 });   // where a voice came from: a sound like any other
  return true;
}
/* the words it will say: the opening words of a line it heard (lower case; sometimes the last word again), or a generic call */
function skLine(eng, e, r) {
  const now = eng.now, from = e.disguise ? e.disguise.from : -1, rid = r ? r.id : -1;
  const H = e.heard.filter(q => now - q.at < SK.heardTtl && q.uses < SK.heardUses);
  const rank = q => (q.pid === from ? 3 : q.pid !== rid ? 2 : 1) * 1e6 + q.at;          // the skin's owner's words, then anybody else's, then their own
  H.sort((a, b) => rank(b) - rank(a));
  if (H.length) {
    const q = H[0]; q.uses++;
    const w = q.text.toLowerCase().replace(/[.!,;:]+$/u, '').split(' ').filter(Boolean).slice(0, SK.sayWords);
    if (w.length && e.sayRng() < SK.echo) { const last = w[w.length - 1], bare = last.replace(/[?!.]+$/u, ''); if (bare) { w[w.length - 1] = bare + '...'; w.push(bare + (/[?]$/u.test(last) ? '?' : '')); } }   // "wait for me... me"
    const text = Array.from(w.join(' ')).slice(0, 120).join('');
    if (text) return { text, o: q.pid, src: 'heard' };
  }
  return { text: SK_BAIT[Math.floor(e.sayRng() * SK_BAIT.length) % SK_BAIT.length], o: 0, src: 'bait' };
}
/* it speaks (never more often than SK.sayGap, never more than SK.sayEnc lines in one encounter): the engine hands the line to the server */
function skSay(eng, e, r, why) {
  const now = eng.now; if (now < e.sayNext) return false;
  const enc = r && e.enc && e.enc.pid === r.id ? e.enc : null; if (enc && (enc.said || 0) >= SK.sayEnc) return false;
  const L = skLine(eng, e, r);
  e.sayNext = now + lerp(SK.sayGap[0], SK.sayGap[1], e.sayRng()); if (enc) enc.said = (enc.said || 0) + 1;
  e.said++; e.tally.say++; e.tally[L.src === 'heard' ? 'sayHeard' : 'sayBait']++;
  e.dbg.said = { at: +now.toFixed(1), src: L.src, why, to: r ? r.id : 0 };              // (never the words themselves)
  e.mimicT = now + 1.6; setAct(e, 'mimic');
  if (eng.voiceOut) eng.voiceOut({ e: e.id, x: Math.round(e.x), y: Math.round(e.y), text: L.text, o: L.o, h: e.voice.h, s: e.voice.s });
  return true;
}
/* the skin of the person it has just killed (G.I.B.'s aftermath, through the engine's skinFrom, when that death ends): taken only if it
 * then feeds long enough.  Only the look's four drawn fields, re-checked here; never a name, a light, an item or an id */
const SK_LOOK = /^[a-z]{1,12}\|[a-z]{1,12}\|#[0-9a-fA-F]{6}\|#[0-9a-fA-F]{6}(\|[a-z]{0,12})?$/;
function skSkinFrom(eng, e, pid, look) {
  if (typeof look !== 'string' || !SK_LOOK.test(look) || !Number.isSafeInteger(pid)) return false;
  e.skin = { look: look.split('|').slice(0, 4).join('|'), pid, at: eng.now };
  return true;
}
function skDon(eng, e, P) {
  const K = e.skin; e.skin = null; if (!K) return;
  if (!P || (P.fed || 0) < SK.skinFeed) { e.tally.skinLost++; e.dbg.skin = 'left behind: its meal was cut short'; return; }
  e.disguise = { look: K.look, from: K.pid, t0: eng.now, until: eng.now + rand(e, SK.disguiseTime[0], SK.disguiseTime[1]) };
  e.tally.skin++; e.dbg.skin = `it wears P${K.pid}'s skin`; eng.note(`K#${e.id} wears the skin of P${K.pid}`);
}
function skUndress(eng, e, why) {
  if (!e.disguise) return; e.disguise = null; e.tally.reveal++; e.dbg.skin = why; eng.note(`K#${e.id} drops its disguise: ${why}`);
  if (e.plan && e.plan.k === 'mingle') { e.plan = null; e.dbg.why = why; }
}

/* ---- the decision: what it does about the people it perceives (on its think, 10 Hz near) ---- */
function skDecide(eng, e) {
  const now = eng.now, P = e.plan;
  for (const [id, until] of e.left) if (until <= now || !eng.byId.has(id)) e.left.delete(id);
  if (P && P.k === 'leave' && now < P.until && !(P.goal && Math.hypot(P.goal.x - e.x, P.goal.y - e.y) < 80)) return;   // a departure is carried through
  if (P && P.k === 'leave') { e.plan = null; e.dbg.why = 'it left; it roams again'; }
  const all = skSeen(eng, e), seen = all.filter(r => !e.left.has(r.id));
  if (e.heard.length) e.heard = e.heard.filter(q => now - q.at < SK.heardTtl && eng.byId.has(q.pid));   // (T6) lines expire; a person who left takes theirs
  if (P && P.k === 'feed') {                                                      // at its kill: fed, or disturbed (seen close, or watched), it goes
    const near = all.find(r => r.dist < 520 || skWatched(eng, e, r));
    if (near) { skDon(eng, e, P); skLeave(eng, e, null, `disturbed at its kill by P${near.id}`); return; }
    if (now > P.until || (e.hunger < .02 && (P.fed || 0) >= SK.skinFeed)) { skDon(eng, e, P); e.plan = null; e.dbg.why = 'fed: it roams again'; }   // (T6: a meal lasts at least SK.skinFeed: it takes its time with the body)
    return;
  }
  if (e.skin) { e.skin = null; e.tally.skinLost++; e.dbg.skin = 'left behind: it was not at its meal'; }   // (T6) a skin is only taken at the meal
  if (!seen.length) { skUnseen(eng, e); return; }
  const r = seen[0], h = e.hunger, p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
  const enc = skEnc(eng, e, r, true), watched = skWatched(eng, e, r), lit = skLit(eng, e) > SK.exposed, crowd = seen.length;
  const spent = enc.spent / skBudget(e), T = e.tr, cur = e.plan && e.plan.pid === r.id ? e.plan.k : null;
  const waiting = cur === 'lure' || (cur === 'intercept' && e.plan.arrived) || cur === 'search';
  if (waiting && e.plan.came === undefined && d < 320) { e.plan.came = now; if (cur === 'lure') e.tally.lureCame++; else if (cur === 'intercept') e.tally.interceptCame++; else e.tally.searchFound++; }
  if (spent >= 1) { skLeave(eng, e, r, `its time with P${r.id} is spent (${Math.round(enc.spent)} s)`); return; }
  // which way they are moving, relative to it (from what it sees): running from it, or coming at it
  // (fleeing: running from it, or hurrying off after meeting its eyes - somebody who simply walks on has not noticed it)
  if (watched) enc.eyes = now;
  const away = d > 1 ? ((p.x - e.x) * p.vx + (p.y - e.y) * p.vy) / d : 0, fleeing = away > 200 || (away > 110 && now - (enc.eyes ?? -99) < 4), winded = r.ex || r.stamina < 25;
  // (T6) in a borrowed skin it does not hide: it walks up like one of them; a hungry one drops the skin to run after somebody who flees
  if (e.disguise && crowd === 1) {
    if (fleeing && h >= SK.band[2] && !e.exh && e.stam >= SK.stamLow + 15 && d < SK.chaseFrom && cur !== 'chase') {
      skUndress(eng, e, `P${r.id} runs: it drops the skin to give chase`); skBegin(eng, e, 'chase', r, `P${r.id} runs: it gives chase`, { dmin: d }); return;
    }
    if (cur === 'mingle' || cur === 'chase') return;
    if (fleeing) { skLeave(eng, e, r, `P${r.id} hurries away: it lets them go`); return; }
    skBegin(eng, e, 'mingle', r, `in P${e.disguise.from}'s skin it walks up to P${r.id}`, { ph: 'walk' }); return;
  }
  // lying in wait and they are walking into it, unaware: it holds still (the ambush; T4 springs it)
  if (waiting && cur !== 'search' && !watched && !lit && away < -30 && d > SK.approachStop && crowd === 1) { e.dbg.why = `P${r.id} is coming its way, unaware: it holds still`; return; }
  // what each option is worth now (seeded draws break near-ties: two Skin-Stealers in the same spot do not act alike)
  const W = {
    leave: (1 - h) * 1.1 + (crowd - 1) * .6 + (lit && watched && !e.disguise ? .5 : 0) + (e.exh ? .7 : 0) + T.CAUTION * .2 + spent * 1.2 + (h < SK.band[0] ? .8 : 0),
    watch: cur === 'watch' && now > e.plan.until ? 0 : (d > SK.near ? .62 : .22) + T.PATIENCE * .3 - h * .4,
    retreat: e.disguise ? 0 : watched && h >= SK.band[1] ? .45 + h * .6 + T.INTELLIGENCE * .2 : watched && d < SK.near ? .9 : 0,   // (T6: in a skin, being looked at is the point)
    approach: h < .35 || e.exh ? 0 : (watched ? (h >= SK.band[3] ? .35 : 0) : fleeing ? .3 : 1) * (h * 1.6 - T.CAUTION * .25 + (lit ? -.1 : .25)),
    chase: cur === 'chase' ? (e.plan.lost ? 0 : 2) :                                       // a chase runs until its own rules end it (skAct)
      h < SK.band[2] || e.exh || e.stam < SK.stamLow + 15 || d > SK.chaseFrom || crowd > 1 || !(fleeing || winded) ? 0 : .55 + h * .9 + (winded ? .5 : 0) - T.CAUTION * .3,
  };
  if (cur === 'retreat' && e.plan.arrived && !watched) W.retreat = 0;                       // out of sight now: decide afresh
  for (const k in W) W[k] = Math.max(0, W[k] * (.92 + .16 * e.rng()));
  const best = Object.keys(W).sort((a, b) => W[b] - W[a] || a.localeCompare(b))[0];
  e.dbg.decide = { pid: r.id, d: Math.round(d), watched, lit, crowd, h: +h.toFixed(2), spent: +spent.toFixed(2), away: Math.round(away), W: Object.fromEntries(Object.entries(W).map(([k, v]) => [k, +v.toFixed(2)])), best };
  if (cur && best !== cur && W[best] < (W[cur] || 0) * SK.rethink && !(cur === 'watch' && now > e.plan.until)) return;   // keep the plan unless something is clearly better
  if (best === cur) return;
  if (best === 'leave') skLeave(eng, e, r, h < SK.band[0] ? `not hungry: it leaves P${r.id} alone` : crowd > 1 ? `more than one of them (${crowd})` : e.exh ? 'exhausted' : lit && watched ? 'seen in the light' : `it decides against P${r.id}`);
  else if (best === 'watch') skBegin(eng, e, 'watch', r, `it watches P${r.id}`);
  else if (best === 'retreat') {
    const bait = h >= SK.band[2] && d > SK.near && !e.exh, s = skHideSpot(eng, e, p, bait);
    skBegin(eng, e, 'retreat', r, bait ? `seen by P${r.id}: it backs away slowly, round a corner (inviting them to follow)` : `seen by P${r.id}: it backs out of sight`, { spot: s, bait, from: { x: e.x, y: e.y } });
    if (s) plan(eng, e, s.x, s.y, { why: 'retreat' });
  }
  else if (best === 'approach') skBegin(eng, e, 'approach', r, `P${r.id} is not watching: it comes closer`);
  else if (best === 'chase') skBegin(eng, e, 'chase', r, fleeing ? `P${r.id} runs: it gives chase` : `P${r.id} is winded: it closes in`, { dmin: d });
}
/* nobody it may consider is in view: its plan about somebody goes on without a sighting, or it decides what that loss means */
function skUnseen(eng, e) {
  const L = e.plan;
  if (L && L.pid) {
    const r = e.mem.p.get(L.pid);
    if (!r || tgtGone(eng, e, r) || e.left.has(L.pid)) { e.plan = null; e.target = null; e.dbg.why = 'it has nobody to go after'; return; }
    const enc = skEnc(eng, e, r, true);
    if (enc.spent >= skBudget(e)) { skLeave(eng, e, r, `its time with P${r.id} is spent (${Math.round(enc.spent)} s)`); return; }
    if (L.k === 'lure' || L.k === 'intercept' || L.k === 'search') return;        // these work without a sighting (skAct ends them)
    skLost(eng, e, L, r); return;
  }
  if (L && L.k === 'search') return;                                               // looking at a sound nobody has been named for
  if (!L && e.hunger >= SK.band[1] && !e.exh) skListen(eng, e);
}
/* ---- carrying a plan out (every tick) ---- */
function skAct(eng, e, dt, thinkNow) {
  const P = e.plan, now = eng.now;
  if (!P) { skRoam(eng, e, dt, thinkNow); return; }
  const r = P.pid ? e.mem.p.get(P.pid) : null;
  switch (P.k) {
    case 'watch': {
      skHold(eng, e, dt);
      if (r) { const p = perc(eng, e, r); faceToward(e, p.x, p.y, dt, 2.2); }
      if (e.act !== 'watch') setAct(e, 'watch');
      return;
    }
    case 'retreat': {
      const s = P.spot;
      if (!s || P.arrived) { skHold(eng, e, dt); if (r) { const p = perc(eng, e, r); faceToward(e, p.x, p.y, dt, 1.8); } return; }
      // the bait backs off slowly, still facing them; a frightened one turns and goes
      follow(eng, e, dt, skSpeed(e, P.bait ? 'stalk' : r && r.seen && r.dist < SK.near ? 'run' : 'stalk'), { arrive: 30 });
      if (Math.hypot(s.x - e.x, s.y - e.y) < 40 || (!e.path.length && e.pathAge > 1)) { P.arrived = now; e.dbg.why = P.bait ? 'round the corner: it waits for them' : 'out of sight: it waits and listens'; setAct(e, 'listen'); }
      return;
    }
    case 'approach': {
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < SK.approachStop && Math.hypot(p.vx, p.vy) < 40) { skHold(eng, e, dt); faceToward(e, p.x, p.y, dt, 3); if (e.act !== 'creep') setAct(e, 'creep'); return; }
      if (thinkNow && (now - (P.planT || -9) > 1.5 || !e.path.length)) {
        P.planT = now;
        if (directOk(eng, e, p.x, p.y, 420)) directTo(eng, e, p.x, p.y);
        else plan(eng, e, p.x, p.y, { why: 'approach under cover', cost: skCover(eng, p), maxNodes: 3000 });
      }
      // a still person it creeps up on; a moving one it shadows at their own pace (a little faster), so nobody simply walks away from it
      const creep = d < 420, pace = Math.hypot(p.vx, p.vy) > 40 ? clamp(Math.hypot(p.vx, p.vy) + 30, e.sp.speeds.creep, SK.runFrom) : 0;
      setAct(e, creep && !pace ? 'creep' : 'approach');
      follow(eng, e, dt, pace ? Math.min(pace, skCap(e)) : skSpeed(e, creep ? 'creep' : 'stalk'), { arrive: pace ? 60 : SK.approachStop - 10 });
      return;
    }
    case 'chase': {
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      P.dmin = Math.min(P.dmin, d);
      if (thinkNow) {
        // it stops when it is losing the race, when its breath gives out, or after a short run: a chase is a gamble, never a long pursuit
        const why = d > P.dmin + SK.chaseLose ? `it is losing the race with P${r.id} (${Math.round(d)} px, it was ${Math.round(P.dmin)})` : e.stam < SK.stamLow ? `out of breath chasing P${r.id}` : now - P.t0 > SK.chaseMax ? `P${r.id} has run long enough: it stops` : '';
        if (why) { P.lost = true; e.tally.chaseLost++; skLeave(eng, e, r, why); return; }
        if (now - (P.planT || -9) > .5 || !e.path.length) { P.planT = now; if (directOk(eng, e, p.x, p.y, 640)) directTo(eng, e, p.x, p.y); else plan(eng, e, p.x, p.y, { why: 'chase', maxNodes: 3000 }); }
      }
      setAct(e, 'chase');
      follow(eng, e, dt, skSpeed(e, 'run'), { arrive: 30 });                              // it runs on to them (the strike decides when it springs)
      return;
    }
    case 'lure': {
      skHold(eng, e, dt); if (P.face) faceToward(e, P.face.x, P.face.y, dt, 1.6);
      if (e.act !== 'lure' && !(e.act === 'mimic' && now < e.mimicT)) setAct(e, 'lure');
      if (thinkNow) {
        // (T6) very hungry, unseen, a moment into the wait: it calls out once - words it heard, or a generic call
        if (!P.spoke && now - P.t0 > SK.sayLure && e.hunger >= SK.band[2] && !(r && r.seen) && skSay(eng, e, r, 'from hiding')) P.spoke = now;
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.t0 + SK.lureMax); if (r && now - r.heardAt < 2.5) P.face = { x: r.hx, y: r.hy }; e.dbg.why = 'it hears them coming: it waits, ready'; }
        if (P.came === undefined && skHeardNear(eng, e, r, 320)) { P.came = now; e.tally.lureCame++; }
        if (now > P.until) { skLeave(eng, e, r, P.bait ? `P${P.pid} did not follow: the bait failed` : `nobody came: it gives up on P${P.pid}`); return; }
      }
      return;
    }
    case 'intercept': {
      if (!r) { e.plan = null; return; }
      const g = P.g;
      if (thinkNow && !P.arrived && r.heardAt > P.hAt + .3 && P.re < 1) {             // footsteps on the way: it corrects its guess, once
        P.hAt = r.heardAt; const g2 = skPredict(eng, e, r);
        if (g2 && Math.hypot(g2.x - g.x, g2.y - g.y) > 250) { P.re++; P.g = g2; e.dbg.predict = Object.assign({ at: +now.toFixed(2), pid: r.id, corrected: 1 }, g2); plan(eng, e, g2.x, g2.y, { why: 'intercept (heard)', cost: skAround(eng, g2.from, { x: g2.qx, y: g2.qy }), maxNodes: 4000 }); e.dbg.why = `it heard P${r.id}: it corrects its guess`; }
      }
      if (!P.arrived) {
        // a race to be there first: it runs (its stamina allowing), slowing for the last stretch to arrive quietly
        const last = Math.hypot(P.g.x - e.x, P.g.y - e.y) < 160 && e.path.length <= 1;
        if (thinkNow && !e.path.length && e.pathAge > 1.5) { P.stuck = (P.stuck || 0) + 1; plan(eng, e, P.g.x, P.g.y, { why: 'intercept' }); }
        setAct(e, 'intercept');
        follow(eng, e, dt, skSpeed(e, last ? 'stalk' : 'run'), { arrive: 30 });
        if (Math.hypot(P.g.x - e.x, P.g.y - e.y) < 44 || (P.stuck || 0) > 2 || now > P.until) {
          P.arrived = now; P.until = Math.min(P.until + 4, now + rand(e, SK.interceptWait[0], SK.interceptWait[1]) * (.7 + .6 * e.tr.PATIENCE));
          e.dbg.why = `in place: it waits for P${r.id} beside the way it guessed`;
        }
        return;
      }
      skHold(eng, e, dt); faceToward(e, P.g.jx, P.g.jy, dt, 1.6);
      if (e.act !== 'wait') setAct(e, 'wait');
      if (thinkNow) {
        const hn = skHeardNear(eng, e, r, 320);                                         // its guess was right: they are here, unseen (the dark)
        if (hn) {
          if (P.came === undefined) { P.came = now; e.tally.interceptCame++; }
          if (hn.d > (P.hmin ?? 1e9) + 60) { skSearch(eng, e, r, `P${r.id} passed close by, unseen: it follows the sound`, { x: hn.x, y: hn.y }); return; }
          P.hmin = Math.min(P.hmin ?? 1e9, hn.d);
        }
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.t0 + SK.interceptMax + 8); e.dbg.why = 'it hears them coming: it waits, ready'; }
        if (now > P.until) {
          e.dbg.wrong = (e.dbg.wrong || 0) + 1;
          if (e.hunger >= SK.band[2] && !P.searched && r.conf > .2 && now - Math.max(r.seenAt, r.heardAt) < 8) skSearch(eng, e, r, `it guessed wrong (nobody came): it goes to look for P${r.id}`, { x: r.lkx, y: r.lky });
          else skLeave(eng, e, r, `it guessed wrong (nobody came): it gives up on P${r.id}`);
        }
      }
      return;
    }
    case 'search': {
      if (thinkNow && r && r.heardAt > P.hAt + .3 && (P.moved || 0) < 3 && !P.looked) {   // fresher footsteps: it goes where they are now (at most three times)
        P.hAt = r.heardAt; P.moved = (P.moved || 0) + 1; P.goal = { x: r.hx, y: r.hy }; plan(eng, e, r.hx, r.hy, { why: 'search (heard)' });
      }
      if (!P.looked) {
        if (thinkNow && !e.path.length && e.pathAge > 1.5) { P.stuck = (P.stuck || 0) + 1; plan(eng, e, P.goal.x, P.goal.y, { why: 'search' }); }
        setAct(e, 'search');
        follow(eng, e, dt, skSpeed(e, 'stalk'), { arrive: 40 });
        if (Math.hypot(P.goal.x - e.x, P.goal.y - e.y) < 70 || (P.stuck || 0) > 2 || now > P.until) { P.looked = now; P.lookFor = rand(e, SK.searchLook[0], SK.searchLook[1]); P.look0 = e.ang; e.dbg.why = 'it stands and listens'; }
        return;
      }
      skHold(eng, e, dt); e.ang = ((P.look0 + Math.sin((now - P.looked) * 1.3) * .9) % TAU + TAU) % TAU;   // it looks one way, then the other
      if (e.act !== 'listen') setAct(e, 'listen');
      if (thinkNow && now - P.looked > P.lookFor) { if (r) skLeave(eng, e, r, `the trail of P${r.id} is cold: it gives up`); else { e.plan = null; e.dbg.why = 'nothing there: it roams again'; } }
      return;
    }
    case 'feed': {
      skHold(eng, e, dt); if (P.at) faceToward(e, P.at.x, P.at.y, dt, 1.5);
      e.hunger = clamp(e.hunger - SK.feedRate * dt, 0, 1); P.fed = (P.fed || 0) + dt;
      if (e.act !== 'feed') setAct(e, 'feed');
      return;
    }
    case 'mingle': {                                                                   // (T6) in a borrowed skin: up to them openly, a stare, maybe a word
      if (!r || tgtGone(eng, e, r) || !e.disguise) { e.plan = null; return; }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      if (P.ph === 'walk' && d <= SK.mingleStop) { P.ph = 'stare'; P.stareT = now; P.stareFor = rand(e, SK.stare[0], SK.stare[1]) * (.7 + .6 * e.tr.PATIENCE); e.dbg.why = `it stands and stares at P${r.id}`; }
      if (P.ph === 'stare') {
        skHold(eng, e, dt); faceToward(e, p.x, p.y, dt, 2.4);
        if (e.act !== 'watch' && !(e.act === 'mimic' && now < e.mimicT)) setAct(e, 'watch');
        if (thinkNow && !P.spoke && now - P.stareT > .8) { P.spoke = now; skSay(eng, e, r, 'staring'); }
        if (thinkNow && d > SK.mingleStop + 160) { P.ph = 'walk'; e.dbg.why = `P${r.id} moved off: it walks after them`; }
        else if (thinkNow && now - P.stareT > P.stareFor) {
          if (e.hunger >= SK.band[1] && !e.exh) { P.ph = 'close'; e.dbg.why = `it walks right up to P${r.id}`; }
          else { skLeave(eng, e, r, `it looked P${r.id} over and walks on`); return; }
        }
        return;
      }
      if (thinkNow && (now - (P.planT || -9) > (P.ph === 'close' ? .8 : 1.5) || !e.path.length)) {
        P.planT = now;
        if (directOk(eng, e, p.x, p.y, 420)) directTo(eng, e, p.x, p.y); else plan(eng, e, p.x, p.y, { why: 'mingle', maxNodes: 3000 });
      }
      if (e.act !== 'pace') setAct(e, 'pace');
      follow(eng, e, dt, skSpeed(e, 'disguise'), { arrive: P.ph === 'close' ? 40 : SK.mingleStop - 10 });
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
  skBody(eng, e, dt); e.still = false;
  if (e.commit) { e.still = true; if (commitTick(eng, e, dt)) return null; }      // on its kill until the death has played everywhere
  if (e.cap) { skHold(eng, e, dt); return null; }
  if (e.pounce || e.recover > 0) return skStrikeStep(eng, e, dt);                 // a strike, once begun, is carried through
  if (thinkNow && skStrike(eng, e)) return skStrikeStep(eng, e, dt);              // (before deciding: at striking distance it does not stop to think)
  if (thinkNow) skDecide(eng, e);
  skAct(eng, e, dt, thinkNow);
  return null;
}
/* the admin overlay's block (never a line of speech: only counts) */
function skDebug(eng, e) {
  const P = e.plan, g = e.dbg.predict;
  return { hu: +e.hunger.toFixed(3), band: skBand(e.hunger), st: Math.round(e.stam), ex: e.exh ? 1 : 0, pl: P ? P.k : 'roam', pid: P ? P.pid : 0, why: e.dbg.why || '',
    enc: e.enc ? { pid: e.enc.pid, spent: +e.enc.spent.toFixed(1), budget: Math.round(skBudget(e)) } : null, left: [...e.left].map(([id, u]) => [id, +(u - eng.now).toFixed(1)]),
    dec: e.dbg.decide || null, pr: g ? { x: Math.round(g.x), y: Math.round(g.y), q: [Math.round(g.qx), Math.round(g.qy)], turns: g.turns.length, lead: g.lead, hid: g.hidden ? 1 : 0, at: g.at } : null,
    tally: e.tally, pc: e.pounce ? e.pounce.style + (e.pounce.t < e.pounce.wind ? ' wind' : ' leap') : e.recover > 0 ? 'recover ' + e.recover.toFixed(1) : '', cool: +Math.max(0, e.pounceCool - eng.now).toFixed(1),
    cm: e.commit ? e.commit.v : '', rg: e.roam.goal ? [Math.round(e.roam.goal.x), Math.round(e.roam.goal.y)] : null,
    // (T6) its skin and its ears: whose skin and how long it has left; how many lines it holds and how old (never a word of them); its last line's kind
    dg: e.disguise ? { from: e.disguise.from, left: Math.round(e.disguise.until - eng.now) } : 0, sk: e.skin ? e.skin.pid : 0, sn: e.dbg.skin || '',
    hd: e.heard.map(q => Math.round(eng.now - q.at)), sd: e.dbg.said ? { ago: +(eng.now - e.dbg.said.at).toFixed(1), src: e.dbg.said.src, why: e.dbg.said.why } : null };
}
SKIN.tick = skinTick;
SKIN.debug = skDebug;
SKIN.predict = skPredict;                                       // (its guess from a record: the tests and the admin overlay ask it directly)
SKIN.hearSpeech = skHearSpeech;                                 // (T6) the engine's hearSpeech: a line said near it
SKIN.skinFrom = skSkinFrom;                                     // (T6) the engine's skinFrom: the look of the person it has killed
/* the snapshot's entry; dg (T6) only while it wears a skin: the look it wears, as the wire carries a wanderer's (hat|texture|hands|main) */
SKIN.snap = e => Object.assign({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: KACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2) }, e.disguise ? { dg: e.disguise.look } : null);
