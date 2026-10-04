# The Far Backrooms — 2.5D World Architecture

**Status: IMPLEMENTATION-READY DESIGN — NO IMPLEMENTATION PERFORMED**  
**Authority: locked Part 2 v23.3.6-hqa-search-polish baseline supplied for this task.**  
Prepared 2 October 2026. Human gameplay QA of any future 2.5D implementation remains required.

This specification adds continuous spatial geometry beneath the existing game. Keep the 60 Hz simulation, species brains, evidence law, movement tuning, navigation algorithms, procedural character art, and shared death simulator. Evolve their inputs and physical queries so that overlapping XY positions can represent different places in one connected XYZ world.

The minimum addition is **one canonical level-data source, one shared geometry/query module, one shared spatial-motion module, and one client world-view module**. Extend the existing navigation module into a graph of surface-local grids connected by traversal links. Do not introduce an ECS migration, general-purpose rigid-body engine, voxel world, replacement AI, replacement network transport, or replacement application renderer.

“2.5D” describes presentation. Floors, ceilings, ramps, stairs, actors, hands, loose equipment, contact, light paths and falls exist in three spatial dimensions. A floor number, drawing offset, or screen-depth sort is never a substitute for physical Z.

## 1. Current architecture audit

### 1.1 Baseline and audit scope

Inspected package:

`thefarbackrooms-level0-part2-v23.3.6-hqa-search-polish(2).zip`

SHA-256:

`b0f7c297fcd58c4e12a5666dcdfbd5624120178aaf1515080e219584d3947e60`

All **227 file entries** in the extracted tree matched the ZIP after the read-only checks. No game files were changed and no build scripts were run. Older work directories and unfinished earlier stages were not used as this design's baseline. Historical README/report status labels are not substitutes for the user's lock of v23.3.6.

This is an architectural audit for the requested extension, not a fresh certification of every Part 2 feature. References below use package-relative paths and named symbols so they survive extraction elsewhere. The large application bundle is minified; its symbols are more useful references than its very long source lines.

### 1.2 Existing boundaries to preserve

| Area | Inspected implementation | Consequence for 2.5D |
|---|---|---|
| Gameplay timing | `timing_policy.js`: 1/60 s, maximum 15 catch-up steps, 250 ms frame clamp. Bundle `Ou0` consumes fixed steps. `server.js` room loop also calls `sim.step(1/60)` in an accumulator. | Keep fixed gameplay ticks. The server's 25 ms wake interval and roughly 20 Hz broadcast are scheduling/transport, not a 40 Hz gameplay simulation. Its “simulate ~40 Hz” comment is stale. |
| Player locomotion | `move.js`: acceleration, stamina, exhausted recovery, posture, slide, vault, capture influence and axis-separated circle/rectangle collision. `world.js` `MOVE`: radius 15, walk 172, run 285, recovery threshold 36. | Keep the movement state machine and tuning. Route its displacement through support/clearance queries. Existing vault interpolation is XY-only, not an existing ballistic Z implementation. |
| World geometry | Level 0 map, `Bc`, `Uc`, `sl`, tile grid, lamps and legacy routing are embedded in `assets/index-DKbV5Nv9.js` and extracted in `dev/sim_head.js`. `world.js` shares props, modes and movement data. | There is no canonical layered world yet. Establish a single map-data source without redesigning Level 0 or rewriting unrelated bundle code. |
| Navigation | `dev/ai_src/10_geo.js`: 48-unit grid, clearance classes, 8-neighbor A*, no diagonal corner cutting, wall-distance costs, explicit vault links. `30_entity.js`: path smoothing, route commitment, direct-route hysteresis, steering and collision. | Preserve this algorithmic investment. Give every cell a surface identity and extend the existing links. XY-only `snap`, path keys and shortcuts are unsafe on stacked floors. |
| AI and evidence | `20_senses.js`, `22_intelligence.js`, `25_light.js`: visual snapshots, attributed records, anonymous leads, uncertain sound, bounded histories and per-entity RNG streams. `50_hound.js`, `60_smiler.js` retain species decisions. | Extend observation geometry and uncertainty, not intelligence or sensory powers. World truth remains confined to sensors, physical contact and explicit system boundaries. |
| Geometry adapter | `dev/sim_glue.js` supplies floor, clear, blockers, ray, lighting and blackout to `AI.create`. | This is the main migration seam. Replace planar query assumptions behind this boundary before editing individual species call sites. |
| Authority | `server.js`: authoritative entities, captures, deaths, lifecycle, items, admin actions; ordinary player XY is client simulated and reasonably validated. `mvCheck`, `sim.moveOk`, `gaitFloor` bound accepted movement/noise. | Do not silently label this fully server-authoritative player locomotion. Spatial support, free-fall and transition validity need server verification/ownership without replacing the whole player motor. |
| Deaths/corpses | `dphys.js`: body, two hand masses, attacker, light and hat, fixed 240 Hz substeps. `death_srv.js` loads the same simulator for disconnect fallback. `server.js` aftermath records; `sim_glue.js` bodies keyed by owner, capped at 24. | Extend this solver into Z. Do not create a second server death approximation or swap the final pose for a corpse sprite. Its existing hand property `h.z` is a **spring damping ratio**, not world elevation. |
| Replication | `mp.js` `netHist/netPose`: 100 ms entity interpolation, eight samples, up to 150 ms extrapolation; resets clock/history/slots on connection and inferred clock boundaries. Peers and effects have separate paths. | Add explicit world/pose continuity identities and spatial samples. Audit all replicated representations, not only Hound/Smiler positions. |
| Presentation | Pixi application bundle, procedural `ents.js`, Canvas overlays, `light.js`, `camcorder.js`, `gore.js`, `mp.js`. Client readability and AI light models are deliberately separate. | Keep the application renderer and art. Add a spatial world pass and local visibility/cutaway composition. Rendering may consume physical data but cannot change it. |
| Light and IR | Server AI sees visible light. Camcorder IR is replicated separately and does not reach monster AI. | Geometry becomes Z-aware for both channels; their sensory separation remains intact. |
| Generation/build | `ai.js` from `dev/ai_src/*`; `sim.js` from `dev/sim_head.js` + `dev/sim_glue.js`; `ents.js` from `dev/ents_src/*`. Build scripts use package-relative `dev/paths.js`. | Edit maintained sources, then regenerate outputs in future implementation. There is no justification for hand-maintaining divergent copies. |

Other planar assumptions needing explicit migration include `touching`, player/entity separation, spawn reachability, crawl-zone lookup, wall-behind death selection, sound attribution, lamp caches, habit cell keys, glitched-wall exits, pickups, dropped-light rays, and debug teleports. An unchanged function taking only `(x,y)` is not automatically spatially safe.

### 1.3 Read-only checks actually run

Environment: Node **v24.19.0**. These results are narrower than full application or browser QA.

| Check | Observed result | What it establishes |
|---|---|---|
| `node dev/tests/s_fps_equality.js` | PASS: real `move.js`; 600 ticks over 10 s at 30/60/120/144/240/360 FPS and jitter; 15 FPS catch-up also passed. | Current accumulator and headless movement equality for the tested schedules. |
| `node dev/tests/s_camera_fairness.js` | 12/12 PASS; canonical footprint 1627.119 × 915.254 world units. | The policy's calculations and static bundle wiring pass. It does not test HTTP delivery. |
| `node dev/tests/phys_test.js` | PASS, including 240 death scenarios and sampling independence. | Current planar shared death simulation passes its existing checks. It says nothing about Z, new geometry, or subjective brutality. |
| Real `node server.js` HTTP probe | `/` and `/move.js`: 200. `/camera_policy.js` and `/timing_policy.js`: **404**. | A concrete baseline delivery issue, described below. |
| ZIP/tree byte comparison | 227 files compared; zero mismatches. | This audit left the supplied build unchanged. |

**Baseline issue B-01 — policy scripts are not allowed by the static server.** `index.html` requests both policy scripts, but `server.js` `SERVE` omits them. The bundle's fallback keeps 1/60 s, 15-step/250 ms timing, so this does not establish a fixed-tick failure. Its camera fallback is the older `.85/1.18` scale rule, however, so the passing camera unit test does not establish hosted camera fairness. Record this as a pre-existing integration issue. A later implementation gate must test actual routes and browser execution; do not count the issue as introduced by 2.5D. No fix was made here.

The full AI/network suite and browser gameplay QA were not rerun. Historical reports retain known failures, including legacy chase percentage gates and SM01; freeze and reproduce their exact baseline outcomes before future comparison. Do not infer their current outcome merely from an old report or alter thresholds to obtain a green summary.

## 2. 2.5D data model

### 2.1 Minimal module responsibilities

| Proposed module | Responsibility | Deliberately outside it |
|---|---|---|
| `levels/level0.js` | Canonical immutable Level 0 layout/data, retaining legacy ordering and identifiers; exports the flat compatibility descriptor. Additional levels use the same schema. | AI decisions, client view state, network sessions. |
| `world_geometry.js` | Shared schema validation, immutable compiled geometry, spatial index, support/clearance/sweep/ray/contact queries, stable geometry identities. Node and browser compatible. | Species motives, locomotion tuning, camera cutaways. |
| `world_motion.js` | Shared grounded/support motion, continuous step transitions, gravity, swept collision, traversal execution and physical events. Called by existing motors and death physics. | Input binding, stamina policy, species decisions, render time, a second death plan. |
| `world_view.js` | Client projection, spatial draw packets, depth/visibility passes, local cutaway state, picking and masks. | Authority, navigation, sensor decisions or world mutation. |

The level-data module is data-only and does not import the runtime `WORLD` object. Move Level 0-specific prop placements into that canonical data along with the map; keep generic movement/material profiles in `world.js` and expose compatibility aliases where existing callers need them. This prevents a circular dependency or a second independently edited prop table. Compile a world instance with explicit data; spatial queries never select a level through global prop arrays.

