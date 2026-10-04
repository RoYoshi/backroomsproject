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
