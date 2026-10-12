# Stage 3D HQ1 tools (development only)

HQ1 corrects two things in the Stage 3D D7 candidate: blood on the wallpaper where a body struck a wall, and a dead wanderer's light that fails 3–7 s after it is released. None of these files is served or loaded by the game. Every server they start uses a synthetic admin passcode (`dev/stage-3d/lib3d.PASS`). They build on `dev/stage-3d/lib3d.py`.

| Tool | What it does |
|---|---|
| `hq1lib.py` | Shared helpers: a lit papered face of a given side to die in front of (`FACE_SPOT`), an inner corner (`CORNER_SPOT`), a pillar (`PILLAR_SPOT`), the far side of a wall (`BEHIND_SPOT`); where a spectator sees it (`VIEW_SPOT`); the monsters cleared before a step (`clear_monsters`); a late joiner waiting at the name prompt (`prejoin` / `enter`); Death Lab stepping; checked teleports |
| `wall_capture.py` | A wall death as the players see it: victim, spectator and a late joiner, before, at impact + 0.6 s and at the corpse; zoomed crops at the contact; the receiver's state; a sheet |
| `stain_metric.py` | Gate W1: blood-coloured pixels in the struck face's visible band, and above it, in every picture of a `wall_capture.py` run; writes the band crops |
| `wall_faces_test.py` | Gate W2: every papered face of the real map resolves to itself; corners, oblique normals, pillars, props, floor and points off the face line are refused |
| `wall_lifecycle.py` | Gate W3: the stains through replay → corpse, a late joiner, idle, a second death, a revive mid-death, a reconnect and a world reset, on three screens |
| `wall_rebuild_test.py` | Gate W3 (cache): the stain through a full level rebuild, tier rebuilds and a chunk-cache eviction |
| `light_power_test.js` | Gates L1, L2: `dphys.lightPower`, `lightProfile` and `releaseOf` as numbers (the game's own dphys.js) |
| `light_net.js` | Gates L3, L7: the light profile on the wire (kill record, replay, corpse), forged messages, sizes, ages in tenths |
| `light_timeline.py` | Gates L4, L5, L6: one death on three screens (victim, spectator, late joiner): every frame's power, each page's anchor against a quiet observer of the server's messages, the frozen-clock picture sequences and the 0.1 s failure strip, BR-RoLE's buffer, `light.js` and the screen's brightness at the lens; a survivor's light; `--reanalyse` re-checks a run from its JSON |
| `ws_observer.js` | The reference clock for `light_timeline.py`: a WebSocket client in the room that never joins and logs the death messages' arrival |
| `ws_admin.js` | One admin command (revive, world reset) sent a set time after a death begins, by a WebSocket client doing nothing else (the lifecycle test's precise hand) |
| `light_hold_compare.py` | Gate L5's hold part: the corpse light in its hold against D7's, the same corpse, the same viewers |
| `light_lifecycle.py` | Gate L6: focus / hide / resize, a dropped connection, a reloaded page, a second death, a revive mid-death and a world reset, on three screens |
| `traffic8.js` | Eight players' network traffic through six deaths, for the A/B against D7 |
| `summarize_hq1.py` | HQ1-3's whole regression in one summary (D6's summary re-based on D7) |
| `light_capture.py` | A dead light over time: both screens and a late joiner; what each page hands its lighting; BR-RoLE's light at the lens |
| `probes/band_probe.py` | Which part of a wall face the line of sight shows (calibration stripes) |
| `probes/victim_probe.py` | The victim's death clock and its lights during and after the death |
| `verify_remote_hq1.py` | After a push: the remote branch, its commit and tree, the straight line from D7, every other branch untouched |

Evidence for each checkpoint is in `evidence/hq1-0` … `hq1-4`.
