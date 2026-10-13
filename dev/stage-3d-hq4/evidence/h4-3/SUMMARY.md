# H4-3: the gates, the overlay, the hand-off pictures

The game under test is the H4-2 commit `5f933db`, exported. Its game files are the final ones; H4-3 adds only checks and documents.

| Run | Result |
|---|---|
| `gameplay_smoke.py`, HQ3's two files and HQ4's, two real pages each | Both OK, with identical results:<br>- walk about 490 px with the real keyboard; the server agrees;<br>- the mouse spin takes every quarter;<br>- F, F: the light on then off, and BR-RoLE draws her carried light only while on;<br>- NEW RUN approved, her run menu; Bob's page gets her gibs (6 pieces and both hands); SPAWN brings her back and she walks;<br>- 0 page errors and 0 BR-RoLE errors.<br>Frame pacing with two pages is about 3 fps on this renderer, too noisy to compare, so a one-page run follows |
| HQ2's `col_browser.py --case head` | 5/5:<br>- the server never lets her closer than contact;<br>- her page predicts it with no correction;<br>- she stops at contact;<br>- he is never moved |
| `wanderer_lab.py --scenes perf`, one page, all fixtures, 8 s each, alternating HQ3, HQ4, HQ3, HQ4 | Page frames 254 / 246 / 243 / 245 ms (about 4 fps on SwiftShader). BR-RoLE's own cost 20.7 / 20.1 / 20.1 / 20.9 ms. No slowdown |
| `overlay_hq4.py` | **PASS** (`OVERLAY_RECEIPT.txt`):<br>- the HQ3 ZIP is the known one (`61ed1360...`);<br>- the overlay over its clean extraction leaves all 54 runtime files byte-identical to `stage-3d-hq4`;<br>- the same over an HQ3 QA1 export;<br>- `REVERT_TO_HQ3_QA1` restores HQ3 QA1 byte for byte;<br>- the overlaid HQ3 game runs: 0 page errors, the avatar has 7 parts and no ellipse, the cast starts at 18 px at 8 headings, and gore.js has the QA1 fix |
| `delivery_sheets.py` | `HQ4_fix_A_dark_ellipse.png` (your two screenshots, untouched, above the before/after) and `HQ4_fix_B_floor_shadow.png` (as on screen, and the shadow alone) |

**The overlay itself:** `HQ4_HUMAN_QA_OVERLAY.zip`, SHA-256 `753312cf26b84d4bc7ef84f7c720d004ee41c2cb0a98d2bb32db7b850fd684bd`, 309,129 bytes. It is delivered beside this commit and is not stored in it.
