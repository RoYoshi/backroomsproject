## v16.2 Codex fluid-motion comparison

This review build preserves the rounded player body, exactly two circular hands, existing customization, and all eight v16 kill variants. No player limbs or ragdoll skeleton were added. It is based on the supplied v16(2) runtime and the earlier Codex physical-death comparison; Claude’s version has not been merged.

The implementation and automated checks are complete for this pass. Full interactive browser acceptance remains outstanding: the managed browser rejected localhost with `ERR_BLOCKED_BY_CLIENT`. The accompanying preview and image sheets render the shipped Graphics code through native canvas; they are not browser gameplay captures.

## What changed

`death-motion.js` now runs a small deterministic model at 120 Hz and interpolates its displayed positions. The body preserves incoming velocity and angular momentum. Authored variant trajectories drive an independent attacker mass; a soft gripping connection transfers force in both directions. The victim is not assigned a fixed offset from the attacker. Existing stamina/exhaustion modulates pushing, bracing and resistance without changing capture outcomes.

The two existing hand nodes have independent damped springs, delayed response, asymmetric targets, brief floor bracing and a short reach for a dropped light. Side constraints and bounded reach maintain their connection to invisible anchors. Purposeful motion fades into settling; there is no periodic orbit/flail cycle.

Body, hands, loose lights and hats resolve against the game’s actual crawl-mode blockers. Movement is subdivided to prevent tunneling; contacts remove normal and tangential momentum, add restrained recoil and brief squash, and affect the gripping connection. Loose lights also check their head, not only their handle. This is a lightweight circle/support-circle approximation, not mesh collision.

Loose equipment inherits its attachment-point velocity and body spin before sliding, colliding and stopping. A headlamp remains attached. Violent variants can dislodge the original hat artwork. The backpack stays attached with small damped positional/rotational lag. Light emission follows the actual equipment orientation and lens position.

The final animated avatar node is adopted by the corpse. Its actual body, hands, wounds, accessories and pose persist; local and remote handoffs support either packet arrival order. Small impact marks and sampled drag trails use the same drawing function before and after handoff. The model transitions through ACTIVE → SETTLING → SLEEPING, and settled corpses do not run a continuous physics solver. A returning remote attacker keeps its actual view and blends back to server movement through a bounded cosmetic spring.

The Hound has independently timed planted feet, asymmetric weight shifts and damped hair. Its bite sits nearer the victim’s edge so the body/hands stay readable. Smiler movement uses restraint and smooth directed pulls; its growth is restrained. Local shock is brief, the camera impulse is damped, and blackout starts only during the last 0.85 seconds.

## Multiplayer and cost

The server owns the kill’s attacker, variant and seed, timestamps the replay, and derives the final collision-aware body/light/hat transform from the event. It rejects early publication and does not let a malformed pose bypass a known physical event. Older physical clients and clients without the new event parameters retain their previous corpse timing/path. Bounded initial cosmetic pose/momentum and appearance remain client-supplied. This does not change the simulation’s gameplay authority.

No hand coordinates are streamed per frame, and entity/player snapshot formats are unchanged. The tested corpse packet was 685/1400 bytes. The largest physical payload in the matrix was 822 bytes, leaving room for the normal metadata envelope. Client/server use the same module; v1 poses remain readable.

A 64-event actual-map CPU sample measured about 11 ms median, 23 ms p95 and 38 ms maximum to compute an entire event endpoint on this machine. That work happens once per publication. These figures are not a browser frame-time benchmark; concurrent deaths and WebGL performance still need a live session check. No general physics engine or production dependencies were added.

## Validation

| Check | Result |
|---|---|
| Existing perception/Hound/Smiler/capture/system suite | 54/54 scenarios passed |
| Physics and shipped corpse integration | 30 checks passed |
| Geometry/momentum/exhaustion/light matrix | 120 configurations passed; 96 core cases repeated at 1× and 0.25× |
| Actual Graphics and remote handoff | 10 checks passed; all eight rendered at both rates |
| Animation lab controller/isolation | 5 checks passed |
| Real HTTP/WebSocket transport | 9 checks passed, including authority, early bodies, living spoof rejection and late join |
| 30/60/144 fps replay | Identical endpoints for all eight variants |
| Real Level 0 wall/corner/furniture sampling | 24 near-obstacle starts, body/hand clearance and anchor reach checked throughout |
| Settlement | All matrix cases slept before their deadline; maximum pre-sleep velocity 0.225 px/s |
| Runtime integration | Syntax, script inclusion, readable patch reproduction, unchanged simulation files and archive integrity checked |

