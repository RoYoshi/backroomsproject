# Trial 3 predator refinement — balance table

**Every value here is UNAPPROVED.** The owner decides after playing. Values live in `SK` in `ai.skinstealer.js` (and the page script's
one body scale), one name each. This file is written at R0 with the baseline and the direction of each change; each checkpoint fills in
the value it built and what was measured.

| Knob | Baseline (`4518f93`) | Direction (R0) |
|---|---|---|
| `SK.band` | .2 / .4 / .6 / .8 | kept as labels; the decisions use smooth functions of hunger |
| `SK.budgetEnc` | 25 + 45 × hunger s per person | longer with hunger, carried across departures (no reset by leaving and coming back) |
| no-evidence limit | none (plans time out instead) | a hunt's confidence falls without evidence; it gives up when it is gone (longer when hungrier) |
| eye contact (`skDecide`) | watched and ≥ .4 hungry: back off (1.18 at .95) beats approaching (0.44) | a flank to cover at middle hunger; an open approach or a flank at starvation; backing off mostly at low hunger |
| `SK.chaseMax`, `SK.chaseLose` | 7 s, 140 px | kept (a fresh runner still wins); after a lost race a hungry one keeps to the trail at its walk instead of leaving |
| `SK.cooldown`, `cooldownStarving` | 30–60 s; 12 s | kept for lower hunger; a starving one may take up fresh evidence of a person it left, within the carried budget |
| `SK.leaveDwell` | 4 s, fresh sight only | revisited with the hunt (heard evidence counts) |
| `SK.searchMax` | 16 s | bounded searches that listen and follow consistent sounds; several in one hunt while confidence lasts |
| `SK.predictLook`, `predictTurns` | 1500 px, 2 turns | kept for the main guess; one alternative branch; failed places remembered within the encounter |
| `SK.pounceRange`, strike numbers | 55–185 px, wind-up .22 s | unchanged |
| speeds (`SKIN.speeds`) | run 255 (a fresh sprint is 285) | unchanged |
| body drawing scale | 1 (no factor) | about 1.3 (pack: 1.2–1.35), the collider unchanged |
