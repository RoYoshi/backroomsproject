# BR-RoLE BR2: human QA

**Status: accepted by the user** (the BR-RoLE 1.0 finish pack records BR2 as the accepted parent). BR2.1 polishes it: see
`BR_ROLE_BR2_1_HUMAN_QA.md`. This page is kept as the BR2 record.

This is BR2 (shadow, softness and multiplayer fidelity), built on top of the BR1.1 lighting you approved. I have not marked anything PASS. BR3 does not start until you approve BR2 visually.

- **Branch:** `br-role`. Parent: BR1.1 `4e3582e`, approved by you. Gameplay lineage: v23.3.6 `f2805bb`. `main` is untouched.
- **Internal checkpoints:** BR2A `3961350`, BR2B `ce25bc8` and BR2C `5408f7b`, each pushed and verified on GitHub. This candidate is the commit on top of them.
- **To start:** run `node server.js`, or `run_linux.sh` / `run_windows.bat`, as usual.
- **Version check:** the lighting module reports `br-role BR2`. Admin DEBUG MODE shows its counters, including prop casters and actor shadows.

## BR1.1 is unchanged underneath

**LIGHT FIELD → BLOCKER → CAST SHADOW → ADD SURVIVING LIGHTS.** Each light still lays down its own smooth field. Blockers cast shadows from that light's own source points, and the lights are added.

BR2 only adds **new blockers** to that same model:
- props;
- you, other players and Hounds.

It also refines the sampling and the colour mixing.

**Not changed:**
- no visibility polygons;
- no second shadow compositor;
- the legacy renderer stays off;
- the line-of-sight mask (the black areas behind walls from your own view) is untouched, as you instructed.

## What BR2 adds

| | what you should see |
|---|---|
| **Prop shadows** (BR2A) | **Large props cast real shadows from each light:** counters, the toppled shelf, the low walls, the machine, the table, the bench and the window sills. A prop is treated as a box. From each point of a light, its shadow is its base plus its top projected away from that point. A fluorescent tube therefore gives a soft shadow that widens away from the prop; a flashlight gives a crisper and longer one, because it is held low. **The prop's own top stays lit.** The see-through railing and the wall holes cast nothing. |
| **Fill and blocking** | A shadow belongs to its own light. **If a lamp is blocked by a counter but your beam reaches the spot, your beam lights it.** **If the same counter blocks both the lamp and your beam, both are gone behind it.** |
| **Your shadow** (BR2B) | One soft shadow from **the light that actually reaches you most**. "Most" counts falloff, beam, walls and props, not just distance. The shadow starts at the edge of your body (the art keeps its contact shadow), points away from that light, and gets longer the farther you are from it. Under a lamp it fades out. **It only removes that light's contribution**, so another light fills it. |
| **Hound shadows** | The same rule for every Hound you can see. Shine your flashlight on one and its shadow is cut out of your beam behind it. The shadow follows the Hound's heading and length, and is bounded (≤ 140 px). It is presentation only: AI, collision and behaviour are untouched. |
| **No flipping** | The dominant light only changes when another light is clearly stronger: 35 % + .02 stronger. The change cross-fades over about a quarter second. Walking between two equal lamps never flips your shadow back and forth. |
| **Smilers** | **Nothing, ever:** no body shadow, no contact shadow, no silhouette shadow. Their face and glow are unchanged. |
| **Hidden actors** | A Hound or player you cannot see casts no shadow, so nothing leaks around corners. |
| **Fluorescent softness** (BR2C) | The tube umbra and penumbra are as in BR1.1. **LOW now samples 16 tube points (was 8)**, which removes the faint banding in its penumbrae. **HIGH samples 32 (was 24)**. MEDIUM is unchanged. |
| **Beam shadow edges** | A beam's shadow edge now softens smoothly: 4 points across the hand at MEDIUM and 6 at HIGH, where it was 2 and 3 steps. LOW stays one crisp point. |
| **Lantern** | Its shadows no longer wobble when you turn. Its flame flicker is unchanged. |
| **Other players' lights** | They cast prop shadows too, fill other lights' shadows, and count when choosing an actor's dominant light. They stay within tier budgets. |
| **Crossing beams** | Purely additive: no seam and no cancellation. The beam colours **average** where they overlap, instead of one painting over the other. The colour film cannot stack into saturation. A single light's tint is exactly BR1.1's. |
| **Gone** | BR1.1's leftover dark "blob" shadows under entities. Actor shadows now remove light from one light; they are not paint. |

