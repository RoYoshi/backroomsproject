# Stage 3H findings

**What this is.** The engineering findings of Stage 3H, starting with 3H1's audit of the accepted B++ game (`143b63f`).

**None of them was fixed.** Stage 3H is refactor-only: the game must behave exactly as at B++. Each finding is recorded so the user can decide, and so later work does not mistake a known behaviour for a regression or "normalise" a bug by accident.

**Sanitised for a public repository.** Security details, passcodes and the production address are not written here. Security items went to the user privately (F-027).

**Labels:**

| Label | Meaning |
|---|---|
| **Confirmed** | Reproduced. How is said: a golden harness, a measurement, a test run, or reading the code where the code alone decides |
| **Suspected** | Plausible from the code or a measurement, not reproduced |
| **Limitation** | Verified to exist; a property, not a malfunction |
| **Opportunity** | Not a defect; something that could be better |

**Severity is about players**, unless the line says "for refactoring". Recommendations are in `3H_RECOMMENDATIONS.md` (R-numbers), and postponed work in `3H_DEFERRED_WORK.md`. Line numbers are at `143b63f`.

## Index

| ID | Finding | Label | Severity | Framework |
|---|---|---|---|---|
| F-001 | `ai.js`, `ents.js`, `sim.js` are build outputs | Limitation | High for refactoring | N.A.N.I., BR-R, S.P.A.C.E. |
| F-002 | The game bundle has no source; `__api` exposes minified names | Limitation | High for refactoring | BR-R (all) |
| F-003 | 3H0's protocol contract no longer matches B++ | Limitation | Medium for refactoring | B++ |
| F-004 | Retired `assets/shadows-2d.js` is still served | Opportunity | Low | A.T.L.A.S. |
| F-005 | The bundle names a PixiJS chunk that is not in the repository | Limitation | Low | BR-R |
| F-006 | Two globals have two writers; the order of writes is behaviour | Opportunity | Medium for refactoring | B++, G.I.B., F.R.O.N.T. |
| F-007 | The Level 0 map exists twice | Limitation | Medium for refactoring | L.O.S.T. |
| F-008 | The dread drone, thumps and capture burst ignore the volume setting | Confirmed (reading) | Low–medium | Spacious Audio |
| F-009 | Server messages of 64 KiB or more are dropped silently; the admin debug snapshot is at half that | Limitation + Suspected | Low | B++, OVERSEER |
| F-010 | The server's frame reader skips FIN and MASK checks and ignores text of 1,400 bytes or more | Limitation | Low | B++ |
| F-011 | Two lines with no effect (the 400 px snap, the 90-character cut) | Confirmed (reading) | None | B++, OVERSEER |
| F-012 | `__net.collected` is called but never defined; unreachable | Confirmed (reading) | None | B++ |
| F-013 | The first request for each menu WAV pauses every room (0.26 s and 0.43 s) | Confirmed (measured) | Low–medium | CASHIER, A.T.L.A.S. |
| F-014 | `sounds/sting copy.mp3` is a byte-identical duplicate, downloaded and never played | Confirmed (reading) | Low | A.T.L.A.S., Spacious Audio |
| F-015 | The gzip cache keeps a copy of every served file for the process's life | Limitation | Low | CASHIER |
| F-016 | The admin death lab's spot finder never avoids glitched walls | Confirmed (reading) | Low (admin only) | OVERSEER |
| F-017 | Historical test failures on B++, by name | Confirmed (test runs) | None (tests) | S.T.A.G.E. |
| F-018 | `TOUCH = 54` in `glitch.js` is never used | Confirmed (reading) | None | L.O.S.T. |
| F-019 | An admin's own GOTO flickers back for other players | Confirmed (harness) | Low | S.P.A.C.E., OVERSEER |
| F-020 | A pose more than 900 ms late undoes a placement | Confirmed (harness) | Low–medium | S.P.A.C.E., B++ |
| F-021 | Two 3H0 live harnesses do not run on B++: one passes vacuously, one hangs | Confirmed (run) | Medium for refactoring | S.T.A.G.E. |
| F-022 | Per-floor material: footsteps have it; floor blood does not | Confirmed (reading) | Low | G.I.B., Spacious Audio |
| F-023 | What the baseline cannot see | Limitation | Medium for refactoring | S.T.A.G.E. |
| F-024 | Version labels lag acceptance | Opportunity | None | BR-RoLE, F.R.O.N.T. |
| F-025 | Some development tests depend on the server's built-in default admin passcode | Limitation | Low | S.T.A.G.E., W.A.R.D. |
| F-026 | The 3H pack names two 3H0 documents that do not exist under those names | Limitation | None | — |
| F-027 | Public repository and deployment (summary; details private) | Limitation | See private notes | W.A.R.D. |
| F-028 | No player-facing frame rate or network display | Opportunity | None | P.U.L.S.E. |
| F-029 | A comment in `server.js` sits above the wrong code | Opportunity | None | S.P.A.C.E. |
| F-030 | The contact lab's lifecycle scene is not pixel-stable A/A | Limitation | Low for refactoring | S.T.A.G.E. |

