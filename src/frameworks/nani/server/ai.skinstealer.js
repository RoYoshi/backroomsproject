/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer (Trial 3): a patient, deceptive predator with hunger, stamina and its own plans
 * provides: KACT, SK, SKIN, skReactEnd
 * uses: S, SCODE, SKC, SKI, TAU, angDiff, approach, clamp, commitTick, deriveSeed, directOk, directTo, faceToward, facedBy, follow, goTo,
 *       headAhead, hearEvent, lerp, mkRng, moveCollide, perc, plan, rand, randomFloor, setAct, setState, setTarget, skBodyInSight, skCaught, skCovertFollow,
 *       skCovertWay, skExposedNow, skHypAt, skHypDbg, skHypHeard, skHypOf, skHyps, skLeftFor, skMindDbg, skMindKept, skMindLog, skMindNew,
 *       skMindTick, skPreempt, skRefractory, skSpotExposed, skWatchers, SKL, skHeadStep, skLookThink, skVantage, skTurnRate, SKF, skFight, sm,
 *       stopMoving, tgtGone, coarseMove, skWayOut
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
 *     every form (no crawlspace; LogicZ does not exist).  No light, no item, no corpse is ever touched (CAPABILITY_MATRIX.md §6).
 * BEHAVIOUR REFINEMENT (dev/trial-3-behavior-refinement/; Trial 3 is not owner-approved).  It may choose not to hunt somebody; it may
 *   not behave as if it had not noticed somebody it really perceives.
 *   B1 AWARENESS: e.aw keeps one record per person it has SEEN in its personal space (SK.awNear) - people it has decided not to hunt
 *     (e.left) as well: leaving somebody alone is a choice about hunting, never a reason not to see them.  Each record has a pressure
 *     (A.p) that grows only from what it sees and fades (SK.pDecay); at SK.pAware it has noticed them.  While it roams or leaves it then
 *     reacts without dropping its plan (e.rx, an overlay): it stops, turns to face them and looks (SK.look), no more often than SK.ackGap;
 *     while it walks it turns its head to keep a noticed person in view (e.head: the engine's sight is centred on it, so it learns only
 *     what it then sees); a fresh sound nearby (SK.soundLook) turns it toward where it heard it - the sound's own fuzzy place, no name.
 *     Nothing in B1 can attack, and nothing reads where an unsensed person is.
 *   B2 PROVOCATION: what a seen person does to it raises that person's pressure, each kind only up to its own ceiling, so presence alone
 *     never escalates: in its space (SK.capNear), crowding it (SK.awCrowd) - both by how much THEY closed the distance lately (somebody
 *     standing still that it walked up to, or backed into, has done nothing to it) - circling it (their motion relative to its own, round
 *     it, one way: SK.orbitArc, then each further half-turn - a straight pass sweeps less than half a turn), following it as it walks
 *     (SK.tailMin), moving into its way (SK.awBlock), and pressing in after it has warned them (their own motion, and as much as they
 *     closed the distance).  A sound adds nothing: it names nobody it does not see.  The fade counts all the time since it last saw them,
 *     far away too.
 *   B3 DEFENCE: a satiated creature can kill, but only like this - it has WARNED this person, the warning ended at least SK.defAfterWarn
 *     and at most SK.pressFor ago, their pressure is at least SK.pDefend, it sees them now within SK.defReach with a clear way to them,
 *     they are not backing away, it is not exhausted and has the stamina, and neither its pounce cooldown, nor SK.defCool since it last
 *     defended against them, nor SK.defGapAll since it last defended at all, holds it back.  Then, from its own stream, it chooses:
 *     WITHDRAW (a departure away from them at its tired run, 180 px/s) or STRIKE; cornered, after earlier withdrawals from them, or the
 *     more aggressive, it strikes more often; tired (under 40 stamina), less; hunger raises it a little - hunger never decides whether it
 *     may defend, and nothing changes hunger.  The strike is the pounce's own path with its own numbers: a crouched wind-up of SK.defWind
 *     (the same tell: act wind), aimed where it believes they will be when it reaches them (never past itself: somebody walking straight
 *     at it is met where they are, by their sideways motion only), a short committed lunge that only that person can be caught by, lethal only
 *     on contact (skStrikeStep, nothing solid between), then the engine's capture, one of the three kills, G.I.B.'s corpse.  A miss: the
 *     usual recovery and pounce cooldown, then it leaves them, fast.  The hungry grab and pounce are unchanged.
 *     At SK.pWarn, after it has noticed them for SK.warnAfter, it WARNS: it turns on them, hunches (act creep, state PROVOKED) and backs
 *     away for SK.warnTime, then turns away by another way out (a departure keeps its time; roaming, it leaves).  No more often than
 *     SK.warnGap; a warning cut short by a change of plan before SK.warnTime[0] is not counted as given.  Fleeing (a withdrawal, or leaving
 *     after a missed defence) it does not stop to look - its head still turns - but chased down it may still warn.  A very hungry departure may be reconsidered, after SK.leaveDwell, only on fresh sight of somebody it may hunt - never
 *     after a lost race, never from hunger rising alone.
 * PREDATOR REFINEMENT (dev/trial-3-predator-refinement/; Trial 3 is not owner-approved).
 *   R1 THE HUNT: when it decides to go after a person it has SEEN (approach, chase, flank, an interception, a search, the bait) it keeps
 *     e.hunt above the plans: the quarry, a belief (where they are, heading, how sure, how old, how it knows - seen / heard / guessed),
 *     its confidence (falling without evidence, more slowly the hungrier it is: SK.forget) and its failed guesses.  When a plan ends the
 *     hunt chooses the next step (listen, search where it believes they are) instead of leaving; it gives up for a stated reason - no
 *     evidence (confidence under SK.huntLow), its effort spent (the encounter budget, now longer with hunger and carried across its
 *     departures: SK.carryHalf), exhausted, more than one of them, not hungry.  The engine's records are never written by it.
 *     Eye contact is information: the weights are smooth in hunger.  Mildly hungry, being watched still sends it away or out of sight;
 *     hungry, it breaks their line of sight to FLANK (a spot to the side they cannot see, no farther than it is) and comes at them from
 *     there; starving, it comes on openly or flanks and rarely backs off.  A lost race no longer ends a hungry one's hunt: it may not give
 *     chase again for SK.chaseRest and keeps to the trail at its free walking pace.  A starving one may take up a person it left
 *     SK.leftFresh ago on fresh sight, within the effort it has left for them.
 *   R2 LISTENING AND BELIEF: out of sight every footstep is anonymous (the engine names a sound only while the person is seen).  On
 *     each think the hunt asks of every new body sound it heard (a person's it cannot name; never a creature's): could my quarry be there
 *     by now (within the belief's uncertainty plus SK.hearReach px a second since the last evidence)?  If so it moves its belief to that
 *     fuzzy place, takes a heading from the last evidence to it and firms its confidence (SK.hearConf).  It names nobody: somebody else
 *     making noise there fools it, fairly.  Its guesses (skGuess) come from that belief only: the way it predicts they went (Trial 3's
 *     route, now skRoute, with the same draws), after that has failed the other way at the same turn, where it believes they are, or the
 *     place it last had them; a place near a failed guess (SK.failedNear, remembered SK.failedTtl) is not tried again and each failure
 *     costs confidence (SK.wrongCost).  A sound that fits, away from its current guess, revises an interception or a search (at most
 *     SK.reviseMax in a hunt); no sound, no revision.  Roaming, a sound makes it stop, turn its head to it and listen (SK.curious); a
 *     second sound that fits the first, or one strong first (SK.curiousStrong), sends it to look - anonymous throughout.
 *   R3 STALKING AND AMBUSH: coming at somebody unaware, it FREEZES (crouched, still) when they turn its way before they meet its eyes
 *     (their facing within SK.freezeCone of it), until they look away or its patience (SK.freezeMax, shorter when starving) runs out.
 *     Waiting at an interception its head sweeps as it listens.  Where there is no spot to go round a watcher (skFlankSpot finds none) it
 *     remembers that for that place (SK.noFlank) instead of looking again on every think, and a hungry one may then come on openly.
 *   R4-R7 (integration, the independent review): no one-tick holding of its ground when there is no way round; a glimpse lost for under
 *     SK.lostGrace does not end an approach or a chase; at a flank spot it settles SK.flankSettle before it comes on.  A flank spot is
 *     searched for only when going round would really be begun.  On a runner's trail after a lost race it goes at SK.shadowPace of their
 *     speed, so a lead won stays won while they move (even winded); only a person who stops is reached.  The effort spent on a person is
 *     kept when its attention moves to somebody else, and a departure it keeps keeps that person's cooldown.  Records of people who left
 *     the game are dropped; an admin summon ends a hunt. */
const KACT = { '': 0, watch: 1, back: 2, leave: 3, wait: 4, lure: 5, intercept: 6, search: 7, listen: 8, approach: 9, creep: 10, chase: 11, wind: 12, pounce: 13, recover: 14, feed: 15, mimic: 16, rest: 17, pace: 18 };
/* the balance table (proposed; every value is named so it can be tested and tuned) */
const SK = Object.freeze({
  hungerAtSpawn: [.45, .65],                     // an admin spawn: a seeded value in this range (or the spawn's own hunger option)
  hungerRate: .0016,                             // per second (about .1 a minute: satiated to hungry in about 4 minutes)
  band: [.2, .4, .6, .8],                        // satiated | mild | hungry | very hungry | starving
  stamExh: 8, stamBack: 40, stamLow: 25,         // exhausted under 8, itself again over 40; tired (fatigued speed) under 25
  drainRun: 11, runFrom: 215,                    // stamina per second at its run, counted only over runFrom px/s and in proportion to the speed
                                                 //  beyond it (R18: a prowl, 205, is free; an investigation costs about 3/s, the press 9, the run 11.
                                                 //  R8-R16i: 14 a second x speed / run, over 200; T3 had 150)
  regenWalk: 6, regenStill: 11,                  // stamina per second walking / standing
  roamLeg: [500, 1600], roamPause: [.6, 2], roamGiveUp: [12, 30],   // (R18: pauses .6-2 s, were 1.5-5)
  patrolFresh: 90,                               // (R16d) seconds a place it saw or heard somebody stays worth prowling to (hungry)
  watch: [1.5, 4.5],                             // seconds it stands and looks (x .7 .. 1.3 with PATIENCE; R18: was 2-6)
  near: 260,                                     // a person closer than this is too close to just watch
  exposed: .45,                                  // the light on its own body above which it counts itself exposed
  hide: [140, 520],                              // how far it backs off to be out of sight
  leave: [1200, 2200], leaveMax: 45,             // how far it goes when it leaves; the longest a departure lasts
  cooldown: [20, 40],                            // (R18: was 30-60) seconds it then leaves that person alone, fed (R16d: from hunger .4, skLeftFor - R8's starving 12 s is 4 s)
  budgetEnc: [45, 120],                          // seconds with one person: 45 + 120 x hunger (R18; R1 had 30 + 90 x hunger, Trial 3 25 + 45 x hunger)
  rethink: 1.3,                                  // a new plan must score this much better than the one it has (no dithering)
  retreatHold: .5,                               // seconds out of sight before it decides what next (lure, or go about its business; R18: was 1)
  approachStop: 150,                             // T3: it comes no closer than this (the pounce and the kill are T4's)
  lure: [3, 8], lureMax: 14,                     // waiting round the corner: 3 + 8 x hunger x PATIENCE s; never longer than lureMax (R18: 4 + 12, 22)
  predictLook: 1500, predictTurns: 2,            // how far along their way it thinks ahead; how many turns it guesses
  predictMargin: .8,                             // seconds it wants to be there before them
  interceptMax: 26, interceptWait: [2, 5],       // the longest an interception lasts; how long it waits at the spot (x PATIENCE; R18: was 4-9)
  searchMax: 20, searchLook: [1, 2],             // the longest a search lasts; how long it listens where it arrives (R18: 16; 2-4)
  heardFresh: 4, heardMin: .08,                  // a sound this recent and this strong is worth going to look at (R18: 2.5, .12)
  chaseFrom: 560, chaseMax: 9, chaseLose: 170,   // (R18: 420, 7, 140) it gives chase only from closer than this; for at most this long; it gives up when the gap
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
  // behaviour refinement B1: awareness (dev/trial-3-behavior-refinement/BALANCE_TABLE.md; all PROPOSED)
  awMax: 4, awTtl: 30,                           // awareness records it keeps; seconds a record nobody renews is kept
  awNear: 200, awCrowd: 90,                      // its personal space (while it sees them); crowding
  pNear: .12, capNear: .35,                      // pressure per second in its space (x closeness, approach); presence alone never goes beyond capNear
  pFast: 1.6,                                    // x this much for fast motion close by (their speed relative to it, 100..300 px/s)
  pDecay: 8,                                     // seconds (e-folding) for pressure to fade
  pAware: .12,                                   // pressure at which it has noticed them
  ackGap: [3, 5], look: [.8, 1.6],               // seconds between two looks at the same person; how long a look lasts
  rxGap: 1.5,                                    // seconds after a reaction ends before it turns to a sound (no look at footsteps on the heels of a look)
  soundLook: 420, soundLookI: .2, soundGap: 4,   // a fresh sound this close and loud turns it to look; seconds between such looks
  // behaviour refinement B2: provocation
  awOrbit: 300, orbitArc: 4,                     // a record is kept within this; circling: radians of their motion round it, one way, before it counts
  awTail: 220, tailMin: 3,                       // following it as it walks, within this, for this long
  awBlock: 150,                                  // standing in its way (ahead, in its lane) within this
  pCrowd: .16, capCrowd: .65,                    // crowding: per second, up to
  pOrbit: .22, capOrbit: 1.2,                    // circling: per half-turn after the first, up to
  pTail: .1, capTail: .9, pBlock: .12, capBlock: .9,   // following it; in its way: per second, up to
  pPress: .25, capPress: 1.2, pressNear: 160, pressFor: 15,   // pressing in (within pressNear, not backing off) for pressFor s after a warning: per second, up to
  pWarn: .45, warnAfter: 3,                      // pressure at which it warns, once it has noticed them this long
  warnTime: [1.2, 1.8], warnGap: 4, warnBack: 40,   // a warning lasts; the least time to the next; how fast it backs away meanwhile (px/s)
  leaveDwell: 2.5,                               // a very hungry departure can be reconsidered only after this long (and only on fresh sight; R18: was 4)
  // behaviour refinement B3: defence
  pDefend: .8, defAfterWarn: 1, defReach: 110,   // pressure from which it may defend; at least this long after a warning ended; this close (seen, a clear way)
  defWind: .5, defDur: .25, defSpeed: 340, defCost: 18,   // the defensive wind-up (the tell), the lunge (about 70 px), its stamina
  defCool: 25, defGapAll: 10,                    // seconds before it defends against the same person again; against anybody
  defBase: .35, defCornered: .4, defPerWithdraw: .2, defAggr: .5, defHunger: .3, defTired: .2,   // the odds of striking rather than withdrawing (kept within .1-.95)
  // predator refinement R1: the hunt (dev/trial-3-predator-refinement/BALANCE_TABLE.md; all UNAPPROVED)
  carryHalf: 90,                                 // seconds for the effort it has spent on a person (kept across its departures) to halve
  forget: [15, 45],                              // seconds without any evidence of its quarry before the hunt is given up (not hungry .. starving; R18; R2 10 .. 30, R1 8 .. 24)
  huntLow: .1,                                   // the confidence under which a hunt is over (R18: was .15)
  huntTries: [3, 6],                             // guesses (interceptions, searches) in one hunt: hungry .. starving (R18; R2 2-4, R1 3)
  listenLost: [.3, .8],                          // seconds it stands and listens when its quarry has gone (shorter when starving; R18: was .6-1.6)
  flankMax: 3, flankDur: 7, flankMin: 220,       // flanks in one hunt; the longest a flank lasts (R18: 8); the nearest to them a flank spot is
  flankCome: 6,                                  // seconds it comes on from a flank toward where it believes them before it stops to listen
  chaseRest: 5,                                  // seconds after a lost race before it gives chase again (R18: was 10)
  pressShown: 3,                                 // (R16i; R18: 3 s, was 2) s: seen by them this lately, its approach is no secret - it may press (speeds.press)
  shadowPace: .85,                               // (R7) keeping to a runner's trail after a lost race: this share of their speed (at most its free pace) - a
                                                 //  person who keeps moving, even winded (148 px/s), keeps their lead; one who stops or turns back is reached
  leftFresh: 4,                                  // a starving one takes up a person it left at least this long ago, on fresh sight
  // predator refinement R2: listening, belief, guesses (all UNAPPROVED)
  hearReach: 260,                                // px a second a person may have gone since its last evidence of them: a sound farther from its
                                                 //  belief than that (plus both uncertainties) is not taken for theirs
  hearConf: [.45, .85],                          // the confidence a sound that fits gives the hunt (quiet .. loud; a sighting gives 1)
  failedTtl: 60, failedNear: 200,                // seconds a failed guess is remembered (at most 4); how near a failed place another guess may not be
  wrongCost: .15,                                // the confidence a failed guess costs
  reviseMax: 3,                                  // revisions of its guess on a new sound, in one hunt
  // predator refinement R3: stalking (all UNAPPROVED)
  freezeCone: 1.1, freezeMax: [1.5, .6],         // stalking: it freezes when an unaware person's facing comes within this of it (rad), for at most (R18: 3 .. 1.2)
                                                 //  this long (hungry .. starving) before it goes on
  noFlank: 10,                                   // seconds it remembers that a place has no way round a watcher (or until they move 200 px)
  lostGrace: .6,                                 // (R4) seconds out of sight before an approach, a chase (R16d: or a watch) counts them lost (no flicker at a sight edge)
  flankSettle: .3,                               // (R4) seconds it settles, crouched, at its flank spot before it comes on (R18: was .6)
  curious: [.4, 1], curiousStrong: .35,          // roaming: seconds it stops and listens after a sound; a first sound this strong is looked at alone (R18: .8-1.8, .45)
                                                 //  (x 1 .. .4 from mildly hungry to hungry)
  // R11 (dev/trial-3-r9-overhaul/; all UNAPPROVED)
  watchHungry: .7,                               // hungry (from .35 to .6), a look at somebody is this much shorter: an assessment, not a vigil
  gazeFar: 760,                                  // attention: its head turns to the person it notices most among those it sees, this far (its sight's range)
  ackEyes: 480, ackCome: 360,                    // a person it has just seen (beyond its personal space): it stops and looks at them if they meet its eyes within ackEyes,
                                                 //  or come its way within ackCome (B1's own looks at somebody in its space go on as before)
  ackLook: [.25, .4],                            // how long that first look lasts: a turn of the head and shoulders toward them, a beat, then on (R18: .35-.55)
  ackOver: 1.4, ackHead: 1.5,                    // satiated and leaving: instead, its head turns back to them (up to ackHead rad) for ackOver s as it goes
  // R18 (the owner's OVERTUNED EXPERIMENT; all UNAPPROVED, meant to be tuned down after the owner plays it)
  huntHunger: .3,                                // from this hunger it hunts (listens, prowls, flanks, takes up a trail, springs): R8-R16i SK.band[1], .4
  chaseHunger: .45,                              // from this hunger it may run (chase, press, a hungry ambush cut short): R8-R16i SK.band[2], .6 - and the
                                                 //  weights around it are graduated (skDrive), no cliff at the line
  escalate: [5, 1.2],                            // a standoff (it watches somebody who knows it is there): seconds before it moves on them - fed .. starving
                                                 //  (x .8 .. 1.2 with PATIENCE); fed (under huntHunger) it only watches
  closeFrom: 450,                                // px: an approach nobody sees prowls (205) until this near, then stalks or creeps (stealth for the last stretch)
  // R19 (the owner's pack of October 23, the S track: its positioning before a chase - its chase, speeds and strike are R18's)
  detour: [12, 6],                               // s: the most a way round somebody standing still may cost beyond coming on openly, just hungry .. starving (skFlankWorth)
  contestFrom: 1000,                             // px: from this near, and beyond its footwork's range, an open approach heads for their way out (skContest)
  contestOff: .6,                                // rad: ...when their way out lies this far off straight beyond them (a doorway, a side passage)
  contestKeep: 120,                              // px: its aim at their way out is kept until they move this far from where it chose it
});
/* (R18) how much its hunger drives it, 0 (fed) .. 1 (starving), smooth: every R18 weight and speed scales with it - no cliff at a line */
const skDrive = e => sm(SK.huntHunger - .1, .85, e.hunger);
/* (R15) the Rend's weight among its kills: a grab (not a leap's landing), hungry (SK.band[2]; more when starving), with room for the two
 * halves either side of the line of the pull (rays from the victim, 72 px clear each way); 0 otherwise.  Its own geometry only: no draw */
function skRendW(eng, e, pv, pounce) {
  if (pounce || !(e.hunger >= SK.band[2])) return 0;
  const a = Math.atan2(pv.y - e.y, pv.x - e.x), room = s => eng.geo.ray(pv.x, pv.y, a + s * Math.PI / 2, 80) >= 72;
  return room(1) && room(-1) ? (e.hunger >= SK.band[3] ? .5 : .3) : 0;
}
/* (T6) the generic calls, used only when it has heard nothing it may repeat: none of them claims to know anything about anybody */
const SK_BAIT = Object.freeze(['hello?', 'is someone there?', 'over here', 'wait for me', 'can you help me?', "i'm lost", 'this way']);
const SKIN = {
  name: 'SkinStealer', kind: 'skinstealer', initial: S.ROAMING, radius: 24, clearance: 21, vTop: 300, turnPenalty: .5, roamSpeed: 160,   // (R18: its casual walk)
  // a patient, cautious, clever animal: intelligence, patience and caution drive its plans; hunger is its own variable (e.hunger), not a trait
  traits: { INTELLIGENCE: .8, SADISM: .1, HUNGER: .6, PATIENCE: .75, CURIOSITY: .55, CAUTION: .7, TERRITORIALITY: .3, AGGRESSION: .45, PERSISTENCE: .45, SOCIAL: .1, HEARING: .7, VISION: .55, LIGHT_SENS: .5, MEMORY: .7 },
  jitter: .12,
  // one collider in every form: it cannot crawl, and a disguise never shrinks it (LogicZ does not exist; see DEFERRED.md)
  caps: { CAN_VAULT: true, VAULT_SPEED: .9, CAN_CROUCH: true, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: false, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.6, ACCELERATION: 760,
    HEAD_SWIVEL: { max: .85, run: .4, runFrom: 240, rate: 3, ahead: 170 } },   // (R20, the N track) its gaze leads into the bends of its way (headAhead)
  // not a dark-seer: a lightless person in the dark is seen only from close by, as the Hound sees
  vision: { range: 760, fov: 2.5, dark: false, gain: 2.6, floor: 90 },
  // (R18, the owner's OVERTUNED EXPERIMENT of October 22 - "overtune first, balance down after I experience it"; Skin-Stealer only, the
  // Wanderer's movement locked: walk 172, a fresh sprint 285) its movement profile in the owner's ranges:
  //   roam 160 (casual wandering, 140-175)  prowl 205 (purposeful prowling, 195-215)  investigate 232 (alert investigation, 225-240)
  //   press 260 (aggressive approach, 255-265)  run 270 (its most: ordinary pursuit; still under a fresh sprint - a rested runner wins a
  //   straight race, by 15 px/s)
  // kept for their purpose: creep 62 and stalk 90 (stealth), disguise 150 (in a skin, a Wanderer's stroll), flank 210 (a quick move to
  // cover), fatigued 190 (tired: stamina under stamLow), spent 120 (exhausted).  R8-R16i: roam 105, run 255, fatigued 180, flank 170;
  // R16i's press 238.  Each speed over runFrom (215) spends stamina (skBody): investigation a little, the press more, the run most
  speeds: { roam: 160, creep: 62, stalk: 90, disguise: 150, run: 270, fatigued: 190, follow: 105, flank: 210, press: 260, prowl: 205, investigate: 232, spent: 120 },
  evidence: { sight: 3, sound: 1.5, light: 1.6 },               // (ai.intelligence.js evidenceWeights: its own, never the Smiler's)
  /* its kills (ai.capture.js): always quick, committed for its own death lengths (dphys.js DURS.SkinStealer), one of three - (R15) or,
   * rarely, the fourth: D, the Rend */
  capture: {
    noPlay: true, commit: true, commitDur: { A: 3.2, B: 3.4, C: 3.5, D: 3.6 },
    quick: () => 1,
    variants(eng, e, pv, ctx, attack) {
      const pounce = attack && attack.style === 'pounce' && (attack.speed || 0) > 250, winded = pv.ex || (pv.stamina != null && pv.stamina < 22);
      return [
        { k: 'A', w: pounce ? .5 : 1.6 },                                                     // a grip from close by, the neck broken
        { k: 'B', w: pounce ? 2.6 : .15 },                                                    // the leap carries them down, then the neck
        { k: 'C', w: .35 + (winded ? 1.9 : 0) + (ctx.deadEnd ? 1.4 : 0) + (e.hunger >= SK.band[3] ? 1.4 : 0) },   // held, a bite at the neck: a winded or cornered victim, a starving one
        // (R15) D, the Rend: only a grab from close by (never at the end of a leap), only hungry, and only with room to either side of the
        // victim for the two halves (the line of the pull, a clear 72 px each way) - else its weight is nothing and the draw is A-C's own,
        // exactly as before.  Rare where it fits; the recent-kills rule (pickVariant) keeps it from repeating
        { k: 'D', w: skRendW(eng, e, pv, pounce) },
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
    e.tally = { lure: 0, lureCame: 0, ambush: 0, ambushCame: 0, intercept: 0, interceptCame: 0, chase: 0, chaseLost: 0, search: 0, searchFound: 0, pounce: 0, grab: 0, hit: 0, miss: 0, wall: 0, kills: 0,
      mingle: 0, say: 0, sayHeard: 0, sayBait: 0, skin: 0, skinLost: 0, reveal: 0, look: 0, lookSound: 0, warn: 0, reconsider: 0, defend: 0, defendHit: 0, defendMiss: 0, withdraw: 0 };   // its record (debug, tests, the balance report)
    e.pounceCool = 0;
    e.aw = new Map(); e.rx = null; e.awAt = 0; e.awSound = 0; e.soundLookAt = 0;                // (B1) its awareness records; a reaction in progress
    e.awRng = mkRng(deriveSeed(eng.seed, 'skinstealer-aware', e.id));                           // (B1) its own stream: noticing never moves its other choices
    e.hunt = null; e.spent = new Map();                                                         // (R1) its hunt; the effort it has spent on each person
    e.huntRng = mkRng(deriveSeed(eng.seed, 'skinstealer-hunt', e.id));
    e.look = { k: '', sid: 0, h: null, seen: new Set() }; e.lookRng = mkRng(deriveSeed(eng.seed, 'skinstealer-look', e.id));   // (R16e) its eyes' stimulus; its own stream
    e.coverRng = mkRng(deriveSeed(eng.seed, 'skinstealer-cover', e.id));                        // (R13) its own stream for the spots it looks for under cover: R8's draws never move                          // (R1) its own stream: how it goes about a hunt never moves its other choices
    Object.assign(e.tally, { hunt: 0, huntCold: 0, huntSpent: 0, flank: 0, shadow: 0, listenLost: 0, reengage: 0, heardQ: 0, revise: 0, wrong: 0, alt: 0, curious: 0, curiousDrop: 0, freeze: 0, noFlank: 0, contest: 0, flankRefused: 0, flankStale: 0 });   // (R19: the last three)
    e.mind = skMindNew();                                                                       // (R11) who could see it, what changed, what it knows (ai.skin.mind.js)
  },
  /* the engine's hooks (ai.engine.js): it never borrows a Hound's or a Smiler's own functions */
  onFar(eng, e) {
    e.pounce = null; e.recover = 0; e.rx = null; e.head = 0; e.look.k = ''; e.look.h = null; e.look.prev = 0; e.look.seen = null; e.look.m = null; e.pre = null; e.fight = null; e.mv = null; e.ackHead = null; e.defLeave = 0; skHuntEnd(eng, e, 'nobody within reach'); e.noFlank = null; e.noAmbush = null; if (e.plan && e.plan.k === 'feed') return;   // feeding at its kill it carries on, alone
    e.plan = null; e.roam.goal = null; e.roam.pause = 0; setState(e, S.ROAMING, ''); e.dbg.why = 'nobody within reach: it waits where it is';
  },
  farTick(eng, e, dt) {                                           // far from everyone: its hunger goes on (or it feeds)
    skBody(eng, e, dt);
    const P = e.plan; if (P && P.k === 'feed') { e.hunger = clamp(e.hunger - SK.feedRate * dt, 0, 1); P.fed = (P.fed || 0) + dt; if (eng.now > P.until || (e.hunger < .02 && P.fed >= SK.skinFeed)) { skDon(eng, e, P); e.plan = null; setState(e, S.ROAMING, ''); e.dbg.why = 'fed: it waits where it is'; } return; }
    // (R18, the owner's overtuned experiment) hungry, it does not stand and wait for somebody to come within reach: it prowls - coarsely, as
    // a Hound roams far from everyone (the engine's own coarse movement, at its casual walk) - to where its prey has been (its own memory:
    // skPatrolGoal) or, with nothing to go on, across the level.  Never toward anybody it has not perceived.  Fed (or exhausted), it waits
    if (e.hunger < SK.huntHunger || e.exh || e.cap || e.commit || e.disguise) return;
    e.farT = (e.farT || 0) - dt;
    if (!e.path.length && e.farT <= 0) {
      const g = skPatrolGoal(eng, e) || randomFloor(eng, e, 900, 2800);
      if (g) { plan(eng, e, g.x, g.y, { why: 'far prowl' }); e.dbg.why = g.k ? `far from everyone: it prowls where it ${g.k} somebody` : 'far from everyone: it prowls the level'; }
      e.farT = rand(e, 2, 6);
    }
    coarseMove(eng, e, dt);
  },
  still(e) { return e.still; },                                  // (the engine's stuck watchdog: it held still this tick on purpose)
  onStuck(eng, e) { if (e.plan && e.plan.k !== 'lure' && e.plan.k !== 'ambush') e.plan.stuck = (e.plan.stuck || 0) + 1; e.roam.goal = null; e.dbg.why = 'stuck: the watchdog cleared its route'; },
  onClear(eng, e) { e.noAmbush = null; e.plan = null; e.target = null; e.enc = null; e.roam.goal = null; e.aw.clear(); e.rx = null; e.head = 0; e.look.k = ''; e.look.h = null; e.look.prev = 0; e.look.seen = null; e.look.m = null; e.pre = null; e.roam.seen = null; e.fight = null; e.mv = null; e.ackHead = null; e.defLeave = 0; e.dbg.lv = ''; e.hunt = null; e.spent.clear(); e.noFlank = null; e.mind = skMindNew(); setState(e, S.ROAMING, ''); },
  debugHunt(eng, e, r) { e.left.delete(r.id); setTarget(e, r.id, eng.now); skBegin(eng, e, 'watch', r, 'admin: it was given a record of you'); return 'WATCHING YOU (real AI)'; },
  /* its own target scoring and commitment (ai.intelligence.js's debug asks for them; never the Smiler's sScore) */
  targetScore(eng, e, r) { const age = eng.now - Math.max(r.seenAt, r.heardAt); return r.aw * .8 + r.conf * .7 - Math.min(1, age / 30) * .3 + (r.seen ? .5 : 0) + (r.id === e.target ? .4 : 0); },
  dwell(e) { return 1.5 + e.tr.PATIENCE; },
  summon(eng, e, r, tx, ty) { skHuntEnd(eng, e, 'admin summon'); e.plan = null; e.roam.goal = { x: tx, y: ty }; plan(eng, e, tx, ty, { why: 'admin summon' }); e.roam.until = eng.now + 40; e.roam.pause = 0; e.dbg.why = 'admin summon: it goes to look'; },
};
const skBand = h => h < SK.band[0] ? 'satiated' : h < SK.band[1] ? 'mild' : h < SK.band[2] ? 'hungry' : h < SK.band[3] ? 'very hungry' : 'starving';

/* ---- the animal: hunger and stamina, every tick, from what its body really did ---- */
function skBody(eng, e, dt) {
  e.hunger = clamp(e.hunger + SK.hungerRate * dt, 0, 1);
  const v = e.speed || 0;
  if (e.pounce) { /* a leap is paid for at once (SK.pounceCost), not as running */ }
  else if (v > SK.runFrom) e.stam -= SK.drainRun * Math.max(.25, (v - SK.runFrom) / (e.sp.speeds.run - SK.runFrom)) * dt;   // (R18: by the speed beyond runFrom - at least a quarter of the run's)
  else e.stam += (v < 8 ? SK.regenStill : SK.regenWalk) * dt;
  e.stam = clamp(e.stam, 0, 100);
  if (!e.exh && e.stam < SK.stamExh) { e.exh = true; e.dbg.exh = eng.now; }
  else if (e.exh && e.stam >= SK.stamBack) e.exh = false;
  if (e.disguise && eng.now > e.disguise.until) skUndress(eng, e, 'its borrowed skin wore out');   // (T6)
}
/* it holds still on purpose: no route left behind (the engine's stuck watchdog would take a deliberate stop for being stuck) */
/* (R16g) may it run at r: the chase's own conditions on it (skDecide's chase) - hungry enough, not exhausted, its breath, no race lost to
 * them lately */
function skMayRun(eng, e, r) { const H = e.hunt && e.hunt.pid === r.id ? e.hunt : null; return e.hunger >= SK.chaseHunger && !e.exh && e.stam >= SK.stamLow + 15 && !(H && eng.now - H.raceAt < SK.chaseRest); }
/* (R16f) close enough, and in the open, to fight for its place: somebody it sees within SKF.near who is moving, or looking at it - (R18) or,
 * hungry, who has had it on their screen within SK.pressShown (they know it is there: a hesitation is a chance, not a reason to wait) */
function skFightable(eng, e, r, p, d) {
  if (!r.seen || d >= SKF.near || e.disguise || e.exh) return false;
  if (Math.hypot(p.vx, p.vy) > 40 || skWatched(eng, e, r)) return true;
  const o = e.mind && e.mind.obs.get(r.id); return e.hunger >= SK.huntHunger && !!(o && eng.now - o.sawAt < SK.pressShown);
}
/* (R16e) a plan's own head movement (a listening sway, a glance back): eased from where the head is, so that it never jumps after a snap */
function skHeadTo(e, v, dt) { const h = e.head || 0; e.head = h + clamp((v - h) * Math.min(1, dt * 12), -8 * dt, 8 * dt); }
function skHold(eng, e, dt) { if (e.path.length) e.path = []; stopMoving(eng, e, dt); e.still = true; }
/* the fastest it may go now: exhausted it walks, tired it runs slower */
const skCap = e => e.exh ? e.sp.speeds.spent : e.stam < SK.stamLow ? e.sp.speeds.fatigued : e.sp.speeds.run;   // (R18: exhausted, its spent walk - R8-R16i its roam)
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
  lure: [S.CAUTIOUS, 'lure'], ambush: [S.STALKING, 'wait'], intercept: [S.STALKING, 'intercept'], search: [S.SEARCHING, 'search'], leave: [S.DISAPPEARING, 'leave'], feed: [S.FEEDING, 'feed'],
  mingle: [S.STALKING, 'pace'],                                                                // (T6) in a borrowed skin, walking up openly
  flank: [S.STALKING, 'approach'], listen: [S.ALERT, 'listen'] };                             // (R1) to cover at their side; standing, listening
function skBegin(eng, e, k, r, why, extra) {
  const p = Object.assign({ k, pid: r ? r.id : 0, t0: eng.now, why }, extra || {});
  e.plan = p; e.dbg.why = why; e.path = []; e.goalKey = '';
  if (r) setTarget(e, r.id, eng.now);
  if (k === 'watch') p.until = eng.now + rand(e, SK.watch[0], SK.watch[1]) * (.7 + .6 * e.tr.PATIENCE) * (1 - SK.watchHungry * sm(.35, .6, e.hunger));   // (R11: hungry, a look is an assessment, not a vigil)
  if (e.tally[k] !== undefined) e.tally[k]++;
  setState(e, SK_STATE[k][0], SK_STATE[k][1]);
  return p;
}
/* the person's encounter: its spent seconds (real time, counted on its thinks; never refilled by a change of plan) */
function skEnc(eng, e, r, count) {
  if (e.enc && e.enc.pid !== r.id) skKeepSpent(eng, e);                           // (R7) its attention moves to somebody else: what it spent on the first is kept
  if (!e.enc || e.enc.pid !== r.id) e.enc = { pid: r.id, t0: eng.now, at: eng.now, spent: skCarried(eng, e, r.id) };   // (R1: what it spent on them before, halving with time)
  if (count) e.enc.spent += Math.min(.5, eng.now - e.enc.at);
  e.enc.at = eng.now;
  return e.enc;
}
const skBudget = e => SK.budgetEnc[0] + SK.budgetEnc[1] * e.hunger;
/* (R1) the effort it spent on a person in earlier encounters, halving every SK.carryHalf seconds: leaving and coming back never refills it */
function skCarried(eng, e, pid) { const q = e.spent.get(pid); return q ? q.s * Math.pow(.5, (eng.now - q.t) / SK.carryHalf) : 0; }
function skKeepSpent(eng, e) {
  if (!e.enc) return;
  e.spent.set(e.enc.pid, { s: e.enc.spent, t: eng.now });
  for (const [id, q] of e.spent) if (!eng.byId.has(id) || q.s * Math.pow(.5, (eng.now - q.t) / SK.carryHalf) < 1) e.spent.delete(id);
  while (e.spent.size > 6) { let o = null; for (const [id, q] of e.spent) if (!o || q.t < o[1].t) o = [id, q]; e.spent.delete(o[0]); }
}
/* leave them alone: a goal far away, in the dark, away from everyone it perceives; and a cooldown on that person */
function skLeaveGoal(eng, e) {
  const pos = [...e.mem.p.values()].filter(q => !tgtGone(eng, e, q) && eng.now - Math.max(q.seenAt, q.heardAt) < 20).map(q => perc(eng, e, q));
  let best = null, bs = -1e9;
  for (let k = 0; k < 8; k++) {
    const g = randomFloor(eng, e, SK.leave[0], SK.leave[1]); if (!g) continue;
    const dmin = pos.length ? Math.min(...pos.map(q => Math.hypot(q.x - g.x, q.y - g.y))) : 2000;
    const s = Math.min(dmin, 2200) - (eng.geo.lamp[eng.geo.cellAt(g.x, g.y)] || 0) * 600 + e.streams.search() * 120;
    if (s > bs) { bs = s; best = g; }
  }
  return best;
}
function skLeave(eng, e, r, why) {
  const best = skLeaveGoal(eng, e);
  const P = skBegin(eng, e, 'leave', null, why, { until: eng.now + SK.leaveMax, goal: best });
  if (best) plan(eng, e, best.x, best.y, { why: 'leave' });
  if (r) {                                                                          // (R16d) how long it leaves them alone: the hungrier, the shorter (skLeftFor); fed or mildly hungry as before
    const c = e.hunger >= SK.band[3] ? 0 : rand(e, SK.cooldown[0], SK.cooldown[1]);
    e.left.set(r.id, eng.now + (e.hunger < SK.huntHunger ? c : skLeftFor(e.hunger))); (e.leftAt || (e.leftAt = new Map())).set(r.id, eng.now);
  }
  skKeepSpent(eng, e); skHuntEnd(eng, e, why);
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
    const unseen = line.filter(q => !geo.los(q.x, q.y, x, y)).length, hidden = !skBodyInSight(geo, from.x, from.y, x, y), far = Math.hypot(x - from.x, y - from.y);   // (R16: all of it hidden)
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

/* ---- R1: the hunt - its intent toward one person it has seen, kept above the plans ---- */
function skHuntBegin(eng, e, r, why) {
  const H = e.hunt; if (H && H.pid === r.id) return H;
  const t = r.seen ? eng.now : Math.min(eng.now, Math.max(r.seenAt, r.heardAt));   // (R7) begun from a record: the belief is as old as the record
  e.hunt = { pid: r.id, t0: eng.now, evAt: t, ev: r.seen ? 'seen' : 'remembered', x: r.lkx, y: r.lky, vx: r.lvx, vy: r.lvy, bt: t, u: r.seen ? 20 : 120,
    conf: r.seen ? 1 : Math.max(.3, r.conf), flanks: 0, tries: 0, failed: [], raceAt: -99, listenAt: -99, why, sid: e.mem.soundId || 0, heard: 0, revised: 0,
    hAt: -99, badA: [], altTried: 0, guess: '',                                       // (R2) its last heard evidence; first turns that failed; the other way tried
    // the way it prefers to answer being seen, this time: going round them, or backing round a corner to lure them (the hungrier, the more
    // often round them); the other is tried when the first has failed
    style: skStyle(e) }; e.styleNext = '';
  e.tally.hunt++; e.dbg.hunt = why;
  return e.hunt;
}
function skHuntEnd(eng, e, why) { if (!e.hunt) return; e.dbg.huntEnd = { pid: e.hunt.pid, why: String(why || '').slice(0, 90), at: +eng.now.toFixed(1) }; e.hunt = null; }
/* on its think: what it knows of its quarry now - its own sight (the body itself); otherwise (R2) the body sounds it has heard since its
 * last think that fit where they could be by now; its confidence fades between */
function skHuntTick(eng, e, dt) {
  const H = e.hunt; if (!H) return;
  const r = e.mem.p.get(H.pid), now = eng.now;
  if (!r || tgtGone(eng, e, r)) { skHuntEnd(eng, e, 'its quarry is gone'); return; }
  for (let i = H.failed.length - 1; i >= 0; i--) if (now - H.failed[i].t > SK.failedTtl) H.failed.splice(i, 1);   // (R2) an old failure is forgotten
  if (r.seen && r.visual) { const v = r.visual; if (H.ev !== 'seen' || now - (H.logAt ?? -99) > 2) { skMindLog(e, H, now, 'seen', v.x, v.y, 20, H.ev !== 'seen' ? 'in sight again' : ''); H.logAt = now; } H.x = v.x; H.y = v.y; H.vx = v.vx; H.vy = v.vy; H.bt = now; H.u = 20; H.conf = 1; H.evAt = now; H.ev = 'seen'; H.sid = e.mem.soundId || 0; H.badA.length = 0; return; }   // (R11: the evidence log, a new sighting or every 2 s in sight)
  // (R2) oldest first; a creature's sound (src -1) is never theirs, nor one named for somebody else; nothing here names anybody
  const snd = e.mem.sounds;
  for (let i = snd.length - 1; i >= 0; i--) { const q = snd[i]; if (q.id <= H.sid) continue; H.sid = q.id; if ((q.src === 0 || q.pid === H.pid) && skFits(H, q)) { skHypHeard(eng, e, H, q); skHeardQuarry(e, H, q); } }   // (R12: which of its ways the sound fits, then the belief moves)
  H.conf = Math.max(0, H.conf - dt / skForget(e));
}
/* (R2) could the quarry have made that sound: is it within reach of the last evidence (both uncertainties, and the way a person can go since) */
const skFits = (H, q) => Math.hypot(q.x - H.x, q.y - H.y) <= Math.min(1800, H.u + q.u + 60 + SK.hearReach * Math.max(0, q.t - H.bt));
/* (R2) a sound taken for theirs: the belief moves to where it heard it (fuzzy, as the sound is), with a heading from the last evidence */
function skHeardQuarry(e, H, q) {
  const dt = q.t - H.bt, moved = Math.hypot(q.x - H.x, q.y - H.y);
  if (dt > .25 && dt < 3 && moved > .6 * (q.u + H.u)) {                            // a heading only from a move larger than the sounds' own fuzz
    let vx = (q.x - H.x) / dt, vy = (q.y - H.y) / dt; const sp = Math.hypot(vx, vy); if (sp > 300) { vx *= 300 / sp; vy *= 300 / sp; }
    const k = H.ev === 'seen' ? .35 : .5; H.vx = lerp(H.vx, vx, k); H.vy = lerp(H.vy, vy, k);
  } else if (dt >= 3) { H.vx *= .5; H.vy *= .5; }
  H.x = q.x; H.y = q.y; H.u = q.u; H.bt = q.t; H.evAt = q.t; H.ev = 'heard'; H.hAt = q.t; H.heard++; e.tally.heardQ++; H.badA.length = 0;   // (new evidence: its turns are thought afresh)
  H.conf = Math.max(H.conf, lerp(SK.hearConf[0], SK.hearConf[1], clamp(q.I, 0, 1)));
  skMindLog(e, H, q.t, 'heard', q.x, q.y, q.u, q.type || 'a sound');                 // (R11) anonymous: a sound that fits where they could be
}
/* (R2) open floor at or near a point (rings of 8 out to 200 px; the level's shape only), or null */
function skFloorNear(eng, e, x, y) {
  const geo = eng.geo, c = e.rc + 2; if (geo.clear(x, y, c, 'walk')) return { x, y };
  for (let R = 40; R <= 200; R += 40) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, qx = x + Math.cos(a) * R, qy = y + Math.sin(a) * R; if (geo.clear(qx, qy, c, 'walk')) return { x: qx, y: qy }; }
  return null;
}
/* (R2) its belief as a record of the kind skPredict reads (a place, a heading, when): its own evidence, never the engine's record */
const skBeliefRec = H => ({ id: H.pid, lkx: H.x, lky: H.y, lvx: H.vx, lvy: H.vy, seenAt: H.bt, heardAt: H.bt });
function skFailed(H, x, y, now, k) { H.failed.push({ x: Math.round(x), y: Math.round(y), t: now, k }); while (H.failed.length > 4) H.failed.shift(); skMindLog(null, H, now, 'disproved', x, y, 0, k); }
function skBadTurn(H, a) { H.badA.push(a); while (H.badA.length > 3) H.badA.shift(); }
/* (R1) its preferred answer to being seen, drawn once for the next hunt from its own stream */
const skStyle = e => e.styleNext || (e.styleNext = e.huntRng() < lerp(.3, .75, sm(.4, .8, e.hunger)) ? 'flank' : 'bait');
const skForget = e => lerp(SK.forget[0], SK.forget[1], e.hunger) * (.85 + .3 * e.tr.PERSISTENCE);
const skTries = e => Math.round(lerp(SK.huntTries[0], SK.huntTries[1], sm(.4, .95, e.hunger)));   // (R2) guesses in one hunt
/* where it believes its quarry is now: the last evidence carried along their heading (not through a wall), the uncertainty growing */
function skBelief(eng, e, H) {
  const age = Math.max(0, eng.now - H.bt), sp = Math.hypot(H.vx, H.vy);
  let D = Math.min(sp * Math.min(age, 3.5) * .6, 600);
  if (D > 0 && sp > 20) D = Math.max(0, Math.min(D, eng.geo.ray(H.x, H.y, Math.atan2(H.vy, H.vx), D + 40) - 34));
  return { x: H.x + (sp > 20 ? H.vx / sp * D : 0), y: H.y + (sp > 20 ? H.vy / sp * D : 0), u: H.u + 60 + age * 90 };
}
/* a person it may hunt now: not on its cooldown list - or, starving, one it left a while ago and now sees again, with effort left for them */
function skMayHunt(eng, e, r) {
  if (!e.left.has(r.id)) return true;
  if (e.hunger < SK.huntHunger || !r.seen) return false;                              // (R16d: from mild hunger up - R8 only starving - and only on sight)
  const at = e.leftAt && e.leftAt.get(r.id);
  return at !== undefined && eng.now - at >= skRefractory(e.hunger) && skCarried(eng, e, r.id) < skBudget(e) * .85;   // (R16d: the hungrier, the sooner - skRefractory)
}
/* a spot at their side that they cannot see (from where it perceives them): no farther from them than it is now, reachable, dark rather
 * than lit; a few candidates by straight line, then (R13) the best SKC.tries asked for a COVERT WAY (ai.skin.cover.js: out of every view it
 * knows of after a withdrawal straight away from them, audited point by point) - R8 took the first whose route was short, however exposed.
 * R (R13): the band of distances from them to look in (default: from SK.flankMin to where it is) */
function skFlankSpot(eng, e, p, d, pid, R, rng) {
  // (R13) within a rush of them where it can (an ambush must be near enough to be sprung); out of their view by their screen's rules - behind
  // something, or in the dark where it can watch them without being made out (better: it sees them come)
  const geo = eng.geo, a0 = Math.atan2(e.y - p.y, e.x - p.x), cands = [], rmin = R ? R[0] : SK.flankMin, rmax = R ? R[1] : Math.max(SK.flankMin + 40, Math.min(d, SKC.rush - 30));
  const obs = skWatchers(eng, e, pid || 0), why = [], po = obs.find(o => o.pid === pid && o.seen);
  const rnd = rng || e.streams.search;                                            // (R8's flank: its own draws, as before; R13's other uses: e.coverRng)
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, off = side * lerp(.75, 1.9, ((i >> 1) + rnd() * .6) / 7), Rr = clamp(lerp(rmin, rmax, .55 + .4 * rnd()), rmin, Math.max(rmin, rmax));
    const a = a0 + off, x = p.x + Math.cos(a) * Rr, y = p.y + Math.sin(a) * Rr;
    if (!geo.clear(x, y, e.rc + 2, 'walk')) continue;
    const los = skBodyInSight(geo, p.x, p.y, x, y); if (los && (!po || skSpotExposed(eng, po, x, y))) continue;   // it must be out of their view (R16: all of it, as drawn waiting)
    const lamp = geo.lamp[geo.cellAt(x, y)] || 0, way = Math.hypot(x - e.x, y - e.y);
    cands.push({ x, y, R: Rr, s: -way * .6 - lamp * 300 - Math.abs(Math.abs(off) - 1.2) * 120 + (los ? 150 : 0) + rnd() * 60 });
  }
  cands.sort((a, b) => b.s - a.s);
  for (const c of cands.slice(0, SKC.tries)) {
    const W = skCovertWay(eng, e, c.x, c.y, obs, Math.max(1600, d * 4.5));       // (no longer than this: it would be there long after they have moved)
    if (W.ok) return { x: c.x, y: c.y, L: W.len, way: W };
    why.push(W.why + (W.seenAt ? '@' + W.seenAt.join(',') : W.len ? ':' + W.len : ''));
  }
  e.dbg.cover = { at: +eng.now.toFixed(1), k: R ? 'nearer' : 'flank', why: why.join('/') || 'no_spot' };
  return null;
}
/* (R19) what a way round is worth, by the time it would take: its covert way's withdrawal (at its stalk), its hidden run (at its run), its
 * quiet last stretch (SKC.sprintFrom + SKC.settle, at its stalk) and its settling there (SK.flankSettle).  Somebody it sees moving (over
 * 60 px/s) will not wait for it: carried on as it sees them going (their seen velocity - no route, no knowledge of where they mean to go),
 * where they would be when it got there lies within SKC.rush of its spot, or there is no way round them (the owner's "clever but absent"
 * detour after a walker; the independent review: a soft weight let it be taken a think later anyway).  Somebody standing still is there
 * when it arrives - but a long way round is time it is not on them: beyond what coming on openly would take (at its press when it may
 * run, else its prowl) it may spend SK.detour (by its hunger: the hungrier, the less), and the more it is over, the less the way round is
 * worth (Scene B: a starving one presses rather than vanish for ten seconds).  f: 1 .. .15 (somebody moving: 1 or 0).  Its paces as they are now (skSpeed: tired, slower), its own route and
 * its own sight of them only */
function skFlankWorth(e, p, d, fs) {
  const L = fs.way ? fs.way.len : fs.L, exit = fs.way ? Math.min(L, fs.way.exit || 0) : 0, quiet = Math.min(L - exit, SKC.sprintFrom + SKC.settle), stalk = skSpeed(e, 'stalk');
  const etaF = exit / stalk + Math.max(0, L - exit - quiet) / skSpeed(e, 'run') + quiet / stalk + SK.flankSettle, v = Math.hypot(p.vx, p.vy);   // (its paces as they are now: tired, slower)
  const vOpen = e.hunger >= SK.chaseHunger ? lerp(skSpeed(e, 'investigate'), skSpeed(e, 'press'), sm(SK.chaseHunger, .8, e.hunger)) : skSpeed(e, 'prowl'), etaD = d / vOpen;
  if (v > 60) {                                                                  // (somebody moving: by then beyond its spring of the spot - no way round, whatever else it weighs)
    const off = Math.hypot(p.x + p.vx * etaF - fs.x, p.y + p.vy * etaF - fs.y);
    return { etaF: +etaF.toFixed(1), etaD: +etaD.toFixed(1), v: Math.round(v), off: Math.round(off), f: off <= SKC.rush ? 1 : 0 };
  }
  const B = lerp(SK.detour[0], SK.detour[1], sm(SK.chaseHunger, .9, e.hunger)), over = etaF - etaD - B;
  return { etaF: +etaF.toFixed(1), etaD: +etaD.toFixed(1), B: +B.toFixed(1), f: over <= 0 ? 1 : clamp(1 - over / B, .15, 1) };
}
/* (R19) where an open approach heads (the S track's "short contest"): at them - or, from SK.contestFrom near and beyond its footwork's
 * range, hungry, with them in its sight and standing (seen at 60 px/s or less: somebody walking or running is R18's open approach and
 * chase, unchanged), for their way out when it lies to their side (a doorway, a side passage: skWayOut, the reckoning its footwork
 * already uses), a little way out along it (30 % of the distance, 100-200 px, short of the wall), where it can stand and reach them, and
 * that it can walk straight to with them in its sight all the way: what it cuts off is the way they would take.  Kept while they stay
 * within SK.contestKeep of where it chose it (no flicker); they can still take another way, or turn back.  Its own sight of them and the level's shape only.  Returns the point to head for (they themselves, or
 * the point by their way out) */
function skContest(eng, e, r, p, d, P) {
  const now = eng.now, geo = eng.geo;
  if (P.mode !== 'open' || P.shadow || P.rush || !r.seen || d <= SKF.near || d > SK.contestFrom || e.hunger < SK.huntHunger || e.disguise || Math.hypot(p.vx, p.vy) > 60) { P.cp = null; return p; }
  const K = P.cp;
  if (K && Math.hypot(p.x - K.rx, p.y - K.ry) < SK.contestKeep) return K.c ? K : p;
  const way = skWayOut(geo, e, p, p.vx, p.vy), off = Math.abs(angDiff(way, Math.atan2(p.y - e.y, p.x - e.x)));
  let c = null;
  if (off >= SK.contestOff) {
    const k = Math.min(clamp(d * .3, 100, 200), geo.ray(p.x, p.y, way, 240) - e.rc - 20);
    if (k >= 60) { const x = p.x + Math.cos(way) * k, y = p.y + Math.sin(way) * k;
      // (the independent review: a point it had to reach by a route out of their sight took it out of its own sight of them - lost, it
      // listened and searched; so only a point it can walk straight to with them in its sight all the way, else at them, as R18)
      const L = Math.hypot(x - e.x, y - e.y), n = Math.max(1, Math.ceil(L / 60));
      let seen = geo.clear(x, y, e.rc + 2, 'walk') && geo.lineClear(x, y, p.x, p.y, e.rc, 'walk') && geo.lineClear(e.x, e.y, x, y, e.rc + 7, 'walk');   // (7: the shared route margin, NAV_MARGIN)
      for (let i = 1; i <= n && seen; i++) seen = geo.los(e.x + (x - e.x) * i / n, e.y + (y - e.y) * i / n, p.x, p.y);
      if (seen) c = { x, y }; }
  }
  P.cp = { rx: p.x, ry: p.y, c: !!c, x: c ? c.x : p.x, y: c ? c.y : p.y, way: +way.toFixed(2) };
  if (c) { e.tally.contest++; e.dbg.pos = { at: +now.toFixed(2), k: 'contest', pid: r.id, why: `it heads for P${r.id}'s way out (${Math.round(off * 57.3)} deg off straight beyond them)` }; }
  return c ? P.cp : p;
}
/* the hunt has no plan and the quarry is out of sight: listen first, then its next guess (skGuess); or give up for a reason.  pre: what
 * ended the last step (it begins the reason given) */
function skHuntNext(eng, e, pre) {
  const H = e.hunt, now = eng.now, r = e.mem.p.get(H.pid), P0 = pre ? pre + ': ' : '';
  if (!r || tgtGone(eng, e, r)) { skHuntEnd(eng, e, 'its quarry is gone'); return; }
  const age = Math.round(now - H.evAt);
  if (e.exh) { skLeave(eng, e, r, `${P0}exhausted: it lets P${r.id} go`); return; }
  if (H.conf < SK.huntLow) { e.tally.huntCold++; skLeave(eng, e, r, `${P0}no sign of P${r.id} for ${age} s: it gives up`); return; }
  if (now - H.listenAt > 6) { skListenLost(eng, e, r, `${P0}it has lost P${r.id}: it stands still and listens`); return; }
  if (H.tries >= skTries(e)) { e.tally.huntCold++; skLeave(eng, e, r, `${P0}it searched for P${r.id} ${H.tries} times: it gives up`); return; }
  const G = skGuess(eng, e, H);
  if (!G) { e.tally.huntCold++; skLeave(eng, e, r, `${P0}nowhere left to look for P${r.id}: it gives up`); return; }
  H.tries++; H.guess = G.k; skMindLog(e, H, now, 'inferred', G.x ?? G.g.qx, G.y ?? G.g.qy, H.u, G.k + (G.hyp ? ` way ${G.hyp} p ${(H.hyp.list.find(h => h.id === G.hyp) || { p: 0 }).p.toFixed(2)}` : ''));   // (R11) its guess, as evidence it made itself
  if (G.k === 'intercept') { skIntercept(eng, e, r, G.g, P0); return; }
  if (G.k === 'alt') { H.altTried = now; e.tally.alt++; }
  skSearch(eng, e, r, P0 + (G.k === 'alt' ? `it tries the other way P${r.id} could have gone` : G.k === 'route' ? `it goes the way it thinks P${r.id} went (${H.ev} ${age} s ago)` : G.k === 'last' ? `it goes back to where it last had P${r.id} (${H.ev} ${age} s ago)` : G.k === 'open' ? `it tries a way P${r.id} could have left by (no heading: ${H.ev} ${age} s ago)` : `it goes to where it believes P${r.id} is (${H.ev} ${age} s ago)`), { x: G.x, y: G.y }, { turnA: G.a ?? null });
}
/* (R2) its next guess, from its belief only: the way it predicts they went (while that is fresh enough to get ahead of them: an
 * interception), where they would be by now along that way, the other way at the same first turn, where it believes they are, the place
 * it last had them.  Each is scored; a place near a guess that failed is not a candidate, nor a turn that failed (H.badA, forgotten when
 * new evidence comes); a seeded element (its own stream, less for the cleverer) lets it choose wrong.  It never looks at where they
 * really are. */
function skGuess(eng, e, H) {
  const now = eng.now, age = now - H.bt, B = skBelief(eng, e, H), C = [], rej = [], geo = eng.geo, rec = skBeliefRec(H), run = skSpeed(e, 'run');
  const near = (x, y) => H.failed.some(f => f.t > H.bt && Math.hypot(f.x - x, f.y - y) < SK.failedNear);   // (a failure older than its newest evidence no longer counts)
  const ok = q => q && !near(q.x, q.y) && geo.clear(q.x, q.y, e.rc + 2, 'walk');
  const stopped = H.ev === 'heard' && H.heard >= 2 && age > 1.5;                    // footsteps that stopped: they are likely near where they stopped
  const along = R => { let i = Math.min(R.pts.length - 1, Math.round(clamp(140 * age + 150, 250, SK.predictLook) / 48)); while (i > 2 && !geo.clear(R.pts[i].x, R.pts[i].y, e.rc + 2, 'walk')) i--; return R.pts[i]; };
  // (R12) the ways it holds (skHyps): each guess is labelled with the way it lies on, weighed by how likely that way is now, and a guess on
  // a way that evidence has ruled out (a sound that does not fit it, an empty place, a failed turn) is not made
  const Y = skHyps(eng, e, H), pm = Math.max(...Y.list.map(h => h.p)), wt = h => h ? Math.max(-1.2, .45 * Math.log(Math.max(1e-3, h.p) / pm)) : 0;
  const way = (k, x, y) => { const h = skHypOf(Y, x, y); if (h && h.f < 1) { rej.push([k, h.id, 'disproved']); return false; } if (h && h.p < SKI.minP) { rej.push([k, h.id, 'unlikely']); return false; } return h || null; };
  if (Math.hypot(H.vx, H.vy) > 60 && age < SKI.fresh) {                          // its walk of their way (R8's, its seeded error), while fresh enough to get ahead
    const g = skPredict(eng, e, rec);
    if (!g) rej.push(['intercept', 0, 'late_to_intercept']);
    else if (near(g.qx, g.qy) || near(g.x, g.y) || (g.turns.length && H.badA.some(b => Math.abs(angDiff(g.turns[0].a, b)) < .3))) rej.push(['intercept', 0, 'disproved']);
    else { const h = way('intercept', g.qx, g.qy); if (h !== false) { g.hyp = h ? h.id : 0; C.push({ k: 'intercept', g, hyp: g.hyp, s: 1.2 + wt(h) }); } }
  } else rej.push(['intercept', 0, Math.hypot(H.vx, H.vy) > 60 ? 'evidence_stale' : 'no_heading']);
  const R1 = skRoute(eng, e, rec, H.badA.length ? { avoid: H.badA } : null);
  if (R1) {
    const q = along(R1), h = q && way('route', q.x, q.y);
    if (h !== false) { if (ok(q)) C.push({ k: 'route', hyp: h ? h.id : 0, x: q.x, y: q.y, a: R1.turns.length ? R1.turns[0].a : null, s: (stopped ? .85 : H.ev === 'heard' ? 1.05 : 1) + wt(h) }); else rej.push(['route', h ? h.id : 0, q && near(q.x, q.y) ? 'disproved' : 'no_floor']); }
    if (R1.turns.length) { const R2 = skRoute(eng, e, rec, { avoid: H.badA.concat([R1.turns[0].a]) }); if (R2 && R2.turns.length) { const q2 = along(R2), h2 = q2 && way('alt', q2.x, q2.y);
      if (h2 !== false) { if (ok(q2)) C.push({ k: 'alt', hyp: h2 ? h2.id : 0, x: q2.x, y: q2.y, a: R2.turns[0].a, s: (H.badA.length ? 1.05 : .8) + wt(h2) }); else rej.push(['alt', h2 ? h2.id : 0, q2 && near(q2.x, q2.y) ? 'disproved' : 'no_floor']); } } }
  } else rej.push(['route', 0, 'no_heading']);
  const b = skFloorNear(eng, e, B.x, B.y), L = skFloorNear(eng, e, H.x, H.y);          // (a heard place is fuzzy: it may fall in a wall)
  if (ok(b) && !C.some(c => Math.hypot((c.x ?? c.g.x) - b.x, (c.y ?? c.g.y) - b.y) < 120)) { const h = way('belief', b.x, b.y); if (h !== false) C.push({ k: 'belief', hyp: h ? h.id : 0, x: b.x, y: b.y, s: (stopped ? 1.25 : H.ev === 'heard' ? 1.1 : .9) + wt(h) }); }
  else rej.push(['belief', 0, b ? (near(b.x, b.y) ? 'disproved' : 'on_a_way') : 'no_floor']);
  if (ok(L) && (!b || Math.hypot(b.x - L.x, b.y - L.y) > 150)) C.push({ k: 'last', x: L.x, y: L.y, s: .6 });
  // (R18, the owner's section 7: "check an adjacent opening ... abandon a bad guess and evaluate another") with no heading to go on - they
  // were still when it last had them - the open ways out of that place: from where it last had them, the directions with open floor, as
  // far along each as somebody leaving that way would be by now.  The level's shape only: never where they are.  Weaker than any guess
  // from evidence; one that fails is not tried again (near).  R8-R16i: with no heading, once the place itself was empty, it gave up
  if (Math.hypot(H.vx, H.vy) <= 60 && e.hunger >= SK.huntHunger) {
    const reach = clamp(140 * age + 150, 250, 700);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU, Rr = geo.ray(H.x, H.y, a, reach + 60); if (Rr < 250) continue;
      const q = skFloorNear(eng, e, H.x + Math.cos(a) * Math.min(reach, Rr - 50), H.y + Math.sin(a) * Math.min(reach, Rr - 50));
      if (!ok(q) || C.some(c => Math.hypot((c.x ?? c.g.x) - q.x, (c.y ?? c.g.y) - q.y) < 200)) continue;
      const h = way('open', q.x, q.y); if (h === false) continue;
      C.push({ k: 'open', hyp: h ? h.id : 0, x: q.x, y: q.y, a, s: .5 + wt(h) });
    }
  }
  for (const c of C) c.s += (e.huntRng() - .5) * .5 * (1.3 - e.tr.INTELLIGENCE);
  // (R12) a way it holds that none of these lies on, likely enough: where they would be along it by now is a guess too (after R8's draws)
  for (const h of Y.list) {
    if (h.k === 'stop' || C.some(c => c.hyp === h.id)) continue;
    if (h.f < 1) { rej.push(['way', h.id, 'disproved']); continue; }
    if (h.p < SKI.minP) { rej.push(['way', h.id, 'unlikely']); continue; }
    const q = skHypAt(Y, h, now, geo, e.rc + 2); if (!ok(q)) { rej.push(['way', h.id, q && near(q.x, q.y) ? 'disproved' : 'no_floor']); continue; }
    C.push({ k: 'way', hyp: h.id, x: q.x, y: q.y, a: h.turns.length ? h.turns[0].a : null, s: .75 + wt(h) + (e.huntRng() - .5) * .5 * (1.3 - e.tr.INTELLIGENCE) });
  }
  // (R12) time and uncertainty: a place far away is reached late, and by then they could be anywhere within a wider ring - weaker
  for (const c of C) {
    const x = c.x ?? c.g.x, y = c.y ?? c.g.y, T = Math.hypot(x - e.x, y - e.y) * 1.2 / run, u = B.u + 90 * T;
    c.T = +T.toFixed(1); c.u = Math.round(u); c.s -= .02 * T + (u > SKI.uWeak ? .2 : 0);
  }
  C.sort((a, b) => b.s - a.s || a.k.localeCompare(b.k));
  for (const c of C.slice(1)) rej.push([c.k, c.hyp || 0, 'less_likely']);
  Y.bet = C.length ? C[0].hyp || 0 : 0;
  e.dbg.guess = { at: +now.toFixed(1), k: C.length ? C[0].k : '-', hyp: Y.bet, of: C.map(c => c.k).join('/'), rej: rej.slice(0, 8) };
  H.rej = rej.slice(0, 8);
  return C[0] || null;
}
function skListenLost(eng, e, r, why) {
  const H = e.hunt; if (H) H.listenAt = eng.now;
  e.tally.listenLost++;
  skBegin(eng, e, 'listen', r, why, { until: eng.now + rand(e, SK.listenLost[0], SK.listenLost[1]) * (1.3 - .6 * sm(.5, 1, e.hunger)), look0: e.ang });
}