## Quality (SETTINGS ▸ CUSTOMIZE ▸ LIGHTING, or `?lighting=low|medium|high`)

| tier | light buffer | lamps | other players' lights | tube points | hand points | prop casters (per light / per frame) | actor shadows |
|---|---|---|---|---|---|---|---|
| LOW (touch devices, small screens) | ½ screen | 8 | 1 | 16 | 1 | 4 / 16 | the dominant one only |
| MEDIUM (desktop default) | ¾ screen | 10 | 3 | 16 | 4 | 8 / 48 | the dominant one only |
| HIGH | full screen | 14 | 6 | 32 | 6 | 12 / 96 | the dominant one + an optional faint second (≤ 45 %), when a second light matters |

**Same model at every tier.** The buffer follows the screen's CSS size, never the device-pixel ratio.

**Prop shadows from lamps cost nothing per frame.** They are built into each lamp's cached shadowed field once, when the lamp first comes near the screen, and that field is reused every frame.

**Per-frame costs:**
- **Actor shadows:** a lamp that shadows an actor costs one extra image copy per frame.
- **Carried lights:** each pays a few more shadow fills than in BR1.1.

**Not measured:** no benchmarks were run, by policy. This container renders in software and its timings say nothing about your PC or phone.

## What was checked before this handoff (quick checks only, by policy)

