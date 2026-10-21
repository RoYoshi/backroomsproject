# Trial 3 behaviour refinement — balance table

**Every value is PROPOSED, not owner-approved.** They live in `SK` in `ai.skinstealer.js`, one name each, so each can be tuned after the
owner plays. Trial 3's own values (`dev/trial-3-skin-stealer/BALANCE_TABLE.md`) are unchanged by this pass: hunger, stamina, speeds,
vision, the pounce, the hungry grab, the departure (1200–2200 px, at most 45 s), the hunt cooldown (30–60 s; 12 s starving), the
encounter budget.

Status: every value below is built (B1 as proposed plus `pFast` and `rxGap`; B2 as proposed plus blame and the moving-into-its-way rule; B3
as proposed). B5 changed no value; it fixed how the defensive lunge is aimed and three rules (below, *B5*). Every "measured" figure is from
the final code. All remain proposals for the owner's play-testing.

## Awareness (B1)

| Name | Proposed | Meaning |
|---|---|---|
| `awMax` | 4 | awareness records it keeps (the oldest, least pressing goes first) |
| `awTtl` | 30 s | a record nobody has renewed for this long is dropped |
| `awNear` | 200 px | its personal space, while it sees them |
| `pNear` / `capNear` | 0.12 per s / 0.35 | pressure while they are in its space, × closeness (0 at 200 px, 1 at 90 px), × 1.3 coming at it or × 0.4 going away (by their own motion); presence alone never goes beyond 0.35 |
| `pFast` | 1.6 | × up to this much for fast motion close by (their speed relative to it, 100–300 px/s): somebody running round it is noticed sooner. *Added at B1:* without it, a runner circling at 130 px was first looked at up to 3.3 s after it first saw them close; with it, 0.4–2.0 s (BR02) |
| `pDecay` | 8 s | e-folding time of the fade (halves in about 5.5 s) |
| `pAware` | 0.12 | pressure at which it looks at them |
| `ackGap` | 3–5 s | the least time between two looks at the same person |
| `look` | 0.8–1.6 s | how long a look lasts (stopped, facing them) |
| `soundLook` | 420 px | a fresh sound this close makes it turn to look (no name, the sound's own fuzzy position) |
| `soundLookI` | 0.2 | the least loudness for that |
| `soundGap` | 4 s | the least time between two looks at sounds |
| `rxGap` | 1.5 s | *added at B1:* the least time after any reaction ends before it turns to a sound (without it, a look at a person was sometimes followed 0.06 s later by a look at their footsteps) |

## Provocation (B2) — built

| Name | Value | Meaning |
|---|---|---|
| `awOrbit` | 300 px | a record, once begun in its space (200 px), keeps being updated within this |
| blame (`byThem` / `byIt`) | fading over 6 s | *added at B2:* who closed the distance lately - their own approach against its own. In-space pressure is × (0.3 + 0.7 × blame); crowding counts only when blame > 0.5. Without it, a bystander standing still that it backed into while warning somebody else reached 0.65 and was warned (BR12, 2 of 6 seeds); with it, 0.18 at most |
| `awCrowd`, `pCrowd` / `capCrowd` | 90 px, 0.16 per s × blame / 0.65 | crowding |
| `orbitArc`, `pOrbit` / `capOrbit` | 4 rad (about 230°), 0.22 per further half-turn / 1.2 | circling: their motion relative to its own, round it, one way, counted only while it sees them (forgotten after 1.2 s out of sight) |
| `awTail`, `tailMin`, `pTail` / `capTail` | 220 px, 3 s, 0.10 per s / 0.9 | following it, moving its way beside or behind it, while it walks |
| `awBlock`, `pBlock` / `capBlock` | 150 px, 0.12 per s / 0.9 | moving into its lane ahead of it (more than 40 px/s: *added at B2*, somebody standing still is not blocking it) for more than 0.6 s |
| `pressNear`, `pressFor`, `pPress` / `capPress` | 160 px, 15 s, 0.25 per s (× 0.5–1 by closeness, × blame) / 1.2 | close and not backing away (by their own motion: *B5*, it had counted the creature's own approach too), in the 15 s after a warning that was given in full (*B5*: a warning cut short by a change of plan before 1.2 s does not open the defence's window; it still counts in the warning tally and the debug "warned Nx", and still delays the next warning) |
| `pWarn`, `warnAfter` | 0.45, 3 s | it warns once pressure reaches this and it has noticed them this long |
| `warnTime`, `warnGap`, `warnBack` | 1.2–1.8 s, 4 s, 40 px/s | the warning's length; the least time from its end to the next; how fast it backs away meanwhile |
| `leaveDwell` | 4 s | a very hungry (0.6+) departure is thought over only after this long, only on fresh sight of somebody it may hunt, at most once a second, never after a lost race |

Measured (BR09–BR14, final code): a person pressing in at 70 px is warned after 6.0–7.3 s, the peak pressure before the warning 0.46–0.57;
15 s after the warning (they backed off after it) it is 0.07–0.09, under the 0.12 at which it would look at them. A brush past at 23–25 px
peaks at 0.18–0.41: one look, no warning. A bystander peaks at 0–0.18. Three minutes of a harasser who comes back after each death (BR13):
1–8 warnings, never closer than 5.4 s apart, one defensive strike and one death per run.

## Defence (B3) — built

| Name | Value | Meaning |
|---|---|---|
| `pDefend` | 0.8 | pressure from which it may defend - only against somebody it has warned |
| `defAfterWarn` / window | 1 s / `pressFor` 15 s | the warning must have ended at least 1 s and at most 15 s before |
| `defReach` | 110 px | they must be this close, seen now, with a clear walking line (nothing it could not pass) and not moving away from it faster than 60 px/s |
| `defWind` | 0.5 s | the defensive wind-up: the pounce's own crouch and click (act `wind`). The hungry grab's 0.12 s and the pounce's 0.22 s are unchanged |
| `defDur`, `defSpeed` | 0.25 s, 340 px/s | the lunge, about 72 px (it slows to 70 % of its speed through it), committed (it cannot steer), only the person it is against can be caught. Aimed where it reckons they will be when it reaches them (*B5*: it had been led a fixed 0.6 s, which put somebody walking straight at it behind it, so it sprang away from them); never past itself |
| `defCost` | 18 | stamina per defensive lunge; it cannot defend under 18, nor when exhausted |
| `defCool`, `defGapAll` | 25 s, 10 s | from a defence's start, before it defends against the same person again; against anybody |
| withdrawal | its tired run, 180 px/s (under the 200 px/s that costs stamina) | a fresh runner (285 px/s) can follow it; a walker (172 px/s) cannot. Fleeing it does not stop to look at them (*B5*); chased down it can still warn, and then defend |
| odds of striking rather than withdrawing | 0.35 (`defBase`), + 0.4 cornered (`defCornered`: fewer than 2 of 7 directions away from them have 180 px of floor), + 0.2 per earlier withdrawal from them (`defPerWithdraw`), + (aggression − 0.45) × 0.5 (`defAggr`; the species' aggression is 0.45, each individual's a little either side), + 0.3 × hunger (`defHunger`), − 0.2 under 40 stamina (`defTired`); kept within 0.1–0.95 | drawn from its own stream (`skinstealer-aware`) |

Measured (final code; hunger at spawn exactly 0). BR08, somebody who keeps within 60 px of it, facing it, for 60 s (8 seeds;
`evidence/b5_br_records.json`): warned first in every run; each strike 1.0–1.9 s after a warning ended, at 66–70 px, aimed within
0.11 rad of them while they closed at 84–171 px/s; odds 0.33–0.37 at a first defence (0.52 after one withdrawal); hunger at the first
defence 0.011–0.015 (0.056 for the one at 34.8 s), only ever risen by time. The same driver over 200 seeds
(`tools/br_dump.js --wide 200`, `evidence/b5_defence_200_seeds.json`): a first defence in every run, typically about 7.5 s in (6.9–20.8 s); a strike first in
73 (36 %, the odds' own rate); 157 killed within the minute, every one at contact, the earliest at 7.4 s, 72 of the 200 by 15 s, the
median kill at 33 s (after a first withdrawal its next chance comes 25 s later, with higher odds); every strike that finished within the minute landed
(157 of 157 — the person did not dodge). BR15, somebody who breaks sideways at the wind-up: it missed 8 of 8, recovered 0.96–1.3 s,
could not spring for 2.1–3.0 s, left them at its tired run without stopping to look, and did not defend against them again for 25 s.
BR13, three minutes of a harasser who comes back after each death: one defensive strike per run, each after a fresh warning.

*Before B5* the lunge was led a fixed 0.6 s, so a person walking straight at it was reckoned behind it: 4 of 8 BR08 runs ended in a
kill and every miss was a lunge 1.6–3.1 rad away from somebody walking at it. Those B3 / B4 figures are superseded.

**For the owner to judge first:** how soon and how often a determined presser is killed — about one in three at the first defence,
typically 7.5 s into continuous crowding after one warning, and about four in five within a minute. `warnAfter`, `pWarn` and `pDefend` set how soon;
`defBase`, `defCornered`, `defPerWithdraw` and `defCool` how often. Also whether the warning (stop, face, hunch, back away for
1.2–1.8 s) and the 0.5 s wind-up read clearly enough from above to make that fair.
