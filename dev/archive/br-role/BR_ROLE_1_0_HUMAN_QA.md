# BR-RoLE 1.0: final human QA

**Status: `BR-RoLE 1.0 ENGINEERING COMPLETE — FINAL HUMAN QA PENDING`**

This is the final BR-RoLE build: the BR2.1 visuals you approved, optimized, regression-tested and packaged. I have not marked anything PASS: you are the only visual authority. **`main` is not merged.** Stage 3B has not been started.

- **Branch:** `br-role`. Parent: BR2.1 `4d0264a` (approved by you).
- **Lineage:** gameplay v23.3.6 `f2805bb`. `main` is still `7781e1a`.
- **Package:** `THE_FAR_BACKROOMS_BR_ROLE_1_0_FINAL.zip`. It comes with its `.sha256` and `BR_ROLE_1_0_PACKAGE_RECEIPT.txt`.
- **To start:** run `node server.js`, or `run_linux.sh` / `run_windows.bat`, as usual.
- **Version check:** the module reports `br-role 1.0` (`__brRole.stats().version`, or admin DEBUG MODE).

## What 1.0 is

**LIGHT FIELD → BLOCKER → CAST SHADOW → ADD SURVIVING LIGHTS**, for every light in the world.

**The lights:**
- fluorescent lamps;
- your flashlight, headlamp, lantern or camcorder;
- other players' lights.

**What blocks them:**
- walls and pillars;
- large props;
- you, other players and the Hounds you can see.

Every shadow takes away only its own light, so other lights fill it.

**What stays the game's own:**
- the line-of-sight blackout;
- the camcorder's infrared;
- the vignette;
- death effects;
- Smiler faces.

See `BR_ROLE_1_0_ARCHITECTURE.md`.

**What BR3 changed:** performance only. You should see **no visual difference from BR2.1**.
- **Beam culling:** a beam now works only in the box of its own cone.
- **Fill clipping:** every shadow fill stays inside its light's box.
- **Faster frames:**
  - a beam is about 30 % cheaper;
  - two crossing beams 40–50 % cheaper;
  - the counter area 25–30 % cheaper;
  - the worst frame on entering a new area dropped from 77 to 64 ms (MEDIUM, this container's software renderer).
- See `BR_ROLE_1_0_PERFORMANCE.md`.

## What was checked

`BR_ROLE_1_0_TEST_SUMMARY.md` has the details.

- **32 / 32 unit checks** and **12 / 12 browser smoke checks**, read from the screen's pixels.
- **Gameplay freeze:** every protected gameplay file is byte-identical to v23.3.6.
- **The retained v23.3.6 gameplay suites**, compared with the immutable parent's baseline.
  - They reproduce the parent: two known timing flakes reproduced it on one rerun.
  - The one exception is a static text check (humanqa X03). It looks for the exact source line of the hand aura, which the approved seam wraps. The aura's behaviour is verified unchanged (unit check U32).
- **One desktop and one low-end/mobile performance pass.**
- **A leak and cache-growth soak:** flat heap, the cache at its cap, 0 errors.
- **The exact commit verified on GitHub**, and the package rebuilt from it.

**Not verifiable here:** this container renders in software (no GPU). **How smooth it feels on your PC and your phone is for you to judge**, especially entering new areas (question 9).

## Final tour (about 15 minutes)

Start at **MEDIUM**: the desktop default. A phone defaults to LOW.

| # | where | what to look at |
|---|---|---|
| 1 | **YELLOW HALL** spawn, flashlight off | Soft tube shadows behind the partitions, with an umbra and a widening penumbra. Your body is self-shaded away from the lamp. The floor shadow leaves your far edge, tapers and fades, and vanishes right under a lamp. |
| 2 | between two lamps | The self-shading goes faint. Nothing flips. |
| 3 | flashlight on, sweep the hall | The beam's walls cast crisp-to-soft shadows; where the lamps are blocked, the beam fills; the light adds, with no seams. **Sweep fast:** no beam edge clipped short, and no hard line at the cone's edge (this is the BR3 culling). |
| 4 | **HUMMING ROOMS** counter | The lamps' shadow is graded from the footprint, and the counter's top stays lit. From the south your beam fills it; from the north the same counter blocks both. |
| 5 | the other props: shelf, low walls, machine, table, bench, window sills | Natural, not noisy. Nothing for the railing or the wall holes. |
| 6 | a Hound in your beam | A subtle torso shading and a cast behind it, steady with no jitter. Behaviour exactly as before. |
| 7 | a Smiler | Nothing on it or under it. |
| 8 | with a second player | Crossing beams add with no seams, the colours average, and each of you shadows the other's beam. |
| 9 | **play normally** for several minutes on PC, and if you can, on a phone | Any stutter, especially **entering a new area** (lamp shadow fields are built then, a few per frame) or switching tiers. |
| 10 | SETTINGS ▸ CUSTOMIZE ▸ LIGHTING: LOW, then HIGH | All coherent. HIGH may add a faint second floor shadow only. |

## Questions

Please answer each one with yes / no / notes, and say which tier and device you were on.

1. Does 1.0 look the same as the BR2.1 you approved, with nothing new, missing or clipped?
2. Are the fluorescent umbra and penumbra natural at every tier?
3. Do beams, and crossing beams with another player, look right when you sweep fast?
4. Do props block and fill correctly, with your beam and with the lamps?
5. Are your shadow and self-shading, and the Hound's, steady and natural?
6. Are Smilers still free of any shadow?
7. Does gameplay feel exactly as before: Hounds, Smilers, movement, line of sight, multiplayer?
8. Is the frame rate on PC as good as or better than the BR2.1 build?
9. Any hitch on entering a new area or switching tiers, especially on a phone at LOW?
10. **Do you accept BR-RoLE 1.0?**
    - Merging to `main` happens only if you separately say so.
    - Stage 3B / Level 0 Remaster does not start until you say so.
