# Stage 3D HQ1: the dying light, protocol and clock

This describes how the light of a wanderer who has died fails. It holds normally, flickers and dims, then goes out for good, at the same moment on every screen. It also covers what goes over the wire for that.

The authoritative death itself is unchanged. It is Stage 3D's D4 design: the server decides the kill, runs the physics, and makes the corpse.

## 1. What a player sees

1. **Which lights fail.**
   - A flashlight, lantern or headlamp that was **on** when its wanderer died shines on.
   - A light that was **off** stays off. Nothing is drawn for it, ever.
   - A **camcorder** is not an emitted light. It has no profile and nothing is drawn, as at D7.
2. **When the hold starts.**
   - A flashlight or lantern holds from the moment the death's physics **lets go of it**: dphys `eqAt`. This is 0.30–1.71 s into the death, depending on the killer and variant.
   - A headlamp stays on the head, so it holds from the **death's start** (the kill).
   - The light holds at full power for 3.0–7.0 s.
3. **The failure.**
   - Over the next 1.0–2.0 s, the light flickers irregularly in 0.1 s steps: short full-height flashes, dips and blackouts.
   - Under it is an envelope that only ever falls.
4. **The end.**
   - At hold + fade, the power is **exactly 0**, and it stays 0 for that death.
   - The light is then removed from the lighting input altogether, not drawn at 0.
5. **What does not change.**
   - The light's position, angle, colour, lens origin and shadows are D7's. Only its strength changes.
   - Living wanderers' lights, the ceiling fixtures and the NEW RUN "light left behind" record are untouched.

## 2. The profile (server)

`dphys.lightProfile(worldSeq, de, kind)`:
- It is computed in `server.js` `aftStart`, once per death, when the death begins.
- It is a 32-bit FNV/murmur-style hash of the world's reset count, the death id and the light kind. It never uses a client's randomness.
- It returns `[hold, fade, seed]`:
  - `hold`: 3.0–7.0 s in 0.1 s steps (41 values);
  - `fade`: 1.0–2.0 s in 0.1 s steps (11 values);
  - `seed`: 0–1023, which picks the flicker pattern.
- A camcorder or an unknown kind gives `null`.
- The server sets it only when its own record says the light was on (`p.light`).

Where it travels. Every field is death-domain and optional; a D7 client ignores it.

| Message | Field | Meaning |
|---|---|---|
| victim's snapshot `s`, kill record `mk` | `mk.lf = [hold, fade, seed]` | the profile |
| replay `fx` (everyone else; late joiners within 10 s also get `el`) | `lf = [hold, fade, seed]` | the same profile |
| corpse record in `bodies` | `lf = [hold, fade, seed, rr]` | `rr` = the server physics' release time − the death's length (s, 3 decimals). It is the release relative to the corpse's making, ≤ 0. A headlamp's is −length |
| corpse record in `bodies` | `ag` | the corpse's age, now in **tenths** of a second (D7: whole seconds), counted from the **death's end** (`a.at + length`), not from the loop pass that placed it a moment later |

Sizes: the replay is 241 B; a corpse record is 410 B with `lf` and 384 B without (the D7 sample was 384 B).

A client cannot set or change any of it:
- forged `fx` and `b` messages are not relayed (D4);
- the NEW RUN record never carries `lf` (`light_net.js` H4).

## 3. The power (every screen, and the server's own copy of dphys)

`dphys.lightPower(lf, s)` takes `s`, the seconds since the release:
- it returns 1 while `s < hold`;
- in the failure (`t = s − hold`, `u = t / fade`):
  - the envelope is `(1 − u)^1.4`;
  - each 0.1 s step `i` has one window at full envelope height. Outside it, the light dips to 0.30–0.85 of the envelope or goes black (0). Blackouts become more likely through the failure, from 12 % to 67 % of steps, and there is always at least one;
- it returns exactly 0 for `s ≥ hold + fade`, forever;
- it returns 0 with no clock (NaN or undefined). A record without a profile uses `[5, 1.5, 0]` (off 6.5 s after release).

The plan for each `(fade, seed)` is cached (at most 64). The function is pure: the same numbers give the same power on every screen.

## 4. The release moment

