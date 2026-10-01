# Stage 2F test summary

Engineering complete; human Part 2 final QA pending. Browser QA blocked. No gameplay rebalance.

- Verified checkpoint saved before continuation (see separate checkpoint report).
- Fresh extracted full suite: **152/161**. Nine historical assertions retained as failures; see report §24 for old/new values and causes.
- Stage 2F: **23/23**. Stage 2E Hound: **17/17**.
- Fixed-input species parity: **7,680 identical tick pairs**.
- Real movement parity: **4,800 identical tick pairs**, eight modes.
- Network: audit_net **17/17**, audit_net2 **11/11**, IR **4/4**, live **17/17**.
- Physical death **53/53**; interpolation **3/3**; navigation benchmark complete.
- Performance: nine workloads / three seeds each pass avg/p99 gates. Final shared-run largest step **12.70 ms**; earlier concurrent run **153.36 ms**, retained as a profiling limitation. Habit workload reaches **48 observations / 3 hypotheses per entity**.
- CUA browser: **BLOCKED — net::ERR_BLOCKED_BY_CLIENT**. No browser/admin/visual/audio pass claimed.

The RNG-only counterfactual reproduces P01, P07, SM01 and NV09 without changing old evidence rules. Other historical discrepancies follow explicit anonymous-attribution semantics and fixture eligibility changes; thresholds remain intact. No benchmark percentage establishes human fairness.

Run: `node server.js 8000`. Tests: `npm test` (documented nonzero exit), `npm run test:shared` (23 checks), `npm run test:hound` (17 checks). Development builds: `bash dev/build_ai.sh`, `bash dev/build_sim.sh`, `bash dev/build_ents.sh`. No original workspace path required.

See STAGE_2F_REPORT.md for precise architecture, bounds, test controls, modified files and known limits. Raw evidence includes earlier failed/interrupted experiments as well as final results; use the log index.

STAGE 2F IMPLEMENTATION COMPLETE — PART 2 FINAL QA PENDING
