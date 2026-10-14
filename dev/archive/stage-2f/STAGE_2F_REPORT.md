# Stage 2F implementation report — v23.3.0-2f

Engineering implementation complete. **Part 2 final QA remains pending.** Stage 2E human gameplay QA is deferred, not passed. Browser QA is blocked. Historical scenario gates remain failing as detailed below; there was no balancing to force them green. No 2G, 2.5D or Part 3 work began.

A verified intermediate checkpoint was produced and saved before resuming, per the user's interruption: `thefarbackrooms-stage2F-checkpoint.zip`, SHA-256 `c57e379d21d6506b6f2b8c9017197b35424ebdb4fcb9ac2e254c8980827b4ced`. Its report correctly remains marked implementation incomplete; this release follows it.

## 1. Baseline identity

Sole baseline: supplied `thefarbackrooms-level0-part2-stage2E-v23.2.0-2e.zip`.
SHA-256: `b1bbf50a7a5d93e6e506d13927902954ca2f1908ee8413edd96a3fa4cbe1d7e5`.
Both supplied canon locks and the Stage 2F master prompt were read and preserved. The pristine baseline was separately extracted; no earlier project was substituted. Node 24.19.0 was used for this verification; this report does not claim fresh Node 22.16/22.22 cross-version testing.

## 2. Exact files changed

Relative to the supplied baseline; generated bundles included. No baseline files deleted. Raw logs are additional new files under `dev/stage2f-results/`, enumerated in the evidence archive manifest.

| Change | File |
|---|---|
| modified | `README.md` |
| new | `STAGE_2F_REPORT.md` |
| new | `STAGE_2F_TEST_SUMMARY.md` |
| modified | `ai.js` |
| modified | `dev/README.md` |
| new | `dev/SMILER_CANON_LOCK_STAGE_2F.md` |
| new | `dev/STAGE_2F_DESIGN.md` |
| new | `dev/STAGE_2F_IMPLEMENTATION_MAP.md` |
| new | `dev/STAGE_2F_PRESERVATION.json` |
| new | `dev/STAGE_2F_SPECIFICATION.txt` |
| modified | `dev/ai_src/00_head.js` |
| modified | `dev/ai_src/20_senses.js` |
| new | `dev/ai_src/22_intelligence.js` |
| modified | `dev/ai_src/25_light.js` |
| modified | `dev/ai_src/30_entity.js` |
| modified | `dev/ai_src/40_capture.js` |
| modified | `dev/ai_src/50_hound.js` |
| modified | `dev/ai_src/60_smiler.js` |
| modified | `dev/ai_src/90_engine.js` |
| modified | `dev/build_ai.sh` |
| modified | `dev/ents_src/40_debug.js` |
| modified | `dev/sim_glue.js` |
| new | `dev/tests/diagnose_rng2f.py` |
| new | `dev/tests/movement_parity2f.js` |
| new | `dev/tests/parity_shared2f.js` |
| new | `dev/tests/perf_shared2f.js` |
| modified | `dev/tests/run.js` |
| modified | `dev/tests/s_hound2e.js` |
| new | `dev/tests/s_shared2f.js` |
| modified | `ents.js` |
| modified | `package.json` |
| modified | `sim.js` |

## 3. Shared evidence architecture

The existing attributed-player records and anonymous-lead model remains. `20_senses.js` is the sensor boundary; `22_intelligence.js` supplies bounded shared scoring, lifecycle, habits and debug tools. `25_light.js` handles visible light. Species files own actions. Shared `perc`, observed-target availability, nearby threats and Hound group reads use sampled visual observations. Between perception updates, a stale seen flag cannot turn a live server position into new knowledge.

Observations carry modality, position, time, confidence, uncertainty and attribution. Velocity/heading come from sampled visible motion, never from an anonymous sound's transport fields. Targets are perceived identities; anonymous regions are investigation goals.

## 4. Evidence arbitration

For a candidate, the common quality score is:

`speciesModalityWeight * confidence * exp(-age / decay) / (1 + uncertainty/600) + continuity`

