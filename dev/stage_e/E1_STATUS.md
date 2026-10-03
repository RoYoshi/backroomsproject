# E1 — NavSurface and TraversalLink core

Starting commit: `c034a6d3d22e4eeb5f183a3017c429caf9bed356` on `stage-e`.
Runtime: Node v25.9.0. All 585 Stage D parent files matched the immutable ZIP
before implementation; supplied ZIP checksum and CRC matched E0 evidence.

The existing `Geo.path` A* now also searches composite surface/cell nodes and
directed traversal edges in its existing typed-array workspace. Spatial search
uses the conservative zero heuristic. The flat graph, costs, heuristic and
waypoint format retain their original branch. Spatial endpoints require finite
XYZ and support/surface context; XY-only calls fail closed. Cache identity
includes geometry/topology, surfaces and species/profile capability context.

The additive Stage E fixture retains the frozen geometry and authors finite
portal regions for its stairs, ramp and one-way drop, with explicit Hound and
Smiler fit profiles. It has 685 allocated nodes and 4,504 edges, including four
directed special traversal links. Hound can fit the existing low roof while
Smiler cannot gain crawl capability.

Focused core tests: 8 groups PASS. Graph routes cross the stairs between stacked
endpoints; the one-way drop has no reverse route. Canonical reconstruction is
deterministic. These graph tests do not claim physical traversal success.

E2 must replace preliminary supported-segment checks with shared motion proofs,
validate special links physically, cover the top-tread/landing seam, and execute
routes through the real motion kernel. Sensor/brain integration remains E3/E4.
Stage F has not begun. Human QA has not been performed.

Changed application files: `dev/ai_src/10_geo.js`, generated `ai.js`.
Added: this status, `fixture.js`, `test_core.js`, `package_checkpoint.py` and
`evidence/e1/core.log` beneath `dev/stage_e/`.
