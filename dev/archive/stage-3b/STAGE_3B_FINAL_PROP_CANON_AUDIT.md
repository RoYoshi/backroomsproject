# Stage 3B final: prop, dressing and room canon audit (full Level 0)

**Scope:** every prop, dressing, structure and room-identity family the full-map remaster draws.
- **Carried from QA2, unchanged:** the four approved rooms' families, audited in `STAGE_3B_PROP_CANON_AUDIT.md`.
- **New here:** everything the remaining eight rooms and the corridors add.

**Status:** this is my audit. You remain the authority on what fits Level 0.

**Method:**
- Written **before** the new prop art, as the pack asks, and kept in step with what the renderer draws.
- The renderer refuses any dressing kind classed AVOID (the `kinds` table in `assets/level0_visuals.js`). A unit check (V08) guards it.

## Sources

**1. Canon authority: the Backrooms Wikidot, "Level 0 – Threshold"**

<https://backrooms-wiki.wikidot.com/level-0>, revision 50, read again for this stage on 6 Oct 2026. Quoted:

| topic | quotes |
|---|---|
| **carpets** | "Almost the entirety of the floors within Level 0 are covered in a tight-knit, Berber-style carpeting"; "persistent moisture"; "The flooring is seamless, consisting of a single continuous piece of carpet." |
| **layout** | "mile after mile of randomly segmented rooms, hallways, and stairs"; "an ever-changing patchwork of architectural absurdity" |
| **arches** | "pale walls with archway holes decorating them"; "Carpet depth is notably extensive in these sections"; "Archway rooms are the most stable" |
| **pillars** | "massive pillar rooms … in a lattice or grid pattern"; "Carpets tend to be shallower in these sections" |
| **holes** | "pits that lead deep into the floor"; "they appear in close groups and form in a grid pattern" |
| **blackout** | "entire sections of Level 0 devoid of lighting"; "rough textures on the walls"; "The floors here may be recessed, often filling with ankle-deep fluid." |
| **red rooms** | "One can gauge distance to the red rooms by either recognizing the color shift to red or if the carpets become thick, sticky, and very coarse."; "Another indication is sections of wallpaper peeling to reveal a crimson color underneath." |
| **tone** | a "barren, sprawling maze"; a "vacant stillness" |

It does **not** mention furniture of any kind, shelves, machines, benches, railings, windows, ceiling tiles, outlets, ducts or concrete.

**2. Secondary only: the Backrooms Fandom wiki, "Level 0"**

<https://backrooms.fandom.com/wiki/Level_0>. This is a separate community and not the authority; I use it to support interpretations, never as canon fact. It describes:
- "scattered electrical outlets";
- a "drop ceiling";
- "worn, moist carpeting";
- "the back rooms of a dated retail outlet";
- carpet "indents" suggesting furniture "may have been present at some point";
- "devoid of all life".

**3. The game itself (v23.3.6), and what it fixes:**
- **Physical footprints:** `world.js` and the bundle's room, pit and pillar tables.
- **Gameplay surfaces:** carpet; DEEP CARPET deep carpet; LONG ROOM concrete; DAMP ROOMS wet tile.
- **BR-RoLE prop heights:** counter 70, shelf 46, low wall 84, machine 96, table 76, bench 46, window sill 40. The railing and the holes cast nothing.

Stage 3B cannot remove, move or reshape any of this. It only decides how the game's things look, and what (very little) sits on them.

**Classes (as QA2):**
- **CONFIRMED CANON:** explicit in the Wikidot article.
- **SUPPORTED INTERPRETATION:** consistent with the described architecture, materials and infrastructure.
- **GAMEPLAY INFERENCE:** exists because the game needs it; drawn in the most restrained, architectural way.
- **AVOID / TOO SPECULATIVE:** office, shop or occupation clutter. Never drawn.

## The remaining gameplay props (the families QA2 left open)

