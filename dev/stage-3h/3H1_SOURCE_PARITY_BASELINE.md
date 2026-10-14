# Stage 3H1: the source and parity baseline of the accepted B++ game

**Label: B++ PARENT.** Every baseline here was recorded on the accepted B++ head, with no runtime file changed:

| | |
|---|---|
| Commit | `stage-3e-0-bplusplus` `143b63ff42b88c6780c5043e0f61d64100f81f40` |
| Tree | `b25c26ec3eedab406a6b93f80a59ba6a1cb7c128` |

They are the comparison base for every later Stage 3H step, and for the final comparison with the original B++ game.

**The rule for these baselines** (pack file 06):
- They are locked by their SHA-256.
- They are never updated after a production change without the user's approval and an explanation of every difference.
- Stage 3H0's baselines are **not** B++ baselines. Their parent was Stage 3C QA2, and on B++ only 1 of their 10 common server traces (`boot`) and 0 of their 9 client traces are still identical. That is the expected result of Stage 3D and 3E-0, not a defect.

**The machine:**

| | |
|---|---|
| Node | v22.22.2 |
| Browser | Playwright 1.56.0, Chromium 141.0.7390.37 headless shell, **SwiftShader software rendering** (no GPU) |
| Python | 3.11.15 |
| Kernel | Linux 6.18.44 x86_64 |
| CPUs | 2 |

`evidence/h1/versions.txt` and `evidence/h1/steps.txt` record what ran, with exit codes and durations.

## 1. Source snapshot

