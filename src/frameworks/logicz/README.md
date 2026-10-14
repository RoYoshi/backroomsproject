# LogicZ: vertical world rules (future)

`src/frameworks/logicz/`. A name only: no code of its own in this repository yet. It has no stub either: the related code lives with the owners named below. Stage 3H gave it this folder and this README, nothing else.

## What it owns

Height: elevation-aware geometry, collision, sight and drawing, if the owner ever authorises it.

## What it must not own

Replacing or destabilising the 2D game. No fake heights and no always-zero Z fields are added to live code.

## Its rule

THE 2D GAME IS THE GAME. Z MAY EXPAND IT, NOT REPLACE IT.

## Its files

<!-- generated: sources:logicz (dev/tools/docs/docs.js) -->
No file of its own: this framework has no code in this repository yet (see above).
<!-- end of generated block -->

## How it connects

Nothing. The crawl zones of `world.js` (S.P.A.C.E.) are 2D areas, not height. A future contract would sit between S.P.A.C.E. (collision and placement), N.A.N.I. (sight and navigation) and BR-R / BR-RoLE (drawing and light), with the server deciding.

## Changing it

This framework gets code only when the owner approves its design. Until then, change the related code with its present owner.

## Tests

None of its own.

## Known debt

None of its own.
