# Stage 3B Lighting QA Correction — Fixture Density and Shared Truth

**Branch:** `stage-3b-l-qa1`, from the rejected-lighting parent `b9f3a9b` (tree `3a1ccbb`).
**Law:** a fixture that lights the screen is a real fixture. Gameplay and AI know about it, it has a housing, and BR-RoLE lights it.

## Q0 audit: where the lamps came from (the seam)

Before this pass, the placement was not shared. It was one line of code, `var Fc=[];Oc.forEach(...)`: every 5 cells from a room's corner + 2, every room except the BLACKOUT ZONE. That line was **copied, byte for byte, into four files**:

| copy | used by |
|---|---|
| `assets/index-DKbV5Nv9.js` (the client bundle) | `__api.lamps`: <ul><li>BR-RoLE's lights;</li><li>`light.js` and the bundle's own `Ul()` (client light truth);</li><li>the fixture housings (the bundle hands each lamp to `l0-remaster.js`);</li><li>the lamp hum and the admin spawn check in `mp.js`</li></ul> |
| `sim.js` (built from `dev/sim_head.js` + `dev/sim_glue.js`) | the server AI's adapter (`lamps: Fc`) → `ai.js` lamp field (what light-fearing monsters avoid, the light level hunts read) |
| `dev/sim_head.js` | the source `sim.js` is built from |
| `dev/sim_geo.js` | development tools (`cand.js`, `chk_world.js`) |