| What | Result | Evidence |
|---|---|---|
| Parent commit and tree | as above, checked on GitHub before the branch was made | `remote_heads_before_3h1.json` |
| Production files | 189 files outside `dev/`, 70,285,930 bytes; manifest SHA-256 `fe2f6115027eab8b…` | `scope/` (`tools/h1_scope_check.py`) |
| Runtime files | 53 (43 served, 8 server, 2 both); 26,197,019 bytes | `inventory_bpp.json` |
| Generated files | `ai.js`, `ents.js`, `sim.js` rebuild byte for byte from their sources | `build_reproducibility.json` |
| Served files | 45 (the allowlist's 43 + 2 under `sounds/`); nothing under `dev/` or `server/`, no server script, no document | `static_check.json`, `srv_golden` `http_base` / `http_h0` |
| Favicon | `favicon.ico` served as `image/x-icon`, 4,758 bytes, SHA-256 `5489c214…`, the same bytes gzipped or not | `static_check.json` |

**Start command.** `node server.js [port]`, with `ADMIN_PASSCODE` set by the user. `run_linux.sh` and `run_windows.bat` use port 8000.

**Browser load order.** In `inventory_bpp.json` `page`, in document order: the inline boot script, the manifest and favicon links, `camera_policy.js`, `timing_policy.js`, the module bundle, 9 `modulepreload`s, 2 stylesheets, then 19 classic scripts. The module bundle is deferred, so it executes after all 19.

## 2. What is frozen, and how exactly

All commands run from the repository root. `$OUT` is any scratch folder outside the repository.

### 2.1 Byte-exact golden traces

**The harness.** Stage 3H0's closed world: seeded randomness, a fake clock, fake timers and sockets, the real `sim.js` and `ai.js`. Every frame the server sends, every timer and every sim call is recorded.

- **Same inputs, same bytes.** Each run is compared with the B++ head's own `server.js` (A/A) and repeated for determinism.
- **All 16 server traces and all 9 client traces were identical A/A and on repeat.**
- **Stored.** The traces are in `evidence/h1/golden/` with their hashes.

**Server, Stage 3H0's 11 scenarios, re-recorded on B++.**

```
node dev/stage-3h0/golden/srv_golden.js --old-ref 143b63f --repeat 1 --out $OUT --write-baseline
```

| Scenario | Lines | SHA-256 of the trace |
|---|---|---|
| `boot` | 19 | `03be5f62f2dc6a108a60b899c93784e09c929c47c70a7551d1afce7f34420d14` |
| `http_base` | 267 | `8504f68e4bdc39a0a61a1d2972b9e7bffb47d4ba0e55a6b6235254cda8318546` |
| `http_h0` | 72 | `2f353cbee53792fe673a7319bf707b16e6ddb2cacaab1c7d7f801d4294606332` |
| `ws_upgrade` | 624 | `309a80c43001a22752cc4368d66d73125d30defe8db7ecdec2ce8dfb7b49e84a` |
| `ws_frames` | 1,120 | `463376e1763a9e7da464c74963fecdc70ed65a0643ac2e46aecdd124427b7b19` |
| `lifecycle` | 11,100 | `74b5cd464ee130744fb75ade04aa1fda85201bea62c89d203d2f2b3419e11108` |
| `deaths` | 15,158 | `65329c9f4bb61c7d8a4997a3791f3ef883d31d709dcad7b9997eac444c79e403` |
| `admin` | 17,310 | `883bc47df9d600973559108ca29bdfee5f4b5daa65e9361ac8dccc570bb047ee` |
| `schedule` | 1,165 | `d5bc813470eb36e3d8a2856c0dbb66cb174350f32ab06b30d19534b2c30131f7` |
| `p_fields` | 1,026 | `436ad950b0a5362dcbec5c3aeb696478e78970ac796fca8e6c12dc2dbfec7160` |
| `exit_glitch` | 706 | `985ad1296b0635842826bb370f2dc1ae4f691739543736d30e93574ca1d0b59f` |

**Server, the five B++ scenarios (new in 3H1).** `golden/srv_scenarios_bpp.js` in the same harness. 3H0's scenarios never ask `caps` and never press NEW RUN, so they cannot see B+, B++-0 or Stage 3D's NEW RUN decision.

```
node dev/stage-3h/golden/bpp_golden.js --repeat 2 --out $OUT --write-baseline
node dev/stage-3h/golden/bpp_golden.js --repeat 0 --baseline evidence/h1/golden/bpp_traces   (later: compare with this baseline)
```

| Scenario | Lines | SHA-256 of the trace |
|---|---|---|
| `bpp_caps_q` | 2,605 | `72e775b7ead4177188625e85ab209e95f4455d3a410729042a2b782822004de7` |
| `bpp_place_guard` | 2,171 | `896ccf6dbbb18074279021d60fa032fe27567f6d93ff56394c4d92ba9c3a47f8` |
| `bpp_world_guard` | 1,170 | `a96718d201f18721517e61b81076dcde2212381bd2afa34087f5275038c2357e` |
| `bpp_known_limits` | 2,681 | `35bda07236971e938931624220e38d0694b77624b44c7508181f45bf76e59775` |
| `bpp_new_run` | 8,172 | `a61b01e2cc0bcc0a26c7b5406f4bde35d73a5090dd3e3d9fd8b33a11b7de014d` |

What each one pins:

| Scenario | Pins |
|---|---|
| `bpp_caps_q` | `caps` answers (asked, never asked, malformed, another room); `q` only to fast clients, only for players whose pose changed, never their own; `k` only for fast clients; a world reset; a death removing a player from `q`; a client leaving |
| `bpp_place_guard`, `bpp_world_guard` | B++-0: stale poses after a BRING or a world reset are ignored; a placement without stale poses; a far claim 150 ms after a placement ignored |
| `bpp_known_limits` | the B++ report's two caveats, as they are (F-019, F-020) |
| `bpp_new_run` | every NEW RUN decision but `held` (a press while held in a capture, which no golden reaches yet); the blast replay to everyone; the corpse; `nra` and `nrf`, which no earlier golden saw |

**Sensitivity:**
- **The accepted B+ head (`1f2deba`) against B++.** Only `bpp_place_guard` and `bpp_world_guard` differ: B++-0's intended change. The other three are identical (`golden/bpp_vs_bplus_report.json`).
- **Nine one-line mutants** of `server.js` (`golden/bpp_mutants.js`): all 9 are caught (`golden/bpp_mutants.json`). Among them:
  - the guard off;
  - the grace 100 ms longer;
  - admin poses checked;
  - `FAST_GAP` 30;
  - `q` carrying the receiver's own pose;
  - four NEW RUN rule changes.

**Client, Stage 3H0's 9 scenes, re-recorded on B++.** `mp.js` driven in a real Chromium with a fake clock and a scripted server. Every send, every global it touches and every audio call it makes are recorded.

```
node dev/stage-3h0/golden/cli_golden.js --old-ref 143b63f --repeat 1 --out $OUT --write-baseline
```

| Scene | Entries | SHA-256 of the trace |
|---|---|---|
| `load` | 20 | `1dd9e3b9f0386256c3cf96513e77b5246fc27fd973ccf97732003b357c35a40e` |
| `menu_online` | 1,844 | `7c17bb5dce536cdb368d69815990cf390932b9ee081b14921fadfef6ef96e802` |
| `run_online` | 7,413 | `d61f90bf0c38c04d0dbbb374bfeb53dd74ba10428ee7e231154b3e70366e5225` |
| `interp` | 11,483 | `7eb8f6d25d57c952e5f775814f3f05d4bd7c3c1544379e9ac4de1ea6bb35c17b` |
| `fx_bodies` | 22,762 | `f41b0dbe275efced6de2e19f242defbcb45a85cd498f3359339dcf918c9fdb36` |
| `facade` | 1,164 | `6c709388b64aec777785145f6ed5b479da736150aca0364b8df4c5e4e35327c8` |
| `admin` | 1,333 | `90c1239bb5053a16204c2f02aa509e95e0f12f798a4c7bf9e361f1fc2edeba04` |
| `reconnect_solo` | 739 | `8c3a6b38b8167c171406ec277dfd44ef7e8310b0fc9ff4fbb7f5b98a2c28b72d` |
| `hum_dread` | 4,876 | `116637e7f617613c0e267cf4e1d7a3c2da90eb518b937f00cc86a0600e275eb6` |

### 2.2 The wire as B++ speaks it

```
node dev/stage-3h/tools/h1_wire_keys.js --srv SRV_TRACES,BPP_TRACES --cli CLI_TRACES --out $OUT/wire_keys.json
```

**Server to client.** All 18 message types the server can send were seen: `hi`, `s`, `q`, `caps`, `bodies`, `fx`, `tp`, `world`, `nra`, `nrf`, `admin`, `ares`, `msg`, `pong`, `got`, `kick`, `revive`, `exit`.

**Recorded for each type:** every key order; the peer and entity key orders of `s`; and `q`'s entry shape (`[id, x, y, a]`, all numbers).

**Client to server.** 9 of the 10 types `server.js` reads were seen from the real `mp.js`: all but `nr`. `bpp_new_run` sends `nr` from the server harness, but no client scene presses NEW RUN.

**Against 3H0's frozen contract:**

| Direction | Types new since 3H0 | Keys new since 3H0 |
|---|---|---|
| Server to client | `world`, `caps`, `q`, `nra`, `nrf` | `w` in `bodies`; `w`, `nf`, `k` in `s`; `pc` in `tp`; `de`, `wn`, `lo`, `lf`, `d`, `s` in `fx` |
| Client to server | `caps` | — |

The client no longer sends `fx` or `b`. 3H0's `contract_check.js` therefore reports 12,483 differences on B++ traces (`contract_check_3h0.json`). They are the contract's age, not defects (F-003).

### 2.3 B++'s own checks, re-run on the B++ export

Each was written for B+ or B++ and passed then; on B++ again:

| Check | Result |
|---|---|
| `dev/stage-3e-0/proto_check.js` | ok: `caps`, no `q` while still, `q` shape, rising `k` |
| `dev/stage-3e-0-bpp/place_replay.js` | 22 replays; every placement kept: BRING 545 px 7/7, world reset 2/2, short 1/1, far 1/1; for B+ and old clients |
| `dev/stage-3e-0-bpp/place_guard_check.js` | join, non-spawn join, sprint after a BRING, grace jump ignored, crowd, burst budget: B++'s behaviour |
| `dev/stage-3e-0/static_check.js` | ok, including the favicon |

### 2.4 Two real browsers, BR-RoLE and gameplay

| Check | Result | What it pins |
|---|---|---|
| `dev/stage-3e-0/two_browser.py --mode bplus`, ×2 | both ok; 136/136 frames per run | the avatar is drawn at the eased pose; the cast and the light are at the avatar (136/136); contact at it in 110 and 113 frames; `__peerBodies` are the server's targets; the closest drawn distance 37 px; worst deviation 0.005 px; reload; world reset; injected stale `q` ignored; no page errors |
| `dev/stage-3d-hq2/col_browser.py`, head and aside | 5/5 each | the server never lets two bodies closer than 37.0 and 37.1 px; aside slides past |
| `dev/stage-3d-hq5/contact_lab.py`, A/A (the same `br-role.js` twice) | 0 page errors, 0 BR-RoLE errors | **23 of 26 images byte-identical**; the 3 `lifecycle` images differ (see §3); numbers in `geometry`, `lights`, `peers` agree to 1.8 × 10⁻⁵ |
| `dev/stage-3d-hq4/gameplay_smoke.py` | ok | walk, spin, light on/off/on, frames, NEW RUN approved with the blast seen from another page, spawn after it; no page errors |

## 3. A/A noise: what "the same" means

| Probe | Same means | A/A seen on B++ |
|---|---|---|
| Golden traces (server, B++, client) | byte-identical | identical, every scenario, every repeat |
| `two_browser.py` | every check passes | `contactJobAtAvatar` 110 vs 113 of 136 (frame timing); all checks pass |
| `contact_lab.py` `geometry`, `lights`, `peers` | images byte-identical; numbers within 10⁻⁴ | 23/23 images identical; largest numeric difference 1.8 × 10⁻⁵ |
| `contact_lab.py` `lifecycle` | **not a pixel probe** | the death scene is captured at a time-dependent moment of the lights: the after-death image differs in 96 % of its pixels A/A, and the cast samples in 35 of 60 (F-030) |
| Performance | within A/A spread | `3H_PERFORMANCE_BASELINE.md` |

## 4. Coverage against what 3H must preserve

| Behaviour (master prompt, step C) | Pinned by | Strength |
|---|---|---|
| Server decisions, 60 Hz simulation | `srv_golden` `lifecycle`, `deaths`, `admin`, `schedule`, `exit_glitch` | byte-exact, seeded |
| N.A.N.I. state, seeded perception | `srv_golden` `deaths`, `schedule`; `npm test` | byte-exact, seeded; plus behavioural suites |
| B++ wire, `caps` / `q`, mixed clients, world isolation | `bpp_caps_q`; `wire_keys.json`; `proto_check`; `two_browser` | byte-exact plus live |
| Placement guard, admin teleport | `bpp_place_guard`, `bpp_world_guard`, `bpp_known_limits`; `place_replay`; `place_guard_check` | byte-exact plus live |
| Frame and remote pose, collision | `two_browser`; `col_browser`; `srv_golden` `lifecycle` | live checks, exact on what they measure |
| BR-RoLE buffers, contact shadow | `contact_lab` (images); `test_br_role` | pixel-exact in 3 of 4 scenes |
| Gore, death, corpses, light decay | `srv_golden` `deaths`; `bpp_new_run`; `cli_golden` `fx_bodies`; `gameplay_smoke` | byte-exact on the wire; the drawn result only by smoke |
| NEW RUN, respawn, reconnection, world reset | `bpp_new_run`; `srv_golden` `lifecycle`; `cli_golden` `reconnect_solo`; `two_browser` (reload, reset) | byte-exact on the server; client partly |
| Audio timing | `cli_golden` `hum_dread`: every audio API call with its time on the fake clock | calls only; nothing hears the output |
| UI, boot, favicon | `cli_golden` `load`, `menu_online`; `srv_golden` `boot`, `http_base`, `http_h0`; `static_check` | byte-exact on what is served and loaded |

**Not covered** (F-023):
- **Real GPU.** Every browser run used SwiftShader, at about 4 to 11 frames a second.
- **Real audio output.**
- **A real network:** latency, jitter, loss, the internet.
- **Phones.**
- **The LOW and HIGH lighting tiers,** and long sessions.
- **More than two pages.**
- **A client that presses NEW RUN** (`cli_golden`).
- **The live wire and raw socket comparisons.** `raw_live.js` and `live_wire.js` do not run on B++ (F-021); `two_browser.py`, `static_check.js` and the closed-world `ws_upgrade` / `ws_frames` stand in for them.

## 5. The suites: historical failures, by name

Recorded, not repaired. Every failing name matches the last record made on this lineage (`STAGE_3D_HQ2_REPORT.md` §"Suites"), except `test_br_role`, last recorded as 32/32 at HQ2 (`STAGE_3D_HQ2_REPORT.md`). Its history is below.

| Suite | B++ | Failing names | Last record | Same? |
|---|---|---|---|---|
| `npm test` (`dev/tests/run.js`) | 149/162 | P01, P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18, L9, 2F F13, 2F F22 | HQ2: 149/162, the same 13 | yes |
| `dev/shadows/test_shadows.js` | 43/48 | S06, S16, V08, X01, X02 | HQ2 and 3H0: 43/48, the same 5 | yes |
| `dev/tests/audit_net.js` | 13/17 | A1, M4, D3, R2 | HQ2: 13/17, the same 4 | yes |
| `dev/tests/audit_net2.js` | 8/11 | LC4, MT1, DD2 | HQ2: 8/11, the same 3 | yes |
| `dev/tests/s_humanqa_hotfix.js` | 5/6 | X03 | HQ2: 5/6, X03 | yes |
| `dev/br-role/test_br_role.js` | 29/32 | U01, U02, U26 | HQ2: 32/32 | see below |
| `dev/tests/ir_net.js` | 4/4 | — | — | — |
| `dev/tests/interp_test.js` | pass | — | — | — |
| `dev/stage-3b-n/test_3bn.js` | 7/7 | — | — | — |

**`test_br_role` across the lineage** (`suites/test_br_role_history.json`, each head's own test against its own files):

| Head | Result |
|---|---|
| HQ2 | 32/32 |
| HQ3 | 32/32 |
| HQ4 | 31/32 (U26) |
| HQ5 | 29/32 (U01, U02, U26) |
| B+ | 29/32 (U01, U02, U26) |
| B++ | 29/32 (U01, U02, U26) |

**What the three test.** They test the pre-HQ4 design:
- **U26:** the hands in the cast, which HQ4's accepted fix B removed;
- **U01:** the version, which HQ5 named `br-role 1.2-candidate`;
- **U02:** the compositor's clip rule, which HQ5 changed.

They are expectations that were not updated, not B++ regressions (F-017).

## 6. Evidence

Under `evidence/h1/`. The full list is in `3H1_CHANGED_FILES.txt`.

| What | Where |
|---|---|
| Source snapshot | `remote_heads_before_3h1.json`, `inventory_bpp.json`, `build_reproducibility.json` |
| Golden traces and reports | `golden/` |
| Wire, contract | `wire_keys.json`, `contract_check_3h0.json` |
| B++ checks | `bpp_checks/` |
| Browsers | `browser/` |
| Suites | `suites/` |
| Performance | `perf/` |
| Harness drift | `harness_drift/` |
| What ran | `steps.txt`, `versions.txt` |
| Scope proof per commit, push receipts | `scope/`, `remote/` |
