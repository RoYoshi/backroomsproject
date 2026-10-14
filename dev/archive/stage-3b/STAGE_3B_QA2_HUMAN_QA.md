# Stage 3B QA2: the four-room slice, faster and canon-checked

**Status: `STAGE 3B QA2 HUMAN-QA CANDIDATE — WAITING FOR USER`**

This is a refinement of QA1 driven by your feedback. It is not a restart and not the full map.
- **Still four rooms:** YELLOW HALL, HUMMING ROOMS, BLACKOUT ZONE and PILLAR HALL. Everything else keeps the old look.
- **No verdict assumed:** you have not approved or rejected Stage 3B, and nothing here assumes you have. The performance, the props and the walls all wait for your verdict.

- **Branch:** `stage-3b-remaster`. The commit is in `STAGE_3B_QA2_PACKAGE_RECEIPT.txt`.
- **Ancestry:**
  - QA1 `24850ef`;
  - BR-RoLE 1.0 `b86966b`;
  - gameplay v23.3.6 `f2805bb`.
- **Untouched:** `main`.
- **To start:** run `run_linux.sh` / `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000>. The spawn is in YELLOW HALL.

## What changed since QA1

1. **Performance (your biggest concern).**
   - **The cause:** QA1 stacked five or more room-sized layers per remastered room, about one extra full screen of pixels for your GPU every frame.
   - **The fix:** each room's art is now baked once into cached textures, so a room is one layer on screen, about what the old carpet cost.
   - **The result:** with the remaster on, the pixels drawn now equal the old look in every room. The details are in `STAGE_3B_QA2_PERFORMANCE.md`.
2. **Props, audited against canon.** The audit is in `STAGE_3B_PROP_CANON_AUDIT.md`.
   - **Removed:**
     - the phone, papers, service bell, taped cable, binder and cup rings;
     - the drifting paper and duct tape;
     - the dead insects in the lights;
     - the carpet roll seams (canon carpet is "a single continuous piece").
   - **Bare architecture:** the counters and the table are now bare.
   - **Added, rarely:** faint **furniture indents** in the carpet, where something once stood.
   - **HUMMING ROOMS** is no longer an office. It is where the hum lives: yellowed lenses, aged tubes, outlets and a few junction boxes on the walls.
3. **Props occupy space.** The counters have a shaded front face, a lit bevel and end faces. The table has a thick lit front edge, a deeper gap and grounded legs. Footprints are unchanged.
4. **Walls and surfaces as receivers.** The floor and every run of papered wall in the four rooms are now *surfaces*:
   - **Clipped, attached marks:** every mark (damp, mildew, outlets, stains) is drawn in that surface's own coordinates and clipped to it, so it stays attached when you move.
   - **Lit like the wall:** BR-RoLE lights a mark exactly like the wall or carpet under it. There is no second lighting.
   - **Ready for later, not built now:** the same receiver can later take dynamic decals such as blood, bounded and capped. No blood or gore logic was built.
5. **The wall-depth experiment (F9)** is **deferred / non-evaluable.** It is not required for this QA, and it is neither approved nor rejected.

## Comparing

| what | how |
|---|---|
| **remaster ON / OFF, live** | open `http://localhost:8000/?dev3b=1` and press **F8**. The readout at the bottom left shows the state. |
| remaster OFF (the exact old look) | `http://localhost:8000/?remaster=off` in a second tab |
| **LOW / MEDIUM / HIGH** | SETTINGS ▸ CUSTOMIZE ▸ LIGHTING. The remaster follows BR-RoLE's tier and rebuilds in about a second. MEDIUM is the main target. |
| stains and marks on / off | **Shift+F8** (with `?dev3b=1`) |
| the surface receiver | **Shift+F9** (with `?dev3b=1`): see "Judging walls" below |

These are QA tools, not player settings. In normal play (no `?dev3b`) none of the readout or keys exist.

## Judging performance (please do this first)

Use your usual machine, browser, window size and fullscreen state, at **MEDIUM**.

1. Open `http://localhost:8000/?dev3b=1`. Two lines at the bottom left read like this:
   ```
   REMASTER ON [F8] · DECALS ON [Shift+F8] · PROOF MARK [Shift+F9] (0) · WALL DEPTH OFF [F9, deferred] · MEDIUM
   frame 16.7 ms (60 fps) · scene GPU 1.84 ms · rooms 1 · chunks 8 shown / 14 cached · 2.9 MPx @ 1.18 tx/px · bake 0.6 ms (max 3.1)
   ```
   - **frame:** your real frame time, smoothed. If it sits at your monitor's refresh rate (16.7 ms at 60 Hz), you are capped, and it can't show a difference. Use the GPU number.
   - **scene GPU:** what the game's scene costs your graphics card, where your browser can measure it. This is the best on/off comparison. If it says `n/a`, your browser doesn't expose the timer; use frame time and feel.
2. **Stand still in each of the four rooms** (spawn in YELLOW HALL, the HUMMING ROOMS counter, BLACKOUT ZONE with your flashlight, the middle of PILLAR HALL). At each spot:
   - Press **F8** a few times. Wait 2–3 seconds on each side and note frame and scene GPU with the remaster ON and OFF.
   - Then **walk around** with it ON. Do you feel any slowdown compared with OFF, or compared with QA1?
3. Repeat one room at **LOW** and **HIGH**.
4. **The first time you see a remastered room** (and right after changing the tier), its textures are baked. Tell me if you notice a one-off hitch there; `bake … (max …)` shows the longest one.
5. **If you can, try the phone or a weaker machine at LOW.**

