# Stage 3E-0 (B+): development tools

These tools are for development only. The server never serves `dev/` (`static_check.js` checks that).

Every tool that starts a server uses the synthetic test passcode `d3-synthetic-admin`, never yours. Run Python with `-I`.

| Tool | What it does |
|---|---|
| `net_lab.js` | Measures how fresh the other Wanderers' poses are on the real server. One mover walks a known circle, sending as `mp.js` sends; one observer records every `s` and `q`. A counting proxy sits on each connection: real bytes, plus an optional delay and jitter. It also reports server CPU and replays what a 30/60/144/240 Hz screen would show for A, B and B+. |
| `b_math.js` | Runs B's easing line, taken from `mp.js` itself. It checks: .3/.35 at 60 fps; the same gap left after 1 s at any frame rate; dt of 0, negative, NaN, Infinity or 10 s; the short way round for the heading. |
| `proto_check.js` | Checks B+ on the server, message by message: the `caps` answer; no `q` while nobody moves; the shape of `q`; others only; epoch and tick; world reset, death and disconnect; a 500 px jump and a move through a wall are both refused for a fast client. |
| `static_check.js` | Checks `/favicon.ico`: 200, `image/x-icon`, your exact bytes (with and without gzip). The page links it once, and twelve protected paths are still 404. |
| `two_browser.py` | Runs two real pages. Alice walks into Bob, sprints, stops, turns, crouches, slides, reloads, and an admin resets the world. Bob's page is checked frame by frame: avatar, BR-RoLE jobs, light, the bodies he steers round. For B+ it also hands Bob's page four crafted `q`. Options: `--mode a\|b\|bplus`, `--lag MS`, `--expect old-server\|old-client`. |
| `place_race.py` | Checks whether an admin BRING sticks: Bob's sends and `tp`, the server's track. `--near X:Y` starts him close to the target. This is how the pre-existing HQ5 placement race was shown. |
| `ws_admin_once.js` | Sends one admin command from a quiet connection (used by `two_browser.py`). |
| `overlay_e0.py` | Builds and validates the small B+ overlay on HQ5, including `REVERT_TO_HQ5`, the HQ3→HQ4→HQ5 chain, the revert and two pages running. |
| `verify_remote_e0.py` | Checks the pushed `stage-3e-0` on GitHub against the local HEAD and tree. Also checks: parent `ad98475`; ancestors; `stage-3d-hq5` and every other branch unchanged; no `stage-3e-0-bplusplus`. |

Two older tools were reused unchanged:
- HQ2's `dev/stage-3d-hq2/col_browser.py`: head-on and aside contact in a real browser.
- HQ4's `dev/stage-3d-hq4/gameplay_smoke.py`: walk, spin, light, frames, NEW RUN.

Evidence:
- `evidence/e0-0`: source proof, the HQ5 audit, the A baseline.
- `evidence/e0-1`: the gates. Start with `SUMMARY.md`.
- `evidence/e0-2`: the overlay receipt and the push checks.
