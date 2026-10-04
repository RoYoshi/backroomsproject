# Part 3A production conversion design — P3A0

Accepted Stage I commit `106c87015ae8702f452979e0277cbacb5435fa6a`, tree `82be2ca8d031f2d46c70a17b5c14c83689dbf8c8`; immutable ZIP SHA-256 `e5ebb8cd7b9c511ce83ea56443e7382de13e1cfbf2a0b2e2764808136e924bff`. Stage I human QA PASS. Flat `levels/level0.js` remains frozen.

The maintained generator derives the tile mask, carved doors, pillars, prop rectangles, rooms, materials and ordered lamps through the accepted geometry adapter. It deterministically merges adjacent equal cells into rectangles within 768-unit chunks. IDs encode source category, coordinates and bounds, never an array index. Structural solids retain finite volume. Support material retains carpet/deep/concrete/wet semantics.

The spatial JSON has explicit revision/hash, solids, support patches, 48-unit navigation charts, actual open air spaces/portals, local cutaway groups, lights and validated anchors. Source identity and conversion provenance remain in the content metadata. The generated JSON is selected with the existing `TFB_WORLD` mechanism; flat remains the default.

## Planned local features

| Feature | Production location and geometry |
|---|---|
| Upper branch | LONG ROOM, approximately tiles x58–70/y7.5–10.5. Z+180, 16-unit slab, with useful room above the retained Z0 route. Named upper support and finite edge walls. |
| Stairs | LONG ROOM, x58–60/y10.5–15.5, rising north through 15 real 12-unit risers and 32-unit treads. Actual ceiling opening and finite stair underside. |
| Ramp | LONG ROOM, x66–68/y10.5–15.5, continuous northward 180/480 slope; connects the same upper branch for a useful alternate route. |
| Depression | BLACKOUT ZONE, x6–9/y57–62; north approach descends over 288 units to a Z−96 area at y60–62. Rim walls below base level and a reversible ramp provide escape. |
| Crawl | NORTH ROOMS, x17–20/y8.5–9.5; 28-unit clear height, actual overhead solid and finite side boundaries. Both ends open. |

Coordinates are a preflight content plan; any physical fit correction is recorded in the generated manifest and evidence. Nothing may require changing accepted body, gravity, slope or step tuning. The original room/corridor connections and objective remain reachable at the base level.

## Production scale risks and resolution

`world_view.js` rejects more than 64 solids and its fragment ray loop is fixed at 64. This must become complete deterministic spatial candidates and GPU batches, with all required eye/light/mask occluders included. Rendering never changes the physical definition. CPU picking uses complete physical geometry. Relevant lamp candidates preserve IDs/order and visible/IR rules; no silent light truncation.

The physical validator currently compares all solid pairs; add only conservative broad-phase rejection if measured production conversion cost requires it. Navigation retains surface-local 48-unit cells, existing A*, clearance and link execution. No algorithm or AI/canon retuning is authorized.

Production spawn pools must replace the fixture's first-anchor behavior only for the production descriptor, using existing world RNG and separation/darkness rules. Select one cartograph and three variable glitched-wall exits from reachable explicit candidates. No vertical route is required for the basic escape objective.

## Validation boundary

Every milestone preserves raw failed attempts before repair, then commits/pushes/verifies `part-3a`. P3A1 proves complete base content and repeat builds; P3A2 physical vertical routes; P3A3 real gameplay/AI/authority; P3A4 served full-map pixels and performance; P3A5 all seven retained suites, flat/frozen equivalence, clean extraction and exact source/package identity. L0-01–L0-24 all must pass. Subjective readability and game feel remain human QA.

P3A0 contains design, reference authority and inventory only. Part 3B–3G not begun. Main not modified or merged.

## P3A2 built content amendments

The LONG ROOM stair is 96 units wide at x5568–5664, leaving the accepted wall at its eastern base intact. Fifteen 12-unit risers retain 32-unit treads and an 80-unit traversal corridor. The upper slab and continuous 192-unit-wide ramp remain at the planned locations. Each has an actual ceiling opening and named local cutaway group.

The BLACKOUT depression keeps the planned footprint x576–864/y5472–5952. Its Z−96 level occupies y5472–5664, with the return ramp rising south over y5664–5952. The preflight north approach was blocked by a preserved original wall; the failed physical traversal is retained as `motion-01.json`. Rotating the local ramp preserves that wall and provides a proven route out. A real side-rim drop lands on the same lower support.

The NORTH crawl corridor has 28 units of body clearance and finite roof/side geometry. Same-XY LONG ROOM base/upper bodies at x6192/y864 have different physical supports and a separating slab. All 12 original rooms remain connected on the standing-height base map (12,956 reachable 48-unit cells). The generator records exact feature bounds, links and support IDs in `production.features` and the content manifest.
