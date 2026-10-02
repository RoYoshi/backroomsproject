# Stage A test summary

Recorded environment: Node v24.19.0, npm 11.9.0, Linux x86_64, Python 3.12.14. No Node 22 comparison was run. Existing suites ran on the pristine ZIP extraction. Browser access: **BLOCKED**. Full raw output and machine-readable command/result/duration/count metadata are under `dev/stage_a/results`.

| Command | Result | Exact reported count | Seconds |
|---|---|---|---|
| `npm test` | FAIL | 151/162 | 214.969 |
| `npm run test:hound` | PASS | 18/18 | 4.945 |
| `npm run test:shared` | FAIL | 22/23 | 5.892 |
| `npm run test:humanqa` | PASS | 6/6 | 2.033 |
| `npm run test:fps` | PASS | 10/10 printed groups | 0.867 |
| `npm run test:camera` | PASS | 12/12 | 0.265 |
| `node dev/tests/run.js s_entity_look.js` | PASS | 4/4 | 0.416 |
| `node dev/tests/phys_test.js` | PASS | 53/53 printed groups | 2.673 |
| `node dev/tests/interp_test.js` | PASS | 3/3 printed groups | 0.115 |
| `node dev/tests/nav_bench.js` | PASS | No assertion denominator; 8 descriptive summaries | 49.088 |
| `node dev/tests/audit_net.js` | PASS | 17/17 | 55.291 |
| `node dev/tests/audit_net2.js` | PASS | 11/11 | 223.747 |
| `node dev/tests/live.js` | FAIL | 16/17 | 26.031 |
| `node dev/tests/ir_net.js` | PASS | 4/4 | 4.777 |
| `node dev/tests/perf_hound2e.js` | PASS | 15/15 workloads | 10.946 |
| `node dev/tests/perf_shared2f.js` | PASS | 27/27 workloads | 39.822 |
| `node dev/tests/perf_smiler.js` | PASS | 3/3 printed groups | 6.871 |
| `node dev/tests/perf_light.js` | PASS | 1/1 printed groups | 6.29 |

Navigation PASS means the benchmark completed with exit 0. Its observed rates are not an acceptance suite; NV09 remains failed in npm test. Physics prints 53 passing groups, including a 240-scenario group; those are not 53 individual simulations. FPS prints 10 checks, and Stage A adds exact equality for all 12 motor scenarios across eight schedules. Performance percentages/time budgets describe this machine/run and cannot establish human fairness.

The aggregate failed 11/162: P01, P07, P08, H07, SM01, NV09, C1, C4, C5, C18, F22. Shared fails F22 (22/23). The selected pristine rerun reproduced all 11 failures (0/11). `live.js` first returned 16/17 with L5c red, then 17/17 in 24.025 s. An intervening restricted-sandbox attempt was BLOCKED (local socket EPERM, reported harness 0/2); it is not a product result. See the failure ledger for exact notes, historical evidence and uncertainty.

`audit_net.js` completed 17/17; `audit_net2.js` 11/11. No claim is made that old Node 22.16 timing trouble was resolved across versions. Current real wire coverage succeeded; the local L5c immediate-observer sampling race is documented separately.

## Stage A checks

- Immutable original content: 227/227 paths, lengths and SHA-256 match.
- Contracts: 23 groups pass, including invalid-data and identity-key negative controls. Physics: NOT IMPLEMENTED BY DESIGN.
- Reference reproduction: 46/46 compressed traces byte-identical in separate fresh processes; 35,098 records. Discrete states, numeric fields, inputs, seed metadata and event order are preserved exactly on this runtime.
- Diff negative control: planted tick 2 x-coordinate difference produces exit 1, FIRST DIVERGENT TICK and field `record.x`. Identical input exits 0.
- Future entries: 7/7 entry points return exit 2 and collectively report all 32 Z scenarios NOT IMPLEMENTED; no fake pass.
- Served package: B-01 reproduced at all four URLs; malformed `/%` returns 400; next `/` returns 200. This is an EXPECTED BASELINE FAILURE, not hosted policy success.
- Portable generation: all three scripts exit 0 from a fresh path containing spaces and reproduce ai.js, sim.js, ents.js byte-for-byte. Before/after hashes are in `results/portable_builds.json`.
- redirect.js and new JavaScript syntax valid. Original redirect.js remains unchanged and packaged.

Final archive extraction, exact tree comparison, repeated Stage A checks, targeted existing FPS/camera/HQA checks, builds and served probe from a fresh path containing spaces are recorded in the external `25D_STAGE_A_PACKAGE_VERIFICATION.json`. The ZIP hash is external to avoid a self-referential archive checksum.

## Limits and development-only corrections

The initial new motor capture incorrectly accumulated floating frame durations, giving 959/960 ticks at an endpoint. It now uses absolute frame timestamps as the real scheduler does. A new deep-carpet lookup used a nonexistent room index; it now resolves the room by its existing name and asserts actual `deep` surface observations. A new navigation coverage assertion revealed the sampled routes used no crawl cells; an explicit existing crawl-cell fixture now supplies that coverage. The new verifier now treats child-process EPERM as an error before interpreting exit status. These are Stage A tooling corrections, not build changes; production thresholds were not weakened.

The baseline runner initially treated navigation numeric success fractions as boolean workload assertions. The current parser only counts boolean `ok` workloads, and the frozen result now preserves all eight descriptive summaries with no invented assertion denominator. Raw output was retained.

Browser suites (admin, multiplayer lifecycle, rendering, movement, fallback parity, IR and lighting) are BLOCKED by absent local Playwright/Chromium. Subjective feel, visual readability, brutality, fairness and multiplayer human experience remain unverified. No human QA acceptance is claimed.
