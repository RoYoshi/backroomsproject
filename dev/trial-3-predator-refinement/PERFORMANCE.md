# Trial 3 predator refinement — performance

Measured at R6 on the server simulation (the cost that matters: the 60 Hz `sim.step`), against the starting commit `4518f93`, with
`tools/perf_pr.js` (made from B1–B5's `perf_br.js`): each run its own process, the director on with the world's own Hounds and Smilers,
8 scripted players, 5 s warm-up, 60 s timed; the ten configurations interleaved round by round, **3 rounds**; medians compared. Node
v22, a 2-core container (`evidence/r6_perf.*`). The page script's cost is a few more points per drawn figure (no new per-frame work beyond
the scale on its container); the browser checks run at the same frame budget as before.

| Configuration | Base `4518f93` mean / p95 / p99 (ms) | This branch mean / p95 / p99 (ms) | Change (mean / p99) | Judged |
|---|---|---|---|---|
| no Skin-Stealer | 0.234 / 0.414 / 1.83 | 0.212 / 0.390 / 1.70 | −9.2 % (tolerance 0.051 ms) | **same cost** (PASS) |
| one, players wandering | 0.265 / 0.505 / 3.39 | 0.237 / 0.462 / 2.08 | −10.5 % / −38.5 % | the 60 Hz budget (mean ≤ 0.835 ms, 5 % of a 16.7 ms tick; p99 ≤ 4.175 ms, 25 %): PASS |
| four, players wandering | 0.342 / 0.653 / 3.65 | 0.340 / 0.711 / 3.98 | −0.4 % / +8.8 % | the 60 Hz budget: PASS |
| four, every player pressing one (B1–B5's worst case) | 0.414 / 0.923 / 4.53 | 0.404 / 0.872 / 4.41 | −2.5 % / −2.6 % | against the base: PASS (both over the p99 part of the budget, as at B4) |
| four **starving**, players wandering (this refinement's worst case: hunts, guesses, sounds taken, flanks all the time) | 0.445 / 0.824 / 4.53 | 0.339 / 0.732 / 4.38 | −23.7 % / −3.3 % | against the base: PASS (both over the p99 part of the budget, like the row above) |

Snapshot entities: the same size (−4 to 0 bytes; the Skin-Stealer's entry has the same fields). Worst single steps: 9–39 ms in both
trees, in every configuration including the one without a Skin-Stealer (garbage collection and the container's scheduler); reported, not
judged. Invariants checked once a second in every run (inside the level's geometry, hunger and stamina in range, earned skins only, at
most 4 failed places and 3 failed turns per hunt, a hunt only of somebody in the game, at most 6 effort records each of somebody in the
game, B1–B5's awareness records): **0 violations** in 30 runs.

**R7** (the independent review's fixes): a one-round check on R7's code (`evidence/r7_perf_check.*`) flagged one configuration — four creatures, every player pressing one: mean +14.2 % against the base in that round (p99 −11.6 %; all other configurations −3 % to −17 %; 0 violations). One round cannot separate that from noise (the base's own mean there moved from 0.414 to 0.367 ms between R6 and that round), so the interleaved 3-round matrix was run again on R7's code, twice (`evidence/r7_perf.*`, `r7_perf_run2.*`):

| Configuration | R7 run 1: base / R7 mean (p99), ms | R7 run 2: base / R7 mean (p99), ms | Judged |
|---|---|---|---|
| no Skin-Stealer | 0.221 / 0.230 (+3.9 %) | 0.220 / 0.210 (−4.5 %) | same cost, both runs |
| one, players wandering | 0.273 (2.68) / 0.245 (2.40) | 0.266 (3.02) / 0.281 (3.68) | the 60 Hz budget: PASS both runs |
| four, players wandering | 0.425 (4.59) / 0.446 (4.49): +5 % / −2 % | 0.385 (3.71) / 0.353 (3.57): −8.3 % / −3.8 % | the 60 Hz budget: **run 1 FAIL** — p99 4.49 ms over the 4.175 ms line, the base 4.59 ms over it in the same rounds; run 2 PASS |
| four, every player pressing one | 0.384 (4.37) / 0.355 (4.21): −7.5 % | 0.406 (4.28) / 0.377 (4.08): −7.1 % | against the base: PASS both runs (the one-round flag was noise) |
| four starving, players wandering | 0.433 (4.61) / 0.345 (4.20): −20.4 % | 0.392 (4.35) / 0.392 (3.61): +0.2 % / −17.1 % p99 | against the base: PASS both runs |

0 invariant violations in all 60 runs. The tool's verdict was FAIL for run 1 (one judgement: the absolute p99 budget with four, which
the base missed too) and PASS for run 2; nothing is erased. With four Skin-Stealers the p99 of a 60-second run sits near that 4.175 ms
line in both trees (3.6–4.6 ms over R6's and R7's runs): garbage collection and the container's scheduler, not this branch. R7 costs
no more than the base.

**Soak** (`evidence/r6_soak.*`): 600 s, 4 starving Skin-Stealers, 8 players wandering, director on: mean 0.185 ms, p99 1.04 ms, worst
30.9 ms; 70 kills by all species, 4 by Skin-Stealers; 0 violations — PASS.

**Route searches under stress** (PR24, `evidence/r7_suites.txt`). Until R7, PR24 counted only the engine's `plan()` calls, and its scene
ran neither a flank-spot search nor a prediction — the independent review's fourth finding. It now counts **every** route the
Skin-Stealer searches inside its own tick (its plans, its flank spots, its predicted ways), in three scenes:

| Scene | Route searches per creature a second: mean / p95 / worst | Exercised |
|---|---|---|
| 8 people moving about, 4 hungry ones in the dark south-west and the hall, 120 s | 0.07 / 0.25 / 0.5 | 7 hunts, 6 kills |
| 4 very hungry ones, each watched from 450 px in the lit hall, the watchers walking off after 20 s, 120 s | 0.08 / 0.25 / 1.25 | 4 hunts, 1 flank and 4 places with no way round, 4 kills |
| a person seen and then lost one of four ways, walking or crouched, 8 × 30 s | 0.20 / 2 / 3 | 7 hunts, 12 guesses, 4 kills |

Failed places, failed turns, effort records and sounds stay within their caps. Guess generation runs only when a step of a hunt ends (at
most 4 route walks for an interception, two without planning); a flank spot (at most two searches) is looked for only when going round
would really be begun (R7).

**Why the starving case is not dearer:** a hunt replaces Trial 3's repeated departures and returns (each a long route) with short
listens and nearby searches; and the creatures kill about as often in both (8 kills per run in each tree). The difference is within what
3 rounds can resolve only roughly (spreads 0.06–0.07 ms); the claim is "no worse", not "faster".
