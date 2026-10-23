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
- the waypoint and the next are plain (no vault link, no crawl or tight-gap cell);
- the body is within 26 px + 0.12 s of its own travel of it (26 px at rest, 61 px at a Hound's 292 px/s);
- the body is over the line square to the next leg through the waypoint (`(body - wp) . u_next > 0`);
- the waypoint lies 80 degrees or more off the body's heading (beside or behind it);
- a straight line from the body to a point 48 px along the next leg (or the whole leg, if shorter) has the route's own margin
  (`geo.lineClear(..., e.rc + NAV_MARGIN, e.mode)`, the margin `smoothPath()` builds routes with);

then the waypoint is dropped and the tick is followed again without it (one re-entry; `o.passed` stops a second).  Anything else - an aim
that does not swing back, a body that ran wide (it has not crossed the line square to the next leg), a link or crawl waypoint, no room to
the next leg - is R18's follower, unchanged, tick for tick (`evidence/N1/corner_n1_summary.json`: 624 of 640 audit runs identical).

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
- *Kept: the drop only where it cures the defect* - the aim actually swinging back.  It fires rarely (in 16 of 640 audit runs, 8 of the 180
  fast-pace runs of s_nanicorner.js), only at speed, and only removes the pivot; the braking before the bend, the turn rate, the overshoot are
  each species' own.
- *A species opt-out was considered and not needed.*  The pack prefers per-species tuning or opt-outs over one style for all.  The drop
  changes no species' turning, speed, braking or line; it removes a stop no species was designed to have.  Measured per species: the Hound
  keeps the widest line at speed (most off its route 52.6 px, unchanged), the Skin-Stealer and the Smiler theirs (40.0 and 44.7 px,
  unchanged); every run's fastest turn is within its own rate.  The Smiler's reactive logic (ai.smiler.js) is byte for byte R8's (WL05).
- *Margin.*  The line to the next leg needs `e.rc + NAV_MARGIN` (the route's own margin), not `e.rc + 0.5` (the carrot's): a drop happens
  only where the body has real room to the next leg.

**The evidence law.**  Nothing the follower reads changed: its route, its own position, heading and speed.  No player, no perception.

**Balancing defaults (new, in the code):** 1 rad (the aim's swing), 26 px + 0.12 s (reach), 1.4 rad (beside or behind), 48 px (along the
next leg), `NAV_MARGIN` (room).  No speed, turn rate, acceleration, collider, clearance, smoothing, braking or feeler value changed.

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
