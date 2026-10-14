# Stage 3D HQ5 / BR-RoLE 1.2: the Wanderer's ground contact, report

**Status: HUMAN-QA CANDIDATE / NOT ACCEPTED.** Only the user can say HUMAN QA PASSED. HQ4 (`stage-3d-hq4` `79e1461`) stays the accepted game until then.

## Play now

There are two ways to play it.
- **The overlay.** `HQ5_BR_ROLE_1_2_HUMAN_QA_OVERLAY.zip` (SHA-256 `7fab41b91a0704926a9883149d351f851e940355718cb2c5c744d45147c3bbda`, 88,397 bytes) holds one game file to copy over a **clean HQ4** game folder, plus HQ4's own file to undo it. `WHERE_TO_COPY.txt` says where.
  - It was validated on a clean `stage-3d-hq4` export and on the HQ3 human-QA ZIP with HQ4's overlay copied over it.
  - It does **not** apply to an HQ3 folder that never got the HQ4 overlay.
- **The branch.** Check out `stage-3d-hq5` and run `ADMIN_PASSCODE=<your own passcode> node server.js 8000`.

What to look at: `STAGE_3D_HQ5_HUMAN_QA.md`, one page.

## Source

| | |
|---|---|
| Accepted parent | `stage-3d-hq4` `79e146124a5941c6578ef84dc9ff13176cc7f1f0`, tree `9aee1dba72ad26e7c3c1a8454d652275bfbf9ea6`, checked live on GitHub before any change |
| Branch | `stage-3d-hq5`, new from exactly `79e1461`, normal pushes only |
| H5-1 | `18639357117a28c7db930574ac40c6161c532101`, tree `906797fbb1778b3adbed94b59c33d7426ba146fa`: the contact (the game file is final) |
| H5-3 | This commit: the gates' evidence, the overlay receipt and these documents. No game change |
| Other branches | `stage-3d-hq4` is still `79e1461`, and `main` and the other 24 are where they were. `verify_remote_hq5.py` checks this after every push |

**Production files changed:** one, `assets/br-role.js`, with 112 lines added and 18 removed (`STAGE_3D_HQ5_CHANGED_FILES.txt`).

## What it does

**What she gets.** Right at the foot of a living Wanderer's round body, every light that reaches her loses a faint, soft share of its own light on the floor. Her body blocks part of the light arriving there.

**How BR-RoLE does it** (`CONTACT`, `contactLamp`):
- It is light removal inside each light's own compositing, exactly like her cast.
  - One light's contact removes only that light, so a second light fills it.
  - With no light there is nothing to remove, so there is no darkness without a source.
  - A lamp's own field already stops at walls, so it never works through one.
- **The lights:** the ones that could cast her shadow (BR2B's candidates).
  - Every lamp whose tube she sees.
  - Every carried light whose beam reaches her.
  - Never her own: HQ4's exclusion is kept, because an own-light shadow would hang off her hand and turn with her.
  - No hand glow, far field, bounce light or infrared.
- **Where each light's contact is taken out:**
  - with that light's cast, if it has one, keeping only what the cast does not already take (no dark blotch at the cast's root);
  - in a lamp's full-resolution scratch;
  - for a lamp drawn into the half-resolution core buffer: a hole of whole pixels there, added back at full resolution with the contact taken out, so it never reaches into her body;
  - in a carried light's scratch.
- **The shape.** One cached texture: full to the body's edge, then (1 - t)² over 9 px. Its strength is .3 of that light at the edge.
  - It is centred on her body in world space. It never follows her rotation or her hands; those are cut out of it as from the cast, so no pixel of her changes.
  - It is nudged at most 3 px away from each light, so right under a lamp it is even all round. That is exactly where HQ4 drew nothing for her.
- **Who gets it:** living Wanderers only.
  - Never a Hound, a Smiler, a corpse, a death replay, gibs, or a player you cannot see.
  - It fades out while she is falling in, and fades with her alpha.
  - Nothing is kept between frames.
- **Tiers.** The same rule on LOW, MEDIUM and HIGH. There is no new setting or admin command.
- **DEV only:** `__brRole.dev.contact(gain)` (0 is off, the A/B; up to 4 is a diagnostic) and `dev.contacts()`.

## The five gates

All five passed. They are automated: SwiftShader, focused, with no full campaign. Details are in `dev/stage-3d-hq5/evidence/h5-2/SUMMARY.md`.

