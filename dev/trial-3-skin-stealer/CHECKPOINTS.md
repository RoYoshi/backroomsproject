# Trial 3 — Skin-Stealer: checkpoints

Branch `trial-3-skin-stealer`, from P9 `1ff9374babc034eafed4c7c26dc941f46fc55908` (tree `d6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef`).
Each row is filled after its push has been verified on GitHub (`tools/verify_remote_t3.py`); the verification record is in
`evidence/remote/`.

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| T0 recon, plan, matrix, decisions, baseline | `98d28196d25a1cea6167323548571a99e399a44e` | `40b2191329b2c504c8801462ed30c08bd0cef755` | `1ff9374` | yes: `evidence/remote/t0.json` (ls-remote and the GitHub API agree; every protected branch at its frozen SHA; no other branch moved) |
| T1 third species, admin-only spawn, bounded snapshot, first view | `23bba42815fa6777a53cccfeb9de46d8766d34de` | `d1172702a720606fecbb4616755969f92f02fd5f` | `98d2819` | yes: `evidence/remote/t1.json`; secret scan of the pushed commit CLEAN |
| T2 the animal: hunger, stamina, senses, non-engagement, budgets | `8b2d734e7cf178f1a90b3036bc0180ed78a6a512` | `7e6923490c36fbed36139be93b0613782815f5a4` | `23bba42` | yes: `evidence/remote/t2.json`; secret scan of the pushed commit CLEAN |
| T3 lying in wait, prediction, interception, the race, hearing | (this commit; recorded at T4) | | `8b2d734` | |

## T0 baseline (P9 `1ff9374`, this machine, before any game change)

| Run | Result |
|---|---|
| `npm test` (seeded suites) | 149 / 162 pass; the 13 failures are the ones P9 already records (P01, P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18, L9, 2F F13, 2F F22): `evidence/t0/npm_test_p9_baseline.txt` |
| `npm run test:humanqa` | 5 / 6; X03 fails on P9 too (it looks for a minified string the current bundle no longer has): `evidence/t0/humanqa_p9_baseline.txt` |
| `npm run build:check` | PASS (43 outputs and the manifest) |
| `dev/tools/checks/parts.js` | PASS (8 outputs, 55 parts) |
| `dev/tools/checks/modules.js` | PASS (29 server files, 23 factories; the sim 10 modules; the page 6 scripts, 32 modules) |
| `dev/tools/docs/docs.js --check` | PASS (23 generated blocks) |
| `dev/tools/checks/facts.js` | PASS (41 facts, 169 copies) |
| `dev/tools/checks/chat_server.js` | PASS (88 of 88): `evidence/t0/chat_server_p9_baseline.txt` |
| Fast / full gate | not run at T0 (no code changed; P9's accepted record stands); the fast gate runs at T1 and T7 |

## T1 — the third species (results on the T1 tree)

What T1 adds: N.A.N.I.'s third server species (`ai.skinstealer.js`: its own name, act table, collider, senses, traits and hooks; at T1
it only roams), admin-only spawning (OVERSEER: add / near / remove, capped at 4, in the dark, away from every living player; never by the
world reset, the director or RESPAWN ALL), the bounded `ss` snapshot list (sent only while one exists, so P9's snapshot is byte-identical
without one), the client mirror and a first, provisional body in a new page script (`public/assets/skinstealer.js`, built from four
parts under `src/`), drawn in the bundle's sight-masked creatures layer and shaded by the light where it stands.  No TypeScript change.

