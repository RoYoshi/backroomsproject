# Trial 3 cognitive predator refinement — design decisions

Trial 3 and every refinement of it are **not owner-approved**; neither is anything here. Each decision says what was chosen, why (the R8
moment it answers, from `AUDIT.md` and `OWNER_FAILURE_REPRO.md`), and what was rejected. All of it is in one file,
`src/frameworks/nani/server/ai.skinstealer.js` (the Skin-Stealer species; its header has a paragraph per checkpoint), and every value has
one name in `SK` (`BALANCE_TABLE.md`). Nothing else in the game changed: no engine, sensor, movement, protocol, page script, overlay or
other species (C15, PR25, the six-seed P9 equivalence).

## What was wrong was the reasoning, not the reflexes (C0)

**Found.** R8 chose on the first think after a sighting and moved within 0.05 s of choosing (`AUDIT.md`). What made it passive in the
hunger an admin spawn gives (.45–.65) was what it chose: being watched scored retreat 1.29 / leave 1.04 / watch .88 / approach .08 (BD1);
"seen in the light" was a reason to leave; two people meant leave; a blind 9–10 s bait wait; 13 s on a lost runner's trail.
**Therefore.** The work changed the choices and what ends a plan, kept R8's think rate (10 Hz near), its senses and its executors, and
added only one reflex fix where a reaction really was slow (a sighting while frozen, a close sound).
**Rejected.** A faster think or a new perception module (no evidence they were the fault; shared engine scope); a pose or art change
(no visibility issue was demonstrated; `BODY_SCALE` stays 1.3).

## Reflexes: face what it sees, and keep facing it (C1)

