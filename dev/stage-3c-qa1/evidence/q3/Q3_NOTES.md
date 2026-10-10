# Stage 3C QA1, Q3: the minimal HUD, location reveals, Controls / keybinds

## The HUD during play: status, not a dashboard

| Element (still written by the game) | First candidate | QA1 |
|---|---|---|
| Wanderer name, pace (WALKING...), light state (FLASHLIGHT ON) | permanent, bottom left | not shown (the light shows itself in the world) |
| Controls strip | permanent, bottom left | gone. Keys live in Settings > Controls, the pause screen, Help, and one line as a run begins (Key reminder) |
| Objective | permanent, top left | shown as a run begins (in the reveal) and on the pause screen |
| LEVEL 0 / sector | permanent, top right | an event: the reveal below |
| Connection line | permanent, under the objective | the pause screen and the menu only |
| Coordinates | on by default, bottom right | an option, **off by default** |
| SOUND ON button | top right | Settings and the pause screen's Settings (the menu's rail on the menu) |
| Stamina | permanent number and bar | **contextual**, bottom left (top left on touch: the stick owns the lower left). It appears the moment stamina changes, stays while below full, fades 1.8 s after it is full again, and turns urgent (danger colour, thicker) below 25. The game's own value: drain, recovery and timing untouched |
| Health | none | a **dormant slot** above stamina, hidden. The game has no health, so nothing fills it. Insertion point for a future health system: `window.__hud.health(v)` (0 to 100 shows it, calm when full, urgent when low; `null` hides it) |
| PAUSE | top right | stays, quieter |
| Hints (encounter, blackout), inventory toast, camcorder viewfinder | contextual | unchanged |

True darkness is untouched: nothing added lights the world; readability comes from text shadow and the HUD colour.

## Location reveals (`assets/ui.js`, `#hudReveal`)

- **As a run begins** (the game shows its HUD: ENTER LEVEL 0, SPAWN, RESTART):
  - The reveal is THRESHOLD / LEVEL 0, the objective, and with Key reminder on, one line of the player's own keys.
  - It sits high in the frame and fades after about 4 s. The centre stays empty.
- **On a real change of part of the level:** the game's own sector line (`01 / YELLOW HALL`), smaller, fading after 2.6 s.
  - The part must hold for 1.5 s, so walking along a border does not flicker.
  - Connecting passages are not announced, nor the same part twice in a row, nor where the run started.
- **Settings > HUD > Location reveals** (the old title switch) turns the names off. The objective and key line still show as a run begins.
- No per-frame work: timers, plus a mutation observer on the game's sector line.

## Settings model (`hud.js`, `fb_settings_v1`): same fields, saves now carry `v: 2`

- **`title`:** the location reveals. **`keys`:** the key reminder. **`coords`:** the optional coordinates overlay, default **off**.
- **Old saves:** a save without `v` (every pre-QA1 save) has `coords` switched off once, because the old default was on. Everything else is kept (colour, size, opacity, volume, reduced motion, title, keys).
- **`auto`:** stays in the save, unused (it faded the controls strip).

## Controls / keybinds (`assets/ui.js`; Settings > Controls)

- **Real actions only**, from the parent's own listeners:

| Action | Defaults |
|---|---|
| Move up / left / down / right | W A S D, and the arrow keys |
| Run | Shift, both |
| Crouch / slide | C |
| Light / raise the camcorder | F |
| Night vision | N |
| Infrared | B |
| Zoom | Z |
| Inventory | Tab |
| Cartograph | M |

- **Each action has a first and a second key.** The second can be cleared with Delete.
- **Fixed, never offered:** Esc (pause), the mouse (aim, right-click night vision, wheel zoom), the admin key, the touch controls.
- **How it works:** a small input adapter at the window's capture phase, ahead of every game listener.
  - A rebound key is passed on as the code the game already reads; a default key that no longer belongs to its own action is held back.
  - It works only while a run is live (started, not paused, nothing open), and a release always follows its press.
  - **With the default bindings it intercepts nothing at all:** the probe sees every press reach the page trusted, once, unchanged, and the same sequence as the first candidate's.
  - **Frame for frame (the test clock stepped 1/60 s per frame) the walk is identical** to the first candidate's: 54 ticks of D = 153.893 px; 54 ticks of Shift + W + D = 252.775 px at -45 degrees, spending 6.25 stamina; 40 ticks of C + A = 60.214 px.
  - **A rebound key** (Move up on F) walks exactly as W did (40 ticks = 113.759 px up); W then does nothing; the arrow still works.
  - Movement physics, speeds, normalisation and timing are not touched.
- **Capture:**
  - "Press a key"; Esc cancels; the sheet's own Escape and Tab do not fire meanwhile, and no key reaches the game.
  - Keys kept for the game or the browser are refused: Esc, the admin key, F1 to F12, Ctrl / Alt / Meta, Caps Lock and other system keys.
  - A key already used elsewhere is shown as a conflict, and nothing changes until **Swap** or Cancel. A swap that would leave an action with no key is refused.
- **Reset controls to defaults.** Bindings are saved as `tfb.keys.v1`; a damaged save (one key on two actions) is ignored and the defaults are used.
- **Labels follow the bindings everywhere a key is named:**
  - the pause screen's list;
  - the menu entry's note;
  - Help;
  - the run-begins key line;
  - Customize's camcorder note;
  - the camcorder's viewfinder line (rewritten in place: `camcorder.js` writes it once, and with default keys it is left exactly as written);
  - the inventory drawer and its pick-up toast. These go through three label hooks in `inventory.js`; that file has text-only changes.
- **Key names** use the player's keyboard layout where the browser can tell (an AZERTY KeyW is "Z").
- **Typing never moves the player:** text fields are excluded, and the game already ignores them.

## Evidence

- `probe_q3.json` / `.log`: migration, the reveals, calm play, stamina, the health hook, the pause, the default-bindings identity and walk against the first candidate, rebinding, conflicts, refusal, persistence, reset, damaged save.
- `q3_*.jpg`: run begins, calm, sprinting, pause, Settings > Controls, Settings > HUD, at 1920x1080 and 390x844 touch.
