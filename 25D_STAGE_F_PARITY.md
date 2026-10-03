# Stage F deterministic and preservation evidence

PASS: 46 frozen traces, 35,098 records, numerical tolerance zero. Groups: actual
move.js motor, real AI, shared death simulator, navigation and network fixtures.
Motor compares 15/30/60/120/144/240/360 FPS and jitter schedules. `run_parity.py`
writes only separate captures and checks the frozen files' hashes before/after.
`dev/stage_f/evidence/f5/parity/result.json` contains per-trace results.
Level 0 export is byte-identical to the frozen canonical map. Frozen Stage A trace
and dev/baselines files also match the supplied immutable Stage E ZIP exactly.

Record equality is distinct from compressed-file equality: source/runtime metadata
can differ. No frozen baseline was regenerated to accept Stage F changes. The new
wire tests explicitly test spatial fields and are not compared with old flat-only
packet schemas. The retained flat packet/history/lifecycle records remain equal.

No recovery modification to move.js, world.js, ai.js, world_motion.js, species
sources, camera/timing policy or death solver. The complete Stage F diff has narrow
sim_glue/sim.js, mp.js, server.js, index.html seams and the new spatial authority,
protocol/history modules. Generated AI/sim/ents rebuild byte-identically in a fresh
path with spaces. See exact changed-file ledger and package verification hashes.