## Architecture and source

### F-001: `ai.js`, `ents.js` and `sim.js` are build outputs

| Field | |
|---|---|
| Label | Limitation |
| Where | `dev/build_ai.sh`, `dev/build_ents.sh`, `dev/build_sim.sh` → `ai.js` (from `dev/ai_src/`, 10 parts), `ents.js` (`dev/ents_src/`, 6 parts), `sim.js` (`dev/sim_head.js` + `dev/sim_glue.js`) |
| Evidence | `dev/stage-3h/tools/h1_build_check.js` rebuilt all three in memory at `143b63f`: byte-identical (`evidence/h1/build_reproducibility.json`) |
| Severity | High for refactoring; none for players |
| Effect | None today. A hand edit to a runtime file would be lost at the next build |
| Framework | N.A.N.I. (`ai.js`), BR-R / Spacious Audio / G.I.B. (`ents.js`), S.P.A.C.E. (`sim.js`) |
| Recommendation | Edit only the sources, rebuild, run the build check (R-001) |
| Risk of acting | none |
| Disposition | Recorded; the build check is part of the proposed gate |
| Owner / phase | Stage 3H tooling (H2-0) |

### F-002: the game bundle has no source in the repository, and its facade exposes minified names

| Field | |
|---|---|
| Label | Limitation |
| Where | `assets/index-DKbV5Nv9.js` (340,823 B), line 346: `window.__api = { … }` with 52 members, among them `Bc`, `Uc`, `Oc`, `Fc`, `ll`, `ul`, `qc`, `Gc`, `Ic` |
| Evidence | No Vite project or source in the tree. 38 commits have touched the built file, its first version included. 15 loaded files read `__api` (`3H1_DEPENDENCY_OWNERSHIP_MAP.md` §2) |
| Severity | High for refactoring; none for players |
| Effect | None. Rebuilding or re-minifying the bundle would rename the minified members and break the 10 readers that use them (`move.js`, `camcorder.js`, `gore.js`, `dphys.js`, `light.js`, `ents.js`, `mp.js`, `assets/ui.js`, `assets/br-role.js`, `assets/l0-remaster.js`); the other 5 use only named members such as `audio()` |
| Framework | BR-R, and the game loop |
| Recommendation | Treat the bundle as fixed bytes in Stage 3H (R-015 for the map it holds) |
| Risk of acting | very high |
| Disposition | NO-GO in 3H |
| Owner / phase | a future rebuild stage only, with the user's assets and a source |

### F-003: Stage 3H0's frozen protocol contract no longer matches B++

| Field | |
|---|---|
| Label | Limitation (tooling) |
| Where | `dev/stage-3h0/protocol_contract.json`; `dev/stage-3h0/golden/contract_check.js` |
| Evidence | On B++ traces, `contract_check.js` reports 12,483 differences (`evidence/h1/contract_check_3h0.json`). `wire_keys.json` shows why: 5 server message types, 1 client type and 11 keys added by Stage 3D and 3E-0, and the client's `fx` and `b` gone |
| Severity | Medium for refactoring |
| Effect | None for players. A gate that used the old contract would always fail, or be ignored |
| Framework | B++ |
| Recommendation | Write a B++ contract v2 on purpose (R-002, part of H2-0) |
| Risk of acting | none (`dev/` only) |
| Disposition | Recorded |
| Owner / phase | H2-0 |

