# Part 3B performance evidence

HQ2 measurements of the corrected top-down presentation, on the validation host (Node v22.22.2) and software SwiftShader GPU. No hardware FPS, capacity or Part 3G certification is claimed. Host timings are noisier than the P3B4 host; the retained performance suites still pass their unchanged thresholds.

| Production simulation | p50 ms | p95 ms | p99 ms | max ms |
|---|---:|---:|---:|---:|
| 1 players / 1,200 fixed ticks | 0.210 | 0.626 | 2.427 | 905.613 |
| 8 players / 1,200 fixed ticks | 0.319 | 1.740 | 6.936 | 782.629 |

| Completed production render/readback | Drained samples, ms |
|---|---|
| 16x9 | 5624.2, 2930.7, 3079.8 |
| 16x10 | 6497.1, 3711.3, 3766.9 |
| ultrawide | 28245.7, 15469.9, 12836.3 |
| high-dpr | 21028.6, 10697.1, 10389.8 |
| 4k | 24067.2, 12536.5, 12782.4 |
| reduced | 2312.0, 1113.3, 1416.9 |
| nv-low-zoom2 | 6259.9, 2888.3, 3630.5 |
| nv-high-zoom4-dpr | 3808.3, 2250.7, 1859.4 |

GPU completion/readback is included; CPU submission is not presented as frame completion. High-DPR/4K targets are capped at 4,194,304 pixels. The top-down mesh (caps + local strips) is built once at model compile (about 65 ms one-time in Node) and needs no per-frame projection rebuild. All 910 physical occluders stay in conservative candidate batches, and the 288 continuous ceilings are camera-only omissions. No physics, AI, ray or quality-truth threshold was relaxed.

Raw evidence: `dev/part3b/evidence/hq2/whole-03-continuation/performance-production.json`, `dev/part3b/evidence/hq2/whole-03-continuation/browser-matrix/result.json`. P3B4 measurements of the superseded projection remain under `dev/part3b/evidence/p3b4`.
