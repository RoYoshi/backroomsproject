# PART 3B ACCEPTANCE MATRIX

B-01 — Simulation invariance
PASS only if physical movement/network/AI/death truth is unchanged by 3B.

B-02 — Time-based camera smoothing
Camera Z trajectory is stable by real time across representative 30/60/120/144/240
render schedules and jitter. Render FPS cannot change simulation.

B-03 — Stair visual continuity
Ascending/descending/reversing the LONG ROOM stairs does not cause camera tread snaps
or obvious rendered-Z teleporting. Physical tread contacts remain unchanged.

B-04 — Ramp continuity
Ramp presentation follows continuous physical Z without added stepping.

B-05 — Fall depth cue
For +180→0 and 0→-96 drops, the destination surface approaches the local reference
scale monotonically/continuously enough to communicate descent. Human QA still judges feel.

B-06 — Landing response
Any landing settle is bounded, presentation-only, and cannot move aim/collision truth.

B-07 — Depth projection bounds
Relative layer scaling/parallax stays within declared clamps and cannot explode at
large Z differences.

B-08 — Camera fairness
Canonical admitted world footprint is unchanged across depth, aspect ratio, DPR,
quality and UI scale.

B-09 — Picking correctness
Projected screen picking resolves to the correct physical target; no through-slab
interaction and no Z ambiguity regression.

B-10 — Continuous Level 0 rooms
From hallways/adjacent rooms, ordinary Level 0 interior stays visible. No whole-room
blackout/reveal-on-entry behavior.

B-11 — NORTH crawl local cover
Outside viewer retains crawlspace cover/concealment; local player underneath gets
only the local necessary reveal. Two clients remain independent.

B-12 — LONG ROOM overlap cutaway
Lower local player gets only the necessary overlap-slab cutaway. Upper/lower hidden
peers/effects remain masked physically.

B-13 — Physical ceiling truth
Camera presentation may ignore continuous-interior ceilings, but collision, AI LOS,
light, sound, support and geometry queries remain identical.

B-14 — Multiplayer independence
Two clients at different Z/supports may have different camera-Z and cutaway states
without server/shared-state mutation.

B-15 — Reconnect/teleport/reset
Camera/render smoothing reinitializes safely after reconnect, respawn, admin move or
world reset; no long interpolation sweep.

B-16 — Aftermath
Corpses/hands/gear render on their true supports under the same depth projection and
never appear attached to the local camera elevation.

B-17 — Full/reduced truth equality
Quality changes presentation cost only; visibility/picking/concealment truth stays equal.

B-18 — Browser coverage
16:9, 16:10, ultrawide, high DPR/4K, zoom/NV and two-client representative cases pass.

B-19 — Retained certification
All seven Stage I named suites and Part 3A production gates remain passing/baseline
equivalent, with frozen flat parity intact.

B-20 — Human readability handoff
Provide explicit human tests for stairs, falling, crawlspace concealment, upper overlap,
camera comfort and "does this actually feel like depth?"

Any B-01…B-20 objective failure blocks engineering completion.
