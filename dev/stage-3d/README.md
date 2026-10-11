# Stage 3D tools (development only)

None of these files is served or loaded by the game. Every server they start uses a synthetic admin passcode (`lib3d.PASS`).

| Tool | What it measures |
|---|---|
| `lib3d.py` | shared browser helpers: start a server, join, open the admin panel, find spots, place a spectator |
| `phys_matrix.js` | the death physics on the real map: 16 spots × the eight variants × 6 sides × 4 sample rates; penetration, tunnelling, sleep, sampling |
| `golden3d.js` | 3H0's server golden scenarios, whole tree against whole tree; every difference must start in the death domain and the non-death view must be identical |
| `perf_death_srv.js` | the server's death cost: the corpse simulation per variant, the 60 Hz step with 24 corpses, `bodies` bytes, memory |
| `perf_death.py` | the browser's cost (SwiftShader: same machine only): idle, three deaths, 20 corpses on and off screen, victim and spectator |
| `film_3d.py`, `regrid.py` | the eight deaths frame by frame from the victim and a spectator, through the admin death lab; contact sheets |
| `parity3d.py` | the victim's corpse against the server's corpse for the same kill |
| `secret_scan_3d.py` | 3H0's secret scan, re-based on the 3D parent |
| `verify_remote_3d.py` | after a push: the remote branch, its commit and tree, and that no other branch moved |
| `fixtures/corpses20.json` | 20 corpse records made by the parent's server code, for the corpse cost test |

Evidence for each checkpoint is under `evidence/d0` … `evidence/d7`.
