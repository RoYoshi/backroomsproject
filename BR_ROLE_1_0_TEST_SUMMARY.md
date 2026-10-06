# BR-RoLE 1.0: test summary

**Scope:** every check below ran on the final 1.0 tree. The renderer `assets/br-role.js` has sha-256 `cca26d65…cb9` for all of them.

**Logs:** `dev/br-role/evidence/br3/`.

**Machine:** this cloud container, with 2 CPUs and no GPU. Chromium (Playwright 1.56) renders through SwiftShader, in software.

| | result |
|---|---|
| BR-RoLE unit checks (`dev/br-role/test_br_role.js`) | **32 / 32 PASS** |
| BR-RoLE browser smoke (`dev/br-role/smoke.js`, pixels from the real client) | **12 / 12 PASS** |
| Gameplay freeze (`dev/br-role/freeze_br.py`) | **FREEZE OK** |
| Retained v23.3.6 suites vs the immutable parent baseline | **no gameplay difference**. 18 / 21 suites reproduce the baseline on the first run; 2 more reproduce it on one diagnostic rerun (known timing flakes); 1 is a documented static-text check of the seam (see below). |
| Desktop and mobile performance pass | see `BR_ROLE_1_0_PERFORMANCE.md` |
| Leak / cache-growth soak | flat heap, cache at its cap, 0 errors |
| Launch check, syntax | OK |
| Exact-commit verification and package | see `BR_ROLE_1_0_PACKAGE_RECEIPT.txt` |

## BR-RoLE unit checks: 32 / 32

**How they run:** a Node VM loads the real `world.js`, `light.js` and `br-role.js`, plus the bundle's own wall, ray and lamp code. A recording 2D-canvas mock checks what BR-RoLE draws: every call, under its compositing state.

**U01–U30:** carried over from BR1–BR2.1. They cover:
- the version and the tiers;
- one compositor, everything added;
- lamp fields and their caches;
- shadow polygons cast from the light's own points;
- tube umbra and penumbra;
- read-only and fail-safe;
- the seam;
- no NaN reaching the canvas;
- prop casters and hulls;
- fill and blocking;
- the caps;
- actor dominant light and hysteresis;
- Smilers and hidden actors;
- tint mixing;
- self-shading, the cast taper, eased directions;
- graded prop shadows.

**Updated in BR3:**
- **U01:** accepts `1.0`.
- **U02:** allows clips only as **integer axis-aligned boxes**: the light's own pixel box, never a visibility shape.
- **U12:** allows one clip.
- **U25:** also guards that a fill drawn in world space is still drawn in world space inside the clip. This guard catches the K08 slip below.

**New in BR3:**
- **U31: the sector box.** At the spawn hall at MEDIUM, a beam works in 117 066 px instead of its circle's 482 052 px, and the box still holds the hand and both cone edges at full range.
- **U32: the v23.3.6 hand-aura QOL** (the behaviour retained HQA X03 guards) holds under BR-RoLE:
  - with your light on: one 52 px aura at .35;
  - switched off: none;
  - camcorder (night vision): none;
  - death torch: 150 px at .73;
  - dead, switched-off and camcorder peers: none.

## Browser smoke: 12 / 12

These run on the real client: `node server.js`, Chromium, and pixels read from the overlay.

| check | what it shows | result |
|---|---|---|
| K01 | Loads; BR-RoLE draws every frame; `br-role 1.0`; no page error | PASS |
| K02 | Mixed light: blocked spot | lamp + beam = beam alone, 0.455 = 0.455 |
| K02 | Mixed light: open spot | lamp and beam add |
| K03 | Light buffer = CSS viewport × .5 / .75 / 1 | 960 × 540 at MEDIUM, at DPR 1 and DPR 2 |
| K04 | Same network messages as the legacy lighting | yes |
| K05 | DEV legacy switch off and back on | yes |
| K06 | A Smiler: no shadow | yes |
| K07 | The counter's lamp shadow, filled by your beam | 0.319 = 0.319 |
| K08 | The same counter blocks lamp and beam | 0.086 = 0.086 = ambient; 0.549 before the counter |
| K09 | Your shadow takes only your dominant lamp's light; your beam fills it | 0.392 → 0.705 |
| K10 | A moving Hound's shadow: in every lit, in-sight frame | 15 / 15 |
| K10 | Light changes on that Hound, all by hysteresis | 3 |
| K11 | Crossing beams with a scripted peer: deepest dip at their edge | 0.0013 (no seam) |
| K12 | Your body: lit side | 0.003 |
| K12 | Your body: self-shaded far side | 0.049 |
| K12 | Floor cast | 0.060 |

