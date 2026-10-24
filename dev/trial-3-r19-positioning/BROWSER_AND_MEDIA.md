# Trial 3 R19, S track - real browser and media

Trial 3 is **not owner-approved**.  Every page here is headless Chromium on SwiftShader (software rendering) on this session's two-CPU
machine, served by the tree's own `server.js` from its generated build through the test-only `qa_server.js` (R9-R18's browser tools),
with a synthetic admin passcode set for the run only.  A page is moved only by its own keys and its own mouse; a Skin-Stealer is
**placed** with a hunger by `qa_server.js` exactly as dev/tests place one, and never steered.  What is judged is what the page received
(the creature's place each snapshot, whether the page's view rays reach it) and the admin debug the server sends (read only to report
why).  The pages drew 1.4-2.5 frames a second (a page's own movement is frame-limited: a held sprint covers 115-150 px/s, so no sprint
race can be judged on a page - the race is judged on the server: C26, PR05, SR03, the scenes).  Nothing else ran on the machine.  R18,
this branch (S), the N branch and the combined tree (C) ran in one session, the same scenes, one after the other.

## The S track's own scenes (`tools/r19_browser.js`; `evidence/S0/browser/r19_R18*`, `evidence/S3/browser/r19_S*`)

| scene | R18 (two batches, 6 tries) | S (3 tries) | C (3 tries) |
|---|---|---|---|
| **Scene B** - standing lit in the long hall, looking at it 450 px off, it very hungry (.85): did it vanish (3 s or more out of the page's view before it was within 200 px)? | vanished **1/6** (5.7 s out of view on a way round, within 200 px at 11.5 s; the other five came on openly, within 200 px at 2.0-2.3 s) | **0/3**, within 200 px at 2.0-2.1 s; one try's record: "its way round P1 would take 10.2 s (against 1.7 s coming on; it may spend 6.2 s more): approach" | 0/3, within 200 px at 1.8-2.0 s, the same record once |
| **the junction** - standing lit where a side passage leaves the hall, it 600 px down the other hall (.9): how far towards the side passage it went while still 400 px or more off | 0 / 0 / 0 px, 0 / 0 / 0 px - straight at them | **60 / 61 / 61 px**, each with its record "contest: it heads for P1's way out (90 deg off straight beyond them)"; within 200 px at 2.3-2.4 s (R18: 2.36-2.54 s) | 60 / 59 / 61 px, the same record |

In the real game, as on the server: at .85 it no longer disappears round the block from somebody standing in the lit hall (R18 did,
in one of six tries here and 5 of 8 seeded runs on the server), and at the junction it angles for the side way out before closing.

## The owner's thirteen threat scenes and the focused scenes (R16g's `r16g_campaign.js --part threat|focused`, unchanged)

Single tries each in the first pass; the scenes that failed on S or C but not on R18 were run three more times on R18, S and C
(`evidence/S3/browser/f56/`, `s69/`), those that failed on N but not on R18 three more times on R18 and N (the N branch's
`evidence/N2/browser/f2/`, `s5/`):

| scene | R18 | S | N | C |
|---|---|---|---|---|
| S1 walking away (within 200 px within 9 s of walking off) | fail (9.5 s) | fail (10.3 s) | fail (11.4 s) | fail (9.7 s) |
| S2 sprinting at once | not judged (the page could not sprint) | not judged | not judged | not judged |
| S3 hesitating | fail | pass | fail | pass |
| S4 circling | fail | pass | fail | pass |
| **S5 reversing** (R18 and N: 4 tries) | 3/4 | pass | 0/4 (on the server, 24 seeds: every tree answers 24/24, to the millisecond alike - the N branch's BROWSER_AND_MEDIA) | pass |
| **S6 hiding behind a wall** (4 tries: first pass + 3) | **3/4** | **1/4** | pass | 2/4 |
| S7 another way out | pass | pass | pass | pass |
| S8 unsuspecting prey | pass | pass | pass | pass |
| **S9 a sound** (4 tries) | 4/4 | 4/4 | pass | 2/4 |
| S10 a failed spring | pass | pass | pass | pass |
| S11 fed, near somebody harmless | pass | pass | pass | pass |
| S12 two people split up | fail | fail | pass | fail |
| S13 a long hunt | not judged (caught first) | not judged | not judged | not judged |
| **total, first pass** | **7 of 13** | **8 of 13** | 7 of 13 | 7 of 13 |
| F1 a sound behind it, F3 seen while roaming, F4 hunger | pass | pass | pass | pass |
| **F2 movement at the edge of its view** (R18 and N: 4 tries) | 2/4 | pass | 1/4 | pass |
| **F5 circled** (4 tries) | 4/4 | 4/4 | pass | 3/4 |
| **F6 a feint** (4 tries) | 2/4 | 1/4 | pass | 2/4 |
| F7 two people | fail | fail | fail | fail |
| **total, first pass** | 6 of 7 | 5 of 7 | 5 of 7 | 4 of 7 |

How to read it: these real-time scenes vary from try to try on every tree - R18 itself passed S6 3 times in 4 and F6 twice; R18's own
report recorded 9 of 13 and 4 of 7 for these parts at R18.  The repeated scenes show no tree failing where the others pass reliably - S5 on N (0/4 against R18's 3/4) looked like one, and on the
server, without the page, R18, S, N and the combined tree give the same answer in every one of 24 seeds.
S6 on S (1/4) fails the same way R18 failed it once ("roam > flank > leave": the page, moving a frame at a time, goes into hiding while
the creature is still on its way round); the same scene on the server, without a page, is R18's line for line on S - 12 seeds, 8 caught
on both, no departure on either (`tools/s6_server.js`, `evidence/S3/browser/s6_server_R18_S_N_C.txt`; N and the combined tree too).  F6 (a feint answered late, then
answered) is a timing window both R18 and S miss either side of (R18 "0 ms", S "1300 ms").  Every pass and failure, with its numbers, is
in the raw records.

Throughout, the creature never ran faster than its run (270 px/s on every tree, the engine's prop crossings excepted), and no page error.

## Media

No video was recorded: headless SwiftShader at 1.4-2.5 frames a second shows little of how the movement feels, and the owner's own play
(`HUMAN_QA.md`) is the judge of that.  The real-page evidence is the records above (every snapshot each page received).
