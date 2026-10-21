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
