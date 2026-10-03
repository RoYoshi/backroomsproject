# G1 — shared spatial death kernel

PASS: real dphys body/two hands/attacker use shared world_motion passive integration and canonical geometry sweeps. Physical Z is distinct from explicitly renamed dampingRatio. Passive mass profiles have no step assist; supported friction, gravity, first support, ceiling contacts and bounded safe fallback are explicit. Exactly four 1/240 substeps per tick. Same CFG and PLAN source bytes as accepted parent; no added RNG calls.

All eight variants: 1,680 substeps each, finite/clear body and hands, bounded reach, valid sleep; zero diagnostics on flat spatial control. Identical rerun and all six sampling schedules produce identical full spatial snapshots. Thin-slab fast fall and upward underside tests pass. Flat 240-scenario test passes; eight frozen death traces / 2,030 records match at zero tolerance. Capture adapter reads renamed damping only; frozen references untouched.

First raw test failure preserved: test fixture bounds were smaller than its authored floor. Fixed fixture bounds; no product gate weakened. Gear receives core XYZ plumbing here so the shared kernel remains coherent; independent ledge/equipment/beam/decal completion and evidence remain G2. Server active authority remains G3; full named physics25d activation remains G4.
