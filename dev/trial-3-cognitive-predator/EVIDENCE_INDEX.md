# Trial 3 cognitive predator refinement — evidence index

Everything the documents cite, in `dev/trial-3-cognitive-predator/evidence/`, kept as it ran (red runs and faulty passes included; only
absolute machine paths replaced and trailing spaces trimmed). Each line: what it is, the tool and command, the build. R8 = `git archive
f378049`. "Suites" = `node dev/tests/run.js s_skinstealer.js s_skinbehave.js s_skinpredator.js s_skincognitive.js`.

## C0 — R8 before anything changed

* `c0_audit_r8.json` / `.txt` — `tools/c0_audit.js --seeds 1,2,3,4,5,6` on R8: the owner's scenes (watched, crossing runner, circling,
  two people, lure, straight race, watcher + walker, fork, passer-by, circles round it), orient / choice / move latencies, idle while seen,
  plans with R8's reasons, kills.
* `c0_browser_r8.json` / `.txt`, `c0_shots/` — `tools/cog_browser.js` on R8: watched, crowd, circle in real pages (two setup misses kept).
* `../OWNER_FAILURE_REPRO.md`, `../AUDIT.md` — the diagnosis; R8's decision scores at the quoted moments.

## C1–C4 — each wave

* `cN_suites.txt` — the suites on that checkpoint's build (C1 85, C2 90, C3 93, C4 94: all PASS).
* `cN_before_r8.txt` — that wave's new scenarios on R8 (`ONLY=` on the same scenario file, R8's build).
* `cN_audit.json` / `.txt` — `tools/c0_audit.js` on that build, the same scenes and seeds as C0.
* `cN_checks.txt` — the static checks (build, parts, modules, facts, window contract, docs, API contract, scope).
* `c1_browser.*`, `c2_browser.*`, `c3_browser.*`, `c3_circle.*`, `cN_shots/` — `tools/cog_browser.js` on that build.

## C5 — multiplayer, fairness, regression (no game change)

* `c5_suites.txt` (101 / 101), `c5_npm_test.txt` + `c5_npm_compare.txt` (250 / 263, the 13 inherited by name), `c5_humanqa.txt` (X03),
  `c5_equiv_p9.txt` (PASS 6 / 6), `c5_checks.txt`, `c5_before_r8.txt` (C07–C18 on R8).
* `c5_guard.patch` and `c5_*_guard.*` — the dropped guard (`skRanOff`) and every run made with it; `c5_sprint_diag.txt` —
  `tools/c5_sprint_diag.js` on this build, with the guard and on R8 (40 sprint-away runs: no lead shrank; the same creature with and
  without the guard).

## C6 — real pages, performance, the gate

* `c6_browser.json` / `.txt`, `c6_browser_r8.*` — `tools/c6_browser.js --tries 3` final pass, this build and R8; `c6_shots/` (JPEG);
  `c6_browser_v1*`, `c6_browser_v2*` — the two earlier, faulty passes (pages stuck on walls), kept; `c6_browser_summary.txt` —
  `tools/c6_summary.py`, one line per try of every pass.
* `c6_perf.*`, `c6_perf_run2.*` — `perf_pr.js --base <R8> --rounds 3 --secs 60`, twice; `c6_soak.*` — `--soak 600`.
* `c6_gate.txt` — `gate.js --tier fast`, 21 / 21.
* `c6_behave_browser.*` (B1–B5, 9 / 9), `c6_predator_browser*.*` (this build twice, R8 once), `c6_skin_browser_full_run*.txt` (Trial 3's tool
  as a whole: two crashes), `c6_skin_browser/` (section by section, this build and R8).

## C7 — the independent review and the fixed build

* `c7_review.md` — the reviewer's report, verbatim; `c7_review/` — its 13 experiments (`exp_*.js`), their outputs as it ran them (`out/`)
  and on the fixed build (`out_after_fix/`).
* `c7_before_fix.txt` — C19–C22 on the reviewed build (each fails) and on R8; `c7_suites.txt` — the suites on the fixed build (105 / 105);
  `c7_audit.*`; `c7_checks.txt`.
* `c7b_npm_test.txt` + `c7b_npm_compare.txt` (254 / 267, the 13 inherited), `c7b_humanqa.txt`, `c7b_equiv_p9.txt`, `c7b_gate.txt` (21 / 21).
* `c7b_browser_p1.*`, `c7b_browser_p2.*`, `c7b_shots/` — two real-page passes on the fixed build; `c7b_browser_pool.txt` —
  `tools/c7_pool.py`, every pass of every build pooled per scene with n.
* `c7b_behave_browser.*`, `c7b_predator_browser.*`, `c7b_skin_browser/` — the earlier browser checks on the fixed build.
* `c7b_perf.*`, `c7b_perf_run2.*`, `c7b_soak.*` — performance against R8, twice, and the soak.

## C7c — the review's re-check, and C8 — the final code re-run

* `c7_recheck.md` — the reviewer's re-check, verbatim; its probes `c7_review/exp_bold3.js`, `exp_pairs.js`, `exp_stare3–5.js`, outputs as it
  ran them (`c7_review/out2/`) and on the fix (`c7_review/out2_after_fix/`).
* `c7c_c23.txt` — C23 on the final code (PASS), on C7a's build and on R8 (both FAIL); `c7c_suites.txt` (106 / 106), `c7c_audit.*`,
  `c7c_checks.txt`.
* `c8_npm_test.txt` + `c8_npm_compare.txt` (255 / 268, the 13 inherited), `c8_humanqa.txt`, `c8_equiv_p9.txt`, `c8_gate.txt` (21 / 21),
  `c8_behave_browser.*` (9 / 9), `c8_predator_browser.*` (7 / 7), `c8_perf.*`, `c8_soak.*` — all on the final game code.
* `c8_browser.*`, `c8_shots/` — one real-page pass on the final code; `c8_browser_pool.txt` — every pass of every build pooled per scene.

## Receipts

* `remote/cN.json` — `tools/verify_remote_cp.py`: each push read back from GitHub (SHA, tree, parent, one line from `f378049`, every
  protected ref and every other branch unchanged, no new branch). `scans/cN_pre.txt`, `scans/cN_post.txt` — the secret scan before the
  commit and after the push (each CLEAN).
* `../inventory/remote_heads_before.json` — every remote head before the first push.
