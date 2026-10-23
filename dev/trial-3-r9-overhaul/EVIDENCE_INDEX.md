# Trial 3 R9–R17 — evidence index

**Not owner-approved.** Everything below is under `dev/trial-3-r9-overhaul/evidence/` unless a path says otherwise. Every passcode in
it is synthetic; local paths are replaced by `<repo>`, `<tmp>` and `<home>`. Each checkpoint folder also holds that commit's remote
receipt (`receipt_*.json`, read back from GitHub) and its secret scans before and after the push (`secret_scan_*_pre.txt`, `_post.txt`).

| Folder | Checkpoint | What is in it |
|---|---|---|
| `r9/` | R9 audit of R8 | `repro_r8.txt` and `repro_r8_traces.json.gz` (the owner's exposed ambush, deterministic); `r9_01_on_r8.txt` (the reproducer failing on R8); `npm_test_r8.txt`, `inherited_failures_r8.txt`, `humanqa_r8.txt`, `buildcheck_r8.txt`; R8's Skin-Stealer suites; `perf_aa_r8.*` (R8 against itself: the noise floor); `diag_route_r8.*`; `browser/` (R8's flankwatch on a real page: video, contact sheet; audio); `gallery/` (R8's poses and deaths) |
| `r10/` | sight-only warning | the suites; `browser/` (the warning on two pages, R8 and R10: `sight_r8.*`, `sight_r10.*`, video) |
| `r11/` | its mind | the suites, `trace_r11.txt`, `perf_*` (R8 against R11, both orders) |
| `r12/` | its inference | the suites, `trace_r12.txt`, `perf_*` (3 and 5 rounds, both orders) |
| `r13/` | its cover | `tests/` (every suite, `npm test`, the R11/R12 traces again), `perf/` (before and after the search fix), `browser/` (flankwatch on a real page: shots, video, sheet) |
| `r14/` | its body from above | `gallery/` (every pose), R8 against R14 sheets, `deaths_r14_*.jpg`, `places_*`, `edge_*` (the view's edge), `draw_cost_r14.txt`, `tests/` |
| `r15/` | Execution D | `tests/`, `browser/` (the Rend: victim video and frames, spectator, the server's fallback, deaths A–D) |
| `r16/` | regression, adversarial QA, review | `review/REVIEW_FINDINGS.md` and its scripts; `tests/` (R16b's suites, `npm test`, the suites on R8 for comparison); `browser/` (sight, flankwatch, the Rend and its stress, deaths, `predator_browser`, `skin_browser` with its failed and repeated tries kept) |
| `r16c/` | the October 22 refinement audited | `repro_r8.*`, `repro_r16b.*` (`tools/repro_ap.js`: the same results) |
| `r16d/` | interruption, hunger | `repro_r16d.*`; every suite; `npm test`; Human QA hotfix |
| `r16e/` | its eyes | `repro_r16e.*`, `repro_r16d_P.*` (the periphery probe on R16d); `range/` (the suites at 950 and 1100 px); every suite |
| `r16f/` | its footwork | `repro_r16f.*`; `slip_r16e.txt`, `slip_r16f.txt` (the slip-past probe); `npm test`; Human QA hotfix |
| `r16g/` | the real-page campaign, the review's fixes | `browser/`: the focused scenes (`focused_r16g.*`, video, sheet, `r16g_F*.jpg`), the continuous campaign (`continuous_r16g.*`, `continuous_r16g_events.txt`, the 12-minute video, sheets every minute for each page, the two superseded runs), the earlier scenes again (`sight_r16g_try1..5`, `flankwatch_r16g.*` and sheet, `rend_r16g.*`, `predator_browser_r16g.*`); `tests/`: every Skin-Stealer suite, `npm test`, `fails.txt`, Human QA, `passer_r16d_on_r16g.txt`; `repro_r16g.*` (the October 22 probes) |
| `r16h/` | the full gate's findings fixed | `gate/` (the first group on R16g with its three failures, the three steps on R8, R10 and R11, the fixed steps); `tests/` (`s_skinsight`, `npm test`, Human QA); `browser/` (the sight scene, three runs) |
| `r16i/` | the Wanderer's movement locked; the press | `tests/` (every Skin-Stealer suite and `s_wandererlock`, `npm test`, `fails.txt`, Human QA); `press/` (`tools/press_eval.js` on R16h and at 230, 238 and 245); `wandererlock_on_r8.txt`, `wandererlock_on_r16h.txt` (the lock suite on R8's and R16h's trees); `pr28_unbounded_on_r16i.txt`, `pr28_bounded_on_r16h.txt` (PR28 before and after its change, R16i-5); `repro_r16i.*` (the October 22 probes) |
| `r17/` | performance, the full gate, the campaign on the final tree, the final receipt | `perf/` (R8 against R16i in both orders, the extra counts; R16g's runs kept); `gate/` (the full gate's report in groups on R16i; on R16h its first two groups, the partial third, `bpp_checks`' reruns; the voice-chat check's four parts); `browser/` (on R16i: the focused scenes with F6's reruns - and F6 on R16h - the continuous campaign with its first and corrected verdicts, raw record, event log, video and sheets, R16h's campaign of the same session for comparison, `predator_browser`, the watched hall); the final receipt |

Elsewhere: `fixtures/` (R8's files the tests compare against: `dphys.f378049.js`, `mp.frame.f378049.js`, C15's snapshot hashes);
`inventory/remote_heads_before.json` (every remote head before the first push, for the receipts' "every other branch unchanged").
The tools that made them are in `tools/`, each with its use in its header; none is loaded by the game.
