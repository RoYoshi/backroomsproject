# E0-1: the five gates for B+ (automated; Human QA is the user's)

Game folders under test: HQ5 (`ad98475`, exported) and B+ (HQ5 plus the five B+ game files, byte-identical to the stage-3e-0 commit). The commands are in `steps.txt`.

## Gate 1: source and preservation

**Parent.** `stage-3d-hq5` `ad98475`, tree `9f721d3`, checked on GitHub. The branch was made from exactly that commit (see `../e0-0/AUDIT.md`).

**Game files changed:**

| File | Change |
|---|---|
| `server.js` | B+ protocol (`caps`, `q`, `k`, FAST_GAP); nothing for the icon |
| `mp.js` | B easing, B+ client, `?peers=a\|b` |
| `index.html` | one `<link rel="icon">` |
| `server/static.js` | `favicon\.ico` in SERVE, `.ico` MIME |
| `favicon.ico` (new) | the supplied bytes |

Every other game file is byte-identical to HQ5, including:
- the local controller `move.js` and the bundle;
- BR-RoLE 1.2 and `sim.js` / `ai.js` / `server/peers.js`;
- the PWA manifest and the logo.

**Server movement checks are untouched.** `mvCheck`, `moveOk` / `moveRoute`, the travel budget and the peer bodies are not changed. Only the spacing at which a client that asked may submit changes: 16 ms instead of 30.

**HQ4's gameplay smoke on B+ passes** (`gameplay_smoke/bplus.json`): walk, spin, light, frames, NEW RUN (Bob sees her gibs), spawn and walk again. 0 page errors.

## Gate 2: B mathematics (`b_math.json`, run on the shipped line of `mp.js`)

| Check | Result |
|---|---|
| 60 fps | B gives .3 / .35 exactly as A |
| Gap left after 1 s | The same at 30, 60, 144 and 240 fps, with or without ±40 % frame jitter (.7^60, .65^60). A depends on the frame rate. |
| dt 0, negative, NaN, Infinity | 0 |
| dt 10 s (a paused tab) | Clamped to 0.25 s: 0.995 / 0.998, never past the target |
| Heading +3.0 → −3.0 rad | Takes the short way (0.28 rad) at every rate |

All checks pass.

## Gate 3: freshness, bytes, protocol, safety

All figures were measured on the real server with byte-counting proxies (`net_table.md`, `net/*.json`).

| | A (HQ5) | B+ |
|---|---|---|
| Mover's sends (60 Hz screen) | 16.3/s, every 66 ms | 30.0/s, every 33 ms |
| New poses of the mover reaching an observer | 14.1/s | 26.1/s |
| Age of a pose when it arrives (LAN), mean / p95 | 25.9 / 47.6 ms | 12.9 / 24.2 ms |
| Upload per moving player | 3.7 KB/s | 6.8 KB/s |
| Download per player (2 players) | 7.4 KB/s | 8.3 KB/s (`q` mean payload 48 B) |
| Download per player (7 players) | 25.0 KB/s | 27.4 KB/s (`q` mean 141 B) |
| Messages down per player | 19.8/s | 33.8/s (2 players) to 35.4/s (7 players) |

**On a 60 Hz screen** (`net_table.md`, second table), compared with where the mover really is:

| | Off the truth, mean / p95 | Frames that stall while she moves | Biggest one-frame jump |
|---|---|---|---|
| A | 10.8 / 20.0 px | 73 % | 20.8 px |
| B alone | 18.0 / 29.4 px | 2 % | 8.9 px |
| B+ | 12.8 / 21.2 px | 1 % | 7.0 px |

- Heading error: A 10.4°, B+ 7.0°.
- With 40 ms each way plus up to 30 ms jitter: A 31.2, B 38.1, B+ 34.0 px off the truth.
- **B alone trails more than A**: easing toward 20 Hz data adds lag. B+ brings it back close to A, without A's stalls and jumps.
- **B+ does give fresher information**: twice the new poses, half the age.

**Protocol** (`proto_bp.json`, all pass):
- `caps` is answered; an old client gets neither `q` nor `k`.
- Nobody moving: no `q`.
- `q` is `[id, x, y, heading]` only, never the receiver itself. `w` is the epoch and `k` is odd and rising together with the snapshots' `k`.
- Room isolation: a client in another room and a connected client not in a run both get no `q`.
- World reset: the `world` message comes before any `q`, and every `q` carries the new epoch.
- A dead player is named in no `q`, and a disconnected one in no `q` or `s`.
- For a fast client, a 500 px jump is refused and a move through a wall is refused.

**Client side** (`two_browser.py`, B+): four crafted `q` are each dropped (`qStale` +2, `qUnknown` +2), the target does not move and no avatar is made:
- one from an old world;
- one not newer than the newest seen;
- one naming an unknown id;
- one malformed.

