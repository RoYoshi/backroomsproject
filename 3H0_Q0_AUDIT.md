# Stage 3H0, checkpoint H0-0: source audit, remote safety and maps

**Verdict: the accepted parent is verified, `stage-3h0` was created from it, and the audit is written. No production file was changed at H0-0.**

The audit sits beside four companion documents:

| Document | What it records |
|---|---|
| `3H0_PROTOCOL_INVENTORY.md` | every message, field, frame rule, cadence and HTTP rule |
| `3H0_MP_API_LOCK.md`, `3H0_SERVER_API_LOCK.md` | the public surfaces that must not change |
| `3H0_MP_OWNERSHIP_MAP.md`, `3H0_SERVER_OWNERSHIP_MAP.md` | the sections, couplings and candidate seams |

Evidence is in `dev/stage-3h0/evidence/h0-0/`.

## 1. Source authority

The accepted Stage 3C QA2 commit was checked independently four ways before anything was created. Its parent is `06d7ae7`, its message "Stage 3C QA2 R3: final validation, documents and package tooling".

| Check | Result |
|---|---|
| `git ls-remote origin` → `stage-3c-qa2` | `edd2af954627caf7721c7614df5ff1c7f20d3f3b` |
| GitHub REST, commit object | sha `edd2af9…`, tree `108d89fa07634ef4816428939fc7dda1e03ec971`, parent `06d7ae7…` |
| GitHub REST, branch object `stage-3c-qa2` | head `edd2af9…`, tree `108d89f…` |
| plain `git fetch origin stage-3c-qa2` | `FETCH_HEAD` `edd2af9…`, tree `108d89f…` |
| the local object store | tree `108d89f…` |
| the accepted QA2 package (kept from QA2) | SHA-256 `aa844c68…aaff`, as stated by the user |
| `stage-3h0` on the remote before 3H0 | absent (`ls-remote` and the REST branch lookup, 404) |

**The master pack:**
- Its SHA-256 is `9111a5e2…bbef4f`, as supplied.
- It was unpacked into an empty scratch directory and treated as data. All 27 entries match its own `PACK_SHA256SUMS.txt`.
- Its read-only snapshots match Git at `edd2af9` byte for byte: `mp.js` (`9de0ad7a…`, 72,790 B), `server.js` (`a2867137…`, 30,485 B), `index.html`, `package.json` and `sim.js`.
- So do its five QA2 documents and its QA2 receipt.
- Git at `edd2af9` remains the only source used.

**Branch:**
- `stage-3h0` was created locally with `git switch -c stage-3h0 edd2af954627caf7721c7614df5ff1c7f20d3f3b`, on a clean working tree, and first pushed at this checkpoint.
- The heads of all 20 other remote branches were recorded first (`remote_heads_before_3h0.json`). Every checkpoint's verification (`dev/stage-3h0/verify_remote_h0.py`) checks:
  - that those 20 heads are unchanged;
  - that the line from `edd2af9` is straight, with no merges;
  - that QA1 `5f30e28`, the first 3C candidate `76bcc4a` and Stage 3B `6e6fa46` are ancestors.

**Environment** (recorded in `parent_verification.json`):
- Node v22.22.2, git 2.43.0, Python 3.11.15;
- Playwright 1.56.0 with Chromium 141.0.7390.37 (headless, SwiftShader software rendering);
- 2 CPUs (Intel Xeon 2.8 GHz), Linux.

Timing figures from this machine are comparisons only, never GPU or production numbers.

## 2. How the two files start today

**Server:**
- `node server.js [port]`, with zero npm dependencies. It is also reached through `npm start` and the two run scripts.
- Production is the Bloom host. A push to `main` triggers `.github/workflows/deploy-bloom.yml`, which restarts the host; the host then pulls `main` and starts the server.
- 3H0 never pushes `main`, so nothing in this stage deploys.
- **A deployment note for later:** any new server-side file that 3H0 adds arrives with a normal `git pull` of `main`. It would only be missed by a manual upload of single files, the workflow the old README described for earlier versions.

**Client:**
- `index.html` loads the policies and the game bundle in the head. The bundle is a module script, so it runs **after** parsing.
- The classic scripts run during parsing, in this order: `world.js, move.js, camcorder.js, sfx.js, gore.js, dphys.js, light.js, ents.js, glitch.js, mp.js, assets/credits_data.js, assets/ui.js, hud.js, inventory.js, assets/br-role.js, assets/level0_visuals.js, assets/l0-remaster.js`.
- **So `mp.js` runs before `window.__api` exists.** It opens its WebSocket during parsing, and reads the game API only lazily.
- The QA2 black boot gate waits for the game runtime, its assets and the theme. It does not wait for, or read, anything from `mp.js`.
- There is no service worker: the PWA is a manifest only, so there is no precache list to keep in step.

