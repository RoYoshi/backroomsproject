# THE FAR BACKROOMS — 2D Lighting & Shadows (visual pass only) — report

**Status: `2D LIGHTING & SHADOWS — ENGINEERING COMPLETE — HUMAN QA PENDING`**

- **Repository:** `RoYoshi/backroomsproject`
- **Branch:** `lighting-shadows-2d`
- **Immutable gameplay parent:** `f2805bb904c158df17c5c75c3d0d4681049bc246` (tree `8cc77595fe6e88c425e2f8abd243f3463af44a18`, v23.3.6), the build you replayed and called *"perfect"*.

`main` was not touched. Nothing beyond this stage was started: no Logical Z, no 2.5D, no floors, roofs, stairs,
elevation or vertical line of sight. The camera is the v23.3.6 top-down camera; nothing isometric or perspective was
added.

## What you get

All of it is drawn on the floor, under the level art, the props, every entity and the darkness overlay.

- **Grounding.** A soft ambient-occlusion strip runs along every wall base. It is merged along wall runs (no per-tile
  comb) and rounded at outer corners. It is built once and camera-culled.
- **Entity light shadows.** You, other wanderers and the hounds you can actually see cast a soft shadow away from the
  dominant light (`__light.sample`). It is smoothed so a light change never pops. The art already has a centred contact
  shadow under them, so only the directional part is added. **Never for a Smiler:** no body is implied.
- **Prop shadows.** Counters, shelves, benches, tables and machines do not stop light in the game, so their shadows are
  new: short soft ones from the ceiling lamps, and longer ones in your flashlight beam that turn with your aim. Where the
  prop art already has a baked drop shadow, the cast shadow is thinned so the two do not double up.
- **Wall and pillar penumbrae.** The darkness overlay already cuts every light off behind walls and pillars with a hard
  edge. That dark side is never drawn again. Each grazed corner gets only a soft penumbra on the **lit** side of the
  existing edge, from lamps (a 74 px tube) and carried lights.
- **Light-true strength.** Every cast shadow takes away only its own light. It is filled with that light's strength over
  the floor, taken from the overlay's own formula. It fades with the beam's cone and range, and is nothing where that
  light does not reach.
- **Flicker and blackout.** Lamp shadows follow the overlay's own lamp power every frame, including dim fixtures,
  failures and NV gain. They vanish in a blackout and come back with the lamps.
- **Other players' lights.** At MEDIUM and HIGH, the nearest 2 or 4 other wanderers' lights cast shadows too. They are
  bounded and fade at the cap.
- **Quality.** OFF / LOW / MEDIUM / HIGH in SETTINGS ▸ CUSTOMIZE ▸ SHADOWS, or `?shadows=`. The choice is remembered per
  device. The default is MEDIUM on desktop and LOW on touch devices and small screens. LOW is a complete tier with fewer
  samples and smaller caps. OFF draws nothing.
- **Admin debug view.** DEBUG MODE ▸ SHADOW DEBUG shows lights, candidate and chosen casters, polygons, bounds, counts,
  the tier and cache stats. Ordinary players never get it.

## Why gameplay is untouched (and how it is proven)

**Two files reach the browser.**
- `assets/shadows-2d.js` is new. It is client-only and was placed in `assets/` because the shipped server already
  serves that folder.
- `index.html` gets one 46-byte `<script>` tag. Removing it gives the parent file byte for byte.

**No game file changed.** That includes the special-protection files `ai.js`, `sim.js`, `move.js`, `server.js`,
`mp.js`, `death_srv.js`, `dphys.js` and `camera_policy.js`, and `world.js`. The SH0 freeze manifest verifies them
byte-identical (`FREEZE OK`).

**No bundle edit.** The module attaches through the renderer's own containers (`__api.floor().parent`) and runs right
after the game's per-frame hook (`window.__mp`, which keeps its arguments and return value).

**It only reads.** It never writes game state and never sends anything. It never touches the darkness overlay, an
entity's opacity or position, or the server. The server never loads it. Shadows are not a sensor and not concealment:
AI, line of sight, collision, picking and visibility are exactly v23.3.6. If it fails internally, it switches itself off
and the game renders as v23.3.6.

**Evidence** (all in `2D_SHADOWS_TEST_SUMMARY.md`):
- **Unit tests 35/35 and browser checks 9/9** on the final tree. Among them:
  - B02: the darkness overlay is byte-identical at every quality, lamps on and in a blackout.
  - B03: entity views are untouched.
  - B04: the client sends the same network messages at OFF and HIGH.
  - B07 and S07: no Smiler shadow.
  - S08: a hound you cannot see gets no shadow, so nothing is revealed.
  - S15: there is no presentation-to-AI path.
