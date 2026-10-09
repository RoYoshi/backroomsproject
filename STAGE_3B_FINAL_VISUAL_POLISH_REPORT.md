# Stage 3B Final Visual Polish — Report (Stage 3B-L QA2)

**Scope.** This pass fixes only the two remaining issues the user reported:
1. **Wall-corner receiver lighting.** Some corners looked odd, wedge-like or discontinuous.
2. **The night-vision camcorder's infrared.** It is remade around BR-RoLE's lighting rules.

Everything the user accepted in QA1 is kept:
- the 1.25 camera;
- the Level 0 fluorescent look;
- the 170 fixtures and shared lamp truth;
- true black;
- no body glow;
- wall and pillar receivers in general.

No AI, stealth, movement, collision, network-timing, fixture or brightness change was made. The one changed rule is reported below.

| | |
|---|---|
| repository | `RoYoshi/backroomsproject` |
| parent | `stage-3b-l-qa1` `d3ec2269af873dbc381d223ad538a43ba06f5c45`, tree `cffbc3125619170d9a55344b2519042a720a798d`. Both verified on GitHub before work began, and again after every push. |
| camera checkpoint | `stage-3b-n-camera` `b2783b34e1185b30002350f5b482dd8c5e10b000` (tree `bdef2606…`), an ancestor, unchanged |
| branch | `stage-3b-l-qa2`. It did not exist; it was created from exactly `d3ec226`. It was never force-pushed. |
| checkpoints | Q1 `c6e5278f7a6fb3879126f0d979cac20ee0299db7` (tree `917e9849c43837b2e241149457c65ed2e1e438c9`): the corner polish.<br>Q2 `270b60322ae47311d39fdc99ea41b7a6cea2cfc0` (tree `571b0ebb9f88741ed80bec2ce63bef7d27b91fbb`): the infrared.<br>Q3a `3b697c3df2ad9c8bab1cd0e29ee30fb300edc3f9` (tree `fc3c569a5fc716949787dda584addab08a76f244`): an inner-corner correction to the clip, found in the Q3 scenes.<br>Q3b `2b585357d9f04a53b68bf52108c63ae1bae8d9e0` (tree `995c07cab446bdf30697c65c92d69507794c10e4`): a convex-corner correction (the clip, and one receiver fault it exposed), also found in the Q3 scenes.<br>Q3c `1972506ee1edb96f8f8da8ea8ad555662242bca9` (tree `fb2b94819e9fadb7855c2e40130cba8a88a75436`): one clip per band end in the receivers (performance only, pixel-identical).<br>Q3: these documents, the final evidence and the development tools; no game file (its commit and tree are in the package receipt).<br>Each was pushed without force and verified on GitHub. |
| untouched | `main`, `stage-3b-l-qa1`, `stage-3b-l`, `stage-3b-n-camera`, `stage-3b-remaster`, `br-role`, the superseded `stage-3b-n` and `stage-3b-pillar-los`. No Stage 3C branch. |
| package | `THE_FAR_BACKROOMS_STAGE_3B_FINAL_VISUAL_POLISH_HUMAN_QA.zip` (+ `.sha256`). Receipt: `STAGE_3B_FINAL_VISUAL_POLISH_PACKAGE_RECEIPT.txt`. |

