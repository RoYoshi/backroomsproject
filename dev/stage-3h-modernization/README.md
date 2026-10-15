# dev/stage-3h-modernization: the Stage 3H engine modernization's working folder

Development only. Nothing here is served or loaded by the game.

| File | What it is |
|---|---|
| `CONTINUATION.md` | **Read first.** The continuation after M8 (owner's authorization of 2026-10-14): the debt ledger, its states and the waves C0 to C5 |
| `REPORT.md` | The M8 milestone report: what changed, where each part stood, parity, what remained hard, rollback, the package |
| `HUMAN_QA.md` | The owner's one-page Human QA guide (STAGE 3H ENGINE MODERNIZATION — HUMAN QA PENDING) |
| `CHECKPOINTS.md` | Every pushed checkpoint and the live status |
| `PRESERVATION_HOLD.md` | The owner's hold (2026-10-14, since resumed): what was done and verified, the bundle untouched |
| `SOURCE_RECOVERY_INTAKE.md` | The recovered original source: what was received, how it was authenticated, the v11 output against the served files, the lineage of every post-original client change, the decisions |
| `PREFLIGHT.md` | The state before any source moved: parent, refs, workspace, root, bundle provenance, deployment facts, baseline, scope |
| `PLAN.md` | The decisions the waves follow: layout, committed build outputs, modules and parts, proof per wave |
| `MODULE_EXTRACTION_PLAN.csv` | Every planned seam: legacy file and section, owner, lane, built output, unit, wave, proof |
| `FINDINGS.md` | This stage's findings (`M-…`) |
| `inventory/` | Machine-made inventories at the parent: root, tracked files, page boot order, requires, generators, bundle, path consumers, `ROOT_ARCHIVE_PLAN.csv`, remote heads |
| `evidence/` | What the checkpoints' commands produced, one folder per checkpoint; `remote/` holds the push receipts |
| `tools/` | This stage's own tools: `m0_inventory.js` (the inventories), `verify_remote_m.py` (the push check), `m1_relocate.js` (the H3M-1 move: `--dry-run`, `--apply`, `--verify`), `m1_copies_equivalence.js` (the gate's layout-aware copies against their originals, on the frozen layout), `m1_perf_paired.js` (is a perf-step failure a slowdown or noise? M-021), `m6a_replay_mutants.js` (the build refuses every tampering with the bundle's sources), `m6a_record_check.js` (a recorded bundle change is reproduced by the build), `m2_split_server.py` (the H3M-2 split of `server.js`: `--apply`, `--check`), `m2_free_names.js` (the names each server file uses undeclared), `m3_split_parts.js` (a part split by line ranges into owned parts, with headers), `m3_parts_mutants.js` (the parts checker refuses wrong headers and cut statements), `m7_archive_root.py` (the H3M-7 move of the root's reports into `dev/archive/`: `--apply`, `--verify`, `--root-after`, `--audit`), `m7_docs_mutants.js` (the documentation check refuses every stale table), `m7_scope_cases.js` (the scope step's rules for the moved root files), `m7_clean_rebuild.js` (the build from nothing, on a copy of the working tree or a fresh clone of a commit), `m8_served_identity.js` (every file the game runs against 3H2's and B++'s), `m8_package.js` (the Human QA package of a commit, with its manifest and receipts, each checked), `c0_audit.js` (the debt inventories: the bundle's steps and the parts' coupling), `c1_fetch_locked_packages.js` (run by the owner with internet access: the v11 toolchain's locked packages, each checked against the lockfile), `recovery_verify.py` (authenticates the recovery archive, read-only), `lineage_derive.js` (derives the client lineage), `api_contract.js` (the `__api` contract), `lineage_doc.js` (the lineage's generated pages), `secret_scan_m.py` (the pre-commit secret scan) |

Lasting development tools (the build, the checks, the gate, the layout map) live in `dev/tools/`. The developer documentation lives
in `docs/`.