The acceptance matrix’s largest 120 Hz positional step was 3.62 px. That bound, finite Graphics checks and interpolation tests catch discontinuities; they do not certify artistic quality.

## Visual review

The 30-second MP4 presents every variant simultaneously: 6 seconds at 1× followed by 24 seconds at 0.25×. Eight dense sequence sheets and two no-gore geometry/momentum matrices accompany it. Sampled rendered frames were inspected for contact, recoil, hand lag, equipment release, collision, occlusion and corpse continuity. These reviews led to the angular-velocity fix, correct wound winding, reduced Smiler growth, corrected hair lag, more readable bite position and flashlight-head collision.

| Variant | Motion preserved and reviewed |
|---|---|
| Hound A | Tackle, directional recoil, follow-through, hand lag and light release |
| Hound B | Weighted drag, asymmetric resistance, light left behind and persistent smear |
| Hound C | Actual wall stop/recoil, hand reaction and light contact |
| Hound D | Weaker resistance, smaller collapse and faster quiet settling |
| Smiler A | Initial restraint followed by two continuous pulls |
| Smiler B | Cornered restraint with limited displacement |
| Smiler C | Earlier loss of control and movement toward darkness |
| Smiler D | Deliberate separated pulls with continuous residual motion |

The preview uses controlled floor/wall/corner fixtures and keeps the attacker visible for endpoint inspection. The actual remote return is exercised by renderer/integration checks. The lab offers local-victim shading and spectator views; live browser visibility, exact local camera presentation, audio, admin-window layout, WebGL initialization and multi-browser play remain unverified. All eight should receive that final 0.25× review in the game before treating this as release-approved.

## Files and merging

| File | Role |
|---|---|
| `death-motion.js` | Shared deterministic masses, hands, contact, equipment, settling and renderer adapters |
| `death-lab.js`, `death-lab.css` | Admin-only replay sandbox and diagnostics |
| `gore.js` | Localized marks, persistent trails and corrected gash vertex winding |
| `ents.js` | Asymmetric gait and damped hair with corrected lag direction |
| `mp.js` | Timestamped event transport, shared corpse adoption, attacker handoff and lab entry |
| `server.js` | Validation, clock, authoritative final transforms and static lab serving |
| `index.html` | Module/style inclusion and less obstructive shock flash |
| `assets/index-DKbV5Nv9.js` | Small avatar/corpse/camera/entity-view hooks |
| `package.json`, `README.md`, this document | Version, run instructions and review notes |
| `dev/physical-*`, `dev/fluid-*`, `dev/render-fluid-preview.js`, `dev/patch_fluid_death.py` | Integration tests, acceptance matrix, preview and readable hooks |

`ai.js`, `sim.js`, `world.js`, `move.js`, `sfx.js`, `hud.js`, `glitch.js`, `camcorder.js` and `inventory.js` are byte-identical to the earlier comparison baseline. Gameplay, movement, perception, CAUGHT/DEAD, LOD, sound bus and capture logic were not changed to accommodate animation.

Use the merge kit’s readable patches and source modules to select changes for Claude’s build. Do not replace its compiled bundle wholesale. `patch_physical_death.py` is the first hook pass for the supplied unmodified v16(2); `patch_fluid_death.py` is the incremental pass for the previous Codex physical build. Both check their anchors and stop before writing on a mismatch. Merge equivalent methods manually when Claude’s renderer differs.

## Run and review

Run the included launcher or `node server.js 8000`, then open `http://localhost:8000`. No npm install is required for the game; Node 18+ is supported.

Open the existing admin panel with Backquote, unlock it with the host’s admin passcode, and select **OPEN ANIMATION LAB**. The lab lets you choose all eight variants, Level 0/open/wall/corner geometry, victim/attacker coordinates, motion, stamina and light. It includes replay/reset/pause, 1×/0.5×/0.25×, 120 Hz stepping, body/light trajectories, hand targets, collision points, angular velocity and no-gore viewing. It is an independent cosmetic viewport; it does not kill players or modify the live world.

Tests:

```sh
node dev/physical-test.js
node dev/fluid-matrix-test.js
node dev/fluid-render-test.js
node dev/fluid-lab-test.js
node dev/physical-network-test.js
node dev/tests/run.js s_percept.js s_hound.js s_smiler.js s_capture.js s_system.js
```

The transport test needs Node 22+ for its built-in WebSocket client. Optional offline preview generation needs `@napi-rs/canvas` and `ffmpeg`; production gameplay does not.
