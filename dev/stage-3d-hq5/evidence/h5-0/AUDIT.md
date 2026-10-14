# H5-0: source proof, HQ4 baseline, the decision

## Source

| | |
|---|---|
| Accepted parent | `stage-3d-hq4` `79e146124a5941c6578ef84dc9ff13176cc7f1f0`, tree `9aee1dba72ad26e7c3c1a8454d652275bfbf9ea6` (its parent `5f933db`). Checked live on GitHub and with `git rev-parse` before any change |
| Branch | `stage-3d-hq5` did not exist on GitHub or locally (`remote_heads_before_hq5.json`: 26 branches). It was created from exactly `79e1461`, with a clean working tree |
| Pack | `THE_FAR_BACKROOMS_STAGE_3D_HQ5_BR_ROLE_1_2_QA_FIRST_MASTER_PACK.zip`, SHA-256 `e907b812…6d5a` as given; its manifest matches |
| BR-RoLE | `assets/br-role.js`, `br-role 1.1-qa2`, 125,670 bytes |

## How BR-RoLE draws one frame (what the contact has to fit into)

`draw()` adds every light into the light buffer (`lighter`). Then the darkness overlay loses that buffer inside the game's line-of-sight clip.

| Light | Where it is composited | Actor work in HQ4 |
|---|---|---|
| A lamp with an actor job (its cast or self-shading) | Its own full-resolution scratch (`drawLamp`), then added | `castActors()` in that scratch |
| A lamp with no job | Straight into the half-resolution core buffer `S.cb` (BR-RoLE 1.1-qa1's fill saving), added once | None |
| Far field and bounce light | The eighth-resolution buffer `S.fb` | None ("the faint far light is left") |
| A carried light's beam | Its own scratch (`carried`), with walls and props cast in, then added | `castActors()` if it has jobs |
| A carried light's hand glow | A separate small field | None |
| Infrared | `irLight` | None |

**`actorShadows()`** runs before any light is drawn.
- **Its actors:**
  - you (`S.person`, never while `F.death`);
  - Hounds (`__hound`);
  - other wanderers: the direct children of the creature layer that have `deathPose`.
  - Never a Smiler.
- **Death replays.** `mp.js` adds each replayed death's avatar to that same layer and tags it `__cause`, so HQ4's cast also falls from a replay. Corpse views live in the floor layer, so none of them is listed.
- **Others must be seen.** An actor other than you is used only when you can `seen()` it (a line of sight within 700 px).
- **Candidate lights per actor (`cands`):**
  - every lamp whose tube she sees, past walls, pillars and props (`lampAt > .004`);
  - every carried light whose beam reaches her (`carriedAt > .004`), except as below.
- **The own-light exclusion, audited:** `self ? r.own : Math.hypot(r.x - x, r.y - y) < 45`.
  - Your own carried light never casts your shadow.
  - Another wanderer's own light (its hand, within 45 px) never casts that wanderer's.
  - This is deliberate. Such a shadow would hang off the hand and turn with the body.
  - Your light does cast other wanderers' shadows, and theirs cast yours.
- **Which lights get a job:**
  - only the dominant light, with hysteresis 1.35 and eased weights;
  - plus a 45 % second cast on HIGH.
  - The cast and self-shading fade within 40 px of the light (`near`). So **right under a lamp, HQ4 draws nothing for her at all**.

**`silhouette()`** gives the body (r 18) as part 0, then the hands as they are posed.

**`castActors()`** builds the cast tongue in a pooled canvas `S.atmp`.
- The tongue's root starts 0.62 × start behind the body's centre.
- Each silhouette part (r + 1.5, with a soft edge) is cut out of it, so the body is never darkened.
- The result is taken out of that light's scratch with `destination-out`.
- Then the self-shading is drawn on the body.

HQ4's guard (`kind !== 'player' || q === sil[0]`) keeps the hands from moving the cast's start.

## HQ4 baseline

Captured with `contact_lab.py` in a real page:
- the clock is frozen;
- one fixture, lamp 2;
- her own light is off;
- MEDIUM;
- the captures are in `baseline/`.

| Scene | What HQ4 does |
|---|---|
| 100 px from the lamp (628, 3792), 4 headings | One job, the dominant lamp: cast a .673, self-shading .42, length 50. Light in the buffer at the body's edge, across the cast's axis: .49-.53 on the sides and .55 toward the lamp. The cast's root takes about half (.227 at 20 px behind, against .455) |
| Right under the lamp (528, 3792) | **No job.** The light is .62-.64 all round her edge: nothing grounds her |

## The decision

**Scope: `assets/br-role.js` only. Nothing else in the game changes.**

**One contact job per light per living Wanderer**, for every light in her `cands`. Each light's contact is taken out inside that light's own compositing, so it removes only that light's own field.

| Case | Where the contact is taken out |
|---|---|
| The light already has a job for her (cast or self-shading) | In that job, in `castActors()`. The contact is built in the same pooled canvas as the cast, and only what the cast does not already take is kept (no double darkening at the cast's root) |
| A lamp on the scratch path, contact only | `castActors()` on its scratch, after its jobs |
| A lamp on the core-buffer path, contact only | `contactLamp()`. The core buffer gets the lamp as before except a hole round her, made of whole pixels with four clips. The light buffer gets the lamp at full resolution times that hole, as the core buffer's own 2× composite spreads it, with her contact taken out. The two add up to the lamp as before, and the contact is drawn at full resolution, like her cast |
| A carried light | `castActors()` on its scratch, after its jobs |

**Left whole:**
- her own light (the exclusion above is kept as it is);
- every hand glow;
- far fields and bounce light;
- infrared.

**The shape.**
- One cached texture: full to the body's edge, then (1 - t)² over 9 px past it.
- It is centred on the body in world space. It is cut out by the same silhouette as the cast, so no pixel of the body or the hands changes.
- It is nudged at most 3 px away from each light: 0.05 px per px of the cast length that light would give. So right under a light it is even all round.
- Its strength is 0.3 of that light at the edge.

**Who gets it: living Wanderers only.**
- A Wanderer whose avatar is not tagged `__cause` (death replays and corpses are) and is not squashed by `deathPose`.
- She must be on the floor: it fades out while she is falling in, drawn larger.
- It fades with her alpha.
- Never a Hound or a Smiler.
- Others only when seen, as HQ4.

Nothing is kept between frames, so there is nothing to clear on death, NEW RUN, disconnect or reset.

**Tiers.** The same rule on LOW, MEDIUM and HIGH. Only the buffers' sampling differs; HIGH's second cast limits its own contact.

**DEV only.** `__brRole.dev.contact(gain)` (0 off, 1 shipped, up to 4) and `dev.contacts()` (last frame's jobs). No setting, no admin command.

**No blocker.** Per-light honesty fits inside BR-RoLE's existing per-light compositing, in one file.
