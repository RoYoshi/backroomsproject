# P.U.L.S.E.: diagnostics and performance

`src/frameworks/pulse/`. A name only: no code of its own in this repository yet. It has no stub either: the related code lives with the owners named below. Stage 3H gave it this folder and this README, nothing else.

## What it owns

Measuring the frame, the server and the network: budgets, logs, overlays and regressions, as a read-only observer.

## What it must not own

Gameplay logic, and any automatic lowering of quality on a player's machine.

## Its rule

Instruments have a budget, respect privacy, and their overlays are opt-in.

## Its files

<!-- generated: sources:pulse (dev/tools/docs/docs.js) -->
No file of its own: this framework has no code in this repository yet (see above).
<!-- end of generated block -->

## How it connects

Today the counters are scattered: the server's step timings (`room.pf`, in `src/core/server/loop.js`), BR-RoLE's `stats()`, the admin's debug data (`mp.js`), the ping and pong of the session (`server.js`). The gate's perf step measures from outside (`dev/tools/gate/golden/perf_det.js`).

## Changing it

This framework gets code only when the owner approves its design. Until then, change the related code with its present owner.

## Tests

None of its own.

## Known debt

None of its own.
