# Stage B parity evidence

PASS — frozen semantic export byte-identical and 46 trace record arrays identical (35,098 records).

## Data comparison

`dev/stage_b/level0-baseline.json.gz` was captured from the freshly extracted Stage A
before implementation. `export_world.js` runs legacy maintained head code for that root;
for Stage B it uses the shared compiler. Neither path rewrites the frozen baseline.

Compared without rounding, reordering or removing gameplay state:

- 96×72 map / 6,912 tile values; 3,308 floor and 3,604 wall cells.
- 12 ordered rooms, 10 columns, 9 pillars, 90 ordered lamps.
- 18 ordered derived props including original IDs, crossing/concealment and cell rectangles.
- 8 crawl records with existing interior/occluder/exits/capability/reveal metadata.
- Material profiles and room queries; spawn anchor and 8 legacy collectible anchors.
- Legacy 48-unit navigation grid (192×144, 27,648 cells).
- Real AI navigation class/clearance/lamp arrays and ordered vault-link Map entries.
- 1,728 query locations × four modes: blocker ordering and clearances 15/21/52;
  five DDA ray directions per location, surface, crawl and low-zone lookups.
- Seeds 1, 42, 1701: actual simulation reset/join/120 fixed steps, entities, dynamic
  glitched-wall exits, generated item locations, blackout, engine and admin state.

Typed arrays become numeric arrays and Maps become ordered entries solely for JSON
serialization. Source arrays and numerical values are not normalized. Gzip bytes agree.
The real AI navigation trace separately exercises A*, diagonal corner rules, capabilities,
links, routes and movement commitment. Seeded output equality provides RNG-consumption
regression evidence; no internal RNG API or algorithm was modified to expose state.

## Trace comparison

All motor/AI/death/navigation/network scenarios are independently recaptured with
unchanged Stage A capture scripts into a temporary directory. Every record compares with
zero tolerance. No baseline trace was updated. The comparator reports first divergent
record field and throws rather than blessing new behavior.

Only non-record metadata change:
`network-lifecycle.sourceSha256` changes from
`2c829640a80e9950e55f8ea37b3ed64d4e37dfaa5da9c29bebec85a71b699f13` to
`69000a597478fcdc480699847779c3059d27ccd04c37fc6612ba15efd00a7dc9`,
because the capture hashes maintained `dev/sim_glue.js`, whose adapter construction
and reachability anchor now derive from canonical geometry. Lifecycle record arrays
remain exact. No other metadata difference is permitted by the verifier.

## Identity and scope

World content hash: `5b07af1fe27222982b860d5ebc912c3894459fa65441d46e7f2d9eb7f278bc77`.
Material profile hash: `fdce5dd79317e0058e256d4dbcc4242237cf4fac3b4f6037c37c1afe2f31d069`.
Same Node/classic-script VM and fresh extraction produce the same identity and map.

Exactly seven original files are allowed to change; 336 are byte-identical. AI sources,
ai.js, move.js, dphys.js, death_srv.js, mp.js, camera/timing policy values and all original
tests remain unchanged. sim.js is rebuilt from maintained sources. Four bundle edits
are recorded with old hashes in `results/bundle-edits.json`.

No map conversion, physical Z, spatial navigation, AI retuning, RNG draws, protocol changes
or death modifications. Browser visual equivalence and human feel are not established by
these data tests. The intentional B-01 hosted policy activation is separately documented.
