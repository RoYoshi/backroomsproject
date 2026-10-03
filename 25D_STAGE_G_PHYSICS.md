# Stage G physical model and evidence

The existing `dphys.js` remains the shared death kernel. Its CFG and PLAN tables
are byte-identical to accepted Stage F. All eight Hound/Smiler A–D variants,
resistance/impact/release sequencing and deterministic plan seeds are retained.
The historical hand `z` damping field is renamed `dampingRatio`; world `z` is
physical elevation. `dev/stage_a/capture_death.js` reads the renamed damping
field. Frozen trace bytes and comparison tolerances are unchanged.

Gameplay remains 60 Hz. Each active aftermath tick invokes exactly four 240 Hz
physical substeps. No extra AI decisions, stamina, attack/watchdog ticks or
geometry-driven RNG calls were added. A fully sleeping aftermath stops at a
four-substep boundary. Identical reruns and 30/60/120/144/240/360 sample schedules
produce exact complete snapshots in the same runtime. A saved active state
restores its control phase and RNG cursor and continues exactly for 240 ticks.

| Mass | Radius | Height | Z convention |
|---|---:|---:|---|
| Rounded body | 18 | 18 | Collider base |
| Each of two hands | 5 | 10 | Center, base = Z − 5 |
| Existing loose light/equipment | 7 | 14 | Center, base = Z − 7 |
| Existing hat | 11 | 4 | Center, base = Z − 2 |
| Canonical attacker | Existing actor envelope | Existing actor envelope | Collider base |

There are no visible limbs, new skeletons, ragdolls, variants, dismemberment or
backpack detachment. The body retains the locked profile. A living radius-15
body near a wall can require a small envelope correction at the death boundary:
the bounded search moves at most four units, verifies the old envelope's swept
path and the new envelope's clearance, and records PASSIVE_ENVELOPE_RESOLVE.
An impossible initial envelope is rejected explicitly; it never shrinks the
corpse or ignores geometry. New spatial content must provide room for the locked
death envelope, including narrow passages.

`world_motion.passive` calls the same canonical geometry sweep, clearance and
support queries used by the accepted spatial world. Gravity is 980; skin .05;
contact iteration cap eight. Corpse and items never call assisted step-up.
Friction uses actual contact normal and material friction only while supported.
Support searches are restricted to the mass's immediate physical Z interval.
A bounded contact polygon with exact circle/edge intersections tests stable
center-of-mass support. Negligible overlap and a symmetric .02-unit support tip
and fall while retaining complete slab collision. Faulted/ambiguous queries
retain safe nonpenetrating poses and bounded diagnostics.

Each hand is an independent XYZ spring mass with a swept reach correction and
maximum reach 40. Bracing requires reachable geometry and contact. A hand cannot
brace on a distant floor, move through a slab, become detached or sleep in air.
Held gear is swept from a safe point inside the body to its true attachment.
At release, gear retains attachment-point XYZ motion (including angular/hand
motion) plus the existing authored impulse. Lights and hats retain independent
support and sleep. Backpack behavior remains attached.

Sleep requires stable support, XYZ speed below .5, angular speed below .05 and
.5 seconds of quiet physical time. The animation deadline changes the phase; it
does not force sleep. A Z20000 platform death is still falling after the authored
sequence, continues with zero players and settles at 15.5167 seconds. Removing
support via an explicit geometry rebind wakes the same masses; a replacement
geometry intersecting them is rejected. This helper does not add destructible
world gameplay or a network geometry migration feature.

The 56-case matrix checks finite state, actual collider clearance, reach and no
unsupported sleep on every tick. Some ramp/ledge cases remain awake at eight
seconds because their hands are unsupported; this is retained physical activity,
not forced sleep. Four Hound ramp cases record bounded safe-fallback diagnostics
(4, 32, 4 and 5 retained records for A/B/C/D respectively); the tests continue to
require nonpenetration. Raw per-case outcomes remain authoritative.

Physical events are bounded at 64, decals at 32 and contact trails at 60. Decals
carry actual solid/face, point, normal, local basis/coordinates, geometry hash and
support only for a top face. A hit never stamps other floors sharing XY. Trails
break in flight and resume on real contact. Beam position/orientation follows the
actual light and clips its emitter against geometry. Stage H presentation is
not implemented here.

Evidence: `dev/stage_g/evidence/g4/physics25d-raw`, `properties-06.log`,
`initial-envelope-02.log`; final portable repetition under `evidence/g5/portable`.
Browser/Node numerical agreement uses existing geometry epsilon 1e-7; observed
maximum 4.973799150320701e-14 with exact support/mode/sleep agreement. Same-runtime
and frozen parity remain zero-tolerance. No numerical rounding was added.
