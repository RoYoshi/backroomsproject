# Stage 2F verification

Commands are package-relative; no dependency on the author's workspace.

```sh
npm test
npm run test:shared
npm run test:hound
node dev/tests/perf_shared2f.js
PERF_MODE=habits node dev/tests/perf_shared2f.js
node dev/tests/audit_net.js
node dev/tests/audit_net2.js
node dev/tests/ir_net.js
node dev/tests/live.js
bash dev/build_ai.sh
bash dev/build_sim.sh
bash dev/build_ents.sh
```

F22 normally checks the bundled baseline-derived preservation manifest. For an independent comparison, set `STAGE2E_BASELINE` to the pristine extracted supplied Stage 2E package. Optional pairwise tools explicitly require that directory:

```sh
node dev/tests/parity_shared2f.js /path/to/stage2E
node dev/tests/movement_parity2f.js /path/to/stage2E
python dev/tests/diagnose_rng2f.py /path/to/stage2E /new/temporary/experiment
```

The RNG diagnostic builds a disposable counterfactual (2E plus RNG routing only), never a product compatibility mode. It preserves failing thresholds. The older `smiler_parity.js` compares identical historical random streams for 2D/2E and is not the appropriate 2F parity criterion. `parity_shared2f.js` fixes traits/draws and observations across the two implementations.

The F10 acquisition and F11 learned-history branch tests hold the species motor during training, while using actual movement, LOS, vision, sound and habit recording; restore the production species before comparing hidden-branch decisions. Performance `habits` similarly holds motors to sustain full memory tables. These are explicit fixture controls, not production switches. All other workload motors run normally.

Known limits: headless movement uses deterministic bot inputs at 60 Hz, not human input/frame/network jitter; standalone network tests cover the wire. Physical placement/collision/contact, lifecycle and LOD are permitted system knowledge. No benchmark capture percentage proves human fairness. See the release report for all retained failures.

---

# Development tests — Stage 2E

Nothing here is needed to play or host the game; `server.js` never serves this folder. It exists so the behaviour can be re-checked after any change.

## What it is

`harness.js` runs the **real** `sim.js` + `ai.js` (the same code the server runs) headless at 60 Hz with scripted players, so a scenario is a few lines: put a player and an entity somewhere, run the clock, look at what the simulation did. Entities are never scripted; the scenarios only set the stage and measure what emerges. Everything is seeded and deterministic (scenario Y08 checks that).

Since v22.1 the scripted players move with the game's own **`move.js`** (`move_model.js` runs one copy per player): acceleration, exhausted acceleration, stamina, recovery at 36, deep carpet, crouch / crawl, vaults, slides, the 15 px body and the level's collision are the browser's. What is still not a real client is listed at the top of `move_model.js`: the bot steers straight at its next waypoint and lets go of the keys as it arrives, sets crouch as a state instead of pressing C, faces where it moves, and runs at a fixed 1/60 s with no network (live_chase.js covers the network path). Benchmarks from it are measurements of bots, not of how fair a chase feels to a person.

All paths are package-relative (`paths.js`: `../g` in the working tree, `..` in the shipped package), so the commands below work from the extracted zip as they are, from any directory.

## Stage 2E result and limits

Read `../STAGE_2E_REPORT.md` for actual results and `STAGE_2E_HUMAN_QA.md` for manual setups. Three legacy chase percentage gates (C4, C5, C9/C10) remain unmet; their assertions were **not** lowered. `npm test` / the full suite therefore report failures, not an all-green release gate. New Hound correctness checks and preserved-system results are reported separately. Browser visual/movement checks remain unrun in the implementation environment.

Stage 2E tests keep the real AI and move.js. H6/H8/H10 fix near LOD to isolate evidence decisions; placements establish observation boundaries, not playable teleport abilities. H7 injects a valid running event through the real sound bus; H9 obtains sound from real move.js footsteps. H12 deliberately replaces the motor only to exercise the real watchdog. H13 checks a 12 px solid-core margin, like the Smiler long-run test; stricter clearance is also exercised by the navigation/chase suites. Existing sensor-only tests E2/E4 and scheduler test Y01 hold the motor idle to avoid active light investigation contaminating their measured condition. E6 compares the observation replay only until the first new human sighting. Chase fixtures restore their advertised starting distance after sensor warm-up; loss tests sample more geometry seeds without lowering assertions.

