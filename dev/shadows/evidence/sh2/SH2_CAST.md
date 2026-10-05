# SH2 — flashlight and lamp cast shadows

Parent checkpoint: SH1 `3151062a30e3b824e209ebb8e244c24691d118d9` (tree `3cab46b92db1025b4f1a7833f3dae73491d825f9`),
verified on GitHub before this work started (`sh1_remote_verify.json`).

## What changed in the shipped game

| file | change |
|---|---|
| `assets/shadows-2d.js` | SH2 cast shadows added to the client-only presentation module (below) |
| `index.html` | unchanged since SH1 (the one 46-byte `<script>` insertion) |

Nothing else in the game changed: `freeze_verify.txt` shows all 8 special-protection files and every other v23.3.6
runtime file byte-identical (`FREEZE OK`, 229 / 230 parent files identical, the 230th is the documented `index.html` insertion).

## Findings that shaped the design (read from the parent, not assumed)

1. **The darkness overlay already casts hard shadows from walls and pillars, for every light.** `drawLight` clips each
   ceiling lamp's light to `lampShapes[i]`, a 96-ray visibility polygon built once at init with the game's ray query
   `Uc`. Every carried light, yours and other wanderers', is clipped to a fan of `Uc` rays (`mk`). Everything outside your
   line of sight is black. So the umbra behind a wall or pillar is already dark for every light. Drawing it again would
   double-black the screen. SH2 never draws it.
2. **What those hard cuts lack is a penumbra.** A fluorescent fixture is a 74 × 13 px tube (the `lampTop` art), and a
   hand-held lamp is not a point either. SH2 adds only the part of the penumbra that falls on the **lit** side of each cut.
3. **Props do not stop light in the game.** `Uc` stops only at walls and pillars, so the shadow of a counter, shelf,
   bench or machine is new information for the eye. SH2 draws it, both for lamps and for carried lights.
4. **The overlay's own light formulas** were read from `drawLight` / `drawPeers`. They are mirrored, never changed:
   - Lamp cut-out `p = .43`. Dim fixtures (`index % 13 == 0`) use `.13 + .06·max(0, sin(11t + i))`. Either is multiplied
     by `__ents.lamp()` (failures) and `__cam.lampGain()` (NV), capped at `.9`. Radial stops are `1 / .35 / 0` at 6 / 193 / 380 px.
   - Carried lights draw a 52 px glow of `.35`, then either 12 nested arcs of `1 − (1 − power)^(1/12)` each
     (`arc·(1 − .063 t)`) or one omni gradient for the lantern (with its flame flicker). Radial stops are
     `1 / .83 / .28 / 0` at 6 px, 25 %, 70 % and 100 % of the range.
5. **Pixi 8.11 keeps references.** It holds a reference to every polygon's point array and to every fill style until
   it renders. It also switches a fill texture to `repeat`. So every polygon gets a fresh array; unit test C09 checks
   this against a mock that, like Pixi, keeps the caller's array.

## Implemented

**Light textures.** Every cast shadow takes away only its own light. A shadow polygon is filled with that light's own
strength over the floor and is nothing where that light does not reach:
- The texture is black with alpha `sat(c)`, where `c` is the overlay's cut-out for that light at that pixel.
- `sat(c) = A0·c / (1 − A0 + A0·c)` with `A0 = .92` is the share of the light at that spot that is this light's.
- The texture sits at the light and turns with the aim.
- There is one 128² texture per kind: lamp, dim lamp, flashlight, headlamp and lantern, each built once.
- A shadow therefore fades with the beam's cone, its range and its glow exactly as the overlay draws them.
- Unit test C17 compares every texel with the overlay formula (≤ 0.002, 8-bit). C18 shows a carried light's shadow is
  zero outside its beam. Browser check B09 shows WebGL really draws it.

**Ceiling lamps** — geometry built once per lamp and cached; only the alpha changes per frame:
- *Prop shadows.* Each is the hull of the prop's base and its top projected from the lamp (ceiling 240 px). It is
  sampled K times along the tube, clamped where a wall stops the light, and thinned on the side where `world.js` already
  bakes a drop shadow.
- *Wall and pillar penumbrae.* A convex corner (364 outer wall corners and 36 pillar corners) qualifies when the lamp's
  edge grazes it: the corner and the floor past it on the lit side are in the light, and the floor on the wall side is
  not. All three checks use the game's own `Uc`. The wedge:
  - has its apex at the corner;
  - opens toward the lit side by `atan(half tube size seen across the edge / distance)`;
  - is split into J sub-wedges, darkest at the edge;
  - ends where the light along it stops — its far edge is sampled on at least 4 rays, so a far shadow edge trims it a
    slice at a time;
  - fades out as the ray turns head-on into the corner or right next to the light.
- *Per frame.* Alpha is the overlay's own lamp power relative to the nominal power, `p(t) / p0`. Flicker and failures
  follow every frame (it is never brighter than nominal), and nothing is drawn in a blackout.
- *Bounds.* Nearest lamps first, in a stable index order. A lamp at the cap's cut-off fades by distance, and a newly
  admitted lamp eases in over 0.25 s. At most `builds` caches are built per frame, and the cache is LRU-capped at 48.

**Carried lights** — rebuilt every frame within the tier's caps and polygon budget:
- *Your light* comes from the hand that holds it (the overlay's beam source) and casts prop shadows plus corner
  penumbrae on the lit side.
- *Casters are ranked* by the game's own equipment light model `qc`. For props, that is the most light on any part of
  the prop. A caster crossing the cap fades by its margin above the first one left out, and on your own light each
  caster's weight eases over 0.1 s. A fast swing of the beam therefore never pops a caster (unit test C15: no caster
  changes by a third of its own peak in one frame, at sprint speed, on three paths, at every tier).
