# Stage 3C QA1, Q5: integration, the final regression, performance

Every file here was produced on the final tree, one check after another (nothing else running).

## Fixes found by the final integration
1. **Customize on phones** (found by the first candidate's `probe_c3`).
   - **The problem:** Q4's safe-area padding for dialogs also padded `#appearancePanel`, so Customize no longer filled a 390 x 844 screen.
   - **The fix (`assets/ui.css`):** Customize has its own rules again. On narrow screens it fills the screen inside the safe-area insets, with a full-height card. On wider touch screens it keeps its 20 px margin, or the inset where that is larger.
2. **True darkness** (`probe_q5`).
   - **The problem:** the LEVEL 0 reveal's warm text glow raised black pixels around the letters by up to 5/255 in the blackout.
   - **The fix:** the glow is replaced by a dark shadow. With stamina and the reveal shown, no pixel of the world is brighter than with them hidden (`q5_true_darkness_hud_off.png` / `_on.png`).
3. **One tap, one action** (the first candidate's `probe_c2` on a phone; `probe_q4`).
   - **The problem:** the press-acting touch buttons swallowed the click that follows a tap only within 900 ms. On a slow renderer it arrived later, so INV or LIGHT acted twice.
   - **The fix (`assets/ui.js`):** each touch press arms its button for exactly one following touch click, with no timer. Clicks from a key or a mouse are never swallowed.
   - **Note on the event:** Chromium's touch click has `detail` 0 and `pointerType` "touch", so neither a time window nor `detail` identifies it reliably; `pointerType` does.
4. **The HUD settings and the reveal.**
   - **The problem:** Settings > HUD's preview shows LEVEL 0 in the HUD colour and size, but the reveal ignored both.
   - **The fix:** it now follows size (clamped to 0.8 to 1.2 so LEVEL 0 fits a phone), opacity, and a custom colour. The default look is unchanged (`probe_q5`).

`probe_q4`'s speed comparison now records every attempt. Under this software renderer the test clock's frame order once cost the keyboard's sprint one game tick inside the 20-tick window (4.509 instead of 4.747 px/tick, while the stick matched the keyboard's usual 4.747). A pair that differs is measured again, up to three times, and the stick must never beat the keyboard's best attempt.

### `probe_q2`, NEW RUN -> END, and a rule from before Stage 3C: one NEW RUN every 30 s
- **What happened:** in the first final run, the visitor's own page was correct right after END: on the menu, not started, hidden, unlit, not drawn. But the second page, the player inside, still listed it as active.
- **First suspicion:** a stale snapshot, because a page's messages can queue behind slow software-rendered frames. The probe now reads the observer until it shows the expected state, up to 10 s, and records the wait (`waitedMs`), after ENTER, NEW RUN and END.
  - With that, the server still listed the visitor as active 12 s after END, so it was not a stale snapshot.
- **The cause:** the server allows one NEW RUN vanish every 30 s (`sim.js` `VANISH_CD`, protected, unchanged since Stage 2).
  - The probe's second NEW RUN came about 20 s after its first, so the server refused the vanish and the leave, and kept the wanderer active.
  - Meanwhile the client showed the run menu, then the main menu after END.
- **`newrun_cooldown.js`** measures exactly this on any build. The first candidate and QA1 behave the same (`newrun_cooldown_first_candidate.json`, `newrun_cooldown_qa1.json`).
- **Not changed:** it is a gameplay and network rule; the report offers a UI-only fix for the user to decide.
- **`probe_q2` now** waits until 40 s after its first NEW RUN before the second (the server starts its 30 s when the vanish reaches it, which on this slow renderer can be seconds after the click), and records the wait (`notes.newRunCooldownWaitMs`).

## Files
- **The QA1 probes:** `probe_q1..q5.json` / `.log`.
- **The first candidate's probes on QA1:** `first_candidate/first_candidate_probes.json`, plus each probe's JSON and log, and `run.log`.
- **The NEW RUN rule:** `newrun_cooldown_first_candidate.json` and `newrun_cooldown_qa1.json`.
- **Touch performance, measured again:** `perf_touch_ab.json` (three alternating rounds).
- **Lifecycle:**
  - `lifecycle_qa1.json`: `lifecycle.js`, a visitor on the menu and a player inside, then ENTER;
  - `lifecycle_mp.log` / `.json`: the retained suite.
- **Camera, BR-RoLE and the theme files:** `camera_3bn.log`, `camera_fairness.log`, `br_role.log`, `theme_assets.json`.
- **Performance:** `perf_final.json` / `.log`, the first candidate vs QA1, interleaved.
- **`captures/`:**
  - `q5_<size>_menu.jpg` and `_entry.jpg`: the menu and entry at ten sizes, including touch portrait and landscape and reduced motion;
  - `q3_<size>_*.jpg`: the HUD (run begins, calm, sprinting, pause, Settings) at 1920 x 1080, 390 x 844 and 844 x 390;
  - `q4_*`: touch play at five sizes and the stick;
  - `q5_true_darkness_*`.
- **Fonts:** all captures use the fallback faces (no Google Fonts here).
