# Stage H test summary

Node v24.19.0; Chromium 151.0.7922.34 / ANGLE SwiftShader. All raw runs remain under `dev/stage_h/evidence`. Retained suites were serial, including network timing and performance.

| Retained suite | Final disposition | Passed/total |
|---|---|---:|
| npm-test | FAIL | 151/162 |
| hound | PASS | 18/18 |
| shared | FAIL | 22/23 |
| humanqa | PASS | 6/6 |
| fps | PASS | 10/10 |
| camera | PASS | 12/12 |
| entity-look | PASS | 4/4 |
| physics | PASS | 53/53 |
| interpolation | PASS | 3/3 |
| navigation | PASS | None/None |
| audit-net | PASS | 17/17 |
| audit-net2 | PASS | 11/11 |
| live | PASS | 17/17 |
| ir-net | PASS | 4/4 |
| perf-hound | PASS | 15/15 |
| perf-shared | PASS | 27/27 |
| perf-smiler | PASS | 3/3 |
| perf-light | PASS | 1/1 |

`None/None` is the descriptive navigation benchmark, not a counted assertion suite. Physics has 53 groups covering 240 scenarios. Aggregate/shared failures are inherited and compared by exact names. The initial perf-light FAIL remains in `h5/retained-01`; the table's final PASS refers to both isolated unchanged candidate runs in `h5/light-isolated-01`.

| H5 regression | Result | Command |
|---|---|---|
| parent-baseline | PASS | `python dev/stage_a/run_baseline.py --game '/workspace/scratch/c78c552e3af5/Accepted Stage G For H5/source' --out ./dev/stage_h/evidence/h5/regression-01/parent-baseline --only npm-test,shared` |
| stage-b-geometry | PASS | `node dev/stage_b/test_geometry.js` |
| stage-c-motion | PASS | `node dev/stage_c/test_spatial.js` |
| stage-c-adversarial | PASS | `node dev/stage_c/test_adversarial.js` |
| stage-c-schedules | PASS | `node dev/stage_c/test_schedules.js` |
| stage-c-camera | PASS | `node dev/stage_c/test_camera.js` |
| stage-e | PASS | `node dev/tests/run.js s_nav25d.js s_perception25d.js` |
| stage-d-view | PASS | `node dev/stage_d/test_view.js ./dev/stage_h/evidence/h5/regression-01/view.json` |
| stage-d-independence | PASS | `node dev/stage_d/test_independence.js ./dev/stage_h/evidence/h5/regression-01/independence.json` |
| stage-f-protocol | PASS | `node dev/stage_f/test_f1.js` |
| stage-f-authority | PASS | `node dev/stage_f/test_f2.js` |
| network25d | PASS | `node dev/tests/network25d.js` |
| physics25d | PASS | `node dev/tests/physics25d.js` |
| frozen-parity | PASS | `python dev/stage_h/run_parity.py ./dev/stage_h/evidence/h5/regression-01/parity` |
| stage-d-browser-core | PASS | `node dev/stage_d/browser_core.js . ./dev/stage_h/evidence/h5/regression-01/browser-d-core` |
| stage-d-browser-extended | PASS | `node dev/stage_d/browser_extended.js . ./dev/stage_h/evidence/h5/regression-01/browser-d-extended` |
| stage-h-browser-traversal | PASS | `node dev/stage_h/browser_h1.js ./dev/stage_h/evidence/h5/regression-04/browser-h-traversal` |
| flat-browser-parity | PASS | `node dev/stage_h/browser_flat.js . '/workspace/scratch/c78c552e3af5/Accepted Stage G For H5/source' ./dev/stage_h/evidence/h5/regression-04/browser-flat` |
| served-package | PASS | `node dev/stage_h/served_package.js ./dev/stage_h/evidence/h5/regression-04/served.json` |

Fresh extraction checks in `h5/portable-02`: two AI/simulation/entity builds reproduce exactly; real physics25d 5/5, network25d 5/5 and view25d 2/2 pass; flat/spatial HTTP, FPS and camera gates pass. The complete named view gate covers Z29/Z30 and H-Z14 with actual server, production Pixi, multiple clients, screenshots, pixels, GPU and error checks. H1 traversal rerun covers real keyboard ramp and peer fall interpolation. H4 physical picking and paired decision/RNG checks also pass. Package acceptance does not substitute for human gameplay QA.

`h5/regression-final.json` records each successful attempt's provenance. The first H1 initial-pixel failure remains in `regression-01`; the full-quality peer-airborne capture failure remains in `regression-02`. The final H1 run and remaining flat/HTTP gates are in `regression-04`. Full-quality boot/ramp and reduced-detail two-client fall are explicit separate capture profiles. The diagnostic probes retain the pre-join 468-pixel capture and post-authentication >75,000-pixel captures from before the force-path repair; no pixel threshold was changed.

Recorded paths identify the execution workspace. Use a local checkout of the exact accepted Stage G parent when repeating parent comparisons.
