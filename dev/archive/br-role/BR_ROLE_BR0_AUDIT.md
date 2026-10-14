# BR-RoLE BR0 — audit of the legacy lighting and the replacement seam

**BR-RoLE — Backrooms Rendering of Lighting Engine.** This is the BR0 checkpoint: an audit only, with no runtime change.

## Preflight

| item | value |
|---|---|
| pack | `THE_FAR_BACKROOMS_BR_ROLE_LIGHTING_ENGINE_MASTER_PACK.zip`, SHA-256 `c4efac57…bc78`, matches the supplied checksum; all 10 manifest entries OK |
| remote `br-role` | did not exist; created from exactly SH7 |
| SH7 (donor / rollback point) | commit `f24a2c434c9b520f9119cdfaeb4a0b4d9487ce35`, tree `f529607e0f3c43198a71e4670259cca2f319930f` (verified locally and on GitHub) |
| `lighting-shadows-2d` | still at SH7, untouched |
| `main` | `7781e1ac34aa09970df57fae3fc107a873fa2731`, untouched |
| gameplay lineage | v23.3.6 `f2805bb904c158df17c5c75c3d0d4681049bc246` |
| workspace | clean (the deferred SH8 work-in-progress is stashed, not committed) |

## 1. The legacy visual lighting, as it actually runs

All of it lives in the client bundle `assets/index-DKbV5Nv9.js`, in the renderer class (`tu`, instance `X`).

- **Layers (DOM order):**
  - `#game`: the Pixi canvas (world, props, entities, the `lampTop` fixtures);
  - `#mp`, `#dread`;
  - **`#light`: the darkness overlay**, a 2D canvas the size of the CSS viewport (`innerWidth × innerHeight`, no DPR);
  - `.grain`;
  - then the HUD / DOM UI.

  The HUD is already outside the world lighting.
- **Entry point:** every frame, `frame()` ends with `this.drawLight(lightOn, t)`. `drawLight` does the following, in order:
  1. Fills the overlay opaque black.
  2. Clips to `scenePoints`, the player's line-of-sight polygon (`Hl(x, y, 700, 24)`, rays aimed at every grid corner).
     **Everything outside line of sight stays black. This is the visual LOS and it is kept as is.**
  3. Sets `destination-out` and **cuts** light out of the black:
     - the ambient glow around the viewer (radius 18 → 670 px, .14 / .045 / 0);
     - **every lamp** within the screen + 390 px, each clipped to its precomputed visibility shape and cut with a radial
       gradient: alpha `p` at the centre, `.35p` at half range, 0 at 380 px, where
       `p = min(.9, (dim ? .13 + .06·max(0, sin(11t + i)) : .43) · __ents.lamp(x, y, t) · __cam.lampGain())`;
     - the **local carried light** (if on and not night-vision): a 52 px hand glow (.35), then 12 nested arcs. Each arc
       clips to its own ray fan (24–45 `Uc` rays) and is cut by `1 − (1 − power)^(1/12)`, then painted with a
       `source-over` colour tint (`color · power · .2`). Lantern: one omni pass with flame flicker. Death replay: the
       torch, with a 150 px / .73 glow.
     - `__cam.irDraw(mk, …)`: the camcorder's infrared fan;
     - `drawPeers(mk, t)`: every other wanderer's light the same way (camcorders via `__cam.peerIR`).
  4. Restores the clip, then draws on top: the vignette (`source-over` to .65 at the edges), the death blackout and
     flashes, and the **Smilers' faces and glow** (emissive, clipped to `sightPoints`).
- **The lamp visibility shapes** (`lampShapes`) are built once at start: **96 uniform rays** per lamp (`Uc` to 380 px),
  *not* aimed at corners. That is why lamp shadow edges at corners are ragged, and part of why the SH6 / SH7 shadows had
  to compensate around them.
- **Composition is multiplicative.** Each light cuts a fraction of what is left (`keep = Π (1 − cᵢ)`). The SH2–SH7
  shadow module draws *under* this overlay and had to scale itself to the other lights' share (SH7). That split ownership
  is exactly what BR-RoLE retires.

## 2. Light data (the inputs, kept as they are)