/* ---- T3: lying in wait, prediction, interception, a short chase, searching; all from its own evidence ---- */
/* where it believes they are going, and where it can be first: from the last record (place and heading, seen or heard) it walks their
 * heading through the level; where something blocks the way it guesses which side they take (the turn that best keeps the heading, plus
 * a seeded error that INTELLIGENCE shrinks and starvation grows; at most SK.predictTurns guesses).  On that route it takes the first point
 * it can reach before them (their speed from the record, its own run speed, a rough path factor) and, beside it, a spot out of sight of
 * anybody coming along the route.  It can be wrong: it never looks at where they really went. */
/* (R2) their way through the level from a record: Trial 3's walk, on its own (the same draws, in the same order).  o.avoid: angles it
 * will not take at the first turn - the other way, once the first guess there has failed */
function skRoute(eng, e, r, o) {
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
        if (o && o.avoid && !turns.length && o.avoid.some(b => Math.abs(angDiff(a, b)) < Math.PI / 5)) continue;
        n++; const sc = Math.cos(k * Math.PI / 8) + (e.streams.search() - .5) * (1.35 - e.tr.INTELLIGENCE) * 1.6 * (e.hunger >= SK.band[3] ? 1.6 : 1);
        if (sc > bs) { bs = sc; best = a; }
      }
      if (best === null) break;                                                  // a dead end: they will have to come back this way
      turns.push({ x: Math.round(x), y: Math.round(y), a: +(((best % TAU) + TAU) % TAU).toFixed(2), n }); th = best;
    }
    x += Math.cos(th) * 48; y += Math.sin(th) * 48; s += 48; pts.push({ x, y, s });
  }
  return pts.length < 5 ? null : { pts, turns, s };
}
function skPredict(eng, e, r) {
  const R = skRoute(eng, e, r); if (!R) return null;
  e.tally.predQ = (e.tally.predQ || 0) + 1;
  const geo = eng.geo, sp = Math.hypot(r.lvx, r.lvy), { pts, turns, s } = R;
  // the first point of that route it can be at before them: a quick estimate, then its own route there (at most four routes worked out)
  const age = eng.now - Math.max(r.seenAt, r.heardAt), v = clamp(sp, 90, 300), run = skSpeed(e, 'run');
  let q = null, tries = 0;
  let slack = 0;
  for (const c of pts) {
    if (c.s < 160) continue;
    const left = c.s / v - age - SK.predictMargin;                               // the seconds before they are there
    if (Math.hypot(c.x - e.x, c.y - e.y) * 1.15 / run >= left) continue;
    if (++tries > 4) break;
    const way = geo.path(e.x, e.y, c.x, c.y, e.caps, { maxNodes: 3000 }); e.tally.pathQ = (e.tally.pathQ || 0) + 1; if (!way) continue;
    let L = 0, ax = e.x, ay = e.y; for (const w of way) { L += Math.hypot(w.x - ax, w.y - ay); ax = w.x; ay = w.y; }
    if (L / run < left) { q = c; slack = left - L / run; break; }                // (R12: how much sooner it is there than they are, on its real route)
  }
  if (!q) return null;                                                           // it cannot get ahead of them
  const qi = pts.indexOf(q), back = pts[Math.max(0, qi - 4)];                     // where somebody coming along the route is just before
  const comes = [2, 4, 6, 8].map(k => pts[Math.max(0, qi - k)]);                  // (R13) the way they come: hidden from all of it, not from one point
  let S0 = null, bs = -1e9;
  for (let k = 0; k < 16; k++) {                                                 // a spot beside that point, out of sight of the way they come
    const a = e.streams.search() * TAU, d = 40 + e.streams.search() * 140, sx = q.x + Math.cos(a) * d, sy = q.y + Math.sin(a) * d;
    if (!geo.clear(sx, sy, e.rc + 2, 'walk') || !geo.lineClear(q.x, q.y, sx, sy, e.rc, 'walk')) continue;
    const hidden = comes.every(c => !skBodyInSight(geo, c.x, c.y, sx, sy)), sc = (hidden ? 500 : 0) - d * .6 - (geo.lamp[geo.cellAt(sx, sy)] || 0) * 250;   // (R16: all of it)
    if (sc > bs) { bs = sc; S0 = { x: sx, y: sy, hidden }; }
  }
  if (!S0) { if (!geo.clear(q.x, q.y, e.rc + 2, 'walk')) return null; S0 = { x: q.x, y: q.y, hidden: false }; }
  return { x: S0.x, y: S0.y, hidden: S0.hidden, qx: q.x, qy: q.y, jx: back.x, jy: back.y, end: s < SK.predictLook && pts.length > 1, from: { x: r.lkx, y: r.lky },
    heading: +Math.atan2(r.lvy, r.lvx).toFixed(3), turns, options: turns.length ? turns[0].n : 1, lead: Math.round(q.s), slack: +slack.toFixed(2) };
}
/* (R12) a stand-in for a hunt, from a record's last evidence (before a hunt begins): only what skHyps reads */
const skHypSrc = r => ({ pid: r.id, x: r.lkx, y: r.lky, vx: r.lvx, vy: r.lvy, bt: Math.max(r.seenAt, r.heardAt), u: 20, ev: 'seen', heard: 0, badA: [], failed: [], hyp: null });
/* (R13) at a hidden spot near somebody it hunts: a nearer hidden spot within its spring by a covert way (an ambush point); or, very
 * hungry and near enough, it breaks cover and rushes them (open: they can see it come); or it waits for them there, out of their sight */
