# H5 — full regression and package

IN PROGRESS. H4 completed and was remotely verified at `4bd55b262e898e5de0980d674998123880445d94`, tree `91754d85893a10431bce8b86bb10b981109c64f5`, before H5 began. No Stage I work or main changes are authorized.

## Build failure preserved before repair

`evidence/h5/build-01/result.json` is FAIL. Clean extraction to a path with spaces reproduces AI and simulation bytes, but `ents.js` rebuilds to the Stage G hash because H3 spatial audio edits exist only in the generated output. `ents.js.diff` records exactly the missing `place(...,z)`, `play` elevation argument and `E.spatialImpact` code. No renderer, visibility, physics or AI change is warranted. The minimal repair is to synchronize these existing runtime lines into `dev/ents_src/30_audio.js` and regenerate; the expected generated hash must remain the tested H4 `f7190223f6bdcdcf91fb1f8169d59ebe301866c160b7ff1affc48149f08d5284`.

## Source synchronization verified

Only `dev/ents_src/30_audio.js` was repaired. `evidence/h5/build-02` PASS proves that rebuilding AI, simulation and entity presentation leaves all three generated runtime files byte-identical to the H4-tested files. The lost-source defect is resolved without changing runtime semantics, physical truth, visibility or test thresholds. Retained regression is running serially.

## Retained performance failure preserved

The complete serial retained run matches the eleven aggregate and shared F22 failures. `retained-01/perf-light.log` additionally reports average 0.250 ms and p99 2.131 ms, missing the unchanged strict 0.25/2 ms thresholds. The benchmark, AI, simulation and canonical world bytes are identical to G. Raw timing evidence is preserved before isolated same-host parent/candidate comparisons; no threshold or runtime repair has been made.

The preserved light timing miss did not reproduce in two isolated H runs with unchanged source/thresholds. Serial parent/H pairs: parent 0.191 ms average / 0.874 ms p99, H 0.192 / 0.965; parent 0.180 / 0.868, H 0.202 / 1.311. All four PASS the original 0.25/2 ms limits. This establishes observed timing variability, not a proven performance regression or a reason to retune runtime code. The original FAIL remains in the evidence and final disclosure.

## Browser traversal initial-pixel failure preserved

`regression-01` passes retained B/C/E/F/G, network25d, physics25d, 46-trace parity/map and Stage D core/extended browser gates. Its H1 traversal rerun fails the initial `actual completed production pixels` assertion before movement. The later failure screenshot shows a rendered world; diagnostic state has only four spatial frames and a completed local fade. The initial helper did not save its pixel count/GL error before asserting. Raw screenshot, state, server log and failure are preserved before adding that missing diagnostic. No runtime defect or repair is inferred yet.

## H1 capture readiness diagnosed; full-quality fall limitation retained

`traversal-probe-02` through `05` preserve the original 468-lit-pixel/zero-GL-error capture. Probe 05 shows forced capture did not advance the bounded GPU fence: before/after frame 3, rendered local packet tick 0 while authority was tick 31. A naturally rendered post-authentication packet at tick 56 yields 75,829 lit pixels. H1 now waits within the existing 30-second deadline for a post-authentication packet and completed local fade before the original >1,000-pixel/zero-error assertion. No production or threshold change.

`regression-02` passes the initial pixels (75,824) and real keyboard ramp, then FAILS the original peer-airborne assertion. The 65 capture samples contain only two rendered states, tick 514 at Z 120.05 and tick 600 at Z -95.95, both grounded. SwiftShader frame completions span roughly 0.4–1.5 seconds with two clients and miss the airborne phase. Raw packets, both screenshots, diagnostics and server logs are retained before checking the same assertion with the already-supported reduced-quality setting. This is an observed full-quality software-GPU presentation limit, not evidence to change physical fall, interpolation or the assertion.

## Source regression complete; portable validation pending

