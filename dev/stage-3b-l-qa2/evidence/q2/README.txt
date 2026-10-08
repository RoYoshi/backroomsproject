Stage 3B-L QA2, Q2 checks (night vision infrared as a BR-RoLE light), on the Q2 tree:
  nv_qa2_medium.*   dev/stage-3b-l-qa2/nv_qa2.js --tiers medium (QA2 only; N1-N6 6/6).  The full run (with the QA1
                    parent's overlay for comparison, and N7 LOW / MEDIUM / HIGH) is in ../q3 on the final tree.
  nv_profile.*      dev/stage-3b-l-qa2/nv_profile_qa2.js (the sensor's reading, irFrom, against v23: P1-P3 3/3)
  s_ir.log          dev/tests/run.js s_ir.js (Part 2: infrared is outside AI perception, I1-I3 3/3)
  ir_net.log        dev/tests/ir_net.js (Part 2: infrared on the wire is presentation, N1-N4 4/4)
  ir_test.json      dev/tests/ir_test.py (Part 2: the infrared rules in the browser, R1-R9 all true) - QA2
  ir_test_parent.json   the same on the QA1 parent (all true; a first parent run failed R7 once - the two-page peer
                    timing - and passed on the rerun)
  br_role_unit.log, camera_3bn.log, camera_fairness.log   32/32, 7/7, 12/12
The picture's profile was iterated during Q2 (first: the reading's narrower profile - a visibly narrower beam than v23;
then v23's own fan coverage made smooth, for parity; then the fan steps blended and the cone's rim softened).  These
results are for the committed (last) version.
