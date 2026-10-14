# B++ after B++-0: profile first, optimise only if it pays (it does not), and parity with the accepted B+

## Profile (`perf/`)

Setup for every run:
- 7 moving B+ players: each asks `caps` and sends every 25 ms with the full pose packet (`net_profile.js`).
- 1 quiet admin; 8 connections is a room's maximum (MAX_ROOM).
- An open hall, monsters removed, 15 s measured, 3 runs per build.

| Build | Server CPU (3 runs) | Mean | Down / up per player | Messages down / up per player |
|---|---|---|---|---|
| HQ5 (A, old clients) | 2.67, 2.47, 2.27 % | 2.47 % | 25.2 / 2.9 KB/s | 20.6 / 15.5 per s |
| B+ `004b43f` | 3.80, 3.67, 3.40 % | 3.62 % | 27.8 / 5.7 KB/s | 39.7 / 30.8 per s |
| **B++-0** `b8391ef` | 3.73, 3.53, 3.80 % | 3.69 % | 27.7 / 5.7 KB/s | 39.9 / 30.9 per s |

B++-0 against B+ is within run-to-run noise on every line.

**Where the B++-0 server's time goes** (`node --cpu-prof`, `profile_bpp0_7players.json`). Of 19.0 s sampled, about 0.59 s was busy, including start-up and the profiler's own overhead:
- the 60 Hz simulation: 41 ms;
- all `send()` calls (JSON plus framing plus write): 31 ms;
- `mvCheck`: 28 ms;
- **B+'s whole pose path (`poseSend`, including its sends): 13.5 ms, or 0.07 % of one core.**

## The only two candidates, and what they could buy at most (`net_bench.js`, `perf/net_bench.json`)

Both use real messages a B+ player received (`sample_messages.json`) and serve 7 recipients a tick. Both candidates produce output **byte-identical** to the current code, checked recipient by recipient.

| Candidate | Now | Candidate | Saving at 20 ticks/s | Share of one core |
|---|---|---|---|---|
| Snapshot: stringify the entity list once per tick, not once per recipient | 30.9 µs/tick | 29.4 µs/tick | 31 µs/s | 0.003 % |
| `q`: stringify each pose entry once per tick, join per recipient | 5.9 µs/tick | 2.5 µs/tick | 69 µs/s | 0.007 % |

**Neither is applied.** Each would save less than one hundredth of 1 % of a core, far below the ±0.2 % noise between whole-server runs. Each would also add code to a locked path.

There are no other candidates:
- **The client** (`mp.js`) is byte-identical to B+, so its frame cost is identical by construction. B+'s own per-frame work is two `Math.pow` per friend.
- **Bytes** cannot shrink without changing what the packets mean or carry (a compact upstream, delta snapshots), which this stage forbids.

**So B++ is B++-0 alone, with no optimisation commit.**

## Parity with B+ (`parity/`, `browser/`)

**Freshness on the wire** (`net_lab.js`, a 60 Hz mover, LAN):

| | B+ | B++ |
|---|---|---|
| Mover's sends | 30.0/s | 29.9/s |
| New poses reaching the observer | 26.0/s | 25.8/s |
| Pose age on arrival, mean / p95 | 13.8 / 25.3 ms | 13.7 / 25.0 ms |
| Upload / download | 6.78 / 8.25 KB/s | 6.76 / 8.26 KB/s |
| Off the truth on a 60 Hz screen (eased) | 13.05 px | 13.19 px |
| Stalled frames | 1 % | 1 % |

**An old (HQ5) client on the B++ server** gets exactly A: 14.4 new poses/s, 27.9 ms (`net_oldclient_on_bpp.json`).

**`two_browser.py` on B++** passes in all three runs:

| Run | Result |
|---|---|
| B+ page, no added delay (`../p0/browser/two_bplus_bpp0.json`) | passes |
| B+ page, 60 ms each way (`browser/two_bplus_lag60_bpp.json`) | passes |
| An HQ5 page on the B++ server (`browser/two_mix_oldcli_bpp.json`) | passes |

The checks in each:
- one pose for avatar, BR-RoLE jobs and light;
- bodies at the server target;
- never drawn inside;
- one avatar after a reconnect and after a world reset;
- the crafted `q` dropped;
- 0 page errors.

**Other checks:**
- **HQ2 collision:** head-on 5/5 and aside 5/5 (`../p0/browser/`).
- **HQ4 gameplay smoke** (`browser/gameplay_smoke_bpp.json`): walk, spin, light, frames, NEW RUN (the friend sees the gibs), spawn and walk.
- **`proto_check.js`:** all pass (`../p0/proto_bpp0.json`).
- **B math on B++'s `mp.js`:** all pass (`parity/b_math_bpp.json`).
- **Favicon** (`parity/static_bpp.json`): 200, `image/x-icon`, your bytes. Protected paths still 404.

**Limits:**
- SwiftShader pages at about 4–12 frames/s, so their frame times are not representative.
- No real GPU, no real internet path, Chromium only.
- At most 7 players plus a watching admin (the room limit).
