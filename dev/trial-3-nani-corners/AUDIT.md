# Trial 3 R19, N track - shared N.A.N.I. cornering: the audit (N0)

Trial 3 is **not owner-approved**.  This branch, `trial-3-nani-cornering-qol`, is an isolated engineering branch for the owner's Human QA.
Nothing here is merged, deployed or spawned organically.

## Starting point (verified fresh, 2026-10-23)

| what | value |
|---|---|
| base branch | `trial-3-r9-cognitive-ambush-overhaul` (R18), fetched fresh before any write |
| R18 receipt (this branch's parent) | `01e5d97afd7bd1fec4fd4e34ef07953101faef6e`, tree `e042ca380e7fff5e52a96d2c7354e62f60fedc9a` |
| R18 runtime commit | `c3b40dc35b5f8f7d5542134c3c21e66c8ad9cb66`, tree `8178f7854a5a3b2e05245bcf8065d34d465d4a75` |
| R17 fallback | `636f01ea074cb969d2f1ef1cff9dd081f24185f9` (tree `0879f3070a14b0407348e01aaeb0119a68ac1a93`) |
| remote R18 head at the start | `01e5d97` on `git ls-remote` and the GitHub REST branch and commit (tree and parent equal) |
| remote heads at the start | 41, recorded before the first R19 push: `inventory/remote_heads_before_r19.json` (2026-10-23T22:19:48Z) |
| the pack's source facts | the six blobs in `SOURCE_FACTS.json` (`ai.entity.js b4bcda9`, `ai.skin.move.js 52c0556`, `ai.skin.cover.js f5024a4`, `ai.skin.infer.js 825ca5f`, `ai.skin.preempt.js dc9a6bd`, `ai.skinstealer.js a2d3547`) equal 01e5d97's |

The N branch was created from the receipt itself (not from the S branch); it is one straight line from `01e5d97`
(`tools/verify_remote_r19.py` checks this on every push).

## Baseline on 01e5d97 (this environment: node v22.22.2, the repository's own scripts)

- `npm test` (dev/tests/run.js, its default list): **330/343** - the 13 failures are the inherited P9 set (2F F13, 2F F22, C1, C18, C3,
  C4, C5, C9/C10, H07, L9, NV09, P01, P08), the same names as R18's report.
- `node dev/tests/run.js s_humanqa_hotfix.js`: **5/6** - X03 inherited.
- Every Skin-Stealer suite green: s_skinstealer 34/34, s_skinbehave 19/19, s_skinpredator 30/30, s_skinap 18/18, s_skinroute 15/15,
  s_skinadv 9/9, s_skinr16 5/5, s_skinmind 15/15, s_skinsight 10/10, s_skinr9 1/1, s_skinbody 11/11, s_skinrend 8/8,
  s_wandererlock 6/6.

## The shared locomotion, as it is (R18 `ai.entity.js`, blob b4bcda9)

`plan()` (L110) runs A* on the 48 px grid and `smoothPath()` (L78) string-pulls it (NAV_MARGIN 7 px beyond the collider, falling back to
3 px and 0.5 px in narrow halls; vault links and crawl/tight-gap cells never smoothed across; bend waypoints eased up to 24 px toward room).
`follow()` (L206) drops a waypoint at 26 px (the last at `arrive`), or when "passed it already" - within 110 px with the whole next leg
clear at the collider + 2 px (L217); it aims at `carrotOf()` (L194: look-ahead `clamp(speed * .42, 64, 150)` along the route, pulled back
toward the waypoint up to three halvings until the line has room at collider + 0.5 px), slides round a clipped corner (L228-238, ±k·0.16
rad), low-passes the aim (~70 ms), brakes for the bend at the next waypoint (`cornerSpeed()`, L183: room R 115 px for a Hound, 80 px for
the others; braking 2.2 x its acceleration), and steers (`steerTo()`, L159: turn rate `TURNING_ABILITY x (1 - turnPenalty x speed / vTop)`,
speed x cos(heading error) down to 0.1, three feelers).  `moveCollide()` (L40) is swept in 10 px steps.  The stuck ladder: a side-step at
0.35 s, a re-route at 0.9 s.  Far away (`tierOf`, L284: beyond 3800 px) `coarseMove()` (L290) slides along the cached route without
steering.

Callers: `follow` - ai.engine.js (navGoStep), ai.hound.js, ai.smiler.js, ai.skinstealer.js (27 calls); `steerTo` directly - ai.hound.js
and the Skin-Stealer's covert way (ai.skin.cover.js `skCovertFollow`, its own waypoint index, turn x1.6); the Skin-Stealer's footwork
(`skStrafe`, ai.skin.move.js) sets its own velocity and calls `moveCollide`.  Species: Hound radius 26 / vTop 320 / turnPenalty .62 /
turning 3.4 / acceleration 880; Smiler vTop 300 / .3 / 3.1 / 520; Skin-Stealer radius 24 / vTop 300 / .5 / 3.6 / 760.

## Measuring before changing: `tools/corner_audit.js`

40 routes drawn by seed 7 on Level 0's open floor (500-1500 px, a bend of 45 degrees or more in the route, no vault link), each species at
the paces its own AI uses (Hound roam 92 / chase 292; Smiler roam 80 / approach 92 / chase 255; Skin-Stealer walk 160 / prowl 205 / run 270),
from rest and from speed: 640 runs on the tree's own `plan()`/`follow()` at 60 Hz (a test-only copy of the built ai.js names them; nothing
else of the AI runs).  Measured: time against the ideal, slow (< half pace) and stopped time away from the ends, pivots (turning > 1.2 rad/s
under a third of the pace), aim jumps (> 0.6 rad in a tick), turn reversals, wall contacts and hard bonks, feeler brakes, corner slides,
stuck side-steps and re-routes, least clearance, how far off its planned route it ran.  `tools/corner_plot.py` draws a run.

