# BR-RoLE BR1 — human QA

> **Superseded by BR1.1** (`BR_ROLE_BR1_1_HUMAN_QA.md`): your BR-QA correction replaced BR1's visibility-polygon occlusion
> with light field → blocker → cast shadow.  This page is kept as the BR1 record.

**Status (BR1): superseded by the BR1.1 candidate**

Nothing here is marked PASS by the engineer, and BR2 does not start until you approve BR1 visually.

- **Branch:** `br-role`, created from SH7 `f24a2c43`. Gameplay lineage v23.3.6 `f2805bb`.
- **Start it as usual:** `node server.js`, or `run_linux.sh` / `run_windows.bat`.
- The lighting module reports `br-role BR1` (admin DEBUG MODE shows its counters).

## What BR1 is

**BR-RoLE now owns the light in the world.** The old renderer used to cut each light out of a black overlay, and
SH2–SH7 then painted shadows underneath and compensated for it. In BR1 every light is drawn on its own, clipped to
where it actually reaches, and the lights are **added**:

> visible light = ambient + every lamp + your light + other players' lights, each only where it reaches.

So a spot that a wall hides from a fluorescent lamp but your flashlight reaches is lit by your flashlight, normally.
That falls out of the composition itself; there is no special case for it.

| | BR1 |
|---|---|
| ambient darkness | the same faint glow around you as before; black beyond your line of sight, as before |
| ceiling lamps | the same strength, flicker, dim fixtures, failures, blackout and NV gain as before; **occlusion is now traced to every wall and pillar corner** (crisp, correct edges; the old shapes were 96 rays per lamp and ragged at corners) |
| your flashlight / headlamp | **one smooth beam**: near glow, smooth sideways falloff, radial falloff, walls and pillars blocking it. No more 12 stacked arcs (the old striations) |
| lantern | a round light with its flame flicker, blocked by walls |
| other players' lights | the same model, the nearest 1 / 3 / 6 (LOW / MEDIUM / HIGH) |
| beam colour | your light's colour tints what it lights, as before |
| camcorder night vision, line of sight, vignette, death effects, Smiler faces | **unchanged**: still drawn by the game |
| grounding along walls, one soft shadow per creature | kept from SH7 (never for a Smiler) |
| SH7's lamp / flashlight / prop shadow layers | **gone** (the SH7 module is no longer loaded) |

**Not in BR1 (that is BR2, after your approval):**
- props (counters, shelves…) casting shadows from each light;
- the fluorescent tubes' soft area edges and bounded penumbrae;
- proper player / Hound shadows from the lights;
- same-prop blocking of several lights.

Until then **props cast no light shadows**: expect that.

## Quality (SETTINGS ▸ CUSTOMIZE ▸ LIGHTING, or `?lighting=low|medium|high`)

| tier | light buffer | lamps | other players' lights | beam / occlusion rays |
|---|---|---|---|---|
| LOW (touch devices and small screens by default) | half the screen size | 8 | 1 | fewest |
| MEDIUM (desktop default) | ¾ | 10 | 3 | more |
| HIGH | full | 14 | 6 | most |

- **Same model at every tier.** The light buffer follows the screen's CSS size, never the device-pixel ratio, so a
  high-DPI phone doesn't pay 9×.
- **The lamp caps sit above the pack's starting targets** (4 / 8 / 12). At LOW, 4 left a lamp that lights the screen
  undrawn, which you would see as a dark fixture. LOW stays cheapest through its buffer size and ray counts.

**Comparison (developers only):** `?lighting=legacy` draws the old v23.3.6 lighting. It is not in the settings.

## What was checked before this handoff (quick checks only, by policy)

- **Module load and syntax:** `assets/br-role.js` and the edited bundle (as an ES module).
- **11 / 11 focused unit checks** (`dev/br-role/test_br_role.js`, the real map and ray query from the bundle). They
  cover one compositor with every light added under its own clip; lamp occlusion polygons traced to corners; blackout;
  the game's own lamp formula; tier buffers independent of DPR; the camcorder; read-only, no network; the fail-safe and
  the DEV switch; the seam; no NaN.
