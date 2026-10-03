# G2 — independent gear, stable ledges and physical records

PASS Z28 focused through real dphys/world_motion/geometry: Hound A body settles on support:upper at Z120; light falls and settles on support:lower at center Z7.0905. Beam origin/direction follows that light. Authored releases inherit hand/body attachment velocities, including the hand spring's angular anchor motion; release event records XYZ velocity. Existing hat release remains authored; attached hat/backpack rules unchanged.

Support polygons include deterministic footprint samples, real circle/edge intersections and bounded contact vertices. Center-of-mass margin distinguishes stable contact; unstable overlap receives outward tipping motion while retaining full slab collision. Tests just inside/outside negligible overlap and symmetric .02-unit support both fall. Hands retain real reachable braces and bounded 3D constraints.

Physical decals identify one solid face, support (top faces only), geometry hash, contact point and invertible local coordinates. No XY floor fan-out. Trails break during unsupported flight and resume with a new segment on actual lower contact. Events, decals and trails are bounded at 64/32/60 per aftermath. No production renderer integration.

Preserved first failure plus full diagnostics: symmetric thin support yielded an ambiguous near-zero GJK normal and repeated safe fallback. Repair uses the already-known physical support normal for the unilateral force while tipping. It does not ignore collision or force sleep. Same adversarial gate now passes; retained G1 core passes.
