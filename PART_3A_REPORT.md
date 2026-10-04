# Part 3A — Production 2.5D Level 0

**P3A5 PORTABLE GATES PASS — FINAL PUBLICATION PENDING**

Final source identity is recorded in the accompanying external publication receipt.

Accepted Stage I parent: `106c87015ae8702f452979e0277cbacb5435fa6a`; tree `82be2ca8d031f2d46c70a17b5c14c83689dbf8c8`; immutable ZIP SHA-256 `e5ebb8cd7b9c511ce83ea56443e7382de13e1cfbf2a0b2e2764808136e924bff`. Stage I human QA is PASS.

This interrupted run resumed the verified `4bcafa871e40f592ef5480572b55a4f764674558` / `358ee808ed9fc1d003ce9319c2a4f13cbc2938a5` preservation state. P3A0–P3A3 were retained. P3A4 was completed and remotely verified at `bf68c5ba2c0956c8b7123396475dfc9ddb14fe4b`, tree `2a85e500d2a0790aa9f58d01552a0da8d379eb19`, before P3A5 began. Recovery required **zero production runtime changes**.

## Production result

The existing 9216 x 6912 Level 0 now runs as an explicit spatial world through the normal production client/server. The 96 x 72 tile organization, twelve room identities, 18 props, ordered lamps, original spawn neighborhood and cartograph/glitched-wall objective remain. The flat source is unchanged and remains the default until human approval.

Maintained sources derive the artifact deterministically from `levels/level0.js`. Spatial revision: `part3a-gameplay-1`. Content hash: `4c1cc53d032780befe3c03f0f5e218d9d0e8fd67bcd5bf3e189a3311e061723a`. Two clean rebuilds of spatial JSON and AI/simulation/entity bundles match their shipped bytes in the fresh extracted package.

| Record | Count |
|---|---:|
| solids | 910 |
| supportPatches | 307 |
| navSurfaces | 12 |
| traversalLinks | 28 |
| spaces | 290 |
| portals | 449 |
| lights | 90 |
| anchors | 1066 |
| viewGroups | 147 |

LONG ROOM has a useful Z+180 branch on `support:upper:long-room`, fifteen real stair risers at x5568–5664/y1008–1488, and a continuous ramp on `support:ramp:long-room` at x6336–6528/y1008–1488. The original Z0 route remains beneath the slab. BLACKOUT has a Z−96 floor on `support:lower:blackout` and a legal south ramp return on `support:ramp:depression`. NORTH has a 28-unit crawl passage at x1632–1920/y816–912. Exact bounds, physical link/support IDs and amendments are in the content manifest and spatial report.

All 3,308 canonical floor-cell footprints are represented; fifteen cells form the intended depression. All twelve rooms remain connected in the 12,956-cell standing base flood. The actual player/species suite executes 82 physical routes, plus overlap, posture, interrupted stairs and falling checks. Ten actual Hound/Smiler graph paths execute waypoint by waypoint. No brain, species constant, movement kernel, network authority or death solver was retuned.

The existing world RNG selects from 195 Hound and 195 Smiler candidates with accepted population, safety/separation and dark-location rules. One cartograph varies among 164 base-reachable candidates; three well-separated glitched-wall exits vary among 511 candidates. The basic objective does not require a vertical route. Nine original lamp centers embedded in pillars were moved 48 units south within their bays; all 90 identities/order, power and range remain. That prior repair and every raw failure remain documented.

## Presentation and gameplay evidence

The physical model includes all 910 solids. The existing renderer uses 130 deterministic spatial buckets and conservative candidate hulls, then visits relevant occluders in deterministic 64-entry texture pages. A real dense frame includes 87 candidates, two pages, eleven lights and 61 draw calls. A separate independent workload checks 1,170 rays and 195 candidate hulls, exact chunk boundaries and input permutation. No physical geometry is removed by rendering quality or camera state.

The retained eight-plane-per-solid, 64-lamp-failure-record and 4,194,304-pixel bounds remain. Solid/candidate/light textures reject device-capacity overflow explicitly; light storage grows beyond its initial 128 rows when required. The production evidence certifies the measured map/workloads, not arbitrary device capacity.

All twelve rooms and seven feature scenes have real served captures without debug labels. Eight corrected/additional LONG ROOM views were recaptured after the local overhead edge-wall correction. The upper slab and its edges fade together only for the local lower camera. The physical/navigation/light/anchor/gameplay arrays remain identical to accepted P3A3. Full/reduced quality preserves candidate IDs and physical/network truth.

Production two-client evidence covers independent same-XY cutaway, hidden peer masks, authoritative fall, reconnect, cartograph pickup and escape. Current-content browser evidence covers visible/IR positive and negative controls, active/settled canonical aftermath, two hands, gear, decal/trail/replay masks, detached beams, caught UI and server-stamped vanish. Twelve real server-owned death cases cover base, upper, lower, stairs, ramp and ledge. Physical picking rejects hidden upper targets across seven viewport/zoom configurations.

## Acceptance dispositions