- **Module load and syntax:** `assets/br-role.js`, the bundle (as an ES module) and the dev tools. **Unchanged since BR1.1:** the bundle and `index.html`.
- **25 / 25 focused unit checks** (`dev/br-role/test_br_role.js`, run on the real map and the bundle's own ray query). The BR2 checks:
  - the 11 casters, excluding the railing and the holes;
  - the counter's shadow cast from all 16 tube points of lamp 31. Each is exactly the hull of the base and of the top projected away from that point (× 70 / 110). It uses the same winding as the walls, and the counter's top is cut back out;
  - **behind the counter both lamps give 0 while your beam from the open side gives 0.133 (total 0.133)**. Your beam from the lamps' side gives 0 there, while it gives 0.514 before the counter. The counter's top still sees the lamp;
  - caps hold with 40 extra props and 8 players;
  - **your shadow is cut out of lamp 4 only**, turned exactly away from it;
  - with the nearest lamp walled off, the shadow follows the lamp that actually lights you;
  - **0 flips over 60 frames** of wandering between two equal lamps;
  - a Hound you see gets a shadow; a Smiler none; a Hound behind a wall none;
  - tiers;
  - tints sum order-independently, and one light is exactly BR1.1's tint;
  - the lantern ring does not turn;
  - a peer's flashlight casts the counter's shadow and fills a lamp shadow.
- **11 / 11 browser smoke checks** (`dev/br-role/smoke.js`), read from the screen's own pixels, on top of BR1.1's:
  - **K07:** behind the counter, lamp + beam = beam alone (0.329 = 0.329) and lamp alone = ambient (0.078);
  - **K08:** the same counter blocks lamp and beam: lamp + beam = beam alone = ambient (0.086), while the same beam gives 0.549 before the counter;
  - **K09:** your shadow takes 0.059 of light behind you (lamp 4 gives 0.305 there) and nothing in front. With your beam shining into it, it takes the same 0.059 while the floor rises 0.384 → 0.696, so the beam fills it;
  - **K10:** a Hound loose for 22 lit, in-sight frames had its shadow in all 22. All 5 light changes were by the hysteresis rule;
  - **K11:** a scripted second player's blue beam crossing yours: yours adds visibly on top of theirs. The deepest dip across their beam's edge is 0.0000, so no seam;
  - **K06:** a Smiler in view has no shadow.
- **Gameplay freeze** (`dev/br-role/freeze_br.py`):
  - 228 / 230 parent files are byte-identical;
  - every protected file is identical: `ai.js`, `sim.js`, `move.js`, `server.js`, `mp.js`, `death_srv.js`, `dphys.js`, `camera_policy.js`, `world.js`, `light.js`, `ents.js`, `camcorder.js`, `timing_policy.js`;
  - each of the two presentation edits undoes to the v23.3.6 bytes exactly.
- **One launch check.**
- **Not run, by policy:** the retained suites, screenshot matrices, benchmarks.

**Evidence** (`dev/br-role/evidence/br2/`):
- the unit, browser and freeze logs;
- the checkpoint list;
- five captures, all brightened ×3 for the eye, because software rendering is very dark:
  - `br2-props-counter`: legacy | MEDIUM lamps | MEDIUM + your beam from the open side | your beam from the lamps' side;
  - `br2-player-shadow-off-on`;
  - `br2-hound-shadow-off-on`: a Hound in your beam;
  - `br2-crossing-legacy-low-medium-high`;
  - `br2-penumbra-low-medium-high`.

## Tour (about 12 minutes, at MEDIUM)

| # | where | what to do | what to look at |
|---|---|---|---|
| 1 | **YELLOW HALL** spawn | walk around under the lamps, flashlight off | BR1.1 still intact: soft tube shadows behind the partition; **your own soft shadow**, pointing away from the lamp you're nearest to and lit by. It shortens as you walk under a lamp |
| 2 | between two lamps there | walk back and forth slowly | your shadow does not flip between them; when it changes lamp it cross-fades |
| 3 | **HUMMING ROOMS** counter (north-centre) | flashlight off, then walk around the counter | **the counter's shadow from the two lamps above it**: soft, widening, on the side away from them; the counter top stays lit |
| 4 | same counter, from the south | flashlight on, aimed north into its shadow | **your beam fills the lamp shadow**, and the counter casts your beam's own shadow behind it |
| 5 | same counter, from the north (between the lamps) | flashlight on, aimed south across it | **the same counter blocks both**: dark behind it |
| 6 | **REPEATING / SEGMENTED / DAMP / RED ROOMS, DEEP CARPET, BLACKOUT ZONE** | pass the shelf, low walls, bench, machine, table, window sills | natural, not noisy; nothing for the railing (ARCH GALLERY) or the wall holes |
| 7 | anywhere a Hound shows up | shine your light on it; watch it move, turn, lunge | its shadow away from your beam (or from the lamp that lights it), stable, no anatomy exaggeration; behaviour as before |
| 8 | anywhere a Smiler shows up | look at the floor around it | **no shadow of any kind** |
| 9 | with a second player | both lights on: cross beams, stand in each other's shadows, shine on each other | no seams; overlap brighter, not glaring; colours average; each of you casts a shadow from the other's beam |
| 10 | any lit room | SETTINGS ▸ LIGHTING: LOW, then HIGH | LOW coherent (crisp beam edges, smooth tube penumbrae); HIGH richer (faint second shadow near two strong lights) |
| 11 | ordinary play | play normally for a few minutes | any FPS hitch, especially when entering a new area or switching tiers (lamp fields are built then, a few per frame) |

## Questions

Please answer each one with yes / no / notes, and say which tier you were on.

1. Does BR1.1 still look intact (same light fields, same tube shadows, same mixing)?
2. Do counters, shelves and the other large props cast natural shadows?
3. Does your flashlight fill a lamp's or a prop's shadow where it really reaches?
4. Does the same prop block both lights when both really are blocked?
5. Does your player shadow feel grounded, not noisy? Is it too faint, too strong, too long?
6. Does the Hound shadow look natural, and does the Hound behave exactly as before?
7. Do Smilers still have no shadow at all?
8. Is the fluorescent umbra/penumbra still natural (and LOW now smooth)?
9. Do crossing lights with another player have no seams, and do the colours mix well?
10. Are LOW / MEDIUM / HIGH all coherent?
11. Any FPS hitch in ordinary play (PC or phone)?
