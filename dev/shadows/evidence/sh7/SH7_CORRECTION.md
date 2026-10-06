# SH7 — human-QA correction: mixed-light composition and wall/corner penumbrae

Continues from the accepted SH6 commit `feed2d5c251bf73c301d54a3b9f2ee6163f3aa00` (tree
`82b4976bbaba16efb3bb701891882c9c49afe4db`). The preflight found the remote branch exactly at SH6 and `main` at
`7781e1ac…` (`preflight.json`). The correction pack was verified before use: its SHA-256 matched and all 12 manifest
entries checked out (`correction_pack_files.sha256`). Your five SH6 QA images are in `human_qa_sh6/`.

**Only `assets/shadows-2d.js` changed at runtime** (now `shadows-2d 1.2`). No gameplay, server, network, AI, collision,
camera, light-truth or map file changed, and nor did the darkness overlay or `index.html`.

## SH-QA-01: a fluorescent shadow stays dark inside the flashlight beam

**Root cause.** The overlay is one black canvas that every light cuts with `destination-out`, so lights *multiply*:
the darkness left at a spot is the product of every light's keep (1 − its cut-out). Each shadow, though, was given a
strength computed as if its own light were the only one present (its light texture). Inside your beam most of the
floor's light is the flashlight's. A lamp's shadow there should take away only the lamp's small share, but it was drawn
at the lamp-alone strength.

**How large the error was.** About 100 px into the beam, a lamp penumbra darkened the floor by ~0.38 where the
lamp's actual share called for ~0.07: about five times too dark. Lamp shadows were also baked into one cached
`Graphics` per lamp, so nothing but the lamp's power could change them per frame. The overlay itself also shows the
lamp's edge inside the beam (flashlight + lamp on one side, flashlight only on the other). That is v23.3.6's own
lighting, and it is visible at OFF; it is much smaller near you (~14 % brightness step at 100 px).

**Correction.** For a shadow taking away a fraction *w* of light *i*, drawn under the overlay, the floor must darken by
exactly `a = w · (cᵢ / keepᵢ) · D / (1 − D)`, where *D* is the total darkness at that spot. Each light's texture was
built for `D = A0 · keepᵢ` (that light alone), so with the other lights' keep *K* every shadow of light *i* is scaled by

    m = K (1 − Dᵢ) / (1 − Dᵢ K),   Dᵢ = A0 · keepᵢ

This is 1 where no other light reaches and tends to 0 under a strong one. It uses the overlay's own formulas (the lamp
gradient and power; the carried glow and 12 nested arcs; walls clipping the beam through the game's ray query). Nothing
is read back from the overlay, and the overlay does not change. A lamp's cache is now a container per lamp (its alpha:
the lamp's power, flicker and failures, as before) holding one `Graphics` per shadow element (one penumbra band, or one
prop's shadow). Each element's alpha is its *m*, evaluated each frame at one or two sample points, and only for lamps
that a carried light can reach.

**Shadows of the same prop stack; they never cancel.** The game's ray query passes over props (only walls and pillars stop
light). A light that would fill a prop's shadow may therefore be shaded at that spot by the same prop. That happens when
your beam and a lamp, or two beams, come from the same side of a counter. The light then does not fill the shadow, and
both shadows stack as they should. This is tested against that light's own floor shadow of the prop. It was found in the
two-wanderer evidence scene, where without it the area behind the counter came out almost shadowless at HIGH.

**Evidence (`visibility/`).** These captures use the same frozen instant at the YELLOW HALL spawn lamp: your beam across
its shadow edge at the partition corner. They are made in software rendering, so the `*-bright.jpg` / `*-zoom.jpg`
copies are multiplied ×3 for the eye only; the measurements use the originals.
- `qa01-zoom.jpg` shows SH6 MEDIUM | OFF | SH7 MEDIUM. The dark wedge inside the beam is gone in SH7, which now looks like
  OFF there.
- `qa01-diff.jpg` shows what MEDIUM takes away from the OFF picture, SH6 next to SH7. The fan of lamp penumbrae inside
  the beam is gone.
- The faint edge that remains in the beam is v23.3.6's own lamp boundary (it is there at OFF); this stage does not
  change the overlay.
- Unit test **X01** checks the composition against the exact formula, independently of the module. In the beam, the
  lamp's shadow keeps at most 37 % of its lamps-only darkening, within 0.011 of the exact share. Outside the beam it is
  unchanged (0.0000).