`dphys.releaseOf(S)` gives the release moment:
- the physics' own `eqAt` once the death on that screen has reached it;
- before that, the same deterministic run from the same start, simulated ahead once (up to 1.9 s of 240 Hz steps, a few milliseconds);
- for a headlamp: 0.

So the release is known from the death's first frame, whatever the screen shows. Asking does not change the death (`light_power_test.js` P8, 192 deaths).

## 5. The clock (`mp.js`)

Each page keeps one **anchor** per death id: the moment the light was let go, on that page's own `performance.now()` clock. It is the **earliest** of every piece of the server's timing the page receives:

1. **The victim:** her kill record's arrival (taken when `mk` arrives, not when the death starts on her next frame) + the release.
2. **A spectator's replay:** its arrival − `el` + the release.
3. **Every corpse record:** its arrival − `ag` + `rr`. This includes the victim's own corpse as the server sends it, which her game never shows.
4. **The same on the server's own clock.**
   - The snapshot clock `st` comes from the snapshot that carries the kill record, or from the first snapshot after a replay or corpse message (the server sends them in one pass).
   - It is converted with the page's existing snapshot offset (`net-interp.js` `NET.off`). That offset follows the fastest packets, so it excludes the page's own delay in handling messages.

A message can arrive late but never early, so the earliest is the nearest to the server's moment.

On a busy page the first estimate can be late. In the SwiftShader tests a victim's page first put it 140 ms late, until the server-clock evidence moved it earlier.

The anchor **can only move earlier, never later**:
- A replay handing over to its corpse, a reconnect, a page reload, focus, resize, respawn or the corpse's creation never starts the light again.
- A reloaded page re-derives the same moment from the server's messages.

**The Death Lab** slows, pauses or steps what one screen shows. The light's clock is real time, and the release is known ahead (§4), so a paused or slowed death neither lengthens nor shortens the light.

## 6. Rendering: one power, three renderers

- **`window.__peerLights`:**
  - the lights of replays and corpses carry `pw` (0–1);
  - a light at `pw ≤ 0` is left out;
  - living wanderers' lights have no `pw`.
- **`window.__deathLight.own()`:** the power of the victim's own dying light while her death is on her screen.
- **BR-RoLE** (`assets/br-role.js`):
  - a peer light's weight is `× pw`; its field, colour tint and hand glow all scale with it;
  - the victim's own death light gets `w: own()` and is skipped at 0;
  - peers at 0 are filtered out before the per-tier peer cap, so a dead light never takes a living light's slot.
- **`light.js`:** the own torch is `× own()` while dying, and peers are `× pw` and skipped at 0. `light.js` is the lighting sample for entity shading and readability.
- **The bundle's own lighting** (`?lighting=legacy`, BR-RoLE off): two exact-text edits in `dev/stage-3d/apply_bundle.py` (checkpoint `HQ1`) scale the death torch's glow and beam (`drawLight`) and each peer's (`drawPeers`) by the same value.
- **No duplicate light:**
  - a corpse adds no light while its wanderer's death is still playing on that screen: the replay's light is that light (`__hideBodies`), and the victim's own corpse is skipped while her death is on screen (`corpseId`);
  - so `fx` handing over to `bodies` never doubles the light. At D7 the victim's screen showed two.
- **Off, or a camcorder:**
  - no profile anywhere;
  - the replay and the corpse add nothing (`lo` 0, or the camcorder skipped as at D7);
  - the victim's own dying light has power 0, because the server's record has no profile.

## 7. Compatibility

| | |
|---|---|
| HQ1 server, D7 client | `lf` is ignored, so the light shines forever (D7's behaviour); `ag` in tenths only refines blood drying |
| D7 server, HQ1 client | no `lf`: the default profile, off 6.5 s after the release |
| non-death traffic | unchanged: no new message type; the snapshot `s` has no new field |

## 8. Development hooks (not player features)

- `window.__deathLightNow`: a test may set this to freeze that page's light clock and photograph exact moments (`light_timeline.py`). It changes only what that page draws. A page can already redraw its own lighting any way it likes, so it gives no advantage, and it is never set by the game.
- `window.__deathLight.debug()`: the page's anchors, the server-clock evidence and the last frame's power evaluations, for the tests.
