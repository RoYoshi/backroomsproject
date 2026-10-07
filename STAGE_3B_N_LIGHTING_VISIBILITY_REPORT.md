# Stage 3B-N — Lighting / Visibility Report

Checkpoints: N2 `21ec7b6` (true darkness + danger flicker), N3 `7ee5b96` (fixture / pillar separation + line-of-sight stability)

## 1. True darkness — NO SURVIVING LIGHT = NO VISIBILITY

**Found.** BR-RoLE drew v23.3.6's ambient glow around the viewer on every frame: alpha 0.14 at the player, 0.045 at
335 px, 0 at 670 px. It had no source, and walls did not block it. During a blackout with no carried light, the
darkness overlay never got darker than alpha 219/255. Geometry around the player stayed faintly visible through walls.

**Fixed.** The gradient is removed from `assets/br-role.js`. Nothing replaces it: where no light reaches, the overlay
is opaque. These lights still work as before: lamps, flashlight, headlamp, lantern, other players' lights, the death
torch, and the hand aura of a lit light (retained HQA QOL). The HUD is DOM, outside the overlay, so it stays readable.

**Evidence** (`dev/stage-3b-n/visibility_3bn.js`):
- D1: blackout, no light, BLACKOUT ZONE. Overlay minimum alpha is 255/255 everywhere, and the screenshot near the
  player is 0. The parent gave 219, with 550 049 pixels not fully dark.
- D2: light still works. In the beam the overlay is 140/255, and under a lamp 165/255.

**Known limits, left as they are.** These are outside the N2 seam:
- the bundle's legacy lighting fallback (BR-RoLE off or failed, `?lighting=legacy`) still draws the old glow; it is not
  the shipped path;
- `light.js` keeps an `AMBIENT = .05` data floor, used for body shading and the Smiler's readability values; it never
  produces pixels, because the overlay above it is opaque.

## 2. Danger flicker — a flicker may change illumination, not what you may see

**Found.** Two separate leaks:
- the dread flicker in `mp.js` set the whole darkness overlay's CSS opacity to 0.35–0.75 on flicker frames, so
  everything behind walls and pillars showed through. A bright test object behind a wall read 163/255 in screenshots;
- the dread shake moved only `#game`. The world slid a few pixels under the line-of-sight mask, and slivers of hidden
  world appeared at every edge on every shaken frame.

**Fixed.**
- The flicker is now a surge of the ceiling lamps. `mp.js` sets `window.__dangerFlicker` (×1.55–2.2 on a flicker frame,
  1 when calm), and `__ents.lamp` multiplies it in. BR-RoLE's lamp strength and `light.js` therefore follow it. Lamps
  stay shadowed by walls and pillars, stay clipped to the line of sight, and stay capped at 0.9. A dark corridor you can
  see may light up for a moment if a lamp physically reaches it; nothing behind a wall can.
- The shake moves `#game` and `#light` together.

**Evidence.** Each of F1 and F2 ran 135 frames: 45 with the flicker forced on every frame, the rest natural, with a
Hound within dread range. Hidden test points and screenshots were checked on every frame.

| check | parent | Stage 3B-N |
|---|---|---|
| F1 behind a wall: frames showing the hidden object | 135 / 135 (visibility up to 0.64; screenshot 163) | **0 / 135** (overlay 255, screenshot 0) |
| F2 behind a pillar | 135 / 135 | **0 / 135** |
| F3 an in-sight dim point 230 px from a lamp brightens during the surge | n/a (no lamp surge) | **yes** (overlay 233.5 → 221.7) |
| F4 overlay opacity never lowered; world never shaken under the overlay | opacity down to 0.358; 135 mismatched frames | **opacity 1; 0 mismatches** |

**Cost.** In `dev/br-role/perf_br.js` (desktop profile, SwiftShader, relative only), BR-RoLE's own time per frame is
**lower in every scene**: −1.3 to −8.3 ms. The 1340×1340 gradient fill per frame is gone, and the surge adds one
multiply per lamp.

## 3. Fixtures on pillars — light source / occluder separation

**Found.** The fixtures are laid on a 5-cell grid per room and kept wherever their *cell* is floor. The PILLAR HALL's
nine pillars are separate 56×56 blockers, not cells. As a result, **all nine of that hall's fixtures sat exactly on
the nine pillars**: each housing was drawn over its pillar, and each light origin was inside it. The game's ray only
counts a box it *enters*. A lamp inside a pillar therefore lit *through* its own pillar in four places: the legacy light
shapes, `light.js`, the server AI's lamp field, and BR-RoLE, half of whose tube points were inside the blocker.

**Fixed.** `WORLD.fixLamps` in `world.js` runs where the list is made, both in the bundle and in `sim.js`. A fixture
whose 90×28 housing is not wholly on floor, or touches a pillar or another housing, moves to the nearest grid cell
centre where it fits. The search goes in rings of 1, then 2 cells, in a fixed order. A fixture with no valid cell is
removed. It is one pure function of the static map, so every machine gets the same list, as `pillar_3bn` P1 and
`test_3bn` N3-4/5 confirm. On the real map the nine PILLAR HALL fixtures move one cell east (+96 px, 23 px clear of
the pillar face). None is removed, and the other 81 are untouched. No pillar is moved or shrunk.

## 4. Line-of-sight stability around a pillar

**Found.** The line-of-sight polygon casts its critical rays at the corners of the wall grid, plus 96 evenly spaced
rays. Pillar corners were not among those critical points. A pillar's silhouette was therefore a chord between two rays
3.75° apart. It sat up to ~28 px off the true edge (mean ~15 px), and the error changed by up to ~25 px from one step
to the next. That produced a false wedge of shadow that swept as you walked round a pillar. The same polygon clips
the darkness overlay and masks creatures.

**Fixed.** One bundle line adds the pillars' corners to those critical points, so the edges are exact. LOS is made
exact, not weaker.

**Evidence** (`dev/stage-3b-n/pillar_3bn.js`). The test walks a full loop round the hall's centre pillar at radius
160, in 1.5° steps, with lamps on and the flashlight on.

| check | parent | Stage 3B-N |
|---|---|---|
| P1 housings on a blocker (client = server list) | 9 | **0** |
| P2 sight polygon vs exact geometry: reveals / false hides / silhouette error | 0 / 0 / **28.5 px max, 14.9 mean** | **0 / 0 / 0.5 px max, 0.02 mean** |
| P3 hidden samples showing through the overlay | 0 | **0** (39 698 samples) |
| P4 held poses, clock frozen: overlay / polygon change frame to frame | none | **none** |
| P5 fixture inside a pillar during the loop | 194 steps | **0** |

Also passing: Stage 3B unit tests 26/26, BR-RoLE unit tests 32/32, and the legacy shadow unit test C15 ("no popping
along a pillar orbit and through the pillar hall"). The shadow unit suite is 47/48, the same count as the parent: S16, a
stale whitelist string.
