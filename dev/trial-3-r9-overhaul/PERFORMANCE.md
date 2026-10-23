# Trial 3 R9–R17 — performance

**Not owner-approved.** Server cost is measured on the real server simulation (the tree's own `dev/harness.js`: the director's Hounds and
Smilers, Skin-Stealers added the admin's way, eight scripted players), on a shared two-CPU Linux machine with Node 22. Every comparison
is against R8 (`f378049`, a `git archive` of it) and is run **in both orders** - each tree once in the tool's "base" slot - because R9's
A/A run (R8 against itself, `evidence/r9/perf_aa_r8.txt`) showed the second slot up to 15 % slower with nothing changed. Files:
`evidence/r17/perf/` (R16i `a70137e`, the final tree; R16g's runs of the same tools kept beside them) and each checkpoint's `perf*` (R11,
R12, R13).

## The 60 Hz step, R8 against R16i (`perf_pr.js`, 5 rounds of 60 s, interleaved, each run its own process)

| Scene | R8 → R16i (R8 in the base slot) | R16i → R8 (swapped: R16i in the base slot) |
|---|---|---|
| no Skin-Stealer | 0.105 → 0.112 ms mean (+7 %, inside the tool's tolerance): the same cost | R16i 0.113 vs R8 0.106 ms: the same cost |
| one | 0.125 → 0.129 ms (+3 %), p99 1.16 → 1.21 ms | R16i 0.127 vs R8 0.133 ms; p99 1.52 vs 1.08 |
| four | 0.187 → 0.173 ms (-8 %), p99 2.55 → 1.71 ms | R16i 0.173 vs R8 0.183 ms; p99 1.88 vs 2.83 |
| four, every player pressing one | 0.192 → 0.226 ms (**+17.5 %**), p99 2.10 → 2.10 ms | R16i 0.221 vs R8 0.202 ms (**+10 %**); p99 2.27 vs 2.46 |
| four starving, players wandering | 0.174 → 0.193 ms (+11 %), p99 2.27 → 2.47 ms | R16i 0.179 vs R8 0.177 ms; p99 1.33 vs 2.36 |
| the tool's verdict | PASS (no invariant violated) | "FAIL" - in this order the tool judges R8 against R16i: R8's p99 was 51 % and 77 % above R16i's in two scenes (no invariant violated) |

The 60 Hz step has 16.7 ms. Every scene keeps the tool's budget (mean at most 5 % of the step, p99 at most 25 %) in both orders. The one
signal that holds in both orders is the pressing scene - four Skin-Stealers each with a player keeping within 65 px of it, running to
catch up: about **+0.02-0.03 ms a step (+10-17 % mean)**, 0.2 % of the step, as at R16g (+14-15 %, `perf_r8_vs_r16g.*`). It was there at
R11 (+10 %, the mind's exposure test per person in sight) and R13 (+30 %, the cover searches; R13-13); R16d-R16g's share is the footwork
and the head's per-tick work and, on each think, the periphery's sight test for each person moving outside its view. R16i's press adds
one comparison to an open approach's tick. Every other line moves inside the order bias (R9's A/A run: up to 15 %).

## What the step's mean does not show (`perf_r16.js`, 3 rounds, medians, R8 → R16i)

| Count | one Skin-Stealer | four starving |
|---|---|---|
| its own think, ms per second of game | 1.09 → 0.33 | 2.83 → 3.17 (+12 %) |
| route searches per second (their ms per second) | 0.10 → 0.07 (0.071 → 0.009 ms) | 0.43 → 0.50 (0.22 → 0.23 ms) |
| route searches over 1 ms, per second | 0.017 → 0 | 0.03 → 0.07 |
| lines of sight per second, inside its tick | 4.4 → 0 | 17.8 → 22.8 (+28 %: the periphery, the vantage search) |
| garbage collections (their total ms, the worst) | 61 → 61 (55 → 59 ms, 5.7 → 5.6 ms) | 70 → 72 (70 → 68 ms, 6.3 → 6.4 ms) |
| heap growth over the run | 7.9 → 9.3 MB | 12.4 → 9.6 MB |
| the snapshot's entity part | 785 → 786 bytes | 988 → 991 bytes |

With one creature its think fell because, seeded, it spent the run differently (it saw nobody: no line of sight at all); the four starving
ones are the honest comparison - its think +0.3 ms per second of game, a quarter more lines of sight. Route searching (the expensive
part, R13-13) is unchanged. The wire carries 3 bytes more for four creatures (the head angle `h`, since R16e). R16g's run of the same
tool (`perf_r16_counts.*`): four starving think 2.85 → 3.43 ms per second, lines of sight 17.8 → 24.2 - the same picture.

## Response latency (the owner's §4: initiation 50-100 ms, on it 100-200 ms, the body 150-250 ms, the head faster than the body)

| What | Measured | Where |
|---|---|---|
| a sound: its head starts turning | 0.067-0.1 s | `s_skinap` P10 (12 runs, the server's own clock) |
| a sound: its head on it | 0.1-0.183 s | P10 |
| a sound: its body starts (beyond the head's reach) | 0.117-0.233 s | P10 |
| the same on a real page, in snapshot order | its head on the sound 50 ms after it began; its body 100 ms after the head (R16g and R16i alike) | `focused_r16g.txt`, `evidence/r17/browser/focused_r16i.txt` F1 |
| a person newly seen while roaming: its route given up | on the same think (0 s after sight, 0 px walked on) | P03; F3 on a real page |
| sight and loss events answered (R11) | median 0.12 s, 90 % within 0.7 s | `s_skinmind` C14 |
| a person walking across 100 degrees off its way, 420 px: noticed and seen | 0.35-0.8 s | `repro_ap.js` P (R16e-6) |
| a feint (they reverse while circling): it steps the new way | 0.1-0.9 s in the suite (P17; mostly 0.8-0.9 s); on a real page 0.3 s at R16g, 0.45-0.5 s at R16i (F6 alone, twice; the first R16i run sprang at them instead) and 0.45-0.55 s at R16h | P17, F6 |
| a very hungry one, seen 650 px off: within its footwork's range (340 px) | 2.0 s with R16i's press (R16h: 3.9 s, at its stalk) | `press_eval.js` (R16i-4) |

## The page

R14 measured the body's drawing: 55-56 fills and strokes a frame per creature, R8's about 55 (`evidence/r14/draw_cost_r14.txt`). R16e's
drawn snap and R16g's threshold add a comparison per frame. On real pages under SwiftShader the frame rates are 1-6 a second, with or
without a Skin-Stealer (the campaign: 2.9 and 3.2 frames a second on two pages for 12 minutes at R16g, 3.3 and 3.4 at R16i); they say
nothing about a real GPU.
