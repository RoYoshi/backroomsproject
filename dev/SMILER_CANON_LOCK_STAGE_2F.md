# THE FAR BACKROOMS — SMILER CANON / BEHAVIOR LOCK
## Reconstructed project authority for Stage 2F

**Status:** Use this as the Smiler preservation authority for Stage 2F.  
**Provenance:** Reconstructed strictly from the approved Stage 2D implementation report and its canon-mapping table.  
**Important:** This is a project lock, not a fresh independent lore rewrite. Where the Stage 2D report labels something as gameplay inference, keep it as gameplay inference.

---

## Classification labels

Use these labels consistently:

- **CONFIRMED CANON** — explicitly identified as canon in the approved Stage 2D report.
- **GAMEPLAY INFERENCE** — implementation used to translate that canon into the game.
- **PROJECT LOCK** — behavior already approved for The Far Backrooms and frozen for Stage 2F.
- **UNKNOWN / DO NOT INVENT** — not established by the approved Stage 2D report.

Stage 2F must preserve species identity. It may change shared evidence infrastructure underneath the Smiler, but must not reinterpret the Smiler itself.

---

# 1. Core identity

### CONFIRMED CANON
From the approved Stage 2D canon mapping:

- Smilers **reside in dark areas**.
- Smilers are **attracted to light**.
- Smilers **will chase anything they see with a light**.
- Smilers **only attack if you panic and retreat, or a loud noise is made**.
- Counterplay is to **keep eye contact and move away slowly**.
- Their confirmed visible presentation is **eyes and teeth gleaming**; the body remains unconfirmed in this project continuity.

### PROJECT LOCK
The Smiler is not a Hound variant.

Its gameplay identity is:

- darkness-associated
- light-reactive
- watchful
- agitation-based
- countered by sustained eye contact / controlled retreat
- capable of uncertainty and losing the player
- visually represented as a face rather than an invented body

Do not replace this with generic chase AI.

---

# 2. Darkness

### CONFIRMED CANON
- Smilers reside in dark areas.

### GAMEPLAY INFERENCE / PROJECT LOCK
- A Smiler waits/lurks in darkness.
- When restless, it may move to another dark location.
- It must physically move through the world.
- It does **not** teleport or vanish as a locomotion shortcut.
- In the approved implementation, "dark spot" is based on the fixed/world light field rather than treating any player's flashlight as a permanent world-darkness redefinition.

### DO NOT INVENT
Do not add:
- teleportation
- phase movement
- supernatural despawning
- hidden repositioning directly behind a player using true player coordinates

---

# 3. Visible light

### CONFIRMED CANON
- Smilers are attracted to light.
- They will chase something they see carrying a light.

### GAMEPLAY INFERENCE / PROJECT LOCK
The approved Stage 2D distinction is:

## Light seen without an identified person
- Creates an **anonymous uncertain lead**.
- The Smiler may orient, investigate the observed area, search nearby openings, be wrong, and eventually give up.
- It must not back-project the observation to the hidden carrier's exact position.

## Visible light carrier
- Builds Smiler agitation.
- Past the approved threshold/wind-up, pursuit begins.
- In the approved Stage 2D implementation there is a reaction wind-up rather than a zero-frame instant chase.

## Beam directly into / across the Smiler
- Produces a sharper agitation response.
- Still must obey actual line of sight / beam geometry.

### PHYSICALITY LOCK
Walls stop visible-light evidence.

Turning a visible light off stops **new** light evidence but does not retroactively erase legitimate memory.

---

# 4. Attack trigger

### CONFIRMED CANON
The approved Stage 2D report maps the attack rule to:

- attack if the player **panics and retreats**
- or if a **loud noise** is made

### GAMEPLAY INFERENCE / PROJECT LOCK
- Fast retreat in front of the Smiler can qualify as panic.
- A loud nearby sound can qualify as an attack trigger.
- The approved implementation allows an ordinary close step to count when the Smiler is already highly agitated.
- A crouched shuffle does not count the same way.

### DO NOT INVENT
Do not turn the Smiler into:
- a proximity damage aura
- an always-hostile melee chaser
- a monster that attacks simply because the player exists nearby

---

# 5. Eye contact / controlled retreat

### CONFIRMED CANON
- Keep eye contact.
- Move away slowly.

