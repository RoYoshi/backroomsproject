# THE FAR BACKROOMS — 2D Lighting & Shadows (visual pass only) — report

**Status: `2D LIGHTING & SHADOWS — VISIBILITY CORRECTION ENGINEERING COMPLETE — HUMAN QA PENDING`**

- **Repository:** `RoYoshi/backroomsproject`
- **Branch:** `lighting-shadows-2d`
- **Immutable gameplay parent:** `f2805bb904c158df17c5c75c3d0d4681049bc246` (tree `8cc77595fe6e88c425e2f8abd243f3463af44a18`, v23.3.6), the build you replayed and called *"perfect"*.
- **Checkpoints:** SH0 freeze → SH1 grounding → SH2 cast shadows → SH3 tiers / performance → SH4 regression and
  handoff → **SH5 visibility correction → SH6 final regression and publication** (`2D_SHADOWS_GIT_CHECKPOINTS.md`).

`main` was not touched. Nothing beyond this stage was started: no Stage 3B, no Logical Z, no 2.5D, no floors, roofs,
stairs, elevation or vertical line of sight. The camera is the v23.3.6 top-down camera; nothing isometric or perspective
was added. The inherited `camera_policy.js` / `timing_policy.js` 404s under `node server.js` are left as they are.

## The visibility correction (SH5–SH6)

You played SH4 and said *"It feels like the same game"* (gameplay: PASS) and *"The Shadows are VERY Faint"*, *"The
shadows aren't noticable"* (visibility: FAIL). SH5 corrected only how strongly the shadows are drawn, in
`assets/shadows-2d.js` (now `shadows-2d 1.1`). No other runtime file changed.

**Why SH4 was faint:**
1. **Its strengths were restrained.** In the SH4 captures at MEDIUM, the strongest typical darkening of the visible
   picture (p90) was 0–0.15 in five of eight scenes.
2. **The overlay tints carried lights above the floor.** After cutting a light out of the dark, the overlay paints a
   carried light's colour tint over its beam. Floor shadows sit under it, so only about three quarters of what the
   module draws there reaches the screen (`tint_probe.js`).
3. **The earlier captures understated the flashlight shadows.** Their test clock caught your light's 0.1 s fade-in
   part-way. The capture tool now settles every capture and still shows the identical instant, so before and after are
   compared fairly.

**What changed, by class.** Each class was tuned on its own, with an upper bound so nothing approaches black:

| class | change |
|---|---|
| wall grounding | 30 → 50 px wide, .38 → .56 at the base, a softer falloff: a soft band, not an outline |
| your flashlight | the clearest cue: next to a prop it takes away ~80 % of its own light, ~55 % in the long tail; still zero outside the beam |
| ceiling lamps | next to a prop, its shadow takes away ~75 % of that lamp's light (~50 % further out), and it is ~50 % longer; restrained enough to keep the fluorescent look |
| pillars and corners | the soft side of the hard edge the overlay cuts is stronger and wider |
| hounds and you | stronger (.30 → .42, .26 → .38) and a little longer; still soft; Smilers still get none |
| baked prop shadows | the thinning that stops a dynamic shadow doubling the art's own drop shadow is unchanged and re-tested at the new strength |
| quality tiers | LOW, MEDIUM and HIGH are now equally strong; HIGH is softer-edged and covers more lights, not darker |

**Measured, SH4 → SH5 at MEDIUM** (`dev/shadows/evidence/sh5/visibility/`). These are the same staged scenes at the same
frozen instants, compared pixel by pixel with OFF. Only pixels the player can see count.

| scene | change |
|---|---|
| reception counter in your flashlight | darkening behind it p90 .33 → .55 |
| toppled shelf, lamps and flashlight | p90 .15 → .32; area darkened ≥ 10 % 13.5 → 22.6 % |
| the same shelf, lamps only | p90 .08 → .23 |
| DAMP ROOMS counter under the flickering lamp | p99 .29 → .48 |
| spawn wall grounding | p99 .23 → .43 |

The two Pillar Hall views moved least: there the big pillar shadow is the overlay's own hard cut, as in v23.3.6, and the
module only softens its lit side. The darkness overlay is unchanged across the tiers in every scene. Each scene has
SH4 / OFF / SH5 images.

These are diagnostics. **Whether the shadows are now plainly noticeable is your call** (`2D_SHADOWS_HUMAN_QA.md`).

## What you get

Everything is drawn on the floor, under the level art, the props, every entity and the darkness overlay.