The copies happened to agree, but nothing kept them together. Adding fixtures in one copy (say, only BR-RoLE's) would have made the renderer-only fake the pack forbids.

**The smallest correct change.** `world.js` is already one module that both sides load: the page as a classic script before the bundle, and the server with `require()`. Its `W.carve` already edits the same map on both sides. The placement now lives there, as `W.lamps(rooms, floor, pillars, cols, rows)`. All four copies call it on their own map:

```js
var Fc=window.WORLD.lamps(Oc,(n,r)=>n>=0&&r>=0&&n<FBW&&r<FBH&&!!kc[r*FBW+n],Pc,FBW,FBH);   // bundle
var Fc=WORLD.lamps(Oc,(n,r)=>n>=0&&r>=0&&n<FBW&&r<FBH&&!!kc[r*FBW+n],Pc,FBW,FBH);          // sim.js, sim_head.js, sim_geo.js
```

`sim.js` was rebuilt with `dev/build_sim.sh`. Its diff against the parent is exactly that one statement. The bundle's diff is also exactly that one statement. No broad rewrite was needed, so there was no reason to stop.

## Placement rules (`world.js` `W.lamps`, deterministic: the same list on every load, client and server)

1. **The original grid stays, in its original order.** Indices 0..89 keep their meaning: every 13th is still an old, dim tube (the same rule in BR-RoLE and in the remaster's "aged" housings).
   - The only change is PILLAR HALL. Its nine fixtures sat exactly inside its nine pillars, so their light came from inside the pillar. Each moves one cell (north) off its pillar.
   - This also fixes the fixture-over-pillar draw order. The pack scoped that fix out *unless it blocks the receiver correction*, and it does: a pillar face cannot be lit "from one side" by a light inside it (scene D).
2. **A second, staggered grid in every working room.** It has one fixture per original grid square, halfway between the originals: +2 or +3 cells on each axis, chosen per fixture by a hash.
   - About 1 in 7 are missing (gaps). DAMP ROOMS keeps more of its gaps (4 in 10), so it stays the dimmer, failing room.
   - The result is the uncanny repetition of the original grid plus inconsistent spacing, not a sterile office grid.
3. **A line of fixtures down every corridor.** The corridors are the floor outside every room, in its connected pieces. The fixtures run along each piece's long axis, about every 4 cells, near the middle (a cell either way by hash), with a missing one now and then.
4. **Nowhere near the BLACKOUT ZONE.**
   - No fixture within 7.5 cells (720 px) of it. That is past every light's reach: the visual tail ends at exactly 720 px, and gameplay at 380.
   - Its two approaches (from YELLOW HALL and from DAMP ROOMS) stay genuinely dark. The zone itself has no working fixture, as before; its dead housings are visual-only records.
5. **Placement limits.** No fixture in a doorway or a hole in a wall, on or beside a pillar, or closer than 2.2 cells (211 px) to another.

Dim tubes stay at the same rate: the added fixtures follow the same every-13th rule, so 7 of the 80 new ones are old tubes (14 of 170 in all).

## Counts

| zone | before (`b9f3a9b`) | after | |
|---|---:|---:|---|
| YELLOW HALL | 7 | 15 | |
| REPEATING ROOMS | 13 | 19 | |
| SEGMENTED ROOMS | 7 | 13 | |
| HUMMING ROOMS | 8 | 12 | |
| NORTH ROOMS | 6 | 12 | |
| LONG ROOM | 9 | 13 | |
| **BLACKOUT ZONE** | **0** | **0** | genuinely unlit (dead housings only, visual records) |
| DAMP ROOMS | 6 | 9 | keeps more gaps (its failing identity) |
| RED ROOMS | 6 | 10 | |
| ARCH GALLERY | 12 | 20 | |
| PILLAR HALL | 9 | 13 | the 9 originals moved off their pillars |
| DEEP CARPET | 7 | 13 | |
| CORRIDORS | 0 | 21 | none in the two approaches to the BLACKOUT ZONE |
| **total** | **90** | **170** | ×1.89 |

## Coverage (working floor: every floor cell except the BLACKOUT ZONE, 3 092 cells)

**Share of floor cells with a fixture in clear line of sight (walls and pillars block)**

| nearest fixture | before | after |
|---|---:|---:|
| within 240 px | 49.3 % | 77.0 % |
| within 380 px (the gameplay lamp reach) | 70.6 % | 92.5 % |
| within 480 px | 80.3 % | 96.6 % |
| none within 600 px | 11.5 % | 1.7 % |

**The server AI's lamp field over walkable 48 px cells**

| | before | after |
|---|---:|---:|
| lit share | 68.9 % | 87.7 % (the engine's own field, read back from a real `createSim`: 87.7 %) |
| mean field | 0.147 | 0.235 |

The field is still the max of single fixtures (≤ .43), unchanged in form. More of the level now counts as lit for gameplay. The pack expects this, and no AI threshold or behaviour was retuned.

The fixture map is in `dev/stage-3b-l-qa1/evidence/fixture_map.txt`:
- `O` the original grid, kept;
- `+` added;
- `P` a pillar.

## Evidence

**`dev/stage-3b-l-qa1/fixtures_qa1.js`** (node: the bundle's own code in a VM, a real `createSim`): **7 / 7**

| check | what it shows |
|---|---|
| T1 | `world.js` holds the only placement. The four former copies call it, and none keeps the old loop. |
| T2 | The client's list and the server's list are the same 170 fixtures in the same order. They come from the bundle's own code and from the adapter `sim.js` hands the AI engine, both equal to `W.lamps`, and a second run is identical. |
| T3 | The server AI knows every fixture: its lamp field is .43 at each. Every lit cell has a fixture of the list within 380 px in clear line. |
| T4 | The parent's 90 are kept in order. 81 are unchanged; 9 (PILLAR HALL) moved one cell off their pillars. |
| T5 | Nothing within 720 px of the BLACKOUT ZONE. |
| T6 | Every fixture is over floor, none in a doorway, none on a pillar; the closest pair is 272 px apart. |
| T7 | The counts and the coverage above. |

**`dev/stage-3b-l-qa1/fixtures_page_qa1.js`** (the running game, the real server), standing beside **each of the 170 fixtures** in turn:
- P1: the page's list is `W.lamps` on the page's map and the server's list.
- P2: every fixture has its housing in the remaster's ceiling layer (rooms and corridors).
- P3: BR-RoLE draws it as a light (its light is in the buffer beside it).
- P4: `light.js` and the bundle's `Ul()` see it.

**`dev/stage-3b/test_3b.js`** (the remaster in a VM): R01 and R09 now include the corridors' fixtures.
- 170 lamps redirected out of 170.
- 170 + 6 visual-only = 176 housings.
- The visual records' `lampCount` is 170. Their revision is `3b-l-qa1-fixtures`, with the content hash refreshed.