The network tests use Node's built-in WebSocket (Node 22+). `audit_net2.js` can take more than three minutes because of real movement playback and death-fallback waits; a 180-second external timeout is too short. Do not translate that timeout into a product failure.

## Run

```
node dev/tests/run.js                                                   # complete active suite, including evidence, IR and Stage 2E
node dev/tests/run.js s_hound2e.js                                       # 17 new deterministic Hound checks
node dev/tests/perf_hound2e.js                                           # 5 workloads, 3 seeds; per-step average/p99
node dev/tests/smiler_parity.js /path/to/extracted/stage2D                 # optional: 14,400 isolated Smiler ticks versus baseline
node dev/tests/audit_net.js                                              # audit fixes on the wire (real server + sockets): malformed URLs, respawn rules, movement validation, spawn choice, death aftermath on disconnect
node dev/tests/audit_net2.js                                             # v22.2 follow-up on the wire: capture escape sequences, sub-pixel walls, silent running without a report, real move.js traces, the death-disconnect race
python3 dev/tests/lifecycle_mp.py                                        # browser: NEW RUN (vanish -> run menu -> play again) and RETRY after a death still work for an ordinary player
node dev/tests/phys_test.js                                              # the physical death simulation (dphys.js)
python3 dev/tests/play_mp.py                                             # browser: an ordinary player moving around online is never corrected by the movement check
python3 dev/tests/fallback_parity.py                                     # browser: the server's fallback corpse == the corpse the victim's own browser made
node dev/tests/escape_bench.js all 16                                    # escape rates by player strategy (MID=1 / FAR=1 / DARK=1 for the dark, farther starts)
node dev/tests/live_chase.js break-walk 6                                # the same chase through the real server + WebSocket at the client's send rate
python3 dev/tests/chase_mp.py                                           # browser: the SEARCH + MEMORY and CRAWLSPACES debug layers, no errors
node dev/tests/nav_bench.js                                             # navigation numbers (routes, 792 doorway passes, chases, loops)
node dev/tests/interp_test.js                                           # client snapshot interpolation vs the old chase
ONLY=H09 node dev/tests/run.js s_hound.js                                             # one scenario (regex on the name)
DATA=1 node dev/tests/run.js s_smiler.js                                              # extra data for failures
node dev/tests/live.js                                                                # real server.js + two WebSocket clients (needs Node 22+: built-in WebSocket)
python3 dev/tests/move_test.py                                                        # Part I movement checks in a headless browser (pip install playwright; playwright install chromium)
python3 dev/tests/audio_test.py                                                       # renders every entity / capture sound offline and measures it (same requirements)
node dev/tests/play_server.js 8000 play                                               # the real server, but entities always "play" with a caught victim (or `quick`): for watching the held / down / crawl / release visuals
```

`run.js`, `live.js`, `audit_net.js`, `audit_net2.js`, `lifecycle_mp.py`, `interp_test.js`, `phys_test.js`, `move_test.py`, `play_mp.py`, `fallback_parity.py` and `audio_test.py` exit with code 1 if anything fails. The browser checks give their test pages admin authority (`__net.testAuth`) because they move them with the client-side debug teleport, which the server's movement check refuses from ordinary players.

## Scenario groups (real simulation)

### s_percept.js - perception, memory, personality
- **P01** noticing distance: run > walk > crouch
- **P02** a light beam makes a walker easier to notice
- **P03** standing still: a hound that is not looking never finds a silent standing player 300 px away behind it
- **P04** walls block sight
- **P05** hearing: a running player is heard through a wall, a crouch-walker at the same spot is not
- **P06** sliding / vaulting / landing are loud events, a standing player is silent
- **P07** exhausted breathing is audible only close by
- **P08** memory: the last known position is used, goes stale, the hound gives up and goes back to roaming
- **P09** no impossible information: a silent player two rooms away leaves no trace in a roaming hound's memory
- **P10** social awareness: a silent second player behind walls is not a threat; a runner approaching is
- **P11** personality: same species, different individuals
- **P12** traversal caps: hounds vault, smilers vault slower, nobody squeezes through wall holes without CAN_USE_TIGHT_GAPS

