# Stage 3B — 3B0 preflight and visual audit

## Preflight

| check | result |
|---|---|
| remote `br-role` | `b86966b5f59070b0f4c15b000c70a95e5f3b4e00`, tree `ec318af1d2e1160632feef755bf76ff92d7caa4d` (the accepted BR-RoLE 1.0 parent, as the pack states) |
| remote `main` | `7781e1ac34aa09970df57fae3fc107a873fa2731`, unchanged; no newer work on it |
| donors present | `part-3a` `4d1f17a` (tree `c1e0fc5…`), `part-3b` `c392272` (tree `666ad24…`), both matching the pack |
| new branch | `stage-3b-remaster`, created from exactly `b86966b` |
| baseline sanity | BR-RoLE unit suite **32 / 32**; gameplay freeze **FREEZE OK**; `node server.js` serves `index.html`, `assets/br-role.js`, the bundle, `world.js` and `assets/carpet.png` (200). One staged browser page loaded the six slice views with no page error (`dev/stage-3b/look_3b.js`). |

## Where Level 0's presentation lives today

Everything below is v23.3.6 presentation code. Stage 3B **reads** it; it changes none of it.

### Rooms (the bundle's room table `Oc`, 96 × 72 cells of 96 px)

| code | name | cells (x, y, w × h) | floor cells | gameplay surface (`world.js`) | lamps | props |
|---|---|---|---|---|---|---|
| 01 | YELLOW HALL | 3, 27, 18 × 18 | 302 | carpet | 7 (lamp 0 dim) | L1 counter, G1 hole |
| 02 | REPEATING ROOMS | 25, 25, 19 × 20 | 342 | carpet | 13 | L2 shelf, G2 hole, W1 window |
| 03 | SEGMENTED ROOMS | 49, 28, 18 × 17 | 275 | carpet | 7 | L3 low wall, U2 bench, G3 hole |
| 04 | HUMMING ROOMS | 25, 7, 20 × 12 | 218 | carpet | 8 | L4 counter, G4 hole |
| 05 | NORTH ROOMS | 4, 7, 17 × 12 | 188 | carpet | 6 | — |
| 06 | LONG ROOM | 50, 7, 25 × 11 | 243 | concrete | 9 | 10 dark columns (`Mc`) |
| 07 | BLACKOUT ZONE | 4, 50, 18 × 13 | 216 | carpet | **0** (the lamp rule skips it) | U1 table |
| 08 | DAMP ROOMS | 27, 51, 18 × 12 | 199 | wet tile | 6 | L6 counter, G6 hole |
| 09 | RED ROOMS | 51, 51, 18 × 12 | 198 | carpet | 6 | L7 low wall |
| 10 | ARCH GALLERY | 73, 27, 19 × 18 | 318 | carpet | 12 | L5 railing, G5 hole, W2 window |
| 11 | PILLAR HALL | 77, 7, 15 × 14 | 203 | carpet | 9 | 9 pillars (`Pc`) |
| 12 | DEEP CARPET | 73, 51, 19 × 13 | 230 | deep carpet | 7 | L8 machine |

Totals: 3 308 floor cells (376 of them in corridors outside every room), 3 604 wall cells (1 037 touch the floor), 90 lamps, 18 props, 9 pillars, 10 columns. They match the Part 3A donor's identity counts.

**The three slice rooms resolve to:**
- `room:01` YELLOW HALL, 288–2016 × 2592–4320 px. The spawn is at 960, 3264.
- `room:04` HUMMING ROOMS, 2400–4320 × 672–1824 px.
- `room:07` BLACKOUT ZONE, 384–2112 × 4800–6048 px.

### Drawing paths

All in the bundle's renderer `build()` (`assets/index-DKbV5Nv9.js`), built once at load:

1. **Carpet.** `assets/carpet.png` (512² RGB, 463 KB) is drawn as one TilingSprite over the whole world at `tileScale .32`, so it repeats every 164 world px.
2. **One static Graphics (`level`)**, in this order:
   - **floor blots:** 20 % of floor cells get a random brown ellipse (α .05–.14), and 2.5 % a green one. The bundle's own LCG, seeded 42, picks them; that is presentation randomness, not gameplay RNG.
   - **walls:** each non-floor cell gets a flat cap (`#7c713b`; red rooms `#683429`). Bands are added on each side that faces floor:
     - south: 46 px, with a diamond motif, a 13 px baseboard and a 7 px shadow spilling onto the floor;
     - east and west: 27 px;
     - north: 23 px.

     The bands overlap at the corners.
   - `WORLD.drawProps(level)`, the prop art in `world.js`;
   - the 10 LONG ROOM columns and the 9 PILLAR HALL pillars;
   - **room tints, as flat rectangles over the whole room**, walls included:
     - BLACKOUT ZONE black α .48;
     - RED ROOMS red α .25;
     - DEEP CARPET brown α .14;
     - DAMP ROOMS green α .09;
   - the ARCH GALLERY arch outlines;
   - **under every lamp:** a pale glow ellipse (α .11, red α .22 in the red rooms) and a dark strip.