### F-004: the retired `assets/shadows-2d.js` is still served

| Field | |
|---|---|
| Label | Opportunity |
| Where | `assets/shadows-2d.js` (74,094 B); `server/static.js` line 15: `SERVE` allows `assets/[\w.\-]+` |
| Evidence | No `index.html` tag loads it (`inventory_bpp.json` `page`). It would set `__mp` and `__shadows` if loaded. `test_shadows.js` S16 still expects the page to load it |
| Severity | Low |
| Effect | None in play; an extra public URL |
| Framework | A.T.L.A.S. (assets) |
| Recommendation | Retire it from the tree only with the user's agreement, together with S16 (R-014) |
| Risk of acting | low, but it changes the served set |
| Disposition | Recorded |
| Owner / phase | a release-hygiene stage |

### F-005: the bundle names a PixiJS chunk that is not in the repository

| Field | |
|---|---|
| Label | Limitation |
| Where | `assets/index-DKbV5Nv9.js` lines 1–2: `import('./webworkerAll-ByhiNG9W.js')` |
| Evidence | The file is absent (`inventory_bpp.json` `esm.missing`). PixiJS loads it only in a Web Worker environment, which the game never creates. 0 page errors in every browser run |
| Severity | Low |
| Effect | None observed |
| Framework | BR-R (vendor) |
| Recommendation | Leave it |
| Risk of acting | — |
| Disposition | Recorded |
| Owner / phase | — |

### F-006: two globals have two writers, and the order of the writes is behaviour

| Field | |
|---|---|
| Label | Opportunity (document the contract) |
| Where | `__kill`: set by `mp.js` `announceKill` (line 249), cleared at lines 51, 52, 161, 235; taken and cleared by the bundle's `beginDeath` (line 336). `__hideSelf`: set `true` by `assets/ui.js` line 24 before the module runs; cleared by the bundle's `Su()` at every start (line 336), and set again by `Xok()` when a NEW RUN is approved (line 344) and by `Nend()` at END (line 345) |
| Evidence | Read in the code. `__mp` would have a second writer only if the retired `shadows-2d.js` were loaded. The first inventory listed `__glitches` too, from a comment; corrected, since only `mp.js` writes it |
| Severity | Medium for refactoring; none for players |
| Effect | None today. Reordering `index.html`, or loading a script later, would change who wins |
| Framework | B++ and G.I.B. (`__kill`); F.R.O.N.T. (`__hideSelf`) |
| Recommendation | Name these hand-offs in any future module header; never reorder scripts in a refactor |
| Risk of acting | — |
| Disposition | Recorded |
| Owner / phase | every 3H step touching these files |

### F-007: the Level 0 map exists twice

| Field | |
|---|---|
| Label | Limitation (3H0 finding, still true) |
| Where | the bundle, line 323 (`Oc` rooms, the carve lists, `Fc` lamps), and `sim.js` line 7 (from `dev/sim_head.js`) |
| Evidence | The same room table and carve arrays in both. `3H0_FUTURE_LEVEL_AUTHORING_SEAMS.md` also lists the light kinds in five places |
| Severity | Medium for refactoring |
| Effect | None today. Editing the map on one side would make server collision and the drawn level disagree |
| Framework | L.O.S.T. |
| Recommendation | One source for both, in a level-format stage (R-015) |
| Risk of acting | high; the bundle cannot be rebuilt |
| Disposition | NO-GO in 3H |
| Owner / phase | L.O.S.T. stage |

### F-008: the dread drone, thumps and capture burst ignore the volume setting

| Field | |
|---|---|
| Label | Confirmed by reading; not heard |
| Where | `mp.js` `initAudio` (366–374) creates its own `AudioContext`. `thump` (377–383) and `burst` (384–389) connect to its destination. Line 1033: `dg.gain.value = soundOn() ? k * k * .16 : 0` |
| Evidence | Every other game sound goes through the bundle's master gain, `0.14 × window.__vol` (bundle line 336). `assets/ui.js`'s menu theme follows `__vol` too. `mp.js` never reads `__vol`, only the SOUND toggle |
| Severity | Low–medium |
| Effect | A player who lowers the master volume (without muting) still hears the dread drone, thumps and the capture burst at full level |
| Framework | Spacious Audio |
| Recommendation | Route them through the master volume when audio is next authorized (R-005) |
| Risk of acting | it changes what players hear |
| Disposition | Not changed: audio is locked until Stage 3F |
| Owner / phase | Stage 3F |

