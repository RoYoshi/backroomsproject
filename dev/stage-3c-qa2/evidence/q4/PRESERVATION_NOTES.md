# Stage 3C QA2, QA2-4: preservation checkpoint (work in progress, NOT final)

The user stopped the QA2-4 final-check chain (`dev/stage-3c-qa2/run_final_checks.sh`) on 2026-10-10 at about 19:42 UTC, part-way through its third step. Every QA2 background process was terminated by PID before this commit, so no evidence file here is still being written.

This checkpoint is not a final QA2 build and not a human-QA candidate. `STAGE_3C_QA2_REPORT.md` and `STAGE_3C_QA2_HUMAN_QA.md` are marked DRAFT. Every `FINAL_*` placeholder in the report is still unmeasured, and no package (ZIP) has been made.

## Source changes since QA2-3 (`a85c51e`)
- **`assets/ui.css`:** `.mm-title` now clips (`overflow:hidden`).
  - Every pixel of the logo that is not fully transparent lies inside the title box (the sign's own box), so nothing visible is clipped.
  - Without the clip, the image's invisible transparent surround gave `#menu` 84 px of horizontal overflow on a 390 x 844 phone. The first candidate's `probe_c1` found it.
- **`assets/ui.js`:** diagnostics only. `__ui.boot().done` records when each boot piece was ready; nothing else in the file changed.

## Checks completed on this tree (`run_final_checks.sh`, before it was stopped)
- **`probe_b1` (the boot gate): 13/13 PASS.** Evidence: `probe_b1.json` / `.log`, and `b1/` (cold, warm and 4 Mbit/s frame sheets and frames JSON, the stylesheet-error screenshot).
- **`probe_b2` (the logo and the black field): 10/10 PASS** with the new clip. Evidence: `probe_b2.json` / `.log`, and `b2/` (menu at 8 sizes, field screenshots, the run).
- **`probe_b3` (the gate and the menu music): INTERRUPTED.** 9 checks were recorded before the stop: 7 PASS, 2 FAIL. Evidence: `probe_b3.json` / `.log`, `b3/b3_gate_1280x720.png`, `b3/b3_enter_sheet.jpg`.
  - **FAIL: "ENTER LEVEL 0 ... passes through black".** The recorded frames went menu (until 2.4 s) -> black (62 frames, 2.4-5.8 s) -> dim (18 frames from 5.8 s, the world fading in). The recording ended before a frame reached the "lit" class (10 % of the screen not black), so the check's last condition was not met.
    - The DOM states were right: the curtain at 0.4 s (run, `curtain out`, pointer-events none), then playing with the layer hidden at 2.9 s.
    - In the two earlier QA2-3 runs the same check passed, with "lit" frames from about 5.4-6.0 s.
    - **Unresolved.** Most likely the recording window ends too early for the software renderer's lag, but this has not been confirmed. It must be re-run, not assumed.
  - **FAIL: "no page errors".** This was caused by the stop itself: the browser was closed while the probe was clicking NEW RUN (`page.click: Target page, context or browser has been closed`).
  - **Not reached:** END, the mouse / reduced-motion / touch gate checks, the direct path, Cache Storage, seams, failures, the slow note, no Web Audio, and the scripted run.
    - All of these passed in QA2-3's committed run (`../q3/probe_b3.json`, 21/21) on `a85c51e`. That tree did not have the two source changes above.

## Interim QA2-4 runs on earlier trees (not final evidence)
- **Camera (`test_3bn.js`) 7/7, camera fairness 12/12, BR-RoLE unit checks 32/32, theme files 8/8.** These ran on `a85c51e` plus uncommitted dev files only, with no shipped change. Their logs were deleted when the final chain started, and they still need re-running on the final tree.
- **First full regression pass** (`regress/run.js`, on `a85c51e`). Its outputs were deleted when the final chain started; results are from its log:

  | Probe | Result | Notes |
  |---|---|---|
  | `probe_q1` | crashed | it measured QA1's text title, now an image |
  | `probe_q2` | 9/9 | |
  | `probe_q3` | 14/15 | the timing-sensitive reveal check; see below |
  | `probe_q4` | 7/8 | the stick-speed "no attempt faster" condition, by 0.0002 px per tick on one retry: the timing artifact class QA1 Q5 documented |
  | `probe_q5` | 5/5 | |
  | `lifecycle.js` | runner crash | the runner did not yet read lifecycle.js's record format |

- **Trial regression** (`interim_regress_trial/`, preserved here; `run.log` is its summary). It ran mostly on `a85c51e`; `ui.css` gained the clip while `probe_c2`..`c5` and `lifecycle_mp` were running.

  | Probe | Result | Notes |
  |---|---|---|
  | `probe_q1` | 19/26 | before the lettering-box adaptation, the logo-overflow exclusion and the two theme supersessions now in `regress/run.js`; not re-run since |
  | `probe_q3` | 14/15 | the reveal timing check |
  | `probe_q4` | 8/8 | |
  | `lifecycle` | 1/1 | |
  | `probe_c1` | 21/23 | 1 superseded by QA1; 1 failure, the 84 px menu overflow now fixed by the clip; not re-run since |
  | `probe_c2` | 13/18 | 5 superseded by QA1 |
  | `probe_c3` | 13/13 | |
  | `probe_c4` | 10/11 | 1 superseded by QA1 |
  | `probe_c5` | 7/7 | |
  | `lifecycle_mp` | 1/1 | |

- **Performance A/B** (`perf_ab_qa2.js`, QA1 vs QA2 interleaved, 2 desktop rounds + 1 phone). It ran before the two source changes, and its JSON was deleted when the final chain started. Summary from its log (mean frame ms, QA1 -> QA2; software renderer):

  | View | State | QA1 | QA2 |
  |---|---|---|---|
  | Desktop | menu idle | 718 | 665 |
  | Desktop | Settings | 667 | 643 |
  | Desktop | Customize | 819 | 758 |
  | Desktop | Level 0 lit, standing | 1045 | 1063 |
  | Desktop | Level 0 lit, walking | 971 | 971 |
  | Desktop | Level 0 dark | 955 | 947 |
  | Phone | menu idle | 301 | 296 |
  | Phone | Level 0 lit, standing | 753 | 702 |
  | Phone | Level 0 lit, walking | 754 | 725 |
  | Phone | Level 0 dark | 739 | 703 |

  QA2 matches QA1 within noise. This must be re-measured on the final tree.
- **Start timing** (`perf_start_qa2.js`): its first version measured QA1's "menu settled" wrongly (before its first paint). The fixed version has not run yet.
  - A separate warm-start investigation (smoke test) found QA2 warm starts of 1.1-6.2 s here.
  - The time goes on reading 22.6 MB from Cache Storage (the Loop alone: match 0.7 s + read 1.2-1.9 s), decoding it (0.3-0.4 s), and, once, two slow frames, all under the software renderer.

## The timing-sensitive Q3 finding (`q3_timing/`, complete)
- **The check:** QA1's `probe_q3` check "as a run begins: THRESHOLD / LEVEL 0 ... then fade away (gone after about 6 s)" looks once, 7.3 s after the HUD appears. The reveal is three chained timers: 0.45 s + 3.8 s + 1.3 s = 5.55 s.
- **The test:** three interleaved runs each, on the same machine.
  - QA1's own unchanged probe on the QA1 tree (`5f30e28`) failed 2 of 3.
  - The QA2 copy on the QA2 tree failed 2 of 3.
  - In every run, all other `probe_q3` checks passed.
- **A direct in-play measurement agrees:** timers fire 300-700 ms late on both builds, and the reveal was gone at 7.7-7.8 s on QA1 and at 6.7-6.9 s on QA2.
- **Conclusion:** this is a timing artifact of the software renderer, present on QA1. QA2 changes no HUD or reveal code.
- **Status:** `regress/run.js` lists it in `ARTIFACTS` with this evidence, so a failure of this check is reported as timing-sensitive, not as a QA2 change. The final full regression that would apply this has not run.

## Still pending (not started, or interrupted)
1. **`probe_b3` on the final tree:** a full re-run, and resolving the ENTER-transition recording result.
2. **The full regression on the final tree:** `regress/run.js` with QA1's five probes, `lifecycle.js`, the first candidate's five probes and `lifecycle_mp.py`.
3. **The other suites on the final tree:** camera, camera fairness, BR-RoLE and theme files.
4. **Final captures:** the menu at 12 sizes (`capture_menu.js --tag q4`) and the start sheets (`capture_boot.js` into `q4/boot`).
5. **Performance:** `perf_ab_qa2.js` and `perf_start_qa2.js` (fixed) on the final tree.
6. **Documents:**
   - `STAGE_3C_QA2_PERFORMANCE.md` (not written);
   - `STAGE_3C_QA2_CHANGED_FILES.txt` (generator `changed_files_qa2.py` written, not run);
   - `STAGE_3C_QA2_MENU_COMPARISON.jpg` (generator `menu_comparison_qa2.py` written, not run; needs the final captures);
   - filling the report's `FINAL_*` placeholders, and its closing status line.
7. **The package:** `package_qa2.py` (written, never run), the ZIP, `.sha256` and receipt, and the final remote verification.

**No partial ZIP exists.** `package_qa2.py` has never been run for QA2, and no `THE_FAR_BACKROOMS_STAGE_3C_QA2_*.zip` exists anywhere on this machine.
