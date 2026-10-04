# Part 3A bounded production measurements

Correctness checks pass. **No hardware frame budget or Part 3G performance certification is claimed.** Raw slow samples are retained.

`dev/part3a/evidence/p3a4/performance-01.json` records Node v24.19.0 on an Intel Xeon Platinum 8573C execution host, Linux x64, nine reported logical CPUs and approximately 10.45 GB reported RAM. Each workload runs 1,200 fixed 60 Hz ticks (20 simulated seconds), four normal director entities and the complete 910-solid physical world. This is a bounded in-process simulation workload, not a network capacity claim.

| Workload | Median tick | P95 | P99 | Worst including cold navigation | Worst after first second |
|---|---:|---:|---:|---:|---:|
| One player | 0.224 ms | 0.597 ms | 1.466 ms | 845.367 ms | 146.045 ms |
| Eight players | 0.307 ms | 1.578 ms | 7.784 ms | 780.145 ms | 135.196 ms |

Both runs retained collision/clearance checks and produced zero entity diagnostics. Cold navigation and later spikes remain material limitations. Complete build/physical compile/view compile measured 671.2/317.3/122.7 ms. In 2,000 distributed support-plus-clearance queries, P95 was 0.0368 ms; physical rays were 0.0181 ms. These numbers describe this host and workload only.

The model uses 130 deterministic 768-unit spatial buckets. All 910 physical occluders remain compiled. Conservative relevant candidates are submitted in deterministic 64-entry GPU pages; a dense production frame had 87 candidates, two pages, 11 lights and 61 draw calls. The independent candidate-hull workload covered 195 anchors and up to 86 candidates; the actual rendered hull differs because it includes the live player emitter. No relevant occluder is discarded to fit one page. Eight planes per solid, 64 lamp failure records and the 4,194,304-pixel target bound remain explicit renderer limits. Light storage grows from a 128-emitter allocation up to the device texture height and the shader visits every selected emitter; it throws on device-capacity overflow. Solid and candidate textures likewise reject device-capacity overflow explicitly.

Browser evidence uses Chromium 151.0.7922.34 and ANGLE SwiftShader. `readability-01/result.json` contains five forced render/readback round trips per quality:

| Target | Recorded completed round trips (ms) |
|---|---|
| Full, 960 x 600 | 6107.2, 2655.3, 2705.7, 2784.9, 2714.3 |
| Reduced, 480 x 300 | 2764.7, 779.1, 826.6, 770.0, 799.2 |

These include browser automation, rendering and pixel readback; they are not a pure GPU timer or normal gameplay FPS. They are very slow and do not meet a 16.7 ms frame budget. Full/reduced candidate IDs, lights and simulation truth match. The local upper-edge view-group correction does not alter the measured physical/navigation workload; affected visual captures were refreshed separately. No performance repair or physics/AI reduction was made during recovery.

Retained Stage I performance suites also preserve their raw timing observations, including the accepted 24-active-aftermath CPU/payload limit. Human QA should record real browser/GPU, resolution, DPR, quality, stalls and geometry behavior. Final optimization remains Part 3G.