## Network and protocol

### F-009: server messages of 64 KiB or more are dropped silently, and the admin debug snapshot is at half that

| Field | |
|---|---|
| Label | Limitation (3H0), plus a suspected risk |
| Where | `server/ws.js` `frame` (12–16) returns `null` at 65,536 bytes or more; `server.js` `send` (line 247) then sends nothing. The admin debug payload: `server.js` 439–462 (`dbgList = room.sim.debugInfo()` at line 440, `msg.dbg = dbgList` at 460) |
| Evidence | The largest `s` in the goldens is 32,770 bytes: an admin with AI DEBUG on, 21 entities (`srv_golden` `admin`). Admins may add up to 64 Hounds and 64 Smilers (`sim.js` line 20). Not reproduced beyond 21 entities |
| Severity | Low (admin debug only) |
| Effect | Estimated: with AI DEBUG on and about 40 or more entities, every snapshot that carries the debug list (every 3rd) would be dropped for that admin, so the debug view would freeze. Players are unaffected |
| Framework | B++, OVERSEER |
| Recommendation | Bound or split the debug payload, or count drops (R-009) |
| Risk of acting | low; admin only |
| Disposition | Recorded |
| Owner / phase | an OVERSEER or B++ stage |

### F-010: the server's frame reader skips FIN and MASK checks and ignores text of 1,400 bytes or more

| Field | |
|---|---|
| Label | Limitation (3H0, still true) |
| Where | `server/ws.js` `reader` (17–33). Line 30: `if (op === 1 && len < 1400)` |
| Evidence | Read in the code. The largest client message in the client goldens is a `p` of 248 bytes |
| Severity | Low |
| Effect | None with this client. A fragmented or larger message would be ignored without a sign |
| Framework | B++ |
| Recommendation | Leave as is in 3H; detail went to the private notes |
| Risk of acting | — |
| Disposition | Recorded |
| Owner / phase | a security stage |

### F-011: two lines with no effect

| Field | |
|---|---|
| Label | Confirmed by reading (3H0 findings, still true) |
| Where | `mp.js` line 214: `if (Math.hypot(p.x - o.x, p.y - o.y) > 400) { o.x = p.x; o.y = p.y; }`. `server.js` line 259: `String(msg).slice(0, 90)` |
| Evidence | Peers: in mode `a` the next statement copies `x`, `y` anyway; in `b` / `bplus`, `PEER_SNAP` (96 px) already snaps any jump over 96 px. Admin answers: the largest `ares` frame in all 16 server goldens is 91 bytes including its JSON wrapper (a 59-character message), far under the cut |
| Severity | None |
| Effect | None |
| Framework | B++; OVERSEER |
| Recommendation | Leave them; remove only inside a step that already touches those lines (R-019) |
| Risk of acting | low |
| Disposition | Recorded |
| Owner / phase | — |

### F-012: `__net.collected` is called but never defined

| Field | |
|---|---|
| Label | Confirmed by reading (3H0, still true) |
| Where | bundle line 346: `window.__net.collected(el.indexOf(window.__c))`. `mp.js`'s `__net` (38–72) has no `collected` |
| Evidence | The call is behind `rl(H.x, H.y)`, which searches `el`, and `el` is a constant empty array (bundle line 335) |
| Severity | None |
| Effect | None |
| Framework | B++ |
| Recommendation | Leave it (R-019) |
| Risk of acting | — |
| Disposition | Recorded |
| Owner / phase | — |

## Delivery and assets

### F-013: the first request for each menu-theme WAV pauses every room