Decay is 4 s for sight and 3 s for sound/light. Continuity is .25 only for an identified current target. Hound modality weights: sight 4, sound 1.4, light .8. Smiler: sight 2, sound 1.2, light 2.2. These are new shared evidence rankings, not altered species locomotion/agitation thresholds.

Fresh sounds (at most 1.2 s old, not consumed) are ranked using quality times `.5 + perceivedIntensity`; stable observation ID breaks ties. Anonymous leads are ranked by quality plus `.3 * salience`. Competing light investigations preserve 1.25 hysteresis. Lead merging stays modality-separated.

The debug evidence winner means highest common evidence quality, **not an unconditional action command**. Actual species target scores, commitment and trigger reasons are shown separately. Clear identified sight and current commitment can override a new weak sound. Smiler canon triggers retain priority. Hound anonymous investigations use existing CURIOUS/light-investigation machinery, finite budgets and existing investigate speed. This is the necessary replacement for the old secret-ID sound pursuit, not a universal action brain.

## 5. Sound attribution

`identifySound` requires an existing fresh seen record (<=.12 s), actual current visibility and one unambiguous visible person within 24 px of the event origin. The private transport ID merely checks that physical observation. Overlapping visible emitters remain ambiguous. Hidden sounds expose `pid:null`, `src:0`; entity growls use anonymous negative type marker, never prey identity. No `ox`/`oy` or unobserved carrier velocity is retained.

Unseen running cannot create or refresh an identified player's trail. It can produce an uncertain sound lead. The previous numerical 1.3 pursuit-focus factor is retained only when the sound is legitimately identified; applying it by secret source ID was removed. Base hearing range, attenuation, wall factor and localization formulas are unchanged. This narrowly necessary shared correctness exception was recorded in `STAGE_2F_DESIGN.md` before implementation.

## 6. Anonymous versus identified rules

Sight creates player records. Directly observed unique sound/light ownership can attach evidence to those records. A visible source alone, reflected patch, beam or unseen footstep stays anonymous. Light proximity cannot retrospectively label an anonymous sound or a reflected-light lead. A person coincidentally near an old lead is not proof of ownership. The implementation conservatively declines unsighted sound-identity reconstruction.

## 7. Multiplayer target arbitration

Player and entity processing is stable by numeric ID, not caller array order. Hound and Smiler formulas and dwell rules remain species-owned (Hound `1.8 + PERSISTENCE`; Smiler 3 s). Current target continuity and meaningful loss/new evidence remain. Player identities are observed session IDs; HP, inventory, accounts, hidden positions and hidden movement do not score targets. Anonymous leads never become synthetic players. F05–F08/F19/F21 cover these boundaries.

## 8. Encounter habit implementation

Only actual sampled visible movement enters `habitObserve`. It records a changed 192 px cell with cardinal heading, spacing observations by at least 1.5 s. Repeated observed passages create fallible local hypotheses. Hound search candidates and Smiler lost-target search openings may receive a modest location-based bias after passing their existing geometry filters. The selected entity can display active/pending/rejected hypotheses and the last applied bonus.

This is deliberately small pattern memory, not general route learning. It does not profile accounts or infer a hidden fourth route. F10 now uses actual move.js/LOS/perception for six repeated passages in both species. The motor is held during training to prevent an early capture ending the fixture; production species logic is restored for the learned-history hidden-branch comparison.

## 9. Exact habit bounds

Six observations per perceived identity; three hypotheses per entity; 30 s observation TTL; at least three legitimate repeats; 12% of absolute candidate score at most, applied only within 280 px of the observed region to an already plausible search candidate. Direction is part of the repetition key. No negative evidence can create a positive hidden identity. Entries decay/expire; they never force a destination.

## 10. Habit lifecycle

