# Stage 3D HQ2 tools (development only)

HQ2 adds two things to the accepted HQ1 game:
- NEW RUN as a server-approved explosive self-destruction;
- living Wanderers that physically block each other.

None of these files is served or loaded by the game. Every server they start uses the synthetic admin passcode (`dev/stage-3d/lib3d.PASS`). They build on `dev/stage-3d/lib3d.py` and `dev/stage-3d-hq1/hq1lib.py`.

Collision tools use **ordinary** test players, without the test passcode. An admin's own movement skips the server's checks, so a collision test whose players were admins would test nothing. They are placed by a quiet admin connection instead (`ws_place.js`).

| Tool | What it does |
|---|---|
| `preflight_hq2.py` | H2-0: the accepted parent on GitHub, in the HQ1 receipt and locally; ancestry; the HQ2 branch absent; every remote branch recorded (`evidence/h2-0/remote_heads_before_hq2.json`) |
| `verify_remote_hq2.py` | After each push: the remote branch, its commit and tree, the straight line from HQ1, every other branch untouched |
| `scope_hq2.py` | The H2-0 file allowlist checked against what changed since the parent; `--manifest` writes the parent's production blobs |
| `corridor_widths.js` | Level 0's passage widths in walk mode: the evidence for the collision radius (decision D1) |
| `proto_lab.js` | Protocol scenarios against a real server, with raw WebSocket clients that speak what `mp.js` speaks: the NEW RUN cooldown phantom, players walking through each other, stacked spawns (H2-0 RED; later the GREEN, negative and mutation cases) |
| `nr_browser.py` | NEW RUN pressed in a real page, watched by a second page and by the server's own player list |
| `col_browser.py` | Two ordinary players meeting in the narrow corridor, by keyboard |
| `reset_epoch.py` | An admin world reset in the middle of a death, on three pages (R01; `--reanalyse` recomputes from a saved run) |
| `srv_load.js` | Eight ordinary players moving (`spread`) or crowding one point (`crowd`): the server's CPU, step time, ping and corrections |
| `ws_watch.js` | A quiet observer: the server's own player list, `fx` and `bodies`, with arrival times |
| `ws_place.js` | A quiet admin: monsters removed, god mode, players moved where a test needs them (admin BRING) |
| `hq2lib.py` | Shared helpers: ordinary players joining, placement, the observer |

Evidence for each checkpoint is in `evidence/h2-0` and onwards.
