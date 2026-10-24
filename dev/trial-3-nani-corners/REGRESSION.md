# Trial 3 R19, N track - regression

Trial 3 is **not owner-approved**.  Environment: this session's machine (2 CPUs, Linux, node v22.22.2), the repository's own scripts,
`ADMIN_PASSCODE=<synthetic>` in the shell for each run.  Raw outputs: `evidence/N0/` (R18), `evidence/N1/`, `evidence/N2/` (this branch: `npm_test.txt`, `s_nanicorner.txt`, `fresh_seeds.txt`,
`corner_n2_summary.json`).

## The suites

| run | R18 01e5d97 | N (the code after the independent review, `N2-review` in CHANGELOG.md) |
|---|---|---|
| `npm test` (dev/tests/run.js) | 330/343 | **334/347** (+4: NC01-NC04) |
| failing | the 13 inherited P9 names: 2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09, P01, P08 | **the same 13 names**, none new |
| `s_humanqa_hotfix.js` | 5/6 (X03) | 5/6 (X03) |
| Hound / Smiler / navigation suites (s_hound, s_smiler, s_nav, s_chase, s_hound2e, s_shared2f, s_percept, s_capture ...) | green but the inherited | green but the inherited (the same) |
| every Skin-Stealer suite | green | green |
| `npm run build:check`, `dev/tools/checks/parts.js` | PASS | PASS |
| after the second review's comment correction (no code change): the four suites that read the hunk's text - s_nanicorner, s_skinpredator (PR25), s_wandererlock (WL05), s_skinmind (C15) | - | 55/55 (`evidence/N2/locks_after_comment_fix.txt`) |

## The locks taught exactly the hunk (not loosened)

- PR25 (s_skinpredator.js): ai.entity.js must equal 4518f93's **with exactly the hunk of `dev/tests/r19n_patch.js` applied** (every other
  shared file still byte for byte); PASS.
- WL05 (s_wandererlock.js): the same against R8 (f378049); PASS ("ai.entity.js with R19 N's 1 cornering hunk").
- C15 (s_skinmind.js): a child process runs this tree with the hunk taken back out (`dev/tests/r19n_c15.js`) - every one of R8's 90
  snapshot hashes identical; as built, 0/0/0 seconds differ in those three 30 s worlds (the hunk did not fire there).
- The locks still bite (checked after the second review, in a scratch worktree of `451f1d6` with one character of the hunk changed -
  `26 + e.speed * .12` to `27 + ...` - and rebuilt): PR25, WL05, C15 and NC01-NC04 all FAIL.
- `r19n_patch.js` checks itself: applied to R8's ai.entity.js it gives this tree's byte for byte, and taken out of this tree's (and of the
  built ai.js) it gives R8's.

## The new suite, `dev/tests/s_nanicorner.js` (N-scenario mapping)

Each check runs this tree's `plan()`/`follow()` and, on the same 30 seeded routes, the built ai.js with the hunk taken back out (R18's
follower exactly) - before and after in one run.

| test | pack IDs | result |
|---|---|---|
| NC01 the stop at a bend | N01, N03, N04, N10 | PASS: Hound 292 px/s slow 1.03 -> 0.55 s, pivoting 0.37 -> 0.03 s, aim jumps 9 -> 1, total time 270.33 -> 269.18 s, no route slower, stop-pivot-go eased 2/2 (6 waypoints passed); Smiler 255 unchanged (0 passed); Skin-Stealer 270 slow 0.27 -> 0, pivoting 0.07 -> 0, aim jumps 7 -> 5 (2 passed); the most off its route at speed Hound 50.4 = 50.4 px (still the widest), Smiler 42 = 42, Skin-Stealer 39 = 39; fastest turns 3.01 / 2.69 / 2.94 rad/s, each within its own rate |
| NC02 collision | N02, N05, N06 | PASS: 0 ticks inside anything solid (least clearance 0.28 px); contacts Hound 39 -> 38, Smiler 73 = 73, Skin-Stealer 40 = 40; bonks, stuck, side-steps 0 = 0; arrivals equal (118, 176, 180) |
| NC03 traversal | N07 | PASS: Hound (292 and 92 px/s) and Smiler (255 and 80) routes through vault links and crawl cells (31 runs): the same traversals and modes as R18, no link or crawl waypoint dropped.  It holds by construction - such waypoints, and the one after the next, are excluded from the hunk - and checks exactly that |
| NC04 the real engine | N08, N09, N15, N17 | PASS: 120 s of two Hounds, a Smiler and a Skin-Stealer among four players, near/mid/far: 28,800 creature-ticks, none inside anything, no jump over its top speed, every number finite, routes at most 10 waypoints (the hunk did not fire there: 0 drops).  Added after the review, where it does fire: Hounds sent after runners by the admin's navigation command (4 seeds x 60 s, `dev/tests/r19n_chase.js`), against the same chase with the hunk taken back out in a child process (`r19n_child.js`): waypoints passed 0 -> 2 (thin, as the second review noted - non-vacuous: it fails with none), inside anything 0 = 0, jumps over its top speed 1 = 1 (R18's own: seed 3 at 21.85 s, an 11.7 px push; none new), stuck re-routes 1 = 1, contacts 121 -> 116 |

