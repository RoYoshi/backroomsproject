# Stage 3D HQ2 tools (development only)

HQ2 adds two things to the accepted HQ1 game:
- NEW RUN as a server-approved explosive self-destruction;
- living Wanderers that physically block each other.

None of these files is served or loaded by the game. Every server they start uses the synthetic admin passcode (`dev/stage-3d/lib3d.PASS`). They build on `dev/stage-3d/lib3d.py` and `dev/stage-3d-hq1/hq1lib.py`.

Collision tools use **ordinary** test players, without the test passcode. An admin's own movement skips the server's checks, so a collision test whose players were admins would test nothing. They are placed by a quiet admin connection instead (`ws_place.js`).

| Tool | What it does |
|---|---|
| `preflight_hq2.py` | H2-0: the accepted parent on GitHub, in the HQ1 receipt and locally; ancestry; the HQ2 branch absent; every remote branch recorded (`evidence/h2-0/remote_heads_before_hq2.json`) |
| `verify_remote_hq2.py` | After each push: the remote branch, its commit and tree, the straight line from HQ1, every other branch untouched |
| `scope_hq2.py` | The H2-0 file allowlist checked against what changed since the parent; `--manifest` writes the parent's production blobs |
| `corridor_widths.js` | Level 0's passage widths in walk mode: the evidence for the collision radius (decision D1) |
| `proto_lab.js` | Protocol scenarios against a real server, with raw WebSocket clients that speak what `mp.js` speaks: H2-0's RED (the NEW RUN cooldown phantom, players walking through each other, stacked spawns); H2-1's NEW RUN decision (`nr_flow`, `nr_elig`, `nr_held`, `nr_e02`); H2-2's blast (`nr_boom`, `nr_boom_lights`, `nr_boom_reset`, `nr_boom_again`); H2-3's collision on the server (`col_head`, `col_wide`, `col_two`, `col_crowd`, `col_spawn`, `col_respawn`, `col_member`, `col_held`, `col_rooms`, `col_bypass`); H2-4's world epoch (`world_msgs`); H2-5's races and abuse (`nr_abort` E04, `nr_race` E05, `nr_many` four NEW RUNs at once and a room next door, `abuse` 1,500 hostile messages, `col_chase` C09, `fx_wall` the regression found at H2-5) |
| `nr_browser.py` | NEW RUN pressed in a real page, watched by a second page and by the server's own player list (`--plan red`: H2-0; `--plan e02`: the cooldown, GREEN; `--reanalyse`) |
| `col_browser.py` | Two ordinary players meeting in the narrow corridor, by keyboard (`--case pass`: H2-0's RED; `head`, `aside`: H2-4's checks; `--lag MS`) |
| `reset_epoch.py` | An admin world reset in the middle of a death (`--case death`, R01) or a NEW RUN blast (`--case boom`, R02), on four pages: a late joiner and delayed old messages (R03), nobody's NEW RUN (R04); H2-0 measured the RED with it, H2-4 checks the GREEN (`--reanalyse`) |
| `srv_load.js` | Eight ordinary players moving (`spread`) or crowding one point (`crowd`): the server's CPU, step time, ping and corrections |
| `ws_watch.js` | A quiet observer: the server's own player list, `fx` and `bodies`, with arrival times |
| `ws_place.js` | A quiet admin: monsters removed, god mode, players moved where a test needs them (admin BRING) |
| `hq2lib.py` | Shared helpers: ordinary players joining, placement, the observer |
| `aa_gates.py` | H2-0: the performance gates from the A/A run (the formulas fixed before the numbers were read) |
| `mutate.py` | A copy of the game with one deliberate break (`--list`), to show a test catches what it claims to: E02 (no cooldown; the client starting first), E01 (approved but still in the world), C08 (no collision; end points only, no sweep; the 2 px tolerance on the end point, so steps creep; a wall route's hop swept as a straight line), C09 (no prediction), R01 (the old replays live on), R03 (old-world messages taken) |
| `peers_unit.js` | `server/peers.js` on its own: the exact properties (floor, sweep, no creep, routes, free spots), a fuzz of 1.2 million moves, and the cost per packet with seven peers (the 5 µs gate) |
| `old_fixtures.js` | Four older checks whose fixture puts a player on a spot their own admin or observer stands on (`audit_net` A1, M4, R2; `audit_net2` MT1), run with that body out of the way, and once more with it there (the HQ2 rule) |
| `predict_unit.js` | H2-4: the real `move.js` headless with other players in `window.__peerBodies`: solo identical to HQ1's, frame-rate independent, the server agrees with every predicted move, the slide, the vault refusal |
| `net_predict.js` | H2-4: "pages" that predict (the real `move.js`, mp.js's handling of the wire) on a real server, with lag each way: C09 head-on and past a shoulder, C10 two runners, eight players in a full room; H2-5: `c10_rough`, a rough link (100/200/300 ms, jitter, retransmission stalls) |
| `lag_proxy.js` | H2-4: a TCP proxy that delays everything a real browser page sends and gets (C10 in `col_browser.py --lag`) |
| `ws_reset.js` | H2-4: the admin world reset a set time after a death or a NEW RUN blast begins, and what the server then sends (`reset_epoch.py`) |
| `srv_ab.py` | `srv_load.js` pairs, HQ2 against an export of HQ1, judged by the server gates frozen at H2-0 |
| `boom_browser.py` | A NEW RUN blast on three pages: the initiator in front of a wall the server's blast will throw her at, a spectator, a late joiner; E01, E06 (against `boom_ref.js`), wall stains, E03 (the page's own light log), the sound; `--kind`, `--light-off` |
| `boom_ref.js` | The server's own run of a blast after given numbers of 240 Hz steps (E06's reference) |
| `boom_geo.js` | 400 blasts all over Level 0 (open floor, hugging walls): finite, blood on the floor, at rest out of walls, asleep before the corpse, wall marks only on faces, the light released at the blast |
| `death_equiv.js` | E08: the eight Hound/Smiler deaths and the light profiles identical, number for number, to another tree's (HQ1) |
| `golden_hq2.js` | H2-5: 3H0's server golden traces, HQ1 against HQ2, every difference sorted into a documented HQ2 change or not (3D's `golden3d.js` refuses HQ2's server) |
| `cli_golden_hq2.js` | H2-5: 3H0's client golden traces (`mp.js` in a fake-clock page), HQ1 against HQ2, with HQ2's globals declared and its vanish claims gone |
| `contract_hq2.js` | H2-5: every message of the server and of `mp.js` against 3H0's protocol contract with 3D's and HQ2's additions (`--raw`: `wire_capture.js`'s) |
| `wire_capture.js` | H2-5: every kind of HQ2's new message, both ways, from a real server (NEW RUN, its refusal, the blast and a late joiner's, a Hound C wall death, a world reset, soft corrections) |
| `static_hq2.js` | H2-5: HQ2's server-only code, tools, evidence and reports never served; the client files served |
| `e09_browser.py` | H2-5: E09 on three real screens - a blast in a blacked-out room, reduced motion, a muted spectator, a page with no permission to play sound behind the wall: no flash, no camera jump, no sound where there must be none |
| `multi_browser.py` | H2-5: a full room of real pages (seven, then eight; one CPU-throttled, one lagged): a crowd, two NEW RUNs at the same moment, a late joiner |
| `nr_soak.js` | H2-5: the server's forced-GC heap over 32 NEW RUN blasts with players touching (the 0.01 MB per event gate) |
| `perf_hq2.py` | H2-5: the browser's cost of the blast (against the same run's Hound C death) and of two players in contact (against idle) |
| `perf_ab_hq2.py` | H2-5: `dev/stage-3d/perf_death.py` pairs, HQ2 against HQ1, judged by the browser gates frozen at H2-0, and twenty corpses |
| `paired_shots.py` | H2-5: the same scenes photographed on HQ1 and on HQ2 (and on HQ2 twice, the A/A), picture against picture |
| `f13_hq2.js` | H2-5: `npm test`'s 2F F13 (encounter identity cleared) with HQ2's lifecycle: the older test calls `sim.vanish`, removed at H2-1 |
| `parity_judge.py` | H2-5: `dev/stage-3d/parity3d.py`'s numbers (it reports, it does not gate) judged against HQ1's own: every death within 1 px of the server's corpse on the victim's and the spectator's screen |
| `video_hq2.py` | H2-5: the films, real pages recorded side by side with the build hash and each page's frame time burnt in: `--plan main` (the narrow-hall stand-off, squeezing past, the blast, a late joiner, SPAWN), `--plan lag` (the wide-hall side-pass, lag recovery) |

Evidence for each checkpoint is in `evidence/h2-0` and onwards.
