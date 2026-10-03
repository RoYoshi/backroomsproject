# STAGE G IMPLEMENTATION SEAMS

This file summarizes existing code boundaries from the accepted Stage F parent.
It is guidance, not permission to replace the locked architecture.

## Existing shared death kernel — `dphys.js`

The current kernel is intentionally lightweight and deterministic:
- fixed `DT = 1/240`
- one primary body mass
- two independent hand point masses/springs
- attacker state
- loose light/equipment
- loose hat
- authored Hound/Smiler A–D death plans
- deterministic seed/plan
- resistance/impact/recoil/friction/sleep sequencing

Current implementation is planar XY.

Important trap:
the historical hand property named `z` is a **spring damping ratio**, not world Z.
Stage G must explicitly disambiguate/rename that internal meaning before adding
physical elevation.

Likely maintained functions/seams include:
- `create`
- `stepOnce`
- `freeBody`
- `advance`
- `pose`
- `PLAN`
- `simulate`

Do not create a second spatial death solver.

## Existing server fallback — `death_srv.js`

Current flat behavior:
- loads the same `dphys.js`
- can synthesize the same replay/final corpse when the victim client disappears
- uses the real death plan rather than a separate approximation

Stage G evolves this into the server-owned ACTIVE spatial aftermath.

For spatial deaths, the server must own the running state from the authoritative
kill, not wait for a client to finish and report a final support.

## Existing server aftermath — `server.js`

Current flat aftermath:
- stores kill/info records
- victim client normally sends replay (`fx`) and corpse (`b`)
- server sends replay/fallback after delay/disconnect
- bodies are keyed by player ID
- one body per player policy
- body TTL/cap behavior exists
- snapshots include body records

Stage G must preserve flat compatibility while adding an explicit spatial path.

Stage F already provides:
- world epoch
- life generation
- spatial protocol identities
- fixed-tick authority boundaries
- common spatial history/interpolation infrastructure
- extended WebSocket framing

Reuse those boundaries. Do not duplicate them.

## Existing simulation bodies — `dev/sim_glue.js`

Current cap:
`MAX_BODIES = 24`

Existing body map/body version/TTL semantics should remain unless a separately
authorized change is required.

Current "no living players" logic must be audited so active spatial aftermath and
unsupported loose objects cannot freeze.

## Existing spatial physical helpers

Reuse:
- `world_geometry.js`
- `world_motion.js`

Death/loose objects must use real spatial geometry/contact/support queries.

Living actor assisted steps/stairs are NOT corpse behavior. Loose objects and
corpses collide with actual risers/treads/slabs and fall naturally.

## Existing Stage F protocol

Stage F protocol v1 explicitly deferred corpse/equipment spatial replication to G.

Stage G may extend the existing versioned envelope/capabilities. Do not silently
change old wire meaning. If compatibility requires a protocol/capability revision,
make it explicit and test mismatch rejection.

Corpse/item state needs:
- world/death/object identity
- XYZ pose/velocity
- support/contact state
- awake/sleeping state
- revision
- important equipment state
- bounded active snapshots / late-join state

## Presentation boundary

Stage G may provide enough object state and diagnostic playback to prove physics.
It must NOT turn into Stage H's complete production rendering integration.

No broad renderer rewrite, no overlay overhaul, no full map/HUD/admin depth work.
