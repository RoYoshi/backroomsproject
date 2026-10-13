# `life_hq2.py`: its first runs, while the harness was being written

`life_hq2.py` is new at H2-6. Its first runs failed for reasons of the harness, not of the game. Each is kept here with what was changed after it. The runs that count are in `../../browser/life_light.json` and `../../browser/life_lab.json`.

## 1. `1_room_emptied/`

**`light` (1/5).** Bob's connection was dropped at +4.2 s, and Carol's page was reloaded 0.3 s later. Alice was out of the world after her NEW RUN. Bob's new connection then joined a room with nobody else in a run.

The game's own rule applies there (`sim.js` `join`, unchanged since before HQ2): the first player into an empty room starts a new world. So the world reset, and the corpse went with it (the observer's corpse list is empty from +7 s).

Two more faults showed in the same run:
- The light profile was read from the wrong message: the NEW RUN answer does not carry it; the blast does.
- Carol's reload blocked the harness for 34 s, so every later step came late.

**`lab` (7/8).** The reset came 2.2 s after the server's replay message. On these pages the replay had been on screen for only 0.48 s by then, under the setup check's 0.5 s.

**Changed afterwards:**
- Bob is back in before Carol's page reloads, so the room never empties.
- The profile comes from the blast as the server sent it.
- The reload runs beside the other steps.
- The reset comes 3 s after the replay message. The death lasts 4.3 s, so it is still in progress on the server.

## 2. `2_short_hold/`

**`light` (4/5).** The blast's light held 3.1 s. Bob was back in at +5.3 s and Carol reloaded at +6.2 s, both after the light's end. Carol's reloaded page therefore had no frame in the hold.

**Changed afterwards.** The harness first makes admin world resets until the next blast's light holds at least 6 s. The profile is the server's hash of the world's number and the event id. Every step then lands in the hold: in run 3 the drop came at +1.4 s, the hide at +2.8 s, Bob was back in at +4.6 s and Carol reloaded at +5.5 s, against a 6.7 s hold.

## 3. `3_judged_by_the_earliest_anchor/`

**`light` (4/5).** Two faults in the check itself:
- **The anchor.** Every page's frames were judged against the earliest page's anchor. Carol's reloaded page took its anchor from the corpse's age, which is in tenths of a second, so it was 31 ms earlier than Alice's. Two of Alice's frames, lit at 7.699 s by her own anchor (the end is 7.7 s), counted as "after the end".
- **The reloaded page.** The last row of Carol's first page, the one before the reload, was in the hold. It counted as "a dead light still lit at the end".

**Changed afterwards.**
- Each page is judged by its own anchor. The pages' anchors are gated against each other separately, within 150 ms (here 33.7 ms).
- A page that stops before the end is not asked about the end.

`light.reanalysed.json` is the same run under the final checks (`--reanalyse`): 5/5.
