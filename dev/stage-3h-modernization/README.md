# dev/stage-3h-modernization: the Stage 3H engine modernization's working folder

Development only. Nothing here is served or loaded by the game.

| File | What it is |
|---|---|
| `PREFLIGHT.md` | The state before any source moved: parent, refs, workspace, root, bundle provenance, deployment facts, baseline, scope |
| `PLAN.md` | The decisions the waves follow: layout, committed build outputs, modules and parts, proof per wave |
| `MODULE_EXTRACTION_PLAN.csv` | Every planned seam: legacy file and section, owner, lane, built output, unit, wave, proof |
| `CHECKPOINTS.md` | Every pushed checkpoint: commit, tree, tests, rollback |
| `FINDINGS.md` | This stage's findings (`M-…`) |
| `inventory/` | Machine-made inventories at the parent: root, tracked files, page boot order, requires, generators, bundle, path consumers, `ROOT_ARCHIVE_PLAN.csv`, remote heads |
| `evidence/` | What the checkpoints' commands produced, one folder per checkpoint; `remote/` holds the push receipts |
| `tools/` | This stage's own tools: `m0_inventory.js` (the inventories), `verify_remote_m.py` (the push check) |

Lasting development tools (the build, the checks, the gate, the layout map) live in `dev/tools/`. The developer documentation lives
in `docs/`.