### s_hound.js
- **H01** bait a lunge and sidestep: a late sidestep beats it, standing still does not
- **H02** no invincibility frames; a slide can pass under a lunge
- **H03** chase outcomes in the long corridor: a fresh runner with a head start lasts, an exhausted one is caught fast
- **H04** lunges start only when in range, roughly aligned and with a clear line
- **H05** poor sharp turning at full speed
- **H06** recovery after a missed lunge
- **H07** every hound state is reached by emergent play
- **H08** searching is logical: starts at the last known position, fans out, does not home in on a quiet crouching player
- **H09** the wall impact only ever happens against a wall that is really there
- **H10** exhausted prey: variant D only for a player with nothing left
- **H11** no repeated identical death selection
- **H12** after a kill: EXCITED, then feeding; an intruder at the body is guarded against and hunted
- **H13** pack instinct
- **H14** far hounds sleep and wake

### s_smiler.js - Part 2 stage 2D: the canon Smiler
(v23.1. The v22 Smiler tests are retired with the old Smiler: `s_smiler_v22_retired.js`, `s_smiler2_v22_retired.js` - kept for reference, not run.)
- **SM01** a light carrier it can see is chased after a wind-up; the same person in the dark is watched, never chased
- **SM02** strikes only on canon triggers: a quiet still person is never struck; a fast retreat in front of it (panic) or a loud noise close by is
- **SM03** eye contact holds it; backing away slowly while watching it gets you let go (it withdraws)
- **SM04** no hidden position: an unsensed player moved elsewhere -> identical decisions, tick by tick
- **SM05** lost player: it goes where it last had them (with an uncertainty), not where they really went
- **SM06** light lead: drawn to what it observed; the same observations replayed with the carrier far away -> identical decisions
- **SM07** wall occlusion: a torch on the far side of a wall draws nothing
- **SM08** infrared OFF vs HIGH -> identical decisions
- **SM09** attention: a one-frame glance does nothing; through a wall nothing; sustained eye contact holds it
- **SM10** hold is counterplay, not immunity: it creeps in and drifts; a fixed gaze loses it; up close one walking step sets it off (a crouched shuffle does not)
- **SM11** multiplayer: one watches in the dark, another walks with a light: it works on the light, no flicker; a lit player it has never seen never wins
- **SM12** personality: bounded, deterministic per seed, no extreme tiers
- **SM13** state validity over long mixed runs (finite, valid targets / states / transitions, never in walls, never stuck)
- **SM14** no teleporting
- **SM15** presentation: no limbs; the face glow is its own channel; no aggression UI outside debug
- **SM16** multiplayer: a light elsewhere draws it off somebody it only watches (once); eye contact keeps it
- **SM17** close-range pressure (v23.1.2): walking / crouching / inching in on it while holding its eyes ends in a strike; standing still or side-stepping does not

### perf_smiler.js / smiler2d_view.py - Part 2 stage 2D
- `perf_smiler.js`: the server step with the shipped population, a worst-case Smiler population (10 smilers, 8 lit players each facing one, blackout) and evidence contention (10 smilers and 8 lit players with sweeping, snapping beams in one spot). `GAMEDIR=/other/build` compares builds.
- `smiler2d_view.py` (browser): a Smiler in the dark with debug on; screenshots and the server debug feed (state, WHY, agitation, eye contact) while the player waits, holds eye contact, looks away, then turns a torch on.

