# Trial 3 R19 - the combined QA branch: performance

Trial 3 is **not owner-approved**.  `perf_pr.js --rounds 5 --secs 60` (the 60 Hz step on the real server simulation: the director's
Hounds and Smilers, eight scripted players, Skin-Stealers added the admin's way), both orders, beside the A/A control (R18 against
itself); this session's two-CPU machine, nothing else running.  `evidence/perf/` (the A/A record is the same file as the tracks').

| scene | A/A: R18 -> R18 | R18 -> combined | combined -> R18 | the combined tree's own figures, worst of both orders: mean / p95 / p99 |
|---|---|---|---|---|
| no Skin-Stealer | 0.129 -> 0.139 (+7.7 %) | 0.136 -> 0.126 (-7.6 %) | 0.127 -> 0.124 | 0.127 / 0.223 / 0.88 |
| one | 0.147 -> 0.151 (+2.4 %) | 0.143 -> 0.143 (-0.1 %) | 0.149 -> 0.141 | 0.149 / 0.264 / 1.38 |
| four | 0.241 -> 0.250 (+3.5 %) | 0.223 -> 0.236 (+6.1 %) | 0.235 -> 0.215 (R18 -8.5 %) | 0.236 / 0.453 / 2.62 |
| four, every player pressing one | 0.251 -> 0.263 (+4.5 %) | 0.243 -> 0.258 (+6.4 %) | 0.255 -> 0.239 (R18 -6.3 %) | 0.258 / 0.493 / 2.97 |
| four starving, players wandering | 0.202 -> 0.210 (+3.8 %) | 0.195 -> 0.196 (+0.5 %) | 0.199 -> 0.196 | 0.199 / 0.384 / 1.47 |
| the tool's verdict | PASS | PASS | PASS | |

Within the 60 Hz budget everywhere (the combined tree's worst mean 0.258 ms, worst p99 2.97 ms); with four Skin-Stealers the combined
tree costs 6-9 % more than R18 in both orders (+0.01-0.02 ms a step) - the S track's reckonings (`dev/trial-3-r19-positioning/
PERFORMANCE.md`); the N track's cornering costs nothing measurable (`dev/trial-3-nani-corners/PERFORMANCE.md`).  One combined-slot round
had a 41.6 ms worst step (four starving, round 1); R18's slot had 22.7 and 25.4 ms ones in the same runs - the machine pausing a process,
not a step of the game (the same seed each round; that scene's other rounds 8.4-9.3 ms).