Encounter end and stale observations retire history. Death calls `endHabits`; respawn, leave and disconnect call `forgetPlayer`; world reset removes entity knowledge and invalidates light caches. This works while the sim is paused. F13 uses the real authoritative preview-kill path, respawn, accepted vanish/leave/join, disconnect and reset. F23 adds actual repeated deaths/respawns and four disconnect/rejoin cycles. Corpse/kill physical state is not discarded by knowledge cleanup.

## 11. RNG stream architecture

Every entity owns fixed-size personality, behavior, search, perception and schedule generators. Shared world/director randomness is separate. Capture decisions use the owning entity's behavior stream. No live AI code uses Math.random, wall-clock seeds per decision or render FPS. Normal session creation selects one seed from crypto; explicit test seeds are reproducible. Existing lifecycle wall-clock timers remain system rules, not AI randomness.

## 12. Stable derivation

Unsigned FNV-1a mixing starts from `2166136261 XOR simulationSeed`. UTF-16 code units of each kind/ID/tag are mixed by `imul(hash XOR unit, 16777619)`, with 255 tag separators. The resulting uint32 seeds the existing lightweight generator. ID stability, not spawn-array position, defines identity; IDs default to monotonic values and explicit unique IDs are supported for fixtures. Inserting an entity does not change existing IDs/streams.

## 13. RNG isolation results

R1/R4: F16 inserts an unrelated entity, both species' existing traces stay identical. R2: F14 adds 17 draws from every Smiler tag per step; Hound unchanged. R3: F15 performs the reverse. R5: F17 repeatability; debug reads consume no RNG. Species trait ranges/distributions remain the same bounded construction, although individual historical seed samples change. `diagnose_rng2f.py` provides an isolated old-2E-plus-RNG counterfactual to distinguish those effects; it is never shipping runtime code.

## 14. Hidden-position safeguards

F09 compares both species after identical sightings with different hidden destinations, including anonymous sound, light and conflicting evidence (1,440 paired decision ticks). F11 compares learned-history runs across different hidden branches (4,200 paired ticks) and verifies no hidden capture and expiry. Hound H6/H8 remain passing. Optional physical-system facts are unchanged exceptions: collision/contact/capture, lifecycle, LOD and the boolean spawn-placement fairness validator. Those do not provide a hidden chase destination. Tests keep such physical constraints equivalent where required.

## 15. Species preservation

`STAGE_2F_PRESERVATION.json` stores baseline species data and 13 frozen source hashes covering movement, world, physical death, network/server, navigation geometry, harness and ordinary entity/death/audio presentation. F22 verifies them without requiring the author's filesystem. Independent comparison may additionally supply the original baseline directory. No lunge, speed, acceleration, turn, personality range, gaze/agitation or canon-trigger value was tuned to improve a test percentage.

## 16. Hound preservation

All 17 Stage 2E checks pass. H7/H9 now assert anonymous hidden hearing and investigation rather than secret player-specific reacquisition. H13 counts actual anonymous investigation as search activity while keeping collision/bounds/finite/stuck checks. H17 checks social sound has no prey identity.

Eight fixed-trait/draw/observation scenarios compare 3,840 Hound ticks exactly. **Hound speed, acceleration, eye-contact tuning and lunge/contact rules unchanged.** Main body, hands and physical death code unchanged. Anonymous sound attribution necessarily changes some pursuit state outcomes; it is explicitly not claimed to be historical-seed parity.

## 17. Smiler preservation

Eight controlled scenarios compare 3,840 Smiler ticks exactly, with light/gaze/group combinations. Fixed initial traits and .5 RNG inputs remove the historical stream migration from the comparison. Species tests remain the real movement/perception code. **Smiler canon triggers, tuning and group behavior are unchanged**, apart from shared observation/attribution correctness and the explicitly requested small habit bias. SM01's sample gate changes even in the RNG-only counterfactual; no Smiler rebalance was made. The retired historical-stream comparison is preserved as an old 2D/2E tool; `parity_shared2f.js` is the correct fixed-input 2F comparison.

## 18. IR invariance

