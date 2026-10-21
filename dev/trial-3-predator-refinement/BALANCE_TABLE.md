# Trial 3 predator refinement — balance table

**Every value here is UNAPPROVED.** The owner decides after playing. Values live in `SK` in `ai.skinstealer.js` (and the page script's
one body scale), one name each. This file is written at R0 with the baseline and the direction of each change; each checkpoint fills in
the value it built and what was measured.

| Knob | Baseline (`4518f93`) | Direction (R0) | Built (R1) |
|---|---|---|---|
| `SK.band` | .2 / .4 / .6 / .8 | kept as labels; the decisions use smooth functions of hunger | as labels; `skDecide` uses `hm` = smoothstep(.3, .6, hunger) and `hs` = smoothstep(.55, .95, hunger) |
| `SK.budgetEnc` | 25 + 45 × hunger s per person | longer with hunger, carried across departures (no reset by leaving and coming back) | `[30, 90]`: 30 + 90 × hunger s per person (115.5 s at .95); spent effort carried across departures, halving every `SK.carryHalf` = 90 s |
| no-evidence limit | none (plans time out instead) | a hunt's confidence falls without evidence; it gives up when it is gone (longer when hungrier) | `SK.forget` = 8 .. 24 s (× .85–1.15 with PERSISTENCE) without evidence; given up under `SK.huntLow` = .15 confidence; `SK.huntTries` = 3 searches per hunt |
| eye contact (`skDecide`) | watched and ≥ .4 hungry: back off (1.18 at .95) beats approaching (0.44) | a flank to cover at middle hunger; an open approach or a flank at starvation; backing off mostly at low hunger | watched: leave `.5 × (1 − hs)` in light; flank `.35 + hm × (1 − .5 hs) + .25 INT ± (.4 / −.45 by the hunt's drawn style)`, at most `SK.flankMax` = 3 per hunt, `SK.flankDur` 8 s, spot ≥ `SK.flankMin` 220 px from them, speed `flank` 170; approach `(.15 + 1.1 hs + .45 hm if flanks and bait failed) × …`; retreat `× (1 − .6 hs)`. Unaware: approach `+ .3 hm (1 − hs)` (goes in light from about .5). P(flank style) = .3 .. .75 over hunger .4 .. .8 |
| `SK.chaseMax`, `SK.chaseLose` | 7 s, 140 px | kept (a fresh runner still wins); after a lost race a hungry one keeps to the trail at its walk instead of leaving | unchanged (7 s, 140 px); a lost race at ≥ .6 → shadowing at ≤ 200 px/s (`SK.runFrom`), no new chase for `SK.chaseRest` = 10 s |
| `SK.cooldown`, `cooldownStarving` | 30–60 s; 12 s | kept for lower hunger; a starving one may take up fresh evidence of a person it left, within the carried budget | unchanged; at starving a person it left may be taken up on fresh sight after `SK.leftFresh` = 4 s within the carried effort (< 85 % of the budget) |
| `SK.leaveDwell` | 4 s, fresh sight only | revisited with the hunt (heard evidence counts) | unchanged in R1 (the B2 rethink); a failed bait at ≥ .6 continues the hunt |
| `SK.searchMax` | 16 s | bounded searches that listen and follow consistent sounds; several in one hunt while confidence lasts | unchanged per search; after losing sight it listens `SK.listenLost` = .6 .. 1.6 s (shorter when starving), then searches where it believes them, up to 3 times |
| `SK.predictLook`, `predictTurns` | 1500 px, 2 turns | kept for the main guess; one alternative branch; failed places remembered within the encounter | unchanged in R1 (R2) |
| `SK.pounceRange`, strike numbers | 55–185 px, wind-up .22 s | unchanged | unchanged |
| speeds (`SKIN.speeds`) | run 255 (a fresh sprint is 285) | unchanged | unchanged; new `flank` 170 (under a person's walk 172) |
| body drawing scale | 1 (no factor) | about 1.3 (pack: 1.2–1.35), the collider unchanged | (R5) |

R1 measured (8 seeds; `evidence/r1_repro.txt`, `CHECKPOINTS.md` R1): watched at .75 it no longer leaves within 45 s (0 / 8, R0 8 / 8); a person who
only stands and stares is killed at .75 and above; an unaware person in light is hunted from .5 (R0: left at .5); a fresh runner still wins
every race. Whether this is too much — above all a .75 one coming on to a still watcher — is for the owner to judge in Human QA.
