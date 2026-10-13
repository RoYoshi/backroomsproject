# H4-1: the decorative dark ellipse, removed

## The edit

One exact-text edit in `assets/index-DKbV5Nv9.js`, the avatar class's `rebuild()`:

```
- this.addChild(new I().ellipse(1,5,19,19).fill({color:0,alpha:.3}),this.pack,this.body);
+ this.addChild(this.pack,this.body);
```

**How it is applied.** `dev/stage-3d-hq4/apply_bundle_hq4.py` applies it to the accepted HQ3 bundle, after proving that Stage 3H0's bundle plus the 12 edits of `dev/stage-3d/apply_bundle.py` (unchanged) still give that accepted bundle byte for byte. `--check` passes on the working copy.

**Nothing else is touched:**
- The backpack and the body are still the first children, in the same order, drawn by the same code.
- Every other child (both hands, hat, wounds, gear), the cosmetics and the anchors are untouched.
- The avatar has 7 children instead of 8.

## Results (`steps.txt`, `lab_report.json`)

**The setup** (`wanderer_lab.py`):
- the same frozen scene: fixture 2 alone, at MEDIUM;
- the Wanderer 100 px from it, her own light off;
- turned 0, 90, 180 and 270 degrees from the direction away from the fixture.

The bundle was served per variant; the game tree is the accepted HQ3 QA1 export.

| Comparison | Pixels that differ, by heading 0 / 90 / 180 / 270 |
|---|---|
| HQ3: the ellipse hidden in the same frame | 149 / 148 / 142 / 146, **none outside the ellipse's own outline** (grown 2 px) |
| **HQ4 against HQ3 with the ellipse hidden** | **0 / 0 / 0 / 0**: the same picture, pixel for pixel |
| HQ4 against HQ3 as shipped | 149 / 148 / 142 / 146, none outside the ellipse's outline |

`ellipse_before_after.png`: the four headings, before and after.

**Corpses.** Corpse views draw the Wanderer with the same class, so the ellipse is gone there too: a Hound corpse's avatar has 7 children in HQ4 against 8 in HQ3.
- The corpse rendering itself (gore.js, the corpse views, the HQ3 gibs) is unchanged.
- The corpse captures are not a clean pixel A/B: the previewing Hound stays on the corpse and moves. They are kept in `lab/` only for the record.

**Bounds** (from H4-0's audit). No code reads an avatar's bounds, width, height, hit area or children by index. Pixi's own `cacheAsTexture` for corpse views sizes itself to what the view holds. Collision, camera, pointer and gameplay never see this layer.

**Page errors:** none, on either variant.

## Attempts

`attempts/`:
- **First run.** The corpse was captured on the dead player's own screen, which is black in her death view.
- **Second run.** The corpse was captured while the death replay still played.

Both runs' ellipse numbers are the same as above.

## To undo

Any of these restores HQ3's bundle:
- revert this commit;
- remove the H4-1 entry from `HQ4_EDITS` and run `python3 -I dev/stage-3d-hq4/apply_bundle_hq4.py`;
- copy `assets/index-DKbV5Nv9.js` from `4934319`.
