# THE FAR BACKROOMS — 2D Lighting & Shadows: human QA

**Status: ENGINEERING COMPLETE — HUMAN QA PENDING.** Nothing here is marked PASS by the engineer: these are your calls.

Branch `lighting-shadows-2d` (gameplay parent v23.3.6 `f2805bb`). Start it as usual: `node server.js`, or
`run_linux.sh` / `run_windows.bat`, then open the game.

## How to compare

- **Switch quality.** Open SETTINGS ▸ CUSTOMIZE ▸ SHADOWS and pick OFF / LOW / MEDIUM / HIGH. It switches at once and is
  remembered per device. You can also add `?shadows=off|low|medium|high` to the URL.
- **OFF is v23.3.6 exactly.** It draws nothing, so the quickest test is to stand still and toggle OFF ↔ HIGH.
- **Defaults.** Desktops start on MEDIUM; touch devices and small screens start on LOW.
- **Debug view (optional, admin only).** Press `` ` ``, enter `smoor`, open the DEBUG tab, switch DEBUG MODE on, then press
  SHADOW DEBUG (left edge). It shows:
  - every light's range (yellow lamps, green your light, blue other players);
  - which corners and props cast, and the polygons;
  - the per-frame counts.

## Tour (about 10 minutes)

| # | where | what to do | what to look at |
|---|---|---|---|
| 1 | **YELLOW HALL**, at spawn | stand next to the partition walls and toggle OFF ↔ MEDIUM | a soft darkening along every wall base (grounding), rounded at outer corners; a soft edge where a lamp's light is cut by a wall stub |
| 2 | **YELLOW HALL**, the reception counter just east of spawn | shine the flashlight across the counter, then swing the beam slowly from one end to the other | the beam beyond the counter is in its shadow; the shadow follows the beam and fades with it, no flicker or jumps |
| 3 | **REPEATING ROOMS**, the toppled shelf between two ceiling lamps | first with the flashlight OFF (lamps only), then ON | lamp light: short, soft shadows on both sides of the shelf; flashlight: a longer shadow inside the beam |
| 4 | **PILLAR HALL** (north-east) | walk between the pillars with the flashlight on them; circle one pillar | the hard black shadow behind each pillar is unchanged; along its two edges, on the lit side, a thin soft penumbra |
| 5 | **DAMP ROOMS**, the counter under the dim, flickering ceiling light | flashlight OFF, stand a little south of the counter | the counter's lamp shadow pulses with that light; lamp shadows everywhere also follow lamp failures (e.g. near a hound) |
| 6 | any lit room | admin WORLD ▸ LIGHTS ▸ BLACKOUT ON, then AUTO | every lamp shadow disappears with the lamps and comes back with them; your flashlight's shadows stay |
| 7 | anywhere | admin MONSTERS ▸ + HOUND NEAR; light it, then let it come close | it casts a soft shadow away from the light that lights it; it reads exactly as before |
| 8 | anywhere | admin MONSTERS ▸ + SMILER NEAR, in the light and in the dark | the Smiler looks exactly as before: no shadow, no implied body, its face/glow untouched |
| 9 | with a second player (another browser) | both turn lights on and walk around each other | their light also makes prop and pillar shadows (MEDIUM and HIGH only), never more than a few lights |
| 10 | anywhere | play normally for a few minutes at LOW, then at HIGH | movement, collision, controls, camera, hounds, smilers and the darkness feel exactly as before |

## Questions

Please answer each with yes / no / notes (and the quality you were on).

1. Do walls feel grounded?
2. Do flashlight shadows improve corners/pillars?
3. Does it remain pure top-down 2D?
4. Are shadows too dark/strong?
5. Do prop shadows double up?
6. Are Hounds still readable?
7. Are Smilers still visually correct?
8. Does flicker feel better?
9. Does Low quality still look good enough?
10. Does the game still feel EXACTLY like v23.3.6?

If anything looks wrong, the most useful report is a screenshot with the quality setting and the room name (top-left HUD).
Strengths are single constants in `assets/shadows-2d.js`, so they are easy to tune after your notes.
