# V.A.U.L.T.: local settings and future saves

`src/frameworks/vault/`. A name only: no code of its own in this repository yet. It has no stub either: the related code lives with the owners named below. Stage 3H gave it this folder and this README, nothing else.

## What it owns

Settings and key bindings with versions and migrations; saved progress, if ever authorised.

## What it must not own

Accounts or cloud saves, corpses, and any admin secret.

## Its rule

Stored data has a version and a migration.

## Its files

<!-- generated: sources:vault (dev/tools/docs/docs.js) -->
No file of its own: this framework has no code in this repository yet (see above).
<!-- end of generated block -->

## How it connects

The settings are in the browser's storage today, written by F.R.O.N.T. (`ui.js`, `hud.js`), BR-RoLE (`br-role.js`'s quality) and the admin menu (`mp.admin.js`).

## Changing it

This framework gets code only when the owner approves its design. Until then, change the related code with its present owner.

## Tests

None of its own.

## Known debt

None of its own.
