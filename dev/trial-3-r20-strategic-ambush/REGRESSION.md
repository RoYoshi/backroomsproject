# Trial 3 R20, S track: regression and the A/B (Checkpoint C)

Trial 3 is **not owner-approved**.  Everything here is a **server simulation** on this session's machine (2 CPUs, node v22), not a browser
run and not the owner's judgment.  The baseline **A0** is the N branch (R19 combined + the watchdog fix), which is this branch's parent.

## The suites

| run | N branch 68d4ff9 | **this branch** |
|---|---|---|
| `npm test` | 344/357 | **357/370**: the same 13 inherited failures (2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09, P01, P08), no new one |
| SH01-SH12, NA07 (`s_skinr20.js`) | not in that tree | 13/13 |
| ST01-ST04, the locks (PR25, WL05, C15), NC01-NC04 | PASS | PASS (the lock registry now also holds the `ai.senses.js` hunk) |

Nine earlier checks were re-judged because their premise was that a walking step 700-900 px off is out of its hearing.  Each keeps its
property, with the reason in an "R20" comment; DESIGN_DECISIONS has the table.  The crouch-hearing proposal that broke two of them was
withdrawn rather than changing the checks.

## Ordinary play: the A/B

The tool is `tools/hunt_sim.js`: R19's `prechase_sim.js` (two people exploring and reacting to it as players do) plus R20's measures.
Each variant ran **16 seeds × 10 min** at hunger .55 and .85, the same seeds for every variant.  The raw runs are `evidence/C/ab/*.json`;
`tools/ab_table.py` builds `evidence/C/ab_table.md`; `tools/variant.js` builds the variants by exact text substitution of the built ai.js.

| variant | hunger | kills | escapes | chases | run s | longest run | runs > 3 s | surprise captures | posts | waits where it stands | exhausted s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **A0** R19 code | .55 | 29 | 57 | 12 | 201.7 | 7.0 | 18 | 10/29 | 0 | 0 | 5.3 |
| **A0** R19 code | .85 | 25 | 52 | 19 | 228.8 | 7.0 | 22 | 3/25 | 0 | 0 | 0 |
| V1 R19 code + the stamina/chase values only | .55 | 29 | 55 | 9 | 187.1 | 6.5 | 19 | 7/29 | 0 | 0 | 3.1 |
| V1 | .85 | 25 | 53 | 18 | 266.9 | 8.0 | 22 | 3/25 | 0 | 0 | 3.1 |
| V6 strategy, drain 11 | .55 / .85 | 26 / 25 | 68 / 77 | 7 / 20 | 124.8 / 168.4 | 6.6 / 7.2 | 8 / 10 | 3/26, 1/25 | 3 / 3 | 4 / 5 | 0 / 3.5 |
| V4 strategy, drain 12 | .55 / .85 | 27 / 27 | 71 / 74 | 7 / 19 | 127.5 / 161.2 | 6.5 / 6.5 | 8 / 9 | 3/27, 2/27 | 3 / 1 | 4 / 4 | 0 / 3.3 |
| V5 strategy, drain 14 | .55 / .85 | 26 / 25 | 68 / 75 | 7 / 18 | 114.8 / 168.5 | 5.6 / 5.5 | 8 / 10 | 3/26, 0/25 | 1 / 2 | 4 / 7 | 3.9 / 3.4 |
| C3 unaware walkers trailed at their pace | .55 / .85 | 26 / 27 | 64 / 78 | 7 / 20 | 114.1 / 166.9 | 6.0 / 6.0 | 8 / 12 | 3/26, 2/27 | 1 / 2 | 4 / 5 | 0 / 0 |
| C4 ... at its investigation pace | .55 / .85 | 26 / 27 | 67 / 78 | 8 / 21 | 141.2 / 185.4 | 5.5 / 6.5 | 9 / 15 | 4/26, 4/27 | 4 / 1 | 5 / 4 | 0 / 0 |
| V2 C3 with R19's ears | .55 / .85 | 24 / 27 | 69 / 68 | 9 / 21 | 108.2 / 143.5 | 6.6 / 5.9 | 7 / 9 | 0/24, 1/27 | 1 / 1 | 4 / 5 | 0 / 3.3 |
| V7 C3 with half the ear boost | .55 / .85 | 21 / 31 | 55 / 58 | 7 / 28 | 105.7 / 158.8 | 6.2 / 6.0 | 7 / 11 | 0/21, 2/31 | 0 / 1 | 3 / 3 | 0 / 6.9 |
| V8 C3 with R19's press for walkers | .55 / .85 | 27 / 28 | 59 / 60 | 6 / 24 | 126.5 / 171.8 | 4.5 / 6.5 | 7 / 11 | 7/27, 4/28 | 4 / 3 | 4 / 6 | 0 / 0 |
| **F the proposal** (V8 + the corrections the suites found) | **.55** | **27** | **57** | **8** | **131.0** | **5.8** | **8** | **7/27** | **5** | **5** | **0** |
| **F** | **.85** | **27** | **56** | **19** | **157.5** | **6.5** | **10** | **4/27** | **3** | **8** | **0** |