- **Grounding.** A soft band of ambient occlusion runs along every wall base. It is merged along wall runs (no
  per-tile comb) and rounded at outer corners. It is built once and camera-culled.
- **Entity light shadows.** You, other wanderers and the hounds you can actually see cast a soft shadow away from the
  dominant light (`__light.sample`), smoothed so a light change never pops. **Never for a Smiler:** no body is implied.
- **Prop shadows.** Counters, shelves, benches, tables and machines do not stop light in the game, so their shadows are
  new. The ceiling lamps give soft shadows; your flashlight gives longer, darker ones that turn with your aim. Where the
  prop art already has a baked drop shadow, the cast shadow is thinned so the two do not double up.
- **Wall and pillar penumbrae.** The darkness overlay already cuts every light off behind walls and pillars with a hard
  edge. That dark side is never drawn again. Each grazed corner gets a soft penumbra on the **lit** side of the
  existing edge.
- **Light-true strength.** Every cast shadow takes away only its own light, weighted per pixel by that light's strength
  from the overlay's own formula. It fades with the beam's cone and range, and is nothing where that light does not
  reach.
- **Flicker and blackout.** Lamp shadows follow the overlay's own lamp power every frame, including dim fixtures,
  failures and NV gain. They vanish in a blackout and come back with the lamps.
- **Other players' lights.** At MEDIUM and HIGH, the nearest 2 or 4 other wanderers' lights cast shadows too, a little
  lighter than yours. They are bounded and fade at the cap.
- **Quality.** OFF / LOW / MEDIUM / HIGH in SETTINGS ▸ CUSTOMIZE ▸ SHADOWS, or `?shadows=`. The choice is remembered per
  device. The default is MEDIUM on desktop and LOW on touch devices and small screens. OFF draws nothing.
- **Admin debug view.** DEBUG MODE ▸ SHADOW DEBUG. Ordinary players never get it.

## Why gameplay is untouched (and how it is proven)

**Two files reach the browser.**
- `assets/shadows-2d.js` is new. It is client-only and lives in `assets/` because the shipped server already serves
  that folder.
- `index.html` gets one 46-byte `<script>` tag. Removing it gives the parent file byte for byte.

**No game file changed.** That includes the special-protection files `ai.js`, `sim.js`, `move.js`, `server.js`,
`mp.js`, `death_srv.js`, `dphys.js` and `camera_policy.js`, and `world.js`. `dev/shadows/freeze.py verify` against the
SH0 manifest finds 229 of the parent's 230 files byte-identical. The one that differs is `index.html`.

**It only reads.** It never writes game state, never sends anything, and never touches the darkness overlay, an entity's
opacity or position, or the server. Shadows are not a sensor and not concealment: AI, line of sight, collision,
picking and visibility are exactly v23.3.6. Stronger shadows change none of that.

**Evidence on the final tree** (`2D_SHADOWS_TEST_SUMMARY.md`):
- **Unit tests 43/43, browser checks 9/9** (`dev/shadows/evidence/sh5/`), including the new visibility tests V01–V08
  (each class visible, nothing at one spot removing more than 85 % of the light, the tiers within .1 of each other,
  never a Smiler shadow, baked shadows still thinned) and the overlay's pixels byte-identical at every quality (B02). The module and `index.html` did not change after
  SH5, so these were not run again at SH6.
- **Freeze:** verified again on the staged SH6 tree: 229 of 230 parent files byte-identical, the 230th `index.html`
  (`evidence/sh6/freeze_verify.txt`).
- **Retained v23.3.6 suites** on the final tree (`evidence/sh6/retained/`): **19 of 21 reproduce the parent's results
  exactly**, including movement, physics, camera, FPS independence, interpolation, networking and lifecycle; six
  logs are byte-identical. Two differ, as at SH4:
  - **browser-ir** passed for the parent in both of its same-machine runs. For the final tree it printed no verdict in
    the main run, failed R5 + R7 in one rerun and passed in the other. In the suite's own view the module costs ~12 %
    of the frame rate under software rendering (fill, not CPU; SH4 cost the same). **The parent, slowed by a calibrated
    background load by about as much, failed 3 of 3 runs on the same checks** (R7, R7, R5 + R7). R5 reads the
    camcorder overheat lock 0.7 game-seconds after setting the heat; R7 reads a second player's view after fixed
    real-time waits. So this suite is frame-time sensitive on this machine; it is not a gameplay difference, but it is
    recorded as an open item for real hardware.
  - **browser-admin**: its T5 death-preview sequence cascades on this machine. The parent cascaded in one of two runs
    (14 extra failures) and matched the baseline exactly in the other; the final tree cascaded in all three (16, 12,
    11 extra), only in T5 / T6. Not proven to be frame-time only; recorded as a limitation. The previews are admin
    tooling, and their code is unchanged.

  The full reading is in `2D_SHADOWS_TEST_SUMMARY.md` and `evidence/sh6/SH6_FINAL.md`.

