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

## Checkpoint D: the head swivel (W3)

| run | Checkpoint B 68d4ff9 | **checkpoint D** |
|---|---|---|
| `npm test` | 344/357 | **348/362** in the full run (`evidence/D/npm_test.txt`); +5 tests (NA01-NA05).  The same 13 inherited failures, and SR04, re-judged below (`evidence/D/s_skinr19_rejudged.txt`: 6/6 after it), so 349/362 |
| NA01-NA05 (`s_r20head.js`) | not in that tree | 5/5 |
| ST01-ST04, NC01-NC04, PR25, WL05, C15 | PASS | PASS (the registry holds the swivel's two hunks, tagged `head`) |
| `npm run build:check` | PASS | PASS |

**SR04, re-judged.**  SR04 (R19) checks that a vault, once begun, is carried through on its own line.  It measured every vault in its 2 s
against the first vault's line.  With the swivel, in one seed the creature saw the person 160 px to its side sooner, went for them and
vaulted back from another place at 1.15 s.  That second vault was measured against the first one's line (16.6 px "off").  Each vault is
now judged against its own line.  Every vault in every seed is exactly on its line (0.0 px) and lands at its 0.567 s.

**The chases (`evidence/D/cmp_N_D.md`, the seeded study, 1,044 runs per species).**

| species | caught B → D | runs that differ |
|---|---|---|
| Hound | 345 = 345 | 0 |
| Smiler | 323 = 323 | 0 |
| Skin-Stealer | 305 → 306 | 3: all sooner |

**NA01-NA05, what each showed (`evidence/D/npm_test.txt`).**
- **NA01 (the drawn head is where it looks).**
  - 53,796 frames of real play: the drawn head is off the server's by 0 / .115 / .297 rad (median / 95th / 99th).  R19's page on the same
    snapshots: .007 / .394 / .783.
  - Standing still, its head at -.85, 0 and +.85: 282 placements, each seen exactly when inside the cone round `e.ang + e.head`.  Forty of
    them were outside the body's own cone and seen through the turned head.
- **NA02 (nothing behind a wall).**
  - Play: 9,683 ticks of sight, 0 without a clear line.
  - Its head turned straight at 90 people in the next room: 0 seen.
  - 10 corners, walked and run, swivelling and straight: 40 sightings, every one within a think (.12 s) of the line opening, none before.
- **NA03 (the head while it walks and runs).**
  - Turned more than .2 rad, with nobody in view, for 9.3 % of its walking (2.8 % without the swivel).
  - Never past .4 rad at a run; the fastest swivel was 3 rad/s.
  - A 24 fps page draws the head within .083 rad on 95 % of frames.  A page joining 30 s late matches the first page after half a second.
- **NA04 (other species unchanged).**  The Hound and the Smiler have no capability, make no call, and `headAhead` is 0 for them over about
  9,500 ticks of bends (the Skin-Stealer: up to .85 rad).  A disguised Skin-Stealer's head stayed at 0.
- **NA05 (it never moves a body).**  20 runs: every path and arrival identical with the head swivelling and straight.
- **NA06 (R19's corner timing).**  NC01-NC04 pass unchanged; NA05 shows the swivel cannot change an arrival.

## Checkpoint D2: W1 made the Skin-Stealer's alone (`caps.TURN_AWARE_STUCK`)

Why: the fast gate on the combined tree failed its server golden traces, which hold the Hound's and the Smiler's B++ behaviour byte for
byte.  The cause was W1's shared yardstick: with it taken out, the traces were B++'s again.  The independent review found the same change.
DESIGN_DECISIONS W1 has the details.

| run | checkpoint D | **D2** |
|---|---|---|
| `npm test` | 349/362 (with SR04 re-judged) | **349/362**: the same 13 inherited failures (`evidence/D2/npm_test.txt`); ST02 now holds the Hound's and the Smiler's turns to R19's, run for run |
| `npm run gate` (fast) | not run on this branch until then: srv_golden, bpp_golden, session, sim and parts would have failed | **R19's**: only `port` and `bundle`, NOT RUN (the locked client packages are not in this session) |

The chase study against R19 combined (`evidence/D2/cmp_R19C_D2.md`, 1,044 runs per species):

| species | caught R19 combined → D2 | runs that differ |
|---|---|---|
| Hound | 345 = 345 | **0**: identical, run for run |
| Smiler | 323 = 323 | **0**: identical, run for run |
| Skin-Stealer | 305 → 306 | 25 (13 sooner, 12 later): its own W1, W2 and head swivel |

At checkpoints B-D, W1 was shared.  Those study tables show the Hound's and the Smiler's caught counts equal to R19's but a few loop runs
differing; that is the difference D2 removes.

## Checkpoint D3: W4, the corner pin

`npm test` **350/363**: the same 13 inherited failures, +1 (ST05; `evidence/D3/npm_test.txt`).
- **ST05, the Skin-Stealer.**  Pinned on R20's corner with an unreachable last waypoint: a new route at 4.2 s from setting off (the corner
  is 2 s away), 5 side-steps in 15 s.  R19's follower: 13 side-steps and no new route in 15 s.
- **ST05, the Hound:** R19's exactly.
- **On floor its body fits, both arrive** in 1.8 s.

The trace hook (`tools/trhook.js`) now finds the ladder's moved first line.  Its "replans" column does not count W4's escalations: the
callback runs before them.