**Chosen.** While frozen for somebody unaware turning its way, its head follows them (0.8 rad at once, then its body at 1.6 rad/s,
`SK.trackHead`, `SK.trackTurn`); a close sound is turned to at 3.6 rad/s; somebody in sight is re-aimed at on every think by a straight
line only, with a short lead (`SK.aimLead`, 0 on a lost race's trail).
**Why.** C01: R8 faced a walker 0.83–1.3 s after first seeing them; `c0_audit` O: circling 170 px round it, faced after 2.2 s (p50).
Now 0.05 s p50, 0.1 s worst (C01, C18).
**Rejected.** Searching a route on every think (path cost; the straight line is checked, and R8's routing remains when it is blocked).

## Interrupts: evidence ends a plan, a twitch does not (C1)

**Chosen.** A bait wait from hungry is 2.5–4.5 s, and ends at once when the person it waits for is heard going away; a listen ends when
the sound it waits for comes (C04 (b): within 0.25 s); a departure is thought over from .45, after 3–1.2 s, for an opening; a look away is
an **opening** only once it has lasted a beat (`SK.openBeat`, .35–.12 s by hunger) - shorter, the plan under way is kept.
**Why.** BD1–BD3: plans only a timer could end, then a departure. The owner asked for fast thinking; a creature that changes plan on a
tenth of a second's glance (R8: 3 of 12 runs) is noise, not thought. C18 (d) keeps the case where faster is worse: 0.15 s glances, 3 %
taken (R8 4 %).
**Rejected.** Dropping R8's hysteresis (`SK.rethink`) altogether (flicker came back in C04 (c)).

## The stand-off: watched is information, not a reason to go (C2)

**Chosen.** A new answer, `stand`, from hungry (.4) when somebody it sees is looking at it: it may first walk to a darker spot that keeps
them in view, then holds - crouched, facing them - and **closes in on every look away** (after the beat, at its stalk .. flank pace,
`SK.openRush`; by a straight line when it has one, else by a route under cover), freezing when their eyes come back; very hungry it
creeps in under their eyes too (`SK.pressFrom`: from .6 at nothing, more than a few px/s from about .65; never under 160 px, its spring
decides from there). A stand-off that gained ground lasts longer; alone with them, hungry, with effort left, it may renew once, from another
spot it walks to, instead of leaving (`SK.standFor`, `SK.standAgain` - C7). It never springs at somebody with company (C7).
**Why.** The owner's "incredibly passive": BD1 / BD5 / BD6 - back out of sight, wait blind, go. It turns "they are looking at me" into a
contest a player can see and play: keep your eyes on it and it waits; look away and it comes.
**Rejected.** Coming on regardless of eyes (that is the very hungry band's job, and would remove the counterplay); a longer watch (R8's
watch was the passive answer).

## Whom it goes for, and groups (C2)

**Chosen.** Its hunt's person while it sees them, unless somebody else it sees is 1.5 × the better chance (unaware, apart, nearer:
`SK.switchGain`); people together are never come at, but held from the dark (a stand-off) until one is apart.
**Why.** BD3: two people → leave in 0.02–0.42 s, and only the nearest was ever weighed. C13 measures the better chance taken with no
thrash and the effort kept.
**Rejected.** Attacking groups (pack 04 multiplayer fairness); the nearest only.

## A bait only where it is an ambush (C2)

**Chosen.** A spot round a corner counts as bait only if somebody following - to where it stood, then toward it - first sees it from 200 px
or less (`SK.baitAmb`, 18 sight samples on the level's walls); with no such corner it takes its next answer and does not look again nearby
for 10 s.
**Why.** R8 scored a bait spot for being out of sight; some could be seen from 500 px off by anyone following (C08).

## What it learns from what it sees them do (C3)

**Chosen.** It keeps its own sightings of its quarry for 10 s (nothing behind a wall is filled in). A full turn of arcs it actually saw
round something (a fitted circle, 90–420 px) means they are going round, not running from it; it **cuts across** to a point ahead on the
circle it can reach first by a straight run, and waits there crouched. Seeing them go the other way undoes the guess at once.
**Why.** R8 chased a circler's tail or gave up; the pack's B-C4. The guess comes only from what it saw and can be fooled by a reversal
(C06), and laps it did not see teach it nothing.
**Rejected.** Predicting from the level's geometry alone, or from a person it has not seen (perception leakage).

## The lost race (C3)

**Chosen.** Very hungry, when a fresh runner wins: a choice at once - a way round that gets ahead of them (R8's own prediction, only when
it really arrives first), else 3 s on their trail (`SK.trailFor`) at .85 of their speed, then listening and its hunt's guesses. Below .6 a
runner gets a stand-off (in view) rather than a departure - they may be going round.
**Why.** BD4: 12.7–12.9 s trailing. PR27's law kept: the gap a fresh runner won never shrinks while they move (C10, 12 / 12).

## The hunger gradient (C4)

**Chosen.** From .4 to .55 it goes for somebody it sees only with a chance drawn once per encounter from its own random stream (.4 at .4,
always from .55; `SK.boldAt`); passed over, a mildly hungry one watches them a while first (`SK.curious2`). A hunt already under way is
always taken up.
**Why.** Pack 04: hungry is "credible stalking, not guaranteed murder"; no single aggression flip. C12: went for them 0 / 0 / .71 / 1 … at
.1 / .3 / .45 / .55 …; R8 flipped from passive to lethal at .75–.8. Its own stream: nothing else it chooses moves.
**Rejected.** A deterministic threshold (a flip); scaling every weight with hunger (moved every seed).

## No game change at C5

**Chosen.** C5 only proves: anonymity of sounds (C07), fair springs in every new tactic (C11), four creatures and eight people (C14), the
snapshot unchanged (C16), no endless hunt (C17), latency against R8 (C18), the in-tree parity (C15).
**Dropped.** A guard widening PR27 to every way of following somebody who sprinted off (`skRanOff`): no scene showed the erosion it
was meant to stop (`BALANCE_TABLE.md` C5, `evidence/c5_guard.patch`).

## The QA record (C1)

**Chosen.** At most 24 recent decisions per creature in `e.cog` (when, what changed, what it chose), for tests and review only; never in
the snapshot (C16) or the overlay.
**Why.** The pack asks for evidence-driven decisions that can be reviewed; the admin overlay already has its WHY line.

## What the independent review changed (C7)

**Winded only as it is seen.** R8's chase read `stamina < 25`; every page draws a person heaving when exhausted or under 22
(`move.poses.js`, from the state the server sends every page), so the creature now judges exactly that (`SK.windedSeen`). The reviewer
called the read a hidden-truth leak; the state is public on the wire and drawn, so what was wrong was the three points nobody can see (C19).
**Never a spring at company.** The stand-off made springs possible from a watching plan, and nothing asked whether the person was alone
(C20). **A person passed over is let go** when they walk out of view, instead of R8's lost-sight interception hunting them anyway (C21).
**A stare-down is not a minute of a statue.** One renewal at most, and only from a new spot; then its next answer, usually going (C22).
The review's re-check found two more ways to stand still in plain view, both inherited: a flank spot it reached that the person could
still see, and a bait corner reached while still seen - each held until its effort ran out. Now either, still seen and looked at past a
beat, has failed: the place is remembered and it takes its next answer (C23).
**Rejected:** dropping `r.ex` or the drawn heave altogether (they are seen); attacking groups when starving (R8 never did; no evidence the
owner wants it).

## What is not claimed

The browser scenes are scripted pages, not a person; none dodges at the tell. The owner's play-test decides whether this reads as a
creature that thinks - and whether .45–.65 should now be as deadly as the real pages measured (`CHECKPOINTS.md` C6a and C7: per scene,
pooled over every valid pass, with n; 2–3 tries a scene and pass cannot separate "smarter" from "deadlier").