### s_capture.js
- **C01** quick or play depends on the situation (v23.1: the canon Smiler always kills at once; C03 is hound-only; C04 / C05 expect the canon Smiler's reactions)
- **C02** CAUGHT is not DEAD: the next major decision comes after a tense stretch
- **C03** false hope
- **C04** interruption / rescue
- **C05** after a quick kill it reads the room
- **C06** the death itself: one kill per life, record, body where the victim fell
- **C07** spawn protection and admin god mode
- **C08** two hunters, one victim: exactly one capture

### s_system.js
- **Y01** level of detail (near / mid / far)
- **Y02** performance for the shipped population and a stress population
- **Y03** snapshot size, nothing private on the wire
- **Y04** stuck entities are recovered
- **Y05** turning and snapping: smooth headings, bounded acceleration
- **Y06** no wall clipping over long emergent runs
- **Y07** no pop-in: smilers only fade (v23.1: over watch / hold / let-go / torch cycles), entities spawn out of sight
- **Y08** determinism
- **Y09** population caps and bodies over a long session
- **Y10** bodies persist for the configured time (`BODY_TTL`)

### s_evidence.js - Part 2 stage 2C: the evidence law
- **E1** walls stop light: no light level and no evidence through a wall
- **E2** a lit wall / beam seen without the person: an anonymous lead (no player id, wide uncertainty), not a record, not a target
- **E3** the light source at range: an anonymous source lead; only sight of the person then pins it on them
- **E4** light off: no new light evidence, existing evidence kept, then faded
- **E5** hidden-position invariance: an unsensed player moved elsewhere -> identical tick-by-tick decisions
- **E6** observation replay: the carrier moved far away with its light off, the recorded observations replayed -> identical leads and decisions (no back-projection)
- **E7** the camcorder emits no visible light
- **E8** eye contact: detected when seen and faced; not when facing away or through a wall
- **E9** target commitment: no switch inside the 1.5 s dwell unless the prey is truly lost
- **E10** bounded and finite: leads <= 6, evidence <= 4 per record, finite numbers, confidences in [0,1], valid states

### s_ir.js / ir_net.js / ir_test.py - Part 2 stage 2C-IR: infrared
- **I1** ai.js / sim.js never name infrared; server.js keeps it on the connection, not the player
- **I2** OFF vs HIGH on every camcorder (and on the player objects under every client name, as if leaked): identical AI decisions, tick by tick
- **I3** a raised camcorder is no visible light to the AI
- **N1-N4** (real server) the level reaches other players; only a raised camcorder carries it, clamped; still shown raised; no errors
- **R1-R9** (browser, measured on the darkness layer) HIGH / LOW range profile; a beam not a disc; sensor-only and NV off show no infrared; walls stop it; heat per emitter level and the emitter-only lockout; overexposure near a wall; peers only through one's own NV; legibility follows the beam

### perf_light.js - worst case for light evidence
8 players with visible lights (torch / headlamp / lantern), beams sweeping round the monsters and snapping on and off, every monster in the near tier. Guardrail: average < 0.25 ms and p99 < 2 ms per 1/60 s step. `GAMEDIR=/other/build node perf_light.js` runs the same load on another build for comparison.

## live.js (real server, two clients)
- **L1** the browser can load the game files but never `ai.js` / `sim.js` / `server.js`
- **L2-L3** both clients get snapshots at about 20 Hz, see each other, and receive byte-identical entity data; nothing internal to the AI is on the wire
- **L4** without the passcode no admin command works, and a living player cannot send a death replay or a corpse
- **L5** the right passcode unlocks admin; the server kills a player (variant chosen server-side), tells everyone, relays the replay and stores one body per player with the light left behind; a living player cannot fake either
- **L6** the AI debug feed goes only to the unlocked admin who switched it on
- **L7** downstream bandwidth per client
- **L8** five wrong passcodes lock attempts for a minute

## move_test.py (Part I, in a browser)
M01 speeds - M02 states - M03 stamina regeneration by state - M04 sprint length - M05 exhaustion never disables a mechanic - M06 recovery - M07 slide length by surface - M08 slides need running speed - M09 no slide-cancel chain - M10 three vault qualities - M11 vault detection and approach angle - M12 crawl through wall holes - M13 under low furniture and window sills - M14 what the server hears

## Layout
- `paths.js` finds the game folder (works inside it and next to a `g/` working tree).
- `harness.js` is the puppet-player world; `tests/lib.js` has the geometry finders and helpers the scenarios share.

## s_hound2e.js — new Stage 2E acceptance

H1 visible human + flashlight; H2 direct beam; H3 anonymous light/replay; H4 wall occlusion; H5 IR invariance; H6 hidden corner branches; H7 hearing reacquisition; H8 silent hidden reposition; H9 noisy hiding after loss; H10 bounded failed search; H11 multiplayer commitment; H12 listening vs real stuck; H13 long-run validity; H14 finite eye-contact intimidation; H15 light-off memory; H16 deterministic bounded traits/private-data invariance; H17 separate Hound memories. All are included in the default runner.