### GAMEPLAY INFERENCE / PROJECT LOCK
The approved implementation requires:

- line of sight
- player facing the Smiler
- enough visibility to make the Smiler out
- sustained contact rather than a single-frame glance

The approved Stage 2D timing was:

- approximately 0.4 s for eye contact to take hold
- approximately 0.3 s tolerated lapse

These are **project tuning**, not canon facts.

### COUNTERPLAY RULE
Eye contact is counterplay, **not immunity**.

A player standing still and staring forever should not gain ownership of the encounter.

The approved behavior allows the Smiler to:
- creep closer
- drift sideways
- force the player to keep re-acquiring / re-aiming

Backing away slowly while maintaining eye contact can produce release.

### PROJECT PRESERVATION
Stage 2F must not:
- change the eye-contact thresholds/timing
- remove the counterplay
- convert it into permanent stun
- make it work through walls

---

# 6. Presentation / anatomy

### CONFIRMED CANON
The Stage 2D report identifies the visible canon as:

- **eyes and teeth gleaming**
- body unconfirmed

### PROJECT LOCK
Normal Smiler rendering shows the face only.

Do not invent:
- arms
- legs
- torso
- locomotor anatomy
- a full body silhouette
- extra facial anatomy

The face glow is a separate presentation/render channel and must not be conflated with general scene brightness or AI sensory knowledge.

---

# 7. Hidden-position knowledge

### PROJECT LOCK
The approved Stage 2D implementation removed hidden-position reads.

Smiler reasoning may use:
- current legitimate sight
- last legitimate sighting
- visible-light observations
- recent legitimate sound evidence
- remembered evidence
- uncertainty

It may **not** use:
- current hidden player coordinates
- hidden player velocity
- a secret glance at another player's true position
- hidden flashlight carrier location
- through-wall knowledge

### SYSTEM-LEVEL EXCEPTIONS
The approved report retains non-sensory system rules such as:
- simulation-detail/LOD parking
- spawn safety
- actual physical contact/capture range

These are not perception.

---

# 8. Lost targets / uncertainty

### PROJECT LOCK
When the Smiler loses a person:

- go to the last legitimate known area
- uncertainty grows with time
- inspect a limited number of plausible openings
- may choose incorrectly
- may conclude the hypothesis failed
- eventually withdraw / give up

A hidden player moved elsewhere must not drag the Smiler toward the true hidden body.

**Core rule:** the Smiler must be capable of being wrong.

---

# 9. Multiplayer target behavior

### PROJECT LOCK
The approved Stage 2D implementation scores only people/evidence it actually perceives.

Relevant factors already approved include:
- person currently in view
- visible light on that person
- recent legitimate loud sound
- perceived/remembered distance

### COMMITMENT
The approved Stage 2D Smiler uses a species-specific target commitment of about **3 seconds**, except where a canon trigger justifies otherwise.

Stage 2F must not replace this with one universal shared commitment timer.

### HIDDEN PLAYERS
A player that the Smiler has never legitimately perceived must not win targeting merely because the server knows that player is nearby.

### ANONYMOUS LIGHT
A light elsewhere may draw attention away from a person being merely watched in darkness, but approved eye-contact holding takes precedence according to existing Stage 2D behavior.

---

# 10. Infrared / night vision

### PROJECT LOCK
Infrared has **no effect on Smiler AI**.

The approved Stage 2D tests require IR OFF and IR HIGH to produce identical Smiler decisions under otherwise identical observations.

Do not feed the Smiler:
- IR beam
- IR power
- NV sensor state
- another player's IR state

IR may exist as replicated equipment/world state for compatible clients without becoming Smiler sensory evidence.

---

# 11. Personality

### PROJECT LOCK
The approved Stage 2D Smiler uses four bounded deterministic traits:

- patience
- curiosity
- persistence
- boldness

These affect timing / nerve rather than changing species identity.

The approved report states chase-threshold variation is small (under 0.1).

Stage 2F must not create:
- easy/normal/boss Smiler classes
- new powers tied to personality
- radically different species rules

---

# 12. Randomness

### KNOWN ARCHITECTURE ISSUE
Stage 2D documented that Smiler random consumption could shift unrelated Hound seeded outcomes because the project shared random streams.

This is a **Stage 2F architecture issue**.