**Mixed versions** (`net/mix_*.json`, `browser/two_mix_*.json`):
- An old server with a new client: the client asks once, is never answered, and stays at 50 ms with snapshots only. Its numbers equal A's.
- A new server with an old client: the client never asks and gets exactly HQ5's messages. Its numbers equal A's.
- No crash and no page error either way.

**Favicon** (`static_bp.json`):
- `/favicon.ico` returns 200 `image/x-icon` with the supplied bytes (`5489c214…`), identical with and without gzip.
- The page links it once.
- `/server.js`, `/server/static.js`, `/.git/config`, `/dev/` and eight more paths are still 404.
- HQ5 answers 404 for the icon (`static_hq5.json`).

## Gate 4: two browsers (SwiftShader, 480×320, Bob's page checked every frame BR-RoLE draws)

Alice walks into Bob, sprints into him and stops dead, turns a full circle, crouches, slides, reloads her page, and an admin resets the world.

| Run | ok | Frames | Avatar = drawn pose | BR-RoLE jobs at avatar | Light at beam | Bodies = server target | Min distance on Bob's screen | `q` applied |
|---|---|---|---|---|---|---|---|---|
| B+ | yes | 146 | 146 | all (worst 0 px) | all | 146 (62 frames differ from drawn) | 37.0 px | 34 |
| B | yes | 159 | 159 | all | all | 159 | 37.0 | 0 (no `caps`) |
| A | yes | 160 | 117* | all | all | 160 | 37.0 | 0 |
| B+, Bob 60 ms each way | yes | 171 | 171 | all | all | 171 | 37.0 | 43 |
| Old server, new client | yes | 161 | 161 | all | all | 161 | 37.0 | 0 (asked, never answered) |
| New server, old client | yes | 153 | n/a** | all | all | n/a** | 37.0 | 0 (never asked) |

\* In A a snapshot sets the drawn position, and the avatar takes it at the next frame (HQ5's behaviour).

\*\* HQ5's `mp.js` has no `__peerNet`.

In every run:
- after her reload: her old id is gone and she has one avatar;
- after the reset: one avatar;
- 0 page errors.

The contact distance in the corridor is 37 px, so she was never drawn inside him.

**Collision** (HQ2's `col_browser.py`):
- **Head-on, B+:** 5/5 (`col_head.json`). She stops at contact, her page is never through him, it ends where the server has her, and he is never moved.
- **Aside** (he stands 30 px off her line):
  - First B+ run: 4/5, with **one soft correction** (`col_aside.json`).
  - Series 1, four alternated pairs: B+ 4/4 and HQ5 4/4, 0 corrections.
  - Series 2, six pairs: B+ 5/6 and HQ5 6/6, 0 corrections. B+ run 2 is a setup miss (below), not a contact result.
  - In all: one soft correction in 10 valid B+ runs and none in 10 HQ5 runs. That is too few to say B+ causes it. It is reported, not explained.

**Setup misses, a pre-existing HQ5 race** (`placement/`, `browser/setup_miss/`). Three runs began with Bob not where the admin BRING had put him: aside B+ run 2, a B+ 60 ms run and an **old-server (HQ5 server)** run. The tests then had no contact to test, so those runs were repeated.

Cause, read from `server.js` (HQ2's movement check) and reproduced:
1. A server-side placement resets the travel budget to its maximum, 540 px + 28 px slack.
2. A pose Bob's page sent just before it got the `tp`, still at his old spot, is then accepted as an ordinary move back, if the old spot is within about 570 px by a free route. The grace after a placement only ignores *refused* moves.

| `place_race.py`, Bob starting 545 px away | Placements kept |
|---|---|
| HQ5 | 2 of 6 |
| B+ | 0 of 6 |

From his random spawn (850–9050 px away), both builds kept all 12.

So the race is in HQ5's server and is not caused by B+. B+'s client sends twice as often, so on a real 60 Hz screen it can only make a stale pose in flight more likely. B+ does not change that check; a fix belongs to the movement check and needs the user's go-ahead.

## Gate 5: lean performance

Server CPU (from `/proc`, 12 s runs):

| Players | A | B+ |
|---|---|---|
| 2 | 1.4 % | 1.8 % |
| 7 | 2.3 % | 3.6 % |

The bytes and messages per player are in Gate 3.

**Page frame times.** These are SwiftShader numbers and do not represent a real GPU. The median frame on Bob's page:

| A | B | B+ | B+ at 60 ms |
|---|---|---|---|
| 75.7 ms | 76.3 ms | 80.7 ms | 75.7 ms |

Run-to-run noise at this size is of the same order. On the client, B+ adds per peer per frame one `Math.pow` pair and the `q` handling (at most 20 a second; 11–16 measured).

**Not measured:**
- a real GPU;
- a real internet path;
- browsers other than Chromium;
- 8 real players.

These SwiftShader pages run at about 12 frames/s, so they send about 12 poses/s and B+ can add little there. The freshness numbers come from `net_lab.js`'s 30/60/144 Hz senders.