The before is in each check (R18's follower measured on the same routes in the same run); the locks (PR25, WL05, C15) fail on any other
change to ai.entity.js.

Remaining IDs: N11 the Smiler (its code and species byte for byte R8's - WL05, PR25; its suites green); N12/N13/N14 the Skin-Stealer
(its covert way and footwork do not use `follow()`; every Skin suite green; C27 lawful bodies); N16 server position vs drawn heading
(the page draws the server's heading; `BROWSER_AND_MEDIA.md`); N18 the Wanderer (WL01-WL06 green).

## The independent review's probe, kept (`tools/fresh_seeds.js`, `evidence/N2/fresh_seeds.txt`)

R18's follower and this tree's on 2,000 fresh runs (seeds 11, 29, 41, 53, 67; 40 routes each; Hound 292 and 92, Smiler 255, Skin-Stealer
270 and 205 px/s; from rest and from speed):

| species, pace | runs | with a drop | drops (outside the bend) | contacts | slides | feeler brakes | time (s) |
|---|---|---|---|---|---|---|---|
| Hound 292 | 400 | 25 | 26 (0) | 130 = 130 | 2120 -> 2103 | 261 -> 233 | 1834.23 -> 1830.67 |
| Hound 92 | 400 | 0 | 0 | 76 = 76 | 6042 = 6042 | 0 = 0 | 5441.42 = 5441.42 |
| Smiler 255 | 400 | 6 | 6 (0) | 246 = 246 | 2310 -> 2313 | 29 -> 18 | 2056.28 -> 2055.55 |
| Skin-Stealer 270 | 400 | 4 | 4 (0) | 190 = 190 | 2282 -> 2284 | 49 = 49 | 1946.03 -> 1945.70 |
| Skin-Stealer 205 | 400 | 3 | 3 (0) | 81 = 81 | 2720 -> 2722 | 0 = 0 | 2495.05 -> 2494.93 |

Bonks, stuck recoveries, off-route re-plans: 0 = 0 everywhere.  Every run without a drop is identical to R18's.  No run with a drop got
worse on any measure (contacts, bonks, stuck, slides over 5, off-route, time, arrival).  Least clearance among runs with a drop: **0.16 px**
(seed 29, route 11, Hound from speed; R18 1.16 px there) - never inside; Hound runs with a drop 8 tighter, 8 wider.

The seed-7 audit (`tools/corner_audit.js`, `evidence/N2/corner_n2_summary.json`, against R18 with the same tool): 624 of 640 runs identical
tick for tick, 16 changed, every one with a drop and none worse (time, contacts, clearance).  Hound chase slow 0.81 -> 0.39 s, pivoting
0.40 -> 0.12 s, aim jumps 4 -> 0 (from speed 1.12 -> 0.79, 0.44 -> 0.25, 4 -> 0); Smiler chase slow 0.31 -> 0.05 s, aim jumps 6 -> 3;
Skin-Stealer run slow 0.27 -> 0.13 s, prowl 0.05 -> 0; slides Hound chase 254 -> 261 (+7, from speed +8), Smiler chase +7/+8,
Skin-Stealer +1..+3; contacts, bonks, stuck, re-plans, least clearance, the widest line: unchanged.

## Changed measurements inside passing tests (R18 -> N; every one read)

- NV05 (a hunting Hound against somebody running laps round a pillar): median catch 4.5 -> 5.2 s.  One run of 10 differs (island 1,
  clockwise: 2.7 -> 7.4 s): the hunk fired once at 0.9 s, the chase took another course and the Hound's lunge at 4.4 s missed; the other 9
  are identical tick for tick.  Over every island (26 runs) the same single run differs (median 3.85 -> 4.53 s because of it, p90 9.32 =
  9.32).  Recorded here, not hidden; the test (caught at least 85 % within 60 s) passes on both.
- C15 now also reports the as-built difference (0/0/0); PR25 and WL05 name the hunk.
- Y02, NV12, X09, P01 (timings): this machine, other jobs running beside the suite; see `PERFORMANCE.md` for the controlled comparison.

## The Skin-Stealer's ordinary play on this tree (the S track's simulation)

The S track's `prechase_sim.js` (on the S branch, `dev/trial-3-r19-positioning/tools/`; `--mins 180 --seeds 12 --log 1`, run with
`--dir` on this tree): 3 x 36 h of one Skin-Stealer among two people.  Every measure equal to R18's, every run equal (only the wall-clock
time differs): the hunk never fired for the Skin-Stealer there (its open approach and chase mostly go straight at a person it sees, not
round a bend of a route at speed).  `evidence/N2/sims_n_vs_r18.json`, the logs `sims_N_*.log` (their `STALE` lines are R18's own late
vault landings, the same 22 as R18's; the S track carries the vault through).

## Never weaker: game outcomes against R18 (the owner's addendum of October 23)

The owner: smoother cornering must never weaken a monster - pursuit, corner speed, attack and lunge opportunities, acceleration and
each species' character preserved or improved; measured by gameplay outcomes on identical seeded scenes, not movement constants.  The
tool: `tools/pursuit_outcomes.js` (run on each tree with `--dir`; the tree's own server simulation - real AI, perception, stamina,
attacks; only the people are moved, as players are); `tools/pursuit_compare.py` pairs two trees run by run; `tools/pursuit_chaos.py`
adds the control.  Scenes per species (Hound, Skin-Stealer at .9, Smiler in a blackout after a lit runner):
- **corner pursuits** - a runner sent through rooms and doorways along 60 seeded routes (and on along others), the creature hunting it
  from just behind: with real stamina, with endless stamina (the pure race round the bends), and starting farther back so the runner is
  round the first bends out of its sight (it follows its route at speed - where the change can act), 40 s each;
- **attacks round obstacles** - the runner lapping each of 13 wall islands both ways, the creature across the island (156 laps: six
  seeds; and 234 more: nine starting places on the far side);
- **sustained chases** - 60 s from route to route, real stamina.

`--n 60 --loopSeeds 6` (`evidence/N2/outcomes/po_*.json`, `cmp_N.md`), 348 paired runs per species:

| species | runs | caught (R18 -> N) | attacks begun | runs that differ at all | waypoints the change dropped |
|---|---|---|---|---|---|
| Hound | 348 | 345 -> 345 | 174 -> 174 | 2 (both **sooner**: a lap caught 0.11 / 0.13 s earlier) | 2 |
| Skin-Stealer | 348 | 304 -> 304 | 367 -> 367 | 0 | 0 |
| Smiler | 348 | 323 -> 323 | 306 -> 306 | 6 (4 sooner by 0.05-0.11 s; the same lap scene, twice, 10.9 s later) | 6 |

The lap study with its control (`--scenes loop --loopStarts 9`, and the same with every creature started 1 px off; `laps_chaos_N.md`),
234 laps per species:

| | Hound | Skin-Stealer | Smiler |
|---|---|---|---|
| R18 -> N: laps that differ, mean change where they differ, largest | 0 | 1, +10.9 s, 10.9 s | 9 (6 sooner, 3 later), -1.24 s, 11.8 s |
| **control** - R18 -> R18 with the creature 1 px off: laps that differ, mean, largest | 67 (32 sooner, 35 later), +0.10 s, 14.2 s | 47 (23 / 24), +0.51 s, 34.9 s | 46 (16 / 30), -0.36 s, 11.7 s |
| caught | 234 = 234 | 234 = 234 | 234 = 234 |
| attacks begun | 123 = 123 | 285 -> 286 | 231 = 231 |

What it shows:
- In real chases the change rarely acts at all: a pursuer that sees its quarry steers straight at it, not round a route's corners; it
  acted in 0 of 360 Hound and Skin-Stealer corner pursuits (2 of 180 for the Smiler) and in 19 of 1,170 laps over all species.
- Where it acted, the outcome moved both ways: mostly a little sooner (by 0.05-0.13 s - the stop at the bend gone), twice much later
  (one lap scene, Smiler and Skin-Stealer, ~11 s; and NV05's Hound lap, 2.7 -> 7.4 s).  Those large changes are the lap chase's own
  sensitivity, not a weaker creature: starting the creature **1 px** off, with no code change at all, changes 160 of 702 laps, by up to 35
  s, in both directions.  Catches and attacks begun are equal.  The mean time to a catch moves by as much as the control moves it: the 1 px control shifts
  the lap means by -0.07 to +0.11 s; N shifts them by 0 (Hound), +0.05 s (Skin-Stealer, its one lap) and +0.14 / -0.05 s (Smiler, over
  156 / 234 laps; +0.03 s over all 390) - each driven by the one lap scene above.
- No species got slower, more hesitant or less able to attack: no speed, acceleration, turn rate, braking, lunge, strike, reach,
  detection or tracking was touched (the hunk only stops the aim turning back for a waypoint already passed); the seed-7 audit and the
  fresh seeds show its routed cornering quicker (Hound chase slow 0.81 -> 0.39 s, pivots 0.40 -> 0.12 s), and the real-page corner runs
  keep a Hound at 160+ px/s through two bends where R18's stopped to 29-58 px/s.
- Decision: kept for every species.  Had a species shown a systematic loss beyond the control, it would have kept R18's follower (the
  owner's rule); none did.  The owner's own play remains the judge (HUMAN_QA: "does any monster feel weaker or more hesitant?").
