# H2-3: living players are solid to each other (the server)

`STAGE_3D_HQ2_PLAYER_COLLISION.md` (section H2-3) describes the rule as built. There is no client prediction yet (H2-4).

## What changed

| File | Change |
|---|---|
| `server/peers.js` (new, never served) | The geometry, pure functions:<br>• `legal`: the end-point floor, and the path within TOL = 2 px<br>• `resolve`: slide, else clamp, else stay<br>• `sweepPath`: a wall route's hop, leg by leg<br>• `freeSpot`: 72 candidates on six rings |
| `server.js` | `mvCheck`: after the walls, the other solid players (`blockers`), with the soft correction `peerCorrect` (`tp` with `pc:1`). In the grace after a placement, a cut-short packet is ignored.<br>Placement onto a free spot when the spot is taken (`placeFree`) for:<br>• join and respawn;<br>• the page's spawn choice;<br>• `moveTo` (BRING, GOTO, glitch, item, entity);<br>• the admin world reset.<br>`adminMove`: an admin's steps are resolved, its jumps land free |
| `sim.js` (from `dev/sim_glue.js`) | `moveRoute`: `moveOk`'s own test, returning how a move is allowed (the straight line or the route's points). `moveOk` is now `moveRoute(...) !== null`, the same answer for every input |

## Results

### Protocol (`proto/col_all`): 48/48 checks pass

Every player is an ordinary player following the server's corrections as a page does. Separation is read from the quiet admin's snapshots at 20 Hz, in whole px: "never closer than 36" reads as ≥ 35.29.

