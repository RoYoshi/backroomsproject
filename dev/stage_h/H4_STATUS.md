# H4 picking, fairness and real browser gate

H4 is IN PROGRESS. H3's completion was verified at `81c3e54e59dd92ce9c9f4fe72986b10824197727`, tree `1e566b6575d621df4e4c5b46494324cbcaf09e48` before H4 began.

The production fixed-tick aim now intersects camera rays with physically visible faces and actor cylinders, checks camera occlusion separately, and falls back to the eye plane. Cutaway does not remove physical eye-ray occluders. Picking and rendering use the same canonical footprint and existing camcorder zoom. Flat aim is unchanged. Local cutaway and full/reduced quality controls are in existing Settings.

Focused geometry evidence `evidence/h4/picking-01.json` passes physical target/point/distance invariance across 16:9, 16:10, ultrawide, 4K and zoom; hidden targets and opaque camera obstruction remain blocked, fallback is on the eye plane, world geometry is unchanged.

`view25d` is activated as real production-browser orchestration. It launches H2 for Z29, H3 for H-Z14 and expanded aftermath, and H4 for Z30. Missing dependencies, browser errors, timeouts and leaks fail. The complete named gate has not yet been run at this preservation checkpoint. The eight-case real-browser matrix is in progress. No H4 PASS or H5 work is claimed.
