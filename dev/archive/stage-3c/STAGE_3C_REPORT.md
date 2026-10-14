# Stage 3C report: UI, HUD, customization and the game's main menu

**Branch `stage-3c`** (repository `RoYoshi/backroomsproject`)
- **Base:** started from the accepted Stage 3B commit `6e6fa46ecab537f716942b94f873776b09049a40` (tree `33ed11b672d3a2a45767accccbb9f04fdd7949c3`).
- **History:** six checkpoints in a straight line, never force-pushed.
- **Other branches:** `main` and every other branch are untouched.

Stage 3C is presentation only.
- **Untouched:** the world, the lighting (BR-RoLE and its warm-up), the 1.25 camera and its 1536 x 864 envelope, night vision, the remaster, the monsters, movement, collision and the network timing.
- **The proof:** `STAGE_3C_PACKAGE_RECEIPT.txt` checks every one of those files is byte-identical to the parent.

## Checkpoints

| | Commit | Tree | What |
|---|---|---|---|
| C0 | `16a6b1723695bcdf542ed830f8b9345b65294b2b` | `788606e214b8ed961f352cc28bf6d2d88b36c058` | audit, freeze, ownership plan (`STAGE_3C_C0_UI_AUDIT.md`) |
| C1 | `cf3f8b112e3798d911b49afc24b8c8e377f7b8cc` | `3ef344fe8db37813b9cd258e38c6a7b13d686de9` | the game's main menu, sheets, Settings and Credits pages |
| C2 | `ad1f34493e6c6b7d3a4579fb07d760a66e288d05` | `f47420172073baf14a40465d2e5e4ad9e3c85508` | HUD, pause, caught / won / run, hints, touch |
| C3 | `3249cbb60aeb699098363a46827201ff047cf298` | `c84cc97f33f697491c90496f816d6bb52508ab1e` | customize: WANDERER and LOADOUT; backpacks removed |
| C4 | `370a3bb432ff41d64d115a3730d3b945a692c541` | `52ee5f23ca29625c5133f7a20a96710273b15789` | settings migration, reduced motion, accessibility |
| C5 | this commit (see the receipt) | | credits, integration, the menu performance fix, regressions, documents |

Each checkpoint was verified on GitHub after its push: `git ls-remote` and the REST API commit, tree and parent, plus every other branch's tip. The records are in `dev/stage-3c/evidence/c*/remote_c*.json`; C5's is in the receipt.

## What changed

