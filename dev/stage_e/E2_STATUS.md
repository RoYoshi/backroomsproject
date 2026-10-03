# E2 — Physical spatial routing

Node v25.9.0. E1 remote checkpoint:
`8770a2759f7727c3ff4704eed371493306e92490` (tree identical to local E1).

The graph now proves special links by driving `world_motion.js` with the actual
collider profile and caches those physical results. Ordinary edges and smoothing
queries use a shared swept-volume/support-interval trace; subpixel unsupported
gaps cannot disappear between sample points. Coplanar adjacent sheets generate
directed walk-seam edges. The existing A* remains the sole navigation planner.

Both Hound and Smiler envelopes physically ascend/descend the 15 real treads,
use the ramp, and fall onto the one-way drop landing. A complete stacked-floor
A* route was executed waypoint by waypoint through the real motion kernel.
Capability-gated crawl and swept vault cases pass; Smiler cannot crawl. Vault
speed still uses the species multiplier. Blocked headroom rejects traversal.

The top-tread/landing overlap was reproduced: at y=620 the physical footprint
still touches tread 15. The fix chooses a requested contextual support only if
both physical patches share a continuous boundary, both overlap the footprint,
their boundary heights match, and a current clearance-valid contact exists.
Only support identity changes; no XYZ relocation occurs. Unrelated upper-floor
patches fail this check. Interrupted motion keeps the current physical state.

Focused results: core 8/8, physical route/seam/crawl/vault/invariance 16/16,
retained Stage C core 21/21, retained Stage C adversarial 54/54. Raw outputs are
in `evidence/e2/`. These are physical navigation proofs, not yet a claim that
the real brains consume all spatial inputs; that integration remains E4.

E3 sensor boundaries remain outstanding. Stage F has not begun. No long
regression or browser run has started. Human gameplay QA remains pending.