Continue to own navigation in `dev/ai_src/10_geo.js`; it is not necessary to add a second pathfinding service. Keep movement profiles/materials in `world.js`, evidence in the existing AI sources and death plans in `dphys.js`. Small internal helpers are acceptable; new independent state owners are not.

### 2.2 Authoritative static records

All IDs are stable within a geometry revision. Persist references by IDs, not array positions or XY coordinates.

| Record | Required content and contract |
|---|---|
| `WorldDefinition` | Schema version, world asset ID, content revision/hash, `geometryMode`, units, bounds including Z, ordered solids, support patches, nav surfaces, traversal links, spaces/portals, materials, lights, spawn anchors and view groups. |
| `Solid` | ID; convex XY footprint; lower and upper affine height functions over that footprint; collision/material/channel flags. This represents a closed prism or wedge, including a finite-thickness slab. Decompose non-convex content into convex pieces at compile time. |
| `SupportPatch` | ID; bounded polygon/triangles; plane `z=ax+by+c`; upward normal; source solid face; material; permitted support/contact flags; nav-surface reference if traversable. Several patches may overlap in XY at different Z. |
| `NavSurface` | ID; connected walkable sheet/chart; patch IDs; local grid origin/resolution; bounds; stable cell IDs; clearance metadata and boundary links. It cannot encode two unrelated walkable heights at the same chart location. |
| `TraversalLink` | ID; directed source/destination surface and portal regions; kind; legal profiles/capabilities; entry/exit poses; geometric corridor/trajectory; duration/progress rule; swept clearance; costs; interruption/landing rules. |
| `Space` / `Portal` | Bounded connected air volume and actual opening between volumes. Supports sound propagation and view candidates. An acoustic opening is not automatically traversable; a nav link is not automatically transparent. |
| `Material` | Existing surface ID/friction/noise semantics plus physical contact and visible/IR/acoustic transmission flags. No unconditional sound-proofing inferred from a floor label. |
| `LightSource` | World position and orientation, visible or IR channel, existing intensity/range parameters, physical emission anchor; optional space/support reference for indexing. |
| `ViewGroup` | Static geometry fragments eligible for local roof/wall cutaway; enclosing space references and stable group ID. These are presentation metadata, not collision switches. |
| Spawn/exit/item anchor | Full pose, support/space reference and validated clearance. A stacked destination cannot be identified by XY alone. |

Openings are real absence of solid material. Build doorways, stairwells, windows and crawl entrances by splitting solids; a `portal` tag alone does not carve a hole. Tops and undersides belong to the same slab, avoiding a floor that supports weight but does not block a ray from below.

A compiled world contains a 2D spatial hash of **lists of 3D primitives**, patch adjacency, surface-local nav data, light candidates and static view meshes. This is a broad phase, not a single-valued height map. Rooms/“floors” remain human-readable labels only.

### 2.3 Dynamic spatial state

A live root body carries:

- World identity/generation, position `(x,y,z)`, velocity `(vx,vy,vz)`, yaw/angular velocity where already used.
- Collider profile ID and current physical height, posture and existing locomotion state.
- Motion mode: `grounded`, `step`, `traversal`, `airborne`, `captured`, `dead-active`, or `sleeping`.
- Current support patch, nav surface and space when known; null support while unsupported. A last-known support may be retained separately for diagnostics, never used as current support.
- Contact normal, traversal link/progress if active, authoritative pose sequence, and previous physical pose for sweeps/interpolation.

Keep body pose distinct from AI belief and render pose. A hand or detached object has its own **world center**, velocity, shape, support and sleep state; an attached item additionally has a parent/anchor constraint. An entity generation, life generation, death ID and world epoch solve different lifecycle problems and must not be collapsed into one reused numeric entity ID.

### 2.4 Compilation and query contracts

The compiler rejects duplicate IDs, nonfinite coordinates, inverted solids, zero-area patches, unsupported spawns, invalid link endpoints, impossible clearances and inconsistent references. Shared seams use canonical vertices. Surface overlaps are allowed; intersecting solids are resolved/decomposed consistently rather than relying on insertion order.

Required pure query contracts:

| Query | Inputs | Output / guarantee |
|---|---|---|
| `supports` | Footprint, vertical search interval, previous support, allowed contact direction | Ordered candidate contact patches/heights/normals. Never “highest floor at XY” without an interval. |
| `clearance` | Complete collider pose/shape and channel/profile | Fit plus restricting surfaces; includes floor, ceiling and sloped extrema over the footprint. |
| `sweep` | Shape, start pose, displacement/trajectory segment, collision mask | Earliest time of impact, point, normal and primitive ID; checks the entire swept volume. |
| `raycast` | Two world points, physical channel | Nearest intersected face/material/distance; horizontal, vertical and oblique rays use the same geometry. |
| `contact` | Two physical proxies plus intervening geometry | Overlap/reachable contact result. A floor separating the proxies rejects contact. |
| `traceSupportMotion` | Start support/pose, XY route, profile and elapsed ticks | Legal surface sequence, Z trajectory, transitions, earliest unsupported point or obstruction. No pathfinding around an unreported obstacle. |

Queries have explicit arguments; new spatial code must not depend on mutable global `WORLD.mode`. Keep the old mode wrapper only for flat compatibility until its callers migrate. Canonical candidate ordering is `(time of impact, primitive ID)` with documented tolerance ties. No query draws random numbers.

## 3. Coordinate and elevation semantics

1. Retain X right, Y down, yaw in the current XY plane. **Z is positive upward.** Units are existing world units (“pixels” in current tuning), not screen pixels and not an asserted real-world meter scale.
2. The root body's `z` is the lowest point of its physical root collider. Its center of mass, eyes, light emitter and visible art anchor have separately named offsets. `Point3` always denotes a world point; hand/item `center.z` is explicitly a center, not root-base Z.
3. A support plane's sampled height and the root-base height need not be identical on a slope: the collider must fit over its entire footprint. For an upright cylinder above an unbounded plane, the required base is `ax+by+c+r*sqrt(a²+b²)`. At an edge use the actual bounded overlap/contact, not that unbounded shortcut. The visual shadow uses the actual support hit point.
4. Posture selects a physical height; the current normalized `WORLD.PROFILE` remains an existing perception/attack-profile input. Do not silently convert `.62` into `.62` world units or replace existing lunge logic with an arbitrary height test.
5. A floor/surface ID has no implied numerical Z. Two different IDs may meet at the same height; one ramp surface spans many heights. Support and nav-surface identity are not interchangeable.
6. Negative Z is valid. World bounds are explicit. Precision tolerances are in world units and independent of zoom, resolution and DPR.
7. Angles used for gameplay remain world yaw. View skew, camera tracking, squash, head animation and death-camera shake never change physical coordinates.
8. Elevation is continuous during movement. A discrete support-ID change at a seam is allowed; a corresponding position jump is not.

**Initial spatial fixture profile, not new canon or a Level 0 rebalance:** use standing player height 60, crouch 38, crawl 24, slide 25, down/corpse thickness 18, and keep live radius 15/death radius 18. Use Hound fit height 36 (crawl 24) and Smiler fit height 48 with existing collision/clearance radii and capabilities. These are collision envelopes for an abstract game, not drawn anatomy. Define eye/emission anchors within those envelopes; start player eye at 50/31/18 for stand/crouch/crawl, Hound at 28/18, Smiler at 36. Version these provisional values in one spatial profile table; validate new content against them. They do not affect `flat-compat` tuning.

For the deterministic spatial fixture use gravity 980 units/s², maximum voluntary slope 35°, and maximum automatic step rise 12 units, and assisted-step vertical-speed cap 180 units/s. These explicit defaults make the architecture testable; later content/gameplay tuning is a separate documented decision. A steep physical surface still exists and can cause sliding/falling even when nav marks it non-traversable. Do not grant climbing, flight, free jumping, or Smiler levitation by adding Z.

## 4. Collision, support and motion model

### 4.1 Shapes and geometry

Living movers keep lightweight upright collision envelopes: circular XY footprint plus a real vertical interval. This permits crouch/crawl heights smaller than the footprint diameter; do not use a capsule formula that requires height at least twice the radius. Existing species clearance and separation radii remain distinct from this physical fit radius.

Corpses use the existing primary body mass with a shallow finite-volume proxy; hands and small loose objects use sphere or small convex proxies with nonzero thickness. Yaw/secondary rotation and a contact-normal tilt can be retained without adding limbs or a humanoid skeleton. All proxies collide in XYZ, including ceilings, slab undersides and ledge edges.

Broad phase queries the swept XY bounds and Z interval in the shared hash. Narrow phase resolves cylinder/convex-prism and sphere/face/edge contacts against the actual planes. Use analytic primitive sweeps or conservative advancement with a bounded error; **endpoint overlap tests and fixed-distance XY samples alone are insufficient** for fast falls and thin slabs. Plane crossing must include finite polygon edges and corners.

Proposed numerical policy: contact skin 0.05 units; static penetration acceptance at most 0.1 units; TOI tie tolerance 1e-7 of a segment; deterministic maximum eight contact-resolution iterations per motion segment. If unresolved, retain the last nonpenetrating pose, remove velocity into the unresolved constraints and record a diagnostic. Never escape an iteration limit by moving through geometry. Validate authored seams so these tolerances are not used to bridge real gaps.

### 4.2 Fixed-tick order

At every authoritative 1/60 s step:

1. Consume queued network/admin/lifecycle actions at the tick boundary; reject stale epochs/generations.
2. Preserve the established player/AI observation ordering. Feed only accepted player state to the existing evidence/sense/decision schedule.
3. Existing player/species motors produce intended XY motion or traversal/capture forces. Resolve spatial motion and support; evaluate attack contact against the resulting valid proxies. Retain the baseline ordering of decisions versus movement on flat worlds.
4. Advance active deaths and loose equipment using **four 1/240 s substeps per gameplay tick**, including gravity and contacts. Commit final corpse state from this very simulation.
5. Record authoritative events and changed state; snapshots are emitted at their separate existing cadence. Renderers interpolate completed states only.