### The game's main menu (C1)
- **Where you land:** the page opens on a real game menu: **PLAY / CUSTOMIZE / SETTINGS / CREDITS** beside a focused Level 0 entry panel.
  - **The panel:** your name, your equipped light (drawn by the game's own painter, with a one-line description and **Change**), **ENTER LEVEL 0**, and a headphones / controls note.
  - **Start controls:** `#name` and `#enter` are still the game's own controls, so starting a run is unchanged (exactly one join per start, checked). The name is remembered.
- **The one bold element:** a fluorescent tube that lights the title on entry and dips softly once every 11 s. It never strobes.
- **The rest is quiet:** black framing, sickly yellow and cream, moss-grey labels, restrained red only for danger. Barlow Condensed and IBM Plex Mono, rectangular geometry. The darkened world stays visible behind the menu.
- **Nothing fake:** no CONTINUE, accounts, cloud save, level select, countdown or invented player counts. The game's own connection line (SOLO / ONLINE, room, the real wanderer count) sits in a corner.
- **Settings and Credits:** right-hand sheets with a focus trap, Escape, and focus returned to the button that opened them.

### HUD, pause and run states (C2)
- **Where everything sits:**

  | Position | What |
  |---|---|
  | Top left | the objective, and the connection line under it |
  | Bottom left | name, stance, stamina (amber, then red when low), light / camcorder |
  | Top right | PAUSE (the game's own pause) and Sound, then level and sector |
  | Bottom right | coordinates |

  The centre is clear. Every readout keeps its id and its writer; nothing about what they report changed.
- **HUD settings:** colour, size, opacity, key hints, fading, coordinates and title drive the new layout.
- **Pause:** CONTINUE / Settings / Customize / NEW RUN beside the controls reference.
- **Caught, won, run menu:** caught (red rule, RESPAWN, CHANGE LOADOUT), won (RESTART LEVEL 0) and the run menu (SPAWN / CUSTOMIZE / END) share one panel family. Hints are restyled, off-centre, and never flash.
- **Touch:** the pad sits bottom left; LIGHT / INV / RUN / CROUCH bottom right, plus NV / IR / ZOOM with the camcorder. INV opens the game's inventory, PAUSE sits top right, and the HUD is compact at the top. Portrait and landscape are both laid out.
- **Fixed on the way:**
  - Tab no longer opens the inventory behind the pause screen; it moves focus.
  - Space presses focused menu buttons.
  - The parent's overlapping phone HUD now has no overlaps, checked by measuring every box and its text.

### Customize: WANDERER and LOADOUT (C3)
- **WANDERER:**
  - A live preview of the round body with two round hands, and no limbs.
  - Body and hand colour: swatches plus a custom picker. Texture and hat: chips.
  - The chips and swatches set the game's own fields and fire the same events, so saving, the preview, the in-world wanderer and what peers see are still the game's.
- **Cosmetic backpacks are removed:**
  - The field remains only as the game's "none".
  - A saved legacy backpack is migrated to "none" before the game reads the save.
  - An older client's backpack is not drawn (`mp.js`, one line).
  - No backpack equipment was built.
- **LOADOUT:**
  - **Devices:** flashlight, headlamp, lantern, Night Vision Camcorder, each with its close-up, part colours and beam colour (the camcorder has none).
  - **Camcorder wording:** "Night Vision Camcorder emits no visible light; its night vision uses infrared."
  - **One device per run:** still enforced; the cards are locked during a run, while your look can still change.
  - **Peers:** two wanderers in one room see each other's look and light (`probe_c3`, with a screenshot).
- **The preview only draws while Customize is open:** one insertion in the bundle exposes the preview renderer, and `assets/ui.js` starts and stops it.

### Settings and accessibility (C4)
- **Saved settings carry over:**
  - `fb_settings_v1` is kept: a pre-3C save loads unchanged, gains `rm` (reduced motion), and is written back complete.
  - Damaged values fall back to their defaults.
- **Real controls only:**

  | Page | Controls |
  |---|---|
  | Sound | sound and master volume |
  | HUD | colour, size, opacity, key hints, fading, coordinates, title |
  | Display | lighting and shadows quality (BR-RoLE's own tiers, remembered the way BR-RoLE remembers them), reduced motion (System / On / Off) |
  | Controls | the keyboard and touch reference |

  There is no zoom or awareness setting.
- **Reduced motion:** a saved choice holds from the first frame. It stills the menu, the HUD fades and the screen effects' CSS animation.
- **Keyboard:**
  - Arrows move through the menu, the tabs and every radio group (one Tab stop each).
  - Focus traps only count what Tab can reach, and Escape is consistent.
  - Typing and sliders never move the wanderer (checked).
- **Contrast:** every text token is 5:1 or better on every panel (checked).

### Credits, integration, polish (C5)
- **Credits:**
  - Built from `assets/credits_data.js`; sections left empty are hidden, and nothing is invented.
  - It lists Created by (RoYoshi) and the Backrooms Wiki / CC BY-SA 3.0 attribution with links (also kept on the pause screen and the menu).
  - Software and typefaces are listed only because they are actually used: PixiJS 8.21.0 as bundled; Barlow Condensed and IBM Plex Mono, loaded by the game's stylesheet.
- **The one performance regression this pass found (in its own menu) is fixed:** see `STAGE_3C_PERFORMANCE.md`.

## Where the UI lives
- **New files:**
  - `assets/ui.js`: the controller. Event-driven, no loops.
  - `assets/ui.css`: tokens and every Stage 3C style.
  - `assets/credits_data.js`: the editable credits.

  They live in `assets/` because `server.js` serves that folder; `server.js` is unchanged.
- **UI-facing edits to existing files, each checked exactly by the receipt:**

  | File | Edit |
  |---|---|
  | the bundle | one insertion (the preview renderer) |
  | `mp.js` | one line (no backpacks on peers) |
  | `inventory.js` | three camcorder strings |
  | `hud.js` | now the settings model only; its dropdown moved to `ui.js` |
  | `index.html` | the new markup; every parent element id is kept |

## Validation on the final tree

| Check | Result |
|---|---|
| `dev/stage-3c/probe_c1.js`: main menu, sheets, entry flow, pause Settings, Tab and inventory, reduced motion, 390 x 844 | 23/23 PASS |
| `dev/stage-3c/probe_c2.js`: HUD layout (desktop, touch portrait / landscape, camcorder) without overlaps, readouts, pause / resume, HUD settings, run states | 18/18 PASS |
| `dev/stage-3c/probe_c3.js`: customize, backpack migration, preview idle when closed, loadout, parts, camcorder wording, run lock, two wanderers and an older client, touch | 13/13 PASS |
| `dev/stage-3c/probe_c4.js`: settings migration, damaged values, keyboard, reduced motion, only real controls, contrast | 11/11 PASS |
| `dev/stage-3c/probe_c5.js`: credits from data, keys never leak into play, Escape, no UI animation frames in play, win / restart, NEW RUN / END / ENTER, responsive at eight sizes | 7/7 PASS |
| `dev/tests/lifecycle_mp.py` (retained): NEW RUN, start from the title, death then RETRY | PASS |
| `dev/stage-3b-n/test_3bn.js`: camera lock 1.25 / 1536 x 864 | 7/7 PASS |
| `dev/tests/s_camera_fairness.js` | CAMERA FAIRNESS: 12/12 PASS |
| `dev/br-role/test_br_role.js`: BR-RoLE focused unit checks | 32/32 PASS |
| Performance: parent vs Stage 3C | gameplay with menus closed within noise; preview 0 draws/s when closed (was 3–7) |

The results are in `dev/stage-3c/evidence/c5/`; each earlier checkpoint's are in its own folder.

## Evidence
- **Screenshots** (JPG, `dev/stage-3c/evidence/`):
  - `c0/`: the parent;
  - `c1/` to `c4/`: each checkpoint;
  - `c5/`: the final build, plus `before_after_desktop.jpg` and `before_after_touch.jpg` (parent left, Stage 3C right) and `c5_resp_*.jpg` (responsive: 1920x1080 down to 360 x 640 touch).
- **Performance:** `c5/perf_ab_final.json`, `c5/perf_ab_before_fix.json`, `c5/menu_haze_isolation.json`.

## Notes and known limits
- **Fonts in the screenshots:** the sandbox could not load Google Fonts, so the screenshots use fallback faces (wider than Barlow Condensed). The title is sized to fit either way and grows to its full size once Barlow Condensed has loaded.
- **Software rendering:** all browser checks and numbers come from SwiftShader on 2 CPUs. No claim is made about real GPUs.
- **Unchanged behaviours, kept on purpose:**
  - **Hidden device text:** the bundle's hidden one-line device description still reads "No light at all..." for the camcorder. It is never shown, because the loadout cards replace it, and it was left alone to keep the bundle edit to one insertion.
  - **Pause while online:** a monster that catches you while you are paused still ends the pause to play the death, as before. This is the game's own rule.
  - **Sound on narrow and touch screens:** the Sound button moves into Settings.
- **Not done:** no next stage was started, and `main` was not modified.

**STAGE 3C UI HUMAN-QA CANDIDATE — WAITING FOR USER**