| Gate | Result | Evidence |
|---|---|---|
| 1. Source and integrity | **PASS**. Only `br-role.js` changed. The bundle (avatar, HQ4 fix A), `gore.js` (QA1 fix) and every other runtime file are unchanged, and HQ4 fix B's guard is in place. The version is `br-role 1.2-candidate`. There were 0 page or BR-RoLE errors in every run. With the contact off, HQ5 equals HQ4 pixel for pixel. The revert restores HQ4 byte for byte. The secret scan found nothing in HQ5's files | `h5-2/integrity.json`, `secret_scan.json`, `h5-3/OVERLAY_RECEIPT.txt` |
| 2. Visual geometry | **PASS**. One lamp, her own light off, at 0/90/180/270 and at hand-swing extremes:<br>- **her body:** 0 pixels changed;<br>- **edge and floor to ~26 px:** at most 15 levels;<br>- **past 31 px:** 0 changed.<br>The contact job is identical through the swing, and HQ4's cast jobs are equal. Under the lamp she gets an even ring | `h5-1/sheet_geometry.png`, `sheet_under_lamp.png` |
| 3. Light reality and occlusion | **PASS**:<br>- **one lamp:** .07 taken at the edge;<br>- **the far lamp alone:** .02;<br>- **both:** .08, each its own share, with the other filling it;<br>- **every fixture:** .13 from four lamps;<br>- **blackout:** 0 light, 0 jobs, 0 pixels changed;<br>- **a peer's flashlight from two sides:** its own contact, with its cast;<br>- **her own light:** none (kept);<br>- **a peer behind a wall:** nothing (no x-ray) | `h5-2/sheet_lights.png`, `sheet_carried.png`, `peers_*.png` |
| 4. Gameplay and tiers | **PASS**, the same results for HQ4 and HQ5:<br>- **gameplay smoke:** walk, spin, light, NEW RUN with Bob seeing 6 gib pieces and both hands, SPAWN and walk;<br>- **head-on collision:** 5/5;<br>- **lifecycle:** a living peer gets a contact; from the first frame of his death replay, then his corpse and his disconnect, no contact for him and no ghost;<br>- **tiers:** LOW, MEDIUM and HIGH take .102, .106 and .110 at the edge. Contact off equals HQ4 on each | `h5-2/gameplay_smoke/`, `col_browser_head_hq5.json`, `lifecycle/`, `sheet_tiers.png` |
| 5. Frame cost and delivery | **PASS**. Alternating HQ4, HQ5, HQ4, HQ5 on one page, every fixture: BR-RoLE 9.9 / 10.3 / 10.8 / 10.2 ms a frame, with 4 contact jobs in HQ5, inside the noise (SwiftShader). The overlay was validated as above | `h5-2/perf.json`, `h5-3/` |

The ZIP's two game files were checked again against the pushed commit after the final push: `HQ5_OVERLAY/assets/br-role.js` matches `stage-3d-hq5` and `REVERT_TO_HQ4/assets/br-role.js` matches `79e1461`.

## Not tested

- **A real GPU or real frame rate.** All browser runs used SwiftShader, a software renderer (about 4-7 fps).
- **Phones.**
- **The tiers in other places.** LOW and HIGH were compared at one spot; the other scenes used MEDIUM.
- **More than two players.** No crowd was tested.
- **Long sessions.**
- **The camcorder's night vision.** Its infrared gets no contact by design.
- **Other gear.** Peer lights other than the flashlight were not tested; the rule is the same for every carried light.
- **Older suites.** These were not re-run, as the pack asks.

## Limitations

1. **Her own light gives her no contact.** That is HQ4's own rule (an own-light shadow would turn with her). With only your own flashlight on, there is no contact under you. A friend's light gives you one, and yours gives them one.
2. **Not every light makes a contact.** Hand glows, far fields, bounce light and infrared make none, as they make no cast.
3. **Corners.** Contact comes from the lights that could cast her shadow. A lamp she cannot see from her centre, around a corner, gives no contact, even where its light reaches the floor at her edge. As she crosses that line, its contact comes or goes with it, as her cast does.
4. **One shape for every light.** It is the same share of every light and the same cached shape, nudged at most 3 px away from the light. It is not computed from each light's height.
5. **Rounding near lamps in the core buffer.** For those lamps, the region round her is redrawn at full resolution. That region may differ from HQ4 by 1-2 levels (on her body too), which is not visible.
6. **Living or dead, read from the avatar.** BR-RoLE reads it from the avatar without changing it. Death replays and corpses carry `__cause`, and a dead peer's posed avatar is squashed by `deathPose`.
7. **Faint by intent.** Strength (`CONTACT.a`) and reach (`CONTACT.r`) are single constants if you want it stronger, fainter, wider or tighter.

## To undo

Any of these restores HQ4:
- copy `REVERT_TO_HQ4/assets/br-role.js` from the overlay (byte for byte HQ4);
- check out `stage-3d-hq4`;
- revert `1863935`.

## Tools and evidence

- `dev/stage-3d-hq5/README.md` lists the tools; every server they start uses a synthetic admin passcode.
- `evidence/h5-0`: audit and HQ4 baseline.
- `evidence/h5-1`: the prototype and the lab report.
- `evidence/h5-2`: the five gates.
- `evidence/h5-3`: the overlay receipt and the two hand-off pictures.

Each evidence folder has `steps.txt` and `SUMMARY.md` (or `AUDIT.md`).
