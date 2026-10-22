# Trial 3 cognitive predator refinement — performance

The server's cost against R8 (`git archive f378049`, the base of every comparison), measured by R8's own tool
(`dev/trial-3-predator-refinement/tools/perf_pr.js`: the real sim, the director's Hounds and Smilers, eight scripted players, 60 s timed
after a warm-up, every 60 Hz `sim.step` timed) in rounds that interleave the two builds, each run in its own process. Five pairs: no
Skin-Stealer (0), one (1), four (4), four with every player pressing one (4p), four starving with the players wandering (4h). The 60 Hz
budget: mean at most 5 % of 16.7 ms, p99 at most 25 %; **the fixed sub-budget the pack names is 4.175 ms for p99** - R8 itself breaks it
now and then, and every run that does is listed here, on either build. Raw lines: `evidence/c6_perf.txt`, `c6_perf_run2.txt`,
`c7b_perf.txt`, `c7b_perf_run2.txt`, `c8_perf.txt` (and their `.json`).

## The matrices (medians of three rounds; ms)

| Matrix | Pair | R8 mean (p99) | this build mean (p99) | Tool's verdict |
|---|---|---|---|---|
| C6 run 1 | 0 | 0.185 (—) | 0.200 (—) | the same code: +8 %, within the tolerance (the noise) |
| | 1 | 0.217 (2.35) | 0.212 (1.95) | within budget |
| | 4 | 0.327 (3.64) | 0.310 (3.81) | within budget |
| | 4p | 0.337 (4.36) | 0.286 (3.55) | no worse than R8 |
| | 4h | 0.311 (4.14) | 0.318 (3.75) | no worse than R8 |
| C6 run 2 (repeated for run 1's red run) | 0 | 0.178 | 0.180 | the same |
| | 1 | 0.193 (1.25) | 0.196 (**1.98, +59 %**) | within budget (judged on the budget only, as the tool does for one) |
| | 4 | 0.290 (3.46) | 0.242 (1.98) | within budget |
| | 4p | 0.283 (2.88) | 0.256 (3.14) | no worse than R8 |
| | 4h | 0.285 (3.60) | 0.270 (2.87) | no worse than R8 |
| C7b (the fixed build) | 0 | 0.169 | 0.187 | the same code: +11 %, within the tolerance |
| | 1 | 0.201 (1.24) | 0.208 (1.93) | within budget |
| | 4 | 0.286 (3.42) | 0.257 (3.09) | within budget |
| | 4p | 0.279 (2.50) | 0.291 (**3.83, +53 %**) | no worse than R8 - by the tool's tolerance (R8's spread across rounds), i.e. borderline |
| | 4h | 0.280 (4.21) | 0.275 (2.87) | no worse than R8 |
| C7b run 2 (repeated for the borderline pair) | 0 | 0.175 | 0.190 | the same |
| | 1 | 0.199 (1.94) | 0.214 (2.53) | within budget |
| | 4 | 0.307 (4.16) | 0.267 (2.61) | within budget |
| | 4p | 0.294 (3.22) | 0.295 (3.66, +14 %) | no worse than R8 |
| | 4h | 0.300 (4.19) | 0.276 (3.75) | no worse than R8 |
| C8 (the final code, C7c) | 0 | 0.193 | 0.172 | the same |
| | 1 | 0.195 (1.22) | 0.201 (**1.84, +50 %**) | within budget |
| | 4 | 0.312 (2.97) | 0.258 (2.55) | within budget |
| | 4p | 0.309 (3.76) | 0.301 (3.20) | no worse than R8 |
| | 4h | 0.289 (3.34) | 0.275 (3.10) | no worse than R8 |

Every matrix: **PASS, 0 violations** (each Skin-Stealer checked once a second: a place in the level, its records bounded, its quarry in
the game).

## Every red run (p99 over 4.175 ms)

| Matrix | R8 | this build |
|---|---|---|
| C6 run 1 | four: 4.26 (4, round 1), 4.36 (4p, round 1), 4.59 (4p, round 3), 4.20 (4h, round 3) | two: **6.06 (4h, round 2; mean 0.429)**, 4.28 (4, round 2) |
| C6 run 2 | none (highest 4.02) | none (highest 3.15) |
| C7b | three: 4.31 (4, round 1), 4.21 (4h, round 1), 4.24 (4h, round 3) | one: 4.25 (4p, round 1) |
| C7b run 2 | three: 4.27 (4h, round 1), 4.29 (4, round 2), 4.19 (4h, round 2) | two: 4.29 (4p, round 1), 4.23 (4h, round 2) |
| C8 | two: 4.26 (4, round 1), 4.29 (4h, round 2) | none |

## The soak, and the stress of the new tactics

* `perf_pr.js --soak 600` (four starving, eight players wandering): C6 mean 0.164 ms, p99 1.03, worst 14.8 ms; C7b mean 0.158 ms, p99 0.83, worst 12.9 ms; C8 mean 0.152 ms, p99 0.84, worst
  12.4 ms; 0 violations
  each. **Its limit (the review's F10):** wandering players meet few stand-offs or cut-offs, so the soak says little about them.
* **C14** is the stress evidence for the new tactics: four of them, eight people (watchers who look away, a circler, two together, a
  runner, walkers), 90 s - what it keeps of each person bounded (sightings at most 71 of 102), route searches 0.19 per creature per second,
  p95 0.75, the busiest second 1.75; PR24 (R8's count) passes; the review's 24 "visible but no straight line" pairs: the worst second 2
  searches (R8 2).

## Assessment

**Means:** the same as R8 within the noise in every pair, in every matrix (at most +7 % with Skin-Stealers, often lower); against the
absolute budget the means are 1.5–2.6 % of a frame. **p99:** two pairs were higher on this build in most of the five matrices, their
means unchanged - **one creature** in four of five (+59, +56, +30, +50 %; −17 % in the other; 1.8–2.5 ms against R8's 1.2–1.9) and
**four with every player pressing one** in three of five (+9, +53, +14 %; −19, −15 %); four, and four starving, were lower in most. Every matrix passed the tool, and the borderline one was
repeated and passed; still, this is a tendency, not noise, and it is stated rather than averaged away. *Hypothesis, not measured per
function:* the new tactics' occasional heavier thinks - a bait's ambush check (up to 32 spots × 18 sight lines), a stand-off's vantage
search (36 spots) - add tail, not mean. **Red runs** (p99 over 4.175 ms): R8 12 across the five matrices, this build 5 - single runs on both,
no pair persistently over the sub-budget on either; R8 does not meet the sub-budget either. Not a blocker by the pack's rule (a persistent
significant increase): the means are the same and the tails stay inside the 60 Hz budget; the owner should still know where to look.
