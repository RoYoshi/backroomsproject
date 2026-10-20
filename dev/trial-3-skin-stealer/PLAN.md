# Trial 3 — Skin-Stealer: plan

- **Repository:** `RoYoshi/backroomsproject`
- **Branch:** `trial-3-skin-stealer` (new; created from P9; never force-pushed)
- **Parent:** P9 `pre-trial3-final-polish` = `1ff9374babc034eafed4c7c26dc941f46fc55908`, tree `d6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef`
- **Authority:** the owner accepted the final polish stage and authorized Trial 3. This does not authorize a merge, a deployment, a
  live organic monster population, or any Red Rooms / heartbeat work.

## What the trial delivers

A third server species, the Skin-Stealer: a patient, deceptive predator with continuous hunger and finite stamina, which often
chooses not to engage, baits and predicts and can be wrong, wears a disguise it has earned at a kill, repeats speech it has really
heard, and kills only on a physical grapple, through the existing N.A.N.I., G.I.B., B++, BR-RoLE and F.R.O.N.T. architecture.
Admin-only spawn. See `DESIGN_DECISIONS.md` and `CAPABILITY_MATRIX.md`.

## Checkpoints

Each is one commit (or a few) pushed to `trial-3-skin-stealer` only, verified on GitHub (`tools/verify_remote_t3.py`: SHA, tree,
parent chain from P9, protected branches, no other branch moved), secret-scanned before and after, and recorded in `CHECKPOINTS.md`.

| | Content | Verified by |
|---|---|---|
| **T0** | Reconnaissance; `PLAN`, `CAPABILITY_MATRIX`, `DESIGN_DECISIONS`, preliminary `BALANCE_TABLE`, `DEFERRED`; baseline test results; remote inventory; the verify tool. No game code. | baseline runs recorded with their results |
| **T1** | Species identity: `ai.skinstealer.js` registered (recipe, `@part`, `SPECIES`, `KACT`), the two-species branches extended, `ss` snapshot list (only when present), admin-only spawn / remove / near / cap, client mirror and slots (`mp.monsters.js`, `net-interp.js`, `ents.head.js` table, a placeholder-free minimal true-form view), `facts.json` entry. No organic spawn. | unit tests for registry, spawn rules, snapshot bounds, epoch; P9 snapshot bytes unchanged without one; `npm test`; build / parts / modules / facts / docs; fast gate |
| **T2** | Navigation, collision, perception, hunger, stamina, roam, watch, retreat, leave, non-engagement, budgets. | scenario tests: non-engagement rate, real departure, stamina never reset by state, hunger bands, no hidden-truth reads |
| **T3** | Bait / lie in wait, prediction and interception, wrong guesses, disengagement as evidence decays. | prediction fairness test (identical goal, different outcomes), straight race vs corner, bait success and failure |
| **T4** | Pounce (wind-up, committed leap, wall stop, miss, recovery, cost), quick capture, kill record, commitment, `dphys` A–C, `death_srv` / `aftermath` / clients for the new killer, corpse parity. | collision-gated pounce, finite stamina, kill identity in session / snapshot / victim / spectator / fallback, one corpse on disconnect, Hound / Smiler deaths unchanged, server-vs-screen parity |
| **T5** | Presentation: true-form art and motion, death attacker poses, BR-RoLE actor, procedural audio, debug overlay, admin panel row. | headless browser captures at 1280×720, 1920×1080, a phone, low / medium / high; no shadow through walls |
| **T6** | Earned disguise and its tells; speech observation hook and entity-origin speech with mute, rate and locality rules; item / corpse / crawlspace gates reported. | disguise lifecycle (epoch, respawn, reset), spoof blocked, locality (room, 576 px, lounge excluded), mute by origin, `chat_server` |
| **T7** | Integrated multiplayer and regression: `npm test`, human-QA suite, Hound / Smiler equivalence, performance (P9 vs Trial 3, 0 / 1 / 4 Skin-Stealers, 8 bots), fast gate, selected browser checks. | recorded results |
| **T8** | Final reports (`TRIAL_3_REPORT`, `CHANGED_FILES`, `CHECKPOINTS`, `HUMAN_QA`, `DEFERRED`, final `BALANCE_TABLE`), remote verification, STOP for owner QA. | the verify tool on the final push |

If at any checkpoint a feature in the minimum acceptance cannot be made real under the current contracts (a correct death for
victim, spectators and the server fallback; an earned disguise; entity speech that is not a spoofed player), the trial stops with
**BLOCKED — OWNER DECISION NEEDED** and the smallest exact blocker, instead of shipping a substitute.

## Never in this trial

No change to `main`, C5, P9 or any earlier branch; no merge; no deployment, Bloom.Host, Cloudflare, DNS, secrets or CI trigger
change; no organic Skin-Stealer spawn; no Hound / Smiler redesign; no Red Rooms or heartbeat / danger-filter change; no LogicZ,
H.A.N.D.S. rewrite, health or inventory system; no edits to built output without its source; no force push; no dependency upgrades.

## Rollback

Every checkpoint is a fast-forward commit on `trial-3-skin-stealer` only. Rolling back the trial is deleting or ignoring that branch;
P9 (`pre-trial3-final-polish`) is untouched.