`regression-03` PASS: H1 full-quality boot/local ramp, existing Reduced detail for both clients during peer fall, Hound/Smiler XYZ, exact flat G/H menu/gameplay pixels/state/RNG/RAF schedule, and actual flat/spatial served bytes/private-path validation. The reduced-detail run captures 18 samples of one actual airborne presentation frame, reaches Z -95.95, and retains every original physical assertion and all 32 occluders. Full-quality motion capture's earlier miss remains a software-GPU limitation.

All 19 retained spatial/parity/browser/HTTP checks now have passing evidence. Original failed attempts remain separate. Final report generation requires all rows plus clean-extraction validation to pass, and records both original H1 failures. The next step packages staged source, extracts to a path containing spaces, rebuilds twice and runs real physics25d/network25d/view25d plus HTTP/FPS/camera gates serially.

## Retained lighting capture precondition gap found in raw evidence

`emitter-precondition-audit.json` is FAIL_EVIDENCE_PRECONDITION. The first browser_h3 flashlight-above-slab capture in both H4 named-gate and H5 portable-01 evidence still has peer emitter Z 50.05, not the expected upper-floor Z 230. The initial kind-only readiness condition accepts the already-present flashlight before the teleport reaches rendered peer history. Later headlamp/lantern captures use the correct upper origin. This is an objective evidence-precondition defect, not a demonstrated runtime light leak. The raw old PASS output is retained with this qualification; it cannot establish the mislabeled first case.

The authorized repair is restricted to requiring actual emitter XYZ in the browser harness and asserting that pose in the captured result, retaining the zero-pixel threshold. The complete real view25d gate and fresh package validation must pass again before final acceptance. No H0–H3 implementation restart or H4 picking/view rewrite is warranted.

## Forced diagnostic render advancement defect

`forced-capture-audit.json` preserves the observed FAIL: with ready=true, render(true) can leave frame count unchanged because TIMEOUT_EXPIRED still triggers an early return after gl.finish. H4's in-task effect activation and three forced timing samples therefore need a fresh-frame assertion. Existing raw pixel differences and recorded timings are preserved; the old timings must not be represented as three freshly rendered frames.

Repair is limited to the force=true diagnostic branch in spatial_client.js after its explicit GPU finish. Normal frame scheduling, physical masks, picking, camera and simulation remain untouched. Exact +1 frame assertions will guard H1 capture and each H4 forced draw. Retained H1, complete real view25d and fresh package gates must rerun. This is a specific demonstrated capture defect, not permission to rewrite the preserved H4 implementation.

## Focused capture repair passes; corrected full gate pending

Only the explicit force=true early-return condition in spatial_client.js changed; normal frame scheduling and all masks/picking/physical logic are unchanged. H1 capture and each H4 forced effect/timing render now assert exactly +1 frame. H3 upper-peer emitter captures require and assert actual XYZ near (160,160,230).

`regression-04` PASS covers fresh-frame H1 boot, real ramp, reduced-detail peer fall, Hound/Smiler XYZ, exact flat G/H pixels/state and actual served bytes. `lighting-post-capture-repair.json` and `picking-post-capture-repair.json` PASS preserve paired canonical decisions/RNG, channel separation, physical picking and geometry. Final acceptance is held for the entire corrected real view25d and fresh portable-02 package gate. Original H4 summary is preserved separately as `h4-summary-before-capture-repair.json`; old timing interpretation is superseded, not silently relabeled.

## Corrected clean extraction and H4 revalidation PASS

Portable-02 PASS: two exact AI/sim/ents rebuilds; physics25d 5/5, network25d 5/5, corrected view25d 2/2 (Z30 8/8), flat/spatial served bytes, FPS and camera. Every forced effect/timing draw advances exactly one frame; actual upper flashlight/headlamp/lantern emitters are at Z 230.05 and leak zero pixels. All hidden beams/interference remain zero, with visible controls. `capture-revalidation.json` and updated H4_COMPLETION summarize the new evidence. H4 completion is being remotely checkpointed before final H5 reports, exact scope audit and package publication.