## 3. Protected files

Any change to these needs explicit approval, so 3H0 does not touch them:
- **The game:**
  - the bundle (`assets/index-*.js`, `assets/*.css` from the build);
  - `world.js, move.js, ents.js, dphys.js, gore.js, light.js, glitch.js, camcorder.js, sfx.js, hud.js, inventory.js`;
  - `camera_policy.js, timing_policy.js`;
  - `assets/br-role.js, assets/level0_visuals.js, assets/l0-remaster.js, assets/shadows-2d.js`.
- **The server side:** `sim.js, ai.js, death_srv.js`, and their `dev/` sources (`sim_head.js`, `sim_glue.js`, `ai_src/`, `ents_src/`).
- **QA2's accepted UI:** `assets/ui.js, assets/ui.css, assets/credits_data.js, assets/manifest.webmanifest`, the logo, and the two theme WAVs.
- **Everything else outside the stage:**
  - `index.html` (except, if a client extraction needs it, one new `<script>` line immediately before `mp.js`, recorded as an accounted edit);
  - `package.json, redirect.js`, the run scripts, `.github/`, `sounds/`, `audio_source/`;
  - every earlier stage's documents, tests and evidence.

**What 3H0 may change, and only at the checkpoint that justifies it:**
- `mp.js` and `server.js`;
- new helper files (client: under `assets/`; server: a new directory the allowlist cannot reach);
- a test that reads moved code by its text (only `dev/tests/interp_test.js`, and only if interpolation moves; see section 5);
- new documents, and `dev/stage-3h0/`.

## 4. Public surface and protocol

Summarized here; the complete lists are in the companion documents.

**`window.__net` has 15 members.** Thirteen exist once mp.js has run; `t0` and `_auth` are written later. The bundle uses:
- `on, tick, join, respawn, leave, deathStart, vanish, bodyMade`;
- `collected`, which mp.js never defines. That call is unreachable: the bundle's `el` list is a constant empty array, checked. This is recorded, not changed.

`testAuth` is used by 17 development tests. `fx`, `peerScreen`, `testHum` and `exitLocal` have no caller in the repository and are kept anyway.

**mp.js also creates or writes 16 other globals of its own**, and writes fields on objects owned by the game, `ents.js` and `move.js`. Those are read by:
- the bundle;
- `light.js`, `camcorder.js` and `glitch.js`;
- `assets/br-role.js`;
- the dev tests.

**The wire:**
- 10 client message types: `p join respawn leave fx b pick admin a ping`;
- 13 server message types: `hi s tp bodies fx exit got revive kick msg ares admin pong`;
- the raw frame rules;
- the 60 Hz simulation behind a 25 ms wake, with snapshots every 2nd wake, admin data every 8th and debug data every 6th;
- the HTTP allowlist.

All of these are frozen.

## 5. Existing tests and the couplings they impose

**Tests run against the parent at H0-1** to set the baseline; a failure there is the parent's, not 3H0's:
- **Server, black box** (a real `node server.js`, real WebSockets):
  - `dev/tests/live.js`
  - `dev/tests/audit_net.js`
  - `dev/tests/audit_net2.js`
  - `dev/tests/ir_net.js`
- **Simulation:** `npm test`, which is `dev/tests/run.js` and its 14 scenario files. Several historical gates are documented as failing since Stage 2E/2F, so the baseline records which.
- **Client:**
  - `dev/tests/interp_test.js`
  - `dev/stage-3b-n/test_3bn.js`, which includes the serving checks for every script `index.html` loads;
  - the QA2 regression harness `dev/stage-3c-qa2/regress/run.js`: the retained browser probes and `lifecycle_mp.py`;
  - camera fairness (`dev/tests/s_camera_fairness.js`, `dev/stage-3b-n/camera_3bn.js`);
  - BR-RoLE (`dev/br-role/test_br_role.js`);
  - the theme asset check.

**Tests that read source text,** and so fix where some lines must stay:

| Test | What it reads | Effect on 3H0 |
|---|---|---|
| `dev/tests/interp_test.js` | mp.js between `const NET = {` and `window.__netPose` | Moving interpolation means this test must load the new file instead. The code and the printed numbers must stay identical. |
| `dev/tests/s_humanqa_hotfix.js` X02 | mp.js `const CLIENT_ENTITY_SLOTS = 64` and `data-n="10"`; server.js `Math.max(1, Math.min(10, m.n \| 0 \|\| 1))` | Keeps the entity slots and the admin panel in mp.js, and the admin commands in server.js. They are not moved in 3H0. |
| `dev/tests/s_humanqa_hotfix.js` X03 | mp.js `hover.o.d ? ' · DEAD' : ''` | Keeps peer drawing in mp.js. |
| `dev/tests/s_ir.js` I1 | server.js `me.ir =`, `ir: c.ir`, and no `player.ir =` | Keeps the `p` handler and the snapshot builder in server.js. |

