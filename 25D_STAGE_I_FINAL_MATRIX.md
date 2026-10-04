# Stage I final Z01–Z32 acceptance matrix

Every row is backed by a final named execution from the complete fresh extraction. Cross-stage contributions are explicitly linked. Z32’s exact final archive identity is verified by the external I5 receipt.

| ID | Owner stage(s) | Scenario | Executing suite / command | Runtime | Disposition | Evidence |
|---|---|---|---|---|---|---|
| Z01 | C/E | Two walkable floors with identical XY | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log; dev/stage_i/evidence/i4/regression-01/stage-f-authority.log |
| Z02 | C/E | Open stairwell beside a closed slab | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z03 | C | Ramp ascent/descent, including diagonal travel | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z04 | C | Stair treads/risers, different approach directions | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z05 | C | Stair interruption, reversal, sideways departure | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z06 | C | Thin intermediate slab during fast fall | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z07 | C | Under-ceiling upward impulse / vault | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z08 | C | Crawl passage under an occupied upper floor | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z09 | C | Narrow seam, convex corner and near-equal contacts | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z10 | E | Allowed/forbidden traversal per species | s_nav25d / node dev/tests/s_nav25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_nav25d.log |
| Z11 | E | A* with stacked endpoints and one-way drop | s_nav25d / node dev/tests/s_nav25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_nav25d.log |
| Z12 | E | Target visible, then hides and chooses different floors | s_perception25d / node dev/tests/s_perception25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_perception25d.log |
| Z13 | E | Ambiguous sound from above/below | s_perception25d / node dev/tests/s_perception25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_perception25d.log |
| Z14 | E/H | Visible lamp/flashlight/IR on another story | s_perception25d / node dev/tests/s_perception25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_perception25d.log; dev/stage_i/evidence/i4/portable-01/view25d.log; dev/stage_i/evidence/i4/regression-01/stage-h-lighting.log |
| Z15 | E | Gaze through a floor versus through a clear opening | s_perception25d / node dev/tests/s_perception25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_perception25d.log |
| Z16 | E | Pack/group members on different surfaces | s_perception25d / node dev/tests/s_perception25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_perception25d.log |
| Z17 | C/E/G | Near/mid/far LOD with airborne mover | s_perception25d / node dev/tests/s_perception25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_perception25d.log; dev/stage_i/evidence/i4/portable-01/physics25d.log; dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z18 | A/C/I | Walk/sprint/stamina/exhaustion/deep carpet | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z19 | C | Spatial slide/vault/crouch/crawl/drop | s_world25d / node dev/tests/s_world25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/s_world25d.log |
| Z20 | F | Normal wire movement under latency | network25d / node dev/tests/network25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/network25d.log |
| Z21 | F | Malicious movement/protocol claims | network25d / node dev/tests/network25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/network25d.log |
| Z22 | F | Reconnect/world reset, same ID | network25d / node dev/tests/network25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/network25d.log |
| Z23 | F | Interpolation over stair/drop/teleport boundaries | network25d / node dev/tests/network25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/network25d.log |
| Z24 | F | Alive/free, captured, dead, revived and new-run lifecycle | network25d / node dev/tests/network25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/network25d.log |
| Z25 | G | All eight existing death variants on spatial fixtures | physics25d / node dev/tests/physics25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/physics25d.log |
| Z26 | F/G | Authoritative death then immediate disconnect | physics25d / node dev/tests/physics25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/physics25d.log |
| Z27 | F/G | Normal client replay then delayed/duplicate messages | physics25d / node dev/tests/physics25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/physics25d.log |
| Z28 | G | Body on ledge, gear falling to lower floor | physics25d / node dev/tests/physics25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/physics25d.log |
| Z29 | D/H | Different clients above/below same location | view25d / node dev/tests/view25d.js | v24.19.0 / Chromium 151.0.7922.34 / ANGLE SwiftShader | PASS | dev/stage_i/evidence/i4/portable-01/view25d.log |
| Z30 | H | High resolution, ultrawide, NV/zoom and overlays | view25d / node dev/tests/view25d.js | v24.19.0 / Chromium 151.0.7922.34 / ANGLE SwiftShader | PASS | dev/stage_i/evidence/i4/portable-01/view25d.log |
| Z31 | G | No live players, active settling bodies | physics25d / node dev/tests/physics25d.js | v24.19.0 | PASS | dev/stage_i/evidence/i4/portable-01/physics25d.log |
| Z32 | B/I | Fresh extraction in a path containing spaces | perf_world25d / node dev/tests/perf_world25d.js | v24.19.0 / Chromium 151.0.7922.34 / ANGLE SwiftShader | PASS | dev/stage_i/evidence/i4/portable-01/perf_world25d.log; dev/stage_i/evidence/i4/portable-01/result.json; 25D_STAGE_I_PACKAGE_VERIFICATION.json (external I5 publication receipt) |

Machine-readable version: `dev/stage_i/evidence/i4/final-matrix.json` (also delivered as 25D_STAGE_I_FINAL_MATRIX.json).
