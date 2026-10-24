# Trial 3 R19, N track - design decisions

Trial 3 is **not owner-approved**.  The owner's request (October 23, after a four-person R18 session): a comparatively minor corner-rounding
and turning QoL in N.A.N.I.'s shared locomotion, each species keeping its own personality - the Hound primal and forceful, the
Skin-Stealer controlled, the Smiler unchanged in its reactive logic.  The pack's rule: diagnose an actual source-level defect in the existing
follower; "add smoothing" is not permission to write a second one.

## N1 - a waypoint passed on the inside of a bend is dropped when the aim would swing back for it

**Old (R8-R18).**  `follow()` dropped a waypoint at 26 px, or when the whole next leg was clear (within 110 px).  A body that cut the
inside of a bend and went by its waypoint at 27-60 px kept it; `carrotOf()` then aimed back at it and the body stopped, pivoted and went
(AUDIT.md: Hound chase route 23, 292 -> 29 px/s in 0.1 s).

**New.**  In the carrot step, after `carrotOf()`: when the aim it gives is more than 57 degrees (1 rad) off the body's heading, and the
waypoint is one the body has passed on the inside of the bend - all of:
- the waypoint, the next and the one after are plain (no vault link, no crawl or tight-gap cell);
- the body is within 26 px + 0.12 s of its own travel of it (26 px at rest, 61 px at a Hound's 292 px/s);
- the body is over the line square to the next leg through the waypoint (`(body - wp) . u_next > 0`);
- the body is on the side its own heading turns toward to take the next leg - the inside of the bend while it is turning into it (this
  is a test of its heading, not of the bend's geometry: a body whose heading has already swung past the next leg could pass it from the
  outside; in the review's 2,000 fresh runs, classified by the real bend, every one of the 39 drops was on the inside);
- the waypoint lies 80 degrees or more off the body's heading (beside or behind it);
- the straight line from the body to the point it will aim at along the next leg - its own look-ahead, `clamp(speed x 0.42, 64, 150)` px,
  the carrot's, or the whole leg if shorter - is clear by its collider and 2 px (`geo.lineClear(..., e.rc + 2, e.mode)`);

then the waypoint is dropped and the tick is followed again without it (one re-entry; `o.passed` stops a second).  Anything else - an aim
that does not swing back, a body that ran wide, a link or crawl waypoint in the next two, no room to the next leg - is R18's follower,
unchanged, tick for tick.

**Why this form.**
- *N1-a, rejected: drop it in the waypoint loop whenever it is passed.*  The first form dropped every passed waypoint before the carrot was
  even looked at.  It removed the stop-pivot-go (Hound chase slow 0.81 -> 0.31 s) but in tight successive bends (two 45 degree waypoints
  making one 90 degree turn) the dropped waypoint's braking went with it: on a fresh 30-route set (s_nanicorner.js) a Hound grazed a
  corridor's jamb 3-4 times where R18 had not, 0.09 s slower, and a Skin-Stealer 1-2 times.  A test that says "no more wall contacts on
  any species, no route slower" failed honestly; the condition was narrowed instead of the test.
- *N1-c, rejected: brake for the bend from the body's heading near a waypoint* (`cornerSpeed` with min(theta(aim), theta(heading))).
  Measured worse: Hound chase slow 0.31 -> 0.50 s, feeler brakes 28 -> 37, turn reversals 31 -> 44, least clearance 0.56 -> 0.21 px.
- *N1-d, rejected: after a drop, brake for the next bend from the heading* (max(...)): no effect on the graze above (the braking
  distance term lets the body keep its speed until 40 px from the waypoint).
- *Kept: the drop only where it cures the defect* - the aim actually swinging back.  It fires rarely - in 16 of the 640 seed-7 audit
  runs (`evidence/N2/corner_n2_summary.json`: the other 624 identical tick for tick to R18's), 38 of 2,000 fresh-seed runs, 8 drops in
  s_nanicorner.js's fast-pace runs - only at speed, and only removes the pivot; the braking before the bend, the turn rate, the overshoot
  are each species' own.  What the tighter line costs, measured: no wall contact more anywhere; slides along a clipped corner (the
  collider grazing it, `moveCollide`) +7/+8 over the 80 Hound chase runs of seed 7 and +3/+2 for the Smiler and the Skin-Stealer on fresh
  seeds, -17 for the Hound there; the feeler's brakes fewer (Hound 261 -> 233, Smiler 29 -> 18, fresh seeds).
- *A species opt-out was considered and not needed.*  The pack prefers per-species tuning or opt-outs over one style for all.  The drop
  changes no species' turning, speed, braking or line; it removes a stop no species was designed to have.  Measured per species: the Hound
  keeps the widest line at speed (most off its route 52.6 px, unchanged), the Skin-Stealer and the Smiler theirs (40.0 and 44.7 px,
  unchanged); every run's fastest turn is within its own rate.  The Smiler's reactive logic (ai.smiler.js) is byte for byte R8's (WL05).
- *Room to the next leg.*  The check is the line the body will actually take - to its own look-ahead point on the next leg - at its
  collider + 2 px.  The route's own margin (`e.rc + NAV_MARGIN`, 7 px) was tried at that point and removed every drop (0 in 640 runs):
  `smoothPath()` lays the route NAV_MARGIN off the walls, and a body beside the waypoint looking ahead along the next leg is nearer the
  inner corner than the route is.  `moveCollide` keeps every body out of solid geometry as before; the measure is what the body then does
  (contacts, clearance), below.

## The independent review (N) and what changed

A reviewer who had not seen the work read the hunk and probed it on fresh seeds.  Its findings, and what was done:
- *A drop on the outside of a bend* (a body that ran wide, curving back, could have its waypoint dropped): the inner-side condition above.
  On 2,000 fresh runs (seeds 11, 29, 41, 53, 67; every species and pace, from rest and from speed): 39 drops, **0 on the outside**.
- *The look-ahead* (the first form checked a fixed 48 px point at the route's margin, not the line the body then follows): the check is
  now the body's own look-ahead point at its collider + 2 px.  The worst least clearance among runs with a drop: **0.16 px** (seed 29,
  route 11, a Hound at 292 px/s from speed; R18's follower 1.16 px on the same run) - never inside anything; of the Hound's 16 runs with a
  drop, 8 ended tighter and 8 wider.  For scale: R18's own least clearance over s_nanicorner.js's runs is 0.28 px.
- *A crawl or a vault just beyond the next waypoint*: the waypoint after the next is checked too.
- *NC03 and NC04 did not exercise the hunk*: NC03 holds by construction (link and crawl waypoints are excluded - it checks that they
  are never dropped and that traversal is R18's); NC04 now also sends Hounds after runners by the admin's navigation command, where the hunk
  fires, against the same chase with the hunk taken back out in a child process (`dev/tests/r19n_chase.js`, `r19n_child.js`).
- *Wording*: "eliminated" became "eased" (NC01).
- Fresh seeds, in total (`tools/fresh_seeds.js`, `evidence/N2/fresh_seeds.txt`): contacts, bonks, stuck recoveries and off-route re-plans
  equal for every species; the Hound's feeler brakes 261 -> 233, its time 1834.2 -> 1830.7 s over 400 runs; no run with a drop got worse
  on any measure.

**The evidence law.**  Nothing the follower reads changed: its route, its own position, heading and speed.  No player, no perception.

**Balancing defaults (new, in the code):** 1 rad (the aim's swing), 26 px + 0.12 s (reach), 1.4 rad (beside or behind), the body's own
look-ahead (64-150 px) along the next leg, the collider + 2 px (room).  No speed, turn rate, acceleration, collider, clearance, smoothing,
braking or feeler value changed.

## The second independent review

A second reviewer read the narrowed hunk and probed it (no blocker): the inner-side sign is right for corner cutting, re-entry is bounded
by `o.passed`, the stuck side-step and link/crawl waypoints are excluded, `moveCollide` is unchanged (the drop changes only the aim and
cannot tunnel), and the locks pin exactly this text.  Two nits, both taken: the hunk's comment said the side test was geometric - it is a
test of the heading (corrected above and in the code's comment; behaviour unchanged, `r19n_patch.js` regenerated); and NC04's navigation
chase exercises the hunk only thinly (2 drops in 28,800 Hound-ticks) - it is non-vacuous (it fails with none) and the weight of the
evidence is NC01-NC03, the seed-7 audit and the fresh seeds.

## The owner's addendum: never weaker

The owner (October 23, during the QA): the movement work must not weaken any monster - not its pursuit, corner speed, attacks,
acceleration or character - and no artificial slowdown, braking or hesitation for the look of it; if a species is measurably weaker, fix
it or keep R18's behaviour for that species.  The hunk adds no braking, delay or slowdown (it only stops the aim turning back for a
waypoint already passed; every speed, acceleration, turn rate, braking and feeler is R18's).  Measured as game outcomes on identical
seeded chases (REGRESSION "Never weaker": 1,044 per tree, and a lap study with a 1 px control): catches and attacks begun equal for every
species; where the hunk acted (rarely - a pursuer that sees its quarry steers straight at it) the result moved both ways, within the lap
chase's own sensitivity.  **Kept for every species**; a per-species opt-out was not needed.

## The locks that hold the shared engine, taught exactly this hunk

PR25 (s_skinpredator.js: the shared engine and the Hound's and Smiler's code byte for byte 4518f93), WL05 (s_wandererlock.js: R8 f378049)
and C15 (s_skinmind.js: with no Skin-Stealer, every snapshot R8's) held `ai.entity.js` byte for byte.  The owner's R19 request is a change to
that file, so each now compares against the base **with exactly the hunk in `dev/tests/r19n_patch.js` applied** (PR25, WL05), or runs this
tree with exactly that hunk taken back out in a child process and requires every one of R8's snapshot hashes (C15; the run as built is
reported too).  Any other change to ai.entity.js, or to the hunk, still fails them.  No threshold changed.

## What was deliberately left alone

`smoothPath`, `cornerSpeed`, `steerTo` (turning, feelers, acceleration), `moveCollide`, the stuck ladder, `coarseMove` and the tiers,
vault/crawl traversal, every species file and every speed.  The Skin-Stealer's covert way (`skCovertFollow`, its own waypoints and
`steerTo`) and footwork (`skStrafe`) do not use `follow()` and are untouched.  Hound future blind pursuit, OVERSEER v2 and everything in the
pack's out-of-scope list: untouched.
