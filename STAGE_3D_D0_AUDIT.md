# Stage 3D, D0: audit, freeze and baselines

**What D0 is.** The audit of the accepted Stage 3H0 source before any Stage 3D change. It records:
- where every part of a death lives today;
- the eight variants, exactly as the code has them;
- what the server trusts;
- what the physics does on the real map;
- what deaths cost;
- the acceptance thresholds for later checkpoints, fixed now.

No production file changes at D0.

## 1. Source authority

| | |
|---|---|
| Repository | `RoYoshi/backroomsproject` |
| Authorized parent | `stage-3h0` at `06949a8a4204a1ce8144b87b2192251b259b21ec`, tree `5adf3f3cde5c1a52775f561c36facda646f3cca8` |
| Checked | `git ls-remote` and the GitHub branch API both gave that commit and tree before work began (`evidence/d0/remote_heads_before_3d.json`, 21 branches) |
| `stage-3d` | did not exist; created from the exact parent commit |
| Master pack | `THE_FAR_BACKROOMS_STAGE_3D_GORE_DEATH_2_0_MASTER_PACK.zip`, SHA-256 `14d89a72…31b85d9`, matching its `.sha256`; all 24 entries match `PACK_SHA256SUMS.txt`; read in `RUN_ORDER.txt` order, outside the repository |
| Accepted 3H0 package | SHA-256 `544862df…f20b68`, the package delivered at H0-6c |
| `source_reference/` in the pack | `dphys.js`, `gore.js` and `death_srv.js` are byte-identical to Git at the parent; Git is the authority |

**The death sources at the parent** (SHA-256):

| File | SHA-256 | Role |
|---|---|---|
| `dphys.js` | `631e32d1…4a1e815` | the physical death: body, two hands, gear, hat, attacker, camera impulse; shared by victim, spectators and the server |
| `gore.js` | `8848c8a0…98ef97c` | blood: live death bursts, pools, spatter, smears, corpse blood, wounds on the avatar |
| `ents.js` (from `dev/ents_src/*`, `25_death.js`) | `0299d777…56bfc28` | `deathPlan` (variant → plan), `deathExtras` (Hound C wall marks), `localKill` (offline choice) |
| `death_srv.js` | `a930d71c…5f5df90` | the server's fallback: `fxFor`, `bodyFor`, `durOf` |
| `server.js` | `c16fd332…a59f27d` | aftermath table, `fx` / `b` handling, `bodies` broadcast |
| `sim.js` (from `dev/sim_head.js` + `dev/sim_glue.js`) | `3e052571…2c07f47` | kill commit, kill record, bodies (max 24), `killerEnd` |
| `ai.js` (from `dev/ai_src/*`) | `3fc19470…4ad1731` | capture, variant choice, kill commitment |
| `mp.js` | `4e4b11db…ca5e547` | `__net.deathStart`, `bodyMade`, spectator replay (`startFx` / `updateFx`), `applyBodies` |
| `assets/net-wire.js` | `144641bb…b92ab15` | the corpse codec `toRec` (3H0) |
| `assets/index-DKbV5Nv9.js` | `55969efa…b7dd045` | the death class `Jl`, the corpse view `eu`, `beginDeath` / `completeDeath`, the death camera, the death sound |
| `sfx.js` | `1c62054a…844adfe` | drop-in death sounds (`sounds/death_hound` …) |

`ents.js` is exactly the concatenation of `dev/ents_src/` (checked). Changes to it go through `dev/ents_src/` and `dev/build_ents.sh`.

## 2. How a death runs today

1. **The kill (server).** `ai.js` `killNow` picks the variant (`pickVariant`), finds the wall behind the victim, and emits `kill`. `sim.js` `processEvents` sets `p.dead`, `p.dseq++` and the kill record `p.kill`:
   - `v`, `k`, `e`;
   - `ax`, `ay`, `aa` (attacker);
   - `w` (wall, Hound C only);
   - `x`, `y`, `a` (victim);
   - `why`.

   `server.js` `aftStart` keeps the aftermath, with the victim's look and gear, from the next snapshot. A hound "commits" to the kill for `KILL_DUR` (A 4.5, B 4.7, C 4.3, D 4.5 s: the same lengths as `dphys.js` `DURS`).
