# Part 3B test summary

PART 3B — MOVEMENT, CAMERA & DEPTH PRESENTATION ENGINEERING COMPLETE — HUMAN QA PENDING

The corrected top-down presentation (HQ1 `ae7157cc1fd246e72dc809b71c0c34acb54f0ca3`) was validated in HQ2 (`1a08f3c2cd78a033e8fb81a76d20859666c9ccb4`) with no runtime change since HQ1.

- B-01..B-19 and HQ-01..HQ-02: PASS. B-20 handoff complete; human decision PENDING.
- HQ1 focused: deterministic PASS (top-down lock, exact footprints, four-direction strips, 1.0 local anchor, exact band picking, smoothed stair/fall cue, local cutaway). Production browser PASS: six views change only band pixels under a 180-unit camera-Z change, and a two-client relative-scale check passes.
- Three Part 3B presentation suites and eight Part 3A production suites: PASS, including 1,170 independent ray comparisons, 195 candidate hulls and 12 aftermath scenarios.
- Seven named Stage I suites: PASS (`hq2/named-01`).
- Eighteen historical suites: exact accepted baseline equivalence. Aggregate remains 151/162, shared remains 22/23 (F22) and P08 remains UNKNOWN; these are not relabeled as passes. The first attempt's perf-light host-timing outlier is preserved.
- Frozen flat parity: 46 traces / 35,098 records. HQ1 is byte-identical to HQ0 on host Node v22.22.2; 43 traces are identical to the v24.19.0 references at zero tolerance, and 3 differ by 1 ULP, within the documented cross-engine tolerance 0.00001. The map is byte-identical. The zero-tolerance failure is preserved.
- Flat browser parity (repaired clock start), production display matrix (8 cases, zero hidden pixels), resets, NORTH/LONG concealment (repaired in-tunnel aim), twelve-room readability, aftermath, multiplayer gameplay, performance, served packages and redirect: PASS.

Historical and raw failures, logs, screenshots and timings remain under `dev/part3b/evidence`. A later successful attempt never replaces a preserved failing one.
