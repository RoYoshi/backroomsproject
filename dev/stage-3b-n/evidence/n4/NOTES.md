# N4 - Shift while crouched (evidence notes)

Rule (one bounded line in `move.js`, client movement; nothing on the server changes):
crouched + Shift held + a direction held -> stand, and the ordinary run takes over - only when running is allowed (not
exhausted, stamina > 0.1, the slide's 0.32 s recovery over) and a standing body fits where you are (out of any crawl
zone, clear of holes and low furniture in walk mode).  Otherwise you stay low; while Shift stays held it happens the
moment it becomes allowed (crawling out from under a table, recovery ending, stamina returning).  Shift never crouches you,
never starts or cuts a slide.  Pressing C while Shift is already held crouches you and C wins until Shift is pressed
again (so "hold Shift, tap C" still crouches).  After a slide (which ends low) Shift still held runs again once the
recovery is over.

Evidence
- `move_after.log` 7/7 (real keys into the real client; M7 networked with a non-admin, server-checked player and an
  observing player): open space, insufficient clearance (0 frames standing where a standing body does not fit),
  exhausted, repeated presses (no flicker), C with Shift held, slide rules, network (0 corrections; the observer sees
  crouch -> run at 285 px/s; 0 px server/client drift).  `move_parent.log` 0/7 (Shift did nothing while crouched).
- `movement_parity_vs_parent.log`: 4 800 move.js ticks identical to the parent in walk / sprint / crouch / crawl / slide
  / vault / deep / recovery (the headless bots never hold Shift while crouched).
- `test_3bn.js` N4 3/3: the headless rule; server movement checks and gait hearing (moveOk, mvCheck, mvAccept,
  hearMove, gaitFloor) byte-identical to the parent.