| data | where | used by BR-RoLE |
|---|---|---|
| lamps (position, index) | `Fc`, exported as `__api.lamps` | yes |
| lamp power, dim fixtures, failures, night-vision gain | the formula above; `__ents.lamp(x, y, t)`; `__cam.lampGain()` | yes: the same formula |
| blackout | `V.blackout` (`__api.V`) | yes |
| carried-light types | `Gc`: flashlight 390 px / .92 rad / .58; headlamp 262 / 1.95 / .5; lantern 228 / omni / .5 (flame flicker); camcorder NV (no light) | yes |
| own light: on / kind / colour / source | `lightOn` (drawLight's argument), `H.equipment.kind / color`, the hand `X.person.beam`, the death torch | yes: passed through the hook |
| peer lights | `window.__peerLights` (from `mp.js`): `x, y, angle, kind, color, on, dead, ir` | yes |
| hard occluders | `Hc(cx, cy)` wall cells, `Uc(x, y, angle, max)` the ray query (walls and pillars), `Bc` pillar rects, `Vl` grid corners (module-private; recomputed from `Hc`) | yes |
| line of sight | `scenePoints` / `sightPoints` | yes: unchanged |

## 3. Gameplay and AI light truth (protected, untouched)

- **Server AI** has its own light model (`ai.js` `geo.lightLevel`) and never reads the client.
- **`light.js` (`__light.sample / readability / ray / occluders`)** is the client's light query. It is read by
  `ents.js` (Smiler readability: how legible a Smiler is to the local eye) and was read by the SH2–SH7 entity blobs. The
  bundle's `Ul()` is the fallback for the same readability. **None of them reads the overlay's pixels.** BR-RoLE does not
  touch `light.js`, `ents.js` or `Ul`, so AI perception and Smiler readability stay exactly v23.3.6.
- **Visual line of sight** (black beyond `scenePoints`) and the Pixi `sightMask` for entities stay the game's own.
- Movement, collision, camera, networking, deaths, items, map: nothing in the lighting path reaches them.

## 4. The replacement seam

**A new client module `assets/br-role.js`, plus one guarded hook inside `drawLight` in the bundle.**
- `drawLight` keeps its clear, its line-of-sight clip, `__cam.irDraw`, the vignette, the death effects and the Smiler
  faces.
- **Only the light cut-outs are replaced:** the ambient glow, every lamp, the own carried light, and the non-camcorder peers.
  When `window.__brRole` is active, `drawLight` hands it the overlay context and its frame inputs instead.
  `drawPeers` still runs for camcorder peers only.
- With `?lighting=legacy` (a DEV comparison switch, not in the settings), the hook steps aside and v23.3.6 draws
  exactly as before.

**Why this seam:**
- The renderer instance is private to the bundle's module scope, so an outside script cannot replace `drawLight`.
- The overlay is the final visual owner of world darkness. Owning what is cut out of it is the smallest change that
  makes BR-RoLE the **only** owner of light, with no second compositor stacked on top or underneath.
- Everything else the overlay draws is untouched, so line of sight, NV, death presentation and Smilers stay as they
  were.

**Files BR1 modifies (presentation only):**
1. `assets/br-role.js`: new.
2. `assets/index-DKbV5Nv9.js`: one guarded call inside `drawLight`, plus `drawPeers` skipping non-camcorder peers
   when BR-RoLE draws them. No other byte of the bundle changes.
3. `index.html`: the `assets/shadows-2d.js` tag becomes `assets/br-role.js`. SH7 is no longer loaded: it stays in the
   repository as donor and reference, and is no longer a runtime dependency.

Protected files stay byte-identical to SH7 and to v23.3.6: `ai.js`, `sim.js`, `move.js`, `server.js`, `mp.js`,
`death_srv.js`, `dphys.js`, `camera_policy.js`, `world.js`, `light.js`, `ents.js`, `camcorder.js`, `timing_policy.js`.

## 5. The BR-RoLE compositor (BR1 plan)

`visible light = ambient + Σ lightᵢ · visibilityᵢ`, accumulated per light, additively.

1. **A light-accumulation buffer:** an offscreen 2D canvas at the tier's scale of the CSS viewport (LOW .5, MEDIUM
   .75, HIGH 1.0). It is never sized by `devicePixelRatio`.
