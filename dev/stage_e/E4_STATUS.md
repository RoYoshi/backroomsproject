# E4 — Real entity integration and hidden-elevation proof

Node v25.9.0. The original Hound/Smiler decision functions remain in use. Spatial
branches pass explicit observed/remembered goals into the original A*, preserve
route commitment and smoothing, and retain species turning/acceleration and
capability differences. Local geometry facades are bound to one actor or one
remembered pose; there is no mutable global floor and no highest-floor shortcut.

The movement kernel advances each entity exactly once per fixed 1/60 tick.
Traversal holds physical control even when a Smiler changes from investigating
to watching. Stairs, ramp, drop, vault, crawl, interruption, falling and waking
all use actual physical bodies. A partially interrupted corridor is resumed only
from current supported pose after a new shared-kernel physical proof. No pose is
reset. The top-tread / landing contextual seam remains protected.

A visible body on a connector can suggest its geometrically reachable exit as an
interception hypothesis. A visible unsupported body can suggest a landing below
it. These are route hypotheses, never additions to observed support knowledge.
Uncertain sound/light regions stay bounded; the planner may choose a reachable
candidate without labeling that choice as sensory certainty. Spatial LOD uses
observation age and passive sensing, not hidden player elevation/distance.

25 real-engine groups PASS. Both brains physically complete stair/ramp/drop
routes, with observed species state changes and no navGo or substitute AI. Smiler
continues watching/investigating where its canon calls for that; it is not forced
into a Hound chase. Both use physical vaults at their own speed; only Hound crawls.
Physical displacement, clearance, support history and one-kernel-tick cadence are
asserted. Slabs reject sight, gaze, contact and cross-story packs.

The paired anti-cheating suite compares complete enumerable entity state,
including all memory Maps/Sets and counted RNG streams, every tick. After an
identical legitimate sight history, counterfactual hidden player inputs vary Z,
floor, support, route, velocity and destination. Both species remain identical
for 900 ticks (15 s) each. A second paired fixture includes the real stair branch;
it remains identical for 1,173 ticks before legitimate reacquisition. Visible and
hidden camcorder IR off/on are also invariant. Positive controls diverge when
actual new visible evidence is supplied. Frozen historic traces are untouched.

Focused totals: entity 25, sensors 16, nav core 8, physical routing 16, retained
Stage C core 21 and adversarial 54, original flat evidence 10; all PASS. Snapshot
source strings for HOUND.snap / SMILER.snap are byte-identical to Stage D.
Raw results: evidence/e4/. Long full regressions remain E5.

An extra source recovery checkpoint was pushed before this milestone:
`46cfb25d310b076b34c230797764d00483c772d2`.
Its ZIP was locally verified. Automatic approval review blocked uploading full
source ZIPs to ChatGPT Library, requiring explicit end-user authorization for
that destination despite verification that it is the same owned destination as
E1–E3. Source checkpoints continue on the already authorized GitHub branch;
subsequent archive bytes/checksums/CRC verification are retained locally pending
that authorization. No alternate Library path or upload mechanism bypasses it.

Stage F has not begun. Level 0, client render/network payloads and fixed timing
policy remain unchanged. Full regression, startup banner and final package/report
verification remain E5.
