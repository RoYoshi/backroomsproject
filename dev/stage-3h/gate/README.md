# Stage 3H gate (H2-0)

One command decides whether a Stage 3H checkpoint still is the accepted B++ game:

```
node dev/stage-3h/gate/h2_gate.js --tier fast --allow-prod server.js,server/newrun.js --out <scratch>/gate
node dev/stage-3h/gate/h2_gate.js --tier full --allow-prod <every production file changed since B++> --out <scratch>/gate_full
```

- The reference is always the **original B++ head** `143b63ff42b88c6780c5043e0f61d64100f81f40` (tree `b25c26ec…`), never the previous
  checkpoint: parity does not drift step by step.
- `--allow-prod` lists the production files (outside `dev/`) the stage has changed or added on purpose, cumulative since B++. Every
  other production file must be byte-identical to B++, and a file declared but not changed also fails (a stale declaration).
- A step passes only on its own positive evidence: a count of compared cases above zero and the tool's own verdict. **A step that
  compared nothing is a FAIL**, whatever its exit code. Exit 0 only when every step passes. Everything is written under `--out`
  (`gate_report.json` plus each tool's log and report).

## Fast tier (deterministic; about 4 minutes)

| step | what it proves | against |
|---|---|---|
| build | `ai.js`, `ents.js`, `sim.js` rebuild byte for byte from their sources | the working tree's own sources |
| scope | only `dev/stage-3h/`, `dev/devlog4dev/` and the declared production files differ | B++ |
| srv_golden | Stage 3H0's 11 server scenarios (closed world: fake clock, seeded randomness): every socket byte, HTTP response, timer, console line and sim call | B++'s `server.js` run beside it, and the stored B++ baseline `evidence/h1/golden/srv_traces` |
| bpp_golden | the 6 B++ scenarios: caps/q, the placement guard and its caveats, NEW RUN, NEW RUN while held | the stored B++ baseline `evidence/h2/golden/bpp_traces` |
| cli_golden | Stage 3H0's 9 client scenes: `mp.js` in a real Chromium with a fake clock, every send, DOM change and draw call | B++'s `mp.js`, and `evidence/h1/golden/cli_traces` |
| protocol | every message in those traces matches the B++ protocol contract v2 (exact JSON paths, value kinds and key orders, both directions); the checker's own selftest | `protocol_bpp.json`, derived from the B++ traces |
| mutants | 10 one-line server mutants: each must change a B++ golden. The mutated text is found wherever the code now lives, so the goldens are shown to see code moved into `server/*.js` | the unmutated copy |
| static | real HTTP on a copy of the game: the allowlist, blocked paths, the favicon bytes | B++'s favicon |
| raw_live | each game as a real server over raw TCP: every HTTP response (status, headers, body) and the WebSocket checks | the B++ export |
| quick_suites | the suites that read `server.js`'s or `mp.js`'s own text (`s_humanqa_hotfix` X02/X03, `s_ir` I1, `interp_test`) and the quick ones (`test_3bn`, `ir_net`), every failure classified | the B++ record `known_failures_bpp.json` |

## Full tier (the final candidate; about 35 minutes)

The fast tier, then the real-time checks:

| step | what it proves |
|---|---|
| live_wire | two real Chromium players through the game's own buttons (join, NEW RUN approved / refused / admin UNLIMITED, END, a death and RESPAWN, a server restart), compared by structure with the same script on B++ |
| bpp_checks | B++'s own real-server checks (`proto_check`, `place_replay`, `place_guard_check`), judged against what they measured on B++ in 3H1 |
| browsers | `two_browser` (B+), the two collision cases, the gameplay smoke |
| contact_lab | BR-RoLE's contact lab on both games: the pixel-stable scenes (geometry, lights, peers) must be identical images |
| suites | the existing suites; every failure classified against the B++ record (`known_failures_bpp.json`): a new failure or a known one that now passes fails the gate |
| perf | `perf_det`: B++'s server and client code against the candidate's, interleaved, with 3H0's tolerance rule |

## What the H2-0 repairs fixed

- `raw_live_h2.js` (3H copy of 3H0's `raw_live.js`): 3H1 found the original comparing almost nothing (a missing game folder made both
  sides fail the same way). The copy exports complete game trees, fails when a server does not start or a socket never connects, and
  counts its cases. An A/A run passes; three deliberately broken copies (a cache header, the 1,400-byte frame limit, the room cap) fail.
- `live_wire_h2.js` (3H copy of `live_wire.js`): the original waited forever for the run menu after a refused NEW RUN (3H1 F-021). The
  copy follows B++'s real flow, limits every phase to 30 s, reports both pages' state when a phase fails, reads the refusal while the
  button still shows it, and treats two B+ timing races (which phase a sparse `q` falls in; `s.k` before the caps answer) the way its
  own A/A run showed they need. A client that stops asking for caps, and a server that drops the cooldown's `wait`, both fail it.
- `bpp_mutants.js` copies the whole server side, so a mutant follows code into a module.
- `h1_scope_check.py` runs in about a second (blob ids instead of reading every file) and knows declared production changes.
- `protocol_v2.js` replaces 3H0's contract (written for the QA2 parent; 12,483 differences on B++, 3H1 F-003) with one derived from B++.
- `suites.js` turns the suites' known B++ failures (3H1 F-017) into a classification instead of a judgment by eye.

## What the gate cannot see

- Timing in a real browser beyond structure (which message types, key sets, scripted event counts). Pose freshness and smoothing are
  pinned by the deterministic goldens and the B++ checks, not by live timing.
- Pixels outside the contact lab's frozen scenes. BR-RoLE's code is not touched by Stage 3H; the scope step proves its bytes.
- The pause dialog's NEW RUN button text and the run menu's words are covered by the live run only (`ui` in its report) until a client
  NEW RUN golden exists (C-3).
