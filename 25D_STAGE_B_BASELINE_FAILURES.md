# Stage B baseline failure ledger

Aggregate remains **151/162**, with the same 11 failed assertion names as Stage A. Original tests and thresholds are unchanged. Raw failure details are retained, including F22's changed first source-hash mismatch.

| Finding | Classification / Stage B observation |
|---|---|
| P01 | EXPECTED BASELINE FAILURE — Sample-sensitive visible-light saturation/ordering gate; same numbers on selected rerun. |
| P07 | EXPECTED BASELINE FAILURE — Historical fixture can kill its nearby subject before the breath event. Current close/far sample still 0/0. |
| P08 | FAIL — UNKNOWN / NEEDS INVESTIGATION; reproduced inherited fixture, not excused or retuned. |
| H07 | EXPECTED BASELINE FAILURE — Anonymous investigation changes named-state coverage; current sample misses ALERT (12/13). |
| SM01 | EXPECTED BASELINE FAILURE — Retained 6/8 lit chase sample vs 80% gate; dark sample remains 0/8 chased. |
| NV09 | EXPECTED BASELINE FAILURE — All 10 runners captured; 5.7 average contact ticks exceeds old gate. No navigation retune. |
| C1 | EXPECTED BASELINE FAILURE — Old HUNTING/SEARCHING state expectation; observed CURIOUS with remembered confidence .84. |
| C4 | EXPECTED BASELINE FAILURE — Old named reacquisition from an anonymous emitter is incompatible with current attribution semantics. |
| C5 | EXPECTED BASELINE FAILURE — Retained legacy escape-rate gate, only 3 eligible starts; no human fairness inference. |
| C18 | EXPECTED BASELINE FAILURE — Retained legacy search eligibility/decay fixture; current run has no eligible escapes. |
| F22 | EXPECTED BASELINE FAILURE — obsolete exact-source guard. Stage A first mismatch mp.js; Stage B first mismatch world.js due canonical data integration. Same assertion remains red; preserved species data and migration allowlist/traces provide independent evidence. |
| L5c | FLAKY BASELINE — Stage A 16/17 then 17/17; Stage B live 17/17. Historical race remains documented. |
| B-01 | PASS — PRE-EXISTING INTEGRATION DEFECT FIXED IN STAGE B; real routes 200 and application bindings verified. |
| Browser | BLOCKED — actual Chromium launch unavailable; no browser T8 or visual pass claimed. |
| Sandbox | BLOCKED on initial sandbox attempt, resolved for preflight/regression by permitted local execution; no product failure inferred. |

The Stage A ledger remains unchanged in `25D_STAGE_A_BASELINE_FAILURES.md`. Current logs: `dev/stage_b/results/regression/`. P08 is separate from expected failures. No human fairness inference follows from any benchmark or percentage gate.
