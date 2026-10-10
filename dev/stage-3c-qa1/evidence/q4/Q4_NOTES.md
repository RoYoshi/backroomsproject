# Stage 3C QA1, Q4: the touch stick, the action buttons, the installable app

## The stick (`assets/ui.js`, `#stickZone` inside the game's touch layer)

- **Where:** a floating stick in the lower left, on touch screens and only during play (it lives in the game's own touch layer). Put a thumb down anywhere in the zone (the lower-left half, below the status) and the stick appears under it; drag to move.
- **What it drives:** the same four direction keys the keyboard and the old pad drive, eight ways. A direction counts once the thumb leans more than 22.5 degrees towards it.
  - The game's own movement does the rest: the same speed, diagonals normalised by the game, no analog advantage.
  - On touch the game's aim follows the direction, as with the old pad. No movement code was changed.
- **Feel:** a 12 px dead zone at the centre; knob travel capped at 52 px. Lifting, cancelling or losing the touch (or the window losing focus) clears the move at once.
- **Idle:** a faint ring in the lower left shows where to put a thumb; it brightens while held and fades back on release.
- **The old pad:** hidden, not removed (the game binds its buttons by `data-key` at start).
- **Action buttons:** RUN, CROUCH, LIGHT and INV stay on the right, bigger, with RUN and CROUCH at the thumb; NV, IR and ZOOM appear with the camcorder.
  - LIGHT, INV and the camcorder's buttons now act on the press, so they work while the other thumb holds the stick: a browser produces no click for a tap while a second finger is down.
  - A lone tap still acts exactly once.
  - RUN and CROUCH are the game's own hold buttons and already worked under multitouch.
- **Safe areas:** the page asks for the whole screen (`viewport-fit=cover`) and keeps everything inside `env(safe-area-inset-*)`: PAUSE, the buttons, the status, the stick's resting place, dialogs, sheets, the inventory drawer and the hints.

**Measured** (`probe_q4.json`; real Chromium touch input, the test clock stepped 1/60 s per frame):

| Stick | Per game tick | Keyboard |
|---|---|---|
| Right | 2.865811 px | D: 2.865811 px |
| Up-right | 2.026434 px on each axis (the same 2.8658 px overall) | W + D: 2.026434 / 2.026434 |
| Left | -2.865811 px | A: -2.865811 px |
| Right + RUN (second finger) | 4.746606 px | Shift + D: 4.746606 px |

- **The eight-way reading** matched the rule at 24 angles.
- **Layouts:** checked at 360x640, 390x844 (notch 47 px, home indicator 34 px), 430x932, 768x1024 and 844x390 (notch on the side). Nothing sits outside the safe area or under the stick zone, the status or the reveal, and there is no sideways scroll.

## The installable app

- **`assets/manifest.webmanifest`:**
  - name, short name, `display: standalone`, `start_url` and `scope` `/` (the game itself), `orientation: any`, dark theme and background;
  - Chromium parses it with no errors and reports no installability errors.
- **`index.html`:** links the manifest, adds `viewport-fit=cover`, the theme colour, and the iOS / Android app metadata (standalone capable, black-translucent status bar, a short title).
- **No service worker:** an online game, always the live build. There is no offline mode and nothing is cached for the game (the menu theme's Cache Storage holds only those two audio files, under their content hashes).
- **Browser tabs still work as before:** no banner and no nagging. Help ("i" on the menu) explains, once, how to add the game to a home screen on iPhone / iPad and Android.
  - Where the browser offers an install itself, Help shows an Install button instead of the browser's banner.
  - Launched as an app, Help says so.
- **No icon:** the project has no official game icon, and none was drawn. iOS uses a picture of the page; Android shows a plain lettered tile. To give the app its real icon:
  1. Add `assets/icon-192.png` (192x192) and `assets/icon-512.png` (512x512).
  2. List them in the manifest's `icons`: `{"src":"icon-192.png","sizes":"192x192","type":"image/png"}` and the same for 512.
  3. Add `<link rel="apple-touch-icon" href="./assets/icon-192.png">` to `index.html`.

  `server.js` already serves PNGs from `assets/`.
- **What the page cannot do:** JavaScript cannot remove a browser's address bar in an ordinary tab; only the installed app opens without it.
