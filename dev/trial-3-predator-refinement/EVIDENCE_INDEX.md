# Trial 3 predator refinement — evidence index

Everything the documents cite, in `evidence/` unless named otherwise. Trial 3, B1–B5 and this refinement are **not owner-approved**.
Every run used the synthetic admin passcode `k3-synthetic-admin`; no real passcode, address or account appears. Node v22 in a 2-core
Linux container; Chromium headless with SwiftShader for the page checks. `rN_` names the checkpoint that produced a file.

## Baseline and reproduction (R0)

| File | What it shows |
|---|---|
| `../inventory/remote_heads_before.json` | every branch head on GitHub before the first push (the protected ones among them) |
| `r0_npm_test.txt`, `r0_inherited_failures.txt` | `npm test` on `4518f93`: 13 inherited P9 failures, by name |
| `r0_humanqa.txt` | `npm run test:humanqa` on `4518f93` (X03 inherited) |
| `r0_repro_baseline.json` / `.txt` | `tools/repro_r0.js` on `4518f93`: the owner's report measured (watched, the lost race, a search, a passer-by), 8 seeds per row |
| `r0_scale_before.json` / `.txt`, `r0_shots/` | `tools/scale_browser.js` on `4518f93`: its size against a Wanderer and a Hound on the page |

## Per checkpoint (R1–R5)

| File | What it shows |
|---|---|
| `r1`–`r5_suites.txt` | `node dev/tests/run.js s_skinstealer.js s_skinbehave.js s_skinpredator.js` at that checkpoint |
| `r1`–`r4_hound_smiler.txt` | `s_hound.js`, `s_smiler.js` (30 / 31; H07 inherited) |
| `r1`–`r4_repro.json` / `.txt` | `tools/repro_r0.js` after each behaviour checkpoint, the same rows and seeds as R0 |
| `r1`–`r5_checks.txt` | `build:check`, parts, modules, facts, window contract, docs, API contract, scope |
| `r4_thrash.json` / `.txt` | `tools/thrash_pr.js`: plan and act changes a minute, flickers under 0.3 s, A→B→A within 2 s, before / after the R4 fixes |
| `r5_lineup_before` / `after.json` / `.txt`, `r5_shots/lineup_*`, `doorway_*` | `tools/scale_lineup.js` on `4518f93` and after: one lit room, the same camera, a Wanderer, a Hound, the creature standing, creeping, winding up, and in a skin; a doorway and a wall |
| `r5_scale_after.json` / `.txt`, `r5_shots/scale_after_*` | `tools/scale_browser.js` after (compare `r0_scale_before.*`) |
| `r5_skin_browser_t5_before` / `after.txt`, `r5_shots/gallery_*` | Trial 3's `skin_browser.js` t5 (every act and death drawn) on `4518f93` and after |
| `r5_skin_browser_t1t4_after.txt`, `r5_skin_browser_t4_after_rerun.txt`, `r5_skin_browser_t4_before.txt`, `r5_shots/kill/` | Trial 3's kill checks after, a rerun, and on `4518f93` (the same intermittent t4 timing case in both trees) |

## Integration, parity, stress, cost (R6)

| File | What it shows |
|---|---|
| `r6_suites.txt` | the three Skin-Stealer suites: PR01–PR26, SK (34), BR (19) |
| `r6_npm_test.txt` | every suite (`npm test`): the same 13 inherited failures as `r0_npm_test.txt` |
| `r6_humanqa.txt` | `npm run test:humanqa` (X03 inherited) |
| `r6_equiv_p9.txt` | `dev/trial-3-skin-stealer/tools/equiv_p9.js` against P9 `1ff9374`: 6 seeds × 120 s tick for tick |
| `r6_perf.json` / `.txt` | `tools/perf_pr.js`: ten configurations × 3 rounds interleaved against `4518f93` |
| `r6_soak.json` / `.txt` | `tools/perf_pr.js --soak 600`: 600 s, four starving, eight players |
| `r6_gate.txt` | the fast release gate (`dev/tools/gate/gate.js --tier fast`) |
| `r6_checks.txt` | the static checks after R6 |
| `r6_predator_browser.json` / `.txt`, `r6_shots/` | `tools/predator_browser.js`: two real pages — footsteps heard behind a wall, a quiet second person, a sighting, the HUNT line, the snapshot's fields |
| `r6_skin_browser.*`, `r6_skin_browser_t6_rerun.*`, `r6_behave_browser.*` | Trial 3's browser check (every section, then t6 again) and B1–B5's on this branch; `r6_skin_browser_t6_base.txt`: a t6 run on `4518f93` that stopped on a closed page (no result) |

## Independent review and fixes (R7)

| File | What it shows |
|---|---|
| `r7_review.md` | the independent reviewer's report, verbatim (dispositions in `CHECKPOINTS.md` R7) |
| `r7_new_checks_on_r6_code.txt` | PR27–PR30 run against the R6 code: each fails there (the problems the review found) |
| `r7_suites.txt` | the three Skin-Stealer suites on R7's code: PR01–PR30, SK (34), BR (19) |
| `r7_hound_smiler.txt` | `s_hound.js`, `s_smiler.js` (H07 inherited) |
| `r7_repro.json` / `.txt` | `tools/repro_r0.js` on R7's code (the same rows and seeds as R0) |
| `r7_npm_test.txt`, `r7_humanqa.txt` | every suite; the Human QA suite (the same inherited failures) |
| `r7_equiv_p9.txt` | the P9 equivalence on R7's code |
| `r7_checks.txt`, `r7_gate.txt` | the static checks; the fast release gate on R7's code |
| `r7_perf_check.json` / `.txt` | `tools/perf_pr.js`, one round, against `4518f93` on R7's code (one configuration flagged; kept) |
| `r7_predator_browser.*`, `r7_shots/`, `r7_behave_browser.*` | the predator browser check and B1–B5's on R7's code |

## Remote and secrets

| File | What it shows |
|---|---|
| `remote/rN.json` | `tools/verify_remote_pr.py` after each push: local and GitHub SHA, tree, parent, the line from `4518f93`, every protected head and every other branch unchanged |
| `scans/rN_pre.txt`, `scans/rN_post.txt` | `dev/stage-3h-modernization/tools/secret_scan_m.py` over the branch's changes before each commit and on the pushed commit: CLEAN |

## Tools (`tools/`)

`repro_r0.js`, `scale_browser.js`, `scale_lineup.js`, `thrash_pr.js`, `perf_pr.js`, `predator_browser.js`, `verify_remote_pr.py` — each
file's header says how to run it and what it checks. The scenario suite is `dev/tests/s_skinpredator.js`.