2. **The victim's client.**
   - The snapshot carries `mk` (the kill record). `mp.js` `announceKill` stores it as `window.__kill`.
   - The game's fixed step marks the player caught, and the bundle's `beginDeath` starts `Jl` with the server's kind, variant, wall and attacker position.
   - It uses the client's **own** position and angle, velocity and stamina.
   - `__net.deathStart` sends `fx` (death) with those inputs.
3. **The death itself.** `Jl.start` reads the plan (`ents.deathPlan` → `dphys.PLAN`): knock and drag, limited by the level (`safeDistance`, 4 px steps while a 22 px circle is clear). `dphys.begin` builds the simulation. Every frame, `dphys.frame`:
   - advances it at a fixed 240 Hz;
   - sets the body, hands, attacker and torch;
   - drops blood bursts where the jaws are at each blow;
   - drives the camera impulse.

   `gore.fx` redraws the blood every frame. The death camera follows the body at 1.4 × the base scale (accepted behaviour).
4. **The corpse.** When the death ends, `completeDeath` makes the record (`Ql`), the corpse view draws once (`eu` with `gore.corpse`), and `__net.bodyMade` sends `b`. The server stores it with `sim.setBody` (keyed by player, at most 24, `bodyVer++`) and every client gets `bodies`.
5. **Spectators.** `server.js` relays the victim's `fx`. Each spectator's `mp.js` `startFx` plays the same `Jl` and `dphys` death with those inputs, hides the real attacker meanwhile, and ends the replay when the new corpse arrives (or 8 s after it finished).
6. **Fallback.** If the victim's `fx` has not come 1.5 s after the kill (or the victim is gone), the server sends `fxFor` from its own record. If no `b` has come by the death's end plus 8 s (0.6 s once the victim is gone), it runs `death_srv.bodyFor`: the same `dphys.js`, in a Node VM, on the server's record. It then sets that corpse and puts the hound where the simulation left it (`killerEnd`).
7. **Late join and reconnect.** A joining client gets the `bodies` list (`c.bv` differs). A death in progress is not replayed to it; it sees the corpse when the list changes.

## 3. The eight variants, exactly

**Choice (server, `ai.js`).** Weights; the last six choices per killer kind damp a recent repeat (× .35 / .6 / .8), and a third identical death in a row gets × .06:

| Variant | Weight |
|---|---|
| Hound A | 1.0 × (1.5 if the victim faces it, else .55) |
| Hound B | .95 × (1.25 if from behind) × (1.25 if running) |
| Hound C | 1.7 if a wall is behind the victim along the attack line, else 0 |
| Hound D | 3.2 × (1.3 from behind, else .6) if exhausted (stamina < 22), else 0 |
| Smiler A | 3 (1 in a dead end) |
| Smiler B | .4 (3 in a dead end) |
| Smiler C, D | 0: admin previews only |

`ents.localKill` (offline, no server) uses the same weights, with an open-space test for the Smiler's dead end.

**What each one does** (`dphys.js` `PLAN` and `CFG`, `ents.deathPlan`):

