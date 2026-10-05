# SH6 — final correction regression and publication

Parent checkpoint: SH5 `5471ac85e14680c7cab678a988f245bf685e4471` (tree `72ec3c0e9f21942a9f118017046dcc868279b5c2`),
verified on GitHub before this work started (`sh5_remote_verify.json`).

## What changed

**Nothing that runs in the game.** `assets/shadows-2d.js` (`shadows-2d 1.1`) and `index.html` are byte-identical to
SH5. Every test and measurement here ran on an export of the SH5 commit.

- **Reports** at the repository root, rewritten for the correction: `2D_SHADOWS_REPORT.md`, `_TEST_SUMMARY.md`,
  `_PERFORMANCE.md`, `_CHANGED_FILES.txt`, `_HUMAN_QA.md` (the handoff with the correction pack's ten questions),
  `_GIT_CHECKPOINTS.md`.
- **Tooling** (`dev/shadows/`), development only, never served:
  - `frame_probe.js`: the frame rate of one fixed view per tree and quality, in alternating rounds.
  - `layer_probe.js`: what each shadow layer costs in that view.
  - `cpu_load.js`: a calibrated background load, used for the browser-ir diagnosis below.
  - `report/`: the generators read the SH6 evidence. `mk_performance.py` now computes every figure in its prose from
    the bench data. The packager takes the package name.

## Evidence in this folder

| file | what |
|---|---|
| `retained/` | the retained v23.3.6 suites on the final tree, the runner's deadlines ×3 (this machine needs it; see SH4): logs, `retained.json`, `compare_vs_parent.md` against the SH0 baseline, `byte_identical.txt` |
| `retained-diag/` | the two differing suites run again, alternating the parent and the final tree; the parent's browser-ir again with a calibrated background load; `table.md`, `EXPORTS.txt` |
| `bench-parent/`, `bench-candidate/`, `bench_compare.md` | the performance matrix, one round each: the parent against the final module at OFF / LOW / MEDIUM / HIGH (the candidate run ended at 61 of 64 cells; see below) |
| `perf/frame_probe_trees.json` | frame rate in the IR suite's view: parent, SH4 and the SH5 module, alternating rounds |
| `perf/frame_probe_load.json` | the background-load calibration, transcribed from console output (it was not saved as JSON at the time; the file says so) |
| `perf/layer_probe_sh4.json`, `perf/layer_probe_sh5.json`, `perf/layer_probe_sh5-overdraw-experiment.json` | what each shadow layer costs in that view; the reverted overdraw experiment |
| `freeze_verify.txt` | the gameplay freeze verified on the staged SH6 tree |
| `sh5_remote_verify.json` | SH5 on GitHub |

The unit tests (43/43) and browser checks (9/9) are SH5's (`../sh5/`). The module and `index.html` did not change
after SH5, so they were not run again at SH6.

## Not completed (stopped by instruction)

The planned SH6 follow-up runs were stopped by instruction once the matrix finished, and none was restarted:
- **The matrix's last cells.** The candidate run ended after 61 of 64 cells, without an error message: mobile-like
  `peers` at MEDIUM and HIGH were not measured.
- **The repeated A/B at the reception counter in your flashlight (1280×720).** In the single round it is the largest
  drop against OFF (−10 % to −15 %). Not confirmed or dismissed.
- **The lamp-build tour** (`build_probe.js`) was not re-run on the 1.1 module. The performance report uses SH4's tour
  of module 1.0 and says so.
- **The repeated unit tests and browser checks** on the SH6 tree (see above).

These are listed as pending in `2D_SHADOWS_HUMAN_QA.md`.

## The retained regression, briefly

The full reading is in `2D_SHADOWS_TEST_SUMMARY.md`. As at SH4, 19 of 21 suites reproduce the parent exactly, and the
six logs that are deterministic are byte-identical. The same two suites differ.

**browser-admin.** Its T5 death-preview sequence cascades on this machine. The parent cascaded in one of its two runs
(14 extra failures) and matched the baseline exactly in the other. The final tree cascaded in all three of its runs (16,
12 and 11 extra), always in T5 / T6 and never elsewhere. This is not proven to be unrelated to frame time and is left
as a limitation; the death previews are admin tooling and unchanged code.

**browser-ir.** It passed for the parent at normal speed, and failed or stalled for the final tree in two of three
runs (the main run printed no verdict; `final-1` failed R5 + R7; `final-2` passed). This was examined rather than assumed away:
1. In the suite's own view (1900×900, its corridor), the module costs about 12 % of the frame rate under software
   rendering. SH4 and the SH5 module cost the same there (`perf/frame_probe_trees.json`).
2. **The cost is fill, not CPU.** The module's own time there is a few tenths of a millisecond a frame. The cached lamp
   shadows are the largest share (`perf/layer_probe_*.json`).
3. **An experiment cutting lamp-shadow overdraw by a quarter changed nothing measurable,** so it was reverted, and the
   SH5 module stands (`perf/layer_probe_sh5-overdraw-experiment.json`).
4. **The parent fails the same way when slowed by as much.** It was run with a calibrated background load that slows
   its frames by about as much (40/100 slowed it 11 %; the runs used 45/100; `perf/frame_probe_load.json`). It then failed the suite in 3 of 3 runs, on the same
   checks (R7, and R5 + R7) with the same readings as the final tree. R5 is the camcorder's overheat lock, read 0.7
   game-seconds after the heat is set. R7 is a second player's view, read after fixed real-time waits.

So browser-ir is sensitive to frame time on this software-rendered machine, and the module's fill reaches that
sensitivity, as SH4's did. Neither is a gameplay difference. The gameplay suites (movement, physics, camera, FPS
independence, interpolation, AI, networking) reproduce the parent.
