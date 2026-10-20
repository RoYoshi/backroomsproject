# Trial 3 behaviour refinement — balance table

**Every value is PROPOSED, not owner-approved.** They live in `SK` in `ai.skinstealer.js`, one name each, so each can be tuned after the
owner plays. Trial 3's own values (`dev/trial-3-skin-stealer/BALANCE_TABLE.md`) are unchanged by this pass: hunger, stamina, speeds,
vision, the pounce, the hungry grab, the departure (1200–2200 px, at most 45 s), the hunt cooldown (30–60 s; 12 s starving), the
encounter budget.

Status at B0: the starting proposal. The values actually built are filled in as each checkpoint lands (`CHECKPOINTS.md`).

## Awareness (B1)

| Name | Proposed | Meaning |
|---|---|---|
| `awMax` | 4 | awareness records it keeps (the oldest, least pressing goes first) |
| `awTtl` | 30 s | a record nobody has renewed for this long is dropped |
| `awNear` | 200 px | its personal space, while it sees them |
| `pAware` | 0.12 | pressure at which it looks at them |
| `ackGap` | 3–5 s | the least time between two looks at the same person |
| `look` | 0.8–1.6 s | how long a look lasts (stopped, facing them) |
| `soundLook` | 420 px | a fresh sound this close makes it turn to look (no name, the sound's own fuzzy position) |
| `soundLookI` | 0.2 | the least loudness for that |
| `soundGap` | 4 s | the least time between two looks at sounds |

## Provocation (B2)

| Name | Proposed | Meaning |
|---|---|---|
| `awCrowd` | 90 px | crowding |
| `awOrbit` | 300 px | circling counts within this |
| `orbitArc` | 4.0 rad (about 230°) | their motion relative to it, round it, one way, before circling counts; then every further half-turn |
| `awTail` | 220 px, `tailMin` 3 s | following it, beside or behind, for this long while it walks |
| `awBlock` | 150 px | standing in its lane ahead of it |
| `pNear` / ceiling | 0.12 per s / 0.35 | in its space (scaled by closeness, approach) |
| `pCrowd` / ceiling | 0.16 per s / 0.65 | crowding |
| `pOrbit` / ceiling | 0.22 per event / 1.2 | circling |
| `pTail` / ceiling | 0.10 per s / 0.9 | tailing |
| `pBlock` / ceiling | 0.12 per s / 0.9 | in its way |
| `pPress` / ceiling | 0.25 per s / 1.2 | still pressing after a warning |
| `pDecay` | 8 s | e-folding time of the fade (halves in about 5.5 s) |
| `pWarn` | 0.45 | pressure at which it warns (after `warnAfter`) |
| `warnAfter` | 3 s | it must have noticed them this long first |
| `warnTime` | 1.2–1.8 s | how long a warning lasts (stopped, facing, hunched, backing away) |
| `warnGap` | 4 s | the least time from the end of one warning to the next |
| `leaveDwell` | 4 s | a very hungry departure can be reconsidered only after this, and only on fresh sight |

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
