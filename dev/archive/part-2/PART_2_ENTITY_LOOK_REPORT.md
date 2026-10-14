# The Far Backrooms — Part 2 Entity Look / Head Presentation Pass

**Build:** `v23.3.4-hqa-entity-look`  
**Base:** `v23.3.3-hqa-fps`

## Goal

Make Hounds read more like animals instead of tanks while preserving their AI/perception rules, and give Smilers a simple uncanny face-orientation treatment without inventing anatomy.

## Hound

- Added a **presentation-only look angle** (`lh`) separate from the existing sensory head angle (`h`).
- `h` remains the value used by AI vision/FOV. The new `lh` does **not** alter perception, targeting, movement, chase speed, turn speed, or combat.
- The rendered head now looks toward evidence the Hound legitimately owns:
  - current sampled visual evidence;
  - remembered last-known target position;
  - an anonymous light-investigation point;
  - the active search goal.
- The visual neck is bounded to about **±1.18 rad (~68°)** from body heading. A target farther behind makes the head reach its limit while the body must turn to follow.
- Client interpolation smooths the head direction so 20 Hz network snapshots do not create jerky head snapping.
- Existing idle/listen/sniff head motion remains and acts as the fallback when there is no attended evidence.
- A small head-position offset accompanies stronger side looks so the skull/neck connection reads less like a rigid rotating decal.

### Important architecture rule

**Visual attention is not a new sense.**

The server never uses `lh` for perception. The Hound cannot visually point at a live hidden player's true coordinates. When a target is hidden, the presentation can only look toward remembered evidence already in the Hound's memory.

## Smiler

- Added a separate presentation-only face aim (`lh`).
- No neck, torso, or other anatomy was added.
- The visible face rotates toward the evidence/goal the Smiler is already attending to.
- Rotation is smoothed client-side rather than snapping with network updates.
- The independent face-glow rendering now applies the same face rotation, so the glowing eyes/teeth stay aligned with the painted face.
- Existing body/world heading and Smiler AI remain unchanged.

## Gameplay preserved

This pass does **not** change:

- Hound chase speed, acceleration, normal body turn rate, close-range anti-orbit behavior, eye-contact rules, lunges, capture, navigation, or senses;
- Smiler gaze counterplay, light escalation, attack triggers, movement speeds, search, targeting, or senses;
- FPS equality or camera fairness;
- death physics;
- Stage 2F evidence/memory/RNG architecture.

No new AI RNG calls were added.

## Files changed from v23.3.3

- `dev/ai_src/50_hound.js`
- `dev/ai_src/60_smiler.js`
- `dev/ents_src/00_head.js`
- `dev/ents_src/10_hound.js`
- `dev/ents_src/20_smiler.js`
- rebuilt `ai.js`
- rebuilt `ents.js`
- `dev/tests/s_entity_look.js` (new)
- `package.json`
- this report

## Verification

### New targeted entity-look suite

**4/4 PASS**

- Hound visual head tracks current legitimate visual evidence while the sensory head value stays unchanged.
- Hound visual head uses remembered evidence and does not follow a live hidden player's relocated body.
- Hound neck look is bounded at ±1.18 rad.
- Smiler face aim follows perceived/remembered evidence and does not follow live hidden coordinates.

### Existing targeted regression

- Hound 2E/HQA: **18/18 PASS**
- HQA hotfix suite: **4/4 PASS**
- Camera fairness: **12/12 PASS**
- FPS equality: **PASS** at 30/60/120/144/240/360 FPS, jitter, and 15 FPS catch-up.
- Shared 2F: all behavior tests through F21 and F23 observed PASS; **F22 remains the expected exact-source-hash preservation failure after intentional source changes**.
- Evidence: **10/10 PASS**.
- IR: **3/3 PASS**.
- Smiler: **16/17**, with historical statistical `SM01` still the only observed failure in that run (6/8 vs required sample threshold); no Smiler behavior rule was changed by this presentation pass.
- Server boot smoke test: PASS.

A broad aggregate run was started and reached the known historical P01/P07/H07 assertions before the execution window expired. Those are pre-existing statistical/state-coverage assertions and are not related to this presentation-only change.

## Human visual QA requested

1. Watch a Hound approach while its body is still turning: its head should acquire you first, then the body should follow.
2. Move across a Hound's front/side during pursuit: the head should track naturally without twisting beyond a believable range.
3. Lose the Hound around a corner: it may keep looking toward the last legitimate location, but must not visually track your hidden movement.
4. Watch a listening/searching Hound: the existing scans should still look organic.
5. Watch a Smiler during lateral drift/search: the face should rotate smoothly without suggesting a visible neck/body.
6. Confirm Smiler glow remains exactly aligned with its eyes/teeth while the face rotates.

**Status:** engineering-ready visual polish candidate; Part 2 still requires final human visual approval before lock.
