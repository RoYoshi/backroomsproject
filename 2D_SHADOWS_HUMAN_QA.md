# THE FAR BACKROOMS — 2D Lighting & Shadows: human QA (visibility correction)

**Status: `2D LIGHTING & SHADOWS — VISIBILITY CORRECTION ENGINEERING COMPLETE — HUMAN QA PENDING`.** Nothing here is
marked PASS by the engineer: these are your calls.

Branch `lighting-shadows-2d` (gameplay parent v23.3.6 `f2805bb`). Start it as usual: `node server.js`, or
`run_linux.sh` / `run_windows.bat`, then open the game. The shadow module now reports `shadows-2d 1.1`.

## Your last verdict, and what changed

You played SH4 and said:
- *"It feels like the same game"*: kept. Nothing about movement, collision, controls, camera, hounds, smilers,
  darkness, networking or the map changed. Only the shadow drawing changed.
- *"The Shadows are VERY Faint"* and *"The shadows aren't noticable"*: this pass answers that.

At the default MEDIUM:
- **Walls** now have a broader, darker grounding band along their base (soft, not an outline).
- **Your flashlight** now casts the strongest shadows. Behind a counter or shelf, most of the beam is taken away.
  The shadow turns with your aim and stays inside the beam.
- **Ceiling lamps** now give props clearly visible, longer soft shadows while you stand still.
- **Pillars and corners** in your beam have a wider soft edge beside the hard shadow the darkness already draws.
- **Hounds and you** cast a stronger soft shadow away from the light. Smilers still cast none.

LOW, MEDIUM and HIGH are now equally strong. HIGH is smoother and draws more lights; it is not darker.

## The main test: play at MEDIUM without toggling

Before anything else, play normally for a few minutes at MEDIUM (the desktop default) **without** switching shadows
OFF and ON. The question is whether you notice the shadows on your own.

## How to compare afterwards

- **Switch quality.** Open SETTINGS ▸ CUSTOMIZE ▸ SHADOWS and pick OFF / LOW / MEDIUM / HIGH. It switches at once and is
  remembered per device. You can also add `?shadows=off|low|medium|high` to the URL.
- **OFF is v23.3.6.** It draws nothing.
- **Defaults.** Desktops start on MEDIUM; touch devices and small screens start on LOW.
- **Debug view (optional, admin only).** Press `` ` ``, enter `smoor`, open the DEBUG tab, switch DEBUG MODE on, then press
  SHADOW DEBUG (left edge).

## Tour (about 10 minutes)

| # | where | what to do | what to look at |
|---|---|---|---|
| 1 | **YELLOW HALL**, at spawn | walk along the partition walls | a soft dark band along every wall base, rounded at outer corners, no hard outline |
| 2 | **YELLOW HALL**, the reception counter just east of spawn | shine the flashlight across the counter, then swing the beam slowly from one end to the other | the beam beyond the counter is clearly in the counter's shadow; the shadow follows the beam smoothly, with no flicker or jumps, and never appears outside the beam; the game stays as smooth as at OFF |
| 3 | **REPEATING ROOMS**, the toppled shelf between two ceiling lamps | first with the flashlight OFF (lamps only), then ON | lamps only: a visible soft shadow band beside the shelf; flashlight: a longer, darker shadow inside the beam; no doubled drop shadow along the shelf's own edge |
| 4 | **PILLAR HALL** (north-east) | sweep the flashlight across the pillars; circle one | the hard shadow behind each pillar is as before; its edges on the lit side are now soft and visible |
| 5 | **DAMP ROOMS**, the counter under the dim, flickering ceiling light | flashlight OFF, stand a little south of the counter | the counter's lamp shadow is visible and pulses with that light |
| 6 | any lit room | admin WORLD ▸ LIGHTS ▸ BLACKOUT ON, then AUTO | every lamp shadow disappears with the lamps and comes back with them; your flashlight's shadows stay |
| 7 | anywhere | admin MONSTERS ▸ + HOUND NEAR; light it, then let it come close | a soft shadow away from the light that lights it; the hound is as readable as before |
| 8 | anywhere | admin MONSTERS ▸ + SMILER NEAR, in the light and in the dark | the Smiler looks exactly as before: no shadow, no implied body, face and glow untouched |
| 9 | with a second player (another browser) | both turn lights on and walk around each other | their light also casts prop and pillar shadows (MEDIUM and HIGH only), a little lighter than yours |
| 10 | anywhere | play a few minutes at LOW, then at HIGH | LOW still clearly shadowed; HIGH smoother, not darker; everything else exactly as before |

## Left for you to watch (not settled by engineering)

The final measurements were cut short by instruction, so these were not confirmed on this build:
- **Smoothness at the reception counter in your flashlight** (tour step 2). In one software-rendered run that view was
  10–15 % slower at LOW, MEDIUM and HIGH than at OFF; the repeated rounds that would confirm or dismiss this were not run.
- **A phone with another player nearby, at MEDIUM or HIGH.** Not measured at all. Phones start on LOW.
- **A slow phone entering a new room.** Each lamp's shadow is built on first sight, which can cost a single frame of a
  few milliseconds.
- **The retained IR browser suite** is sensitive to frame time on the test machine; it failed there for the shadow
  build in some runs, and for v23.3.6 too when that was slowed by as much (`2D_SHADOWS_TEST_SUMMARY.md`). If you run the
  retained suites on real hardware, that result is worth a look, and so is the admin suite's death-preview sequence
  (T5 / T6), which cascaded on the test machine in every run of the shadow build and in one of two runs of v23.3.6.

## Questions

Please answer each with yes / no / notes, and the quality you were on.

1. Can you notice the shadows during ordinary play without toggling them?
2. Are flashlight shadows now obvious enough?
3. Do lamp shadows give rooms visible depth?
4. Are walls grounded without looking outlined?
5. Are shadows too dark anywhere?
6. Do props have doubled shadows?
7. Are Hounds still readable?
8. Are Smilers unchanged?
9. Does LOW still look worthwhile?
10. Does the game still feel like the same v23.3.6-based game?

If anything looks wrong, the most useful report is a screenshot with the quality setting and the room name (top-left
HUD). Each shadow class has its own constants in `assets/shadows-2d.js`, so any one of them can be tuned after your
notes without touching the others.
