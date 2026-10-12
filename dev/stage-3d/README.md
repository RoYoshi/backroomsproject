# Stage 3D tools (development only)

None of these files is served or loaded by the game (`static_check.js` confirms `dev/` answers 404). Every server these tools start uses a synthetic admin passcode (`lib3d.PASS`).

## Building and checking the shipped files

| Tool | What it does |
|---|---|
| `apply_bundle.py [--check]` | The bundle's six death hooks, as exact text on the parent's bundle (each parent text found once). `--check` compares the working copy byte for byte |
| `changed_files_3d.py [REV]` | Writes `STAGE_3D_CHANGED_FILES.txt` |
| `package_3d.py` | The human-QA ZIP, its SHA-256 and the receipt, verified from the extracted ZIP. It checks: <br>- the commit chain, remote and scope; <br>- the protected files; <br>- built files == sources; <br>- the final regression |
| `verify_remote_3d.py LABEL --out FILE` | After a push: the remote branch, its commit and tree, and that no other branch moved |
| `secret_scan_3d.py` | 3H0's secret scan, re-based on the 3D parent |
| `summarize_d6.py` | The final regression in one gated summary (`evidence/d6/summary.json`) |

## Equivalence (what is not death must not change)

| Tool | What it does |
|---|---|
| `golden3d.js` | 3H0's server scenarios, whole tree against whole tree. Every difference must start in the death domain, and the non-death view must be identical (one documented follow-on after a killer hand-back) |
| `cli_golden3d.js` | 3H0's `mp.js` scenes, parent against 3D. Only the client's own death claims and the corpse hiding may differ |
| `contract_check3d.js` | 3H0's protocol contract plus 3D's death fields, against the new traces |
| `static_check.js` | What the server serves of the death code; server-only files stay 404 |

## The death itself

| Tool | What it measures |
|---|---|
| `phys_matrix.js` | The physics on the real map: 16 spots × the eight variants × 6 sides × 4 sample rates. It checks: <br>- penetration and tunnelling; <br>- sleep; <br>- wall marks; <br>- where the blood lands |
| `gore_geo_test.js` | Does the blood stay on the floor? Every drawn point of 508 deaths, live and corpse |
| `parity3d.py` | One death, three runs: the victim's corpse, a spectator's replay and the server's corpse |
| `death_net.js` | The death protocol on the wire, N1–N12: authority, hostile input, disconnect, late join, revive, world reset, NEW RUN record, sizes, fuzz |
| `film_3d.py`, `regrid.py` | The eight deaths frame by frame, victim and spectator, through the admin death lab; before and after contact sheets |
| `corpse_check.py` | From death to corpse: the hand-over, drying, culling, texture, late joiner |
| `sound_check.py` | What a death sounds like and to whom; the reduced-motion shake |

## Cost

| Tool | What it measures |
|---|---|
| `perf_death_srv.js` | The server's corpse simulation per variant, whole and as the server spreads it over the death's ticks (largest tick); the 60 Hz step with 24 corpses; `bodies` bytes |
| `perf_death.py`, `perf_compare.py` | The browser (SwiftShader, same machine only): <br>- idle; <br>- three deaths (`death_<v>` from when the harness notices it; `whole_<v>` the whole death, on both pages over the same span); <br>- 20 corpses on and off screen; <br>- victim and spectator; <br>- `--lighting` for the lighting quality, `--only` for some windows |
| `soak_death.py` | Deaths in a row in two browsers: heap after GC, display objects, leftovers; `--trace-gc`: the server's heap after each of its own full collections, next to its RSS |
| `server_soak.js` | Deaths over WebSockets: the server's heap after GC (inspector) and RSS; `--nogc 1`: no forced GC, the heap as it stands |
| `fixtures/corpses20.json` | 20 corpse records made by the parent's server code, for the corpse cost test |

Evidence for each checkpoint is in `evidence/d0` … `evidence/d7`.