**A regression BR3 caught and fixed before the final run:**
- **K08** failed after the first clipping change: the beam added .426 behind the counter.
- **Cause:** the prop temp's box clip reset the world transform that had just been set, so that light's prop shadows were drawn in the wrong space.
- **Fix:** clip first, then set the transform.
- **Guard:** U25 now checks this. K08 passes as above.

## Gameplay freeze

`dev/br-role/evidence/br3/freeze_br.txt`:
- **228 / 230 parent files are byte-identical.**
- **Every protected file is identical:** `ai.js`, `sim.js`, `move.js`, `server.js`, `mp.js`, `death_srv.js`, `dphys.js`, `camera_policy.js`, `world.js`, `light.js`, `ents.js`, `camcorder.js`, `timing_policy.js`.
- **The two presentation edits** (`index.html`, `assets/index-DKbV5Nv9.js`) each undo to the v23.3.6 bytes exactly.

## Retained v23.3.6 suites

**Command:**
```
run_retained.py run --timeout-scale 3
```
The final tree was compared with `dev/shadows/evidence/sh0/retained-parent/retained.json`, the immutable parent run from SH0.

**Files:**
- `retained_br3.json` and `retained_compare.txt`;
- `log_identity.txt`;
- the diagnostic rerun: `retained_diag.json` and `retained_diag_compare.txt`.

| suite | parent | 1.0 | same failing set | log vs parent |
|---|---|---|---|---|
| server-boot | PASS 1/1 | PASS 1/1 | yes | PASS/FAIL lines identical |
| npm-test | FAIL 151/162 | FAIL 151/162 | yes | PASS/FAIL lines identical (162 lines) |
| humanqa | PASS 6/6 | FAIL 5/6 | **X03**, see below | |
| entity-look | PASS 4/4 | PASS 4/4 | yes | identical except timings |
| camera | PASS 12/12 | PASS 12/12 | yes | **byte-identical** |
| fps | PASS 10/10 | PASS 10/10 | yes | **byte-identical** |
| physics | PASS 53/53 | PASS 53/53 | yes | **byte-identical** |
| interpolation | PASS 3/3 | PASS 3/3 | yes | **byte-identical** |
| live | PASS 17/17 | PASS 17/17 | yes | PASS/FAIL lines identical |
| audit-net | PASS 17/17 | PASS 17/17 | yes | PASS/FAIL lines identical |
| audit-net2 | PASS 11/11 | PASS 11/11 | yes | PASS/FAIL lines identical |
| ir-net | PASS 4/4 | PASS 4/4 | yes | **byte-identical** |
| browser-move | PASS 14/14 | PASS 14/14 | yes | **byte-identical** |
| browser-play | FAIL 0/1 | FAIL 0/1 | yes | |
| browser-light | FAIL 13/15 | FAIL 13/15 | yes (the same two) | |
| browser-ir | PASS 1/1 | first run: no verdict. **Rerun: PASS 1/1** | rerun: yes | known flake, below |
| browser-admin | FAIL 54/56 | first run: FAIL 52/56. **Rerun: FAIL 54/56** | rerun: yes (T8, T10) | known flake, below |
| browser-lifecycle | PASS 1/1 | PASS 1/1 | yes | |
| browser-smiler2d | PASS 2/2 | PASS 2/2 | yes | PASS/FAIL lines identical |
| browser-chase | FAIL 0/1 | FAIL 0/1 | yes | |
| browser-nav | FAIL 0/1 | FAIL 0/1 | yes | |

