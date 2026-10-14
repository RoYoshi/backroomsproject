# BR-RoLE BR1.1: human QA

**Status: approved by the user** ("this is amazing"; the BR2 pack records it as BR1.1 visual QA PASS). BR2 builds on it: see
`BR_ROLE_BR2_HUMAN_QA.md`. This page is kept as the BR1.1 record.

This is your BR-QA correction to BR1. I have not marked anything PASS, and BR2 does not start until you approve this visually.

- **Branch:** `br-role`, one commit on top of BR1 `f9d67b2`. Gameplay lineage v23.3.6 `f2805bb`.
- **To start:** run `node server.js`, or `run_linux.sh` / `run_windows.bat`, as usual.
- **Version check:** the lighting module reports `br-role BR1.1`. Admin DEBUG MODE shows its counters.

## What changed: LIGHT FIELD → BLOCKER → CAST SHADOW

BR1 drew each light clipped to its **visibility polygon**, so walls defined the visible shape of the light. That model is gone. Nothing is clipped any more. For each light, separately:

1. **The light field comes first.** Each light lays down its natural, unobstructed illumination:
   - a lamp: its radial falloff;
   - a flashlight or headlamp: its radial falloff times its smooth sideways profile;
   - a lantern: its round falloff;
   - plus the hand glow.
2. **Then the blockers cast shadows into that field.** Every wall side and pillar side that faces the light casts one shape: its two corners projected *away from that light*. A shadow is only the absence of *that* light behind the blocker.
3. **Then the lights are added.** One light's shadow removes only that light, so another light that reaches the spot still lights it.

| light | how it now behaves |
|---|---|
| **fluorescent lamps** | **Broad area sources.** Each shadow is cast from points spread over the whole 86 × 24 fixture and averaged (8 / 16 / 24 points at LOW / MEDIUM / HIGH). Where no part of the tube sees a spot you get an **umbra**. Where some of it does you get a **penumbra**, which **widens with distance from the blocker**. Wall corners give soft, fanned shadow edges, not a hard line. |
| **flashlight / headlamp** | **A smooth beam field** (near glow, sideways falloff, radial falloff). Walls and pillars cast shadows **inside the beam**, from the hand: one point at LOW (crisp), two or three across the hand at MEDIUM / HIGH (slightly softened edges). |
| **lantern** | A round field with its flame flicker. Shadows are cast from the flame. |
| **other players' lights** | The same model, for the nearest 1 / 3 / 6 (LOW / MEDIUM / HIGH). |