R18 (`evidence/N0/corner_r18_summary.json`, sums over the 40 routes):

| species pace | slow s | pivot s | aim jumps | reversals | contacts | slides | least clearance (runs < 1 px) | most off route px |
|---|---|---|---|---|---|---|---|---|
| hound roam | 0.17 | 0.06 | 0 | 33 | 5 | 656 | 0.29 (25) | 59.8 |
| hound chase | **0.81** | **0.40** | **4** | 46 | 16 | 254 | 0.43 (2) | 52.6 |
| hound chase, from speed | **1.12** | **0.44** | 4 | 49 | 20 | 249 | 0.32 (4) | 52.4 |
| smiler roam | 0 | 0 | 0 | 37 | 9 | 868 | 0.24 (29) | 60.6 |
| smiler chase | 0.31 | 0.03 | 6 | 29 | 22 | 204 | 0.73 (2) | 44.7 |
| skinstealer walk | 0 | 0 | 0 | 19 | 7 | 379 | 0.81 (3) | 55.7 |
| skinstealer run | 0.27 | 0.05 | 3 | 32 | 25 | 214 | 0.99 (1) | 40.0 |

(all 16 rows: `evidence/N0/corner_r18_summary.json`)

## The defect found (and what was not a defect)

**JERK / HESITANT CORNER at speed - the stop-pivot-go (reproduced: Hound chase routes 23 and 26; also Smiler chase 16/23/26 and Skin-Stealer
run 23/26, milder).**  Route 23, Hound chase (`evidence/N0/hound_chase_r23_r18.png`, trace in the table below): the Hound at 292 px/s cuts
the inside of a 53 degree bend and passes the waypoint (1560, 1464) at 27-43 px, beside it.  It is not dropped: 26 px is the arrival radius,
and the "passed it already" rule needs the whole next leg (to (1272, 1848), 480 px) clear at collider + 2 px, which it is not from the inside
of the bend.  So `carrotOf()` starts from the body, goes back to the waypoint and along the next leg; the line to that point clips the
corner and is pulled back toward the waypoint - beside and then behind the body.  The heading error passes 90 degrees, `steerTo()`'s
cos(error) factor takes the speed from 292 to 29 px/s in 0.1 s, the body pivots on the spot and goes again (0.3 s lost, a visible "robot
pivot").  `cornerSpeed()` adds to it: beside the waypoint, the line to it is square to the travel, so the bend it brakes for is far sharper
than the one left.

| t s | x, y | heading | speed | aim (want) | note |
|---|---|---|---|---|---|
| 1.17 | 1603, 1477 | 2.79 | 292 | 2.79 | cutting the bend |
| 1.32 | 1572, 1489 | 2.71 | 204 | 2.71 | beside the waypoint, 28 px |
| 1.52 | 1539, 1499 | 3.05 | 123 | -1.92 | the aim swings back |
| 1.57 | 1536, 1499 | 3.19 | **29** | -1.12 | stopped, pivoting |
| 1.62 | 1535, 1499 | 3.35 | 44 | -2.38 | waypoint finally dropped |
| 1.92 | 1487, 1512 | 2.64 | 239 | 2.06 | going again |

**Not changed, with reasons:**
- *Wall skimming at walking pace* (slides 650-870 per 40 routes at roam/approach, least clearance 0.24-0.37 px): the carrot's line test at
  collider + 0.5 px is R8's design for narrow halls; the body never enters a wall (no contact at those paces beyond 5-15 per 40 routes,
  no bonks), and widening the margin would change every species' walking line everywhere.  Deferred (`DEFERRED.md`).
- *Corner braking room* (R = 115 px Hound, 80 px others): the Hound's wide, fast bend is its character; a corner-speed change was tried
  (braking from the body's heading near a waypoint) and measured worse (Hound chase slow 0.31 -> 0.50 s, feeler brakes 28 -> 37, least
  clearance 0.56 -> 0.21 px) - rejected (`DESIGN_DECISIONS.md` N1-c).
- *Far tier*: `coarseMove()` and the tier switch are not touched.  One related R8-R18 behaviour was seen in R19's 36-hour simulations (both
  tracks' trees): a body whose tier goes far mid-vault is left over the vaulted prop and the engine's watchdog sets it back on open floor
  when it is next simulated - only ever seen at the mid tier (1900+ px from every player).  Deferred (`DEFERRED.md`).
- *Render heading*: the page draws the server's heading; nothing on the client is changed.

## Allowed change (documented before the change)

One hunk of `src/frameworks/nani/server/ai.entity.js` `follow()` (and `generated/server/ai.js` / `generated/BUILD_MANIFEST.json`
regenerated by `npm run build`); the checks that pin the shared engine to its starting commits (PR25 in s_skinpredator.js, WL05 in
s_wandererlock.js, C15 in s_skinmind.js) taught exactly that hunk (`dev/tests/r19n_patch.js`); a new suite `dev/tests/s_nanicorner.js`
(listed in run.js); this folder.  No species file (ai.hound.js, ai.smiler.js, ai.skin*.js), no speed, turn rate, acceleration, collider,
clearance, smoothing, braking, feeler, stuck ladder, tier or traversal rule changes.

After the independent review (N2): the same hunk, narrowed (DESIGN_DECISIONS), and two test helpers for NC04's navigation chase
(`dev/tests/r19n_chase.js`, `dev/tests/r19n_child.js`: the chase, and the same chase run with the hunk taken back out in a child process);
the review's probe kept as `tools/fresh_seeds.js`.  Nothing else.
