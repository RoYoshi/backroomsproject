# Trial 3 predator refinement — regression report

Trial 3, B1–B5 and this refinement are **not owner-approved**. Every result below was run on this branch and its output is in
`evidence/` (`EVIDENCE_INDEX.md`). R7 (the independent review's fixes) changed the species again, so the suites, `npm test`, the P9
equivalence, the fast gate, a one-round performance check and two browser checks were run again on R7's code (`r7_*`); the R6 runs are
kept beside them. Nothing was skipped or weakened silently: each changed assertion is listed at the end with its reason.

## Suites

| Run | Result | Evidence |
|---|---|---|
| `npm test` (every suite) | R7: 232 / 245 (R6: 228 / 241) — the 13 failures are the inherited P9 ones, name for name as at R0 (P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22); every Skin-Stealer scenario passes | `r7_npm_test.txt`, `r6_npm_test.txt`, `r0_inherited_failures.txt` |
| `npm run test:humanqa` | 5 / 6 at R6 and R7; X03 as on P9 and at R0 | `r7_humanqa.txt`, `r6_humanqa.txt`, `r0_humanqa.txt` |
| `s_skinpredator.js` (new, PR01–PR30) | R7: 30 / 30 (R6: 26 / 26; PR27–PR30 are R7's, and fail on the R6 code: `r7_new_checks_on_r6_code.txt`) | `r7_suites.txt`, `r6_suites.txt` |
| `s_skinstealer.js` (Trial 3, SK) | 34 / 34 | `r7_suites.txt` |
| `s_skinbehave.js` (B1–B5, BR) | 19 / 19 | `r7_suites.txt` |
| `s_hound.js`, `s_smiler.js` | 30 / 31 at every checkpoint; H07 inherited | `r1`–`r4_hound_smiler.txt`, `r7_hound_smiler.txt` |
| P9 equivalence (`dev/trial-3-skin-stealer/tools/equiv_p9.js` against `pre-trial3-final-polish` `1ff9374`) | R6 and R7: 6 / 6 seeds identical tick for tick, 120 s each (7200 snapshots: every Hound and Smiler, every player, kills, bodies), speech handed to the engine with no Skin-Stealer changing nothing | `r7_equiv_p9.txt`, `r6_equiv_p9.txt` |
| PR25 (in-tree) | the shared engine and the Hound's and the Smiler's code byte for byte the starting commit's; with no Skin-Stealer its tick never runs | `r7_suites.txt` |
| static checks: `build:check` (44 outputs), parts, modules, facts, window contract, docs, API contract, scope | PASS at every checkpoint | `r1`–`r7_checks.txt` |
| the fast gate (`dev/tools/gate/gate.js --tier fast`, the v11 packages) | **PASS** at R6 and at R7, 21 / 21 steps (build, port, lineage, parts, modules, contracts, docs, scope, the server's and B++'s goldens, session, sim, page, the client's golden, protocol, mutants, static, raw live, quick suites, bundle, chat). The full tier (about three hours; real-time and browser suites across the whole game) was **not** run: pack 09 keeps it for new shared scope, and this branch changes no shared code (PR25) — the Skin-Stealer's own browser checks below were run instead | `r7_gate.txt`, `r6_gate.txt` |

## Browser

| Run | Result | Evidence |
|---|---|---|
| `tools/predator_browser.js` (two real pages: footsteps heard behind a wall, a quiet second person, then a sighting) | R6 and R7 **7 / 7**: hearing the noisy page run behind a wall it stopped and listened, then went quietly to look — about nobody (no plan or hunt named anybody before it had seen them); it found and saw them and hunted them; the quiet, crouched page was never in a plan or a hunt; the HUNT line drawn; its snapshot entries only `a, ac, dg, h, i, s, v, x, y`; no page error. Six development runs came before it while the scene and the check were corrected (a fresh creature per attempt and for the sighting, walled corners, a sighting read from its own records including its decisions, which it makes only about somebody it sees, rather than a 1.5 s window); in the runs that recorded sightings, every name followed one; in some the creature came round and saw the noisy page before it heard it (an earned name; the listen then not exercised) | `r7_predator_browser.*`, `r6_predator_browser.*`, `r6_shots/r6_hunt_overlay_640.png` |
| Trial 3's `skin_browser.js` (all sections) | **37 / 40**, then t6 again **6 / 6**. The three: `t4_victim_frame_is_the_corpse` — the intermittent timing case seen on `4518f93` too (R5); `t6_entity_line` and `t6_disguise_drawn` — one setup miss: after the meal the creature stood near the level's north edge facing the wall, and the scene found no open floor in its view to put the listener (`lAt2` null), so it never saw them and roamed off; nothing in the scene checks that placement. Run again, the listener was placed 380 px in its view and the disguised creature walked up and repeated the line as an entity (`e10`); t7 (the same disguise and speech, with the world's Hounds and Smilers) passed in the full run. A t6 run on `4518f93` for comparison gave no result: the tool stopped on a closed page (`r6_skin_browser_t6_base.txt`) | `r6_skin_browser.*`, `r6_skin_browser_t6_rerun.*`, `r6_skin_browser_t6_base.txt` |
| B1–B5's `behave_browser.js` | R6 and R7 **9 / 9**: moved by the page's keys, noticed, warned on the wire, its defence decided, the strike's tell shown, the death its own, the overlay lines, the prey died by it, no page error | `r7_behave_browser.*`, `r6_behave_browser.*` |
| `tools/scale_lineup.js`, `scale_browser.js` (R5) | the size before / after, a doorway, a wall, a skin | `r5_lineup_*`, `r5_scale_after.*`, `r5_shots/` |

## Changed assertions (owner-authorised behaviour)

| Scenario | Checkpoint | Change | Reason |
|---|---|---|---|
| SK08 | R1 | STALKING 3 s after an admin clear allowed when it is its own new approach, flank or interception | a hungry one sees the same person again and hunts them; the clear itself still drops the old record and plan |
| SK16 | R3 | a watcher is never taken while hunger is under .6; a later kill reported | hunger rises .55 → .8 over its 150 s; a very hungry one is not kept off by being watched |
| SK21 | R1, R2, R3 | after a failed bait it may go on hunting; stillness over its first wait; 24 seeds, the waits judged | a failed tactic is not the end of a very hungry one's hunt; it more often flanks than baits |
| SK22 | R1 | the gap never closes while the fresh runner runs, over its 14 s (was: 1500 px apart after 14 s); PR27 (R7) runs on until the runner is winded and walking | the 1500 px measured the old departure; the fairness it protected is asserted directly |
| SK24 | R2 | a roaming listen may come before the search | listen-before-moving (pack 04) |
| SK31 | R1 | no kill while the person still runs; a later kill reported | the hunt outlives the miss; speed is still never the reason |
| SK41 | R1 | judged on runs where it lay in wait | lying in wait is one of its answers |
| BR14 C | R1 | a lost race is not a departure but no new chase for 10 s, never faster than its free pace (a vault excluded) | the lost race no longer ends a hungry one's hunt |

PR08, PR10, PR17 were measured more precisely at R4 (no contract change; `CHECKPOINTS.md` R4).
At R7 (the independent review) the titles of SK16, SK31 and PR05 were reworded to say what they check (no assertion changed); SK22's
comment points to PR27, which runs the race on until the runner is winded; PR24 now counts every route the creature searches.
