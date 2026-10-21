# Trial 3 cognitive predator refinement — balance table

**Every value here is UNAPPROVED.** The owner decides after playing. Values live in `SK` in
`src/frameworks/nani/server/ai.skinstealer.js`, one name each; the baseline is R8 (`f378049`), the build the owner rejected. Each
checkpoint adds the values it built and what was measured. The fairness laws (speeds, stamina, the wind-up, contact, sight and hearing
rules, the fresh runner's win, admin-only, cap 4) are not in this table because none of them changed.

## C1 — what changed, and what interrupts a plan

| Knob | R8 | Built (C1) | Why (the R8 moment it answers) |
|---|---|---|---|
| `SK.lureHungry` | the bait's wait was `SK.lure` 4 + 12 × hunger × PATIENCE s (9–10 s at .65–.75) at every hunger | from `SK.band[1]` (.4) up: 2.5 .. 4.5 s (by PATIENCE), then it looks again (a listen, a peek round the corner when nobody came and it still believes them there); below .4 the old wait | BD1, BD5: 10 s waiting blind round a corner for a person who just stood there |
| bait interrupt | none: the wait ran out; at its end a departure unless very hungry | heard going away (what it hears of the person it waits for 90 px and more farther off than the nearest it heard of them) → its hunt's next step at once; at the end of the wait, from hungry (R8: very hungry) a hunt that still has confidence goes on (its next guess), and with no hunt it looks round the corner (a search) while it still believes them there | BD1: a wait that only a timer could end, then a departure |
| `SK.reHunger`, `SK.reDwell`, `SK.reGap` | a departure thought over only at ≥ .6, after 4 s, once a second | from .45: after 3 .. 1.2 s (hungry .. starving), at most every 0.5 s; under `SK.band[2]` (.6) only for somebody it sees **not** watching it (an opening), at .6 and up for anybody it may hunt | BD1–BD3: departures of 20–35 s, walked to the end while an unaware person stood in view |
| `SK.openBeat` | an opening went through the rethink hysteresis (`SK.rethink`) like any flicker | a watcher who looks away is acted on after a beat of .35 .. .12 s (mildly hungry .. starving), past the hysteresis, toward approach or chase only | the owner's "fast thinking and responsive" |
| `SK.heardTurn`, `SK.heardNear` | a sound-listen turned at 2.2 rad/s | a sound within 350 px: 3.6 rad/s (R8 already turns at up to 4 rad/s elsewhere: the default of `faceToward`); a listen ends as soon as the sound it waits for (a later sound that fits) comes, not when its time is up | BD7: a close circler faced only after 2.2 s |
| `SK.trackHead`, `SK.trackTurn` | frozen (R3, somebody unaware turning its way) it kept its old facing — and lost from view the person it froze for | its head follows them up to 0.8 rad at once; past that its body turns at 1.6 rad/s; its head comes round to its leap when it springs | C01: faced only 0.83–1.3 s after the sighting in 5 of 7 seeds |
| `SK.aimLead` | approaching, it re-aimed every 1.5 s (chasing every 0.5 s) at where the person had been | somebody in sight is re-aimed at on every think, by a straight line only (no route searched): where their seen motion takes them in the time it needs to get there, at most 0.6 s ahead (0 on a lost race's trail, so a lead won stays won); when no straight line is clear, R8's routing as before | `c0_audit` O: running circles 170 px round it, it ran on to where they had been and was faced away from them (orient up to 3.8 s) |
| a twitch is not an opening | its choices took the watcher's eyes tick by tick: a tenth of a second's glance away flipped approach ↔ flank / retreat (3 of 12 runs, C04 c) | a look away shorter than its beat (`SK.openBeat`) changes no plan (the plan under way is kept); once it lasts the beat it is an opening | C04 (c): noise is not an interrupt |
| `SK.cogLog` | — | at most 24 decisions kept in its QA record (`e.cog`: when, what changed, what it chose); never sent to players | the pack's "evidence-driven", for review |

C1 measured (`CHECKPOINTS.md` C1, `evidence/c1_*`): see the checkpoint. What C1 alone does **not** change: being watched at .45–.65 still
scores retreat and leave above coming on — that is C2.

## C2 — the choice: a stand-off with a purpose, whom to go for, a bait that is an ambush

| Knob | R8 | Built (C2) | Why (the R8 moment it answers) |
|---|---|---|---|
| the stand-off (`stand`, new answer) | watched while hungry: retreat 1.29 / leave 1.04 / watch .88 / flank .82 / approach .08 (BD1) | from .4 hunger, when somebody it sees is looking at it (or two people are together): weight `.7 + .9 hm − .35 hs` (`hm` = smoothstep(.3, .6, hunger), `hs` = smoothstep(.55, .95, hunger)); `− .5` for a bait-minded hunt at ≥ .6 (it baits first); × .75 once a stand-off on this hunt ran out with no ground gained | BD1, BD5, BD6: backing out of sight, a blind wait, a departure |
| `SK.standVantage`, `standLamp`, `standWalkOff` | — | it may first walk (straight, no route searched) 80 / 150 / 220 px to a spot at least .12 darker that still has them in view at about the same distance, no more than 1.6 rad off its line to them (it walks forward only; its head keeps them in view) | BD2: "seen in the light" made it leave |
| `SK.openRush`, the beat | — | nobody it sees looking at it for a beat (`SK.openBeat`, C1): it closes in at 90 .. 170 px/s (its stalk .. its flank speed; no new speed), under cover; their eyes back: it freezes | the owner's "fast thinking and responsive" |
| `SK.pressFrom` | — | very hungry (.6 .. .9): it creeps closer under their eyes too, at up to its creep speed (62 px/s), no closer than 160 px (its spring decides from there) | very hungry is committed (pack 04) |
| `SK.standFor` | — | 3.5 .. 8 s (× PATIENCE; × 1.1 .. .7 from mildly hungry to starving); half as long again when it gained ground in it; when the only other answer is leaving and it is alone with them, hungry, its effort budget not 85 % spent: a new stand-off from another dark spot no brighter (it shifts its ground) | a watcher holds it off without a timer killing them (SK16, the encounter budget, still ends it) |
| `SK.apart`, `SK.groupMem`, approach in company | `seen[0]` (the nearest) only; `leave + .7` per extra person; approach × .35 | a person with nobody else it has seen within 450 px of them in the last 4 s is apart; people together are never come at (approach × 0) and get a stand-off from the dark, then a departure; one apart from the others may be come at (approach × .5) | BD3: two people → leave in 0.02–0.42 s; the unaware one apart never considered |
| `SK.switchGain`, the choice of whom | the nearest | its hunt's person while it sees them, unless somebody else it sees is 1.5 × the better chance: `(watching it ? .45 : 1) × (apart ? 1 : .7) / (1 + distance / 600)` | BD3; pack 04: one quarry at a time, no thrash |
| leave | `(crowd − 1) × .7`; `.5 × (1 − hs)` when lit and watched | `(crowd − 1) × .7 × (1 − .6 hm)`; `.5 × (1 − hm)` | BD2: lit and watched is a reason to be careful, not to go, from hungry up |
| watch / retreat | watch `.62 / .22 + …`; retreat `.45 + .6 h + …` when watched | watch × (1 − .8 hm); retreat (out of sight) × (1 − .8 hm) — as a bait (bait-minded hunt, ≥ .6) unchanged | BD1 |
| chase | only from .6 (very hungry) | from .4: `(.55 + .9 h + … ) × hm` below .6 (the same chase: its run 255 px/s against a fresh 285, `SK.chaseMax` 7 s, `SK.chaseLose` 140 px, a lost race below .6 a departure) | `c0_audit` X at .5 after C1, C at .55: a runner close by was "decided against" |
| `SK.baitAmb`, `SK.noBaitFor` | a bait spot: out of their sight, the nearest (some seen from 500 px off when followed) | a bait only where somebody following - to where it was, then toward it - first sees its spot from 200 px or less (18 sight samples); with none it takes its next answer at once and does not look again within 200 px for 10 s; it waits on the spot itself (arrival 14 px, R8 40) | C08; BD1: "the bait spot is scored for being out of sight, never for whether somebody following would come within its reach" |
| random draws | one per answer per decision | the same draws in the same order as R8 (the stand-off reuses the watch's), so adding an answer moves no other random choice | keeps every R8 seed comparable |

What C2 does **not** change: speeds, stamina, the wind-up and its contact, the sight and hearing rules, the fresh runner's win (PR27), carried
effort (PR28), admin-only, cap 4. A watcher who keeps it in sight and never looks away is still not killed below .6 (C02: 0 / 12; SK16); one it gets beside unseen,
from the dark, by going round them, can be (`c0_audit` W at .5 and .55: one run each, a spring from its flank with its whole wind-up).
