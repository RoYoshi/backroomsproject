# Trial 3 behaviour refinement — regression report

Trial 3 is **not owner-approved**; this refinement awaits the owner's Human QA. Every result below was measured on this branch; nothing
here is a claim about how the game feels in play.

The runtime was changed twice after the behaviour work: never at B4 (tools, reports and evidence only), and once at **B5b**
(`ad9b69f`), which applied the fixes from an independent review (`CHECKPOINTS.md` § B5). **The results below are for the final runtime
(B5b)** unless a row says B4; the B4 runs (on the B3 runtime) are kept in `evidence/b4_*`.

## Summary

| Check | Result on the final runtime | Evidence |
|---|---|---|
| `npm test` | 202 / 215. The **13 failures are B0's inherited P9 failures, name for name**: P01, P08, H07, NV09, C1, C3, C4, C5, C9 / C10, C18, L9, 2F F13, 2F F22. Not fixed, not changed | `evidence/b5_npm_test.txt`, `b0_inherited_failures.txt` |
| New behaviour scenarios `s_skinbehave.js` | 19 / 19 (BR01–BR17, BR19, BR20; BR18 is the benchmark below). Every run's full record: `tools/br_dump.js` | `b5_npm_test.txt`, `b5_br_records.json` |
| The two checks added at B5b | BR08 (every defensive lunge less than 1.3 rad off the person) and BR15 (no stop to look while fleeing) **fail on the B4 code** — aims 1.55–3.13 rad off in 4 of 8 runs; 2851 ticks of looking while fleeing — and pass on the final code | `b5_new_checks_on_b4_code.json` |
| Trial 3's scenarios `s_skinstealer.js` | 34 / 34; the 34 notes identical to B4's (and 32 of 34 to B0's: SK07, the debug block's new fields; SK25's fourth seed, a look at the wanderer, its plans within every limit) | `b5_npm_test.txt`, `b4_npm_test.txt` |
| `npm run test:humanqa` | 5 / 6; X03 fails exactly as on P9 and Trial 3 (inherited) | `b5_humanqa.txt` |
| Build, `build:check` (44 outputs), parts, modules, facts, window contract, docs, API contract, scope | PASS | `b5_static.txt` |
| Fast modernization gate (21 steps) | PASS on `ad9b69f` in 17 min 50 s (and on `67250ce` at B4) | `b5_gate_fast.*`, `b4_gate_fast.*` |
| Full gate | **not run**, by instruction (hours long; nothing here touched the shared engine, the page or the network) | |
| Hound and Smiler against P9 (`equiv_p9.js`, 6 seeds × 120 s) | PASS: identical tick for tick, 7200 snapshots (its self-test at B4: a 1 px move told apart on all 6 seeds) | `b5_equiv_p9.*`, `b4_equiv_p9_selftest.txt` |
| BR19 (a provoked Skin-Stealer and the rest of the world) | two Hounds and two Smilers identical over 1800 ticks, provoked or left alone | `b5_npm_test.txt` |
| Server cost against Trial 3 (`perf_br.js`) | two runs of the same matrix: the first **FAILED** one criterion by noise (below), the second passed | `b5_perf_br.*`, `b5_perf_br_run2.*` |
| 600 s soak, 4 Skin-Stealers, 8 players pressing them all the time | PASS after a tool correction (below): 0 violations | `b5_soak_br.*`, `b5_soak_br_run1.*` |
| Real pages: the refinement (`behave_browser.js`) | final run 9 / 9 with every check exercised (a warning, two withdrawals, a strike with its tell, the death); earlier runs below | `b5_behave_browser_run4.*`, `b5_shots_run4/` |
| Real pages: Trial 3's 40 checks (`skin_browser.js`) | 40 / 40 on the final runtime (its first attempt stopped in setup, below) | `b5_skin_browser.*`, `b5_skin_browser_run1_crash.txt` (B4: `b4_skin_browser*`) |

## The behaviour, seed by seed (`s_skinbehave.js`, real simulation; final code)

| Scenario | What it shows |
|---|---|
| BR01 one pass | 8 / 8 passed within 200 px (closest 99–118 px): no look at the person, one at their footsteps after; no strike, kill or hunt |
| BR02 circling | 8 / 8: first look 0.3–2.0 s after it first saw them close; 2–5 looks; its head on them while walking; warned 1–3 times; 2 of 8 killed in defence after their warnings |
| BR03 while leaving | circled while leaving: 2–5 looks, the same departure after each (6 / 6); followed right behind: 2 looks, the same departure after each (6 / 6) |
| BR04 no thrashing | far in view: nothing; one pass: 0–1 looks, no plan change |
| BR05 on its cooldown list | seen 67–192 samples: looked at 2–6 times, hunted 0 times; warned 1–4 times; 5 of 6 followers killed in defence after warnings |
| BR06 / BR07 unsensed | behind a wall or out of sight: identical to nobody there (16 / 16); footsteps behind a wall: a look toward the noise (97–169 px off them), no record, no name |
| BR08 satiated defence | hunger exactly 0 at the start, only ever rising with time; 8 / 8 every defence after a warning, 1.0–1.9 s after it ended, at 66–70 px, seen, a clear way, a 0.5 s wind-up, aimed within 0.11 rad of the person while they closed at 84–171 px/s; 8 of 8 ended in a defensive kill at contact (7 at the first decision, 7.6–10 s; one after a withdrawal, at 35 s). Over 200 seeds of the same driver: a strike first in 73 (36 %), 157 killed within the minute, median 33 s (`b5_defence_200_seeds.json`) |
| BR09 backing off | warned after 6.0–7.3 s of pressing; 15 s after the warning (they backed off after it), pressure 0.07–0.09; followed 0 times |
| BR10 walls | ready to defend against somebody across a corner or a low obstacle in 6 of 9 runs (23–135 ticks): sprung at 0 times; 8 defensive kills, all at contact with a clear way |
| BR11 a brush past | 8 / 8 bumped (23–25 px): one look, no warning, no strike |
| BR12 bystander | the bystander peaked at 0–0.18, never warned, struck or killed; only the presser was |
| BR13 three minutes of a returning harasser | warnings never closer than 5.4 s; at most 1 record; one defensive strike per run, after a fresh warning |
| BR14 a very hungry departure | gave up for a newcomer it saw (3 of 4; kept it once when it thought again); never for a hidden person while hunger passed 0.8 (0 / 4); never after a lost race (0 / 4) |
| BR15 dodging the wind-up | 8 / 8 made it miss; recovery 0.96–1.3 s; 2.1–3.0 s before another spring; then it left fast, stopping to look 0 of 14 738 ticks |
| BR16 death and corpse | 5 / 5 killed in defence and left the game at once: one kill event, cause SkinStealer, the server's one corpse; it fed |
| BR17 in a skin | circled at 110 px: no reaction, walks up openly, its lines its own |
| BR20 nothing stale | leaving the game, a minute far away, an admin clear, a removal, a world reset: the pressure goes |

**What B5b changed in these figures** (B4's notes against the final ones): BR08 went from 4 of 8 kills (every miss a lunge 1.6–3.1 rad
away from somebody walking at it — the aiming bug) to 8 of 8; BR02, BR03, BR05, BR10, BR12, BR13, BR16 and BR19 changed with the creature's
choices (fewer looks while it flees; strikes that land; the presser's pressure by their own motion). B3 / B4's BR03 read 5 / 6 circling
runs: a defensive withdrawal had ended one departure with a new one; it is 6 / 6 again. Every scenario's bar is the one it had at B3.

## Performance (BR18)

`tools/perf_br.js`: the server's 60 Hz step alone (wall time), Trial 3 (a detached checkout of `020b5b5`) against this branch,
interleaved round by round in separate processes, medians of 5 rounds × 60 s, 8 scripted players, director on, seed 7. Node v22.22.2 on a
shared 2-CPU cloud machine; no GPU is involved (server only).

| Skin-Stealers | B5 run 1: Trial 3 / refinement, mean ms (p99 ms) | B5 run 2 | B4 run (B3 runtime) |
|---|---|---|---|
| 0 | 0.182 (1.84) / 0.193 (1.83): +5.8 %, inside the 0.022 ms tolerance — same cost | 0.189 / 0.188: −0.7 % | −2.4 % |
| 1 | 0.225 (2.16) / 0.245 (2.55) — within the budget | 0.239 (2.75) / 0.229 (2.00) | +1.2 % |
| 4 | 0.320 (3.56) / 0.319 (**4.32**) — **p99 over the 4.175 ms budget: FAIL** | 0.313 (3.14) / 0.317 (3.04) — PASS | +1.8 % |
| 4, every player pressing one | 0.382 (4.45) / 0.334 (3.45): −12.6 % | 0.392 (4.50) / 0.327 (3.28): −16.6 % | −20 % |
| verdict | **FAIL** | **PASS** | PASS |

**The failure, stated plainly.** In B5 run 1 the refinement's median p99 with four Skin-Stealers was 4.32 ms against the 4.175 ms
budget (25 % of the 16.7 ms step), while its median mean step was 0.319 ms against Trial 3's 0.320 ms. Across the two runs the per-round p99 swings
between 2.4 and 4.4 ms on **both** trees on this machine (Trial 3's own was over the budget in 2 of the same 5 rounds: 4.40 and 4.43 ms). Run 2,
the same command a few minutes later, passed (3.04 against 3.14 ms). The B5b change adds a handful of arithmetic per defence decision.
We read it as measurement noise at the p99 level, not a cost; the p99 criterion is too close to this machine's noise to tell the trees
apart, and we did not change it.

**A rule set at B4 after a first run.** The pressing case has no earlier budget; Trial 3's own median p99 exceeds it there (4.44–4.50 ms in
four runs). Since B4's first run it is judged against Trial 3 on the same seed (`b4_perf_br_run1.*`). The pressing comparison is not
like for like by design: Trial 3's creatures ignore the pressers, this branch's warn and sometimes kill them, and the dead cost less.
The snapshot's entity part is the same size, and +11 bytes when pressed (the `PROVOKED` state and acts already in the format). The
worst single step (8.7–29 ms on both trees) is reported, not judged.

**Soak, 600 s, 4 Skin-Stealers, 8 players pressing them the whole time** (final run): mean 0.216 ms, p99 1.42 ms, worst 10.9 ms;
0 violations; at most 4 awareness records (the cap), pressure at most 1.2. Their record: 34 looks, 33 looks at sounds, 95 warnings,
20 defensive strikes (20 hits), 20 withdrawals, 21 kills (20 defensive, 1 by Trial 3's hunt: its record shows a grab, a pounce and a miss, so which of the two is not recorded), 0 skins. **Its first run reported 2
violations** ("inside geometry", one creature at 458 s and 496 s). A trace showed both were mid-vault over a low obstacle — Trial 3's own
`CAN_VAULT` traversal (`e.trav`), during which the creature is above the obstacle, not in it; perf_t3.js's invariant, which this tool
copied, did not allow for it. The tool now skips mid-vault samples and counts them (4 in the final run); outside a vault the creature
was never inside geometry. Trial 3 on the same pressing seed (B4): mean 0.215 ms, p99 1.30 ms, 5 Skin-Stealer kills, no warnings.

## Real pages

**`behave_browser.js`** (real server, headless Chromium with SwiftShader, two 640×360 pages, a synthetic passcode). The creature is
satiated by the game's own means (a SKIN death preview on the first page, a real kill, about 3 s of feeding, then the second page
disturbs the meal). The second page moves by its own key events, circles for 15 s, then presses in at 65 px. Four runs on the final
runtime, all kept:

| Run | Result | What happened |
|---|---|---|
| 1 | 8 / 9 — **tool fault** | warned at 8.2 s; struck (odds 0.43) and killed it at 17.7 s (the overlay drew `DEFENCE P2 struck`, `ON ITS KILL C`); the tool's half-second samples stopped at the death and missed the decision. Fixed: every decision is now taken from each debug packet |
| 2 | 9 / 9 | warned at 19.9 s; withdrew at 28.6 s (0.43); no strike or death in the rest of the run, so two checks had nothing to check (they say so) |
| 3 | 8 / 9 — **tool fault** | warned; withdrew at 18.6 s (0.43) and 49.8 s (0.65); struck at 78.9 s (0.86), its wind-up and 11 sounds, the death at 79.7 s; the tool counted the one strike three times (stale debug after the death) and found no wind-up for the copies. Fixed: decisions under 9 s apart are one (the game keeps them 10 s apart) |
| 4 (final) | **9 / 9, every check exercised** | a look 0.6 s in; warned at 9.2 s; withdrew at 17.5 s (0.34) and 42.8 s (0.55); struck at 69.4 s (0.77) with its wind-up on the wire and 9 sounds; the person's own death at 70.2 s named the Skin-Stealer (A); the AWARE and DEFENCE overlay lines; no page error |

Screenshots at the warning and the wind-up (`b5_shots_run4/`) show the overlay's lines and event log more than the creature's pose at
640×360; how the warning reads from above is for the owner. B3's run (B3 runtime) struck at 19.8 s and killed; B4's withdrew, then
missed — the strike that missed was the aiming bug.

**`skin_browser.js`** (Trial 3's 40 checks, unchanged tool), final runtime: **40 / 40** in 13 min 28 s. Its first attempt stopped
with no result after 2.5 min: in the death section's setup the victim's page had its `#caught` overlay (the page's death screen)
over the admin panel's unlock button, so the click timed out. That section leaves the room's Hounds and Smilers in place until it
freezes the world, and places the Skin-Stealer only after the freeze; which of them caught the victim was not recorded. The rerun of
the whole tool passed. At B4 (B3 runtime) the full run was 39 / 40, the death section rerun 9 / 10 then 10 / 10: two different single-sample timing checks of a death
played in a frozen world (frames about 105 ms apart against an 80 ms window), with no change in the death, replay or corpse path.

## Exceptions and what was not run

* The full gate was not run (by instruction). Its browser steps, CLI mutants and live wire were last run on Trial 3.
* The contact-lab stochastic issue was not exercised (only the full gate runs it).
* `chat_server.js` ran inside the fast gate's chat step (100 / 100 cases, 14 / 14 mutants), not separately.
* No real GPU and no phone were used; the performance figures are the server's alone.
* Owner Human QA: not done. Nothing here is accepted.
