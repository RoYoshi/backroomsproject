# THE FAR BACKROOMS — 2.5D Stage G report

**2.5D STAGE G ENGINEERING COMPLETE — HUMAN QA PENDING**

Final verified remote commit: `7fb4dafef92040571209403358e536ccb1105509`.

Final verified source tree: `eee7f43a74aeb4d0e7ef38effdfc7516eee5e8cf`.

Branch: `stage-g`. Publication receipt is external to avoid self-referential Git/ZIP hashes.

This report's released copy records the final verified SHA after publication;
the exact committed source cannot include its own hash. The ZIP separates the
exact Git source folder from finalized publication reports. Verification, ZIP
SHA-256 and final source identity are external to the commit/archive they name.

Accepted Stage F parent: `ba4fd2d63f440aa113722942bcb4861ba665e1f3`.
Accepted tree: `1f33fdd0bfff9ed3268b4fd39648eb4112813199`.
Accepted immutable ZIP SHA-256:
`7d9176c3e66caab42683d22d9068c0fd3596d6fe7d8f1fd50eff9532e7ad5a5b`.
All 1,283 parent files were verified against that exact tree before runtime work.
Stage F human QA is PASS under ACCEPTED_STAGE_F_AUTHORITY.md; its older pending/
not-authorized wording is superseded. Implementation branch is `stage-g` from
that exact parent. Main was not modified or merged. **Stage H begun: NO.**

Stage G extends the existing shared death solver into physical XYZ and gives
spatial kills one server-owned active aftermath. It retains one rounded body,
two independent circular hands, existing light/hat rules, all eight deterministic
plans and their authored tuning. No limbs, humanoid ragdoll, new variants,
dismemberment, backpack detachment, replacement transport/player motor or AI
canon retuning is included. CFG/PLAN, species sources and frozen references are
unchanged. Full presentation and whole-project certification remain later work.

| Acceptance | Disposition | Evidence |
|---|---|---|
| Z25 | PASS | Eight variants × seven geometries; real kernel/geometry, XYZ constraints and sample schedules |
| Z26, G completion | PASS | Canonical kill, singular attacker ownership, immediate corpse, disconnect, active/settled joins |
| Z27, G completion | PASS | Shared replay, stale/duplicate client replacements rejected, life/death isolation and existing cap/TTL |
| Z28 | PASS | Stable ledges, independent gear support, reachable hands, physical beam/face/decal/trail records |
| Z31 | PASS | Zero-live-player continuation beyond plan end, valid sleep, no sleeping update work, same-object wake |

`dev/tests/physics25d.js` now executes real shared-kernel, simulation and WebSocket
tests for the original matrix rows. It passes 5/5 both in the working source and
a fresh ZIP extraction in a path containing spaces. No placeholder/pass-through
replacement or simplified fake death state machine is used.

| Variant | Spatial cases passed | Still awake at eight-second sample |
|---|---:|---|
| Hound A | 7/7 | ramp, ledge |
| Hound B | 7/7 | ramp |
| Hound C | 7/7 | ramp, ledge |
| Hound D | 7/7 | ramp |
| Smiler A | 7/7 | ramp |
| Smiler B | 7/7 | ramp |
| Smiler C | 7/7 | ramp |
| Smiler D | 7/7 | ramp |

Each variant covers flat, stairs, ramp, wall, underside, ledge and stacked slabs.
Awake unsupported constrained hands are retained rather than forced asleep.
All cases check finite state, true clearance, bounded reach and no unsupported
sleep every tick. Four Hound ramp cases retain bounded safe-fallback diagnostics;
raw values and limits are disclosed in PHYSICS.md. Negligible overlap on both
sides of tolerance and symmetric thin support both fall. A fast fall hits the
first slab; upward impulses respect undersides. Translating all geometry in Z
and canonicalizing permuted stable-ID input preserve relative outcomes.

