# Shared intelligence maintenance map

Runtime source is `dev/ai_src/`, concatenated by `build_ai.sh` into `ai.js`.
`20_senses.js` is the sensor/identity boundary; `22_intelligence.js` contains bounded shared tools; `25_light.js` turns visible beam observations into anonymous regions or directly observed emitter evidence. `50_hound.js` and `60_smiler.js` own interpretation/actions. `90_engine.js` owns ordering, lifecycle and scheduling. `dev/sim_glue.js` carries explicit death/respawn/leave/reset invalidation.

A sound may carry private transport `src` only into `hearEvent`/`identifySound`. The returned observation never carries an unobserved identity, exact original origin or unobserved velocity. Do not restore `ox`/`oy`, create a player record from anonymous hearing, or use same hidden ID to boost hearing. Identified sound requires a current visual sample and a uniquely visible physical source. Current implementation is deliberately conservative: it does not infer identity from a long unsighted sound trail.

The common score is evidence quality, not a universal command. Species target formulas and commitment/canon triggers decide actions; anonymous sound/lead ranking picks among admissible evidence. Debug displays both evidence-quality and species-target scores to avoid conflating them.

Habit evidence is six short observations per identity. Record only sampled visible movement crossing a cell with a 1.5 s spacing; repeat key is 192 px cell plus cardinal heading. Three repeats within 30 s permit a 12% bonus only on geometrically valid search candidates near that observed region. Hypotheses are fallible; no true hidden route is queried. TTL and encounter end retire them. No account history, no cross-life memory, no difficulty tiers.

Caps: 16 identified records/entity; 4 typed entries/record; 8 sound observations (25 s); 6 anonymous leads (45 s max, earlier confidence decay); 128 visited cells (60 s); 6 checked Hound hypotheses (8 s); 6 habit observations/identity (30 s); 3 active habit hypotheses/entity; 70 possible common evidence candidates, 12 debug candidates. Identified records expire after 120 s with no sight/identified sound. Smiler attention is tied to those records; brief history is not account data. Shared caches follow connected players, invalidate on forget/reset; obsolete emitter history is deleted. Empty `mem.others` is a legacy unused map (no writers). Capture variant history remains six per species and kill sites twelve, as before.

System-only permitted truth: collision/contact/capture feasibility, lifecycle cleanup, LOD distance scheduling, world light propagation, and existing boolean placement-fairness rejection. None supplies a hidden chase destination. Paired-world tests hold physical/system conditions equivalent where needed.

RNG: a simulation seed is chosen once (explicit seed for deterministic tests; crypto for normal sessions). Entity identity is stable numeric ID, optionally specified by test/admin spawn. FNV-derived streams are tagged personality/behavior/search/perception/schedule. Rendering cannot draw from them. Shared director/world randomness is separate. Default IDs are monotonic; adding a future entity does not change existing IDs or streams. Comparing reorderings must preserve the entities' IDs.

Tests: `s_shared2f.js` F01–F23 plus `s_hound2e.js`, `parity_shared2f.js`, `movement_parity2f.js`, `perf_shared2f.js`, and baseline-preservation JSON. The original frozen percentage gates remain intact and intentionally not universally green. Never change tuning to chase their percentages.
