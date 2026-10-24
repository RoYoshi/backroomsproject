# Trial 3 R19, N track - performance

Trial 3 is **not owner-approved**.  Server cost on the real server simulation (`perf_pr.js` of the predator refinement: the tree's own
harness, the director's Hounds and Smilers, eight scripted players, Skin-Stealers added the admin's way; each run its own process; the
60 Hz step timed), this session's two-CPU machine, nothing else running, **both orders** and beside an **A/A control** (R18 against
itself: the second slot alone reads up to 8 % slower).  `evidence/N2/perf/`.

## The 60 Hz step, R18 against N (`perf_pr.js --rounds 5 --secs 60`; medians of the rounds, ms)

| scene | A/A: R18 -> R18 | R18 -> N (R18 in the base slot) | N -> R18 (N in the base slot) | N's own figures, worst of both orders: mean / p95 / p99 |
|---|---|---|---|---|
| no Skin-Stealer (Hounds and Smilers only) | 0.129 -> 0.139 (+7.7 %) | 0.138 -> 0.138 (-0.1 %) | 0.131 -> 0.129 | 0.138 / 0.247 / 1.31 |
| one | 0.147 -> 0.151 (+2.4 %) | 0.152 -> 0.150 (-1.6 %) | 0.156 -> 0.146 | 0.156 / 0.282 / 1.58 |
| four | 0.241 -> 0.250 (+3.5 %) | 0.241 -> 0.237 (-1.5 %) | 0.248 -> 0.244 | 0.248 / 0.500 / 2.84 |
| four, every player pressing one | 0.251 -> 0.263 (+4.5 %) | 0.263 -> 0.261 (-0.9 %) | 0.233 -> 0.246 (R18 +5.3 %) | 0.261 / 0.483 / 2.65 |
| four starving, players wandering | 0.202 -> 0.210 (+3.8 %) | 0.203 -> 0.204 (+0.4 %) | 0.200 -> 0.201 | 0.204 / 0.382 / 2.17 |
| the tool's verdict | PASS | PASS | PASS | |

The same cost as R18 in every scene, within the A/A's spread in both orders; the 60 Hz budget (mean at most 5 % of 16.7 ms, p99 at most
25 %) holds everywhere: N's worst mean 0.261 ms, worst p99 2.84 ms.  The hunk's own cost is an angle test per follow call and, only when
the aim swings back over 57 degrees, a few more tests, at most one line check and one re-entry (guarded).

## Counts (`perf_r16.js --rounds 3`, R18 -> N, medians)

| | one Skin-Stealer | four starving |
|---|---|---|
| step mean | 0.139 -> 0.147 ms | 0.197 -> 0.192 ms |
| route searches | 0.07 -> 0.07 a second | 0.40 -> 0.40 a second |
| lines of sight | 0 -> 0 a second | 19.0 -> 19.0 a second |
| the snapshot's entity part | 786 = 786 bytes | 990 = 990 bytes |
