# Stage A contracts and synthetic fixture

These records are inactive developer data. The authoritative architecture is copied unchanged into `ARCHITECTURE_AUTHORITY.md`. `spatial25d.d.ts` describes records and future query signatures; it supplies no solver, compiler, live protocol, or runtime imports. Query return details remain to be concretized in their owning implementation stage. No ECS, external physics engine, or voxels are introduced.

## Coordinate contract

Legacy world units and XY orientation are retained. Z is positive upward. Root position is the base of an upright collider; root height and radius are physical dimensions, distinct from presentation offsets. Loose object centers have their own shapes/support. A support plane is `z = a*x + b*y + c`. Solid lower/upper planes bound finite volume over the footprint. IDs cannot stand in for elevation. Stair tread surfaces are horizontal with real solid risers; a stair link describes a route through those solids, not a slope or endpoint teleport. Gravity/support/traversal have no implementation in Stage A.

## Distinct identity domains

`identity25d.js` makes typed, unambiguous JSON-array keys from explicit fields. Values never depend on array index, XY, render slot, or current support. String IDs include a readable namespace. Numeric generations/sequences are nonnegative safe integers; overflow must create a fresh enclosing epoch, never wrap/reuse. No live network field is added.

| Identity | Scope / lifecycle |
|---|---|
| world asset | Authored world definition across room instances |
| world epoch | Fresh unique instance/session; changes when world is replaced |
| geometry revision | Version of collision/support/nav/occlusion data for an asset |
| entity ID + entity generation | Logical handle plus reuse generation within world epoch |
| player life generation | New life/run; separate from entity ID reuse and geometry version |
| pose sequence | Monotonic within entity generation and player life; no cross-life interpolation |
| death sequence | Scoped to world epoch, victim ID and life generation; identifies one aftermath |
| physical object ID + generation | Independent body/equipment identity, optionally associated with one death |
| link/support/nav/space/portal ID | Explicit authored ID scoped by asset + geometry revision |

The architecture's death key omits entity generation. Therefore lifeGeneration MUST remain unique for a victim ID throughout a world epoch, including when its entity generation changes; do not reset that counter on ID reuse. Dead bodies and gear retain their originating death key. Use entity generation and life generation independently for actor/network validity. Geometry IDs persist across array reordering; canonical order is for deterministic processing, not identity.

## Shared fixture coverage

`dev/fixtures/world_25d.js` is a static deterministic WorldDefinition. It never replaces Level 0.

- Split ground excludes a lower pit; lower platform is at Z=-96.
- Upper slabs occupy Z=168..180, with a real rectangular stair opening. Same-XY anchors at (160,160) are at Z=0 and 180 on separate supports.
- Fifteen finite tread solids rise 12 units each to Z=180; their vertical faces supply risers.
- A separate ramp rises from Z=0 to 180 with an upper landing.
- Crawl roof underside Z=28 and low ceiling underside Z=44 reserve profile/clearance tests.
- Balcony Z=120 over the lower pit has a directed drop link and future corpse anchor; lower item anchor is separate.
- Finite window-wall pieces leave an actual aperture; explicit portals/space envelopes and an upper view group reserve LOS and cutaway cases.
- Profile dimensions are synthetic fixture values, not new gameplay tuning.

`validate25d.js` checks finite numbers, required record fields, explicit globally unique IDs, canonical ordering, cross-references, basic point/polygon/plane shapes, positive solid thickness at vertices, positive collider dimensions and directed link declarations. Negative controls cover each principal failure category. It is NOT a full TypeScript runtime type checker or a geometric compiler: polygon convexity/winding, topology, overlap, portal-volume subtraction, nav-cell generation, reachability, actual clearance, slope/step feasibility and motion are deferred. Space bounds are broad phase envelopes with a volume-spec declaration; future compilation must subtract solids. Schema validity does not prove physical correctness.

Expected output: **SCHEMA VALID** and **NOT IMPLEMENTED BY DESIGN** for physics. All Z acceptance entry points exit 2 until implemented. Do not add them to a pass-only dashboard or interpret their absence from the legacy runner as completed acceptance.
