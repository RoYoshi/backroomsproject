# P3B4 preservation checkpoint

P3B3 is complete at `ca7a05e064b99f1ca96fcc4e3687e60537924e3b`, tree `ad1440ae76d9f9fbc36673c7fdc8e99a197a53c4`.

P3B4 is IN PROGRESS. No runtime changes have been made during recovery.

The first seven-suite run completed: world, navigation, perception, network, physics and performance passed. The view suite failed the H2 replicated-peer setup race; H3 and H4 passed. Complete failure evidence is retained in `evidence/p3b4/named-01`.

The narrow H2 harness repair waits for the actual post-teleport XYZ/support and preserves pixel results before the unchanged zero-pixel assertion. Its rerun has passed H2 and H3. Whole-view rerun and complete production validation are in progress; they are not declared complete here.

New production matrix/reset harnesses, serial validation and exact-source package helpers are preserved as work in progress. Remaining work: complete B-01..19 evidence, review/fix only demonstrated failures, record performance and acceptance, publish P3B4 completion, then run P3B5 clean extraction/final publication. Human QA remains pending. Main and Part 3C remain untouched.
