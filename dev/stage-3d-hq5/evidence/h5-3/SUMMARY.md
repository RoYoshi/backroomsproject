# H5-3: the human-QA overlay and the hand-off pictures

**The overlay:** `HQ5_BR_ROLE_1_2_HUMAN_QA_OVERLAY.zip`, SHA-256 `7fab41b91a0704926a9883149d351f851e940355718cb2c5c744d45147c3bbda`, 88,397 bytes. It is delivered beside this commit and is not stored in it.

| Entry (at the ZIP's root) | What it is |
|---|---|
| `HQ5_OVERLAY/assets/br-role.js` | `br-role 1.2-candidate`, byte-identical to `stage-3d-hq5` |
| `REVERT_TO_HQ4/assets/br-role.js` | `br-role 1.1-qa2`, byte-identical to `stage-3d-hq4` `79e1461` |
| `WHERE_TO_COPY.txt` | What to copy where |
| `OVERLAY_RECEIPT.txt` | Every file's SHA-256 and the checks below |
| `HUMAN_QA.md` | The one-page guide, the same as `STAGE_3D_HQ5_HUMAN_QA.md` |

**`overlay_hq5.py`: PASS** (`OVERLAY_RECEIPT.txt`, `overlay_receipt.json`):
1. **The ZIP.** Its CRCs are good, and its two game files are byte-identical to Git.
2. **Over a clean export of `stage-3d-hq4` `79e1461`.** All 54 runtime files are byte-identical to `stage-3d-hq5`, and the copy changed only `assets/br-role.js`.
3. **Over the folder you most likely play.** That is the HQ3 human-QA ZIP (`61ed1360…`) with `HQ4_HUMAN_QA_OVERLAY.zip` (`753312cf…`) copied over it.
   - That folder is HQ4 byte for byte.
   - After the HQ5 overlay it is `stage-3d-hq5` byte for byte.
4. **The revert.** Copying `REVERT_TO_HQ4` back makes the folder byte-identical to `stage-3d-hq4` again.
5. **The overlaid game runs:**
   - 0 page errors and 0 BR-RoLE errors;
   - `br-role 1.2-candidate`;
   - the avatar has 7 parts with no ellipse (HQ4 fix A);
   - under one fixture at 8 headings, her cast starts at 18 px (HQ4 fix B), and she has that fixture's contact every time;
   - `gore.js` has the QA1 fix.

The final ZIP was checked again against the final branch commit after it was pushed (see the report).

**Pictures.**
- `HQ5_contact_before_after.png`: real game frames at normal zoom, HQ4 against HQ5. The scenes are right under a lamp, beside it, two fixtures, every fixture, and a friend's flashlight. There is a ×3 DEV diagnostic beside the second pair.
- `HQ5_contact_closeup_under_lamp.png`: the under-lamp pair at 3× with the difference.