function skFromCover(eng, e, r, pre, again) {
  const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y), H = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
  const s = d > SK.pounceRange[1] ? skFlankSpot(eng, e, p, d, r.id, [SK.pounceRange[0] + 45, Math.max(SK.pounceRange[0] + 45, Math.min(SK.pounceRange[1] - 15, d - 60))], e.coverRng) : null;
  if (s) { skBegin(eng, e, 'approach', r, `${pre}: it creeps nearer under cover (${s.L} px)`, { side: 1, mode: 'covert', spot: s, way: s.way, tp: { x: p.x, y: p.y, v: Math.hypot(p.vx, p.vy) } });
    e.path = s.way.pts.slice(); e.goal = { x: s.x, y: s.y }; e.goalKey = 'covert'; e.pathAge = 0; return; }
  // (R18) the hungrier, the farther it breaks cover from: SKC.rush (360 px) at SK.chaseHunger .. SK.closeFrom (450) from .8.  Its flank's spot
  // lies within SKC.rush - 30 of where it believed them when it set out; somebody who only shifted about meanwhile left it 350-360 px off,
  // and it lay in wait for them to come, then listened and searched for a person still standing there (the dithering scene, S3)
  const rushD = lerp(SKC.rush, SK.closeFrom, sm(SK.chaseHunger, .8, e.hunger));
  if (e.hunger >= SK.chaseHunger && !e.exh && d < rushD && (r.seen || (H && H.conf >= .3))) { skBegin(eng, e, 'approach', r, `${pre}: no cover nearer - it breaks cover and rushes ${r.seen ? 'P' + r.id : 'where P' + r.id + ' was'}`, { mode: 'open', rush: 1 }); return; }
  if (again) { e.plan = null; if (H && !e.exh && H.conf >= SK.huntLow) skHuntNext(eng, e, pre); else skLeave(eng, e, r, `${pre}: it gives up on P${r.id}`); return; }   // (a second wait here: it hunts on, or goes)
  skBegin(eng, e, 'ambush', r, `${pre}: it waits there for them, out of their sight`, { until: eng.now + (e.hunger >= SK.chaseHunger ? 3 + 3 * e.tr.PATIENCE : SK.lure[0] + SK.lure[1] * e.hunger * e.tr.PATIENCE) }).face = { x: p.x, y: p.y };   // (very hungry, a short wait)
}
/* (R13) a covert move under way: the way it planned (a covert way), its phase - the WITHDRAWAL out of their view, then HIDDEN (it runs once
 * well hidden, slowing near the end to arrive quietly) - and, each think, whether anybody it sees can see it now: then its surprise is
 * spoiled (skCompromised).  Returns true when it has arrived */
