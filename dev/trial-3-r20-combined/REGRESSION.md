# Trial 3 R20 - the combined tree: regression and the verdict data

Trial 3 is **not owner-approved**.  This is the final combined tree: N's checkpoint D3, S's C3 and the kill-visibility fix with its
backstop.  The environment was this session's machine: 2 CPUs, node v22, headless Chromium 141 with software WebGL.

The sources fall into three kinds, each marked below:
- **[sim]** the server simulation;
- **[browser]** real pages;
- **[owner]** your judgment: the worksheet, not given here.

## The suites and the gate [sim]

| run | R19 combined 2f11eae | **R20 combined** |
|---|---|---|
| `npm test` | 340/353 | **367/380**: the same 13 inherited failures (2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09, P01, P08), no new one; +27 R20 checks (ST01-ST05, NA01-NA05, SH01-SH12, NA07, RV07a-d) |
| `npm run gate` (fast) | FAIL only on `port` and `bundle`: NOT RUN, the locked client packages are not in this session | **the same, nothing else**: protocol, the server / B++ / client golden traces, session, sim, page, parts, docs, contracts, scope, lineage, mutants, chat all PASS |
| `npm run build:check` | PASS | PASS |
| the locks PR25, WL05, C15 | PASS | PASS: the registry holds every R20 hunk of the shared engine |

`evidence/npm_test.txt`, `evidence/gate_fast.txt`.

## The open-air STUCK: reproduction and fix [sim]

| | R19 combined | R20 combined |
|---|---|---|
| Skin-Stealer, ordinary play, 8 seeds × 10 min (.55 / .85): red `STUCK` | 134 s / 125 s (96 / 91 s in open air) | **0.1 s / 0.9 s, 0 in open air** |
| side-steps | 227 / 214 | **0 / 3** |
| watchdog resets ("stuck: the watchdog cleared its route", the "retreat") | 3 / 3, all false | **0 / 0** |

Sources: R19 from N's Checkpoint A (`dev/trial-3-r20-nani-head-watchdog/evidence/A`); R20 from `evidence/trace/summary.txt`.

The causes and what fixed each:
- **W1, the stuck yardstick.**  It counted a turnaround as no progress.  Now opt-in: the Skin-Stealer's alone.
- **W2, the watchdog.**  It sampled stillness at one tick.  Now it asks a self-declared still species every tick.
- **W4 and S10, a corner pin** found on this tree: a search goal its body could not reach, and a recovery ladder that never got to a new
  route.  Fixed by W4 (a second side-step at the same spot goes to a new route) and S10 (search goals on floor its body fits).

The checks: ST01-ST05, each with R19's failure as its negative proof.

## The strategic hunter: before and after [sim]

**Ordinary play** (`evidence/ab_table.md`; 16 seeds × 10 min at hunger .55 and .85, two people exploring and answering as players do,
the same seeds on both trees):

| measure | R19 combined (.55 / .85) | **R20 combined** |
|---|---|---|
| kills | 24 / 26 | **27 / 26** |
| run time (over its run threshold) | 215 / 216 s | **140 / 159 s** (−35 % / −27 %) |
| each run's length: median / 90th / longest | .72 / 3.6 / 6.0 s; .15 / 2.5 / 7.0 s | **.55 / 2.8 / 5.8 s; .10 / 1.5 / 6.5 s** |
| runs over 3 s | 21 / 20 | **9 / 10** |
| chases | 11 / 21 | 7 / 19 |
| surprise captures (not seen in the last 3 s) | 4/24, 6/26 | 7/27, 4/26 |
| posts (waiting where they would come out) | 0 / 0 | **5 / 2** |
| waits where it stands | 0 / 0 | **5 / 7** |
| interceptions | 13 / 19 | 18 / 18 |
| time to a position: an interception's / a post's (median) | 2.1 / 2.3 s; no posts | 1.6 / 3.9 s; posts 1.9 / 0 s |
| exhausted | 0 / 3.3 s | **0 / 0** |
| meetings / escapes | 76 / 52, 61 / 35 | 88 / 61, 86 / 60 |

