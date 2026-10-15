# H.A.N.D.S.: input and bindings

`src/frameworks/hands/`. A name only: no code of its own in this repository yet. It has no stub either: the related code lives with the owners named below. Stage 3H gave it this folder and this README, nothing else.

## What it owns

Keyboard, pointer and touch, mapped to the game's actions.

## What it must not own

Deciding whether a move is legal or authorising anything: the server does.

## Its rule

An input maps to one intent; rebinding and mobile keep working.

## Its files

<!-- generated: sources:hands (dev/tools/docs/docs.js) -->
No file of its own: this framework has no code in this repository yet (see above).
<!-- end of generated block -->

## How it connects

The game's own keys are in the compiled bundle; the bindings' settings are in F.R.O.N.T.'s `ui.js`; other keys are read by the inventory (`inventory.js`), the camcorder (`camcorder.view.js`), the admin's panel and death lab (`mp.admin.js`) and the Level 0 remaster (`l0-remaster.js`); the dread's sound starts on the first key or touch (`mp.dread.js`).

## Changing it

This framework gets code only when the owner approves its design. Until then, change the related code with its present owner.

## Tests

None of its own.

## Known debt

None of its own.
