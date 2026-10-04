# H4 picking, fairness and real browser gate

H4 is IN PROGRESS. H3's completion was verified at `81c3e54e59dd92ce9c9f4fe72986b10824197727`, tree `1e566b6575d621df4e4c5b46494324cbcaf09e48` before H4 began.

The production fixed-tick aim now intersects camera rays with physically visible faces and actor cylinders, checks camera occlusion separately, and falls back to the eye plane. Cutaway does not remove physical eye-ray occluders. Picking and rendering use the same canonical footprint and existing camcorder zoom. Flat aim is unchanged. Local cutaway and full/reduced quality controls are in existing Settings.

Focused geometry evidence `evidence/h4/picking-01.json` passes physical target/point/distance invariance across 16:9, 16:10, ultrawide, 4K and zoom; hidden targets and opaque camera obstruction remain blocked, fallback is on the eye plane, world geometry is unchanged.

`view25d` is activated as real production-browser orchestration. It launches H2 for Z29, H3 for H-Z14 and expanded aftermath, and H4 for Z30. Missing dependencies, browser errors, timeouts and leaks fail. The complete named gate has not yet been run at this preservation checkpoint. The eight-case real-browser matrix is in progress. No H4 PASS or H5 work is claimed.

## H4 recovery: Z30 complete, named gate running

Remote recovery source was independently verified at `de9de8b23a73327a1337b3500e6e5241a5471171`, tree `a994646952ff85dea71aa714a6bb14055189909a`. No newer remote work existed. H0–H3 were not restarted and the preserved runtime was not rewritten.

`evidence/h4/recovery-01` preserves missing-default-Chromium launch failure and the truncated browser installation download. The existing Chromium 151 executable was located and used through the documented `TFB_BROWSER_EXECUTABLE` override. No runtime repair was needed. Environment and executable hash are in `recovery-environment.json`.

`evidence/h4/recovery-02` is an eight-case real production browser Z30 PASS: 16:9, 16:10, ultrawide, DPR 2, 4K, reduced quality, NV LOW/2× zoom, NV HIGH/4× zoom/DPR 2. All hidden actor/aftermath/gear/label and detached-beam differences are zero; each case has a visible positive control. Hidden Smiler camcorder interference is zero. Actual mouse aim reaches the fixed-tick wire. The second client's camera/cutaway/quality/scope and authoritative pose stay unchanged. All 32 physical occluders remain; render targets stay within the existing 4,194,304-pixel cap and awareness within the accepted 1536×864 cap (zoom crops). The same physical hit point/distance/pitch is retained across all cases.

`picking-recovery-01.json` also passes the retained hidden/camera-blocked target and eye-plane fallback checks without any changed thresholds. SwiftShader drained-frame costs exceed 16.7 ms; raw timing/resource measurements are retained as limitations, not hardware certification.

The complete named `view25d` gate is running separately. H4 completion is NOT yet claimed. H5 has NOT started. This preservation checkpoint protects the completed matrix before the longer aggregate browser run.

## H4 COMPLETE — recovery acceptance

`evidence/h4/view25d-recovery-01/gate.log`: **2/2 PASS**. The real orchestrator launched production H2, H3 and H4 clients. Z29 PASS, H-Z14 PASS, Z30 8/8 PASS. `paired-lighting-recovery-01.json` independently repeats equal Hound/Smiler decisions and RNG under presentation changes and unchanged geometry/channel separation. All local resource, script and GL assertions pass.

`evidence/h4/H4_COMPLETION.json` records per-case physical picks, footprint, hidden/positive pixels, layer masks, CPU/cutaway/drained-frame timings, targets, draw/packet/occluder counts and memory estimates. Chromium 151 uses ANGLE SwiftShader. The existing 16.7 ms frame target is NOT met on this software GPU; this limitation is retained without altering the target or dropping physical occluders. Hardware and final capacity certification remain outside H.

No production code or test threshold was changed during H4 recovery. The original preserved picking/view implementation passed. H4 is complete; H5 begins only after this completion source/evidence checkpoint is remotely verified.
