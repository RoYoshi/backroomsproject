# SH4 — full retained regression, human-QA handoff, package

Parent checkpoint: SH3 `afd71455f5795cf6f6d287584d6b8a42c3718b95` (tree `98a8f9ab91b32ac9d35f3e179ce0baf5f5984bc9`),
verified on GitHub before this work started (`sh3_remote_verify.json`).

## What changed

**Nothing that runs in the game.** `assets/shadows-2d.js` and `index.html` are byte-identical to SH3. The final
tree's game files are SH3's, and the regression below ran on an export of the SH3 commit.

- **Reports** at the repository root: `2D_SHADOWS_REPORT.md`, `_TEST_SUMMARY.md`, `_PERFORMANCE.md`,
  `_CHANGED_FILES.txt`, `_HUMAN_QA.md`, `_GIT_CHECKPOINTS.md`. They are generated from this folder's evidence by
  `dev/shadows/report/` wherever they quote a result.
- **Tooling:**
  - `build_probe.js`: the one-time build costs of a whole-map tour.
  - `log_identity.py`: how closely each retained log matches the parent's.
  - `run_retained.py --timeout-scale`: multiplies the runner's own safety deadlines, and records the factor.
  - `report/`: the generators of the root reports and of the package receipt.
- **Notes:** wording fixes in `../sh3/SH3_PERF.md`: the draw-call note, the forced-layout cost quoted from the saved
  profile, the measured noise band, and the 2D-canvas note.
- **Independent review.** A separate reviewer checked the reports against this evidence after the first SH4 commit
  (`0787e1f`). All seven verification items passed. Where the wording claimed more than the evidence shows, it was
  corrected, and `retained-diag/EXPORTS.txt` and `retained/log_identity_sh1.txt` / `_sh2.txt` were added. The
  corrected claims were about 2D canvases, the noise band, the restart, `world.js` and FREEZE OK, the SH1 / SH2 log
  identity, and `main` checks. No result changed.

## Evidence in this folder

| file | what |
|---|---|
| `unit_tests.log` | `node dev/shadows/test_shadows.js` on the final tree |
| `browser_checks.log` | `node dev/shadows/browser_shadows.js` against the final tree's shipped server |
| `retained/` | the retained v23.3.6 suites on the final tree (default deadlines): one log per suite, `retained.json`, `compare_vs_parent.md` against the SH0 baseline, `byte_identical.txt` (`log_identity.py`), and `log_identity_sh1.txt` / `_sh2.txt` (the same check on the SH1 and SH2 logs) |
| `retained-diag/` | the two differing suites run again on this machine, back to back, alternating the parent and the final tree, deadlines ×3: `parent-1`, `final-1`, `parent-2`, `final-2`, `table.md`, and `EXPORTS.txt` (which export each run used, checked against the commits) |
| `build_probe.json`, `build_probe.log` | one-time build costs: grounding, lamp caches, the module's worst frame |
| `freeze_verify.txt` | the gameplay freeze verified on the staged SH4 tree |
| `sh3_remote_verify.json` | SH3 on GitHub: `git ls-remote` and the REST API agree on commit, tree and parent |
| `sh4_remote_verify.json` | the reviewed SH4 commit `0787e1f` on GitHub, the same check |

## Why a same-machine rerun

The container was restarted during the SH3 work, after SH2 was pushed, and the same work has run slower since. The
SH0 baseline, SH1 and SH2 ran before the restart. In the main run after it, 19 of 21 suites reproduced the baseline
exactly. The other two were:
- `browser-ir`, stopped by the runner's own 400 s deadline;
- `browser-admin`, with 2 extra T5 failures.

Rerunning both on this machine for the parent and the final tree showed:
- `browser-ir` passes on both;
- the parent itself shows the same T5 / T6 death-preview timing failures.

The full reading is in `2D_SHADOWS_TEST_SUMMARY.md`.
