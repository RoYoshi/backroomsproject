# Trial 3 R20, S track: hearing, set against what a player hears

Trial 3 is **not owner-approved**.  The values below are proposals for the owner's QA.

## What the source says

### A person's sounds, as the server makes them

`ai.engine.js` `playerNoise`, from `WORLD.NOISE` (`space/shared/world.move.js`), multiplied by the floor's `step`:

| sound | radius `r` | surface multiplier | intensity |
|---|---|---|---|
| a walking step | 240 | carpet 1, deep 1.1, concrete 1.25, wet 1.3 | .42 |
| a running step | 640 | as above | .9 |
| a crouched step | 85 | as above | .14 |
| a crawl | 95 | as above | .16 |
| a slide | 460 | | |
| vaults | 170 / 360 / 520 | | |
| a landing | 420 × .45-1 | | |
| ragged breath | 300 × need | | |

- Ragged breath is made only when they are exhausted, or under 26 stamina.
- Speech is separate (`SK.hearSpeech`, 576 px), the players' own nearby-speech radius.

### What a creature hears (`ai.senses.js` `hearEvent`, shared)

The reach is

```
eff = r × (.42 + 1.05 × HEARING) × focus × (listening 1.5) × (feeding .65) × (dormant .75) × (deafened .3)
```

- Through a wall, the reach is × .6.
- The intensity falls as `(1 - d / eff)^.7`.
- The heard place is fuzzed by `26 + .16 d`, × 1.75 through a wall, less for a sharper mind and ear.
- A sound names a person only if the creature sees them at that moment (`identifySound`); otherwise it is anonymous (a lead).

The Skin-Stealer's `HEARING` is about .66, so its multiplier is ≈ 1.11.  At R19 it heard:
- a walking step to about 270 px in the open (160 through a wall);
- a running step to 710 px (430 through a wall).

### What a player hears of the Skin-Stealer (`spacious-audio/client/skin.audio.js` `step()` and `place()`)

- Each footfall is placed with a smooth falloff to 950 px, or 520 px when it treads softly (creeping, approaching, or in a borrowed skin).
- Its gain is (.22 + .25 × run) × (soft .45).
- A wall between them halves the gain and muffles it.
- A step is played while its gain is over .02.

Solved for distance, the player hears its step:

| step | open | through a wall |
|---|---|---|
| walking (160 px/s) | ≈ 734 px | ≈ 668 px |
| running | ≈ 770 px | ≈ 717 px |
| soft | ≈ 347 px | — |

Players do not hear other players' footsteps at all; only their own and the creatures'.

## The asymmetry

A player hears a walking Skin-Stealer at about 730 px.  At R19 the Skin-Stealer heard a walking player at about 270 px, nearly three
times less, while it heard a runner about as far as a player hears it run.  That is the owner's "player-equivalent hearing" gap.

## The change: an opt-in ear for the species, set by kind of sound

A species may say how far it hears each kind of a person's own sound (`sp.hearScale(ev)`) and how much of that reach survives a wall
(`sp.hearWall`).  It is the shared law otherwise.  Only the Skin-Stealer has one (`SK20.hear`, `SK20.hearWall`).  The Hound and the Smiler
have none and keep the shared law exactly (NA07 checks this).

| a person's sound | R19 reach (open) | **R20 Skin-Stealer** | multiplier | a player hearing its step |
|---|---|---|---|---|
| walk | ≈ 270 px | **≈ 680 px** | × 2.4 | ≈ 734 px |
| run | ≈ 710 px | **≈ 800-850 px** | × 1.12 | ≈ 770 px |
| crouched step | ≈ 95 px | **≈ 95 px (unchanged)** | × 1 | its own soft step ≈ 347 px |
| crawl | ≈ 106 px | ≈ 106 px (unchanged) | × 1 | — |
| slide / vault / landing | — | | × 1.35 / 1.2 / 1.2 | — |
| through a wall | × .6 of the reach | **× .75** (walk ≈ 510, run ≈ 635) | | ≈ .91 of the reach |
| breath, speech, struggling | unchanged | unchanged | × 1 | |

The NA07 measurements are on carpet; the floor's own multiplier applies on top.

What was deliberately not done:
- **Crouching stays exactly as quiet as at R19.** A crouched step or a crawl is heard at R8-R19's reach (about 95 px), a seventh of a walking
  step's.  The pack asked for crouch stealth to be kept.  A first proposal of × 1.9 (≈ 190 px) made R11-R16's tests of a silent doubling
  back hear the silent person (PR11, PR15), so it was taken back.  A crouched person standing still makes no sound at all.
- **Walls still muffle more than they do for a player:** .75 of the reach, against about .91 for a player.
- **Sound never identifies anyone,** however far it carries.  The fuzz grows with distance as before.  A distant sound is a lead, never a
  target.  What it does with one is listen, then go to look or take a post (DESIGN_DECISIONS S5); it never starts a hunt for a named
  person.

## The A/B (REGRESSION.md)

- With R19's ears (V2) or half the boost (V7), the strategy has less to work with.  Interceptions fall from 17-25 to 11-20 per 160 min,
  and surprise captures fall from 3/26 to 0/24 at .55.
- With the boost, it meets more people: 90-105 meetings against 77-86 at R19.  Escapes rise with the meetings.

These are proposals.  The owner is the judge of whether it now "hears like a player".
