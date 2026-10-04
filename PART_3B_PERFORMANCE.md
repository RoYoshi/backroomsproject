# Part 3B performance evidence

Bounded measurements on the recorded host and software SwiftShader GPU. No hardware FPS, capacity or Part 3G certification is claimed. The seven retained named suites include their unchanged performance/portability assertions.

| Production simulation | p50 ms | p95 ms | p99 ms | max ms |
|---|---:|---:|---:|---:|
| 1 players / 1,200 fixed ticks | 0.173 | 0.393 | 0.860 | 628.324 |
| 8 players / 1,200 fixed ticks | 0.228 | 1.147 | 5.382 | 662.192 |

| Completed production render/readback | Drained samples, ms |
|---|---|
| 16x9 | 3452.6, 1680.4, 1808.9 |
| 16x10 | 3997.1, 1813.8, 2032.4 |
| ultrawide | 18972.5, 8669.2, 8969.5 |
| high-dpr | 12689.5, 7471.2, 6935.0 |
| 4k | 15841.8, 7916.3, 7554.2 |
| reduced | 1099.6, 443.9, 640.5 |
| nv-low-zoom2 | 3546.8, 1674.5, 1864.0 |
| nv-high-zoom4-dpr | 2172.7, 1056.4, 1285.9 |

GPU completion/readback is included; CPU submission is not presented as frame completion. High-DPR/4K targets are capped at 4,194,304 pixels. Geometry contains all 910 physical occluders, with conservative candidate batches; 288 continuous ceilings are camera-only omissions. CPU cold-start/navigation stalls and accepted aftermath limits remain relevant. No physics, AI, ray or quality-truth threshold was relaxed.

Raw production CPU and GPU evidence: `dev/part3b/evidence/p3b4/whole-03/performance-production.json`, `dev/part3b/evidence/p3b4/whole-02/browser-matrix/result.json`. Parent measurements remain in `PART_3A_PERFORMANCE.md`; run-to-run timings are host-dependent.
