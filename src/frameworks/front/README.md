# F.R.O.N.T.: menus and the HUD

`src/frameworks/front/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does. Post-3H Trial 1 changes one thing on purpose: the main menu's title drifts a few pixels on its own (below).

## What it owns

What frames the game: the menus, the settings, the key bindings and the menu theme's audio (`client/ui.js`), the settings model and the HUD's polish (`client/hud.js`), the credits (`client/credits_data.js`: edit it to change the Credits page) and the NEW RUN button's and run menu's words (`client/net-newrun.js`). The page itself (`public/index.html`) and its stylesheet (`public/assets/ui.css`) are static files, edited where they are.

## What it must not own

Whether NEW RUN is approved, or any server rule: the words show the server's answer, never decide it.

## Its rule

The words on screen reflect what the server actually answered.

## Its files

<!-- generated: sources:front (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/credits_data.js`](client/credits_data.js) | THE FAR BACKROOMS - credits.  EDIT THIS FILE to change the Credits page; the layout never needs touching. | `public/assets/credits_data.js` |
| [`client/hud.js`](client/hud.js) | The settings model and the HUD's own polish. | `public/hud.js` |
| [`client/net-newrun.js`](client/net-newrun.js) | net-newrun.js - the NEW RUN button's words and the run menu's, for the multiplayer layer (mp.js). | `public/assets/net-newrun.js` |
| [`client/ui.js`](client/ui.js) | THE FAR BACKROOMS - Stage 3C UI controller (QA1: the main menu rebuilt from the user's rough draft, and its theme; QA2: the | `public/assets/ui.js` |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- `index.html` loads every script in order; `ui.js` drives the menus around the compiled bundle's game.
- The settings live in the browser's storage (V.A.U.L.T.'s future concern).
- Post-3H Trial 1: the main menu's title (the user's logo) drifts on its own, within 3 px an axis, added to the pointer's lean. `ui.js`
  runs one animation-frame loop for it, only while the revealed menu is shown, the tab is visible and motion is not reduced (Settings,
  or the device's under System); `ui.css` adds the drift to the title's transform (`--dx`, `--dy` times `--drx`, `--dry`). The title
  takes no pointer events, so no control moves. `window.__ui.drift()` reports the loop's state for its checks.

## Changing it

Edit, `npm run build`. A key binding: `client/ui.js`, its keybinds section.

## Tests

- The client goldens and mutants of the gate cover `net-newrun.js` (the button's words); the browser checks open the menus.
- `dev/tools/checks/menu_drift.js` (the gate's full-tier `menu` step) checks the title's drift against the accepted C5d in a real
  Chromium: it moves with no pointer, within its bounds; it stops for a hidden tab, reduced motion and a run, and resumes with one loop;
  the menu's controls, text, Tab order, logo and theme are C5d's; its eight mutants are caught.

## Known debt

- `ui.js` (102 KB) and `hud.js` stay whole (M-025).
