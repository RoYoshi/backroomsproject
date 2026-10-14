# dev/stage-3h: Stage 3H, the architecture program on the accepted B++ game

**What this folder holds.** Stage 3H's audits, tools, evidence and receipts. Nothing here is served or loaded by the game: `server/static.js`'s allowlist cannot reach `dev/`.

**Where things stand.**
- **3H1** (audit and baseline) is the only authorized step. It changed no runtime file.
- **Every later step needs the user's explicit authorization:** `3H1_NEXT_GATE.md`.

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
| `tools/h1_build_check.js [--ref REF] [--out F]` | Rebuilds `ai.js`, `ents.js` and `sim.js` in memory from their sources and compares them byte for byte; never runs the build scripts |
| `tools/h1_scope_check.py [--base 143b63f] [--rev REV \| --worktree] [--out F]` | Proves 3H1 added files only under `dev/stage-3h/` and `dev/devlog4dev/`, and that every production file (all outside `dev/`, media and `favicon.ico` included) is byte-identical to B++, by SHA-256 of content |
| `tools/h1_wire_keys.js --srv DIRS --cli DIR [--out F]` | The wire as golden traces show it: types, key orders, `q`'s shape, set beside 3H0's contract |
| `tools/h1_wav_stall.js --game EXPORT [--port P] [--out F]` | Runs a copy of the game. Measures the snapshot gaps while the menu WAVs are first requested (F-013) |
| `tools/verify_remote_h1.py LABEL [--out F]` | After a push: the remote `stage-3h` equals the local commit and tree; the line from B++ is straight; no other branch moved |
| `golden/srv_scenarios_bpp.js` | Five B++ scenarios for 3H0's closed-world harness: `bpp_caps_q`, `bpp_place_guard`, `bpp_world_guard`, `bpp_known_limits`, `bpp_new_run` |
| `golden/bpp_golden.js [--old-ref R] [--repeat N] [--out D] [--write-baseline] [--baseline D]` | Runs them: a reference `server.js` against the working tree's, byte for byte, with repeats; writes or checks a baseline |
| `golden/bpp_mutants.js [--ref R] [--out F]` | Nine one-line mutants of `server.js`, each run through the scenario that should notice it |

**What the tools may and may not do:**
- They read Git or a game export, and write only where `--out` says. None writes to the repository's game files.
- Tools that start a server use a synthetic admin passcode, never the user's and never the built-in default.

## Evidence

`evidence/h1/`. Its layout is in `3H1_SOURCE_PARITY_BASELINE.md` §6, and every file is listed in `3H1_CHANGED_FILES.txt`.

**The golden traces in `evidence/h1/golden/` are the B++ baseline.** They are locked by SHA-256 and must not be regenerated after a production change without the user's approval.

## Rules this folder keeps

- **The game must not change.** No runtime JS, HTML, CSS, asset, package, configuration, test or deployment file is touched by 3H1.
- **Earlier stages stay as they are.** Their tools and evidence are left untouched. Old root reports are not moved.
- **The repository is public.** No passcode, secret, token, production address, exploit detail or personal data is written here.
