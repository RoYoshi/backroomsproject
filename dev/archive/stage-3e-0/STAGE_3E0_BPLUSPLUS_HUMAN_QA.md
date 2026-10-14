# Stage 3E-0: B++ Human QA (gate two)

**B+ is accepted** (your B+ HUMAN QA PASSED). **B++ is a CANDIDATE: B++ HUMAN QA PENDING** until you say otherwise. If you reject it, B+ stays exactly as accepted (REVERT_TO_BPLUS).

**What B++ changes: one server file, `server.js`.** The pages, the icon, B+'s fresher poses and smoothing, the collisions and everything you see are byte-for-byte B+.

- **B++-0, the teleport / world-reset fix.** Before, right after an admin BRING, GOTO or teleport, or a world reset, a step your page had sent just before the move could put you back where you were, if that spot was within about 570 px. About a second later you could also be snapped back again. Now the server ignores such a step: it is farther away than anyone could have moved since the teleport. Every step sent after the teleport counts exactly as before.
- **No speed-up was added.** All of B+'s networking costs well under a tenth of 1 % of one CPU core. Nothing measurable could be won, so nothing was changed (see the report).

**Setup.** Copy the overlay over your **B+** game folder (WHERE_TO_COPY.txt), restart the server, and reload every tab. You need two players (two windows or two computers) and the admin panel.

- [ ] **Teleport and stay.** Stand about 300–500 px from your friend, in the same hall or a straight corridor (that is when the old bug struck). While your friend walks or runs, BRING them to you. Then the other way round: GOTO them. Check that:
  - they land next to you and stay there;
  - there is no snap back after about a second;
  - they can walk off at once, without a stutter or a delay.

  Repeat a few times, once at a short distance.
- [ ] **World reset while moving.** Walk around near the starting hall, and have the admin press WORLD reset. Everyone should land on the start spot and stay there, with no snap back to where they were, no ghost of the old position and no light left behind.
- [ ] **Everything B+ still the same.**
  - **Movement:** walk, sprint, crouch, slide, stop, turn 360°. Friends move as smoothly and freshly as in B+, and their hands swing.
  - **Lights and shadows:** the light, BR-RoLE contact and cast shadows stay on the body.
  - **Collisions:** in a narrow hallway, bump into each other and walk past a shoulder, with no new clipping or unfair stop.
- [ ] **Spawn, respawn, death, NEW RUN, reconnect (reload a tab).** As in B+: no ghosts, no stale poses, no wrong snaps.
- [ ] **Favicon and boot.** Same icon in the tab, `/favicon.ico` still loads, and the menu and logo are unchanged.

**Notes:**
- An admin moving **themselves** (GOTO) was not affected by the bug in the same way, because the server does not check admins' own steps. In the worst case an admin may flicker back for a single update; that is unchanged.
- No new network traffic: bytes, messages and timings were measured identical to B+.

**YOUR VERDICT:** [ ] B++ PASS / ACCEPT   [ ] NEEDS CHANGE (what?)   [ ] STAY WITH B+ (revert B++)

To undo: REVERT_TO_BPLUS (WHERE_TO_COPY.txt). Claude stops after this delivery. Nothing is merged or promoted until you decide.