F20 compares OFF/HIGH tick by tick for both species; original IR scenarios also pass, and ir_net is 4/4. Private IR metadata is excluded from visible emitters. **IR behavior unchanged; Hounds and Smilers remain IR-blind.** Real headless movement drives the paired test; renderer-only IR presentation is untouched.

## 19. Memory/evidence bounds

| Storage | Bound / expiry |
|---|---|
| Identified records | 16/entity; 120 s without sight/identified hearing |
| Typed evidence | 4/record; expires at 3x existing personality memory half-life |
| Sound observations | 8/entity; 25 s; fresh selection <=1.2 s |
| Anonymous leads | 6/entity; 45 s maximum, earlier confidence decay |
| Visited locations | 128/entity; 60 s |
| Hound checked hypotheses | 6; existing 8 s cooldown |
| Habit observations/hypotheses | 6/identity, 3/entity; 30 s |
| Common candidates / displayed candidates | 70 maximum / 12 |
| Debug target/rejected entries | 12 / 3; last expiry reason is one 30 s record |
| Smiler attention | tied to bounded perceived identity records; cleared on lifecycle |
| Existing kill sites / variant history | 12 / 6 per species; unchanged physical aftermath policy |

Unused legacy `mem.others` has no writers. Beam caches contain supported connected emitters, with explicit lifecycle invalidation. Far-tier cleanup uses elapsed dt rather than a 60-tick assumption; far transition clears current-seen flags so memory can decay. F18 stresses 40 players/600 sound events and verifies caps; long cleanup runs leave zero identity records after disconnect.

## 20. Disconnect/lifecycle cleanup

The engine forget path removes target, attention, identified sound, habits, associated search/cautious/alert references and diagnostic references. Sim death/respawn/leave/remove call the appropriate hook. Beam history and cached observations are invalidated at identity/world boundaries. Persistent corpses retain their physical aftermath. Network lifecycle, death-disconnect fallback, late corpse arrival, movement validation and admin transitions passed their existing tests.

## 21. Debug/WHY

Selected-entity debug adds competing quality scores, modality/attribution, confidence, uncertainty, age/expiry, evidence weights, separate species target scores/rejections, current commitment age/dwell, active hypotheses and repetitions, applied 12% delta, pending hypotheses rejected for insufficient repetitions, encounter/TTL retirement and entity RNG key/tags. Normal gameplay receives no new ordinary UI. Existing authorized admin debug transport is reused. Browser layout/readability is unverified because local browser access is blocked.

## 22. Performance

Fixed 60 Hz headless server sim.step measurements, three seeds each. Scripted input preparation is outside the timer; injected sound perception work is inside. Standard workloads warm up for 4 s then measure 60 s; cleanup measures ~296 s after warmup; hypothesis stress measures 64 s after actual acquisition. Hypothesis-stress motors are deliberately held; other workload motors are active. Histories/counts are peaks per entity.

| Workload (3 seeds) | Mean avg ms | Worst p99 ms | Largest ms | Peak records/evidence/sounds/leads/habits/hypotheses |
|---|---:|---:|---:|---|
| shipped | 0.1460 | 1.0394 | 4.5865 | 4/10/8/6/13/0 |
| hound-heavy | 0.3243 | 1.7118 | 12.7026 | 8/19/8/6/22/0 |
| smiler-heavy | 0.4083 | 1.8498 | 6.0196 | 8/18/8/6/14/0 |
| multiplayer | 0.1541 | 0.7844 | 5.6447 | 8/20/8/6/31/0 |
| sound-heavy | 0.2061 | 0.9965 | 4.1906 | 8/20/8/6/22/0 |
| light-heavy | 0.1487 | 0.8455 | 3.3785 | 8/24/8/6/31/0 |
| conflict | 0.2060 | 1.1618 | 3.7033 | 8/24/8/6/31/0 |
| habits | 0.0833 | 0.5228 | 4.2904 | 8/10/8/6/48/3 |
| cleanup | 0.1318 | 0.6988 | 5.8264 | 8/20/8/6/31/0 |