| | Knock / drag (px) | Blows (s) | Length (s) | Grip, drag, release | Light released | Hat | Blackout | Notes |
|---|---|---|---|---|---|---|---|---|
| Hound A | 46 / 40 | .2 .62 1.05 1.55 | 4.5 | lunge 330 px/s, grip .16, pinned from .3 | at the 2nd blow | at the 3rd blow | – | strong knockback, repeated impacts, spin 1.9 |
| Hound B | 12 / 140 | .3 .85 1.5 2.1 | 4.7 | lunge 235, grip .26, dragged .9–2.2 s | when the drag starts | when the drag starts | – | hands brace and slip during the drag |
| Hound C | wall distance − 17 (≤ 110) / 0 | .2 .21 .8 1.4 | 4.3 | driven into the wall from a standstill (launch from the knock), grip .62 | at the wall impact | at the wall impact | – | wall smear and spray (`deathExtras`) |
| Hound D | 24 / 26 | .45 .95 1.55 | 4.5 | lunge 175, collapse .05–.95, little spin (.3), squash 1.9 | at .3 s ("early") | stays on | – | the victim had no strength left |
| Smiler A | 34 / 86 | none in its plan: the physics uses the default .24 .74 1.2 1.7 | 3.95 | still, shove at .32 (105), drawn in 2.03–3.12 | when drawn in | stays on | – | the sound uses .38 .98 1.48 (see 6.3) |
| Smiler B | 0 / 0 | .7 1.2 1.7 | 3.85 | closes in .05–1.15, collapse .7–1.4 | at the collapse | stays on | black .05–1.6 s | cornered: falls where it stood |
| Smiler C | 18 / 36 | .55 1.1 1.6 | 3.95 | shove .28 (60), drawn 1.7–2.7 | when drawn in | stays on | black .02–.9 s (× .8) | lamps die (the admin preview flickers them) |
| Smiler D | 26 / 70 | .6 1.2 1.8 | 3.95 | shove .32 (90), drawn 1.6–3.0 | when drawn in | stays on | – | stronger pull |

**For every variant:**
- the light leaves the hand by 1.7 s at the latest;
- a headlamp is never dropped;
- the body's alpha dips for Smilers while they are drawn in;
- the camera shakes from the simulation's own impulses (one per real impact).

**The corpse record** (`b` → `bodies`):
- `k`, `n`, `x`, `y`, `a`, `sx`, `sy`, `c`, `aa`, `lk`, `eq`;
- `bl`: up to 6 blood bursts with seeds;
- `dr`: the dropped light;
- `ht`: the hat;
- `lo`: light on;
- `ph`, `hd`: two hands in body space, four values;
- `ho`: hat on;
- `tr`: trail, up to 24 points;
- `srv`: server-made.

The contact sheets of all eight, victim and spectator, are in `evidence/d0/film/`.

## 4. The physics on the real map (`dev/stage-3d/phys_matrix.js`, `evidence/d0/phys_matrix_parent.json`)

**The runs.** 690 deaths at 16 real spots: open halls, corridors, corners, beside pillars, in front of walls, near low obstacles. All eight variants (Hound C only where a wall is behind), six attacker sides, each sampled at 30, 60, 120 and 240 Hz.

**What holds already:**
- every state is finite;
- the end state is identical at every sample rate (the 240 Hz integrator decides, not the frame rate);
- no body, hand, light, hat or attacker crosses into a wall (deepest overlap 0.19 px);
- no tunnelling (largest body move per 240 Hz step 2.4 px);
- the server's fallback and the client run the same code.

**What does not** (D1 targets):
1. **Sleep is not final.** Of the 690, 265 never reached SLEEPING within 0.6 s after their end, and 13 were still moving when the death ended. Of those that slept, 394 woke again: things moved up to 12.3 px after "SLEEPING" (Hound A, C, D).
2. **A dead body creeps.** After a hound "eases off", its grip (a spring to the jaw) keeps towing the body at a constant 5–6 px/s until the end. Hound A's body moves 12 px in its last 1.5 s.
3. **Dead hands tremble forever.** The slack hands follow an endless noise signal, so the death flickers between ACTIVE and SETTLING.
4. **The server's fallback death costs 21–51 ms** (median per variant; worst 132 ms) of one thread per death (`perf_death_srv_parent.json`; corrected at D6, this line first said 37–95 ms). It runs inside the 25 ms wake that steps every room, on the first fallback of a process (cold JIT) and in a separate VM context (about 4 × slower than the main context when warm). The level's blocker query is rebuilt about 9,600 times per death.

## 5. What the server trusts today

