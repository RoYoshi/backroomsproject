# Trial 3 R9–R17 — design decisions

Every number here is PROPOSED and unapproved; Trial 3 is **not owner-approved**. Each decision names the owner's requirement it serves,
what was chosen, why, and what it deliberately does not do.

## R10 — the Skin-Stealer's heartbeat and sting, only while it is seen

**Requirement** (pack `04`, owner): the heartbeat and the sting when the local player actually sees the Skin-Stealer, only while it is in
sight; never because it is near, hunting or waiting unseen; the Hound/Smiler dread unchanged; a convincing disguise never betrayed; its
physical sounds stay.

**R10-1 What "seen" means: the renderer's own rules, not the server's.** A new module, `src/frameworks/spacious-audio/client/
skin.sight.js` (in `public/assets/skinstealer.js`), decides on the page, every frame, for each mirrored Skin-Stealer:
- *on screen*: its body (30 px round its centre) inside the window with this frame's camera and zoom (the `cam` and `sc` the game hands
  the dread hook; the camera shake of a few px is ignored);
- *in the sight mask*: the creatures layer is masked by `visibilityPolygon(player, 700)`, cast with the bundle's `rayDistance` (walls and
  pillars). The module casts the same function (`__api.Uc`) from the player to the body's centre and to points 18 px either side across
  the line of sight (the drawn body is ~42 px wide), each within 700 px;
- *readable*: the darkness overlay hides what is not lit for this player. The client's own legibility function `exposureAt`
  (`__api.Ul`: the near aura, this player's torch with its LOS, the lamps with their flicker, night vision and IR, the range fade) must be
  at least **.25** at a point that is in the mask. Measured values: a lamp-lit body at 260 px .60; torch-lit at 260 px .39; the dark .04;
  .25 sits well above darkness and below anything a player would call clearly lit.
A body counts as seen when at least one of its three points is in the mask and readable. Nothing here asks the server; the server's
`seenNow`, its distance and its sounds are never used.

**R10-2 A disguise is never given away.** A Skin-Stealer whose snapshot carries a borrowed look (`dg`) is not a candidate at all. When the
skin drops (its wind-up, a run, the time up) it is an ordinary candidate from that frame: a seen one gets the onset and, if armed, the
sting. A separate "suspicion" mechanic was not added (the pack leaves that to an explicit owner review).

**R10-3 A glimpse is not a sighting.** A sighting is *confirmed* after **0.12 s** of being seen without a break; a body flickering at a wall
edge confirms nothing. Once confirmed, the envelope `ks` rises to its target within ~0.1 s; the target is `0.35 + 0.65 × (1 − d/700)` (a
seen one is never quieter than the floor). Out of sight, `ks` falls linearly to 0 in **0.5 s** (the release) — no seconds of tracking.

**R10-4 The sting.** Once per confirmed sighting, for a Skin-Stealer that is *armed*; it is disarmed by its sting and armed again only
after **2.5 s** fully out of sight; at most one Skin-Stealer sting every **8 s** for all of them (no multi-creature spam). Within 1.2 s of
the established `k` sting it is not played (one sting, not two). Every rule advances with the frame's `dt`: no timer of its own, no random
draw.

**R10-5 Integration: one heartbeat, the rest untouched.** `src/core/client/mp.frame.js` asks `window.__skin.sight(t, {cam, sc, W, H, run})`
once a frame and beats the heartbeat on `max(k, ks)`; the drone, the vignette, the shake, the light flicker and the Hound/Smiler sting stay
on `k` alone. With `ks` 0 the hook's code path is R8's: the node test V12 runs R8's `mp.frame.js` (a fixture checked against its git blob)
and this one through 40 s of a Hound and two Smilers, frame by frame, and every output is identical with no Skin-Stealer and with one
behind a wall. The heartbeat's shared timer means that *after* a Skin-Stealer has been seen, the next Hound beat may fall up to one beat
period earlier or later than it would have — the only lasting difference, and only after a real sighting.

**R10-6 Audio only.** The owner asked for the heartbeat and the sting; no vignette, shake or flicker is driven by the Skin-Stealer (those
would also change what reduced-motion players see). Volumes are the established heartbeat's, scaled by `ks`; SOUND OFF silences it (the
thump's own check; a sting goes through the master gain, 0 when off — both observed in the browser, V10). `run` false (dead, spectating,
menu, paused) means no cue.

**R10-7 Not changed.** The Skin-Stealer's physical sounds (`skin.audio.js`: footfalls even when unseen, wind-up, leap, skid, feeding,
breath) are untouched: a hidden sprint can be heard where the game's acoustics carry it, with no dread cue.
