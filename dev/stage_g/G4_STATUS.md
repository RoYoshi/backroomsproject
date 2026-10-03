# G4 — late join, sleep and real acceptance

`dev/tests/physics25d.js` is activated against the original five matrix entries.
The real shared kernel, server simulation, geometry queries and WebSocket path
pass Z25, Z26, Z27, Z28 and Z31. Raw child output is in
`evidence/g4/physics25d-raw`; all earlier failed attempts remain alongside it.

All eight authored variants pass seven fixtures each: flat, stairs, ramp, wall,
underside, ledge and stacked slab (56 cases). Body/hand/gear clearance, finite
XYZ, constrained reach and no unsupported sleep are checked every tick. Some
ramp/ledge cases remain physically awake at eight seconds; the gate does not
force sleep at the animation deadline. Bounded safe contact diagnostics in four
Hound ramp cases are retained in the output. Hand suspensions have no invented
floor or detached/orbiting limb.

Active joins restore a bounded kernel checkpoint including RNG cursor and
current control phase without replay from zero. Continuation is exact for 240
future ticks. Sleeping records have no continuation payload, query work or
repeated revisions. Current body records use existing owner/epoch/generation
identities, explicit version 2 / spatial-aftermath-v1 capability, changed-record
messages and bounded chunks. The actual server and tests share message creation.
Real WebSocket joins during motion and after sleep receive the same owner and
independent gear. Disconnect tests cover ticks 0, 60, 250 and 600, with four join
samples per phase. Existing cap 24 and optional TTL both pass unchanged.

A canonical death on a platform at Z=20000 falls beyond the authored duration,
continues with zero players, and settles at 15.5167 simulation seconds. The
released attacker continues through the existing actor gravity kernel without
AI decisions while the room is unobserved. Explicit support removal wakes the
same body, hands and loose objects. Replacing geometry that overlaps them is
rejected. Static input permutation uses the accepted Stage E canonicalization
before compilation; Stage C's sorted-ID schema remains unchanged.

Repairs and failed evidence:
- Ramp attachment initially penetrated: gear/hand attachment uses a real swept
  path from a safe point inside the body.
- Sleep could stop between gameplay ticks: aggregate sleep now commits at the
  four-substep boundary, preserving all six sampling schedules.
- Initial live radius 15 / corpse radius 18 expansion beside a wall now uses a
  bounded <=4-unit correction with a swept clear old-envelope path and explicit
  diagnostic. It never changes the locked corpse shape or selects a floor by XY.
- A long-fall test's fixed cutoff preceded the light's required quiet interval;
  the gate now waits for actual sleep within a bounded 20-second fixture. No
  physics threshold changed. Its kill now begins on a real elevated support.
- Query-fault test now explicitly drives the real sweep into its wall; the
  original trajectory did not reach that wall.
- The cap workload first opened a new empty-room run for every player, invoking
  the existing world reset. It now joins all players before killing them.

Performance is measured serially in `evidence/g4/performance-01.log`, Node
v24.19.0, Intel Xeon Platinum 8573C. Counts 1/3/24 activate 5/15/120 corpse/hand/
item masses. Active tick p50/p95/p99/worst milliseconds:
1: 1.374/2.427/4.170/9.026; 3: 4.035/8.784/12.532/23.135;
24: 28.546/39.288/50.402/65.974. The 24-active fixture exceeds the 16.667ms tick
budget on this host; this is bounded-work evidence, not Stage I capacity
certification. Maximum frames are 18,578 / 54,893 / 95,576 bytes; total peak
snapshot payloads imply 0.372 / 1.098 / 8.793 MB/client/s at nominal 20Hz, excluding
framing and other traffic. Sleeping updates are zero. The largest record is
18,907 bytes. Query counts and sleeping percentiles are included in the raw log.
No collision/unsupported motion was removed to improve these numbers.

G4 complete; commit, publish and verify remote before G5.