### Reading it

- **Kills are kept:** 54 for F against 54 for A0, over 320 min.  Run-to-death is never a single number to optimise here.  The pack:
  "Do not demand unchanged long-chase kill rate."  The chase scenes below are where the tradeoff shows.
- **Running is down by a third:**

  | | A0 | F |
  |---|---|---|
  | run time (.55 / .85) | 202 / 229 s | 131 / 158 s (−35 % / −31 %) |
  | runs over 3 s | 18 / 22 | 8 / 10 |
  | longest uninterrupted run | 7.0 s | 5.8 / 6.5 s |
  | exhausted | 5.3 s at .55 | never |

  The rush durations: median 0.55 s and 90th percentile 2.5 s at .55, against 0.77 and 3.5 s for A0.
- **Waiting where they will go:**
  - A0 never takes a post or waits where it stands.
  - F takes posts 5 and 3 times and waits where it stands 5 and 8 times.
  - Surprise captures (the victim had not seen it in its last 3 s): F 7/27 and 4/27, against A0 10/29 and 3/25, about the same.
- **The tradeoffs, recorded:**
  - **Trailing walkers at their own pace** (C3, C4) was the purest "pursuit walk", but it cost surprise captures (3-4 against 10).  It was
    not kept: R19's press stays for somebody moving off.
  - **R19's ears** (V2) or half the boost (V7) leave the strategy little to act on: interceptions drop and surprise captures fall to 0/21-24.
  - **Drain 14** exhausts it in ordinary play; 11 and 12 run longer for no more kills.
- **Escapes:** 113 for F against 109 for A0.  Its ears bring more meetings in some variants (C3: 90-105 against 77-86); in F the meetings
  are 84 / 83, near A0's.

## Staged ambushes, scene by scene

`tools/route_scene.js`: a person on a long route (1400-3200 px) past a hungry (.7) creature placed 450-750 px off its middle, out of sight
of the start.  Thirty runs each, the same runs on both trees (`evidence/C/route_scenes.txt`).

| route | A0 caught | A0 staged | **F caught** | **F staged (posts / waits where it stood / go-aheads)** | F caught after staging |
|---|---|---|---|---|---|
| walking, torch | 20 | 0 | 21 | 5 (0 / 5 / 0) | 5 |
| walking, dark | 15 | 0 | **19** | 8 (5 / 3 / 0) | 8 |
| running, torch | 22 | 0 | 22 | 7 (1 / 4 / 2) | 7 |
| running, dark | 20 | 0 | 19 | 9 (5 / 4 / 0) | 8 |

A0 never staged.  F staged in 17-30 % of runs and took the person in 28 of its 29 staged runs.  Each wait or post was out of their sight, and the
spring had its 0.22 s wind-up (SH06).

## The chases: R19's seeded study (`pursuit_outcomes.js`, 1,044 runs per species, `evidence/C/cmp_N_S.md`)

| species | caught N → S | attacks | runs that differ |
|---|---|---|---|
| Hound | 345 = 345 | 174 = 174 | 0: untouched, bit for bit |
| Smiler | 323 = 323 | 304 = 304 | 0: untouched, bit for bit |
| **Skin-Stealer** | **305 → 302** | 373 → 369 | 212 |

The Skin-Stealer's change by scene:
- **corner**: 54 → 52;
- **corner-endless**: 42 → 38;
- **corner-far**: 41 → 46;
- **long chase**: 12 → 11;
- **loop**: 156 → 155, its mean time to catch 6.13 → 5.45 s.

