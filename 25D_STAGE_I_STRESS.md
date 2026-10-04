# Stage I bounded stress matrix

PASS for the measured workloads. These results do not establish arbitrary population, map complexity, indefinite uptime or deployment capacity.

| Family | Actual workload | Evidence | Disposition |
|---|---|---|---|
| geometry | 4/16/64 same-XY stacks, 500 sweeps each; local support/clearance; real ramp/stair/drop/crawl | dev/stage_i/evidence/i2/measurement-03/geometry.json | PASS / BOUNDED MEASUREMENT |
| navFourSurfaces | 1/2/4 occupied surfaces, 2/4/8 real entities and players, two seeds | dev/stage_i/evidence/i2/stress-01/four-surfaces.json | PASS / BOUNDED MEASUREMENT |
| navConnected | Four connected occupied surfaces, 660 fixed ticks, actual paths/brains/sensors | dev/stage_i/evidence/i2/stress-01/connected-nav.json | PASS / BOUNDED MEASUREMENT |
| authorityNetwork | Real latency 20–250 ms, jitter/duplicates/stale reports, one-second interruption, hostile claims, reconnect/lifecycle | dev/stage_i/evidence/i2/stress-01/network25d.log | PASS / BOUNDED MEASUREMENT |
| aftermath | 1/3/24 active aftermaths through sleeping; real shared kernel and payloads | dev/stage_i/evidence/i2/stress-01/aftermath.log | PASS / BOUNDED MEASUREMENT |
| serverSoak | Three rooms, eight initial clients, 60 seconds, death, three reconnects and disposal/recreation; separate live 64+64 admin ceiling | dev/stage_i/evidence/i2/measurement-03/server.json | PASS / BOUNDED MEASUREMENT |
| browserMatrix | Eight real production viewport/DPR/UI/quality/NV/zoom cases, two-client independence, aftermath/beam/overlay masks | dev/stage_i/evidence/i2/stress-02/browser-matrix/result.json | PASS / BOUNDED MEASUREMENT |

Dense geometry records actual candidate and conservative-advance counters via counters-only source instrumentation. Representative sweeps are exactly compared against the uninstrumented module. Local queries retain one Z-filtered narrow-phase candidate at every tested stack density. All real motion samples stay nonpenetrating; explicit iteration-limit safety is separately tested by s_world25d.

Navigation records occupied-sheet node/edge allocation, route and physical-proof cache statistics, search budgets, sensor rays/acoustic expansions and evidence maxima. Identity/evidence/sound/lead/habit/hypothesis/support-alternative bounds remain 16/4/8/6/6/3/4. These measurements run the existing brains, not fixture bots.

The server soak records real socket bytes, frame/interarrival distributions, rolling 600-step CPU statistics, authority limits, lifecycle churn and explicit fresh epoch after room disposal. Actual process telemetry has 73 one-second memory/event-loop samples. During the 60-second room segment RSS begins at 103706624 and ends at 162734080 bytes, maximum 162734080; cache warmup/churn is included. No long-term leak claim is made. Raw per-second history is retained, including garbage-collection variability.

The active admin ceiling retains AI thinking and physical motion. The 24-active aftermath and software GPU cases remain known limits; their correctness is not bypassed. See PERFORMANCE for actual timings, bytes and classifications. Failed first-snapshot and incomplete memory attempts remain alongside successful repeats.