The superseded pillar-LOS correction pack was **not** executed, and its branch was not merged or revived. The one idea of its that the corner fix needs (rays at a pillar's outline corners) was re-derived inside QA2's own change.

---

## Q0 — audit: the seams, recorded before anything changed

Full record: `dev/stage-3b-l-qa2/evidence/q0_audit.md`.

### Issue 1: corners

Reproduced in the engine with close-ups of convex and inner wall corners and a pillar corner, under a flashlight sweep and under fluorescent light. The photos the user supplied show the same thing: a face thinning to a sliver along a wall, with a lighter block at its end.

There were three causes, all in presentation:

| seam | where | what it did |
|---|---|---|
| **blocker padding in the darkness clip** | the bundle's sight polygon `Hl(x, y, 700, 24)` | The clip went 24 px past each ray's hit *along the ray*. Seen square-on that is 24 px of the face; at a slant only 24 × sin(angle). So a face thinned to a **wedge** toward its far end, two faces met in a **notch**, and near a corner the padding ran on into the face around it and onto **floor the player cannot see**. Measured over 168 poses (the game's own code, node): 25 873 hidden-floor samples inside the parent's clip; seen face bands covered 64 % at a slant, 73 % near corners, 17 % along a side face seen at a grazing angle. |
| **face ownership at corner endpoints** | BR-RoLE `buildBands` (QA1) | Rectangular bands. At a convex corner the side face stopped short and the front or back face owned the whole corner square, while the art draws the corner **mitred**. So a side lit differently showed a block of the other face's light at its end. At an inner corner neither band reached the corner block, which stayed dark: a **notch**. |
| **receiver segmentation** | BR-RoLE `extrude` | A carried light's face light came in 32 px pieces at one facing value each. Close to a wall, the steps showed. |

Not causes: the shadow system, composition order, anti-aliasing / mask blending, lamp brightness.

### Issue 2: night vision

How the parent handled the infrared:
- **The picture.** `camcorder.js` `irDraw` / `peerIR` drew six stacked fans with the bundle's `mk` (rays to `Uc − 1`) plus a 70 px disc at the lens, into the overlay after BR-RoLE. The result was a **stepped cone with a rim** at each fan's range, and **no light on wall or pillar faces** (the fans stop 1 px short of every wall). It had no penumbra from the lens and no prop shadows.
- **The reading** (`irFrom`: an entity's readability, `nvRead`; and `light.js`'s presentation sample through `irAt`) used a different, narrower profile: a hard step from 1 to 0.45 at the core's edge, and a straight ramp over the last 30 % of the range.
- **BR-RoLE** excluded the camcorder from the visible carried lights, its own and other players'. It scaled the lamps by the sensor gain (1.45) while night vision was on.
- **The gameplay boundary.** `server.js` keeps the infrared level on the connection, never on the simulated player; `sim.js` and `ai.js` never name it.

---

## Q1 — corner receiver polish (`c6e5278`)

### 1. The darkness clip (`assets/index-DKbV5Nv9.js`: only `Hl`)

`dev/stage-3b-l-qa2/hl_qa2.js` is the readable source. `apply_hl.py` puts it into the parent's bundle text in place of `Hl` and nothing else (test L01).

For `r > 0` (the darkness clip), a ray that stops at a wall or pillar face goes on into it **only inside that face's band as the art draws it**:
- 24 px deep, measured square to the face. That is the same 24 px seen square-on, now at every angle.
- Between the face's mitred ends: the remaster's mitres, the same diagonals the receivers use.
- Only over the stretch of the face the player really sees.

Where it leaves that band across a mitre, it goes on through the neighbouring face's band if the player sees that face too. Seen along a side face toward its convex corner, it may cross the front face's own band, inside its art depth, to reach the side band's mitre; this happens only where the player sees the front face across the whole corner square. It never goes into a face turned away and never out of the blocker.

Events added:
- rays at the band's inner corners;
- rays where its edges cross the sight limit;
- rays at a pillar's outline corners, in both polygons (the "a ± ε" pair; a pillar's hidden wedge pivots on them).

Cost controls:
- the clip reuses the rays the entity mask cast from the same point a moment earlier (`Uc` is exact and its tables static: the same result);
- the faces are indexed once by cell and by block;
- a pillar's far and hidden corners are skipped.

Unchanged:
- `Uc` (AI / light / collision truth), `Vl` and the call sites;
- the entity mask (`r = 0`) is byte-identical to the parent's away from pillars;
- near pillars it gains only the outline-corner rays, so a creature at a pillar's corner is masked by the pillar's real outline.

### 2. The receivers (`assets/br-role.js`)

- `buildBands` gives every face its whole run, and `S.bandM` the mitre at each end:
  - convex (+): the band ends on the diagonal from the corner to where the two bands meet inside the block;
  - inner (−): it goes on into the corner block, to the same diagonal.
- `bandPoly(j)` is a band's mitred outline.
- `extrude`:
  - draws a band's end pieces inside that outline (Q3b: every piece that reaches over a convex end's mitre; Q3c: one clip for each end's pieces);
  - at an inner corner, stretches the last strip piece over the corner block;
  - sizes the pieces by how fast the facing changes (`FACE.da` 0.04 on average, at most 4× the pieces).
- `dev/br-role/test_br_role.js` **U02**: a band's mitred outline is now an allowed clip, alongside a light's own pixel box. It is still never a visibility polygon. This is the only change to that file.

### Q1 evidence (rerun on the final code, `evidence/q3/`)

**`los_qa2_tests.js` L01–L12, 12/12** (node, the game's own code: 168 poses, 1 288 grazing views, 1 643 views of convex corners):

| check | QA2 | QA1 parent |
|---|---|---|
| hidden floor inside the clip (L05) | **0** samples | 25 873 |
| wall / pillar points in the clip outside a seen face's band (L05) | 0 of 1 254 486 | — |
| a face's band seen at a slant (L06) | **99.68 %** | 64.13 % |
| faces turned away inside the clip (L07) | 0 of 76 142 | — |
| band points within 30 px of a face's end (L08) | **99.56 %** | 73.42 % |
| a side face seen along its length, to its corner's mitre (L10) | **100 %** of 43 671 | 17.39 % |
| a convex corner seen with both faces: the whole 24 px L (L12) | **100.00 %** of 223 040 | 77.52 % |
| cracks (a ray stopping short between rays that go on, L11) | 0 | 0 |
| square-on faces exactly as before (L04); `Uc`, tables and 4 000 random rays identical (L02); entity mask byte-identical away from pillars, every parent ray kept near them (L03); bounded ray count (L09) | yes | — |

**`receivers_qa2.js`** (browser, BR-RoLE's own buffers):
- **K1**: all 456 corners where two faces meet share one mitre, with no gap and no overlap.
- **F1–F3, C1–C2** (QA1's receiver checks, sampled inside each face's own share of a corner): all pass.
- **K2 (inner corners)**: the corner block is lit with its two faces (block ÷ bands 0.72–1.16 across a flashlight sweep, 0.77 lamp-lit). The parent's block was 0.00.
- **K3 (convex corners, wall and pillar, flashlight sweeps)**: each face's share of the corner carries its own face's light (light ÷ its own foot within 0.15 of its own facing) in **483/487** samples (479 before Q3b's receiver fix). The parent managed 256/487.
- **K4 (along a face, a flashlight 28 px from the wall)**: the largest step in the face light is 0.061; the parent's 32 px pieces gave 0.075.
- **K5 (no around-the-corner reveal, lamps on, the clip itself)**: 0 hidden floor and 0 turned-away band in the clip, at a convex wall corner and at a pillar corner. The parent showed 27 and 38 hidden-floor samples, and 23 and 34 band samples. The seen band is all inside.

**A/B vs the parent** (`ab_qa2.js`: the same frozen 1920×1080 frame in both builds, NV off; five scenes: a lamp-lit room, PILLAR HALL, a corridor, a flashlight across a convex corner, a lantern by an inner corner). Open floor inside both clips:
- **more than 20 px from any wall or pillar: identical** in every scene (0 pixels differ);
- 4–20 px from one: identical under carried lights; in lamp-lit rooms at most **2/255**, where the 0.75-scale light buffer and the lamps' caches (0.45 and 0.11 texels per px) smooth a face's light onto the floor at its foot;
- within 4 px of a face: the face bands' own edges, which differ by design (up to 30/255 at a foot's antialiased edge).

**Occlusion audit** (`occlusion_qa2.js`: 25 lamps, every texel of their core and far caches against the game's own ray query): **5/5**, with no light through geometry in 1 718 498 core texels or 180 357 far texels. The Q2 build fails O1: 329 texels at 22 of the 25 lamps, up to 183/255. That is the receiver fault Q3b fixed (a face's light in the share of a turned-away face across a deep mitre). The audit now counts a texel that straddles a band's outline as on the band: one texel, its cache's resolution.

**Camera** 7/7 and 12/12. **BR-RoLE unit** 32/32.

Before/after close-ups: `dev/stage-3b-l-qa2/evidence/q1/corners_before_after_{a,b}.jpg`, and the human-QA scenes A–C in the package.

---

## Q2 — the camcorder's infrared as a BR-RoLE light (`270b603`)

### The new path

While **this player's night-vision sensor is on**, BR-RoLE draws every emitter the sensor sees as a light of its own (`assets/br-role.js` `prepIR` / `irLight`). The emitters come from `window.__cam.irLights`: yours, then the nearest other camcorders, within the tier's peer cap. Each emitter gets:
- its field;
- the shadows walls, pillars and props cast into it from the lens (BR-RoLE's `castInto`, the tier's source points);
- the wall and pillar faces it reaches (the mitred receivers);
- the small spill at the lens, shadowed from the lens.

It is added to the light buffer, inside the line of sight. It has no colour: the camcorder's own overlay tints the picture green.

Gating:
- nothing is computed while the sensor is off;
- the old stacked fans stand down while BR-RoLE draws the infrared (`camcorder.js` `irDraw` / `peerIR` check `__brRole.ir`), and draw as before if BR-RoLE is off or disabled.

### The picture's profile (`__cam.irProfile`)

It is **v23's own picture made smooth**: the six fans' coverage (the core under all six, the outer field under fewer, each fan out to its own range).
- Each fan's edge is eased over the gap to the next, so the steps blend.
- The widest fan's edge is eased over twice that: a soft rim.
- Each fan's radial ends in a smooth tail, so there is no rim at the range.
- Range, power, core and arc are the CFG's, unchanged.

On the beam's axis it matches v23's darkness to within a few /255 (`ir_test.py` profile):
- QA2 HIGH 39 / 61 / 103 / 147 / 205 / 251;
- the parent 42 / 59 / 102 / 145 / 197 / 245 (at 80–520 px).

(During Q2 the first version used the reading's narrower profile. The beam looked visibly narrower than v23's, so the picture now follows v23's own coverage.)

### The one changed rule (reported)

`irFrom`, the sensor's *reading* of the infrared, decides how legible a concealing creature is under night vision. It keeps v23's profile with its two hard places eased:
- the step from 1 to 0.45 at the core's edge, eased over ±0.075 rad;
- the straight ramp over the last 30 % of the range, now a smooth (Hermite) tail.

`nv_profile_qa2.js` **P1** shows it identical to v23 everywhere else (0 samples differ). Inside the eased places it differs by up to 0.20 (LOW) / 0.24 (HIGH), in place of a jump of that size.

Range, power, core, arc, the lens spill and wall occlusion are unchanged (**P3**). No other entity or night-vision rule changed:
- the readability along the beam / to the side / past the range, with NV on and off, is identical: `ir_test.py` R9, 0.967 / 0.04 / 0 / 0.04 on the final code (0.967–0.969 across runs; the parent's 0.969 / 0.04 / 0 / 0.04);
- heat, overheating, bloom, the sensor gain, zoom, the HUD and the keys are untouched.

### Gameplay boundary: night vision is presentation only (exact proof)

1. `server.js` (byte-identical to the parent) stores the level on the **connection**: `me.ir = me.raised && kindOf(m.k) === 'camcorder' ? … : 0`, "never on the player the simulation / AI sees". It relays the level to the other clients only for their pictures.
2. `ai.js` and `sim.js` (byte-identical) never name it: 0 occurrences in code (`s_ir.js` **I1**).
3. Toggling infrared OFF vs HIGH, written onto the players under every name the client uses, changes no AI decision: 4/4 worlds identical over 1 500 ticks (**I2**). A raised camcorder is no light to the AI (**I3**).
4. `ir_net.js` N1–N4: on the wire it is presentation shared between players, clamped, and only for a raised camcorder.
5. BR-RoLE's infrared path reads only `window.__cam.irLights` and writes only BR-RoLE's own buffers. BR-RoLE never sends anything and never writes game state.
6. `server.js`, `sim.js`, `ai.js`, `light.js`, `move.js`, `death_srv.js` and `mp.js` are byte-identical to the parent (package receipt).

### Q2 / Q3 evidence

**`nv_qa2.js` N1–N7** (browser, the halls' fluorescents forced off, so only the infrared lights anything; the parent measured the same way on the overlay):

| check | QA2 | QA1 parent |
|---|---|---|
| **N1 (D)** a wall's face in the infrared, 240 px from the lens | lit like the floor at its foot: 40.2/255 where the floor has 41.2 (13/13 lit samples) | 0/255 (the fans stop short of walls) |
| N1, the wall's far side | 0 | 0 |
| N1, swept away | dark (0) | — |
| **N2 (E)** the floor behind a pillar | 0, all 85 points hidden from the lens | black |
| N2, the floor beside it in the cone | lit (21.7/255) | — |
| N2, the pillar's face turned to the lens | 129.7/255 | 0 |
| N2, its far face | 0 | 0 |
| **N3 (F)** beyond a wall 94 px in front of the lens | 0 light, black | black |
| **N4 (G)** along the beam, largest 4 px step | 5/255 (LOW), 4/255 (HIGH) | 5/255, 4/255 |
| N4, across it, largest step per 0.01 rad | 6.6 % (LOW), 6.3 % (HIGH) of its peak | 18.9 % (LOW), 21.2 % (HIGH): the stacked fans' edges |
| N4, where the light ends | 324 px (LOW, range 340), 552 px (HIGH, range 560), through a smooth tail | 324 px, 532 px, at each fan's edge |
| **N5** body glow | none: NV on with the emitter off adds nothing; nothing behind the camcorder past its spill | — |
| **N6** NV off | nothing drawn; BR-RoLE computes no infrared | — |
| **N7** LOW / MEDIUM / HIGH | the same infrared at every tier: \|LOW − MEDIUM\| mean 0.44 / p95 2 /255, \|HIGH − MEDIUM\| mean 0.38 / p95 1 /255 over 301 points | — |

Further checks:
- `dev/tests/ir_test.py`, Part 2's infrared rules in the browser, **R1–R9 all pass**. This includes R7: another camcorder's infrared is seen only through this player's own sensor.
- `s_ir.js` 3/3, `ir_net.js` 4/4, `nv_profile_qa2.js` 3/3, BR-RoLE unit 32/32, camera 7/7 and 12/12.

---

## Q3a / Q3b / Q3c — two corner corrections found in the Q3 scenes, and a follow-up

The two corrections were found while capturing the human-QA scenes. Both change `Hl` (`hl_qa2.js`, put in by `apply_hl.py`); Q3b also fixes one receiver fault that its change exposed. Q3c makes Q3b's receiver fix cheaper without changing a pixel.

**Q3a, inner corners (`3b697c3`; scene A4, an inner corner under a flashlight).**
- *The problem.* At an inner corner, the clip ran a face's band on into the corner block as far as the *neighbouring* face's art is deep. Wherever the two faces' depths differ (a wall's south face is 46 px, its east and west faces 27 px), that end was not the block's diagonal. So one face's 24 px clip band stuck out past the other's: an "ear".
- *The fix.* Each face's band now goes on into the corner block only as far as it is deep itself. The two bands meet on the block's own diagonal: an L, as the art draws the corner.
- The same commit also has the capture helpers hide the glitch overlay (`#glitchFx`, `#glitchTear`). The server places it per run, and it otherwise tainted some frozen scenes.

**Q3b, convex corners seen with both faces (`2b58535`; scenes A2, A3 and B1).**
- *The problem.* The clip shows 24 px of every face, but it ended each face's band on the art's mitre. A wall's south face is drawn 46 px deep, so at its corners the art's mitre runs steeply into the side face's column. The side band was cut along that mitre, while the south band stopped at 24 px. Between them was a black triangle up to about 10 × 17 px: a **notch** at the joint, where the corner should read as one piece.
- *The fix.* Where the player sees both faces of a convex corner right to the corner, the two 24 px bands meet on their own diagonal: the whole 24 px L, with the art's mitre drawn inside it. Where only one face is seen, its band still ends on the art's mitre, so nothing of the face turned away is shown (L07, K5).
- One more ray at each such corner's L, where both its faces are turned to the player.
- *And the receivers* (`assets/br-role.js` `extrude`). Showing the whole joint exposed an older fault inside it. BR-RoLE drew only a band's *last* piece inside its mitred outline. A wall's south-face mitre runs 46 px along the side face, so the side face's pieces before the last one lit the south face's share of the joint with the side face's light: a bright triangle in A2. Now every piece that reaches over a convex end's mitre is drawn inside the outline. Each face's share of the joint carries its own light (measured at the A2 corner: the south share 0.22–0.23, as the south band; the side face's share 0.43–0.64).
- New check **L12**: 400 convex corners from 1 643 viewpoints in front of them. Band points within 40 px of the corner on either face come out at **100.00 %** inside the clip (223 040 points). The same check on Q3a gives 96.70 %, and on the parent 77.52 %.
- **L05** now also accepts points inside such a corner's 24 px L. That is the same 24 px of a face turned to the player as everywhere else along it, and still never floor or a face turned away.

**Q3c (`1972506`), performance only.** Q3b clips every piece over a convex end's mitre, which can be several pieces where a light is close to a wall. `extrude` now sets the clip once for each end's run of pieces. The pixels are identical: in `ab_qa2.js` against Q3b, 0 of 2 073 600 pixels differ in each of four frozen frames (a lamp-lit room, PILLAR HALL, a flashlight across a convex corner, a lantern by an inner corner).

All the Q1 and Q2 checks were rerun on the final code (Q3c; `evidence/q3/`), and the figures in this report are from those reruns. The human-QA scenes and the A/B against the parent were captured on Q3b, which draws the same pixels.

---

## Visible world parity (NV off) and tiers

- **QA2 vs the QA1 parent, NV off.** The only differences are the darkness clip (the corner fix) and the wall and pillar face bands. Open floor more than 20 px from a wall is identical; full figures are in the A/B section above and in `evidence/q3/ab_parent.*`.
- **The infrared commit with NV off: Q2 `270b603` vs Q1 `c6e5278`** (the camcorder raised with night vision off, in a lit room and in the BLACKOUT ZONE, plus the lit room with the default light): **every pixel identical**, 0 of 2 073 600 in each of the three frames (`evidence/q3/ab_q2_vs_q1.*`). Nothing of the infrared runs with the sensor off. The Q3 corrections after it change only the corners, which the checks above cover.
- **Tiers.** LOW / MEDIUM / HIGH draw the same fixtures, corners and infrared, at lower or higher sampling. Infrared: N7. Corners: the clip is the same polygon at every tier (it does not depend on the tier).

## Performance

See `STAGE_3B_FINAL_VISUAL_POLISH_PERFORMANCE.md`. In short: NV off shows no material regression. With 4 interleaved runs per build, the page frame medians differ by −1.8 % to +2.7 %, while the same build varies by up to 15 % between runs. drawLight is flat, except YELLOW HALL walked across with the player's own light (+5.5 ms of about 45 ms; the page frame there is unchanged). The clip costs +0.01 to +0.07 ms per frame in the micro benchmark. NV on, the infrared is a real light, bounded like a carried light: 15–23 ms per frame at LOW and 42–43 ms at HIGH in the profile, and nothing with the sensor off. **Software rendering only (SwiftShader, 2 CPUs): no real-GPU numbers are claimed.**

## Human QA

`STAGE_3B_FINAL_VISUAL_POLISH_HUMAN_QA.md`: scenes A–I, about 15 minutes. Before/after screenshots for every scene are in `dev/stage-3b-l-qa2/evidence/q3/scenes/`, with the parent on the left.

## Recorded, not changed (out of scope)

- **Hound dread flicker.** With a Hound near you the screen can flash brighter for a moment (the old dread flicker in `mp.js`).
- **Dim tubes.** `light.js` and the server treat the old dim tubes (every 13th fixture) as full-strength lamps; only BR-RoLE and the housings show them dim.
- **Hand glow.** A carried light's hand glow (52 px) is not carried onto wall faces (QA1 design).
- **Flaky `ir_test.py`.** Part 2's browser test is timing-sensitive. Its R7 (two pages) failed once on the parent and passed on the rerun. On QA2 it crashed twice before reaching a verdict, both times on a missing sample (once in Q2; once on the final code, in R3's baseline read, `evidence/q3/ir_test_first_run_crash.err`). Both times it passed R1–R9 on the rerun.
- **Along-face steps.** A face lit very close to a light still steps a little between pieces (largest 0.061 of the facing; 0.075 before). Pieces sized by equal changes of facing would remove it; this was not pursued.

## Files

`STAGE_3B_FINAL_VISUAL_POLISH_CHANGED_FILES.txt`.

STAGE 3B FINAL VISUAL POLISH HUMAN-QA CANDIDATE — WAITING FOR USER
