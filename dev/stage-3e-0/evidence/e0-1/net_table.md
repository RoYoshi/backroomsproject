| Run | Mover sends | Up B/s | Snapshots / q per s | New poses of the mover per s | Pose age at arrival, mean / p95 ms | Down B/s (observer) | Server CPU |
|---|---|---|---|---|---|---|---|
| A: HQ5 server and client, 60 Hz screens (`A60`) | 16.31/s, every 66.04 ms | 3687 | 19.81 / 0 | 14.06 | 25.89 / 47.62 | 7429 | 1.4 % |
| new server, old client (`mix_ns_oc`) | 16.73/s, every 65.82 ms | 3781 | 19.89 / 0 | 14.65 | 25.16 / 48.62 | 7472 | 1.5 % |
| old server, new client (`mix_os_nc`) | 16.23/s, every 66.04 ms | 3669 | 19.81 / 0 | 14.15 | 25.56 / 48.7 | 7431 | 1.4 % |
| B+: 60 Hz screens (`BP60`) | 30.04/s, every 33.41 ms | 6792 | 19.89 / 13.98 | 26.13 | 12.94 / 24.2 | 8298 | 1.8 % |
| A: mover on a 144 Hz screen (`A144`) | 18.07/s, every 55.49 ms | 4086 | 19.82 / 0 | 15.74 | 26.23 / 49.4 | 7416 | 1.5 % |
| B+: mover on a 144 Hz screen (`BP144`) | 36/s, every 27.71 ms | 8139 | 19.92 / 15.33 | 31.33 | 13.3 / 24.97 | 8373 | 1.8 % |
| B+: mover on a 30 Hz screen (`BP30`) | 30/s, every 33.28 ms | 6781 | 19.86 / 12.55 | 25.93 | 13.2 / 24.91 | 8240 | 1.7 % |
| A: 40 ms each way + up to 30 ms jitter (`A60_jit`) | 16.56/s, every 65.86 ms | 3744 | 19.81 / 0 | 13.48 | 132.92 / 168.8 | 7409 | 1.5 % |
| B+: 40 ms each way + up to 30 ms jitter (`BP60_jit`) | 30.05/s, every 33.34 ms | 6793 | 19.98 / 10.74 | 22.56 | 122.91 / 148.37 | 8140 | 2 % |
| A: 7 players (`A_load7`) | 16.58/s, every 65.99 ms | 3749 | 19.83 / 0 | 14.42 | 24.54 / 47.9 | 25027 | 2.3 % |
| B+: 7 players (`BP_load7`) | 30/s, every 33.38 ms | 6782 | 19.83 / 15.58 | 25.92 | 12.92 / 24.22 | 27416 | 3.6 % |

What a 60 Hz screen shows of the mover (px; truth = where the mover really is; newest = the newest pose received; stalled = moving frames in which nothing moved on screen):

| Run | Shown as | Off the truth, mean / p95 / max | Off the newest pose, mean / p95 | Heading off, mean deg | Stalled frames | Biggest one-frame jump |
|---|---|---|---|---|---|---|
| `A60` | A: each snapshot sets the drawn pose | 10.83 / 20 / 29.52 | 0 / 0 | 10.42 | 73 % | 20.8 |
| `A60` | B: eased by elapsed time | 18.02 / 29.36 / 32.35 | 7.27 / 14.21 | 10.42 | 2 % | 8.9 |
| `BP60` | fresh poses, no easing (reference only) | 5.56 / 12.74 / 13.76 | 0 / 0 | 7.01 | 50 % | 10.8 |
| `BP60` | B+: fresh poses, eased by elapsed time | 12.8 / 21.17 / 22.13 | 7.29 / 12.76 | 7.01 | 1 % | 7 |
| `A60_jit` | A: each snapshot sets the drawn pose | 31.17 / 54.19 / 68.55 | 0 / 0 | 22.36 | 75 % | 26.5 |
| `A60_jit` | B: eased by elapsed time | 38.12 / 62.53 / 71.02 | 7.19 / 15.9 | 22.36 | 5 % | 10.4 |
| `BP60_jit` | fresh poses, no easing (reference only) | 26.96 / 47.5 / 57.96 | 0 / 0 | 19.44 | 61 % | 20.6 |
| `BP60_jit` | B+: fresh poses, eased by elapsed time | 33.96 / 56.05 / 62.03 | 7.21 / 14.41 | 19.44 | 5 % | 8.8 |

B+ (`BP60` data) on other screens: 30 Hz: off the truth 11.2 / 17.85 px, stalled 1 %, biggest jump 10.3 px; 60 Hz: off the truth 12.8 / 21.17 px, stalled 1 %, biggest jump 7 px; 144 Hz: off the truth 13.73 / 22.3 px, stalled 1 %, biggest jump 3.1 px; 240 Hz: off the truth 13.97 / 22.72 px, stalled 1 %, biggest jump 2 px
