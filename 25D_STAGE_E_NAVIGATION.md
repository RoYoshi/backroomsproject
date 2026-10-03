# Stage E navigation

The maintained navigation owner remains `dev/ai_src/10_geo.js`, built into
`ai.js`. Level 0 uses the existing flat branch: 48-unit cells, eight neighbors,
no diagonal corner cutting, legacy wall costs, capabilities, A* and steering.

## Surfaces, graph and links

Spatial node identity is `(navSurfaceId, localCellId)`, deterministically flattened
into the same typed-array A* workspace. Occupied chart bounds allocate cells;
there is no full-world grid for every possible Z. Nodes hold actual XYZ support,
patch, material, slope and clearance context. Same-XY stacked floors have distinct
nodes. The supplied Stage E fixture compiles to 685 nodes and 4,518 edges.

Continuous coplanar sheets generate geometry-proved walk seams. Authored stairs,
ramps and drops have directed entry/exit portal regions, corridors and profiles.
Additional crawl/vault fixtures exercise existing species capabilities. Both real
species use stairs, ramps, drops and swept vaults; only Hound may crawl. Link
availability is proved through `world_motion.js`, including real headroom and
landing. Invalid reverse drops are rejected. No timer writes an endpoint pose.

Spatial A* uses zero heuristic, a conservative admissible lower bound even with
species vault speed discounts. Ordinary edges retain clearance/wall preferences;
special edge cost includes physical distance and measured fixed-tick duration.
Search expansion defaults to 14,000 nodes; uncertain-goal probes use 4,000.
The spatial heap is sized from graph edges plus nodes to accommodate queued
duplicates. Candidate uncertainty never spawns an unbounded secondary planner.

## Identity, smoothing and motion

Route identity includes geometry hash, topology revision, start/goal surface or
bounded candidate set, collider profile, radius/height, slope/step/lift policy,
crawl/tight-gap/vault capabilities, vault speed and rounded goal XY. A newly
observed different surface invalidates a route. Existing same-sheet commitment
and hysteresis survive. Physical edge proofs are cached by edge/profile/capability
identity; these proof-cache counters are distinct from `routeRequests`, `routeCacheHits` and `routeCacheMisses`, which count committed-route reuse/refresh without changing decisions.

Snapping requires explicit XYZ and support/surface context. Smoothing and direct
motion require shared continuous support and swept clearance proof, including
subpixel gap rejection. They cannot skip a stair, slab, crawl posture or drop.
Waypoints carry XYZ/support/surface/link information. Actor-bound geometry facades
answer the retained brains' local XY questions on the actor or remembered sheet.

Traversal advances through the real Stage C kernel once per 1/60-second tick.
Interruptions retain the current pose and resolve the remaining physical state.
The top-tread/landing fix changes support identity only when both patches overlap
the footprint, share a continuous boundary/height and allow current clearance;
it never relocates XYZ or selects an unrelated upper floor. Stuck recovery measures
actual progress and cannot finish a link by teleporting.

Spatial spawn requires finite explicit Z and physically valid support/clearance.
Airborne, assisted-step, active-link and live-interaction states stay at fixed
ticks. Far actors use cheaper thought schedules and passive sensing; falling and
traversal continue even when observers leave. No production spawn/wire migration
is included.

## Evidence and budgets

`dev/stage_e/evidence/final/focused/acceptance.log` invokes the actual core (8),
motion (16), sensors (16) and real-entity (25) groups through Z10–Z17 entry points.
The frozen Stage A future matrix remains untouched. Detailed physical route,
support history, interruption and species evidence is retained under `evidence/e4`.

`evidence/final/spatial-performance.json` records actual fixture plan
median/p95/p99/max time and cost, expanded nodes, traversal-edge checks and proof
cache hits/misses. It also records repeatable 1/2/4-sheet workloads, entity/receiver
counts, route refresh/retention, sensor queries and evidence peaks. It is a bounded
diagnostic, not Stage I population or hardware capacity certification.

The E5 long regression found an undefined `geo` in the flat `coarseMove` branch.
Spatial movement already returns before that branch. Restoring the original XY
distance expression removed the crash; original retained assertions were not
changed. Candidate-failure logs remain available for audit.

## Measured final workload

On Node v25.9.0, the connected eight-entity/four-surface fixture completed 660 ticks
(600 measured): median 0.430 ms, p95 6.648 ms, p99 20.568 ms, worst 120.248 ms per
step. Forty warm stacked-floor plans measured median 11.064 ms, p95 16.012 ms and
max 16.591 ms, with cost 1496.605 units. There were 142 plans, 30,827 expanded
nodes, 206,721 edge checks, 196,922 proof-cache hits and 8,321 misses; the largest
search expanded 573 nodes. Committed routes had 480 reuse hits / 31 refresh misses
across 511 requests. Sensors recorded 65 candidates, 3,951 rays, 2,815 light
queries, 100 sound queries, 236 sound nodes and 46 portals.

The separate cold/warm 20-plan fixture run included a 260.737 ms first-use maximum
and 330 traversal-edge checks. Repeated 1/2/4-sheet workloads allocated exactly
130/260/520 nodes, with 2/4/8 real actors and players, two seeds and 360 fixed ticks
each. Counts and caps pass; timing spikes are disclosed, not converted into a
60 Hz capacity guarantee. See both `spatial-performance.json` and
`connected-performance.json` under `evidence/final/`. No physical checks were
removed for performance.

## Independent workload sample

The separate connected run in `evidence/final-spatial/connected-performance.json` measured median/p95/p99/worst simulation steps of 0.406/10.045/42.986/163.051 ms and warm plan median/p95/max of 13.039/45.510/53.802 ms, with identical graph, planning/query counts, route hit/miss counts and caps. Both samples are retained; the differing timing tails are not hidden. The two-round parent/current flat workload comparison is `evidence/performance-comparison.json`; all absolute retained gates passed, with no threshold-exceeding comparison recurring in both rounds. These measurements share a host with other work.
