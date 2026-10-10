# Stage 3C QA2: performance

**How it was measured:** Chromium with SwiftShader (software rendering) on 2 CPUs, served from localhost.
- Frames take 300-1000 ms here, against about 16 ms on a GPU, so absolute numbers mean nothing.
- Only QA1 (`5f30e28`) against QA2 on the same states, interleaved on the same machine, says anything.
- Nothing here is a GPU or network figure.

Evidence: `dev/stage-3c-qa2/evidence/r3/`:
- `perf_start.json` (`perf_start_qa2.js`);
- `perf_ab.json`, `perf_ab_extra.json`, `perf_ab_extra_phone.json` and `perf_ab_combined.json` (`perf_ab_qa2.js`, an adapted copy of the first candidate's `perf_c3.js`).

## 1. Starts
In Chromium told sound may start, so neither build waits on a person. Two rounds each, cold (a new profile) and warm (the same profile, reloaded 4 s later); medians, with the range.

| | First paint | Menu settled (on screen, nothing animating in) | Menu music playing |
|---|---|---|---|
| QA1 cold | 0.95 s (0.91-1.00) | 6.3 s (6.2-6.4): QA1's staggered entrance, after a first paint showing the whole menu over the world | only after a first press: 5.6-6.3 s more, so about 12.2 s with a press at 6.3 s |
| QA2 cold | 0.63 s (0.50-0.77), **black** | 10.0 s (8.5-11.5), including the 1.2 s logo-first entrance | 8.4 s (6.7-10.0), the same moment as the logo |
| QA1 warm | 1.16 s (1.08-1.23) | 6.7 s (6.5-6.9) | after a press: 5.5 s more |
| QA2 warm | 0.70 s (0.53-0.87), **black** | 7.2 s (6.1-8.3) | 4.0 s (1.3-6.6), the same moment as the logo |

- **Where QA2's cold start goes** (from `__ui.boot().done`): the stylesheets, credits, logo and game runtime are ready by about 0.7 s. The menu music (22.6 MB of WAV, downloaded and decoded) takes the rest, about 6-9 s here.
  - On a real network the music download dominates: about 4 s at 50 Mbit/s, 18 s at 10 Mbit/s, and 52 s measured at 4 Mbit/s (`evidence/q3`).
- **Warm starts vary from 1.2 s to 6.6 s here.** Reading 22.6 MB back from Cache Storage and decoding it competes with the software renderer drawing the world beneath the black. Measured on an idle page: the Loop file's cache match took 0.7 s, its read 1.2-1.9 s, and its decode 0.3-0.4 s.
- **QA1 vs QA2:**
  - QA1 shows its menu sooner, but as the start the user rejected: a finished menu over the world, then a 3 s assembly, and silence until a press. Its music needed about 5.5-6.3 s more after that press.
  - QA2 shows nothing but black until the menu and its music start as one event.
- **The large cost is the uncompressed theme**, which the QA2 rules lock. A compressed playback copy would shrink it about tenfold; that is the user's decision, not made here.

## 2. The ready gate (QA2, Chromium as installed: it wants a gesture)

| State | Frame interval (mean / p95) | UI scripts' JavaScript per frame | All JavaScript per frame | Animations running |
|---|---|---|---|---|
| Ready gate (black, one line, waiting) | 326.5 / 360.1 ms | 0.013 ms | 5.71 ms | the game's own `glTear` only |
| Menu idle after the gate (music playing) | 330.4 / 405.3 ms | 0 ms | 4.99 ms | the game's own `glTear` only |

- **The black screen is virtually free.** It is a static layer: no loader animation, no per-frame polling, nothing from the UI scripts.
- The frame cost is the game's world drawing beneath it, as it does beneath the menu.
- The gate's one line fades in once (0.6 s) and then stays.

## 3. Menu and play, QA1 vs QA2 (mean frame interval in ms; lower is better)
Desktop is four interleaved rounds, the phone two; each state is measured for 4 s. Monsters were removed and frozen. In play every menu is closed.

| View | State | Rounds | QA1 | QA2 | QA2 vs QA1 | UI JS per frame, QA1 / QA2 |
|---|---|---|---|---|---|---|
| desktop 1920x1080 | menu idle | 4 | 668.3 | 584.7 | -12.5 % | 0.19 / 0.029 ms |
| desktop 1920x1080 | Settings over the menu | 4 | 607.4 | 672.6 | +10.7 % | 0.047 / 0.036 ms |
| desktop 1920x1080 | Customize over the menu | 4 | 749.2 | 736.8 | -1.7 % | 1.655 / 1.342 ms |
| desktop 1920x1080 | Level 0 lit, standing | 4 | 941.2 | 971.9 | +3.3 % | 0.03 / 0.01 ms |
| desktop 1920x1080 | Level 0 lit, walking | 4 | 873.3 | 910.9 | +4.3 % | 0.058 / 0.09 ms |
| desktop 1920x1080 | Level 0 dark, flashlight | 4 | 925.5 | 902.5 | -2.5 % | 0.017 / 0.009 ms |
| touch 390x844 | menu idle | 2 | 290.2 | 265.0 | -8.7 % | 0.028 / 0.048 ms |
| touch 390x844 | Settings over the menu | 2 | 258.9 | 271.8 | +5.0 % | 0.111 / 0.026 ms |
| touch 390x844 | Customize over the menu | 2 | 326.3 | 334.7 | +2.6 % | 1.181 / 1.493 ms |
| touch 390x844 | Level 0 lit, standing | 2 | 827.4 | 656.4 | -20.7 % | 0.034 / 0.012 ms |
| touch 390x844 | Level 0 lit, walking | 2 | 759.0 | 666.2 | -12.2 % | 0.139 / 0.119 ms |
| touch 390x844 | Level 0 dark, flashlight | 2 | 677.2 | 696.4 | +2.8 % | 0.067 / 0.015 ms |

- **Within noise.** The differences run both ways, at about the size of the round-to-round variation, with only 5-9 frames per state per round. One phone round put Customize at +30 %; the next at -19 %. The desktop gameplay states went +9.6 % / +8.3 % / -1.5 % over two rounds, then -3.2 % / 0 % / -3.5 % over the next two.
- **No systematic regression.** QA2 adds no per-frame work in play: the UI scripts' JavaScript stays at 0.01-0.12 ms per frame in both builds.
- **Same rendering.** The game's renderer, BR-RoLE and the world are byte-identical to QA1, and nothing was lowered.
- **The menu idles as cheaply as QA1's or more so.** QA2 removed QA1's staggered entrance, and its own entrance runs once and ends: an idle menu runs no UI animation.

## 4. What QA2 adds, and when it runs
- **Boot:** promises and events (the stylesheets, credits, the logo's `decode()`, the music's fetch and decode, the game runtime, fonts capped at 2.5 s).
  - The one poll is a 150 ms timer, until the game module's API exists.
  - There is no per-frame work and no loader animation.
- **Music download:** a few chunk callbacks a second, with a text update at most twice a second (only on a slow first download).
- **The entrance:** about 1.3 s of one-shot CSS animations (opacity and a few pixels of translate) on seven elements. The classes are removed at 1.8 s.
- **The return from a run:** one CSS opacity transition, one audio-clock gain ramp and one timer; then the entrance.
- **The run curtain:** two frames plus 180 ms, then a 0.42 s fade.
- **Duplicated work:** no duplicate renderer and no second world; the theme's own small audio graph is QA1's.
