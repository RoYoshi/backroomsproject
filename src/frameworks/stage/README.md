# S.T.A.G.E.: testing and QA gates

`src/frameworks/stage/`. A name only: no code of its own in this repository yet. It has no stub either: the related code lives with the owners named below. Stage 3H gave it this folder and this README, nothing else.

## What it owns

Baselines, focused regression checks, Human QA hand-offs and reversible checkpoints.

## What it must not own

Accepting anything: automated checks never grant Human QA.

## Its rule

Lean, risk-focused gates and playable hand-offs.

## Its files

<!-- generated: sources:stage (dev/tools/docs/docs.js) -->
No file of its own: this framework has no code in this repository yet (see above).
<!-- end of generated block -->

## How it connects

Development only, so it lives in `dev/`, not here: `dev/tests/` (the scenario suite), `dev/tools/gate/` (the gate), `dev/tools/checks/`, the stage folders (`dev/stage-*/`), and the earlier stages' reports in `dev/archive/`.

## Changing it

This framework gets code only when the owner approves its design. Until then, change the related code with its present owner.

## Tests

None of its own.

## Known debt

None of its own.
