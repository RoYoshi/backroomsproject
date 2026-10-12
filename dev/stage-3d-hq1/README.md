# Stage 3D HQ1 tools (development only)

HQ1 corrects two things in the Stage 3D D7 candidate: blood on the wallpaper where a body struck a wall, and a dead wanderer's light that fails 3–7 s after it is released. None of these files is served or loaded by the game. Every server they start uses a synthetic admin passcode (`dev/stage-3d/lib3d.PASS`). They build on `dev/stage-3d/lib3d.py`.

| Tool | What it does |
|---|---|
| `hq1lib.py` | Shared helpers: a lit papered face of a given side to die in front of (`FACE_SPOT`); where a spectator sees it (`VIEW_SPOT`); a late joiner waiting at the name prompt (`prejoin` / `enter`); Death Lab stepping; checked teleports |
| `wall_capture.py` | A wall death as the players see it: victim, spectator and a late joiner, before, at impact + 0.6 s and at the corpse; zoomed crops at the contact; the receiver's state; a sheet |
| `light_capture.py` | A dead light over time: both screens and a late joiner; what each page hands its lighting; BR-RoLE's light at the lens |
| `probes/band_probe.py` | Which part of a wall face the line of sight shows (calibration stripes) |
| `probes/victim_probe.py` | The victim's death clock and its lights during and after the death |
| `verify_remote_hq1.py` | After a push: the remote branch, its commit and tree, the straight line from D7, every other branch untouched |

Evidence for each checkpoint is in `evidence/hq1-0` … `hq1-4`.
