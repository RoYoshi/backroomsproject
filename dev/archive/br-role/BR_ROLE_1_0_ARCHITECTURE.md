# BR-RoLE 1.0: architecture

**BR-RoLE (Backrooms Rendering of Lighting Engine)** is THE FAR BACKROOMS' production lighting and shadow renderer.

- **Where it lives:** one client-side module, `assets/br-role.js`.
- **What it is:** presentation only. It reads game state and never writes it. It sends nothing over the network, and nothing on the server can reach it.

## The law

> **LIGHT FIELD → BLOCKER → CAST SHADOW → ADD SURVIVING LIGHTS**

Every light is composed on its own, in four steps:

1. **Field.** The light lays down its natural, unobstructed field. Nothing clips it to a shape:
   - a fluorescent lamp: the game's radial falloff;
   - a flashlight or headlamp: radial falloff × a smooth angular profile;
   - a lantern: a round field with flame flicker;
   - the hand glow.
2. **Blockers.** Blockers cast shadows into *that* field, from the light's own source points:
   - **Walls and pillars:** every side facing the point casts the polygon of its two corners projected away from it. All of them go into one path with one winding, filled once, nonzero, so the union has no seams.
   - **Selected props** (counters, the shelf, low walls, the machine, the table, the bench, window sills): each casts the hull of its base and its top projected away from the point. The top is cut back out (opposite winding, so it stays lit). The shadow is graded: solid at the footprint, fading toward the projected top's far end.
   - **Actors:** the local player, other players and Hounds the local player can see. Each blocks its **dominant light only** (see below).
3. **Area sources.** A fluorescent tube is an area source. Its shadows are cast from 16 / 16 / 32 points over the 86 × 24 fixture (LOW / MEDIUM / HIGH) and averaged. That gives an **umbra** where no point sees, and a **penumbra** that widens away from the blocker. A carried light is cast from 1 / 4 / 6 points across the hand.
4. **Add.** The surviving light is **added** (`lighter`) into one light buffer. A shadow removes only its own light, so another light that reaches the spot lights it, and the same prop blocks every light that is really behind it.
5. **Into the overlay.** The game's darkness overlay (`#light`) loses exactly the accumulated light (`destination-out`), inside the game's own line-of-sight clip. Carried lights then lay their colour tint on top. The tints are summed, so crossing colours average, and they are bounded.

## Lamps: static, cached

A lamp's shadowed field (walls, pillars, props from every tube point) is built **once per tier**, the first time the lamp nears the screen:
- **Size:** at a fraction of world resolution (.3 / .45 / .6 px per px).
- **Blur:** lightly blurred where the browser has canvas filters.

Each frame the lamp costs **one image draw**, at its current strength: the game's formula, flicker, failing fixtures, NV gain and blackout.

- **Build budget:** a few builds per frame (2 / 3 / 4, and about 6 ms). A lamp that had to wait fades in over 12 frames.
- **Cache:** least-recently-used, capped at 24 / 32 / 40.

## Actors (BR2B / BR2.1)

**Dominant light** is the light whose **unblocked contribution** at the actor is largest: falloff, beam profile, walls, pillars and props, with lamps sampled from three tube points.
- **Hysteresis:** a new light must beat the current one by 35 % + .02.
- **Easing:** weights ease per frame, so a change cross-fades.
- **HIGH:** adds a faint second cast (45 %) when a second light matters, but no second self-shading.

Both actor effects are **that light's contribution taken away** in that light's scratch, before it is added:
- **Cast shadow (floor):** a reusable tapered tongue texture, built in a small pooled canvas.
  - The silhouette is cut out of it: the body plus both hands (read from the avatar), or a Hound's torso. It never stains the body.
  - It is darkest at the contact and fades to a rounded tip.
  - It grows longer and fainter with the distance to the light (bounded: 84 / 140 px), and disappears under a light.
- **Self-shading (body):** one soft gradient disc per body part, rotated and scaled so its gradient runs away from the light. A Hound's torso gets an ellipse along its heading.
  - Strength follows the light's contrast: full when one light dominates, 30 % when lights are even.
  - One pass per actor.
- **Smilers:** never anything.
- **Actors you cannot see:** never anything, so no information leaks through a shadow.
- **Carried-light direction:** eased, so a hand's bob never jitters a shadow.

## Budgets (per tier)

| | LOW | MEDIUM | HIGH |
|---|---|---|---|
| light buffer (× CSS viewport, never × DPR) | ½ | ¾ | 1 |
| lamps drawn | 8 | 10 | 14 |
| other players' lights | 1 | 3 | 6 |
| tube points / hand points | 16 / 1 | 16 / 4 | 32 / 6 |
| lamp-field cache | 24 | 32 | 40 |
| lamp builds per frame | 2 | 3 | 4 |
| prop casters per light / per frame | 4 / 16 | 8 / 48 | 12 / 96 |
| actors shaded | 6 | 12 | 20 |
| second actor cast | no | no | yes (no second self-shading) |

**Culling (BR3):**
- a beam works in its sector's box, not its circle;
- every shadow fill stays inside its light's own pixel box. That is an axis-aligned clip, never a visibility shape.

## Seam with the game

`assets/index-DKbV5Nv9.js` has **one guarded hook** in `drawLight` / `drawPeers`. If `window.__brRole.on()`, the game skips its own ambient, lamps and carried-light cut-outs and calls `__brRole.draw()`.

**What the game still draws:**
- the line-of-sight blackout;
- the camcorder's infrared;
- the vignette;
- death effects;
- Smiler faces.

**Fallbacks:**
- **If anything throws:** BR-RoLE switches itself off and the game draws v23.3.6.
- **DEV comparison:** `?lighting=legacy`.

**Not involved:** gameplay light truth (`ai.js`, `light.js` `__light`, the bundle's `Ul()`) never reads the overlay.

## Debug

Admin DEBUG MODE shows BR-RoLE's counters:
- lamps (drawn / cached / builds);
- carried lights;
- shadow sides;
- prop casters and draws;
- actor casts and draws;
- actors self-shaded and self-shading draws;
- frame time.

`window.__brRole.stats()` returns them all, including the frame time's p95. `probe(x, y)` gives each light's contribution at a point; `actors()` lists this frame's actor shadows.