The shared workload guardrails (avg <1.5 ms, p99 <8 ms) pass all 27 runs. The older tools retain their own stricter limits and pass: light mean .128 ms/worst p99 1.016 ms; Smiler contention mean .215 ms/worst p99 2.126 ms; all 15 Hound workload runs pass. Full raw logs retain each seed and sample count.

The final shared run largest step is 12.70 ms. An earlier concurrently run sound-heavy workload had a 153.36 ms maximum; it is retained in the raw logs, not hidden by the average. These shared-host timing samples cannot distinguish all OS scheduling/GC causes and do not guarantee a hitch-free client. It is a final-QA profiling concern, not grounds to retune entities. Initial habit workload recorded zero hypotheses; it was replaced for coverage by the explicit full-hypothesis workload (48 observations, 3 hypotheses/entity), not counted as proof on its own.

## 23. Regression results

| Gate | Result |
|---|---|
| Pristine supplied Stage 2E scenarios | 135/138 |
| Fresh-extracted full current suite (includes 2F) | 152/161 |
| New Stage 2F F01–F23 | 23/23 |
| Original Stage 2E Hound checks | 17/17 |
| Focused final shared/system/IR/Hound | 53/53 |
| Controlled species parity | 16/16, 7,680 paired ticks |
| Real move.js parity | 8 modes, 4,800 identical tick pairs |
| Physical death | 53/53 checks; includes 240-case matrix |
| Interpolation / reused ID lower-clock reset | 3/3 |
| audit_net / audit_net2 / ir_net / live | 17/17 / 11/11 / 4/4 / 17/17 |
| Navigation benchmark | completed; 57 doorways, raw summary retained |
| Shared performance / original performance tools | all current thresholds pass |
| Fresh extraction/build reproducibility | see portable-results.json; paths contain spaces |
| Browser checks | BLOCKED |

The portable test run is from `Portable Stage 2F Check/thefarbackrooms-level0`, created by extracting a ZIP into a new directory. Three build scripts reproduce generated bundles byte-for-byte. F22 defaults to the bundled baseline-derived manifest; independent original-baseline comparisons remain optional. No original working path is required. After that full run, one final debug-only fix clears the last displayed habit bonus immediately on death; its F13 regression and all 23 Stage 2F tests were rerun. The final package gets a further extraction/build/F13 check. Full-suite exit code remains nonzero because its retained failure thresholds are not removed.

Movement traces use the actual move.js for walk/sprint/crouch/crawl/slide/vault/deep carpet/recovery. Radius 15 and recovery threshold 36 are checked. Recovery clears at the start of the next tick after stamina reaches 36; the initial test's end-of-tick assumption was corrected after it failed identically on pristine 2E. Bot steering, fixed steps and absence of rendered/network input remain explicit approximations. Network checks independently exercise latency/bunching and movement validation.

## 24. Retained failures and their causes

Nine historical assertions remain failing. No threshold was lowered, disabled or hidden; the full suite still reports them.

| Gate | Pristine 2E | Current | Evidence-based classification |
|---|---|---|---|
| P01 detection ordering | Pass | run 1687, walk 1689, crouch 1671 px | RNG-only 2E produces identical failure; visible-source detection saturates at ~1700 px and fixed sense timing makes the 2 px ordering assertion fragile. |
| P07 breathing | Pass | 0 close sounds before victim dies | RNG-only 2E reproduces it. Independent same-seed sensor-only control hears 7 close breaths and 0 at 900 px. New facing permits a kill before the next scheduled breath. |
| H07 state sample coverage | 13/13 | 11/13, no ALERT/STALKING | RNG-only still reaches all states. Anonymous sound now goes to finite CURIOUS investigation rather than fabricating a player-specific alert/stalk. Intentional shared semantics change; no state removed or tuning changed. |
| SM01 visible-light chase sample | Pass | 6/8 chased, no-light 0/8 | RNG-only reproduces exact result; bounded traits/sample changed. Controlled species parity passes. |
| NV09 wall-contact sample | Pass | avg 6.6 contacts, gate <5; all caught, 0 bonks | RNG-only reproduces contact count; unchanged geometry/motor source, sample trajectories differ. No navigation retune. |
| C1 post-loss state | Pass | 0/18 in named HUNTING/SEARCHING, all CURIOUS; conf .84 | Identified memory remains; anonymous sound investigation changes state semantics. F09 and H6/H8 confirm hidden-branch invariance. |
| C4 sound reacquisition | Fail | 1 valid start, 0% re-hunt by named identity | Old gate assumes a hidden emitter can renew a named target; 2F explicitly forbids that. Original 2E already failed coverage. F01–04/H7 verify new required behavior. |
| C5 quiet escape percentage | Fail | quiet 33%, stay 0%, only 3 valid starts | RNG-only gives 33%/20% over 15 starts; anonymous attribution further changes eligible starts. Original thresholds retained. No fairness claim. |
| C18 give-up coverage | Pass | 1 eligible escape; conf .12, explicit sound-check give-up reason | RNG-only yields 18 valid escapes. Anonymous investigation changes old identified-hearing fixture eligibility. Bounded search/expiry checks independently pass. |

