# Stage 3E-0: B+ report

**Status: HUMAN-QA CANDIDATE.** Not accepted until you say **B+ HUMAN QA PASSED**. The fallback is Stage 3D HQ5. No B++ branch exists or will be made before then.

| | |
|---|---|
| Branch | `stage-3e-0`, made from `stage-3d-hq5` `ad98475767bcae6794cd01af832de660355da7a2` (tree `9f721d3`) |
| B+ source | The first commit on the branch. Its SHA and tree are in `dev/stage-3e-0/evidence/e0-2/` and in the overlay's receipt. |
| Overlay | `STAGE_3E0_BPLUS_HUMAN_QA_OVERLAY.zip`: B+ over a clean HQ5 game, with `REVERT_TO_HQ5`, `WHERE_TO_COPY.txt`, `HUMAN_QA.md` and `BPLUS_SOURCE.diff` |

## What was found first

**HQ5 never eased the other Wanderers.** Each 20 Hz snapshot set their drawn position outright, so the `.3` easing had nothing left to do:
- They moved in 20 Hz steps: 73 % of frames stood still while they walked, then jumped up to 21 px.
- Their walk cycle got speed 0, so their hands never swung.

The evidence is `evidence/e0-0/AUDIT.md` and `probe_hq5_remote_avatar.json`.

## What changed (five game files; `STAGE_3E0_CHANGED_FILES.txt`)

**B, in `mp.js`.**
- A snapshot now sets only the target. The drawn pose eases toward it by elapsed time: `1 − 0.7^(60·dt)` for position and `1 − 0.65^(60·dt)` for heading. That is .3 / .35 at 60 Hz, and the same per second at any refresh rate.
- dt is clamped to 0–0.25 s, and the heading takes the short way round.
- Jumps over 96 px are shown at once, and HQ5's 400 px rule is kept.
- The walk cycle now gets the real speed.

**B+, in `mp.js` and `server.js`, opt-in on both sides.**
- The page asks `{t:'caps', fp:1}`. Only after the server answers does it send its pose every 25 ms instead of 50: every 2nd frame at 60 Hz, 33 ms.
- The server takes an asking client's pose every 16 ms instead of 30, through the same `mvCheck`.
- On each tick between two snapshots, the server sends that client `{t:'q', w, k, p:[[id, x, y, heading]]}` for the other players whose pose changed. That makes 40 Hz of player poses in all, with no cosmetics; the world itself stays at 20 Hz.
- The page uses a `q` only when all of these hold:
  - it is for this world (`w`);
  - it is newer than everything already seen (`k`);
  - it names a known, living player.
- It never creates an avatar from a `q`.
- The bodies your own movement steers round use the newest *server* positions, never the drawn ones.

**Favicon.**
- `favicon.ico` is your file, byte for byte.
- `index.html` has one `<link rel="icon">`.
- `server/static.js` adds `favicon\.ico` to SERVE and `.ico: image/x-icon` to the MIME table.
- The manifest and the logo are untouched.

**`?peers=a` / `?peers=b`** turn that one page back into A or B, for side-by-side comparison. It is DEV only; the server and other players are unaffected.

## A / B / B+, measured

Real server, real WebSocket bytes, one player walking a known circle (walk, sprint, dead stop, sharp turn), seen by a 60 Hz screen:

| | A (HQ5) | B (easing only) | B+ |
|---|---|---|---|
| New poses of a moving friend | 14.1/s | 14.1/s | **26.1/s** |
| Pose age on arrival (LAN), mean / p95 | 25.9 / 47.6 ms | same as A | **12.9 / 24.2 ms** |
| Drawn pose off the truth, mean / p95 | **10.8** / 20.0 px | 18.0 / 29.4 px | 12.8 / 21.2 px |
| Frames that stall while she moves | 73 % | 2 % | **1 %** |
| Biggest one-frame jump | 20.8 px | 8.9 px | **7.0 px** |
| Heading off, mean | 10.4° | 10.4° | **7.0°** |
| 40 ms each way + up to 30 ms jitter, off the truth | **31.2** px | 38.1 px | 34.0 px |
| Upload per moving player | 3.7 KB/s | 3.7 KB/s | 6.8 KB/s |
| Download per player, 2 / 7 players | 7.4 / 25.0 KB/s | same | 8.3 / 27.4 KB/s |
| Server CPU, 2 / 7 players | 1.4 / 2.3 % | same | 1.8 / 3.6 % |

