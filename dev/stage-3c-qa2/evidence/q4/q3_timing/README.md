# probe_q3 "as a run begins ... gone after about 6 s": QA1 and QA2, three runs each (interleaved, same machine)

QA1 = the original dev/stage-3c-qa1/probe_q3.js on the QA1 tree (git archive of 5f30e28); QA2 = dev/stage-3c-qa2/regress/probe_q3.js (the adapted copy: its helpers pass the boot gate) on the QA2 working tree.

| run | result | reveal still shown when the probe looks (7.3 s after the HUD appears) | its class then |
|---|---|---|---|
| qa1_1.json | FAIL | True | hud-reveal entry |
| qa1_2.json | PASS | False | hud-reveal entry |
| qa1_3.json | FAIL | True | hud-reveal entry |
| qa2_1.json | PASS | False | hud-reveal entry |
| qa2_2.json | FAIL | True | hud-reveal entry |
| qa2_3.json | FAIL | True | hud-reveal entry |

The reveal is three chained timers (0.45 s + 3.8 s + 1.3 s = 5.55 s). Under the software renderer each fires up to a frame late (frames of 300-700 ms), so at 7.3 s the reveal is sometimes still in its 1.3 s fade (class without "in") - on QA1 as on QA2. Every other check of probe_q3 passes in every run.
