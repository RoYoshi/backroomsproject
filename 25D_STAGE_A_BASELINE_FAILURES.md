# Stage A baseline failure ledger

All observations refer to the supplied pristine v23.3.6 extraction or byte-identical runtime files. No old threshold or assertion was changed. PRE-EXISTING EXPECTED is a baseline classification, never a passing product verdict. Sample-sensitive does not mean randomly flaky: all 11 selected aggregate failures repeated in a second fresh process (0/11). Only L5c changed outcome on retry.

## P01 — PRE-EXISTING EXPECTED

P01 noticing distance: run > walk > crouch (resting hound, corridor)

Observed: run 1687px  walk 1689px  crouch 1671px

Evidence: STAGE_2F_REPORT.md §24.

Sample-sensitive visible-light saturation/ordering gate; same numbers on selected rerun.

## P07 — PRE-EXISTING EXPECTED

P07 exhausted breathing is audible only close by

Observed: 900px away: 0 sounds; 180px away: 0

Evidence: STAGE_2F_REPORT.md §24.

Historical fixture can kill its nearby subject before the breath event. Current close/far sample still 0/0.

## P08 — UNKNOWN / NEEDS INVESTIGATION

P08 memory: the last known position is used, then goes stale; the hound gives up and goes back to roaming

Observed: 3/6: it searched the last known spot, gave up after ~15s and its memory of the player had decayed (conf 0.00 at 150 s, or just before a roaming hound came across the crouched player again: 36 s)

Evidence: No specific historical explanation established.

P08 is reproduced on pristine v23.3.6 and the selected rerun (3/6), so not introduced by Stage A. Its exact mismatch with the old search/decay fixture needs separate investigation.

## H07 — PRE-EXISTING EXPECTED

H07 hound state coverage: every state of the framework is reached by emergent play (no scripting of state changes)

Observed: reached 12/13: ROAMING, CURIOUS, HUNTING, EXCITED, DORMANT, PLAYING, FEEDING, SEARCHING, FRUSTRATED, STALKING, RETREATING, CAUTIOUS   MISSING: ALERT

Evidence: STAGE_2F_REPORT.md §24.

Anonymous investigation changes named-state coverage; current sample misses ALERT (12/13).

## SM01 — PRE-EXISTING EXPECTED

SM01 light: a light carrier it can see is chased after a wind-up; the same person without a light is watched, not chased

Observed: light on, in its view, standing: chased 6/8 (wind-up before the chase avg 4.0 s); light off, same spot: chased 0/8, struck 0, perceived at all 6/8 (not perceived at 494 px, 781 px), watched 5/6 of those

Evidence: PART_2_HQA_AI02_SEARCH_POLISH_REPORT.md.

Retained 6/8 lit chase sample vs 80% gate; dark sample remains 0/8 chased.

## NV09 — PRE-EXISTING EXPECTED

NV09 N a runner through 3+ rooms (real AI): caught every time, no ramming, little touching, no repath storm

Observed: 10 chases: caught 100% (avg 8.7 s); bonks 0; contact ticks avg 5.7 (baseline 11.6); new routes per s avg 0.31, worst 1.33 (the build before Part 1B, same chases, counting every A* call: avg 1.90, worst 2.82)

Evidence: STAGE_2F_REPORT.md §24.

All 10 runners captured; 5.7 average contact ticks exceeds old gate. No navigation retune.

## C1 — PRE-EXISTING EXPECTED

C1 losing sight does not erase memory: 3 s after the prey vanishes the hound still has it (confidence, position, heading) and is still after it

Observed: 18 runs: still hunting/searching with memory 3 s after losing sight 0/18 (conf avg 0.84; states CURIOUS)

Evidence: PART_2_HQA_AI01_SEARCH_REPORT.md; STAGE_2F_REPORT.md §24.

Old HUNTING/SEARCHING state expectation; observed CURIOUS with remembered confidence .84.

## C4 — PRE-EXISTING EXPECTED

C4 noise gives the prey away: a prey that has slipped away quietly and then breaks into a run is re-acquired by ear at once (no new detection wait)

Observed: 1 runs where the prey had slipped away quietly (the hound searching within 750 px) and then broke into a run; the hound heard the run in 1; of those it was hunting again within 1 s of the first loud step it heard in 0% (avg 0.00 s; from the prey's first step: 1.68 s); not heard (walls / distance) 0

Evidence: STAGE_2F_REPORT.md §24.

Old named reacquisition from an anonymous emitter is incompatible with current attribution semantics.

## C5 — PRE-EXISTING EXPECTED

C5 silent hiding can succeed, and good decisions beat bad ones: out of sight, going quiet and moving on gets away far more often than hiding right where it lost you

Observed: a hound that heard the prey ~520 px away in the dark: slipping out of sight and walking on quietly escaped 0% (3 runs); crouching still right where it lost sight escaped 0% - silence is a real chance, not a guarantee

Evidence: PART_2_HQA_AI01_SEARCH_REPORT.md.

Retained legacy escape-rate gate, only 3 eligible starts; no human fairness inference.

## C18 — PRE-EXISTING EXPECTED

C18 memory eventually decays: when the prey gets away, the hound gives up for a stated reason and its confidence has run out

Observed: 0 escapes: memory at the end ; reasons:

Evidence: PART_2_HQA_AI01_SEARCH_REPORT.md.

Retained legacy search eligibility/decay fixture; current run has no eligible escapes.

## F22 — PRE-EXISTING EXPECTED

2F F22 species physical/canon parameter preservation

Observed: EXCEPTION AssertionError [ERR_ASSERTION]: mp.js | + actual - expected |  | + '8bcbfb0357e4a0a1d53b73c693ba6281766ae49488c88efacf6986b6df6c6e61'

Evidence: PART_2_HQA_HOTFIX_REPORT.md; PART_2_ENTITY_LOOK_REPORT.md.

Old exact-source preservation hash intentionally predates locked HQA changes; mp.js hash differs from the old 2F manifest.

## L5c — PRE-EXISTING FLAKY



Observed: Original live.js 16/17, immediate observer dead flag d=0; permitted local-network rerun 17/17.

Evidence: dev/tests/live.js L5b/L5c reads B.last immediately after A sees death, without waiting for matching observer snapshot. L5d replay/corpse passed both runs..

Observed timing-sensitive baseline check. No persistent product failure reproduced; not classified as Node-specific or a Stage A regression.

## B-01 — PRE-EXISTING EXPECTED



Observed: / 200; /move.js 200; /camera_policy.js 404; /timing_policy.js 404

Evidence: Real server probe and unchanged server.js SERVE.

Known product integration defect deliberately preserved for Stage B. Expected here means frozen baseline, not correct behavior.

## Browser — ENVIRONMENTAL / BLOCKED



Observed: No Python Playwright; no Chromium executable; no browser session used.

Evidence: results/browser-environment.json.

Admin T8 is historical reported context only. No current browser result, no visual parity verdict.

## Sandbox — ENVIRONMENTAL / BLOCKED



Observed: One live retry hit listen EPERM (0/2 harness crash); subprocess piped reads also hit EPERM.

Evidence: results/recheck/live.log; permitted retries completed..

Do not count environment-induced L1/crash as product failure. Test tool now checks spawn error as well as status.

Historical C9/C10 percentage gates are mentioned in old reports, but they are not new current failures: preserve the actual current aggregate log. Historical claims do not override this run. Future stages must compare exact current traces/outcomes, keep unknown P08 separate, and investigate newly failing assertions without calling all baseline red checks acceptable gameplay.
