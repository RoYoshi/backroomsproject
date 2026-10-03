# Stage G authoritative aftermath

The authoritative kill freezes `(worldEpoch, victimId, lifeGeneration,
deathSequence)`, immutable plan/seed/version/variant, victim and attacker
XYZ/velocity/support/profile, equipment and geometry identity. `death_srv.js`
loads the same `dphys.js` used by browser replay. Spatial aftermath starts at the
kill and immediately creates exactly one record in the existing owner-keyed body
map. Flat Level 0 retains its accepted client-result/server-fallback contract.

During authored attacker control, `deathOwner` excludes the ordinary physical
motor and separation. The shared death kernel is the only integrator. The engine
resumes at the actual final XYZ/velocity/support, never a planar killerEnd guess.
When no live players remain, released airborne attackers finish falling through
the existing actor motor without new AI decisions; body/hands/items continue
through the four-substep death kernel. Existing explicit empty-room disposal is
unchanged and may dispose all room state.

Spatial client replay, corpse results, completion, ACK, object and death-FX
messages cannot replace authoritative aftermath. Per-object identity includes
the canonical death key and role; revisions reflect real physical/orientation/
contact/sleep changes. The existing owner-to-latest policy, cap 24 and optional
TTL remain. Duplicate/stale epochs, life/death generations and revisions are
rejected; a later death for one owner replaces only that owner's previous corpse.

Stage F WebSocket framing, epochs, generations, proposal authority and common
history are reused. The wire contract is explicitly version **2**, capability
**spatial-aftermath-v1**, kernel **stage-g-death-1**. Version-1 or missing-capability
spatial clients are rejected. Living proposal limits remain unchanged; death
history permits the physically larger velocities of long passive falls.

An active snapshot contains current bounded control state, RNG cursor, plan and
physical progress, so a late join restores the current kernel rather than
replaying from zero. Sleeping snapshots omit the continuation checkpoint and
emit no subsequent body updates. Per-client changed-record messages carry
full/delta and removed-owner fields, with bounded chunk assembly for at most 24
owners. The server and tests call the same message construction helper. Each
mass carries shape, XYZ/velocity, yaw/angular velocity, tilt, support/contact,
revision and awake state; independent gear, beam, contact/decal/trail records are
included. `attackerOwned` identifies the limited death-control interval; the
ordinary entity history resumes after handoff.

Evidence proves one canonical event and one corpse on the real WebSocket server,
active and settled late joins, harmless repeated replacement attempts, and
continued motion after victim disconnect. Direct real-simulation tests disconnect
at ticks 0, 60, 250 and 600 and inspect four join phases each. Twenty-five deaths
retain exactly 24 records/aftermaths; TTL still expires them. Same-owner successive
lives have distinct canonical keys. A saved state continues exactly for 240 ticks.
Common history receives body, two hands and actual gear; full art/compositing,
audio and map/HUD integration remain Stage H.

Stage G bounded performance is in `G4_STATUS.md` and `performance-01.log`.
The 24-active case is correct and bounded but exceeds a 16.667ms tick budget on
the measured host. Its peak total payload is 439,626 bytes per update across
bounded frames, about 8.793 MB/client/s at nominal 20Hz. This is an explicit
capacity/bandwidth limitation, not Stage I certification. Collision, gravity and
unsupported activity were not skipped for speed.