- **X02**: LOW fills the same way, and so does another wanderer's beam.
- **X05**: shadows of one prop from two lights on the same side stack.

## SH-QA-02: oversized wall/corner wedges

**Root cause.** A penumbra wedge ran from the corner to the light's full range (lamp 380 px, flashlight 390 px). Its
angular width was up to 0.32 rad and it kept one strength along its whole length. At the YELLOW HALL spawn, lamp #4
hangs 48 px from a partition corner: its wedges were **312 px long and 103 px wide at the far end**. A flashlight's
could reach 390 × 130 px. Far from the corner, these read as a second, geometric shadow cone beside the overlay's own
hard edge (225 lamp wedges on the map; median 100 px long).

**Correction.** The penumbra is now a soft lip that hugs the hard edge:
- **Reach is bounded:** 130 px from the corner for lamps, 110 px for carried lights.
- **Far width is capped:** 22 px for lamps and 26 px for carried lights. The shape depends only on the light and the
  corner, never on how far the light runs on; walls further on trim it ray by ray, as before.
- **It fades along its length** in 2 / 3 / 4 bands (LOW / MEDIUM / HIGH), weights (1 − t)^1.25, while the slices across it stay
  darkest at the edge.
- **The umbra side is still never drawn** (no double black), and the hard umbra is still the overlay's.
- **For your light, a corner coming out from behind another pillar fades in over 0.1 s** instead of appearing whole.

Strength next to the corner is unchanged (`LAMP.wall`, `CARRY.fringe` = 1); nothing was weakened globally.

**Evidence.**
- `qa02-zoom.jpg` (flashlight off) and `qa02lit-zoom.jpg` (on) show SH6 MEDIUM | OFF | SH7 MEDIUM.
- `qa02-diff.jpg` shows the long streaks running from the corner across the floor at SH6, and the short lip at the corner
  that SH7 leaves.
- **C02 / C13 / C14** check every lamp and carried-light wedge against its reach bound (130 / 110 px).
- **X03** checks the far width over six scenes: the widest is 21.7 px (lamps) and 16.5 px (carried lights), against
  caps of 22 / 26. It also checks that the band weights fall along the length.
- **C15** (no popping) still passes: the worst one-frame jump of any caster is 32 % of its own peak. The limit is 34 %;
  SH5 measured 28 %.

**Measured in the QA regions** (`visibility/roi.md`):

Relative darkening the module adds in the human-QA regions (capture pixels; only pixels lit at OFF), MEDIUM unless stated. mean / p90 / share of lit pixels darkened ≥ 10 %. The QA02 region and the QA01 region include wall bases, so their grounding (unchanged) sets the p99.

| region | SH6 | SH7 | SH7 LOW | SH7 HIGH |
|---|---|---|---|---|
| QA01 · the lamp's edge inside your beam (lit by the beam, luma ≥ 40) | 0.019 / 0.059 / 7.5 % | **0.010 / 0.000 / 3.8 %** | 0.010 / 0.000 / 3.8 % | 0.010 / 0.000 / 3.8 % |
| QA01 spot, flashlight off (lamps only) | 0.019 / 0.060 / 7.0 % | **0.012 / 0.000 / 4.3 %** | 0.012 / 0.000 / 4.4 % | 0.012 / 0.000 / 4.3 % |
| QA02 · the corridor-corner wedges, flashlight off | 0.042 / 0.162 / 14.6 % | **0.032 / 0.131 / 11.6 %** | 0.032 / 0.131 / 11.6 % | 0.032 / 0.131 / 11.6 % |
| QA02 spot, flashlight on | 0.042 / 0.159 / 14.5 % | **0.032 / 0.127 / 11.4 %** | 0.032 / 0.127 / 11.4 % | 0.031 / 0.126 / 11.3 % |
| two wanderers: behind the counter, the other beam from across it | 0.416 / 0.560 / 82.1 % | **0.419 / 0.559 / 82.6 %** | 0.408 / 0.550 / 81.6 % | 0.334 / 0.449 / 82.6 % |
| (two wanderers, HIGH) | SH6 HIGH 0.419 / 0.563 / 82.5 % | | | SH7 HIGH 0.334 / 0.449 / 82.6 % |

The whole-frame measurements of the other scenes (`visibility/visibility.md`) show nothing weakened globally: the
reception counter in your flashlight stays at p90 0.545, and the shelf scenes and DAMP ROOMS move only where their
penumbrae were long.