**Unchanged from BR1:**
- the ambient glow;
- lamp strength, flicker, dim fixtures, failures, blackout and NV gain (the game's own formula);
- the beam colour tint;
- the camcorder;
- grounding along walls;
- one soft shadow per creature (never for a Smiler);
- the quality tiers;
- the `?lighting=legacy` comparison switch;
- the fail-safe.

**Not in BR1.1 (that is BR2, after your approval):**
- prop shadows (counters, shelves…);
- player and Hound shadows from each light;
- same-prop blocking of several lights.

### One thing to look at on purpose: the black areas behind walls from *your* point of view

The pure-black areas behind walls and pillars, as seen from **your character**, are **not light shadows**. They are the game's own **line-of-sight mask**: what you cannot see, which also hides creatures behind walls. v23.3.6 draws it, and BR-RoLE does not touch it.

Its edges are still hard and still run from wall corners. In the captures it is the large black wedges, for example behind the pillar right next to you. If *this* is part of what you want changed, please say so in question 8 below. Softening it touches what players can see around corners, so I will not change it without your explicit go-ahead.

## Performance shape

- **Lamps per frame:** the per-frame cost dropped. Each lamp's shadowed field is built **once** per quality tier, when the lamp first comes near the screen, and is reused every frame at the lamp's current strength. Each frame, a lamp costs one image draw.
- **Lamp caches:** at most 24 / 32 / 40 are kept (LOW / MEDIUM / HIGH), least recently used dropped first.
- **Build budget:** builds are spread over frames, a few per frame. A lamp that had to wait fades in over about 12 frames instead of causing a hitch, so you may see this after a teleport or a quality change.
- **Carried lights:** each pays one or two extra shadow fills per frame.
- **Not measured:** no benchmarks were run, by policy. This container renders in software and its timings say nothing about your PC or phone, so please report what you see.

## Quality (SETTINGS ▸ CUSTOMIZE ▸ LIGHTING, or `?lighting=low|medium|high`)

| tier | light buffer | lamps | other players' lights | lamp tube points | hand points |
|---|---|---|---|---|---|
| LOW (touch devices and small screens by default) | ½ screen | 8 | 1 | 8 | 1 |
| MEDIUM (desktop default) | ¾ screen | 10 | 3 | 16 | 2 |
| HIGH | full screen | 14 | 6 | 24 | 3 |

**Same model at every tier.** Tiers differ only in resolution and in how finely the penumbrae are sampled. The buffer follows the screen's CSS size, never the device-pixel ratio.

## What was checked before this handoff (quick checks only, by policy)

- **Module load and syntax:** `assets/br-role.js`, and the bundle as an ES module. **Unchanged since BR1:** the bundle and `index.html`.
- **13 / 13 focused unit checks** (`dev/br-role/test_br_role.js`), run on the real map and the bundle's own ray query. They include:
  - **nothing is ever clipped**: no visibility polygon anywhere;
  - **lamp: field first, unclipped, then shadows.** Every shadow shape is cast from a point on the spawn lamp's tube (16 points, spread 75 px). Each is anchored on a wall or pillar side that faces that point, with its far side projected beyond the light's reach;
  - **flashlight: field and angular profile first, then shadows from the hand, inside the beam only**, at all three tiers;
  - **area source:** behind the partition by the spawn lamp there is an umbra, and a penumbra with 15 distinct levels. The penumbra widens away from the blocker: an arc of 71 px at 140 px from the lamp, 223 px at 300 px;
  - the game's lamp formula, exact;
  - blackout;
  - tiers independent of DPR;
  - camcorder;
  - read-only, no network;
  - fail-safe and DEV switch;
  - the seam;
  - no NaN.
- **6 / 6 browser smoke checks** (`dev/br-role/smoke.js`). They read mixed light from the screen's own pixels at the QA01 spot:
  - **in the lamp's umbra, lamp + beam = beam alone (0.458 = 0.458)**;
  - **where both reach, they add**: 0.584 measured, 0.586 predicted;
  - the client sends the same messages as with the old lighting;
  - a Smiler gets no shadow.
- **Gameplay freeze** (`dev/br-role/freeze_br.py`):
  - 228 / 230 parent files are byte-identical;
  - every protected file is identical: `ai.js`, `sim.js`, `move.js`, `server.js`, `mp.js`, `death_srv.js`, `dphys.js`, `camera_policy.js`, `world.js`, `light.js`, `ents.js`, `camcorder.js`, `timing_policy.js`;
  - each of the two presentation edits undoes to the v23.3.6 bytes exactly.
- **One launch check.**
- **Not run, by policy:** retained suites, screenshot matrices, benchmarks.

**Evidence** (`dev/br-role/evidence/br1_1/`):
- unit, browser and freeze logs;
- side-by-side captures (legacy | LOW | MEDIUM | HIGH) at the QA01 spot, the QA02 corridor corners and the Pillar Hall;
- two full-size MEDIUM captures.

All captures are multiplied by 3 for the eye only, because software rendering is very dark.

## Tour (about 10 minutes, at MEDIUM)

| # | where | what to do | what to look at |
|---|---|---|---|
| 1 | **YELLOW HALL** spawn, flashlight off | look at the partition beside the spawn lamp | **a soft cast shadow behind the partition**: dark close behind it (umbra), widening grey edges further away (penumbra). No hard wedge |
| 2 | the corridor corners south-west of the spawn | walk past the wall corners near lamps | shadow edges fan out from the corners and soften with distance. No giant hard-edged lit/dark polygons from the lamps |
| 3 | south-east of the spawn lamp, by the partition corner | flashlight on, sweep across the lamp's shadow | **the beam lights the lamp-shadowed floor naturally** |
| 4 | anywhere | sweep the beam slowly past wall ends and door frames | a smooth beam; walls cast shadows *within* it, starting at the corners |
| 5 | **PILLAR HALL** | flashlight off, then on, and walk among the pillars | soft pillar shadows from the lamps; crisper ones from your beam, each light on its own |
| 6 | **DAMP ROOMS**, the flickering light | flashlight off, then on | the flicker, and its shadows flickering with it |
| 7 | any lit room | admin WORLD ▸ LIGHTS ▸ BLACKOUT ON, then AUTO | lamps go and come back; your light stays |
| 8 | CUSTOMIZE ▸ light source | try the headlamp and the lantern | the shapes, colour and flame flicker; their shadows |
| 9 | with a second player | both lights on; stand in each other's shadows | one light system; your light lights the other light's shadow |
| 10 | anywhere | SETTINGS ▸ LIGHTING: LOW, then HIGH | LOW is softer and coarser; HIGH has smoother penumbrae. The same look |

## Questions

Please answer each one with yes / no / notes, and say which tier you were on.

1. Do lamps now read as **light fields with shadows cast into them**, rather than light polygons?
2. Do the fluorescent shadows have a believable **umbra / penumbra** that widens away from walls and pillars?
3. Does your flashlight read as **one smooth beam** with walls and pillars casting shadows **inside** it?
4. In a lamp's shadow, does your beam (or another player's light) light the floor naturally?
5. Any leaks (light through walls), seams, or wrong-way shadows?
6. Are flicker, failing lights and blackout right?
7. Are LOW / MEDIUM / HIGH all coherent?
8. The **line-of-sight mask** (the black areas behind walls from your own view, unchanged since v23.3.6): keep it as it is, or include it in a later stage?
9. Does the game still feel like the accepted v23.3.6 gameplay?
10. Any frame-rate trouble on your PC or phone, including when you first walk into a new area or change the quality setting?
