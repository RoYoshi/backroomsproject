# Stage 3D: human QA (Gore & Death 2.0)

The automated checks are in `STAGE_3D_REPORT.md`. Only a person can judge how the deaths look, sound and feel. Only you can say **HUMAN QA PASSED**.

## Setting up

1. **Unzip and start the server.** Unzip `THE_FAR_BACKROOMS_STAGE_3D_GORE_DEATH_2_0_HUMAN_QA.zip` and start it with your own admin passcode:

   ```
   ADMIN_PASSCODE=<your passcode> node server.js 8000
   ```

   On Windows, `set ADMIN_PASSCODE=<your passcode>` first, then `node server.js 8000`. Without the variable, the README's default applies.
2. **Open the game twice.** Open http://localhost:8000 in two browser windows (two players: the victim and a spectator). For the late-join checks, a third window.
3. **Enter both.** In each window choose PLAY, type a name and enter. Stand within a few metres of each other, in a lit hall.
4. **Open the Death Lab.** In the victim's window press `` ` `` (backtick), enter the passcode, open the **DEATHS** tab:
   - **PLACE ME FIRST:** OPEN ROOM, NEAR A WALL (for Hound C), IN A CORNER;
   - **PLAY A DEATH ON ME · HOUND** (A THROAT, B DRAGGED, C WALL SLAM, D EXHAUSTED) and **· SMILER** (A RUSH, B CORNERED, C LIGHT FAILURE, D PLAYED WITH): each kills you through the real path. The server decides and commits it exactly as in play;
   - **AFTER IT PLAYS:** AUTO-REVIVE (on by default) stands you up 1.3 s after the death ends, BACK TO THIS SPOT puts you back where you were. Turn AUTO-REVIVE off for D5 and whenever you want to stay dead and look at your corpse;
   - **DEATH LAB · WATCH IT SLOWLY:** 1× / 0.5× / 0.25×, pause, step 1 or 6 frames, X-RAY ATTACKER, SHOW PATHS · FORCES, REPLAY LAST. The clock changes only what you see on that screen.
5. **Spectator safety.** On the spectator's window it helps to switch off monsters (MONSTERS tab: remove hounds and smilers) or give the spectator GOD MODE (PLAYERS tab), so the spectator is not the next victim.
6. **Respawn.** With AUTO-REVIVE off, press RESPAWN in the victim's window after each death.
7. **For D6, unlock the admin panel in the spectator's window too** (backtick, passcode), so it can revive the victim while the victim is dying.

There are no unauthenticated controls: the Death Lab needs the admin passcode, as before.

## The checks

Each row says what to do and what you should see. Note anything that looks wrong, with the variant and roughly when.

### A. The eight deaths: body and hands (victim and spectator)

