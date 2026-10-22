# Trial 3 cognitive predator refinement — before (R8) and after

R8 is `f378049`, the build you rejected; "after" is this branch's head (the final code: C7's fixes and the re-check's). The same scenario files ran on both (R8's
tree from `git archive f378049`); every line names its evidence. **Simulation** = the real server simulation (`dev/harness.js`), seeded,
measured from the tick the creature really has the evidence. **Real pages** = headless Chromium against a real server, pages moved by
their own keys and mouse; scripted, never dodging; pooled over every valid pass with n; "after" there pools the passes made after the
review (C7a's build and the final code: `evidence/c8_browser_pool.txt`). Nothing here is approved.

## "Incredibly passive"

| Moment | R8 | After |
|---|---|---|
| Hungry (.5–.62), watched from 450 px, the watcher looks away for 2.5 s now and then (C02, simulation, 18 runs) | backing out of sight, watching or leaving 68 % of its time (p50); in 12 look-aways it closed in 0 px (p50), moved at them within 0.8 s in 1 / 12; killed 6 / 18 | it keeps them in view (0 % backing off or leaving); in 13 look-aways it closed in 208 px (p50) and was moving at them within 0.8 s in 13 / 13, stopping within 0.4 s when their eyes came back (8 / 8); killed 18 / 18. A watcher who never looks away: 0 / 12 killed (both) |
| A bait round a corner, hungry (C04) | waits blind up to 11.7 s (10 / 10 over 4.5 s) | at most 4.2 s (0 / 11 over 4.5 s), ending at once on fresh evidence; a bait only where somebody following would come within 200 px (C08) |
| Stared down without a break (C22, .5 / .55, 120 s; C23) | goes after 7–17 s in C22's scene; elsewhere it held a spot in plain view up to 57 s (C23) | stands off at most about 8 s at a time (before the review's fix: 44–63 s still), may go round them or move once, then goes at 14–29 s; 3 / 12 got beside them unseen and killed. In three places at .5–.65 (C23) never more than 8.2 s still in their view (R8 up to 57 s, C7a up to 93 s) |
| Two people, one watching it, one walking off apart (C13, .55 / .7 / .9) | took the unaware one apart in 3 / 18 (the nearest, the watcher, otherwise) | took the better chance in 15 / 18, at most one switch, no effort lost; never springs at people together (C20: 0 / 24) |
| Real pages, "the page turns its back at 8 s" (B-C1) | 4 kills in 7 valid (approach / retreat / leave in the others) | **9 / 9**: a stand-off, then it closes on the look-away and springs (2–3 s into it, or just after the eyes came back) |

## "Not really smart"

| Moment | R8 | After |
|---|---|---|
| A glimpse, then out of sight round a corner (C05, simulation) | a guess at once (8 / 8) - R8 already did | the same (8 / 8), and the same until its senses differ (two hidden routes, 8 / 8) |
| Real pages, a glimpse at the fork and a silent crouched double-back (B-C2) | 3 kills in 6 valid; fooled (searched, gave up) in the others | 2 kills in 6 valid; **fooled 3 times** (searched the way it saw them go, listened, gave up), passed over once |
| Somebody running round the pillar (C06, simulation) | took them for going round 0 / 12 (it chased or met them) | after a full lap it saw: a cut-off in 9 / 9, they came to where it cut across 9 / 9; a reversal undoes the guess within 1 s (8 / 8) - but on this small pillar it still catches them (8 / 8, see `DEFERRED.md`) |
| Real pages, circling the pillar (B-C4) | 1 kill in 3 valid; one try a dither (approach 5×, watch 3×, retreat 3× in 16 s) then leave | 6 kills in 8 valid; a cut-off in 2 of them (stand-offs and flanks reached the others first); **one runner saved by turning back** as it cut across |
| Two pages, A hides, unseen B runs a lane (C07 simulation; B-C3 real pages) | simulation: B's noise drew it 7 / 8, B never named before seen | the same (anonymity unchanged); real pages: A found 1 of 3 valid (R8 3 of 5) |
| The hunger gradient (C12, simulation) | went for them at .45 / .55 / .65: .86 / 1 / 1 but killed .29 / .53 / .36 - passive to lethal at .75–.8 | went for them .64 / 1 / 1, killed .57 / .93 / .93; satiated and mild never; somebody passed over is let go (C21) |

## "Needs to be more fast thinking and responsive"

| Moment | R8 | After |
|---|---|---|
| Somebody walks into its view (C01, C18 (a)) | faced them 0.83 s (p50), 1.87 s (p95) after it saw them | **0.05 s (p50), 0.1 s (p95)** |
| Watched, then their back turned for 2.5 s (C18 (b)) | moved in within 1 s in 4 / 12 | 9 / 12 (p50 0.87 s) |
| A listen ended by the sound it waits for (C04 (b)) | 0 / 4 ended early (ran to its timer) | 4 / 4 within 0.25 s of the next footstep |
| The lost race, very hungry (C10) | 11.1–13.3 s on their trail | a choice at once; 3 s on the trail at most; the runner still wins 12 / 12 |
| Where faster is worse: 0.15 s glances away (C18 (d)) | dropped what it was doing on 3 of 69 | 4 of 68 (6 %; the bound 10 %) - a glance shorter than its beat is not an opening; no better than R8 here |

## Fair and unchanged

Speeds, stamina, the wind-up (0.22 s) and contact, sight and hearing, admin-only spawn and the cap of 4 are R8's. A fresh runner wins
(C10, PR27, the review's own no-race check: no lead eroded on either build); a step aside up to about 0.35–0.40 s after the wind-up begins
makes a spring miss (C11 and the review's measurement); every spring in the new tactics showed its whole wind-up at somebody it saw, its
stamina paid, contact only (C11: 15 / 15). Real pages: no page was caught on a straight run; the fresh runner escaped 7 of 9 valid tries after
the review (R8 6 of 6); the two caught had hidden round the corner it was searching.
