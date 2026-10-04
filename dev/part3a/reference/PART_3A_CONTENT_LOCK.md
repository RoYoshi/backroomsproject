# PART 3A — PRODUCTION LEVEL 0 CONTENT LOCK

The goal is not to create a different Backrooms level.

The goal is to turn the EXISTING Far Backrooms Level 0 into a spatial production
world while preserving its recognizable layout, rooms, objective and gameplay
identity.

## 1. Base-map preservation

The accepted flat Level 0 remains the content source of truth for:

- world XY bounds: 9216 × 6912
- 96 × 72 tile organization
- 96-unit tile scale
- 12 named room regions and room codes
- floor/wall/door carving identity
- material regions:
  - carpet
  - deep carpet
  - concrete
  - wet
- pillar/column identity
- existing prop identities and semantics
- lamp ordering/identity
- original player-spawn neighborhood
- cartograph objective concept
- glitched-wall exit objective
- normal entity director population/tuning

Do NOT procedurally replace Level 0 with the small Stage E fixture.

Do NOT redesign the twelve room identities merely to make 2.5D easier.

All original room-to-room base-floor circulation must remain reachable unless a
specific production spatial feature intentionally replaces a local route and is
documented/tested.

## 2. Spatial scale

Use the already-proven project spatial scale unless a concrete content blocker is
documented:

- base walkable Level 0: Z = 0
- ordinary floor slab: approximately -16 → 0
- ordinary floor-to-ceiling envelope: 180
- ordinary ceiling/slab thickness: approximately 16
- primary upper walkable elevation: Z = +180
- primary lower walkable elevation: Z = -96
- player spatial profile remains the accepted profile
- crawl clearance remains based on the accepted 24-unit crawl body
- standing/crouch/crawl/slide physics are NOT retuned in 3A

Ramps and stairs are continuous physical geometry between those supports.

Do not invent a "floor number" as physical truth.

## 3. Mandatory production spatial feature families

Level 0 must contain meaningful examples of ALL of these in normal production
gameplay, not a separate diagnostic page:

### A. Upper route / same-XY overlap
At least one substantial walkable +180 branch where an upper and lower walkable
space share XY while being separated by a real slab.

Preferred thematic zones:
- LONG ROOM
- PILLAR HALL
- ARCH GALLERY

The exact local composition may be adjusted to fit the canonical XY layout, but:
- base-floor circulation remains available,
- the upper route is physically useful rather than a decorative platform,
- it contains at least one entity/item-capable area,
- it exercises real cutaway and same-XY visibility.

### B. Real stairs
At least one full stair connection from Z0 to Z+180.

Requirements:
- actual finite treads/risers
- no endpoint teleport
- clearance/underside remain physical
- Hounds may use only their existing allowed traversal
- no new Smiler capabilities
- stairwell opening is actual absent material

3A accepts physically correct stair motion even if its rendered motion still looks
mechanically stepped. 3B owns visual smoothing.

### C. Real ramp
At least one continuous ramp connection between meaningful supports.

Preferred zone:
- LONG ROOM / approach to an elevated branch.

### D. Lower/depression route
At least one local -96 lower area, pit or maintenance depression.

Preferred zone:
- BLACKOUT ZONE or another suitably dark region.

It must NOT be an inescapable accidental trap.
Provide a legal physical return route unless a deliberate one-way gameplay drop is
explicitly documented and another escape route exists.

### E. Crawl-only spatial passage
At least one real low-clearance passage where:
- crawl fits,
- standing does not,
- an upper solid/occupied region can exist physically above,
- no cross-slab touch/visibility is allowed.

Preferred zone:
- NORTH ROOMS or DAMP ROOMS.

### F. Visible thickness / underside
Floors, elevated slabs and walkable platforms must have readable physical thickness
and undersides.

Do not render "paper floors" that visually overlap without explaining elevation.

## 4. Production-scale geometry conversion

Convert the canonical flat layout deterministically.

Required approach:
- derive from `levels/level0.js`
- preserve stable source IDs wherever possible
- create stable new spatial IDs from source identity, never array position
- deterministic output for identical source revision
- explicit content revision/hash
- explicit materials/supports/spaces/portals/view groups
- actual openings are absence of solid material
- no hidden "nearest floor at XY" fallback

Prefer deterministic rectangle/polygon merging over one-solid-per-tile explosion.

Do not hand-author a completely independent second copy of every flat wall.

A maintained source/generator may produce a canonical spatial Level 0 artifact.
Repeated builds must be byte/hash reproducible.

## 5. Production rendering scalability — MANDATORY

Stage I certified the fixture renderer at a bounded 64-solid presentation capacity.
Full Level 0 will exceed the fixture-sized world.

Part 3A MUST solve this honestly.

