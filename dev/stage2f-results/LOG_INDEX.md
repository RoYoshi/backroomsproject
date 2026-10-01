# Stage 2F raw evidence index

Final acceptance: portable-full-suite.log (fresh path containing spaces; 152/161), portable-results.json (three reproducible builds), shared-delivery.log (23/23; final debug-death cleanup included), release-focused.log (53/53), controlled-parity-release.log (7,680 paired ticks), movement-parity-final.log (4,800 paired ticks).

Baseline: baseline-scenarios.log, pristine supplied Stage 2E 135/138.

Wire/physics: audit-net.log 17/17; audit-net2.log 11/11; ir-net.log 4/4; live.log 17/17; physics.log 53/53; interpolation.log 3/3; nav-bench.log.

Performance: perf-shared.log for eight workloads; replace its initial habits rows (no hypotheses) with perf-habits-complete.log (full hypotheses). perf-hound.log, perf-smiler.log and perf-light.log retain original tool budgets. These measure implementation-era code before the final cache invalidation/debug-only additions; final shared measurements are perf-shared-release.log (27/27 workloads, largest step 12.70 ms; preceded only the final debug-death-label cleanup).

Causality: rng-counterfactual-observations.log is the complete successful experiment execution (its assertions deliberately include unchanged failing legacy gates); breath-isolated.log distinguishes early victim death from broken hearing. habit-real.log proves real acquisition plus fallible hidden-branch invariance.

Checkpoint: checkpoint-build.json and checkpoint-stop.json record minimal checks and stop inventory. browser-status.log records the actual CUA block.

Historical/intermediate logs are retained for transparency, not counted as final passes: regression-first, first-2e-ir, shared-first/second/third, movement-parity (incorrect end-of-tick recovery assertion), rng-counterfactual (initial test-only rand parameter error). controlled-parity and controlled-parity-rerun are partial captures; controlled-parity-final/release are complete. All remaining logs predate the final fresh extraction and are superseded where a final log exists.
