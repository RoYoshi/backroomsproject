# Current recovery status

Verified branch: `stage-h`

H4 recovery commit:
`de9de8b23a73327a1337b3500e6e5241a5471171`

H4 recovery tree:
`a994646952ff85dea71aa714a6bb14055189909a`

H3 complete:
`81c3e54e59dd92ce9c9f4fe72986b10824197727`

Accepted Stage G parent:
`7fb4dafef92040571209403358e536ccb1105509`

Already preserved in H4:
- production fixed-tick physical picking/aim
- visible face + actor-cylinder ray intersections
- camera occlusion checks
- eye-plane fallback
- cutaway-independent physical eye-ray occlusion
- canonical footprint use
- existing camcorder zoom integration
- flat aim unchanged
- Settings controls for local cutaway and full/reduced quality
- real `view25d` browser orchestration
- focused picking evidence across 16:9, 16:10, ultrawide, 4K and zoom

Focused picking evidence already passes hidden target rejection, opaque obstruction, fallback, and invariance.

Still open at this checkpoint:
- complete named `view25d` run
- eight-case real-browser H4/Z30 matrix
- H4 PASS
- H5 final regression/package

Do not reopen H0-H3 without a concrete regression.