**The parent's own failures are reproduced exactly.** These are:
- npm-test's 11;
- browser-light's frame-timing "shade pop" and 404s;
- the 404 page errors in browser-play, chase and nav;
- browser-admin's T8 and T10.

**The suites that decide gameplay reproduce the parent:**

| area | suites |
|---|---|
| movement and physics | camera, fps, physics, interpolation, browser-move |
| AI | npm-test, entity-look, browser-smiler2d |
| networking | live, audit-net, audit-net2, ir-net |

Six of those logs are byte-identical to the parent's.

### Known historical flakes (documented, not rerun again)

The finalization pack says to document these, not rerun them endlessly. Each had **one** diagnostic rerun.

**browser-ir: the first run ended without a verdict.**
- **What happened:** `ZeroDivisionError` in `dev/tests/ir_test.py` line 99. `waitGame` measured 0 game-seconds, because the page drew no frame within the wait under software rendering.
- **Precedent:** SH6's main run hit exactly this. It is recorded in `2D_SHADOWS_TEST_SUMMARY.md`, together with this suite's R5 / R7 frame-timing sensitivity, which the **unmodified parent** also shows when slowed down.
- **Rerun:** PASS 1/1, the same as the parent.

**browser-admin: T5 "hound A" ×2 on the first run.**
- **What happened:** a death preview did not start within the suite's 9 s window.
- **Precedent:** this is the T5 / T6 cascade documented at SH4 and SH6. It happened on the parent too: SH6's `parent-1` had 14 extra failures.
- **Rerun:** FAIL 54/56 with only the parent's own T8 and T10, so **the baseline is reproduced exactly**.

**K10 (BR-RoLE smoke): the Hound can wander out of view before 5 samples.**
- **What happened:** its AI is live, so it can leave the beam before enough frames are sampled.
- **Fix:** the check now walks back to it. This is a harness fix only; BR-RoLE is unchanged.

### humanqa X03: a static text check of the approved seam (not a behaviour change)

**What X03 checks:** it reads the bundle's source text for the line `if(e&&!f.nv){_(0,Math.PI*2,this.death.active?150:52,…)`. That line is the local hand aura: shown only while the light is on, not on night vision, and 150 px as the death torch.

**Why it fails here:**
- BR0 locked a seam, and BR1 (`f9d67b2`) shipped it. It guards that line as `if(!BR&&e&&!f.nv){…}`.
- So when BR-RoLE is off, the game runs it exactly as v23.3.6 does. When BR-RoLE is on, BR-RoLE draws the same aura itself.
- The literal substring X03 looks for therefore no longer appears. The bundle has carried this text since BR1; BR3 did not change it.
- The retained suites were not run during BR1–BR2.1, by policy, so this is the first run where it shows.

**Why it is not a behaviour change:**
1. **The freeze:** undoing the seam gives the v23.3.6 bundle byte for byte, and X03 passes on that bundle (the parent's run: humanqa 6/6).
2. **The behaviour under BR-RoLE:** new unit check U32 confirms it: the aura at 52 px / .35 only with the light on; none when off or on the camcorder; 150 px / .73 as the death torch; none for dead, switched-off or camcorder peers.
3. **X03's other four assertions still pass:** DEAD on the hover, and the peer aura only while on.

**Not changed:** the retained test, and the bundle text. Rewriting the seam only to satisfy a substring would be a change made for the test, not for the game.

**For you:** this is listed for human QA (question 7: gameplay feels exactly as before).

## Reproduce

```
node dev/br-role/test_br_role.js
node dev/br-role/smoke.js --game .
python3 dev/br-role/freeze_br.py --dir .
python3 dev/shadows/run_retained.py run --game . --out OUT --timeout-scale 3
python3 dev/shadows/run_retained.py compare --base dev/shadows/evidence/sh0/retained-parent/retained.json --cand OUT/retained.json
```