## 6. Findings recorded, not changed

**Behavior notes** (all also in the protocol inventory):
- `__net.collected` is undefined, but its call is unreachable (above).
- Outbound messages of 64 KiB or more are dropped silently by `frame()`. Ordinary play is far below that, but an admin stress room with dozens of entities and debug on could reach it.
- The inbound parser ignores FIN and MASK, and anything of 1,400 bytes or more is ignored. A corpse report that large would be dropped, and the server's own fallback corpse would then appear instead.
- `isFinite(null)` lets a `null` position through as 0. The movement check then refuses it and corrects the client.
- A `p` packet without `l` counts as a raised light.
- The gzip copies stay cached until the process restarts, which production does on every deploy.
- The step-time statistic in the admin debug view divides by one more than the number of steps when the 15-step cap ends a wake.

**Security.**
- Two pre-existing weaknesses around admin access were found and **reported privately to the user**. The details are deliberately not written into this repository, which is public.
- 3H0 changes no security behavior: the allowlist, admin authentication, the lockout and WebSocket acceptance stay exactly as they are.
- Any fix needs the user's approval and a separate task.

## 7. Risk map

| Risk | Where | Guard |
|---|---|---|
| A moved helper changes bytes on the wire (key order, rounding, omission) | client codecs, server framing and validation | byte-for-byte golden traces, old against new, from identical inputs (H0-1) |
| Load order or timing changes: a global appears earlier or later, or a listener or timer is added | a new client script | the helper defines only its own namespace, has no top-level side effects, and is loaded immediately before `mp.js`; the client golden trace records globals, DOM, listeners and timers from the moment of load |
| A new script fails to load and networking breaks | `index.html` + `assets/` | it is served by the existing `assets/` rule (no allowlist change); 200 and a negative 404 are tested; the failure mode is documented (as with any missing script) |
| A server module is served to browsers | a new server directory | it lives outside every allowlisted path; negative HTTP tests on its exact URLs, traversal variants and the directory |
| The `require` order changes module side effects | server.js | new modules have no load-time side effects and are required where the moved code used to be defined |
| Timing or cadence drift | the tick | not moved in 3H0; the fake-clock trace records every wake, step count and send |
| Exception swallowing changes | the inbound parser | the `try` keeps covering parse and handling; there is a fixture for a handler exception |
| A test is weakened to pass | text-reading tests | only `interp_test.js` may change, and only to read the moved code, with identical output recorded before and after |
| QA2's boot, menu, theme or HUD is disturbed | UI | no UI file is touched; the QA2 probes and the regression harness are re-run at H0-5 |
| Performance regresses | per-frame `p` building; per-snapshot server work | the extractions add no per-frame allocation; A/B timing of the server tick and of the client hook, with variance measured first |

## 8. Plan and preliminary GO / NO-GO

**H0-1: golden traces before any change.** These run against the parent, and every later checkpoint re-runs them on old and new code:
1. **The server, deterministic.**
   - `server.js` is loaded in a harness with a fake clock and fake timers, seeded randomness and a seeded simulation, fake sockets, and a captured HTTP handler.
   - It is driven through HTTP routes, the handshake and room cap, frame fixtures, every message type, lifecycle, deaths and aftermath, admin authentication and commands, and the tick cadence.
   - Every output (socket bytes, HTTP status, headers and body hash, logs, timers) goes to a trace, compared byte for byte.
2. **The client, deterministic.**
   - `mp.js` is loaded in a real Chromium page with a fake clock, a fake WebSocket and recording stubs for the game API and `__ents`.
   - It is driven through every incoming message type, the facade calls, per-frame sends, interpolation at exact times, peers, replays, bodies and the admin panel.
   - Every send, game-API call and global, DOM and timer change goes to a trace, compared byte for byte.
3. **Live.**
   - A real `node server.js` and a real browser, recording the wire per scene (menu, ENTER once, NEW RUN, death, retry, END, reconnect).
   - Also the HTTP wire bytes, compared except for `Date`.
   - Plus the existing suites in section 5.

**The seams:**
- **H0-2: client wire codec (C2).** GO if H0-1 covers every packet and record those functions touch.
- **H0-3: client interpolation (C3).** GO only if H0-2 proved the loading path and the exact-time interpolation traces cover it.
- **H0-4: server WebSocket wire (S2) first.** Then static serving (S1) and field validation (S3), each only if its own traces are exact.
- **NO-GO for 3H0, deferred to full 3H:**
  - client transport (C4);
  - the admin panel (C5a);
  - the replays and peers presentation (C5b/c);
  - the hum and dread audio;
  - server sessions (S4);
  - the snapshot builder (S5);
  - admin commands (S5b);
  - movement and aftermath.

  The reasons are in the ownership maps.
