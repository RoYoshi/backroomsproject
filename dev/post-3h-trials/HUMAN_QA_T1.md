# POST-3H TRIAL 1 — THE MAIN MENU'S DRIFT — HUMAN QA PENDING

**Only the owner can accept this trial.** Nothing is merged, deployed or promoted. Trial 2 does not start until you decide.

**What changed: one thing.** On the main menu, the title (your logo) now floats a few pixels on its own, slowly, even when the mouse
never moves. It still leans toward the mouse as before; the drift is added to that lean. Everything else is the accepted C5d.

- The logo file, its size, place and glow are unchanged; only its position moves, by at most 3 px each way.
- No button, field or rail moves: the title takes no clicks, so nothing you press is displaced.
- Reduced motion (Settings, or your device's setting under System) keeps the title still, exactly where it rests on C5d.
- The drift runs only while the main menu is on screen and the tab is visible. In a run it does nothing.

## Set up an A/B comparison

1. **The candidate.** Get it from the branch `post-3h-trials-1-2-4` at the commit named in the delivery, or from the ZIP. Run
   `ADMIN_PASSCODE=<a test passcode of yours> node server.js 8000` and open `http://localhost:8000`.
2. **C5d, beside it.** Run `git worktree add ../c5d 4beba2f36deaf17473ad3b955eeefdd6fcfbd90b`, then
   `cd ../c5d && ADMIN_PASSCODE=<the same> node server.js 8001`, and open `http://localhost:8001`.
3. **Compare** on the same machine, browser and window size. Settings are saved per address, so set the same options on both.
4. **Note** the machine, the browser, the window size or phone, and your Reduced motion setting.

## Checklist

- [ ] **The drift.** Leave the mouse alone for about half a minute and watch the title. It moves a little and slowly, and never jumps.
  It should feel quiet, not busy or artificial. (On C5d it stays still.)
- [ ] **The logo.** Same size, place, colours and glow as on C5d; still sharp.
- [ ] **The mouse.** Move it around: the title leans toward it as on C5d and keeps drifting gently around that lean. Stop: nothing jumps.
- [ ] **The controls.** PLAY, CUSTOMIZE, SETTINGS, CREDITS, the left rail, the right rail (settings, wanderer, sound, help) and the
  footer are where they were, with the same words. Clicks, taps, Tab, the arrow keys and Enter work as on C5d.
- [ ] **Reduced motion.** Settings → Reduced motion **On**: the title stops and stays still. **Off**: it drifts again. **System**: it
  follows your device.
- [ ] **Your device's setting.** With your operating system asking for reduced motion and Settings at System, open the game: the title
  never drifts.
- [ ] **The music.** The boot gate, then the menu theme's intro and loop as before. The sound button works. Nothing restarts.
- [ ] **Into a run and back.** ENTER LEVEL 0: the run starts as before, with no hitch. Pause → NEW RUN → END: back on the menu, the title
  drifts again, nothing is out of place, and the theme starts again as on C5d.
- [ ] **Another tab.** Switch away for a minute, then back: the title carries on from where it was.
- [ ] **A phone.** The title drifts on its own (no mouse needed). Taps land on the same buttons. The installed app opens as before.
- [ ] **Window sizes.** Wide, ultrawide, narrow, a small laptop, and browser zoom at 125 % and 150 %: the title never clips, overlaps or
  scrolls the page. On a short window with PLAY's entry open, the title steps back as on C5d.
- [ ] **Smoothness and battery.** The menu feels as smooth as C5d's; the fan or battery is no worse after a few minutes on the menu.
- [ ] **The game itself.** A short run: walking, your light, a monster, a death or NEW RUN. All as on C5d (nothing else changed).

## If you want it different

The size of the drift is two numbers in `public/assets/ui.css` (`--drx` and `--dry`, 3 px each); its speed is the periods in
`src/frameworks/front/client/ui.js` (`DRIFT_X`, `DRIFT_Y`). Say "bigger", "smaller", "slower" or "faster" in NEEDS CHANGES, and it is
changed on this branch and checked again.

## What the machines checked, and what they could not

`T1_REPORT.md` has the details. The checks ran in headless Chromium with a software renderer (SwiftShader) on a 2-CPU machine: the drift's
bounds and behaviour, the menu against C5d at four sizes, and the full gate against the accepted B++ game. How the drift feels, a real
GPU, a real phone and real battery use are yours to judge.

## Verdict (the owner's only)

```
Owner verdict on Trial 1:
[ ] PASS / ACCEPT
[ ] NEEDS CHANGES (reproduction attached)
[ ] ROLL BACK (use previous accepted checkpoint)
```

- **PASS / ACCEPT:** name the commit and tree. That accepts Trial 1 only: no merge, no deployment, and Trial 2 starts only then.
- **NEEDS CHANGES:** say what you saw (the screen, the browser, the window size, your Reduced motion setting). The fix is made on this
  branch.
- **ROLL BACK:** C5d `4beba2f36deaf17473ad3b955eeefdd6fcfbd90b` is untouched, on `stage-3h-engine-modernization`.
