# H2-6: the final package

No production file changed after H2-5 (`working_tree_during_run.txt`: the git diff of every file outside `dev/` and the stage documents is empty). H2-6 adds:
- the report (`STAGE_3D_HQ2_REPORT.md`);
- the changed-file list (`STAGE_3D_HQ2_CHANGED_FILES.txt`, written by `changed_files_hq2.py`);
- the human-QA steps (`STAGE_3D_HQ2_HUMAN_QA.md`);
- the package tool (`package_hq2.py`);
- the measurement of the last details of the gate matrix that no earlier run had made on real pages.

## Results

| Step | What | Result |
|---|---|---|
| `unit/boom_fps` | E06 at every render rate. 64 blasts (half hugging a wall, every facing, light and hat), advanced in the pieces a page draws: 30, 60, 120, 144, 240 and 360 FPS, a jittered 20–200 FPS page with stalls, and the Death Lab's clock (0.25×, paused, single frames, 1×). Every frame is compared with the one-step-at-a-time reference after the same number of 240 Hz steps | 232,768 frames, bit for bit; the end states, wall marks and light release equal |
| `mutation/f_step_cap__boom_fps` | The same with the physics capped at 6 steps a frame (a page drawing below 40 FPS falls behind) | FAILS, as it must: at 30 FPS the blast ends 576 of 768 steps in |
| `browser/life_light` | E03 on a blast, three pages. During the dropped light's 6.7 s hold (counted from the blast): Bob's connection dropped at +2.3 s (back in at +5.6 s); his window hidden, blurred and resized at +2.9 s; Carol's page reloaded at +5.9 s | 5/5: no anchor moved later, final anchors within 51 ms (gate 150); full in the hold and nothing lit after the end, by each page's own anchor; the blast heard once on Bob's page and not replayed after his reconnect; Carol's reloaded page silent, with the one corpse and its stain |
| `browser/life_lab` | R03 with the Death Lab: Bob's page PAUSED, Carol's at 0.25×. A world reset 3 s into Alice's Hound C wall death; the clocks restored 3 s later; then her next death in the new world | 8/8. The lab held Bob's replay at 0.1 s and slowed Carol's to 0.16 s. From each page's take-in of the reset (0.22–1.23 s) and after the restore, nothing of the old death (14–17 and 34–39 rows a page). One world message and one `end`, nothing stale; no `nra`, no blast. The next death: one corpse of Alice and its stain on all three, its light as HQ1 accepted, anchors within 26 ms |
| `scope` | The H2-0 allowlist on the working tree (run again in the final pass, after the documents) | nothing forbidden (9 production files allowed, 1 new; 9 documents; dev) |
| `changed_files` | `STAGE_3D_HQ2_CHANGED_FILES.txt` | written; every file in a group |
| `summary` | `summary_hq2.py`: every step of H2-5 and H2-6 in its class (`final_tests.txt`, `final_tests.json`) | 157 steps (the final pass), every one as its class requires: gate 97, parent 27, mutation 13, older-suite 9, before-fix 4, data 3, replaced 3, superseded 1 |

**The secret scan** (`secret_scan.json`) covers 4,328 files (run last, over the final tree) with the owner's address as an extra string. Its self-test passed 21/21. It has one finding, the same as H2-5's: nine bytes of the H2-5 film's compressed frames (`secret_scan_finding.txt`).

## Attempts

`attempts/first_pass/`: the scope, the changed-file list and the summary as the first pass wrote them, before the documents (`steps.txt`, the "again" line).

`attempts/life_hq2_first_runs/` holds the new harness's first runs, each with what was changed after it (`README.md`):
- **The room emptied.** The game's own rule then starts a new world when the next player joins.
- **The hold was too short** for these slow pages.
- **The judging.** Pages were judged against the earliest anchor, and a reloaded page's last row was counted.

## The checkpoint before

`remote_h2-5.json` is H2-5's remote verification: commit `65a1309`, tree `2bcb8ce`, parent `99e1593`; `git ls-remote` and the REST API agree; all 23 other branches unchanged.
