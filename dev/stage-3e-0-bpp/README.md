# Stage 3E-0 B++: development tools (never served)

Every tool that starts a server uses the synthetic test passcode `d3-synthetic-admin`, never yours. Run Python with `-I`.

| Tool | What it does |
|---|---|
| `place_replay.js` | Replays the placement race deterministically. A page keeps sending its old spot for 0–150 ms after a BRING or world-reset `tp`, then walks on. It runs with B+ and HQ5-style clients, fixed and jittered timings, at 545 px, 60 px and beyond any budget. It reports whether the placement was kept, the corrections, and how closely the server followed the walk. |
| `place_guard_check.js` | Checks what the placement guard must not change: join and spawn, the non-spawn correction, a sprint right after a placement, a placement into a crowd, the burst budget after the grace. It also checks the one thing that does change: a 500 px claim 150 ms after a placement. |
| `verify_remote_bpp.py` | Checks a pushed B++ checkpoint against GitHub. It covers the parent `1f2deba`, a straight line without merges, `stage-3e-0` and `stage-3d-hq5` unchanged, and every other branch unchanged. |

Several Stage 3E-0 tools are reused unchanged:
- `dev/stage-3e-0/` (`proto_check.js`, `two_browser.py`, `place_race.py`, `net_lab.js`, `static_check.js`, `b_math.js`);
- HQ2's `col_browser.py`;
- HQ4's `gameplay_smoke.py`.

Evidence:
- `evidence/p0`: B++-0, the placement race. Read `NOTE.md`.
