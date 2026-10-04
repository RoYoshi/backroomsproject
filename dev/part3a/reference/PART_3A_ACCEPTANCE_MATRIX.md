# PART 3A ACCEPTANCE MATRIX

3A is complete only when the REAL production Level 0 can run as a spatial world
through the normal production client/server.

## L0-01 — Deterministic conversion
Identical accepted flat Level 0 revision produces byte/hash-identical spatial
Level 0 output across two clean builds.

## L0-02 — Base identity
All 12 existing room IDs/names/codes and the world XY bounds remain represented.
Base-floor room-to-room circulation remains reachable.

## L0-03 — Physical base world
Walkable Level 0 floor, walls, finite prop geometry and ceilings are real spatial
geometry. No missing-Z or nearest-floor fallback is used.

## L0-04 — Production-scale rendering
Full map may exceed a single 64-solid fixture batch without crash, silent truncation,
missing occluders, insertion-order dependence or hidden-state leak.

## L0-05 — Upper overlap
At least one useful +180 walkable branch shares XY with a lower walkable branch
through a real separating slab.

## L0-06 — Stairs
Production stairs physically connect Z0 ↔ Z+180 with real treads/risers/opening,
continuous motion and correct underside/clearance.

## L0-07 — Ramp
Production ramp physically connects meaningful supports with continuous Z.

## L0-08 — Lower route
At least one -96 local area/drop exists and has a legal intended route out.

## L0-09 — Crawl passage
Real crawl-only passage: crawl fits, standing rejected, upper solid remains physical.

## L0-10 — Props
Existing low/under/gap/window semantics are represented spatially without converting
everything to a full-height blocker.

## L0-11 — Lamps/materials
Existing material regions and lamp identity are preserved and Z-aware. Slabs/openings
occlude visible light correctly. IR/AI separation remains accepted.

## L0-12 — Player spawn
Production player spawns in the recognizable original area at valid Z/support and
can reach the ordinary base map.

## L0-13 — Entity director
Normal director can spawn Hounds/Smilers across valid production candidate anchors
without first-anchor determinism, player-adjacent unfair spawns or new capabilities.

## L0-14 — Cartograph
One per-world cartograph selection remains variable/deterministic from spatial
candidate anchors and is physically reachable.

## L0-15 — Glitched exits
Production world selects multiple valid spatial glitched-wall exits from candidate
anchors; selected exits are physically reachable and not one permanent hardcoded set.

## L0-16 — Navigation
Representative base/upper/lower routes pass graph AND real physical execution for
actual Hound/Smiler capabilities.

## L0-17 — Perception
Same-XY upper/lower actors respect real LOS/light/sound/evidence uncertainty; no
cross-slab hidden truth leak.

## L0-18 — Multiplayer
Two real clients traverse different elevations, reconnect, fall, and observe each
other correctly with independent cutaway.

## L0-19 — Aftermath
Death on base/upper/lower/stair/ramp/ledge uses the accepted authoritative Stage G
aftermath with correct body/hands/gear support.

## L0-20 — Picking / interactions
Production spatial picking selects nearest physically visible valid targets and
cannot interact through cutaway/solid slabs.

## L0-21 — Readability
Automated evidence plus human handoff shows stair/ramp/platform direction and local
upper/lower separation without relying on debug labels. Subjective final approval
remains human.

## L0-22 — Flat control
Accepted Stage I flat Level 0 remains runnable and unchanged as a compatibility
control. 3A spatial Level 0 is explicit during engineering/QA.

## L0-23 — Regression
All seven certified Stage I 2.5D suites continue to pass; frozen flat references
remain unchanged unless an explicitly authorized content-only spatial test adds
new references separately.

## L0-24 — Package
Fresh path-with-spaces extraction builds/runs, spatial Level 0 artifact is present,
ordinary server/redirect remain valid, and final archive/hash/tree verify exactly.

A failure in any L0-01…L0-24 gate blocks 3A engineering completion.
