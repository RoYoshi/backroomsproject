# Trial 3 R19 - the combined QA branch: real browser

Trial 3 is **not owner-approved**.  The same real-page runs as each track's, on this tree, in the same session (headless Chromium on
SwiftShader, 1.4-2.5 frames a second with two pages, 4-6 with one; pages moved only by their own keys and mouse; creatures placed by the
test-only `qa_server.js` and never steered).  Full tables beside R18, S and N: `dev/trial-3-r19-positioning/BROWSER_AND_MEDIA.md` (the
Skin-Stealer's scenes) and `dev/trial-3-nani-corners/BROWSER_AND_MEDIA.md` (the Hound round corners).  `evidence/browser/`.

| what | the combined tree | R18 |
|---|---|---|
| a Hound sent round the audit's two stop-pivot-go bends (routes 23, 26; two tries each) | slowest between start and goal 161-168 px/s, no pivot | 29-58 px/s, pivoting 0.05-0.10 s |
| the same on two sharp bends that slow every tree (16, 28) | 0-61 px/s, as R18 | 12-41 px/s |
| Scene B (standing lit, .85): vanished on a way round | 0/3 | 1/6 |
| the junction: towards the side passage while 400 px or more off | 59-61 px, with its contest record (3/3) | 0 px (3/3) |
| the owner's thirteen threat scenes, first pass | 7 of 13 | 7 of 13 |
| the focused scenes, first pass | 4 of 7 | 6 of 7 |
| repeated (4 tries each): F5 circled / F6 a feint / S6 hiding / S9 a sound | 3/4, 2/4, 2/4, 2/4 | 4/4, 2/4, 3/4, 4/4 |
| faster than its run (270 px/s), page errors | none | none |

The single tries vary on every tree (R18 itself 2/4 on F6, 3/4 on S6); on the server, without the page, S6 and S5 give the same lines on
every tree (the tracks' `s6_server.js`, `s5_server.js`), and the seeded outcomes of 1,044 chases per tree are R18's or better
(`REGRESSION.md`, "Never weaker").