Allowed:
- spatial chunking
- deterministic local candidate sets
- static mesh chunks
- broad-phase Z/XY rejection
- deterministic multi-batch/pass submission
- cached immutable geometry keyed by content hash
- render-only culling of geometrically irrelevant distant content

Forbidden:
- silently dropping occluders after 64
- drawing only the nearest floors regardless of physical rays
- reducing collision/AI geometry to meet a render budget
- camera-state mutation of physical geometry
- truncating lights/effects without explicit safe batching

If a local camera/light/picking query needs more geometry than one GPU batch can
hold, split/batch deterministically. Correctness must not depend on insertion order.

Physical world_geometry remains complete even when rendering only a local candidate
set.

## 6. Ceiling / cutaway policy

Standard Level 0 receives real ceilings.

Ceilings/overhead slabs:
- remain physical at all times
- block collision/light/LOS/sound according to material
- may be locally faded only through declared cutawayEligible view groups
- never disappear for server/AI/other clients
- must not reveal hidden upper/lower entities through secondary overlays

Cutaway metadata should be room/chunk scoped rather than one giant whole-map group.

## 7. Existing props → spatial semantics

Convert existing prop identities according to their current gameplay semantics.

Examples:
- low counters/shelves/low walls → finite-height solids
- railings → finite physical barriers with correct height
- table/bench "under" props → real overhead/under-clearance geometry
- gap/hole props → actual carved openings where appropriate
- window props → actual finite openings/sill/overhead geometry

Do not turn all props into full-height walls.
Do not remove existing concealment/crawl/vault meaning.

## 8. Lamps and light anchors

Preserve the existing lamp identity/order and room exclusion rules.

Give each production lamp a real XYZ emitter appropriate to its local ceiling/support.

Requirements:
- <= accepted light capacity per local rendered candidate set, or safely batch
- blackout/failure behavior preserved
- visible vs IR separation preserved
- upper/lower slabs occlude light physically
- no fake lighting through cutaway state

3A is placement/integration only.
3C owns advanced shadows and final lighting aesthetics.

## 9. Spawn / director / objective integration

A production spatial Level 0 cannot use fixture-style "first anchor only" behavior.

### Player
- preserve the recognizable original spawn neighborhood
- player begins at Z0 on a valid named support

### Hound / Smiler
Provide a deterministic pool of valid full XYZ spawn candidates distributed across
the real map and supported elevations.

Production selection must:
- use existing world RNG/director semantics
- preserve normal director population limits/tuning
- respect distance/safety/darkness/visibility constraints already intended by the
  game
- not always choose the first anchor
- allow upper/lower areas to participate where physically/legal
- never grant species new traversal capabilities

### Cartograph
Preserve the rare cartograph concept.
Do not hardcode one permanent known location.

Use a pool of valid spatial item candidates and deterministic per-world selection.

### Glitched-wall exits
Preserve the Level 0 objective and approximately the existing multiple-exit concept.
Do not hardcode one permanent exit.

Use valid spatial exit-candidate surfaces/walls and deterministic per-world selection.
The selected exit must be physically reachable and associated with the correct
support/space.

Do not require the player to use a vertical route merely to preserve the basic
Level 0 escape loop unless separately approved.

## 10. Navigation / AI / evidence

The actual production spatial Level 0 must use the already-accepted Stage E systems.

Required:
- surface-local nav
- traversal links
- valid Hound/Smiler capabilities
- actual LOS/light/sound geometry
- ambiguous vertical evidence where appropriate
- no hidden player Z/support leak
- no fixture bots
- no AI retuning

Representative production routes must physically succeed, not merely graph-pass.

## 11. Death / items / multiplayer

The production Level 0 must use accepted F/G/H/I truth:
- network XYZ
- lifecycle identities
- server-owned unsupported movement
- one authoritative aftermath
- corpse/hand/gear real support
- late join
- reconnect
- independent client cutaway
- production picking/aim

No special "production map shortcut" may bypass these systems.

## 12. Readability lock

Even before 3B/3C polish, elevation must be understandable without debug text.

3A must provide:
- visible slab/platform thickness
- visible stair direction
- visible ramp slope
- coherent upper/lower occlusion
- cutaway that exposes the player's local interior without revealing unrelated space
- no floating actors that appear disconnected from their support
- no visually identical overlapping surfaces with no depth cue

Do NOT solve readability by changing physical Z or gameplay rules.
Later Part 3 stages will improve the art/lighting.

## 13. Not Part 3A

Do NOT spend 3A on:
- final stair animation smoothing
- camera Z easing polish
- new shadow system
- wallpaper/carpet texture overhaul
- fog/dust/particles
- entity visual redesign
- gore redesign
- soundscape overhaul
- menu redesign

Those are later Part 3 stages.
