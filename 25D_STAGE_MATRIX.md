# 2.5D acceptance ownership

Authority: locked architecture Z01–Z32. Every row is NOT IMPLEMENTED BY DESIGN. Stage A captures current flat references; it does not satisfy future spatial acceptance. Shared ownership means all listed stages must contribute before final I acceptance.

| ID | Stage ownership | Entry | Scenario | Required behavior |
|---|---|---|---|---|
| Z01 | C/E | s_world25d | Two walkable floors with identical XY | Bodies, paths, pickup and exit targets retain the correct support; no contact/separation through the slab. |
| Z02 | C/E | s_world25d | Open stairwell beside a closed slab | Sight/light can cross the opening and cannot cross the closed slab. Horizontal, vertical and oblique rays agree on the same primitives. |
| Z03 | C | s_world25d | Ramp ascent/descent, including diagonal travel | Continuous Z/velocity, correct support normals and physical path distance; no acceleration/stamina changes on the flat control. |
| Z04 | C | s_world25d | Stair treads/risers, different approach directions | Finite-time step-up, no pose teleport, actual riser/ceiling collision; item/corpse motion does not use assisted steps. |
| Z05 | C | s_world25d | Stair interruption, reversal, sideways departure | Current pose remains continuous; correct support or free fall; traversal cannot finish after interruption by writing its endpoint. |
| Z06 | C | s_world25d | Thin intermediate slab during fast fall | Sweep lands on first intersected support; cannot tunnel through or select a higher floor behind the trajectory. |
| Z07 | C | s_world25d | Under-ceiling upward impulse / vault | Head/body hits underside; no ceiling escape or automatic promotion to upper-floor support. |
| Z08 | C | s_world25d | Crawl passage under an occupied upper floor | Low posture fits; standing rejected; upper actor neither blocks the crawl through an intact slab nor becomes touchable. |
| Z09 | C | s_world25d | Narrow seam, convex corner and near-equal contacts | Stable support/tie order, bounded penetration, no tiny-step wall exploit and no frame-rate-dependent floor jitter. |
| Z10 | E | s_nav25d | Allowed/forbidden traversal per species | Real Hound crawl/vault remains possible where valid; Smiler gains no crawl/tight-gap/teleport ability. |
| Z11 | E | s_nav25d | A* with stacked endpoints and one-way drop | Finds connected route; rejects impossible reverse; no XY-only snap/cache reuse/shortcut across an unsupported gap. |
| Z12 | E | s_perception25d | Target visible, then hides and chooses different floors | With identical legitimate observations, decisions/RNG match until new evidence differs. Hidden true support/Z cannot select the branch. |
| Z13 | E | s_perception25d | Ambiguous sound from above/below | Anonymous identity and vertical uncertainty preserved; no source-ID or true-floor leak. Door/stairwell and slab attenuation differ only by geometry/material. |
| Z14 | E/H | s_perception25d | Visible lamp/flashlight/IR on another story | Z-aware occlusion and receiver height; visible-light rules retained; IR OFF/HIGH produces identical monster decisions under otherwise identical observations. |
| Z15 | E | s_perception25d | Gaze through a floor versus through a clear opening | Physical LOS required; existing Hound intimidation and Smiler hold/release timers remain unchanged when observations are equal. |
| Z16 | E | s_perception25d | Pack/group members on different surfaces | No impossible physical grouping/contact; no new shared hidden-player knowledge; flat group/watchdog traces remain unchanged. |
| Z17 | C/E/G | s_perception25d | Near/mid/far LOD with airborne mover | Fall/traversal continues at fixed ticks; no sleep in midair, link teleport or skipped landing because an observer leaves. |
| Z18 | A/C/I | s_world25d | Walk/sprint/stamina/exhaustion/deep carpet | Real motor and recovery threshold 36/radius 15 verified; equal 15/30/60/120/144/240/360 FPS and jitter schedules produce equal fixed-tick results. |
| Z19 | C | s_world25d | Spatial slide/vault/crouch/crawl/drop | Actual movement state machine drives geometry; no replacement formula model; valid modes retain their resource costs and finite trajectories. |
| Z20 | F | network25d | Normal wire movement under latency | Seeded 20–250 ms latency, jitter, duplicated/stale reports and a 1 s bunching interruption; no unauthorized movement, persistent rejection or lifecycle reset; record correction count and magnitude. |
| Z21 | F | network25d | Malicious movement/protocol claims | Reject huge XY/Z jumps, wrong support, fake link completion, future/reused tick credit, speed/quiet-gait claims, nonfinite values and geometry mismatch. |
| Z22 | F | network25d | Reconnect/world reset, same ID | Old `h1` near x=5000/server time 60; new `h1` near x=1000/time 1 and another support. Use new pose immediately; old clock/slots/Z history removed. Jitter does not reset the world. |
| Z23 | F | network25d | Interpolation over stair/drop/teleport boundaries | No interpolation through a slab; same continuous trajectory at different render FPS; teleports do not blend; unknown extrapolated edges hold. |
| Z24 | F | network25d | Alive/free, captured, dead, revived and new-run lifecycle | Existing respawn/join restrictions, one-use revive and authorization persist; no stamina/protection/teleport escape through new spatial fields. |
| Z25 | G | physics25d | All eight existing death variants on spatial fixtures | Continuous body and independent hands, actual wall impacts, gear detachment/landing, support-aware friction and no sleeping while airborne. |
| Z26 | F/G | physics25d | Authoritative death then immediate disconnect | Other client receives replay, one physical aftermath/corpse, equipment included; late join during fall and after sleep sees the same object state. |
| Z27 | F/G | physics25d | Normal client replay then delayed/duplicate messages | Server does not duplicate or replace correct physical aftermath with stale client pose; death/life generations separate successive deaths. |
| Z28 | G | physics25d | Body on ledge, gear falling to lower floor | Mass loses support appropriately; hands cannot brace in air; gear has independent support/beam; decal remains on its actual contact face. |
| Z29 | D/H | view25d | Different clients above/below same location | Independent cutaway, same authoritative state/hash; unseen geometry and effects remain masked; one client's camera changes no other client's view. |
| Z30 | H | view25d | High resolution, ultrawide, NV/zoom and overlays | Canonical awareness footprint preserved; no hidden entities/eyes/blood/replays/gear leaking from separate Canvas/Pixi layers. |
| Z31 | G | physics25d | No live players, active settling bodies | Physics continues until valid sleep or explicit room disposal; no freeze caused by the current live-player early return. |
| Z32 | B/I | perf_world25d | Fresh extraction in a path containing spaces | Advertised tests/build scripts run without original machine paths; generated outputs reproduce; all required runtime modules return HTTP 200. |
