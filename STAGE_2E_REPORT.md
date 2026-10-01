# The Far Backrooms — Stage 2E implementation report

**Build:** v23.2.0-2e  
**Status:** STAGE 2E IMPLEMENTATION COMPLETE — HUMAN QA PENDING  
**Scope:** Hound intelligence polish, using the supplied `HOUND_CANON_LOCK_STAGE_2E.md`. No Stage 2F or 2.5D.

This is an implementation handoff, **not an all-green QA approval**. All 17 new Hound acceptance checks pass. Three legacy chase percentage gates remain unmet; two also fail on the unchanged Stage 2D code under the corrected fixtures. Browser checks were blocked by the environment. Human gameplay QA remains outstanding, especially escape pressure and the readability of temporary eye-contact intimidation.

## 1. Partial Claude artifact / baseline

The completed preflight was retained, not restarted. No usable partial Claude Stage 2E artifact was supplied. Work continued from the supplied approved Stage 2D QA baseline, `thefarbackrooms-level0-part2-stage2D-v23.1.2-2d (1).zip`, rather than reconstructing unknown Claude changes. Its SHA-256 is `0de1f971baae51e0284fefd3b32a751ec5761a26ef735a5f73d18f5ce2d97db9`. The master prompt names the earlier v23.1.0 baseline; the supplied v23.1.2 includes the subsequent approved Stage 2D fixes.

## 2. Existing work retained

The Part 1 foundation, reusable navigation, real move.js movement harness, capture/death/corpse systems, evidence records, anonymous light observations, IR separation, approved Smiler implementation, LOD and corrected Hound watchdog were retained. Completed preflight results were 121/121 active scenarios, 53 physical-death checks, 3 interpolation checks and 17/17 audit_net checks. Those preflight results do not substitute for the Stage 2E results below.

## 3. Implemented in this pass

Hounds now treat an identified illuminated human decisively, orient to an actual beam hitting them, investigate anonymous visible-light evidence, retain a sampled visual snapshot for movement decisions, commit to perceived prey, predict from observed motion, reject failed search locations, listen deliberately and give up within a bounded search. Direct eye contact provides finite intimidation. Developer WHY labels expose the evidence and decisions. Seventeen deterministic acceptance tests and a five-workload performance tool were added and integrated.

## 4. Changes to partial Claude work

None: no partial Stage 2E artifact was available. Existing Stage 2D systems were extended narrowly. A real between-perception hidden-position leak in Hound pursuit/wind-up was exposed by the new paired-world test and corrected by using sampled visual observations. Navigation itself was not changed.

## 5. Exact files

Modified existing files:

- `README.md`
- `ai.js`
- `dev/README.md`
- `dev/ai_src/25_light.js`
- `dev/ai_src/50_hound.js`
- `dev/ai_src/90_engine.js`
- `dev/ents_src/40_debug.js`
- `dev/tests/escape_bench.js`
- `dev/tests/run.js`
- `dev/tests/s_chase.js`
- `dev/tests/s_evidence.js`
- `dev/tests/s_hound.js`
- `dev/tests/s_smiler.js`
- `dev/tests/s_system.js`
- `ents.js`
- `package.json`

New implementation/documentation files:

- `STAGE_2E_REPORT.md`
- `dev/HOUND_CANON_LOCK_STAGE_2E.md`
- `dev/STAGE_2E_HUMAN_QA.md`
- `dev/STAGE_2E_PRESERVATION.json`
- `dev/tests/perf_hound2e.js`
- `dev/tests/s_hound2e.js`
- `dev/tests/smiler_parity.js`

New raw result files:

- `dev/stage2e-results/audit_net.log`
- `dev/stage2e-results/audit_net2-full.log`
- `dev/stage2e-results/escape-bench.log`
- `dev/stage2e-results/interpolation.log`
- `dev/stage2e-results/ir_net.log`
- `dev/stage2e-results/legacy-baseline-same-fixtures.log`
- `dev/stage2e-results/live.log`
- `dev/stage2e-results/live_chase.log`
- `dev/stage2e-results/navigation-bench.log`
- `dev/stage2e-results/performance-final.log`
- `dev/stage2e-results/performance-light.log`
- `dev/stage2e-results/performance-smiler.log`
- `dev/stage2e-results/physics.log`
- `dev/stage2e-results/portable-build.log`
- `dev/stage2e-results/portable-hound.log`
- `dev/stage2e-results/portable-interpolation.log`
- `dev/stage2e-results/portable-physics.log`
- `dev/stage2e-results/preservation.log`
- `dev/stage2e-results/scenario-results.json`
- `dev/stage2e-results/scenarios-final.log`
- `dev/stage2e-results/smiler-debug-gate.log`
- `dev/stage2e-results/smiler-parity.log`

