# Stage 3D HQ5 tools (development only)

HQ5 adds BR-RoLE 1.2's ground contact under living Wanderers to the accepted HQ4 game (`stage-3d-hq4` `79e1461`). Only `assets/br-role.js` changes.

None of these files is served. Every server they start uses the synthetic admin passcode.

| Tool | What it does |
|---|---|
| `verify_remote_hq5.py` | After each push, checks:<br>- the remote branch, its commit and tree;<br>- the straight line from `79e1461`;<br>- `stage-3d-hq4` still at `79e1461`;<br>- every other branch where it was (`evidence/h5-0/remote_heads_before_hq5.json`) |
| `contact_lab.py` | One held, frozen scene in a real page. `assets/br-role.js` is served per variant (HQ4's or HQ5's).<br>Scenes:<br>- `geometry` (4 headings, hand swing);<br>- `under` (right under a fixture);<br>- `lights` (two overlapping fixtures, every fixture, blackout);<br>- `carried` (a peer's flashlight from two sides, her own light);<br>- `peers` (no x-ray);<br>- `tiers`;<br>- `perf`.<br>Each capture gives a picture, the light in the buffer round her, her cast jobs and HQ5's contact jobs. HQ5 also gets the same frame with the contact off (DEV A/B) |
| `contact_report.py` | Compares `contact_lab.py`'s variants:<br>- changed pixels by distance from her body (body, edge, contact, outside);<br>- contact off against HQ4;<br>- cast jobs;<br>- the labelled sheets |
| `overlay_hq5.py` | The human-QA overlay ZIP (one file, plus HQ4's to revert). It is validated on a clean HQ4 export and on the HQ3 human-QA ZIP with HQ4's overlay:<br>- byte-identical to `stage-3d-hq5`;<br>- the revert restores HQ4;<br>- the overlaid game runs |

HQ4's `dev/stage-3d-hq4/gameplay_smoke.py` and HQ2's `dev/stage-3d-hq2/col_browser.py` are reused as they are, never edited.
