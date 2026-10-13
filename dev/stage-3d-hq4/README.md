# Stage 3D HQ4 tools (development only)

HQ4 makes exactly two visual fixes to the accepted HQ3 QA1 game (`stage-3d-hq3` `4934319`):

- **Fix A:** the Wanderer's decorative dark ellipse is gone.
- **Fix B:** BR-RoLE's cast for a Wanderer starts from the round body, never from the hands.

None of these files is served. Every server they start uses the synthetic admin passcode.

| Tool | What it does |
|---|---|
| `verify_remote_hq4.py` | After each push, checks:<br>- the remote branch, its commit and tree;<br>- the straight line from `4934319`;<br>- `stage-3d-hq3` still at `4934319`;<br>- every other branch where it was (`evidence/h4-0/remote_heads_before_hq4.json`) |
| `apply_bundle_hq4.py` | The bundle's HQ4 edit, as exact text on the accepted HQ3 bundle. It first proves that Stage 3H0 plus `dev/stage-3d/apply_bundle.py`'s edits still give the accepted HQ3 bundle. Options: `--check`, `--out` |
| `wanderer_lab.py` | One held, frozen scene in a real page, with the two files served per variant (HQ3's or HQ4's). Scenes:<br>- `ellipse`: hiding the ellipse in the same frame;<br>- `rotation`: BR-RoLE's cast job and the drawn cast as she turns under one fixture, with hands at a walk's swing extremes;<br>- `moving`, `carried`, `hound`, `peers` (no x-ray), `perf`, `corpse` |
| `lab_report.py` | Compares `wanderer_lab.py`'s results between variants and makes the labelled before/after sheets |
| `gameplay_smoke.py` | Two real pages: walk, spin, light on/off, frame pacing, NEW RUN gib plus SPAWN; page errors |
| `overlay_hq4.py` | The small human-QA overlay ZIP (HQ4's two files plus HQ3 QA1's unchanged `gore.js`, and the HQ3 QA1 originals to revert). It is validated on a clean extraction of the HQ3 human-QA ZIP and on an HQ3 QA1 export: byte-identical to `stage-3d-hq4`; the revert restores HQ3 QA1; the overlaid game runs |
| `delivery_sheets.py` | The two hand-off pictures in `evidence/h4-3/`: the user's screenshots (untouched) above fix A's before/after, and fix B as on screen above the shadow alone |
