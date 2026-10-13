# H4-2: the Wanderer's cast starts from her round body

## The edit

`assets/br-role.js`, `actorShadows()`: one condition, plus its comment.

```
-          start = Math.max(start, off + sup); if (q === sil[0]) across = ...
+          if (kind !== 'player' || q === sil[0]) start = Math.max(start, off + sup); if (q === sil[0]) across = ...
```

**For a Wanderer**, where the cast leaves the silhouette is now the round body's own edge along the light's direction. The two hands no longer push it outward.

**Unchanged:**
- The hands are still in the silhouette, so they are still cut out of the cast and still get their self-shading.
- The light's direction, the cast's length, width and strength, the self-shading, the easing and the dominant/second light choice.
- Hounds take the same path as before (`kind !== 'player'`; their silhouette is one torso).

## Results (`steps.txt`, `lab_report.json`, `lab2_report.json`)

Both variants use H4-1's bundle; only `br-role.js` differs. `h41` is HQ3's `br-role.js` (before), `h42` is HQ4's (after). The game tree is the accepted HQ3 QA1 export. The scene is frozen, with fixture 2 alone at MEDIUM and her own light off.

| Check | Before (HQ3's BR-RoLE) | After (HQ4's) |
|---|---|---|
| Cast start as she turns, 24 headings, body and fixture still | 18.00-25.87 px (tip 68.0-75.9) | **18.00 at every heading** (tip 68.0) |
| Hands at a walk's swing extremes (+-3 px), 4 headings | 18 / 19.5 / 19.65 / 22.5 / 23.74 | **18** |
| Far end of the drawn shadow, measured from captures with the actor effects on and off, 8 headings | 57.6-63.6 px | **57.6 at every heading** |
| Everything else in BR-RoLE's job (direction, length, width, strength, self-shading, silhouette), 24 headings | | **identical** apart from `start` |
| The light still moving the shadow: she stands at 3 spots around the fixture | direction 0 / 34 / -29 deg, length 35 / 55 / 75 | **the same** (start 18) |
| Bob's flashlight from 4 sides (the fixtures off) | the cast points away from him: 167 / -103 / -13 / 77 deg; start 18 / 22.0 / 22.1 / 18 | **the same directions**; start 18 |
| A Hound (a stand-in for BR-RoLE at a fixed spot, 3 ways) | | **identical jobs**, number for number |
| A second Wanderer beside her | a cast is drawn for him (start 20.76) | drawn (start 18) |
| The same Wanderer behind a wall | no cast (no x-ray) | **no cast** |
| BR-RoLE's own frame cost, all fixtures, 6 s, SwiftShader | mean 17.8 ms, p95 24.6 | mean 17.3 ms, p95 22.4 |
| Page errors | 0 | 0 |

**The sheet.** `cast_rotation.png` shows the shadow alone (actor effects off minus on, brightened x4) at 0, 90, 180 and 315 degrees, before and after. The blue line is where the tip lies with the body alone; the red ring is where BR-RoLE put it.

## Attempts

The first run (`lab/`) could not measure two scenes. They were run again in `lab2/`.
- **Bob's flashlight from the north and south.** His mouse pointer went off his small page, so he aimed elsewhere.
- **The admin `near` Hound.** It landed 667 px away in one variant and out of sight in the other.

Everything else in `lab/` stands.

## To undo

Any of these restores HQ3's file:
- revert this commit;
- drop the `if (kind !== 'player' || q === sil[0])` guard in front of `start = ...`;
- copy `assets/br-role.js` from `4934319`.
