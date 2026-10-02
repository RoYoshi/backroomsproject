# Stage C engineering boundary

Opt-in physical spatial geometry and the real player motor. Level 0 remains flat-compat.
Run from any extracted package directory:

```
node dev/stage_c/test_spatial.js
node dev/stage_c/test_schedules.js
node dev/stage_c/test_camera.js
node dev/stage_c/verify_parity.js
node dev/stage_c/served_package.js .
```

`world_geometry.compile(spatialDefinition)` validates frozen Stage A records plus
convex CCW polygons, matching upper-face supports, bounds and consistent unions.
Solid unions with equal material/channel semantics are legal (fixture ramp/ground).
Conflicting overlapping material/channels, duplicate volumes/supports are rejected.
Input record arrays retain mandatory canonical ID order; reordering keys is harmless.
Spatial identity is data SHA-256 plus explicit compilerRevision; no runtime path/time.
Stage B's flat data, hash and query implementation remain intact.

Spatial query APIs use upright cylinders `{radius,height}` and root-base `{x,y,z}`:
- `supports(shape, pose, [minZ,maxZ], previousId, direction)` returns ordered fits;
  previous support wins equal-distance tolerance ties. No global maximum-floor query.
- `clearance(shape,pose)` clips convex solids to the body's Z interval, then tests
  the actual circular footprint. Floor and ceiling planes use finite overlap extrema.
- `sweep(shape,start,displacement,channel='collision',margin=.05)` uses exact cylinder
  support mappings and convex prism vertices, GJK separating distances + conservative
  advancement. Analytic separating planes handle exact resting/tangent contacts.
  Margin zero is used for already-supported paths; contact skin bounds rest offsets.
  Limits return conservative contact/diagnostic rather than permitting penetration.
- `raycast(from,to,collision|visible|ir)` clips a segment against finite convex solids.
  This is geometry only, not AI LOS or perception integration. Sound is deferred.
- `supportPatch(id)` is indexed. `spacesAt(point)` subtracts physical solids from
  authored space envelopes; it does not provide portal navigation.
- `contact` and `traceSupportMotion` remain explicitly deferred Stage E/G APIs.

`world_motion.create(geometry)` provides initialize, posture, fixed `step(1/60)`,
collision-swept vault segments and bounded moveSwept. `motorAdapter` attaches to
`__api.spatialMotion` only in spatial fixtures/future authorized callers. move.js
retains input, acceleration, stamina, state machine, slide and vault entry/cost.
Normal index.html loads the module but does not enable spatial Level 0 or wire Z.
All posture profiles and physical constants are versioned in world_motion.js.
Player physical radius is 15 in every spatial posture; legacy mode radii unchanged.
Hound/Smiler integration and death/item spatial profiles remain later-stage work.

Ground motion samples the exact finite support envelope, splits at contact-plane
edges, and limits each tested segment to one world unit; this is trajectory
construction, NOT the collision test (every segment uses a volume sweep).
Requested motor speed budgets actual XYZ path length. Skin is .05, not a snap range.
Stairs execute finite smooth raise, motor-budgeted forward travel, then support settle.
Stopping/reversal/sideways input interrupts from the current pose. Drops carry XY
momentum and integrate gravity at 60Hz. Parabolic fall chord error per tick is
980*(1/60)^2/8 = .03403 units, below .05 skin. Contacts consume remaining tick time.
Landing emits support/material/normal/impact speed once; no fall damage is added.
Vaults require explicit existing-style LOW descriptors, including authored topZ,
and sweep their entire raise/cross/settle envelope before the motor charges cost.
They retain the existing duration and quality semantics. No free jump action.

Limits: max eight contact resolutions, 128 ground trajectory segments/tick,
48 GJK and 64 conservative advances per convex sweep, 64 polygon vertices,
100,000 solids, 1,000,000 XY index cells and absolute coordinates <=10,000,000.
These are engineering limits, not canon. Index XY cell size 128, candidates Z-filtered.
Overlapping-solid validation is compile-time quadratic; actor queries are indexed.
Diagnostics keep the last safe pose and stop unresolved velocity, never tunnel.
Full sphere/loose-body contact and traceSupportMotion are not represented as complete.

Frozen Stage A/B verifiers remain historical and intentionally retain their original
source allowlists/camera expectations. The Stage C parity tool uses the Stage B parent
manifest, allows only six necessary original edits and compares the same 46 frozen
record arrays. Only real move.js and inherited sim_glue source-hash metadata differs.
No baseline record or inherited failure assertion is regenerated/weakened.

CAMERA-P01 is independently reverted by changing REF_SCALE in camera_policy.js
back to 1.18, and its one intentional test expectation. No physics depends on it.
No Stage D presentation, E AI migration, F packets, G death/item elevation or H/I
work is implemented. Human gameplay QA and independent engineering review are pending.
