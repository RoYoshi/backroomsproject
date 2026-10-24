# Trial 3 R20 - the independent review

Trial 3 is **not owner-approved**.

**How it was done.**  A separate agent reviewed the combined source diff against `2f11eae` (`src/` only).
- It was given the stated intent of each change, not the evidence.
- It read code only: no tests, gates or simulations.
- Its findings were then checked here, one by one, against the code and the gate.

| # | finding (its severity) | checked | what was done |
|---|---|---|---|
| 1 | **High.**  W1 (the turn-aware stuck timer) applied to every species, so the Hound's and the Smiler's recovery at hard turns changed | **Confirmed.**  The gate's server golden traces (deaths, admin, and with them bpp_golden, session, sim) failed on it; taking W1's two lines out made them B++'s again | W1 is an opt-in (`caps.TURN_AWARE_STUCK`), the Skin-Stealer's alone (N D2, S C2).  The gate is R19's again, and the chase study is identical to R19 combined for the Hound and the Smiler, run for run |
| 2 | **Medium.**  The part headers of `ai.skin.mind.js` and `ai.skinstealer.js` did not name `skFatigueSee` and `skWinded` | **Confirmed** (the gate's parts step) | headers fixed (S C2) |
| 3 | **Low-medium.**  A post, or a wait where it stands, could be built from another creature's footsteps | **Confirmed** in the code | both now require a person's sound (`src !== -1`; S C2) |
| 4 | **Low.**  Hiding the killer by id alone has no distance bound: a late replay could hide it after it walked off | **Plausible** (no run showed it) | a 400 px backstop from the death's source, on top of the id (kill visibility, RV07b) |
| 5 | **Low.**  `skAhead`'s route queries draw from the search stream, so "its other draws never move" was wrong | **Confirmed** | the claim corrected in code and docs (S C2) |
| 6 | **Low.**  Under W1, a slow, misaligned body against a wall may not build its stuck timer | Plausible; it recovers once it has turned | left; W1 now applies to the Skin-Stealer alone, and W4 (below) handles the corner case found in the traces |
| 7 | **Low.**  Smaller items | | |
| 7a | the kill variant still reads the held body's breath (`pv.ex`, `pv.stamina`) | as designed | documented as not a hunting decision (S6) |
| 7b | `e.roam.summon` was not cleared on an admin clear | confirmed | fixed (S C2) |
| 7c | the fatigue belief counted a gap out of sight twice | confirmed | fixed (S C2) |
| 7d | `post: 1` in `SK_STRIKE` is dead code | confirmed | left (harmless) |

**Found after the review, by the combined tree's stuck trace.**  A Skin-Stealer search was pinned on a corner for 15 s: side-steps, then
"stuck: the watchdog cleared its route" twice.  It had two causes, inherited from R2-R19 and exposed by R20's quieter searches:
- the search's goal was a heard place where its body cannot stand;
- the follower's ladder never reached its new-route rung there.

Both are fixed:
- S10 sets a search's goal down on floor its body fits;
- W4: a second side-step at the same spot goes to a new route, the Skin-Stealer's alone (ST05).
