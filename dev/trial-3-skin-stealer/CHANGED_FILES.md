# Trial 3 — Skin-Stealer: changed files

Every file that differs from P9 (`pre-trial3-final-polish`, `1ff9374`), by owner, with the checkpoint and the reason.  Built outputs
(`generated/`, `public/`) are what `src/` builds (`npm run build:check`: PASS, 44 outputs); none was edited by hand.  Every runtime
difference is declared in `dev/tools/gate/declared_changes.json` (the gate's scope step).  `git diff --stat 1ff9374..` on the final
head lists 78 files outside `dev/trial-3-skin-stealer/evidence/` (and 89 evidence files, the last two the T8 push's receipt and its after-push secret scan).

## Server

| File | Checkpoint | What changed |
|---|---|---|
| `src/frameworks/nani/server/ai.skinstealer.js` (new part of `generated/server/ai.js`) | T1–T6 (T8: two comments) | The species: its table (`SK`), act codes (`KACT`), hunger and stamina, senses through the shared framework, plans (roam, watch, retreat, approach, chase, lure, intercept, search, leave, feed, mingle), prediction, the strike (wind-up, leap, contact, miss, recovery, grab), its kills' variants and commitment, feeding, its ears for speech, its lines, its earned skin, its debug block, its snapshot entry. |
| `src/frameworks/nani/server/ai.engine.js` | T1, T2, T3, T6 | `SPECIES.skinstealer`; the two-species branches ask a species hook first (tier, far step, watchdog, nav hunt / clear, summon, snapshot `ss` only while one exists, debug `sk`, log tag K); `sp.farTick`, `sp.still`; T6: `voiceOut`, `hearSpeech`, `skinFrom` (species hooks; none for the Hound or the Smiler). |
| `src/frameworks/nani/server/ai.capture.js` | T4 | Commitment for a species whose capture says `commit`, with its own lengths; `noPlay`; previews A–C for the Skin-Stealer. Hound and Smiler paths unchanged. |
| `src/frameworks/nani/server/ai.intelligence.js` | T1 | Evidence weights and debug scoring ask the species first (`sp.evidence`, `sp.targetScore`). |
| `src/frameworks/nani/server/sim.ai.js` | T1 | Admin-only spawn: `ADMIN_MAX_SKINSTEALERS` 4, placement far from players in the dark; never in `resetWorld` or the director. |
| `src/core/server/sim.step.js` | T1 | The snapshot's `ss` list, only while there is a Skin-Stealer (P9's keys and bytes otherwise). |
| `src/frameworks/overseer/server/admin.js`, `sim.admin.js` | T1 | `skinstealers` add / remove, `near` and `preview` (A-C) accept it; the admin info's `kn` / `mk` and entity code 2 only while one exists. |
| `src/frameworks/gib/shared/dphys.js` (→ `generated/server/dphys.js`, `public/dphys.js`) | T4 | Its three physical deaths (`CFG.SkinStealer` A–C, `PLAN`, `DURS`, the neck snap). The Hound's and the Smiler's 144 deaths are bit for bit P9's (SK34). |
| `src/frameworks/gib/server/death_srv.js` | T4 | The server's replay message, death length and warm-up name it as its own killer. |
| `src/frameworks/gib/server/aftermath.js` | T4, T6 | One line beside the Hound's: its killer is placed where the death left it; T6: the victim's validated look to the engine (`eng.skinFrom`). |
| `src/frameworks/bpp/server/speech.js` | T6 | `ON_HEARD` = server.js's `onHeard` (accepted lines only); `entitySay` (the entity's own `eheard` packet). |
| `server.js` | T6 | Gives speech.js `onHeard` (to the room's engine) and each world's engine its voice (`eng.voiceOut`). |

## Pages

| File | Checkpoint | What changed |
|---|---|---|
| `public/assets/skinstealer.js` (new at T1, changed at T4, T5, T6; from `src/frameworks/nani/client/skin.head.js`, `skin.mirror.js`, `src/frameworks/br-r/client/skin.body.js`, `skin.kill.js`, `skin.compose.js`, `src/frameworks/spacious-audio/client/skin.audio.js`) | T1, T4–T6, T8 | The mirror of the `ss` list; its art (procedural, shaded by BR-RoLE's light sample); its kill's attacker for the victim and every replay; its sounds (deaths, the snap, footfalls, the tell, the leap, feeding, breath); T6: the skin drawn as the page's wanderer avatar with its tells; `window.__skin.where`; T8: with no Skin-Stealer its frame does nothing (no audio touched, the page's `Math.random` never drawn on). |
| `public/index.html` | T1 | Loads `assets/skinstealer.js` after `mp.js` (menu_drift.js knows the tag). |
| `src/frameworks/nani/client/mp.monsters.js` (→ `public/mp.js`) | T1 | Hands the snapshot's `ss` to the script; clears it on a new world or a closed connection. |
| `src/frameworks/overseer/client/mp.admin.js` (→ `public/mp.js`) | T1, T4 | The SKIN tab (shown after K), its count, buttons and three death previews; no new function in P9's scenes. |
| `src/frameworks/gib/client/mp.deaths.js` (→ `public/mp.js`) | T4 | A replay names it as its own killer and takes its attacker from the script. |
| `src/frameworks/bpp/client/mp.session.js` (→ `public/mp.js`) | T6 | Hands `eheard` to chat.js as it hands `heard`. |
| `src/frameworks/bpp/client/net-interp.js` (→ `public/assets/net-interp.js`) | T1 | Also keeps the Skin-Stealers' poses (key `k` + id). |
| `src/frameworks/gib/client/ents.death.js` (→ `public/ents.js`) | T4 | Smiler blackouts are the Smiler's only; a Skin-Stealer's death draws the script's attacker. |
| `src/frameworks/spacious-audio/client/ents.audio.js` (→ `public/ents.js`), `sfx.js` (→ `public/sfx.js`) | T4 | Its death's sounds and the snap go to the script. |
| `src/frameworks/overseer/client/ents.debug.js` (→ `public/ents.js`) | T5, T6 | Its own colour and debug block (never a word of speech). |
| `src/frameworks/gib/client/gore.js` (→ `public/gore.js`) | T4 | Its wounds (finger bruises at the neck, a bite). |
| `src/frameworks/br-role/client/br-role.js` (→ `public/assets/br-role.js`) | T5 | Its views are BR-RoLE actors of their own kind `skin`. |
| `src/frameworks/front/client/chat.js` (→ `public/assets/chat.js`) | T6 | An entity's line: a bubble where it is drawn, its own mute entry, the origin's mute, "A voice nearby says"; `heard`'s bubble lines moved unchanged into `bubble()`. |
| `src/frameworks/front/client/voice.js` (→ `public/assets/voice.js`) | T6 | The entity voice (`mimic`), never a preset a person can choose or send. |
| `src/build-recipes.json` | T1, T4 | The new parts and output. |
| `generated/BUILD_MANIFEST.json` | T1–T6, T8 | The build's record of every output (rewritten by each build). |

## Checks, docs and tools

| File | Checkpoint | What changed |
|---|---|---|
| `dev/tests/s_skinstealer.js` (new) | T1–T4, T6 | 34 seeded scenarios, SK01–SK44, in `npm test`. |
| `dev/tests/run.js` | T1 | Runs the new suite with the others. |
| `dev/tools/checks/chat_server.js` | T6 | A unit layer for the entity hook and entity speech (12 cases); its mutant list (the gate counts 14) unchanged. |
| `dev/tools/checks/facts.json` | T1, T4 | The act codes, the states and the admin ceiling as facts; the Skin-Stealer's kill lengths; the Hound's fallback length's new name. |
| `dev/tools/checks/menu_drift.js` | T1 | Knows the new script tag. |
| `dev/tools/gate/declared_changes.json` | T1, T4, T5, T6, T8 | Every runtime change declared. |
| `dev/tools/gate/golden/cli_golden_c3c.js` | T1 | `bodySkin` listed as run by the browser check, not a B++ scene. |
| `src/core/client/bundle/api_contract.json`, `API_CONTRACT.md`, `docs/architecture/CONTRACTS.md`, `BUILD_PIPELINE.md`, `FRAMEWORKS.md`, `src/frameworks/*/README.md` | T1–T6 | Regenerated / extended for the new script and parts. |
| `docs/architecture/CHAT.md` | T6 | The entity contract as connected. |
| `dev/trial-3-skin-stealer/` | T0–T8 | This trial's plan, matrix, decisions, balance table, deferred list, checkpoints, Human QA, report, tools (`skin_browser.js`, `speech_mutants.js`, `equiv_p9.js`, `perf_t3.js`, `verify_remote_t3.py`) and evidence. |

Not changed: the compiled client (TypeScript bundle), the Hound's and the Smiler's code paths, the Red Rooms, the heartbeat / danger
filter, LogicZ, H.A.N.D.S., P.O.C.K.E.T., player health, admin authentication, the lounge, CI, dependencies, any deploy setting.