function skCovertStep(eng, e, P, dt, thinkNow, r) {
  const W = P.way, goal = W.pts[W.pts.length - 1];
  if (P.lx === undefined) { P.lx = e.x; P.ly = e.y; P.done = 0; P.phase = W.exit > 0 ? 'exit' : 'hidden'; P.hidAt = P.phase === 'hidden' ? -SKC.sprintFrom : -1; P.wi = 0; P.pwi = -1; }   // (hidden from the start: it may run at once)
  P.done += Math.hypot(e.x - P.lx, e.y - P.ly); P.lx = e.x; P.ly = e.y;
  if (P.phase === 'exit' && P.done >= W.exit - 4) { P.phase = 'hidden'; P.hidAt = P.done; }
  if (thinkNow) {
    const by = skCaught(eng, e);
    if (P.phase === 'exit') { if (P.done > W.exit + 48 && by.length) { skCompromised(eng, e, P, r, by, 'its withdrawal did not take it out of their sight'); return 'failed'; } }
    else if (by.length) return skCompromised(eng, e, P, r, by, '') ? 'moving' : 'failed';
  }
  const left = Math.hypot(goal.x - e.x, goal.y - e.y);
  const run = P.phase === 'hidden' && P.done - P.hidAt >= SKC.sprintFrom && left > SKC.settle;
  const act = P.phase === 'exit' ? 'back' : run ? 'intercept' : 'creep';
  if (e.act !== act) setAct(e, act);
  if (P.phase === 'hidden') { const G = SKC.glance, c = Math.floor((eng.now - P.t0) / G[0]), g = (eng.now - P.t0) - c * G[0]; skHeadTo(e, g < G[1] ? (c % 2 ? 1 : -1) * G[2] * Math.sin(Math.PI * g / G[1]) : 0, dt); }   // (it looks back over its shoulder as it goes)
  const st = skCovertFollow(eng, e, P, run ? skSpeed(e, 'run') : skSpeed(e, 'stalk'), dt);
  if (st === 'stuck') {                                                          // (stuck: a new covert way from here, or the covert move is over)
    const W2 = skCovertWay(eng, e, goal.x, goal.y, skWatchers(eng, e, P.pid)); e.stuck = 0;
    if (W2.ok && !W2.exit) { P.way = W2; P.wi = 0; P.pwi = -1; return 'moving'; }
    e.dbg.cover = { at: +eng.now.toFixed(1), k: P.k, why: 'stuck on its covert way: ' + W2.why }; return 'failed';
  }
  return st;
}
/* (R13) seen on its covert way (SURPRISE COMPROMISED): it never goes on as if unseen.  Once it may duck back out of their sight along a new
 * covert way to the same place; very hungry and near, it comes on openly instead; otherwise it stands off where they can see it, or goes */
