# PART 3A IMPLEMENTATION SEAMS

## `levels/level0.js`

This is the accepted flat-compat canonical Level 0 source.

Do NOT mutate it into spatial mode and thereby destroy the flat certification.

Part 3A should introduce a maintained explicit spatial Level 0 content source/build
that DERIVES from the accepted Level 0 identity and records its own spatial content
revision/hash.

Good patterns include:
- `levels/level0_spatial.js`
- a deterministic `dev/part3a/build_level0_spatial.js`
- a generated `levels/level0_spatial.json`

Exact filenames may differ if repository conventions justify it.

Do not maintain hundreds of hand-copied flat cells in an unrelated second file.

## `server.js`

Accepted Stage I already supports an explicit host-selected `TFB_WORLD` JSON and
serves it to the production page via `world_config.js`.

Prefer preserving that explicit selection during 3A engineering.

Do not silently make spatial Level 0 the only default before 3A human QA.

A later approval/promotion can decide whether production default switches.

## `dev/sim_glue.js`

Spatial production worlds require explicit:
- player spawn
- Hound/Smiler spawn candidates
- item anchors
- exit anchors/candidates

Current fixture-oriented first-anchor behavior is not sufficient for production
variety.

Any extension must reuse existing RNG/director/lifecycle authority and not create a
new AI spawning subsystem.

## `world_geometry.js`

Keep this as physical truth.

Full production Level 0 may contain many spatial primitives.

Use its broad-phase/indexing capabilities or extend them narrowly/deterministically.

Do not change query meaning for content convenience.

## `world_motion.js`

Do not retune movement in 3A.

Stair/ramp/drop/crawl must use the accepted motion kernel.

3B owns presentation smoothing.

## `world_view.js`

This is the main production-scale presentation risk.

The Stage I accepted view path was fixture-bounded.

Part 3A may evolve it to production-scale deterministic chunks/batches.

Required:
- complete physical occluder semantics
- no silent candidate truncation
- no insertion-order dependence
- local render candidate selection must be conservative
- multi-pass if candidate count exceeds a single shader batch
- picking/light/masks agree with the actual selected relevant geometry
- cutaway remains local visual state

Do not create a replacement renderer.

## `spatial_client.js`

Reuse the production integration established by H.

It should load/render the production spatial Level 0 definition and accepted live
network state.

Do not add a parallel game loop.

## Navigation

Keep existing `dev/ai_src/10_geo.js` system.

Production Level 0 may require more nav surfaces/chunks, but:
- retain 48-unit grid semantics
- retain clearance classes
- retain A*
- retain no diagonal corner cutting
- retain wall-distance costs
- retain traversal links
- retain route commitment/smoothing

Do not replace with generic 3D steering.

## Generated files

Edit maintained sources first.

Regenerate:
- `ai.js`
- `sim.js`
- `ents.js`

only through their existing build scripts when affected.

Do not patch generated output without matching maintained source.

## Content scope vs visual scope

3A can create physical wall/floor/ceiling faces and basic material identifiers
needed to read geometry.

Do not turn 3A into the final texture/shadow/atmosphere pass.
