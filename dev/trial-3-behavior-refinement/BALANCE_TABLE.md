# Trial 3 behaviour refinement — balance table

**Every value is PROPOSED, not owner-approved.** They live in `SK` in `ai.skinstealer.js`, one name each, so each can be tuned after the
owner plays. Trial 3's own values (`dev/trial-3-skin-stealer/BALANCE_TABLE.md`) are unchanged by this pass: hunger, stamina, speeds,
vision, the pounce, the hungry grab, the departure (1200–2200 px, at most 45 s), the hunt cooldown (30–60 s; 12 s starving), the
encounter budget.

Status: B1's and B2's values are built (B1 as proposed plus `pFast` and `rxGap`; B2 as proposed plus blame and the moving-into-its-way rule, below).
B3 is still the starting proposal; its built values are filled in when it lands (`CHECKPOINTS.md`).

## Awareness (B1)

| Name | Proposed | Meaning |
|---|---|---|
| `awMax` | 4 | awareness records it keeps (the oldest, least pressing goes first) |
| `awTtl` | 30 s | a record nobody has renewed for this long is dropped |
| `awNear` | 200 px | its personal space, while it sees them |
| `pNear` / `capNear` | 0.12 per s / 0.35 | pressure while they are in its space, × closeness (0 at 200 px, 1 at 90 px), × 1.3 coming at it or × 0.4 going away (their motion relative to its own); presence alone never goes beyond 0.35 |
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
| `pressNear`, `pressFor`, `pPress` / `capPress` | 160 px, 15 s, 0.25 per s (× 0.5–1 by closeness) / 1.2 | close and not backing away, in the 15 s after it warned them |
| `pWarn`, `warnAfter` | 0.45, 3 s | it warns once pressure reaches this and it has noticed them this long |
| `warnTime`, `warnGap`, `warnBack` | 1.2–1.8 s, 4 s, 40 px/s | the warning's length; the least time from its end to the next; how fast it backs away meanwhile |
| `leaveDwell` | 4 s | a very hungry (0.6+) departure is thought over only after this long, only on fresh sight of somebody it may hunt, at most once a second, never after a lost race |

Measured (BR09–BR14): a person pressing in at 70 px is warned after 6.0–7.3 s, the peak pressure before the warning 0.46–0.57; 15 s after they
back off it is 0.07–0.09 (under the 0.12 at which it would look at them). A brush past at 23–25 px peaks at 0.18–0.41: one look, no
warning. Three minutes of pressing: 29–30 warnings, never closer than 5.3 s apart.

## Defence (B3)

| Name | Proposed | Meaning |
|---|---|---|
| `pDefend` | 0.8 | pressure at which it may defend (after a warning) |
| `defAfterWarn` / `defWindow` | 1 s / 15 s | the warning must have ended at least / at most this long before |
| `defReach` | 110 px | they must be this close, seen, with a clear line |
| `defWind` | 0.5 s | the defensive wind-up (the hungry grab's is 0.12 s, the pounce's 0.22 s: both unchanged) |
| `defDur`, `defSpeed` | 0.25 s, 340 px/s | the lunge (about 70 px) |
| `defCost` | 18 | stamina per defensive lunge |
| `defCool` | 25 s | before it defends against the same person again |
| `defGapAll` | 10 s | before it defends against anybody again |
| withdrawal speed | 180 px/s (its tired run, under the 200 px/s that costs stamina) | how fast it goes when it withdraws |
| strike odds | 0.35, + 0.4 cornered, + 0.2 per earlier withdrawal, + (aggression − 0.45) × 0.5, + 0.3 × hunger, − 0.2 if its stamina is under 40; kept within 0.1–0.95 | strike rather than withdraw |
