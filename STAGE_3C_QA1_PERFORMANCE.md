# Stage 3C QA1 performance: first candidate vs QA1

**The rule:** visual parity first, performance through engineering. QA1 changes only the UI:
- The Stage 3B world, the lighting tiers, the remaster and BR-RoLE's warm-up are untouched. No graphics were lowered.
- There is no second renderer.
- Nothing full-screen drifts while idle.

## How it was measured
- **Tool:** `dev/stage-3c-qa1/perf_ab_qa1.js` runs the first candidate's own profiler (`dev/stage-3c/perf_c3.js`) on the first candidate (`76bcc4a`) and on the final QA1 tree, in turn.
  - **Desktop:** 1920 x 1080, interleaved A B A B (two rounds).
  - **Touch:** 390 x 844 at DPR 2, one run of each.
  - **Each state:** 4 s, after it settles.
- **States:**
  - the main menu, idle;
  - Settings over the menu;
  - Customize over the menu;
  - Level 0 with every menu closed: lit and standing, lit and walking, and dark with the flashlight.
- **Test setup:** monsters removed and frozen.
- **Measured:**
  - the page's frame interval (mean and 95th percentile);
  - UI script time per frame (`assets/ui.js`, `hud.js`, `inventory.js`, from the DevTools sampling profiler);
  - all JavaScript per frame;
  - draws into the customize preview.

> **Software rendering only.** This machine renders with SwiftShader on 2 CPUs, so a frame takes hundreds of milliseconds. **Only the first candidate vs QA1 on the same state means anything; no number here describes real hardware.** Run-to-run noise on this machine is often 5 to 10 % and sometimes more, so a single run proves little; the desktop rows are two interleaved rounds, and touch was measured again below.

## Result (`dev/stage-3c-qa1/evidence/q5/perf_final.json`)
| View | State | First candidate: mean / p95 (ms) | QA1: mean / p95 (ms) | Change (mean) | UI script ms/frame (first -> QA1) |
|---|---|---|---|---|---|
| desktop 1920x1080 | menu idle | 556.4 / 742.2 | 512.8 / 618.2 | -7.8 % | 0 -> 0.059 |
| desktop 1920x1080 | settings open (over the menu) | 564.2 / 665.0 | 482.9 / 640.1 | -14.4 % | 0 -> 0.009 |
| desktop 1920x1080 | customize open (over the menu) | 592.5 / 668.0 | 562.9 / 639.5 | -5.0 % | 1.506 -> 1.254 |
| desktop 1920x1080 | Level 0 lit, standing (menus closed) | 782.4 / 869.5 | 788.6 / 991.8 | +0.8 % | 0 -> 0.014 |
| desktop 1920x1080 | Level 0 lit, walking (menus closed) | 750.5 / 942.5 | 726.0 / 810.9 | -3.3 % | 0.196 -> 0.107 |
| desktop 1920x1080 | Level 0 dark, flashlight (menus closed) | 690.5 / 891.9 | 730.8 / 1135.2 | +5.8 % | 0 -> 0.192 |
| touch 390x844 | menu idle | 222.2 / 257.5 | 207.8 / 240.5 | -6.5 % | 0.009 -> 0.036 |
| touch 390x844 | settings open (over the menu) | 211.3 / 294.9 | 202.9 / 237.4 | -4.0 % | 0.01 -> 0.047 |
| touch 390x844 | customize open (over the menu) | 268.2 / 331.3 | 238.7 / 328.4 | -11.0 % | 0.836 -> 0.771 |
| touch 390x844 | Level 0 lit, standing (menus closed) | 552.4 / 679.6 | 614.0 / 738.9 | +11.2 % | 0 -> 0.024 |
| touch 390x844 | Level 0 lit, walking (menus closed) | 524.9 / 620.0 | 567.8 / 634.1 | +8.2 % | 0.105 -> 0.094 |
| touch 390x844 | Level 0 dark, flashlight (menus closed) | 560.1 / 608.2 | 592.2 / 688.1 | +5.7 % | 0.087 -> 0.023 |