At kill the server freezes epoch, victim/life/death sequence, plan/version/seed,
physical victim/attacker and equipment, and immutable geometry revision/hash.
The actual death kernel advances four 1/240 substeps per 1/60 gameplay tick.
Attacker ownership is singular and hands back actual XYZ/support. Client corpse,
FX, ACK and completion records cannot replace spatial state. The existing owner
map, cap 24 and TTL remain; 25 deaths retain 24 records. A later life replaces
only that owner's older death. No new transport or identity system was added.

Real WebSocket evidence shows one canonical event and corpse, independent gear,
continued physics after victim disconnect, and coherent active/settled late
joins. Four disconnect phases and four subsequent join samples each pass through
the real simulation/protocol. Active joins restore bounded current kernel/RNG
state with exact forward continuation; sleeping joins need no replay. Common
history uses the actual objects and rejects stale identities/revisions. Protocol
version 2 and spatial-aftermath-v1 are explicit; older spatial clients reject.

The canonical Z20000 platform death remains airborne after its authored sequence,
continues with zero players and settles at 15.5167 simulation seconds. Sleeping
states produce zero further geometry queries or body revisions. Support removal
wakes the same physical objects. Explicit existing room disposal remains allowed.
Gear inherits real attachment motion and can land below its body; beam and
surface-local decals/trails follow actual contacts and never choose a floor by XY.

Flat Level 0 is preserved: 46 frozen traces / 35,098 records match at zero tolerance,
including all eight death traces, and the map is byte-identical. Generated builds
reproduce exactly. Retained C/E/F spatial/network gates and D view independence
pass. Legacy aggregate stays 151/162 with exactly the accepted 11 failure names;
shared remains inherited F22 at 22/23 and P08 remains UNKNOWN. The first NZ1
network timing failure is preserved; an isolated unchanged full rerun passes
11/11. All other retained suites and serial performance workloads pass. See
TEST_SUMMARY and BASELINE_FAILURES for counts and investigation details.

Actual Chromium executes the served modules, restores bounded snapshots and
agrees with Node within the existing 1e-7 geometry epsilon (observed maximum
4.973799150320701e-14), with exact support/mode/sleep. Same-runtime spatial and
frozen parity remain exact. Flat game boot/entry has no local script/resource
errors. External Google Fonts TLS failure and lack of hardware-GPU certification
remain explicit. No full Stage H rendering is claimed.

Stage G performance, Node v24.19.0 / Intel Xeon Platinum 8573C, measured serially:

| Active aftermaths | Awake corpse/hand/item masses | Tick p50 / p95 / p99 / worst (ms) | Peak total snapshot bytes | Peak frame bytes |
|---:|---:|---|---:|---:|
| 1 | 5 | 1.374 / 2.427 / 4.170 / 9.026 | 18578 | 18578 |
| 3 | 15 | 4.035 / 8.784 / 12.532 / 23.135 | 54893 | 54893 |
| 24 | 120 | 28.546 / 39.288 / 50.402 / 65.974 | 439626 | 95576 |

The 24-active case exceeds a 16.667ms tick budget on this host. Peak nominal
20Hz payload costs are 0.372 / 1.098 / 8.793 MB/client/s for 1/3/24 active deaths,
excluding framing and other game traffic. Sleeping updates and query deltas are
zero. The largest record measured is 18,907 bytes; chunks stay below 100,000.
Detailed geometry/contact query counts and sleeping percentiles are in the raw
performance log. This is bounded Stage G evidence, **not Stage I capacity
certification**; no collision or unsupported activity was skipped for speed.

G0–G4 and recovery source/evidence were committed, pushed and verified before
continuation; the final G5 receipt records final publication. All raw failing
runs remain. Final packaging checks every source blob and file mode against the
published Git tree, verifies ZIP integrity and fresh extraction, and provides
the ZIP SHA-256. The accompanying changed-file ledger enumerates the exact diff
from the accepted parent. Human Stage G QA remains distinct and pending; use
25D_STAGE_G_HUMAN_QA.md. Work stops at G5. No merge and no Stage H follow-on.
