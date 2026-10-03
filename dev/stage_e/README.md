# Stage E verification and review

Use Node v25.9.0 from the package root. Normal game: `node server.js`. Redirect service: `node redirect.js`. Stage E adds synthetic surface navigation and sensor fixtures to the real AI; production Level 0 stays flat. `/stage_d.html` remains the isolated Stage D presentation prototype, not a playable Stage E scene.

## Focused tests

```sh
node dev/tests/run.js s_nav25d.js s_perception25d.js
node dev/stage_e/test_core.js
node dev/stage_e/test_motion.js
node dev/stage_e/test_sensors.js
node dev/stage_e/test_entities.js
```

The named Z10–Z17 entries invoke those actual component/species suites. The frozen Stage A matrix remains unchanged; Z14's Stage H presentation and Z17's Stage G aftermath portions are deferred. No fixture brain replaces either species.

## Final verification

```sh
python3 dev/stage_d/run_inherited.py --out dev/stage_e/evidence/final-inherited
python3 dev/stage_e/run_final.py --group spatial
python3 dev/stage_e/run_final.py --group browser --parent '/path/to/accepted Stage D extraction/thefarbackrooms-level0'
```

Run suites serially, particularly performance workloads. The browser harness needs Playwright and the retained Chromium installation; `TFB_BROWSER_EXECUTABLE` may select it. No browser dependency is added to the game. Network suites need permission to listen on local ports. The runner records nonzero inherited results; it does not redefine them as passes.

`verify_parity.js` makes disposable fresh captures and uses the original comparator at tolerance zero against frozen traces. Runtime/source metadata differences remain explicit. `perf_spatial.js` measures a seeded four-surface/eight-entity diagnostic, query counts, route/edge cache reuse and evidence caps; it is not Stage I certification.

Build maintained sources with `bash dev/build_ai.sh`, `bash dev/build_sim.sh`, `bash dev/build_ents.sh`, and `node dev/stage_d/build_prototype.js` in a disposable extraction, then compare outputs. Final archive identity is external to the ZIP.

See the root `25D_STAGE_E_*` reports for current outcomes and human QA. Historical E0–E5 progress notes and recovered failed-candidate logs remain immutable history, not final status. No Stage F work or main-branch merge is authorized.
