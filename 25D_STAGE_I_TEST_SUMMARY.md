# Stage I test summary

All timing-sensitive runs were serial. Counts retain each original suite’s meaning.

| Retained suite | Disposition | Passed / total | Seconds | Raw evidence |
|---|---|---|---|---|
| npm-test | INHERITED FAILURE | 151 / 162 | 210.589 | dev/stage_i/evidence/i4/retained-01/npm-test.log |
| hound | PASS | 18 / 18 | 4.634 | dev/stage_i/evidence/i4/retained-01/hound.log |
| shared | INHERITED FAILURE | 22 / 23 | 5.847 | dev/stage_i/evidence/i4/retained-01/shared.log |
| humanqa | PASS | 6 / 6 | 1.47 | dev/stage_i/evidence/i4/retained-01/humanqa.log |
| fps | PASS | 10 / 10 | 1.101 | dev/stage_i/evidence/i4/retained-01/fps.log |
| camera | PASS | 12 / 12 | 0.317 | dev/stage_i/evidence/i4/retained-01/camera.log |
| entity-look | PASS | 4 / 4 | 0.42 | dev/stage_i/evidence/i4/retained-01/entity-look.log |
| physics | PASS | 53 / 53 | 4.147 | dev/stage_i/evidence/i4/retained-01/physics.log |
| interpolation | PASS | 3 / 3 | 0.115 | dev/stage_i/evidence/i4/retained-01/interpolation.log |
| navigation | PASS | Descriptive benchmark | 45.141 | dev/stage_i/evidence/i4/retained-01/navigation.log |
| audit-net | PASS | 17 / 17 | 55.672 | dev/stage_i/evidence/i4/retained-01/audit-net.log |
| audit-net2 | PASS | 11 / 11 | 232.317 | dev/stage_i/evidence/i4/retained-01/audit-net2.log |
| live | PASS | 17 / 17 | 26.745 | dev/stage_i/evidence/i4/retained-01/live.log |
| ir-net | PASS | 4 / 4 | 4.834 | dev/stage_i/evidence/i4/retained-01/ir-net.log |
| perf-hound | PASS | 15 / 15 | 11.647 | dev/stage_i/evidence/i4/retained-01/perf-hound.log |
| perf-shared | PASS | 27 / 27 | 39.865 | dev/stage_i/evidence/i4/retained-01/perf-shared.log |
| perf-smiler | PASS | 3 / 3 | 5.284 | dev/stage_i/evidence/i4/retained-01/perf-smiler.log |
| perf-light | PASS | 1 / 1 | 5.987 | dev/stage_i/evidence/i4/retained-01/perf-light.log |

The retained `humanqa` row is an automated legacy test suite; human approval for Stage I remains PENDING. Navigation is a descriptive benchmark, not a counted assertion suite. Legacy physics has 53 groups covering 240 scenarios.

| Named final suite | Disposition | Runtime | Seconds | Evidence |
|---|---|---|---|---|
| s_world25d | PASS | v24.19.0 | 6.995 | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| s_nav25d | PASS | v24.19.0 | 11.743 | dev/stage_i/evidence/i4/portable-01/s_nav25d.log |
| s_perception25d | PASS | v24.19.0 | 9.798 | dev/stage_i/evidence/i4/portable-01/s_perception25d.log |
| network25d | PASS | v24.19.0 | 136.152 | dev/stage_i/evidence/i4/portable-01/network25d.log |
| physics25d | PASS | v24.19.0 | 48.509 | dev/stage_i/evidence/i4/portable-01/physics25d.log |
| view25d | PASS | v24.19.0 / Chromium 151.0.7922.34 / ANGLE SwiftShader | 536.205 | dev/stage_i/evidence/i4/portable-01/view25d.log |
| perf_world25d | PASS | v24.19.0 / Chromium 151.0.7922.34 / ANGLE SwiftShader | 80.343 | dev/stage_i/evidence/i4/portable-01/perf_world25d.log |

| Retained spatial/integration command | Exit | Seconds |
|---|---|---|
| python dev/stage_a/run_baseline.py --game /workspace/scratch/be6e71d940f9/accepted-stage-h/thefarbackrooms-level0 --out /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/parent-baseline --only npm-test,shared | 0 | 202.3 |
| node dev/stage_c/test_camera.js | 0 | 0.116 |
| node dev/stage_d/test_view.js /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/view.json | 0 | 0.115 |
| node dev/stage_d/test_independence.js /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/independence.json | 0 | 0.567 |
| node dev/stage_f/test_f1.js | 0 | 0.417 |
| node dev/stage_f/test_f2.js | 0 | 2.028 |
| node dev/stage_h/test_lighting.js | 0 | 3.681 |
| node dev/stage_h/test_picking.js | 0 | 0.115 |
| python dev/stage_h/run_parity.py /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/parity | 0 | 26.947 |
| node dev/stage_d/browser_core.js /workspace/scratch/be6e71d940f9/stage-i /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/browser-d-core | 0 | 20.872 |
| node dev/stage_d/browser_extended.js /workspace/scratch/be6e71d940f9/stage-i /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/browser-d-extended | 0 | 146.718 |
| node dev/stage_h/browser_h1.js /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/browser-h-traversal | 0 | 21.257 |
| node dev/stage_h/browser_flat.js /workspace/scratch/be6e71d940f9/stage-i /workspace/scratch/be6e71d940f9/accepted-stage-h/thefarbackrooms-level0 /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/browser-flat | 0 | 51.167 |
| node dev/stage_h/served_package.js /workspace/scratch/be6e71d940f9/stage-i/dev/stage_i/evidence/i4/regression-01/served.json | 0 | 0.466 |
| node dev/stage_i/test_redirect.js | 0 | 0.165 |

Fresh extraction independently runs all seven named suites plus six builds, HTTP, redirect, FPS and camera. Named owners execute retained B/C/E/F/G/H kernels; the separate integration run covers D prototype/browser, H traversal, physical picking/light independence and frozen/flat parity.
