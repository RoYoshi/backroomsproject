# Part 3B acceptance — corrected top-down presentation

B-01..B-19 and HQ-01..HQ-02 objective gates PASS against the HQ1/HQ2 evidence for the top-down correction. B-20 handoff is supplied; the human readability, comfort and design decision remains PENDING. The P3B4 acceptance of the rejected projection is preserved at `dev/part3b/evidence/p3b4/acceptance.json` as history.

| Gate | Result | Evidence and scope |
|---|---|---|
| B-01 Simulation invariance | PASS | Only world_view.js and spatial_client.js differ from the Part 3A runtime freeze. HQ1 frozen-trace captures are byte-identical to HQ0 on the host (46 traces). |
| B-02 Time-based camera smoothing | PASS | Unchanged analytic spring; 30/60/120/144/240 Hz and jitter replay, maximum cross-schedule camera difference 1.5120904668295623 units. |
| B-03 Stair visual continuity | PASS | Physical stair traces at six schedules. The smoothed wall-band cue cuts the peak per-frame change by 58%, 53% versus unsmoothed steps. |
| B-04 Ramp continuity | PASS | Both production ramps, real physical traces, six presentation schedules. |
| B-05 Fall depth cue | PASS | Falls 180→0 and 0→−96 move the smoothed wall cue 10.2→17.9 and 17.9→26.4 units without a snap. The full-height case starts airborne over the stairwell; no new ledge is claimed. Human feel pending. |
| B-06 Landing response | PASS | At most 1.25 units of presentation settle over 180 ms; physical inputs and aim origin unchanged. |
| B-07 Top-down projection lock | PASS | Production camera: elevation 0, no layer depth or oblique offset. Footprint corners coincide at every Z, caps are exact and every strip is a perpendicular rectangle inside its solid. In six live views a 180-unit camera-Z change alters only band pixels (0 elsewhere). |
| B-08 Camera fairness | PASS | Byte-identical camera policy and canonical physical XY footprint across eight viewport/DPR/quality/NV/zoom configurations with identical candidates and scope. |
| B-09 Picking correctness | PASS | Band picks resolve to the exact physical face (deterministic and live), floors pick the vertical-ray point, unseen caps pick nothing, scaled actors map back to the body, and hidden same-XY targets stay unpickable. |
| B-10 Continuous Level 0 rooms | PASS | 288 ceiling pieces omitted only from camera presentation; no room-entry blackout; all twelve rooms captured. |
| B-11 NORTH local cover | PASS | Real crawl, independent inside/outside clients, zero hidden peer/beam pixel differences. HQ2 setup repair aims the beam along the tunnel; assertion unchanged. |
| B-12 LONG overlap cutaway | PASS | Only the local slab/edge group reveals for a lower viewer; upper view independent; no hidden peer/aftermath/beam leaks. |
| B-13 Physical ceiling truth | PASS | Complete 910-solid model, unchanged planes/channels, 1,170 parent ray comparisons and 195 candidate hulls, plus collision/IR/sound/support checks. |
| B-14 Multiplayer independence | PASS | Two real clients keep separate camera, cutaway and relative-scale anchors; display settings mutate no peer state. |
| B-15 Reconnect/teleport/reset | PASS | Production camera resets snap exactly with zero spring velocity across all retained reset paths. |
| B-16 Aftermath | PASS | Twelve server-owned deaths on six elevation stations plus active/settled/beam/vanish browser masks and same-floor positive controls. |
| B-17 Full/reduced truth equality | PASS | Same physical world, scope, candidate IDs, local cutaway and picking; hidden pixels zero. |
| B-18 Browser coverage | PASS | 16:9, 16:10, ultrawide, DPR2, 4K, quality, UI scale, NV LOW/HIGH, zoom 1/2/4 and two clients. |
| B-19 Retained certification | PASS | Seven named Stage I suites and eight Part 3A production suites pass, and all 18 historical suites match exact accepted counts and failure names. Frozen parity: 46 traces / 35,098 records within the documented cross-engine tolerance, byte-identical to HQ0 on host Node v22.22.2; the zero-tolerance 1-ULP divergence against recorded v24.19.0 is preserved, not relabeled. Flat browser parity passes with the repaired clock start. |
| HQ-01 Four-direction local wall depth | PASS | Bounded strips on all four wall orientations (N/S/E/W faces banded and eye-facing from room anchors), widths within 3–28 units, never over open floor, mitred corners. |
| HQ-02 Relative-Z local presentation | PASS | Each client renders its own player at exactly 1.0; actors below or above scale within 94–106%. Live two-client: higher sees lower at 0.974, lower sees higher at 1.027. |
| B-20 Human readability handoff | PASS — human QA pending | Explicit ten-question top-down handoff with launch instructions. Human design decision PENDING. |

Exact evidence paths and SHA-256 values: `dev/part3b/evidence/hq3/acceptance.json`. All failed attempts remain in the package.