`ai.js` and `ents.js` are regenerated outputs of their source directories. `dev/STAGE_2E_PRESERVATION.json` records untouched runtime/shared-source hashes and the changed/new-file inventory. Raw verification output is included under `dev/stage2e-results/`; the report and QA instructions are also included in the ZIP.

## 6. Exact Hound behavior changes

- **Visible human + light:** a confirmed sighting with visible light raises awareness to at least 0.72 and normally starts pursuit. Light does not identify a hidden carrier.
- **Beam contact:** actual beam range, direction and source-to-Hound LOS can cause attention even outside the Hound's forward view. Body identification still uses vision.
- **Anonymous investigation:** orient for 0.28 s, approach the observed light location at the existing investigation speed, listen on arrival, then abandon the hypothesis. The per-hypothesis cap is `7 + curiosity*5` s (about 8.6–9.9 s with existing traits), with bounded checked-location history and an 8 s local cooldown.
- **Commitment:** Hound dwell is `1.8 + persistence` s (about 2.39–2.65 s), independent of Smiler tuning. A still-visible current prey wins continuity. Actual loss/weak evidence plus new credible evidence permits a switch.
- **Visual sampling:** hunt, stalk, guard, group caution and lunge wind-up use the most recent confirmed visual sample, not a live player object while an old `seen` flag lingers between senses.
- **Search:** avoid already-rejected locations within 230 px, subtract 0.12 confidence when an unsupported location fails, enforce the existing finite search budget, and prevent frustration from restarting that exhausted search without new evidence.
- **Eye contact:** an observed human facing the Hound can briefly stop its ordinary pursuit for a cumulative `1.15 + caution*0.9` s (about 1.30–1.54 s). Looking away breaks the hold; toggling does not refill it. Twelve seconds without visual contact, or a physically confirmed own kill, ends that encounter budget. Committed lunges/recovery are not canceled.

Hound speed tables, acceleration, radius, turning, traversal capabilities, lunge timing and physical contact/capture rules were not increased. No new player movement, damage model, Hound anatomy or animation was introduced.

## 7. Canon mapping

Authority is the supplied lock, copied verbatim into `dev/HOUND_CANON_LOCK_STAGE_2E.md`; this pass did not substitute another Backrooms continuity.

| Behavior | Canon fact / classification | Why it preserves the identity |
|---|---|---|
| Hostility toward a clearly seen human | Confirmed canon; pursuit timing is gameplay translation | Physical, visually triggered aggression rather than supernatural awareness. |
| Flashlight exposing the person | Supported interpretation; escalation threshold is gameplay inference | The human becomes visible; light is neither a species attraction nor a weakness. |
| Beam attention / anonymous surface investigation | Gameplay inference | An obvious visual stimulus warrants looking, not knowledge of its hidden carrier. |
| Temporary direct-eye-contact hesitation | Confirmed canon; finite budget is gameplay translation | Brief intimidation gives an opportunity without permanent immunity or canceling a committed attack. |
| Heading prediction / branch search / failure / listening | Gameplay inference | The animal follows a fallible trail and can be wrong. No claim of human-level reasoning. |
| Strong hearing and running reacquisition | Existing gameplay inference; acuity is unknown in canon | Uses the established attenuated, uncertain sound evidence. No scent, psychic tracking or perfect hearing was added. |
| Small individual timing variation | Gameplay inference; personality categories unknown | Existing bounded traits alter patience and commitment, not difficulty classes. |
| IR blindness | Explicit game lock; IR vision is not established by canon | IR/NV inputs remain absent from Hound decision code. |
| Independent Hound memories | Explicit implementation lock; pack telepathy unknown | No automatic sharing of targets, player coordinates or memories. |

Existing feeding, playing/capture choreography and traversal are preserved gameplay systems, not newly asserted canon facts.

