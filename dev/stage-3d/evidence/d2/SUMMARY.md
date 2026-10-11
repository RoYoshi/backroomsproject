# D2: blood, gore and geometry-aware traces (dphys.js, gore.js, death_srv.js, server.js, ents)

Changed:
- **Pools stop at walls.** A pool's outline is clamped, in every direction, to where the floor reaches (the level's own ray). Blood no longer paints the top of a wall, pillar or prop.
- **Spatter lands only on floor.** Each drop's head, middle and tail end must be on floor (tile grid plus pillars and props, in `walk` mode for every viewer). Before, only the drop's centre was tested, against the tile grid only.
- **Wall marks for every variant**, where the body really struck (the physics' own contact, faster than 80 px/s, at most three):
  - a smear along the foot of the wall, only as far as there is floor beside it, plus spray thrown back;
  - kept in the corpse record (`bl` seeds 512–543 carry the wall's direction; `bl` holds at most 8);
  - Hound C's scripted smear is replaced by this, at the real contact point (the slam itself is unchanged).
- **Blood lands where the jaws are at the blow itself** (recorded in the physics step), whatever the frame rate. Victim, spectators and server agree.
- **The live blood is redrawn only when something visible changed** (a pool growing, spray in flight, a drying step, the trail growing).

Results:
- **`gore_geo_test.js`** (508 server-run deaths at open, corridor, corner, pillar and wall spots; every drawn point checked):
  - parent: 2,103 of 2.25 M live-frame points and 2,465 of 2.80 M corpse points lie on something solid;
  - D2: **0 and 0**.
- **`phys_matrix`**: as D1. Wall marks:
  - every mark sits on a wall face with floor in front of it (0 bad);
  - every blow's blood is on floor;
  - Hound C leaves a mark in 18 of 18 runs.
- **golden3d**: non-death output identical.
- **Server corpse cost**: same as D1 within noise (interleaved runs: sum of the eight medians 66–72 ms against 70–78 ms).
- **Browser** (`perf_vs_d0.md`): every window within D0's thresholds.
- **Parity**: as D1; the victim's seed is fixed in D4.
- **Film**: `film/sheet_*.jpg`, parent and D2 block by block.
