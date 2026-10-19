# Pre-Trial 3 final polish — baseline and plan (P0)

Branch `pre-trial3-final-polish`, created from the owner-accepted chat polish head C5 `63805e98867c3677261307b8cd597f63592b8c45`
(tree `60e4452bb90c3a9650022dcdae9c2a225c356a8d`). It is the only branch this work moves. The brief is the master pack of 2026-10-19
(`README_FIRST.md`, `01`–`10`, all checksums verified); its `baseline_C5/` files are byte-identical to C5's own.

## Baseline readback (2026-10-19, before any change)

| Ref | Expected (pack) | Found on GitHub |
|---|---|---|
| `post-trial4-chat-voice-polish` (C5) | `63805e9` | `63805e9` |
| `post-trial4-review-polish` (R4) | `1a89863` | `1a89863` |
| `trial-4-rgb-chat-accessibility` | `518b990` | `518b990` |
| `post-3h-trials-1-2-4` | `58fcf5b` | `58fcf5b` |
| `stage-3h-engine-modernization` | `4beba2f` | `4beba2f` |
| `main` | `7781e1a` | `7781e1a` |
| `pre-trial3-final-polish` | (new) | absent before P0 |

All 35 remote heads are recorded in `inventory/remote_heads_before.json`. Every push is checked by `tools/verify_remote_p.py`: the tip,
tree and parent; one straight line from `63805e9`; the protected branches above (C5 included) unchanged; no other branch moved or new.

On C5, unchanged: `npm run build:check` PASS (42 outputs, the manifest is what `src/` builds); `node dev/tools/docs/docs.js --check` PASS
(23 blocks); the `__api` contract CURRENT; working copy clean.

## Who owns what (C5 source, read before changing anything)

| Item | Owner (canonical source → served file) | What C5 does now |
|---|---|---|
| P1 danger flash | `src/core/client/mp.frame.js` → `public/mp.js`, the dread block | near a monster (k > .35) it randomly sets `#light`'s opacity to .35–.75. BR-RoLE documents `#light` as **the darkness overlay**, so this lifts the darkness off the whole scene for a frame: the likely bright flash (to be proven in a browser) |
| P1 death flash | bundle CSS `body.captured #dread` (white → red `flashout`, 1.4 s); `public/index.html` redefines `flashout` (still white first); `public/assets/ui.css` (Trial 4) turns the animation off (`animation:none!important`, a static .62 vignette) | no red impact at all at a capture |
| P1 capture sound | `src/frameworks/spacious-audio/client/mp.dread.js`: a MutationObserver on `body`'s class plays the capture burst whenever **any** class changes while `captured` is set | C1's `chat-icon-on` toggle (and any other body class change) may replay it: to be checked |
| P2 spawn shadow | `src/frameworks/br-role/client/br-role.js` (BR-RoLE 1.2: actor casts cut around the silhouette, self-shading, contact); avatars drawn by the bundle and `mp.peers` | to be reproduced at spawn first |
| P3 rail | `public/index.html` `.mm-util` (Settings gear path, the person icon wired `data-go="customize" data-sub="wanderer"`, Sound, Help); `src/frameworks/front/client/ui.js` (views); `public/assets/ui.css` | the person icon opens Customize |
| P4 RGB | `src/frameworks/front/client/rgb.js` → `public/assets/rgb.js` (targets `avatarMain`, `avatarHands`, `lightColor`, `stColor`) | sliders only |
| P5 version | `package.json` `23.3.6-hqa-search-polish`; `src/frameworks/front/client/credits_data.js` `version: '23.3.6'` (a hand copy, though its comment says it is package.json's); `ui.js` shows `'v' + TFB_CREDITS.version`; `ui.js`'s `VERSION = 'stage-3c-qa2'` is the interface controller's own tag | two hand-kept copies |
| P6 credits | `credits_data.js` → `public/assets/credits_data.js`; `ui.js` renders it; `public/index.html` `.mm-src` footer paragraph | RoYoshi only; Mariikyu absent; wiki and CC BY-SA 3.0 links present in Credits *and* in the footer |
| P7/P8 audio | AudioContexts: the bundle's (game sounds, its own mute), `mp.dread.js` (heartbeat, drone, bursts), `ui.js` (the menu theme: intro + loop WAVs, gain .7), `voice.js` (C5 voices: own bus, master, mute), offline ones for decoding; `src/frameworks/front/client/hud.js` keeps `fb_settings_v1` with master `vol` | no UI sounds; no music or UI volume |

## Plan

Each checkpoint reproduces its defect on this branch first, changes the narrowest owner, rebuilds the served files from `src/`
(`npm run build`, never by hand), runs only the checks that cover the change, then is committed, pushed fast-forward and read back.

| # | Change | Focused checks |
|---|---|---|
| P1 | `#light` never lightened by the dread; one red-only impact on `body.captured #dread` (calmer under reduced motion); the capture burst once per capture | a browser trace near a Hound (the scene's brightness frame by frame; `#light`'s opacity), a capture (the `#dread` layer's colour over time, normal and reduced motion), the burst count; build:check; the fast tier's page/golden steps |
| P2 | after reproducing: the smallest fix at the layer that is wrong | before/after screenshots at spawn, LOW/MEDIUM/HIGH, a peer; BR-RoLE's own tests |
| P3 | the person icon opens a small accessible "Accounts Coming Soon..." panel; the gear redrawn crisp and centred | a browser check at four sizes: never Customize, Escape/Close return focus, phone tap |
| P4 | typeable R/G/B fields beside every slider, one source of truth, commit on change/blur/Enter | the RGB browser check extended: typing, swatch then type, invalid input, reset, reload, two clients |
| P5 | `package.json` the one source; the build writes it into the credits data; a drift check | build:check; the menu shows what package.json says |
| P6 | RoYoshi and Mariikyu as asked; Credits organized; the footer paragraph moved into Credits, every link and licence kept | a browser check of Credits and the menu |
| P7 | a few small original synthesized UI sounds (MP3 if an encoder exists here), one UI sound controller | asset inventory, a duplicate/throttle check |
| P8 | Music and UI volume in Settings → Sound, as gain buses beside the theme | a routing check with each slider and master mute |
| P9 | integration: build, fast tier, the affected browser checks, a C5 chat/voice smoke; reports; STOP | as listed |

Evidence lives in `dev/pre-trial3-final-polish/evidence/` (screenshots only where they show something). Scratch work stays outside the
repository and nothing is relied on after a session ends.

## Owner decisions this work cannot make

- **The version number.** None has been chosen. P5 makes one source and keeps the currently approved label; a new number is the owner's.
- **Mariikyu's name style.** The brief writes "Mariikyu" and no spelling exists in the repository; the owner has elsewhere written her
  name in subscript letters (ₘₐᵣᵢᵢₖᵧᵤ). P6 uses "Mariikyu" and asks.
