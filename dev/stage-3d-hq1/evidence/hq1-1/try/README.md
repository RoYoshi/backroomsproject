# HQ1-1 tuning runs (kept)

These runs shaped the wall stain before the formal HQ1-1 evidence (`../faces`, `../tiers`, `../special`). Screenshots are kept as JPEG.

| Run | What it showed | Changed after it |
|---|---|---|
| `try1_houndC_S` | The first stamp: on the wallpaper band, plainly blood, but small at native size: a 40 px decal, about 15 × 8 px on a 960 × 640 screen | The stain made wider (60 px) and taller |
| `try2_houndC_S` | Bigger. The metric gives 109–190 blood pixels in the band box, under the gate of 150 for some pictures (`stain_metric.py`) | The splash made bigger again (radius 9.6–11.6 px) |
| `try3_houndC_N` | North face: 173–386 | – |
| `try4_houndC_S/E/W` | E 269–326; S 132–215 and W 133–328, still under 150 in some corpse pictures | The splash made bigger again (66 px, radius 10.8–12.8 px, wider spray, thicker runs). The gate itself was not changed |
| `try5_houndC_S/W` | S 172–287, W 182–428: every picture over 150 | Kept: this is the look of the formal runs |
| `try6_corner` | An inner corner: the contact 17 px from it resolves to the S face; the stain runs into the corner's shadow and stops at the run | – |
| `try6_pillar` | A pillar: no papered face, so no stain (`noface`); the floor blood as at D7 | – |
| `try6_behind_S` | A spectator on the far side of the wall: 0 blood pixels where the stain is (the line of sight hides it); the victim sees it | – |
| `try6_high_S` | HIGH quality: 159–394 | – |
| `try6_remasteroff_S` | Refused to start: the spot search needs the remaster's face list | `wall_capture.py --at` (a fixed spot) |
| `wall_faces_try` | `wall_faces_test.py`: every case right the first time | – |
| `wall_lifecycle_try1…4` | try1: a real hound came back during the test and killed the players, so the steps did not hold. try2: the first preview was not seen on the page. try3: a late joiner stamped, removed and re-stamped its stain once on joining (the corpse list is rebuilt when a page enters), and the victim kept her stain after a world reset. try4: all steps pass, except the victim's own screen after a world reset | `clear_monsters` before each step. Removal waits until a stain has been unwanted for 0.5 s (no churn on joining). The world-reset step split into 8a (the other screens: none) and 8b, recorded as a known D7 behaviour: D7 keeps the victim's own local corpse through an admin world reset, and the stain follows it |
