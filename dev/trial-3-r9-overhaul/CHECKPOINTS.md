# Trial 3 R9–R17 — checkpoints

Branch `trial-3-r9-cognitive-ambush-overhaul`, from R8 `f378049a825e53eafc626a637b8c43397e4072f0` (owner-disapproved). Every checkpoint is
one logical change group, committed, pushed to this branch only, and read back from GitHub (`tools/verify_remote_r9.py`: the tip, its tree
and parent, every changed file's blob, the protected heads and every other remote head untouched). Each receipt is saved under
`evidence/` and committed with the next checkpoint (the last one in its own receipt commit). Trial 3 is **not owner-approved**.

| Checkpoint | Work | Commit | Receipt |
|---|---|---|---|
| R9 | audit of R8, the owner's exposed ambush reproduced (deterministic, real page), baseline tests / perf / audio / body; `R9_AUDIT.md`; no game change | `0c735ea` (tree `1a8c0d9`, parent `f378049`) | `evidence/r9/receipt_r9.json`: VERIFIED |
| R10 | the Skin-Stealer's heartbeat and sting only while this page sees it (`skin.sight.js`); the Hound/Smiler dread untouched; V01–V12 | `d4a0edc` (tree `805039a`, parent `0c735ea`) | `evidence/r10/receipt_r10.json`: VERIFIED |
| R11 | its mind (`ai.skin.mind.js`): who could see it by the screen's rules, events answered with their latency, always-attentive gaze and first-sight looks, hungry opportunism, the evidence log; C01–C15 | `a002a2d` (tree `bcf215c`, parent `d4a0edc`) | `evidence/r11/receipt_r11.json`: VERIFIED |
| R12 | its inference (`ai.skin.infer.js`): the ways a quarry could have gone as hypotheses with probabilities, anchored on a sighting, re-weighed by sounds, disproved by empty places; every guess labelled with its way and its rejected rivals with reasons; C20–C23, R12-A/B | `61f4128` (tree `f0890e0`, parent `a002a2d`) | `evidence/r12/receipt_r12.json`: VERIFIED |
| R13 | its cover (`ai.skin.cover.js`): covert ways audited against every view it knows of (or none), the withdrawal then the hidden run, caught on the way, honest open moves, ambush and the rush from cover, covert or open interceptions; R9-01 passes and joins `run.js`; C16–C19, C24–C27, R13-A; the real-page flankwatch after | (this commit) | `evidence/r13/receipt_r13.json` (with R14) |
