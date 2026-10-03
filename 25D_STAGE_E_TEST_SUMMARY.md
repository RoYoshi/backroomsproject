# Stage E final test summary

Active runtime: Node v25.9.0. Browser: actual Chromium 151.0.7922.34, SwiftShader.
The final source includes the flat coarseMove repair and spatial-only route counters.
Inherited suite logs are retained under `dev/stage_e/evidence/final/inherited/`;
the concurrent checkpoint also preserved an independent complete run under
`evidence/final-inherited/`. Focused/parity results after counters are in
`evidence/final-spatial/`. All original assertions and frozen references remain.

## Retained long suites

| Suite | Result | Qualification |
| --- | --- | --- |
| npm-test | 151/162 | Exactly the same 11 inherited failures; comparison JSON PASS. |
| hound | 18/18 |  |
| shared | 22/23 | F22 inherited guard. |
| humanqa | 6/6 |  |
| fps | 10/10 |  |
| camera | 12/12 |  |
| entity-look | 4/4 |  |
| physics | 53/53 |  |
| interpolation | 3/3 |  |
| navigation | None/None | Descriptive benchmark completed; no invented assertion count. |
| audit-net | 17/17 |  |
| audit-net2 | 11/11 | Isolated-port rerun PASS. Initial shared-port failure retained and investigated. |
| live | 17/17 | L5b/L5c historical sensitivity still disclosed. |
| ir-net | 4/4 |  |
| perf-hound | 15/15 |  |
| perf-shared | 27/27 |  |
| perf-smiler | 3/3 |  |
| perf-light | 1/1 |  |

## Stage E and protected spatial suites

| Gate | Result |
| --- | --- |
| Named Z10–Z17 gates | 8/8; invoke core 8, motion 16, sensors 16, actual entities 25 |
| Hidden-elevation / IR counterfactuals | Full state and RNG equal until legitimate evidence differs; positive controls pass |
| Stage C spatial core | 21 groups PASS |
| Stage C adversarial | 54 groups PASS |
| Spatial schedule/FPS cases | 10 scenarios × 8 schedules PASS |
| Spatial camera fairness | 315 combinations PASS |
| Stage D view | 10 checks PASS |
| Simulation/view independence | 8 schedules PASS |
| Standalone Smiler | 16/17, only inherited SM01 |
| Frozen record comparison | 46 traces / 35,098 records identical, tolerance 0 |
| Canonical Level 0 map export | Byte-identical |
| Original Stage C strict verifier | FAIL retained: historical edit allowlist excludes authorized Stage E ai.js; not represented as PASS |

The two named suite files activate retained placeholders. The frozen future matrix
is unchanged. Z14 covers Stage E visible-light/IR, and Z17 covers live entity
physics; later presentation/aftermath portions remain deferred.

## Real browser and served checks

- Original Stage D core: 10 checks PASS; extended: five viewport/DPR cases at two
  qualities, 21 fade checkpoints and 120 boundary frames PASS.
- Original flat capture: FAIL, reproduced parent-versus-parent. Timing diagnostic
  shows 0/1 ms elapsed-origin race. No product state divergence was found.
- Additional controlled flat capture: menu and playing PNGs byte-identical to
  accepted Stage D at exact 1000/2000 ms elapsed times; both fallback and fully
  loaded font contexts PASS. Original state/pixel assertions remain exact.
- Served Stage D and production gameplay: zero script errors, failed requests or
  HTTP errors with the isolated trusted-certificate store. The earlier external
  font certificate error is retained, not omitted. No TLS bypass was used.
- HTTP/static path policy is tested separately and is not substituted for browser
  execution. Raw results and screenshots are under `evidence/final/`.

## Bounded workload and package

`perf_spatial.js` passes two seeds each for 1/2/4 sheets and 2/4/8 real actors and
players, 360 ticks each. Occupied-node counts scale 130/260/520; memory/sound/search
bounds pass. `perf_connected_fixture.js` passes eight actors across four connected
surfaces for 660 ticks. Planning/cost, route/proof-cache, sight/light/sound and
worst-step metrics are in the navigation report and raw JSON. Timing spikes remain
visible and do not certify 60 Hz population capacity.

The final archive is verified separately after the source push. Its external
`25D_STAGE_E_PACKAGE_VERIFICATION.json` is authoritative for CRC, source hashes,
clean gitless extraction into a path with spaces, exact reproducible generated
builds, all eight Stage E gates, camera/view tests, served-path protection and
actual browser execution on the extracted bytes. Internal reports cannot encode
their containing archive's own hash.

Human QA is pending. Hardware-GPU performance is unverified. No Stage F work,
main merge, baseline regeneration or new unexplained functional regression is
included in the acceptance claim.

Independent recovery also completed all retained suites (`evidence/final-inherited/`), clean gitless four-build reproduction (`evidence/final-portability/`), and strict served browser rerun (`evidence/browser-network/trusted-stage-e.json`). Two sequential rounds of all four retained performance suites passed for parent and current source, with reversed ordering in round two. No average/p99 comparison exceeded its investigation threshold in both rounds; see `evidence/performance-comparison.json`.
