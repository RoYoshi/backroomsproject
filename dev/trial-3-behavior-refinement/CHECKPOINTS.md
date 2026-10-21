# Trial 3 behaviour refinement — checkpoints

Branch `trial-3-behavior-refinement`, created from the unapproved Trial 3 head `020b5b533a3ab1e8edaaa7dd6a02bf29070421fc` (tree
`26234cdcd68b59727c68bbd21662b980d8d28bbe`). Pushed only fast-forward, never forced. After each push `tools/verify_remote_br.py` reads
the branch back from GitHub (SHA, tree, parent, one straight line from `020b5b5`, every protected ref and every other branch unchanged)
into `evidence/remote/`; the secret scan runs before and after each push (`evidence/scans/`). A commit cannot name its own hash: each
row is filled in by the next checkpoint (the last by a receipt commit).

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| B0 audit, plan, reproduction, baseline | `4e4a1cf31f856ba8b552ae30ce0e20a2424b5467` | `d7e7a9cc62d8daeacb2be7400a67b48f6cfd15d6` | `020b5b5` | yes: `evidence/remote/b0.json` (ls-remote and the GitHub API agree; one line from `020b5b5`; every protected ref at its head; no other branch moved or new); secret scan of the pushed commit CLEAN |
| B1 awareness while it roams or leaves | `0d6f7b9f00ee34318975a5b157bfe548ab0e20d7` | `9672dbbd20b83ebd7cce8ebee6e70304c7ef8cdf` | `4e4a1cf` | yes: `evidence/remote/b1.json`; secret scan of the pushed commit CLEAN |
| B2 provocation, warnings, fading, the very hungry departure | `17563927677a45c32fa561467b1c60a9aa81f73c` | `d0696e246d3cdefa0840216344dae9672626e40e` | `0d6f7b9` | yes: `evidence/remote/b2.json`; secret scan of the pushed commit CLEAN |
| B3 defence | `67250cef964f0b9f41315bb684857b90ce01def1` | `790fc69cd12b2fbc122774f54822d5da273e4a1d` | `1756392` | yes: `evidence/remote/b3.json`; secret scan of the pushed commit CLEAN |
| B4 integrated regression and performance | `ece46ac87ccef19d5273ed12c19712e08b4111c5` | `54733cbd1c46911e9c5c2802d86258ee82b5c7e8` | `67250ce` | yes: `evidence/remote/b4.json`; secret scan of the pushed commit CLEAN (its before-push scan, `scans/b4_pre.txt`, of the same commit, arrives with B5) |
| B5a reports for the owner (an independent review in progress) | `fcc92be2a84a7903a9afca29a9c11c962d387dc6` | `8099089b7f5dad3b014cdfa85cad9b3894d14ffd` | `ece46ac` | yes: `evidence/remote/b5a.json`; secret scan of the pushed commit CLEAN |
| B5b fixes from the independent review (runtime change) | `ad9b69fcbdcb46ab3e5ea2dc92fdec89413e002a` | `cdbd335066b7e331fed11a7db52b1b200bdc6284` | `fcc92be` | yes: `evidence/remote/b5b.json`; secret scan of the pushed commit CLEAN |
| B5c final reports and evidence | `e85c74020e73d82defbdf86a885e039349a6ecb9` | `ff5ade0e227902667ea8aedd3c3ea080e904cf21` | `ad9b69f` | yes: `evidence/remote/b5c.json`; secret scan of the pushed commit CLEAN |
| Receipt (B5c's read-back and scans; this row) | this commit — its own read-back is in the handoff message, not in the tree | | `e85c740` | after its push |

## B0 — audit and plan, no game change

Changed: only `dev/trial-3-behavior-refinement/` (this file, `AUDIT.md`, `PLAN.md`, `BALANCE_TABLE.md`, `tools/repro_b0.js`,
`tools/verify_remote_br.py`, `inventory/remote_heads_before.json`, `evidence/`). The runtime is Trial 3's, byte for byte.

| Run (on `020b5b5`) | Result |
|---|---|
| `tools/repro_b0.js` (6 seeds) | the owner's report reproduced: seen close while leaving 40–307 times (10 Hz samples) per run, it never stopped to face them; one departure goal; seen close while roaming with them on the cooldown list 3–140 times; at hunger 0, a person in arm's reach about 13 s: no response. Blind controls: behind wall A, never seen or heard, identical to the run without them in 6 / 6 seeds (`evidence/b0_repro_trial3.txt`, `.json`; `AUDIT.md` §3–4) |
| `npm test` | 183 / 196 in 6 min 4 s. The 13 failures, by name, are the inherited P9 ones (`evidence/b0_inherited_failures.txt`): P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22. Every Skin-Stealer scenario SK01–SK44 passes (34 / 34) (`evidence/b0_npm_test.txt`) |
| `npm run test:humanqa` | 5 / 6; X03 fails as on P9 (`evidence/b0_humanqa.txt`) |

Every later checkpoint compares its `npm test` failures with these 13 names exactly.

## B1 — awareness while it roams or leaves (no attack)

Changed: `src/frameworks/nani/server/ai.skinstealer.js` (→ `generated/server/ai.js`): `SK` gains the B1 values; `e.aw` (records),
`e.rx` (a reaction), `e.awRng` (its own stream); `skAware` (before the decision: records fade; everyone it sees now in its space - those on
its hunt cooldown too - updates one, from their seen body only), `skAttend` (after the decision: a look at the person it has noticed most,
or at a fresh sound; only while it roams or leaves and is not in a skin), `skReact` (the look: it stops, faces, `watch`, its route kept),
`skGaze` (its head toward a noticed person while it walks), the debug block's `aw`, `awN`, `rx`; `onFar` / `onClear` drop the reaction (and
on clear the records). `src/frameworks/overseer/client/ents.debug.js` (→ `public/ents.js`): one debug line, AWARE. `dev/tests/s_skinbehave.js`
(new, BR01–BR07) and `dev/tests/run.js` (its name in the default list). `dev/tools/gate/declared_changes.json` (ai.js, ents.js notes).
Nothing in `ai.senses.js`, `ai.engine.js`, `ai.capture.js`, the Hound, the Smiler or the page's art and sound.

