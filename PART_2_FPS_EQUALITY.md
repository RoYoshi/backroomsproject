# THE FAR BACKROOMS — PART 2 FPS EQUALITY PASS

**Build:** `v23.3.3-hqa-fps`  
**Status:** Engineering implementation complete; browser/human feel QA still required before Part 2 lock.

## Goal

Rendering refresh rate must never determine gameplay speed.

A player at 240/360 FPS must not move, accelerate, recover stamina, slide, vault, or advance local simulation faster than a player at 60 FPS given the same inputs and elapsed real time.

## What was already correct

The shipped client already used a 60 Hz accumulator for core player movement and solo entity simulation, and the authoritative multiplayer server already advances simulation in fixed 1/60 s steps.

## Weakness found

The browser loop clamped each rendered-frame delta to **50 ms**. That was harmless at normal 60/120/144/240 Hz, but it meant sufficiently low render rates (below about 20 FPS) could advance less gameplay time than real time. There was also no single explicit timing policy or dedicated render-FPS equality regression protecting this invariant.

## Implementation

Added `timing_policy.js` and wired the shipped browser loop to it.

Policy:

- gameplay fixed rate: **60 Hz**
- fixed gameplay delta: **1/60 s**
- rendering remains uncapped / monitor-driven
- a rendered frame may execute multiple fixed gameplay ticks when necessary
- catch-up ceiling: **15 fixed ticks**
- maximum accepted frame delta: **250 ms**
- the 250 ms / 15-tick guard mirrors the existing authoritative server catch-up guard

The render loop now uses rendered frames only to accumulate elapsed real time. Core gameplay consumes that accumulated time exclusively in fixed 60 Hz steps.

This preserves the important distinction:

- 60 FPS = about one gameplay tick per rendered frame
- 120 FPS = about one gameplay tick per two rendered frames
- 240 FPS = about one gameplay tick per four rendered frames
- 360 FPS = about one gameplay tick per six rendered frames

All still produce **60 gameplay ticks per real second**.

## Regression coverage

Added `dev/tests/s_fps_equality.js` and `npm run test:fps`.

The test drives the real `move.js` through the same accumulator policy for ten seconds under multiple render schedules and compares the complete resulting movement state.

Verified identical results at:

- 30 FPS
- 60 FPS
- 120 FPS
- 144 FPS
- 240 FPS
- 360 FPS
- irregular/jittered frame intervals

Each ten-second run executes exactly **600 fixed gameplay ticks** and ends with identical position, velocity, stamina, distance, exhaustion state, and movement state.

Additional check:

- 15 FPS correctly performs four fixed gameplay steps per rendered frame and still produces 60 gameplay ticks over one second.

The test also statically verifies that the shipped browser bundle is wired to `timing_policy.js` rather than the old 50 ms render-delta clamp.

## Existing systems preserved

No Hound/Smiler behavior was retuned by this pass.

No changes were made to:

- movement speeds
- stamina rates
- Hound chase speed
- Smiler speed
- AI fixed-step logic
- server simulation rate
- server movement validation
- camera fairness policy
- HQA Hound fixes
- HQA Smiler pressure fix
- lighting QOL fix
- corpse label QOL fix
- admin stress ceilings

The server already used fixed 1/60 s simulation steps with a 15-step / 250 ms catch-up guard, so it was left intact.

## Tests run

Passed:

- FPS equality: all checks PASS
- camera fairness: 12/12 PASS
- Part 2 HQA regression: 4/4 PASS
- Hound 2E/HQA: 18/18 PASS
- shipped JS syntax checks
- server startup smoke test

A browser-driven `move_test.py` attempt was **BLOCKED** because the local Playwright Chromium executable is not installed in this environment. This is not recorded as a pass.

A fresh full-suite run was also attempted but exceeded the execution window before completion. The partial log showed the same historical statistical/semantic red checks already documented for Part 2 (including P01, P07, H07 and SM01 before timeout); the targeted FPS/camera/HQA/Hound suites passed after this change.

## Human QA still requested

On actual hardware, compare at least 60 Hz and 240 Hz while holding identical movement inputs. Confirm that:

1. straight-line run distance over the same real-time interval is the same;
2. stamina drains/recharges at the same real-time rate;
3. Hound/Smiler world speed does not change with display refresh rate;
4. slides and vaults do not execute faster at high refresh;
5. 240 Hz feels smoother/more responsive visually, but not faster mechanically.

**Do not mark Part 2 locked solely from automated timing tests.** Final human QA remains the gate.