### STAGE 2F RULE
It is allowed and expected to isolate RNG streams underneath the Smiler.

However:
- do not change Smiler tuning merely because the RNG stream changes
- preserve equivalent behavior for equivalent fixed traits/evidence
- do not use RNG refactoring as permission to redesign the species

---

# 13. Death / victim behavior

### PROJECT LOCK
The approved Stage 2D Smiler does **not** "play with" victims as canonical behavior.

Kills are treated as quick.

Existing admin-only preview/death variants are not evidence of Smiler sadism or canon behavior.

Do not add sadistic motives or prolonged play behavior as canon.

---

# 14. Sound

### CONFIRMED CANON / PROJECT BASIS
The approved Stage 2D attack mapping permits a loud noise to trigger attack behavior.

### PROJECT LOCK
Sound evidence must still obey the shared evidence model.

A sound event does not automatically grant:
- exact hidden player coordinates
- exact hidden velocity
- known identity

Player-specific hidden footstep attribution was explicitly left as a Stage 2F shared-intelligence problem.

Stage 2F may fix attribution architecture, but it must not change the Smiler's canon attack rule.

---

# 15. Stage 2F preservation table

| Area | Stage 2F rule |
|---|---|
| Darkness/lurking | Preserve |
| Attraction to visible light | Preserve |
| Light-carrier chase logic | Preserve |
| Panic/loud-noise attack trigger | Preserve |
| Eye-contact counterplay | Preserve |
| Slow-retreat release behavior | Preserve |
| Face-only presentation | Preserve |
| No hidden-position tracking | Preserve |
| Fallible search / uncertainty | Preserve |
| Smiler-specific target commitment | Preserve |
| IR blindness | Preserve |
| Personality ranges/tuning | Preserve |
| Shared RNG coupling | **May be refactored in 2F** |
| Hidden footstep identity leakage | **May be fixed in 2F** |
| Shared evidence arbitration | **May be refactored in 2F** |

---

# 16. Explicit DO NOT INVENT list

Stage 2F must not add:

- confirmed full-body anatomy
- arms / legs / torso rendering
- teleportation
- phasing
- omniscience
- wall vision
- exact hidden tracking
- IR vision
- universal proximity aggression
- permanent eye-contact immunity
- immunity-breaking rules not already approved
- pack telepathy
- account/meta knowledge
- HP/inventory-based target choice
- sadistic victim "play" as canon
- new supernatural senses

---

# 17. Stage 2F acceptance constraints

1. **Species identity remains unchanged.**
2. **Darkness remains its home state.**
3. **Visible light remains meaningful.**
4. **Anonymous light remains a lead, not automatic identity.**
5. **A visible light carrier may provoke pursuit under the existing rules.**
6. **Attack remains tied to the approved panic/retreat or loud-noise logic.**
7. **Eye contact + slow retreat remain meaningful counterplay.**
8. **The Smiler may be wrong after losing someone.**
9. **No hidden coordinates.**
10. **IR remains invisible to Smiler AI.**
11. **Face-only presentation remains.**
12. **Shared infrastructure may change; species behavior may not.**

---

# 18. Stage 2F self-audit checklist

Before accepting a shared-system change, ask:

- Does the Smiler receive the same semantic evidence it legitimately perceived?
- Did anonymous evidence accidentally become identified?
- Did RNG isolation alter tuning rather than only deterministic independence?
- Did sound attribution accidentally grant hidden identity?
- Did a shared target algorithm overwrite the Smiler's 3 s species commitment?
- Did a generic arbitration system weaken eye-contact priority?
- Can the Smiler still choose the wrong search path?
- Can a hidden, never-seen player win targeting?
- Is IR still absent from AI?
- Did any new system accidentally require a full body?
- Are canon rules still distinguishable from gameplay inference?

If uncertain, preserve the Stage 2D behavior.

---

## Final project summary

For Stage 2F, the approved Smiler is a darkness-associated, light-reactive entity whose threat escalates around visible light, panic/retreat, and loud noise; sustained eye contact and slow retreat are meaningful counterplay. Its visible presentation remains eyes/teeth only, its body is not invented, it can lose the player and search incorrectly, and it does not perceive IR.

Stage 2F may refactor shared evidence, identity attribution, memory, and RNG architecture beneath this behavior. It may not redesign the Smiler itself.