## 8. Visible flashlight behavior

`25_light.js` changes are guarded by `kind === 'hound'`. A directly incident Hound beam uses its real range rather than the previous extended flash flag range. Walls and beam geometry still gate observations. Anonymous leads remain player-ID-free, with broad uncertainty; an investigation uses their observed location. If it subsequently rounds a corner and sees a human, new identification is legitimate. Turning the light off stops new light observations but does not erase existing sight, sound or memory. IR and camcorder NV are not visible-light evidence.

“Immediate” means the next applicable perception/light sampling update, not zero-frame reaction. Existing scheduler/light-cache cadences are retained.

## 9. Hidden-position safeguards

Each confirmed visual observation stores position, velocity, facing and time separately in `r.hv`. Hound movement decisions consume that sample between perception updates. The first new hidden-branch test failed before this change because the old code read a live player while `seen` was still true. Both hidden-branch and continuously repositioned hidden-player comparisons now produce 360 identical decisions after identical observations.

Physical contact may still query the real body to resolve an actual collision/capture; this is not a remote targeting sense. The shared evidence layer still handles real visual observations, heard events, departures and lifecycle bookkeeping. Anonymous-light replay tests compare the same observations with the carrier elsewhere and no new sighting. No hidden HP, inventory or account values are used for Hound target scoring.

## 10. LOS loss and prediction

When sight is lost, pursuit uses last observation, observed velocity and legitimate fresh hearing. The existing geometry-clipped projection, navigation adapter, A*, direct-path checks and local steering remain. Visible-sample prediction advances continuously between senses using only observed velocity (capped extra projection age 0.12 s), avoiding staircase goals and excessive replanning without reading hidden current motion. Search continuation/branch candidates come from remembered evidence and map geometry, not the player's secret branch.

The navigation benchmark reports 10/10 chase completion, zero wall bonks/stuck recoveries, and 0.496 average plans/s in its pursuit sample; this is a navigation measurement, not a fairness result.

## 11. Search and failed hypotheses

Existing search budgets and plausible geometry candidates are reused. A failed location is recorded, penalizes confidence when unsupported by fresh evidence, and is not immediately reused. New legitimate evidence can redirect the search; a spent, unsupported search cannot endlessly restart through FRUSTRATED. Pauses derive from existing patience/aggression traits rather than drawing a new random duration every tick. Debug explains which branch is checked and why it listens. The H10 test observes failed locations, confidence below 0.2 and eventual return to roam with the target cleared.

## 12. Hearing

The sound production, attenuation, ranges, localization uncertainty and perception plumbing are byte-identical to the baseline. Fresh running can resume a search as `heard-run`; the decision uses the heard position/heading, not the hidden body. Weak unrelated sound cannot replace current strong visible prey. The existing audible growl response now uses the receiver's noisy heard position rather than the sound emitter's exact origin. It transmits no player identity or another Hound's memory. No new social communication was added.

Player-specific footstep attribution is deliberately unchanged and remains a Stage 2F issue.

## 13. Multiplayer target behavior

Scoring uses perceived awareness/confidence, age, observed/remembered distance, visible light and recent loud evidence. Exhaustion is no longer an extra target-selection preference; existing physical/capture responses to exhaustion remain. A visible current target is retained rather than nearest-player reselection. After real loss and the Hound-specific dwell, another directly identified player or a credible loud trail can win. The existing `retarget` field states the reason. Independent tests cover two valid players, loss/switching, irrelevant private player data and separate Hound memories.

## 14. Personality

No trait generator, base trait value or jitter range changed. The existing ±0.13 species jitter remains bounded to [0.02, 0.98]. Persistence affects commitment, curiosity affects anonymous investigation duration, patience affects listening, and caution affects the short intimidation window. Tests verify bounded values, seed reproducibility, variation between individuals and unchanged decisions when only HP/inventory/account data differs. There are no Hound difficulty classes.

## 15. Random numbers

No new random-number call was added. New timers use existing entity traits. The old per-tick random listening thresholds were replaced with deterministic trait-derived values. Rejecting spent candidates and visiting different states changes which **existing** random calls execute, so mixed-population seeded histories may shift. Shared RNG streams were not separated (2F deferred). Smiler source and isolated tick-by-tick behavior are unchanged; a claim of universal mixed-world seed identity would be incorrect.

