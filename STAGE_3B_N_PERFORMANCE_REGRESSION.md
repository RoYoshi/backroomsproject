# Stage 3B-N — Performance / Regression

**VISUAL PARITY FIRST. PERFORMANCE THROUGH ENGINEERING.**

Every number here comes from a container that renders with **SwiftShader**, a software renderer. Absolute
milliseconds say nothing about your GPU; only the relative comparisons and work counts mean anything. No claim is made
about performance on your hardware.

## Stage 3B rendering optimizations: still active

- `assets/l0-remaster.js` and `assets/level0_visuals.js` are **byte-identical to the parent**. The package receipt checks
  this.
- `dev/stage-3b/smoke_3b.js` passes **9/9** on the final tree:
  - the remaster is built above the level art;
  - remaster OFF equals the v23.3.6 / BR-RoLE 1.0 look;
  - BR-RoLE's overlay is byte-identical with the remaster on and off;
  - background tier rebuilds work;
  - S08: with the remaster on, a frame takes 161 ms against 295 ms with it off (SwiftShader, YELLOW HALL), so the Stage
    3B win holds; BR-RoLE's own time is 11.8 ms on vs 12.8 ms off.
- Stage 3B unit tests (`dev/stage-3b/test_3b.js`): **26/26**.

## What Stage 3B-N adds or removes per frame

| change | cost | measured |
|---|---|---|
| N2 the ambient glow is no longer drawn (a 1340×1340 gradient fill on the overlay, every frame) | **removed** | BR-RoLE's own time per frame (`perf_br.js` desktop) is lower in every scene. MEDIUM: lamps −1.3, beam −2.9, hound −1.9, props −5.5, peers −7.9 ms. HIGH: −3.8 to −8.3 ms |
| N2 danger flicker as a lamp surge | one multiply per lamp | — |
| N3 pillar corners in the LOS polygon (two polygons per frame) | +96 rays only within 796 px of a pillar | `Hl()` with the game's own ray: 0.063 → 0.094 ms per polygon in PILLAR HALL (+0.06 ms a frame); elsewhere 0.063 → 0.067 ms |
| N3 `fixLamps` | once at load (90 fixtures) | — |
| N4 Shift rule | one condition per movement step | — |
| N5/N6 Hound (server) | blind route asked once per loss; one plausibility test per heard sound | full AI suite timing tests pass: Y02 per-step cost (shipped population p99 3.1 ms, stress p99 4.7 ms, budget 16.7) and NV12 (navigation per tick, path searches per second) |

Per frame the net effect is a saving. The only addition is ≤ 0.1 ms of JavaScript in the PILLAR HALL. Nothing was made
cheaper by weakening lighting, visibility, AI or presentation.

## Regression across the corrected systems (final tree)

| area | check | result |
|---|---|---|
| camera / timing serving | `camera_3bn.js` (real server and client, 11 viewports incl. DPR 2) | **4/4** (parent 1/4) |
| camera fairness math | `s_camera_fairness`, `test_3bn` N1 | 12/12, 5/5 |
| fixed-step timing | `s_fps_equality` | 60/120/240/360 FPS → exactly 60 gameplay ticks/s |
| true darkness, danger flicker | `visibility_3bn.js` | **6/6** (parent 1/6); 0 exposed frames behind a wall and behind a pillar |
| BR-RoLE | `dev/br-role/test_br_role.js` | 32/32 |
| fixture / pillar / LOS stability | `pillar_3bn.js` | **5/5** (parent 2/5) |
| legacy shadows unit | `dev/shadows/test_shadows.js` | 47/48, the same as the parent (S16 is a stale whitelist string) |
| movement | `move_3bn.js` (real keys, networked, server-checked player) | **7/7** (parent 0/7); move.js parity with the parent across 4 800 bot ticks |
| multiplayer authority | M7 + `test_3bn` N4-2 | 0 server corrections; observer sees crouch → run; the server's movement checks and gait hearing are byte-identical to the parent |
| Hound pursuit / sound | `hound_3bn.js` | **10/10** (parent: 2/5 blind pursuit, 3/5 sound) |
| AI suite (162 tests) | `node dev/tests/run.js` | **151/162**, the parent's count (C1, SM01 fixed; C9/C10, SM17 changed: see the Hound report) |
| Stage 3B-N fast checks | `test_3bn.js` | 28/28 |
| HQA hotfix suite | `s_humanqa_hotfix` | 5/6, the same as the parent (X03 fails on the parent too) |

## Open points (for human QA, not hidden)

- **C9/C10 balance.** A fresh sprinter who keeps running is caught a little more often, because the Hound now keeps the
  chase. Details are in the Hound report.
- **SM17.** A Smiler test whose set-up sample moved with the fixtures. The new failing case replays identically on the
  parent.
- **Legacy lighting fallback.** The path used when BR-RoLE is off or fails still has v23.3.6's glow; it is not the
  shipped path.