**Staged ambushes, scene by scene** (`evidence/route_C.txt` against `route_R19C.txt`).  A person walks a long route past a hungry (.7)
creature placed out of sight, 30 runs each:

| route | R19: caught | **R20: caught** | R20: staged (posts / waits / going ahead) | R20: caught after staging |
|---|---|---|---|---|
| walking, torch | 20 | 21 | 5 (0 / 5 / 0) | 5 |
| walking, dark | 15 | **19** | 8 (5 / 3 / 0) | 8 |
| running, torch | 22 | 22 | 7 (1 / 4 / 2) | 7 |
| running, dark | 20 | 19 | 9 (5 / 4 / 0) | 8 |

R19 never staged.  R20 staged in 17-30 % of runs and took the person in 28 of its 29 staged runs; some got away (feints and misses).

**The chases** (`evidence/cmp_R19C_C.md`; R19's seeded study, 1,044 runs per species):

| species | caught R19 → R20 | runs that differ |
|---|---|---|
| Hound | 345 = 345 | **0: identical, run for run** |
| Smiler | 323 = 323 | **0: identical, run for run** |
| Skin-Stealer | 305 → 303 | 214 |

The Skin-Stealer's change by scene:
- corner 54 → 52;
- corner-endless 42 → 38;
- **corner-far 41 → 46**;
- long chase 12 → 11;
- loop 156 → 156, mean time to catch 6.29 → 5.42 s.

That is your requested trade: a little less in a sustained open chase, more where it walks in and keeps its breath.

**Per species.**  The Hound and the Smiler are R19's.  Hearing, the head swivel, W1 and W4 are opt-in, the Skin-Stealer's alone (NA04,
NA07, ST02, ST05).

## No wallhacks [sim]

| what | where checked |
|---|---|
| a sound never names anybody it does not see | SH02, SH12; posts are anonymous (SH01) |
| no plan about a person it never saw | SH12 |
| the fatigue belief never reads a meter | SH10 and SH11: it can be wrong, and it decays out of sight |
| the head swivel never sees through a wall | NA02: 9,683 ticks of sight in play, 0 without a clear line; its head turned straight at 90 people in the next room, 0 seen |

## Head pose against sight [sim + the page's own script in a VM]

- **NA01.**  On 53,796 frames the drawn head is within .115 rad of the server's on 95 % (R19's page: .394).  Standing, it sees exactly
  those inside its cone round `e.ang + e.head`.
- **NA03.**  No head turn faster than 3 rad/s; at a run never past .4 rad.  Pages at 24 and 60 fps, and a page joining late, agree.
- **NA05.**  The swivel never moves the body.

## Real pages [browser]

| scene | R19 combined | **R20 combined** |
|---|---|---|
| kill visibility, every Skin-Stealer case (`browser/rv_C.json`, `rv_table_R19_C.md`; the method is `dev/trial-3-r20-kill-visibility/REPORT.md`) | the second Skin-Stealer hidden on every frame of every kill (victim, spectator, late page) | **never hidden**; the killer drawn exactly once; every mirror back after |
| a Hound's kill with a pack-mate, seen by a spectator | the pack-mate hidden, the killer drawn twice | **the same**: known, not fixed (the B++ protocol; your call) |
| R19's positioning scenes B and J, 3 tries each (`browser/r19b_*.json`) | never vanished; 59-61 px toward the side way out; within 200 px at 2.3-3.4 s | **the same**: never vanished; 59-60 px; within 200 px at 1.9-2.5 s |
| a dark walk past a hidden one, 4 tries (`tools/r20_browser.js`, `browser/r20b_*.json`) | caught 2/4, staged 0/4 | caught 3/4; staged 1/4 (it listened, took a post, lay in wait and sprang at 7.6 s); 4 tries is a small sample |

The frame rates were low (2-4 frames a second for several pages at once).  NOT CHECKED here: a fresh join or a reconnect landing inside a
3.5 s kill; pages took 5-18 s to enter.

## Performance [sim]

PERFORMANCE.md: the 60 Hz step at 4 and 8 players, both orders, with the A/A control.

## Seeded QA

Every simulation above is seeded and repeats run for run: the same seeds on both trees, and the A/B identical on rerun (S C2).  The real
pages are not seeded: they are the real game.