Across the 12 states the change in mean frame interval runs from -14.4 % to +11.2 %. UI script time stays a fraction of a millisecond per frame. The exception is Customize open, where `inventory.js` paints the device close-up and the cards, the same as in the first candidate.

### Touch, measured again
The single touch run above has QA1's gameplay states at +11.2 %, +8.2 %, +5.7 % against the first candidate. That is one sample each, with QA1 always second. So touch was measured again: three more rounds at 390 x 844, alternating which build goes first (`perf_touch_ab.json`).

| State (touch 390x844) | First candidate: three means (ms) | QA1: three means (ms) | Change (mean) | QA1 UI script ms/frame |
|---|---|---|---|---|
| menu idle | 220, 219, 224 | 219, 205, 227 | -1.8 % | 0.074 at most |
| settings open (over the menu) | 220, 200, 214 | 210, 201, 223 | +0.0 % | 0.051 at most |
| customize open (over the menu) | 285, 249, 264 | 243, 252, 242 | -7.6 % | 1.069 at most |
| Level 0 lit, standing (menus closed) | 573, 587, 587 | 513, 603, 595 | -2.0 % | 0.081 at most |
| Level 0 lit, walking (menus closed) | 525, 536, 517 | 532, 514, 543 | +0.7 % | 0.168 at most |
| Level 0 dark, flashlight (menus closed) | 527, 562, 539 | 620, 538, 558 | +5.3 % | 0.128 at most |

Across these rounds every state is within -7.6 % to +5.3 %, inside this machine's run-to-run spread (the samples of one build on one state differ by up to 17 %). Nothing points at the stick or the QA1 HUD: the UI scripts' own time stays a fraction of a millisecond per frame, and they run no frame loop.

## Hidden UI does no work (`probe_q5`, final tree)
- **Idle main menu, 4 s:** animation-frame requests by script: Filter-DzecrWg_.js 46, index-DKbV5Nv9.js 23, l0-remaster.js 23. None come from `ui.js`, `hud.js` or `inventory.js`, and no UI animation runs.
- **Calm play, every menu closed, 4 s:** Filter-DzecrWg_.js 30, index-DKbV5Nv9.js 15, l0-remaster.js 15. None come from the UI files, and no UI animation runs.
- **The rest are the game's own renderer** (the bundle, its Pixi filter chunk, and the remaster), the same as the first candidate.
- **The menu theme** suspends its audio context after the fade into play, and in a hidden tab.
- **The customize preview** draws only while Customize is open (first candidate behaviour, `probe_c5`).

## What QA1 adds, and what it costs
- **The menu:**
  - The darkening over the world is static, with no idle drift; this was the lesson of the first candidate's haze.
  - The title's dip is under a second of opacity every 25 to 55 s, and never with reduced motion.
  - The title leans with a mouse pointer only while the pointer moves.
  - After the one entrance, an idle menu runs no animation (`probe_q1`).
- **The theme:**
  - It has its own small audio graph, created only on the first press on the menu. Its two files are fetched once and then come from Cache Storage.
  - After the fade on ENTER LEVEL 0, its sources stop and its context is suspended, so no audio work continues during play. A hidden tab suspends it too.
- **The HUD:**
  - Stamina's visibility is a class switched by `hud.js` from the readouts the game already writes.
  - The reveal is CSS transitions with two timers, plus a mutation observer on the game's sector line.
  - No frame loop.
- **Keybinds:** capture listeners for keydown and keyup at the window. With the default bindings they return at once, and the rebinding ones act only while a Controls slot waits for a key.
- **The stick:** pointer events only. One style write per finger move, and nothing when no finger is down.
- **The touch buttons:** one pointerdown and one click listener.

## Not done (and why)
- **No change to the Stage 3B world, the lighting tiers, the remaster or BR-RoLE's warm-up.** QA1 needed none of them to pay for the UI.
- **No real-GPU numbers:** they cannot be measured here. Please judge the menu and play on your own devices (`STAGE_3C_QA1_HUMAN_QA.md`, scene M).
