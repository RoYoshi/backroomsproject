# Stage H baseline failures and preserved failed attempts

Accepted G and final H aggregate are both **151/162**; shared is **22/23** with F22. Fresh parent runs match exact failure names. P08 remains UNKNOWN; it is not certified by this stage.

- P01 noticing distance: run > walk > crouch (resting hound, corridor)
- P07 exhausted breathing is audible only close by
- P08 memory: the last known position is used, then goes stale; the hound gives up and goes back to roaming
- H07 hound state coverage: every state of the framework is reached by emergent play (no scripting of state changes)
- SM01 light: a light carrier it can see is chased after a wind-up; the same person without a light is watched, not chased
- NV09 N a runner through 3+ rooms (real AI): caught every time, no ramming, little touching, no repath storm
- C1 losing sight does not erase memory: 3 s after the prey vanishes the hound still has it (confidence, position, heading) and is still after it
- C4 noise gives the prey away: a prey that has slipped away quietly and then breaks into a run is re-acquired by ear at once (no new detection wait)
- C5 silent hiding can succeed, and good decisions beat bad ones: out of sight, going quiet and moving on gets away far more often than hiding right where it lost you
- C18 memory eventually decays: when the prey gets away, the hound gives up for a stated reason and its confidence has run out
- 2F F22 species physical/canon parameter preservation

`h5/baseline-comparison.json` records every retained comparison. `h5/retained-01` preserves the initial light-load timing FAIL at 0.250 ms average / 2.131 ms p99. Two serial parent/H pairs then passed the unchanged 0.25/2 ms thresholds: G 0.191/0.874, H 0.192/0.965; G 0.180/0.868, H 0.202/1.311. The first failure is not erased or reclassified as a passing run; it was not reproduced in the two isolated H runs. No performance limit was changed.

H5 clean-build attempt `build-01` failed because maintained audio source lacked H3's generated edits. Its hashes and exact diff were pushed before repair. `build-02` and both portable rebuilds pass after synchronizing only those lines. Generated runtime bytes remain the same as H4.

H5 `regression-01/browser-h-traversal` failed its first pixel assertion before movement. `traversal-probe-02` through `05` retain counts, states, screenshots and GL diagnostics. The old forced capture did not advance the GPU fence (before/after frame 3; rendered packet tick 0), yielding 468 lit pixels with no GL error. Waiting for a real post-authentication packet (tick 56 after the tick-31 readiness checkpoint) yielded 75,829 pixels. H1 now waits for that semantic readiness condition and completed local fade, with a bounded 30-second readiness wait and unchanged >1,000-pixel/zero-error assertion. The next full-quality run (`regression-02`) passes boot/ramp but fails the rendered peer-airborne assertion: only tick-514/Z120.05 and tick-600/Z-95.95 grounded poses are captured while GPU frame completions span about 0.4–1.5 seconds. This software-GPU motion limit remains a recorded FAIL. `regression-03` and the final post-capture-repair `regression-04` use the existing Reduced detail control for both clients during the fall, preserving all 32 occluders and every original physical/pixel assertion; the full focused traversal passes. This fall result justified no physics or normal frame-scheduling change. The separate forced-capture defect below did require a diagnostic-path correction.

Earlier H0–H3 raw failures remain in their original directories: flat capture clock/RNG alignment, startup/handshake/GL state, opaque backgrounds, a 72-pixel hidden Hound leak, software queue/startup delays and premature positive-control captures. Their focused repair/rerun histories are documented in H0–H3 status files. H4 recovery preserves missing-browser launch and truncated installation failures before using the existing Chromium executable. H4 picking, physical masks and camera code required no repair; the later forced diagnostic capture defect is recorded below.

`emitter-precondition-audit.json` is FAIL_EVIDENCE_PRECONDITION: old H4 and portable-01 first flashlight captures contain peer emitter Z 50.05 despite the upper-floor label (expected approximately 230). `forced-capture-audit.json` is FAIL_FORCED_CAPTURE_ADVANCEMENT: render(true) left its ready frame count unchanged. Both audits and the original machine-PASS results were remotely preserved before repair. The former is fixed by explicit emitter XYZ readiness/assertions; the latter by a single force-path condition after gl.finish, with exact +1-frame capture assertions. The normal scheduler, picking, physics and masks are unchanged. The complete corrected view gate passes from portable-02; its fresh-frame timings replace the old timings for final performance reporting.

The WebGL specification requires newly issued sync status to remain unsignaled until the event loop yields, while finish drains preceding GPU work. References: [Khronos WebGL 2 sync semantics](https://registry.khronos.org/webgl/specs/latest/2.0/) and [MDN finish](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/finish). This explains the observed in-task capture return and bounds the correction to explicit diagnostics.

The software GPU does not meet the 16.7 ms frame target. Hardware certification is unestablished. External Google Fonts network/TLS failures, historical L5/NZ1 observations and the accepted Stage G 24-active aftermath CPU/payload excess remain limitations. Stage I is not begun.
