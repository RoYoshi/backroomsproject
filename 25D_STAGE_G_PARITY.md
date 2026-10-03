# Stage G frozen parity

PASS: 46 frozen traces / 35,098 records, tolerance **zero**. Motor, AI, death,
navigation and network captures reproduce the accepted references. All eight
death variants contribute 2,030 frozen records. The Level 0 exported map is
byte-identical. Original trace/reference bytes and thresholds were not changed.

Run `python dev/stage_g/run_parity.py`; captured `.gz` intermediates are locally
reproducible and intentionally not re-versioned. Per-trace comparison output and
full result are committed under `dev/stage_g/evidence/g5/parity`.

Source audit also proves accepted CFG and PLAN sections, species tuning/motion
source, player motor, geometry, world data, future matrix and death renderer
remain unchanged. The only frozen-capture adapter edit changes the historical
hand damping property name from `z` to `dampingRatio`; it preserves trace meaning.

Generated `ai.js`, `sim.js` and `ents.js` reproduce exactly in place and after
clean ZIP extraction to a path containing spaces. Their hashes are in
`evidence/g5/builds.json` and `evidence/g5/portable/result.json`.

Same-runtime spatial reruns, all six render/sample schedules, independent VM
client replay and bounded active restore are exact. Cross-runtime Node/Chromium
physical values differ by at most 4.973799150320701e-14 in the final browser run,
well below the existing geometry epsilon 1e-7; support, mode and sleep agree
exactly. That browser check is separate from zero-tolerance frozen parity.