| Field | |
|---|---|
| Label | Confirmed (measured) |
| Where | `server/static.js` 38–48: no MIME type for `.wav` (line 16), so `application/octet-stream`; `no-store`; `zlib.gzipSync(b, { level: 9 })` on the first request, cached in `gz` |
| Evidence | `dev/stage-3h/tools/h1_wav_stall.js`, two runs on a real server (`evidence/h1/perf/wav_stall_*.json`). Snapshot gaps are 50.6 ms idle, and reach 264–270 ms during the first Intro request and 424–430 ms during the first Loop request; they are normal on repeat requests. Gzip saves 3.4 % and 2.1 % |
| Severity | Low–medium |
| Effect | After each server start (every deploy restarts it), the first visitor who opens the menu makes every room hitch twice: about a quarter and then nearly half a second. In a secure context (HTTPS, or localhost) `assets/ui.js` keeps the files in the browser's Cache Storage after the first visit (line 450 checks `window.isSecureContext`); over plain HTTP every visit downloads the 22.6 MB again, since they are sent `no-store` |
| Framework | CASHIER, A.T.L.A.S. |
| Recommendation | Serve `.wav` as audio without gzip, or compress ahead of time (R-004) |
| Risk of acting | a delivery change: the bytes on the wire change, the files do not |
| Disposition | Recorded |
| Owner / phase | a delivery or optimisation stage, with the user's approval |

### F-014: `sounds/sting copy.mp3` is a byte-identical duplicate that is downloaded and never played

| Field | |
|---|---|
| Label | Confirmed by reading |
| Where | `sounds/sting copy.mp3` and `sounds/sting.mp3`, both 113,167 B with the same SHA-256. `sfx.js` line 12 `key()` turns the copy's name into `sting_copy` |
| Evidence | `sfx.js` fetches and decodes every file `/sounds/` lists. Nothing plays `sting_copy` |
| Severity | Low |
| Effect | 113 KB more to download and decode at load; nothing audible |
| Framework | A.T.L.A.S., Spacious Audio |
| Recommendation | The user decides whether to remove it; it is a user-supplied asset (R-006) |
| Risk of acting | low; it changes the served set |
| Disposition | Recorded |
| Owner / phase | the user |

### F-015: the gzip cache keeps a copy of every served file for the process's life

| Field | |
|---|---|
| Label | Limitation (3H0 noted it) |
| Where | `server/static.js` line 14 (`gz`), line 44 |
| Evidence | One entry per file it gzips: the non-PNG files the allowlist serves, at most 41 (`/sounds/*` and PNG images bypass it); about 22 MB for the two WAVs alone (F-013) |
| Severity | Low |
| Effect | Server memory only |
| Framework | CASHIER |
| Recommendation | With R-004 |
| Risk of acting | low |
| Disposition | Recorded |
| Owner / phase | with F-013 |

## Admin and development tools

### F-016: the admin death lab's spot finder never avoids glitched walls

| Field | |
|---|---|
| Label | Confirmed by reading (3H0, still true) |
| Where | `mp.js` `findSpot` (719–721): `!gl.some(g => Math.hypot(g.x - x, g.y - y) < 260)` |
| Evidence | `window.__glitches` holds arrays `[x, y, nx, ny]` (`mp.js` lines 291, 329, 331), so `g.x` is undefined, the distance is `NaN` and the test is always false |
| Severity | Low (admin only) |
| Effect | The death lab can place an admin next to a glitched wall |
| Framework | OVERSEER |
| Recommendation | `g[0]`, `g[1]` when the admin panel is next authorized (R-010) |
| Risk of acting | low; admin only |
| Disposition | Recorded |
| Owner / phase | an OVERSEER stage |

### F-017: historical test failures on B++, by name

| Field | |
|---|---|
| Label | Confirmed (test runs) |
| Where | `dev/tests/run.js` (`npm test`), `dev/shadows/test_shadows.js`, `dev/tests/audit_net.js`, `audit_net2.js`, `s_humanqa_hotfix.js`, `dev/br-role/test_br_role.js` |
| Evidence | `evidence/h1/suites/`: `npm test` 149/162, `test_shadows` 43/48, `audit_net` 13/17, `audit_net2` 8/11, `s_humanqa_hotfix` 5/6, `test_br_role` 29/32. Every name matches HQ2's record. The exception is `test_br_role`, whose 3 failures appear at HQ4 (U26) and HQ5 (U01, U02), with accepted design changes (`3H1_SOURCE_PARITY_BASELINE.md` §5) |
| Severity | None for players |
| Effect | A refactor must keep exactly these names failing, no more and no fewer |
| Framework | S.T.A.G.E. (tests) |
| Recommendation | Update stale expectations only with the user's agreement (R-016) |
| Risk of acting | — |
| Disposition | Preserved |
| Owner / phase | each 3H gate compares by name |

