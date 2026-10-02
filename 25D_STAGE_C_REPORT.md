# Stage C — spatial geometry and body motion

2.5D STAGE C ENGINEERING COMPLETE — CHECKPOINT READY FOR REVIEW

Stage C and CAMERA-P01 only. Independent engineering review and Stage C human QA remain pending. Stage B human QA passed per the supplied README/master prompt; historical pending labels are superseded only for Stage B.

## Provenance and recovery

Started from the exact Stage B ZIP SHA-256 `3068a745634e713b09b5ec08bbfd68db3f0d6540abda3b1fb5833f99446b0faf`, CRC verified and cleanly extracted. All 410 parent files were inventoried. The supplied architecture omits the embedded copy's final newline; their semantic text is identical. The frozen embedded authority and Stage A/B reference data are unchanged.

Bounded parent preflight passed: 46 traces/35,098 records, full map/navigation/query/seed export, policy/FPS tests and actual HTTP. Before long validation the 433-file working recovery checkpoint was CRC/extraction/byte verified and saved externally, SHA-256 `ef36b11732a62492f7d2afb2a2ce11917253503daf54306c682a1f347c7532e5`. Its checksum/status remain separately attached. The archived working-status text overcounted the camera matrix as 945; the actual loop contains 315 combinations (5 viewports x 3 DPRs x 7 schedules x 3 Z values). The current report/status corrects this reporting error; the working ZIP and its checksum remain unchanged. Subsequent work tightened schema rejection for self-intersecting/cyclic-duplicate polygons and out-of-range query coordinates, added adversarial tests/contracts and completed validation/reporting. The final ZIP is the final authority; the working ZIP remains an earlier recovery point.

## Implementation

`world_geometry.js` remains the shared boundary. Spatial definitions have convex CCW XY footprints bounded by affine lower/upper planes, finite vertical bounds, matching support faces and stable IDs. Same-material/channel solid unions are permitted because the locked ramp foot intersects the ground; ambiguous/conflicting unions and duplicate volumes are rejected. Record ordering remains canonical. Identity is deterministic data SHA-256 and an explicit compiler revision.

An XY hash with Z filtering supplies swept candidates. Static cylinder clearance clips the true finite solid by the body's vertical interval and tests the circular footprint. Support extrema are calculated over actual disk/polygon overlap, including finite edges. Contextual intervals and previous-support ties prevent selecting an unrelated upper floor. GJK support mappings plus conservative advancement sweep full volumes; analytic separating planes handle exact resting/tangent contacts. Pure geometry rays support collision, visible and IR channels without migrating perception.

`world_motion.js` owns fixed 60 Hz physical movement: contextual grounded support, physical path-speed budgeting, ramp/seam traversal, finite smooth step lift, motor-budgeted forward progress, interruption, unsupported motion, gravity, ceiling/wall impacts, falling and landing events. The root Z is the collider's lowest point. Skin is 0.05 units; motion never uses camera/render time. Player profiles are versioned and centralized (stand 60, crouch 38, crawl 24, slide 25, down 18; spatial radius 15). Gravity 980, slope 35 degrees, step rise 12 and lift cap 180 follow the authority.

The actual `move.js` state machine opts into this motion boundary through `__api.spatialMotion`. It continues to own acceleration, stamina/exhaustion/recovery at 36, deep carpet, crouch/crawl, slide and vault eligibility/cost/duration. Spatial vaults sweep a finite raise/cross/settle envelope and require valid landing support; obstruction interrupts the current pose. Stance changes cannot move the root through a roof. Existing normalized perception profiles are not replaced by heights.

Level 0 remains the same flat map, with its existing planar motor/collision, AI, evidence, network, death/corpse and item paths. Loading the new module does not enable spatial Level 0 or add a network Z protocol. No spatial showcase geometry was inserted into Level 0.

## Objective acceptance and limitations

- 21 core spatial groups and 54 adversarial/analytical controls pass.
- Ten real-motor spatial scenarios match over eight render schedules: 15/30/60/120/144/240/360 FPS and jitter. Stamina/state ticks are not multiplied by collision segments.
- All 46 frozen flat trace record arrays remain identical (35,098 records), and the full map/nav/query/placement/seed export remains byte-identical.
- CAMERA-P01 policy checks pass 315 context combinations, with served application resize bindings independently checked. Reference world envelope is 1536 x 864 units at 1920x1080/1.25.
- Retained aggregate is 151/162, the same 11 inherited reds. The first aggregate log was incomplete; a complete-output rerun establishes this count. Both records are retained. Hound 18/18, shared 22/23 (F22), human-QA regression 6/6, physics 53 checks, interpolation 3 checks, network suites and existing performance gates retain their outcomes.
- Browser runtime/visual verification is BLOCKED: Playwright is available, but its supported browser executable is missing. HTTP/VM tests are not a browser pass. All subjective QA is pending.

This is a bounded cylinder/convex-solid foundation, not a general rigid-body engine. GJK/contact/ground-segment limits stop at safe poses and record diagnostics. Gravity uses a swept 60 Hz chord with maximum parabolic error 0.0341 units, below contact skin. Ground trajectory segments are at most one unit and still receive full volume sweeps; they are not an endpoint-only collision substitute. Compile-time overlap validation remains quadratic; very large authored worlds need later profiling. See `dev/stage_c/README.md` for limits, APIs and exact tool commands.

## Scope lock

No Stage D view/cutaway/projection, Stage E AI navigation/sensor migration, Stage F network-Z, Stage G elevated death/items, Stage H presentation or Stage I optimization. Hound/Smiler code and tuning are unchanged. No player anatomy/art changes or fall-damage balance. `contact`, `traceSupportMotion` and sound propagation remain explicitly unimplemented for their later consumers. The original Z01–Z32 matrix stays frozen; `dev/stage_c/activation.json` records only actual Stage C subsets.

Future implementers must preserve: fixed 60Hz policy; root-base Z; finite collider volume; contextual support; continuous motion without endpoint teleport; bounded fail-safe collision; canonical Level 0 data/flat behavior; existing evidence and species authority; unchanged wire ownership until Stage F; existing shared death plan until Stage G; and strict separation between physics and local rendering. Do not treat automated success as human gameplay approval.