| Gate | Requirement | Disposition | Executing basis |
|---|---|---|---|
| L0-01 | Deterministic conversion | PASS | Two clean builds equal the shipped artifact and current content hash. |
| L0-02 | Base identity | PASS | Twelve canonical rooms and bounds; 3,308 source floor footprints; all-room physical base circulation. |
| L0-03 | Physical base world | PASS | Complete finite physical solids and named support; source cell coverage and body clearance. |
| L0-04 | Production rendering | PASS | 910 physical/model solids, 1,170 brute-force ray comparisons, 195 candidate hulls, chunk-boundary/permutation checks and actual multiple GPU pages. |
| L0-05 | Upper overlap | PASS | Useful LONG ROOM +180 branch with retained Z0 floor, real slab, independent clients. |
| L0-06 | Stairs | PASS | Finite physical treads; ascending/descending/reversing/departing routes and actual species navigation. |
| L0-07 | Ramp | PASS | Continuous slope routes in both directions; real bodies and readback captures. |
| L0-08 | Lower route | PASS | BLACKOUT -96 depression, rim fall and legal south ramp return. |
| L0-09 | Crawl passage | PASS | 28-unit real clearance; accepted 24-unit crawl fits; standing and incapable species rejected. |
| L0-10 | Props | PASS | Eighteen identities; actual low/window vault, under clearance and tight-gap capability tests. |
| L0-11 | Lamps/materials | PASS | 90 ordered lamps; nine documented within-bay placement corrections; actual visible/IR positive and negative slab controls. |
| L0-12 | Player spawn | PASS | Original neighborhood within 48 units; valid named Z0 support and base circulation. |
| L0-13 | Entity director | PASS | Existing seeded director and populations; 195 candidates per species with safety/separation and upper/lower participation. |
| L0-14 | Cartograph | PASS | One seeded variable selection among 164 base-reachable candidates; real multiplayer collection. |
| L0-15 | Glitched exits | PASS | Three variable supported wall exits from 511 candidates; real normal escape. |
| L0-16 | Navigation | PASS | Ten complete graph/waypoint routes and 82 physical player/species executions; incapable links rejected. |
| L0-17 | Perception | PASS | Actual observation-only memory, anonymous vertical hearing, slab ray/contact rejection, visible/IR separation. |
| L0-18 | Multiplayer | PASS | Real clients, same XY/different Z, independent cutaway, authoritative fall and reconnect. |
| L0-19 | Aftermath | PASS | Twelve actual server-owned deaths at six elevation stations; mass/support/tether checks and real production masked active/settled/beam/vanish lifecycle. |
| L0-20 | Picking/interactions | PASS | Nearest physical visible target at seven viewport/zoom settings; opaque camera and hidden upper targets rejected; physical objective gate. |
| L0-21 | Readability | PASS | All twelve rooms and seven feature scenes captured without debug labels; eight affected/additional LONG ROOM captures refreshed. Human judgment remains pending. |
| L0-22 | Flat control | PASS | Explicit spatial selection; immutable flat source and frozen map; all 46 traces at zero tolerance. |
| L0-23 | Regression | PASS | All seven retained Stage I named suites actually executed with zero exit status; frozen references unchanged. |
| L0-24 | Package | PENDING FINAL ARCHIVE VERIFICATION | Fresh exact-tree extraction in a path with spaces; package-relative build/test/server and redirect checks pass. The finalizer verifies final remote source blobs, modes, tree, archive CRC and final extraction. |

The publication acceptance JSON binds these rows to source evidence and the final source identity. Human approval remains distinct from engineering acceptance.

## Retained regression and portability

All seven named Stage I suites passed at P3A4 and again from the fresh P3A5 extraction:

| Suite | Result | Extracted-run time |
|---|---|---:|
| `s_world25d` | PASS | 5.09 s |
| `s_nav25d` | PASS | 8.04 s |
| `s_perception25d` | PASS | 6.84 s |
| `network25d` | PASS | 108.79 s |
| `physics25d` | PASS | 37.99 s |
| `view25d` | PASS | 277.75 s |
| `perf_world25d` | PASS | 59.25 s |

All eighteen retained flat-suite commands were rerun. Their exact outcomes match accepted Stage I: aggregate 151/162 with the same eleven failure names, shared 22/23 with F22, and all other retained command dispositions unchanged. No inherited failure was relabeled as a new pass.

The initial aggregate attempt and first retry ended before the full summary (at K03 and after P02). Both raw failures remain in the package. Their cause was not established, and neither was accepted. The unchanged `npm test` command completed under direct process supervision; its anchored 151/162 final summary and all eleven exact failure names match Stage I. The retained summary parser's incomplete 60/60 reading was explicitly rejected. No source, test assertion, timeout threshold or expected result was changed to obtain acceptance.

Frozen parity is 46 traces / 35,098 records at zero tolerance, with frozen files unchanged and a byte-identical flat map. Actual served flat menu/gameplay pixels, RAF schedule, state and RNG also match the immutable Stage I package.

Fresh-package tests additionally rerun eight production gates, serve the exact 910-solid definition through `world_config.js`, complete a real spatial wire join, verify local runtime resource bytes/private-route rejection, and execute the ordinary redirect. Commands are package-relative and do not require the original source directory. The finalizer rejects any change to portable-validated code or content before publication. The exact changed-file ledger is audited against Stage I; every packaged source blob and mode is checked against the final remote Git tree.

## Limits and scope

Node v24.19.0 and Chromium 151.0.7922.34 with SwiftShader are the executed environment. Browser captures are very slow on software rendering; there is no hardware FPS certification. Preserved one/eight-player production CPU workloads include cold worst ticks around 845/780 ms and later spikes around 146/135 ms. The accepted 24-active-aftermath CPU/payload limitation, P08 UNKNOWN, historical L5/NZ1 observations and external Google Fonts failures remain disclosed. See the test/failure/performance reports for raw evidence. Awake tethered hands may remain above sloped/tread surfaces; no false sleeping support is assigned.

Human QA must judge stair/ramp direction, slab thickness, upper/lower separation, local cutaway, fairness and game feel. Mechanically stepped motion and basic lighting/art remain within the intended 3A boundary.

Part 3B begun: **NO**. Part 3C+ begun: **NO**. Main modified/merged: **NO**. Human QA: **PENDING**. Stop after verified Part 3A publication.