## Performance

See `2D_SHADOWS_PERFORMANCE.md`. Software rendering (SwiftShader, 2 vCPU) is evidence, not hardware certification.

Final module against the v23.3.6 parent, one round each (`evidence/sh6/`):

| | parent | OFF | LOW | MEDIUM | HIGH |
|---|---|---|---|---|---|
| 1280×720 YELLOW HALL spawn, fps | 2.26 | 2.27 | 2.15 | 2.33 | 2.25 |
| 1280×720 reception counter in your flashlight, fps | 2.06 | 2.15 | 1.85 | 1.94 | 1.83 |
| 4K PILLAR HALL, fps | 0.39 | 0.42 | 0.43 | 0.42 | 0.39 |
| mobile-like PILLAR HALL, fps | 0.84 | 0.90 | 0.86 | 0.85 | 0.87 |

- **The module's own time:** 0.08–0.40 ms a frame on the desktop-like profiles (p95 ≤ 1.3 ms); 0.22–1.04 ms on the
  mobile-like profile with the main thread slowed 4× (p95 ≤ 4.7 ms), where the game's own per-frame JavaScript takes
  9–26 ms. The SH3 optimizations and every cap and budget are unchanged.
- **The phone-sized LOW case, re-measured** (three alternating rounds per tree and tier, `evidence/sh5/perf/`): the
  SH4 report's one-off −14 % did not reproduce. LOW against OFF is −3.5 % for SH4 and **−5.4 % for the final module**;
  MEDIUM −7.3 %, HIGH −7.7 %. The extra cost is fill (the same polygons covering more pixels), which software rendering
  pays on the CPU and a GPU makes nearly free.
- **Draw calls:** within each scene, WebGL draws do not change from OFF to HIGH. In four 4K scenes the parent run drew
  two more than every tier of the final module, OFF included, so that difference is not the module's; at SH3 those
  scenes matched. 2D-canvas calls match in 11 of 16 scenes; the other five differ at OFF too.
- **Noise:** OFF ran 0–14 % faster than the parent across scenes, so single-round cells are indicative only.

**Not completed (stopped by instruction; recorded as limitations, nothing restarted):**
- the mobile-like `peers` scene at MEDIUM and HIGH (the candidate matrix ended at 61 of 64 cells, without an error);
- the repeated A/B at the reception counter in your flashlight, whose single round is the largest drop (−10 % to
  −15 % against OFF);
- the lamp-build tour on the 1.1 module (the report uses SH4's, for 1.0, and says so);
- re-running the unit tests and browser checks on the unchanged SH6 tree.

## Human QA

`2D_SHADOWS_HUMAN_QA.md`: the main test is to play at MEDIUM without toggling; then a 10-minute tour and the ten
questions. Visual QA is **not** marked PASS by the engineer.

## Known limits and notes for the tester

- **Pillar Hall.** The big shadow behind a pillar is the darkness overlay's own, as in v23.3.6. The module adds only
  its soft lit-side edge, so this is where the change is smallest. Pillars keep the level art's own contact halo; no
  grounding was added under them, so nothing doubles.
- **Carried-light shadows stop short of black on screen.** The overlay paints the beam's colour tint above the floor,
  so of the ~80 % the module takes away next to a prop, roughly 60 % of the beam's brightness shows as taken away on
  screen. That is the overlay's design; the overlay was not changed.
- **Lamp shadows of low props stay fairly short.** Lamps hang at ceiling height. They are now visibly darker and
  ~50 % longer than at SH4.
- **First sight of a lamp builds its shadow** (once per lamp, then cached). That costs a fraction of a millisecond on
  average, with occasional single-frame spikes of a few milliseconds. A slow phone is the place to watch for a hitch
  when entering a new room.
- **Every class is tunable on its own.** Each has its own constants in `assets/shadows-2d.js`, so notes like "walls
  too strong, lamps too weak" can be answered without touching the rest.
- **Inherited parent behaviour is unchanged.** For example, the `camera_policy.js` / `timing_policy.js` 404s, and the
  parent's known retained-suite failures.
