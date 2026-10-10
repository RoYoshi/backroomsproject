# Stage 3C QA2, R1: the logo-first entrance and the return from a run

This continues the preservation checkpoint `48bcbe2` (tree `9ab30d0`), applying the user's continuation requirement (`MENU_ENTRANCE_RETURN_CHOREOGRAPHY_LOCK.md`).

## The first load
1. **Black.** The boot, its gate and the music preload are as in QA2-3.
2. **Ignition.** At the reveal (the gate's key, click or tap, or at once where sound is allowed), the boot layer goes at once onto the menu's own black field, and every part of the menu starts dark. Then, in the same step:
   - **The logo powers on first:** `mmIgnite` is 0.6 s of opacity only, stuttering on like a tube striking (5 % 0.6, 9 % 0.04, 17 % 0.85, 22 % 0.18, 31 % 0.95, 36 % 0.55, then 1). It uses no filter, blend or recolour.
   - **The menu theme starts with it.** The theme's start and the entrance are within 10 ms of each other in the measurements (`startedAt` 14751 ms, entrance 14758 ms).
3. **The rest arrives in the locked order:**

   | Part | Delay | Animation |
   |---|---|---|
   | LEVEL 0 / THRESHOLD | 0.20 s | `mmArrive` (opacity, plus 10 px of `translate`, which composes with each part's own transform) |
   | PLAY | 0.26 s | `mmArrive` |
   | CUSTOMIZE / SETTINGS / CREDITS | 0.40 s | `mmArrive` |
   | the left rail | 0.52 s | `mmArriveL`, from the left |
   | the right rail | 0.60 s | `mmArriveR`, from the right |
   | the footer | 0.72 s | a fade |

   - The menu is settled about 1.2 s after ignition.
   - `ui.js` removes the classes at 1.8 s, so nothing runs on an idle menu.
4. **Reduced motion keeps the order with short plain fades** and no flicker: the logo fades in over 0.22 s, then the other parts at 0.10, 0.13, 0.18, 0.24, 0.28 and 0.32 s.

## The return from a run (END in the run menu)
1. **Interception.** The press on END is held back; nothing about the run changes yet.
2. **Fade down, together:**
   - What the player sees: the boot layer fades in over the run menu and the world to full black (0.8 s linear; 0.25 s with reduced motion). It takes the pointer.
   - What the player hears of the game: the game's own master output (the halls' hum, threat sounds, footsteps, effects - its single output gain) ramps linearly to 0 over the same time.
3. **The game's own END runs on full black,** after 0.12 s more. It is the bundle's handler, unchanged: the run menu hides and the menu shows. The game's audio context is suspended while the menu is up, so the halls are silent there.
4. **The menu's entrance follows, as on the first load:** the logo first with the Intro (a new start, plays 2, within 10 ms), then the rest.
5. **The next ENTER LEVEL 0** restores the game's output to its own level (`0.14 x` the master volume, as its `toggle()` and `hud.js` set it) and resumes its context.

Only the local output gain and context are touched. AI hearing, the movement noise the client reports, server sound evidence, networking and the run's lifecycle are the game's own:
- During the return only routine position packets (`p`) were sent: no join, respawn, vanish or leave.
- The world under the black keeps running, as it did under the black menu.

## Focused validation on this tree (`probe_b1`, `probe_b2`, `probe_b3`)

### `probe_b3`: 28/28 PASS
Its 21 QA2-3 checks, with the ENTER window lengthened, plus 7 new ones:
- **The first entrance:** logo first, theme with it, the rest in order (delays 0 / 200 / 260 / 400 / 520 / 600 / 720 ms).
- **A click entrance:** the same.
- **The reduced-motion entrance:** the logo by a plain fade, then the rest in order.
- **END through black:**
  - frames: the run menu over the world (before) -> dim -> black -> the menu arriving (dim);
  - no world frame after the black;
  - the boot layer shows `exiting` and takes the pointer while the menu is still hidden.
- **The game's sound on END:**
  - it was 0.14 and running before;
  - it was 0 and suspended on the menu;
  - only `p` packets were sent on the way.
  - The two samples taken during the fade both read 0 (the software renderer delays the page). The ramp itself is an audio-clock `linearRampToValueAtTime` over 0.8 s; an earlier trace read 0.077 halfway.
- **The return entrance:** logo first, the Intro restarted (plays 2) in the same step, the rest in order.
- **The next ENTER:** the game's output is back at 0.14 and running.

**The previously unresolved check, "ENTER LEVEL 0 from the menu passes through black", now passes.** The screencast's frames lag the page by seconds under the software renderer, so the recording now runs until the curtain has lifted plus 5 s, where it used to stop 1.5 s after. Its frames went before (the menu) -> black (57 frames, from 2.6 s) -> dim (2 frames) -> lit (42 frames, from 5.0 s). Nothing in the transition itself changed.

### `probe_b2`: 10/10 PASS
END now waits for the menu and its entrance before looking.

### `probe_b1`: 13/13 PASS
The reveal check reads the menu once its one entrance has settled.

These two ran before the last reduced-motion delay tweak (LEVEL 0 at 0.10 s and PLAY at 0.13 s with reduced motion, instead of both at 0.12 s). That tweak touches neither probe's subject.

## Evidence
- `probe_b1.json` / `.log`, `b1/`;
- `probe_b2.json` / `.log`, `b2/`;
- `probe_b3.json` / `.log`, `b3/`:
  - `b3_end_sheet.jpg`: END, frame by frame: the run menu fading, black, the logo first, then PLAY, the row, the rails and the footer;
  - `b3_enter_sheet.jpg`: ENTER through black to the world;
  - the gate screenshots.
