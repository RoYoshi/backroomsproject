# Stage 3H2: Human QA (one page)

**Status: STAGE 3H CANDIDATE — HUMAN QA PENDING.** Nothing is accepted until you say so. B++ (`143b63f`) stays the accepted game.
`REVERT_TO_BPP` puts it back byte for byte.

**What changed: nothing you should be able to notice.** Stage 3H2 moved four pieces of code out of the two largest multiplayer files
into four small files. Every line was moved as it was:
- `server/newrun.js`: the server's NEW RUN decision (C-1);
- `server/aftermath.js`: the death aftermath, the corpses and the NEW RUN blast on the server (C-2);
- `assets/net-newrun.js`: the words on the NEW RUN button, and the run menu's words after a blast (C-3);
- `assets/mp-hum.js`: the fluorescent light hum (C-4).

`server.js`, `mp.js` and `index.html` now load these files. **Anything that differs from B++ is a finding.**

**Setup.**
- Copy `STAGE3H_OVERLAY` over your B++ game folder (`WHERE_TO_COPY.txt`).
- Start the server with your own passcode.
- Reload every tab, with sound on.
- You need two players (two windows), one of them with the admin panel. Headphones help for step 6.

- [ ] **1. Start.** The server starts and prints its usual line. The menu, the logo and the boot are as in B++. The browser console
  (F12) shows no red errors.
- [ ] **2. NEW RUN, approved.** In a run, press Esc, then NEW RUN.
  - You blow up at once.
  - The run menu reads **YOU BLEW YOURSELF UP**, then *What is left of you stays where you stood.*
  - The other player sees the same blast and the same pieces. The pieces stay as your corpse.
- [ ] **3. NEW RUN, refused.** Press SPAWN, then press Esc and NEW RUN again within 30 s.
  - Nothing blows up.
  - The button reads **NEW RUN · WAIT n S** for about 2.5 s, then **NEW RUN** again.
  - If you manage to press it while a monster holds you, it is refused too (**NEW RUN · NOT NOW**).
- [ ] **4. NEW RUN as admin.** Open the admin panel, go to DEATHS and turn UNLIMITED NEW RUN ON. Press NEW RUN, then SPAWN, then
  NEW RUN again at once: both are approved, with no 30 s wait. END, from the run menu, returns you to the menu, and entering again
  works.
- [ ] **5. Deaths and corpses.** Get caught by a Hound and by a Smiler, or use DEATHS → play a death on me.
  - The capture, the death camera, the replay for the other player, the corpse and the dropped light are as in B++.
  - A third window that joins **during** a death sees the death finish, and the corpses already lying there.
  - An admin REVIVE during a death cancels it for everyone.
  - A death still playing when an admin uses WORLD → NEW RUN FOR EVERYONE stops for everyone, as in B++.
- [ ] **6. The hum (listen).**
  - Walk from under a light to far away, and back. The hum's level and side follow you.
  - Flickering lights crackle and tink.
  - In a blackout, the hum drops out. It comes back with a thunk when the lights return.

  **No one has listened to this candidate yet.** The tests measured the hum's sound offline: equal to B++ at 60, 120 and 240 Hz.
  They did not play it through speakers.
- [ ] **7. Everything else as in B++.**
  - Moving and turning.
  - The other player looks as fresh and smooth as in B++.
  - Bumping into each other in a hallway.
  - Admin BRING, GOTO and world reset leave people where they were put (B++-0).
  - Lights, shadows and BR-RoLE's pixels.
  - Reconnecting after you reload a tab, and after you restart the server.
- [ ] **8. Known B++ behaviour, kept on purpose.** Seeing any of these is not a regression:
  - the dread drone, thumps and capture burst ignore the volume setting (F-008);
  - the first menu sounds can pause the rooms briefly (F-013);
  - an admin's own GOTO can flicker back for other players (F-019);
  - a pose that arrives more than 900 ms late can undo a placement (F-020).

**If something differs**, write down which step. Then step back one checkpoint at a time to find which move did it: C-4 `859cf07`,
then C-3 `3e140ef`, then C-2 `eb782fd`, then C-1 `91a785f`, then B++ `143b63f`. Each checkpoint has a `ROLLBACK.md` under
`dev/stage-3h/evidence/h2/`.

**YOUR VERDICT:**
- [ ] STAGE 3H PASS / ACCEPT
- [ ] NEEDS CHANGE (what?)
- [ ] STAY WITH B++ (`REVERT_TO_BPP`)

Claude stops after this delivery. Nothing is merged or promoted until you decide.