## Quality tiers (the pack's policy)

| tier | what it draws | mixed-light composition |
|---|---|---|
| OFF | nothing (v23.3.6) | — |
| LOW | grounding; ≤ 2 lamp caches; your light: 3 props, 4 corners; 2 penumbra bands; one dominant-light blob per entity; budget 40 polygons | lamp shadows filled by your light and the nearest other wanderer's |
| MEDIUM (primary) | ≤ 5 lamps; 6 props, 8 corners; 2 other lights cast; 3 bands; budget 300 | filled by your light and 2 other wanderers' |
| HIGH | ≤ 9 lamps; 10 props, 12 corners; 4 other lights cast; 4 bands; budget 900 (was 700, for the finer bands) | filled by your light and 4 others'; **and** your light's shadows also give way to other wanderers' beams that cross them |

**The lighting itself (the overlay) is identical at every tier;** tiers change only the added shadows. Entity shadows
stay one dominant-light blob at every tier.

**Considered and not enabled:**
- **A secondary actor shadow at HIGH.** In this game the dominant light near an entity is nearly always one lamp or one
  beam, so a second blob would mostly stack under the first. The pack allows it only where it is materially visible
  and not noisy.
- **Lamps filling each other's shadows, or your flashlight's** (physically consistent). Measured in the toppled-shelf
  room, it made HIGH's lamp shadows 35 % and its flashlight shadows 54 % lighter than MEDIUM's. That is fainter, not
  richer, and it would undo the SH5 visibility you asked for without fixing a reported artifact.

## Files changed

| file | change |
|---|---|
| `assets/shadows-2d.js` | 1.1 → 1.2: mixed-light composition; per-element lamp caches; bounded, fading penumbrae; eased corner visibility; tier fields `bands`, `fillPeers`, `fillAll`; HIGH budget 900 |
| `dev/shadows/test_shadows.js` | helpers read the per-element lamp caches and banded penumbrae; C02 / C13 / C14 also check the reach bound; C15 groups bands by corner; new X01–X05 |
| `dev/shadows/shots.js` | QA scenes `qa01`, `qa01dark`, `qa02`, `qa02lit`, `peerfill` (another wanderer: a scripted client), `--def` ad-hoc scenes |
| `dev/shadows/harness_lib.js` | `ScriptedPeer`: the bench's scripted wanderer, shared |
| `dev/shadows/scene_bench.js` | bench scene `qa01` (for SH8's performance passes) |
| `dev/shadows/README.md` | rows for the above and the SH7 / SH8 evidence |
| `dev/shadows/report/mk_visibility.js` | before/after labels, optional brightened copies for the eye |
| `dev/shadows/roi_metrics.js` | new: the darkening the module adds inside one region of a capture (the QA regions) |
| `dev/shadows/evidence/sh7/` | this report, the preflight, the pack's identity, SH6's verification, your QA images, captures and measurements, the freeze and protected-file checks |

The root reports (`2D_SHADOWS_*.md`) are rewritten at SH8, the publication checkpoint. At this commit they still describe
SH6, except the checkpoint table.

## Tests

- **Unit tests:** 48 / 48 (`unit_tests.log`), including the SH7 tests X01–X05 and the updated C02 / C13 / C14 / C15.
- **Browser checks:** 9 / 9 on the real client (`browser_checks.log`). These include **B02: the darkness overlay is
  byte-identical at OFF / LOW / MEDIUM / HIGH** (lamps on and in a blackout), B03 untouched entity views, B04 unchanged
  network traffic and B07 no Smiler shadow.
- **Captures:** OFF / LOW / MEDIUM / HIGH of 11 scenes for SH6 and SH7 (`visibility/`). The darkness overlay is unchanged
  across the tiers in every scene.

## Deliberate approximations

- **Per element, not per pixel.** The mixed-light scale is evaluated per shadow element (a band ≤ 65 px long, or a
  prop's shadow) at one or two points, so an element only partly inside the beam is filled by its average. The bounded
  penumbrae keep elements small.
- **The overlay's colour tint over a carried beam is unchanged.** It still paints the beam's colour on top, as in
  v23.3.6, so the lamp's own light edge inside the beam (part of the original lighting) remains, softened only by what
  the module no longer adds.
- **Your corner fade-in eases appearance only.** A corner disappearing behind another pillar goes at once (the region
  turns dark in the overlay at the same moment).
