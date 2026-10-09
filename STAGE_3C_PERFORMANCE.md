# Stage 3C performance: parent vs Stage 3C

**The rule this pass followed:** visual parity first, performance through engineering. The Stage 3B world was not touched, and its BR-RoLE cache warm-up was not touched. Any cost found in the UI was fixed in the UI.

## How it was measured
- **Tools:** `dev/stage-3c/perf_c3.js` measures one build; `dev/stage-3c/perf_ab_c3.js` runs the Stage 3B parent (`6e6fa46`) and Stage 3C in turn.
  - **Order:** desktop runs interleaved A B A B (two rounds), then one run of each at 390 x 844 touch (DPR 2).
  - **Each state:** 4 s, after it has settled.
- **States:**
  - the main menu, idle;
  - Settings open over the menu (Stage 3C: the Settings sheet; parent: its SETTINGS dropdown);
  - Customize open over the menu;
  - Level 0 with every menu closed: lit (YELLOW HALL, flashlight) standing and walking, then dark (the BLACKOUT ZONE, flashlight).
- **Test setup:** monsters removed and frozen.
- **Measured per state:**
  - **Frame interval:** the page's own requestAnimationFrame interval, as mean and 95th percentile.
  - **UI script time:** time per frame in the UI scripts (`assets/ui.js`, `hud.js`, `inventory.js`), from the DevTools sampling profiler at 100 µs.
  - **Total JavaScript:** all JavaScript time per frame.
  - **Preview draws:** draw calls per second into the customize preview canvas.

> **Software rendering only.** This sandbox renders with SwiftShader on 2 CPUs, so a frame takes hundreds of milliseconds, far slower than any GPU. **Only parent vs Stage 3C on the same state means anything; no number here is a claim about real hardware.** Single 4 s windows hold about 10 frames each, so differences of about ±10 % are noise.

## Final result (`dev/stage-3c/evidence/c5/perf_ab_final.json`)

Desktop: two interleaved rounds per build, averaged. Touch: one run each.

| View | State | Parent: mean / p95 (ms) | Stage 3C: mean / p95 (ms) | Change (mean) | Preview draws/s (parent → 3C) |
|---|---|---|---|---|---|
| desktop | menu idle | 426.6 / 599.4 | 397.5 / 502.9 | −6.8 % | 3.0 → **0** |
| desktop | Settings open | 404.4 / 497.9 | 395.4 / 548.5 | −2.2 % | 3.0 → **0** |
| desktop | Customize open | 461.7 / 538.9 | 428.1 / 484.4 | −7.3 % | 5.3 → 5.2 |
| desktop | Level 0 lit, standing, menus closed | 579.2 / 783.3 | 556.2 / 808.0 | −4.0 % | 4.5 → **0** |
| desktop | Level 0 lit, walking, menus closed | 614.1 / 827.3 | 581.5 / 806.6 | −5.3 % | 4.7 → **0** |
| desktop | Level 0 dark, flashlight, menus closed | 555.3 / 751.4 | 578.0 / 755.8 | +4.1 % | 4.5 → **0** |
| touch 390x844 | menu idle | 162.8 / 334.8 | 153.7 / 170.0 | −5.6 % | 6.9 → **0** |
| touch 390x844 | Settings open | 186.2 / 313.2 | 144.1 / 184.3 | −22.6 % | 6.0 → **0** |
| touch 390x844 | Customize open | 175.6 / 200.9 | 186.1 / 244.1 | +6.0 % | 12.5 → 12.1 |
| touch 390x844 | Level 0 lit, standing, menus closed | 403.0 / 485.0 | 384.1 / 432.4 | −4.7 % | 5.9 → **0** |
| touch 390x844 | Level 0 lit, walking, menus closed | 358.8 / 409.9 | 354.0 / 407.5 | −1.3 % | 6.9 → **0** |
| touch 390x844 | Level 0 dark, flashlight, menus closed | 399.2 / 495.8 | 384.6 / 500.9 | −3.7 % | 5.9 → **0** |

### UI script time per frame
Every state is under 0.32 ms per frame in both builds, except with Customize open.
- **Customize open:** about 0.8–1.0 ms in both builds. That time is `inventory.js` painting the device close-up and the cards, which is unchanged from the parent.
- **Everything else:** a hundredth or a tenth of a millisecond, in samples of about 10 frames.

## What this shows
1. **Gameplay with every menu closed is unchanged.** All six closed-menu rows are within noise (−5 % to +4 %).
   - **The HUD stays event-driven:** the game writes its readouts every 0.12 s as before, and `hud.js` only reacts to those changes.
   - **No UI script asks for animation frames during play:** `probe_c5` attributes every requestAnimationFrame call during 2.5 s of play to its script, and none come from `ui.js`, `hud.js` or `inventory.js`.
2. **The customize preview no longer draws all the time.**
   - **Parent:** its second renderer (the live wanderer preview) drew every frame for the whole session, menu or play, at 3–7 draw calls per second here.
   - **Stage 3C:** one insertion in the bundle exposes that renderer, and `assets/ui.js` stops its ticker whenever Customize is closed. Closed, it makes 0 draw calls (`__avatarApp.ticker.started === false`, checked by `probe_c3` and `probe_c5`); open, it draws as before.
3. **Hidden menus do no work.**
   - The menu, sheets and panels are `display:none` when hidden, so their CSS animations stop.
   - `assets/ui.js` has no timers or loops. It reacts to clicks, keys and the game showing or hiding its own panels.
   - The pointer parallax writes one style per animation frame, and only while the pointer moves over the menu.
4. **The main menu's motion is bounded.**
   - **What moves:** the fluorescent tube's rare dip (opacity on two small layers, 11 s cycle), the one-time entrance, and transitions on hover and open.
   - **How:** transforms and opacity only, with no per-frame layout.
   - **Reduced motion:** turns all of it off.

## The one regression found and fixed
The first comparison (C4; `dev/stage-3c/evidence/c5/perf_ab_before_fix.json`) showed the **main menu idle 63 % slower than the parent** on desktop (645.6 vs 396.6 ms) and 48 % slower on touch. Settings and Customize over the menu were slower too.

Switching one animation off at a time (`dev/stage-3c/evidence/c5/menu_haze_isolation.json`) isolated the cause:

| Main menu idle, desktop (ms, two rounds) | Before the fix (C4) | After the fix (final) |
|---|---|---|
| as shipped | 620.4, 531.6 | 339.9, 404.7 |
| haze drift off | 331.9, 346.4 | 335.1, 320.9 |
| tube hum off | 526.1, 551.7 | 331.0, 333.6 |
| menu hidden | 333.3, 354.4 | 326.8, 335.3 |

- **The cause:** the slow drift of the full-screen haze layer (a 46 s loop) cost as much as the rest of the frame under software compositing.
- **The tube's hum:** costs nothing measurable.
- **The fix:** the idle drift was removed. The haze still leans with the pointer.
- **After the fix:** the menu costs the same as no menu at all, and the final table above shows the menu states at parity with the parent.

## Not done (and why)
- **No change to the Stage 3B world:** lighting quality tiers, the remaster, the fixtures and the BR-RoLE warm-up are untouched. Stage 3C needed none of them to pay for the UI.
- **No real-GPU numbers:** they cannot be measured here. Please judge the menu's smoothness and the in-game feel on your hardware (QA scene K).
