# Trial 3 R19, S track - design decisions

Trial 3 is **not owner-approved**.  The owner (October 23, after a four-person R18 session): R18's Skin-Stealer is way scarier and its
active chase is pretty good - do not change it; make its positioning and openings BEFORE a chase smarter and more purposeful.  Not a speed
buff, not a new chase, not omniscience.  Every number below is its own reckoning from its own sight of them and the level's shape.

## S1-1 A way round is worth its time only if somebody will be there (`skFlankWorth`)

**Old.**  `skDecide` took a way round (flank) whenever it won the weighing and `skFlankSpot` found a covert way up to max(1600, 4.5 x d)
long - in the lit hall, ~1700 px (~10 s) to reach a person 450 px away.

**New.**  When the weighing picks a way round and its spot is found, it reckons the way's time: its withdrawal at its stalk, its hidden
run at its run, its quiet last stretch (`SKC.sprintFrom + SKC.settle`, 316 px) at its stalk, its settle (`SK.flankSettle`, 0.3 s) - the
same paces `skCovertStep` will use, as they are now (`skSpeed`: a tired body is slower - the review found the first form used the rested
table values).
- *Somebody it sees moving* (over 60 px/s): carried on as it sees them going (their seen velocity x that time - no route, nothing about
  where they mean to go), they would be within `SKC.rush` (360 px, its spring from cover) of its spot, or there is no way round them
  (f = 0).  (The pack: "model detour cost against how far an observed moving quarry could plausibly travel".)  The first form weighed such a
  way round down gradually (f >= 0.15); the independent review found it was then searched again and taken a think later.
