# Stage 3E-0: B+ Human QA (gate one)

**B+ is a CANDIDATE until you say it passes.** The accepted fallback is Stage 3D HQ5 (`stage-3d-hq5` `ad98475`). B++ will not start before you write **B+ HUMAN QA PASSED**.

**What should look different:**
- Other Wanderers glide instead of stepping 20 times a second.
- Their hands now swing when they walk. In HQ5 the walk cycle of other players never ran.
- Their poses are about 13 ms fresher on average (26 new poses a second instead of 14).
- The browser tab shows your icon.

Your own Wanderer, the monsters, the lights and collisions are meant to be exactly as in HQ5.

**Setup.** Copy the overlay (WHERE_TO_COPY.txt), restart the server, and hard-reload every tab. Use two windows side by side, or two computers: Alice moves, Bob watches. To compare, reload **Bob's** page with:

| Bob's address | What Bob sees of the others |
|---|---|
| `http://localhost:8000/?peers=a` | **A**: exactly HQ5 |
| `http://localhost:8000/?peers=b` | **B**: HQ5's 20 Hz poses, eased by time |
| `http://localhost:8000/` | **B+** (default): fresher poses, eased |

The switch changes only that page. A page in A or B mode also talks to the server exactly like HQ5, so it gets no fresher poses and sends none.

- [ ] **Two players walk, sprint, crouch, slide.** Friends move consistently in B+, with no new visible delay and no rubber-banding. Compare with A and B.
- [ ] **Stop suddenly, turn 360°.** The body, hands, gear, flashlight beam, BR-RoLE contact shadow and cast shadow, and the name on hover stay together, with nothing trailing behind.
- [ ] **Narrow hallway and collisions.** Walk into each other in a one-tile corridor, then walk past a friend's shoulder. Check for:
  - no new clipping;
  - no unfair stop;
  - no way to push through;
  - nothing on screen that disagrees with where the server stops you.
- [ ] **Respawn, NEW RUN, death, reconnect (reload a tab), world reset (admin).** Look for ghost avatars, stale poses, a friend gliding across the map after a teleport, or a light left behind.
- [ ] **Network and performance.** The measured numbers are in `STAGE_3E0_BPLUS_REPORT.md`, sent with the overlay and on the branch (A/B/B+, bytes, server CPU, with and without jitter). If you can, also play once over a real network, such as a friend over the internet, and say whether B+ still feels better than A.
- [ ] **Favicon.**
  - A new private window shows your icon in the tab.
  - `http://localhost:8000/favicon.ico` shows the icon, not "not found".
  - The game boots and the menu and logo are unchanged.

**Notes:**
- The easing draws a straight line between two accepted poses, about 20 px apart at a sprint (about 12 px in B+). Round a wall corner, a friend's edge can graze that corner for a frame. Bigger moves than 96 px (teleport, spawn) are shown at once, never glided.
- **Known and older than B+ (in HQ5's server too).** Right after an admin teleport or a world reset, a pose your page sent just before can put you back where you were, if that spot is within about 570 px. Tests saw it on both builds. B+ sends twice as often, so it may happen a little more. It is not fixed here (see the report).
- At 2–3 players the extra upload is about 3 KB/s per B+ player. The extra download per player is under 1 KB/s at 2 players and about 2.4 KB/s at 7.

**YOUR VERDICT:** [ ] B+ PASS / ACCEPT   [ ] NEEDS CHANGE (what?)   [ ] REVERT / A OR B PREFERRED

To undo: REVERT_TO_HQ5 (WHERE_TO_COPY.txt). After this delivery Claude stops. Only after **B+ HUMAN QA PASSED** may a new branch `stage-3e-0-bplusplus` be made from the accepted B+ commit, with its own separate QA.
