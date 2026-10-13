# H4-0: pre-flight (no game edit)

## Source

Checked live on 2026-10-13.

**The parent.** `git ls-remote` and the GitHub REST branch both give `stage-3d-hq3` at `49343193e6948c8323f35a34539ac84db5a89835`, with tree `5abdb5a2e6b1522fe027efc09e6e2c97ace10ccf` and parent `486564d`. This is the HQ3 QA1 checkpoint (the white-streak fix).

**`stage-3d-hq4`.** It existed on neither GitHub nor this machine. It was created at exactly `4934319`.

**Untouched before HQ4.** All 25 remote branches are recorded in `remote_heads_before_hq4.json`:
- `main` `7781e1a`;
- `stage-3d` `ffe2b53`;
- `stage-3d-hq1` `ebb3bd6`;
- `stage-3d-hq2` `f542b7c`;
- `stage-3d-hq3` `4934319`;
- `stage-3h0` `06949a8`;
- every older branch.

**The bundle build still reproduces HQ3.** `python3 -I dev/stage-3d/apply_bundle.py --check` reports: 12 edits on Stage 3H0's bundle, and the working copy (HQ3) matches.

## Fix A: the dark ellipse

**Where it is.** `assets/index-DKbV5Nv9.js`, the avatar class `$c`, `rebuild()`. The first child added is an anonymous Graphics, `this.addChild(new I().ellipse(1,5,19,19).fill({color:0,alpha:.3}),this.pack,this.body)`. That text occurs once in the bundle, and `ellipse(1,5,19,19)` occurs once.

**What it looks like.** It is offset 4-5 px toward the avatar's back (local +y) and 1 px larger than the body (radius 19 against 18). So it shows as a dark crescent behind the body, and it turns with the Wanderer.

**Who uses it.** Nothing refers to it: it is created without a name.
- The class and every other client file (`mp.js`, `gore.js`, `move.js`'s `__pose`, `br-role.js`, `l0-remaster.js`) reach the avatar's parts only by name: `body`, `pack`, `hands`, `hat`, `wounds`, `gear`.
- No code reads an avatar's children by index, its bounds, width or height, a hit area, or culling flags.
- The only bounds consumer is Pixi's own `cacheAsTexture` for corpse views (`gore.js` `cull`), which sizes the texture to whatever the view holds.
- So collision, camera, pointer picking and gameplay are not affected.

**Every Wanderer the class draws.** The same class draws:
- the local Wanderer;
- other players (`mkAvatar`);
- death replays;
- corpse views (`new $c(t.appearance, t.equipment)`).

Removing the ellipse therefore also removes it under a Hound or Smiler corpse. gore.js draws those corpses' own contact shadow and blood, and that is unchanged.

**The isolation A/B** (`lab/hq3`, the `ellipse` scene). The setup:
- fixture 2 alone (BR-RoLE `solo`), at MEDIUM;
- the Wanderer 100 px from it, her own light off;
- the clock frozen.

At headings 0, 90, 180 and 270 degrees, hiding only that anonymous child in the same frame:
- changed 149, 148, 142 and 146 pixels;
- **0 of them outside the ellipse's own outline** (grown 2 px);
- 0-3 inside the body circle (the edge of its outline).

The crescent goes; the body, hands, light and BR-RoLE's self-shading and cast stay (`lab_report.json`).

## Fix B: BR-RoLE's cast slides with the hands

**Where it is.** `assets/br-role.js` `actorShadows()`.
- The cast's `start` is the farthest point, along the light's direction, of every silhouette part: `silhouette()` lists the body (radius 18) and then both hands (6.5).
- `castActors()` draws the tongue from `.62 * start` to `start + ext`.
- `across` already uses the body only, and Hounds have one part (their torso).

**The reproduction** (`lab/hq3`, the `rotation` scene). Fixture 2 alone; the Wanderer's body never moves. The light's direction (`ang` 0), the length (`ext` 50) and the strength (`a` .673) are the same in every heading. Yet:
- `start` goes from 18.00 to 25.87 px as she turns (24 headings);
- the tongue's tip goes from 68.0 to 75.9 px;
- at heading 0, the hands at a walk's swing extremes (+-3 px) alone move it from 20.74 to 23.74 or 22.50.

**The drawn shadow, measured from the captures.** Each capture with BR-RoLE's actor effects on was compared with the same frame with them off.
- The far end of the darkening behind the body moves from 57.6 to 63.6 px.
- Its centroid moves from 31.1 to 35.5 px.

**The body alone** would give `start` 18 at every heading.

**The diagnosis holds:** the hands, not the light or the body, move the cast.

## Plan

**H4-1.** One exact-text edit removes the ellipse from that `addChild` call (`dev/stage-3d-hq4/apply_bundle_hq4.py`, on the accepted HQ3 bundle, after proving the Stage 3D build still reproduces it).

**H4-2.** For a player, `start` comes from the round body only (the first silhouette part). The hands stay in the silhouette, so they are still cut out of the cast and self-shaded, and Hounds keep their own path.