- *Somebody standing*: beyond what coming on openly would take (at its press when it may run - lerp(investigate 232, press 260) by hunger
  from `SK.chaseHunger` - else its prowl 205), it may spend `SK.detour` = lerp(12 s, 6 s) by `sm(.45, .9, hunger)`: f = 1 - over / budget,
  at least 0.15.  At .7 the budget is 8.5 s - the hall's 10.3 s way round is about worth it (R13-R18's tactic kept); at .85 it is 6.2 s,
  and the way round loses to coming on openly (the pack's Scene B: "a starving one presses rather than vanish for ten seconds").
- W.flank is multiplied by f and the weighing re-run; when another answer wins, the refusal is **remembered for the place** as "no way
  round here" already is (`e.noFlank`: `SK.noFlank`, 10 s, or until they are 200 px on) so the same search is not made on every think, and
  it records why in `e.dbg.pos` (`flankRefused`: "its way round P101 would take 10.2 s (against 1.7 s coming on; it may spend 6.2 s more):
  approach" / "(they would be 924 px from its spot by then): watch") and `e.tally.flankRefused`.  The record and the tally are written
  only when the plan really changes - after the plan under way has had its say (`SK.rethink`) - not on a think the old plan was kept
  (the review found records for refusals that changed nothing).  The flank's own reason now carries its time ("... (1721 px, 10.3 s)").
- *Not the bait for somebody going their own way.*  A way round refused for somebody moving is not answered with the back-off (`W.retreat =
  0`): a retreat round a corner for somebody already going their own way is the same absence.  The review's probe showed it then backed off
  on the next think anyway; so while that refusal is remembered, or on a think it drops a stale way round (S1-2) or one given up because
  they run off from it (R13's `fleeing` rule), the back-off weighs 0 for somebody moving (over 60 px/s) and not towards it, and such a
  dropped way round is remembered as a mover's refusal is.  Somebody walking towards it keeps R13-R18's answers, the lure among them - on
  the refusal's own think too (the second review: that think had no such gate, and a walker coming on got a 0.2-0.7 s watch before the
  back-off R18 gives them).

*Rejected first form:* one rule for both (the budget against open approach, x0.4 when they move, `SK.detour` 6-2.5 s).  It took R13-R18's
way round away from moderately hungry ones facing a stander and failed seven R13-R16 suites (C17-C19, PR06, PR19, X05, X07) that hold that
tactic - honestly: the scenes stood still, and the R18 owner report praised the creature.  The fix was the design (moving vs standing),
not the tests.

## S1-2 A way round under way that no longer leads to them (`flankStale`)

While it is on a way round and can see them (it decides only on a think with them in sight): if they are more than `SKC.moved` (150 px)
from where they were when it chose the spot, or are moving away from the spot (over 80 px/s), the way round under way weighs 0.25 instead of
2, so the weighing may pick another answer (`e.dbg.pos` `flankStale`, written when the plan changes).  Out of its sight it goes on (it
cannot know).  SR06: somebody it went round, seen walking off from its spot - given up 0.13-0.14 s after they set off, on the think of its
record, and it came on (approach or chase) in 6/6; R18 kept the way round to the end of the 8 s run (run on for 14 s: some 10 s, then it
lay in wait at the spot for nobody).  A way round given up because they run off from it (R13's `fleeing` rule) is recorded the same way
("running off from its way round", the second review).

## S1-3 (withdrawn after the review) "They will have moved on" at the spot

The first S1 also had a rule at the spot (`skFromCover`): if its belief of them, carried on by how they were last moving, lay beyond
`SK.closeFrom + 50`, it hunted on (`flankMovedOn`) instead of lying in wait.  The review found no test reached it.  Searched for: 36 h of
simulated ordinary play (0 times), 30 placements x 4 ways of walking off once its way round was hidden (0).  Its precondition - last seen
moving, yet not seen moving off from its spot - is the case S1-2 catches first, and somebody who starts moving only after it lost sight of
them leaves a belief at rest.  Untested code that could not be reached was removed; R18's arrival (rush, or wait, then listen and search)
is kept as it was.

## S1-4 The contest: an open approach heads for their way out (`skContest`)

An open approach (not a shadow of a lost race, not a rush, not in a skin) to somebody it sees **standing** (60 px/s or less), hungry
enough to hunt, beyond its footwork's range (`SKF.near`, 400 px) and within `SK.contestFrom` (1000 px): it reckons their way out with the
footwork's own 12-ray reckoning (`skWayOut`, factored out of `skFight` unchanged); if that way lies `SK.contestOff` (0.6 rad) or more off
the straight line beyond them (a doorway, a side passage), it heads for a point a little way out along it - 30 % of the distance, 100-200
px from them, short of the wall, on open floor and with a clear line to them - instead of at them.  The point is kept while they stay within
`SK.contestKeep` (120 px) of where it chose it (no flicker), re-reckoned at its usual re-route (1.5 s), dropped when its footwork has them.  **Only a point it can walk straight to with them in its sight all the way**: the point is on open
floor (its collider + 2 px), has a clear line to them, a clear line from it at the route margin (its collider + 7 px), and every 60 px
along that line sees them (`geo.los`); it then walks there directly (`directTo`).  The independent review found the first form's point
could need a route out of their sight - it lost them there, listened and searched; else (no such point) it comes at them, as R18.  A
kept point is re-checked from where the body is at each re-route (the second review: a body pushed off its line kept heading for it with
no clear line); with no straight line from there (or a point farther than `SK.contestFrom` + 200 px, the most a point can lie beyond
somebody `SK.contestFrom` off) it drops the point and comes at them.
Somebody walking or running gets R18's approach and chase, unchanged.  (The pack's option 2, "short contest / doorway position".)

*Effect, measured* (`scene_r19.js escape`, a person standing at the junction, sprinting at 550 px): R18 - east (the side passage) escapes
8/8, west 7/8; S - east (now contested) 0/8, west 8/8.  One exit is closed, the other stays open: "meaningful but outplayable" (S02).  At
450 px the picture changes (R18 catches east 8/8, west 7/8; S east 4/8, west 6/8) and at 350 px both trees are the footwork's (east
escapes 8/8, west 0/8) - it is a positional choice, not a better chase.

## The second independent review (after the fixes above)

A second reviewer, who had not seen the work, read the fix commits and probed them (no blocker found):
- *The refusal's own think blocked the back-off for somebody walking towards it* - gated by `away > 0` (above).
- *A way round given up because they run off (`fleeing`) had no no-bait protection* - in SR01's walk-off scene (seed 4 at .6) it backed
  off, lured and lost them: now as stale (above), recorded as `flankStale` ("running off from its way round") and remembered.
- *The remembered-refusal branch of the no-bait rule was not pinned by any test* - checked by taking each branch out of the built file:
  without the remembered branch SR06 fails (the bait once within 2.5 s); without the `fleeing` case SR01 fails (the bait twice within
  2.5 s of a dropped way round, the check SR01 now makes).
- *A kept contest point skipped the direct-route check* - re-checked (S1-4).
- It found the merge needed a fresh run - done: the combined tree's suite, both new suites and the scenes (`dev/trial-3-r19-combined/`).
- It raised for the owner: at 550 px the contest turns the side passage from 8/8 escapes into 0/8 while the hall stays 8/8 - one way out
  closed, the other open (S1-4); whether that is fair enough is the owner's call (HUMAN_QA S-D).

## S2 Commitment, persistence, churn

- No new per-tick search: the worth is reckoned only when the weighing has already picked a way round (its spot search, R7's rule, is
  unchanged and is the expensive part); the contest is reckoned only at the approach's re-route (at most every 1.5 s on a think) and is one
  12-ray scan, two clearance tests.
- Hysteresis: a refused way round is remembered for the place (`SK.noFlank`, 200 px), as "no way round" already was; the plan under way is
  still kept unless another is clearly better (`SK.rethink`); the contest point is kept while the person stays within 120 px.  SR05, in
  four scenes where it does reckon (a watcher flicking their view every 0.5 s, somebody walking and stopping in turn every 0.6 s, somebody
  walking towards it, somebody walking off its way round - 22 runs, 10 positioning records, 6 refusals, 11 ways round): at most one
  positioning record per think, at most 3 plans begun in any second, no way round dropped on the next think, no covert search on the
  thinks after a refusal (1 s), no way round begun within 2 s of one.

## S3-fix The vault is carried through (`skinTick`)

R8-R18: a vault (`e.trav`) is begun and stepped only by the shared follower; a plan whose movement does not use it (the footwork, a spring)
left it open, the shared `moveStep` let the body pass solid props meanwhile, and the next `follow()` set it down at the vault's far end
(AUDIT.md 5).  Now, before anything else in its tick (after a kill or a hold), a vault under way is stepped by `follow()` until it lands
(at most its vault time, 0.56 s): no think, no spring meanwhile - as a strike, once begun, is carried through.  SR04 holds the body to the
vault's line; on R18 the same scene left the line by 25 px and landed late.

## Instrumentation (admin only)

`e.dbg.pos` (kind, the person's id, its reckoning in words) goes to the admin overlay's Skin-Stealer block as `ps` (only within 10 s); the
tallies `contest`, `flankRefused`, `flankStale`.  The debug block is computed and sent only when an authenticated admin
client has debug on (src/core/server/loop.js `wantDbg`); the public snapshot entry is unchanged (PR26: `a,ac,h,i,s,v,x,y`).

## Balancing defaults (new)

`SK.detour` [12, 6] s, `SK.contestFrom` 1000 px, `SK.contestOff` 0.6 rad, `SK.contestKeep` 120 px; 60 px/s (moving), `SKC.rush` (reach of
the spot for somebody moving), 0.15 (least worth for somebody standing), 80 px/s (moving off from its spot).  Unchanged: every speed (walk 160, prowl 205, investigate 232, press 260, run 270), stamina, the spring and
its wind-up, the kill, perception, memory, inference, cover auditing, the R18 weights.