| prop | where | the game needs | class | treatment | why this one |
|---|---|---|---|---|---|
| **L2 "shelf"** | REPEATING ROOMS | waist-high (46), vaultable, conceals a crouching player | GAMEPLAY INFERENCE (high risk: storage furniture) | **a fallen section of ceiling ductwork:** a dented galvanised duct lying on the carpet, one end torn open, a hanger strap still bolted to it. Nothing stored, no box, no labels. | The legacy art is a toppled steel shelf with a spilled cardboard box, which reads as a stockroom. A fallen duct keeps the same footprint, height and cover, but tells you about the *building* (infrastructure decay, the policy's preferred category) instead of about stock or shopkeepers. *Alternative if you prefer the game's own name:* a bare, empty steel shelf frame on its side. |
| **L3, L7 low walls** | SEGMENTED ROOMS, RED ROOMS | waist-to-chest partition (84), vaultable, conceals | SUPPORTED INTERPRETATION ("randomly segmented rooms", "architectural absurdity") | **a half-height partition:** the room's own wallpaper and baseboard on both faces, a plaster-and-wood cap with a chipped edge; in RED ROOMS the paper peels to crimson | It is architecture, not furniture: the same walls, cut short. |
| **L5 railing** | ARCH GALLERY | low see-through barrier, vaultable, hides nothing, casts nothing | GAMEPLAY INFERENCE | **a painted steel guard rail:** two tubular rails on posts with bolted base plates, the paint worn where hands go | Infrastructure. It stays thin and see-through, as the game treats it. |
| **L6 counter** | DAMP ROOMS | as QA2 counters (70, conceals) | GAMEPLAY INFERENCE (same family as L1 / L4, approved in QA2) | **the QA2 bare built-in counter,** plus damp: a tide line and swollen laminate along the kick panel | Same family; the room's damp marks it. |
| **L8 "machine"** | DEEP CARPET | waist-to-chest (96), vaultable, does **not** conceal | GAMEPLAY INFERENCE (high risk: an industrial object) | **a dead mechanical cabinet** (building services, like a unit ventilator): louvred painted sheet metal, rust streaks, a dark, unlit indicator, a condensate stain soaked into the carpet. No hazard stripes, no labels, no light. | The legacy hazard stripes and the lit red lamp make it read as an active machine. A dead, louvred building-services cabinet is infrastructure, and its louvres suit "no place to hide behind". |
| **U2 bench** | SEGMENTED ROOMS | crawl-under (46), blocks walking, does not conceal | GAMEPLAY INFERENCE (high risk: seating) | **a bare built-in bench:** one long worn slab on two steel pedestals bolted to the carpet, a dark gap beneath. No cushions, nothing on it. | Reading as part of the building (bolted, institutional) rather than as loose furniture; the gap must stay readable because you crawl under it. |
| **G2, G3, G5, G6 crawl holes** | REPEATING, SEGMENTED, ARCH GALLERY, DAMP | one-cell crawl hole carved through a partition | GAMEPLAY INFERENCE (the hole); SUPPORTED INTERPRETATION (the debris) | **the QA2 crawl hole** (broken board edges, cut studs, insulation, a few crumbs), its paper edge in the room's own finish (pale in ARCH GALLERY); in DAMP ROOMS the insulation is wet and darker | Same family as G1 / G4, approved in QA2. They must stay clearly readable as holes. |
| **W1 window** | REPEATING ROOMS | an opening in a partition with a 40-high sill you vault; you see through it | SUPPORTED INTERPRETATION ("architectural absurdity": an interior opening, no glass) | **an unglazed interior opening:** a painted sill, plain jambs in the room's wallpaper, the paper torn back at one corner | Architecture; there was never glass in the game. |
| **W2 window** | ARCH GALLERY, in a partition | as W1 | the opening: **CONFIRMED CANON** ("archway holes"); the sill: GAMEPLAY INFERENCE | **an archway hole:** pale arched jambs (pilasters) either side of the opening, a pale stone-like sill across it | Canon puts archway holes in exactly this kind of room. |

## Structures and room identities (new)

| family | where | class | treatment |
|---|---|---|---|
| **Pits** (`Mc`) | LONG ROOM, two rows of five | **CONFIRMED CANON** ("pits that lead deep into the floor … in a grid pattern") | Pitch-black voids with a broken concrete lip and the far inner wall just visible. **No wallpaper or baseboard around them:** they are holes in the floor, not walls. This matches the game, where they block walking but not sight, and BR-RoLE, which casts nothing from them. The legacy art drew them as flat black squares. |
| **Archways** | ARCH GALLERY, at the openings in its partitions | **CONFIRMED CANON** ("pale walls with archway holes") | Pale wallpaper; pilaster trims on the jamb faces either side of each opening; a soft soffit shade across the floor where an arch passes overhead. Nothing is drawn above the actors: no ceiling-layer arches that could hide an entity. The legacy pale arch outlines painted on the floor are replaced. |
| **Corridors** | the 376 connecting cells | **CONFIRMED CANON** ("hallways") | The same seamless carpet and wallpaper as the rooms (the carpet now runs on unbroken through every doorway); traffic wear along their length; no lamps, as in the game. |
| **REPEATING ROOMS** | room 02 | SUPPORTED INTERPRETATION | The purest, most repeated Level 0: maintained, uniform bays; its one anomaly is the fallen duct. |
| **SEGMENTED ROOMS** | room 03 | SUPPORTED INTERPRETATION ("randomly segmented rooms") | Partitions and the knee wall; moderate wear; the bare bench. |
| **NORTH ROOMS** | room 05 | SUPPORTED INTERPRETATION | Stale and unused: faded paper, dust, damp in the corners, almost no traffic wear. |
| **LONG ROOM floor** | room 06, gameplay **concrete** | GAMEPLAY INFERENCE (canon: "*almost* the entirety" of the floors is carpet) | Bare concrete slab: trowel marks, saw-cut joints, damp darkening, faint tracks of old carpet adhesive (an ambiguous remnant, never a carpet edge or tools). |
| **DAMP ROOMS floor** | room 08, gameplay **wet tile** | the tile: GAMEPLAY INFERENCE; the water: CONFIRMED CANON ("persistent moisture") | Old vinyl floor tiles, yellowed; a few lifted or missing tiles showing black adhesive; standing water films; mildew in the joints; heavy damp wicking up the walls. |
| **DEEP CARPET floor** | room 12, gameplay **deep carpet** | SUPPORTED INTERPRETATION (canon: "Carpet depth is notably extensive" in archway sections) | A deeper, shaggier, darker pile with stronger nap and flattened trails. **ARCH GALLERY itself stays normal pile:** its gameplay surface is ordinary carpet, and a visual must never promise a surface the game does not have. |
| **RED ROOMS** | room 09 | **CONFIRMED CANON** (colour shift to red; thick, sticky, very coarse carpet; wallpaper peeling to crimson) | A coarse, sticky, dark red-brown carpet; paper peeling widely to crimson; and, as canon says you can *gauge distance* by the shift, the corridor carpet and walls drift toward red as you approach its doorways. |

## Fixtures and legacy painting

| family | class | treatment |
|---|---|---|
| Fluorescent troffers in every room (90 lamps) | CONFIRMED CANON (lights); SUPPORTED (troffer form) | The QA2 housings everywhere: yellowed in HUMMING ROOMS, failed in BLACKOUT ZONE, standard elsewhere. Every 13th tube is old, as the game always drew it. |
| Red tubes in RED ROOMS | not kept | The legacy fixture art drew red tubes. Through an unbounded position test, that also caught DEEP CARPET. BR-RoLE lights every lamp in its normal colour, so a red tube would contradict the light it gives. The canon "colour shift to red" is carried by the materials. |
| Painted glow ellipses and dark strips under lamps; room tint rectangles (red, brown, green); the floor blots | not kept | Painted light and flat tints over walls and floor alike. BR-RoLE lights the room; the materials carry identity. This matches QA2. |
| Doorway metal threshold strips | **removed** | A QA2 slice-boundary cover only. The carpet is now one continuous piece through every doorway, as canon says. |
| Where the carpet meets a hard floor (the doorways of LONG ROOM and DAMP ROOMS) | GAMEPLAY INFERENCE (the game's surfaces change there) | The carpet's own bound edge on its side, a soft shade of the pile's thickness on the slab or tile. **No metal strip:** nothing is added that a carpet-to-carpet doorway does not have. |

## Dressing kinds added for the full map

All are flat, static, clipped to their surface, and cast nothing.

| kind | where | class | note |
|---|---|---|---|
| `puddle` | DAMP ROOMS, BLACKOUT-adjacent low spots | CONFIRMED CANON (moisture) | A standing-water film with a soft rim |
| `tilegap` | DAMP ROOMS | SUPPORTED INTERPRETATION | A lifted or missing vinyl tile showing black adhesive |
| `adhesive` | LONG ROOM | GAMEPLAY INFERENCE (sparse) | Faint old carpet-glue tracks on the concrete |
| `crack` | LONG ROOM | SUPPORTED INTERPRETATION | A hairline crack in the slab |
| `condensate` | under the DEEP CARPET cabinet | GAMEPLAY INFERENCE | Water soaked into the pile from the dead unit |
| `soffit` | ARCH GALLERY openings | CONFIRMED CANON (archways) | The arch's shade on the floor |
| `crimsonpeel` | RED ROOMS walls, and walls near them | CONFIRMED CANON | Paper torn back along a seam to the crimson beneath, a curled flap; a dark, brownish crimson, so it reads as the wall under the paper, never as a splash |
| `sticky` | RED ROOMS floor | CONFIRMED CANON ("sticky") | A dark, faintly glossy patch in the pile |
| deep / coarse pile | DEEP CARPET; RED ROOMS and the corridors leading to them | SUPPORTED INTERPRETATION / CONFIRMED CANON | Drawn as an overlay on the one carpet, ramped in from the doorways. DEEP CARPET's pile is flattened along its traffic lanes (an inference). Near RED ROOMS the corridors grow the coarse pile, shift toward red and show crimson peel as you approach (canon: you "gauge distance" by them) |

## Still AVOID: never drawn anywhere

These remain AVOID / TOO SPECULATIVE across the whole map:
- phones;
- papers (on props or drifting);
- binders;
- cups and cup rings;
- service bells;
- taped device cables;
- duct tape;
- dead insects;
- carpet roll seams.

Also never drawn:
- cardboard boxes, the legacy shelf's;
- hazard stripes and lit indicators, the legacy machine's;
- any signage, labels or branding.

## Final pass (3B-F4, on the candidate)

**What the renderer draws, checked (unit check V08):**
- All 32 dressing kinds have a class.
- **Seeded and wall placements** use only: adhesive, crack, crimsonpeel, damp, dampwall, debris (grit), indent, jbox, mildew, mildewwall, outlet, peel, puddle, scorch, scuff, stain, sticky and tilegap.
- **Placed by hand** (`assets/level0_visuals.js`, eight records):
  - from QA2: two furniture indents, a stain, the glass shards and the fallen ceiling tiles;
  - new: the condensate under the DEEP CARPET cabinet.
- **Never drawn:** nothing classed AVOID can be drawn (bell, binder, cable, insects, paper, phone, ring, tape).
- Every prop set is empty, and the carpet is seamless in every archetype.

**The 18 gameplay props are all kept:**
- **Which:** L1–L8, U1, U2, G1–G6, W1 and W2.
- **Footprints:** each sits on its exact `world.js` footprint plus the same contact margin, drawn by the zone that owns its centre (unit check R04).
- **Nothing removed or moved** because canon is silent about it.
- **Casting:** BR-RoLE casts from them exactly as before (R11, and the gameplay freeze).

**Readability in play.** Evidence: `dev/stage-3b/evidence/f4/readability/`; each pair is remaster ON and OFF at the same instant.
- **Crawl holes:** the holes in YELLOW HALL (G1), ARCH GALLERY (G5) and DAMP ROOMS (G6) read as openings, and your beam passes through them.
- **Monsters and wanderers:** Hounds, Smilers and another wanderer read on every new floor (concrete, wet tile, red, deep pile).
- **The item:** the cartograph, the game's one item, carries its own glow and reads on every floor.

**Findings for your verdict** (kept, not changed):
- **DAMP ROOMS' missing tiles** are the darkest marks on any floor.
  - Up close they show the adhesive and its trowel lines and read as floor damage.
  - In the dark they are dark squares. If they ever read as pits to you, they can be lightened.
- **The fallen ceiling tiles** (BLACKOUT ZONE, PILLAR HALL; from QA2, still "in question") are the palest loose shapes on the floor, and they catch your flashlight brightly.
- **RED ROOMS' floor** is a deeper red than the old red-tinted carpet.
  - In its unlit corners, a dark Hound stands out a little less than it did; it is still visible, and any light shows it fully.
  - The fix, if you want one, is a single tone value.

## Questions for you

1. Is the fallen duct right for L2? Or would you rather keep the game's shelf as a bare, empty frame?
2. Do the dead mechanical cabinet (L8) and the bare built-in bench (U2) read as part of the building rather than as furnishing?
3. Is the red shift in the corridors near RED ROOMS a good reading of the canon "colour shift", or too much?
4. Do the ARCH GALLERY archways read without anything overhead?
5. Should LONG ROOM's concrete keep the faint old adhesive tracks?
6. Keep the DAMP ROOMS missing tiles as they are, or make them lighter?
7. RED ROOMS: keep its depth of colour, or lift the floor a little for readability in the dark?
