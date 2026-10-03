# STAGE G ACCEPTANCE MATRIX

Stage G is **Shared Death & Loose-Object Elevation**.

The authoritative future matrix already contains a dormant `physics25d` entry.
Stage G must activate that real suite; it must not leave the current
`NOT IMPLEMENTED` placeholder or replace it with empty/pass-through tests.

## Z25 — All eight existing death variants on spatial fixtures

Exercise the existing:
- Hound A/B/C/D
- Smiler A/B/C/D

on representative:
- flat spatial support
- stairs/treads/risers
- ramp/slope
- wall/underside contact
- ledge/drop
- stacked-floor geometry

Required:
- continuous body XYZ
- two independent constrained hand masses
- real wall/slab/stair contacts
- equipment release inherits real attachment-point XYZ velocity
- gear may land on a different elevation
- support-aware friction
- body/hand/light/hat cannot sleep while unsupported/airborne
- no assisted living-actor step rule for corpse/loose objects
- deterministic plan/seed behavior
- four 1/240 s death substeps per 1/60 gameplay tick
- replay/sample cadence cannot change final physics
- no new RNG draws from geometry/substeps/rendering

The existing eight authored variants/tuning remain unchanged unless a minimal
adapter change is objectively required.

## Z26 — Authoritative death then immediate disconnect

This row is shared F/G. Stage F supplied identity/protocol foundations; Stage G
must complete the physical aftermath.

Required:
- authoritative kill freezes plan/version/seed and initial victim/attacker/
  equipment XYZ state
- server starts and owns one active spatial aftermath
- disconnect does not stop the death motion
- observers receive the canonical death event
- exactly one corpse record is produced/updated
- important loose equipment is included
- late join during active motion receives bounded current state + progress/revision
- late join after sleep receives the same settled object state
- no requirement to replay a long fall from time zero
- attacker physical ownership is singular while a death plan controls it
- attacker resumes from actual final pose/support

## Z27 — Delayed/duplicate client replay/results

This row is shared F/G.

Required:
- client death replay is presentation/prediction, never authority over spatial final state
- delayed or duplicate `fx`, corpse, completion, ACK or object messages cannot
  create or replace a second physical aftermath
- stale client final pose cannot replace correct server physical state
- identity includes `(worldEpoch, victimId, lifeGeneration, deathSequence)`
- corpse/loose-object identities/revisions prevent cross-death reuse
- successive deaths for the same player remain distinct
- current owner-to-latest-corpse policy, cap and TTL are preserved unless separately authorized

## Z28 — Ledge body / gear falls to lower floor

Required:
- body support is based on stable physical contact/support arrangement
- negligible ledge overlap cannot hold a corpse forever
- body can tip/slide/fall when support is lost
- hands cannot brace in empty space or on a distant lower floor
- hand anchors remain constrained; they do not become detached orbiting circles
- light/hat have independent XYZ, velocity, support and sleep state
- detached gear can land on a different elevation than the body
- beam state/direction follows the actual detached light state
- decals bind to the actual contacted face/support with local surface coordinates
- a decal cannot stamp every floor under the same XY
- trails stop when ground contact is lost and resume only on real contact

## Z31 — No live players while aftermath is active

Required:
- active death/loose-object physics continues at fixed substeps even when all
  players are dead/disconnected
- current no-live-player early returns cannot freeze an airborne/settling object
- valid sleep requires physical support/contact and sleep criteria
- authored death sequence ending does NOT force sleep
- room disposal may still follow explicit existing room lifecycle policy
- if support later disappears, the same settled object wakes rather than spawning/replacing it

## Additional deterministic/property gates

Use meaningful invariant cases around the spatial fixture:
- translate entire fixture in Z: relative outcome unchanged
- deterministic identical seed/plan inputs: identical state/events
- different render/sample schedules: identical physical result
- permute static geometry input order while stable IDs remain: outcome unchanged
- ledge/contact tolerances just inside/outside support: safe consistent result
- maximum contact/iteration fallback remains nonpenetrating and diagnostic
- no client/camera/cutaway state changes physics

## Flat compatibility gate

Default flat Level 0 retains its existing death behavior/traces behind the flat
adapter.

Run the retained real `dphys.js`/death tests and frozen parity. Stage G may not
quietly rebalance death variants or replace the flat death contract.

## Performance/bounds gate

Measure, do not hand-wave:
- awake aftermath masses
- loose objects
- active corpse records
- collision/contact query counts
- bytes/client/sec or snapshot size for active aftermath state
- p50/p95/p99/worst death-physics work on bounded fixtures
- separate worst-case run with up to the existing 24 corpse/aftermath record ceiling

Do not sleep unsupported objects or skip physics to hit a budget.
Full Stage I multi-room/128-entity certification remains deferred.

## Stop gate

Stage G is complete only when `physics25d` owns real implementations of
Z25/Z26/Z27/Z28/Z31 and those gates pass with evidence, with no new unexplained
regression.

Then STOP.

Do not begin Stage H.
