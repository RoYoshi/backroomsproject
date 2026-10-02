# Stage D test summary

Engineering validation is complete for this bounded prototype. Human QA and hardware-reference frame-budget validation remain pending.

## Focused and retained spatial checks

| Check | Result | Evidence |
|---|---|---|
| Projection/depth/visibility/cutaway/camera/capacity | PASS, 10 groups | `dev/stage_d/evidence/view.json` |
| Real browser core composition | PASS, 10 groups | `browser-core.json` |
| Viewport/DPR and quality | PASS, 5 profiles × 2 qualities | `browser-extended.json` |
| Fade reveal checks | PASS, 21 fade samples | `browser-extended.json` |
| Cutaway boundary stability | PASS, 120 frames, one output hash | `browser-extended.json` |
| Real move.js + view independence | PASS, 8 render schedules | `independence.json` |
| Stage C spatial core | PASS, 21 groups | `spatial-core.log` |
| Stage C adversarial | PASS, 54 checks | `spatial-adversarial.log` |
| Stage C fixed schedules | PASS, 10 scenarios × 8 | `spatial-schedules.log` |
| CAMERA-P01 spatial combinations | PASS, 315 | `camera-spatial.log` |
| Flat trace/map parity | PASS, 46 traces / 35,098 records | `flat-parity.json` |
| Real flat browser screenshot parity | PASS, menu + gameplay | `browser-flat.json` |
| HTTP protections and literal app bindings | PASS | `http.json`, `browser-core.json` |
| Clean extraction/path with spaces | PASS, 10 commands | `portability.json` |

Evidence filenames without a directory above are under `dev/stage_d/evidence/`. `http.json` correctly labels its own scope as HTTP/VM rather than browser; the separate browser JSON supplies actual browser acceptance.

## Inherited regressions

| Retained suite | Result | Evidence count |
|---|---|---|
| npm-test | INHERITED FAIL | 151/162 |
| hound | PASS | 18/18 |
| shared | INHERITED FAIL | 22/23 |
| humanqa | PASS | 6/6 |
| fps | PASS | 10/10 |
| camera | PASS | 12/12 |
| entity-look | PASS | 4/4 |
| physics | PASS | 53/53 |
| interpolation | PASS | 3/3 |
| navigation | PASS | descriptive completion |
| audit-net | PASS | 17/17 |
| audit-net2 | PASS | 11/11 |
| live | PASS | 17/17 |
| ir-net | PASS | 4/4 |
| perf-hound | PASS | 15/15 |
| perf-shared | PASS | 27/27 |
| perf-smiler | PASS | 3/3 |
| perf-light | PASS | 1/1 |


All original tests remain unchanged. Aggregate comparison uses Stage C's **complete** `dev/stage_c/results/npm-test-complete.log`, not its earlier truncated initial log. Failure names match exactly after stripping timing metadata. See `baseline-comparison.json`. Explicit PASS-line counts and JSON workloads are not inflated into underlying assertion counts; navigation is a descriptive benchmark.

## Performance

| Viewport | Quality | Target | Completed frame median / p95 | Drained RAF median / p95 | New resource estimate |
|---|---:|---|---:|---:|---:|
| 1280×720 DPR 1 | 1 | 1280×720 | 212.9 / 236.1 ms | 216.6 / 250.0 ms | 7.15 MiB |
| 1280×720 DPR 1 | 0.5 | 640×360 | 52.7 / 61.7 ms | 50.1 / 66.8 ms | 1.88 MiB |
| 1920×1080 DPR 1 | 1 | 1920×1080 | 475.4 / 523.7 ms | 500.0 / 583.3 ms | 15.94 MiB |
| 1920×1080 DPR 1 | 0.5 | 960×540 | 126.1 / 140.6 ms | 133.3 / 150.0 ms | 4.07 MiB |


These are Chrome 151 / SwiftShader measurements at DPR 1, including CPU submission, actual GPU completion and 1×1 readback overhead. Each profile has 3 warmups, 16 completed-frame samples, and 24 drained RAF intervals. No other benchmark ran concurrently. The available software profile misses 16.7 ms; hardware performance remains unverified.

The earlier draw-plus-`gl.finish` timing returned enqueue-only values on this browser. That is documented and superseded by `browser-performance.json`; initial raw evidence is retained under `evidence/development/`. The historical small numbers are not GPU/frame-budget passes.

Final archive checks are deliberately bounded: syntax, view/camera policy, exact served bytes/path rejection and actual core browser acceptance. Long regressions are not repeated after packaging.
