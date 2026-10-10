# Stage 3C QA2, QA2-1: the black boot gate

## What happens now when the game opens

1. **Black from the first paint.** A few inline rules at the very top of `index.html`, before every stylesheet:
   - the page is black;
   - a full-screen black layer (`#boot`) sits above everything;
   - while `<html class="tfb-boot">` is set, nothing else in the page is visible at all.
   - No menu, title, rail, button or world can paint early, even on a slow link where the HTML and CSS arrive seconds before the scripts.
2. **Loading.** When `assets/ui.js` starts it takes over the boot (`window.__boot`: `black` -> `loading` -> `ready` -> `menu`, or `error`). It gathers what the menu needs as promises:
   - both stylesheets present;
   - the credits data;
   - the game's runtime, far enough that PLAY can enter its own flow (the game's API, its gear, and its own ENTER wiring);
   - then the fonts, waited for but for no more than 2.5 s, so a dead font server falls back to the system faces instead of hanging the game.
   - QA2-2 adds the logo, decoded; QA2-3 adds the theme, decoded.
3. **Ready, then the menu.**
   - **Laid out first:** the menu is laid out underneath, its light picture is drawn, and two frames pass.
   - **Then the reveal:** the whole menu is revealed in one short fade (0.42 s; immediate with reduced motion).
   - **No assembly:** QA1's staggered entrance (the title flickering on, PLAY rising, the rails fading up) is gone, so the menu never assembles in front of the player.
4. **No fake progress.**
   - There is no percentage or count.
   - If the black lasts longer than about a second, one quiet "Loading" line fades in. It comes from the boot layer itself, so it shows even before the scripts have arrived. A fast start reveals the menu before it would appear.
5. **Failure.** If a required piece fails, the page stays black with one sentence naming what did not load (the interface, the credits, the game, and later the menu artwork or the menu music) and a RETRY button, which gets focus.
   - The menu never half-opens.
   - If `ui.js` itself never starts, the inline script ends the wait 5 s after the page's load with the same message.
   - RETRY reloads the page.

The theme still behaves as in QA1 at this checkpoint (it waits for a press); QA2-3 joins it to the reveal.

## Measured (`probe_b1.json` / `.log`; sheets `b1_*_sheet.jpg`, every frame where the picture changed)

| Start (1280x720) | Page's first paint | `ui.js` starts | Menu revealed | Frames before the reveal |
|---|---|---|---|---|
| cold, local | black | about 0.6 s | about 0.9 s | black |
| warm, same profile | black | about 0.7 s | about 0.9 s | black |
| cold, 1.5 Mbps | black | about 2.2 s | about 3.0 s | black, then the quiet "Loading" line |

The white first frame in each sheet is the previous page (`about:blank`): a browser keeps showing it until the new page first paints.

**Failures tried:**
- the stylesheet, the credits data, the game's module and `ui.js` itself, each blocked;
- each ends black with the right message and a focused RETRY, and the menu never visible;
- RETRY with the piece back starts the game normally.

**Also checked:** reduced motion makes the reveal immediate. QA1's own menu probe still passes underneath (`qa1_probe_q1.json`).