Two values were added to the proposal. `pFast` (1.6): without it a runner circling at 130 px was first looked at up to 3.3 s after it
first saw them close (3 of 8 seeds over 3 s); with it, 0.4–2.0 s. `rxGap` (1.5 s, sounds only): a look at somebody walking right behind it
was sometimes followed 0.06 s later by a look at their footsteps (a trace of BR03's tail, seed 3); now a sound can turn it only 1.5 s after
any reaction has ended. (Applied to every reaction, it held back the first look at a circling runner behind an earlier look at their
footsteps - 1.6–5 s - so it applies to sounds only.) BR03 also stopped counting a look still in progress when the run ends.

| Run | Result |
|---|---|
| `dev/tests/s_skinbehave.js` BR01–BR07 | 7 / 7 (`evidence/b1_br.txt`): a pass at 99–118 px: no look at the person, one at their footsteps after, no strike / hunt; circling: first look 0.4–2.0 s after it first saw them close, 3–4 looks in 22 s, head on them while walking; while leaving (circling, or walking right behind it): 3–4 looks, every one followed by the same departure (12 / 12 runs); far off in view: nothing; on its cooldown list and following: looked at 7–10 times, hunted 0; behind a wall or still out of sight: identical to nobody there (16 / 16, never sensed); footsteps behind a wall: a look aimed 97–169 px from where they were, no record, no reaction to them as a person |
| `dev/tests/s_skinstealer.js` | 34 / 34; 32 of the 34 notes identical to B0's; SK07 differs only by the debug block's new fields; SK25's fourth seed by the creature looking at the wandering person (its plans still within every limit) |
| `npm test` | 190 / 203 (`evidence/b1_npm_test.txt`); the 13 failures are B0's, name for name |
| build, `build:check` (44 outputs), parts, modules, facts, window contract, docs, API contract, scope | PASS |

## B2 — provocation, warnings, fading, the very hungry departure (no attack)

Changed: `ai.skinstealer.js` (→ `generated/server/ai.js`): `SK` gains the B2 values; the record keeps updating within 300 px once begun
in its space; pressure by kind with ceilings (in its space and crowding by how much *they* closed the distance lately; circling by their
motion relative to its own, round it, one way, counted only while seen; following it as it walks; moving into its way; pressing in after a
warning); the fade over all the time since it last saw them; `skWarn` (the warning) and `skReactEnd` (at its end it takes another way out:
the departure's goal is re-picked by `skLeaveGoal`, split out of `skLeave` with the same draws in the same order; roaming, it leaves);
`skDecide` thinks a very hungry departure over only on fresh sight of somebody it may hunt (after `leaveDwell`, at most once a second,
never after a lost race: `skLeave(...).race`); debug: tier names, warnings, `lv` (why a departure was kept or given up).
`ents.debug.js`: the AWARE line shows warnings and `LEAVE:`. `s_skinbehave.js`: BR09, BR11–BR14, BR20. `declared_changes.json`: notes.

Found and fixed while building B2, each by a scenario:
* *BR12:* a bystander standing still that the creature backed into while warning somebody else reached 0.65 (crowding) and was warned
  (2 of 6 seeds). Pressure in its space and crowding now count only as much as the person closed the distance lately (`byThem` against
  `byIt`); blocking needs the person to be moving. The bystander now peaks at 0.17–0.18.
* *BR20:* the fade used the think's step clamped to 0.25 s, so a person away for a minute (the creature far) kept nearly all of their
  pressure (0.198 a minute later). The fade now counts all the time since its last look at them; the record is also dropped after 30 s.
* Test drivers, not the creature: BR11's "bump" had followed the creature (aimed at its centre: 1.2 pressure, 2 warnings) - it now brushes
  past 25 px off; BR14 judged a departure on every tick after it had ended by arrival - it now judges the moment it ends; its newcomer is
  placed 180 px beside the creature's route, because a hungry one grabs whoever is in its reach (Trial 3's rule, unchanged), and a grab is
  reported as such.

| Run | Result |
|---|---|
| `s_skinbehave.js` BR01–BR07, BR09, BR11–BR14, BR20 | 13 / 13 (`evidence/b2_br.txt`): BR01–BR07 as at B1; pressing in at 70 px is warned after 6.0–7.3 s (peak 0.46–0.57), 15 s after they back off 0.07–0.09, nothing follows them; a brush past at 23–25 px: one look, no warning (peak 0.18–0.41); a bystander peaks at 0.17–0.18, never warned; three minutes of pressing: 29–30 warnings, never closer than 5.3 s apart, at most 1 record, reacting 45–46 % of the time, 35 places; a very hungry departure gave up for a newcomer it saw (3 of 4; the fourth kept it when it thought it over), never for a hidden person while its hunger passed 0.8 (0 / 4), never after a lost race (0 / 4); nothing stale after leaving the game, a minute far away, an admin clear, a removal or a world reset |
| `s_skinstealer.js` | 34 / 34; the same 32 notes as B0's; SK07 (debug fields) and SK25's fourth seed differ as at B1 |
| `npm test` | 196 / 209 (`evidence/b2_npm_test.txt`); the 13 failures are B0's, name for name. (A comment in the species header was reworded after this run; the code it ran is the code committed; SK and BR were run again on the final build: 47 / 47, the BR notes identical) |
| build, `build:check`, parts, modules, facts, window contract, docs, API contract, scope | PASS |

## B3 — defence

Changed: `ai.skinstealer.js` (→ `generated/server/ai.js`): `SK` gains the B3 values; `skCornered`; `skDefend` (on its think after
`skAware` and before `skDecide`: the conditions of `PLAN.md` §4; strike or withdraw from its own stream; it sets the per-person and the
overall cooldowns); `skSpring` gives the style `defend` its own wind-up, lunge and stamina cost; `skStrikeStep` lets a defence catch only
its person, counts its hits and misses, and after a miss `skDecide` makes it leave them at its tired run (`P.fast`); a kill ends that
person's awareness record; debug `df` and the tier `threatened`. `ents.debug.js`: one more line, DEFENCE. `s_skinbehave.js`: BR08, BR10,
BR15–BR17, BR19; BR13 now lets the harasser come back after each death. `declared_changes.json`: notes. New tool
`tools/behave_browser.js` (B4's real-page check, first run here).

**Two B1 scenarios changed with the behaviour, not weakened:** BR02 (somebody circling it for 22 s) and BR05 (somebody following it 90
px behind for 50 s) asserted "no kill", because B1 had no defence. From B3 such long harassment may end in a defensive kill, as the owner
decided; both now assert that any kill is the person under test, made by a defensive strike, after at least one warning - and keep
every awareness check they had. Measured: BR02 killed 2 of 8 circlers (after 1 warning each), BR05 4 of 6 followers.

Test-driver corrections found while building B3: BR08 measured hunger drift on the first callback, before any step (it reported the
rate itself as drift); BR15 measured the 25 s cooldown from the miss instead of from the defence's start, and judged the plan before the
decision that follows recovery; BR16 expected the creature still at its meal at 60 s; BR19 compared Hounds and Smilers that the
Skin-Stealer's own (legitimately different) path came near - they are now placed more than 2000 px from anywhere it goes, and the
scenario reports how close it came. No creature behaviour was changed for these.

| Run | Result |
|---|---|
| `s_skinbehave.js`, 19 scenarios | 19 / 19 (`evidence/b3_br.txt`). BR08: in 8 of 8 runs every defence came after a warning (1.0–3.3 s after it ended), within reach, seen, with a clear way, its hunger begun at exactly 0 and risen only with time (0.011–0.015 at a first defence, 0.096 for one at 59.8 s); 4 of 8 runs ended in a defensive kill at contact (the earliest after 7.5 s of pressing), the others in misses and withdrawals. BR10: 5 of 9 runs had it ready to defend against somebody it saw within reach across a corner or a low obstacle (13–53 ticks): sprung at 0 times; 11 defensive springs, 5 kills, all at contact with a clear way. BR15: 8 of 8 who broke away at the wind-up made it miss; recovery 0.96–1.3 s, 2.1–3.0 s before another spring, then a fast departure, no defence against them within 25 s although they came back. BR16: a defensive kill whose victim leaves the game at once: one kill event, cause SkinStealer, the server's one corpse, the creature fed. BR17: in a skin, circled at 110 px: no reaction, it walks up openly, its lines its own. BR19: provoked (5 looks, 5 warnings, one defensive decision) against left alone: two Hounds and two Smilers identical over 1800 ticks |
| `s_skinstealer.js` | 34 / 34; the same 32 notes as B0's |
| `npm test` | 202 / 215 (`evidence/b3_npm_test.txt`); the 13 failures are B0's, name for name |
| `tools/behave_browser.js` (real server, headless Chromium, two 640x360 pages; first run) | 9 / 9 (`evidence/b3_browser_smoke.json`): moved by the page's own keys; a look 2.4 s after it came close, 3 while circling, its head turned; a warning on the wire at 16.7 s (state PROVOKED, act creep); a defence at 19.8 s (strike, odds 0.45) with its wind-up on the wire and its sound (12 noise sources); the person's own death 1 s later named the Skin-Stealer; the overlay drew AWARE (noticed, provoked, warned 1x) and DEFENCE lines; no page error. Three earlier runs of the new tool failed on the tool itself (a 1280x720 software-rendered page too slow for its own steering; the creature allowed to earn a skin before the person came; the overlay's own switch not on) |
| build, `build:check`, parts, modules, facts, window contract, docs, API contract, scope | PASS |

## B4 — integrated regression and performance (no game change)

Changed: `dev/trial-3-behavior-refinement/` only — new `tools/perf_br.js` (BR18: the server's cost against Trial 3, and the soak);
`tools/behave_browser.js` takes a screenshot at the warning and at a wind-up when `--shots` is given; the reports `BEHAVIOR_DECISIONS.md`,
`CHANGED_FILES.md`, `REGRESSION_REPORT.md`, `HUMAN_QA.md`, `DEFERRED.md`; evidence. The runtime is B3's byte for byte. Comparison trees
were detached worktrees outside the repository: P9 (`1ff9374`, tree `d6b71b8`) and Trial 3 (`020b5b5`, tree `26234cd`).

| Run | Result |
|---|---|
| `npm test` | 202 / 215 (`evidence/b4_npm_test.txt`); the 13 failures are B0's, name for name (compared line by line); the 53 SK and BR notes identical to B3's |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 (`evidence/b4_humanqa.txt`) |
| build, `build:check`, parts, modules, facts, window contract, docs, API contract, scope | PASS (`evidence/b4_static.txt`) |
| fast gate | PASS, 21 steps, 17 min 39 s, on `67250ce` (`evidence/b4_gate_fast.txt`, `.json`) |
| `equiv_p9.js` against P9 | 6 / 6 seeds identical tick for tick (7200 snapshots); self-test 6 / 6 (`evidence/b4_equiv_p9*.txt`) |
| `tools/perf_br.js` (5 rounds × 60 s, 8 players, seed 7) | PASS: without a Skin-Stealer −2.4 % (tolerance 0.03 ms); one +1.2 %, four +1.8 % (mean), within the 60 Hz budget; four with every player pressing one −20 % against Trial 3 (`evidence/b4_perf_br.*`). Its first run applied the absolute budget to the pressing case as well and failed it (p99 4.37 ms against 4.175 ms; Trial 3's own 4.61 ms); that case is now judged against Trial 3 (`REGRESSION_REPORT.md`; the first run kept as `b4_perf_br_run1.*`) |
| soak, 600 s, 4 Skin-Stealers, 8 players pressing them | PASS: 0 violations, at most 4 records, pressure at most 1.2, mean 0.158 ms (`evidence/b4_soak_br.*`; Trial 3 on the same seed `b4_soak_t3_same_seed.json`) |
| `tools/behave_browser.js` | 9 / 9 (`evidence/b4_behave_browser.*`, `b4_shots/`) |
| Trial 3's `skin_browser.js` | 39 / 40; then the death section twice: 9 / 10 and 10 / 10 — two different single-sample timing cases of a death played in a frozen world (`REGRESSION_REPORT.md`; `evidence/b4_skin_browser*`) |

Noted at B4, from B3: BR03's sixth circling run now ends one of its looks with a warning and a defensive withdrawal (a new departure),
so BR03 reads 5 / 6 (its bar since B1) where B1 and B2 read 6 / 6.

## B5 — the owner's handoff, an independent review, and its fixes

**B5a** (`fcc92be`, no game change): `BEHAVIOR_DECISIONS.md`, `HUMAN_QA.md`, `CHANGED_FILES.md`, `DEFERRED.md`, and B4's read-back,
committed while an independent review ran (a separate agent that had not built the work read the code, the reports and the evidence,
re-ran the BR suite, and checked the owner sheet against the admin UI's code).

**The review** found nothing blocking (no cheating path; every defence condition present; scope respected) and these, all acted on:

| Finding | Done |
|---|---|
| The defensive lunge was led a fixed 0.6 s, so somebody walking straight at it was reckoned behind it and it sprang away from them (every BR08 miss: 1.6–3.1 rad off; every hit at ≤ 90 px/s) | **fixed at B5b**: reckoned to the moment it reaches them (the pounce's own rule), never past itself; BR08 now requires every lunge aimed less than 1.3 rad off them (0.02–0.11 measured; a right lead for a fast sideways mover is up to about 1 rad, the old aim was 1.55–3.13 rad off) |
| "Pressing in after a warning" counted the creature's own approach | **fixed**: the person's own motion, × blame |
| A warning cut short by a change of plan still counted as given | **fixed**: it counts only if it lasted 1.2 s (`warnTime[0]`) |
| A withdrawal could be interrupted by looks at the person it flees | **fixed**: no look while fleeing (head still turns); warnings still possible when chased down (so a pursuer can still be defended against). BR15 now checks it |
| `e.defLeave` not cleared by far / clear; the debug LEAVE text never cleared; the header claimed a caution term the odds do not have | **fixed** |
| "`DATA=1` prints each run's record" was false (only for failures); BR08's detail figures not in the evidence | corrected; new `tools/br_dump.js` writes every run's record (`evidence/b5_br_records.json`) and runs BR08's driver over 200 seeds (`b5_defence_200_seeds.json`) |
| Two browser checks passed with nothing to check | the tool now takes every defence decision from each debug packet, checks every strike's tell, and says when nothing was there to check; the final run exercised all nine |
| Wording: the pressing case's Trial 3 p99 (one round, not the median); the absolute budget miss not shown; balance-table figures from B2; "relative" motion where the code uses their own; the aggression jitter; BR09's "after backing off"; the head turn not disclosed; DEFERRED calling our reading "the approved decision"; HUMAN_QA missing ENTITY LABELS: FULL, the `-` tier, the skin time after a preview | corrected in `REGRESSION_REPORT.md`, `BALANCE_TABLE.md`, `BEHAVIOR_DECISIONS.md`, `CHANGED_FILES.md`, `DEFERRED.md`, `HUMAN_QA.md` |
| Circling counts motion relative to the creature's own | kept (a straight pass cannot reach it; the creature does not walk circles round people); stated in `DEFERRED.md` |

**B5b** (`ad9b69f`, the runtime change; only `ai.skinstealer.js` and its build, the tests and the tools). Checked on that runtime:

| Run | Result |
|---|---|
| the two new checks on the B4 code | both fail (aim up to 3.13 rad off; 2851 ticks of looking while fleeing): `evidence/b5_new_checks_on_b4_code.json` |
| `npm test` | 202 / 215; the 13 failures are B0's, name for name; the 34 SK notes identical to B4's; BR 19 / 19 (`evidence/b5_npm_test.txt`) |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 |
| build, `build:check`, parts, modules, facts, window contract, docs, API contract, scope | PASS (`evidence/b5_static.txt`) |
| fast gate | PASS, 21 steps, 17 min 50 s, on `ad9b69f` (`evidence/b5_gate_fast.*`) |
| `equiv_p9.js` | 6 / 6 seeds identical tick for tick |
| `tools/perf_br.js` | run 1 **FAIL**: with four, the median p99 4.32 ms against the 4.175 ms budget (mean 0.319 against Trial 3's 0.320 ms; Trial 3's own p99 over the budget in 2 of the same 5 rounds); run 2 PASS. Both kept; `REGRESSION_REPORT.md` |
| soak 600 s | run 1: 2 "inside geometry" samples, both mid-vault (Trial 3's `CAN_VAULT`, `e.trav`): the invariant now skips and counts mid-vault samples; run 2 PASS, 0 violations (`evidence/b5_soak_br*`) |
| Trial 3's `skin_browser.js` | 40 / 40 (`evidence/b5_skin_browser.*`); a first attempt stopped in the death section's setup (the victim already caught before the freeze, the unlock click covered): `b5_skin_browser_run1_crash.txt` |
| `tools/behave_browser.js` | runs 1 and 3 failed on the tool (a decision missed before a death; one strike counted three times), both fixed; run 2 9 / 9 (a withdrawal only); run 4 9 / 9 with every check exercised: withdraw, withdraw, strike with its tell, the death (`evidence/b5_behave_browser*`) |

**A second review pass** (the same reviewer, on `ad9b69f` and the reports) found the fixes correct and nothing blocking; it re-ran its own
aim check (all 8 BR08 seeds hit, 0.02–0.11 rad). Acted on in B5c: BR08's aim bar was 0.8 rad, which a correct lead for somebody moving
fast sideways (up to about 1 rad) would have failed, so it is now 1.3 rad — the BR suite again 19 / 19 with notes identical
(`evidence/b5_br_final_threshold.txt`), and it still fails the B4 code in 4 of 8 runs (aims 1.55–3.13 rad;
`evidence/b5_new_checks_on_b4_code.json`, rerun). Wording: the lunge is about 72 px (it slows through it), the first defence typically
7.5 s in but 6.9–20.8 s over 200 seeds, Trial 3's median p99 in the pressing case 4.44–4.50 ms, the per-round p99 swing 2.4–4.4 ms,
the soak's one non-defensive kill a grab or a pounce (not recorded which), and that a warning cut short still counts in the warning
tally and delays the next. The reviewer stressed that the defence is now the biggest behaviour change: every finished strike landed on
a person who did not dodge (157 of 157).

**Stop.** ENGINEERING COMPLETE — AWAITING OWNER HUMAN QA. Trial 3 remains NOT OWNER-APPROVED; the refinement awaits Human QA. Nothing
was merged or deployed; no protected branch moved (every read-back above).
