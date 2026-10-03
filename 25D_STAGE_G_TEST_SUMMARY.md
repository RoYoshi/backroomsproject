# Stage G test summary

All five real `physics25d` gates PASS, including all 56 variant/geometry cases.
The same named suite also passes after clean extraction to a path containing
spaces. Tested runtime: Node v24.19.0; browser: Chromium 151.0.7922.34 / SwiftShader.

| Retained suite | Final result | Count |
|---|---|---:|
| npm-test | FAIL | 151/162 |
| hound | PASS | 18/18 |
| shared | FAIL | 22/23 |
| humanqa | PASS | 6/6 |
| fps | PASS | 10/10 |
| camera | PASS | 12/12 |
| entity-look | PASS | 4/4 |
| physics | PASS | 53/53 |
| interpolation | PASS | 3/3 |
| navigation | PASS | descriptive benchmark |
| audit-net | PASS | 17/17 |
| audit-net2 | PASS | 11/11 |
| live | PASS | 17/17 |
| ir-net | PASS | 4/4 |
| perf-hound | PASS | 15/15 |
| perf-shared | PASS | 27/27 |
| perf-smiler | PASS | 3/3 |
| perf-light | PASS | 1/1 |

Aggregate and shared failures match accepted Stage F names exactly. The first
audit-net2 run was 10/11 (NZ1) while independent work overlapped; a complete
isolated run passes 11/11 with unchanged source and thresholds. Both raw logs
remain. `evidence/g5/baseline-comparison.json` records the exact comparison.
The phys_test summary is 53 grouped checks covering 240 scenarios. Performance
counts refer to each suite's declared workloads, not invented assertion totals.

| Stage G gate | Real evidence |
|---|---|
| Z25 PASS | Eight variants × seven geometries; fixed substeps, sample schedules, clearance, reach, near-wall envelope |
| Z26 PASS | Real server death/disconnect and active/settled joins; bounded restore; four disconnect phases |
| Z27 PASS | Client replacements/duplicates rejected; exact independent kernel; life/epoch/revision separation |
| Z28 PASS | Upper body/lower gear, ledge stability, reachable hands, actual beam/face/trail records |
| Z31 PASS | Canonical Z20000 fall beyond plan end with zero players; valid sleep, no idle queries/revisions, same-object wake |

Stage C motion/adversarial/schedules/camera, Stage E navigation/perception,
Stage D view/independence and Stage F Z20–Z24 all pass. All 46 frozen traces /
35,098 records match at zero tolerance and Level 0 map bytes match. Builds
reproduce in place and after clean extraction. HTTP bytes match disk for all
changed public modules; server-only modules remain private. Actual browser
replay stays within the locked geometry epsilon with exact discrete states;
flat Level 0 boots and enters with no local script/resource errors.

External Google Fonts TLS remains an explicit failure. No hardware-GPU,
Stage H presentation or Stage I capacity certification is claimed. Stage G's
24-active physical workload exceeds the measured 60Hz budget; see PHYSICS,
AFTERMATH and the final report. Human QA is pending separately.
