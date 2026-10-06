# BR-RoLE BR2.1: human QA

**Status: `BR-RoLE BR2.1 HUMAN-QA CANDIDATE — WAITING FOR USER`**

BR2.1 is the shadow and actor-lighting polish on top of BR2, which you accepted. I have not marked anything PASS. **BR3 does not start** until you explicitly approve BR2.1.

- **Branch:** `br-role`. Parent: BR2 `2748ff6`. Internal checkpoints:
  - BR2.1A `7d702ee`;
  - BR2.1B `2cea032`;
  - BR2.1C `2441f4f`.

  Each was pushed and verified on GitHub; this candidate is the commit on top of them.
- **Lineage:** gameplay v23.3.6 `f2805bb`. `main` is untouched.
- **To start:** run `node server.js`, or `run_linux.sh` / `run_windows.bat`.
- **Version check:** the module reports `br-role BR2.1`. Admin DEBUG MODE shows these counters:
  - actor casts and draws;
  - actors self-shaded and self-shading draws;
  - prop shadow draws.

The model is unchanged: **LIGHT FIELD → BLOCKER → CAST SHADOW → ADD SURVIVING LIGHTS.** Every new effect below removes only its own light, so other lights still fill it. The line-of-sight mask is untouched.

## What changed

| | BR2 | BR2.1 |
|---|---|---|
| **Player self-shading** (what you asked to keep) | an accident: the cast shadow started *inside* the body | **intentional**: one soft gradient across the body **and both hands**, darker on the side away from your dominant light. It has no hard line, and the lit side is untouched. Strong when one light dominates, faint when lights are even: one crescent, never two. It cross-fades when the light changes |
| **Player cast shadow** | a soft blob, partly on the body | **on the floor only**. It is cut around the silhouette (body and hands), so it never stains you. It leaves from your far edge, darkest at the contact, tapering and fading to a rounded tip. It gets longer *and fainter* the farther the light is, short and darker close to it, and disappears right under it. Bounded at 84 px |
| **Hound** | a cast shadow | the same polished cast, plus a **restrained self-shading** of its torso (an ellipse along its heading), away from its light. Limbs and silhouette are unchanged. A shadow from your flashlight on it is eased, so your hand's bob or a step never jitters it. AI, collision and behaviour are untouched |
| **Smilers** | nothing | still **nothing**: no self-shading, no contact, cast or silhouette shadow |
| **Prop shadows** | uniform slabs out to their tip | **graded**: solid at the footprint (attached), fading toward the projected top's far end (height impression). The top stays lit. Lamp prop shadows are still built once and cached |
| **HIGH** | faint second cast | the same faint second cast, **without** a second self-shading |

**Performance discipline:**
- **Masks:** reusable textures (cast tongue, disc, shade), each built once and only rotated and scaled.
- **Pooled canvases:** one small canvas for the actor cut-outs, one for prop unions.
- **Still one dominant light per actor** (HIGH: + a faint second cast), and one self-shading pass per actor.
- **Prop gradients:** for lamps, they cost only at the cached build. For carried lights, only when a prop is actually in the beam.
- **Not added:** no blur, no normal maps, no per-light self-shading.
- **Kept:** the CSS-size buffer and the tier caps.
- **Not measured:** no benchmarks were run, by policy (that is BR3).

## What was checked before this handoff (quick checks only, by policy)

- **Module load and syntax:** `br-role.js`, the bundle (as an ES module) and the dev tools. **Unchanged since BR1.1:** the bundle and `index.html`.
- **30 / 30 focused unit checks.** The BR2.1 ones:
  - **your shadow and self-shading belong to lamp 4 only.** The cast is cut out to r 19.5 px (the body is 18), and turned exactly away from the lamp, as is the self-shading;
  - **3 self-shading draws: body + both hands**. The cast starts past your hands (24.9 px);
  - the Hound's torso self-shading runs exactly away from its light (strength 0.30); nothing at a Smiler;
  - **near a lamp the cast is 26 px at ×0.75; farther, 84 px at ×0.55**; nothing right under a lamp. HIGH's second cast has no self-shading;
  - **self-shading ×0.41 under one dominant lamp, ×0.18 between two even lamps**;
  - stepping 40 px turns a Hound's shadow from your beam by 0.11 of 0.32 rad in that frame (eased);
  - the counter's shadow from each of lamp 31's 16 tube points is graded and united with that point's walls;
  - **behind the counter your beam is fully gone at the footprint, then comes back gradually 0 → 0.35** toward the far end; the counter top stays lit.
- **12 / 12 browser smoke checks**, read from the screen's own pixels:
  - **K12 (new): your body's lit side changes by 0.003 (nothing). The far side darkens by 0.049** (lamp 4 gives 0.227 there). **The floor just past your edge darkens by 0.060** (the cast);
  - K09: behind you only that lamp's light goes, and your beam still fills it;
  - the BR2 checks still pass: prop fill and same-prop blocking, Hound hysteresis, Smiler, crossing beams with a second player.
- **Gameplay freeze:** OK. Every protected file is identical, and the two presentation edits undo to v23.3.6 exactly.
- **One launch check.**
- **Not run, by policy:** retained suites, matrices, benchmarks.

**Evidence** (`dev/br-role/evidence/br2_1/`):
- the logs;
- the checkpoint list;
- three captures, brightened ×3 for the eye:
  - `br2_1-player-self-shading-off-on`: you in two spots, actor effects off | on;
  - `br2_1-hound-off-on`: a Hound in your beam;
  - `br2_1-props-counter`: legacy | lamps | your beam fills | the same counter blocks your beam.

## Tour (about 10 minutes, at MEDIUM)

| # | where | what to look at |
|---|---|---|
| 1 | **YELLOW HALL**, walk around the lamps, flashlight off | **your body**: darker on the side away from the lamp, with the hands matching. Walk around a lamp and watch the gradient follow it smoothly. The **floor shadow** leaves from your far edge, tapers and fades, and never sits on you |
| 2 | walk toward a lamp, then under it, then away | the cast shortens and darkens as you approach, vanishes under the lamp, then grows longer and fainter as you leave |
| 3 | between two lamps | the self-shading goes faint (even light), never two crescents; no flipping |
| 4 | **HUMMING ROOMS** counter, flashlight off, then from the south with your beam aimed north | **the counter's shadow**: solid against the counter, fading toward its far end; the top lit; your beam filling it |
| 5 | any Hound: shine on it, let it move, turn and lunge | a subtle torso shading away from the light and a cast behind it; steady, no jitter; same behaviour as before |
| 6 | any Smiler | nothing on it or under it |
| 7 | with a second player | their avatar self-shaded too; crossing beams unchanged |
| 8 | SETTINGS ▸ LIGHTING: LOW, then HIGH | coherent at every tier; HIGH may add a faint second floor shadow only |

## Questions

Please answer each one with yes / no / notes, and say which tier you were on.

1. Does the player self-shading read as intentional lighting, not a stain? Is the strength right?
2. Do the hands feel coherent with the body?
3. Does the floor cast shadow stay off the body, taper and fade naturally?
4. Is the Hound's self-shading an improvement (or should it go)? Is its cast natural?
5. Are Smilers still free of any shading or shadow?
6. Do prop shadows feel attached to the footprint and the height, softer without being muddy?
7. Do LOW / MEDIUM / HIGH all look coherent?
8. Any FPS hitch in ordinary play?
9. Approve BR2.1 so BR3 (optimization, regression, 1.0 publication) can begin?
