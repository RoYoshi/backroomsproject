> Historical v16.1 comparison notes. The current motion system and validation are described in [FLUID-MOTION.md](FLUID-MOTION.md).

# The Far Backrooms v16 — Codex physical deaths

Separate comparison build based on `thefarbackrooms-level0-refined-v16(2).zip`.
Version: `16.1.0-codex-physical`. Keep this alongside Claude's version.

## Play

Extract the entire game folder, then run `node server.js 8000` inside it.
Open `http://localhost:8000`. For multiplayer, players use the same server
address and `?room=NAME`. Node 18+ is required; the server needs no npm packages.

## What changed

The original player artwork stays intact: one rounded body and two small hand
circles. No player arms, legs, joints, shoulders, humanoid skeleton or ragdoll
skeleton were added. Entity artwork remains the v16 artwork.

`death-motion.js` supplies one heavy circular body, two independently simulated
hands with invisible reach limits, and lightweight dropped hat/light bodies.
It advances at 120 fixed steps per second, independently of rendering speed.

- Hound tackles accelerate and rotate the body before the hands catch up.
- Drags gradually align the body with the pull; hands briefly plant, resist,
  trail, then lose purposeful movement.
- Wall slams use actual geometry, restitution, wall friction and brief impact
  squash. They cannot carry the corpse through a solid wall.
- Smilers begin with a still body and tense hands, then slide and rotate it
  continuously toward the attacker. The player does not vanish between poses.
- Carpet, deep carpet, concrete and wet tile have different drag friction.
- Hats keep their worn artwork when detached. Lights spin and settle
  independently, with their beam facing the direction of the actual device.
- The final body orientation, two hand positions, body shape, hat position,
  dropped light and wound seed become the persistent corpse configuration.
- Multiplayer replays receive the initial hand pose and deterministic seed;
  corpse records carry the final physical pose for peers and late joiners.
  The server validates the extra fields and retains the existing dead-player
  permission checks. Older records still use the existing fallback renderer.

## Merge with Claude

Start with the preferred complete game version. Review the small integration
changes; do not replace Claude's renderer, networking or AI files wholesale.

1. Add `death-motion.js` and its classic-script tag after `ents.js`, before
   `mp.js`. Add it to the server's static-file allowlist.
2. Follow `dev/patch_physical_death.py` for the renderer hooks. That script is
   intentionally restricted to the unmodified v16(2) bundle: exact anchors
   must match before it writes anything. The supplied full game is already
   patched; do not run the patch on it again.
3. Expose `__api.avatar()` for the living pose and `__api.Oc` for floor surfaces.
   Existing v16 already exposes the room table. Keep `mkAvatar` for hat artwork.
4. Start the motion controller at `Jl.start`, delegate `Jl.frame`, and pass
   `physicalPose` into `Avatar.deathPose` for both local and replayed victims.
5. Save `physicalPose` and `physicalHat` at `completeDeath`. Corpse rendering
   must apply that saved pose and seed, preserve the untinted player colours,
   clone the original hat artwork and rotate loose light art by beam angle
   plus pi/2. Avoid generating a fresh hand or wound configuration.
6. Merge the additive `mi` replay and `ps` corpse fields from `mp.js` and the
   corresponding `cleanPhysical` validation/relay in `server.js`.

The module handles visual aftermath. Server-side capture decisions, movement,
entity AI, gameplay, map and visibility remain the baseline v16 implementation.
During a network replay, the initial pose is sent once, then simulated locally.
This uses the same geometry on each client; it is not server-side corpse physics.

## Verification

Run `node dev/physical-test.js` and `node dev/physical-network-test.js`.
The 30 motion/renderer checks cover eight variants at 30/60/144 fps, collisions,
hand lag and reach, real Level 0 corners/furniture, corpse sleep, four light
types, identical wounds and hat artwork at the corpse handoff, and replay input.
The six HTTP/WebSocket checks cover module serving, pose relay, persistent
corpses, living-client restrictions, late joins and malformed-pose rejection.
The network test uses a controlled server-side dead-player fixture to isolate
serialization; it does not replace the existing AI scenario suite.

The comparison video is rendered from the shipped procedural avatar/entity
Graphics calls and real death/corpse hooks. Its bright review framing is for
checking motion; it is not a browser capture of the game's sight/lighting pass.
Full interactive browser playtesting remains to be done.
