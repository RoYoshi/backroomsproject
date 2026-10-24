# Trial 3 R20, N track: regression (Checkpoint B, the open-air STUCK)

Trial 3 is **not owner-approved**.  Environment: this session's machine (2 CPUs, Linux, node v22), the repository's own scripts, and a
synthetic `ADMIN_PASSCODE` in the shell for each run.  The baseline is R19 combined, `2f11eae`.

## The suites

| run | R19 combined 2f11eae | **this branch** |
|---|---|---|
| `npm test` (dev/tests/run.js default list) | 340/353 | **344/357**: the same 13 inherited failures and no new one; +4 tests (ST01-ST04) |
| inherited failures | 2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09, P01, P08 | the same 13 names |
| ST01-ST04 (`s_r20stuck.js`) | not in that tree; each test's negative proof (R19's engine) shows the defect | 4/4 |
| the locks: PR25 and WL05 (the shared engine = base + exactly the hunks in `r19n_patch.js`), C15 (no Skin-Stealer: every snapshot R8's) | PASS | PASS |
| NC01-NC04 (R19's cornering) | PASS | PASS (see the note below) |
| `npm run build:check` | PASS | PASS |

`evidence/B/npm_test.txt`.

**The note on NC01-NC04.**  Their "R18 follower" side is now this tree with only R19's cornering hunk taken out; R20's hunks stay on both
sides.  The first full run had removed every hunk, R20's too.  NC04 then failed: its time-matched jump check found the one engine
corner-push of seed 3 at 21.83 s, one tick before the de-hunked side's 21.85 s.  The push is the same, about 12 px.  R20's turn fix
shifts that run by a tick.  NC's subject is the cornering hunk, so the comparison now isolates it; R20's own hunks are compared with R19 by
ST01-ST04.

## What the fix did: the same seeded play as Checkpoint A (`evidence/B/summary.txt`, `tr_N_*.json`)

| ordinary play | R19 combined: `STUCK` label / in open air / side-steps / watchdog resets | **this branch** |
|---|---|---|
| Skin-Stealer, prechase .55, 8 × 10 min | 134 s / 96 s / 227 / 3 (all false) | **0.1 s / 0 / 0 / 0** |
| Skin-Stealer, prechase .85 | 125 s / 91 s / 214 / 3 | **0 / 0 / 0 / 0** |
| Skin-Stealer, 4 people | 158 s / 119 s / 231 / 3 | **0 / 0 / 0 / 0** |
| Hound, 2 people | 58 s / 36 s / 71 / 1 | **27 s / 1 s / 4 / 1** (the remaining label is a real wall contact left on screen while it stands in its "circle"; the one reset is the Hound's own unchanged rule) |
| Smiler, 2 people | 296 s / 84 s / 72 / 23 | **0 / 0 / 0 / 19** (the resets are the Smiler's own unchanged rule: its slow fade, about 11 px/s) |

Stuck-timer growth classified as real collision is unchanged: Skin-Stealer 0.0-0.2 s, Hound 2.2 s.  Only the "turn" class went, from
129 s to 0.6 s.

## Never weaker: Hound and Smiler (the owner's absolute rule), and the Skin-Stealer

**The R19 seeded chase study** (`dev/trial-3-nani-corners/tools/pursuit_outcomes.js --n 60 --loopSeeds 6`) was run on this branch and
paired run by run against R19 combined's record (`evidence/B/cmp_R19C_N.md`).  Caught counts are the same in every one of the 15
species-scene groups.

| species | runs | caught R19C → N | attacks begun | runs that differ |
|---|---|---|---|---|
| Hound | 348 | 345 = 345 | 174 = 174 | 3, all sooner (loop) |
| Smiler | 348 | 323 = 323 | 306 → 304 | 9 (loop): 4 sooner, 5 later; the loop's mean time to catch is 5.83 → 5.73 s |
| Skin-Stealer | 348 | 305 = 305 | 374 → 373 | 25: 10 sooner, 15 later; the loop's mean time to catch is 6.29 → 6.13 s |

R19's own A/A control moved every creature 1 px and changed 160 of 702 laps by up to 35 s (R19 combined REGRESSION).  Individual laps are
the chase's own sensitivity; the counts are the measure.

**Ordinary play:** 16 seeds × 10 min of roaming among two people, kills per species (`evidence/B/roam_kills.txt`):

| species | R19 combined | this branch |
|---|---|---|
| Hound | 87 | 96 |
| Smiler | 51 | 51 |
| Skin-Stealer | 31 | 33 |

## Timing of a turn (ST02a)

The fix changes only the stuck accounting, never the motion.  Over 154 turnarounds per species on open floor, every arrival was R19's to
within 0.016 s.  The few hundredths of difference are where R19's side-step fired.