- **The retained v23.3.6 gameplay suites.**
  - At SH1 and SH2, all 21 suites reproduced the parent exactly: same verdicts, counts, failing assertions and error
    messages.
  - On the final tree, 19 of 21 reproduce it exactly in the main run. Among them are byte-identical logs for movement
    measured through the real page, physics, camera fairness, FPS independence, network interpolation and IR
    networking.
  - The other two were diagnosed on the same machine against the parent:
    - **browser-ir** passes on both trees. The main run was stopped by the test runner's own 400 s safety deadline,
      which is not part of the suite: on this machine the suite takes about 6 minutes for the parent too.
    - **browser-admin**'s death-preview sequence (T5) is timing-sensitive on this machine. The parent itself failed 17
      and 4 extra T5 / T6 assertions in two runs. The final tree failed 0 and 14, all T5 / T6 as well; its first run
      reproduced the baseline exactly (54/56).
  - Neither difference comes from the module. The container restarted mid-stage onto a slower machine, which is why
    the same-machine rerun was needed.

## Design decisions (from reading the parent, not assumptions)

1. **Umbrae already exist.** `drawLight` clips each lamp to a 96-ray visibility polygon. It clips carried lights to ray
   fans, and your view to the exact line-of-sight polygon. Wall and pillar umbrae are therefore never drawn again, which
   rules out a double black. Only the penumbra on the lit side is added.
2. **Props do not occlude light** in the game (`Uc` stops at walls and pillars only), so prop shadows are new information
   for the eye.
3. **The shadow strength is the overlay's own light.** Every texel was checked against the formula (unit test C17). The
   game's light values were not changed.
4. **Pixi 8.11 keeps references** to polygon arrays and fill styles until render. Every polygon gets a fresh array
   (unit test C09).
5. **No forced layout.** The module never reads layout-dependent values inside a frame (SH3 finding: reading `innerWidth`
   cost about 2 ms a frame under mobile emulation).

## Performance

See `2D_SHADOWS_PERFORMANCE.md`. Software rendering (SwiftShader, 2 vCPU) is evidence, not hardware certification.

In short:
- **The module's CPU time per frame** is 0.09–0.45 ms on the desktop-like profiles (p95 ≤ 1 ms), and 0.26–1.6 ms on the
  mobile-like profile with the main thread slowed 4× (p95 ≤ 4 ms).
- **Draw calls are unchanged.** WebGL draw calls are identical to v23.3.6 at every tier. The module makes no 2D-canvas
  call at all (counted per canvas and per method), so the darkness overlay's calls are the parent's.
- **Frame times** stay within run-to-run noise, except in one fill-bound case under software rendering: a large
  flashlight prop shadow costs −5 / −10 / −12 % fps at LOW / MEDIUM / HIGH. A GPU fills that nearly for free, but
  real-device frame rates are for human QA.
- **One-time builds.** A lamp's shadow is built the first time it is seen: 0.2–0.7 ms on average, at most 6.1 ms at
  1280×720 and 8.1 ms on the slowed mobile-like profile. No more than 1 / 1 / 2 lamps are built in a frame.
- **SH3 fix.** A forced layout every frame (reading `innerWidth`) cost about 2 ms a frame on the mobile-like profile.
  Removing it took the module from 3.39 to 0.56 ms a frame there.

## Checkpoints

See `2D_SHADOWS_GIT_CHECKPOINTS.md`. Each checkpoint was pushed and verified on GitHub before the next one started:
SH0 freeze → SH1 grounding → SH2 cast shadows → SH3 tiers / performance / debug → SH4 regression and handoff.

## Human QA

See `2D_SHADOWS_HUMAN_QA.md`: a 10-minute tour and the ten questions. Visual QA is **not** marked PASS by the engineer.

## Known limits and notes for the tester

- **Penumbrae are deliberately subtle.** A flashlight is nearly a point light, so its penumbra is narrow. Lamp
  penumbrae are wider (tube-sized). Strengths are single constants, easy to tune after your notes.
- **Lamp prop shadows are short.** Lamps hang at ceiling height and props are low, so these shadows are faint in dim
  rooms. Flashlight prop shadows are the strong ones.
- **LOW draws fewer samples,** so shadow edges are harder, and it does not draw shadows from other players' lights.
- **Lamps in the PILLAR HALL hang above the pillars,** so they cast no pillar penumbrae there. Flashlights do.
- **The first sight of a lamp builds its shadow** (once, then cached). That costs well under a millisecond on average,
  with occasional single-frame spikes of a few milliseconds (see the performance report). A slow phone is the place to
  watch for a hitch when entering a new room.
- **Pre-existing parent behaviour is unchanged,** for example the `camera_policy.js` / `timing_policy.js` 404s under
  `node server.js` and the parent's known retained-suite failures. Both are reproduced exactly, not fixed: they are
  outside this stage.