| Message | What the server does now | Trust gap (D4) |
|---|---|---|
| `fx` (death) from the victim | relayed to everyone, with the victim's own position, angle, attacker position, variant, wall, velocity and exhaustion (clamped to map bounds) | the replay's geometry and variant are the client's, not the server's kill record. Spectators see what the victim's client says |
| `fx` (death) from the server | `fxFor` from the kill record, if the client is late or gone | – |
| `b` (corpse) | accepted from any dead player, any number of times, at any position on the map; each one bumps `bodyVer`, and every client gets the whole `bodies` list again | arbitrary corpse position; repeated reports re-broadcast all corpses each time; a late client corpse replaces the server's fallback |
| `b` with `c: 'Vanish'` | accepted from a living player at any time | not tied to a validated NEW RUN vanish |
| `b.ka` (attacker end) | `killerEnd` → `ai.commitEnd`: once per kill, within 320 px of the kill, only onto a clear spot | bounded already |
| `bodies` | whole list on every change | size grows to 24 corpses × ~360 B ≈ 8.6 KB per change |

**Disconnects.**
- Mid-capture: forfeited, which is a death.
- After the kill, before `fx`: server `fx` at once.
- Before `b`: server corpse 0.6 s after the death would have ended.
- One aftermath per player (`afts` filtered by id).

**Respawn, world reset and NEW RUN.**
- **Respawn:** the old corpse stays until the same player dies again, since bodies are keyed by player.
- **World reset:** clears all bodies.
- **NEW RUN:** leaves a `Vanish` record, which is the dropped gear only.

**The known 30 s NEW RUN cooldown mismatch.** It is recorded by 3H0's live wire tool, and it is not touched by 3D.

## 6. Other findings

1. **Z / elevation: NO-GO.** Level 0 is planar: a 96 px tile grid, square pillars, and props typed `low` (vaultable), `under` (crawl-under), `window` and `gap` (crawl-hole). Their blocking depends on a movement mode (`WORLD.mode`), with no numeric height. The death physics uses the props as solid walls (mode `walk`).
   - 3D keeps planar deaths. A dead body does not go over a low obstacle or under furniture.
   - Any future elevation needs the Stage 4 spatial runtime; it is not built here.
   - The death code reads blockers through one function (`walls(x, y)`). That function is the seam where elevation would plug in.
2. **Collision mode.** The client's death physics queries the bundle's `Bc`, which honours `WORLD.mode` at the moment of the query; the server forces `walk`. In practice the client is in `walk` when a death runs. 3D pins it, so the two can never differ.
3. **Death sound timing.** The bundle's synthesized death sound plays its blows at a fixed table (Hound .24 .74 1.2 1.7; Smiler .38 .98 1.48) whatever the variant. The physics' blows differ:
   - Hound C strikes at .2 / .21;
   - Hound D at .45;
   - Smiler B at .7.

   No sound marks the wall impact or the gear hitting the floor. Spectators hear nothing of a replayed death.
4. **Corpse views.** All corpse views (≤ 24) are drawn every frame, on or off screen. Each is a static Graphics built once (blood pools of 15 layers × 72 points per burst, plus spatter and smears). The live death redraws all of its blood every frame for its whole length.
5. **Blood placement.**
   - Spatter drops are tested against the tile grid only (`zc`), so a drop can land on a pillar or a prop.
   - Wall marks exist only for Hound C (`deathExtras`), though every variant can strike a wall (the physics records `trace.hit`).
   - Corpse blood is drawn at one fixed dryness (.82), whatever its age.
6. **Light.** Blood is ordinary world drawing under the light layer: never emissive, dark where it is dark.
   - Remote corpses' dropped lights shine through `mp.js` `bodyLights` (flashlight beam and lantern; not the camcorder) if `lo` (the light was on), within 950 px.
   - The local victim's dropped torch is the death class's `torch`.
7. **The admin Death Lab** (DEATHS tab) plays any of the eight on the admin through the real kill path. It has its own clock (speed, pause, step), x-ray and path overlays, and placement (open room, near a wall, corner). It is admin-only (passcode); 3D adds no unauthenticated control.
8. **Existing tests that touch deaths:**
   - `dev/tests/phys_test.js` (passes);
   - `fallback_parity.py`, `death_film.py`, `death_spectator.py` (written before the QA2 menu and the default-passcode policy; 3D has its own versions in `dev/stage-3d/`);
   - `audit_net*.js` (death aftermath on disconnect);
   - the 3H0 golden traces (scenario `deaths`).

## 7. Baselines recorded at D0 (`dev/stage-3d/evidence/d0/`)