New collision substeps do not multiply decision, stamina, sound, RNG, attack or watchdog ticks. Timestamp an event by simulation tick/substep and deduplicate it, so four substeps cannot emit four land sounds for one landing. Physics continues while a live room has airborne/settling objects even if every player is dead; the current “no living players” early return must not freeze a falling corpse. Room deletion when nobody remains can retain the existing room lifecycle policy.

Preserve 15-step/250 ms bounded catch-up. A longer suspension requires reconciliation/reconnection handling, not one giant physics step or a claim of perfect wall-clock equality under arbitrary stalls.

### 4.3 Grounded motion, ramps and support selection

Resolve XY intent and vertical support together. Follow the current support or a **geometrically adjacent** support reachable within the swept path. Reject a higher overlapping floor that has no valid transition. Keep prior support in tolerance ties; otherwise choose earliest physical contact, then stable ID. Hysteresis can stabilize contact classification, never allow a body to span empty space as if it were ground.

For a ramp, solve the pose against its plane over the moving footprint continuously. Project grounded velocity onto the contact tangent and apply the material friction there. Preserve existing XY acceleration/speed semantics on flat ground; in spatial mode the existing requested speed is tangential path speed, so a slope's longer physical distance is not traversed for free. Derive XY and Z components from that velocity. Footstep distance is ground-path distance, not projection displacement.

At a boundary distinguish: continuous seam, legal short step, drop, or blocking rise. Stepping off support becomes airborne at the swept edge-crossing time. Do not glue a descending body to any floor found within a large snap radius. Passive bodies apply gravity's tangent component on slopes and static/kinetic friction, not unconditional XY drag while airborne.

### 4.4 Actual stairs and continuous step-up

Stairs have real tread support patches and riser solids. A stair-run nav link describes the route and profile limits; it does not teleport between landings. Do not replace all stair physics with floor-number changes or a decorative staircase over empty space.

