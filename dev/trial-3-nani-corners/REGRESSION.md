# Trial 3 R19, N track - regression

Trial 3 is **not owner-approved**.  Environment: this session's machine (2 CPUs, Linux, node v22.22.2), the repository's own scripts,
`ADMIN_PASSCODE=<synthetic>` in the shell for each run.  Raw outputs: `evidence/N0/` (R18), `evidence/N1/`, `evidence/N2/` (this branch).

## The suites

| run | R18 01e5d97 | N (94592b0, the N1 code) |
|---|---|---|
| `npm test` (dev/tests/run.js) | 330/343 | **334/347** (+4: NC01-NC04) |
| failing | the 13 inherited P9 names: 2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09, P01, P08 | **the same 13 names**, none new |
| `s_humanqa_hotfix.js` | 5/6 (X03) | 5/6 (X03) |
| Hound / Smiler / navigation suites (s_hound, s_smiler, s_nav, s_chase, s_hound2e, s_shared2f, s_percept, s_capture ...) | green but the inherited | green but the inherited (the same) |
| every Skin-Stealer suite | green | green |
| `npm run build:check`, `dev/tools/checks/parts.js` | PASS | PASS |

## The locks taught exactly the hunk (not loosened)

- PR25 (s_skinpredator.js): ai.entity.js must equal 4518f93's **with exactly the hunk of `dev/tests/r19n_patch.js` applied** (every other
  shared file still byte for byte); PASS.
- WL05 (s_wandererlock.js): the same against R8 (f378049); PASS ("ai.entity.js with R19 N's 1 cornering hunk").
- C15 (s_skinmind.js): a child process runs this tree with the hunk taken back out (`dev/tests/r19n_c15.js`) - every one of R8's 90
  snapshot hashes identical; as built, 0/0/0 seconds differ in those three 30 s worlds (the hunk did not fire there).
- `r19n_patch.js` checks itself: applied to R8's ai.entity.js it gives this tree's byte for byte, and taken out of this tree's (and of the
  built ai.js) it gives R8's.

## The new suite, `dev/tests/s_nanicorner.js` (N-scenario mapping)

Each check runs this tree's `plan()`/`follow()` and, on the same 30 seeded routes, the built ai.js with the hunk taken back out (R18's
follower exactly) - before and after in one run.

| test | pack IDs | result |
|---|---|---|
| NC01 the stop at a bend | N01, N03, N04, N10 | PASS: Hound 292 px/s slow 1.03 -> 0.55 s, pivoting 0.37 -> 0.03 s, aim jumps 9 -> 1, total time 270.3 -> 269.2 s, no route slower, stop-pivot-go eased 2/2; Smiler 255 unchanged; Skin-Stealer 270 slow 0.27 -> 0, pivoting 0.07 -> 0; widest line Hound 50.4 = 50.4 px (still the widest); fastest turns within each species' rate |
| NC02 collision | N02, N05, N06 | PASS: 0 ticks inside anything solid (least clearance 0.28 px); contacts Hound 39 -> 38, Smiler 73 = 73, Skin-Stealer 40 = 40; bonks, stuck, side-steps 0 = 0; arrivals equal |
| NC03 traversal | N07 | PASS: Hound and Smiler routes through vault links and crawl cells (31 runs): the same traversals and modes as R18, no link or crawl waypoint dropped |
| NC04 the real engine 120 s, near/mid/far | N08, N09, N15, N17 | PASS: 28,800 creature-ticks over the three tiers, none inside anything, no jump over its top speed, every number finite, routes at most 10 waypoints |

Remaining IDs: N11 the Smiler (its code and species byte for byte R8's - WL05, PR25; its suites green); N12/N13/N14 the Skin-Stealer
(its covert way and footwork do not use `follow()`; every Skin suite green; C27 lawful bodies); N16 server position vs drawn heading
(the page draws the server's heading; `BROWSER_AND_MEDIA.md`); N18 the Wanderer (WL01-WL06 green).

## Changed measurements inside passing tests (R18 -> N; every one read)

- NV05 (a hunting Hound against somebody running laps round a pillar): median catch 4.5 -> 5.2 s.  One run of 10 differs (island 1,
  clockwise: 2.7 -> 7.4 s): the hunk fired once at 0.9 s, the chase took another course and the Hound's lunge at 4.4 s missed; the other 9
  are identical tick for tick.  Over every island (26 runs) the same single run differs (median 3.85 -> 4.53 s because of it, p90 9.32 =
  9.32).  Recorded here, not hidden; the test (caught at least 85 % within 60 s) passes on both.
- C15 now also reports the as-built difference (0/0/0); PR25 and WL05 name the hunk.
- Y02, NV12, X09, P01 (timings): this machine, other jobs running beside the suite; see `PERFORMANCE.md` for the controlled comparison.