| Baseline | Tool | Result |
|---|---|---|
| Physics on the real map | `phys_matrix.js` | section 4 |
| Server cost | `perf_death_srv.js` | fallback corpse 21–51 ms median per variant, worst 132 ms (corrected at D6); 60 Hz step unaffected by 24 corpses; `bodies` 8.6 KB with 24 corpses |
| Browser cost | `perf_death.py` | below; `perf_death_parent.json` |
| The eight deaths, victim and spectator | `film_3d.py`, `regrid.py` | `film/sheet_*.jpg` (victim row over spectator row, every frame labelled with its time), `trace_*.json` |
| Victim corpse against server corpse | `parity3d.py` | below; `parity_parent.json` |
| Golden traces, whole tree against whole tree | `golden3d.js` | 11 of 11 scenarios identical (A/A: parent against the unchanged branch) |
| Existing tests | `dev/tests/phys_test.js`, `interp_test.js`, `audit_net.js`, `audit_net2.js`, `ir_net.js`, `live.js` | see `steps.txt` |

**Browser, two pages at 1280 × 720 on SwiftShader (2 CPUs), 2 rounds.** The renderer saturates the main thread here (task time about 1,000 ms per second in every window), so script time per second says little; the frame time is the measure. Software rendering only: compared between versions on this machine, never quoted as GPU performance.

| Window | Frame median, victim / spectator (ms) | fps |
|---|---|---|
| idle | 766–900 / 767–767 | 1.4–1.5 |
| Hound A death | 850–883 / 800–875 | 1.4–1.6 |
| Hound C death | 683–700 / 667–717 | 1.8 |
| Smiler A death | 850–950 / 900–1,033 | 1.5–1.7 |
| 20 corpses on screen | 2,217–2,250 / 2,183–2,275 | 0.6 |
| 20 corpses off screen | 908–1,017 / 900–1,025 | 1.2–1.3 |

Corpses on screen are the one large cost: 20 of them make every frame about 2.6 × slower (each is 15 translucent layers × 72 points per pool, plus spatter and smears, rasterised again every frame). Off screen they still cost about 10 %.

**Parity, parent.** The victim's own corpse (`b`) against the server's fallback run on the server's kill record, all eight at normal speed: body 0–1 px, turn ≤ 0.04 rad, hat 0, hands ≤ 2 px; the dropped light 0–2 px except Hound A, 34 px (the light was still sliding when the two runs were cut). The client's replay record matches the kill record exactly (`fx == kill` for all eight): the victim already starts from the server's position.

## 8. Thresholds for later checkpoints, fixed now

**Deterministic and exact:**
- non-death golden output identical in every scenario (`golden3d.js`);
- `phys_matrix.js`: finite everywhere, identical end state at 30 / 60 / 120 / 240 Hz, no overlap deeper than 0.5 px for body, hands, gear and attacker, no tunnelling;
- every death SLEEPING by its end, and nothing moving after SLEEPING.

**Server:**
- the fallback corpse costs no more than at D0 (median and worst over the same spots);
- the 60 Hz step's median and p95 stay within D0's own spread;
- `bodies` stays at most at D0's size per corpse plus 10 %.

**Browser** (SwiftShader, same machine, same tool, frame-time median):
- idle within D0's spread + 10 %;
- each measured death no worse than D0's worst round + 10 %;
- 20 corpses on screen no worse than D0 + 10 % (the target is far better: section 7);
- 20 corpses off screen no worse than idle + 5 %;
- JS heap after the run within D0's range.

A clear regression blocks the checkpoint until explained and approved.

**Visual and identity:**
- each variant keeps its knock and drag limits, blow times, length, blackout and release triggers (section 3), unless a change is listed in `STAGE_3D_VARIANT_MATRIX.md` with before and after frames;
- one body, two circular hands; no limb.

## 9. Evidence handling

- **No real passcode anywhere in the evidence.** Every server these tools start uses a synthetic admin passcode (`lib3d.PASS`). The older tests that carry a passcode in their text are not copied.
- **No secret in the logs.** The logs hold the synthetic name, local ports and room names only.
- **The scan.** The secret scan of 3H0 is reused before every commit.
