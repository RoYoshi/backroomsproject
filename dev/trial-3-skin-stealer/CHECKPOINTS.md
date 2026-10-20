# Trial 3 — Skin-Stealer: checkpoints

Branch `trial-3-skin-stealer`, from P9 `1ff9374babc034eafed4c7c26dc941f46fc55908` (tree `d6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef`).
Each row is filled after its push has been verified on GitHub (`tools/verify_remote_t3.py`); the verification record is in
`evidence/remote/`.

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| T0 recon, plan, matrix, decisions, baseline | `98d28196d25a1cea6167323548571a99e399a44e` | `40b2191329b2c504c8801462ed30c08bd0cef755` | `1ff9374` | yes: `evidence/remote/t0.json` (ls-remote and the GitHub API agree; every protected branch at its frozen SHA; no other branch moved) |
| T1 third species, admin-only spawn, bounded snapshot, first view | `23bba42815fa6777a53cccfeb9de46d8766d34de` | `d1172702a720606fecbb4616755969f92f02fd5f` | `98d2819` | yes: `evidence/remote/t1.json`; secret scan of the pushed commit CLEAN |
| T2 the animal: hunger, stamina, senses, non-engagement, budgets | `8b2d734e7cf178f1a90b3036bc0180ed78a6a512` | `7e6923490c36fbed36139be93b0613782815f5a4` | `23bba42` | yes: `evidence/remote/t2.json`; secret scan of the pushed commit CLEAN |
| T3 lying in wait, prediction, interception, the race, hearing | `a3f43b3ddf5d8d0400b0441b798933c222f0da34` | `248c892f417d8900f1342c7acaf6f5c1b23c5021` | `8b2d734` | yes: `evidence/remote/t3.json`; secret scan of the pushed commit CLEAN |
| T4 the strike and the kill, through G.I.B. | `9a2e56e67395d346a65ef9f5b1f43c41ac8682cf` | `a085153d24ebdf14415ca9370a83c5861f73c53b` | `a3f43b3` | yes: `evidence/remote/t4.json`; secret scan of the pushed commit CLEAN |
| T5 presentation: BR-RoLE actor, living sounds, debug block, art pass | `c16bc06f49a99f6f7375072b80fcbf81ccee1487` | `ae6b74bc6480282440663e32100b7adac60ac507` | `9a2e56e` | yes: `evidence/remote/t5.json`; secret scan of the pushed commit CLEAN |
| T6 deception: hearing speech, entity speech, the earned skin | `489cf12b5dc1ce284f6c0ac5e62b767420c36c61` | `38843f9e54a4fb1968916d0874c3bb7c94093f7d` | `c16bc06` | yes: `evidence/remote/t6.json`; secret scan of the pushed commit CLEAN |
| T7 integration, P9 equivalence, performance | `026c239ee301538da15f999b96fca6407b64dc6e` | `5ee38daa2419175edebb051617e0ae843ceaec9c` | `489cf12` | yes: `evidence/remote/t7.json`; secret scan of the pushed commit CLEAN |
| T8 reports, targeted full-tier steps, owner QA handoff | (this commit: read back into `evidence/remote/t8.json`, which one last receipt commit adds; that commit's own read-back is in the handoff) | | `026c239` | |

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
| Fast / full gate | not run at T0 (no code changed; P9's accepted record stands); planned for T1 and T7 - as it turned out, it ran at T1, T4, T5 and T6 (T7 changed no runtime file) |

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

## T4 — the strike and the kill (results on the T4 tree)

What T4 adds: the **strike** (a 0.22 s crouched wind-up, a committed 430 px/s leap it cannot steer, lethal only on contact with nothing
solid between; a miss leaves it recovering and unable to spring again for 2-3 s; every leap costs 22 stamina), the **grab** (anybody in
arm's reach of a hungry one), **shadowing** a walker at their pace, the **kill** through N.A.N.I.'s capture (always quick, committed for
its own death lengths) and G.I.B. end to end - its three physical deaths in `dphys.js` with the neck **snap**, the server's replay
message, length and fallback corpse, the aftermath's killer placement, the victim's and the spectators' attacker drawn by
`skinstealer.js`, its wounds, its death sounds (procedural) - then **feeding** beside the body while undisturbed.  The SKIN tab gains
its three death previews.  Design: `DESIGN_DECISIONS.md` D6, D7 (as built); numbers: `BALANCE_TABLE.md` "As built after T4".

Found and fixed while building T4 (each found by a scenario):
- a far Skin-Stealer's feeding was ended by the level-of-detail hook (it now feeds on, alone);
- a stalker at 90 px/s could never reach an unaware walker (shadowing at their pace; a brisk walk no longer counts as running);
- pounces at a target walking away fell 12 px short: the reach now counts how far they move during the wind-up and the leap, and it
  aims at the moment of contact;
- a leap was charged its 22 stamina and the running drain on top (now only the 22);
- the death-variant weights did not tip C for a winded or cornered victim as designed;
- the encounter tests written before it could kill (SK16, SK23, SK25) now expect what T4 adds (a kill ends an encounter too), and the
  test world, which pauses with nobody alive, gets a bystander;
- the SK23 evidence-law comparison stops where the engine's level of detail differs: N.A.N.I. sets every species' tier from the nearest
  player's true distance (P9 engine behaviour; it changes how often a creature thinks, not what it knows) - recorded in `DEFERRED.md`.

| Run | Result |
|---|---|
| `npm test` | 178 / 191: SK01–SK35 all pass (29 Skin-Stealer cases); the 13 failures are exactly P9's (`evidence/t4/npm_test_t4.txt`; the T4 cases with their numbers: `evidence/t4/sk_t4_results.txt`) |
| fast modernization gate (21 steps) | PASS 21 / 21 (`evidence/t4/gate_fast_t4.txt`): B++'s server, session, sim, page (ents.js), client (mp.js), bundle and chat traces unchanged; the mutants still find their strings |
| `tools/skin_browser.js` (t1 + t4; real server, headless Chromium, two pages in one room) | 20 / 20 (`evidence/t4/browser_t4.json`; the spectator's replay mid-death: `evidence/t4/t4_replay_B_crop.png`) |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 (`evidence/t4/humanqa_t4.txt`) |
| `dev/tools/checks/chat_server.js` | 88 / 88 (`evidence/t4/chat_server_t4.txt`) |

T4's numbers (seeded; `sk_t4_results.txt`, `browser_t4.json`): a strike on someone unaware 160 px off - wind-up 0.22 s, leap 111 px,
stamina -22, a kill (B or A) at 0.63-0.72 s, the victim's record naming it (SK30, 6/6); a dodger who breaks sideways at the wind-up
makes it miss, it recovers 0.92-1.26 s and waits 2.1-2.6 s before another leap, and they get away (SK31, 6/6); nobody behind a wall
in reach of its leap is ever taken, and every kill elsewhere was body to body with a clear line (SK32); its 144 deaths in the death
physics come to rest without jumps or wall clipping, the neck snapping once in A and B, and the Hound's and the Smiler's 144 deaths
are bit for bit P9's (SK34); the replay message, the length, the server's corpse (cause SkinStealer) and the killer's placement
(SK35); in the browser the victim's last death frame and the server's corpse agree to within a pixel, and a victim who disconnects
mid-death still gets exactly one corpse.

What the screenshots show: the replay on the spectator's screen has the Skin-Stealer crouched over the victim, the blood and the
dropped light (`t4_replay_B_crop.png`).  The victim's own screen during its death is the bundle's darkened death view (the light
has been dropped); the tool confirms this script's attacker is drawn there at the death's attacker position, but a picture of it
is left for T5's presentation pass, beside a Hound death on the victim's screen for comparison.

## T5 — presentation (results on the T5 tree)

What T5 adds, all on the page (no server change): the Skin-Stealer is a **BR-RoLE actor** (its own silhouette kind `skin`, for the
living view and for its kill's attacker, so it casts and is shaded like the Hound); its **living sounds**, procedural and placed like
every entity sound (distance, pan, a wall's low-pass): long padded footfalls by stride, quieter and heard less far while it stalks
(creep, approach), the wind-up's dry clicks and sharp breath (the tell before a leap), the leap, the skid of a miss, its eating, and
a breath while it holds still - only within 260 px and at most every 25-45 s, never a proximity cue; the admin **DEBUG overlay's own
block** (hunger and its band, stamina, its plan and why, its time with the person it is stalking and whom it has left alone, its
route guess, its record); an interim **art pass** (sallow, bloodless skin instead of grey; heavier limbs).

The victim's own screen during a Skin-Stealer death, measured against a Hound death at the same lamp-lit spot (browser t5d: the share
of the screen the darkness overlay covers, sampled in the page on the first frame at or after 0.5, 1 and 2 s - on a slow software page
the frames do not fall at exactly those moments; the `el` of each sample is in the report): `evidence/t5/browser_t5.json` 0.668 /
0.647 / 0.643 against the Hound's 0.666 / 0.666 / 0.632; the T6 run, `evidence/t6/browser_t6.json`, 0.647 / 0.639 / 0.631 against
0.665 / 0.653 / 0.667.  No black fade in either.  (The `shade` the tool also records always reads 0: the page's death API does not
expose it, so it says nothing; every death ends in the same death-sequence shade from 3.12 s in the bundle's code.)  The dark
own-death view T4 noted is the P9 death view, as dark for the Hound.

| Run | Result |
|---|---|
| `npm test` | 178 / 191: every Skin-Stealer case passes; the 13 failures are exactly P9's (`evidence/t5/npm_test_t5.txt`; no server change at T5) |
| fast modernization gate (21 steps) | PASS 21 / 21 (`evidence/t5/gate_fast_t5.txt`): the page step's `ents.js` traces (the debug block is a branch only `d.sk` reaches), B++'s client scenes, the bundle, the `__api` contract (regenerated: `skinstealer.js` reads `H` and `Uc` for its sounds) |
| `tools/skin_browser.js` (t1, t4, t5, t5d) | 27 / 27 (`evidence/t5/browser_t5.json`; the gallery: `evidence/t5/t5_gallery_{low,medium,high}_1280.jpg`, `t5_gallery_medium_1920.jpg`, `t5_gallery_phone_844x390.jpg` and a close crop `t5_gallery_high_crop.jpg`) |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 (`evidence/t5/humanqa_t5.txt`) |

The gallery (`evidence/t5/`): every act it shows (still, watching, creeping, chasing, the wind-up, the leap, recovering, feeding)
and its three deaths mid-way (A at the snap, B at the landing's snap, C at the bite), round a lamp-lit spot, at BR-RoLE's low,
medium and high tiers, at 1280x720, 1920x1080 and a phone held sideways (844x390).  The page's mirror holds at most 8 Skin-Stealers
(the admin ceiling is 4), so the gallery shows 8 acts; lure and listen share the watching pose.

## T6 — deception (results on the T6 tree)

What T6 adds (`DESIGN_DECISIONS.md` D8, D9 as built; numbers: `BALANCE_TABLE.md` "As built after T6"):
- **Its ears for speech.** B++'s speech hook, written before as an inert contract, is connected: server.js gives `speech.js` an
  `onHeard`, called once for a line accepted and delivered (never a refused line, never the lounge), and hands it to that room's AI
  engine (`eng.hearSpeech`). Only a Skin-Stealer within the players' own 576 px keeps it - four lines at most, 90 s at most, none of a
  person who has left; the admin overlay shows only how many and how old. A voice is also a sound, through the engine's own hearing.
- **Its lines.** From hiding when it lies in wait, hungry and unseen; when it stares in a borrowed skin. The opening words of a line
  it heard (lower case, sometimes the last word again), preferring the skin's owner's words, then anybody else's, then the person's
  own; with nothing heard, one of seven generic calls that claim no knowledge. Sent by B++'s new `speech.entitySay` as its own packet
  `{t:'eheard', e, text, seq, v, o}` - never a person's `heard`, never a session id as its speaker - to the living players of the same room within 576 px,
  cleaned again, one line every 6 s per entity at most. The page draws it where the creature is drawn, in the entity voice nobody
  can choose, with its own mute entry ("An unknown voice"); a person's mute also silences the echo of their words.
- **Its skin.** Only at a kill it made (G.I.B.'s aftermath hands the engine the victim's validated look when the death ends) and only
  after 8 s at its meal (a meal now lasts at least that long; disturbed sooner, no skin). Worn 240-420 s, it is the page's ordinary
  wanderer avatar with its tells: nothing in its hands, no light, no name, in no list of players, arms stiff, a slow walk, long stares.
  In it the creature walks up openly, stares, may speak, and either walks on or - hungry - closes in and springs from 120 px, the
  wind-up dropping the skin; a very hungry one drops it to run after somebody who flees. Its time, its removal and a world reset end it.
- **Gated, not faked** (`CAPABILITY_MATRIX.md` §6, `DEFERRED.md`): the victim's flashlight, a carried light, moving or hiding the
  corpse, passing a crawlspace in a skin, an unearned generic disguise. Nothing of these is simulated.

Found and fixed while building T6: a meal that ended as soon as the creature was no longer hungry could be shorter than the skin
needs (and end before the server's death had even finished on a sped-up world) - a meal now lasts at least `skinFeed`.

| Run | Result |
|---|---|
| `npm test` | 183 / 196: SK01-SK44 all pass (34 Skin-Stealer cases; T6: SK40-SK44); the 13 failures are exactly P9's (`evidence/t6/npm_test_t6.txt`) |
| fast modernization gate (21 steps) | PASS 21 / 21 (`evidence/t6/gate_fast_t6.txt`): server.js, the session, mp.js, ents.js, ai.js changed - B++'s server, session, sim, page and client traces unchanged; the chat step 100 / 100 cases (unit_entity among them), its 14 mutants caught |
| `dev/tools/checks/chat_server.js` | 100 / 100 (`evidence/t6/chat_server_t6.txt`) |
| `tools/speech_mutants.js` | the unit_entity layer 12 / 12; 10 of 10 mutants caught (`evidence/t6/speech_mutants_t6.json`) |
| `dev/tools/checks/chat_browser.js` | 40 / 40 (`chat.js` changed: P9's chats in real pages unchanged; `evidence/t6/chat_browser_t6.txt`) |
| `dev/tools/checks/chat_voice_browser.js` | 69 / 69 (`voice.js` changed: the icon, the key, typed-out bubbles and the seven voices unchanged) |
| `tools/skin_browser.js` (t1, t4, t5, t5d, t6) | one run 32 / 33, its one failure t1's list of the script's hooks (it now has `where`, which the check had not yet been told about), t1 rerun with it 10 / 10 (`evidence/t6/browser_t6.json`, `browser_t6_t1_rerun.json`; the skin speaking on the listener's screen: `t6_disguise_speaks_crop.jpg`) |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 (`evidence/t6/humanqa_t6.txt`) |

In the browser (t6, the real server and AI): the victim's look reached every page as the skin (`dg`) after its meal at x2 world
speed; a line said 420 px from it, behind a wall, was kept (the admin overlay: one line, 0 s old, no word of it); stepping into its
sight, the listener saw a wanderer with no light and its arms at its sides walk up to about 160 px, stop, stare, and say "the exit is this
way... way" - the speaker's words, as an entity, with the entity voice; the players' list held only the two people.  In the
scenarios (SK43): hungry, it walked up at no more than 150 px/s, stared from 167 px, spoke once, then sprang from 107 px and killed,
the skin dropping at the wind-up; not hungry, it stared and walked on, still in the skin.  The two runs with the Skin-Stealer's lines
in the bait (SK41): with a line heard from someone else, it said its opening words ("is anybody over there? i lost", once with the
echo "... lost"); with nothing heard, a generic call; never while seen.

Note: after the gate, the browser and the chat checks, two header comments were corrected (voice.js's `meta(v, id)`, skinstealer.js's
list of its hooks); comments only - the build check, parts, contract and docs checks and the t1 rerun ran after it.

## T7 — integration, equivalence with P9, performance (results; no game change since T6)

T7 changes no runtime file: T6's `npm test` (183 / 196, P9's 13), fast gate (21 / 21), chat checks (server 100 / 100, browser 40 / 40,
voices 69 / 69) and human-QA suite (5 / 6, X03 as P9) are the evidence for the code as it stands, and were not repeated.  What T7
adds are three development tools and their runs.

| Run | Result |
|---|---|
| `tools/equiv_p9.js` (P9 checked out beside this tree; 6 seeds x 120 s; the director on, the world's own Hounds and Smilers, 4 scripted players, respawns; on this tree a line of speech handed to the new hearing hook every 2 s) | PASS: 6 / 6 seeds identical to P9 at every snapshot (every 6th tick, the server's rate), 7200 comparisons (every Hound and Smiler, every player, 37 kills, the bodies); the hook kept nothing (no Skin-Stealer). Self-test: one Hound moved 1 px - 3 / 3 seeds told apart (`evidence/t7/equiv_p9.*`, `equiv_selftest.txt`) |
| `tools/perf_t3.js` (P9, Trial 3 with 0, 1 and 4 Skin-Stealers; 8 scripted players; the director and the world's monsters; 5 interleaved rounds x 60 s; each run in its own process) | PASS (`evidence/t7/perf_t3.*`): the 60 Hz step, median of the means - P9 0.136 ms, Trial 3 without one 0.1355 ms (-0.4 %, within the 0.011 ms tolerance); with one 0.174 ms (+28.6 %); with four 0.243 ms (+79 %), p99 2.96 ms - 1.5 % and 18 % of a 16.7 ms step; snapshot entities +74 B per Skin-Stealer (711 -> 785 -> 992 B); its invariants (a finite place, never inside the level, at most 4 lines, no unearned skin, hunger and stamina in range) never broken |
| `tools/perf_t3.js --soak 600` (4 Skin-Stealers, 8 players, 10 minutes) | PASS: mean 0.100 ms, p99 0.554 ms, worst 14.7 ms; 137 kills (Hounds, Smilers, Skin-Stealers); invariants never broken (`evidence/t7/soak_t3.*`) |
| `tools/skin_browser.js` t7 (one room: the skin AND the world's Hound and Smiler; a desktop page and a phone held sideways with touch, different settings; a page in another room) | 7 / 7 (`evidence/t7/browser_t7.json`; the phone: `t7_phone_844x390.jpg`): its line reached both pages of its room, each as set (the desktop typed out with its voice; the phone written at once, voices off, no voice), the other room nothing (no line, no ss list, no view); the phone disconnected mid-encounter and the room went on; the admin's world reset left no creature, skin, bubble or ss list and the SKIN tab counted 0; no page error |

The performance rule, honestly: the tool's first version also required every run's single worst step to stay under 16.7 ms.  Its
first pilot (`evidence/t7/perf_pilot1.txt`) failed that rule on a Trial 3 run with four (17.8 ms) while P9's own worst was 16.5 ms -
and a Trial 3 run without any Skin-Stealer, whose world is P9's at every snapshot, reached 29 ms.  On this 2-CPU container the single
worst step is garbage collection and scheduling, so the rule now judges the mean and the p99 against the step's budget and reports
the worst steps (P9's reached 22 ms in the final run).  The second pilot and the first soak (`perf_pilot2.txt`, `soak_pilot.txt`)
ran under the old rule by mistake (the rule change had not been saved); the final runs above are under the rule as written in the
tool.

What the soak's record shows about balance: four Skin-Stealers among eight scripted players for ten minutes made 3 kills (all grabs or
a pounce on a scripted player who walked into reach) and 20 searches, no lure, chase or mingle - the scripted players wander and never
react to it, the Hounds take most of them (137 kills), and the harness has no G.I.B. aftermath, so no skin is ever earned there.  It
says nothing about how it plays against people; that is the owner's QA.

Not tested by T7 (left for the owner's QA): real speakers, a real phone, a real network with lag, more than four people in a room.

## T8 — reports, targeted full-tier steps, the owner's QA handoff

T8 publishes the reports (`TRIAL_3_REPORT.md`, `CHANGED_FILES.md`, `HUMAN_QA.md`, and the final state of this file, the matrix,
the decisions, the balance table and the deferred list), the secret-scan records of every checkpoint (`evidence/scans/`), and the
targeted runs below.  An independent review of the documents against the evidence, the history and the code (a separate agent that
had not written them) found wording that overstated or did not match; every item was corrected (for example: the entity packet
names the person it echoes, so it is "never a session id *as its speaker*"; the call from hiding needs a very hungry creature, 0.6,
not 0.4; the equivalence compares every snapshot, every 6th tick; the T5 death-view numbers now quote the kept evidence).

**One runtime change at T8, found while looking for the cause of the contact_lab difference below (it was not the cause):** since T5 the script's per-frame
sound hook created its noise buffer (44 100 `Math.random()` draws) on the first frame with the sound on, even in a world with no
Skin-Stealer, so the page's shared random stream was not P9's.  Now, with no Skin-Stealer in the snapshot, its frame does nothing at
all, and its noise is its own fixed sequence (it never draws on `Math.random`).  Two comments in `ai.skinstealer.js` were also made
exact (its call from hiding: very hungry).

| Run | Result |
|---|---|
| full-tier gate steps for what Trial 3 changed: cli_mutants, live_wire, bpp_checks, browsers, workflow, menu, suites, perf | PASS 8 / 8 (`evidence/t8/gate_full_targeted.txt`): `mp.js`'s module seams 35 / 35 mutants caught; the live wire structurally identical to B++; B++'s proto / placement checks; two browsers, the collision heads and the gameplay smoke; the dev workflow 22 / 22 and the browser contracts; the main menu against C5d 11 / 11 with 8 / 8 mutants; every retained suite with only its known failures; the server's cost against B++ within its rule (lifecycle +2.1 %, deaths -1.9 %, admin -0.2 %, schedule +9.9 %) |
| full-tier contact_lab (BR-RoLE's contact images against B++) | FAIL on this tree **and on P9 itself** (`evidence/t8/contact_lab.txt`): one image, `peers_visible.png`, differs from B++'s by one level in 193 channel values in one small region.  It is not Trial 3: **B++'s own capture of that image changes between two runs of the same code**, and this tree's 23 images were pixel-identical to P9's in the first run.  The scene is not deterministic in this container; the comparison cannot pass or fail Trial 3 here |
| not run | rgb (no RGB code changed); chat_browser and chat_voice with their mutants (their checks pass unchanged without them at T6; the mutants test P9's chat code) |
| `tools/skin_browser.js`, every section, on the final tree (after the T8 change) | first run 39 / 40 (`evidence/t8/browser_t8_all.json`): t1, t4, t5, t5d, t6 pass; t7's line failed - no line in 30 s.  The harness had put the desktop player 380 px from the creature at the first open angle from it, not where it looks, and did not record why it never came; T7's own 7 / 7 used the same placement.  The harness then put the player where it looks first, traced the creature once a second, and counted the snapshot's Hounds and Smilers (it had only checked their lists' keys, which every snapshot has - the review's point): t6 + t7 13 / 13.  **Repeating t7 then failed twice** (`evidence/t8/t7_repeats.txt`): the desktop had the line but the phone was checked once, the instant the desktop showed it - the phone now waits up to 5 s and each page counts the entity packets it receives.  Of the next three, one failed again: the creature, frozen while the player was placed and then let go, roamed away and never saw them; the placement could still fall up to half a turn off its facing when the cells in front were not open.  The player is now put within 1.18 rad of where it looks (its field of view is 2.5 rad).  With that: t7 4 / 4 in a row, then **every section 40 / 40** (`evidence/t8/browser_t8_final.json`).  In every run that counted them and in which the creature came, each page received exactly one entity packet and showed the line as it was set |
| `dev/tests/s_skinstealer.js` after the T8 change | 34 / 34 (`evidence/t8/sk_t8.txt`) |