For a legal small riser, the mover initiates a swept **raise → forward → settle** step trajectory. Rise is limited by profile, overhead clearance is checked over the complete collider, and vertical motion takes finite simulation time. Use a smooth finite-duration lift (initial fixture duration 0.10 s, extended if needed to satisfy the profile's vertical-speed cap); the body does not appear on the next tread instantly. The forward segment remains constrained by the existing motor's available travel/time. Success ends on the next tread; interruption resolves contact and resumes grounded or airborne motion from the current pose. Sideways departure can fall off the stairs.

A stair link may supply a continuous contact trajectory across successive treads for route following, but every riser, tread and ceiling remains collision geometry. Loose hats, lights and corpses collide with individual steps; they do not use the living actor's assisted step-up rule. Fixture assertions must distinguish these cases.

### 4.5 Airborne motion, landing and clearances

While unsupported, integrate gravity at fixed steps, carry inherited momentum and sweep all movement. Resolve lateral, underside and floor impacts by TOI; consume the remaining step time after contact. A landing requires the shape to approach a supporting face from above and cross its contact boundary. It cannot select an upper surface while falling underneath it.

Ordinary actors do not acquire a jump action. Drops, permitted vault arcs, external impulses and death motion can make them airborne. A nav-declared drop helps an AI decide to take a route; gravity applies whether or not a drop link exists. Voluntary drop limits are profile/content data and default to no new AI drop links until a fixture validates them; accidental loss of support still falls. A link is never created merely because a lower landing exists. Publish landing normal, impact speed/impulse, support and material as authoritative events. Damage, if later desired, plugs into that event and the existing lifecycle; this specification does not invent an HP system or fall-damage balance.

Ceiling/overhang clearance tests the entire horizontal footprint and current/full requested height. A failed stand-up leaves the player crouched/crawling. Changing posture cannot move the root through a ceiling. Crawlspaces are volumes with physical floor/roof/sides, not XY trigger regions that ignore which floor contains them.

Vaults retain their existing entry, speed/stamina costs and species eligibility. Add a continuous Z trajectory whose swept envelope clears the obstacle and whose landing has actual support. Invalid new geometry makes that attempted vault unavailable; it must not bypass all collision while a timer runs. Sliding likewise keeps the existing motor while using slide height and real support/friction.

### 4.6 Interactions and failure policy

Touch, capture, entity separation, pickup, exit, feeding location, dropped-light interaction and wall-impact variants require compatible XYZ proxies and an unobstructed physical contact path. Capture/drag constraints apply world-space forces with bounded reach; geometry can prevent their requested motion. They may not kinematically pull a victim through a floor/wall to preserve an authored pose. The existing release/kill decision remains with the species; physical obstruction is returned as a contact result, not permission for a new attack rule. “Same surface ID” alone is too strict at a ramp seam; “same XY distance” alone permits attacks through floors. Use geometry, with surface identity as a broad-phase aid.

World content defines a finite lower bound/void region. Crossing it produces an explicit server world-boundary event and lifecycle disposition; no silent snap to Z=0. A support deletion/revision invalidates dependent contacts and wakes objects; it never relocates them to the nearest floor. Moving platforms, destructible worlds and fluids are not requested implementation features; versioned support references keep them possible without pretending to implement them now.

## 5. Navigation surfaces and traversal links

### 5.1 Extend the current graph

Keep the 48-unit cell size for existing Level 0 navigation, A* implementation, clearance preferences, capability classes, no-corner-cutting rule, route commitment and steering. A spatial graph node becomes **`(navSurfaceId, localCellId)`**, with references to its physical support patches. Allocate cells only over occupied sheets/chunks; do not allocate the whole map for every possible Z value.

A nav surface is a connected sheet on which local route following can resolve an unambiguous support trajectory. It may contain triangulated/sloped patches. Two rooms directly above one another are separate surfaces even when every XY coordinate matches. A stair run can have its own chart with tread references and explicit connections to its landings. Triangulation seams are not thousands of artificial gameplay traversal actions.

Flatten the composite node IDs into the current typed-array A* workspace at compile time. Keep one search across local neighbor edges and traversal edges; no hierarchical planner is required for the first implementation. Add a surface-level reachability cache only if profiling demonstrates a need.

### 5.2 Link types and rules

| Link | Physical meaning | Direction / failure behavior |
|---|---|---|
| Walk seam | Adjacent sheets with continuous, body-clear support. | Bidirectional only when both sweeps fit. |
| Ramp | Connected slope corridor with real support throughout. | Profile slope/clearance limits apply in each direction. |
| Stairs / assisted step | Sequence of treads/risers with continuous step motion. | Evaluate uphill step limit, downhill behavior and headroom separately. |
| Drop | Departure edge and a predicted reachable landing region. | Normally one-way. Reverse requires a separate valid link; pathfinding cannot invent a jump. |
| Crawl / low passage | A real volume requiring a legal low profile. | No link for species lacking the existing capability. Exit must provide safe posture/space. |
| Vault | Existing prop crossing plus a tested XYZ trajectory/landing. | Preserve species eligibility and speed multipliers; collision can interrupt it. |

Every link has an entry portal wide enough for the actor, not just two coordinate points. Generate walk seams from shared geometry; author/test special traversal corridors explicitly. A query discovers geometry/capability, not a new species behavior.

Local edges store physical path length, clearance/posture requirements and material/light cost inputs. Keep legacy Level 0 cost calculations exactly in flat mode. In spatial mode use existing cost units plus actual traversal distance/duration and existing species modifiers. A* must use an admissible heuristic: the existing XY octile lower bound remains valid only if every edge costs at least its XY lower-bound distance; otherwise use a conservative scaled bound or zero. Never add Z to the heuristic while leaving cheap link costs that invalidate it.

### 5.3 Route-following contracts

- `snap` receives a full pose/support or a bounded candidate set. It cannot return an unreachable upper floor simply because that cell is nearest in XY.
- Goal/path-cache identity includes world geometry revision, start/goal surfaces, relevant clearance/capability profile and topology revision. The current rounded XY `goalKey` is insufficient.
- Waypoints carry surface/patch references and Z/trajectory semantics. Endpoints are validated; appending raw goal XY after A* cannot bypass a slab or headroom check.
- Smoothing/direct pursuit may remove waypoints only if `traceSupportMotion` proves a continuous supported route with the required clearance. It cannot smooth over a drop, change floors, skip a stair/vault/crawl transition or substitute sight LOS for walking clearance.
- Existing route commitment/hysteresis remains. A target moving slightly on the same sheet does not trigger a new route; an observed change to another sheet invalidates the route even with unchanged XY.
- A traversal executes through `world_motion.js`, with progress and physical state retained if interrupted. It never writes a destination pose directly when its timer ends.
- A lost target's reachable hypotheses originate from remembered/evidenced surfaces. The pathfinder may know static connectivity; it may not ask the real player which floor they chose.
- Far/coarse AI may retain cheaper planning and thinking, but cannot step across gaps, teleport between surfaces, or skip gravity. Airborne/active-traversal/capture/death motion is always fixed-tick. An idle grounded far entity may sleep until an existing wake condition or support change.
- Genuine stuck recovery still works. Use attempted motion and progress along the current route/traversal (including Z), not only distance from an old XY point. Deliberate Hound listening remains exempt; preserve existing Smiler watchdog semantics.

A physical layer change alone must not reset a species state, target, memory or RNG stream. The graph answers “can this body get there?”; the existing brain still decides whether and why it should go.

## 6. Entity and perception integration

### 6.1 Observation boundary

Extend legitimate observations with spatial information; never attach the target's true support ID as convenient metadata after sight is lost.

| Observation | Spatial content permitted |
|---|---|
| Direct sight | Visible world position/velocity, observed posture and an observed support candidate when visible or geometrically inferable from that observation. Keep an explicit unknown support when only part of a body is visible through an opening. |
| Attributed memory | Last observed XYZ, observed support/candidate set, last observed velocity and timestamps; predicted position constrained by remembered geometry. |
| Anonymous sound | Estimated point/region, vertical interval or candidate spaces/surfaces, confidence and uncertainty. The server event's real source ID/height does not automatically become belief. |
| Visible light lead | Position of the observed illuminated surface/beam/source, channel, uncertainty and current attribution rules. Seeing light below a stairwell does not prove the owner's exact landing or identity. |
| Physical contact | Actual contact point/proxies supplied through the explicit physics boundary. Do not turn proximity/contact infrastructure into a continuous hidden-player tracker. |

Extend `noteEv`, anonymous merging, estimates, history/habit keys and learned hypotheses. Store `zMin/zMax` uncertainty where elevation is uncertain and cap each observation's support candidate list at four; overflow becomes “unresolved vertical region,” not silently “nearest floor.” Retain existing total bounds: 16 identity records, eight sounds, six leads, four evidence entries per record, six habit observations, three hypotheses, and current TTLs. Surface identity is part of a habit cell only when supported by the observation.

Do not merge two leads from different sealed stories just because their XY uncertainty circles overlap. Conversely, do not turn uncertain hearing into perfect floor classification by retaining the source's hidden `supportId`. Vertical uncertainty reduces certainty or produces bounded alternate route hypotheses; it does not increase the number of unbounded records.

### 6.2 Sight, light and gaze

Use range measured between world root positions for existing body-range thresholds, making the flat Z=0 case exactly the old XY metric. Trace sight from an explicit eye point to a bounded set of target visibility samples (head/body/low profile); require a physical clear segment. Use the established visibility weighting and species thresholds. Nearby awareness floors do not bypass solid geometry.

Retain the existing yaw/FOV behavior on flat worlds. Spatial actors have an aim/look direction in XYZ derived from legitimate gaze/aim inputs or sensed observations. Vertical gaze is constrained by the same physical visibility requirement; a screen-space alignment through a ceiling cannot cause eye contact. Keep the existing species eye-contact timers, intimidation/hold priorities, panic rules and release behavior. New pitch geometry is an extension of where a gaze can reach, not an automatic new counterplay bonus or range change.

AI visible-light queries and client light shading share source positions, physical occluders and channel rules, **not a render brightness value**. Sample actual XYZ receivers so upper floors do not inherit lower lamps from an XY cell cache. World light failures/blackouts remain authoritative. Cache keys include surface/height or actual receiver region, channel and geometry/light revision.

IR is still absent from Hound and Smiler evidence. NV affects only the local client's existing sensor presentation. Neither NV, an entity's gleaming eyes, nor an admin debug overlay bypasses slabs or LOS.

### 6.3 Sound and group behavior

Retain existing gait/noise production and species hearing sensitivities. Footsteps originate at the actual support contact/material; landings and loose-object impacts occur at their real elevations. The server's observed-speed noise floor must account for physical travel and valid posture, preventing a fast mover from claiming quiet standing/crawling. Presentation audio and AI sound events consume the same event identity without sharing arbitrary audio-render randomness.

For spatial maps, find a bounded propagation route through connected air spaces/open portals; accumulate path distance and material transmission/occlusion. A directly occluded ray is not proof that sound cannot travel around a stairwell. Sound transmission through a slab, if authored, is attenuated and vertically uncertain. The propagation query may use true source geometry internally, as a sensor must, but the resulting observation exposes an audible bearing/region (often the receiving opening), not the route's hidden source-floor identity. Start with one best route plus deterministic ties; no wave simulation or universal “sound travels through everything above it” rule. The flat adapter retains the current distance/LOS attenuation exactly.

Hound pack information and Smiler group coordination retain their existing rules. Make distance/contact/route feasibility spatial where needed; do not create shared omniscient floor knowledge. Inject identical observations into old/new flat adapters to verify identical decisions, target commitment, search budgets, failed-hypothesis timing and RNG streams. Preserve v23.3.6's search/head-look polish.

Smilers must physically traverse valid routes. Darkness, fade, cutaway, hidden presentation or lost LOS is never permission to teleport, pass through ceilings or grow a visible body. Hound crawling remains capability-gated; neither species gains tight-gap access or new senses.

## 7. Networking and authority changes

### 7.1 Protocol and identities

Keep WebSocket transport and current snapshot cadence. Add a versioned spatial envelope; do not infer a world boundary solely from clock jumps once explicit identities are available.

| Message/state | Required additions |
|---|---|
| Hello/world manifest | Protocol capabilities, world epoch, geometry/schema revision/hash, motion-profile revision, current integer simulation tick; stable ID table for compact geometry references. |
| Pose snapshot | World epoch, entity ID + generation, pose sequence/tick, XYZ, XYZ velocity, yaw; physical height/profile, support/nav-surface reference, grounded/airborne/traversal flags and link/progress where applicable. |
| Player proposal | Life generation, input/report sequence, acknowledged correction, ordered fixed-tick movement samples or a validated compact segment, requested posture/traversal/aim. XYZ prediction is a claim, never authority. |
| Correction / teleport | Explicit discontinuity ID, complete pose/velocity/support, life/world generation and cause. Only authenticated server actions may grant teleport semantics. |
| Sound/light/interaction | XYZ origin/target, relevant surface/primitive ID, event tick/ID and channel. AI attribution remains separate from source metadata. |
| Capture/death | Capture/death ID, tick, victim and attacker initial XYZ/velocities/supports, chosen plan/seed/version, real wall/contact geometry and equipment state. |
| Corpse/item | Per-object spatial state, support, awake/sleeping flag and revision; initial snapshot for late joiners and updates while active. |

Serialize finite bounded numbers only. Suggested wire position quantum is 1/16 world unit for spatial poses; retain full precision during physics and deterministic tests. Quantization cannot move a body through a thin surface: include support/contact state and reconstruct against it. Geometry hash mismatch blocks spatial world entry with a clear incompatibility response, rather than running two different worlds.

### 7.2 Preserve the hybrid player boundary

**Keep client prediction and existing player stamina/motor ownership. Keep reasonable validation of ordinary XY. Make spatial support/transitions/free motion server-validated and server-owned where time must progress without the client.** This is a necessary extension of authority, not a replacement with a full input-authoritative player motor.

For spatial worlds:

1. Socket handlers queue proposals; accepted physical state changes at fixed-tick boundaries. Preserve the existing server-time distance budget, slack-as-debt, capture/dead restrictions and authorized-teleport reset semantics.
2. A grounded proposal includes an ordered path over its elapsed fixed ticks. Represent a trace sample as report tick, proposed XY, posture and traversal intent; the server derives Z/support, and no sample mints extra elapsed-time credit. Validate finite data, sequence, elapsed server-time credit, swept collider fit, material/posture constraints and the complete support sequence. Derive Z from geometry. Endpoint Z and a claimed surface ID cannot select a floor. Straight motion can use a compact segment; packet-bunched turns must provide intermediate samples rather than ask A* to prove that some different route exists.
3. Maintain a bounded validation history, no more than the existing 1.5 s burst allowance (90 ticks), with a maximum of 15 validation substeps per room wake and bounded per-client queues. Credit is earned by server ticks, cannot be reused, and cannot be manufactured by client timestamps. Larger backlogs reconcile instead of consuming unbounded CPU. Flat compatibility retains the current validator until separately migrated.
4. Entering unsupported motion, a timed assisted step/vault, or capture transfers that physical trajectory to the server's fixed-tick spatial motion state. The client predicts the same primitive and requests bounded steering; it does not submit absolute airborne Z or traversal completion. Server gravity, ceilings and contact continue if packets stop.
5. Delayed grounded validation may reconstruct a candidate motion path in its bounded history. It must not rerun AI or overwrite committed captures, deaths, teleports or support-mode transitions. On crossing a transition already owned by the server, reconcile to that transition's tick/state; do not advance it twice with the remaining client samples. Epoch/life/correction acknowledgements isolate the new trajectory from stale reports.
6. The server checks geometry/capabilities for traverse requests, calculates initial Z/velocity, and returns the accepted start tick/link. Rendering/prediction may smooth small correction error within clear space, but collisions, attacks and pickups use the authoritative pose immediately. A smoothing path must not cross a slab or wall.

This design retains a distinction between validating a reported player motor and simulating server entities. It does **not** claim exact equivalence under arbitrary packet stalls. Legitimate walk/sprint/crouch/crawl/slide/vault/stairs/drop tests with latency must prove bounded reconciliation without false lifecycle transitions or persistent movement rejection. If this hybrid contract cannot meet that gate, document the failing case before expanding authority; do not quietly ship an uncontrolled Z field or an unrelated full movement rewrite.

Admin teleport/debug tools take a complete destination pose or a user-selected surface. Server validates permission and physical destination; an explicit debug override is visibly distinguished from ordinary movement. Teleport resets XYZ history, traversal, support, motion budget and appropriate presentation interpolation together. The existing one-use revive, respawn, captured/new-run restrictions and protection semantics remain unchanged.

### 7.3 Interpolation and lifecycle

Use a common spatial pose sampler for entities, peers, active corpses and equipment, while retaining species animation adapters. Histories are keyed by `(worldEpoch, entityId, generation)`; death objects additionally use death/object identity. Reconnect, new world, respawn or authorized teleport clears the affected history, offset and slot associations. Ordinary jitter never creates a new epoch.

Keep the current 100 ms entity presentation delay and bounded extrapolation as initial values. Add samples for important transition boundaries (edge departure, landing, link start/end) so interpolation knows the continuous path between snapshots:

- On a supported segment, interpolate path position and reconstruct the corresponding support height/shape fit.
- On a traversal, sample its agreed continuous trajectory/progress.
- In free flight, use the sampled XYZ trajectory/velocities; split at landing/contact events instead of fitting one curve through a slab.
- Never linearly blend two unrelated stacked supports. A missing transition or explicit discontinuity holds the old valid pose until the next valid sample, then snaps/corrects; it does not invent a path through a floor.
- Extrapolation is bounded by both time and known collision/support. At a ledge without an authoritative departure, stop extrapolating rather than fabricate a fall or hover beyond support.

Clients cannot change world state by changing cutaway, camera size, render FPS, quality, NV or spectator view. Existing broad entity replication is not an anti-cheat confidentiality guarantee; this architecture does not claim to hide truth from a modified client. Normal clients must still enforce local visibility in every presentation layer.

## 8. Corpse and equipment implications

### 8.1 Extend the shared simulator

Preserve `dphys.js`'s authored death variants, deterministic seed/plan, resistance and impact sequencing, independent hand reaction, equipment release, friction, recoil and sleeping. Add physical Z, vertical velocity and shape/contact state to each mass. Rename the existing hand damping variable explicitly before introducing world Z; accidentally interpreting `.55` as elevation would corrupt the solver.

Body translation/yaw plus independent hand anchors remain the visual language. A world-space 3D spring can pull toward an anchor or brace on a real surface, but must respect its reach, collision and unilateral contact. Bracing can occur only on a reachable physical floor/wall; a hand cannot brace on empty space or a floor 200 units below. Ground friction applies only with supporting contact. A falling body, hand, light or hat cannot sleep merely because its XY speed is small.

The primary mass is supported only while its center of mass/contact arrangement is stable. Use bounded contact points/support polygon and contact-normal response for ledge tipping/sliding; do not keep a corpse balanced forever on a negligible overlap because its XY radius still intersects the ledge. The two hand anchors remain constrained and do not become detached orbiting circles. No visible arms, legs, shoulders, elbows, knees or full ragdoll skeleton.

Detached light/hat inherit attachment-point XYZ velocity, including body/angular motion and authored release impulse. They can land on different elevations from the body. A backpack stays attached unless an existing or separately authorized plan detaches it; do not invent extra dismemberment/equipment rules. Blood/decal records identify a hit face/support and local surface coordinates; a decal must not be stamped on every floor below the same XY point. Trails break at loss of ground contact and resume on actual contact.

### 8.2 One authoritative aftermath

The flat baseline can retain its current client-result/server-fallback contract. **Spatial deaths require one server-owned active physical aftermath**, because a corpse falling across surfaces cannot depend on the victim remaining connected or report an arbitrary final support.

At the authoritative kill, freeze the canonical plan/version/seed and initial victim/attacker/equipment XYZ state. `death_srv.js` and clients call the same `dphys.js` spatial kernel with the same immutable geometry revision. The server advances it at four substeps per gameplay tick. Clients predict/replay for presentation; client completion reports are acknowledgements/checksums, not permission to replace authoritative spatial state.

Use `(worldEpoch, victimId, lifeGeneration, deathSequence)` as the event identity. Maintain the current owner-to-latest-corpse policy and cap/TTL unless separately changed: a new death may replace that owner's prior corpse, but reconnecting or delayed replay cannot create a second corpse. If a death's attacker is temporarily controlled by the death plan, the AI motor relinquishes physical ownership for that interval; there are never two systems integrating it simultaneously. After commitment it resumes from the actual final pose/support, not a planar `killerEnd` guess.

Victim disconnect → observers still receive the canonical death event → active aftermath continues → exactly one corpse record is updated → late joiners receive its current or settled state and every important equipment object's state. A late join during motion gets a bounded current snapshot plus plan/progress, not an instruction to synchronously replay an arbitrarily long fall from time zero.

The authored death sequence ending does not force physics to sleep. It changes the control phase; bodies continue falling/sliding/settling as needed. The final animation configuration **is** the persistent corpse configuration, including world Z, yaw/tilt, hand centers/offsets, released gear, hat, beam direction and support. If support later disappears, wake that same object. Death identity and final-state revisions prevent fallback/client duplication.

## 9. Rendering, vertical occlusion and local cutaway

### 9.1 Projection and retained art

Keep Pixi, procedural actors, existing UI, customization and audio. `world_view.js` adds a world draw pass and projection adapter; it does not replace the application engine.

Use an orthographic oblique projection for spatial maps:

- Screen horizontal coordinate: `scale * (x - cameraX)`.
- Screen vertical coordinate: `scale * ((y - cameraY) - elevationScale * (z - cameraZ))`.
- Initial spatial `elevationScale`: 0.5; flat compatibility uses 0.

Projection choice is presentation-only. The physical world has no flattened Z axis when `elevationScale` is 0. Existing character art can be drawn to local textures/meshes and placed at its spatial anchor; finite-volume proxies remain independent of its simple silhouette. Support shadows project onto the actual receiving surface. Detached items and corpse parts use their own anchors.

For camera depth, the projection's viewing direction is proportional to `(0, elevationScale, 1)`. Use consistent depth along that direction, not global sprite Y sorting or `floorIndex * hugeNumber`. Overhangs and intersecting projected ramps require actual face depth.

### 9.2 Two independent visibility questions

1. **Physical visibility:** what world surfaces/parts could the player's eye/sensor see through actual geometry?
2. **Camera obstruction:** which otherwise visible world geometry blocks the top-down camera's view of that local space/player?

Cutaway changes the answer to the second question only. Removing a roof from the camera pass cannot make an enemy above that roof visible through the physical visibility mask. Conversely a visible lower landing through a stairwell can be drawn even though it has a different support ID.

### 9.3 Concrete render pipeline

1. Interpolate immutable world/actor render poses from completed simulation snapshots. Determine the local eye point, current occupied space, sensor channel and canonical XY view footprint.
2. Query potentially visible spatial chunks/portal-connected spaces. This is a conservative broad phase, never the final LOS answer.
3. Build/update a local-eye depth visibility field from **all relevant physical occluders**, including roofs/walls that will be cut away in the camera pass. A small depth-cubemap pass (initial target 512×512 per face) provides arbitrary horizontal/vertical/oblique visibility. Cache only while the eye and relevant geometry are unchanged; budget quality, not physical reach. Use conservative edge masks/bias to avoid revealing geometry behind thin boundaries.
4. Resolve local cutaway groups/fragments from the camera-to-focus volume and occupied space. Fade/remove only eligible camera-obstructing faces. Preserve their full physical geometry in collision, light and local-eye depth passes.
5. Render static face meshes and existing actor/item draw packets through an orthographic **depth-tested** world pass with world positions. Test receiver fragments against the local-eye visibility field and light-channel visibility. Use the correct support/face for shading and decals.
6. Composite existing lighting/NV styling, dark/black out-of-sight mask, captured-player effects and UI. Every world effect—including remote death replays, eyes, gear beams, particles and decals—must respect the applicable spatial visibility/depth mask. No Canvas overlay may paint a hidden upstairs entity over the final mask.

Keep the existing flat renderer as the compatibility fast path. The spatial depth pass is the one necessary rendering extension: a single per-sprite sort or one XY visibility polygon cannot correctly handle arbitrary stacked geometry. Reuse the existing renderer's render targets/mesh facilities; a feasibility prototype is an early implementation gate before broad rendering integration. Do not promise an unverified particular Pixi API call in advance.

Static meshes carry actual face XYZ; actor draw packets carry world-space geometry/proxy depth so they are correctly clipped when partially behind walls or between slabs. Alpha-tested silhouettes write depth only where appropriate; transparent effects composite after opaque depth and remain visibility-clipped. Resolve self-occlusion with bounded local bias, not an “always on top” player/monster exception. Entity-specific Smiler concealment is applied after physical visibility and must not leak its unconfirmed body.

### 9.4 Cutaway state machine and input

Cutaway state belongs to one client/view: `{worldEpoch, focusSpace, group states, fade progress}`. Use deterministic local candidate ordering and modest presentation hysteresis (initial 0.15 s enter / 0.25 s restore fades) to avoid flicker at seams. Physical LOS takes effect immediately; a cosmetic fade must not temporarily reveal an occluded actor. Do not wait until an entire flight of stairs completes to choose a view: the focus volume follows continuous Z through the stairwell. Two observers on different floors can have different cutaways for the same world snapshot.

Keep the camera-policy maximum world footprint (1627.119 × 915.254 at the reference view) as an XY awareness cap. Projection can move elevated geometry into the viewport; it must still be culled against that canonical world footprint/LOS. Resolution/DPR and ultrawide displays cannot expand physical sight or aim. Camera Z smoothing never changes player Z.

Picking inverts the projection **with a depth/surface selection**, because screen XY alone is ambiguous. Intersect the camera ray with visible candidate faces/actor proxies, then choose the nearest physically visible hit. If no hit exists, intersect a defined aim plane through the player's eye, not an arbitrary upper floor. Convert that point to world yaw/pitch for aim/light direction; consume the resulting input at fixed ticks. Never auto-select a hidden entity or use a screen-space distance as interaction range. The flat adapter retains existing aim behavior.

Light sources have 3D position/direction and finite range. World geometry occludes visible and IR channels; lanterns can illuminate through real stairwell openings, not through slabs. Reuse the same occluder meshes for light depth passes, with per-source cached/budgeted presentation shadows. Server sensor rays remain CPU/shared-geometry queries and are not driven by a GPU visibility result.

## 10. Backward compatibility strategy

**Compatibility is an explicit world-format mode, not a guessed default.**

| Case | Required behavior |
|---|---|
| Locked Level 0 | `geometryMode: flat-compat`; root Z=0, no new gravity/height balance; original planar movement, collision, nav costs, light/perception and death traces retained behind adapters. |
| Level 0 data extraction | Preserve tile/prop/lamp ordering, carving, room/material identities, RNG consumption and generated graph. Compare exports and deterministic traces to the locked package before further changes. |
| New spatial map | Requires explicit finite solids/supports/profiles and spatial protocol. No missing Z/surface fallback to Level 0. |
| Old flat packet/body | Decode Z=0 only in a negotiated flat world; adapt old hand damping/pose fields by their actual semantics. |
| Old client entering spatial world | Reject with an explicit protocol/content mismatch; never silently flatten it into a playable but incorrect world. |
| New client entering flat world | Use the legacy-compatible codecs/adapters and current visual scale/aim policy; new identities may wrap old state without changing behavior. |
| Save/replay | Store schema, geometry and death-plan versions. Load through explicit migrations, not inference from an absent field. |

The shared facade can dispatch to preserved planar fast paths for Level 0; this is reuse of working systems. It is not permission to keep independent, drifting definitions of map geometry or two competing death solvers. New spatial levels and a future explicit Level 0 conversion share the same canonical geometry data. Converting Level 0 to physical ceilings/finite prop heights is a separate content migration with its own behavior approval; it is not smuggled into infrastructure work.

No product feature should depend on render-only state to detect flat versus spatial physics. Missing support references in a spatial world fail validation; they do not fall back to the nearest XY tile.

## 11. Staged implementation plan

These are future architecture stages, **not authorizations to implement in this task** and not a resumption of an older unfinished stage. Each stage ends with a runnable, package-relative build, explicit changed-file list and objective gate results. Keep the supplied ZIP as the immutable comparison baseline.

| Stage | Smallest deliverable | Acceptance gate before proceeding |
|---|---|---|
| A — Contract and baseline fixtures | Capture locked movement/AI/death traces; add schemas/IDs and test fixtures without changing runtime behavior. Reproduce baseline test outcomes and B-01. | Baseline manifest; known failures explicitly recorded; existing FPS/camera/death/AI/network test outcomes understood. No changed species tuning. |
| B — Canonical geometry and flat adapter | Extract shared Level 0 data; introduce `world_geometry.js` and legacy-compatible adapter/query signatures. Add safe HTTP serving/version loading for new modules and the policy-script integration gate. | Tile/prop/lamp/nav exports match; flat seeded traces match; served-page checks actually load required scripts; portable generation works. |
| C — Spatial geometry and body motion | Add `world_motion.js`; synthetic two-story map, ramp, real stair run, crawl roof, drop and underside collision. Drive it with the real `move.js` state machine in fixtures. | Sweeps/support/clearance/continuous stair/drop tests pass; no tunneling or floor selection by XY; fixed-tick equality; flat movement unchanged. |
| D — Early spatial view prototype | Prove the projection, depth pass and physical-visibility-versus-cutaway split on the same synthetic fixture using existing actor art. | Two clients can view different floors; no cross-floor reveal, overlay leak or camera fairness expansion. Confirm renderer support/performance before adapting every draw path. |
| E — Surface navigation and sensors | Extend existing A*/links/steering; spatialize sensors, evidence uncertainty, contact, groups, spawn and LOD. | Actual Hound/Smiler brains navigate fixture surfaces; unreachable links fail; hidden-floor branching produces equal decisions from equal evidence; canon/flat parity retained. |
| F — Authority and protocol | Implement spatial handshake/epochs, validated movement proposals, server-owned unsupported/traversal motion, corrections, spatial interactions and common interpolation. | Real-server latency/bunching/reconnect/malicious-Z tests pass; valid client movement reconciles within bounds; lifecycle/admin rules preserved. |
| G — Shared death and loose-object elevation | Extend `dphys.js` and server adapter; single active authoritative spatial aftermath; per-object support/beam/decal state. | All variants on stairs/ramps/ledges; fixed-substep replay agreement; immediate disconnect, delayed client, late join and exactly-one-corpse tests pass. |
| H — Complete presentation integration | Integrate peers, entity art, corpses, gear, lights, IR, decals, audio, map/HUD/admin depth selection and all overlays into spatial view. | Full multi-client visual checklist; physical rays independent of cutaway; flat screenshots/behavior preserved except separately recorded baseline fix. |
| I — Full regression/performance/package | Run bounded stress matrix, real-browser/network tests, clean extraction/build and reproducibility checks; package only after objective gates and limitations are recorded. | No unexplained regression; exact manifest/hashes; human QA checklist; status **2.5D IMPLEMENTATION COMPLETE — HUMAN QA PENDING**, never “gameplay proven fair.” |

Stage D intentionally precedes the broad integration: discovering that the current renderer cannot perform the required depth/visibility pass after every game system has migrated would be avoidable rework. It is a rendering feasibility gate, not a license to reduce physical geometry.

Do not replace Hound/Smiler logic with fixture bots to pass Stage E. Test drivers supply player inputs; they do not dictate enemy outcomes. Do not proceed by skipping a failed physics/authority gate or lowering preserved assertions. Record an explicit architecture amendment if a gate reveals a real design constraint.

The **first implementation action, only after implementation is requested**, is Stage A: create the immutable v23.3.6 manifest and exact reference traces, then define schema fixtures. No 2.5D code was written as part of this specification.

## 12. Deterministic regression strategy

### 12.1 Determinism contract

Run the real `move.js`, real generated AI/simulation and the real shared death kernel. Use integer simulation ticks and death substep indices; no wall-clock reads inside physical integration, geometry or decisions. Wall time schedules the accumulator/network tests only. Use the existing separated RNG streams without consuming new draws for geometry, rendering, chunk traversal or sorting.

Sort primitive contacts, graph ties, event delivery and object updates by stable identities. Generate static caches deterministically from the world hash. Record seed, input trace, profile/world versions, protocol version and Node/browser version with every result. Changing view size, render FPS, cutaway, quality or debug layers must not change a simulation trace.

Same runtime/seed/input: require identical discrete state, event ordering, RNG state and numerical trace. Across Node/browser engines: require identical discrete events and poses within a documented pre-wire tolerance (initial 1e-5 world units for short fixtures), then explicitly investigate any longer-run divergence. Do not claim arbitrary cross-engine bitwise floating-point identity. Quantized network snapshots are not the physics reference used for deterministic comparison.

### 12.2 Required fixtures and assertions

| ID | Scenario | Required objective assertion |
|---|---|---|
| Z01 | Two walkable floors with identical XY | Bodies, paths, pickup and exit targets retain the correct support; no contact/separation through the slab. |
| Z02 | Open stairwell beside a closed slab | Sight/light can cross the opening and cannot cross the closed slab. Horizontal, vertical and oblique rays agree on the same primitives. |
| Z03 | Ramp ascent/descent, including diagonal travel | Continuous Z/velocity, correct support normals and physical path distance; no acceleration/stamina changes on the flat control. |
| Z04 | Stair treads/risers, different approach directions | Finite-time step-up, no pose teleport, actual riser/ceiling collision; item/corpse motion does not use assisted steps. |
| Z05 | Stair interruption, reversal, sideways departure | Current pose remains continuous; correct support or free fall; traversal cannot finish after interruption by writing its endpoint. |
| Z06 | Thin intermediate slab during fast fall | Sweep lands on first intersected support; cannot tunnel through or select a higher floor behind the trajectory. |
| Z07 | Under-ceiling upward impulse / vault | Head/body hits underside; no ceiling escape or automatic promotion to upper-floor support. |
| Z08 | Crawl passage under an occupied upper floor | Low posture fits; standing rejected; upper actor neither blocks the crawl through an intact slab nor becomes touchable. |
| Z09 | Narrow seam, convex corner and near-equal contacts | Stable support/tie order, bounded penetration, no tiny-step wall exploit and no frame-rate-dependent floor jitter. |
| Z10 | Allowed/forbidden traversal per species | Real Hound crawl/vault remains possible where valid; Smiler gains no crawl/tight-gap/teleport ability. |
| Z11 | A* with stacked endpoints and one-way drop | Finds connected route; rejects impossible reverse; no XY-only snap/cache reuse/shortcut across an unsupported gap. |
| Z12 | Target visible, then hides and chooses different floors | With identical legitimate observations, decisions/RNG match until new evidence differs. Hidden true support/Z cannot select the branch. |
| Z13 | Ambiguous sound from above/below | Anonymous identity and vertical uncertainty preserved; no source-ID or true-floor leak. Door/stairwell and slab attenuation differ only by geometry/material. |
| Z14 | Visible lamp/flashlight/IR on another story | Z-aware occlusion and receiver height; visible-light rules retained; IR OFF/HIGH produces identical monster decisions under otherwise identical observations. |
| Z15 | Gaze through a floor versus through a clear opening | Physical LOS required; existing Hound intimidation and Smiler hold/release timers remain unchanged when observations are equal. |
| Z16 | Pack/group members on different surfaces | No impossible physical grouping/contact; no new shared hidden-player knowledge; flat group/watchdog traces remain unchanged. |
| Z17 | Near/mid/far LOD with airborne mover | Fall/traversal continues at fixed ticks; no sleep in midair, link teleport or skipped landing because an observer leaves. |
| Z18 | Walk/sprint/stamina/exhaustion/deep carpet | Real motor and recovery threshold 36/radius 15 verified; equal 15/30/60/120/144/240/360 FPS and jitter schedules produce equal fixed-tick results. |
| Z19 | Spatial slide/vault/crouch/crawl/drop | Actual movement state machine drives geometry; no replacement formula model; valid modes retain their resource costs and finite trajectories. |
| Z20 | Normal wire movement under latency | Seeded 20–250 ms latency, jitter, duplicated/stale reports and a 1 s bunching interruption; no unauthorized movement, persistent rejection or lifecycle reset; record correction count and magnitude. |
| Z21 | Malicious movement/protocol claims | Reject huge XY/Z jumps, wrong support, fake link completion, future/reused tick credit, speed/quiet-gait claims, nonfinite values and geometry mismatch. |
| Z22 | Reconnect/world reset, same ID | Old `h1` near x=5000/server time 60; new `h1` near x=1000/time 1 and another support. Use new pose immediately; old clock/slots/Z history removed. Jitter does not reset the world. |
| Z23 | Interpolation over stair/drop/teleport boundaries | No interpolation through a slab; same continuous trajectory at different render FPS; teleports do not blend; unknown extrapolated edges hold. |
| Z24 | Alive/free, captured, dead, revived and new-run lifecycle | Existing respawn/join restrictions, one-use revive and authorization persist; no stamina/protection/teleport escape through new spatial fields. |
| Z25 | All eight existing death variants on spatial fixtures | Continuous body and independent hands, actual wall impacts, gear detachment/landing, support-aware friction and no sleeping while airborne. |
| Z26 | Authoritative death then immediate disconnect | Other client receives replay, one physical aftermath/corpse, equipment included; late join during fall and after sleep sees the same object state. |
| Z27 | Normal client replay then delayed/duplicate messages | Server does not duplicate or replace correct physical aftermath with stale client pose; death/life generations separate successive deaths. |
| Z28 | Body on ledge, gear falling to lower floor | Mass loses support appropriately; hands cannot brace in air; gear has independent support/beam; decal remains on its actual contact face. |
| Z29 | Different clients above/below same location | Independent cutaway, same authoritative state/hash; unseen geometry and effects remain masked; one client's camera changes no other client's view. |
| Z30 | High resolution, ultrawide, NV/zoom and overlays | Canonical awareness footprint preserved; no hidden entities/eyes/blood/replays/gear leaking from separate Canvas/Pixi layers. |
| Z31 | No live players, active settling bodies | Physics continues until valid sleep or explicit room disposal; no freeze caused by the current live-player early return. |
| Z32 | Fresh extraction in a path containing spaces | Advertised tests/build scripts run without original machine paths; generated outputs reproduce; all required runtime modules return HTTP 200. |

Add shape/property cases around these fixtures: translate the whole world in Z without changing relative outcomes; permute static input order while preserving IDs; rotate/mirror a simple geometry fixture; test tolerance values just inside/outside a ledge or roof; verify maximum iteration fallback stays nonpenetrating. These are meaningful invariant tests, not tests that merely repeat an implementation formula.

### 12.3 Retained regression commands and evidence

Run from the package root in future implementation:

- `npm test`, `npm run test:hound`, `npm run test:shared`, `npm run test:humanqa`.
- `npm run test:fps`, `npm run test:camera`, and `node dev/tests/run.js s_entity_look.js`.
- `node dev/tests/phys_test.js`, `node dev/tests/interp_test.js`, `node dev/tests/nav_bench.js`.
- `node dev/tests/audit_net.js`, `node dev/tests/audit_net2.js`, `node dev/tests/live.js`, `node dev/tests/ir_net.js`.
- Relevant existing performance tests: `perf_hound2e.js`, `perf_shared2f.js` (including habits), `perf_smiler.js`, `perf_light.js`.
- `bash dev/build_ai.sh`, `bash dev/build_sim.sh`, `bash dev/build_ents.sh` in a disposable build extraction, then compare generated outputs and runtime loading.

New named suites should correspond to geometry/motion, surfaces/nav, perception, protocol, physical aftermath and browser cutaway—not one monolithic “2.5D passed” assertion. Capture the exact inputs and first divergent tick for parity failures.

For `audit_net.js` portability, test supported pinned Node environments including the previously discussed 22.16.0 and 22.22.2 where available; keep the actual audit runtime separate from the product's `node >=18` declaration. Built-in WebSocket availability/timing is a **test-environment** dependency. Reproduce an underlying server failure with an independent client before calling a harness timeout a product defect. Respect `audit_net2.js`'s documented duration; do not impose an artificially short external timeout.

Browser tests must use the actual served package, verify script/network errors, drive two clients on different elevations, and inspect final composited output. Static text searches in HTML are insufficient, as B-01 demonstrates. Tests may assert no position discontinuity/occlusion leak; a person must still assess readability, dread, navigation comprehensibility, camera discomfort, and death-animation feel. Bot capture percentages never establish fairness.

## 13. Performance risks and budgets

The main costs are multiplicative, not merely “one more float per entity.” Measure normal rooms and stress workloads separately.

| Risk | Bounded design / measurement |
|---|---|
| Every floor multiplies a full-map nav grid | Current full 48-unit Level 0 grid has 192×144 = 27,648 cells. Allocate occupied surface chunks, not `world width × height × floor count`; report node/link counts and memory. Share immutable geometry by content hash across rooms with bounded cache lifetime. |
| Many stacked colliders in one XY bin | Maintain per-bin Z intervals and reject by swept Z before narrow phase. Record candidates/query, TOI iterations and pathological overlap density. Do not scan every floor for every footstep. |
| Spatial path searches and extra transitions | Retain search/node budgets, reusable typed arrays and route commitment. Cache by proper surface/profile/revision keys. Bound replan work per tick without skipping physical motion. |
| Exact rays to every actor/light/face | Preserve AI perception cadence/candidate limits. Static spatial light caches are receiver-aware. Client GPU visibility is separate from authoritative sensor work. Count rays and cache hit rates, not just average FPS. |
| Death physics becomes always authoritative | Four substeps only for awake masses; shared broad phase; server snapshot late joiners instead of replaying all past ticks synchronously. Never sleep an unsupported object to meet budget. |
| Network payload growth | Compact geometry IDs and flags after correctness; replicate settled objects on revision, moving ones at existing snapshot cadence. Keep bodies/evidence/slots bounded and measure bytes/client/second with worst-case gear. |
| Validation replay under packet floods | Bounded sequence/history/queue, earned server-time credit, per-client and per-room work limits. Reject malformed/repeated proposals before geometry queries. No client-triggered unlimited A* or replay. |
| Cutaway/shadow fill and draw calls | Chunk/cull static meshes, cache unchanged local-eye depth, reuse scratch render targets. Initial 512²×6 depth field is about 6 MiB at four bytes/texel, before overhead. Measure total targets, passes and low-end GPU frame time. |
| Separate renderer layers bypass depth/masks | Route all world draw packets through common projection/visibility composition; test actual final output. An efficient but leaking overlay is incorrect. |
| LOD or multiplayer room scaling | Preserve cheaper thinking schedules; continue physical motion. Measure the server's total rooms, not only one simulation's average. Stagger nonphysical work without changing seeds/order. |
| Garbage/compilation stalls | Compile geometry once per revision; preallocate query/contact buffers; bound cache growth. Measure p95/p99, GC pauses, connect time and late-join initialization. |

**Provisional engineering gates, to be measured on a recorded reference machine before acceptance:** normal eight-player room with baseline director populations should keep total 60 Hz server-step p99 below 8 ms and avoid sustained accumulator backlog. Record absolute numbers; do not represent this target as a measured baseline result. Compare flat-mode median/p99 against the locked baseline on the same machine; investigate greater than 10%/20% overhead respectively using repeated runs, not one noisy sample. A supported rendering profile targets a 16.7 ms frame budget while gameplay remains 60 Hz at lower render rates.

Stress fixtures should include four stacked occupied surfaces, a dense stairwell, eight clients, the admin 64-Hound/64-Smiler ceiling, 24 corpse records, and a separate worst-case run with 24 active aftermaths. The admin population is a stress ceiling, not a new director balance. Report active bodies, lights, query counts, p99 and worst-step duration alongside averages. Do not compare a sparse one-floor baseline with an overloaded four-floor run and call the difference a regression without workload context.

Quality reduction may lower shadow resolution, cosmetic particles and draw detail. It cannot omit collision, advance fewer gameplay ticks per simulated second, widen vision, stop unseen falls, remove required surfaces or mute AI evidence. Reaching a budget limit produces bounded deferral/reconciliation with diagnostics, never physical shortcuts.

## 14. Exact files/modules likely affected

Paths below are relative to the supplied project's root. “Generated” means change its maintained source then rebuild during future implementation, not edit two copies independently.

| File(s) | Required architectural change / preservation |
|---|---|
| **New** `levels/level0.js` | Shared immutable level data; lossless extraction of legacy map/lamps/rooms/props ordering. |
| **New** `world_geometry.js` | Schema, compiled solids/supports/spaces/portals, indexes and spatial query contracts. |
| **New** `world_motion.js` | Continuous support/step/traversal/free-motion kernel and physical events; reusable at fixed 60 Hz / death 240 Hz. |
| **New** `world_view.js` | Projection, spatial depth/visibility/cutaway, picking and draw-packet integration. |
| `world.js` | Spatial profiles, explicit material/prop heights and descriptors for spatial content; preserve `MOVE`, `S`, `NOISE`, normalized `PROFILE` and flat behavior. |
| `move.js` | Feed real motor intent to support/clearance/trajectory APIs; physical posture and continuous vault/step/drop; contact-derived footstep material/events. No stamina/acceleration rewrite. |
| `dev/sim_head.js` | Replace duplicated level data with canonical import; retain flat collision/light wrappers during migration. |
| `dev/sim_glue.js` | World adapter, player spatial state, validated transitions, spawn/pickup/exit checks, body/item storage, active-physics scheduling and snapshots. |
| `sim.js` **generated** | Output of updated head/glue. |
| `dev/ai_src/00_head.js` | Spatial helper/profile plumbing only if needed; retain RNG streams and constants. |
| `dev/ai_src/10_geo.js` | Surface-local grid compilation, composite A*, link schema, spatial query adapters, support-aware light data and cache keys. |
| `dev/ai_src/20_senses.js` | XYZ sight/contact/gaze/range, observation snapshots, uncertain vertical sound, physical death visibility. |
| `dev/ai_src/22_intelligence.js` | Evidence/lead merge keys, vertical uncertainty, history/habit hypotheses and cleanup without hidden support leakage. Retain bounds/weights/TTLs. |
| `dev/ai_src/25_light.js` | Spatial source/beam/receiver observations and channel-safe occlusion. |
| `dev/ai_src/30_entity.js` | Surface-aware goals, path smoothing, direct routes, steering support, traversal and coarse movement. |
| `dev/ai_src/40_capture.js` | True XYZ contact, real wall/clearance queries, canonical death inputs/identity and single physical attacker ownership. |
| `dev/ai_src/50_hound.js` | Typed spatial goals/query call sites and snapshots. Preserve state logic, search polish, speeds, gaze, capabilities and tuning. |
| `dev/ai_src/60_smiler.js` | Typed spatial goals/query call sites and snapshots. Preserve canon, IR blindness, groups, eye-contact priorities, watchdog and tuning. |
| `dev/ai_src/90_engine.js` | Spatial candidate broad phase, noise origins, separation, active-physics LOD, lifecycle/epoch snapshots and admin placements. |
| `ai.js` **generated** | Output of AI sources. |
| `server.js` | Version/epoch handshake, spatial proposal queue/validation, authority/corrections, active aftermath updates, XYZ serialization, late join and explicit runtime serve allowlist. Address B-01 as a separately recorded baseline fix when implementation is authorized. |
| `mp.js` | Versioned decode, shared spatial pose histories, reset keys, peers/capture/aftermath/item state, prediction reconciliation and world-overlay masking. |
| `dphys.js` | Actual XYZ masses/support/contact, retain fixed substeps/shared plans; disambiguate hand damping `z`; serialize exact active/final physical state. |
| `death_srv.js` | Shared spatial death initialization/advance/serialization; same plan/kernel as clients, no second motion model. |
| `dev/ents_src/00_head.js` | Spatial snapshot-to-render adapters; preserve display-only ownership. |
| `dev/ents_src/10_hound.js`, `20_smiler.js` | Apply projection/depth/visibility to existing art/look direction. No redesign or invented Smiler body. |
| `dev/ents_src/25_death.js` | Same XYZ death state, partial occlusion, surface-aware effects and corpse continuity. |
| `dev/ents_src/30_audio.js`, `40_debug.js` | Spatial sound/listener cues; surface/link/contact/evidence debug labels, with truth restricted to authorized debug. |
| `ents.js` **generated** | Output of entity presentation sources. |
| `assets/index-DKbV5Nv9.js` | Narrow integration at map initialization, `Bc/Uc/sl` adapters, `Yc` movement hook, `Ou0` loop, world build/render/projection, avatar/death/gear anchors, `__api`, picking and overlay composition. Do not format/rewrite the whole recovered bundle. |
| `light.js`, `camcorder.js` | XYZ receivers/emission, visible versus IR occlusion, local NV mask, projection-safe range/picking; preserve AI separation. |
| `gore.js` | Surface/face-attached decals and spatial effect masking. |
| `sfx.js` | Spatial emitter/listener placement and floor/portal attenuation where relevant; no change to species evidence through cosmetic randomness. |
| `glitch.js`, `inventory.js`, `hud.js` | Correct elevated world anchors/interaction targets/map layer display where used. Keep ordinary UI behavior; cosmetic widgets need no physics redesign. |
| `camera_policy.js`, `timing_policy.js` | Preserve policy constants; integrate awareness footprint and common tick policy. No gameplay dt tied to projection/render FPS. |
| `index.html` | Load shared data/geometry/motion before consumers and client view after renderer availability; explicit version/serve integration. |
| `dev/build_ai.sh`, `build_sim.sh`, `build_ents.sh`, `dev/paths.js` | Update dependencies as required; keep reproducible package-relative output. |
| `dev/harness.js`, `dev/move_model.js` | Spatial fixture adapter using the actual motor; document remaining scripted-input/network/render approximations. |
| `dev/tests/*` retained suites | Add spatial variants and independent wire/browser fixtures; preserve old assertions and known-failure accounting. |
| **New test content** `dev/fixtures/world_25d.js`; **new suites** `s_world25d.js`, `s_nav25d.js`, `s_perception25d.js`, `physics25d.js`, `network25d.js`, `view25d` browser fixture, `perf_world25d.js` | Synthetic geometry, deterministic scenario IDs Z01–Z32, actual server/multiple clients and repeatable performance workloads. Final names may follow existing runner conventions; scope is explicit. |
| `package.json`, `dev/README.md`, `README.md` | Advertise correct tests/build/runtime requirements and compatibility mode. Version bump only for a future implemented build. |

Do not edit vendor Pixi asset chunks, textures, `redirect.js`, launchers, unrelated admin styling, or historical reports merely to modernize them. `dev/sim_geo.js` is not the input used by the current `build_sim.sh`; do not mistake historical extracted code for the maintained runtime source. If any initially excluded file proves to contain a live spatial assumption, document the call path before adding it to the implementation diff.

### Audit source anchors

The strongest traceable anchors behind this design are:

- `server.js`: `TICK_MS/SNAP_EVERY`, `SERVE`, `mvCheck/mvAccept/mvReset`, `aftStart/aftTick`, `moveTo`, fixed-step room loop and snapshot construction.
- `world.js`: `setMode/blocks`, `surfaceAt`, `CRAWL`, `MOVE`, `PROFILE`; `move.js`: `collide/freeAt`, `tryVault/stepVault`, `stepInner`.
- `dev/ai_src/10_geo.js`: `buildStatic`, `Geo.path/snap/lineClear/lightLevel`; `30_entity.js`: `plan`, `smoothPath`, `directOk`, `beginTrav/stepTrav`.
- `20_senses.js`: `perc`, `touching`, `visualObservation`, `facedBy`, `hearEvent`; `22_intelligence.js`: `INTEL`, `identifySound`, `habitObserve`.
- `40_capture.js`: `wallBehind`, `beginCapture`, `killNow`, `beginCommit`; `90_engine.js`: `eng.step`, `farStep`, `watchdog`, `separate`.
- `dphys.js`: `DT`, `create`, `stepOnce`, `freeBody`, `advance`, `pose`, `PLAN`, `simulate`; `death_srv.js`: `fxFor/bodyFor`.
- `mp.js`: `NET`, `netReset`, `netHist`, `netPose`, `applyServerState`, `applyCaught`, `bodyMade`.
- Application bundle: `Ou0`, `__tm`, renderer `resize/build`, `Bc/Uc`, death `__dphys.begin`, `window.__api`.

These references describe code inspected for this task. Proposed module names and contracts above are design decisions, not claims that those capabilities already exist.

## 15. Explicit invariants future implementers must not violate

| ID | Non-negotiable invariant |
|---|---|
| I-01 | Gameplay advances in fixed 1/60 s ticks independent of render FPS. Death integration uses four 1/240 s substeps per gameplay tick. Rendering does not invoke gameplay decisions or extra RNG draws. |
| I-02 | World XYZ is physical. Screen offsets, floor indices, drawing order and cutaway cannot determine collision, support, navigation, contact, sound or AI visibility. |
| I-03 | Arbitrarily stacked traversable surfaces may share XY. Every relevant query/state identifies a valid spatial branch or explicitly represents uncertainty. |
| I-04 | Support changes continuously through actual geometry/traversal. No nearest-floor snapping, stair-floor teleport, airborne support guessing or sleeping without support. |
| I-05 | A collider must fit over its full volume. Walls, slabs, ceilings, crawl roofs, risers and undersides remain physical even when hidden from the local camera. |
| I-06 | Existing 2D navigation evolves into surface-local grids plus traversal links. Preserve A*, clearances, steering, route commitment and capability gates; do not replace them with unconstrained XYZ steering or discard them for an unrelated nav system. |
| I-07 | A smoothing/direct-route shortcut is valid only with continuous support and clearance. Seeing a point is not evidence that a body can walk to it. |
| I-08 | Entity decisions use legitimate observations/beliefs. True hidden player Z, floor, support, source ID or velocity cannot leak through geometry helpers, metadata, group coordination or hypothesis scoring. |
| I-09 | Hound/Smiler canon, intelligence, existing tuning and v23.3.6 search/look behavior remain intact when observations are equivalent. No new powers, senses, flight, teleportation or Smiler body. IR remains invisible to AI. |
| I-10 | Server authority over entities, captures, deaths, lifecycle, items and permissions remains. Client XYZ/support/link claims are validated; unsupported/timed physical motion cannot depend on continued victim packets. |
| I-11 | IDs are scoped by explicit world and lifecycle generations. Old pose, clock, slot, capture, corpse or correction state cannot attach to a reused entity ID. Jitter is not a world reset. |
| I-12 | One death event owns one physical aftermath. Client replay and server authority use the same plan, seed, geometry and physical kernel; disconnects/late packets cannot duplicate or replace it incorrectly. |
| I-13 | Final corpse configuration comes from the exact final/continuing physical animation state. Preserve one rounded body and two independent circular hands; no visible limbs or full humanoid ragdoll skeleton. |
| I-14 | Loose equipment, hands and decals have real spatial placement/support. They cannot all inherit the body's floor after detachment or paint across unrelated surfaces. |
| I-15 | Physical visibility and local camera cutaway are separate. A client may hide a ceiling for presentation but cannot see, illuminate, target or attack through it. All world overlays obey the spatial mask. |
| I-16 | Level 0 flat compatibility preserves existing movement/perception/nav/death behavior. Any conversion or tuning change is separately identified and gated, never hidden inside schema migration. |
| I-17 | Geometry, collision, nav support and rendering derive from one versioned world definition. Generated outputs reproduce from maintained sources and run from an arbitrary extracted package path. |
| I-18 | Physics/evidence cannot be skipped to meet a rendering or CPU budget. Degrade cosmetic quality or defer bounded nonphysical work; keep falls, contacts and lifecycle correct. |
| I-19 | Numeric tolerances, iteration budgets, sensor uncertainty and protocol limits are explicit/versioned. Failure falls back to a safe valid state with diagnostics, never through geometry. |
| I-20 | Automated correctness/performance success does not prove human fairness, fear, readability or good game feel. Human QA remains a distinct gate. |

**Design handoff:** implement the four proposed modules and the enumerated adapters in the staged order, using Z01–Z32 and I-01–I-20 as acceptance contracts. No game implementation, build modification or gameplay rebalance was performed in this task.

**2.5D WORLD ARCHITECTURE SPECIFICATION COMPLETE — IMPLEMENTATION NOT STARTED**
