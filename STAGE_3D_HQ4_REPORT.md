# Stage 3D HQ4: the Wanderer's two shadow defects, report

**Status: HUMAN-QA CANDIDATE / NOT ACCEPTED.** Only the user can say HUMAN QA PASSED.

## Play now

There are two ways to play it.
- **The overlay.** `HQ4_HUMAN_QA_OVERLAY.zip` (SHA-256 `753312cf26b84d4bc7ef84f7c720d004ee41c2cb0a98d2bb32db7b850fd684bd`) holds 3 files to copy over the extracted HQ3 human-QA game; `WHERE_TO_COPY.txt` inside says where. It was validated on a clean extraction of that ZIP (`dev/stage-3d-hq4/evidence/h4-3/OVERLAY_RECEIPT.txt`).
- **The branch.** Check out `stage-3d-hq4` and run `ADMIN_PASSCODE=<your own passcode> node server.js 8000`.

## Source

| | |
|---|---|
| Accepted parent | `stage-3d-hq3` `49343193e6948c8323f35a34539ac84db5a89835`, tree `5abdb5a2e6b1522fe027efc09e6e2c97ace10ccf` (HQ3 QA1), checked live on GitHub before any change |
| Branch | `stage-3d-hq4`, new from exactly `4934319`, normal pushes only |
| H4-1 | `ce6fe63482b9fd043285db0dca261603d9196d76`, tree `5c0062344c1d1eceeb406b2b098a4fe499d1c7b0`: fix A |
| H4-2 | `5f933db7e2e288b3d0758544711ff124454ad961`, tree `c8635e7ae59da7f80b169f8e4ab77cc13d5445f0`: fix B |
| H4-3 | this commit: checks, overlay receipt, documents. No game change; the game files equal H4-2's |
| Other branches | `main`, `stage-3d`, `stage-3d-hq1`, `stage-3d-hq2`, `stage-3d-hq3` (still `4934319`), `stage-3h0` and the other 19 are where they were. `verify_remote_hq4.py` checks this after every push |

**Production files changed** (5 lines added, 3 removed; `STAGE_3D_HQ4_CHANGED_FILES.txt`):
- `assets/index-DKbV5Nv9.js`: fix A, one exact-text edit;
- `assets/br-role.js`: fix B, one condition plus its comment.

`gore.js` (with the QA1 white-streak fix) and every other game file are byte-identical to HQ3 QA1.

## The two fixes

**A. The decorative dark ellipse.**
- **What it was.** The avatar's `rebuild()` added an anonymous Graphics, `ellipse(1,5,19,19)` at 30 % black, before the backpack and the body. It sat 4-5 px toward the avatar's back and was 1 px larger than the body, so it showed as a dark crescent behind the Wanderer that turned with her.
- **The edit.** It is removed from that `addChild` call (`dev/stage-3d-hq4/apply_bundle_hq4.py`, applied to the accepted HQ3 bundle). The tool first proves that Stage 3H0 plus `dev/stage-3d/apply_bundle.py`'s 12 edits still give HQ3 byte for byte.
- **What stays the same.** The backpack and the body stay first, in the same order, drawn by the same code.
- **Who reads the layer.** No code reads it, the avatar's bounds, or its children by index.
- **Every Wanderer.** The same class draws you, other players, death replays and corpse views, so it is gone under corpses too.

**B. BR-RoLE's cast slid with the hands.**
- **What it was.** `actorShadows()` took the cast's start as the farthest point of every silhouette part (the body and both hands) along the light. Turning, or a hand swinging, moved the whole tongue.
- **The edit.** For a Wanderer, the start is now the round body's edge.
- **What stays the same.** The hands stay in the silhouette, so they are still cut out of the cast and still self-shaded. Hounds keep their own path.
- **Not touched:** direction, length, width, strength, easing, light choice, occlusion, self-shading and the other BR-RoLE tiers.

## The five gates

All five passed. They are automated: SwiftShader, focused, with no full campaign.

