Stage 3B-L QA2, Q3 checks on the final code: Q3c 1972506 (the Q3 commit only adds documents, evidence and development tools
on top of it).  The human-QA scenes and the A/B against the parent / the Q2-vs-Q1 A/B were captured on Q3b 2b58535, which
draws the same pixels (ab_q3c_vs_q3b: 0 pixels differ in four frames).  Software rendering only (SwiftShader, 2 CPUs): no
real-GPU numbers.

  los_tests.*          dev/stage-3b-l-qa2/los_qa2_tests.js (node, the game's own LOS code against the QA1 parent's): L01-L12
  receivers.*          dev/stage-3b-l-qa2/receivers_qa2.js (browser; QA1's F1-F3 / C1-C2 and the corner checks K1-K5, K3-K5 also
                       on the parent; the JSON holds the results, the log the figures)
  nv.*                 dev/stage-3b-l-qa2/nv_qa2.js (browser; N1-N7, LOW / MEDIUM / HIGH, the parent's infrared measured the
                       same way)
  nv_profile.*         dev/stage-3b-l-qa2/nv_profile_qa2.js (the sensor's reading against v23: P1-P3)
  occlusion.*          dev/stage-3b-l-qa2/occlusion_qa2.js (every 7th lamp's cached light against the geometry): 5/5
  occlusion_q2build.*  the same audit on the Q2 build (270b603): O1 fails, 329 texels at 22 of 25 lamps - the receiver fault
                       (a face's light in a turned-away face's share across a deep mitre) that Q3b fixed
  ab_parent.*, ab_parent_diff_*.png   dev/stage-3b-l-qa2/ab_qa2.js: the same frozen frames, QA2 vs the QA1 parent (NV off)
  ab_q2_vs_q1.*, ab_q2_vs_q1_diff_*.png   the same, the Q2 build (270b603: the infrared added) vs the Q1 build (c6e5278),
                       camcorder raised with night vision OFF: what the infrared commit changes with the sensor off
  perf_ab.*            dev/stage-3b-l-qa2/perf_ab_qa2.js: parent vs QA2, MEDIUM, interleaved runs, medians (2 runs each, 8 scenes)
  perf_ab_off4.*       the same, NV off, 4 runs each (4 scenes), every run's page frame and drawLight kept
  perf_hl_micro.*      dev/stage-3b-l-qa2/perf_hl_qa2.js: the two sight polygons per frame, parent vs QA2, interleaved
  scenes/              dev/stage-3b-l-qa2/scenes_qa2.js: the human-QA scenes A-H, the QA1 parent left, QA2 right
  br_role_unit.log     dev/br-role/test_br_role.js (32/32)
  camera_3bn.log, camera_fairness.log   dev/stage-3b-n/test_3bn.js (7/7), dev/tests/s_camera_fairness.js (12/12)
  s_ir.log, ir_net.log, ir_test.json    Part 2's infrared tests (unchanged files): I1-I3, N1-N4, R1-R9
  ir_test_first_run_crash.err           ir_test.py's first run on the final code: a missing sample (timing) before any
                                        verdict; the rerun (ir_test.json) passed R1-R9
  ab_q3c_vs_q3b.*      ab_qa2.js, Q3c against Q3b: the receivers' clip grouping changes no pixel
  los_l12_on_q3a.log   L12's measurement with Q3a's clip: 96.70 % (the convex-corner notch Q3b removed; final 100.00 %)
  corner_light_A2.txt  BR-RoLE's light at scene A2's convex corner, the Q2 build vs the final code: the receiver fault Q3b fixed
  remote_q3a.json, remote_q3b.json, remote_q3c.json   dev/stage-3b-l-qa2/verify_remote_qa2.py after each correction push
