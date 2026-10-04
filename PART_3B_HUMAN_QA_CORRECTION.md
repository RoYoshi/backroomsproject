# Part 3B human QA correction

P3B-HQ0 — HUMAN QA FAIL / NEEDS FOLLOW-UP.

The published result at `6ec76c6ca9b289c108ab933c71af196dd5c522cd` (tree `05a8e8926ed30012d3158e7ef0f5b6f546bc06a1`) was rejected by the user: walls and rooms read as tilted/isometric, with large wedge faces. Engineering gates did not establish human visual approval.

The original screenshot, rejection authority and correction prompt are preserved verbatim under `dev/part3b/authority/human-qa-correction`. The prior rendered captures and source remain in history. HQ0 changes no runtime code and runs no repair tests.

Required replacement: top-down orthographic room rectangles, parallel wall lines, local volume cues on all four wall orientations, retained stair/fall cues, canonical footprint, picking, physical truth, local cutaways and independent client presentation. Preserve all unrelated 3B work.

Part 3C and later work are not authorized. Human QA remains failed until engineering correction is complete, then returns to pending for the user’s decision.
