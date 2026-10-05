Profile `mobile`, scene `dense` (mobile-like: 390×844 at DPR 3, touch, main thread slowed 4×; SwiftShader on 2 vCPUs).

| tree | tier | fps per round | mean fps | vs its OFF | vs the parent | module ms / frame (mean / worst p95) |
|---|---|---|---|---|---|---|
| v23.3.6 parent | parent | 0.90, 0.88, 0.87 | 0.883 | — | +0.0 % | — |
| SH4 (1.0) | OFF | 0.83, 0.90, 0.87 | 0.867 | — | −1.9 % | 0.03 / 0.1 |
| SH4 (1.0) | LOW | 0.82, 0.87, 0.82 | 0.837 | −3.5 % | −5.3 % | 1.10 / 4.5 |
| SH5 (1.1) | OFF | 0.86, 0.87, 0.88 | 0.870 | — | −1.5 % | 0.04 / 0.2 |
| SH5 (1.1) | LOW | 0.82, 0.81, 0.84 | 0.823 | −5.4 % | −6.8 % | 0.71 / 3.6 |
| SH5 (1.1) | MEDIUM | 0.80, 0.82, 0.80 | 0.807 | −7.3 % | −8.7 % | 1.25 / 3.7 |
| SH5 (1.1) | HIGH | 0.80, 0.82, 0.79 | 0.803 | −7.7 % | −9.1 % | 1.23 / 5.1 |