### F-018: `TOUCH = 54` in `glitch.js` is never used

| Field | |
|---|---|
| Label | Confirmed by reading (3H0, still true) |
| Where | `glitch.js` line 10 |
| Evidence | The 54 px exit radius in use is in `mp.js` line 331 (offline) and `sim.js` line 252 (online) |
| Severity | None |
| Effect | None |
| Framework | L.O.S.T. |
| Recommendation | R-019 |
| Risk of acting | — |
| Disposition | Recorded |
| Owner / phase | — |

## B++'s two stated caveats

### F-019: an admin's own GOTO flickers back for other players

| Field | |
|---|---|
| Label | Confirmed (golden harness) |
| Where | `server.js` `onMessage` line 348: an admin's pose goes to `adminMove` (192–203), not to `mvCheck`, so B++-0's placement guard (lines 85–86) does not apply |
| Evidence | Golden `bpp_known_limits`. An admin at (504, 888) GOTOs a watcher; the server places it at (844, 888); its page sends the old spot for 75 ms. The watcher sees the admin at (844, 888) at 2,000 ms, back at (504, 888) from 2,025 ms, and at (844, 888) again in the snapshot at 2,100 ms (`evidence/h1/golden/known_limits_summary.json`) |
| Severity | Low |
| Effect | After an admin teleports itself (GOTO, the glitched wall or Cartograph shortcuts, ENTITY GOTO), other players may see it jump back to where it was for about one round trip, then forward again. The B++ report states this caveat |
| Framework | S.P.A.C.E., OVERSEER |
| Recommendation | Only if the user wants it: guard an admin's own placements too, in a B++ correction (R-007) |
| Risk of acting | medium; the admin's debug tools move it from its own page |
| Disposition | Accepted caveat; pinned as is |
| Owner / phase | a separately authorized B++ correction |

### F-020: a pose more than 900 ms late undoes a placement

| Field | |
|---|---|
| Label | Confirmed (golden harness) |
| Where | `server.js` `MV.GRACE` 900 (line 41); `mvCheck` (79–114): the guard holds only while `now < v.grace` (line 86); after that a pose within the budget is an ordinary move (line 108), and the next one is corrected (line 112) |
| Evidence | Golden `bpp_known_limits`, second room. A BRING of 545 px; the Mover's connection is silent for 950 ms; one pose from before the BRING arrives. It is accepted, the next pose at the placed spot is refused, and the server sends `tp` back to the old spot (`known_limits_summary.json`) |
| Severity | Low–medium |
| Effect | On a connection that stalls for about a second around a BRING, respawn or world reset, the player is sent back to where they stood before. The B++ report states this caveat. The wider B++ QA will show whether it happens in practice |
| Framework | S.P.A.C.E., B++ |
| Recommendation | If it shows up: tie the guard to the client's acknowledgement of the placement instead of a time window (R-008) |
| Risk of acting | high; a protocol change |
| Disposition | Accepted caveat; pinned as is |
| Owner / phase | a B++ correction, only after the wider QA |

## Test harnesses and coverage

### F-021: two Stage 3H0 live harnesses do not run on B++

| Field | |
|---|---|
| Label | Confirmed (run) |
| Where | `dev/stage-3h0/golden/raw_live.js` `oldTree` (26–30): its copy of the tree leaves out `server/`, so B++'s `server.js` cannot start there. `dev/stage-3h0/golden/live_wire.js` line 57 waits to click `#runEnd` |
| Evidence | `raw_live.js --aa` exited 0 with no output and no report: a vacuous pass (`evidence/h1/harness_drift/`). `live_wire.js` waited 773 s for an END button that HQ2's NEW RUN flow no longer shows, and was stopped |
| Severity | Medium for refactoring |
| Effect | None for players. A gate that trusted `raw_live.js`'s exit code would pass without testing anything |
| Framework | S.T.A.G.E. |
| Recommendation | 3H copies that work on B++ and fail loudly (R-003, part of H2-0) |
| Risk of acting | none (`dev/` only) |
| Disposition | Not used in the B++ baseline; replaced by the probes listed in `3H1_SOURCE_PARITY_BASELINE.md` §4 |
| Owner / phase | H2-0 |

