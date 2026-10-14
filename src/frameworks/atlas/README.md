# A.T.L.A.S.: asset provenance and packaging

`src/frameworks/atlas/`. A name only: no code of its own in this repository yet. It has no stub either: the related code lives with the owners named below. Stage 3H gave it this folder and this README, nothing else.

## What it owns

Where every asset came from, what the page may load, and a release manifest.

## What it must not own

Making texture atlases, or changing approved assets: the name is not permission.

## Its rule

Masters stay private; nothing is converted without the owner.

## Its files

<!-- generated: sources:atlas (dev/tools/docs/docs.js) -->
No file of its own: this framework has no code in this repository yet (see above).
<!-- end of generated block -->

## How it connects

The served assets are `public/assets/` (images, the menu's music) and `public/sounds/`; the menu theme's master is `audio_source/` (never served). The shipped carpet is a placeholder the HAR recovery generated; the authentic one is in the recovered v11 project, and swapping it is the owner's decision (FINDINGS M-013).

## Changing it

This framework gets code only when the owner approves its design. Until then, change the related code with its present owner.

## Tests

None of its own.

## Known debt

None of its own.
