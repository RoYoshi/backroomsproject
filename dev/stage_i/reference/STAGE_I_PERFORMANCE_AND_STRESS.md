# STAGE I PERFORMANCE AND STRESS CONTRACT

The architecture requires bounded stress measurements, not invented capacity claims.

## Principles

1. Correctness first.
2. Measure normal and stress workloads separately.
3. Preserve raw failing/slow evidence.
4. Do not drop physics/evidence/masks to meet a budget.
5. Degrade cosmetic quality only where already authorized.
6. Record host CPU, memory, Node, browser, GPU/renderer, viewport/DPR and timing method.
7. Wall-clock timings are evidence metadata, never simulation input.

## Required workload families

### Geometry / support / collision
Measure representative:
- ordinary spatial fixture queries
- stacked same-XY support candidates
- high local collider density/pathological overlap fixture
- ramp/stair/drop/crawl/underside sweeps
- candidate counts/query
- TOI/contact iterations
- safe fallback counts
- p50/p95/p99/worst where meaningful

No scan-every-floor fallback may be introduced.

### Navigation / AI / perception
Measure representative:
- normal entity population in spatial fixture
- bounded multi-entity path/search workload
- traversal links
- replanning/search budgets
- sensor rays/candidates
- light cache/ray behavior
- LOD with airborne/active traversal

Do not skip physical motion when AI is far/LOD reduced.

### Authority / networking
Use real server and clients with:
- normal snapshots
- 20–250 ms seeded latency
- jitter
- duplicate/stale packets
- one-second bunching interruption
- reconnect/world reset
- malicious spatial claims
- active traversal/fall
- aftermath state

Record:
- bytes/client/sec
- snapshot/frame sizes
- correction count/magnitude
- queue/history/work bounds
- geometry queries induced by validation
- rejection behavior

### Death / loose objects
Retain Stage G correctness and measure:
- 1 active aftermath
- several simultaneous active aftermaths
- bounded worst case around the existing corpse record ceiling (24)
- awake vs sleeping work
- body/hand/item counts
- geometry/contact queries
- snapshot payload

The existing Stage G 24-active limitation is a known input to Stage I.
Stage I may safely optimize it, but must not:
- sleep unsupported bodies,
- lower collision correctness,
- skip death substeps,
- remove replicated truth.

If it remains a limit, quantify it precisely.

### Presentation / browser
Use the production Stage H path.

Measure representative:
- 16:9
- 16:10
- ultrawide
- high DPR / 4K
- full quality
- reduced quality
- NV/zoom
- two clients
- spatial aftermath/effects
- cutaway transitions

Record:
- CPU submission
- completed/drained frame timings where possible
- render-target/resource estimate
- draw calls
- visible/candidate solids
- overlay/effect counts
- cutaway cost
- script/GL/resource errors

SwiftShader results are reproducibility evidence, not hardware certification.

If actual hardware GPU is available, record it separately without replacing the
deterministic software evidence.

### Multi-room / long-running server
Run a bounded server soak representative of actual supported architecture.

Record:
- room count/workload used
- players/entities per room
- memory growth
- event-loop/tick timing
- snapshot/network throughput
- cache sizes
- corpse/evidence/history/slot bounds
- disconnect/reconnect churn
- world creation/disposal

Do not claim support for a population not actually tested.

## Performance disposition

For every workload classify:
- PASS WITHIN EXISTING EXPLICIT THRESHOLD
- PASS / BOUNDED MEASUREMENT (no architecture threshold)
- KNOWN LIMITATION
- REGRESSION
- ENVIRONMENT BLOCKED

A known limitation may remain only if:
- correctness is intact,
- it is not a new unexplained regression,
- the architecture does not define it as a mandatory hard threshold,
- it is explicitly carried into the final report/handoff.

Any actual new regression requires investigation before Stage I can complete.
