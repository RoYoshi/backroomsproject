# Light lifecycle, HQ1-4: a world reset does not cut a death's light short (check 4 not met)

The first run with check 4b counting the victim's own light. No unplanned death; checks 1, 2 and 3 passed.
- **4b** (known, the victim's own screen): her own dying light was lit until 4.51 s after the reset, failing on its normal schedule.
- **Check 4 failed.** Bob's screen had a lit dead light 1.5 s or more after the reset.

Why: an admin world reset does not end a death in progress on any screen, at D7 or here.
- The server drops the coming corpse ('world reset'), but sends the spectators nothing to end the replay.
- Their replay plays on to its end, then waits up to 8 s for a corpse that never comes (`mp.js` `updateFx`, unchanged since D7).
- Its light, in HQ1, fails on its own schedule: here release 139.295 + 4.3 + 2.0 = 145.59 (epoch, …), and the reset came at 140.67.

The earlier runs passed check 4 only because the reset teleported Bob and Carol away from the replay, and the harness put them back too late
to see the rest of the light. This run is the honest measure of what the audit's L6 asked ("a world reset: none"): not met.

The harness now also records check 4c: on every screen, nothing is lit after the light's own scheduled end. The run is repeated with it
(`../../hq1/light_lifecycle.json`).
