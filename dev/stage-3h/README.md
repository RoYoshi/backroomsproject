# dev/stage-3h: Stage 3H, the architecture program on the accepted B++ game

**What this folder holds.** Stage 3H's audits, tools, evidence and receipts. Nothing here is served or loaded by the game: `server/static.js`'s allowlist cannot reach `dev/`.

**Where things stand.**
- **3H1** (audit and baseline) changed no runtime file.
- **3H2** (continuous implementation, authorized by the user after 3H1): H2-0 built the gate every runtime checkpoint must pass
  against the original B++ (`gate/`); the extractions follow, each its own commit with its own gate run and rollback. Human QA decides
  acceptance.

## The 3H1 documents

| File | What it is |
|---|---|
| `3H1_REPORT.md` | The result, in short: what was done, what was found, what is proposed, and the STOP |
| `3H1_ARCHITECTURE_AUDIT.md` | What runs at the B++ head: the server, the page, the hub and its spokes, two paths end to end |
| `3H1_DEPENDENCY_OWNERSHIP_MAP.md` | Every runtime file and global: who publishes, who reads, risk, owner, probe, verdict; `server.js` and `mp.js` section by section |
| `3H1_FRAMEWORK_REGISTRY.md` | Each framework name mapped to the code that exists today, or to none |
| `3H1_SOURCE_PARITY_BASELINE.md` | The frozen B++ baseline: golden traces and their SHA-256, what each pins, A/A noise, coverage, the historical test failures |
| `3H1_DEFERRED_SEAMS.md` | The nine 3H0 NO-GO seams, re-evaluated on B++ |
| `3H1_EXTRACTION_CANDIDATES.md` | The ranked backlog: H2-0, C-1, C-2, C-3, the NO-GO areas, the recommended phase order |
| `3H1_NEXT_GATE.md` | What the user is asked to authorize next |
| `3H1_CHANGED_FILES.txt` | Every file 3H1 added |

The findings, recommendations, deferred work and performance baseline are in `../devlog4dev/`.

## Tools (development only)

All run from the repository root.

| Tool | Does |
|---|---|
| `tools/h1_inventory.js [--ref REF] [--out F]` | Reads Git at REF. Records files, roles (served / server / both), page order, ES-module graph, `require` graph, globals, signals, message types |
| `tools/h1_build_check.js [--ref REF \| --worktree 1] [--out F]` | Rebuilds `ai.js`, `ents.js` and `sim.js` in memory from their sources and compares them byte for byte; never runs the build scripts |
| `tools/h1_scope_check.py [--base 143b63f] [--rev REV \| --worktree] [--allow-prod files] [--out F]` | Proves that files changed only under `dev/stage-3h/` and `dev/devlog4dev/`, and that every production file (all outside `dev/`, media and `favicon.ico` included) is byte-identical to B++ by SHA-256 of content, except the ones declared with `--allow-prod` |
| `tools/h1_wire_keys.js --srv DIRS --cli DIR [--out F]` | The wire as golden traces show it: types, key orders, `q`'s shape, set beside 3H0's contract |
| `tools/h1_wav_stall.js --game EXPORT [--port P] [--out F]` | Runs a copy of the game. Measures the snapshot gaps while the menu WAVs are first requested (F-013) |
| `tools/verify_remote_h1.py LABEL [--out F]` | After a push: the remote `stage-3h` equals the local commit and tree; the line from B++ is straight; no other branch moved |
| `golden/srv_scenarios_bpp.js` | The B++ scenarios for 3H0's closed-world harness: 3H1's five (`bpp_caps_q`, `bpp_place_guard`, `bpp_world_guard`, `bpp_known_limits`, `bpp_new_run`) and H2-0's `bpp_new_run_held` |
| `golden/bpp_golden.js [--old-ref R] [--repeat N] [--out D] [--write-baseline] [--baseline D]` | Runs them: a reference `server.js` against the working tree's, byte for byte, with repeats; writes or checks a baseline |
| `golden/bpp_mutants.js [--ref R] [--only ids] [--out F]` | One-line mutants of the server side, each run through the scenario that should notice it; a mutant is found in whichever file now holds its text (H2-0) |
| `golden/raw_live_h2.js [--old-ref R] [--new-dir D] [--aa] [--out F]` | H2-0's repair of 3H0's `raw_live.js`: two complete games as real servers over raw TCP, every HTTP response and WebSocket check |
| `golden/live_wire_h2.js --old-dir D [--new-dir D] [--out F] …` | H2-0's repair of 3H0's `live_wire.js`: two real Chromium players through the game's own buttons, compared by structure |
| `gate/h2_gate.js [--tier fast\|full] [--allow-prod files] [--out D]` | **The gate**: every comparison against the original B++ in one command (`gate/README.md`) |
| `gate/protocol_v2.js derive\|check\|selftest` | The B++ protocol contract v2 (`gate/protocol_bpp.json`), exact per message type, both directions |
| `gate/suites.js derive\|run` | The existing suites, every failure classified against the B++ record (`gate/known_failures_bpp.json`) |
| `tools/h2_move_proof.js --base R --from F --to M --lines a-b,…` | Proof that an extraction moved lines and changed none |

**What the tools may and may not do:**
- They read Git or a game export, and write only where `--out` says. None writes to the repository's game files.
- Tools that start a server use a synthetic admin passcode, never the user's and never the built-in default.

## Evidence

`evidence/h1/` (3H1). Its layout is in `3H1_SOURCE_PARITY_BASELINE.md` §6, and every file is listed in `3H1_CHANGED_FILES.txt`.

`evidence/h2/` (3H2): `golden/` the six-scenario B++ baseline; `h2_0/` the tools' A/A and sensitivity runs and the gate's first run
(`h2_0/STEPS.txt`); one folder per later checkpoint.

**The golden traces in `evidence/h1/golden/` and `evidence/h2/golden/` are the B++ baseline.** They are locked by SHA-256 and must not be regenerated after a production change without the user's approval (H2-0's sixth scenario was recorded on B++'s own code, before any production change).

## Rules this folder keeps

- **The game must not change.** 3H1 touched no runtime file. 3H2 changes runtime files only by moving code verbatim into modules, each move declared to the gate and proven against the original B++.
- **Earlier stages stay as they are.** Their tools and evidence are left untouched. Old root reports are not moved.
- **The repository is public.** No passcode, secret, token, production address, exploit detail or personal data is written here.
