# THE FAR BACKROOMS — 2.5D Stage H report

**2.5D STAGE H ENGINEERING COMPLETE — HUMAN QA PENDING**

Final remote commit and tree are recorded in the external publication receipt accompanying this archive.

Accepted Stage G parent: `7fb4dafef92040571209403358e536ccb1105509`.
Accepted tree: `eee7f43a74aeb4d0e7ef38effdfc7516eee5e8cf`. Stage G human QA: PASS under the supplied authority. No truncated parent ZIP was used. Branch: `stage-h`. Main was not modified or merged. **Stage I begun: NO.**

Stage H integrates physical A–G state into the existing production Pixi 8.21.0 client. The host-selected spatial world is served through the real `/` page, with `world_config.js`, `world_view.js` and `spatial_client.js` injected before the application module. Normal flat Level 0 remains the retained path. No replacement renderer, new Level 0 layout, AI tuning, physical solver or protocol-authority redesign was introduced.

| Acceptance | Disposition | Evidence |
|---|---|---|
| Z14-H | PASS | Actual visible emitters, LOW/HIGH IR, hidden slab negatives, visible positives, detached light and paired monster decisions/RNG |
| Z29 | PASS | Two real production clients above/below the same XY, independent view state and equal physical world identity |
| Z30 | PASS, 8/8 | 16:9, 16:10, ultrawide, high DPR, 4K, UI 0.5–2, full/reduced quality, NV and 2×/4× zoom |
| view25d | PASS, 2/2 | Real H2/H3/H4 browser orchestration; repeated after clean ZIP extraction |
| network25d | PASS, 5/5 | Retained real Stage F protocol/authority/latency/lifecycle gates; repeated after extraction |
| physics25d | PASS, 5/5 | Retained real Stage G kernel, variants, lifecycle and aftermath gates; repeated after extraction |

Live local/peer/entity poses and corpse body, two independent hands, gear, hat, replay, decals and trails consume authoritative/interpolated XYZ and identities. The spatial pass keeps all physical occluders active regardless of local eligible cutaway. Hidden actors, eyes/faces, aftermath, detached beams, labels and secondary Canvas/DOM world layers produce zero leaked pixels in the negative fixtures, with visible positive controls. Hidden Smiler camcorder interference is zero. One client's camera/cutaway/quality/NV does not alter the other client's view or physical pose.

Spatial picking intersects the camera ray with visible physical faces and actor cylinders, checks physical eye visibility and camera obstruction, selects the nearest valid hit and otherwise uses the eye plane. Actual mouse input reaches the existing fixed-tick stream. Hit point, physical distance and pitch agree across all eight configurations. The accepted CAMERA-P01 cap remains 1536×864 world units at 1920×1080 / 1.25; aspect ratio crops, DPR changes detail, and existing zoom reduces the footprint. Flat aim is retained.

Visible and IR presentation use actual emitter/receiver XYZ and physical channel geometry. IR stays connection-only and absent from monster evidence. Physical presentation audio consumes existing support/contact events without adding AI events or simulation RNG. Equal-observation Hound/Smiler decisions and RNG remain identical under local presentation changes.

H4 recovery preserved the original picking/view implementation. A later H5 evidence audit found a specific defect in forced diagnostic capture, repaired as described below. H5 found one reproducibility defect: spatial audio existed in generated `ents.js` but not its maintained source. The raw failed clean build was preserved and pushed before copying exactly those existing lines into `dev/ents_src/30_audio.js`. Rebuilding now reproduces the already-tested runtime byte for byte; no runtime behavior was changed by that repair.

The retained H1 initial-pixel check also failed before movement. Preserved probes showed that its forced capture submitted no new frame and read a pre-join tick-0 packet (468 lit pixels, GL error 0); a real post-authentication packet gave 75,829 lit pixels. The harness now allows up to 30 seconds for that packet and the completed local cutaway, then applies the original >1,000-pixel/zero-GL-error assertion once. That initial readiness fix changed no pixel threshold or production pipeline. Full-quality boot and ramp pass. A subsequent full-quality two-client fall capture misses its airborne phase because only two rendered poses arrive (ticks 514 and 600, approximately 1.43 seconds apart). That failed assertion remains in regression-02. The final H1 fall/entity run uses the shipped Reduced detail control, retains all 32 occluders and the same assertions, and passes in regression-04 after the forced-capture repair. The full-quality SwiftShader motion limit remains disclosed.

H5's raw evidence audit then found two capture defects. First, the initial upper-floor flashlight test could still read the peer's old lower-floor emitter; the harness now verifies actual XYZ before capturing and asserts the captured origin. Second, render(true) could return without a fresh frame after gl.finish because WebGL sync status remains unsignaled within the issuing task. Only the forced diagnostic path now bypasses that stale TIMEOUT_EXPIRED result after finishing GPU work; WAIT_FAILED still fails and normal frame scheduling is unchanged. H1 and every H4 forced effect/timing capture assert exactly one new frame. Original raw attempts and their invalidated timing interpretation remain preserved. The final portable-02 complete view gate verifies actual upper emitters, fresh captures, unchanged zero-leak thresholds and all eight matrix cases.

Frozen parity passes all 46 traces / 35,098 records at zero tolerance; reference files are unchanged and the Level 0 map is byte-identical. Actual flat menu/gameplay screenshots, state, RNG and explicit RAF schedules match the accepted G page exactly. All retained spatial and functional regressions pass except the same eleven aggregate failures (151/162) and shared F22 (22/23); P08 remains UNKNOWN. Fresh parent aggregate/shared runs reproduce the same failure names. No frozen references or thresholds were relaxed.

An initial retained light performance run missed the strict 0.25 ms average / 2 ms p99 limits (0.250 / 2.131). It remains a recorded FAIL. Two isolated unchanged H runs passed (0.192 / 0.965 and 0.202 / 1.311), as did their parent controls (0.191 / 0.874 and 0.180 / 0.868). This observation did not justify a runtime change. Historical L5/NZ1 timing caveats and Stage G's 24-active aftermath CPU/payload limitation remain disclosed.

Browser evidence uses Chromium 151 / ANGLE SwiftShader software rendering. The 16.7 ms presentation target is NOT met; raw CPU, drained-frame, memory, draw and occluder measurements are retained in BROWSER_EVIDENCE. No hardware GPU or Stage I capacity/release certification is claimed. External Google Fonts network/TLS failures remain an environment limitation; local resources, script and GL gates pass.

H0–H4 and substantial recovery/H5 work were externally checkpointed. H5 validates all named gates from a fresh ZIP extraction in a path containing spaces, two independent rebuilds, actual flat/spatial HTTP module bytes and private-path rejection. The finalizer requires a clean, remotely verified source commit, exact changed-file audit, unchanged portable-validated code, matching Git blobs/modes, ZIP CRC and fresh final extraction. The exact source folder and finalized publication reports are separate to avoid self-referential Git/ZIP hashes. Human gameplay/design QA remains distinct and pending. Work stops at Stage H.
