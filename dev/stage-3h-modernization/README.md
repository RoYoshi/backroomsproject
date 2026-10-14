# dev/stage-3h-modernization: the Stage 3H engine modernization's working folder

Development only. Nothing here is served or loaded by the game.

| File | What it is |
|---|---|
| `CHECKPOINTS.md` | **Read first.** Every pushed checkpoint and the live status |
| `PRESERVATION_HOLD.md` | The owner's hold (2026-10-14, since resumed): what was done and verified, the bundle untouched |
| `SOURCE_RECOVERY_INTAKE.md` | The recovered original source: what was received, how it was authenticated, the v11 output against the served files, the lineage of every post-original client change, the decisions |
| `PREFLIGHT.md` | The state before any source moved: parent, refs, workspace, root, bundle provenance, deployment facts, baseline, scope |
| `PLAN.md` | The decisions the waves follow: layout, committed build outputs, modules and parts, proof per wave |
| `MODULE_EXTRACTION_PLAN.csv` | Every planned seam: legacy file and section, owner, lane, built output, unit, wave, proof |
| `FINDINGS.md` | This stage's findings (`M-…`) |
| `inventory/` | Machine-made inventories at the parent: root, tracked files, page boot order, requires, generators, bundle, path consumers, `ROOT_ARCHIVE_PLAN.csv`, remote heads |
| `evidence/` | What the checkpoints' commands produced, one folder per checkpoint; `remote/` holds the push receipts |
| `tools/` | This stage's own tools: `m0_inventory.js` (the inventories), `verify_remote_m.py` (the push check), `m1_relocate.js` (the H3M-1 move: `--dry-run`, `--apply`, `--verify`), `m1_copies_equivalence.js` (the gate's layout-aware copies against their originals, on the frozen layout), `m1_perf_paired.js` (is a perf-step failure a slowdown or noise? M-021), `recovery_verify.py` (authenticates the recovery archive, read-only), `lineage_derive.js` (derives the client lineage), `api_contract.js` (the `__api` contract), `lineage_doc.js` (the lineage's generated pages), `secret_scan_m.py` (the pre-commit secret scan) |

Lasting development tools (the build, the checks, the gate, the layout map) live in `dev/tools/`. The developer documentation lives
in `docs/`.