The three requested legacy chase gates:

- C4 old: 5/10 heard, all heard cases reacquired fast; current as above. RNG-only counterfactual 8/10 heard, 100% quickly named reacquired; full 2F rejects anonymous identity renewal by design.
- C5 old: quiet 20% versus stay 20%; current 33% versus 0%, with much smaller valid cohort. Not comparable as human fairness.
- C9/C10 old fail: fresh caught 33%, tired 83%, fresh gap held/widened 25%. RNG-only: 33%, 91%, 33%. Full 2F now passes: 25%, 91%, 58%. This combines different random samples and corrected anonymous-evidence semantics; it is not a tuned gameplay improvement.

All nine already existed in the first 2F regression run; none was introduced by the post-checkpoint debug/test/lifecycle-cache completion. Four are directly reproduced by RNG-only migration. Remaining changes are tied to the documented anonymous-evidence boundary. This does not close subjective game-feel risk; review in final QA.

## 25. Browser status

CUA selected Chrome then attempted `http://localhost:9540`; the browser returned `net::ERR_BLOCKED_BY_CLIENT`. The server itself started and network tests passed independently. No alternate route/bypass was attempted. Browser visual/audio/admin/death-film checks, including historical admin T8, are **BLOCKED, not passed**. Unrelated admin UI was not rewritten.

## 26. Known limitations

No human playtest, no promise of fairness, no browser visual verification, and earlier concurrent shared-host measurements include a 153 ms outlier (final run max 12.70 ms). Habits cover repeated perceived region/heading passages, not arbitrary route learning. Anonymous attribution is conservative and changes the feel of unseen-footstep pursuit; the user must judge it. Controlled parity covers equivalent fixed observations/traits, not every dynamic multiplayer encounter. Historical gates remain red and documented. Normal client/gameplay presentation is unchanged; added debug text may need layout QA.

## 27. Deferred to 2G

Human Part 2 final QA, subjective Hound pressure/anonymous investigation readability, multiplayer target switching, Smiler counterplay, debug-overlay readability, browser/admin checks and end-to-end frame-hitch profiling. These are documented future checks; 2G was not started. No 2.5D migration, rendering overhaul, menu, progression, items, entities or levels were added.

## 28. Outstanding Stage 2E human-QA notes

The user's 2E human playtest remains deferred: judge pursuit after LOS loss, meaningful flashlight exposure, temporary eye-contact intimidation, non-omniscient sound searching, movement readability, multiplayer body aftermath and perceived fairness. Automatic tests measure invariants/physics only.

Explicit preservation: Hound speed/acceleration/gaze/lunge/contact unchanged; Smiler canon/tuning unchanged within documented shared-boundary changes; both IR-blind; player movement, physical death and navigation architecture unchanged; player art still one rounded body and two hands, no anatomy added. No 2.5D or Part 3 work started.

STAGE 2F IMPLEMENTATION COMPLETE — PART 2 FINAL QA PENDING
