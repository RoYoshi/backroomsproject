# Stage B test summary

All results are from this reconstruction. Automated checks do not establish good game feel.

## Required preflight

Verified input hash/architecture, immutable embedded manifest, Stage A contracts and all 46 byte-identical traces. Hound 18/18, HQA 6/6, FPS equality and camera 12/12 passed. B-01 original 200/200/404/404 reproduced. All three build outputs were unchanged. Raw logs: `dev/stage_b/results/preflight-*`.

## Post-migration existing suites

| Command | Result | Count interpretation | Seconds |
|---|---|---|---|
| `npm test` | FAIL — inherited assertions (P08 still unknown) | 151/162; suite summary | 164.142 |
| `npm run test:hound` | PASS | 18/18; suite summary | 3.377 |
| `npm run test:shared` | EXPECTED BASELINE FAILURE — F22 source guard | 22/23; suite summary | 3.982 |
| `npm run test:humanqa` | PASS | 6/6; suite summary | 1.017 |
| `npm run test:fps` | PASS | 10/10; explicit PASS/FAIL lines; not underlying assertion count | 0.516 |
| `npm run test:camera` | PASS | 12/12; suite summary | 0.165 |
| `node dev/tests/run.js s_entity_look.js` | PASS | 4/4; suite summary | 0.318 |
| `node dev/tests/phys_test.js` | PASS | 53 printed checks including 240-scenario matrix; complete confirmation log | 2.722 initial; confirmation not timed |
| `node dev/tests/interp_test.js` | PASS | 3/3; explicit PASS/FAIL lines; not underlying assertion count | 0.064 |
| `node dev/tests/nav_bench.js` | PASS | descriptive completion, no assertion count; Descriptive benchmark; exit status is completion, not acceptance assertions | 35.372 |
| `node dev/tests/audit_net.js` | PASS | 17/17; suite summary | 55.128 |
| `node dev/tests/audit_net2.js` | PASS | 11/11; suite summary | 222.76 |
| `node dev/tests/live.js` | PASS | 17/17; suite summary | 25.042 |
| `node dev/tests/ir_net.js` | PASS | 4/4; suite summary | 4.728 |
| `node dev/tests/perf_hound2e.js` | PASS | 15/15; JSON workloads | 8.539 |
| `node dev/tests/perf_shared2f.js` | PASS | 27/27; JSON workloads | 30.549 |
| `node dev/tests/perf_smiler.js` | PASS | 3/3; explicit PASS/FAIL lines; not underlying assertion count | 4.632 |
| `node dev/tests/perf_light.js` | PASS | 1/1; explicit PASS/FAIL lines; not underlying assertion count | 4.929 |

Death-physics initial log was incomplete despite exit 0 (25 printed checks); a bounded repeat completed all 53 checks and the 240-scenario matrix. Both logs and physics-confirm.json are retained. Raw per-command logs and machine-readable outcomes: `dev/stage_b/results/regression/`. The runner itself returns zero after collecting failures; individual suite outcomes above are authoritative.

## New gates

- `node dev/stage_b/test_geometry.js`: PASS, 24 groups.
- `node dev/stage_b/verify.js`: PASS, frozen map export and all 46 gameplay record arrays; seven permitted original edits, 336 unchanged originals.
- `node dev/stage_b/served_package.js`: PASS, eight exact-byte resources, 11 safe rejection/recovery cases, 12 viewport/DPR cases in literal served resize binding.
- `node dev/stage_b/content_identity.js`: PASS, same identity across Node/classic VM and fresh extraction.
- Clean path-with-spaces: three builds byte-identical, new geometry/identity/export/HTTP checks PASS.
- Runtime: Node v24.19.0; same runtime as Stage A evidence.

## Explicit limits

Browser launch: BLOCKED by missing installed Chromium headless executable. Python Playwright and system Chromium are absent; Node Playwright exists, but its actual launch failed. No rendered Pixi, real browser resize, multiplayer visual or admin-panel verdict is claimed. VM tests establish load/binding behavior only. Admin T8 remains historical context, not a newly executed result.

Full spatial queries, Z01–Z32 physics, Stage C+ and 2.5D presentation: NOT IMPLEMENTED BY DESIGN. Human gameplay QA: PENDING.

Initial working-directory and sandbox EPERM attempts are recorded in the working status. Permitted preflight subsequently passed. They are environment/command errors, not product regressions.
