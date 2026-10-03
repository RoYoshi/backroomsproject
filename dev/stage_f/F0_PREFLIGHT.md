# Stage F F0 — verified preflight

Accepted parent: da90dbb48ac4702d666d26c638fe074a78478212.
Immutable parent ZIP SHA-256: a935b3f9c38bea48edc0add99b53d234ce431daf3986face4350691a2e8ad1e6.
All 1,001 Git files match the supplied parent archive exactly. Branch stage-f was
created at that commit. No runtime changes in F0. main is outside this work.

## Existing protocol
server.js owns dependency-free WebSocket framing, 25 ms room wakes, fixed 60 Hz
simulation and snapshots every two wakes. hi/p/s/tp are unversioned. mvCheck uses
server-wall-time distance credit (360 units/s, 1.5 s burst, 28 units slack as debt),
collision validation and authenticated reset grace. Lifecycle is in maintained
sim_glue.js: join/respawn/vanish/leave/capture/forfeit/one-use revive. mp.js uses
100 ms entity delay, eight samples, at most 150 ms extrapolation and inferred
clock resets. Stage E real spatial AI is behind the geometry adapter; production
sim currently instantiates Level 0 only. Server and client require explicit
spatial-world adapters; neither can treat missing Z as a spatial spawn.

## Migration plan
Add shared, versioned protocol/finite codecs and a shared client protocol state
adapter; preserve legacy messages in explicit flat-compat mode. Introduce explicit
room world epoch, entity generation, life generation and integer physical tick.
Spatial worlds are selected by server configuration using canonical immutable data,
never by a client hash/support claim. Reject incompatible clients before entry.
Use the existing sim lifecycle and Stage E AI adapter for spatial worlds.

Queue ordered proposals at sockets. Validate bounded fixed-tick traces through
world_motion with server-earned credit, no A* route substitution. Keep existing
client move.js/stamina ownership. Grounded replay is capped at 90 history ticks,
90 queued samples/client and 15 validation substeps/room wake. Transfer free/step/
traversal progression to the server; reconcile at transition boundaries rather
than replaying a server-owned transition twice. Corrections carry epoch/life/pose/
ACK/discontinuity and invalidate old work. Common spatial interpolation will use
physical support/clearance and explicit discontinuities; missing paths hold.

Real server/WebSocket tests will drive actual move.js and the common client codec,
cover Z20–Z24, then retained parity/network/Stage E gates and fresh packaging.
Death aftermath remains the retained system; no Stage G or full Stage H work.

## Validation
parent.json: PASS, zero mismatches. Real motor FPS equality: PASS. Existing
interpolation suite: PASS. Raw logs in evidence/f0. Runtime Node v24.19.0.
Inherited 151/162 ledger, P08 unknown, F22/SM01 and historical L5 timing caveats
are retained without changing thresholds. Human Stage E acceptance is carried
from CURRENT_STATUS_AND_AUTHORITY; older reports are historical.