## 16. Performance

Final build, 15/15 workload/seed smoke guardrails passed (average <1.5 ms; p99 <8 ms).

| Workload | Mean of seed averages (ms/step) | Worst seed p99 (ms) | Largest measured step (ms) |
|---|---:|---:|---:|
| shipped | 0.107 | 0.777 | 5.191 |
| hound-heavy | 0.083 | 0.654 | 3.699 |
| sprinting | 0.065 | 0.618 | 2.948 |
| flashlights | 0.071 | 0.505 | 3.665 |
| search-heavy | 0.049 | 0.318 | 4.187 |

These are headless Node timings on this execution host, not browser FPS or a guarantee for another machine. `perf_hound2e.js` measures `sim.step` and excludes scripted client move.js time; 4 s warm-up then about 3,600 measured ticks per case, three seeds. It reports actual active/searching/sprinting/light counts so workload labels can be checked. The stress cases intentionally exceed shipped Hound population caps through the harness.

The unchanged light stress tool passed (average 0.182 ms, worst seed p99 1.200 ms). Smiler performance passed standard/worst/contention guardrails; contention average 0.159 ms, worst p99 0.951 ms. Maximum single-step spikes are preserved in the logs rather than hidden by averages.

## 17. Verification results

The complete 138-scenario run initially returned **134/138**: three legacy chase gates plus the SM15 source-length fixture false positive. After correcting that fixture, its independent rerun passed. Final per-test aggregation is **135/138**, with the three legacy chase gates still failed. The full suite is not represented as green. Both raw runs and `scenario-results.json` are included.

| Check | Final result / evidence |
|---|---|
| Perception / original Hound / capture / system / admin / commitment | 12/12; 14/14; 8/8; 10/10; 5/5; 4/4 |
| Smiler | 17/17 across full run plus repaired SM15 rerun; isolated baseline parity: 4 seeds × 3,600 ticks = 14,400 identical ticks |
| Navigation scenarios / chase / audit scenarios | 12/12; **14/17**; 9/9 |
| Evidence / IR | 10/10; 3/3, including tick-identical IR OFF/HIGH |
| New Stage 2E | 17/17; repeated 17/17 from freshly extracted package |
| audit_net / audit_net2 / ir_net | 17/17; 11/11; 4/4 |
| live multiplayer WebSocket smoke | 17/17, including L5b and admin debug isolation |
| Real move.js traces over the wire | All walk/sprint/vault/crouch/crawl/slide cases, including packet bunches: zero corrections, zero final-position discrepancy |
| Physical death / interpolation | 53 checks pass (including the 240-run physical matrix); 3/3 interpolation checks |
| Navigation benchmark | Hound/Smiler routes, 792 ordinary doorway passes plus 146 angled Hound passes, two-body doorway, pursuit and obstacle loops completed; no recorded geometry/NaN failures |
| Escape / live-chase benchmarks | Executed; raw bot measurements included, no human-fairness interpretation |
| Portable package/build scripts | Fresh extraction into a path containing spaces: ai/ents/sim builders reproduce byte-identical outputs; 17 Hound, 53 physics and 3 interpolation checks pass |
| Preservation | 48 runtime assets/shared source files byte-identical; Hound species/traits/speed/capability and lunge-start blocks unchanged |
| Browser checks | **BLOCKED / NOT RUN**: visible light, IR, admin, lifecycle, multiplayer visual/movement smoke |

Reproduction: `node dev/tests/run.js` (or `npm test`) runs all 138 active scenarios and retains the three failures. `node dev/tests/run.js s_hound2e.js` runs the new checks. `node dev/tests/perf_hound2e.js` runs the five workloads. See `dev/README.md` for network/physics/interpolation commands and exact fixture approximations. `node dev/tests/smiler_parity.js /path/to/extracted/stage2D` repeats the isolated comparison.

### Test-fixture corrections (no benchmark threshold reductions)

