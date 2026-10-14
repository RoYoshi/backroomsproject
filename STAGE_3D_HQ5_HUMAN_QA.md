# Stage 3D HQ5 / BR-RoLE 1.2: Human QA (one page)

**Status: HUMAN-QA CANDIDATE.** Only you can pass it. HQ4 stays the accepted game until you say HQ5 passes.

## What changed

**One thing: a faint ground contact under living Wanderers.** Right at the foot of the round body, each light that reaches her loses a little of its light on the floor. Her body blocks part of the light arriving there.
- It is strongest right under a lamp. HQ4 draws no shadow for her there at all.
- It belongs to the light, not to the character:
  - a second light fills it in;
  - in a blackout or with no light there is nothing;
  - it never shows through a wall;
  - it does not turn with her or follow her hands.
- Nothing else changed: her art, her HQ4 cast, the self-shading, the other lights and the gameplay.
- One file changed: `assets/br-role.js`.

**It is meant to be faint.** Your own flashlight alone gives no contact under you. That is the same rule as the HQ4 cast: your own light never shadows you. A friend's flashlight does give you one.

## Play it

- **Overlay:**
  1. Stop the server.
  2. Copy `HQ5_OVERLAY/assets/br-role.js` over `assets/br-role.js` in your **HQ4** game folder.
  3. Start the server with your own `ADMIN_PASSCODE`.
  4. Hard-refresh every tab (Ctrl+F5).
- **Or the branch:** `git checkout stage-3d-hq5`.
- **To check it loaded:** with DEBUG MODE on in the admin panel, BR-RoLE's corner panel shows `br-role 1.2-candidate`.

## Checklist

- [ ] **Standing still and rotating under a lamp:** slight, natural grounding. There is no attached circle or crescent, and BR-RoLE's side shading on her body is unchanged. Try right under a fixture, then a couple of body widths beside one.
- [ ] **Hands move or rotate (walk, turn, swing):** the contact does not wobble, and the HQ4 cast still answers the light's direction naturally.
- [ ] **Near fixtures, in a blackout and in peer lights:** only surviving light is affected. Nothing glows or rings, and there is nothing through walls.
- [ ] **Two players and a quick NEW RUN or respawn:** no ghosts, no regressions, and the game feels as before.

**Verdict (yours only):** PASS / NEEDS CHANGE / REVERT

If it needs a change ("stronger", "fainter", "wider" or "tighter"), each is a single constant.

## Undo

Copy `REVERT_TO_HQ4/assets/br-role.js` back over `assets/br-role.js`. Your game is then HQ4 again, byte for byte. You can also check out `stage-3d-hq4`.
