# Two Stage 3H0 live harnesses on B++ (F-021)

Both were run unchanged on the accepted B++ head, A/A, during the 3H1 baseline (`../steps.txt`). Neither produced a usable comparison. Both were left as they are, because 3H1 does not edit an earlier stage's tools.

## `dev/stage-3h0/golden/raw_live.js --old-ref 143b63f --aa`

**Result.** Exit 0 in 15 s, **no output at all, and no report file.** That is a vacuous pass: an exit code of 0 that tested nothing.

**Why** (read in the code):
- `oldTree()` (lines 26–30) builds a scratch copy of the working tree. It leaves out `server.js` and `server/`, and writes the reference's `server.js` text into it.
- In 3H0 that was right: the reference was the parent, whose `server.js` had no `server/` folder.
- On B++ the reference's `server.js` requires `./server/static.js` and its siblings, so it cannot start in that copy.
- Its WebSocket `session()` resolves only when a socket connects. Against a server that never started, the connection is refused and that promise never settles. With nothing else pending, Node ends the process with exit code 0, before any report is written.

The empty log is the evidence. It is not kept as a file, since it has no content.

## `dev/stage-3h0/golden/live_wire.js --old-dir <B++ export>`

**Result.** It waited 773 s at step `A_end` (line 57: `A.P.click('#runEnd')`) and was stopped (exit 137). `live_wire_aa.log` here is its output.

**Why** (not traced further):
- `#runEnd` belongs to the run menu (`#runMenu`). Since Stage 3D HQ2 that menu opens only after the server approves a NEW RUN.
- The script's sequence was written for QA2's client-side vanish. On B++ the menu never opened, and the click waited for an element that never became visible.

## What stands in for them in the B++ baseline

| Probe | What it covers |
|---|---|
| `dev/stage-3e-0/static_check.js` | real HTTP serving, including blocked paths and the favicon |
| `dev/stage-3e-0/two_browser.py` | two real pages on a real server: movement, reload, world reset |
| `srv_golden` `ws_upgrade` / `ws_frames` / `http_base` / `http_h0` | the same requests, byte-exact, in the closed world |

R-003 (`dev/devlog4dev/3H_RECOMMENDATIONS.md`) proposes working B++ copies that fail loudly.
