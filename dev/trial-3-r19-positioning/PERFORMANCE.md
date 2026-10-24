# Trial 3 R19, S track - performance

Trial 3 is **not owner-approved**.  Server cost, measured on the real server simulation (`perf_pr.js` of the predator refinement: the
tree's own harness, the director's Hounds and Smilers, eight scripted players, Skin-Stealers added the admin's way; each run its own
process; the 60 Hz step timed), this session's two-CPU machine, nothing else running.  Every comparison runs **in both orders** - each
tree once in the tool's base slot - and beside an **A/A control** (R18 against R18), because the second slot alone reads up to 8 % slower
with nothing changed.  `evidence/S3/perf/`.

## The 60 Hz step, R18 against S (`perf_pr.js --rounds 5 --secs 60`; medians of the rounds, ms)

| scene | A/A: R18 -> R18 | R18 -> S (R18 in the base slot) | S -> R18 (S in the base slot) | S's own figures, worst of both orders: mean / p95 / p99 |
|---|---|---|---|---|
| no Skin-Stealer | 0.129 -> 0.139 (+7.7 %) | 0.122 -> 0.125 (+2.0 %) | 0.128 -> 0.124 | 0.128 / 0.212 / 1.04 |
| one | 0.147 -> 0.151 (+2.4 %) | 0.149 -> 0.139 (-6.9 %) | 0.131 -> 0.148 (R18 +12 %) | 0.139 / 0.242 / 1.07 |
| four | 0.241 -> 0.250 (+3.5 %) | 0.228 -> 0.220 (-3.1 %) | 0.221 -> 0.217 | 0.221 / 0.429 / 2.08 |
| four, every player pressing one | 0.251 -> 0.263 (+4.5 %) | 0.229 -> 0.253 (+10.5 %) | 0.249 -> 0.236 (R18 -5.3 %) | 0.253 / 0.468 / 2.64 |
| four starving, players wandering | 0.202 -> 0.210 (+3.8 %) | 0.193 -> 0.203 (+4.8 %) | 0.191 -> 0.191 | 0.203 / 0.388 / 1.73 |
| the tool's verdict | PASS | PASS | PASS | |

The 60 Hz budget (the tool's: mean at most 5 % of the 16.7 ms step, p99 at most 25 %) holds in every scene, both orders: S's worst mean
0.253 ms (1.5 % of the step), worst p99 2.64 ms.  The one signal both orders agree on is the pressing scene: S costs about 5-10 % more
there (+0.01-0.02 ms a step) - four creatures each weighing a way round, its reckoning and the contest's sight line at every re-route -
within the A/A's own spread elsewhere.  A 3-round run in each order (`perf_pr_R18_vs_S.txt`, `perf_pr_S_vs_R18.txt`) agrees: +6-11 %
with R18 in the base slot, +6 % with S in it, the starving scene equal, the scene without a Skin-Stealer (where S's code never runs)
+5 % / -4 % - the order effect.

One round's worst step stands out: 99.7 ms in "one", round 1 of 5, S in the second slot.  Not S's code: each round replays the same
seed (the same kills, 9 in each round), and the other four rounds of the same scene had worst steps of 6.5-8.0 ms; that round's whole
run was slow (mean 0.209 ms against 0.13-0.14 ms in the others) - the machine paused the process.  R18's slot shows the same kind of
outliers in these runs (22.7 and 25.4 ms in the combined tree's comparison).

## The Skin-Stealer's own counts (`perf_r16.js --rounds 3`, R18 -> S, medians)

| | one Skin-Stealer | four starving |
|---|---|---|
| step mean | 0.149 -> 0.148 ms | 0.203 -> 0.200 ms |
| its thinking | 0.59 -> 0.53 ms a second of game | 3.12 -> 3.34 ms a second (+7 %) |
| its lines of sight | 0 -> 0 a second | 19.0 -> 22.2 a second (the contest's sight line along its way) |
| route searches | 0.07 -> 0.07 a second | 0.40 -> 0.40 a second |
| the snapshot's entity part | 786 = 786 bytes | 990 = 990 bytes |

No new per-tick search: the worth of a way round is reckoned only when the weighing has already picked one (its spot search is R7's, as
before), the contest at most once per re-route (1.5 s) on a think, and the refusal memo removes repeated searches.