| Run | Result |
|---|---|
| `npm test` | 157 / 170: the 8 new SK01–SK08 cases pass; the 13 failures are exactly P9's (`evidence/t1/npm_test_t1.txt`) |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 (`evidence/t1/humanqa_t1.txt`) |
| `dev/tools/checks/chat_server.js` | 88 / 88 (`evidence/t1/chat_server_t1.txt`) |
| fast modernization gate (all 21 steps) | PASS 21 / 21 (`evidence/t1/gate_fast_t1.txt`): B++'s server, session, sim, page, client and bundle traces unchanged; `cli_golden` runs 232 of `mp.js`'s 234 functions (the two in UNRUN: P9's one and `bodySkin`) |
| `tools/skin_browser.js` (real server, headless Chromium) | 10 / 10 (`evidence/t1/browser_t1.json`, screenshots `evidence/t1/*.png`) |

Two gate findings shaped T1 (both kept the gate's guarantees rather than weakening a check):
- the client golden (`cli_golden`) records the admin panel's tab bar and the page body; a sixth tab always present changed B++'s trace.
  The SKIN tab is therefore shown only after **K** is pressed with the panel open, while a Skin-Stealer exists, or while it is the open
  tab; otherwise the panel is P9's.  Its body (`bodySkin`) is the one new `mp.js` function and is listed in `cli_golden_c3c.js`'s UNRUN
  with this trial's browser tool as its runner.
- the `__api` contract and its pages are regenerated because the new page script reads `__api.layer()` and `__api.death()`.

## T2 — the animal (results on the T2 tree)

What T2 adds (server only; `ai.skinstealer.js` and one engine line): hunger (one continuous variable, rising near or far, falling only
by feeding) and stamina (drained by running pro rata, regained walking or still, exhaustion caps its speed; no plan or state change
resets either), the decision between **watch / retreat / approach / leave** on its 10 Hz think from what it perceives (eye contact,
the light on its own body, how many people it sees, its hunger), the **encounter budget** (seconds spent on one person never refilled by
a change of plan) and the **departure** (far, dark, away from everyone it perceives, with a cooldown on that person).  The engine's far
step gains one optional hook (`sp.farTick`), so a far Skin-Stealer stays hungry; no Hound or Smiler path changes.

One fix while porting from the draft: the encounter clock counted nominal think steps (0.1 s), but thinks run a little slower than
10 Hz, so it under-counted real time by ~14% and an engagement could outlast its budget.  It now counts real elapsed time.

| Run | Result |
|---|---|
| `npm test` | 166 / 179: SK01–SK08 and SK10–SK18 pass; the 13 failures are exactly P9's (`evidence/t2/npm_test_t2.txt`) |
| server gate steps (build, parts, modules, contracts, docs, scope, srv_golden, bpp_golden, session, sim, protocol, mutants, quick_suites) | PASS 13 / 13 (`evidence/t2/gate_server_t2.txt`): B++'s server traces, sessions and sim calls unchanged |
| client / browser | not rerun: T2 changes no client file (the snapshot's `ss` keys and the page script are T1's) |

## T3 — the strategist (results on the T3 tree)

What T3 adds (server only): **lure** (the bait: a hungry one that is seen backs slowly round a corner and lies in wait, still; it gives
up and leaves when nobody follows), **intercept** (a guess of their route from its last record, the first point it can reach before
them, a hidden spot beside it; it can be wrong and says so), **chase** (short, only after somebody running from it or winded; it
gives up when it is losing the race, out of breath, or after 7 s), **search** (where it last knew them, or where it heard something;
it listens and gives up), and acting on **hearing** (a fresh, real sound sends a hungry one to look; footsteps passing close by in
the dark, while it waits, make it follow). Design: `DESIGN_DECISIONS.md` D3–D5 (revised as built); numbers: `BALANCE_TABLE.md`
"As built after T3".  The engine gains one more optional hook, `sp.still` (a deliberate hold is not "stuck" to the watchdog).

Found and fixed while building T3 (each found by a scenario, not assumed):
- the first predictor (next junction, then an exit) degenerated in Level 0's open, pillared rooms; it was replaced by walking the
  heading by walkability with guessed turns (sight rays pass over low walls, feet do not), then the first point it can reach first;
- it guessed right but arrived late (it travelled at stalking speed, and straight-line distance under-estimated the way round a
  wall): it now runs to an interception and checks its real route length;
- footsteps it hears near an interception are anonymous (a stale record does not claim them); its "heard close by" now uses any
  fresh person-made sound, the evidence it actually has;
- someone simply walking away was treated as fleeing (so it chased instead of stalking): "fleeing" is now running, or hurrying off
  after eye contact;
- a deliberate hold left its old route in place and the engine's watchdog took it for being stuck: holds now clear the route and
  say so through `sp.still`.

| Run | Result |
|---|---|
| `npm test` | 172 / 185: SK01–SK08, SK10–SK18, SK20–SK25 pass; the 13 failures are exactly P9's (`evidence/t3/npm_test_t3.txt`; the T3 cases with their measurements: `evidence/t3/sk_t3_results.txt`) |
| server gate steps (13) | PASS 13 / 13 (`evidence/t3/gate_server_t3.txt`) |
| client / browser | not rerun: T3 changes no client file |

T3's scenario numbers (seeded; `sk_t3_results.txt`): the predictor's guess is identical wherever the unseen person is (16/16) and
varies at a fork (10 / 5 / 1 over 16 seeds); bait: 8/8 lay in wait hidden and still, 8/8 gave up after ~10.5 s when nobody followed,
7/8 followers came round the corner within 320 px; race: a fresh runner was never closer than 346 px and it gave up "losing the
race", a winded one was reached at 152–154 px; interception: identical runs until its evidence differed (8/8), it met the person who
kept to their way within 121–244 px (5/5), and waited in vain 651–700 px from the one who doubled back, saying it guessed wrong (3/3);
hearing: 4/6 went to look at a runner (goal 89–135 px from them), 0/6 at a crouching person.
