# Stage C compatibility evidence

Parent: locked Stage B, SHA-256 3068a745634e713b09b5ec08bbfd68db3f0d6540abda3b1fb5833f99446b0faf.

The retained Stage A gameplay record baseline is still unchanged: all 46 traces, 35,098 records, compare exactly. No record, RNG outcome or reference fixture was regenerated. Twelve motor traces have new `sourceSha256` metadata because move.js gained opt-in hooks; the inherited network-lifecycle sim_glue metadata difference remains. Exact differences are recorded in `dev/stage_c/results/parity.json` and independently checked against source bytes.

The Stage B full world export remains byte-identical: 6,912 map tiles, rooms/carves/columns/pillars, 90 lamps, 18 props, crawl geometry, navigation cells/routes/query samples, and seeded generation/tick outputs. `levels/level0.js`, world.js, sim.js, all AI source/output, death/corpse/item modules, networking/interpolation modules, timing policy and production renderer bundle match the parent byte-for-byte.

Level 0 content hash: 5b07af1fe27222982b860d5ebc912c3894459fa65441d46e7f2d9eb7f278bc77.
Material profile hash: fdce5dd79317e0058e256d4dbcc4242237cf4fac3b4f6037c37c1afe2f31d069.

Intentional camera-only exception: canonical policy 1.18 -> 1.25. The existing normalized resize path consumes that one constant; camera scale is absent from physical inputs. No other baseline expectation was rewritten. Frozen Stage A/B verification scripts retain their historical source allowlists and old camera-specific expectations; run the current `dev/stage_c` tools for Stage C acceptance.

Six of 410 original files are intentionally modified; 404 are unchanged; no originals are deleted. New spatial paths are opt-in and exercised by the actual movement state machine in deterministic fixtures. The shipped Level 0 stays flat-compat.
