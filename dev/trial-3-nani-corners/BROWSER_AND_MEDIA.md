# Trial 3 R19, N track - real browser and media

Trial 3 is **not owner-approved**.  Every page here is headless Chromium on SwiftShader (software rendering) on this session's two-CPU
machine, served by the tree's own `server.js` from its generated build (through the test-only `qa_server.js`, as R9-R18's browser tools)
with a synthetic admin passcode set for the run.  Nothing else ran on the machine meanwhile.  Your GPU will differ: the page drew 4-6
frames a second.

## A Hound sent round corners in the real game (`tools/corner_browser.js`)

One page, the admin.  For each route of the seed-7 audit set the world is frozen, every other creature removed, the page stands at the
route's goal, a Hound is **placed** at its start (as dev/tests place one), the world unfrozen, and the admin's own DEBUG navigation command
"come" sends it to the page - the real route, follower, steering, locomotion and collision at the Hound's chase speed (292 px/s), no
species decision.  Every snapshot the page receives (20 a second) is recorded; the measures are read in the order of the server's
snapshots (50 ms apart), up to the Hound's arrival.  Routes 23 and 26 are where the audit found R18's stop-pivot-go; 16 and 28 are bends
where it found none.  Two tries each, R18, this branch (N) and the combined QA tree (C), the same session:

| route | tree | reached the page (s) | slowest between start and goal (px/s) | pivoting (s) | fastest turn (rad/s) |
|---|---|---|---|---|---|
| 23 | R18 | 6.00 / 5.85 | **29 / 44** | 0.05 / 0.10 | 2.92 / 3.00 |
| 23 | N | 5.90 / 5.70 | **168 / 165** | **0 / 0** | 2.14 / 2.30 |
| 23 | C | 5.95 / 5.65 | **161 / 168** | **0 / 0** | 3.04 / 2.14 |
| 26 | R18 | 3.30 / 2.95 | **58 / 29** | 0.05 / 0.05 | 2.92 / 2.92 |
| 26 | N | 2.85 / 2.85 | **162 / 166** | **0 / 0** | 2.28 / 2.26 |
| 26 | C | 2.85 / 2.80 | **162 / 162** | **0 / 0** | 2.44 / 2.28 |
| 16 | R18 | 3.35 / 3.40 | 29 / 29 | 0.10 / 0.10 | 3.10 / 3.10 |
| 16 | N | 3.45 / 3.35 | 15 / 29 | 0.05 / 0.10 | 4.20 / 3.10 |
| 16 | C | 3.35 / 3.30 | 0 / 29 | 0.10 / 0.10 | 3.30 / 3.10 |
| 28 | R18 | 7.30 / 7.25 | 41 / 12 | 0.15 / 0.10 | 3.22 / 3.22 |
| 28 | N | 7.20 / 7.90 | 41 / 15 | 0.15 / 0.15 | 3.22 / 3.30 |
| 28 | C | 7.35 / 7.45 | 12 / 61 | 0.10 / 0.10 | 3.22 / 3.80 |

On the two defect routes the page sees the Hound keep 160+ px/s through the bend (R18: down to 29-58 px/s, a visible stop) and turn
without a pivot, and arrive 0.1-0.45 s sooner; on routes 16 and 28 (sharp bends that slow every tree) it is R18's within the variation of
two tries.  The records: `evidence/N2/browser/corner_{R18,N,C}.{txt,json}` (every sample of every try).  Three of the page's own
screenshots (route 23 and 26, the second shot of the first try) are kept as small JPEGs beside them - the page's view, lit by its torch;
the Hound comes from beyond its view and the frames show little of the bend itself, so the numbers above are the evidence, not the pictures.

*Fixed in the tool before these runs (and recorded):* the first batch sent the Hound to the page and left it a Hound on arrival - it caught
the page, and every later route found a dead page that the "come" command did not move it to (R18 routes 26, 16, 28: no movement).  The
tool now freezes the world on arrival, revives the page before each try, and measures only up to the arrival.

## The Skin-Stealer's scenes on this tree

The owner's thirteen adversarial scenes and the focused scenes of R16g's browser campaign (`dev/trial-3-r9-overhaul/tools/r16g_campaign.js`,
unchanged) ran on R18, S, N and the combined tree in the same session: see `dev/trial-3-r19-positioning/BROWSER_AND_MEDIA.md` on the S
branch (and here, `evidence/N2/browser/threat_N.txt`, `focused_N.txt`, copied when they ran).  N's results are listed there beside R18's.

## Not done in a browser

N08 (four Hounds and a Smiler in one doorway) and N12-N14 (the Skin-Stealer's covert way and footwork do not use `follow()`) are
covered on the server (NC04, the Skin suites) rather than by a page; N16 (server position against the drawn heading) only as far as the
headings above are the ones the server sent and the page draws (no client change); the pack's video of each species is **not** recorded here (headless
SwiftShader at 4-6 frames a second shows little of motion quality) - the owner's own play (`HUMAN_QA.md`) is the judge of feel.
