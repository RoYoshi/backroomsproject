# Trial 3 cognitive predator refinement — regression report

Against R8 (`f378049`). Every run is kept in `evidence/` as it ran; a failure is compared by its **whole name** with R8's inherited list
(`dev/trial-3-predator-refinement/evidence/r0_inherited_failures.txt`). Older suites also have tests named C01–C08, C13, C15–C18 (the hound
and capture suites); names are compared whole, never by number.

## `npm test` (the whole suite)

| Build | Result | Failures |
|---|---|---|
| C5 with the dropped guard (`evidence/c5_npm_test_guard.txt`) | 248 / 261 | the 13 inherited, by name; none new, none fixed |
| C5 = C4's game (`evidence/c5_npm_test.txt`, `c5_npm_compare.txt`) | 250 / 263 | the 13 inherited; none new, none fixed |
| C7 fixed (`evidence/c7b_npm_test.txt`, `c7b_npm_compare.txt`) | 254 / 267 | the 13 inherited; none new, none fixed |
| **the final game code** (C7c; `evidence/c8_npm_test.txt`, `c8_npm_compare.txt`) | **255 / 268** | **the 13 inherited**; none new, none fixed |

The 13, unchanged since R8 (and before it): P01, P08, H07, NV09 (the Hound's perception and navigation), C1, C3, C4, C5, C9 / C10, C18
"memory eventually decays" (the Hound's chase suite), L9 (lifecycle), 2F F13, 2F F22 (shared 2F).

## The species suites (`s_skinstealer`, `s_skinbehave`, `s_skinpredator`, `s_skincognitive`)

| Checkpoint | Result | Added |
|---|---|---|
| R8 | 83 / 83 | — |
| C1 | 85 / 85 | C01, C04 |
| C2 | 90 / 90 | C02, C03, C08, C09, C13 (SK17, SK21, SK41, PR29 adapted - `CHANGED_FILES.md`) |
| C3 | 93 / 93 | C05, C06, C10 (PR20 adapted) |
| C4 | 94 / 94 | C12 (C02 judged on the runs where it went for them) |
| C5 | 101 / 101 | C07, C11, C14, C15, C16, C17, C18 |
| C7 | 105 / 105 | C19, C20, C21, C22 (the review's findings; each fails on the reviewed build) |
| C7c | **106 / 106** | C23 (the re-check's finding; fails on C7a's build and on R8) |

Every new scenario was run on R8 too (`evidence/c1_before_r8.txt` … `c7_before_fix.txt`): the ones that guard what R8 already did pass on R8
(C03, C05, C07, C09, C11, C20, C22), the others fail on R8 (C01, C02, C04, C06, C08, C10, C12, C13, C18, C19, C23), and C14, C16, C17 cannot
be compared (R8 has none of the plans and records they measure); C15 compares this tree with R8's commit (not run on R8), C21 does not
apply to R8 (no hunger draw: nobody is passed over).

## Other gates

| Run | Result |
|---|---|
| `npm run test:humanqa` (C5, C7b, C8) | 5 / 6 each; **X03 inherited** |
| P9 equivalence, six seeds × 120 s, no Skin-Stealer (`equiv_p9.js`: C5 ×2, C7b, C8) | **PASS** each time - 6 / 6 identical tick for tick (7200 snapshots) |
| the fast gate (C6b, C7b, C8) | **PASS, 21 / 21** each time; the full tier not run (no shared scope: C15, the scope step) |
| static checks (each checkpoint: build, parts, modules, facts, window contract, docs, API contract, scope) | all PASS |
| B1–B5's `behave_browser.js` (C6b, C7b, C8) | 9 / 9 each |
| R8's `predator_browser.js` | C6b 6 / 7 twice, C7b 6 / 7 (`pr_listened_then_looked` not exercised: `DEFERRED.md`); **the final code 7 / 7** (exercised: it stopped, listened and went to look); R8 7 / 7 |
| Trial 3's `skin_browser.js` | as a whole it crashed twice at C6b (different places); section by section 40 / 40 at C6b and C7b; R8 37 / 40 (t6, its own setup miss) |
