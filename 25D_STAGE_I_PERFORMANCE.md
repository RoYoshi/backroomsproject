# Stage I performance evidence

CPU: INTEL(R) XEON(R) PLATINUM 8573C; Node v24.19.0; platform linux/x64. Browser 151.0.7922.34; ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver). Timings are wall-clock metadata, never simulation input. No hardware GPU or hosting-plan capacity certification.

Normal eight-client director room: **PASS** unchanged p99 <8 ms threshold; p50 0.196, p95 0.383, p99 0.770, worst 3.050 ms over 600 measured steps. Actual population: 6 director entities. Queues/history/wake validation limits remain 90/90/15.

Active shared aftermath (four physical substeps retained):

| Active aftermaths | p50 ms | p95 ms | p99 ms | Worst ms | Peak snapshot bytes | Peak nominal bytes/client/s | Disposition |
|---|---|---|---|---|---|---|---|
| 1 | 1.274 | 1.989 | 2.902 | 7.808 | 18602 | 372040 | BOUNDED MEASUREMENT |
| 3 | 3.447 | 5.244 | 7.706 | 12.137 | 54965 | 1099300 | BOUNDED MEASUREMENT |
| 24 | 30.159 | 58.183 | 83.09 | 330.128 | 440217 | 8804340 | KNOWN LIMITATION |

All cases settle through real physics; sleeping query deltas are zero. Frame/record caps stay asserted. The 24-active CPU/payload limit is reproduced in parent controls, not passed against the normal-room threshold.

Active 128-entity admin stress: p50 3.134, p95 8.017, p99 14.018, worst 21.534 ms; 598 ticks over 10.00 seconds; 1228512 measured bytes/client/s; largest frame 66842 bytes. **BOUNDED MEASUREMENT**, not the ordinary-room threshold. An extra spawn is rejected. The initial uninstrumented run measured 7.54 ms p99; telemetry repeat 14.02 ms p99. Both raw measurements remain.

Production browser completed/drained frame samples (three per case; too few for a population percentile):

| Profile | Viewport / DPR | CPU submission ms | Drained frames ms | New resource MiB | Draw calls | Occluders |
|---|---|---|---|---|---|---|
| 16x9 | 1280×720 / 1 | 32.1 | 1598.1/1542.7/1470 | 7.08 | 41 | 32 |
| 16x10-small-ui | 1280×800 / 1 | 50.1 | 1791.1/1635.7/1665.1 | 7.86 | 41 | 32 |
| ultrawide | 3440×1440 / 1 | 50.9 | 5220.7/5289.7/5088.1 | 32.04 | 37 | 32 |
| high-dpr | 1280×720 / 2 | 42.4 | 4252.5/3891.4/3952.7 | 28.17 | 41 | 32 |
| 4k | 3840×2160 / 1 | 50 | 4624.7/4364.5/4534.1 | 32.04 | 41 | 32 |
| reduced | 1280×720 / 1 | 36.3 | 1026.1/919.5/921 | 1.81 | 41 | 32 |
| nv-low-zoom2 | 1280×800 / 1 | 41.4 | 2840.7/2743.9/2747.9 | 7.86 | 29 | 32 |
| nv-high-zoom4-dpr | 1280×720 / 2 | 21.4 | 4302.3/3975.9/3456.1 | 7.08 | 24 | 32 |

**KNOWN LIMITATION: 16.7 ms is not met on SwiftShader.** CPU submission is not completed GPU frame time. Every case preserves the physical mask and all 32 occluders; target cap remains 4,194,304 pixels. The accepted spatial renderer rejects more than 64 solids, eight planes per solid (six footprint vertices), 128 light emitters or 64 lamp-failure records instead of dropping physical occluders or emitters. The retained D view test exercises the 65-solid rejection; the other guard boundaries are recorded from unchanged world_view.js, not claimed as measured maximum-load browser cases. These limits constrain future production map work, which is outside Stage I. The inherited full-quality two-client fall capture can miss airborne motion; existing Reduced detail passes its unchanged assertion. Hardware performance requires human testing.

Flat parent controls: median-of-three candidate/parent ratios 0.9822 (median) and 1.0726 (p99), within the 10%/20% investigation bands. Slow outliers remain in BASELINE_FAILURES. Runtime bytes are identical; no correctness-reducing optimization was made. Existing legacy performance gates retain their thresholds and final dispositions in TEST_SUMMARY.