**Reading it:**
- **B alone is smoother but trails more than A**: easing toward 20 Hz data adds about 7 px of lag.
- **B+ gets most of that back**: twice the poses at half the age. It stays within 2 px (mean) of A's accuracy, without A's stalls and jumps, and its heading is better than A's.
- A's jump-to-snapshot is still slightly closer to the truth on average, and under jitter. It gets there by standing still for 3 frames of 4 and then teleporting.
- **The recommendation is B+.** If you prefer B's lower traffic, `?peers=b` shows it.

## Safety and compatibility (all automated checks pass; `evidence/e0-1/SUMMARY.md`)

- **Movement checks unchanged.** For a fast client, a 500 px jump and a move through a wall are both refused.
- **No new information.**
  - A `q` names only players the last snapshot already listed: never the receiver, never another room, never anyone dead or gone.
  - It goes only to a client in a run, and nobody moving means no `q`.
- **Epochs and stale packets.**
  - A world reset sends `world` before any `q`.
  - Crafted `q` are dropped on the page: an old world, an old tick, an unknown id, a malformed entry.
- **Mixed versions.**
  - An old client on the new server gets exactly HQ5's messages.
  - A new client on an old server asks once, gets no answer, and stays exactly at A's cadence.
  - Neither combination crashes, and B+ cannot switch itself on silently.
- **Two real browsers** (A, B, B+, B+ with 60 ms each way, and both mixed versions), checked frame by frame:
  - one pose for body, hands, gear, beam and BR-RoLE contact and cast;
  - the steering bodies are the server's positions;
  - never drawn inside a friend;
  - one avatar after a reload or a world reset;
  - 0 page errors.
- **Collision.**
  - Head-on: 5/5.
  - Aside: 0 corrections in 10 HQ5 runs; one soft correction in the first of 10 B+ runs. Too few to say it comes from B+; it is reported, not explained.
- **Gameplay smoke:** walk, turn, light, NEW RUN (gibs seen by the friend), spawn — all pass.

## A pre-existing HQ5 issue found on the way (not fixed: it is in the movement check)

**What happens.** A server-side placement (admin BRING/teleport, world reset) refills the travel budget (540 + 28 px). A pose the moved player's page sent just before it got the `tp` is then accepted as an ordinary move back, if the old spot is within about 570 px by a free route.

**Reproduced** starting 545 px away (`place_race.py`): HQ5 kept the placement 2 times out of 6, B+ 0 out of 6. From random spawns, both kept 12 of 12.

**B+ does not cause it**, but its client sends twice as often, so it may make it a little more likely.

**A small fix:** during the grace after a server placement, also ignore *accepted* moves that land far from the new spot. That changes the movement check, which this stage was told to keep, so it waits for your go-ahead.

## Not tested here

- A real GPU (the pages ran on SwiftShader at about 12 frames/s, so their frame times are not representative);
- a real internet path;
- Firefox and Safari;
- more than 7 players;
- phones.

Your Human QA covers what the machines cannot: how it feels.

## Deferred ideas (not to be started before B+ HUMAN QA PASSED)

These would belong to B++ only:
- A compact upstream pose. Today a missing `l` lights the lamp and a missing `n` renames, so the server would have to keep the omitted fields.
- `q` without the repeated epoch.
- Rounding the heading to 1/100 rad as a small integer.

## Undo

Copy `REVERT_TO_HQ5` from the overlay and delete `favicon.ico`. The game is then HQ5 byte for byte (checked). Or check out `stage-3d-hq5`.
