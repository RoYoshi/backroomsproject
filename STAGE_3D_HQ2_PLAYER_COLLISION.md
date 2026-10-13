# Stage 3D HQ2 — player collision

Living Wanderers are solid to each other. The server decides who stands where; the browser only predicts (H2-4). Nobody can push, shove or hurt anybody: the only thing that changes is that you cannot walk into or through another living player. This document describes the rules as built, checkpoint by checkpoint.

## H2-3: the server

### The body

Every player is a circle of radius 18, the drawn body (the bundle's avatar circle). Two living players never come closer than **D = 36 px**, centre to centre. Walls keep their own radius (15, or 14 sliding and 13 crawling); hands, hat, shadow and light are never colliders.

### Who is solid

Both the player who moves and the one in the way must be:

| | Solid? |
|---|---|
| in a run, alive (`active`, not `dead`) | yes |
| an admin in a run (its own moves skip the walls, not the players) | yes |
| god mode, spawn protection | yes (they change nothing here) |
| in the menu: never joined, or after an approved NEW RUN | no |
| dead (and every corpse) | no |
| held in a capture | no: the monster's drag is never blocked |
| out through a glitched wall (`exited`) | no |
| disconnected | no: gone with the connection |
| in another room | never: each room has its own players |

### The rule (`server/peers.js`, called from `server.js` `mvCheck`)

Every position packet of a solid player goes through the server's checks in a fixed order: the distance budget, then the walls (`sim.moveOk`), then the other players. Walls always win: a move the walls refuse never reaches the players' check.

For every other solid player q, an accepted move from P0 to P1:

1. **ends no closer to q than min(|P0 − q|, D).** Two players can never get deeper into each other. An overlap can only shrink, so two players put on one spot separate freely and nobody is ever soft-locked. No number of tiny steps creeps closer: the floor is exact (1e-6 px).
2. **never passes through q's body:** the straight path between P0 and P1 never dips more than TOL = 2 px below that floor. However long the step (a lag burst up to the 540 px budget), a body in the middle stops it. The 2 px are what let a step slide round a body: one step round a circle is a chord, and a 12–24 px chord at contact dips 0.5–2 px.
3. **A long hop that the walls allow only along a route round them** (`sim.moveRoute`: a lag burst round a corner) is swept along that route, leg by leg, not along the straight line.

When a claim breaks the rule, the server accepts as much of it as it may. It never refuses outright, and never moves anybody else:

1. **The slide:** the part of the claim that goes into a body is removed, the part along it kept. This is the same rule the browser's prediction will use (H2-4), so the two agree on a slide. The walls must accept the slid point too.
2. **Else the clamp:** the furthest legal point of the straight claim (and the walls must accept it).
3. **Else the player stays.**

A route hop is clamped on the leg that meets a body.

**Telling the client.**
- Within 8 px of its claim: silent.
- Further off than 8 px, or more than 2 px off for 0.3 s: a soft correction `{t:'tp', x, y, pc:1}`, at most one every 0.3 s.

The hard `tp` (walls, budget, teleports) is unchanged.

**Order and ties.** Node handles one message at a time. Two players' packets in the same server wake are checked in arrival order, each against the other's latest accepted position, so the second one is the one stopped. Positions come only from the server; nothing a client says about anyone else is ever read. A zero-length move is accepted as it is; the arithmetic is closest-approach on segments, so no zero distance can produce a NaN.

**The AI** hears and sees only what the server accepted (`obsV`), as before: a player blocked by another is heard at the speed it really moved.

### Placement

Spawns, respawns, admin BRING / GOTO / glitch / item / entity teleports and the admin world reset still put the player where they always did. The one change: when another solid player stands on or next to that spot (within D + 8 = 44 px), the player goes to the nearest free spot instead (`peers.freeSpot`).

**`freeSpot`.**
- Up to 72 candidates on six rings (44–220 px) round the target, always in the same order.
- It takes the first one that is clear of the walls by 20 px and at least 44 px from every solid player.
- If none is free, it falls back to the target itself; the overlap rule lets anyone walk out of it.

**A join or respawn.** The page chooses its own spawn spot (the bundle's own choice, as before) and the server checks it is a spawn spot (`spawnOk`). If someone stands within 44 px of it, the nearest free spawn spot round it is used, and the page is told with a hard `tp`.

**An admin's own jump** (120 px or more: a teleport) lands where it was aimed unless that is inside a player (closer than D). Then it goes to the nearest free spot, and the page is told.

**Packets in flight.** For 0.9 s after any server-side placement (the existing grace), a packet that the other players would cut short was sent before the placement, back towards the old spot. It is ignored, as a refused one is, and draws no correction.

**State.** No per-player collision state beyond two timestamps, kept in the movement record that already exists, and three counters. Nothing grows with time or with the number of events.

### Where this differs from the audit's wording (D2, D3), and why

| Audit (H2-0) | Built | Why |
|---|---|---|
| D2: the segment never comes closer than min(\|P0 − q\|, D) − TOL, TOL = 2 px | The end point keeps the exact floor; TOL applies to the path only | As written, every packet could end 2 px closer than the last, so 1 px steps would creep through a body. Mutation `c08_creep` builds exactly that; `col_bypass` and `peers_unit` U3 catch it |
| D2: the move is accepted up to first contact | First the slide (D3's own rule for the browser), then first contact | So the server and the browser's prediction agree on a slide; a client that does not predict slides round a body instead of stopping dead |
| D2: freeSpot for every server placement | freeSpot only when someone is within 44 px of the spot | The level's own spawn point is not clear of walls by even 10 px in walk mode (`sim.clearAt`). Always moving off it would have moved a lone player's spawn and the world reset's target, which have nothing to do with collision. Found by `old_fixtures` R2h, kept in `attempts/old_fixtures_spawn_point_not_clear/` |
| (not in the audit) | A route hop is swept along its route | Found by the first `col_bypass` run (`attempts/proto_route_burst_through_a_body/`). A claim to (1072, 1100) from contact in the corridor: the straight line passed Bob at 34.9 px, inside TOL, while the only route the walls allow runs through him. The server accepted it, and Alice was through |
| (not in the audit) | In-flight packets after a placement are ignored | Found by the first `col_spawn` run (`attempts/proto_spawn_inflight_packets/`): the page's packets from before its `tp` walked it back to the crowded spot |
| D3: silent within 8 px; soft correction beyond, or above 2 px for 300 ms; at most every 300 ms | As written | |

### Evidence

`dev/stage-3d-hq2/evidence/h2-3/` (its `SUMMARY.md`):

| What | Result |
|---|---|
| C01–C08 on a real server (`proto_lab.js col_*`, ordinary players following corrections) | 48/48. Never closer than 36 px in any snapshot: head-on, sliding past, two movers, a crowd of six, spawns, BRING, the world reset, an admin's jump, every membership case, other rooms, and every bypass tried |
| `server/peers.js` alone (`peers_unit.js`) | 6/6: 1.2 million fuzzed moves; no creep after 100,000 steps of 0.01 px; the cost per packet with seven peers at p99 is 0.15–0.32 µs, and 1.71 µs on the slow path (gate 5 µs) |
| Mutations | no collision, no sweep, the end-point tolerance (creep), straight-line route hops: each one fails the tests |
| Server cost, three pairs against HQ1 | `spread`: CPU +7.2 % (gate +10 %), step +2.3 %, ping p99 +0.00 ms. `crowd`: CPU +10.2 % (gate +15 %), step −1.0 %, ping +0.33 ms |
| H2-1 and H2-2 again | 43/43 on the protocol; the blast and E02 in the browser 7/7 each |
| Older suites | the expected deltas only: H2-1's three, plus `audit_net` A1, M4, R2 and `audit_net2` MT1, whose fixture stands a player on their admin's or observer's spot. `old_fixtures.js` re-runs those four checks with the body out of the way (6/6) |

### What H2-3 does not do yet

- **No prediction in the browser** (`move.js`, H2-4). A page walking into a player is stopped by the server and pulled back by its corrections, a snap every 0.3 s or so: the server's answer is right, the feel is not yet. `browser/col_pass` measures it.
- **No blending** of the soft correction (`mp.js`, H2-4): the page treats it as an ordinary `tp`.
- **The world epoch on the screens** (R01–R03, H2-4).
