# E0-0: source proof, what HQ5 really does with the other Wanderers, the A baseline

## Source

| | |
|---|---|
| Accepted parent | `stage-3d-hq5` `ad98475767bcae6794cd01af832de660355da7a2`, tree `9f721d371693656110f58c8e8fb6b6382ded6fa8`, checked on GitHub (REST) and with `git rev-parse` |
| Branch | `stage-3e-0` did not exist on GitHub (27 branches, `remote_heads_before_e0.json`) or locally. It was created from exactly `ad98475` with a clean tree |
| Pack | V3, SHA-256 `50acdab1…3850` as given; its 19 manifest entries match; `SUPPLIED/favicon.ico` `5489c214…501b` matches its `.sha256` and the manifest |

## The path of another player's pose (HQ5)

1. **Her page sends `t:'p'`** from the frame loop when more than 50 ms have passed (`mp.js`).
   - Frames come every 16.7 ms at 60 Hz, so that is every 4th frame: **66.7 ms, about 15-16 Hz**.
   - At 144 Hz it is every 55.6 ms.
2. **The server takes a `p`** only if 30 ms have passed since the last one it took (`server.js`). Every taken pose goes through `mvCheck`: the travel budget, walls and the other players' bodies.
3. **Every 2nd tick of 25 ms (20 Hz), the server sends each client a full snapshot `s`.** It carries every active player's newest accepted x, y, heading, cosmetics and state, the entities, and the world epoch `w`.
4. **Her friend's page, on each `s`:**
   - `Object.assign(o, p, { tx: p.x, ty: p.y })`.
   - Because `p` itself carries `x` and `y`, this **sets the drawn position `o.x / o.y` to the new pose outright**.
   - `solidPeers` copies the snapshot's own positions into `window.__peerBodies` (HQ2's collision proxy).
5. **`drawPeers`, every frame:**
   - `o.x += (o.tx - o.x) * .3` does nothing, since `o.x` already equals `o.tx`. The `.3` position easing has never run; the overwrite has been there since the file's first version.
   - Heading: `o.ang` eases `.35` a frame toward `o.a`. That runs, per frame, so it is faster at higher refresh rates.
   - The velocity and distance that drive the avatar's walk cycle (`o.vx`, `o.dist`, written by the user's own "FIXED" commit `0f00c65` to animate other players like your own Wanderer) come from the per-frame movement inside `drawPeers`. That movement is always 0, so other Wanderers are told they stand still.

**Seen in a real page** (`probe_hq5_remote_avatar.json`, HQ5): while Alice walks, her avatar on Bob's page jumps from snapshot to snapshot. Its left hand stays at y = -13 the whole time: no walk swing, because the avatar is told its speed is 0.

## A, measured

`net_lab.js`, the real server, an ordinary player walking a 150 px circle (walk, sprint, a dead stop, a sharp turn), as mp.js sends at 60 Hz.

| | A (HQ5) |
|---|---|
| Her sends | 16.3/s, every 66 ms (p50) |
| Snapshots | 19.8/s; 71 % of them carry a new pose of hers (14.1 new poses/s) |
| A new pose's age when it arrives (LAN) | mean 25.9 ms, p95 47.6 |
| On a 60 Hz screen, off where she really is | mean 10.8 px, p95 20.0, max 29.5 |
| On a 60 Hz screen, moving frames in which she does not move | **73 %**, then jumps of up to 20.8 px |

## The decision

These are the Stage 3E-0 contract's own A, B and B+. Since HQ5's easing never ran, A is "jump to each snapshot", not ".3 a frame".

| | What it does | Where |
|---|---|---|
| **A** | Exactly HQ5 | `?peers=a` (this page only) |
| **B** | A snapshot sets only the target; the drawn pose eases toward it by elapsed time, `1 - 0.7^(60 dt)` and `1 - 0.65^(60 dt)` (.3 / .35 at 60 Hz, the same per second at any rate). A jump of more than 96 px is shown at once (teleport, spawn), and HQ5's 400 px rule is kept. The walk cycle now gets real speed | `?peers=b` |
| **B+** (default) | B, plus fresher poses. The page asks the server with `{t:'caps', fp:1}`; only once the server answers does it send its own pose every 25 ms (frame-scheduled: every 33 ms at 60 Hz). The server takes an asking client's pose every 16 ms instead of 30, through the same `mvCheck`. On the tick between two snapshots it sends that client `{t:'q', w, k, p:[[id, x, y, heading]]}` for each other active, living player the last snapshot listed whose pose changed. The page uses a `q` only for this world (`w`), newer than everything seen (`k`), and for known, living players; it updates their target and the bodies it steers round | `mp.js`, `server.js` |
| Favicon | `favicon.ico` (the supplied bytes), one `<link rel="icon">`, `favicon\.ico` in `SERVE` and `.ico` in the MIME table | `index.html`, `server/static.js` |

**Kept as they are:**
- the 20 Hz snapshot (only `k` is added, for asking clients);
- the 60 Hz simulation and the 40 Hz tick;
- `mvCheck`, `server/peers.js` and `move.js`;
- every entity, BR-RoLE 1.2, death and gore;
- the HQ2 collision proxy, still fed only server positions (from `q` too).

**For an older client the server sends exactly what HQ5 sent.** An older server never answers `caps`, so a new client stays at 50 ms with snapshots only.

**Upstream stays the existing validated `p`.** A compact pose-only `p` would need the server to keep omitted fields. Today a missing `l` turns the light on, and a missing `n` renames the player, so it was not done; the extra upload is reported instead.
