# Stage H frozen and flat parity

**PASS: 46 traces / 35,098 records, tolerance 0.** Motor, AI, all eight death traces, navigation and network records match the frozen Stage A captures. Source-hash metadata differences identify changed files and are not simulation-record differences. Frozen gzip/index files are not regenerated or modified. Evidence: `dev/stage_h/evidence/h5/regression-01/parity/result.json` and every individual capture/diff log.

Level 0 export is BYTE IDENTICAL to the frozen Stage B map gzip. AI, simulation, death kernel, shared geometry/motion, protocol/history, level data and camera/timing policies are byte-identical to the accepted G tree; the exact staged audit lists these invariants.

Actual served flat production menu and gameplay PNG hashes, physical pose, camera scale, started state, RNG and explicit equal RAF delivery schedule match the exact accepted G source. Evidence: `h5/regression-04/browser-flat/result.json`. Native audio time is bound to the harness clock in both captures; product audio is untouched by the harness. Flat mode does not load the spatial view path. This is automated image/state equality, not human feel certification.

All generated builds reproduce exact hashes before/after, including both clean-extraction rebuilds. H5's maintained audio repair changes no generated runtime bytes. Real fixed-tick FPS and camera fairness tests pass in the source and portable package.
