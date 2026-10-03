# STAGE F ACCEPTANCE MATRIX

Stage F is **Authority & Protocol**.

The locked future matrix assigns Z20–Z24 to Stage F.

## Z20 — Normal wire movement under latency

Use real server/client protocol paths.

Seed:
- 20–250 ms latency range
- jitter
- duplicated reports
- stale reports
- a 1 second bunching interruption

Required:
- no unauthorized movement
- no persistent legitimate-movement rejection
- no lifecycle reset from ordinary jitter
- bounded queues/history
- correction count and magnitude recorded
- no client timestamp minting server movement credit

## Z21 — Malicious movement / protocol claims

Reject safely:
- huge XY jump
- huge/fake Z jump
- claimed wrong support/floor
- fake traversal/link completion
- future tick credit
- reused tick credit
- speed claim inconsistent with real motor/budget
- quiet-gait/noise cheating
- nonfinite values
- malformed/bounds-exceeding arrays
- incompatible protocol capability
- geometry/schema/hash mismatch
- stale world epoch
- stale life/entity generation
- stale correction acknowledgement

A rejected claim must not:
- move the authoritative body through geometry
- reset lifecycle
- crash or unbound server work
- alter AI truth
- create extra elapsed-time credit

## Z22 — Reconnect / world reset / reused ID

Required fixture:
- old `h1` near x=5000 at server time ~60
- new `h1` near x=1000 at server time ~1
- different support/elevation context

Required:
- new pose applies immediately
- old clock/history/slots/Z/support/correction state is gone
- old packets cannot attach to the new generation
- ordinary jitter does not create a world reset
- explicit worldEpoch/generation identity owns the boundary

## Z23 — Spatial interpolation boundaries

Required:
- stair transition
- one-way drop / airborne transition
- landing
- explicit authorized teleport/discontinuity
- missing transition / unknown edge
- different render FPS schedules

Required:
- never interpolate through a slab
- supported paths reconstruct support continuously
- traversal follows agreed progress/trajectory
- flight uses XYZ/velocity and splits at landing/contact
- unrelated stacked supports never blend
- teleport/discontinuity never blends
- unknown extrapolated ledge edge holds instead of fabricating fall/hover
- gameplay trace does not depend on render FPS

## Z24 — Lifecycle and authority preservation

Exercise:
- alive/free
- captured
- dead
- revived
- respawn/new run
- protected/authorized teleport paths

Required:
- existing join/respawn restrictions retained
- existing one-use revive retained
- capture/death cannot be escaped with stale movement
- stamina/protection semantics retained
- teleport cannot be forged through spatial fields
- old life generation cannot affect a new life
- no new lifecycle path exists only because Z/support/link fields were added

## Additional Stage F gates

### Protocol/version compatibility
Handshake communicates:
- protocol capabilities/version
- world epoch
- geometry/schema revision/hash
- motion-profile revision
- current integer simulation tick
- stable compact geometry-ID table as required

Incompatible spatial client/world combinations fail explicitly and safely.

### Pose envelope
Spatial snapshots include bounded finite values for:
- world epoch
- entity ID + generation
- pose sequence/tick
- XYZ
- XYZ velocity
- yaw
- physical height/profile
- support/nav-surface reference
- grounded/airborne/traversal flags
- link/progress when applicable

### Hybrid player authority preserved
Do NOT replace the current client-predicted motor with a full server-input motor.

For spatial worlds:
- client XYZ is a proposal, not authority
- server derives Z/support from geometry
- claimed endpoint Z/support cannot select a stacked floor
- movement samples are ordered fixed-tick claims
- server time earns movement credit
- bounded validation history <= existing 1.5 s / 90 tick allowance
- max 15 validation substeps per room wake
- larger backlogs reconcile instead of creating unbounded work
- flat Level 0 compatibility remains on its retained path unless specifically and
  minimally adapted by the locked design

### Server-owned timed/unsupported motion
Once unsupported motion, assisted step/vault, capture or other Stage-F-owned
trajectory begins:
- server fixed ticks continue it if client packets stop
- client may predict same primitive
- client may request bounded steering where allowed
- client cannot submit absolute airborne Z
- client cannot declare traversal complete
- duplicate delayed samples cannot advance the transition twice

### Corrections
Correction/teleport message has explicit discontinuity identity and complete
authoritative pose/support/life/world identity.

Small visual smoothing is presentation only and cannot cross collision.

### Determinism/regression
Preserve:
- fixed 60 Hz simulation
- no extra RNG from protocol/interpolation
- camera/render-FPS independence
- Hound/Smiler evidence rules/canon
- Stage E navigation/sensor behavior
- flat Level 0 behavior
- existing WebSocket transport and snapshot cadence unless the locked spec
  explicitly requires metadata additions

## Stop gate

Stage F is complete only when Z20–Z24 and all required Stage F regression/network
gates have objective evidence and the final Stage F checkpoint is externally
recoverable.

Then STOP.

Do not begin Stage G.
