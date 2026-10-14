# Stage 3B Lighting QA Correction — Human QA

**Status: `STAGE 3B LIGHTING QA CORRECTION HUMAN-QA CANDIDATE — WAITING FOR USER`**

| | |
|---|---|
| branch | `stage-3b-l-qa1` (BR-RoLE 1.1-qa1), from the rejected-lighting candidate `stage-3b-l` `b9f3a9b`. The final commit and tree are in `STAGE_3B_LIGHTING_QA_CORRECTION_PACKAGE_RECEIPT.txt`. |
| camera | 1.25 as you accepted it (1920×1080 → 1536×864 world). Not touched. |
| untouched | `main`, `stage-3b-l`, `stage-3b-n-camera`, `stage-3b-remaster`, the superseded `stage-3b-n`. Stage 3C not begun. |
| start | `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000/> |
| lighting | MEDIUM unless a step says otherwise (SETTINGS ▸ CUSTOMIZE ▸ LIGHTING) |

**THE PLAYER IS NOT A LIGHT SOURCE. THEIR EQUIPMENT IS.** The glow that followed you is still gone, and there is still no ambient floor. What changed is the light that really exists:

1. **Brighter, broader working fixtures.** A working fixture is now a real light. Its direct light is at the full legitimate level, no longer scaled down to make room for bounce. Its pool is wider, and it fades smoothly to an exact zero 720 px out.
2. **Walls and pillars receive light.** A wall face or pillar face turned toward a light now shows that light. Faces turned away do not, and nothing shows through a wall.
3. **About twice as many fixtures.** Level 0 now has 170 instead of 90, including fixtures down the corridors. They are real fixtures: the server AI, the game's light truth, the housings and BR-RoLE all use the same list.
4. **Your flashlight, headlamp and lantern light the walls they hit.**

About 15 minutes. For questions 1–4 and 8, switch your own light **off** (F).

## 1. A — Does a normal room read as fluorescently lit? (YELLOW HALL)

Stand in the middle of YELLOW HALL with your light off.
- The room should read as lit by its fixtures: brighter under each one, a little dimmer between them.
- It should not look like small spotlights, murky grey, then black.
- Things still go black past your line of sight, as always.

## 2. B — Between fixtures (REPEATING ROOMS)

Walk from one fixture to the next. The floor between them should stay usefully lit. It should never drop to black between neighbouring working fixtures.

## 3. C — Do walls light up? (the partitions in YELLOW HALL)

Look at the visible top/face strip of the partition walls next to a fixture.
- Faces turned toward a fixture should be clearly lit.
- The other side of the same partition (turned away) should be darker.
- To compare with the old look: `__brRole.dev.faces(false)`, then `__brRole.dev.faces(true)`. The caches rebuild in about a second.

## 4. D — Pillars (PILLAR HALL)

PILLAR HALL's nine fixtures used to sit inside the pillars, lighting them from within. They now hang one cell north of each pillar.
- A pillar's face toward a fixture should be brighter than its far side.
- No light should come through a pillar. Look at the floor behind one: it should be shadowed apart from other fixtures' light.

## 5. E — Flashlight wall sweep (the BLACKOUT ZONE)

Go into the BLACKOUT ZONE and switch your flashlight on.
- Point it at a wall: the wall's face should light up where the beam hits.
- Sweep the beam away: the wall should go dark again.
- Point it past a pillar or a wall end: the blocker should cut the beam.

## 6. F — Lantern (broad carried light)

Equip the lantern in the BLACKOUT ZONE.
- The walls around you should be lit broadly, the near ones most.
- The headlamp should still throw a directional beam that helps you see where you are walking.
- There should be no glow around your body, and no halo through walls.

## 7. G — True black (BLACKOUT ZONE, light off)

With your light off in the BLACKOUT ZONE, you should see **black**. Its two approach corridors deliberately have no fixtures, so the dark starts before you reach it.

## 8. H — Long corridors (YELLOW HALL → NORTH ROOMS, and others)

Corridors now have their own fixtures, about every 4 cells.
- Light should overlap along the corridor and dim gradually between fixtures and toward its ends.
- Some fixtures are missing and some are old dim tubes, on purpose, so not every corridor is evenly lit.
- Genuinely unlit space can still go black.

## 9. I — The dense-fixture room (REPEATING ROOMS centre, ARCH GALLERY)

There are many more fixtures overhead, and the light should still have shape: brighter pools, softer areas between them, shadowed corners behind partitions. It should not be one flat yellow wash.
- Some fixtures are old, dim tubes (darker housings), as before.
- **If rooms feel too bright or too dim,** try `__brRole.dev.vis(1.2)` (dimmer) or `__brRole.dev.vis(1.6)` (brighter) in the DevTools console. It applies immediately. The candidate uses `1.4`. Tell me the value you prefer.

## 10. J — Does it still run well after warm-up?

Play for a minute at MEDIUM.
- Arriving in a new area builds its fixtures' light over a few frames, then it should be smooth.
- Optional: try LOW and HIGH. Both should show the same fixtures lighting the same places, at lower or higher detail.

## Gameplay note (expected, not tuned)

The new fixtures are real, so gameplay counts their light. About 88 % of walkable floor is now inside some fixture's reach, up from 69 %. Light-fearing monsters therefore have fewer dark places, and the BLACKOUT ZONE and its approaches matter more. No AI threshold or behaviour was changed.

## Known, unchanged (recorded, not part of this pass)

- With a Hound near you, the screen can flash brighter for a moment (the old dread flicker in `mp.js`).
- The camcorder's infrared is drawn inside the hard 700 px sight clip.
- `light.js` and the server treat the old dim tubes (every 13th fixture) as full-strength lamps, as before. Only BR-RoLE and the housings show them dim.