| Gate | Scenario | What was checked |
|---|---|---|
| C01 | `col_head` | **Head-on into a standing player in the one-tile corridor.** Minimum 36.0 px over 77 snapshots; stopped at x 976 against his 1012.<br>8 soft corrections, at least 302 ms apart; afterwards her page agrees with the server.<br>She backs away freely: the server follows exactly, with no correction.<br>He steps 30 px aside; she slides past his shoulder to the far end in 0.9 s (minimum 36.1).<br>He is never moved and gets no correction |
| C02 | `col_wide` | **On open floor.**<br>• 12 px off his line: she slides round him (minimum 36.2), at most 39 px off her line, and reaches the far side in 1.52 s (1.5 s with nobody there).<br>• Dead centre: she stops at contact and is never pushed sideways (y stays on the line). |
| C03 | `col_two` | **Two players walking at each other.**<br>• Head-on: both stop at contact (36.0), neither passes; 8 soft corrections each.<br>• Two claims of the same point back to back: one gets it, the other stops at 36.<br>• One burst packet from far behind to 120 px past him: stopped at contact |
| C04 | `col_crowd` | **Six walking into one point for 4 s.** The minimum pair is 36.1 over 97 snapshots. They pack round the point (33.5–38.2 px from it), with 12 soft corrections each and nothing harder. All six walk back out to within 0 px of where they started |
| C05 | `col_spawn` | **Placement.**<br>• A join whose page spawns exactly on a standing player: 44 px away, told by a hard `tp`; she is not moved.<br>• A spawn 22 px from her: 46 px from everyone.<br>• Admin BRING onto her: 44 px.<br>• The world reset: four players 44 px apart, one on the level's spawn point as before.<br>• An admin's jump onto her: 44 px, told; its steps into her stop at 36 |
| C05 | `col_respawn` | A real hound kills an ordinary player; his respawn spot, chosen exactly on a standing player, becomes 44 px away, told by a hard `tp` |
| C06 | `col_member` | **Not solid:**<br>• a player whose NEW RUN was approved (Bob walks through her spot and her blast's corpse);<br>• one in the menu, even while her page sends positions;<br>• one who has disconnected;<br>• a dead one and his corpse.<br>Back in a run, she is solid again |
| C06 | `col_held` | A player held in a real capture: the observer walks into him (closest 0 px), with no clamp and no peer correction |
| C07 | `col_rooms` | A player in another room is never a blocker; the control in the same room stops at contact |
| C08 | `col_bypass` | **Nothing gets past, the overall minimum stays at 36, and he is never moved:**<br>• 70 steps of 1 px;<br>• 80 steps of 0.25 px from contact;<br>• a 280 px burst through him;<br>• a skim to a legal point (44 px) on his far side;<br>• a burst to (1072, 1100), which the walls allow only by a route past him;<br>• a 40-packet flood;<br>• nine malformed numbers.<br>Afterwards she walks away normally |

**The H2-0 RED cases measured again** (`proto/red_cases_now`, the H2-0 clients, which do not follow corrections):
- `col_pass`: minimum 36, stopped at 976, did not cross (HQ1: 20 px, crossed).
- `col_tiny`: minimum 36 (HQ1: 0).
- `col_stack`: the third player spawned on a standing one is put 44 px away by a hard `tp`. Her client ignores the `tp` and keeps claiming the old spot, so it walks her back to contact, 36 px (HQ1: 0).

**H2-1 and H2-2 again** (`proto/nr_all`): 43/43 pass.

### Unit, fuzz and cost (`unit/peers_unit`): 6/6

- **U1:** the exact floor, no passing through, overlaps that only shrink, zero distance, and chords round a body within TOL.
- **U2:** a fuzz of 3,000 trials with 1.2 million claims (932,301 free, 264,336 slid, 1,875 clamped, 1,488 stayed). Every accepted move is finite and never closer than the floor. None goes through a body or further than claimed. A pair once apart stays apart, and the peers are untouched.
- **U3:** 100,000 steps of 0.01 px end at 36.000 px; 2,000 zig-zag steps of 1 px end at 36.001 px.
- **U4:** `sweepPath` over 4,000 routes.
- **U5:** `freeSpot` over 3,000 cases, deterministic.
- **B, the cost per packet with seven peers** (gate ≤ 5 µs at p99):

| Case | p99 |
|---|---|
| far (free) | 0.15 µs |
| into one (slid) | 0.32 µs |
| a tight ring of seven | 0.30 µs |
| the slow path: slide refused, bisection | 1.71 µs |

### Mutations (`mutation/`): each one caught

| Mutation | Effect | What fails |
|---|---|---|
| `c08_no_peers` | no collision | `col_head` 4/8, `col_bypass` 2/9, `peers_unit` U2/U3 |
| `c08_end_only` | no sweep | `col_bypass` 4/9 (the burst, the skim, the flood, the malformed number's route hop); `peers_unit` U1/U2 |
| `c08_creep` | D2's tolerance on the end point | `col_bypass` 1/9: every bypass case (minimum 1 px); `peers_unit` U1–U4 (100,000 steps of 0.01 px end at 1.0 px) |
| `c08_no_route` | route hops swept as straight lines | `col_bypass` 5/9: the route burst, and everything after it (she is through) |

### The server's cost (`perf/srv_ab`)

Three interleaved pairs per layout against an export of HQ1, judged by the H2-0 gates. All gates are met.

| Layout | Pairs: CPU / step / ping p99 | Mean | Gate |
|---|---|---|---|
| `spread` (nobody touches) | +11.8 % / +4.3 % / −1 ms<br>+0.7 % / −8.0 % / +1 ms<br>+9.2 % / +10.6 % / 0 ms | CPU +7.2 %, step +2.3 %, ping +0.00 ms | +10 %, +13.3 %, +5 ms |
| `crowd` (seven pressing on one point) | +12.8 % / +1.9 % / 0 ms<br>+15.9 % / +3.8 % / +1 ms<br>+1.9 % / −8.6 % / 0 ms | CPU +10.2 %, step −1.0 %, ping +0.33 ms | +15 %, +15 %, +5 ms |

- In `crowd`, the minimum separation at the end is 35.5 px in whole-px snapshots (HQ1: 0).
- Without prediction, the seven pressing players drew 1,002–1,010 soft corrections per 45 s between them: the 0.3 s limit, about 3.2 per player per second. H2-4's prediction is what takes these away.
- The peer check itself costs about 0.3 µs × 140 packets/s, about 0.04 ms per second. Most of `spread`'s pair-to-pair spread is run-to-run variance; the A/A noise for that layout was 2–3 %.

**Network** (`perf/traffic8_*`): 35,318 → 35,464 B/s per client (+0.41 %; the H2-5 gate is +3 %). Six deaths, every check of the tool passes on both.

### The older suites that run the real server (`existing/`)

| Suite | Result | Failures |
|---|---|---|
| `s_audit` | 8/9 | L9: H2-1's delta |
| `death_net` | 15/16 | N9: H2-1's delta |
| `light_net` | 8/8 | |
| `s_ir` | 3/3 | |
| `ir_net` | 4/4 | |
| `audit_net` | 13/17 | D3: as on HQ1. A1, M4, R2: new, see below |
| `audit_net2` | 8/11 | DD2: as on HQ1. LC4: H2-1's delta. MT1: new, see below |

The four new failures are one fixture: the old test's admin or observer stands in the world on the very spot the test then puts a player.
- **A1:** an admin at (4000, 3504) BRINGs a player and expects him on top of it. He lands 44 px beside it, at (4044, 3504).
- **M4:** the same BRING to one side of a wall. Then he is refused through the wall where he landed (3620, 1560), not at the admin's spot it expected (3576, 1560). The hop itself is still refused: he never reaches the far side.
- **R2:** its observer stands on the level's spawn point, so the respawn lands 44 px beside it, at (1004, 3264).
- **MT1:** the admin stands on each trace's first point. The brought player's first packet claims that spot and draws one soft peer correction (corrections 1–2 per trace); every trace still ends at 0 px from the client.

They are left as they are and replaced by `old_fixtures` (6/6), which runs the same checks with the admin out of the world, and each once more with a body in the way:
- A1h (exactly there) and A1b (beside a joined admin: 44 px);
- M4h (the hop refused, he stays on his side);
- R2h (back exactly on the spawn point, no correction) and R2b (someone standing on it: 44 px beside them);
- MT1h (all eight real `move.js` traces, plain and in lag bursts: 0 corrections, 0 px end gap).

### Real browsers (`browser/`, SwiftShader)

**`col_pass`.** Two ordinary pages in the corridor; Alice holds D for 3.5 s into Bob.
- **The server:** stopped at contact. Minimum 36.0 px, Alice at x 976, Bob never moved.
- **Alice's own page:** with no prediction yet, it ran on to x 1062 (50 px past Bob's centre) before the first correction reached it, then jumped between 976 and 1010 while D was held. It ends at 976, agreeing with the server.
- Screenshots: `shots_col_pass/`. This is what H2-4's prediction and blending are for.

**H2-2's blast and H2-1's E02 again:** `boom_flashlight` 7/7, `nr_e02` 7/7.

## Attempts kept (`attempts/`)

- **`proto_route_burst_through_a_body/`:** the first run of the collision suite.
  - A malformed packet (y as the string "1100") was read as a number, as the server always has. It became a claim from contact in the corridor to (1072, 1100).
  - The walls allow it only by a route through the corridor past Bob. The straight line passed him at 34.9 px, inside the 2 px path tolerance, so the server let Alice through.
  - Long hops allowed only by a route are now swept along that route (`sim.moveRoute`, `peers.sweepPath`), and the case has its own check.
- **`proto_crowd_walk_ended_early/`:** the harness's walkers stopped once their own page thought it had arrived, so the crowd pressed for 1 s instead of 4 s (38 snapshots). They now keep the key down for the whole time.
- **`proto_spawn_inflight_packets/`:** two causes.
  - The harness re-sent the literal spawn spot after the server's `tp`, as a page that ignores corrections would.
  - The server let packets sent before a placement walk the player back to the crowded spot. Such packets are now ignored during the grace.
- **`old_fixtures_spawn_point_not_clear/`:** with no one anywhere near, a lone player's respawn moved 44 px off the level's spawn point. The spawn point is not clear of walls by even 10 px (`sim.clearAt`), and `freeSpot` wants 20. Placement now keeps the spot as before unless someone stands within 44 px of it.
- **`older_suites_first_look/`:** the older suites run once before these changes (the four new failures above, then with the spawn-point issue too).
- **`old_fixtures_wrong_check_count/`:** passed all 6 checks but exited 1 (it counted 7).
- **`browser_col_pass_alice_killed_before_the_test/`:** void. A hound killed Alice in the seconds between her join (a lone player's join makes a new world with new monsters) and the placement that removes them. The monsters are now removed as soon as she has joined, and a run says whether both players were alive when it began.

`steps.txt` lists every step with its exit code and time, the reruns included.