- **6 / 6 browser smoke checks** (`dev/br-role/smoke.js`), including mixed light read from the screen's own pixels at
  the QA01 spot:
  - **where the lamp is blocked, lamp + beam = beam alone (0.467 = 0.467)**, and lamp alone = ambient (0.098);
  - **where both reach, they add**: 0.618 measured against 0.624 predicted;
  - the client sends the same messages with BR-RoLE and with the old lighting;
  - a Smiler in view gets no shadow.
- **Gameplay freeze** (`dev/br-role/freeze_br.py`): 228 / 230 parent files byte-identical. Every protected file is
  identical: `ai.js`, `sim.js`, `move.js`, `server.js`, `mp.js`, `death_srv.js`, `dphys.js`, `camera_policy.js`,
  `world.js`, `light.js`, `ents.js`, `camcorder.js`, `timing_policy.js`. The two presentation edits each undo to the
  v23.3.6 bytes exactly.
- **One launch check.**
- **Not run, by policy:** the retained suites, screenshot matrices, benchmarks. They come at BR3, after your approvals.

The evidence is in `dev/br-role/evidence/br1/`:
- the unit and browser logs;
- the freeze output;
- three side-by-side captures (QA01 spot, QA02 corridor corners, Pillar Hall: legacy | LOW | MEDIUM | HIGH). They are
  multiplied ×3 for the eye only, because software rendering is very dark.

## Tour (about 10 minutes, at MEDIUM)

| # | where | what to do | what to look at |
|---|---|---|---|
| 1 | **YELLOW HALL** spawn | look around with the flashlight off | the fluorescent look; lamp light stopping cleanly at walls and partition corners |
| 2 | south-east of the spawn lamp, by the partition corner | flashlight on, sweep across the lamp's shadow edge | **the beam lights the lamp-shadowed floor naturally**: no dark triangle, no painted edge |
| 3 | anywhere | sweep the beam slowly; walk along walls | a smooth beam (no striations, no flat cone); walls and pillars block it cleanly |
| 4 | **PILLAR HALL** | sweep and walk among the pillars | hard pillar shadows from your beam and the lamps, each light on its own |
| 5 | **DAMP ROOMS**, the flickering light | flashlight off, then on | the flicker; your beam on top of it |
| 6 | any lit room | admin WORLD ▸ LIGHTS ▸ BLACKOUT ON, then AUTO | lamps go and come back; your light stays |
| 7 | CUSTOMIZE ▸ light source | try the headlamp and the lantern | their shapes, colour, flame flicker |
| 8 | CUSTOMIZE ▸ Night Vision Camcorder | N for night vision | the camcorder still works as before |
| 9 | with a second player | both lights on, cross beams | one light system, no dark seams where beams overlap |
| 10 | anywhere | SETTINGS ▸ LIGHTING: LOW, then HIGH | LOW coherent (softer), HIGH crisper; same look |

## Questions

Please answer each with yes / no / notes, and the tier you were on.

1. Does the level still feel like the Backrooms: oppressive and fluorescent?
2. Does your flashlight now light floor that a lamp's shadow covers, naturally, with no triangle or painted edge?
3. Do lamps, your light and other players' lights read as one lighting system?
4. Do walls and pillars block light cleanly (no ragged corners, no leaks)?
5. Is the beam coherent (smooth falloff, no striations, no flat cone)?
6. Are flicker, failing lights and blackout right?
7. Are LOW / MEDIUM / HIGH all coherent?
8. What do you miss from SH7 that BR2 must bring back (prop shadows, softer lamp edges…)?
9. Does the game still feel like the accepted v23.3.6 gameplay?
10. Any frame-rate trouble on your PC or phone?
