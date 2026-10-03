# Stage G G0 preflight

Accepted Stage F commit ba4fd2d63f440aa113722942bcb4861ba665e1f3; tree 1f33fdd0bfff9ed3268b4fd39648eb4112813199; immutable ZIP SHA-256 7d9176c3e66caab42683d22d9068c0fd3596d6fe7d8f1fd50eff9532e7ad5a5b. GitHub commit/tree verified; stage-g absent before creation. All 1,283 tracked files equal the supplied ZIP, with no extras. Stage F human QA PASS, per newer accepted authority.

G0 changes only evidence/reference files. No runtime migration. Retained real phys_test.js passes (including 240 scenarios); eight frozen death traces reproduce at zero tolerance. The existing physics25d exits 2 and explicitly reports Z25/Z26/Z27/Z28/Z31 NOT IMPLEMENTED. Its activation belongs to subsequent milestones.

## Maintained seams

- dphys.js: shared create/stepOnce/freeBody/advance/pose/PLAN/simulate, fixed 240 Hz planar body + two hands + attacker + light + hat. Hand z is damping, to rename explicitly. CFG and PLAN remain locked.
- death_srv.js: loads that exact kernel; fxFor/bodyFor are flat fallback adapters. Spatial active owner will use the same kernel from kill onward.
- server.js: aftStart stores client info/kill; aftTick waits on wall time for flat replay/corpse fallback. Fixed sim tick loop and Stage F world epoch/authority are available. Spatial path must reject replacement client fx/b results.
- dev/sim_glue.js: processEvents owns authoritative kill, dseq, onDeath; bodies keyed by owner, MAX_BODIES 24, TTL. Existing no-live-player early return must not prevent active spatial aftermath.
- dev/ai_src/40_capture.js + 90_engine.js: attacker commit lifecycle; physical ownership must be singular without species retuning.
- world_geometry.js: canonical immutable solids/supports/sweep/clearance/raycast. world_motion.js supplies numerical policy and profiles; living assisted steps must not be used by passive death masses.
- spatial_protocol.js/spatial_history.js/mp.js: reuse explicit epoch/life/version/history. Version 1 does not carry spatial corpse/gear; extend explicitly with mismatch tests.

Inherited failures remain outside Stage G: aggregate 151/162, F22/SM01, P08 UNKNOWN, historical L5 timing, fonts TLS and hardware GPU limits. Full Stage H presentation and Stage I certification are deferred.

Evidence: evidence/g0/parent.json, physics.log, physics25d-before.log, death-capture.log, death-parity.json and per-variant comparison logs. Fresh captures are reproducible local intermediates; original frozen reference bytes are unchanged.