- Light-only E2/E4 now hold the motor still while testing perception; the Hound's new investigation otherwise changes the camera/body relationship mid-test.
- E6 compares identical observation replay until the first genuinely new human sighting, rather than rejecting an entire run when later investigation finds someone.
- Y01 isolates the motor while measuring perception scheduling. Previously the lit target could die, pausing an empty world and corrupting the measured update rate.
- H07 adds dark visible-group and quiet-sound setups so all existing states can still emerge despite decisive light pursuit.
- `hunt()` and `escape_bench` restore the documented starting position/speed/path after perception warm-up. C1/C4/C18 sample more geometry seeds to retain meaningful sample counts; assertions are unchanged.
- SM15's fixed 6,000-character lookback mistook longer Hound debug labels for a Smiler UI leak. It now verifies the real drawEntities call boundary, its debug gate and a debug-off execution with no DOM/private-data access. Smiler drawing code was not changed.

### Three retained legacy benchmark failures

| Check | Stage 2E result | Same corrected fixtures on untouched Stage 2D | Interpretation / remaining risk |
|---|---|---|---|
| C4 | Heard 5/10 selected post-loss runs; all 5 reacquired within 1 s, mean 0.05 s after hearing. Old gate requires at least 60% heard. | Heard 6/10; all 6 fast, mean 0.06 s. | Sampled geometry/path choices changed. Hearing code/ranges unchanged; mandatory direct hearing tests pass. Threshold remains failed, not silently excused as a pass. |
| C5 | Quiet onward escape 20%; nearby stationary hide 20%, 15 valid starts. Old gate requires ≥35% and quiet better than stay. | The same 20% / 20% failure. | Not introduced by Stage 2E under the corrected start fixture. Bot route quality is limited. Good escape needs human QA; these samples do not prove a fairness margin. |
| C9/C10 | Fresh caught within 8 s 33%, exhausted 83%; fresh holds/widens gap after 4 s 25% (old gate ≥40%). | Fresh caught 41%, exhausted 100%; fresh holds/widens 16%, also fails. | No speed/acceleration buff. Exhaustion remains consequential. The old percentage gate is unmet; do not infer human fairness from either build's bot rates. |

A separate live WebSocket chase sample produced four escapes and one capture across five valid starts. The closer, lit default escape bench caught all valid straight/break-walk/break-hide bots. These are different fixtures, not contradictory measurements or an acceptance target. No Hound balancing was done to force any percentage green.

## 18. Known limitations / scope locks

- Human gameplay, timing/readability, tension and fairness are unverified. In particular prioritize QA G (good escape), B (beam attention), H (commitment) and temporary intimidation.
- The CUA browser refused the local game URL with `net::ERR_BLOCKED_BY_CLIENT`. Visible-light, IR, admin, lifecycle and multiplayer-movement **browser** checks were not run or claimed passed. Network tests using real move.js traces cover the wire/validation path, not visual browser behavior.
- The known admin T8 issue was not rewritten. Its UI/runtime source remains unchanged; no new browser comparison is claimed. The known live.js L5b check passed on this run; its stochastic history remains documented.
- Tests use scripted waypoint steering, fixed headless time steps and setup placements. The player mechanics are real move.js, but bots are not humans. Sensor-only fixtures and injected watchdog blockage are documented in `dev/README.md`.
- A 180 s wrapper timed out audit_net2 while it was still progressing. An independent run without that short limit completed 11/11; no product or WebSocket defect was inferred from the wrapper timeout. This pass used Node 24.19.0, not a claim of fresh Node 22.16/22.22 certification.
- Existing shared RNG consumption and footstep attribution remain. No cross-life habit memory, conflicting-evidence overhaul or new pack tactics were introduced.

**Explicit preservation confirmations:** Stage 2D Smiler states, targeting, eye-contact rules, light behavior, tuning and rendering are unchanged; isolated trajectories/evidence/reasons match the baseline. IR implementation is unchanged and Hounds remain IR-blind. Player movement and death physics are unchanged. Navigation architecture, LOD/watchdog, multiplayer authority/lifecycle and corpse systems were not replaced. No Stage 2F work started. No 2.5D work started.

## 19. Human QA handoff

Follow `dev/STAGE_2E_HUMAN_QA.md` for private-room setup, existing admin/debug controls and all requested cases A–J: visible flashlight, direct beam, corner light, running corner, fake-out, bad hide, good escape, two players, light-off memory and listening. The document includes temporary eye-contact and preserved-system spot checks. Record both debug evidence and subjective impressions; a successful automated run is not approval of game feel.

STAGE 2E IMPLEMENTATION COMPLETE — HUMAN QA PENDING