| Gate | Result | Evidence |
|---|---|---|
| 1. Integrity | **PASS** | Straight line from `4934319` with no merges. Only the two files above changed outside `dev/stage-3d-hq4/`. The bundle chain is reproducible (`apply_bundle_hq4.py --check`). `gore.js` is unchanged, with `g.beginPath().arc(` present. No other branch moved. 0 page errors in all 14 real-page runs (the labs, the smoke and the overlay check) |
| 2. Circle A/B | **PASS** | `evidence/h4-0`, `h4-1`. The scene is frozen: one fixture, her own light off, four headings. Hiding only that ellipse in HQ3 changes 142-149 pixels, none outside the ellipse's outline. **HQ4's capture equals HQ3's with the ellipse hidden, pixel for pixel**, at all four headings |
| 3. Shadow geometry | **PASS** | `evidence/h4-2`. Body and fixture fixed, 24 headings: start 18.00-25.87 px before, **18.00 always** after. Hands at swing extremes: **18**. The drawn shadow's far end, measured from captures, was 57.6-63.6 px and is now **57.6** at every heading. All other job fields are identical. The cast still follows a moving actor (3 spots) and Bob's flashlight from 4 sides (it points away from him every time). Stand-in Hound jobs are identical |
| 4. Real gameplay | **PASS** | `evidence/h4-3/gameplay_smoke`, two real pages, HQ3 and HQ4 each, identical results: she walks about 490 px, the spin covers every quarter, the light goes on and off, and NEW RUN is approved. Bob's page gets her gibs (6 pieces and both hands). SPAWN brings her back and she walks. HQ2's head-on collision check `col_browser --case head`: 5/5 |
| 5. Multiplayer, occlusion, frames | **PASS** | A second Wanderer beside her gets a cast; the same Wanderer behind a wall gets none, so there is no x-ray. All fixtures on. Frame pacing, one page at a time, alternating: HQ3 254 / 243 ms a frame, HQ4 246 / 245 ms; BR-RoLE's own cost is 20.1-20.9 ms in both (SwiftShader, about 4 fps) |

## Not tested

- **A real GPU or real frame rate.** All browser runs used a software renderer.
- **Phones.**
- **The LOW and HIGH lighting tiers.** Measured scenes used MEDIUM.
- **Other gear for fix B.** The measured scenes used the flashlight, off. The fix ignores the hands for every gear, by construction.
- **Long sessions.**
- **Older suites.** HQ2's known baseline (`npm test` 149/162 and the others listed in `STAGE_3D_HQ2_REPORT.md`) was not re-run, as the pack asks.

## Limitations

1. **Corpses lose the ellipse too.** The corpse view draws the Wanderer with the same class. gore.js's own blood and contact shadow under corpses are unchanged. Look at a Hound corpse in QA step 4.
2. **No separate hand shadow.** A hand on the far side of the body casts no separate small shadow. It never did; before, it only pushed the whole tongue. If you want a small hand-only shadow, it can be added on its own.
3. **The drawn measure is coarse.** The drawn-shadow numbers come from BR-RoLE's light buffer, which is coarser than the screen (about 2 px). The job numbers are exact.
4. **The overlay is for these two baselines only.** It is for the HQ3 human-QA ZIP (`61ed1360...`) or an HQ3 QA1 checkout, both validated. Do not apply it over a game folder you have changed yourself.

## To undo

| Fix | Any of these restores HQ3 QA1 |
|---|---|
| A | Revert `ce6fe63`. Remove the H4-1 entry from `HQ4_EDITS` and run `python3 -I dev/stage-3d-hq4/apply_bundle_hq4.py`. Copy `assets/index-DKbV5Nv9.js` from `4934319` (it is in the overlay's `REVERT_TO_HQ3_QA1`) |
| B | Revert `5f933db`. Drop the `if (kind !== 'player' \|\| q === sil[0])` guard in `actorShadows()`. Copy `assets/br-role.js` from `4934319` (also in `REVERT_TO_HQ3_QA1`) |

## Tools and evidence

- `dev/stage-3d-hq4/README.md` lists the tools; every server they start uses a synthetic admin passcode.
- `evidence/h4-0`: pre-flight audit and baseline.
- `evidence/h4-1`: fix A.
- `evidence/h4-2`: fix B.
- `evidence/h4-3`: the gates, the overlay receipt, the two hand-off pictures `HQ4_fix_A_dark_ellipse.png` and `HQ4_fix_B_floor_shadow.png`.

Each evidence folder has `steps.txt` and `SUMMARY.md` (or `AUDIT.md`).
