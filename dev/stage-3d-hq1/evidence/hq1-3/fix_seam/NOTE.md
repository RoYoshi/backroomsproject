# HQ1-3a: BR-RoLE's seam kept verbatim

The first HQ1-3 regression run (`../attempts/run1_stopped_br_role_U10/`) found one new failure against D7: BR-RoLE's own test
`dev/br-role/test_br_role.js` U10, "drawLight hands the light cut-outs to BR-RoLE through one guarded hook". It looks for the hook's exact text
`if(!BR&&e&&!f.nv){`, and HQ1-2's bundle edit had put the victim's dying-light power into that condition
(`if(!BR&&e&&!f.nv&&HQ>0){`). HQ1-2 did not run this test. The run was stopped after 4 minutes, since the bundle had to change.

The fix (`dev/stage-3d/apply_bundle.py`, HQ1 edit 1): the power is read inside the hook's block, `if(!BR&&e&&!f.nv){let HQ=…;if(HQ>0){…}}`.
The behaviour is the same: the game's own lighting draws the victim's dying light only while the power is above 0, scaled by it, exactly as
before. Only the text of the condition changed.

- `br_role_before_fix_U10.log`: 31/32, U10 failed (hooks found 6/7).
- `br_role_after_fix.log`: 32/32.
- `apply_bundle.py --check`: the working bundle is exactly the 8 edits on the parent; `node --check` passes.
- The legacy-lighting light timeline (the path this edit draws) is run again in the full regression on this commit.