This is the owner's requested tradeoff: in the sustained open chase it catches about 1 % fewer, and a little later in corner chases.  In
starts from far back it catches more, because it walks in and keeps its breath for the end.  The pack: "do not claim never weaker for
the Skin-Stealer's open chase".  The Hound and the Smiler are identical to the N branch, and the N branch's own study holds them to R19.

## SH01-SH12, NA07: what each showed (this tree, `evidence/C/npm_test.txt`)

- **SH01:** 48 dark walks and runs; it staged in 12 and took 10 after staging; every post was anonymous.
- **SH02:** one step behind a wall.  It stopped to listen, named nobody, and placed the step 71-101 px off.
- **SH03:** a newer sound the other way moved its goal or its facing in 3/3.
- **SH04:** 15 min roaming alone.  It was moving 58-62 % of the time; its longest stillness was 2.3 s.
- **SH05:** watched in the lit hall.  It acted at 0.1 s; at its run 34 % of the first 12 s at .6, 12 % at .85.
- **SH06:** a dark walker coming its way.  In 4 of 6 it waited where it stood and took them after a 0.22 s wind-up.
- **SH07:** somebody who sees it at 550 px and sprints back got away 6/6.
- **SH08:** from full to exhausted at its run in 7.08 s (R19 8.36 s); a fresh sprinter got away 3/3.
- **SH09:** its prowl gave back 30 stamina in 5 s; a spring cost 22.
- **SH10:**
  - a 2 s sprint by somebody whose meter read 4 → fresh;
  - a 9 s sprint by somebody whose meter read 95 → winded (p .82);
  - a slow walk soon after a run → winded;
  - a ragged breath heard where it believed them → winded.
- **SH11:** 12 s unseen, its confidence fell from .9 to .17, and they read fresh when seen again.
- **SH12:** four people; every plan about a person was about somebody it had seen.
- **NA07:** a walk heard to 680 px (a player hears its walk to 734); a run to 847 (770); through a wall a walk to 510 (668) and a run to
  635 (717); crouching at R19's reach.  The Hound and the Smiler are on the shared law exactly.

## Checkpoint C2: the independent review's fixes, and W1 the Skin-Stealer's alone

**The changes.**
- **N's D2, carried here as the same change.**  The turn-aware stuck timer is now an opt-in, `caps.TURN_AWARE_STUCK`, and only the
  Skin-Stealer has it.  The Hound's and the Smiler's recovery is B++'s again, which the gate's server golden traces require.
- **Posts.**  Neither a post nor a wait-where-it-stands is ever built from another creature's sounds (`src -1`): two Hound footsteps were
  "somebody" to wait for.
- **The fatigue belief.**  Time out of its sight counts only toward their getting their breath back (the walk-back), never also as run
  time.
- **The summon guard** (`e.roam.summon`) is cleared with the rest of its state on an admin clear.
- **The part headers** of `ai.skinstealer.js` and `ai.skin.mind.js` name `skFatigueSee` and `skWinded`; the gate's parts check had failed.
- **The doc correction** (S4): `skAhead`'s route queries use the search stream, so later draws can differ from R19's.

**The results.**

| run | checkpoint C | **C2** |
|---|---|---|
| `npm test` | 357/370 | **357/370**: the same 13 inherited failures (`evidence/C2/npm_test.txt`) |
| `npm run gate` (fast) | not run at C: srv_golden, bpp_golden, session, sim and parts would have failed | **R19's**: only `port` and `bundle`, NOT RUN here (`evidence/C2/gate_fast.txt`) |
| A/B, F at .55 and .85 (16 seeds × 10 min) | the table above | **identical, run for run** (`evidence/C2/ab/`): those scenes have no other creature, and no decision there turned on the fatigue fix |

The chase study against R19 combined (`evidence/C2/cmp_R19C_S2.md`):

| species | caught R19 combined → C2 | runs that differ |
|---|---|---|
| Hound | 345 = 345 | **0** |
| Smiler | 323 = 323 | **0** |
| Skin-Stealer | 305 → 302 | the strategic hunter (as at C) |

At C, the Hound's and the Smiler's caught counts were already equal to R19's, but some loop runs differed (`cmp_N_S.md` was against the
N branch's then-shared W1).  Now they are identical run for run.