### F-022: per-floor material: footsteps have it, floor blood does not

| Field | |
|---|---|
| Label | Confirmed by reading |
| Where | `move.js` sets `mv.surf` from `WORLD.surfaceAt` (`move.js` line 199; `world.js` 206–214: DAMP ROOMS `wet`, LONG ROOM `concrete`, DEEP CARPET `deep`, else `carpet`). `mv.foot` (375–388) plays `wet`, `hollow` (for concrete) or `carpet` footsteps, and crouch steps get the surface itself; the bundle's own room choice (line 346) is used only without `move.js`. `gore.js` has no floor-material input; its wall stains use only the wallpaper surfaces (`gore.js` line 389) |
| Evidence | Read in the code |
| Severity | Low |
| Effect | Blood looks the same on carpet, damp floor or concrete. Footsteps already differ by room |
| Framework | G.I.B., Spacious Audio |
| Recommendation | A future gore/audio item (R-012) |
| Risk of acting | it changes visuals and audio |
| Disposition | Deferred |
| Owner / phase | Stage 3F, or a later G.I.B. stage |

### F-023: what the baseline cannot see

| Field | |
|---|---|
| Label | Limitation |
| Where | the probes in `3H1_SOURCE_PARITY_BASELINE.md` |
| Evidence | Not covered: a real GPU (SwiftShader only); real audio output (only the audio calls are recorded); a real network; phones; the LOW and HIGH lighting tiers; long sessions; more than two pages; a client pressing NEW RUN; the live wire and raw socket comparisons (F-021) |
| Severity | Medium for refactoring |
| Effect | A change in those areas could pass every automatic probe. Each runtime step therefore ends in the user's own Human QA |
| Framework | S.T.A.G.E. |
| Recommendation | Human QA per step; a client NEW RUN golden before C-3 |
| Risk of acting | — |
| Disposition | Recorded |
| Owner / phase | every 3H step |

### F-024: version labels lag acceptance

