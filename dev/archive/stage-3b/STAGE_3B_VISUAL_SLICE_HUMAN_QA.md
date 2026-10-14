# Stage 3B: Level 0 visual remaster — human QA checkpoint 1

**Status: `STAGE 3B VISUAL-SLICE HUMAN-QA CANDIDATE — WAITING FOR USER`**

This is the first playable Stage 3B remaster checkpoint. Four rooms are remastered: **YELLOW HALL, HUMMING ROOMS, BLACKOUT ZONE and PILLAR HALL**. Every other room still has the v23.3.6 / BR-RoLE 1.0 look, so you can see the change at their doorways.

I have not marked anything PASS: you judge the art direction. The rest of the map waits for your verdict.

- **Branch:** `stage-3b-remaster`.
- **Commit:** in `STAGE_3B_PACKAGE_RECEIPT.txt`.
- **Ancestry:**
  - BR-RoLE 1.0 `b86966b` (accepted lighting parent);
  - gameplay v23.3.6 `f2805bb`.
- **Untouched:** `main`.
- **To start:** run `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open http://localhost:8000 as usual. The spawn is in YELLOW HALL.

## Comparing with the old look

| | how |
|---|---|
| remaster off (the exact old look) | open `http://localhost:8000/?remaster=off` in a second tab |
| live toggle | open `http://localhost:8000/?dev3b=1`, then: **F8** remaster on/off; **F9** the experimental wall-depth cue; **Shift+F8** stains and dressing on/off. A small tag at the bottom left shows the state. |
| the wall-depth experiment | `?walldepth=on` (or F9 with `?dev3b=1`) |
| quality tiers | SETTINGS ▸ CUSTOMIZE ▸ LIGHTING: LOW / MEDIUM / HIGH. The remaster follows BR-RoLE's tier (see below). |

These are QA tools, not player settings.

## What changed (presentation only)

### Floor
- **Carpet:** a new generated carpet, brownish-beige loop pile that reads yellow under the tubes, with fine fibre grain and soft mottling. It no longer shows the old 164 px tile grid.
- **Laid in rolls:** each roll has its own pattern phase and a whisper of tone, with faint seams between them.
- **Per-room wear map:**
  - matted, greyer traffic paths between the doorways;
  - dirt along wall bases;
  - damp patches.
- **Gone:** the painted glow ellipses under lamps (BR-RoLE already lights there) and the 48 % black paint over BLACKOUT ZONE. Its darkness is now only the game's lighting.

### Walls
- **Wallpaper and baseboard:** sickly yellow paper with faint stripes and chevrons, and a scuffed baseboard. Grime thickens toward the floor.
- **Corners:** clean mitred corners. Inner corners are filled instead of showing the old notch.
- **Wall marks:** damp wicking up, lifted seams, mildew and outlets.
- **Same geometry:** the bands keep the old widths, so walls read in the same places.
- **The game's sight shape** only shows the lowest ~24 px of a wall face, so the detail sits there.

### Fixtures
- **New housings:** prismatic troffers with the tubes glowing through, end caps and dead insects. Same size, position, ceiling parallax and see-through as before.
- **Every 13th tube:** it was always drawn dim. It is now an old tube with blackened ends, and it still lights normally, as it always did.
- **HUMMING ROOMS:** yellowed lenses.
- **BLACKOUT ZONE:** dead, cracked, missing and hanging housings on the lamp grid. They emit nothing: there are still no lamps there.

### Props
All props keep their exact footprints.

| prop | change |
|---|---|
| counters | worn laminate |
| HUMMING ROOMS counter | a dead desk phone, papers, a service bell, and a taped cable run across the carpet from the wall |
| BLACKOUT ZONE table | a raised top over a dark gap, so it reads as crawl-under, with an abandoned paper and binder |
| crawl holes | broken board edges, cut studs, insulation and spilled crumbs; still clearly readable as crawl holes |

### Pillars (PILLAR HALL)
- **Columns:** the nine 56 × 56 pillars are papered columns, with the same paper and baseboard as the walls, mitred.
- **Bases:** mildew at the base and a soft contact shade.
- **Footprints:** exact.

### Dressing and storytelling
Sparse, flat and deterministic: every player sees the same thing on every load.
- stains, cup rings, damp blooms with tide lines, scuffs;
- drifting paper, tape, grit;
- mildew in corners;
- broken tube glass under dead fixtures, a fallen ceiling tile.

None of it blocks, hides or promises collision.

### Room identity
The same Level 0 language everywhere; the rooms differ only by degree.

| room | identity |
|---|---|
| YELLOW HALL | the clean baseline |
| HUMMING ROOMS | worn office: paths, cables, a busy counter |
| BLACKOUT ZONE | failed power: dirtier, wetter, abandoned |
| PILLAR HALL | damp gathering at column bases |

## How it is built

- **Data-driven, ready for a future seeded generator:** `assets/level0_visuals.js` defines reusable parts:
  - carpet variants;
  - wall finishes;
  - fixture profiles;
  - damage profiles (wear, damp, grime, stains, mildew, wall condition);
  - dressing sets;
  - prop sets;
  - structure sets.
- **Room archetypes** combine those parts, and each room names an archetype. Nothing in an archetype is tied to a position. **No generator was built:** the layout is unchanged.
- **The renderer:** `assets/l0-remaster.js` paints over the level art. It never writes game state and never adds a blocker or a light.
- **BR-RoLE:** unchanged. Walls, pillars, counters and the table keep the footprints BR-RoLE already casts from. Everything new is flat and casts nothing. The `casters` notes in the data file record this.
- **Cost model:**
  - textures are generated once at load (about 0.5–1 s, while you are on the menu);
  - geometry is static;
  - rooms out of view are culled;
  - nothing is drawn per frame.
