# Stage B canonical flat geometry

`levels/level0.js` is the single editable Level 0 layout authority. It is data-only,
recursively frozen and contains the exact ordered carve inputs, rooms, column/pillar
inputs, lamp generation rule/IDs, prop definitions, material assignments, spawn and
reachability anchors, legacy item-room references and patrol points. Glitched-wall
exits remain seeded runtime state owned by the unchanged generation algorithm in
`dev/sim_glue.js`; the definition identifies that policy rather than inventing fixed exits.

`world_geometry.js` validates the explicit `flat-compat` descriptor, verifies its
canonical SHA-256, creates per-instance legacy geometry and binds the existing AI
adapter. The existing algorithms are preserved: tile carving, near blockers, DDA
rays, legacy reachability, circle collision, item anchor placement. The real AI's
48-unit A*, clearances, links, smoothing, costs and decisions remain unchanged.
Content plus material-profile hashes identify the AI static cache.

Generic prop/crawl derivation, art, material profiles and movement constants remain
in `world.js`. Its prop table and room material assignments derive from the canonical
definition. No import cycle: level data -> WORLD -> explicit geometry compilation.

## Compatibility mirrors

- `WORLD.PROPS/LOW/UNDER/GAPS/CRAWL`: generated from canonical prop placements.
- `WG.flat`: old arrays/functions needed by existing bundle/sim callers; per-instance
  writable typed arrays and legacy state (e.g. `el.found`) are compatibility views,
  not independent data authorities. Canonical and compiled definitions are immutable.
- `Oc/Mc/Nc/Pc/Fc/kc/ll`, spawn and patrol aliases: compiled derivatives.
- `sim.js`: generated from maintained `dev/sim_head.js` and `dev/sim_glue.js`.
- The client bundle has exactly four anchored changes (layout, ray/blocker functions,
  legacy nav helpers, patrol data); see `results/bundle-edits.json` for old hashes.
  Existing entity G initialization is runtime state, not another map definition.
- Frozen Stage A fixture/export/traces are comparison evidence, never runtime input.

Legacy `WORLD.mode` handling is retained solely in the flat adapter and resets to
`walk` in `finally`, as before. Future spatial code must use explicit profiles.

## Spatial boundary

Bounds Z is null; no physical ceiling is inferred. Existing legacy crawl metadata
is preserved but does not activate physical Z. `spatialRecords` is null. The six
spatial query methods throw `NOT IMPLEMENTED BY DESIGN — Stage C`. No gravity,
support solver, Z replication, nav surfaces or cutaway renderer exists in Stage B.
`dev/contracts/world_definition_stage_b.d.ts` describes the discriminated flat/future
spatial boundary without changing the frozen Stage A declaration.

## Commands (from package root)

```
node dev/stage_b/test_geometry.js
node dev/stage_b/content_identity.js
node dev/stage_b/verify.js /tmp/stage-b-parity.json
node dev/stage_b/served_package.js . /tmp/stage-b-http.json
bash dev/build_ai.sh
bash dev/build_sim.sh
bash dev/build_ents.sh
node server.js
```

`node redirect.js` is the separate Render compatibility service. It is unchanged.
`verify.js` checks the 343-file Stage A input manifest with only seven allowed edits,
24 validation/identity groups, byte-exact frozen data export, and all 46 fresh traces.
It never overwrites Stage A references. Only the documented lifecycle source hash
may differ; gameplay records compare with zero tolerance. Subprocess/socket access
is required; a permission error is a blocker, never a test pass.

`export_world.js [root] [out.gz]` performs a read-only comparison export. Legacy
source extraction runs only for an explicit root lacking the new geometry module.
It exports all 6912 tiles, ordered geometry/props/crawl records, real AI nav arrays
and ordered vault links, 1728 positions with four movement modes and five rays,
and actual seeded simulations (1, 42, 1701). Arrays are not sorted or rounded.

Stage A `verify_stage_a.js` is intentionally frozen and still requires its 227
original runtime files to be unchanged; it is a pre-migration gate, not the Stage B
gate. Stage A `served_package.js` intentionally expects the old broken 404s; use the
Stage B tool after the B-01 fix. Neither historical tool is silently rewritten.

`served_package.js` runs the actual server, compares HTTP bytes, checks request
rejection and immediate recovery, and executes the served policies and literal
application timing/resize/world bindings in a VM. It is not a real browser/Pixi test.
Full browser rendering and subjective human gameplay QA remain separate gates.

To change future canonical content, deliberately revise `contentRevision` and compute
`contentHash` from `G.contentHash(definition)`. Object keys sort; array order is retained;
only the `contentHash` field itself is excluded. No timestamps or paths enter identity.
Do not retune content as part of this Stage B migration.