- *Other wanderers' lights* use the nearest `peers` lights that are on, not dead and not a camcorder. They follow the
  same rules with smaller caps, and a light at the cap fades by distance.

**Quality tiers** (OFF draws nothing; LOW keeps every kind of shadow at lower fidelity):

| tier | lamps | lamp samples / wedges | your light: props / corners / wedges | peers: lights / props / corners | dynamic polygon budget |
|---|---|---|---|---|---|
| LOW | 2 | 2 / 2 | 3 / 4 / 1 | 0 | 40 |
| MEDIUM | 5 | 3 / 3 | 6 / 8 / 3 | 2 / 4 / 4 | 300 |
| HIGH | 9 | 4 / 4 | 10 / 12 / 4 | 4 / 6 / 6 | 700 |

**Debug view** (admin DEBUG MODE only, as in SH1) shows:
- lights as range circles (yellow lamps, green yours, blue peers);
- candidate casters as dim dots, chosen casters as penumbra wedges and prop boxes;
- every carried-light polygon;
- AO chunk bounds and entity-shadow ellipses;
- a panel with the tier, lights, candidate / active casters, dynamic polygons against the budget (props / penumbrae),
  primitives, lamp-cache hits, misses and builds, and build time.

## Validation

| check | result |
|---|---|
| unit tests `dev/shadows/test_shadows.js` | **34/34 PASS** (`unit_tests.log`; S01–S16 from SH1, C01–C18 new) |
| browser checks `dev/shadows/browser_shadows.js` | **9/9 PASS** (`browser_checks.log`; B09 new; `browser/` has the settings row and the debug view) |
| retained v23.3.6 suites on the SH2 tree vs the SH0 parent baseline | **21/21 suites identical** (`retained/compare_vs_parent.md`) |
| gameplay freeze | `FREEZE OK` (`freeze_verify.txt`) |

The retained comparison checks each suite's verdict, counts, failing-assertion names and error messages. The parent's
own known failures (npm-test 151/162, browser-play, browser-light 13/15, browser-admin 54/56, the two descriptive
suites) reproduce exactly and nothing new fails. Several logs match the parent byte for byte:
- the 163 npm-test `PASS` / `FAIL` lines, once the per-test `[ms]` timings are stripped;
- the `browser-move` log, i.e. the movement numbers measured through the real page;
- the `camera`, `fps`, `physics` and `interpolation` logs.

`humanqa` and `entity-look` differ only in their `[ms]` timings. The suites ran on an export of the working tree whose
`assets/shadows-2d.js` (SHA-256 `c866dfd9…31ed`) is the committed file.

The SH2 unit tests in brief:
- *Geometry.* C01 prop shadows fall away from the lamp. C02 lamp penumbrae start on a convex corner, extend away from
  the lamp and lie only where the lamp's light reaches; none lies over the overlay's own umbra.
- *Flicker and blackout.* C03 failures dim the shadow and NV never makes it brighter. C04 dim fixtures follow the
  overlay's flicker formula exactly. C05 a blackout removes every lamp shadow.
- *Your light.* C06 its prop shadows fall beyond the prop. C07 sweeping the aim is smooth.
- *Bounds and correctness.* C08 caps and culling. C09 no NaN, and no shared point arrays. C10 deterministic.
- *Tiers and art.* C11 fidelity grows with the tier and LOW keeps every kind of shadow. C12 baked prop shadows are
  detected.
- *Other lights and pops.* C13 peers are bounded and never cast from a dead or switched-off light. C14 your light's
  penumbrae. C15 no popping. C16 caps under a swinging beam.
- *Textures.* C17 the light textures equal the overlay formulas. C18 a carried light's shadow is zero outside its beam.

## Visual evidence (`shots/`)

`*-off-low-high.jpg` / `*-off-low-medium-high.jpg` are centre crops of the same instant, left to right, at increasing
quality. `*-diff-x6.jpg` is the absolute pixel difference OFF vs HIGH × 6, which isolates exactly what the shadows add.

| scene | what to look at |
|---|---|
| `props` | your flashlight on the reception counter: the beam beyond the counter is in its shadow |
| `shelf` | your flashlight on the toppled shelf: the shadow follows the beam's cone and fades with it |
| `shelfdark` | the same shelf lit by two ceiling lamps only: short, soft prop shadows |
| `partition`, `lampedge` | lamp shadow edges at wall stubs: a soft penumbra on the lit side of the overlay's hard cut |
| `pillarlit`, `pillars`, `doorway` | your flashlight on a pillar / wall stubs: thin penumbrae along both shadow edges |
| `room` | the spawn room: grounding, lamp penumbrae |
| `debug-*-high.jpg` | the admin debug view on the same scenes: light ranges, candidate and chosen casters, polygons, counts |

## Cost (indicative)

During the captures, the module's own per-frame work averaged 0.03–0.3 ms on 2 vCPU under SwiftShader. That is the
scene's carried-light rebuild plus culling; lamp shadows are cached. Each lamp's one-time build took at most 4.1 ms,
and at most `builds` lamps are built in a frame (one at LOW and MEDIUM, two at HIGH). The dynamic polygons per frame
stayed far under each tier's budget (most seen: LOW 2 / 40, MEDIUM 9 / 300, HIGH 12 / 700). SH3 measures frame time,
draw calls and module cost against the parent across the representative scenes and profiles.

In captures with the flashlight on, the darkness overlay is not byte-identical between captures. Under the shots' +1 µs
test clock the beam keeps its tiny sway. Overlay identity is proven under an exact freeze by B02.

Software rendering (SwiftShader, 2 vCPU) — evidence, not hardware certification. Visual QA is for the human tester.