- **LOW:** smaller textures, about half the stains, and no wear map.

## What was checked (quick checks, by policy)

- **Unit checks** (`dev/stage-3b/test_3b.js`): **18 / 18**. They cover:
  - the visual data matches the game's own room, lamp and prop identity;
  - archetypes all resolve, and none contradicts a gameplay surface;
  - no `Math.random` and no game RNG;
  - floors cover exactly the remastered floor cells;
  - every wall band stays inside its wall cell (all four orientations, both wall modes);
  - props and pillars are drawn exactly on their footprints;
  - the same art on every build;
  - no game-state writes and no network;
  - fail-safe;
  - LOW is cheaper;
  - fixtures sit on the legacy footprints;
  - the old carpet is redrawn identically where the remaster does not own the floor.
- **BR-RoLE unit checks:** **32 / 32**.
- **Gameplay freeze** (`dev/stage-3b/freeze_3b.py`): **FREEZE OK**.
  - Every protected file is byte-identical to v23.3.6: `ai.js`, `sim.js`, `move.js`, `server.js`, `mp.js`, `death_srv.js`, `dphys.js`, `camera_policy.js`, `world.js`, `light.js`, `ents.js`, `camcorder.js`, `timing_policy.js`.
  - The two presentation edits (two script tags, two guarded hooks) undo to the BR-RoLE 1.0 bytes, then to v23.3.6.
- **Browser smoke** (`dev/stage-3b/smoke_3b.js`): **8 / 8**.
  - Remaster off is pixel-identical to a `?remaster=off` page.
  - BR-RoLE's light overlay is byte-identical with the remaster on and off.
  - The same network messages are sent.
  - A non-remastered room is unchanged: a few pixels round by up to 4 / 255, invisible.
  - Tiers rebuild, and the DEV toggles and F8 work.
  - S02 needed one re-pose of its two pages, now built into the check: one earlier run caught a page before it reached the pose.
- **Performance sanity** in YELLOW HALL (this container renders in software, where every full-screen layer is expensive):
  - frames 436 → 541 ms, about +24 %;
  - BR-RoLE's own time unchanged (22 → 21 ms).

  On a real GPU the extra layers are far cheaper. **Please tell me if you feel any slowdown, especially on a phone.**
- **Not run, by policy:** the retained suites, screenshot matrices, long benchmarks.

**Evidence:** `dev/stage-3b/evidence/qa1/`, with legacy-vs-remaster sheets:
- columns: remaster off | on;
- rows: the game as played, the same ×2.5 for the eye, and the bare materials with the darkness hidden.

## Tour (about 15 minutes, MEDIUM)

| # | where | look at |
|---|---|---|
| 1 | **YELLOW HALL**, spawn, light off | the carpet under the lamps: grain, no tile grid, faint seams; the walls' baseboards and grime; the new fixtures; F8 back and forth |
| 2 | YELLOW HALL west partition (crawl hole) | the hole still reads as a hole; crawl through it as usual |
| 3 | YELLOW HALL east, the counter | worn laminate and a stray paper; its BR-RoLE shadow unchanged |
| 4 | the doorways out of each remastered room | the metal threshold strip where the new carpet meets the old corridor carpet (the rest of the map is still old) |
| 5 | **HUMMING ROOMS** counter (north-centre) | phone, bell, papers, the taped cable; worn paths; yellowed lenses |
| 6 | **BLACKOUT ZONE** (south-west), flashlight | darkness from lighting only; your beam reveals a dirtier, damp carpet, mildew, the table, broken glass; dead fixtures overhead |
| 7 | **PILLAR HALL** (north-east) | the papered columns; mildew at their bases; walk around them (collision as before) |
| 8 | anywhere above | F9 (with `?dev3b=1`): the experimental uniform 18 px wall faces with a lit lip; better or worse? |
| 9 | SETTINGS: LOW, then HIGH | LOW keeps the look with fewer stains and no wear map |
| 10 | play normally for a few minutes, with Hounds or Smilers about | readability of entities, items and your own light; any stutter |

## Questions

Please answer each with yes / no / notes, and say which tier and device you used.

1. Does this finally look like the visual direction THE FAR BACKROOMS should use?
2. Is the carpet better without becoming noisy?
3. Are the walls richer without becoming over-damaged?
4. Are props better while still matching their collision?
5. Do stains, grime, dampness and mildew feel atmospheric rather than random clutter?
6. Do the four rooms feel different without becoming separate biomes?
7. Does BR-RoLE still look natural on the new materials?
8. Is the optional wall-depth treatment (F9) better, or should it remain off?
9. Any readability or performance problem?
10. Do the papered pillars (PILLAR HALL) work?
11. Approve this art direction for the full-map Stage 3B (the remaining eight rooms and corridors)?

## Known limits of this checkpoint

- **Only four rooms are remastered.** Corridors and the other eight rooms keep the old art, so doorways show the transition.
- **ARCH GALLERY's arches** and any architectural irregularity are not done yet.
- **Wall tops** stay the old dark cap. They are almost never visible, because the sight shape stops 24 px into a wall.
- **The wall-depth cue** is a DEV experiment, off by default.
- **The performance figure** above is from software rendering. A real-device check is part of your QA.
