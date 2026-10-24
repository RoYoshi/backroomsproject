# Trial 3 R20 - the combined tree: performance

Trial 3 is **not owner-approved**.

**The method.**  `dev/trial-3-predator-refinement/tools/perf_pr.js --rounds 5 --secs 60`, as at R19.
- It times the 60 Hz step on the real server simulation: the director's Hounds and Smilers, scripted players, and Skin-Stealers added the
  admin's way.
- It ran at **8 and 4 players**, in **both orders** (each tree as the tool's base and as its "refinement"), beside the **A/A control**
  (R19 combined against itself).
- This session's two-CPU machine had nothing else running.
- The raw records are `evidence/perf/*_5x60.*`.  The `_p4` / `_p8` files without `_5x60` are an earlier, shorter run (3 × 20 s).

Mean step in ms, for R19 combined → R20 combined; "R19 base" means R19 in the tool's base slot:

| scene | players | A/A: R19 → R19 | R19 base → R20 | R20 base → R19 | R20's worst p99 |
|---|---|---|---|---|---|
| no Skin-Stealer | 8 | .134 → .138 (+2.8 %) | .147 → .158 (+7.3 %, within tolerance: SAME COST) | .168 → .155 | — |
| one | 8 | .152 → .165 (+8.5 %) | .164 → .167 (+1.8 %) | .169 → .179 | 1.55 |
| four | 8 | .268 → .253 (−5.7 %) | .265 → .255 (−3.9 %) | .279 → .257 | 3.03 |
| four, every player pressing one | 8 | .282 → .275 (−2.5 %) | .293 → .282 (−3.7 %) | .305 → .320 | 3.22 |
| four starving, players wandering | 8 | .206 → .220 (**+7.2 %, p99 +41 %: the tool's FAIL on R19 against itself**) | .224 → .265 (**+18.5 %, p99 +72 %**: FAIL against the base) | .264 → .227 (R20 **−14 %**) | 3.30 |
| no Skin-Stealer | 4 | .124 → .117 | .125 → .117 | .115 → .121 | — |
| one | 4 | .138 → .149 | .144 → .143 | .155 → .152 | 1.28 |
| four | 4 | .195 → .206 | .197 → .221 (+12.4 %) | .214 → .200 | 2.46 |
| four, every player pressing one | 4 | .211 → .207 | .193 → .206 | .204 → .202 | 1.69 |
| four starving, players wandering | 4 | .219 → .205 | .202 → .196 | .208 → .182 | 1.87 |

**Reading it.**
- **Within the 60 Hz budget everywhere.**  R20's worst mean is .320 ms of the 16.7 ms frame; its worst p99 is 3.3 ms.
- **The tool's two FAIL verdicts are both in one scene**, eight players with four starving Skin-Stealers:
  - **One of the two is the A/A control itself:** R19 against itself, +41 % p99.
  - **The two orders disagree:** +18.5 % with R19 in the base slot, −14 % with R20 there.
  - So the difference there is within this machine's order and slot variability, not a measured cost of R20.  Nothing here shows R20
    cheaper either.
- **Single worst steps** of 15-22 ms appeared in the starving scene, in both slots; the R19 slot had 9-19 ms ones in the same runs.  That
  is the machine pausing a process, not a step of the game.  R19's own report had 41.6 ms pauses.
- **The snapshot's entity part** is +1 to +4 bytes per step with Skin-Stealers.  Its head angle (`h`, already sent at R19) is turned
  more often now, so it is written with more digits.  Without a Skin-Stealer it is the same size.  A Skin-Stealer kill's replay message
  carries one more number, `e`, once per death.