| # | Do | Expected |
|---|---|---|
| A1 | Each of the eight at 1× (Hound C: NEAR A WALL first) | The death plays as before 3D: the same kind of attack, the same rhythm, the same length (Hound 4.3–4.7 s, Smiler 3.85–3.95 s). One round body, two round hands; no limbs. |
| A2 | Watch the end of each death | The body comes to rest and stays there: no slow slide, no hands trembling, no settle after the death screen. (Before 3D a hound's victim kept being dragged a few pixels per second.) |
| A3 | The same deaths at 0.25× with X-RAY ATTACKER | Hound A: knockback and spin, four blows. Hound B: dragged up to about a body-length and a half, the hands brace and slip. Hound C: driven into the wall. Hound D: collapses at once, little spin. Smilers: the shove, then the body drawn in. |
| A4 | Compare the victim's and the spectator's screens | The same death, the same final position of the body, the hands, the light and the hat. |

### B. Blood and gore

| # | Do | Expected |
|---|---|---|
| B1 | Deaths next to walls, in corners and next to pillars (PLACE ME FIRST) | Pools stop at the wall or pillar; no blood is painted on top of a wall, pillar or furniture. |
| B2 | Hound C NEAR A WALL; any death where the body slams a wall | A smear along the foot of the wall exactly where the body struck, spray thrown back onto the floor, never on the wall top. Visible to victim and spectator, and still there on the corpse. |
| B3 | Watch the blood during each death | Blood appears at the moment of each blow, where the jaws are, and spreads; Hound B's drag leaves a smear along its path. |
| B4 | Look at a corpse for half a minute | At first it is the death's last frame (no jump in the blood when the death ends). The blood darkens over about 5 s; the pool under the body spreads for about 18 s, then stays. |
| B5 | In darkness (a blackout, or a dark corridor) | Blood is as dark as its surroundings; no blood glows or lights anything. |

### C. Gear, hat and light

| # | Do | Expected |
|---|---|---|
| C1 | Deaths with a flashlight, a lantern, a headlamp | Hound A drops the light at the 2nd blow, B when the drag starts, C at the wall, D early. Smilers: when the body is drawn in. A headlamp stays on the head. The light tumbles, slides and stops, never inside a wall. |
| C2 | The spectator watches a death with the victim's light on | The spectator sees the victim's light tumble out and land, where the victim sees it. (Before 3D it went dark for the spectator until the corpse appeared.) |
| C3 | Look at the corpse's light afterwards | The dropped light keeps shining from its lens, in the same direction as when it landed; a camcorder never lights up. |
| C4 | Hats (cap, hard hat, beanie) | Knocked off at the moments in A3 (Hound A at the 3rd blow, B and C as above), or stays on (Hound D, Smilers); a hat on the floor stays where it landed. |

### D. Multiplayer

| # | Do | Expected |
|---|---|---|
| D1 | Any death, both windows | The spectator's replay starts with the victim's; both end on the same corpse. |
| D2 | A third window joins while a death is playing. A death lasts about 4 s, so get the third window ready first: PLAY, name typed, waiting at the name prompt; play the death in the victim's window, then press Enter in the third | The newcomer sees the rest of the death from where it is, then the same corpse. |
| D3 | The third window joins half a minute after a death | It sees the corpse as dry as the others see it. |
| D4 | Close the victim's window the moment it dies | The spectator still sees the whole death and the corpse with its light. |
| D5 | Respawn early (press RESPAWN as soon as you can) | The corpse still appears at the end of the death; one corpse per player. Dying again replaces it. |
| D6 | In the spectator's admin panel, PLAYERS tab: press REVIVE next to the victim while it is still dying (within about 4 s of the death starting; have the tab open beforehand) | The spectator's replay stops; no corpse appears. |
| D7 | WORLD tab: **NEW RUN FOR EVERYONE** (confirm "Reset the whole world?") during a death | No corpse from the old world appears in the new one. |
| D8 | NEW RUN from the run menu (alive) | As before: the vanish, and the light left behind where you stood. |

### E. Sound

| # | Do | Expected |
|---|---|---|
| E1 | Hound C, Hound D and Smiler B with sound on (victim) | The blows are heard when they land on screen (Hound C's double blow at .2 / .21 s; Hound D's first at .45 s; Smiler B's first at .7 s). |
| E2 | Hound C into the wall; any death that drops a flashlight | A heavy thud as the body hits the wall; the light clatters as it lands; a soft sound when a hat lands. |
| E3 | The spectator, a few metres away, then far away (behind walls, across the map) | Near: the death is heard, from its side. Behind a wall: muffled. Far: nothing. |
| E4 | Sound OFF in the settings | Nothing of the death is heard. |
| E5 | The main menu after deaths | The menu music and sounds are as before; no death sound plays on the menu. |

### F. Camera, motion, fairness

| # | Do | Expected |
|---|---|---|
| F1 | Any death | The death camera is as before: it follows the body and zooms in (1.4×); the field of view is the same as before; no extra view of the map. |
| F2 | Settings: reduced motion ON, then a Hound A death | The camera shake of the blows is much weaker (a quarter); everything else the same. |
| F3 | A camcorder with IR, around a Smiler | As before: the Smiler does not react to IR; IR is presentation only. |

### G. The rest of the game is as before

| # | Do | Expected |
|---|---|---|
| G1 | Play a few minutes normally: walk, sprint, crouch, vault, crawl, hide | Movement, monsters, lighting (BR-RoLE), true darkness, the menu, the HUD and the inventory are as before 3D. |
| G2 | Ten deaths in a row, then play on; with three windows, leave a corpse from each in one hall and walk past them | No slowdown, no corpse or blood left floating, no replay left behind; the corpses in view cost no more than an empty hall. (Each player has one corpse, so a few windows give only a few. Twenty at once were measured automatically, `STAGE_3D_PERFORMANCE.md`.) |

**Notes on the Death Lab preview:**
- With AUTO-REVIVE on, after a preview death the admin stands up again next to its own corpse. That is the lab's own behaviour, unchanged.
- The lab's slow clock slows only your own screen. The server makes the corpse on its own clock, so when you step a death slowly, the other window shows the corpse when the real death would have ended.

When everything above is as expected, write **HUMAN QA PASSED**. Otherwise, say which rows failed.
