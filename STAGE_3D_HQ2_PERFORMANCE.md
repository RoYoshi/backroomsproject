# Stage 3D HQ2 — performance (H2-5)

**How it was measured.**
- Every gate was fixed at H2-0 from an A/A run (two exports of HQ1, interleaved) before any HQ2 measurement was read (`STAGE_3D_HQ2_AUDIT.md` section 5; `dev/stage-3d-hq2/evidence/h2-0/aa/perf_gates.json`). No gate was moved afterwards.
- H2-5 measured the final tree against an export of the accepted parent, HQ1 `ebb3bd6`, interleaved, on this machine, in this session, with nothing else running.
- Evidence: `dev/stage-3d-hq2/evidence/h2-5/perf/` and `soak/`.

**What the numbers can and cannot say.**
- All browser numbers come from SwiftShader software rendering on two CPU cores. They are paired comparisons on one machine and say nothing about a GPU. No FPS claim is made for any real device; untested low-end machines are unknown.
- The two-page windows here draw a frame every 0.6–1.0 s. A single window's median moves by up to 25 % between identical builds (the A/A), which is why the browser gates are judged on the mean of at least three interleaved pairs.

## 1. Every gate

| Gate (fixed at H2-0) | Limit | Measured | |
|---|---|---|---|
| Browser frame time, HQ2 against HQ1 (`perf_ab_hq2.py`, 4 interleaved pairs, `perf_death.py --rounds 2`) | median ≤ +7–15 %, p95 ≤ +10–20 %, per window and page | every window and page within; the means run from −3.5 % to +7.4 % (table 2) | **met** |
| Twenty corpses, on and off screen (HQ1's R4; 3 pairs) | ≤ +10 % | −3.3 % to −8.0 % | **met** |
| The blast's window against the same run's Hound C death window (`perf_hq2.py`, 3 rounds) | ≤ 1.10 × | Alice 0.77 ×, Bob 0.78 × | **met** |
| Two players in contact, moving, against the same run's idle (`perf_hq2.py`) | ≤ 1.07 × | Alice 0.82 ×, Bob 0.83 × | **met** |
| Server CPU, 8 players, `spread` (`srv_load.js`, 3 pairs, 45 s) | ≤ +10 % | +4.9 % | **met** |
| Server CPU, 8 players crowding one point, `crowd` | ≤ +15 % | +8.5 % | **met** |
| The 60 Hz step's mean, `spread` / `crowd` | ≤ +13.3 % / ≤ +15 % | +5.3 % / +0.6 % | **met** |
| The admin ping's p99, `spread` / `crowd` | ≤ +5 ms | +0.67 ms / +0.33 ms | **met** |
| The peer sweep alone, seven peers, p99 (`peers_unit.js` B) | ≤ 5 µs a packet | 0.32 µs far, 0.51 µs into one, 0.57 µs into a crowd, 2.49 µs with the slide refused and the bisection | **met** |
| Network, 8 players (`traffic8.js`, 2 pairs) | ≤ +3 % bytes/s per client | +0.48 % (35,230 → 35,399 B/s) | **met** |
| Server memory per NEW RUN (`nr_soak.js`, 32 blasts, forced-GC heap) | ≤ 0.01 MB per event | 0.0065 MB per event (6.80 → 6.88 MB) | **met** |
| No unbounded per-player collision state | | by construction: `server/peers.js` keeps no state; a player's collision counters (`me.mv`, `peerHits`) live on its connection and go with it; the blockers are rebuilt for each packet. The server's forced-GC heap is level over 48 deaths and over 32 blasts | **met** (by reading and the heap, not by a counter) |

## 2. The browser, HQ2 against HQ1 (`perf/perf_ab_hq2.json`)

Each pair is an HQ1 run followed by an HQ2 run. Each run's worst round is taken. The change shown is the mean over the four pairs, with every pair's change listed beside it.

| Window | Page | Median: mean change (gate) | p95: mean change (gate) | The four pairs (median) |
|---|---|---|---|---|
| idle | victim | −1.0 % (+15) | −3.1 % (+20) | −7.2, −2.6, +37.0, −31.2 |
| idle | spectator | +0.0 % (+15) | +6.9 % (+20) | −8.6, +8.8, +39.6, −39.6 |
| Hound A death | victim | +1.9 % (+13.2) | +7.4 % (+19.5) | −7.4, 0.0, +48.2, −33.3 |
| Hound A death | spectator | +3.2 % (+14.3) | +7.2 % (+20) | −5.2, −9.7, +47.2, −19.5 |
| Hound C death | victim | −0.0 % (+15) | −0.7 % (+20) | +17.7, −2.1, −13.5, −2.1 |
| Hound C death | spectator | −0.2 % (+15) | +0.2 % (+20) | +18.0, +1.0, −15.7, −4.1 |
| Hound C, first frame to last | victim / spectator | +3.5 % (+10.2) / +2.1 % (+11.4) | | |
| Hound A, first frame to last | victim / spectator | −3.2 % (+11.8) / −2.3 % (+14.7) | | |

**Pairs 3 and 4.** In pair 3 every window of HQ2 is 37–48 % slower than its HQ1 partner; in pair 4, 20–55 % faster. That is the machine's own swing between two consecutive runs, the same size as the A/A's. No window is slower in all four pairs.

**The high lighting quality** (one pair, reported, not gated; `perf/high/`):
- HQ2's Hound A death window was 1,058 ms against HQ1's 1,117 ms;
- its Hound C death window 783 ms against 717 ms;
- idle 917 ms against 958 ms (victim, first round).

## 3. The new windows (`perf/perf_hq2.json`)

The two windows HQ1 cannot have, each against a window of the same run:
- **The explosion:** 3.2 s from the approval, on the initiator's and a spectator's page.
- **The contact window:** two players pressing into each other for 4 s, every step projected, every packet swept, with soft corrections.

| Round | Idle | Contact | Hound C death | The blast |
|---|---|---|---|---|
| 1 | 792 / 783 | 650 / 650 | 883 / 900 | 683 / 675 |
| 2 | 825 / 767 | 633 / 625 | 900 / 883 | 667 / 692 |
| 3 | 783 / 717 | 667 / 683 | 842 / 817 | 742 / 767 |

Frame medians are in ms, Alice / Bob. Every round's NEW RUN was approved. On Alice's own page the pair stood 35.8 px apart in every round.

**The first run of this tool** (`attempts/perf_hq2_round_without_a_blast/`) had a round whose press was refused (`dead`: a monster came back during the cooldown wait). That round's "blast" window held no blast. It met its gates too, but it is not used.

## 4. The server

**Eight players, 45 s, three interleaved pairs per layout** (`perf/srv_ab.json`):

| Layout | CPU, pairs | Step mean, pairs | Ping p99, pairs | Smallest distance between two players at the end |
|---|---|---|---|---|
| `spread` | +6.8, +5.3, +2.6 % | +6.1, +1.9, +8.0 % | +1, 0, +1 ms | HQ1 174, HQ2 174 |
| `crowd` | +12.9, +8.2, +4.3 % | +1.7, +1.7, −1.7 % | 0, 0, +1 ms | HQ1 **0** (all seven on one point), HQ2 35.5 (whole px) |

In `crowd`, HQ2's players got about 1,000 soft corrections each run. That is about one per player every 0.3 s while all seven press into the point, the most D3 allows.

**A death's server cost** (`perf/perf_death_srv*`): HQ2 2.70 ms, HQ1 2.73 ms, median per death in all.

## 5. Memory

| Run | HQ1 (this session) | HQ2 | |
|---|---|---|---|
| Server, 48 deaths, forced GC (`server_soak`): heap slope | 0.0060 MB/death (6.96 → 7.15) | 0.0072 MB/death (6.95 → 7.30) | both level, within HQ1's 0.01 figure |
| Server, 64 deaths, no forced GC (`server_soak_nogc`) | peak 109.1 MB at death 33; last 16 deaths ≤ 94.2; ends 93.5 | peak 104.0 MB at death 11; last 16 deaths ≤ 89.1; ends 89.1 | no new peak in the last 16, for either |
| Server, NEW RUN blasts, forced GC (`nr_soak`) | — | 0.0065 MB/event (32 blasts) | the H2-0 gate, met |
| Browser soak, 16 deaths (`soak`): page heap slope victim / spectator | 0.36 / 0.35 MB/death | 0.59 / 0.20 MB/death | no display object left behind on either (slope 0), no replay left |
| The same, the server's RSS slope | 2.5 MB/death | 5.7 MB/death | RSS, with two browsers on the same two cores |
| Browser soak, 32 deaths, GC traced (`soak_gc`): server RSS slope | 2.25 MB/death | 2.86 MB/death | not levelling within 32 deaths, for either (HQ1's inherited R4 line) |
| The same: the server's heap after each full GC | 6.3 → 8.1 MB (6 GCs) | 6.4 → 9.1 MB (5 GCs) | |

**The forced-GC server heap is the leak measure,** and it is level: 0.0072 MB per death, 0.0065 MB per NEW RUN.

**The RSS slopes of the short browser soaks are not.** The browsers run on the same two cores, and the 16-death RSS slope doubled while the 48-death forced-GC heap slope did not move. It is recorded rather than explained away. The 32-death soak's RSS does not level off for HQ1 either; HQ1 recorded that it levels by 64.

## 6. The films (`video/`)

**The build hash.** Each film burns into every frame HQ2's build hash: sha256 of the production files the server serves and runs (`server.js`, `server/peers.js`, `sim.js`, `death_srv.js`, `dphys.js`, `mp.js`, `move.js`, `gore.js`, `ents.js`, `index.html`, the bundle, `net-wire.js`), first 12 hex digits: **`b178b5d9fbe7`**. It also burns in each page's own frame time (the mean of its last ten frames) and the wall clock.

| Film | Pages | Mean frame time over the film |
|---|---|---|
| `main` (stand-off, squeeze past, blast, late joiner, SPAWN) | 3 at 720 × 480 | Alice 597 ms, Bob 612 ms, Carol 592 ms |
| `lag` (wide-hall side-pass, lag recovery; Alice through 150 ms each way) | 2 at 720 × 480 | Alice 372 ms, Bob 373 ms |

## 7. HQ1's own performance exceptions, reported again

- **D0's absolute frame-time limits** (fixed in D0's session) cannot be met on this machine. Its two-page windows draw a frame every 0.6–1.0 s; HQ1 was over them too. They are not used as a gate.
- **The 32-death soak's RSS** does not level off within 32 deaths, for HQ1 or HQ2 (section 5).
- **The no-GC soak's late peak** (HQ1: 0.5 MB above an earlier peak) did not occur for either in this session.
- **D7's Hound A spectator cost note** stands as recorded at D7. Here the Hound A spectator window's mean change against HQ1 is +3.2 % (gate +14.3 %).