Please tell me:
- your hardware: GPU, or laptop and phone model;
- your browser;
- the tier;
- the ON and OFF numbers, or just "no difference I can feel".

## Judging walls and surfaces

1. With `?dev3b=1`, stand facing a papered wall in any remastered room, close enough that it fills part of your view.
2. Press **Shift+F9**: a neutral chalk target (a **test mark**, never blood) appears on the wall in front of you.
   - If no wall is ahead, it appears on the floor ahead instead.
   - Each press adds one more. At most 12 stay on one surface; the oldest go first.
3. Now look at four things:
   - **Attached:** walk around it; it must stay glued to the wall, not slide with the camera.
   - **Clipped:** it never spills past the wall's band or around a corner.
   - **Lit like the wall:** sweep your flashlight across it, and try it with the lamps on and in BLACKOUT ZONE. It should brighten and darken exactly like the wallpaper around it.
   - **Free:** the frame time should not change after stamping.
4. Also look at the existing wall marks (damp wicking up, mildew, lifted seams, outlets) under your light.
5. Reload the page to clear the test marks.

> Only the lowest ~24 px of a wall face is ever visible, because the game's sight shape enters walls by 24 px. That is why the marks live low on the wall.

## Judging props and canon

**Questions while you play:**
- Do the rooms read as **empty and liminal**, or still like an abandoned office?
- Do the bare counters and the bare table feel like **built-in architecture** that occupies space?
- Is anything still **out of place for Level 0**?

**Things to look at:**
- **Furniture indents:** faint post marks or a faint rectangle crushed into the carpet. Two are placed by hand (the south part of YELLOW HALL, the east side of PILLAR HALL); the rest are rare seeded ones, most often in HUMMING ROOMS, and there is one just south of the BLACKOUT ZONE table.
- **Kept, but in question:**
  - the junction boxes (HUMMING ROOMS walls);
  - the burnt outlet (BLACKOUT ZONE);
  - the fallen ceiling tiles (BLACKOUT ZONE, PILLAR HALL);
  - the metal strips at doorways.
- **The audit itself:** `STAGE_3B_PROP_CANON_AUDIT.md` says, for each family, whether it is canon, supported, a gameplay inference or removed, and why.

## Tour (about 15 minutes, MEDIUM, `?dev3b=1`)

| # | where | look at |
|---|---|---|
| 1 | **YELLOW HALL** spawn | performance readout, F8 on/off; the seamless carpet (no seam lines); the bare counter (east), its front face and bevel |
| 2 | YELLOW HALL west partition | the crawl hole still reads as a hole; crawl through |
| 3 | a YELLOW HALL wall | Shift+F9: the test mark, attached, clipped and lit like the wall |
| 4 | **HUMMING ROOMS** (north-centre) | no office clutter; yellowed lenses; outlets and junction boxes low on the walls; worn paths; an indent or two |
| 5 | **BLACKOUT ZONE** (south-west), flashlight | dead and missing housings overhead, tube glass, a fallen tile, a burnt outlet; the bare table and its gap; damp and mildew |
| 6 | **PILLAR HALL** (north-east) | papered columns and damp at their bases; walk around them (collision as before) |
| 7 | each doorway out of the slice | the metal strip where the new carpet meets the old corridor |
| 8 | SETTINGS: LOW, then HIGH, then back to MEDIUM | the same look, the readout, any hitch while it rebuilds |
| 9 | play a few minutes with Hounds or Smilers about | readability of entities, items and your light; any stutter |

## Questions

Please answer with yes / no / notes, and say which tier and device you used.

1. **Performance:** compared with the old look (F8 OFF), is there still a slowdown you can feel? Compared with QA1? (Numbers from the readout if you can.)
2. Is LOW clearly fine on your weakest device?
3. Do the four rooms now read as **empty, repetitive and liminal**, not a furnished abandoned office?
4. Are the bare counters and table right? Should they read even more like built-in architecture?
5. Keep or drop:
   - the **furniture indents**;
   - the **junction boxes**;
   - the **burnt outlet**;
   - the **fallen ceiling tiles**;
   - the **doorway strips**.
6. Does the seamless carpet still feel rich enough without the roll seams?
7. **Walls:** does the test mark (Shift+F9) stay attached, clipped, and lit exactly like the wallpaper? Is this the right foundation for future blood decals?
8. Do the props now look like they **occupy space**?
9. Is the art style still the one you liked in QA1?
10. Anything that hurts readability (entities, items, crawl holes, your light)?
11. Is this ready to become the basis for the rest of Level 0, or does the slice need another pass first? Expanding the map still needs your explicit go-ahead.

## Known limits

- **Only four rooms.** Corridors and the other eight rooms keep the old art. The props in those rooms (shelf, low walls, railing, machine, bench, windows, other holes) still need their own canon audit before they are remastered.
- **F9 wall depth: deferred, non-evaluable.** It remains a DEV experiment, off by default. Its faces are narrower than the legacy bands, so wall marks may overhang it.
- **No dynamic decals in play.** The receiver exists, but nothing in the game stamps marks yet. Blood belongs to the later gore/death stage.
- **Doorway strips** are a slice-boundary cover only. They go away when the corridors are remastered.
- **Performance here was measured in software rendering.** Your real-machine retest decides.
- **Found, not changed:** `server.js` doesn't serve `camera_policy.js` or `timing_policy.js` (404), so the camera uses its fixed fallback scale. This is reserved for the Stage 3B-N camera-policy check.
