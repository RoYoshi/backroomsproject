# Trial 3 predator refinement — performance

Measured on the server simulation (the cost that matters: the 60 Hz `sim.step`), against the starting commit `4518f93`, with
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

**Soak** (`evidence/r6_soak.*`): 600 s, 4 starving Skin-Stealers, 8 players wandering, director on: mean 0.185 ms, p99 1.04 ms, worst
30.9 ms; 70 kills by all species, 4 by Skin-Stealers; 0 violations — PASS.

**Route planning under stress** (PR24, `evidence/r6_suites.txt`): 8 people and 4 hungry ones for 120 s: 0.07 route plans per creature a
second on average, 0.25 at the 95th percentile, 0.5 at worst; failed places, turns, effort records and sounds all within their caps.
Guess generation runs only when a step of a hunt ends (at most 4 route plans for an interception, two route walks without planning).

**Why the starving case is not dearer:** a hunt replaces Trial 3's repeated departures and returns (each a long route) with short
listens and nearby searches; and the creatures kill about as often in both (8 kills per run in each tree). The difference is within what
3 rounds can resolve only roughly (spreads 0.06–0.07 ms); the claim is "no worse", not "faster".
