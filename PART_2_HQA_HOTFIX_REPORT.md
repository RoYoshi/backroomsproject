# THE FAR BACKROOMS — Part 2 Human-QA Hotfix Report

**Build:** `23.3.1-hqa-hotfix`  
**Baseline:** Stage 2F `v23.3.0-2f`  
**Baseline SHA-256:** `210a44ebb08c3b562d73a95748450aa6d970a7760d2a963746d9e4777cb5c921`  
**Status:** Engineering hotfix candidate. **Do not mark Part 2 LOCKED until the final human-QA checklist passes.**

## Scope

This pass is intentionally limited to findings from the October 1 human gameplay review plus stress/admin quality-of-life. It does not begin 2.5D, Part 3, new entities, progression, or unrelated balance work.

## Implemented fixes

### H-01 — Hound eye contact is pre-pursuit intimidation only

Locked behavior now implemented:

> Eye contact may delay pursuit commitment. It cannot reverse or suppress an already committed pursuit.

- A Hound that sees a player already staring at it can enter a finite STALKING hesitation.
- It continues creeping/pressuring rather than being frozen in place.
- Running, point-blank proximity, or exhausting the finite intimidation budget commits pursuit.
- Once the Hound is `HUNTING`, gaze no longer pauses movement, reduces chase speed, or cancels commitment.
- Existing lunge/kill commitment remains unaffected.

### H-02 — Close-range orbit exploit

Human QA showed that a walking player could orbit a pursuing Hound faster than its body could reorient.

Targeted fix:

- At close range, interception lead is removed so the Hound aims at the body instead of leading past it.
- Large close-range facing errors make it bleed speed and plant/pivot.
- Extra turning authority is applied only after speed falls, preserving the species' poor high-speed cornering.
- Medium/far chase turning remains unchanged.
- No instant 180-degree turret snap was added.

A deterministic regression now verifies that six close walking-orbit attempts are all caught within the bounded test window.

### S-01 — Smiler indefinite gaze equilibrium

The Smiler still obeys its established canon/project attack rules. No generic proximity attack or timer attack was added.

When a player stands still and holds its gaze:

- hold pressure now accumulates;
- creep becomes somewhat stronger;
- lateral drift becomes progressively faster;
- drift direction changes happen more often;
- the encounter becomes less comfortable to hold indefinitely.

Slow retreat while maintaining eye contact remains the safe disengagement behavior and reduces hold pressure.

Visible light still has priority over the gaze hold once agitation reaches its chase threshold. A new regression observed visible light overcoming sustained gaze in 7/8 seeded encounters.

### QOL-01 — Dead hover label

A peer whose authoritative server lifecycle state is dead is now shown as:

`NAME · DEAD`

instead of `NAME · DOWN`.

Death physics/lifecycle were not changed.

### QOL-02 — No fake equipment light while OFF

The small 52 px carried-light aura is no longer rendered while a visible light source is switched OFF.

- Local player: aura/beam/pool render only while visible light is ON.
- Remote players: same rule.
- Camcorder/NV does not create this visible aura.
- The AI/shared lighting model already treated OFF as no emitted visible light; this removes the misleading presentation-only glow.

### ADMIN/STRESS — Entity cap raised

Normal game population was **not** rebalanced.

- Normal Hound director cap remains **3**.
- Admin/stress Hound cap: **64**.
- Admin/stress Smiler cap: **64**.
- Mixed stress world can hold **128 entities** total.
- Client render/network slot pools expanded to 64 per species.
- Admin panel now has `+10 HOUNDS` and `+10 SMILERS` controls for stress testing.
- Stress placement uses relaxed entity-to-entity spacing but still requires reachable legal floor and keeps spawns away from live players.

## Modified/new files

- `dev/ai_src/50_hound.js`
- `dev/ai_src/60_smiler.js`
- `dev/sim_glue.js`
- `dev/tests/s_hound2e.js`
- `dev/tests/s_humanqa_hotfix.js` **(new)**
- `ai.js` **(rebuilt)**
- `sim.js` **(rebuilt)**
- `mp.js`
- `server.js`
- `assets/index-DKbV5Nv9.js`
- `package.json`
- `PART_2_HQA_HOTFIX_REPORT.md` **(new)**
- `PART_2_HQA_TEST_SUMMARY.md` **(new)**
- `PART_2_HUMAN_QA.md` **(new)**

## Preservation notes

The following were deliberately left alone except where directly required above:

- fixed timestep / 60 Hz server simulation
- navigation architecture
- normal Hound chase speed and acceleration
- normal far/medium Hound turn character
- Hound lunge timing/contact rules
- evidence semantics / anonymous leads
- target-memory architecture
- RNG stream isolation
- IR blindness
- Smiler panic/retreat and loud-noise attack triggers
- Smiler face-only presentation
- Smiler slow-retreat counterplay
- physical death/corpse simulation
- player movement
- 2.5D work

## Important legacy-test note

Stage 2F test `F22` is an exact source-hash preservation guard. This hotfix intentionally edits `mp.js`, Hound AI, and Smiler AI, so the old Stage 2F hash assertion now trips by design. It has **not** been rewritten to hide the change. The new `s_humanqa_hotfix.js` suite verifies the intentional final-pass deltas instead.

## Completion rule

This build is ready for the user's final subjective playtest. If the checklist in `PART_2_HUMAN_QA.md` passes, Part 2 can be marked:

`PART 2 COMPLETE — LOCKED`
