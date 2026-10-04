# Part 3B acceptance

B-01 through B-19 objective gates PASS. B-20 handoff is supplied; human readability/comfort/design decision remains PENDING.

| Gate | Result | Evidence and scope |
|---|---|---|
| B-01 Simulation invariance | PASS | Only world_view.js and spatial_client.js are runtime changes; immutable runtime/content manifests and retained traces agree. |
| B-02 Time-based camera smoothing | PASS | Analytic spring replay at 30/60/120/144/240 Hz and jitter; camera maximum cross-schedule error 1.5120904668295623 units. |
| B-03 Stair visual continuity | PASS | Physical forward/reverse, reversal and sideways departure replay; retained real keyboard traversal and bounded render/camera lag. |
| B-04 Ramp continuity | PASS | Both directions on production ramp and lower return ramp; real physical traces with six presentation schedules. |
| B-05 Fall depth cue | PASS | Both +180 to 0 and 0 to -96 physical arcs pass monotonic destination-scale approach. Full-height case starts in a clearance-valid airborne stairwell pose; no new ledge is claimed. Human feel remains pending. |
| B-06 Landing response | PASS | At most 1.25 units of presentation settle over 180 ms; physical inputs and aim origin remain unchanged. |
| B-07 Depth projection bounds | PASS | 94–106 percent scale, 95.238 percent for a plane 180 below; inverse and clamp-crossing geometry pass. |
| B-08 Camera fairness | PASS | Byte-identical camera policy and canonical physical XY footprint, with rejected outside targets and eight actual viewport/DPR/quality/NV/zoom configurations. |
| B-09 Picking correctness | PASS | Projection inverse, offset-aware physical body points, nearest visible actor and same-XY slab rejection pass. |
| B-10 Continuous Level 0 rooms | PASS | 288 ceiling pieces are omitted only from camera presentation, independent of ordinary room entry; all twelve rooms captured. |
| B-11 NORTH local cover | PASS | Actual crawl passage, independent inside/outside clients, zero hidden peer/beam pixel differences. |
| B-12 LONG overlap cutaway | PASS | Only six-piece local slab/edge group reveals for lower viewer; upper view independent; no hidden peer/aftermath/beam leaks. |
| B-13 Physical ceiling truth | PASS | Complete 910-solid model, unchanged convex planes/channels, parent ray equality, collision/IR/sound/support checks. |
| B-14 Multiplayer independence | PASS | Two real clients maintain separate camera and cutaway; no peer state or physical pose mutation from display settings. |
| B-15 Reconnect/teleport/reset | PASS | Observed production camera reset calls snap exactly with zero spring velocity after teleports, epoch reset, socket reconnect, death reference and life reset. |
| B-16 Aftermath | PASS | Twelve real server-owned deaths on six elevation stations plus actual active/settled/beam/vanish browser masks and same-floor positive controls. |
| B-17 Full/reduced truth equality | PASS | Same physical world, canonical scope, candidate IDs, local cutaway and picking; hidden pixel count remains zero. |
| B-18 Browser coverage | PASS | 16:9, 16:10, ultrawide, DPR2, 4K, quality, UI scale, NV LOW/HIGH, zoom 1/2/4 and two clients. |
| B-19 Retained certification | PASS | All seven named Stage I suites pass after narrow H2 setup repair; eight Part 3A production suites pass; all 18 historical suites match exact accepted counts/failure names; 46 frozen traces/35,098 records at zero tolerance. |
| B-20 Human readability handoff | PASS — human QA pending | Explicit human tests supplied for stairs, ramps, both falls, depth, continuous rooms, crawl, overlap, picking, aftermath, resets, settings and comfort. Human design decision PENDING. |

Exact evidence paths and SHA-256 values: `dev/part3b/evidence/p3b4/acceptance.json`. Historical failed attempts remain in the package.