| Field | |
|---|---|
| Label | Opportunity |
| Where | `assets/br-role.js` line 98: `VERSION = 'br-role 1.2-candidate'` (shown in BR-RoLE's DEBUG corner panel); `assets/ui.js` line 25: `VERSION = 'stage-3c-qa2'` |
| Evidence | HQ5 accepted BR-RoLE 1.2 without renaming it |
| Severity | None |
| Effect | Only on debug views |
| Framework | BR-RoLE, F.R.O.N.T. |
| Recommendation | Rename with the next authorized visible change (R-013) |
| Risk of acting | a visible string and `test_br_role` U01 |
| Disposition | Recorded |
| Owner / phase | — |

### F-025: some development tests depend on the server's built-in default admin passcode

| Field | |
|---|---|
| Label | Limitation |
| Where | 25 development scripts carry it as a literal or as the fallback when `ADMIN_PASSCODE` is unset. In `dev/tests/`: `live.js`, `live_chase.js`, `audit_net.js`, `audit_net2.js`, and `admin_test.py`, `audio_test.py`, `chase_mp.py`, `commit_mp.py`, `death_film.py`, `death_spectator.py`, `fallback_parity.py`, `ir_test.py`, `lifecycle_mp.py`, `light_test.py`, `move_test.py`, `nav_mp.py`, `play_mp.py`, `smiler2d_view.py`, `smiler_view.py`. In `dev/shadows/`: `harness_lib.js`, `browser_shadows.js`, `scene_bench.js`, `shots.js`. Also `dev/stage-3c/ui_lib.js` and `dev/stage-3c-qa2/regress/lifecycle_mp.py`. The value is not repeated here |
| Evidence | Read in the code. Stage 3H1 never ran `live.js` or used `harness_lib.js`; the suites it ran were given a synthetic passcode |
| Severity | Low |
| Effect | Those tools cannot run against a server started with the user's own passcode |
| Framework | S.T.A.G.E., W.A.R.D. |
| Recommendation | Read the passcode from the environment only (R-016) |
| Risk of acting | none (`dev/` only) |
| Disposition | Recorded |
| Owner / phase | H2-0 or a test-hygiene step |

### F-026: the 3H pack names two 3H0 documents that do not exist under those names

| Field | |
|---|---|
| Label | Limitation (documentation) |
| Where | pack file 05: `3H0_CLIENT_API_LOCK.md`, `3H0_PROTOCOL_CONTRACT.md` |
| Evidence | The repository has `3H0_MP_API_LOCK.md`, `3H0_PROTOCOL_INVENTORY.md` and `dev/stage-3h0/protocol_contract.json`; 3H1 read those |
| Severity | None |
| Effect | — |
| Framework | — |
| Recommendation | Use the real names in later packs |
| Risk of acting | — |
| Disposition | Recorded |
| Owner / phase | — |

### F-027: the public repository and deployment (summary; details private)

| Field | |
|---|---|
| Label | Limitation |
| Where | the GitHub repository; `.github/workflows/deploy-bloom.yml`; `redirect.js`; `server.js`'s admin authentication and WebSocket upgrade |
| Evidence | Read, not exploited, nothing changed: |
| | - the repository is public, so every tracked file, including `dev/` and its evidence, is public; |
| | - everything the server serves is public by nature; |
| | - a push to `main` asks the host to restart and pull `main`; no `stage-*` branch deploys; |
| | - `redirect.js` contains the production address. |
| | Security items in the admin authentication and connection handling were given to the user privately, outside the repository, as in Stage 3H0 |
| Severity | see the private notes |
| Effect | — |
| Framework | W.A.R.D. |
| Recommendation | The user decides; a separate, bounded security stage (R-018) |
| Risk of acting | — |
| Disposition | No security behaviour changed in 3H1 |
| Owner / phase | the user |

### F-028: no player-facing frame rate or network display

| Field | |
|---|---|
| Label | Opportunity |
| Where | — |
| Evidence | Players see the `#net` badge (`mp.js` line 11: SOLO, or online). Admins with AI DEBUG see the server's step time and snapshot size (`server.js` `room.pf`, `dbgPerf`). There is no frame-rate or ping display for players |
| Severity | None |
| Effect | — |
| Framework | P.U.L.S.E. |
| Recommendation | An opt-in, default-off feature milestone, outside behaviour-preserving 3H (R-011) |
| Risk of acting | it would be a visible change |
| Disposition | Deferred |
| Owner / phase | a later feature stage |

### F-029: a comment in `server.js` sits above the wrong code

| Field | |
|---|---|
| Label | Opportunity |
| Where | `server.js` line 115: "a server-side move of a player (spawn, admin tools)…" |
| Evidence | It describes `moveTo` (line 186), but Stage 3D inserted the aftermath (116–163), `worldReset` (164–181) and `bodyAt` / `putBody` (182–185) between them |
| Severity | None |
| Effect | It misleads a reader of the code |
| Framework | S.P.A.C.E. |
| Recommendation | Move it with any authorized step that touches either block (R-019) |
| Risk of acting | none |
| Disposition | Recorded |
| Owner / phase | — |

### F-030: the contact lab's lifecycle scene is not pixel-stable A/A

| Field | |
|---|---|
| Label | Limitation (tooling) |
| Where | `dev/stage-3d-hq5/contact_lab.py`, scene `lifecycle` |
| Evidence | The same `br-role.js` twice: 23 of 26 images byte-identical, but the after-death image differs in 96 % of its pixels (a darker light at the capture moment), and 35 of 60 cast samples differ (`evidence/h1/browser/contact_lab_aa_images.json`) |
| Severity | Low for refactoring |
| Effect | A pixel comparison of that scene would flag noise as a change |
| Framework | S.T.A.G.E. |
| Recommendation | Compare `lifecycle` by its checks, not its pixels; or freeze its clock |
| Risk of acting | none |
| Disposition | Recorded in the baseline's A/A table |
| Owner / phase | H2-0 |
