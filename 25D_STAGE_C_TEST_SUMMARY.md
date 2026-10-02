# Stage C test summary

Runtime: Node v24.19.0. All raw output is in `dev/stage_c/results/`. Counts below describe each suite, not a universal assertion total.

| Retained command/suite | Result | Count / interpretation |
|---|---|---|
| `npm test` | Inherited failures; complete-output rerun | 151/162 (first log incomplete) |
| `npm run test:hound` | PASS | 18/18 |
| `npm run test:shared` | FAIL | 22/23; inherited F22 |
| `npm run test:humanqa` | PASS | 6/6 |
| `npm run test:fps` | PASS | 10/10 printed checks |
| `npm run test:camera` | PASS | 12/12 |
| `node dev/tests/run.js s_entity_look.js` | PASS | 4/4 |
| `node dev/tests/phys_test.js` | PASS | 53/53 printed checks |
| `node dev/tests/interp_test.js` | PASS | 3/3 printed checks |
| `node dev/tests/nav_bench.js` | COMPLETED | Descriptive benchmark, not assertion passes |
| `node dev/tests/audit_net.js` | PASS | 17/17 |
| `node dev/tests/audit_net2.js` | PASS | 11/11 |
| `node dev/tests/live.js` | PASS | 17/17 |
| `node dev/tests/ir_net.js` | PASS | 4/4 |
| `node dev/tests/perf_hound2e.js` | PASS | 15/15 workload summaries / existing gates |
| `node dev/tests/perf_shared2f.js` | PASS | 27/27 workload summaries / existing gates |
| `node dev/tests/perf_smiler.js` | PASS | 3/3 workload summaries / existing gates |
| `node dev/tests/perf_light.js` | PASS | 1/1 workload summaries / existing gates |

Stage C: 21 core groups; 54 adversarial checks (including 48 independent analytical TOI controls); 10 actual-motor scenarios x 8 render schedules; 315 camera context cases; fresh-process identity; 46 flat traces / 35,098 records and exact export parity. Raw logs retain actual counts.

HTTP checks serve nine resources with exact package bytes, including camera_policy, timing_policy, world_geometry and world_motion. Eleven malformed/traversal/internal paths remain rejected, with a valid request immediately after each. Literal application timing/resize/geometry bindings execute in a VM; this is not browser rendering.

Fresh recovery extraction in a path with spaces reproduced ai.js, sim.js and ents.js byte-for-byte using all three build scripts and passed the Stage C tools. Final bounded extraction verifies final bytes and core tests; long suites are not repeated for packaging.

Spatial performance measurements are descriptive: 1/256/1024-solid compile and 4,000 local support/clearance queries each. They show indexed local queries; warmup affects timings. No fairness or game-feel conclusion follows.

Browser: BLOCKED (missing supported executable). Human QA: PENDING. No tests for later stages are reported as passed.