3. **`lampTop`:** a separate Graphics for the 90 fixture housings. It sits above every actor at α .84, with a ceiling parallax (scale 1.06, shifted −.06 × camera). The tube is cream, red in the red rooms, and dim on every 13th lamp.

**`world.js` is a protected file.** Its `drawProp` art (counter, shelf, low wall, railing, machine, table, bench, hole, window) can therefore only be covered, never edited.

### Render order (`world` container)

```
carpet TilingSprite
BR-RoLE grounding root (inserted by BR-RoLE at runtime, right above the carpet)
level Graphics (floor blots, walls, props, columns, pillars, room tints, arches, lamp glows)
objective trace views
corpses, blood, debris, you, other wanderers / entities (masked by line of sight), the sight mask
lampTop (fixtures, ceiling parallax, α .84)
```

The DOM overlays sit above the WebGL canvas: `#mp`, `#light` (BR-RoLE's darkness, with the game's line-of-sight blackout), `.grain` and `#dread`.

### Lamp presentation inputs

- **The lamps:** `Fc`, the lamp rule (offset 2, stride 5, every room but BLACKOUT ZONE), exposed as `__api.lamps`.
- **Who uses them:** BR-RoLE lights each one as an 86 × 24 tube area source. The game's gameplay light (`Ul`) reads their positions and `__ents.lamp()` strength.
- **Presentation only:** the fixture art and the glow ellipses. Stage 3B may restyle those. It may not move a lamp or change its power.

### Material / surface categories

`world.js` `SURF` gives the gameplay surfaces, chosen by room name:
- DAMP ROOMS: wet tile;
- LONG ROOM: concrete;
- DEEP CARPET: deep carpet;
- everything else: carpet.

They change the slide and step feel. A visual material may never contradict them: the slice rooms are all carpet.

### Seams Stage 3B can use

- **`index.html`:** classic scripts run before the bundle's deferred module script, so a presentation module defined there exists when `build()` runs.
- **The bundle's `build()`:** BR-RoLE already set the pattern of guarded hooks that undo to the parent byte for byte.
- **Scene discovery,** as BR-RoLE does it: `__api.floor().parent` is the world. The Graphics, Container and Texture classes come from existing children.
- **`server.js` is protected and serves only a whitelist:** a few root files plus `assets/<flat name>`. A new client file therefore has to live in `assets/`. That is why the presentation authority is `assets/level0_visuals.js`, not `levels/level0_visuals.js`.

## Visual problems, concretely

Seen in `dev/stage-3b/evidence/3b0/` (the game, plus the same frame with the darkness overlay hidden):

1. **The carpet tiles visibly.** The 164 px repeat shows as a grid of faint light seams on open floor, and its fine-grained noise is minified (×0.38 texel per screen pixel), so it can crawl while moving.
2. **The carpet has no material story:** one mottled olive everywhere. There is no wear where people walk, no damp, no seams, and the stains are random soft blobs unrelated to the room.
3. **Walls are flat colour bands.**
   - The south face's diamond motif is too faint to read.
   - Corners overlap instead of meeting.
   - There is no grime at the base and nothing at the top edge, so walls read as beige slabs, not wallpapered partitions.
4. **Painted light.** A pale ellipse under every lamp brightens the floor albedo where BR-RoLE already adds the lamp's light. This is double lighting.
5. **Painted darkness.** BLACKOUT ZONE is a 48 % black rectangle laid over floor and walls alike. Its darkness should come from the game's lighting, and it has no lamps at all.
6. **Room tints are rectangles over everything,** walls included, rather than material changes.
7. **Props are flat rounded rectangles** with a painted offset shadow (always down-right). The shadow disagrees with BR-RoLE's real per-light prop shadows. There is no wear or top-surface detail.
8. **Fixtures are a grey box with a cream bar,** and every lamp looks the same. The dim 13th lamp is the only failure cue.
9. **The rooms barely differ** except by the tint rectangles. Nothing tells YELLOW HALL from HUMMING ROOMS from BLACKOUT ZONE except the label.

## Consequences for the 3B1 design

- **No change to gameplay or BR-RoLE.** The remaster is a separate presentation module, `assets/l0-remaster.js`. It reads the presentation authority `assets/level0_visuals.js` and gets two guarded hooks in `build()`. `world.js`, `server.js` and every other protected file stay byte-identical.
- **It covers rather than edits.** In the slice rooms, an opaque remaster layer sits above the legacy level art and below every actor. So **remaster off is exactly v23.3.6 / BR-RoLE 1.0**, live, with nothing rebuilt.
- **Fixtures for slice lamps are redirected** into a module-owned legacy Graphics, so the new housings never stack on the old ones. The ceiling parallax and α .84 are kept.
- **Static art is paid once:**
  - generated textures: carpet, wallpaper, cap, decal atlas, props, fixtures;
  - low-resolution macro maps per room for wear and damp;
  - per-room containers, culled by the view;
  - no per-frame drawing.
- **Exact footprints:** walls keep the legacy band widths (S 46 / E·W 27 / N 23), and props keep their `world.js` rects.
