# H5 — full regression and package

IN PROGRESS. H4 completed and was remotely verified at `4bd55b262e898e5de0980d674998123880445d94`, tree `91754d85893a10431bce8b86bb10b981109c64f5`, before H5 began. No Stage I work or main changes are authorized.

## Build failure preserved before repair

`evidence/h5/build-01/result.json` is FAIL. Clean extraction to a path with spaces reproduces AI and simulation bytes, but `ents.js` rebuilds to the Stage G hash because H3 spatial audio edits exist only in the generated output. `ents.js.diff` records exactly the missing `place(...,z)`, `play` elevation argument and `E.spatialImpact` code. No renderer, visibility, physics or AI change is warranted. The minimal repair is to synchronize these existing runtime lines into `dev/ents_src/30_audio.js` and regenerate; the expected generated hash must remain the tested H4 `f7190223f6bdcdcf91fb1f8169d59ebe301866c160b7ff1affc48149f08d5284`.

## Source synchronization verified

Only `dev/ents_src/30_audio.js` was repaired. `evidence/h5/build-02` PASS proves that rebuilding AI, simulation and entity presentation leaves all three generated runtime files byte-identical to the H4-tested files. The lost-source defect is resolved without changing runtime semantics, physical truth, visibility or test thresholds. Retained regression is running serially.