function skCompromised(eng, e, P, r, by, why0) {
  const now = eng.now; e.tally.compromised = (e.tally.compromised || 0) + 1;
  const who = by.map(id => id ? 'P' + id : 'somebody it heard').join(', ');
  skMindLog(e, e.hunt, now, 'disproved', e.x, e.y, 0, 'surprise compromised by ' + who);
  e.dbg.cover = { at: +now.toFixed(1), k: P.k, why: 'compromised by ' + who + (why0 ? ': ' + why0 : '') };
  const goal = P.way && P.way.pts.length ? P.way.pts[P.way.pts.length - 1] : null;
  if ((P.ducks || 0) < 1 && goal && !why0) {
    const W = skCovertWay(eng, e, goal.x, goal.y, skWatchers(eng, e, P.pid));
    if (W.ok && W.exit > 0) { P.way = W; P.ducks = (P.ducks || 0) + 1; P.lx = undefined; e.dbg.why = `${who} can see it on its way: it ducks back out of their sight`; return true; }
  }
  if (!r || tgtGone(eng, e, r)) { e.plan = null; return false; }
  const d = r.seen ? r.dist : 1e9, p = perc(eng, e, r);
  e.noFlank = { x: p.x, y: p.y, t: now }; if (e.hunt && e.hunt.pid === r.id) e.hunt.noFlank = now;   // (no way round them here, for now: it was seen trying)
  if (e.hunger >= SK.chaseHunger && !e.exh && r.seen && d < SK.chaseFrom) { skBegin(eng, e, 'approach', r, `${who} saw it on its way: its surprise is spoiled - it comes on openly`, { mode: 'open', committed: 1 }); return false; }
  if (e.hunger >= SK.huntHunger && r.seen) { skBegin(eng, e, 'watch', r, `${who} saw it on its way: its surprise is spoiled - it stands off`); return false; }
  skLeave(eng, e, r, `${who} saw it on its way: it goes`); return false;
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
function skIntercept(eng, e, r, g, pre) {
  if (e.hunger >= SK.huntHunger) skHuntBegin(eng, e, r, 'it goes to meet them');   // (R1) an interception is a hunt
  const P = skBegin(eng, e, 'intercept', r, `${pre || 'lost P' + r.id + ': '}it guesses their way (${g.turns.length ? g.turns.length + ' turn' + (g.turns.length > 1 ? 's' : '') : 'straight on'}) and goes round to meet them ${g.lead} px ahead`, { g, until: eng.now + SK.interceptMax, re: 0 });
  P.hAt = Math.max(r.heardAt, e.hunt && e.hunt.pid === r.id ? e.hunt.hAt : -99);
  skInterceptWay(eng, e, P, r, g);
  e.dbg.predict = Object.assign({ at: +eng.now.toFixed(2), pid: r.id }, g);
}
/* (R13) its way to an interception: a covert way (out of the view of everybody it sees, and of the quarry's view from where it believes
 * them, within SKC.suspectMax) to a spot hidden from the way they would come - COVERT; else R8's route off their trail, as an OPEN move */
function skInterceptWay(eng, e, P, r, g) {
  const H = e.hunt && e.hunt.pid === r.id ? e.hunt : null, B = H ? skBelief(eng, e, H) : { x: r.lkx, y: r.lky };
  const W = g.hidden ? skCovertWay(eng, e, g.x, g.y, skWatchers(eng, e, r.id, { x: B.x, y: B.y })) : { ok: false, why: 'spot_exposed' };
  P.lx = undefined; P.way = null;
  if (W.ok) { P.mode = 'covert'; P.way = W; P.cover = ''; e.path = W.pts.slice(); e.goal = { x: g.x, y: g.y }; e.goalKey = 'covert'; e.pathAge = 0; return; }
  P.mode = 'open'; P.cover = W.why; e.dbg.cover = { at: +eng.now.toFixed(1), k: 'intercept', why: W.why };
  if (e.plan === P && !P.arrived) setAct(e, 'chase');                                 // (R16: open from its first tick - the open run's act)
  plan(eng, e, g.x, g.y, { why: 'intercept', cost: skAround(eng, g.from, { x: g.qx, y: g.qy }), maxNodes: 4000 });
}
function skSearch(eng, e, r, why, goal, extra) {
  const G = goal || { x: r.lkx, y: r.lky };
  const H = r && e.hunger >= SK.huntHunger ? skHuntBegin(eng, e, r, 'it goes to look for them') : null;   // (R1) a search for somebody is a hunt
  skBegin(eng, e, 'search', r, why, Object.assign({ goal: G, until: eng.now + SK.searchMax, hAt: Math.max(r ? r.heardAt : 0, H ? H.hAt : -99), sid: e.mem.soundId || 0 }, extra));
  plan(eng, e, G.x, G.y, { why: 'search' });
}
/* the plan's person is out of its sight */
function skLost(eng, e, P, r) {
  const now = eng.now, h = e.hunger, H = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
  if (P.k === 'retreat' && (!P.arrived || now - P.arrived < SK.retreatHold)) return;          // still getting out of their sight
  if (P.k === 'retreat') {
    if (h >= SK.huntHunger && !e.exh) { skLure(eng, e, r, P); return; }                     // out of their sight, as it wanted: it lies in wait
    e.plan = null; e.target = null; e.dbg.why = 'out of sight: it goes about its business'; return;
  }
  // (R1) at its spot at their side, out of their sight (R3: not before - it does not stop half way because it turned away from them): it
  // comes at them from there, as at somebody unaware (under cover, creeping)
  if (P.k === 'flank') { skFromCover(eng, e, r, `at P${r.id}'s side, out of their sight`); return; }   // (R13: never a creep across their view)
  // they went out of sight moving: predict where they are going and try to be there first
  const moving = Math.hypot(r.lvx, r.lvy) > 60, fresh = now - Math.max(r.seenAt, r.heardAt) < 2.5;
  if (h >= SK.huntHunger && !e.exh && moving && fresh) {
    // (R12) its walk of their way (R8's), labelled with the way it lies on among those it holds; not made on a way evidence has ruled out
    const src = H || skHypSrc(r), Y = skHyps(eng, e, src), g = skPredict(eng, e, r), w = g ? skHypOf(Y, g.qx, g.qy) : null;
    if (g && !(w && w.f < 1)) { g.hyp = w ? w.id : 0; Y.bet = g.hyp; skIntercept(eng, e, r, g, ''); if (!H && e.hunt && e.hunt.pid === r.id && !e.hunt.hyp && Math.abs(e.hunt.bt - src.bt) < 1e-6) e.hunt.hyp = Y; return; }
    e.dbg.guess = { at: +now.toFixed(1), k: '-', hyp: 0, of: '', rej: [['intercept', w ? w.id : 0, g ? 'disproved' : 'late_to_intercept']] };
  }
  // (R1) a hunt goes on without them in sight: it stops to listen, then follows its belief (skHuntNext); it gives up for a stated reason
  if (H && !e.exh) { skListenLost(eng, e, r, `it lost sight of P${r.id}: it stops and listens`); return; }
  // otherwise a hungry one goes to look where it last knew them, briefly (stale evidence ends it); a less hungry one lets it go
  if (h >= SK.huntHunger && !e.exh && r.conf > .25) { skSearch(eng, e, r, `lost P${r.id}: it goes to look where it last knew them`); return; }   // (R18: from huntHunger, was very hungry)
  if (P.k === 'chase') { skLeave(eng, e, r, `lost P${r.id} in the chase; not worth a search`).race = true; return; }   // (B2: a lost race stays a departure)
  e.plan = null; e.target = null; e.dbg.why = 'it lost sight of them';
}
/* nobody in view: a fresh, real sound (footsteps, a door, a fall), or a light glimpsed, that it has not gone after yet */
function skListen(eng, e) {
  const now = eng.now, H = e.hear, hm = sm(.3, .6, e.hunger);
  if (H && now - H.t < SK.heardFresh && H.I >= SK.heardMin && H.id > e.dbg.soundSeen && !(H.pid && e.left.has(H.pid))) {
    e.dbg.soundSeen = H.id;
    const r = H.pid ? e.mem.p.get(H.pid) : null;
    // (R2) first it stops, turns its head to it and listens; what it heard next decides (skCurious).  (R16e) the hungrier, the shorter
    skBegin(eng, e, 'listen', r, `it heard ${H.type || 'something'}${r ? ' (P' + r.id + ')' : ''}: it stops and listens`,
      { until: now + rand(e, SK.curious[0], SK.curious[1]) * (.8 + .4 * e.tr.PATIENCE) * (1 - .5 * hm), curious: { x: H.x, y: H.y, u: H.u, t: H.t, I: H.I, id: H.id, type: H.type || '' } });
    return true;
  }
  // (R16e) something moved at the edge of its view and it did not then see who: it turns to it and, as after a strong sound, goes to look
  const M = e.look && e.look.m;
  if (M && now - M.t < .35 && !e.seenNow.size) {
    e.look.m = null;
    skBegin(eng, e, 'listen', null, 'something moved at the edge of its view: it turns to it',
      { until: now + SK.curious[0] * (1 - .5 * hm), curious: { x: M.x, y: M.y, u: M.u, t: now, I: SK.curiousStrong, id: e.mem.soundId || 0, type: 'movement' } });
    return true;
  }
  return false;
}
/* (R2) after listening to a sound while it roamed: a later sound that fits the first (the same thing, moving), or a strong first, sends it
 * to look - quietly, at the freshest place; a weak sound with nothing after it is let go.  Anonymous: it names nobody */
function skCurious(eng, e, C) {
  let q2 = null;
  for (const q of e.mem.sounds) if (q.id > C.id && eng.now - q.t < SK.heardFresh + 1 && Math.hypot(q.x - C.x, q.y - C.y) <= C.u + q.u + 120 + SK.hearReach * Math.max(0, q.t - C.t)) { q2 = q; break; }   // (newest first)
  if (!q2 && C.I < SK.curiousStrong * lerp(1, .4, sm(.3, .6, e.hunger))) { e.tally.curiousDrop++;   // (the hungrier, the fainter a sound it goes to look at)
    e.dbg.why = `nothing more after the ${C.type || 'sound'}: it lets it go`; return; }
  const g = q2 || C; e.tally.curious++;
  if (q2) e.dbg.soundSeen = Math.max(e.dbg.soundSeen, q2.id);
  // (R16e) to where it could see the place from - the nearest open floor with a clear line to it - not to the place itself
  const v = skVantage(eng, e, g.x, g.y, g.u || 0); if (v) e.tally.vantage = (e.tally.vantage || 0) + 1;
  skSearch(eng, e, null, `${C.type === 'movement' && !q2 ? 'something moved' : 'it heard ' + (q2 ? (q2.type || 'it') + ' again' : C.type || 'something')}: it goes quietly to ${v ? 'where it can see the place' : 'look'}`, v || { x: g.x, y: g.y }, { at: { x: g.x, y: g.y } });
}

/* ---- T4: the strike ---- */
/* (R11) the events a decision answers by keeping its plan: about somebody it sees; about somebody it lost */
const SK_SEEN = ['sight', 'exposed', 'hidden', 'turned', 'winded', 'reach'], SK_LOST = ['lost'], SK_ANY = SK_SEEN.concat(SK_LOST);   // (a departure carried through answers both)
const SK_STRIKE = { approach: 1, chase: 1, lure: 1, ambush: 1, intercept: 1, search: 1, mingle: 1, flank: 1, listen: 1 };    // the plans it springs from (never while watching, retreating, leaving or feeding; R1: a flank, a pause to listen)
/* on its think: somebody in arm's reach of a hungry one is grabbed; somebody its plan is about, in sight 55-185 px away, it springs at */
function skStrike(eng, e) {
  if (e.exh || e.hunger < SK.huntHunger || eng.now < e.pounceCool || e.commit || e.cap) return false;
  const geo = eng.geo;
  for (const pv of eng.nearPlayers(e.x, e.y, SK.grabReach)) {                    // arm's reach: contact is physics, not perception
    if (!pv.alive || pv.caught || !geo.lineClear(e.x, e.y, pv.x, pv.y, 3, 'walk')) continue;
    if (e.plan && e.plan.k === 'feed' && e.hunger < SK.band[2]) break;             // (a feeding one that has eaten does not)
    const W0 = e.plan; if (W0 && W0.pid === pv.id && W0.came === undefined && (W0.k === 'lure' || W0.k === 'ambush' || (W0.k === 'intercept' && W0.arrived))) { W0.came = eng.now; e.tally[W0.k + 'Came']++; }   // (R13: they came to where it waited - into its reach)
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
  if (P.came === undefined && (P.k === 'lure' || P.k === 'ambush' || (P.k === 'intercept' && P.arrived))) { P.came = eng.now; e.tally[P.k + 'Came']++; }   // (R13: they came to where it waited)
  skSpring(eng, e, Math.atan2(ay - e.y, ax - e.x) + err, r.id, 'pounce', `it springs at P${r.id} (${Math.round(d)} px)`);
  return true;
}
function skSpring(eng, e, dir, tid, style, why) {
  skMindKept(e, eng.now, SK_ANY, 'strike');                                          // (R13) a strike answers what it saw (its think stops while it is carried through)
  const grab = style === 'grab', def = style === 'defend';                      // (B3: 'defend' - its own wind-up, lunge and cost; only tid can be caught)
  e.pounce = { t: 0, wind: grab ? SK.grabWind : def ? SK.defWind : SK.pounceWind, dur: grab ? .16 : def ? SK.defDur : SK.pounceDur, speed: grab ? 200 : def ? SK.defSpeed : SK.pounceSpeed,
    cost: def ? SK.defCost : SK.pounceCost, dir, tid, style, paid: false };
  if (!def) e.tally[grab ? 'grab' : 'pounce']++; e.path = []; e.dbg.why = why; e.dbg.pounce = style;
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
  if (!L.paid) { L.paid = true; e.stam = Math.max(0, e.stam - (L.cost || SK.pounceCost)); setAct(e, 'pounce'); }   // every leap costs, hit or miss
  const k = (L.t - L.wind) / L.dur, want = L.speed * (1 - .3 * k) * dt;
  e.ang = (L.dir + TAU) % TAU; e.speed = L.speed * (1 - .3 * k);
  e.moved = moveCollide(eng, e, Math.cos(L.dir) * want, Math.sin(L.dir) * want);
  for (const pv of eng.nearPlayers(e.x, e.y, e.r + 22)) {                         // contact: a body its own body has reached, nothing solid between
    if (!pv.alive || pv.caught || Math.hypot(pv.x - e.x, pv.y - e.y) >= e.r + 18 || !eng.geo.lineClear(e.x, e.y, pv.x, pv.y, 3, 'walk')) continue;
    if (L.style === 'defend' && pv.id !== L.tid) continue;                          // (B3) a defence catches only the person it was against
    e.pounce = null; e.recover = 0; e.tally.hit++; e.dbg.pounce = L.style + ': hit'; if (L.style === 'defend') e.tally.defendHit++;
    e.aw.delete(pv.id); e.rx = null;                                                 // (B3) whatever it held against them ends with them
    skKeepSpent(eng, e); skHuntEnd(eng, e, `it has P${pv.id}`);
    e.plan = null; e.target = null; e.enc = null; e.dbg.why = `it has P${pv.id}`;           // its plan is over: the kill (the engine's capture) takes it from here
    return { pv, dir: L.dir, speed: e.speed, style: L.style };
  }
  if (e.moved < want * .4) { e.pounce = null; e.recover = SK.recoverWall; e.pounceCool = eng.now + rand(e, SK.pounceCool[0], SK.pounceCool[1]); setAct(e, 'recover'); e.tally.wall++; e.dbg.pounce = 'into a wall'; e.dbg.why = 'it leapt into a wall: stunned'; if (L.style === 'defend') { e.tally.defendMiss++; e.defLeave = L.tid; } return null; }
  if (k >= 1) { e.pounce = null; e.recover = rand(e, SK.recoverMiss[0], SK.recoverMiss[1]); e.pounceCool = eng.now + rand(e, SK.pounceCool[0], SK.pounceCool[1]); setAct(e, 'recover'); e.tally.miss++; e.dbg.pounce = 'missed'; e.dbg.why = 'it missed: it recovers'; if (L.style === 'defend') { e.tally.defendMiss++; e.defLeave = L.tid; } }
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

/* ---- behaviour refinement B1: what it notices of the people it sees (never hunting, never an attack) ---- */
const skClose = d => clamp((SK.awNear - d) / (SK.awNear - SK.awCrowd), 0, 1);   // 0 at the edge of its space, 1 when they crowd it
/* more pressure of one kind, never beyond that kind's ceiling (and never lowered by it: another kind may have raised it higher) */
function skBump(A, amt, cap, why, now) { if (amt > 0 && A.p < cap) { A.p = Math.min(cap, A.p + amt); A.why = why; A.whyAt = now; } }
/* on its think, before deciding: its records fade; everyone it SEES now in its space updates one (seen bodies only: e.seenNow) */
function skAware(eng, e) {
  const now = eng.now, el = Math.max(0, now - (e.awAt || now)), dt = Math.min(el, .25); e.awAt = now;   // el: all the time since its last look at them (far away too)
  for (const [id, A] of e.aw) {
    A.p *= Math.exp(-el / SK.pDecay);
    if (!eng.byId.has(id) || now - A.last > SK.awTtl) { e.aw.delete(id); continue; }    // gone, or not seen close for a long while
    if (A.tier && A.p < SK.pAware * .5) A.tier = 0;                                   // well below the threshold it stops minding them
    if (now - A.last > 1.2) { A.arc = 0; A.tailT = 0; A.blockT = 0; }                 // (B2) out of its sight a while: no circling, following or blocking goes on
  }
  const cvx = Math.cos(e.ang) * e.speed, cvy = Math.sin(e.ang) * e.speed, hx = Math.cos(e.ang), hy = Math.sin(e.ang), P = e.plan, walking = (!P || P.k === 'leave') && e.speed > 40;
  for (const r of skSeen(eng, e)) {                                                  // (its own hunt cooldown, e.left, does not hide anybody here)
    const v = r.visual, d = r.dist; if (d > SK.awOrbit) continue;
    let A = e.aw.get(r.id);
    if (!A) {
      if (d > SK.awNear) continue;                                                   // a record begins in its personal space
      if (e.aw.size >= SK.awMax) { let w = null; for (const q of e.aw.values()) if (!w || q.p < w.p || (q.p === w.p && q.last < w.last)) w = q; e.aw.delete(w.pid); }
      e.aw.set(r.id, A = { pid: r.id, t0: now, last: now, d: 0, p: 0, tier: 0, ack: 0, nextAck: 0, looks: 0, why: '', whyAt: -99,
        arc: 0, orbits: 0, tailT: 0, blockT: 0, byThem: 0, byIt: 0, warns: 0, warnAt: -99, warnEnd: -99, nextWarn: 0 });
    }
    A.last = now; A.d = Math.round(d);
    // in its space: the closer the more; coming at it more, going away less, by their OWN motion; and as much as THEY closed the distance
    // lately (A.byThem against A.byIt: somebody standing still that it walked up to, or backed into, has done nothing to it - B2); fast
    // motion close by catches the eye more (up to SK.pFast times)
    const ux = (v.x - e.x) / Math.max(1, d), uy = (v.y - e.y) / Math.max(1, d), rvx = v.vx - cvx, rvy = v.vy - cvy, sp = Math.hypot(v.vx, v.vy);
    const own = v.vx * ux + v.vy * uy, vr = rvx * ux + rvy * uy, k6 = Math.exp(-dt / 6);   // own: their motion away from it (< 0: coming at it)
    A.byThem = A.byThem * k6 + Math.max(0, -own) * dt; A.byIt = A.byIt * k6 + Math.max(0, cvx * ux + cvy * uy) * dt;
    const blame = (A.byThem + 1) / (A.byThem + A.byIt + 2), fast = 1 + (SK.pFast - 1) * clamp((Math.hypot(rvx, rvy) - 100) / 200, 0, 1);
    if (d < SK.awNear) skBump(A, SK.pNear * skClose(d) * (own < -40 ? 1.3 : own > 60 ? .4 : 1) * (.3 + .7 * blame) * fast * dt, SK.capNear, 'close by', now);
    if (d < SK.awCrowd && blame > .5) skBump(A, SK.pCrowd * blame * dt, SK.capCrowd, 'crowding it', now);
    // (B2) circling it: their motion round it, relative to its own, one way (only while it sees them; a straight pass is less than half a turn)
    A.arc += (((v.x - e.x) * rvy - (v.y - e.y) * rvx) / Math.max(1, d * d)) * dt;
    if (Math.abs(A.arc) >= SK.orbitArc) { A.orbits++; A.arc -= Math.sign(A.arc) * Math.PI; skBump(A, SK.pOrbit, SK.capOrbit, 'circling it', now); }
    // following it: moving its way, beside or behind it, while it walks; standing in its way: ahead of it, in its lane, while it has a way to go
    const along = (v.x - e.x) * hx + (v.y - e.y) * hy, lat = Math.abs((v.y - e.y) * hx - (v.x - e.x) * hy);
    if (walking && d < SK.awTail && sp > 50 && v.vx * hx + v.vy * hy > .6 * sp && along < 60) A.tailT += dt; else A.tailT = Math.max(0, A.tailT - 2 * dt);
    if (A.tailT >= SK.tailMin) skBump(A, SK.pTail * dt, SK.capTail, 'following it', now);
    if ((!P || P.k === 'leave') && e.path.length && sp > 40 && along > 0 && along < SK.awBlock && lat < 60) A.blockT += dt; else A.blockT = Math.max(0, A.blockT - 2 * dt);   // (moving into its way: somebody standing still is not blocking it)
    if (A.blockT >= .6) skBump(A, SK.pBlock * dt, SK.capBlock, 'in its way', now);
    // pressing in after it has warned them: close, and not backing off - by their own motion, and as much as they closed the distance
    // (the creature walking up to somebody standing still is not them pressing in)
    if (now - A.warnEnd < SK.pressFor && d < SK.pressNear && own < 30) skBump(A, SK.pPress * (.5 + .5 * skClose(d)) * blame * dt, SK.capPress, 'pressing in after its warning', now);
    if (!A.tier && A.p >= SK.pAware) { A.tier = 1; A.ack = now; }
  }
}
/* after deciding: while it roams or leaves (and is itself), it reacts to what it has noticed - an overlay, the plan is kept */
function skAttend(eng, e) {
  const now = eng.now, P = e.plan;
  if (e.rx || e.disguise || e.pounce || e.recover > 0 || (P && P.k !== 'leave')) return;
  let A = null; for (const q of e.aw.values()) if (q.tier && now - q.last < .05 && (!A || q.p > A.p)) A = q;   // noticed, and seen on this very think
  if (A && A.p >= SK.pWarn && now - A.ack >= SK.warnAfter && now >= A.nextWarn && A.d < SK.awNear + 60) { skWarn(eng, e, A); return; }   // (B2)
  if (P && P.fast) return;                         // fleeing (a withdrawal, or leaving after a missed defence) it does not stop to look - its head still turns; chased down, it may still warn
  // (R11) a person it has only just seen, who meets its eyes (within SK.ackEyes) or comes its way (within SK.ackCome): it stops and looks
  // at them, once, whatever it then does - whatever its hunger (a departure goes on afterwards)
  if (e.mind) for (const o of e.mind.obs.values()) {
    if (o.acked || now - o.firstAt > 1.5 || now - o.seenAt > .05) continue;
    const r = e.mem.p.get(o.pid); if (!r || !r.visual || tgtGone(eng, e, r)) continue;
    const v = r.visual, toward = ((e.x - v.x) * v.vx + (e.y - v.y) * v.vy) / Math.max(1, r.dist), going = P && P.k === 'leave' && e.hunger < SK.band[0], far = going ? 1.6 : 1;
    const eyes = now - o.eyesAt < .3 && r.dist < SK.ackEyes * far;
    if (r.dist < SK.awNear || (!eyes && !(toward > 40 && r.dist < SK.ackCome * far))) continue;   // (closer than its personal space: B1's own look, by what they do there)
    o.acked = now; e.tally.ack = (e.tally.ack || 0) + 1;
    if (going) { e.ackHead = { pid: o.pid, until: now + SK.ackOver }; e.dbg.rx = `it sees P${o.pid} ${eyes ? 'looking at it' : 'coming its way'}: it looks back at them as it goes`; return; }   // (satiated and going: a look over its shoulder, its departure unbroken; farther, since it costs it nothing)
    e.rx = { k: 'look', pid: o.pid, at: null, t0: now, until: now + lerp(SK.ackLook[0], SK.ackLook[1], e.awRng()) };
    e.dbg.rx = `it sees P${o.pid} ${eyes ? 'looking at it' : 'coming its way'}: it stops and looks`; return;
  }
  if (A && now >= A.nextAck) {
    e.rx = { k: 'look', pid: A.pid, at: null, t0: now, until: now + lerp(SK.look[0], SK.look[1], e.awRng()) };
    A.nextAck = e.rx.until + lerp(SK.ackGap[0], SK.ackGap[1], e.awRng()); A.looks++; e.tally.look++;
    e.dbg.rx = `it stops and looks at P${A.pid} (${A.why})`; return;
  }
  const H = e.hear;                                                                  // a fresh sound nobody it sees made: it turns to where it heard it
  if (H && !H.pid && H.src !== -1 && now - H.t < .3 && H.id > e.awSound && H.I >= SK.soundLookI && now >= e.soundLookAt && now >= (e.rxEnd || 0) + SK.rxGap && Math.hypot(H.x - e.x, H.y - e.y) < SK.soundLook) {
    e.awSound = H.id;
    e.rx = { k: 'look', pid: 0, at: { x: H.x, y: H.y }, t0: now, until: now + lerp(SK.look[0], SK.look[1], e.awRng()) * .8 };
    e.soundLookAt = e.rx.until + SK.soundGap; e.tally.lookSound++;
    e.dbg.rx = `it heard ${H.type || 'something'}: it turns to look`;
  }
}
/* the reaction in progress (every tick): it stands and faces what it noticed; at the end its plan goes on as it was */
function skReact(eng, e, dt) {
  const R = e.rx, now = eng.now, P = e.plan;
  if ((P && P.k !== 'leave') || e.disguise) { skReactEnd(eng, e, false); return false; }
  if (now >= R.until) { skReactEnd(eng, e, true); return false; }
  const r = R.pid ? e.mem.p.get(R.pid) : null, q = r && !tgtGone(eng, e, r) ? perc(eng, e, r) : R.at;
  if (R.k === 'warn') {                                                              // (B2) it turns on them, hunched, and backs away from them, slowly
    if (q) faceToward(e, q.x, q.y, dt, 4);
    const bx = q ? e.x - q.x : -Math.cos(e.ang), by = q ? e.y - q.y : -Math.sin(e.ang), L = Math.hypot(bx, by) || 1;
    e.speed = SK.warnBack; e.moved = moveCollide(eng, e, bx / L * SK.warnBack * dt, by / L * SK.warnBack * dt); e.still = true;
    if (e.state !== S.PROVOKED || e.act !== 'creep') setState(e, S.PROVOKED, 'creep');
    return true;
  }
  stopMoving(eng, e, dt); e.still = true;                                           // (its route is kept: it walks on along it afterwards)
  if (q) faceToward(e, q.x, q.y, dt, 3.2);
  if (e.act !== 'watch') setAct(e, 'watch');
  return true;
}
/* ---- B3: defence ---- */
/* no open way away from them: of seven directions away from where it sees them (straight away, and up to 1.2 rad either side), fewer than
 * two have 180 px of floor */
function skCornered(eng, e, v) {
  const a0 = Math.atan2(e.y - v.y, e.x - v.x); let open = 0;
  for (const da of [0, .4, -.4, .8, -.8, 1.2, -1.2]) if (eng.geo.ray(e.x, e.y, a0 + da, 200) >= 180) open++;
  return open < 2;
}
/* on its think, before deciding: the person it has warned, still pressing it, within its reach - strike, or withdraw (see the header) */
function skDefend(eng, e) {
  const now = eng.now;
  if (e.exh || e.disguise || e.stam < SK.defCost || now < e.pounceCool || now < (e.defNext || 0) || (e.plan && e.plan.k === 'feed')) return '';
  let A = null;
  for (const q of e.aw.values()) if (now - q.last < .05 && q.p >= SK.pDefend && q.warns && !(e.rx && e.rx.k === 'warn' && e.rx.pid === q.pid) && now - q.warnEnd >= SK.defAfterWarn && now - q.warnEnd <= SK.pressFor && now >= (q.defUntil || 0) && (!A || q.p > A.p)) A = q;
  if (!A) return '';
  const r = e.mem.p.get(A.pid); if (!r || !r.seen || !r.visual || tgtGone(eng, e, r)) return '';
  const v = r.visual, d = r.dist; if (d > SK.defReach || !eng.geo.lineClear(e.x, e.y, v.x, v.y, e.rc * .6, 'walk')) return '';   // in reach, and a way to them: nothing solid between
  if ((v.vx * (v.x - e.x) + v.vy * (v.y - e.y)) / Math.max(1, d) > 60) return '';   // they are backing away: it lets them
  const cornered = skCornered(eng, e, v);
  const odds = clamp(SK.defBase + (cornered ? SK.defCornered : 0) + SK.defPerWithdraw * (A.withdrew || 0) + (e.tr.AGGRESSION - .45) * SK.defAggr + SK.defHunger * e.hunger - (e.stam < 40 ? SK.defTired : 0), .1, .95);
  A.defUntil = now + SK.defCool; e.defNext = now + SK.defGapAll; A.defAt = now; e.rx = null; e.dbg.rx = '';
  const strike = e.awRng() < odds;
  e.dbg.def = { pid: A.pid, k: strike ? 'strike' : 'withdraw', odds: +odds.toFixed(2), cornered, p: +A.p.toFixed(2), why: A.why, h: +e.hunger.toFixed(3), at: now };
  if (strike) {
    // where it believes they will be when it reaches them (the pounce's own reckoning, from what it sees of their motion), its seeded error;
    // somebody coming straight at it would be reckoned past it: then it meets them where they are, led only by their sideways motion
    const ux = (v.x - e.x) / Math.max(1, d), uy = (v.y - e.y) / Math.max(1, d), touch = e.r + 16, vr = clamp(v.vx * ux + v.vy * uy, -300, 300);
    const tc = SK.defWind + clamp((d + vr * SK.defWind - touch) / Math.max(60, SK.defSpeed - vr), 0, SK.defDur);
    let ax = v.x + v.vx * tc, ay = v.y + v.vy * tc;
    if ((ax - e.x) * ux + (ay - e.y) * uy < touch) { ax = v.x + (v.vx - vr * ux) * tc; ay = v.y + (v.vy - vr * uy) * tc; }
    const err = (e.awRng() - .5) * (1.2 - e.tr.INTELLIGENCE) * .4;
    skSpring(eng, e, Math.atan2(ay - e.y, ax - e.x) + err, r.id, 'defend', `P${r.id} would not stop ${A.why}: it defends itself`);
    A.defs = (A.defs || 0) + 1; e.tally.defend++; eng.note(`K#${e.id} defends itself against P${r.id} (${A.why})`);
    return 'strike';
  }
  A.withdrew = (A.withdrew || 0) + 1; A.p *= .7; e.tally.withdraw++;
  skLeave(eng, e, r, `P${r.id} would not stop ${A.why}: it withdraws, fast`).fast = true; eng.note(`K#${e.id} withdraws from P${r.id}`);
  return 'withdraw';
}
/* (B2) a warning: at most one at a time, never sooner than SK.warnGap after the last ended */
function skWarn(eng, e, A) {
  const now = eng.now;
  e.rx = { k: 'warn', pid: A.pid, at: null, t0: now, until: now + lerp(SK.warnTime[0], SK.warnTime[1], e.awRng()) };
  A.warns++; A.warnAt = now; A.nextWarn = e.rx.until + SK.warnGap; A.nextAck = Math.max(A.nextAck, e.rx.until + SK.ackGap[0]); e.tally.warn++;
  e.dbg.rx = `P${A.pid} keeps ${A.why}: it turns on them, hunched, and backs away (a warning)`; eng.note(`K#${e.id} warns P${A.pid} (${A.why})`);
  setState(e, S.PROVOKED, 'creep');
}
/* the end of a reaction; a warning given (done), it turns away from them: another way out (a departure keeps its time; roaming, it leaves) */
function skReactEnd(eng, e, done) {
  const R = e.rx; e.rx = null; e.dbg.rx = ''; e.rxEnd = eng.now;
  if (R.k !== 'warn') return;
  const A = R.pid ? e.aw.get(R.pid) : null, P = e.plan; if (A && (done || eng.now - R.t0 >= SK.warnTime[0])) A.warnEnd = eng.now;   // (a warning cut short is no warning)
  if (P && SK_STATE[P.k]) setState(e, SK_STATE[P.k][0], SK_STATE[P.k][1]); else setState(e, S.ROAMING, '');
  if (!done || e.disguise) return;
  const r = R.pid ? e.mem.p.get(R.pid) : null;
  if (P && P.k === 'leave') { const g = skLeaveGoal(eng, e); if (g) { P.goal = g; plan(eng, e, g.x, g.y, { why: 'leave (warned)' }); P.rerouted = (P.rerouted || 0) + 1; e.dbg.why = `it warned P${R.pid}: it goes another way`; } }
  else if (!P && r && !tgtGone(eng, e, r)) skLeave(eng, e, r, `it warned P${R.pid}: it goes another way`);
}
/* its head while it roams or leaves: toward the person it has noticed most, while it has them in view (or a moment after) */
function skGaze(eng, e, dt) {
  const now = eng.now; let want = 0, best = null;
  if (!e.disguise) for (const A of e.aw.values()) if (A.tier && now - A.last < 1 && (!best || A.p > best.p)) best = A;
  let pid = best ? best.pid : 0, lim = 1;
  if (e.ackHead && now < e.ackHead.until && e.seenNow.has(e.ackHead.pid)) { pid = e.ackHead.pid; lim = SK.ackHead; } else if (e.ackHead && now >= e.ackHead.until) e.ackHead = null;   // (R11) a look back over its shoulder
  // (R11) nobody noticed close by: the person it notices most among those it sees, at any distance and any hunger - whoever meets its eyes,
  // then whoever could see it, then whoever comes toward it, then the nearest (a look with the head; its way goes on)
  // (a departure keeps B1's own head tracking of whoever it has noticed, as before)
  if (!pid && !e.disguise && e.mind && !(e.plan && e.plan.k === 'leave')) { let bs = -1e9; for (const id of e.seenNow) { const r = e.mem.p.get(id), o = e.mind.obs.get(id); if (!r || !r.visual || r.dist > SK.gazeFar || tgtGone(eng, e, r)) continue;
    const v = r.visual, toward = ((e.x - v.x) * v.vx + (e.y - v.y) * v.vy) / Math.max(1, r.dist), s = (o && now - o.eyesAt < .5 ? 3 : 0) + (o && o.inView ? 1 : 0) + (toward > 40 ? 1 : 0) - r.dist / 800;
    if (s > bs) { bs = s; pid = id; } } }
  if (pid) { const r = e.mem.p.get(pid); if (r && !tgtGone(eng, e, r)) { const q = perc(eng, e, r); want = clamp(angDiff(Math.atan2(q.y - e.y, q.x - e.x), e.ang), -lim, lim); } }
  else if (!e.disguise) { const ah = headAhead(eng, e); if (ah) { skSwivel(e, ah, dt, 5); return; } }   // (R20) nobody to look at: into the bend ahead
  const h = (e.head || 0) + (want - (e.head || 0)) * Math.min(1, dt * 5); e.head = Math.abs(h) < 1e-3 && !want ? 0 : h;
}
/* (R20, the N track) the head eased toward the swivel's angle, never faster than its HEAD_SWIVEL rate (no spin while it walks or runs) */
function skSwivel(e, want, dt, k) {
  const h = e.head || 0, R = e.caps.HEAD_SWIVEL.rate * dt; e.head = h + clamp((want - h) * Math.min(1, dt * k), -R, R);
}

/* ---- the decision: what it does about the people it perceives (on its think, 10 Hz near) ---- */
function skDecide(eng, e) {
  const now = eng.now, P = e.plan;
  for (const [id, until] of e.left) if (until <= now || !eng.byId.has(id)) e.left.delete(id);
  if (e.leftAt) for (const id of [...e.leftAt.keys()]) if (!e.left.has(id)) e.leftAt.delete(id);       // (R6) when it left them: only while it is leaving them alone
  for (const id of [...e.spent.keys()]) if (!eng.byId.has(id)) e.spent.delete(id);                     // (R6) the effort spent on somebody who has left the game goes with them
  if (e.defLeave) {                                                                 // (B3) its defence missed: it leaves them, fast
    const r = e.mem.p.get(e.defLeave); e.defLeave = 0;
    if (r && !tgtGone(eng, e, r)) { skLeave(eng, e, r, `its defence against P${r.id} missed: it goes`).fast = true; return; }
  }
  if (P && P.k === 'leave') {
    if (now < P.until && !(P.goal && Math.hypot(P.goal.x - e.x, P.goal.y - e.y) < 80)) {   // a departure is carried through...
      // (B2) ...unless a very hungry one, some way into it, sees somebody it may hunt now - never after a lost race, never on hunger alone
      if (!(e.hunger >= SK.chaseHunger && !e.exh && !P.race && now - P.t0 >= SK.leaveDwell && now >= (P.reT || 0) && skSeen(eng, e).some(r => skMayHunt(eng, e, r)))) { skMindKept(e, now, SK_ANY); return; }
      P.reT = now + 1;                                                               // (it thinks again at most once a second)
    } else { e.plan = null; e.dbg.why = 'it left; it roams again'; }
  }
  const all = skSeen(eng, e), seen = all.filter(r => skMayHunt(eng, e, r));                   // (R1: a starving one may take up a person it left, on fresh sight)
  if (e.heard.length) e.heard = e.heard.filter(q => now - q.at < SK.heardTtl && eng.byId.has(q.pid));   // (T6) lines expire; a person who left takes theirs
  if (P && P.k === 'feed') {                                                      // at its kill: fed, or disturbed (seen close, or watched), it goes
    const near = all.find(r => r.dist < 520 || skWatched(eng, e, r));
    if (near) { skDon(eng, e, P); skLeave(eng, e, null, `disturbed at its kill by P${near.id}`); return; }
    if (now > P.until || (e.hunger < .02 && (P.fed || 0) >= SK.skinFeed)) { skDon(eng, e, P); e.plan = null; e.dbg.why = 'fed: it roams again'; }   // (T6: a meal lasts at least SK.skinFeed: it takes its time with the body)
    return;
  }
  if (e.skin) { e.skin = null; e.tally.skinLost++; e.dbg.skin = 'left behind: it was not at its meal'; }   // (T6) a skin is only taken at the meal
  if (!seen.length) { skUnseen(eng, e); return; }
  const r = seen[0], h = e.hunger, p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y), Hn = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
  const retake = e.left.has(r.id);                                                               // (R1) somebody it left, seen again (a starving one may take them up)
  const enc = skEnc(eng, e, r, true), watched = skWatched(eng, e, r), lit = skLit(eng, e) > SK.exposed, crowd = seen.length;
  // (R13) seen: eye contact (R8's watched) OR in their view by the rules of their own screen (R11's mind: their sight mask, a clear line,
  // readable light) - a top-down player sees it whichever way they face.  Eye contact keeps its own meaning where it had one (B1-B3's
  // warnings, a mildly hungry one sent away by a look); every tactic that hides from them now hides from their view
  const mo = e.mind && e.mind.obs.get(r.id), inView = !!(mo && mo.inView && now - mo.seenAt < .2), seenMe = watched || inView;
  const spent = enc.spent / skBudget(e), T = e.tr, cur = e.plan && e.plan.pid === r.id ? e.plan.k : null;
  const waiting = cur === 'lure' || cur === 'ambush' || (cur === 'intercept' && e.plan.arrived) || cur === 'search';
  if (waiting && e.plan.came === undefined && d < 320) { e.plan.came = now; if (cur === 'lure' || cur === 'ambush') e.tally[cur + 'Came']++; else if (cur === 'intercept') e.tally.interceptCame++; else e.tally.searchFound++; }
  if (spent >= 1) { skLeave(eng, e, r, `its time with P${r.id} is spent (${Math.round(enc.spent)} s)`); return; }
  // which way they are moving, relative to it (from what it sees): running from it, or coming at it
  // (fleeing: running from it, or hurrying off after meeting its eyes - somebody who simply walks on has not noticed it)
  if (watched) enc.eyes = now;
  const away = d > 1 ? ((p.x - e.x) * p.vx + (p.y - e.y) * p.vy) / d : 0, fleeing = away > 200 || (away > 110 && now - (enc.eyes ?? -99) < 4), winded = r.ex || r.stamina < 25;
  // (T6) in a borrowed skin it does not hide: it walks up like one of them; a hungry one drops the skin to run after somebody who flees
  if (e.disguise && crowd === 1) {
    if (fleeing && h >= SK.chaseHunger && !e.exh && e.stam >= SK.stamLow + 15 && d < SK.chaseFrom && cur !== 'chase') {
      skUndress(eng, e, `P${r.id} runs: it drops the skin to give chase`); skBegin(eng, e, 'chase', r, `P${r.id} runs: it gives chase`, { dmin: d }); return;
    }
    if (cur === 'mingle' || cur === 'chase') return;
    if (fleeing) { skLeave(eng, e, r, `P${r.id} hurries away: it lets them go`); return; }
    skBegin(eng, e, 'mingle', r, `in P${e.disguise.from}'s skin it walks up to P${r.id}`, { ph: 'walk' }); return;
  }
  // lying in wait and they are walking into it, unaware: it holds still (the ambush; T4 springs it)
  if (waiting && cur !== 'search' && !seenMe && !lit && away < -30 && d > SK.approachStop && crowd === 1) { e.dbg.why = `P${r.id} is coming its way, unaware: it holds still`; skMindKept(e, now, SK_SEEN); return; }
  // (R13) lying in wait (round its corner, or in ambush) out of their view: seeing them from there does not draw it out - the point is that
  // they come (its spring takes them when they do); seen there, or when its wait ends, it decides afresh
  if ((cur === 'lure' || cur === 'ambush') && !seenMe && crowd === 1 && d > SK.pounceRange[1] && !fleeing && !(e.pre && e.pre.force)) { skMindKept(e, now, SK_SEEN); return; }   // (R16d: not when they are going away from it - skPreempt)
  // what each option is worth now (seeded draws break near-ties: two Skin-Stealers in the same spot do not act alike).  (R1) Smooth in
  // hunger: hm (0 below .3 .. 1 from .6) is how hungry it is for a hunt, hs (0 below .55 .. 1 from .95) how near starving.  Eye contact
  // still sends a mildly hungry one away; a hungry one flanks; a starving one comes on openly or flanks, and rarely backs off.
  const nf = e.noFlank && now - e.noFlank.t < SK.noFlank && Math.hypot(p.x - e.noFlank.x, p.y - e.noFlank.y) < 200;   // (R3) no way round them here
  const hm = sm(.3, .6, h), hs = sm(.55, .95, h), restRace = Hn && now - Hn.raceAt < SK.chaseRest, spentTactics = !!(Hn && (Hn.flanks >= SK.flankMax || Hn.baitFailed || (nf && Hn.noFlank)));
  // the hunt's preferred answer to being seen; with no hunt yet, the one it would draw (drawn when the hunt begins, below)
  const style = Hn ? (Hn.flanks >= SK.flankMax ? 'bait' : Hn.baitFailed ? 'flank' : Hn.style) : (h >= SK.huntHunger && seenMe && !e.disguise ? skStyle(e) : '');
  // (R18, the owner's overtuned experiment) its drive (0 fed .. 1 starving, smooth); a standoff that ESCALATES - the longer it has stood off
  // with somebody who knows it is there (enc.so: its watch, and an open approach they can see), the more it moves on them: a purposeful
  // advance, then (hungry enough, its breath allowing) a run.  Fed, it only watches.  Somebody walking away from it is not let go so easily
  const drive = skDrive(e), escT = lerp(SK.escalate[0], SK.escalate[1], sm(SK.huntHunger, .85, h)) * (.8 + .4 * T.PATIENCE);
  const esc = h < SK.huntHunger || e.disguise ? 0 : Math.min(2, (enc.so || 0) / escT), leavingThem = away > 80 && !fleeing;
  // (R19) a way round under way that no longer leads to them: they are seen moving off from the spot it chose by them, or are well away
  // from where they were when it chose it (SKC.moved) - it weighs its answers afresh (R13-R18 went on to the spot regardless; fleeing
  // already ended it).  Seen only: out of its sight the way round goes on, and at its end it reckons where they will have gone (skFromCover)
  const FP = cur === 'flank' && !e.plan.arrived ? e.plan : null, fSpot = FP && FP.spot, fd = fSpot ? Math.hypot(p.x - fSpot.x, p.y - fSpot.y) : 1;
  const flankStale = !!FP && ((FP.tp && Math.hypot(p.x - FP.tp.x, p.y - FP.tp.y) > SKC.moved) || (fSpot && ((p.x - fSpot.x) * p.vx + (p.y - fSpot.y) * p.vy) / Math.max(1, fd) > 80));
  const W = {
    leave: (1 - h) * 1.1 * (1 - .5 * hm) + (crowd - 1) * .7 + (lit && watched && !e.disguise ? .5 * (1 - hm) : 0) + (e.exh ? .7 : 0) + T.CAUTION * .2 * (1 - hs) + spent * 1.2 + (h < SK.band[0] ? .8 : 0),   // (R11: lit and watched sends away only the not-yet-hungry; a hungry one finds another way)
    watch: cur === 'watch' && now > e.plan.until ? 0 : (d > SK.near ? .5 : .2) + T.PATIENCE * .25 - h * .5 + (watched && !e.disguise && h >= SK.huntHunger ? .2 * hm * (1 - hs) : 0) - .55 * esc,   // (R1: a standoff; R18: shorter, and it escalates)
    retreat: e.disguise ? 0 : (watched && h >= SK.huntHunger ? .45 + h * .6 + T.INTELLIGENCE * .2 + (style === 'bait' ? .4 : 0) : watched && d < SK.near ? .9 : 0) * (1 - .8 * sm(.45, .85, h)) * (1 - .4 * Math.min(1, esc)),   // (R18: a very hungry one rarely backs off)   // (T6: in a skin, being looked at is the point; R13: the bait answers a look - eye contact)
    flank: fleeing ? 0 : cur === 'flank' && !e.plan.arrived ? (flankStale ? .25 : 2) :                         // (R1) to their side, out of their sight (a flank under way goes on - R13: not round somebody running off)
      !seenMe || e.disguise || h < SK.huntHunger || e.exh || crowd > 1 || nf || (Hn && Hn.flanks >= SK.flankMax) ? 0 : (.35 + hm * (1 - .5 * hs) + T.INTELLIGENCE * .25 + (style === 'flank' ? .4 : -.45)) * (d < SKF.near && h >= SK.chaseHunger ? .4 : 1) * lerp(1, lerp(1, .55, sm(350, 700, d)), sm(.6, .85, h)),   // (R18: very hungry, a long way round from afar loses to coming on)   // (R18: this close and hungry, its place by them beats a long way round)
    // (R13) in their view but not met by their eyes: a covert way round (flank) is preferred where there is one; else it comes on openly - an
    // open approach under way is carried through until they meet its eyes; within a leap of somebody not looking at it, it takes the chance
    approach: h < .25 || e.exh ? 0 : cur === 'approach' && e.plan.mode === 'open' && !e.plan.shadow && (!watched || e.plan.committed) && !fleeing && !e.disguise ? 2 :
      ((watched ? .15 + 1.1 * hs + (spentTactics ? .45 * hm : 0) : fleeing && !(cur === 'approach' && e.plan.shadow) ? .3 : inView ? .55 + .6 * hs : 1) * (h * 1.6 - T.CAUTION * .25 + (lit ? -.1 : .25) + (watched ? 0 : .3 * hm * (1 - hs)))
        + (inView && !watched && !fleeing && cur !== 'chase' && !e.disguise && crowd === 1 && h >= SK.huntHunger && d < SK.pounceRange[1] + 60 ? 1.5 : 0)
        + (fleeing || e.disguise ? 0 : .9 * Math.min(1.5, esc) * drive + (leavingThem && h >= SK.huntHunger ? .9 * drive : 0))
        + (watched && !fleeing && !e.disguise && crowd === 1 && d < SK.gazeFar ? .5 * sm(.6, .85, h) * sm(350, 700, d) : 0)) * (crowd > 1 ? .6 : 1),   // (R18: very hungry and seen from afar, it comes on rather than go the long way round - the hungry, and any close by, keep their ways round and the bait)   // (R18: the standoff escalates; a walker going away is followed; R1-R16i: x .35 with two or more)   // (R1: hungry, it goes for an unaware person even in light; watched, it comes on openly when starving, or very hungry once its flanks and its bait have failed; still a lone ambusher; after a lost race it keeps to the runner's trail)
    chase: cur === 'chase' ? (e.plan.lost ? 0 : 2) :                                       // a chase runs until its own rules end it (skAct)
      e.exh || e.disguise || restRace || e.stam < SK.stamLow + 15 || d > SK.chaseFrom * (1 + .4 * hs) || (crowd > 1 && h < .7) || !(fleeing || winded || leavingThem || esc >= 1.2) ? 0 :
        sm(SK.chaseHunger - .1, SK.chaseHunger + .15, h) * (.55 + h * .9 + (winded ? .5 : 0) + (esc >= 1.2 ? .3 * esc : 0) - T.CAUTION * .3) * (crowd > 1 ? .6 : 1),   // (R16d: starving, it gives chase from farther; R18: graduated from about .35, also after a walker or out of an escalated standoff, and - starving - with two of them about)
  };
  if (cur === 'retreat' && e.plan.arrived && !watched) W.retreat = 0;                       // out of sight now: decide afresh
  // (R19, the independent review) somebody going their own way (moving, not towards it) whose way round it has just dropped as stale, or
  // refused while they moved (remembered with the place: SK.noFlank, 200 px), is not answered with the bait on the next thinks either
  // (the second review) ...nor one it gives up because they run off from it (fleeing: R13's rule ends the way round), which is as stale
  const flankGone = flankStale || (!!FP && fleeing), goingOn = Math.hypot(p.vx, p.vy) > 60 && away > 0;
  if (goingOn && (flankGone || (nf && e.noFlank.worth === 2))) W.retreat = 0;
  for (const k in W) W[k] = Math.max(0, W[k] * (.92 + .16 * e.rng()));
  const pick = () => Object.keys(W).sort((a, b) => W[b] - W[a] || a.localeCompare(b))[0];
  let best = pick(), fs = null;
  // (R4) going round them needs a spot: with none here it remembers that for the place and takes its next best answer now (R3 held its
  // ground for a tick first - a flicker of watching)
  // (R7) ...looked for only when going round them would really be begun (not when the plan under way is kept anyway: no route searched for nothing)
  const kept = k => (P && P.k === 'leave' && e.plan === P && W[k] < W.leave * SK.rethink) || (!!cur && k !== cur && W[k] < (W[cur] || 0) * SK.rethink && !(cur === 'watch' && now > e.plan.until));
  if (best === 'flank' && cur !== 'flank' && !kept('flank')) { fs = skFlankSpot(eng, e, p, d, r.id); if (!fs) { e.noFlank = { x: p.x, y: p.y, t: now }; e.tally.noFlank++; if (Hn) Hn.noFlank = now; W.flank = 0; best = pick(); } }
  // (R19) a way round is worth its time only while there will be somebody there at its end (skFlankWorth: somebody moving would be gone
  // from its spot; somebody standing still, beyond what it may spend over coming on openly).  Too slow, it weighs less - and its next
  // answer may win (logged: e.dbg.pos).  R13-R18 took any covert way up to 4.5 x the straight distance
  // (A way round refused for somebody moving is not answered with the bait either - a back-off round a corner for somebody already going
  // their own way, the same absence: it comes on, gives chase, watches or leaves - the pack's open press for prey moving away)
  // (the independent review: a refusal is remembered for the place, as "no way round here" is - SK.noFlank, or until they are 200 px on -
  // so the same search is not made again on every think; its record and tally are written only when the plan really changes, below)
  let pos = null;
  if (fs) { const q = skFlankWorth(e, p, d, fs); fs.worth = q;
    if (q.f < 1) { W.flank *= q.f; if (q.off !== undefined && away > 0) W.retreat = 0; const b2 = pick(); if (b2 !== 'flank') { e.noFlank = { x: p.x, y: p.y, t: now, worth: q.off !== undefined ? 2 : 1 }; pos = { k: 'flankRefused', eta: [q.etaF, q.etaD], why: `its way round P${r.id} would take ${q.etaF} s (${q.off !== undefined ? `they would be ${q.off} px from its spot by then` : `against ${q.etaD} s coming on; it may spend ${q.B} s more`}): ${b2}` }; best = b2; fs = null; } } }
  if (flankGone && best !== 'flank') pos = { k: 'flankStale', why: `P${r.id} is ${flankStale ? 'moving' : 'running'} off from its way round: ${best}`, memo: goingOn ? { x: p.x, y: p.y, t: now, worth: 2 } : null };   // (remembered as a mover's refusal: no way round them, nor the bait, here for now)
  // (R13) an approach it is not seen making: covert only along a covert way to a spot within its spring that they cannot see (an
  // ambush point); with none, it comes on openly only very hungry (labelled: they can see it if they look) - else it looks for a hidden spot
  // at their side (a flank from where it is), or holds where it is, unseen
  // (R16) with no ambush point near them here a moment ago, it does not search again on every think (as with no way round them: SK.noFlank)
  let ap = null;
  if (best === 'approach' && cur !== 'approach' && !seenMe && !kept('approach') && !e.disguise) {
    const na = e.noAmbush && now - e.noAmbush.t < SK.noFlank && Math.hypot(p.x - e.noAmbush.x, p.y - e.noAmbush.y) < 200;
    ap = d <= SK.pounceRange[1] ? { near: 1 } : na ? null : skFlankSpot(eng, e, p, d, r.id, [SK.pounceRange[0] + 45, Math.max(SK.pounceRange[0] + 45, Math.min(SK.pounceRange[1] - 15, d - 60))], e.coverRng);
    if (!ap && !na) e.noAmbush = { x: p.x, y: p.y, t: now };
    if (!ap && !(h >= SK.chaseHunger || fleeing || winded)) { W.approach = 0; best = pick(); if (best === 'flank' && !kept('flank')) { fs = skFlankSpot(eng, e, p, d, r.id); if (!fs) { e.noFlank = { x: p.x, y: p.y, t: now }; e.tally.noFlank++; if (Hn) Hn.noFlank = now; W.flank = 0; best = pick(); } } }
  }
  e.dbg.decide = { at: +now.toFixed(2), pid: r.id, d: Math.round(d), watched: !!watched, seen: seenMe ? 1 : 0, lit, crowd, h: +h.toFixed(2), spent: +spent.toFixed(2), away: Math.round(away), W: Object.fromEntries(Object.entries(W).map(([k, v]) => [k, +v.toFixed(2)])), best };
  if (P && P.k === 'leave' && e.plan === P) {                                        // (B2) a very hungry departure, thought over: kept unless clearly worse
    if (best === 'leave' || W[best] < W.leave * SK.rethink) { e.dbg.lv = `very hungry, it saw P${r.id}: it keeps going`; e.dbg.lvAt = now; skMindKept(e, now, SK_SEEN); return; }
    e.tally.reconsider++; e.dbg.lv = `very hungry, it saw P${r.id}: it gives up its departure`; e.dbg.lvAt = now;
  }
  if (cur && best !== cur && W[best] < (W[cur] || 0) * SK.rethink && !(cur === 'watch' && now > e.plan.until)) { skMindKept(e, now, SK_SEEN); return; }   // keep the plan unless something is clearly better
  if (best === cur) { skMindKept(e, now, SK_SEEN); return; }
  if (pos) { if (pos.memo) e.noFlank = pos.memo; delete pos.memo; e.tally[pos.k]++; e.dbg.pos = Object.assign({ at: +now.toFixed(2), pid: r.id }, pos); }   // (R19: the positioning choice that changed its plan)
  if (retake && best !== 'leave') { e.left.delete(r.id); e.tally.reengage++; }                  // (R1, R7) taken up again - only now that it does: a departure kept keeps its cooldown
  if (best === 'leave') skLeave(eng, e, r, h < SK.band[0] ? `not hungry: it leaves P${r.id} alone` : crowd > 1 ? `more than one of them (${crowd})` : e.exh ? 'exhausted' : lit && watched ? 'seen in the light' : `it decides against P${r.id}`);
  else if (best === 'watch') skBegin(eng, e, 'watch', r, `it watches P${r.id}`);
  else if (best === 'retreat') {
    const bait = h >= SK.chaseHunger && !e.exh && (d > SK.near || (Hn && Hn.flanks > 0)), s = skHideSpot(eng, e, p, bait);   // (R1: after its flanks failed, backing round a corner is the bait, however close)
    if (bait) { const Hb = skHuntBegin(eng, e, r, 'the bait'); Hb.baited = (Hb.baited || 0) + 1; }
    skBegin(eng, e, 'retreat', r, bait ? `seen by P${r.id}: it backs away slowly, round a corner (inviting them to follow)` : `seen by P${r.id}: it backs out of sight`, { spot: s, bait, from: { x: e.x, y: e.y }, mode: bait ? 'feint' : 'withdraw' });   // (R13: a bait is meant to be seen)
    if (s) plan(eng, e, s.x, s.y, { why: 'retreat' });
  }
  else if (best === 'approach') {
    if (h >= SK.huntHunger) skHuntBegin(eng, e, r, 'it comes for them');
    if (seenMe) skBegin(eng, e, 'approach', r, watched ? `P${r.id} has seen it: ${skBand(h)}, it comes on anyway, openly` : `P${r.id} can see it: it comes on openly`, { mode: 'open' });   // (R13: its real hunger band - R8 said 'starving' for any)
    else if (ap && ap.way) { skBegin(eng, e, 'approach', r, `P${r.id} cannot see it: it creeps nearer under cover (${ap.L} px)`, { mode: 'covert', spot: ap, way: ap.way, tp: { x: p.x, y: p.y, v: Math.hypot(p.vx, p.vy) } }); e.path = ap.way.pts.slice(); e.goal = { x: ap.x, y: ap.y }; e.goalKey = 'covert'; e.pathAge = 0; }
    else skBegin(eng, e, 'approach', r, ap && ap.near ? `P${r.id} is right there, unaware: it comes on` : `P${r.id} cannot see it yet, but there is no cover nearer: it comes on openly`, { mode: 'open' });
  }
  else if (best === 'chase') { skHuntBegin(eng, e, r, 'it gives chase'); skBegin(eng, e, 'chase', r, fleeing ? `P${r.id} runs: it gives chase` : `P${r.id} is winded: it closes in`, { dmin: d }); }
  else if (best === 'flank') {                                                                // (R1) to cover at their side (its spot found above)
    const s = fs;
    const Hh = skHuntBegin(eng, e, r, 'it goes round them'); Hh.flanks++;
    skBegin(eng, e, 'flank', r, `seen by P${r.id}: it backs out of their sight and goes round them under cover (${s.L} px${s.worth ? `, ${s.worth.etaF} s` : ''})`, { spot: s, way: s.way, mode: 'covert', until: now + Math.max(SK.flankDur, s.L / 200 + 3), tp: { x: p.x, y: p.y } });   // (R19: tp - where they were)
    e.path = s.way.pts.slice(); e.goal = { x: s.x, y: s.y }; e.goalKey = 'covert'; e.pathAge = 0;   // (R13: its covert way, as audited - not planned again with a softer cost)
  }
}
/* nobody it may consider is in view: its plan about somebody goes on without a sighting, or it decides what that loss means */
function skUnseen(eng, e) {
  const L = e.plan, H = e.hunt;
  if (L && L.pid) {
    const r = e.mem.p.get(L.pid);
    if (!r || tgtGone(eng, e, r) || (e.left.has(L.pid) && !(H && H.pid === L.pid))) { e.plan = null; e.target = null; skHuntEnd(eng, e, 'nobody to go after'); e.dbg.why = 'it has nobody to go after'; return; }
    const enc = skEnc(eng, e, r, true);
    if (enc.spent >= skBudget(e)) { e.tally.huntSpent++; skLeave(eng, e, r, `its time with P${r.id} is spent (${Math.round(enc.spent)} s)`); return; }
    // (R1) a hunt whose quarry has left no evidence for long enough is over, whatever the plan (not while it waits in its own concealment)
    if (H && H.pid === L.pid && H.conf < SK.huntLow && L.k !== 'retreat' && L.k !== 'flank' && L.k !== 'lure' && L.k !== 'ambush') { e.tally.huntCold++; skLeave(eng, e, r, `no sign of P${r.id} for ${Math.round(eng.now - H.evAt)} s: it gives up`); return; }
    if (L.k === 'lure' || L.k === 'ambush' || L.k === 'intercept' || L.k === 'search' || L.k === 'listen') { skMindKept(e, eng.now, SK_LOST); return; }   // these work without a sighting (skAct ends them)
    if (L.k === 'approach' && L.side && eng.now - L.t0 < SK.flankCome) { skMindKept(e, eng.now, SK_LOST); return; }
    if (L.k === 'approach' && L.rush && eng.now - L.t0 < SKC.rushFor) { skMindKept(e, eng.now, SK_LOST); return; }   // (R13) a rush from cover is carried through to where they were
    if (L.k === 'approach' && L.mode === 'covert' && L.way && !(L.tp && L.tp.v > 40)) { skMindKept(e, eng.now, SK_LOST); return; }   // (R13) a covert way to somebody standing still goes on unseen: that is its point (one who was moving is lost: skLost)     // (R1) from a flank it comes on toward where it believes them, unseen
    if (L.k === 'flank' && (!L.arrived ? eng.now < L.until : eng.now - L.arrived < SK.flankSettle)) { skMindKept(e, eng.now, SK_LOST); return; }   // (R3) a flank goes on to its spot though it has turned its back on them; (R4) there it settles, crouched, a moment
    if ((L.k === 'approach' || L.k === 'chase' || L.k === 'watch') && eng.now - r.seenAt < SK.lostGrace) return;   // (R4) a glimpse lost for a moment is not yet lost: it keeps on (R16d: a watch too - no watch/intercept flicker at a sight edge)
    skLost(eng, e, L, r); return;
  }
  if (L && (L.k === 'search' || L.k === 'listen')) return;                         // looking at a sound nobody has been named for
  if (!L && H) { skHuntNext(eng, e); return; }                                     // (R1) the hunt goes on: listen, search where it believes them, or give up
  if (!L && e.hunger >= SK.huntHunger && !e.exh) skListen(eng, e);
}
/* ---- carrying a plan out (every tick) ---- */
function skAct(eng, e, dt, thinkNow) {
  const P = e.plan, now = eng.now;
  if (!P || P.k === 'leave') skGaze(eng, e, dt);
  else { const ah = e.disguise || (P.pid && e.seenNow.has(P.pid)) ? 0 : headAhead(eng, e);   // (R20) a plan's way: its gaze into the bend ahead
    if (ah) skSwivel(e, ah, dt, 6); else if (e.head) e.head = Math.abs(e.head) < .02 ? 0 : e.head * Math.max(0, 1 - dt * 6); }   // (B1)
  if (e.rx && skReact(eng, e, dt)) return;                                          // (B1) a look, over the plan
  if (!P) { if (e.hunt) { skHold(eng, e, dt); return; } skRoam(eng, e, dt, thinkNow); return; }   // (R1: between two steps of a hunt it does not wander off)
  const r = P.pid ? e.mem.p.get(P.pid) : null;
  switch (P.k) {
    case 'watch': {
      // (R16f) a hungry standoff is held on its feet - (R16g, the review) at a watch's own distance, beyond SK.near (a watch never springs:
      // its footwork never carries it into its spring)
      if (r && e.hunger >= SK.chaseHunger && !e.disguise) { const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y); if (skFightable(eng, e, r, p, d) && skFight(eng, e, r, p, d, dt, thinkNow, Math.min(skSpeed(e, 'flank'), skCap(e)), [SK.near + 10, SKF.near - 10])) return; }
      skHold(eng, e, dt);
      if (r) { const p = perc(eng, e, r); faceToward(e, p.x, p.y, dt, 2.2); }
      if (e.act !== 'watch') setAct(e, 'watch');
      if (r && r.seen && e.enc && e.enc.pid === r.id) e.enc.so = (e.enc.so || 0) + dt;   // (R18) the standoff's clock: its stare goes on as before; skDecide escalates it
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
      // (R13) covert: along its covert way to a spot within its spring that they cannot see; there it waits, ready (T4 springs it)
      if (P.mode === 'covert') {
        // (they moved well away from where its ambush point was chosen for them: the point is no use - it thinks again)
        if (thinkNow && r.seen && P.tp && Math.hypot(r.visual.x - P.tp.x, r.visual.y - P.tp.y) > SKC.moved) { P.mode = 'open'; P.way = null; P.tp = null; P.side = 0; e.path = []; e.dbg.why = `P${r.id} has moved on: it follows them, no longer hiding its way`; return; }
        const st = skCovertStep(eng, e, P, dt, thinkNow, r); if (e.plan !== P) return;
        if (st === 'arrived' || st === 'failed') { const q = perc(eng, e, r); e.path = []; skBegin(eng, e, 'ambush', r, st === 'arrived' ? `at its ambush point near P${r.id}, out of their sight: it waits, ready` : `its way nearer P${r.id} ends here: it waits, out of their sight`, { until: now + 3 + 6 * e.hunger * e.tr.PATIENCE }).face = { x: q.x, y: q.y }; }
        return;
      }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      // (R16f) an open approach close to somebody moving or looking at it: it fights for its place - facing them, by their way out.  (R16g,
      // the review) it runs only where it may give chase - the chase's own conditions on it (its hunger, its breath, no race lost to them
      // lately: skMayRun); else at the approach's own pace - their speed and a little more, at least its stalk, never over the pace that
      // costs it stamina
      if (P.mode === 'open' && !P.shadow && !P.rush && skFightable(eng, e, r, p, d) && skFight(eng, e, r, p, d, dt, thinkNow, skMayRun(eng, e, r) ? Math.min(skSpeed(e, 'run'), skCap(e)) : Math.min(Math.max(Math.hypot(p.vx, p.vy) + 30, skSpeed(e, 'stalk')), SK.runFrom, skCap(e)))) { P.cp = null; return; }   // (R19: its footwork has them - no contest point kept)
      // (R3) somebody unaware turning its way, before they meet its eyes: it freezes, crouched, until they look away or its patience runs out
      // (R13: not in an open approach - it is in their view whichever way they face)
      const v = r.seen ? r.visual : null;
      if (v && !P.shadow && P.mode !== 'open' && d > SK.approachStop && d < 900 && !skWatched(eng, e, r)) {
        const off = Math.abs(angDiff(Math.atan2(e.y - v.y, e.x - v.x), v.angle));
        if (off < SK.freezeCone && (P.frozen || 0) < lerp(SK.freezeMax[0], SK.freezeMax[1], sm(.55, .95, e.hunger))) {
          P.frozen = (P.frozen || 0) + dt; if (!P.froze) { P.froze = 1; e.tally.freeze++; e.dbg.why = `P${r.id} turns its way: it freezes`; }
          skHold(eng, e, dt); if (e.act !== 'creep') setAct(e, 'creep'); return;
        }
        if (off > SK.freezeCone + .25 && P.froze) { P.froze = 0; P.frozen = Math.max(0, P.frozen - .5); e.dbg.why = `P${r.id} looks away: it comes on`; }
      }
      if (d < SK.approachStop && Math.hypot(p.vx, p.vy) < 40) { skHold(eng, e, dt); faceToward(e, p.x, p.y, dt, 3); if (e.act !== 'creep') setAct(e, 'creep'); return; }
      // (R12: within its stopping distance of somebody who keeps moving against it - pressed up to a low wall or its own body - a used-up
      // route is worked out again at most twice a second, not on every think)
      if (thinkNow && (now - (P.planT || -9) > 1.5 || (!e.path.length && (d >= SK.approachStop || now - P.planT > .5)))) {
        P.planT = now;
        let G = skContest(eng, e, r, p, d, P);                                                     // (R19) at them, or for their way out
        if (G !== p && !directOk(eng, e, G.x, G.y, SK.contestFrom + 200)) { P.cp = null; G = p; } // (the second review: a kept point is re-checked from where it is now - no straight line there, at them as R18; a point lies at most 200 px beyond them)
        if (G !== p || directOk(eng, e, G.x, G.y, 420)) directTo(eng, e, G.x, G.y);                // (its contest point: straight there, in their sight)
        else plan(eng, e, G.x, G.y, { why: G === p ? 'approach under cover' : 'their way out', cost: skCover(eng, p), maxNodes: 3000 });
      }
      // a still person it creeps up on; a moving one it shadows at their own pace (a little faster), so nobody simply walks away from it -
      // (R7) except the runner who won the race: on their trail it goes a little slower than they do, so a lead won stays won while they move
      const sp = Math.hypot(p.vx, p.vy), creep = d < 420, pace = sp > 40 ? clamp(P.shadow ? sp * SK.shadowPace : sp + 40, e.sp.speeds.creep, SK.runFrom) : 0;   // (R18: +40, was +30)
      // (R13) an open approach looks like one: upright and deliberate (pace), or - breaking cover - a rush at its run (chase); a hidden one
      // creeps as before
      if (P.rush) { setAct(e, 'chase'); follow(eng, e, dt, skSpeed(e, 'run'), { arrive: 40 }); return; }
      if (thinkNow) P.inView = P.mode === 'open' && skExposedNow(eng, e).length > 0;   // (in somebody's view: it walks openly; unseen yet, it stalks)
      // (R16i) a purposeful approach: very hungry and free to run (skMayRun - its hunger, its breath, no race lost to them lately), shown
      // already (in somebody's view now, or in theirs within SK.pressShown: nothing left to hide), and still beyond its footwork's range, it
      // closes on them at its press, upright and fast - not its run (a chase, 255) and never faster than its breath allows (skCap); within
      // SKF.near its footwork or its creep goes on as before.  Not pressed: an approach nobody has seen (it stalks), a fed or mildly hungry
      // one (its pace), a lost race's trail (it lags), a winded one
      // (R18, the owner's overtuned experiment) the press also when they are moving (it must keep up, seen or not), from SK.chaseHunger,
      // graduated by its hunger from its investigation's pace (232) to its press (260); an approach they can see is a standoff that goes on
      // (enc.so: skDecide may turn it into a run).  Unseen, a hungry one closes at its prowl (205) to SK.closeFrom, then stalks or creeps
      const o = e.mind && e.mind.obs.get(r.id), shown = P.inView || !!(o && now - o.sawAt < SK.pressShown);
      if (shown && e.enc && e.enc.pid === r.id && r.seen && d < 760) e.enc.so = (e.enc.so || 0) + dt;
      const press = P.mode === 'open' && !P.shadow && (shown || sp > 60) && d > SKF.near && skMayRun(eng, e, r);
      if (press) {
        if (!P.press) { P.press = now; e.tally.press = (e.tally.press || 0) + 1; e.dbg.why = shown ? `P${r.id} knows it is there and it is hungry: it comes on, fast (its press)` : `P${r.id} is moving off: it comes on, fast (its press)`; }
        setAct(e, 'pace'); follow(eng, e, dt, Math.min(lerp(e.sp.speeds.investigate, e.sp.speeds.press, sm(SK.chaseHunger, .8, e.hunger)), skCap(e), e.disguise ? e.sp.speeds.disguise : 1e9), { arrive: 60 }); return;
      }
      const prowl = !P.shadow && e.hunger >= SK.huntHunger && d > SK.closeFrom ? skSpeed(e, 'prowl') : 0;
      if (prowl && !P.prowl) { P.prowl = now; e.tally.prowlIn = (e.tally.prowlIn || 0) + 1; }
      setAct(e, P.inView && !P.shadow ? (creep && !pace ? 'creep' : 'pace') : creep && !pace ? 'creep' : 'approach');
      follow(eng, e, dt, Math.max(prowl, pace ? Math.min(pace, skCap(e)) : skSpeed(e, creep ? 'creep' : 'stalk')), { arrive: pace || prowl ? 60 : SK.approachStop - 10 });
      return;
    }
    case 'chase': {
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      const p = perc(eng, e, r), d = Math.hypot(p.x - e.x, p.y - e.y);
      P.dmin = Math.min(P.dmin, d);
      if (thinkNow) {
        // it stops when it is losing the race, when its breath gives out, or after a short run: a chase is a gamble, never a long pursuit
        const why = d > P.dmin + SK.chaseLose ? `it is losing the race with P${r.id} (${Math.round(d)} px, it was ${Math.round(P.dmin)})` : e.stam < SK.stamLow ? `out of breath chasing P${r.id}` : now - P.t0 > SK.chaseMax ? `P${r.id} has run long enough: it stops` : '';
        if (why) {
          P.lost = true; e.tally.chaseLost++;
          // (R1) a hungry one that is only losing the race does not give up the hunt: it stops running and keeps to the trail at its free
          // walking pace (no faster than it may go without spending stamina), and will not give chase again for SK.chaseRest
          const Hh = e.hunt && e.hunt.pid === r.id ? e.hunt : null;
          if (Hh && e.hunger >= SK.chaseHunger && !e.exh && d <= P.dmin + SK.chaseLose * 3) { Hh.raceAt = now; e.tally.shadow++; skBegin(eng, e, 'approach', r, `${why}: it lets them run and keeps to their trail`, { shadow: 1, mode: 'open' }); return; }
          skLeave(eng, e, r, why).race = true; return;                                   // (B2: a lost race stays a departure)
        }
        if (now - (P.planT || -9) > .5 || !e.path.length) { P.planT = now; if (directOk(eng, e, p.x, p.y, 640)) directTo(eng, e, p.x, p.y); else plan(eng, e, p.x, p.y, { why: 'chase', maxNodes: 3000 }); }
      }
      if (skFightable(eng, e, r, p, d) && skFight(eng, e, r, p, d, dt, thinkNow, skSpeed(e, 'run'))) return;   // (R16f) close: it cuts off their way out, facing them
      setAct(e, 'chase');
      follow(eng, e, dt, skSpeed(e, 'run'), { arrive: 30 });                              // it runs on to them (the strike decides when it springs)
      return;
    }
    case 'ambush': {                                                                   // (R13) at a hidden spot near them: still, facing where they would come from
      skHold(eng, e, dt); if (P.face) faceToward(e, P.face.x, P.face.y, dt, 1.6);
      if (e.act !== 'wait') setAct(e, 'wait');
      if (thinkNow) {
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.t0 + SK.lureMax); if (r && now - r.heardAt < 2.5) P.face = { x: r.hx, y: r.hy }; e.dbg.why = 'it hears them coming: it waits, ready'; }
        if (P.came === undefined && skHeardNear(eng, e, r, 320)) { P.came = now; e.tally.ambushCame++; }
        if (now > P.until || (e.hunger >= SK.chaseHunger && now - P.t0 > SKC.ambushHungry)) {          // (very hungry, it does not wait long)
          const Hh = r && e.hunt && e.hunt.pid === r.id ? e.hunt : null;
          if (r && !tgtGone(eng, e, r) && e.hunger >= SK.chaseHunger && !e.exh) { skFromCover(eng, e, r, 'nobody came by its ambush', true); return; }
          if (Hh && e.hunger >= SK.huntHunger && !e.exh && Hh.conf >= SK.huntLow) { e.plan = null; e.dbg.why = `nobody came by its ambush: it goes after P${P.pid}`; skHuntNext(eng, e); return; }
          skLeave(eng, e, r, `nobody came by its ambush: it gives up on P${P.pid}`); return;
        }
      }
      return;
    }
    case 'lure': {
      skHold(eng, e, dt); if (P.face) faceToward(e, P.face.x, P.face.y, dt, 1.6);
      if (e.act !== 'lure' && !(e.act === 'mimic' && now < e.mimicT)) setAct(e, 'lure');
      if (thinkNow) {
        // (T6) very hungry, unseen, a moment into the wait: it calls out once - words it heard, or a generic call
        if (!P.spoke && now - P.t0 > SK.sayLure && e.hunger >= SK.chaseHunger && !(r && r.seen) && skSay(eng, e, r, 'from hiding')) P.spoke = now;
        if (skComing(eng, e, P)) { P.until = Math.min(Math.max(P.until, now + 2.5), P.t0 + SK.lureMax); if (r && now - r.heardAt < 2.5) P.face = { x: r.hx, y: r.hy }; e.dbg.why = 'it hears them coming: it waits, ready'; }
        if (P.came === undefined && skHeardNear(eng, e, r, 320)) { P.came = now; e.tally.lureCame++; }
        if (now > P.until) {
          const Hh = r && e.hunt && e.hunt.pid === r.id ? e.hunt : null;                   // (R1) very hungry, a failed bait is one tactic, not the end of the hunt
          if (Hh) Hh.baitFailed = now;
          if (Hh && e.hunger >= SK.chaseHunger && !e.exh && Hh.conf >= SK.huntLow) { e.plan = null; e.dbg.why = `P${P.pid} did not follow: ${e.hunger >= SK.band[3] ? 'starving' : 'very hungry'}, it goes after them instead`; skHuntNext(eng, e); return; }
          skLeave(eng, e, r, P.bait ? `P${P.pid} did not follow: the bait failed` : `nobody came: it gives up on P${P.pid}`); return;
        }
      }
      return;
    }
    case 'intercept': {
      if (!r) { e.plan = null; return; }
      const g = P.g, Hh = e.hunt && e.hunt.pid === r.id ? e.hunt : null, hAt = Math.max(r.heardAt, Hh ? Hh.hAt : -99);
      // footsteps (theirs, or - R2 - a body's where they could be) away from its guess: it corrects it, or goes to look where it heard them
      if (thinkNow && hAt > P.hAt + .3 && P.re < 2 && (!Hh || Hh.revised < SK.reviseMax)) {
        P.hAt = hAt;
        const sx = Hh && Hh.hAt >= r.heardAt ? Hh.x : r.hx, sy = Hh && Hh.hAt >= r.heardAt ? Hh.y : r.hy;
        if (Math.hypot(sx - g.x, sy - g.y) > 350) {
          const g2 = skPredict(eng, e, Hh ? skBeliefRec(Hh) : r), w2 = g2 && Hh ? skHypOf(skHyps(eng, e, Hh), g2.qx, g2.qy) : null;   // (R12: labelled with its way)
          if (g2) g2.hyp = w2 ? w2.id : 0;
          if (g2 && Math.hypot(g2.x - g.x, g2.y - g.y) > 250) {
            P.re++; P.reAt = now; if (Hh) Hh.revised++; e.tally.revise++; P.g = g2; if (P.arrived) { P.arrived = 0; P.until = Math.min(P.t0 + SK.interceptMax + 8, now + 10); }
            e.dbg.predict = Object.assign({ at: +now.toFixed(2), pid: r.id, corrected: 1 }, g2); skInterceptWay(eng, e, P, r, g2);   // (R13: covert again if it can be)
            e.dbg.why = `it heard ${Hh && Hh.hAt >= r.heardAt ? 'something where P' + r.id + ' could be' : 'P' + r.id}: it corrects its guess`;
          } else if (!g2 && Hh && Math.hypot(sx - e.x, sy - e.y) > 320) {
            Hh.revised++; e.tally.revise++; skFailed(Hh, g.qx, g.qy, now, 'revised');
            skSearch(eng, e, r, `it heard something where P${r.id} could be, away from its guess: it goes to look`, { x: sx, y: sy }); return;
          }
        }
      }
      if (!P.arrived && P.mode === 'covert' && P.way) {                               // (R13) along its covert way: out of every view it knows of
        const st = skCovertStep(eng, e, P, dt, thinkNow, r); if (e.plan !== P) return;
        if (st === 'arrived' || st === 'failed' || now > P.until) { P.arrived = now; e.path = []; P.until = Math.min(P.until + 4, now + rand(e, SK.interceptWait[0], SK.interceptWait[1]) * (.7 + .6 * e.tr.PATIENCE)); e.dbg.why = `in place, out of sight: it waits for P${r.id} beside the way it guessed`; }
        return;
      }
      if (!P.arrived) {
        // a race to be there first: it runs (its stamina allowing), slowing for the last stretch to arrive quietly
        const last = Math.hypot(P.g.x - e.x, P.g.y - e.y) < 160 && e.path.length <= 1;
        if (thinkNow && !e.path.length && e.pathAge > 1.5) { P.stuck = (P.stuck || 0) + 1; plan(eng, e, P.g.x, P.g.y, { why: 'intercept' }); }
        setAct(e, P.mode === 'open' ? 'chase' : 'intercept');                          // (R16, pack 03: an OPEN interception runs as an open run - upright, the chase's act - never as the hidden run)
        follow(eng, e, dt, skSpeed(e, last ? 'stalk' : 'run'), { arrive: 30 });
        if (Math.hypot(P.g.x - e.x, P.g.y - e.y) < 44 || (P.stuck || 0) > 2 || now > P.until) {
          P.arrived = now; P.until = Math.min(P.until + 4, now + rand(e, SK.interceptWait[0], SK.interceptWait[1]) * (.7 + .6 * e.tr.PATIENCE));
          e.dbg.why = `in place: it waits for P${r.id} beside the way it guessed`;
        }
        return;
      }
      skHold(eng, e, dt); faceToward(e, P.g.jx, P.g.jy, dt, 1.6);
      skHeadTo(e, Math.sin((now - P.arrived) * 1.3 + e.id) * .45, dt);                // (R3) it listens, its head turning, toward the way they would come
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
          // (R2) it heard somebody close while it waited, and they did not show: its guess was not wrong - it looks where it heard them
          if (Hh && P.came !== undefined && !e.exh) { e.plan = null; skHuntNext(eng, e, `it heard P${r.id} close by, unseen`); return; }
          // (R2) nobody came, but it has heard them elsewhere since its guess: the newer evidence leads, the guess is not counted as a failed place
          if (Hh && Hh.hAt > (P.reAt ?? P.t0) && !e.exh) { e.plan = null; Hh.conf = Math.max(0, Hh.conf - SK.wrongCost * .5); skHuntNext(eng, e, `nobody came, but it heard something where P${r.id} could be`); return; }
          e.dbg.wrong = (e.dbg.wrong || 0) + 1; e.tally.wrong++;
          // (R2) the hunt remembers the failed place, loses some confidence, and makes its next guess (or gives up for a reason)
          if (Hh) { skFailed(Hh, P.g.qx, P.g.qy, now, 'intercept'); skFailed(Hh, P.g.x, P.g.y, now, 'intercept'); Hh.conf = Math.max(0, Hh.conf - SK.wrongCost); if (P.g.turns.length) skBadTurn(Hh, P.g.turns[0].a); }
          if (Hh && !e.exh) { e.plan = null; skHuntNext(eng, e, 'it guessed wrong (nobody came)'); }
          else if (e.hunger >= SK.chaseHunger && !P.searched && r.conf > .2 && now - Math.max(r.seenAt, r.heardAt) < 8) skSearch(eng, e, r, `it guessed wrong (nobody came): it goes to look for P${r.id}`, { x: r.lkx, y: r.lky });
          else skLeave(eng, e, r, `it guessed wrong (nobody came): it gives up on P${r.id}`);
        }
      }
      return;
    }
    case 'search': {
      const Hh = r && e.hunt && e.hunt.pid === r.id ? e.hunt : null, hAt = Math.max(r ? r.heardAt : -99, Hh ? Hh.hAt : -99);
      if (thinkNow && r && hAt > P.hAt + .3 && (P.moved || 0) < 3) {   // fresher footsteps (theirs, or - R2 - a body's where they could be): it goes there (at most three times)
        P.hAt = hAt; P.moved = (P.moved || 0) + 1;
        const gx = Hh && Hh.hAt >= r.heardAt ? Hh.x : r.hx, gy = Hh && Hh.hAt >= r.heardAt ? Hh.y : r.hy;
        if (Math.hypot(gx - P.goal.x, gy - P.goal.y) > 90) { P.goal = { x: gx, y: gy }; P.looked = 0; plan(eng, e, gx, gy, { why: 'search (heard)' }); e.dbg.why = `it heard ${Hh && Hh.hAt >= r.heardAt ? 'something where P' + r.id + ' could be' : 'P' + r.id}: it goes there, quietly`; }
      }
      // (R2) looking at a sound nobody has been named for: a fresher one near where it is going moves the goal (at most twice)
      if (thinkNow && !r && e.hear && e.hear.id > P.sid && (P.moved || 0) < 2 && e.hear.src !== -1 && Math.hypot(e.hear.x - P.goal.x, e.hear.y - P.goal.y) < 500) {
        P.sid = e.hear.id; P.moved = (P.moved || 0) + 1; P.at = { x: e.hear.x, y: e.hear.y }; P.goal = skVantage(eng, e, P.at.x, P.at.y, e.hear.u || 0) || P.at; P.looked = 0; plan(eng, e, P.goal.x, P.goal.y, { why: 'search (heard)' }); e.dbg.why = 'it heard it again: it goes there, quietly';   // (R16e: to where it can see the place)
      }
      if (!P.looked) {
        if (thinkNow && !e.path.length && e.pathAge > 1.5) { P.stuck = (P.stuck || 0) + 1; plan(eng, e, P.goal.x, P.goal.y, { why: 'search' }); }
        setAct(e, 'search');
        // (R18) to the place: at its investigation's pace (232; a prowl when barely hungry), slowing to a stalk for the last stretch to arrive
        // quietly - R8-R16i went to a person's last place at a stalk (90) all the way
        const far = Math.hypot(P.goal.x - e.x, P.goal.y - e.y) > 220;
        follow(eng, e, dt, !far ? skSpeed(e, 'stalk') : Math.min(lerp(skSpeed(e, P.pid ? 'prowl' : 'roam'), skSpeed(e, 'investigate'), sm(.25, .6, e.hunger)), skCap(e)), { arrive: 40 });   // (R16e: to look at a sound nobody was named for, the hungrier the quicker - under the pace that costs it stamina; a hunt's search as before)
        if (Math.hypot(P.goal.x - e.x, P.goal.y - e.y) < 70 || (P.stuck || 0) > 2 || now > P.until) {
          const from = P.at && !P.closer && Math.hypot(P.at.x - e.x, P.at.y - e.y) > 120;           // (R16e) at a point to look from: a short look at the place
          P.looked = now; P.lookFor = from ? rand(e, SKL.lookFrom[0], SKL.lookFrom[1]) : rand(e, SK.searchLook[0], SK.searchLook[1]); P.look0 = P.at && Math.hypot(P.at.x - e.x, P.at.y - e.y) > 70 ? Math.atan2(P.at.y - e.y, P.at.x - e.x) : e.ang; P.lookC = e.ang;   // (R16g: at the place itself, the way it faces)
          e.dbg.why = from ? 'it looks at the place from where it can see it' : 'it stands and listens';
        }
        return;
      }
      P.lookC = ((P.lookC ?? P.look0) + clamp(angDiff(P.look0, P.lookC ?? P.look0), -skTurnRate(e) * dt, skTurnRate(e) * dt) + TAU) % TAU;   // (R16e: it turns to the place it came to see, at its body's rate - R16g: the species' own)
      skHold(eng, e, dt); e.ang = ((P.lookC + Math.sin((now - P.looked) * 1.3) * .9) % TAU + TAU) % TAU;   // it looks one way, then the other
      if (e.act !== 'listen') setAct(e, 'listen');
      if (thinkNow && now - P.looked > P.lookFor && P.at && !P.closer && Math.hypot(P.at.x - e.x, P.at.y - e.y) > 120) {   // (R16e) nothing to be seen from there: it goes closer, to the place itself
        P.closer = 1; P.goal = { x: P.at.x, y: P.at.y }; P.looked = 0; P.until = Math.max(P.until, now + 6); plan(eng, e, P.goal.x, P.goal.y, { why: 'search (closer)' }); e.dbg.why = 'nothing to be seen from there: it goes closer'; return;
      }
      if (thinkNow && now - P.looked > P.lookFor) {
        if (Hh) { skFailed(Hh, P.goal.x, P.goal.y, now, 'search'); Hh.conf = Math.max(0, Hh.conf - SK.wrongCost * .5); if (P.turnA !== null && P.turnA !== undefined) skBadTurn(Hh, P.turnA); }   // (R2) negative evidence: nobody here
        if (Hh && Hh.conf >= SK.huntLow && Hh.tries < skTries(e) && !e.exh) { e.plan = null; e.dbg.why = `P${r.id} is not here: it thinks again`; }   // (R1) the hunt goes on
        else if (r) skLeave(eng, e, r, `the trail of P${r.id} is cold: it gives up`); else { e.plan = null; e.dbg.why = 'nothing there: it roams again'; }
      }
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
          if (e.hunger >= SK.huntHunger && !e.exh) { P.ph = 'close'; e.dbg.why = `it walks right up to P${r.id}`; }
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
    case 'flank': {                                                                    // (R1) a quick move to cover at their side
      if (!r || tgtGone(eng, e, r)) { e.plan = null; return; }
      if (P.arrived) { skHold(eng, e, dt); const q = perc(eng, e, r); faceToward(e, q.x, q.y, dt, 2.4); if (e.act !== 'creep') setAct(e, 'creep'); return; }
      const st = skCovertStep(eng, e, P, dt, thinkNow, r); if (e.plan !== P) return;   // (R13: seen on the way - it answered that)
      if (st === 'arrived' || st === 'failed' || now > P.until) { P.arrived = now; P.mode = ''; e.path = []; e.dbg.why = st === 'arrived' ? `at P${r.id}'s side, out of their sight` : `its way round P${r.id} ends here`; }
      return;
    }
    case 'listen': {                                                                   // (R1) it stands still and listens, its head turning
      skHold(eng, e, dt);
      const C = P.curious;                                                             // (R2) roaming: turned toward the sound it heard
      const hd = e.look.k && e.look.go <= now ? Math.min(P.t0, e.look.go) : P.t0;      // (R18: SKL.bodyAfter after its head began, as skHeadStep's body - not after the plan began, a think later)
      if (C && now - hd >= SKL.bodyAfter) faceToward(e, C.x, C.y, dt, skTurnRate(e));   // (R16e: at its body's turn - R2's 2.2 - after its head has begun: skHeadStep; R16g: the species' own turning, 3.6 rad/s standing)
      skHeadTo(e, Math.sin((now - P.t0) * 1.7 + e.id) * (C ? .35 : .8), dt);
      if (e.act !== 'listen') setAct(e, 'listen');
      if (thinkNow && now > P.until) {
        e.plan = null; e.dbg.why = 'it has listened';                                  // (R16e: its head comes back by its gaze, not in one jump)
        if (C) { skCurious(eng, e, C); return; }
        const Hh = e.hunt; if (Hh && !(r && r.seen)) skHuntNext(eng, e);
      }
      return;
    }
    case 'leave': {
      if (!P.goal) { e.plan = null; return; }
      if (e.act !== 'leave') setAct(e, 'leave');                                     // (B1: after a look)
      if (thinkNow && !e.path.length && e.pathAge > 2) plan(eng, e, P.goal.x, P.goal.y, { why: 'leave' });
      follow(eng, e, dt, skSpeed(e, P.fast ? 'fatigued' : 'roam'), { arrive: 60 });   // (B3: a withdrawal at its tired run, under the speed that costs stamina)
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
  const R = e.roam, hm = sm(.3, .6, e.hunger), hs = sm(.55, .95, e.hunger);
  if (e.state !== S.ROAMING) setState(e, S.ROAMING, '');
  if (R.pause > 0) { R.pause -= dt; stopMoving(eng, e, dt); if (e.act !== 'listen' && e.act !== 'watch') setAct(e, 'listen'); return; }   // (R16e: or it stopped to look - skHeadStep)
  if (e.act) setAct(e, '');
  if (!R.goal && thinkNow) {
    // (R16d) hungry, it goes where its prey has been - the freshest place it saw or heard somebody it may hunt, not yet looked at; else the dark
    const ev = e.hunger >= SK.huntHunger ? skPatrolGoal(eng, e) : null, g = ev || skDarkFloor(eng, e);
    if (g) { R.goal = g; plan(eng, e, g.x, g.y, { why: 'roam' }); R.until = eng.now + rand(e, SK.roamGiveUp[0], SK.roamGiveUp[1]); e.dbg.why = ev ? `prowling where it ${ev.k} somebody ${Math.round(eng.now - ev.t)} s ago` : 'roaming the dark'; }
  }
  if (!R.goal) { stopMoving(eng, e, dt); return; }
  if (thinkNow && !e.path.length && e.pathAge > 2) goTo(eng, e, R.goal.x, R.goal.y);
  // (R16d: starving, it prowls; R16g: exhausted, it walks.  R18: its casual walk 160; to a place its prey has been, its purposeful prowl - 205,
  // free of stamina - the hungrier the sooner)
  follow(eng, e, dt, Math.min(R.goal.ev ? lerp(skSpeed(e, 'roam'), skSpeed(e, 'prowl'), sm(.25, .6, e.hunger)) : skSpeed(e, 'roam') * (1 + .1 * hm), skCap(e)), { arrive: 40 });
  if (Math.hypot(R.goal.x - e.x, R.goal.y - e.y) < 60) { if (R.goal.ev) (R.seen || (R.seen = [])).push({ x: R.goal.x, y: R.goal.y, t: eng.now }); R.goal = null; R.pause = rand(e, SK.roamPause[0], SK.roamPause[1]) * (1 - .8 * hm); }   // (R16d: the hungrier, the shorter its pause)
  else if (eng.now > R.until) { if (R.goal.ev) (R.seen || (R.seen = [])).push({ x: R.goal.x, y: R.goal.y, t: eng.now }); R.goal = null; }   // (R16g, the review: a prowl it could not finish is not chosen again)
}
/* (R16d) where a hungry one prowls: the freshest place it saw or heard somebody it may hunt (its own memory: the last place it knew them,
 * the sounds it holds), within the last SK.patrolFresh seconds, that it has not walked to since; a floor point near it.  Never anybody's
 * real place: only what it perceived */
function skPatrolGoal(eng, e) {
  const now = eng.now, R = e.roam, done = (R.seen || (R.seen = [])).filter(q => now - q.t < SK.patrolFresh); R.seen = done;
  const near = (x, y) => done.some(q => Math.hypot(q.x - x, q.y - y) < 260);
  let best = null;
  for (const r of e.mem.p.values()) {
    if (tgtGone(eng, e, r) || e.left.has(r.id) || e.seenNow.has(r.id)) continue;   // (one it left it leaves; one it sees now its decision answers)
    const t = Math.max(r.seenAt, r.heardAt), heard = r.heardAt > r.seenAt && r.hx !== undefined, x = heard ? r.hx : r.lkx, y = heard ? r.hy : r.lky;
    if (!(now - t < SK.patrolFresh) || !Number.isFinite(x) || near(x, y)) continue;
    if (!best || t > best.t) best = { x, y, t, k: heard ? 'heard' : 'saw' };
  }
  // (R16g, the review: footsteps it took for somebody it left, or sees now, are passed over as that person is)
  for (const q of e.mem.sounds) { if (q.src === -1 || now - q.t >= SK.patrolFresh || near(q.x, q.y) || (q.pid && (e.left.has(q.pid) || e.seenNow.has(q.pid)))) continue; if (!best || q.t > best.t) best = { x: q.x, y: q.y, t: q.t, k: 'heard' }; }
  if (!best || Math.hypot(best.x - e.x, best.y - e.y) < 120) return null;
  const f = skFloorNear(eng, e, best.x, best.y); return f ? { x: f.x, y: f.y, ev: 1, t: best.t, k: best.k } : null;
}
function skinTick(eng, e, dt, thinkNow) {
  skBody(eng, e, dt); e.still = false;
  if (e.commit) { e.still = true; if (commitTick(eng, e, dt)) return null; }      // on its kill until the death has played everywhere
  if (e.cap) { skHold(eng, e, dt); return null; }
  // (R19) a vault, once begun, is carried through like a strike (at most SKIN's vault time, .56 s): a body in a vault is over the prop (the
  // shared moveStep lets it pass the prop meanwhile), and only the shared follower steps a vault - so nothing else may move it until it
  // lands.  R8-R18 let a plan change in mid-vault (an approach becoming a chase, its footwork) move the body on with the vault left open:
  // through walls, until the follower next ran and set it down at the vault's far end (R19's ordinary-play simulation: once in 36 hours,
  // an 830 px jump in a chase).  No think, no strike meanwhile (as in a strike)
  if (e.trav) { follow(eng, e, dt, 0); skHeadStep(eng, e, dt); return null; }
  if (e.pounce || e.recover > 0) return skStrikeStep(eng, e, dt);                 // a strike, once begun, is carried through
  if (thinkNow && skStrike(eng, e)) return skStrikeStep(eng, e, dt);              // (before deciding: at striking distance it does not stop to think)
  if (thinkNow) {                                                                  // (B1: what it notices, then the decision, then any reaction)
    skMindTick(eng, e);                                                            // (R11) who could see it now, what changed since its last think
    skAware(eng, e);
    skHuntTick(eng, e, Math.min(.5, eng.now - (e.huntAt ?? eng.now))); e.huntAt = eng.now;   // (R1) what it knows of its quarry
    skPreempt(eng, e, r => e.hunger >= SK.huntHunger && skMayHunt(eng, e, r));         // (R16d) did anything happen that cuts or questions its plan (ai.skin.preempt.js) - (R16e) prey only from the hunger it hunts at
    skLookThink(eng, e);                                                           // (R16e) movement at the edge of its view; somebody new in its sight (ai.skin.look.js)
    const df = skDefend(eng, e);                                                   // (B3) a warned, still provoked creature may defend itself, or withdraw
    if (df === 'strike') return skStrikeStep(eng, e, dt);
    if (!df) skDecide(eng, e);
    skAttend(eng, e);
  }
  // (R16g, the review) its footwork's velocity, from the tick before, goes on into the shared steering only as far as it lies along its facing
  // (the shared steering moves it along its facing): a sideways step is never turned forward in one tick
  if (e.mv && eng.now - e.mv.at <= dt * 1.5 + 1e-6) e.speed = Math.max(0, e.mv.x * Math.cos(e.ang) + e.mv.y * Math.sin(e.ang));
  skAct(eng, e, dt, thinkNow);
  skHeadStep(eng, e, dt);                                                          // (R16e) a sound just heard; the head's snap; the body where it is free to turn
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
    hd: e.heard.map(q => Math.round(eng.now - q.at)), sd: e.dbg.said ? { ago: +(eng.now - e.dbg.said.at).toFixed(1), src: e.dbg.said.src, why: e.dbg.said.why } : null,
    // (B1) the person it is most aware of (only ever somebody it has seen): pressure, whether it has noticed them, why, how long since it saw them; its reaction
    aw: skAwTop(eng, e), awN: e.aw.size, rx: e.rx ? { k: e.rx.k, pid: e.rx.pid, left: +(e.rx.until - eng.now).toFixed(1), why: e.dbg.rx || '' } : null, lv: e.dbg.lv && eng.now - (e.dbg.lvAt || 0) < 5 ? e.dbg.lv : '',
    df: e.dbg.def ? { pid: e.dbg.def.pid, k: e.dbg.def.k, odds: e.dbg.def.odds, cornered: e.dbg.def.cornered ? 1 : 0, ago: +(eng.now - e.dbg.def.at).toFixed(1) } : null,
    // (R1) its hunt: the quarry, how sure it is and how it knows, how long since that evidence, its effort and budget, flanks, searches
    ht: skHuntDbg(eng, e), mi: skMindDbg(eng, e),
    // (R16d-f) its last interruption (what it perceived, the plan it cut or kept, why), its eyes' stimulus, its footwork
    pe: e.dbg.preempt && eng.now - e.dbg.preempt.at < 10 ? { ago: +(eng.now - e.dbg.preempt.at).toFixed(1), from: e.dbg.preempt.from, cls: e.dbg.preempt.cls, kept: e.dbg.preempt.kept ? 1 : 0, why: e.dbg.preempt.why } : null,
    lk: e.look && e.look.k && eng.now < e.look.until ? { k: e.look.k, why: e.dbg.look ? e.dbg.look.why : '', body: e.dbg.look && e.dbg.look.body ? 1 : 0 } : null,
    ft: e.fight && !e.fight.blocked && eng.now - e.fight.at < .3 ? { pid: e.fight.pid, side: +(e.fight.side || 0).toFixed(1), back: +(e.fight.backT || 0).toFixed(1) } : null,
    ps: e.dbg.pos && eng.now - e.dbg.pos.at < 10 ? { k: e.dbg.pos.k, ago: +(eng.now - e.dbg.pos.at).toFixed(1), why: e.dbg.pos.why } : null,   // (R19) its last positioning choice
    sw: [...e.seenNow],                                                                   // (R16g: whom it sees now - the admin's overlay and the real-page campaign; `sn` is T6's skin note above)
    cv: P && P.mode ? { mode: P.mode, phase: P.phase || '', way: P.way ? P.way.len : 0, exit: P.way ? P.way.exit : 0, why: e.dbg.cover && eng.now - e.dbg.cover.at < 10 ? e.dbg.cover.why : '' } : null };   // (R13) its move's mode (covert, open, feint), a covert move's phase and way                // (R11) whether the people it sees could see it; its last events and how fast it answered
}
function skHuntDbg(eng, e) {
  const H = e.hunt; if (!H) return e.dbg.huntEnd ? { end: e.dbg.huntEnd.why, ago: +(eng.now - e.dbg.huntEnd.at).toFixed(1) } : null;
  const B = skBelief(eng, e, H);
  return { pid: H.pid, conf: +H.conf.toFixed(2), ev: H.ev, ago: +(eng.now - H.evAt).toFixed(1), u: Math.round(B.u), eff: e.enc && e.enc.pid === H.pid ? +e.enc.spent.toFixed(1) : 0, max: Math.round(skBudget(e)),
    flanks: H.flanks, tries: H.tries, failed: H.failed.length, heard: H.heard, rev: H.revised, why: H.why,
    g: H.guess || '', alt: H.altTried ? 1 : 0, hAgo: H.hAt > 0 ? +(eng.now - H.hAt).toFixed(1) : -1,   // (R2) its current guess; the other way tried; its last sound of them
    log: (H.log || []).slice(-4), hy: skHypDbg(H), rj: H.rej || [] };                   // (R12) the ways it holds; its guess's rejected rivals                                                   // (R11) its last evidence: seen / heard / inferred / disproved
}
function skAwTop(eng, e) {
  let A = null; for (const q of e.aw.values()) if (!A || q.p > A.p) A = q;
  return A ? { pid: A.pid, p: +A.p.toFixed(2), tier: A.p >= SK.pDefend && A.warns ? 'threatened' : A.p >= SK.pWarn ? 'provoked' : A.tier ? 'noticed' : '-', why: A.why, ago: +(eng.now - A.last).toFixed(1), d: A.d, looks: A.looks,
    warns: A.warns || 0, orbits: A.orbits || 0 } : null;
}
SKIN.tick = skinTick;
SKIN.debug = skDebug;
SKIN.predict = skPredict;                                       // (its guess from a record: the tests and the admin overlay ask it directly)
SKIN.hearSpeech = skHearSpeech;                                 // (T6) the engine's hearSpeech: a line said near it
SKIN.skinFrom = skSkinFrom;                                     // (T6) the engine's skinFrom: the look of the person it has killed
/* the snapshot's entry; dg (T6) only while it wears a skin: the look it wears, as the wire carries a wanderer's (hat|texture|hands|main) */
SKIN.snap = e => Object.assign({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: KACT[e.act] | 0, v: Math.round(e.speed), h: +(e.head || 0).toFixed(2) }, e.disguise ? { dg: e.disguise.look } : null);
