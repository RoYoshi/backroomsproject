# Trial 3 R19, S track - regression

Trial 3 is **not owner-approved**.  Environment: this session's machine (2 CPUs, Linux, node v22.22.2), the repository's own scripts,
`ADMIN_PASSCODE=<synthetic>` in the shell for each run.  Raw outputs: `evidence/S0/` (R18), `evidence/S3/` (this branch: `npm_test.txt`, the scenes, the simulations).

## The suites

| run | R18 01e5d97 | S (the code after the independent review, `S3-review` in CHANGELOG.md) |
|---|---|---|
| `npm test` (dev/tests/run.js, its default list) | 330/343 | **336/349** (+6: SR01-SR06) |
| failing | the 13 inherited P9 names: 2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09, P01, P08 | **the same 13 names**, none new |
| `node dev/tests/run.js s_humanqa_hotfix.js` | 5/6 (X03 inherited) | 5/6 (X03) |
| every Skin-Stealer suite (s_skinstealer, s_skinbehave, s_skinpredator, s_skinap, s_skinroute, s_skinadv, s_skinr16, s_skinmind, s_skinsight, s_skinr9, s_skinbody, s_skinrend, s_wandererlock) | all green | all green |
| `npm run build:check` | PASS | PASS (the generated files are the parts' build) |
| `node dev/tools/checks/parts.js` | PASS | PASS (provides/uses agree: `skWayOut`) |

No threshold, seed or assertion of an existing test was changed.

## The new suite, `dev/tests/s_skinr19.js` (S-scenario mapping)

| test | pack IDs | on S | on R18 (the negative proof: the same file run on an R18 checkout) |
|---|---|---|---|
| SR01 a walker is not answered by a long way round; refused with its reckoning; never the bait; no way begun its reckoning says finds them gone; nor for somebody walking towards it (added after the review) | S01, S26 | PASS: walking off - 7 refusals in 16 runs, each with its time and where they would be; then watch 3, approach 3, chase 1; the bait 0, and none within 2.5 s of a dropped way round (added after the second review).  Towards it from 900 px - 3 refusals in 4 runs, then the back-off R18 gives somebody coming on; ways round begun while they came on 0 | FAIL: 0 refusals; a way round begun and dropped within a think in 9 runs; towards it, a way round begun in 3 of 4 (dropped a second later) |
| SR02 the pack's Scene B: at .7 it still goes round a stander (8/8); at .85 it refuses with its budget and comes on openly (5/5) | S10, S26 | PASS | FAIL: at .85 it went round in 5/8 |
| SR03 the contest at a junction (points on open floor, reachable, to their side, never for a walker, dropped at the footwork's range; the other exit escapes) | S02, S27 | PASS: 6/6 standing, 0 bad points, escape west 8/8 | FAIL (no contest; escape west 7/8) |
| SR04 a vault carried through (on the vault's line until it lands, its vault time) | S22, S27 (the audit's find) | PASS: 0.0 px off the line, landed at 0.567 s | FAIL: 25.1 px off the line in one run, landing late (0.60-0.65 s) |
| SR05 no churn where it reckons (rewritten after the review found the first form's scene never reckoned): a flicking watcher, walk-and-stop, towards it, off its way round - 22 runs | S30 | PASS: 10 records (6 refusals), 10 ways round; at most 1 record a think, 3 plans in a second; no way round dropped on the next think; after a refusal no covert search on the next thinks and no way round within 2 s | FAIL only for having nothing to check (0 records, 0 refusals - R18 does not reckon); its churn measures are as good |
| SR06 a way round that no longer leads to them (added after the review): seen walking off from its spot | S01, S25 | PASS: given up 0.13-0.14 s after they set off, on the think of its record, 6/6; came on (approach/chase) 6/6; the bait 0 | FAIL: the way round ran to the end of the 8 s run in 6/6 |

The R18 column: the same file run on an R18 checkout (`evidence/S0/r18_s_skinr19_negative.txt`).

## The pack's S01-S30 against the evidence

| ID | where it is established |
|---|---|
| S01 walking away, no purposeless vanish | SR01; scene_r19.js hall walk0/walkoff (`evidence/S3/scenes_*`); prechase_sim "flanks" (`PERFORMANCE.md` / `evidence/S3/`: the simulation's ways round, how long, and whether the quarry had moved away) |
| S02 a fork, one exit outplayable | SR03; scene_r19.js escape (east contested, west open) |
| S03 reversal after it commits | SR01's walkers; C20, C22, PR11 (green); browser F6 (`BROWSER_AND_MEDIA.md`) |
| S04 walks then sprints | C26, PR05, PR27 (green, unchanged) |
| S05 the fair race 285 vs 270 | C26 ("never nearer than 347-356 px", "its top 270 px/s"), PR05, WL01-WL06 (green); speeds untouched (WL06) |
| S06 the stare at .6 | P09 (no stop-turn-walk loops), BR/PR escalation tests (green); browser threat S-scenes |
| S07 starving, open press | SR02 (.85), PR03, P02 (green) |
| S08 near-fed passerby | PR01, PR02, PR18 (green) |
| S09 a suitable concealed flank | SR02 at .7; C17, PR06, R9-01, X07 (green; R9-01: 8 of 12 runs with a covert way where R18 had 11 - the starving runs now press) |
| S10 only a very long covert route | SR02 at .85 |
| S11 cover crossing the person's view | C16, C19, R9-01, X07 (green; the cover audit untouched) |
| S12 one sighting then behind a wall | PR08, C21, X06 (green) |
| S13 anonymous sound | PR12, PR16, X05 (green) |
| S14 repeated sounds after a failed guess | PR10, PR11, C22 (green) |
| S15 hides silently | PR13, X06 (green) |
| S16 two visible, one distracts | X05, P12 (green) |
| S17 four players spread | X09, PR24 (green); prechase_sim (two people); browser campaign |
| S18 a group leaves | X09; the crowd weights unchanged |
| S19 target leaves/dies | PR26, PR30 (green) |
| S20 no Skin-Stealer | C15 (every snapshot R8's), PR25 (green) |
| S21 hunger > .8 after a missed opening | SK31, PR19 (green) |
| S22 a wind-up during re-evaluation | P04 "a committed strike is never cut" (green); SR04 (the vault) |
| S23 a lost race | PR20, PR27 (green) |
| S24 a wrong doorway | PR09, SK23 (green) |
| S25 a failed covert site | C20, PR10 (green) |
| S26 route cost / short opportunity | SR01, SR02 (its reckoning in its record) |
| S27 the handoff to skFight | SR03 (the contest point dropped when the footwork has them); P15-P17 (green) |
| S28 disguise, chat mimic, kills A-D | SK40-SK44, PR22, s_skinrend (green) |
| S29 the cap and no spawn | SK02, SK03 (green) |
| S30 sight-edge flicker | SR05, P09, C13 (green) |

## Changed measurements inside passing tests (R18 -> S; every one read, none hidden)

`evidence/S0/r18_npm_test.txt` against `evidence/S3/npm_test.txt`, every note compared; these differ:
- PR04 (starving, kept in view): hunting 21.7/22.1/22/21.8/11.2/21.8 s -> 11.1-11.2 s before its kill - the contest takes it to the
  standing person's way out instead of straight at them; the kill itself is R18's (spring, wind-up).
- R9-01 (the owner's exposed ambush): 11 -> 8 of 12 runs with a covert way (the starving runs refuse the 10 s way round), still 0 px of a
  covert way in the person's sight.
- X07, PR18, P02, PR24: a way round fewer where it is now refused (X07: covert movement in 5 -> 4 runs; P02 at .55 seed 1: flank ->
  approach; PR18's starving run approach>feed without the flank).
- P09 (no stop-turn-walk loops): the plan sequences of its runs differ where a way round is now refused or dropped (0.7/1:
  approach>flank>approach>chase -> approach>intercept>approach>chase); flips 0 = 0, its kills as R18's.
- P10 (a sound): the body's fastest turn 5.8 -> 3.6 rad/s in one run - R18 began a way round the running person there (its withdrawal
  steers at 1.6 x its turn rate); S, seeing them move, does not.  Head timings identical.
- SK07: its admin debug block lists the R19 tallies (`contest`, `flankRefused`, `flankStale`) among the others.
- BR13, SK31, C13, C18, C27, P08, P16: small differences of seeded play after an earlier different choice (listed in the raw logs).
- L9 (inherited failure): the same exception; only the path in its stack trace differs (sanitized in the evidence).
- Y02, NV12, X09: timings of this machine (other jobs ran beside the suite); the performance comparison is `PERFORMANCE.md`.

## Ordinary play, simulated (`tools/prechase_sim.js --mins 180 --seeds 12 --log 1`; 3 x 36 h per tree)

One Skin-Stealer among two people playing as players do (exploring, meeting it, fleeing, hiding), seeded; R18 (`evidence/S0/sims/`)
and S (`evidence/S3/sims/`) on the same seeds.  Summed over the three sets (hunger from .55, from .7 with seeds 1-12 and 13-24):

| measure | R18 | S |
|---|---|---|
| ways round begun | 56 (17 / 17 / 22) | **7** |
| ... of them out of sight while the person moved away (the "clever but absent" detour) | 25 | **4** |
| ways round refused, with the reckoning in its record | - | 56 |
| stale ways round given up (`flankStale`); contests of a way out | - | 2; 3 |
| meetings / escapes / kills | 1847 / 1233 / 614 | 1924 / 1291 / 633 |
| somebody walking away: closed within 200 px | 162 of 399 (41 %), median 2.1 / 2.2 / 3.1 s | 165 of 387 (43 %), median 2.7 / 3.6 / 3.8 s |
| its pursuit, mean speed | 205 / 199 / 204 px/s | 203 / 204 / 204 px/s |
| exhaustions (its own stamina) | 15, 80 s exhausted | 7, 46 s |
| a vault set down late (R8-R18's stale vault, the `STALE` lines) | **22** | **0** |
| faster than its run (`OVER` lines): the engine's watchdog setting a body back on open floor at the mid tier | 0 | 2 (68-70 px, 1900+ px from everybody - DEFERRED) |
| a 5-20 px step of a roaming body at the mid tier, far from everybody (pre-existing; DEFERRED) | 3 (two at 2949-2969, 3720; one of 5 px at 7668, 4008) | 0 |
| ignored openings (a lit person within 500 px, hungry, not about them) | 0 | 1 (at .55; not traced further) |

What it means: the long way round after somebody moving is nearly gone (25 -> 4 absent detours in 108 h), the creature is not more lethal
(kills +3 % with 4 % more meetings), and it closes on somebody walking away as often (43 % against 41 %), 0.5-1.4 s later in the median -
it stares (watch) or comes on openly where R18 began a way round.  Its chase is R18's: the same pursuit speeds, every speed, stamina and kill rule
unchanged (WL06, C26, PR05).

## The S track's scenes, seed for seed (`tools/scene_r19.js`; `evidence/S0/scenes_r18.txt`, `evidence/S3/scenes_s.txt`)

| scene (8 seeds each) | R18 | S |
|---|---|---|
| the lit hall, standing, .7 (its way round kept) | killed 6/8 | 6/8, a way round in 8/8 |
| the lit hall, standing, .85 (Scene B) | killed 8/8, a way round of ~10 s in 5/8 | 8/8, came on openly (refused with its reckoning) |
| the hall, walking off looking back, .6 | killed 6/8 | **8/8** - it stays on a walker (R18 lost two: a way round dropped into the bait, then 9 s out of their sight) |
| the hall, walking off looking back, .75 | killed 8/8 | 8/8 |
| the hall, walking off its way round, .7 | killed 5/8 | 5/8 |
| the junction, sprint east (the side passage) / west (the hall) at 550 px | escaped 8/8 / 7/8 | **0/8** / 8/8 |
| ... at 450 px | 0/8 / 1/8 | 4/8 / 2/8 |
| ... at 350 px | 8/8 / 0/8 | 8/8 / 1/8 |

The walker at .6 and the junction's east exit are the two places where S is harder on the person than R18; a straight fresh sprint still
escapes (C26, PR05, the hall at 550 px); the owner's judgement is asked for both (HUMAN_QA S-A, S-D).
