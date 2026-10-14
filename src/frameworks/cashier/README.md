# CASHIER: cache ownership and budgets

`src/frameworks/cashier/`. A name only: no code of its own in this repository yet. It has no stub either: the related code lives with the owners named below. Stage 3H gave it this folder and this README, nothing else.

## What it owns

Writing down each owner's caches: their lifetimes, invalidation and memory budgets.

## What it must not own

A global state store, or anything that changes the simulated world.

## Its rule

Each owner keeps its own cache; a global manager only after measurements.

## Its files

<!-- generated: sources:cashier (dev/tools/docs/docs.js) -->
No file of its own: this framework has no code in this repository yet (see above).
<!-- end of generated block -->

## How it connects

The caches today: the static server's gzip copies and cache headers (`ward/server/static.js`), the snapshot history (`bpp/client/net-interp.js`), the sound buffers (`spacious-audio/client/sfx.js`), BR-RoLE's light caches, the menus' audio (`front/client/ui.js`).

## Changing it

This framework gets code only when the owner approves its design. Until then, change the related code with its present owner.

## Tests

None of its own.

## Known debt

None of its own.
