# SH1 — static and contact grounding shadows

Parent checkpoint: SH0 `8e3c06b0bd2351ffc75f0c8d8ec5cbd5f2407362` (tree `be8709529fa91df99663bc0757a8759da5a3c9af`),
verified on GitHub before this work started (`sh0_remote_verify.json`).

## What changed in the shipped game

| file | change |
|---|---|
| `index.html` | one 46-byte insertion: `<script src="./assets/shadows-2d.js"></script>` after `inventory.js` (byte-checked: removing that string gives the parent file exactly) |
| `assets/shadows-2d.js` | new, client-only presentation module |

Nothing else in the game changed: `freeze_verify.json` shows all 8 special-protection files and every other v23.3.6 runtime file byte-identical (`FREEZE OK`).

### Why these two places

* The shipped `server.js` serves only a fixed whitelist (`SERVE` regex). It already serves `assets/*`, so the module lives there and `server.js` stays byte-identical. A root-level `shadows.js` would 404 under `node server.js` (the same way `camera_policy.js` and `timing_policy.js` already do at the parent — SH0 finding 1).
* No bundle edit. The module attaches to the running renderer through `__api.floor().parent` (the Pixi world container) and is driven by wrapping `window.__mp`, the per-frame hook mp.js already exposes and the bundle already calls right after `X.frame(...)`. `mp.js` is byte-identical and its hook still runs first, with the same arguments and return value.

## Findings that shaped the design (from reading the parent, not assumptions)

1. **Entities already carry baked contact shadows.** Players, other wanderers and corpses: the avatar draws `ellipse(1,5,19,19)` at alpha .3 under itself. Hounds: the view draws `ellipse(0,13,39,19)` at .46 and ents.js adds a ground shadow `ellipse(0, 3+air·14, 30-air·6, 50·sy)` at .34−air·.14. A second centred contact blob would double them, so SH1 adds only the **light-directional** part: a soft shadow cast away from the dominant light reported by `__light.sample()` (dirX/dirY, direct).
2. **Your own light's wall and pillar shadows are already exact on screen.** The game blacks out everything outside the line-of-sight polygon (`Hl`, an exact corner-based visibility polygon from the player), and the carried light starts at the player's hand. Behind a wall or pillar, as seen from your light, is behind it as seen from you. Drawing those shadows would only double-black the screen. They are therefore never drawn (SH2 scope note).
3. **Props do not occlude light in the overlay** (`Uc` stops only at walls and pillars), so prop shadows are new information for the eye — SH2.

## Implemented

* **Wall grounding (ambient occlusion).** Soft gradient strips on the floor along every wall/floor boundary, merged into maximal runs (1,492 boundary edges → 483 runs, 3.1 edges per strip; no per-tile comb), quarter-disc blobs at every outer wall corner (364), concave corners darken naturally where two strips meet. Width 30 px, peak alpha .38 with a power-1.7 falloff. Drawn as textured quads (black-alpha gradient textures made once from tiny canvases). 847 quads in 24 camera-culled chunks (16×16 cells); built once in ~4–8 ms at load and never rebuilt. Pits are floor holes, not walls, and get no strip.
* **Light-directional entity shadows.** For the local player, other wanderers and hounds that the local player can actually see (inside the 700 px sight range and in line of sight by the game's own `Uc`, the same rule as hover names): a soft elongated blob pointing away from the dominant light. Its length grows with that light's strength at the entity, its width follows a hound's heading. Smoothed across consecutive frames, so a light switching never pops. Skipped entirely for Smilers (no body may be implied). Never drawn when the light is your own light at your own position: `light.js` reports no direction there.
* **Quality tiers** OFF / LOW / MEDIUM / HIGH (caps 0 / 6 / 12 / 20 entity shadows; grounding in all but OFF). The default is MEDIUM on desktop and LOW on touch or small screens. Chosen in SETTINGS ▸ CUSTOMIZE ▸ SHADOWS (`hud.js` untouched: the row is added at run time) or with `?shadows=`. Remembered per device.
* **Admin/developer debug view.** A SHADOW DEBUG button exists only while the admin panel's DEBUG MODE is on (`__ents.dbgCfg.on`), and goes away with it. It draws visible AO chunks, entity-shadow ellipses and per-frame counts on its own canvas. Ordinary players never get it.
* **Failure isolation.** Any internal error removes the module's layer and stops it; the game hook keeps running (unit test S13).

## Validation

| check | result |
|---|---|
| unit tests `dev/shadows/test_shadows.js` (real bundle geometry + real light.js in a VM) | **16/16 PASS** (`unit_tests.log`) |
| browser checks `dev/shadows/browser_shadows.js` (real client, shipped server) | **8/8 PASS** (`browser_checks.log`) |
| retained v23.3.6 suites on the SH1 tree vs the SH0 parent baseline | **21/21 suites identical**: verdict, counts, failing-assertion names and error messages (`retained/compare_vs_parent.md`). `npm-test` PASS/FAIL lines are byte-identical; `browser-move` (movement numbers through the real page) log is byte-identical |
| gameplay freeze | `FREEZE OK` — protected and frozen files byte-identical (`freeze_verify.json`) |

Browser checks in detail: B02 hashes the `#light` darkness overlay at OFF/LOW/MEDIUM/HIGH on a frozen instant. It is byte-identical with lamps on, and byte-identical again in a confirmed blackout (a different hash), so the shadows never touch the overlay. B03: hound, smiler and player views keep position, alpha, tint and visibility at every quality. B04: the client sends the same messages with shadows OFF and HIGH. B07: no shadow is ever drawn for a smiler.

## Visual evidence (`shots/`)

`*-off-vs-medium.jpg` are centre crops of the same frozen instant, OFF on the left and MEDIUM on the right. `*-diff-x8.jpg` is the absolute pixel difference ×8, which isolates exactly what the shadows add.

Scenes: room (spawn lamp, partition), corridor (wall stubs), doorway (pillar-hall partition), lampwall, blackout, hound. The hound and its dread effects keep animating under the test clock (ents.js treats a zero frame time as 1/60 s), so the hound pair differs in pose as well. The overlay identity is proven separately, with no monster present (B02).

Software rendering (SwiftShader, 2 vCPU) — evidence, not hardware certification. Visual QA is for the human tester.