2. **Each light, independently:** its own visibility (clip to its occlusion polygon), its own cookie (radial falloff;
   cone with soft nested arcs for beams; near glow), and power, flicker, failure and gain. Contributions are added with
   `lighter`. A light that is blocked simply adds nothing, so **another light that reaches the spot fills it**. That
   follows from the composition itself; there is no erase hack.
3. **Better occlusion than the legacy shapes:**
   - lamps: cached once per lamp from rays aimed at every grid corner and pillar corner in range, plus a uniform base
     fan;
   - carried lights: the same per frame within a tier's ray budget. One polygon replaces the legacy's 12 per-arc fans
     (≈ 500 rays).
4. **Into the overlay:** `destination-out` of the accumulated buffer, inside the game's own line-of-sight clip. Then
   the carried lights' colour tint (`source-over`, as before, one pass per light), so beams keep their colour.
5. **Relevance and tiers:** lamps whose light reaches the screen, ranked by distance and capped per tier (and faded
   at the cap); peers capped per tier; beam softness (arcs) and ray budget per tier.
6. **Debug counters:** `__brRole.stats()` and an admin-only panel.

**BR1 does not include** cast prop / actor shadows inside the compositor, or tube-area softness and penumbrae. Those
are BR2. SH7's wall grounding and the dominant-light entity blob are carried over in BR1. They are a static contact
band and one cheap blob, not a lighting compositor, so the scene does not lose its contact cues meanwhile.

## 6. Donor classification (SH0–SH7 and the bundle)

| donor | class | how |
|---|---|---|
| legacy `drawLight` cut-outs (ambient / lamps / carried / peers) | **RETIRE** from the active path | bypassed by BR-RoLE (DEV switch only) |
| legacy `lampShapes` (96 uniform rays) | **RETIRE** | replaced by corner-aware lamp visibility, cached |
| legacy lamp power formula, `__ents.lamp`, `lampGain`, blackout | **REUSE** | identical formula |
| `Gc` light definitions, beam source, death torch, colour tint | **REUSE / ADAPT** | one polygon + soft arcs per beam |
| `__cam.irDraw` / `peerIR` (camcorder NV) | **REUSE** | called as before |
| line-of-sight clip, vignette, death effects, Smiler faces | **REUSE** (untouched) | the overlay keeps drawing them |
| SH7 `assets/shadows-2d.js` lamp-shadow layer, cast layer, penumbra wedges, mixed-light fill | **RETIRE** | not loaded; BR-RoLE's composition makes them unnecessary |
| SH7 grounding (AO strips, merged runs, corner blobs, chunk culling) | **ADAPT** | carried into `br-role.js` as the static contact layer |
| SH7 dominant-light entity blob (Smiler excluded, LOS-gated) | **ADAPT** | carried into `br-role.js` for BR1; becomes BR2's actor shadow |
| SH7 quality / settings plumbing, debug-view pattern, attach logic | **ADAPT** | `br-role.js` LIGHTING row |
| SH7 prop caster table, hull projection, baked-shadow detection | **REFERENCE** | BR2's per-light prop shadows (`destination-out` in a light's scratch) |
| SH7 corner list, pillar discovery through `Bc` | **REUSE** | occluder vertices for visibility polygons |
| `dev/shadows` harness (`harness_lib`, `shots.js`, `roi_metrics.js`, `ScriptedPeer`), freeze tool | **REUSE** | BR quick checks and targeted captures |
| SH0–SH6 benchmark matrices, retained-suite runners | **REFERENCE** | BR3 only, after visual approval |
| archived true-2.5D / spatial renderer | **RETIRE** | not revived |

## 7. Stop conditions checked

- **No gameplay or AI change is needed.** The seam is entirely in the render path.
- **The renderer can be bypassed without touching gameplay code.** The one bundle edit is inside `drawLight` and
  `drawPeers`, which only draw.
- **`br-role` had no newer remote work.** The branch did not exist.
- **The pack's architecture fits the actual seam.** Canvas 2D on the existing overlay; no conflict.

No benchmark was run for BR0.
