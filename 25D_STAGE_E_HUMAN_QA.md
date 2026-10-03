# Stage E human-QA handoff

**Human gameplay/design QA is pending. The user is the final QA authority.**

Use the `stage-e` final commit recorded in the external checkpoint ledger, or
extract the final ZIP. Use Node v25.9.0 and run `node server.js` from project root.
The ordinary game is at the local URL printed by the server. `node redirect.js`
remains the separate Render redirect service. No merge or Stage F work is needed
to inspect this checkpoint.

The production game remains flat Level 0. Stage E's spatial entity fixtures are
automated/headless; this package does **not** add a polished playable stacked-world
scene. `/stage_d.html` is the retained isolated visual prototype with static art;
it does not demonstrate Stage E monster pursuit. Do not mistake its visuals for
human approval of real spatial AI behavior.

## Available automated reproduction

- `node dev/tests/run.js s_nav25d.js s_perception25d.js`: eight named gates invoking
  65 actual geometry, motion, sensor and real-entity groups.
- `node dev/stage_e/test_entities.js`: actual species routes and paired hidden
  elevation/IR proof, with route/support/state records in console output.
- `node dev/stage_e/test_motion.js`: stairs, ramp, drops, crawl, vault, interruption
  and top-tread/landing seam checks.
- `node dev/stage_e/perf_spatial.js`: bounded multi-surface diagnostic.
- `python3 dev/stage_e/finalize_validation.py traces --out <new-output-directory>`:
  fresh capture against frozen records, without replacing historical references.

## Human review checklist

- [ ] Normal Level 0 Hound/Smiler behavior, camera, movement and light feel retained.
- [ ] No new route jitter, repeated repathing, snapping or visible far-LOD failure.
- [ ] Review recorded real-species stair/ramp/drop/crawl/vault histories; only
  permitted species traverse each passage.
- [ ] Review the identical-evidence paired runs: hidden route choice cannot select
  the correct floor before new evidence arrives.
- [ ] Review cross-floor sight/gaze/contact rejection and opening/sound uncertainty.
- [ ] Review falling/traversal fixed-tick continuity and interruption records.
- [ ] When a playable spatial adapter is separately available, assess whether
  Hound stair/ramp motion looks natural, Smiler stays within canon, gaze through
  openings feels familiar, and sound above/below feels uncertain. These subjective
  items cannot be signed off from this headless fixture.
- [ ] Independently review the final diff, inherited failures, package identity and
  unresolved limitations before deciding whether to merge.

P08 remains UNKNOWN / NEEDS INVESTIGATION. F22, SM01 and the documented inherited
failures are not resolved by this stage. Timing-sensitive L5b/L5c history remains
disclosed. The Stage D SwiftShader budget limitation and unavailable hardware-GPU
certification remain. Automation does not establish fairness, fear or readability.

Stop at Stage E review. `main` cleanup and any later stage require separate human
direction.
